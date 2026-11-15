// Utilidades puras de Facturación Electrónica SRI Ecuador (PLT-006).
// Sin dependencias de Next.js ni secretos de servidor: compartidas entre acciones,
// consolas administrativas, checkouts de tienda y vistas públicas de proformas.

export type RegimenTributarioSri =
  | "GENERAL"
  | "RIMPE_EMPRENDEDOR"
  | "RIMPE_NEGOCIO_POPULAR";

export interface ConfiguracionEmisorSri {
  negocio: string;
  ruc: string;
  razonSocial: string;
  nombreComercial: string;
  direccionMatriz: string;
  direccionEstablecimiento: string;
  establecimiento: string;
  puntoEmision: string;
  obligadoContabilidad: boolean;
  regimen: RegimenTributarioSri;
  contribuyenteEspecial: string | null;
  agenteRetencion: string | null;
  correoCopia: string | null;
  ambiente: 1 | 2;
  produccionHabilitada: boolean;
  emisionAutomatica: boolean;
  activo: boolean;
  actualizadoEn?: string | null;
}

export interface CertificadoFirmaSriResumen {
  id: string;
  negocio: string;
  titular: string;
  identificacionCertificado: string | null;
  emisorCa: string;
  numeroSerie: string;
  validoDesde: string;
  validoHasta: string;
  huellaSha1: string;
  activo: boolean;
  creadoEn?: string;
}

export interface SecuencialSriResumen {
  negocio: string;
  ambiente: 1 | 2;
  establecimiento: string;
  puntoEmision: string;
  tipoComprobante: "01" | "04";
  ultimoNumero: number;
}

export interface LineaFacturaSriResumen {
  codigo: string;
  descripcion: string;
  cantidad: number;
  precio_unitario: number;
  descuento?: number;
  tarifa_iva: number;
  subtotal: number;
  valor_iva: number;
}

export const VALORES_EMISOR_DEFECTO_POR_NEGOCIO: Record<string, ConfiguracionEmisorSri> = {
  tranqi: {
    negocio: "tranqi",
    ruc: "1790016919001",
    razonSocial: "TRANQI LEGAL S.A.S.",
    nombreComercial: "Tranqi",
    direccionMatriz: "Av. República del Salvador y Moscú, Quito - Ecuador",
    direccionEstablecimiento: "Av. República del Salvador y Moscú, Quito - Ecuador",
    establecimiento: "001",
    puntoEmision: "001",
    obligadoContabilidad: true,
    regimen: "GENERAL",
    contribuyenteEspecial: null,
    agenteRetencion: null,
    correoCopia: "facturacion@tranqi24.com",
    ambiente: 1,
    produccionHabilitada: false,
    emisionAutomatica: true,
    activo: true,
  },
  tinkay: {
    negocio: "tinkay",
    ruc: "1792837465001",
    razonSocial: "TINKAY FLORISTERÍA CÍA. LTDA.",
    nombreComercial: "Tinkay Flores y Eventos",
    direccionMatriz: "El Batán Alto / Monteserrín, Quito - Ecuador",
    direccionEstablecimiento: "Taller Tinkay Floristería — El Batán Alto / Monteserrín, Quito",
    establecimiento: "001",
    puntoEmision: "001",
    obligadoContabilidad: false,
    regimen: "RIMPE_EMPRENDEDOR",
    contribuyenteEspecial: null,
    agenteRetencion: null,
    correoCopia: "pagos@tinkay.com",
    ambiente: 1,
    produccionHabilitada: false,
    emisionAutomatica: true,
    activo: true,
  },
  margaritas: {
    negocio: "margaritas",
    ruc: "1790016943001",
    razonSocial: "MARGARITAS FLORISTERÍA S.A.S.",
    nombreComercial: "Margaritas Floristería",
    direccionMatriz: "Av. De los Shyris y Portugal, Quito - Ecuador",
    direccionEstablecimiento: "Av. De los Shyris y Portugal, Quito - Ecuador",
    establecimiento: "001",
    puntoEmision: "001",
    obligadoContabilidad: false,
    regimen: "RIMPE_EMPRENDEDOR",
    contribuyenteEspecial: null,
    agenteRetencion: null,
    correoCopia: "facturacion@margaritas.ec",
    ambiente: 1,
    produccionHabilitada: false,
    emisionAutomatica: true,
    activo: true,
  },
  fastfix: {
    negocio: "fastfix",
    ruc: "1790016927001",
    razonSocial: "FASTFIX HOME SERVICIOS S.A.S.",
    nombreComercial: "FastFix Home",
    direccionMatriz: "Av. Amazonas y Naciones Unidas, Quito - Ecuador",
    direccionEstablecimiento: "Av. Amazonas y Naciones Unidas, Quito - Ecuador",
    establecimiento: "001",
    puntoEmision: "001",
    obligadoContabilidad: true,
    regimen: "GENERAL",
    contribuyenteEspecial: null,
    agenteRetencion: null,
    correoCopia: "facturacion@fastfix.ec",
    ambiente: 1,
    produccionHabilitada: false,
    emisionAutomatica: true,
    activo: true,
  },
};

