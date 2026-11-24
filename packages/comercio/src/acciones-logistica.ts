"use server";

import crypto from "node:crypto";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import {
  firmarOrdenRespaldoServidor,
  generarTokenEdicionTarjetaServidor,
  verificarOrdenRespaldoServidor,
} from "./token-orden-firmada";
import { obtenerConfiguracionTiendaCheckoutAction } from "./acciones-tienda-checkout";
import type { ComprobanteTransferenciaSubido } from "./configuracion-tienda-checkout";
import type { SeleccionPersonalizacionFloral } from "./utils/personalizacionFloral";
import {
  buscarDireccionesPichincha,
  calcularRutaVialOsrm,
  cotizarEnvioDomicilio,
  crearConfiguracionLogisticaPorDefecto,
  esCoordenadaValida,
  geocodificarInversoCoordenadas,
  resolverEnlaceMapaACoordenadas,
  type ConfiguracionLogisticaNegocio,
  type DetalleDireccionGeoespacial,
  type ModoCobroZona,
  type ResultadoCotizacionEnvio,
  type SugerenciaDireccionMapa,
  type ZonaCoberturaLogistica,
} from "./logistica";
import {
  ESTADOS_PEDIDO_DEFECTO,
  esEstadoVisibleEnTaller,
  inferirClasificacionPedido,
  normalizarEstadosPedidosConfig,
  type ClasificacionOperativaPedido,
  type DisenoVisualTarjeta,
  type EstadoPedidoConfig,
} from "./operaciones-taller";

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
  mostrarKilometrosCliente: z.boolean().default(true),
  envioGratisSoloRegistrados: z.boolean().default(true),
  tarifaBaseNoRegistradoUsd: z.number().min(0).max(100).default(1.0),
  tarifaPorKmNoRegistradoUsd: z.number().min(0).max(50).default(0.5),
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
    mostrarKilometrosCliente: raw.mostrarKilometrosCliente !== false,
    envioGratisSoloRegistrados:
      typeof raw.envioGratisSoloRegistrados === "boolean"
        ? raw.envioGratisSoloRegistrados
        : base.envioGratisSoloRegistrados ?? true,
    tarifaBaseNoRegistradoUsd: Number.isFinite(Number(raw.tarifaBaseNoRegistradoUsd))
      ? Number(raw.tarifaBaseNoRegistradoUsd)
      : base.tarifaBaseNoRegistradoUsd ?? 1.0,
    tarifaPorKmNoRegistradoUsd: Number.isFinite(Number(raw.tarifaPorKmNoRegistradoUsd))
      ? Number(raw.tarifaPorKmNoRegistradoUsd)
      : base.tarifaPorKmNoRegistradoUsd ?? base.tarifaPorKm ?? 0.5,
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
          mostrarKilometrosCliente:
            fila.log_detalle_logistica &&
            typeof fila.log_detalle_logistica === "object" &&
            typeof fila.log_detalle_logistica.mostrarKilometrosCliente === "boolean"
              ? fila.log_detalle_logistica.mostrarKilometrosCliente
              : true,
          envioGratisSoloRegistrados:
            fila.log_detalle_logistica &&
            typeof fila.log_detalle_logistica === "object" &&
            typeof fila.log_detalle_logistica.envioGratisSoloRegistrados === "boolean"
              ? fila.log_detalle_logistica.envioGratisSoloRegistrados
              : base.envioGratisSoloRegistrados ?? true,
          tarifaBaseNoRegistradoUsd:
            fila.log_detalle_logistica &&
            typeof fila.log_detalle_logistica === "object" &&
            Number.isFinite(Number(fila.log_detalle_logistica.tarifaBaseNoRegistradoUsd))
              ? Number(fila.log_detalle_logistica.tarifaBaseNoRegistradoUsd)
              : base.tarifaBaseNoRegistradoUsd ?? 1.0,
          tarifaPorKmNoRegistradoUsd:
            fila.log_detalle_logistica &&
            typeof fila.log_detalle_logistica === "object" &&
            Number.isFinite(Number(fila.log_detalle_logistica.tarifaPorKmNoRegistradoUsd))
              ? Number(fila.log_detalle_logistica.tarifaPorKmNoRegistradoUsd)
              : base.tarifaPorKmNoRegistradoUsd ?? Number(fila.log_tarifa_por_km ?? base.tarifaPorKm),
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
  /** Si se omite, se resuelve automáticamente contra la sesión autenticada y membresía activa en el negocio */
  clienteRegistrado?: boolean;
}

async function resolverEsUsuarioRegistradoNegocioServidor(negNorm: string): Promise<boolean> {
  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) return false;

    const dbVerif: any = crearClienteAdmin() ?? supabase;
    const aliasNeg =
      negNorm === "tinkay"
        ? ["TNK", "TINKAY", "tinkay", "tnk"]
        : negNorm === "margaritas"
        ? ["MRG", "MARGARITAS", "margaritas", "mrg"]
        : negNorm === "fastfix"
        ? ["FFH", "FASTFIX", "fastfix", "ffh"]
        : ["TRQ", "TRANQ", "TRANQI", "LEGAL", "tranqi"];

    const [{ data: mem }, { data: usu }] = await Promise.all([
      dbVerif
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_id")
        .eq("mem_usuario_id", user.id)
        .in("mem_negocio", aliasNeg)
        .eq("mem_estado", "ACTIVO")
        .limit(1)
        .maybeSingle(),
      dbVerif
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_superadmin_plataforma")
        .eq("usu_id", user.id)
        .maybeSingle(),
    ]);
    return Boolean(mem?.mem_id || usu?.usu_superadmin_plataforma);
  } catch {
    return false;
  }
}

/**
 * Acción / servicio integral: resuelve enlace o dirección, calcula ruta vial real OSRM
 * y retorna la cotización exacta según las zonas y tarifas activas del negocio
 * (diferenciando entre clientes registrados con cobertura gratuita y visitantes sin registro).
 */
export async function cotizarEnvioDesdeEntradaAction(
  entrada: EntradaCotizacionServidor
): Promise<
  | {
      ok: true;
      cotizacion: ResultadoCotizacionEnvio;
      direccionDetectada?: string;
      clienteRegistradoEfectivo: boolean;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const negNorm = (entrada.negocio || "tinkay").trim().toLowerCase();
  const [config, registradoResuelto] = await Promise.all([
    obtenerConfiguracionLogisticaAction(negNorm),
    typeof entrada.clienteRegistrado === "boolean"
      ? Promise.resolve(entrada.clienteRegistrado)
      : resolverEsUsuarioRegistradoNegocioServidor(negNorm),
  ]);

  if (entrada.retiroEnLocal) {
    const cot = cotizarEnvioDomicilio({
      config,
      destino: { lat: config.origenLat, lng: config.origenLng },
      retiroEnLocal: true,
      clienteRegistrado: registradoResuelto,
    });
    return {
      ok: true,
      cotizacion: cot,
      direccionDetectada: config.origenNombre,
      clienteRegistradoEfectivo: registradoResuelto,
    };
  }

  let lat = entrada.lat;
  let lng = entrada.lng;
  let direccionDetectada: string | undefined;
  let nombreLugarPista: string | undefined;

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
      nombreLugarPista = resuelto.nombreLugar;
    } else {
      const sugerencias = await buscarDireccionesPichincha(texto);
      const primera = sugerencias[0];
      if (primera) {
        lat = primera.lat;
        lng = primera.lng;
        direccionDetectada = primera.direccionCompleta;
        nombreLugarPista = primera.nombreCorto;
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
  const [ruta, detalleGeo] = await Promise.all([
    calcularRutaVialOsrm(
      { lat: config.origenLat, lng: config.origenLng },
      destino,
      config.factorVialRespaldo
    ),
    geocodificarInversoCoordenadas(destino, nombreLugarPista),
  ]);

  const direccionFinal = detalleGeo?.resumenDireccion || direccionDetectada;

  const cotizacion = cotizarEnvioDomicilio({
    config,
    destino,
    distanciaVialKm: ruta.distanciaKm,
    fuenteDistancia: ruta.fuente,
    rutaGeometria: ruta.geometria,
    detalleDireccion: detalleGeo,
    deliveryIncluidoProducto: entrada.deliveryIncluidoProducto ?? true,
    recargoLogisticoProducto: entrada.recargoLogisticoProducto ?? 0,
    retiroEnLocal: false,
    clienteRegistrado: registradoResuelto,
  });

  return {
    ok: true,
    cotizacion,
    direccionDetectada: direccionFinal,
    clienteRegistradoEfectivo: registradoResuelto,
  };
}

// ============================================================================
// PERSISTENCIA Y GESTIÓN DE PEDIDOS DE TIENDA CON AUDITORÍA LOGÍSTICA INTERNA
// ============================================================================

export interface DestinoEntregaPedidoInput {
  retiroEnLocal?: boolean;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  direccion: string;
  referencia?: string;
  ciudad?: string;
  fechaEntrega: string;
  franjaHoraria: string;
  horaExacta?: string;
  enlaceMapa?: string;
  lat?: number;
  lng?: number;
  zonaDetectadaNombre?: string;
  reglaLogisticaAplicada?: string;
  distanciaVialKm?: number;
  costoEnvioCalculado?: number;
  etiquetaCotizacion?: string;
  formulaCalculoInterno?: string;
  colores?: string;
  extras?: string;
  detalleDireccionGeo?: DetalleDireccionGeoespacial | null;
}

export interface ItemPedidoTiendaInput {
  productoId: string;
  productoNombre: string;
  varianteSku: string;
  varianteNombre: string;
  cantidad: number;
  pvpUnitario: number;
  tarifaIva: number;
  imagen?: string;
  deliveryIncluidoProducto?: boolean;
  recargoLogisticoUsd?: number;
  dedicatoria?: {
    para: string;
    de: string;
    mensaje: string;
  };
  personalizacionFloral?: SeleccionPersonalizacionFloral;
  entregaIndividual?: DestinoEntregaPedidoInput;
}

export interface EntradaPedidoTienda {
  negocio: string;
  metodoPago: "payphone" | "transferencia" | string;
  comprador: {
    nombreCompleto: string;
    identificacion: string;
    correo: string;
    telefono: string;
  };
  modalidadEntrega: "unificada" | "individual";
  entregaUnificada?: DestinoEntregaPedidoInput;
  items: ItemPedidoTiendaInput[];
  subtotalBaseImponible: number;
  totalIva: number;
  totalFlete: number;
  totalRecargoHorarioExacto: number;
  totalPagar: number;
  regaloPrimeraCompra?: {
    sku: string;
    nombre: string;
    valorReferencia: number;
    imagenUrl?: string;
    productoId?: string;
  } | null;
  comprobanteTransferencia?: (ComprobanteTransferenciaSubido & {
    subidoPorNombre?: string | null;
  }) | null;
  respuestaPlux?: {
    pagoId?: string | null;
    identificador?: string | null;
    autorizacion?: string | null;
    marcaTarjeta?: string | null;
    ultimosDigitos?: string | null;
    montoUsd?: number | null;
    modalidadCobro?: string | null;
    estado?: string | null;
    confirmadoEn?: string | null;
    respuestaRaw?: unknown;
  } | null;
  creadoPor?: {
    usuarioId?: string | null;
    nombre: string;
    correo?: string | null;
    origen?: string | null;
    creadoEn?: string | null;
  } | null;
  conversacionWebId?: string;
  atribucionPublicitaria?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    fbclid?: string;
    fbc?: string;
    fbp?: string;
    intencionDetectada?: string;
    eventSourceUrl?: string;
  } | null;
}

export interface PedidoTiendaRegistrado {
  id: string;
  secuencial: number;
  codigoOrden: string;
  tipoOrigen?: "PEDIDO_TIENDA" | "PROFORMA_EVENTO" | string;
  /** Clasificación operativa canónica: Domicilio | Local | Exequiales | Eventos | Mobiliario */
  clasificacionPedido?: ClasificacionOperativaPedido;
  exequiales?: {
    salaServicio?: string | null;
    quienSolicita?: string | null;
    nombreFallecido?: string | null;
    horaServicio?: string | null;
    numeroInforme?: string | null;
    estadoEvidencia?: string | null;
  };
  evidenciaEntrega?: {
    confirmada: boolean;
    entregaId?: string | null;
    codigoOt?: string | null;
    fotoUrl?: string | null;
    mapaUrl?: string | null;
    capturadoEn?: string | null;
    entregadorNombre?: string | null;
    latitud?: number | null;
    longitud?: number | null;
    direccionGps?: string | null;
    salaServicio?: string | null;
    observaciones?: string | null;
    numeroInforme?: string | null;
  } | null;
  grupoProformaId?: string;
  versionNumero?: number;
  esOriginal?: boolean;
  etiquetaVersion?: string;
  notaAsesor?: string;
  tokenAprobacion?: string;
  vigenciaDias?: number;
  descuento?: number;
  montoAbonadoUsd?: number;
  saldoPendienteUsd?: number;
  autorizaWhatsapp?: boolean;
  evento?: {
    tipoEvento?: string;
    fechaEvento?: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  negocio: string;
  estado: string;
  metodoPago: string;
  compradorNombre: string;
  compradorIdentificacion: string;
  compradorCorreo: string;
  compradorTelefono: string;
  subtotal: number;
  iva: number;
  costoEnvio: number;
  recargoHorarioExacto: number;
  total: number;
  creadoEn: string;
  logistica: {
    modalidadEntrega: string;
    retiroEnLocal: boolean;
    destinatarioNombre: string;
    destinatarioTelefono: string;
    direccion: string;
    referencia: string;
    fechaEntrega: string;
    franjaHoraria: string;
    horaExacta?: string;
    enlaceMapa?: string;
    lat?: number;
    lng?: number;
    zonaDetectada?: string;
    reglaAplicada?: string;
    distanciaVialKm?: number;
    formulaCalculoInterno: string;
    detalleDireccionGeo?: DetalleDireccionGeoespacial | null;
    parametrosTarifarios?: {
      tarifaPorKm: number;
      subsidioBaseUsd: number;
      recargoMinimoExtra: number;
      zonaGratisNombre: string;
    };
  };
  items: Array<{
    descripcion: string;
    varianteNombre: string;
    cantidad: number;
    precioUnitario: number;
    impuesto?: string;
    totalLinea: number;
    dedicatoria?: { para: string; de: string; mensaje: string };
    personalizacionFloral?: SeleccionPersonalizacionFloral;
    entregaIndividual?: Record<string, unknown>;
  }>;
  regaloPrimeraCompra?: {
    sku: string;
    nombre: string;
    valorReferencia: number;
    imagenUrl?: string;
    productoId?: string;
  } | null;
  comprobanteTransferencia?: (ComprobanteTransferenciaSubido & {
    subidoPorNombre?: string | null;
  }) | null;
  respuestaPlux?: {
    pagoId?: string | null;
    identificador?: string | null;
    autorizacion?: string | null;
    marcaTarjeta?: string | null;
    ultimosDigitos?: string | null;
    montoUsd?: number | null;
    modalidadCobro?: string | null;
    estado?: string | null;
    confirmadoEn?: string | null;
    respuestaRaw?: unknown;
  } | null;
  creadoPor?: {
    usuarioId?: string | null;
    nombre: string;
    correo?: string | null;
    origen?: string | null;
    creadoEn?: string | null;
  } | null;
  conversacionWebId?: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  salaServicio?: string | null;
  tarjeta?: {
    token: string;
    tokenEdicion?: string;
    confidencial?: boolean;
    diseno?: DisenoVisualTarjeta;
    tipo: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
    mensaje: string;
    para: string;
    de: string;
    musicaUrl?: string | null;
    musicaTitulo?: string | null;
    lyrics?: Array<{ tiempo?: number; texto: string }>;
    metadata?: {
      origen?: string;
      creado_por?: string;
      token_edicion?: string;
      confidencial_solo_qr?: boolean;
      diseno?: DisenoVisualTarjeta;
      historial_cambios?: Array<{
        autor?: string;
        rol?: string;
        fecha?: string;
        dedicatoria_anterior?: string;
        dedicatoria_nueva?: string;
      }>;
      vistas_cliente?: number;
      ultima_vista_en?: string;
      editado_por_cliente?: boolean;
      ultima_edicion_cliente_en?: string;
      impresiones?: number;
      ultima_impresion_en?: string;
      ultimo_impreso_por?: string;
    };
  };
  /** Auditoría de borrado lógico (solo poblado para Administrador / Superadmin) */
  eliminadoEn?: string | null;
  eliminadoPorNombre?: string | null;
  eliminadoMotivo?: string | null;
}

const esquemaPedidoTienda = z.object({
  negocio: z.string().min(1),
  metodoPago: z.string().min(2),
  comprador: z.object({
    nombreCompleto: z.string().trim().optional().default(""),
    identificacion: z.string().trim().optional().default(""),
    correo: z
      .string()
      .trim()
      .optional()
      .default("")
      .refine((v) => !v || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v), "Correo electrónico inválido"),
    telefono: z.string().trim().optional().default(""),
  }),
  modalidadEntrega: z.enum(["unificada", "individual"]),
  subtotalBaseImponible: z.number().min(0),
  totalIva: z.number().min(0),
  totalFlete: z.number().min(0),
  totalRecargoHorarioExacto: z.number().min(0),
  totalPagar: z.number().min(0),
  items: z.array(z.any()).min(1, "El pedido debe incluir al menos un producto"),
  regaloPrimeraCompra: z
    .object({
      sku: z.string().min(1),
      nombre: z.string().min(1),
      valorReferencia: z.number().min(0),
      imagenUrl: z.string().optional(),
      productoId: z.string().optional(),
    })
    .nullable()
    .optional(),
  comprobanteTransferencia: z
    .object({
      url: z.string().min(4),
      nombreArchivo: z.string().min(1),
      mimeType: z.string().min(3),
      subidoEn: z.string().optional(),
      referenciaOpcional: z.string().optional(),
    })
    .nullable()
    .optional(),
  atribucionPublicitaria: z.record(z.string(), z.any()).nullable().optional(),
});

function enriquecerDestinoConAuditoriaInterna(
  destino: DestinoEntregaPedidoInput | undefined,
  config: ConfiguracionLogisticaNegocio,
  deliveryIncluidoProducto: boolean,
  recargoLogisticoProducto: number,
  clienteRegistrado = true
) {
  if (!destino) {
    return {
      retiro_en_local: false,
      destinatario_nombre: "",
      destinatario_telefono: "",
      direccion: "",
      referencia: "",
      fecha_entrega: "",
      franja_horaria: "manana",
      formula_calculo_interno: "Sin datos de entrega especificados.",
    };
  }

  let formulaInterna = (destino.formulaCalculoInterno || "").trim();
  let reglaAplicada = destino.reglaLogisticaAplicada || "";
  let zonaDetectada = destino.zonaDetectadaNombre || "";
  let distanciaKm = destino.distanciaVialKm;
  let enlaceMapa = destino.enlaceMapa || "";

  if (destino.retiroEnLocal) {
    const cot = cotizarEnvioDomicilio({
      config,
      destino: { lat: config.origenLat, lng: config.origenLng },
      retiroEnLocal: true,
      clienteRegistrado,
    });
    formulaInterna = cot.formulaDetalle;
    reglaAplicada = cot.reglaAplicada;
    enlaceMapa = enlaceMapa || config.origenMapaUrl;
    distanciaKm = 0;
  } else if (esCoordenadaValida(Number(destino.lat), Number(destino.lng))) {
    const cot = cotizarEnvioDomicilio({
      config,
      destino: { lat: Number(destino.lat), lng: Number(destino.lng) },
      distanciaVialKm: destino.distanciaVialKm,
      deliveryIncluidoProducto,
      recargoLogisticoProducto,
      retiroEnLocal: false,
      clienteRegistrado,
    });
    formulaInterna = cot.formulaDetalle;
    reglaAplicada = cot.reglaAplicada;
    zonaDetectada = zonaDetectada || cot.zonaDetectada?.nombre || "";
    distanciaKm = cot.distanciaVialKm;
    enlaceMapa = enlaceMapa || cot.urlGoogleMapsDestino;
  } else if (!formulaInterna) {
    formulaInterna = `Dirección manual (${destino.ciudad || config.zonaGratisNombre}) · Envío aplicado: $${Number(
      destino.costoEnvioCalculado ?? 0
    ).toFixed(2)}.`;
  }

  return {
    retiro_en_local: Boolean(destino.retiroEnLocal),
    destinatario_nombre: destino.destinatarioNombre,
    destinatario_telefono: destino.destinatarioTelefono,
    direccion: destino.direccion,
    referencia: destino.referencia || "",
    ciudad: destino.ciudad || "",
    fecha_entrega: destino.fechaEntrega,
    franja_horaria: destino.franjaHoraria,
    hora_exacta: destino.horaExacta || null,
    enlace_mapa: enlaceMapa || null,
    lat: typeof destino.lat === "number" ? destino.lat : null,
    lng: typeof destino.lng === "number" ? destino.lng : null,
    zona_detectada: zonaDetectada || null,
    regla_aplicada: reglaAplicada || null,
    distancia_vial_km: typeof distanciaKm === "number" ? distanciaKm : null,
    costo_envio_usd: Number(destino.costoEnvioCalculado ?? 0),
    formula_calculo_interno: formulaInterna,
    detalle_direccion_geo: destino.detalleDireccionGeo ?? null,
  };
}

/**
 * Registra de forma persistente el pedido de la tienda en `comun_comercio`
 * incluyendo el desglose interno completo de logística (kilómetros, fórmula aplicada,
 * tarifa $/km, subsidio base absorbido y enlace GPS) exclusivo para el taller/tienda.
 */
export async function registrarPedidoTiendaAction(
  entrada: EntradaPedidoTienda
): Promise<
  | { ok: true; id: string; codigoOrden: string; tokenAprobacion?: string; respaldoFirmado?: string }
  | { ok: false; error: string }
