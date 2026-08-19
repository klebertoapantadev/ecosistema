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

async function obtenerDestinatariosStaffTranqi(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  clientSupabase: any,
  excluirUsuarioId?: string
): Promise<{ id: string; correo: string }[]> {
  const destinatariosAdmin: { id: string; correo: string }[] = [];
  const correosVistos = new Set<string>();

  try {
    // 1. Intentar RPC con SECURITY DEFINER
    const { data: staffRpc, error: errRpc } = await clientSupabase
      .schema("comun_seguridad")
      .rpc("seg_fn_obtener_staff_negocio", { p_negocio: "TRANQ" });

    if (!errRpc && Array.isArray(staffRpc) && staffRpc.length > 0) {
      for (const st of staffRpc) {
        const correo = (st.usu_correo || "").toLowerCase().trim();
        if (st.usu_id !== excluirUsuarioId && correo && !correosVistos.has(correo)) {
          correosVistos.add(correo);
          destinatariosAdmin.push({ id: st.usu_id, correo: st.usu_correo });
        }
      }
      if (destinatariosAdmin.length > 0) {
        return destinatariosAdmin;
      }
    }
  } catch (errRpcEx) {
    console.warn("Aviso RPC seg_fn_obtener_staff_negocio:", errRpcEx);
  }

  // 2. Fallback de consulta directa
  try {
    const { data: usuarios } = await clientSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_correo, usu_superadmin_plataforma");

    if (Array.isArray(usuarios) && usuarios.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const ids = usuarios.map((u: any) => u.usu_id);

      const { data: membresias } = await clientSupabase
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_usuario_id, mem_estado, mem_negocio, seg_membresia_perfil(seg_perfil(per_clave))")
        .in("mem_usuario_id", ids);

      const mapaStaff = new Map<string, boolean>();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (membresias || []).forEach((m: any) => {
        const negocioUpper = (m.mem_negocio || "").toUpperCase();
        if (negocioUpper === "TRANQ" || negocioUpper === "TRANQI") {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const perfiles = (m.seg_membresia_perfil || [])
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            .map((mp: any) => (mp.seg_perfil?.per_clave || "").toUpperCase());
          if (perfiles.includes("OPERADOR") || perfiles.includes("ADMINISTRADOR") || perfiles.includes("SUPERADMIN") || perfiles.includes("AUXILIAR")) {
            mapaStaff.set(m.mem_usuario_id, true);
          }
        }
      });

      for (const u of usuarios) {
        const correo = (u.usu_correo || "").toLowerCase().trim();
        const esSuperAdmin = Boolean(
          u.usu_superadmin_plataforma ||
          correo === "kleber.toapanta.ch@gmail.com" ||
          correo === "jesus251296@gmail.com"
        );
        const esStaff = esSuperAdmin || mapaStaff.has(u.usu_id);

        if (esStaff && u.usu_id !== excluirUsuarioId && correo && !correosVistos.has(correo)) {
          correosVistos.add(correo);
          destinatariosAdmin.push({ id: u.usu_id, correo: u.usu_correo });
        }
      }
    }
  } catch (err) {
    console.warn("Aviso al obtener staff tranqi:", err);
  }

  // 3. Fallback absoluto con cuentas de staff conocidas
  const CORREOS_FALLBACK = ["kleber.toapanta.ch@gmail.com", "jesus251296@gmail.com", "satcomla.ti@gmail.com"];
  for (const c of CORREOS_FALLBACK) {
    if (!correosVistos.has(c)) {
      correosVistos.add(c);
      destinatariosAdmin.push({ id: crypto.randomUUID(), correo: c });
    }
  }

  return destinatariosAdmin;
}

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
    const destinatariosAdmin = await obtenerDestinatariosStaffTranqi(adminSupabase, u.usu_id);
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

      // Invocar RPC SECURITY DEFINER para asegurar la inserción de notificaciones sin bloqueo de RLS
      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (adminSupabase as any).schema("comun_notificacion").rpc("not_fn_notificar_staff", {
          p_negocio: "TRANQ",
          p_titulo: tituloAdmin,
          p_contenido_html: contenidoAdmin,
          p_url_accion: urlRevision,
          p_excluir_usuario_id: u.usu_id,
        });
      } catch (errRpcStaff) {
        console.warn("Aviso RPC not_fn_notificar_staff:", errRpcStaff);
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

export async function enviarPropuestaModificacionContratoAction(datos: {
  solicitudId: string;
  path: string;
  nombreArchivo: string;
  comentario: string;
}): Promise<Resultado> {
  const adminSupabase = crearClienteAdmin() || await crearClienteServidor();
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida o usuario no autenticado." };

  if (!datos.comentario || datos.comentario.trim().length < 5) {
    return { ok: false, error: "Debes ingresar una explicación o comentario sobre las modificaciones propuestas al contrato." };
  }

  // 1. Registrar documento como propuesta de contrato en trq_documento_socio
  const tagComentario = `[PROPUESTA_MODIFICACION_CONTRATO] ${datos.comentario.trim()}`;
  
  const { error: errDoc } = await adminSupabase
    .schema("tranqui_legal")
    .from("trq_documento_socio")
    .insert({
      dcs_solicitud_id: datos.solicitudId,
      dcs_tipo: "otro",
      dcs_url: datos.path,
      dcs_nombre_archivo: datos.nombreArchivo,
      dcs_comentario: tagComentario,
      dcs_subido_por: user.id,
    });

  if (errDoc) {
    console.error("Error al registrar propuesta de contrato:", errDoc);
    return { ok: false, error: errDoc.message };
  }

  // 2. Registrar en historial de revisiones (trq_revision_solicitud)
  await adminSupabase
    .schema("tranqui_legal")
    .from("trq_revision_solicitud")
    .insert({
      rev_solicitud_id: datos.solicitudId,
      rev_decision: "reingreso",
      rev_comentario: `Propuesta de modificación al contrato (Word): ${datos.comentario.trim()}`,
      rev_admin_id: user.id,
    });

  // 3. Notificar a los administradores y operadores
  try {
    const { data: uPostulante } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo")
      .eq("usu_id", user.id)
      .maybeSingle();

    const nombrePostulante = [uPostulante?.usu_nombres, uPostulante?.usu_apellidos].filter(Boolean).join(" ") || uPostulante?.usu_correo || "Postulante";
    const correoPostulante = uPostulante?.usu_correo || "postulante@tranqi24.com";
    const urlRevision = `https://www.tranqi24.com/panel/socios/${datos.solicitudId}`;
    const tituloAdmin = `📝 Propuesta de Modificación al Contrato — Postulante: ${nombrePostulante}`;

    const contenidoHTMLAdmin = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; padding: 22px; color: #111; max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px;">
        <div style="text-align: center; margin-bottom: 16px;">
          <span style="display: inline-block; background: #FEF3C7; color: #92400E; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.82rem; border: 1px solid #F59E0B;">
            📝 PROPUESTA DE CAMBIOS AL CONTRATO
          </span>
        </div>
        <h2 style="color: #5000BA; margin-top: 0; font-size: 1.3rem; text-align: center;">Comentarios a las Cláusulas del Contrato</h2>
        <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
          El postulante <strong>${nombrePostulante}</strong> (<code>${correoPostulante}</code>) ha enviado una propuesta de modificaciones y observaciones al contrato de servicios en formato Word (<code>${datos.nombreArchivo}</code>).
        </p>
        <div style="background: #F9FAFB; border-left: 4px solid #5000BA; padding: 12px 16px; margin: 16px 0; border-radius: 4px;">
          <p style="margin: 0; font-size: 0.9rem; color: #1F2937; font-style: italic;">
            "${datos.comentario.trim()}"
          </p>
        </div>
        <div style="text-align: center; margin: 24px 0;">
          <a href="${urlRevision}" style="display: inline-block; background: #5000BA; color: #FFFFFF; padding: 12px 24px; border-radius: 8px; font-weight: 800; text-decoration: none; font-size: 0.95rem;">
            Revisar Propuesta de Contrato →
          </a>
        </div>
        <p style="font-size: 0.8rem; color: #9CA3AF; border-top: 1px solid #E5E7EB; padding-top: 14px; margin-bottom: 0;">
          ID de Solicitud: <code>${datos.solicitudId}</code> • tranqi® Red Legal
        </p>
      </div>
    `;

    const destinatariosAdmin = await obtenerDestinatariosStaffTranqi(adminSupabase, user.id);

    const notifsAdmins: any[] = [];
    for (const adm of destinatariosAdmin) {
      notifsAdmins.push({
        not_usuario_id: adm.id,
        not_negocio: "TRANQ",
        not_canal: "IN_APP",
        not_titulo: tituloAdmin,
        not_contenido_html: contenidoHTMLAdmin,
        not_url_accion: `/panel/socios/${datos.solicitudId}`,
        not_creado_en: new Date().toISOString()
      });
      notifsAdmins.push({
        not_usuario_id: adm.id,
        not_negocio: "TRANQ",
        not_canal: "PUSH",
        not_titulo: tituloAdmin,
        not_contenido_html: contenidoHTMLAdmin,
        not_url_accion: `/panel/socios/${datos.solicitudId}`,
        not_creado_en: new Date().toISOString()
      });
    }

    if (notifsAdmins.length > 0) {
      try {
        await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert(notifsAdmins);
      } catch (errNotInsertProp) {
        console.warn("Aviso al insertar notificaciones de propuesta:", errNotInsertProp);
      }
    }

    // Invocar RPC SECURITY DEFINER para asegurar inserción de notificación a staff
    try {
      await (adminSupabase as any).schema("comun_notificacion").rpc("not_fn_notificar_staff", {
        p_negocio: "TRANQ",
        p_titulo: tituloAdmin,
        p_contenido_html: contenidoHTMLAdmin,
        p_url_accion: `/panel/socios/${datos.solicitudId}`,
        p_excluir_usuario_id: user.id,
      });
    } catch (errRpcNotProp) {
      console.warn("Aviso RPC not_fn_notificar_staff propuesta:", errRpcNotProp);
    }

    // SMTP
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
        } catch (errSmtp) {}
      }
    }

    agregarCampanaServidor({
      id: `camp-propuesta-contrato-${datos.solicitudId}-${Date.now()}`,
      asunto: tituloAdmin,
      contenidoHTML: contenidoHTMLAdmin,
      tipoEmision: "AUTOMATICA",
      emisorNombre: nombrePostulante,
      emisorCorreo: correoPostulante,
      procesoOrigen: "PLT-019 Propuesta de Modificación al Contrato",
      audiencia: "ADMINISTRADORES Y OPERADORES",
      canales: ["IN_APP", "EMAIL", "PUSH"],
      destinatariosDetalle: destinatariosAdmin.map(d => d.correo),
      enviados: destinatariosAdmin.length,
      leidos: 0,
      ignorados: 0,
      fecha: new Date().toISOString(),
    });
  } catch (err) {
    console.warn("Aviso al notificar propuesta:", err);
  }

  revalidatePath("/panel/solicitud-socio");
  revalidatePath(`/panel/socios/${datos.solicitudId}`);
  revalidatePath("/panel/socios");
  return { ok: true, data: undefined };
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
      const destinatariosAdmin = await obtenerDestinatariosStaffTranqi(adminSupabase, user.id);

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
        try {
          await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert(notifsAdmins);
        } catch (errNotInsertDoc) {
          console.warn("Aviso al insertar notificaciones de contrato subido:", errNotInsertDoc);
        }
      }

      // Invocar RPC SECURITY DEFINER para asegurar inserción de notificación a staff
      try {
        await (adminSupabase as any).schema("comun_notificacion").rpc("not_fn_notificar_staff", {
          p_negocio: "TRANQ",
          p_titulo: tituloAdmin,
          p_contenido_html: contenidoHTMLAdmin,
          p_url_accion: `/panel/socios/${solicitudId}`,
          p_excluir_usuario_id: user?.id,
        });
      } catch (errRpcNotDoc) {
        console.warn("Aviso RPC not_fn_notificar_staff contrato subido:", errRpcNotDoc);
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
          ? "📋 ¡Credenciales Validadas! — Descarga y Firma tu Contrato de Sociedad"
          : "⚠️ Observaciones sobre tu Solicitud de Socio Abogado";

        const cuerpoHTML = decision === "aceptada" ? `
          <div style="font-family: sans-serif; padding: 20px; color: #111;">
            <h2 style="color: #059669;">¡Credenciales Validadas, ${nombrePostulante}!</h2>
            <p>Tu postulación en <strong>tranqi</strong> ha superado la validación de credenciales (Senescyt y Foro de Abogados).</p>
            <p>Para culminar tu acreditación y activar formalmente tus credenciales de <strong>Socio Abogado</strong>, formalicemos el contrato de sociedad:</p>
            <div style="background: #F9FAFB; border: 1px solid #E5E7EB; border-radius: 8px; padding: 16px; margin: 16px 0;">
              <ol style="margin: 0; padding-left: 20px; line-height: 1.6;">
                <li style="margin-bottom: 8px;">
                  <strong>Opción 1 (Recomendada · Rápida):</strong> Firma digitalmente en pantalla con tu archivo <code>.p12</code> y contraseña directamente en tu panel.
                </li>
                <li style="margin-bottom: 8px;">
                  <strong>Opción 2:</strong> Descarga el contrato pre-llenado, fírmalo manualmente o con software externo, y sube el PDF escaneado.
                </li>
              </ol>
            </div>
            ${comentario ? `<div style="background: #F3F4F6; border-left: 4px solid #5000BA; padding: 12px; border-radius: 6px; margin: 16px 0;"><strong>Observación del Evaluador:</strong> ${comentario}</div>` : ""}
            <p><a href="/panel/solicitud-socio" style="display: inline-block; padding: 10px 18px; background: #05876E; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 700;">Ir a Firmar Contrato</a></p>
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
    .select(`
      *,
      trq_revision_solicitud (rev_id, rev_decision, rev_comentario, rev_creado_en),
      trq_documento_socio (dcs_id, dcs_tipo, dcs_nombre_archivo, dcs_comentario, dcs_url, dcs_creado_en)
    `)
    .order("ssc_creado_en", { ascending: false });

  if ((!sData || sData.length === 0) && adminSupabase !== supabase) {
    const resFall = await supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select(`
        *,
        trq_revision_solicitud (rev_id, rev_decision, rev_comentario, rev_creado_en),
        trq_documento_socio (dcs_id, dcs_tipo, dcs_nombre_archivo, dcs_comentario, dcs_url, dcs_creado_en)
      `)
      .order("ssc_creado_en", { ascending: false });
    if (resFall.data && resFall.data.length > 0) {
      sData = resFall.data;
      sErr = null;
    }
  }

  if (sErr) return { ok: false, error: sErr.message };
  if (!sData || sData.length === 0) return { ok: true, data: [] };

  const sDataSincronizadas = (sData || []).map((s: any) => {
    let estadoReal = s.ssc_estado;
    const revs = (s.trq_revision_solicitud || []) as Array<{ rev_decision: string; rev_creado_en: string }>;
    if (revs.length > 0) {
      revs.sort((a, b) => new Date(b.rev_creado_en).getTime() - new Date(a.rev_creado_en).getTime());
      const ultRev = revs[0];
      if (ultRev?.rev_decision === "aceptada" && estadoReal !== "aceptada") {
        estadoReal = "aceptada";
        adminSupabase
          .schema("tranqui_legal")
          .from("trq_solicitud_socio")
          .update({ ssc_estado: "aceptada", ssc_actualizado_en: new Date().toISOString() })
          .eq("ssc_id", s.ssc_id)
          .then(() => {});
      } else if (ultRev?.rev_decision === "reingreso" && estadoReal !== "enviada") {
        estadoReal = "enviada";
      }
    }

    const docs = (s.trq_documento_socio || []) as Array<{ dcs_id: string; dcs_tipo: string; dcs_nombre_archivo?: string | null; dcs_comentario?: string | null; dcs_creado_en?: string | null }>;
    const propuestas = docs.filter(d => d.dcs_comentario?.includes("[PROPUESTA_MODIFICACION_CONTRATO]"));
    const tieneContratoFirmado = docs.some(d => d.dcs_tipo === "contrato_socio");

    // Clasificación de urgencia para el Operador/Admin
    let nivelUrgencia: "urgente_propuesta" | "urgente_contrato" | "pendiente_revision" | "esperando_abogado" | "observada" | "normal" = "normal";
    let etiquetaUrgencia = "";

    if (propuestas.length > 0) {
      nivelUrgencia = "urgente_propuesta";
      etiquetaUrgencia = `Propuesta de Modificación (${propuestas.length})`;
    } else if (tieneContratoFirmado && estadoReal === "aceptada") {
      nivelUrgencia = "urgente_contrato";
      etiquetaUrgencia = "Contrato Firmado Cargado";
    } else if (estadoReal === "enviada" || estadoReal === "en_revision") {
      nivelUrgencia = "pendiente_revision";
      etiquetaUrgencia = "Postulación Inicial Pendiente";
    } else if (estadoReal === "aceptada") {
      nivelUrgencia = "esperando_abogado";
      etiquetaUrgencia = "Esperando Firma del Abogado";
    } else if (estadoReal === "rechazada") {
      nivelUrgencia = "observada";
      etiquetaUrgencia = "Observada / Requiere Corrección";
    }

    return {
      ...s,
      ssc_estado: estadoReal,
      propuestas,
      propuestasPendientesCount: propuestas.length,
      tieneContratoFirmado,
      nivelUrgencia,
      etiquetaUrgencia,
    };
  });

  const userIds = [...new Set(sDataSincronizadas.map((s) => s.ssc_usuario_id))];
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
  const combinadas = sDataSincronizadas.map((s) => ({
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

export async function confirmarContratoSocio(
  solicitudId: string,
  comentario?: string,
  pathContratoBiFirmado?: string
): Promise<Resultado> {
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
  const ahoraIso = new Date().toISOString();

  // 2. Si se adjunta el contrato bi-firmado de Tranqi, registrarlo como documento oficial
  if (pathContratoBiFirmado) {
    try {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_documento_socio")
        .insert({
          dcs_solicitud_id: solicitudId,
          dcs_tipo: "contrato_socio",
          dcs_url: pathContratoBiFirmado,
          dcs_nombre_archivo: "Contrato_Tranqi_BiFirmado.pdf",
          dcs_comentario: "[CONTRATO_BIFIRMADO_TRANQI] Contrato formalizado con contra-firma digital de tranqi",
          dcs_subido_por: perfilAdmin?.usu_id || user?.id || targetUsuId,
        });
    } catch (errBiFirm) {
      console.warn("Aviso al registrar contrato bi-firmado:", errBiFirm);
    }
  }

  // 3. Intentar ejecutar el RPC de PostgreSQL o actualización directa con adminSupabase
  const { error: rpcError } = await (supabase as any)
    .schema("tranqui_legal")
    .rpc("trq_fn_confirmar_contrato_socio", { p_solicitud_id: solicitudId, p_comentario: comentario || null });

  // Actualizar directamente con adminSupabase para asegurar consistencia
  const { error: updErr } = await (adminSupabase as any)
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .update({
      ssc_estado: "aceptada",
      ssc_contrato_confirmado_en: ahoraIso,
      ssc_contrato_confirmado_por: perfilAdmin?.usu_id || user?.id || null,
      ssc_actualizado_en: ahoraIso,
    })
    .eq("ssc_id", solicitudId);

  if (updErr && rpcError) return { ok: false, error: updErr.message };

  // Activar en trq_abogado
  await (adminSupabase as any)
    .schema("tranqui_legal")
    .from("trq_abogado")
    .upsert({
      abg_usuario_id: targetUsuId,
      abg_solicitud_id: solicitudId,
      abg_estado: "verificado",
      abg_verificado_en: ahoraIso,
    }, { onConflict: "abg_usuario_id" });

  // Registrar en historial de revisiones
  await adminSupabase
    .schema("tranqui_legal")
    .from("trq_revision_solicitud")
    .insert({
      rev_solicitud_id: solicitudId,
      rev_admin_id: perfilAdmin?.usu_id || user?.id || null,
      rev_decision: "aceptada",
      rev_comentario: comentario || "Contrato firmado verificado y contra-firmado por tranqi. Activación formal de credenciales y rol de Socio Abogado.",
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
    // Fallback de asignación directa
    try {
      const { data: mem } = await (adminSupabase as any)
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_id")
        .eq("mem_usuario_id", targetUsuId)
        .eq("mem_negocio", "TRANQ")
        .maybeSingle();

      if (mem?.mem_id) {
        const { data: perfAbg } = await (adminSupabase as any)
          .schema("comun_seguridad")
          .from("seg_perfil")
          .select("per_id")
          .eq("per_clave", "ABOGADO")
          .maybeSingle();

        if (perfAbg?.per_id) {
          await (adminSupabase as any)
            .schema("comun_seguridad")
            .from("seg_membresia_perfil")
            .upsert({
              mep_membresia_id: mem.mem_id,
              mep_perfil_id: perfAbg.per_id,
            }, { onConflict: "mep_membresia_id,mep_perfil_id", ignoreDuplicates: true });
        }
      }
    } catch (errMemDirect) {
      console.warn("Aviso en asignación directa de perfil ABOGADO:", errMemDirect);
    }
  }

  // Notificar al solicitante cliente/abogado sobre la activación definitiva de su cuenta
  try {
    const { data: uApplicant } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_correo, usu_nombres, usu_apellidos")
      .eq("usu_id", targetUsuId)
      .maybeSingle();

    if (uApplicant) {
      const nombrePostulante = [uApplicant.usu_nombres, uApplicant.usu_apellidos].filter(Boolean).join(" ") || uApplicant.usu_correo;
      const tituloNotif = "🎉 ¡Bienvenido a tranqi! Contrato Bi-firmado y Cuenta de Socio Abogado Activada";
      const cuerpoHTML = `
        <div style="font-family: sans-serif; padding: 22px; color: #111; max-width: 600px; margin: 0 auto; background: #FFFFFF; border: 1px solid #E5E7EB; border-radius: 12px;">
          <div style="text-align: center; margin-bottom: 16px;">
            <span style="display: inline-block; background: #ECFDF5; color: #065F46; padding: 6px 14px; border-radius: 999px; font-weight: 800; font-size: 0.82rem; border: 1px solid #10B981;">
              ✨ SOCIO ABOGADO ACREDITADO
            </span>
          </div>
          <h2 style="color: #059669; margin-top: 0; text-align: center;">¡Felicitaciones, Abogado ${nombrePostulante}!</h2>
          <p style="font-size: 0.95rem; line-height: 1.5; color: #374151;">
            Hemos completado la verificación y contra-firma digital de tu contrato de sociedad. Tu cuenta profesional ha sido formalmente activada en <strong>tranqi®</strong>.
          </p>
          <div style="background: #F0FDF4; border: 1.5px solid #10B981; border-radius: 8px; padding: 16px; margin: 16px 0;">
            <p style="margin: 0; font-size: 0.88rem; color: #065F46; line-height: 1.5;">
              ✓ Contrato bi-firmado por ambas partes disponible en tu expediente.<br/>
              ✓ Rol de <strong>Socio Abogado</strong> activo con acceso completo a casos y agenda.<br/>
              ✓ Perfil publicado en la red legal de tranqi.
            </p>
          </div>
          <div style="text-align: center; margin: 24px 0;">
            <a href="/panel" style="display: inline-block; padding: 12px 24px; background: #5000BA; color: #fff; text-decoration: none; border-radius: 8px; font-weight: 800; font-size: 0.95rem; box-shadow: 0 4px 12px rgba(80,0,186,0.3);">
              Ir a mi Panel de Abogado →
            </a>
          </div>
        </div>
      `;

      await (adminSupabase as any).schema("comun_notificacion").from("not_registro").insert([
        {
          not_usuario_id: uApplicant.usu_id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: tituloNotif,
          not_contenido_html: cuerpoHTML,
          not_url_accion: "/panel",
          not_creado_en: ahoraIso,
        },
        {
          not_usuario_id: uApplicant.usu_id,
          not_negocio: "TRANQ",
          not_canal: "PUSH",
          not_titulo: tituloNotif,
          not_contenido_html: cuerpoHTML,
          not_url_accion: "/panel",
          not_creado_en: ahoraIso,
        }
      ]);

      agregarCampanaServidor({
        id: `camp-contrato-conf-${solicitudId}-${Date.now()}`,
        asunto: tituloNotif,
        contenidoHTML: cuerpoHTML,
        tipoEmision: "AUTOMATICA",
        emisorNombre: "Equipo de Soporte Legal tranqi",
        emisorCorreo: "soporte@tranqi24.com",
        procesoOrigen: "PLT-020 Activación de Socio Abogado",
        audiencia: `ABOGADO (${uApplicant.usu_correo})`,
        canales: ["IN_APP", "EMAIL", "PUSH"],
        destinatariosDetalle: [uApplicant.usu_correo],
        enviados: 1,
        leidos: 0,
        ignorados: 0,
        fecha: ahoraIso,
      });
    }
  } catch (errNot) {
    console.error("Error al enviar notificación de confirmación de contrato:", errNot);
  }

  revalidatePath("/panel/socios");
  revalidatePath(`/panel/socios/${solicitudId}`);
  revalidatePath("/panel/solicitud-socio");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
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

/**
 * Permite al Operador / Administrador emitir o ajustar una versión personalizada del contrato en Markdown
 * antes de enviarla a firma al solicitante, con notificación clara del número de versión.
 */
export async function guardarYEnviarVersionContratoAction(
  solicitudId: string,
  titulo: string,
  contenidoMd: string,
  comentarioOperador?: string
): Promise<Resultado<{ numeroVersion: number }>> {
  try {
    const perfil = await obtenerPerfilActual();
    if (!perfil) return { ok: false, error: "Usuario no autenticado" };

    const perfiles = await obtenerPerfiles("TRANQ");
    const esStaff =
      perfil.usu_superadmin_plataforma ||
      perfiles.includes("ADMINISTRADOR") ||
      perfiles.includes("SUPERADMIN") ||
      perfiles.includes("OPERADOR");

    if (!esStaff) {
      return { ok: false, error: "No tienes permisos de operador o administrador para emitir contratos." };
    }

    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;

    // 1. Obtener la solicitud
    const { data: sol, error: solErr } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("ssc_id, ssc_usuario_id, ssc_estado")
      .eq("ssc_id", solicitudId)
      .maybeSingle();

    if (solErr || !sol) {
      return { ok: false, error: "Solicitud no encontrada" };
    }

    // 2. Obtener el número de versión anterior
    const { data: ultVersion } = await (adminSupabase.schema("tranqui_legal") as any)
      .from("trq_version_contrato_socio")
      .select("vcs_numero_version")
      .eq("vcs_solicitud_id", solicitudId)
      .order("vcs_numero_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nuevaVersion = ultVersion ? ultVersion.vcs_numero_version + 1 : 1;
    const tipoEvento = nuevaVersion === 1 ? "EMISION_CONTRATO" : "MODIFICACION_OPERADOR";
    const rolCreador = perfiles.includes("ADMINISTRADOR") || perfil.usu_superadmin_plataforma ? "ADMINISTRADOR" : "OPERADOR";

    // 3. Insertar nueva versión inmutable
    const { error: insErr } = await (adminSupabase.schema("tranqui_legal") as any)
      .from("trq_version_contrato_socio")
      .insert({
        vcs_solicitud_id: solicitudId,
        vcs_numero_version: nuevaVersion,
        vcs_titulo: titulo.trim() || "CONTRATO DE PRESTACIÓN DE SERVICIOS Y ASOCIACIÓN LEGAL",
        vcs_contenido_md: contenidoMd,
        vcs_comentarios: comentarioOperador?.trim() || null,
        vcs_creado_por: perfil.usu_id,
        vcs_rol_creador: rolCreador,
        vcs_tipo_evento: tipoEvento,
      });

    if (insErr) {
      return { ok: false, error: `Error al registrar versión de contrato: ${insErr.message}` };
    }

    // 4. Si la solicitud no estaba aceptada (Paso 1), actualizar a 'aceptada' para permitir firma
    if (sol.ssc_estado !== "aceptada") {
      await adminSupabase
        .schema("tranqui_legal")
        .from("trq_solicitud_socio")
        .update({ ssc_estado: "aceptada" })
        .eq("ssc_id", solicitudId);
    }

    // 5. Notificar al solicitante
    const { data: usuarioDest } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_correo, usu_nombres")
      .eq("usu_id", sol.ssc_usuario_id)
      .maybeSingle();

    if (usuarioDest?.usu_correo) {
      const ahoraIso = new Date().toISOString();
      const tituloNotif = `📋 Contrato de Sociedad (Versión ${nuevaVersion}) Emitido — Revisa y Firma`;
      const mensajeNotif = comentarioOperador?.trim()
        ? `El equipo de tranqi ha emitido la versión ${nuevaVersion} de tu contrato con las siguientes observaciones: "${comentarioOperador.trim()}". Ingresa para revisar y firmar.`
        : `El equipo de tranqi ha preparado la versión ${nuevaVersion} de tu contrato de sociedad. Ingresa a tu panel para revisarlo y firmarlo digitalmente.`;

      // In-App
      await (adminSupabase.schema("comun_notificaciones") as any).from("not_notificacion").insert([
        {
          not_usuario_id: usuarioDest.usu_id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: tituloNotif,
          not_contenido_html: mensajeNotif,
          not_url_accion: "/panel/solicitud-socio",
          not_creado_en: ahoraIso,
        },
      ]);

      // Bitácora
      agregarCampanaServidor({
        id: `camp-contrato-v${nuevaVersion}-${solicitudId}-${Date.now()}`,
        asunto: tituloNotif,
        contenidoHTML: mensajeNotif,
        tipoEmision: "AUTOMATICA",
        emisorNombre: "tranqi Legal Staff",
        emisorCorreo: "soporte@tranqi24.com",
        procesoOrigen: `PLT-020 Emisión de Contrato v${nuevaVersion}`,
        audiencia: `POSTULANTE (${usuarioDest.usu_correo})`,
        canales: ["IN_APP", "EMAIL", "PUSH"],
        destinatariosDetalle: [usuarioDest.usu_correo],
        enviados: 1,
        leidos: 0,
        ignorados: 0,
        fecha: ahoraIso,
      });
    }

    revalidatePath("/panel/socios");
    revalidatePath(`/panel/socios/${solicitudId}`);
    revalidatePath("/panel/solicitud-socio");
    return { ok: true, data: { numeroVersion: nuevaVersion } };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al emitir versión del contrato";
    return { ok: false, error: msg };
  }
}

/**
 * Permite al solicitante enviar comentarios u observaciones sobre la versión de contrato recibida (sin firmar ni aceptar).
 */
export async function enviarObservacionesContratoAction(
  solicitudId: string,
  comentarios: string
): Promise<Resultado> {
  try {
    if (!comentarios || comentarios.trim().length < 5) {
      return { ok: false, error: "Por favor describe tus comentarios u observaciones (mínimo 5 caracteres)." };
    }

    const perfil = await obtenerPerfilActual();
    if (!perfil) return { ok: false, error: "Usuario no autenticado" };

    const supabase = await crearClienteServidor();
    const adminSupabase = crearClienteAdmin() || supabase;

    // 1. Obtener la solicitud
    const { data: sol, error: solErr } = await adminSupabase
      .schema("tranqui_legal")
      .from("trq_solicitud_socio")
      .select("ssc_id, ssc_usuario_id")
      .eq("ssc_id", solicitudId)
      .maybeSingle();

    if (solErr || !sol) {
      return { ok: false, error: "Solicitud no encontrada" };
    }

    if (sol.ssc_usuario_id !== perfil.usu_id) {
      return { ok: false, error: "Solo el titular de la postulación puede enviar observaciones a su contrato." };
    }

    // 2. Obtener la última versión activa
    const { data: ultVersion } = await (adminSupabase.schema("tranqui_legal") as any)
      .from("trq_version_contrato_socio")
      .select("*")
      .eq("vcs_solicitud_id", solicitudId)
      .order("vcs_numero_version", { ascending: false })
      .limit(1)
      .maybeSingle();

    const versionNum = ultVersion ? ultVersion.vcs_numero_version : 1;
    const titulo = ultVersion ? ultVersion.vcs_titulo : "CONTRATO DE SOCIEDAD";
    const contenido = ultVersion ? ultVersion.vcs_contenido_md : "";

    // 3. Registrar la observación inmutable en la tabla de versiones
    const { error: insErr } = await (adminSupabase.schema("tranqui_legal") as any)
      .from("trq_version_contrato_socio")
      .insert({
        vcs_solicitud_id: solicitudId,
        vcs_numero_version: versionNum,
        vcs_titulo: titulo,
        vcs_contenido_md: contenido,
        vcs_comentarios: `[OBSERVACIÓN SOLICITANTE v${versionNum}]: ${comentarios.trim()}`,
        vcs_creado_por: perfil.usu_id,
        vcs_rol_creador: "SOLICITANTE",
        vcs_tipo_evento: "OBSERVACION_SOLICITANTE",
      });

    if (insErr) {
      return { ok: false, error: `Error al registrar observación: ${insErr.message}` };
    }

    // 4. Notificar a todo el Staff de Tranqi
    const destinatariosStaff = await obtenerDestinatariosStaffTranqi(adminSupabase, perfil.usu_id);
    const ahoraIso = new Date().toISOString();
    const nombreSocio = [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || perfil.usu_correo;
    const tituloStaff = `💬 Observaciones al Contrato (v${versionNum}) — Postulante: ${nombreSocio}`;
    const mensajeStaff = `${nombreSocio} ha enviado observaciones sobre el contrato v${versionNum}: "${comentarios.trim()}". Ingresa al detalle de la solicitud para revisar o ajustar las cláusulas.`;

    for (const staff of destinatariosStaff) {
      await (adminSupabase.schema("comun_notificaciones") as any).from("not_notificacion").insert([
        {
          not_usuario_id: staff.id,
          not_negocio: "TRANQ",
          not_canal: "IN_APP",
          not_titulo: tituloStaff,
          not_contenido_html: mensajeStaff,
          not_url_accion: `/panel/socios/${solicitudId}`,
          not_creado_en: ahoraIso,
        },
      ]);
    }

    if (destinatariosStaff.length > 0) {
      agregarCampanaServidor({
        id: `camp-obs-v${versionNum}-${solicitudId}-${Date.now()}`,
        asunto: tituloStaff,
        contenidoHTML: mensajeStaff,
        tipoEmision: "AUTOMATICA",
        emisorNombre: nombreSocio,
        emisorCorreo: perfil.usu_correo,
        procesoOrigen: `PLT-020 Observaciones de Contrato v${versionNum}`,
        audiencia: "STAFF TRANQI (Operadores y Administradores)",
        canales: ["IN_APP", "EMAIL", "PUSH"],
        destinatariosDetalle: destinatariosStaff.map((s) => s.correo),
        enviados: destinatariosStaff.length,
        leidos: 0,
        ignorados: 0,
        fecha: ahoraIso,
      });
    }

    revalidatePath("/panel/socios");
    revalidatePath(`/panel/socios/${solicitudId}`);
    revalidatePath("/panel/solicitud-socio");
    return { ok: true, data: undefined };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al enviar observaciones";
    return { ok: false, error: msg };
  }
}


