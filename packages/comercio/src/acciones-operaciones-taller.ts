"use server";

import { revalidatePath } from "next/cache";
import {
  COLORES_ROSAS_ESTANDAR,
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  combinarUsosConInferidos,
  esNombreFallecidoPendiente,
  extraerConteoJsonDesdeRespuestaAria,
  inferirClasificacionPedido,
  inferirUsosEntregaInmediata,
  normalizarConfigTvTaller,
  normalizarFranjaHorariaTienda,
  obtenerFechaHoyEcuadorYmd,
  type ArregloEntregaInmediata,
  type ClasificacionOperativaPedido,
  type ConfiguracionTvTaller,
  type ConvenioEntregaConfig,
  type CorteInventarioRosas,
  type DatosProveedorInformeIess,
  type DatosTableroTvTaller,
  type DefinicionColorRosa,
  type DisenoVisualTarjeta,
  type EmisoraRadioTv,
  type EstadoOrdenTaller,
  type EstadoPedidoConfig,
  type FotoConteoBonches,
  esEstadoVisibleEnTaller,
  type InformeQuincenalEntregas,
  type ItemOrdenTaller,
  type OrdenTrabajoTaller,
  type OrdenTvTaller,
  type OrigenOrdenTaller,
  type PedidoPendienteConfirmacion,
  type ProductoEventoTv,
  type ProductoLigeroSelectorTaller,
  type RegistroEntregaEvidencia,
  type RepartidorDisponibleNegocio,
  type TipoOrigenEntrega,
} from "./operaciones-taller";
import {
  CATALOGO_SEMILLA_VARIEDADES_ROSAS,
  obtenerVariedadDefectoPorColor,
  resolverVariedadDesdeCatalogo,
  type ItemConteoVariedad,
  type VariedadRosaCatalogo,
} from "./catalogo-variedades-rosas";
import { normalizarIdentificadorNegocio } from "./utils/negocio";
import {
  parsearMensajePedidoDeterministico,
  type ResultadoParseoPedidoAria,
} from "./utils/parsearPedidoAria";
import {
  generarTokenEdicionTarjetaServidor,
  verificarTokenEdicionTarjetaServidor,
} from "./token-orden-firmada";

function normalizarNegocio(negocio?: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}

function esErrorMigracionPendiente(msg?: string | null): boolean {
  const m = String(msg ?? "").toLowerCase();
  return (
    m.includes("com_fn_") ||
    m.includes("com_orden_taller") ||
    m.includes("could not find the function") ||
    m.includes("pgrst202") ||
    m.includes("does not exist")
  );
}

async function invocarRpcComercio(
  supabase: any,
  fnNombre: string,
  params: Record<string, any>
): Promise<{ data: any; error: any }> {
  try {
    const esquema = supabase.schema("comun_comercio") as any;
    const res = await esquema.rpc(fnNombre, params);
    if (!res.error) {
      return res;
    }
    // Fallback: llamada directa sin header de schema (por si PostgREST resuelve por search_path)
    const resDirecto = await supabase.rpc(fnNombre, params);
    if (!resDirecto.error) {
      return resDirecto;
    }
    return res;
  } catch (err: any) {
    try {
      const resDirecto = await supabase.rpc(fnNombre, params);
      return resDirecto;
    } catch {
      return { data: null, error: err };
    }
  }
}

function revalidarRutasTienda(negocio: string) {
  try {
    revalidatePath("/");
    revalidatePath("/categoria/entrega-inmediata");
    revalidatePath("/categoria/condolencias");
    revalidatePath("/panel/catalogo-productos");
    revalidatePath("/panel/entrega-inmediata");
    revalidatePath("/panel/inventario-rosas");
    revalidatePath("/panel/entregas");
    revalidatePath("/panel/envio-pedidos");
    revalidatePath("/panel/taller");
    revalidatePath("/panel/pedidos");
    revalidatePath("/panel/conversaciones");
    void negocio;
  } catch {
    // Ignorar fuera de contexto de request Next.js (ej. tests unitarios)
  }
}

// =============================================================================
// 1. INVENTARIO FOTOGRÁFICO DE ROSAS CON VISIÓN IA (ARIA)
// =============================================================================

export async function obtenerInventarioRosasAction(negocio: string): Promise<
  | {
      ok: true;
      ultimoCorte: CorteInventarioRosas | null;
      historial: CorteInventarioRosas[];
      migracionPendiente?: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_inventario_rosas",
      { p_negocio: neg }
    );

    if (!error && data?.ok) {
      return {
        ok: true,
        ultimoCorte: (data.ultimoCorte as CorteInventarioRosas | null) ?? null,
        historial: Array.isArray(data.historial) ? (data.historial as CorteInventarioRosas[]) : [],
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      ultimoCorte: null,
      historial: [],
      migracionPendiente: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al consultar inventario de rosas",
    };
  }
}

async function asegurarCatalogoVariedadesInicializado(
  supabase: any,
  neg: string
): Promise<{
  ok: true;
  items: VariedadRosaCatalogo[];
  desdeSemilla?: boolean;
  migracionPendiente?: boolean;
} | { ok: false; error: string }> {
  const { data, error } = await invocarRpcComercio(
    supabase,
    "com_fn_listar_variedades_rosa",
    { p_negocio: neg }
  );

  if (error) {
    if (esErrorMigracionPendiente(error.message)) {
      return {
        ok: true,
        items: CATALOGO_SEMILLA_VARIEDADES_ROSAS,
        desdeSemilla: true,
        migracionPendiente: true,
      };
    }
    return { ok: false, error: error.message };
  }

  if (data && data.ok === false) {
    return { ok: false, error: String(data.error || "Acceso no autorizado") };
  }

  const existentes = Array.isArray(data?.items) ? (data.items as VariedadRosaCatalogo[]) : [];
  if (existentes.length > 0) {
    return { ok: true, items: existentes, desdeSemilla: false };
  }

  // Sembrar automáticamente las variedades Floraroma en la BDD para este negocio
  const { data: dataInit, error: errInit } = await invocarRpcComercio(
    supabase,
    "com_fn_inicializar_variedades_rosa",
    {
      p_negocio: neg,
      p_variedades: CATALOGO_SEMILLA_VARIEDADES_ROSAS.map((v) => ({
        colorClave: v.colorClave,
        nombre: v.nombre,
        imagenUrl: v.imagenUrl,
        esDefecto: v.esDefecto,
        orden: v.orden,
        esPersonalizada: false,
      })),
    }
  );

  if (!errInit && dataInit?.ok && Array.isArray(dataInit.items) && dataInit.items.length > 0) {
    return { ok: true, items: dataInit.items as VariedadRosaCatalogo[], desdeSemilla: false };
  }

  return { ok: true, items: CATALOGO_SEMILLA_VARIEDADES_ROSAS, desdeSemilla: true };
}

async function leerCategoriasColoresRosasConfig(
  supabase: any,
  negocio: string
): Promise<DefinicionColorRosa[]> {
  try {
    const { crearClienteAdmin } = await import("@eco/supabase/servidor");
    const db: any = crearClienteAdmin() ?? supabase;
    const { data } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();

    const overrides = (data?.cfg_detalle_configuracion?.categorias_colores_rosas ?? {}) as Record<
      string,
      { etiqueta?: string; colorHex?: string }
    >;

    return COLORES_ROSAS_ESTANDAR.map((c) => {
      const ov = overrides[c.clave];
      if (!ov) return c;
      return {
        ...c,
        etiqueta: ov.etiqueta?.trim() || c.etiqueta,
        colorHex: ov.colorHex?.trim() || c.colorHex,
      };
    });
  } catch {
    return COLORES_ROSAS_ESTANDAR;
  }
}

export async function listarVariedadesRosaAction(negocio: string): Promise<
  | {
      ok: true;
      items: VariedadRosaCatalogo[];
      categoriasColores: DefinicionColorRosa[];
      migracionPendiente?: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const [res, categoriasColores] = await Promise.all([
      asegurarCatalogoVariedadesInicializado(supabase, neg),
      leerCategoriasColoresRosasConfig(supabase, neg),
    ]);
    if (!res.ok) return res;
    return {
      ok: true,
      items: res.items,
      categoriasColores,
      migracionPendiente: res.migracionPendiente,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar el catálogo de variedades",
    };
  }
}

export async function actualizarCategoriaColorRosaAction(entrada: {
  negocio: string;
  clave: string;
  etiqueta: string;
  colorHex?: string;
}): Promise<{ ok: true; categoriasColores: DefinicionColorRosa[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const claveLimpia = entrada.clave.trim().toLowerCase();
    const etiquetaLimpia = entrada.etiqueta.trim();
    if (!claveLimpia || !etiquetaLimpia) {
      return { ok: false, error: "Escribe el nuevo nombre de la categoría." };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Debes iniciar sesión para editar categorías." };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const { data: cfgActual, error: errRead } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", neg)
      .maybeSingle();

    if (errRead) return { ok: false, error: errRead.message };

    const detPrevio = (cfgActual?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
    const catPrevias = (detPrevio.categorias_colores_rosas ?? {}) as Record<string, any>;
    const nuevasCat = {
      ...catPrevias,
      [claveLimpia]: {
        ...(catPrevias[claveLimpia] ?? {}),
        etiqueta: etiquetaLimpia,
        ...(entrada.colorHex?.trim() ? { colorHex: entrada.colorHex.trim() } : {}),
      },
    };

    const { error: errUpd } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrevio,
          categorias_colores_rosas: nuevasCat,
        },
        cfg_actualizado_en: new Date().toISOString(),
      })
      .eq("cfg_negocio", neg);

    if (errUpd) return { ok: false, error: errUpd.message };

    const categoriasColores = await leerCategoriasColoresRosasConfig(supabase, neg);
    revalidarRutasTienda(neg);
    return { ok: true, categoriasColores };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar la categoría",
    };
  }
}

export async function guardarVariedadRosaAction(entrada: {
  negocio: string;
  colorClave: string;
  nombre: string;
  imagenUrl?: string;
  esDefecto?: boolean;
  id?: string | null;
}): Promise<{ ok: true; item: VariedadRosaCatalogo; items: VariedadRosaCatalogo[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const init = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    if (!init.ok) return init;
    if (init.migracionPendiente) {
      return {
        ok: false,
        error:
          "Ejecuta la migración 20261119000005_catalogo_variedades_rosas_floraroma.sql en Supabase para guardar cambios del catálogo.",
      };
    }

    const uuidValido =
      entrada.id && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(entrada.id)
        ? entrada.id
        : null;

    const { data, error } = await invocarRpcComercio(supabase, "com_fn_guardar_variedad_rosa", {
      p_negocio: neg,
      p_color_clave: entrada.colorClave,
      p_nombre: entrada.nombre,
      p_imagen_url: entrada.imagenUrl ?? null,
      p_es_defecto: Boolean(entrada.esDefecto),
      p_id: uuidValido,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: String(data?.error || "No se pudo guardar la variedad") };

    const lista = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    revalidarRutasTienda(neg);
    return {
      ok: true,
      item: data.item as VariedadRosaCatalogo,
      items: lista.ok ? lista.items : init.items,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar variedad",
    };
  }
}

export async function definirVariedadDefectoAction(entrada: {
  negocio: string;
  colorClave: string;
  variedadId: string;
}): Promise<{ ok: true; items: VariedadRosaCatalogo[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const init = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    if (!init.ok) return init;
    if (init.migracionPendiente) {
      return {
        ok: false,
        error:
          "Ejecuta la migración 20261119000005_catalogo_variedades_rosas_floraroma.sql en Supabase para guardar la variedad por defecto.",
      };
    }

    const { data, error } = await invocarRpcComercio(supabase, "com_fn_definir_variedad_defecto", {
      p_negocio: neg,
      p_color_clave: entrada.colorClave,
      p_variedad_id: entrada.variedadId,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo actualizar la variedad por defecto") };
    }

    const lista = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    revalidarRutasTienda(neg);
    return { ok: true, items: lista.ok ? lista.items : init.items };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al definir variedad por defecto",
    };
  }
}

export async function eliminarVariedadRosaAction(entrada: {
  negocio: string;
  variedadId: string;
}): Promise<{ ok: true; items: VariedadRosaCatalogo[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const init = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    if (!init.ok) return init;
    if (init.migracionPendiente) {
      return {
        ok: false,
        error:
          "Ejecuta la migración 20261119000005_catalogo_variedades_rosas_floraroma.sql en Supabase para eliminar variedades.",
      };
    }

    const { data, error } = await invocarRpcComercio(supabase, "com_fn_eliminar_variedad_rosa", {
      p_negocio: neg,
      p_variedad_id: entrada.variedadId,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) return { ok: false, error: String(data?.error || "No se pudo eliminar la variedad") };

    const lista = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    revalidarRutasTienda(neg);
    return { ok: true, items: lista.ok ? lista.items : init.items };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al eliminar variedad",
    };
  }
}

export async function eliminarVariedadesRosaLoteAction(entrada: {
  negocio: string;
  variedadIds: string[];
}): Promise<
  | { ok: true; items: VariedadRosaCatalogo[]; eliminadas: number }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const idsLimpios = Array.from(
      new Set(
        (entrada.variedadIds || []).filter((id) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ""))
        )
      )
    );
    if (idsLimpios.length === 0) {
      return { ok: false, error: "Selecciona al menos una variedad guardada para eliminar." };
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const init = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    if (!init.ok) return init;
    if (init.migracionPendiente) {
      return {
        ok: false,
        error:
          "Ejecuta la migración 20261119000005_catalogo_variedades_rosas_floraroma.sql en Supabase para eliminar variedades.",
      };
    }

    const resultados = await Promise.all(
      idsLimpios.map((variedadId) =>
        invocarRpcComercio(supabase, "com_fn_eliminar_variedad_rosa", {
          p_negocio: neg,
          p_variedad_id: variedadId,
        })
      )
    );

    const primerFallo = resultados.find((r) => r.error || r.data?.ok === false);
    if (primerFallo) {
      return {
        ok: false,
        error: String(
          primerFallo.error?.message ||
            primerFallo.data?.error ||
            "No se pudieron eliminar las variedades seleccionadas."
        ),
      };
    }

    const lista = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    revalidarRutasTienda(neg);
    return {
      ok: true,
      items: lista.ok ? lista.items : init.items,
      eliminadas: idsLimpios.length,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al eliminar variedades",
    };
  }
}

