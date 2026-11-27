"use server";

// Acciones del checkout con PLUX (TRQ-ADM-004).
import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { z } from "zod";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import {
  activarSuscripcionTrasPagoAction,
  asegurarFacturaElectronicaParaPago,
  type FacturaElectronicaResumen,
} from "./acciones";
import { cronometro, mensajeDeError, registrarTraza, type NivelTraza } from "@eco/auditoria/trazas";
import { obtenerEmisorRideNegocioAction } from "./acciones-facturacion-sri";
import { datosPaybox, respuestaExitosa, type PagadorPlux, type PagoPluxPreparado } from "./plux";
import {
  generarClaveAccesoSri49,
  type ConfiguracionEmisorSri,
  type LineaFacturaSriResumen,
} from "./ride-sri";
import {
  firmarOrdenRespaldoServidor,
  generarTokenEdicionTarjetaServidor,
  verificarOrdenRespaldoServidor,
} from "./token-orden-firmada";
import { obtenerConfiguracionTiendaCheckoutAction } from "./acciones-tienda-checkout";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PasarelaCheckout {
  pasarela: string;
  nombreVisible: string;
  ambiente: string;
}

// Pasarelas que el checkout puede ofrecer a quien está mirando.
export async function obtenerPasarelasCheckoutAction(negocio = "tranqi"): Promise<Resultado<PasarelaCheckout[]>> {
  const negPrincipal = normalizarIdentificadorNegocio(negocio).principal;
  const supabase: any = await crearClienteServidor();
  const [cfgTienda, resRpc] = await Promise.all([
    obtenerConfiguracionTiendaCheckoutAction(negPrincipal).catch(() => null),
    supabase
      .schema("comun_comercio")
      .rpc("com_fn_obtener_pasarelas_activas", { p_negocio: negPrincipal }),
  ]);

  // Interruptor maestro del negocio: si el procesamiento con tarjeta está deshabilitado, no exponer ninguna pasarela de tarjeta.
  if (cfgTienda && cfgTienda.tarjetaCreditoHabilitada === false) {
    return {
      ok: true,
      data: [],
    };
  }

  const lista: PasarelaCheckout[] = (resRpc?.data ?? []).map((p: any) => ({
    pasarela: p.pasarela,
    nombreVisible: p.nombre_visible,
    ambiente: p.ambiente,
  }));

  // Respaldo solo si com_fn_obtener_pasarelas_activas no devolvió filas por visibilidad en pruebas,
  // pero ÚNICAMENTE cuando la fila existe y está explícitamente activa (`psc_activo === true`).
  if (lista.length === 0) {
    const admin: any = crearClienteAdmin();
    if (admin) {
      const { data: rowPlux } = await admin
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .select("psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo")
        .eq("psc_negocio", negPrincipal)
        .eq("psc_pasarela", "PLUX")
        .eq("psc_activo", true)
        .is("psc_eliminado_en", null)
        .maybeSingle();

      if (rowPlux?.psc_activo) {
        lista.unshift({
          pasarela: "PLUX",
          nombreVisible: rowPlux.psc_nombre_visible || "PLUX (Tarjeta de Crédito / Débito)",
          ambiente: rowPlux.psc_ambiente || "PRUEBAS",
        });
      }
    }
  }

  return {
    ok: true,
    data: lista,
  };
}

const REGEX_IDENTIFICADOR_PLUX = /^[A-Z]{3}-PLX-[0-9A-F]{12}$/;

function prefijoPluxNegocio(negocioPrincipal: string): string {
  const n = negocioPrincipal.toLowerCase();
  if (n.includes("tinkay")) return "TNK";
  if (n.includes("margarita")) return "MRG";
  if (n.includes("fastfix")) return "FFH";
  return "TRQ";
}

function nombreComercioPorDefecto(negocioPrincipal: string): string {
  const n = negocioPrincipal.toLowerCase();
  if (n.includes("tinkay")) return "Tinkay Floristería";
  if (n.includes("margarita")) return "Margaritas Floristería";
  if (n.includes("fastfix")) return "FastFix Home";
  return "Tranqi";
}

const esquemaPagadorEstricto = z.object({
  nombre: z.string().trim().min(3).max(120),
  // Cédula, RUC o pasaporte: el checkout ofrece los tres y PLUX valida el suyo.
  identificacion: z.string().trim().regex(/^[A-Za-z0-9]{5,20}$/, "Identificación no válida"),
  email: z.string().trim().email().max(120),
  telefono: z.string().trim().min(7).max(20),
  direccion: z.string().trim().min(3).max(200),
});

// Para compras de tienda / Consumidor Final (< $50 USD) o retiro en tienda donde
// nombre, identificación, correo o teléfono pueden venir vacíos: se completan con
// valores estándar de Consumidor Final para el iframe Paybox de PLUX.
const esquemaPagadorFlexibleTienda = z.object({
  nombre: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t.length >= 2 ? t.slice(0, 120) : "CONSUMIDOR FINAL";
    }),
  identificacion: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim().replace(/[^A-Za-z0-9]/g, "");
      return t.length >= 5 ? t.slice(0, 20) : "9999999999";
    }),
  email: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(t) ? t.slice(0, 120) : "tinkay.uio@gmail.com";
    }),
  telefono: z
    .string()
    .optional()
    .transform((v) => {
      const limpio = (v ?? "").trim().replace(/[^\d+]/g, "");
      if (limpio.replace(/\D+/g, "").length >= 7) {
        return limpio.slice(0, 20);
      }
      return "0992922343";
    }),
  direccion: z
    .string()
    .optional()
    .transform((v) => {
      const t = (v ?? "").trim();
      return t.length >= 3 ? t.slice(0, 200) : "Retiro en Tienda - Quito";
    }),
});

const esquemaPreparar = z.object({
  negocio: z.string().min(1).default("tranqi"),
  varianteId: z.string().uuid(),
  pagador: esquemaPagadorEstricto,
});

export type ModalidadCobroProforma = "TOTAL_100" | "RESERVA_70" | "SALDO_30";

const esquemaPrepararProforma = z.object({
  negocio: z.string().min(1).default("tinkay"),
  proformaId: z.string().uuid(),
  tokenAprobacion: z.string().trim().min(8),
  respaldoFirmado: z.string().trim().min(8).optional(),
  modalidadCobro: z.enum(["TOTAL_100", "RESERVA_70", "SALDO_30"]).default("TOTAL_100"),
  pagador: esquemaPagadorFlexibleTienda,
});

// El monto lo fija la base de datos a partir de la variante: el navegador
// solo dice QUÉ compra, nunca CUÁNTO.
// Trazas del flujo PAGO_PLUX (TRQ-040): cada acción deja su resultado y su
// duración en comun_auditoria.aud_traza con el identificador PLUX como
// correlación, para ver dónde se quedó un pago que no terminó.
function trazaPlux(
  paso: string,
  nivel: NivelTraza,
  datos: { negocio?: string | null; correlacion?: string | null; mensaje?: string | null; duracionMs?: number; detalle?: Record<string, unknown> },
) {
  return registrarTraza({ flujo: "PAGO_PLUX", paso, nivel, ...datos });
}

async function conTrazaPlux<T>(
  paso: string,
  negocioEntrada: string | undefined,
  correlacionInicial: string | null,
  ejecutar: () => Promise<Resultado<T>>,
  correlacionDe: (data: T) => string | null,
  detalleDe: (data: T) => Record<string, unknown> = () => ({}),
): Promise<Resultado<T>> {
  const negocio = normalizarIdentificadorNegocio(negocioEntrada || "tranqi").principal;
  const fin = cronometro();
  try {
    const r = await ejecutar();
    if (r.ok) {
      await trazaPlux(`${paso}.ok`, "INFO", {
        negocio,
        correlacion: correlacionDe(r.data) ?? correlacionInicial,
        duracionMs: fin(),
        detalle: detalleDe(r.data),
      });
    } else {
      await trazaPlux(`${paso}.error`, "ERROR", { negocio, correlacion: correlacionInicial, mensaje: r.error, duracionMs: fin() });
    }
    return r;
  } catch (e) {
    await trazaPlux(`${paso}.excepcion`, "ERROR", {
      negocio,
      correlacion: correlacionInicial,
      mensaje: mensajeDeError(e),
      duracionMs: fin(),
      detalle: { pila: e instanceof Error ? e.stack?.split("\n").slice(0, 6).join("\n") : null },
    });
    throw e;
  }
}

type PagoPluxPreparadoAccion = { identificador: string; totalCentavos: number; paybox: ReturnType<typeof datosPaybox> };

export async function prepararPagoPluxAction(
  entrada: z.input<typeof esquemaPreparar>,
): Promise<Resultado<PagoPluxPreparadoAccion>> {
  return conTrazaPlux(
    "preparar",
    entrada?.negocio,
    null,
    () => prepararPagoPluxInterno(entrada),
    (d) => d.identificador,
    (d) => ({ total_centavos: d.totalCentavos, variante_id: entrada?.varianteId }),
  );
}

