import crypto from "node:crypto";
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

// Claves VAPID P-256 preconfiguradas para el ecosistema (sobreescribibles por variables de entorno en Vercel)
const DEFAULT_VAPID_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
  "BLb52FeQPf4BMi1-vEz3rVOShWKjLnFHjCUoDnMLGkCLMl7Ta0b6cdfNDoHjt2Qs7K-LJVSOmDVAZPHUcFH3hWA";

const DEFAULT_VAPID_PRIVATE_KEY =
  process.env.VAPID_PRIVATE_KEY ||
  "DNKcLeiMJyDg7avpnhbfMW-KYXiZbNoKqI1BB7UWH_0";

const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:notificaciones@tranqi24.com";

export interface SuscripcionWebPush {
  endpoint: string;
  keys: {
    p256dh: string;
    auth: string;
  };
  userAgent?: string;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface PayloadWebPush {
  title: string;
  body: string;
  url?: string;
  icon?: string;
  badge?: string;
  tag?: string;
  id?: string;
}

// Almacén en memoria de respaldo por usuarioId
const memoriaSuscripciones = new Map<string, SuscripcionWebPush[]>();

export function obtenerClavePublicaVapid(): string {
  return DEFAULT_VAPID_PUBLIC_KEY;
}

function crearObjetoClavePrivadaVapid(publicKeyB64: string, privateKeyB64: string): crypto.KeyObject {
  const pubBuf = Buffer.from(publicKeyB64, "base64url");
  // pubBuf es punto no comprimido (65 bytes: 0x04 || X(32) || Y(32))
  const x = pubBuf.subarray(1, 33).toString("base64url");
  const y = pubBuf.subarray(33, 65).toString("base64url");
  const d = Buffer.from(privateKeyB64, "base64url").toString("base64url");

  return crypto.createPrivateKey({
    key: {
      kty: "EC",
      crv: "P-256",
      x,
      y,
      d,
    },
    format: "jwk",
  });
}

function firmarTokenVapid(endpoint: string): string {
  const url = new URL(endpoint);
  const audience = `${url.protocol}//${url.host}`;
  const exp = Math.floor(Date.now() / 1000) + 12 * 3600;

  const headerB64 = Buffer.from(JSON.stringify({ typ: "JWT", alg: "ES256" })).toString("base64url");
  const payloadB64 = Buffer.from(
    JSON.stringify({
      aud: audience,
      exp,
      sub: VAPID_SUBJECT,
    })
  ).toString("base64url");

  const unsigned = `${headerB64}.${payloadB64}`;
  const privKey = crearObjetoClavePrivadaVapid(DEFAULT_VAPID_PUBLIC_KEY, DEFAULT_VAPID_PRIVATE_KEY);
  const signature = crypto
    .sign("sha256", Buffer.from(unsigned), {
      key: privKey,
      dsaEncoding: "ieee-p1363",
    })
    .toString("base64url");

  return `vapid t=${unsigned}.${signature}, k=${DEFAULT_VAPID_PUBLIC_KEY}`;
}

/**
 * Cifra el payload según RFC 8291 (Content-Encoding: aes128gcm)
 */
function cifrarPayloadAes128Gcm(
  payloadStr: string,
  p256dhB64: string,
  authB64: string
): Buffer {
  const uaPub = Buffer.from(p256dhB64, "base64url");
  const authSecret = Buffer.from(authB64, "base64url");

  const localEcdh = crypto.createECDH("prime256v1");
  localEcdh.generateKeys();
  const serverPub = localEcdh.getPublicKey(); // 65 bytes uncompressed
  const sharedSecret = localEcdh.computeSecret(uaPub);

  const salt = crypto.randomBytes(16);

  const keyInfo = Buffer.concat([Buffer.from("WebPush: info\0", "ascii"), uaPub, serverPub]);
  const ikm = Buffer.from(crypto.hkdfSync("sha256", sharedSecret, authSecret, keyInfo, 32));

  const cekInfo = Buffer.from("Content-Encoding: aes128gcm\0", "ascii");
  const cek = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, cekInfo, 16));

  const nonceInfo = Buffer.from("Content-Encoding: nonce\0", "ascii");
  const nonce = Buffer.from(crypto.hkdfSync("sha256", ikm, salt, nonceInfo, 12));

  // Delimitador de registro final RFC 8291 = 0x02
  const plainBuf = Buffer.concat([Buffer.from(payloadStr, "utf8"), Buffer.from([2])]);

  const cipher = crypto.createCipheriv("aes-128-gcm", cek, nonce);
  const encrypted = Buffer.concat([cipher.update(plainBuf), cipher.final(), cipher.getAuthTag()]);

  // Cabecera aes128gcm: salt(16) + rs(4) + idlen(1) + keyid(65)
  const header = Buffer.alloc(21 + serverPub.length);
  salt.copy(header, 0);
  header.writeUInt32BE(4096, 16);
  header.writeUInt8(serverPub.length, 20);
  serverPub.copy(header, 21);

  return Buffer.concat([header, encrypted]);
}

