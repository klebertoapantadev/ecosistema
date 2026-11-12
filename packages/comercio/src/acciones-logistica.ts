"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  buscarDireccionesPichincha,
  calcularRutaVialOsrm,
  cotizarEnvioDomicilio,
  crearConfiguracionLogisticaPorDefecto,
  esCoordenadaValida,
  resolverEnlaceMapaACoordenadas,
  type ConfiguracionLogisticaNegocio,
  type ModoCobroZona,
  type ResultadoCotizacionEnvio,
  type SugerenciaDireccionMapa,
  type ZonaCoberturaLogistica,
} from "./logistica";

const esquemaZona = z.object({
  id: z.string().min(1),
  codigo: z.string().min(1),
  nombre: z.string().min(2, "El nombre de la zona es obligatorio"),
  provincia: z.string().default("Pichincha"),
  modoCobro: z.enum(["GRATIS", "TARIFA_FIJA", "POR_KM"]),
  tarifaFija: z.number().min(0),
  prioridad: z.number().int().min(1).max(999),
  activo: z.boolean(),
  color: z.string().default("#0284C7"),
  sectoresReferencia: z.array(z.string()).default([]),
  poligono: z.array(z.tuple([z.number(), z.number()])).min(3, "Cada zona requiere al menos 3 vértices"),
});

const esquemaConfigLogistica = z.object({
  negocio: z.string().min(1),
  activo: z.boolean(),
  origenNombre: z.string().min(2, "Indica el nombre del taller o punto de partida"),
  origenDireccion: z.string().default(""),
  origenMapaUrl: z.string().default(""),
  origenLat: z.number().min(-90).max(90),
  origenLng: z.number().min(-180).max(180),
  zonaGratisNombre: z.string().min(2, "Indica el nombre de la zona de envío gratis"),
  etiquetaEnvioGratis: z.string().min(2),
  tarifaPorKm: z.number().min(0).max(50),
  subsidioBaseUsd: z.number().min(0).max(100),
  recargoMinimoExtra: z.number().min(0).max(100),
  tarifaBaseNoIncluido: z.number().min(0).max(100),
  recargoHoraExacta: z.number().min(0).max(100),
  radioMaximoKm: z.number().min(1).max(300),
  factorVialRespaldo: z.number().min(1).max(3),
  permitirRetiroLocal: z.boolean(),
  zonas: z.array(esquemaZona).min(1, "Debe existir al menos una zona de cobertura"),
});

function obtenerCredencialesPublicasSupabase() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.SUPABASE_URL ||
    "https://oaybbpdxhlxjbpwnoymy.supabase.co"
  ).replace(/\/$/, "");

  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS";

  return { url, key };
}