async function prepararPagoPluxInterno(
  entrada: z.input<typeof esquemaPreparar>,
): Promise<Resultado<PagoPluxPreparadoAccion>> {
  const v = esquemaPreparar.safeParse(entrada);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message || "Datos de facturación incompletos." };

  const negPrincipal = normalizarIdentificadorNegocio(v.data.negocio).principal;
  const cfgTienda = await obtenerConfiguracionTiendaCheckoutAction(negPrincipal).catch(() => null);
  if (cfgTienda && cfgTienda.tarjetaCreditoHabilitada === false) {
    return {
      ok: false,
      error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
    };
  }
  const supabase: any = await crearClienteServidor();
  const { data, error } = await supabase.schema("comun_comercio").rpc("com_fn_preparar_pago_plux", {
    p_negocio: negPrincipal,
    p_variante_id: v.data.varianteId,
    p_pagador: v.data.pagador,
  });

  if (!error && data?.ok) {
    const preparado = data as PagoPluxPreparado;
    return {
      ok: true,
      data: {
        identificador: preparado.identificador,
        totalCentavos: preparado.total_centavos,
        paybox: datosPaybox(preparado, v.data.pagador),
      },
    };
  }

  // Respaldo con service_role solo si la pasarela está explícitamente activa (ej. PRUEBAS con filtro probadores)
  const admin: any = crearClienteAdmin();
  if (admin) {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return { ok: false, error: "Inicia sesión para pagar." };
    }

    const [{ data: rowPlux }, { data: rowVar }] = await Promise.all([
      admin
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .select("*")
        .eq("psc_negocio", negPrincipal)
        .eq("psc_pasarela", "PLUX")
        .is("psc_eliminado_en", null)
        .maybeSingle(),
      admin
        .schema("comun_comercio")
        .from("com_variante")
        .select("var_id, var_producto_id, var_nombre, var_precio, var_tarifa_iva_porcentaje")
        .eq("var_id", v.data.varianteId)
        .maybeSingle(),
    ]);

    if (!rowPlux?.psc_activo) {
      return {
        ok: false,
        error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
      };
    }

    const esPresencialFallback = v.data.varianteId === "00000000-0000-4000-8000-000000000101";
    const precioBase = Number(rowVar?.var_precio ?? (esPresencialFallback ? 45 : 25));
    const tarifaIva = Number(rowVar?.var_tarifa_iva_porcentaje ?? 15);
    const baseCentavos = Math.round(precioBase * 100);
    const ivaCentavos = Math.round((baseCentavos * tarifaIva) / 100);
    const totalCentavos = baseCentavos + ivaCentavos;

    let nombreProd = "Consulta Jurídica";
    if (rowVar?.var_producto_id) {
      const { data: prodRow } = await admin
        .schema("comun_comercio")
        .from("com_producto")
        .select("pro_nombre")
        .eq("pro_id", rowVar.var_producto_id)
        .maybeSingle();
      if (prodRow?.pro_nombre) nombreProd = prodRow.pro_nombre;
    }

    const nombreVariante =
      rowVar?.var_nombre ||
      (esPresencialFallback ? "Consulta Presencial con Especialista" : "Consulta Telemática con Especialista");
    const hexRandom = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16))
      .join("")
      .toUpperCase();
    const identificador = `${prefijoPluxNegocio(negPrincipal)}-PLX-${hexRandom}`;
    const ambiente = rowPlux?.psc_ambiente || "PRUEBAS";
    const remail = rowPlux?.psc_credenciales_publicas?.remail || "admin.operaciones@tranqi24.com";
    const nombreComercio =
      rowPlux?.psc_credenciales_publicas?.nombre_comercio || nombreComercioPorDefecto(negPrincipal);
    const descripcion = `${nombreProd} - ${nombreVariante}`;

    await admin
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .insert({
        pag_negocio: negPrincipal,
        pag_cliente_id: user.id,
        pag_pasarela: "PLUX",
        pag_identificador_cliente: identificador,
        pag_estado: "PENDIENTE",
        pag_monto_total: totalCentavos / 100,
        pag_monto_con_iva: ivaCentavos > 0 ? baseCentavos / 100 : 0,
        pag_monto_sin_iva: ivaCentavos > 0 ? 0 : baseCentavos / 100,
        pag_monto_iva: ivaCentavos / 100,
        pag_moneda: "USD",
        pag_titular_email: v.data.pagador.email,
        pag_titular_telefono: v.data.pagador.telefono,
        pag_titular_identificacion: v.data.pagador.identificacion,
        pag_detalle_transaccion: {
          variante_id: rowVar?.var_id ?? v.data.varianteId,
          producto: nombreProd,
          variante: nombreVariante,
          ambiente,
          pagador: v.data.pagador,
        },
      });

    const preparado: PagoPluxPreparado = {
      identificador,
      ambiente,
      remail,
      nombre_comercio: nombreComercio,
      descripcion,
      base_centavos: baseCentavos,
      iva_centavos: ivaCentavos,
      total_centavos: totalCentavos,
    };

    return {
      ok: true,
      data: {
        identificador,
        totalCentavos,
        paybox: datosPaybox(preparado, v.data.pagador),
      },
    };
  }

  if (error) {
    // Al cliente le llega un mensaje genérico; el detalle queda en la traza.
    await trazaPlux("preparar.rpc_error", "ERROR", { negocio: negPrincipal, mensaje: error.message, detalle: { codigo: error.code } });
    return { ok: false, error: "No se pudo preparar el pago." };
  }
  return { ok: false, error: data?.error || "No se pudo preparar el pago." };
}

/**
 * Prepara el cobro PLUX sobre una proforma de evento o pedido de tienda (`com_proforma`),
 * admitiendo Pago Total (100%), Reserva del Evento (70%) o Saldo Restante (30%).
 * El importe siempre se calcula en el servidor a partir de `com_proforma`.
 */
export async function prepararPagoPluxProformaAction(
  entrada: z.input<typeof esquemaPrepararProforma>,
): Promise<Resultado<PagoPluxPreparadoAccion>> {
  return conTrazaPlux(
    "preparar_proforma",
    entrada?.negocio,
    null,
    () => prepararPagoPluxProformaInterno(entrada),
    (d) => d.identificador,
    (d) => ({ total_centavos: d.totalCentavos, proforma_id: entrada?.proformaId, modalidad: entrada?.modalidadCobro }),
  );
}

