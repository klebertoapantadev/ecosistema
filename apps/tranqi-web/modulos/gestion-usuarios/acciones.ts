"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

const NEGOCIO = "tranqi";

// Transicion de estado sensible -> RPC transaccional (seg_fn_asignar_rol),
// nunca UPDATE directo. El RPC ya valida que el llamador sea admin del
// negocio y rechaza intentar asignar 'SUPERADMIN' (es un flag de plataforma).
export async function asignarRol(usuarioId: string, rol: string): Promise<Resultado> {
  if (!rol.trim()) return { ok: false, error: "Selecciona un rol" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_asignar_rol", { p_usuario_id: usuarioId, p_negocio: NEGOCIO, p_rol: rol });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/usuarios");
  return { ok: true, data: undefined };
}
