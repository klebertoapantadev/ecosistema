/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { validarCorreoEstructurado } from "@eco/primitivas";

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const {
      empresa,
      ruc,
      nombreContacto,
      cargo,
      correo,
      telefono,
      empleados,
      interes,
      mensaje
    } = body;

    // Validación básica de campos obligatorios
    if (!empresa || !nombreContacto || !correo || !telefono) {
      return NextResponse.json(
        { error: "Por favor complete los campos obligatorios: Empresa, Nombre, Correo y Teléfono." },
        { status: 400 }
      );
    }

    // Validación estricta y de estructura de correo electrónico
    const valCorreo = validarCorreoEstructurado(correo);
    if (!valCorreo.esValido) {
      return NextResponse.json(
        { error: valCorreo.error || "El correo electrónico ingresado no tiene una estructura válida." },
        { status: 400 }
      );
    }
    const correoFinal = valCorreo.correoNormalizado || String(correo).toLowerCase().trim();

    // 1. Guardar en base de datos si la conexión está disponible
    let client = null;
    try {
      client = crearClienteAdmin();
    } catch {
      client = null;
    }
    if (!client) {
      try {
        client = await crearClienteServidor();
      } catch {
        client = null;
      }
    }

    let insertOk = false;
    if (client) {
      try {
        const { error: dbError } = await (client as any)
          .schema("tranqui_legal")
          .from("trq_contacto_empresa")
          .insert({
            cte_empresa: String(empresa).trim(),
            cte_ruc: ruc ? String(ruc).trim() : null,
            cte_nombre_contacto: String(nombreContacto).trim(),
            cte_cargo: cargo ? String(cargo).trim() : null,
            cte_correo: correoFinal,
            cte_telefono: String(telefono).trim(),
            cte_empleados_rango: empleados ? String(empleados).trim() : null,
            cte_interes: interes ? String(interes).trim() : null,
            cte_mensaje: mensaje ? String(mensaje).trim() : null,
            cte_estado: "PENDIENTE",
            cte_detalles: {
              origen: "landing_planes_corporativos",
              fecha_solicitud: new Date().toISOString(),
              ip: request.headers.get("x-forwarded-for") || "desconocida",
              user_agent: request.headers.get("user-agent") || "desconocido"
            }
          });

        if (!dbError) {
          insertOk = true;
        } else {
          console.warn("[contacto-empresa] Aviso al insertar en BDD:", dbError);
        }
      } catch (errDb) {
        console.warn("[contacto-empresa] Excepción al guardar lead en BDD:", errDb);
      }
    }

    // 2. Despachar Correos Electrónicos
    const smtpHost = process.env.SMTP_HOST || "smtp.zoho.com";
    const smtpUser = process.env.SMTP_USER || "info@tranqi24.com";
    const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
    const smtpPort = Number(process.env.SMTP_PORT || 465);

    const correoOps = "admin.operaciones@tranqi24.com";
    const fechaEcuador = new Date().toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
      dateStyle: "full",
      timeStyle: "short"
    });

    let emailsEnviados = false;

    if (smtpHost && smtpUser && smtpPass) {
      try {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
          connectionTimeout: 8000,
          greetingTimeout: 8000,
          socketTimeout: 8000
        });

        // Correo 1: Confirmación al solicitante
        const htmlSolicitante = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Confirmación de Solicitud Corporativa — Tranqi</title>
