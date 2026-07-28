"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { esquemaSolicitudSocio, esquemaDecisionSolicitud, type DatosSolicitudSocio } from "./esquema";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// TRQ-001. El envio requiere sesion (obtenerPerfilActual ya se resolvio en
// la pagina que llama a esto) -- no requiere MFA, ver nota en
// especificacion-funcional.md de Tranqi. Es un INSERT simple con hijos, no
// una transicion de estado sensible -- no necesita RPC (mismo criterio que
// actualizarConfiguracionNegocio en @eco/configuracion-negocio).
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

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "Ya tienes una solicitud en curso." };
    }
    return { ok: false, error: error.message };
  }

  const solicitudId = solicitud.ssc_id;

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

  const { error: errorMat } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_materia")
    .insert(d.materiaIds.map((mat_id) => ({ sma_solicitud_id: solicitudId, sma_materia_id: mat_id })));
  if (errorMat) return { ok: false, error: errorMat.message };

  const { error: errorProv } = await supabase
    .schema("tranqui_legal")
    .from("trq_solicitud_provincia")
    .insert(d.provinciaIds.map((cat_id) => ({ spr_solicitud_id: solicitudId, spr_provincia_id: cat_id })));
  if (errorProv) return { ok: false, error: errorProv.message };

  revalidatePath("/panel/solicitud-socio");
  return { ok: true, data: { solicitudId } };
}

// Registra los metadatos de un archivo ya subido a Storage (el binario se
// sube directo desde el navegador con crearClienteNavegador() -- server
// actions no son el medio adecuado para transferir archivos grandes). RLS
// de trq_documento_socio ya exige que la solicitud sea del usuario logueado
// (ver migracion tranqui_legal_socios), esta accion solo valida el tipo.
export async function registrarDocumentoSocio(
  solicitudId: string,
  tipo: "titulo" | "matricula" | "otro",
  path: string,
  nombreArchivo: string,
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("tranqui_legal")
    .from("trq_documento_socio")
    .insert({ dcs_solicitud_id: solicitudId, dcs_tipo: tipo, dcs_url: path, dcs_nombre_archivo: nombreArchivo });

  if (error) return { ok: false, error: error.message };
  return { ok: true, data: undefined };
}

// Aceptar/rechazar es una transicion de estado irreversible -> RPC
// transaccional (trq_fn_decidir_solicitud), no UPDATE directo. El RPC ya
// valida que el llamador sea admin de tranqi y, si acepta, crea trq_abogado
// + asigna el rol ABOGADO.
export async function decidirSolicitud(
  solicitudId: string,
  decision: "aceptada" | "rechazada",
  comentario?: string,
): Promise<Resultado> {
  const parseo = esquemaDecisionSolicitud.safeParse({ solicitudId, decision, comentario });
  if (!parseo.success) {
    return { ok: false, error: parseo.error.issues[0]?.message ?? "Datos inválidos" };
  }

  const supabase = await crearClienteServidor();
  const { error } = await supabase.schema("tranqui_legal").rpc("trq_fn_decidir_solicitud", {
    p_solicitud_id: parseo.data.solicitudId,
    p_decision: parseo.data.decision,
    p_comentario: parseo.data.comentario || undefined,
  });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/socios/solicitudes");
  revalidatePath(`/panel/socios/solicitudes/${solicitudId}`);
  revalidatePath("/panel/socios");
  return { ok: true, data: undefined };
}