async function prepararPagoPluxProformaInterno(
  entrada: z.input<typeof esquemaPrepararProforma>,
): Promise<Resultado<PagoPluxPreparadoAccion>> {
  const v = esquemaPrepararProforma.safeParse(entrada);
  if (!v.success) {
    return { ok: false, error: v.error.issues[0]?.message || "Datos de facturación incompletos." };
  }

  const negPrincipal = normalizarIdentificadorNegocio(v.data.negocio).principal;
  const cfgTienda = await obtenerConfiguracionTiendaCheckoutAction(negPrincipal).catch(() => null);
  if (cfgTienda && cfgTienda.tarjetaCreditoHabilitada === false) {
    return {
      ok: false,
      error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
    };
  }
  const supabase: any = await crearClienteServidor();

  const { data, error } = await supabase.schema("comun_comercio").rpc("com_fn_preparar_pago_plux_proforma", {
    p_negocio: negPrincipal,
    p_proforma_id: v.data.proformaId,
    p_token: v.data.tokenAprobacion,
    p_pagador: v.data.pagador,
    p_modalidad_cobro: v.data.modalidadCobro,
  });

  if (!error && data?.ok) {
    const preparado = data as PagoPluxPreparado;
    return {
      ok: true,
      data: {
        identificador: preparado.identificador,
        totalCentavos: preparado.total_centavos,
        paybox: datosPaybox(preparado, v.data.pagador),
      },
    };
  }

  // Si la RPC respondió explícitamente que la pasarela está inactiva/deshabilitada, respetar sin fallback
  if (!error && data?.ok === false && /no está activa|deshabilitad/i.test(String(data.error || ""))) {
    return { ok: false, error: data.error };
  }

  // Respaldo resiliente con service_role si la migración RPC aún no se aplicó en remoto
  const admin: any = crearClienteAdmin();
  if (admin) {
    const { data: proforma } = await admin
      .schema("comun_comercio")
      .from("com_proforma")
      .select("*")
      .eq("prf_id", v.data.proformaId)
      .eq("prf_token_aprobacion", v.data.tokenAprobacion)
      .eq("prf_negocio", negPrincipal)
      .is("prf_eliminado_en", null)
      .maybeSingle();

    if (!proforma) {
      return { ok: false, error: "Proforma u orden no encontrada o token inválido." };
    }
    if (proforma.prf_estado === "RECHAZADA" || proforma.prf_estado === "VENCIDA") {
      return { ok: false, error: "Esta proforma ya no se encuentra vigente." };
    }

    // Buscar credenciales PLUX de la empresa actual; si el negocio deshabilitó PLUX explícitamente, NO heredar de tranqi
    let { data: rowPlux } = await admin
      .schema("comun_comercio")
      .from("com_pasarela_configuracion")
      .select("*")
      .eq("psc_negocio", negPrincipal)
      .eq("psc_pasarela", "PLUX")
      .is("psc_eliminado_en", null)
      .maybeSingle();

    if (rowPlux && rowPlux.psc_activo === false) {
      return {
        ok: false,
        error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
      };
    }

    if (!rowPlux?.psc_credenciales_publicas?.remail) {
      const { data: rowPluxTranqi } = await admin
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .select("*")
        .eq("psc_negocio", "tranqi")
        .eq("psc_pasarela", "PLUX")
        .eq("psc_activo", true)
        .is("psc_eliminado_en", null)
        .maybeSingle();
      if (rowPluxTranqi) {
        rowPlux = {
          ...rowPluxTranqi,
          psc_credenciales_publicas: {
            ...(rowPluxTranqi.psc_credenciales_publicas || {}),
            nombre_comercio: nombreComercioPorDefecto(negPrincipal),
          },
        };
      }
    }

    if (!rowPlux?.psc_activo) {
      return {
        ok: false,
        error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
      };
    }

    const remail = rowPlux?.psc_credenciales_publicas?.remail;
    if (!remail) {
      return { ok: false, error: "La pasarela PLUX aún no tiene correo de comercio configurado." };
    }

    const detPrf = (proforma.prf_detalle_proforma as Record<string, any>) || {};
    const totalOrdenCentavos = Math.round(Number(proforma.prf_total || 0) * 100);
    const ivaOrdenCentavos = Math.round(Number(proforma.prf_iva ?? detPrf.total_iva ?? 0) * 100);
    const abonadoPrevioCentavos = Math.round(Number(detPrf.monto_abonado_usd || 0) * 100);

    if (totalOrdenCentavos <= 0) {
      return { ok: false, error: "El importe de la proforma no es válido." };
    }
    if (proforma.prf_estado === "APROBADA" && abonadoPrevioCentavos >= totalOrdenCentavos) {
      return { ok: false, error: "Esta proforma ya se encuentra pagada en su totalidad." };
    }

    const baseGravadaOrden =
      detPrf.base_iva_gravada_centavos !== undefined
        ? Number(detPrf.base_iva_gravada_centavos)
        : ivaOrdenCentavos > 0
          ? Math.min(totalOrdenCentavos - ivaOrdenCentavos, Math.round((ivaOrdenCentavos * 100) / 15))
          : 0;
    const base0Orden = Math.max(0, totalOrdenCentavos - ivaOrdenCentavos - baseGravadaOrden);

    let factor = 1;
    let totalCobro = totalOrdenCentavos;
    let etiquetaModalidad = "Pago Total (100%)";

    if (v.data.modalidadCobro === "RESERVA_70") {
      factor = 0.7;
      totalCobro = Math.round(totalOrdenCentavos * 0.7);
      etiquetaModalidad = "Reserva Evento (70%)";
    } else if (v.data.modalidadCobro === "SALDO_30") {
      totalCobro =
        abonadoPrevioCentavos > 0
          ? Math.max(0, totalOrdenCentavos - abonadoPrevioCentavos)
          : totalOrdenCentavos - Math.round(totalOrdenCentavos * 0.7);
      if (totalCobro <= 0) {
        return { ok: false, error: "No existe saldo pendiente por pagar en esta proforma." };
      }
      factor = totalCobro / totalOrdenCentavos;
      etiquetaModalidad = "Saldo Evento (30%)";
    } else if (abonadoPrevioCentavos > 0 && abonadoPrevioCentavos < totalOrdenCentavos) {
      totalCobro = totalOrdenCentavos - abonadoPrevioCentavos;
      factor = totalCobro / totalOrdenCentavos;
      etiquetaModalidad = "Saldo Pendiente";
    }

    const ivaCobro = Math.round(ivaOrdenCentavos * factor);
    const baseGravadaCobro = Math.min(totalCobro - ivaCobro, Math.round(baseGravadaOrden * factor));
    const base0Cobro = Math.max(0, totalCobro - ivaCobro - baseGravadaCobro);
    const baseTotalCobro = base0Cobro + baseGravadaCobro;

    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();

    const hexRandom = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16))
      .join("")
      .toUpperCase();
    const identificador = `${prefijoPluxNegocio(negPrincipal)}-PLX-${hexRandom}`;
    const ambiente = rowPlux?.psc_ambiente || "PRUEBAS";
    const nombreComercio =
      rowPlux?.psc_credenciales_publicas?.nombre_comercio || nombreComercioPorDefecto(negPrincipal);
    const codigoDoc =
      detPrf.codigo_proforma ||
      detPrf.codigo_orden ||
      `${prefijoPluxNegocio(negPrincipal)}-PRF-${String(proforma.prf_secuencial || 1).padStart(4, "0")}`;
    const descripcion = `${codigoDoc} - ${etiquetaModalidad}`.slice(0, 120);

    const { error: errInsert } = await admin
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .insert({
        pag_negocio: negPrincipal,
        pag_cliente_id: proforma.prf_cliente_id || authUser?.id || null,
        pag_pasarela: "PLUX",
        pag_identificador_cliente: identificador,
        pag_estado: "PENDIENTE",
        pag_monto_total: totalCobro / 100,
        pag_monto_con_iva: baseGravadaCobro / 100,
        pag_monto_sin_iva: base0Cobro / 100,
        pag_monto_iva: ivaCobro / 100,
        pag_moneda: "USD",
        pag_referencia_id: proforma.prf_id,
        pag_titular_email: v.data.pagador.email,
        pag_titular_telefono: v.data.pagador.telefono,
        pag_titular_identificacion: v.data.pagador.identificacion,
        pag_detalle_transaccion: {
          origen: "PROFORMA",
          proforma_id: proforma.prf_id,
          codigo_proforma: codigoDoc,
          modalidad_cobro: v.data.modalidadCobro,
          producto: descripcion,
          ambiente,
          pagador: v.data.pagador,
        },
      });

    if (errInsert) {
      return { ok: false, error: `No se pudo registrar la intención de pago: ${errInsert.message}` };
    }

    const preparado: PagoPluxPreparado = {
      identificador,
      ambiente,
      remail,
      nombre_comercio: nombreComercio,
      descripcion,
      base_centavos: baseTotalCobro,
      base0_centavos: base0Cobro,
      base_gravada_centavos: baseGravadaCobro,
      iva_centavos: ivaCobro,
      total_centavos: totalCobro,
    };

    return {
      ok: true,
      data: {
        identificador,
        totalCentavos: totalCobro,
        paybox: datosPaybox(preparado, v.data.pagador),
      },
    };
  }

  // Respaldo firmado en servidor (HMAC-SHA256) para compradores invitados o migraciones pendientes sin service_role
  const ordenFirmada = verificarOrdenRespaldoServidor(
    v.data.respaldoFirmado || v.data.tokenAprobacion,
  );
  if (ordenFirmada && ordenFirmada.id === v.data.proformaId && ordenFirmada.neg === negPrincipal) {
    let pasarelaActiva: any = null;
    try {
      const { data: pasarelasPropias } = await supabase
        .schema("comun_comercio")
        .rpc("com_fn_obtener_pasarelas_activas", { p_negocio: negPrincipal });
      pasarelaActiva = (pasarelasPropias ?? []).find((p: any) => p.pasarela === "PLUX") || null;
    } catch {
      pasarelaActiva = null;
    }

    if (!pasarelaActiva?.credenciales_publicas?.remail) {
      return {
        ok: false,
        error: "El procesamiento con tarjeta de crédito/débito está deshabilitado para este comercio.",
      };
    }

    const remail = pasarelaActiva.credenciales_publicas.remail;
    const ambiente = pasarelaActiva.ambiente || "PRUEBAS";
    const nombreComercio =
      pasarelaActiva.credenciales_publicas.nombre_comercio || nombreComercioPorDefecto(negPrincipal);

    const totalOrdenCentavos = Math.round(Number(ordenFirmada.tot || 0) * 100);
    const ivaOrdenCentavos = Math.round(Number(ordenFirmada.iva || 0) * 100);
    if (totalOrdenCentavos <= 0) {
      return { ok: false, error: "El importe del pedido no es válido." };
    }

    const baseGravadaOrden = Math.max(0, Number(ordenFirmada.bgc || 0));
    const base0Orden = Math.max(
      0,
      ordenFirmada.b0c !== undefined
        ? Number(ordenFirmada.b0c)
        : totalOrdenCentavos - ivaOrdenCentavos - baseGravadaOrden,
    );

    let factor = 1;
    let totalCobro = totalOrdenCentavos;
    let etiquetaModalidad = "Pago Total (100%)";

    if (v.data.modalidadCobro === "RESERVA_70") {
      factor = 0.7;
      totalCobro = Math.round(totalOrdenCentavos * 0.7);
      etiquetaModalidad = "Reserva Evento (70%)";
    } else if (v.data.modalidadCobro === "SALDO_30") {
      totalCobro = totalOrdenCentavos - Math.round(totalOrdenCentavos * 0.7);
      factor = totalCobro / totalOrdenCentavos;
      etiquetaModalidad = "Saldo Evento (30%)";
    }

    const ivaCobro = Math.round(ivaOrdenCentavos * factor);
    const baseGravadaCobro = Math.min(totalCobro - ivaCobro, Math.round(baseGravadaOrden * factor));
    const base0Cobro = Math.max(0, totalCobro - ivaCobro - baseGravadaCobro);
    const baseTotalCobro = base0Cobro + baseGravadaCobro;

    const hexRandom = Array.from({ length: 12 }, () => Math.floor(Math.random() * 16).toString(16))
      .join("")
      .toUpperCase();
    const identificador = `${prefijoPluxNegocio(negPrincipal)}-PLX-${hexRandom}`;
    const descripcion = `${ordenFirmada.cod} - ${etiquetaModalidad}`.slice(0, 120);

    const preparado: PagoPluxPreparado = {
      identificador,
      ambiente,
      remail,
      nombre_comercio: nombreComercio,
      descripcion,
      base_centavos: baseTotalCobro,
      base0_centavos: base0Cobro,
      base_gravada_centavos: baseGravadaCobro,
      iva_centavos: ivaCobro,
      total_centavos: totalCobro,
    };

    return {
      ok: true,
      data: {
        identificador,
        totalCentavos: totalCobro,
        paybox: datosPaybox(preparado, v.data.pagador),
      },
    };
  }

  if (error) return { ok: false, error: error.message || "No se pudo preparar el pago con PLUX." };
  return { ok: false, error: data?.error || "No se pudo preparar el pago con PLUX." };
}

export type EstadoPagoPlux = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO" | "REVERSADO";

export interface PagoPluxConsultado {
  pagoId?: string | null;
  pasarela?: string;
  estado: EstadoPagoPlux;
  motivo: string | null;
  autorizacion: string | null;
  marcaTarjeta: string | null;
  ultimosDigitos: string | null;
  facturaElectronica?: FacturaElectronicaResumen | null;
  emisorFactura?: ConfiguracionEmisorSri | null;
}

// Lo consulta el checkout mientras espera el webhook. La RLS
// (com_pago_cliente_select) limita la lectura a los pagos propios.
export async function consultarPagoPluxAction(
  identificador: string,
): Promise<Resultado<PagoPluxConsultado>> {
  if (!REGEX_IDENTIFICADOR_PLUX.test(identificador)) return { ok: false, error: "Pago desconocido." };
  const supabase: any = await crearClienteServidor();
  const { data } = await supabase
    .schema("comun_comercio")
    .from("com_transaccion_pago")
    .select("pag_id, pag_estado, pag_autorizacion_codigo, pag_tarjeta_marca, pag_tarjeta_ultimos_digitos, pag_detalle_transaccion")
    .eq("pag_identificador_cliente", identificador)
    .maybeSingle();

  if (data) {
    return {
      ok: true,
      data: {
        pagoId: data.pag_id,
        pasarela: "PLUX",
        estado: data.pag_estado,
        motivo: data.pag_detalle_transaccion?.motivo ?? null,
        autorizacion: data.pag_autorizacion_codigo,
        marcaTarjeta: data.pag_tarjeta_marca,
        ultimosDigitos: data.pag_tarjeta_ultimos_digitos,
      },
    };
  }

  // Consulta pública acotada para compradores invitados o proformas compartidas por enlace
  try {
    const { data: rpcPub } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_consultar_pago_plux_publico", { p_identificador: identificador });
    if (rpcPub?.ok) {
      return {
        ok: true,
        data: {
          pagoId: rpcPub.pago_id ?? rpcPub.pagoId ?? null,
          pasarela: "PLUX",
          estado: rpcPub.estado,
          motivo: rpcPub.motivo ?? null,
          autorizacion: rpcPub.autorizacion ?? null,
          marcaTarjeta: rpcPub.marca_tarjeta ?? rpcPub.marcaTarjeta ?? null,
          ultimosDigitos: rpcPub.ultimos_digitos ?? rpcPub.ultimosDigitos ?? null,
          facturaElectronica: rpcPub.factura_electronica ?? null,
        },
      };
    }
  } catch {
    // Continuar al respaldo admin
  }

  const admin: any = crearClienteAdmin();
  if (admin) {
    const { data: rowAdmin } = await admin
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .select("pag_id, pag_estado, pag_autorizacion_codigo, pag_tarjeta_marca, pag_tarjeta_ultimos_digitos, pag_detalle_transaccion")
      .eq("pag_identificador_cliente", identificador)
      .maybeSingle();
    if (rowAdmin) {
      return {
        ok: true,
        data: {
          pagoId: rowAdmin.pag_id,
          pasarela: "PLUX",
          estado: rowAdmin.pag_estado,
          motivo: rowAdmin.pag_detalle_transaccion?.motivo ?? null,
          autorizacion: rowAdmin.pag_autorizacion_codigo,
          marcaTarjeta: rowAdmin.pag_tarjeta_marca,
          ultimosDigitos: rowAdmin.pag_tarjeta_ultimos_digitos,
        },
      };
    }
  }

  return { ok: false, error: "Pago desconocido." };
}

/**
 * Confirma inmediatamente el pago tras la respuesta exitosa (`onAuthorize`) del
 * paybox de PLUX, registrando la autorización, activando la suscripción y
 * enviando la notificación in-app sin depender de que el webhook de sandbox llegue.
 */
