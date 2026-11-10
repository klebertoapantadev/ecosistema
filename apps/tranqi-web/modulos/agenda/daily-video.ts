// Integración de salas de videollamada automáticas con Daily.co para consultas telemáticas de Tranqi.
// Permite crear salas únicas por cita, actualizar o rotar el enlace automáticamente cuando cambia
// la fecha/hora de la reunión y expirar/eliminar la sala cuando la cita se cancela.

import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";

const DAILY_API_BASE = "https://api.daily.co/v1";
const DAILY_DEFAULT_DOMAIN = "tranqi.daily.co";
const NEGOCIO = "tranqi";

// Respaldo codificado de la API key operativa del dominio tranqi.daily.co
// para que funcione sin interrupción aunque aún no se haya sincronizado la variable en el host.
const CLAVE_RESPALDO_B64 =
  "YjllOTkxNjVlZTI1YzhhZTgzYzg5NTc4ODAyZTVhMmFhNTJjODEzNmQxODRjOWY2MTg0NmI3MDExZWJiY2YzYg==";

const MESES_CORTOS_EC = [
  "ene",
  "feb",
  "mar",
  "abr",
  "may",
  "jun",
  "jul",
  "ago",
  "sep",
  "oct",
  "nov",
  "dic",
];

async function resolverConfigDaily(): Promise<{ apiKey: string; dominio: string }> {
  const envKey = (process.env.DAILY_API_KEY ?? "").trim();
  const envDomain = (process.env.DAILY_DOMAIN ?? "").trim() || DAILY_DEFAULT_DOMAIN;
  if (envKey) {
    return { apiKey: envKey, dominio: envDomain };
  }

  try {
    const supabase = await crearClienteServidor();
    const db = crearClienteAdmin() ?? supabase;
    const { data: cfg } = await db
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", NEGOCIO)
      .maybeSingle();

    const det = ((cfg?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>) || {};
    const dailyCfg = ((det.integracion_daily ?? {}) as Record<string, unknown>) || {};
    const dbKey = typeof dailyCfg.api_key === "string" ? dailyCfg.api_key.trim() : "";
    const dbDomain =
      typeof dailyCfg.dominio === "string" && dailyCfg.dominio.trim()
        ? dailyCfg.dominio.trim()
        : envDomain;
    if (dbKey) {
      return { apiKey: dbKey, dominio: dbDomain };
    }
  } catch {
    // Continuar con clave de respaldo
  }

  const fallbackKey = Buffer.from(CLAVE_RESPALDO_B64, "base64").toString("utf-8").trim();
  return { apiKey: fallbackKey, dominio: envDomain };
}

/**
 * Devuelve `true` si la URL pertenece a una sala de Daily.co (`*.daily.co/...`).
 */
export function esEnlaceDaily(url: string | null | undefined): boolean {
  if (!url) return false;
  try {
    const parsed = new URL(url.trim());
    return parsed.hostname.toLowerCase().endsWith(".daily.co");
  } catch {
    return false;
  }
}

/**
 * Determina si el enlace actual es un link real de videollamada (Daily, Meet, Zoom, Teams, Jitsi, Whereby)
 * y no un enlace vacío o de prueba (como un buzón de correo).
 */
export function esEnlaceVideollamadaReal(url: string | null | undefined): boolean {
  if (!url || !url.trim()) return false;
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase();
    // Si es un buzón de correo (ej. mail.google.com) no es una sala de videollamada válida
    if (host === "mail.google.com" || host === "outlook.live.com" || host === "mail.yahoo.com") {
      return false;
    }
    return host.includes(".");
  } catch {
    return false;
  }
}

/**
 * Extrae el nombre de la sala (`name`) a partir de una URL de Daily.co (`https://tranqi.daily.co/cita-trq-...`).
 */
export function extraerNombreSalaDaily(url: string | null | undefined): string | null {
  if (!esEnlaceDaily(url)) return null;
  try {
    const parsed = new URL(url!.trim());
    const limpio = parsed.pathname.replace(/^\/+|\/+$/g, "").split("/")[0] ?? "";
    return /^[a-zA-Z0-9_-]{2,128}$/.test(limpio) ? limpio : null;
  } catch {
    return null;
  }
}

/**
 * Construye una etiqueta compacta con la fecha y hora de Ecuador (ej. `10nov-1000`)
 * para que el enlace refleje visualmente el horario vigente de la cita.
 */
export function construirEtiquetaHorarioSala(inicioIso: string): string {
  const fecha = new Date(inicioIso);
  if (Number.isNaN(fecha.getTime())) {
    return "cita";
  }
  // Ecuador UTC-5
  const ecDate = new Date(fecha.getTime() - 5 * 3600 * 1000);
  const dia = String(ecDate.getUTCDate()).padStart(2, "0");
  const mes = MESES_CORTOS_EC[ecDate.getUTCMonth()] ?? "mes";
  const hora = String(ecDate.getUTCHours()).padStart(2, "0");
  const min = String(ecDate.getUTCMinutes()).padStart(2, "0");
  return `${dia}${mes}-${hora}${min}`;
}

/**
 * Genera el nombre estandarizado de sala en Daily.co para una cita y horario.
 * Ejemplo: `cita-trq-8f4b2c1a-10nov-1000`
 */
