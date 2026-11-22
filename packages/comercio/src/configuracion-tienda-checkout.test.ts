import { describe, expect, it } from "vitest";
import {
  construirUrlWhatsappTienda,
  crearConfiguracionTiendaCheckoutPorDefecto,
  normalizarConfiguracionTiendaCheckout,
} from "./configuracion-tienda-checkout";

describe("configuracion-tienda-checkout", () => {
  it("preconfigura Tinkay con WhatsApp +593 99 292 2343, umbral $50, Pichincha, Produbanco y QR DeUna", () => {
    const def = crearConfiguracionTiendaCheckoutPorDefecto("tinkay");
    expect(def.whatsappTienda).toBe("+593 99 292 2343");
    expect(def.montoMaximoPagoSinDatosUsd).toBe(50);
    expect(def.transferencia.habilitada).toBe(true);
    expect(def.transferencia.nombreTitular).toBe("Kleber Toapanta");
    expect(def.transferencia.identificacionTitular).toBe("1714898226");
    expect(def.transferencia.correoTitular).toBe("tinkay.uio@gmail.com");
    expect(def.transferencia.qrDeunaUrl).toBe("/img/qr-deuna-tinkay.png");
    expect(def.transferencia.cuentas).toEqual([
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
    ]);
  });

  it("normaliza valores personalizados respetando respaldos seguros por negocio", () => {
    const norm = normalizarConfiguracionTiendaCheckout("tinkay", {
      whatsappTienda: "+593 98 111 2233",
      montoMaximoPagoSinDatosUsd: 75,
      transferencia: {
        nombreTitular: "Tinkay Eventos",
        cuentas: [
          {
            banco: "Banco Guayaquil",
            tipoCuenta: "Corriente",
            numeroCuenta: "99887766",
          },
        ],
      },
    });

    expect(norm.whatsappTienda).toBe("+593 98 111 2233");
    expect(norm.montoMaximoPagoSinDatosUsd).toBe(75);
    expect(norm.transferencia.nombreTitular).toBe("Tinkay Eventos");
    expect(norm.transferencia.identificacionTitular).toBe("1714898226");
    expect(norm.transferencia.cuentas).toHaveLength(1);
    expect(norm.transferencia.cuentas[0]?.banco).toBe("Banco Guayaquil");
  });

  it("construye enlaces wa.me válidos convirtiendo números locales 09... a +593", () => {
    const url1 = construirUrlWhatsappTienda("+593 99 292 2343", "Hola Tinkay");
    expect(url1).toBe("https://wa.me/593992922343?text=Hola%20Tinkay");

    const url2 = construirUrlWhatsappTienda("0992922343", "");
    expect(url2).toBe("https://wa.me/593992922343");
  });

  it("permite habilitar y deshabilitar tarjetaCreditoHabilitada manteniendo default true", () => {
    const def = crearConfiguracionTiendaCheckoutPorDefecto("tinkay");
    expect(def.tarjetaCreditoHabilitada).toBe(true);

    const deshabilitada = normalizarConfiguracionTiendaCheckout("tinkay", {
      tarjetaCreditoHabilitada: false,
    });
    expect(deshabilitada.tarjetaCreditoHabilitada).toBe(false);

    const aliasLegacy = normalizarConfiguracionTiendaCheckout("tinkay", {
      tarjetaHabilitada: false,
    });
    expect(aliasLegacy.tarjetaCreditoHabilitada).toBe(false);

    const habilitada = normalizarConfiguracionTiendaCheckout("tinkay", {
      tarjetaCreditoHabilitada: true,
    });
    expect(habilitada.tarjetaCreditoHabilitada).toBe(true);
  });
});
