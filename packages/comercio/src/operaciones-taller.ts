// Modelos puros, consolidadores, formateadores y cola IndexedDB Offline-First
// para las 3 herramientas operativas de tienda y campo:
//   1. Inventario Fotográfico de Rosas con IA ARIA
//   2. Galería de Disponibles para Entrega Inmediata (1 a 2 horas)
//   3. Órdenes de Trabajo (Exequiales IESS), Confirmación Universal de Entregas e Informes Quincenales

export interface DefinicionColorRosa {
  clave: string;
  etiqueta: string;
  colorHex: string;
  fondoHex: string;
  textoHex: string;
}

export const COLORES_ROSAS_ESTANDAR: DefinicionColorRosa[] = [
  { clave: "rojo", etiqueta: "Rojos", colorHex: "#DC2626", fondoHex: "#FEF2F2", textoHex: "#991B1B" },
  {
    clave: "blanco",
    etiqueta: "Blancos",
    colorHex: "#CBD5E1",
    fondoHex: "#F8FAFC",
    textoHex: "#334155",
  },
  {
    clave: "rosado",
    etiqueta: "Rosados",
    colorHex: "#F472B6",
    fondoHex: "#FDF2F8",
    textoHex: "#9D174D",
  },
  {
    clave: "fucsia",
    etiqueta: "Fucsias",
    colorHex: "#DB2777",
    fondoHex: "#FCE7F3",
    textoHex: "#831843",
  },
  {
    clave: "amarillo",
    etiqueta: "Amarillos",
    colorHex: "#EAB308",
    fondoHex: "#FEFCE8",
    textoHex: "#854D0E",
  },
  {
    clave: "durazno",
    etiqueta: "Durazno / Salmón",
    colorHex: "#FB923C",
    fondoHex: "#FFF7ED",
    textoHex: "#9A3412",
  },
  {
    clave: "bicolor",
    etiqueta: "Bicolores",
    colorHex: "#8B5CF6",
    fondoHex: "#F5F3FF",
    textoHex: "#5B21B6",
  },
  {
    clave: "azul",
    etiqueta: "Azules / Tinturados",
    colorHex: "#2563EB",
    fondoHex: "#EFF6FF",
    textoHex: "#1E40AF",
  },
  {
    clave: "otro",
    etiqueta: "Otros tonos",
    colorHex: "#64748B",
    fondoHex: "#F1F5F9",
    textoHex: "#334155",
  },
];

export interface FotoConteoBonches {
  id: string;
  imagenUrl: string;
  nombreArchivo?: string;
  conteoColores: Record<string, number>;
  notaIa?: string;
  analizadoPorIa?: boolean;
}

export interface CorteInventarioRosas {
  id: string;
  secuencial?: number;
  negocio: string;
  localCodigo: string;
  fechaCorte: string;
  registradoPor?: string | null;
  registradoNombre: string;
  totalPaquetes: number;
  resumenColores: Record<string, number>;
  observaciones?: string | null;
  fotos: FotoConteoBonches[];
}

const DIAS_ES = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];
const MESES_CORTOS_ES = [
  "Ene",
  "Feb",
  "Mar",
  "Abr",
  "May",
  "Jun",
  "Jul",
  "Ago",
  "Sep",
  "Oct",
  "Nov",
  "Dic",
];

/**
 * Formatea un timestamp ISO al formato operativo requerido:
 * Ejemplo: "Lunes 16Nov 8:00AM"
 */
export function formatearFechaCorteInventario(iso?: string | null): string {
  if (!iso) return "Sin registro previo";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return String(iso);

  try {
    const partes = new Intl.DateTimeFormat("en-US", {
      timeZone: "America/Guayaquil",
      weekday: "short",
      day: "numeric",
      month: "numeric",
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    }).formatToParts(fecha);

    const map: Record<string, string> = {};
    for (const p of partes) {
      map[p.type] = p.value;
    }
    const idxSemana = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
      map.weekday || ""
    );
    const diaNombre = idxSemana >= 0 ? DIAS_ES[idxSemana] : "Día";
    const numDia = map.day || String(fecha.getDate());
    const idxMes = Math.max(0, Math.min(11, Number(map.month || 1) - 1));
    const mesCorto = MESES_CORTOS_ES[idxMes] || "";
    const hora = map.hour || "12";
    const min = map.minute || "00";
    const ampm = (map.dayPeriod || "AM").toUpperCase().replace(/\s+/g, "");

    return `${diaNombre} ${numDia}${mesCorto} ${hora}:${min}${ampm}`;
  } catch {
    const d = DIAS_ES[fecha.getDay()] || "";
    const mes = MESES_CORTOS_ES[fecha.getMonth()] || "";
    const h24 = fecha.getHours();
    const ampm = h24 >= 12 ? "PM" : "AM";
    const h12 = h24 % 12 || 12;
    const min = String(fecha.getMinutes()).padStart(2, "0");
    return `${d} ${fecha.getDate()}${mes} ${h12}:${min}${ampm}`;
  }
}

export function consolidarFotosInventario(fotos: FotoConteoBonches[]): {
  resumenColores: Record<string, number>;
  totalPaquetes: number;
} {
  const resumen: Record<string, number> = {};
  let total = 0;

  for (const foto of fotos) {
    for (const [color, valor] of Object.entries(foto.conteoColores || {})) {
      const n = Math.max(0, Math.round(Number(valor) || 0));
      if (n <= 0) continue;
      const clave = normalizarClaveColorRosa(color);
      resumen[clave] = (resumen[clave] ?? 0) + n;
      total += n;
    }
  }

  return { resumenColores: resumen, totalPaquetes: total };
}

export function normalizarClaveColorRosa(texto: string): string {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();

  if (t.includes("roj") || t.includes("explorer") || t.includes("red")) return "rojo";
  if (t.includes("blanc") || t.includes("mondial") || t.includes("playa") || t.includes("white"))
    return "blanco";
  if (t.includes("rosa") || t.includes("rozad") || t.includes("pink") && !t.includes("floyd"))
    return "rosado";
  if (t.includes("fucsia") || t.includes("floyd") || t.includes("cherry") || t.includes("magenta"))
    return "fucsia";
  if (t.includes("amarill") || t.includes("yellow") || t.includes("girasol")) return "amarillo";
  if (
    t.includes("durazn") ||
    t.includes("kahala") ||
    t.includes("salmon") ||
    t.includes("naranja") ||
    t.includes("coral")
  )
    return "durazno";
  if (t.includes("bicolor") || t.includes("matiz") || t.includes("magic")) return "bicolor";
  if (t.includes("azul") || t.includes("celeste") || t.includes("tintur")) return "azul";
  return "otro";
}

export function formatearResumenInventarioTexto(resumenColores?: Record<string, number> | null): string {
  if (!resumenColores) return "0 paquetes";
  const partes: string[] = [];

  for (const def of COLORES_ROSAS_ESTANDAR) {
    const cant = Number(resumenColores[def.clave]) || 0;
    if (cant > 0) {
      partes.push(`${cant} ${def.etiqueta.toLowerCase()}`);
    }
  }
  for (const [k, v] of Object.entries(resumenColores)) {
    const cant = Number(v) || 0;
    if (cant > 0 && !COLORES_ROSAS_ESTANDAR.some((d) => d.clave === k)) {
      partes.push(`${cant} ${k}`);
    }
  }

  return partes.length > 0 ? partes.join(", ") : "0 paquetes";
}

/**
 * Extrae el conteo por colores desde la respuesta del agente ARIA (JSON puro,
 * bloque ```json ... ``` o lenguaje natural tipo "10 rojos, 5 blancos, 2 rosados").
 */