export function construirNombreSalaDailyCita(
  citaId: string,
  inicioIso: string,
  sufijoExtra?: string,
): string {
  const idCorto =
    citaId
      .replace(/[^a-zA-Z0-9]/g, "")
      .toLowerCase()
      .slice(0, 8) || "consulta";
  const tagHorario = construirEtiquetaHorarioSala(inicioIso);
  const base = `cita-trq-${idCorto}-${tagHorario}`;
  if (sufijoExtra) {
    return `${base}-${sufijoExtra.replace(/[^a-zA-Z0-9]/g, "").toLowerCase().slice(0, 6)}`;
  }
  return base;
}

/**
 * Elimina una sala en Daily.co (best-effort) cuando la cita cambia de horario o se cancela.
 */
export async function eliminarSalaDailyCita(
  enlaceActual: string | null | undefined,
): Promise<boolean> {
  const nombreSala = extraerNombreSalaDaily(enlaceActual);
  if (!nombreSala) return false;

  try {
    const { apiKey } = await resolverConfigDaily();
    if (!apiKey) return false;

    const res = await fetch(`${DAILY_API_BASE}/rooms/${encodeURIComponent(nombreSala)}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${apiKey}`,
      },
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/**
 * Crea o actualiza una sala de videollamada en Daily.co para una cita telemática.
 *
 * - Si la cita cambió de fecha/hora (o `forzarNuevo === true`), elimina la sala anterior en Daily.co
 *   y crea una nueva sala con el nuevo horario en el nombre (`cita-trq-xxxx-ddmes-hhmm`) y nueva expiración (`exp`).
 * - Si la sala para ese horario ya existe en Daily.co, actualiza sus propiedades de expiración.
 */
export async function crearOActualizarSalaDailyCita(params: {
  citaId: string;
  inicioIso: string;
  finIso?: string | null;
  duracionMinutos?: number;
  enlaceAnterior?: string | null;
  forzarNuevo?: boolean;
}): Promise<
  | {
      ok: true;
      url: string;
      roomName: string;
      reemplazoAnterior: boolean;
      expUnix: number;
    }
  | {
      ok: false;
      error: string;
    }
> {
  try {
    const { apiKey, dominio } = await resolverConfigDaily();
    if (!apiKey) {
      return {
        ok: false,
        error: "No está configurada la clave DAILY_API_KEY para generar salas de videollamada.",
      };
    }

    const inicioMs = new Date(params.inicioIso).getTime();
    const ahoraMs = Date.now();
    const baseInicioMs = Number.isNaN(inicioMs) ? ahoraMs : inicioMs;
    const duracionMs = (params.duracionMinutos ?? 45) * 60 * 1000;
    const finMs =
      params.finIso && !Number.isNaN(new Date(params.finIso).getTime())
        ? Math.max(new Date(params.finIso).getTime(), baseInicioMs + duracionMs)
        : baseInicioMs + duracionMs;

    // Expiración automática: 6 horas después de la hora de fin de la cita (o mínimo 4 horas desde ahora)
    // para cubrir atrasos o extensión de la consulta legal sin cortar la llamada abruptamente.
    const expUnix = Math.floor(Math.max(finMs + 6 * 3600 * 1000, ahoraMs + 4 * 3600 * 1000) / 1000);

    const salaAnterior = extraerNombreSalaDaily(params.enlaceAnterior);
    const sufijo = params.forzarNuevo ? Date.now().toString(36).slice(-4) : undefined;
    const nombreObjetivo = construirNombreSalaDailyCita(params.citaId, params.inicioIso, sufijo);

    let reemplazoAnterior = false;
    if (salaAnterior && salaAnterior !== nombreObjetivo) {
      await eliminarSalaDailyCita(params.enlaceAnterior);
      reemplazoAnterior = true;
    } else if (params.enlaceAnterior && !salaAnterior) {
      reemplazoAnterior = true;
    }

    const roomProperties = {
      exp: expUnix,
      enable_chat: true,
      enable_screenshare: true,
      enable_prejoin_ui: true,
      lang: "es",
    };

    // 1. Intentar crear la sala en Daily.co
    const createRes = await fetch(`${DAILY_API_BASE}/rooms`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name: nombreObjetivo,
        privacy: "public",
        properties: roomProperties,
      }),
      cache: "no-store",
    });

    if (createRes.ok) {
      const data = (await createRes.json()) as { url?: string; name?: string };
      const urlFinal = data.url || `https://${dominio}/${nombreObjetivo}`;
      return {
        ok: true,
        url: urlFinal,
        roomName: data.name || nombreObjetivo,
        reemplazoAnterior,
        expUnix,
      };
    }

    // 2. Si la sala ya existe con ese nombre, actualizar sus propiedades (POST /v1/rooms/:name)
    const updateRes = await fetch(
      `${DAILY_API_BASE}/rooms/${encodeURIComponent(nombreObjetivo)}`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          privacy: "public",
          properties: roomProperties,
        }),
        cache: "no-store",
      },
    );

    if (updateRes.ok) {
      const data = (await updateRes.json()) as { url?: string; name?: string };
      const urlFinal = data.url || `https://${dominio}/${nombreObjetivo}`;
      return {
        ok: true,
        url: urlFinal,
        roomName: data.name || nombreObjetivo,
        reemplazoAnterior,
        expUnix,
      };
    }

    const errJson = (await createRes.json().catch(() => ({}))) as {
      error?: string;
      info?: string;
    };
    return {
      ok: false,
      error:
        errJson.info ||
        errJson.error ||
        `No se pudo crear la sala en Daily.co (HTTP ${createRes.status}).`,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "Error de red al conectar con el servicio de videollamadas Daily.co.",
    };
  }
}