export async function analizarFotoBonchesConAriaAction(
  negocio: string,
  imagenUrl: string
): Promise<
  | {
      ok: true;
      conteoColores: Record<string, number>;
      itemsVariedad: ItemConteoVariedad[];
      notaIa?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const urlLimpia = String(imagenUrl || "").trim();
    if (!/^https?:\/\//i.test(urlLimpia)) {
      return {
        ok: false,
        error: "La imagen debe tener una URL pública o firmada accesible para ARIA.",
      };
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { session },
    } = await supabase.auth.getSession();

    const catRes = await asegurarCatalogoVariedadesInicializado(supabase, neg);
    const catalogo = catRes.ok ? catRes.items : CATALOGO_SEMILLA_VARIEDADES_ROSAS;

    const defectoTexto = (clave: string) =>
      obtenerVariedadDefectoPorColor(catalogo, clave)?.nombre ?? clave;

    const { invocarAgentePorNegocio } = await import("@eco/agentes-ia");

    const promptVision =
      "[MODO_OPERATIVO_INVENTARIO] NO saludes, NO vendas ni uses herramientas de catálogo.\n" +
      "Eres un contador visual experto en floristería ecuatoriana (rosas seleccionadas estándar Floraroma y orquídeas Cymbidium).\n" +
      "PRIMERO identifica qué aparece en la fotografía: paquetes/bonches de ROSAS, varas de ORQUÍDEA / CYMBIDIUM, o ambos.\n" +
      "A) SI HAY PAQUETES/BONCHES DE ROSAS (~25 tallos envueltos en cartón, papel o caja):\n" +
      "   1. Recorre la foto fila por fila (arriba→abajo, izquierda→derecha) contando CADA paquete completo (NO tallos sueltos).\n" +
      "   2. Usa ÚNICAMENTE estas 11 claves de color exactas:\n" +
      `      rojo (${defectoTexto("rojo")}), blanco (${defectoTexto("blanco")}), rosado (${defectoTexto("rosado")}), fucsia (${defectoTexto("fucsia")}), amarillo (${defectoTexto("amarillo")}), durazno (${defectoTexto("durazno")}), naranja (${defectoTexto("naranja")}), lavanda (${defectoTexto("lavanda")}), novedad (${defectoTexto("novedad")}), tinturado (${defectoTexto("tinturado")}), verde (${defectoTexto("verde")}).\n` +
      "   3. Si reconoces una variedad exacta (ej. Explorer, Freedom, Mondial, Vendela, Frutteto, Pink Floyd, Kahala, Brighton, Cool Water), indícala en variedad; si no, déjala vacía.\n" +
      "B) SI HAY ORQUÍDEAS / CYMBIDIUM (varas con varias flores/campanas en celofán o florero):\n" +
      "   1. Identifica su color (amarillo, blanco, verde, rosado, vino, crema, naranja, bicolor).\n" +
      "   2. Cuenta cuántas VARAS hay (`varas`) y con mucha precisión cuántas FLORES/CAMPANAS individuales tiene en total (`numero_flores`).\n" +
      'Responde ÚNICAMENTE con un objeto JSON válido sin texto extra ni markdown: {"colores": {"rojo": 0}, "variedades": [{"tipo": "rosa", "color": "rojo", "variedad": "", "cantidad": 0}], "orquideas": [{"color": "amarillo", "variedad": "Cymbidium Amarillo", "varas": 1, "numero_flores": 9}], "nota": "resumen breve en 1 línea"}. Omite arreglos vacíos o valores 0.';

    const respuesta = await invocarAgentePorNegocio(neg, promptVision, {
      imageUrls: [urlLimpia],
      accessToken: session?.access_token,
      tiempoMaximoMs: 55000,
    });

    const extraido = extraerConteoJsonDesdeRespuestaAria(respuesta.response);

    // Mapear cada detección a una variedad del catálogo (cayendo en la variedad por defecto si no se identificó específicamente)
    const mapaItems = new Map<string, ItemConteoVariedad>();

    if (extraido.variedadesDetectadas && extraido.variedadesDetectadas.length > 0) {
      for (const det of extraido.variedadesDetectadas) {
        const esOrq = det.tipoFlor === "orquidea";
        if (esOrq) {
          const nombreOrq =
            det.variedad?.trim() ||
            `Cymbidium ${det.colorClave.charAt(0).toUpperCase()}${det.colorClave.slice(1)}`;
          const claveUnica = `orquidea::${det.colorClave}::${nombreOrq.toLowerCase()}`;
          const prev = mapaItems.get(claveUnica);
          if (prev) {
            prev.cantidad += det.cantidad;
            prev.numeroFlores = (prev.numeroFlores ?? 0) + (det.numeroFlores ?? 0);
          } else {
            mapaItems.set(claveUnica, {
              id: `ia-orq-${det.colorClave}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              tipoFlor: "orquidea",
              colorClave: det.colorClave,
              variedadNombre: nombreOrq,
              cantidad: Math.max(1, det.cantidad),
              numeroFlores: det.numeroFlores ?? 8,
              origen: "ia",
            });
          }
          continue;
        }

        const ref = resolverVariedadDesdeCatalogo(catalogo, det.colorClave, det.variedad);
        const nombreFinal = ref?.nombre ?? det.variedad ?? det.colorClave;
        const claveUnica = `rosa::${det.colorClave}::${nombreFinal.toLowerCase()}`;
        const prev = mapaItems.get(claveUnica);
        if (prev) {
          prev.cantidad += det.cantidad;
        } else {
          mapaItems.set(claveUnica, {
            id: `ia-${det.colorClave}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            tipoFlor: "rosa",
            colorClave: det.colorClave,
            variedadId: ref?.id,
            variedadNombre: nombreFinal,
            imagenUrl: ref?.imagenUrl,
            cantidad: det.cantidad,
            origen: "ia",
          });
        }
      }
    } else {
      for (const [colorClave, cantidad] of Object.entries(extraido.conteoColores)) {
        if (cantidad <= 0) continue;
        const ref = obtenerVariedadDefectoPorColor(catalogo, colorClave);
        const nombreFinal = ref?.nombre ?? colorClave;
        mapaItems.set(`rosa::${colorClave}::${nombreFinal.toLowerCase()}`, {
          id: `ia-${colorClave}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          tipoFlor: "rosa",
          colorClave,
          variedadId: ref?.id,
          variedadNombre: nombreFinal,
          imagenUrl: ref?.imagenUrl,
          cantidad,
          origen: "ia",
        });
      }
    }

    const itemsVariedad = Array.from(mapaItems.values());
    return {
      ok: true,
      conteoColores: extraido.conteoColores,
      itemsVariedad,
      notaIa: extraido.notaIa,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `ARIA no pudo contar automáticamente (${err.message}). Puedes ajustar las cantidades con +/- manualmente.`
          : "No se pudo invocar a ARIA para esta imagen.",
    };
  }
}

export async function guardarCorteInventarioRosasAction(entrada: {
  negocio: string;
  resumenColores: Record<string, number>;
  fotos: FotoConteoBonches[];
  observaciones?: string;
}): Promise<{ ok: true; corte: CorteInventarioRosas } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_guardar_corte_inventario_rosas",
      {
        p_negocio: neg,
        p_resumen_colores: entrada.resumenColores,
        p_fotos: entrada.fotos,
        p_observaciones: entrada.observaciones ?? null,
      }
    );

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo guardar el inventario") };
    }

    revalidarRutasTienda(neg);
    return { ok: true, corte: data.corte as CorteInventarioRosas };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar inventario",
    };
  }
}

// =============================================================================
// 2. GALERÍA DE DISPONIBLES PARA ENTREGA INMEDIATA (1 A 2 HORAS)
// =============================================================================

export async function listarEntregaInmediataAction(
  negocio: string,
  incluirInactivos = false
): Promise<
  | { ok: true; items: ArregloEntregaInmediata[]; migracionPendiente?: boolean }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_listar_entrega_inmediata",
      {
        p_negocio: neg,
        p_incluir_inactivos: Boolean(incluirInactivos),
      }
    );

    if (!error && data?.ok) {
      const items = Array.isArray(data.items)
        ? (data.items as ArregloEntregaInmediata[]).map((x) => ({
            ...x,
            precio: Number(x.precio) || 0,
            precioComparacion:
              x.precioComparacion != null ? Number(x.precioComparacion) : null,
            stockDisponible: Number(x.stockDisponible) || 0,
            galeriaUrls: Array.isArray(x.galeriaUrls) ? x.galeriaUrls : [],
            usos: Array.isArray(x.usos)
              ? x.usos.map((u) => String(u).trim()).filter(Boolean)
              : [],
          }))
        : [];
      return { ok: true, items };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    return { ok: true, items: [], migracionPendiente: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "No se pudo consultar la galería de entrega inmediata",
    };
  }
}

export async function publicarEntregaInmediataAction(entrada: {
  negocio: string;
  nombre: string;
  precio: number;
  imagenUrl: string;
  galeriaUrls?: string[];
  stock?: number;
  precioComparacion?: number | null;
  descripcion?: string;
  productoId?: string | null;
}): Promise<
  | {
      ok: true;
      productoId: string;
      slug: string;
      sku: string;
      usos: string[];
      advertenciaUso?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_publicar_entrega_inmediata", {
      p_negocio: neg,
      p_nombre: entrada.nombre,
      p_precio: Number(entrada.precio) || 0,
      p_imagen_url: entrada.imagenUrl,
      p_stock: Math.max(1, Math.round(Number(entrada.stock) || 1)),
      p_precio_comparacion:
        entrada.precioComparacion && Number(entrada.precioComparacion) > 0
          ? Number(entrada.precioComparacion)
          : null,
      p_descripcion: entrada.descripcion ?? null,
      p_galeria:
        Array.isArray(entrada.galeriaUrls) && entrada.galeriaUrls.length > 0
          ? entrada.galeriaUrls
          : [entrada.imagenUrl],
      p_producto_id:
        entrada.productoId && /^[0-9a-f-]{36}$/i.test(entrada.productoId)
          ? entrada.productoId
          : null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo publicar el arreglo") };
    }

    const productoId = String(data.productoId);
    const usosInferidos = inferirUsosEntregaInmediata(entrada.nombre);
    let usosConfirmados: string[] = Array.isArray(data.usos)
      ? data.usos.map((u: unknown) => String(u).trim()).filter(Boolean)
      : [];
    let advertenciaUso: string | undefined;

    const faltanUsosInferidos = usosInferidos.some(
      (u) => !usosConfirmados.map((x) => x.toLowerCase()).includes(u.toLowerCase())
    );

    // Respaldo resiliente: si el RPC remoto aún no tiene aplicada la migración 20261121000001,
    // persistir los usos inferidos (ej. "condolencias") directamente en com_producto.
    if (faltanUsosInferidos) {
      const { data: prodRow, error: errRead } = await esquema
        .from("com_producto")
        .select("pro_detalle_producto")
        .eq("pro_id", productoId)
        .maybeSingle();

      if (errRead || !prodRow) {
        advertenciaUso = `Arreglo publicado, pero no se pudo asignar el uso Condolencias / Duelo (${errRead?.message || "permisos insuficientes en tabla"}). Ejecuta la migración 20261121000001_entrega_inmediata_usos_condolencias.sql.`;
      } else {
        const detActual =
          prodRow.pro_detalle_producto && typeof prodRow.pro_detalle_producto === "object"
            ? (prodRow.pro_detalle_producto as Record<string, unknown>)
            : {};
        const usosExistentes = Array.isArray(detActual.usos)
          ? detActual.usos.map((u) => String(u))
          : [];
        const usosCombinados = combinarUsosConInferidos(usosExistentes, entrada.nombre);

        const { data: updRow, error: errUpd } = await esquema
          .from("com_producto")
          .update({
            pro_detalle_producto: {
              ...detActual,
              usos: usosCombinados,
            },
            pro_actualizado_en: new Date().toISOString(),
          })
          .eq("pro_id", productoId)
          .select("pro_id")
          .maybeSingle();

        if (errUpd || !updRow) {
          advertenciaUso = `Arreglo publicado, pero no se pudo asignar el uso Condolencias / Duelo (${errUpd?.message || "sin permisos de escritura directa"}). Ejecuta la migración 20261121000001_entrega_inmediata_usos_condolencias.sql.`;
        } else {
          usosConfirmados = usosCombinados;
        }
      }
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      productoId,
      slug: String(data.slug),
      sku: String(data.sku),
      usos: usosConfirmados,
      ...(advertenciaUso ? { advertenciaUso } : {}),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al publicar arreglo disponible",
    };
  }
}

export async function descartarEntregaInmediataAction(entrada: {
  negocio: string;
  productoId: string;
  motivo: "VENDIDO_TIENDA" | "VENDIDO_WHATSAPP" | "DESCARTADO";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_descartar_entrega_inmediata", {
      p_negocio: neg,
      p_producto_id: entrada.productoId,
      p_motivo: entrada.motivo,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo retirar el arreglo") };
    }

    revalidarRutasTienda(neg);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al retirar arreglo de entrega inmediata",
    };
  }
}

export async function eliminarDefinitivoEntregaInmediataAction(entrada: {
  negocio: string;
  productoId: string;
}): Promise<{ ok: true; modo: "fisico" | "logico" } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_eliminar_producto_catalogo", {
      p_negocio: neg,
      p_producto_id: entrada.productoId,
    });

    if (error) {
      return {
        ok: false,
        error: /com_fn_eliminar_producto_catalogo|Could not find the function/i.test(error.message)
          ? "Ejecuta primero la migración 20261120000002_rpc_eliminar_producto_y_entrega_inmediata.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudo eliminar definitivamente el arreglo."),
      };
    }

    revalidarRutasTienda(neg);
    return { ok: true, modo: data.modo === "logico" ? "logico" : "fisico" };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Error inesperado al eliminar definitivamente el arreglo",
    };
  }
}

// =============================================================================
// 3. ÓRDENES DE TRABAJO (EXEQUIALES IESS), CONFIRMACIÓN DE ENTREGAS & INFORMES
// =============================================================================

export interface DatosTableroEntregas {
  usuarioActualId: string | null;
  usuarioActualNombre: string;
  rolOperativo?: string;
  esAdminOperador: boolean;
  esSubcontratado?: boolean;
  convenios: ConvenioEntregaConfig[];
  entregas: RegistroEntregaEvidencia[];
  informes: InformeQuincenalEntregas[];
  pedidosPendientesTienda: PedidoPendienteConfirmacion[];
  migracionPendiente?: boolean;
}

export async function obtenerTableroEntregasAction(
  negocio: string
): Promise<{ ok: true; datos: DatosTableroEntregas } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_obtener_tablero_entregas", {
      p_negocio: neg,
    });

    if (!error && data?.ok) {
      const convenios: ConvenioEntregaConfig[] =
        Array.isArray(data.convenios) && data.convenios.length > 0
          ? data.convenios
          : [
              {
                id: "conv-exequiales-defecto",
                codigo: "EXEQUIALES_IESS",
                nombre: "Exequiales del IESS",
                prefijoInforme: "INF-IESS",
                siguienteNumero: 1,
                datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
              },
            ];

      return {
        ok: true,
        datos: {
          usuarioActualId: data.usuarioActualId ? String(data.usuarioActualId) : null,
          usuarioActualNombre: String(data.usuarioActualNombre || "Colaborador"),
          rolOperativo: data.rolOperativo ? String(data.rolOperativo) : undefined,
          esAdminOperador: Boolean(data.esAdminOperador),
          esSubcontratado: Boolean(data.esSubcontratado),
          convenios,
          entregas: Array.isArray(data.entregas) ? data.entregas : [],
          informes: Array.isArray(data.informes) ? data.informes : [],
          pedidosPendientesTienda: Array.isArray(data.pedidosPendientesTienda)
            ? data.pedidosPendientesTienda
            : [],
        },
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      ok: true,
      datos: {
        usuarioActualId: user?.id ?? null,
        usuarioActualNombre: user?.email?.split("@")[0] || "Colaborador",
        esAdminOperador: true,
        convenios: [
          {
            id: "conv-exequiales-defecto",
            codigo: "EXEQUIALES_IESS",
            nombre: "Exequiales del IESS",
            prefijoInforme: "INF-IESS",
            siguienteNumero: 1,
            datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
          },
        ],
        entregas: [],
        informes: [],
        pedidosPendientesTienda: [],
        migracionPendiente: true,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar el tablero de entregas",
    };
  }
}

export async function registrarOSincronizarEntregaAction(entrada: {
  negocio: string;
  uuidCliente: string;
  entregaId?: string | null;
  tipoOrigen: TipoOrigenEntrega;
  convenioId?: string | null;
  proformaId?: string | null;
  soloProgramarOt?: boolean;
  entregadorNombre?: string;
  fallecidoDestinatario?: string;
  fechaServicio?: string;
  capturadoEn?: string;
  descripcionServicio: string;
  salaServicio?: string;
  ubicacionNombre?: string;
  coordinadorNombre?: string;
  recursosUtilizados?: string;
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  direccionGps?: string | null;
  fotoUrl?: string | null;
  mapaUrl?: string | null;
  facturaReferencia?: string | null;
  documentosAdjuntos?: string | null;
  observaciones?: string | null;
}): Promise<
  | { ok: true; entregaId: string; codigoOt: string; estado: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_registrar_o_sincronizar_entrega", {
      p_negocio: neg,
      p_payload: {
        uuidCliente: entrada.uuidCliente,
        entregaId:
          entrada.entregaId && /^[0-9a-f-]{36}$/i.test(entrada.entregaId)
            ? entrada.entregaId
            : null,
        tipoOrigen: entrada.tipoOrigen,
        convenioId:
          entrada.convenioId && /^[0-9a-f-]{36}$/i.test(entrada.convenioId)
            ? entrada.convenioId
            : null,
        proformaId:
          entrada.proformaId && /^[0-9a-f-]{36}$/i.test(entrada.proformaId)
            ? entrada.proformaId
            : null,
        soloProgramarOt: Boolean(entrada.soloProgramarOt),
        entregadorNombre: entrada.entregadorNombre,
        fallecidoDestinatario: entrada.fallecidoDestinatario ?? "",
        fechaServicio: entrada.fechaServicio,
        capturadoEn: entrada.capturadoEn,
        descripcionServicio: entrada.descripcionServicio,
        salaServicio: entrada.salaServicio ?? "",
        ubicacionNombre: entrada.ubicacionNombre ?? "",
        detalleExtra: entrada.salaServicio
          ? { sala_servicio: entrada.salaServicio }
          : undefined,
        coordinadorNombre: entrada.coordinadorNombre,
        recursosUtilizados: entrada.recursosUtilizados,
        latitud: entrada.latitud != null ? String(entrada.latitud) : null,
        longitud: entrada.longitud != null ? String(entrada.longitud) : null,
        precisionMetros:
          entrada.precisionMetros != null ? String(entrada.precisionMetros) : null,
        direccionGps: entrada.direccionGps,
        fotoUrl: entrada.fotoUrl,
        mapaUrl: entrada.mapaUrl,
        facturaReferencia: entrada.facturaReferencia,
        documentosAdjuntos: entrada.documentosAdjuntos,
        observaciones: entrada.observaciones,
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo registrar la entrega") };
    }

    if (!entrada.soloProgramarOt) {
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: entrada.proformaId || String(data.entregaId),
        codigoOrden: String(data.codigoOt || "PEDIDO"),
        nuevoEstado: "ENTREGADO",
        etiquetaEstado: "Entregado (GPS)",
        compradorNombre: entrada.fallecidoDestinatario || entrada.coordinadorNombre || null,
      });
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      entregaId: String(data.entregaId),
      codigoOt: String(data.codigoOt || "OT"),
      estado: String(data.estado || "ENTREGADA_PENDIENTE_INFORME"),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al sincronizar entrega",
    };
  }
}

export async function actualizarEntregaEvidenciaAction(entrada: {
  negocio: string;
  entregaId: string;
  cambios: {
    fallecidoDestinatario?: string;
    fechaServicio?: string;
    descripcionServicio?: string;
    salaServicio?: string;
    ubicacionNombre?: string;
    coordinadorNombre?: string;
    recursosUtilizados?: string;
    entregadorNombre?: string;
    facturaReferencia?: string;
    documentosAdjuntos?: string;
    fotoUrl?: string;
    mapaUrl?: string;
    anular?: boolean;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_actualizar_entrega_evidencia", {
      p_negocio: neg,
      p_entrega_id: entrada.entregaId,
      p_cambios: entrada.cambios,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo actualizar la entrega") };
    }

    revalidarRutasTienda(neg);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar entrega",
    };
  }
}

export async function emitirInformeQuincenalAction(entrada: {
  negocio: string;
  convenioId?: string | null;
  numeroInforme: string;
  fechaInforme: string;
  fechaInicio: string;
  fechaFin: string;
  entregasIds: string[];
  datosProveedor: DatosProveedorInformeIess;
  facturaReferencia?: string;
  documentosAdjuntos?: string;
  pdfUrl?: string | null;
}): Promise<
  | { ok: true; informeId: string; numeroInforme: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_emitir_informe_quincenal", {
      p_negocio: neg,
      p_payload: {
        convenioId:
          entrada.convenioId && /^[0-9a-f-]{36}$/i.test(entrada.convenioId)
            ? entrada.convenioId
            : null,
        numeroInforme: entrada.numeroInforme,
        fechaInforme: entrada.fechaInforme,
        fechaInicio: entrada.fechaInicio,
        fechaFin: entrada.fechaFin,
        entregasIds: entrada.entregasIds,
        datosProveedor: entrada.datosProveedor,
        facturaReferencia: entrada.facturaReferencia ?? "",
        documentosAdjuntos: entrada.documentosAdjuntos ?? "",
        pdfUrl: entrada.pdfUrl ?? null,
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo emitir el informe quincenal") };
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      informeId: String(data.informeId),
      numeroInforme: String(data.numeroInforme),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar informe quincenal",
    };
  }
}

// =============================================================================
// 4. PROGRAMACIÓN, ENVÍO DIARIO DE PEDIDOS Y CONSOLA DE TALLER FLORAL
// =============================================================================

export interface DatosConsolaTallerYDespacho {
  rolOperativo?: string;
  esAdminEstricto?: boolean;
  puedeEliminarLogico?: boolean;
  usuarioActualNombre: string;
  ordenes: OrdenTrabajoTaller[];
  ordenesEliminadas?: OrdenTrabajoTaller[];
  productosCatalogo: ProductoLigeroSelectorTaller[];
  repartidoresNegocio?: RepartidorDisponibleNegocio[];
  estadosConfig?: EstadoPedidoConfig[];
  migracionPendiente?: boolean;
}

async function notificarPersonalTallerODespacho(params: {
  negocio: string;
  titulo: string;
  contenidoHtml: string;
  urlAccion: string;
  roles: readonly string[];
  claveReferencia?: string;
}) {
  try {
    const {
      obtenerDestinatariosStaffNegocio,
      persistirNotificacionesInternasResiliente,
    } = await import("@eco/notificaciones/notificar-usuario");

    const destinatarios = await obtenerDestinatariosStaffNegocio(
      params.negocio,
      undefined,
      params.roles
    );
    const conId = destinatarios.filter((d) => Boolean(d.id));
    if (conId.length === 0) return;

    const codigoNeg =
      params.negocio === "tinkay"
        ? "TNK"
        : params.negocio === "margaritas"
          ? "MRG"
          : params.negocio === "fastfix"
            ? "FFH"
            : "TRQ";

    const itemsNotif = conId.flatMap((d) => [
      {
        usuarioId: String(d.id),
        negocioCode: codigoNeg,
        canal: "IN_APP" as const,
        titulo: params.titulo,
        contenidoHtml: params.contenidoHtml,
        urlAccion: params.urlAccion,
        claveReferencia: params.claveReferencia,
      },
      {
        usuarioId: String(d.id),
        negocioCode: codigoNeg,
        canal: "PUSH" as const,
        titulo: params.titulo,
        contenidoHtml: params.contenidoHtml,
        urlAccion: params.urlAccion,
        claveReferencia: params.claveReferencia ? `${params.claveReferencia}:push` : undefined,
      },
    ]);

    await persistirNotificacionesInternasResiliente(params.negocio, itemsNotif);
  } catch {
    // No interrumpir flujo operativo si el canal de notificación falla
  }
}

export async function obtenerConsolaTallerYDespachoAction(
  negocio: string
): Promise<
  | { ok: true; datos: DatosConsolaTallerYDespacho }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const { leerEstadosPedidosConfig } = await import("./acciones-logistica");
    const estadosConfig = await leerEstadosPedidosConfig(neg, supabase);

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_consola_taller_y_despacho",
      { p_negocio: neg }
    );

    if (!error && data?.ok) {
      const ordenes: OrdenTrabajoTaller[] = Array.isArray(data.ordenes)
        ? (data.ordenes as any[]).map((o) => {
            const itemsNorm: ItemOrdenTaller[] = Array.isArray(o.items)
              ? (o.items as any[]).map((it) => {
                  const pers = it.personalizacion_floral ?? it.personalizacionFloral;
                  const fotoRef =
                    pers?.fotoReferenciaUrl ||
                    it.foto_referencia_url ||
                    it.fotoReferenciaUrl ||
                    it.imagen ||
                    it.imagenUrl ||
                    undefined;
                  return {
                    ...it,
                    descripcion: String(it.descripcion || it.producto_nombre || it.nombre || "Arreglo"),
                    cantidad: Number(it.cantidad ?? 1),
                    imagenUrl: fotoRef ? String(fotoRef) : undefined,
                    fotoReferenciaUrl: fotoRef ? String(fotoRef) : undefined,
                    mismosColoresFoto: Boolean(pers?.mismosColoresFoto || it.mismosColoresFoto),
                  };
                })
              : [];
            return {
              ...o,
              clasificacionPedido: inferirClasificacionPedido({
                clasificacionExplicita: o.clasificacionPedido,
                origenTipo: o.origenTipo,
                retiroEnLocal: Boolean(o.retiroEnLocal),
                salaServicio: o.salaServicio,
                productoResumen: o.productoResumen,
                ubicacionEntrega: o.ubicacionEntrega,
                metodoPago: o.metodoPago,
                items: itemsNorm,
              }),
              totalUsd: Number(o.totalUsd ?? 0),
              items: itemsNorm,
              franjaHoraria: o.franjaHoraria
                ? normalizarFranjaHorariaTienda(String(o.franjaHoraria))
                : null,
            };
          })
        : [];
      const productosCatalogo: ProductoLigeroSelectorTaller[] = Array.isArray(
        data.productosCatalogo
      )
        ? (data.productosCatalogo as any[]).map((p) => ({
            productoId: String(p.productoId),
            productoNombre: String(p.productoNombre),
            tipoProducto: p.tipoProducto ? String(p.tipoProducto) : undefined,
            esRenta: Boolean(p.esRenta),
            varianteId: p.varianteId ? String(p.varianteId) : undefined,
            sku: String(p.sku || ""),
            varianteNombre: String(p.varianteNombre || "Estándar"),
            pvp: Number(p.pvp ?? 0),
            portadaUrl: p.portadaUrl ? String(p.portadaUrl) : undefined,
          }))
        : [];

      const repartidoresNegocio: RepartidorDisponibleNegocio[] = Array.isArray(
        data.repartidoresNegocio
      )
        ? (data.repartidoresNegocio as any[]).map((r) => ({
            usuarioId: String(r.usuarioId),
            nombre: String(r.nombre || "Repartidor"),
            correo: r.correo ? String(r.correo) : undefined,
            modalidad: r.modalidad === "EXTERNO" ? "EXTERNO" : "INTERNO",
          }))
        : [];

      const ordenesEnriquecidas = ordenes.map((o) => {
        const tokVista = String(o.tarjetaToken || o.proformaId || o.id);
        const esCondolOta = o.tarjetaTipo === "CONDOLENCIAS_PLANA";
        return {
          ...o,
          tarjetaToken: tokVista,
          tarjetaTokenEdicion: generarTokenEdicionTarjetaServidor(tokVista),
          tarjetaConfidencial: esCondolOta
            ? false
            : Boolean(o.tarjetaConfidencial ?? o.tarjetaMetadata?.confidencial_solo_qr),
          tarjetaDiseno: o.tarjetaDiseno ?? o.tarjetaMetadata?.diseno,
        };
      });

      const rolStr = data.rolOperativo ? String(data.rolOperativo) : undefined;
      const esAdminEstricto =
        typeof data.esAdminEstricto === "boolean"
          ? data.esAdminEstricto
          : rolStr === "SUPERADMIN" || rolStr === "ADMINISTRADOR";
      const puedeEliminarLogico =
        typeof data.puedeEliminarLogico === "boolean"
          ? data.puedeEliminarLogico
          : esAdminEstricto || rolStr === "OPERADOR" || rolStr === "VENTAS";

      const ordenesEliminadas: OrdenTrabajoTaller[] =
        esAdminEstricto && Array.isArray(data.ordenesEliminadas)
          ? (data.ordenesEliminadas as any[]).map((o) => {
              const itemsNorm = Array.isArray(o.items) ? o.items : [];
              return {
                ...o,
                clasificacionPedido: inferirClasificacionPedido({
                  clasificacionExplicita: o.clasificacionPedido,
                  origenTipo: o.origenTipo,
                  retiroEnLocal: Boolean(o.retiroEnLocal),
                  salaServicio: o.salaServicio,
                  productoResumen: o.productoResumen,
                  ubicacionEntrega: o.ubicacionEntrega,
                  metodoPago: o.metodoPago,
                  items: itemsNorm,
                }),
                totalUsd: Number(o.totalUsd ?? 0),
                items: itemsNorm,
                franjaHoraria: o.franjaHoraria
                  ? normalizarFranjaHorariaTienda(String(o.franjaHoraria))
                  : null,
              };
            })
          : [];

      return {
        ok: true,
        datos: {
          rolOperativo: rolStr,
          esAdminEstricto,
          puedeEliminarLogico,
          usuarioActualNombre: String(data.usuarioActualNombre || "Operador"),
          ordenes: ordenesEnriquecidas,
          ordenesEliminadas,
          productosCatalogo,
          repartidoresNegocio,
          estadosConfig,
        },
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo híbrido sobre tablas existentes (com_proforma + com_entrega_evidencia + com_producto)
    // si la migración 20261116000001 aún no ha sido ejecutada en Supabase remoto.
    const db: any = crearClienteAdmin() ?? supabase;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const hoyYmd = obtenerFechaHoyEcuadorYmd();

    const [resPrf, resEnt, resProd] = await Promise.all([
      db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("*")
        .eq("prf_negocio", neg)
        .is("prf_eliminado_en", null)
        .order("prf_creado_en", { ascending: false })
        .limit(250),
      db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_negocio", neg)
        .is("ent_eliminado_en", null)
        .order("ent_creado_en", { ascending: false })
        .limit(200),
      db
        .schema("comun_comercio")
        .from("com_variante")
        .select("var_id, var_producto_id, var_sku, var_nombre, var_precio, var_detalle_variante, com_producto!inner(pro_id, pro_nombre, pro_activo, pro_eliminado_en, pro_detalle_producto)")
        .eq("var_negocio", neg)
        .eq("var_activo", true)
        .is("var_eliminado_en", null)
        .limit(200),
    ]);

    const ordenesRespaldo: OrdenTrabajoTaller[] = [];

    for (const f of resPrf.data ?? []) {
      const estadoPrf = String(f.prf_estado || "").toUpperCase();
      if (["CANCELADO", "ANULADO", "NO_ACEPTADA"].includes(estadoPrf)) continue;
      const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
      const tipoOrig = String(det.tipo_origen || "");
      if (
        tipoOrig === "PROFORMA_EVENTO" &&
        !["ORDEN_CONFIRMADA", "RESERVADA_70", "APROBADA", "EN_PREPARACION", "EN_RUTA", "ENTREGADO"].includes(
          estadoPrf
        )
      ) {
        continue;
      }

      const log = (det.logistica_entrega ?? {}) as Record<string, any>;
      const itemsRaw = Array.isArray(det.items) ? det.items : [];
      const items: ItemOrdenTaller[] = itemsRaw.map((it: any) => {
        const pers = it.personalizacion_floral ?? it.personalizacionFloral;
        const resumenPers =
          pers && typeof pers === "object" && pers.resumenTexto
            ? String(pers.resumenTexto)
            : "";
        const descBase = String(it.producto_nombre || it.descripcion || it.nombre || "Arreglo");
        const fotoRef =
          pers?.fotoReferenciaUrl ||
          it.foto_referencia_url ||
          it.fotoReferenciaUrl ||
          it.imagen ||
          it.imagenUrl ||
          undefined;
        return {
          sku: it.sku ? String(it.sku) : undefined,
          descripcion: resumenPers ? `${descBase} [${resumenPers}]` : descBase,
          cantidad: Number(it.cantidad ?? 1),
          precioUnitario: Number(it.pvp_unitario ?? it.precio_unitario ?? 0),
          imagenUrl: fotoRef ? String(fotoRef) : undefined,
          fotoReferenciaUrl: fotoRef ? String(fotoRef) : undefined,
          mismosColoresFoto: Boolean(pers?.mismosColoresFoto),
          dedicatoria: it.dedicatoria?.mensaje
            ? `Para: ${it.dedicatoria.para || "-"} | De: ${it.dedicatoria.de || "-"} — "${it.dedicatoria.mensaje}"`
            : undefined,
        };
      });

      const estTaller: EstadoOrdenTaller = (det.estado_taller as EstadoOrdenTaller) ||
        (estadoPrf === "ENTREGADO" || det.entrega_confirmada
          ? "ENTREGADO"
          : estadoPrf === "EN_RUTA"
            ? "LISTO_ENTREGA"
            : estadoPrf === "EN_PREPARACION"
              ? "EN_PREPARACION"
              : "PENDIENTE_ENVIO");

      const resumenProdPrf =
        items.map((i) => `${i.cantidad}x ${i.descripcion}`).join(" + ") || "Pedido floral";
      const ubicacionPrf = String(log.direccion || det.ubicacion?.direccion || "");
      const retiroPrf = Boolean(log.retiro_en_local);

      ordenesRespaldo.push({
        id: String(f.prf_id),
        codigo: String(
          det.codigo_orden || det.codigo_proforma || `TNK-ORD-${String(f.prf_secuencial ?? 1).padStart(4, "0")}`
        ),
        origenTipo:
          tipoOrig === "PROFORMA_EVENTO"
            ? "PROFORMA_EVENTO"
            : tipoOrig === "MANUAL_ADMIN"
              ? "MANUAL_ADMIN"
              : "VENTA_TIENDA",
        clasificacionPedido: inferirClasificacionPedido({
          clasificacionExplicita: det.clasificacion_pedido ? String(det.clasificacion_pedido) : null,
          origenTipo: tipoOrig,
          retiroEnLocal: retiroPrf,
          salaServicio: log.sala_servicio || det.sala_servicio || null,
          productoResumen: resumenProdPrf,
          ubicacionEntrega: ubicacionPrf,
          tieneEvento: Boolean(det.evento),
          items,
        }),
        proformaId: String(f.prf_id),
        estadoTaller: estTaller,
        estadoPago: estadoPrf,
        metodoPago: det.metodo_pago ? String(det.metodo_pago) : "web",
        fechaPedido: String(f.prf_creado_en),
        fechaEntrega: String(
          log.fecha_entrega || log.fechaEntrega || det.evento?.fechaEvento || hoyYmd
        ).slice(0, 10),
        fechaElaboracion: det.fecha_elaboracion ? String(det.fecha_elaboracion).slice(0, 10) : undefined,
        franjaHoraria: normalizarFranjaHorariaTienda(
          String(log.franja_horaria || log.franjaHoraria || "A) 09:00 - 13:00")
        ),
        horaEspecifica: log.hora_exacta || det.evento?.horaEvento || null,
        productoResumen: resumenProdPrf,
        items,
        clienteSolicita: String(
          det.comprador?.nombreCompleto || det.comprador?.nombre || "Cliente Tienda"
        ),
        clienteTelefono: String(det.comprador?.whatsapp || det.comprador?.telefono || ""),
        destinatarioFallecido: String(
          log.destinatario_nombre || log.destinatarioNombre || det.comprador?.nombreCompleto || ""
        ),
        salaServicio: log.sala_servicio || det.sala_servicio || null,
        ubicacionEntrega: ubicacionPrf,
        enlaceMapa: log.enlace_mapa || log.enlaceMapa || null,
        retiroEnLocal: retiroPrf,
        dedicatoria:
          det.tarjeta?.mensaje ||
          items.map((i) => i.dedicatoria).filter(Boolean).join(" || ") ||
          undefined,
        tarjetaToken: String(det.tarjeta?.token || f.prf_token_aprobacion || f.prf_id),
        tarjetaTipo:
          det.tarjeta?.tipo === "CONDOLENCIAS_PLANA" ||
          det.tarjeta?.tipo === "SOLO_DIGITAL" ||
          det.tarjeta?.tipo === "DIPTICO"
            ? det.tarjeta.tipo
            : resumenProdPrf.toLowerCase().includes("condolen")
              ? "CONDOLENCIAS_PLANA"
              : "DIPTICO",
        tarjetaMusicaUrl: det.tarjeta?.musica_url || det.tarjeta?.musicaUrl || null,
        tarjetaMusicaTitulo: det.tarjeta?.musica_titulo || det.tarjeta?.musicaTitulo || null,
        tarjetaLyrics: Array.isArray(det.tarjeta?.lyrics) ? det.tarjeta.lyrics : [],
        tarjetaMetadata:
          det.tarjeta?.metadata && typeof det.tarjeta.metadata === "object"
            ? det.tarjeta.metadata
            : {},
        observaciones: det.notas_taller || det.evento?.notasEvento || undefined,
        totalUsd: Number(f.prf_total ?? 0),
        enviadoTallerEn: det.enviado_taller_en || null,
        entregadoEn: det.entrega_capturado_en || null,
        evidenciaFotoUrl: det.entrega_foto_url || null,
        evidenciaMapaUrl: det.entrega_mapa_url || null,
        evidenciaLatitud: det.entrega_latitud != null ? Number(det.entrega_latitud) : null,
        evidenciaLongitud: det.entrega_longitud != null ? Number(det.entrega_longitud) : null,
        entregadoPorNombre: det.entrega_entregador_nombre || null,
        actualizadoTallerNombre: det.actualizado_taller_por || null,
      });
    }

    for (const e of resEnt.data ?? []) {
      if (e.ent_tipo_origen !== "ORDEN_TRABAJO_CONVENIO" || e.ent_estado === "ANULADA") continue;
      const detEnt = (e.ent_detalle_entrega ?? {}) as Record<string, any>;
      const estTaller: EstadoOrdenTaller =
        e.ent_estado !== "PROGRAMADA"
          ? "ENTREGADO"
          : (detEnt.estado_taller as EstadoOrdenTaller) || "ENVIADO_TALLER";

      ordenesRespaldo.push({
        id: String(e.ent_id),
        codigo: String(e.ent_codigo_ot || `OT-${String(e.ent_secuencial ?? 1).padStart(4, "0")}`),
        origenTipo: "EXEQUIALES_LLAMADA",
        clasificacionPedido: "EXEQUIALES",
        entregaId: String(e.ent_id),
        estadoTaller: estTaller,
        estadoPago: "CONVENIO_IESS",
        metodoPago: "convenio",
        fechaPedido: String(e.ent_creado_en),
        fechaEntrega: String(e.ent_fecha_servicio || hoyYmd).slice(0, 10),
        fechaElaboracion: String(e.ent_fecha_servicio || hoyYmd).slice(0, 10),
        horaEspecifica: e.ent_hora_solicitada || detEnt.hora_solicitada || null,
        productoResumen: String(e.ent_descripcion_servicio || "Set condolencias (3 arreglos)"),
        items: [
          {
            descripcion: String(e.ent_descripcion_servicio || "Set condolencias (3 arreglos)"),
            cantidad: 1,
          },
        ],
        clienteSolicita: String(e.ent_coordinador_nombre || detEnt.quien_solicita || "Exequiales IESS"),
        destinatarioFallecido: String(e.ent_fallecido_destinatario || ""),
        salaServicio: e.ent_sala_servicio || detEnt.sala_servicio || null,
        ubicacionEntrega: String(e.ent_ubicacion_nombre || "Exequiales del IESS"),
        dedicatoria: detEnt.tarjeta?.mensaje || detEnt.dedicatoria || undefined,
        tarjetaToken: String(detEnt.tarjeta?.token || e.ent_id),
        tarjetaTipo:
          detEnt.tarjeta?.tipo === "DIPTICO" ||
          detEnt.tarjeta?.tipo === "SOLO_DIGITAL" ||
          detEnt.tarjeta?.tipo === "CONDOLENCIAS_PLANA"
            ? detEnt.tarjeta.tipo
            : "CONDOLENCIAS_PLANA",
        tarjetaMusicaUrl: detEnt.tarjeta?.musica_url || detEnt.tarjeta?.musicaUrl || null,
        tarjetaMusicaTitulo: detEnt.tarjeta?.musica_titulo || detEnt.tarjeta?.musicaTitulo || null,
        tarjetaLyrics: Array.isArray(detEnt.tarjeta?.lyrics) ? detEnt.tarjeta.lyrics : [],
        tarjetaMetadata:
          detEnt.tarjeta?.metadata && typeof detEnt.tarjeta.metadata === "object"
            ? detEnt.tarjeta.metadata
            : {},
        observaciones: e.ent_observaciones || undefined,
        enviadoTallerEn: String(e.ent_creado_en),
        entregadoEn: e.ent_estado !== "PROGRAMADA" ? String(e.ent_capturado_en || "") : null,
        evidenciaFotoUrl: e.ent_foto_url ? String(e.ent_foto_url) : null,
        evidenciaMapaUrl: e.ent_mapa_url ? String(e.ent_mapa_url) : null,
        evidenciaLatitud: e.ent_latitud != null ? Number(e.ent_latitud) : null,
        evidenciaLongitud: e.ent_longitud != null ? Number(e.ent_longitud) : null,
        evidenciaDireccionGps: e.ent_direccion_gps ? String(e.ent_direccion_gps) : null,
        entregadoPorNombre: e.ent_entregador_nombre ? String(e.ent_entregador_nombre) : null,
        estadoEvidencia: e.ent_estado ? String(e.ent_estado) : null,
      });
    }

    const productosCatalogo: ProductoLigeroSelectorTaller[] = (resProd.data ?? []).map((v: any) => {
      const prod = Array.isArray(v.com_producto) ? v.com_producto[0] : v.com_producto;
      return {
        productoId: String(v.var_producto_id),
        productoNombre: String(prod?.pro_nombre || "Arreglo"),
        varianteId: String(v.var_id),
        sku: String(v.var_sku || ""),
        varianteNombre: String(v.var_nombre || "Estándar"),
        pvp: Number(v.var_precio ?? 0),
        portadaUrl:
          v.var_detalle_variante?.portada_url || prod?.pro_detalle_producto?.portada_url || undefined,
      };
    });

    const ordenesRespaldoEnriquecidas = ordenesRespaldo.map((o) => {
      const tokVista = String(o.tarjetaToken || o.proformaId || o.id);
      const esCondolOta = o.tarjetaTipo === "CONDOLENCIAS_PLANA";
      return {
        ...o,
        tarjetaToken: tokVista,
        tarjetaTokenEdicion: generarTokenEdicionTarjetaServidor(tokVista),
        tarjetaConfidencial: esCondolOta
          ? false
          : Boolean(o.tarjetaConfidencial ?? o.tarjetaMetadata?.confidencial_solo_qr),
        tarjetaDiseno: o.tarjetaDiseno ?? o.tarjetaMetadata?.diseno,
      };
    });

    return {
      ok: true,
      datos: {
        usuarioActualNombre: user?.email?.split("@")[0] || "Operador",
        ordenes: ordenesRespaldoEnriquecidas,
        productosCatalogo,
        estadosConfig,
        migracionPendiente: true,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando consola de Pedidos y Taller",
    };
  }
}

export async function crearOActualizarPedidoOperadorAction(entrada: {
  negocio: string;
  ordenId?: string | null;
  origenTipo: OrigenOrdenTaller;
  clasificacionPedido?: ClasificacionOperativaPedido;
  enviarATaller?: boolean;
  fechaEntrega: string;
  fechaElaboracion?: string;
  franjaHoraria?: string;
  horaEspecifica?: string;
  productoResumen: string;
  items?: ItemOrdenTaller[];
  colores?: string;
  extras?: string;
  prioridadOrden?: number | null;
  clienteSolicita: string;
  clienteTelefono?: string;
  destinatarioFallecido?: string;
  salaServicio?: string;
  ubicacionEntrega?: string;
  enlaceMapa?: string;
  retiroEnLocal?: boolean;
  dedicatoria?: string;
  tarjetaTipo?: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
  tarjetaConfidencial?: boolean;
  tarjetaMusicaUrl?: string;
  tarjetaMusicaTitulo?: string;
  tarjetaLyrics?: any;
  observaciones?: string;
  totalUsd?: number;
  estadoPago?: string;
  metodoPago?: string;
  comprobanteTransferencia?: {
    url: string;
    nombreArchivo: string;
    mimeType: string;
    subidoEn?: string;
    referenciaOpcional?: string;
  } | null;
}): Promise<
  | {
      ok: true;
      ordenId: string;
      codigo: string;
      estadoTaller: EstadoOrdenTaller;
      clasificacionPedido?: ClasificacionOperativaPedido;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const clasifResuelta = inferirClasificacionPedido({
      clasificacionExplicita: entrada.clasificacionPedido,
      origenTipo: entrada.origenTipo,
      retiroEnLocal: entrada.retiroEnLocal,
      salaServicio: entrada.salaServicio,
      productoResumen: entrada.productoResumen,
      ubicacionEntrega: entrada.ubicacionEntrega,
      metodoPago: entrada.metodoPago,
      tarjetaTipo: entrada.tarjetaTipo,
      items: entrada.items,
    });

    if (
      (clasifResuelta === "EXEQUIALES" || entrada.origenTipo === "EXEQUIALES_LLAMADA") &&
      esNombreFallecidoPendiente(entrada.destinatarioFallecido)
    ) {
      return {
        ok: false,
        error:
          "En pedidos de Exequiales, el nombre de la Persona Fallecida (Destinatario) es obligatorio.",
      };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const dbMeta: any = crearClienteAdmin() ?? supabase;

    // Resolver siempre quién creó el pedido manual / operador para auditoría y trazabilidad
    let creadorPedidoSnap: {
      usuario_id: string | null;
      nombre: string;
      correo: string | null;
      origen: string;
      creado_en: string;
    } = {
      usuario_id: null,
      nombre: "Operador",
      correo: null,
      origen: entrada.origenTipo || "MANUAL_ADMIN",
      creado_en: new Date().toISOString(),
    };
    try {
      const { data: authRes } = await supabase.auth.getUser();
      const usr = authRes?.user;
      if (usr?.id) {
        let nomUsr = usr.email || "Operador";
        const { data: segUsu } = await dbMeta
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_nombres, usu_apellidos, usu_correo")
          .eq("usu_id", usr.id)
          .maybeSingle();
        const full = [segUsu?.usu_nombres, segUsu?.usu_apellidos].filter(Boolean).join(" ").trim();
        if (full) nomUsr = full;
        else if (segUsu?.usu_correo) nomUsr = String(segUsu.usu_correo);
        creadorPedidoSnap = {
          usuario_id: usr.id,
          nombre: nomUsr,
          correo: (segUsu?.usu_correo ? String(segUsu.usu_correo) : usr.email) || null,
          origen: entrada.origenTipo || "MANUAL_ADMIN",
          creado_en: new Date().toISOString(),
        };
      }
    } catch {
      // Continuar con respaldo seguro
    }

    const comprobanteManualSnap = entrada.comprobanteTransferencia?.url
      ? {
          url: entrada.comprobanteTransferencia.url,
          nombre_archivo: entrada.comprobanteTransferencia.nombreArchivo || "comprobante",
          mime_type: entrada.comprobanteTransferencia.mimeType || "image/jpeg",
          subido_en: entrada.comprobanteTransferencia.subidoEn || new Date().toISOString(),
          referencia_opcional: entrada.comprobanteTransferencia.referenciaOpcional || "",
          subido_por_id: creadorPedidoSnap.usuario_id,
          subido_por_nombre: creadorPedidoSnap.nombre,
        }
      : null;

    const enviar = entrada.enviarATaller ?? entrada.origenTipo === "EXEQUIALES_LLAMADA";

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_crear_o_actualizar_pedido_operador",
      {
        p_negocio: neg,
        p_payload: {
          ...entrada,
          enviarATaller: enviar,
        },
      }
    );

    if (!error && data?.ok) {
      // Persistir siempre quién creó el pedido (y comprobante manual si aplica) en ota_detalle_orden
      try {
        const otaIdCreado = String(data.ordenId || "");
        if (otaIdCreado && /^[0-9a-f-]{36}$/i.test(otaIdCreado)) {
          const { data: otaActual } = await dbMeta
            .schema("comun_comercio")
            .from("com_orden_taller")
            .select("ota_id, ota_detalle_orden")
            .eq("ota_id", otaIdCreado)
            .maybeSingle();
          if (otaActual?.ota_id) {
            const detPrev =
              otaActual.ota_detalle_orden && typeof otaActual.ota_detalle_orden === "object"
                ? otaActual.ota_detalle_orden
                : {};
            const detNuevo: Record<string, any> = {
              ...detPrev,
              creado_por: detPrev.creado_por || creadorPedidoSnap,
              ...(comprobanteManualSnap
                ? {
                    comprobante_transferencia: comprobanteManualSnap,
                    evidencias: {
                      ...(detPrev.evidencias && typeof detPrev.evidencias === "object"
                        ? detPrev.evidencias
                        : {}),
                      comprobante_pago: comprobanteManualSnap,
                    },
                  }
                : {}),
            };
            await dbMeta
              .schema("comun_comercio")
              .from("com_orden_taller")
              .update({
                ota_detalle_orden: detNuevo,
                ota_actualizado_en: new Date().toISOString(),
              })
              .eq("ota_id", otaIdCreado);
          }
        }
      } catch {
        // No bloquear el guardado principal si falla el enriquecimiento de metadata
      }
      if (enviar) {
        const esExeq = entrada.origenTipo === "EXEQUIALES_LLAMADA";
        const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
          "./notificaciones-pedidos-push"
        );
        await despacharPushCambioEstadoPedidoTodosLosRoles({
          supabase,
          negocio: neg,
          pedidoId: String(data.ordenId),
          codigoOrden: String(data.codigo),
          nuevoEstado: "ENVIADO_TALLER",
          etiquetaEstado: esExeq ? "Urgente Exequiales · En Taller" : "Enviado a Taller",
          compradorNombre: entrada.destinatarioFallecido || entrada.clienteSolicita,
          tituloPersonalizado: esExeq
            ? `🕯️ URGENTE Exequiales (${entrada.salaServicio || "Sala"}): ${data.codigo}`
            : `🌸 Pedido enviado a Taller (${entrada.fechaEntrega}): ${data.codigo}`,
          cuerpoPlanoPersonalizado: `${data.codigo} · ${entrada.productoResumen} (${entrada.destinatarioFallecido || entrada.clienteSolicita})`,
          contenidoHtmlPersonalizado: esExeq
            ? `<p><strong>Orden Exequiales:</strong> ${data.codigo}</p>
               <p><strong>Producto:</strong> ${entrada.productoResumen}</p>
               <p><strong>Fecha / Hora:</strong> ${entrada.fechaEntrega}${entrada.horaEspecifica ? ` · ${entrada.horaEspecifica}` : ""}</p>
               <p><strong>Solicita:</strong> ${entrada.clienteSolicita} · <strong>Sala:</strong> ${entrada.salaServicio || "Por confirmar"}</p>
               <p><strong>Fallecido:</strong> ${entrada.destinatarioFallecido || "Por confirmar"}</p>`
            : `<p><strong>Pedido:</strong> ${data.codigo}</p>
               <p><strong>Detalle:</strong> ${entrada.productoResumen}</p>
               <p><strong>Entrega:</strong> ${entrada.fechaEntrega} (${entrada.franjaHoraria || "Horario estándar"})</p>
               <p><strong>Destinatario:</strong> ${entrada.destinatarioFallecido || entrada.clienteSolicita}</p>`,
        });
      }

      revalidarRutasTienda(neg);
      return {
        ok: true,
        ordenId: String(data.ordenId),
        codigo: String(data.codigo),
        estadoTaller: (data.estadoTaller as EstadoOrdenTaller) || "ENVIADO_TALLER",
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo guardar el pedido") };
    }

    // Respaldo resiliente sobre com_entrega_evidencia (si es Exequiales) o com_proforma (si es Manual)
    if (entrada.origenTipo === "EXEQUIALES_LLAMADA") {
      const uuidCli = crypto.randomUUID();
      const resOt = await registrarOSincronizarEntregaAction({
        negocio: neg,
        uuidCliente: uuidCli,
        tipoOrigen: "ORDEN_TRABAJO_CONVENIO",
        soloProgramarOt: true,
        fallecidoDestinatario:
          entrada.destinatarioFallecido?.trim() ||
          `Por confirmar (${entrada.salaServicio || "Exequiales"})`,
        fechaServicio: `${entrada.fechaEntrega}T12:00:00.000Z`,
        descripcionServicio: entrada.productoResumen || "Set condolencias (3 arreglos)",
        salaServicio: entrada.salaServicio,
        ubicacionNombre: entrada.ubicacionEntrega || "Exequiales del IESS",
        coordinadorNombre: entrada.clienteSolicita,
        observaciones: entrada.horaEspecifica
          ? `Hora: ${entrada.horaEspecifica}${entrada.observaciones ? ` · ${entrada.observaciones}` : ""}`
          : entrada.observaciones,
      });
      if (!resOt.ok) return { ok: false, error: resOt.error };
      revalidarRutasTienda(neg);
      return {
        ok: true,
        ordenId: resOt.entregaId,
        codigo: resOt.codigoOt,
        estadoTaller: "ENVIADO_TALLER",
      };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const estTaller: EstadoOrdenTaller = enviar ? "ENVIADO_TALLER" : "PENDIENTE_ENVIO";
    const nombreClienteLimpio = (
      entrada.clienteSolicita ||
      entrada.destinatarioFallecido ||
      "Cliente"
    ).trim();
    const montoTotal = Number(entrada.totalUsd ?? 0);
    const itemsMapeados = (
      entrada.items && entrada.items.length > 0
        ? entrada.items
        : [{ descripcion: entrada.productoResumen, cantidad: 1 }]
    ).map((it) => ({
      producto_nombre: it.descripcion,
      descripcion: it.descripcion,
      sku: it.sku || "MANUAL",
      cantidad: it.cantidad,
      pvp_unitario: it.precioUnitario ?? 0,
      total_linea: (it.precioUnitario ?? 0) * it.cantidad,
      dedicatoria: entrada.dedicatoria
        ? {
            para: entrada.destinatarioFallecido || "",
            de: nombreClienteLimpio,
            mensaje: entrada.dedicatoria,
          }
        : undefined,
    }));

    // Si es edición de una proforma existente en modo híbrido
    if (entrada.ordenId && /^[0-9a-f-]{36}$/i.test(entrada.ordenId)) {
      const { data: previa } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_detalle_proforma")
        .eq("prf_id", entrada.ordenId)
        .maybeSingle();

      if (previa?.prf_id) {
        const detPrevio = (previa.prf_detalle_proforma ?? {}) as Record<string, any>;
        const codigoExistente = String(
          detPrevio.codigo_orden || `PED-${entrada.ordenId.slice(0, 5).toUpperCase()}`
        );
        const { error: errUpd } = await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_cliente_nombre: nombreClienteLimpio,
            prf_cliente_contacto: {
              nombre: nombreClienteLimpio,
              telefono: entrada.clienteTelefono || "",
            },
            prf_estado: enviar
              ? "EN_PREPARACION"
              : entrada.estadoPago || String(detPrevio.estado_pago || "APROBADA"),
            prf_observaciones: entrada.observaciones || null,
            prf_detalle_proforma: {
              ...detPrevio,
              codigo_orden: codigoExistente,
              estado_taller: enviar ? "ENVIADO_TALLER" : detPrevio.estado_taller || "PENDIENTE_ENVIO",
              fecha_elaboracion: enviar
                ? obtenerFechaHoyEcuadorYmd()
                : entrada.fechaElaboracion || detPrevio.fecha_elaboracion,
              enviado_taller_en: enviar
                ? detPrevio.enviado_taller_en || new Date().toISOString()
                : detPrevio.enviado_taller_en || null,
              comprador: {
                ...(detPrevio.comprador ?? {}),
                nombreCompleto: nombreClienteLimpio,
                whatsapp: entrada.clienteTelefono || "",
              },
              logistica_entrega: {
                ...(detPrevio.logistica_entrega ?? {}),
                destinatario_nombre: entrada.destinatarioFallecido || nombreClienteLimpio,
                direccion: entrada.ubicacionEntrega || "",
                enlace_mapa: entrada.enlaceMapa || "",
                retiro_en_local: Boolean(entrada.retiroEnLocal),
                fecha_entrega: entrada.fechaEntrega,
                franja_horaria: normalizarFranjaHorariaTienda(entrada.franjaHoraria),
              },
              items: itemsMapeados,
              notas_taller: entrada.observaciones || "",
            },
            prf_actualizado_en: new Date().toISOString(),
          })
          .eq("prf_id", previa.prf_id);

        if (errUpd) {
          return { ok: false, error: errUpd.message };
        }

        revalidarRutasTienda(neg);
        return {
          ok: true,
          ordenId: String(previa.prf_id),
          codigo: codigoExistente,
          estadoTaller: estTaller,
        };
      }
    }

    const codigoManual = `PED-${Date.now().toString().slice(-5)}`;
    const tokenTarjetaNuevo = crypto.randomUUID();
    const tipoTarjetaInicial =
      entrada.tarjetaTipo ||
      (entrada.clasificacionPedido === "EXEQUIALES" ||
      entrada.productoResumen.toLowerCase().includes("condolen")
        ? "CONDOLENCIAS_PLANA"
        : "DIPTICO");
    const { data: insPrf, error: errPrf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .insert({
        prf_negocio: neg,
        prf_cliente_nombre: nombreClienteLimpio,
        prf_estado: enviar ? "EN_PREPARACION" : entrada.estadoPago || "APROBADA",
        prf_subtotal: montoTotal,
        prf_descuento: 0,
        prf_iva: 0,
        prf_total: montoTotal,
        prf_token_aprobacion: tokenTarjetaNuevo,
        prf_observaciones: entrada.observaciones || null,
        prf_cliente_contacto: {
          nombre: nombreClienteLimpio,
          telefono: entrada.clienteTelefono || "",
        },
        prf_detalle_proforma: {
          tipo_origen: "MANUAL_ADMIN",
          clasificacion_pedido: entrada.clasificacionPedido,
          codigo_orden: codigoManual,
          creado_por: creadorPedidoSnap,
          ...(comprobanteManualSnap
            ? {
                comprobante_transferencia: comprobanteManualSnap,
                evidencias: { comprobante_pago: comprobanteManualSnap },
              }
            : {}),
          estado_taller: estTaller,
          fecha_elaboracion: enviar ? obtenerFechaHoyEcuadorYmd() : entrada.fechaElaboracion,
          enviado_taller_en: enviar ? new Date().toISOString() : null,
          metodo_pago: entrada.metodoPago || "manual",
          comprador: {
            nombreCompleto: nombreClienteLimpio,
            whatsapp: entrada.clienteTelefono || "",
          },
          logistica_entrega: {
            destinatario_nombre: entrada.destinatarioFallecido || nombreClienteLimpio,
            direccion: entrada.ubicacionEntrega || "",
            enlace_mapa: entrada.enlaceMapa || "",
            retiro_en_local: Boolean(entrada.retiroEnLocal),
            fecha_entrega: entrada.fechaEntrega,
            franja_horaria: normalizarFranjaHorariaTienda(entrada.franjaHoraria),
            sala_servicio: entrada.salaServicio || undefined,
          },
          items: itemsMapeados,
          notas_taller: entrada.observaciones || "",
          tarjeta: {
            token: tokenTarjetaNuevo,
            tipo: tipoTarjetaInicial,
            confidencial: Boolean(entrada.tarjetaConfidencial),
            mensaje: entrada.dedicatoria?.trim() || "",
            para: entrada.destinatarioFallecido || "",
            de: nombreClienteLimpio,
            musica_url:
              tipoTarjetaInicial === "CONDOLENCIAS_PLANA"
                ? null
                : entrada.tarjetaMusicaUrl || null,
            musica_titulo:
              tipoTarjetaInicial === "CONDOLENCIAS_PLANA"
                ? null
                : entrada.tarjetaMusicaTitulo || null,
            lyrics:
              tipoTarjetaInicial === "CONDOLENCIAS_PLANA"
                ? []
                : entrada.tarjetaLyrics ?? [],
            metadata: {
              origen: "AUTOMATICO_SISTEMA",
              confidencial_solo_qr: Boolean(entrada.tarjetaConfidencial),
              vistas_cliente: 0,
              impresiones: 0,
              historial_cambios: [],
            },
          },
        },
      })
      .select("prf_id")
      .single();

    if (errPrf || !insPrf?.prf_id) {
      return { ok: false, error: errPrf?.message || "No se pudo registrar el pedido manual" };
    }

    if (enviar) {
      try {
        const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
          "./notificaciones-pedidos-push"
        );
        await despacharPushCambioEstadoPedidoTodosLosRoles({
          supabase,
          negocio: neg,
          pedidoId: String(insPrf.prf_id),
          codigoOrden: codigoManual,
          nuevoEstado: "ENVIADO_TALLER",
          etiquetaEstado: "Enviado a Taller",
          compradorNombre: entrada.destinatarioFallecido || nombreClienteLimpio,
          tituloPersonalizado: `🌸 Pedido enviado a Taller (${entrada.fechaEntrega}): ${codigoManual}`,
          cuerpoPlanoPersonalizado: `${codigoManual} · ${entrada.productoResumen} (${entrada.destinatarioFallecido || nombreClienteLimpio})`,
        });
      } catch {
        // No interrumpir guardado si falla push secundario
      }
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      ordenId: String(insPrf.prf_id),
      codigo: codigoManual,
      estadoTaller: estTaller,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar y programar pedido",
    };
  }
}

export async function enviarPedidosATallerAction(entrada: {
  negocio: string;
  ordenesIds: string[];
}): Promise<{ ok: true; enviados: number; codigos: string[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const ids = Array.from(
      new Set((entrada.ordenesIds || []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))
    );
    if (ids.length === 0) {
      return { ok: false, error: "Selecciona al menos un pedido válido para enviar a Taller." };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const rol = await resolverRolOperativoUsuarioServidor(supabase, neg);
    if (!["SUPERADMIN", "ADMINISTRADOR", "OPERADOR"].includes(rol)) {
      return {
        ok: false,
        error: "Solo un Administrador u Operador puede enviar pedidos a Taller.",
      };
    }

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_enviar_pedidos_a_taller",
      {
        p_negocio: neg,
        p_ids: ids,
      }
    );

    if (!error && data?.ok) {
      const codigos: string[] = Array.isArray(data.codigos) ? data.codigos.map(String) : [];
      const codigoPrincipal = codigos[0] || "PEDIDO";
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: ids[0] ?? null,
        codigoOrden: codigoPrincipal,
        nuevoEstado: "ENVIADO_TALLER",
        etiquetaEstado: "Enviado a Taller",
        tituloPersonalizado:
          codigos.length === 1
            ? `🌸 Pedido ${codigoPrincipal} · Enviado a Taller`
            : `🌸 ${Number(data.enviados || ids.length)} pedidos enviados a Taller (${codigos.join(", ")})`,
        cuerpoPlanoPersonalizado: `Pedidos enviados a elaboración en Taller: ${codigos.join(", ")}. Toca para ver detalle.`,
        contenidoHtmlPersonalizado: `<p>Se enviaron <strong>${Number(
          data.enviados || ids.length
        )}</strong> pedido(s) para elaboración en Taller: <strong>${codigos.join(", ")}</strong>.</p>`,
      });

      revalidarRutasTienda(neg);
      return {
        ok: true,
        enviados: Number(data.enviados || ids.length),
        codigos,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo híbrido sobre com_proforma
    const db: any = crearClienteAdmin() ?? supabase;
    const codigos: string[] = [];
    for (const id of ids) {
      const { data: fila } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_detalle_proforma")
        .eq("prf_id", id)
        .maybeSingle();
      if (fila?.prf_id) {
        const det = (fila.prf_detalle_proforma ?? {}) as Record<string, any>;
        codigos.push(String(det.codigo_orden || id.slice(0, 8)));
        await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_estado: "EN_PREPARACION",
            prf_detalle_proforma: {
              ...det,
              estado_taller: "ENVIADO_TALLER",
              fecha_elaboracion: obtenerFechaHoyEcuadorYmd(),
              enviado_taller_en: new Date().toISOString(),
            },
            prf_actualizado_en: new Date().toISOString(),
          })
          .eq("prf_id", id);
      }
    }

    revalidarRutasTienda(neg);
    return { ok: true, enviados: codigos.length, codigos };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando pedidos a Taller",
    };
  }
}

export async function actualizarEstadoOrdenTallerAction(entrada: {
  negocio: string;
  ordenId: string;
  nuevoEstado: EstadoOrdenTaller;
  notasTaller?: string;
}): Promise<{ ok: true; estadoTaller: EstadoOrdenTaller } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_actualizar_estado_taller",
      {
        p_negocio: neg,
        p_orden_id: entrada.ordenId,
        p_nuevo_estado: entrada.nuevoEstado,
        p_notas_taller: entrada.notasTaller ?? null,
      }
    );

    if (!error && data?.ok) {
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: entrada.ordenId,
        codigoOrden: String(data.codigo || "PEDIDO"),
        nuevoEstado: entrada.nuevoEstado,
        compradorNombre: data.productoResumen ? String(data.productoResumen) : null,
      });

      revalidarRutasTienda(neg);
      return {
        ok: true,
        estadoTaller: (data.estadoTaller as EstadoOrdenTaller) || entrada.nuevoEstado,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo sobre com_proforma o com_entrega_evidencia
    const db: any = crearClienteAdmin() ?? supabase;
    const { data: filaPrf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_id, prf_detalle_proforma")
      .eq("prf_id", entrada.ordenId)
      .maybeSingle();

    if (filaPrf?.prf_id) {
      const det = (filaPrf.prf_detalle_proforma ?? {}) as Record<string, any>;
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_estado:
            entrada.nuevoEstado === "LISTO_ENTREGA"
              ? "EN_RUTA"
              : entrada.nuevoEstado === "ENTREGADO"
                ? "ENTREGADO"
                : "EN_PREPARACION",
          prf_detalle_proforma: {
            ...det,
            estado_taller: entrada.nuevoEstado,
            notas_taller: entrada.notasTaller ?? det.notas_taller,
          },
          prf_actualizado_en: new Date().toISOString(),
        })
        .eq("prf_id", entrada.ordenId);
    } else {
      const { data: filaEnt } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("ent_id, ent_detalle_entrega")
        .eq("ent_id", entrada.ordenId)
        .maybeSingle();
      if (filaEnt?.ent_id) {
        const detE = (filaEnt.ent_detalle_entrega ?? {}) as Record<string, any>;
        await db
          .schema("comun_comercio")
          .from("com_entrega_evidencia")
          .update({
            ent_detalle_entrega: {
              ...detE,
              estado_taller: entrada.nuevoEstado,
            },
            ent_actualizado_en: new Date().toISOString(),
          })
          .eq("ent_id", entrada.ordenId);
      }
    }

    revalidarRutasTienda(neg);
    return { ok: true, estadoTaller: entrada.nuevoEstado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar estado en Taller",
    };
  }
}

export async function asignarRepartidorEntregaAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  repartidorId: string | null;
  repartidorNombre?: string | null;
  repartidorTipo?: "INTERNO" | "EXTERNO" | null;
}): Promise<
  | {
      ok: true;
      repartidorId: string | null;
      repartidorNombre: string | null;
      repartidorTipo: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_asignar_repartidor_entrega",
      {
        p_negocio: neg,
        p_orden_taller_id: entrada.ordenTallerId ?? null,
        p_entrega_id: entrada.entregaId ?? null,
        p_repartidor_id: entrada.repartidorId ?? null,
        p_repartidor_nombre: entrada.repartidorNombre ?? null,
        p_repartidor_tipo: entrada.repartidorTipo ?? "INTERNO",
      }
    );

    if (!error && data?.ok) {
      if (entrada.repartidorId) {
        await notificarPersonalTallerODespacho({
          negocio: neg,
          titulo: `🛵 Entrega asignada: ${entrada.repartidorNombre || "Delivery"}`,
          contenidoHtml: `<p>Tienes un pedido asignado para entrega en tu consola de Entregas GPS.</p>`,
          urlAccion: "/panel/entregas",
          roles: ["DELIVERY", "DELIVERY_EXTERNO", "REPARTIDOR"],
          claveReferencia: `delivery-asignado:${entrada.ordenTallerId || entrada.entregaId || Date.now()}`,
        });
      }
      revalidarRutasTienda(neg);
      return {
        ok: true,
        repartidorId: data.repartidorId ? String(data.repartidorId) : null,
        repartidorNombre: data.repartidorNombre ? String(data.repartidorNombre) : null,
        repartidorTipo: data.repartidorTipo ? String(data.repartidorTipo) : null,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo asignar el repartidor") };
    }

    return {
      ok: true,
      repartidorId: entrada.repartidorId,
      repartidorNombre: entrada.repartidorNombre ?? null,
      repartidorTipo: entrada.repartidorTipo ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error asignando repartidor",
    };
  }
}

export async function actualizarUbicacionRutaDeliveryAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  proformaId?: string | null;
  enRuta: boolean;
  latitud?: number | null;
  longitud?: number | null;
  precision?: number | null;
}): Promise<{ ok: true; enRuta: boolean } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_actualizar_ubicacion_ruta_delivery",
      {
        p_negocio: neg,
        p_orden_taller_id: entrada.ordenTallerId ?? null,
        p_entrega_id: entrada.entregaId ?? null,
        p_proforma_id: entrada.proformaId ?? null,
        p_en_ruta: entrada.enRuta,
        p_latitud: entrada.latitud ?? null,
        p_longitud: entrada.longitud ?? null,
        p_precision: entrada.precision ?? null,
      }
    );

    if (!error && data?.ok) {
      return { ok: true, enRuta: Boolean(data.enRuta) };
    }
    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: true, enRuta: entrada.enRuta };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error reportando ubicación en ruta",
    };
  }
}

function parsearLrcSincronizado(lrcTexto: string): Array<{ tiempo: number; texto: string }> {
  const lineas = lrcTexto.split(/\r?\n/);
  const resultado: Array<{ tiempo: number; texto: string }> = [];
  const regexTiempo = /\[(\d{1,3}):(\d{2})(?:[.:](\d{1,3}))?\]/g;

  for (const linea of lineas) {
    const matches = [...linea.matchAll(regexTiempo)];
    if (matches.length === 0) continue;
    const textoLimpio = linea.replace(regexTiempo, "").trim();
    if (!textoLimpio) continue;
    for (const m of matches) {
      const min = Number(m[1] || 0);
      const seg = Number(m[2] || 0);
      const fracStr = m[3] || "0";
      const frac = Number(fracStr) / Math.pow(10, fracStr.length);
      resultado.push({
        tiempo: Math.round((min * 60 + seg + frac) * 100) / 100,
        texto: textoLimpio,
      });
    }
  }
  return resultado.sort((a, b) => a.tiempo - b.tiempo);
}

export async function buscarLyricsCancionAction(entrada: {
  musicaUrl?: string | null;
  musicaTitulo?: string | null;
}): Promise<{
  ok: boolean;
  tituloDetectado?: string;
  lyrics?: Array<{ tiempo?: number; texto: string }>;
  sincronizado?: boolean;
  error?: string;
}> {
  try {
    let tituloBase = (entrada.musicaTitulo || "").trim();
    const url = (entrada.musicaUrl || "").trim();

    if (url && (!tituloBase || /youtube\.com|youtu\.be/i.test(url))) {
      try {
        const resOembed = await fetch(
          `https://noembed.com/embed?url=${encodeURIComponent(url)}`,
          { signal: AbortSignal.timeout(4500) }
        );
        if (resOembed.ok) {
          const info = (await resOembed.json()) as { title?: string; author_name?: string };
          if (!tituloBase && info?.title) {
            tituloBase = info.title.trim();
          }
        }
      } catch {
        // Ignorar si noembed no responde
      }
    }

    const queryLimpia = tituloBase
      .replace(/\((official|video|lyric|lyrics|letra|audio|hd|4k|live|en vivo|remastered)[^)]*\)/gi, "")
      .replace(/\[(official|video|lyric|lyrics|letra|audio|hd|4k|live|en vivo)[^\]]*\]/gi, "")
      .replace(/\b(official music video|video oficial|letra oficial|lyrics)\b/gi, "")
      .replace(/\s+/g, " ")
      .trim();

    if (!queryLimpia) {
      return {
        ok: false,
        error: "Ingresa el nombre de la canción (ej. Ed Sheeran - Perfect) o un link válido de YouTube.",
      };
    }

    const resLrc = await fetch(
      `https://lrclib.net/api/search?q=${encodeURIComponent(queryLimpia)}`,
      {
        headers: { "User-Agent": "TinkayFloristeria/1.0 (https://tinkay-web.vercel.app)" },
        signal: AbortSignal.timeout(6000),
      }
    );

    if (!resLrc.ok) {
      return {
        ok: false,
        tituloDetectado: tituloBase || queryLimpia,
        error: "No se pudo consultar el catálogo de letras en este momento. Puedes pegar la letra manualmente.",
      };
    }

    const resultados = (await resLrc.json()) as Array<{
      trackName?: string;
      artistName?: string;
      syncedLyrics?: string | null;
      plainLyrics?: string | null;
    }>;

    if (!Array.isArray(resultados) || resultados.length === 0) {
      return {
        ok: false,
        tituloDetectado: tituloBase || queryLimpia,
        error: `No se encontró letra automática para "${queryLimpia}". Prueba con "Artista - Canción" o pégala abajo.`,
      };
    }

    const conSync = resultados.find((r) => r.syncedLyrics && r.syncedLyrics.trim().length > 20);
    const elegido = conSync || resultados.find((r) => r.plainLyrics && r.plainLyrics.trim().length > 10) || resultados[0];
    const etiquetaCancion =
      elegido?.artistName && elegido?.trackName
        ? `${elegido.artistName} — ${elegido.trackName}`
        : tituloBase || queryLimpia;

    if (elegido?.syncedLyrics) {
      const parsed = parsearLrcSincronizado(elegido.syncedLyrics);
      if (parsed.length > 0) {
        return {
          ok: true,
          tituloDetectado: etiquetaCancion,
          lyrics: parsed,
          sincronizado: true,
        };
      }
    }

    if (elegido?.plainLyrics) {
      const lineasPlanas = elegido.plainLyrics
        .split(/\r?\n/)
        .map((l) => l.trim())
        .filter(Boolean)
        .map((texto, idx) => ({
          tiempo: Math.round((4 + idx * 4.2) * 10) / 10,
          texto,
        }));
      if (lineasPlanas.length > 0) {
        return {
          ok: true,
          tituloDetectado: etiquetaCancion,
          lyrics: lineasPlanas,
          sincronizado: false,
        };
      }
    }

    return {
      ok: false,
      tituloDetectado: etiquetaCancion,
      error: "La canción encontrada es instrumental o no dispone de letra registrada.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al buscar la letra de la canción",
    };
  }
}

