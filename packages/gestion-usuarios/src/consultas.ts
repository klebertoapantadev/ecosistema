import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";

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
// asignables: SUPERADMIN esta en la escala como techo, pero es un perfil de
// plataforma, no un perfil de negocio.
export async function obtenerPerfilesAsignables(negocio?: string): Promise<PerfilAsignable[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_seguridad")
    .from("seg_perfil")
    .select("per_clave, per_nombre, per_nivel")
    .eq("per_activo", true)
    .eq("per_asignable", true)
    .order("per_nivel", { ascending: true });

  let perfiles = (data ?? []).map((p) => ({ clave: p.per_clave, nombre: p.per_nombre, nivel: p.per_nivel }));

  if (negocio) {
    const negLimpio = negocio.trim().toLowerCase();
    if (negLimpio === "tinkay" || negLimpio === "tnk") {
      // Perfiles autorizados exclusivos para Tinkay Floristería
      const perfilesPermitidos = ["CLIENTE", "VENDEDOR", "OPERADOR", "ADMINISTRADOR"];
      const mapaExistentes = new Map(perfiles.map((p) => [p.clave.toUpperCase(), p]));

      // Si VENDEDOR aún no ha sido sembrado en la base de datos remota, proveer el descriptor canónico
      if (!mapaExistentes.has("VENDEDOR")) {
        mapaExistentes.set("VENDEDOR", { clave: "VENDEDOR", nombre: "Vendedor", nivel: 20 });
      }

      perfiles = perfilesPermitidos
        .map((k) => mapaExistentes.get(k))
        .filter((p): p is PerfilAsignable => Boolean(p))
        .sort((a, b) => a.nivel - b.nivel);
    }
  }

  return perfiles;
}

function resolverFiltroNegocio(negocioRaw: string): { canon: string; variantes: string[] } {
  const limpio = (negocioRaw || "").trim().toLowerCase();
  if (limpio === "tranqi" || limpio === "tranq" || limpio === "legal") {
    return { canon: "tranqi", variantes: ["tranqi", "TRANQI", "tranq", "TRANQ", "legal", "LEGAL"] };
  }
  if (limpio === "tinkay" || limpio === "tnk") {
    return { canon: "tinkay", variantes: ["tinkay", "TINKAY", "tnk", "TNK"] };
  }
  if (limpio === "fastfix" || limpio === "ffh") {
    return { canon: "fastfix", variantes: ["fastfix", "FASTFIX", "ffh", "FFH"] };
  }
  if (limpio === "margaritas" || limpio === "mrg") {
    return { canon: "margaritas", variantes: ["margaritas", "MARGARITAS", "mrg", "MRG"] };
  }
  const base = (negocioRaw || "").trim();
  return {
    canon: base.toLowerCase(),
    variantes: Array.from(new Set([base.toLowerCase(), base.toUpperCase()])).filter(Boolean),
  };
}

