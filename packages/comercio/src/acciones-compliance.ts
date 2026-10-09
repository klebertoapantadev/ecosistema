"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

export interface ComplianceItem {
  cei_id?: string;
  cei_convenio_id: string;
  cei_catalogo_id?: string | null;
  cei_titulo_personalizado: string;
  cei_entidad: string;
  cei_criticidad: "CRITICA" | "ALTA" | "MEDIA";
  cei_estado: "PENDIENTE" | "VIGENTE" | "POR_VENCER" | "VENCIDO" | "EXENTO";
  cei_fecha_emision?: string | null;
  cei_fecha_caducidad?: string | null;
  cei_documento_url?: string | null;
  cei_aria_metadata?: Record<string, any>;
  cei_observaciones?: string | null;
  cei_validado_por_abogado?: boolean;
}

export interface LegalHealthScoreResumen {
  score: number;
  totales: number;
  al_dia: number;
  por_vencer: number;
  vencidos: number;
}

export interface AdministradorEmpresa {
  cva_id: string;
  cva_usuario_id: string;
  cva_rol: "ADMIN_EMPRESA" | "GESTOR_TALENTO_HUMANO" | "GESTOR_LEGAL";
  cva_activo: boolean;
  cva_permisos: {
    todos_los_expedientes: boolean;
    expedientes_asignados?: string[];
  };
  nombres?: string;
  apellidos?: string;
  correo?: string;
  creado_en?: string;
}

function getCliente() {
  let admin: any = null;
  let supabase: any = null;
  try { admin = crearClienteAdmin(); } catch {}
  try { supabase = crearClienteServidor(); } catch {}
  return admin || supabase;
}

/**
 * Obtiene la matriz de cumplimiento de una empresa
 */
export async function obtenerComplianceEmpresaAction(convenioId: string) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos", items: [] };

    // Intentar inicializar si está vacía
    const { data: items, error } = await cliente
      .schema("comun_comercio")
      .from("com_compliance_empresa_item")
      .select("*")
      .eq("cei_convenio_id", convenioId)
      .is("cei_eliminado_en", null)
      .order("cei_secuencial", { ascending: true });

    if (error) {
      return { ok: false, error: error.message, items: [] };
    }

    if (!items || items.length === 0) {
      // Auto-inicializar desde el catálogo
      await cliente.rpc("com_fn_inicializar_compliance_empresa", { p_convenio_id: convenioId });
      const { data: itemsRecargados } = await cliente
        .schema("comun_comercio")
        .from("com_compliance_empresa_item")
        .select("*")
        .eq("cei_convenio_id", convenioId)
        .is("cei_eliminado_en", null)
        .order("cei_secuencial", { ascending: true });

      return { ok: true, items: itemsRecargados || [] };
    }

    return { ok: true, items: items || [] };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al obtener matriz de compliance", items: [] };
  }
}

/**
 * Guarda o actualiza un ítem de compliance con recálculo automático de score
 */
export async function guardarComplianceItemAction(datos: Partial<ComplianceItem>) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos" };

    const { data, error } = await cliente.rpc("com_fn_guardar_compliance_item", {
      p_datos: datos,
    });

    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/administrar");
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al guardar obligación legal" };
  }
}

/**
 * Calcula el Legal Health Score en tiempo real
 */
export async function calcularLegalHealthScoreAction(convenioId: string): Promise<{ ok: boolean; data?: LegalHealthScoreResumen; error?: string }> {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos" };

    const { data, error } = await cliente.rpc("com_fn_calcular_legal_health_score", {
      p_convenio_id: convenioId,
    });

    if (error) return { ok: false, error: error.message };
    return { ok: true, data };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al calcular Legal Health Score" };
  }
}

/**
 * Lista los administradores y gestores B2B de una empresa
 */
export async function obtenerAdministradoresEmpresaAction(convenioId: string) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos", administradores: [] };

    const { data, error } = await cliente.rpc("com_fn_listar_administradores_empresa", {
      p_convenio_id: convenioId,
    });

    if (error) return { ok: false, error: error.message, administradores: [] };
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al listar administradores", administradores: [] };
  }
}

/**
 * Asigna o actualiza un administrador en la empresa
 */
export async function asignarAdministradorEmpresaAction(
  convenioId: string,
  usuarioId: string,
  rol: "ADMIN_EMPRESA" | "GESTOR_TALENTO_HUMANO" | "GESTOR_LEGAL" = "ADMIN_EMPRESA",
  permisos: Record<string, any> = { todos_los_expedientes: true }
) {
  try {
    const cliente = await getCliente();
    if (!cliente) return { ok: false, error: "Sin conexión a base de datos" };

    const { data, error } = await cliente.rpc("com_fn_asignar_administrador_empresa", {
      p_convenio_id: convenioId,
      p_usuario_id: usuarioId,
      p_rol: rol,
      p_permisos: permisos,
    });

    if (error) return { ok: false, error: error.message };
    revalidatePath("/panel/administrar");
    return data;
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al asignar administrador" };
  }
}
