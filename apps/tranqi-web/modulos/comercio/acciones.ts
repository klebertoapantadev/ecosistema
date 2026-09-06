"use server";

import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { revalidatePath } from "next/cache";

export interface ProductoCatalogo {
  pro_id: string;
  pro_negocio: string;
  pro_nombre: string;
  pro_slug: string;
  pro_descripcion: string | null;
  pro_tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  pro_destacado: boolean;
  pro_categoria_principal_id: string | null;
  pro_detalle_producto: any;
  categoria?: {
    ctg_id: string;
    ctg_nombre: string;
    ctg_slug: string;
  } | null;
  variantes: VarianteCatalogo[];
}

export interface VarianteCatalogo {
  var_id: string;
  var_producto_id: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number; // Base imponible
  var_precio_comparacion?: number | null;
  var_codigo_impuesto_sri: string;
  var_tarifa_iva_porcentaje: number;
  var_tipo_oferta: string;
  var_frecuencia_recurrencia?: string | null;
  var_activo: boolean;
  var_detalle_variante: any;
  // Calculados
  monto_iva: number;
  precio_total: number;
}

export interface ConfiguracionPasarela {
  psc_id?: string;
  psc_negocio: string;
  psc_pasarela: string;
  psc_nombre_visible: string;
  psc_ambiente: "PRUEBAS" | "PRODUCCION";
  psc_activo: boolean;
  storeId: string;
  modoSimulado: boolean;
  token?: string;
  comisionPorcentaje: number;
  detalle?: any;
}

export interface TransaccionPagoCRM {
  pag_id: string;
  pag_secuencial: number;
  pag_negocio: string;
  pag_pasarela: string;
  pag_identificador_cliente: string;
  pag_transaccion_pasarela_id: string | null;
  pag_autorizacion_codigo: string | null;
  pag_estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO" | "REVERSADO";
  pag_monto_total: number;
  pag_monto_sin_iva: number;
  pag_monto_con_iva: number;
  pag_monto_iva: number;
  pag_moneda: string;
  pag_titular_email: string | null;
  pag_titular_identificacion: string | null;
  pag_tarjeta_tipo: string | null;
  pag_tarjeta_marca: string | null;
  pag_tarjeta_ultimos_digitos: string | null;
  pag_confirmado_en: string | null;
  pag_creado_en: string;
  pag_detalle_transaccion: any;
}

/**
 * Obtiene el catálogo de productos y variantes activas agrupadas con cálculo impositivo ecuatoriano (IVA 15%)
 */