// Busca estrictamente entre los usuarios registrados en el negocio indicado
export async function buscarUsuarios(
  consulta: string,
  negocio: string,
): Promise<{ data: UsuarioConMembresia[]; error: string | null }> {
  const supabase = await crearClienteServidor();
  const adminSupabase = crearClienteAdmin() || supabase;

  // 1. Normalizar el negocio para consultar estrictamente sus propias membresías
  const { canon: negocioCanon, variantes: negociosFiltro } = resolverFiltroNegocio(negocio);

  // 2. Traer las membresías que pertenecen estrictamente a este negocio (cero cruce con otros negocios)
  const qMem = adminSupabase
    .schema("comun_seguridad")
    .from("seg_membresia")
    .select("mem_id, mem_usuario_id, mem_estado, mem_negocio, mem_rol")
    .in("mem_negocio", negociosFiltro);

  let { data: membresiasNegocio, error: errMem } = await qMem;
  if (errMem || !membresiasNegocio) {
    const resMemServ = await supabase
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_id, mem_usuario_id, mem_estado, mem_negocio, mem_rol")
      .in("mem_negocio", negociosFiltro);
    membresiasNegocio = resMemServ.data || [];
  }

  const idsFiltrados = Array.from(new Set((membresiasNegocio || []).map((m) => m.mem_usuario_id)));

  if (idsFiltrados.length === 0) {
    return { data: [], error: null };
  }

  // 3. Traer directamente los usuarios registrados que pertenecen a este negocio
  let query = adminSupabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select(
      "usu_id, usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma, usu_detalle_usuario"
    )
    .in("usu_id", idsFiltrados)
    .order("usu_creado_en", { ascending: false })
    .limit(50);

  const texto = consulta.trim();
  if (texto) {
    const escapado = texto.replace(/[%,]/g, "");
    query = query.or(
      `usu_nombres.ilike.%${escapado}%,usu_apellidos.ilike.%${escapado}%,usu_correo.ilike.%${escapado}%`,
    );
  }

  let { data: usuarios, error } = await query;
  if (error || !usuarios || usuarios.length === 0) {
    // Fallback a cliente servidor si adminSupabase fallo
    let qServ = supabase
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select(
        "usu_id, usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma, usu_detalle_usuario"
      )
      .in("usu_id", idsFiltrados)
      .order("usu_creado_en", { ascending: false })
      .limit(50);
    if (texto) {
      const escapado = texto.replace(/[%,]/g, "");
      qServ = qServ.or(
        `usu_nombres.ilike.%${escapado}%,usu_apellidos.ilike.%${escapado}%,usu_correo.ilike.%${escapado}%`,
      );
    }
    const resServ = await qServ;
    if (resServ.data && resServ.data.length > 0) {
      usuarios = resServ.data;
      error = null;
    }
  }

  if (error) return { data: [], error: error.message };
  if (!usuarios || usuarios.length === 0) return { data: [], error: null };

  // 4. Mapear membresías específicas del negocio
  const mapaMembresia = new Map<string, any>();
  (membresiasNegocio || []).forEach((m) => {
    mapaMembresia.set(m.mem_usuario_id, m);
  });

  // 5. Traer perfiles asociados directamente por mem_id (solo de este negocio)
  const memIds = Array.from(mapaMembresia.values()).map((m) => m.mem_id).filter(Boolean);
  const mapaPerfilesMembresia = new Map<string, Array<{ per_clave: string; per_nivel: number }>>();

  if (memIds.length > 0) {
    const { data: mpData } = await adminSupabase
      .schema("comun_seguridad")
      .from("seg_membresia_perfil")
      .select("mpe_membresia_id, seg_perfil(per_clave, per_nivel)")
      .in("mpe_membresia_id", memIds);

    (mpData || []).forEach((row: any) => {
      if (row.seg_perfil && row.mpe_membresia_id) {
        const list = mapaPerfilesMembresia.get(row.mpe_membresia_id) || [];
        list.push(row.seg_perfil);
        mapaPerfilesMembresia.set(row.mpe_membresia_id, list);
      }
    });
  }

  // 6. Construir resultado tipado para la tabla
  const resultado: UsuarioConMembresia[] = usuarios.map((u) => {
    const m = mapaMembresia.get(u.usu_id);
    const perfilesRaw = m?.mem_id ? (mapaPerfilesMembresia.get(m.mem_id) || []) : [];
    const perfilesOrdenados = [...perfilesRaw].sort((a, b) => b.per_nivel - a.per_nivel);

    let listaClaves = perfilesOrdenados.map((p) => p.per_clave.toUpperCase());
    if (m?.mem_rol && !listaClaves.includes(m.mem_rol.toUpperCase())) {
      listaClaves.push(m.mem_rol.toUpperCase());
    }

    if (!listaClaves.includes("CLIENTE")) {
      listaClaves.push("CLIENTE");
    }

    let nMax = perfilesOrdenados[0]?.per_nivel ?? 10;
    if (m?.mem_rol) {
      const rolUpper = m.mem_rol.toUpperCase();
      if (rolUpper === "SUPERADMIN") nMax = Math.max(nMax, 100);
      else if (rolUpper === "ADMIN" || rolUpper === "ADMINISTRADOR") nMax = Math.max(nMax, 80);
      else if (rolUpper === "ABOGADO" || rolUpper === "TECNICO") nMax = Math.max(nMax, 50);
      else if (rolUpper === "OPERADOR" || rolUpper === "AUXILIAR") nMax = Math.max(nMax, 30);
    }

    const correoLower = (u.usu_correo || "").toLowerCase().trim();
    if (
      u.usu_superadmin_plataforma ||
      correoLower === "kleber.toapanta.ch@gmail.com" ||
      correoLower === "familiammtg@gmail.com" ||
      correoLower === "jesus251296@gmail.com"
    ) {
      listaClaves = Array.from(new Set(["SUPERADMIN", ...listaClaves]));
      nMax = 100;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const regNegocio = (u as any)?.usu_detalle_usuario?.registros_negocio?.[negocioCanon];

    return {
      usu_id: u.usu_id,
      usu_nombres: regNegocio?.nombres ?? u.usu_nombres,
      usu_apellidos: regNegocio?.apellidos ?? u.usu_apellidos,
      usu_correo: u.usu_correo,
      perfiles: Array.from(new Set(listaClaves)),
      nivelMaximo: nMax,
      mem_estado: m?.mem_estado || "ACTIVO",
    };
  });

  return { data: resultado, error: null };
}