> {
  const validacion = esquemaPedidoTienda.safeParse(entrada);
  if (!validacion.success) {
    return {
      ok: false,
      error: validacion.error.issues[0]?.message ?? "Datos del pedido incompletos",
    };
  }

  const negNorm = entrada.negocio.trim().toLowerCase();
  const [config, esUsuarioRegistradoPreliminar] = await Promise.all([
    obtenerConfiguracionLogisticaAction(negNorm),
    resolverEsUsuarioRegistradoNegocioServidor(negNorm),
  ]);

  const algunConDeliveryIncluido = entrada.items.some(
    (it) => it.deliveryIncluidoProducto !== false
  );
  const recargoProductosTotal = entrada.items.reduce(
    (acc, it) => acc + (Number(it.recargoLogisticoUsd) || 0) * (Number(it.cantidad) || 1),
    0
  );

  const itemsEnriquecidos = entrada.items.map((it) => {
    const totalLinea = Math.round(it.pvpUnitario * it.cantidad * 100) / 100;
    const entregaInd =
      entrada.modalidadEntrega === "individual" && it.entregaIndividual
        ? enriquecerDestinoConAuditoriaInterna(
            it.entregaIndividual,
            config,
            it.deliveryIncluidoProducto !== false,
            (it.recargoLogisticoUsd || 0) * it.cantidad,
            esUsuarioRegistradoPreliminar
          )
        : null;

    return {
      producto_id: it.productoId,
      descripcion:
        it.varianteNombre && it.varianteNombre.trim() !== it.productoNombre.trim()
          ? `${it.productoNombre} (${it.varianteNombre})`
          : it.productoNombre,
      producto_nombre: it.productoNombre,
      variante_sku: it.varianteSku,
      variante_nombre: it.varianteNombre,
      cantidad: it.cantidad,
      precio_unitario: it.pvpUnitario,
      impuesto: it.tarifaIva > 0 ? `IVA_${it.tarifaIva}` : "IVA_0",
      total_linea: totalLinea,
      dedicatoria: it.dedicatoria ?? null,
      personalizacion_floral: it.personalizacionFloral ?? null,
      entrega_individual: entregaInd,
    };
  });

  let entregaUnificadaConGeo = entrada.entregaUnificada;
  if (
    entrada.modalidadEntrega === "unificada" &&
    entregaUnificadaConGeo &&
    !entregaUnificadaConGeo.retiroEnLocal &&
    !entregaUnificadaConGeo.detalleDireccionGeo &&
    esCoordenadaValida(Number(entregaUnificadaConGeo.lat), Number(entregaUnificadaConGeo.lng))
  ) {
    const geoResuelta = await geocodificarInversoCoordenadas({
      lat: Number(entregaUnificadaConGeo.lat),
      lng: Number(entregaUnificadaConGeo.lng),
    });
    if (geoResuelta) {
      entregaUnificadaConGeo = {
        ...entregaUnificadaConGeo,
        detalleDireccionGeo: geoResuelta,
        direccion: entregaUnificadaConGeo.direccion || geoResuelta.resumenDireccion,
      };
    }
  }

  const logisticaPrincipal =
    entrada.modalidadEntrega === "unificada"
      ? enriquecerDestinoConAuditoriaInterna(
          entregaUnificadaConGeo,
          config,
          algunConDeliveryIncluido,
          recargoProductosTotal,
          esUsuarioRegistradoPreliminar
        )
      : {
          retiro_en_local: false,
          destinatario_nombre: "Multidestino (ver detalle por arreglo)",
          destinatario_telefono: entrada.comprador.telefono,
          direccion: `${itemsEnriquecidos.filter((i) => i.entrega_individual).length} destinos individuales`,
          referencia: "",
          fecha_entrega: itemsEnriquecidos[0]?.entrega_individual?.fecha_entrega || "",
          franja_horaria: "multidestino",
          enlace_mapa: itemsEnriquecidos[0]?.entrega_individual?.enlace_mapa || null,
          lat: itemsEnriquecidos[0]?.entrega_individual?.lat ?? null,
          lng: itemsEnriquecidos[0]?.entrega_individual?.lng ?? null,
          zona_detectada: "Multidestino",
          regla_aplicada: "MULTIDESTINO",
          distancia_vial_km: itemsEnriquecidos.reduce(
            (s, i) => s + (Number(i.entrega_individual?.distancia_vial_km) || 0),
            0
          ),
          costo_envio_usd: entrada.totalFlete,
          formula_calculo_interno: itemsEnriquecidos
            .filter((i) => i.entrega_individual)
            .map(
              (i, idx) =>
                `Destino #${idx + 1} (${i.descripcion}): ${
                  i.entrega_individual?.formula_calculo_interno || ""
                }`
            )
            .join(" | "),
        };

  const metodoPagoNorm = entrada.metodoPago.trim().toLowerCase();
  const estadoInicial =
    metodoPagoNorm === "transferencia"
      ? "NUEVO_POR_CONFIRMAR"
      : metodoPagoNorm === "plux"
        ? "PENDIENTE_PAGO"
        : "NUEVO_CONFIRMADO";

  const totalCentavos = Math.round(entrada.totalPagar * 100);
  const ivaCentavos = Math.round(entrada.totalIva * 100);
  const baseTotalCentavos = Math.max(0, totalCentavos - ivaCentavos);
  const baseItemsGravadosCentavos = entrada.items.reduce((acc, it) => {
    if ((Number(it.tarifaIva) || 0) > 0) {
      return acc + Math.round(Number(it.pvpUnitario) * Number(it.cantidad) * 100);
    }
    return acc;
  }, 0);
  const baseIvaGravadaCentavos =
    ivaCentavos > 0
      ? Math.min(
          baseTotalCentavos,
          baseItemsGravadosCentavos > 0
            ? baseItemsGravadosCentavos
            : Math.round((ivaCentavos * 100) / 15)
        )
      : 0;
  const baseIva0Centavos = Math.max(0, baseTotalCentavos - baseIvaGravadaCentavos);

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const configCheckout = await obtenerConfiguracionTiendaCheckoutAction(negNorm);
  const umbralSinDatos = Math.max(0, Number(configCheckout.montoMaximoPagoSinDatosUsd ?? 0));
  const esMenorAlUmbral = umbralSinDatos <= 0 || Number(entrada.totalPagar) < umbralSinDatos;
  const esRetiroEnTienda =
    entrada.modalidadEntrega === "unificada"
      ? Boolean(logisticaPrincipal.retiro_en_local)
      : itemsEnriquecidos.every((it) => Boolean(it.entrega_individual?.retiro_en_local));

  let esUsuarioRegistradoNegocio = false;
  let creadorNombreAuth = "";
  let creadorCorreoAuth = user?.email ? String(user.email).trim() : "";
  if (user?.id) {
    try {
      const dbVerif: any = crearClienteAdmin() ?? supabase;
      const aliasNeg =
        negNorm === "tinkay"
          ? ["TNK", "TINKAY", "tinkay", "tnk"]
          : negNorm === "margaritas"
          ? ["MRG", "MARGARITAS", "margaritas", "mrg"]
          : negNorm === "fastfix"
          ? ["FFH", "FASTFIX", "fastfix", "ffh"]
          : ["TRQ", "TRANQ", "TRANQI", "LEGAL", "tranqi"];
      const [{ data: mem }, { data: usu }] = await Promise.all([
        dbVerif
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_id")
          .eq("mem_usuario_id", user.id)
          .in("mem_negocio", aliasNeg)
          .eq("mem_estado", "ACTIVO")
          .limit(1)
          .maybeSingle(),
        dbVerif
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
          .eq("usu_id", user.id)
          .maybeSingle(),
      ]);
      esUsuarioRegistradoNegocio = Boolean(mem?.mem_id || usu?.usu_superadmin_plataforma);
      const nombreCompletoUsu = [usu?.usu_nombres, usu?.usu_apellidos]
        .filter(Boolean)
        .join(" ")
        .trim();
      creadorNombreAuth = nombreCompletoUsu || usu?.usu_correo || creadorCorreoAuth;
      if (usu?.usu_correo) creadorCorreoAuth = String(usu.usu_correo).trim();
    } catch {
      esUsuarioRegistradoNegocio = Boolean(user);
    }
  }

  const nombreIngresado = (entrada.comprador.nombreCompleto || "").trim();
  const idIngresada = (entrada.comprador.identificacion || "").trim();
  const correoIngresado = (entrada.comprador.correo || "").trim();
  const telIngresado = (entrada.comprador.telefono || "").trim();
  const digitosTel = telIngresado.replace(/\D+/g, "");

  if (!esMenorAlUmbral) {
    if (nombreIngresado.length < 2) {
      return {
        ok: false,
        error: `Para compras desde $${umbralSinDatos.toFixed(2)} USD es obligatorio ingresar el nombre o razón social para facturación.`,
      };
    }
    if (idIngresada.length < 5) {
      return {
        ok: false,
        error: `Para compras desde $${umbralSinDatos.toFixed(2)} USD es obligatorio ingresar la Cédula, RUC o Pasaporte.`,
      };
    }
  }

  if (digitosTel.length < 7) {
    return {
      ok: false,
      error:
        "El número de WhatsApp es requerido para contactarte y coordinar la entrega de tu pedido.",
    };
  }

  if (metodoPagoNorm === "transferencia" && !entrada.comprobanteTransferencia?.url) {
    return {
      ok: false,
      error:
        "Por favor sube el comprobante de transferencia o pago QR DeUna (imagen o PDF) para registrar tu pedido.",
    };
  }

  const compradorEfectivo = {
    nombreCompleto: nombreIngresado || "CONSUMIDOR FINAL",
    identificacion: idIngresada || "9999999999999",
    correo:
      correoIngresado ||
      (esUsuarioRegistradoNegocio && user?.email ? String(user.email).trim() : ""),
    telefono: telIngresado,
  };

  // Si el comprador está registrado y aceptó la promoción de bienvenida en primera compra,
  // verificar elegibilidad y agregar el ítem extra con valor $0.00 directamente al pedido.
  let regaloVerificadoOrden: EstadoRegaloPrimeraCompra["regalo"] | null = null;
  if (esUsuarioRegistradoNegocio && entrada.regaloPrimeraCompra) {
    try {
      const estadoRegaloSrv = await obtenerEstadoRegaloPrimeraCompraAction(negNorm);
      if (estadoRegaloSrv.autenticado && estadoRegaloSrv.aplicaRegalo) {
        regaloVerificadoOrden = {
          sku: entrada.regaloPrimeraCompra.sku || estadoRegaloSrv.regalo.sku,
          nombre: entrada.regaloPrimeraCompra.nombre || estadoRegaloSrv.regalo.nombre,
          valorReferencia:
            entrada.regaloPrimeraCompra.valorReferencia ??
            estadoRegaloSrv.regalo.valorReferencia,
          imagenUrl:
            entrada.regaloPrimeraCompra.imagenUrl || estadoRegaloSrv.regalo.imagenUrl,
          productoId:
            entrada.regaloPrimeraCompra.productoId || estadoRegaloSrv.regalo.productoId,
        };
      }
    } catch {
      regaloVerificadoOrden = {
        sku: entrada.regaloPrimeraCompra.sku,
        nombre: entrada.regaloPrimeraCompra.nombre,
        valorReferencia: entrada.regaloPrimeraCompra.valorReferencia,
        imagenUrl:
          entrada.regaloPrimeraCompra.imagenUrl ||
          URL_IMAGEN_REGALO_BIENVENIDA_TINKAY,
        productoId: entrada.regaloPrimeraCompra.productoId,
      };
    }

    if (
      regaloVerificadoOrden &&
      !itemsEnriquecidos.some(
        (it) =>
          Number(it.precio_unitario) === 0 &&
          String(it.variante_sku || "").toUpperCase() ===
            regaloVerificadoOrden!.sku.toUpperCase()
      )
    ) {
      itemsEnriquecidos.push({
        producto_id:
          regaloVerificadoOrden.productoId || "obsequio-registro-primera-compra",
        descripcion: `${regaloVerificadoOrden.nombre} (Extra por registro y primera compra)`,
        producto_nombre: regaloVerificadoOrden.nombre,
        variante_sku: regaloVerificadoOrden.sku,
        variante_nombre: "Extra por registro y primera compra",
        cantidad: 1,
        precio_unitario: 0,
        impuesto: "IVA_0",
        total_linea: 0,
        dedicatoria: null,
        personalizacion_floral: null,
        entrega_individual: null,
      });
    }
  }

  const comprobanteNormalizado = entrada.comprobanteTransferencia
    ? {
        url: entrada.comprobanteTransferencia.url,
        nombre_archivo: entrada.comprobanteTransferencia.nombreArchivo,
        mime_type: entrada.comprobanteTransferencia.mimeType,
        subido_en: entrada.comprobanteTransferencia.subidoEn || new Date().toISOString(),
        referencia_opcional: entrada.comprobanteTransferencia.referenciaOpcional || "",
        subido_por_nombre:
          creadorNombreAuth || nombreIngresado || (telIngresado ? `Cliente (${telIngresado})` : "Cliente Web"),
      }
    : null;

  const creadorPedidoSnap = {
    usuario_id: user?.id || null,
    nombre:
      creadorNombreAuth ||
      nombreIngresado ||
      (telIngresado ? `Cliente Web (${telIngresado})` : "Cliente Web"),
    correo: creadorCorreoAuth || correoIngresado || null,
    origen: esUsuarioRegistradoNegocio ? "CLIENTE_WEB_REGISTRADO" : "CLIENTE_WEB_INVITADO",
    creado_en: new Date().toISOString(),
  };

  const payloadCompleto = {
    tipo_origen: "PEDIDO_TIENDA",
    estado: estadoInicial,
    metodo_pago: entrada.metodoPago,
    comprador: compradorEfectivo,
    es_consumidor_final: !idIngresada,
    creado_por: creadorPedidoSnap,
    comprobante_transferencia: comprobanteNormalizado,
    evidencias: {
      ...(comprobanteNormalizado ? { comprobante_pago: comprobanteNormalizado } : {}),
    },
    subtotal_base_imponible: entrada.subtotalBaseImponible,
    total_iva: entrada.totalIva,
    total_flete: entrada.totalFlete,
    total_recargo_horario_exacto: entrada.totalRecargoHorarioExacto,
    total_pagar: entrada.totalPagar,
    base_iva_0_centavos: baseIva0Centavos,
    base_iva_gravada_centavos: baseIvaGravadaCentavos,
    observaciones: logisticaPrincipal.formula_calculo_interno,
    logistica_entrega: {
      modalidad_entrega: entrada.modalidadEntrega,
      ...logisticaPrincipal,
      colores:
        entrada.entregaUnificada?.colores?.trim() ||
        itemsEnriquecidos
          .map((it) => it.personalizacion_floral?.resumenTexto)
          .filter(Boolean)
          .join(" | ") ||
        undefined,
      extras: entrada.entregaUnificada?.extras?.trim() || undefined,
      recargo_horario_exacto_usd: entrada.totalRecargoHorarioExacto,
      parametros_tarifarios_snapshot: {
        tarifa_por_km: config.tarifaPorKm,
        subsidio_base_usd: config.subsidioBaseUsd,
        recargo_minimo_extra: config.recargoMinimoExtra,
        zona_gratis_nombre: config.zonaGratisNombre,
        mostrar_kilometros_cliente: config.mostrarKilometrosCliente,
      },
    },
    items: itemsEnriquecidos,
    ...(entrada.atribucionPublicitaria
      ? { atribucion_publicitaria: entrada.atribucionPublicitaria }
      : {}),
  };

  const payloadFinal = {
    ...payloadCompleto,
    ...(entrada.atribucionPublicitaria
      ? { atribucion_publicitaria: entrada.atribucionPublicitaria }
      : {}),
    tipo_comprador: esUsuarioRegistradoNegocio ? "USUARIO_REGISTRADO" : "USUARIO_NO_AUTORIZADO",
    usuario_autorizado: esUsuarioRegistradoNegocio,
    ...(regaloVerificadoOrden
      ? {
          regalo_primera_compra: {
            sku: regaloVerificadoOrden.sku,
            nombre: regaloVerificadoOrden.nombre,
            valor_referencia: regaloVerificadoOrden.valorReferencia,
            imagen_url: regaloVerificadoOrden.imagenUrl,
            precio_cobrado: 0,
            motivo: "REGISTRO_Y_PRIMERA_COMPRA",
          },
        }
      : {}),
  };

  // 1. Vía principal: RPC transaccional SECURITY DEFINER (funciona para compradores invitados y autenticados)
  const esquemaComercio = supabase.schema("comun_comercio") as unknown as {
    rpc(
      fn: string,
      args: Record<string, unknown>
    ): Promise<{ data: any; error: { message: string } | null }>;
  };

  const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
    "com_fn_registrar_pedido_tienda",
    {
      p_negocio: negNorm,
      p_payload: payloadFinal,
    }
  );

  if (!errRpc && resRpc?.ok) {
    const codigoCreado = String(resRpc.codigo_orden);
    const respaldoFirmado =
      Number(entrada.totalPagar) > 0
        ? firmarOrdenRespaldoServidor({
            v: 1,
            id: String(resRpc.id),
            neg: negNorm,
            cod: codigoCreado,
            ori: "PEDIDO_TIENDA",
            est: estadoInicial,
            vig: 15,
            sub: entrada.subtotalBaseImponible,
            des: 0,
            iva: entrada.totalIva,
            fle: entrada.totalFlete,
            tot: entrada.totalPagar,
            b0c: baseIva0Centavos,
            bgc: baseIvaGravadaCentavos,
            iat: new Date().toISOString(),
            cmp: {
              nom: compradorEfectivo.nombreCompleto,
              ide: compradorEfectivo.identificacion,
              cor: compradorEfectivo.correo,
              tel: compradorEfectivo.telefono,
            },
            ubi: {
              ret: Boolean(logisticaPrincipal.retiro_en_local),
              dir: String(logisticaPrincipal.direccion || "Quito, Ecuador"),
              ref: String(logisticaPrincipal.referencia || ""),
              zon: logisticaPrincipal.zona_detectada ? String(logisticaPrincipal.zona_detectada) : undefined,
              km:
                typeof logisticaPrincipal.distancia_vial_km === "number"
                  ? logisticaPrincipal.distancia_vial_km
                  : undefined,
              map: logisticaPrincipal.enlace_mapa ? String(logisticaPrincipal.enlace_mapa) : undefined,
            },
            itm: itemsEnriquecidos.map((it) => ({
              dsc: it.descripcion,
              var: it.variante_nombre ? String(it.variante_nombre) : undefined,
              can: Number(it.cantidad || 1),
              pun: Number(it.precio_unitario || 0),
              imp: it.impuesto,
              tot: Number(it.total_linea || 0),
            })),
          })
        : undefined;
    if (metodoPagoNorm !== "plux") {
      try {
        const {
          notificarClienteCompraConfirmada,
          notificarStaffNuevoPedido,
        } = await import("@eco/notificaciones/notificar-usuario");
        const tipoEntregaTexto =
          entrada.modalidadEntrega === "unificada"
            ? logisticaPrincipal.retiro_en_local
              ? "RETIRO EN TIENDA"
              : "DOMICILIO"
            : "MULTIDESTINO";
        const resumenItemsNotif = itemsEnriquecidos.map(
          (it) => `${it.cantidad}x ${it.descripcion} ($${it.total_linea.toFixed(2)})`
        );
        await Promise.allSettled([
          notificarClienteCompraConfirmada({
            negocio: negNorm,
            codigoOrden: codigoCreado,
            clienteUsuarioId: user?.id ?? null,
            clienteNombre: compradorEfectivo.nombreCompleto,
            clienteCorreo: compradorEfectivo.correo || null,
            montoUsd: entrada.totalPagar,
            metodoPago: metodoPagoNorm.toUpperCase(),
            esTransferenciaPendiente: metodoPagoNorm === "transferencia",
            modalidadEntrega: tipoEntregaTexto,
            direccionEntrega: logisticaPrincipal.direccion,
            fechaEntrega: logisticaPrincipal.fecha_entrega,
            itemsResumen: resumenItemsNotif,
            whatsappTienda: configCheckout.whatsappTienda,
          }),
          notificarStaffNuevoPedido({
            negocio: negNorm,
            codigo: codigoCreado,
            clienteNombre: compradorEfectivo.nombreCompleto,
            clienteCorreo: compradorEfectivo.correo || undefined,
            clienteTelefono: compradorEfectivo.telefono || undefined,
            montoUsd: entrada.totalPagar,
            metodoPago: metodoPagoNorm.toUpperCase(),
            canalOrigen: "Tienda Web",
            tipoEntrega: tipoEntregaTexto,
            direccionEntrega: logisticaPrincipal.direccion,
            fechaEntrega: logisticaPrincipal.fecha_entrega,
            dedicatoria: entrada.comprobanteTransferencia?.nombreArchivo
              ? `Comprobante subido: ${entrada.comprobanteTransferencia.nombreArchivo}`
              : undefined,
            itemsResumen: resumenItemsNotif,
          }),
        ]);
      } catch (errNotif) {
        console.warn("Aviso al notificar venta de tienda a cliente y staff:", errNotif);
      }
    }
    if (entrada.conversacionWebId) {
      try {
        const { registrarInteraccionChatWebAction } = await import("./acciones-omnicanal");
        await registrarInteraccionChatWebAction({
          negocio: negNorm,
          claveHilo: entrada.conversacionWebId.trim().slice(0, 96),
          fase: "EVENTO_ORDEN",
          contenido: `🛍️ Orden Web ${codigoCreado} generada por $${entrada.totalPagar.toFixed(2)} (${metodoPagoNorm.toUpperCase()})`,
          metadatos: {
            nombre_cliente: compradorEfectivo.nombreCompleto,
            correo: compradorEfectivo.correo,
            telefono: compradorEfectivo.telefono,
            codigo_orden: codigoCreado,
            total_pagar: entrada.totalPagar,
            metodo_pago: metodoPagoNorm,
          },
        });
      } catch {
        // No bloquear el checkout si falla la traza conversacional opcional
      }
    }
    revalidatePath("/panel/pedidos");
    revalidatePath("/panel/conversaciones");
    return {
      ok: true,
      id: String(resRpc.id),
      codigoOrden: codigoCreado,
      tokenAprobacion: resRpc.token_aprobacion ? String(resRpc.token_aprobacion) : undefined,
      respaldoFirmado,
    };
  }

  // 2. Respaldo resiliente sobre tablas existentes en producción (`com_proforma`, `com_proforma_item`, `com_despacho_asignacion`)
  const clienteEscritura: any = crearClienteAdmin() ?? supabase;

  const prefijo =
    negNorm === "tinkay"
      ? "TNK"
      : negNorm === "margaritas"
      ? "MRG"
      : negNorm === "fastfix"
      ? "FFH"
      : "TRQ";

  const { data: proformaCreada, error: errPrf } = await clienteEscritura
    .schema("comun_comercio")
    .from("com_proforma")
    .insert({
      prf_negocio: negNorm,
      prf_cliente_id: user?.id ?? null,
      prf_cliente_nombre: compradorEfectivo.nombreCompleto,
      prf_cliente_contacto: {
        ...compradorEfectivo,
        tipo_comprador: esUsuarioRegistradoNegocio ? "USUARIO_REGISTRADO" : "USUARIO_NO_AUTORIZADO",
      },
      prf_estado: estadoInicial,
      prf_subtotal: entrada.subtotalBaseImponible,
      prf_descuento: 0,
      prf_iva: entrada.totalIva,
      prf_total: entrada.totalPagar,
      prf_observaciones: logisticaPrincipal.formula_calculo_interno,
      prf_detalle_proforma: payloadFinal,
    })
    .select("prf_id, prf_secuencial, prf_token_aprobacion")
    .single();

  if (errPrf || !proformaCreada) {
    const msgPrf = String(errPrf?.message || "");
    const esRestriccionPermisos =
      msgPrf.toLowerCase().includes("permission denied") ||
      msgPrf.toLowerCase().includes("row-level security") ||
      !crearClienteAdmin();

    // Respaldo criptográfico firmado en servidor cuando la compra es de invitado (anon)
    // y el RPC transaccional aún no está disponible en el entorno remoto.
    if (esRestriccionPermisos && Number(entrada.totalPagar) > 0) {
      const idRespaldo = crypto.randomUUID();
      const sufijoNum = String(1000 + (Date.now() % 8999));
      const codigoOrdenRespaldo = `${prefijo}-ORD-${sufijoNum}`;
      const tokenFirmado = firmarOrdenRespaldoServidor({
        v: 1,
        id: idRespaldo,
        neg: negNorm,
        cod: codigoOrdenRespaldo,
        ori: "PEDIDO_TIENDA",
        est: estadoInicial,
        vig: 15,
        sub: entrada.subtotalBaseImponible,
        des: 0,
        iva: entrada.totalIva,
        fle: entrada.totalFlete,
        tot: entrada.totalPagar,
        b0c: baseIva0Centavos,
        bgc: baseIvaGravadaCentavos,
        iat: new Date().toISOString(),
        cmp: {
          nom: compradorEfectivo.nombreCompleto,
          ide: compradorEfectivo.identificacion,
          cor: compradorEfectivo.correo,
          tel: compradorEfectivo.telefono,
        },
        ubi: {
          ret: Boolean(logisticaPrincipal.retiro_en_local),
          dir: String(logisticaPrincipal.direccion || "Quito, Ecuador"),
          ref: String(logisticaPrincipal.referencia || ""),
          zon: logisticaPrincipal.zona_detectada ? String(logisticaPrincipal.zona_detectada) : undefined,
          km:
            typeof logisticaPrincipal.distancia_vial_km === "number"
              ? logisticaPrincipal.distancia_vial_km
              : undefined,
          map: logisticaPrincipal.enlace_mapa ? String(logisticaPrincipal.enlace_mapa) : undefined,
        },
        itm: itemsEnriquecidos.map((it) => ({
          dsc: it.descripcion,
          var: it.variante_nombre ? String(it.variante_nombre) : undefined,
          can: Number(it.cantidad || 1),
          pun: Number(it.precio_unitario || 0),
          imp: String(it.impuesto || "IVA_0"),
          tot: Number(it.total_linea || 0),
        })),
      });

      return {
        ok: true,
        id: idRespaldo,
        codigoOrden: codigoOrdenRespaldo,
        tokenAprobacion: tokenFirmado,
      };
    }

    return {
      ok: false,
      error:
        errRpc?.message ||
        errPrf?.message ||
        "No se pudo registrar el pedido en la base de datos.",
    };
  }

  const codigoOrden = `${prefijo}-ORD-${String(proformaCreada.prf_secuencial ?? 1).padStart(
    4,
    "0"
  )}`;

  await clienteEscritura
    .schema("comun_comercio")
    .from("com_proforma")
    .update({
      prf_detalle_proforma: {
        ...payloadCompleto,
        codigo_orden: codigoOrden,
      },
    })
    .eq("prf_id", proformaCreada.prf_id);

  if (itemsEnriquecidos.length > 0) {
    const filasItems = itemsEnriquecidos.map((it) => ({
      pfi_negocio: negNorm,
      pfi_proforma_id: proformaCreada.prf_id,
      pfi_variante_id: null,
      pfi_es_item_libre: true,
      pfi_descripcion: it.descripcion,
      pfi_cantidad: it.cantidad,
      pfi_precio_unitario: it.precio_unitario,
      pfi_descuento: 0,
      pfi_impuesto: it.impuesto,
      pfi_total_linea: it.total_linea,
      pfi_detalle_item: it,
    }));

    const { error: errItems } = await clienteEscritura
      .schema("comun_comercio")
      .from("com_proforma_item")
      .insert(filasItems);

    if (errItems) {
      return { ok: false, error: errItems.message };
    }
  }

  await clienteEscritura
    .schema("comun_comercio")
    .from("com_despacho_asignacion")
    .insert({
      dsp_negocio: negNorm,
      dsp_orden_id: proformaCreada.prf_id,
      dsp_modalidad: logisticaPrincipal.retiro_en_local ? "RETIRO_LOCAL" : "PROPIO",
      dsp_tracking_url: logisticaPrincipal.enlace_mapa,
      dsp_costo_envio: entrada.totalFlete,
      dsp_estado: "ASIGNADO",
      dsp_observaciones_coordinacion: logisticaPrincipal.formula_calculo_interno,
      dsp_detalle_despacho: payloadCompleto.logistica_entrega,
    });

  if (metodoPagoNorm !== "plux") {
    try {
      const {
        notificarClienteCompraConfirmada,
        notificarStaffNuevoPedido,
      } = await import("@eco/notificaciones/notificar-usuario");
      const tipoEntregaTexto =
        entrada.modalidadEntrega === "unificada"
          ? logisticaPrincipal.retiro_en_local
            ? "RETIRO EN TIENDA"
            : "DOMICILIO"
          : "MULTIDESTINO";
      const resumenItemsNotif = itemsEnriquecidos.map(
        (it) => `${it.cantidad}x ${it.descripcion} ($${it.total_linea.toFixed(2)})`
      );
      await Promise.allSettled([
        notificarClienteCompraConfirmada({
          negocio: negNorm,
          codigoOrden: codigoOrden,
          clienteUsuarioId: user?.id ?? null,
          clienteNombre: compradorEfectivo.nombreCompleto,
          clienteCorreo: compradorEfectivo.correo || null,
          montoUsd: entrada.totalPagar,
          metodoPago: metodoPagoNorm.toUpperCase(),
          esTransferenciaPendiente: metodoPagoNorm === "transferencia",
          modalidadEntrega: tipoEntregaTexto,
          direccionEntrega: logisticaPrincipal.direccion,
          fechaEntrega: logisticaPrincipal.fecha_entrega,
          itemsResumen: resumenItemsNotif,
          whatsappTienda: configCheckout.whatsappTienda,
        }),
        notificarStaffNuevoPedido({
          negocio: negNorm,
          codigo: codigoOrden,
          clienteNombre: compradorEfectivo.nombreCompleto,
          clienteCorreo: compradorEfectivo.correo || undefined,
          clienteTelefono: compradorEfectivo.telefono || undefined,
          montoUsd: entrada.totalPagar,
          metodoPago: metodoPagoNorm.toUpperCase(),
          canalOrigen: "Tienda Web",
          tipoEntrega: tipoEntregaTexto,
          direccionEntrega: logisticaPrincipal.direccion,
          fechaEntrega: logisticaPrincipal.fecha_entrega,
          dedicatoria: entrada.comprobanteTransferencia?.nombreArchivo
            ? `Comprobante subido: ${entrada.comprobanteTransferencia.nombreArchivo}`
            : undefined,
          itemsResumen: resumenItemsNotif,
        }),
      ]);
    } catch (errNotif) {
      console.warn("Aviso al notificar venta de tienda (respaldo) a cliente y staff:", errNotif);
    }
  }

  if (entrada.conversacionWebId) {
    try {
      const { registrarInteraccionChatWebAction } = await import("./acciones-omnicanal");
      await registrarInteraccionChatWebAction({
        negocio: negNorm,
        claveHilo: entrada.conversacionWebId.trim().slice(0, 96),
        fase: "EVENTO_ORDEN",
        contenido: `🛍️ Orden Web ${codigoOrden} generada por $${entrada.totalPagar.toFixed(2)} (${metodoPagoNorm.toUpperCase()})`,
        metadatos: {
          nombre_cliente: compradorEfectivo.nombreCompleto,
          correo: compradorEfectivo.correo,
          telefono: compradorEfectivo.telefono,
          codigo_orden: codigoOrden,
          total_pagar: entrada.totalPagar,
          metodo_pago: metodoPagoNorm,
        },
      });
    } catch {
      // No bloquear el checkout si falla la traza conversacional opcional
    }
  }

  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/conversaciones");
  return {
    ok: true,
    id: String(proformaCreada.prf_id),
    codigoOrden,
    tokenAprobacion: proformaCreada.prf_token_aprobacion
      ? String(proformaCreada.prf_token_aprobacion)
      : undefined,
  };
}

/**
 * Consulta los pedidos registrados en la tienda junto con su desglose logístico interno.
 * Protegido para operadores, administradores y superadmins del negocio.
 */
export async function leerEstadosPedidosConfig(
  negocio: string,
  supabase: any
): Promise<EstadoPedidoConfig[]> {
  try {
    const { crearClienteAdmin } = await import("@eco/supabase/servidor");
    const db: any = crearClienteAdmin() ?? supabase;
    const { data } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();

    return normalizarEstadosPedidosConfig(data?.cfg_detalle_configuracion?.estados_pedidos);
  } catch {
    return ESTADOS_PEDIDO_DEFECTO;
  }
}

export async function guardarEstadosPedidosAdminAction(entrada: {
  negocio: string;
  estados: EstadoPedidoConfig[];
}): Promise<
  | { ok: true; estadosConfig: EstadoPedidoConfig[] }
  | { ok: false; error: string }
> {
  try {
    const negNorm = (entrada.negocio || "tinkay").trim().toLowerCase();
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Debes iniciar sesión para administrar estados." };
    }

    const resRol = await (supabase.schema("comun_seguridad") as any).rpc(
      "seg_fn_obtener_rol_operativo_negocio",
      { p_negocio: negNorm }
    );
    const rol = String(resRol?.data || "").toUpperCase();
    if (rol !== "SUPERADMIN" && rol !== "ADMINISTRADOR") {
      return {
        ok: false,
        error: "Solo el Administrador o SuperAdmin puede administrar los estados de pedidos.",
      };
    }

    const estadosLimpios = normalizarEstadosPedidosConfig(entrada.estados);
    const db: any = crearClienteAdmin() ?? supabase;
    const { data: cfgActual, error: errRead } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negNorm)
      .maybeSingle();

    if (errRead) return { ok: false, error: errRead.message };

    const detPrevio = (cfgActual?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
    const { error: errUpd } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrevio,
          estados_pedidos: estadosLimpios,
        },
        cfg_actualizado_en: new Date().toISOString(),
      })
      .eq("cfg_negocio", negNorm);

    if (errUpd) return { ok: false, error: errUpd.message };

    // Sincronizar visibilidad en Taller de órdenes pendientes según el nuevo ajuste de visibleEnTaller
    try {
      const estadosOcultos = estadosLimpios
        .filter((e) => e.visibleEnTaller === false)
        .map((e) => e.valor);
      const estadosVisibles = estadosLimpios
        .filter((e) => e.visibleEnTaller !== false)
        .map((e) => e.valor);

      if (estadosOcultos.length > 0) {
        await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({
            ota_estado_taller: "PENDIENTE_ENVIO",
            ota_actualizado_en: new Date().toISOString(),
          })
          .eq("ota_negocio", negNorm)
          .in("ota_estado_pago", estadosOcultos)
          .eq("ota_estado_taller", "ENVIADO_TALLER")
          .is("ota_eliminado_en", null);
      }

      if (estadosVisibles.length > 0) {
        await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({
            ota_estado_taller: "ENVIADO_TALLER",
            ota_actualizado_en: new Date().toISOString(),
          })
          .eq("ota_negocio", negNorm)
          .in("ota_estado_pago", estadosVisibles)
          .eq("ota_estado_taller", "PENDIENTE_ENVIO")
          .is("ota_eliminado_en", null);
      }
    } catch {
      // No bloquear guardado de configuración si la sincronización opcional falla
    }

    revalidatePath("/panel/pedidos");
    revalidatePath("/panel/taller");
    return { ok: true, estadosConfig: estadosLimpios };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar estados de pedidos",
    };
  }
}

export async function obtenerPedidosTiendaAction(
  negocio: string
): Promise<
  | {
      ok: true;
      pedidos: PedidoTiendaRegistrado[];
      esAdminEstricto?: boolean;
      puedeEliminarLogico?: boolean;
      pedidosEliminados?: PedidoTiendaRegistrado[];
      estadosConfig?: EstadoPedidoConfig[];
    }
  | { ok: false; error: string }
> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión para consultar los pedidos de la tienda." };
  }

  const admin = crearClienteAdmin();
  let filas: any[] | null = null;
  let error: { message: string } | null = null;

  if (admin) {
    const resAdmin = await (admin as any)
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .eq("prf_negocio", negNorm)
      .is("prf_eliminado_en", null)
      .order("prf_creado_en", { ascending: false })
      .limit(250);
    filas = resAdmin.data;
    error = resAdmin.error;
  } else {
    const resRpc = await (supabase as any)
      .schema("comun_comercio")
      .rpc("com_fn_listar_pedidos_tienda", { p_negocio: negNorm });
    if (!resRpc.error && Array.isArray(resRpc.data)) {
      filas = resRpc.data;
    } else {
      const resDirecto = await (supabase as any)
        .schema("comun_comercio")
        .from("com_proforma")
        .select("*")
        .eq("prf_negocio", negNorm)
        .is("prf_eliminado_en", null)
        .order("prf_creado_en", { ascending: false })
        .limit(250);
      filas = resDirecto.data;
      error = resDirecto.error;
    }
  }

  if (error) {
    return { ok: false, error: error.message };
  }

  const prefijo =
    negNorm === "tinkay"
      ? "TNK"
      : negNorm === "margaritas"
      ? "MRG"
      : negNorm === "fastfix"
      ? "FFH"
      : "TRQ";

  const pedidos: PedidoTiendaRegistrado[] = (filas ?? []).map((f: any) => {
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const contacto = (f.prf_cliente_contacto ?? det.comprador ?? {}) as Record<string, any>;
    const log = (det.logistica_entrega ?? {}) as Record<string, any>;
    const paramsSnap = log.parametros_tarifarios_snapshot as Record<string, any> | undefined;
    const itemsRaw = Array.isArray(det.items) ? det.items : [];
    const sec = Number(f.prf_secuencial ?? 0);
    const esProformaEvento = det.tipo_origen === "PROFORMA_EVENTO";
    const prefijoDoc = esProformaEvento ? "PRF" : "ORD";
    const totalNum = Number(f.prf_total ?? det.total_pagar ?? 0);
    const eventoRaw = det.evento && typeof det.evento === "object" ? det.evento : null;
    const retiroEnLocalPrf = Boolean(log.retiro_en_local);
    const direccionPrf = String(log.direccion || "");
    const salaPrf = log.sala_servicio || det.sala_servicio || null;
    const resumenItemsPrf = itemsRaw
      .map((it: any) => String(it.descripcion || it.producto_nombre || ""))
      .join(" ");
    const clasifPrf = inferirClasificacionPedido({
      clasificacionExplicita: det.clasificacion_pedido ? String(det.clasificacion_pedido) : null,
      origenTipo: String(det.tipo_origen || "PEDIDO_TIENDA"),
      retiroEnLocal: retiroEnLocalPrf,
      salaServicio: salaPrf ? String(salaPrf) : null,
      productoResumen: resumenItemsPrf,
      ubicacionEntrega: direccionPrf,
      metodoPago: det.metodo_pago ? String(det.metodo_pago) : null,
      tieneEvento: Boolean(eventoRaw),
      items: itemsRaw.map((it: any) => ({
        descripcion: String(it.descripcion || it.producto_nombre || ""),
        sku: it.sku ? String(it.sku) : undefined,
        esRenta: Boolean(it.es_renta || it.esRenta),
        tipoOferta: it.tipo_oferta ? String(it.tipo_oferta) : undefined,
      })),
    });

    const entregaConfirmadaPrf =
      String(f.prf_estado || "").toUpperCase() === "ENTREGADO" ||
      Boolean(det.entrega_confirmada) ||
      Boolean(det.entrega_foto_url);

    return {
      id: String(f.prf_id),
      secuencial: sec,
      codigoOrden: String(
        det.codigo_proforma ||
          det.codigo_orden ||
          `${prefijo}-${prefijoDoc}-${String(sec || 1).padStart(4, "0")}`
      ),
      tipoOrigen: String(det.tipo_origen || "PEDIDO_TIENDA"),
      clasificacionPedido: clasifPrf,
      salaServicio: salaPrf ? String(salaPrf) : null,
      exequiales:
        clasifPrf === "EXEQUIALES"
          ? {
              salaServicio: salaPrf ? String(salaPrf) : null,
              quienSolicita: String(f.prf_cliente_nombre || contacto.nombreCompleto || ""),
              nombreFallecido: String(log.destinatario_nombre || ""),
              horaServicio: log.hora_exacta ? String(log.hora_exacta) : String(log.franja_horaria || ""),
            }
          : undefined,
      evidenciaEntrega:
        entregaConfirmadaPrf
          ? {
              confirmada: true,
              entregaId: det.entrega_evidencia_id ? String(det.entrega_evidencia_id) : null,
              fotoUrl: det.entrega_foto_url ? String(det.entrega_foto_url) : null,
              mapaUrl: det.entrega_mapa_url ? String(det.entrega_mapa_url) : null,
              capturadoEn: det.entrega_capturado_en
                ? String(det.entrega_capturado_en)
                : det.entrega_confirmada_en
                  ? String(det.entrega_confirmada_en)
                  : null,
              entregadorNombre: det.entrega_entregador_nombre
                ? String(det.entrega_entregador_nombre)
                : null,
              latitud: det.entrega_latitud != null ? Number(det.entrega_latitud) : null,
              longitud: det.entrega_longitud != null ? Number(det.entrega_longitud) : null,
              direccionGps: det.entrega_direccion_gps ? String(det.entrega_direccion_gps) : null,
              salaServicio: salaPrf ? String(salaPrf) : null,
            }
          : null,
      grupoProformaId: det.grupo_proforma_id ? String(det.grupo_proforma_id) : String(f.prf_id),
      versionNumero: Number(det.version_numero ?? 1),
      esOriginal: det.es_original !== undefined ? Boolean(det.es_original) : true,
      etiquetaVersion: det.etiqueta_version ? String(det.etiqueta_version) : undefined,
      notaAsesor: det.nota_asesor ? String(det.nota_asesor) : undefined,
      tokenAprobacion: f.prf_token_aprobacion ? String(f.prf_token_aprobacion) : undefined,
      vigenciaDias: typeof f.prf_vigencia_dias === "number" ? f.prf_vigencia_dias : 15,
      descuento: Number(f.prf_descuento ?? det.descuento_total ?? 0),
      montoAbonadoUsd: Number(det.monto_abonado_usd ?? 0),
      saldoPendienteUsd:
        det.saldo_pendiente_usd !== undefined ? Number(det.saldo_pendiente_usd) : totalNum,
      autorizaWhatsapp: Boolean(contacto.autorizaWhatsapp),
      evento: eventoRaw
        ? {
            tipoEvento: eventoRaw.tipoEvento ? String(eventoRaw.tipoEvento) : undefined,
            fechaEvento: eventoRaw.fechaEvento ? String(eventoRaw.fechaEvento) : undefined,
            horaEvento: eventoRaw.horaEvento ? String(eventoRaw.horaEvento) : undefined,
            invitadosEstimados:
              typeof eventoRaw.invitadosEstimados === "number"
                ? eventoRaw.invitadosEstimados
                : undefined,
            paletaColores: eventoRaw.paletaColores ? String(eventoRaw.paletaColores) : undefined,
            notasEvento: eventoRaw.notasEvento ? String(eventoRaw.notasEvento) : undefined,
          }
        : undefined,
      negocio: String(f.prf_negocio || negNorm),
      estado: String(f.prf_estado || det.estado || "APROBADA"),
      metodoPago: String(det.metodo_pago || (esProformaEvento ? "proforma" : "plux")),
      compradorNombre: String(f.prf_cliente_nombre || contacto.nombreCompleto || "Cliente"),
      compradorIdentificacion: String(contacto.identificacion || ""),
      compradorCorreo: String(contacto.correo || ""),
      compradorTelefono: String(contacto.whatsapp || contacto.telefono || ""),
      subtotal: Number(f.prf_subtotal ?? det.subtotal_base_imponible ?? 0),
      iva: Number(f.prf_iva ?? det.total_iva ?? 0),
      costoEnvio: Number(det.total_flete ?? log.costo_envio_usd ?? 0),
      recargoHorarioExacto: Number(
        det.total_recargo_horario_exacto ?? log.recargo_horario_exacto_usd ?? 0
      ),
      total: Number(f.prf_total ?? det.total_pagar ?? 0),
      creadoEn: String(f.prf_creado_en),
      logistica: {
        modalidadEntrega: String(log.modalidad_entrega || "unificada"),
        retiroEnLocal: Boolean(log.retiro_en_local),
        destinatarioNombre: String(log.destinatario_nombre || f.prf_cliente_nombre || ""),
        destinatarioTelefono: String(log.destinatario_telefono || contacto.telefono || ""),
        direccion: String(log.direccion || ""),
        referencia: String(log.referencia || ""),
        fechaEntrega: String(log.fecha_entrega || ""),
        franjaHoraria: String(log.franja_horaria || ""),
        horaExacta: log.hora_exacta ? String(log.hora_exacta) : undefined,
        enlaceMapa: log.enlace_mapa ? String(log.enlace_mapa) : undefined,
        lat: typeof log.lat === "number" ? log.lat : undefined,
        lng: typeof log.lng === "number" ? log.lng : undefined,
        zonaDetectada: log.zona_detectada ? String(log.zona_detectada) : undefined,
        reglaAplicada: log.regla_aplicada ? String(log.regla_aplicada) : undefined,
        distanciaVialKm:
          typeof log.distancia_vial_km === "number" ? log.distancia_vial_km : undefined,
        formulaCalculoInterno: String(
          log.formula_calculo_interno || f.prf_observaciones || "Sin detalle adicional"
        ),
        detalleDireccionGeo:
          log.detalle_direccion_geo && typeof log.detalle_direccion_geo === "object"
            ? (log.detalle_direccion_geo as DetalleDireccionGeoespacial)
            : null,
        parametrosTarifarios: paramsSnap
          ? {
              tarifaPorKm: Number(paramsSnap.tarifa_por_km ?? 0),
              subsidioBaseUsd: Number(paramsSnap.subsidio_base_usd ?? 0),
              recargoMinimoExtra: Number(paramsSnap.recargo_minimo_extra ?? 0),
              zonaGratisNombre: String(paramsSnap.zona_gratis_nombre ?? ""),
            }
          : undefined,
      },
      items: itemsRaw.map((it: any) => ({
        descripcion: String(it.descripcion || it.producto_nombre || "Producto"),
        varianteNombre: String(it.variante_nombre || ""),
        cantidad: Number(it.cantidad ?? 1),
        precioUnitario: Number(it.precio_unitario ?? 0),
        impuesto: String(it.impuesto || "IVA_0"),
        totalLinea: Number(it.total_linea ?? 0),
        dedicatoria: it.dedicatoria ?? undefined,
        personalizacionFloral:
          it.personalizacion_floral ?? it.personalizacionFloral ?? undefined,
        entregaIndividual: it.entrega_individual ?? undefined,
      })),
      comprobanteTransferencia: (() => {
        const comp = det.comprobante_transferencia || det.evidencias?.comprobante_pago;
        if (!comp || typeof comp !== "object" || !comp.url) return null;
        return {
          url: String(comp.url || ""),
          nombreArchivo: String(
            comp.nombre_archivo || comp.nombreArchivo || "comprobante"
          ),
          mimeType: String(
            comp.mime_type || comp.mimeType || "image/jpeg"
          ),
          subidoEn: comp.subido_en
            ? String(comp.subido_en)
            : comp.subidoEn
              ? String(comp.subidoEn)
              : undefined,
          referenciaOpcional: comp.referencia_opcional
            ? String(comp.referencia_opcional)
            : comp.referenciaOpcional
              ? String(comp.referenciaOpcional)
              : undefined,
          subidoPorNombre: comp.subido_por_nombre
            ? String(comp.subido_por_nombre)
            : comp.subidoPorNombre
              ? String(comp.subidoPorNombre)
              : null,
        };
      })(),
      respuestaPlux: (() => {
        const plx = det.ultimo_pago_plux || det.evidencias?.respuesta_plux;
        if (!plx || typeof plx !== "object") return null;
        return {
          pagoId: plx.pago_id ? String(plx.pago_id) : null,
          identificador: plx.identificador ? String(plx.identificador) : null,
          autorizacion: plx.autorizacion ? String(plx.autorizacion) : null,
          marcaTarjeta: plx.marca_tarjeta ? String(plx.marca_tarjeta) : null,
          ultimosDigitos: plx.ultimos_digitos ? String(plx.ultimos_digitos) : null,
          montoUsd: plx.monto_usd != null ? Number(plx.monto_usd) : null,
          modalidadCobro: plx.modalidad_cobro ? String(plx.modalidad_cobro) : null,
          estado: plx.estado ? String(plx.estado) : "APROBADO",
          confirmadoEn: plx.confirmado_en ? String(plx.confirmado_en) : null,
          respuestaRaw: plx.respuesta_raw ?? null,
        };
      })(),
      creadoPor: (() => {
        const cp = det.creado_por;
        if (cp && typeof cp === "object" && (cp.nombre || cp.correo)) {
          return {
            usuarioId: cp.usuario_id ? String(cp.usuario_id) : null,
            nombre: String(cp.nombre || cp.correo || "Sistema"),
            correo: cp.correo ? String(cp.correo) : null,
            origen: cp.origen ? String(cp.origen) : String(det.tipo_origen || "PEDIDO_TIENDA"),
            creadoEn: cp.creado_en ? String(cp.creado_en) : String(f.prf_creado_en || ""),
          };
        }
        if (det.tarjeta?.metadata?.creado_por) {
          return {
            usuarioId: null,
            nombre: String(det.tarjeta.metadata.creado_por),
            correo: null,
            origen: String(det.tipo_origen || "MANUAL_ADMIN"),
            creadoEn: String(f.prf_creado_en || ""),
          };
        }
        return null;
      })(),
      tarjeta:
        det.tarjeta && typeof det.tarjeta === "object"
          ? {
              token: String(
                det.tarjeta.token ||
                  f.prf_token_aprobacion ||
                  String(f.prf_id)
              ),
              tipo:
                det.tarjeta.tipo === "CONDOLENCIAS_PLANA" ||
                det.tarjeta.tipo === "SOLO_DIGITAL" ||
                det.tarjeta.tipo === "DIPTICO"
                  ? det.tarjeta.tipo
                  : "DIPTICO",
              mensaje: String(det.tarjeta.mensaje ?? ""),
              para: String(det.tarjeta.para ?? log.destinatario_nombre ?? ""),
              de: String(det.tarjeta.de ?? f.prf_cliente_nombre ?? ""),
              musicaUrl: det.tarjeta.musica_url
                ? String(det.tarjeta.musica_url)
                : det.tarjeta.musicaUrl
                  ? String(det.tarjeta.musicaUrl)
                  : null,
              musicaTitulo: det.tarjeta.musica_titulo
                ? String(det.tarjeta.musica_titulo)
                : det.tarjeta.musicaTitulo
                  ? String(det.tarjeta.musicaTitulo)
                  : null,
              lyrics: Array.isArray(det.tarjeta.lyrics) ? det.tarjeta.lyrics : [],
              diseno:
                det.tarjeta.diseno && typeof det.tarjeta.diseno === "object"
                  ? det.tarjeta.diseno
                  : det.tarjeta.metadata?.diseno && typeof det.tarjeta.metadata.diseno === "object"
                    ? det.tarjeta.metadata.diseno
                    : undefined,
              metadata:
                det.tarjeta.metadata && typeof det.tarjeta.metadata === "object"
                  ? det.tarjeta.metadata
                  : { origen: "AUTOMATICO_SISTEMA", vistas_cliente: 0, impresiones: 0 },
            }
          : undefined,
    };
  });

  const estadosConfig = await leerEstadosPedidosConfig(negNorm, supabase);
  const clavesEstadosConfig = new Set(estadosConfig.map((e) => e.valor));

  let esAdminEstricto = false;
  let puedeEliminarLogico = false;
  const pedidosEliminados: PedidoTiendaRegistrado[] = [];

  // Unificar también Pedidos Manuales (PED-...) y Órdenes Exequiales (OT-...) registrados en com_orden_taller / com_entrega_evidencia
  try {
    const dbLectura: any = admin ?? supabase;
    const idsProformaPresentes = new Set(pedidos.map((p) => p.id));
    const codigosPresentes = new Set(pedidos.map((p) => p.codigoOrden.toUpperCase()));
    const idsEntregaCubiertos = new Set<string>();

    let ordenesTallerExtra: any[] = [];
    const resRpcTaller = await (supabase as any)
      .schema("comun_comercio")
      .rpc("com_fn_obtener_consola_taller_y_despacho", { p_negocio: negNorm });

    if (!resRpcTaller.error && resRpcTaller.data?.ok && Array.isArray(resRpcTaller.data.ordenes)) {
      ordenesTallerExtra = resRpcTaller.data.ordenes;
      const rolRpc = String(resRpcTaller.data.rolOperativo || "").toUpperCase();
      esAdminEstricto =
        typeof resRpcTaller.data.esAdminEstricto === "boolean"
          ? resRpcTaller.data.esAdminEstricto
          : rolRpc === "SUPERADMIN" || rolRpc === "ADMINISTRADOR";
      puedeEliminarLogico =
        typeof resRpcTaller.data.puedeEliminarLogico === "boolean"
          ? resRpcTaller.data.puedeEliminarLogico
          : esAdminEstricto || rolRpc === "OPERADOR" || rolRpc === "VENTAS";

      if (esAdminEstricto && Array.isArray(resRpcTaller.data.ordenesEliminadas)) {
        for (const o of resRpcTaller.data.ordenesEliminadas as any[]) {
          const itemsOta =
            Array.isArray(o.items) && o.items.length > 0
              ? o.items
              : [{ descripcion: String(o.productoResumen || "Arreglo floral"), cantidad: 1 }];
          const totalOta = Number(o.totalUsd ?? 0);
          pedidosEliminados.push({
            id: String(o.proformaId || o.id),
            secuencial: 0,
            codigoOrden: String(o.codigo || "PEDIDO"),
            tipoOrigen: String(o.origenTipo || "MANUAL_ADMIN"),
            clasificacionPedido: inferirClasificacionPedido({
              clasificacionExplicita: o.clasificacionPedido ? String(o.clasificacionPedido) : null,
              origenTipo: o.origenTipo ? String(o.origenTipo) : null,
              retiroEnLocal: Boolean(o.retiroEnLocal),
              salaServicio: o.salaServicio ? String(o.salaServicio) : null,
              productoResumen: o.productoResumen ? String(o.productoResumen) : null,
              ubicacionEntrega: o.ubicacionEntrega ? String(o.ubicacionEntrega) : null,
              metodoPago: o.metodoPago ? String(o.metodoPago) : null,
              items: itemsOta,
            }),
            negocio: negNorm,
            estado: "CANCELADO",
            metodoPago: String(o.metodoPago || "manual"),
            compradorNombre: String(o.clienteSolicita || "Cliente"),
            compradorIdentificacion: "",
            compradorCorreo: "",
            compradorTelefono: String(o.clienteTelefono || ""),
            subtotal: totalOta,
            iva: 0,
            costoEnvio: 0,
            recargoHorarioExacto: 0,
            total: totalOta,
            creadoEn: String(o.fechaPedido || o.eliminadoEn || new Date().toISOString()),
            logistica: {
              modalidadEntrega: "unificada",
              retiroEnLocal: Boolean(o.retiroEnLocal),
              destinatarioNombre: String(o.destinatarioFallecido || o.clienteSolicita || ""),
              destinatarioTelefono: String(o.clienteTelefono || ""),
              direccion: String(o.ubicacionEntrega || ""),
              referencia: o.observaciones ? String(o.observaciones) : "",
              fechaEntrega: String(o.fechaEntrega || ""),
              franjaHoraria: String(o.franjaHoraria || ""),
              horaExacta: o.horaEspecifica ? String(o.horaEspecifica) : undefined,
              formulaCalculoInterno: "",
              detalleDireccionGeo: null,
            },
            items: itemsOta.map((it: any) => ({
              descripcion: String(it.descripcion || it.producto_nombre || o.productoResumen || "Arreglo"),
              varianteNombre: it.sku ? String(it.sku) : "",
              cantidad: Number(it.cantidad ?? 1),
              precioUnitario: Number(it.precioUnitario ?? it.pvp_unitario ?? 0),
              totalLinea: Number(it.precioUnitario ?? it.pvp_unitario ?? 0) * Number(it.cantidad ?? 1),
            })),
            ordenTallerId: String(o.id),
            entregaId: o.entregaId ? String(o.entregaId) : null,
            salaServicio: o.salaServicio ? String(o.salaServicio) : null,
            eliminadoEn: o.eliminadoEn ? String(o.eliminadoEn) : null,
            eliminadoPorNombre: o.eliminadoPorNombre ? String(o.eliminadoPorNombre) : null,
            eliminadoMotivo: o.eliminadoMotivo ? String(o.eliminadoMotivo) : null,
          });
        }
      }
    } else {
      try {
        const resRol = await (supabase.schema("comun_seguridad") as any).rpc(
          "seg_fn_obtener_rol_operativo_negocio",
          { p_negocio: negNorm }
        );
        const rolFb = String(resRol?.data || "").toUpperCase();
        esAdminEstricto = rolFb === "SUPERADMIN" || rolFb === "ADMINISTRADOR";
        puedeEliminarLogico =
          esAdminEstricto || rolFb === "OPERADOR" || rolFb === "VENTAS";
      } catch {
        // Ignorar si la función aún no existe
      }

      const resOtaDir = await dbLectura
        .schema("comun_comercio")
        .from("com_orden_taller")
        .select("*")
        .eq("ota_negocio", negNorm)
        .is("ota_eliminado_en", null)
        .order("ota_creado_en", { ascending: false })
        .limit(250);
      if (Array.isArray(resOtaDir.data)) {
        ordenesTallerExtra = resOtaDir.data.map((o: any) => ({
          id: String(o.ota_id),
          codigo: String(o.ota_codigo || "PEDIDO"),
          origenTipo: String(o.ota_origen_tipo || "MANUAL_ADMIN"),
          proformaId: o.ota_proforma_id ? String(o.ota_proforma_id) : null,
          entregaId: o.ota_entrega_id ? String(o.ota_entrega_id) : null,
          estadoTaller: String(o.ota_estado_taller || "PENDIENTE_ENVIO"),
          estadoPago: String(o.ota_estado_pago || "PENDIENTE_PAGO"),
          metodoPago: o.ota_metodo_pago ? String(o.ota_metodo_pago) : null,
          fechaPedido: String(o.ota_fecha_pedido || o.ota_creado_en),
          fechaEntrega: String(o.ota_fecha_entrega || "").slice(0, 10),
          franjaHoraria: o.ota_franja_horaria ? String(o.ota_franja_horaria) : "",
          horaEspecifica: o.ota_hora_especifica ? String(o.ota_hora_especifica) : "",
          productoResumen: String(o.ota_producto_resumen || "Arreglo floral"),
          items: Array.isArray(o.ota_items) ? o.ota_items : [],
          clienteSolicita: String(o.ota_cliente_solicita || "Cliente"),
          clienteTelefono: o.ota_cliente_telefono ? String(o.ota_cliente_telefono) : "",
          destinatarioFallecido: String(o.ota_destinatario_fallecido || ""),
          salaServicio: o.ota_sala_servicio ? String(o.ota_sala_servicio) : null,
          ubicacionEntrega: String(o.ota_ubicacion_entrega || ""),
          enlaceMapa: o.ota_enlace_mapa ? String(o.ota_enlace_mapa) : null,
          retiroEnLocal: Boolean(o.ota_retiro_en_local),
          dedicatoria: o.ota_dedicatoria ? String(o.ota_dedicatoria) : null,
          observaciones: o.ota_observaciones ? String(o.ota_observaciones) : null,
          totalUsd: Number(o.ota_total_usd ?? 0),
          clasificacionPedido: o.ota_clasificacion_pedido ? String(o.ota_clasificacion_pedido) : null,
          entregadoEn: o.ota_entregado_en ? String(o.ota_entregado_en) : null,
          evidenciaFotoUrl: o.ota_evidencia_foto_url ? String(o.ota_evidencia_foto_url) : null,
          evidenciaMapaUrl: o.ota_evidencia_mapa_url ? String(o.ota_evidencia_mapa_url) : null,
          evidenciaLatitud: o.ota_evidencia_latitud != null ? Number(o.ota_evidencia_latitud) : null,
          evidenciaLongitud: o.ota_evidencia_longitud != null ? Number(o.ota_evidencia_longitud) : null,
          evidenciaDireccionGps: o.ota_evidencia_direccion_gps ? String(o.ota_evidencia_direccion_gps) : null,
          entregadoPorNombre: o.ota_entregado_por_nombre ? String(o.ota_entregado_por_nombre) : null,
          tarjetaToken: o.ota_tarjeta_token ? String(o.ota_tarjeta_token) : null,
          tarjetaTipo: o.ota_tarjeta_tipo ? String(o.ota_tarjeta_tipo) : null,
          tarjetaMusicaUrl: o.ota_tarjeta_musica_url ? String(o.ota_tarjeta_musica_url) : null,
          tarjetaMusicaTitulo: o.ota_tarjeta_musica_titulo ? String(o.ota_tarjeta_musica_titulo) : null,
          tarjetaLyrics: Array.isArray(o.ota_tarjeta_lyrics) ? o.ota_tarjeta_lyrics : [],
          tarjetaMetadata:
            o.ota_tarjeta_metadata && typeof o.ota_tarjeta_metadata === "object"
              ? o.ota_tarjeta_metadata
              : {},
          detalleOrden:
            o.ota_detalle_orden && typeof o.ota_detalle_orden === "object"
              ? o.ota_detalle_orden
              : {},
          enviadoNombre: o.ota_enviado_nombre ? String(o.ota_enviado_nombre) : null,
        }));
      }
    }

    const mapaOrdenPorProforma = new Map<string, any>();
    for (const o of ordenesTallerExtra) {
      if (o.proformaId) {
        mapaOrdenPorProforma.set(String(o.proformaId), o);
      }
    }

    // Enriquecer 1:1 los pedidos de com_proforma con su orden de taller y su tarjeta dedicatoria
    for (const p of pedidos) {
      const oVinc = mapaOrdenPorProforma.get(p.id);
      const primerDed = p.items.find((it) => it.dedicatoria?.mensaje)?.dedicatoria;
      const textoResumen = p.items.map((it) => it.descripcion).join(" ").toLowerCase();
      const tipoInferido: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL" =
        p.tipoOrigen === "EXEQUIALES_LLAMADA" ||
        textoResumen.includes("condolen") ||
        textoResumen.includes("funebr") ||
        textoResumen.includes("exequial")
          ? "CONDOLENCIAS_PLANA"
          : "DIPTICO";

      if (oVinc) {
        p.ordenTallerId = String(oVinc.id);
        p.entregaId = oVinc.entregaId ? String(oVinc.entregaId) : null;
        if (oVinc.entregaId) {
          idsEntregaCubiertos.add(String(oVinc.entregaId));
        }
        p.salaServicio = oVinc.salaServicio ? String(oVinc.salaServicio) : p.salaServicio ?? null;
        if (oVinc.clasificacionPedido) {
          p.clasificacionPedido = inferirClasificacionPedido({
            clasificacionExplicita: String(oVinc.clasificacionPedido),
            origenTipo: p.tipoOrigen,
            retiroEnLocal: p.logistica.retiroEnLocal,
            salaServicio: p.salaServicio,
            productoResumen: p.items.map((it) => it.descripcion).join(" "),
            ubicacionEntrega: p.logistica.direccion,
            metodoPago: p.metodoPago,
            tarjetaTipo: oVinc.tarjetaTipo ? String(oVinc.tarjetaTipo) : p.tarjeta?.tipo,
            tieneEvento: Boolean(p.evento),
          });
        }
        if (oVinc.horaEspecifica && !p.logistica.horaExacta) {
          p.logistica.horaExacta = String(oVinc.horaEspecifica);
        }
        if (oVinc.franjaHoraria && !p.logistica.franjaHoraria) {
          p.logistica.franjaHoraria = String(oVinc.franjaHoraria);
        }
        if (
          oVinc.evidenciaFotoUrl ||
          String(oVinc.estadoTaller || "").toUpperCase() === "ENTREGADO"
        ) {
          p.evidenciaEntrega = {
            confirmada: true,
            entregaId: oVinc.entregaId
              ? String(oVinc.entregaId)
              : p.evidenciaEntrega?.entregaId ?? null,
            fotoUrl: oVinc.evidenciaFotoUrl
              ? String(oVinc.evidenciaFotoUrl)
              : p.evidenciaEntrega?.fotoUrl ?? null,
            mapaUrl: oVinc.evidenciaMapaUrl
              ? String(oVinc.evidenciaMapaUrl)
              : p.evidenciaEntrega?.mapaUrl ?? null,
            capturadoEn: oVinc.entregadoEn
              ? String(oVinc.entregadoEn)
              : p.evidenciaEntrega?.capturadoEn ?? null,
            entregadorNombre: oVinc.entregadoPorNombre
              ? String(oVinc.entregadoPorNombre)
              : p.evidenciaEntrega?.entregadorNombre ?? null,
            latitud:
              oVinc.evidenciaLatitud != null
                ? Number(oVinc.evidenciaLatitud)
                : p.evidenciaEntrega?.latitud ?? null,
            longitud:
              oVinc.evidenciaLongitud != null
                ? Number(oVinc.evidenciaLongitud)
                : p.evidenciaEntrega?.longitud ?? null,
            direccionGps: oVinc.evidenciaDireccionGps
              ? String(oVinc.evidenciaDireccionGps)
              : p.evidenciaEntrega?.direccionGps ?? null,
            salaServicio: p.salaServicio,
            numeroInforme: oVinc.numeroInforme ? String(oVinc.numeroInforme) : null,
          };
        }
        const detOtaVinc =
          (oVinc.detalleOrden && typeof oVinc.detalleOrden === "object"
            ? oVinc.detalleOrden
            : oVinc.detalle && typeof oVinc.detalle === "object"
              ? oVinc.detalle
              : {}) as Record<string, any>;
        if (!p.comprobanteTransferencia?.url) {
          const compOta = detOtaVinc.comprobante_transferencia || detOtaVinc.evidencias?.comprobante_pago;
          if (compOta && typeof compOta === "object" && compOta.url) {
            p.comprobanteTransferencia = {
              url: String(compOta.url),
              nombreArchivo: String(compOta.nombre_archivo || compOta.nombreArchivo || "comprobante"),
              mimeType: String(compOta.mime_type || compOta.mimeType || "image/jpeg"),
              subidoEn: compOta.subido_en ? String(compOta.subido_en) : undefined,
              referenciaOpcional: compOta.referencia_opcional ? String(compOta.referencia_opcional) : undefined,
              subidoPorNombre: compOta.subido_por_nombre ? String(compOta.subido_por_nombre) : null,
            };
          }
        }
        if (!p.respuestaPlux) {
          const plxOta = detOtaVinc.ultimo_pago_plux || detOtaVinc.evidencias?.respuesta_plux;
          if (plxOta && typeof plxOta === "object") {
            p.respuestaPlux = {
              pagoId: plxOta.pago_id ? String(plxOta.pago_id) : null,
              identificador: plxOta.identificador ? String(plxOta.identificador) : null,
              autorizacion: plxOta.autorizacion ? String(plxOta.autorizacion) : null,
              marcaTarjeta: plxOta.marca_tarjeta ? String(plxOta.marca_tarjeta) : null,
              ultimosDigitos: plxOta.ultimos_digitos ? String(plxOta.ultimos_digitos) : null,
              montoUsd: plxOta.monto_usd != null ? Number(plxOta.monto_usd) : null,
              modalidadCobro: plxOta.modalidad_cobro ? String(plxOta.modalidad_cobro) : null,
              estado: plxOta.estado ? String(plxOta.estado) : "APROBADO",
              confirmadoEn: plxOta.confirmado_en ? String(plxOta.confirmado_en) : null,
              respuestaRaw: plxOta.respuesta_raw ?? null,
            };
          }
        }
        if (!p.creadoPor) {
          const cpOta = detOtaVinc.creado_por;
          if (cpOta && typeof cpOta === "object" && (cpOta.nombre || cpOta.correo)) {
            p.creadoPor = {
              usuarioId: cpOta.usuario_id ? String(cpOta.usuario_id) : null,
              nombre: String(cpOta.nombre || cpOta.correo),
              correo: cpOta.correo ? String(cpOta.correo) : null,
              origen: cpOta.origen ? String(cpOta.origen) : String(oVinc.origenTipo || p.tipoOrigen || "MANUAL_ADMIN"),
              creadoEn: cpOta.creado_en ? String(cpOta.creado_en) : p.creadoEn,
            };
          } else if (oVinc.tarjetaMetadata?.creado_por || oVinc.enviadoNombre) {
            p.creadoPor = {
              usuarioId: null,
              nombre: String(oVinc.tarjetaMetadata?.creado_por || oVinc.enviadoNombre),
              correo: null,
              origen: String(oVinc.origenTipo || p.tipoOrigen || "MANUAL_ADMIN"),
              creadoEn: p.creadoEn,
            };
          }
        }
        const msgVinc = String(oVinc.dedicatoria ?? p.tarjeta?.mensaje ?? primerDed?.mensaje ?? "");
        p.tarjeta = {
          token: String(oVinc.tarjetaToken || p.tarjeta?.token || p.tokenAprobacion || p.id),
          tipo:
            oVinc.tarjetaTipo === "CONDOLENCIAS_PLANA" ||
            oVinc.tarjetaTipo === "SOLO_DIGITAL" ||
            oVinc.tarjetaTipo === "DIPTICO"
              ? oVinc.tarjetaTipo
              : p.tarjeta?.tipo || tipoInferido,
          mensaje: msgVinc,
          para: String(
            oVinc.destinatarioFallecido ||
              p.tarjeta?.para ||
              primerDed?.para ||
              p.logistica.destinatarioNombre ||
              ""
          ),
          de: String(
            oVinc.clienteSolicita || p.tarjeta?.de || primerDed?.de || p.compradorNombre || ""
          ),
          musicaUrl: oVinc.tarjetaMusicaUrl
            ? String(oVinc.tarjetaMusicaUrl)
            : p.tarjeta?.musicaUrl ?? null,
          musicaTitulo: oVinc.tarjetaMusicaTitulo
            ? String(oVinc.tarjetaMusicaTitulo)
            : p.tarjeta?.musicaTitulo ?? null,
          lyrics:
            Array.isArray(oVinc.tarjetaLyrics) && oVinc.tarjetaLyrics.length > 0
              ? oVinc.tarjetaLyrics
              : p.tarjeta?.lyrics ?? [],
          metadata:
            oVinc.tarjetaMetadata &&
            typeof oVinc.tarjetaMetadata === "object" &&
            Object.keys(oVinc.tarjetaMetadata).length > 0
              ? oVinc.tarjetaMetadata
              : p.tarjeta?.metadata ?? {},
        };
      } else if (!p.tarjeta) {
        p.tarjeta = {
          token: String(p.tokenAprobacion || p.id),
          tipo: tipoInferido,
          mensaje: String(primerDed?.mensaje || ""),
          para: String(primerDed?.para || p.logistica.destinatarioNombre || ""),
          de: String(primerDed?.de || p.compradorNombre || ""),
          musicaUrl: null,
          musicaTitulo: null,
          lyrics: [],
          metadata: { origen: "AUTOMATICO_SISTEMA", vistas_cliente: 0, impresiones: 0 },
        };
      } else {
        p.tarjeta = {
          ...p.tarjeta,
          mensaje: p.tarjeta.mensaje || String(primerDed?.mensaje || ""),
          para: p.tarjeta.para || String(primerDed?.para || p.logistica.destinatarioNombre || ""),
          de: p.tarjeta.de || String(primerDed?.de || p.compradorNombre || ""),
        };
      }
    }

    for (const o of ordenesTallerExtra) {
      if (o.proformaId && idsProformaPresentes.has(String(o.proformaId))) {
        continue;
      }
      if (o.entregaId) {
        idsEntregaCubiertos.add(String(o.entregaId));
      }
      const codUpper = String(o.codigo || "").toUpperCase();
      if (codUpper && codigosPresentes.has(codUpper)) {
        continue;
      }

      const esExeq = String(o.origenTipo || "").toUpperCase() === "EXEQUIALES_LLAMADA";
      const estTaller = String(o.estadoTaller || "").toUpperCase();
      const estPagoRaw = String(o.estadoPago || "").toUpperCase().trim();
      const estadoMapeado =
        estPagoRaw === "NUEVO_POR_CONFIRMAR"
          ? "NUEVO_POR_CONFIRMAR"
          : estTaller === "ENTREGADO"
            ? "ENTREGADO"
            : estTaller === "LISTO_ENTREGA"
              ? "EN_RUTA"
              : estTaller === "EN_PREPARACION" || estTaller === "ENVIADO_TALLER"
                ? "EN_PREPARACION"
                : estTaller === "ANULADO"
                  ? "CANCELADO"
                  : estPagoRaw && clavesEstadosConfig.has(estPagoRaw)
                    ? estPagoRaw
                    : "ORDEN_CONFIRMADA";

      const itemsOta = Array.isArray(o.items) && o.items.length > 0
        ? o.items
        : [{ descripcion: String(o.productoResumen || "Arreglo floral"), cantidad: 1 }];

      const totalOta = Number(o.totalUsd ?? 0);
      const codigoOta = String(o.codigo || "PEDIDO");
      codigosPresentes.add(codigoOta.toUpperCase());

      const clasifOta = inferirClasificacionPedido({
        clasificacionExplicita: o.clasificacionPedido ? String(o.clasificacionPedido) : null,
        origenTipo: o.origenTipo ? String(o.origenTipo) : null,
        retiroEnLocal: Boolean(o.retiroEnLocal),
        salaServicio: o.salaServicio ? String(o.salaServicio) : null,
        productoResumen: o.productoResumen ? String(o.productoResumen) : null,
        ubicacionEntrega: o.ubicacionEntrega ? String(o.ubicacionEntrega) : null,
        metodoPago: o.metodoPago ? String(o.metodoPago) : null,
        items: itemsOta,
      });

      const esClasifExeq = clasifOta === "EXEQUIALES" || esExeq;
      const confirmadaOta =
        estTaller === "ENTREGADO" ||
        Boolean(o.evidenciaFotoUrl) ||
        (o.estadoEvidencia && o.estadoEvidencia !== "PROGRAMADA" && o.estadoEvidencia !== "ANULADA");

      pedidos.push({
        id: String(o.id),
        secuencial: 0,
        codigoOrden: codigoOta,
        tipoOrigen: esExeq ? "EXEQUIALES_LLAMADA" : String(o.origenTipo || "MANUAL_ADMIN"),
        clasificacionPedido: clasifOta,
        exequiales: esClasifExeq
          ? {
              salaServicio: o.salaServicio ? String(o.salaServicio) : null,
              quienSolicita: String(o.clienteSolicita || "Exequiales IESS"),
              nombreFallecido: String(o.destinatarioFallecido || ""),
              horaServicio: String(o.horaEspecifica || o.franjaHoraria || ""),
              numeroInforme: o.numeroInforme ? String(o.numeroInforme) : null,
              estadoEvidencia: o.estadoEvidencia ? String(o.estadoEvidencia) : null,
            }
          : undefined,
        evidenciaEntrega: confirmadaOta
          ? {
              confirmada: true,
              entregaId: o.entregaId ? String(o.entregaId) : null,
              codigoOt: codigoOta,
              fotoUrl: o.evidenciaFotoUrl ? String(o.evidenciaFotoUrl) : null,
              mapaUrl: o.evidenciaMapaUrl ? String(o.evidenciaMapaUrl) : null,
              capturadoEn: o.entregadoEn ? String(o.entregadoEn) : null,
              entregadorNombre: o.entregadoPorNombre ? String(o.entregadoPorNombre) : null,
              latitud: o.evidenciaLatitud != null ? Number(o.evidenciaLatitud) : null,
              longitud: o.evidenciaLongitud != null ? Number(o.evidenciaLongitud) : null,
              direccionGps: o.evidenciaDireccionGps ? String(o.evidenciaDireccionGps) : null,
              salaServicio: o.salaServicio ? String(o.salaServicio) : null,
              observaciones: o.observaciones ? String(o.observaciones) : null,
              numeroInforme: o.numeroInforme ? String(o.numeroInforme) : null,
            }
          : null,
        grupoProformaId: String(o.id),
        versionNumero: 1,
        esOriginal: true,
        vigenciaDias: 15,
        descuento: 0,
        montoAbonadoUsd: 0,
        saldoPendienteUsd: esExeq ? 0 : totalOta,
        autorizaWhatsapp: false,
        negocio: negNorm,
        estado: estadoMapeado,
        metodoPago: esExeq ? "convenio iess" : String(o.metodoPago || "manual"),
        compradorNombre: String(o.clienteSolicita || "Cliente"),
        compradorIdentificacion: "",
        compradorCorreo: "",
        compradorTelefono: String(o.clienteTelefono || ""),
        subtotal: totalOta,
        iva: 0,
        costoEnvio: 0,
        recargoHorarioExacto: 0,
        total: totalOta,
        creadoEn: String(o.fechaPedido || new Date().toISOString()),
        logistica: {
          modalidadEntrega: "unificada",
          retiroEnLocal: Boolean(o.retiroEnLocal),
          destinatarioNombre: String(o.destinatarioFallecido || o.clienteSolicita || ""),
          destinatarioTelefono: String(o.clienteTelefono || ""),
          direccion: String(
            esExeq
              ? [o.ubicacionEntrega || "Exequiales del IESS", o.salaServicio]
                  .filter(Boolean)
                  .join(" · ")
              : o.ubicacionEntrega || ""
          ),
          referencia: o.observaciones ? String(o.observaciones) : "",
          fechaEntrega: String(o.fechaEntrega || ""),
          franjaHoraria: String(o.franjaHoraria || ""),
          horaExacta: o.horaEspecifica ? String(o.horaEspecifica) : undefined,
          enlaceMapa: o.enlaceMapa ? String(o.enlaceMapa) : undefined,
          zonaDetectada: esExeq
            ? String(o.salaServicio || "Exequiales IESS")
            : String(o.ubicacionEntrega || "Pedido Manual"),
          formulaCalculoInterno: esExeq
            ? `🕯️ Convenio Exequiales${o.salaServicio ? ` · ${o.salaServicio}` : ""}${
                o.destinatarioFallecido ? ` · Fallecido: ${o.destinatarioFallecido}` : ""
              }`
            : `📝 Pedido manual${o.observaciones ? ` · ${o.observaciones}` : ""}`,
          detalleDireccionGeo: null,
        },
        items: itemsOta.map((it: any, idx: number) => ({
          descripcion: String(it.descripcion || it.producto_nombre || o.productoResumen || "Arreglo"),
          varianteNombre: it.sku ? String(it.sku) : "",
          cantidad: Number(it.cantidad ?? 1),
          precioUnitario: Number(it.precioUnitario ?? it.pvp_unitario ?? (idx === 0 ? totalOta : 0)),
          impuesto: "IVA_0",
          totalLinea:
            Number(it.precioUnitario ?? it.pvp_unitario ?? (idx === 0 ? totalOta : 0)) *
            Number(it.cantidad ?? 1),
          dedicatoria:
            idx === 0 && o.dedicatoria
              ? {
                  para: String(o.destinatarioFallecido || ""),
                  de: String(o.clienteSolicita || ""),
                  mensaje: String(o.dedicatoria),
                }
              : undefined,
        })),
        comprobanteTransferencia: (() => {
          const detO =
            (o.detalleOrden && typeof o.detalleOrden === "object"
              ? o.detalleOrden
              : o.detalle && typeof o.detalle === "object"
                ? o.detalle
                : {}) as Record<string, any>;
          const comp = detO.comprobante_transferencia || detO.evidencias?.comprobante_pago;
          if (!comp || typeof comp !== "object" || !comp.url) return null;
          return {
            url: String(comp.url),
            nombreArchivo: String(comp.nombre_archivo || comp.nombreArchivo || "comprobante"),
            mimeType: String(comp.mime_type || comp.mimeType || "image/jpeg"),
            subidoEn: comp.subido_en ? String(comp.subido_en) : undefined,
            referenciaOpcional: comp.referencia_opcional ? String(comp.referencia_opcional) : undefined,
            subidoPorNombre: comp.subido_por_nombre ? String(comp.subido_por_nombre) : null,
          };
        })(),
        respuestaPlux: (() => {
          const detO =
            (o.detalleOrden && typeof o.detalleOrden === "object"
              ? o.detalleOrden
              : o.detalle && typeof o.detalle === "object"
                ? o.detalle
                : {}) as Record<string, any>;
          const plx = detO.ultimo_pago_plux || detO.evidencias?.respuesta_plux;
          if (!plx || typeof plx !== "object") return null;
          return {
            pagoId: plx.pago_id ? String(plx.pago_id) : null,
            identificador: plx.identificador ? String(plx.identificador) : null,
            autorizacion: plx.autorizacion ? String(plx.autorizacion) : null,
            marcaTarjeta: plx.marca_tarjeta ? String(plx.marca_tarjeta) : null,
            ultimosDigitos: plx.ultimos_digitos ? String(plx.ultimos_digitos) : null,
            montoUsd: plx.monto_usd != null ? Number(plx.monto_usd) : null,
            modalidadCobro: plx.modalidad_cobro ? String(plx.modalidad_cobro) : null,
            estado: plx.estado ? String(plx.estado) : "APROBADO",
            confirmadoEn: plx.confirmado_en ? String(plx.confirmado_en) : null,
            respuestaRaw: plx.respuesta_raw ?? null,
          };
        })(),
        creadoPor: (() => {
          const detO =
            (o.detalleOrden && typeof o.detalleOrden === "object"
              ? o.detalleOrden
              : o.detalle && typeof o.detalle === "object"
                ? o.detalle
                : {}) as Record<string, any>;
          const cp = detO.creado_por;
          if (cp && typeof cp === "object" && (cp.nombre || cp.correo)) {
            return {
              usuarioId: cp.usuario_id ? String(cp.usuario_id) : null,
              nombre: String(cp.nombre || cp.correo),
              correo: cp.correo ? String(cp.correo) : null,
              origen: cp.origen ? String(cp.origen) : String(o.origenTipo || "MANUAL_ADMIN"),
              creadoEn: cp.creado_en ? String(cp.creado_en) : String(o.fechaPedido || ""),
            };
          }
          if (o.tarjetaMetadata?.creado_por || o.enviadoNombre) {
            return {
              usuarioId: null,
              nombre: String(o.tarjetaMetadata?.creado_por || o.enviadoNombre),
              correo: null,
              origen: String(o.origenTipo || "MANUAL_ADMIN"),
              creadoEn: String(o.fechaPedido || ""),
            };
          }
          return null;
        })(),
        ordenTallerId: String(o.id),
        entregaId: o.entregaId ? String(o.entregaId) : null,
        salaServicio: o.salaServicio ? String(o.salaServicio) : null,
        tarjeta: {
          token: String(o.tarjetaToken || o.id),
          tipo:
            o.tarjetaTipo === "CONDOLENCIAS_PLANA" ||
            o.tarjetaTipo === "SOLO_DIGITAL" ||
            o.tarjetaTipo === "DIPTICO"
              ? o.tarjetaTipo
              : esExeq
                ? "CONDOLENCIAS_PLANA"
                : "DIPTICO",
          mensaje: String(o.dedicatoria || ""),
          para: String(o.destinatarioFallecido || ""),
          de: String(o.clienteSolicita || ""),
          musicaUrl: o.tarjetaMusicaUrl ? String(o.tarjetaMusicaUrl) : null,
          musicaTitulo: o.tarjetaMusicaTitulo ? String(o.tarjetaMusicaTitulo) : null,
          lyrics: Array.isArray(o.tarjetaLyrics) ? o.tarjetaLyrics : [],
          metadata:
            o.tarjetaMetadata && typeof o.tarjetaMetadata === "object"
              ? o.tarjetaMetadata
              : {},
        },
      });
    }

    // Respaldo adicional: Todas las evidencias de entrega (Exequiales y Tienda) en com_entrega_evidencia
    const resEntExtra = await dbLectura
      .schema("comun_comercio")
      .from("com_entrega_evidencia")
      .select("*")
      .eq("ent_negocio", negNorm)
      .is("ent_eliminado_en", null)
      .order("ent_creado_en", { ascending: false })
      .limit(500);

    for (const e of resEntExtra.data ?? []) {
      if (e.ent_estado === "ANULADA") continue;
      const entId = String(e.ent_id);

      if (e.ent_tipo_origen === "PEDIDO_TIENDA" && e.ent_proforma_id) {
        const pedExistente = pedidos.find((p) => p.id === String(e.ent_proforma_id));
        if (pedExistente && (!pedExistente.evidenciaEntrega || !pedExistente.evidenciaEntrega.fotoUrl)) {
          pedExistente.evidenciaEntrega = {
            confirmada: true,
            entregaId: entId,
            codigoOt: e.ent_codigo_ot ? String(e.ent_codigo_ot) : null,
            fotoUrl: e.ent_foto_url ? String(e.ent_foto_url) : null,
            mapaUrl: e.ent_mapa_url ? String(e.ent_mapa_url) : null,
            capturadoEn: e.ent_capturado_en ? String(e.ent_capturado_en) : null,
            entregadorNombre: e.ent_entregador_nombre ? String(e.ent_entregador_nombre) : null,
            latitud: e.ent_latitud != null ? Number(e.ent_latitud) : null,
            longitud: e.ent_longitud != null ? Number(e.ent_longitud) : null,
            direccionGps: e.ent_direccion_gps ? String(e.ent_direccion_gps) : null,
            salaServicio: e.ent_sala_servicio ? String(e.ent_sala_servicio) : null,
            observaciones: e.ent_observaciones ? String(e.ent_observaciones) : null,
          };
        }
        continue;
      }

      if (e.ent_tipo_origen !== "ORDEN_TRABAJO_CONVENIO") continue;
      if (idsEntregaCubiertos.has(entId)) continue;
      const codOt = String(
        e.ent_codigo_ot || `OT-${String(e.ent_secuencial ?? 1).padStart(4, "0")}`
      );
      if (codigosPresentes.has(codOt.toUpperCase())) continue;
      codigosPresentes.add(codOt.toUpperCase());
      const detEnt = (e.ent_detalle_entrega ?? {}) as Record<string, any>;
      const sala = e.ent_sala_servicio || detEnt.sala_servicio || "";
      const confirmadaOt = e.ent_estado !== "PROGRAMADA";

      pedidos.push({
        id: entId,
        secuencial: Number(e.ent_secuencial ?? 0),
        codigoOrden: codOt,
        tipoOrigen: "EXEQUIALES_LLAMADA",
        clasificacionPedido: "EXEQUIALES",
        exequiales: {
          salaServicio: sala || null,
          quienSolicita: String(
            e.ent_coordinador_nombre || detEnt.quien_solicita || "Exequiales IESS"
          ),
          nombreFallecido: String(e.ent_fallecido_destinatario || ""),
          horaServicio: String(e.ent_hora_solicitada || detEnt.hora_solicitada || ""),
          estadoEvidencia: e.ent_estado ? String(e.ent_estado) : null,
        },
        evidenciaEntrega: confirmadaOt
          ? {
              confirmada: true,
              entregaId: entId,
              codigoOt: codOt,
              fotoUrl: e.ent_foto_url ? String(e.ent_foto_url) : null,
              mapaUrl: e.ent_mapa_url ? String(e.ent_mapa_url) : null,
              capturadoEn: e.ent_capturado_en ? String(e.ent_capturado_en) : null,
              entregadorNombre: e.ent_entregador_nombre ? String(e.ent_entregador_nombre) : null,
              latitud: e.ent_latitud != null ? Number(e.ent_latitud) : null,
              longitud: e.ent_longitud != null ? Number(e.ent_longitud) : null,
              direccionGps: e.ent_direccion_gps ? String(e.ent_direccion_gps) : null,
              salaServicio: sala || null,
              observaciones: e.ent_observaciones ? String(e.ent_observaciones) : null,
            }
          : null,
        grupoProformaId: entId,
        versionNumero: 1,
        esOriginal: true,
        vigenciaDias: 15,
        descuento: 0,
        montoAbonadoUsd: 0,
        saldoPendienteUsd: 0,
        autorizaWhatsapp: false,
        negocio: negNorm,
        estado: e.ent_estado === "PROGRAMADA" ? "EN_PREPARACION" : "ENTREGADO",
        metodoPago: "convenio iess",
        compradorNombre: String(
          e.ent_coordinador_nombre || detEnt.quien_solicita || "Exequiales IESS"
        ),
        compradorIdentificacion: "",
        compradorCorreo: "",
        compradorTelefono: "",
        subtotal: 0,
        iva: 0,
        costoEnvio: 0,
        recargoHorarioExacto: 0,
        total: 0,
        creadoEn: String(e.ent_creado_en),
        logistica: {
          modalidadEntrega: "unificada",
          retiroEnLocal: false,
          destinatarioNombre: String(e.ent_fallecido_destinatario || ""),
          destinatarioTelefono: "",
          direccion: [e.ent_ubicacion_nombre || "Exequiales del IESS", sala]
            .filter(Boolean)
            .join(" · "),
          referencia: String(e.ent_observaciones || ""),
          fechaEntrega: String(e.ent_fecha_servicio || "").slice(0, 10),
          franjaHoraria: /^([abc]\)|\d{2}:\d{2}\s*-)/i.test(
            String(e.ent_hora_solicitada || detEnt.hora_solicitada || "").trim()
          )
            ? String(e.ent_hora_solicitada || detEnt.hora_solicitada || "").trim()
            : "",
          horaExacta:
            String(e.ent_hora_solicitada || detEnt.hora_solicitada || "").trim() &&
            !/^([abc]\)|\d{2}:\d{2}\s*-)/i.test(
              String(e.ent_hora_solicitada || detEnt.hora_solicitada || "").trim()
            )
              ? String(e.ent_hora_solicitada || detEnt.hora_solicitada || "").trim()
              : undefined,
          zonaDetectada: String(sala || "Exequiales IESS"),
          formulaCalculoInterno: `🕯️ Convenio Exequiales${sala ? ` · ${sala}` : ""}${
            e.ent_fallecido_destinatario ? ` · Fallecido: ${e.ent_fallecido_destinatario}` : ""
          }`,
          detalleDireccionGeo: null,
        },
        items: [
          {
            descripcion: String(e.ent_descripcion_servicio || "Set condolencias (3 arreglos)"),
            varianteNombre: "",
            cantidad: 1,
            precioUnitario: 0,
            impuesto: "IVA_0",
            totalLinea: 0,
          },
        ],
        comprobanteTransferencia: null,
        respuestaPlux: null,
        creadoPor: detEnt.creado_por && typeof detEnt.creado_por === "object"
          ? {
              usuarioId: detEnt.creado_por.usuario_id ? String(detEnt.creado_por.usuario_id) : null,
              nombre: String(detEnt.creado_por.nombre || detEnt.creado_por.correo || "Operador"),
              correo: detEnt.creado_por.correo ? String(detEnt.creado_por.correo) : null,
              origen: String(detEnt.creado_por.origen || "EXEQUIALES_LLAMADA"),
              creadoEn: String(detEnt.creado_por.creado_en || e.ent_creado_en || ""),
            }
          : e.ent_coordinador_nombre
            ? {
                usuarioId: null,
                nombre: String(e.ent_coordinador_nombre),
                correo: null,
                origen: "EXEQUIALES_LLAMADA",
                creadoEn: String(e.ent_creado_en || ""),
              }
            : null,
        ordenTallerId: e.ent_orden_taller_id ? String(e.ent_orden_taller_id) : null,
        entregaId: entId,
        salaServicio: sala || null,
        tarjeta: {
          token: String(detEnt.tarjeta?.token || entId),
          tipo:
            detEnt.tarjeta?.tipo === "DIPTICO" ||
            detEnt.tarjeta?.tipo === "SOLO_DIGITAL" ||
            detEnt.tarjeta?.tipo === "CONDOLENCIAS_PLANA"
              ? detEnt.tarjeta.tipo
              : "CONDOLENCIAS_PLANA",
          mensaje: String(detEnt.tarjeta?.mensaje ?? detEnt.dedicatoria ?? ""),
          para: String(detEnt.tarjeta?.para ?? e.ent_fallecido_destinatario ?? ""),
          de: String(
            detEnt.tarjeta?.de ??
              e.ent_coordinador_nombre ??
              detEnt.quien_solicita ??
              "Exequiales IESS"
          ),
          musicaUrl: detEnt.tarjeta?.musica_url || detEnt.tarjeta?.musicaUrl || null,
          musicaTitulo: detEnt.tarjeta?.musica_titulo || detEnt.tarjeta?.musicaTitulo || null,
          lyrics: Array.isArray(detEnt.tarjeta?.lyrics) ? detEnt.tarjeta.lyrics : [],
          metadata:
            detEnt.tarjeta?.metadata && typeof detEnt.tarjeta.metadata === "object"
              ? detEnt.tarjeta.metadata
              : { origen: "AUTOMATICO_SISTEMA", vistas_cliente: 0, impresiones: 0 },
        },
      });
    }

    pedidos.sort(
      (a, b) => new Date(b.creadoEn).getTime() - new Date(a.creadoEn).getTime()
    );
  } catch {
    // Si falla la unión opcional de órdenes de taller, conservar los pedidos de com_proforma
  }

  for (const p of pedidos) {
    const tokVista = String(p.tarjeta?.token || p.tokenAprobacion || p.id);
    const esCondol =
      p.tarjeta?.tipo === "CONDOLENCIAS_PLANA" || p.tipoOrigen === "EXEQUIALES_LLAMADA";
    if (p.tarjeta) {
      p.tarjeta.token = tokVista;
      p.tarjeta.tokenEdicion = generarTokenEdicionTarjetaServidor(tokVista);
      p.tarjeta.diseno = p.tarjeta.diseno ?? p.tarjeta.metadata?.diseno;
      p.tarjeta.confidencial = esCondol
        ? false
        : Boolean(p.tarjeta.confidencial ?? p.tarjeta.metadata?.confidencial_solo_qr);
      if (esCondol) {
        p.tarjeta.tipo = "CONDOLENCIAS_PLANA";
        p.tarjeta.musicaUrl = null;
        p.tarjeta.musicaTitulo = null;
        p.tarjeta.lyrics = [];
      }
    }
  }

  return {
    ok: true,
    pedidos,
    esAdminEstricto,
    puedeEliminarLogico,
    pedidosEliminados: esAdminEstricto ? pedidosEliminados : [],
    estadosConfig,
  };
}

