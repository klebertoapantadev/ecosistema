// Carga de certificados .p12/.pfx de las CA ecuatorianas (BCE, Security Data,
// Uanataca…) para firmar comprobantes. Port de CargadorCertificados.cs y
// NombresX500.cs de DOMO.
//
// node-forge abre el PKCS#12 (3DES/RC2 con SHA1 de las CA locales, y también
// PBES2/AES); la firma RSA-SHA1 la hace WebCrypto con la clave exportada a
// PKCS#8, que es nativa y no gasta el presupuesto de CPU de la Edge Function.
//
// La clave privada y la contraseña solo viven en memoria durante la vuelta del
// worker: se leen de Vault (fac_fn_obtener_certificado), nunca se escriben en
// logs ni en la base en claro.

// @deno-types="npm:@types/node-forge@1.3.11"
import forge from "npm:node-forge@1.3.1";
import { encodeBase64 } from "jsr:@std/encoding@1.0.10/base64";

// Arcos privados de las CA que publican la cédula/RUC en extensiones propias.
const ARCOS_CA = [
  "1.3.6.1.4.1.37746.", // Banco Central del Ecuador
  "1.3.6.1.4.1.37947.", // Security Data
  "1.3.6.1.4.1.47286.",
];

const OID_CN = "2.5.4.3";
const OID_SERIALNUMBER = "2.5.4.5";

// Palabras clave de RFC 4514 más SERIALNUMBER (la cédula en los certificados
// ecuatorianos, que el X500Principal de Java del SRI acepta).
const PALABRAS_CLAVE: Record<string, string> = {
  [OID_CN]: "CN",
  "2.5.4.7": "L",
  "2.5.4.8": "ST",
  "2.5.4.10": "O",
  "2.5.4.11": "OU",
  "2.5.4.6": "C",
  "2.5.4.9": "STREET",
  "0.9.2342.19200300.100.1.25": "DC",
  "0.9.2342.19200300.100.1.1": "UID",
  [OID_SERIALNUMBER]: "SERIALNUMBER",
};

export class CertificadoInvalido extends Error {}

export interface MetadatosCertificado {
  titular: string;
  /** RUC (13) o cédula (10) encontrada en el certificado, o null. */
  identificacion: string | null;
  identificacionesCandidatas: string[];
  emisor: string;
  /** Serial en hexadecimal, en mayúsculas. */
  serial: string;
  validoDesde: Date;
  validoHasta: Date;
  huellaSha1: string;
  /** Firma del certificado comprobada contra la CA incluida en el .p12 (null si no venía la CA). */
  cadenaVerificada: boolean | null;
}

export interface CertificadoFirma {
  /** DER del certificado firmante. */
  der: Uint8Array<ArrayBuffer>;
  clavePrivada: CryptoKey;
  clavePublica: CryptoKey;
  /** Módulo y exponente RSA, big-endian sin ceros a la izquierda. */
  modulo: Uint8Array<ArrayBuffer>;
  exponente: Uint8Array<ArrayBuffer>;
  /** Emisor en RFC 2253 (X509IssuerName). */
  emisorRfc2253: string;
  /** Serial como entero decimal (X509SerialNumber). */
  serialDecimal: string;
  metadatos: MetadatosCertificado;
}

function aBinario(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  }
  return s;
}

function deBinario(s: string): Uint8Array<ArrayBuffer> {
  const bytes = new Uint8Array(s.length);
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i);
  return bytes;
}

function bigIntegerABytes(n: forge.jsbn.BigInteger): Uint8Array<ArrayBuffer> {
  const bytes = Uint8Array.from(n.toByteArray().map((b) => b & 0xff));
  let i = 0;
  while (i < bytes.length - 1 && bytes[i] === 0) i++;
  return bytes.subarray(i);
}