function normalizarConfiguracionDesdeJson(
  negocio: string,
  raw: Record<string, unknown>
): ConfiguracionLogisticaNegocio {
  const base = crearConfiguracionLogisticaPorDefecto(negocio);
  const zonasRaw = Array.isArray(raw.zonas) ? raw.zonas : null;

  const zonasNormalizadas: ZonaCoberturaLogistica[] =
    zonasRaw && zonasRaw.length > 0
      ? zonasRaw
          .map((z: any, idx: number): ZonaCoberturaLogistica | null => {
            if (!z || typeof z !== "object") return null;
            const poligono: [number, number][] = Array.isArray(z.poligono)
              ? z.poligono
                  .filter(
                    (par: unknown) =>
                      Array.isArray(par) &&
                      par.length >= 2 &&
                      Number.isFinite(Number(par[0])) &&
                      Number.isFinite(Number(par[1]))
                  )
                  .map((par: any) => [Number(par[0]), Number(par[1])] as [number, number])
              : [];
            if (poligono.length < 3) return null;

            const modo = String(z.modoCobro || "POR_KM").toUpperCase();
            const modoValido: ModoCobroZona =
              modo === "GRATIS" || modo === "TARIFA_FIJA" || modo === "POR_KM"
                ? modo
                : "POR_KM";

            return {
              id: String(z.id || `zon-${idx + 1}`),
              codigo: String(z.codigo || `zona_${idx + 1}`),
              nombre: String(z.nombre || `Zona ${idx + 1}`),
              provincia: String(z.provincia || "Pichincha"),
              modoCobro: modoValido,
              tarifaFija: Number.isFinite(Number(z.tarifaFija)) ? Number(z.tarifaFija) : 0,
              prioridad: Number.isFinite(Number(z.prioridad)) ? Number(z.prioridad) : idx + 1,
              activo: z.activo !== false,
              color: String(z.color || "#0284C7"),
              sectoresReferencia: Array.isArray(z.sectoresReferencia)
                ? z.sectoresReferencia.map((s: unknown) => String(s))
                : [],
              poligono,
            };
          })
          .filter((x): x is ZonaCoberturaLogistica => x !== null)
      : base.zonas;

  return {
    negocio: base.negocio,
    activo: raw.activo !== false,
    origenNombre: String(raw.origenNombre || base.origenNombre),
    origenDireccion: String(raw.origenDireccion ?? base.origenDireccion),
    origenMapaUrl: String(raw.origenMapaUrl ?? base.origenMapaUrl),
    origenLat: Number.isFinite(Number(raw.origenLat)) ? Number(raw.origenLat) : base.origenLat,
    origenLng: Number.isFinite(Number(raw.origenLng)) ? Number(raw.origenLng) : base.origenLng,
    zonaGratisNombre: String(raw.zonaGratisNombre || base.zonaGratisNombre),
    etiquetaEnvioGratis: String(raw.etiquetaEnvioGratis || base.etiquetaEnvioGratis),
    tarifaPorKm: Number.isFinite(Number(raw.tarifaPorKm))
      ? Number(raw.tarifaPorKm)
      : base.tarifaPorKm,
    subsidioBaseUsd: Number.isFinite(Number(raw.subsidioBaseUsd))
      ? Number(raw.subsidioBaseUsd)
      : base.subsidioBaseUsd,
    recargoMinimoExtra: Number.isFinite(Number(raw.recargoMinimoExtra))
      ? Number(raw.recargoMinimoExtra)
      : base.recargoMinimoExtra,
    tarifaBaseNoIncluido: Number.isFinite(Number(raw.tarifaBaseNoIncluido))
      ? Number(raw.tarifaBaseNoIncluido)
      : base.tarifaBaseNoIncluido,
    recargoHoraExacta: Number.isFinite(Number(raw.recargoHoraExacta))
      ? Number(raw.recargoHoraExacta)
      : base.recargoHoraExacta,
    radioMaximoKm: Number.isFinite(Number(raw.radioMaximoKm))
      ? Number(raw.radioMaximoKm)
      : base.radioMaximoKm,
    factorVialRespaldo: Number.isFinite(Number(raw.factorVialRespaldo))
      ? Number(raw.factorVialRespaldo)
      : base.factorVialRespaldo,
    permitirRetiroLocal: raw.permitirRetiroLocal !== false,
    zonas: zonasNormalizadas.length > 0 ? zonasNormalizadas : base.zonas,
    actualizadoEn: typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : null,
  };
}

/**
 * Obtiene la configuración logística y zonas de cobertura de un negocio.
 * Funciona tanto desde Server Components / Actions como desde endpoints públicos sin cookies (MCP / API).
 */