export function obtenerEmisorDefectoPorNegocio(negocio: string): ConfiguracionEmisorSri {
  const n = String(negocio || "tranqi").toLowerCase().trim();
  if (n.includes("tinkay")) return { ...VALORES_EMISOR_DEFECTO_POR_NEGOCIO.tinkay! };
  if (n.includes("margarita")) return { ...VALORES_EMISOR_DEFECTO_POR_NEGOCIO.margaritas! };
  if (n.includes("fastfix")) return { ...VALORES_EMISOR_DEFECTO_POR_NEGOCIO.fastfix! };
  return { ...VALORES_EMISOR_DEFECTO_POR_NEGOCIO.tranqi! };
}

export function etiquetaRegimenSri(regimen?: string | null): string {
  if (regimen === "RIMPE_EMPRENDEDOR") return "CONTRIBUYENTE RÉGIMEN RIMPE";
  if (regimen === "RIMPE_NEGOCIO_POPULAR") return "CONTRIBUYENTE NEGOCIO POPULAR - RÉGIMEN RIMPE";
  return "RÉGIMEN GENERAL";
}

export function calcularDigitoVerificadorSriModulo11(base48: string): number {
  let suma = 0;
  let peso = 2;
  for (let i = base48.length - 1; i >= 0; i--) {
    const digito = parseInt(base48[i] || "0", 10);
    suma += digito * peso;
    peso = peso === 7 ? 2 : peso + 1;
  }
  const dv = 11 - (suma % 11);
  if (dv === 11) return 0;
  if (dv === 10) return 1;
  return dv;
}

export function generarClaveAccesoSri49(params: {
  fechaIso: string;
  ruc: string;
  ambiente: 1 | 2;
  establecimiento: string;
  puntoEmision: string;
  secuencialNumero: number;
  tipoComprobante?: "01" | "04";
}): string {
  const f = new Date(params.fechaIso || new Date().toISOString());
  const fechaValida = Number.isNaN(f.getTime()) ? new Date() : f;
  const dd = String(fechaValida.getDate()).padStart(2, "0");
  const mm = String(fechaValida.getMonth() + 1).padStart(2, "0");
  const yyyy = String(fechaValida.getFullYear());
  const tipoComprobante = params.tipoComprobante || "01";
  const ruc13 = (params.ruc || "1790016919001")
    .replace(/\D/g, "")
    .padEnd(13, "0")
    .slice(0, 13);
  const amb = params.ambiente === 2 ? "2" : "1";
  const estab = (params.establecimiento || "001").replace(/\D/g, "").padStart(3, "0").slice(-3);
  const pto = (params.puntoEmision || "001").replace(/\D/g, "").padStart(3, "0").slice(-3);
  const secNum = Math.max(1, Math.floor(Number(params.secuencialNumero) || 1));
  const sec9 = String(secNum).padStart(9, "0").slice(-9);
  const codigoNumerico8 = String(10000000 + ((secNum * 7919) % 89999999))
    .padStart(8, "0")
    .slice(0, 8);
  const tipoEmision = "1";
  const base48 = `${dd}${mm}${yyyy}${tipoComprobante}${ruc13}${amb}${estab}${pto}${sec9}${codigoNumerico8}${tipoEmision}`;
  const dv = calcularDigitoVerificadorSriModulo11(base48);
  return `${base48}${dv}`;
}

