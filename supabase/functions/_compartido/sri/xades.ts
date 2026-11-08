// Firma XAdES-BES 1.3.2 enveloped con RSA-SHA1 y digests SHA1, como exige el
// SRI (ficha técnica offline v2.34 p. 15-16 y ejemplo p. 112; NO SHA-256).
// Port de FirmadorXadesBes.cs de DOMO, que ya había pasado la revisión
// adversarial: tres referencias (SignedProperties, KeyInfo y #comprobante),
// ds:Signature como último hijo de la raíz.
//
// Los digests se calculan sobre la forma canónica que produce xml.ts: el
// comprobante se serializa ya en C14N, así que el C14N de cada fragmento es su
// serialización más los xmlns heredados (ver canonico()).
//
// xmlns:etsi se declara en QualifyingProperties y no en ds:Signature (aunque el
// ejemplo de la ficha lo haga): así queda fuera del ámbito de SignedInfo y de
// KeyInfo, y su C14N es el mismo para cualquier verificador (.NET SignedXml
// solo hereda los xmlns de la raíz al canonicalizar SignedInfo).

import { base64, type CertificadoFirma } from "./certificado.ts";
import { canonico, conEspacio, documento, el, type Elemento } from "./xml.ts";

export const NS_DS = "http://www.w3.org/2000/09/xmldsig#";
export const NS_ETSI = "http://uri.etsi.org/01903/v1.3.2#";
const C14N = "http://www.w3.org/TR/2001/REC-xml-c14n-20010315";
const RSA_SHA1 = "http://www.w3.org/2000/09/xmldsig#rsa-sha1";
const SHA1 = "http://www.w3.org/2000/09/xmldsig#sha1";
const ENVELOPED = "http://www.w3.org/2000/09/xmldsig#enveloped-signature";
const TIPO_SIGNED_PROPERTIES = "http://uri.etsi.org/01903#SignedProperties";
export const ID_COMPROBANTE = "comprobante";

const utf8 = new TextEncoder();

async function sha1Base64(texto: string): Promise<string> {
  return base64(new Uint8Array(await crypto.subtle.digest("SHA-1", utf8.encode(texto))));
}

function aleatorio(): number {
  const [n] = crypto.getRandomValues(new Uint32Array(1));
  return 1_000_000 + (n % 9_000_000);
}

/** Hora de firma en Ecuador continental (sin horario de verano: siempre -05:00). */
export function horaFirma(ahora: Date): string {
  return new Date(ahora.getTime() - 5 * 3_600_000).toISOString().slice(0, 19) + "-05:00";
}

function ds(nombre: string, atributos: Record<string, string> = {}, ...hijos: (Elemento | string)[]) {
  return el("ds:" + nombre, atributos, ...hijos);
}

function etsi(nombre: string, atributos: Record<string, string> = {}, ...hijos: (Elemento | string)[]) {
  return el("etsi:" + nombre, atributos, ...hijos);
}

function digest(valor: string) {
  return [ds("DigestMethod", { Algorithm: SHA1 }), ds("DigestValue", {}, valor)];
}

/**
 * Firma el comprobante (raíz con id="comprobante", sin firma previa) y
 * devuelve el documento completo con declaración UTF-8. Antes de devolverlo
 * comprueba la firma con la clave pública: nunca sale una firma que no valide.
 */
