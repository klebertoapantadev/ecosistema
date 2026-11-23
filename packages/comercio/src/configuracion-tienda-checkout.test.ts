import { describe, expect, it } from "vitest";
import {
  construirMensajeConfianzaChat,
  construirMensajeDatosPagoChat,
  construirUrlWhatsappTienda,
  crearConfiguracionTiendaCheckoutPorDefecto,
  detectarSolicitudPagoTarjetaEnMensaje,
  normalizarConfiguracionTiendaCheckout,
  parsearComandoChatPago,
} from "./configuracion-tienda-checkout";

describe("configuracion-tienda-checkout", () => {
  it("preconfigura Tinkay con WhatsApp +593 99 292 2343, umbral $0 (sin control), Pichincha, Produbanco y QR DeUna", () => {
    const def = crearConfiguracionTiendaCheckoutPorDefecto("tinkay");
    expect(def.whatsappTienda).toBe("+593 99 292 2343");
    expect(def.montoMaximoPagoSinDatosUsd).toBe(0);
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

  it("normaliza linkDeuna y construye el mensaje /DatosPago con DeUna, bancos y opción de tarjeta", () => {
    const cfg = normalizarConfiguracionTiendaCheckout("tinkay", {
      tarjetaCreditoHabilitada: true,
      transferencia: {
        linkDeuna: "  https://deuna.app/pagar/tinkay-uio  ",
      },
    });
    expect(cfg.transferencia.linkDeuna).toBe("https://deuna.app/pagar/tinkay-uio");

    const msgConTarjeta = construirMensajeDatosPagoChat(cfg, {
      montoTotal: 45.5,
      concepto: "Bouquet 24 rosas",
    });
    expect(msgConTarjeta).toContain("$45.50 USD (Bouquet 24 rosas)");
    expect(msgConTarjeta).toContain("https://deuna.app/pagar/tinkay-uio");
    expect(msgConTarjeta).toContain("Banco Pichincha");
    expect(msgConTarjeta).toContain("2211739080");
    expect(msgConTarjeta).toContain('*"TARJETA"*');

    const cfgSinTarjeta = normalizarConfiguracionTiendaCheckout("tinkay", {
      tarjetaCreditoHabilitada: false,
    });
    const msgSinTarjeta = construirMensajeDatosPagoChat(cfgSinTarjeta);
    expect(msgSinTarjeta).not.toContain('*"TARJETA"*');
    expect(msgSinTarjeta).toContain("código QR");
  });

  it("parsea comandos /LinkPago (con monto opcional) y /DatosPago", () => {
    expect(parsearComandoChatPago("/LinkPago")).toEqual({
      tipo: "LINK_PAGO",
      montoExplicito: null,
    });
    expect(parsearComandoChatPago("/linkpago 45")).toEqual({
      tipo: "LINK_PAGO",
      montoExplicito: 45,
    });
    expect(parsearComandoChatPago("/LinkPago $45.50")).toEqual({
      tipo: "LINK_PAGO",
      montoExplicito: 45.5,
    });
    expect(parsearComandoChatPago("/LinkPago 38,75")).toEqual({
      tipo: "LINK_PAGO",
      montoExplicito: 38.75,
    });
    expect(parsearComandoChatPago("/DatosPago")).toEqual({ tipo: "DATOS_PAGO" });
    expect(parsearComandoChatPago("/datospago")).toEqual({ tipo: "DATOS_PAGO" });
    expect(parsearComandoChatPago("/Confianza")).toEqual({ tipo: "CONFIANZA" });
    expect(parsearComandoChatPago("/confianza")).toEqual({ tipo: "CONFIANZA" });
    expect(parsearComandoChatPago("Hola, buenos días")).toBeNull();
  });

  it("construye el mensaje de respuesta rápida /Confianza con link a testimonios de clientes", () => {
    const msgTinkay = construirMensajeConfianzaChat("tinkay");
    expect(msgTinkay).toContain("https://tinkay-web.vercel.app/#testimonios");
    expect(msgTinkay).toContain("https://photos.app.goo.gl/pARRDFJCASyUW4vRA");
    expect(msgTinkay).toContain("Tinkay");

    const msgCustom = construirMensajeConfianzaChat("tinkay", {
      urlBase: "https://tinkay.ec/",
    });
    expect(msgCustom).toContain("https://tinkay.ec/#testimonios");
  });

  it("detecta solicitudes de pago con tarjeta sin confundirlas con tarjetas de dedicatoria floral", () => {
    expect(detectarSolicitudPagoTarjetaEnMensaje("TARJETA")).toBe(true);
    expect(detectarSolicitudPagoTarjetaEnMensaje("Con tarjeta por favor")).toBe(true);
    expect(detectarSolicitudPagoTarjetaEnMensaje("Quiero pagar con tarjeta de crédito")).toBe(true);
    expect(detectarSolicitudPagoTarjetaEnMensaje("Me envías el link de pago?")).toBe(true);
    expect(detectarSolicitudPagoTarjetaEnMensaje("¿Me pasas el enlace de tarjeta?")).toBe(true);
    expect(detectarSolicitudPagoTarjetaEnMensaje("Puedo pagar con Visa?")).toBe(true);

    // Falsos positivos de floristería (tarjeta de dedicatoria)
    expect(
      detectarSolicitudPagoTarjetaEnMensaje("En la tarjeta pon Feliz Cumpleaños mamá")
    ).toBe(false);
    expect(
      detectarSolicitudPagoTarjetaEnMensaje("Mensaje de la tarjeta: Con mucho cariño")
    ).toBe(false);
    expect(
      detectarSolicitudPagoTarjetaEnMensaje("Firma de la tarjeta: Tu hijo Carlos")
    ).toBe(false);
    expect(
      detectarSolicitudPagoTarjetaEnMensaje("Hola, cuánto cuesta el ramo de girasoles?")
    ).toBe(false);
  });
});
