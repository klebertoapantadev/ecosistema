"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerPerfiles, obtenerPerfilActual } from "@eco/identidad";
import nodemailer from "nodemailer";
import { agregarCampanaServidor } from "../../app/api/notificaciones/almacen";
import { esquemaSolicitudSocio, esquemaDecisionSolicitud, type DatosSolicitudSocio } from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

async function notificarSolicitudEnviada(
  usuarioId: string,
  solicitudId: string,
  esActualizacion: boolean
) {
  try {
    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();

    // 1. Obtener datos del usuario postulante
    const { data: u } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    if (!u || !u.usu_correo) return;

    const nombreUsuario = [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ") || u.usu_correo;
    const asunto = esActualizacion
      ? `[tranqi] Actualización de Solicitud de Socio Abogado Recibida`
      : `[tranqi] Confirmación de Recepción: Solicitud de Socio Abogado`;

    const contenidoHTML = `
      <div style="font-family: sans-serif; padding: 20px; color: #111;">
        <h2 style="color: #5000BA;">Estimado(a) ${nombreUsuario},</h2>
        <p>Tu <strong>solicitud de socio abogado</strong> en la plataforma tranqi ha sido ${esActualizacion ? "actualizada" : "recibida"} exitosamente.</p>
        <p>Nuestro equipo de acreditación profesional revisará tu matrícula del Foro de Abogados y registro SENESCYT. Te notificaremos cualquier novedad a este correo.</p>
        <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;" />
        <p style="font-size: 0.8rem; color: #666;">ID de Solicitud: <code>${solicitudId}</code></p>
      </div>
    `;

    // 2. Insertar notificación in-app para el usuario postulante
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
      {
        not_usuario_id: u.usu_id,
        not_negocio: "TRANQ",
        not_canal: "IN_APP",
        not_titulo: asunto,
        not_contenido_html: contenidoHTML,
        not_creado_en: new Date().toISOString()
      }
    ]);

    // 2.b. Notificar multicanal (In-App, Push y Email) a Operadores, Administradores y SuperAdmins
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: todosUsuarios } = await (adminSupabase as any)
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select(`
        usu_id,
        usu_correo,
        usu_superadmin_plataforma,
        seg_membresia (
          mem_id,
          mem_negocio,
          seg_membresia_perfil (
            mpe_perfil_clave
          )
        )
      `);

    let correosAdmins: string[] = [];
    const urlRevision = "/panel/socios";

    if (todosUsuarios && todosUsuarios.length > 0) {
      const tituloAdmin = esActualizacion
        ? `✏️ Solicitud de Socio Actualizada: ${nombreUsuario}`
        : `📢 Nueva Solicitud de Socio Abogado: ${nombreUsuario}`;

      const contenidoAdmin = `
        <div style="font-family: sans-serif; padding: 16px; color: #111;">
          <h3 style="color: #5000BA; margin-top: 0;">${tituloAdmin}</h3>
          <p>El postulante <strong>${nombreUsuario}</strong> (<code>${u.usu_correo}</code>) ha ${esActualizacion ? "actualizado" : "registrado"} su solicitud de socio abogado en la plataforma tranqi.</p>
          <p><a href="${urlRevision}" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Revisar Solicitud de Socio</a></p>
        </div>
      `;

      const destinatariosAdmin: { id: string; correo: string }[] = [];
      const correosVistos = new Set<string>();

      for (const adm of todosUsuarios) {
        if (adm.usu_id === u.usu_id) continue;
        const esSuper = Boolean(adm.usu_superadmin_plataforma);
        let esStaff = esSuper;

        if (!esStaff && Array.isArray(adm.seg_membresia)) {
          for (const m of adm.seg_membresia) {
            const mNeg = (m.mem_negocio || "").toUpperCase();
            if (mNeg === "TRANQ" || mNeg === "TRANQI") {
              if (Array.isArray(m.seg_membresia_perfil)) {
                for (const mp of m.seg_membresia_perfil) {
                  const clave = (mp.mpe_perfil_clave || "").toUpperCase();
                  if (clave === "OPERADOR" || clave === "ADMINISTRADOR" || clave === "SUPERADMIN") {
                    esStaff = true;
                    break;
                  }
                }
              }
            }
            if (esStaff) break;
          }
        }

        if (esStaff && adm.usu_correo && !correosVistos.has(adm.usu_correo)) {
          correosVistos.add(adm.usu_correo);
          destinatariosAdmin.push({ id: adm.usu_id, correo: adm.usu_correo });
        }
      }

      correosAdmins = destinatariosAdmin.map(adm => adm.correo);

      const notifsAdmins: any[] = [];
      for (const adm of destinatariosAdmin) {
        notifsAdmins.push({
          not_usuario_id: adm.id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: tituloAdmin,
          not_contenido_html: contenidoAdmin,
          not_url_accion: urlRevision,
          not_creado_en: new Date().toISOString()
        });
        notifsAdmins.push({
          not_usuario_id: adm.id,
          not_negocio: "TRANQ",
          not_canal: "PUSH",
          not_titulo: tituloAdmin,
          not_contenido_html: contenidoAdmin,
          not_url_accion: urlRevision,
          not_creado_en: new Date().toISOString()
        });
      }

      if (notifsAdmins.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert(notifsAdmins);
      }

      // 3. Enviar correo SMTP real tanto al postulante como a los operadores/admins
      const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
      const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
      const smtpPort = Number(process.env.SMTP_PORT || 587);

      let emailSent = false;
      if (smtpHost && smtpUser && smtpPass) {
        try {
          const transporter = nodemailer.createTransport({
            host: smtpHost,
            port: smtpPort,
            secure: smtpPort === 465,
            auth: { user: smtpUser, pass: smtpPass },
            tls: { rejectUnauthorized: false }
          });

          // Correo al solicitante
          await transporter.sendMail({
            from: `"tranqi Notificaciones" <${smtpUser}>`,
            to: u.usu_correo,
            subject: asunto,
            html: contenidoHTML
          });

          // Correo a cada operador / administrador
          for (const correoStaff of correosAdmins) {
            try {
              await transporter.sendMail({
                from: `"tranqi Notificaciones" <${smtpUser}>`,
                to: correoStaff,
                subject: tituloAdmin,
                html: contenidoAdmin
              });
            } catch (errStaffMail) {
              console.warn("Aviso al enviar correo a staff sobre solicitud:", errStaffMail);
            }
          }

          emailSent = true;
        } catch (errEmail) {
          console.error("Error SMTP al enviar correo de solicitud:", errEmail);
        }
      }

      // 4. Registrar la campaña automática en la Bitácora de Notificaciones (Motor de Notificaciones)
      agregarCampanaServidor({
        id: `camp-sol-${solicitudId}-${Date.now()}`,
        asunto: asunto,
        contenidoHTML: contenidoHTML,
        tipoEmision: "AUTOMATICA",
        emisorNombre: "Sistema Autónomo de Acreditación",
        emisorCorreo: "socios@tranqi24.com",
        procesoOrigen: esActualizacion ? "PLT-019 Actualización de Solicitud de Socio Abogado" : "PLT-019 Registro de Solicitud de Socio Abogado",
        audiencia: `USUARIO (${u.usu_correo}) & STAFF TRANQI`,
        canales: ["IN_APP", "EMAIL", "PUSH"],
        destinatariosDetalle: [u.usu_correo, ...correosAdmins],
        enviados: 1 + correosAdmins.length,
        leidos: 0,
        ignorados: 0,
        fecha: new Date().toISOString(),
        correoEnviadoReal: emailSent
      });
    }

  } catch (errNot) {
    console.error("Error al despachar notificación de solicitud de socio:", errNot);
  }
}

