import { crearManejadorMcp } from "@eco/agentes-ia";
import { autenticarPeticionMcp, type ContextoAsistente } from "../../../../modulos/asistente/contexto";
import { HERRAMIENTAS_ABOGADO } from "../../../../modulos/asistente/herramientas-abogado";

// Servidor MCP del copiloto del abogado. Ver el gemelo en ../cliente/route.ts.
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const manejar = crearManejadorMcp<ContextoAsistente>({
  nombre: "tranqi-abogado",
  version: "1.0.0",
  herramientas: HERRAMIENTAS_ABOGADO,
  autenticar: (peticion) => autenticarPeticionMcp(peticion, ["ABOGADO"]),
});

export const POST = manejar;
export const GET = manejar;
