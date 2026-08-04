"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";

type Resultado<T = undefined> = { ok: true; data: T } | { ok: false; error: string };

export async function asignarPerfil(usuarioId: string, perfil: string, negocio: string): Promise<Resultado> {
  if (!perfil.trim()) return { ok: false, error: "Selecciona un perfil" };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_asignar_perfil", { p_usuario_id: usuarioId, p_negocio: negocio, p_perfil: perfil });

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

export interface GuardarPerfilInput {
  clave: string;
  nombre: string;
  nivel: number;
  ambito: string;
  descripcion: string;
  activo: boolean;
}

export async function guardarPerfil(input: GuardarPerfilInput): Promise<Resultado> {
  if (!input.clave.trim() || !input.nombre.trim()) {
    return { ok: false, error: "La clave y nombre del perfil son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    per_clave: input.clave.toUpperCase().trim(),
    per_nombre: input.nombre.trim(),
    per_nivel: input.nivel,
    per_detalles: { descripcion: input.descripcion, ambito: input.ambito },
    per_activo: input.activo,
    per_asignable: true
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_perfil")
    .upsert(payload, { onConflict: "per_clave" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  return { ok: true, data: undefined };
}

export interface GuardarWidgetInput {
  clave: string;
  nombre: string;
  descripcion: string;
  categoria: string;
  ruta: string;
  negocio: string;
}

export async function guardarWidget(input: GuardarWidgetInput): Promise<Resultado> {
  if (!input.clave.trim() || !input.nombre.trim()) {
    return { ok: false, error: "La clave y el nombre del widget son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    wdg_clave: input.clave.toLowerCase().trim(),
    wdg_nombre: input.nombre.trim(),
    wdg_descripcion: input.descripcion.trim(),
    wdg_categoria: input.categoria.trim(),
    wdg_ruta: input.ruta.trim(),
    wdg_negocio: input.negocio,
    wdg_activo: true
  };

  const { error } = await supabase
    .schema("comun_seguridad")
    .from("seg_widget")
    .upsert(payload, { onConflict: "wdg_clave" });

  if (error) return { ok: false, error: error.message };

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel");
  return { ok: true, data: undefined };
}

export async function guardarAsignacionWidget(
  perfilClave: string,
  widgetClave: string,
  negocio: string,
  asignar: boolean
): Promise<Resultado> {
  const supabase = await crearClienteServidor();

  if (asignar) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      rlw_rol: perfilClave,
      rlw_widget_id: widgetClave,
      rlw_negocio: negocio,
      rlw_visible: true
    };

    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(payload);

    if (error) return { ok: false, error: error.message };
  } else {
    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .delete()
      .eq("rlw_rol", perfilClave)
      .eq("rlw_widget_id", widgetClave)
      .eq("rlw_negocio", negocio);

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel");
  return { ok: true, data: undefined };
}
