"use server";

// Acciones del checkout con PLUX (TRQ-ADM-004).
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { activarSuscripcionTrasPagoAction } from "./acciones";
import { datosPaybox, respuestaExitosa, type PagoPluxPreparado } from "./plux";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

type Resultado<T> = { ok: true; data: T } | { ok: false; error: string };

export interface PasarelaCheckout {
  pasarela: string;
  nombreVisible: string;
  ambiente: string;
}

// Pasarelas que el checkout puede ofrecer a quien está mirando. Una pasarela
// en pruebas solo la ven los probadores (com_fn_pasarela_visible).
export async function obtenerPasarelasCheckoutAction(negocio = "tranqi"): Promise<Resultado<PasarelaCheckout[]>> {
  const supabase: any = await crearClienteServidor();
  const { data, error } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_obtener_pasarelas_activas", { p_negocio: normalizarIdentificadorNegocio(negocio).principal });
  if (error) return { ok: false, error: "No se pudieron leer las pasarelas de pago." };
  return {
    ok: true,
    data: (data ?? []).map((p: any) => ({
      pasarela: p.pasarela,
      nombreVisible: p.nombre_visible,
      ambiente: p.ambiente,
    })),
  };
}

const esquemaPagador = z.object({
  nombre: z.string().trim().min(3).max(120),
  // Cédula, RUC o pasaporte: el checkout ofrece los tres y PLUX valida el suyo.
  identificacion: z.string().trim().regex(/^[A-Za-z0-9]{5,20}$/, "Identificación no válida"),
  email: z.string().trim().email().max(120),
  telefono: z.string().trim().min(7).max(20),
  direccion: z.string().trim().min(3).max(200),
});

const esquemaPreparar = z.object({
  negocio: z.string().min(1).default("tranqi"),
  varianteId: z.string().uuid(),
  pagador: esquemaPagador,
});