export async function obtenerConfiguracionLogisticaAction(
  negocio: string
): Promise<ConfiguracionLogisticaNegocio> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const { url, key } = obtenerCredencialesPublicasSupabase();
  const base = crearConfiguracionLogisticaPorDefecto(negocio);

  // 1. Intentar tablas dedicadas en comun_comercio (com_logistica_negocio + com_zona_cobertura)
  try {
    const [resLog, resZon] = await Promise.all([
      fetch(`${url}/rest/v1/com_logistica_negocio?log_negocio=eq.${encodeURIComponent(negNorm)}&select=*`, {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Accept-Profile": "comun_comercio",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      }),
      fetch(
        `${url}/rest/v1/com_zona_cobertura?zon_negocio=eq.${encodeURIComponent(
          negNorm
        )}&zon_eliminado_en=is.null&select=*&order=zon_prioridad.asc`,
        {
          headers: {
            apikey: key,
            Authorization: `Bearer ${key}`,
            "Accept-Profile": "comun_comercio",
          },
          cache: "no-store",
          signal: AbortSignal.timeout(4500),
        }
      ),
    ]);

    if (resLog.ok) {
      const filasLog = (await resLog.json()) as any[];
      const fila = filasLog?.[0];
      if (fila) {
        const filasZon = resZon.ok ? ((await resZon.json()) as any[]) : [];
        const zonasMapeadas: ZonaCoberturaLogistica[] =
          Array.isArray(filasZon) && filasZon.length > 0
            ? filasZon
                .map((z): ZonaCoberturaLogistica | null => {
                  const pol: [number, number][] = Array.isArray(z.zon_poligono)
                    ? z.zon_poligono
                        .filter((p: any) => Array.isArray(p) && p.length >= 2)
                        .map((p: any) => [Number(p[0]), Number(p[1])] as [number, number])
                    : [];
                  if (pol.length < 3) return null;
                  const det = z.zon_detalle_zona || {};
                  const modo = String(z.zon_modo_cobro || "POR_KM").toUpperCase();
                  return {
                    id: String(z.zon_id || z.zon_codigo),
                    codigo: String(z.zon_codigo),
                    nombre: String(z.zon_nombre),
                    provincia: String(z.zon_provincia || "Pichincha"),
                    modoCobro:
                      modo === "GRATIS" || modo === "TARIFA_FIJA" || modo === "POR_KM"
                        ? modo
                        : "POR_KM",
                    tarifaFija: Number(z.zon_tarifa_fija ?? 0),
                    prioridad: Number(z.zon_prioridad ?? 10),
                    activo: z.zon_activo !== false,
                    color: String(det.color || "#0284C7"),
                    sectoresReferencia: Array.isArray(det.sectores_referencia)
                      ? det.sectores_referencia.map((s: unknown) => String(s))
                      : [],
                    poligono: pol,
                  };
                })
                .filter((x): x is ZonaCoberturaLogistica => x !== null)
            : base.zonas;

        return {
          negocio: negNorm,
          activo: fila.log_activo !== false,
          origenNombre: String(fila.log_origen_nombre || base.origenNombre),
          origenDireccion: String(fila.log_origen_direccion ?? base.origenDireccion),
          origenMapaUrl: String(fila.log_origen_mapa_url ?? base.origenMapaUrl),
          origenLat: Number(fila.log_origen_lat ?? base.origenLat),
          origenLng: Number(fila.log_origen_lng ?? base.origenLng),
          zonaGratisNombre: String(fila.log_zona_gratis_nombre || base.zonaGratisNombre),
          etiquetaEnvioGratis: String(fila.log_etiqueta_envio_gratis || base.etiquetaEnvioGratis),
          tarifaPorKm: Number(fila.log_tarifa_por_km ?? base.tarifaPorKm),
          subsidioBaseUsd: Number(fila.log_subsidio_base_usd ?? base.subsidioBaseUsd),
          recargoMinimoExtra: Number(fila.log_recargo_minimo_extra ?? base.recargoMinimoExtra),
          tarifaBaseNoIncluido: Number(
            fila.log_tarifa_base_no_incluido ?? base.tarifaBaseNoIncluido
          ),
          recargoHoraExacta: Number(fila.log_recargo_hora_exacta ?? base.recargoHoraExacta),
          radioMaximoKm: Number(fila.log_radio_maximo_km ?? base.radioMaximoKm),
          factorVialRespaldo: Number(fila.log_factor_vial_respaldo ?? base.factorVialRespaldo),
          permitirRetiroLocal: fila.log_permitir_retiro_local !== false,
          zonas: zonasMapeadas.length > 0 ? zonasMapeadas : base.zonas,
          actualizadoEn: fila.log_actualizado_en ?? null,
        };
      }
    }
  } catch {
    // Continuar con respaldo en cfg_negocio
  }

  // 2. Respaldo / espejo en comun_configuracion.cfg_negocio (disponible incluso antes de correr migración 20261112000003)
  try {
    const resCfg = await fetch(
      `${url}/rest/v1/cfg_negocio?cfg_negocio=eq.${encodeURIComponent(
        negNorm
      )}&select=cfg_detalle_configuracion,cfg_actualizado_en`,
      {
        headers: {
          apikey: key,
          Authorization: `Bearer ${key}`,
          "Accept-Profile": "comun_configuracion",
        },
        cache: "no-store",
        signal: AbortSignal.timeout(4500),
      }
    );

    if (resCfg.ok) {
      const filasCfg = (await resCfg.json()) as any[];
      const det = filasCfg?.[0]?.cfg_detalle_configuracion;
      if (det && typeof det === "object" && det.logistica && typeof det.logistica === "object") {
        return normalizarConfiguracionDesdeJson(negNorm, {
          ...(det.logistica as Record<string, unknown>),
          actualizadoEn: filasCfg[0]?.cfg_actualizado_en ?? null,
        });
      }
    }
  } catch {
    // Devolver configuración semilla en memoria
  }

  return base;
}

/**
 * Guarda la política logística y las zonas de cobertura del negocio.
 * Utiliza primero la RPC transaccional `com_fn_guardar_logistica_negocio` y mantiene espejo en `cfg_negocio`.
 */
export async function guardarConfiguracionLogisticaAction(
  negocio: string,
  datos: ConfiguracionLogisticaNegocio
): Promise<{ ok: true } | { ok: false; error: string }> {
  const negNorm = (negocio || datos.negocio || "tinkay").trim().toLowerCase();
  const validacion = esquemaConfigLogistica.safeParse({ ...datos, negocio: negNorm });
  if (!validacion.success) {
    return {
      ok: false,
      error: validacion.error.issues[0]?.message ?? "Datos de configuración logística inválidos",
    };
  }

  const payload = validacion.data;
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();

  // 1. Intentar RPC transaccional en comun_comercio
  const esquemaComercio = supabase.schema("comun_comercio") as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>
    ): Promise<{ error: { message: string; code?: string } | null }>;
  };

  const { error: errRpc } = await esquemaComercio.rpc("com_fn_guardar_logistica_negocio", {
    p_negocio: negNorm,
    p_payload: payload,
  });

  if (!errRpc) {
    revalidatePath("/panel/logistica");
    revalidatePath("/panel/configuracion");
    revalidatePath("/panel/catalogo-productos");
    revalidatePath("/");
    return { ok: true };
  }

  // Si el error es de autorización explícita, propagarlo sin ocultar
  if (/no autorizado/i.test(errRpc.message)) {
    return { ok: false, error: errRpc.message };
  }

  // 2. Respaldo directo en comun_configuracion.cfg_negocio si la migración SQL 20261112000003 aún no fue ejecutada
  const { data: actual, error: errLectura } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .select("cfg_detalle_configuracion")
    .eq("cfg_negocio", negNorm)
    .maybeSingle();

  if (errLectura) {
    return { ok: false, error: errLectura.message };
  }

  const nuevoDetalle = {
    ...((actual?.cfg_detalle_configuracion as Record<string, unknown> | null) ?? {}),
    logistica: {
      ...payload,
      actualizadoEn: new Date().toISOString(),
    },
  };

  const { error: errUpdate } = await supabase
    .schema("comun_configuracion")
    .from("cfg_negocio")
    .update({
      cfg_detalle_configuracion: nuevoDetalle,
    })
    .eq("cfg_negocio", negNorm);

  if (errUpdate) {
    return { ok: false, error: errUpdate.message };
  }

  revalidatePath("/panel/logistica");
  revalidatePath("/panel/configuracion");
  revalidatePath("/panel/catalogo-productos");
  revalidatePath("/");
  return { ok: true };
}