export function escaparHtmlSeguro(texto: unknown): string {
  return String(texto ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export interface DatosDocumentoRideSri {
  negocio: string;
  emisor?: Partial<ConfiguracionEmisorSri> | null;
  numeroComprobante: string;
  claveAcceso: string;
  estadoSri?: string;
  ambiente?: 1 | 2;
  fechaEmision: string;
  fechaAutorizacion?: string | null;
  comprador: {
    razonSocial: string;
    identificacion: string;
    correo?: string | null;
    telefono?: string | null;
    direccion?: string | null;
  };
  lineas?: LineaFacturaSriResumen[];
  rubroPrincipal?: string;
  codigoRubroPrincipal?: string;
  subtotal15?: number;
  subtotal0?: number;
  subtotalGeneral?: number;
  iva15?: number;
  total: number;
  formaPagoSri?: string;
  formaPagoTexto?: string;
  medioPagoRegistrado?: string;
  codigoAutorizacionPago?: string | null;
  referenciaTransaccion?: string | null;
  referenciaPago?: string | null;
}

export function calcularDesgloseImpuestosRide(datos: {
  total: number;
  subtotal15?: number;
  subtotal0?: number;
  subtotalGeneral?: number;
  iva15?: number;
  lineas?: LineaFacturaSriResumen[];
}): { subtotal15: number; subtotal0: number; iva15: number; total: number } {
  const total = Math.round(Number(datos.total || 0) * 100) / 100;

  if (Array.isArray(datos.lineas) && datos.lineas.length > 0) {
    let sub15 = 0;
    let sub0 = 0;
    let iva = 0;
    for (const l of datos.lineas) {
      const subLinea = Number(l.subtotal || 0);
      const ivaLinea = Number(l.valor_iva || 0);
      if (Number(l.tarifa_iva || 0) > 0 || ivaLinea > 0) {
        sub15 += subLinea;
        iva += ivaLinea;
      } else {
        sub0 += subLinea;
      }
    }
    return {
      subtotal15: Math.round(sub15 * 100) / 100,
      subtotal0: Math.round(sub0 * 100) / 100,
      iva15: Math.round(iva * 100) / 100,
      total: total || Math.round((sub15 + sub0 + iva) * 100) / 100,
    };
  }

  const ivaExplicito = datos.iva15 !== undefined && datos.iva15 !== null ? Number(datos.iva15) : null;
  const sub15Explicito = datos.subtotal15 !== undefined && datos.subtotal15 !== null ? Number(datos.subtotal15) : 0;
  const sub0Explicito = datos.subtotal0 !== undefined && datos.subtotal0 !== null ? Number(datos.subtotal0) : 0;

  if (sub15Explicito > 0 || sub0Explicito > 0 || ivaExplicito === 0) {
    const ivaFinal = ivaExplicito !== null ? Math.round(ivaExplicito * 100) / 100 : Math.round(sub15Explicito * 0.15 * 100) / 100;
    const sub0Final =
      sub0Explicito > 0
        ? Math.round(sub0Explicito * 100) / 100
        : ivaFinal === 0 && sub15Explicito === 0
          ? total
          : 0;
    return {
      subtotal15: Math.round(sub15Explicito * 100) / 100,
      subtotal0: sub0Final,
      iva15: ivaFinal,
      total,
    };
  }

  const sub15Inferido = Math.round((total / 1.15) * 100) / 100;
  const ivaInferido = Math.round((total - sub15Inferido) * 100) / 100;
  return {
    subtotal15: sub15Inferido,
    subtotal0: 0,
    iva15: ivaInferido,
    total,
  };
}

export function generarHtmlFacturaRideSri(datos: DatosDocumentoRideSri): string {
  const baseEmisor = obtenerEmisorDefectoPorNegocio(datos.negocio);
  const emisor: ConfiguracionEmisorSri = {
    ...baseEmisor,
    ...(datos.emisor || {}),
    ruc: datos.emisor?.ruc || baseEmisor.ruc,
    razonSocial: datos.emisor?.razonSocial || baseEmisor.razonSocial,
    nombreComercial: datos.emisor?.nombreComercial || baseEmisor.nombreComercial,
    direccionMatriz: datos.emisor?.direccionMatriz || baseEmisor.direccionMatriz,
    direccionEstablecimiento:
      datos.emisor?.direccionEstablecimiento ||
      datos.emisor?.direccionMatriz ||
      baseEmisor.direccionEstablecimiento,
    obligadoContabilidad:
      typeof datos.emisor?.obligadoContabilidad === "boolean"
        ? datos.emisor.obligadoContabilidad
        : baseEmisor.obligadoContabilidad,
    regimen: (datos.emisor?.regimen as RegimenTributarioSri) || baseEmisor.regimen,
  };

  const desglose = calcularDesgloseImpuestosRide({
    total: datos.total,
    subtotal15: datos.subtotal15,
    subtotal0: datos.subtotal0,
    iva15: datos.iva15,
    lineas: datos.lineas,
  });

  const lineasEfectivas: LineaFacturaSriResumen[] =
    Array.isArray(datos.lineas) && datos.lineas.length > 0
      ? datos.lineas
      : [
          {
            codigo: datos.codigoRubroPrincipal || (datos.negocio === "tinkay" || datos.negocio === "margaritas" ? "FLR-001" : "SERV-001"),
            descripcion:
              datos.rubroPrincipal ||
              (datos.negocio === "tinkay" || datos.negocio === "margaritas"
                ? "Arreglo Floral / Pedido de Tienda"
                : "Servicio Facturado"),
            cantidad: 1,
            precio_unitario: Math.round((desglose.subtotal15 + desglose.subtotal0) * 100) / 100,
            tarifa_iva: desglose.iva15 > 0 ? 15 : 0,
            subtotal: Math.round((desglose.subtotal15 + desglose.subtotal0) * 100) / 100,
            valor_iva: desglose.iva15,
          },
        ];

  const ambiente = datos.ambiente || emisor.ambiente || 1;
  const leyendaRegimen =
    emisor.regimen !== "GENERAL"
      ? `<div><strong>Régimen Tributario:</strong> ${escaparHtmlSeguro(etiquetaRegimenSri(emisor.regimen))}</div>`
      : "";
  const leyendaContribuyenteEspecial = emisor.contribuyenteEspecial
    ? `<div><strong>Contribuyente Especial Nro:</strong> ${escaparHtmlSeguro(emisor.contribuyenteEspecial)}</div>`
    : "";
  const leyendaAgenteRetencion = emisor.agenteRetencion
    ? `<div><strong>Agente de Retención Resolución Nro:</strong> ${escaparHtmlSeguro(emisor.agenteRetencion)}</div>`
    : "";

  const filasHtml = lineasEfectivas
    .map(
      (l) => `
        <tr>
          <td style="font-family:monospace">${escaparHtmlSeguro(l.codigo)}</td>
          <td>${Number(l.cantidad || 1).toFixed(2)}</td>
          <td><strong>${escaparHtmlSeguro(l.descripcion)}</strong></td>
          <td style="text-align:right">${Number(l.tarifa_iva || 0)}%</td>
          <td style="text-align:right">$${Number(l.precio_unitario || 0).toFixed(2)}</td>
          <td style="text-align:right"><strong>$${Number(l.subtotal || 0).toFixed(2)}</strong></td>
        </tr>`,
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="es">
<head>
  <meta charset="UTF-8" />
  <title>Factura Electrónica ${escaparHtmlSeguro(datos.numeroComprobante)} - ${escaparHtmlSeguro(emisor.nombreComercial || emisor.razonSocial)}</title>
  <style>
    @page { size: A4; margin: 14mm; }
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Arial, sans-serif; color: #0F172A; margin: 0; padding: 24px; background: #FFFFFF; }
    .contenedor { max-width: 780px; margin: 0 auto; border: 1px solid #CBD5E1; border-radius: 14px; padding: 24px; }
    .cabecera { display: flex; justify-content: space-between; gap: 16px; border-bottom: 2px solid #0F172A; padding-bottom: 16px; margin-bottom: 16px; }
    .caja { border: 1px solid #CBD5E1; border-radius: 10px; padding: 14px; flex: 1; }
    .caja-sri { background: #EEF2FF; border-color: #C7D2FE; }
    h1 { font-size: 17px; margin: 0 0 4px; color: #0F172A; }
    .subcomercial { font-size: 12px; font-weight: 700; color: #059669; margin-bottom: 8px; }
    h2 { font-size: 15px; margin: 0 0 6px; color: #3730A3; }
    .meta { font-size: 12px; color: #334155; line-height: 1.55; }
    .clave { font-family: monospace; font-size: 11px; background: #FFFFFF; border: 1px solid #C7D2FE; padding: 6px; border-radius: 6px; word-break: break-all; margin-top: 4px; }
    .comprador { border: 1px solid #CBD5E1; border-radius: 10px; padding: 14px; margin-bottom: 16px; background: #F8FAFC; font-size: 12px; line-height: 1.6; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 16px; font-size: 12px; }
    th { background: #0F172A; color: #FFFFFF; text-align: left; padding: 10px; }
    td { padding: 10px; border-bottom: 1px solid #E2E8F0; }
    .totales { display: flex; justify-content: space-between; gap: 16px; align-items: flex-start; }
    .totales-tabla { width: 290px; border: 1px solid #CBD5E1; border-radius: 10px; overflow: hidden; }
    .fila-total { display: flex; justify-content: space-between; padding: 8px 12px; font-size: 12px; border-bottom: 1px solid #E2E8F0; }
    .fila-total.final { background: #0F172A; color: #FFFFFF; font-weight: 800; font-size: 14px; border-bottom: none; }
    .acciones-no-print { text-align: right; margin-bottom: 14px; }
    .btn-print { background: #0F172A; color: #FFFFFF; border: none; padding: 9px 18px; border-radius: 8px; font-weight: 700; cursor: pointer; font-size: 13px; }
    @media print { .acciones-no-print { display: none !important; } body { padding: 0; } }
  </style>
</head>
<body>
  <div class="acciones-no-print">
    <button class="btn-print" onclick="window.print()">Imprimir / Guardar PDF</button>
  </div>
  <div class="contenedor">
    <div class="cabecera">
      <div class="caja">
        <h1>${escaparHtmlSeguro(emisor.razonSocial)}</h1>
        ${emisor.nombreComercial ? `<div class="subcomercial">${escaparHtmlSeguro(emisor.nombreComercial)}</div>` : ""}
        <div class="meta">
          <div><strong>RUC:</strong> ${escaparHtmlSeguro(emisor.ruc)}</div>
          <div><strong>Dirección Matriz:</strong> ${escaparHtmlSeguro(emisor.direccionMatriz)}</div>
          ${
            emisor.direccionEstablecimiento && emisor.direccionEstablecimiento !== emisor.direccionMatriz
              ? `<div><strong>Dirección Sucursal:</strong> ${escaparHtmlSeguro(emisor.direccionEstablecimiento)}</div>`
              : ""
          }
          <div><strong>Obligado a llevar Contabilidad:</strong> ${emisor.obligadoContabilidad ? "SÍ" : "NO"}</div>
          ${leyendaRegimen}
          ${leyendaContribuyenteEspecial}
          ${leyendaAgenteRetencion}
        </div>
      </div>
      <div class="caja caja-sri">
        <h2>FACTURA ELECTRÓNICA N° ${escaparHtmlSeguro(datos.numeroComprobante)}</h2>
        <div class="meta">
          <div><strong>Estado SRI:</strong> ${escaparHtmlSeguro(datos.estadoSri || "AUTORIZADO")}</div>
          <div><strong>Fecha de Emisión:</strong> ${escaparHtmlSeguro(datos.fechaEmision)}</div>
          <div><strong>Ambiente:</strong> ${ambiente === 2 ? "PRODUCCIÓN" : "PRUEBAS / CERTIFICACIÓN SRI"}</div>
          <div><strong>Clave de Acceso (49 dígitos):</strong></div>
          <div class="clave">${escaparHtmlSeguro(datos.claveAcceso)}</div>
        </div>
      </div>
    </div>

    <div class="comprador">
      <div><strong>Razón Social / Nombres y Apellidos:</strong> ${escaparHtmlSeguro(datos.comprador.razonSocial || "CONSUMIDOR FINAL")}</div>
      <div><strong>Identificación (RUC / Cédula / Pasaporte):</strong> ${escaparHtmlSeguro(datos.comprador.identificacion || "9999999999999")} &nbsp;|&nbsp; <strong>Correo:</strong> ${escaparHtmlSeguro(datos.comprador.correo || "—")}</div>
      <div><strong>Dirección:</strong> ${escaparHtmlSeguro(datos.comprador.direccion || "Quito - Ecuador")}${datos.referenciaTransaccion ? ` &nbsp;|&nbsp; <strong>Ref. Transacción:</strong> ${escaparHtmlSeguro(datos.referenciaTransaccion)}` : ""}</div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Código</th>
          <th>Cant.</th>
          <th>Descripción</th>
          <th style="text-align:right">IVA</th>
          <th style="text-align:right">P. Unitario</th>
          <th style="text-align:right">Subtotal</th>
        </tr>
      </thead>
      <tbody>${filasHtml}
      </tbody>
    </table>

    <div class="totales">
      <div class="caja" style="max-width:380px">
        <div class="meta">
          <div><strong>Forma de Pago SRI:</strong> ${escaparHtmlSeguro(datos.formaPagoSri || "20 - Otros con utilización del sistema financiero")}</div>
          ${datos.medioPagoRegistrado ? `<div><strong>Medio Registrado:</strong> ${escaparHtmlSeguro(datos.medioPagoRegistrado)}</div>` : ""}
          ${datos.codigoAutorizacionPago ? `<div><strong>Código de Autorización:</strong> ${escaparHtmlSeguro(datos.codigoAutorizacionPago)}</div>` : ""}
        </div>
      </div>
      <div class="totales-tabla">
        <div class="fila-total"><span>Subtotal 15%:</span><strong>$${desglose.subtotal15.toFixed(2)}</strong></div>
        <div class="fila-total"><span>Subtotal 0%:</span><strong>$${desglose.subtotal0.toFixed(2)}</strong></div>
        <div class="fila-total"><span>Subtotal sin impuestos:</span><strong>$${(desglose.subtotal15 + desglose.subtotal0).toFixed(2)}</strong></div>
        <div class="fila-total"><span>IVA 15%:</span><strong>$${desglose.iva15.toFixed(2)}</strong></div>
        <div class="fila-total final"><span>VALOR TOTAL:</span><span>$${desglose.total.toFixed(2)} USD</span></div>
      </div>
    </div>
  </div>
</body>
</html>`;
}

export function descargarArchivoFacturaRideSri(datos: DatosDocumentoRideSri): void {
  if (typeof window === "undefined") return;
  const html = generarHtmlFacturaRideSri(datos);
  const numLimpio = (datos.numeroComprobante || datos.referenciaTransaccion || "comprobante").replace(
    /[^a-zA-Z0-9_-]/g,
    "_",
  );
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Factura_Electronica_${numLimpio}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

export function imprimirFacturaRideSri(datos: DatosDocumentoRideSri): void {
  if (typeof window === "undefined") return;
  const html = generarHtmlFacturaRideSri(datos);
  const win = window.open("", "_blank", "width=880,height=800");
  if (win) {
    win.document.open();
    win.document.write(html);
    win.document.close();
    setTimeout(() => {
      win.focus();
      win.print();
    }, 250);
  } else {
    descargarArchivoFacturaRideSri(datos);
  }
}
