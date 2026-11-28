/**
 * Motor puro de Depuración 2D de Agenda Telefónica (PLT-010 Fase 3):
 * - Parseo completo preservando todos los campos (TEL[], EMAIL[], ORG, TITLE, ADR, BDAY, NOTE, CATEGORIES).
 * - Estandarización de teléfonos E.164 (compacto o legible) + corrección pre-2012 Ecuador (08/09 de 9 dígitos).
 * - Limpieza de caracteres invisibles/símbolos basura y normalización opcional de mayúsculas.
 * - Fusión 2D (Union-Find): por teléfono compartido + opcionalmente por persona/nombre similar.
 * - Exportadores nativos: CSV oficial de Google Contacts, vCard 3.0 UTF-8 (.vcf) y hojas de auditoría Excel.
 *
 * Sin dependencias de `next/*` para portabilidad total (web, tests y Capacitor).
 */

import {
  clasificarContactoAutomaticamente,
  coincidePatronContacto,
  normalizarTelefonoE164Contacto,
  REGLAS_CLASIFICACION_DEFECTO,
  ultimos9TelefonoContacto,
  type ClasificacionContacto,
  type PoliticaIaContacto,
  type ReglasClasificacionContactos,
  type VisibilidadContacto,
} from "./contactos-omnicanal";

export type FormatoTelefonoAgenda = "E164_COMPACTO" | "E164_LEGIBLE";

export type TipoTelefonoAgenda = "CELL" | "HOME" | "WORK" | "OTHER";

export interface TelefonoFichaAgenda {
  valorE164: string;
  valorFormateado: string;
  valorOriginal: string;
  tipo: TipoTelefonoAgenda;
  fueCorregido: boolean;
  fuePre2012Ecuador: boolean;
}

export interface FichaAgendaCruda {
  idLocal: string;
  origen: "VCF" | "CSV" | "XLSX" | "GOOGLE_CONTACTS";
  etiquetaFuente?: string | null;
  googleResourceName?: string | null;
  googleEtag?: string | null;
  nombreOriginal: string;
  telefonos: Array<{ valor: string; tipo?: string | null }>;
  correos: string[];
  empresa?: string | null;
  cargo?: string | null;
  direccion?: string | null;
  cumpleanos?: string | null;
  notas?: string | null;
  fotoUrl?: string | null;
  etiquetas: string[];
  esAgendaPersonal?: boolean;
}

export interface OpcionesDepuradorAgenda {
  formatoTelefono: FormatoTelefonoAgenda;
  fusionarPorNombreSimilar: boolean;
  limpiarSimbolosInicio: boolean;
  normalizarMayusculas: boolean;
  quitarEmojis: boolean;
  guardarAliasEnNotas: boolean;
  asignarEtiquetasCategoria: boolean;
  excluirSinTelefono: boolean;
  patronesExcluir: string[];
  reglasClasificacion: ReglasClasificacionContactos;
}

export const OPCIONES_DEPURADOR_DEFECTO: OpcionesDepuradorAgenda = {
  formatoTelefono: "E164_LEGIBLE",
  fusionarPorNombreSimilar: true,
  limpiarSimbolosInicio: true,
  normalizarMayusculas: false,
  quitarEmojis: false,
  guardarAliasEnNotas: true,
  asignarEtiquetasCategoria: true,
  excluirSinTelefono: true,
  patronesExcluir: [],
  reglasClasificacion: REGLAS_CLASIFICACION_DEFECTO,
};

export interface FichaAgendaDepurada {
  id: string;
  nombreOriginalPrincipal: string;
  nombreLimpio: string;
  nombresCandidatos: string[];
  tieneConflictoNombre: boolean;
  nombreFueLimpiado: boolean;
  telefonos: TelefonoFichaAgenda[];
  algunTelefonoCorregido: boolean;
  algunTelefonoPre2012: boolean;
  correos: string[];
  empresa: string | null;
  cargo: string | null;
  direccion: string | null;
  cumpleanos: string | null;
  notas: string | null;
  fotoUrl: string | null;
  etiquetasOriginales: string[];
  etiquetaCategoriaGoogle: string;
  clasificacion: ClasificacionContacto;
  politicaIa: PoliticaIaContacto;
  visibilidad: VisibilidadContacto;
  motivoClasificacion: string;
  fichasOrigen: FichaAgendaCruda[];
  motivoFusion: "NINGUNA" | "MISMO_TELEFONO" | "MISMA_PERSONA" | "TELEFONO_Y_PERSONA";
  googleResourceNamePrincipal: string | null;
  googleEtagPrincipal: string | null;
  googleResourceNamesDuplicados: string[];
  cambiosResumen: string[];
  seleccionado: boolean;
}

export interface FichaAgendaExcluida {
  ficha: FichaAgendaCruda;
  motivo: string;
}

export interface ResumenDepuracionAgenda {
  totalFichasOriginales: number;
  totalFichasDepuradas: number;
  duplicadosEliminados: number;
  fichasFusionadas: number;
  fusionesPorTelefono: number;
  fusionesPorNombre: number;
  telefonosEstandarizados: number;
  telefonosPre2012Corregidos: number;
  nombresLimpiados: number;
  excluidosPorRegla: number;
  excluidosSinTelefono: number;
  porCategoria: {
    clientes: number;
    clientesEventos: number;
    personales: number;
    proveedores: number;
    equipo: number;
  };
}

const SIGLAS_PRESERVAR = new Set([
  "BPAC",
  "PBO",
  "VIP",
  "GM",
  "NTC",
  "MF",
  "JP",
  "SRI",
  "UIO",
  "GYE",
  "USA",
  "BOT",
  "II",
  "III",
  "IV",
  "S.A.",
  "S.A.S.",
  "CIA",
  "LTDA",
  "ECU",
  "GPS",
  "TV",
  "IA",
  "WA",
  "CRM",
  "UCE",
  "CMB",
  "PYCH",
  "LUX",
  "GT",
  "TG",
  "JR",
]);

const PALABRAS_GENERICAS_NO_FUSIONAR_POR_NOMBRE = new Set([
  "cliente",
  "clientes",
  "cliente girasoles",
  "cliente rosas",
  "cliente face",
  "cliente flores",
  "cliente flores quito",
  "proveedor",
  "proveedor rosas",
  "proveedor de rosas",
  "proveedor girasoles",
  "proveedor de girasoles",
  "proveedor bases",
  "proveedor follaje",
  "proveedor de tulipanes",
  "finca",
  "restaurante",
  "uber",
  "uber moto",
  "taxi",
  "maestro",
  "maestro albanil",
  "maestro plomero",
  "maestro electricista",
  "contacto",
  "eventos",
  "evento",
  "floristeria",
  "clinica dental",
  "empresa electrica",
  "servientrega",
  "entregas quito",
  "cajas de madera",
  "cajas de carton",
  "familia",
  "mama",
  "papa",
  "mamita",
]);

