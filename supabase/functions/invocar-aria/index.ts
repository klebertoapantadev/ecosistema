// Invoca el agente conversacional de ARIA configurado por el ADMINISTRADOR de
// cada negocio en comun_configuracion.cfg_aria, descifrando ARIA_AGENT_KEY
// exclusivamente desde Supabase Vault con service_role (PLT-008 / PLT-010,
// mismo modelo de frontera que enviar-correo en ADR-0005).
//
// verify_jwt=false al desplegar: el chat de vitrina (/api/chat) atiende a
// visitantes sin sesión iniciada.
//   - Para llamadas con contexto privilegiado (tool_context, image_urls,
//     document_urls) o si se define ARIA_FUNCION_CLAVE en los secretos de
//     Supabase, exige la cabecera x-aria-clave comparada en tiempo constante.
//   - Para el chat público de vitrina (solo prompt <= 1000 caracteres y
//     conversation_id, sin herramientas de identidad), nunca expone secretos:
//     solo reenvía el mensaje al agente público activo del negocio y retorna
//     su respuesta textual.

import { createClient } from "jsr:@supabase/supabase-js@2";

const CLAVE_ARIA = Deno.env.get("ARIA_FUNCION_CLAVE");
const CLAVE_RESPALDO = Deno.env.get("CORREO_FUNCION_CLAVE");

const LARGO_MAXIMO_PUBLICO = 1000;
const FORMATO_CONVERSACION = /^[A-Za-z0-9_-]{8,64}$/;
const NEGOCIOS_VALIDOS = new Set(["tranqi", "tinkay", "fastfix", "margaritas"]);

function compararTiempoConstante(secreto: string | undefined, recibida: string | null): boolean {
  if (!secreto || !recibida || recibida.length !== secreto.length) return false;
  let diferencia = 0;
  for (let i = 0; i < secreto.length; i++) {
    diferencia |= secreto.charCodeAt(i) ^ recibida.charCodeAt(i);
  }
  return diferencia === 0;
}

function claveServidorValida(recibida: string | null): boolean {
  if (CLAVE_ARIA) {
    return compararTiempoConstante(CLAVE_ARIA, recibida);
  }
  if (CLAVE_RESPALDO) {
    return compararTiempoConstante(CLAVE_RESPALDO, recibida);
  }
  return false;
}

function respuesta(cuerpo: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return respuesta({ error: "Metodo no permitido" }, 405);
  }

  let cuerpo: {
    negocio?: unknown;
    prompt?: unknown;
    conversation_id?: unknown;
    tool_context?: unknown;
    image_urls?: unknown;
    document_urls?: unknown;
    tiempo_maximo_ms?: unknown;
  };
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta({ error: "Cuerpo invalido" }, 400);
  }

  const negocio = typeof cuerpo.negocio === "string" ? cuerpo.negocio.trim().toLowerCase() : "";
  const prompt = typeof cuerpo.prompt === "string" ? cuerpo.prompt.trim() : "";

  if (!NEGOCIOS_VALIDOS.has(negocio) || !prompt) {
    return respuesta({ error: "Datos invalidos (negocio o prompt)" }, 400);
  }

  const tieneParametrosPrivilegiados =
    cuerpo.tool_context !== undefined ||
    cuerpo.image_urls !== undefined ||
    cuerpo.document_urls !== undefined ||
    prompt.length > LARGO_MAXIMO_PUBLICO;

  const cabeceraClave = req.headers.get("x-aria-clave");

  // Si se configuró ARIA_FUNCION_CLAVE dedicada, o si la llamada incluye
  // cápsulas de herramientas / adjuntos / prompts largos, se exige x-aria-clave.
  if (tieneParametrosPrivilegiados || CLAVE_ARIA) {
    if (!claveServidorValida(cabeceraClave)) {
      return respuesta({ error: "No autorizado" }, 401);
    }
  }

  const conversationId =
    typeof cuerpo.conversation_id === "string" && FORMATO_CONVERSACION.test(cuerpo.conversation_id)
      ? cuerpo.conversation_id
      : undefined;

  const tiempoMaximoMs =
    typeof cuerpo.tiempo_maximo_ms === "number" &&
    cuerpo.tiempo_maximo_ms >= 3000 &&
    cuerpo.tiempo_maximo_ms <= 110000
      ? cuerpo.tiempo_maximo_ms
      : 50000;

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data, error } = await supabase
    .schema("comun_configuracion")
    .rpc("cfg_fn_obtener_aria_credenciales", { p_negocio: negocio });

  if (error) {
    console.error("invocar-aria: fallo al leer credenciales", error);
    return respuesta({ error: "No se pudo leer la configuracion de ARIA" }, 500);
  }

  const cfg = Array.isArray(data) ? data[0] : null;
  if (!cfg || !cfg.base_url || !cfg.agente_id || !cfg.api_key) {
    return respuesta({ error: "El negocio no tiene un agente ARIA activo en Vault" }, 409);
  }

  const baseUrl = String(cfg.base_url).replace(/\/+$/, "");

  try {
    const r = await fetch(`${baseUrl}/v1/agents/${cfg.agente_id}/invoke`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${cfg.api_key}`,
      },
      body: JSON.stringify({
        prompt,
        conversation_id: conversationId,
        tool_context: tieneParametrosPrivilegiados ? cuerpo.tool_context : undefined,
        image_urls: tieneParametrosPrivilegiados ? cuerpo.image_urls : undefined,
        document_urls: tieneParametrosPrivilegiados ? cuerpo.document_urls : undefined,
      }),
      signal: AbortSignal.timeout(tiempoMaximoMs),
    });

    const datosAria = await r.json().catch(() => null);
    if (!r.ok) {
      return respuesta(
        { error: datosAria?.detail ?? datosAria?.error ?? `ARIA respondio ${r.status}` },
        502,
      );
    }

    return respuesta(
      {
        ok: true,
        response: datosAria?.response ?? datosAria?.detail ?? "…",
        usage: datosAria?.usage,
        runId: datosAria?.run_id,
      },
      200,
    );
  } catch (e) {
    console.error("invocar-aria: fallo al llamar a ARIA", e);
    return respuesta({ error: String((e as Error).message ?? e) }, 502);
  }
});

