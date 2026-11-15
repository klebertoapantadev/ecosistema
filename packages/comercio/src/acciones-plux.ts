"use server";

// Acciones del checkout con PLUX (TRQ-ADM-004).
import { z } from "zod";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import {
  activarSuscripcionTrasPagoAction,
  asegurarFacturaElectronicaParaPago,
  type FacturaElectronicaResumen,
} from "./acciones";
import { obtenerEmisorRideNegocioAction } from "./acciones-facturacion-sri";
import { datosPaybox, respuestaExitosa, type PagadorPlux, type PagoPluxPreparado } from "./plux";
import {
  generarClaveAccesoSri49,
  type ConfiguracionEmisorSri,
  type LineaFacturaSriResumen,
} from "./ride-sri";
import { verificarOrdenRespaldoServidor } from "./token-orden-firmada";
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
  const { data } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_obtener_pasarelas_activas", { p_negocio: negPrincipal });

  const lista: PasarelaCheckout[] = (data ?? []).map((p: any) => ({
    pasarela: p.pasarela,
    nombreVisible: p.nombre_visible,
    ambiente: p.ambiente,
  }));

  if (!lista.some((p) => p.pasarela === "PLUX")) {
    const admin: any = crearClienteAdmin();
    if (admin) {
      const { data: rowPlux } = await admin
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .select("psc_pasarela, psc_nombre_visible, psc_ambiente, psc_activo")
        .eq("psc_negocio", negPrincipal)
        .eq("psc_pasarela", "PLUX")
        .is("psc_eliminado_en", null)
        .maybeSingle();

      if (rowPlux) {
        lista.unshift({
          pasarela: "PLUX",
          nombreVisible: rowPlux.psc_nombre_visible || "PLUX (Tarjeta de Crédito / Débito)",
          ambiente: rowPlux.psc_ambiente || "PRUEBAS",
        });
      } else {
        lista.unshift({
          pasarela: "PLUX",
          nombreVisible: "PLUX (Tarjeta de Crédito / Débito)",
          ambiente: "PRUEBAS",
        });
      }
    } else {
      lista.unshift({
        pasarela: "PLUX",
        nombreVisible: "PLUX (Tarjeta de Crédito / Débito)",
        ambiente: "PRUEBAS",
      });
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
export async function prepararPagoPluxAction(
  entrada: z.input<typeof esquemaPreparar>,
): Promise<Resultado<{ identificador: string; totalCentavos: number; paybox: ReturnType<typeof datosPaybox> }>> {
  const v = esquemaPreparar.safeParse(entrada);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message || "Datos de facturación incompletos." };

  const negPrincipal = normalizarIdentificadorNegocio(v.data.negocio).principal;
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

  // Respaldo con service_role cuando la pasarela está en modo PRUEBAS y el usuario no figura en probadores
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

  if (error) return { ok: false, error: "No se pudo preparar el pago." };
  return { ok: false, error: data?.error || "No se pudo preparar el pago." };
}

/**
 * Prepara el cobro PLUX sobre una proforma de evento o pedido de tienda (`com_proforma`),
 * admitiendo Pago Total (100%), Reserva del Evento (70%) o Saldo Restante (30%).
 * El importe siempre se calcula en el servidor a partir de `com_proforma`.
 */
export async function prepararPagoPluxProformaAction(
  entrada: z.input<typeof esquemaPrepararProforma>,
): Promise<Resultado<{ identificador: string; totalCentavos: number; paybox: ReturnType<typeof datosPaybox> }>> {
  const v = esquemaPrepararProforma.safeParse(entrada);
  if (!v.success) {
    return { ok: false, error: v.error.issues[0]?.message || "Datos de facturación incompletos." };
  }

  const negPrincipal = normalizarIdentificadorNegocio(v.data.negocio).principal;
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

    // Buscar credenciales PLUX de la empresa actual; si aún no se sembraron, heredar temporalmente de tranqi con razón social propia
    let { data: rowPlux } = await admin
      .schema("comun_comercio")
      .from("com_pasarela_configuracion")
      .select("*")
      .eq("psc_negocio", negPrincipal)
      .eq("psc_pasarela", "PLUX")
      .is("psc_eliminado_en", null)
      .maybeSingle();

    if (!rowPlux?.psc_credenciales_publicas?.remail) {
      const { data: rowPluxTranqi } = await admin
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .select("*")
        .eq("psc_negocio", "tranqi")
        .eq("psc_pasarela", "PLUX")
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

      if (!pasarelaActiva?.credenciales_publicas?.remail && negPrincipal !== "tranqi") {
        const { data: pasarelasBase } = await supabase
          .schema("comun_comercio")
          .rpc("com_fn_obtener_pasarelas_activas", { p_negocio: "tranqi" });
        const pluxBase = (pasarelasBase ?? []).find((p: any) => p.pasarela === "PLUX");
        if (pluxBase) {
          pasarelaActiva = {
            ...pluxBase,
            credenciales_publicas: {
              ...(pluxBase.credenciales_publicas || {}),
              nombre_comercio: nombreComercioPorDefecto(negPrincipal),
            },
          };
        }
      }
    } catch {
      // Continuar con valores por defecto de sandbox
    }

    const remail = pasarelaActiva?.credenciales_publicas?.remail || "admin.operaciones@tranqi24.com";
    const ambiente = pasarelaActiva?.ambiente || "PRUEBAS";
    const nombreComercio =
      pasarelaActiva?.credenciales_publicas?.nombre_comercio || nombreComercioPorDefecto(negPrincipal);

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

export async function confirmarPagoPluxAction(entrada: {
  negocio?: string;
  identificador: string;
  respuestaPaybox: unknown;
  tokenAprobacion?: string;
  pagador?: PagadorPlux;
  modalidadCobro?: ModalidadCobroProforma;
}): Promise<Resultado<PagoPluxConsultado>> {
  const { identificador, respuestaPaybox } = entrada;
  const negocio = normalizarIdentificadorNegocio(entrada.negocio || "tranqi").principal;
  const ordenFirmada = entrada.tokenAprobacion
    ? verificarOrdenRespaldoServidor(entrada.tokenAprobacion)
    : null;

  if (!REGEX_IDENTIFICADOR_PLUX.test(identificador)) {
    return { ok: false, error: "Pago desconocido." };
  }
  if (!respuestaExitosa(respuestaPaybox)) {
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

  // Sin revalidatePath("/panel"): Next aplicaría la recarga en el cliente en
  // cuanto termina esta acción, con el checkout aún abierto. El panel se
  // reordena (plan activo) y desmonta el modal antes del recibo. El checkout
  // refresca la página cuando el cliente cierra el recibo.
  if (pago?.pag_estado === "APROBADO") {
    let facturaPrevia: FacturaElectronicaResumen | null = null;
    try {
      facturaPrevia = await asegurarFacturaElectronicaParaPago(clienteDb, {
        identificador,
        negocio,
      });
    } catch {
      // Continuar
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
    if (!rpcClienteErr && rpcClienteRes?.ok && rpcClienteRes?.estado === "APROBADO") {
      confirmadoPorRpc = true;
      if (rpcClienteRes.factura_electronica?.clave_acceso) {
        facturaDesdeRpc = {
          ...(rpcClienteRes.factura_electronica as FacturaElectronicaResumen),
          emisor: emisorFactura,
        };
      }
    }
  } catch {
    // Continúa al siguiente mecanismo si la migración aún no está aplicada
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
      }
    } catch {
      // Continúa al respaldo directo
    }
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
          const nuevoEstadoPrf =
            detPrevio.modalidad_cobro === "RESERVA_70" && saldoPendiente > 0.01
              ? "RESERVADA_70"
              : "APROBADA";
          const pagosPluxPrevios = Array.isArray(detPrfActual.pagos_plux) ? detPrfActual.pagos_plux : [];

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
                ultimo_pago_plux: {
                  pago_id: pago.pag_id,
                  identificador,
                  autorizacion,
                  marca_tarjeta: marcaTarjeta,
                  ultimos_digitos: ultimosDigitos,
                  monto_usd: Number(pago.pag_monto_total || 0),
                  modalidad_cobro: detPrevio.modalidad_cobro || "TOTAL_100",
                  confirmado_en: new Date().toISOString(),
                },
                pagos_plux: [
                  ...pagosPluxPrevios,
                  {
                    identificador,
                    autorizacion,
                    monto_usd: Number(pago.pag_monto_total || 0),
                    modalidad_cobro: detPrevio.modalidad_cobro || "TOTAL_100",
                    fecha: new Date().toISOString(),
                  },
                ],
                variacion_aceptada: true,
              },
              prf_actualizado_en: new Date().toISOString(),
            })
            .eq("prf_id", proformaIdDestino);

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
    } catch {
      // Ignorar si RLS restringe escritura directa sin RPC
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
  let facturaEmitida: FacturaElectronicaResumen | null = facturaDesdeRpc;
  if (!facturaEmitida) {
    try {
      facturaEmitida = await asegurarFacturaElectronicaParaPago(clienteDb, {
        identificador,
        negocio,
      });
    } catch {
      // Continuar
    }
  }

  // Respaldo determinístico de Factura Electrónica SRI cuando el comprador es invitado con orden firmada
  // y la fila com_transaccion_pago aún no es legible por RLS antes de ejecutar la migración SQL
  if (!facturaEmitida && emisorFactura.activo !== false) {
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
    } catch {
      // Continuar
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
  } catch (errNotif) {
    console.warn("Aviso al notificar pago PLUX a cliente y staff:", errNotif);
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
        p_incluye_regalo: Boolean(detPrevio.regalo_primera_compra),
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
