import { describe, it, expect, vi, beforeEach } from "vitest";
import { extraerBearerToken, validarTokenMcpConRpc } from "./tokens-mcp";

describe("tokens-mcp", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe("extraerBearerToken", () => {
    it("extrae correctamente el token con Bearer estándar", () => {
      const req = new Request("https://ejemplo.com/api/mcp/catalogo", {
        headers: { Authorization: "Bearer eco_live_1234567890abcdef" },
      });
      expect(extraerBearerToken(req)).toBe("eco_live_1234567890abcdef");
    });

    it("maneja minúsculas y espacios múltiples", () => {
      const req = new Request("https://ejemplo.com/api/mcp/catalogo", {
        headers: { authorization: "bearer    eco_live_abcdef123456" },
      });
      expect(extraerBearerToken(req)).toBe("eco_live_abcdef123456");
    });

    it("retorna null si no hay header de autorización", () => {
      const req = new Request("https://ejemplo.com/api/mcp/catalogo");
      expect(extraerBearerToken(req)).toBeNull();
    });

    it("retorna null si el header no es Bearer", () => {
      const req = new Request("https://ejemplo.com/api/mcp/catalogo", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });
      expect(extraerBearerToken(req)).toBeNull();
    });
  });

  describe("validarTokenMcpConRpc", () => {
    it("rechaza de inmediato tokens sin prefijo eco_live_", async () => {
      const resultado = await validarTokenMcpConRpc("token_invalido", "https://xyz.supabase.co", "anon_key");
      expect(resultado).toBeNull();
    });

    it("retorna contexto exitoso cuando RPC responde valido=true", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valido: true,
          token_id: "uuid-123",
          negocio_id: "tinkay",
          nombre: "Bot WhatsApp",
          alcances: ["catalogo:leer"],
        }),
      } as Response);

      const resultado = await validarTokenMcpConRpc(
        "eco_live_0123456789abcdef0123456789abcdef",
        "https://xyz.supabase.co",
        "anon_key",
        "catalogo:leer"
      );

      expect(resultado).toEqual({
        valido: true,
        tokenId: "uuid-123",
        negocioId: "tinkay",
        nombre: "Bot WhatsApp",
        alcances: ["catalogo:leer"],
      });
    });

    it("retorna null cuando RPC responde valido=false", async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          valido: false,
          motivo: "TOKEN_REVOCADO",
        }),
      } as Response);

      const resultado = await validarTokenMcpConRpc(
        "eco_live_0123456789abcdef0123456789abcdef",
        "https://xyz.supabase.co",
        "anon_key"
      );

      expect(resultado).toBeNull();
    });
  });
});