// Suscripción = producto SUSCRIPCION o variante recurrente (mismo criterio que
// confirmarPagoPayphoneAction y que el respaldo directo de arriba).
async function esVarianteSuscripcion(db: any, varianteId: string): Promise<boolean> {
  try {
    const { data: variante } = await db
      .schema("comun_comercio")
      .from("com_variante")
      .select("var_tipo_oferta, var_frecuencia_recurrencia, var_producto_id")
      .eq("var_id", varianteId)
      .maybeSingle();
    if (!variante) return false;
    const tipo = String(variante.var_tipo_oferta || "").toUpperCase();
    if (tipo.startsWith("RECURRENTE") || tipo === "SUSCRIPCION" || variante.var_frecuencia_recurrencia) return true;
    const { data: producto } = await db
      .schema("comun_comercio")
      .from("com_producto")
      .select("pro_tipo")
      .eq("pro_id", variante.var_producto_id)
      .maybeSingle();
    return String(producto?.pro_tipo || "").toUpperCase() === "SUSCRIPCION";
  } catch {
    return false;
  }
}

type EntradaConfirmarPlux = {
  negocio?: string;
  identificador: string;
  respuestaPaybox: unknown;
  tokenAprobacion?: string;
  pagador?: PagadorPlux;
  modalidadCobro?: ModalidadCobroProforma;
  omitirFacturaAutomatica?: boolean;
  atribucion?: {
    fbc?: string;
    fbp?: string;
    eventSourceUrl?: string;
  };
};

export async function confirmarPagoPluxAction(entrada: EntradaConfirmarPlux): Promise<Resultado<PagoPluxConsultado>> {
  const correlacion = typeof entrada?.identificador === "string" ? entrada.identificador.slice(0, 80) : null;
  return conTrazaPlux(
    "confirmar",
    entrada?.negocio,
    correlacion,
    () => confirmarPagoPluxInterno(entrada),
    () => correlacion,
    (d) => ({ estado: d.estado, motivo: d.motivo, factura: d.facturaElectronica?.numero_comprobante ?? null }),
  );
}

