import { assert, assertEquals, assertMatch, assertRejects, assertStringIncludes } from "jsr:@std/assert@1.0.13";
import { CertificadoInvalido, cargarCertificado } from "../certificado.ts";
import { firmarComprobante, horaFirma } from "../xades.ts";
import { el } from "../xml.ts";
import { crearP12 } from "./certificado-prueba.ts";

function comprobante() {
  return el(
    "factura",
    { id: "comprobante", version: "1.1.0" },
    el("infoTributaria", {}, el("razonSocial", {}, "Pérez & Ñáñez <Abogados>"), el("ruc", {}, "0993381762001")),
    el("infoAdicional", {}, el("campoAdicional", { nombre: "Email" }, "maria@ejemplo.com")),
  );
}

const p12 = crearP12();

Deno.test("certificado: carga el .p12, extrae RUC, titular y comprueba la cadena", async () => {
  const c = await cargarCertificado(p12.bytes, "clave secreta");
  assertEquals(c.metadatos.titular, "MARIA JOSE PEREZ");
  assertEquals(c.metadatos.identificacion, "0993381762001");
  assertEquals(c.metadatos.identificacionesCandidatas.sort(), ["0993381762001", "1710034065"]);
  assertEquals(c.metadatos.emisor, "AUTORIDAD DE CERTIFICACION PRUEBAS, S.A.");
  assertEquals(c.metadatos.cadenaVerificada, true);
  assertEquals(c.serialDecimal, String(0x8f3a21));
  assertEquals(c.emisorRfc2253, "CN=AUTORIDAD DE CERTIFICACION PRUEBAS\\, S.A.,O=CA DE PRUEBAS,C=EC");
  assertMatch(c.metadatos.huellaSha1, /^[0-9A-F]{40}$/);
});

Deno.test("certificado: también abre .p12 con AES-256/PBKDF2", async () => {
  const moderno = crearP12({ algoritmo: "aes256", conCa: false });
  const c = await cargarCertificado(moderno.bytes, "clave secreta");
  assertEquals(c.metadatos.cadenaVerificada, null);
});

Deno.test("certificado: contraseña incorrecta o sin uso de firma", async () => {
  await assertRejects(() => cargarCertificado(p12.bytes, "otra"), CertificadoInvalido, "Contraseña incorrecta");
  await assertRejects(() => cargarCertificado(new Uint8Array(), "x"), CertificadoInvalido, "vacío");
  const sinFirma = crearP12({ usoFirma: false, conCa: false });
  await assertRejects(() => cargarCertificado(sinFirma.bytes, "clave secreta"), CertificadoInvalido, "firma");
});

Deno.test("firma: estructura XAdES-BES del SRI", async () => {
  const cert = await cargarCertificado(p12.bytes, "clave secreta");
  const xml = await firmarComprobante(comprobante(), cert, new Date("2024-11-11T15:04:05Z"));
  assert(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?><factura id="comprobante" version="1.1.0">'));
  assert(xml.endsWith("</ds:Signature></factura>"));
  assertStringIncludes(xml, '<ds:Signature xmlns:ds="http://www.w3.org/2000/09/xmldsig#" Id="Signature');
  assertStringIncludes(xml, "<etsi:SigningTime>2024-11-11T10:04:05-05:00</etsi:SigningTime>");
  assertStringIncludes(xml, '<etsi:QualifyingProperties xmlns:etsi="http://uri.etsi.org/01903/v1.3.2#" Target="#Signature');
  assertStringIncludes(xml, 'Algorithm="http://www.w3.org/2000/09/xmldsig#rsa-sha1"');
  assertEquals(xml.match(/<ds:Reference /g)?.length, 3);
  assertEquals(horaFirma(new Date("2026-01-01T03:00:00Z")), "2025-12-31T22:00:00-05:00");
});

Deno.test("firma: no firma dos veces ni una raíz sin id=comprobante", async () => {
  const cert = await cargarCertificado(p12.bytes, "clave secreta");
  await assertRejects(() => firmarComprobante(el("factura", { id: "otro" }), cert));
  const conFirma = el("factura", { id: "comprobante" }, el("ds:Signature"));
  await assertRejects(() => firmarComprobante(conFirma, cert), Error, "ya está firmado");
});

// Verificación con otra implementación (signxml + lxml + cryptography). Solo
// corre si XADES_PYTHON apunta a un python con signxml==4.0.3 (ver README).
const python = Deno.env.get("XADES_PYTHON");
Deno.test({
  name: "firma: valida con signxml (verificador independiente)",
  ignore: !python,
  async fn() {
    const cert = await cargarCertificado(p12.bytes, "clave secreta");
    const dir = await Deno.makeTempDir();
    try {
      const xml = await firmarComprobante(comprobante(), cert);
      await Deno.writeTextFile(`${dir}/firmado.xml`, xml);
      await Deno.writeTextFile(`${dir}/cert.pem`, p12.pem);
      const script = decodeURIComponent(new URL("./verificar_firma.py", import.meta.url).pathname.replace(/^\/(\w:)/, "$1"));
      const { code, stdout, stderr } = await new Deno.Command(python!, {
        args: [script, `${dir}/firmado.xml`, `${dir}/cert.pem`],
      }).output();
      const salida = new TextDecoder().decode(stdout) + new TextDecoder().decode(stderr);
      assertEquals(code, 0, salida);
      assertStringIncludes(salida, "referencias verificadas: 3");
    } finally {
      await Deno.remove(dir, { recursive: true });
    }
  },
});
