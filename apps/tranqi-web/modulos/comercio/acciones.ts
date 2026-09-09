"use server";

import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { revalidatePath } from "next/cache";

export interface CategoriaCatalogo {
  ctg_id: string;
  ctg_negocio: string;
  ctg_nombre: string;
  ctg_slug: string;
  ctg_descripcion: string | null;
  ctg_tipo: string;
  ctg_orden: number;
  ctg_activo: boolean;
}

export interface ProductoCatalogo {
  pro_id: string;
  pro_negocio: string;
  pro_nombre: string;
  pro_slug: string;
  pro_descripcion: string | null;
  pro_tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  pro_destacado: boolean;
  pro_categoria_principal_id: string | null;
  pro_detalle_producto: any;
  categoria?: {
    ctg_id: string;
    ctg_nombre: string;
    ctg_slug: string;
  } | null;
  variantes: VarianteCatalogo[];
}

export interface VarianteCatalogo {
  var_id: string;
  var_producto_id: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number; // Base imponible
  var_precio_comparacion?: number | null;
  var_codigo_impuesto_sri: string;
  var_tarifa_iva_porcentaje: number;
  var_tipo_oferta: string;
  var_frecuencia_recurrencia?: string | null;
  var_activo: boolean;
  var_detalle_variante: any;
  // Calculados
  monto_iva: number;
  precio_total: number;
}

export interface ConfiguracionPasarela {
  psc_id?: string;
  psc_negocio: string;
  psc_pasarela: string;
  psc_nombre_visible: string;
  psc_ambiente: "PRUEBAS" | "PRODUCCION";
  psc_activo: boolean;
  storeId: string;
  modoSimulado: boolean;
  token?: string;
  comisionPorcentaje: number;
  detalle?: any;
}

export interface TransaccionPagoCRM {
  pag_id: string;
  pag_secuencial: number;
  pag_negocio: string;
  pag_pasarela: string;
  pag_identificador_cliente: string;
  pag_transaccion_pasarela_id: string | null;
  pag_autorizacion_codigo: string | null;
  pag_estado: "PENDIENTE" | "APROBADO" | "RECHAZADO" | "CANCELADO" | "REVERSADO";
  pag_monto_total: number;
  pag_monto_sin_iva: number;
  pag_monto_con_iva: number;
  pag_monto_iva: number;
  pag_moneda: string;
  pag_titular_email: string | null;
  pag_titular_identificacion: string | null;
  pag_tarjeta_tipo: string | null;
  pag_tarjeta_marca: string | null;
  pag_tarjeta_ultimos_digitos: string | null;
  pag_confirmado_en: string | null;
  pag_creado_en: string;
  pag_detalle_transaccion: any;
}

// ==============================================================================
// 1. SEMILLAS Y ALMACÉN DE CATÁLOGO PRECONFIGURADO
// ==============================================================================

const CATEGORIAS_SEMILLA_TRANQI: CategoriaCatalogo[] = [
  {
    ctg_id: "cat-trq-tramites",
    ctg_negocio: "tranqi",
    ctg_nombre: "Trámites Puntuales",
    ctg_slug: "tramites",
    ctg_descripcion: "Trámites con honorarios fijos y alcance estandarizado.",
    ctg_tipo: "FORMATO",
    ctg_orden: 1,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-trq-consultas",
    ctg_negocio: "tranqi",
    ctg_nombre: "Consultas Legales & Patrocinio",
    ctg_slug: "consultas",
    ctg_descripcion: "Orientación y asesoría telemática con abogado verificado.",
    ctg_tipo: "FORMATO",
    ctg_orden: 2,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-trq-planes",
    ctg_negocio: "tranqi",
    ctg_nombre: "Planes Familiares",
    ctg_slug: "planes",
    ctg_descripcion: "Suscripción de protección y asesoría jurídica continua.",
    ctg_tipo: "FORMATO",
    ctg_orden: 3,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-trq-corporativos",
    ctg_negocio: "tranqi",
    ctg_nombre: "Planes Corporativos (B2B)",
    ctg_slug: "corporativos",
    ctg_descripcion: "Cobertura legal para empresas y colaboradores por tramos.",
    ctg_tipo: "FORMATO",
    ctg_orden: 4,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-trq-procesos",
    ctg_negocio: "tranqi",
    ctg_nombre: "Procesos Judiciales",
    ctg_slug: "procesos",
    ctg_descripcion: "Litigios, divorcios y trámites complejos bajo demanda.",
    ctg_tipo: "FORMATO",
    ctg_orden: 5,
    ctg_activo: true,
  },
];

