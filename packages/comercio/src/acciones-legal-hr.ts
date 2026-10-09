"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

export interface EmpleadoLaboral {
  elab_id?: string;
  elab_convenio_id: string;
  elab_usuario_id?: string | null;
  elab_identificacion: string;
  elab_nombres: string;
  elab_apellidos: string;
  elab_cargo?: string | null;
  elab_departamento?: string | null;
  elab_tipo_contrato: "INDEFINIDO" | "PARCIAL" | "TELETRABAJO" | "EMERGENTE" | "SERVICIOS";
  elab_fecha_ingreso?: string | null;
  elab_fecha_salida?: string | null;
  elab_estado: "ACTIVO" | "EN_PROCESO_SALIDA" | "FINIQUITADO" | "SUSPENDIDO";
  elab_sut_registrado: boolean;
  elab_iess_aviso_entrada: boolean;
  elab_iess_aviso_salida: boolean;
  elab_detalle_laboral?: Record<string, any>;
}

function getCliente() {
  let admin: any = null;
  let supabase: any = null;
  try { admin = crearClienteAdmin(); } catch {}
  try { supabase = crearClienteServidor(); } catch {}
  return admin || supabase;
}

export async function obtenerEmpleadosLaboralAction(convenioId: string) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos", empleados: [] };

    const { data, error } = await cliente
      .schema("tranqui_legal")
      .from("trq_empleado_laboral")
      .select("*")
      .eq("elab_convenio_id", convenioId)
      .is("elab_eliminado_en", null)
      .order("elab_creado_en", { ascending: false });

    if (error) return { ok: false, error: error.message, empleados: [] };
    return { ok: true, empleados: data || [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al obtener colaboradores", empleados: [] };
  }
}

export async function guardarEmpleadoLaboralAction(datos: Partial<EmpleadoLaboral>) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos" };

    if (!datos.elab_convenio_id || !datos.elab_identificacion) {
      return { ok: false, error: "Convenio y Cédula de identidad son obligatorios" };
    }

    if (datos.elab_id) {
      const { data, error } = await cliente
        .schema("tranqui_legal")
        .from("trq_empleado_laboral")
        .update({
          elab_nombres: datos.elab_nombres,
          elab_apellidos: datos.elab_apellidos,
          elab_cargo: datos.elab_cargo,
          elab_departamento: datos.elab_departamento,
          elab_tipo_contrato: datos.elab_tipo_contrato,
          elab_fecha_ingreso: datos.elab_fecha_ingreso,
          elab_fecha_salida: datos.elab_fecha_salida,
          elab_estado: datos.elab_estado,
          elab_sut_registrado: datos.elab_sut_registrado,
          elab_iess_aviso_entrada: datos.elab_iess_aviso_entrada,
          elab_iess_aviso_salida: datos.elab_iess_aviso_salida,
          elab_detalle_laboral: datos.elab_detalle_laboral || {},
          elab_actualizado_en: new Date().toISOString(),
        })
        .eq("elab_id", datos.elab_id)
        .select()
        .single();

      if (error) return { ok: false, error: error.message };
      revalidatePath("/panel/administrar");
      return { ok: true, data };
    } else {
      const { data, error } = await cliente
        .schema("tranqui_legal")
        .from("trq_empleado_laboral")
        .insert({
          elab_convenio_id: datos.elab_convenio_id,
          elab_identificacion: datos.elab_identificacion,
          elab_nombres: datos.elab_nombres,
          elab_apellidos: datos.elab_apellidos,
          elab_cargo: datos.elab_cargo,
          elab_departamento: datos.elab_departamento,
          elab_tipo_contrato: datos.elab_tipo_contrato || "INDEFINIDO",
          elab_fecha_ingreso: datos.elab_fecha_ingreso,
          elab_estado: datos.elab_estado || "ACTIVO",
          elab_sut_registrado: datos.elab_sut_registrado || false,
          elab_iess_aviso_entrada: datos.elab_iess_aviso_entrada || false,
          elab_iess_aviso_salida: false,
          elab_detalle_laboral: datos.elab_detalle_laboral || {},
        })
        .select()
        .single();

      if (error) return { ok: false, error: error.message };
      revalidatePath("/panel/administrar");
      return { ok: true, data };
    }
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al guardar empleado laboral" };
  }
}
