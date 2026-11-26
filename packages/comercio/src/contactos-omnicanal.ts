/**
 * Motor puro de extracción, normalización E.164, Join/Merge y clasificación fail-safe
 * de contactos omnicanal y configuración multi-línea WhatsApp (PLT-010).
 *
 * Sin dependencias de `next/*` para máxima portabilidad (web, tests y Capacitor).
 */

export type RolLineaWhatsapp =
  | "VENTAS"
  | "DUENO"
  | "ADMINISTRADORA"
  | "OPERADOR"
  | "SOPORTE"
  | "OTRO";

export type PoliticaPersonalesLinea = "IGNORAR_TOTAL" | "OCULTO_ADMIN" | "SOLO_TITULAR";

export type VisibilidadConversacion = "EQUIPO_VENTAS" | "SOLO_ADMIN" | "SOLO_TITULAR";

export type VisibilidadContacto =
  | "EQUIPO_VENTAS"
  | "SOLO_ADMIN"
  | "SOLO_TITULAR"
  | "IGNORAR_TOTAL";

export function mapearPoliticaPersonalAVisibilidad(
  politica: PoliticaPersonalesLinea
): VisibilidadContacto {
  return politica === "OCULTO_ADMIN" ? "SOLO_ADMIN" : politica;
}

export type ClasificacionContacto =
  | "PERSONAL"
  | "CLIENTE"
  | "PROVEEDOR"
  | "EQUIPO_INTERNO"
  | "BLOQUEADO_SPAM";

export type PoliticaIaContacto = "SIEMPRE_MANUAL" | "AUTO_IA" | "SEGUN_LINEA";

export type OrigenImportacionContacto =
  | "VCF"
  | "CSV"
  | "XLSX"
  | "CONTACT_PICKER"
  | "GOOGLE_CONTACTS"
  | "CRM"
  | "MANUAL_CHAT"
  | "LISTA_IGNORAR";

