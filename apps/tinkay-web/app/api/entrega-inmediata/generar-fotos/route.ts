import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { obtenerContextoAccesoTinkay } from "@/app/panel/acceso-tinkay";
import {
  construirPromptCompletoEstudioIa,
  obtenerReferenciasParaModo,
  type ModoEstudioIa,
  type OpcionesEstudioIa,
} from "@/modulos/estudio-ia/prompts-tinkay";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

const MAX_BYTES_FOTO = 6 * 1024 * 1024;
const MIME_PERMITIDOS = new Set(["image/jpeg", "image/png", "image/webp"]);
const MODELO_POR_DEFECTO = "gemini-2.5-flash-image";
const MAX_INTENTOS_POR_MODO = 2;
const ESPERA_REINTENTO_MS = 1500;

const EsquemaSolicitud = z.object({
  fotoUrl: z.string().url(),
  modos: z.array(z.enum(["estudio", "taller"])).min(1).max(2).default(["estudio", "taller"]),
  opciones: z
    .object({
      tipoSoporte: z.enum(["mesa", "piso", "pedestal"]).default("mesa"),
      coreano: z.boolean().default(false),
      geometria: z.enum(["auto", "con_frente", "recto"]).default("auto"),
      incluirTarjeta: z.boolean().default(true),
    })
    .default({
      tipoSoporte: "mesa",
      coreano: false,
      geometria: "auto",
      incluirTarjeta: true,
    }),
});

type ParteGemini =
  | { text: string }
  | { inlineData: { mimeType: string; data: string } };

interface RespuestaGemini {
  candidates?: Array<{
    content?: {
      parts?: Array<{
        text?: string;
        inlineData?: {
          mimeType?: string;
          data?: string;
        };
      }>;
    };
    finishReason?: string;
  }>;
  error?: {
    code?: number;
    message?: string;
    status?: string;
  };
}

// Caché en memoria a nivel de módulo para las 5 imágenes de referencia oficial
const cacheReferenciasBase64 = new Map<string, string>();

const esperar = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

function validarUrlFotoPermitida(rawUrl: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password || parsed.port) return null;

  const host = parsed.hostname.toLowerCase();
  const supabaseEnv = process.env.NEXT_PUBLIC_SUPABASE_URL;
  let hostSupabasePermitido: string | null = null;
  if (supabaseEnv) {
    try {
      hostSupabasePermitido = new URL(supabaseEnv).hostname.toLowerCase();
    } catch {
      hostSupabasePermitido = null;
    }
  }

  const coincideHost = Boolean(hostSupabasePermitido && host === hostSupabasePermitido);
  const esSubdominioSupabase = host.endsWith(".supabase.co") && host.length > ".supabase.co".length;

  if (!coincideHost && !esSubdominioSupabase) {
    return null;
  }

  return parsed;
}

async function descargarFotoProducto(
  urlValidada: URL
): Promise<{ mimeType: string; base64: string }> {
  const res = await fetch(urlValidada.toString(), {
    method: "GET",
    redirect: "error",
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`No se pudo descargar la foto base (HTTP ${res.status})`);
  }

  const contentTypeRaw = (res.headers.get("content-type") || "").split(";")[0]?.trim().toLowerCase() || "";
  const mimeType =
    contentTypeRaw === "image/jpg"
      ? "image/jpeg"
      : MIME_PERMITIDOS.has(contentTypeRaw)
        ? contentTypeRaw
        : "";

  if (!mimeType) {
    throw new Error("El archivo de foto base no corresponde a una imagen válida (JPEG, PNG o WebP)");
  }

  const contentLengthHeader = Number(res.headers.get("content-length") || "0");
  if (Number.isFinite(contentLengthHeader) && contentLengthHeader > MAX_BYTES_FOTO) {
    throw new Error("La foto base supera el límite permitido de 6 MB");
  }

  const arrayBuffer = await res.arrayBuffer();
  if (arrayBuffer.byteLength === 0) {
    throw new Error("La foto base descargada está vacía");
  }
  if (arrayBuffer.byteLength > MAX_BYTES_FOTO) {
    throw new Error("La foto base supera el límite permitido de 6 MB");
  }

  return {
    mimeType,
    base64: Buffer.from(arrayBuffer).toString("base64"),
  };
}