export async function firmarComprobante(
  comprobante: Elemento,
  certificado: CertificadoFirma,
  ahora: Date = new Date(),
): Promise<string> {
  if (comprobante.atributos.id !== ID_COMPROBANTE) {
    throw new Error(`La raíz del XML a firmar debe tener id="${ID_COMPROBANTE}"`);
  }
  if (comprobante.hijos.some((h) => typeof h !== "string" && h.nombre === "ds:Signature")) {
    throw new Error("El XML ya está firmado");
  }
  if (Object.keys(comprobante.espacios).length > 0) {
    // El digest del comprobante asume que la raíz no declara namespaces (los XSD del SRI no los usan).
    throw new Error("La raíz del comprobante no debe declarar namespaces");
  }

  // Tras el transform enveloped queda exactamente el comprobante sin firma.
  const digestComprobante = await sha1Base64(canonico(comprobante));

  const idFirma = "Signature" + aleatorio();
  const ids = {
    signedInfo: "Signature-SignedInfo" + aleatorio(),
    referenciaPropiedades: "SignedPropertiesID" + aleatorio(),
    propiedades: idFirma + "-SignedProperties" + aleatorio(),
    certificado: "Certificate" + aleatorio(),
    referenciaComprobante: "Reference-ID-" + aleatorio(),
    valorFirma: "SignatureValue" + aleatorio(),
    objeto: idFirma + "-Object" + aleatorio(),
  };

  // KeyInfo: el certificado firmante (referenciado y firmado, para que no se pueda sustituir).
  const keyInfo = ds(
    "KeyInfo",
    { Id: ids.certificado },
    ds("X509Data", {}, ds("X509Certificate", {}, base64(certificado.der))),
    ds(
      "KeyValue",
      {},
      ds(
        "RSAKeyValue",
        {},
        ds("Modulus", {}, base64(certificado.modulo)),
        ds("Exponent", {}, base64(certificado.exponente)),
      ),
    ),
  );

  const huellaCertificado = base64(new Uint8Array(await crypto.subtle.digest("SHA-1", certificado.der)));
  const propiedades = etsi(
    "SignedProperties",
    { Id: ids.propiedades },
    etsi(
      "SignedSignatureProperties",
      {},
      etsi("SigningTime", {}, horaFirma(ahora)),
      etsi(
        "SigningCertificate",
        {},
        etsi(
          "Cert",
          {},
          etsi("CertDigest", {}, ...digest(huellaCertificado)),
          etsi(
            "IssuerSerial",
            {},
            ds("X509IssuerName", {}, certificado.emisorRfc2253),
            ds("X509SerialNumber", {}, certificado.serialDecimal),
          ),
        ),
      ),
    ),
    etsi(
      "SignedDataObjectProperties",
      {},
      etsi(
        "DataObjectFormat",
        { ObjectReference: "#" + ids.referenciaComprobante },
        etsi("Description", {}, "contenido comprobante"),
        etsi("MimeType", {}, "text/xml"),
      ),
    ),
  );

  // Namespaces en ámbito de cada fragmento dentro del documento final.
  const enFirma = { ds: NS_DS };
  const enPropiedades = { ds: NS_DS, etsi: NS_ETSI };
  const digestPropiedades = await sha1Base64(canonico(propiedades, enPropiedades));
  const digestCertificado = await sha1Base64(canonico(keyInfo, enFirma));

  const signedInfo = ds(
    "SignedInfo",
    { Id: ids.signedInfo },
    ds("CanonicalizationMethod", { Algorithm: C14N }),
    ds("SignatureMethod", { Algorithm: RSA_SHA1 }),
    ds(
      "Reference",
      { Id: ids.referenciaPropiedades, Type: TIPO_SIGNED_PROPERTIES, URI: "#" + ids.propiedades },
      ...digest(digestPropiedades),
    ),
    ds("Reference", { URI: "#" + ids.certificado }, ...digest(digestCertificado)),
    ds(
      "Reference",
      { Id: ids.referenciaComprobante, URI: "#" + ID_COMPROBANTE },
      ds("Transforms", {}, ds("Transform", { Algorithm: ENVELOPED })),
      ...digest(digestComprobante),
    ),
  );

  const signedInfoCanonico = utf8.encode(canonico(signedInfo, enFirma));
  const firma = new Uint8Array(
    await crypto.subtle.sign("RSASSA-PKCS1-v1_5", certificado.clavePrivada, signedInfoCanonico),
  );
  if (!await crypto.subtle.verify("RSASSA-PKCS1-v1_5", certificado.clavePublica, firma, signedInfoCanonico)) {
    throw new Error("La firma XAdES generada no supera la verificación");
  }

  const signature = conEspacio(
    ds(
      "Signature",
      { Id: idFirma },
      signedInfo,
      ds("SignatureValue", { Id: ids.valorFirma }, base64(firma)),
      keyInfo,
      ds(
        "Object",
        { Id: ids.objeto },
        conEspacio(etsi("QualifyingProperties", { Target: "#" + idFirma }, propiedades), "etsi", NS_ETSI),
      ),
    ),
    "ds",
    NS_DS,
  );

  return documento({ ...comprobante, hijos: [...comprobante.hijos, signature] });
}
