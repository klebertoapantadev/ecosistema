// Árbol XML mínimo con serialización en forma canónica (C14N inclusivo
// 20010315, sin comentarios).
//
// Por qué no un DOM + una librería de C14N: en Deno no hay ninguna fiable y la
// firma XAdES del SRI necesita el C14N exacto de tres fragmentos. Si el propio
// documento se escribe ya en forma canónica, el C14N de cualquier subárbol es
// su serialización más los xmlns heredados de los ancestros, y eso es lo que
// hace canonico(). Reglas aplicadas (W3C C14N 1.0):
//   - sin declaración XML; elementos vacíos como <a></a>, nunca <a/>;
//   - primero los xmlns (por prefijo, el de por defecto antes) y luego los
//     atributos por nombre (aquí ningún atributo lleva namespace);
//   - escapes de texto: & < > \r · de atributo: & < " \t \n \r;
//   - en el elemento raíz del fragmento se emiten todos los xmlns en ámbito;
//     en los descendientes, solo los que cambian respecto al ancestro.

export type Nodo = Elemento | string;

export interface Elemento {
  nombre: string;
  atributos: Record<string, string>;
  /** Declaraciones xmlns propias: prefijo ("" = por defecto) → URI. */
  espacios: Record<string, string>;
  hijos: Nodo[];
}

/** Crea un elemento. Los hijos null/undefined/false se descartan (opcionales). */
export function el(
  nombre: string,
  atributos: Record<string, string> = {},
  ...hijos: (Nodo | null | undefined | false)[]
): Elemento {
  return {
    nombre,
    atributos,
    espacios: {},
    hijos: hijos.filter((h): h is Nodo => h !== null && h !== undefined && h !== false),
  };
}

/** Elemento con solo texto, o null si el valor es null/undefined (para opcionales). */
export function texto(nombre: string, valor: string | null | undefined): Elemento | null {
  if (valor === null || valor === undefined) return null;
  return el(nombre, {}, valor);
}

export function conEspacio(elemento: Elemento, prefijo: string, uri: string): Elemento {
  elemento.espacios[prefijo] = uri;
  return elemento;
}

function escaparTexto(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/\r/g, "&#xD;");
}

function escaparAtributo(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;")
    .replace(/\t/g, "&#x9;")
    .replace(/\n/g, "&#xA;")
    .replace(/\r/g, "&#xD;");
}

// Orden por puntos de código, como exige C14N (no localeCompare).
function porCodigo(a: string, b: string): number {
  return a < b ? -1 : a > b ? 1 : 0;
}

/**
 * Forma canónica del elemento. `heredados` son los xmlns en ámbito declarados
 * por sus ancestros (prefijo → URI); se emiten en este elemento.
 */
export function canonico(elemento: Elemento, heredados: Record<string, string> = {}): string {
  return serializar(elemento, heredados, {});
}

function serializar(
  e: Elemento,
  enAmbito: Record<string, string>,
  emitidos: Record<string, string>,
): string {
  const ambito = { ...enAmbito, ...e.espacios };
  // xmlns a emitir: los del ámbito que el ancestro de salida no emitió ya con el mismo valor.
  const declarar = Object.keys(ambito)
    .filter((p) => emitidos[p] !== ambito[p])
    .sort(porCodigo);
  const nuevosEmitidos = { ...emitidos };
  let salida = "<" + e.nombre;
  for (const p of declarar) {
    salida += (p === "" ? " xmlns" : " xmlns:" + p) + '="' + escaparAtributo(ambito[p]) + '"';
    nuevosEmitidos[p] = ambito[p];
  }
  for (const nombre of Object.keys(e.atributos).sort(porCodigo)) {
    salida += " " + nombre + '="' + escaparAtributo(e.atributos[nombre]) + '"';
  }
  salida += ">";
  for (const hijo of e.hijos) {
    salida += typeof hijo === "string" ? escaparTexto(hijo) : serializar(hijo, ambito, nuevosEmitidos);
  }
  return salida + "</" + e.nombre + ">";
}

/** Documento completo: declaración UTF-8 + raíz canónica. */
export function documento(raiz: Elemento): string {
  return '<?xml version="1.0" encoding="UTF-8"?>' + canonico(raiz);
}
