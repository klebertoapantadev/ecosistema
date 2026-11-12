import { NextRequest, NextResponse } from "next/server";
import { ErrorSinConfiguracionAria, invocarAgentePorNegocio } from "@eco/agentes-ia";

// Chat publico de la tienda (Mía). Pasa por packages/agentes-ia como exige el
// ADR-0002: la API key del agente vive cifrada en Supabase Vault (cfg_aria +
// Edge Function invocar-aria) con respaldo a variables de entorno del servidor.
//
// El prompt de Mía NO esta aqui: se edita en el panel de ARIA, en la identidad
// del agente cuyo id se administra en /panel/aria (o ARIA_AGENT_ID).

export const maxDuration = 60;

const NEGOCIO = "tinkay";

// Por debajo de maxDuration, para que la ruta alcance a responder el error y
// el chat use su texto de respaldo en vez de recibir un 504 sin cuerpo.
const ESPERA_ARIA_MS = 50000;

// La ruta es publica (sin sesion): se acota el tamano para que nadie la use
// de pasarela barata hacia el modelo.
const LARGO_MAXIMO_PROMPT = 1000;
const FORMATO_CONVERSACION = /^[A-Za-z0-9_-]{8,64}$/;

export async function POST(req: NextRequest) {
  let prompt: unknown;
  let conversationId: unknown;
  try {
    ({ prompt, conversation_id: conversationId } = await req.json());
  } catch {
    return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
  }

  if (typeof prompt !== "string" || !prompt.trim()) {
    return NextResponse.json({ error: "prompt vacío" }, { status: 400 });
  }
  if (prompt.length > LARGO_MAXIMO_PROMPT) {
    return NextResponse.json({ error: "Mensaje demasiado largo" }, { status: 413 });
  }
  const conversacion =
    typeof conversationId === "string" && FORMATO_CONVERSACION.test(conversationId)
      ? conversationId
      : undefined;

  try {
    const data = await invocarAgentePorNegocio(NEGOCIO, prompt.trim(), {
      conversationId: conversacion,
      tiempoMaximoMs: ESPERA_ARIA_MS,
    });
    return NextResponse.json({ response: data.response });
  } catch (e) {
    if (e instanceof ErrorSinConfiguracionAria) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
