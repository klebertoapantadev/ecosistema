import { NextRequest, NextResponse } from "next/server";
import { ErrorSinConfiguracionAria, invocarAgentePorNegocio } from "@eco/agentes-ia";
import {
  construirBloqueAtribucionParaAria,
  registrarInteraccionChatWebAction,
  sincronizarHiloPublicoChatWebAction,
  type AtribucionPublicitariaVisitante,
} from "@eco/comercio";

const NEGOCIO = "tranqi";

export async function GET(req: NextRequest) {
  const convId = req.nextUrl.searchParams.get("conversation_id") ?? "";
  if (!convId) {
    return NextResponse.json({
      ok: true,
      existe: false,
      estadoAtencion: "BOT_ACTIVO",
      mensajesHumanos: [],
    });
  }
  try {
    const estado = await sincronizarHiloPublicoChatWebAction(NEGOCIO, convId);
    return NextResponse.json(estado);
  } catch {
    return NextResponse.json({
      ok: true,
      existe: false,
      estadoAtencion: "BOT_ACTIVO",
      mensajesHumanos: [],
    });
  }
}

export async function POST(req: NextRequest) {
  try {
    const { prompt, conversation_id: conversationId, atribucion } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "prompt vacío" }, { status: 400 });
    }
    const textoLimpio = prompt.trim();
    const esContextoNavegacion = textoLimpio.startsWith("[CONTEXTO:");
    const atribucionVisitante =
      atribucion && typeof atribucion === "object"
        ? (atribucion as Partial<AtribucionPublicitariaVisitante>)
        : null;
    const bloqueAtribucion = construirBloqueAtribucionParaAria(atribucionVisitante);
    const claveHilo =
      typeof conversationId === "string" && conversationId.trim()
        ? conversationId.trim()
        : `web-trq-${Date.now()}`;

    let silenciarAria = false;
    let asesoraNombre: string | null = null;
    if (!esContextoNavegacion) {
      try {
        const traza = await registrarInteraccionChatWebAction({
          negocio: NEGOCIO,
          claveHilo,
          fase: "ENTRADA_CLIENTE",
          contenido: textoLimpio,
          metadatos: atribucionVisitante
            ? { atribucion_publicitaria: atribucionVisitante }
            : undefined,
        });
        silenciarAria = traza.silenciarAria;
        asesoraNombre = traza.asesoraNombre ?? null;
      } catch {
        // No bloquear la atención si falla el registro secundario
      }
    }

    if (silenciarAria) {
      return NextResponse.json({
        response: null,
        modoHumano: true,
        asesoraNombre: asesoraNombre ?? "Asesor Legal",
      });
    }

    const data = await invocarAgentePorNegocio(NEGOCIO, `${textoLimpio}${bloqueAtribucion}`, {
      conversationId: typeof conversationId === "string" ? conversationId : undefined,
    });

    if (data.response && !esContextoNavegacion) {
      try {
        await registrarInteraccionChatWebAction({
          negocio: NEGOCIO,
          claveHilo,
          fase: "RESPUESTA_ARIA",
          contenido: data.response,
          metadatos: { nombre_agente: "ARIA Tranqi" },
        });
      } catch {
        // Ignorar fallo de bitácora secundaria
      }
    }

    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ErrorSinConfiguracionAria) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
