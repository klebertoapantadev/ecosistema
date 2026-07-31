import { crearClienteServidor } from "@eco/supabase/servidor";

export interface UsuarioConMembresia {
  usu_id: string;
  usu_nombres: string | null;
  usu_apellidos: string | null;
  usu_correo: string;
  // PLT-003 regla 3: un usuario puede tener varios perfiles a la vez en el
  // mismo negocio, asi que esto es una lista, no un valor. Ordenada por nivel
  // descendente para que el mas alto se lea primero.
  perfiles: string[];
  nivelMaximo: number;
  mem_estado: string;
}

export interface PerfilAsignable {
  clave: string;
  nombre: string;
  nivel: number;
}

// Catalogo de perfiles asignables (PLT-003 regla 4). Excluye los no
// asignables: SUPERADMIN esta en la escala como techo, pero es un flag de
// plataforma, no un perfil de negocio.
export async function obtenerPerfilesAsignables(): Promise<PerfilAsignable[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_seguridad")
    .from("seg_perfil")
    .select("per_clave, per_nombre, per_nivel")
    .eq("per_activo", true)
    .eq("per_asignable", true)
    .order("per_nivel", { ascending: true });

  return (data ?? []).map((p) => ({ clave: p.per_clave, nombre: p.per_nombre, nivel: p.per_nivel }));
}

// Busca entre los usuarios ya registrados en un negocio (RLS solo deja ver
// a los que tienen membresia en un negocio donde el llamador es admin --
// PLT-003 regla 6: aislamiento por negocio).
export async function buscarUsuarios(
  consulta: string,
  negocio: string,
): Promise<{ data: UsuarioConMembresia[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  // Los perfiles se traen embebidos y no con una consulta por usuario: con 50
  // filas en pantalla, lo contrario serian 50 viajes extra a la base.
  const { data: membresias, error: errorMembresias } = await supabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_usuario_id, mem_estado, seg_membresia_perfil(seg_perfil(per_clave, per_nivel))")
    .eq("mem_negocio", negocio);

  if (errorMembresias) return { data: [], error: errorMembresias.message };
  if (!membresias || membresias.length === 0) return { data: [], error: null };

  const ids = membresias.map((m) => m.mem_usuario_id);

  let query = supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos, usu_correo")
    .in("usu_id", ids)
    .order("usu_creado_en", { ascending: false })
    .limit(50);

  const texto = consulta.trim();
  if (texto) {
    const escapado = texto.replace(/[%,]/g, "");
    query = query.or(
      `usu_nombres.ilike.%${escapado}%,usu_apellidos.ilike.%${escapado}%,usu_correo.ilike.%${escapado}%`,
    );
  }

  const { data: usuarios, error } = await query;
  if (error) return { data: [], error: error.message };

  const mapaMembresia = new Map(membresias.map((m) => [m.mem_usuario_id, m]));

  const resultado: UsuarioConMembresia[] = (usuarios ?? []).map((u) => {
    const m = mapaMembresia.get(u.usu_id)!;
    const perfiles = ((m.seg_membresia_perfil ?? []) as { seg_perfil: { per_clave: string; per_nivel: number } | null }[])
      .map((mp) => mp.seg_perfil)
      .filter((p): p is { per_clave: string; per_nivel: number } => p != null)
      .sort((a, b) => b.per_nivel - a.per_nivel);

    return {
      ...u,
      perfiles: perfiles.map((p) => p.per_clave),
      nivelMaximo: perfiles[0]?.per_nivel ?? 0,
      mem_estado: m.mem_estado,
    };
  });

  return { data: resultado, error: null };
}