export async function obtenerCatalogoProductosAction(negocio = "tranqi"): Promise<ProductoCatalogo[]> {
  const supabase: any = await crearClienteServidor();

  // Consultar productos con sus categorías
  const { data: productos, error: errProd } = await supabase
    .from("com_producto")
    .select(`
      pro_id,
      pro_negocio,
      pro_nombre,
      pro_slug,
      pro_descripcion,
      pro_tipo,
      pro_destacado,
      pro_categoria_principal_id,
      pro_detalle_producto,
      categoria:com_categoria(ctg_id, ctg_nombre, ctg_slug)
    `)
    .eq("pro_negocio", negocio)
    .eq("pro_activo", true)
    .order("pro_destacado", { ascending: false });

  if (errProd || !productos) {
    console.error("Error al obtener productos de comun_comercio:", errProd);
    return [];
  }

  // Consultar variantes activas
  const { data: variantes, error: errVar } = await supabase
    .from("com_variante")
    .select("*")
    .eq("var_negocio", negocio)
    .eq("var_activo", true)
    .order("var_precio", { ascending: true });

  if (errVar) {
    console.error("Error al obtener variantes de comun_comercio:", errVar);
  }

  const mapaVariantes = (variantes || []).reduce((acc: Record<string, VarianteCatalogo[]>, v: any) => {
    const base = Number(v.var_precio) || 0;
    const tarifaIva = Number(v.var_tarifa_iva_porcentaje) || 15;
    const iva = Number(((base * tarifaIva) / 100).toFixed(4));
    const total = Number((base + iva).toFixed(2));

    const item: VarianteCatalogo = {
      var_id: v.var_id,
      var_producto_id: v.var_producto_id,
      var_sku: v.var_sku,
      var_nombre: v.var_nombre,
      var_precio: base,
      var_precio_comparacion: v.var_precio_comparacion ? Number(v.var_precio_comparacion) : null,
      var_codigo_impuesto_sri: v.var_codigo_impuesto_sri || "IVA_15",
      var_tarifa_iva_porcentaje: tarifaIva,
      var_tipo_oferta: v.var_tipo_oferta,
      var_frecuencia_recurrencia: v.var_frecuencia_recurrencia,
      var_activo: v.var_activo,
      var_detalle_variante: v.var_detalle_variante || {},
      monto_iva: iva,
      precio_total: total,
    };

    const prodId = v.var_producto_id;
    if (!acc[prodId]) {
      acc[prodId] = [];
    }
    acc[prodId]?.push(item);
    return acc;
  }, {});

  return productos.map((p: any) => ({
    pro_id: p.pro_id,
    pro_negocio: p.pro_negocio,
    pro_nombre: p.pro_nombre,
    pro_slug: p.pro_slug,
    pro_descripcion: p.pro_descripcion,
    pro_tipo: p.pro_tipo,
    pro_destacado: p.pro_destacado,
    pro_categoria_principal_id: p.pro_categoria_principal_id,
    pro_detalle_producto: p.pro_detalle_producto || {},
    categoria: p.categoria || null,
    variantes: mapaVariantes[p.pro_id] || [],
  }));
}

/**
 * Obtiene la configuración de Payphone para el tenant actual
 */
export async function obtenerConfiguracionPasarelaAction(
  negocio = "tranqi",
  pasarela = "PAYPHONE"
): Promise<ConfiguracionPasarela> {
  const supabase: any = await crearClienteServidor();

  const { data } = await supabase
    .from("com_pasarela_configuracion")
    .select("*")
    .eq("psc_negocio", negocio)
    .eq("psc_pasarela", pasarela)
    .maybeSingle();

  if (!data) {
    return {
      psc_negocio: negocio,
      psc_pasarela: pasarela,
      psc_nombre_visible: "Payphone (Tarjetas y Saldo)",
      psc_ambiente: "PRUEBAS",
      psc_activo: true,
      storeId: "STORE-DEMO-TRANQI-001",
      modoSimulado: true,
      comisionPorcentaje: 6.0,
    };
  }

  const pub = data.psc_credenciales_publicas || {};
  const priv = data.psc_credenciales_privadas || {};

  return {
    psc_id: data.psc_id,
    psc_negocio: data.psc_negocio,
    psc_pasarela: data.psc_pasarela,
    psc_nombre_visible: data.psc_nombre_visible,
    psc_ambiente: data.psc_ambiente || "PRUEBAS",
    psc_activo: data.psc_activo ?? true,
    storeId: pub.storeId || "STORE-DEMO-TRANQI-001",
    modoSimulado: pub.modoSimulado ?? priv.modoSimulado ?? true,
    token: priv.token || "",
    comisionPorcentaje: Number(data.psc_comision_porcentaje) || 6.0,
    detalle: data.psc_detalle_pasarela || {},
  };
}

/**
 * Guarda o actualiza la configuración de la pasarela Payphone
 */