export function extraerConteoJsonDesdeRespuestaAria(texto: string): {
  conteoColores: Record<string, number>;
  notaIa?: string;
} {
  const limpio = String(texto || "").trim();
  if (!limpio) return { conteoColores: {} };

  const bloqueJson =
    limpio.match(/```(?:json)?\s*([\s\S]*?)```/i)?.[1] ??
    limpio.match(/(\{[\s\S]*\})/)?.[1] ??
    null;

  if (bloqueJson) {
    try {
      const parsed = JSON.parse(bloqueJson) as Record<string, unknown>;
      const origenColores =
        parsed.colores && typeof parsed.colores === "object"
          ? (parsed.colores as Record<string, unknown>)
          : parsed;
      const conteo: Record<string, number> = {};
      for (const [k, v] of Object.entries(origenColores)) {
        if (k === "nota" || k === "observacion" || k === "total" || k === "total_paquetes") continue;
        const n = Math.round(Number(v) || 0);
        if (n > 0) {
          const clave = normalizarClaveColorRosa(k);
          conteo[clave] = (conteo[clave] ?? 0) + n;
        }
      }
      const nota =
        typeof parsed.nota === "string"
          ? parsed.nota
          : typeof parsed.observacion === "string"
            ? parsed.observacion
            : undefined;
      if (Object.keys(conteo).length > 0 || nota) {
        return { conteoColores: conteo, notaIa: nota };
      }
    } catch {
      // Continuar con extracción por expresiones regulares en español
    }
  }

  const conteoRegex: Record<string, number> = {};
  const regexPares =
    /(\d{1,3})\s+(?:paquetes?\s+(?:de\s+)?|bonches?\s+(?:de\s+)?)?(rojos?|rojas?|blancos?|blancas?|rosados?|rosadas?|rozados?|fucsias?|amarillos?|amarillas?|duraznos?|naranjas?|bicolore?s?|azules?)/gi;
  let m: RegExpExecArray | null;
  while ((m = regexPares.exec(limpio)) !== null) {
    const n = Number(m[1]) || 0;
    const col = normalizarClaveColorRosa(m[2] || "");
    if (n > 0) {
      conteoRegex[col] = (conteoRegex[col] ?? 0) + n;
    }
  }

  return { conteoColores: conteoRegex, notaIa: limpio.slice(0, 180) };
}

// =============================================================================
// MÓDULO 2: GALERÍA DE DISPONIBLES PARA ENTREGA INMEDIATA (1 A 2 HORAS)
// =============================================================================

export interface ArregloEntregaInmediata {
  productoId: string;
  varianteId: string;
  slug: string;
  sku: string;
  nombre: string;
  descripcion: string;
  precio: number;
  precioComparacion?: number | null;
  imagenUrl: string;
  galeriaUrls: string[];
  stockDisponible: number;
  tiempoEntregaTexto: string;
  activo: boolean;
  motivoBaja?: string | null;
  ordenVentaCodigo?: string | null;
  creadoEn: string;
  actualizadoEn?: string;
}

// =============================================================================
// MÓDULO 3: ÓRDENES DE TRABAJO (EXEQUIALES IESS), CONFIRMACIÓN POD & OFFLINE
// =============================================================================

export interface DatosProveedorInformeIess {
  tituloInforme: string;
  nombreProveedor: string;
  razonSocial: string;
  ruc: string;
  direccion: string;
  telefono: string;
  correoElectronico: string;
  personaContacto: string;
  descripcionServicioDefecto?: string;
  recursosDefecto?: string;
}

export const OPCIONES_SALA_EXEQUIALES = [
  "Sala 1",
  "Sala 2",
  "Sala 3",
  "Sala 4",
  "Capilla / Oficina",
] as const;

export const OPCIONES_DESCRIPCION_SERVICIO_EXEQUIALES = [
  "Set condolencias (3 arreglos)",
  "Cubre cofre (1 arreglo)",
] as const;

export const SOLICITANTES_EXEQUIALES_FRECUENTES = [
  "Cristian Montaluisa",
  "Cristina",
] as const;

export const RANGOS_HORARIO_ENTREGA_TIENDA = [
  { codigo: "A", valor: "A) 09:00 - 13:00", etiqueta: "A) 09:00 - 13:00", corto: "09:00–13:00" },
  { codigo: "B", valor: "B) 13:00 - 17:00", etiqueta: "B) 13:00 - 17:00", corto: "13:00–17:00" },
  { codigo: "C", valor: "C) 17:00 - 20:00", etiqueta: "C) 17:00 - 20:00", corto: "17:00–20:00" },
] as const;

export type ModoSelectorHorarioEntrega =
  | "A) 09:00 - 13:00"
  | "B) 13:00 - 17:00"
  | "C) 17:00 - 20:00"
  | "HORA_EXACTA"
  | "LO_ANTES_POSIBLE";

export function normalizarFranjaHorariaTienda(valor?: string | null): string {
  const v = (valor || "").trim();
  if (!v) return "A) 09:00 - 13:00";
  const low = v.toLowerCase();
  if (low === "manana" || low === "mañana" || low.startsWith("a)") || low.includes("09:00")) {
    return "A) 09:00 - 13:00";
  }
  if (
    low === "tarde" ||
    low.startsWith("b)") ||
    low.includes("13:00") ||
    low.includes("14:00")
  ) {
    return "B) 13:00 - 17:00";
  }
  if (low === "noche" || low.startsWith("c)") || low.includes("17:00")) {
    return "C) 17:00 - 20:00";
  }
  return v;
}

export function extraerHoraHhMm(valor?: string | null): string {
  const txt = String(valor || "").trim();
  const match = txt.match(/\b(\d{1,2}):(\d{2})\b/);
  if (!match) return "";
  const hh = Number(match[1]);
  const mm = Number(match[2]);
  if (Number.isNaN(hh) || Number.isNaN(mm) || hh < 0 || hh > 23 || mm < 0 || mm > 59) {
    return "";
  }
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
}

export function inferirFranjaDesdeHoraExacta(hora?: string | null): string {
  const hhmm = extraerHoraHhMm(hora);
  if (!hhmm) return "A) 09:00 - 13:00";
  const hh = Number(hhmm.slice(0, 2));
  if (hh < 13) return "A) 09:00 - 13:00";
  if (hh < 17) return "B) 13:00 - 17:00";
  return "C) 17:00 - 20:00";
}

export function resolverEstadoInicialHorario(entrada: {
  franjaHoraria?: string | null;
  horaEspecifica?: string | null;
  esExequiales?: boolean;
}): { modo: ModoSelectorHorarioEntrega; horaExacta: string } {
  const hEsp = String(entrada.horaEspecifica || "").trim();
  const franja = String(entrada.franjaHoraria || "").trim();

  if (hEsp) {
    const lowH = hEsp.toLowerCase();
    if (lowH.includes("antes posible") || lowH === "urgente" || lowH === "inmediata") {
      return { modo: "LO_ANTES_POSIBLE", horaExacta: "" };
    }
    if (
      lowH.startsWith("a)") ||
      lowH.startsWith("b)") ||
      lowH.startsWith("c)") ||
      lowH.includes("09:00 - 13:00") ||
      lowH.includes("13:00 - 17:00") ||
      lowH.includes("17:00 - 20:00")
    ) {
      return {
        modo: normalizarFranjaHorariaTienda(hEsp) as ModoSelectorHorarioEntrega,
        horaExacta: "",
      };
    }
    const hhmm = extraerHoraHhMm(hEsp);
    if (hhmm) {
      return { modo: "HORA_EXACTA", horaExacta: hhmm };
    }
  }

  if (franja) {
    const lowF = franja.toLowerCase();
    if (lowF.includes("antes posible") || lowF === "urgente") {
      return { modo: "LO_ANTES_POSIBLE", horaExacta: "" };
    }
    if (lowF === "hora_exacta") {
      return { modo: "HORA_EXACTA", horaExacta: extraerHoraHhMm(hEsp) || "10:30" };
    }
    const hhmmEnFranja =
      !lowF.startsWith("a)") &&
      !lowF.startsWith("b)") &&
      !lowF.startsWith("c)") &&
      !lowF.includes("-")
        ? extraerHoraHhMm(franja)
        : "";
    if (hhmmEnFranja) {
      return { modo: "HORA_EXACTA", horaExacta: hhmmEnFranja };
    }
    const norm = normalizarFranjaHorariaTienda(franja);
    if (
      norm === "A) 09:00 - 13:00" ||
      norm === "B) 13:00 - 17:00" ||
      norm === "C) 17:00 - 20:00"
    ) {
      return { modo: norm, horaExacta: "" };
    }
  }

  return {
    modo: entrada.esExequiales ? "LO_ANTES_POSIBLE" : "A) 09:00 - 13:00",
    horaExacta: "",
  };
}

export function construirValoresHorarioGuardar(
  modo: ModoSelectorHorarioEntrega,
  horaExacta: string
): { franjaHoraria: string | null; horaEspecifica: string | null } {
  if (modo === "LO_ANTES_POSIBLE") {
    return {
      franjaHoraria: null,
      horaEspecifica: "Lo antes posible",
    };
  }
  if (modo === "HORA_EXACTA") {
    const limpia = extraerHoraHhMm(horaExacta) || horaExacta.trim();
    return {
      franjaHoraria: limpia ? inferirFranjaDesdeHoraExacta(limpia) : "A) 09:00 - 13:00",
      horaEspecifica: limpia || null,
    };
  }
  return {
    franjaHoraria: normalizarFranjaHorariaTienda(modo),
    horaEspecifica: null,
  };
}

