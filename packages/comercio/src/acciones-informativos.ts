"use server";

import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import { evaluarVigenciaProducto, type DetalleVigenciaTemporal } from "./utils/vigencia";

export type TipoInformativo =
  | "BENEFICIO_CONVENIO"
  | "ALERTA_REGULATORIA"
  | "NOTICIA_TRIBUTARIA_MUNICIPAL"
  | "COMUNICADO_GENERAL";

export type AudienciaInformativo = "TODOS" | "ABOGADOS" | "CLIENTES" | "EMPRESAS";

export type UbicacionInformativo =
  | "LANDING_BANNER"
  | "LANDING_GRID"
  | "PANEL_INICIO"
  | "PANEL_BENEFICIOS";

export interface DetalleInformativo extends DetalleVigenciaTemporal {
  imagen_url?: string;
  video_url?: string;
  cta_texto?: string;
  cta_url?: string;
  institucion?: string;
  porcentaje_descuento?: string;
  contacto_whatsapp?: string;
  foto_posicion?: string;
  foto_ajuste?: "cover" | "contain" | "fill";
  foto_zoom?: number;
}

export interface CampanaInformativa {
  inf_id: string;
  inf_negocio: string;
  inf_titulo: string;
  inf_slug: string;
  inf_subtitulo?: string | null;
  inf_contenido_md?: string | null;
  inf_tipo: TipoInformativo;
  inf_audiencia: AudienciaInformativo[];
  inf_ubicaciones: UbicacionInformativo[];
  inf_fecha_inicio: string;
  inf_fecha_fin?: string | null;
  inf_activo: boolean;
  inf_prioridad: "ALTA" | "MEDIA" | "BAJA";
  inf_detalle: DetalleInformativo;
  inf_creado_en?: string;
  inf_actualizado_en?: string;
}

