import { crearClienteServidor } from "@eco/supabase/servidor";

export interface UsuarioConMembresia {
  usu_id: string;
  usu_nombres: string | null;
  usu_apellidos: string | null;
  usu_correo: string;
  mem_rol: string;
  mem_estado: string;
}

// Busca entre los usuarios ya registrados en un negocio (RLS solo deja ver
// a los que tienen membresia en un negocio donde el llamador es admin --
// PLT-003 regla 2: aislamiento por negocio).
export async function buscarUsuarios(
  consulta: string,
  negocio: string,
): Promise<{ data: UsuarioConMembresia[]; error: string | null }> {
  const supabase = await crearClienteServidor();

  const { data: membresias, error: errorMembresias } = await supabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_usuario_id, mem_rol, mem_estado")
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
    return { ...u, mem_rol: m.mem_rol, mem_estado: m.mem_estado };
  });

  return { data: resultado, error: null };
}