function escaparRfc4514(valor: string): string {
  let r = "";
  for (let i = 0; i < valor.length; i++) {
    const c = valor[i];
    if (c === "\0") {
      r += "\\00";
      continue;
    }
    if ('"+,;<>\\'.includes(c) || (i === 0 && (c === "#" || c === " ")) || (i === valor.length - 1 && c === " ")) {
      r += "\\";
    }
    r += c;
  }
  return r;
}

type Atributo = { type: string; value: string; valueTagClass: number };

function textoAtributo(a: Atributo): string {
  // forge ya decodifica UTF8String; PrintableString/IA5 llegan como latin-1 = ASCII.
  return String(a.value);
}

/** RFC 2253: del RDN más específico al más general, separados por "," sin espacios. */
function rfc2253(atributos: Atributo[]): string {
  return [...atributos].reverse().map((a) => {
    const clave = PALABRAS_CLAVE[a.type];
    if (clave) return clave + "=" + escaparRfc4514(textoAtributo(a));
    const der = forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, a.valueTagClass, false, a.value));
    return a.type + "=#" + der.toHex().toLowerCase();
  }).join(",");
}

function valores(atributos: Atributo[], oid: string): string[] {
  return atributos.filter((a) => a.type === oid).map(textoAtributo);
}

function textoExtension(valorDer: string): string | null {
  try {
    const nodo = forge.asn1.fromDer(valorDer, false);
    if (nodo.tagClass !== forge.asn1.Class.UNIVERSAL || typeof nodo.value !== "string") return null;
    return nodo.type === forge.asn1.Type.UTF8 ? forge.util.decodeUtf8(nodo.value) : nodo.value;
  } catch {
    return null;
  }
}

function identificacionesCandidatas(cert: forge.pki.Certificate): string[] {
  const textos = valores(cert.subject.attributes as Atributo[], OID_SERIALNUMBER);
  for (const ext of cert.extensions as { id: string; value: string }[]) {
    if (!ARCOS_CA.some((arco) => ext.id?.startsWith(arco))) continue;
    const texto = textoExtension(ext.value);
    if (texto) textos.push(texto);
  }
  const encontradas = textos.flatMap((t) => t.match(/(?<![0-9])([0-9]{13}|[0-9]{10})(?![0-9])/g) ?? []);
  return [...new Set(encontradas)];
}

function usoDeclarado(cert: forge.pki.Certificate): { firma: boolean } | null {
  const ext = cert.getExtension("keyUsage") as { digitalSignature?: boolean; nonRepudiation?: boolean } | null;
  if (!ext) return null;
  return { firma: Boolean(ext.digitalSignature || ext.nonRepudiation) };
}

/**
 * Abre el .p12 y elige el certificado de firma: el que tiene clave privada RSA
 * y uso de firma digital/no repudio (el más reciente si hay varios); sin
 * extensión KeyUsage el uso no está restringido (RFC 5280 §4.2.1.3).
 */