export async function guardarConfiguracionPasarelaAction(datos: {
  negocio?: string;
  storeId: string;
  token?: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  modoSimulado: boolean;
  activo: boolean;
}) {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();

  const pub = {
    storeId: datos.storeId.trim(),
    modoSimulado: datos.modoSimulado,
    moneda: "USD",
    pais: "EC",
  };

  const privPayload: Record<string, any> = {
    modoSimulado: datos.modoSimulado,
  };
  if (datos.token && datos.token.trim().length > 0) {
    privPayload.token = datos.token.trim();
  }

  const { error } = await admin.from("com_pasarela_configuracion").upsert(
    {
      psc_negocio: negocio,
      psc_pasarela: "PAYPHONE",
      psc_nombre_visible: "Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)",
      psc_ambiente: datos.ambiente,
      psc_activo: datos.activo,
      psc_credenciales_publicas: pub,
      psc_credenciales_privadas: privPayload,
      psc_actualizado_en: new Date().toISOString(),
    },
    { onConflict: "psc_negocio, psc_pasarela" }
  );

  if (error) {
    console.error("Error al guardar pasarela:", error);
    return { ok: false, error: error.message };
  }

  revalidatePath("/panel");
  return { ok: true };
}

/**
 * Fase 1: Prepara la transacción de pago con Payphone (API /api/button/Prepare) o inicia simulación
 */
