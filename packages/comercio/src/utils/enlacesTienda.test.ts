import { describe, expect, it } from "vitest";
import {
  construirEnlaceCategoriaTienda,
  construirEnlaceProductoTienda,
  interpretarEnlaceTienda,
} from "./enlacesTienda";

describe("enlacesTienda (Deep Links para WhatsApp y Chat Web)", () => {
  it("genera enlaces limpios de categoría y catálogo general", () => {
    expect(
      construirEnlaceCategoriaTienda({
        negocio: "tinkay",
        slugCategoria: "Eventos y Ceremonias",
        baseUrl: "https://tinkay-web.vercel.app",
      })
    ).toBe("https://tinkay-web.vercel.app/categoria/eventos-y-ceremonias");

    expect(
      construirEnlaceCategoriaTienda({
        negocio: "tinkay",
        slugCategoria: "cat-todos",
        baseUrl: "https://tinkay-web.vercel.app",
      })
    ).toBe("https://tinkay-web.vercel.app/#catalogo");
  });

  it("genera enlaces limpios de producto con y sin variante específica", () => {
    expect(
      construirEnlaceProductoTienda({
        negocio: "tinkay",
        slugProducto: "cartel-bienvenida",
        baseUrl: "https://tinkay-web.vercel.app",
      })
    ).toBe("https://tinkay-web.vercel.app/producto/cartel-bienvenida");

    expect(
      construirEnlaceProductoTienda({
        negocio: "tinkay",
        slugProducto: "tinkay-abanico-monumental",
        skuVariante: "TNK-ABA-XL",
        baseUrl: "https://tinkay-web.vercel.app",
      })
    ).toBe("https://tinkay-web.vercel.app/producto/tinkay-abanico-monumental?variante=TNK-ABA-XL");
  });

  it("interpreta tanto rutas limpias (/categoria, /producto) como query params (?categoria, ?producto)", () => {
    expect(
      interpretarEnlaceTienda(
        "https://tinkay-web.vercel.app/categoria/eventos",
        "https://tinkay-web.vercel.app"
      )
    ).toEqual({
      tipo: "categoria",
      categoria: "eventos",
    });

    expect(
      interpretarEnlaceTienda(
        "https://tinkay-web.vercel.app/producto/cartel-bienvenida?variante=SKU-1",
        "https://tinkay-web.vercel.app"
      )
    ).toEqual({
      tipo: "producto",
      producto: "cartel-bienvenida",
      variante: "SKU-1",
    });

    expect(
      interpretarEnlaceTienda(
        "https://tinkay-web.vercel.app/?categoria=eventos-y-ceremonias",
        "https://tinkay-web.vercel.app"
      )
    ).toEqual({
      tipo: "categoria",
      categoria: "eventos-y-ceremonias",
    });

    expect(
      interpretarEnlaceTienda("https://maps.app.goo.gl/D56gQohzuwha4sLf8")
    ).toEqual({
      tipo: "externo",
    });
  });
});