function normalizarTextoBase(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

function decodificarQuotedPrintable(entrada: string): string {
  const sinSoft = entrada.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < sinSoft.length; i++) {
    const ch = sinSoft[i]!;
    if (ch === "=" && i + 2 < sinSoft.length) {
      const hex = sinSoft.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    const code = sinSoft.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      const enc = new TextEncoder().encode(ch);
      for (const b of enc) bytes.push(b);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return sinSoft;
  }
}

function limpiarValorVcf(valor: string, params: string): string {
  let texto = valor;
  if (/ENCODING=QUOTED-PRINTABLE/i.test(params)) {
    texto = decodificarQuotedPrintable(texto);
  }
  return texto
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

function normalizarTipoTelefono(raw?: string | null): TipoTelefonoAgenda {
  const up = String(raw ?? "").toUpperCase();
  if (up.includes("CELL") || up.includes("MOBILE") || up.includes("MOVIL") || up.includes("MÓVIL") || up.includes("WHATSAPP")) {
    return "CELL";
  }
  if (up.includes("WORK") || up.includes("TRABAJO") || up.includes("OFICINA")) return "WORK";
  if (up.includes("HOME") || up.includes("CASA")) return "HOME";
  return "CELL";
}

/**
 * Estandariza un número telefónico a E.164 compacto (`+593991234567`) o legible (`+593 99 123 4567`),
 * detectando correcciones reales y celulares ecuatorianos pre-2012 (9 dígitos `08/09XXXXXXX`).
 */
export function formatearTelefonoEstandar(
  raw: string,
  formato: FormatoTelefonoAgenda = "E164_LEGIBLE",
  tipoRaw?: string | null
): TelefonoFichaAgenda | null {
  const original = String(raw ?? "").trim();
  if (!original) return null;

  const digitosRaw = original.replace(/\D+/g, "");
  const fuePre2012Ecuador = /^0[89]\d{7}$/.test(digitosRaw);

  const e164 = normalizarTelefonoE164Contacto(original);
  if (!e164) return null;

  let valorFormateado = e164;
  if (formato === "E164_LEGIBLE") {
    if (/^\+5939\d{8}$/.test(e164)) {
      // +593 99 123 4567
      valorFormateado = `${e164.slice(0, 4)} ${e164.slice(4, 6)} ${e164.slice(6, 9)} ${e164.slice(9)}`;
    } else if (/^\+593[2-7]\d{7}$/.test(e164)) {
      // +593 2 245 6789
      valorFormateado = `${e164.slice(0, 4)} ${e164.slice(4, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
    } else if (/^\+1\d{10}$/.test(e164)) {
      // +1 305 555 0199
      valorFormateado = `${e164.slice(0, 2)} ${e164.slice(2, 5)} ${e164.slice(5, 8)} ${e164.slice(8)}`;
    } else if (/^\+(34|51|57|58|52|56|54|55)\d{9,10}$/.test(e164)) {
      const cc = e164.slice(0, 3);
      const rest = e164.slice(3);
      valorFormateado = `${cc} ${rest.slice(0, 3)} ${rest.slice(3, 6)} ${rest.slice(6)}`.trim();
    } else if (/^\+(507|506|502|503|504|505)\d{7,8}$/.test(e164)) {
      const cc = e164.slice(0, 4);
      const rest = e164.slice(4);
      valorFormateado = `${cc} ${rest.slice(0, 4)} ${rest.slice(4)}`.trim();
    }
  }

  const fueCorregido = original !== valorFormateado;
  return {
    valorE164: e164,
    valorFormateado,
    valorOriginal: original,
    tipo: normalizarTipoTelefono(tipoRaw),
    fueCorregido,
    fuePre2012Ecuador,
  };
}

/**
 * Limpia un nombre de contacto eliminando caracteres invisibles Unicode (ej. espacio Braille `\u2800`),
 * símbolos basura iniciales/finales y opcionalmente emojis o mayúsculas inconsistentes.
 */
export function limpiarNombreContacto(
  raw: string,
  opciones: Pick<
    OpcionesDepuradorAgenda,
    "limpiarSimbolosInicio" | "normalizarMayusculas" | "quitarEmojis"
  >
): { nombre: string; fueLimpiado: boolean } {
  const original = String(raw ?? "").trim();
  let texto = original;

  // Siempre eliminar caracteres de control e invisibles (Braille blank \u2800, ZWSP, BOM, NBSP)
  // Preservando \u200D (ZWJ) para no romper emojis compuestos como 👩🏻‍⚕️ cuando quitarEmojis = false
  texto = texto
    .replace(/[\u2800\u200B\u200C\u200E\u200F\u202A-\u202E\u2060\uFEFF]/g, " ")
    .replace(/\u00A0/g, " ");

  if (opciones.quitarEmojis) {
    texto = texto.replace(
      /[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu,
      " "
    );
  }

  if (opciones.limpiarSimbolosInicio) {
    // Quitar prefijos basura frecuentes en agendas: "::: Paul :::", ".Aaa Nombre", "# Nombre"
    texto = texto
      .replace(/^[\s.:;#*_~•·\-–—'"«»()[\]{}]+/, "")
      .replace(/[\s:;#*_~•·]+$/, "")
      .replace(/^aaa\s+/i, "");
  }

  texto = texto.replace(/\s+/g, " ").trim();

  if (opciones.normalizarMayusculas && texto) {
    const conectores = new Set(["de", "del", "la", "las", "el", "los", "y", "e", "en", "a", "con", "por", "para"]);
    texto = texto
      .split(" ")
      .map((palabra, idx) => {
        const limpiaMayus = palabra.toUpperCase();
        if (SIGLAS_PRESERVAR.has(limpiaMayus)) return limpiaMayus;
        const lower = palabra.toLowerCase();
        if (idx > 0 && conectores.has(lower)) return lower;
        // Preservar emojis/signos iniciales y capitalizar primera letra
        return lower.replace(/(^|[-/(])([\p{L}])/u, (_, pref: string, letra: string) => `${pref}${letra.toUpperCase()}`);
      })
      .join(" ");
  }

  const final = texto || original;
  return {
    nombre: final,
    fueLimpiado: final !== original,
  };
}

function esNombreGenericoSoloNumero(nombre: string): boolean {
  const n = nombre.trim();
  return !n || /^(contacto|whatsapp|cliente)?\s*\+?\d[\d\s-]{6,}$/i.test(n);
}

/**
 * Genera una clave conservadora de persona para fusionar 2 fichas con DISTINTO teléfono que pertenecen
 * a la misma persona (ej. "Alejandro Tipantuña" + "Alejandro Tipantuña Nuevo", o "Mamita Bella..." con 3 líneas).
 * Devuelve `null` si el nombre es demasiado corto o genérico para evitar falsas fusiones.
 */
export function claveNombreParaFusionPersona(nombre: string): string | null {
  if (!nombre || esNombreGenericoSoloNumero(nombre)) return null;

  let base = nombre
    .replace(/[\u2800\u200B-\u200F\uFEFF]/g, " ")
    .replace(/[\p{Extended_Pictographic}\u{1F3FB}-\u{1F3FF}\uFE0F\u200D]/gu, " ")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  if (!base) return null;

  // Quitar sufijos frecuentes de segundo número ("nuevo", "ok", "cel", "whatsapp", "2", "actual", "personal")
  const sinSufijo = base
    .replace(/\s+(nuevo|nueva|ok|cel|celular|movil|whatsapp|actual|numero\s*2|num\s*2|2|3)$/i, "")
    .trim();
  if (sinSufijo.split(" ").length >= 2 && sinSufijo.length >= 10) {
    base = sinSufijo;
  }

  // Exigir mínimo 2 palabras sustantivas y longitud >= 10, sin números secuenciales (ej. "Eventos 1" vs "Eventos 2")
  const tokens = base.split(" ").filter((t) => t.length >= 2);
  if (tokens.length < 2 || base.length < 10) return null;
  if (/\d/.test(base)) return null;
  if (PALABRAS_GENERICAS_NO_FUSIONAR_POR_NOMBRE.has(base)) return null;
  if (/^(cliente|proveedor|uber|eventos?|maestro|mensajero|local)\s+[a-z]{1,12}$/.test(base)) {
    return null;
  }

  return base;
}

/**
 * Parsea un archivo `.vcf` completo a `FichaAgendaCruda[]` preservando todos los campos y teléfonos.
 */
export function parsearVcfAFichasAgenda(
  textoVcf: string,
  meta: { etiquetaFuente?: string | null; esAgendaPersonal?: boolean } = {}
): FichaAgendaCruda[] {
  if (!textoVcf || !textoVcf.trim()) return [];

  const normalizado = textoVcf
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\n[ \t]/g, "");

  const bloques = normalizado.split(/BEGIN:VCARD/i).slice(1);
  const fichas: FichaAgendaCruda[] = [];

  for (let idx = 0; idx < bloques.length; idx++) {
    const bloqueRaw = bloques[idx]!;
    const finIdx = bloqueRaw.search(/END:VCARD/i);
    const cuerpo = finIdx >= 0 ? bloqueRaw.slice(0, finIdx) : bloqueRaw;
    const lineas = cuerpo.split("\n");

    let fn = "";
    let nombreN = "";
    let org = "";
    let title = "";
    let adr = "";
    let bday = "";
    const notasArr: string[] = [];
    const correos: string[] = [];
    const etiquetas: string[] = [];
    const telefonos: Array<{ valor: string; tipo?: string | null }> = [];

    for (const linea of lineas) {
      const idxSep = linea.indexOf(":");
      if (idxSep <= 0) continue;

      const cabeza = linea.slice(0, idxSep).trim();
      const valorRaw = linea.slice(idxSep + 1).trim();
      if (!valorRaw) continue;

      const cabezaSinGrupo = cabeza.replace(/^[a-z0-9_-]+\./i, "");
      const [claveRaw, ...paramsResto] = cabezaSinGrupo.split(";");
      const clave = (claveRaw || "").toUpperCase();
      const params = paramsResto.join(";");

      if (clave === "FN" && !fn) {
        fn = limpiarValorVcf(valorRaw, params);
      } else if (clave === "N" && !nombreN) {
        const partes = valorRaw
          .split(";")
          .map((p) => limpiarValorVcf(p, params))
          .filter(Boolean);
        if (partes.length >= 2) {
          nombreN = `${partes[1]} ${partes[0]}`.trim();
        } else if (partes.length === 1) {
          nombreN = partes[0]!;
        }
      } else if (clave === "ORG" && !org) {
        org = limpiarValorVcf(valorRaw.replace(/;+/g, " "), params);
      } else if (clave === "TITLE" && !title) {
        title = limpiarValorVcf(valorRaw, params);
      } else if (clave === "ADR" && !adr) {
        const partesAdr = valorRaw
          .split(";")
          .map((p) => limpiarValorVcf(p, params))
          .filter(Boolean);
        adr = partesAdr.join(", ");
      } else if (clave === "BDAY" && !bday) {
        bday = limpiarValorVcf(valorRaw, params);
      } else if (clave === "NOTE") {
        const n = limpiarValorVcf(valorRaw, params);
        if (n) notasArr.push(n);
      } else if (clave === "EMAIL") {
        const em = limpiarValorVcf(valorRaw, params).toLowerCase();
        if (em.includes("@") && !correos.includes(em)) correos.push(em);
      } else if (clave === "CATEGORIES") {
        const cats = limpiarValorVcf(valorRaw, params)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        for (const c of cats) {
          if (!etiquetas.includes(c)) etiquetas.push(c);
        }
      } else if (clave === "TEL") {
        const tel = limpiarValorVcf(valorRaw, params);
        if (tel) telefonos.push({ valor: tel, tipo: params || "CELL" });
      }
    }

    const nombreFinal = fn || nombreN || org || "";
    if (!nombreFinal && telefonos.length === 0 && correos.length === 0) continue;

    fichas.push({
      idLocal: `vcf-${idx + 1}`,
      origen: "VCF",
      etiquetaFuente: meta.etiquetaFuente ?? "Archivo vCard (.vcf)",
      nombreOriginal: nombreFinal,
      telefonos,
      correos,
      empresa: org || null,
      cargo: title || null,
      direccion: adr || null,
      cumpleanos: bday || null,
      notas: notasArr.length > 0 ? notasArr.join(" · ") : null,
      etiquetas,
      esAgendaPersonal: meta.esAgendaPersonal !== false,
    });
  }

  return fichas;
}

/**
 * Parsea filas de CSV / Excel (incluyendo CSV nativo de Google Contacts) a `FichaAgendaCruda[]`.
 */
export function parsearTablaAFichasAgenda(
  filas: Array<Record<string, unknown>>,
  origen: "CSV" | "XLSX",
  meta: { etiquetaFuente?: string | null; esAgendaPersonal?: boolean } = {}
): FichaAgendaCruda[] {
  const fichas: FichaAgendaCruda[] = [];

  for (let idx = 0; idx < filas.length; idx++) {
    const fila = filas[idx]!;
    const mapa = new Map<string, string>();
    for (const [k, v] of Object.entries(fila)) {
      const val = String(v ?? "").trim();
      if (val) mapa.set(normalizarTextoBase(k), val);
    }

    const buscar = (claves: string[]) => {
      for (const c of claves) {
        const encontrado = mapa.get(c);
        if (encontrado) return encontrado;
      }
      return "";
    };

    const nombreCompleto =
      buscar(["name", "nombre", "nombre consolidado", "nombre_consolidado", "full name", "display name", "contacto"]) ||
      [
        buscar(["first name", "given name", "nombres", "primer nombre"]),
        buscar(["middle name", "additional name"]),
        buscar(["last name", "family name", "apellidos", "apellido"]),
      ]
        .filter(Boolean)
        .join(" ")
        .trim();

    const empresa = buscar(["organization 1 - name", "organization name", "empresa", "company", "org"]);
    const cargo = buscar(["organization 1 - title", "organization title", "cargo", "title"]);
    const direccion = buscar(["address 1 - formatted", "direccion", "address"]);
    const cumpleanos = buscar(["birthday", "cumpleanos", "fecha nacimiento"]);
    const notas = buscar(["notes", "notas", "nota", "observaciones", "motivo"]);

    const etiquetas: string[] = [];
    const gruposRaw = buscar(["group membership", "etiquetas", "grupos", "labels", "categories"]);
    if (gruposRaw) {
      for (const g of gruposRaw.split(/:::|,|;/)) {
        const limpio = g.replace(/^\*\s*/, "").trim();
        if (limpio && limpio.toLowerCase() !== "mycontacts" && !etiquetas.includes(limpio)) {
          etiquetas.push(limpio);
        }
      }
    }

    const correos: string[] = [];
    const telefonos: Array<{ valor: string; tipo?: string | null }> = [];
    for (const [k, v] of mapa.entries()) {
      if (k.includes("mail") || k.includes("correo")) {
        for (const em of v.split(/:::|,|;/)) {
          const limpio = em.trim().toLowerCase();
          if (limpio.includes("@") && !correos.includes(limpio)) correos.push(limpio);
        }
      }
      if (
        (k.includes("phone") && !k.includes("type")) ||
        k.includes("tel") ||
        k.includes("whatsapp") ||
        k.includes("celular") ||
        k.includes("movil")
      ) {
        for (const t of v.split(/:::|;|\|/)) {
          const limpio = t.trim();
          if (limpio) telefonos.push({ valor: limpio, tipo: "CELL" });
        }
      }
    }

    const nombreFinal = nombreCompleto || empresa || "";
    if (!nombreFinal && telefonos.length === 0 && correos.length === 0) continue;

    fichas.push({
      idLocal: `${origen.toLowerCase()}-${idx + 1}`,
      origen,
      etiquetaFuente: meta.etiquetaFuente ?? `Archivo ${origen}`,
      nombreOriginal: nombreFinal,
      telefonos,
      correos,
      empresa: empresa || null,
      cargo: cargo || null,
      direccion: direccion || null,
      cumpleanos: cumpleanos || null,
      notas: notas || null,
      etiquetas,
      esAgendaPersonal: meta.esAgendaPersonal !== false,
    });
  }

  return fichas;
}

function resolverEtiquetaGoogle(
  clasificacion: ClasificacionContacto,
  motivoClasificacion: string
): string {
  if (clasificacion === "CLIENTE") {
    return /evento|boda/i.test(motivoClasificacion) ? "Clientes Eventos" : "Clientes";
  }
  if (clasificacion === "PROVEEDOR") return "Proveedores";
  if (clasificacion === "EQUIPO_INTERNO") return "Equipo";
  if (clasificacion === "BLOQUEADO_SPAM") return "Bloqueados";
  return "Personal";
}

function construirFichaDepuradaDesdeGrupo(
  grupoFichas: FichaAgendaCruda[],
  motivoFusion: FichaAgendaDepurada["motivoFusion"],
  opciones: OpcionesDepuradorAgenda,
  indiceGrupo: number
): FichaAgendaDepurada {
  // 1. Teléfonos únicos deduplicados por últimos 9 dígitos
  const mapaTels = new Map<string, TelefonoFichaAgenda>();
  for (const f of grupoFichas) {
    for (const t of f.telefonos) {
      const est = formatearTelefonoEstandar(t.valor, opciones.formatoTelefono, t.tipo);
      if (!est) continue;
      const u9 = ultimos9TelefonoContacto(est.valorE164);
      if (!u9 || u9.length < 7) continue;
      const existente = mapaTels.get(u9);
      if (!existente) {
        mapaTels.set(u9, est);
      } else {
        // Preferir versión con +593 completo más largo o no corregida si igual
        if (est.valorE164.length > existente.valorE164.length) {
          mapaTels.set(u9, {
            ...est,
            fueCorregido: est.fueCorregido || existente.fueCorregido,
            fuePre2012Ecuador: est.fuePre2012Ecuador || existente.fuePre2012Ecuador,
          });
        } else if (est.fueCorregido || est.fuePre2012Ecuador) {
          existente.fueCorregido = existente.fueCorregido || est.fueCorregido;
          existente.fuePre2012Ecuador = existente.fuePre2012Ecuador || est.fuePre2012Ecuador;
        }
      }
    }
  }
  const telefonos = Array.from(mapaTels.values());

  // 2. Nombres candidatos (limpios y únicos)
  const mapaNombres = new Map<string, { original: string; limpio: string; fueLimpiado: boolean }>();
  for (const f of grupoFichas) {
    const raw = (f.nombreOriginal || "").trim();
    if (!raw || esNombreGenericoSoloNumero(raw)) continue;
    const { nombre: limpio, fueLimpiado } = limpiarNombreContacto(raw, opciones);
    const clave = normalizarTextoBase(limpio);
    if (clave && !mapaNombres.has(clave)) {
      mapaNombres.set(clave, { original: raw, limpio, fueLimpiado });
    }
  }
  const candidatosObj = Array.from(mapaNombres.values());
  const nombresCandidatos = candidatosObj.map((c) => c.limpio);
  const mejorCandidato =
    candidatosObj.slice().sort((a, b) => b.limpio.length - a.limpio.length)[0] ?? null;

  const nombreLimpio =
    mejorCandidato?.limpio ||
    (telefonos[0] ? `Contacto ${telefonos[0].valorFormateado}` : "Contacto Sin Nombre");
  const nombreOriginalPrincipal =
    mejorCandidato?.original || grupoFichas[0]?.nombreOriginal || nombreLimpio;
  const nombreFueLimpiado = Boolean(mejorCandidato?.fueLimpiado);
  const tieneConflictoNombre = nombresCandidatos.length > 1;

  // 3. Correos, empresa, cargo, dirección, cumpleaños, notas y etiquetas combinadas
  const correosSet = new Set<string>();
  const etiquetasSet = new Set<string>();
  const notasSet = new Set<string>();
  let empresa: string | null = null;
  let cargo: string | null = null;
  let direccion: string | null = null;
  let cumpleanos: string | null = null;
  let fotoUrl: string | null = null;

  for (const f of grupoFichas) {
    for (const em of f.correos) {
      const c = em.trim().toLowerCase();
      if (c.includes("@")) correosSet.add(c);
    }
    for (const et of f.etiquetas) {
      const limpio = et.trim();
      if (limpio) etiquetasSet.add(limpio);
    }
    if (f.empresa && (!empresa || f.empresa.length > empresa.length)) empresa = f.empresa.trim();
    if (f.cargo && (!cargo || f.cargo.length > cargo.length)) cargo = f.cargo.trim();
    if (f.direccion && (!direccion || f.direccion.length > direccion.length)) {
      direccion = f.direccion.trim();
    }
    if (f.cumpleanos && !cumpleanos) cumpleanos = f.cumpleanos.trim();
    if (f.fotoUrl && !fotoUrl) fotoUrl = f.fotoUrl.trim();
    if (f.notas?.trim()) notasSet.add(f.notas.trim());
  }

  // Conservar alias fusionados en Notas para no perder contexto
  if (opciones.guardarAliasEnNotas && nombresCandidatos.length > 1) {
    const otrosAlias = nombresCandidatos.filter(
      (n) => normalizarTextoBase(n) !== normalizarTextoBase(nombreLimpio)
    );
    if (otrosAlias.length > 0) {
      notasSet.add(`Alias fusionados: ${otrosAlias.join(" | ")}`);
    }
  }

  const notas = notasSet.size > 0 ? Array.from(notasSet).join(" · ") : null;
  const etiquetasOriginales = Array.from(etiquetasSet);

  // 4. Clasificación automática reutilizando el motor fail-safe afinado
  const hayAgendaPersonal = grupoFichas.some((f) => f.esAgendaPersonal !== false);
  const auto = clasificarContactoAutomaticamente({
    nombres: [
      ...nombresCandidatos,
      ...(empresa ? [empresa] : []),
    ],
    notas,
    etiquetas: etiquetasOriginales,
    esAgendaPersonal: hayAgendaPersonal,
    esListaIgnorar: false,
    existeEnCrm: false,
    totalComprasCrm: 0,
    reglas: opciones.reglasClasificacion,
  });

  const etiquetaCategoriaGoogle = resolverEtiquetaGoogle(
    auto.clasificacion,
    auto.motivo
  );

  // 5. Trazabilidad Google Contacts (principal + duplicados REALES con distinto resourceName)
  // Deduplicar primero por googleResourceName para que leer la misma cuenta dos veces
  // JAMÁS marque el mismo resourceName como principal y como duplicado a la vez.
  const mapaGoogleUnicos = new Map<string, FichaAgendaCruda>();
  for (const f of grupoFichas) {
    const rn = f.googleResourceName?.trim();
    if (!rn) continue;
    const prev = mapaGoogleUnicos.get(rn);
    if (!prev) {
      mapaGoogleUnicos.set(rn, f);
    } else {
      const scoreF =
        f.telefonos.length * 3 + f.correos.length * 2 + (f.empresa ? 1 : 0) + (f.notas ? 1 : 0);
      const scorePrev =
        prev.telefonos.length * 3 +
        prev.correos.length * 2 +
        (prev.empresa ? 1 : 0) +
        (prev.notas ? 1 : 0);
      if (scoreF > scorePrev) mapaGoogleUnicos.set(rn, f);
    }
  }
  const fichasConGoogle = Array.from(mapaGoogleUnicos.values());
  // Preferir como ficha principal la que tenga más campos
  fichasConGoogle.sort((a, b) => {
    const score = (f: FichaAgendaCruda) =>
      f.telefonos.length * 3 + f.correos.length * 2 + (f.empresa ? 1 : 0) + (f.notas ? 1 : 0);
    return score(b) - score(a);
  });
  const principalGoogle = fichasConGoogle[0] ?? null;
  const rnPrincipal = principalGoogle?.googleResourceName?.trim() || null;
  const duplicadosGoogle = fichasConGoogle
    .slice(1)
    .map((f) => f.googleResourceName?.trim() || "")
    .filter((rn) => Boolean(rn) && rn !== rnPrincipal);

  const algunTelefonoCorregido = telefonos.some((t) => t.fueCorregido);
  const algunTelefonoPre2012 = telefonos.some((t) => t.fuePre2012Ecuador);

  const cambiosResumen: string[] = [];
  if (grupoFichas.length > 1) {
    cambiosResumen.push(
      `${grupoFichas.length} fichas fusionadas (${
        motivoFusion === "MISMO_TELEFONO"
          ? "mismo teléfono"
          : motivoFusion === "MISMA_PERSONA"
            ? "misma persona"
            : "teléfono + persona"
      })`
    );
  }
  if (algunTelefonoPre2012) cambiosResumen.push("Número EC pre-2012 corregido (+5939...)");
  else if (algunTelefonoCorregido) cambiosResumen.push("Teléfono estandarizado");
  if (nombreFueLimpiado) cambiosResumen.push("Nombre limpiado");
  if (opciones.asignarEtiquetasCategoria) {
    cambiosResumen.push(`Etiqueta: ${etiquetaCategoriaGoogle}`);
  }

  return {
    id: `dep-${indiceGrupo + 1}-${telefonos[0]?.valorE164 || "sin-tel"}`,
    nombreOriginalPrincipal,
    nombreLimpio,
    nombresCandidatos: nombresCandidatos.length > 0 ? nombresCandidatos : [nombreLimpio],
    tieneConflictoNombre,
    nombreFueLimpiado,
    telefonos,
    algunTelefonoCorregido,
    algunTelefonoPre2012,
    correos: Array.from(correosSet),
    empresa,
    cargo,
    direccion,
    cumpleanos,
    notas,
    fotoUrl,
    etiquetasOriginales,
    etiquetaCategoriaGoogle,
    clasificacion: auto.clasificacion,
    politicaIa: auto.politicaIa,
    visibilidad: auto.visibilidad,
    motivoClasificacion: auto.motivo,
    fichasOrigen: grupoFichas,
    motivoFusion,
    googleResourceNamePrincipal: principalGoogle?.googleResourceName ?? null,
    googleEtagPrincipal: principalGoogle?.googleEtag ?? null,
    googleResourceNamesDuplicados: duplicadosGoogle,
    cambiosResumen,
    seleccionado: true,
  };
}

/**
 * Ejecuta la depuración 2D completa (Union-Find por teléfono + opcionalmente por nombre/persona),
 * estandarización y clasificación sin modificar ningún origen externo hasta confirmación del usuario.
 */
export function depurarAgenda2D(
  fichasCrudas: FichaAgendaCruda[],
  opcionesParciales: Partial<OpcionesDepuradorAgenda> = {}
): {
  fichas: FichaAgendaDepurada[];
  excluidas: FichaAgendaExcluida[];
  resumen: ResumenDepuracionAgenda;
} {
  const opciones: OpcionesDepuradorAgenda = {
    ...OPCIONES_DEPURADOR_DEFECTO,
    ...opcionesParciales,
    reglasClasificacion: {
      ...REGLAS_CLASIFICACION_DEFECTO,
      ...(opcionesParciales.reglasClasificacion ?? {}),
    },
  };

  const activas: Array<{ ficha: FichaAgendaCruda; u9s: string[]; clavePersona: string | null }> = [];
  const excluidas: FichaAgendaExcluida[] = [];
  let excluidosPorRegla = 0;
  let excluidosSinTelefono = 0;

  for (const ficha of fichasCrudas) {
    const textoExclusion = normalizarTextoBase(
      [ficha.nombreOriginal, ficha.empresa || "", ficha.notas || "", ...ficha.etiquetas].join(" ")
    );
    if (
      opciones.patronesExcluir.length > 0 &&
      opciones.patronesExcluir.some((p) => coincidePatronContacto(textoExclusion, p))
    ) {
      excluidosPorRegla++;
      excluidas.push({ ficha, motivo: "Excluido por regla de descarte" });
      continue;
    }

    const u9Set = new Set<string>();
    for (const t of ficha.telefonos) {
      const e164 = normalizarTelefonoE164Contacto(t.valor);
      const u9 = ultimos9TelefonoContacto(e164);
      if (e164 && u9.length >= 7) u9Set.add(u9);
    }

    if (opciones.excluirSinTelefono && u9Set.size === 0) {
      excluidosSinTelefono++;
      excluidas.push({ ficha, motivo: "Sin número de teléfono válido" });
      continue;
    }

    const clavePersona = opciones.fusionarPorNombreSimilar
      ? claveNombreParaFusionPersona(ficha.nombreOriginal)
      : null;

    activas.push({ ficha, u9s: Array.from(u9Set), clavePersona });
  }

  // Union-Find para agrupar fichas conectadas por teléfono o por persona
  const n = activas.length;
  const parent = Array.from({ length: n }, (_, i) => i);
  const motivoUnion = new Map<number, { porTelefono: boolean; porPersona: boolean }>();

  const find = (x: number): number => {
    let r = x;
    while (parent[r] !== r) r = parent[r]!;
    let cur = x;
    while (parent[cur] !== r) {
      const nxt = parent[cur]!;
      parent[cur] = r;
      cur = nxt;
    }
    return r;
  };

  const union = (a: number, b: number, tipo: "TEL" | "PERSONA") => {
    const ra = find(a);
    const rb = find(b);
    if (ra === rb) {
      const st = motivoUnion.get(ra) ?? { porTelefono: false, porPersona: false };
      if (tipo === "TEL") st.porTelefono = true;
      else st.porPersona = true;
      motivoUnion.set(ra, st);
      return;
    }
    parent[rb] = ra;
    const sa = motivoUnion.get(ra) ?? { porTelefono: false, porPersona: false };
    const sb = motivoUnion.get(rb) ?? { porTelefono: false, porPersona: false };
    motivoUnion.set(ra, {
      porTelefono: sa.porTelefono || sb.porTelefono || tipo === "TEL",
      porPersona: sa.porPersona || sb.porPersona || tipo === "PERSONA",
    });
  };

  // Paso 1: Agrupar por teléfono compartido
  const indicePorTel = new Map<string, number>();
  for (let i = 0; i < n; i++) {
    for (const u9 of activas[i]!.u9s) {
      const prev = indicePorTel.get(u9);
      if (prev === undefined) {
        indicePorTel.set(u9, i);
      } else {
        union(prev, i, "TEL");
      }
    }
  }

  // Paso 2: Agrupar opcionalmente por nombre/persona similar
  if (opciones.fusionarPorNombreSimilar) {
    const indicePorPersona = new Map<string, number>();
    for (let i = 0; i < n; i++) {
      const cp = activas[i]!.clavePersona;
      if (!cp) continue;
      const prev = indicePorPersona.get(cp);
      if (prev === undefined) {
        indicePorPersona.set(cp, i);
      } else {
        union(prev, i, "PERSONA");
      }
    }
  }

  // Recolectar grupos finales
  const grupos = new Map<number, FichaAgendaCruda[]>();
  for (let i = 0; i < n; i++) {
    const r = find(i);
    const arr = grupos.get(r) ?? [];
    arr.push(activas[i]!.ficha);
    grupos.set(r, arr);
  }

  const fichas: FichaAgendaDepurada[] = [];
  let fusionesPorTelefono = 0;
  let fusionesPorNombre = 0;
  let telefonosEstandarizados = 0;
  let telefonosPre2012Corregidos = 0;
  let nombresLimpiados = 0;
  const porCategoria = {
    clientes: 0,
    clientesEventos: 0,
    personales: 0,
    proveedores: 0,
    equipo: 0,
  };

  let idxGrupo = 0;
  for (const [root, grupoFichas] of grupos.entries()) {
    const st = motivoUnion.get(root);
    let motivoFusion: FichaAgendaDepurada["motivoFusion"] = "NINGUNA";
    if (grupoFichas.length > 1) {
      if (st?.porTelefono && st?.porPersona) {
        motivoFusion = "TELEFONO_Y_PERSONA";
        fusionesPorTelefono++;
        fusionesPorNombre++;
      } else if (st?.porPersona) {
        motivoFusion = "MISMA_PERSONA";
        fusionesPorNombre++;
      } else {
        motivoFusion = "MISMO_TELEFONO";
        fusionesPorTelefono++;
      }
    }

    const depurada = construirFichaDepuradaDesdeGrupo(
      grupoFichas,
      motivoFusion,
      opciones,
      idxGrupo++
    );

    if (depurada.nombreFueLimpiado) nombresLimpiados++;
    for (const t of depurada.telefonos) {
      if (t.fueCorregido) telefonosEstandarizados++;
      if (t.fuePre2012Ecuador) telefonosPre2012Corregidos++;
    }

    if (depurada.clasificacion === "CLIENTE") {
      if (depurada.etiquetaCategoriaGoogle === "Clientes Eventos") porCategoria.clientesEventos++;
      else porCategoria.clientes++;
    } else if (depurada.clasificacion === "PROVEEDOR") {
      porCategoria.proveedores++;
    } else if (depurada.clasificacion === "EQUIPO_INTERNO") {
      porCategoria.equipo++;
    } else {
      porCategoria.personales++;
    }

    fichas.push(depurada);
  }

  // Ordenar: fusionados primero, luego alfabético
  fichas.sort((a, b) => {
    const fa = a.fichasOrigen.length > 1 ? 0 : 1;
    const fb = b.fichasOrigen.length > 1 ? 0 : 1;
    if (fa !== fb) return fa - fb;
    return a.nombreLimpio.localeCompare(b.nombreLimpio, "es");
  });

  const fichasFusionadas = fichas.filter((f) => f.fichasOrigen.length > 1).length;
  const duplicadosEliminados = activas.length - fichas.length;

  return {
    fichas,
    excluidas,
    resumen: {
      totalFichasOriginales: fichasCrudas.length,
      totalFichasDepuradas: fichas.length,
      duplicadosEliminados,
      fichasFusionadas,
      fusionesPorTelefono,
      fusionesPorNombre,
      telefonosEstandarizados,
      telefonosPre2012Corregidos,
      nombresLimpiados,
      excluidosPorRegla,
      excluidosSinTelefono,
      porCategoria,
    },
  };
}

/**
 * Permite al usuario deshacer una fusión específica (separando la ficha en sus registros originales).
 */
export function separarFichaDepurada(
  fichasActuales: FichaAgendaDepurada[],
  fichaId: string,
  opciones: OpcionesDepuradorAgenda
): FichaAgendaDepurada[] {
  const resultado: FichaAgendaDepurada[] = [];
  for (const f of fichasActuales) {
    if (f.id !== fichaId || f.fichasOrigen.length <= 1) {
      resultado.push(f);
      continue;
    }
    f.fichasOrigen.forEach((orig, idx) => {
      const separada = construirFichaDepuradaDesdeGrupo(
        [orig],
        "NINGUNA",
        opciones,
        idx + Date.now()
      );
      separada.id = `${f.id}-sep-${idx + 1}`;
      resultado.push(separada);
    });
  }
  return resultado;
}

function escaparVcard3(valor: string): string {
  return valor
    .replace(/\\/g, "\\\\")
    .replace(/\r?\n/g, "\\n")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,");
}

/**
 * Genera un archivo `.vcf` estándar vCard 3.0 UTF-8 listo para Android, iPhone, iCloud y Google Contacts.
 */
export function generarVcfLimpioV3(
  fichas: FichaAgendaDepurada[],
  opciones: { incluirEtiquetaCategoria?: boolean } = {}
): string {
  const incluirCat = opciones.incluirEtiquetaCategoria !== false;
  const bloques: string[] = [];

  for (const f of fichas) {
    if (!f.seleccionado) continue;
    const lineas: string[] = ["BEGIN:VCARD", "VERSION:3.0"];
    const fn = f.nombreLimpio.trim() || "Sin Nombre";
    lineas.push(`FN:${escaparVcard3(fn)}`);
    lineas.push(`N:;${escaparVcard3(fn)};;;`);

    for (const t of f.telefonos) {
      const tipo = t.tipo === "WORK" ? "WORK,VOICE" : t.tipo === "HOME" ? "HOME,VOICE" : "CELL";
      lineas.push(`TEL;TYPE=${tipo}:${t.valorFormateado}`);
    }
    for (const em of f.correos) {
      lineas.push(`EMAIL;TYPE=INTERNET:${em}`);
    }
    if (f.empresa) lineas.push(`ORG:${escaparVcard3(f.empresa)}`);
    if (f.cargo) lineas.push(`TITLE:${escaparVcard3(f.cargo)}`);
    if (f.direccion) lineas.push(`ADR;TYPE=HOME:;;${escaparVcard3(f.direccion)};;;;`);
    if (f.cumpleanos) lineas.push(`BDAY:${f.cumpleanos}`);

    const cats = new Set(f.etiquetasOriginales);
    if (incluirCat && f.etiquetaCategoriaGoogle) cats.add(f.etiquetaCategoriaGoogle);
    if (cats.size > 0) {
      lineas.push(
        `CATEGORIES:${Array.from(cats)
          .map((c) => escaparVcard3(c))
          .join(",")}`
      );
    }

    if (f.notas) lineas.push(`NOTE:${escaparVcard3(f.notas)}`);
    lineas.push("END:VCARD");
    bloques.push(lineas.join("\r\n"));
  }

  return bloques.join("\r\n") + (bloques.length > 0 ? "\r\n" : "");
}

function escaparCsv(valor?: string | null): string {
  const s = String(valor ?? "");
  if (/[",\r\n]/.test(s)) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

/**
 * Genera el CSV oficial nativo de Google Contacts (`contacts.google.com -> Importar`)
 * incluyendo `Group Membership` para crear automáticamente las etiquetas en el celular.
 */
export function generarCsvGoogleContacts(
  fichas: FichaAgendaDepurada[],
  opciones: { incluirEtiquetaCategoria?: boolean } = {}
): string {
  const incluirCat = opciones.incluirEtiquetaCategoria !== false;
  const cabeceras = [
    "Name",
    "Given Name",
    "Additional Name",
    "Family Name",
    "Group Membership",
    "E-mail 1 - Type",
    "E-mail 1 - Value",
    "E-mail 2 - Type",
    "E-mail 2 - Value",
    "Phone 1 - Type",
    "Phone 1 - Value",
    "Phone 2 - Type",
    "Phone 2 - Value",
    "Phone 3 - Type",
    "Phone 3 - Value",
    "Phone 4 - Type",
    "Phone 4 - Value",
    "Organization 1 - Name",
    "Organization 1 - Title",
    "Birthday",
    "Address 1 - Formatted",
    "Notes",
  ];

  const filas: string[] = [cabeceras.map(escaparCsv).join(",")];

  const etiquetaTipoTel = (t: TipoTelefonoAgenda) =>
    t === "WORK" ? "Work" : t === "HOME" ? "Home" : "Mobile";

  for (const f of fichas) {
    if (!f.seleccionado) continue;
    const grupos = new Set<string>(["* myContacts"]);
    for (const et of f.etiquetasOriginales) {
      if (et && et.toLowerCase() !== "mycontacts") grupos.add(et);
    }
    if (incluirCat && f.etiquetaCategoriaGoogle) {
      grupos.add(f.etiquetaCategoriaGoogle);
    }

    const row = [
      f.nombreLimpio,
      f.nombreLimpio,
      "",
      "",
      Array.from(grupos).join(" ::: "),
      f.correos[0] ? "Other" : "",
      f.correos[0] ?? "",
      f.correos[1] ? "Other" : "",
      f.correos[1] ?? "",
      f.telefonos[0] ? etiquetaTipoTel(f.telefonos[0].tipo) : "",
      f.telefonos[0]?.valorFormateado ?? "",
      f.telefonos[1] ? etiquetaTipoTel(f.telefonos[1].tipo) : "",
      f.telefonos[1]?.valorFormateado ?? "",
      f.telefonos[2] ? etiquetaTipoTel(f.telefonos[2].tipo) : "",
      f.telefonos[2]?.valorFormateado ?? "",
      f.telefonos[3] ? etiquetaTipoTel(f.telefonos[3].tipo) : "",
      f.telefonos[3]?.valorFormateado ?? "",
      f.empresa ?? "",
      f.cargo ?? "",
      f.cumpleanos ?? "",
      f.direccion ?? "",
      f.notas ?? "",
    ];
    filas.push(row.map(escaparCsv).join(","));
  }

  return `\uFEFF${filas.join("\r\n")}\r\n`;
}

/**
 * Genera las 2 hojas estructuradas para exportar el reporte de auditoría en Excel (`.xlsx`).
 */
export function generarHojasAuditoriaDepuracion(
  fichas: FichaAgendaDepurada[],
  excluidas: FichaAgendaExcluida[]
): {
  hojaLimpios: Array<Record<string, string | number>>;
  hojaCambios: Array<Record<string, string | number>>;
} {
  const hojaLimpios = fichas
    .filter((f) => f.seleccionado)
    .map((f) => ({
      Nombre_Limpio: f.nombreLimpio,
      Categoria: f.clasificacion,
      Etiqueta_Google: f.etiquetaCategoriaGoogle,
      Telefono_1: f.telefonos[0]?.valorFormateado ?? "",
      Telefono_2: f.telefonos[1]?.valorFormateado ?? "",
      Telefono_3: f.telefonos[2]?.valorFormateado ?? "",
      Correo_1: f.correos[0] ?? "",
      Empresa: f.empresa ?? "",
      Fichas_Fusionadas: f.fichasOrigen.length,
      Politica_IA: f.politicaIa,
      Privacidad_WhatsApp: f.visibilidad,
      Notas: f.notas ?? "",
      Cambios_Aplicados: f.cambiosResumen.join(" | "),
    }));

  const hojaCambios: Array<Record<string, string | number>> = [];
  for (const f of fichas) {
    if (f.fichasOrigen.length > 1 || f.algunTelefonoCorregido || f.nombreFueLimpiado) {
      hojaCambios.push({
        Accion: f.fichasOrigen.length > 1 ? `FUSIÓN (${f.motivoFusion})` : "ESTANDARIZADO",
        Nombre_Final: f.nombreLimpio,
        Nombres_Originales: f.fichasOrigen.map((o) => o.nombreOriginal).join(" | "),
        Telefonos_Finales: f.telefonos.map((t) => t.valorFormateado).join(" | "),
        Telefonos_Originales: f.fichasOrigen
          .flatMap((o) => o.telefonos.map((t) => t.valor))
          .join(" | "),
        Detalle: f.cambiosResumen.join(" · "),
      });
    }
  }
  for (const ex of excluidas) {
    hojaCambios.push({
      Accion: "EXCLUIDO",
      Nombre_Final: ex.ficha.nombreOriginal || "(Sin nombre)",
      Nombres_Originales: ex.ficha.nombreOriginal || "",
      Telefonos_Finales: "",
      Telefonos_Originales: ex.ficha.telefonos.map((t) => t.valor).join(" | "),
      Detalle: ex.motivo,
    });
  }

  return { hojaLimpios, hojaCambios };
}

/**
 * Expande las fichas depuradas (que pueden tener 1..N teléfonos) al formato de lote del
 * Directorio WhatsApp (`importarContactosDirectorioLoteAction`).
 */
export function expandirFichasDepuradasParaDirectorio(
  fichas: FichaAgendaDepurada[]
): Array<{
  telefonoE164: string;
  nombreConsolidado: string;
  correo: string | null;
  clasificacion: ClasificacionContacto;
  politicaIa: PoliticaIaContacto;
  visibilidad: VisibilidadContacto;
  detalle: Record<string, unknown>;
}> {
  const resultado: Array<{
    telefonoE164: string;
    nombreConsolidado: string;
    correo: string | null;
    clasificacion: ClasificacionContacto;
    politicaIa: PoliticaIaContacto;
    visibilidad: VisibilidadContacto;
    detalle: Record<string, unknown>;
  }> = [];

  for (const f of fichas) {
    if (!f.seleccionado) continue;
    for (const tel of f.telefonos) {
      resultado.push({
        telefonoE164: tel.valorE164,
        nombreConsolidado: f.nombreLimpio,
        correo: f.correos[0] ?? null,
        clasificacion: f.clasificacion,
        politicaIa: f.politicaIa,
        visibilidad: f.visibilidad,
        detalle: {
          alias: f.nombresCandidatos,
          etiquetaGoogle: f.etiquetaCategoriaGoogle,
          empresa: f.empresa,
          notas: f.notas,
          fotoUrl: f.fotoUrl,
          motivoClasificacion: f.motivoClasificacion,
          depurado2D: true,
        },
      });
    }
  }

  return resultado;
}
