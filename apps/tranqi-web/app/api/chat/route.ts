import { NextRequest, NextResponse } from "next/server";
import { ErrorSinConfiguracionAria, invocarAgentePorNegocio } from "@eco/agentes-ia";

const NEGOCIO = "tranqi";

export async function POST(req: NextRequest) {
  try {
    const { prompt, conversation_id: conversationId } = await req.json();
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return NextResponse.json({ error: "prompt vacío" }, { status: 400 });
    }
    const data = await invocarAgentePorNegocio(NEGOCIO, prompt.trim(), {
      conversationId: typeof conversationId === "string" ? conversationId : undefined,
    });
    return NextResponse.json(data);
  } catch (e) {
    if (e instanceof ErrorSinConfiguracionAria) {
      return NextResponse.json({ error: e.message }, { status: 503 });
    }
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