export async function resolverEnlaceMapaAction(enlace: string): Promise<{
  ok: boolean;
  lat?: number;
  lng?: number;
  urlExpandida?: string;
  error?: string;
}> {
  const limpio = (enlace || "").trim();
  if (!limpio) {
    return { ok: false, error: "Ingresa un enlace de Google Maps, Apple Maps o Waze" };
  }

  const { coordenadas, urlExpandida } = await resolverEnlaceMapaACoordenadas(limpio);
  if (!coordenadas) {
    return {
      ok: false,
      error:
        "No se pudieron extraer coordenadas exactas del enlace. Prueba compartiendo el pin desde Google Maps/Waze o selecciona el punto en el mapa.",
    };
  }

  return {
    ok: true,
    lat: coordenadas.lat,
    lng: coordenadas.lng,
    urlExpandida,
  };
}

export async function buscarDireccionesMapaAction(
  consulta: string
): Promise<SugerenciaDireccionMapa[]> {
  return await buscarDireccionesPichincha(consulta);
}

export interface EntradaCotizacionServidor {
  negocio: string;
  enlaceOTexto?: string;
  lat?: number;
  lng?: number;
  deliveryIncluidoProducto?: boolean;
  recargoLogisticoProducto?: number;
  retiroEnLocal?: boolean;
}