export async function subirAudioTarjetaAction(entrada: {
  negocio: string;
  dataUrl: string;
  nombreArchivo?: string;
}): Promise<{ ok: true; publicUrl: string; nombreLimpio: string } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio || "tinkay");
    const coma = entrada.dataUrl.indexOf(",");
    if (coma < 0) {
      return { ok: false, error: "Archivo de audio inválido." };
    }
    const meta = entrada.dataUrl.slice(5, coma);
    const contentType = meta.split(";")[0] || "audio/mpeg";
    if (!contentType.startsWith("audio/") && !contentType.includes("mpeg") && !contentType.includes("mp4")) {
      return { ok: false, error: "Solo se permiten archivos de audio (MP3, M4A, WAV, OGG)." };
    }
    const base64 = entrada.dataUrl.slice(coma + 1);
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > 15 * 1024 * 1024) {
      return { ok: false, error: "El archivo de audio supera el límite máximo de 15 MB." };
    }

    const ext = contentType.includes("wav")
      ? "wav"
      : contentType.includes("ogg")
        ? "ogg"
        : contentType.includes("mp4") || contentType.includes("m4a")
          ? "m4a"
          : "mp3";
    const fechaCarpeta = new Date().toISOString().slice(0, 7);
    const ruta = `tarjetas-audio/${neg}/${fechaCarpeta}/${crypto.randomUUID()}.${ext}`;

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    const { error } = await db.storage.from("comun-publico").upload(ruta, buffer, {
      contentType,
      upsert: false,
    });
    if (error) {
      return { ok: false, error: error.message };
    }
    const { data } = db.storage.from("comun-publico").getPublicUrl(ruta);
    const nombreLimpio = (entrada.nombreArchivo || "Melodía personalizada")
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .trim();

    return {
      ok: true,
      publicUrl: String(data?.publicUrl || ""),
      nombreLimpio,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al subir archivo de audio",
    };
  }
}

