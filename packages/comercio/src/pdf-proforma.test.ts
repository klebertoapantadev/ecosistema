import { describe, expect, it } from "vitest";
import { generarPdfProformaBytes, textoSeguroPdf } from "./pdf-proforma";
import type { ProformaEventoPublica } from "./acciones-logistica";

describe("generarPdfProformaBytes", () => {
  it("genera un documento PDF válido para proforma original y actualización con tildes y emojis limpiados", async () => {
    const proformaMock: ProformaEventoPublica = {
      id: "00000000-0000-0000-0000-000000000001",
      secuencial: 12,
      codigoProforma: "TNK-PRF-0012-V2",
      grupoProformaId: "00000000-0000-0000-0000-000000000001",
      versionNumero: 2,
      esOriginal: false,
      etiquetaVersion: "Propuesta V2 — Ajuste tras llamada ✨",
      notaAsesor: "Incluimos arco de bienvenida con rosas blancas de exportación y cortesía en montaje.",
      asesorNombre: "Asesoría Tinkay",
      negocio: "tinkay",
      estado: "ENVIADA",
      vigenciaDias: 15,
      tokenAprobacion: "abcdef1234567890abcdef1234567890",
      creadoEn: "2026-11-15T10:00:00.000Z",
      comprador: {
        nombreCompleto: "María José Pérez Ñacato",
        identificacion: "1712345678",
        correo: "maria@example.com",
        whatsapp: "+593991234567",
        autorizaWhatsapp: true,
      },
      evento: {
        tipoEvento: "Boda Civil & Ceremonia 🌸",
        fechaEvento: "2026-12-12",
        horaEvento: "16:30",
        invitadosEstimados: 80,
        paletaColores: "Blanco marfil y verde olivo",
      },
      ubicacion: {
        retiroEnLocal: false,
        direccion: "Quinta San Patricio, Cumbayá",
        referencia: "Junto a la capilla",
        zonaDetectada: "Valle de Cumbayá",
        distanciaVialKm: 12.4,
      },
      subtotal: 210,
      descuento: 10,
      baseIva0: 180,
      baseIvaGravada: 20,
      iva: 3,
      flete: 20,
      total: 223,
      montoReserva70Usd: 156.1,
      montoAbonadoUsd: 0,
      saldoPendienteUsd: 223,
      items: [
        {
          descripcion: "Cartel Bienvenida Floral ✨ — Rosas Blancas",
          cantidad: 1,
          precioUnitario: 70,
          impuesto: "IVA_0",
          totalLinea: 70,
        },
        {
          descripcion: "Arco Ceremonial Botánico",
          cantidad: 1,
          precioUnitario: 110,
          impuesto: "IVA_0",
          totalLinea: 110,
        },
      ],
    };

    expect(textoSeguroPdf("Diseño Ñandú ✨ — $70")).toBe("Diseño Ñandú - $70");

    const bytes = await generarPdfProformaBytes(proformaMock, {
      urlPublica: "https://tinkay-web.vercel.app/proforma/abcdef1234567890abcdef1234567890",
    });

    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.byteLength).toBeGreaterThan(1200);
    const cabecera = Buffer.from(bytes.slice(0, 5)).toString("ascii");
    expect(cabecera).toBe("%PDF-");
  });
});