export function formatearHorarioEntregaOrden(entrada: {
  franjaHoraria?: string | null;
  horaEspecifica?: string | null;
  esExequiales?: boolean;
}): string {
  const hEsp = String(entrada.horaEspecifica || "").trim();
  const franja = String(entrada.franjaHoraria || "").trim();
  if (hEsp) {
    if (hEsp.toLowerCase().includes("antes posible")) {
      return "Lo antes posible";
    }
    const hhmm = extraerHoraHhMm(hEsp);
    if (hhmm) {
      return `Hora exacta: ${hhmm}`;
    }
    return hEsp;
  }
  if (franja && franja.toLowerCase() !== "hora_exacta") {
    return franja;
  }
  return entrada.esExequiales ? "Lo antes posible" : "A) 09:00 - 13:00";
}

export function esNombreFallecidoPendiente(valor?: string | null): boolean {
  const v = String(valor || "")
    .trim()
    .toLowerCase();
  if (!v) return true;
  return (
    v === "por coordinar" ||
    v === "por confirmar" ||
    v.startsWith("por confirmar (") ||
    v.startsWith("por coordinar (") ||
    v === "destinatario"
  );
}

export type EstadoOrdenTaller =
  | "PENDIENTE_ENVIO"
  | "ENVIADO_TALLER"
  | "EN_PREPARACION"
  | "LISTO_ENTREGA"
  | "ENTREGADO"
  | "ANULADO";

export type OrigenOrdenTaller =
  | "VENTA_TIENDA"
  | "PROFORMA_EVENTO"
  | "MANUAL_ADMIN"
  | "EXEQUIALES_LLAMADA";

export type ClasificacionOperativaPedido =
  | "FLORISTERIA_OCASIONES"
  | "CONDOLENCIAS"
  | "EVENTOS"
  | "EXEQUIALES";

export interface DefinicionClasificacionPedido {
  clave: ClasificacionOperativaPedido;
  etiqueta: string;
  etiquetaCorta: string;
  descripcion: string;
  /** Nombre semántico del ícono Lucide */
  iconoClave: "Flower2" | "HeartHandshake" | "Sparkles" | "Ribbon";
  /** Paleta activa (pedido pendiente / en curso) */
  acentoHex: string;
  fondoHex: string;
  bordeHex: string;
  textoHex: string;
  /** Paleta atenuada/opaca (entrega confirmada en calendario) */
  acentoOpacoHex: string;
  fondoOpacoHex: string;
  bordeOpacoHex: string;
  textoOpacoHex: string;
}

export const CLASIFICACIONES_OPERATIVAS_PEDIDO: readonly DefinicionClasificacionPedido[] = [
  {
    clave: "FLORISTERIA_OCASIONES",
    etiqueta: "Floristería / Ocasiones",
    etiquetaCorta: "Floristería / Ocasiones",
    descripcion: "Ramos, box florales, cumpleaños, aniversarios y ocasiones especiales (domicilio o retiro)",
    iconoClave: "Flower2",
    acentoHex: "#3D5A45",
    fondoHex: "#F3F6F3",
    bordeHex: "#C9D6CC",
    textoHex: "#2C4232",
    acentoOpacoHex: "#6E655D",
    fondoOpacoHex: "#F5F2EC",
    bordeOpacoHex: "#DDD5C9",
    textoOpacoHex: "#574E46",
  },
  {
    clave: "CONDOLENCIAS",
    etiqueta: "Condolencias",
    etiquetaCorta: "Condolencias",
    descripcion: "Coronas, pedestales y arreglos fúnebres particulares con tarjeta y dirección de entrega",
    iconoClave: "HeartHandshake",
    acentoHex: "#4E4740",
    fondoHex: "#F6F3EE",
    bordeHex: "#D8D0C5",
    textoHex: "#332E29",
    acentoOpacoHex: "#7A7269",
    fondoOpacoHex: "#F5F2EC",
    bordeOpacoHex: "#DDD5C9",
    textoOpacoHex: "#574E46",
  },
  {
    clave: "EVENTOS",
    etiqueta: "Eventos",
    etiquetaCorta: "Eventos",
    descripcion: "Decoración floral, ceremonias, bodas, montajes especiales y mobiliario",
    iconoClave: "Sparkles",
    acentoHex: "#9C5266",
    fondoHex: "#FAF4F6",
    bordeHex: "#E6CED5",
    textoHex: "#733747",
    acentoOpacoHex: "#876F76",
    fondoOpacoHex: "#F5F0F2",
    bordeOpacoHex: "#DFD1D5",
    textoOpacoHex: "#5C4A4F",
  },
  {
    clave: "EXEQUIALES",
    etiqueta: "Exequiales",
    etiquetaCorta: "Exequiales",
    descripcion: "Órdenes de convenio Exequiales por sala y persona fallecida (sin tarjeta ni dirección)",
    iconoClave: "Ribbon",
    acentoHex: "#63506B",
    fondoHex: "#F6F3F8",
    bordeHex: "#DBD1E0",
    textoHex: "#47374E",
    acentoOpacoHex: "#7D7282",
    fondoOpacoHex: "#F4F1F5",
    bordeOpacoHex: "#D9D2DC",
    textoOpacoHex: "#594F5E",
  },
] as const;

export function obtenerDefinicionClasificacionPedido(
  clave?: string | null
): DefinicionClasificacionPedido {
  const norm = String(clave || "").trim().toUpperCase();
  if (norm === "DOMICILIO" || norm === "LOCAL" || norm === "OCASIONES" || norm === "FLORISTERIA") {
    return CLASIFICACIONES_OPERATIVAS_PEDIDO[0]!;
  }
  if (norm === "MOBILIARIO" || norm === "RENTA") {
    return CLASIFICACIONES_OPERATIVAS_PEDIDO.find((c) => c.clave === "EVENTOS")!;
  }
  return (
    CLASIFICACIONES_OPERATIVAS_PEDIDO.find((c) => c.clave === norm) ??
    CLASIFICACIONES_OPERATIVAS_PEDIDO[0]!
  );
}

export function inferirClasificacionPedido(entrada: {
  clasificacionExplicita?: string | null;
  origenTipo?: string | null;
  retiroEnLocal?: boolean | null;
  salaServicio?: string | null;
  productoResumen?: string | null;
  ubicacionEntrega?: string | null;
  metodoPago?: string | null;
  tarjetaTipo?: string | null;
  tieneEvento?: boolean;
  items?: Array<{
    descripcion?: string;
    sku?: string;
    esRenta?: boolean;
    tipoOferta?: string;
  }> | null;
}): ClasificacionOperativaPedido {
  const exp = String(entrada.clasificacionExplicita || "")
    .trim()
    .toUpperCase();

  if (
    exp === "FLORISTERIA_OCASIONES" ||
    exp === "CONDOLENCIAS" ||
    exp === "EVENTOS" ||
    exp === "EXEQUIALES"
  ) {
    return exp;
  }
  if (exp === "FLORISTERIA" || exp === "OCASIONES" || exp === "FLORISTERIA_OCACION" || exp === "FLORISTERIAOCACIONES") {
    return "FLORISTERIA_OCASIONES";
  }
  if (exp === "CONDOLENCIA" || exp === "FUNERARIO" || exp === "FUNEBRE" || exp === "FÚNEBRE") {
    return "CONDOLENCIAS";
  }
  if (exp === "EXEQUIAL") {
    return "EXEQUIALES";
  }
  if (exp === "EVENTO" || exp === "CEREMONIA" || exp === "MOBILIARIO" || exp === "RENTA" || exp === "ALQUILER") {
    return "EVENTOS";
  }

  const orig = String(entrada.origenTipo || "")
    .trim()
    .toUpperCase();
  const sala = String(entrada.salaServicio || "").trim();
  const prod = String(entrada.productoResumen || "").toLowerCase();
  const ubic = String(entrada.ubicacionEntrega || "").toLowerCase();
  const met = String(entrada.metodoPago || "").toLowerCase();
  const tarTipo = String(entrada.tarjetaTipo || "").toUpperCase();
  const itemsTxt = (entrada.items ?? [])
    .map((it) => `${it.descripcion || ""} ${it.sku || ""} ${it.tipoOferta || ""}`)
    .join(" ")
    .toLowerCase();
  const itemsTieneRenta = (entrada.items ?? []).some(
    (it) => it.esRenta === true || String(it.tipoOferta || "").toUpperCase() === "RENTA"
  );

  // 1. Exequiales (convenio Exequiales / llamada / sala Exequiales)
  if (
    orig === "EXEQUIALES_LLAMADA" ||
    orig === "ORDEN_TRABAJO_CONVENIO" ||
    Boolean(sala) ||
    met.includes("convenio") ||
    ubic.includes("exequial") ||
    ubic.includes("iess")
  ) {
    return "EXEQUIALES";
  }

  // 2. Condolencias particulares (coronas, pedestales fúnebres, funerarias, tarjeta condolencias)
  if (
    tarTipo === "CONDOLENCIAS_PLANA" ||
    prod.includes("condolencia") ||
    prod.includes("corona") ||
    prod.includes("fúnebre") ||
    prod.includes("funebre") ||
    prod.includes("cubre cofre") ||
    prod.includes("cubrecofre") ||
    prod.includes("trípode") ||
    prod.includes("tripode") ||
    prod.includes("luto") ||
    prod.includes("sepelio") ||
    itemsTxt.includes("condolencia") ||
    itemsTxt.includes("corona") ||
    itemsTxt.includes("fúnebre") ||
    itemsTxt.includes("funebre") ||
    ubic.includes("camposanto") ||
    ubic.includes("monteolivo") ||
    ubic.includes("funeraria") ||
    ubic.includes("sala de velación") ||
    ubic.includes("sala de velacion") ||
    ubic.includes("tanatorio") ||
    ubic.includes("cementerio") ||
    ubic.includes("jardines del valle") ||
    ubic.includes("memorial")
  ) {
    return "CONDOLENCIAS";
  }

  // 3. Eventos (proformas de evento, ceremonias, montajes y renta de mobiliario)
  if (
    orig === "PROFORMA_EVENTO" ||
    entrada.tieneEvento === true ||
    itemsTieneRenta ||
    prod.includes("en renta") ||
    prod.includes("alquiler") ||
    prod.includes("mobiliario") ||
    prod.includes("arco floral") ||
    prod.includes("montaje de evento") ||
    prod.includes("decoración de evento") ||
    prod.includes("decoracion de evento") ||
    prod.includes("backing") ||
    prod.includes("mampara") ||
    prod.includes("cilindro") ||
    itemsTxt.includes("en renta") ||
    itemsTxt.includes("mobiliario") ||
    itemsTxt.includes("alquiler")
  ) {
    return "EVENTOS";
  }

  // 4. Floristería / Ocasiones (incluye valores heredados DOMICILIO / LOCAL)
  return "FLORISTERIA_OCASIONES";
}