export async function subirImagenTarjetaAction(entrada: {
  negocio: string;
  dataUrl: string;
  nombreArchivo?: string;
}): Promise<{ ok: true; publicUrl: string; nombreLimpio: string } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio || "tinkay");
    const coma = entrada.dataUrl.indexOf(",");
    if (coma < 0) {
      return { ok: false, error: "Archivo de imagen inválido." };
    }
    const meta = entrada.dataUrl.slice(5, coma);
    const contentType = meta.split(";")[0] || "image/png";
    if (!contentType.startsWith("image/")) {
      return { ok: false, error: "Solo se permiten imágenes (PNG, JPG, WEBP)." };
    }
    const base64 = entrada.dataUrl.slice(coma + 1);
    const buffer = Buffer.from(base64, "base64");
    if (buffer.byteLength > 8 * 1024 * 1024) {
      return { ok: false, error: "La imagen supera el tamaño máximo de 8 MB." };
    }

    const ext = contentType.includes("png")
      ? "png"
      : contentType.includes("webp")
        ? "webp"
        : contentType.includes("gif")
          ? "gif"
          : "jpg";
    const fechaCarpeta = new Date().toISOString().slice(0, 7);
    const ruta = `tarjetas-imagenes/${neg}/${fechaCarpeta}/${crypto.randomUUID()}.${ext}`;
    const nombreLimpio = (entrada.nombreArchivo || "Imagen tarjeta")
      .replace(/\.[a-z0-9]{2,4}$/i, "")
      .trim();

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    const { error } = await db.storage.from("comun-publico").upload(ruta, buffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      // Respaldo resiliente si el usuario no está autenticado y aún no corre la política de storage 000009
      if (entrada.dataUrl.length <= 420000) {
        return {
          ok: true,
          publicUrl: entrada.dataUrl,
          nombreLimpio,
        };
      }
      return { ok: false, error: error.message };
    }

    const { data } = db.storage.from("comun-publico").getPublicUrl(ruta);
    return {
      ok: true,
      publicUrl: String(data?.publicUrl || ""),
      nombreLimpio,
    };
  } catch (err) {
    if (entrada.dataUrl && entrada.dataUrl.startsWith("data:image/") && entrada.dataUrl.length <= 420000) {
      return {
        ok: true,
        publicUrl: entrada.dataUrl,
        nombreLimpio: "Imagen tarjeta",
      };
    }
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al subir la imagen de la tarjeta",
    };
  }
}

export async function guardarEdicionPedidoYTarjetaAction(entrada: {
  negocio: string;
  pedidoId: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  clasificacionPedido?: ClasificacionOperativaPedido;
  compradorNombre?: string;
  compradorTelefono?: string;
  destinatarioNombre?: string;
  direccionEntrega?: string;
  enlaceMapa?: string;
  retiroEnLocal?: boolean;
  salaServicio?: string | null;
  fechaEntrega?: string;
  franjaHoraria?: string | null;
  horaEspecifica?: string | null;
  productoResumen?: string;
  observaciones?: string;
  dedicatoria?: string;
  tarjetaTipo?: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
  tarjetaConfidencial?: boolean;
  tarjetaDiseno?: DisenoVisualTarjeta;
  tarjetaMusicaUrl?: string | null;
  tarjetaMusicaTitulo?: string | null;
  tarjetaLyrics?: Array<{ tiempo?: number; texto: string }>;
}): Promise<{
  ok: boolean;
  tarjetaToken?: string;
  tarjetaTokenEdicion?: string;
  tarjetaConfidencial?: boolean;
  tarjetaMetadata?: Record<string, any>;
  error?: string;
}> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    if (
      entrada.clasificacionPedido === "EXEQUIALES" &&
      entrada.destinatarioNombre !== undefined &&
      esNombreFallecidoPendiente(entrada.destinatarioNombre)
    ) {
      return {
        ok: false,
        error:
          "En pedidos de Exequiales, el nombre de la Persona Fallecida (Destinatario) es obligatorio.",
      };
    }
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Debes iniciar sesión para editar el pedido o la tarjeta." };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    let autorNombre = user.email?.split("@")[0] || "Staff Tinkay";
    let autorRol = "STAFF_TINKAY";

    try {
      const { data: usu } = await db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
        .eq("usu_id", user.id)
        .maybeSingle();
      if (usu) {
        const completo = `${usu.usu_nombres || ""} ${usu.usu_apellidos || ""}`.trim();
        if (completo) autorNombre = completo;
        if (usu.usu_superadmin_plataforma) autorRol = "SUPERADMIN";
      }
      if (autorRol === "STAFF_TINKAY") {
        const { data: mem } = await db
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_rol")
          .eq("mem_usuario_id", user.id)
          .eq("mem_estado", "ACTIVO")
          .limit(1)
          .maybeSingle();
        if (mem?.mem_rol) autorRol = String(mem.mem_rol).toUpperCase();
      }
    } catch {
      // Conservar nombre de respaldo
    }

    const esSoloEdicionTarjeta =
      entrada.clasificacionPedido === undefined &&
      entrada.direccionEntrega === undefined &&
      entrada.enlaceMapa === undefined &&
      entrada.retiroEnLocal === undefined &&
      entrada.salaServicio === undefined &&
      entrada.fechaEntrega === undefined &&
      entrada.franjaHoraria === undefined &&
      entrada.horaEspecifica === undefined &&
      entrada.productoResumen === undefined &&
      entrada.observaciones === undefined;

    // 0. Vía principal transaccional SECURITY DEFINER para guardar diseño completo de tarjeta sin depender de GRANT UPDATE
    if (esSoloEdicionTarjeta) {
      const { data: resStaff, error: errStaff } = await invocarRpcComercio(
        supabase,
        "com_fn_guardar_tarjeta_staff",
        {
          p_negocio: neg,
          p_payload: {
            pedidoId: entrada.pedidoId,
            ordenTallerId: entrada.ordenTallerId ?? null,
            entregaId: entrada.entregaId ?? null,
            compradorNombre: entrada.compradorNombre,
            destinatarioNombre: entrada.destinatarioNombre,
            dedicatoria: entrada.dedicatoria,
            tarjetaTipo: entrada.tarjetaTipo,
            tarjetaConfidencial: entrada.tarjetaConfidencial,
            tarjetaDiseno: entrada.tarjetaDiseno ?? null,
            tarjetaMusicaUrl: entrada.tarjetaMusicaUrl ?? null,
            tarjetaMusicaTitulo: entrada.tarjetaMusicaTitulo ?? null,
            tarjetaLyrics: entrada.tarjetaLyrics ?? [],
          },
        }
      );

      if (!errStaff && resStaff?.ok) {
        const tokRes = resStaff.tarjetaToken ? String(resStaff.tarjetaToken) : undefined;
        const tokEdRes = tokRes ? generarTokenEdicionTarjetaServidor(tokRes) : undefined;
        revalidarRutasTienda(neg);
        if (tokRes) {
          try {
            revalidatePath(`/dedicatoria/${tokRes}`);
            if (tokEdRes) revalidatePath(`/tarjeta-editar/${tokEdRes}`);
          } catch {}
        }
        return {
          ok: true,
          tarjetaToken: tokRes,
          tarjetaTokenEdicion: tokEdRes,
          tarjetaConfidencial: Boolean(resStaff.tarjetaConfidencial),
          tarjetaMetadata:
            resStaff.tarjetaMetadata && typeof resStaff.tarjetaMetadata === "object"
              ? resStaff.tarjetaMetadata
              : undefined,
        };
      }

      if (!errStaff && resStaff && resStaff.ok === false) {
        return {
          ok: false,
          error: String(resStaff.error || "No se pudo guardar la tarjeta."),
        };
      }
    }

    const ahoraIso = new Date().toISOString();
    let tokenFinal: string | undefined;
    let metaFinal: Record<string, any> | undefined;
    let actualizadoEnBdd = false;
    let ultimoErrorDb: string | null = null;

    // 1. Intentar actualizar com_orden_taller si existe la tabla y la fila vinculada
    try {
      const idCandidatoOta = entrada.ordenTallerId || entrada.pedidoId;
      const { data: filaOta } = await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .select("*")
        .or(`ota_id.eq.${idCandidatoOta},ota_proforma_id.eq.${entrada.pedidoId}`)
        .limit(1)
        .maybeSingle();

      if (filaOta?.ota_id) {
        const metaPrevia =
          filaOta.ota_tarjeta_metadata && typeof filaOta.ota_tarjeta_metadata === "object"
            ? { ...filaOta.ota_tarjeta_metadata }
            : { origen: "AUTOMATICO_SISTEMA", historial_cambios: [], vistas_cliente: 0, impresiones: 0 };

        const histPrevio = Array.isArray(metaPrevia.historial_cambios)
          ? [...metaPrevia.historial_cambios]
          : [];

        const tipoResueltoOta =
          entrada.tarjetaTipo || filaOta.ota_tarjeta_tipo || "DIPTICO";
        const esCondolOta = tipoResueltoOta === "CONDOLENCIAS_PLANA";
        const dedNueva =
          entrada.dedicatoria !== undefined ? entrada.dedicatoria.trim() : filaOta.ota_dedicatoria;
        const musNueva = esCondolOta
          ? null
          : entrada.tarjetaMusicaUrl !== undefined
            ? entrada.tarjetaMusicaUrl?.trim() || null
            : filaOta.ota_tarjeta_musica_url;
        const confOta = esCondolOta
          ? false
          : entrada.tarjetaConfidencial !== undefined
            ? Boolean(entrada.tarjetaConfidencial)
            : Boolean(metaPrevia.confidencial_solo_qr);
        const disenoOta =
          entrada.tarjetaDiseno !== undefined ? entrada.tarjetaDiseno : metaPrevia.diseno;

        if (dedNueva !== filaOta.ota_dedicatoria || musNueva !== filaOta.ota_tarjeta_musica_url) {
          histPrevio.push({
            autor: autorNombre,
            rol: autorRol,
            fecha: ahoraIso,
            dedicatoria_anterior: filaOta.ota_dedicatoria || "",
            dedicatoria_nueva: dedNueva || "",
            musica_url_anterior: filaOta.ota_tarjeta_musica_url || null,
            musica_url_nueva: musNueva,
          });
        }

        const nuevaMeta = {
          ...metaPrevia,
          confidencial_solo_qr: confOta,
          ...(disenoOta ? { diseno: disenoOta } : {}),
          editado_por_staff: true,
          ultimo_editor_nombre: autorNombre,
          ultimo_editor_rol: autorRol,
          ultima_edicion_staff_en: ahoraIso,
          historial_cambios: histPrevio,
        };

        const tokenOta =
          filaOta.ota_tarjeta_token || crypto.randomUUID().replace(/-/g, "").slice(0, 18);

        const { error: errOta } = await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({
            ...(entrada.clasificacionPedido
              ? { ota_clasificacion_pedido: entrada.clasificacionPedido }
              : {}),
            ota_cliente_solicita:
              entrada.compradorNombre?.trim() || filaOta.ota_cliente_solicita,
            ota_cliente_telefono:
              entrada.clasificacionPedido === "EXEQUIALES"
                ? null
                : entrada.compradorTelefono !== undefined
                  ? entrada.compradorTelefono.trim() || null
                  : filaOta.ota_cliente_telefono,
            ota_destinatario_fallecido:
              entrada.destinatarioNombre !== undefined
                ? entrada.destinatarioNombre.trim()
                : filaOta.ota_destinatario_fallecido,
            ota_ubicacion_entrega:
              entrada.clasificacionPedido === "EXEQUIALES"
                ? "Exequiales"
                : entrada.direccionEntrega !== undefined
                  ? entrada.direccionEntrega.trim()
                  : filaOta.ota_ubicacion_entrega,
            ota_enlace_mapa:
              entrada.clasificacionPedido === "EXEQUIALES"
                ? null
                : entrada.enlaceMapa !== undefined
                  ? entrada.enlaceMapa.trim() || null
                  : filaOta.ota_enlace_mapa,
            ota_retiro_en_local:
              entrada.clasificacionPedido === "EXEQUIALES"
                ? false
                : entrada.retiroEnLocal !== undefined
                  ? Boolean(entrada.retiroEnLocal)
                  : filaOta.ota_retiro_en_local,
            ota_sala_servicio:
              entrada.salaServicio !== undefined
                ? entrada.salaServicio || null
                : filaOta.ota_sala_servicio,
            ota_fecha_entrega:
              entrada.fechaEntrega?.slice(0, 10) || filaOta.ota_fecha_entrega,
            ota_franja_horaria:
              entrada.franjaHoraria !== undefined
                ? entrada.franjaHoraria
                  ? normalizarFranjaHorariaTienda(entrada.franjaHoraria)
                  : null
                : filaOta.ota_franja_horaria,
            ota_hora_especifica:
              entrada.horaEspecifica !== undefined
                ? entrada.horaEspecifica || null
                : filaOta.ota_hora_especifica,
            ota_producto_resumen:
              entrada.productoResumen?.trim() || filaOta.ota_producto_resumen,
            ota_observaciones:
              entrada.observaciones !== undefined
                ? entrada.observaciones.trim() || null
                : filaOta.ota_observaciones,
            ota_dedicatoria:
              entrada.clasificacionPedido === "EXEQUIALES" ? null : dedNueva || null,
            ota_tarjeta_token: tokenOta,
            ota_tarjeta_tipo: tipoResueltoOta,
            ota_tarjeta_musica_url: musNueva,
            ota_tarjeta_musica_titulo: esCondolOta
              ? null
              : entrada.tarjetaMusicaTitulo !== undefined
                ? entrada.tarjetaMusicaTitulo?.trim() || null
                : filaOta.ota_tarjeta_musica_titulo,
            ota_tarjeta_lyrics: esCondolOta
              ? []
              : entrada.tarjetaLyrics !== undefined
                ? entrada.tarjetaLyrics
                : filaOta.ota_tarjeta_lyrics ?? [],
            ota_tarjeta_metadata: nuevaMeta,
            ota_actualizado_en: ahoraIso,
          })
          .eq("ota_id", filaOta.ota_id);

        if (!errOta) {
          actualizadoEnBdd = true;
          tokenFinal = tokenOta;
          metaFinal = nuevaMeta;
        } else {
          ultimoErrorDb = errOta.message;
          // Respaldo inmediato vía RPC SECURITY DEFINER ya desplegada (20261118000009) si falta GRANT UPDATE
          const { data: resPubFb, error: errPubFb } = await invocarRpcComercio(
            supabase,
            "com_fn_editar_tarjeta_publica",
            {
              p_token: filaOta.ota_tarjeta_token || filaOta.ota_id,
              p_payload: {
                dedicatoria: dedNueva || "",
                para:
                  entrada.destinatarioNombre !== undefined
                    ? entrada.destinatarioNombre.trim()
                    : filaOta.ota_destinatario_fallecido,
                de: entrada.compradorNombre?.trim() || filaOta.ota_cliente_solicita,
                confidencial: confOta,
                diseno: disenoOta ?? null,
                musicaUrl: musNueva,
                musicaTitulo: esCondolOta
                  ? null
                  : entrada.tarjetaMusicaTitulo !== undefined
                    ? entrada.tarjetaMusicaTitulo?.trim() || null
                    : filaOta.ota_tarjeta_musica_titulo,
                lyrics: esCondolOta
                  ? []
                  : entrada.tarjetaLyrics !== undefined
                    ? entrada.tarjetaLyrics
                    : filaOta.ota_tarjeta_lyrics ?? [],
              },
            }
          );
          if (!errPubFb && resPubFb?.ok) {
            actualizadoEnBdd = true;
            tokenFinal = tokenOta;
            metaFinal = nuevaMeta;
          }
        }
      }
    } catch (eOta) {
      ultimoErrorDb = eOta instanceof Error ? eOta.message : ultimoErrorDb;
    }

    // 2. Sincronizar / actualizar com_proforma (Pedidos de Tienda y Pedidos Manuales híbridos)
    if (/^[0-9a-f-]{36}$/i.test(entrada.pedidoId)) {
      const { data: prf } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("*")
        .eq("prf_id", entrada.pedidoId)
        .maybeSingle();

      if (prf?.prf_id) {
        const det = (prf.prf_detalle_proforma ?? {}) as Record<string, any>;
        const logPrevio = (det.logistica_entrega ?? {}) as Record<string, any>;
        const compPrevio = (det.comprador ?? {}) as Record<string, any>;
        const tarPrevia = (det.tarjeta ?? {}) as Record<string, any>;
        const metaPrevia =
          tarPrevia.metadata && typeof tarPrevia.metadata === "object"
            ? { ...tarPrevia.metadata }
            : { origen: "AUTOMATICO_SISTEMA", historial_cambios: [], vistas_cliente: 0, impresiones: 0 };

        const histPrevio = Array.isArray(metaPrevia.historial_cambios)
          ? [...metaPrevia.historial_cambios]
          : [];

        const itemsPrevios = Array.isArray(det.items) ? [...det.items] : [];
        const tipoResueltoPrf = entrada.tarjetaTipo || tarPrevia.tipo || "DIPTICO";
        const esCondolPrf = tipoResueltoPrf === "CONDOLENCIAS_PLANA";
        const confPrf = esCondolPrf
          ? false
          : entrada.tarjetaConfidencial !== undefined
            ? Boolean(entrada.tarjetaConfidencial)
            : Boolean(metaPrevia.confidencial_solo_qr ?? tarPrevia.confidencial);
        const disenoPrf =
          entrada.tarjetaDiseno !== undefined
            ? entrada.tarjetaDiseno
            : tarPrevia.diseno ?? metaPrevia.diseno;
        const primerDedPrevio = itemsPrevios[0]?.dedicatoria?.mensaje || tarPrevia.mensaje || "";
        const dedNueva =
          entrada.dedicatoria !== undefined ? entrada.dedicatoria.trim() : primerDedPrevio;
        const musNueva = esCondolPrf
          ? null
          : entrada.tarjetaMusicaUrl !== undefined
            ? entrada.tarjetaMusicaUrl?.trim() || null
            : tarPrevia.musica_url ?? tarPrevia.musicaUrl ?? null;

        if (!metaFinal && (dedNueva !== primerDedPrevio || musNueva !== (tarPrevia.musica_url ?? null))) {
          histPrevio.push({
            autor: autorNombre,
            rol: autorRol,
            fecha: ahoraIso,
            dedicatoria_anterior: primerDedPrevio,
            dedicatoria_nueva: dedNueva,
            musica_url_anterior: tarPrevia.musica_url ?? null,
            musica_url_nueva: musNueva,
          });
        }

        const nuevaMetaPrf =
          metaFinal ?? {
            ...metaPrevia,
            confidencial_solo_qr: confPrf,
            ...(disenoPrf ? { diseno: disenoPrf } : {}),
            editado_por_staff: true,
            ultimo_editor_nombre: autorNombre,
            ultimo_editor_rol: autorRol,
            ultima_edicion_staff_en: ahoraIso,
            historial_cambios: histPrevio,
          };

        const nombreCompradorNuevo =
          entrada.compradorNombre?.trim() ||
          prf.prf_cliente_nombre ||
          compPrevio.nombreCompleto ||
          "Cliente";
        const telCompradorNuevo =
          entrada.compradorTelefono !== undefined
            ? entrada.compradorTelefono.trim()
            : String(compPrevio.whatsapp || compPrevio.telefono || "");
        const destNuevo =
          entrada.destinatarioNombre !== undefined
            ? entrada.destinatarioNombre.trim()
            : String(logPrevio.destinatario_nombre || nombreCompradorNuevo);

        const tokenPrf = String(
          tokenFinal || tarPrevia.token || prf.prf_token_aprobacion || prf.prf_id
        );

        const itemsActualizados =
          itemsPrevios.length > 0
            ? itemsPrevios.map((it: any, idx: number) =>
                idx === 0
                  ? {
                      ...it,
                      ...(entrada.productoResumen?.trim()
                        ? {
                            descripcion: entrada.productoResumen.trim(),
                            producto_nombre: entrada.productoResumen.trim(),
                          }
                        : {}),
                      dedicatoria: dedNueva
                        ? {
                            para: destNuevo,
                            de: nombreCompradorNuevo,
                            mensaje: dedNueva,
                          }
                        : undefined,
                    }
                  : it
              )
            : [
                {
                  descripcion: entrada.productoResumen?.trim() || "Arreglo floral",
                  producto_nombre: entrada.productoResumen?.trim() || "Arreglo floral",
                  cantidad: 1,
                  pvp_unitario: Number(prf.prf_total ?? 0),
                  total_linea: Number(prf.prf_total ?? 0),
                  dedicatoria: dedNueva
                    ? { para: destNuevo, de: nombreCompradorNuevo, mensaje: dedNueva }
                    : undefined,
                },
              ];

        const { error: errPrf } = await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_cliente_nombre: nombreCompradorNuevo,
            prf_token_aprobacion: prf.prf_token_aprobacion || tokenPrf,
            prf_cliente_contacto: {
              ...(prf.prf_cliente_contacto ?? {}),
              nombre: nombreCompradorNuevo,
              nombreCompleto: nombreCompradorNuevo,
              telefono: telCompradorNuevo,
              whatsapp: telCompradorNuevo,
            },
            prf_observaciones:
              entrada.observaciones !== undefined
                ? entrada.observaciones.trim() || null
                : prf.prf_observaciones,
            prf_detalle_proforma: {
              ...det,
              ...(entrada.clasificacionPedido
                ? { clasificacion_pedido: entrada.clasificacionPedido }
                : {}),
              comprador: {
                ...compPrevio,
                nombreCompleto: nombreCompradorNuevo,
                whatsapp:
                  entrada.clasificacionPedido === "EXEQUIALES" ? "" : telCompradorNuevo,
                telefono:
                  entrada.clasificacionPedido === "EXEQUIALES" ? "" : telCompradorNuevo,
              },
              logistica_entrega: {
                ...logPrevio,
                destinatario_nombre: destNuevo,
                direccion:
                  entrada.clasificacionPedido === "EXEQUIALES"
                    ? ""
                    : entrada.direccionEntrega !== undefined
                      ? entrada.direccionEntrega.trim()
                      : logPrevio.direccion || "",
                enlace_mapa:
                  entrada.clasificacionPedido === "EXEQUIALES"
                    ? ""
                    : entrada.enlaceMapa !== undefined
                      ? entrada.enlaceMapa.trim()
                      : logPrevio.enlace_mapa || "",
                retiro_en_local:
                  entrada.clasificacionPedido === "EXEQUIALES"
                    ? false
                    : entrada.retiroEnLocal !== undefined
                      ? Boolean(entrada.retiroEnLocal)
                      : Boolean(logPrevio.retiro_en_local),
                fecha_entrega:
                  entrada.fechaEntrega?.slice(0, 10) || logPrevio.fecha_entrega || "",
                franja_horaria:
                  entrada.franjaHoraria !== undefined
                    ? entrada.franjaHoraria
                      ? normalizarFranjaHorariaTienda(entrada.franjaHoraria)
                      : ""
                    : logPrevio.franja_horaria || "",
                hora_exacta:
                  entrada.horaEspecifica !== undefined
                    ? entrada.horaEspecifica || null
                    : logPrevio.hora_exacta,
                sala_servicio:
                  entrada.salaServicio !== undefined
                    ? entrada.salaServicio || undefined
                    : logPrevio.sala_servicio,
              },
              items: itemsActualizados,
              notas_taller:
                entrada.observaciones !== undefined
                  ? entrada.observaciones.trim()
                  : det.notas_taller || "",
              tarjeta: {
                token: tokenPrf,
                tipo: tipoResueltoPrf,
                confidencial: confPrf,
                ...(disenoPrf ? { diseno: disenoPrf } : {}),
                mensaje: entrada.clasificacionPedido === "EXEQUIALES" ? "" : dedNueva,
                para: destNuevo,
                de: nombreCompradorNuevo,
                musica_url: musNueva,
                musica_titulo: esCondolPrf
                  ? null
                  : entrada.tarjetaMusicaTitulo !== undefined
                    ? entrada.tarjetaMusicaTitulo?.trim() || null
                    : tarPrevia.musica_titulo ?? tarPrevia.musicaTitulo ?? null,
                lyrics: esCondolPrf
                  ? []
                  : entrada.tarjetaLyrics !== undefined
                    ? entrada.tarjetaLyrics
                    : tarPrevia.lyrics ?? [],
                metadata: nuevaMetaPrf,
              },
            },
            prf_actualizado_en: ahoraIso,
          })
          .eq("prf_id", prf.prf_id);

        if (errPrf) {
          return { ok: false, error: errPrf.message };
        }
        actualizadoEnBdd = true;
        tokenFinal = tokenPrf;
        metaFinal = nuevaMetaPrf;
      }
    }

    // 3. Sincronizar / actualizar com_entrega_evidencia (Órdenes Exequiales OT-...)
    const idEntrega = entrada.entregaId || entrada.pedidoId;
    if (/^[0-9a-f-]{36}$/i.test(idEntrega)) {
      const { data: ent } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_id", idEntrega)
        .maybeSingle();

      if (ent?.ent_id) {
        const detEnt = (ent.ent_detalle_entrega ?? {}) as Record<string, any>;
        const tarPrevia = (detEnt.tarjeta ?? {}) as Record<string, any>;
        const metaPrevia =
          tarPrevia.metadata && typeof tarPrevia.metadata === "object"
            ? { ...tarPrevia.metadata }
            : { origen: "AUTOMATICO_SISTEMA", historial_cambios: [], vistas_cliente: 0, impresiones: 0 };
        const histPrevio = Array.isArray(metaPrevia.historial_cambios)
          ? [...metaPrevia.historial_cambios]
          : [];

        const tipoResueltoEnt = entrada.tarjetaTipo || tarPrevia.tipo || "CONDOLENCIAS_PLANA";
        const esCondolEnt = tipoResueltoEnt === "CONDOLENCIAS_PLANA";
        const confEnt = esCondolEnt
          ? false
          : entrada.tarjetaConfidencial !== undefined
            ? Boolean(entrada.tarjetaConfidencial)
            : Boolean(metaPrevia.confidencial_solo_qr ?? tarPrevia.confidencial);
        const disenoEnt =
          entrada.tarjetaDiseno !== undefined
            ? entrada.tarjetaDiseno
            : tarPrevia.diseno ?? metaPrevia.diseno;

        const dedPrevia = String(tarPrevia.mensaje ?? detEnt.dedicatoria ?? "");
        const dedNueva =
          entrada.dedicatoria !== undefined ? entrada.dedicatoria.trim() : dedPrevia;
        const musNueva = esCondolEnt
          ? null
          : entrada.tarjetaMusicaUrl !== undefined
            ? entrada.tarjetaMusicaUrl?.trim() || null
            : tarPrevia.musica_url ?? null;

        if (!metaFinal && (dedNueva !== dedPrevia || musNueva !== (tarPrevia.musica_url ?? null))) {
          histPrevio.push({
            autor: autorNombre,
            rol: autorRol,
            fecha: ahoraIso,
            dedicatoria_anterior: dedPrevia,
            dedicatoria_nueva: dedNueva,
          });
        }

        const nuevaMetaEnt =
          metaFinal ?? {
            ...metaPrevia,
            confidencial_solo_qr: confEnt,
            ...(disenoEnt ? { diseno: disenoEnt } : {}),
            editado_por_staff: true,
            ultimo_editor_nombre: autorNombre,
            ultimo_editor_rol: autorRol,
            ultima_edicion_staff_en: ahoraIso,
            historial_cambios: histPrevio,
          };

        const tokenEnt = String(tokenFinal || tarPrevia.token || ent.ent_id);
        const coordNuevo =
          entrada.compradorNombre?.trim() ||
          ent.ent_coordinador_nombre ||
          detEnt.quien_solicita ||
          "Exequiales IESS";
        const fallNuevo =
          entrada.destinatarioNombre !== undefined
            ? entrada.destinatarioNombre.trim()
            : ent.ent_fallecido_destinatario || "";

        const { error: errEnt } = await db
          .schema("comun_comercio")
          .from("com_entrega_evidencia")
          .update({
            ...(entrada.clasificacionPedido
              ? { ent_clasificacion_pedido: entrada.clasificacionPedido }
              : {}),
            ...(entrada.salaServicio !== undefined
              ? { ent_sala_servicio: entrada.salaServicio || null }
              : {}),
            ...(entrada.horaEspecifica !== undefined || entrada.franjaHoraria !== undefined
              ? {
                  ent_hora_solicitada:
                    entrada.horaEspecifica || entrada.franjaHoraria || null,
                }
              : {}),
            ent_coordinador_nombre: coordNuevo,
            ent_fallecido_destinatario: fallNuevo,
            ent_descripcion_servicio:
              entrada.productoResumen?.trim() || ent.ent_descripcion_servicio,
            ent_ubicacion_nombre:
              entrada.clasificacionPedido === "EXEQUIALES"
                ? "Exequiales"
                : entrada.direccionEntrega?.trim() || ent.ent_ubicacion_nombre,
            ent_observaciones:
              entrada.observaciones !== undefined
                ? entrada.observaciones.trim() || null
                : ent.ent_observaciones,
            ...(entrada.fechaEntrega
              ? { ent_fecha_servicio: `${entrada.fechaEntrega.slice(0, 10)}T12:00:00.000Z` }
              : {}),
            ent_detalle_entrega: {
              ...detEnt,
              quien_solicita: coordNuevo,
              sala_servicio:
                entrada.salaServicio !== undefined
                  ? entrada.salaServicio || undefined
                  : detEnt.sala_servicio,
              hora_solicitada:
                entrada.horaEspecifica !== undefined
                  ? entrada.horaEspecifica || undefined
                  : detEnt.hora_solicitada,
              dedicatoria: dedNueva,
              tarjeta: {
                token: tokenEnt,
                tipo: tipoResueltoEnt,
                confidencial: confEnt,
                ...(disenoEnt ? { diseno: disenoEnt } : {}),
                mensaje: dedNueva,
                para: fallNuevo,
                de: coordNuevo,
                musica_url: musNueva,
                musica_titulo: esCondolEnt
                  ? null
                  : entrada.tarjetaMusicaTitulo !== undefined
                    ? entrada.tarjetaMusicaTitulo?.trim() || null
                    : tarPrevia.musica_titulo ?? null,
                lyrics: esCondolEnt
                  ? []
                  : entrada.tarjetaLyrics !== undefined
                    ? entrada.tarjetaLyrics
                    : tarPrevia.lyrics ?? [],
                metadata: nuevaMetaEnt,
              },
            },
            ent_actualizado_en: ahoraIso,
          })
          .eq("ent_id", ent.ent_id);

        if (!errEnt) {
          actualizadoEnBdd = true;
          tokenFinal = tokenEnt;
          metaFinal = nuevaMetaEnt;
        } else {
          ultimoErrorDb = errEnt.message;
        }
      }
    }

    if (!actualizadoEnBdd) {
      return {
        ok: false,
        error:
          ultimoErrorDb ||
          "No se pudo persistir el diseño de la tarjeta en la base de datos. Ejecuta la migración 20261119000007 en Supabase.",
      };
    }

    revalidarRutasTienda(neg);
    const tokenEdicionFinal = tokenFinal
      ? generarTokenEdicionTarjetaServidor(tokenFinal)
      : undefined;
    if (tokenFinal) {
      try {
        revalidatePath(`/dedicatoria/${tokenFinal}`);
        if (tokenEdicionFinal) revalidatePath(`/tarjeta-editar/${tokenEdicionFinal}`);
      } catch {}
    }

    return {
      ok: true,
      tarjetaToken: tokenFinal,
      tarjetaTokenEdicion: tokenEdicionFinal,
      tarjetaConfidencial: Boolean(metaFinal?.confidencial_solo_qr),
      tarjetaMetadata: metaFinal,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar cambios del pedido y tarjeta",
    };
  }
}