/**
 * Envía una notificación Web Push cifrada a una suscripción específica
 */
export async function despacharPushASuscripcion(
  suscripcion: SuscripcionWebPush,
  payload: PayloadWebPush
): Promise<{ ok: boolean; status?: number; expirada?: boolean; error?: string }> {
  try {
    const jsonStr = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/panel",
      icon: payload.icon || "/icons/icon-192.png",
      badge: payload.badge || "/icons/icon-192.png",
      tag: payload.tag || `tranqi-${Date.now()}`,
      id: payload.id || "",
    });

    const bodyCifrado = cifrarPayloadAes128Gcm(
      jsonStr,
      suscripcion.keys.p256dh,
      suscripcion.keys.auth
    );
    const authorization = firmarTokenVapid(suscripcion.endpoint);

    const res = await fetch(suscripcion.endpoint, {
      method: "POST",
      headers: {
        Authorization: authorization,
        "Content-Type": "application/octet-stream",
        "Content-Encoding": "aes128gcm",
        TTL: "86400",
        Urgency: "high",
      },
      body: new Uint8Array(bodyCifrado),
    });

    if (res.status === 404 || res.status === 410) {
      return { ok: false, status: res.status, expirada: true, error: "Suscripción expirada" };
    }
    if (!res.ok) {
      const txt = await res.text().catch(() => "");
      return { ok: false, status: res.status, error: txt || `HTTP ${res.status}` };
    }
    return { ok: true, status: res.status };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando Web Push",
    };
  }
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function obtenerClienteSupabase(): Promise<any> {
  try {
    const admin = crearClienteAdmin();
    if (admin) return admin;
  } catch {}
  try {
    return await crearClienteServidor();
  } catch {}
  return null;
}

export async function obtenerSuscripcionesPushUsuario(
  usuarioId: string
): Promise<SuscripcionWebPush[]> {
  const mem = memoriaSuscripciones.get(usuarioId) || [];
  const client = await obtenerClienteSupabase();
  if (!client) return mem;

  try {
    const { data } = await client
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", usuarioId)
      .maybeSingle();

    const detalle = (data?.usu_detalle_usuario || {}) as Record<string, unknown>;
    const guardadas = Array.isArray(detalle.push_subscriptions)
      ? (detalle.push_subscriptions as SuscripcionWebPush[])
      : [];

    // Unificar con memoria por endpoint
    const mapa = new Map<string, SuscripcionWebPush>();
    for (const s of [...guardadas, ...mem]) {
      if (s?.endpoint && s?.keys?.p256dh && s?.keys?.auth) {
        mapa.set(s.endpoint, s);
      }
    }
    const lista = Array.from(mapa.values());
    memoriaSuscripciones.set(usuarioId, lista);
    return lista;
  } catch {
    return mem;
  }
}

