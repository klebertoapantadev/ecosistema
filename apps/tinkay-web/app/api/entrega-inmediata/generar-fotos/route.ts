import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { crearClienteServidor } from "@eco/supabase/servidor";
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
const MODELO_GEMINI_POR_DEFECTO = "gemini-2.5-flash-image";
const MODELO_OPENROUTER_POR_DEFECTO = "google/gemini-2.5-flash-image";
const OPENROUTER_CHAT_URL = "https://openrouter.ai/api/v1/chat/completions";
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

type ParteOpenRouter =
  | { type: "text"; text: string }
  | { type: "image_url"; image_url: { url: string } };

interface ImagenOpenRouter {
  type?: string;
  url?: string;
  b64_json?: string;
  image_url?: {
    url?: string;
  };
}

interface RespuestaOpenRouter {
  choices?: Array<{
    finish_reason?: string;
    message?: {
      content?:
        | string
        | Array<{
            type?: string;
            text?: string;
            data?: string;
            mime_type?: string;
            image_url?: { url?: string };
          }>;
      images?: ImagenOpenRouter[];
    };
  }>;
  error?: {
    code?: number | string;
    message?: string;
  };
}

function extraerMimeDesdeDataUrl(dataUrl: string): string {
  const match = dataUrl.match(/^data:(image\/[a-z0-9.+-]+);base64,/i);
  return match?.[1]?.toLowerCase() || "image/png";
}

function extraerImagenDeRespuestaOpenRouter(
  data: RespuestaOpenRouter
): { dataUrl: string; mimeType: string } | null {
  const msg = data.choices?.[0]?.message;
  if (!msg) return null;

  // 1. Formato oficial OpenRouter: choices[0].message.images[]
  if (Array.isArray(msg.images)) {
    for (const img of msg.images) {
      const url = img.image_url?.url || img.url;
      if (typeof url === "string" && url.startsWith("data:image/")) {
        return { dataUrl: url, mimeType: extraerMimeDesdeDataUrl(url) };
      }
      if (typeof img.b64_json === "string" && img.b64_json.length > 0) {
        return {
          dataUrl: `data:image/png;base64,${img.b64_json}`,
          mimeType: "image/png",
        };
      }
    }
  }

  // 2. Respaldo: choices[0].message.content como arreglo multimodal
  if (Array.isArray(msg.content)) {
    for (const parte of msg.content) {
      const url = parte.image_url?.url;
      if (typeof url === "string" && url.startsWith("data:image/")) {
        return { dataUrl: url, mimeType: extraerMimeDesdeDataUrl(url) };
      }
      if (parte.type === "image" && typeof parte.data === "string" && parte.data.length > 0) {
        const mime = parte.mime_type || "image/png";
        return { dataUrl: `data:${mime};base64,${parte.data}`, mimeType: mime };
      }
    }
  }

  // 3. Respaldo si vino una data URL incrustada en string
  if (typeof msg.content === "string") {
    const match = msg.content.match(/data:image\/[a-z0-9.+-]+;base64,[A-Za-z0-9+/=]+/i);
    if (match?.[0]) {
      return { dataUrl: match[0], mimeType: extraerMimeDesdeDataUrl(match[0]) };
    }
  }

  return null;
}

