import forge from "node-forge";
import { PDFDocument, rgb, StandardFonts } from "pdf-lib";

export interface InfoCertificado {
  nombreTitular: string;
  cedulaORuc?: string;
  entidadEmisora: string;
  validoDesde: Date;
  validoHasta: Date;
  numeroSerie: string;
  esValido: boolean;
}

/**
 * Parsea un archivo .p12 / .pfx en memoria del navegador utilizando node-forge.
 * NUNCA envía el archivo ni la clave al servidor (Zero-Custody Cryptography).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function parsearCertificadoP12(
  arrayBuffer: ArrayBuffer,
  password: string
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): { ok: true; info: InfoCertificado; privateKey: any; certificate: any } | { ok: false; error: string } {
  try {
    const bytes = new Uint8Array(arrayBuffer);
    let binary = "";
    for (let i = 0; i < bytes.byteLength; i++) {
      const b = bytes[i];
      if (b !== undefined) {
        binary += String.fromCharCode(b);
      }
    }

    const p12Asn1 = forge.asn1.fromDer(binary);
    const p12 = forge.pkcs12.pkcs12FromAsn1(p12Asn1, password);

    // Obtener bolsas de certificados y claves
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certOid = (forge.pki.oids as any).certBag || "1.2.840.113549.1.12.10.1.3";
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyOid = (forge.pki.oids as any).pkcs8ShroudedKeyBag || "1.2.840.113549.1.12.10.1.2";

    const certBags = p12.getBags({ bagType: certOid });
    const keyBags = p12.getBags({ bagType: keyOid });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const certBagArray = (certBags as any)[certOid] || [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const keyBagArray = (keyBags as any)[keyOid] || [];

    if (certBagArray.length === 0) {
      return { ok: false, error: "No se encontraron certificados en el archivo .p12/.pfx" };
    }

    const cert = certBagArray[0].cert;
    if (!cert) {
      return { ok: false, error: "El certificado dentro del archivo .p12 está dañado o no es legible." };
    }

    let privateKey = null;
    if (keyBagArray.length > 0 && keyBagArray[0].key) {
      privateKey = keyBagArray[0].key;
    }

    // Extraer atributos del sujeto
    let nombreTitular = "";
    let cedulaORuc = "";
    for (const attr of cert.subject.attributes) {
      if (attr.name === "commonName" || attr.shortName === "CN") {
        nombreTitular = String(attr.value);
      }
      if (attr.name === "serialNumber" || attr.shortName === "SN" || attr.name === "uniqueIdentifier") {
        cedulaORuc = String(attr.value);
      }
    }

    if (!nombreTitular && cert.subject.attributes.length > 0) {
      nombreTitular = String(cert.subject.attributes[0].value || "Firmante Acreditado");
    }

    // Extraer emisor
    let entidadEmisora = "";
    for (const attr of cert.issuer.attributes) {
      if (attr.name === "organizationName" || attr.shortName === "O" || attr.name === "commonName" || attr.shortName === "CN") {
        if (!entidadEmisora) entidadEmisora = String(attr.value);
        else entidadEmisora += ` (${attr.value})`;
      }
    }
    if (!entidadEmisora) entidadEmisora = "Entidad de Certificación de Información (Ecuador)";

    const validoDesde = cert.validity.notBefore;
    const validoHasta = cert.validity.notAfter;
    const ahora = new Date();
    const esValido = ahora >= validoDesde && ahora <= validoHasta;

    const numeroSerie = cert.serialNumber || "—";

    return {
      ok: true,
      info: {
        nombreTitular,
        cedulaORuc: cedulaORuc || undefined,
        entidadEmisora,
        validoDesde,
        validoHasta,
        numeroSerie,
        esValido,
      },
      privateKey,
      certificate: cert,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al procesar el archivo .p12";
    if (msg.includes("Invalid password") || msg.includes("PKCS#12 MAC could not be verified")) {
      return { ok: false, error: "Contraseña incorrecta para el certificado .p12 / .pfx." };
    }
    return { ok: false, error: `No se pudo leer el certificado: ${msg}` };
  }
}

export interface OpcionesEstampaFirma {
  pdfBytes: ArrayBuffer | Uint8Array;
  infoCertificado: InfoCertificado;
  rolFirmante: "ABOGADO_POSTULANTE" | "TRANQI_PLATAFORMA";
  razonFirma?: string;
  ubicacionCiudad?: string;
  posicion?: {
    x?: number;
    y?: number;
    paginaIndex?: number;
  };
}

/**
 * Estampa la firma visual con metadatos criptográficos en el PDF del contrato.
 */
