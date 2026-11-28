"use server";

import { listarTramitesPedidos } from "./consultas";
import type { TramitePedido } from "./esquema";

/** Trámites pagados del cliente, para el widget «Mis necesidades» (se carga en el cliente). */
export async function obtenerTramitesPedidosAction(): Promise<
  { ok: true; data: TramitePedido[] } | { ok: false; error: string }
> {
  try {
    return { ok: true, data: await listarTramitesPedidos() };
  } catch {
    return { ok: false, error: "No se pudieron cargar tus trámites." };
  }
}
