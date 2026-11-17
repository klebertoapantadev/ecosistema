"use server";

import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { normalizarIdentificadorNegocio } from "./utils/negocio";
import {
  construirMapaSemillasIdSlugPorNegocio,
  filtrarCampanasPorNegocioYCriterios,
  normalizarNegocioCampana,
  obtenerSemillasCampanasPorNegocio,
  perteneceCampanaANegocio,
  type AudienciaInformativo,
  type CampanaInformativa,
  type DetalleInformativo,
  type TipoInformativo,
  type UbicacionInformativo,
} from "./utils/informativos";

export type {
  AudienciaInformativo,
  CampanaInformativa,
  DetalleInformativo,
  TipoInformativo,
  UbicacionInformativo,
};

// Almacenamiento en memoria estrictamente particionado por negocio
const cacheCampanasMemoria: Record<string, CampanaInformativa[]> = {
  tranqi: obtenerSemillasCampanasPorNegocio("tranqi"),
};

const eliminadosMemoria: Record<string, Set<string>> = {
  tranqi: new Set<string>(),
};

function esUuidValido(v?: string | null): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

function mapearFilaCampana(d: any, negocioPorDefecto: string): CampanaInformativa {
  return {
    inf_id: d.inf_id,
    inf_negocio: normalizarNegocioCampana(d.inf_negocio || negocioPorDefecto),
    inf_titulo: d.inf_titulo,
    inf_slug: d.inf_slug,
    inf_subtitulo: d.inf_subtitulo,
    inf_contenido_md: d.inf_contenido_md,
    inf_tipo: d.inf_tipo,
    inf_audiencia: Array.isArray(d.inf_audiencia) ? d.inf_audiencia : ["TODOS"],
    inf_ubicaciones: Array.isArray(d.inf_ubicaciones) ? d.inf_ubicaciones : ["PANEL_INICIO"],
    inf_fecha_inicio: d.inf_fecha_inicio,
    inf_fecha_fin: d.inf_fecha_fin,
    inf_activo: d.inf_activo !== false,
    inf_prioridad: d.inf_prioridad || "MEDIA",
    inf_detalle: d.inf_detalle || {},
    inf_creado_en: d.inf_creado_en,
    inf_actualizado_en: d.inf_actualizado_en,
  };
}

/**
 * Obtiene las campañas informativas activas y vigentes aisladas estrictamente por negocio.
 * Exclusivo para usuarios registrados con sesión autenticada activa.
 */