const PRODUCTOS_SEMILLA_TRANQI: ProductoCatalogo[] = [
  {
    pro_id: "prod-trq-notarizacion",
    pro_negocio: "tranqi",
    pro_nombre: "Notarización de Documentos & Poderes",
    pro_slug: "notarizacion",
    pro_descripcion: "Notarización y gestión integral en notaría, con mensajería y traslado seguro de escrituras o poderes.",
    pro_tipo: "SERVICIO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-trq-tramites",
    pro_detalle_producto: {
      ambito: "Trámite Notarial",
      icono: "FileCheck",
      codigo_gobernanza: "TRQ-NOT-DOC",
      imagen_url: "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "24 a 48 horas hábiles",
      beneficios: [
        "Coordinación y turno prioritario en notaría de confianza",
        "Retiro y entrega de documentos a domicilio u oficina por mensajería segura",
        "Revisión jurídica previa de facultades, personerías y cláusulas habilitantes",
        "Emisión de constancia digital de protocolización",
      ],
      requisitos: [
        "Cédula de ciudadanía o pasaporte vigente del compareciente",
        "Certificado de votación del último proceso electoral",
        "Minuta o borrador del mandato o documento a protocolizar",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-tramites",
      ctg_nombre: "Trámites Puntuales",
      ctg_slug: "tramites",
    },
    variantes: [
      {
        var_id: "var-trq-not-doc",
        var_producto_id: "prod-trq-notarizacion",
        var_sku: "TRQ-NOT-DOC",
        var_nombre: "Notarización y Gestión en Notaría",
        var_precio: 200.0,
        var_precio_comparacion: 250.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 45, concepto_derecho: "PODER_NOTARIAL", modalidades: ["virtual", "presencial"] },
        monto_iva: 30.0,
        precio_total: 230.0,
      },
    ],
  },
  {
    pro_id: "prod-trq-permiso-salida",
    pro_negocio: "tranqi",
    pro_nombre: "Autorización de Salida del País de Menores",
    pro_slug: "permiso-salida",
    pro_descripcion: "Trámite integral de autorización notarial de salida del país para niños, niñas y adolescentes con acompañamiento legal.",
    pro_tipo: "SERVICIO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-trq-tramites",
    pro_detalle_producto: {
      ambito: "Familia y Notarial",
      icono: "FileCheck",
      codigo_gobernanza: "TRQ-SAL-PAI",
      imagen_url: "https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "24 horas hábiles",
      beneficios: [
        "Elaboración de autorización estandarizada conforme a la Ley Notarial",
        "Verificación de regulaciones migratorias del país de destino",
        "Acompañamiento telemático o presencial durante la firma",
      ],
      requisitos: [
        "Partida de nacimiento íntegra o certificado de nacimiento del menor",
        "Cédula y papeleta de votación del padre/madre otorgante",
        "Itinerario de viaje o información de acompañante",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-tramites",
      ctg_nombre: "Trámites Puntuales",
      ctg_slug: "tramites",
    },
    variantes: [
      {
        var_id: "var-trq-sal-pai",
        var_producto_id: "prod-trq-permiso-salida",
        var_sku: "TRQ-SAL-PAI",
        var_nombre: "Trámite Integral de Salida de Menores",
        var_precio: 150.0,
        var_precio_comparacion: 180.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 45, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "FAMILIA", modalidades: ["virtual"] },
        monto_iva: 22.5,
        precio_total: 172.5,
      },
    ],
  },
  {
    pro_id: "prod-trq-revision-contratos",
    pro_negocio: "tranqi",
    pro_nombre: "Revisión y Dictamen Express de Contratos",
    pro_slug: "revision-contratos",
    pro_descripcion: "Análisis exhaustivo de minutas, contratos de arrendamiento o comerciales con semáforo de riesgos y dictamen legal en 24h.",
    pro_tipo: "SERVICIO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-trq-tramites",
    pro_detalle_producto: {
      ambito: "Revisión Preventiva",
      icono: "FileCheck",
      codigo_gobernanza: "TRQ-REV-CON",
      imagen_url: "https://images.unsplash.com/photo-1454165804606-c3d57bc86b40?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "Menos de 24 horas",
      beneficios: [
        "Semáforo de riesgos legales por cada cláusula analizada",
        "Redacción correctiva y sugerencias de blindaje para el firmante",
        "Dictamen formal en PDF avalado por abogado especialista",
      ],
      requisitos: [
        "Contrato o minuta en formato digital (.doc o .pdf) de hasta 15 páginas",
        "Indicación del rol en el contrato (arrendador, inquilino, comprador, etc.)",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-tramites",
      ctg_nombre: "Trámites Puntuales",
      ctg_slug: "tramites",
    },
    variantes: [
      {
        var_id: "var-trq-rev-con",
        var_producto_id: "prod-trq-revision-contratos",
        var_sku: "TRQ-REV-CON",
        var_nombre: "Análisis de Contrato (hasta 10 págs.)",
        var_precio: 80.0,
        var_precio_comparacion: 100.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 60, concepto_derecho: "DICTAMEN_ESCRITO", modalidades: ["virtual"] },
        monto_iva: 12.0,
        precio_total: 92.0,
      },
    ],
  },
  {
    pro_id: "prod-trq-consultas",
    pro_negocio: "tranqi",
    pro_nombre: "Consulta Jurídica Telemática Especializada",
    pro_slug: "consulta-juridica-telemática",
    pro_descripcion: "Orientación legal y asesoría estratégica 1 a 1 por videollamada con un abogado certificado y evaluado.",
    pro_tipo: "SERVICIO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-trq-consultas",
    pro_detalle_producto: {
      ambito: "Asesoría Legal 1 a 1",
      icono: "Scale",
      codigo_gobernanza: "TRQ-CON-ESP",
      imagen_url: "https://images.unsplash.com/photo-1589829545856-d10d557cf95f?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "Agendamiento inmediato / Mismo día",
      beneficios: [
        "Videollamada privada en alta definición por Google Meet / Zoom",
        "Asignación de abogado especialista en la materia de tu caso",
        "Informe final de conclusiones y hoja de ruta legal por escrito",
      ],
      requisitos: [
        "Breve descripción del caso o antecedente a consultar",
        "Dispositivo con conexión a internet y cámara",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-consultas",
      ctg_nombre: "Consultas Legales & Patrocinio",
      ctg_slug: "consultas",
    },
    variantes: [
      {
        var_id: "var-trq-con-rap",
        var_producto_id: "prod-trq-consultas",
        var_sku: "TRQ-CON-RAP",
        var_nombre: "Orientación Rápida (30 min)",
        var_precio: 25.0,
        var_precio_comparacion: 35.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 30, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "GENERAL", modalidades: ["virtual"] },
        monto_iva: 3.75,
        precio_total: 28.75,
      },
      {
        var_id: "var-trq-con-esp",
        var_producto_id: "prod-trq-consultas",
        var_sku: "TRQ-CON-ESP",
        var_nombre: "Consulta Especialista (45 min)",
        var_precio: 45.0,
        var_precio_comparacion: 60.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 45, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "ESPECIALIDAD", modalidades: ["virtual"] },
        monto_iva: 6.75,
        precio_total: 51.75,
      },
      {
        var_id: "var-trq-con-con",
        var_producto_id: "prod-trq-consultas",
        var_sku: "TRQ-CON-CON",
        var_nombre: "Audiencia de Conciliación Extrajudicial (60 min)",
        var_precio: 60.0,
        var_precio_comparacion: 85.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 60, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "CONCILIACION", modalidades: ["virtual", "presencial"] },
        monto_iva: 9.0,
        precio_total: 69.0,
      },
      {
        var_id: "var-trq-con-tra",
        var_producto_id: "prod-trq-consultas",
        var_sku: "TRQ-CON-TRA",
        var_nombre: "Asesoría Urgente por Accidente de Tránsito (45 min)",
        var_precio: 45.0,
        var_precio_comparacion: 65.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 45, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "TRANSITO", modalidades: ["virtual"] },
        monto_iva: 6.75,
        precio_total: 51.75,
      },
    ],
  },
  {
    pro_id: "prod-trq-divorcio",
    pro_negocio: "tranqi",
    pro_nombre: "Patrocinio de Divorcio por Mutuo Acuerdo",
    pro_slug: "divorcio-mutuo-acuerdo",
    pro_descripcion: "Patrocinio legal integral del divorcio consensuado, desde la elaboración de la minuta hasta la sentencia notarial o judicial.",
    pro_tipo: "SERVICIO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-trq-procesos",
    pro_detalle_producto: {
      ambito: "Familia y Civil",
      icono: "Scale",
      codigo_gobernanza: "TRQ-DIV-MUT",
      imagen_url: "https://images.unsplash.com/photo-1521791136064-7986c2920216?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "7 a 15 días hábiles",
      beneficios: [
        "Elaboración del acuerdo regulador de tenencia, alimentos y visitas (si hay hijos)",
        "Representación y comparecencia ante notario público o juez de familia",
        "Inscripción de la marginación de divorcio en el Registro Civil",
      ],
      requisitos: [
        "Partida de matrimonio íntegra",
        "Partidas de nacimiento de los hijos menores (si aplica)",
        "Acuerdo mutuo de ambas partes para comparecer",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-procesos",
      ctg_nombre: "Procesos Judiciales",
      ctg_slug: "procesos",
    },
    variantes: [
      {
        var_id: "var-trq-div-mut",
        var_producto_id: "prod-trq-divorcio",
        var_sku: "TRQ-DIV-MUT",
        var_nombre: "Divorcio por Mutuo Acuerdo",
        var_precio: 400.0,
        var_precio_comparacion: 500.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "UNICO",
        var_activo: true,
        var_detalle_variante: { duracion_min: 60, concepto_derecho: "CONSULTA_TELEMATICA", materia_codigo: "FAMILIA", modalidades: ["virtual", "presencial"] },
        monto_iva: 60.0,
        precio_total: 460.0,
      },
    ],
  },
  {
    pro_id: "prod-trq-plan-proteccion",
    pro_negocio: "tranqi",
    pro_nombre: "Plan Familiar de Protección Jurídica",
    pro_slug: "plan-proteccion",
    pro_descripcion: "Suscripción con consultas y trámites incluidos para ti y tu familia con cobertura continua 24/7.",
    pro_tipo: "SUSCRIPCION",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-trq-planes",
    pro_detalle_producto: {
      ambito: "Membresía Continua",
      icono: "ShieldCheck",
      codigo_gobernanza: "TRQ-PLAN-FAM",
      imagen_url: "https://images.unsplash.com/photo-1551836022-d5d88e9218df?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "Activación inmediata tras suscripción",
      beneficios: [
        "Consultas legales telemáticas mensuales incluidas sin costo adicional",
        "Revisión ilimitada de contratos civiles y de arrendamiento",
        "Hasta 40% de descuento en juicios, defensas y trámites notariales",
        "Asistencia legal de urgencia 24/7 con ARIA y abogados de turno",
      ],
      requisitos: [
        "Registro de titular y beneficiarios del núcleo familiar",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-planes",
      ctg_nombre: "Planes Familiares",
      ctg_slug: "planes",
    },
    variantes: [
      {
        var_id: "var-trq-plan-bas",
        var_producto_id: "prod-trq-plan-proteccion",
        var_sku: "TRQ-PLAN-BAS",
        var_nombre: "Plan Básico Individual (1 Consulta/mes)",
        var_precio: 20.0,
        var_precio_comparacion: 25.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          cupo_consultas_mes: 1,
          descuento_tramites_pct: 20,
          modalidades: ["virtual"],
        },
        monto_iva: 3.0,
        precio_total: 23.0,
      },
      {
        var_id: "var-trq-plan-fam-med",
        var_producto_id: "prod-trq-plan-proteccion",
        var_sku: "TRQ-PLAN-FAM-MED",
        var_nombre: "Plan Familiar Medio (3 Consultas/mes)",
        var_precio: 30.0,
        var_precio_comparacion: 40.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          cupo_consultas_mes: 3,
          descuento_tramites_pct: 30,
          modalidades: ["virtual", "presencial"],
        },
        monto_iva: 4.5,
        precio_total: 34.5,
      },
      {
        var_id: "var-trq-plan-fam-plus",
        var_producto_id: "prod-trq-plan-proteccion",
        var_sku: "TRQ-PLAN-FAM-PLUS",
        var_nombre: "Plan Integral Familiar Plus (Ilimitadas)",
        var_precio: 50.0,
        var_precio_comparacion: 70.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          cupo_consultas_mes: 99,
          descuento_tramites_pct: 40,
          modalidades: ["virtual", "presencial"],
        },
        monto_iva: 7.5,
        precio_total: 57.5,
      },
    ],
  },
  {
    pro_id: "prod-trq-plan-corporativo",
    pro_negocio: "tranqi",
    pro_nombre: "Plan Corporativo de Asesoría Jurídica (B2B)",
    pro_slug: "plan-corporativo-b2b",
    pro_descripcion: "Cobertura legal y blindaje corporativo para empresas, directivos y colaboradores por tramo de colaboradores.",
    pro_tipo: "SUSCRIPCION",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-trq-corporativos",
    pro_detalle_producto: {
      ambito: "Blindaje Empresarial",
      icono: "ShieldCheck",
      codigo_gobernanza: "TRQ-PLAN-CORP",
      imagen_url: "https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1000&q=80",
      video_url: "https://www.youtube.com/watch?v=kXYiU_JCYtU",
      tiempo_entrega: "Activación y onboarding corporativo en 24 horas",
      beneficios: [
        "Asesoría laboral, societaria, tributaria y contractual preventiva",
        "Revisión y elaboración ilimitada de contratos comerciales",
        "Mesa de ayuda legal para colaboradores de la nómina empresarial",
        "Emisión de informe mensual de contingencias y estado legal",
      ],
      requisitos: [
        "RUC de la empresa y nombramiento del representante legal",
        "Lista de colaboradores a incorporar en el plan",
      ],
    },
    categoria: {
      ctg_id: "cat-trq-corporativos",
      ctg_nombre: "Planes Corporativos (B2B)",
      ctg_slug: "corporativos",
    },
    variantes: [
      {
        var_id: "var-trq-corp-t1",
        var_producto_id: "prod-trq-plan-corporativo",
        var_sku: "TRQ-CORP-T1",
        var_nombre: "Corporativo Tramo 1 (1 a 10 colaboradores)",
        var_precio: 15.0,
        var_precio_comparacion: 20.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          tramo: "1-10",
          tarifa_por_colaborador: 15.0,
        },
        monto_iva: 2.25,
        precio_total: 17.25,
      },
      {
        var_id: "var-trq-corp-t2",
        var_producto_id: "prod-trq-plan-corporativo",
        var_sku: "TRQ-CORP-T2",
        var_nombre: "Corporativo Tramo 2 (11 a 50 colaboradores)",
        var_precio: 12.0,
        var_precio_comparacion: 16.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          tramo: "11-50",
          tarifa_por_colaborador: 12.0,
        },
        monto_iva: 1.8,
        precio_total: 13.8,
      },
      {
        var_id: "var-trq-corp-t3",
        var_producto_id: "prod-trq-plan-corporativo",
        var_sku: "TRQ-CORP-T3",
        var_nombre: "Corporativo Tramo 3 (>50 colaboradores)",
        var_precio: 9.0,
        var_precio_comparacion: 12.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "RECURRENTE_MENSUAL",
        var_frecuencia_recurrencia: "MENSUAL",
        var_activo: true,
        var_detalle_variante: {
          tramo: ">50",
          tarifa_por_colaborador: 9.0,
        },
        monto_iva: 1.35,
        precio_total: 10.35,
      },
    ],
  },
];

