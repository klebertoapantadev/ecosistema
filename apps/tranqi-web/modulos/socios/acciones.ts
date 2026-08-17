"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerPerfiles, obtenerPerfilActual } from "@eco/identidad";
import nodemailer from "nodemailer";
import { agregarCampanaServidor } from "../../app/api/notificaciones/almacen";
import {
  esquemaSolicitudSocio,
  esquemaDecisionSolicitud,
  type DatosSolicitudSocio,
  generarRutaRepositorioComun,
  sanearNombreArchivo,
  CONCEPTOS_REPOSITORIO,
} from "./esquema";

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
    const urlRevision = `/panel/socios/${solicitudId}`;
    const destinatariosAdmin: { id: string; correo: string }[] = [];
    const correosVistos = new Set<string>();

    try {
      // a. Obtener superadministradores directos
      const { data: superAdmins } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo, usu_superadmin_plataforma")
        .eq("usu_superadmin_plataforma", true);

      if (Array.isArray(superAdmins)) {
        for (const sa of superAdmins) {
          if (sa.usu_id !== u.usu_id && sa.usu_correo && !correosVistos.has(sa.usu_correo)) {
            correosVistos.add(sa.usu_correo);
            destinatariosAdmin.push({ id: sa.usu_id, correo: sa.usu_correo });
          }
        }
      }

      // b. Obtener miembros con rol de operador o administrador en tranqi
      const { data: membresias } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select(`
          mem_id,
          mem_usuario_id,
          mem_negocio,
          seg_usuario (
            usu_id,
            usu_correo
          ),
          seg_membresia_perfil (
            mpe_perfil_clave
          )
        `)
        .or("mem_negocio.ilike.TRANQ,mem_negocio.ilike.TRANQI");

      if (Array.isArray(membresias)) {
        for (const m of membresias) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const usr = (m as any).seg_usuario;
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const perfiles = (m as any).seg_membresia_perfil || [];
          const esOperadorOAdmin = perfiles.some((p: { mpe_perfil_clave?: string }) => {
            const c = (p.mpe_perfil_clave || "").toLowerCase();
            return c === "operador" || c === "administrador" || c === "superadmin";
          });

          if (esOperadorOAdmin && usr?.usu_correo && usr.usu_id !== u.usu_id && !correosVistos.has(usr.usu_correo)) {
            correosVistos.add(usr.usu_correo);
            destinatariosAdmin.push({ id: usr.usu_id, correo: usr.usu_correo });
          }
        }
      }
    } catch (errStaffSearch) {
      console.warn("Aviso al buscar operadores/admins para notificación:", errStaffSearch);
    }

    let correosAdmins: string[] = destinatariosAdmin.map((adm) => adm.correo);

    if (destinatariosAdmin.length > 0) {
      const tituloAdmin = esActualizacion
        ? `🔄 Actualización de Solicitud de Socio: ${nombreUsuario}`
        : `📢 Nueva Postulación de Socio Abogado: ${nombreUsuario}`;

      const contenidoAdmin = `
        <div style="font-family: sans-serif; padding: 18px; color: #111; max-width: 600px; border: 1px solid #eee; border-radius: 8px;">
          <h3 style="color: #5000BA; margin-top: 0;">${tituloAdmin}</h3>
          <p>El profesional <strong>${nombreUsuario}</strong> (<code>${u.usu_correo}</code>) ha <strong>${esActualizacion ? "actualizado su postulación y documentos" : "registrado una nueva solicitud de afiliación"}</strong> en la plataforma tranqi.</p>
          <p style="margin: 18px 0;">
            <a href="${urlRevision}" style="display: inline-block; padding: 12px 22px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Evaluar Solicitud de Socio</a>
          </p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 16px 0;" />
          <p style="font-size: 0.8rem; color: #666;">ID de Solicitud: <code>${solicitudId}</code> • Tranqi Legal</p>
        </div>
      `;

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
        try {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert(notifsAdmins);
        } catch (errNotInsert) {
          console.warn("Aviso al insertar notificaciones para staff:", errNotInsert);
        }
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
            tls: { rejectUnauthorized: false },
            connectionTimeout: 4000,
            greetingTimeout: 4000,
            socketTimeout: 4000,
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

    // Registrar en el historial de revisiones el reingreso / actualización del postulante
    try {
      await adminSupabase.schema("tranqui_legal").from("trq_revision_solicitud").insert({
        rev_solicitud_id: solicitudId,
        rev_decision: "reingreso",
        rev_comentario: "El postulante actualizó sus datos y documentos de acreditación para una nueva evaluación.",
        rev_admin_id: usuarioId,
      });
    } catch (errRevIns) {
      console.warn("Aviso al registrar revisión de reingreso:", errRevIns);
    }

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
  // Primero limpiamos cualquier experiencia previa de esta solicitud para evitar duplicados
  try {
    await adminSupabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().eq("exp_solicitud_id", solicitudId);
  } catch (errExpDel) {
    console.warn("Aviso al limpiar experiencias previas:", errExpDel);
  }

  if (d.experiencia.length > 0) {
    const vistosExp = new Set<string>();
    const experienciasUnicas = d.experiencia.filter((e) => {
      const clave = `${e.empresa.trim().toLowerCase()}|${e.cargo.trim().toLowerCase()}|${e.fechaInicio.trim()}`;
      if (vistosExp.has(clave)) return false;
      vistosExp.add(clave);
      return true;
    });

    const { error: errorExp } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_experiencia_laboral")
      .insert(
        experienciasUnicas.map((e) => ({
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

  // Despachar notificación automática (Email + Push) e inscribir en bitácora en segundo plano
  notificarSolicitudEnviada(usuarioId, solicitudId, esActualizacion).catch((errNot) => {
    console.warn("Aviso en despacho de notificación automática:", errNot);
  });

  revalidatePath("/panel/solicitud-socio");
  revalidatePath("/panel/socios");
  revalidatePath("/panel/administrar");
  revalidatePath("/panel/emision-notificaciones");

  return { ok: true, data: { solicitudId } };
}

export async function subirDocumentoSocioAction(formData: FormData): Promise<Resultado<{ url: string; path: string }>> {
  try {
    const solicitudId = formData.get("solicitudId") as string;
    const tipo = formData.get("tipo") as "foto_perfil" | "titulo" | "matricula" | "cedula" | "identificacion" | "otro" | "cv" | "contrato_socio" | "respaldo_revision";
    const archivo = formData.get("archivo") as File;
    const comentario = (formData.get("comentario") as string) || undefined;
    const usuarioId = (formData.get("usuarioId") as string) || undefined;
    const concepto = (formData.get("concepto") as string) || undefined;

    if (!solicitudId || !archivo || !tipo) {
      return { ok: false, error: "Datos incompletos para subir documento." };
    }

    const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
    const supabase = await crearClienteServidor();
    const { data: { user } } = await supabase.auth.getUser();
    const targetUsuId = usuarioId || user?.id || solicitudId;

    const infoRuta = generarRutaRepositorioComun({
      negocio: "TRANQ",
      usuarioId: targetUsuId,
      procesoOConcepto: concepto || (tipo === "foto_perfil" ? CONCEPTOS_REPOSITORIO.PERFIL : (tipo === "respaldo_revision" ? "revision" : CONCEPTOS_REPOSITORIO.REGISTRO)),
      tramiteORefId: solicitudId,
      tipoDocumento: tipo,
      nombreOriginal: archivo.name,
    });

    const arrayBuffer = await archivo.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const { error: storageError } = await adminSupabase.storage
      .from("socios-documentos")
      .upload(infoRuta.rutaCompleta, buffer, {
        contentType: archivo.type || "application/octet-stream",
        upsert: true,
      });

    if (storageError) {
      console.error("Error al subir archivo a Storage:", storageError);
      return { ok: false, error: storageError.message };
    }

    const TIPOS_PERMITIDOS = ["foto_perfil", "titulo", "matricula", "cedula", "identificacion", "cv", "contrato_socio", "otro", "respaldo_revision"];
    const tipoFinal = TIPOS_PERMITIDOS.includes(tipo) ? (tipo === "identificacion" ? "cedula" : tipo) : "otro";

    if (tipoFinal === "foto_perfil" || tipoFinal === "titulo" || tipoFinal === "cedula" || tipoFinal === "contrato_socio") {
      try {
        await adminSupabase
          .schema("tranqui_legal")
          .from("trq_documento_socio")
          .delete()
          .eq("dcs_solicitud_id", solicitudId)
          .eq("dcs_tipo", tipoFinal);
      } catch (errDel) {
        console.warn("Aviso al limpiar doc previo:", errDel);
      }
    }

    const comentarioFinal = concepto ? `[${concepto}] ${comentario || ""}`.trim() : (comentario || null);

    const { error: dbError } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_documento_socio")
      .insert({
        dcs_solicitud_id: solicitudId,
        dcs_tipo: tipoFinal,
        dcs_url: infoRuta.rutaCompleta,
        dcs_nombre_archivo: infoRuta.nombreSanitizado,
        dcs_comentario: comentarioFinal,
        dcs_subido_por: user?.id || targetUsuId,
      });

    if (dbError) {
      console.error("Error al registrar en trq_documento_socio:", dbError);
      return { ok: false, error: dbError.message };
    }

    // Sincronizar avatar en seg_usuario si es foto de perfil
    if (tipoFinal === "foto_perfil" && targetUsuId) {
      try {
        const { data: publicUrlData } = adminSupabase.storage
          .from("socios-documentos")
          .getPublicUrl(infoRuta.rutaCompleta);

        const fotoUrl = publicUrlData?.publicUrl;
        if (fotoUrl) {
          const { data: uExistente } = await adminSupabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .select("usu_detalle_usuario")
            .eq("usu_id", targetUsuId)
            .maybeSingle();

          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const detalleActual = (uExistente?.usu_detalle_usuario as Record<string, any>) || {};
          await adminSupabase
            .schema("comun_seguridad")
            .from("seg_usuario")
            .update({
              usu_detalle_usuario: {
                ...detalleActual,
                foto_url: fotoUrl,
                avatar_url: fotoUrl,
              }
            })
            .eq("usu_id", targetUsuId);
        }
      } catch (errFotoSync) {
        console.warn("Aviso al sincronizar foto en perfil de usuario:", errFotoSync);
      }
    }

    revalidatePath(`/panel/socios/${solicitudId}`);
    revalidatePath("/panel/solicitud-socio");
    return { ok: true, data: { url: infoRuta.rutaCompleta, path: infoRuta.rutaCompleta } };
  } catch (errSubida: unknown) {
    const msg = errSubida instanceof Error ? errSubida.message : "Error inesperado al subir archivo";
    return { ok: false, error: msg };
  }
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

  let { error } = await adminSupabase.schema("tranqui_legal").from("trq_documento_socio").insert({
    dcs_solicitud_id: solicitudId,
    dcs_tipo: tipoFinal,
    dcs_url: path,
    dcs_nombre_archivo: nombreArchivo,
    dcs_comentario: comentarioFinal,
    dcs_subido_por: user.id,
  });

  // Si el check constraint de PostgreSQL rechaza contrato_socio o foto_perfil, reintentar con 'otro' y tag [tipo:xxx]
  if (error && error.message?.includes("trq_documento_socio_dcs_tipo_check")) {
    const tagComentario = `[tipo:${tipoFinal}] ${comentarioFinal || ""}`.trim();
    const resFallback = await adminSupabase.schema("tranqui_legal").from("trq_documento_socio").insert({
      dcs_solicitud_id: solicitudId,
      dcs_tipo: "otro",
      dcs_url: path,
      dcs_nombre_archivo: nombreArchivo,
      dcs_comentario: tagComentario,
      dcs_subido_por: user.id,
    });
    error = resFallback.error;
  }

  if (error) {
    console.error("Error al registrar documento socio en BDD:", error);
    return { ok: false, error: error.message };
  }

  // Notificar a los administradores y operadores cuando el postulante sube su contrato firmado
  if (tipoFinal === "contrato_socio") {
    try {
      // 1. Obtener datos del postulante
      const { data: solData } = await adminSupabase
        .schema("tranqui_legal")
        .from("trq_solicitud_socio")
        .select("ssc_id, ssc_usuario_id")
        .eq("ssc_id", solicitudId)
        .maybeSingle();

      const usuarioIdPostulante = solData?.ssc_usuario_id || user.id;
      const { data: uPostulante } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo")
        .eq("usu_id", usuarioIdPostulante)
        .maybeSingle();

      const nombrePostulante = [uPostulante?.usu_nombres, uPostulante?.usu_apellidos].filter(Boolean).join(" ") || uPostulante?.usu_correo || "Postulante";
      const correoPostulante = uPostulante?.usu_correo || "postulante@tranqi24.com";
      const urlRevision = `https://www.tranqi24.com/panel/socios/${solicitudId}`;
      const tituloAdmin = `📝 Contrato Firmado Recibido — Postulante: ${nombrePostulante}`;

      const contenidoHTMLAdmin = `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 22px; color: #111; max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <span style="display: inline-block; background: #ECFDF5; color: #065F46; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.82rem; border: 1px solid #10B981;">
              📝 CONTRATO FIRMADO CARGADO
            </span>
          </div>
          <h2 style="color: #05876E; margin-top: 0; font-size: 1.3rem; text-align: center;">Contrato de Sociedad Listo para Verificación</h2>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
            El postulante <strong>${nombrePostulante}</strong> (<code>${correoPostulante}</code>) ha subido exitosamente su contrato de sociedad firmado.
          </p>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
            Por favor ingresa a la plataforma para verificar el documento adjunto y realizar la confirmación y activación definitiva del nuevo <strong>Socio Abogado</strong>.
          </p>
          <div style="text-align: center; margin: 24px 0;">
            <a href="${urlRevision}" style="display: inline-block; background: #05876E; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(5, 135, 110, 0.3);">
              Verificar Contrato y Activar Socio →
            </a>
          </div>
          <p style="font-size: 0.8rem; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 14px; margin-bottom: 0;">
            ID de Solicitud: <code>${solicitudId}</code> • tranqi® Red Legal
          </p>
        </div>
      `;

      // 2. Buscar administradores y operadores
      const destinatariosAdmin: { id: string; correo: string }[] = [];
      const { data: superAdmins } = await adminSupabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_correo")
        .eq("usu_superadmin_plataforma", true);

      if (superAdmins) {
        superAdmins.forEach((sa) => {
          if (sa.usu_correo && !destinatariosAdmin.some((d) => d.id === sa.usu_id)) {
            destinatariosAdmin.push({ id: sa.usu_id, correo: sa.usu_correo });
          }
        });
      }

      const notifsAdmins: any[] = [];
      for (const adm of destinatariosAdmin) {
        notifsAdmins.push({
          not_usuario_id: adm.id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: tituloAdmin,
          not_contenido_html: contenidoHTMLAdmin,
          not_url_accion: `/panel/socios/${solicitudId}`,
          not_creado_en: new Date().toISOString()
        });
        notifsAdmins.push({
          not_usuario_id: adm.id,
          not_negocio: "TRANQ",
          not_canal: "PUSH",
          not_titulo: tituloAdmin,
          not_contenido_html: contenidoHTMLAdmin,
          not_url_accion: `/panel/socios/${solicitudId}`,
          not_creado_en: new Date().toISOString()
        });
      }

      if (notifsAdmins.length > 0) {
        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert(notifsAdmins);
      }

      // 3. Enviar correo SMTP a administradores
      const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
      const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
      const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
      const smtpPort = Number(process.env.SMTP_PORT || 587);

      if (smtpHost && smtpUser && smtpPass && destinatariosAdmin.length > 0) {
        const transporter = nodemailer.createTransport({
          host: smtpHost,
          port: smtpPort,
          secure: smtpPort === 465,
          auth: { user: smtpUser, pass: smtpPass },
          tls: { rejectUnauthorized: false },
        });

        for (const adm of destinatariosAdmin) {
          try {
            await transporter.sendMail({
              from: `"tranqi · Notificaciones" <${smtpUser}>`,
              to: adm.correo,
              subject: tituloAdmin,
              html: contenidoHTMLAdmin,
            });
          } catch (errSmtp) {
            console.warn("Aviso al enviar SMTP a admin:", errSmtp);
          }
        }
      }

      // 4. Bitácora de campañas
      agregarCampanaServidor({
        id: `camp-contrato-firmado-${solicitudId}-${Date.now()}`,
        asunto: tituloAdmin,
        contenidoHTML: contenidoHTMLAdmin,
        tipoEmision: "AUTOMATICA",
        emisorNombre: nombrePostulante,
        emisorCorreo: correoPostulante,
        procesoOrigen: "PLT-019 Carga de Contrato Firmado de Socio",
        audiencia: "ADMINISTRADORES Y OPERADORES",
        canales: ["IN_APP", "EMAIL", "PUSH"],
        destinatariosDetalle: destinatariosAdmin.map(d => d.correo),
        enviados: destinatariosAdmin.length,
        leidos: 0,
        ignorados: 0,
        fecha: new Date().toISOString(),
      });
    } catch (errNotifContrato) {
      console.warn("Aviso al notificar contrato firmado a administradores:", errNotifContrato);
    }
  }

  revalidatePath("/panel/solicitud-socio");
  revalidatePath(`/panel/socios/${solicitudId}`);
  revalidatePath("/panel/socios");
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
  const adminSupabase = crearClienteAdmin() || supabase;

  const perfilOperador = await obtenerPerfilActual();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Obtener la solicitud a evaluar
  const { data: solData, error: solErr } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_usuario_id, ssc_estado")
    .eq("ssc_id", solicitudId)
    .single();

  if (solErr || !solData) {
    return { ok: false, error: solErr?.message || "Solicitud no encontrada" };
  }

  const targetUsuId = solData.ssc_usuario_id;

  // 2. Actualizar estado de la solicitud a 'aceptada' o 'rechazada'
  const { error: updErr } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .update({
      ssc_estado: decision,
      ssc_actualizado_en: new Date().toISOString(),
    })
    .eq("ssc_id", solicitudId);

  if (updErr) {
    return { ok: false, error: updErr.message };
  }

  // 3. Registrar en la bitácora de revisiones
  try {
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_revision_solicitud")
      .insert({
        rev_solicitud_id: solicitudId,
        rev_admin_id: perfilOperador?.usu_id || user?.id || null,
        rev_decision: decision,
        rev_comentario: comentario || (decision === "aceptada" ? "Solicitud aprobada por el evaluador. En espera de firma de contrato." : "Solicitud no aprobada. Requiere actualización."),
      });
  } catch (errRev) {
    console.warn("Aviso al registrar revision:", errRev);
  }

  // Notificar al solicitante cliente/abogado sobre la actualización de su solicitud
  if (targetUsuId) {
    try {
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
            <p>Puedes corregir las observaciones ingresando nuevamente a tu panel y volviendo a enviar la solicitud con la documentación solicitada:</p>
            <p><a href="/panel/solicitud-socio" style="display: inline-block; padding: 10px 18px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Corregir y Reenviar Solicitud</a></p>
          </div>
        `;

        // 1. Guardar notificaciones en base de datos (In-App y Push)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "IN_APP",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_url_accion: "/panel/solicitud-socio",
            not_creado_en: new Date().toISOString()
          },
          {
            not_usuario_id: uApplicant.usu_id,
            not_negocio: "TRANQ",
            not_canal: "PUSH",
            not_titulo: tituloNotif,
            not_contenido_html: cuerpoHTML,
            not_url_accion: "/panel/solicitud-socio",
            not_creado_en: new Date().toISOString()
          }
        ]);

        // 2. Enviar correo SMTP real al postulante
        const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
        const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
        const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
        const smtpPort = Number(process.env.SMTP_PORT || 587);

        if (smtpHost && smtpUser && smtpPass && uApplicant.usu_correo) {
          try {
            const transporter = nodemailer.createTransport({
              host: smtpHost,
              port: smtpPort,
              secure: smtpPort === 465,
              auth: { user: smtpUser, pass: smtpPass },
              tls: { rejectUnauthorized: false }
            });

            await transporter.sendMail({
              from: `"tranqi Evaluaciones" <${smtpUser}>`,
              to: uApplicant.usu_correo,
              subject: tituloNotif,
              html: cuerpoHTML,
            });
          } catch (errSmtp) {
            console.error("Error SMTP al despachar decisión de solicitud al postulante:", errSmtp);
          }
        }

        // 3. Registrar campaña en Bitácora
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
  revalidatePath("/panel/solicitud-socio");
  return { ok: true, data: undefined };
}

export async function reenviarNotificacionAceptacionAction(solicitudId: string): Promise<Resultado<{ correo: string }>> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;
  const perfilOperador = await obtenerPerfilActual();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Obtener la solicitud
  const { data: solData, error: solErr } = await (adminSupabase as any)
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_usuario_id, ssc_estado")
    .eq("ssc_id", solicitudId)
    .single();

  if (solErr || !solData) {
    return { ok: false, error: solErr?.message || "Solicitud no encontrada" };
  }

  // 2. Obtener datos del postulante
  const { data: uApplicant, error: uErr } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
    .eq("usu_id", solData.ssc_usuario_id)
    .maybeSingle();

  if (uErr || !uApplicant || !uApplicant.usu_correo) {
    return { ok: false, error: "No se encontró el correo del postulante." };
  }

  const nombrePostulante = [uApplicant.usu_nombres, uApplicant.usu_apellidos].filter(Boolean).join(" ") || uApplicant.usu_correo;
  const tituloNotif = "🎉 ¡Tu Acreditación como Socio Abogado fue APROBADA! — Descarga y Firma tu Contrato";

  const cuerpoHTML = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 24px; color: #111; max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px;">
      <div style="text-align: center; margin-bottom: 20px;">
        <span style="display: inline-block; background: #ECFDF5; color: #065F46; padding: 6px 16px; border-radius: 999px; font-weight: 800; font-size: 0.85rem; border: 1px solid #10B981;">
          🟢 ACREDITACIÓN PROFESIONAL APROBADA
        </span>
      </div>
      <h2 style="color: #059669; margin-top: 0; font-size: 1.4rem; text-align: center;">¡Felicitaciones, ${nombrePostulante}!</h2>
      <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
        Tu postulación para unirte al Equipo Jurídico de <strong>tranqi</strong> ha sido evaluada y marcada formalmente como <strong>APROBADA</strong>.
      </p>
      <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
        Para culminar tu incorporación y activar tus credenciales de Socio Abogado, por favor sigue estos 3 sencillos pasos:
      </p>

      <div style="background: #F9FAFB; border: 1.5px solid #E5E7EB; border-radius: 10px; padding: 18px; margin: 20px 0;">
        <ol style="margin: 0; padding-left: 20px; line-height: 1.7; color: #1F2937; font-size: 0.92rem;">
          <li style="margin-bottom: 10px;">
            <strong>Descarga tu contrato pre-llenado</strong>:<br/>
            <a href="https://www.tranqi24.com/api/solicitud-socio/contrato/descargar?solicitudId=${solicitudId}" style="display: inline-block; margin-top: 4px; color: #5000BA; font-weight: 700; text-decoration: underline;">
              📥 Descargar Plantilla Oficial de Contrato (.docx)
            </a>
          </li>
          <li style="margin-bottom: 10px;">
            <strong>Fírmalo</strong> (de forma manuscrita o con firma electrónica).
          </li>
          <li style="margin-bottom: 0;">
            <strong>Sube el contrato firmado</strong> en la plataforma:<br/>
            <a href="https://www.tranqi24.com/panel/solicitud-socio" style="display: inline-block; margin-top: 6px; background: #05876E; color: #FFFFFF; padding: 8px 16px; border-radius: 8px; font-weight: 700; text-decoration: none; font-size: 0.88rem;">
              📝 Subir Contrato Firmado en mi Panel →
            </a>
          </li>
        </ol>
      </div>

      <p style="font-size: 0.88rem; color: #6B7280; line-height: 1.4; border-top: 1px solid #E5E7EB; padding-top: 16px; margin-bottom: 0;">
        Si tienes alguna inquietud, responde a este correo o comunícate con nuestro equipo de acreditación.
      </p>
    </div>
  `;

  // 1. Guardar notificaciones in-app y push
  try {
    await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
      {
        not_usuario_id: uApplicant.usu_id,
        not_negocio: "TRANQ",
        not_canal: "IN_APP",
        not_titulo: tituloNotif,
        not_contenido_html: cuerpoHTML,
        not_url_accion: "/panel/solicitud-socio",
        not_creado_en: new Date().toISOString()
      },
      {
        not_usuario_id: uApplicant.usu_id,
        not_negocio: "TRANQ",
        not_canal: "PUSH",
        not_titulo: tituloNotif,
        not_contenido_html: cuerpoHTML,
        not_url_accion: "/panel/solicitud-socio",
        not_creado_en: new Date().toISOString()
      }
    ]);
  } catch (errNot) {
    console.warn("Aviso en not_registro:", errNot);
  }

  // 2. Enviar correo SMTP real
  const smtpHost = process.env.SMTP_HOST || process.env.EMAIL_HOST;
  const smtpUser = process.env.SMTP_USER || process.env.EMAIL_USER;
  const smtpPass = process.env.SMTP_PASS || process.env.EMAIL_PASS;
  const smtpPort = Number(process.env.SMTP_PORT || 587);

  if (smtpHost && smtpUser && smtpPass && uApplicant.usu_correo) {
    try {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: {
          user: smtpUser,
          pass: smtpPass,
        },
      });

      await transporter.sendMail({
        from: `"tranqi · Red de Abogados" <${smtpUser}>`,
        to: uApplicant.usu_correo,
        subject: tituloNotif,
        html: cuerpoHTML,
      });
    } catch (errSmtp) {
      console.error("Error al enviar correo SMTP de reenvío:", errSmtp);
    }
  }

  // 3. Registrar en bitácora de revisiones
  try {
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_revision_solicitud")
      .insert({
        rev_solicitud_id: solicitudId,
        rev_admin_id: perfilOperador?.usu_id || user?.id || null,
        rev_decision: "aceptada",
        rev_comentario: "Reenvío de notificación formal de aceptación y plantilla de contrato al correo del postulante.",
      });
  } catch (errRev) {
    console.warn("Aviso al registrar revisión de reenvío:", errRev);
  }

  // 4. Registrar en Campañas
  agregarCampanaServidor({
    id: `camp-reenvio-${solicitudId}-${Date.now()}`,
    asunto: tituloNotif,
    contenidoHTML: cuerpoHTML,
    tipoEmision: "MANUAL",
    emisorNombre: perfilOperador?.usu_nombres || "Operador de Acreditación",
    emisorCorreo: perfilOperador?.usu_correo || "evaluacion@tranqi24.com",
    procesoOrigen: "PLT-019 Reenvío de Aprobación de Socio Abogado",
    audiencia: `SOLICITANTE (${uApplicant.usu_correo})`,
    canales: ["IN_APP", "EMAIL", "PUSH"],
    destinatariosDetalle: [uApplicant.usu_correo],
    enviados: 1,
    leidos: 0,
    ignorados: 0,
    fecha: new Date().toISOString(),
  });

  revalidatePath(`/panel/socios/${solicitudId}`);
  revalidatePath("/panel/socios");
  return { ok: true, data: { correo: uApplicant.usu_correo } };
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

  const DEFAULT_TEMPLATE = `# CONTRATO MARCO DE INTERMEDIACIÓN TECNOLÓGICA Y PRESTACIÓN DE SERVICIOS PROFESIONALES INDEPENDIENTES

Conste por el presente instrumento privado, que se celebra al tenor de las siguientes cláusulas y estipulaciones:

## PRIMERA: COMPARECIENTES
Comparecen a la suscripción del presente Contrato:
1. Por una parte, **tranqi® Legal Network** (en adelante denominada la **"PLATAFORMA"**), plataforma digital de intermediación tecnológica y gestión de servicios jurídicos.
2. Por otra parte, el/la profesional del derecho **{{nombre_completo}}**, de nacionalidad ecuatoriana, portador(a) de la cédula de ciudadanía número **{{cedula}}** (en adelante denominado/a el **"SOCIO ABOGADO"**).

Las partes comparecen por sus propios derechos, con plena capacidad legal para obligarse y contratar.

## SEGUNDA: ANTECEDENTES Y NATURALEZA JURÍDICA
2.1. La **PLATAFORMA** opera un ecosistema tecnológico digital (aplicación web y móvil) diseñado para intermediar, conectar y coordinar la demanda de servicios de orientación y patrocinio legal de usuarios y clientes con profesionales del derecho calificados.
2.2. El **SOCIO ABOGADO** es un profesional en derecho legalmente autorizado para ejercer la abogacía en la República del Ecuador, con título registrado ante la SENESCYT y matrícula profesional activa ante el Foro de Abogados del Consejo de la Judicatura.
2.3. Ambas partes declaran y aceptan que la naturaleza del presente acuerdo es estrictamente civil y comercial de intermediación de servicios por medios digitales (modelo marketplace tecnológico), rigiéndose por el principio de autonomía de la voluntad, la Ley de Comercio Electrónico y el Código de Comercio.

## TERCERA: OBJETO DEL CONTRATO
El objeto del presente contrato es conceder al **SOCIO ABOGADO** una licencia de uso y acceso a la cuenta profesional en la **PLATAFORMA** para la recepción, gestión y atención de requerimientos legales, consultas telemáticas, citas presenciales y patrocinio judicial de clientes y suscriptores del ecosistema.

## CUARTA: OBLIGACIONES Y ESTÁNDARES DEL SOCIO ABOGADO
El **SOCIO ABOGADO** se compromete a:
1. **Diligencia Profesional:** Prestar la asesoría y patrocinio jurídico con estricta sujeción a la ética profesional, el Código Orgánico de la Función Judicial y la normativa ecuatoriana vigente.
2. **Acreditación Vigente:** Mantener activas y sin sanciones sus credenciales ante el Foro de Abogados del Ecuador.
3. **Calidad de Servicio y Tiempos de Respuesta:** Atender las consultas telemáticas y expedientes asignados dentro de los estándares y plazos acordados en la plataforma.
4. **Veracidad de la Información:** Responder por la autenticidad de los documentos, títulos y certificaciones consignadas en su postulación.

## QUINTA: HONORARIOS, TARIFAS Y LIQUIDACIÓN
5.1. Los usuarios abonarán los valores correspondientes a los servicios legales a través de los medios de pago electrónicos habilitados por la **PLATAFORMA**.
5.2. La **PLATAFORMA** liquidará periódicamente a favor del **SOCIO ABOGADO** el porcentaje pactado por concepto de honorarios profesionales, reteniendo la comisión o tarifa por el uso de la infraestructura digital, pasarela de pagos y soporte tecnológico.
5.3. Cada parte será responsable de sus propias obligaciones tributarias y de facturación ante el Servicio de Rentas Internas (SRI).

## SEXTA: CONFIDENCIALIDAD Y PROTECCIÓN DE DATOS PERSONALES
6.1. **Secreto Profesional:** El **SOCIO ABOGADO** se obliga a guardar estricta reserva y secreto profesional sobre todos los hechos, datos, documentos y estrategias jurídicas puestas a su conocimiento por parte de los clientes y la **PLATAFORMA**.
6.2. **Cumplimiento LOPDP:** Las partes se someten rigurosamente a la Ley Orgánica de Protección de Datos Personales del Ecuador, comprometiéndose a no transferir ni utilizar los datos personales para fines distintos a la prestación del servicio legal encomendado.

## SEXTA BIS: AUSENCIA DE RELACIÓN LABORAL
Las partes reconocen y ratifican expresamente que el presente contrato **NO genera relación de dependencia, subordinación laboral, ni societaria** entre la **PLATAFORMA** y el **SOCIO ABOGADO**. El profesional actúa con plena libertad técnica, científica y horaria en el ejercicio de su profesión.

## SÉPTIMA: VIGENCIA, SUSPENSIÓN Y RESOLUCIÓN
7.1. El presente contrato entrará en vigencia a partir de su firma y tendrá duración indefinida.
7.2. Cualquiera de las partes podrá darlo por terminado en cualquier momento mediante notificación previa a través de la plataforma, sin perjuicio de concluir diligentemente los procesos o consultas en curso.
7.3. La **PLATAFORMA** se reserva la potestad de suspender o revocar la cuenta en caso de quejas graves, faltas éticas o suspensión de la matrícula profesional.

## OCTAVA: ACEPTACIÓN Y FIRMA
Para constancia y validez de lo acordado, las partes suscriben el presente contrato en formato físico o digital (conforme a la Ley de Comercio Electrónico, Firmas Electrónicas y Mensajes de Datos del Ecuador).

En la ciudad de Quito, Distrito Metropolitano, a la fecha de aceptación formal de la solicitud.`;

  if (error) return { ok: true, data: { pct_titulo: "Contrato de Prestación de Servicios de Socio Abogado", pct_contenido: DEFAULT_TEMPLATE } };
  if (!data || !data.pct_contenido || data.pct_contenido.trim().length < 50) {
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
  const adminSupabase = crearClienteAdmin() || supabase;
  const perfilAdmin = await obtenerPerfilActual();
  const { data: { user } } = await supabase.auth.getUser();

  // 1. Obtener la solicitud
  const { data: solData, error: solErr } = await (adminSupabase as any)
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_usuario_id, ssc_estado, ssc_contrato_confirmado_en")
    .eq("ssc_id", solicitudId)
    .single();

  if (solErr || !solData) {
    return { ok: false, error: solErr?.message || "Solicitud no encontrada" };
  }

  const targetUsuId = solData.ssc_usuario_id;

  // 2. Intentar ejecutar el RPC de PostgreSQL o fallback directo con adminSupabase
  const { error: rpcError } = await (supabase as any)
    .schema("tranqui_legal")
    .rpc("trq_fn_confirmar_contrato_socio", { p_solicitud_id: solicitudId, p_comentario: comentario || null });

  if (rpcError) {
    // Actualizar solicitud
    const { error: updErr } = await (adminSupabase as any)
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .update({
        ssc_estado: "aceptada",
        ssc_contrato_confirmado_en: new Date().toISOString(),
        ssc_contrato_confirmado_por: perfilAdmin?.usu_id || user?.id || null,
        ssc_actualizado_en: new Date().toISOString(),
      })
      .eq("ssc_id", solicitudId);

    if (updErr) return { ok: false, error: updErr.message };

    // Activar en trq_abogado
    await (adminSupabase as any)
      .schema("tranqui_legal")
      .from("trq_abogado")
      .upsert({
        abg_usuario_id: targetUsuId,
        abg_solicitud_id: solicitudId,
        abg_estado: "verificado",
        abg_verificado_en: new Date().toISOString(),
      }, { onConflict: "abg_usuario_id" });

    // Registrar en historial de revisiones
    await adminSupabase
      .schema("tranqui_legal")
      .from("trq_revision_solicitud")
      .insert({
        rev_solicitud_id: solicitudId,
        rev_admin_id: perfilAdmin?.usu_id || user?.id || null,
        rev_decision: "aceptada",
        rev_comentario: comentario || "Contrato firmado recibido y confirmado. Activación de credenciales y rol de Abogado.",
      });

    // Asignar perfil ABOGADO en comun_seguridad
    try {
      await (adminSupabase as any)
        .schema("comun_seguridad")
        .rpc("seg_fn_asignar_perfil", {
          p_target_usuario_id: targetUsuId,
          p_negocio: "TRANQ",
          p_perfil_clave: "ABOGADO",
        });
    } catch {
      // Ignorar si el RPC no existe
    }
  }

  // Notificar al solicitante cliente/abogado sobre la confirmación de su contrato
  try {
    const { data: uApplicant } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
      .eq("usu_id", targetUsuId)
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

  // 1. Buscar la solicitud activa no aceptada del usuario
  let query = adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_estado")
    .eq("ssc_usuario_id", perfil.usu_id)
    .is("ssc_eliminado_en", null)
    .neq("ssc_estado", "cancelada");

  if (solicitudId) {
    query = query.eq("ssc_id", solicitudId);
  }

  const { data: sol, error: solErr } = await query.order("ssc_creado_en", { ascending: false }).limit(1).maybeSingle();
  if (solErr) return { ok: false, error: solErr.message };
  if (!sol) return { ok: true, data: undefined };

  if (sol.ssc_estado === "aceptada") {
    return { ok: false, error: "No es posible eliminar una solicitud que ya ha sido aprobada" };
  }

  // 2. Realizar borrado lógico (preservando registro para analítica/estadística con ssc_eliminado_en y ssc_estado = 'cancelada')
  const { error: updErr } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .update({
      ssc_eliminado_en: new Date().toISOString(),
      ssc_estado: "cancelada",
    })
    .eq("ssc_id", sol.ssc_id);

  if (updErr) {
    // Si falla update por constraint, ejecutar borrado físico de respaldo
    const { error: delErr } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .delete()
      .eq("ssc_id", sol.ssc_id);

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

