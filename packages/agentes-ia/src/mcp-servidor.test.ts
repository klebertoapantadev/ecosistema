import { describe, expect, it } from "vitest";
import { crearManejadorMcp, type Herramienta } from "./mcp-servidor";

interface Ctx {
  usuario: string;
}

const HERRAMIENTAS: Record<string, Herramienta<Ctx>> = {
  saludar: {
    descripcion: "Devuelve un saludo.",
    esquema: { type: "object", properties: { quien: { type: "string" } } },
    async ejecutar(argumentos, contexto) {
      return `hola ${argumentos.quien ?? contexto.usuario}`;
    },
  },
  romperse: {
    descripcion: "Falla siempre, para probar el manejo de errores.",
    esquema: { type: "object", properties: {} },
    async ejecutar() {
      throw new Error("se cayo la base");
    },
  },
  torrente: {
    descripcion: "Devuelve muchisimo texto.",
    esquema: { type: "object", properties: {} },
    async ejecutar() {
      return "x".repeat(40000);
    },
  },
};

function crear(autenticar: (p: Request) => Promise<Ctx | null>) {
  return crearManejadorMcp<Ctx>({ nombre: "prueba", herramientas: HERRAMIENTAS, autenticar });
}

const manejar = crear(async (peticion) =>
  peticion.headers.get("authorization") === "Bearer bueno" ? { usuario: "ana" } : null,
);

function peticion(cuerpo: unknown, cabeceras: Record<string, string> = {}) {
  return new Request("https://tranqi.test/api/mcp/cliente", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: "Bearer bueno", ...cabeceras },
    body: JSON.stringify(cuerpo),
  });
}

describe("autenticacion", () => {
  it("401 sin cabecera valida, antes de tocar ninguna herramienta", async () => {
    const respuesta = await manejar(
      new Request("https://tranqi.test/api/mcp/cliente", {
        method: "POST",
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      }),
    );
    expect(respuesta.status).toBe(401);
  });

  it("401 tambien para initialize: no hay handshake anonimo", async () => {
    const respuesta = await manejar(
      new Request("https://tranqi.test/api/mcp/cliente", {
        method: "POST",
        headers: { Authorization: "Bearer malo" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "initialize", params: {} }),
      }),
    );
    expect(respuesta.status).toBe(401);
  });
});

describe("protocolo JSON-RPC", () => {
  it("initialize devuelve capacidades y respeta la version del cliente", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 1, method: "initialize", params: { protocolVersion: "2025-03-26" } }),
    );
    const datos = await respuesta.json();
    expect(datos.result.protocolVersion).toBe("2025-03-26");
    expect(datos.result.capabilities.tools).toEqual({});
    expect(datos.result.serverInfo.name).toBe("prueba");
  });

  it("tools/list expone nombre, descripcion y esquema de cada herramienta", async () => {
    const respuesta = await manejar(peticion({ jsonrpc: "2.0", id: 2, method: "tools/list" }));
    const datos = await respuesta.json();
    const nombres = datos.result.tools.map((t: { name: string }) => t.name);
    expect(nombres).toEqual(["saludar", "romperse", "torrente"]);
    expect(datos.result.tools[0].inputSchema).toEqual(HERRAMIENTAS.saludar?.esquema);
  });

  it("tools/call ejecuta y recibe el contexto de la autenticacion", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 3, method: "tools/call", params: { name: "saludar", arguments: {} } }),
    );
    const datos = await respuesta.json();
    // "ana" sale del contexto, no de los argumentos: es la propiedad que hace
    // que el modelo no pueda elegir por quien se hace pasar.
    expect(datos.result.content[0].text).toBe("hola ana");
  });

  it("una herramienta que falla devuelve isError, no un error de protocolo", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 4, method: "tools/call", params: { name: "romperse" } }),
    );
    const datos = await respuesta.json();
    expect(respuesta.status).toBe(200);
    expect(datos.error).toBeUndefined();
    expect(datos.result.isError).toBe(true);
    expect(datos.result.content[0].text).toContain("se cayo la base");
  });

  it("una herramienta inexistente es -32602", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 5, method: "tools/call", params: { name: "inventada" } }),
    );
    expect((await respuesta.json()).error.code).toBe(-32602);
  });

  it("un metodo desconocido es -32601", async () => {
    const respuesta = await manejar(peticion({ jsonrpc: "2.0", id: 6, method: "vete/a/saber" }));
    expect((await respuesta.json()).error.code).toBe(-32601);
  });

  it("recorta un resultado enorme y avisa de que lo hizo", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 7, method: "tools/call", params: { name: "torrente" } }),
    );
    const texto = (await respuesta.json()).result.content[0].text;
    expect(texto.length).toBeLessThan(17000);
    expect(texto).toContain("recortado por tamaño");
  });

  it("una notificacion no lleva respuesta: 202 sin cuerpo", async () => {
    const respuesta = await manejar(peticion({ jsonrpc: "2.0", method: "notifications/initialized" }));
    expect(respuesta.status).toBe(202);
    expect(await respuesta.text()).toBe("");
  });

  it("un lote responde solo a lo que lleva id, y en forma de lista", async () => {
    const respuesta = await manejar(
      peticion([
        { jsonrpc: "2.0", method: "notifications/initialized" },
        { jsonrpc: "2.0", id: 8, method: "ping" },
      ]),
    );
    const datos = await respuesta.json();
    expect(Array.isArray(datos)).toBe(true);
    expect(datos).toHaveLength(1);
    expect(datos[0].id).toBe(8);
  });

  it("JSON invalido es -32700 y no revienta", async () => {
    const respuesta = await manejar(
      new Request("https://tranqi.test/api/mcp/cliente", {
        method: "POST",
        headers: { Authorization: "Bearer bueno" },
        body: "{esto no es json",
      }),
    );
    expect(respuesta.status).toBe(400);
    expect((await respuesta.json()).error.code).toBe(-32700);
  });
});

describe("negociacion de contenido", () => {
  it("responde SSE cuando el cliente lo acepta", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 9, method: "ping" }, { Accept: "application/json, text/event-stream" }),
    );
    expect(respuesta.headers.get("content-type")).toContain("text/event-stream");
    const cuerpo = await respuesta.text();
    expect(cuerpo).toMatch(/^event: message\ndata: /);
    expect(JSON.parse(cuerpo.split("data: ")[1] ?? "{}").id).toBe(9);
  });

  it("responde JSON cuando no", async () => {
    const respuesta = await manejar(
      peticion({ jsonrpc: "2.0", id: 10, method: "ping" }, { Accept: "application/json" }),
    );
    expect(respuesta.headers.get("content-type")).toContain("application/json");
  });
});
