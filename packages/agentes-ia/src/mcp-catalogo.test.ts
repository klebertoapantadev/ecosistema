import { afterEach, describe, expect, it, vi } from "vitest";
import {
  crearServidorMcpCatalogo,
  filtrarPorTermino,
  normalizarTextoBusqueda,
  palabrasSignificativas,
} from "./mcp-catalogo";

// Forma de com_fn_obtener_catalogo_productos, recortada a lo que usa la búsqueda.
const PRODUCTOS = [
  {
    pro_id: "p-sas",
    pro_slug: "constitucion-sas",
    pro_nombre: "Constitución de Compañía SAS Express",
    pro_descripcion: "Creación de tu empresa en línea.",
    pro_detalle_producto: { etiquetas: [] },
    variantes: [{ var_nombre: "Constitución de Compañía SAS", var_precio: 300 }],
  },
  {
    pro_id: "p-notaria",
    pro_slug: "notarizacion",
    pro_nombre: "Notarización de Documentos & Poderes",
    pro_descripcion: "Gestión notarial completa.",
    pro_detalle_producto: { etiquetas: ["notaria", "poder especial"] },
    variantes: [
      {
        var_nombre: "Otorgamiento de Poder Especial Notarial",
        var_precio: 60,
        var_detalle_variante: { descripcion_corta: "Para venta de vehículo, cobro de pensión, trámites bancarios o IESS." },
      },
    ],
  },
  {
    pro_id: "p-salida",
    pro_slug: "permiso-salida",
    pro_nombre: "Autorización de Salida del País de Menores",
    pro_descripcion: "Trámite notarial integral de autorización de salida del país para menores.",
    pro_detalle_producto: {},
    variantes: [{ var_nombre: "Trámite Integral de Salida de Menores", var_precio: 80 }],
  },
  {
    pro_id: "p-divorcio",
    pro_slug: "divorcio-mutuo-acuerdo",
    pro_nombre: "Patrocinio de Divorcio por Mutuo Acuerdo",
    pro_descripcion: "Divorcio notarial cuando ambas partes están de acuerdo.",
    pro_detalle_producto: { usos: ["divorcio"] },
    variantes: [{ var_nombre: "Divorcio por Mutuo Acuerdo", var_precio: 450 }],
  },
];

const slugs = (productos: { pro_slug: string }[]) => productos.map((p) => p.pro_slug);

describe("normalizarTextoBusqueda", () => {
  it("quita tildes, pasa a minúsculas y convierte guiones en espacios", () => {
    expect(normalizarTextoBusqueda("Salida del PAÍS")).toBe("salida del pais");
    expect(normalizarTextoBusqueda("permiso-salida_menor")).toBe("permiso salida menor");
    expect(normalizarTextoBusqueda("Compañía")).toBe("compania");
  });

  it("tolera valores que no son texto", () => {
    expect(normalizarTextoBusqueda(undefined)).toBe("");
    expect(normalizarTextoBusqueda(null)).toBe("");
  });
});

describe("palabrasSignificativas", () => {
  it("descarta palabras vacías, letras sueltas, puntuación y repetidas", () => {
    expect(palabrasSignificativas("¿Sacar a mi hijo del país?")).toEqual(["sacar", "hijo", "pais"]);
    expect(palabrasSignificativas("permiso de salida, permiso")).toEqual(["permiso", "salida"]);
  });

  it("un término hecho solo de palabras vacías no deja palabras", () => {
    expect(palabrasSignificativas("de la para el")).toEqual([]);
  });
});

describe("filtrarPorTermino", () => {
  it.each([
    ["permiso de salida"],
    ["permiso salida menor"],
    ["sacar a mi hijo del país"],
    ["salida"],
    ["permiso"],
    ["PERMISO-SALIDA"],
  ])("'%s' encuentra la autorización de salida del país", (termino) => {
    expect(slugs(filtrarPorTermino(PRODUCTOS, termino))).toContain("permiso-salida");
  });

  it("'sacar a mi hijo del país' no arrastra productos sin ninguna palabra en común", () => {
    expect(slugs(filtrarPorTermino(PRODUCTOS, "sacar a mi hijo del país"))).toEqual(["permiso-salida"]);
  });

  it("busca sin tildes en ambos sentidos: 'pension' y 'pensión' encuentran la variante de poder especial", () => {
    expect(slugs(filtrarPorTermino(PRODUCTOS, "pension"))).toEqual(["notarizacion"]);
    expect(slugs(filtrarPorTermino(PRODUCTOS, "pensión"))).toEqual(["notarizacion"]);
  });

  it("ordena por número de palabras coincidentes, con las de mayor puntuación primero", () => {
    // "notarial" está en la notaría (variante), en la salida y en el divorcio (descripción);
    // "salida" y "menores" solo en la autorización de salida.
    const resultado = slugs(filtrarPorTermino(PRODUCTOS, "salida notarial menores"));
    expect(resultado[0]).toBe("permiso-salida");
    expect(resultado).toHaveLength(3);
    expect(resultado).not.toContain("constitucion-sas");
  });

  it("en caso de empate conserva el orden recibido (destacados primero)", () => {
    expect(slugs(filtrarPorTermino(PRODUCTOS, "notarial"))).toEqual(["notarizacion", "permiso-salida", "divorcio-mutuo-acuerdo"]);
  });

  it("sin coincidencias devuelve una lista vacía", () => {
    expect(filtrarPorTermino(PRODUCTOS, "plomería")).toEqual([]);
  });

  it("término vacío o solo palabras vacías: no filtra", () => {
    expect(filtrarPorTermino(PRODUCTOS, "")).toEqual(PRODUCTOS);
    expect(filtrarPorTermino(PRODUCTOS, "   ")).toEqual(PRODUCTOS);
    expect(filtrarPorTermino(PRODUCTOS, "de la")).toEqual(PRODUCTOS);
  });
});

describe("consultar_catalogo por MCP", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  // Solo se simula la RPC de validación del token; los productos llegan por consultarProductos.
  function crearManejador() {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: async () => ({ valido: true, negocio_id: "tranqi", alcances: ["catalogo:leer"] }),
      }),
    );
    return crearServidorMcpCatalogo({
      negocioPorDefecto: "tranqi",
      supabaseUrl: "https://prueba.supabase.co",
      supabaseAnonKey: "clave",
      consultarProductos: async () => PRODUCTOS,
    });
  }

  async function consultar(argumentos: Record<string, unknown>) {
    const respuesta = await crearManejador()(
      new Request("https://tranqi.test/api/mcp/catalogo", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer eco_live_prueba" },
        body: JSON.stringify({
          jsonrpc: "2.0",
          id: 1,
          method: "tools/call",
          params: { name: "consultar_catalogo", arguments: argumentos },
        }),
      }),
    );
    const cuerpo = await respuesta.json();
    return JSON.parse(cuerpo.result.content[0].text);
  }

  it("una frase natural devuelve el producto con más coincidencias primero", async () => {
    const resultado = await consultar({ termino: "permiso de salida del país para mi hijo menor" });
    expect(resultado.total_encontrados).toBeGreaterThan(0);
    expect(resultado.productos[0].slug).toBe("permiso-salida");
  });

  it("sin término devuelve todo el catálogo, en el orden original", async () => {
    const resultado = await consultar({});
    expect(resultado.productos.map((p: { slug: string }) => p.slug)).toEqual(slugs(PRODUCTOS));
  });
});
