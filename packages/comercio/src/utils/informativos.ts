import { normalizarIdentificadorNegocio } from "./negocio";
import type { DetalleVigenciaTemporal } from "./vigencia";

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
    inf_subtitulo:
      "Se debate fijar un plazo mínimo contractual de 2 años y un tope de 2 meses de garantía para arriendos.",
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
    inf_subtitulo:
      "El Ministerio del Trabajo refuerza el registro digital obligatorio de horas suplementarias y descansos.",
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
    inf_subtitulo:
      "Nuevas reglas facilitan a empresas la creación de Distritos Autónomos de Energía y autogestión de excedentes.",
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
    inf_subtitulo:
      "Todo tratamiento de bases de datos exige consentimiento expreso previo y responsable técnico registrado.",
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
    inf_subtitulo:
      "Actas de junta celebradas telemáticamente con firma digital certificada mantienen pleno valor probatorio.",
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
    inf_subtitulo:
      "Aprobada reforma legal que endurece sanciones para la prevención del reclutamiento y explotación de menores.",
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
    inf_titulo:
      "Convenio de Capacitación: Diplomados & Maestrías en Derecho Societario y Procesal",
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
      cta_url:
        "https://wa.me/593999999999?text=Deseo%20informacion%20del%20convenio%20de%20capacitacion%20Tranqi",
      foto_ajuste: "cover",
      foto_posicion: "center center",
      foto_zoom: 100,
    },
  },
  {
    inf_id: "inf-trq-alerta-ant",
    inf_negocio: "tranqi",
    inf_titulo:
      "Alerta ANT: Suspensión Temporal en Sistema de Matriculación y Turnos Vehiculares",
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
    inf_titulo:
      "Oportunidad Tributaria: Descuento del 10% en Patente Municipal de Quito en Noviembre",
    inf_slug: "descuento-patente-municipal-quito-noviembre",
    inf_subtitulo:
      "Ahorro por pronto pago en obligaciones y patentes comerciales del Distrito Metropolitano",
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

const SEMILLAS_CAMPANAS_POR_NEGOCIO: Record<string, CampanaInformativa[]> = {
  tranqi: CAMPANAS_SEMILLA_TRANQI,
  tinkay: [],
  margaritas: [],
  fastfix: [],
};

/**
 * Normaliza el código de negocio de campañas informativas (ej. 'TNK' -> 'tinkay', 'TRQ' -> 'tranqi').
 * Nunca hace fallback implícito a otro negocio cuando se pasa un código válido.
 */
export function normalizarNegocioCampana(negocio?: string | null): string {
  const limpio = (negocio || "tranqi").trim();
  if (!limpio) return "tranqi";
  return normalizarIdentificadorNegocio(limpio).principal;
}

/**
 * Verifica aislamiento estricto multi-negocio: una campaña solo pertenece al negocio consultado
 * si ambos códigos normalizados coinciden exactamente.
 */
export function perteneceCampanaANegocio(
  campana: { inf_negocio?: string | null } | null | undefined,
  negocioObjetivo?: string | null
): boolean {
  if (!campana || !campana.inf_negocio || !campana.inf_negocio.trim()) {
    return false;
  }
  const negocioCampana = normalizarIdentificadorNegocio(campana.inf_negocio).principal;
  const negocioConsulta = normalizarNegocioCampana(negocioObjetivo);
  return negocioCampana === negocioConsulta;
}

/**
 * Devuelve una copia aislada de las semillas de campañas informativas exclusivas del negocio solicitado.
 * Negocios comerciales como tinkay, margaritas o fastfix jamás reciben semillas jurídicas de tranqi.
 */
export function obtenerSemillasCampanasPorNegocio(negocio?: string | null): CampanaInformativa[] {
  const negocioNorm = normalizarNegocioCampana(negocio);
  const semillas = SEMILLAS_CAMPANAS_POR_NEGOCIO[negocioNorm] ?? [];
  return semillas.map((s) => ({
    ...s,
    inf_audiencia: [...s.inf_audiencia],
    inf_ubicaciones: [...s.inf_ubicaciones],
    inf_detalle: { ...s.inf_detalle },
  }));
}

export function construirMapaSemillasIdSlugPorNegocio(
  negocio?: string | null
): Record<string, string> {
  const mapa: Record<string, string> = {};
  for (const c of obtenerSemillasCampanasPorNegocio(negocio)) {
    mapa[c.inf_id] = c.inf_slug;
    mapa[c.inf_slug] = c.inf_id;
  }
  return mapa;
}

/**
 * Filtra campañas garantizando primero el aislamiento estricto por negocio (`inf_negocio`),
 * luego bajas en sesión, estado activo, vigencia temporal, tipo, audiencia y ubicación.
 */
export function filtrarCampanasPorNegocioYCriterios(params: {
  campanas: CampanaInformativa[];
  negocio: string;
  audiencia?: AudienciaInformativo | "TODOS";
  ubicacion?: UbicacionInformativo | "TODOS";
  tipo?: TipoInformativo;
  incluirInactivos?: boolean;
  eliminados?: ReadonlySet<string>;
  ahoraIso?: string;
}): CampanaInformativa[] {
  const {
    campanas,
    negocio,
    audiencia,
    ubicacion,
    tipo,
    incluirInactivos = false,
    eliminados,
    ahoraIso = new Date().toISOString(),
  } = params;

  const negocioNorm = normalizarNegocioCampana(negocio);

  return campanas.filter((c) => {
    // 1. Aislamiento estricto multi-tenant: prohibido filtrar datos de otro negocio
    if (!perteneceCampanaANegocio(c, negocioNorm)) return false;

    // 2. Exclusión de registros eliminados en sesión
    if (eliminados) {
      if (eliminados.has(c.inf_id) || eliminados.has(c.inf_slug)) return false;
      if (c.inf_titulo && eliminados.has(c.inf_titulo)) return false;
    }

    // 3. Estado activo y vigencia temporal
    if (!incluirInactivos) {
      if (!c.inf_activo) return false;
      if (c.inf_fecha_inicio && c.inf_fecha_inicio > ahoraIso) return false;
      if (c.inf_fecha_fin && c.inf_fecha_fin < ahoraIso) return false;
    }

    // 4. Tipo de campaña
    if (tipo && c.inf_tipo !== tipo) return false;

    // 5. Audiencia
    if (audiencia && (audiencia as string) !== "TODOS") {
      const listaAud = Array.isArray(c.inf_audiencia) ? c.inf_audiencia : ["TODOS"];
      const matchAudiencia = listaAud.includes("TODOS") || listaAud.includes(audiencia);
      if (!matchAudiencia) return false;
    }

    // 6. Ubicación
    if (ubicacion && (ubicacion as string) !== "TODOS") {
      const listaUbi = Array.isArray(c.inf_ubicaciones) ? c.inf_ubicaciones : ["PANEL_INICIO"];
      if (!listaUbi.includes(ubicacion)) return false;
    }

    return true;
  });
}
