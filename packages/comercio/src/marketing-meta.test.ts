import { describe, expect, it } from "vitest";
import {
  construirBloqueAtribucionParaAria,
  construirBloqueReferralWhatsappParaAria,
  construirMensajeWhatsappContextual,
  detectarIntencionPublicitaria,
  extraerReferralMetaDeEventoMessenger,
  extraerReferralMetaDePayloadYcloud,
  generarXmlCatalogoMeta,
  obtenerSaludoInicialChatPorIntencion,
} from "./marketing-meta";

describe("PLT-025 — Marketing Meta, Catálogo XML y Atribución ARIA", () => {
  it("clasifica correctamente campañas de Condolencias, Eventos, Entrega Inmediata y Producto Puntual", () => {
    expect(
      detectarIntencionPublicitaria({
        utmCampaign: "campana_condolencias_quito_nov",
      })
    ).toBe("CONDOLENCIAS");

    expect(
      detectarIntencionPublicitaria({
        utmCampaign: "decoracion_bodas_y_eventos_2026",
      })
    ).toBe("EVENTOS");

    expect(
      detectarIntencionPublicitaria({
        rutaActual: "/categoria/entrega-inmediata",
      })
    ).toBe("ENTREGA_INMEDIATA");

    expect(
      detectarIntencionPublicitaria({
        rutaActual: "/producto/box-florales?variante=TIN-VAR-7",
        varianteSku: "TIN-VAR-7",
      })
    ).toBe("PRODUCTO_PUNTUAL");
  });

  it("inyecta tono sobrio obligatorio en Condolencias y respeta la prioridad del cliente en ARIA", () => {
    const bloque = construirBloqueAtribucionParaAria({
      utmSource: "fb",
      utmCampaign: "Coronas_Condolencias_Quito",
      rutaActual: "/categoria/condolencias",
      intencionDetectada: "CONDOLENCIAS",
    });

    expect(bloque).toContain("Condolencias y Homenajes");
    expect(bloque).toContain("PROHIBIDO usar emojis festivos");
    expect(bloque).toContain("prioriza de inmediato lo que el cliente escribió");

    const saludo = obtenerSaludoInicialChatPorIntencion("CONDOLENCIAS", {
      nombreAgente: "Mía",
      nombreNegocio: "Tinkay",
    });
    expect(saludo).toContain("total respeto");
    expect(saludo).not.toContain("🎉");
  });

  it("extrae el bloque referral de anuncios Click-to-WhatsApp en YCloud para ARIA", () => {
    const payloadYcloud = {
      whatsappInboundMessage: {
        from: "+593991234567",
        referral: {
          source_type: "ad",
          source_url: "https://fb.me/12345",
          headline: "Decoración Floral para Bodas y Eventos Corporativos",
          body: "Cotiza tu proforma personalizada en Quito",
          ctwa_clid: "ARAk82910384756",
        },
      },
    };

    const ref = extraerReferralMetaDePayloadYcloud(payloadYcloud);
    expect(ref).not.toBeNull();
    expect(ref?.intencionDetectada).toBe("EVENTOS");
    expect(ref?.ctwaClid).toBe("ARAk82910384756");

    const bloqueWa = construirBloqueReferralWhatsappParaAria(ref);
    expect(bloqueWa).toContain("Eventos, Bodas y Ceremonias");
    expect(bloqueWa).toContain("Decoración Floral para Bodas");
  });

  it("adapta el mensaje contextual de WhatsApp según la intención o SKU visto", () => {
    expect(
      construirMensajeWhatsappContextual("PRODUCTO_PUNTUAL", {
        nombreNegocio: "Tinkay",
        productoNombre: "Box Floral (M) + Orquídea",
        varianteSku: "TIN-VAR-7",
      })
    ).toContain("TIN-VAR-7");

    expect(construirMensajeWhatsappContextual("EVENTOS", { nombreNegocio: "Tinkay" })).toContain(
      "eventos"
    );
  });

  it("genera XML RSS 2.0 válido para Meta Commerce Manager y WhatsApp Business con SKU exacto", () => {
    const xml = generarXmlCatalogoMeta({
      tituloTienda: "Tinkay Flores & Eventos",
      descripcionTienda: "Catálogo vivo",
      urlBaseTienda: "https://tinkay-web.vercel.app/",
      items: [
        {
          idVarianteSku: "TIN-VAR-7",
          idGrupoProducto: "box-florales",
          titulo: "Box Floral (M) + Orquídea",
          descripcion: "Arreglo de rosas & orquídea en caja de lujo",
          enlaceProducto: "https://tinkay-web.vercel.app/producto/box-florales?variante=TIN-VAR-7",
          imagenPrincipalUrl: "https://tinkay-web.vercel.app/catalogo/box-m.jpg",
          precioRegularUsd: 70,
          precioOfertaUsd: 60,
          marca: "Tinkay Flores & Eventos",
          categoriaTexto: "Box Florales",
        },
      ],
    });

    expect(xml).toContain('xmlns:g="http://base.google.com/ns/1.0"');
    expect(xml).toContain("<g:id>TIN-VAR-7</g:id>");
    expect(xml).toContain("<g:item_group_id>box-florales</g:item_group_id>");
    expect(xml).toContain("<g:price>70.00 USD</g:price>");
    expect(xml).toContain("<g:sale_price>60.00 USD</g:sale_price>");
    expect(xml).toContain("Tinkay Flores &amp; Eventos");
  });

  it("extrae atribución publicitaria de anuncios Click-to-Messenger e Instagram Direct para ARIA", () => {
    const refMessenger = extraerReferralMetaDeEventoMessenger({
      source: "ADS",
      type: "OPEN_THREAD",
      ad_id: "12021499887766",
      ads_context_data: {
        ad_title: "Coronas de Condolencias con entrega inmediata en Quito",
        photo_url: "https://www.tinkay.net/catalogo/corona-blanca.jpg",
      },
    });

    expect(refMessenger).not.toBeNull();
    expect(refMessenger?.sourceId).toBe("12021499887766");
    expect(refMessenger?.intencionDetectada).toBe("CONDOLENCIAS");

    const bloqueIg = construirBloqueReferralWhatsappParaAria(refMessenger, "instagram");
    expect(bloqueIg).toContain("ORIGEN PUBLICITARIO META ADS EN INSTAGRAM DIRECT");
    expect(bloqueIg).toContain("Click-to-Instagram");
    expect(bloqueIg).toContain("PROHIBIDO usar emojis festivos");
  });
});
