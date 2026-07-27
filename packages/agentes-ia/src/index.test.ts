import { describe, expect, it, beforeEach, afterEach } from "vitest";
import { resolverAgenteDesdeEntorno } from "./index";

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
