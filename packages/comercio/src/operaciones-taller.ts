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

export function normalizarFranjaHorariaTienda(valor?: string | null): string {
  const v = (valor || "").trim();
  if (!v) return "A) 09:00 - 13:00";
  const low = v.toLowerCase();
  if (low === "manana" || low.startsWith("a)") || low.includes("09:00")) {
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

export interface ItemOrdenTaller {
  productoId?: string;
  sku?: string;
  descripcion: string;
  cantidad: number;
  precioUnitario?: number;
  dedicatoria?: string;
}

export interface OrdenTrabajoTaller {
  id: string;
  codigo: string;
  origenTipo: OrigenOrdenTaller;
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
  /** Para Exequiales vía llamada: hora solicitada (ej. '10:30' o 'Lo antes posible') */
  horaEspecifica?: string | null;
  productoResumen: string;
  items: ItemOrdenTaller[];
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
  tarjetaMetadata?: {
    origen?: string;
    creado_por?: string;
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