async function generarImagenModoOpenRouter(params: {
  modo: ModoEstudioIa;
  opciones: OpcionesEstudioIa;
  fotoBase: { mimeType: string; base64: string };
  apiKey: string;
  modelo: string;
}): Promise<{ dataUrl: string; mimeType: string }> {
  const { modo, opciones, fotoBase, apiKey, modelo } = params;

  const promptCompleto = construirPromptCompletoEstudioIa(modo, opciones);
  const referencias = obtenerReferenciasParaModo(modo, opciones);

  const content: ParteOpenRouter[] = [
    { type: "text", text: promptCompleto },
    { type: "text", text: "FOTO DEL PRODUCTO:" },
    {
      type: "image_url",
      image_url: {
        url: `data:${fotoBase.mimeType};base64,${fotoBase.base64}`,
      },
    },
  ];

  for (const ref of referencias) {
    const b64Ref = await leerReferenciaBase64(ref.archivo);
    content.push(
      { type: "text", text: `REFERENCIA ${ref.etiquetaPrompt}:` },
      {
        type: "image_url",
        image_url: {
          url: `data:image/jpeg;base64,${b64Ref}`,
        },
      }
    );
  }

  const referer =
    process.env.NEXT_PUBLIC_SITE_URL?.trim() || "https://tinkay-web.vercel.app";
  let ultimoMotivo = "OpenRouter no devolvió una imagen válida";

  for (let intento = 1; intento <= MAX_INTENTOS_POR_MODO; intento++) {
    try {
      const res = await fetch(OPENROUTER_CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": referer,
          "X-Title": "Tinkay Floristeria - Estudio IA",
        },
        body: JSON.stringify({
          model: modelo,
          modalities: ["image", "text"],
          image_config: { aspect_ratio: "3:4" },
          messages: [{ role: "user", content }],
        }),
      });

      const data = (await res.json().catch(() => ({}))) as RespuestaOpenRouter;

      if (!res.ok) {
        ultimoMotivo =
          data.error?.message || `Error de OpenRouter (HTTP ${res.status})`;
        const esTransitorio = res.status === 429 || res.status === 503 || res.status >= 500;
        if (esTransitorio && intento < MAX_INTENTOS_POR_MODO) {
          await esperar(ESPERA_REINTENTO_MS);
          continue;
        }
        throw new Error(ultimoMotivo);
      }

      const imagenExtraida = extraerImagenDeRespuestaOpenRouter(data);
      if (imagenExtraida) {
        return imagenExtraida;
      }

      const finishReason = data.choices?.[0]?.finish_reason;
      ultimoMotivo = finishReason
        ? `OpenRouter finalizó sin imagen (${finishReason})`
        : "OpenRouter respondió sin datos de imagen";

      if (intento < MAX_INTENTOS_POR_MODO) {
        await esperar(ESPERA_REINTENTO_MS);
      }
    } catch (err) {
      ultimoMotivo = err instanceof Error ? err.message : "Error de conexión con OpenRouter";
      if (intento < MAX_INTENTOS_POR_MODO) {
        await esperar(ESPERA_REINTENTO_MS);
      } else {
        throw new Error(ultimoMotivo);
      }
    }
  }

  throw new Error(ultimoMotivo);
}

interface RespuestaRpcEstudioIa {
  ok?: boolean;
  codigo?: string;
  error?: string;
  dataUrl?: string;
  mimeType?: string;
  proveedor?: string;
  modelo?: string;
}

async function generarImagenModoVault(params: {
  supabase: Awaited<ReturnType<typeof crearClienteServidor>>;
  modo: ModoEstudioIa;
  opciones: OpcionesEstudioIa;
  fotoBase: { mimeType: string; base64: string };
  referer: string;
}): Promise<{ dataUrl: string; mimeType: string }> {
  const { supabase, modo, opciones, fotoBase, referer } = params;

  const promptCompleto = construirPromptCompletoEstudioIa(modo, opciones);
  const referencias = obtenerReferenciasParaModo(modo, opciones);

  const imagenesPayload: Array<{ etiqueta: string; mimeType: string; base64: string }> = [
    {
      etiqueta: "FOTO DEL PRODUCTO:",
      mimeType: fotoBase.mimeType,
      base64: fotoBase.base64,
    },
  ];

  for (const ref of referencias) {
    const b64Ref = await leerReferenciaBase64(ref.archivo);
    imagenesPayload.push({
      etiqueta: `REFERENCIA ${ref.etiquetaPrompt}:`,
      mimeType: "image/jpeg",
      base64: b64Ref,
    });
  }

  let ultimoMotivo = "No se pudo generar la fotografía mediante Estudio IA (Vault)";
  const esquemaCfg = supabase.schema("comun_configuracion") as unknown as {
    rpc(
      nombre: string,
      args: Record<string, unknown>
    ): Promise<{ data: RespuestaRpcEstudioIa | null; error: { message: string } | null }>;
  };

  for (let intento = 1; intento <= MAX_INTENTOS_POR_MODO; intento++) {
    const { data, error } = await esquemaCfg.rpc("cfg_fn_invocar_estudio_ia", {
      p_negocio: "tinkay",
      p_prompt: promptCompleto,
      p_imagenes: imagenesPayload,
      p_referer: referer,
    });

    if (error) {
      ultimoMotivo = error.message.includes("cfg_fn_invocar_estudio_ia")
        ? "Ejecuta primero la migración 20261120000001_cfg_estudio_ia_vault.sql en Supabase para usar la clave guardada en Configuración."
        : error.message;
      throw new Error(ultimoMotivo);
    }

    if (data?.ok && data.dataUrl) {
      return {
        dataUrl: data.dataUrl,
        mimeType: data.mimeType || extraerMimeDesdeDataUrl(data.dataUrl),
      };
    }

    ultimoMotivo = data?.error || ultimoMotivo;
    const esTransitorio = data?.codigo === "TRANSITORIO" || data?.codigo === "SIN_IMAGEN";
    if (esTransitorio && intento < MAX_INTENTOS_POR_MODO) {
      await esperar(ESPERA_REINTENTO_MS);
      continue;
    }
    throw new Error(ultimoMotivo);
  }

  throw new Error(ultimoMotivo);
}

