"use server";

import { revalidatePath } from "next/cache";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { buscarUsuarios, obtenerPerfilesAsignables } from "./consultas";

export interface Resultado<T = void> {
  ok: boolean;
  data?: T;
  error?: string;
}

export async function obtenerNivelMaximoGestor(negocio: string): Promise<number> {
  try {
    const supabase = await crearClienteServidor();
    const { data } = await supabase
      .schema("comun_seguridad")
      .rpc("seg_fn_nivel_maximo", { p_negocio: negocio });
    return typeof data === "number" ? data : 100;
  } catch {
    return 100;
  }
}

export async function obtenerDatosGestionUsuariosAction(consulta: string = "", negocio: string = "TRANQ") {
  try {
    const [{ data: usuarios, error }, perfiles, nivelMaximoGestor] = await Promise.all([
      buscarUsuarios(consulta, negocio),
      obtenerPerfilesAsignables(),
      obtenerNivelMaximoGestor(negocio),
    ]);
    if (error) return { ok: false, error };
    return { ok: true, data: { usuarios, perfiles, nivelMaximoGestor } };
  } catch (err: any) {
    return { ok: false, error: err?.message || "Error al cargar usuarios" };
  }
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
  const adminSupabase = crearClienteAdmin() || supabase;

  // 1. Intentar RPC Security Definer o consulta a seg_usuario
  let uData: any[] | null = null;
  let uErr: any = null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: rpcData, error: rpcErr } = await (supabase as any)
    .schema("comun_seguridad")
    .rpc("seg_fn_listar_usuarios_directorio");

  if (!rpcErr && rpcData && rpcData.length > 0) {
    uData = rpcData;
  } else {
    // Fallback 1: Consulta directa con adminSupabase leyendo estado y atributos
    const resAdmin = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_creado_en, usu_superadmin_plataforma, usu_detalle_usuario")
      .order("usu_creado_en", { ascending: false });

    uData = resAdmin.data;
    uErr = resAdmin.error;

    if (!uData || uData.length === 0) {
      // Fallback 2: Consulta con cliente de servidor
      const resServ = await supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_creado_en, usu_superadmin_plataforma, usu_detalle_usuario")
        .order("usu_creado_en", { ascending: false });
      uData = resServ.data;
      uErr = resServ.error;
    }
  }

  if (uErr) return { ok: false, error: uErr.message };
  if (!uData || uData.length === 0) return { ok: true, data: [] };

  // 2. Obtener todas las membresías relacionales
  const { data: memData } = await adminSupabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_usuario_id, mem_negocio, mem_rol, mem_estado, mem_creado_en");

  // Mapa de membresías por usuario_id
  const memMap = new Map<string, any[]>();
  (memData || []).forEach(m => {
    const list = memMap.get(m.mem_usuario_id) || [];
    list.push(m);
    memMap.set(m.mem_usuario_id, list);
  });

  const negocioUpper = (negocio || "").toUpperCase();

  // 3. Mapear cada usuario de seg_usuario garantizando visualización de todos los estados (incluso ELIMINADO)
  const listaCompleta = uData.map(u => {
    const membresiasUsuario = memMap.get(u.usu_id) || [];
    const memNegocio = membresiasUsuario.find(m =>
      (m.mem_negocio || "").toUpperCase() === negocioUpper ||
      (negocioUpper === "TRANQI" && (m.mem_negocio || "").toUpperCase() === "TRANQ") ||
      (negocioUpper === "TRANQ" && (m.mem_negocio || "").toUpperCase() === "TRANQI")
    ) || membresiasUsuario[0];

    let rolFinal = memNegocio?.mem_rol || "CLIENTE";
    if (u.usu_superadmin_plataforma) {
      rolFinal = "SUPERADMIN";
    }

    const estadoDetalle = (u.usu_detalle_usuario as any)?.estado;
    const estadoFinal = estadoDetalle || memNegocio?.mem_estado || "ACTIVO";

    return {
      usuario_id: u.usu_id,
      nombres: u.usu_nombres || "Usuario",
      apellidos: u.usu_apellidos || "",
      correo: u.usu_correo || "",
      whatsapp: u.usu_whatsapp || "",
      rol: rolFinal,
      estado: estadoFinal,
      creado_en: memNegocio?.mem_creado_en || u.usu_creado_en
    };
  });

  return { ok: true, data: listaCompleta };
}

export async function eliminarUsuarioSuperAdminAction(
  targetUsuarioId: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  try {
    // 1. Borrar en Supabase Auth mediante GoTrue Admin API
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    if ((adminSupabase as any).auth?.admin?.deleteUser) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      await (adminSupabase as any).auth.admin.deleteUser(targetUsuarioId);
    }

    // 2. Ejecutar RPC de borrado fisico con cascada FK en Postgres
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_eliminar_usuario", { p_target_usuario_id: targetUsuarioId });

    if (rpcErr) {
      console.error("Error RPC seg_fn_superadmin_eliminar_usuario:", rpcErr);
      return { ok: false, error: `Error en Base de Datos Supabase: ${rpcErr.message}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al eliminar usuario" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}

export async function resetearSistemaSuperAdminAction(
  negocio: string = "TRANQ"
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Sesión no válida o usuario no autenticado." };

  const { data: uData } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_es_superadmin")
    .eq("usu_id", user.id)
    .maybeSingle();

  const { data: perfilesData } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_perfiles", { p_negocio: negocio });

  const perfiles = (perfilesData as string[] | null) ?? [];
  const esSuperAdmin = Boolean(uData?.usu_es_superadmin || perfiles.includes("SUPERADMIN"));

  if (!esSuperAdmin) {
    return { ok: false, error: "Acceso denegado: El reset del sistema está reservado exclusivamente para el rol SuperAdmin." };
  }

  try {
    // Ejecutar RPC en Postgres con aislamiento estricto por Negocio (preserva los demas negocios y sus usuarios)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_resetear_sistema", { p_negocio: negocio });

    if (rpcErr) {
      console.error("Error RPC seg_fn_superadmin_resetear_sistema:", rpcErr);
      return { ok: false, error: `Error en Base de Datos Supabase: ${rpcErr.message}` };
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al resetear el sistema" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}

export async function reactivarUsuarioSuperAdminAction(
  targetUsuarioId: string
): Promise<Resultado> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error: rpcErr } = await (supabase as any)
      .schema("comun_seguridad")
      .rpc("seg_fn_superadmin_reactivar_usuario", { p_target_usuario_id: targetUsuarioId });

    if (rpcErr) {
      await adminSupabase.schema("comun_seguridad").from("seg_membresia").update({ mem_estado: "ACTIVO" }).eq("mem_usuario_id", targetUsuarioId);
    }
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al reactivar usuario" };
  }

  revalidatePath("/panel/administrar");
  revalidatePath("/panel/usuarios");
  revalidatePath("/panel");
  return { ok: true };
}
