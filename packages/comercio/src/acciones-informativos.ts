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
  categoria?: string;
  color_tag?: string;
  icono?: string;
  cta_tipo?: "internal" | "external" | string;
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
    inf_id: "noticia-001",
    inf_negocio: "tranqi",
    inf_titulo: "Proyecto de Reforma a la Ley de Inquilinato",
    inf_slug: "reforma-ley-inquilinato-arriendos-garantias",
    inf_subtitulo: "Se debate fijar un plazo mínimo contractual de 2 años y un tope de 2 meses de garantía para arriendos.",
    inf_contenido_md:
      "La Asamblea Nacional analiza reformas clave para regular cánones de arrendamiento, contratos de vivienda y límites a garantías en el territorio ecuatoriano.",
    inf_tipo: "ALERTA_REGULATORIA",
    inf_audiencia: ["CLIENTES", "ABOGADOS", "TODOS"],
    inf_ubicaciones: ["LANDING_BANNER", "LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-01T08:00:00Z",
    inf_fecha_fin: "2026-12-31T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      categoria: "Inquilinato",
      color_tag: "#1E3A8A",
      icono: "home-outline",
      institucion: "Asamblea Nacional del Ecuador",
      cta_texto: "Ver detalles de la reforma",
      cta_url: "https://www.asambleanacional.gob.ec/es/proyectos-ley",
      cta_tipo: "external",
      imagen_url:
        "https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "noticia-002",
    inf_negocio: "tranqi",
    inf_titulo: "Control de Horas Suplementarias y Jornadas",
    inf_slug: "control-horas-suplementarias-registro-digital",
    inf_subtitulo: "El Ministerio del Trabajo refuerza el registro digital obligatorio de horas suplementarias y descansos.",
    inf_contenido_md:
      "Normativa de estricto cumplimiento para empleadores y trabajadores sobre liquidación de recargos extraordinarios, pausas activas y control biométrico.",
    inf_tipo: "ALERTA_REGULATORIA",
    inf_audiencia: ["EMPRESAS", "ABOGADOS", "CLIENTES", "TODOS"],
    inf_ubicaciones: ["LANDING_BANNER", "LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-02T09:30:00Z",
    inf_fecha_fin: "2026-12-31T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      categoria: "Laboral",
      color_tag: "#065F46",
      icono: "briefcase-outline",
      institucion: "Ministerio del Trabajo Ecuador",
      cta_texto: "Revisar cálculo legal",
      cta_url: "/panel/agendar",
      cta_tipo: "internal",
      imagen_url:
        "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "noticia-003",
    inf_negocio: "tranqi",
    inf_titulo: "Decreto 515: Autogeneración Energética",
    inf_slug: "decreto-515-autogeneracion-energetica-empresas",
    inf_subtitulo: "Nuevas reglas facilitan a empresas la creación de Distritos Autónomos de Energía y autogestión de excedentes.",
    inf_contenido_md:
      "Marco legal y tarifario para proyectos de autogeneración eléctrica solar, eólica o biomasa en parques industriales y empresas privadas.",
    inf_tipo: "NOTICIA_TRIBUTARIA_MUNICIPAL",
    inf_audiencia: ["EMPRESAS", "ABOGADOS", "TODOS"],
    inf_ubicaciones: ["LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-02T14:15:00Z",
    inf_fecha_fin: "2027-03-31T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "MEDIA",
    inf_detalle: {
      categoria: "Corporativo",
      color_tag: "#9A3412",
      icono: "flash-outline",
      institucion: "Ministerio de Energía y Minas",
      cta_texto: "Leer normativa empresarial",
      cta_url: "https://www.recursosyenergia.gob.ec/regulaciones",
      cta_tipo: "external",
      imagen_url:
        "https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "noticia-004",
    inf_negocio: "tranqi",
    inf_titulo: "Cumplimiento de Protección de Datos Personales",
    inf_slug: "cumplimiento-obligatorio-proteccion-datos-lopdp",
    inf_subtitulo: "Todo tratamiento de bases de datos exige consentimiento expreso previo y responsable técnico registrado.",
    inf_contenido_md:
      "La Superintendencia de Protección de Datos inicia ciclo de auditorías a empresas y profesionales. Asegura tus cláusulas, políticas de privacidad y registros ARCO.",
    inf_tipo: "ALERTA_REGULATORIA",
    inf_audiencia: ["EMPRESAS", "ABOGADOS", "CLIENTES", "TODOS"],
    inf_ubicaciones: ["LANDING_BANNER", "LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-03T11:00:00Z",
    inf_fecha_fin: "2026-12-31T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      categoria: "Privacidad",
      color_tag: "#4C1D95",
      icono: "shield-checkmark-outline",
      institucion: "Superintendencia de Protección de Datos",
      cta_texto: "Auditar cumplimiento",
      cta_url: "/panel/terminos",
      cta_tipo: "internal",
      imagen_url:
        "https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "noticia-005",
    inf_negocio: "tranqi",
    inf_titulo: "Validez Legal de la Firma Electrónica",
    inf_slug: "validez-legal-firma-electronica-juntas-actas",
    inf_subtitulo: "Actas de junta celebradas telemáticamente con firma digital certificada mantienen pleno valor probatorio.",
    inf_contenido_md:
      "La Superintendencia de Compañías ratifica la validez de firmas electrónicas avanzadas (.p12 / QR) para reformas de estatutos, cesión de participaciones y aumento de capital.",
    inf_tipo: "BENEFICIO_CONVENIO",
    inf_audiencia: ["EMPRESAS", "ABOGADOS", "TODOS"],
    inf_ubicaciones: ["LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-03T16:45:00Z",
    inf_fecha_fin: "2027-06-30T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "MEDIA",
    inf_detalle: {
      categoria: "Societario",
      color_tag: "#1E293B",
      icono: "document-text-outline",
      institucion: "Superintendencia de Compañías (SUPERCIAS)",
      cta_texto: "Ver guía de formalización",
      cta_url: "/panel/firma-documentos",
      cta_tipo: "internal",
      imagen_url:
        "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "noticia-006",
    inf_negocio: "tranqi",
    inf_titulo: "Protección Integral a Niñas, Niños y Adolescentes",
    inf_slug: "proteccion-integral-reforma-penal-menores",
    inf_subtitulo: "Aprobada reforma legal que endurece sanciones para la prevención del reclutamiento y explotación de menores.",
    inf_contenido_md:
      "Publicado en el Registro Oficial el paquete de reformas penales y procesales que agravan delitos contra la infancia y fortalecen medidas de protección inmediata.",
    inf_tipo: "ALERTA_REGULATORIA",
    inf_audiencia: ["CLIENTES", "ABOGADOS", "TODOS"],
    inf_ubicaciones: ["LANDING_BANNER", "LANDING_GRID", "PANEL_INICIO", "PANEL_BENEFICIOS"],
    inf_fecha_inicio: "2026-10-04T07:00:00Z",
    inf_fecha_fin: "2026-12-31T23:59:59Z",
    inf_activo: true,
    inf_prioridad: "ALTA",
    inf_detalle: {
      categoria: "Niñez y Familia",
      color_tag: "#831843",
      icono: "scale-outline",
      institucion: "Registro Oficial del Ecuador",
      cta_texto: "Consultar texto aprobado",
      cta_url: "https://www.registroficial.gob.ec",
      cta_tipo: "external",
      imagen_url:
        "https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
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
    inf_fecha_inicio: "2026-09-15T00:00:00Z",
    inf_fecha_fin: "2026-12-31T23:59:59Z",
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
    inf_fecha_inicio: "2026-09-20T00:00:00Z",
    inf_fecha_fin: "2026-10-31T23:59:59Z",
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
    inf_fecha_inicio: "2026-10-01T00:00:00Z",
    inf_fecha_fin: "2026-11-30T23:59:59Z",
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
];

// Almacenamiento en memoria para resiliencia offline/sesión y seguimiento de eliminados
let cacheCampanasMemoria: Record<string, CampanaInformativa[]> = {
  tranqi: [...CAMPANAS_SEMILLA_TRANQI],
};

const eliminadosMemoria: Record<string, Set<string>> = {
  tranqi: new Set<string>(),
};

function esUuidValido(v?: string | null): boolean {
  if (!v) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v.trim());
}

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

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente) {
    try {
      // 1. Intentar vía RPC dedicada
      const { data: dataRpc, error: errorRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_obtener_campanas_informativas", {
          p_negocio: negocio,
          p_audiencia: audiencia || "TODOS",
          p_tipo: tipo || null,
          p_incluir_inactivos: incluirInactivos,
        });

      if (!errorRpc && Array.isArray(dataRpc) && dataRpc.length > 0) {
        const mapeados: CampanaInformativa[] = dataRpc.map((d: any) => ({
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
        return mapeados;
      }

      // 2. Fallback a consulta directa de tabla
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
      if (!error && Array.isArray(data)) {
        if (data.length > 0) {
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
        } else if ((eliminadosMemoria[negocio]?.size ?? 0) > 0) {
          // Si BDD retornó 0 filas y hubo eliminaciones, no forzar semillas
          cacheCampanasMemoria[negocio] = [];
        }
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error consultando com_campana_informativa:", err);
    }
  }

  const setEliminados = eliminadosMemoria[negocio] || new Set<string>();
  const base = (cacheCampanasMemoria[negocio] || CAMPANAS_SEMILLA_TRANQI).filter(
    (c) => !setEliminados.has(c.inf_id) && !setEliminados.has(c.inf_slug)
  );

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

  // Quitar de eliminados si se vuelve a guardar
  if (eliminadosMemoria[negocio]) {
    eliminadosMemoria[negocio].delete(id);
    eliminadosMemoria[negocio].delete(slug);
  }

  // 1. Guardar en memoria
  const lista = cacheCampanasMemoria[negocio] || [...CAMPANAS_SEMILLA_TRANQI];
  const idx = lista.findIndex((c) => c.inf_id === id || c.inf_slug === slug);
  if (idx >= 0) {
    lista[idx] = nuevaCampana;
  } else {
    lista.unshift(nuevaCampana);
  }
  cacheCampanasMemoria[negocio] = lista;

  // 2. Persistir en PostgreSQL
  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente) {
    try {
      // 2.1 Intentar vía RPC com_fn_guardar_campana_informativa
      const payloadRpc: any = {
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
      };

      if (esUuidValido(id)) {
        payloadRpc.inf_id = id;
      }

      const { data: resRpc, error: errRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_guardar_campana_informativa", { p_campana: payloadRpc });

      if (!errRpc && resRpc?.ok && resRpc.campana) {
        nuevaCampana.inf_id = resRpc.campana.inf_id;
        return { ok: true, campana: nuevaCampana };
      }

      // 2.2 Fallback directo a tabla com_campana_informativa
      const payloadTabla: any = { ...payloadRpc };
      if (esUuidValido(id)) {
        payloadTabla.inf_id = id;
      }
      payloadTabla.inf_actualizado_en = new Date().toISOString();

      const { data, error } = await cliente
        .schema("comun_comercio")
        .from("com_campana_informativa")
        .upsert(payloadTabla, { onConflict: "inf_negocio,inf_slug" })
        .select()
        .single();

      if (error) {
        console.error("[@eco/comercio] Error en upsert com_campana_informativa:", error);
      } else if (data) {
        nuevaCampana.inf_id = data.inf_id;
      }
    } catch (err: any) {
      console.error("[@eco/comercio] Error persistiendo campaña en Supabase:", err);
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
  const item = lista.find((c) => c.inf_id === infId || c.inf_slug === infId);
  const estadoFinal = typeof nuevoActivo === "boolean" ? nuevoActivo : !(item?.inf_activo ?? true);

  if (item) {
    item.inf_activo = estadoFinal;
    item.inf_actualizado_en = new Date().toISOString();
  }

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente && infId) {
    try {
      // 1. Intentar RPC
      const { data: resRpc, error: errRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_alternar_activo_campana", {
          p_negocio: negocio,
          p_id_o_slug: infId,
          p_activo: estadoFinal,
        });

      if (!errRpc && resRpc?.ok) {
        return { ok: true, inf_activo: estadoFinal };
      }

      // 2. Fallback directo a tabla
      if (esUuidValido(infId)) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .update({ inf_activo: estadoFinal, inf_actualizado_en: new Date().toISOString() })
          .eq("inf_id", infId);
      } else {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .update({ inf_activo: estadoFinal, inf_actualizado_en: new Date().toISOString() })
          .eq("inf_slug", infId);
      }
    } catch (err) {
      console.warn("[@eco/comercio] Error actualizando inf_activo en PostgreSQL:", err);
    }
  }

  return { ok: true, inf_activo: estadoFinal };
}

const MAPA_ID_A_SLUG: Record<string, string> = {};
CAMPANAS_SEMILLA_TRANQI.forEach((c) => {
  MAPA_ID_A_SLUG[c.inf_id] = c.inf_slug;
  MAPA_ID_A_SLUG[c.inf_slug] = c.inf_id;
});

/**
 * Elimina una campaña informativa de base de datos y memoria
 */
export async function eliminarCampanaInformativaAction(
  negocio = "tranqi",
  infId: string,
  infSlug?: string,
  infTitulo?: string
): Promise<{ ok: boolean; error?: string }> {
  const negocioNorm = (negocio || "tranqi").toLowerCase().trim();
  if (!eliminadosMemoria[negocioNorm]) {
    eliminadosMemoria[negocioNorm] = new Set<string>();
  }

  const slugMapeado = MAPA_ID_A_SLUG[infId] || infSlug;
  eliminadosMemoria[negocioNorm].add(infId);
  if (slugMapeado) eliminadosMemoria[negocioNorm].add(slugMapeado);
  if (infSlug) eliminadosMemoria[negocioNorm].add(infSlug);
  if (infTitulo) eliminadosMemoria[negocioNorm].add(infTitulo);

  const lista = cacheCampanasMemoria[negocioNorm] || [];
  cacheCampanasMemoria[negocioNorm] = lista.filter(
    (c) =>
      c.inf_id !== infId &&
      c.inf_slug !== infId &&
      c.inf_slug !== slugMapeado &&
      (!infSlug || c.inf_slug !== infSlug) &&
      (!infTitulo || c.inf_titulo !== infTitulo)
  );

  let cliente: any = null;
  try {
    cliente = crearClienteAdmin();
  } catch {}
  if (!cliente) {
    try {
      cliente = await crearClienteServidor();
    } catch {}
  }

  if (cliente) {
    try {
      // 1. Intentar RPC
      const { data: resRpc, error: errRpc } = await cliente
        .schema("comun_comercio")
        .rpc("com_fn_eliminar_campana_informativa", {
          p_negocio: negocioNorm,
          p_id_o_slug: infId,
        });

      if (!errRpc && resRpc?.ok) {
        // RPC exitoso
      }

      // 2. Direct table delete: Borrar por UUID, por slug y por título
      if (esUuidValido(infId)) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_id", infId);
      }

      const slugsABorrar = Array.from(new Set([infId, slugMapeado, infSlug].filter(Boolean))) as string[];
      for (const s of slugsABorrar) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_negocio", negocioNorm)
          .eq("inf_slug", s);
      }

      if (infTitulo) {
        await cliente
          .schema("comun_comercio")
          .from("com_campana_informativa")
          .delete()
          .eq("inf_negocio", negocioNorm)
          .eq("inf_titulo", infTitulo);
      }
    } catch (err: any) {
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
  if (eliminadosMemoria[negocio]) {
    eliminadosMemoria[negocio].clear();
  }
  cacheCampanasMemoria[negocio] = [...CAMPANAS_SEMILLA_TRANQI];

  // Re-persistir semillas en la base de datos
  for (const s of CAMPANAS_SEMILLA_TRANQI) {
    await guardarCampanaInformativaAction(s);
  }

  return { ok: true, total: CAMPANAS_SEMILLA_TRANQI.length };
}