export function esEntregaConfirmadaOrden(
  orden: Pick<OrdenTrabajoTaller, "estadoTaller" | "entregadoEn" | "evidenciaFotoUrl" | "estadoEvidencia">
): boolean {
  if (orden.estadoTaller === "ENTREGADO") return true;
  if (orden.entregadoEn) return true;
  if (
    orden.estadoEvidencia &&
    orden.estadoEvidencia !== "PROGRAMADA" &&
    orden.estadoEvidencia !== "ANULADA"
  ) {
    return true;
  }
  return Boolean(orden.evidenciaFotoUrl && orden.evidenciaFotoUrl.trim());
}

export interface ItemOrdenTaller {
  productoId?: string;
  sku?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario?: number;
  dedicatoria?: string;
  esRenta?: boolean;
  tipoOferta?: string;
}

export type ClaveFuenteTarjeta =
  | "cursiva"
  | "caligrafia"
  | "manuscrita"
  | "editorial"
  | "clasica"
  | "moderna"
  | "serif"
  | "formal";

export interface ImagenDisenoTarjeta {
  id: string;
  url: string;
  xPct: number;
  yPct: number;
  anchoMm: number;
  /** Cuando es true, la imagen cubre el 100% del espacio de la cartulina como fondo */
  cubrirTarjeta?: boolean;
  escalaGrises?: boolean;
  opacidad?: number;
}

export interface BloqueTextoTarjeta {
  id: string;
  rol: "mensaje" | "firma" | "extra";
  texto?: string;
  fuente?: ClaveFuenteTarjeta;
  tamanoPt?: number;
  alineacion?: "left" | "center" | "right" | "justify";
  negrita?: boolean;
  italica?: boolean;
  colorHex?: string;
  xPct: number;
  yPct: number;
  anchoPct: number;
}

export interface DisenoVisualTarjeta {
  fuente?: ClaveFuenteTarjeta;
  tamanoPt?: number;
  alineacion?: "left" | "center" | "right" | "justify";
  negrita?: boolean;
  italica?: boolean;
  textoXPct?: number;
  textoYPct?: number;
  textoAnchoPct?: number;
  /** Mostrar cuadro de firma ("De parte de") en la tarjeta impresa y digital */
  mostrarFirma?: boolean;
  /** Bloques de texto configurables (firma + cuadros adicionales arrastrables) */
  bloquesTexto?: BloqueTextoTarjeta[];
  /** Hasta 3 imágenes independientes (arrastrables y ampliables hasta 100% de la tarjeta) */
  imagenes?: ImagenDisenoTarjeta[];
  /** Campos legados conservados por retrocompatibilidad */
  imagenUrl?: string | null;
  imagenXPct?: number;
  imagenYPct?: number;
  imagenAnchoMm?: number;
  escalaGrisesImagen?: boolean;
}

export interface OrdenTrabajoTaller {
  id: string;
  codigo: string;
  origenTipo: OrigenOrdenTaller;
  /** Clasificación operativa canónica: Domicilio | Local | Exequiales | Eventos | Mobiliario */
  clasificacionPedido?: ClasificacionOperativaPedido;
  proformaId?: string | null;
  entregaId?: string | null;
  estadoTaller: EstadoOrdenTaller;
  estadoPago?: string;
  metodoPago?: string;
  fechaPedido: string;
  /** Fecha en que el pedido debe entregarse al cliente / sala (YYYY-MM-DD) */
  fechaEntrega: string;
  /** Fecha en que el operador programó o envió a elaboración en taller (YYYY-MM-DD) */
  fechaElaboracion?: string;
  /** Para ventas regulares: A) 09:00 - 13:00 | B) 13:00 - 17:00 | C) 17:00 - 20:00 */
  franjaHoraria?: string | null;
  /** Para Exequiales o entregas puntuales: hora solicitada (ej. '10:30' o 'Lo antes posible') */
  horaEspecifica?: string | null;
  productoResumen: string;
  items: ItemOrdenTaller[];
  /** Colores de flores/envoltura solicitados para el taller (ej. "Rojo, Blanco, Dorado") */
  colores?: string | null;
  /** Extras incluidos en el arreglo (ej. "Ferrero x8, Globo metalizado") */
  extras?: string | null;
  /** Orden manual de elaboración priorizado por operador (#1, #2, #3...) */
  prioridadOrden?: number | null;
  /** Comprador o persona que solicita en llamada Exequiales ("Cristian Montaluisa", "Cristina") */
  clienteSolicita: string;
  clienteTelefono?: string;
  /** Destinatario del arreglo o nombre del fallecido en Exequiales */
  destinatarioFallecido: string;
  salaServicio?: string | null;
  ubicacionEntrega?: string;
  enlaceMapa?: string | null;
  retiroEnLocal?: boolean;
  dedicatoria?: string;
  tarjetaTipo?: "DIPTICO" | "CONDOLENCIAS_PLANA" | "SOLO_DIGITAL";
  tarjetaToken?: string;
  tarjetaMusicaUrl?: string | null;
  tarjetaMusicaTitulo?: string | null;
  tarjetaLyrics?: Array<{ tiempo?: number; texto: string }>;
  /** Token exclusivo para editar la tarjeta (/tarjeta-editar/[token]), separado del token público de visualización (/dedicatoria/[token]) */
  tarjetaTokenEdicion?: string;
  /** Cuando es true (confidencialidad/discreción), en la cartulina física solo se imprime el QR sin mostrar el mensaje escrito */
  tarjetaConfidencial?: boolean;
  /** Parámetros de diseño gráfico interactivo (posición X/Y, alineación/justificación, tipografía e imagen opcional) */
  tarjetaDiseno?: DisenoVisualTarjeta;
  tarjetaMetadata?: {
    origen?: string;
    creado_por?: string;
    token_edicion?: string;
    confidencial_solo_qr?: boolean;
    diseno?: DisenoVisualTarjeta;
    historial_cambios?: Array<{
      autor?: string;
      rol?: string;
      fecha?: string;
      dedicatoria_anterior?: string;
      dedicatoria_nueva?: string;
      musica_url_anterior?: string | null;
      musica_url_nueva?: string | null;
    }>;
    vistas_cliente?: number;
    ultima_vista_en?: string;
    editado_por_cliente?: boolean;
    ultima_edicion_cliente_en?: string;
    editado_por_staff?: boolean;
    ultimo_editor_nombre?: string;
    ultimo_editor_rol?: string;
    ultima_edicion_staff_en?: string;
    impresiones?: number;
    ultima_impresion_en?: string;
    ultimo_impreso_por?: string;
  };
  observaciones?: string;
  totalUsd?: number;
  enviadoTallerEn?: string | null;
  enviadoNombre?: string | null;
  preparacionEn?: string | null;
  listoEn?: string | null;
  entregadoEn?: string | null;
  actualizadoTallerNombre?: string | null;
  repartidorId?: string | null;
  repartidorNombre?: string | null;
  repartidorTipo?: "INTERNO" | "EXTERNO" | string | null;
  enRuta?: boolean;
  enRutaDesde?: string | null;
  rutaLatitud?: number | null;
  rutaLongitud?: number | null;
  rutaActualizadaEn?: string | null;
  /** Evidencia de entrega confirmada (almacenada igual para Exequiales y resto de entregas) */
  evidenciaFotoUrl?: string | null;
  evidenciaMapaUrl?: string | null;
  evidenciaLatitud?: number | null;
  evidenciaLongitud?: number | null;
  evidenciaDireccionGps?: string | null;
  entregadoPorNombre?: string | null;
  estadoEvidencia?: EstadoEntregaEvidencia | string | null;
  numeroInforme?: string | null;
  /** Auditoría de borrado lógico (solo visible en Papelera del Administrador) */
  eliminadoEn?: string | null;
  eliminadoPorNombre?: string | null;
  eliminadoMotivo?: string | null;
}