const CATEGORIAS_SEMILLA_TINKAY: CategoriaCatalogo[] = [
  {
    ctg_id: "cat-tinkay-001",
    ctg_negocio: "tinkay",
    ctg_nombre: "Para Florero",
    ctg_slug: "cat-floreros",
    ctg_descripcion: "Ramos de tallos largos seleccionados, listos para hidratarse en florero de agua.",
    ctg_tipo: "FORMATO",
    ctg_orden: 1,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-002",
    ctg_negocio: "tinkay",
    ctg_nombre: "Estilo Coreano",
    ctg_slug: "cat-coreanos",
    ctg_descripcion: "Bouquets de vanguardia envueltos en papeles traslúcidos, plisados y cintas satinadas.",
    ctg_tipo: "COLECCION",
    ctg_orden: 2,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-003",
    ctg_negocio: "tinkay",
    ctg_nombre: "Especiales y Mix",
    ctg_slug: "cat-especiales",
    ctg_descripcion: "Combinaciones botánicas exóticas de temporada con follajes aromáticos.",
    ctg_tipo: "FORMATO",
    ctg_orden: 3,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-004",
    ctg_negocio: "tinkay",
    ctg_nombre: "Abanicos & Pedestales",
    ctg_slug: "cat-abanicos",
    ctg_descripcion: "Composiciones monumentales sobre atril o pedestal para espacios solemnes.",
    ctg_tipo: "FORMATO",
    ctg_orden: 4,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-005",
    ctg_negocio: "tinkay",
    ctg_nombre: "Detalles y Regalos",
    ctg_slug: "cat-detalles",
    ctg_descripcion: "Complementos: chocolates Ferrero Rocher, globos burbuja y mariposas 3D.",
    ctg_tipo: "COMPLEMENTO",
    ctg_orden: 5,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-006",
    ctg_negocio: "tinkay",
    ctg_nombre: "Decoración & Altares",
    ctg_slug: "cat-eventos",
    ctg_descripcion: "Diseños integrales para matrimonios, recepciones e iglesias.",
    ctg_tipo: "EVENTO",
    ctg_orden: 6,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-007",
    ctg_negocio: "tinkay",
    ctg_nombre: "Amor & Pedida de Mano",
    ctg_slug: "cat-ocas-amor",
    ctg_descripcion: "Diseños románticos exuberantes de rosas rojas para compromisos.",
    ctg_tipo: "OCASION",
    ctg_orden: 7,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-008",
    ctg_negocio: "tinkay",
    ctg_nombre: "Aniversario",
    ctg_slug: "cat-ocas-aniv",
    ctg_descripcion: "Bouquets refinados para celebrar fechas clave.",
    ctg_tipo: "OCASION",
    ctg_orden: 8,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-009",
    ctg_negocio: "tinkay",
    ctg_nombre: "Cumpleaños",
    ctg_slug: "cat-ocas-cumple",
    ctg_descripcion: "Ramos alegres y festivos con empaques vibrantes.",
    ctg_tipo: "OCASION",
    ctg_orden: 9,
    ctg_activo: true,
  },
  {
    ctg_id: "cat-tinkay-010",
    ctg_negocio: "tinkay",
    ctg_nombre: "Condolencias & Funerarios",
    ctg_slug: "cat-ocas-condol",
    ctg_descripcion: "Arreglos respetuosos y sobrios para homenajes luctuosos.",
    ctg_tipo: "OCASION",
    ctg_orden: 10,
    ctg_activo: true,
  },
];

