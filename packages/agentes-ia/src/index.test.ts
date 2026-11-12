import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import {
  ErrorSinConfiguracionAria,
  invocarAgentePorNegocio,
  resolverAgenteDesdeEntorno,
} from "./index";

describe("resolverAgenteDesdeEntorno", () => {
  const claves = ["ARIA_BASE", "ARIA_AGENT_ID", "ARIA_AGENT_KEY"] as const;
  const original: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const k of claves) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of claves) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
  });

  it("devuelve null si falta cualquiera de las 3 variables", () => {
    process.env.ARIA_BASE = "https://ejemplo.com/agentes";
    process.env.ARIA_AGENT_ID = "agente-1";
    // ARIA_AGENT_KEY queda sin definir a proposito
    expect(resolverAgenteDesdeEntorno("ARIA")).toBeNull();
  });

  it("devuelve null si no hay ninguna variable configurada", () => {
    expect(resolverAgenteDesdeEntorno("ARIA")).toBeNull();
  });

  it("resuelve la configuracion y quita la barra final de baseUrl", () => {
    process.env.ARIA_BASE = "https://ejemplo.com/agentes/";
    process.env.ARIA_AGENT_ID = "agente-1";
    process.env.ARIA_AGENT_KEY = "clave-secreta";

    expect(resolverAgenteDesdeEntorno("ARIA")).toEqual({
      baseUrl: "https://ejemplo.com/agentes",
      agentId: "agente-1",
      apiKey: "clave-secreta",
    });
  });

  it("usa el prefijo dado, no uno fijo -- soporta un agente distinto por producto/rol", () => {
    process.env.TRQ_ABOGADO_BASE = "https://ejemplo.com/agentes";
    process.env.TRQ_ABOGADO_AGENT_ID = "agente-abogado";
    process.env.TRQ_ABOGADO_AGENT_KEY = "clave-abogado";

    expect(resolverAgenteDesdeEntorno("TRQ_ABOGADO")).toEqual({
      baseUrl: "https://ejemplo.com/agentes",
      agentId: "agente-abogado",
      apiKey: "clave-abogado",
    });

    delete process.env.TRQ_ABOGADO_BASE;
    delete process.env.TRQ_ABOGADO_AGENT_ID;
    delete process.env.TRQ_ABOGADO_AGENT_KEY;
  });
});

describe("invocarAgentePorNegocio", () => {
  const claves = [
    "NEXT_PUBLIC_SUPABASE_URL",
    "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    "ARIA_BASE",
    "ARIA_AGENT_ID",
    "ARIA_AGENT_KEY",
  ] as const;
  const original: Record<string, string | undefined> = {};
  const fetchOriginal = globalThis.fetch;

  beforeEach(() => {
    for (const k of claves) {
      original[k] = process.env[k];
      delete process.env[k];
    }
  });

  afterEach(() => {
    for (const k of claves) {
      if (original[k] === undefined) delete process.env[k];
      else process.env[k] = original[k];
    }
    globalThis.fetch = fetchOriginal;
  });

  it("usa la Edge Function invocar-aria cuando el negocio tiene configuración activa en Vault", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_pub_123";

    const fetchMock = vi.fn().mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: true, response: "Hola desde Mía", runId: "run-1" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await invocarAgentePorNegocio("tinkay", "Recomiéndame rosas", {
      conversationId: "conv-12345678",
    });

    expect(res).toEqual({ response: "Hola desde Mía", usage: undefined, runId: "run-1" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe("https://proyecto.supabase.co/functions/v1/invocar-aria");
  });

  it("cae en respaldo a variables de entorno cuando invocar-aria devuelve 409 (sin Vault activo)", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_pub_123";
    process.env.ARIA_BASE = "https://aria.ejemplo.com/agentes";
    process.env.ARIA_AGENT_ID = "agente-respaldo";
    process.env.ARIA_AGENT_KEY = "clave-respaldo";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Sin agente activo en Vault" }), { status: 409 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ response: "Respuesta respaldo", run_id: "run-env" }), {
          status: 200,
        }),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await invocarAgentePorNegocio("tranqi", "Hola");
    expect(res).toEqual({ response: "Respuesta respaldo", usage: undefined, runId: "run-env" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it("usa el puente RPC cfg_fn_invocar_aria cuando la Edge Function invocar-aria devuelve 404", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_pub_123";

    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Function not found" }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ ok: true, response: "Hola desde Mía (RPC Vault)", runId: "run-rpc-1" }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    const res = await invocarAgentePorNegocio("tinkay", "Hola Mía");
    expect(res).toEqual({ response: "Hola desde Mía (RPC Vault)", usage: undefined, runId: "run-rpc-1" });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[1]?.[0]).toBe(
      "https://proyecto.supabase.co/rest/v1/rpc/cfg_fn_invocar_aria",
    );
  });

  it("lanza ErrorSinConfiguracionAria cuando no hay ni Vault ni variables de entorno", async () => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://proyecto.supabase.co";
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = "sb_pub_123";

    globalThis.fetch = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "No encontrado" }), { status: 404 }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "RPC no encontrado" }), { status: 404 }),
      ) as unknown as typeof fetch;

    await expect(invocarAgentePorNegocio("tinkay", "Hola")).rejects.toBeInstanceOf(
      ErrorSinConfiguracionAria,
    );
  });
});