export async function registrarImpresionTarjetaAction(entrada: {
  ordenId: string;
  tipo?: string;
}): Promise<{ ok: boolean; impresiones?: number; ultimoImpresoPor?: string; error?: string }> {
  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_registrar_impresion_tarjeta",
      {
        p_orden_id: entrada.ordenId,
        p_tipo: entrada.tipo ?? null,
      }
    );

    if (!error && data?.ok) {
      return {
        ok: true,
        impresiones: data.impresiones,
        ultimoImpresoPor: data.ultimoImpresoPor,
      };
    }

    // Respaldo híbrido sobre com_proforma / com_entrega_evidencia
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const db: any = crearClienteAdmin() ?? supabase;
    const impresoPor = user?.email?.split("@")[0] || "Taller";
    const ahoraIso = new Date().toISOString();

    if (/^[0-9a-f-]{36}$/i.test(entrada.ordenId)) {
      const { data: prf } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_token_aprobacion, prf_detalle_proforma")
        .eq("prf_id", entrada.ordenId)
        .maybeSingle();

      if (prf?.prf_id) {
        const det = (prf.prf_detalle_proforma ?? {}) as Record<string, any>;
        const tar = (det.tarjeta ?? {}) as Record<string, any>;
        const meta = (tar.metadata ?? {}) as Record<string, any>;
        const nuevasImp = Number(meta.impresiones ?? 0) + 1;
        await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_detalle_proforma: {
              ...det,
              tarjeta: {
                ...tar,
                token: tar.token || prf.prf_token_aprobacion || prf.prf_id,
                tipo: entrada.tipo || tar.tipo || "DIPTICO",
                metadata: {
                  ...meta,
                  impresiones: nuevasImp,
                  ultima_impresion_en: ahoraIso,
                  ultimo_impreso_por: impresoPor,
                },
              },
            },
          })
          .eq("prf_id", prf.prf_id);

        return { ok: true, impresiones: nuevasImp, ultimoImpresoPor: impresoPor };
      }

      const { data: ent } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("ent_id, ent_detalle_entrega")
        .eq("ent_id", entrada.ordenId)
        .maybeSingle();

      if (ent?.ent_id) {
        const detEnt = (ent.ent_detalle_entrega ?? {}) as Record<string, any>;
        const tar = (detEnt.tarjeta ?? {}) as Record<string, any>;
        const meta = (tar.metadata ?? {}) as Record<string, any>;
        const nuevasImp = Number(meta.impresiones ?? 0) + 1;
        await db
          .schema("comun_comercio")
          .from("com_entrega_evidencia")
          .update({
            ent_detalle_entrega: {
              ...detEnt,
              tarjeta: {
                ...tar,
                token: tar.token || ent.ent_id,
                tipo: entrada.tipo || tar.tipo || "CONDOLENCIAS_PLANA",
                metadata: {
                  ...meta,
                  impresiones: nuevasImp,
                  ultima_impresion_en: ahoraIso,
                  ultimo_impreso_por: impresoPor,
                },
              },
            },
          })
          .eq("ent_id", ent.ent_id);

        return { ok: true, impresiones: nuevasImp, ultimoImpresoPor: impresoPor };
      }
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: true, impresiones: 1, ultimoImpresoPor: impresoPor };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al registrar impresión",
    };
  }
}

function esPedidoCondolenciasPorContexto(params: {
  clasificacion?: string | null;
  productoResumen?: string | null;
  ubicacion?: string | null;
  items?: unknown;
}): boolean {
  const clasif = String(params.clasificacion || "").trim().toUpperCase();
  if (
    clasif === "CONDOLENCIAS" ||
    clasif === "CONDOLENCIA" ||
    clasif === "EXEQUIALES" ||
    clasif === "FUNERARIO" ||
    clasif === "FUNEBRE" ||
    clasif === "FÚNEBRE"
  ) {
    return true;
  }
  const textoCombinado = [
    String(params.productoResumen || ""),
    String(params.ubicacion || ""),
    Array.isArray(params.items) ? JSON.stringify(params.items) : String(params.items || ""),
  ]
    .join(" ")
    .toLowerCase();

  return (
    textoCombinado.includes("condolencia") ||
    textoCombinado.includes("corona") ||
    textoCombinado.includes("fúnebre") ||
    textoCombinado.includes("funebre") ||
    textoCombinado.includes("cubre cofre") ||
    textoCombinado.includes("cubrecofre") ||
    textoCombinado.includes("trípode") ||
    textoCombinado.includes("tripode") ||
    textoCombinado.includes("sepelio") ||
    textoCombinado.includes("camposanto") ||
    textoCombinado.includes("monteolivo") ||
    textoCombinado.includes("funeraria") ||
    textoCombinado.includes("sala de velaci") ||
    textoCombinado.includes("tanatorio") ||
    textoCombinado.includes("cementerio") ||
    textoCombinado.includes("jardines del valle")
  );
}

async function verificarCondolenciasDesdePedidoDb(
  db: any,
  ordenId: string
): Promise<boolean> {
  if (!db || !ordenId) return false;
  try {
    const { data: ota } = await db
      .schema("comun_comercio")
      .from("com_orden_taller")
      .select("ota_clasificacion_pedido, ota_producto_resumen, ota_ubicacion_entrega, ota_tarjeta_tipo")
      .eq("ota_id", ordenId)
      .maybeSingle();
    if (ota) {
      if (ota.ota_tarjeta_tipo === "CONDOLENCIAS_PLANA") return true;
      if (
        esPedidoCondolenciasPorContexto({
          clasificacion: ota.ota_clasificacion_pedido,
          productoResumen: ota.ota_producto_resumen,
          ubicacion: ota.ota_ubicacion_entrega,
        })
      ) {
        return true;
      }
    }
    const { data: prf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_detalle_proforma")
      .eq("prf_id", ordenId)
      .maybeSingle();
    if (prf?.prf_detalle_proforma) {
      const det = prf.prf_detalle_proforma as Record<string, any>;
      const log = (det.logistica_entrega ?? {}) as Record<string, any>;
      if (
        det.tarjeta?.tipo === "CONDOLENCIAS_PLANA" ||
        esPedidoCondolenciasPorContexto({
          clasificacion: det.clasificacion_pedido,
          productoResumen: det.producto_resumen,
          ubicacion: [log.direccion, log.referencia, log.sector].filter(Boolean).join(" "),
          items: det.items,
        })
      ) {
        return true;
      }
    }
  } catch {
    // Silencioso si no hay acceso directo; se conserva el resultado de la RPC
  }
  return false;
}

function mapearTarjetaDesdeProformaRpc(
  f: any,
  tokenFallback: string
): {
  ordenId: string;
  codigo: string;
  negocio: string;
  tokenVista: string;
  destinatario: string;
  remitente: string;
  dedicatoria: string;
  tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
  confidencial: boolean;
  diseno?: DisenoVisualTarjeta;
  musicaUrl?: string | null;
  musicaTitulo?: string | null;
  lyrics?: Array<{ tiempo?: number; texto: string }>;
  fechaEntrega?: string;
  estadoTaller?: string;
  bloqueadoEdicion: boolean;
  vistas?: number;
} {
  const det = (f.detalle ?? f.prf_detalle_proforma ?? {}) as Record<string, any>;
  const log = (det.logistica_entrega ?? {}) as Record<string, any>;
  const tar = (det.tarjeta ?? {}) as Record<string, any>;
  const meta = (tar.metadata ?? {}) as Record<string, any>;
  const items = Array.isArray(f.items)
    ? f.items
    : Array.isArray(det.items)
      ? det.items
      : [];
  const primerDed = items.find(
    (i: any) => i?.dedicatoria?.mensaje || i?.detalle?.dedicatoria?.mensaje
  );
  const dedObj = primerDed?.dedicatoria ?? primerDed?.detalle?.dedicatoria ?? null;
  const estadoPrf = String(f.estado ?? f.prf_estado ?? det.estado_taller ?? "").toUpperCase();
  const bloqueado =
    estadoPrf === "EN_RUTA" ||
    estadoPrf === "ENTREGADO" ||
    Number(meta.impresiones ?? 0) > 0;
  const clasif = String(det.clasificacion_pedido || "").toUpperCase();
  const inferidaCondolencias = esPedidoCondolenciasPorContexto({
    clasificacion: clasif,
    productoResumen: det.producto_resumen,
    ubicacion: [log.direccion, log.referencia, log.sector].filter(Boolean).join(" "),
    items,
  });
  const tipoRes: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL" = inferidaCondolencias
    ? "CONDOLENCIAS_PLANA"
    : tar.tipo === "CONDOLENCIAS_PLANA" || tar.tipo === "SOLO_DIGITAL" || tar.tipo === "DIPTICO"
      ? tar.tipo
      : "DIPTICO";
  const esCondol = tipoRes === "CONDOLENCIAS_PLANA";
  const disenoRaw = tar.diseno ?? meta.diseno;

  return {
    ordenId: String(f.id ?? f.prf_id),
    codigo: String(det.codigo_orden || det.codigo_proforma || "PEDIDO"),
    negocio: String(f.negocio ?? f.prf_negocio ?? "tinkay"),
    tokenVista: String(
      tar.token || f.token_aprobacion || f.prf_token_aprobacion || f.id || f.prf_id || tokenFallback
    ),
    destinatario: String(tar.para || dedObj?.para || log.destinatario_nombre || ""),
    remitente: String(tar.de || dedObj?.de || f.cliente_nombre || f.prf_cliente_nombre || ""),
    dedicatoria: String(tar.mensaje ?? dedObj?.mensaje ?? ""),
    tipo: tipoRes,
    confidencial: esCondol ? false : Boolean(tar.confidencial ?? meta.confidencial_solo_qr),
    diseno: disenoRaw && typeof disenoRaw === "object" ? (disenoRaw as DisenoVisualTarjeta) : undefined,
    musicaUrl: esCondol ? null : tar.musica_url || tar.musicaUrl || null,
    musicaTitulo: esCondol ? null : tar.musica_titulo || tar.musicaTitulo || null,
    lyrics: esCondol ? [] : Array.isArray(tar.lyrics) ? tar.lyrics : [],
    fechaEntrega: String(log.fecha_entrega || "").slice(0, 10),
    estadoTaller: estadoPrf,
    bloqueadoEdicion: bloqueado,
    vistas: Number(meta.vistas_cliente ?? 0),
  };
}

export async function obtenerTarjetaPublicaAction(token: string): Promise<{
  ok: boolean;
  tarjeta?: {
    ordenId: string;
    codigo: string;
    negocio: string;
    destinatario: string;
    remitente: string;
    dedicatoria: string;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
    confidencial?: boolean;
    diseno?: DisenoVisualTarjeta;
    musicaUrl?: string | null;
    musicaTitulo?: string | null;
    lyrics?: Array<{ tiempo?: number; texto: string }>;
    fechaEntrega?: string;
    estadoTaller?: string;
    bloqueadoEdicion?: boolean;
    vistas?: number;
  };
  error?: string;
}> {
  try {
    const tokenLimpio = (token || "").trim().split("_")[0] || "";
    if (!tokenLimpio) {
      return { ok: false, error: "Token de tarjeta vacío" };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    // 1. RPC universal SECURITY DEFINER (funciona sin login para anon en com_orden_taller, com_proforma y com_entrega_evidencia)
    let { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_tarjeta_publica",
      { p_token: tokenLimpio, p_sumar_vista: true }
    );

    if (error && esErrorMigracionPendiente(error.message)) {
      const res1Arg = await invocarRpcComercio(
        supabase,
        "com_fn_obtener_tarjeta_publica",
        { p_token: tokenLimpio }
      );
      data = res1Arg.data;
      error = res1Arg.error;
    }

    if (!error && data?.ok) {
      let tipoRes: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL" =
        data.tipo === "CONDOLENCIAS_PLANA" || data.tipo === "SOLO_DIGITAL"
          ? data.tipo
          : "DIPTICO";
      if (tipoRes !== "CONDOLENCIAS_PLANA" && data.ordenId) {
        const esCondolPedido = await verificarCondolenciasDesdePedidoDb(db, String(data.ordenId));
        if (esCondolPedido) tipoRes = "CONDOLENCIAS_PLANA";
      }
      const esCondol = tipoRes === "CONDOLENCIAS_PLANA";
      return {
        ok: true,
        tarjeta: {
          ordenId: data.ordenId,
          codigo: data.codigo,
          negocio: data.negocio,
          destinatario: data.destinatario,
          remitente: data.remitente,
          dedicatoria: data.dedicatoria,
          tipo: tipoRes,
          confidencial: esCondol ? false : Boolean(data.confidencial),
          diseno:
            data.diseno && typeof data.diseno === "object"
              ? (data.diseno as DisenoVisualTarjeta)
              : undefined,
          musicaUrl: esCondol ? null : data.musicaUrl,
          musicaTitulo: esCondol ? null : data.musicaTitulo,
          lyrics: esCondol ? [] : data.lyrics,
          fechaEntrega: data.fechaEntrega,
          estadoTaller: data.estadoTaller,
          bloqueadoEdicion: Boolean(data.bloqueadoEdicion),
          vistas: data.vistas,
        },
      };
    }

    // 2. Respaldo SECURITY DEFINER ya desplegado en producción (funciona sin login para anon en com_proforma)
    try {
      const resPrfRpc = await invocarRpcComercio(
        supabase,
        "com_fn_obtener_proforma_por_token",
        { p_token: tokenLimpio }
      );
      if (!resPrfRpc.error && resPrfRpc.data?.ok && resPrfRpc.data?.proforma) {
        const mapeada = mapearTarjetaDesdeProformaRpc(resPrfRpc.data.proforma, tokenLimpio);
        return { ok: true, tarjeta: mapeada };
      }
    } catch {
      // Continuar con respaldo directo
    }

    // 3. Respaldo híbrido directo sobre com_proforma y com_entrega_evidencia (si hay sesión o service_role)
    const esUuid = /^[0-9a-f-]{36}$/i.test(tokenLimpio);

    const queryPrf = db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .is("prf_eliminado_en", null);

    const { data: prf } = await (esUuid
      ? queryPrf.or(`prf_token_aprobacion.eq.${tokenLimpio},prf_id.eq.${tokenLimpio}`)
      : queryPrf.eq("prf_token_aprobacion", tokenLimpio)
    )
      .limit(1)
      .maybeSingle();

    if (prf?.prf_id) {
      const det = (prf.prf_detalle_proforma ?? {}) as Record<string, any>;
      const tar = (det.tarjeta ?? {}) as Record<string, any>;
      const meta = (tar.metadata ?? {}) as Record<string, any>;
      const nuevasVistas = Number(meta.vistas_cliente ?? 0) + 1;

      try {
        await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_detalle_proforma: {
              ...det,
              tarjeta: {
                ...tar,
                token: tar.token || prf.prf_token_aprobacion || prf.prf_id,
                metadata: {
                  ...meta,
                  vistas_cliente: nuevasVistas,
                  ultima_vista_en: new Date().toISOString(),
                },
              },
            },
          })
          .eq("prf_id", prf.prf_id);
      } catch {}

      const mapeada = mapearTarjetaDesdeProformaRpc(prf, tokenLimpio);
      return {
        ok: true,
        tarjeta: {
          ...mapeada,
          vistas: nuevasVistas,
        },
      };
    }

    if (esUuid) {
      const { data: ent } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_id", tokenLimpio)
        .is("ent_eliminado_en", null)
        .maybeSingle();

      if (ent?.ent_id) {
        const detEnt = (ent.ent_detalle_entrega ?? {}) as Record<string, any>;
        const tar = (detEnt.tarjeta ?? {}) as Record<string, any>;
        const meta = (tar.metadata ?? {}) as Record<string, any>;
        const nuevasVistas = Number(meta.vistas_cliente ?? 0) + 1;
        const disenoRaw = tar.diseno ?? meta.diseno;

        try {
          await db
            .schema("comun_comercio")
            .from("com_entrega_evidencia")
            .update({
              ent_detalle_entrega: {
                ...detEnt,
                tarjeta: {
                  ...tar,
                  token: ent.ent_id,
                  metadata: {
                    ...meta,
                    vistas_cliente: nuevasVistas,
                    ultima_vista_en: new Date().toISOString(),
                  },
                },
              },
            })
            .eq("ent_id", ent.ent_id);
        } catch {}

        return {
          ok: true,
          tarjeta: {
            ordenId: String(ent.ent_id),
            codigo: String(ent.ent_codigo_ot || "OT"),
            negocio: String(ent.ent_negocio || "tinkay"),
            destinatario: String(tar.para || ent.ent_fallecido_destinatario || "En memoria"),
            remitente: String(tar.de || ent.ent_coordinador_nombre || "Condolencias"),
            dedicatoria: String(
              tar.mensaje ||
                detEnt.dedicatoria ||
                "Expresamos nuestras más sentidas condolencias."
            ),
            tipo: "CONDOLENCIAS_PLANA",
            confidencial: false,
            diseno:
              disenoRaw && typeof disenoRaw === "object"
                ? (disenoRaw as DisenoVisualTarjeta)
                : undefined,
            musicaUrl: null,
            musicaTitulo: null,
            lyrics: [],
            fechaEntrega: String(ent.ent_fecha_servicio || "").slice(0, 10),
            estadoTaller: String(ent.ent_estado || "PROGRAMADA"),
            bloqueadoEdicion: ent.ent_estado !== "PROGRAMADA",
            vistas: nuevasVistas,
          },
        };
      }
    }

    return { ok: false, error: data?.error || error?.message || "Tarjeta no encontrada" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al consultar la tarjeta",
    };
  }
}