export async function cargarCertificado(p12: Uint8Array, clave: string): Promise<CertificadoFirma> {
  if (!p12 || p12.length === 0) throw new CertificadoInvalido("El archivo del certificado está vacío");

  let contenedor: forge.pkcs12.Pkcs12Pfx;
  try {
    contenedor = forge.pkcs12.pkcs12FromAsn1(forge.asn1.fromDer(aBinario(p12), false), false, clave);
  } catch {
    // El error de forge no incluye la contraseña, pero tampoco aporta: mensaje fijo.
    throw new CertificadoInvalido("Contraseña incorrecta o archivo no válido");
  }

  const bolsas = (tipo: string) => contenedor.getBags({ bagType: tipo })[tipo] ?? [];
  const claves = [
    ...bolsas(forge.pki.oids.pkcs8ShroudedKeyBag),
    ...bolsas(forge.pki.oids.keyBag),
  ].map((b) => b.key as forge.pki.rsa.PrivateKey | undefined).filter((k): k is forge.pki.rsa.PrivateKey => Boolean(k?.n));
  const certificados = bolsas(forge.pki.oids.certBag)
    .map((b) => b.cert)
    .filter((c): c is forge.pki.Certificate => Boolean(c));

  if (certificados.length === 0) throw new CertificadoInvalido("El archivo no contiene certificados");

  const pares = certificados.flatMap((cert) => {
    const publica = cert.publicKey as forge.pki.rsa.PublicKey;
    const privada = claves.find((k) => publica?.n && k.n.equals(publica.n));
    return privada ? [{ cert, privada }] : [];
  });
  if (pares.length === 0) throw new CertificadoInvalido("El certificado no tiene clave privada RSA");

  const elegido = pares
    .filter((p) => usoDeclarado(p.cert)?.firma)
    .sort((a, b) => b.cert.validity.notAfter.getTime() - a.cert.validity.notAfter.getTime())[0] ??
    pares.find((p) => usoDeclarado(p.cert) === null);
  if (!elegido) {
    throw new CertificadoInvalido(
      "El certificado no está habilitado para firma electrónica (su uso de clave no incluye firma digital)",
    );
  }

  const { cert, privada } = elegido;
  // certificateToAsn1 reutiliza el TBSCertificate original: el DER es el que firmó la CA.
  const der = deBinario(forge.asn1.toDer(forge.pki.certificateToAsn1(cert)).getBytes());
  const pkcs8 = deBinario(
    forge.asn1.toDer(forge.pki.wrapRsaPrivateKey(forge.pki.privateKeyToAsn1(privada))).getBytes(),
  );
  const spki = deBinario(forge.asn1.toDer(forge.pki.publicKeyToAsn1(cert.publicKey)).getBytes());
  const algoritmo = { name: "RSASSA-PKCS1-v1_5", hash: "SHA-1" };
  const clavePrivada = await crypto.subtle.importKey("pkcs8", pkcs8, algoritmo, false, ["sign"]);
  const clavePublica = await crypto.subtle.importKey("spki", spki, algoritmo, true, ["verify"]);
  pkcs8.fill(0);

  // Si el .p12 trae la CA emisora, se comprueba que el DER reconstruido sigue
  // siendo el que ella firmó (un DER alterado haría que el SRI rechace la firma).
  const ca = certificados.find((c) => c !== cert && c.subject.hash === cert.issuer.hash);
  let cadenaVerificada: boolean | null = null;
  if (ca) {
    try {
      cadenaVerificada = ca.verify(forge.pki.certificateFromAsn1(forge.asn1.fromDer(aBinario(der))));
    } catch {
      cadenaVerificada = false;
    }
  }

  const publica = cert.publicKey as forge.pki.rsa.PublicKey;
  const candidatas = identificacionesCandidatas(cert);
  const huella = new Uint8Array(await crypto.subtle.digest("SHA-1", der));
  const sujeto = cert.subject.attributes as Atributo[];
  const emisor = cert.issuer.attributes as Atributo[];

  return {
    der,
    clavePrivada,
    clavePublica,
    modulo: bigIntegerABytes(publica.n),
    exponente: bigIntegerABytes(publica.e),
    emisorRfc2253: rfc2253(emisor),
    serialDecimal: BigInt("0x" + (cert.serialNumber || "0")).toString(),
    metadatos: {
      titular: valores(sujeto, OID_CN)[0] ?? rfc2253(sujeto),
      identificacion: candidatas.find((x) => x.length === 13) ?? candidatas.find((x) => x.length === 10) ?? null,
      identificacionesCandidatas: candidatas,
      emisor: valores(emisor, OID_CN)[0] ?? rfc2253(emisor),
      serial: cert.serialNumber.toUpperCase(),
      validoDesde: cert.validity.notBefore,
      validoHasta: cert.validity.notAfter,
      huellaSha1: Array.from(huella, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase(),
      cadenaVerificada,
    },
  };
}

export function base64(bytes: Uint8Array): string {
  return encodeBase64(bytes);
}