export async function actualizarEstadoPedidoTiendaAction(
  negocio: string,
  pedidoId: string,
  nuevoEstado: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const estadosConfig = await leerEstadosPedidosConfig(negNorm, supabase);
  const estadosPermitidos = new Set([
    ...estadosConfig.map((e) => e.valor),
    "NUEVO_POR_CONFIRMAR",
    "NUEVO_CONFIRMADO",
    "ENVIADA",
    "PENDIENTE_PAGO",
    "ORDEN_CONFIRMADA",
    "RESERVADA_70",
    "APROBADA",
    "NO_ACEPTADA",
    "EN_PREPARACION",
    "EN_RUTA",
    "ENTREGADO",
    "CANCELADO",
  ]);
  if (!estadosPermitidos.has(nuevoEstado)) {
    return { ok: false, error: "Estado de pedido no válido" };
  }

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No autenticado" };
  }

  if (nuevoEstado === "EN_PREPARACION") {
    try {
      const resRol = await (supabase.schema("comun_seguridad") as any).rpc(
        "seg_fn_obtener_rol_operativo_negocio",
        { p_negocio: negNorm }
      );
      const rolOp = String(resRol?.data || "").toUpperCase();
      if (!["SUPERADMIN", "ADMINISTRADOR", "OPERADOR"].includes(rolOp)) {
        return {
          ok: false,
          error: "Solo un Administrador u Operador puede pasar pedidos a Taller.",
        };
      }
    } catch {
      // Continuar si la RPC no está disponible
    }
  }

  const db: any = crearClienteAdmin() ?? supabase;
  let codigoOrden = "";
  let compradorNombre = "";
  let clienteUsuarioId: string | null = null;
  let repartidorAsignadoId: string | null = null;

  // 1. Intentar primero vía RPC transaccional SECURITY DEFINER (sincroniza com_proforma + com_orden_taller sin depender de service_role)
  const { data: rpcUpd, error: rpcErr } = await (supabase as any)
    .schema("comun_comercio")
    .rpc("com_fn_actualizar_estado_pedido_tienda", {
      p_negocio: negNorm,
      p_pedido_id: pedidoId,
      p_nuevo_estado: nuevoEstado,
    });

  if (!rpcErr && rpcUpd && rpcUpd.ok) {
    codigoOrden = String(rpcUpd.codigoOrden || "");
    compradorNombre = String(rpcUpd.compradorNombre || "");
    clienteUsuarioId = rpcUpd.clienteUsuarioId ? String(rpcUpd.clienteUsuarioId) : null;
    repartidorAsignadoId = rpcUpd.repartidorAsignadoId ? String(rpcUpd.repartidorAsignadoId) : null;
  } else {
  // 2. Verificar si es una orden directa de Taller / Manual / Exequiales o estado personalizado aún no soportado en RPC
    const visibleEnTallerNuevo = esEstadoVisibleEnTaller(nuevoEstado, estadosConfig);
    const estadoTallerEquiv =
      nuevoEstado === "ENTREGADO"
        ? "ENTREGADO"
        : nuevoEstado === "EN_RUTA"
          ? "LISTO_ENTREGA"
          : nuevoEstado === "EN_PREPARACION"
            ? "EN_PREPARACION"
            : nuevoEstado === "CANCELADO" || nuevoEstado === "NO_ACEPTADA"
              ? "ANULADO"
              : visibleEnTallerNuevo
                ? "ENVIADO_TALLER"
                : "PENDIENTE_ENVIO";

    const { data: rpcTallerUpd, error: rpcTallerErr } = await (supabase as any)
      .schema("comun_comercio")
      .rpc("com_fn_actualizar_estado_taller", {
        p_negocio: negNorm,
        p_orden_id: pedidoId,
        p_nuevo_estado: estadoTallerEquiv,
        p_notas_taller: null,
      });

    if (!rpcTallerErr && rpcTallerUpd?.ok) {
      codigoOrden = String(rpcTallerUpd.codigo || "PEDIDO");
      compradorNombre = String(rpcTallerUpd.productoResumen || "Cliente");
      // Sincronizar también ota_estado_pago para conservar estados personalizados, NUEVO_POR_CONFIRMAR y NUEVO_CONFIRMADO
      try {
        await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({ ota_estado_pago: nuevoEstado, ota_actualizado_en: new Date().toISOString() })
          .eq("ota_id", pedidoId)
          .eq("ota_negocio", negNorm);
      } catch {
        // Opcional
      }
    } else if (
      !rpcErr &&
      rpcUpd &&
      rpcUpd.ok === false &&
      !String(rpcUpd.error || "").includes("no encontrado") &&
      !String(rpcUpd.error || "").includes("no válido")
    ) {
      return { ok: false, error: String(rpcUpd.error || "No se pudo actualizar el estado del pedido") };
    } else {
      // 3. Respaldo compatible sobre com_proforma verificando fila afectada (soporta estados personalizados)
      const { data: filasUpd, error } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_estado: nuevoEstado,
          prf_actualizado_en: new Date().toISOString(),
        })
        .eq("prf_id", pedidoId)
        .eq("prf_negocio", negNorm)
        .select("prf_id, prf_secuencial, prf_cliente_id, prf_cliente_nombre, prf_detalle_proforma");

      if (error) {
        return { ok: false, error: error.message };
      }
      if (!Array.isArray(filasUpd) || filasUpd.length === 0) {
        return {
          ok: false,
          error: "No se pudo encontrar ni actualizar el pedido seleccionado.",
        };
      }

      // Espejar también en com_orden_taller asociada según visibleEnTaller
      try {
        await db
          .schema("comun_comercio")
          .from("com_orden_taller")
          .update({
            ota_estado_pago: nuevoEstado,
            ota_estado_taller: estadoTallerEquiv,
            ota_actualizado_en: new Date().toISOString(),
          })
          .eq("ota_proforma_id", pedidoId)
          .eq("ota_negocio", negNorm)
          .is("ota_eliminado_en", null);
      } catch {
        // Opcional
      }

      const fila = filasUpd[0];
      const det = (fila?.prf_detalle_proforma ?? {}) as Record<string, any>;
      const prefijo =
        negNorm === "tinkay"
          ? "TNK"
          : negNorm === "margaritas"
          ? "MRG"
          : negNorm === "fastfix"
          ? "FFH"
          : "TRQ";
      codigoOrden = String(
        det.codigo_proforma ||
          det.codigo_orden ||
          `${prefijo}-ORD-${String(fila?.prf_secuencial || 1).padStart(4, "0")}`
      );
      compradorNombre = String(
        fila?.prf_cliente_nombre || det.comprador?.nombreCompleto || "Cliente"
      );
      clienteUsuarioId = fila?.prf_cliente_id ? String(fila.prf_cliente_id) : null;
    }
  }

  // 3. Emitir notificación Push + Campana + Realtime Broadcast a TODOS los roles con enlace directo al pedido
  const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
    "./notificaciones-pedidos-push"
  );
  await despacharPushCambioEstadoPedidoTodosLosRoles({
    supabase,
    negocio: negNorm,
    pedidoId,
    codigoOrden,
    nuevoEstado,
    compradorNombre,
    clienteUsuarioId,
    repartidorAsignadoId,
  });

  // 4. Si el equipo aprueba un pedido por Transferencia / QR DeUna, disparar Purchase en Meta Conversions API
  if (
    ["NUEVO_CONFIRMADO", "ORDEN_CONFIRMADA", "APROBADA", "RESERVADA_70", "EN_PREPARACION"].includes(
      nuevoEstado
    ) &&
    /^[0-9a-f-]{36}$/i.test(pedidoId)
  ) {
    try {
      const { data: filaPrfMeta } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_cliente_id, prf_total, prf_detalle_proforma")
        .eq("prf_id", pedidoId)
        .eq("prf_negocio", negNorm)
        .maybeSingle();

      const detMeta = (filaPrfMeta?.prf_detalle_proforma ?? {}) as Record<string, any>;
      const metodoPagoOrd = String(detMeta.metodo_pago || "").toLowerCase();
      if (
        filaPrfMeta &&
        !detMeta.meta_capi_purchase_enviado &&
        metodoPagoOrd !== "plux" &&
        metodoPagoOrd !== "payphone"
      ) {
        const { enviarEventoConversionMetaServidorAction } = await import(
          "./acciones-marketing-meta"
        );
        const itemsPrf: any[] = Array.isArray(detMeta.items) ? detMeta.items : [];
        const skus: string[] = [];
        const contents: Array<{ id: string; quantity: number; item_price?: number }> = [];
        for (const it of itemsPrf) {
          const sku = String(it?.variante_sku || it?.producto_id || "").trim();
          if (sku && Number(it?.precio_unitario ?? 1) > 0) {
            skus.push(sku);
            contents.push({
              id: sku,
              quantity: Math.max(1, Number(it?.cantidad) || 1),
              item_price: Number(it?.precio_unitario) || undefined,
            });
          }
        }
        const totalUsd = Number(detMeta.total_pagar ?? filaPrfMeta.prf_total ?? 0);
        const comp = (detMeta.comprador ?? {}) as Record<string, any>;
        const attr = (detMeta.atribucion_publicitaria ?? {}) as Record<string, any>;
        const resCapi = await enviarEventoConversionMetaServidorAction({
          negocio: negNorm,
          eventName: "Purchase",
          eventId: codigoOrden || filaPrfMeta.prf_id,
          eventSourceUrl: typeof attr.eventSourceUrl === "string" ? attr.eventSourceUrl : undefined,
          valorUsd: totalUsd,
          moneda: "USD",
          codigoOrden: codigoOrden || filaPrfMeta.prf_id,
          contentIds: skus,
          contents,
          comprador: {
            email: comp.correo || undefined,
            telefono: comp.telefono || comp.whatsapp || undefined,
            nombreCompleto: comp.nombreCompleto || compradorNombre,
            usuarioId: filaPrfMeta.prf_cliente_id || clienteUsuarioId || undefined,
          },
          atribucion: {
            fbc: typeof attr.fbc === "string" ? attr.fbc : undefined,
            fbp: typeof attr.fbp === "string" ? attr.fbp : undefined,
            ctwaClid: typeof attr.ctwaClid === "string" ? attr.ctwaClid : undefined,
          },
        });
        if (resCapi.ok) {
          await db
            .schema("comun_comercio")
            .from("com_proforma")
            .update({
              prf_detalle_proforma: {
                ...detMeta,
                meta_capi_purchase_enviado: true,
                meta_capi_purchase_en: new Date().toISOString(),
              },
            })
            .eq("prf_id", pedidoId)
            .catch(() => {});
        }
      }
    } catch {
      // No interrumpir cambio de estado operativo
    }
  }

  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/taller");
  revalidatePath("/panel/entregas");
  revalidatePath("/panel/envio-pedidos");
  revalidatePath("/panel/conversaciones");
  revalidatePath("/panel");
  return { ok: true };
}

