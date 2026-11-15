import { describe, expect, it } from "vitest";
import {
  calcularDesgloseImpuestosRide,
  calcularDigitoVerificadorSriModulo11,
  generarClaveAccesoSri49,
  generarHtmlFacturaRideSri,
  obtenerEmisorDefectoPorNegocio,
} from "./ride-sri";
import {
  firmarOrdenRespaldoServidor,
  verificarOrdenRespaldoServidor,
  type OrdenFirmadaServidor,
} from "./token-orden-firmada";

describe("Facturación Electrónica SRI (RIDE, Clave de Acceso Módulo 11 y Emisor por Negocio)", () => {
  it("genera una Clave de Acceso SRI de 49 dígitos con dígito verificador Módulo 11 válido", () => {
    const clave = generarClaveAccesoSri49({
      fechaIso: "2026-11-15T14:00:00.000Z",
      ruc: "1792837465001",
      ambiente: 1,
      establecimiento: "001",
      puntoEmision: "001",
      secuencialNumero: 42,
      tipoComprobante: "01",
    });

    expect(clave).toMatch(/^[0-9]{49}$/);
    expect(clave.slice(8, 10)).toBe("01");
    expect(clave.slice(10, 23)).toBe("1792837465001");
    expect(clave.slice(23, 24)).toBe("1");
    expect(clave.slice(24, 30)).toBe("001001");
    expect(clave.slice(30, 39)).toBe("000000042");

    const base48 = clave.slice(0, 48);
    const dv = Number(clave.slice(48));
    expect(dv).toBe(calcularDigitoVerificadorSriModulo11(base48));
  });

  it("calcula correctamente Subtotal 0% + Envío para arreglos florales (Pedestal $80 + Envío $6 = $86.00)", () => {
    const desglose = calcularDesgloseImpuestosRide({
      total: 86,
      lineas: [
        {
          codigo: "TNK-001",
          descripcion: "Pedestal Floral (XXL)",
          cantidad: 1,
          precio_unitario: 80,
          tarifa_iva: 0,
          subtotal: 80,
          valor_iva: 0,
        },
        {
          codigo: "ENVIO-DOM",
          descripcion: "Envío a domicilio (17.9 km)",
          cantidad: 1,
          precio_unitario: 6,
          tarifa_iva: 0,
          subtotal: 6,
          valor_iva: 0,
        },
      ],
    });

    expect(desglose).toEqual({
      subtotal15: 0,
      subtotal0: 86,
      iva15: 0,
      total: 86,
    });
  });

  it("renderiza el RIDE HTML con los datos tributarios propios de Tinkay y régimen RIMPE", () => {
    const emisorTinkay = obtenerEmisorDefectoPorNegocio("tinkay");
    const html = generarHtmlFacturaRideSri({
      negocio: "tinkay",
      emisor: {
        ...emisorTinkay,
        ruc: "1790016935001",
        razonSocial: "TINKAY FLORISTERIA S.A.S.",
        nombreComercial: "Tinkay Floristería",
        regimen: "RIMPE_EMPRENDEDOR",
      },
      numeroComprobante: "001-001-000000001",
      claveAcceso: "1511202601179001693500110010010000000011234567819",
      estadoSri: "AUTORIZADO",
      ambiente: 1,
      fechaEmision: "2026-11-15",
      comprador: {
        razonSocial: "Kleber Toapanta",
        identificacion: "1712345678",
        correo: "kleber.toapanta.ch@gmail.com",
        telefono: "0996438873",
      },
      lineas: [
        {
          codigo: "TNK-001",
          descripcion: "Pedestal Floral (XXL)",
          cantidad: 1,
          precio_unitario: 80,
          tarifa_iva: 0,
          subtotal: 80,
          valor_iva: 0,
        },
        {
          codigo: "ENVIO-DOM",
          descripcion: "Envío a domicilio (17.9 km)",
          cantidad: 1,
          precio_unitario: 6,
          tarifa_iva: 0,
          subtotal: 6,
          valor_iva: 0,
        },
      ],
      total: 86,
    });

    expect(html).toContain("TINKAY FLORISTERIA S.A.S.");
    expect(html).toContain("1790016935001");
    expect(html).toContain("CONTRIBUYENTE RÉGIMEN RIMPE");
    expect(html).toContain("Pedestal Floral (XXL)");
    expect(html).toContain("Envío a domicilio (17.9 km)");
    expect(html).not.toContain("1790016919001"); // Nunca filtra el RUC de Tranqi
  });
});

describe("Token de Orden Firmada HMAC-SHA256 para Checkout de Invitados", () => {
  const ordenEjemplo: OrdenFirmadaServidor = {
    v: 1,
    id: "8b7d4c10-1234-4a5b-9c00-112233445566",
    neg: "tinkay",
    cod: "TNK-ORD-0008",
    ori: "PEDIDO_TIENDA",
    est: "PENDIENTE_PAGO",
    vig: 15,
    sub: 80,
    des: 0,
    iva: 0,
    fle: 6,
    tot: 86,
    b0c: 8600,
    bgc: 0,
    iat: "2026-11-15T14:00:00.000Z",
    cmp: {
      nom: "Kleber Toapanta",
      ide: "1712345678",
      cor: "kleber.toapanta.ch@gmail.com",
      tel: "0996438873",
    },
    ubi: {
      ret: false,
      dir: "Av. Simón Bolívar, Quito",
      ref: "Frente al parque",
      zon: "Valle",
      km: 17.9,
    },
    itm: [
      {
        dsc: "Pedestal Floral",
        var: "XXL",
        can: 1,
        pun: 80,
        imp: "0",
        tot: 80,
      },
    ],
  };

  it("firma y verifica íntegramente una orden de tienda y rechaza cualquier adulteración", () => {
    const token = firmarOrdenRespaldoServidor(ordenEjemplo);
    expect(token.startsWith("eco1_")).toBe(true);

    const recuperada = verificarOrdenRespaldoServidor(token);
    expect(recuperada).not.toBeNull();
    expect(recuperada?.id).toBe(ordenEjemplo.id);
    expect(recuperada?.tot).toBe(86);
    expect(recuperada?.fle).toBe(6);

    // Manipular 1 carácter de la firma invalida el token
    const ultimoChar = token.endsWith("a") ? "b" : "a";
    const tokenAdulterado = token.slice(0, -1) + ultimoChar;
    expect(verificarOrdenRespaldoServidor(tokenAdulterado)).toBeNull();
  });
});