export async function obtenerTarjetaParaEdicionAction(tokenEdicion: string): Promise<{
  ok: boolean;
  tarjeta?: {
    ordenId: string;
    codigo: string;
    negocio: string;
    tokenVista: string;
    destinatario: string;
    remitente: string;
    dedicatoria: string;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
    confidencial: boolean;
    diseno?: DisenoVisualTarjeta;
    musicaUrl?: string | null;
    musicaTitulo?: string | null;
    lyrics?: Array<{ tiempo?: number; texto: string }>;
    fechaEntrega?: string;
    bloqueadoEdicion: boolean;
  };
  error?: string;
}> {
  try {
    const tokenVista = verificarTokenEdicionTarjetaServidor(tokenEdicion);
    if (!tokenVista) {
      return {
        ok: false,
        error:
          "Este enlace no corresponde a un link válido de edición. Usa el enlace exclusivo de edición compartido con tu pedido.",
      };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    // 1. RPC universal SECURITY DEFINER sin sumar vista (funciona sin login para anon)
    let { data: dataPub, error: errPub } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_tarjeta_publica",
      { p_token: tokenVista, p_sumar_vista: false }
    );
    if (errPub && esErrorMigracionPendiente(errPub.message)) {
      const res1Arg = await invocarRpcComercio(
        supabase,
        "com_fn_obtener_tarjeta_publica",
        { p_token: tokenVista }
      );
      dataPub = res1Arg.data;
      errPub = res1Arg.error;
    }

    if (!errPub && dataPub?.ok) {
      let tipoRes: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL" =
        dataPub.tipo === "CONDOLENCIAS_PLANA" || dataPub.tipo === "SOLO_DIGITAL"
          ? dataPub.tipo
          : "DIPTICO";
      if (tipoRes !== "CONDOLENCIAS_PLANA" && dataPub.ordenId) {
        const esCondolPedido = await verificarCondolenciasDesdePedidoDb(db, String(dataPub.ordenId));
        if (esCondolPedido) tipoRes = "CONDOLENCIAS_PLANA";
      }
      const esCondol = tipoRes === "CONDOLENCIAS_PLANA";
      return {
        ok: true,
        tarjeta: {
          ordenId: String(dataPub.ordenId),
          codigo: String(dataPub.codigo || "PEDIDO"),
          negocio: String(dataPub.negocio || "tinkay"),
          tokenVista: String(dataPub.tokenVista || tokenVista),
          destinatario: String(dataPub.destinatario || ""),
          remitente: String(dataPub.remitente || ""),
          dedicatoria: String(dataPub.dedicatoria || ""),
          tipo: tipoRes,
          confidencial: esCondol ? false : Boolean(dataPub.confidencial),
          diseno:
            dataPub.diseno && typeof dataPub.diseno === "object"
              ? (dataPub.diseno as DisenoVisualTarjeta)
              : undefined,
          musicaUrl: esCondol ? null : dataPub.musicaUrl || null,
          musicaTitulo: esCondol ? null : dataPub.musicaTitulo || null,
          lyrics: esCondol ? [] : Array.isArray(dataPub.lyrics) ? dataPub.lyrics : [],
          fechaEntrega: String(dataPub.fechaEntrega || "").slice(0, 10),
          bloqueadoEdicion: Boolean(dataPub.bloqueadoEdicion),
        },
      };
    }

    // 2. Respaldo SECURITY DEFINER ya desplegado en producción para com_proforma sin login
    try {
      const resPrfRpc = await invocarRpcComercio(
        supabase,
        "com_fn_obtener_proforma_por_token",
        { p_token: tokenVista }
      );
      if (!resPrfRpc.error && resPrfRpc.data?.ok && resPrfRpc.data?.proforma) {
        const mapeada = mapearTarjetaDesdeProformaRpc(resPrfRpc.data.proforma, tokenVista);
        return { ok: true, tarjeta: mapeada };
      }
    } catch {}

    // 3. Respaldo directo (si hay sesión iniciada o service_role)
    try {
      const { data: ota } = await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .select("*")
        .eq("ota_tarjeta_token", tokenVista)
        .is("ota_eliminado_en", null)
        .limit(1)
        .maybeSingle();

      if (ota?.ota_id) {
        const meta = (ota.ota_tarjeta_metadata ?? {}) as Record<string, any>;
        const est = String(ota.ota_estado_taller || "").toUpperCase();
        const bloqueado =
          ["EN_PREPARACION", "LISTO_ENTREGA", "ENTREGADO"].includes(est) ||
          Number(meta.impresiones ?? 0) > 0;
        const inferidaCondolOta = esPedidoCondolenciasPorContexto({
          clasificacion: ota.ota_clasificacion_pedido,
          productoResumen: ota.ota_producto_resumen,
          ubicacion: ota.ota_ubicacion_entrega,
        });
        const tipoRes: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL" = inferidaCondolOta
          ? "CONDOLENCIAS_PLANA"
          : ota.ota_tarjeta_tipo === "CONDOLENCIAS_PLANA" ||
              ota.ota_tarjeta_tipo === "SOLO_DIGITAL"
            ? ota.ota_tarjeta_tipo
            : "DIPTICO";
        const esCondol = tipoRes === "CONDOLENCIAS_PLANA";

        return {
          ok: true,
          tarjeta: {
            ordenId: String(ota.ota_id),
            codigo: String(ota.ota_codigo || "PEDIDO"),
            negocio: String(ota.ota_negocio || "tinkay"),
            tokenVista,
            destinatario: String(ota.ota_destinatario_fallecido || ""),
            remitente: String(ota.ota_cliente_solicita || ""),
            dedicatoria: String(ota.ota_dedicatoria || ""),
            tipo: tipoRes,
            confidencial: esCondol ? false : Boolean(meta.confidencial_solo_qr),
            diseno:
              meta.diseno && typeof meta.diseno === "object"
                ? (meta.diseno as DisenoVisualTarjeta)
                : undefined,
            musicaUrl: esCondol ? null : ota.ota_tarjeta_musica_url || null,
            musicaTitulo: esCondol ? null : ota.ota_tarjeta_musica_titulo || null,
            lyrics: esCondol
              ? []
              : Array.isArray(ota.ota_tarjeta_lyrics)
                ? ota.ota_tarjeta_lyrics
                : [],
            fechaEntrega: String(ota.ota_fecha_entrega || "").slice(0, 10),
            bloqueadoEdicion: bloqueado,
          },
        };
      }
    } catch {}

    const esUuid = /^[0-9a-f-]{36}$/i.test(tokenVista);
    const queryPrf = db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .is("prf_eliminado_en", null);

    const { data: prf } = await (esUuid
      ? queryPrf.or(`prf_token_aprobacion.eq.${tokenVista},prf_id.eq.${tokenVista}`)
      : queryPrf.eq("prf_token_aprobacion", tokenVista)
    )
      .limit(1)
      .maybeSingle();

    if (prf?.prf_id) {
      const mapeada = mapearTarjetaDesdeProformaRpc(prf, tokenVista);
      return { ok: true, tarjeta: mapeada };
    }

    if (esUuid) {
      const { data: ent } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_id", tokenVista)
        .is("ent_eliminado_en", null)
        .maybeSingle();

      if (ent?.ent_id) {
        const detEnt = (ent.ent_detalle_entrega ?? {}) as Record<string, any>;
        const tar = (detEnt.tarjeta ?? {}) as Record<string, any>;
        const meta = (tar.metadata ?? {}) as Record<string, any>;
        const disenoRaw = tar.diseno ?? meta.diseno;

        return {
          ok: true,
          tarjeta: {
            ordenId: String(ent.ent_id),
            codigo: String(ent.ent_codigo_ot || "OT"),
            negocio: String(ent.ent_negocio || "tinkay"),
            tokenVista,
            destinatario: String(tar.para || ent.ent_fallecido_destinatario || ""),
            remitente: String(tar.de || ent.ent_coordinador_nombre || ""),
            dedicatoria: String(tar.mensaje || detEnt.dedicatoria || ""),
            tipo: "CONDOLENCIAS_PLANA",
            confidencial: false,
            diseno:
              disenoRaw && typeof disenoRaw === "object"
                ? (disenoRaw as DisenoVisualTarjeta)
                : undefined,
            musicaUrl: null,
            musicaTitulo: null,
            lyrics: [],
            fechaEntrega: String(ent.ent_fecha_servicio || "").slice(0, 10),
            bloqueadoEdicion: ent.ent_estado !== "PROGRAMADA",
          },
        };
      }
    }

    return { ok: false, error: "No se encontró el pedido asociado a esta tarjeta." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar la tarjeta para edición",
    };
  }
}

export async function editarTarjetaClienteAction(entrada: {
  token: string;
  dedicatoria: string;
  para?: string;
  de?: string;
  confidencial?: boolean;
  diseno?: DisenoVisualTarjeta;
  musicaUrl?: string | null;
  musicaTitulo?: string | null;
  lyrics?: Array<{ tiempo?: number; texto: string }>;
}): Promise<{ ok: boolean; error?: string; mensaje?: string }> {
  try {
    const tokenVista = verificarTokenEdicionTarjetaServidor(entrada.token);
    if (!tokenVista) {
      return {
        ok: false,
        error: "Enlace sin permisos de edición. Solicita el enlace de edición de tu pedido.",
      };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    // 1. RPC SECURITY DEFINER (funciona sin login para anon tras validar firma HMAC de tokenEdicion)
    const { data: resRpcEdit, error: errRpcEdit } = await invocarRpcComercio(
      supabase,
      "com_fn_editar_tarjeta_publica",
      {
        p_token: tokenVista,
        p_payload: {
          dedicatoria: entrada.dedicatoria.trim(),
          para: entrada.para?.trim(),
          de: entrada.de?.trim(),
          confidencial: Boolean(entrada.confidencial),
          diseno: entrada.diseno ?? null,
          musicaUrl: entrada.musicaUrl ?? null,
          musicaTitulo: entrada.musicaTitulo ?? null,
          lyrics: entrada.lyrics ?? [],
        },
      }
    );

    if (!errRpcEdit && resRpcEdit?.ok) {
      try {
        revalidatePath(`/dedicatoria/${tokenVista}`);
        revalidatePath(`/tarjeta-editar/${entrada.token}`);
      } catch {}
      try {
        const infoTarj = await obtenerTarjetaPublicaAction(tokenVista);
        const negNotif = infoTarj.ok && infoTarj.tarjeta?.negocio ? infoTarj.tarjeta.negocio : "tinkay";
        const codNotif = infoTarj.ok && infoTarj.tarjeta?.codigo ? infoTarj.tarjeta.codigo : "PEDIDO";
        await notificarPersonalTallerODespacho({
          negocio: negNotif,
          titulo: `✏️ Cliente modificó tarjeta (${codNotif})`,
          contenidoHtml: `<p>El cliente actualizó el diseño/mensaje de la tarjeta del pedido <strong>${codNotif}</strong>. Revisa la tarjeta antes de imprimir y evita sobreescribir sus cambios.</p>`,
          urlAccion: "/panel/pedidos",
          roles: ["SUPERADMIN", "ADMINISTRADOR", "OPERADOR", "VENTAS", "TALLER"],
          claveReferencia: `tarjeta-cliente-${tokenVista}-${Date.now()}`,
        });
      } catch {}
      return {
        ok: true,
        mensaje: String(resRpcEdit.mensaje || "Tarjeta actualizada correctamente."),
      };
    }

    if (!errRpcEdit && resRpcEdit && resRpcEdit.ok === false && resRpcEdit.bloqueado) {
      return {
        ok: false,
        error: String(
          resRpcEdit.error ||
            "Tu tarjeta ya fue impresa en taller y no admite más modificaciones."
        ),
      };
    }

    const ahoraIso = new Date().toISOString();
    let actualizadoAlguno = false;

    // 2. Respaldo si la migración 000009 aún no ha corrido en Supabase remoto
    try {
      const { data: ota } = await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .select("*")
        .eq("ota_tarjeta_token", tokenVista)
        .is("ota_eliminado_en", null)
        .limit(1)
        .maybeSingle();

      if (ota?.ota_id) {
        const meta = (ota.ota_tarjeta_metadata ?? {}) as Record<string, any>;
        const est = String(ota.ota_estado_taller || "").toUpperCase();
        if (
          ["EN_PREPARACION", "LISTO_ENTREGA", "ENTREGADO"].includes(est) ||
          Number(meta.impresiones ?? 0) > 0
        ) {
          return {
            ok: false,
            error:
              "Tu tarjeta ya fue impresa o está en preparación en el taller y no puede modificarse.",
          };
        }

        const esCondol = ota.ota_tarjeta_tipo === "CONDOLENCIAS_PLANA";
        const hist = Array.isArray(meta.historial_cambios) ? [...meta.historial_cambios] : [];
        hist.push({
          autor: "Cliente / Diseñador (Web)",
          rol: "CLIENTE",
          fecha: ahoraIso,
          dedicatoria_anterior: ota.ota_dedicatoria || "",
          dedicatoria_nueva: entrada.dedicatoria.trim(),
          musica_url_nueva: esCondol ? null : entrada.musicaUrl || null,
        });

        const nuevaMeta = {
          ...meta,
          confidencial_solo_qr: esCondol
            ? false
            : entrada.confidencial !== undefined
              ? Boolean(entrada.confidencial)
              : Boolean(meta.confidencial_solo_qr),
          ...(entrada.diseno ? { diseno: entrada.diseno } : {}),
          editado_por_cliente: true,
          ultima_edicion_cliente_en: ahoraIso,
          historial_cambios: hist,
        };

        await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({
            ota_dedicatoria: entrada.dedicatoria.trim(),
            ...(entrada.para !== undefined
              ? { ota_destinatario_fallecido: entrada.para.trim() }
              : {}),
            ...(entrada.de !== undefined && entrada.de.trim()
              ? { ota_cliente_solicita: entrada.de.trim() }
              : {}),
            ota_tarjeta_musica_url: esCondol ? null : entrada.musicaUrl ?? null,
            ota_tarjeta_musica_titulo: esCondol ? null : entrada.musicaTitulo ?? null,
            ota_tarjeta_lyrics: esCondol ? [] : entrada.lyrics ?? [],
            ota_tarjeta_metadata: nuevaMeta,
            ota_actualizado_en: ahoraIso,
          })
          .eq("ota_id", ota.ota_id);

        actualizadoAlguno = true;
      }
    } catch {}

    const esUuid = /^[0-9a-f-]{36}$/i.test(tokenVista);
    const queryPrf = db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .is("prf_eliminado_en", null);

    const { data: prf } = await (esUuid
      ? queryPrf.or(`prf_token_aprobacion.eq.${tokenVista},prf_id.eq.${tokenVista}`)
      : queryPrf.eq("prf_token_aprobacion", tokenVista)
    )
      .limit(1)
      .maybeSingle();

    if (prf?.prf_id) {
      const det = (prf.prf_detalle_proforma ?? {}) as Record<string, any>;
      const tar = (det.tarjeta ?? {}) as Record<string, any>;
      const meta = (tar.metadata ?? {}) as Record<string, any>;
      const estadoPrf = String(prf.prf_estado || "").toUpperCase();

      if (
        !actualizadoAlguno &&
        (estadoPrf === "EN_RUTA" ||
          estadoPrf === "ENTREGADO" ||
          Number(meta.impresiones ?? 0) > 0)
      ) {
        return {
          ok: false,
          error:
            "Tu tarjeta ya fue impresa en nuestro taller y no es posible realizar más cambios.",
        };
      }

      const esCondol = tar.tipo === "CONDOLENCIAS_PLANA";
      const confNuevo = esCondol
        ? false
        : entrada.confidencial !== undefined
          ? Boolean(entrada.confidencial)
          : Boolean(tar.confidencial ?? meta.confidencial_solo_qr);

      const hist = Array.isArray(meta.historial_cambios) ? [...meta.historial_cambios] : [];
      hist.push({
        autor: "Cliente / Diseñador (Web)",
        rol: "CLIENTE",
        fecha: ahoraIso,
        dedicatoria_anterior: tar.mensaje || "",
        dedicatoria_nueva: entrada.dedicatoria.trim(),
        musica_url_nueva: esCondol ? null : entrada.musicaUrl || null,
      });

      const paraNuevo =
        entrada.para !== undefined ? entrada.para.trim() : String(tar.para || "");
      const deNuevo =
        entrada.de !== undefined && entrada.de.trim()
          ? entrada.de.trim()
          : String(tar.de || prf.prf_cliente_nombre || "");

      const itemsPrev = Array.isArray(det.items) ? [...det.items] : [];
      const itemsAct = itemsPrev.map((it: any, idx: number) =>
        idx === 0
          ? {
              ...it,
              dedicatoria: {
                para: paraNuevo || it.dedicatoria?.para || "",
                de: deNuevo || it.dedicatoria?.de || "",
                mensaje: entrada.dedicatoria.trim(),
              },
            }
          : it
      );

      const disenoFinal = entrada.diseno ?? tar.diseno ?? meta.diseno;

      const { error: errUpd } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_detalle_proforma: {
            ...det,
            items: itemsAct,
            tarjeta: {
              ...tar,
              token: tar.token || prf.prf_token_aprobacion || prf.prf_id,
              para: paraNuevo,
              de: deNuevo,
              confidencial: confNuevo,
              ...(disenoFinal ? { diseno: disenoFinal } : {}),
              mensaje: entrada.dedicatoria.trim(),
              musica_url: esCondol ? null : entrada.musicaUrl ?? tar.musica_url ?? null,
              musica_titulo: esCondol ? null : entrada.musicaTitulo ?? tar.musica_titulo ?? null,
              lyrics: esCondol ? [] : entrada.lyrics ?? tar.lyrics ?? [],
              metadata: {
                ...meta,
                confidencial_solo_qr: confNuevo,
                ...(disenoFinal ? { diseno: disenoFinal } : {}),
                editado_por_cliente: true,
                ultima_edicion_cliente_en: ahoraIso,
                historial_cambios: hist,
              },
            },
          },
          prf_actualizado_en: ahoraIso,
        })
        .eq("prf_id", prf.prf_id);

      if (errUpd) return { ok: false, error: errUpd.message };
      revalidarRutasTienda(String(prf.prf_negocio || "tinkay"));
      actualizadoAlguno = true;
    }

    if (esUuid && !actualizadoAlguno) {
      const { data: ent } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_id", tokenVista)
        .is("ent_eliminado_en", null)
        .maybeSingle();

      if (ent?.ent_id) {
        if (ent.ent_estado !== "PROGRAMADA") {
          return {
            ok: false,
            error: "La entrega ya fue ejecutada y la tarjeta no admite más cambios.",
          };
        }
        const detEnt = (ent.ent_detalle_entrega ?? {}) as Record<string, any>;
        const tar = (detEnt.tarjeta ?? {}) as Record<string, any>;
        const meta = (tar.metadata ?? {}) as Record<string, any>;
        const disenoFinal = entrada.diseno ?? tar.diseno ?? meta.diseno;
        const hist = Array.isArray(meta.historial_cambios) ? [...meta.historial_cambios] : [];
        hist.push({
          autor: "Cliente / Diseñador (Web)",
          rol: "CLIENTE",
          fecha: ahoraIso,
          dedicatoria_anterior: tar.mensaje || "",
          dedicatoria_nueva: entrada.dedicatoria.trim(),
        });

        await db
          .schema("comun_comercio")
          .from("com_entrega_evidencia")
          .update({
            ent_detalle_entrega: {
              ...detEnt,
              dedicatoria: entrada.dedicatoria.trim(),
              tarjeta: {
                ...tar,
                token: ent.ent_id,
                tipo: "CONDOLENCIAS_PLANA",
                confidencial: false,
                ...(disenoFinal ? { diseno: disenoFinal } : {}),
                mensaje: entrada.dedicatoria.trim(),
                para:
                  entrada.para !== undefined
                    ? entrada.para.trim()
                    : String(tar.para || ent.ent_fallecido_destinatario || ""),
                de:
                  entrada.de !== undefined
                    ? entrada.de.trim()
                    : String(tar.de || ent.ent_coordinador_nombre || ""),
                musica_url: null,
                musica_titulo: null,
                lyrics: [],
                metadata: {
                  ...meta,
                  confidencial_solo_qr: false,
                  ...(disenoFinal ? { diseno: disenoFinal } : {}),
                  editado_por_cliente: true,
                  ultima_edicion_cliente_en: ahoraIso,
                  historial_cambios: hist,
                },
              },
            },
            ent_actualizado_en: ahoraIso,
          })
          .eq("ent_id", ent.ent_id);

        actualizadoAlguno = true;
      }
    }

    if (!actualizadoAlguno) {
      return {
        ok: false,
        error:
          "No se pudo guardar los cambios en este momento. Verifica que la migración de tarjetas esté aplicada en Supabase.",
      };
    }

    try {
      revalidatePath(`/dedicatoria/${tokenVista}`);
      revalidatePath(`/tarjeta-editar/${entrada.token}`);
    } catch {}

    try {
      const infoTarj = await obtenerTarjetaPublicaAction(tokenVista);
      const negNotif = infoTarj.ok && infoTarj.tarjeta?.negocio ? infoTarj.tarjeta.negocio : "tinkay";
      const codNotif = infoTarj.ok && infoTarj.tarjeta?.codigo ? infoTarj.tarjeta.codigo : "PEDIDO";
      await notificarPersonalTallerODespacho({
        negocio: negNotif,
        titulo: `✏️ Cliente modificó tarjeta (${codNotif})`,
        contenidoHtml: `<p>El cliente actualizó el diseño/mensaje de la tarjeta del pedido <strong>${codNotif}</strong>. Revisa la tarjeta antes de imprimir y evita sobreescribir sus cambios.</p>`,
        urlAccion: "/panel/pedidos",
        roles: ["SUPERADMIN", "ADMINISTRADOR", "OPERADOR", "VENTAS", "TALLER"],
        claveReferencia: `tarjeta-cliente-${tokenVista}-${Date.now()}`,
      });
    } catch {}

    return { ok: true, mensaje: "Tarjeta actualizada correctamente." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar la tarjeta",
    };
  }
}