export async function enviarSolicitudSocio(
  datos: DatosSolicitudSocio,
  usuarioId: string,
): Promise<Resultado<{ solicitudId: string }>> {
  const parseo = esquemaSolicitudSocio.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const d = parseo.data;

  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // Verificar si ya existe una solicitud para este usuario con adminSupabase
  const { data: existente } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_estado")
    .eq("ssc_usuario_id", usuarioId)
    .order("ssc_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  let solicitudId: string;
  let esActualizacion = false;

  if (existente) {
    solicitudId = existente.ssc_id;
    esActualizacion = true;
    const esAceptada = existente.ssc_estado === "aceptada";

    // Actualizar solicitud existente con adminSupabase
    const { error: errorUpdate } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .update({
        ssc_cedula: d.cedula,
        ssc_matricula_profesional: d.matriculaProfesional,
        ssc_universidad: d.universidad,
        ssc_anio_graduacion: d.anioGraduacion,
        ssc_anos_experiencia: d.anosExperiencia,
        ssc_resumen_profesional: d.resumenProfesional,
        ssc_telefono_contacto: d.telefonoContacto || null,
        ssc_enlace_senescyt_verificado: d.enlaceSenescytVerificado,
        ssc_enlace_foro_verificado: d.enlaceForoVerificado,
        ssc_estado: esAceptada ? "aceptada" : "enviada",
        ssc_enviada_en: new Date().toISOString(),
      })
      .eq("ssc_id", solicitudId);

    if (errorUpdate) return { ok: false, error: errorUpdate.message };

    if (esAceptada && d.telefonoContacto) {
      await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({ usu_whatsapp: d.telefonoContacto })
        .eq("usu_id", usuarioId);
    }

    try {
      await adminSupabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().eq("exp_solicitud_id", solicitudId);
      await adminSupabase.schema("tranqui_legal").from("trq_solicitud_materia").delete().eq("sma_solicitud_id", solicitudId);
      await adminSupabase.schema("tranqui_legal").from("trq_solicitud_provincia").delete().eq("spr_solicitud_id", solicitudId);
    } catch (errDel) {
      console.warn("Aviso al limpiar relaciones previas de solicitud:", errDel);
    }
  } else {
    // Insertar nueva solicitud con adminSupabase
    const { data: solicitud, error } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .insert({
        ssc_usuario_id: usuarioId,
        ssc_cedula: d.cedula,
        ssc_matricula_profesional: d.matriculaProfesional,
        ssc_universidad: d.universidad,
        ssc_anio_graduacion: d.anioGraduacion,
        ssc_anos_experiencia: d.anosExperiencia,
        ssc_resumen_profesional: d.resumenProfesional,
        ssc_telefono_contacto: d.telefonoContacto || null,
        ssc_enlace_senescyt_verificado: d.enlaceSenescytVerificado,
        ssc_enlace_foro_verificado: d.enlaceForoVerificado,
      })
      .select("ssc_id")
      .single();

    if (error) return { ok: false, error: error.message };
    solicitudId = solicitud.ssc_id;
  }

  // Insertar/upsert experiencias, materias y provincias con IDs DEDUPLICADOS
  if (d.experiencia.length > 0) {
    const { error: errorExp } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_experiencia_laboral")
      .insert(
        d.experiencia.map((e) => ({
          exp_solicitud_id: solicitudId,
          exp_empresa: e.empresa,
          exp_cargo: e.cargo,
          exp_fecha_inicio: e.fechaInicio,
          exp_fecha_fin: e.fechaFin || null,
          exp_descripcion: e.descripcion || null,
        })),
      );
    if (errorExp) return { ok: false, error: errorExp.message };
  }

  const materiaUuids = Array.from(new Set(d.materiaIds.filter((id) => UUID_REGEX.test(id))));
  if (materiaUuids.length > 0) {
    const { error: errorMat } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_materia")
      .upsert(
        materiaUuids.map((mat_id) => ({ sma_solicitud_id: solicitudId, sma_materia_id: mat_id })),
        { onConflict: "sma_solicitud_id,sma_materia_id", ignoreDuplicates: true }
      );
    if (errorMat) return { ok: false, error: errorMat.message };
  }

  const provinciaUuids = Array.from(new Set(d.provinciaIds.filter((id) => UUID_REGEX.test(id))));
  if (provinciaUuids.length > 0) {
    const { error: errorProv } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_provincia")
      .upsert(
        provinciaUuids.map((cat_id) => ({ spr_solicitud_id: solicitudId, spr_provincia_id: cat_id })),
        { onConflict: "spr_solicitud_id,spr_provincia_id", ignoreDuplicates: true }
      );
    if (errorProv) return { ok: false, error: errorProv.message };
  }

  // Despachar notificación automática (Email + Push) e inscribir en bitácora
  await notificarSolicitudEnviada(usuarioId, solicitudId, esActualizacion);

  revalidatePath("/panel/solicitud-socio");
  revalidatePath("/panel/socios");
  revalidatePath("/panel/administrar");
  revalidatePath("/panel/emision-notificaciones");

  return { ok: true, data: { solicitudId } };
}

export async function registrarDocumentoSocio(
  solicitudId: string,
  tipo: "foto_perfil" | "titulo" | "matricula" | "cedula" | "identificacion" | "otro" | "respaldo_revision" | "cv" | "contrato_socio",
  path: string,
  nombreArchivo: string,
  comentario?: string,
  concepto?: string,
): Promise<Resultado> {
  const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida o usuario no autenticado." };

  const TIPOS_PERMITIDOS = ["foto_perfil", "titulo", "matricula", "cedula", "identificacion", "cv", "contrato_socio", "otro", "respaldo_revision"];
  const tipoFinal = TIPOS_PERMITIDOS.includes(tipo) ? (tipo === "identificacion" ? "cedula" : tipo) : "otro";

  // Si es un documento único (foto de perfil, título, cédula/identificación o contrato firmado), eliminar el registro previo para evitar duplicidad
  if (tipoFinal === "foto_perfil" || tipoFinal === "titulo" || tipoFinal === "cedula" || tipoFinal === "contrato_socio") {
    try {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_documento_socio")
        .delete()
        .eq("dcs_solicitud_id", solicitudId)
        .eq("dcs_tipo", tipoFinal);
    } catch (errDel) {
      console.warn("Aviso al eliminar documento previo único:", errDel);
    }
  }

  const comentarioFinal = concepto ? `[${concepto}] ${comentario || ""}`.trim() : (comentario || null);

  const { error } = await adminSupabase.schema("tranqui_legal").from("trq_documento_socio").insert({
    dcs_solicitud_id: solicitudId,
    dcs_tipo: tipoFinal,
    dcs_url: path,
    dcs_nombre_archivo: nombreArchivo,
    dcs_comentario: comentarioFinal,
    dcs_subido_por: user.id,
  });

  if (error) {
    console.error("Error al registrar documento socio en BDD:", error);
    return { ok: false, error: error.message };
  }
  return { ok: true, data: undefined };
}

export async function decidirSolicitudSocio(datos: {
  solicitudId: string;
  decision: "aceptada" | "rechazada";
  comentario?: string;
}): Promise<Resultado> {
  const parseo = esquemaDecisionSolicitud.safeParse(datos);
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }
  const { solicitudId, decision, comentario } = parseo.data;

  const supabase = await crearClienteServidor();

  const { data: usuarioId, error: rpcError } = await supabase
    .schema("tranqui_legal")
    .rpc("trq_fn_decidir_solicitud", {
      p_solicitud_id: solicitudId,
      p_decision: decision,
      p_comentario: comentario || undefined,
    });

  if (rpcError) return { ok: false, error: rpcError.message };

  // Notificar al solicitante cliente/abogado sobre la actualización de su solicitud
  const targetUsuId = typeof usuarioId === "string" ? usuarioId : (usuarioId as any)?.ssc_usuario_id;
  if (targetUsuId) {
    try {
      const adminSupabase = crearClienteAdmin() || supabase;
      const { data: uApplicant } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
        .eq("usu_id", targetUsuId)
        .maybeSingle();

      if (uApplicant) {
        const nombrePostulante = [uApplicant.usu_nombres, uApplicant.usu_apellidos].filter(Boolean).join(" ") || uApplicant.usu_correo;
        const tituloNotif = decision === "aceptada"
          ? "🎉 ¡Tu Acreditación como Socio Abogado fue APROBADA!"
          : "⚠️ Actualización sobre tu Solicitud de Socio Abogado";

        const cuerpoHTML = decision === "aceptada" ? `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #059669;">¡Felicitaciones, ${nombrePostulante}!</h2>
            <p>Tu solicitud de acreditación profesional en <strong>tranqi</strong> ha sido evaluada y marcada como <strong>APROBADA</strong>.</p>
            <p>Para formalizar e integrar tu incorporación, por favor sigue estos sencillos pasos:</p>
            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
                <li style="margin-bottom: 8px;">
                  Descarga tu contrato pre-llenado en formato Word (.docx): 
                  <br/>
                  <a href="/api/solicitud-socio/contrato/descargar?solicitudId=${solicitudId}" style="color: #5000BA; font-weight: 700; text-decoration: underline;">Descargar Contrato (.docx)</a>
                </li>
                <li style="margin-bottom: 8px;">Fírmalo de forma manuscrita o digitalmente.</li>
                <li style="margin-bottom: 0;">
                  Ingresa al portal y sube el documento firmado (se admite PDF o Word):
                  <br/>
                  <a href="/panel/solicitud-socio" style="color: #5000BA; font-weight: 700; text-decoration: underline;">Subir Contrato Firmado en el Widget</a>
                </li>
              </ol>
            </div>
            ${comentario ? `<div style="background: #F3F4F6; border-left: 4px solid #5000BA; padding: 12px; border-radius: 6px; margin: 16px 0;"><strong>Observación del Evaluador:</strong> ${comentario}</div>` : ""}
            <p>Una vez recibido el contrato firmado, verificaremos el documento y activaremos tus credenciales de Abogado.</p>
          </div>
        ` : `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #DC2626;">Estimado(a) ${nombrePostulante},</h2>
            <p>Tu solicitud de acreditación profesional en <strong>tranqi</strong> ha sido evaluada y marcada como <strong>RECHAZADA</strong>.</p>
            ${comentario ? `<div style="background: #F3F4F6; border-left: 4px solid #DC2626; padding: 12px; border-radius: 6px; margin: 16px 0;"><strong>Observación del Evaluador:</strong> ${comentario}</div>` : ""}
            <p>Puedes corregir las observaciones ingresando nuevamente a tu panel y volviendo a enviar la solicitud:</p>
            <p><a href="/panel/solicitud-socio" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Corregir y Enviar de Nuevo</a></p>
          </div>
        `;

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "IN_APP",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_creado_en: new Date().toISOString()
          },
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "PUSH",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_creado_en: new Date().toISOString()
          }
        ]);

        agregarCampanaServidor({
          id: `camp-dec-${solicitudId}-${Date.now()}`,
          asunto: tituloNotif,
          contenidoHTML: cuerpoHTML,
          tipoEmision: "AUTOMATICA",
          emisorNombre: "Equipo Evaluador de Acreditación",
          emisorCorreo: "evaluacion@tranqi24.com",
          procesoOrigen: "PLT-019 Evaluación de Solicitud de Socio Abogado",
          audiencia: `SOLICITANTE (${uApplicant.usu_correo})`,
          canales: ["IN_APP", "EMAIL", "PUSH"],
          destinatariosDetalle: [uApplicant.usu_correo],
          enviados: 1,
          leidos: 0,
          ignorados: 0,
          fecha: new Date().toISOString(),
        });
      }
    } catch (errDecNot) {
      console.error("Error al notificar al solicitante la decisión:", errDecNot);
    }
  }

  revalidatePath("/panel/socios");
  revalidatePath(`/panel/socios/${solicitudId}`);
  return { ok: true, data: undefined };
}

