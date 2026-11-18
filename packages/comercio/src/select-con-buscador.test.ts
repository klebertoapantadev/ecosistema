import React from "react";
import { describe, expect, it } from "vitest";
import {
  extraerOpcionesDeChildrenSelect,
  filtrarOpcionesSelectPorBusqueda,
  normalizarTextoBusquedaSelect,
} from "@eco/datagrid";

describe("SelectConBuscador — extracción y búsqueda sin acentos", () => {
  it("normaliza acentos, mayúsculas y espacios múltiples", () => {
    expect(normalizarTextoBusquedaSelect("  Orquídeas   Blancas  XL ")).toBe(
      "orquideas blancas xl"
    );
  });

  it("extrae opciones anidadas en fragmentos y optgroup", () => {
    const nodos = React.createElement(
      React.Fragment,
      null,
      React.createElement("option", { value: "" }, "-- Seleccionar producto --"),
      React.createElement(
        "optgroup",
        { label: "Condolencias" },
        React.createElement("option", { value: "cor-xl" }, "Corona XL (Solo Rosas) — $120.00"),
        React.createElement("option", { value: "orq-2" }, "Detalle Orquídeas — $25.00")
      )
    );

    const opciones = extraerOpcionesDeChildrenSelect(nodos);
    expect(opciones).toHaveLength(3);
    expect(opciones[1]).toMatchObject({
      value: "cor-xl",
      label: "Corona XL (Solo Rosas) — $120.00",
      grupo: "Condolencias",
    });

    const filtradas = filtrarOpcionesSelectPorBusqueda(opciones, "orquideas 25");
    expect(filtradas).toHaveLength(1);
    expect(filtradas[0]?.value).toBe("orq-2");
  });
});