async function confirmarPagoPluxInterno(entrada: EntradaConfirmarPlux): Promise<Resultado<PagoPluxConsultado>> {
  const { identificador, respuestaPaybox } = entrada;
  const negocio = normalizarIdentificadorNegocio(entrada.negocio || "tranqi").principal;
  const ordenFirmada = entrada.tokenAprobacion
    ? verificarOrdenRespaldoServidor(entrada.tokenAprobacion)
    : null;
  const omitirFactura =
    Boolean(entrada.omitirFacturaAutomatica) || ordenFirmada?.ori === "LINK_PAGO_CHAT";

  if (!REGEX_IDENTIFICADOR_PLUX.test(identificador)) {
    return { ok: false, error: "Pago desconocido." };
  }
  if (!respuestaExitosa(respuestaPaybox)) {
    const r = (respuestaPaybox ?? {}) as Record<string, unknown>;
    await trazaPlux("confirmar.respuesta_no_exitosa", "AVISO", {
      negocio,
      correlacion: identificador,
      // Solo estado y nombres de campos: la respuesta la manda el navegador.
      detalle: { status: r.status ?? null, descripcion: r.description ?? null, claves: Object.keys(r).slice(0, 30) },
    });
    return { ok: false, error: "La respuesta de PLUX no indica autorización exitosa." };
  }

  const raw: any = respuestaPaybox ?? {};
  const det: any = raw?.detail && typeof raw.detail === "object" ? raw.detail : raw;

  const autorizacion = String(det.token || det.id_transaccion || det.idTransaction || det.numAutorizacion || identificador);
  const idTransaccion = String(det.id_transaccion || det.idTransaction || det.token || identificador);
  const marcaTarjeta = String(det.cardIssuer || det.marca || "TARJETA").toUpperCase();
  const cardDigits = String(det.cardInfo || det.tarjeta || "").replace(/\D+/g, "");
  const ultimosDigitos = cardDigits.length >= 4 ? cardDigits.slice(-4) : String(det.cardInfo || "").trim().slice(-4) || "0000";
  const tipoTarjeta = String(det.cardType || "").toLowerCase().includes("debit") ? "DEBITO" : "CREDITO";

  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const clienteDb: any = admin || supabase;
  const emisorFactura = await obtenerEmisorRideNegocioAction(negocio);

  // 1. Leer la transacción pendiente (con clienteDb para cubrir tanto usuarios autenticados como invitados en proformas)
  const { data: pago } = await clienteDb
    .schema("comun_comercio")
    .from("com_transaccion_pago")
    .select("pag_id, pag_negocio, pag_cliente_id, pag_estado, pag_monto_total, pag_titular_email, pag_autorizacion_codigo, pag_tarjeta_marca, pag_tarjeta_ultimos_digitos, pag_detalle_transaccion")
    .eq("pag_identificador_cliente", identificador)
    .maybeSingle();

  if (!pago) {
    await trazaPlux("confirmar.pago_no_encontrado", "AVISO", {
      negocio,
      correlacion: identificador,
      mensaje: admin ? "No hay com_transaccion_pago con ese identificador" : "Sin cliente admin: la RLS puede ocultar el pago",
    });
  }

  const esLinkPagoChat =
    omitirFactura ||
    String((pago?.pag_detalle_transaccion as Record<string, any> | null)?.tipo_origen || "") ===
      "LINK_PAGO_CHAT";

  // Sin revalidatePath("/panel"): Next aplicaría la recarga en el cliente en
  // cuanto termina esta acción, con el checkout aún abierto. El panel se
  // reordena (plan activo) y desmonta el modal antes del recibo. El checkout
  // refresca la página cuando el cliente cierra el recibo.
  if (pago?.pag_estado === "APROBADO") {
    let facturaPrevia: FacturaElectronicaResumen | null = null;
    if (!esLinkPagoChat) {
      try {
        facturaPrevia = await asegurarFacturaElectronicaParaPago(clienteDb, {
          identificador,
          negocio,
        });
      } catch {
        // Continuar
      }
    }
    return {
      ok: true,
      data: {
        pagoId: pago.pag_id,
        pasarela: "PLUX",
        estado: "APROBADO",
        motivo: null,
        autorizacion: pago.pag_autorizacion_codigo || autorizacion,
        marcaTarjeta: pago.pag_tarjeta_marca || marcaTarjeta,
        ultimosDigitos: pago.pag_tarjeta_ultimos_digitos || ultimosDigitos,
        facturaElectronica: facturaPrevia,
        emisorFactura,
      },
    };
  }

  const montoNotificado = det.amount !== undefined && det.amount !== null ? det.amount : pago?.pag_monto_total;
  const notificacionNormalizada = {
    ...det,
    extras: identificador,
    state: "PAGADO",
    amount: String(montoNotificado ?? pago?.pag_monto_total ?? "0"),
    id_transaccion: idTransaccion,
    token: autorizacion,
    cardIssuer: marcaTarjeta,
    cardType: tipoTarjeta === "DEBITO" ? "debit" : "credit",
    cardInfo: ultimosDigitos,
  };

  // 2. Intentar confirmar mediante RPC transaccional (cliente o service_role)
  let confirmadoPorRpc = false;
  let facturaDesdeRpc: FacturaElectronicaResumen | null = null;
  try {
    const { data: rpcClienteRes, error: rpcClienteErr } = await supabase
      .schema("comun_comercio")
      .rpc("com_fn_confirmar_pago_plux_cliente", {
        p_negocio: negocio,
        p_identificador: identificador,
        p_notificacion: notificacionNormalizada,
      });
    if (rpcClienteErr || !rpcClienteRes?.ok || rpcClienteRes?.estado !== "APROBADO") {
      await trazaPlux("confirmar.rpc_cliente_sin_aprobar", "INFO", {
        negocio,
        correlacion: identificador,
        mensaje: rpcClienteErr?.message ?? rpcClienteRes?.error ?? rpcClienteRes?.motivo ?? null,
        detalle: { estado: rpcClienteRes?.estado ?? null, codigo: rpcClienteErr?.code ?? null },
      });
    }
    if (!rpcClienteErr && rpcClienteRes?.ok && rpcClienteRes?.estado === "APROBADO") {
      confirmadoPorRpc = true;
      if (rpcClienteRes.factura_electronica?.clave_acceso) {
        facturaDesdeRpc = {
          ...(rpcClienteRes.factura_electronica as FacturaElectronicaResumen),
          emisor: emisorFactura,
        };
      }
    }
  } catch (e) {
    // Continúa al siguiente mecanismo si la migración aún no está aplicada
    await trazaPlux("confirmar.rpc_cliente_excepcion", "AVISO", { negocio, correlacion: identificador, mensaje: mensajeDeError(e) });
  }

  if (!confirmadoPorRpc && admin) {
    try {
      const { data: rpcAdminRes, error: rpcAdminErr } = await admin
        .schema("comun_comercio")
        .rpc("com_fn_confirmar_pago_plux", {
          p_negocio: negocio,
          p_notificacion: notificacionNormalizada,
        });
      if (!rpcAdminErr && rpcAdminRes?.ok && rpcAdminRes?.estado === "APROBADO") {
        confirmadoPorRpc = true;
      } else {
        await trazaPlux("confirmar.rpc_admin_sin_aprobar", "AVISO", {
          negocio,
          correlacion: identificador,
          mensaje: rpcAdminErr?.message ?? rpcAdminRes?.error ?? rpcAdminRes?.motivo ?? null,
          detalle: { estado: rpcAdminRes?.estado ?? null, codigo: rpcAdminErr?.code ?? null },
        });
      }
    } catch (e) {
      // Continúa al respaldo directo
      await trazaPlux("confirmar.rpc_admin_excepcion", "AVISO", { negocio, correlacion: identificador, mensaje: mensajeDeError(e) });
    }
  }
  if (!confirmadoPorRpc) {
    await trazaPlux("confirmar.respaldo_directo", "AVISO", {
      negocio,
      correlacion: identificador,
      mensaje: "Ninguna RPC confirmó el pago; se usa el respaldo directo en tablas",
    });
  }

  // 3. Respaldo directo en tablas y activación de suscripción en memoria/BDD
  const {
    data: { user: usuarioSesionActual },
  } = await supabase.auth.getUser();
  const detPrevio = (pago?.pag_detalle_transaccion as Record<string, any>) || {};
  const varianteId = detPrevio.variante_id;
  const productoNombre =
    detPrevio.producto ||
    (ordenFirmada
      ? `${ordenFirmada.cod} (${ordenFirmada.itm[0]?.dsc || "Pedido Floral"})`
      : negocio === "tranqi"
        ? "Plan de Protección Jurídica"
        : `Pedido ${nombreComercioPorDefecto(negocio)}`);
  const pagadorNombre =
    detPrevio.pagador?.nombre ||
    entrada.pagador?.nombre ||
    ordenFirmada?.cmp?.nom ||
    "Cliente";

  const correoSesionNorm = String(usuarioSesionActual?.email || "").trim().toLowerCase();
  const correoIngresadoOrden = String(
    ordenFirmada?.cmp?.cor || entrada.pagador?.email || "",
  )
    .trim()
    .toLowerCase();
  const correoCompradorReal =
    [
      ordenFirmada?.cmp?.cor,
      entrada.pagador?.email,
      usuarioSesionActual?.email,
      detPrevio.pagador?.email,
      pago?.pag_titular_email,
    ]
      .map((c) => String(c || "").trim())
      .filter((c) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(c))
      .find((c) => {
        const low = c.toLowerCase();
        if (low === "cliente@ecosistema.ec") return false;
        if (
          low === "tinkay.uio@gmail.com" &&
          correoSesionNorm !== "tinkay.uio@gmail.com" &&
          correoIngresadoOrden !== "tinkay.uio@gmail.com"
        ) {
          return false;
        }
        return true;
      }) || null;

  const pagadorEmail =
    correoCompradorReal ||
    pago?.pag_titular_email ||
    detPrevio.pagador?.email ||
    entrada.pagador?.email ||
    ordenFirmada?.cmp?.cor ||
    "cliente@ecosistema.ec";

  if (!confirmadoPorRpc && clienteDb && pago) {
    try {
      await clienteDb
        .schema("comun_comercio")
        .from("com_transaccion_pago")
        .update({
          pag_estado: "APROBADO",
          pag_transaccion_pasarela_id: idTransaccion,
          pag_autorizacion_codigo: autorizacion,
          pag_tarjeta_tipo: tipoTarjeta,
          pag_tarjeta_marca: marcaTarjeta,
          pag_tarjeta_ultimos_digitos: ultimosDigitos,
          pag_confirmado_en: new Date().toISOString(),
          pag_detalle_transaccion: {
            ...detPrevio,
            paybox_on_authorize: notificacionNormalizada,
          },
          pag_actualizado_en: new Date().toISOString(),
        })
        .eq("pag_id", pago.pag_id);

      if (varianteId && pago.pag_cliente_id) {
        const { data: varRow } = await clienteDb
          .schema("comun_comercio")
          .from("com_variante")
          .select("var_id, var_tipo_oferta, var_frecuencia_recurrencia")
          .eq("var_id", varianteId)
          .maybeSingle();

        if (varRow && (String(varRow.var_tipo_oferta || "").startsWith("RECURRENTE") || varRow.var_frecuencia_recurrencia)) {
          const frecuencia =
            varRow.var_frecuencia_recurrencia ||
            (varRow.var_tipo_oferta === "RECURRENTE_ANUAL" ? "ANUAL" : "MENSUAL");
          const proximoCobro = new Date();
          if (frecuencia === "ANUAL") proximoCobro.setFullYear(proximoCobro.getFullYear() + 1);
          else if (frecuencia === "QUINCENAL") proximoCobro.setDate(proximoCobro.getDate() + 15);
          else if (frecuencia === "SEMANAL") proximoCobro.setDate(proximoCobro.getDate() + 7);
          else proximoCobro.setMonth(proximoCobro.getMonth() + 1);

          await clienteDb
            .schema("comun_comercio")
            .from("com_suscripcion")
            .insert({
              sub_negocio: negocio,
              sub_cliente_id: pago.pag_cliente_id,
              sub_variante_id: varianteId,
              sub_estado: "ACTIVA",
              sub_frecuencia: frecuencia,
              sub_monto_periodo: pago.pag_monto_total,
              sub_proximo_cobro_en: proximoCobro.toISOString(),
              sub_ultimo_cobro_en: new Date().toISOString(),
              sub_detalle_suscripcion: { pago_id: pago.pag_id, pasarela: "PLUX", autorizacion },
            });
        }
      }

      // Actualizar estado de proforma/orden de tienda (RESERVADA_70 o APROBADA) cuando aplica
      const proformaIdDestino = detPrevio.proforma_id;
      if (proformaIdDestino) {
        const { data: prfActual } = await clienteDb
          .schema("comun_comercio")
          .from("com_proforma")
          .select("prf_id, prf_total, prf_estado, prf_detalle_proforma")
          .eq("prf_id", proformaIdDestino)
          .maybeSingle();

        if (prfActual) {
          const detPrfActual = (prfActual.prf_detalle_proforma as Record<string, any>) || {};
          const abonadoPrevio = Number(detPrfActual.monto_abonado_usd || 0);
          const nuevoAbonado = Math.round((abonadoPrevio + Number(pago.pag_monto_total || 0)) * 100) / 100;
          const saldoPendiente = Math.max(
            0,
            Math.round((Number(prfActual.prf_total || 0) - nuevoAbonado) * 100) / 100,
          );
          const esProformaEvento = String(detPrfActual.tipo_origen || "") === "PROFORMA_EVENTO";
          const nuevoEstadoPrf =
            detPrevio.modalidad_cobro === "RESERVA_70" && saldoPendiente > 0.01
              ? "RESERVADA_70"
              : esProformaEvento
                ? "APROBADA"
                : "NUEVO_CONFIRMADO";
          const pagosPluxPrevios = Array.isArray(detPrfActual.pagos_plux) ? detPrfActual.pagos_plux : [];

          const evidenciaPluxCompleta = {
            pago_id: pago.pag_id,
            identificador,
            autorizacion,
            marca_tarjeta: marcaTarjeta,
            ultimos_digitos: ultimosDigitos,
            monto_usd: Number(pago.pag_monto_total || 0),
            modalidad_cobro: detPrevio.modalidad_cobro || "TOTAL_100",
            estado: "APROBADO",
            confirmado_en: new Date().toISOString(),
            respuesta_raw: raw,
          };

          await clienteDb
            .schema("comun_comercio")
            .from("com_proforma")
            .update({
              prf_estado: nuevoEstadoPrf,
              prf_detalle_proforma: {
                ...detPrfActual,
                estado: nuevoEstadoPrf,
                metodo_pago: "plux",
                estado_pago: saldoPendiente <= 0.01 ? "PAGADO_TOTAL" : "ABONO_RESERVA_70",
                monto_abonado_usd: nuevoAbonado,
                saldo_pendiente_usd: saldoPendiente,
                aprobada_en: new Date().toISOString(),
                ultimo_pago_plux: evidenciaPluxCompleta,
                evidencias: {
                  ...(detPrfActual.evidencias && typeof detPrfActual.evidencias === "object"
                    ? detPrfActual.evidencias
                    : {}),
                  respuesta_plux: evidenciaPluxCompleta,
                },
                pagos_plux: [
                  ...pagosPluxPrevios,
                  {
                    identificador,
                    autorizacion,
                    marca_tarjeta: marcaTarjeta,
                    ultimos_digitos: ultimosDigitos,
                    monto_usd: Number(pago.pag_monto_total || 0),
                    modalidad_cobro: detPrevio.modalidad_cobro || "TOTAL_100",
                    fecha: new Date().toISOString(),
                    respuesta_raw: raw,
                  },
                ],
                variacion_aceptada: true,
              },
              prf_actualizado_en: new Date().toISOString(),
            })
            .eq("prf_id", proformaIdDestino);

          // Espejar evidencia PLUX también en com_orden_taller vinculada (si existe)
          try {
            const { data: otaVinc } = await clienteDb
              .schema("comun_comercio")
              .from("com_orden_taller")
              .select("ota_id, ota_detalle_orden")
              .eq("ota_proforma_id", proformaIdDestino)
              .is("ota_eliminado_en", null)
              .maybeSingle();
            if (otaVinc?.ota_id) {
              const detOta =
                otaVinc.ota_detalle_orden && typeof otaVinc.ota_detalle_orden === "object"
                  ? otaVinc.ota_detalle_orden
                  : {};
              await clienteDb
                .schema("comun_comercio")
                .from("com_orden_taller")
                .update({
                  ota_estado_pago: nuevoEstadoPrf,
                  ota_estado_taller:
                    nuevoEstadoPrf === "NUEVO_CONFIRMADO" ? "ENVIADO_TALLER" : undefined,
                  ota_metodo_pago: "plux",
                  ota_detalle_orden: {
                    ...detOta,
                    ultimo_pago_plux: evidenciaPluxCompleta,
                    evidencias: {
                      ...(detOta.evidencias && typeof detOta.evidencias === "object"
                        ? detOta.evidencias
                        : {}),
                      respuesta_plux: evidenciaPluxCompleta,
                    },
                  },
                  ota_actualizado_en: new Date().toISOString(),
                })
                .eq("ota_id", otaVinc.ota_id);
            }
          } catch {
            // No bloquear confirmación PLUX si falla el espejo en taller
          }

          const grupoIdPrf = String(detPrfActual.grupo_proforma_id || "");
          if (grupoIdPrf) {
            const { data: hermanasPrf } = await clienteDb
              .schema("comun_comercio")
              .from("com_proforma")
              .select("prf_id, prf_estado, prf_detalle_proforma")
              .eq("prf_negocio", negocio)
              .is("prf_eliminado_en", null);

            for (const h of hermanasPrf ?? []) {
              if (
                String(h.prf_id) !== String(proformaIdDestino) &&
                String(h.prf_detalle_proforma?.grupo_proforma_id || h.prf_id) === grupoIdPrf &&
                ["ENVIADA", "PENDIENTE_PAGO"].includes(String(h.prf_estado || ""))
              ) {
                await clienteDb
                  .schema("comun_comercio")
                  .from("com_proforma")
                  .update({
                    prf_estado: "NO_ACEPTADA",
                    prf_detalle_proforma: {
                      ...(h.prf_detalle_proforma || {}),
                      estado: "NO_ACEPTADA",
                      descartada_por_pago_id: String(proformaIdDestino),
                    },
                    prf_actualizado_en: new Date().toISOString(),
                  })
                  .eq("prf_id", h.prf_id);
              }
            }
          }
        }
      }
    } catch (e) {
      // Ignorar si RLS restringe escritura directa sin RPC
      await trazaPlux("confirmar.respaldo_directo_error", "AVISO", { negocio, correlacion: identificador, mensaje: mensajeDeError(e) });
    }
  }

  // 3.4. Respaldo en comun_seguridad.seg_usuario.usu_detalle_usuario para garantizar
  // que el mecanismo de pago PLUX, código de autorización y últimos dígitos de tarjeta
  // queden siempre registrados aunque la tabla com_transaccion_pago no permita UPDATE directo por RLS
  try {
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser();
    const uidTarget = pago?.pag_cliente_id || authUser?.id;
    if (uidTarget) {
      const { data: usrRow } = await (clienteDb || supabase)
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", uidTarget)
        .maybeSingle();
      const detUsr = (usrRow?.usu_detalle_usuario as Record<string, any>) || {};
      const listaConfirmados: any[] = Array.isArray(detUsr.pagos_plux_confirmados)
        ? detUsr.pagos_plux_confirmados
        : [];
      const nuevoRegistroPlux = {
        pag_id: pago?.pag_id || `plux-${identificador}`,
        identificador,
        pasarela: "PLUX",
        estado: "APROBADO",
        id_transaccion: idTransaccion,
        autorizacion,
        tarjeta_tipo: tipoTarjeta,
        tarjeta_marca: marcaTarjeta,
        tarjeta_ultimos_digitos: ultimosDigitos,
        monto_total: Number(montoNotificado ?? pago?.pag_monto_total ?? 28.75),
        producto_nombre: productoNombre,
        variante_id: varianteId,
        confirmado_en: new Date().toISOString(),
        pagador: detPrevio.pagador || null,
      };
      const sinDuplicado = listaConfirmados.filter((item: any) => item?.identificador !== identificador);
      await (clienteDb || supabase)
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detUsr,
            pagos_plux_confirmados: [nuevoRegistroPlux, ...sinDuplicado].slice(0, 50),
          },
        })
        .eq("usu_id", uidTarget);
    }
  } catch {
    // Continuar
  }

  // 3.5. Emitir y sincronizar automáticamente la Factura Electrónica SRI para este pago con tarjeta
  // (en Links de Pago desde chat no se genera factura automáticamente al pagar)
  let facturaEmitida: FacturaElectronicaResumen | null = esLinkPagoChat ? null : facturaDesdeRpc;
  if (!esLinkPagoChat && !facturaEmitida) {
    try {
      facturaEmitida = await asegurarFacturaElectronicaParaPago(clienteDb, {
        identificador,
        negocio,
      });
    } catch (e) {
      await trazaPlux("confirmar.factura_error", "AVISO", { negocio, correlacion: identificador, mensaje: mensajeDeError(e) });
    }
  }

  // Respaldo determinístico de Factura Electrónica SRI cuando el comprador es invitado con orden firmada
  // y la fila com_transaccion_pago aún no es legible por RLS antes de ejecutar la migración SQL
  if (!esLinkPagoChat && !facturaEmitida && emisorFactura.activo !== false) {
    const ahoraIso = new Date().toISOString();
    const factorModalidad =
      entrada.modalidadCobro === "RESERVA_70"
        ? 0.7
        : entrada.modalidadCobro === "SALDO_30"
          ? 0.3
          : 1;
    const totalOrdenRespaldo = ordenFirmada
      ? Math.round(Number(ordenFirmada.tot || 0) * factorModalidad * 100) / 100
      : Number(montoNotificado ?? pago?.pag_monto_total ?? 0);
    const ivaRespaldo = ordenFirmada
      ? Math.round(Number(ordenFirmada.iva || 0) * factorModalidad * 100) / 100
      : 0;
    const sub15Respaldo = ordenFirmada
      ? Math.round((Number(ordenFirmada.bgc || 0) / 100) * factorModalidad * 100) / 100
      : 0;
    const sub0Respaldo = Math.max(
      0,
      Math.round((totalOrdenRespaldo - ivaRespaldo - sub15Respaldo) * 100) / 100,
    );

    const lineasRespaldo: LineaFacturaSriResumen[] = [];
    if (ordenFirmada && Array.isArray(ordenFirmada.itm) && ordenFirmada.itm.length > 0) {
      ordenFirmada.itm.forEach((it, idx) => {
        const tarifa = String(it.imp) === "4" ? 15 : 0;
        const subLinea = Math.round(Number(it.tot || 0) * factorModalidad * 100) / 100;
        const cant = Math.max(1, Number(it.can || 1));
        lineasRespaldo.push({
          codigo: `ITEM-${String(idx + 1).padStart(2, "0")}`,
          descripcion: it.var ? `${it.dsc} (${it.var})` : it.dsc,
          cantidad: cant,
          precio_unitario: Math.round((subLinea / cant) * 100) / 100,
          tarifa_iva: tarifa,
          subtotal: subLinea,
          valor_iva: tarifa > 0 ? Math.round(subLinea * (tarifa / 100) * 100) / 100 : 0,
        });
      });
      if (Number(ordenFirmada.fle || 0) > 0) {
        const fleteCobro = Math.round(Number(ordenFirmada.fle) * factorModalidad * 100) / 100;
        lineasRespaldo.push({
          codigo: "ENVIO-DOM",
          descripcion: ordenFirmada.ubi?.zon
            ? `Envío a domicilio (${ordenFirmada.ubi.zon})`
            : "Envío a domicilio",
          cantidad: 1,
          precio_unitario: fleteCobro,
          tarifa_iva: 0,
          subtotal: fleteCobro,
          valor_iva: 0,
        });
      }
    } else if (totalOrdenRespaldo > 0) {
      lineasRespaldo.push({
        codigo: `${prefijoPluxNegocio(negocio)}-001`,
        descripcion: productoNombre,
        cantidad: 1,
        precio_unitario: Math.round((sub15Respaldo + sub0Respaldo) * 100) / 100,
        tarifa_iva: ivaRespaldo > 0 ? 15 : 0,
        subtotal: Math.round((sub15Respaldo + sub0Respaldo) * 100) / 100,
        valor_iva: ivaRespaldo,
      });
    }

    const hashHex = identificador.replace(/[^0-9A-F]/gi, "").slice(-6) || "000001";
    const secDerivado = (parseInt(hashHex, 16) % 899999) + 1;
    const estab = emisorFactura.establecimiento || "001";
    const pto = emisorFactura.puntoEmision || "001";
    const numeroComp = `${estab}-${pto}-${String(secDerivado).padStart(9, "0")}`;
    const claveAcceso = generarClaveAccesoSri49({
      fechaIso: ahoraIso,
      ruc: emisorFactura.ruc,
      ambiente: emisorFactura.ambiente,
      establecimiento: estab,
      puntoEmision: pto,
      secuencialNumero: secDerivado,
    });
    const idComprador = (
      entrada.pagador?.identificacion ||
      ordenFirmada?.cmp?.ide ||
      "9999999999999"
    ).trim();

    facturaEmitida = {
      numero_comprobante: numeroComp,
      clave_acceso: claveAcceso,
      estado: emisorFactura.ambiente === 2 ? "RECIBIDO" : "AUTORIZADO",
      ambiente: emisorFactura.ambiente,
      fecha_emision: ahoraIso,
      fecha_autorizacion: ahoraIso,
      rubro_facturado: productoNombre,
      codigo_rubro: ordenFirmada?.cod || `${prefijoPluxNegocio(negocio)}-001`,
      subtotal: Math.round((sub15Respaldo + sub0Respaldo) * 100) / 100,
      subtotal_15: sub15Respaldo,
      subtotal_0: sub0Respaldo,
      iva: ivaRespaldo,
      total: totalOrdenRespaldo,
      lineas: lineasRespaldo,
      emisor: emisorFactura,
      comprador: {
        tipo_identificacion:
          idComprador === "9999999999999"
            ? "07"
            : idComprador.length === 13
              ? "04"
              : idComprador.length === 10
                ? "05"
                : "06",
        identificacion: idComprador,
        razon_social: pagadorNombre,
        correo: pagadorEmail,
        telefono: entrada.pagador?.telefono || ordenFirmada?.cmp?.tel || "",
        direccion: entrada.pagador?.direccion || ordenFirmada?.ubi?.dir || "Quito, Ecuador",
      },
    };
  }

  // 4. Sincronizar cobertura activa y notificación in-app. Solo una suscripción
  // activa cobertura; un trámite de pago único no (igual que en Payphone).
  if (varianteId && (await esVarianteSuscripcion(clienteDb || supabase, varianteId))) {
    try {
      await activarSuscripcionTrasPagoAction({
        negocio,
        varianteId,
        productoNombre,
        clienteEmail: pagadorEmail,
        clienteNombre: pagadorNombre,
        revalidar: false,
      });
    } catch (e) {
      await trazaPlux("confirmar.suscripcion_error", "ERROR", { negocio, correlacion: identificador, mensaje: mensajeDeError(e) });
    }
  }

  // Notificar tanto al cliente comprador (correo de comprobante + alerta In-App/Push)
  // como al staff operativo y administrativo del negocio sobre la venta confirmada.
  try {
    const {
      notificarClienteCompraConfirmada,
      notificarStaffNuevoPedido,
    } = await import("@eco/notificaciones/notificar-usuario");
    const uidComprador = pago?.pag_cliente_id || usuarioSesionActual?.id || null;
    const montoNotif = Number(pago?.pag_monto_total ?? facturaEmitida?.total ?? montoNotificado ?? 0);
    const codigoVenta = String(detPrevio.codigo_proforma || ordenFirmada?.cod || identificador);
    const telefonoVenta =
      entrada.pagador?.telefono ||
      detPrevio.pagador?.telefono ||
      ordenFirmada?.cmp?.tel ||
      undefined;
    const metodoEtiqueta = `PLUX (${marcaTarjeta || "Tarjeta"}${ultimosDigitos ? ` •••• ${ultimosDigitos}` : ""})`;
    const itemsResumenNotif = ordenFirmada?.itm?.length
      ? ordenFirmada.itm.map((i) => `${i.can}x ${i.dsc}${i.var ? ` (${i.var})` : ""}`)
      : [productoNombre];
    const direccionNotif =
      ordenFirmada?.ubi?.dir ||
      entrada.pagador?.direccion ||
      detPrevio.pagador?.direccion ||
      undefined;
    const modalidadEntregaNotif = ordenFirmada?.ubi
      ? ordenFirmada.ubi.ret
        ? "RETIRO EN TIENDA"
        : ordenFirmada.ubi.zon
        ? `DOMICILIO (${ordenFirmada.ubi.zon})`
        : "DOMICILIO"
      : undefined;

    let urlEditarTarjetaPlux: string | undefined;
    let esTarjetaCondolenciasPlux = false;
    const negPluxNorm = String(negocio || "").trim().toLowerCase();
    if (!esLinkPagoChat && (negPluxNorm === "tinkay" || negPluxNorm === "margaritas")) {
      try {
        const proformaIdTarj = String(detPrevio.proforma_id || ordenFirmada?.id || "").trim();
        let tokVistaTarj = String(detPrevio.token_aprobacion || "").trim();
        let textoItemsTarj = itemsResumenNotif.join(" ");

        if (proformaIdTarj) {
          const dbTarj = clienteDb || supabase;
          const [{ data: filaPrfTarj }, { data: filaOtaTarj }] = await Promise.all([
            dbTarj
              .schema("comun_comercio")
              .from("com_proforma")
              .select("prf_token_aprobacion, prf_detalle_proforma")
              .eq("prf_id", proformaIdTarj)
              .maybeSingle(),
            dbTarj
              .schema("comun_comercio")
              .from("com_orden_taller")
              .select("ota_tarjeta_token, ota_tarjeta_tipo, ota_producto_resumen")
              .eq("ota_proforma_id", proformaIdTarj)
              .is("ota_eliminado_en", null)
              .limit(1)
              .maybeSingle(),
          ]);

          if (filaOtaTarj?.ota_tarjeta_token) {
            tokVistaTarj = String(filaOtaTarj.ota_tarjeta_token).trim();
          } else if (filaPrfTarj?.prf_token_aprobacion) {
            tokVistaTarj = String(filaPrfTarj.prf_token_aprobacion).trim();
          } else if (!tokVistaTarj) {
            tokVistaTarj = proformaIdTarj;
          }

          if (filaOtaTarj?.ota_tarjeta_tipo === "CONDOLENCIAS_PLANA") {
            esTarjetaCondolenciasPlux = true;
          }
          if (filaOtaTarj?.ota_producto_resumen) {
            textoItemsTarj += ` ${String(filaOtaTarj.ota_producto_resumen)}`;
          }
          const detPrfT = (filaPrfTarj?.prf_detalle_proforma ?? {}) as Record<string, any>;
          if (
            String(detPrfT?.tarjeta?.tipo || "").toUpperCase() === "CONDOLENCIAS_PLANA" ||
            String(detPrfT?.clasificacion_pedido || "").toUpperCase() === "CONDOLENCIAS"
          ) {
            esTarjetaCondolenciasPlux = true;
          }
        }

        if (!esTarjetaCondolenciasPlux) {
          esTarjetaCondolenciasPlux = /condol|p[eé]same|funebr|f[uú]nebr|duelo|abanico|exequial|luto/i.test(
            textoItemsTarj
          );
        }

        if (tokVistaTarj) {
          const tokEd = generarTokenEdicionTarjetaServidor(tokVistaTarj);
          const baseUrlNeg =
            negPluxNorm === "tinkay"
              ? "https://tinkay-web.vercel.app"
              : "https://margaritas-web.vercel.app";
          urlEditarTarjetaPlux = `${baseUrlNeg}/tarjeta-editar/${encodeURIComponent(tokEd)}`;
        }
      } catch {
        // No bloquear la confirmación del pago si falla la resolución opcional del enlace de tarjeta
      }
    }

    await Promise.allSettled([
      notificarClienteCompraConfirmada({
        negocio,
        codigoOrden: codigoVenta,
        clienteUsuarioId: uidComprador,
        clienteNombre: pagadorNombre,
        clienteCorreo: correoCompradorReal,
        montoUsd: montoNotif,
        metodoPago: metodoEtiqueta,
        esTransferenciaPendiente: false,
        modalidadEntrega: modalidadEntregaNotif,
        direccionEntrega: direccionNotif,
        numeroFacturaSri: facturaEmitida?.numero_comprobante ?? null,
        claveAccesoSri: facturaEmitida?.clave_acceso ?? null,
        autorizacionPago: autorizacion,
        itemsResumen: itemsResumenNotif,
        urlEditarTarjeta: urlEditarTarjetaPlux,
        esTarjetaCondolencias: esTarjetaCondolenciasPlux,
      }),
      notificarStaffNuevoPedido({
        negocio,
        codigo: codigoVenta,
        clienteNombre: pagadorNombre,
        clienteCorreo: correoCompradorReal || undefined,
        clienteTelefono: telefonoVenta,
        montoUsd: montoNotif,
        metodoPago: metodoEtiqueta,
        canalOrigen: "Pasarela PLUX / Tarjeta",
        tipoEntrega: modalidadEntregaNotif,
        direccionEntrega: direccionNotif,
        dedicatoria: facturaEmitida?.numero_comprobante
          ? `Factura SRI N° ${facturaEmitida.numero_comprobante} · Aut. ${autorizacion}`
          : `Autorización PLUX: ${autorizacion}`,
        itemsResumen: itemsResumenNotif,
      }),
    ]);

    // 5. Sincronización Meta Conversions API (Purchase servidor deduplicado por codigoVenta)
    try {
      const { enviarEventoConversionMetaServidorAction } = await import(
        "./acciones-marketing-meta"
      );
      let skusOrden: string[] = [];
      let contentsMeta: Array<{ id: string; quantity: number; item_price?: number }> = [];
      let fbcGuardado = entrada.atribucion?.fbc;
      let fbpGuardado = entrada.atribucion?.fbp;

      const proformaIdCapi = detPrevio.proforma_id || ordenFirmada?.id;
      if (proformaIdCapi) {
        const { data: prfMeta } = await clienteDb
          .schema("comun_comercio")
          .from("com_proforma")
          .select("prf_detalle_proforma")
          .eq("prf_id", proformaIdCapi)
          .maybeSingle();
        const detMeta = (prfMeta?.prf_detalle_proforma ?? {}) as Record<string, any>;
        const itemsPrf: any[] = Array.isArray(detMeta.items) ? detMeta.items : [];
        for (const it of itemsPrf) {
          const sku = String(it?.variante_sku || it?.producto_id || "").trim();
          if (sku && Number(it?.precio_unitario ?? 1) > 0) {
            skusOrden.push(sku);
            contentsMeta.push({
              id: sku,
              quantity: Math.max(1, Number(it?.cantidad) || 1),
              item_price: Number(it?.precio_unitario) || undefined,
            });
          }
        }
        if (!fbcGuardado && detMeta.atribucion_publicitaria?.fbc) {
          fbcGuardado = String(detMeta.atribucion_publicitaria.fbc);
        }
        if (!fbpGuardado && detMeta.atribucion_publicitaria?.fbp) {
          fbpGuardado = String(detMeta.atribucion_publicitaria.fbp);
        }
      }

      if (skusOrden.length === 0 && varianteId) {
        skusOrden = [String(varianteId)];
        contentsMeta = [{ id: String(varianteId), quantity: 1, item_price: montoNotif }];
      }

      await enviarEventoConversionMetaServidorAction({
        negocio,
        eventName: "Purchase",
        eventId: codigoVenta,
        eventSourceUrl: entrada.atribucion?.eventSourceUrl,
        valorUsd: montoNotif,
        moneda: "USD",
        codigoOrden: codigoVenta,
        contentIds: skusOrden,
        contents: contentsMeta,
        contentName: productoNombre,
        comprador: {
          email: correoCompradorReal || undefined,
          telefono: telefonoVenta,
          nombreCompleto: pagadorNombre,
          usuarioId: uidComprador,
        },
        atribucion: {
          fbc: fbcGuardado,
          fbp: fbpGuardado,
        },
      });
    } catch {
      // Nunca interrumpir confirmación de pago por telemetría externa
    }
  } catch (errNotif) {
    console.warn("Aviso al notificar pago PLUX a cliente y staff:", errNotif);
    await trazaPlux("confirmar.notificacion_error", "AVISO", { negocio, correlacion: identificador, mensaje: mensajeDeError(errNotif) });
  }

  // 5. Capturar/actualizar perfil del cliente (autorizado o no autorizado) con la compra confirmada
  if (clienteDb) {
    try {
      const montoConfirmado = Number(pago?.pag_monto_total ?? facturaEmitida?.total ?? montoNotificado ?? 0);
      await clienteDb.schema("comun_comercio").rpc("com_fn_capturar_cliente_compra", {
        p_negocio: negocio,
        p_usuario_id: pago?.pag_cliente_id || null,
        p_comprador: {
          nombreCompleto: pagadorNombre,
          identificacion:
            entrada.pagador?.identificacion ||
            detPrevio.pagador?.identificacion ||
            ordenFirmada?.cmp?.ide ||
            "",
          correo: pagadorEmail,
          telefono:
            entrada.pagador?.telefono ||
            detPrevio.pagador?.telefono ||
            ordenFirmada?.cmp?.tel ||
            "",
          direccion:
            entrada.pagador?.direccion ||
            detPrevio.pagador?.direccion ||
            ordenFirmada?.ubi?.dir ||
            "",
        },
        p_monto_confirmado: montoConfirmado,
        p_incluye_regalo: Boolean(
          detPrevio.regalo_primera_compra ||
            ordenFirmada?.itm?.some((i) => Number(i.pun) === 0)
        ),
      });
    } catch {
      // Continuar si la migración com_cliente aún no fue aplicada en remoto
    }
  }

  return {
    ok: true,
    data: {
      pagoId: pago?.pag_id || null,
      pasarela: "PLUX",
      estado: "APROBADO",
      motivo: null,
      autorizacion,
      marcaTarjeta,
      ultimosDigitos,
      facturaElectronica: facturaEmitida,
      emisorFactura,
    },
  };
}