export async function POST(request: NextRequest) {
  try {
    const ctx = await obtenerContextoAccesoTinkay();
    if (!ctx.perfil || !ctx.clavesAutorizadas.has("galeria_inmediata")) {
      return NextResponse.json({ ok: false, error: "No autorizado" }, { status: 401 });
    }

    const supabase = await crearClienteServidor();
    const { data: filaAria } = await (
      supabase.schema("comun_configuracion") as unknown as {
        from(t: string): {
          select(c: string): {
            eq(k: string, v: string): {
              maybeSingle(): Promise<{
                data: {
                  ari_estudio_ia_secreto_id?: string | null;
                  ari_detalle_aria?: Record<string, unknown> | null;
                } | null;
                error: { message: string } | null;
              }>;
            };
          };
        };
      }
    )
      .from("cfg_aria")
      .select("ari_estudio_ia_secreto_id, ari_detalle_aria")
      .eq("ari_negocio", "tinkay")
      .maybeSingle();

    const estDetalle =
      filaAria?.ari_detalle_aria &&
      typeof filaAria.ari_detalle_aria.estudio_ia === "object" &&
      filaAria.ari_detalle_aria.estudio_ia !== null
        ? (filaAria.ari_detalle_aria.estudio_ia as Record<string, unknown>)
        : {};
    const tieneClaveVault = Boolean(filaAria?.ari_estudio_ia_secreto_id);
    const vaultActivo = Boolean(estDetalle.activo);

    const openRouterKeyEnv = process.env.OPENROUTER_API_KEY?.trim();
    const geminiKeyEnv =
      process.env.GEMINI_API_KEY?.trim() ||
      process.env.GOOGLE_GENERATIVE_AI_API_KEY?.trim();

    if (tieneClaveVault && !vaultActivo && !openRouterKeyEnv && !geminiKeyEnv) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Estudio IA tiene clave guardada en Vault pero está desactivado. Actívalo en Configuración → Agente ARIA (/panel/aria#estudio-ia).",
        },
        { status: 503 }
      );
    }

    if ((!tieneClaveVault || !vaultActivo) && !openRouterKeyEnv && !geminiKeyEnv) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Configura tu API Key de OpenRouter en Configuración → Agente ARIA (/panel/aria#estudio-ia) → Estudio IA.",
        },
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

    const usarVault = tieneClaveVault && vaultActivo;
    const usarOpenRouterEnv = Boolean(openRouterKeyEnv);
    const modeloEnv = usarOpenRouterEnv
      ? process.env.OPENROUTER_IMAGE_MODEL?.trim() || MODELO_OPENROUTER_POR_DEFECTO
      : process.env.GEMINI_IMAGE_MODEL?.trim() || MODELO_GEMINI_POR_DEFECTO;
    const referer =
      process.env.NEXT_PUBLIC_SITE_URL?.trim() ||
      request.headers.get("origin") ||
      "https://tinkay-web.vercel.app";
    const modosUnicos = Array.from(new Set(modos));

    const ejecuciones = await Promise.all(
      modosUnicos.map(async (modo) => {
        try {
          const resultado = usarVault
            ? await generarImagenModoVault({
                supabase,
                modo,
                opciones,
                fotoBase,
                referer,
              })
            : usarOpenRouterEnv
              ? await generarImagenModoOpenRouter({
                  modo,
                  opciones,
                  fotoBase,
                  apiKey: openRouterKeyEnv!,
                  modelo: modeloEnv,
                })
              : await generarImagenModoGemini({
                  modo,
                  opciones,
                  fotoBase,
                  apiKey: geminiKeyEnv!,
                  modelo: modeloEnv,
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