// ============================================================================
// PROFORMAS DE EVENTOS EN AUTOSERVICIO (CPQ + RESERVA 70% / PAGO 100% PLUX)
// ============================================================================

export interface EntradaProformaEvento {
  negocio: string;
  comprador: {
    nombreCompleto: string;
    identificacion?: string;
    correo: string;
    whatsapp?: string;
    autorizaWhatsapp?: boolean;
  };
  evento: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  ubicacionEvento?: DestinoEntregaPedidoInput;
  items: ItemPedidoTiendaInput[];
  subtotalBaseImponible: number;
  descuentoTotal?: number;
  totalIva: number;
  totalFlete: number;
  totalPagar: number;
  vigenciaDias?: number;
  conversacionWebId?: string;
  atribucionPublicitaria?: {
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    utmContent?: string;
    fbclid?: string;
    fbc?: string;
    fbp?: string;
    intencionDetectada?: string;
    eventSourceUrl?: string;
  } | null;
}

export interface ProformaEventoPublica {
  id: string;
  secuencial: number;
  codigoProforma: string;
  clienteId?: string | null;
  grupoProformaId?: string;
  versionNumero?: number;
  esOriginal?: boolean;
  etiquetaVersion?: string;
  notaAsesor?: string;
  asesorNombre?: string;
  negocio: string;
  estado: string;
  vigenciaDias: number;
  tokenAprobacion: string;
  creadoEn: string;
  comprador: {
    nombreCompleto: string;
    identificacion: string;
    correo: string;
    whatsapp: string;
    autorizaWhatsapp: boolean;
  };
  evento: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  ubicacion: {
    retiroEnLocal: boolean;
    direccion: string;
    referencia: string;
    zonaDetectada?: string;
    distanciaVialKm?: number;
    enlaceMapa?: string;
  };
  subtotal: number;
  descuento: number;
  baseIva0: number;
  baseIvaGravada: number;
  iva: number;
  flete: number;
  total: number;
  montoReserva70Usd: number;
  montoAbonadoUsd: number;
  saldoPendienteUsd: number;
  ultimoPagoPlux?: {
    identificador: string;
    autorizacion: string;
    marca?: string;
    ultimosDigitos?: string;
    montoUsd: number;
    confirmadoEn?: string;
  } | null;
  items: Array<{
    descripcion: string;
    varianteNombre?: string;
    cantidad: number;
    precioUnitario: number;
    impuesto: string;
    totalLinea: number;
    imagen?: string;
  }>;
}

export interface ResumenMiProformaEvento {
  id: string;
  secuencial: number;
  codigo: string;
  grupoProformaId?: string;
  versionNumero?: number;
  esOriginal?: boolean;
  etiquetaVersion?: string;
  tipoOrigen: string;
  estado: string;
  total: number;
  vigenciaDias: number;
  tokenAprobacion: string;
  tipoEvento?: string;
  fechaEvento?: string;
  montoAbonadoUsd: number;
  saldoPendienteUsd: number;
  bloqueadaPorPagoGrupo?: boolean;
  creadoEn: string;
  metodoPago?: string;
  destinatarioNombre?: string;
  fechaEntrega?: string;
  franjaHoraria?: string;
  direccionEntrega?: string;
  itemsResumen?: Array<{
    nombre: string;
    variante?: string;
    cantidad: number;
    subtotal: number;
  }>;
}

export interface EntradaVariacionProformaAsesor {
  proformaBaseId: string;
  negocio: string;
  etiquetaVersion?: string;
  notaAsesor?: string;
  vigenciaDias?: number;
  descuentoTotal?: number;
  costoEnvio?: number;
  evento: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  direccionEvento?: string;
  referenciaEvento?: string;
  items: Array<{
    descripcion: string;
    varianteNombre?: string;
    cantidad: number;
    precioUnitario: number;
    tarifaIva: number;
    imagen?: string;
  }>;
}

const esquemaProformaEvento = z.object({
  negocio: z.string().min(1),
  comprador: z
    .object({
      nombreCompleto: z.string().trim().min(2, "Indica tu nombre completo o empresa"),
      identificacion: z.string().trim().optional(),
      correo: z.string().trim().email("Ingresa un correo electrónico válido para recibir tu proforma"),
      whatsapp: z
        .string()
        .trim()
        .optional()
        .default("")
        .refine((v) => v.length === 0 || v.length >= 7, {
          message: "Ingresa un número de WhatsApp válido o déjalo vacío para recibir solo por correo",
        }),
      autorizaWhatsapp: z.boolean().optional().default(false),
    })
    .superRefine((c, ctx) => {
      if (c.whatsapp.trim().length > 0 && !c.autorizaWhatsapp) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["autorizaWhatsapp"],
          message:
            "Autoriza el contacto por WhatsApp o deja el número vacío para recibir la proforma en tu correo",
        });
      }
    }),
  evento: z.object({
    tipoEvento: z.string().trim().min(2, "Selecciona el tipo de evento"),
    fechaEvento: z.string().trim().min(4, "Indica la fecha tentativa del evento"),
    horaEvento: z.string().optional(),
    invitadosEstimados: z.number().int().min(1).max(10000).optional(),
    paletaColores: z.string().optional(),
    notasEvento: z.string().optional(),
  }),
  subtotalBaseImponible: z.number().min(0),
  descuentoTotal: z.number().min(0).optional(),
  totalIva: z.number().min(0),
  totalFlete: z.number().min(0),
  totalPagar: z.number().positive("La proforma debe tener un importe mayor a cero"),
  vigenciaDias: z.number().int().min(1).max(90).optional(),
  conversacionWebId: z.string().optional(),
  items: z.array(z.any()).min(1, "Agrega al menos un elemento de evento a la proforma"),
});

/**
 * Genera una proforma formal numerada en autoservicio (`TNK-PRF-xxxx`) para un evento,
 * con enlace compartible por token, reserva sugerida del 70% y sincronización de WhatsApp LOPDP.
 */
export async function generarProformaEventoAction(
  entrada: EntradaProformaEvento
): Promise<
  | {
      ok: true;
      id: string;
      codigoProforma: string;
      tokenAprobacion: string;
    }
  | { ok: false; error: string }
> {
  const validacion = esquemaProformaEvento.safeParse(entrada);
  if (!validacion.success) {
    return {
      ok: false,
      error: validacion.error.issues[0]?.message ?? "Completa los datos requeridos de la proforma",
    };
  }

  const negNorm = entrada.negocio.trim().toLowerCase();
  const config = await obtenerConfiguracionLogisticaAction(negNorm);

  const algunConDeliveryIncluido = entrada.items.some(
    (it) => it.deliveryIncluidoProducto !== false
  );
  const recargoProductosTotal = entrada.items.reduce(
    (acc, it) => acc + (Number(it.recargoLogisticoUsd) || 0) * (Number(it.cantidad) || 1),
    0
  );

  const itemsEnriquecidos = entrada.items.map((it: any) => {
    const totalLinea = Math.round(Number(it.pvpUnitario) * Number(it.cantidad) * 100) / 100;
    return {
      producto_id: it.productoId,
      descripcion:
        it.varianteNombre && it.varianteNombre.trim() !== it.productoNombre.trim()
          ? `${it.productoNombre} (${it.varianteNombre})`
          : it.productoNombre,
      producto_nombre: it.productoNombre,
      variante_sku: it.varianteSku,
      variante_nombre: it.varianteNombre,
      cantidad: Number(it.cantidad) || 1,
      precio_unitario: Number(it.pvpUnitario) || 0,
      impuesto: (Number(it.tarifaIva) || 0) > 0 ? `IVA_${it.tarifaIva}` : "IVA_0",
      total_linea: totalLinea,
      imagen: it.imagen || null,
    };
  });

  let ubicacionConGeo = entrada.ubicacionEvento;
  if (
    ubicacionConGeo &&
    !ubicacionConGeo.retiroEnLocal &&
    !ubicacionConGeo.detalleDireccionGeo &&
    esCoordenadaValida(Number(ubicacionConGeo.lat), Number(ubicacionConGeo.lng))
  ) {
    const geoResuelta = await geocodificarInversoCoordenadas({
      lat: Number(ubicacionConGeo.lat),
      lng: Number(ubicacionConGeo.lng),
    });
    if (geoResuelta) {
      ubicacionConGeo = {
        ...ubicacionConGeo,
        detalleDireccionGeo: geoResuelta,
        direccion: ubicacionConGeo.direccion || geoResuelta.resumenDireccion,
      };
    }
  }

  const whatsappNormalizado = (entrada.comprador.whatsapp || "").trim();
  const tieneWhatsappProporcionado = whatsappNormalizado.length >= 7;
  const autorizaWhatsappFinal = tieneWhatsappProporcionado
    ? Boolean(entrada.comprador.autorizaWhatsapp ?? true)
    : false;

  const logisticaEvento = ubicacionConGeo
    ? enriquecerDestinoConAuditoriaInterna(
        ubicacionConGeo,
        config,
        algunConDeliveryIncluido,
        recargoProductosTotal
      )
    : {
        retiro_en_local: false,
        destinatario_nombre: entrada.comprador.nombreCompleto,
        destinatario_telefono: whatsappNormalizado,
        direccion: "Por confirmar locación exacta del evento",
        referencia: "",
        fecha_entrega: entrada.evento.fechaEvento,
        franja_horaria: entrada.evento.horaEvento || "evento",
        costo_envio_usd: entrada.totalFlete,
        formula_calculo_interno: "Cotización preliminar de evento (locación por confirmar).",
      };

  const totalCentavos = Math.round(entrada.totalPagar * 100);
  const ivaCentavos = Math.round(entrada.totalIva * 100);
  const baseTotalCentavos = Math.max(0, totalCentavos - ivaCentavos);
  const baseItemsGravadosCentavos = entrada.items.reduce((acc, it) => {
    if ((Number(it.tarifaIva) || 0) > 0) {
      return acc + Math.round(Number(it.pvpUnitario) * Number(it.cantidad) * 100);
    }
    return acc;
  }, 0);
  const baseIvaGravadaCentavos =
    ivaCentavos > 0
      ? Math.min(
          baseTotalCentavos,
          baseItemsGravadosCentavos > 0
            ? baseItemsGravadosCentavos
            : Math.round((ivaCentavos * 100) / 15)
        )
      : 0;
  const baseIva0Centavos = Math.max(0, baseTotalCentavos - baseIvaGravadaCentavos);
  const vigenciaDias = entrada.vigenciaDias ?? 15;
  const montoReserva70Usd = Math.round(entrada.totalPagar * 0.7 * 100) / 100;

  const compradorPayload = {
    nombreCompleto: entrada.comprador.nombreCompleto.trim(),
    identificacion: (entrada.comprador.identificacion || "9999999999").trim(),
    correo: entrada.comprador.correo.trim().toLowerCase(),
    telefono: whatsappNormalizado,
    whatsapp: whatsappNormalizado,
    autorizaWhatsapp: autorizaWhatsappFinal,
    ...(autorizaWhatsappFinal ? { consentimientoWhatsappEn: new Date().toISOString() } : {}),
  };

  const payloadProforma = {
    tipo_origen: "PROFORMA_EVENTO",
    estado: "ENVIADA",
    vigencia_dias: vigenciaDias,
    comprador: compradorPayload,
    evento: entrada.evento,
    subtotal_base_imponible: entrada.subtotalBaseImponible,
    descuento_total: entrada.descuentoTotal ?? 0,
    total_iva: entrada.totalIva,
    total_flete: entrada.totalFlete,
    total_pagar: entrada.totalPagar,
    base_iva_0_centavos: baseIva0Centavos,
    base_iva_gravada_centavos: baseIvaGravadaCentavos,
    porcentaje_reserva_sugerido: 70,
    monto_reserva_70_usd: montoReserva70Usd,
    monto_abonado_usd: 0,
    saldo_pendiente_usd: entrada.totalPagar,
    observaciones: [
      `Evento: ${entrada.evento.tipoEvento} (${entrada.evento.fechaEvento}${
        entrada.evento.horaEvento ? ` ${entrada.evento.horaEvento}` : ""
      })`,
      entrada.evento.paletaColores ? `Paleta: ${entrada.evento.paletaColores}` : null,
      entrada.evento.notasEvento ? `Notas: ${entrada.evento.notasEvento}` : null,
      logisticaEvento.formula_calculo_interno,
    ]
      .filter(Boolean)
      .join(" · "),
    logistica_entrega: {
      modalidad_entrega: "unificada",
      ...logisticaEvento,
      parametros_tarifarios_snapshot: {
        tarifa_por_km: config.tarifaPorKm,
        subsidio_base_usd: config.subsidioBaseUsd,
        recargo_minimo_extra: config.recargoMinimoExtra,
        zona_gratis_nombre: config.zonaGratisNombre,
      },
    },
    items: itemsEnriquecidos,
    ...(entrada.atribucionPublicitaria
      ? { atribucion_publicitaria: entrada.atribucionPublicitaria }
      : {}),
  };

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const clienteEscritura: any = crearClienteAdmin() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const prefijo =
    negNorm === "tinkay"
      ? "TNK"
      : negNorm === "margaritas"
      ? "MRG"
      : negNorm === "fastfix"
      ? "FFH"
      : "TRQ";

  let esClienteRegistrado = false;
  if (user?.id) {
    try {
      const [{ data: memActiva }, { data: usrFlag }] = await Promise.all([
        clienteEscritura
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_id")
          .eq("mem_usuario_id", user.id)
          .in("mem_negocio", [negNorm, negNorm.toUpperCase(), prefijo, prefijo.toLowerCase()])
          .eq("mem_estado", "ACTIVO")
          .limit(1)
          .maybeSingle(),
        clienteEscritura
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_superadmin_plataforma")
          .eq("usu_id", user.id)
          .maybeSingle(),
      ]);
      esClienteRegistrado = Boolean(memActiva?.mem_id || usrFlag?.usu_superadmin_plataforma);
    } catch {
      esClienteRegistrado = true;
    }
  }

  // Regla de negocio: notificar a vendedores, operadores y administradores
  // ÚNICAMENTE si el cliente está registrado y/o proporcionó su número de WhatsApp.
  const debeNotificarStaffProforma = esClienteRegistrado || tieneWhatsappProporcionado;

  const despacharCorreoYNotificacionProforma = async (tokenDestino: string) => {
    try {
      const consultaNueva = await obtenerProformaPorTokenAction(tokenDestino);
      if (!consultaNueva.ok) return;

      try {
        const { enviarCorreoProformaEvento } = await import("./pdf-proforma");
        await enviarCorreoProformaEvento({ proformaActual: consultaNueva.proforma });
      } catch {
        // No bloquear la emisión si el servidor SMTP no está disponible
      }

      if (debeNotificarStaffProforma) {
        try {
          const { notificarStaffNuevaProforma } = await import(
            "@eco/notificaciones/notificar-usuario"
          );
          await notificarStaffNuevaProforma({
            negocio: negNorm,
            codigoProforma: consultaNueva.proforma.codigoProforma,
            tokenAprobacion: tokenDestino,
            clienteNombre: consultaNueva.proforma.comprador.nombreCompleto,
            clienteCorreo: consultaNueva.proforma.comprador.correo,
            clienteTelefono: consultaNueva.proforma.comprador.whatsapp || undefined,
            clienteRegistrado: esClienteRegistrado,
            tipoEvento: consultaNueva.proforma.evento.tipoEvento,
            fechaEvento: consultaNueva.proforma.evento.fechaEvento,
            lugarEvento: consultaNueva.proforma.ubicacion?.direccion,
            totalUsd: consultaNueva.proforma.total,
            reservaUsd: consultaNueva.proforma.montoReserva70Usd,
            itemsResumen: consultaNueva.proforma.items.map(
              (it) =>
                `${it.cantidad}x ${it.descripcion} ($${(it.cantidad * it.precioUnitario).toFixed(2)})`
            ),
            origenCanal: "Web Autoservicio",
          });
        } catch (errStaff) {
          console.warn("Aviso al notificar proforma a staff:", errStaff);
        }

        // Disparar evento Lead en Meta Conversions API (deduplicado con lead-{codigoProforma})
        try {
          const { enviarEventoConversionMetaServidorAction } = await import(
            "./acciones-marketing-meta"
          );
          const skusLead = itemsEnriquecidos
            .map((it) => String(it.variante_sku || it.producto_id || "").trim())
            .filter(Boolean);
          await enviarEventoConversionMetaServidorAction({
            negocio: negNorm,
            eventName: "Lead",
            eventId: `lead-${consultaNueva.proforma.codigoProforma}`,
            eventSourceUrl: entrada.atribucionPublicitaria?.eventSourceUrl,
            valorUsd: consultaNueva.proforma.total,
            moneda: "USD",
            codigoOrden: consultaNueva.proforma.codigoProforma,
            contentIds: skusLead,
            contentName: `Proforma ${consultaNueva.proforma.evento.tipoEvento}`,
            comprador: {
              email: consultaNueva.proforma.comprador.correo,
              telefono: consultaNueva.proforma.comprador.whatsapp || undefined,
              nombreCompleto: consultaNueva.proforma.comprador.nombreCompleto,
              usuarioId: user?.id ?? null,
            },
            atribucion: {
              fbc: entrada.atribucionPublicitaria?.fbc,
              fbp: entrada.atribucionPublicitaria?.fbp,
            },
          });
        } catch {
          // No interrumpir emisión de proforma
        }
      }
    } catch {
      // Continuar sin bloquear la emisión
    }
  };

  const esquemaComercio: any = supabase.schema("comun_comercio");

  // 1. Intentar RPC transaccional SECURITY DEFINER
  const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
    "com_fn_generar_proforma_evento",
    {
      p_negocio: negNorm,
      p_payload: payloadProforma,
    }
  );

  if (!errRpc && resRpc?.ok && resRpc?.token_aprobacion) {
    const tokenCreado = String(resRpc.token_aprobacion);
    const codigoPrfCreado = String(resRpc.codigo_proforma);
    await despacharCorreoYNotificacionProforma(tokenCreado);
    if (entrada.conversacionWebId) {
      try {
        const { registrarInteraccionChatWebAction } = await import("./acciones-omnicanal");
        await registrarInteraccionChatWebAction({
          negocio: negNorm,
          claveHilo: entrada.conversacionWebId.trim().slice(0, 96),
          fase: "EVENTO_ORDEN",
          contenido: `📋 Proforma de Evento ${codigoPrfCreado} generada por $${entrada.totalPagar.toFixed(2)} (${entrada.evento.tipoEvento})`,
          metadatos: {
            nombre_cliente: compradorPayload.nombreCompleto,
            correo: compradorPayload.correo,
            telefono: compradorPayload.whatsapp,
            codigo_orden: codigoPrfCreado,
            total_pagar: entrada.totalPagar,
            tipo_evento: entrada.evento.tipoEvento,
          },
        });
      } catch {
        // Opcional
      }
    }
    revalidatePath("/panel/pedidos");
    revalidatePath("/panel/conversaciones");
    revalidatePath("/panel");
    return {
      ok: true,
      id: String(resRpc.id),
      codigoProforma: codigoPrfCreado,
      tokenAprobacion: tokenCreado,
    };
  }

  // 2. Respaldo resiliente con service_role en tablas existentes si la migración RPC aún no se aplicó

  const { data: proformaCreada, error: errPrf } = await clienteEscritura
    .schema("comun_comercio")
    .from("com_proforma")
    .insert({
      prf_negocio: negNorm,
      prf_cliente_id: user?.id ?? null,
      prf_cliente_nombre: compradorPayload.nombreCompleto,
      prf_cliente_contacto: compradorPayload,
      prf_estado: "ENVIADA",
      prf_subtotal: entrada.subtotalBaseImponible,
      prf_descuento: entrada.descuentoTotal ?? 0,
      prf_iva: entrada.totalIva,
      prf_total: entrada.totalPagar,
      prf_vigencia_dias: vigenciaDias,
      prf_observaciones: payloadProforma.observaciones,
      prf_detalle_proforma: payloadProforma,
    })
    .select("prf_id, prf_secuencial, prf_token_aprobacion")
    .single();

  if (errPrf || !proformaCreada) {
    const msgPrf = String(errPrf?.message || "");
    const esRestriccionPermisos =
      msgPrf.toLowerCase().includes("permission denied") ||
      msgPrf.toLowerCase().includes("row-level security") ||
      !crearClienteAdmin();

    if (esRestriccionPermisos && Number(entrada.totalPagar) > 0) {
      const idRespaldo = crypto.randomUUID();
      const sufijoNum = String(1000 + (Date.now() % 8999));
      const codigoProformaRespaldo = `${prefijo}-PRF-${sufijoNum}`;
      const tokenFirmado = firmarOrdenRespaldoServidor({
        v: 1,
        id: idRespaldo,
        neg: negNorm,
        cod: codigoProformaRespaldo,
        ori: "PROFORMA_EVENTO",
        est: "ENVIADA",
        vig: vigenciaDias,
        sub: entrada.subtotalBaseImponible,
        des: entrada.descuentoTotal ?? 0,
        iva: entrada.totalIva,
        fle: entrada.totalFlete,
        tot: entrada.totalPagar,
        b0c: baseIva0Centavos,
        bgc: baseIvaGravadaCentavos,
        iat: new Date().toISOString(),
        cmp: {
          nom: compradorPayload.nombreCompleto,
          ide: compradorPayload.identificacion || "9999999999",
          cor: compradorPayload.correo,
          tel: compradorPayload.whatsapp,
        },
        ubi: {
          ret: Boolean(logisticaEvento.retiro_en_local),
          dir: String(logisticaEvento.direccion || "Locación por confirmar"),
          ref: String(logisticaEvento.referencia || ""),
          zon:
            "zona_detectada" in logisticaEvento && logisticaEvento.zona_detectada
              ? String(logisticaEvento.zona_detectada)
              : undefined,
          km:
            "distancia_vial_km" in logisticaEvento &&
            typeof logisticaEvento.distancia_vial_km === "number"
              ? logisticaEvento.distancia_vial_km
              : undefined,
          map:
            "enlace_mapa" in logisticaEvento && logisticaEvento.enlace_mapa
              ? String(logisticaEvento.enlace_mapa)
              : undefined,
        },
        evt: {
          tip: entrada.evento.tipoEvento,
          fec: entrada.evento.fechaEvento,
          hor: entrada.evento.horaEvento,
          inv: entrada.evento.invitadosEstimados,
          pal: entrada.evento.paletaColores,
          not: entrada.evento.notasEvento,
        },
        itm: itemsEnriquecidos.map((it) => ({
          dsc: it.descripcion,
          var: it.variante_nombre ? String(it.variante_nombre) : undefined,
          can: Number(it.cantidad || 1),
          pun: Number(it.precio_unitario || 0),
          imp: String(it.impuesto || "IVA_0"),
          tot: Number(it.total_linea || 0),
        })),
      });

      await despacharCorreoYNotificacionProforma(tokenFirmado);

      return {
        ok: true,
        id: idRespaldo,
        codigoProforma: codigoProformaRespaldo,
        tokenAprobacion: tokenFirmado,
      };
    }

    return {
      ok: false,
      error:
        errRpc?.message ||
        errPrf?.message ||
        "No se pudo emitir la proforma en la base de datos.",
    };
  }

  const codigoProforma = `${prefijo}-PRF-${String(proformaCreada.prf_secuencial ?? 1).padStart(
    4,
    "0"
  )}`;

  await clienteEscritura
    .schema("comun_comercio")
    .from("com_proforma")
    .update({
      prf_detalle_proforma: {
        ...payloadProforma,
        codigo_orden: codigoProforma,
        codigo_proforma: codigoProforma,
        codigo_base_proforma: codigoProforma,
        grupo_proforma_id: String(proformaCreada.prf_id),
        proforma_origen_id: String(proformaCreada.prf_id),
        version_numero: 1,
        es_original: true,
        etiqueta_version: "Original (Autoservicio)",
        creada_por_rol: "CLIENTE",
      },
    })
    .eq("prf_id", proformaCreada.prf_id);

  if (itemsEnriquecidos.length > 0) {
    const filasItems = itemsEnriquecidos.map((it) => ({
      pfi_negocio: negNorm,
      pfi_proforma_id: proformaCreada.prf_id,
      pfi_variante_id: null,
      pfi_es_item_libre: true,
      pfi_descripcion: it.descripcion,
      pfi_cantidad: it.cantidad,
      pfi_precio_unitario: it.precio_unitario,
      pfi_descuento: 0,
      pfi_impuesto: it.impuesto,
      pfi_total_linea: it.total_linea,
      pfi_detalle_item: it,
    }));

    const { error: errItems } = await clienteEscritura
      .schema("comun_comercio")
      .from("com_proforma_item")
      .insert(filasItems);

    if (errItems) {
      return { ok: false, error: errItems.message };
    }
  }

  await clienteEscritura
    .schema("comun_comercio")
    .from("com_despacho_asignacion")
    .insert({
      dsp_negocio: negNorm,
      dsp_orden_id: proformaCreada.prf_id,
      dsp_modalidad: logisticaEvento.retiro_en_local ? "RETIRO_LOCAL" : "PROPIO",
      dsp_tracking_url:
        "enlace_mapa" in logisticaEvento && logisticaEvento.enlace_mapa
          ? String(logisticaEvento.enlace_mapa)
          : null,
      dsp_costo_envio: entrada.totalFlete,
      dsp_estado: "ASIGNADO",
      dsp_observaciones_coordinacion: payloadProforma.observaciones,
      dsp_detalle_despacho: payloadProforma.logistica_entrega,
    });

  if (user?.id && tieneWhatsappProporcionado && autorizaWhatsappFinal) {
    try {
      const { data: usrActual } = await clienteEscritura
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_whatsapp, usu_detalle_usuario")
        .eq("usu_id", user.id)
        .maybeSingle();

      const detallePrev =
        usrActual?.usu_detalle_usuario && typeof usrActual.usu_detalle_usuario === "object"
          ? (usrActual.usu_detalle_usuario as Record<string, any>)
          : {};
      const mapaReg =
        detallePrev.registros_negocio && typeof detallePrev.registros_negocio === "object"
          ? { ...detallePrev.registros_negocio }
          : {};
      const ahoraIso = new Date().toISOString();

      mapaReg[negNorm] = {
        ...(mapaReg[negNorm] || {}),
        whatsapp: compradorPayload.whatsapp,
        autoriza_whatsapp: true,
        actualizado_en: ahoraIso,
        consentimiento_whatsapp_info: {
          autorizado: true,
          finalidad: "CONTACTO_COMERCIAL_PROFORMAS_E_INFORMACION",
          aceptado_en: ahoraIso,
          negocio: negNorm,
        },
      };

      await clienteEscritura
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          ...(usrActual?.usu_whatsapp ? {} : { usu_whatsapp: compradorPayload.whatsapp, usu_autorizacion_whatsapp: true }),
          usu_detalle_usuario: {
            ...detallePrev,
            registros_negocio: mapaReg,
          },
          usu_actualizado_en: ahoraIso,
        })
        .eq("usu_id", user.id);
    } catch {
      // Continuar
    }
  }

  const tokenFinal = String(proformaCreada.prf_token_aprobacion);
  await despacharCorreoYNotificacionProforma(tokenFinal);

  if (entrada.conversacionWebId) {
    try {
      const { registrarInteraccionChatWebAction } = await import("./acciones-omnicanal");
      await registrarInteraccionChatWebAction({
        negocio: negNorm,
        claveHilo: entrada.conversacionWebId.trim().slice(0, 96),
        fase: "EVENTO_ORDEN",
        contenido: `📋 Proforma de Evento ${codigoProforma} generada por $${entrada.totalPagar.toFixed(2)} (${entrada.evento.tipoEvento})`,
        metadatos: {
          nombre_cliente: compradorPayload.nombreCompleto,
          correo: compradorPayload.correo,
          telefono: compradorPayload.whatsapp,
          codigo_orden: codigoProforma,
          total_pagar: entrada.totalPagar,
          tipo_evento: entrada.evento.tipoEvento,
        },
      });
    } catch {
      // Opcional
    }
  }

  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/conversaciones");
  revalidatePath("/panel");
  return {
    ok: true,
    id: String(proformaCreada.prf_id),
    codigoProforma,
    tokenAprobacion: tokenFinal,
  };
}

const ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO = new Set([
  "RESERVADA_70",
  "APROBADA",
  "ORDEN_CONFIRMADA",
  "FACTURADA",
  "PAGADO",
  "EN_PREPARACION",
  "EN_RUTA",
  "DESPACHADO",
  "ENTREGADO",
]);