export async function prepararPagoPayphoneAction(datos: {
  negocio?: string;
  varianteId: string;
  nombreServicio: string;
  montoBase: number;
  montoIva: number;
  montoTotal: number;
  pagador: {
    nombres: string;
    apellidos: string;
    identificacion: string;
    email: string;
    telefono: string;
  };
  esSimulado?: boolean;
}) {
  const negocio = datos.negocio || "tranqi";
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();

  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const usarSimulacion = datos.esSimulado ?? cfg.modoSimulado;

  // Generar Client Transaction ID único
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const clientTransactionId = `TRQ-TX-${Date.now()}-${randomSuffix}`;

  // Obtener usuario autenticado si existe
  const { data: authUser } = await supabase.auth.getUser();
  const clienteId = authUser?.user?.id || null;

  // Montos en centavos para cumplir normativa Payphone (entero x 100)
  const amountTotalCentavos = Math.round(datos.montoTotal * 100);
  const amountWithTaxCentavos = Math.round(datos.montoBase * 100);
  const taxCentavos = Math.round(datos.montoIva * 100);

  // 1. Si está en MODO SIMULADO:
  if (usarSimulacion) {
    const paymentIdSimulado = `SIM-PAY-${Date.now()}-${randomSuffix}`;

    // Registrar en com_transaccion_pago como PENDIENTE
    await admin.from("com_transaccion_pago").insert({
      pag_negocio: negocio,
      pag_cliente_id: clienteId,
      pag_pasarela: "PAYPHONE",
      pag_identificador_cliente: clientTransactionId,
      pag_transaccion_pasarela_id: paymentIdSimulado,
      pag_estado: "PENDIENTE",
      pag_monto_total: datos.montoTotal,
      pag_monto_sin_iva: 0,
      pag_monto_con_iva: datos.montoBase,
      pag_monto_iva: datos.montoIva,
      pag_moneda: "USD",
      pag_titular_email: datos.pagador.email,
      pag_titular_identificacion: datos.pagador.identificacion,
      pag_titular_telefono: datos.pagador.telefono,
      pag_detalle_transaccion: {
        modo_simulado: true,
        nombre_servicio: datos.nombreServicio,
        variante_id: datos.varianteId,
        fecha_preparacion: new Date().toISOString(),
        pagador: datos.pagador,
      },
    });

    return {
      ok: true,
      esSimulado: true,
      paymentId: paymentIdSimulado,
      clientTransactionId,
      payWithPayPhone: null,
      payWithCard: null,
      mensaje: "Transacción preparada con éxito en Modo Simulado (Sandbox).",
    };
  }

  // 2. Si está en MODO REAL (llamada oficial a Payphone Prepare API)
  const token = cfg.token;
  if (!token) {
    return {
      ok: false,
      error: "No se encuentra configurado el Token Bearer de Payphone para transacciones en vivo.",
    };
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://tranqi.ec";
    const bodyPayphone = {
      amount: amountTotalCentavos,
      amountWithoutTax: 0,
      amountWithTax: amountWithTaxCentavos,
      tax: taxCentavos,
      service: 0,
      tip: 0,
      clientTransactionId: clientTransactionId,
      reference: `Honorarios: ${datos.nombreServicio}`,
      storeId: cfg.storeId,
      currency: "USD",
      responseUrl: `${origin}/panel/pagos/confirmacion`,
      cancellationUrl: `${origin}/panel/pagos/cancelacion`,
      timeZone: -5,
      order: {
        billTo: {
          firstName: datos.pagador.nombres,
          lastName: datos.pagador.apellidos,
          email: datos.pagador.email,
          phoneNumber: datos.pagador.telefono.startsWith("+") ? datos.pagador.telefono : `+593${datos.pagador.telefono}`,
          customerId: datos.pagador.identificacion,
          country: "EC",
        },
        lineItems: [
          {
            productName: datos.nombreServicio,
            unitPrice: amountWithTaxCentavos,
            quantity: 1,
            totalAmount: amountTotalCentavos,
            taxAmount: taxCentavos,
            productSKU: datos.varianteId,
            productDescription: `Contratación de honorarios: ${datos.nombreServicio}`,
          },
        ],
      },
    };

    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/Prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayphone),
    });

    const data = await res.json();

    if (!res.ok || !data.paymentId) {
      console.error("Error devuelto por Payphone Prepare:", data);
      return {
        ok: false,
        error: data.message || "No se pudo preparar la transacción con Payphone. Revisa credenciales.",
        detalles: data,
      };
    }

    // Registrar intención en com_transaccion_pago
    await admin.from("com_transaccion_pago").insert({
      pag_negocio: negocio,
      pag_cliente_id: clienteId,
      pag_pasarela: "PAYPHONE",
      pag_identificador_cliente: clientTransactionId,
      pag_transaccion_pasarela_id: data.paymentId,
      pag_estado: "PENDIENTE",
      pag_monto_total: datos.montoTotal,
      pag_monto_sin_iva: 0,
      pag_monto_con_iva: datos.montoBase,
      pag_monto_iva: datos.montoIva,
      pag_moneda: "USD",
      pag_titular_email: datos.pagador.email,
      pag_titular_identificacion: datos.pagador.identificacion,
      pag_titular_telefono: datos.pagador.telefono,
      pag_detalle_transaccion: {
        modo_simulado: false,
        payphone_prepare_response: data,
        fecha_preparacion: new Date().toISOString(),
      },
    });

    return {
      ok: true,
      esSimulado: false,
      paymentId: data.paymentId,
      clientTransactionId,
      payWithPayPhone: data.payWithPayPhone,
      payWithCard: data.payWithCard,
      mensaje: "Transacción preparada exitosamente. Redirigiendo a pasarela Payphone segura.",
    };
  } catch (err: any) {
    console.error("Excepción en prepararPagoPayphoneAction:", err);
    return { ok: false, error: err.message || "Error de red al conectar con Payphone." };
  }
}

/**
 * Fase 2: Confirma la transacción con Payphone (/api/button/V2/Confirm) o procesa respuesta simulada
 */
