"use server";

import { listarAuditoriaNegocio, type RegistroAuditoria, type FiltrosAuditoria } from "./consultas";

export async function obtenerAuditoriaAction(
  negocio: string = "tranqi",
  esquemaNegocio: string = "tranqui_legal",
  filtros: FiltrosAuditoria = {}
): Promise<{ ok: boolean; data?: RegistroAuditoria[]; error?: string }> {
  try {
    const { data, error } = await listarAuditoriaNegocio(negocio, esquemaNegocio, filtros);
    if (error) {
      return { ok: false, error };
    }
    return { ok: true, data: data || [] };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al obtener registros de auditoría";
    return { ok: false, error: msg };
  }
}
