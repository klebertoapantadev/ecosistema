import { describe, expect, it } from "vitest";
import type { VarianteCatalogo } from "@eco/comercio";
import { detectarTramite } from "./deteccion";
import type { OpcionTramite, TramiteCatalogo } from "./esquema";

function opcion(id: string, nombre: string, concepto: string | null): OpcionTramite {
  return { variante: { var_id: id } as VarianteCatalogo, nombre, descripcion: null, concepto };
}

// Forma real del catálogo de tranqi (categoría «tramites», 28-nov-2026).
const NOTARIZACION: TramiteCatalogo = {
  productoId: "p-not",
  slug: "notarizacion",
  nombre: "Notarización de Documentos & Poderes",
  descripcion: null,
  tiempoEntrega: "24 a 48 horas hábiles",
  requisitos: [],
  etiquetas: ["notaria", "poder notarial", "escritura", "declaracion juramentada", "poder especial"],
  opciones: [
    opcion("v-gen", "Notarización y Gestión en Notaría", null),
    opcion("v-dj", "Declaración Juramentada", "DECLARACION_JURAMENTADA"),
    opcion("v-uh", "Declaración Notarial de Unión de Hecho", "UNION_DE_HECHO"),
    opcion("v-pe", "Otorgamiento de Poder Especial Notarial", "PODER_ESPECIAL"),
    opcion("v-pg", "Otorgamiento de Poder General Notarial", "PODER_GENERAL"),
    opcion("v-rf", "Reconocimiento de Firmas", "RECONOCIMIENTO_FIRMA"),
  ],
};
const SALIDA: TramiteCatalogo = {
  productoId: "p-sal",
  slug: "permiso-salida",
  nombre: "Autorización de Salida del País de Menores",
  descripcion: null,
  tiempoEntrega: null,
  requisitos: [],
  etiquetas: [],
  opciones: [opcion("v-sal", "Trámite Integral de Salida de Menores", null)],
};
const CATALOGO = [NOTARIZACION, SALIDA];

const detectar = (texto: string) => detectarTramite(texto, CATALOGO)?.opcionId ?? null;

describe("detectarTramite", () => {
  it("«sacar la escritura de la notaría» (ejemplo de negocio) es un trámite notarial", () => {
    expect(detectar("Quiero sacar la escritura de la notaría")).toBe("v-gen");
  });

  it("elige la opción concreta cuando la nombra", () => {
    expect(detectar("Necesito una declaración juramentada para el banco")).toBe("v-dj");
    expect(detectar("Quiero hacer un poder para que mi hermano venda mi carro")).toBe("v-pe");
    expect(detectar("Necesito un poder general para mi esposa")).toBe("v-pg");
    expect(detectar("Reconocimiento de firma de un contrato de arriendo")).toBe("v-rf");
    expect(detectar("Queremos legalizar nuestra unión de hecho")).toBe("v-uh");
  });

  it("reconoce la salida de menores aunque no diga «trámite»", () => {
    expect(detectar("Mi hijo va a viajar con su abuela a España")).toBe("v-sal");
    expect(detectar("Necesito el permiso de salida del país")).toBe("v-sal");
  });

  it("si pide un abogado o es un conflicto, no es un trámite", () => {
    expect(detectar("Quiero una cita con abogado")).toBeNull();
    expect(detectar("Necesito revisar una herencia, terreno o escrituras")).toBeNull();
    expect(detectar("Me despidieron y quiero mi liquidación")).toBeNull();
    expect(detectar("Mi ex no me deja ver a mi hijo y no paga la pensión")).toBeNull();
  });

  it("sin trámites en el catálogo no detecta nada", () => {
    expect(detectarTramite("Quiero sacar la escritura de la notaría", [])).toBeNull();
  });

  it("usa las etiquetas del catálogo como último recurso", () => {
    expect(detectar("tengo que ir a la notaria por un documento")).toBe("v-gen");
  });
});
