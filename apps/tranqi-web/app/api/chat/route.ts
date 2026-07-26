import { NextRequest, NextResponse } from "next/server";
import { invocarAgente, resolverAgenteDesdeEntorno } from "@eco/agentes-ia";

export async function POST(req: NextRequest) {
  const config = resolverAgenteDesdeEntorno("ARIA");

  // Sin credenciales no se llama a ARIA: se falla rapido y el buddie usa
  // su texto de respaldo, de modo que la landing sigue siendo navegable.
  if (!config) {
    return NextResponse.json(
      { error: "Sin credenciales de ARIA (ARIA_BASE, ARIA_AGENT_ID, ARIA_AGENT_KEY)" },
      { status: 503 },
    );
  }

  try {
    const { prompt, conversation_id: conversationId } = await req.json();
    if (!prompt) throw new Error("prompt vacío");
    const data = await invocarAgente(config, prompt, conversationId);
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message ?? e) }, { status: 502 });
  }
}
