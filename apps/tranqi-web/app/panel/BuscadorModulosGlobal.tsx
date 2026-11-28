"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search, X, Users, UserCog, UserCheck, Settings, Mail, Bell, Shield, ShieldCheck,
  CircleUser, ChevronRight, Sliders, Briefcase, FileText, BarChart2, FileCheck, Folder,
  CalendarClock, CalendarPlus, CalendarCheck, Shuffle, ShoppingBag, CreditCard, Building2, Scale, KeyRound, Sparkles, Bot, MapPin, ClipboardList, MessageSquare, MessageSquareHeart, Megaphone
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useCustomWidgets } from "./gestorTitulosWidgets";

export interface ModuloInfoDef {
  clave: string;
  nombre: string;
  detalle: string;
  ruta: string;
  categoria: string;
  minNivel: number;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  icono: any;
  colorIcono?: string;
}

const CATALOGO_MODULOS: ModuloInfoDef[] = [
  {
    clave: "productos_servicios",
    nombre: "Productos Servicios",
    detalle: "Todos nuestros planes de protección, consultas jurídicas y trámites legales presentados de forma individual",
    ruta: "/panel/productos-servicios",
    categoria: "Comercio & Clientes",
    minNivel: 1,
    icono: ShoppingBag,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "agendar_cita",
    nombre: "Resolver una necesidad",
    detalle: "Un trámite que hacemos por ti o una cita con un abogado",
    ruta: "/panel/agendar",
    categoria: "Agenda",
    minNivel: 1,
    icono: CalendarPlus,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "mis_citas",
    nombre: "Mis necesidades",
    detalle: "Trámites pedidos y citas: estado, videollamada y cancelación",
    ruta: "/panel/mis-citas",
    categoria: "Agenda",
    minNivel: 1,
    icono: CalendarCheck,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "citas_programadas",
    nombre: "Citas programadas",
    detalle: "Confirma, reagenda y cierra tus consultas",
    ruta: "/panel/agenda",
    categoria: "Agenda",
    minNivel: 1,
    icono: CalendarClock,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "disponibilidad",
    nombre: "Mi disponibilidad",
    detalle: "Horarios de atención, duración y bloqueos",
    ruta: "/panel/agenda/disponibilidad",
    categoria: "Agenda",
    minNivel: 1,
    icono: CalendarClock,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "asignaciones_agenda",
    nombre: "Agenda, Citas Abogados",
    detalle: "Calendario de citas confirmadas (telemáticas vs presenciales), asignación de abogados e historial",
    ruta: "/panel/agendamiento?widget=asignaciones_agenda",
    categoria: "Agenda",
    minNivel: 30,
    icono: Shuffle,
    colorIcono: "var(--ct-fe5800, #FE5800)"
  },
  {
    clave: "historial_pagos",
    nombre: "Historial de Pagos",
    detalle: "Consulta de pagos realizados, rubro facturado y descarga de comprobante electrónico SRI",
    ruta: "/panel/herramientas?widget=historial_pagos",
    categoria: "Comercio & Facturación",
    minNivel: 1,
    icono: CreditCard,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "vitrina_comercial_personas",
    nombre: "Oferta para Personas & Familias",
    detalle: "Trámites notariales, videoconsultas individuales, defensa legal y planes familiares",
    ruta: "/panel/clientes?widget=vitrina_comercial_personas",
    categoria: "Comercio & Clientes",
    minNivel: 1,
    icono: ShoppingBag,
    colorIcono: "var(--acento)"
  },
  {
    clave: "vitrina_comercial_empresas",
    nombre: "Oferta Corporativa & Planes Empresas",
    detalle: "Planes legales corporativos, constitución SAS, convenios de beneficios y asesoría empresarial",
    ruta: "/panel/empresas?widget=vitrina_comercial_empresas",
    categoria: "Comercio & Empresas",
    minNivel: 1,
    icono: Building2,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "horarios_atencion_agenda",
    nombre: "Horarios de Atención (Telemático y Presencial)",
    detalle: "Configura horarios por defecto para consultas telemáticas y presenciales, especialidad por defecto de Tranqi y agendamiento sin abogado disponible",
    ruta: "/panel/agendamiento?widget=horarios_atencion_agenda",
    categoria: "Agendamiento & Operación",
    minNivel: 30,
    icono: Sliders,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "catalogo_productos",
    nombre: "Catálogo y honorarios",
    detalle: "Servicios, honorarios y suscripciones con IVA",
    ruta: "/panel/catalogo-productos",
    categoria: "Comercio",
    minNivel: 1,
    icono: ShoppingBag,
    colorIcono: "var(--acento)"
  },
  {
    clave: "pasarela_payphone",
    nombre: "Pagos con Payphone",
    detalle: "Configuración del botón de pago y cobros",
    ruta: "/panel/configuracion?widget=pasarela_payphone",
    categoria: "Comercio",
    minNivel: 50,
    icono: CreditCard,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "configuracion_facturacion_sri",
    nombre: "Parámetros de Facturación Electrónica SRI (.p12)",
    detalle: "Configuración de RUC, razón social, régimen RIMPE/General, serie 001-001, secuenciales y certificado .p12 en Supabase Vault",
    ruta: "/panel/configuracion?widget=configuracion_facturacion_sri",
    categoria: "Comercio & Pagos",
    minNivel: 80,
    icono: FileCheck,
    colorIcono: "var(--exito)"
  },
  {
    clave: "configuracion_aria",
    nombre: "Agente Conversacional ARIA",
    detalle: "Parámetros ARIA_BASE, ARIA_AGENT_ID y claves en Supabase Vault propios de este negocio",
    ruta: "/panel/aria",
    categoria: "Seguridad & Integraciones",
    minNivel: 80,
    icono: Bot,
    colorIcono: "var(--exito)"
  },
  {
    clave: "configuracion_marketing_meta",
    nombre: "Marketing & Meta (Pixel / Catálogo)",
    detalle: "Meta Pixel, Conversions API (CAPI) en Vault, feed de catálogo Facebook/WhatsApp y atribución ARIA",
    ruta: "/panel/marketing-meta",
    categoria: "Seguridad & Integraciones",
    minNivel: 80,
    icono: Megaphone,
    colorIcono: "var(--acento)"
  },
  {
    clave: "configuracion_logistica",
    nombre: "Envíos, Zonas y Cobertura GPS",
    detalle: "Configuración de sector con Envío Gratis, polígonos de cobertura en Pichincha y cálculo por km vial",
    ruta: "/panel/logistica",
    categoria: "Comercio & Pagos",
    minNivel: 80,
    icono: MapPin,
    colorIcono: "var(--exito)"
  },
  {
    clave: "consola_chat",
    nombre: "Ventas Omnicanal & Conversaciones en Vivo",
    detalle: "Reemplazo ManyChat: monitoreo de chats web, respuestas de vendedores vs ARIA, etiquetas, mensajes predeterminados y compras web",
    ruta: "/panel/conversaciones",
    categoria: "Comercio & Pagos",
    minNivel: 20,
    icono: MessageSquare,
    colorIcono: "var(--ct-db2777, #DB2777)"
  },
  {
    clave: "directorio_contactos",
    nombre: "Contactos y Listas WhatsApp (Join/Merge)",
    detalle: "Extraer contactos .vcf/.csv/Excel/celular, consolidar duplicados, lista personal a ignorar y gestionar múltiples teléfonos WhatsApp",
    ruta: "/panel/contactos",
    categoria: "Comercio & Pagos",
    minNivel: 20,
    icono: Users,
    colorIcono: "var(--ct-7c3aed, #7C3AED)"
  },
  {
    clave: "galeria_inmediata",
    nombre: "Galería de Entrega Inmediata (1 a 2 Horas)",
    detalle: "Publicar arreglos listos en tienda con precio especial y baja automática al venderse",
    ruta: "/panel/entrega-inmediata",
    categoria: "Comercio & Pagos",
    minNivel: 20,
    icono: MessageSquare,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "inventario_rosas",
    nombre: "Inventario de Rosas con IA (ARIA)",
    detalle: "Subir fotos de bonches de rosas para conteo automático por colores y consolidado",
    ruta: "/panel/inventario-rosas",
    categoria: "Comercio & Pagos",
    minNivel: 20,
    icono: MessageSquare,
    colorIcono: "var(--ct-be185d, #BE185D)"
  },
  {
    clave: "envio_pedidos_taller",
    nombre: "Enviar Pedidos a Taller y Programación",
    detalle: "Validar ventas, calendario Hoy/Semana/Mes, llamadas Exequiales y despacho diario a Taller",
    ruta: "/panel/envio-pedidos",
    categoria: "Comercio & Pagos",
    minNivel: 20,
    icono: ClipboardList,
    colorIcono: "var(--texto)"
  },
  {
    clave: "chat_equipo",
    nombre: "Chat Grupal del Equipo",
    detalle: "Conversación interna de trabajo con @menciones, fotografías y reenvío de consultas entre áreas",
    ruta: "/panel/chat-equipo",
    categoria: "Comercio & Pagos",
    minNivel: 12,
    icono: Users,
    colorIcono: "var(--ct-6d28d9, #6D28D9)"
  },
  {
    clave: "taller_floral",
    nombre: "Taller — Producción y Elaboración",
    detalle: "Notificaciones en vivo de nuevos pedidos, calendario de elaboración y estado En Preparación / Listo Entrega",
    ruta: "/panel/taller",
    categoria: "Comercio & Pagos",
    minNivel: 15,
    icono: ClipboardList,
    colorIcono: "var(--exito)"
  },
  {
    clave: "confirmacion_entregas",
    nombre: "Confirmación de Entregas GPS e Informes Exequiales IESS",
    detalle: "PWA Offline para foto georreferenciada, órdenes de trabajo e informe quincenal PDF",
    ruta: "/panel/entregas",
    categoria: "Comercio & Pagos",
    minNivel: 15,
    icono: MessageSquare,
    colorIcono: "var(--exito)"
  },
  {
    clave: "pedidos_tienda",
    nombre: "Pedidos de Tienda y Despachos",
    detalle: "Órdenes e-commerce con ubicación GPS, dedicatorias y fórmula logística interna",
    ruta: "/panel/pedidos",
    categoria: "Comercio & Pagos",
    minNivel: 40,
    icono: ClipboardList,
    colorIcono: "var(--acento)"
  },
  {
    clave: "testimonios_clientes",
    nombre: "Testimonios y Reseñas de Clientes",
    detalle: "Gestión de capturas de WhatsApp, fotos de entregas en taller y enlace a Google Photos",
    ruta: "/panel/testimonios",
    categoria: "Comercio & Pagos",
    minNivel: 40,
    icono: MessageSquareHeart,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "tokens_mcp",
    nombre: "Tokens de Integración MCP (Tranqi / Agentes IA)",
    detalle: "Gestión y emisión de API Keys Bearer para integrar herramientas MCP y agentes externos al catálogo",
    ruta: "/panel/configuracion?widget=tokens_mcp",
    categoria: "Seguridad & Integraciones",
    minNivel: 80,
    icono: KeyRound,
    colorIcono: "var(--acento)"
  },
  {
    clave: "firma_documentos_pdf",
    nombre: "Firma de documentos PDF",
    detalle: "Firma digital con certificado .p12 y código QR",
    ruta: "/panel/firma-documentos",
    categoria: "Herramientas",
    minNivel: 1,
    icono: FileCheck,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "billetera_documentos",
    nombre: "Billetera de documentos",
    detalle: "Tus documentos, con aviso antes de que caduquen",
    ruta: "/panel/billetera-documentos",
    categoria: "Herramientas",
    minNivel: 1,
    icono: Folder,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "mi_cuenta",
    nombre: "Perfil y contacto",
    detalle: "Datos personales, correo y WhatsApp",
    ruta: "/panel/cuenta?widget=mi_cuenta",
    categoria: "Identidad",
    minNivel: 1,
    icono: CircleUser,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "ver_como",
    nombre: "Ver como otro rol",
    detalle: "Alterna la vista según los roles asignados",
    ruta: "/panel/cuenta?widget=ver_como",
    categoria: "Identidad",
    minNivel: 1,
    icono: Sliders,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de accesos",
    detalle: "Registro de inicios de sesión y dispositivos",
    ruta: "/panel/cuenta?widget=historial_accesos",
    categoria: "Seguridad",
    minNivel: 1,
    icono: ShieldCheck,
    colorIcono: "var(--texto)"
  },
  {
    clave: "notificaciones",
    nombre: "Preferencias de avisos",
    detalle: "Canales de notificación y alertas",
    ruta: "/panel/configuracion?widget=notificaciones",
    categoria: "Comunicación",
    minNivel: 1,
    icono: Bell,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "gestion_convenios_corporativos",
    nombre: "Convenios Corporativos & Beneficios B2B",
    detalle: "Gestión de alianzas empresariales, paquetes de beneficios SATCOM, bolsas de consultas y descuentos",
    ruta: "/panel/administrar?widget=gestion_convenios_corporativos",
    categoria: "Comercio & B2B",
    minNivel: 50,
    icono: Building2,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "compliance_score_legal",
    nombre: "Compliance & Score Legal Empresarial",
    detalle: "Matriz de obligaciones normativas (SRI, IESS, LUAE, SuperCías), lectura inteligente Tranqi y Health Score",
    ruta: "/panel/administrar?widget=compliance_score_legal",
    categoria: "Comercio & B2B",
    minNivel: 30,
    icono: ShieldCheck,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "legal_hr_laboral",
    nombre: "Legal HR: Contratos y Finiquitos Laborales",
    detalle: "Gestión laboral de colaboradores, contratos Código del Trabajo, firma .p12, avisos IESS y actas SUT",
    ruta: "/panel/administrar?widget=legal_hr_laboral",
    categoria: "Comercio & B2B",
    minNivel: 30,
    icono: Briefcase,
    colorIcono: "var(--acento)"
  },
  {
    clave: "gestion_informativos",
    nombre: "Gestión de Informativos, Alertas & Beneficios",
    detalle: "Consola de administración de alertas institucionales (ANT, SRI, Municipios) y convenios de capacitación",
    ruta: "/panel/administrar?widget=gestion_informativos",
    categoria: "Comercio & Comunicación",
    minNivel: 30,
    icono: Bell,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "paquete_beneficios_abogados",
    nombre: "Paquete de Beneficios & Convenios para Abogados",
    detalle: "Listado de convenios de capacitación, maestrías, herramientas y beneficios gremiales para la red profesional",
    ruta: "/panel/agendamiento?widget=paquete_beneficios_abogados",
    categoria: "Red Profesional",
    minNivel: 20,
    icono: Sparkles,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "muro_informativo_comunidad",
    nombre: "Avisos & Alertas de la Comunidad",
    detalle: "Cartelera informativa ciudadana con alertas de la ANT, novedades tributarias y noticias de interés",
    ruta: "/panel/clientes?widget=muro_informativo_comunidad",
    categoria: "Comunidad & Clientes",
    minNivel: 1,
    icono: Bell,
    colorIcono: "var(--acento)"
  },
  {
    clave: "disponibilidad_abogados",
    nombre: "Disponibilidad de Abogados & Turnos",
    detalle: "Gestión de horas y cupos. Postulación preliminar por abogados y aprobación por operadores con sincronización Tranqi",
    ruta: "/panel/agendamiento?widget=disponibilidad_abogados",
    categoria: "Agendamiento & Operación",
    minNivel: 30,
    icono: Scale,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "gestion_usuarios",
    nombre: "Usuarios y membresías",
    detalle: "Asignación de perfiles y permisos",
    ruta: "/panel/administrar?widget=gestion_usuarios",
    categoria: "Administración",
    minNivel: 80,
    icono: UserCog,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "gestion_red_abogados",
    nombre: "Red Profesional & Registro de Abogados",
    detalle: "Convertir usuarios registrados en abogados, registro manual y gestión de especialidades, cobertura y disponibilidad",
    ruta: "/panel/red-profesional?widget=gestion_red_abogados",
    categoria: "Red Profesional",
    minNivel: 30,
    icono: Scale,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "mi_perfil_abogado",
    nombre: "Mis Especialidades, Cobertura y Disponibilidad",
    detalle: "Autogestión del socio abogado: materias legales, provincias de cobertura y configuración de citas presenciales y teleconsulta",
    ruta: "/panel/agendamiento?widget=mi_perfil_abogado",
    categoria: "Red Profesional",
    minNivel: 20,
    icono: Scale,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "socios",
    nombre: "Aprobación de socios",
    detalle: "Validación de matrículas y acreditaciones",
    ruta: "/panel/administrar?widget=socios",
    categoria: "Operación legal",
    minNivel: 50,
    icono: UserCheck,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "crm_clientes",
    nombre: "Clientes",
    detalle: "Directorio de clientes y expedientes",
    ruta: "/panel/clientes",
    categoria: "Operación legal",
    minNivel: 50,
    icono: UserCog,
    colorIcono: "var(--acento)"
  },
  {
    clave: "solicitud_socio",
    nombre: "Solicitudes de socios",
    detalle: "Revisión de postulaciones de nuevos socios",
    ruta: "/panel/administrar?widget=solicitud_socio",
    categoria: "Operación legal",
    minNivel: 50,
    icono: Briefcase,
    colorIcono: "var(--ct-0e6648, #0E6648)"
  },
  {
    clave: "panel_administrar",
    nombre: "Administrar",
    ruta: "/panel/administrar",
    detalle: "Gestión de usuarios, socios y notificaciones",
    categoria: "Administración",
    minNivel: 80,
    icono: Shield,
    colorIcono: "var(--error)"
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del negocio",
    detalle: "Datos del negocio, RUC y canales de contacto",
    ruta: "/panel/configuracion?widget=negocio",
    categoria: "Configuración",
    minNivel: 80,
    icono: Settings,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "configuracion_correo",
    nombre: "Correo saliente (SMTP)",
    detalle: "Servidor de correo saliente y credenciales",
    ruta: "/panel/configuracion?widget=correo",
    categoria: "Configuración",
    minNivel: 80,
    icono: Mail,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "perfiles",
    nombre: "Perfiles y permisos",
    detalle: "Catálogo de perfiles y matriz de permisos",
    ruta: "/panel/configuracion?widget=perfiles",
    categoria: "Gobernanza",
    minNivel: 80,
    icono: Sliders,
    colorIcono: "var(--ct-5000ba, var(--violeta, #5000BA))"
  },
  {
    clave: "emision_notificaciones",
    nombre: "Envío de notificaciones",
    detalle: "Envío de avisos por correo, push y WhatsApp",
    ruta: "/panel/administrar?widget=emision_notificaciones",
    categoria: "Comunicación",
    minNivel: 80,
    icono: Bell,
    colorIcono: "var(--aviso)"
  },
  {
    clave: "monitoreo_notificaciones_usuarios",
    nombre: "Notificaciones por usuario",
    detalle: "Seguimiento de entregas y confirmaciones",
    ruta: "/panel/administrar?widget=monitoreo_notificaciones_usuarios",
    categoria: "Comunicación",
    minNivel: 50,
    icono: Bell,
    colorIcono: "var(--ct-1f6feb, #1F6FEB)"
  },
  {
    clave: "bitacora_notificaciones",
    nombre: "Historial de notificaciones",
    detalle: "Registro de avisos enviados y destinatarios",
    ruta: "/panel/administrar?widget=bitacora_notificaciones",
    categoria: "Comunicación",
    minNivel: 50,
    icono: BarChart2,
    colorIcono: "var(--acento)"
  },
  {
    clave: "auditoria",
    nombre: "Auditoría",
    detalle: "Registro de actividad y cambios en el sistema",
    ruta: "/panel/administrar?widget=auditoria",
    categoria: "Seguridad",
    minNivel: 80,
    icono: ShieldCheck,
    colorIcono: "var(--texto)"
  },
  {
    clave: "configuracion_contrato_abogado",
    nombre: "Contrato de socios",
    detalle: "Plantilla del contrato de sociedad de abogados",
    ruta: "/panel/administrar?widget=configuracion_contrato_abogado",
    categoria: "Operación legal",
    minNivel: 50,
    icono: FileText,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "gestion_terminos_consentimientos",
    nombre: "Términos y consentimientos",
    detalle: "Cláusulas LOPDP y avisos legales",
    ruta: "/panel/administrar?widget=gestion_terminos_consentimientos",
    categoria: "Gobernanza",
    minNivel: 80,
    icono: FileText,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  },
  {
    clave: "financiamiento",
    nombre: "Financiamiento & Cuotas para tu Caso",
    detalle: "Planes de pago en cuotas para tu caso legal (Próximamente disponible)",
    ruta: "/panel/clientes?widget=financiamiento",
    categoria: "Comercio & Clientes",
    minNivel: 1,
    icono: CreditCard,
    colorIcono: "var(--ct-5000ba, #5000BA)"
  }
];