export async function actualizarClasificacionPedidoAction(entrada: {
  negocio: string;
  pedidoId: string;
  clasificacionPedido: ClasificacionOperativaPedido;
}): Promise<{ ok: true; clasificacionPedido: ClasificacionOperativaPedido } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const clasif = inferirClasificacionPedido({
      clasificacionExplicita: entrada.clasificacionPedido,
    });
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_actualizar_clasificacion_pedido",
      {
        p_negocio: neg,
        p_pedido_id: entrada.pedidoId,
        p_clasificacion: clasif,
      }
    );

    if (!error && data?.ok) {
      revalidarRutasTienda(neg);
      return {
        ok: true,
        clasificacionPedido: inferirClasificacionPedido({
          clasificacionExplicita: data.clasificacionPedido || clasif,
        }),
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo clasificar el pedido") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo híbrido sobre com_proforma / com_orden_taller antes de aplicar migración 20261118000005
    const db: any = crearClienteAdmin() ?? supabase;
    const { data: prf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_id, prf_detalle_proforma")
      .eq("prf_id", entrada.pedidoId)
      .maybeSingle();

    if (prf?.prf_id) {
      const det = (prf.prf_detalle_proforma ?? {}) as Record<string, any>;
      const { error: errUpd } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_detalle_proforma: {
            ...det,
            clasificacion_pedido: clasif,
          },
          prf_actualizado_en: new Date().toISOString(),
        })
        .eq("prf_id", prf.prf_id);

      if (errUpd) {
        return { ok: false, error: errUpd.message };
      }
    }

    revalidarRutasTienda(neg);
    return { ok: true, clasificacionPedido: clasif };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al clasificar el pedido",
    };
  }
}

export async function subirArchivoEvidenciaServidorAction(entrada: {
  negocio: string;
  carpeta: "evidencias-entregas" | "informes-entregas";
  dataUrl: string;
  extension?: "jpg" | "png" | "pdf";
}): Promise<{ ok: true; publicUrl: string; path: string } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Debes iniciar sesión para almacenar evidencias de entrega." };
    }

    const coma = entrada.dataUrl.indexOf(",");
    if (coma < 0) {
      return { ok: false, error: "Formato de archivo inválido para evidencia." };
    }
    const meta = entrada.dataUrl.slice(5, coma);
    const contentType =
      meta.split(";")[0] ||
      (entrada.extension === "pdf" ? "application/pdf" : "image/jpeg");
    const base64 = entrada.dataUrl.slice(coma + 1);
    const buffer = Buffer.from(base64, "base64");
    const ext = entrada.extension || (contentType.includes("png") ? "png" : "jpg");
    const fechaCarpeta = new Date().toISOString().slice(0, 10);
    const ruta = `${entrada.carpeta}/${neg}/${fechaCarpeta}/${crypto.randomUUID()}.${ext}`;

    const db: any = crearClienteAdmin() ?? supabase;
    const { error } = await db.storage.from("comun-publico").upload(ruta, buffer, {
      contentType,
      upsert: false,
    });

    if (error) {
      return { ok: false, error: error.message };
    }

    const { data } = db.storage.from("comun-publico").getPublicUrl(ruta);
    return {
      ok: true,
      publicUrl: String(data?.publicUrl || ""),
      path: ruta,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al almacenar la fotografía de evidencia",
    };
  }
}

async function resolverRolOperativoUsuarioServidor(
  supabase: any,
  negocio: string
): Promise<string> {
  try {
    const res = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_obtener_rol_operativo_negocio",
      { p_negocio: negocio }
    );
    if (!res.error && res.data) {
      return String(res.data).toUpperCase();
    }
  } catch {
    // Continuar con validación de membresía si falla
  }
  return "CLIENTE";
}

/**
 * Elimina un pedido:
 * - Borrado lógico (`definitivo = false`): permitido para SUPERADMIN, ADMINISTRADOR, OPERADOR y VENTAS.
 * - Borrado definitivo (`definitivo = true`): permitido EXCLUSIVAMENTE para SUPERADMIN o ADMINISTRADOR.
 */
export async function eliminarPedidoOperativoAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  proformaId?: string | null;
  entregaId?: string | null;
  motivo?: string;
  definitivo?: boolean;
}): Promise<
  | { ok: true; modo: "LOGICO" | "DEFINITIVO"; codigo: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const definitivo = Boolean(entrada.definitivo);

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_eliminar_pedido_operativo",
      {
        p_negocio: neg,
        p_payload: {
          ordenTallerId: entrada.ordenTallerId ?? null,
          proformaId: entrada.proformaId ?? null,
          entregaId: entrada.entregaId ?? null,
          motivo: entrada.motivo?.trim() || null,
          definitivo,
        },
      }
    );

    if (!error && data?.ok) {
      revalidarRutasTienda(neg);
      return {
        ok: true,
        modo: data.modo === "DEFINITIVO" ? "DEFINITIVO" : "LOGICO",
        codigo: String(data.codigo || "PEDIDO"),
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No tienes permisos para eliminar pedidos.") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo si la migración 20261118000007 aún no se ejecuta en Supabase
    const rol = await resolverRolOperativoUsuarioServidor(supabase, neg);
    const esAdmin = rol === "SUPERADMIN" || rol === "ADMINISTRADOR";
    if (definitivo && !esAdmin) {
      return {
        ok: false,
        error: "Solo el administrador puede eliminar pedidos de forma definitiva.",
      };
    }
    if (!esAdmin && rol !== "OPERADOR" && rol !== "VENTAS") {
      return { ok: false, error: "No tienes permisos para eliminar pedidos." };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const ahora = new Date().toISOString();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const nombreActor =
      String(user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email || "Usuario");

    if (definitivo) {
      if (entrada.entregaId) {
        await db.schema("comun_comercio").from("com_entrega_evidencia").delete().eq("ent_id", entrada.entregaId).eq("ent_negocio", neg);
      }
      if (entrada.ordenTallerId) {
        await db.schema("comun_comercio").from("com_orden_taller").delete().eq("ota_id", entrada.ordenTallerId).eq("ota_negocio", neg);
      }
      if (entrada.proformaId) {
        await db.schema("comun_comercio").from("com_proforma").delete().eq("prf_id", entrada.proformaId).eq("prf_negocio", neg);
      }
      revalidarRutasTienda(neg);
      return { ok: true, modo: "DEFINITIVO", codigo: "PEDIDO" };
    }

    if (entrada.ordenTallerId) {
      await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .update({
          ota_eliminado_en: ahora,
          ota_eliminado_por: user?.id ?? null,
          ota_eliminado_nombre: nombreActor,
          ota_eliminado_motivo: entrada.motivo?.trim() || null,
          ota_actualizado_en: ahora,
        })
        .eq("ota_id", entrada.ordenTallerId)
        .eq("ota_negocio", neg);
    }
    if (entrada.proformaId) {
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_eliminado_en: ahora,
          prf_estado: "ANULADA",
          prf_actualizado_en: ahora,
        })
        .eq("prf_id", entrada.proformaId)
        .eq("prf_negocio", neg);
    }
    if (entrada.entregaId) {
      await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .update({
          ent_eliminado_en: ahora,
          ent_estado: "ANULADA",
          ent_actualizado_en: ahora,
        })
        .eq("ent_id", entrada.entregaId)
        .eq("ent_negocio", neg);
    }

    revalidarRutasTienda(neg);
    return { ok: true, modo: "LOGICO", codigo: "PEDIDO" };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al eliminar el pedido",
    };
  }
}

/**
 * Restaura un pedido desde la Papelera (EXCLUSIVO SUPERADMIN / ADMINISTRADOR).
 */
export async function restaurarPedidoEliminadoAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  proformaId?: string | null;
  entregaId?: string | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_restaurar_pedido_eliminado",
      {
        p_negocio: neg,
        p_payload: {
          ordenTallerId: entrada.ordenTallerId ?? null,
          proformaId: entrada.proformaId ?? null,
          entregaId: entrada.entregaId ?? null,
        },
      }
    );

    if (!error && data?.ok) {
      revalidarRutasTienda(neg);
      return { ok: true };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Solo el administrador puede restaurar pedidos.") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    const rol = await resolverRolOperativoUsuarioServidor(supabase, neg);
    if (rol !== "SUPERADMIN" && rol !== "ADMINISTRADOR") {
      return { ok: false, error: "Solo el administrador puede restaurar pedidos eliminados." };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const ahora = new Date().toISOString();

    if (entrada.ordenTallerId) {
      await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .update({
          ota_eliminado_en: null,
          ota_eliminado_por: null,
          ota_eliminado_nombre: null,
          ota_eliminado_motivo: null,
          ota_actualizado_en: ahora,
        })
        .eq("ota_id", entrada.ordenTallerId)
        .eq("ota_negocio", neg);
    }
    if (entrada.proformaId) {
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_eliminado_en: null,
          prf_actualizado_en: ahora,
        })
        .eq("prf_id", entrada.proformaId)
        .eq("prf_negocio", neg);
    }
    if (entrada.entregaId) {
      await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .update({
          ent_eliminado_en: null,
          ent_actualizado_en: ahora,
        })
        .eq("ent_id", entrada.entregaId)
        .eq("ent_negocio", neg);
    }

    revalidarRutasTienda(neg);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al restaurar el pedido",
    };
  }
}

// =============================================================================
// 6. PANTALLA SMART TV TALLER, PRIORIZACIÓN MANUAL Y SHOWROOM DE EVENTOS
// =============================================================================

export async function reordenarPrioridadTallerAction(entrada: {
  negocio: string;
  ordenIds: string[];
}): Promise<{ ok: true; actualizados: number } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const idsLimpios = (entrada.ordenIds || []).filter((id) =>
      /^[0-9a-f-]{36}$/i.test(String(id || "").trim())
    );
    if (idsLimpios.length === 0) {
      return { ok: true, actualizados: 0 };
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_reordenar_prioridad_taller",
      {
        p_negocio: neg,
        p_orden_ids: idsLimpios,
      }
    );

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo actualizar la prioridad.") };
    }

    revalidarRutasTienda(neg);
    return { ok: true, actualizados: Number(data.actualizados) || idsLimpios.length };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al reordenar prioridad del taller",
    };
  }
}

export async function obtenerConfigTvTallerAction(
  negocio: string
): Promise<{ ok: true; config: ConfiguracionTvTaller } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_config_tv_taller",
      { p_negocio: neg }
    );

    if (!error && data?.ok) {
      return {
        ok: true,
        config: normalizarConfigTvTaller(data.config as Record<string, unknown>),
      };
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Sin permisos para leer config TV.") };
    }
    return {
      ok: false,
      error: error?.message || "No se pudo consultar la configuración de Pantalla TV.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error consultando configuración de Pantalla TV",
    };
  }
}

export async function guardarConfigTvTallerAction(entrada: {
  negocio: string;
  config: Partial<ConfiguracionTvTaller> & { regenerarToken?: boolean };
}): Promise<{ ok: true; config: ConfiguracionTvTaller } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_guardar_config_tv_taller",
      {
        p_negocio: neg,
        p_config: entrada.config,
      }
    );

    if (!error && data?.ok) {
      revalidarRutasTienda(neg);
      try {
        revalidatePath("/panel/taller/tv");
        revalidatePath("/tv-taller");
      } catch {
        // Ignorar fuera de request
      }
      return {
        ok: true,
        config: normalizarConfigTvTaller(data.config as Record<string, unknown>),
      };
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo guardar la configuración TV.") };
    }
    return {
      ok: false,
      error: error?.message || "Error al guardar la configuración de Pantalla TV.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar config TV",
    };
  }
}

export async function obtenerTableroTvTallerAction(
  negocio: string,
  token?: string | null
): Promise<{ ok: true; datos: DatosTableroTvTaller } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_obtener_tablero_tv_taller",
      {
        p_negocio: neg,
        p_token: token ? String(token).trim() : null,
      }
    );

    if (!error && data?.ok) {
      const { leerEstadosPedidosConfig } = await import("./acciones-logistica");
      const estadosConfigTv = await leerEstadosPedidosConfig(neg, supabase);
      const ordenesTvCrudas = Array.isArray(data.ordenes) ? (data.ordenes as OrdenTvTaller[]) : [];
      const ordenesTvFiltradas = ordenesTvCrudas.filter((ord) => {
        const estPago = (ord as unknown as { estadoPago?: string | null }).estadoPago;
        if (!estPago) return true;
        return esEstadoVisibleEnTaller(estPago, estadosConfigTv);
      });
      return {
        ok: true,
        datos: {
          modoAcceso: data.modoAcceso === "KIOSCO" ? "KIOSCO" : "AUTENTICADO",
          rolOperativo: data.rolOperativo ? String(data.rolOperativo) : undefined,
          esOperadorOAdmin: Boolean(data.esOperadorOAdmin),
          puedeInteractuar: Boolean(data.puedeInteractuar),
          hoyYmd: String(data.hoyYmd || obtenerFechaHoyEcuadorYmd()),
          ordenes: ordenesTvFiltradas,
          indicadoresTv:
            data.indicadoresTv && typeof data.indicadoresTv === "object"
              ? data.indicadoresTv
              : null,
          productosEventos: Array.isArray(data.productosEventos)
            ? (data.productosEventos as ProductoEventoTv[])
            : [],
          configTv: normalizarConfigTvTaller(data.configTv as Record<string, unknown>),
        },
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado a Pantalla TV.") };
    }

    return {
      ok: false,
      error: error?.message || "No se pudo cargar el tablero de Pantalla TV.",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar el tablero de Pantalla TV",
    };
  }
}

export async function actualizarEstadoOrdenTvAction(entrada: {
  negocio: string;
  ordenId: string;
  nuevoEstado: "EN_PREPARACION" | "LISTO_ENTREGA";
  token?: string | null;
}): Promise<
  | { ok: true; ordenId: string; codigo: string; estadoTaller: EstadoOrdenTaller }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const { data, error } = await invocarRpcComercio(
      supabase,
      "com_fn_actualizar_estado_tv_kiosco",
      {
        p_negocio: neg,
        p_orden_id: entrada.ordenId,
        p_nuevo_estado: entrada.nuevoEstado,
        p_token: entrada.token ? String(entrada.token).trim() : null,
      }
    );

    if (!error && data?.ok) {
      revalidarRutasTienda(neg);
      return {
        ok: true,
        ordenId: String(data.ordenId),
        codigo: String(data.codigo),
        estadoTaller: (data.estadoTaller as EstadoOrdenTaller) || entrada.nuevoEstado,
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo actualizar el estado.") };
    }
    return { ok: false, error: error?.message || "Error al actualizar estado desde TV." };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al actualizar estado TV",
    };
  }
}

const CACHE_ALBUMES_GOOGLE_FOTOS = new Map<
  string,
  { expiraEn: number; imagenes: string[]; titulo?: string }
>();

export async function extraerImagenesAlbumGoogleFotosAction(albumUrl: string): Promise<
  | { ok: true; imagenes: string[]; titulo?: string; desdeCache?: boolean }
  | { ok: false; error: string }
> {
  try {
    const urlLimpia = String(albumUrl || "").trim();
    if (!urlLimpia) {
      return { ok: false, error: "URL de álbum vacía." };
    }

    let parsed: URL;
    try {
      parsed = new URL(urlLimpia);
    } catch {
      return { ok: false, error: "URL de álbum inválida." };
    }

    const host = parsed.hostname.toLowerCase();
    const esGoogleFotos =
      host === "photos.app.goo.gl" ||
      host === "photos.google.com" ||
      host.endsWith(".googleusercontent.com");

    if (parsed.protocol !== "https:" || !esGoogleFotos) {
      return {
        ok: false,
        error: "Solo se permiten enlaces HTTPS de Google Fotos (photos.app.goo.gl o photos.google.com).",
      };
    }

    // Si es una imagen directa de googleusercontent, retornarla directamente
    if (host.endsWith(".googleusercontent.com")) {
      return { ok: true, imagenes: [urlLimpia] };
    }

    const ahora = Date.now();
    const cached = CACHE_ALBUMES_GOOGLE_FOTOS.get(urlLimpia);
    if (cached && cached.expiraEn > ahora) {
      return {
        ok: true,
        imagenes: cached.imagenes,
        titulo: cached.titulo,
        desdeCache: true,
      };
    }

    const resp = await fetch(urlLimpia, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      return {
        ok: false,
        error: `Google Fotos respondió HTTP ${resp.status}. Verifica que el álbum sea público compartido.`,
      };
    }

    const html = await resp.text();
    const tituloMatch = html.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const titulo = tituloMatch?.[1]?.trim();

    // Extraer URLs de fotos HD en Google Fotos (lh3.googleusercontent.com/pw/...)
    const regexPw = /https:\/\/lh3\.googleusercontent\.com\/pw\/[a-zA-Z0-9_-]+/g;
    const encontradas = new Set<string>();
    let m: RegExpExecArray | null;
    while ((m = regexPw.exec(html)) !== null) {
      encontradas.add(`${m[0]}=w1920-h1080-no`);
      if (encontradas.size >= 40) break;
    }

    // Fallback: og:image si Google cambió el patrón /pw/
    if (encontradas.size === 0) {
      const ogImg = html.match(/<meta\s+property="og:image"\s+content="([^"]+)"/i)?.[1];
      if (ogImg && ogImg.startsWith("https://lh3.googleusercontent.com/")) {
        encontradas.add(ogImg.replace(/=w\d+-h\d+.*$/, "=w1920-h1080-no"));
      }
    }

    const imagenes = Array.from(encontradas);
    if (imagenes.length === 0) {
      return {
        ok: false,
        error:
          "No se detectaron imágenes públicas en el enlace. Verifica que el álbum tenga activado 'Compartir enlace'.",
      };
    }

    CACHE_ALBUMES_GOOGLE_FOTOS.set(urlLimpia, {
      expiraEn: ahora + 2 * 60 * 60 * 1000, // 2 horas
      imagenes,
      titulo,
    });

    return { ok: true, imagenes, titulo };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo leer el álbum de Google Fotos: ${err.message}`
          : "Error al leer álbum de Google Fotos",
    };
  }
}

export interface ResultadoBusquedaYoutubeTv {
  videoId: string;
  titulo: string;
  canal: string;
  duracion: string;
  miniaturaUrl: string;
  url: string;
}

const CACHE_BUSQUEDA_YOUTUBE_TV = new Map<
  string,
  { expiraEn: number; resultados: ResultadoBusquedaYoutubeTv[] }
>();

export async function buscarVideosYoutubeTvAction(consulta: string): Promise<
  | { ok: true; resultados: ResultadoBusquedaYoutubeTv[] }
  | { ok: false; error: string }
> {
  try {
    const q = String(consulta || "").trim();
    if (!q || q.length < 2) {
      return { ok: false, error: "Escribe al menos 2 caracteres para buscar en YouTube." };
    }

    const clave = q.toLowerCase();
    const ahora = Date.now();
    const cached = CACHE_BUSQUEDA_YOUTUBE_TV.get(clave);
    if (cached && cached.expiraEn > ahora) {
      return { ok: true, resultados: cached.resultados };
    }

    const url = `https://www.youtube.com/results?search_query=${encodeURIComponent(q)}&hl=es&gl=EC`;
    const resp = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        "Accept-Language": "es-EC,es;q=0.9,en;q=0.8",
      },
      cache: "no-store",
    });

    if (!resp.ok) {
      return { ok: false, error: `YouTube respondió HTTP ${resp.status}.` };
    }

    const html = await resp.text();
    const candidatos: ResultadoBusquedaYoutubeTv[] = [];
    const vistos = new Set<string>();

    // Extraer JSON ytInitialData de la página de resultados de YouTube (hasta 24 candidatos para filtrar bloqueados)
    const marker = "var ytInitialData = ";
    const idxInicio = html.indexOf(marker);
    if (idxInicio >= 0) {
      const resto = html.slice(idxInicio + marker.length);
      const idxFin = resto.indexOf(";</script>");
      if (idxFin > 0) {
        try {
          const data = JSON.parse(resto.slice(0, idxFin));
          const recorrer = (nodo: any) => {
            if (!nodo || typeof nodo !== "object" || candidatos.length >= 24) return;
            if (nodo.videoRenderer && typeof nodo.videoRenderer === "object") {
              const vr = nodo.videoRenderer;
              const videoId = String(vr.videoId || "").trim();
              if (/^[a-zA-Z0-9_-]{11}$/.test(videoId) && !vistos.has(videoId)) {
                vistos.add(videoId);
                const titulo =
                  vr.title?.runs?.map((r: any) => r.text).join("") ||
                  vr.title?.simpleText ||
                  "Video YouTube";
                const canal =
                  vr.ownerText?.runs?.map((r: any) => r.text).join("") ||
                  vr.longBylineText?.runs?.map((r: any) => r.text).join("") ||
                  "YouTube";
                const duracion =
                  vr.lengthText?.simpleText ||
                  vr.lengthText?.runs?.map((r: any) => r.text).join("") ||
                  "EN VIVO";
                candidatos.push({
                  videoId,
                  titulo,
                  canal,
                  duracion,
                  miniaturaUrl: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
                  url: `https://www.youtube.com/watch?v=${videoId}`,
                });
              }
              return;
            }
            if (Array.isArray(nodo)) {
              for (const item of nodo) recorrer(item);
            } else {
              for (const val of Object.values(nodo)) {
                if (val && typeof val === "object") recorrer(val);
              }
            }
          };
          recorrer(data);
        } catch {
          // Continuar con regex fallback
        }
      }
    }

    // Fallback regex si YouTube cambió el envoltorio de ytInitialData
    if (candidatos.length === 0) {
      const regex = /"videoId":"([a-zA-Z0-9_-]{11})"/g;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(html)) !== null && candidatos.length < 20) {
        const vid = m[1]!;
        if (vistos.has(vid)) continue;
        vistos.add(vid);
        candidatos.push({
          videoId: vid,
          titulo: `Video YouTube (${vid})`,
          canal: "YouTube",
          duracion: "",
          miniaturaUrl: `https://i.ytimg.com/vi/${vid}/mqdefault.jpg`,
          url: `https://www.youtube.com/watch?v=${vid}`,
        });
      }
    }

    if (candidatos.length === 0) {
      return {
        ok: false,
        error: "No se encontraron videos para esa búsqueda. Puedes pegar directamente la URL de YouTube.",
      };
    }

    // Verificar en paralelo cuáles candidatos permiten reproducción embebida ("playableInEmbed":true)
    // para respetar el permiso oficial del dueño y evitar errores LatinAutor/UMPG en la TV
    const verificados = await Promise.all(
      candidatos.slice(0, 18).map(async (cand) => {
        const ac = new AbortController();
        const timer = setTimeout(() => ac.abort(), 2600);
        try {
          const r = await fetch(`https://www.youtube.com/watch?v=${cand.videoId}&hl=es`, {
            method: "GET",
            signal: ac.signal,
            headers: {
              "User-Agent":
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
            },
            cache: "no-store",
          });
          if (!r.ok) return null;
          const body = await r.text();
          // YouTube incluye explícitamente "playableInEmbed":true solo cuando el propietario/disquera permite embed
          const permiteEmbed = body.includes('"playableInEmbed":true');
          return permiteEmbed ? cand : null;
        } catch {
          return null;
        } finally {
          clearTimeout(timer);
        }
      })
    );

    const resultados = verificados.filter((x): x is ResultadoBusquedaYoutubeTv => x !== null).slice(0, 12);

    if (resultados.length === 0) {
      return {
        ok: false,
        error:
          "Las disqueras (LatinAutor/UMPG) bloquearon la inserción de los resultados para esa búsqueda. Prueba otra palabra clave (ej. 'mix dj', 'acústico', 'en vivo', 'instrumental'), usa Radio en Vivo o activa 'Flotar sobre YouTube.com'.",
      };
    }

    CACHE_BUSQUEDA_YOUTUBE_TV.set(clave, {
      expiraEn: ahora + 15 * 60 * 1000, // 15 min
      resultados,
    });

    return { ok: true, resultados };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `No se pudo buscar en YouTube: ${err.message}`
          : "Error al buscar en YouTube",
    };
  }
}

const CACHE_RADIOS_TV = new Map<
  string,
  { expiraEn: number; emisoras: EmisoraRadioTv[] }
>();

export async function buscarEmisorasRadioTvAction(entrada: {
  consulta?: string;
  pais?: string;
  genero?: string;
}): Promise<{ ok: true; emisoras: EmisoraRadioTv[] } | { ok: false; error: string }> {
  try {
    const q = String(entrada.consulta || "").trim();
    const pais = String(entrada.pais || "").trim();
    const genero = String(entrada.genero || "").trim();

    const clave = `${q.toLowerCase()}|${pais.toLowerCase()}|${genero.toLowerCase()}`;
    const ahora = Date.now();
    const cached = CACHE_RADIOS_TV.get(clave);
    if (cached && cached.expiraEn > ahora) {
      return { ok: true, emisoras: cached.emisoras };
    }

    const params = new URLSearchParams({
      hidebroken: "true",
      order: "clickcount",
      reverse: "true",
      limit: "28",
    });
    if (q) params.set("name", q);
    if (pais) params.set("countrycode", pais.toUpperCase());
    if (genero) params.set("tag", genero.toLowerCase());
    if (!q && !pais && !genero) {
      params.set("countrycode", "EC");
    }

    const mirrors = [
      "https://de1.api.radio-browser.info",
      "https://at1.api.radio-browser.info",
      "https://nl1.api.radio-browser.info",
    ];

    let rawList: any[] | null = null;
    for (const base of mirrors) {
      try {
        const resp = await fetch(`${base}/json/stations/search?${params.toString()}`, {
          method: "GET",
          headers: {
            "User-Agent": "EcosistemaFloristeriaTV/1.0",
            Accept: "application/json",
          },
          cache: "no-store",
        });
        if (resp.ok) {
          const json = await resp.json();
          if (Array.isArray(json)) {
            rawList = json;
            break;
          }
        }
      } catch {
        // Intentar siguiente mirror
      }
    }

    if (!rawList) {
      return {
        ok: false,
        error: "No se pudo conectar al directorio de radios en vivo. Intenta de nuevo en unos segundos.",
      };
    }

    const vistos = new Set<string>();
    const emisoras: EmisoraRadioTv[] = [];
    for (const item of rawList) {
      const streamUrl = String(item?.url_resolved || item?.url || "").trim();
      // Solo streams HTTPS para evitar bloqueo de Mixed Content en navegadores modernos
      if (!streamUrl.startsWith("https://")) continue;
      if (item?.lastcheckok === 0) continue;
      const nombre = String(item?.name || "").trim();
      if (!nombre || vistos.has(streamUrl)) continue;
      vistos.add(streamUrl);
      emisoras.push({
        id: String(item?.stationuuid || `rad-${emisoras.length + 1}`),
        nombre: nombre.slice(0, 80),
        streamUrl,
        pais: item?.country ? String(item.country).trim() : undefined,
        etiquetas: item?.tags ? String(item.tags).split(",").slice(0, 3).join(", ") : undefined,
        faviconUrl:
          typeof item?.favicon === "string" && item.favicon.startsWith("https://")
            ? item.favicon
            : undefined,
      });
      if (emisoras.length >= 16) break;
    }

    CACHE_RADIOS_TV.set(clave, {
      expiraEn: ahora + 30 * 60 * 1000,
      emisoras,
    });

    return { ok: true, emisoras };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `Error buscando emisoras en vivo: ${err.message}`
          : "Error al buscar radios en vivo",
    };
  }
}

// =============================================================================
// INGESTA DE PEDIDOS CON ARIA (TELEGRAM / MANYCHAT / CHAT GRUPAL)
// =============================================================================

export async function analizarMensajePedidoConAriaAction(entrada: {
  negocio: string;
  textoMensaje: string;
}): Promise<
  | { ok: true; datos: ResultadoParseoPedidoAria }
  | { ok: false; error: string }