function mapearProformaPublicaDesdeFila(f: any, itemsTabla: any[] = []): ProformaEventoPublica {
  const det = (f.detalle ?? f.prf_detalle_proforma ?? {}) as Record<string, any>;
  const contacto = (f.cliente_contacto ?? f.prf_cliente_contacto ?? det.comprador ?? {}) as Record<
    string,
    any
  >;
  const ev = (det.evento ?? {}) as Record<string, any>;
  const log = (det.logistica_entrega ?? {}) as Record<string, any>;
  const neg = String(f.negocio ?? f.prf_negocio ?? "tinkay");
  const prefijo =
    neg === "tinkay" ? "TNK" : neg === "margaritas" ? "MRG" : neg === "fastfix" ? "FFH" : "TRQ";
  const idStr = String(f.id ?? f.prf_id);
  const sec = Number(f.secuencial ?? f.prf_secuencial ?? 1);
  const versionNumero = Number(det.version_numero ?? 1);
  const esOriginal = det.es_original !== undefined ? Boolean(det.es_original) : versionNumero === 1;
  const total = Number(f.total ?? f.prf_total ?? det.total_pagar ?? 0);
  const iva = Number(f.iva ?? f.prf_iva ?? det.total_iva ?? 0);
  const subtotal = Number(f.subtotal ?? f.prf_subtotal ?? det.subtotal_base_imponible ?? 0);
  const descuento = Number(f.descuento ?? f.prf_descuento ?? det.descuento_total ?? 0);
  const flete = Number(det.total_flete ?? log.costo_envio_usd ?? 0);
  const baseTotal = Math.max(0, Math.round((total - iva) * 100) / 100);
  const baseGravada =
    det.base_iva_gravada_centavos !== undefined
      ? Number(det.base_iva_gravada_centavos) / 100
      : iva > 0
      ? Math.min(baseTotal, Math.round((iva / 0.15) * 100) / 100)
      : 0;
  const base0 = Math.max(0, Math.round((baseTotal - baseGravada) * 100) / 100);

  const itemsFuente =
    Array.isArray(f.items) && f.items.length > 0
      ? f.items
      : itemsTabla.length > 0
      ? itemsTabla
      : Array.isArray(det.items)
      ? det.items
      : [];

  const ultimoPlux = det.ultimo_pago_plux as Record<string, any> | undefined;

  return {
    id: idStr,
    secuencial: sec,
    clienteId: f.cliente_id ?? f.prf_cliente_id ?? null,
    codigoProforma: String(
      det.codigo_proforma ||
        det.codigo_orden ||
        `${prefijo}-PRF-${String(sec).padStart(4, "0")}`
    ),
    grupoProformaId: String(det.grupo_proforma_id || idStr),
    versionNumero,
    esOriginal,
    etiquetaVersion: String(
      det.etiqueta_version ||
        (esOriginal ? "Original (Autoservicio)" : `Propuesta V${versionNumero} (Asesor)`)
    ),
    notaAsesor: det.nota_asesor ? String(det.nota_asesor) : undefined,
    asesorNombre: det.asesor_nombre ? String(det.asesor_nombre) : undefined,
    negocio: neg,
    estado: String(f.estado ?? f.prf_estado ?? det.estado ?? "ENVIADA"),
    vigenciaDias: Number(f.vigencia_dias ?? f.prf_vigencia_dias ?? det.vigencia_dias ?? 15),
    tokenAprobacion: String(f.token_aprobacion ?? f.prf_token_aprobacion ?? ""),
    creadoEn: String(f.creado_en ?? f.prf_creado_en ?? new Date().toISOString()),
    comprador: {
      nombreCompleto: String(
        f.cliente_nombre ?? f.prf_cliente_nombre ?? contacto.nombreCompleto ?? "Cliente"
      ),
      identificacion: String(contacto.identificacion || "9999999999"),
      correo: String(contacto.correo || ""),
      whatsapp: String(contacto.whatsapp || contacto.telefono || ""),
      autorizaWhatsapp: Boolean(contacto.autorizaWhatsapp),
    },
    evento: {
      tipoEvento: String(ev.tipoEvento || "Evento Especial"),
      fechaEvento: String(ev.fechaEvento || log.fecha_entrega || ""),
      horaEvento: ev.horaEvento ? String(ev.horaEvento) : undefined,
      invitadosEstimados:
        typeof ev.invitadosEstimados === "number" ? ev.invitadosEstimados : undefined,
      paletaColores: ev.paletaColores ? String(ev.paletaColores) : undefined,
      notasEvento: ev.notasEvento ? String(ev.notasEvento) : undefined,
    },
    ubicacion: {
      retiroEnLocal: Boolean(log.retiro_en_local),
      direccion: String(log.direccion || "Locación por confirmar"),
      referencia: String(log.referencia || ""),
      zonaDetectada: log.zona_detectada ? String(log.zona_detectada) : undefined,
      distanciaVialKm:
        typeof log.distancia_vial_km === "number" ? log.distancia_vial_km : undefined,
      enlaceMapa: log.enlace_mapa ? String(log.enlace_mapa) : undefined,
    },
    subtotal,
    descuento,
    baseIva0: base0,
    baseIvaGravada: baseGravada,
    iva,
    flete,
    total,
    montoReserva70Usd:
      det.monto_reserva_70_usd !== undefined
        ? Number(det.monto_reserva_70_usd)
        : Math.round(total * 0.7 * 100) / 100,
    montoAbonadoUsd: Number(det.monto_abonado_usd ?? 0),
    saldoPendienteUsd:
      det.saldo_pendiente_usd !== undefined ? Number(det.saldo_pendiente_usd) : total,
    ultimoPagoPlux: ultimoPlux
      ? {
          identificador: String(ultimoPlux.identificador || ""),
          autorizacion: String(ultimoPlux.autorizacion || ""),
          marca: ultimoPlux.marca || ultimoPlux.marca_tarjeta || undefined,
          ultimosDigitos: ultimoPlux.ultimos_digitos || undefined,
          montoUsd: Number(ultimoPlux.monto_usd ?? 0),
          confirmadoEn: ultimoPlux.confirmado_en ? String(ultimoPlux.confirmado_en) : undefined,
        }
      : null,
    items: itemsFuente.map((it: any) => {
      const detIt = (it.detalle ?? it.pfi_detalle_item ?? it) as Record<string, any>;
      return {
        descripcion: String(
          it.descripcion ?? it.pfi_descripcion ?? detIt.descripcion ?? "Servicio de Evento"
        ),
        varianteNombre: detIt.variante_nombre ? String(detIt.variante_nombre) : undefined,
        cantidad: Number(it.cantidad ?? it.pfi_cantidad ?? detIt.cantidad ?? 1),
        precioUnitario: Number(
          it.precio_unitario ?? it.pfi_precio_unitario ?? detIt.precio_unitario ?? 0
        ),
        impuesto: String(it.impuesto ?? it.pfi_impuesto ?? detIt.impuesto ?? "IVA_0"),
        totalLinea: Number(it.total_linea ?? it.pfi_total_linea ?? detIt.total_linea ?? 0),
        imagen: detIt.imagen ? String(detIt.imagen) : undefined,
      };
    }),
  };
}

/**
 * Obtiene una proforma por su token único (`prf_token_aprobacion`), junto con todas las
 * variaciones activas de su grupo (`V1 Original`, `V2 Asesor`, etc.) para que el cliente
 * compare, descarte las no aceptadas y pague la elegida.
 */
export async function obtenerProformaPorTokenAction(
  token: string
): Promise<
  | {
      ok: true;
      proforma: ProformaEventoPublica;
      variaciones: ProformaEventoPublica[];
      bloqueadaPorPagoGrupo: boolean;
    }
  | { ok: false; error: string }
> {
  const tokenLimpio = (token || "").trim();
  if (tokenLimpio.length < 8) {
    return { ok: false, error: "Enlace de proforma no válido." };
  }

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio: any = supabase.schema("comun_comercio");

  try {
    const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
      "com_fn_obtener_proforma_por_token",
      { p_token: tokenLimpio }
    );
    if (!errRpc && resRpc?.ok && resRpc?.proforma) {
      const principal = mapearProformaPublicaDesdeFila(resRpc.proforma);
      const varsMapeadas = Array.isArray(resRpc.variaciones)
        ? resRpc.variaciones.map((v: any) => mapearProformaPublicaDesdeFila(v))
        : [principal];
      const bloqueada =
        Boolean(resRpc.bloqueada_por_pago_grupo) ||
        varsMapeadas.some(
          (v: ProformaEventoPublica) =>
            ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(v.estado) || v.montoAbonadoUsd > 0
        );
      return {
        ok: true,
        proforma: principal,
        variaciones: varsMapeadas.length > 0 ? varsMapeadas : [principal],
        bloqueadaPorPagoGrupo: bloqueada,
      };
    }
  } catch {
    // Continuar al respaldo directo
  }

  const db: any = crearClienteAdmin() ?? supabase;
  const { data: fila, error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_token_aprobacion", tokenLimpio)
    .is("prf_eliminado_en", null)
    .maybeSingle();

  if (error || !fila) {
    const ordenFirmada = verificarOrdenRespaldoServidor(tokenLimpio);
    if (ordenFirmada) {
      const proformaRespaldo: ProformaEventoPublica = {
        id: ordenFirmada.id,
        secuencial: 1,
        codigoProforma: ordenFirmada.cod,
        grupoProformaId: ordenFirmada.id,
        versionNumero: 1,
        esOriginal: true,
        etiquetaVersion: "Original (Autoservicio)",
        negocio: ordenFirmada.neg,
        estado: ordenFirmada.est,
        vigenciaDias: ordenFirmada.vig,
        tokenAprobacion: tokenLimpio,
        creadoEn: ordenFirmada.iat,
        comprador: {
          nombreCompleto: ordenFirmada.cmp.nom,
          identificacion: ordenFirmada.cmp.ide || "9999999999",
          correo: ordenFirmada.cmp.cor,
          whatsapp: ordenFirmada.cmp.tel,
          autorizaWhatsapp: true,
        },
        evento: {
          tipoEvento: ordenFirmada.evt?.tip || "Evento Especial",
          fechaEvento: ordenFirmada.evt?.fec || "",
          horaEvento: ordenFirmada.evt?.hor,
          invitadosEstimados: ordenFirmada.evt?.inv,
          paletaColores: ordenFirmada.evt?.pal,
          notasEvento: ordenFirmada.evt?.not,
        },
        ubicacion: {
          retiroEnLocal: ordenFirmada.ubi.ret,
          direccion: ordenFirmada.ubi.dir,
          referencia: ordenFirmada.ubi.ref,
          zonaDetectada: ordenFirmada.ubi.zon,
          distanciaVialKm: ordenFirmada.ubi.km,
          enlaceMapa: ordenFirmada.ubi.map,
        },
        subtotal: ordenFirmada.sub,
        descuento: ordenFirmada.des,
        baseIva0: ordenFirmada.b0c / 100,
        baseIvaGravada: ordenFirmada.bgc / 100,
        iva: ordenFirmada.iva,
        flete: ordenFirmada.fle,
        total: ordenFirmada.tot,
        montoReserva70Usd: Math.round(ordenFirmada.tot * 0.7 * 100) / 100,
        montoAbonadoUsd: 0,
        saldoPendienteUsd: ordenFirmada.tot,
        ultimoPagoPlux: null,
        items: ordenFirmada.itm.map((it) => ({
          descripcion: it.dsc,
          varianteNombre: it.var,
          cantidad: it.can,
          precioUnitario: it.pun,
          impuesto: it.imp,
          totalLinea: it.tot,
        })),
      };
      return {
        ok: true,
        proforma: proformaRespaldo,
        variaciones: [proformaRespaldo],
        bloqueadaPorPagoGrupo: false,
      };
    }

    return { ok: false, error: "La proforma solicitada no existe o fue eliminada." };
  }

  const grupoId = String(fila.prf_detalle_proforma?.grupo_proforma_id || fila.prf_id);

  const { data: filasNegocio } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_negocio", fila.prf_negocio)
    .is("prf_eliminado_en", null)
    .order("prf_creado_en", { ascending: true })
    .limit(250);

  const filasGrupo = (filasNegocio ?? [fila]).filter((f: any) => {
    const gId = String(f.prf_detalle_proforma?.grupo_proforma_id || f.prf_id);
    return gId === grupoId;
  });

  const idsGrupo = filasGrupo.map((f: any) => f.prf_id);
  const { data: itemsGrupo } = await db
    .schema("comun_comercio")
    .from("com_proforma_item")
    .select("*")
    .in("pfi_proforma_id", idsGrupo.length > 0 ? idsGrupo : [fila.prf_id])
    .is("pfi_eliminado_en", null)
    .order("pfi_secuencial", { ascending: true });

  const mapaItems = new Map<string, any[]>();
  (itemsGrupo ?? []).forEach((it: any) => {
    const k = String(it.pfi_proforma_id);
    const arr = mapaItems.get(k) ?? [];
    arr.push(it);
    mapaItems.set(k, arr);
  });

  const variaciones: ProformaEventoPublica[] = (filasGrupo.length > 0 ? filasGrupo : [fila])
    .map((fg: any) => mapearProformaPublicaDesdeFila(fg, mapaItems.get(String(fg.prf_id)) ?? []))
    .sort(
      (a: ProformaEventoPublica, b: ProformaEventoPublica) =>
        (a.versionNumero ?? 1) - (b.versionNumero ?? 1)
    );

  const principal =
    variaciones.find((v: ProformaEventoPublica) => v.id === String(fila.prf_id)) ??
    mapearProformaPublicaDesdeFila(fila, mapaItems.get(String(fila.prf_id)) ?? []);

  const bloqueadaPorPagoGrupo = variaciones.some(
    (v: ProformaEventoPublica) =>
      ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(v.estado) || v.montoAbonadoUsd > 0
  );

  return {
    ok: true,
    proforma: principal,
    variaciones: variaciones.length > 0 ? variaciones : [principal],
    bloqueadaPorPagoGrupo,
  };
}

/**
 * Permite al asesor de ventas crear una nueva variación (`V2`, `V3`, ...) sobre una proforma
 * existente (ej. tras una llamada con el cliente), conservando intacta la proforma original (`V1`)
 * y todas las variaciones previas, y enviando al cliente por correo el PDF Original + el PDF Actualizado.
 */
export async function crearVariacionProformaAsesorAction(
  entrada: EntradaVariacionProformaAsesor
): Promise<
  | {
      ok: true;
      id: string;
      codigoProforma: string;
      tokenAprobacion: string;
      versionNumero: number;
      correoEnviado: boolean;
      avisoCorreo?: string;
    }
  | { ok: false; error: string }
> {
  if (!entrada.proformaBaseId || entrada.items.length === 0) {
    return { ok: false, error: "La variación debe contener al menos un ítem válido." };
  }

  const negNorm = (entrada.negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión como asesor o administrador." };
  }

  const dbAdmin: any = crearClienteAdmin() ?? supabase;

  // Verificar membresía activa de staff o superadmin
  const [{ data: uRow }, { data: memRows }] = await Promise.all([
    dbAdmin
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_es_superadmin")
      .eq("usu_id", user.id)
      .maybeSingle(),
    dbAdmin
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_rol, mem_estado, mem_negocio")
      .eq("mem_usuario_id", user.id)
      .eq("mem_estado", "ACTIVA"),
  ]);

  const prefijoNeg =
    negNorm === "tinkay"
      ? "tnk"
      : negNorm === "margaritas"
      ? "mrg"
      : negNorm === "fastfix"
      ? "ffh"
      : "trq";

  const tieneRolStaff =
    Boolean(uRow?.usu_es_superadmin) ||
    (memRows ?? []).some((m: any) => {
      const mNeg = String(m.mem_negocio || "").toLowerCase();
      const rol = String(m.mem_rol || "").toUpperCase();
      return (
        (mNeg === negNorm || mNeg === prefijoNeg) &&
        ["SUPERADMIN", "ADMINISTRADOR", "ADMIN", "OPERADOR", "ASESOR", "VENTAS"].includes(rol)
      );
    });

  if (!tieneRolStaff) {
    return { ok: false, error: "No cuentas con permisos de asesor/administrador en este negocio." };
  }

  const nombreAsesor =
    [uRow?.usu_nombres, uRow?.usu_apellidos].filter(Boolean).join(" ").trim() ||
    user.email ||
    "Asesor Comercial";

  // Leer proforma base para heredar comprador, grupo y logística
  const { data: filaBase, error: errBase } = await dbAdmin
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_id", entrada.proformaBaseId)
    .is("prf_eliminado_en", null)
    .maybeSingle();

  if (errBase || !filaBase) {
    return { ok: false, error: "La proforma base ya no existe o fue eliminada por el cliente." };
  }

  const detBase = (filaBase.prf_detalle_proforma ?? {}) as Record<string, any>;
  const compradorBase = (filaBase.prf_cliente_contacto ?? detBase.comprador ?? {}) as Record<
    string,
    any
  >;
  const logBase = (detBase.logistica_entrega ?? {}) as Record<string, any>;

  // Recalcular desglose financiero exacto (IVA 0% vs IVA 15%)
  let subtotalSinIva = 0;
  let totalIva = 0;
  let baseGravadaCentavos = 0;
  let base0Centavos = 0;

  const itemsNormalizados = entrada.items.map((it) => {
    const cant = Math.max(0.01, Number(it.cantidad) || 1);
    const pvpUnit = Math.max(0, Number(it.precioUnitario) || 0);
    const tarifa = Number(it.tarifaIva) > 0 ? Number(it.tarifaIva) : 0;
    const totalLinea = Math.round(pvpUnit * cant * 100) / 100;
    const baseLinea =
      tarifa > 0 ? Math.round((totalLinea / (1 + tarifa / 100)) * 100) / 100 : totalLinea;
    const ivaLinea = Math.max(0, Math.round((totalLinea - baseLinea) * 100) / 100);

    subtotalSinIva += baseLinea;
    totalIva += ivaLinea;
    if (tarifa > 0) {
      baseGravadaCentavos += Math.round(baseLinea * 100);
    } else {
      base0Centavos += Math.round(baseLinea * 100);
    }

    return {
      descripcion: it.descripcion.trim(),
      producto_nombre: it.descripcion.trim(),
      variante_nombre: it.varianteNombre?.trim() || "",
      cantidad: cant,
      precio_unitario: pvpUnit,
      impuesto: tarifa > 0 ? `IVA_${tarifa}` : "IVA_0",
      total_linea: totalLinea,
      imagen: it.imagen || null,
    };
  });

  const descuentoTotal = Math.max(0, Math.round((Number(entrada.descuentoTotal) || 0) * 100) / 100);
  const totalFlete = Math.max(
    0,
    Math.round((Number(entrada.costoEnvio ?? detBase.total_flete ?? 0) || 0) * 100) / 100
  );
  // Agregar transporte a base 0% (o mantener exactitud con total)
  base0Centavos = Math.max(0, base0Centavos + Math.round(totalFlete * 100) - Math.round(descuentoTotal * 100));

  const subtotalRedondeado = Math.round(subtotalSinIva * 100) / 100;
  const ivaRedondeado = Math.round(totalIva * 100) / 100;
  const totalPagar = Math.max(
    0.01,
    Math.round((subtotalRedondeado + ivaRedondeado + totalFlete - descuentoTotal) * 100) / 100
  );
  const vigenciaDias = entrada.vigenciaDias ?? Number(filaBase.prf_vigencia_dias ?? 15);

  const payloadVariacion = {
    comprador: compradorBase,
    evento: entrada.evento,
    etiqueta_version: entrada.etiquetaVersion?.trim() || undefined,
    nota_asesor: entrada.notaAsesor?.trim() || undefined,
    asesor_nombre: nombreAsesor,
    vigencia_dias: vigenciaDias,
    subtotal_base_imponible: subtotalRedondeado,
    descuento_total: descuentoTotal,
    total_iva: ivaRedondeado,
    total_flete: totalFlete,
    total_pagar: totalPagar,
    base_iva_0_centavos: base0Centavos,
    base_iva_gravada_centavos: baseGravadaCentavos,
    observaciones: [
      entrada.notaAsesor ? `Asesor (${nombreAsesor}): ${entrada.notaAsesor}` : null,
      `Evento: ${entrada.evento.tipoEvento} (${entrada.evento.fechaEvento})`,
    ]
      .filter(Boolean)
      .join(" · "),
    logistica_entrega: {
      ...logBase,
      direccion: entrada.direccionEvento ?? logBase.direccion ?? "Locación por confirmar",
      referencia: entrada.referenciaEvento ?? logBase.referencia ?? "",
      fecha_entrega: entrada.evento.fechaEvento || logBase.fecha_entrega || "",
      costo_envio_usd: totalFlete,
    },
    items: itemsNormalizados,
  };

  let nuevoId = "";
  let nuevoCodigo = "";
  let nuevoToken = "";
  let nuevaVersion = 2;
  let tokenOrigen = "";

  const esquemaComercio: any = supabase.schema("comun_comercio");
  const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
    "com_fn_crear_variacion_proforma_asesor",
    {
      p_proforma_base_id: entrada.proformaBaseId,
      p_payload: payloadVariacion,
    }
  );

  if (!errRpc && resRpc?.ok && resRpc?.token_aprobacion) {
    nuevoId = String(resRpc.id);
    nuevoCodigo = String(resRpc.codigo_proforma);
    nuevoToken = String(resRpc.token_aprobacion);
    nuevaVersion = Number(resRpc.version_numero ?? 2);
    tokenOrigen = String(resRpc.token_origen || "");
  } else {
    // Respaldo resiliente con service_role si aún no se corrió la migración SQL
    const grupoId = String(detBase.grupo_proforma_id || filaBase.prf_id);
    const { data: filasMismoNeg } = await dbAdmin
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_id, prf_secuencial, prf_token_aprobacion, prf_cliente_id, prf_detalle_proforma, prf_creado_en")
      .eq("prf_negocio", filaBase.prf_negocio)
      .order("prf_creado_en", { ascending: true });

    const hermanas = (filasMismoNeg ?? [filaBase]).filter(
      (h: any) => String(h.prf_detalle_proforma?.grupo_proforma_id || h.prf_id) === grupoId
    );
    const origenFila = hermanas[0] ?? filaBase;
    tokenOrigen = String(origenFila.prf_token_aprobacion || filaBase.prf_token_aprobacion || "");
    const maxVer = hermanas.reduce(
      (m: number, h: any) => Math.max(m, Number(h.prf_detalle_proforma?.version_numero ?? 1)),
      1
    );
    nuevaVersion = maxVer + 1;

    const prefijoDoc =
      filaBase.prf_negocio === "tinkay"
        ? "TNK"
        : filaBase.prf_negocio === "margaritas"
        ? "MRG"
        : filaBase.prf_negocio === "fastfix"
        ? "FFH"
        : "TRQ";
    const codigoBase = String(
      origenFila.prf_detalle_proforma?.codigo_base_proforma ||
        origenFila.prf_detalle_proforma?.codigo_proforma ||
        `${prefijoDoc}-PRF-${String(origenFila.prf_secuencial ?? 1).padStart(4, "0")}`
    );
    nuevoCodigo = `${codigoBase}-V${nuevaVersion}`;

    const { data: insertada, error: errIns } = await dbAdmin
      .schema("comun_comercio")
      .from("com_proforma")
      .insert({
        prf_negocio: filaBase.prf_negocio,
        prf_cliente_id: origenFila.prf_cliente_id ?? filaBase.prf_cliente_id ?? null,
        prf_cliente_nombre: filaBase.prf_cliente_nombre,
        prf_cliente_contacto: compradorBase,
        prf_estado: "ENVIADA",
        prf_subtotal: subtotalRedondeado,
        prf_descuento: descuentoTotal,
        prf_iva: ivaRedondeado,
        prf_total: totalPagar,
        prf_vigencia_dias: vigenciaDias,
        prf_observaciones: payloadVariacion.observaciones,
        prf_detalle_proforma: {
          ...payloadVariacion,
          tipo_origen: "PROFORMA_EVENTO",
          estado: "ENVIADA",
          codigo_orden: nuevoCodigo,
          codigo_proforma: nuevoCodigo,
          codigo_base_proforma: codigoBase,
          grupo_proforma_id: grupoId,
          proforma_origen_id: String(origenFila.prf_id),
          proforma_base_edicion_id: String(filaBase.prf_id),
          version_numero: nuevaVersion,
          es_original: false,
          etiqueta_version:
            entrada.etiquetaVersion?.trim() || `Propuesta V${nuevaVersion} (Asesor)`,
          creada_por_rol: "ASESOR",
          porcentaje_reserva_sugerido: 70,
          monto_reserva_70_usd: Math.round(totalPagar * 0.7 * 100) / 100,
          monto_abonado_usd: 0,
          saldo_pendiente_usd: totalPagar,
        },
      })
      .select("prf_id, prf_token_aprobacion")
      .single();

    if (errIns || !insertada) {
      return { ok: false, error: errIns?.message || "No se pudo guardar la variación." };
    }

    nuevoId = String(insertada.prf_id);
    nuevoToken = String(insertada.prf_token_aprobacion);

    const filasItems = itemsNormalizados.map((it) => ({
      pfi_negocio: filaBase.prf_negocio,
      pfi_proforma_id: nuevoId,
      pfi_variante_id: null,
      pfi_es_item_libre: true,
      pfi_descripcion: it.descripcion,
      pfi_cantidad: it.cantidad,
      pfi_precio_unitario: it.precio_unitario,
      pfi_descuento: 0,
      pfi_impuesto: it.impuesto,
      pfi_total_linea: it.total_linea,
      pfi_detalle_item: it,
    }));

    const { error: errIt } = await dbAdmin
      .schema("comun_comercio")
      .from("com_proforma_item")
      .insert(filasItems);

    if (errIt) {
      return { ok: false, error: errIt.message };
    }
  }

  // Enviar por correo ambos PDFs: Proforma Original (V1) + Nueva Variación Actualizada (V2+)
  let correoEnviado = false;
  let avisoCorreo: string | undefined;
  try {
    const consultaNueva = await obtenerProformaPorTokenAction(nuevoToken);
    if (consultaNueva.ok) {
      const originalEnGrupo =
        consultaNueva.variaciones.find((v) => v.esOriginal || v.versionNumero === 1) ?? null;
      let proformaOrig = originalEnGrupo;
      if (!proformaOrig && tokenOrigen) {
        const cOrig = await obtenerProformaPorTokenAction(tokenOrigen);
        if (cOrig.ok) proformaOrig = cOrig.proforma;
      }

      const { enviarCorreoProformaEvento } = await import("./pdf-proforma");
      const resMail = await enviarCorreoProformaEvento({
        proformaActual: consultaNueva.proforma,
        proformaOriginal: proformaOrig,
      });
      correoEnviado = resMail.ok;
      if (!resMail.ok) avisoCorreo = resMail.error;
    }
  } catch (e: any) {
    avisoCorreo = e?.message;
  }

  revalidatePath("/panel/pedidos");
  revalidatePath(`/proforma/${nuevoToken}`);
  return {
    ok: true,
    id: nuevoId,
    codigoProforma: nuevoCodigo,
    tokenAprobacion: nuevoToken,
    versionNumero: nuevaVersion,
    correoEnviado,
    avisoCorreo,
  };
}

/**
 * Permite al cliente eliminar variaciones no aceptadas (`UNA` u `OTRAS`) o cancelar todas (`TODAS`)
 * estrictamente ANTES de realizar el pedido o confirmar el pago.
 */
export async function eliminarVariacionesProformaClienteAction(entrada: {
  tokenAprobacion?: string;
  modo: "UNA" | "OTRAS" | "TODAS";
  proformaObjetivoId?: string;
}): Promise<
  | { ok: true; eliminadas: number; tokenRestante: string | null }
  | { ok: false; error: string }
> {
  const modo = entrada.modo;
  if (!["UNA", "OTRAS", "TODAS"].includes(modo)) {
    return { ok: false, error: "Modo de eliminación inválido." };
  }

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio: any = supabase.schema("comun_comercio");

  try {
    const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
      "com_fn_eliminar_proformas_cliente",
      {
        p_token: entrada.tokenAprobacion ?? null,
        p_modo: modo,
        p_proforma_objetivo_id: entrada.proformaObjetivoId ?? null,
      }
    );
    if (!errRpc && resRpc) {
      if (!resRpc.ok) {
        return { ok: false, error: String(resRpc.error || "No se pudo eliminar la proforma.") };
      }
      revalidatePath("/panel");
      revalidatePath("/panel/pedidos");
      return {
        ok: true,
        eliminadas: Number(resRpc.eliminadas ?? 1),
        tokenRestante: resRpc.token_restante ? String(resRpc.token_restante) : null,
      };
    }
  } catch {
    // Continuar al respaldo directo
  }

  const db: any = crearClienteAdmin() ?? supabase;
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let refRow: any = null;
  if (entrada.tokenAprobacion && entrada.tokenAprobacion.trim().length >= 8) {
    const { data } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .eq("prf_token_aprobacion", entrada.tokenAprobacion.trim())
      .is("prf_eliminado_en", null)
      .maybeSingle();
    refRow = data;
  } else if (entrada.proformaObjetivoId && user?.id) {
    const { data } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .eq("prf_id", entrada.proformaObjetivoId)
      .eq("prf_cliente_id", user.id)
      .is("prf_eliminado_en", null)
      .maybeSingle();
    refRow = data;
  }

  if (!refRow) {
    return { ok: false, error: "No se encontró la proforma o ya fue eliminada." };
  }

  const grupoId = String(refRow.prf_detalle_proforma?.grupo_proforma_id || refRow.prf_id);
  const { data: filasNeg } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_negocio", refRow.prf_negocio)
    .is("prf_eliminado_en", null);

  const hermanas = (filasNeg ?? [refRow]).filter(
    (h: any) => String(h.prf_detalle_proforma?.grupo_proforma_id || h.prf_id) === grupoId
  );

  const bloqueada = hermanas.some(
    (h: any) =>
      ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(String(h.prf_estado || "")) ||
      Number(h.prf_detalle_proforma?.monto_abonado_usd ?? 0) > 0
  );

  if (bloqueada) {
    return {
      ok: false,
      error: "No es posible eliminar proformas después de realizar el pedido o confirmar el pago.",
    };
  }

  const idRefObjetivo = String(entrada.proformaObjetivoId || refRow.prf_id);
  const idsAEliminar =
    modo === "UNA"
      ? hermanas.filter((h: any) => String(h.prf_id) === idRefObjetivo).map((h: any) => h.prf_id)
      : modo === "OTRAS"
      ? hermanas.filter((h: any) => String(h.prf_id) !== idRefObjetivo).map((h: any) => h.prf_id)
      : hermanas.map((h: any) => h.prf_id);

  if (idsAEliminar.length > 0) {
    const { error: errUpd } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .update({
        prf_eliminado_en: new Date().toISOString(),
        prf_estado: "ANULADA",
        prf_actualizado_en: new Date().toISOString(),
      })
      .in("prf_id", idsAEliminar);

    if (errUpd) {
      return { ok: false, error: errUpd.message };
    }
  }

  const sobrevivientes = hermanas
    .filter((h: any) => !idsAEliminar.includes(h.prf_id))
    .sort(
      (a: any, b: any) =>
        Number(b.prf_detalle_proforma?.version_numero ?? 1) -
        Number(a.prf_detalle_proforma?.version_numero ?? 1)
    );

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/conversaciones");
  return {
    ok: true,
    eliminadas: idsAEliminar.length,
    tokenRestante: sobrevivientes[0]?.prf_token_aprobacion
      ? String(sobrevivientes[0].prf_token_aprobacion)
      : null,
  };
}

/**
 * Confirma el pedido de una variación mediante Transferencia Bancaria, bloqueando
 * la eliminación posterior y marcando las variaciones hermanas como `NO_ACEPTADA`.
 */
