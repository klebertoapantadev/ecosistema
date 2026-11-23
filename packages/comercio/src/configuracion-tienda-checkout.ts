export interface CuentaBancariaTransferencia {
  banco: string;
  tipoCuenta: string;
  numeroCuenta: string;
}

export interface DatosTransferenciaTienda {
  habilitada: boolean;
  nombreTitular: string;
  tipoIdentificacionTitular: "Cédula" | "RUC" | "Pasaporte" | string;
  identificacionTitular: string;
  correoTitular: string;
  cuentas: CuentaBancariaTransferencia[];
  /** Enlace de cobro directo DeUna (ej. https://deuna.app/...) para /DatosPago y /pagar/[token] */
  linkDeuna: string | null;
  qrDeunaUrl: string | null;
  qrDeunaTitular: string;
  advertenciaAcreditacion: string;
}

export interface ComprobanteTransferenciaSubido {
  url: string;
  nombreArchivo: string;
  mimeType: string;
  tamanoBytes?: number;
  subidoEn?: string;
  referenciaOpcional?: string;
}

export interface ConfiguracionTiendaCheckout {
  negocio: string;
  /** Número oficial de WhatsApp de la tienda (ej. "+593 99 292 2343") */
  whatsappTienda: string;
  /** Monto máximo en USD por debajo del cual se permite pagar sin nombre/identificación (Consumidor Final). En 0 no aplica ningún control por monto. */
  montoMaximoPagoSinDatosUsd: number;
  /** Interruptor maestro de procesamiento con tarjeta de crédito / débito (PLUX / Payphone) */
  tarjetaCreditoHabilitada: boolean;
  /** Datos bancarios, titular y código QR DeUna configurados para el negocio */
  transferencia: DatosTransferenciaTienda;
  actualizadoEn?: string | null;
}

export function normalizarDigitosWhatsapp(telefono: string): string {
  const limpio = String(telefono || "").replace(/\D+/g, "");
  if (!limpio) return "593992922343";
  if (limpio.startsWith("09") && limpio.length === 10) {
    return `593${limpio.slice(1)}`;
  }
  return limpio;
}

export function construirUrlWhatsappTienda(
  whatsappTienda: string,
  mensaje?: string
): string {
  const digitos = normalizarDigitosWhatsapp(whatsappTienda);
  if (!mensaje || !mensaje.trim()) {
    return `https://wa.me/${digitos}`;
  }
  return `https://wa.me/${digitos}?text=${encodeURIComponent(mensaje)}`;
}

export function crearConfiguracionTiendaCheckoutPorDefecto(
  negocio = "tinkay"
): ConfiguracionTiendaCheckout {
  const neg = (negocio || "tinkay").trim().toLowerCase();

  if (neg.includes("tinkay") || neg === "tnk") {
    return {
      negocio: "tinkay",
      whatsappTienda: "+593 99 292 2343",
      montoMaximoPagoSinDatosUsd: 0,
      tarjetaCreditoHabilitada: true,
      transferencia: {
        habilitada: true,
        nombreTitular: "Kleber Toapanta",
        tipoIdentificacionTitular: "Cédula",
        identificacionTitular: "1714898226",
        correoTitular: "tinkay.uio@gmail.com",
        cuentas: [
          {
            banco: "Banco Pichincha",
            tipoCuenta: "Ahorros",
            numeroCuenta: "2211739080",
          },
          {
            banco: "Produbanco",
            tipoCuenta: "Ahorros",
            numeroCuenta: "12054049119",
          },
        ],
        linkDeuna: null,
        qrDeunaUrl: "/img/qr-deuna-tinkay.png",
        qrDeunaTitular: "KLEBER MANUEL",
        advertenciaAcreditacion:
          "El envío se procesará luego de verificar la acreditación del pago.",
      },
      actualizadoEn: null,
    };
  }

  return {
    negocio: neg,
    whatsappTienda: "+593 99 292 2343",
    montoMaximoPagoSinDatosUsd: 0,
    tarjetaCreditoHabilitada: true,
    transferencia: {
      habilitada: true,
      nombreTitular: neg.includes("margarita")
        ? "Margaritas Floristería"
        : neg.includes("fastfix")
        ? "FastFix Home"
        : "Tranqi",
      tipoIdentificacionTitular: "RUC",
      identificacionTitular: "1790000000001",
      correoTitular: `pagos@${neg}.com`,
      cuentas: [],
      linkDeuna: null,
      qrDeunaUrl: null,
      qrDeunaTitular: "",
      advertenciaAcreditacion:
        "El servicio o envío se procesará luego de verificar la acreditación del pago.",
    },
    actualizadoEn: null,
  };
}

