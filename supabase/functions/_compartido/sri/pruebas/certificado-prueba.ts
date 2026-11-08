// Genera un .p12 de prueba con la forma de los certificados ecuatorianos.
// @deno-types="npm:@types/node-forge@1.3.11"
import forge from "npm:node-forge@1.3.1";

// Certificado de prueba con la forma de los ecuatorianos: SERIALNUMBER con la
// cédula, extensión del arco del BCE con el RUC, uso de no repudio y la CA en el .p12.
export function crearP12(opciones: { conCa?: boolean; algoritmo?: "3des" | "aes256"; usoFirma?: boolean } = {}) {
  const { conCa = true, algoritmo = "3des", usoFirma = true } = opciones;
  const claveCa = forge.pki.rsa.generateKeyPair(2048);
  const ca = forge.pki.createCertificate();
  ca.publicKey = claveCa.publicKey;
  ca.serialNumber = "01";
  ca.validity.notBefore = new Date(Date.now() - 86_400_000);
  ca.validity.notAfter = new Date(Date.now() + 365 * 86_400_000);
  const nombreCa = [{ name: "countryName", value: "EC" }, { name: "organizationName", value: "CA DE PRUEBAS" }, {
    name: "commonName",
    value: "AUTORIDAD DE CERTIFICACION PRUEBAS, S.A.",
  }];
  ca.setSubject(nombreCa);
  ca.setIssuer(nombreCa);
  ca.setExtensions([{ name: "basicConstraints", cA: true }, { name: "keyUsage", keyCertSign: true }]);
  ca.sign(claveCa.privateKey, forge.md.sha256.create());

  const claves = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = claves.publicKey;
  cert.serialNumber = "8f3a21"; // bit alto activo: forge lo guarda como INTEGER positivo con 00 delante
  cert.validity.notBefore = new Date(Date.now() - 86_400_000);
  cert.validity.notAfter = new Date(Date.now() + 2 * 365 * 86_400_000);
  cert.setSubject([
    { name: "countryName", value: "EC" },
    { type: "2.5.4.5", value: "1710034065" },
    { name: "commonName", value: "MARIA JOSE PEREZ" },
  ]);
  cert.setIssuer(nombreCa);
  cert.setExtensions([
    usoFirma ? { name: "keyUsage", digitalSignature: true, nonRepudiation: true } : { name: "keyUsage", keyEncipherment: true },
    {
      id: "1.3.6.1.4.1.37746.3.11",
      value: forge.asn1.toDer(forge.asn1.create(forge.asn1.Class.UNIVERSAL, forge.asn1.Type.UTF8, false, "0993381762001"))
        .getBytes(),
    },
  ]);
  cert.sign(claveCa.privateKey, forge.md.sha256.create());

  const p12 = forge.pkcs12.toPkcs12Asn1(claves.privateKey, conCa ? [cert, ca] : [cert], "clave secreta", {
    algorithm: algoritmo,
  });
  const binario = forge.asn1.toDer(p12).getBytes();
  return {
    bytes: Uint8Array.from(binario, (c) => c.charCodeAt(0)),
    pem: forge.pki.certificateToPem(cert),
  };
}