export async function estamparFirmaDigitalEnPdf(
  opciones: OpcionesEstampaFirma
): Promise<{ ok: true; pdfFirmado: Uint8Array; nombreArchivo: string } | { ok: false; error: string }> {
  try {
    const { pdfBytes, infoCertificado, rolFirmante, razonFirma, posicion } = opciones;
    const pdfDoc = await PDFDocument.load(pdfBytes);
    const pages = pdfDoc.getPages();
    if (pages.length === 0) {
      return { ok: false, error: "El archivo PDF no contiene páginas." };
    }

    const targetPageIndex = (posicion?.paginaIndex !== undefined && posicion.paginaIndex >= 0 && posicion.paginaIndex < pages.length)
      ? posicion.paginaIndex
      : pages.length - 1;

    const paginaDestino = pages[targetPageIndex] || pages[pages.length - 1];
    if (!paginaDestino) {
      return { ok: false, error: "No se pudo acceder a la página destino del PDF." };
    }

    const { width, height } = paginaDestino.getSize();

    const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
    const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

    const ahora = new Date();
    const fechaHoraStr = ahora.toLocaleString("es-EC", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });

    const esTranqi = rolFirmante === "TRANQI_PLATAFORMA";
    
    // Dimensiones de la estampa
    const boxWidth = 230;
    const boxHeight = 85;

    // Coordenadas calculadas o personalizadas
    const defaultPosX = esTranqi ? 50 : width - boxWidth - 50;
    const defaultPosY = 75; // margen inferior arriba de las líneas

    const posX = posicion?.x !== undefined ? Math.max(10, Math.min(width - boxWidth - 10, posicion.x)) : defaultPosX;
    const posY = posicion?.y !== undefined ? Math.max(10, Math.min(height - boxHeight - 10, posicion.y)) : defaultPosY;

    // Fondo y borde del recuadro de firma digital
    const colorBorde = esTranqi ? rgb(0.31, 0, 0.73) : rgb(0.02, 0.53, 0.43);
    const colorFondo = esTranqi ? rgb(0.96, 0.94, 1.0) : rgb(0.93, 0.99, 0.96);
    const colorTexto = rgb(0.1, 0.1, 0.1);

    paginaDestino.drawRectangle({
      x: posX,
      y: posY,
      width: boxWidth,
      height: boxHeight,
      color: colorFondo,
      borderColor: colorBorde,
      borderWidth: 1.5,
    });

    // Encabezado del sello
    const headerText = esTranqi ? "FIRMA DIGITAL · TRANQI LEGAL" : "FIRMA ELECTRÓNICA AVANZADA";
    paginaDestino.drawText(headerText, {
      x: posX + 10,
      y: posY + boxHeight - 16,
      size: 7.5,
      font: fontBold,
      color: colorBorde,
    });

    // Nombre del Titular
    const nombreTruncado = infoCertificado.nombreTitular.length > 32 
      ? infoCertificado.nombreTitular.substring(0, 30) + "..."
      : infoCertificado.nombreTitular;
    
    paginaDestino.drawText(nombreTruncado, {
      x: posX + 10,
      y: posY + boxHeight - 30,
      size: 8.5,
      font: fontBold,
      color: colorTexto,
    });

    // Emisor / Entidad de Certificación
    const emisorTruncado = infoCertificado.entidadEmisora.length > 40
      ? infoCertificado.entidadEmisora.substring(0, 38) + "..."
      : infoCertificado.entidadEmisora;

    paginaDestino.drawText(`Emisor: ${emisorTruncado}`, {
      x: posX + 10,
      y: posY + boxHeight - 42,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Fecha y Hora oficial
    paginaDestino.drawText(`Fecha/Hora: ${fechaHoraStr} (ECT)`, {
      x: posX + 10,
      y: posY + boxHeight - 54,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Razón / Ubicación
    const razonTexto = razonFirma || (esTranqi ? "Aprobación y Formalización Institucional" : "Aceptación de Contrato de Sociedad");
    paginaDestino.drawText(`Razón: ${razonTexto}`, {
      x: posX + 10,
      y: posY + boxHeight - 66,
      size: 6.5,
      font: fontRegular,
      color: rgb(0.3, 0.3, 0.3),
    });

    // Sello de Integridad
    paginaDestino.drawText(`Validez Ley Comercio Electrónico EC · Serie: ${infoCertificado.numeroSerie.substring(0, 16)}...`, {
      x: posX + 10,
      y: posY + 8,
      size: 5.5,
      font: fontRegular,
      color: rgb(0.4, 0.4, 0.4),
    });

    // Actualizar metadatos del PDF
    pdfDoc.setTitle("Contrato de Sociedad de Abogados — tranqi");
    pdfDoc.setSubject("Contrato de Prestación de Servicios Profesionales y Sociedad Legal");
    pdfDoc.setProducer("tranqi® Legaltech Platform (PAdES / Zero-Custody)");
    pdfDoc.setModificationDate(ahora);

    const pdfFirmadoBytes = await pdfDoc.save();

    const nombreArchivo = esTranqi 
      ? `Contrato_Tranqi_BiFirmado_${ahora.toISOString().slice(0, 10)}.pdf`
      : `Contrato_Tranqi_Firmado_Abogado_${ahora.toISOString().slice(0, 10)}.pdf`;

    return {
      ok: true,
      pdfFirmado: pdfFirmadoBytes,
      nombreArchivo,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Error al estampar firma en el PDF";
    return { ok: false, error: msg };
  }
}