> {
  try {
    const texto = String(entrada.textoMensaje || "").trim();
    if (texto.length < 4) {
      return { ok: false, error: "Escribe o pega el mensaje del pedido para que ARIA lo analice." };
    }

    const hoyYmd = obtenerFechaHoyEcuadorYmd();
    const base = parsearMensajePedidoDeterministico(texto, hoyYmd);

    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ""
    ).trim();
    const openaiKey = (process.env.OPENAI_API_KEY || "").trim();

    const promptAria = `Eres ARIA, asistente operativa de floristería Tinkay en Quito, Ecuador. Hoy es ${hoyYmd} (zona America/Guayaquil).
Analiza el siguiente mensaje (puede venir de Telegram, ManyChat o texto libre corto como "Exequiales sala 4 , pedido por cristina") y responde EXCLUSIVAMENTE un objeto JSON válido sin markdown ni texto adicional con estas claves exactas:
{
  "clasificacionPedido": "FLORISTERIA_OCASIONES" | "CONDOLENCIAS" | "EVENTOS" | "EXEQUIALES",
  "fechaEntrega": "YYYY-MM-DD",
  "franjaHoraria": "A) 09:00 - 13:00" | "B) 13:00 - 17:00" | "C) 17:00 - 20:00" | null,
  "horaEspecifica": "string o null (ej. 'De 12 pm a 2pm', 'Lo antes posible', '15:00')",
  "productoResumen": "resumen claro del arreglo o set",
  "items": [{"descripcion": "string", "cantidad": 1}],
  "clienteSolicita": "quien pide o envia (ej. Oscar, Cristina, feliz)",
  "clienteTelefono": "teléfono del remitente/comprador o ''",
  "destinatarioFallecido": "quien recibe o nombre del fallecido (si es exequiales y no consta, 'Por confirmar (Sala X)')",
  "salaServicio": "Sala 1..5 o null",
  "ubicacionEntrega": "sector y dirección (sin URL) o 'Exequiales del IESS'",
  "enlaceMapa": "URL de Google Maps si existe o null",
  "retiroEnLocal": false,
  "dedicatoria": "mensaje exacto de la tarjeta (sin Firma/De/Para duplicados si ya está claro) o ''",
  "observaciones": "datos extra útiles (color faltante, teléfono de quien recibe, link ManyChat, sector)",
  "totalUsd": 0,
  "faltantes": ["lista corta de datos importantes que faltan o dicen FALTA, ej: 'Color del arreglo', 'Nombre del fallecido'"]
}

Mensaje del pedido:
"""
${texto}
"""`;

    let jsonIa: Record<string, any> | null = null;
    let modeloIa: string | undefined;

    if (geminiKey) {
      for (const modelo of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptAria }] }],
                generationConfig: {
                  temperature: 0.1,
                  responseMimeType: "application/json",
                },
              }),
              signal: AbortSignal.timeout(15000),
            }
          );
          if (resp.ok) {
            const payload: any = await resp.json().catch(() => null);
            const rawTxt = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
            const matchJson = rawTxt.match(/\{[\s\S]*\}/);
            if (matchJson) {
              jsonIa = JSON.parse(matchJson[0]) as Record<string, any>;
              modeloIa = modelo;
              break;
            }
          }
        } catch {
          // Intentar siguiente modelo o proveedor
        }
      }
    }

    if (!jsonIa && openaiKey) {
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: 0.1,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: promptAria }],
          }),
          signal: AbortSignal.timeout(15000),
        });
        if (resp.ok) {
          const payload: any = await resp.json().catch(() => null);
          const rawTxt = String(payload?.choices?.[0]?.message?.content || "").trim();
          const matchJson = rawTxt.match(/\{[\s\S]*\}/);
          if (matchJson) {
            jsonIa = JSON.parse(matchJson[0]) as Record<string, any>;
            modeloIa = "gpt-4o-mini";
          }
        }
      } catch {
        // Respaldo determinístico garantizado
      }
    }

    if (!jsonIa) {
      return { ok: true, datos: base };
    }

    const clasifIa = inferirClasificacionPedido({
      clasificacionExplicita:
        typeof jsonIa.clasificacionPedido === "string" ? jsonIa.clasificacionPedido : base.clasificacionPedido,
      origenTipo: base.origenTipo,
      retiroEnLocal: Boolean(jsonIa.retiroEnLocal ?? base.retiroEnLocal),
      salaServicio: (jsonIa.salaServicio as string | null) ?? base.salaServicio,
      productoResumen: String(jsonIa.productoResumen || base.productoResumen),
      ubicacionEntrega: String(jsonIa.ubicacionEntrega || base.ubicacionEntrega),
    });

    const itemsIa =
      Array.isArray(jsonIa.items) && jsonIa.items.length > 0
        ? jsonIa.items
            .map((it: any) => ({
              descripcion: String(it?.descripcion || "").trim(),
              cantidad: Math.max(1, Number(it?.cantidad || 1)),
            }))
            .filter((it) => Boolean(it.descripcion))
        : base.items;

    const fechaValida =
      typeof jsonIa.fechaEntrega === "string" && /^\d{4}-\d{2}-\d{2}$/.test(jsonIa.fechaEntrega)
        ? jsonIa.fechaEntrega
        : base.fechaEntrega;

    return {
      ok: true,
      datos: {
        clasificacionPedido: clasifIa,
        origenTipo: clasifIa === "EXEQUIALES" ? "EXEQUIALES_LLAMADA" : "MANUAL_ADMIN",
        fechaEntrega: fechaValida,
        franjaHoraria: jsonIa.franjaHoraria
          ? normalizarFranjaHorariaTienda(String(jsonIa.franjaHoraria))
          : base.franjaHoraria,
        horaEspecifica:
          jsonIa.horaEspecifica !== undefined
            ? (jsonIa.horaEspecifica ? String(jsonIa.horaEspecifica).trim() : null)
            : base.horaEspecifica,
        productoResumen: String(jsonIa.productoResumen || "").trim() || base.productoResumen,
        items: itemsIa,
        clienteSolicita: String(jsonIa.clienteSolicita || "").trim() || base.clienteSolicita,
        clienteTelefono: String(jsonIa.clienteTelefono || "").trim() || base.clienteTelefono,
        destinatarioFallecido:
          String(jsonIa.destinatarioFallecido || "").trim() || base.destinatarioFallecido,
        salaServicio:
          jsonIa.salaServicio ? String(jsonIa.salaServicio).trim() : base.salaServicio,
        ubicacionEntrega:
          String(jsonIa.ubicacionEntrega || "").trim() || base.ubicacionEntrega,
        enlaceMapa:
          jsonIa.enlaceMapa && String(jsonIa.enlaceMapa).startsWith("http")
            ? String(jsonIa.enlaceMapa).trim()
            : base.enlaceMapa,
        retiroEnLocal: Boolean(jsonIa.retiroEnLocal ?? base.retiroEnLocal),
        dedicatoria:
          typeof jsonIa.dedicatoria === "string" && jsonIa.dedicatoria.trim()
            ? jsonIa.dedicatoria.trim()
            : base.dedicatoria,
        observaciones:
          typeof jsonIa.observaciones === "string" && jsonIa.observaciones.trim()
            ? jsonIa.observaciones.trim()
            : base.observaciones,
        totalUsd: Number(jsonIa.totalUsd) > 0 ? Number(jsonIa.totalUsd) : base.totalUsd,
        estadoInicial: "NUEVO_POR_CONFIRMAR",
        faltantes:
          Array.isArray(jsonIa.faltantes) && jsonIa.faltantes.length > 0
            ? jsonIa.faltantes.map(String)
            : base.faltantes,
        usadoIa: true,
        modeloIa,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error analizando el pedido con ARIA",
    };
  }
}

export async function crearPedidoDesdeMensajeAriaAction(entrada: {
  negocio: string;
  datos?: ResultadoParseoPedidoAria;
  textoMensaje?: string;
}): Promise<
  | {
      ok: true;
      ordenId: string;
      codigo: string;
      estado: string;
      datos: ResultadoParseoPedidoAria;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    let datos = entrada.datos;
    if (!datos && entrada.textoMensaje) {
      const analizado = await analizarMensajePedidoConAriaAction({
        negocio: neg,
        textoMensaje: entrada.textoMensaje,
      });
      if (!analizado.ok) return analizado;
      datos = analizado.datos;
    }
    if (!datos) {
      return { ok: false, error: "Faltan datos estructurados del pedido." };
    }

    const estadoInicial = datos.estadoInicial || "NUEVO_POR_CONFIRMAR";
    const resCrear = await crearOActualizarPedidoOperadorAction({
      negocio: neg,
      origenTipo: datos.origenTipo,
      clasificacionPedido: datos.clasificacionPedido,
      fechaEntrega: datos.fechaEntrega,
      franjaHoraria: datos.franjaHoraria ?? undefined,
      horaEspecifica: datos.horaEspecifica ?? undefined,
      productoResumen: datos.productoResumen,
      items: datos.items,
      clienteSolicita: datos.clienteSolicita,
      clienteTelefono: datos.clienteTelefono,
      destinatarioFallecido: datos.destinatarioFallecido,
      salaServicio: datos.salaServicio ?? undefined,
      ubicacionEntrega: datos.ubicacionEntrega,
      enlaceMapa: datos.enlaceMapa ?? undefined,
      retiroEnLocal: datos.retiroEnLocal,
      dedicatoria: datos.dedicatoria,
      observaciones: datos.observaciones,
      totalUsd: datos.totalUsd,
      enviarATaller: false,
    });

    if (!resCrear.ok) return resCrear;

    // Fijar el estado inicial (por defecto NUEVO_POR_CONFIRMAR) en com_orden_taller
    try {
      const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
      const supabase = await crearClienteServidor();
      const db: any = crearClienteAdmin() ?? supabase;
      await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .update({
          ota_estado_pago: estadoInicial,
          ota_actualizado_en: new Date().toISOString(),
        })
        .eq("ota_id", resCrear.ordenId)
        .eq("ota_negocio", neg);
    } catch {
      // No bloquear creación si falla el ajuste de etiqueta de estado
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      ordenId: resCrear.ordenId,
      codigo: resCrear.codigo,
      estado: estadoInicial,
      datos: { ...datos, estadoInicial },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error creando pedido con ARIA",
    };
  }
}

export interface OpcionMensajeTarjetaIa {
  titulo: string;
  texto: string;
}

function sugerirEmojisLocalPorContexto(texto: string, ocasion?: string): string[] {
  const fuente = `${texto} ${ocasion || ""}`.toLowerCase();
  const res: string[] = [];
  const agregar = (...items: string[]) => {
    for (const it of items) {
      if (!res.includes(it) && res.length < 8) res.push(it);
    }
  };

  if (/cumple|años|anos|feliz d[ií]a|velita|celebr/.test(fuente)) {
    agregar("🎂", "🎉", "💐", "✨", "🥂", "🎈", "❤️");
  }
  if (/amor|enamor|novi|espos|te amo|te quiero|coraz[oó]n|vida m[ií]a|mi amor|pareja/.test(fuente)) {
    agregar("❤️", "🌹", "✨", "🥰", "💫", "💕", "💐");
  }
  if (/aniversario|bodas|juntos|meses|a[nñ]os juntos/.test(fuente)) {
    agregar("🥂", "❤️", "🌹", "✨", "💍", "💕", "💐");
  }
  if (/gracia|agradec|apoyo|ayuda|gratitud/.test(fuente)) {
    agregar("🙏", "💐", "✨", "🤍", "🌸", "💛");
  }
  if (/mam[aá]|madre|pap[aá]|familia|abuel|hermana|hermano/.test(fuente)) {
    agregar("💐", "❤️", "🌸", "✨", "🤗", "🤍");
  }
  if (/perd[oó]n|disculp|reconcili|lo siento|volver/.test(fuente)) {
    agregar("🤍", "🌹", "✨", "🙏", "❤️", "🕊️");
  }
  if (/amig|amistad|c[oó]mplice/.test(fuente)) {
    agregar("🌸", "✨", "🥂", "💛", "🤗", "💐");
  }
  if (/gradu|logro|[eé]xito|felicita|ascenso|meta/.test(fuente)) {
    agregar("🎉", "🥂", "✨", "🌟", "💐", "👏");
  }

  agregar("💐", "✨", "❤️", "🌸", "🌹", "🤍");
  return res.slice(0, 7);
}

function corregirYEstructurarMensajeLocal(raw: string): string {
  let texto = String(raw || "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .trim();
  if (!texto) return "";

  const correcciones: Array<[RegExp, string]> = [
    [/\bcumpleanos\b/gi, "cumpleaños"],
    [/\bcorazon\b/gi, "corazón"],
    [/\bdia\b/gi, "día"],
    [/\bdias\b/gi, "días"],
    [/\btambien\b/gi, "también"],
    [/\bmas\b/gi, "más"],
    [/\bestas\b/gi, "estás"],
    [/\baca\b/gi, "acá"],
    [/\basi\b/gi, "así"],
    [/\bmama\b/gi, "mamá"],
    [/\bpapa\b/gi, "papá"],
    [/\bperdon\b/gi, "perdón"],
    [/\bexito\b/gi, "éxito"],
    [/\bexitos\b/gi, "éxitos"],
    [/\bbendicion\b/gi, "bendición"],
    [/\bbendiciones\b/gi, "bendiciones"],
    [/\bsueno\b/gi, "sueño"],
    [/\bsuenos\b/gi, "sueños"],
    [/\bcarino\b/gi, "cariño"],
    [/\bcompanero\b/gi, "compañero"],
    [/\bcompanera\b/gi, "compañera"],
    [/\bincreible\b/gi, "increíble"],
    [/\bunico\b/gi, "único"],
    [/\bunica\b/gi, "única"],
    [/\bmagico\b/gi, "mágico"],
    [/\bmagica\b/gi, "mágica"],
    [/\bfelicidad\b/gi, "felicidad"],
  ];

  for (const [rx, rep] of correcciones) {
    texto = texto.replace(rx, (m) =>
      m[0] && m[0] === m[0].toUpperCase()
        ? rep.charAt(0).toUpperCase() + rep.slice(1)
        : rep
    );
  }

  // Limpiar espacios antes de puntuación y asegurar espacio después
  texto = texto
    .replace(/\s+([.,!?;:])/g, "$1")
    .replace(/([.,!?;:])([^\s\n.,!?;:])/g, "$1 $2");

  // Separar en frases limpias con saltos de línea equilibrados para la cartulina vertical
  const oraciones = texto
    .split(/\n+/)
    .flatMap((bloque) => bloque.split(/(?<=[.!?])\s+/))
    .map((s) => s.trim())
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1));

  const lineas: string[] = [];
  for (const oracion of oraciones) {
    if (oracion.length <= 58) {
      lineas.push(oracion);
    } else {
      const partes = oracion.split(/,\s+/);
      let actual = "";
      for (let i = 0; i < partes.length; i++) {
        const frag = partes[i]! + (i < partes.length - 1 ? "," : "");
        if (!actual) {
          actual = frag;
        } else if ((actual + " " + frag).length <= 56) {
          actual = `${actual} ${frag}`;
        } else {
          lineas.push(actual.trim());
          actual = frag;
        }
      }
      if (actual.trim()) lineas.push(actual.trim());
    }
  }

  return lineas.join("\n");
}

function generarOpcionesLocales(params: {
  mensajeBase: string;
  ocasion: string;
  destinatario: string;
  ideaBreve: string;
}): OpcionMensajeTarjetaIa[] {
  const nombre = params.destinatario.trim();
  const saludo = nombre ? `${nombre},\n` : "";
  const baseLimpio = corregirYEstructurarMensajeLocal(params.mensajeBase);

  if (baseLimpio.length >= 12) {
    return [
      {
        titulo: "Natural y bien estructurada",
        texto: baseLimpio,
      },
      {
        titulo: "Más cálida y emotiva",
        texto: `${saludo}${baseLimpio}\nGracias por hacer cada momento tan especial.`,
      },
    ];
  }

  const oc = `${params.ocasion} ${params.ideaBreve}`.toLowerCase();
  if (/cumple/.test(oc)) {
    return [
      {
        titulo: "Cálida y alegre",
        texto: `${saludo}¡Feliz cumpleaños!\nQue este nuevo año te regale salud,\ncalma y mil motivos para sonreír.`,
      },
      {
        titulo: "Emotiva y cercana",
        texto: `${saludo}Hoy celebro tu vida y todo lo hermoso\nque compartes con quienes te rodean.\nQue se cumplan todos tus sueños.`,
      },
    ];
  }
  if (/aniversario/.test(oc)) {
    return [
      {
        titulo: "Romántica y sincera",
        texto: `${saludo}Feliz aniversario.\nGracias por cada risa, cada abrazo\ny por caminar a mi lado cada día.`,
      },
      {
        titulo: "Poética",
        texto: `${saludo}Un año más eligiendo compartir\nmi vida contigo.\nLo mejor de mi historia eres tú.`,
      },
    ];
  }
  if (/gracia|agradec/.test(oc)) {
    return [
      {
        titulo: "Sincera y directa",
        texto: `${saludo}Muchas gracias por tu apoyo\ny por estar siempre presente.\nEste detalle lleva toda mi gratitud.`,
      },
      {
        titulo: "Cálida",
        texto: `${saludo}Hay gestos que nunca se olvidan.\nGracias de corazón por tu tiempo,\ntu cariño y tu generosidad.`,
      },
    ];
  }
  if (/perd[oó]n|reconcili/.test(oc)) {
    return [
      {
        titulo: "Honesta y cercana",
        texto: `${saludo}Lo siento de corazón.\nValoro muchísimo lo que tenemos\ny quiero hacer las cosas bien contigo.`,
      },
      {
        titulo: "Dulce y conciliadora",
        texto: `${saludo}Estas flores llevan mis disculpas\ny todo el cariño que siento por ti.\nHablemos cuando estés lista.`,
      },
    ];
  }
  if (/amig|amistad/.test(oc)) {
    return [
      {
        titulo: "Cercana y alegre",
        texto: `${saludo}Gracias por ser una amistad\ntan genuina y luminosa.\nQué suerte tenerte en mi vida.`,
      },
      {
        titulo: "Especial",
        texto: `${saludo}Un pequeño detalle para recordarte\ncuánto te aprecio y lo valiosa\nque es nuestra amistad.`,
      },
    ];
  }
  if (/mam[aá]|familia/.test(oc)) {
    return [
      {
        titulo: "Tierna y agradecida",
        texto: `${saludo}Gracias por tu amor incondicional\ny por ser siempre mi mayor refugio.\nTe quiero con todo mi corazón.`,
      },
      {
        titulo: "Cálida",
        texto: `${saludo}Cada flor lleva un abrazo enorme\ny toda la gratitud por lo mucho\nque significas para mí.`,
      },
    ];
  }
  if (/felicita|logro|gradu/.test(oc)) {
    return [
      {
        titulo: "Orgullosa y alegre",
        texto: `${saludo}¡Muchas felicidades por este gran logro!\nTu esfuerzo y dedicación hoy brillan.\nQue vengan muchos éxitos más.`,
      },
      {
        titulo: "Inspiradora",
        texto: `${saludo}Celebro contigo este paso tan merecido.\nQue cada nueva meta te encuentre\ncon la misma pasión y alegría.`,
      },
    ];
  }

  return [
    {
      titulo: "Romántica y cercana",
      texto: `${saludo}Estas flores llevan todo mi cariño.\nPensarte siempre me regala una sonrisa\ny hace mis días más bonitos.`,
    },
    {
      titulo: "Profunda y emotiva",
      texto: `${saludo}Con todo mi amor, hoy y siempre.\nGracias por llenar mi vida de luz\ny de momentos inolvidables.`,
    },
  ];
}

/**
 * Asistente IA público para redactar 2 opciones de dedicatoria, corregir ortografía,
 * estructurar saltos de línea estéticos para cartulina y sugerir emojis acordes al mensaje.
 */
export async function asistirMensajeTarjetaIaAction(entrada: {
  modo: "sugerir_opciones" | "corregir_y_estructurar";
  mensajeBase?: string;
  ocasion?: string;
  destinatario?: string;
  ideaBreve?: string;
  negocio?: string;
}): Promise<
  | {
      ok: true;
      opciones: OpcionMensajeTarjetaIa[];
      emojisSugeridos: string[];
      origenIa: "gemini" | "openai" | "local";
    }
  | { ok: false; error: string }
> {
  try {
    const modo = entrada.modo === "corregir_y_estructurar" ? "corregir_y_estructurar" : "sugerir_opciones";
    const mensajeBase = String(entrada.mensajeBase || "").trim().slice(0, 900);
    const ocasion = String(entrada.ocasion || "").trim().slice(0, 120);
    const destinatario = String(entrada.destinatario || "").trim().slice(0, 100);
    const ideaBreve = String(entrada.ideaBreve || "").trim().slice(0, 260);

    if (modo === "corregir_y_estructurar" && mensajeBase.length < 3) {
      return { ok: false, error: "Escribe primero tu mensaje para poder corregirlo y ordenarlo." };
    }
    if (modo === "sugerir_opciones" && !mensajeBase && !ocasion && !ideaBreve) {
      return { ok: false, error: "Elige una ocasión o escribe una breve idea para crear tus opciones." };
    }

    const prompt =
      modo === "corregir_y_estructurar"
        ? `Eres un editor experto en tarjetas de floristería en español (Ecuador/Latinoamérica).
Tu tarea es tomar el siguiente mensaje escrito por un cliente, SIN cambiar su esencia ni inventar datos que no dijo:
1. Corrige ortografía, tildes, mayúsculas y puntuación.
2. Estructura el mensaje en frases cortas y armoniosas separadas con saltos de línea ("\\n") para que se vea elegante y balanceado impreso en una tarjeta vertical de 11x16 cm (máximo ~35-48 caracteres por línea donde suene natural).
3. Sugiere entre 5 y 7 emojis apropiados y de buen gusto según el tono del mensaje (NO los metas a la fuerza en el texto si el cliente no los puso; devuélvelos aparte en emojisSugeridos).

Responde EXCLUSIVAMENTE un JSON válido sin markdown:
{
  "opciones": [
    { "titulo": "Texto corregido y estructurado", "texto": "..." }
  ],
  "emojisSugeridos": ["❤️", "✨", "..."]
}

Destinatario (referencia): "${destinatario || "No especificado"}"
Mensaje original del cliente:
"""
${mensajeBase}
"""`
        : `Eres un redactor creativo de tarjetas florales en español natural y elegante (Ecuador/Latinoamérica).
Crea EXACTAMENTE 2 opciones distintas de dedicatoria para una tarjeta impresa de 11x16 cm:
- Si el cliente escribió un mensaje base, respeta su intención/sentimiento y crea 2 versiones pulidas (una más cercana/natural y otra un poco más emotiva/poética).
- Si no escribió mensaje base, crea 2 opciones genuinas para la ocasión indicada (sin sonar robótico ni cliché).
- Ortografía y tildes impecables en español.
- Estructura cada opción con saltos de línea ("\\n") bien pensados por frases para que luzca estético y centrado en la tarjeta.
- Longitud ideal por opción: 3 a 5 líneas breves (máximo ~220 caracteres). No incluyas "Para:" ni firma al final.
- Sugiere entre 5 y 7 emojis útiles y de buen gusto según el mensaje en "emojisSugeridos" (sin saturar los textos).

Responde EXCLUSIVAMENTE un JSON válido sin markdown:
{
  "opciones": [
    { "titulo": "Cálida y cercana", "texto": "..." },
    { "titulo": "Emotiva y poética", "texto": "..." }
  ],
  "emojisSugeridos": ["❤️", "🌹", "..."]
}

Ocasión: "${ocasion || "Especial"}"
Destinatario (referencia): "${destinatario || "No especificado"}"
Detalle o idea extra: "${ideaBreve || "Ninguno"}"
Mensaje base del cliente:
"""
${mensajeBase || "(Sin mensaje base, redactar según la ocasión)"}
"""`;

    const geminiKey = (
      process.env.GEMINI_API_KEY ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
      ""
    ).trim();
    const openaiKey = (process.env.OPENAI_API_KEY || "").trim();

    let jsonIa: Record<string, any> | null = null;
    let origenIa: "gemini" | "openai" | "local" = "local";

    if (geminiKey) {
      for (const modelo of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
        try {
          const resp = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(geminiKey)}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                contents: [{ parts: [{ text: prompt }] }],
                generationConfig: {
                  temperature: modo === "corregir_y_estructurar" ? 0.15 : 0.65,
                  responseMimeType: "application/json",
                },
              }),
              signal: AbortSignal.timeout(14000),
            }
          );
          if (resp.ok) {
            const payload: any = await resp.json().catch(() => null);
            const rawTxt = String(payload?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
            const matchJson = rawTxt.match(/\{[\s\S]*\}/);
            if (matchJson) {
              jsonIa = JSON.parse(matchJson[0]) as Record<string, any>;
              origenIa = "gemini";
              break;
            }
          }
        } catch {
          // Intentar siguiente modelo o proveedor
        }
      }
    }

    if (!jsonIa && openaiKey) {
      try {
        const resp = await fetch("https://api.openai.com/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${openaiKey}`,
          },
          body: JSON.stringify({
            model: "gpt-4o-mini",
            temperature: modo === "corregir_y_estructurar" ? 0.15 : 0.65,
            response_format: { type: "json_object" },
            messages: [{ role: "user", content: prompt }],
          }),
          signal: AbortSignal.timeout(14000),
        });
        if (resp.ok) {
          const payload: any = await resp.json().catch(() => null);
          const rawTxt = String(payload?.choices?.[0]?.message?.content || "").trim();
          const matchJson = rawTxt.match(/\{[\s\S]*\}/);
          if (matchJson) {
            jsonIa = JSON.parse(matchJson[0]) as Record<string, any>;
            origenIa = "openai";
          }
        }
      } catch {
        // Respaldo determinístico local
      }
    }

    if (jsonIa && Array.isArray(jsonIa.opciones) && jsonIa.opciones.length > 0) {
      const opcionesLimpias: OpcionMensajeTarjetaIa[] = jsonIa.opciones
        .map((op: any, idx: number) => ({
          titulo: String(op?.titulo || (idx === 0 ? "Opción 1" : "Opción 2")).trim(),
          texto: String(op?.texto || "").replace(/\\n/g, "\n").trim(),
        }))
        .filter((op: OpcionMensajeTarjetaIa) => op.texto.length > 0)
        .slice(0, modo === "corregir_y_estructurar" ? 1 : 2);

      if (opcionesLimpias.length > 0) {
        const emojisIa = Array.isArray(jsonIa.emojisSugeridos)
          ? jsonIa.emojisSugeridos
              .map((em: any) => String(em || "").trim())
              .filter((em: string) => em.length > 0 && em.length <= 8)
              .slice(0, 7)
          : [];
        return {
          ok: true,
          opciones: opcionesLimpias,
          emojisSugeridos:
            emojisIa.length > 0
              ? emojisIa
              : sugerirEmojisLocalPorContexto(opcionesLimpias[0]!.texto, ocasion),
          origenIa,
        };
      }
    }

    // Respaldo determinístico garantizado (nunca falla aunque no haya API key en el entorno)
    const opcionesFallback =
      modo === "corregir_y_estructurar"
        ? [
            {
              titulo: "Texto corregido y estructurado",
              texto: corregirYEstructurarMensajeLocal(mensajeBase),
            },
          ]
        : generarOpcionesLocales({ mensajeBase, ocasion, destinatario, ideaBreve });

    return {
      ok: true,
      opciones: opcionesFallback,
      emojisSugeridos: sugerirEmojisLocalPorContexto(
        mensajeBase || opcionesFallback[0]?.texto || "",
        ocasion || ideaBreve
      ),
      origenIa: "local",
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo consultar el asistente de redacción.",
    };
  }
}



