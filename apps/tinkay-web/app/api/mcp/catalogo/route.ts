import { crearServidorMcpCatalogo } from "@eco/agentes-ia";
import { obtenerCatalogoProductosAction } from "@eco/comercio";

const manejarMcp = crearServidorMcpCatalogo({
  negocioPorDefecto: "tinkay",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS",
  consultarProductos: async (negocioId) => {
    return await obtenerCatalogoProductosAction(negocioId);
  },
});

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejarMcp(peticion);
}

export async function GET() {
  return new Response(
    JSON.stringify({
      nombre: "mcp-catalogo-tinkay",
      version: "1.0.0",
      protocolo: "Model Context Protocol (JSON-RPC 2.0 / streamable_http)",
      descripcion: "Servidor MCP de consulta de catálogo para Tinkay Floristería",
      autenticacion: "Authorization: Bearer eco_live_...",
      endpoints: {
        mcp: "POST /api/mcp/catalogo",
      },
    }),
    {
      status: 200,
      headers: { "Content-Type": "application/json" },
    }
  );
}