</head>
<body style="margin: 0; padding: 0; background-color: #f1f5f9; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1e293b;">
  <div style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 10px 25px rgba(0,0,0,0.06); border: 1px solid #e2e8f0;">
    
    <!-- Encabezado de Marca -->
    <div style="background-color: #5000BA; padding: 32px 30px; text-align: center;">
      <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">tranqi<span style="color: #FEE300;">®</span></h1>
      <p style="color: #e9d5ff; margin: 8px 0 0 0; font-size: 14px; font-weight: 500;">Protección Legal Continua para Empresas</p>
    </div>

    <!-- Cuerpo -->
    <div style="padding: 32px 30px;">
      <h2 style="font-size: 20px; font-weight: 800; color: #0f172a; margin-top: 0;">¡Hola, ${nombreContacto}!</h2>
      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Hemos recibido con éxito los datos de <strong>${empresa}</strong> para acceder a información y asesoría sobre nuestros <strong>Planes Corporativos y Convenios Empresariales</strong>.
      </p>

      <div style="background-color: #f8fafc; border-left: 4px solid #5000BA; border-radius: 8px; padding: 18px 20px; margin: 24px 0;">
        <h3 style="margin: 0 0 10px 0; font-size: 14px; text-transform: uppercase; color: #64748b; letter-spacing: 0.5px; font-weight: 800;">Resumen de tu solicitud</h3>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Empresa:</strong> ${empresa}</p>
        ${ruc ? `<p style="margin: 4px 0; font-size: 14px;"><strong>RUC:</strong> ${ruc}</p>` : ""}
        <p style="margin: 4px 0; font-size: 14px;"><strong>Contacto:</strong> ${nombreContacto}${cargo ? ` (${cargo})` : ""}</p>
        <p style="margin: 4px 0; font-size: 14px;"><strong>Teléfono:</strong> ${telefono}</p>
        ${empleados ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Tamaño de nómina:</strong> ${empleados}</p>` : ""}
        ${interes ? `<p style="margin: 4px 0; font-size: 14px;"><strong>Interés principal:</strong> ${interes}</p>` : ""}
      </div>

      <p style="font-size: 15px; line-height: 1.6; color: #334155;">
        Un asesor corporativo especializado de nuestro equipo se pondrá en contacto contigo muy pronto para estructurar una propuesta a la medida de tu organización.
      </p>

      <!-- Beneficios Destacados -->
      <div style="margin-top: 28px; padding-top: 24px; border-top: 1px solid #e2e8f0;">
        <h4 style="margin: 0 0 12px 0; font-size: 14px; font-weight: 800; color: #5000BA; text-transform: uppercase; letter-spacing: 0.5px;">Beneficios incluidos en la Cobertura Corporativa Tranqi:</h4>
        <ul style="margin: 0; padding-left: 20px; font-size: 14px; color: #475569; line-height: 1.6;">
          <li style="margin-bottom: 6px;"><strong>Abogado Empresarial Dedicado:</strong> Asesoría ágil en materia laboral, contractual y societaria.</li>
          <li style="margin-bottom: 6px;"><strong>Bienestar Legal para tus Empleados (B2B2C):</strong> Consultas sin costo y descuentos preferenciales para tu nómina.</li>
          <li style="margin-bottom: 6px;"><strong>Portal Corporativo y Nómina Digital:</strong> Gestión de beneficios con secreto profesional y métricas de impacto.</li>
          <li style="margin-bottom: 6px;"><strong>Revisión y Blindaje Contractual Preventivo:</strong> Protección jurídica continua antes de que surja el conflicto.</li>
        </ul>
      </div>

      <div style="margin-top: 32px; text-align: center;">
        <a href="https://www.tranqi24.com" style="display: inline-block; background-color: #5000BA; color: #ffffff; text-decoration: none; font-size: 14px; font-weight: 700; padding: 12px 28px; border-radius: 999px;">
          Visitar tranqi24.com
        </a>
      </div>
    </div>

    <!-- Pie -->
    <div style="background-color: #0f172a; padding: 20px 30px; text-align: center; color: #94a3b8; font-size: 12px;">
      <p style="margin: 0;">© 2026 tranqi®. Todos los derechos reservados.</p>
      <p style="margin: 4px 0 0 0;">Si tienes dudas urgentes, puedes escribirnos directamente a <a href="mailto:admin.operaciones@tranqi24.com" style="color: #FEE300; text-decoration: underline;">admin.operaciones@tranqi24.com</a>.</p>
    </div>
  </div>
</body>
</html>
        `;

        // Correo 2: Alerta a Operaciones (admin.operaciones@tranqi24.com)
        const htmlOperaciones = `
<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="utf-8">
  <title>Nueva Solicitud Corporativa B2B</title>
</head>
<body style="margin: 0; padding: 0; background-color: #090d16; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #e2e8f0;">
  <div style="max-width: 640px; margin: 30px auto; background-color: #111827; border-radius: 16px; overflow: hidden; border: 1.5px solid #374151; box-shadow: 0 20px 40px rgba(0,0,0,0.5);">
    
    <div style="background: linear-gradient(135deg, #5000BA 0%, #1e1b4b 100%); padding: 24px 28px; border-bottom: 2px solid #FEE300;">
      <span style="background-color: #FEE300; color: #000000; font-size: 11px; font-weight: 900; padding: 4px 10px; border-radius: 999px; text-transform: uppercase; letter-spacing: 0.5px;">Nuevo Prospecto B2B</span>
      <h1 style="color: #ffffff; margin: 12px 0 0 0; font-size: 22px; font-weight: 800;">Solicitud de Información Corporativa</h1>
      <p style="color: #cbd5e1; margin: 6px 0 0 0; font-size: 13px;">Registrado el ${fechaEcuador}</p>
    </div>

    <div style="padding: 28px;">
      <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; width: 38%; font-weight: 600;">Empresa / Razón Social:</td>
          <td style="padding: 10px 0; color: #ffffff; font-weight: 800; font-size: 16px;">${empresa}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">RUC:</td>
          <td style="padding: 10px 0; color: #f1f5f9;">${ruc || "No especificado"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Contacto:</td>
          <td style="padding: 10px 0; color: #f1f5f9; font-weight: 700;">${nombreContacto}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Cargo / Rol:</td>
          <td style="padding: 10px 0; color: #f1f5f9;">${cargo || "No especificado"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Correo Electrónico:</td>
          <td style="padding: 10px 0;"><a href="mailto:${correoFinal}" style="color: #60a5fa; font-weight: 700; text-decoration: none;">${correoFinal}</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Teléfono / WhatsApp:</td>
          <td style="padding: 10px 0;"><a href="https://wa.me/${telefono.replace(/[^0-9]/g, "")}" style="color: #34d399; font-weight: 700; text-decoration: none;">${telefono} (Abrir WhatsApp)</a></td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Nómina / Empleados:</td>
          <td style="padding: 10px 0; color: #fde047; font-weight: 700;">${empleados || "No especificado"}</td>
        </tr>
        <tr style="border-bottom: 1px solid #1f2937;">
          <td style="padding: 10px 0; color: #94a3b8; font-weight: 600;">Interés Principal:</td>
          <td style="padding: 10px 0; color: #c084fc; font-weight: 700;">${interes || "General"}</td>
        </tr>
      </table>

      ${
        mensaje
          ? `
      <div style="margin-top: 20px; background-color: #1f2937; border-radius: 8px; padding: 14px 18px;">
        <p style="margin: 0 0 6px 0; font-size: 12px; color: #9ca3af; text-transform: uppercase; font-weight: 800;">Mensaje o Requerimiento:</p>
        <p style="margin: 0; font-size: 14px; color: #e5e7eb; line-height: 1.5; white-space: pre-wrap;">${mensaje}</p>
      </div>
      `
          : ""
      }

      <div style="margin-top: 28px; text-align: center;">
        <a href="mailto:${correoFinal}?subject=Propuesta%20Corporativa%20Tranqi%20para%20${encodeURIComponent(empresa)}" style="display: inline-block; background-color: #FEE300; color: #000000; text-decoration: none; font-size: 14px; font-weight: 800; padding: 12px 26px; border-radius: 8px;">
          Responder al Solicitante
        </a>
      </div>
    </div>
  </div>
</body>
</html>
        `;

        // Envío en paralelo de ambos correos
        await Promise.all([
          transporter.sendMail({
            from: `"Tranqi Empresas" <${smtpUser}>`,
            to: correoFinal,
            subject: `🏢 Confirmación de Solicitud de Información Corporativa — ${empresa}`,
            html: htmlSolicitante
          }),
          transporter.sendMail({
            from: `"Tranqi Leads Corporativos" <${smtpUser}>`,
            to: correoOps,
            subject: `🔔 Nueva Solicitud Corporativa (B2B): ${empresa} — ${nombreContacto}`,
            html: htmlOperaciones
          })
        ]);

        emailsEnviados = true;
      } catch (errEmail) {
        console.warn("[contacto-empresa] Aviso al despachar correos por SMTP:", errEmail);
      }
    } else {
      console.warn("[contacto-empresa] Credenciales SMTP no configuradas por completo.");
    }

    return NextResponse.json({
      success: true,
      message: "Tu solicitud ha sido recibida con éxito. Un asesor corporativo de Tranqi se comunicará contigo.",
      dbGuardado: insertOk,
      emailsDespachados: emailsEnviados
    });
  } catch (error: unknown) {
    const msg = error instanceof Error ? error.message : "Error interno al procesar el formulario";
    console.error("[contacto-empresa] Error en POST:", error);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
