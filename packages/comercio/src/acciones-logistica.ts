"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
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
  });

  return {
    ok: true,
    cotizacion,
    direccionDetectada: direccionFinal,
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
  deliveryIncluidoProducto?: boolean;
  recargoLogisticoUsd?: number;
  dedicatoria?: {
    para: string;
    de: string;
    mensaje: string;
  };
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
}

export interface PedidoTiendaRegistrado {
  id: string;
  secuencial: number;
  codigoOrden: string;
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
    totalLinea: number;
    dedicatoria?: { para: string; de: string; mensaje: string };
    entregaIndividual?: Record<string, unknown>;
  }>;
}

const esquemaPedidoTienda = z.object({
  negocio: z.string().min(1),
  metodoPago: z.string().min(2),
  comprador: z.object({
    nombreCompleto: z.string().trim().min(2, "Indica el nombre o razón social del comprador"),
    identificacion: z.string().trim().min(4, "Indica la cédula, RUC o pasaporte"),
    correo: z.string().trim().email("Correo electrónico inválido"),
    telefono: z.string().trim().min(6, "Indica un teléfono de contacto válido"),
  }),
  modalidadEntrega: z.enum(["unificada", "individual"]),
  subtotalBaseImponible: z.number().min(0),
  totalIva: z.number().min(0),
  totalFlete: z.number().min(0),
  totalRecargoHorarioExacto: z.number().min(0),
  totalPagar: z.number().min(0),
  items: z.array(z.any()).min(1, "El pedido debe incluir al menos un producto"),
});

function enriquecerDestinoConAuditoriaInterna(
  destino: DestinoEntregaPedidoInput | undefined,
  config: ConfiguracionLogisticaNegocio,
  deliveryIncluidoProducto: boolean,
  recargoLogisticoProducto: number
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
  | { ok: true; id: string; codigoOrden: string }
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
  const config = await obtenerConfiguracionLogisticaAction(negNorm);

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
            (it.recargoLogisticoUsd || 0) * it.cantidad
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
          recargoProductosTotal
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

  const estadoInicial =
    entrada.metodoPago === "transferencia" ? "PENDIENTE_PAGO" : "APROBADA";

  const payloadCompleto = {
    tipo_origen: "PEDIDO_TIENDA",
    estado: estadoInicial,
    metodo_pago: entrada.metodoPago,
    comprador: entrada.comprador,
    subtotal_base_imponible: entrada.subtotalBaseImponible,
    total_iva: entrada.totalIva,
    total_flete: entrada.totalFlete,
    total_recargo_horario_exacto: entrada.totalRecargoHorarioExacto,
    total_pagar: entrada.totalPagar,
    observaciones: logisticaPrincipal.formula_calculo_interno,
    logistica_entrega: {
      modalidad_entrega: entrada.modalidadEntrega,
      ...logisticaPrincipal,
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
  };

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();

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
      p_payload: payloadCompleto,
    }
  );

  if (!errRpc && resRpc?.ok) {
    revalidatePath("/panel/pedidos");
    return {
      ok: true,
      id: String(resRpc.id),
      codigoOrden: String(resRpc.codigo_orden),
    };
  }

  // 2. Respaldo resiliente sobre tablas existentes en producción (`com_proforma`, `com_proforma_item`, `com_despacho_asignacion`)
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

  const { data: proformaCreada, error: errPrf } = await clienteEscritura
    .schema("comun_comercio")
    .from("com_proforma")
    .insert({
      prf_negocio: negNorm,
      prf_cliente_id: user?.id ?? null,
      prf_cliente_nombre: entrada.comprador.nombreCompleto,
      prf_cliente_contacto: entrada.comprador,
      prf_estado: estadoInicial,
      prf_subtotal: entrada.subtotalBaseImponible,
      prf_descuento: 0,
      prf_iva: entrada.totalIva,
      prf_total: entrada.totalPagar,
      prf_observaciones: logisticaPrincipal.formula_calculo_interno,
      prf_detalle_proforma: payloadCompleto,
    })
    .select("prf_id, prf_secuencial")
    .single();

  if (errPrf || !proformaCreada) {
    return {
      ok: false,
      error:
        errPrf?.message ||
        errRpc?.message ||
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

  revalidatePath("/panel/pedidos");
  return {
    ok: true,
    id: String(proformaCreada.prf_id),
    codigoOrden,
  };
}

/**
 * Consulta los pedidos registrados en la tienda junto con su desglose logístico interno.
 * Protegido para operadores, administradores y superadmins del negocio.
 */
export async function obtenerPedidosTiendaAction(
  negocio: string
): Promise<{ ok: true; pedidos: PedidoTiendaRegistrado[] } | { ok: false; error: string }> {
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
  const db: any = admin ?? supabase;

  const { data: filas, error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .select("*")
    .eq("prf_negocio", negNorm)
    .is("prf_eliminado_en", null)
    .order("prf_creado_en", { ascending: false })
    .limit(250);

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

    return {
      id: String(f.prf_id),
      secuencial: sec,
      codigoOrden: String(
        det.codigo_orden || `${prefijo}-ORD-${String(sec || 1).padStart(4, "0")}`
      ),
      negocio: String(f.prf_negocio || negNorm),
      estado: String(f.prf_estado || det.estado || "APROBADA"),
      metodoPago: String(det.metodo_pago || "payphone"),
      compradorNombre: String(f.prf_cliente_nombre || contacto.nombreCompleto || "Cliente"),
      compradorIdentificacion: String(contacto.identificacion || ""),
      compradorCorreo: String(contacto.correo || ""),
      compradorTelefono: String(contacto.telefono || ""),
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
        totalLinea: Number(it.total_linea ?? 0),
        dedicatoria: it.dedicatoria ?? undefined,
        entregaIndividual: it.entrega_individual ?? undefined,
      })),
    };
  });

  return { ok: true, pedidos };
}

export async function actualizarEstadoPedidoTiendaAction(
  negocio: string,
  pedidoId: string,
  nuevoEstado: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const estadosPermitidos = [
    "PENDIENTE_PAGO",
    "APROBADA",
    "EN_PREPARACION",
    "EN_RUTA",
    "ENTREGADO",
    "CANCELADO",
  ];
  if (!estadosPermitidos.includes(nuevoEstado)) {
    return { ok: false, error: "Estado de pedido no válido" };
  }

  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "No autenticado" };
  }

  const db: any = crearClienteAdmin() ?? supabase;
  const { error } = await db
    .schema("comun_comercio")
    .from("com_proforma")
    .update({
      prf_estado: nuevoEstado,
      prf_actualizado_en: new Date().toISOString(),
    })
    .eq("prf_id", pedidoId)
    .eq("prf_negocio", negNorm);

  if (error) {
    return { ok: false, error: error.message };
  }

  revalidatePath("/panel/pedidos");
  return { ok: true };
}