export async function confirmarOrdenTransferenciaProformaAction(entrada: {
  tokenAprobacion: string;
  modalidadCobro: "RESERVA_70" | "TOTAL_100";
  notaTransferencia?: string;
  comprobanteTransferencia?: ComprobanteTransferenciaSubido | null;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const tokenLimpio = (entrada.tokenAprobacion || "").trim();
  if (tokenLimpio.length < 8) {
    return { ok: false, error: "Token de proforma inválido." };
  }
  if (!entrada.comprobanteTransferencia?.url) {
    return {
      ok: false,
      error: "Adjunta el comprobante de transferencia (imagen o PDF) para confirmar tu pedido.",
    };
  }

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio: any = supabase.schema("comun_comercio");

  const persistirComprobanteEnDetalle = async () => {
    try {
      const dbAdj: any = crearClienteAdmin() ?? supabase;
      const { data: filaAdj } = await dbAdj
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_detalle_proforma")
        .eq("prf_token_aprobacion", tokenLimpio)
        .is("prf_eliminado_en", null)
        .maybeSingle();
      if (filaAdj?.prf_id) {
        const detPrev = (filaAdj.prf_detalle_proforma ?? {}) as Record<string, any>;
        await dbAdj
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_detalle_proforma: {
              ...detPrev,
              comprobante_transferencia: {
                url: entrada.comprobanteTransferencia?.url,
                nombre_archivo: entrada.comprobanteTransferencia?.nombreArchivo || "comprobante",
                mime_type: entrada.comprobanteTransferencia?.mimeType || "image/jpeg",
                tamano_bytes: entrada.comprobanteTransferencia?.tamanoBytes || 0,
                subido_en:
                  entrada.comprobanteTransferencia?.subidoEn || new Date().toISOString(),
              },
            },
          })
          .eq("prf_id", filaAdj.prf_id);
      }
    } catch {
      // No bloquear confirmación si el respaldo admin no está activo
    }
  };

  const notificarTransferenciaStaff = async () => {
    try {
      const {
        notificarClienteCompraConfirmada,
        notificarStaffNuevoPedido,
      } = await import("@eco/notificaciones/notificar-usuario");
      const {
        data: { user: usrActual },
      } = await supabase.auth.getUser();
      const consultaNueva = await obtenerProformaPorTokenAction(tokenLimpio);
      if (consultaNueva.ok) {
        const prf = consultaNueva.proforma;
        const montoCobro =
          entrada.modalidadCobro === "RESERVA_70" ? prf.montoReserva70Usd : prf.total;
        const etiquetaMetodo = `TRANSFERENCIA BANCARIA (${
          entrada.modalidadCobro === "RESERVA_70" ? "Reserva 70%" : "Total 100%"
        })`;
        const resumenItemsPrf = prf.items.map(
          (it) => `${it.cantidad}x ${it.descripcion} ($${(it.cantidad * it.precioUnitario).toFixed(2)})`
        );
        await Promise.allSettled([
          notificarClienteCompraConfirmada({
            negocio: prf.negocio,
            codigoOrden: prf.codigoProforma,
            clienteUsuarioId: usrActual?.id ?? null,
            clienteNombre: prf.comprador.nombreCompleto,
            clienteCorreo: prf.comprador.correo || null,
            montoUsd: montoCobro,
            metodoPago: etiquetaMetodo,
            esTransferenciaPendiente: true,
            modalidadEntrega: "Evento / Montaje",
            direccionEntrega: prf.ubicacion?.direccion,
            fechaEntrega: prf.evento.fechaEvento,
            itemsResumen: resumenItemsPrf,
          }),
          notificarStaffNuevoPedido({
            negocio: prf.negocio,
            codigo: prf.codigoProforma,
            clienteNombre: prf.comprador.nombreCompleto,
            clienteCorreo: prf.comprador.correo,
            clienteTelefono: prf.comprador.whatsapp || undefined,
            montoUsd: montoCobro,
            metodoPago: etiquetaMetodo,
            canalOrigen: "Proforma Eventos",
            tipoEntrega: "Evento / Montaje",
            direccionEntrega: prf.ubicacion?.direccion,
            fechaEntrega: prf.evento.fechaEvento,
            dedicatoria: entrada.notaTransferencia,
            itemsResumen: resumenItemsPrf,
          }),
        ]);
      }
    } catch (errNotif) {
      console.warn("Aviso al notificar orden transferencia a cliente y staff:", errNotif);
    }
  };

  try {
    const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
      "com_fn_confirmar_orden_transferencia_proforma",
      {
        p_token: tokenLimpio,
        p_modalidad_cobro: entrada.modalidadCobro,
        p_nota: entrada.notaTransferencia ?? null,
      }
    );
    if (!errRpc && resRpc?.ok) {
      await persistirComprobanteEnDetalle();
      await notificarTransferenciaStaff();
      revalidatePath(`/proforma/${tokenLimpio}`);
      revalidatePath(`/pagar/${tokenLimpio}`);
      revalidatePath("/panel");
      revalidatePath("/panel/pedidos");
      return { ok: true };
    }
  } catch {
    // Continuar a respaldo directo
  }

  const db: any = crearClienteAdmin() ?? supabase;
  const { data: fila, error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_token_aprobacion", tokenLimpio)
    .is("prf_eliminado_en", null)
    .maybeSingle();

  if (error || !fila) {
    return { ok: false, error: "No se encontró la proforma seleccionada." };
  }

  const det = (fila.prf_detalle_proforma ?? {}) as Record<string, any>;
  const grupoId = String(det.grupo_proforma_id || fila.prf_id);

  const { error: errConfirm } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .update({
      prf_estado: "ORDEN_CONFIRMADA",
      prf_detalle_proforma: {
        ...det,
        estado: "ORDEN_CONFIRMADA",
        metodo_pago: "transferencia",
        modalidad_comprometida: entrada.modalidadCobro,
        nota_transferencia: entrada.notaTransferencia || "",
        comprobante_transferencia: entrada.comprobanteTransferencia
          ? {
              url: entrada.comprobanteTransferencia.url,
              nombre_archivo:
                entrada.comprobanteTransferencia.nombreArchivo || "comprobante",
              mime_type: entrada.comprobanteTransferencia.mimeType || "image/jpeg",
              tamano_bytes: entrada.comprobanteTransferencia.tamanoBytes || 0,
              subido_en:
                entrada.comprobanteTransferencia.subidoEn || new Date().toISOString(),
            }
          : undefined,
        confirmada_transferencia_en: new Date().toISOString(),
        variacion_aceptada: true,
      },
      prf_actualizado_en: new Date().toISOString(),
    })
    .eq("prf_id", fila.prf_id);

  if (errConfirm) {
    return { ok: false, error: errConfirm.message };
  }

  const { data: filasNeg } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("prf_id, prf_estado, prf_detalle_proforma")
    .eq("prf_negocio", fila.prf_negocio)
    .is("prf_eliminado_en", null);

  const hermanasNoPagadas = (filasNeg ?? []).filter(
    (h: any) =>
      String(h.prf_id) !== String(fila.prf_id) &&
      String(h.prf_detalle_proforma?.grupo_proforma_id || h.prf_id) === grupoId &&
      ["ENVIADA", "PENDIENTE_PAGO"].includes(String(h.prf_estado || ""))
  );

  for (const h of hermanasNoPagadas) {
    await db
      .schema("comun_comercio")
      .from("com_proforma")
      .update({
        prf_estado: "NO_ACEPTADA",
        prf_detalle_proforma: {
          ...(h.prf_detalle_proforma ?? {}),
          estado: "NO_ACEPTADA",
          descartada_por_aceptacion_id: String(fila.prf_id),
        },
        prf_actualizado_en: new Date().toISOString(),
      })
      .eq("prf_id", h.prf_id);
  }

  await notificarTransferenciaStaff();
  revalidatePath(`/proforma/${tokenLimpio}`);
  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  revalidatePath("/panel/conversaciones");
  return { ok: true };
}

/**
 * Lista las proformas y órdenes vinculadas al usuario autenticado actual
 * (por `prf_cliente_id` o coincidencia de correo electrónico en comprador/contacto).
 */
export async function obtenerMisProformasEventoAction(
  negocio: string
): Promise<{ ok: true; proformas: ResumenMiProformaEvento[] } | { ok: false; error: string }> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: true, proformas: [] };
  }

  const prefijo =
    negNorm === "tinkay"
      ? "TNK"
      : negNorm === "margaritas"
      ? "MRG"
      : negNorm === "fastfix"
      ? "FFH"
      : "TRQ";

  const correoUsuario = (user.email || "").trim().toLowerCase();
  const db: any = crearClienteAdmin() ?? supabase;
  const { data: filasRaw, error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_negocio", negNorm)
    .is("prf_eliminado_en", null)
    .order("prf_creado_en", { ascending: false })
    .limit(200);

  if (error) {
    return { ok: false, error: error.message };
  }

  const filas = (filasRaw ?? []).filter((f: any) => {
    if (f.prf_cliente_id && String(f.prf_cliente_id) === user.id) {
      return true;
    }
    if (!correoUsuario) return false;
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const contacto = (f.prf_cliente_contacto ?? {}) as Record<string, any>;
    const correoContacto = String(contacto.correo || "").trim().toLowerCase();
    const correoComprador = String(det.comprador?.correo || "").trim().toLowerCase();
    return correoContacto === correoUsuario || correoComprador === correoUsuario;
  });

  // Vincular automáticamente prf_cliente_id si estaba nulo pero coincidió por correo
  const idsSinCliente = filas
    .filter((f: any) => !f.prf_cliente_id)
    .map((f: any) => String(f.prf_id));
  if (idsSinCliente.length > 0) {
    try {
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({ prf_cliente_id: user.id })
        .in("prf_id", idsSinCliente);
    } catch {
      // Continuar
    }
  }

  const gruposBloqueados = new Set<string>();
  (filas ?? []).forEach((f: any) => {
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const gId = String(det.grupo_proforma_id || f.prf_id);
    if (
      ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(String(f.prf_estado || "")) ||
      Number(det.monto_abonado_usd ?? 0) > 0
    ) {
      gruposBloqueados.add(gId);
    }
  });

  const proformas: ResumenMiProformaEvento[] = (filas ?? []).map((f: any) => {
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const log = (det.logistica_entrega ?? {}) as Record<string, any>;
    const primerDestino = Array.isArray(log.destinos) && log.destinos.length > 0 ? log.destinos[0] : null;
    const sec = Number(f.prf_secuencial ?? 1);
    const total = Number(f.prf_total ?? 0);
    const grupoId = String(det.grupo_proforma_id || f.prf_id);
    const verNum = Number(det.version_numero ?? 1);
    const tipoOrigen = String(det.tipo_origen || "PROFORMA_EVENTO");
    const itemsRaw = Array.isArray(det.items) ? det.items : [];
    const itemsResumen = itemsRaw.map((it: any) => {
      const cantidad = Number(it.cantidad ?? 1);
      const unitario = Number(it.pvp_unitario ?? it.precio_unitario ?? 0);
      const subtotal = Number(it.total_linea ?? Math.round(cantidad * unitario * 100) / 100);
      return {
        nombre: String(it.producto_nombre || it.descripcion || "Arreglo floral"),
        variante: it.variante_nombre ? String(it.variante_nombre) : undefined,
        cantidad,
        subtotal,
      };
    });

    return {
      id: String(f.prf_id),
      secuencial: sec,
      codigo: String(
        det.codigo_proforma ||
          det.codigo_orden ||
          `${prefijo}-${tipoOrigen === "ORDEN_DIRECTA" ? "ORD" : "PRF"}-${String(sec).padStart(4, "0")}`
      ),
      grupoProformaId: grupoId,
      versionNumero: verNum,
      esOriginal: det.es_original !== undefined ? Boolean(det.es_original) : verNum === 1,
      etiquetaVersion: det.etiqueta_version ? String(det.etiqueta_version) : undefined,
      tipoOrigen,
      estado: String(f.prf_estado || "ENVIADA"),
      total,
      vigenciaDias: Number(f.prf_vigencia_dias ?? 15),
      tokenAprobacion: String(f.prf_token_aprobacion || ""),
      tipoEvento: det.evento?.tipoEvento ? String(det.evento.tipoEvento) : undefined,
      fechaEvento: det.evento?.fechaEvento ? String(det.evento.fechaEvento) : undefined,
      montoAbonadoUsd: Number(det.monto_abonado_usd ?? 0),
      saldoPendienteUsd:
        det.saldo_pendiente_usd !== undefined ? Number(det.saldo_pendiente_usd) : total,
      bloqueadaPorPagoGrupo: gruposBloqueados.has(grupoId),
      creadoEn: String(f.prf_creado_en),
      metodoPago: det.metodo_pago ? String(det.metodo_pago) : undefined,
      destinatarioNombre: String(
        primerDestino?.destinatario_nombre || log.destinatario_nombre || ""
      ) || undefined,
      fechaEntrega: String(
        primerDestino?.fecha_entrega || log.fecha_entrega || det.evento?.fechaEvento || ""
      ) || undefined,
      franjaHoraria: String(
        primerDestino?.franja_horaria || log.franja_horaria || det.evento?.horaEvento || ""
      ) || undefined,
      direccionEntrega: String(
        primerDestino?.direccion || log.direccion || ""
      ) || undefined,
      itemsResumen,
    };
  });

  return { ok: true, proformas };
}

const URL_IMAGEN_REGALO_BIENVENIDA_TINKAY =
  "https://oaybbpdxhlxjbpwnoymy.supabase.co/storage/v1/object/public/catalogo/tinkay/portadas/1793008388305-bouquet_rojo_recostado_esferas_ferrero.jpg";

export interface EstadoRegaloPrimeraCompra {
  autenticado: boolean;
  aplicaRegalo: boolean;
  regalo: {
    sku: string;
    nombre: string;
    valorReferencia: number;
    imagenUrl: string;
    productoId?: string;
  };
}

/**
 * Verifica si el usuario actual está registrado en el negocio y califica para recibir el obsequio
 * de primera compra (Bombón Ferrero x1 en Esfera Acrílica sin costo adicional, resuelto desde catálogo).
 */
export async function obtenerEstadoRegaloPrimeraCompraAction(
  negocio = "tinkay"
): Promise<EstadoRegaloPrimeraCompra> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const regaloPorDefecto: EstadoRegaloPrimeraCompra["regalo"] = {
    sku: "TIN-VAR-4",
    nombre: "Bombón Ferrero x1 en Esfera Acrílica",
    valorReferencia: 1.5,
    imagenUrl: URL_IMAGEN_REGALO_BIENVENIDA_TINKAY,
  };

  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const db: any = crearClienteAdmin() ?? supabase;

    // 1. Resolver metadatos e imagen real del producto de promoción desde comun_comercio.com_variante
    let regaloResuelto: EstadoRegaloPrimeraCompra["regalo"] = { ...regaloPorDefecto };
    try {
      const { data: varGift } = await db
        .schema("comun_comercio")
        .from("com_variante")
        .select("var_id, var_producto_id, var_sku, var_nombre, var_precio, var_detalle_variante")
        .eq("var_negocio", negNorm)
        .eq("var_activo", true)
        .is("var_eliminado_en", null)
        .or("var_sku.eq.TIN-VAR-4,var_nombre.ilike.%esfera%")
        .limit(1)
        .maybeSingle();

      if (varGift) {
        const detVar = (varGift.var_detalle_variante ?? {}) as Record<string, unknown>;
        const portadaVar =
          typeof detVar.portada_url === "string" && detVar.portada_url.trim().length > 0
            ? detVar.portada_url.trim()
            : regaloPorDefecto.imagenUrl;
        regaloResuelto = {
          sku: String(varGift.var_sku || regaloPorDefecto.sku),
          nombre: String(varGift.var_nombre || regaloPorDefecto.nombre),
          valorReferencia: Number(varGift.var_precio ?? regaloPorDefecto.valorReferencia),
          imagenUrl: portadaVar,
          productoId: varGift.var_producto_id ? String(varGift.var_producto_id) : undefined,
        };
      }
    } catch {
      // Mantener valores por defecto si la consulta de variante falla
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return {
        autenticado: false,
        aplicaRegalo: false,
        regalo: regaloResuelto,
      };
    }

    // Verificar membresía activa en el negocio específico (aislamiento multinegocio)
    const aliasNeg =
      negNorm === "tinkay"
        ? ["TNK", "TINKAY", "tinkay", "tnk"]
        : negNorm === "margaritas"
        ? ["MRG", "MARGARITAS", "margaritas", "mrg"]
        : negNorm === "fastfix"
        ? ["FFH", "FASTFIX", "fastfix", "ffh"]
        : ["TRQ", "TRANQ", "TRANQI", "LEGAL", "tranqi"];

    let tieneMembresiaNegocio = false;
    try {
      const [{ data: mem }, { data: usu }] = await Promise.all([
        db
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_id")
          .eq("mem_usuario_id", user.id)
          .in("mem_negocio", aliasNeg)
          .eq("mem_estado", "ACTIVO")
          .limit(1)
          .maybeSingle(),
        db
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_superadmin_plataforma")
          .eq("usu_id", user.id)
          .maybeSingle(),
      ]);
      tieneMembresiaNegocio = Boolean(mem?.mem_id || usu?.usu_superadmin_plataforma);
    } catch {
      tieneMembresiaNegocio = true;
    }

    if (!tieneMembresiaNegocio) {
      return {
        autenticado: false,
        aplicaRegalo: false,
        regalo: regaloResuelto,
      };
    }

    const { data, error } = await (supabase as any)
      .schema("comun_comercio")
      .rpc("com_fn_verificar_primera_compra_usuario", { p_negocio: negNorm });

    if (!error && data && typeof data.aplica_regalo === "boolean") {
      const skuRpc = String(data.regalo?.sku || "");
      const skuFinal =
        skuRpc && skuRpc !== "TIN-VAR-6" ? skuRpc : regaloResuelto.sku;
      const imgRpc =
        typeof data.regalo?.imagen_url === "string" && data.regalo.imagen_url.trim().length > 0
          ? data.regalo.imagen_url.trim()
          : regaloResuelto.imagenUrl;
      return {
        autenticado: true,
        aplicaRegalo: Boolean(data.aplica_regalo),
        regalo: {
          sku: skuFinal,
          nombre: String(data.regalo?.nombre || regaloResuelto.nombre),
          valorReferencia: Number(
            data.regalo?.valor_referencia ?? regaloResuelto.valorReferencia
          ),
          imagenUrl: imgRpc,
          productoId: regaloResuelto.productoId,
        },
      };
    }

    // Respaldo si el RPC aún no está en caché
    const { count } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_id", { count: "exact", head: true })
      .eq("prf_negocio", negNorm)
      .eq("prf_cliente_id", user.id)
      .in("prf_estado", ["APROBADA", "RESERVADA_70", "EN_PRODUCCION", "EN_CAMINO", "ENTREGADO"])
      .is("prf_eliminado_en", null);

    return {
      autenticado: true,
      aplicaRegalo: (count ?? 0) === 0,
      regalo: regaloResuelto,
    };
  } catch {
    return {
      autenticado: false,
      aplicaRegalo: false,
      regalo: regaloPorDefecto,
    };
  }
}

// ============================================================================
// EXPEDIENTE INTEGRAL DE PEDIDOS DEL CLIENTE (PEDIDO + ENTREGA GPS + FACTURA)
// Y EDICIÓN EN AUTOSERVICIO DE PROFORMAS ANTES DEL PAGO
// ============================================================================

import type { FacturaElectronicaResumen } from "./acciones";
import { obtenerEmisorRideNegocioAction } from "./acciones-facturacion-sri";
import type { ConfiguracionEmisorSri, LineaFacturaSriResumen } from "./ride-sri";

export interface ConfirmacionEntregaClienteResumen {
  confirmada: boolean;
  estadoEntrega: string;
  fechaHoraConfirmacion?: string | null;
  entregadorNombre?: string | null;
  destinatarioRecibe?: string | null;
  fotoEvidenciaUrl?: string | null;
  direccionGps?: string | null;
  mapaUrl?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  observaciones?: string | null;
}

export interface ItemExpedientePedidoCliente {
  productoId?: string;
  sku?: string;
  nombre: string;
  variante?: string;
  cantidad: number;
  precioUnitario: number;
  tarifaIva: number;
  subtotal: number;
  imagen?: string;
  dedicatoria?: {
    para?: string;
    de?: string;
    mensaje?: string;
  } | null;
  personalizacionFloral?: SeleccionPersonalizacionFloral | null;
}

export interface ExpedientePedidoClienteCompleto {
  id: string;
  secuencial: number;
  codigo: string;
  grupoProformaId: string;
  versionNumero: number;
  esOriginal: boolean;
  etiquetaVersion?: string;
  notaAsesor?: string;
  asesorNombre?: string;
  tipoOrigen: string;
  estado: string;
  estadoTaller?: string;
  bloqueadaPorPagoGrupo: boolean;
  creadoEn: string;
  vigenciaDias: number;
  tokenAprobacion: string;
  metodoPago?: string;
  subtotal: number;
  baseIva0: number;
  baseIvaGravada: number;
  iva: number;
  descuento: number;
  costoEnvio: number;
  recargoHorarioExacto: number;
  total: number;
  montoReserva70Usd: number;
  montoAbonadoUsd: number;
  saldoPendienteUsd: number;
  comprador: {
    nombreCompleto: string;
    identificacion: string;
    correo: string;
    telefono: string;
  };
  entrega: {
    modalidadEntrega: string;
    retiroEnLocal: boolean;
    destinatarioNombre: string;
    destinatarioTelefono: string;
    direccion: string;
    referencia?: string;
    zonaDetectada?: string;
    distanciaVialKm?: number;
    fechaEntrega?: string;
    franjaHoraria?: string;
    horaExacta?: string;
    enlaceMapa?: string;
  };
  evento?: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  } | null;
  items: ItemExpedientePedidoCliente[];
  regaloPrimeraCompra?: {
    sku: string;
    nombre: string;
    valorReferencia: number;
    imagenUrl?: string;
  } | null;
  comprobanteTransferencia?: {
    url: string;
    nombreArchivo: string;
    mimeType?: string;
    subidoEn?: string;
  } | null;
  ultimoPagoPlux?: {
    identificador?: string;
    autorizacion?: string;
    marca?: string;
    ultimosDigitos?: string;
    montoUsd?: number;
    confirmadoEn?: string;
  } | null;
  confirmacionEntrega: ConfirmacionEntregaClienteResumen;
  facturaElectronica: FacturaElectronicaResumen | null;
}

/**
 * Obtiene el expediente completo de pedidos y proformas del cliente autenticado:
 * incluye todos los ítems, dedicatorias, datos logísticos, confirmación de entrega (con foto GPS)
 * y Factura Electrónica SRI (lista para ver/descargar RIDE PDF).
 */
export async function obtenerExpedientePedidosClienteAction(
  negocio: string
): Promise<
  | {
      ok: true;
      registros: ExpedientePedidoClienteCompleto[];
      emisorSri: ConfiguracionEmisorSri;
    }
  | { ok: false; error: string }
> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const [
    {
      data: { user },
    },
    emisorSri,
  ] = await Promise.all([
    supabase.auth.getUser(),
    obtenerEmisorRideNegocioAction(negNorm),
  ]);

  if (!user) {
    return { ok: true, registros: [], emisorSri };
  }

  const prefijo =
    negNorm === "tinkay"
      ? "TNK"
      : negNorm === "margaritas"
      ? "MRG"
      : negNorm === "fastfix"
      ? "FFH"
      : "TRQ";

  const correoUsuario = (user.email || "").trim().toLowerCase();
  const db: any = crearClienteAdmin() ?? supabase;

  const { data: filasRaw, error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_negocio", negNorm)
    .is("prf_eliminado_en", null)
    .order("prf_creado_en", { ascending: false })
    .limit(200);

  if (error) {
    return { ok: false, error: error.message };
  }

  const filas = (filasRaw ?? []).filter((f: any) => {
    if (f.prf_cliente_id && String(f.prf_cliente_id) === user.id) {
      return true;
    }
    if (!correoUsuario) return false;
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const contacto = (f.prf_cliente_contacto ?? {}) as Record<string, any>;
    const correoContacto = String(contacto.correo || "").trim().toLowerCase();
    const correoComprador = String(det.comprador?.correo || "").trim().toLowerCase();
    return correoContacto === correoUsuario || correoComprador === correoUsuario;
  });

  if (filas.length === 0) {
    return { ok: true, registros: [], emisorSri };
  }

  // Vincular automáticamente prf_cliente_id si estaba nulo pero coincidió por correo
  const idsSinCliente = filas
    .filter((f: any) => !f.prf_cliente_id)
    .map((f: any) => String(f.prf_id));
  if (idsSinCliente.length > 0) {
    try {
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({ prf_cliente_id: user.id })
        .in("prf_id", idsSinCliente);
    } catch {
      // Ignorar fallos de sincronización secundaria
    }
  }

  const idsOrdenes = filas.map((f: any) => String(f.prf_id));

  // Cargar ítems relacionales, confirmaciones de entrega (GPS + Foto) y pagos/facturas SRI en paralelo
  const [resItems, resEntregas, resPagos, resComprobantesCliente] = await Promise.all([
    db
      .schema("comun_comercio")
      .from("com_proforma_item")
      .select("*")
      .in("pfi_proforma_id", idsOrdenes)
      .is("pfi_eliminado_en", null)
      .order("pfi_secuencial", { ascending: true }),
    db
      .schema("comun_comercio")
      .from("com_entrega_evidencia")
      .select("*")
      .eq("ent_negocio", negNorm)
      .in("ent_proforma_id", idsOrdenes)
      .is("ent_eliminado_en", null)
      .neq("ent_estado", "ANULADA")
      .order("ent_capturado_en", { ascending: false }),
    db
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .select("*")
      .eq("pag_negocio", negNorm)
      .is("pag_eliminado_en", null)
      .order("pag_creado_en", { ascending: false })
      .limit(300),
    db
      .schema("comun_facturacion")
      .from("fac_comprobante")
      .select("*, fac_comprobante_linea(*)")
      .eq("cmp_negocio", negNorm)
      .eq("cmp_tipo", "01")
      .neq("cmp_estado", "BORRADOR")
      .order("cmp_creado_en", { ascending: false })
      .limit(300),
  ]);

  const mapaItemsPorProforma = new Map<string, any[]>();
  for (const it of resItems?.data ?? []) {
    const k = String(it.pfi_proforma_id);
    const lista = mapaItemsPorProforma.get(k) ?? [];
    lista.push(it);
    mapaItemsPorProforma.set(k, lista);
  }

  const mapaEntregaPorProforma = new Map<string, any>();
  for (const ent of resEntregas?.data ?? []) {
    const k = String(ent.ent_proforma_id || "");
    if (k && !mapaEntregaPorProforma.has(k)) {
      mapaEntregaPorProforma.set(k, ent);
    }
  }

  // Indexar comprobantes SRI por cmp_transaccion_pago_id y por referencia en cmp_detalle_comprobante
  const mapaComprobantePorPagoId = new Map<string, any>();
  const mapaComprobantePorProformaId = new Map<string, any>();
  for (const cmp of resComprobantesCliente?.data ?? []) {
    if (cmp.cmp_transaccion_pago_id) {
      mapaComprobantePorPagoId.set(String(cmp.cmp_transaccion_pago_id), cmp);
    }
    const detCmp = (cmp.cmp_detalle_comprobante ?? {}) as Record<string, any>;
    const prfRef = String(detCmp.proforma_id || detCmp.orden_id || "");
    if (prfRef && !mapaComprobantePorProformaId.has(prfRef)) {
      mapaComprobantePorProformaId.set(prfRef, cmp);
    }
  }

  // Indexar pagos por proforma_id o código de orden
  const mapaPagoPorProformaId = new Map<string, any>();
  const mapaPagoPorCodigoOrden = new Map<string, any>();
  for (const pag of resPagos?.data ?? []) {
    const detPag = (pag.pag_detalle_transaccion ?? {}) as Record<string, any>;
    const prfId = String(detPag.proforma_id || detPag.orden_id || "");
    if (prfId && !mapaPagoPorProformaId.has(prfId)) {
      mapaPagoPorProformaId.set(prfId, pag);
    }
    const codOrd = String(
      detPag.codigo_orden || detPag.codigo_proforma || pag.pag_identificador_cliente || ""
    ).trim();
    if (codOrd && !mapaPagoPorCodigoOrden.has(codOrd)) {
      mapaPagoPorCodigoOrden.set(codOrd, pag);
    }
  }

  const construirFacturaResumenDesdeCmp = (
    cmp: any,
    fallbackRubro: string
  ): FacturaElectronicaResumen | null => {
    if (!cmp) return null;
    const est = String(cmp.cmp_establecimiento || emisorSri.establecimiento || "001").padStart(3, "0");
    const pto = String(cmp.cmp_punto_emision || emisorSri.puntoEmision || "001").padStart(3, "0");
    const num = String(cmp.cmp_numero ?? 1).padStart(9, "0");
    const numeroComprobante = `${est}-${pto}-${num}`;
    const lineasRaw = Array.isArray(cmp.fac_comprobante_linea) ? cmp.fac_comprobante_linea : [];
    let sub15 = 0;
    let sub0 = 0;

    const lineas: LineaFacturaSriResumen[] = lineasRaw
      .slice()
      .sort((a: any, b: any) => Number(a.lin_orden ?? 1) - Number(b.lin_orden ?? 1))
      .map((l: any) => {
        const base = Number(l.lin_base_imponible ?? 0);
        const valIva = Number(l.lin_valor_iva ?? 0);
        const codIva = String(l.lin_codigo_iva || "0");
        const tarifa = codIva === "4" || valIva > 0 ? 15 : 0;
        if (tarifa > 0) sub15 += base;
        else sub0 += base;
        return {
          codigo: String(l.lin_codigo || "ITEM"),
          descripcion: String(l.lin_descripcion || fallbackRubro),
          cantidad: Number(l.lin_cantidad ?? 1),
          precio_unitario: Number(l.lin_precio_unitario ?? base),
          descuento: Number(l.lin_descuento ?? 0),
          tarifa_iva: tarifa,
          subtotal: base,
          iva: valIva,
        };
      });

    const totalSinImp = Number(cmp.cmp_total_sin_impuestos ?? sub15 + sub0);
    const totalIva = Number(cmp.cmp_total_iva ?? 0);
    const importeTotal = Number(cmp.cmp_importe_total ?? totalSinImp + totalIva);
    const compJson = (cmp.cmp_comprador ?? {}) as Record<string, any>;

    return {
      comprobante_id: String(cmp.cmp_id),
      numero_comprobante: numeroComprobante,
      clave_acceso: String(cmp.cmp_clave_acceso || ""),
      estado: (cmp.cmp_estado as FacturaElectronicaResumen["estado"]) || "AUTORIZADO",
      ambiente: Number(cmp.cmp_ambiente) === 2 ? 2 : 1,
      fecha_emision: String(cmp.cmp_fecha_emision || cmp.cmp_creado_en || new Date().toISOString()),
      fecha_autorizacion: cmp.cmp_fecha_autorizacion ? String(cmp.cmp_fecha_autorizacion) : null,
      rubro_facturado: lineas[0]?.descripcion || fallbackRubro,
      subtotal: Math.round(totalSinImp * 100) / 100,
      subtotal_15: Math.round(sub15 * 100) / 100,
      subtotal_0: Math.round((lineas.length > 0 ? sub0 : Math.max(0, totalSinImp - sub15)) * 100) / 100,
      iva: Math.round(totalIva * 100) / 100,
      total: Math.round(importeTotal * 100) / 100,
      lineas: lineas.length > 0 ? lineas : undefined,
      comprador: {
        tipo_identificacion: compJson.tipo_identificacion || compJson.tipoIdentificacion,
        identificacion: compJson.identificacion || "9999999999999",
        razon_social: compJson.razon_social || compJson.razonSocial || "CONSUMIDOR FINAL",
        direccion: compJson.direccion || "Quito, Ecuador",
        correo: compJson.correo || compJson.email || "",
        telefono: compJson.telefono || "",
      },
    };
  };

  const gruposBloqueados = new Set<string>();
  for (const f of filas) {
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const gId = String(det.grupo_proforma_id || f.prf_id);
    if (
      ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(String(f.prf_estado || "")) ||
      Number(det.monto_abonado_usd ?? 0) > 0
    ) {
      gruposBloqueados.add(gId);
    }
  }

  const registros: ExpedientePedidoClienteCompleto[] = filas.map((f: any) => {
    const idStr = String(f.prf_id);
    const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
    const contacto = (f.prf_cliente_contacto ?? det.comprador ?? {}) as Record<string, any>;
    const log = (det.logistica_entrega ?? {}) as Record<string, any>;
    const primerDestino =
      Array.isArray(log.destinos) && log.destinos.length > 0 ? log.destinos[0] : null;
    const sec = Number(f.prf_secuencial ?? 1);
    const tipoOrigen = String(det.tipo_origen || "PROFORMA_EVENTO");
    const codigo = String(
      det.codigo_proforma ||
        det.codigo_orden ||
        `${prefijo}-${tipoOrigen === "ORDEN_DIRECTA" ? "ORD" : "PRF"}-${String(sec).padStart(4, "0")}`
    );
    const grupoId = String(det.grupo_proforma_id || idStr);
    const verNum = Number(det.version_numero ?? 1);
    const total = Number(f.prf_total ?? det.total_pagar ?? 0);
    const iva = Number(f.prf_iva ?? det.total_iva ?? 0);
    const subtotal = Number(f.prf_subtotal ?? det.subtotal_base_imponible ?? 0);
    const descuento = Number(f.prf_descuento ?? det.descuento_total ?? 0);
    const costoEnvio = Number(det.total_flete ?? log.costo_envio_usd ?? 0);
    const recargoHora = Number(det.total_recargo_horario_exacto ?? 0);

    const baseTotal = Math.max(0, Math.round((total - iva) * 100) / 100);
    const baseGravada =
      det.base_iva_gravada_centavos !== undefined
        ? Number(det.base_iva_gravada_centavos) / 100
        : iva > 0
        ? Math.min(baseTotal, Math.round((iva / 0.15) * 100) / 100)
        : 0;
    const base0 = Math.max(0, Math.round((baseTotal - baseGravada) * 100) / 100);

    // Ítems completos (con dedicatoria, SKU, imagen e IVA)
    const itemsRel = mapaItemsPorProforma.get(idStr) ?? [];
    const itemsJson = Array.isArray(det.items) ? det.items : [];
    const fuenteItems = itemsJson.length > 0 ? itemsJson : itemsRel;

    const items: ItemExpedientePedidoCliente[] = fuenteItems.map((it: any) => {
      const detIt = (it.pfi_detalle_item ?? it) as Record<string, any>;
      const cantidad = Number(it.cantidad ?? it.pfi_cantidad ?? detIt.cantidad ?? 1);
      const precioUnitario = Number(
        it.pvp_unitario ??
          it.precio_unitario ??
          it.pfi_precio_unitario ??
          detIt.precio_unitario ??
          0
      );
      const subtotalItem = Number(
        it.total_linea ??
          it.pfi_total_linea ??
          detIt.total_linea ??
          Math.round(cantidad * precioUnitario * 100) / 100
      );
      const impStr = String(it.impuesto ?? it.pfi_impuesto ?? detIt.impuesto ?? "IVA_0");
      const tarifaIva = impStr.includes("15") ? 15 : 0;
      const dedRaw = detIt.dedicatoria ?? it.dedicatoria;
      const dedicatoria =
        dedRaw && (dedRaw.para || dedRaw.de || dedRaw.mensaje)
          ? {
              para: dedRaw.para ? String(dedRaw.para) : undefined,
              de: dedRaw.de ? String(dedRaw.de) : undefined,
              mensaje: dedRaw.mensaje ? String(dedRaw.mensaje) : undefined,
            }
          : null;

      return {
        productoId: detIt.producto_id ? String(detIt.producto_id) : undefined,
        sku: detIt.variante_sku || detIt.sku ? String(detIt.variante_sku || detIt.sku) : undefined,
        nombre: String(
          detIt.producto_nombre ||
            it.producto_nombre ||
            it.pfi_descripcion ||
            detIt.descripcion ||
            "Arreglo floral"
        ),
        variante: detIt.variante_nombre ? String(detIt.variante_nombre) : undefined,
        cantidad,
        precioUnitario,
        tarifaIva,
        subtotal: subtotalItem,
        imagen: detIt.imagen ? String(detIt.imagen) : undefined,
        dedicatoria,
        personalizacionFloral:
          detIt.personalizacion_floral ?? detIt.personalizacionFloral ?? null,
      };
    });

    // Regalo de primera compra si fue incluido
    const regRaw = det.regalo_primera_compra ?? det.regaloPrimeraCompra;
    const regaloPrimeraCompra =
      regRaw && typeof regRaw === "object" && regRaw.nombre
        ? {
            sku: String(regRaw.sku || "TIN-VAR-4"),
            nombre: String(regRaw.nombre),
            valorReferencia: Number(regRaw.valor_referencia ?? regRaw.valorReferencia ?? 1.5),
            imagenUrl: regRaw.imagen_url || regRaw.imagenUrl ? String(regRaw.imagen_url || regRaw.imagenUrl) : undefined,
          }
        : null;

    // Comprobante de transferencia bancaria si fue subido
    const compTransfRaw = det.comprobante_transferencia ?? det.comprobanteTransferencia;
    const comprobanteTransferencia =
      compTransfRaw && typeof compTransfRaw === "object" && compTransfRaw.url
        ? {
            url: String(compTransfRaw.url),
            nombreArchivo: String(
              compTransfRaw.nombre_archivo || compTransfRaw.nombreArchivo || "comprobante"
            ),
            mimeType: compTransfRaw.mime_type || compTransfRaw.mimeType
              ? String(compTransfRaw.mime_type || compTransfRaw.mimeType)
              : undefined,
            subidoEn: compTransfRaw.subido_en || compTransfRaw.subidoEn
              ? String(compTransfRaw.subido_en || compTransfRaw.subidoEn)
              : undefined,
          }
        : null;

    // Último pago PLUX
    const pluxRaw = det.ultimo_pago_plux;
    const pagoVinculado =
      mapaPagoPorProformaId.get(idStr) ?? mapaPagoPorCodigoOrden.get(codigo) ?? null;

    const ultimoPagoPlux = pluxRaw
      ? {
          identificador: pluxRaw.identificador ? String(pluxRaw.identificador) : undefined,
          autorizacion: pluxRaw.autorizacion ? String(pluxRaw.autorizacion) : undefined,
          marca: pluxRaw.marca || pluxRaw.marca_tarjeta
            ? String(pluxRaw.marca || pluxRaw.marca_tarjeta)
            : undefined,
          ultimosDigitos: pluxRaw.ultimos_digitos ? String(pluxRaw.ultimos_digitos) : undefined,
          montoUsd: pluxRaw.monto_usd !== undefined ? Number(pluxRaw.monto_usd) : undefined,
          confirmadoEn: pluxRaw.confirmado_en ? String(pluxRaw.confirmado_en) : undefined,
        }
      : pagoVinculado && pagoVinculado.pag_estado === "APROBADO"
      ? {
          identificador: String(pagoVinculado.pag_identificador_cliente || ""),
          autorizacion: pagoVinculado.pag_autorizacion_codigo
            ? String(pagoVinculado.pag_autorizacion_codigo)
            : undefined,
          marca: pagoVinculado.pag_tarjeta_marca
            ? String(pagoVinculado.pag_tarjeta_marca)
            : undefined,
          ultimosDigitos: pagoVinculado.pag_tarjeta_ultimos_digitos
            ? String(pagoVinculado.pag_tarjeta_ultimos_digitos)
            : undefined,
          montoUsd: Number(pagoVinculado.pag_monto_total ?? total),
          confirmadoEn: pagoVinculado.pag_confirmado_en
            ? String(pagoVinculado.pag_confirmado_en)
            : undefined,
        }
      : null;

    // Confirmación de Entrega (Tabla com_entrega_evidencia + estado del pedido)
    const entRow = mapaEntregaPorProforma.get(idStr);
    const estUpper = String(f.prf_estado || "ENVIADA").toUpperCase();
    const estTaller = det.estado_taller ? String(det.estado_taller).toUpperCase() : undefined;
    const yaEntregado =
      Boolean(entRow && entRow.ent_estado !== "PROGRAMADA") ||
      estUpper === "ENTREGADO" ||
      estTaller === "ENTREGADO" ||
      Boolean(det.entrega_confirmada);

    const confirmacionEntrega: ConfirmacionEntregaClienteResumen = entRow
      ? {
          confirmada: entRow.ent_estado !== "PROGRAMADA",
          estadoEntrega:
            entRow.ent_estado !== "PROGRAMADA"
              ? "ENTREGADO"
              : estTaller || estUpper,
          fechaHoraConfirmacion:
            entRow.ent_estado !== "PROGRAMADA"
              ? String(entRow.ent_capturado_en || entRow.ent_fecha_servicio || "")
              : null,
          entregadorNombre: entRow.ent_entregador_nombre
            ? String(entRow.ent_entregador_nombre)
            : null,
          destinatarioRecibe: entRow.ent_fallecido_destinatario
            ? String(entRow.ent_fallecido_destinatario)
            : null,
          fotoEvidenciaUrl: entRow.ent_foto_url ? String(entRow.ent_foto_url) : null,
          direccionGps: entRow.ent_direccion_gps ? String(entRow.ent_direccion_gps) : null,
          mapaUrl: entRow.ent_mapa_url ? String(entRow.ent_mapa_url) : null,
          latitud: entRow.ent_latitud != null ? Number(entRow.ent_latitud) : null,
          longitud: entRow.ent_longitud != null ? Number(entRow.ent_longitud) : null,
          observaciones: entRow.ent_observaciones ? String(entRow.ent_observaciones) : null,
        }
      : {
          confirmada: yaEntregado,
          estadoEntrega: yaEntregado
            ? "ENTREGADO"
            : estTaller || estUpper,
          fechaHoraConfirmacion: det.entregado_en ? String(det.entregado_en) : null,
          fotoEvidenciaUrl: det.foto_entrega_url ? String(det.foto_entrega_url) : null,
        };

    // Factura Electrónica SRI vinculada
    let facturaElectronica: FacturaElectronicaResumen | null = null;
    const cmpDirecto =
      (pagoVinculado?.pag_id
        ? mapaComprobantePorPagoId.get(String(pagoVinculado.pag_id))
        : null) ?? mapaComprobantePorProformaId.get(idStr);

    if (cmpDirecto) {
      facturaElectronica = construirFacturaResumenDesdeCmp(
        cmpDirecto,
        items[0]?.nombre || `Pedido ${codigo}`
      );
    } else if (det.factura_electronica && typeof det.factura_electronica === "object") {
      facturaElectronica = det.factura_electronica as FacturaElectronicaResumen;
    } else if (
      pagoVinculado?.pag_detalle_transaccion?.factura_electronica &&
      typeof pagoVinculado.pag_detalle_transaccion.factura_electronica === "object"
    ) {
      facturaElectronica = pagoVinculado.pag_detalle_transaccion
        .factura_electronica as FacturaElectronicaResumen;
    }

    const evRaw = det.evento;
    const evento =
      evRaw && typeof evRaw === "object" && (evRaw.tipoEvento || tipoOrigen === "PROFORMA_EVENTO")
        ? {
            tipoEvento: String(evRaw.tipoEvento || "Evento Especial"),
            fechaEvento: String(evRaw.fechaEvento || log.fecha_entrega || ""),
            horaEvento: evRaw.horaEvento ? String(evRaw.horaEvento) : undefined,
            invitadosEstimados:
              evRaw.invitadosEstimados !== undefined && evRaw.invitadosEstimados !== null
                ? Number(evRaw.invitadosEstimados)
                : undefined,
            paletaColores: evRaw.paletaColores ? String(evRaw.paletaColores) : undefined,
            notasEvento: evRaw.notasEvento ? String(evRaw.notasEvento) : undefined,
          }
        : null;

    return {
      id: idStr,
      secuencial: sec,
      codigo,
      grupoProformaId: grupoId,
      versionNumero: verNum,
      esOriginal: det.es_original !== undefined ? Boolean(det.es_original) : verNum === 1,
      etiquetaVersion: det.etiqueta_version ? String(det.etiqueta_version) : undefined,
      notaAsesor: det.nota_asesor ? String(det.nota_asesor) : undefined,
      asesorNombre: det.asesor_nombre ? String(det.asesor_nombre) : undefined,
      tipoOrigen,
      estado: estUpper,
      estadoTaller: estTaller,
      bloqueadaPorPagoGrupo: gruposBloqueados.has(grupoId),
      creadoEn: String(f.prf_creado_en),
      vigenciaDias: Number(f.prf_vigencia_dias ?? 15),
      tokenAprobacion: String(f.prf_token_aprobacion || ""),
      metodoPago: det.metodo_pago
        ? String(det.metodo_pago)
        : pagoVinculado?.pag_pasarela
        ? String(pagoVinculado.pag_pasarela)
        : undefined,
      subtotal,
      baseIva0: base0,
      baseIvaGravada: baseGravada,
      iva,
      descuento,
      costoEnvio,
      recargoHorarioExacto: recargoHora,
      total,
      montoReserva70Usd:
        det.monto_reserva_70_usd !== undefined
          ? Number(det.monto_reserva_70_usd)
          : Math.round(total * 0.7 * 100) / 100,
      montoAbonadoUsd: Number(det.monto_abonado_usd ?? 0),
      saldoPendienteUsd:
        det.saldo_pendiente_usd !== undefined ? Number(det.saldo_pendiente_usd) : total,
      comprador: {
        nombreCompleto: String(
          f.prf_cliente_nombre || contacto.nombreCompleto || det.comprador?.nombreCompleto || "Cliente"
        ),
        identificacion: String(
          contacto.identificacion || det.comprador?.identificacion || "9999999999999"
        ),
        correo: String(contacto.correo || det.comprador?.correo || user.email || ""),
        telefono: String(
          contacto.whatsapp || contacto.telefono || det.comprador?.telefono || ""
        ),
      },
      entrega: {
        modalidadEntrega: String(det.modalidad_entrega || "unificada"),
        retiroEnLocal: Boolean(primerDestino?.retiro_en_local ?? log.retiro_en_local),
        destinatarioNombre: String(
          primerDestino?.destinatario_nombre ||
            log.destinatario_nombre ||
            f.prf_cliente_nombre ||
            "Destinatario"
        ),
        destinatarioTelefono: String(
          primerDestino?.destinatario_telefono || log.destinatario_telefono || ""
        ),
        direccion: String(
          primerDestino?.direccion || log.direccion || "Retiro en Tienda / Por confirmar"
        ),
        referencia:
          primerDestino?.referencia || log.referencia
            ? String(primerDestino?.referencia || log.referencia)
            : undefined,
        zonaDetectada:
          primerDestino?.zona_detectada || log.zona_detectada
            ? String(primerDestino?.zona_detectada || log.zona_detectada)
            : undefined,
        distanciaVialKm:
          typeof (primerDestino?.distancia_vial_km ?? log.distancia_vial_km) === "number"
            ? Number(primerDestino?.distancia_vial_km ?? log.distancia_vial_km)
            : undefined,
        fechaEntrega:
          primerDestino?.fecha_entrega || log.fecha_entrega || evento?.fechaEvento
            ? String(primerDestino?.fecha_entrega || log.fecha_entrega || evento?.fechaEvento)
            : undefined,
        franjaHoraria:
          primerDestino?.franja_horaria || log.franja_horaria
            ? String(primerDestino?.franja_horaria || log.franja_horaria)
            : undefined,
        horaExacta:
          primerDestino?.hora_exacta || log.hora_exacta || evento?.horaEvento
            ? String(primerDestino?.hora_exacta || log.hora_exacta || evento?.horaEvento)
            : undefined,
        enlaceMapa:
          primerDestino?.enlace_mapa || log.enlace_mapa
            ? String(primerDestino?.enlace_mapa || log.enlace_mapa)
            : undefined,
      },
      evento,
      items,
      regaloPrimeraCompra,
      comprobanteTransferencia,
      ultimoPagoPlux,
      confirmacionEntrega,
      facturaElectronica,
    };
  });

  return { ok: true, registros, emisorSri };
}

export interface EntradaEdicionProformaCliente {
  negocio: string;
  proformaId: string;
  tokenAprobacion?: string;
  evento: {
    tipoEvento: string;
    fechaEvento: string;
    horaEvento?: string;
    invitadosEstimados?: number;
    paletaColores?: string;
    notasEvento?: string;
  };
  ubicacion: {
    retiroEnLocal: boolean;
    direccion: string;
    referencia?: string;
    enlaceMapa?: string;
    lat?: number;
    lng?: number;
    zonaDetectada?: string;
    distanciaVialKm?: number;
    costoEnvio: number;
  };
  items: Array<{
    productoId?: string;
    sku?: string;
    descripcion: string;
    varianteNombre?: string;
    cantidad: number;
    precioUnitario: number;
    tarifaIva: number;
    imagen?: string;
  }>;
}

/**
 * Permite al cliente editar los ítems, cantidades, datos del evento y ubicación de su proforma
 * mientras el grupo aún no haya registrado pago o confirmación de orden.
 */
export async function actualizarProformaEventoClienteAction(
  entrada: EntradaEdicionProformaCliente
): Promise<
  | {
      ok: true;
      id: string;
      codigoProforma: string;
      tokenAprobacion: string;
      total: number;
      montoReserva70Usd: number;
    }
  | { ok: false; error: string }
> {
  if (!entrada.proformaId || !Array.isArray(entrada.items) || entrada.items.length === 0) {
    return {
      ok: false,
      error: "La proforma debe conservar al menos un arreglo o montaje de evento.",
    };
  }
  if (!entrada.evento?.fechaEvento) {
    return { ok: false, error: "Selecciona la fecha estimada del evento." };
  }

  const negNorm = (entrada.negocio || "tinkay").trim().toLowerCase();
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const db: any = crearClienteAdmin() ?? supabase;
  const { data: filaActual, error: errLectura } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_id", entrada.proformaId)
    .eq("prf_negocio", negNorm)
    .is("prf_eliminado_en", null)
    .maybeSingle();

  if (errLectura || !filaActual) {
    return { ok: false, error: "No se encontró la proforma o ya fue eliminada." };
  }

  // Validar propiedad: dueño autenticado, correo verificado coincidente o portador del tokenAprobacion
  const tokenFila = String(filaActual.prf_token_aprobacion || "").trim();
  const tokenEnviado = String(entrada.tokenAprobacion || "").trim();
  const correoUsr = (user?.email || "").trim().toLowerCase();
  const detPrev = (filaActual.prf_detalle_proforma ?? {}) as Record<string, any>;
  const contactoPrev = (filaActual.prf_cliente_contacto ?? {}) as Record<string, any>;
  const correoFila = String(
    contactoPrev.correo || detPrev.comprador?.correo || ""
  )
    .trim()
    .toLowerCase();

  const esPropietario =
    (user?.id && filaActual.prf_cliente_id && String(filaActual.prf_cliente_id) === user.id) ||
    (correoUsr && correoFila && correoUsr === correoFila) ||
    (tokenFila.length >= 8 && tokenEnviado === tokenFila);

  if (!esPropietario) {
    return { ok: false, error: "No tienes permisos para modificar esta proforma." };
  }

  // Verificar que ninguna variación del grupo tenga pago o confirmación
  const grupoId = String(detPrev.grupo_proforma_id || filaActual.prf_id);
  const { data: filasGrupo } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("prf_id, prf_estado, prf_detalle_proforma")
    .eq("prf_negocio", negNorm)
    .is("prf_eliminado_en", null);

  const hermanas = (filasGrupo ?? [filaActual]).filter(
    (h: any) => String(h.prf_detalle_proforma?.grupo_proforma_id || h.prf_id) === grupoId
  );
  const bloqueada = hermanas.some(
    (h: any) =>
      ESTADOS_PROFORMA_CON_PEDIDO_O_PAGO.has(String(h.prf_estado || "").toUpperCase()) ||
      Number(h.prf_detalle_proforma?.monto_abonado_usd ?? 0) > 0
  );
  if (bloqueada) {
    return {
      ok: false,
      error: "Esta proforma ya cuenta con una reserva o pago confirmado y no puede editarse.",
    };
  }

  // Recalcular desglose tributario (IVA 0% flores vs IVA 15% complementos/servicios gravados)
  let subtotalSinIva = 0;
  let totalIva = 0;
  let baseGravadaCentavos = 0;
  let base0Centavos = 0;

  const itemsNormalizados = entrada.items.map((it) => {
    const cantidad = Math.max(1, Math.round(Number(it.cantidad) || 1));
    const pvpUnit = Math.max(0, Number(it.precioUnitario) || 0);
    const tarifa = Number(it.tarifaIva) > 0 ? Number(it.tarifaIva) : 0;
    const totalLinea = Math.round(pvpUnit * cantidad * 100) / 100;
    const baseLinea =
      tarifa > 0 ? Math.round((totalLinea / (1 + tarifa / 100)) * 100) / 100 : totalLinea;
    const ivaLinea = Math.max(0, Math.round((totalLinea - baseLinea) * 100) / 100);

    subtotalSinIva += baseLinea;
    totalIva += ivaLinea;
    if (tarifa > 0) {
      baseGravadaCentavos += Math.round(baseLinea * 100);
    } else {
      base0Centavos += Math.round(baseLinea * 100);
    }

    return {
      producto_id: it.productoId || null,
      variante_sku: it.sku || "",
      sku: it.sku || "",
      descripcion: it.descripcion.trim(),
      producto_nombre: it.descripcion.trim(),
      variante_nombre: it.varianteNombre?.trim() || "",
      cantidad,
      precio_unitario: pvpUnit,
      pvp_unitario: pvpUnit,
      impuesto: tarifa > 0 ? `IVA_${tarifa}` : "IVA_0",
      total_linea: totalLinea,
      imagen: it.imagen || null,
    };
  });

  const descuentoExistente = Math.max(0, Number(filaActual.prf_descuento ?? 0));
  const flete = entrada.ubicacion.retiroEnLocal
    ? 0
    : Math.max(0, Math.round((Number(entrada.ubicacion.costoEnvio) || 0) * 100) / 100);
  base0Centavos = Math.max(
    0,
    base0Centavos + Math.round(flete * 100) - Math.round(descuentoExistente * 100)
  );

  const subtotalRedondeado = Math.round(subtotalSinIva * 100) / 100;
  const ivaRedondeado = Math.round(totalIva * 100) / 100;
  const totalPagar = Math.max(
    0.01,
    Math.round((subtotalRedondeado + ivaRedondeado + flete - descuentoExistente) * 100) / 100
  );
  const reserva70 = Math.round(totalPagar * 0.7 * 100) / 100;

  const logPrev = (detPrev.logistica_entrega ?? {}) as Record<string, any>;
  const nuevoDetalle: Record<string, any> = {
    ...detPrev,
    evento: {
      ...(detPrev.evento ?? {}),
      tipoEvento: entrada.evento.tipoEvento.trim() || "Evento Especial",
      fechaEvento: entrada.evento.fechaEvento,
      horaEvento: entrada.evento.horaEvento || undefined,
      invitadosEstimados: entrada.evento.invitadosEstimados,
      paletaColores: entrada.evento.paletaColores?.trim() || undefined,
      notasEvento: entrada.evento.notasEvento?.trim() || undefined,
    },
    logistica_entrega: {
      ...logPrev,
      retiro_en_local: Boolean(entrada.ubicacion.retiroEnLocal),
      direccion: entrada.ubicacion.retiroEnLocal
        ? "Retiro en Tienda Física"
        : entrada.ubicacion.direccion.trim() || "Locación por confirmar",
      referencia: entrada.ubicacion.referencia?.trim() || "",
      fecha_entrega: entrada.evento.fechaEvento,
      hora_exacta: entrada.evento.horaEvento || logPrev.hora_exacta || null,
      enlace_mapa: entrada.ubicacion.enlaceMapa || logPrev.enlace_mapa || null,
      lat: entrada.ubicacion.lat ?? logPrev.lat ?? null,
      lng: entrada.ubicacion.lng ?? logPrev.lng ?? null,
      zona_detectada: entrada.ubicacion.zonaDetectada ?? logPrev.zona_detectada ?? null,
      distancia_vial_km: entrada.ubicacion.distanciaVialKm ?? logPrev.distancia_vial_km ?? null,
      costo_envio_usd: flete,
    },
    items: itemsNormalizados,
    subtotal_base_imponible: subtotalRedondeado,
    total_iva: ivaRedondeado,
    total_flete: flete,
    total_pagar: totalPagar,
    base_iva_0_centavos: base0Centavos,
    base_iva_gravada_centavos: baseGravadaCentavos,
    monto_reserva_70_usd: reserva70,
    saldo_pendiente_usd: totalPagar,
    editada_por_cliente_en: new Date().toISOString(),
  };

  // 1. Intentar RPC transaccional en comun_comercio
  try {
    const esquemaComercio: any = supabase.schema("comun_comercio");
    const { data: resRpc, error: errRpc } = await esquemaComercio.rpc(
      "com_fn_actualizar_proforma_cliente",
      {
        p_proforma_id: entrada.proformaId,
        p_token: tokenFila || null,
        p_subtotal: subtotalRedondeado,
        p_iva: ivaRedondeado,
        p_total: totalPagar,
        p_detalle: nuevoDetalle,
        p_items: itemsNormalizados,
      }
    );
    if (!errRpc && resRpc?.ok) {
      revalidatePath("/panel");
      if (tokenFila) revalidatePath(`/proforma/${tokenFila}`);
      return {
        ok: true,
        id: String(filaActual.prf_id),
        codigoProforma: String(
          nuevoDetalle.codigo_proforma || nuevoDetalle.codigo_orden || "PRF"
        ),
        tokenAprobacion: tokenFila,
        total: totalPagar,
        montoReserva70Usd: reserva70,
      };
    }
  } catch {
    // Continuar al respaldo transaccional con service_role
  }

  // 2. Respaldo resiliente sobre com_proforma + com_proforma_item
  const { error: errUpd } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .update({
      prf_subtotal: subtotalRedondeado,
      prf_iva: ivaRedondeado,
      prf_total: totalPagar,
      prf_observaciones: `Evento: ${entrada.evento.tipoEvento} (${entrada.evento.fechaEvento})`,
      prf_detalle_proforma: nuevoDetalle,
      prf_actualizado_en: new Date().toISOString(),
    })
    .eq("prf_id", filaActual.prf_id);

  if (errUpd) {
    return { ok: false, error: errUpd.message };
  }

  // Marcar ítems anteriores como eliminados e insertar los actualizados
  await db
    .schema("comun_comercio")
    .from("com_proforma_item")
    .update({ pfi_eliminado_en: new Date().toISOString() })
    .eq("pfi_proforma_id", filaActual.prf_id)
    .is("pfi_eliminado_en", null);

  const filasNuevasItems = itemsNormalizados.map((it) => ({
    pfi_negocio: negNorm,
    pfi_proforma_id: filaActual.prf_id,
    pfi_variante_id: null,
    pfi_es_item_libre: true,
    pfi_descripcion: it.descripcion,
    pfi_cantidad: it.cantidad,
    pfi_precio_unitario: it.precio_unitario,
    pfi_descuento: 0,
    pfi_impuesto: it.impuesto,
    pfi_total_linea: it.total_linea,
    pfi_detalle_item: it,
  }));

  const { error: errInsItems } = await db
    .schema("comun_comercio")
    .from("com_proforma_item")
    .insert(filasNuevasItems);

  if (errInsItems) {
    return { ok: false, error: errInsItems.message };
  }

  revalidatePath("/panel");
  if (tokenFila) revalidatePath(`/proforma/${tokenFila}`);

  return {
    ok: true,
    id: String(filaActual.prf_id),
    codigoProforma: String(
      nuevoDetalle.codigo_proforma || nuevoDetalle.codigo_orden || "PRF"
    ),
    tokenAprobacion: tokenFila,
    total: totalPagar,
    montoReserva70Usd: reserva70,
  };
}

/**
 * Adjunta o reemplaza el comprobante/recibo de pago (imagen o PDF subido manualmente)
 * directamente como evidencia persistente del pedido (`com_proforma` y/o `com_orden_taller`).
 */
export async function adjuntarComprobantePedidoAction(entrada: {
  negocio: string;
  pedidoId: string;
  ordenTallerId?: string | null;
  comprobante: ComprobanteTransferenciaSubido;
}): Promise<
  | {
      ok: true;
      comprobante: ComprobanteTransferenciaSubido & { subidoPorNombre?: string | null };
    }
  | { ok: false; error: string }
> {
  try {
    if (!entrada.comprobante?.url) {
      return { ok: false, error: "Falta la URL del comprobante subido." };
    }
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return { ok: false, error: "Debes iniciar sesión para adjuntar evidencias al pedido." };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    let subidoPorNombre = user.email || "Operador";
    try {
      const { data: usu } = await db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo")
        .eq("usu_id", user.id)
        .maybeSingle();
      const nomComp = [usu?.usu_nombres, usu?.usu_apellidos].filter(Boolean).join(" ").trim();
      if (nomComp) subidoPorNombre = nomComp;
      else if (usu?.usu_correo) subidoPorNombre = String(usu.usu_correo);
    } catch {
      // Fallback al correo de auth
    }

    const ahoraIso = new Date().toISOString();
    const compPersistir = {
      url: entrada.comprobante.url,
      nombre_archivo: entrada.comprobante.nombreArchivo || "comprobante",
      mime_type: entrada.comprobante.mimeType || "image/jpeg",
      subido_en: entrada.comprobante.subidoEn || ahoraIso,
      referencia_opcional: entrada.comprobante.referenciaOpcional || "",
      subido_por_id: user.id,
      subido_por_nombre: subidoPorNombre,
    };

    let actualizado = false;

    // 1. Actualizar com_proforma si existe con ese ID
    if (entrada.pedidoId && /^[0-9a-f-]{36}$/i.test(entrada.pedidoId)) {
      const { data: prf } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_detalle_proforma")
        .eq("prf_id", entrada.pedidoId)
        .maybeSingle();
      if (prf?.prf_id) {
        const detPrev =
          prf.prf_detalle_proforma && typeof prf.prf_detalle_proforma === "object"
            ? prf.prf_detalle_proforma
            : {};
        const { error: errPrf } = await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_detalle_proforma: {
              ...detPrev,
              comprobante_transferencia: compPersistir,
              evidencias: {
                ...(detPrev.evidencias && typeof detPrev.evidencias === "object"
                  ? detPrev.evidencias
                  : {}),
                comprobante_pago: compPersistir,
              },
            },
            prf_actualizado_en: ahoraIso,
          })
          .eq("prf_id", prf.prf_id);
        if (errPrf) {
          return { ok: false, error: errPrf.message };
        }
        actualizado = true;
      }
    }

    // 2. Actualizar com_orden_taller (por ota_id o por ota_proforma_id)
    const idOtaBuscar = entrada.ordenTallerId || entrada.pedidoId;
    if (idOtaBuscar && /^[0-9a-f-]{36}$/i.test(idOtaBuscar)) {
      const { data: otaRows } = await db
        .schema("comun_comercio")
        .from("com_orden_taller")
        .select("ota_id, ota_detalle_orden")
        .or(`ota_id.eq.${idOtaBuscar},ota_proforma_id.eq.${entrada.pedidoId}`)
        .is("ota_eliminado_en", null)
        .limit(2);

      if (Array.isArray(otaRows) && otaRows.length > 0) {
        for (const ota of otaRows) {
          const detOta =
            ota.ota_detalle_orden && typeof ota.ota_detalle_orden === "object"
              ? ota.ota_detalle_orden
              : {};
          const { error: errOta } = await db
            .schema("comun_comercio")
            .from("com_orden_taller")
            .update({
              ota_detalle_orden: {
                ...detOta,
                comprobante_transferencia: compPersistir,
                evidencias: {
                  ...(detOta.evidencias && typeof detOta.evidencias === "object"
                    ? detOta.evidencias
                    : {}),
                  comprobante_pago: compPersistir,
                },
              },
              ota_actualizado_en: ahoraIso,
            })
            .eq("ota_id", ota.ota_id);
          if (errOta) {
            return { ok: false, error: errOta.message };
          }
          actualizado = true;
        }
      }
    }

    if (!actualizado) {
      return { ok: false, error: "No se encontró el pedido para guardar el comprobante." };
    }

    revalidatePath("/panel/pedidos");
    revalidatePath("/panel");
    return {
      ok: true,
      comprobante: {
        url: compPersistir.url,
        nombreArchivo: compPersistir.nombre_archivo,
        mimeType: compPersistir.mime_type,
        subidoEn: compPersistir.subido_en,
        referenciaOpcional: compPersistir.referencia_opcional,
        subidoPorNombre: compPersistir.subido_por_nombre,
      },
    };
  } catch (err: any) {
    return { ok: false, error: err?.message || "No se pudo adjuntar el comprobante al pedido." };
  }
}


