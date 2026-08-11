"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerPerfiles } from "@eco/identidad";
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

    // 2. Insertar notificación in-app en comun_notificaciones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await (adminSupabase as any).schema("comun_notificaciones").from("not_registro").insert([
      {
        not_usuario_id: u.usu_id,
        not_negocio: "TRANQ",
        not_canal: "IN_APP",
        not_titulo: asunto,
        not_contenido_html: contenidoHTML,
        not_creado_en: new Date().toISOString()
      }
    ]);

    // 3. Enviar correo SMTP real si están configuradas las variables de entorno
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

        await transporter.sendMail({
          from: `"tranqi Notificaciones" <${smtpUser}>`,
          to: u.usu_correo,
          subject: asunto,
          html: contenidoHTML
        });
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
      procesoOrigen: "PLT-019 Solicitud de Socio Abogado Recibida",
      audiencia: `USUARIO (${u.usu_correo})`,
      canales: ["IN_APP", "EMAIL", "PUSH"],
      destinatariosDetalle: [u.usu_correo, "kleber.toapanta.ch@gmail.com"],
      enviados: 1,
      leidos: 0,
      ignorados: 0,
      fecha: new Date().toISOString(),
      correoEnviadoReal: emailSent
    });

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

    // Limpiar relaciones anteriores de forma limpia con adminSupabase
    await adminSupabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().eq("exp_solicitud_id", solicitudId);
    await adminSupabase.schema("tranqui_legal").from("trq_solicitud_materia").delete().eq("sma_solicitud_id", solicitudId);
    await adminSupabase.schema("tranqui_legal").from("trq_solicitud_provincia").delete().eq("spr_solicitud_id", solicitudId);
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

  // Insertar experiencias, materias y provincias con IDs DEDUPLICADOS
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
      .insert(materiaUuids.map((mat_id) => ({ sma_solicitud_id: solicitudId, sma_materia_id: mat_id })));
    if (errorMat) return { ok: false, error: errorMat.message };
  }

  const provinciaUuids = Array.from(new Set(d.provinciaIds.filter((id) => UUID_REGEX.test(id))));
  if (provinciaUuids.length > 0) {
    const { error: errorProv } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_provincia")
      .insert(provinciaUuids.map((cat_id) => ({ spr_solicitud_id: solicitudId, spr_provincia_id: cat_id })));
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
  tipo: "foto_perfil" | "titulo" | "matricula" | "otro" | "respaldo_revision" | "cv",
  path: string,
  nombreArchivo: string,
  comentario?: string,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const TIPOS_PERMITIDOS = ["titulo", "matricula", "cedula", "otro"];
  const tipoFinal = TIPOS_PERMITIDOS.includes(tipo) ? tipo : "otro";

  const { error } = await supabase.schema("tranqui_legal").from("trq_documento_socio").insert({
    dcs_solicitud_id: solicitudId,
    dcs_tipo: tipoFinal,
    dcs_url: path,
    dcs_nombre_archivo: nombreArchivo,
    dcs_comentario: comentario || null,
  });
  if (error) return { ok: false, error: error.message };
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

  revalidatePath("/panel/socios");
  revalidatePath(`/panel/socios/${solicitudId}`);
  return { ok: true, data: undefined };
}

export async function obtenerListaSolicitudesSociosAction(): Promise<Resultado<any[]>> {
  const supabase = await crearClienteServidor();
  let perfiles: string[] = [];
  try {
    perfiles = await obtenerPerfiles("tranqi");
  } catch { /* Ignorar */ }

  const esAdminOSuper = perfiles.includes("SUPERADMIN") || perfiles.includes("ADMINISTRADOR") || perfiles.length === 0;

  // 1. Intentar RPC Security Definer
  let sData: any[] | null = null;
  let sErr: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (supabase as any)
    .schema("tranqui_legal")
    .rpc("trq_fn_listar_solicitudes_admin");

  if (!rpcErr && rpcData && rpcData.length > 0) {
    sData = rpcData;
  } else {
    // 2. Fallback a consulta de tabla si el RPC no existe
    const resNorm = await supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("*")
      .order("ssc_creado_en", { ascending: false });

    sData = resNorm.data;
    sErr = resNorm.error;

    if (esAdminOSuper && (!sData || sData.length === 0)) {
      const adminSupabase = crearClienteAdmin();
      if (adminSupabase) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const resAdmin = await (adminSupabase as any)
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .select("*")
          .order("ssc_creado_en", { ascending: false });

        if (resAdmin.data) {
          sData = resAdmin.data;
          sErr = null;
        }
      }
    }
  }

  if (sErr) return { ok: false, error: sErr.message };
  if (!sData || sData.length === 0) return { ok: true, data: [] };

  const userIds = [...new Set(sData.map((s) => s.ssc_usuario_id))];
  const { data: uData } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp")
    .in("usu_id", userIds);

  const uMap = new Map((uData || []).map((u) => [u.usu_id, u]));
  const combinadas = sData.map((s) => ({
    ...s,
    usuario: uMap.get(s.ssc_usuario_id) || null,
  }));

  return { ok: true, data: combinadas };
}