export async function obtenerListaSolicitudesSociosAction(): Promise<Resultado<any[]>> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // Consultar todas las solicitudes registradas con fallback bidireccional
  let { data: sData, error: sErr } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("*")
    .order("ssc_creado_en", { ascending: false });

  if ((!sData || sData.length === 0) && adminSupabase !== supabase) {
    const resFall = await supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("*")
      .order("ssc_creado_en", { ascending: false });
    if (resFall.data && resFall.data.length > 0) {
      sData = resFall.data;
      sErr = null;
    }
  }

  if (sErr) return { ok: false, error: sErr.message };
  if (!sData || sData.length === 0) return { ok: true, data: [] };

  const userIds = [...new Set(sData.map((s) => s.ssc_usuario_id))];
  let { data: uData } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp")
    .in("usu_id", userIds);

  if (!uData || uData.length === 0) {
    const resU = await supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp")
      .in("usu_id", userIds);
    if (resU.data) uData = resU.data;
  }

  const uMap = new Map((uData || []).map((u) => [u.usu_id, u]));
  const combinadas = sData.map((s) => ({
    ...s,
    usuario: uMap.get(s.ssc_usuario_id) || null,
  }));

  return { ok: true, data: combinadas };
}

export async function obtenerPlantillaContrato(): Promise<Resultado<{ pct_titulo: string; pct_contenido: string }>> {
  const supabase = await crearClienteServidor();
  const { data, error } = await (supabase as any)
    .schema("tranqui_legal")
    .from("trq_plantilla_contrato")
    .select("pct_titulo, pct_contenido")
    .order("pct_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) {
    const DEFAULT_TEMPLATE = `# CONTRATO DE PRESTACIÓN DE SERVICIOS PROFESIONALES Y SOCIEDAD\n\nPor medio del presente documento, se celebra el Contrato de Prestación de Servicios y Acreditación de Socio Abogado entre **tranqi** y el profesional **{{nombre_completo}}**, portador de la cédula de identidad Nro. **{{cedula}}**.\n\n## ANTECEDENTES Y OBJETO\nEl Socio Abogado declara ser un profesional del derecho debidamente registrado y verificado en la SENESCYT y el Foro de Abogados del Ecuador. tranqi provee al Socio Abogado de una cuenta digital para acceder a solicitudes de asesoría jurídica.\n\n## CLÁUSULAS\n1. **Confidencialidad:** Las partes se obligan a mantener absoluta confidencialidad sobre toda la información y casos de clientes tratados a través del portal.\n2. **Veracidad:** El Socio Abogado garantiza que toda la información académica y matrículas cargadas son reales y vigentes.\n3. **Firma:** El Socio Abogado acepta descargar este contrato, firmarlo de forma manuscrita o digital en formato PDF y subirlo al portal de tranqi.\n\nEn Quito, a la fecha de aceptación de la solicitud.`;
    return { ok: true, data: { pct_titulo: "Contrato de Prestación de Servicios de Socio Abogado", pct_contenido: DEFAULT_TEMPLATE } };
  }
  return { ok: true, data: { pct_titulo: data.pct_titulo, pct_contenido: data.pct_contenido } };
}