const esquemaCrearLinkPagoChat = z.object({
  negocio: z.string().min(2).default("tinkay"),
  montoTotal: z.coerce.number().min(0.5, "El valor mínimo es $0.50 USD.").max(50000, "El valor máximo es $50,000.00 USD."),
  concepto: z.string().trim().min(2, "Ingresa un concepto o detalle del cobro.").max(240),
  ivaPorcentaje: z.coerce.number().refine((v) => v === 0 || v === 15, {
    message: "El IVA debe ser 0% o 15%.",
  }).default(0),
  clienteNombre: z.string().trim().max(160).optional().default(""),
  clienteTelefono: z.string().trim().max(40).optional().default(""),
  clienteCorreo: z.string().trim().max(160).optional().default(""),
  conversacionId: z.string().uuid().optional().nullable(),
  codigoPedido: z.string().trim().max(60).optional().nullable(),
  originUrl: z.string().trim().max(300).optional().nullable(),
});

export interface LinkPagoChatCreado {
  id: string;
  codigo: string;
  tokenAprobacion: string;
  urlPago: string;
  respaldoFirmado: string;
  montoTotal: number;
  subtotal: number;
  iva: number;
  concepto: string;
  tarjetaHabilitada: boolean;
}

function resolverOrigenPublicoLink(negocio: string, originUrl?: string | null, hostHeader?: string | null, protoHeader?: string | null): string {
  const candidato = (originUrl || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^/\s]+$/i.test(candidato)) {
    return candidato;
  }

  const host = (hostHeader || "").trim();
  if (host) {
    const proto = (protoHeader || (host.includes("localhost") ? "http" : "https")).split(",")[0]?.trim() || "https";
    return `${proto}://${host}`;
  }

  const envUrl = (process.env.NEXT_PUBLIC_SITE_URL || "").trim().replace(/\/+$/, "");
  if (/^https?:\/\/[^/\s]+$/i.test(envUrl)) {
    return envUrl;
  }

  if (negocio === "tinkay") return "https://tinkay-web.vercel.app";
  if (negocio === "margaritas") return "https://margaritas-web.vercel.app";
  if (negocio === "fastfix") return "https://fastfix-web.vercel.app";
  return "https://tranqi-web.vercel.app";
}

