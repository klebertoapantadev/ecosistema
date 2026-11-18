import crypto from "node:crypto";
import { describe, expect, it } from "vitest";
import {
  cifrarPayloadWebPushAes128Gcm,
  generarParClavesVapid,
} from "./web-push-nativo";

function aBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

describe("web-push-nativo (RFC 8291 + RFC 8292)", () => {
  it("genera claves VAPID P-256 válidas de 65 y 32 bytes", () => {
    const claves = generarParClavesVapid();
    const pub = Buffer.from(claves.publicKey.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const priv = Buffer.from(claves.privateKey.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    expect(pub.length).toBe(65);
    expect(pub[0]).toBe(0x04);
    expect(priv.length).toBe(32);
  });

  it("cifra y descifra simétricamente un payload aes128gcm conforme a RFC 8291", () => {
    const clienteEcdh = crypto.createECDH("prime256v1");
    clienteEcdh.generateKeys();
    const p256dh = aBase64Url(clienteEcdh.getPublicKey());
    const auth = aBase64Url(crypto.randomBytes(16));

    const mensajeOriginal = JSON.stringify({
      title: "Tinkay · Eventos Tinkay",
      body: "Hola, busco un arreglo floral",
      url: "/panel/conversaciones?chat=abc-123",
    });

    const paquete = cifrarPayloadWebPushAes128Gcm(
      Buffer.from(mensajeOriginal, "utf8"),
      p256dh,
      auth
    );

    // Extraer cabecera RFC 8188
    const salt = paquete.subarray(0, 16);
    const rs = paquete.readUInt32BE(16);
    const idLen = paquete[20]!;
    expect(rs).toBe(4096);
    expect(idLen).toBe(65);

    const serverPub = paquete.subarray(21, 21 + idLen);
    const resto = paquete.subarray(21 + idLen);
    const ciphertext = resto.subarray(0, resto.length - 16);
    const tag = resto.subarray(resto.length - 16);

    // Descifrar como haría el navegador
    const shared = clienteEcdh.computeSecret(serverPub);
    const authBuf = Buffer.from(auth.replace(/-/g, "+").replace(/_/g, "/"), "base64");
    const keyInfo = Buffer.concat([
      Buffer.from("WebPush: info\0", "ascii"),
      clienteEcdh.getPublicKey(),
      serverPub,
    ]);
    const ikm = Buffer.from(crypto.hkdfSync("sha256", shared, authBuf, keyInfo, 32));
    const cek = Buffer.from(
      crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: aes128gcm\0", "ascii"), 16)
    );
    const nonce = Buffer.from(
      crypto.hkdfSync("sha256", ikm, salt, Buffer.from("Content-Encoding: nonce\0", "ascii"), 12)
    );

    const decipher = crypto.createDecipheriv("aes-128-gcm", cek, nonce);
    decipher.setAuthTag(tag);
    const descifrado = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    expect(descifrado[descifrado.length - 1]).toBe(0x02);
    expect(descifrado.subarray(0, descifrado.length - 1).toString("utf8")).toBe(mensajeOriginal);
  });
});