const PRODUCTOS_SEMILLA_TINKAY: ProductoCatalogo[] = [
  {
    pro_id: "prod-tinkay-florero",
    pro_negocio: "tinkay",
    pro_nombre: "Bouquet Clásico para Florero",
    pro_slug: "tinkay-bouq-florero",
    pro_descripcion: "Ramos de rosas de exportación seleccionadas de tallo largo, preparadas con follaje fino e hidratación prolongada.",
    pro_tipo: "FISICO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-tinkay-001",
    pro_detalle_producto: {
      icono: "Flower2",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-bouq-florero",
      descripcion_corta: "Rosas de exportación de tallo largo con follaje de hidratación prolongada.",
      etiquetas: ["rosas", "florero", "25 rosas", "50 rosas", "100 rosas"],
    },
    categoria: { ctg_id: "cat-tinkay-001", ctg_nombre: "Para Florero", ctg_slug: "cat-floreros" },
    variantes: [
      {
        var_id: "var-tinkay-flor-25",
        var_producto_id: "prod-tinkay-florero",
        var_sku: "TNK-FLOR-25",
        var_nombre: "25 Tallos de Rosas",
        var_precio: 17.3913,
        var_precio_comparacion: 20.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 20.0, tallos: 25 },
        monto_iva: 2.6087,
        precio_total: 20.0,
      },
      {
        var_id: "var-tinkay-flor-50",
        var_producto_id: "prod-tinkay-florero",
        var_sku: "TNK-FLOR-50",
        var_nombre: "50 Tallos de Rosas",
        var_precio: 21.7391,
        var_precio_comparacion: 25.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 25.0, tallos: 50 },
        monto_iva: 3.2609,
        precio_total: 25.0,
      },
      {
        var_id: "var-tinkay-flor-100",
        var_producto_id: "prod-tinkay-florero",
        var_sku: "TNK-FLOR-100",
        var_nombre: "100 Tallos de Rosas (Gran Impacto)",
        var_precio: 39.1304,
        var_precio_comparacion: 45.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 45.0, tallos: 100 },
        monto_iva: 5.8696,
        precio_total: 45.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-coreano",
    pro_negocio: "tinkay",
    pro_nombre: "Bouquet Diseño Estilo Coreano",
    pro_slug: "tinkay-bouq-coreano",
    pro_descripcion: "Arreglo exclusivo de vanguardia envuelto en finos papeles coreanos plisados y translúcidos con caída de cintas de seda satinada.",
    pro_tipo: "FISICO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-tinkay-002",
    pro_detalle_producto: {
      icono: "Sparkles",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-bouq-coreano",
      descripcion_corta: "Bouquet moderno envuelto en papel coreano plisado y cintas satinadas.",
      etiquetas: ["coreano", "vanguardia", "cumpleanos", "vip"],
    },
    categoria: { ctg_id: "cat-tinkay-002", ctg_nombre: "Estilo Coreano", ctg_slug: "cat-coreanos" },
    variantes: [
      {
        var_id: "var-tinkay-cor-peq",
        var_producto_id: "prod-tinkay-coreano",
        var_sku: "TNK-COR-PEQ",
        var_nombre: "Pequeño (12 Rosas)",
        var_precio: 21.7391,
        var_precio_comparacion: 25.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 25.0, tamano: "Pequeño" },
        monto_iva: 3.2609,
        precio_total: 25.0,
      },
      {
        var_id: "var-tinkay-cor-med",
        var_producto_id: "prod-tinkay-coreano",
        var_sku: "TNK-COR-MED",
        var_nombre: "Mediano (24 Rosas)",
        var_precio: 30.4348,
        var_precio_comparacion: 35.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 35.0, tamano: "Mediano" },
        monto_iva: 4.5652,
        precio_total: 35.0,
      },
      {
        var_id: "var-tinkay-cor-gra",
        var_producto_id: "prod-tinkay-coreano",
        var_sku: "TNK-COR-GRA",
        var_nombre: "Grande (36 Rosas)",
        var_precio: 39.1304,
        var_precio_comparacion: 45.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 45.0, tamano: "Grande" },
        monto_iva: 5.8696,
        precio_total: 45.0,
      },
      {
        var_id: "var-tinkay-cor-gig",
        var_producto_id: "prod-tinkay-coreano",
        var_sku: "TNK-COR-GIG",
        var_nombre: "Gigante VIP (50 Rosas + Corona + Mariposas)",
        var_precio: 52.1739,
        var_precio_comparacion: 60.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 60.0, tamano: "Gigante VIP" },
        monto_iva: 7.8261,
        precio_total: 60.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-mix",
    pro_negocio: "tinkay",
    pro_nombre: "Bouquet Mix Exótico de Temporada",
    pro_slug: "tinkay-bouq-mix",
    pro_descripcion: "Composición floral multicolor que armoniza rosas ecuatorianas, orquídeas, eucalipto perfumado y flores silvestres de temporada.",
    pro_tipo: "FISICO",
    pro_destacado: true,
    pro_categoria_principal_id: "cat-tinkay-003",
    pro_detalle_producto: {
      icono: "Palmtree",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-bouq-mix",
      descripcion_corta: "Armonía silvestre y exótica con flores de temporada.",
      etiquetas: ["mix", "exotico", "temporada", "multicolor"],
    },
    categoria: { ctg_id: "cat-tinkay-003", ctg_nombre: "Especiales y Mix", ctg_slug: "cat-especiales" },
    variantes: [
      {
        var_id: "var-tinkay-mix-peq",
        var_producto_id: "prod-tinkay-mix",
        var_sku: "TNK-MIX-PEQ",
        var_nombre: "Mix Pequeño de Temporada",
        var_precio: 30.4348,
        var_precio_comparacion: 35.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 35.0 },
        monto_iva: 4.5652,
        precio_total: 35.0,
      },
      {
        var_id: "var-tinkay-mix-gra",
        var_producto_id: "prod-tinkay-mix",
        var_sku: "TNK-MIX-GRA",
        var_nombre: "Mix Grande de Temporada",
        var_precio: 39.1304,
        var_precio_comparacion: 45.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 45.0 },
        monto_iva: 5.8696,
        precio_total: 45.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-abanico",
    pro_negocio: "tinkay",
    pro_nombre: "Arreglo Monumental en Abanico / Pedestal",
    pro_slug: "tinkay-abanico-monumental",
    pro_descripcion: "Diseño monumental de gran altura dispuesto en abanico sobre pedestal o base solemne. Ideal para tributos de condolencias y ceremonias.",
    pro_tipo: "FISICO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-004",
    pro_detalle_producto: {
      icono: "Maximize2",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-abanico-monumental",
      descripcion_corta: "Imponente arreglo sobre pedestal para velaciones y homenajes solemnes.",
      etiquetas: ["abanico", "pedestal", "condolencias", "solemne"],
    },
    categoria: { ctg_id: "cat-tinkay-004", ctg_nombre: "Abanicos & Pedestales", ctg_slug: "cat-abanicos" },
    variantes: [
      {
        var_id: "var-tinkay-aba-monu",
        var_producto_id: "prod-tinkay-abanico",
        var_sku: "TNK-ABA-MONU",
        var_nombre: "Abanico Monumental con Pedestal y Cinta",
        var_precio: 69.5652,
        var_precio_comparacion: 80.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 80.0 },
        monto_iva: 10.4348,
        precio_total: 80.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-ferrero",
    pro_negocio: "tinkay",
    pro_nombre: "Caja de Chocolates Ferrero Rocher",
    pro_slug: "tinkay-choc-ferrero",
    pro_descripcion: "Exquisita selección de bombones de avellana entera y crema crujiente bañados en chocolate con leche.",
    pro_tipo: "FISICO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-005",
    pro_detalle_producto: {
      icono: "Gift",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-detalles",
      descripcion_corta: "Bombones de avellana y chocolate con leche.",
      etiquetas: ["chocolates", "ferrero", "dulce"],
    },
    categoria: { ctg_id: "cat-tinkay-005", ctg_nombre: "Detalles y Regalos", ctg_slug: "cat-detalles" },
    variantes: [
      {
        var_id: "var-tinkay-choc-4",
        var_producto_id: "prod-tinkay-ferrero",
        var_sku: "TNK-CHOC-4",
        var_nombre: "Caja x4 Unidades",
        var_precio: 4.3478,
        var_precio_comparacion: 5.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 5.0, unidades: 4 },
        monto_iva: 0.6522,
        precio_total: 5.0,
      },
      {
        var_id: "var-tinkay-choc-8",
        var_producto_id: "prod-tinkay-ferrero",
        var_sku: "TNK-CHOC-8",
        var_nombre: "Caja x8 Unidades",
        var_precio: 7.8261,
        var_precio_comparacion: 9.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 9.0, unidades: 8 },
        monto_iva: 1.1739,
        precio_total: 9.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-globo",
    pro_negocio: "tinkay",
    pro_nombre: "Globo Burbuja Personalizado con Helio",
    pro_slug: "tinkay-globo-burbuja",
    pro_descripcion: "Globo burbuja transparente de cristal inflado con gas helio y dedicatoria personalizada en vinil adhesivo metalizado.",
    pro_tipo: "FISICO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-005",
    pro_detalle_producto: {
      icono: "Gift",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-detalles",
      descripcion_corta: "Globo con helio y mensaje caligráfico en vinil metalizado.",
      etiquetas: ["globo", "helio", "personalizado"],
    },
    categoria: { ctg_id: "cat-tinkay-005", ctg_nombre: "Detalles y Regalos", ctg_slug: "cat-detalles" },
    variantes: [
      {
        var_id: "var-tinkay-glo-bur",
        var_producto_id: "prod-tinkay-globo",
        var_sku: "TNK-GLO-BUR",
        var_nombre: "Globo Burbuja Helio Personalizado",
        var_precio: 4.3478,
        var_precio_comparacion: 5.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 5.0 },
        monto_iva: 0.6522,
        precio_total: 5.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-mariposas",
    pro_negocio: "tinkay",
    pro_nombre: "Set de Mariposas Decorativas 3D",
    pro_slug: "tinkay-mariposas-3d",
    pro_descripcion: "Trío de mariposas decorativas en relieve tridimensional para posar sutilmente sobre los pétalos del bouquet floral.",
    pro_tipo: "FISICO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-005",
    pro_detalle_producto: {
      icono: "Sparkles",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-detalles",
      descripcion_corta: "Set de 3 mariposas 3D decorativas.",
      etiquetas: ["mariposas", "3d", "adorno"],
    },
    categoria: { ctg_id: "cat-tinkay-005", ctg_nombre: "Detalles y Regalos", ctg_slug: "cat-detalles" },
    variantes: [
      {
        var_id: "var-tinkay-mar-set",
        var_producto_id: "prod-tinkay-mariposas",
        var_sku: "TNK-MAR-SET",
        var_nombre: "Set x3 Mariposas 3D",
        var_precio: 1.7391,
        var_precio_comparacion: 2.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 2.0, unidades: 3 },
        monto_iva: 0.2609,
        precio_total: 2.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-altar",
    pro_negocio: "tinkay",
    pro_nombre: "Arco Floral y Decoración de Altar",
    pro_slug: "tinkay-arco-altar",
    pro_descripcion: "Estructura monumental de arco o columnas florales para matrimonios civiles, eclesiásticos o eventos corporativos de gala.",
    pro_tipo: "SERVICIO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-006",
    pro_detalle_producto: {
      icono: "Church",
      album_fotos_url: "https://photos.app.goo.gl/tinkay-eventos",
      descripcion_corta: "Decoración botánica para ceremonias matrimoniales y altares.",
      etiquetas: ["arco", "altar", "boda", "evento"],
    },
    categoria: { ctg_id: "cat-tinkay-006", ctg_nombre: "Decoración & Altares", ctg_slug: "cat-eventos" },
    variantes: [
      {
        var_id: "var-tinkay-alt-bas",
        var_producto_id: "prod-tinkay-altar",
        var_sku: "TNK-ALT-BAS",
        var_nombre: "Opción 1: Altar Básico",
        var_precio: 86.9565,
        var_precio_comparacion: 100.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 100.0 },
        monto_iva: 13.0435,
        precio_total: 100.0,
      },
      {
        var_id: "var-tinkay-alt-med",
        var_producto_id: "prod-tinkay-altar",
        var_sku: "TNK-ALT-MED",
        var_nombre: "Opción 2: Altar Medio",
        var_precio: 130.4348,
        var_precio_comparacion: 150.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 150.0 },
        monto_iva: 19.5652,
        precio_total: 150.0,
      },
      {
        var_id: "var-tinkay-alt-pro",
        var_producto_id: "prod-tinkay-altar",
        var_sku: "TNK-ALT-PRO",
        var_nombre: "Opción 3: Full Floral / Pro",
        var_precio: 173.913,
        var_precio_comparacion: 200.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 200.0 },
        monto_iva: 26.087,
        precio_total: 200.0,
      },
    ],
  },
  {
    pro_id: "prod-tinkay-logistica",
    pro_negocio: "tinkay",
    pro_nombre: "Servicios Logísticos y Entrega en Horario Exacto",
    pro_slug: "tinkay-servicios-logisticos",
    pro_descripcion: "Líneas de servicio especializado: montaje floral en sitio, desmontaje nocturno y asignación de ruta exclusiva a hora exacta.",
    pro_tipo: "SERVICIO",
    pro_destacado: false,
    pro_categoria_principal_id: "cat-tinkay-006",
    pro_detalle_producto: {
      icono: "Truck",
      descripcion_corta: "Servicios de montaje, logística e itinerario exclusivo programado.",
      etiquetas: ["montaje", "flete", "horario exacto", "logistica"],
    },
    categoria: { ctg_id: "cat-tinkay-006", ctg_nombre: "Decoración & Altares", ctg_slug: "cat-eventos" },
    variantes: [
      {
        var_id: "var-tinkay-log-exacta",
        var_producto_id: "prod-tinkay-logistica",
        var_sku: "TNK-LOG-HORA-EXACTA",
        var_nombre: "Recargo por Entrega en Horario Exacto / Madrugador",
        var_precio: 8.6957,
        var_precio_comparacion: 10.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 10.0 },
        monto_iva: 1.3043,
        precio_total: 10.0,
      },
      {
        var_id: "var-tinkay-srv-inst",
        var_producto_id: "prod-tinkay-logistica",
        var_sku: "TNK-SRV-INST",
        var_nombre: "Servicio de Montaje e Instalación en Sitio",
        var_precio: 26.087,
        var_precio_comparacion: 30.0,
        var_codigo_impuesto_sri: "IVA_15",
        var_tarifa_iva_porcentaje: 15,
        var_tipo_oferta: "TIEMPO_MANO_OBRA",
        var_activo: true,
        var_detalle_variante: { pvp_nominal: 30.0 },
        monto_iva: 3.913,
        precio_total: 30.0,
      },
    ],
  },
];

// Almacén en memoria para productos y categorías creados dinámicamente durante la sesión
const storeCustomCategorias: Map<string, CategoriaCatalogo[]> = new Map();
const storeCustomProductos: Map<string, ProductoCatalogo[]> = new Map();