export function normalizarConfiguracionTiendaCheckout(
  negocio: string,
  raw: Record<string, unknown> | null | undefined
): ConfiguracionTiendaCheckout {
  const base = crearConfiguracionTiendaCheckoutPorDefecto(negocio);
  if (!raw || typeof raw !== "object") return base;

  const whatsappRaw =
    typeof raw.whatsappTienda === "string" && raw.whatsappTienda.trim()
      ? raw.whatsappTienda.trim()
      : base.whatsappTienda;

  const montoNum = Number(raw.montoMaximoPagoSinDatosUsd);
  const montoMaximoPagoSinDatosUsd =
    Number.isFinite(montoNum) && montoNum >= 0
      ? Math.round(montoNum * 100) / 100
      : base.montoMaximoPagoSinDatosUsd;

  const transferenciaRaw =
    raw.transferencia && typeof raw.transferencia === "object"
      ? (raw.transferencia as Record<string, unknown>)
      : {};

  const cuentasRaw = Array.isArray(transferenciaRaw.cuentas)
    ? transferenciaRaw.cuentas
        .map((c): CuentaBancariaTransferencia | null => {
          if (!c || typeof c !== "object") return null;
          const item = c as Record<string, unknown>;
          const banco = String(item.banco ?? "").trim();
          const tipoCuenta = String(item.tipoCuenta ?? "Ahorros").trim();
          const numeroCuenta = String(item.numeroCuenta ?? "").trim();
          if (!banco || !numeroCuenta) return null;
          return { banco, tipoCuenta, numeroCuenta };
        })
        .filter((x): x is CuentaBancariaTransferencia => x !== null)
    : null;

  const habilitadaRaw =
    typeof transferenciaRaw.habilitada === "boolean"
      ? transferenciaRaw.habilitada
      : typeof raw.transferenciaActiva === "boolean"
      ? raw.transferenciaActiva
      : base.transferencia.habilitada;

  const nombreTitularRaw =
    typeof transferenciaRaw.nombreTitular === "string" &&
    transferenciaRaw.nombreTitular.trim()
      ? transferenciaRaw.nombreTitular.trim()
      : typeof transferenciaRaw.titularNombre === "string" &&
        transferenciaRaw.titularNombre.trim()
      ? transferenciaRaw.titularNombre.trim()
      : base.transferencia.nombreTitular;

  const tipoIdRaw =
    typeof transferenciaRaw.tipoIdentificacionTitular === "string" &&
    transferenciaRaw.tipoIdentificacionTitular.trim()
      ? transferenciaRaw.tipoIdentificacionTitular.trim()
      : typeof transferenciaRaw.titularTipoIdentificacion === "string" &&
        transferenciaRaw.titularTipoIdentificacion.trim()
      ? transferenciaRaw.titularTipoIdentificacion.trim()
      : base.transferencia.tipoIdentificacionTitular;

  const idTitularRaw =
    typeof transferenciaRaw.identificacionTitular === "string" &&
    transferenciaRaw.identificacionTitular.trim()
      ? transferenciaRaw.identificacionTitular.trim()
      : typeof transferenciaRaw.titularIdentificacion === "string" &&
        transferenciaRaw.titularIdentificacion.trim()
      ? transferenciaRaw.titularIdentificacion.trim()
      : base.transferencia.identificacionTitular;

  const correoTitularRaw =
    typeof transferenciaRaw.correoTitular === "string" &&
    transferenciaRaw.correoTitular.trim()
      ? transferenciaRaw.correoTitular.trim()
      : typeof transferenciaRaw.correoConfirmacion === "string" &&
        transferenciaRaw.correoConfirmacion.trim()
      ? transferenciaRaw.correoConfirmacion.trim()
      : base.transferencia.correoTitular;

  const linkDeunaRaw =
    transferenciaRaw.linkDeuna === null
      ? null
      : typeof transferenciaRaw.linkDeuna === "string"
      ? transferenciaRaw.linkDeuna.trim() || null
      : typeof transferenciaRaw.deunaLink === "string"
      ? transferenciaRaw.deunaLink.trim() || null
      : typeof transferenciaRaw.urlDeuna === "string"
      ? transferenciaRaw.urlDeuna.trim() || null
      : base.transferencia.linkDeuna;

  const qrUrlRaw =
    transferenciaRaw.qrDeunaUrl === null
      ? null
      : typeof transferenciaRaw.qrDeunaUrl === "string"
      ? transferenciaRaw.qrDeunaUrl.trim() || null
      : base.transferencia.qrDeunaUrl;

  const advertenciaRaw =
    typeof transferenciaRaw.advertenciaAcreditacion === "string" &&
    transferenciaRaw.advertenciaAcreditacion.trim()
      ? transferenciaRaw.advertenciaAcreditacion.trim()
      : typeof transferenciaRaw.avisoAcreditacion === "string" &&
        transferenciaRaw.avisoAcreditacion.trim()
      ? transferenciaRaw.avisoAcreditacion.trim()
      : base.transferencia.advertenciaAcreditacion;

  const tarjetaHabilitadaRaw =
    typeof raw.tarjetaCreditoHabilitada === "boolean"
      ? raw.tarjetaCreditoHabilitada
      : typeof raw.tarjetaHabilitada === "boolean"
      ? raw.tarjetaHabilitada
      : base.tarjetaCreditoHabilitada;

  return {
    negocio: base.negocio,
    whatsappTienda: whatsappRaw,
    montoMaximoPagoSinDatosUsd,
    tarjetaCreditoHabilitada: tarjetaHabilitadaRaw,
    transferencia: {
      habilitada: habilitadaRaw,
      nombreTitular: nombreTitularRaw,
      tipoIdentificacionTitular: tipoIdRaw,
      identificacionTitular: idTitularRaw,
      correoTitular: correoTitularRaw,
      cuentas:
        cuentasRaw !== null
          ? cuentasRaw
          : base.transferencia.cuentas,
      linkDeuna: linkDeunaRaw,
      qrDeunaUrl: qrUrlRaw,
      qrDeunaTitular:
        typeof transferenciaRaw.qrDeunaTitular === "string" &&
        transferenciaRaw.qrDeunaTitular.trim()
          ? transferenciaRaw.qrDeunaTitular.trim()
          : base.transferencia.qrDeunaTitular,
      advertenciaAcreditacion: advertenciaRaw,
    },
    actualizadoEn:
      typeof raw.actualizadoEn === "string" ? raw.actualizadoEn : base.actualizadoEn,
  };
}