export interface RepartidorDisponibleNegocio {
  usuarioId: string;
  nombre: string;
  correo?: string;
  modalidad: "INTERNO" | "EXTERNO";
}

export interface ProductoLigeroSelectorTaller {
  productoId: string;
  productoNombre: string;
  tipoProducto?: string;
  esRenta?: boolean;
  varianteId?: string;
  sku: string;
  varianteNombre: string;
  pvp: number;
  portadaUrl?: string;
}

export function obtenerFechaHoyEcuadorYmd(base: Date = new Date()): string {
  try {
    const partes = new Intl.DateTimeFormat("en-CA", {
      timeZone: "America/Guayaquil",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).formatToParts(base);
    const y = partes.find((p) => p.type === "year")?.value;
    const m = partes.find((p) => p.type === "month")?.value;
    const d = partes.find((p) => p.type === "day")?.value;
    if (y && m && d) return `${y}-${m}-${d}`;
  } catch {
    // Fallback UTC-5 manual
  }
  const ajustada = new Date(base.getTime() - 5 * 3600 * 1000);
  return ajustada.toISOString().slice(0, 10);
}

export function sumarDiasYmd(ymd: string, dias: number): string {
  const limpio = (ymd || "").slice(0, 10);
  const [y, m, d] = limpio.split("-").map((n) => Number(n));
  if (!y || !m || !d) return obtenerFechaHoyEcuadorYmd();
  const dt = new Date(Date.UTC(y, m - 1, d + dias, 12, 0, 0));
  return dt.toISOString().slice(0, 10);
}

export function obtenerRangoSemanaLunesADomingo(ymdReferencia: string): {
  inicioLunes: string;
  finDomingo: string;
  dias: string[];
} {
  const limpio = (ymdReferencia || "").slice(0, 10);
  const [y, m, d] = limpio.split("-").map((n) => Number(n));
  const base = y && m && d ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : new Date();
  const dow = base.getUTCDay(); // 0 Dom .. 6 Sab
  const offsetALunes = dow === 0 ? -6 : 1 - dow;
  const lunes = new Date(base.getTime() + offsetALunes * 86400 * 1000);
  const dias: string[] = [];
  for (let i = 0; i < 7; i++) {
    const cur = new Date(lunes.getTime() + i * 86400 * 1000);
    dias.push(cur.toISOString().slice(0, 10));
  }
  return {
    inicioLunes: dias[0]!,
    finDomingo: dias[6]!,
    dias,
  };
}

export interface CeldaDiaCalendarioMes {
  ymd: string;
  diaMes: number;
  enMesActual: boolean;
}

export function generarCuadriculaMesCalendario(anio: number, mes1a12: number): CeldaDiaCalendarioMes[] {
  const primerDia = new Date(Date.UTC(anio, mes1a12 - 1, 1, 12, 0, 0));
  const dow = primerDia.getUTCDay(); // 0 Dom .. 6 Sab
  const offsetInicio = dow === 0 ? -6 : 1 - dow;
  const cursor = new Date(primerDia.getTime() + offsetInicio * 86400 * 1000);

  const celdas: CeldaDiaCalendarioMes[] = [];
  for (let i = 0; i < 42; i++) {
    const dt = new Date(cursor.getTime() + i * 86400 * 1000);
    celdas.push({
      ymd: dt.toISOString().slice(0, 10),
      diaMes: dt.getUTCDate(),
      enMesActual: dt.getUTCMonth() === mes1a12 - 1 && dt.getUTCFullYear() === anio,
    });
  }
  return celdas;
}

/**
 * Determina si una orden corresponde a la vista "Hoy (Elaboración)" de una fecha dada:
 * incluye tanto pedidos cuya entrega es ese día como pedidos ya despachados/programados
 * para elaborarse ese día aunque su entrega sea mañana o días futuros.
 */
export function esPedidoDeElaboracionEnFecha(
  orden: Pick<
    OrdenTrabajoTaller,
    "fechaEntrega" | "fechaElaboracion" | "enviadoTallerEn" | "estadoTaller"
  >,
  fechaYmd: string,
  hoyYmd: string
): boolean {
  if (orden.estadoTaller === "ANULADO") return false;
  const fEnt = (orden.fechaEntrega || "").slice(0, 10);
  const fElab =
    (orden.fechaElaboracion || "").slice(0, 10) ||
    (orden.enviadoTallerEn ? orden.enviadoTallerEn.slice(0, 10) : "");

  if (fEnt === fechaYmd) return true;
  if (fElab && fElab === fechaYmd && fEnt >= fechaYmd) return true;
  if (
    fechaYmd === hoyYmd &&
    (orden.estadoTaller === "ENVIADO_TALLER" || orden.estadoTaller === "EN_PREPARACION") &&
    fEnt >= hoyYmd
  ) {
    return true;
  }
  return false;
}

export function formatearFechaEntregaHumana(ymd: string, hoyYmd?: string): {
  etiquetaPrincipal: string;
  horizonte: "HOY" | "MANANA" | "FUTURO" | "PASADO";
} {
  const baseHoy = hoyYmd || obtenerFechaHoyEcuadorYmd();
  const limpio = (ymd || "").slice(0, 10);
  if (!limpio) return { etiquetaPrincipal: "Sin fecha", horizonte: "HOY" };
  const manana = sumarDiasYmd(baseHoy, 1);

  const [y, m, d] = limpio.split("-").map((n) => Number(n));
  const dt = y && m && d ? new Date(Date.UTC(y, m - 1, d, 12, 0, 0)) : new Date();
  const diasNom = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];
  const mesesNom = [
    "Ene",
    "Feb",
    "Mar",
    "Abr",
    "May",
    "Jun",
    "Jul",
    "Ago",
    "Sep",
    "Oct",
    "Nov",
    "Dic",
  ];
  const corto = `${diasNom[dt.getUTCDay()]} ${dt.getUTCDate()} ${mesesNom[dt.getUTCMonth()]}`;

  if (limpio === baseHoy) {
    return { etiquetaPrincipal: `Hoy (${corto})`, horizonte: "HOY" };
  }
  if (limpio === manana) {
    return { etiquetaPrincipal: `Mañana (${corto})`, horizonte: "MANANA" };
  }
  if (limpio > manana) {
    return { etiquetaPrincipal: corto, horizonte: "FUTURO" };
  }
  return { etiquetaPrincipal: corto, horizonte: "PASADO" };
}

export const DATOS_PROVEEDOR_TINKAY_DEFECTO: DatosProveedorInformeIess = {
  tituloInforme: "INFORME DE SERVICIO PROVEEDORES",
  nombreProveedor: "Matías Gabriel Toapanta Guerrero",
  razonSocial: "Floristería Tinkay",
  ruc: "1760247047001 RIMPE NEGOCIO POPULAR",
  direccion: "Av. De Los Granados E14-619 y Eloy Alfaro",
  telefono: "0991444515",
  correoElectronico: "tinkay.uio@gmail.com",
  personaContacto: "Carolina Colcha",
  descripcionServicioDefecto: "Set condolencias (3 arreglos)",
  recursosDefecto: "Flores, follaje, bases y oasis",
};

