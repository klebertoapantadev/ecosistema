import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { crearServidorMcpCatalogo } from "./mcp-catalogo";
import type { Herramienta } from "./mcp-servidor";
import type { ContextoMcpCatalogo } from "./mcp-catalogo";

describe("crearServidorMcpCatalogo con herramientas adicionales", () => {
  const originalFetch = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  function configurarMockRpc(alcances: string[] = ["catalogo:leer", "prospectos:crear"]) {
    globalThis.fetch = vi.fn(async (url: RequestInfo | URL) => {
      const urlStr = String(url);
      if (urlStr.includes("seg_fn_validar_token_mcp")) {
        return new Response(
          JSON.stringify({
            valido: true,
            token_id: "tkn-123",
            negocio_id: "tranqi",
            nombre: "Test Token",
            alcances,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
      return new Response(JSON.stringify([]), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    }) as any;
  }

  function crearManejador(alcanceRequerido?: string) {
    let ultimoContexto: ContextoMcpCatalogo | null = null;

    const herramientaExtra: Herramienta<ContextoMcpCatalogo> & { alcanceRequerido?: string } = {
      descripcion: "Herramienta de prueba adicional",
      esquema: {
        type: "object",
        properties: {
          nombre: { type: "string" },
        },
      },
      alcanceRequerido,
      async ejecutar(args, ctx) {
        ultimoContexto = ctx;
        return { registrado: true, recibido: args.nombre, tokenUsado: ctx.token };
      },
    };

    const manejar = crearServidorMcpCatalogo({
      negocioPorDefecto: "tranqi",
      herramientasAdicionales: {
        registrar_contacto: herramientaExtra,
      },
    });

    return { manejar, obtenerUltimoContexto: () => ultimoContexto };
  }

  function peticion(cuerpo: unknown, token = "eco_live_1234567890abcdef1234567890abcdef") {
    return new Request("https://tranqi.test/api/mcp/catalogo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(cuerpo),
    });
  }

  it("(a) tools/list incluye la herramienta adicional además de las de catálogo", async () => {
    configurarMockRpc(["catalogo:leer", "prospectos:crear"]);
    const { manejar } = crearManejador("prospectos:crear");

    const respuesta = await manejar(peticion({ jsonrpc: "2.0", id: 1, method: "tools/list" }));
    expect(respuesta.status).toBe(200);

    const datos = await respuesta.json();
    const nombres = datos.result.tools.map((t: { name: string }) => t.name);
    expect(nombres).toContain("consultar_catalogo");
    expect(nombres).toContain("detalle_producto");
    expect(nombres).toContain("registrar_contacto");
  });

  it("(b) se ejecuta con el alcance requerido", async () => {
    configurarMockRpc(["catalogo:leer", "prospectos:crear"]);
    const { manejar } = crearManejador("prospectos:crear");

    const respuesta = await manejar(
      peticion({
        jsonrpc: "2.0",
        id: 2,
        method: "tools/call",
        params: {
          name: "registrar_contacto",
          arguments: { nombre: "Carlos" },
        },
      })
    );

    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    expect(datos.error).toBeUndefined();
    expect(datos.result.isError).toBeFalsy();
    const contenido = JSON.parse(datos.result.content[0].text);
    expect(contenido.registrado).toBe(true);
    expect(contenido.recibido).toBe("Carlos");
  });

  it("(c) devuelve el error de alcance sin él", async () => {
    configurarMockRpc(["catalogo:leer"]); // Sin prospectos:crear
    const { manejar } = crearManejador("prospectos:crear");

    const respuesta = await manejar(
      peticion({
        jsonrpc: "2.0",
        id: 3,
        method: "tools/call",
        params: {
          name: "registrar_contacto",
          arguments: { nombre: "Carlos" },
        },
      })
    );

    expect(respuesta.status).toBe(200);
    const datos = await respuesta.json();
    const contenido = JSON.parse(datos.result.content[0].text);
    expect(contenido.error).toContain("El token no tiene el alcance prospectos:crear");
  });

  it("(d) ctx.token llega a la herramienta con el token en claro", async () => {
    const tokenPrueba = "eco_live_abcdef1234567890abcdef1234567890";
    configurarMockRpc(["catalogo:leer", "prospectos:crear"]);
    const { manejar, obtenerUltimoContexto } = crearManejador("prospectos:crear");

    const respuesta = await manejar(
      peticion(
        {
          jsonrpc: "2.0",
          id: 4,
          method: "tools/call",
          params: {
            name: "registrar_contacto",
            arguments: { nombre: "Diana" },
          },
        },
        tokenPrueba
      )
    );

    expect(respuesta.status).toBe(200);
    const ctx = obtenerUltimoContexto();
    expect(ctx).not.toBeNull();
    expect(ctx?.token).toBe(tokenPrueba);

    const datos = await respuesta.json();
    const contenido = JSON.parse(datos.result.content[0].text);
    expect(contenido.tokenUsado).toBe(tokenPrueba);
  });
});