// Helper para generar slug simple
function generarSlug(texto: string): string {
  return texto
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// ==============================================================================
// 2. ACCIONES DE CONSULTA
// ==============================================================================

/**
 * Obtiene todas las categorías disponibles para el negocio
 */
export async function obtenerCategoriasAction(negocio = "tranqi"): Promise<CategoriaCatalogo[]> {
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteActivo = admin || supabase;

  let categoriasDb: any[] = [];
  if (clienteActivo) {
    try {
      const { data: catCom, error: errCom } = await clienteActivo
        .schema("comun_comercio")
        .from("com_categoria")
        .select("*")
        .eq("ctg_negocio", negocio)
        .eq("ctg_activo", true)
        .order("ctg_orden", { ascending: true });

      if (!errCom && catCom && catCom.length > 0) {
        categoriasDb = catCom;
      }
    } catch {
      // Fallback silencioso
    }
  }

  const semillasPorNegocio = negocio === "tinkay" ? CATEGORIAS_SEMILLA_TINKAY : (negocio === "tranqi" ? CATEGORIAS_SEMILLA_TRANQI : []);
  const base = categoriasDb.length > 0 ? categoriasDb : semillasPorNegocio;
  const customs = storeCustomCategorias.get(negocio) || [];

  // Mezclar evitando duplicados por ctg_id o ctg_slug
  const resultado: CategoriaCatalogo[] = [...base];
  customs.forEach((c) => {
    if (!resultado.some((r) => r.ctg_id === c.ctg_id || r.ctg_slug === c.ctg_slug)) {
      resultado.push(c);
    }
  });

  return resultado;
}

/**
 * Obtiene el catálogo de productos y variantes activas agrupadas con cálculo impositivo ecuatoriano (IVA 15%)
 */
export async function obtenerCatalogoProductosAction(negocio = "tranqi"): Promise<ProductoCatalogo[]> {
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteActivo = admin || supabase;

  let prodsDb: any[] = [];
  let varsDb: any[] = [];
  let catsDb: any[] = [];

  if (clienteActivo) {
    try {
      // 1. Categorías para resolución exacta
      const { data: cData } = await clienteActivo
        .schema("comun_comercio")
        .from("com_categoria")
        .select("ctg_id, ctg_nombre, ctg_slug, ctg_negocio, ctg_activo")
        .eq("ctg_negocio", negocio)
        .eq("ctg_activo", true);
      catsDb = cData || [];

      // 2. Productos
      const { data: pCom, error: errPCom } = await clienteActivo
        .schema("comun_comercio")
        .from("com_producto")
        .select("*")
        .eq("pro_negocio", negocio)
        .eq("pro_activo", true)
        .order("pro_destacado", { ascending: false });

      if (!errPCom && pCom && pCom.length > 0) {
        prodsDb = pCom;
        const { data: vCom } = await clienteActivo
          .schema("comun_comercio")
          .from("com_variante")
          .select("*")
          .eq("var_negocio", negocio)
          .eq("var_activo", true)
          .order("var_precio", { ascending: true });
        varsDb = vCom || [];
      }
    } catch {
      // Fallback silencioso a semillas
    }
  }

  let listaFinal: ProductoCatalogo[] = [];

  if (prodsDb.length > 0) {
    const mapaCategorias = (catsDb || []).reduce((acc: any, c: any) => {
      acc[c.ctg_id] = { ctg_id: c.ctg_id, ctg_nombre: c.ctg_nombre, ctg_slug: c.ctg_slug };
      return acc;
    }, {});

    const mapaVariantes = (varsDb || []).reduce((acc: Record<string, VarianteCatalogo[]>, v: any) => {
      const base = Number(v.var_precio) || 0;
      const tarifaIva = Number(v.var_tarifa_iva_porcentaje) || 15;
      const iva = Number(((base * tarifaIva) / 100).toFixed(4));
      const total = Number((base + iva).toFixed(2));

      const item: VarianteCatalogo = {
        var_id: v.var_id,
        var_producto_id: v.var_producto_id,
        var_sku: v.var_sku,
        var_nombre: v.var_nombre,
        var_precio: base,
        var_precio_comparacion: v.var_precio_comparacion ? Number(v.var_precio_comparacion) : null,
        var_codigo_impuesto_sri: v.var_codigo_impuesto_sri || "IVA_15",
        var_tarifa_iva_porcentaje: tarifaIva,
        var_tipo_oferta: v.var_tipo_oferta,
        var_frecuencia_recurrencia: v.var_frecuencia_recurrencia,
        var_activo: v.var_activo,
        var_detalle_variante: v.var_detalle_variante || {},
        monto_iva: iva,
        precio_total: total,
      };

      const prodId = v.var_producto_id;
      if (!acc[prodId]) {
        acc[prodId] = [];
      }
      acc[prodId]?.push(item);
      return acc;
    }, {});

    listaFinal = prodsDb.map((p: any) => ({
      pro_id: p.pro_id,
      pro_negocio: p.pro_negocio,
      pro_nombre: p.pro_nombre,
      pro_slug: p.pro_slug,
      pro_descripcion: p.pro_descripcion,
      pro_tipo: p.pro_tipo,
      pro_destacado: p.pro_destacado,
      pro_categoria_principal_id: p.pro_categoria_principal_id,
      pro_detalle_producto: p.pro_detalle_producto || {},
      categoria: mapaCategorias[p.pro_categoria_principal_id] || null,
      variantes: mapaVariantes[p.pro_id] || [],
    }));
  } else {
    // Si no hay productos en la BD, cargamos las semillas preconfiguradas
    listaFinal = negocio === "tinkay" ? [...PRODUCTOS_SEMILLA_TINKAY] : (negocio === "tranqi" ? [...PRODUCTOS_SEMILLA_TRANQI] : []);
  }

  // Incorporar productos creados o editados dinámicamente en memoria
  const customs = storeCustomProductos.get(negocio) || [];
  customs.forEach((p) => {
    const idx = listaFinal.findIndex((item) => item.pro_id === p.pro_id || item.pro_slug === p.pro_slug);
    if (idx >= 0) {
      listaFinal[idx] = p; // Reemplaza con la versión editada
    } else {
      listaFinal.unshift(p);
    }
  });

  // Filtrar productos inactivos o eliminados
  return listaFinal.filter((p: any) => p.pro_activo !== false);
}

// ==============================================================================
// 3. ACCIONES DE CREACIÓN DE CATEGORÍAS Y PRODUCTOS
// ==============================================================================

/**
 * Crea una nueva categoría comercial
 */
export async function crearCategoriaAction(datos: {
  nombre: string;
  slug?: string;
  descripcion?: string;
  tipo?: string;
  orden?: number;
  negocio?: string;
}): Promise<{ ok: boolean; categoria?: CategoriaCatalogo; error?: string }> {
  try {
    const negocio = datos.negocio || "tranqi";
    const nombre = datos.nombre.trim();
    if (!nombre) {
      return { ok: false, error: "El nombre de la categoría es obligatorio." };
    }

    const slug = datos.slug?.trim() || generarSlug(nombre);
    const catId = `cat-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;

    const nuevaCat: CategoriaCatalogo = {
      ctg_id: catId,
      ctg_negocio: negocio,
      ctg_nombre: nombre,
      ctg_slug: slug,
      ctg_descripcion: datos.descripcion?.trim() || null,
      ctg_tipo: datos.tipo || "FORMATO",
      ctg_orden: datos.orden || 10,
      ctg_activo: true,
    };

    // 1. Intentar persistir en Supabase
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_categoria")
          .upsert(
            {
              ctg_negocio: negocio,
              ctg_nombre: nombre,
              ctg_slug: slug,
              ctg_descripcion: datos.descripcion?.trim() || null,
              ctg_tipo: datos.tipo || "FORMATO",
              ctg_orden: datos.orden || 10,
              ctg_activo: true,
            },
            { onConflict: "ctg_negocio, ctg_slug" }
          );
      } catch {
        try {
          await clienteActivo.from("com_categoria").upsert(
            {
              ctg_negocio: negocio,
              ctg_nombre: nombre,
              ctg_slug: slug,
              ctg_descripcion: datos.descripcion?.trim() || null,
              ctg_tipo: datos.tipo || "FORMATO",
              ctg_orden: datos.orden || 10,
              ctg_activo: true,
            },
            { onConflict: "ctg_negocio, ctg_slug" }
          );
        } catch {
          // Guardar en memoria
        }
      }
    }

    // 2. Guardar en almacén local
    const actuales = storeCustomCategorias.get(negocio) || [];
    actuales.push(nuevaCat);
    storeCustomCategorias.set(negocio, actuales);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true, categoria: nuevaCat };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al crear la categoría." };
  }
}

/**
 * Crea un nuevo producto u honorario profesional con su variante de cobro
 */
export async function crearProductoAction(datos: {
  nombre: string;
  slug?: string;
  descripcion: string;
  categoriaId?: string;
  tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  destacado?: boolean;
  precioBase: number;
  tarifaIva?: number; // 15 o 0
  sku?: string;
  icono?: "Scale" | "ShieldCheck" | "FileCheck" | "CreditCard";
  imagenUrl?: string;
  videoUrl?: string;
  beneficios?: string[];
  tiempoEntrega?: string;
  requisitos?: string[];
  modalidadPago?: string;
  negocio?: string;
}): Promise<{ ok: boolean; producto?: ProductoCatalogo; error?: string }> {
  try {
    const negocio = datos.negocio || "tranqi";
    const nombre = datos.nombre.trim();
    if (!nombre) {
      return { ok: false, error: "El nombre del producto u honorario es obligatorio." };
    }
    if (datos.precioBase <= 0) {
      return { ok: false, error: "El precio base debe ser mayor a cero." };
    }

    const slug = datos.slug?.trim() || generarSlug(nombre);
    const prodId = `prod-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const varId = `var-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`;
    const sku = datos.sku?.trim() || `TRQ-${generarSlug(nombre).toUpperCase().substring(0, 10)}`;

    const tarifaIva = datos.tarifaIva ?? 15;
    const base = Number(datos.precioBase.toFixed(2));
    const montoIva = Number(((base * tarifaIva) / 100).toFixed(2));
    const total = Number((base + montoIva).toFixed(2));

    // Obtener categoría asociada
    const cats = await obtenerCategoriasAction(negocio);
    const cat = cats.find((c) => c.ctg_id === datos.categoriaId) || cats[0] || null;

    const nuevaVariante: VarianteCatalogo = {
      var_id: varId,
      var_producto_id: prodId,
      var_sku: sku,
      var_nombre: `${nombre} (Tarifa Estándar)`,
      var_precio: base,
      var_precio_comparacion: null,
      var_codigo_impuesto_sri: tarifaIva > 0 ? "IVA_15" : "IVA_0",
      var_tarifa_iva_porcentaje: tarifaIva,
      var_tipo_oferta: "REGULAR",
      var_frecuencia_recurrencia: datos.tipo === "SUSCRIPCION" ? "MENSUAL" : null,
      var_activo: true,
      var_detalle_variante: {
        tipo_honorario: datos.tipo,
        modalidad_pago: datos.modalidadPago || "Payphone / Tarjetas / Transferencia",
      },
      monto_iva: montoIva,
      precio_total: total,
    };

    const nuevoProducto: ProductoCatalogo = {
      pro_id: prodId,
      pro_negocio: negocio,
      pro_nombre: nombre,
      pro_slug: slug,
      pro_descripcion: datos.descripcion.trim(),
      pro_tipo: datos.tipo,
      pro_destacado: Boolean(datos.destacado),
      pro_categoria_principal_id: cat?.ctg_id || null,
      pro_detalle_producto: {
        icono: datos.icono || "Scale",
        imagen_url: datos.imagenUrl?.trim() || null,
        video_url: datos.videoUrl?.trim() || null,
        beneficios: datos.beneficios || [],
        tiempo_entrega: datos.tiempoEntrega?.trim() || null,
        requisitos: datos.requisitos || [],
        modalidad_pago: datos.modalidadPago || "Botón Payphone / Tarjeta / Saldo",
        creado_desde_panel: true,
      },
      categoria: cat
        ? {
            ctg_id: cat.ctg_id,
            ctg_nombre: cat.ctg_nombre,
            ctg_slug: cat.ctg_slug,
          }
        : null,
      variantes: [nuevaVariante],
    };

    // 1. Intentar persistir en Supabase
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_producto")
          .upsert(
            {
              pro_negocio: negocio,
              pro_nombre: nombre,
              pro_slug: slug,
              pro_descripcion: datos.descripcion.trim(),
              pro_tipo: datos.tipo,
              pro_destacado: Boolean(datos.destacado),
              pro_categoria_principal_id: cat?.ctg_id || null,
              pro_activo: true,
              pro_detalle_producto: nuevoProducto.pro_detalle_producto,
            },
            { onConflict: "pro_negocio, pro_slug" }
          );

        await clienteActivo
          .schema("comun_comercio")
          .from("com_variante")
          .upsert(
            {
              var_negocio: negocio,
              var_sku: sku,
              var_nombre: nuevaVariante.var_nombre,
              var_precio: base,
              var_codigo_impuesto_sri: nuevaVariante.var_codigo_impuesto_sri,
              var_tarifa_iva_porcentaje: tarifaIva,
              var_tipo_oferta: "REGULAR",
              var_activo: true,
              var_detalle_variante: nuevaVariante.var_detalle_variante,
            },
            { onConflict: "var_negocio, var_sku" }
          );
      } catch {
        // Fallback en public
        try {
          await clienteActivo.from("com_producto").upsert(
            {
              pro_negocio: negocio,
              pro_nombre: nombre,
              pro_slug: slug,
              pro_descripcion: datos.descripcion.trim(),
              pro_tipo: datos.tipo,
              pro_destacado: Boolean(datos.destacado),
              pro_categoria_principal_id: cat?.ctg_id || null,
              pro_activo: true,
              pro_detalle_producto: nuevoProducto.pro_detalle_producto,
            },
            { onConflict: "pro_negocio, pro_slug" }
          );
        } catch {
          // Guardar en memoria
        }
      }
    }

    // 2. Guardar en almacén local de memoria
    const actuales = storeCustomProductos.get(negocio) || [];
    actuales.unshift(nuevoProducto);
    storeCustomProductos.set(negocio, actuales);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true, producto: nuevoProducto };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al registrar el producto." };
  }
}