interface Props {
  nivelUsuario: number;
  esSuperadmin?: boolean;
}

export function BuscadorModulosGlobal({ nivelUsuario, esSuperadmin = false }: Props) {
  const [consulta, setConsulta] = useState("");
  const [abierto, setAbierto] = useState(false);
  const [indiceSeleccionado, setIndiceSeleccionado] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

  const { getWidgetInfo, obtenerIconoComponente } = useCustomWidgets();

  // Mapear catálogo con títulos e íconos personalizados en tiempo real
  const modulosConCustom = CATALOGO_MODULOS.map(m => {
    const info = getWidgetInfo(m.clave, m.nombre, m.detalle);
    const IconoAdaptado = obtenerIconoComponente(info.iconoKey, m.icono);
    return {
      ...m,
      nombre: info.titulo,
      detalle: info.subtitulo,
      icono: IconoAdaptado
    };
  });

  // Filtrar catálogo estrictamente según permisos de usuario
  const modulosPermitidos = modulosConCustom.filter(m => esSuperadmin || m.minNivel <= nivelUsuario);

  // Filtrar según texto ingresado
  const resultados = consulta.trim()
    ? modulosPermitidos.filter(m =>
        m.nombre.toLowerCase().includes(consulta.toLowerCase()) ||
        m.detalle.toLowerCase().includes(consulta.toLowerCase()) ||
        m.categoria.toLowerCase().includes(consulta.toLowerCase()) ||
        m.clave.toLowerCase().includes(consulta.toLowerCase())
      )
    : [];

  // Atajo de teclado (Ctrl + K / Cmd + K)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
        setAbierto(true);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Cerrar popover si se hace clic fuera
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (contenedorRef.current && !contenedorRef.current.contains(e.target as Node)) {
        setAbierto(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Control con teclado (flechas y enter)
  const handleKeyDownInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIndiceSeleccionado(prev => (prev + 1) % (resultados.length || 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIndiceSeleccionado(prev => (prev - 1 + resultados.length) % (resultados.length || 1));
    } else if (e.key === "Enter" && resultados.length > 0) {
      e.preventDefault();
      const seleccionado = resultados[indiceSeleccionado] || resultados[0];
      if (seleccionado) {
        irAModulo(seleccionado.ruta);
      }
    } else if (e.key === "Escape") {
      setAbierto(false);
    }
  };

  const irAModulo = (ruta: string) => {
    setAbierto(false);
    setConsulta("");
    router.push(ruta);
  };

  return (
    <div ref={contenedorRef} className="busqueda-panel-global" style={{ position: "relative", flex: 1, maxWidth: "480px" }}>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          background: "var(--cf-ffffff, #ffffff)",
          border: abierto ? "1.5px solid var(--violeta, #5000BA)" : "1px solid var(--panel-linea, var(--linea))",
          boxShadow: abierto ? "0 4px 14px rgba(80,0,186,0.12)" : "0 1px 3px rgba(0,0,0,0.04)",
          borderRadius: "10px",
          padding: "8px 12px",
          transition: "all 0.2s ease"
        }}
      >
        <Search size={16} style={{ color: "var(--panel-gris, var(--texto-suave))", marginRight: "8px", flexShrink: 0 }} />

        <input
          ref={inputRef}
          type="text"
          value={consulta}
          onChange={e => {
            setConsulta(e.target.value);
            setAbierto(true);
            setIndiceSeleccionado(0);
          }}
          onFocus={() => setAbierto(true)}
          onKeyDown={handleKeyDownInput}
          placeholder="Buscar un módulo (usuarios, socios, correo…)"
          aria-label="Buscar un módulo"
          style={{
            width: "100%",
            border: "none",
            outline: "none",
            background: "transparent",
            fontSize: "0.85rem",
            fontFamily: "inherit",
            color: "var(--ct-111111, #111111)"
          }}
        />

        {consulta ? (
          <button
            type="button"
            onClick={() => { setConsulta(""); setAbierto(false); }}
            style={{ background: "none", border: "none", cursor: "pointer", color: "var(--panel-gris, var(--texto-suave))", padding: "2px", display: "flex" }}
          >
            <X size={14} />
          </button>
        ) : (
          <kbd style={{ fontSize: "0.65rem", fontWeight: 700, color: "var(--panel-gris, var(--texto-suave))", background: "var(--panel-papel, var(--fondo-suave))", border: "1px solid var(--panel-linea, var(--linea))", borderRadius: "4px", padding: "1px 5px", flexShrink: 0 }}>
            Ctrl K
          </kbd>
        )}
      </div>

      {/* POPOVER DE RESULTADOS FILTRADOS STRICTAMENTE POR PERMISOS */}
      {abierto && consulta.trim().length > 0 && (
        <div
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            background: "var(--cf-ffffff, #ffffff)",
            borderRadius: "12px",
            border: "1px solid var(--panel-linea, var(--linea))",
            boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
            zIndex: 100,
            overflow: "hidden",
            maxHeight: "360px",
            overflowY: "auto"
          }}
        >
          <div style={{ padding: "8px 12px", background: "var(--fondo-suave)", borderBottom: "1px solid var(--linea)", fontSize: "0.75rem", fontWeight: 700, color: "var(--texto-suave)" }}>
            Módulos · {resultados.length}
          </div>

          {resultados.length > 0 ? (
            resultados.map((m, idx) => {
              const Icono = m.icono;
              const activo = idx === indiceSeleccionado;

              return (
                <div
                  key={m.clave}
                  onClick={() => irAModulo(m.ruta)}
                  onMouseEnter={() => setIndiceSeleccionado(idx)}
                  style={{
                    padding: "10px 14px",
                    display: "flex",
                    alignItems: "center",
                    gap: "10px",
                    cursor: "pointer",
                    background: activo ? "var(--acento-diluido)" : "var(--cf-ffffff, #ffffff)",
                    borderLeft: activo ? "3px solid var(--acento)" : "3px solid transparent",
                    transition: "all 0.1s ease"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "30px", height: "30px", borderRadius: "8px", background: "var(--fondo-suave)", flexShrink: 0 }}>
                    <Icono size={16} color={m.colorIcono || "var(--acento)"} />
                  </div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "0.85rem", color: "var(--ct-111111, #111111)", display: "flex", alignItems: "center", gap: "6px" }}>
                      <span>{m.nombre}</span>
                      <span style={{ fontSize: "0.64rem", fontWeight: 700, background: "var(--fondo-hundido)", color: "var(--texto-suave)", padding: "1px 6px", borderRadius: "999px" }}>
                        {m.categoria}
                      </span>
                    </div>
                    <div style={{ fontSize: "0.74rem", color: "var(--texto-suave)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      {m.detalle}
                    </div>
                  </div>

                  <ChevronRight size={14} style={{ color: "var(--texto-suave)" }} />
                </div>
              );
            })
          ) : (
            <div style={{ padding: "16px", textAlign: "center", color: "var(--texto-suave)", fontSize: "0.82rem" }}>
              No se encontraron módulos para &quot;{consulta}&quot;.
            </div>
          )}
        </div>
      )}
    </div>
  );
}