export interface OpcionesMensajeDatosPagoChat {
  /** Total actual detectado o calculado en el chat (opcional) */
  montoTotal?: number | null;
  /** Concepto/producto del pedido en el chat (opcional) */
  concepto?: string | null;
  /** Permite forzar inclusión/exclusión de la invitación a pago con tarjeta */
  incluirOpcionTarjeta?: boolean;
}

/**
 * Construye el mensaje completo y listo para enviar del comando rápido `/DatosPago`:
 * incluye valor opcional del chat, link/QR DeUna, cuentas bancarias configuradas y
 * opción para solicitar link de pago con tarjeta de crédito/débito si está habilitada.
 */
export function construirMensajeDatosPagoChat(
  config: ConfiguracionTiendaCheckout,
  opciones: OpcionesMensajeDatosPagoChat = {}
): string {
  const lineas: string[] = ["💳 *Datos para realizar tu pago*"];

  const monto = Number(opciones.montoTotal);
  const conceptoLimpio = String(opciones.concepto || "").trim();
  if (Number.isFinite(monto) && monto > 0) {
    lineas.push(
      `• *Valor a pagar:* $${monto.toFixed(2)} USD${conceptoLimpio ? ` (${conceptoLimpio})` : ""}`
    );
  } else if (conceptoLimpio) {
    lineas.push(`• *Pedido:* ${conceptoLimpio}`);
  }

  const tr = config.transferencia;
  const linkDeuna = String(tr.linkDeuna || "").trim();

  if (linkDeuna) {
    lineas.push("", "⚡ *Pago rápido con DeUna:*", `👉 ${linkDeuna}`);
  } else if (tr.qrDeunaUrl) {
    lineas.push(
      "",
      `⚡ *Pago con DeUna:* Puedes pagar escaneando nuestro código QR${tr.qrDeunaTitular ? ` (Titular: ${tr.qrDeunaTitular})` : ""}.`
    );
  }

  if (tr.habilitada !== false) {
    const bloqueBanco: string[] = [];
    if (tr.nombreTitular) {
      bloqueBanco.push(`• *Titular:* ${tr.nombreTitular}`);
    }
    if (tr.identificacionTitular) {
      bloqueBanco.push(
        `• *${tr.tipoIdentificacionTitular || "Cédula"}:* ${tr.identificacionTitular}`
      );
    }
    if (tr.correoTitular) {
      bloqueBanco.push(`• *Correo:* ${tr.correoTitular}`);
    }
    for (const cta of tr.cuentas ?? []) {
      if (!cta.banco || !cta.numeroCuenta) continue;
      bloqueBanco.push(
        `• *${cta.banco}* (${cta.tipoCuenta || "Ahorros"}): ${cta.numeroCuenta}`
      );
    }

    if (bloqueBanco.length > 0) {
      lineas.push("", "🏦 *Transferencia / Depósito Bancario:*", ...bloqueBanco);
    }
  }

  const mostrarTarjeta =
    opciones.incluirOpcionTarjeta !== undefined
      ? opciones.incluirOpcionTarjeta
      : config.tarjetaCreditoHabilitada !== false;

  if (mostrarTarjeta) {
    lineas.push(
      "",
      "💳 *¿Prefieres pagar con tarjeta de crédito o débito?*",
      'Respóndenos *"TARJETA"* y te generamos de inmediato tu enlace seguro de pago.'
    );
  }

  lineas.push(
    "",
    "📩 Una vez realizado tu pago, envíanos el comprobante por este mismo chat para confirmar tu pedido."
  );

  if (tr.advertenciaAcreditacion?.trim()) {
    lineas.push(`ℹ️ ${tr.advertenciaAcreditacion.trim()}`);
  }

  return lineas.join("\n");
}