/**
 * Acción / servicio integral: resuelve enlace o dirección, calcula ruta vial real OSRM
 * y retorna la cotización exacta según las zonas y tarifas activas del negocio.
 */
export async function cotizarEnvioDesdeEntradaAction(
  entrada: EntradaCotizacionServidor
): Promise<
  | {
      ok: true;
      cotizacion: ResultadoCotizacionEnvio;
      direccionDetectada?: string;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const config = await obtenerConfiguracionLogisticaAction(entrada.negocio);

  if (entrada.retiroEnLocal) {
    const cot = cotizarEnvioDomicilio({
      config,
      destino: { lat: config.origenLat, lng: config.origenLng },
      retiroEnLocal: true,
    });
    return { ok: true, cotizacion: cot, direccionDetectada: config.origenNombre };
  }

  let lat = entrada.lat;
  let lng = entrada.lng;
  let direccionDetectada: string | undefined;

  if (!esCoordenadaValida(Number(lat), Number(lng))) {
    const texto = (entrada.enlaceOTexto || "").trim();
    if (!texto) {
      return {
        ok: false,
        error: "Indica un enlace de ubicación (Google Maps, Apple Maps o Waze) o selecciona el punto en el mapa.",
      };
    }

    const resuelto = await resolverEnlaceMapaACoordenadas(texto);
    if (resuelto.coordenadas) {
      lat = resuelto.coordenadas.lat;
      lng = resuelto.coordenadas.lng;
    } else {
      const sugerencias = await buscarDireccionesPichincha(texto);
      const primera = sugerencias[0];
      if (primera) {
        lat = primera.lat;
        lng = primera.lng;
        direccionDetectada = primera.direccionCompleta;
      }
    }
  }

  if (!esCoordenadaValida(Number(lat), Number(lng))) {
    return {
      ok: false,
      error:
        "No pudimos ubicar esa dirección en el mapa. Pega el link compartido desde Google Maps / Waze o mueve el marcador en el mapa.",
    };
  }

  const destino = { lat: Number(lat), lng: Number(lng) };
  const ruta = await calcularRutaVialOsrm(
    { lat: config.origenLat, lng: config.origenLng },
    destino,
    config.factorVialRespaldo
  );

  const cotizacion = cotizarEnvioDomicilio({
    config,
    destino,
    distanciaVialKm: ruta.distanciaKm,
    fuenteDistancia: ruta.fuente,
    rutaGeometria: ruta.geometria,
    deliveryIncluidoProducto: entrada.deliveryIncluidoProducto ?? true,
    recargoLogisticoProducto: entrada.recargoLogisticoProducto ?? 0,
    retiroEnLocal: false,
  });

  return {
    ok: true,
    cotizacion,
    direccionDetectada,
  };
}

