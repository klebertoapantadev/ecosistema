// Token compacto firmado en servidor (HMAC-SHA256 + Deflate) para respaldar órdenes
// de tienda y proformas de eventos cuando el usuario compra como invitado (anon)
// y una migración RPC aún está pendiente de aplicarse en el entorno remoto.
// El navegador nunca puede alterar montos, ítems ni tasas de IVA sin invalidar la firma.

import crypto from "node:crypto";
import zlib from "node:zlib";

export interface OrdenFirmadaServidor {
  v: 1;
  id: string;
  neg: string;
  cod: string;
  ori: "PEDIDO_TIENDA" | "PROFORMA_EVENTO";
  est: string;
  vig: number;
  sub: number;
  des: number;
  iva: number;
  fle: number;
  tot: number;
  b0c: number;
  bgc: number;
  iat: string;
  cmp: {
    nom: string;
    ide: string;
    cor: string;
    tel: string;
  };
  ubi: {
    ret: boolean;
    dir: string;
    ref: string;
    zon?: string;
    km?: number;
    map?: string;
  };
  evt?: {
    tip: string;
    fec: string;
    hor?: string;
    inv?: number;
    pal?: string;
    not?: string;
  };
  itm: Array<{
    dsc: string;
    var?: string;
    can: number;
    pun: number;
    imp: string;
    tot: number;
  }>;
}

const PREFIJO_TOKEN = "eco1_";

function obtenerClaveHmacServidor(): string {
  return (
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.ARIA_AGENT_KEY ||
    process.env.NEXTAUTH_SECRET ||
    `eco-hmac-orden-v1:${process.env.NEXT_PUBLIC_SUPABASE_URL || "local"}:${process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "eco"}`
  );
}

export function firmarOrdenRespaldoServidor(orden: OrdenFirmadaServidor): string {
  const json = JSON.stringify(orden);
  const comprimido = zlib.deflateRawSync(Buffer.from(json, "utf8"));
  const cuerpoB64 = comprimido.toString("base64url");
  const firma = crypto
    .createHmac("sha256", obtenerClaveHmacServidor())
    .update(cuerpoB64)
    .digest("base64url")
    .slice(0, 32);
  return `${PREFIJO_TOKEN}${cuerpoB64}.${firma}`;
}

export function verificarOrdenRespaldoServidor(token: string): OrdenFirmadaServidor | null {
  if (!token || !token.startsWith(PREFIJO_TOKEN)) return null;
  const sinPrefijo = token.slice(PREFIJO_TOKEN.length);
  const idxPunto = sinPrefijo.lastIndexOf(".");
  if (idxPunto <= 0) return null;

  const cuerpoB64 = sinPrefijo.slice(0, idxPunto);
  const firmaRecibida = sinPrefijo.slice(idxPunto + 1);
  const firmaEsperada = crypto
    .createHmac("sha256", obtenerClaveHmacServidor())
    .update(cuerpoB64)
    .digest("base64url")
    .slice(0, 32);

  const bufA = Buffer.from(firmaRecibida);
  const bufB = Buffer.from(firmaEsperada);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }

  try {
    const descomprimido = zlib.inflateRawSync(Buffer.from(cuerpoB64, "base64url"));
    const parsed = JSON.parse(descomprimido.toString("utf8")) as OrdenFirmadaServidor;
    if (parsed?.v !== 1 || !parsed.id || !parsed.tot) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function generarTokenEdicionTarjetaServidor(tokenVista: string): string {
  const base = (tokenVista || "").trim().split("_")[0] || "";
  if (!base) return "";
  const firma = crypto
    .createHmac("sha256", obtenerClaveHmacServidor())
    .update(`tarjeta-edicion-v1:${base}`)
    .digest("hex")
    .slice(0, 14);
  return `${base}_${firma}`;
}

export function verificarTokenEdicionTarjetaServidor(tokenEdicion: string): string | null {
  const limpio = (tokenEdicion || "").trim();
  const idx = limpio.lastIndexOf("_");
  if (idx <= 0) return null;
  const base = limpio.slice(0, idx);
  const firmaRecibida = limpio.slice(idx + 1);
  if (!base || firmaRecibida.length !== 14) return null;

  const firmaEsperada = crypto
    .createHmac("sha256", obtenerClaveHmacServidor())
    .update(`tarjeta-edicion-v1:${base}`)
    .digest("hex")
    .slice(0, 14);

  const bufA = Buffer.from(firmaRecibida);
  const bufB = Buffer.from(firmaEsperada);
  if (bufA.length !== bufB.length || !crypto.timingSafeEqual(bufA, bufB)) {
    return null;
  }
  return base;
}
