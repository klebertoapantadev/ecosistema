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
    if (typeof data === "number" && data > 0) {
      return data;
    }

    // Fallback: verificar sesión actual y membresía
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return 10;

    const correo = (user.email || "").toLowerCase().trim();
    if (correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com") {
      return 100;
    }

    const adminClient = crearClienteAdmin() || supabase;
    const { data: uData } = await adminClient
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_superadmin_plataforma")
      .eq("usu_id", user.id)
      .maybeSingle();

    if (uData?.usu_superadmin_plataforma) return 100;

    const { data: mems } = await adminClient
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_rol, mem_negocio")
      .eq("mem_usuario_id", user.id);

    const negocioUpper = (negocio || "TRANQ").toUpperCase();
    const mem = (mems || []).find((m) => {
      const dbNeg = (m.mem_negocio || "").toUpperCase();
      return (
        dbNeg === negocioUpper ||
        (negocioUpper.startsWith("TRANQ") && dbNeg.startsWith("TRANQ")) ||
        (negocioUpper.startsWith("FFH") && dbNeg.startsWith("FFH")) ||
        (negocioUpper.startsWith("FASTFIX") && dbNeg.startsWith("FASTFIX")) ||
        (negocioUpper.startsWith("TNK") && dbNeg.startsWith("TNK")) ||
        (negocioUpper.startsWith("TINKAY") && dbNeg.startsWith("TINKAY")) ||
        (negocioUpper.startsWith("MRG") && dbNeg.startsWith("MRG")) ||
        (negocioUpper.startsWith("MARGARITAS") && dbNeg.startsWith("MARGARITAS"))
      );
    });

    const rol = (mem?.mem_rol || "").toUpperCase();
    if (rol === "SUPERADMIN") return 100;
    if (rol === "ADMIN" || rol === "ADMINISTRADOR") return 80;
    if (rol === "ABOGADO" || rol === "TECNICO") return 50;
    if (rol === "OPERADOR" || rol === "AUXILIAR") return 30;
    return 10;
  } catch {
    return 80;
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

export async function asignarPerfil(usuarioId: string, perfil: string, negocio: string = "TRANQ"): Promise<Resultado> {
  if (!perfil.trim()) return { ok: false, error: "Selecciona un perfil" };

  const nivelGestor = await obtenerNivelMaximoGestor(negocio);
  if (nivelGestor < 80) {
    return { ok: false, error: "No tienes permisos de administrador para asignar perfiles." };
  }

  const supabase = await crearClienteServidor();
  const perfilClaveUpper = perfil.toUpperCase().trim();
  const negocioUpper = (negocio || "TRANQ").toUpperCase().trim();

  // 1. Intentar primero con la RPC de base de datos
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_asignar_perfil", { p_usuario_id: usuarioId, p_negocio: negocioUpper, p_perfil: perfilClaveUpper });

  if (!error) {
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  }

  // 2. Fallback resiliente con cliente Admin si la RPC falla por disparadores o permisos intermedios
  try {
    const adminClient = crearClienteAdmin() || supabase;
    const { data: dbPerfil } = await adminClient
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id, per_nivel, per_activo")
      .eq("per_clave", perfilClaveUpper)
      .maybeSingle();

    if (!dbPerfil?.per_id) {
      return { ok: false, error: `Perfil no encontrado en catálogo: ${perfilClaveUpper}` };
    }

    // Buscar si ya existe membresía para este usuario con cualquier alias del negocio
    const { data: mems } = await adminClient
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio")
      .eq("mem_usuario_id", usuarioId);

    const memExistente = (mems || []).find((m) => {
      const dbNeg = (m.mem_negocio || "").toUpperCase();
      return (
        dbNeg === negocioUpper ||
        (negocioUpper.startsWith("TRANQ") && dbNeg.startsWith("TRANQ")) ||
        (negocioUpper.startsWith("FFH") && dbNeg.startsWith("FFH")) ||
        (negocioUpper.startsWith("FASTFIX") && dbNeg.startsWith("FASTFIX")) ||
        (negocioUpper.startsWith("TNK") && dbNeg.startsWith("TNK")) ||
        (negocioUpper.startsWith("TINKAY") && dbNeg.startsWith("TINKAY")) ||
        (negocioUpper.startsWith("MRG") && dbNeg.startsWith("MRG")) ||
        (negocioUpper.startsWith("MARGARITAS") && dbNeg.startsWith("MARGARITAS"))
      );
    });

    let memId = memExistente?.mem_id;

    if (!memId) {
      const { data: nuevaMem, error: errNuevaMem } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .insert({
          mem_usuario_id: usuarioId,
          mem_negocio: negocioUpper,
          mem_rol: perfilClaveUpper,
          mem_estado: "ACTIVO"
        })
        .select("mem_id")
        .maybeSingle();

      if (errNuevaMem) {
        return { ok: false, error: `Error al crear membresía: ${errNuevaMem.message}` };
      }
      memId = nuevaMem?.mem_id;
    } else {
      await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({ mem_estado: "ACTIVO", mem_actualizado_en: new Date().toISOString() })
        .eq("mem_id", memId);
    }

    if (memId) {
      const authUser = (await supabase.auth.getUser()).data?.user;
      const { error: errMpe } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .upsert(
          {
            mpe_membresia_id: memId,
            mpe_perfil_id: dbPerfil.per_id,
            mpe_asignado_por: authUser?.id || null,
            mpe_actualizado_en: new Date().toISOString()
          },
          { onConflict: "mpe_membresia_id,mpe_perfil_id" }
        );

      if (errMpe) {
        return { ok: false, error: `Error al vincular perfil: ${errMpe.message}` };
      }

      // Sincronizar mem_rol con el perfil de mayor jerarquía
      const { data: mpList } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .select("seg_perfil(per_clave, per_nivel)")
        .eq("mpe_membresia_id", memId);

      const perfilesOrdenados = ((mpList || []) as any[])
        .map((x) => x.seg_perfil)
        .filter(Boolean)
        .sort((a, b) => b.per_nivel - a.per_nivel);

      const rolMayor = perfilesOrdenados[0]?.per_clave || perfilClaveUpper;

      await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_rol: rolMayor,
          mem_estado: "ACTIVO",
          mem_actualizado_en: new Date().toISOString()
        })
        .eq("mem_id", memId);

      revalidatePath("/panel/usuarios");
      revalidatePath("/panel/administrar");
      revalidatePath("/panel");
      return { ok: true, data: undefined };
    }
  } catch (errFallback: any) {
    console.warn("Aviso en fallback asignarPerfil:", errFallback);
    return { ok: false, error: errFallback?.message || error.message };
  }

  return { ok: false, error: error.message };
}

