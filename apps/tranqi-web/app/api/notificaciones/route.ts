import { NextResponse } from "next/server";
import nodemailer from "nodemailer";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { agregarCampanaServidor, obtenerCampanasServidor, CampanaBitacora } from "./almacen";

interface UsuarioDBRow {
  usu_id: string;
  usu_correo: string;
  usu_nombres?: string | null;
  usu_apellidos?: string | null;
}

interface SupabaseTypedClient {
  schema(schema: string): {
    from(table: string): {
      select(cols: string): Promise<{ data: unknown; error: unknown }>;
      insert(values: unknown[]): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

// Helper para formatear fecha en hora local de Ecuador (UTC-5) YYYY-MM-DD HH:mm
function formatearFechaLocalEcuador(date: Date = new Date()): string {
  try {
    const formatter = new Intl.DateTimeFormat("en-CA", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "America/Guayaquil"
    });
    const partes = formatter.formatToParts(date);
    const m: Record<string, string> = {};
    partes.forEach(p => { if (p.type !== "literal") m[p.type] = p.value; });
    return `${m.year}-${m.month}-${m.day} ${m.hour}:${m.minute}`;
  } catch {
    return date.toISOString().replace("T", " ").slice(0, 16);
  }
}

// Reemplazo dinámico de etiquetas interpolables por usuario destinatario
function interpolarVariables(
  plantilla: string,
  user: { correo: string; nombres?: string | null; apellidos?: string | null },
  negocio: string
): string {
  if (!plantilla) return "";
  const nombreCompleto = ([user.nombres, user.apellidos].filter(Boolean).join(" ") || user.correo.split("@")[0]) || "Usuario";
  const primerNombre = (nombreCompleto.split(" ")[0]) || "Usuario";
  const fechaEC = formatearFechaLocalEcuador(new Date());

  return plantilla
    .replace(/\{\{\s*nombre_usuario\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombrecompleto\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombre_completo\s*\}\}/gi, nombreCompleto)
    .replace(/\{\{\s*nombre\s*\}\}/gi, primerNombre)
    .replace(/\{\{\s*mail\s*\}\}/gi, user.correo)
    .replace(/\{\{\s*correo\s*\}\}/gi, user.correo)
    .replace(/\{\{\s*negocio\s*\}\}/gi, negocio)
    .replace(/\{\{\s*fecha\s*\}\}/gi, fechaEC)
    .replace(/\{Mail\}/gi, user.correo)
    .replace(/\{nombre\}/gi, primerNombre)
    .replace(/\{nombrecompleto\}/gi, nombreCompleto);
}

export async function GET() {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles("tranqi");
  const esAdmin = Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR");

  if (!esAdmin) {
    return NextResponse.json({ error: "Acceso Denegado" }, { status: 403 });
  }

  return NextResponse.json({ success: true, campanas: obtenerCampanasServidor() });
}

export async function POST(req: Request) {
  try {
    const perfil = await obtenerPerfilActual();
    const perfiles = await obtenerPerfiles("tranqi");
    const esAdmin = Boolean(perfil?.usu_superadmin_plataforma) || perfiles.includes("ADMINISTRADOR");

    if (!esAdmin) {
      return NextResponse.json({ error: "Acceso Denegado: Solo Administradores pueden emitir notificaciones" }, { status: 403 });
    }

    const body = await req.json();
    const { negocio = "TRANQ", asunto, tipoAudiencia, roles, usuarios, canales, contenidoHTML, contenidoMarkdown } = body;

    if (!asunto || typeof asunto !== "string" || !asunto.trim()) {
      return NextResponse.json({ error: "El asunto es obligatorio" }, { status: 400 });
    }

    const nombreCompleto = [perfil?.usu_nombres, perfil?.usu_apellidos].filter(Boolean).join(" ") || perfil?.usu_correo || "Administrador";

    const canalesLista: string[] = [];
    if (canales?.inApp) canalesLista.push("IN_APP");
    if (canales?.email) canalesLista.push("EMAIL");
    if (canales?.push) canalesLista.push("PUSH");
    if (canales?.whatsapp) canalesLista.push("WHATSAPP");

    const audienciaTexto =
      tipoAudiencia === "POR_ROL"
        ? `POR_ROL (${(roles || []).join(", ")})`
        : tipoAudiencia === "POR_USUARIOS"
        ? `POR_USUARIOS (${usuarios || "Seleccionados"})`
        : "TODOS";

    // 1. Consultar destinatarios reales desde Supabase usando el esquema comun_seguridad
    const rawSupabase = await crearClienteServidor();
    const supabase = rawSupabase as unknown as SupabaseTypedClient;
    let usuariosTarget: Array<{ id: string; correo: string; nombres?: string | null; apellidos?: string | null }> = [];

    try {
      const { data: dbUsuarios } = await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo, usu_nombres, usu_apellidos");

      if (dbUsuarios && Array.isArray(dbUsuarios)) {
        usuariosTarget = (dbUsuarios as unknown as UsuarioDBRow[])
          .filter((u) => Boolean(u.usu_correo))
          .map((u) => ({ id: u.usu_id, correo: u.usu_correo, nombres: u.usu_nombres, apellidos: u.usu_apellidos }));
      }
    } catch {
      /* Fallback */
    }

    // Extraer correos válidos tipeados manualmente en el filtro
    if (usuarios && typeof usuarios === "string") {
      const correosExtraidos = usuarios.split(/[\s,;]+/).filter(c => c.includes("@"));
      correosExtraidos.forEach(c => {
        if (!usuariosTarget.some(u => u.correo.toLowerCase() === c.toLowerCase())) {
          usuariosTarget.push({ id: `usr-${Date.now()}`, correo: c });
        }
      });
    }

    // Asegurar que el correo del usuario emisor esté presente
    if (perfil?.usu_correo && !usuariosTarget.some(u => u.correo.toLowerCase() === perfil.usu_correo.toLowerCase())) {
      usuariosTarget.push({ id: perfil.usu_id, correo: perfil.usu_correo, nombres: perfil.usu_nombres, apellidos: perfil.usu_apellidos });
    }

    const listaCorreos = Array.from(new Set(usuariosTarget.map(u => u.correo).filter(Boolean)));

    // 2. Persistir notificaciones In-App / Push en la tabla comun_notificaciones.not_registro
    try {
      const filasInsertar = usuariosTarget.map(u => ({
        not_usuario_id: u.id,
        not_negocio: negocio,
        not_canal: (canales?.push && !canales?.inApp) ? "PUSH" : "IN_APP",
        not_titulo: interpolarVariables(asunto.trim(), u, negocio),
        not_contenido_html: interpolarVariables(contenidoHTML || `<p>${asunto}</p>`, u, negocio),
        not_creado_en: new Date().toISOString()
      }));

      await supabase
        .schema("comun_notificaciones")
        .from("not_registro")
        .insert(filasInsertar);
    } catch {
      /* Ignorar */
    }

    // 3. Despacho real de correos vía SMTP y Edge Function con variables interpoladas por usuario
    let correoDespachadoConExito = false;
    let detalleEnvioEmail = "";

    if (canales?.email && usuariosTarget.length > 0) {
      const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
      const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
      const smtpPort = Number(process.env.SMTP_PORT || 587);

      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });

          for (const u of usuariosTarget) {
            const htmlPersonalizado = interpolarVariables(contenidoHTML || `<p>${asunto}</p>`, u, negocio);
            const asuntoPersonalizado = interpolarVariables(asunto.trim(), u, negocio);

            await transporter.sendMail({
              from: `"tranqi Notificaciones" <${smtpUser}>`,
              to: u.correo,
              subject: asuntoPersonalizado,
              html: htmlPersonalizado
            });
          }

          correoDespachadoConExito = true;
          detalleEnvioEmail = ` (Entregado vía SMTP a ${listaCorreos.length} destinatario(s): ${listaCorreos.join(", ")})`;
        } catch (mailErr: unknown) {
          const errText = mailErr instanceof Error ? mailErr.message : "Error SMTP";
          console.error("Fallo envío SMTP:", errText);
          detalleEnvioEmail = ` (Fallo SMTP: ${errText})`;
        }
      } else {
        try {
          const { enviarCorreo } = await import("@eco/notificaciones/enviar-correo");
          let enviosEdgeExitosos = 0;
          for (const u of usuariosTarget) {
            const htmlPersonalizado = interpolarVariables(contenidoHTML || `<p>${asunto}</p>`, u, negocio);
            const asuntoPersonalizado = interpolarVariables(asunto.trim(), u, negocio);

            const resEdge = await enviarCorreo({
              negocio,
              para: u.correo,
              asunto: asuntoPersonalizado,
              html: htmlPersonalizado
            });
            if (resEdge.ok) enviosEdgeExitosos++;
          }

          if (enviosEdgeExitosos > 0) {
            correoDespachadoConExito = true;
            detalleEnvioEmail = ` (Entregado vía Edge Function Vault a ${enviosEdgeExitosos} destinatario(s))`;
          } else {
            detalleEnvioEmail = ` (Destinatarios preparados: ${listaCorreos.join(", ")})`;
          }
        } catch {
          detalleEnvioEmail = ` (Destinatarios preparados: ${listaCorreos.join(", ")})`;
        }
      }
    }

    const fechaLocalFormat = formatearFechaLocalEcuador(new Date());

    const nuevaCampana: CampanaBitacora = {
      id: "cmp-" + Date.now().toString().slice(-6),
      asunto: asunto.trim(),
      contenidoHTML: contenidoHTML || `<p>${asunto}</p>`,
      contenidoMarkdown: contenidoMarkdown || "",
      tipoEmision: "MANUAL",
      emisorNombre: nombreCompleto,
      emisorCorreo: perfil?.usu_correo || "admin@tranqi24.com",
      emisorId: perfil?.usu_id,
      procesoOrigen: "Consola de Emisión de Notificaciones",
      audiencia: audienciaTexto,
      canales: canalesLista.length > 0 ? canalesLista : ["IN_APP"],
      destinatariosDetalle: listaCorreos,
      enviados: listaCorreos.length,
      leidos: 0,
      ignorados: listaCorreos.length,
      fecha: fechaLocalFormat,
      correoEnviadoReal: correoDespachadoConExito
    };

    agregarCampanaServidor(nuevaCampana);

    return NextResponse.json({
      success: true,
      mensaje: `Notificación multicanal emitida (${listaCorreos.length} destinatarios).${detalleEnvioEmail}`,
      campana: nuevaCampana,
      totalHistorico: obtenerCampanasServidor().length
    });
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : "Error al procesar emisión";
    return NextResponse.json({ error: errorMsg }, { status: 500 });
  }
}