export async function guardarPlantillaContrato(titulo: string, contenido: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  
  const perfil = await obtenerPerfilActual();
  if (!perfil) return { ok: false, error: "Usuario no autenticado" };

  const perfiles = await obtenerPerfiles("tranqi");
  const esAdmin = Array.isArray(perfiles) && (perfiles.includes("ADMINISTRADOR") || perfiles.includes("SUPERADMIN") || perfiles.includes("OPERADOR"));
  if (!esAdmin) return { ok: false, error: "No autorizado para configurar plantillas de contrato" };

  const { data: existente } = await (supabase as any)
    .schema("tranqui_legal")
    .from("trq_plantilla_contrato")
    .select("pct_id")
    .limit(1)
    .maybeSingle();

  let error;
  if (existente?.pct_id) {
    const res = await (supabase as any)
      .schema("tranqui_legal")
      .from("trq_plantilla_contrato")
      .update({ pct_titulo: titulo, pct_contenido: contenido, pct_actualizado_en: new Date().toISOString() })
      .eq("pct_id", existente.pct_id);
    error = res.error;
  } else {
    const res = await (supabase as any)
      .schema("tranqui_legal")
      .from("trq_plantilla_contrato")
      .insert({ pct_titulo: titulo, pct_contenido: contenido });
    error = res.error;
  }

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

export async function confirmarContratoSocio(solicitudId: string, comentario?: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: solicitud, error } = await (supabase as any)
    .schema("tranqui_legal")
    .rpc("trq_fn_confirmar_contrato_socio", { p_solicitud_id: solicitudId, p_comentario: comentario || null });

  if (error) return { ok: false, error: error.message };

  // Enviar notificaciones de confirmación de activación de abogado
  if (solicitud) {
    try {
      const adminSupabase = crearClienteAdmin() || supabase;
      const { data: uApplicant } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
        .eq("usu_id", solicitud.ssc_usuario_id)
        .maybeSingle();

      if (uApplicant) {
        const nombrePostulante = [uApplicant.usu_nombres, uApplicant.usu_apellidos].filter(Boolean).join(" ") || uApplicant.usu_correo;
        const tituloNotif = "💼 ¡Tu Contrato de Socio Abogado ha sido Confirmado!";
        const cuerpoHTML = `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #059669;">¡Firma Confirmada, ${nombrePostulante}!</h2>
            <p>Hemos recibido y verificado tu contrato de sociedad firmado. Tu cuenta ha sido activada con el rol de <strong>Abogado</strong> en la plataforma.</p>
            <p>Ya puedes acceder a las herramientas de abogado, gestionar tu agenda y recibir casos.</p>
            <p><a href="/panel" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Ir a mi Panel de Abogado</a></p>
          </div>
        `;

        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "IN_APP",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_creado_en: new Date().toISOString()
          },
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "PUSH",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_creado_en: new Date().toISOString()
          }
        ]);

        agregarCampanaServidor({
          id: `camp-contrato-conf-${solicitudId}-${Date.now()}`,
          asunto: tituloNotif,
          contenidoHTML: cuerpoHTML,
          tipoEmision: "AUTOMATICA",
          emisorNombre: "Equipo de Soporte Legal",
          emisorCorreo: "soporte@tranqi24.com",
          procesoOrigen: "PLT-020 Activación de Socio Abogado",
          audiencia: `ABOGADO (${uApplicant.usu_correo})`,
          canales: ["IN_APP", "EMAIL", "PUSH"],
          destinatariosDetalle: [uApplicant.usu_correo],
          enviados: 1,
          leidos: 0,
          ignorados: 0,
          fecha: new Date().toISOString(),
        });
      }
    } catch (errNot) {
      console.error("Error al enviar notificación de confirmación de contrato:", errNot);
    }
  }

  revalidatePath("/panel/socios");
  revalidatePath(`/panel/socios/${solicitudId}`);
  revalidatePath("/panel/usuarios");
  return { ok: true, data: undefined };
}