export async function quitarPerfil(usuarioId: string, perfil: string, negocio: string = "TRANQ"): Promise<Resultado> {
  const nivelGestor = await obtenerNivelMaximoGestor(negocio);
  if (nivelGestor < 80) {
    return { ok: false, error: "No tienes permisos de administrador para revocar perfiles." };
  }

  const supabase = await crearClienteServidor();
  const perfilClaveUpper = perfil.toUpperCase().trim();
  const negocioUpper = (negocio || "TRANQ").toUpperCase().trim();

  if (perfilClaveUpper === "CLIENTE") {
    return { ok: false, error: "CLIENTE es el perfil base y no se puede retirar (PLT-003 regla 2)" };
  }

  // 1. Intentar primero con RPC
  const { error } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_quitar_perfil", { p_usuario_id: usuarioId, p_negocio: negocioUpper, p_perfil: perfilClaveUpper });

  if (!error) {
    revalidatePath("/panel/usuarios");
    revalidatePath("/panel/administrar");
    revalidatePath("/panel");
    return { ok: true, data: undefined };
  }

  // 2. Fallback resiliente con cliente Admin
  try {
    const adminClient = crearClienteAdmin() || supabase;
    const { data: dbPerfil } = await adminClient
      .schema("comun_seguridad")
      .from("seg_perfil")
      .select("per_id")
      .eq("per_clave", perfilClaveUpper)
      .maybeSingle();

    const { data: mems } = await adminClient
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_negocio")
      .eq("mem_usuario_id", usuarioId);

    const memExistente = (mems || []).find((m) => {
      const dbNeg = (m.mem_negocio || "").toUpperCase();
      return (
        dbNeg === negocioUpper ||
        (negocioUpper.startsWith("TRANQ") && dbNeg.startsWith("TRANQ")) ||
        (negocioUpper.startsWith("FFH") && dbNeg.startsWith("FFH")) ||
        (negocioUpper.startsWith("FASTFIX") && dbNeg.startsWith("FASTFIX")) ||
        (negocioUpper.startsWith("TNK") && dbNeg.startsWith("TNK")) ||
        (negocioUpper.startsWith("TINKAY") && dbNeg.startsWith("TINKAY")) ||
        (negocioUpper.startsWith("MRG") && dbNeg.startsWith("MRG")) ||
        (negocioUpper.startsWith("MARGARITAS") && dbNeg.startsWith("MARGARITAS"))
      );
    });

    if (dbPerfil?.per_id && memExistente?.mem_id) {
      const { error: errDel } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .delete()
        .eq("mpe_membresia_id", memExistente.mem_id)
        .eq("mpe_perfil_id", dbPerfil.per_id);

      if (errDel) {
        return { ok: false, error: errDel.message };
      }

      // Sincronizar nuevo mem_rol remanente
      const { data: mpList } = await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia_perfil")
        .select("seg_perfil(per_clave, per_nivel)")
        .eq("mpe_membresia_id", memExistente.mem_id);

      const perfilesOrdenados = ((mpList || []) as any[])
        .map((x) => x.seg_perfil)
        .filter(Boolean)
        .sort((a, b) => b.per_nivel - a.per_nivel);

      const rolRemanente = perfilesOrdenados[0]?.per_clave || "CLIENTE";

      await adminClient
        .schema("comun_seguridad")
        .from("seg_membresia")
        .update({
          mem_rol: rolRemanente,
          mem_actualizado_en: new Date().toISOString()
        })
        .eq("mem_id", memExistente.mem_id);

      revalidatePath("/panel/usuarios");
      revalidatePath("/panel/administrar");
      revalidatePath("/panel");
      return { ok: true, data: undefined };
    }
  } catch (errFallback: any) {
    console.warn("Aviso en fallback quitarPerfil:", errFallback);
    return { ok: false, error: errFallback?.message || error.message };
  }

  return { ok: false, error: error.message };
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
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim();

  // Resolver el UUID del widget si se pasó la clave textual
  let widgetUuid = widgetClave;
  const esUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(widgetClave);
  if (!esUuid) {
    const { data: wRow } = await supabase
      .schema("comun_seguridad")
      .from("seg_widget")
      .select("wdg_id")
      .eq("wdg_clave", widgetClave.toLowerCase().trim())
      .eq("wdg_negocio", negocioNorm)
      .maybeSingle();

    if (wRow?.wdg_id) {
      widgetUuid = wRow.wdg_id;
    }
  }

  if (asignar) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const payload: any = {
      rlw_rol: perfilClave.toUpperCase().trim(),
      rlw_widget_id: widgetUuid,
      rlw_negocio: negocioNorm,
      rlw_visible: true
    };

    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .upsert(payload, { onConflict: "rlw_negocio, rlw_rol, rlw_widget_id" });

    if (error) return { ok: false, error: error.message };
  } else {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await supabase
      .schema("comun_seguridad")
      .from("seg_rol_widget")
      .delete()
      .eq("rlw_rol", perfilClave.toUpperCase().trim())
      .eq("rlw_widget_id", widgetUuid)
      .eq("rlw_negocio", negocioNorm);

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
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (supabase
    .schema("comun_seguridad")
    .from("seg_rol_widget")
    .select("rlw_widget_id, seg_widget(wdg_clave, wdg_detalle_widget)") as any)
    .eq("rlw_rol", perfilClave.toUpperCase().trim())
    .eq("rlw_negocio", negocioNorm)
    .eq("rlw_visible", true);

  if (error) return { ok: false, error: error.message };

  const widgetsPorPanel: Record<string, string[]> = {};
  const panelesSet = new Set<string>(["panel_inicio", "panel_cuenta"]);

  if (data && Array.isArray(data) && data.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const r of data as any[]) {
      const widgetClave = r.seg_widget?.wdg_clave || r.rlw_widget_id;
      const detalle = (r.seg_widget?.wdg_detalle_widget as Record<string, unknown>) || {};
      const panelId = (detalle.panel_defecto as string) || "panel_configuracion";

      if (!widgetsPorPanel[panelId]) widgetsPorPanel[panelId] = [];
      if (widgetClave && !widgetsPorPanel[panelId].includes(widgetClave)) {
        widgetsPorPanel[panelId].push(widgetClave);
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

  const correo = user.email?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";

  const { data: uData } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_superadmin_plataforma")
    .eq("usu_id", user.id)
    .maybeSingle();

  const esSuperAdminPlataforma = Boolean(uData?.usu_superadmin_plataforma);

  const { data: perfilesData } = await supabase
    .schema("comun_seguridad")
    .rpc("seg_fn_perfiles", { p_negocio: negocio });

  const perfiles = (perfilesData as string[] | null) ?? [];
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfiles.includes("SUPERADMIN");

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