export interface ConvenioEntregaConfig {
  id: string;
  codigo: string;
  nombre: string;
  prefijoInforme: string;
  siguienteNumero: number;
  datosProveedor: DatosProveedorInformeIess;
}

export type TipoOrigenEntrega = "ORDEN_TRABAJO_CONVENIO" | "PEDIDO_TIENDA";

export type EstadoEntregaEvidencia =
  | "PROGRAMADA"
  | "ENTREGADA_PENDIENTE_INFORME"
  | "INCLUIDA_EN_INFORME"
  | "ENTREGADO_PEDIDO_REGULAR"
  | "ANULADA";

export interface RegistroEntregaEvidencia {
  id: string;
  secuencial?: number;
  uuidCliente: string;
  codigoOt: string;
  tipoOrigen: TipoOrigenEntrega;
  convenioId?: string | null;
  proformaId?: string | null;
  ordenTallerId?: string | null;
  estadoTaller?: EstadoOrdenTaller | null;
  horaSolicitada?: string | null;
  entregadoPor?: string | null;
  entregadorNombre: string;
  repartidorAsignadoId?: string | null;
  repartidorAsignadoNombre?: string | null;
  repartidorTipo?: "INTERNO" | "EXTERNO" | string | null;
  enRuta?: boolean;
  rutaLatitud?: number | null;
  rutaLongitud?: number | null;
  rutaActualizadaEn?: string | null;
  fallecidoDestinatario: string;
  fechaServicio: string;
  capturadoEn: string;
  sincronizadoEn?: string;
  descripcionServicio: string;
  salaServicio?: string | null;
  ubicacionNombre: string;
  coordinadorNombre?: string | null;
  recursosUtilizados?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  direccionGps?: string | null;
  fotoUrl?: string | null;
  mapaUrl?: string | null;
  facturaReferencia?: string | null;
  documentosAdjuntos?: string | null;
  observaciones?: string | null;
  informeId?: string | null;
  numeroInforme?: string | null;
  estado: EstadoEntregaEvidencia;
}

export interface PedidoPendienteConfirmacion {
  proformaId: string;
  ordenTallerId?: string | null;
  codigoOrden: string;
  estadoPago: string;
  estadoTaller?: EstadoOrdenTaller | null;
  fechaEntrega?: string | null;
  franjaHoraria?: string | null;
  compradorNombre: string;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  direccionEntrega: string;
  enlaceMapa?: string | null;
  resumenItems: string;
  repartidorAsignadoId?: string | null;
  repartidorAsignadoNombre?: string | null;
  repartidorTipo?: "INTERNO" | "EXTERNO" | string | null;
  enRuta?: boolean;
  rutaLatitud?: number | null;
  rutaLongitud?: number | null;
  rutaActualizadaEn?: string | null;
  creadoEn: string;
}

export interface InformeQuincenalEntregas {
  id: string;
  secuencial?: number;
  convenioId?: string | null;
  numeroInforme: string;
  fechaInforme: string;
  fechaInicio: string;
  fechaFin: string;
  totalEntregas: number;
  facturaReferencia?: string | null;
  documentosAdjuntos?: string | null;
  estado: "BORRADOR" | "EMITIDO" | "ANULADO";
  pdfUrl?: string | null;
  generadoNombre?: string | null;
  detalleInforme?: {
    datosProveedor?: DatosProveedorInformeIess;
    entregas?: RegistroEntregaEvidencia[];
  };
  creadoEn: string;
}

export interface ItemColaOfflineEntrega {
  uuidCliente: string;
  negocio: string;
  entregaIdProgramada?: string | null;
  tipoOrigen: TipoOrigenEntrega;
  convenioId?: string | null;
  proformaId?: string | null;
  entregadorNombre: string;
  fallecidoDestinatario: string;
  fechaServicio: string;
  capturadoEn: string;
  descripcionServicio: string;
  salaServicio?: string | null;
  ubicacionNombre: string;
  coordinadorNombre?: string;
  recursosUtilizados?: string;
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  direccionGps?: string | null;
  fotoDataUrl: string;
  mapaDataUrl?: string | null;
  observaciones?: string;
  intentosSync: number;
  ultimoErrorSync?: string;
}

const DB_OFFLINE_NOMBRE = "eco_operaciones_entregas_offline_db";
const DB_OFFLINE_STORE = "cola_entregas";
const DB_OFFLINE_VERSION = 1;

function abrirDbOffline(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB no disponible en este entorno"));
      return;
    }
    const req = indexedDB.open(DB_OFFLINE_NOMBRE, DB_OFFLINE_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(DB_OFFLINE_STORE)) {
        db.createObjectStore(DB_OFFLINE_STORE, { keyPath: "uuidCliente" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("No se pudo abrir almacenamiento offline"));
  });
}

export async function guardarEntregaEnColaOffline(item: ItemColaOfflineEntrega): Promise<void> {
  const db = await abrirDbOffline();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(DB_OFFLINE_STORE, "readwrite");
    tx.objectStore(DB_OFFLINE_STORE).put(item);
    tx.oncomplete = () => {
      db.close();
      resolve();
    };
    tx.onerror = () => {
      db.close();
      reject(tx.error ?? new Error("Error guardando entrega offline"));
    };
  });
}

export async function listarColaOfflineEntregas(negocio: string): Promise<ItemColaOfflineEntrega[]> {
  try {
    const db = await abrirDbOffline();
    return await new Promise<ItemColaOfflineEntrega[]>((resolve) => {
      const tx = db.transaction(DB_OFFLINE_STORE, "readonly");
      const req = tx.objectStore(DB_OFFLINE_STORE).getAll();
      req.onsuccess = () => {
        db.close();
        const todos = Array.isArray(req.result) ? (req.result as ItemColaOfflineEntrega[]) : [];
        const neg = negocio.trim().toLowerCase();
        resolve(todos.filter((x) => (x.negocio || "").toLowerCase() === neg));
      };
      req.onerror = () => {
        db.close();
        resolve([]);
      };
    });
  } catch {
    return [];
  }
}

export async function eliminarDeColaOfflineEntrega(uuidCliente: string): Promise<void> {
  try {
    const db = await abrirDbOffline();
    await new Promise<void>((resolve) => {
      const tx = db.transaction(DB_OFFLINE_STORE, "readwrite");
      tx.objectStore(DB_OFFLINE_STORE).delete(uuidCliente);
      tx.oncomplete = () => {
        db.close();
        resolve();
      };
      tx.onerror = () => {
        db.close();
        resolve();
      };
    });
  } catch {
    // Ignorar
  }
}

// =============================================================================
// MÓDULO 5: PANTALLA SMART TV TALLER & SHOWROOM DE EVENTOS (TINKAY / MARGARITAS)
// =============================================================================

export type ModoPantallaTv = "TALLER" | "EVENTOS";
export type PosicionLateralTv = "derecha" | "izquierda";
export type DensidadLayoutTv = "AUTO" | "NORMAL" | "PICO" | "SOLO_AUDIO";
export type FuenteMediaTv = "RADIO" | "YOUTUBE" | "INDICADORES";

export interface EmisoraRadioTv {
  id: string;
  nombre: string;
  streamUrl: string;
  pais?: string;
  etiquetas?: string;
  faviconUrl?: string;
}

export interface AlbumGoogleFotosTv {
  id: string;
  titulo: string;
  url: string;
  categoria?: string;
}

export interface FavoritoYoutubeTv {
  id: string;
  titulo: string;
  url: string;
  canal?: string;
  miniaturaUrl?: string;
}

export interface ConfiguracionTvTaller {
  modoActivo: ModoPantallaTv;
  fuenteMedia: FuenteMediaTv;
  radioActual?: EmisoraRadioTv | null;
  radiosFavoritas: EmisoraRadioTv[];
  youtubeUrlTaller: string;
  youtubeUrlEventosAudio: string;
  posicionLateral: PosicionLateralTv;
  densidadLayout: DensidadLayoutTv;
  mostrarFranjaListos: boolean;
  ocultarEntregadosMinutos: number;
  sonidoAlertas: boolean;
  volumenYoutube: number;
  mostrarPreciosEventos: boolean;
  segundosSlideEventos: number;
  albumesGoogleFotos: AlbumGoogleFotosTv[];
  favoritosYoutube: FavoritoYoutubeTv[];
  kioscoActivo: boolean;
  permitirCambiarEstadoKiosco: boolean;
  tokenKiosco?: string;
  actualizadoEn?: string;
}

