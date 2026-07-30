import { crearClienteServidor } from "@eco/supabase/servidor";

export interface RegistroAuditoria {
  reg_id: string;
  reg_esquema: string;
  reg_tabla: string;
  reg_operacion: string;
  reg_datos_anteriores: Record<string, unknown> | null;
  reg_datos_nuevos: Record<string, unknown> | null;
  reg_creado_en: string;
  actor_nombres: string | null;
  actor_apellidos: string | null;
  actor_correo: string | null;
}

export interface FiltrosAuditoria {
  desde?: string;
  hasta?: string;
  tabla?: string;
  operacion?: string;
  correoActor?: string;
}

// Unifica auditoria de negocio (tablas propias, ej. tranqui_legal) con
// auditoria de identidad (comun_seguridad: alta de usuario, verificacion de
// correo, reset de clave) acotada a los miembros de este negocio -- ver
// comun_auditoria.aud_fn_listar_auditoria_negocio(). "negocio" y
// "esquemaNegocio" nunca se hardcodean aqui: cuando fastfix/tinkay/
// margaritas tengan su propio esquema de tablas, este paquete ya sirve sin
// tocarlo (mismo criterio que buscarUsuarios(consulta, negocio) en
// @eco/gestion-usuarios).
export async function listarAuditoriaNegocio(
  negocio: string,
  esquemaNegocio: string,
  filtros: FiltrosAuditoria = {},
): Promise<{ data: RegistroAuditoria[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  const { data, error } = await supabase.schema("comun_auditoria").rpc("aud_fn_listar_auditoria_negocio", {
    p_negocio: negocio,
    p_esquema_negocio: esquemaNegocio,
    p_desde: filtros.desde,
    p_hasta: filtros.hasta,
    p_tabla: filtros.tabla,
    p_operacion: filtros.operacion,
    p_correo_actor: filtros.correoActor,
  });

  if (error) return { data: [], error: error.message };
  return { data: (data ?? []) as RegistroAuditoria[], error: null };
}