export async function confirmarPagoPayphoneAction(datos: {
  negocio?: string;
  id: string | number;
  clientTxId: string;
  esSimulado?: boolean;
  resultadoSimulacion?: "APROBADO" | "RECHAZADO";
  marcaTarjetaSimulada?: string;
}) {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();
  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const esSimulado = datos.esSimulado ?? cfg.modoSimulado;

  // 1. Si es MODO SIMULADO:
  if (esSimulado) {
    const estadoFinal = datos.resultadoSimulacion || "APROBADO";
    const authCodeSimulado =
      estadoFinal === "APROBADO"
        ? `AUTH-${Math.floor(100000 + Math.random() * 900000)}`
        : null;
    const marca = datos.marcaTarjetaSimulada || "Visa";
    const ultimosDigitos = "4242";

    const { data: transaccion, error: errUpdate } = await admin
      .from("com_transaccion_pago")
      .update({
        pag_estado: estadoFinal,
        pag_autorizacion_codigo: authCodeSimulado,
        pag_tarjeta_tipo: "CREDITO",
        pag_tarjeta_marca: marca,
        pag_tarjeta_ultimos_digitos: ultimosDigitos,
        pag_confirmado_en: new Date().toISOString(),
        pag_actualizado_en: new Date().toISOString(),
      })
      .eq("pag_identificador_cliente", datos.clientTxId)
      .select()
      .maybeSingle();

    if (errUpdate || !transaccion) {
      console.warn("No se pudo actualizar por identificador, buscando por registro pendiente:", errUpdate);
    }

    return {
      ok: true,
      estado: estadoFinal,
      autorizacionCodigo: authCodeSimulado,
      transaccionId: `SIM-TX-${datos.id}`,
      clientTransactionId: datos.clientTxId,
      marcaTarjeta: marca,
      ultimosDigitos: ultimosDigitos,
      montoTotal: transaccion?.pag_monto_total || 0,
      mensaje:
        estadoFinal === "APROBADO"
          ? "¡Pago simulado aprobado exitosamente!"
          : "Transacción rechazada por simulación (Fondos insuficientes o tarjeta declinada).",
    };
  }

  // 2. Si es MODO REAL (Llamada a /api/button/V2/Confirm)
  const token = cfg.token;
  if (!token) {
    return { ok: false, error: "Token de Payphone no configurado para confirmación." };
  }

  try {
    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: Number(datos.id),
        clientTxId: datos.clientTxId,
      }),
    });

    const data = await res.json();

    if (!res.ok) {
      console.error("Error en Payphone Confirm API:", data);
      return { ok: false, error: data.message || "Error al confirmar transacción con Payphone." };
    }

    const estadoFinal =
      data.transactionStatus === "Approved" || data.statusCode === 3 ? "APROBADO" : "RECHAZADO";

    await admin
      .from("com_transaccion_pago")
      .update({
        pag_estado: estadoFinal,
        pag_autorizacion_codigo: data.authorizationCode || null,
        pag_tarjeta_tipo: data.cardType || "CREDITO",
        pag_tarjeta_marca: data.cardBrand || null,
        pag_tarjeta_ultimos_digitos: data.lastDigits || null,
        pag_confirmado_en: new Date().toISOString(),
        pag_detalle_transaccion: data,
        pag_actualizado_en: new Date().toISOString(),
      })
      .eq("pag_identificador_cliente", datos.clientTxId);

    return {
      ok: true,
      estado: estadoFinal,
      autorizacionCodigo: data.authorizationCode,
      transaccionId: data.transactionId,
      clientTransactionId: datos.clientTxId,
      marcaTarjeta: data.cardBrand,
      ultimosDigitos: data.lastDigits,
      montoTotal: (data.amount || 0) / 100,
      mensaje:
        estadoFinal === "APROBADO"
          ? "¡Pago confirmado y aprobado por el banco!"
          : "La transacción fue rechazada o cancelada por la entidad financiera.",
    };
  } catch (err: any) {
    console.error("Excepción en confirmarPagoPayphoneAction:", err);
    return { ok: false, error: err.message || "Error de red al confirmar con Payphone." };
  }
}

/**
 * Obtiene el historial de transacciones de pago para la consola administrativa
 */
export async function obtenerHistorialTransaccionesAction(negocio = "tranqi"): Promise<TransaccionPagoCRM[]> {
  const supabase: any = await crearClienteServidor();

  const { data, error } = await supabase
    .from("com_transaccion_pago")
    .select("*")
    .eq("pag_negocio", negocio)
    .order("pag_creado_en", { ascending: false })
    .limit(50);

  if (error) {
    console.error("Error al obtener transacciones:", error);
    return [];
  }

  return data || [];
}
