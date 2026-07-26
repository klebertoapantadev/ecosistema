#!/usr/bin/env node
// MCP de ARIA — servidor stdio sin dependencias.
// Expone la API de agentes de ARIA (129.153.84.58/agentes) como herramientas
// MCP, para administrar tenants/agentes/keys e invocar agentes desde Claude
// Code sin abrir el proyecto ARIA ni el dashboard.
//
// Credenciales: usa ARIA_API_URL / ARIA_API_TOKEN del entorno; si faltan, lee
// C:\Users\jesus\ARIA\interfaz\.env (el token nunca vive en este archivo).
//
// Registro (una sola vez):
//   claude mcp add --scope user aria -- node C:\Users\jesus\TRANQUI\aria-mcp\server.js

const fs = require("fs");
const readline = require("readline");

// ── configuración ─────────────────────────────────────────────────────────────
function loadConfig() {
  let url = process.env.ARIA_API_URL;
  let token = process.env.ARIA_API_TOKEN;
  if (!url || !token) {
    try {
      const env = fs.readFileSync("C:\\Users\\jesus\\ARIA\\interfaz\\.env", "utf8");
      for (const line of env.split(/\r?\n/)) {
        const m = line.match(/^\s*(ARIA_API_URL|ARIA_API_TOKEN)\s*=\s*(.+?)\s*$/);
        if (m) {
          if (m[1] === "ARIA_API_URL" && !url) url = m[2];
          if (m[1] === "ARIA_API_TOKEN" && !token) token = m[2];
        }
      }
    } catch { /* sin .env: quedará el error claro al llamar */ }
  }
  return { url: (url || "http://129.153.84.58/agentes").replace(/\/$/, ""), token };
}
const CFG = loadConfig();

