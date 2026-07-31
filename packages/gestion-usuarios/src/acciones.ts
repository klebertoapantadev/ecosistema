"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

// Transiciones de estado sensibles -> RPC transaccional, nunca UPDATE directo.
// `seg_membresia_perfil` ni siquiera tiene politica de escritura: el techo
// jerarquico de PLT-003 regla 5 se aplica dentro de estas funciones, y un
// update directo desde el cliente lo saltaria.
//
// Ambas sustituyen a `asignarRol()`, que escribia una sola clave en la columna
// deprecada `mem_rol` y por tanto no podia representar la regla 3.
export async function asignarPerfil(usuarioId: string, perfil: string, negocio: string): Promise<Resultado> {
  if (!perfil.trim()) return { ok: false, error: "Selecciona un perfil" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_asignar_perfil", { p_usuario_id: usuarioId, p_negocio: negocio, p_perfil: perfil });

  // El mensaje del RPC ya explica el motivo real —jerarquía insuficiente,
  // perfil desconocido, perfil no asignable— y es más útil que uno genérico.
  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/usuarios");
  return { ok: true, data: undefined };
}

export async function quitarPerfil(usuarioId: string, perfil: string, negocio: string): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_quitar_perfil", { p_usuario_id: usuarioId, p_negocio: negocio, p_perfil: perfil });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/usuarios");
  return { ok: true, data: undefined };
}