export async function obtenerCampanasInformativasAction(params: {
  negocio?: string;
  audiencia?: AudienciaInformativo | "TODOS";
  ubicacion?: UbicacionInformativo;
  tipo?: TipoInformativo;
  incluirInactivos?: boolean;
}): Promise<CampanaInformativa[]> {
  const { principal: negocio, variantes } = normalizarIdentificadorNegocio(params.negocio);
  const { audiencia, ubicacion, tipo, incluirInactivos = false } = params;

  // Verificar que el solicitante sea un usuario registrado (sesión autenticada)
  let clienteSesion: any = null;
  try {
    clienteSesion = await crearClienteServidor();
    const { data: authData } = await clienteSesion.auth.getUser();
    if (!authData?.user) {
      return [];
    }
  } catch {
    return [];
  }

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    cliente = clienteSesion;
  }

  const setEliminados = eliminadosMemoria[negocio] || new Set<string>();

  if (cliente) {
    try {
      // 1. Intentar vía RPC dedicada filtrada por negocio
      const { data: dataRpc, error: errorRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_obtener_campanas_informativas", {
          p_negocio: negocio,
          p_audiencia: audiencia || "TODOS",
          p_tipo: tipo || null,
          p_incluir_inactivos: incluirInactivos,
        });

      if (!errorRpc && Array.isArray(dataRpc)) {
        const mapeados = dataRpc
          .filter((d: any) => perteneceCampanaANegocio(d, negocio))
          .map((d: any) => mapearFilaCampana(d, negocio));

        // Si el negocio tiene registros en BD o no tiene semillas (tinkay/margaritas/fastfix),
        // la respuesta de BD (incluso []) es autoritativa y jamás cae en semillas de otro negocio.
        const semillasPropias = obtenerSemillasCampanasPorNegocio(negocio);
        if (mapeados.length > 0 || semillasPropias.length === 0) {
          cacheCampanasMemoria[negocio] = mapeados;
          return filtrarCampanasPorNegocioYCriterios({
            campanas: mapeados,
            negocio,
            audiencia,
            ubicacion,
            tipo,
            incluirInactivos,
            eliminados: setEliminados,
          });
        }
      }

      // 2. Fallback a consulta directa de tabla filtrando estrictamente por inf_negocio
      let query = cliente
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .select("*")
        .in("inf_negocio", variantes)
        .order("inf_prioridad", { ascending: false })
        .order("inf_fecha_inicio", { ascending: false });

      if (!incluirInactivos) {
        query = query.eq("inf_activo", true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data)) {
        const mapeados = data
          .filter((d: any) => perteneceCampanaANegocio(d, negocio))
          .map((d: any) => mapearFilaCampana(d, negocio));

        const semillasPropias = obtenerSemillasCampanasPorNegocio(negocio);
        if (mapeados.length > 0 || semillasPropias.length === 0) {
          cacheCampanasMemoria[negocio] = mapeados;
        }
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error consultando com_campana_informativa:", err);
    }
  }

  // 3. Fallback en memoria estrictamente aislado por negocio (nunca cruza negocios)
  const base = cacheCampanasMemoria[negocio] ?? obtenerSemillasCampanasPorNegocio(negocio);

  return filtrarCampanasPorNegocioYCriterios({
    campanas: base,
    negocio,
    audiencia,
    ubicacion,
    tipo,
    incluirInactivos,
    eliminados: setEliminados,
  });
}

/**
 * Guarda o actualiza una campaña informativa en base de datos y memoria del negocio correspondiente
 */