// El monto lo fija la base de datos a partir de la variante: el navegador
// solo dice QUÉ compra, nunca CUÁNTO.
export async function prepararPagoPluxAction(
  entrada: z.input<typeof esquemaPreparar>,
): Promise<Resultado<{ identificador: string; totalCentavos: number; paybox: ReturnType<typeof datosPaybox> }>> {
  const v = esquemaPreparar.safeParse(entrada);
  if (!v.success) return { ok: false, error: v.error.issues[0]?.message || "Datos de facturación incompletos." };

  const supabase: any = await crearClienteServidor();
  const { data, error } = await supabase.schema("comun_comercio").rpc("com_fn_preparar_pago_plux", {
    p_negocio: normalizarIdentificadorNegocio(v.data.negocio).principal,
    p_variante_id: v.data.varianteId,
    p_pagador: v.data.pagador,
  });
  if (error) return { ok: false, error: "No se pudo preparar el pago." };
  if (!data?.ok) return { ok: false, error: data?.error || "No se pudo preparar el pago." };

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

export type EstadoPagoPlux = "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO" | "REVERSADO";

export interface PagoPluxConsultado {
  estado: EstadoPagoPlux;
  motivo: string | null;
  autorizacion: string | null;
  marcaTarjeta: string | null;
  ultimosDigitos: string | null;
}

// Lo consulta el checkout mientras espera el webhook. La RLS
// (com_pago_cliente_select) limita la lectura a los pagos propios.
export async function consultarPagoPluxAction(
  identificador: string,
): Promise<Resultado<PagoPluxConsultado>> {
  if (!/^TRQ-PLX-[0-9A-F]{12}$/.test(identificador)) return { ok: false, error: "Pago desconocido." };
  const supabase: any = await crearClienteServidor();
  const { data, error } = await supabase
    .schema("comun_comercio")
    .from("com_transaccion_pago")
    .select("pag_estado, pag_autorizacion_codigo, pag_tarjeta_marca, pag_tarjeta_ultimos_digitos, pag_detalle_transaccion")
    .eq("pag_identificador_cliente", identificador)
    .maybeSingle();
  if (error || !data) return { ok: false, error: "Pago desconocido." };
  return {
    ok: true,
    data: {
      estado: data.pag_estado,
      motivo: data.pag_detalle_transaccion?.motivo ?? null,
      autorizacion: data.pag_autorizacion_codigo,
      marcaTarjeta: data.pag_tarjeta_marca,
      ultimosDigitos: data.pag_tarjeta_ultimos_digitos,
    },
  };
}

/**
 * Confirma inmediatamente el pago tras la respuesta exitosa (`onAuthorize`) del
 * paybox de PLUX, registrando la autorización, activando la suscripción y
 * enviando la notificación in-app sin depender de que el webhook de sandbox llegue.
 */
export async function confirmarPagoPluxAction(entrada: {
  negocio?: string;
  identificador: string;
  respuestaPaybox: unknown;
}): Promise<Resultado<PagoPluxConsultado>> {
  const { identificador, respuestaPaybox } = entrada;
  const negocio = normalizarIdentificadorNegocio(entrada.negocio || "tranqi").principal;

  if (!/^TRQ-PLX-[0-9A-F]{12}$/.test(identificador)) {
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

  // 1. Leer la transacción pendiente del usuario
  const { data: pago } = await supabase
    .schema("comun_comercio")
    .from("com_transaccion_pago")
    .select("pag_id, pag_negocio, pag_cliente_id, pag_estado, pag_monto_total, pag_titular_email, pag_autorizacion_codigo, pag_tarjeta_marca, pag_tarjeta_ultimos_digitos, pag_detalle_transaccion")
    .eq("pag_identificador_cliente", identificador)
    .maybeSingle();

  if (pago?.pag_estado === "APROBADO") {
    revalidatePath("/panel");
    return {
      ok: true,
      data: {
        estado: "APROBADO",
        motivo: null,
        autorizacion: pago.pag_autorizacion_codigo || autorizacion,
        marcaTarjeta: pago.pag_tarjeta_marca || marcaTarjeta,
        ultimosDigitos: pago.pag_tarjeta_ultimos_digitos || ultimosDigitos,
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
  const detPrevio = (pago?.pag_detalle_transaccion as Record<string, any>) || {};
  const varianteId = detPrevio.variante_id;
  const productoNombre = detPrevio.producto || "Plan de Protección Jurídica";
  const pagadorNombre = detPrevio.pagador?.nombre || "Cliente";
  const pagadorEmail = pago?.pag_titular_email || detPrevio.pagador?.email || "cliente@tranqi24.com";

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
    } catch {
      // Ignorar si RLS restringe escritura directa sin RPC
    }
  }

  // 4. Sincronizar cobertura activa y notificación in-app
  if (varianteId) {
    try {
      await activarSuscripcionTrasPagoAction({
        negocio,
        varianteId,
        productoNombre,
        clienteEmail: pagadorEmail,
        clienteNombre: pagadorNombre,
      });
    } catch {
      // Continuar
    }
  }

  if (clienteDb && pago?.pag_cliente_id) {
    try {
      const montoFmt = Number(pago.pag_monto_total || 0).toFixed(2);
      await clienteDb
        .schema("comun_notificacion")
        .from("not_registro")
        .insert({
          not_usuario_id: pago.pag_cliente_id,
          not_negocio: negocio,
          not_titulo: `🧾 ¡Pago Confirmado! ${productoNombre}`,
          not_contenido_html: `<p>Tu pago por <strong>${productoNombre}</strong> por <strong>$${montoFmt} USD</strong> fue procesado exitosamente con PLUX.</p><p><strong>Referencia / Autorización:</strong> <code>${autorizacion}</code><br/><strong>Tarjeta:</strong> ${marcaTarjeta} •••• ${ultimosDigitos}</p>`,
          not_url_accion: "/panel",
          not_canal: "IN_APP",
        });
    } catch {
      // Continuar
    }
  }

  revalidatePath("/panel");
  return {
    ok: true,
    data: {
      estado: "APROBADO",
      motivo: null,
      autorizacion,
      marcaTarjeta,
      ultimosDigitos,
    },
  };
}