const CAMPANAS_SEMILLA_TRANQI: CampanaInformativa[] = [
  {
    inf_id: "inf-trq-capacitacion-maestrias",
    inf_negocio: "tranqi",
    inf_titulo: "Convenio de Capacitación: Diplomados & Maestrías en Derecho Societario y Procesal",
    inf_slug: "convenio-capacitacion-socios-abogados",
    inf_subtitulo: "25% de beca y descuento exclusivo para Abogados Socios de la Red Tranqi",
    inf_contenido_md:
      "Accede a programas de especialización y formación jurídica continua con certificación oficial. Válido para todos los profesionales activos en la red.",
    inf_tipo: "BENEFICIO_CONVENIO",
    inf_audiencia: ["ABOGADOS", "TODOS"],
    inf_ubicaciones: ["PANEL_BENEFICIOS", "PANEL_INICIO"],
    inf_fecha_inicio: new Date(Date.now() - 2 * 86400000).toISOString(),
    inf_fecha_fin: new Date(Date.now() + 90 * 86400000).toISOString(),
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      institucion: "Instituto Superior de Postgrados Jurídicos",
      porcentaje_descuento: "25% Beca",
      imagen_url:
        "https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80",
      cta_texto: "Postular a Beca de Capacitación",
      cta_url: "https://wa.me/593999999999?text=Deseo%20informacion%20del%20convenio%20de%20capacitacion%20Tranqi",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "inf-trq-alerta-ant",
    inf_negocio: "tranqi",
    inf_titulo: "Alerta ANT: Suspensión Temporal en Sistema de Matriculación y Turnos Vehiculares",
    inf_slug: "alerta-ant-suspension-sistema-matriculacion",
    inf_subtitulo: "Mantenimiento preventivo en la plataforma de la Agencia Nacional de Tránsito",
    inf_contenido_md:
      "Informamos a nuestros clientes y socios que la ANT suspenderá temporalmente sus trámites telemáticos de bloqueo vehicular y validación de poderes durante el fin de semana programado.",
    inf_tipo: "ALERTA_REGULATORIA",
    inf_audiencia: ["CLIENTES", "EMPRESAS", "ABOGADOS", "TODOS"],
    inf_ubicaciones: ["LANDING_BANNER", "LANDING_GRID", "PANEL_INICIO"],
    inf_fecha_inicio: new Date(Date.now() - 1 * 86400000).toISOString(),
    inf_fecha_fin: new Date(Date.now() + 15 * 86400000).toISOString(),
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      institucion: "Agencia Nacional de Tránsito (ANT)",
      imagen_url:
        "https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80",
      cta_texto: "Ver Comunicado Oficial",
      cta_url: "https://www.ant.gob.ec",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "inf-trq-patente-quito-noviembre",
    inf_negocio: "tranqi",
    inf_titulo: "Oportunidad Tributaria: Descuento del 10% en Patente Municipal de Quito en Noviembre",
    inf_slug: "descuento-patente-municipal-quito-noviembre",
    inf_subtitulo: "Ahorro por pronto pago en obligaciones y patentes comerciales del Distrito Metropolitano",
    inf_contenido_md:
      "Las personas naturales obligadas y empresas con actividad comercial en Quito pueden acogerse al incentivo de pronto pago en la patente municipal 2026. Te asesoramos en la liquidación exacta.",
    inf_tipo: "NOTICIA_TRIBUTARIA_MUNICIPAL",
    inf_audiencia: ["CLIENTES", "EMPRESAS", "TODOS"],
    inf_ubicaciones: ["LANDING_GRID", "PANEL_INICIO"],
    inf_fecha_inicio: new Date().toISOString(),
    inf_fecha_fin: new Date(Date.now() + 60 * 86400000).toISOString(),
    inf_activo: true,
    inf_prioridad: "MEDIA",
    inf_detalle: {
      institucion: "Municipio del Distrito Metropolitano de Quito",
      porcentaje_descuento: "10% Descuento",
      imagen_url:
        "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80",
      cta_texto: "Solicitar Liquidación Asistida",
      cta_url: "/panel/agendar",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "inf-trq-firma-p12-abogados",
    inf_negocio: "tranqi",
    inf_titulo: "Convenio Firma Electrónica .p12 y Bóveda Segura para Abogados",
    inf_slug: "convenio-firma-electronica-abogados",
    inf_subtitulo: "Emisión express de firma digital para patrocinio y casilleros judiciales",
    inf_contenido_md:
      "Obtén tu firma digital jurídica en menos de 15 minutos con soporte prioritario e integración directa en Tranqi.",
    inf_tipo: "BENEFICIO_CONVENIO",
    inf_audiencia: ["ABOGADOS"],
    inf_ubicaciones: ["PANEL_BENEFICIOS", "PANEL_INICIO"],
    inf_fecha_inicio: new Date(Date.now() - 5 * 86400000).toISOString(),
    inf_fecha_fin: new Date(Date.now() + 180 * 86400000).toISOString(),
    inf_activo: true,
    inf_prioridad: "MEDIA",
    inf_detalle: {
      institucion: "BCEC & Security Data Ecuador",
      porcentaje_descuento: "Tarifa Reducida $18.50",
      imagen_url:
        "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80",
      cta_texto: "Obtener Firma .p12",
      cta_url: "/panel/firma-documentos",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
];

// Almacenamiento en memoria para resiliencia offline/sesión
let cacheCampanasMemoria: Record<string, CampanaInformativa[]> = {
  tranqi: CAMPANAS_SEMILLA_TRANQI,
};

/**
 * Obtiene las campañas informativas activas y vigentes
 */
export async function obtenerCampanasInformativasAction(params: {
  negocio?: string;
  audiencia?: AudienciaInformativo | "TODOS";
  ubicacion?: UbicacionInformativo;
  tipo?: TipoInformativo;
  incluirInactivos?: boolean;
}): Promise<CampanaInformativa[]> {
  const negocio = (params.negocio || "tranqi").toLowerCase().trim();
  const { audiencia, ubicacion, tipo, incluirInactivos = false } = params;

  let admin: any = null;
  let supabase: any = null;
  try {
    admin = crearClienteAdmin();
  } catch {}
  try {
    supabase = await crearClienteServidor();
  } catch {}

  const cliente = admin || supabase;

  if (cliente) {
    try {
      let query = cliente
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .select("*")
        .eq("inf_negocio", negocio)
        .order("inf_prioridad", { ascending: false })
        .order("inf_fecha_inicio", { ascending: false });

      if (!incluirInactivos) {
        query = query.eq("inf_activo", true);
      }

      const { data, error } = await query;
      if (!error && Array.isArray(data) && data.length > 0) {
        const mapeados: CampanaInformativa[] = data.map((d: any) => ({
          inf_id: d.inf_id,
          inf_negocio: d.inf_negocio,
          inf_titulo: d.inf_titulo,
          inf_slug: d.inf_slug,
          inf_subtitulo: d.inf_subtitulo,
          inf_contenido_md: d.inf_contenido_md,
          inf_tipo: d.inf_tipo,
          inf_audiencia: Array.isArray(d.inf_audiencia) ? d.inf_audiencia : ["TODOS"],
          inf_ubicaciones: Array.isArray(d.inf_ubicaciones) ? d.inf_ubicaciones : ["PANEL_INICIO"],
          inf_fecha_inicio: d.inf_fecha_inicio,
          inf_fecha_fin: d.inf_fecha_fin,
          inf_activo: d.inf_activo !== false,
          inf_prioridad: d.inf_prioridad || "MEDIA",
          inf_detalle: d.inf_detalle || {},
          inf_creado_en: d.inf_creado_en,
          inf_actualizado_en: d.inf_actualizado_en,
        }));

        cacheCampanasMemoria[negocio] = mapeados;
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error consultando com_campana_informativa:", err);
    }
  }

  const base = cacheCampanasMemoria[negocio] || CAMPANAS_SEMILLA_TRANQI;

  const ahora = new Date().toISOString();

  return base.filter((c) => {
    if (!incluirInactivos && !c.inf_activo) return false;

    // Vigencia temporal si no incluye inactivos
    if (!incluirInactivos) {
      if (c.inf_fecha_inicio && c.inf_fecha_inicio > ahora) return false;
      if (c.inf_fecha_fin && c.inf_fecha_fin < ahora) return false;
    }

    if (tipo && c.inf_tipo !== tipo) return false;

    if (audiencia && audiencia !== "TODOS") {
      const matchAudiencia =
        c.inf_audiencia.includes("TODOS") || c.inf_audiencia.includes(audiencia);
      if (!matchAudiencia) return false;
    }

    if (ubicacion) {
      const matchUbicacion = c.inf_ubicaciones.includes(ubicacion);
      if (!matchUbicacion) return false;
    }

    return true;
  });
}

/**
 * Guarda o actualiza una campaña informativa en base de datos y memoria
 */
export async function guardarCampanaInformativaAction(
  datos: Partial<CampanaInformativa> & { inf_negocio?: string }
): Promise<{ ok: boolean; campana?: CampanaInformativa; error?: string }> {
  const negocio = (datos.inf_negocio || "tranqi").toLowerCase().trim();
  const titulo = datos.inf_titulo?.trim();

  if (!titulo) {
    return { ok: false, error: "El título de la campaña o aviso es obligatorio." };
  }

  const slug =
    datos.inf_slug?.trim() ||
    titulo
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");

  const id = datos.inf_id || `inf-${Date.now()}`;
  const nuevaCampana: CampanaInformativa = {
    inf_id: id,
    inf_negocio: negocio,
    inf_titulo: titulo,
    inf_slug: slug,
    inf_subtitulo: datos.inf_subtitulo || null,
    inf_contenido_md: datos.inf_contenido_md || null,
    inf_tipo: datos.inf_tipo || "COMUNICADO_GENERAL",
    inf_audiencia: Array.isArray(datos.inf_audiencia) && datos.inf_audiencia.length > 0 ? datos.inf_audiencia : ["TODOS"],
    inf_ubicaciones: Array.isArray(datos.inf_ubicaciones) && datos.inf_ubicaciones.length > 0 ? datos.inf_ubicaciones : ["PANEL_INICIO"],
    inf_fecha_inicio: datos.inf_fecha_inicio || new Date().toISOString(),
    inf_fecha_fin: datos.inf_fecha_fin || null,
    inf_activo: datos.inf_activo !== false,
    inf_prioridad: datos.inf_prioridad || "MEDIA",
    inf_detalle: datos.inf_detalle || {},
    inf_actualizado_en: new Date().toISOString(),
  };

  // 1. Guardar en memoria
  const lista = cacheCampanasMemoria[negocio] || [...CAMPANAS_SEMILLA_TRANQI];
  const idx = lista.findIndex((c) => c.inf_id === id);
  if (idx >= 0) {
    lista[idx] = nuevaCampana;
  } else {
    lista.unshift(nuevaCampana);
  }
  cacheCampanasMemoria[negocio] = lista;

  // 2. Persistir en PostgreSQL
  let admin: any = null;
  try {
    admin = crearClienteAdmin();
  } catch {}

  if (admin) {
    try {
      const payload: any = {
        inf_negocio: negocio,
        inf_titulo: nuevaCampana.inf_titulo,
        inf_slug: nuevaCampana.inf_slug,
        inf_subtitulo: nuevaCampana.inf_subtitulo,
        inf_contenido_md: nuevaCampana.inf_contenido_md,
        inf_tipo: nuevaCampana.inf_tipo,
        inf_audiencia: nuevaCampana.inf_audiencia,
        inf_ubicaciones: nuevaCampana.inf_ubicaciones,
        inf_fecha_inicio: nuevaCampana.inf_fecha_inicio,
        inf_fecha_fin: nuevaCampana.inf_fecha_fin,
        inf_activo: nuevaCampana.inf_activo,
        inf_prioridad: nuevaCampana.inf_prioridad,
        inf_detalle: nuevaCampana.inf_detalle,
        inf_actualizado_en: new Date().toISOString(),
      };

      if (id && !id.startsWith("inf-")) {
        payload.inf_id = id;
      }

      const { data, error } = await admin
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .upsert(payload, { onConflict: "inf_slug" })
        .select()
        .single();

      if (!error && data) {
        nuevaCampana.inf_id = data.inf_id;
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error persistiendo campaña en Supabase:", err);
    }
  }

  return { ok: true, campana: nuevaCampana };
}

/**
 * Conmuta el estado activo/inactivo de una campaña informativa
 */
export async function alternarActivoCampanaAction(
  negocio = "tranqi",
  infId: string,
  nuevoActivo?: boolean
): Promise<{ ok: boolean; inf_activo: boolean; error?: string }> {
  const lista = cacheCampanasMemoria[negocio] || [...CAMPANAS_SEMILLA_TRANQI];
  const item = lista.find((c) => c.inf_id === infId);
  const estadoFinal = typeof nuevoActivo === "boolean" ? nuevoActivo : !(item?.inf_activo ?? true);

  if (item) {
    item.inf_activo = estadoFinal;
    item.inf_actualizado_en = new Date().toISOString();
  }

  let admin: any = null;
  try {
    admin = crearClienteAdmin();
  } catch {}

  if (admin && infId && !infId.startsWith("inf-")) {
    try {
      await admin
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .update({ inf_activo: estadoFinal, inf_actualizado_en: new Date().toISOString() })
        .eq("inf_id", infId);
    } catch (err) {
      console.warn("[@eco/comercio] Error actualizando inf_activo en PostgreSQL:", err);
    }
  }

  return { ok: true, inf_activo: estadoFinal };
}

/**
 * Elimina una campaña informativa
 */
export async function eliminarCampanaInformativaAction(
  negocio = "tranqi",
  infId: string
): Promise<{ ok: boolean; error?: string }> {
  const lista = cacheCampanasMemoria[negocio] || [];
  cacheCampanasMemoria[negocio] = lista.filter((c) => c.inf_id !== infId);

  let admin: any = null;
  try {
    admin = crearClienteAdmin();
  } catch {}

  if (admin && infId && !infId.startsWith("inf-")) {
    try {
      await admin
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .delete()
        .eq("inf_id", infId);
    } catch (err) {
      console.warn("[@eco/comercio] Error eliminando campaña en PostgreSQL:", err);
    }
  }

  return { ok: true };
}

/**
 * Restaura el conjunto de campañas informativas y beneficios oficiales de ejemplo
 */
export async function restaurarCampanasEjemploAction(
  negocio = "tranqi"
): Promise<{ ok: boolean; total: number }> {
  cacheCampanasMemoria[negocio] = [...CAMPANAS_SEMILLA_TRANQI];
  return { ok: true, total: CAMPANAS_SEMILLA_TRANQI.length };
}
