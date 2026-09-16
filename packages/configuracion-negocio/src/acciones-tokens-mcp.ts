"use server";

import { revalidatePath } from "next/cache";
import type { TokenMcpItem, RespuestaGenerarTokenMcp } from "@eco/agentes-ia";

type Resultado<T> = { ok: true; datos: T } | { ok: false; error: string };

/**
 * Consulta la lista de tokens MCP generados para un negocio.
 */
export async function listarTokensMcpAction(negocio: string): Promise<Resultado<TokenMcpItem[]>> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await (supabase.schema("comun_seguridad") as any)
      .rpc("seg_fn_listar_tokens_mcp", {
        p_negocio_id: negocio,
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    return { ok: true, datos: (data as unknown as TokenMcpItem[]) ?? [] };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado consultando tokens" };
  }
}

/**
 * Genera un nuevo token MCP (API Key) para el negocio.
 * El secreto solo se retorna una única vez en esta llamada.
 */
export async function generarTokenMcpAction(
  negocio: string,
  nombre: string,
  alcances: string[] = ["catalogo:leer"],
  diasExpiracion?: number | null
): Promise<Resultado<RespuestaGenerarTokenMcp>> {
  if (!nombre || nombre.trim().length < 3) {
    return { ok: false, error: "El nombre del token debe tener al menos 3 caracteres" };
  }

  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    let expiraEn: string | null = null;
    if (diasExpiracion && diasExpiracion > 0) {
      const fecha = new Date();
      fecha.setDate(fecha.getDate() + diasExpiracion);
      expiraEn = fecha.toISOString();
    }

    const { data, error } = await (supabase.schema("comun_seguridad") as any)
      .rpc("seg_fn_generar_token_mcp", {
        p_negocio_id: negocio,
        p_nombre: nombre.trim(),
        p_alcances: alcances.length > 0 ? alcances : ["catalogo:leer"],
        p_expira_en: expiraEn,
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/panel/configuracion");
    return { ok: true, datos: data as unknown as RespuestaGenerarTokenMcp };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado generando token MCP" };
  }
}

/**
 * Revoca un token MCP inmediatamente impidiendo futuras llamadas.
 */
export async function revocarTokenMcpAction(
  negocio: string,
  tokenId: string
): Promise<Resultado<boolean>> {
  try {
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await (supabase.schema("comun_seguridad") as any)
      .rpc("seg_fn_revocar_token_mcp", {
        p_token_id: tokenId,
      });

    if (error) {
      return { ok: false, error: error.message };
    }

    revalidatePath("/panel/configuracion");
    return { ok: true, datos: Boolean(data) };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Error inesperado revocando token MCP" };
  }
}