/**
 * Edita un producto u honorario profesional existente
 */
export async function editarProductoAction(datos: {
  pro_id: string;
  nombre: string;
  descripcion: string;
  categoriaId?: string;
  tipo: "FISICO" | "SERVICIO" | "SUSCRIPCION" | "DIGITAL";
  destacado?: boolean;
  precioBase: number;
  tarifaIva?: number; // 15 o 0
  sku?: string;
  icono?: "Scale" | "ShieldCheck" | "FileCheck" | "CreditCard";
  imagenUrl?: string;
  videoUrl?: string;
  beneficios?: string[];
  tiempoEntrega?: string;
  requisitos?: string[];
  modalidadPago?: string;
  varianteId?: string;
  negocio?: string;
}): Promise<{ ok: boolean; producto?: ProductoCatalogo; error?: string }> {
  try {
    const negocio = datos.negocio || "tranqi";
    const nombre = datos.nombre.trim();
    if (!nombre) {
      return { ok: false, error: "El nombre del producto u honorario es obligatorio." };
    }
    if (datos.precioBase <= 0) {
      return { ok: false, error: "El precio base debe ser mayor a cero." };
    }

    const base = Number(datos.precioBase.toFixed(2));
    const tarifaIva = datos.tarifaIva ?? 15;
    const montoIva = Number(((base * tarifaIva) / 100).toFixed(2));
    const total = Number((base + montoIva).toFixed(2));

    const cats = await obtenerCategoriasAction(negocio);
    const cat = cats.find((c) => c.ctg_id === datos.categoriaId) || null;

    // Buscar producto actual
    const prods = await obtenerCatalogoProductosAction(negocio);
    const prodActual = prods.find((p) => p.pro_id === datos.pro_id);
    if (!prodActual) {
      return { ok: false, error: "Producto no encontrado para editar." };
    }

    // Actualizar variantes (modificar la variante seleccionada o la primera)
    const variantesActualizadas: VarianteCatalogo[] = prodActual.variantes.map((v, idx) => {
      const esTarget = datos.varianteId ? v.var_id === datos.varianteId : idx === 0;
      if (!esTarget) return v;

      return {
        ...v,
        var_nombre: `${nombre} (Tarifa Estándar)`,
        var_sku: datos.sku?.trim() || v.var_sku,
        var_precio: base,
        var_tarifa_iva_porcentaje: tarifaIva,
        var_codigo_impuesto_sri: tarifaIva > 0 ? "IVA_15" : "IVA_0",
        var_detalle_variante: {
          ...v.var_detalle_variante,
          modalidad_pago: datos.modalidadPago || v.var_detalle_variante?.modalidad_pago,
        },
        monto_iva: montoIva,
        precio_total: total,
      };
    });

    if (variantesActualizadas.length === 0) {
      variantesActualizadas.push({
        var_id: `var-${Date.now()}`,
        var_producto_id: datos.pro_id,
        var_sku: datos.sku?.trim() || `TRQ-VAR-${Date.now()}`,
        var_nombre: `${nombre} (Tarifa Estándar)`,
        var_precio: base,
        var_codigo_impuesto_sri: tarifaIva > 0 ? "IVA_15" : "IVA_0",
        var_tarifa_iva_porcentaje: tarifaIva,
        var_tipo_oferta: "REGULAR",
        var_activo: true,
        var_detalle_variante: { modalidad_pago: datos.modalidadPago },
        monto_iva: montoIva,
        precio_total: total,
      });
    }

    const prodEditado: ProductoCatalogo = {
      ...prodActual,
      pro_nombre: nombre,
      pro_descripcion: datos.descripcion.trim(),
      pro_tipo: datos.tipo,
      pro_destacado: Boolean(datos.destacado),
      pro_categoria_principal_id: cat?.ctg_id || prodActual.pro_categoria_principal_id,
      pro_detalle_producto: {
        ...prodActual.pro_detalle_producto,
        icono: datos.icono || prodActual.pro_detalle_producto?.icono || "Scale",
        imagen_url: datos.imagenUrl !== undefined ? datos.imagenUrl.trim() : prodActual.pro_detalle_producto?.imagen_url,
        video_url: datos.videoUrl !== undefined ? datos.videoUrl.trim() : prodActual.pro_detalle_producto?.video_url,
        beneficios: datos.beneficios !== undefined ? datos.beneficios : prodActual.pro_detalle_producto?.beneficios,
        tiempo_entrega: datos.tiempoEntrega !== undefined ? datos.tiempoEntrega.trim() : prodActual.pro_detalle_producto?.tiempo_entrega,
        requisitos: datos.requisitos !== undefined ? datos.requisitos : prodActual.pro_detalle_producto?.requisitos,
        modalidad_pago: datos.modalidadPago || prodActual.pro_detalle_producto?.modalidad_pago,
        editado_en: new Date().toISOString(),
      },
      categoria: cat
        ? {
            ctg_id: cat.ctg_id,
            ctg_nombre: cat.ctg_nombre,
            ctg_slug: cat.ctg_slug,
          }
        : prodActual.categoria,
      variantes: variantesActualizadas,
    };

    // 1. Intentar actualizar en Supabase
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_producto")
          .update({
            pro_nombre: nombre,
            pro_descripcion: datos.descripcion.trim(),
            pro_tipo: datos.tipo,
            pro_destacado: Boolean(datos.destacado),
            pro_categoria_principal_id: cat?.ctg_id || null,
            pro_detalle_producto: prodEditado.pro_detalle_producto,
          })
          .eq("pro_id", datos.pro_id);

        const varTarget = variantesActualizadas[0];
        if (varTarget) {
          await clienteActivo
            .schema("comun_comercio")
            .from("com_variante")
            .update({
              var_nombre: varTarget.var_nombre,
              var_precio: base,
              var_tarifa_iva_porcentaje: tarifaIva,
              var_codigo_impuesto_sri: varTarget.var_codigo_impuesto_sri,
              var_sku: varTarget.var_sku,
            })
            .eq("var_id", varTarget.var_id);
        }
      } catch {
        try {
          await clienteActivo
            .from("com_producto")
            .update({
              pro_nombre: nombre,
              pro_descripcion: datos.descripcion.trim(),
              pro_tipo: datos.tipo,
              pro_destacado: Boolean(datos.destacado),
              pro_categoria_principal_id: cat?.ctg_id || null,
              pro_detalle_producto: prodEditado.pro_detalle_producto,
            })
            .eq("pro_id", datos.pro_id);
        } catch {
          // Continuar
        }
      }
    }

    // 2. Guardar en almacén local
    const actuales = storeCustomProductos.get(negocio) || [];
    const idx = actuales.findIndex((p) => p.pro_id === datos.pro_id);
    if (idx >= 0) {
      actuales[idx] = prodEditado;
    } else {
      actuales.push(prodEditado);
    }
    storeCustomProductos.set(negocio, actuales);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true, producto: prodEditado };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al actualizar el producto." };
  }
}

