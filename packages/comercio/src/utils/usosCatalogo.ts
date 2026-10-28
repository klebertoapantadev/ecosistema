import { ProductoCatalogo } from "../acciones";
import { detectarTipoNegocio } from "./negocio";

export interface ItemUsoCatalogo {
  clave: string;
  label: string;
  esPreset: boolean;
}

export const PRESETS_USOS_FLORISTERIA: { clave: string; label: string }[] = [
  { clave: "cumpleanos", label: "🎂 Cumpleaños" },
  { clave: "aniversario", label: "💍 Aniversario" },
  { clave: "amor_romance", label: "❤️ Amor y Romance" },
  { clave: "pedida_mano", label: "💍 Pedida de Mano" },
  { clave: "recuperate", label: "🏥 Recupérate Pronto" },
  { clave: "agradecimiento", label: "💐 Agradecimiento" },
  { clave: "graduacion", label: "🎓 Graduación" },
  { clave: "condolencias", label: "🕊️ Condolencias / Duelo" },
  { clave: "corporativo", label: "🏢 Corporativo / Eventos" },
  { clave: "nacimiento_bebe", label: "🍼 Nacimiento / Baby" },
  { clave: "dia_madre_mujer", label: "🌸 Día Madre / Mujer" },
  { clave: "sorpresa_diaria", label: "✨ Sorpresa / Detalle" },
];

export const PRESETS_USOS_LEGAL: { clave: string; label: string }[] = [
  { clave: "contratos_mercantil", label: "📄 Revisión de Contratos & Blindaje" },
  { clave: "tramite_notarial", label: "🏛️ Trámites Notariales & Poderes" },
  { clave: "salida_menores", label: "✈️ Salida del País de Menores" },
  { clave: "divorcio_familia", label: "💔 Divorcio por Mutuo Acuerdo / Familia" },
  { clave: "consulta_especialista", label: "⚖️ Consulta Jurídica Telemática 1 a 1" },
  { clave: "amparo_familiar", label: "🛡️ Planes de Cobertura Legal Continua" },
  { clave: "asesoria_corporativa", label: "🏢 Asesoría Corporativa & B2B" },
  { clave: "disputa_laboral", label: "💼 Asuntos Laborales & Liquidaciones" },
  { clave: "cobro_deudas", label: "💳 Cobranza y Cartera Judicial" },
  { clave: "creacion_empresa", label: "🚀 Constitución de Compañías / SAS" },
  { clave: "propiedad_intelectual", label: "💡 Registro de Marcas & Patentes (SENADI)" },
  { clave: "defensa_penal", label: "🚨 Asistencia Flagrancia & Penal" },
];

export const PRESETS_USOS_MANTENIMIENTO: { clave: string; label: string }[] = [
  { clave: "fuga_agua", label: "🚰 Fuga de Agua / Grifería" },
  { clave: "cortocircuito_electrico", label: "⚡ Red Eléctrica / Luces" },
  { clave: "calefon_calentador", label: "🔥 Calefones y Gas" },
  { clave: "mantenimiento_preventivo", label: "🛠️ Mantenimiento Preventivo" },
  { clave: "remodelacion_hogar", label: "🧱 Remodelación / Pintura" },
  { clave: "cerrajeria_seguridad", label: "🚪 Cerrajería y Puertas" },
  { clave: "climatizacion_ac", label: "❄️ Aires y Clima" },
  { clave: "destape_tuberias", label: "🚽 Destape de Cañerías" },
  { clave: "inspeccion_diagnostico", label: "🔍 Diagnóstico Técnico" },
];

export function obtenerPresetsPorNegocio(negocio: string): { clave: string; label: string }[] {
  const { esFloristeria, esLegal } = detectarTipoNegocio(negocio);
  if (esFloristeria) return PRESETS_USOS_FLORISTERIA;
  if (esLegal) return PRESETS_USOS_LEGAL;
  return PRESETS_USOS_MANTENIMIENTO;
}

export function obtenerUsosEliminadosStorage(negocio: string): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`eco_usos_eliminados_${negocio}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.map((k) => String(k).toLowerCase().trim()) : [];
  } catch {
    return [];
  }
}

export function guardarUsosEliminadosStorage(negocio: string, eliminados: string[]): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`eco_usos_eliminados_${negocio}`, JSON.stringify(eliminados));
  } catch {}
}

export function obtenerUsosPersonalizadosStorage(negocio: string): { clave: string; label: string }[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(`eco_usos_personalizados_${negocio}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function guardarUsosPersonalizadosStorage(
  negocio: string,
  usos: { clave: string; label: string }[]
): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(`eco_usos_personalizados_${negocio}`, JSON.stringify(usos));
  } catch {}
}

/**
 * Verifica en la lista local de productos si algún producto tiene asignado el uso dado.
 * Retorna los nombres de los productos que lo están utilizando.
 */
export function verificarUsoEnProductosLocales(
  clave: string,
  productos: ProductoCatalogo[],
  productoActualId?: string,
  usosActualesMemoria?: string[]
): string[] {
  const claveNorm = clave.toLowerCase().trim();
  const nombresSet = new Set<string>();

  for (const p of productos) {
    const det = p.pro_detalle_producto || {};
    const usosP: string[] = [
      ...(Array.isArray(det.usos) ? det.usos : []),
      ...(Array.isArray(det.ocasiones) ? det.ocasiones : []),
    ].map((u) => String(u).toLowerCase().trim());

    const usosV: string[] = (p.variantes || []).flatMap((v) => {
      const detV = v.var_detalle_variante || {};
      return [
        ...(Array.isArray(detV.usos) ? detV.usos : []),
        ...(Array.isArray(detV.ocasiones) ? detV.ocasiones : []),
      ].map((u) => String(u).toLowerCase().trim());
    });

    // Si es el producto actualmente abierto para edición y tenemos usos en memoria
    if (productoActualId && p.pro_id === productoActualId && usosActualesMemoria) {
      if (usosActualesMemoria.map((u) => u.toLowerCase().trim()).includes(claveNorm)) {
        nombresSet.add(p.pro_nombre || "Este producto en edición");
      }
    } else {
      if (usosP.includes(claveNorm) || usosV.includes(claveNorm)) {
        nombresSet.add(p.pro_nombre || "Producto sin nombre");
      }
    }
  }

  // Si no estaba en productos pero el producto actual en memoria lo tiene
  if (
    productoActualId &&
    usosActualesMemoria &&
    usosActualesMemoria.map((u) => u.toLowerCase().trim()).includes(claveNorm) &&
    !nombresSet.has("Este producto en edición")
  ) {
    nombresSet.add("Este producto en edición");
  }

  return Array.from(nombresSet);
}
