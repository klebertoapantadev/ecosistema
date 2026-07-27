import { crearClienteServidor } from "@eco/supabase/servidor";

// Server-only. No importar desde un client component.

export async function obtenerSesionActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}

export async function obtenerPerfilActual() {
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data: perfil } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("*")
    .eq("usu_id", user.id)
    .maybeSingle();

  return perfil;
}

export async function obtenerMembresia(usuarioId: string, negocio: string) {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("*")
    .eq("mem_usuario_id", usuarioId)
    .eq("mem_negocio", negocio)
    .maybeSingle();

  return data;
}

// PLT-011: que widgets ve el usuario actual en un negocio. SUPERADMIN (flag
// de plataforma) ve todos sin necesidad de fila en seg_rol_widget.
export async function obtenerWidgetsVisibles(usuarioId: string, esSuperadmin: boolean, negocio: string) {
  const supabase = await crearClienteServidor();

  if (esSuperadmin) {
    const { data } = await supabase
      .schema("comun_seguridad")
      .from("seg_widget")
      .select("wdg_clave, wdg_nombre")
      .eq("wdg_negocio", negocio)
      .eq("wdg_activo", true);
    return data ?? [];
  }

  const membresia = await obtenerMembresia(usuarioId, negocio);
  if (!membresia) return [];

  const { data: asignaciones } = await supabase
    .schema("comun_seguridad")
    .from("seg_rol_widget")
    .select("rlw_widget_id")
    .eq("rlw_negocio", negocio)
    .eq("rlw_rol", membresia.mem_rol)
    .eq("rlw_visible", true);

  if (!asignaciones || asignaciones.length === 0) return [];

  const { data: widgets } = await supabase
    .schema("comun_seguridad")
    .from("seg_widget")
    .select("wdg_clave, wdg_nombre")
    .in(
      "wdg_id",
      asignaciones.map((a) => a.rlw_widget_id),
    )
    .eq("wdg_activo", true);

  return widgets ?? [];
}
