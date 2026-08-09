"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor } from "@eco/supabase/servidor";

export interface Resultado<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

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
    return { ok: false, error: "La clave y el nombre del perfil son obligatorios" };
  }

  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const payload: any = {
    per_clave: input.clave.toUpperCase().trim(),
    per_nombre: input.nombre.trim(),
    per_nivel: input.nivel,
    per_ambito: input.ambito,
    per_descripcion: input.descripcion.trim(),
    per_activo: input.activo
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
  asignar: boolean,
  panelId?: string
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

    if (panelId) {
      payload.rlw_panel_id = panelId;
    }

    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(payload, { onConflict: "rlw_rol, rlw_widget_id, rlw_negocio, rlw_panel_id" });

    if (error) return { ok: false, error: error.message };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let query: any = supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .delete()
      .eq("rlw_rol", perfilClave)
      .eq("rlw_widget_id", widgetClave)
      .eq("rlw_negocio", negocio);

    if (panelId) {
      query = query.eq("rlw_panel_id", panelId);
    }

    const { error } = await query;

    if (error) return { ok: false, error: error.message };
  }

  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/administrar");
  revalidatePath("/panel");
  return { ok: true, data: undefined };
}

export async function obtenerConfiguracionNavegacionRolAction(
  perfilClave: string,
  negocio: string
): Promise<Resultado<{ widgetsPorPanel: Record<string, string[]>; panelesAsignados: string[] }>> {
  const supabase = await crearClienteServidor();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .schema("comun_seguridad")
    .from("seg_rol_widget")
    .select("*") as any)
    .eq("rlw_rol", perfilClave.toUpperCase())
    .eq("rlw_negocio", negocio)
    .eq("rlw_visible", true);

  if (error) return { ok: false, error: error.message };

  const widgetsPorPanel: Record<string, string[]> = {};
  const panelesSet = new Set<string>(["panel_inicio", "panel_cuenta"]);

  if (data && Array.isArray(data) && data.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of data as any[]) {
      const panelId = r.rlw_panel_id || "panel_configuracion";
      if (!widgetsPorPanel[panelId]) widgetsPorPanel[panelId] = [];
      if (r.rlw_widget_id && !widgetsPorPanel[panelId].includes(r.rlw_widget_id)) {
        widgetsPorPanel[panelId].push(r.rlw_widget_id);
      }
      panelesSet.add(panelId);
    }
  }

  return {
    ok: true,
    data: {
      widgetsPorPanel,
      panelesAsignados: Array.from(panelesSet)
    }
  };
}

export async function obtenerDirectorioUsuariosPublicoAction(
  negocio: string
): Promise<Resultado<any[]>> {
  const supabase = await crearClienteServidor();
  const { data: memData, error: memErr } = await supabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_usuario_id, mem_rol, mem_creado_en")
    .eq("mem_negocio", negocio);

  if (memErr) return { ok: false, error: memErr.message };
  if (!memData || memData.length === 0) return { ok: true, data: [] };

  const userIds = [...new Set(memData.map(m => m.mem_usuario_id))];
  const { data: uData, error: uErr } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_creado_en")
    .in("usu_id", userIds);

  if (uErr) return { ok: false, error: uErr.message };

  const uMap = new Map((uData || []).map(u => [u.usu_id, u]));
  const listaCompleta = memData.map(m => {
    const u = uMap.get(m.mem_usuario_id);
    return {
      usuario_id: m.mem_usuario_id,
      nombres: u?.usu_nombres || "Usuario",
      apellidos: u?.usu_apellidos || "",
      correo: u?.usu_correo || "",
      whatsapp: u?.usu_whatsapp || "",
      rol: m.mem_rol,
      creado_en: m.mem_creado_en || u?.usu_creado_en
    };
  });

  return { ok: true, data: listaCompleta };
}