/**
 * Elimina o desactiva un producto del catálogo
 */
export async function eliminarProductoAction(
  pro_id: string,
  negocio = "tranqi"
): Promise<{ ok: boolean; error?: string }> {
  try {
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    if (clienteActivo) {
      try {
        await clienteActivo
          .schema("comun_comercio")
          .from("com_producto")
          .update({ pro_activo: false })
          .eq("pro_id", pro_id);
      } catch {
        try {
          await clienteActivo
            .from("com_producto")
            .update({ pro_activo: false })
            .eq("pro_id", pro_id);
        } catch {
          // Continuar
        }
      }
    }

    // Almacén en memoria: marcar como inactivo (tombstone)
    const actuales = storeCustomProductos.get(negocio) || [];
    const filtrados = actuales.filter((p) => p.pro_id !== pro_id);
    const tombstone: any = { pro_id, pro_activo: false };
    filtrados.push(tombstone);
    storeCustomProductos.set(negocio, filtrados);

    revalidatePath("/panel/catalogo-productos");
    return { ok: true };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al eliminar el producto." };
  }
}

/**
 * Restaura o siembra el catálogo de ejemplo oficial en la base de datos Supabase
 */
export async function restaurarCatalogoEjemploAction(
  negocio = "tranqi"
): Promise<{ ok: boolean; mensaje?: string; error?: string; cantidad?: number }> {
  try {
    const admin: any = crearClienteAdmin();
    const supabase: any = await crearClienteServidor();
    const clienteActivo = admin || supabase;

    const categorias = negocio === "tinkay" ? CATEGORIAS_SEMILLA_TINKAY : (negocio === "tranqi" ? CATEGORIAS_SEMILLA_TRANQI : []);
    const productos = negocio === "tinkay" ? PRODUCTOS_SEMILLA_TINKAY : (negocio === "tranqi" ? PRODUCTOS_SEMILLA_TRANQI : []);

    if (clienteActivo) {
      // 1. Insertar o actualizar categorías
      for (const cat of categorias) {
        try {
          await clienteActivo
            .schema("comun_comercio")
            .from("com_categoria")
            .upsert({
              ctg_id: cat.ctg_id,
              ctg_negocio: negocio,
              ctg_nombre: cat.ctg_nombre,
              ctg_slug: cat.ctg_slug,
              ctg_descripcion: cat.ctg_descripcion,
              ctg_tipo: cat.ctg_tipo,
              ctg_orden: cat.ctg_orden,
              ctg_activo: true,
            }, { onConflict: "ctg_id" });
        } catch {
          // Continuar
        }
      }

      // 2. Insertar o actualizar productos y sus variantes
      for (const prod of productos) {
        try {
          await clienteActivo
            .schema("comun_comercio")
            .from("com_producto")
            .upsert({
              pro_id: prod.pro_id,
              pro_negocio: negocio,
              pro_nombre: prod.pro_nombre,
              pro_slug: prod.pro_slug,
              pro_descripcion: prod.pro_descripcion,
              pro_tipo: prod.pro_tipo,
              pro_destacado: prod.pro_destacado,
              pro_categoria_principal_id: prod.pro_categoria_principal_id,
              pro_detalle_producto: prod.pro_detalle_producto,
              pro_activo: true,
            }, { onConflict: "pro_id" });

          for (const v of prod.variantes) {
            await clienteActivo
              .schema("comun_comercio")
              .from("com_variante")
              .upsert({
                var_id: v.var_id,
                var_negocio: negocio,
                var_producto_id: prod.pro_id,
                var_sku: v.var_sku,
                var_nombre: v.var_nombre,
                var_precio: v.var_precio,
                var_precio_comparacion: v.var_precio_comparacion || null,
                var_codigo_impuesto_sri: v.var_codigo_impuesto_sri,
                var_tarifa_iva_porcentaje: v.var_tarifa_iva_porcentaje,
                var_tipo_oferta: v.var_tipo_oferta,
                var_frecuencia_recurrencia: v.var_frecuencia_recurrencia || null,
                var_activo: true,
                var_detalle_variante: v.var_detalle_variante || {},
              }, { onConflict: "var_id" });
          }
        } catch {
          // Continuar
        }
      }
    }

    // Limpiar overrides en memoria
    storeCustomCategorias.delete(negocio);
    storeCustomProductos.delete(negocio);

    revalidatePath("/panel/catalogo-productos");
    revalidatePath("/panel/herramientas");

    return {
      ok: true,
      mensaje: `Catálogo de ${negocio.toUpperCase()} restaurado con éxito (${productos.length} productos y ${categorias.length} categorías).`,
      cantidad: productos.length,
    };
  } catch (err: any) {
    return { ok: false, error: err.message || "Error al restaurar catálogo inicial." };
  }
}

// ==============================================================================
// 4. CONFIGURACIÓN DE PASARELA PAYPHONE
// ==============================================================================

/**
 * Obtiene la configuración de Payphone para el tenant actual
 */
export async function obtenerConfiguracionPasarelaAction(
  negocio = "tranqi",
  pasarela = "PAYPHONE"
): Promise<ConfiguracionPasarela> {
  const supabase: any = await crearClienteServidor();

  let data: any = null;
  try {
    const { data: dCom } = await supabase
      .schema("comun_comercio")
      .from("com_pasarela_configuracion")
      .select("*")
      .eq("psc_negocio", negocio)
      .eq("psc_pasarela", pasarela)
      .maybeSingle();
    data = dCom;

    if (!data) {
      const { data: dPub } = await supabase
        .from("com_pasarela_configuracion")
        .select("*")
        .eq("psc_negocio", negocio)
        .eq("psc_pasarela", pasarela)
        .maybeSingle();
      data = dPub;
    }
  } catch {
    // Modo simulado por defecto
  }

  if (!data) {
    return {
      psc_negocio: negocio,
      psc_pasarela: pasarela,
      psc_nombre_visible: "Payphone (Tarjetas y Saldo)",
      psc_ambiente: "PRUEBAS",
      psc_activo: true,
      storeId: "STORE-DEMO-TRANQI-001",
      modoSimulado: true,
      comisionPorcentaje: 6.0,
    };
  }

  const pub = data.psc_credenciales_publicas || {};
  const priv = data.psc_credenciales_privadas || {};

  return {
    psc_id: data.psc_id,
    psc_negocio: data.psc_negocio,
    psc_pasarela: data.psc_pasarela,
    psc_nombre_visible: data.psc_nombre_visible,
    psc_ambiente: data.psc_ambiente || "PRUEBAS",
    psc_activo: data.psc_activo ?? true,
    storeId: pub.storeId || "STORE-DEMO-TRANQI-001",
    modoSimulado: pub.modoSimulado ?? priv.modoSimulado ?? true,
    token: priv.token || "",
    comisionPorcentaje: Number(data.psc_comision_porcentaje) || 6.0,
    detalle: data.psc_detalle_pasarela || {},
  };
}

/**
 * Guarda o actualiza la configuración de la pasarela Payphone
 */
export async function guardarConfiguracionPasarelaAction(datos: {
  negocio?: string;
  storeId: string;
  token?: string;
  ambiente: "PRUEBAS" | "PRODUCCION";
  modoSimulado: boolean;
  activo: boolean;
}): Promise<{ ok: boolean; error?: string }> {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteActivo = admin || supabase;

  const pub = {
    storeId: datos.storeId.trim(),
    modoSimulado: datos.modoSimulado,
    moneda: "USD",
    pais: "EC",
  };

  const privPayload: Record<string, any> = {
    modoSimulado: datos.modoSimulado,
  };
  if (datos.token && datos.token.trim().length > 0) {
    privPayload.token = datos.token.trim();
  }

  if (clienteActivo) {
    try {
      await clienteActivo
        .schema("comun_comercio")
        .from("com_pasarela_configuracion")
        .upsert(
          {
            psc_negocio: negocio,
            psc_pasarela: "PAYPHONE",
            psc_nombre_visible: "Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)",
            psc_ambiente: datos.ambiente,
            psc_activo: datos.activo,
            psc_credenciales_publicas: pub,
            psc_credenciales_privadas: privPayload,
            psc_actualizado_en: new Date().toISOString(),
          },
          { onConflict: "psc_negocio, psc_pasarela" }
        );
    } catch {
      try {
        await clienteActivo.from("com_pasarela_configuracion").upsert(
          {
            psc_negocio: negocio,
            psc_pasarela: "PAYPHONE",
            psc_nombre_visible: "Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)",
            psc_ambiente: datos.ambiente,
            psc_activo: datos.activo,
            psc_credenciales_publicas: pub,
            psc_credenciales_privadas: privPayload,
            psc_actualizado_en: new Date().toISOString(),
          },
          { onConflict: "psc_negocio, psc_pasarela" }
        );
      } catch (err: any) {
        console.error("Error al guardar pasarela:", err);
      }
    }
  }

  revalidatePath("/panel");
  return { ok: true };
}

// ==============================================================================
// 5. PROCESAMIENTO DE PAGO: PREPARE Y CONFIRM (CON MODO SIMULADO)
// ==============================================================================

/**
 * Fase 1: Prepara la transacción de pago con Payphone (API /api/button/Prepare) o inicia simulación
 */