async function leerReferenciaBase64(archivo: string): Promise<string> {
  const enCache = cacheReferenciasBase64.get(archivo);
  if (enCache) return enCache;

  const rutasCandidatas = [
    path.join(process.cwd(), "public", "img", "referencias-ia", archivo),
    path.join(process.cwd(), "apps", "tinkay-web", "public", "img", "referencias-ia", archivo),
  ];

  let ultimoError: unknown = null;
  for (const ruta of rutasCandidatas) {
    try {
      const buf = await fs.readFile(ruta);
      const b64 = buf.toString("base64");
      cacheReferenciasBase64.set(archivo, b64);
      return b64;
    } catch (err) {
      ultimoError = err;
    }
  }

  throw new Error(
    `No se encontró la imagen de referencia oficial "${archivo}" (${ultimoError instanceof Error ? ultimoError.message : "archivo ausente"})`
  );
}

async function generarImagenModoGemini(params: {
  modo: ModoEstudioIa;
  opciones: OpcionesEstudioIa;
  fotoBase: { mimeType: string; base64: string };
  apiKey: string;
  modelo: string;
}): Promise<{ dataUrl: string; mimeType: string }> {
  const { modo, opciones, fotoBase, apiKey, modelo } = params;

  const promptCompleto = construirPromptCompletoEstudioIa(modo, opciones);
  const referencias = obtenerReferenciasParaModo(modo, opciones);

  const parts: ParteGemini[] = [
    { text: promptCompleto },
    { text: "FOTO DEL PRODUCTO:" },
    {
      inlineData: {
        mimeType: fotoBase.mimeType,
        data: fotoBase.base64,
      },
    },
  ];

  for (const ref of referencias) {
    const b64Ref = await leerReferenciaBase64(ref.archivo);
    parts.push(
      { text: `REFERENCIA ${ref.etiquetaPrompt}:` },
      {
        inlineData: {
          mimeType: "image/jpeg",
          data: b64Ref,
        },
      }
    );
  }

  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(modelo)}:generateContent`;
  let ultimoMotivo = "Gemini no devolvió una imagen válida";

  for (let intento = 1; intento <= MAX_INTENTOS_POR_MODO; intento++) {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-goog-api-key": apiKey,
        },
        body: JSON.stringify({
          contents: [{ role: "user", parts }],
          generationConfig: {
            responseModalities: ["IMAGE"],
            imageConfig: { aspectRatio: "3:4" },
          },
        }),
      });

      const data = (await res.json().catch(() => ({}))) as RespuestaGemini;

      if (!res.ok) {
        ultimoMotivo =
          data.error?.message || `Error de Gemini (HTTP ${res.status})`;
        const esTransitorio = res.status === 429 || res.status === 503 || res.status >= 500;
        if (esTransitorio && intento < MAX_INTENTOS_POR_MODO) {
          await esperar(ESPERA_REINTENTO_MS);
          continue;
        }
        throw new Error(ultimoMotivo);
      }

      const parteImagen = data.candidates?.[0]?.content?.parts?.find(
        (p) => Boolean(p.inlineData?.data)
      );

      if (parteImagen?.inlineData?.data) {
        const mimeSalida = parteImagen.inlineData.mimeType || "image/jpeg";
        return {
          mimeType: mimeSalida,
          dataUrl: `data:${mimeSalida};base64,${parteImagen.inlineData.data}`,
        };
      }

      const finishReason = data.candidates?.[0]?.finishReason;
      ultimoMotivo = finishReason
        ? `Gemini finalizó sin imagen (${finishReason})`
        : "Gemini respondió sin datos de imagen";

      if (intento < MAX_INTENTOS_POR_MODO) {
        await esperar(ESPERA_REINTENTO_MS);
      }
    } catch (err) {
      ultimoMotivo = err instanceof Error ? err.message : "Error de conexión con Gemini";
      if (intento < MAX_INTENTOS_POR_MODO) {
        await esperar(ESPERA_REINTENTO_MS);
      } else {
        throw new Error(ultimoMotivo);
      }
    }
  }

  throw new Error(ultimoMotivo);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await obtenerContextoAccesoTinkay();
    if (!ctx.perfil || !ctx.clavesAutorizadas.has("galeria_inmediata")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const apiKey = process.env.GEMINI_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, error: "Falta configurar GEMINI_API_KEY en el servidor" },
        { status: 503 }
      );
    }

    let bodyJson: unknown;
    try {
      bodyJson = await request.json();
    } catch {
      return NextResponse.json(
        { ok: false, error: "Cuerpo JSON inválido en la solicitud" },
        { status: 400 }
      );
    }

    const validacion = EsquemaSolicitud.safeParse(bodyJson);
    if (!validacion.success) {
      return NextResponse.json(
        {
          ok: false,
          error: "Parámetros inválidos para generación de fotos IA",
          detalles: validacion.error.flatten().fieldErrors,
        },
        { status: 400 }
      );
    }

    const { fotoUrl, modos, opciones } = validacion.data;
    const urlPermitida = validarUrlFotoPermitida(fotoUrl);
    if (!urlPermitida) {
      return NextResponse.json(
        {
          ok: false,
          error: "La URL de la foto debe pertenecer al almacenamiento oficial HTTPS de Supabase",
        },
        { status: 400 }
      );
    }

    let fotoBase: { mimeType: string; base64: string };
    try {
      fotoBase = await descargarFotoProducto(urlPermitida);
    } catch (err) {
      return NextResponse.json(
        {
          ok: false,
          error: err instanceof Error ? err.message : "No se pudo leer la foto base",
        },
        { status: 400 }
      );
    }

    const modelo = process.env.GEMINI_IMAGE_MODEL?.trim() || MODELO_POR_DEFECTO;
    const modosUnicos = Array.from(new Set(modos));

    const ejecuciones = await Promise.all(
      modosUnicos.map(async (modo) => {
        try {
          const resultado = await generarImagenModoGemini({
            modo,
            opciones,
            fotoBase,
            apiKey,
            modelo,
          });
          return { modo, ok: true as const, resultado };
        } catch (err) {
          return {
            modo,
            ok: false as const,
            error: err instanceof Error ? err.message : `No se pudo generar el modo ${modo}`,
          };
        }
      })
    );

    const resultados: Partial<Record<ModoEstudioIa, { dataUrl: string; mimeType: string }>> = {};
    const errores: Partial<Record<ModoEstudioIa, string>> = {};

    for (const item of ejecuciones) {
      if (item.ok) {
        resultados[item.modo] = item.resultado;
      } else {
        errores[item.modo] = item.error;
      }
    }

    const cantidadExitos = Object.keys(resultados).length;
    const cantidadErrores = Object.keys(errores).length;

    if (cantidadExitos === 0) {
      const primerError =
        errores.estudio || errores.taller || "No se pudieron generar las fotografías con IA";
      return NextResponse.json(
        {
          ok: false,
          error: primerError,
          resultados: {},
          errores,
        },
        { status: 502 }
      );
    }

    return NextResponse.json({
      ok: true,
      resultados,
      ...(cantidadErrores > 0 ? { errores } : {}),
    });
  } catch (err) {
    console.error("[generar-fotos] Error inesperado:", err);
    return NextResponse.json(
      {
        ok: false,
        error: err instanceof Error ? err.message : "Error interno generando fotos IA",
      },
      { status: 500 }
    );
  }
}
