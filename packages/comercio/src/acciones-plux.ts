"use server";

// Acciones del checkout con PLUX (TRQ-ADM-004). Ninguna toca credenciales de
// la pasarela: el botón solo necesita el correo del comercio, y la
// confirmación del pago la hace la Edge Function plux-webhook.
import { z } from "zod";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { datosPaybox, type PagoPluxPreparado } from "./plux";
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