export async function prepararPagoPayphoneAction(datos: {
  negocio?: string;
  varianteId: string;
  nombreServicio: string;
  montoBase: number;
  montoIva: number;
  montoTotal: number;
  pagador: {
    nombres: string;
    apellidos: string;
    identificacion: string;
    email: string;
    telefono: string;
  };
  esSimulado?: boolean;
}) {
  const negocio = datos.negocio || "tranqi";
  const supabase: any = await crearClienteServidor();
  const admin: any = crearClienteAdmin();
  const clienteDb = admin || supabase;

  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const usarSimulacion = datos.esSimulado ?? cfg.modoSimulado;

  // Generar Client Transaction ID único
  const randomSuffix = Math.random().toString(36).substring(2, 7).toUpperCase();
  const clientTransactionId = `TRQ-TX-${Date.now()}-${randomSuffix}`;

  // Obtener usuario autenticado si existe
  let clienteId = null;
  try {
    const { data: authUser } = await supabase.auth.getUser();
    clienteId = authUser?.user?.id || null;
  } catch {
    // Sin sesión
  }

  // Montos en centavos para cumplir normativa Payphone (entero x 100)
  const amountTotalCentavos = Math.round(datos.montoTotal * 100);
  const amountWithTaxCentavos = Math.round(datos.montoBase * 100);
  const taxCentavos = Math.round(datos.montoIva * 100);

  // 1. Si está en MODO SIMULADO:
  if (usarSimulacion) {
    const paymentIdSimulado = `SIM-PAY-${Date.now()}-${randomSuffix}`;

    // Registrar en com_transaccion_pago como PENDIENTE
    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .insert({
            pag_negocio: negocio,
            pag_cliente_id: clienteId,
            pag_pasarela: "PAYPHONE",
            pag_identificador_cliente: clientTransactionId,
            pag_transaccion_pasarela_id: paymentIdSimulado,
            pag_estado: "PENDIENTE",
            pag_monto_total: datos.montoTotal,
            pag_monto_sin_iva: 0,
            pag_monto_con_iva: datos.montoBase,
            pag_monto_iva: datos.montoIva,
            pag_moneda: "USD",
            pag_titular_email: datos.pagador.email,
            pag_titular_identificacion: datos.pagador.identificacion,
            pag_titular_telefono: datos.pagador.telefono,
            pag_detalle_transaccion: {
              modo_simulado: true,
              nombre_servicio: datos.nombreServicio,
              variante_id: datos.varianteId,
              fecha_preparacion: new Date().toISOString(),
              pagador: datos.pagador,
            },
          });
      } catch {
        // Fallback silencioso si la tabla no está creada
      }
    }

    return {
      ok: true,
      esSimulado: true,
      paymentId: paymentIdSimulado,
      clientTransactionId,
      payWithPayPhone: null,
      payWithCard: null,
      mensaje: "Transacción preparada con éxito en Modo Simulado (Sandbox).",
    };
  }

  // 2. Si está en MODO REAL (llamada oficial a Payphone Prepare API)
  const token = cfg.token;
  if (!token) {
    return {
      ok: false,
      error: "No se encuentra configurado el Token Bearer de Payphone para transacciones en vivo.",
    };
  }

  try {
    const origin = process.env.NEXT_PUBLIC_APP_URL || "https://tranqi24.com";
    const bodyPayphone = {
      amount: amountTotalCentavos,
      amountWithoutTax: 0,
      amountWithTax: amountWithTaxCentavos,
      tax: taxCentavos,
      service: 0,
      tip: 0,
      clientTransactionId: clientTransactionId,
      reference: `Honorarios: ${datos.nombreServicio}`,
      storeId: cfg.storeId,
      currency: "USD",
      responseUrl: `${origin}/panel/pagos/confirmacion`,
      cancellationUrl: `${origin}/panel/pagos/cancelacion`,
      timeZone: -5,
      order: {
        billTo: {
          firstName: datos.pagador.nombres,
          lastName: datos.pagador.apellidos,
          email: datos.pagador.email,
          phoneNumber: datos.pagador.telefono.startsWith("+") ? datos.pagador.telefono : `+593${datos.pagador.telefono}`,
          customerId: datos.pagador.identificacion,
          country: "EC",
        },
        lineItems: [
          {
            name: datos.nombreServicio,
            quantity: 1,
            unitPrice: amountTotalCentavos,
          },
        ],
      },
    };

    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/Prepare", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify(bodyPayphone),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Payphone Prepare API error (${res.status}): ${errText}`,
      };
    }

    const payphoneData = await res.json();
    // payphoneData contiene: { paymentId, payWithPayPhone, payWithCard }

    // Registrar en com_transaccion_pago como PENDIENTE
    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .insert({
            pag_negocio: negocio,
            pag_cliente_id: clienteId,
            pag_pasarela: "PAYPHONE",
            pag_identificador_cliente: clientTransactionId,
            pag_transaccion_pasarela_id: String(payphoneData.paymentId),
            pag_estado: "PENDIENTE",
            pag_monto_total: datos.montoTotal,
            pag_monto_sin_iva: 0,
            pag_monto_con_iva: datos.montoBase,
            pag_monto_iva: datos.montoIva,
            pag_moneda: "USD",
            pag_titular_email: datos.pagador.email,
            pag_titular_identificacion: datos.pagador.identificacion,
            pag_titular_telefono: datos.pagador.telefono,
            pag_detalle_transaccion: {
              modo_simulado: false,
              nombre_servicio: datos.nombreServicio,
              variante_id: datos.varianteId,
              payphone_prepare: payphoneData,
            },
          });
      } catch {
        // Fallback silencioso
      }
    }

    return {
      ok: true,
      esSimulado: false,
      paymentId: payphoneData.paymentId,
      clientTransactionId,
      payWithPayPhone: payphoneData.payWithPayPhone,
      payWithCard: payphoneData.payWithCard,
    };
  } catch (error: any) {
    return {
      ok: false,
      error: `Error de conexión con Payphone: ${error?.message || "Error de red"}`,
    };
  }
}

/**
 * Fase 2: Confirma la transacción con Payphone (API /api/button/V2/Confirm) o valida respuesta simulada
 */
export async function confirmarPagoPayphoneAction(datos: {
  id: string | number; // paymentId
  clientTxId: string;
  negocio?: string;
  esSimulado?: boolean;
  resultadoSimulacion?: "APROBADO" | "RECHAZADO";
  marcaTarjetaSimulada?: string;
}) {
  const negocio = datos.negocio || "tranqi";
  const admin: any = crearClienteAdmin();
  const supabase: any = await crearClienteServidor();
  const clienteDb = admin || supabase;

  const cfg = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
  const usarSimulacion = datos.esSimulado ?? cfg.modoSimulado;

  // 1. Si es MODO SIMULADO:
  if (usarSimulacion) {
    const aprobado = datos.resultadoSimulacion !== "RECHAZADO";
    const authCode = aprobado ? `AUTH-SIM-${Math.floor(100000 + Math.random() * 900000)}` : null;
    const estadoFinal = aprobado ? "APROBADO" : "RECHAZADO";

    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .update({
            pag_estado: estadoFinal,
            pag_autorizacion_codigo: authCode,
            pag_tarjeta_tipo: "Crédito (Simulado)",
            pag_tarjeta_marca: "Visa / Diners Club",
            pag_tarjeta_ultimos_digitos: "4321",
            pag_confirmado_en: new Date().toISOString(),
            pag_detalle_transaccion: {
              simulacion: true,
              fecha_confirmacion: new Date().toISOString(),
              resultado: estadoFinal,
            },
          })
          .eq("pag_identificador_cliente", datos.clientTxId);
      } catch {
        // Continuar
      }
    }

    return {
      ok: aprobado,
      estado: estadoFinal,
      codigoAutorizacion: authCode,
      mensaje: aprobado
        ? "¡Pago Aprobado con Éxito (Simulación Payphone)!"
        : "Transacción rechazada por el emisor simulado.",
      tarjeta: "Visa •••• 4321",
      fecha: new Date().toISOString(),
    };
  }

  // 2. Si es MODO REAL (Llamada a /api/button/V2/Confirm)
  const token = cfg.token;
  if (!token) {
    return {
      ok: false,
      error: "No se encuentra configurado el Token Bearer de Payphone.",
    };
  }

  try {
    const res = await fetch("https://pay.payphonetodoesposible.com/api/button/V2/Confirm", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        id: Number(datos.id),
        clientTxId: datos.clientTxId,
      }),
    });

    if (!res.ok) {
      const errText = await res.text();
      return {
        ok: false,
        error: `Payphone Confirm API error (${res.status}): ${errText}`,
      };
    }

    const confirmData = await res.json();
    const aprobado = confirmData.transactionStatus === "Approved";
    const estadoFinal = aprobado ? "APROBADO" : "RECHAZADO";

    if (clienteDb) {
      try {
        await clienteDb
          .schema("comun_comercio")
          .from("com_transaccion_pago")
          .update({
            pag_estado: estadoFinal,
            pag_autorizacion_codigo: confirmData.authorizationCode || null,
            pag_tarjeta_tipo: confirmData.cardType || null,
            pag_tarjeta_marca: confirmData.cardBrand || null,
            pag_tarjeta_ultimos_digitos: confirmData.lastDigits || null,
            pag_confirmado_en: new Date().toISOString(),
            pag_detalle_transaccion: {
              payphone_confirm: confirmData,
            },
          })
          .eq("pag_identificador_cliente", datos.clientTxId);
      } catch {
        // Continuar
      }
    }

    return {
      ok: aprobado,
      estado: estadoFinal,
      codigoAutorizacion: confirmData.authorizationCode,
      mensaje: aprobado ? "¡Pago Confirmado y Aprobado por Payphone!" : confirmData.message || "Pago no aprobado",
      tarjeta: `${confirmData.cardBrand || "Tarjeta"} •••• ${confirmData.lastDigits || ""}`,
      fecha: new Date().toISOString(),
    };
  } catch (error: any) {
    return {
      ok: false,
      error: `Error al confirmar transacción: ${error?.message || "Error desconocido"}`,
    };
  }
}

/**
 * Obtiene el historial de transacciones de pago
 */
export async function obtenerHistorialTransaccionesAction(negocio = "tranqi"): Promise<TransaccionPagoCRM[]> {
  const supabase: any = await crearClienteServidor();

  try {
    const { data: dCom } = await supabase
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .select("*")
      .eq("pag_negocio", negocio)
      .order("pag_creado_en", { ascending: false })
      .limit(50);

    if (dCom && dCom.length > 0) return dCom;

    const { data: dPub } = await supabase
      .from("com_transaccion_pago")
      .select("*")
      .eq("pag_negocio", negocio)
      .order("pag_creado_en", { ascending: false })
      .limit(50);

    return dPub || [];
  } catch {
    return [];
  }
}
