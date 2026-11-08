// Comprobantes de prueba compartidos por los tests de XML, firma y RIDE.
import type { Comprobante, LineaDetalle } from "../comprobante.ts";

export function linea(parcial: Partial<LineaDetalle> & Pick<LineaDetalle, "orden">): LineaDetalle {
  return {
    codigo: `SRV-${parcial.orden}`,
    codigoAuxiliar: null,
    descripcion: `Servicio legal ${parcial.orden}`,
    cantidad: "1",
    precioUnitario: "10.00",
    descuento: "0.00",
    codigoIva: "4",
    detallesAdicionales: [],
    ...parcial,
  };
}

export function factura(parcial: Partial<Comprobante> = {}): Comprobante {
  return {
    tipo: "01",
    ambiente: 1,
    claveAcceso: "1111202401099338176200110020010000003961234567815",
    numero: 396,
    fechaEmision: "2024-11-11",
    emisor: {
      ruc: "0993381762001",
      razonSocial: "TRANQI SOLUCIONES LEGALES S.A.S.",
      nombreComercial: "Tranqi",
      direccionMatriz: "Av. Amazonas N34-120 y Atahualpa, Quito",
      obligadoContabilidad: true,
      contribuyenteEspecial: null,
      agenteRetencion: null,
      regimen: "GENERAL",
    },
    establecimiento: { codigo: "002", direccion: "Av. Amazonas N34-120, Quito", nombreComercial: null },
    puntoEmision: "001",
    comprador: {
      tipoIdentificacion: "05",
      identificacion: "1710034065",
      razonSocial: "María José Pérez Ñáñez",
      direccion: "Calle Los Álamos 12 & Av. 6 de Diciembre",
      correo: "maria@ejemplo.com",
      telefono: "0991234567",
    },
    detalles: [linea({ orden: 1 })],
    pagos: [{ formaPago: "19", total: "11.50", plazo: null, unidadTiempo: null }],
    infoAdicional: [{ nombre: "Plan", valor: "Amparo Familiar <mensual>" }],
    modifica: null,
    motivo: null,
    ...parcial,
  };
}

export function notaCredito(parcial: Partial<Comprobante> = {}): Comprobante {
  return factura({
    tipo: "04",
    claveAcceso: "1111202404099338176200110020010000000011234567812",
    numero: 1,
    pagos: [],
    modifica: { codDoc: "01", numero: "002-001-000000396", fechaEmision: "2024-11-11" },
    motivo: "Devolución por servicio no prestado",
    ...parcial,
  });
}

/** Escenarios que deben validar contra el XSD oficial. */
export function escenarios(): Record<string, Comprobante> {
  return {
    "factura IVA 15 %": factura(),
    "factura IVA 0 %": factura({
      detalles: [linea({ orden: 1, codigoIva: "0" })],
      pagos: [{ formaPago: "20", total: "10.00", plazo: null, unidadTiempo: null }],
    }),
    "factura mixta con descuento y 6 decimales": factura({
      detalles: [
        linea({ orden: 1, cantidad: "3", precioUnitario: "12.345678", descuento: "1.00" }),
        linea({ orden: 2, codigoIva: "0", cantidad: "2.5", precioUnitario: "4.10" }),
        linea({ orden: 3, codigoIva: "6", descripcion: "Tasa judicial (no objeto)" }),
      ],
      pagos: [{ formaPago: "16", total: "61.70", plazo: 30, unidadTiempo: "dias" }],
    }),
    "factura RIMPE emprendedor": factura({
      emisor: { ...factura().emisor, regimen: "RIMPE_EMPRENDEDOR", obligadoContabilidad: false },
    }),
    "factura a consumidor final": factura({
      comprador: {
        tipoIdentificacion: "07",
        identificacion: "9999999999999",
        razonSocial: "CONSUMIDOR FINAL",
        direccion: null,
        correo: null,
        telefono: null,
      },
      infoAdicional: [],
    }),
    "nota de crédito": notaCredito(),
  };
}