export interface LineaWhatsappConfig {
  id: string;
  codigo: string;
  nombre: string;
  rolLinea: RolLineaWhatsapp;
  numeroE164: string;
  titularUsuarioId?: string | null;
  titularNombre?: string | null;
  proveedor?: "ycloud" | "meta_cloud";
  esPrincipal: boolean;
  habilitado: boolean;
  iaDesconocidosActiva: boolean;
  iaClientesActiva: boolean;
  politicaPersonales: PoliticaPersonalesLinea;
  visibilidadClientes: VisibilidadConversacion;
  agenteIaId?: string | null;
  colorBadge: string;
  tieneApiKeyPropia?: boolean;
  tieneWebhookSecretPropio?: boolean;
  totalContactosAportados?: number;
  totalPersonalesAportados?: number;
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface ContactoFuenteRegistro {
  id?: string;
  origen: OrigenImportacionContacto;
  nombreOriginal: string;
  clasificacionOrigen: ClasificacionContacto;
  politicaPersonal: VisibilidadContacto;
  lineaWhatsappId?: string | null;
  lineaNombre?: string | null;
  propietarioUsuarioId?: string | null;
  propietarioNombre?: string | null;
  creadoEn?: string;
  detalle?: Record<string, unknown>;
}

export interface ContactoDirectorioRegistro {
  id: string;
  secuencial?: number;
  telefonoE164: string;
  telefonoUltimos9: string;
  nombreConsolidado: string;
  correo?: string | null;
  clasificacion: ClasificacionContacto;
  politicaIa: PoliticaIaContacto;
  visibilidad: VisibilidadContacto;
  titularUsuarioId?: string | null;
  titularNombre?: string | null;
  clienteId?: string | null;
  usuarioId?: string | null;
  totalComprasCrm?: number;
  montoAcumuladoCrm?: number;
  detalle?: Record<string, unknown>;
  fuentes: ContactoFuenteRegistro[];
  creadoEn?: string;
  actualizadoEn?: string;
}

export interface SemillaCrmContacto {
  telefonoUltimos9: string;
  telefonoE164: string;
  nombre: string;
  correo?: string | null;
  totalCompras: number;
  montoAcumulado: number;
  origen: "CRM_COMPRAS" | "USUARIO_WEB" | "CHAT_WHATSAPP" | string;
  clienteId?: string | null;
  usuarioId?: string | null;
}

export interface ContactoCrudoImportado {
  nombre: string;
  telefono: string;
  correo?: string | null;
  empresa?: string | null;
  notas?: string | null;
  etiquetas?: string[];
  origen: OrigenImportacionContacto;
  lineaWhatsappId?: string | null;
  lineaNombre?: string | null;
  etiquetaFuente?: string | null;
  esAgendaPersonal?: boolean;
  clasificacionSugerida?: ClasificacionContacto | null;
}

export interface ReglasClasificacionContactos {
  patronesCliente: string[];
  patronesProveedor: string[];
  patronesEquipo: string[];
  politicaPersonalDefecto: PoliticaPersonalesLinea;
  politicaIaClientesDefecto: PoliticaIaContacto;
  visibilidadClientesDefecto: VisibilidadConversacion;
}

export const REGLAS_CLASIFICACION_DEFECTO: ReglasClasificacionContactos = {
  patronesCliente: [
    "cliente",
    "cli ",
    "clt",
    "pedido",
    "compra",
    "boda",
    "evento",
    "flor",
    "ramo",
    "cotiz",
    "arregl",
    "vip",
    "novia",
    "empresa",
  ],
  patronesProveedor: [
    "proveedor",
    "finca",
    "floricult",
    "motoriz",
    "delivery",
    "mensajer",
    "courier",
    "transporte",
    "mayorista",
    "insumo",
  ],
  patronesEquipo: ["taller", "vendedor", "asesor", "florista", "equipo", "staff"],
  politicaPersonalDefecto: "IGNORAR_TOTAL",
  politicaIaClientesDefecto: "SEGUN_LINEA",
  visibilidadClientesDefecto: "EQUIPO_VENTAS",
};

export interface ContactoConsolidadoPreview {
  claveConsolidacion: string;
  telefonoE164: string;
  telefonoUltimos9: string;
  nombreConsolidado: string;
  nombresCandidatos: string[];
  tieneConflictoNombre: boolean;
  correo: string | null;
  clasificacion: ClasificacionContacto;
  politicaIa: PoliticaIaContacto;
  visibilidad: VisibilidadContacto;
  motivoClasificacion: string;
  yaExisteEnDirectorio: boolean;
  existeEnCrm: boolean;
  totalComprasCrm: number;
  fuentes: ContactoFuenteRegistro[];
  duplicadosFusionados: number;
  notas?: string | null;
  seleccionado: boolean;
}

export interface ResumenConsolidacionContactos {
  totalRegistrosBrutos: number;
  totalInvalidosDescartados: number;
  totalConsolidados: number;
  duplicadosFusionados: number;
  conflictosNombre: number;
  totalPersonales: number;
  totalClientes: number;
  totalProveedoresOInternos: number;
  coincidenciasCrm: number;
  nuevos: number;
  actualizaciones: number;
}

export const COLORES_LINEAS_WHATSAPP: Record<RolLineaWhatsapp, { color: string; etiqueta: string; icono: string }> = {
  VENTAS: { color: "#16A34A", etiqueta: "Ventas", icono: "🛍️" },
  DUENO: { color: "#1D4ED8", etiqueta: "Dueño", icono: "👔" },
  ADMINISTRADORA: { color: "#7C3AED", etiqueta: "Administración", icono: "🛡️" },
  OPERADOR: { color: "#D97706", etiqueta: "Operador", icono: "⚙️" },
  SOPORTE: { color: "#0F766E", etiqueta: "Soporte", icono: "🎧" },
  OTRO: { color: "#475569", etiqueta: "Otro", icono: "📱" },
};

/**
 * Normaliza un número telefónico ecuatoriano o internacional a formato canónico E.164 (`+593...`).
 */
export function normalizarTelefonoE164Contacto(telefono?: string | null): string {
  const limpio = String(telefono ?? "")
    .replace(/@s\.whatsapp\.net$/i, "")
    .trim();
  if (!limpio) return "";

  let digitos = limpio.replace(/\D+/g, "");
  if (!digitos) return "";

  if (/^00\d{8,}$/.test(digitos)) {
    digitos = digitos.slice(2);
  }

  // Ecuador móvil: 09XXXXXXXX -> 5939XXXXXXXX
  if (/^09\d{8}$/.test(digitos)) {
    digitos = `593${digitos.slice(1)}`;
  } else if (/^9\d{8}$/.test(digitos)) {
    digitos = `593${digitos}`;
  } else if (/^0[2-7]\d{7}$/.test(digitos)) {
    // Ecuador fijo: 02XXXXXXX -> 5932XXXXXXX
    digitos = `593${digitos.slice(1)}`;
  }

  if (digitos.length < 7 || digitos.length > 15) return "";
  return `+${digitos}`;
}

/**
 * Devuelve los últimos 9 dígitos del teléfono para cruces confiables entre formatos locales y E.164.
 */
export function ultimos9TelefonoContacto(telefono?: string | null): string {
  const e164 = normalizarTelefonoE164Contacto(telefono);
  const digitos = (e164 || String(telefono ?? "")).replace(/\D+/g, "");
  if (digitos.length < 7) return "";
  return digitos.length >= 9 ? digitos.slice(-9) : digitos;
}

function normalizarTextoComparacion(valor: string): string {
  return valor
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Decodifica valores QUOTED-PRINTABLE de archivos vCard (.vcf) exportados por Android/Samsung.
 */
function decodificarQuotedPrintableUtf8(entrada: string): string {
  const sinSoftBreaks = entrada.replace(/=\r?\n/g, "");
  const bytes: number[] = [];
  for (let i = 0; i < sinSoftBreaks.length; i++) {
    const ch = sinSoftBreaks[i]!;
    if (ch === "=" && i + 2 < sinSoftBreaks.length) {
      const hex = sinSoftBreaks.slice(i + 1, i + 3);
      if (/^[0-9A-Fa-f]{2}$/.test(hex)) {
        bytes.push(parseInt(hex, 16));
        i += 2;
        continue;
      }
    }
    const code = sinSoftBreaks.charCodeAt(i);
    if (code < 128) {
      bytes.push(code);
    } else {
      const encoded = new TextEncoder().encode(ch);
      for (const b of encoded) bytes.push(b);
    }
  }
  try {
    return new TextDecoder("utf-8", { fatal: false }).decode(new Uint8Array(bytes));
  } catch {
    return sinSoftBreaks;
  }
}

function limpiarValorVcard(valor: string, parametros: string): string {
  let texto = valor;
  if (/ENCODING=QUOTED-PRINTABLE/i.test(parametros)) {
    texto = decodificarQuotedPrintableUtf8(texto);
  }
  return texto
    .replace(/\\n/gi, " ")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parsea un archivo `.vcf` (vCard 2.1 / 3.0 / 4.0 de iPhone, Android, Samsung, iCloud)
 * extrayendo TODOS los números de teléfono de cada tarjeta.
 */
export function parsearVcfContactos(
  textoVcf: string,
  meta: {
    lineaWhatsappId?: string | null;
    lineaNombre?: string | null;
    etiquetaFuente?: string | null;
    esAgendaPersonal?: boolean;
  } = {}
): ContactoCrudoImportado[] {
  if (!textoVcf || !textoVcf.trim()) return [];

  // Desplegar continuaciones de línea RFC 2426 / 6350 y soft breaks de QUOTED-PRINTABLE
  const normalizado = textoVcf
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/=\n/g, "")
    .replace(/\n[ \t]/g, "");

  const bloques = normalizado.split(/BEGIN:VCARD/i).slice(1);
  const resultados: ContactoCrudoImportado[] = [];

  for (const bloqueRaw of bloques) {
    const finIdx = bloqueRaw.search(/END:VCARD/i);
    const cuerpo = finIdx >= 0 ? bloqueRaw.slice(0, finIdx) : bloqueRaw;
    const lineas = cuerpo.split("\n");

    let fn = "";
    let nombrePartes = "";
    let org = "";
    let correo = "";
    let notas = "";
    const etiquetas: string[] = [];
    const telefonos = new Set<string>();

    for (const linea of lineas) {
      const idxSep = linea.indexOf(":");
      if (idxSep <= 0) continue;

      const cabeza = linea.slice(0, idxSep).trim();
      const valorRaw = linea.slice(idxSep + 1).trim();
      if (!valorRaw) continue;

      // Quitar prefijo de grupo iOS tipo `item1.TEL`
      const cabezaSinGrupo = cabeza.replace(/^[a-z0-9_-]+\./i, "");
      const [claveRaw, ...paramsResto] = cabezaSinGrupo.split(";");
      const clave = (claveRaw || "").toUpperCase();
      const params = paramsResto.join(";");

      if (clave === "FN" && !fn) {
        fn = limpiarValorVcard(valorRaw, params);
      } else if (clave === "N" && !nombrePartes) {
        const partes = valorRaw
          .split(";")
          .map((p) => limpiarValorVcard(p, params))
          .filter(Boolean);
        // Formato N: Apellido;Nombre;SegundoNombre;Prefijo;Sufijo
        if (partes.length >= 2) {
          nombrePartes = `${partes[1]} ${partes[0]}`.trim();
        } else if (partes.length === 1) {
          nombrePartes = partes[0]!;
        }
      } else if (clave === "ORG" && !org) {
        org = limpiarValorVcard(valorRaw.replace(/;/g, " "), params);
      } else if (clave === "EMAIL" && !correo) {
        const em = limpiarValorVcard(valorRaw, params).toLowerCase();
        if (em.includes("@")) correo = em;
      } else if (clave === "NOTE" && !notas) {
        notas = limpiarValorVcard(valorRaw, params);
      } else if (clave === "CATEGORIES") {
        const cats = limpiarValorVcard(valorRaw, params)
          .split(",")
          .map((c) => c.trim())
          .filter(Boolean);
        etiquetas.push(...cats);
      } else if (clave === "TEL") {
        const tel = limpiarValorVcard(valorRaw, params);
        const e164 = normalizarTelefonoE164Contacto(tel);
        if (e164) telefonos.add(e164);
      }
    }

    const nombreFinal = fn || nombrePartes || org || "";
    for (const tel of telefonos) {
      resultados.push({
        nombre: nombreFinal || `Contacto ${tel}`,
        telefono: tel,
        correo: correo || null,
        empresa: org || null,
        notas: notas || null,
        etiquetas,
        origen: "VCF",
        lineaWhatsappId: meta.lineaWhatsappId ?? null,
        lineaNombre: meta.lineaNombre ?? null,
        etiquetaFuente: meta.etiquetaFuente ?? "Archivo vCard (.vcf)",
        esAgendaPersonal: meta.esAgendaPersonal !== false,
      });
    }
  }

  return resultados;
}

/**
 * Parsea filas tabulares provenientes de Google Contacts CSV, Outlook CSV o archivos Excel (.xlsx/.xls).
 * Soporta múltiples columnas de teléfono (`Phone 1 - Value`, `Phone 2 - Value`, `Celular`, `WhatsApp`, etc.)
 * y separadores múltiples `:::` usados por Google Contacts.
 */
export function parsearFilasTablaContactos(
  filas: Array<Record<string, unknown>>,
  meta: {
    origen?: "CSV" | "XLSX";
    lineaWhatsappId?: string | null;
    lineaNombre?: string | null;
    etiquetaFuente?: string | null;
    esAgendaPersonal?: boolean;
  } = {}
): ContactoCrudoImportado[] {
  const resultados: ContactoCrudoImportado[] = [];
  const origen = meta.origen ?? "CSV";

  for (const fila of filas) {
    if (!fila || typeof fila !== "object") continue;

    const entradas = Object.entries(fila).map(([k, v]) => ({
      claveOriginal: k,
      claveNorm: normalizarTextoComparacion(k),
      valor: String(v ?? "").trim(),
    }));

    const buscarPrimero = (pred: (claveNorm: string) => boolean): string =>
      entradas.find((e) => e.valor && pred(e.claveNorm))?.valor ?? "";

    const nombreDirecto = buscarPrimero(
      (k) =>
        k === "name" ||
        k === "nombre" ||
        k === "nombre completo" ||
        k === "full name" ||
        k === "display name" ||
        k === "contacto" ||
        k === "cliente"
    );
    const primerNombre = buscarPrimero(
      (k) => k === "first name" || k === "given name" || k === "nombres" || k === "primer nombre"
    );
    const segundoNombre = buscarPrimero((k) => k === "middle name" || k === "additional name");
    const apellido = buscarPrimero(
      (k) => k === "last name" || k === "family name" || k === "apellidos" || k === "apellido"
    );
    const empresa = buscarPrimero(
      (k) =>
        k.includes("organization") ||
        k.includes("company") ||
        k === "empresa" ||
        k === "organizacion"
    );
    const correo = buscarPrimero(
      (k) =>
        (k.includes("mail") || k.includes("correo")) &&
        !k.includes("type") &&
        !k.includes("label")
    ).toLowerCase();
    const notas = buscarPrimero((k) => k === "notes" || k === "notas" || k === "observaciones");
    const gruposRaw = buscarPrimero(
      (k) =>
        k.includes("group membership") ||
        k === "labels" ||
        k === "etiquetas" ||
        k === "categoria" ||
        k === "categorias"
    );
    const clasifRaw = buscarPrimero(
      (k) => k === "clasificacion" || k === "tipo" || k === "tipo contacto"
    ).toUpperCase();

    const nombreCompuesto = [primerNombre, segundoNombre, apellido].filter(Boolean).join(" ").trim();
    const nombreFinal = (nombreDirecto || nombreCompuesto || empresa || "").trim();

    const etiquetas = gruposRaw
      ? gruposRaw
          .split(/:::|,|;/)
          .map((g) => g.replace(/^\*\s*/, "").trim())
          .filter((g) => g && g.toLowerCase() !== "mycontacts")
      : [];

    const telefonos = new Set<string>();
    for (const e of entradas) {
      if (!e.valor) continue;
      const pareceColTel =
        (e.claveNorm.includes("phone") ||
          e.claveNorm.includes("tel") ||
          e.claveNorm.includes("cel") ||
          e.claveNorm.includes("movil") ||
          e.claveNorm.includes("mobile") ||
          e.claveNorm.includes("whatsapp") ||
          e.claveNorm.includes("numero")) &&
        !e.claveNorm.includes("type") &&
        !e.claveNorm.includes("label");

      if (!pareceColTel) continue;

      const fragmentos = e.valor.split(/:::|[|;,/\n]+/);
      for (const frag of fragmentos) {
        const e164 = normalizarTelefonoE164Contacto(frag);
        if (e164) telefonos.add(e164);
      }
    }

    // Fallback: si no hubo encabezados reconocidos, detectar cualquier celda con formato telefónico
    if (telefonos.size === 0) {
      for (const e of entradas) {
        if (!e.valor || e.valor.includes("@")) continue;
        if (/^[\s+()0-9.-]{8,22}$/.test(e.valor)) {
          const e164 = normalizarTelefonoE164Contacto(e.valor);
          if (e164) telefonos.add(e164);
        }
      }
    }

    const clasifSugerida: ClasificacionContacto | null =
      clasifRaw === "PERSONAL" ||
      clasifRaw === "CLIENTE" ||
      clasifRaw === "PROVEEDOR" ||
      clasifRaw === "EQUIPO_INTERNO" ||
      clasifRaw === "BLOQUEADO_SPAM"
        ? (clasifRaw as ClasificacionContacto)
        : null;

    for (const tel of telefonos) {
      resultados.push({
        nombre: nombreFinal || `Contacto ${tel}`,
        telefono: tel,
        correo: correo.includes("@") ? correo : null,
        empresa: empresa || null,
        notas: notas || null,
        etiquetas,
        origen,
        lineaWhatsappId: meta.lineaWhatsappId ?? null,
        lineaNombre: meta.lineaNombre ?? null,
        etiquetaFuente: meta.etiquetaFuente ?? (origen === "XLSX" ? "Archivo Excel" : "Archivo CSV"),
        esAgendaPersonal: meta.esAgendaPersonal !== false,
        clasificacionSugerida: clasifSugerida,
      });
    }
  }

  return resultados;
}

/**
 * Parsea texto pegado rápidamente (lista a ignorar o contactos copiados de WhatsApp/Excel).
 * Acepta formatos como: `Mamá, 0991234567`, `Cliente Juan Perez - +593 99 888 7777`, o solo `0991234567`.
 */
export function parsearListaRapidaContactos(
  textoPlano: string,
  meta: {
    origen?: OrigenImportacionContacto;
    lineaWhatsappId?: string | null;
    lineaNombre?: string | null;
    etiquetaFuente?: string | null;
    esAgendaPersonal?: boolean;
    forzarClasificacion?: ClasificacionContacto | null;
  } = {}
): ContactoCrudoImportado[] {
  const lineas = String(textoPlano ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const resultados: ContactoCrudoImportado[] = [];
  for (const linea of lineas) {
    const matchTel = linea.match(/(\+?\d[\d\s().-]{7,18}\d)/);
    if (!matchTel?.[1]) continue;

    const e164 = normalizarTelefonoE164Contacto(matchTel[1]);
    if (!e164) continue;

    const resto = linea
      .replace(matchTel[1], "")
      .replace(/^[\s,;:|–—-]+|[\s,;:|–—-]+$/g, "")
      .replace(/\s{2,}/g, " ")
      .trim();

    resultados.push({
      nombre: resto || `Contacto ${e164}`,
      telefono: e164,
      origen: meta.origen ?? "LISTA_IGNORAR",
      lineaWhatsappId: meta.lineaWhatsappId ?? null,
      lineaNombre: meta.lineaNombre ?? null,
      etiquetaFuente: meta.etiquetaFuente ?? "Lista rápida pegada",
      esAgendaPersonal: meta.esAgendaPersonal !== false,
      clasificacionSugerida: meta.forzarClasificacion ?? null,
    });
  }

  return resultados;
}

/**
 * Convierte contactos seleccionados mediante la Contact Picker API nativa de Android Chrome.
 */
export function parsearContactosPickerNativo(
  seleccionados: Array<{ name?: string[]; tel?: string[]; email?: string[] }>,
  meta: {
    lineaWhatsappId?: string | null;
    lineaNombre?: string | null;
    esAgendaPersonal?: boolean;
  } = {}
): ContactoCrudoImportado[] {
  const resultados: ContactoCrudoImportado[] = [];
  for (const item of seleccionados) {
    const nombre = (item.name?.[0] || "").trim();
    const correo = (item.email?.[0] || "").trim().toLowerCase() || null;
    const tels = Array.isArray(item.tel) ? item.tel : [];
    const vistos = new Set<string>();
    for (const t of tels) {
      const e164 = normalizarTelefonoE164Contacto(t);
      if (!e164 || vistos.has(e164)) continue;
      vistos.add(e164);
      resultados.push({
        nombre: nombre || `Contacto ${e164}`,
        telefono: e164,
        correo,
        origen: "CONTACT_PICKER",
        lineaWhatsappId: meta.lineaWhatsappId ?? null,
        lineaNombre: meta.lineaNombre ?? null,
        etiquetaFuente: "Agenda del Celular",
        esAgendaPersonal: meta.esAgendaPersonal !== false,
      });
    }
  }
  return resultados;
}

/**
 * Motor fail-safe de auto-clasificación:
 * - Si viene de lista a ignorar -> PERSONAL (SIEMPRE_MANUAL + IGNORAR_TOTAL).
 * - Si coincide con patrones de equipo/proveedor -> EQUIPO_INTERNO / PROVEEDOR (SIEMPRE_MANUAL).
 * - Si coincide con patrones de cliente (ej. "cliente juan perez") o tiene historial CRM -> CLIENTE.
 * - Cualquier otro contacto de agenda personal -> PERSONAL por defecto (cero riesgo de bot a familiares).
 */
export function clasificarContactoAutomaticamente(params: {
  nombres: string[];
  notas?: string | null;
  etiquetas?: string[];
  esAgendaPersonal: boolean;
  esListaIgnorar: boolean;
  existeEnCrm: boolean;
  totalComprasCrm: number;
  clasificacionExplicita?: ClasificacionContacto | null;
  reglas?: ReglasClasificacionContactos;
}): {
  clasificacion: ClasificacionContacto;
  politicaIa: PoliticaIaContacto;
  visibilidad: VisibilidadContacto;
  motivo: string;
} {
  const reglas = params.reglas ?? REGLAS_CLASIFICACION_DEFECTO;
  const visibilidadPersonal = mapearPoliticaPersonalAVisibilidad(
    reglas.politicaPersonalDefecto
  );

  if (params.esListaIgnorar) {
    return {
      clasificacion: "PERSONAL",
      politicaIa: "SIEMPRE_MANUAL",
      visibilidad: visibilidadPersonal,
      motivo: "Cargado en lista personal a ignorar",
    };
  }

  if (params.clasificacionExplicita) {
    const c = params.clasificacionExplicita;
    return {
      clasificacion: c,
      politicaIa: c === "CLIENTE" ? reglas.politicaIaClientesDefecto : "SIEMPRE_MANUAL",
      visibilidad: c === "CLIENTE" ? reglas.visibilidadClientesDefecto : visibilidadPersonal,
      motivo: "Clasificación explícita en archivo",
    };
  }

  const textoCompleto = normalizarTextoComparacion(
    [...params.nombres, params.notas || "", ...(params.etiquetas || [])].join(" ")
  );

  const matchEquipo = reglas.patronesEquipo.find((p) => {
    const pn = normalizarTextoComparacion(p);
    return pn && textoCompleto.includes(pn);
  });
  if (matchEquipo) {
    return {
      clasificacion: "EQUIPO_INTERNO",
      politicaIa: "SIEMPRE_MANUAL",
      visibilidad: visibilidadPersonal,
      motivo: `Coincide con patrón de equipo («${matchEquipo}»)`,
    };
  }

  const matchProveedor = reglas.patronesProveedor.find((p) => {
    const pn = normalizarTextoComparacion(p);
    return pn && textoCompleto.includes(pn);
  });
  if (matchProveedor) {
    return {
      clasificacion: "PROVEEDOR",
      politicaIa: "SIEMPRE_MANUAL",
      visibilidad: visibilidadPersonal,
      motivo: `Coincide con patrón de proveedor («${matchProveedor}»)`,
    };
  }

  const matchCliente = reglas.patronesCliente.find((p) => {
    const pn = normalizarTextoComparacion(p);
    return pn && textoCompleto.includes(pn);
  });
  if (matchCliente) {
    return {
      clasificacion: "CLIENTE",
      politicaIa: reglas.politicaIaClientesDefecto,
      visibilidad: reglas.visibilidadClientesDefecto,
      motivo: `Coincide con patrón de cliente («${matchCliente}»)`,
    };
  }

  if (params.totalComprasCrm > 0 || (params.existeEnCrm && !params.esAgendaPersonal)) {
    return {
      clasificacion: "CLIENTE",
      politicaIa: reglas.politicaIaClientesDefecto,
      visibilidad: reglas.visibilidadClientesDefecto,
      motivo:
        params.totalComprasCrm > 0
          ? `Cliente con ${params.totalComprasCrm} compra(s) en CRM`
          : "Presente en CRM / chats comerciales",
    };
  }

  if (!params.esAgendaPersonal) {
    return {
      clasificacion: "CLIENTE",
      politicaIa: reglas.politicaIaClientesDefecto,
      visibilidad: reglas.visibilidadClientesDefecto,
      motivo: "Importado desde línea de Ventas / comercial",
    };
  }

  return {
    clasificacion: "PERSONAL",
    politicaIa: "SIEMPRE_MANUAL",
    visibilidad: visibilidadPersonal,
    motivo: "Agenda personal (protegido por defecto contra bot IA)",
  };
}

function esNombreGenericoTelefono(nombre: string): boolean {
  const n = nombre.trim();
  return !n || /^(contacto|whatsapp|cliente)?\s*\+?\d[\d\s-]{6,}$/i.test(n);
}

/**
 * Ejecuta el Join / Merge consolidado sobre múltiples archivos/fuentes, cruzando contra
 * el directorio existente y los clientes/compras del CRM sin mutar BDD hasta confirmación.
 */
export function consolidarContactosJoinMerge(params: {
  brutos: ContactoCrudoImportado[];
  existentesDirectorio?: ContactoDirectorioRegistro[];
  semillaCrm?: SemillaCrmContacto[];
  reglas?: ReglasClasificacionContactos;
}): {
  items: ContactoConsolidadoPreview[];
  resumen: ResumenConsolidacionContactos;
} {
  const reglas = params.reglas ?? REGLAS_CLASIFICACION_DEFECTO;

  const mapaExistentes = new Map<string, ContactoDirectorioRegistro>();
  for (const ex of params.existentesDirectorio ?? []) {
    const u9 = ex.telefonoUltimos9 || ultimos9TelefonoContacto(ex.telefonoE164);
    if (u9) mapaExistentes.set(u9, ex);
  }

  const mapaCrm = new Map<string, SemillaCrmContacto>();
  for (const crm of params.semillaCrm ?? []) {
    const u9 = crm.telefonoUltimos9 || ultimos9TelefonoContacto(crm.telefonoE164);
    if (u9) mapaCrm.set(u9, crm);
  }

  interface Acumulador {
    e164: string;
    u9: string;
    nombres: string[];
    correos: string[];
    notas: string[];
    etiquetas: string[];
    entradas: ContactoCrudoImportado[];
    hayAgendaPersonal: boolean;
    hayListaIgnorar: boolean;
    clasifExplicita: ClasificacionContacto | null;
  }

  const grupos = new Map<string, Acumulador>();
  let invalidos = 0;

  for (const raw of params.brutos) {
    const e164 = normalizarTelefonoE164Contacto(raw.telefono);
    const u9 = ultimos9TelefonoContacto(e164);
    if (!e164 || u9.length < 8) {
      invalidos++;
      continue;
    }

    let acc = grupos.get(u9);
    if (!acc) {
      acc = {
        e164,
        u9,
        nombres: [],
        correos: [],
        notas: [],
        etiquetas: [],
        entradas: [],
        hayAgendaPersonal: false,
        hayListaIgnorar: false,
        clasifExplicita: null,
      };
      grupos.set(u9, acc);
    }

    // Preferir número con prefijo +593 completo si antes había uno más corto
    if (e164.length > acc.e164.length) {
      acc.e164 = e164;
    }

    const nom = (raw.nombre || "").trim();
    if (nom) acc.nombres.push(nom);
    if (raw.correo && raw.correo.includes("@")) acc.correos.push(raw.correo.trim().toLowerCase());
    if (raw.notas?.trim()) acc.notas.push(raw.notas.trim());
    if (raw.etiquetas?.length) acc.etiquetas.push(...raw.etiquetas);
    if (raw.esAgendaPersonal !== false) acc.hayAgendaPersonal = true;
    if (raw.origen === "LISTA_IGNORAR") acc.hayListaIgnorar = true;
    if (raw.clasificacionSugerida) acc.clasifExplicita = raw.clasificacionSugerida;
    acc.entradas.push(raw);
  }

  const items: ContactoConsolidadoPreview[] = [];
  let duplicadosFusionados = 0;
  let conflictosNombre = 0;
  let totalPersonales = 0;
  let totalClientes = 0;
  let totalProveedoresOInternos = 0;
  let coincidenciasCrm = 0;
  let nuevos = 0;
  let actualizaciones = 0;

  for (const acc of grupos.values()) {
    const existente = mapaExistentes.get(acc.u9);
    const crm = mapaCrm.get(acc.u9);

    const mapaNombresUnicos = new Map<string, string>();
    const agregarCandidato = (n?: string | null) => {
      const limpio = String(n ?? "").trim();
      if (!limpio || esNombreGenericoTelefono(limpio)) return;
      const clave = normalizarTextoComparacion(limpio);
      if (!mapaNombresUnicos.has(clave)) {
        mapaNombresUnicos.set(clave, limpio);
      }
    };

    if (crm?.nombre) agregarCandidato(crm.nombre);
    if (existente?.nombreConsolidado) agregarCandidato(existente.nombreConsolidado);
    for (const n of acc.nombres) agregarCandidato(n);

    const nombresCandidatos = Array.from(mapaNombresUnicos.values());
    const tieneConflictoNombre = nombresCandidatos.length > 1;
    if (tieneConflictoNombre) conflictosNombre++;

    // Elegir nombre canónico más informativo (evitando genéricos)
    const nombreConsolidado =
      nombresCandidatos.slice().sort((a, b) => b.length - a.length)[0] ||
      `Contacto ${acc.e164}`;

    const correo =
      acc.correos[0] || crm?.correo || existente?.correo || null;

    const auto = clasificarContactoAutomaticamente({
      nombres: nombresCandidatos.length > 0 ? nombresCandidatos : acc.nombres,
      notas: acc.notas.join(" · "),
      etiquetas: acc.etiquetas,
      esAgendaPersonal: acc.hayAgendaPersonal,
      esListaIgnorar: acc.hayListaIgnorar,
      existeEnCrm: Boolean(crm),
      totalComprasCrm: crm?.totalCompras ?? existente?.totalComprasCrm ?? 0,
      clasificacionExplicita: acc.clasifExplicita,
      reglas,
    });

    // Si ya existía en el directorio y no viene forzado como lista a ignorar, respetamos decisión previa del admin
    const clasificacionFinal =
      existente && !acc.hayListaIgnorar && !acc.clasifExplicita
        ? existente.clasificacion
        : auto.clasificacion;
    const politicaIaFinal: PoliticaIaContacto =
      clasificacionFinal !== "CLIENTE"
        ? "SIEMPRE_MANUAL"
        : existente && !acc.hayListaIgnorar
          ? existente.politicaIa
          : auto.politicaIa;
    const visibilidadFinal: VisibilidadContacto =
      existente && !acc.hayListaIgnorar
        ? existente.visibilidad
        : auto.visibilidad;

    const motivo =
      existente && !acc.hayListaIgnorar
        ? `Ya clasificado en directorio (${existente.clasificacion})`
        : auto.motivo;

    const fuentes: ContactoFuenteRegistro[] = acc.entradas.map((ent) => ({
      origen: ent.origen,
      nombreOriginal: ent.nombre || nombreConsolidado,
      clasificacionOrigen: clasificacionFinal,
      politicaPersonal: visibilidadFinal,
      lineaWhatsappId: ent.lineaWhatsappId ?? null,
      lineaNombre: ent.lineaNombre ?? ent.etiquetaFuente ?? null,
      detalle: {
        etiquetaFuente: ent.etiquetaFuente ?? null,
        empresa: ent.empresa ?? null,
        etiquetas: ent.etiquetas ?? [],
      },
    }));

    const dup = Math.max(0, acc.entradas.length - 1);
    duplicadosFusionados += dup;

    if (clasificacionFinal === "PERSONAL") totalPersonales++;
    else if (clasificacionFinal === "CLIENTE") totalClientes++;
    else totalProveedoresOInternos++;

    if (crm) coincidenciasCrm++;
    if (existente) actualizaciones++;
    else nuevos++;

    items.push({
      claveConsolidacion: acc.u9,
      telefonoE164: acc.e164,
      telefonoUltimos9: acc.u9,
      nombreConsolidado,
      nombresCandidatos: nombresCandidatos.length > 0 ? nombresCandidatos : [nombreConsolidado],
      tieneConflictoNombre,
      correo,
      clasificacion: clasificacionFinal,
      politicaIa: politicaIaFinal,
      visibilidad: visibilidadFinal,
      motivoClasificacion: motivo,
      yaExisteEnDirectorio: Boolean(existente),
      existeEnCrm: Boolean(crm),
      totalComprasCrm: crm?.totalCompras ?? existente?.totalComprasCrm ?? 0,
      fuentes,
      duplicadosFusionados: dup,
      notas: acc.notas.length > 0 ? Array.from(new Set(acc.notas)).join(" | ") : null,
      seleccionado: true,
    });
  }

  // Ordenar: primero conflictos de nombre para revisión rápida, luego personales, luego clientes
  items.sort((a, b) => {
    if (a.tieneConflictoNombre !== b.tieneConflictoNombre) {
      return a.tieneConflictoNombre ? -1 : 1;
    }
    if (a.clasificacion !== b.clasificacion) {
      const orden: Record<ClasificacionContacto, number> = {
        PERSONAL: 0,
        CLIENTE: 1,
        PROVEEDOR: 2,
        EQUIPO_INTERNO: 3,
        BLOQUEADO_SPAM: 4,
      };
      return orden[a.clasificacion] - orden[b.clasificacion];
    }
    return a.nombreConsolidado.localeCompare(b.nombreConsolidado, "es");
  });

  return {
    items,
    resumen: {
      totalRegistrosBrutos: params.brutos.length,
      totalInvalidosDescartados: invalidos,
      totalConsolidados: items.length,
      duplicadosFusionados,
      conflictosNombre,
      totalPersonales,
      totalClientes,
      totalProveedoresOInternos,
      coincidenciasCrm,
      nuevos,
      actualizaciones,
    },
  };
}