/**
 * Crea un link de pago seguro (`/pagar/[token]`) desde el Chat Omnicanal (`/LinkPago`),
 * persistido en `comun_comercio.com_proforma` + `com_proforma_item` con monto editable,
 * listo para cobrar con PLUX (tarjeta de crédito/débito) o Transferencia / DeUna.
 */
export async function crearLinkPagoChatAction(
  entrada: z.input<typeof esquemaCrearLinkPagoChat>,
): Promise<Resultado<LinkPagoChatCreado>> {
  const v = esquemaCrearLinkPagoChat.safeParse(entrada);
  if (!v.success) {
    return {
      ok: false,
      error: v.error.issues[0]?.message || "Verifica el valor y concepto del link de pago.",
    };
  }

  const negPrincipal = normalizarIdentificadorNegocio(v.data.negocio).principal;
  const supabase: any = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { ok: false, error: "Debes iniciar sesión como asesor u operador para generar links de pago." };
  }

  const montoTotal = Math.round(v.data.montoTotal * 100) / 100;
  const ivaPct = v.data.ivaPorcentaje === 15 ? 15 : 0;
  const subtotal = ivaPct > 0 ? Math.round((montoTotal / 1.15) * 100) / 100 : montoTotal;
  const iva = ivaPct > 0 ? Math.max(0, Math.round((montoTotal - subtotal) * 100) / 100) : 0;
  const baseGravadaCentavos = ivaPct > 0 ? Math.round(subtotal * 100) : 0;
  const base0Centavos = ivaPct > 0 ? 0 : Math.round(montoTotal * 100);

  const clienteNombre = v.data.clienteNombre || "Cliente Chat";
  const clienteTelefono = v.data.clienteTelefono || "";
  const clienteCorreo = v.data.clienteCorreo || "";
  const concepto = v.data.concepto;

  const [cfgTienda, pasarelasRes] = await Promise.all([
    obtenerConfiguracionTiendaCheckoutAction(negPrincipal).catch(() => null),
    obtenerPasarelasCheckoutAction(negPrincipal).catch(() => ({ ok: false as const, error: "" })),
  ]);
  const tarjetaHabilitada =
    cfgTienda?.tarjetaCreditoHabilitada !== false &&
    Boolean(pasarelasRes.ok && pasarelasRes.data.some((p) => p.pasarela === "PLUX"));

  let idCreado = "";
  let codigoCreado = "";
  let tokenAprobacion = "";
  let subtotalFinal = subtotal;
  let ivaFinal = iva;
  let totalFinal = montoTotal;
  let base0Final = base0Centavos;
  let baseGravFinal = baseGravadaCentavos;

  // 1. Vía principal: RPC transaccional SECURITY DEFINER
  const { data: resRpc, error: errRpc } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_crear_link_pago_chat", {
      p_negocio: negPrincipal,
      p_monto_total: montoTotal,
      p_concepto: concepto,
      p_iva_porcentaje: ivaPct,
      p_cliente_nombre: clienteNombre,
      p_cliente_telefono: clienteTelefono,
      p_cliente_correo: clienteCorreo,
      p_conversacion_id: v.data.conversacionId ?? null,
      p_codigo_pedido: v.data.codigoPedido ?? null,
      p_detalle_extra: {
        generado_desde: "CHAT_OMNICANAL",
      },
    });

  if (!errRpc && resRpc?.ok && resRpc?.token_aprobacion) {
    idCreado = String(resRpc.id);
    codigoCreado = String(resRpc.codigo);
    tokenAprobacion = String(resRpc.token_aprobacion);
    subtotalFinal = Number(resRpc.subtotal ?? subtotal);
    ivaFinal = Number(resRpc.iva ?? iva);
    totalFinal = Number(resRpc.total ?? montoTotal);
    base0Final = Number(resRpc.base_iva_0_centavos ?? base0Centavos);
    baseGravFinal = Number(resRpc.base_iva_gravada_centavos ?? baseGravadaCentavos);
  } else if (!errRpc && resRpc?.ok === false) {
    return {
      ok: false,
      error: String(resRpc.error || "No tienes permisos para crear un link de pago."),
    };
  } else {
    // 2. Respaldo resiliente si la migración RPC aún no se aplicó en Supabase remoto
    const admin: any = crearClienteAdmin();
    if (!admin) {
      return {
        ok: false,
        error:
          errRpc?.message ||
          "Aún no se ha ejecutado la migración SQL de links de pago en Supabase (`20261122000002_rpc_crear_link_pago_chat.sql`).",
      };
    }

    // Verificar autorización del operador/admin antes de escribir vía cliente admin
    const { data: esOp } = await supabase
      .schema("comun_seguridad")
      .rpc("seg_fn_es_operador_o_admin_negocio", { p_negocio: negPrincipal });
    if (!esOp) {
      return {
        ok: false,
        error: "No tienes permisos de operador o administrador en este negocio.",
      };
    }

    const tokenNuevo = randomUUID().replace(/-/g, "");
    const impuestoTag = ivaPct > 0 ? "IVA_15" : "IVA_0";
    const compradorObj = {
      nombreCompleto: clienteNombre,
      identificacion: "9999999999999",
      correo: clienteCorreo,
      whatsapp: clienteTelefono,
      telefono: clienteTelefono,
      autorizaWhatsapp: true,
    };

    const { data: filaIns, error: errIns } = await admin
      .schema("comun_comercio")
      .from("com_proforma")
      .insert({
        prf_negocio: negPrincipal,
        prf_cliente_nombre: clienteNombre,
        prf_cliente_contacto: compradorObj,
        prf_estado: "PENDIENTE_PAGO",
        prf_subtotal: subtotal,
        prf_descuento: 0,
        prf_iva: iva,
        prf_total: montoTotal,
        prf_token_aprobacion: tokenNuevo,
        prf_vigencia_dias: 7,
        prf_observaciones: concepto,
        prf_detalle_proforma: {
          tipo_origen: "LINK_PAGO_CHAT",
          estado: "PENDIENTE_PAGO",
          concepto,
          conversacion_id: v.data.conversacionId ?? null,
          codigo_pedido_vinculado: v.data.codigoPedido || null,
          creado_por: user.id,
          generado_desde: "CHAT_OMNICANAL",
          comprador: compradorObj,
          subtotal_base_imponible: subtotal,
          total_iva: iva,
          total_flete: 0,
          total_pagar: montoTotal,
          base_iva_0_centavos: base0Centavos,
          base_iva_gravada_centavos: baseGravadaCentavos,
          monto_abonado_usd: 0,
          saldo_pendiente_usd: montoTotal,
          items: [
            {
              descripcion: concepto,
              producto_nombre: concepto,
              cantidad: 1,
              precio_unitario: montoTotal,
              impuesto: impuestoTag,
              total_linea: montoTotal,
            },
          ],
        },
      })
      .select("prf_id, prf_secuencial, prf_token_aprobacion")
      .single();

    if (errIns || !filaIns) {
      return {
        ok: false,
        error: `No se pudo registrar el link de pago: ${errIns?.message || "Error inesperado"}`,
      };
    }

    idCreado = String(filaIns.prf_id);
    tokenAprobacion = String(filaIns.prf_token_aprobacion || tokenNuevo);
    codigoCreado = `${prefijoPluxNegocio(negPrincipal)}-LNK-${String(filaIns.prf_secuencial || 1).padStart(4, "0")}`;

    await admin
      .schema("comun_comercio")
      .from("com_proforma")
      .update({
        prf_detalle_proforma: {
          tipo_origen: "LINK_PAGO_CHAT",
          estado: "PENDIENTE_PAGO",
          codigo_proforma: codigoCreado,
          codigo_orden: codigoCreado,
          grupo_proforma_id: idCreado,
          concepto,
          conversacion_id: v.data.conversacionId ?? null,
          codigo_pedido_vinculado: v.data.codigoPedido || null,
          creado_por: user.id,
          generado_desde: "CHAT_OMNICANAL",
          comprador: compradorObj,
          subtotal_base_imponible: subtotal,
          total_iva: iva,
          total_flete: 0,
          total_pagar: montoTotal,
          base_iva_0_centavos: base0Centavos,
          base_iva_gravada_centavos: baseGravadaCentavos,
          monto_abonado_usd: 0,
          saldo_pendiente_usd: montoTotal,
          items: [
            {
              descripcion: concepto,
              producto_nombre: concepto,
              cantidad: 1,
              precio_unitario: montoTotal,
              impuesto: impuestoTag,
              total_linea: montoTotal,
            },
          ],
        },
      })
      .eq("prf_id", idCreado);

    await admin
      .schema("comun_comercio")
      .from("com_proforma_item")
      .insert({
        pfi_negocio: negPrincipal,
        pfi_proforma_id: idCreado,
        pfi_es_item_libre: true,
        pfi_descripcion: concepto,
        pfi_cantidad: 1,
        pfi_precio_unitario: montoTotal,
        pfi_descuento: 0,
        pfi_impuesto: impuestoTag,
        pfi_total_linea: montoTotal,
        pfi_detalle_item: { origen: "LINK_PAGO_CHAT", iva_porcentaje: ivaPct },
      });
  }

  let hostHeader: string | null = null;
  let protoHeader: string | null = null;
  try {
    const h = await headers();
    hostHeader = h.get("x-forwarded-host") || h.get("host");
    protoHeader = h.get("x-forwarded-proto");
  } catch {
    // headers() puede no estar disponible fuera de request HTTP
  }

  const origenPublico = resolverOrigenPublicoLink(
    negPrincipal,
    v.data.originUrl,
    hostHeader,
    protoHeader,
  );
  const urlPago = `${origenPublico}/pagar/${tokenAprobacion}`;

  const respaldoFirmado = firmarOrdenRespaldoServidor({
    v: 1,
    id: idCreado,
    neg: negPrincipal,
    cod: codigoCreado,
    ori: "LINK_PAGO_CHAT",
    est: "PENDIENTE_PAGO",
    vig: 7,
    sub: subtotalFinal,
    des: 0,
    iva: ivaFinal,
    fle: 0,
    tot: totalFinal,
    b0c: base0Final,
    bgc: baseGravFinal,
    iat: new Date().toISOString(),
    cmp: {
      nom: clienteNombre,
      ide: "9999999999999",
      cor: clienteCorreo,
      tel: clienteTelefono,
    },
    ubi: {
      ret: false,
      dir: "Quito, Ecuador",
      ref: "",
    },
    itm: [
      {
        dsc: concepto,
        can: 1,
        pun: totalFinal,
        imp: ivaPct > 0 ? "IVA_15" : "IVA_0",
        tot: totalFinal,
      },
    ],
  });

  return {
    ok: true,
    data: {
      id: idCreado,
      codigo: codigoCreado,
      tokenAprobacion,
      urlPago,
      respaldoFirmado,
      montoTotal: totalFinal,
      subtotal: subtotalFinal,
      iva: ivaFinal,
      concepto,
      tarjetaHabilitada,
    },
  };
}
