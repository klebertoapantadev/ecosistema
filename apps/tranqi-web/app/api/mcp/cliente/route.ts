import { crearManejadorMcp } from "@eco/agentes-ia";
import { autenticarPeticionMcp, type ContextoAsistente } from "../../../../modulos/asistente/contexto";
import { HERRAMIENTAS_CLIENTE } from "../../../../modulos/asistente/herramientas-cliente";

// Servidor MCP del asistente del afiliado. Lo consume ARIA de servidor a
// servidor (transporte streamable_http), no el navegador.
//
// El runtime es Node y no Edge porque supabase-js no esta pensado para Edge en
// este escenario, y esta ruta no necesita latencia de borde: la llama un
// backend, no un usuario.
export const runtime = "nodejs";
// Nunca cachear: cada peticion resuelve datos de un usuario distinto.
export const dynamic = "force-dynamic";

const manejar = crearManejadorMcp<ContextoAsistente>({
  nombre: "tranqi-cliente",
  version: "1.0.0",
  herramientas: HERRAMIENTAS_CLIENTE,
  // Solo capsulas de CLIENTE. Una de abogado no entra aqui aunque ARIA tuviera
  // mal enganchados los MCP.
  autenticar: (peticion) => autenticarPeticionMcp(peticion, ["CLIENTE"]),
});

export const POST = manejar;
export const GET = manejar;