async function api(method, path, { body, tenant, bearer } = {}) {
  if (!CFG.token) throw new Error("Falta ARIA_API_TOKEN (env o interfaz/.env de ARIA).");
  const headers = {
    "X-Aria-Key": CFG.token,
    Authorization: `Bearer ${bearer || CFG.token}`,
    "Content-Type": "application/json",
  };
  if (tenant) headers["X-Aria-Tenant"] = tenant;
  const r = await fetch(CFG.url + path, {
    method,
    headers,
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(150000),
  });
  const text = await r.text();
  let data;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!r.ok) throw new Error(`HTTP ${r.status} ${method} ${path}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  return data;
}

// ── definición de tools ───────────────────────────────────────────────────────
const str = (description) => ({ type: "string", description });
const TENANT_PROP = { tenant: str("UUID del tenant (header X-Aria-Tenant). Obligatorio para operaciones tenant-scoped.") };

const TOOLS = {
  aria_health: {
    description: "Comprueba que el backend de agentes de ARIA está vivo (GET /health).",
    schema: { type: "object", properties: {} },
    run: () => api("GET", "/health"),
  },
  aria_whoami: {
    description: "Identidad efectiva del token configurado (GET /v1/me).",
    schema: { type: "object", properties: { ...TENANT_PROP } },
    run: (a) => api("GET", "/v1/me", { tenant: a.tenant }),
  },
  aria_list_tenants: {
    description: "Lista todos los tenants de ARIA (solo superadmin).",
    schema: { type: "object", properties: {} },
    run: () => api("GET", "/v1/tenants"),
  },
  aria_create_tenant: {
    description: "Crea un tenant nuevo con su proveedor global (openai|gemini|openrouter). Verifica la key con una embedding de prueba antes de crear.",
    schema: {
      type: "object",
      properties: {
        slug: str("Slug único, ej. 'tranqi'"),
        name: str("Nombre visible"),
        provider_name: { type: "string", enum: ["openai", "gemini", "openrouter"], description: "Proveedor de la clave global" },
        provider_key: str("API key del proveedor (en claro, solo se envía al backend)"),
      },
      required: ["slug", "name", "provider_name", "provider_key"],
    },
    run: (a) => api("POST", "/v1/tenants", { body: a }),
  },
  aria_list_agents: {
    description: "Lista los agentes de un tenant.",
    schema: { type: "object", properties: { ...TENANT_PROP }, required: ["tenant"] },
    run: (a) => api("GET", "/v1/agents", { tenant: a.tenant }),
  },
  aria_get_agent: {
    description: "Detalle completo de un agente (identity, system_sections, model, capabilities...).",
    schema: { type: "object", properties: { ...TENANT_PROP, agent_id: str("UUID del agente") }, required: ["tenant", "agent_id"] },
    run: (a) => api("GET", `/v1/agents/${a.agent_id}`, { tenant: a.tenant }),
  },
  aria_create_agent: {
    description: "Crea un agente. Campos: name, slug, identity (system prompt base), system_sections [{title,content}], model ('proveedor/modelo', ej. 'openrouter/qwen/qwen3-235b-a22b-2507'), capabilities {}, enabled.",
    schema: {
      type: "object",
      properties: {
        ...TENANT_PROP,
        agent: { type: "object", description: "Cuerpo AgentCreate completo (name, slug, identity, system_sections, model, capabilities, ...)" },
      },
      required: ["tenant", "agent"],
    },
    run: (a) => api("POST", "/v1/agents", { tenant: a.tenant, body: a.agent }),
  },
  aria_update_agent: {
    description: "Actualiza campos de un agente (PATCH parcial: solo los campos incluidos).",
    schema: {
      type: "object",
      properties: { ...TENANT_PROP, agent_id: str("UUID del agente"), updates: { type: "object", description: "Campos a cambiar (identity, system_sections, model, enabled...)" } },
      required: ["tenant", "agent_id", "updates"],
    },
    run: (a) => api("PATCH", `/v1/agents/${a.agent_id}`, { tenant: a.tenant, body: a.updates }),
  },
  aria_create_api_key: {
    description: "Emite una API key de invocación para un agente. El token se devuelve UNA sola vez.",
    schema: {
      type: "object",
      properties: { ...TENANT_PROP, agent_id: str("UUID del agente"), name: str("Nombre descriptivo de la key") },
      required: ["tenant", "agent_id", "name"],
    },
    run: (a) => api("POST", "/v1/keys", { tenant: a.tenant, body: { agent_id: a.agent_id, name: a.name } }),
  },
  aria_invoke: {
    description: "Invoca un agente y devuelve su respuesta completa (usa el token admin como superadmin).",
    schema: {
      type: "object",
      properties: {
        agent_id: str("UUID del agente"),
        prompt: str("Mensaje para el agente"),
        conversation_id: str("Opcional: id de conversación para mantener historial"),
      },
      required: ["agent_id", "prompt"],
    },
    run: (a) => api("POST", `/v1/agents/${a.agent_id}/invoke`, { body: { prompt: a.prompt, conversation_id: a.conversation_id } }),
  },
  aria_list_runs: {
    description: "Últimos runs (ejecuciones) de un tenant, con costo y duración.",
    schema: { type: "object", properties: { ...TENANT_PROP, limit: { type: "number", description: "Máx. filas (default 20)" } }, required: ["tenant"] },
    run: (a) => api("GET", `/v1/runs?limit=${a.limit || 20}`, { tenant: a.tenant }),
  },
  aria_list_providers: {
    description: "Proveedores de modelo del tenant (keys enmascaradas).",
    schema: { type: "object", properties: { ...TENANT_PROP }, required: ["tenant"] },
    run: (a) => api("GET", "/v1/providers", { tenant: a.tenant }),
  },
  aria_request: {
    description: "Escape hatch: llamada arbitraria a la API de ARIA (GET/POST/PATCH/PUT/DELETE + path tipo '/v1/skills'). Úsala para endpoints sin tool dedicada (skills, mcp-servers, http-tools, channels, settings...). Swagger: /agentes/docs.",
    schema: {
      type: "object",
      properties: {
        method: { type: "string", enum: ["GET", "POST", "PATCH", "PUT", "DELETE"] },
        path: str("Ruta que empieza en /v1/..., con query string si aplica"),
        body: { type: "object", description: "Cuerpo JSON opcional" },
        ...TENANT_PROP,
      },
      required: ["method", "path"],
    },
    run: (a) => api(a.method, a.path, { body: a.body, tenant: a.tenant }),
  },
};

// ── protocolo MCP (JSON-RPC 2.0 por líneas en stdio) ──────────────────────────
const out = (msg) => process.stdout.write(JSON.stringify(msg) + "\n");

async function handle(msg) {
  const { id, method, params } = msg;
  if (method === "initialize") {
    return out({
      jsonrpc: "2.0", id,
      result: {
        protocolVersion: params?.protocolVersion || "2025-06-18",
        capabilities: { tools: {} },
        serverInfo: { name: "aria", version: "1.0.0" },
      },
    });
  }
  if (method === "notifications/initialized" || method === "notifications/cancelled") return;
  if (method === "ping") return out({ jsonrpc: "2.0", id, result: {} });
  if (method === "tools/list") {
    return out({
      jsonrpc: "2.0", id,
      result: {
        tools: Object.entries(TOOLS).map(([name, t]) => ({
          name, description: t.description, inputSchema: t.schema,
        })),
      },
    });
  }
  if (method === "tools/call") {
    const tool = TOOLS[params?.name];
    if (!tool) return out({ jsonrpc: "2.0", id, error: { code: -32602, message: `Tool desconocida: ${params?.name}` } });
    try {
      const result = await tool.run(params.arguments || {});
      return out({
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: JSON.stringify(result, null, 2) ?? "ok" }] },
      });
    } catch (e) {
      return out({
        jsonrpc: "2.0", id,
        result: { content: [{ type: "text", text: `Error: ${e.message || e}` }], isError: true },
      });
    }
  }
  if (id !== undefined) out({ jsonrpc: "2.0", id, error: { code: -32601, message: `Método no soportado: ${method}` } });
}

readline.createInterface({ input: process.stdin, terminal: false }).on("line", (line) => {
  line = line.trim();
  if (!line) return;
  let msg;
  try { msg = JSON.parse(line); } catch { return; }
  handle(msg).catch((e) => {
    if (msg.id !== undefined) out({ jsonrpc: "2.0", id: msg.id, error: { code: -32603, message: String(e) } });
  });
});
