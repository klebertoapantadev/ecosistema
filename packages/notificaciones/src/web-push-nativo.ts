import crypto from "node:crypto";

export interface ClavesVapidWebPush {
  publicKey: string;
  privateKey: string;
}

export interface SuscripcionWebPushDestino {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface PayloadNotificacionWebPush {
  title: string;
  body: string;
  url: string;
  notId?: string;
  negocio?: string;
  tag?: string;
  icon?: string;
  badge?: string;
  renotify?: boolean;
}

function aBase64Url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function desdeBase64Url(cadena: string): Buffer {
  const normalizada = cadena.replace(/-/g, "+").replace(/_/g, "/");
  const relleno = (4 - (normalizada.length % 4)) % 4;
  return Buffer.from(normalizada + "=".repeat(relleno), "base64");
}

/**
 * Genera un par de claves VAPID ECDSA P-256 en formato Base64URL sin dependencias externas:
 * - `publicKey`: punto sin comprimir de 65 bytes (`0x04 || x || y`) para `PushManager.subscribe`
 * - `privateKey`: escalar `d` de 32 bytes para firmar JWT ES256 (RFC 8292)
 */
export function generarParClavesVapid(): ClavesVapidWebPush {
  const ecdh = crypto.createECDH("prime256v1");
  ecdh.generateKeys();
  let priv = ecdh.getPrivateKey();
  if (priv.length < 32) {
    const pad = Buffer.alloc(32 - priv.length, 0);
    priv = Buffer.concat([pad, priv]);
  }
  return {
    publicKey: aBase64Url(ecdh.getPublicKey()),
    privateKey: aBase64Url(priv),
  };
}

function construirClavePrivadaPemDesdeRaw(
  privateKeyB64Url: string,
  publicKeyB64Url: string
): crypto.KeyObject {
  const pubRaw = desdeBase64Url(publicKeyB64Url);
  if (pubRaw.length !== 65 || pubRaw[0] !== 0x04) {
    throw new Error("Clave pública VAPID inválida (se esperaban 65 bytes P-256).");
  }
  const x = aBase64Url(pubRaw.subarray(1, 33));
  const y = aBase64Url(pubRaw.subarray(33, 65));
  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d: privateKeyB64Url,
    },
    format: "jwk",
  });
}

function crearCabeceraVapidJwt(
  endpoint: string,
  claves: ClavesVapidWebPush,
  subject = "mailto:soporte@tinkay.ec"
): string {
  const parsed = new URL(endpoint);
  const audience = `${parsed.protocol}//${parsed.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const headerB64 = aBase64Url(
    Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" }), "utf8")
  );
  const payloadB64 = aBase64Url(
    Buffer.from(JSON.stringify({ aud: audience, exp, sub: subject }), "utf8")
  );
  const entradaFirma = `${headerB64}.${payloadB64}`;

  const keyObj = construirClavePrivadaPemDesdeRaw(claves.privateKey, claves.publicKey);
  const firmaRaw = crypto.sign("sha256", Buffer.from(entradaFirma, "utf8"), {
    key: keyObj,
    dsaEncoding: "ieee-p1363",
  });

  const jwt = `${entradaFirma}.${aBase64Url(firmaRaw)}`;
  return `vapid t=${jwt}, k=${claves.publicKey}`;
}

/**
 * Cifra el payload UTF-8 según RFC 8291 (`Content-Encoding: aes128gcm`) para Web Push.
 */
export function cifrarPayloadWebPushAes128Gcm(
  textoPlano: Buffer,
  p256dhClienteB64Url: string,
  authClienteB64Url: string
): Buffer {
  const clientPublicKey = desdeBase64Url(p256dhClienteB64Url);
  const authSecret = desdeBase64Url(authClienteB64Url);

  if (clientPublicKey.length !== 65 || clientPublicKey[0] !== 0x04) {
    throw new Error("Clave p256dh del navegador inválida.");
  }
  if (authSecret.length < 16) {
    throw new Error("Secreto auth del navegador inválido.");
  }

  const servidorEcdh = crypto.createECDH("prime256v1");
  servidorEcdh.generateKeys();
  const serverPublicKey = servidorEcdh.getPublicKey();
  const sharedSecret = servidorEcdh.computeSecret(clientPublicKey);

  const salt = crypto.randomBytes(16);

  // IKM = HKDF(salt = auth_secret, ikm = ecdh_secret, info = "WebPush: info\0" || ua_public || as_public, L = 32)
  const keyInfo = Buffer.concat([
    Buffer.from("WebPush: info\0", "ascii"),
    clientPublicKey,
    serverPublicKey,
  ]);
  const ikm = Buffer.from(
    crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32)
  );

  // CEK = HKDF(salt, ikm, "Content-Encoding: aes128gcm\0", 16)
  const cekInfo = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, cekInfo, 16));

  // NONCE = HKDF(salt, ikm, "Content-Encoding: nonce\0", 12)
  const nonceInfo = Buffer.from("Content-Encoding: nonce\0", "ascii");
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, nonceInfo, 12));

  // Delimitador final de registro RFC 8188: 0x02
  const registroPlano = Buffer.concat([textoPlano, Buffer.from([0x02])]);
  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const cifrado = Buffer.concat([cipher.update(registroPlano), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Cabecera RFC 8188: salt (16) || rs (uint32BE = 4096) || idlen (uint8 = 65) || keyid (65)
  const rsBuf = Buffer.alloc(4);
  rsBuf.writeUInt32BE(4096, 0);
  const idLenBuf = Buffer.from([serverPublicKey.length]);

  return Buffer.concat([salt, rsBuf, idLenBuf, serverPublicKey, cifrado, authTag]);
}

/**
 * Envía una notificación Web Push real (Android Chrome, iOS PWA, Windows/macOS)
 * a una suscripción `PushSubscription` del navegador.
 */
export async function enviarNotificacionWebPushNativa(
  suscripcion: SuscripcionWebPushDestino,
  payload: PayloadNotificacionWebPush,
  clavesVapid: ClavesVapidWebPush
): Promise<{ ok: boolean; status: number; suscripcionExpirada?: boolean; error?: string }> {
  try {
    const cuerpoPlano = Buffer.from(JSON.stringify(payload), "utf8");
    const cuerpoCifrado = cifrarPayloadWebPushAes128Gcm(
      cuerpoPlano,
      suscripcion.p256dh,
      suscripcion.auth
    );
    const authorization = crearCabeceraVapidJwt(suscripcion.endpoint, clavesVapid);

    const resp = await fetch(suscripcion.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        "Content-Length": String(cuerpoCifrado.byteLength),
        TTL: "86400",
        Urgency: "high",
      },
      body: new Uint8Array(cuerpoCifrado),
      signal: AbortSignal.timeout(10000),
    });

    if (resp.status >= 200 && resp.status < 300) {
      return { ok: true, status: resp.status };
    }

    return {
      ok: false,
      status: resp.status,
      suscripcionExpirada: resp.status === 404 || resp.status === 410,
      error: `Push service respondió HTTP ${resp.status}`,
    };
  } catch (err) {
    return {
      ok: false,
      status: 0,
      error: err instanceof Error ? err.message : "Error de red enviando Web Push",
    };
  }
}