export async function guardarCampanaInformativaAction(
  datos: Partial<CampanaInformativa> & { inf_negocio?: string }
): Promise<{ ok: boolean; campana?: CampanaInformativa; error?: string }> {
  const negocio = normalizarNegocioCampana(datos.inf_negocio);
  const titulo = datos.inf_titulo?.trim();

  if (!titulo) {
    return { ok: false, error: "El título de la campaña o aviso es obligatorio." };
  }

  const slug =
    datos.inf_slug?.trim() ||
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const id = datos.inf_id || `inf-${Date.now()}`;
  const nuevaCampana: CampanaInformativa = {
    inf_id: id,
    inf_negocio: negocio,
    inf_titulo: titulo,
    inf_slug: slug,
    inf_subtitulo: datos.inf_subtitulo || null,
    inf_contenido_md: datos.inf_contenido_md || null,
    inf_tipo: datos.inf_tipo || "COMUNICADO_GENERAL",
    inf_audiencia:
      Array.isArray(datos.inf_audiencia) && datos.inf_audiencia.length > 0
        ? datos.inf_audiencia
        : ["TODOS"],
    inf_ubicaciones:
      Array.isArray(datos.inf_ubicaciones) && datos.inf_ubicaciones.length > 0
        ? datos.inf_ubicaciones
        : ["PANEL_INICIO"],
    inf_fecha_inicio: datos.inf_fecha_inicio || new Date().toISOString(),
    inf_fecha_fin: datos.inf_fecha_fin || null,
    inf_activo: datos.inf_activo !== false,
    inf_prioridad: datos.inf_prioridad || "MEDIA",
    inf_detalle: datos.inf_detalle || {},
    inf_actualizado_en: new Date().toISOString(),
  };

  if (eliminadosMemoria[negocio]) {
    eliminadosMemoria[negocio].delete(id);
    eliminadosMemoria[negocio].delete(slug);
  }

  // 1. Guardar en memoria aislada por negocio
  const lista = (cacheCampanasMemoria[negocio] ?? obtenerSemillasCampanasPorNegocio(negocio)).filter(
    (c) => perteneceCampanaANegocio(c, negocio)
  );
  const idx = lista.findIndex((c) => c.inf_id === id || c.inf_slug === slug);
  if (idx >= 0) {
    lista[idx] = nuevaCampana;
  } else {
    lista.unshift(nuevaCampana);
  }
  cacheCampanasMemoria[negocio] = lista;

  // 2. Persistir en PostgreSQL
  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente) {
    try {
      const payloadRpc: any = {
        inf_negocio: negocio,
        inf_titulo: nuevaCampana.inf_titulo,
        inf_slug: nuevaCampana.inf_slug,
        inf_subtitulo: nuevaCampana.inf_subtitulo,
        inf_contenido_md: nuevaCampana.inf_contenido_md,
        inf_tipo: nuevaCampana.inf_tipo,
        inf_audiencia: nuevaCampana.inf_audiencia,
        inf_ubicaciones: nuevaCampana.inf_ubicaciones,
        inf_fecha_inicio: nuevaCampana.inf_fecha_inicio,
        inf_fecha_fin: nuevaCampana.inf_fecha_fin,
        inf_activo: nuevaCampana.inf_activo,
        inf_prioridad: nuevaCampana.inf_prioridad,
        inf_detalle: nuevaCampana.inf_detalle,
      };

      if (esUuidValido(id)) {
        payloadRpc.inf_id = id;
      }

      const { data: resRpc, error: errRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_guardar_campana_informativa", { p_campana: payloadRpc });

      if (!errRpc && resRpc?.ok && resRpc.campana) {
        nuevaCampana.inf_id = resRpc.campana.inf_id;
        return { ok: true, campana: nuevaCampana };
      }

      // 2.2 Fallback directo a tabla com_campana_informativa
      const payloadTabla: any = { ...payloadRpc };
      if (esUuidValido(id)) {
        payloadTabla.inf_id = id;
      }
      payloadTabla.inf_actualizado_en = new Date().toISOString();

      const { data, error } = await cliente
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .upsert(payloadTabla, { onConflict: "inf_negocio,inf_slug" })
        .select()
        .single();

      if (error) {
        console.error("[@eco/comercio] Error en upsert com_campana_informativa:", error);
      } else if (data) {
        nuevaCampana.inf_id = data.inf_id;
      }
    } catch (err: any) {
      console.error("[@eco/comercio] Error persistiendo campaña en Supabase:", err);
    }
  }

  return { ok: true, campana: nuevaCampana };
}

/**
 * Conmuta el estado activo/inactivo de una campaña informativa dentro de su negocio
 */
export async function alternarActivoCampanaAction(
  negocio = "tranqi",
  infId: string,
  nuevoActivo?: boolean
): Promise<{ ok: boolean; inf_activo: boolean; error?: string }> {
  const negocioNorm = normalizarNegocioCampana(negocio);
  const lista = (
    cacheCampanasMemoria[negocioNorm] ?? obtenerSemillasCampanasPorNegocio(negocioNorm)
  ).filter((c) => perteneceCampanaANegocio(c, negocioNorm));

  const item = lista.find((c) => c.inf_id === infId || c.inf_slug === infId);
  const estadoFinal = typeof nuevoActivo === "boolean" ? nuevoActivo : !(item?.inf_activo ?? true);

  if (item) {
    item.inf_activo = estadoFinal;
    item.inf_actualizado_en = new Date().toISOString();
    cacheCampanasMemoria[negocioNorm] = lista;
  }

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente && infId) {
    try {
      const { data: resRpc, error: errRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_alternar_activo_campana", {
          p_negocio: negocioNorm,
          p_id_o_slug: infId,
          p_activo: estadoFinal,
        });

      if (!errRpc && resRpc?.ok) {
        return { ok: true, inf_activo: estadoFinal };
      }

      if (esUuidValido(infId)) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .update({ inf_activo: estadoFinal, inf_actualizado_en: new Date().toISOString() })
          .eq("inf_negocio", negocioNorm)
          .eq("inf_id", infId);
      } else {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .update({ inf_activo: estadoFinal, inf_actualizado_en: new Date().toISOString() })
          .eq("inf_negocio", negocioNorm)
          .eq("inf_slug", infId);
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error actualizando inf_activo en PostgreSQL:", err);
    }
  }

  return { ok: true, inf_activo: estadoFinal };
}

