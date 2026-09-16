import { crearServidorMcpCatalogo } from "@eco/agentes-ia";

const manejarMcp = crearServidorMcpCatalogo({
  negocioPorDefecto: "fastfix",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
  supabaseAnonKey:
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    "sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS",
});

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejarMcp(peticion);
}

export async function GET() {
  return new Response(
    JSON.stringify({
      nombre: "mcp-catalogo-fastfix",
      version: "1.0.0",
      protocolo: "Model Context Protocol (JSON-RPC 2.0 / streamable_http)",
      descripcion: "Servidor MCP de consulta de catálogo y servicios para FastFix Home",
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
