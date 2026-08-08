"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { esquemaSolicitudSocio, esquemaDecisionSolicitud, type DatosSolicitudSocio } from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

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

  // Verificar si ya existe una solicitud para este usuario
  const { data: existente } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_socio")
    .select("ssc_id, ssc_estado")
    .eq("ssc_usuario_id", usuarioId)
    .order("ssc_creado_en", { ascending: false })
    .limit(1)
    .maybeSingle();

  let solicitudId: string;

  if (existente) {
    if (existente.ssc_estado === "aceptada") {
      return { ok: false, error: "Tu solicitud ya fue aprobada exitosamente. ¡Ya eres un Socio Abogado acreditado!" };
    }

    solicitudId = existente.ssc_id;

    // Actualizar solicitud existente
    const { error: errorUpdate } = await supabase
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
        ssc_estado: "enviada",
        ssc_enviada_en: new Date().toISOString(),
      })
      .eq("ssc_id", solicitudId);

    if (errorUpdate) return { ok: false, error: errorUpdate.message };

    // Limpiar relaciones anteriores para insertar la actualizacion limpia
    await Promise.all([
      supabase.schema("tranqui_legal").from("trq_experiencia_laboral").delete().eq("exp_solicitud_id", solicitudId),
      supabase.schema("tranqui_legal").from("trq_solicitud_materia").delete().eq("sma_solicitud_id", solicitudId),
      supabase.schema("tranqui_legal").from("trq_solicitud_provincia").delete().eq("spr_solicitud_id", solicitudId),
    ]);
  } else {
    // Insertar nueva solicitud
    const { data: solicitud, error } = await supabase
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

  // Insertar experiencias, materias y provincias
  if (d.experiencia.length > 0) {
    const { error: errorExp } = await supabase
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

  const materiaUuids = d.materiaIds.filter((id) => UUID_REGEX.test(id));
  if (materiaUuids.length > 0) {
    const { error: errorMat } = await supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_materia")
      .insert(materiaUuids.map((mat_id) => ({ sma_solicitud_id: solicitudId, sma_materia_id: mat_id })));
    if (errorMat) return { ok: false, error: errorMat.message };
  }

  const provinciaUuids = d.provinciaIds.filter((id) => UUID_REGEX.test(id));
  if (provinciaUuids.length > 0) {
    const { error: errorProv } = await supabase
      .schema("tranqui_legal")
      .from("trq_solicitud_provincia")
      .insert(provinciaUuids.map((cat_id) => ({ spr_solicitud_id: solicitudId, spr_provincia_id: cat_id })));
    if (errorProv) return { ok: false, error: errorProv.message };
  }

  revalidatePath("/panel/solicitud-socio");
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
  const { error } = await supabase.schema("tranqui_legal").from("trq_documento_socio").insert({
    dcs_solicitud_id: solicitudId,
    dcs_tipo: tipo,
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
