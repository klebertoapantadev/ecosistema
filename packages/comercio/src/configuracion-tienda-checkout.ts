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
  /** Monto máximo en USD por debajo del cual se permite pagar sin nombre/identificación (Consumidor Final). Por defecto $50.00 */
  montoMaximoPagoSinDatosUsd: number;
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
      montoMaximoPagoSinDatosUsd: 50,
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
    montoMaximoPagoSinDatosUsd: 50,
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

  return {
    negocio: base.negocio,
    whatsappTienda: whatsappRaw,
    montoMaximoPagoSinDatosUsd,
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