export const CONFIG_TV_TALLER_DEFECTO: ConfiguracionTvTaller = {
  modoActivo: "TALLER",
  fuenteMedia: "RADIO",
  radioActual: null,
  radiosFavoritas: [],
  youtubeUrlTaller: "https://www.youtube.com/watch?v=4xDzrJKXOOY",
  youtubeUrlEventosAudio: "https://www.youtube.com/watch?v=4oStw0r33so",
  posicionLateral: "derecha",
  densidadLayout: "AUTO",
  mostrarFranjaListos: true,
  ocultarEntregadosMinutos: 15,
  sonidoAlertas: true,
  volumenYoutube: 75,
  mostrarPreciosEventos: false,
  segundosSlideEventos: 10,
  albumesGoogleFotos: [],
  favoritosYoutube: [],
  kioscoActivo: true,
  permitirCambiarEstadoKiosco: true,
};

export function normalizarConfigTvTaller(raw?: Record<string, unknown> | null): ConfiguracionTvTaller {
  const src = raw && typeof raw === "object" ? raw : {};
  const albumesRaw = Array.isArray(src.albumesGoogleFotos) ? src.albumesGoogleFotos : [];
  const albumes: AlbumGoogleFotosTv[] = albumesRaw
    .filter((a): a is Record<string, unknown> => Boolean(a && typeof a === "object"))
    .map((a, i) => ({
      id: String(a.id || `alb-${i + 1}`),
      titulo: String(a.titulo || `Álbum Eventos ${i + 1}`).trim(),
      url: String(a.url || "").trim(),
      categoria: a.categoria ? String(a.categoria).trim() : undefined,
    }))
    .filter((a) => Boolean(a.url));

  const favsRaw = Array.isArray(src.favoritosYoutube) ? src.favoritosYoutube : [];
  const favoritosYoutube: FavoritoYoutubeTv[] = favsRaw
    .filter((f): f is Record<string, unknown> => Boolean(f && typeof f === "object"))
    .map((f, i) => ({
      id: String(f.id || `fav-${i + 1}`),
      titulo: String(f.titulo || `Favorito ${i + 1}`).trim(),
      url: String(f.url || "").trim(),
      canal: f.canal ? String(f.canal).trim() : undefined,
      miniaturaUrl: f.miniaturaUrl ? String(f.miniaturaUrl).trim() : undefined,
    }))
    .filter((f) => Boolean(f.url));

  const modoRaw = String(src.modoActivo || "TALLER").toUpperCase();
  const modoActivo: ModoPantallaTv = modoRaw === "EVENTOS" ? "EVENTOS" : "TALLER";

  const fuenteRaw = String(src.fuenteMedia || "RADIO").toUpperCase();
  const fuenteMedia: FuenteMediaTv =
    fuenteRaw === "YOUTUBE"
      ? "YOUTUBE"
      : fuenteRaw === "INDICADORES"
        ? "INDICADORES"
        : "RADIO";

  const radioRaw =
    src.radioActual && typeof src.radioActual === "object"
      ? (src.radioActual as Record<string, unknown>)
      : null;
  const radioActual: EmisoraRadioTv | null =
    radioRaw && typeof radioRaw.streamUrl === "string" && radioRaw.streamUrl.trim()
      ? {
          id: String(radioRaw.id || "radio-actual"),
          nombre: String(radioRaw.nombre || "Radio en Vivo").trim(),
          streamUrl: radioRaw.streamUrl.trim(),
          pais: radioRaw.pais ? String(radioRaw.pais).trim() : undefined,
          etiquetas: radioRaw.etiquetas ? String(radioRaw.etiquetas).trim() : undefined,
          faviconUrl: radioRaw.faviconUrl ? String(radioRaw.faviconUrl).trim() : undefined,
        }
      : null;

  const radiosFavRaw = Array.isArray(src.radiosFavoritas) ? src.radiosFavoritas : [];
  const radiosFavoritas: EmisoraRadioTv[] = radiosFavRaw
    .filter((r): r is Record<string, unknown> => Boolean(r && typeof r === "object"))
    .map((r, i) => ({
      id: String(r.id || `rad-${i + 1}`),
      nombre: String(r.nombre || `Emisora ${i + 1}`).trim(),
      streamUrl: String(r.streamUrl || "").trim(),
      pais: r.pais ? String(r.pais).trim() : undefined,
      etiquetas: r.etiquetas ? String(r.etiquetas).trim() : undefined,
      faviconUrl: r.faviconUrl ? String(r.faviconUrl).trim() : undefined,
    }))
    .filter((r) => Boolean(r.streamUrl));

  const posRaw = String(src.posicionLateral || "derecha").toLowerCase();
  const posicionLateral: PosicionLateralTv = posRaw === "izquierda" ? "izquierda" : "derecha";

  const densRaw = String(src.densidadLayout || "AUTO").toUpperCase();
  const densidadLayout: DensidadLayoutTv =
    densRaw === "NORMAL" || densRaw === "PICO" || densRaw === "SOLO_AUDIO" ? densRaw : "AUTO";

  return {
    modoActivo,
    fuenteMedia,
    radioActual,
    radiosFavoritas,
    youtubeUrlTaller:
      typeof src.youtubeUrlTaller === "string" && src.youtubeUrlTaller.trim()
        ? src.youtubeUrlTaller.trim()
        : CONFIG_TV_TALLER_DEFECTO.youtubeUrlTaller,
    youtubeUrlEventosAudio:
      typeof src.youtubeUrlEventosAudio === "string" && src.youtubeUrlEventosAudio.trim()
        ? src.youtubeUrlEventosAudio.trim()
        : CONFIG_TV_TALLER_DEFECTO.youtubeUrlEventosAudio,
    posicionLateral,
    densidadLayout,
    mostrarFranjaListos:
      typeof src.mostrarFranjaListos === "boolean"
        ? src.mostrarFranjaListos
        : CONFIG_TV_TALLER_DEFECTO.mostrarFranjaListos,
    ocultarEntregadosMinutos:
      typeof src.ocultarEntregadosMinutos === "number" && src.ocultarEntregadosMinutos >= 0
        ? src.ocultarEntregadosMinutos
        : CONFIG_TV_TALLER_DEFECTO.ocultarEntregadosMinutos,
    sonidoAlertas:
      typeof src.sonidoAlertas === "boolean"
        ? src.sonidoAlertas
        : CONFIG_TV_TALLER_DEFECTO.sonidoAlertas,
    volumenYoutube:
      typeof src.volumenYoutube === "number"
        ? Math.max(0, Math.min(100, Math.round(src.volumenYoutube)))
        : CONFIG_TV_TALLER_DEFECTO.volumenYoutube,
    mostrarPreciosEventos:
      typeof src.mostrarPreciosEventos === "boolean"
        ? src.mostrarPreciosEventos
        : CONFIG_TV_TALLER_DEFECTO.mostrarPreciosEventos,
    segundosSlideEventos:
      typeof src.segundosSlideEventos === "number" && src.segundosSlideEventos >= 4
        ? Math.min(60, Math.round(src.segundosSlideEventos))
        : CONFIG_TV_TALLER_DEFECTO.segundosSlideEventos,
    albumesGoogleFotos: albumes,
    favoritosYoutube,
    kioscoActivo:
      typeof src.kioscoActivo === "boolean" ? src.kioscoActivo : CONFIG_TV_TALLER_DEFECTO.kioscoActivo,
    permitirCambiarEstadoKiosco:
      typeof src.permitirCambiarEstadoKiosco === "boolean"
        ? src.permitirCambiarEstadoKiosco
        : CONFIG_TV_TALLER_DEFECTO.permitirCambiarEstadoKiosco,
    tokenKiosco: typeof src.tokenKiosco === "string" ? src.tokenKiosco : undefined,
    actualizadoEn: typeof src.actualizadoEn === "string" ? src.actualizadoEn : undefined,
  };
}

export interface OrdenTvTaller {
  id: string;
  codigo: string;
  origenTipo: OrigenOrdenTaller;
  clasificacionPedido?: ClasificacionOperativaPedido;
  estadoTaller: EstadoOrdenTaller;
  estadoPago?: string | null;
  metodoPago?: string | null;
  fechaEntrega: string;
  fechaElaboracion?: string | null;
  franjaHoraria?: string | null;
  horaEspecifica?: string | null;
  productoResumen: string;
  items?: ItemOrdenTaller[];
  colores?: string | null;
  extras?: string | null;
  observaciones?: string | null;
  dedicatoria?: string | null;
  clienteSolicita?: string | null;
  destinatarioFallecido?: string | null;
  salaServicio?: string | null;
  ubicacionEntrega?: string | null;
  retiroEnLocal?: boolean;
  totalUsd?: number | null;
  prioridadOrden?: number | null;
  enviadoTallerEn?: string | null;
  preparacionEn?: string | null;
  listoEn?: string | null;
  entregadoEn?: string | null;
  actualizadoTallerNombre?: string | null;
}