export async function eliminarSolicitudSocioPropiaAction(solicitudId?: string): Promise<Resultado> {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return { ok: false, error: "Usuario no autenticado" };

  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // 1. Intentar invocar el RPC en PostgreSQL si existe
  const { error: errorRpc } = await (supabase as any)
    .schema("tranqui_legal")
    .rpc("trq_fn_eliminar_solicitud_propia", { p_solicitud_id: solicitudId || null });

  // 2. Si el RPC no estuviera instalado o diera error de permisos, fallback directo con adminSupabase
  if (errorRpc) {
    let query = adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("ssc_id, ssc_estado")
      .eq("ssc_usuario_id", perfil.usu_id);

    if (solicitudId) {
      query = query.eq("ssc_id", solicitudId);
    }

    const { data: sol, error: solErr } = await query.order("ssc_creado_en", { ascending: false }).limit(1).maybeSingle();
    if (solErr) return { ok: false, error: solErr.message };
    if (!sol) return { ok: true, data: undefined };

    if (sol.ssc_estado === "aceptada") {
      return { ok: false, error: "No es posible eliminar una solicitud que ya ha sido aprobada" };
    }

    const { error: delErr } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .delete()
      .eq("ssc_id", sol.ssc_id)
      .eq("ssc_usuario_id", perfil.usu_id);

    if (delErr) return { ok: false, error: delErr.message };
  }

  revalidatePath("/panel");
  revalidatePath("/panel/solicitud-socio");
  revalidatePath("/panel/socios");
  revalidatePath("/panel/administrar");
  return { ok: true, data: undefined };
}

export async function reiniciarSolicitudSocioPropiaAction(solicitudId?: string): Promise<Resultado> {
  return eliminarSolicitudSocioPropiaAction(solicitudId);
}