export async function guardarSuscripcionPushUsuario(
  usuarioId: string,
  nueva: SuscripcionWebPush
): Promise<SuscripcionWebPush[]> {
  const actuales = await obtenerSuscripcionesPushUsuario(usuarioId);
  const ahora = new Date().toISOString();
  const mapa = new Map<string, SuscripcionWebPush>();
  for (const s of actuales) {
    if (s?.endpoint) mapa.set(s.endpoint, s);
  }
  mapa.set(nueva.endpoint, {
    ...nueva,
    creadoEn: mapa.get(nueva.endpoint)?.creadoEn || ahora,
    actualizadoEn: ahora,
  });

  const lista = Array.from(mapa.values()).slice(-10); // Máximo 10 dispositivos por usuario
  memoriaSuscripciones.set(usuarioId, lista);

  const client = await obtenerClienteSupabase();
  if (client) {
    try {
      const { data } = await client
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", usuarioId)
        .maybeSingle();

      const detalleActual = (data?.usu_detalle_usuario || {}) as Record<string, unknown>;
      await client
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detalleActual,
            push_subscriptions: lista,
          },
        })
        .eq("usu_id", usuarioId);
    } catch {
      /* Respaldo en memoria activo */
    }
  }

  return lista;
}

export async function eliminarSuscripcionPushUsuario(
  usuarioId: string,
  endpoint: string
): Promise<SuscripcionWebPush[]> {
  const actuales = await obtenerSuscripcionesPushUsuario(usuarioId);
  const filtradas = actuales.filter((s) => s.endpoint !== endpoint);
  memoriaSuscripciones.set(usuarioId, filtradas);

  const client = await obtenerClienteSupabase();
  if (client) {
    try {
      const { data } = await client
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_detalle_usuario")
        .eq("usu_id", usuarioId)
        .maybeSingle();

      const detalleActual = (data?.usu_detalle_usuario || {}) as Record<string, unknown>;
      await client
        .schema("comun_seguridad")
        .from("seg_usuario")
        .update({
          usu_detalle_usuario: {
            ...detalleActual,
            push_subscriptions: filtradas,
          },
        })
        .eq("usu_id", usuarioId);
    } catch {}
  }

  return filtradas;
}

/**
 * Envía una notificación Web Push a todos los dispositivos registrados de un usuario
 */
export async function enviarWebPushAUsuario(
  usuarioId: string,
  payload: PayloadWebPush
): Promise<{ enviados: number; fallidos: number }> {
  const suscripciones = await obtenerSuscripcionesPushUsuario(usuarioId);
  if (suscripciones.length === 0) return { enviados: 0, fallidos: 0 };

  let enviados = 0;
  let fallidos = 0;
  const endpointsExpirados: string[] = [];

  for (const sub of suscripciones) {
    const res = await despacharPushASuscripcion(sub, payload);
    if (res.ok) {
      enviados++;
    } else {
      fallidos++;
      if (res.expirada) {
        endpointsExpirados.push(sub.endpoint);
      }
    }
  }

  for (const ep of endpointsExpirados) {
    await eliminarSuscripcionPushUsuario(usuarioId, ep).catch(() => {});
  }

  return { enviados, fallidos };
}

/**
 * Envía notificaciones Web Push en paralelo a múltiples usuarios
 */
export async function enviarWebPushAUsuarios(
  usuarioIds: string[],
  payloadPorUsuario: (usuarioId: string) => PayloadWebPush
): Promise<{ totalEnviados: number; totalFallidos: number }> {
  let totalEnviados = 0;
  let totalFallidos = 0;

  await Promise.all(
    usuarioIds.map(async (uid) => {
      const r = await enviarWebPushAUsuario(uid, payloadPorUsuario(uid));
      totalEnviados += r.enviados;
      totalFallidos += r.fallidos;
    })
  );

  return { totalEnviados, totalFallidos };
}