export type ComandoChatPagoDetectado =
  | { tipo: "LINK_PAGO"; montoExplicito: number | null }
  | { tipo: "DATOS_PAGO" }
  | { tipo: "CONFIANZA" };

/**
 * Construye un mensaje listo para enviar al cliente (comando `/Confianza`) con el enlace
 * directo a la sección de testimonios verificados y, en el caso de Tinkay, al álbum oficial
 * de entregas reales.
 */
export function construirMensajeConfianzaChat(
  negocio: string,
  opciones?: {
    urlBase?: string | null;
    urlAlbumFotos?: string | null;
  }
): string {
  const neg = (negocio || "tinkay").trim().toLowerCase();
  const basePorDefecto: Record<string, string> = {
    tinkay: "https://tinkay-web.vercel.app",
    margaritas: "https://margaritas-web.vercel.app",
    fastfix: "https://fastfix-web.vercel.app",
    tranqi: "https://tranqi-web.vercel.app",
  };
  const nombresMarca: Record<string, string> = {
    tinkay: "Tinkay",
    margaritas: "Margaritas Floristería",
    fastfix: "FastFix Home",
    tranqi: "Tranqi",
  };

  const baseRaw = opciones?.urlBase?.trim() || basePorDefecto[neg] || "https://tinkay-web.vercel.app";
  const baseLimpia = baseRaw.replace(/\/+$/, "");
  const urlTestimonios = `${baseLimpia}/#testimonios`;
  const marca = nombresMarca[neg] || negocio || "Tinkay";

  if (neg === "tinkay") {
    const urlAlbum =
      opciones?.urlAlbumFotos?.trim() || "https://photos.app.goo.gl/pARRDFJCASyUW4vRA";
    return [
      `🌸 *Conoce la experiencia de nuestros clientes en ${marca}*`,
      "",
      "Cada entrega cuenta una historia real. Aquí puedes revisar testimonios verificados, capturas y calificaciones de quienes ya confiaron en nosotros:",
      `⭐ *Testimonios de clientes:* ${urlTestimonios}`,
      `📸 *Álbum de entregas reales:* ${urlAlbum}`,
      "",
      "✨ Más de 1,200 arreglos entregados puntualmente en Quito y los Valles (4.9/5 ⭐).",
      "Si deseas, con gusto te asesoramos para elegir tu arreglo ideal.",
    ].join("\n");
  }

  return [
    `⭐ *Testimonios y experiencias de clientes en ${marca}*`,
    "",
    "Aquí puedes revisar opiniones y reseñas reales de quienes ya confían en nuestro servicio:",
    `🔗 ${urlTestimonios}`,
    "",
    "Quedamos atentos para asesorarte en lo que necesites.",
  ].join("\n");
}

