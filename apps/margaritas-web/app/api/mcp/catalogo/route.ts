import { crearServidorMcpCatalogo } from "@eco/agentes-ia";

const manejarMcp = crearServidorMcpCatalogo({
  negocioPorDefecto: "margaritas",
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
});

export const runtime = "nodejs";

export async function POST(peticion: Request) {
  return manejarMcp(peticion);
}

export async function GET() {
  return new Response(
    JSON.stringify({
      nombre: "mcp-catalogo-margaritas",
      version: "1.0.0",
      protocolo: "Model Context Protocol (JSON-RPC 2.0 / streamable_http)",
      descripcion: "Servidor MCP de consulta de catálogo para Margaritas Floristería",
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
