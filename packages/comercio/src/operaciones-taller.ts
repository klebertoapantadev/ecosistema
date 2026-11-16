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

export const DATOS_PROVEEDOR_TINKAY_DEFECTO: DatosProveedorInformeIess = {
  tituloInforme: "INFORME DE SERVICIO PROVEEDORES",
  nombreProveedor: "Matías Gabriel Toapanta Guerrero",
  razonSocial: "Floristería Tinkay",
  ruc: "1760247047001 RIMPE NEGOCIO POPULAR",
  direccion: "Av. De Los Granados E14-619 y Eloy Alfaro",
  telefono: "0991444515",
  correoElectronico: "tinkay.uio@gmail.com",
  personaContacto: "Carolina Colcha",
  descripcionServicioDefecto: "Set de condolencias (3 arreglos florales)",
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
  entregadoPor?: string | null;
  entregadorNombre: string;
  fallecidoDestinatario: string;
  fechaServicio: string;
  capturadoEn: string;
  sincronizadoEn?: string;
  descripcionServicio: string;
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
  codigoOrden: string;
  estadoPago: string;
  compradorNombre: string;
  destinatarioNombre: string;
  destinatarioTelefono: string;
  direccionEntrega: string;
  enlaceMapa?: string | null;
  resumenItems: string;
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