/**
 * Elimina una campaña informativa de base de datos y memoria del negocio correspondiente
 */
export async function eliminarCampanaInformativaAction(
  negocio = "tranqi",
  infId: string,
  infSlug?: string,
  infTitulo?: string
): Promise<{ ok: boolean; error?: string }> {
  const negocioNorm = normalizarNegocioCampana(negocio);
  if (!eliminadosMemoria[negocioNorm]) {
    eliminadosMemoria[negocioNorm] = new Set<string>();
  }

  const mapaIdASlug = construirMapaSemillasIdSlugPorNegocio(negocioNorm);
  const slugMapeado = mapaIdASlug[infId] || infSlug;
  eliminadosMemoria[negocioNorm].add(infId);
  if (slugMapeado) eliminadosMemoria[negocioNorm].add(slugMapeado);
  if (infSlug) eliminadosMemoria[negocioNorm].add(infSlug);
  if (infTitulo) eliminadosMemoria[negocioNorm].add(infTitulo);

  const lista = cacheCampanasMemoria[negocioNorm] || [];
  cacheCampanasMemoria[negocioNorm] = lista.filter(
    (c) =>
      perteneceCampanaANegocio(c, negocioNorm) &&
      c.inf_id !== infId &&
      c.inf_slug !== infId &&
      c.inf_slug !== slugMapeado &&
      (!infSlug || c.inf_slug !== infSlug) &&
      (!infTitulo || c.inf_titulo !== infTitulo)
  );

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente) {
    try {
      await cliente
        .schema("comun_comercio")
        .rpc("com_fn_eliminar_campana_informativa", {
          p_negocio: negocioNorm,
          p_id_o_slug: infId,
        });

      if (esUuidValido(infId)) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_negocio", negocioNorm)
          .eq("inf_id", infId);
      }

      const slugsABorrar = Array.from(
        new Set([infId, slugMapeado, infSlug].filter(Boolean))
      ) as string[];
      for (const s of slugsABorrar) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_negocio", negocioNorm)
          .eq("inf_slug", s);
      }

      if (infTitulo) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_negocio", negocioNorm)
          .eq("inf_titulo", infTitulo);
      }
    } catch (err: any) {
      console.warn("[@eco/comercio] Error eliminando campaña en PostgreSQL:", err);
    }
  }

  return { ok: true };
}

/**
 * Restaura el conjunto de campañas informativas de ejemplo exclusivas del negocio solicitado
 */
export async function restaurarCampanasEjemploAction(
  negocio = "tranqi"
): Promise<{ ok: boolean; total: number }> {
  const negocioNorm = normalizarNegocioCampana(negocio);
  if (eliminadosMemoria[negocioNorm]) {
    eliminadosMemoria[negocioNorm].clear();
  }

  const semillasNegocio = obtenerSemillasCampanasPorNegocio(negocioNorm);
  cacheCampanasMemoria[negocioNorm] = [...semillasNegocio];

  for (const s of semillasNegocio) {
    await guardarCampanaInformativaAction({ ...s, inf_negocio: negocioNorm });
  }

  return { ok: true, total: semillasNegocio.length };
}