/**
 * Detecta si el texto del compositor invoca uno de los comandos rápidos integrados:
 * `/LinkPago` (con monto opcional, ej. `/LinkPago 45.50`), `/DatosPago` o `/Confianza`.
 */
export function parsearComandoChatPago(texto: string): ComandoChatPagoDetectado | null {
  const limpio = String(texto || "").trim();
  if (!limpio.startsWith("/")) return null;

  const matchLink = limpio.match(
    /^\/linkpago(?:\s+\$?\s*([0-9]+(?:[.,][0-9]{1,2})?))?$/i
  );
  if (matchLink) {
    const rawNum = matchLink[1]?.replace(",", ".");
    const parsed = rawNum ? Number(rawNum) : NaN;
    return {
      tipo: "LINK_PAGO",
      montoExplicito: Number.isFinite(parsed) && parsed > 0 ? Math.round(parsed * 100) / 100 : null,
    };
  }

  if (/^\/datospago$/i.test(limpio)) {
    return { tipo: "DATOS_PAGO" };
  }

  if (/^\/confianza$/i.test(limpio)) {
    return { tipo: "CONFIANZA" };
  }

  return null;
}

/**
 * Detecta si un mensaje del cliente solicita pagar con tarjeta de crédito/débito o pide
 * un enlace de pago, evitando falsos positivos con "tarjeta de dedicatoria" en floristerías.
 */
export function detectarSolicitudPagoTarjetaEnMensaje(texto: string): boolean {
  const raw = String(texto || "").trim();
  if (!raw || raw.length > 420) return false;

  const norm = raw
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();

  // Descartar mensajes que se refieren claramente a la tarjeta de dedicatoria floral
  const esTarjetaDedicatoria =
    /\b(dedicatoria|mensaje\s+(de|en|para)\s+la\s+tarjeta|texto\s+(de|en|para)\s+la\s+tarjeta|en\s+la\s+tarjeta\s+(pon|poner|escrib|que\s+diga)|firma\s+de\s+la\s+tarjeta|tarjeta\s+de\s+(saludo|regalo|dedicatoria|condolencia|felicitacion|cumpleanos))\b/.test(
      norm
    );
  const mencionaPagoExplicito =
    /\b(pagar|pago|cobro|link|enlace|boton|credito|debito|visa|mastercard|diners|plux|payphone)\b/.test(
      norm
    );

  if (esTarjetaDedicatoria && !mencionaPagoExplicito) {
    return false;
  }

  // Respuesta corta exacta o casi exacta ("tarjeta", "con tarjeta", "si tarjeta", "tarjeta por favor")
  if (
    /^(si[,\s]+)?(quiero\s+|prefiero\s+|con\s+)?tarjeta(\s+de\s+(credito|debito))?(\s+por\s*favor|\s+porfa|\s+pls)?[.!?]*$/.test(
      norm
    )
  ) {
    return true;
  }

  // Frases explícitas de solicitud de pago con tarjeta o link de pago
  return /\b((pagar|pago|cancelar|abonar)\s+con\s+tarjeta|tarjeta\s+de\s+(credito|debito)|link\s+(de\s+)?(pago|tarjeta|plux)|enlace\s+(de\s+)?(pago|tarjeta)|boton\s+de\s+pago|pagar\s+con\s+(credito|debito|visa|mastercard)|envia(me|r|rme|nos)?\s+(el\s+|un\s+)?(link|enlace)(\s+de\s+(pago|tarjeta))?|me\s+(envia|manda|pasa)s?\s+(el\s+|un\s+)?(link|enlace)(\s+de\s+(pago|tarjeta))?)\b/.test(
    norm
  );
}