export interface ProductoEventoTv {
  productoId: string;
  nombre: string;
  descripcion: string;
  slug: string;
  tipo?: string | null;
  imagenUrl: string;
  precioDesde: number;
  categoriaNombre: string;
}

export interface DiaSerieSemanaTv {
  fecha: string;
  diaCorto: string;
  esHoy: boolean;
  pedidos: number;
  ventasUsd: number;
}

export interface IndicadoresEjecutivosTv {
  chatsHoy: number;
  chatsPendientesSeguimiento: number;
  chatsEscalados: number;
  chatsNoLeidos: number;
  totalVentasHoyUsd: number;
  totalVentasSemanaUsd: number;
  pedidosHoy: number;
  pedidosSemana: number;
  sinEnviarTallerHoy: number;
  inicioSemanaYmd?: string;
  finSemanaYmd?: string;
  serieSemana: DiaSerieSemanaTv[];
  desgloseClasificacionHoy: Record<string, number>;
}

export interface DatosTableroTvTaller {
  modoAcceso: "AUTENTICADO" | "KIOSCO";
  rolOperativo?: string;
  esOperadorOAdmin?: boolean;
  puedeInteractuar: boolean;
  hoyYmd: string;
  ordenes: OrdenTvTaller[];
  indicadoresTv?: IndicadoresEjecutivosTv | null;
  productosEventos: ProductoEventoTv[];
  configTv: ConfiguracionTvTaller;
}

export interface ChipColorPedido {
  etiqueta: string;
  hex: string;
  bordeHex: string;
}

export const PALETA_COLORES_PEDIDO_TALLER: readonly ChipColorPedido[] = [
  { etiqueta: "Rojo", hex: "#EF4444", bordeHex: "#FCA5A5" },
  { etiqueta: "Blanco", hex: "#F8FAFC", bordeHex: "#CBD5E1" },
  { etiqueta: "Rosado", hex: "#F472B6", bordeHex: "#FBCFE8" },
  { etiqueta: "Fucsia", hex: "#EC4899", bordeHex: "#F9A8D4" },
  { etiqueta: "Amarillo", hex: "#FACC15", bordeHex: "#FEF08A" },
  { etiqueta: "Durazno", hex: "#FB923C", bordeHex: "#FED7AA" },
  { etiqueta: "Lila / Morado", hex: "#A855F7", bordeHex: "#D8B4FE" },
  { etiqueta: "Azul", hex: "#3B82F6", bordeHex: "#93C5FD" },
  { etiqueta: "Dorado", hex: "#D97706", bordeHex: "#FDE68A" },
  { etiqueta: "Pasteles", hex: "#F9A8D4", bordeHex: "#FDE68A" },
  { etiqueta: "Vino / Burdeos", hex: "#881337", bordeHex: "#FDA4AF" },
  { etiqueta: "Verde follaje", hex: "#22C55E", bordeHex: "#86EFAC" },
] as const;

export function parsearColoresPedido(texto?: string | null): ChipColorPedido[] {
  const limpio = String(texto || "").trim();
  if (!limpio) return [];
  const partes = limpio
    .split(/[,;/+]+|\s+y\s+/i)
    .map((p) => p.trim())
    .filter(Boolean);

  return partes.map((parte) => {
    const low = parte
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
    if (low.includes("roj") || low.includes("red")) return { etiqueta: parte, hex: "#EF4444", bordeHex: "#FCA5A5" };
    if (low.includes("blanc") || low.includes("white") || low.includes("marfil") || low.includes("crema"))
      return { etiqueta: parte, hex: "#F8FAFC", bordeHex: "#CBD5E1" };
    if (low.includes("fucsia") || low.includes("magenta")) return { etiqueta: parte, hex: "#EC4899", bordeHex: "#F9A8D4" };
    if (low.includes("rosa") || low.includes("pink") || low.includes("pastel"))
      return { etiqueta: parte, hex: "#F472B6", bordeHex: "#FBCFE8" };
    if (low.includes("amarill") || low.includes("girasol") || low.includes("yellow"))
      return { etiqueta: parte, hex: "#FACC15", bordeHex: "#FEF08A" };
    if (low.includes("durazn") || low.includes("salmon") || low.includes("naranja") || low.includes("coral"))
      return { etiqueta: parte, hex: "#FB923C", bordeHex: "#FED7AA" };
    if (low.includes("lila") || low.includes("morad") || low.includes("violet") || low.includes("lavanda"))
      return { etiqueta: parte, hex: "#A855F7", bordeHex: "#D8B4FE" };
    if (low.includes("azul") || low.includes("celest") || low.includes("blue"))
      return { etiqueta: parte, hex: "#3B82F6", bordeHex: "#93C5FD" };
    if (low.includes("dorad") || low.includes("oro") || low.includes("gold"))
      return { etiqueta: parte, hex: "#D97706", bordeHex: "#FDE68A" };
    if (low.includes("vino") || low.includes("burdeo") || low.includes("concho"))
      return { etiqueta: parte, hex: "#881337", bordeHex: "#FDA4AF" };
    if (low.includes("negro") || low.includes("black"))
      return { etiqueta: parte, hex: "#1E293B", bordeHex: "#94A3B8" };
    if (low.includes("verd") || low.includes("eucalipt"))
      return { etiqueta: parte, hex: "#22C55E", bordeHex: "#86EFAC" };
    return { etiqueta: parte, hex: "#94A3B8", bordeHex: "#CBD5E1" };
  });
}

export function extraerYoutubeVideoOPlaylist(url?: string | null): {
  videoId: string | null;
  playlistId: string | null;
} {
  const txt = String(url || "").trim();
  if (!txt) return { videoId: null, playlistId: null };

  // Si pegaron directamente un ID de 11 caracteres
  if (/^[a-zA-Z0-9_-]{11}$/.test(txt)) {
    return { videoId: txt, playlistId: null };
  }

  try {
    const u = new URL(txt.startsWith("http") ? txt : `https://${txt}`);
    const list = u.searchParams.get("list");
    let videoId = u.searchParams.get("v");

    if (!videoId && u.hostname.includes("youtu.be")) {
      videoId = u.pathname.replace(/^\//, "").split("/")[0] || null;
    }
    if (!videoId && u.pathname.includes("/embed/")) {
      videoId = u.pathname.split("/embed/")[1]?.split(/[/?]/)[0] || null;
    }
    if (!videoId && u.pathname.includes("/live/")) {
      videoId = u.pathname.split("/live/")[1]?.split(/[/?]/)[0] || null;
    }
    if (!videoId && u.pathname.includes("/shorts/")) {
      videoId = u.pathname.split("/shorts/")[1]?.split(/[/?]/)[0] || null;
    }

    return {
      videoId: videoId && /^[a-zA-Z0-9_-]{11}$/.test(videoId) ? videoId : null,
      playlistId: list && /^[a-zA-Z0-9_-]{10,}$/.test(list) ? list : null,
    };
  } catch {
    return { videoId: null, playlistId: null };
  }
}

export function ordenarPedidosPorPrioridadTaller<
  T extends {
    prioridadOrden?: number | null;
    clasificacionPedido?: string | null;
    origenTipo?: string | null;
    horaEspecifica?: string | null;
    franjaHoraria?: string | null;
    fechaEntrega?: string | null;
  },
>(ordenes: T[]): T[] {
  return [...ordenes].sort((a, b) => {
    const pA = typeof a.prioridadOrden === "number" && a.prioridadOrden > 0 ? a.prioridadOrden : 999999;
    const pB = typeof b.prioridadOrden === "number" && b.prioridadOrden > 0 ? b.prioridadOrden : 999999;
    if (pA !== pB) return pA - pB;

    const exA = a.clasificacionPedido === "EXEQUIALES" || a.origenTipo === "EXEQUIALES_LLAMADA" ? 0 : 1;
    const exB = b.clasificacionPedido === "EXEQUIALES" || b.origenTipo === "EXEQUIALES_LLAMADA" ? 0 : 1;
    if (exA !== exB) return exA - exB;

    const fA = String(a.fechaEntrega || "9999-99-99");
    const fB = String(b.fechaEntrega || "9999-99-99");
    if (fA !== fB) return fA.localeCompare(fB);

    const hA = String(a.horaEspecifica || a.franjaHoraria || "Z");
    const hB = String(b.horaEspecifica || b.franjaHoraria || "Z");
    return hA.localeCompare(hB);
  });
}
