"use client";

import React, { useState, useEffect } from "react";
import Link from "next/link";
import {
  LayoutGrid, Wrench, Shield, Users, Bell, UserCog, ClipboardList, FileText,
  Settings, ChevronRight, CircleUser, KeyRound, FileCheck, Folder, Calendar, type LucideIcon,
  Bot, ShoppingBag, CreditCard, Receipt, Share2, CheckCircle2, Sparkles, Building2, Scale, Gift,
  ShieldCheck, Briefcase, Pencil, Coins
} from "lucide-react";
import { ModalEditarWidget } from "../ModalEditarWidget";
import { WidgetProximamente } from "../WidgetProximamente";
import { useWidgetEnUrl } from "../useWidgetEnUrl";
import { BotonVolverWidget } from "../BotonVolverWidget";
import { AdministracionPerfilesWidget } from "@eco/gestion-usuarios/componentes/AdministracionPerfilesWidget";
import { ConsultaUsuariosPerfilesWidget } from "@eco/gestion-usuarios/componentes/ConsultaUsuariosPerfilesWidget";
import { EmisionNotificacionesWidget, PreferenciasNotificacionWidget, BitacoraNotificacionesWidget, MonitoreoNotificacionesUsuariosWidget } from "@eco/notificaciones";
import { GestionTerminosConsentimientosWidget } from "@eco/identidad/componentes/GestionTerminosConsentimientosWidget";
import { FormularioConfiguracionNegocio } from "@eco/configuracion-negocio/componentes/FormularioConfiguracionNegocio";
import { FormularioSmtp } from "@eco/configuracion-negocio/componentes/FormularioSmtp";
import { GestionTokensMcpWidget } from "@eco/configuracion-negocio/componentes/GestionTokensMcpWidget";
import { FormularioPerfil } from "@eco/identidad/componentes/FormularioPerfil";
import { WidgetConfiguracionMfa } from "@eco/identidad/componentes/WidgetConfiguracionMfa";
import { SelectorRolActivo, type RolOpcionDef } from "../SelectorRolActivo";
import { VisorAuditoriaWidget } from "../auditoria/VisorAuditoriaWidget";
import { useCustomWidgets } from "../gestorTitulosWidgets";
import { WidgetFirmaDocumentosPdf } from "@/modulos/firma-documentos/componentes/WidgetFirmaDocumentosPdf";
import { WidgetBilleteraDocumentos } from "@/modulos/billetera-documentos";
import { BandejaClientesCRM } from "@/modulos/crm-clientes/componentes/BandejaClientesCRM";
import {
  VitrinaComercialVisual,
  CatalogoProductosComercio,
  ConfiguracionPasarelaPayphone,
  HistorialTransaccionesPago,
  WidgetFacturacionElectronica,
  GestionConveniosCorporativos,
  TableroDisponibilidadOperativa,
  TarjetaBeneficiosCorporativosCliente,
  ConsolaGestionInformativosWidget,
  TableroBeneficiosAvisosWidget,
  ComplianceScoreEmpresarial,
  LegalHRLaboral,
} from "@eco/comercio";
import { SociosWidget } from "../administrar/PanelAdministrarModular";
import { ConfiguracionContratoAbogadoWidget } from "@/modulos/socios/componentes/ConfiguracionContratoAbogadoWidget";
import { GestionRedProfesionalWidget } from "@/modulos/socios/componentes/GestionRedProfesionalWidget";
import { MiPerfilRedAbogadoWidget } from "@/modulos/socios/componentes/MiPerfilRedAbogadoWidget";
import { ConfiguracionHorariosAtencionWidget } from "@/modulos/agenda/componentes/ConfiguracionHorariosAtencionWidget";
import {
  WidgetAgendarCitaInline,
  WidgetAsignacionesAgendaInline,
  WidgetCitasProgramadasAbogadoInline,
  WidgetMisCitasInline,
} from "@/modulos/agenda/componentes/WidgetsAgendaInline";
import { obtenerConfiguracionNavegacionRolAction } from "@eco/gestion-usuarios/acciones";
import { MATRIZ_FUNCIONAL_ROLES } from "@eco/gestion-usuarios/matriz-roles";

interface Props {
  slug: string;
  negocio: string;
  rolInicial?: string;
  esSuperAdmin?: boolean;
  widgetsIniciales?: string[];
  rolesDisponibles?: RolOpcionDef[];
}

// PLT-020: las pantallas de agenda son rutas propias, no widgets en linea --
// necesitan Server Components que consulten bajo RLS. Aqui solo se enlazan,
// para que la tarjeta del panel no quede muerta.
function EnlacePantalla({ texto, descripcion, ruta, color = "var(--violeta, #5000BA)" }: {
  texto: string; descripcion: string; ruta: string; color?: string;
}) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
      <p style={{ fontSize: "0.88rem", color: "#444", margin: 0, maxWidth: "60ch" }}>{descripcion}</p>
      <Link
        href={ruta}
        style={{
          background: color, color: "#fff", textDecoration: "none",
          padding: "10px 16px", borderRadius: "10px", fontWeight: 700, fontSize: "0.85rem"
        }}
      >
        {texto}
      </Link>
    </div>
  );
}

function EnlaceConsolaAgentes() {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "flex-start" }}>
      <p style={{ fontSize: "0.88rem", color: "#444", margin: 0, maxWidth: "60ch" }}>
        Los asistentes de IA se configuran en su propia consola, que exige verificación en dos
        pasos: editar el prompt de un agente cambia lo que se le responde a todos los afiliados.
      </p>
      <Link
        href="/panel/agentes"
        style={{
          background: "var(--violeta, #5000BA)", color: "#fff", textDecoration: "none",
          padding: "10px 16px", borderRadius: "10px", fontWeight: 700, fontSize: "0.85rem"
        }}
      >
        Abrir la consola de agentes
      </Link>
    </div>
  );
}

const METADATOS_PANELES_BASE: Record<string, { nombre: string; descripcion: string; icono?: string }> = {
  panel_usuarios: {
    nombre: "Usuarios",
    descripcion: "Directorio de usuarios, CRM Jurídico & Gestión de Clientes y Monitoreo de Notificaciones por Usuario.",
    icono: "Users"
  },
  panel_red_profesional: {
    nombre: "Red profesional",
    descripcion: "Aprobación de socios abogados y procesamiento de solicitudes de incorporación.",
    icono: "Briefcase"
  },
  panel_terminos: {
    nombre: "Términos & Condiciones",
    descripcion: "Términos, Consentimientos LOPDP y Configuración de Contrato de Socios.",
    icono: "FileText"
  },
  panel_agendamiento: {
    nombre: "Agendamiento",
    descripcion: "Mesa de asignaciones, contingencia de citas y disponibilidad horaria.",
    icono: "Calendar"
  },
  panel_administrar: {
    nombre: "Administrar",
    descripcion: "Consola de administración protegida para pagos, despacho de notificaciones, bitácoras y auditoría BDD.",
    icono: "Shield"
  },
  panel_herramientas: {
    nombre: "Herramientas",
    descripcion: "Herramientas digitales, firmado de documentos PDF y utilitarios del ecosistema.",
    icono: "Wrench"
  },
  panel_seguridad: {
    nombre: "Seguridad",
    descripcion: "Seguridad MFA, autenticador e historial de accesos.",
    icono: "Shield"
  },
  panel_cuenta: {
    nombre: "Mi Cuenta & Identidad",
    descripcion: "Perfil de usuario, conmutador de rol ('Ver como') e historial de accesos.",
    icono: "User"
  },
  panel_clientes: {
    nombre: "Clientes",
    descripcion: "Oferta comercial para personas naturales, citas, trámites familiares y opciones de clientes.",
    icono: "User"
  },
  panel_empresas: {
    nombre: "Empresas",
    descripcion: "Catálogo corporativo, constitución SAS, convenios de beneficios SATCOM y planes mensuales B2B.",
    icono: "Building"
  },
  panel_configuracion: {
    nombre: "Configurar",
    descripcion: "Parámetros del negocio, servidor SMTP, perfiles y alertas de notificaciones.",
    icono: "Settings"
  }
};

const INVENTARIO_GLOBAL_WIDGETS: Record<string, { titulo: string; subtitulo: string; icono: LucideIcon; colorIcono: string; categoria: string }> = {
  agendar_cita: {
    titulo: "Agendar Consulta o Trámite",
    subtitulo: "Elige materia legal, fecha y modalidad presencial o videollamada",
    icono: Calendar,
    colorIcono: "#0284C7",
    categoria: "Operación & Citas"
  },
  mis_citas: {
    titulo: "Mis Citas & Consultas Programadas",
    subtitulo: "Consulta tus próximas citas legales, enlaces de videollamada y estado",
    icono: Calendar,
    colorIcono: "#5000BA",
    categoria: "Operación & Citas"
  },
  citas_programadas: {
    titulo: "Citas Programadas & Agenda Legal",
    subtitulo: "Confirma, atiende o reagenda las consultas legales asignadas a tu turno",
    icono: Calendar,
    colorIcono: "#05876E",
    categoria: "Agenda del Abogado"
  },
  disponibilidad: {
    titulo: "Disponibilidad de Horarios & Citas",
    subtitulo: "Configura tus franjas horarias de atención presencial y teleconsulta virtual",
    icono: Calendar,
    colorIcono: "#05876E",
    categoria: "Agenda del Abogado"
  },
  vitrina_comercial_personas: {
    titulo: "Oferta para Personas Naturales & Familias",
    subtitulo: "Trámites notariales, videoconsultas individuales, defensa legal y planes familiares",
    icono: Sparkles,
    colorIcono: "#0284C7",
    categoria: "Comercio Personas"
  },
  vitrina_comercial_empresas: {
    titulo: "Oferta Corporativa & Empresas",
    subtitulo: "Planes legales corporativos, constitución SAS, convenios de beneficios y asesoría empresarial",
    icono: Building2,
    colorIcono: "#5000BA",
    categoria: "Comercio Corporativo"
  },
  vitrina_comercial: {
    titulo: "Planes, Servicios & Honorarios",
    subtitulo: "Oferta de servicios legales, planes de suscripción y tarifario interactivo",
    icono: Sparkles,
    colorIcono: "#5000BA",
    categoria: "Comercio y Pagos"
  },
  vitrina: {
    titulo: "Planes, Servicios & Honorarios",
    subtitulo: "Oferta de servicios legales, planes de suscripción y tarifario interactivo",
    icono: Sparkles,
    colorIcono: "#5000BA",
    categoria: "Comercio y Pagos"
  },
  catalogo_productos: {
    titulo: "Catálogo Comercial & Honorarios",
    subtitulo: "Servicios jurídicos, tarifario de honorarios y suscripciones con IVA 15%",
    icono: ShoppingBag,
    colorIcono: "#0284C7",
    categoria: "Comercio y Pagos"
  },
  pasarela_payphone: {
    titulo: "Pasarela Payphone (Botón de Pago)",
    subtitulo: "Configuración del Botón de Pago Payphone, credenciales y simulador de cobro",
    icono: CreditCard,
    colorIcono: "#D97706",
    categoria: "Comercio y Pagos"
  },
  facturacion_electronica: {
    titulo: "Historial de Pagos",
    subtitulo: "Valores generados, valores pagados, detalle del rubro facturado y descarga de facturas electrónicas SRI",
    icono: Receipt,
    colorIcono: "#05876E",
    categoria: "Comercio y Pagos"
  },
  comprobantes_electronicos: {
    titulo: "Historial de Pagos",
    subtitulo: "Valores generados, valores pagados, detalle del rubro facturado y descarga de facturas electrónicas SRI",
    icono: Receipt,
    colorIcono: "#05876E",
    categoria: "Comercio y Pagos"
  },
  historial_pagos: {
    titulo: "Historial de Pagos",
    subtitulo: "Valores generados, valores pagados, detalle del rubro facturado y descarga de facturas electrónicas SRI",
    icono: CreditCard,
    colorIcono: "#05876E",
    categoria: "Comercio y Pagos"
  },
  crm_clientes: {
    titulo: "CRM Jurídico & Clientes",
    subtitulo: "Directorio 360°, KPIs, expedientes y conflict check en vivo",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Gestión Legal"
  },
  clientes_crm: {
    titulo: "CRM Jurídico & Clientes",
    subtitulo: "Directorio 360°, KPIs, expedientes y conflict check en vivo",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Gestión Legal"
  },
  agentes_ia: {
    titulo: "Agentes de IA",
    subtitulo: "Configuración de los asistentes Tranqi: prompts, modelo y herramientas",
    icono: Bot,
    colorIcono: "#5000BA",
    categoria: "Configuración"
  },
  firma_documentos_pdf: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  billetera_documentos: {
    titulo: "Billetera Digital de Documentos Seguros",
    subtitulo: "Bóveda digital de documentos personales, vehiculares, contratos y profesionales con OCR y TTL",
    icono: Folder,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  billetera: {
    titulo: "Billetera Digital de Documentos Seguros",
    subtitulo: "Bóveda digital de documentos personales, vehiculares, contratos y profesionales con OCR y TTL",
    icono: Folder,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  documentos: {
    titulo: "Billetera Digital de Documentos Seguros",
    subtitulo: "Bóveda digital de documentos personales, vehiculares, contratos y profesionales con OCR y TTL",
    icono: Folder,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  firma_documentos: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  firma_pdf: {
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR",
    icono: FileCheck,
    colorIcono: "#5000BA",
    categoria: "Herramientas Digitales"
  },
  mfa_seguridad: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  mfa: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  tokens_mcp: {
    titulo: "Tokens & APIs MCP",
    subtitulo: "Gestión y emisión de tokens de acceso para conectar herramientas MCP con bots y agentes externos",
    icono: KeyRound,
    colorIcono: "#5000BA",
    categoria: "Seguridad & Integraciones"
  },
  seguridad_mfa: {
    titulo: "Seguridad MFA & Autenticador",
    subtitulo: "Configuración TOTP, autenticador móvil y reseteo estándar vía correo",
    icono: KeyRound,
    colorIcono: "#D97706",
    categoria: "Seguridad"
  },
  emision_notificaciones: {
    titulo: "Emisión de Notificaciones Multicanal",
    subtitulo: "Despacho masivo multicanal (In-App, Push, Email y WhatsApp)",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Comunicación"
  },
  monitoreo_notificaciones_usuarios: {
    titulo: "Monitoreo de Notificaciones por Usuario",
    subtitulo: "Auditoría en tiempo real de notificaciones, fechas de confirmación, tiempo de pospuesto y eliminados",
    icono: Bell,
    colorIcono: "#1F6FEB",
    categoria: "Comunicación"
  },
  bitacora_notificaciones: {
    titulo: "Bitácora & Historial de Notificaciones",
    subtitulo: "Consulta auditada en tiempo real de notificaciones emitidas y destinatarios",
    icono: Bell,
    colorIcono: "#2563EB",
    categoria: "Comunicación"
  },
  gestion_convenios_corporativos: {
    titulo: "Convenios Corporativos & Paquetes B2B",
    subtitulo: "Gestión de alianzas empresariales, bolsas de consultas y descuentos automáticos",
    icono: Building2,
    colorIcono: "#05876E",
    categoria: "Comercio & B2B"
  },
  compliance_score_legal: {
    titulo: "Compliance & Score Legal Empresarial",
    subtitulo: "Matriz de obligaciones normativas, monitoreo continuo de caducidades con Tranqi y cálculo del Legal Health Score",
    icono: ShieldCheck,
    colorIcono: "#05876E",
    categoria: "Comercio & B2B"
  },
  legal_hr_laboral: {
    titulo: "Legal HR: Contratos y Finiquitos",
    subtitulo: "Gestión laboral de colaboradores, contratos tipificados, firma .p12, avisos IESS y actas de finiquito SUT",
    icono: Briefcase,
    colorIcono: "#2563EB",
    categoria: "Comercio & B2B"
  },
  mis_beneficios_corporativos: {
    titulo: "Mis Beneficios Corporativos & Convenio",
    subtitulo: "Consultas telemáticas gratuitas ($0.00) y descuentos corporativos activos por convenio empresarial",
    icono: Gift,
    colorIcono: "#05876E",
    categoria: "Comercio Personas"
  },
  disponibilidad_abogados: {
    titulo: "Disponibilidad de Abogados & Horarios",
    subtitulo: "Horario laborable por defecto (telemático y oficina), fechas exactas (ej. Navidad) y cupo máximo por hora",
    icono: Scale,
    colorIcono: "#5000BA",
    categoria: "Agendamiento & Operación"
  },
  disponibilidad_operativa: {
    titulo: "Disponibilidad Operativa & Especialistas",
    subtitulo: "Control de stock de horas y cuadrillas de atención técnica o profesional",
    icono: Scale,
    colorIcono: "#5000BA",
    categoria: "Agendamiento & Operación"
  },
  gestion_usuarios: {
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Usuarios & Permisos"
  },
  perfiles: {
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: UserCog,
    colorIcono: "var(--violeta, #5000BA)",
    categoria: "Usuarios & Permisos"
  },
  consulta_usuarios_perfiles: {
    titulo: "Consulta de Usuarios & Perfiles",
    subtitulo: "Directorio de miembros, matriz de roles y consulta de permisos (Solo Lectura)",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Consulta & Directorio"
  },
  consulta_perfiles: {
    titulo: "Consulta de Usuarios & Perfiles",
    subtitulo: "Directorio de miembros, matriz de roles y consulta de permisos (Solo Lectura)",
    icono: Users,
    colorIcono: "#5000BA",
    categoria: "Consulta & Directorio"
  },
  gestion_red_abogados: {
    titulo: "Red Profesional & Registro de Abogados",
    subtitulo: "Convertir usuarios registrados en abogados, registro manual y gestión de especialidades, cobertura y disponibilidad",
    icono: Scale,
    colorIcono: "#05876E",
    categoria: "Red Profesional"
  },
  mi_perfil_abogado: {
    titulo: "Mis Especialidades, Cobertura y Disponibilidad",
    subtitulo: "Configura tus materias legales, provincias de cobertura y horarios de atención presencial y teleconsulta",
    icono: Scale,
    colorIcono: "#05876E",
    categoria: "Red Profesional"
  },
  socios: {
    titulo: "Aprobación de Socios Abogados",
    subtitulo: "Validación de matrículas, acreditación y verificación de abogados",
    icono: Users,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  solicitud_socio: {
    titulo: "Solicitudes de Socios",
    subtitulo: "Procesamiento de postulaciones y formularios de postulación socio",
    icono: ClipboardList,
    colorIcono: "#05876E",
    categoria: "Operación Legal"
  },
  auditoria: {
    titulo: "Auditoría BDD & Telemetría",
    subtitulo: "Consulta de registros inmutables PostgreSQL y telemetría de APIs",
    icono: Shield,
    colorIcono: "#111827",
    categoria: "Seguridad & Auditoría"
  },
  gestion_terminos_consentimientos: {
    titulo: "Términos, Consentimientos & LOPDP",
    subtitulo: "Configuración centralizada de cláusulas LOPDP, notificaciones y contrato de socios",
    icono: FileText,
    colorIcono: "#5000BA",
    categoria: "Gobernanza & Legales"
  },
  configuracion_contrato_abogado: {
    titulo: "Configuración de Contrato de Socios",
    subtitulo: "Administración de la plantilla del contrato de sociedad de abogados (.MD/HTML)",
    icono: FileText,
    colorIcono: "#05876E",
    categoria: "Gobernanza & Legales"
  },
  horarios_atencion_agenda: {
    titulo: "Horarios de Atención (Telemático y Presencial)",
    subtitulo: "Configura los horarios por defecto de consultas telemáticas y presenciales, y la especialidad por defecto para Tranqi",
    icono: Calendar,
    colorIcono: "#5000BA",
    categoria: "Agenda"
  },
  asignaciones_agenda: {
    titulo: "Asignaciones y Contingencia (Agenda)",
    subtitulo: "Mesa de control de asignaciones operativas y reasignación de citas",
    icono: LayoutGrid,
    colorIcono: "#0284C7",
    categoria: "Agenda"
  },
  gestion_informativos: {
    titulo: "Gestión de Informativos & Beneficios",
    subtitulo: "Consola de administración de alertas institucionales, novedades tributarias y convenios de capacitación",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Comercio & Comunicación"
  },
  paquete_beneficios_abogados: {
    titulo: "Paquete de Beneficios & Convenios",
    subtitulo: "Muro de beneficios, maestrías, herramientas jurídicas y convenios académicos para socios abogados",
    icono: Sparkles,
    colorIcono: "#5000BA",
    categoria: "Red Profesional"
  },
  muro_informativo_comunidad: {
    titulo: "Avisos & Alertas de la Comunidad",
    subtitulo: "Cartelera informativa ciudadana con alertas de la ANT, SRI y novedades de interés legal",
    icono: Bell,
    colorIcono: "#0284C7",
    categoria: "Información & Clientes"
  },
  notificaciones: {
    titulo: "Preferencias de Alertas & Notificaciones",
    subtitulo: "Configuración de canales de alerta, WhatsApp y avisos",
    icono: Bell,
    colorIcono: "#D97706",
    categoria: "Preferencias"
  },
  configuracion_negocio: {
    titulo: "Configuración del Negocio",
    subtitulo: "Parámetros del negocio, RUC, redes sociales y contacto",
    icono: Settings,
    colorIcono: "#5000BA",
    categoria: "Parámetros"
  },
  negocio: {
    titulo: "Configuración del Negocio",
    subtitulo: "Parámetros del negocio, RUC, redes sociales y contacto",
    icono: Settings,
    colorIcono: "#5000BA",
    categoria: "Parámetros"
  },
  configuracion_correo: {
    titulo: "Servidor SMTP & Correo",
    subtitulo: "Credenciales cifradas SMTP y plantillas HTML",
    icono: Settings,
    colorIcono: "#05876E",
    categoria: "Servicios"
  },
  correo: {
    titulo: "Servidor SMTP & Correo",
    subtitulo: "Credenciales cifradas SMTP y plantillas HTML",
    icono: Settings,
    colorIcono: "#05876E",
    categoria: "Servicios"
  },
  mi_cuenta: {
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: CircleUser,
    colorIcono: "#5000BA",
    categoria: "Identidad"
  },
  perfil: {
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: CircleUser,
    colorIcono: "#5000BA",
    categoria: "Identidad"
  },
  ver_como: {
    titulo: "Selector 'Ver Como' (Conmutador de Rol)",
    subtitulo: "Alternar la vista previa del portal según los roles asignados",
    icono: Shield,
    colorIcono: "#5000BA",
    categoria: "Gobernanza"
  },
  rol_activo: {
    titulo: "Selector 'Ver Como' (Conmutador de Rol)",
    subtitulo: "Alternar la vista previa del portal según los roles asignados",
    icono: Shield,
    colorIcono: "#5000BA",
    categoria: "Gobernanza"
  },
  financiamiento: {
    titulo: "Financiamiento & Cuotas para tu Caso",
    subtitulo: "Planes de pago en cuotas flexibles y financiamiento legal (Próximamente disponible)",
    icono: Coins,
    colorIcono: "#5000BA",
    categoria: "Comercio Personas"
  }
};

function obtenerWidgetsInicialesDinamicos(panelId: string, slugStr: string, rolDefault: string = "CLIENTE", esSuperAdmin: boolean = false): string[] {
  let rolActivo = (rolDefault || "CLIENTE").toUpperCase();
  if (esSuperAdmin && typeof document !== "undefined") {
    const cookieStore = document.cookie || "";
    const matchModo = cookieStore.match(/tranqi_modo_rol=([^;]+)/);
    const matchFav = cookieStore.match(/tranqi_rol_favorito=([^;]+)/);
    if (matchModo && matchModo[1]) rolActivo = matchModo[1].toUpperCase();
    else if (matchFav && matchFav[1]) rolActivo = matchFav[1].toUpperCase();
  }

  const slugNorm = slugStr.replace(/-/g, "_");
  const panelKey = panelId || `panel_${slugNorm}`;

  const matrizRol = MATRIZ_FUNCIONAL_ROLES[rolActivo] || MATRIZ_FUNCIONAL_ROLES["CLIENTE"];
  if (matrizRol?.widgetsPorPanel) {
    const w =
      matrizRol.widgetsPorPanel[panelKey] ??
      matrizRol.widgetsPorPanel[panelId] ??
      matrizRol.widgetsPorPanel[slugNorm] ??
      matrizRol.widgetsPorPanel[`panel_${slugNorm}`];
    if (Array.isArray(w)) return [...w];
  }

  return [];
}

export function PanelDinamicoModular({ slug, negocio, rolInicial = "ADMINISTRADOR", esSuperAdmin, widgetsIniciales, rolesDisponibles }: Props) {
  const slugNormalizado = slug.replace(/-/g, "_");
  const panelIdBuscado = slugNormalizado.startsWith("panel_") ? slugNormalizado : `panel_${slugNormalizado}`;

  const metaBase = METADATOS_PANELES_BASE[panelIdBuscado] || {
    nombre: slug.charAt(0).toUpperCase() + slug.slice(1).replace(/-/g, " "),
    descripcion: `Panel dinámico ${slug}`
  };

  const [panelInfo, setPanelInfo] = useState<{ id: string; nombre: string; descripcion: string; icono?: string; requiereMfa?: boolean }>({
    id: panelIdBuscado,
    nombre: metaBase.nombre,
    descripcion: metaBase.descripcion,
    icono: metaBase.icono
  });

  const [widgetsAsignados, setWidgetsAsignados] = useState<string[]>(() => {
    if (widgetsIniciales && widgetsIniciales.length > 0) {
      let w = Array.from(
        new Set(widgetsIniciales.map(item => (item === "facturacion_electronica" ? "historial_pagos" : item)))
      );
      if (rolInicial?.toUpperCase() === "OPERADOR" && (panelIdBuscado === "panel_usuarios" || slugNormalizado === "usuarios")) {
        w = w.filter(item => item !== "crm_clientes");
      }
      return w;
    }
    return obtenerWidgetsInicialesDinamicos(panelIdBuscado, slug, rolInicial);
  });
  const { widgetActivo, abrir, cerrar } = useWidgetEnUrl();
  const [copiadoModulo, setCopiadoModulo] = useState(false);
  const { getWidgetInfo, guardarWidget } = useCustomWidgets();
  const [widgetEditar, setWidgetEditar] = useState<{
    id: string;
    titulo: string;
    subtitulo: string;
    iconoKey?: string;
    requiereMfa?: boolean;
    tiempoMfaMinutos?: number;
  } | null>(null);

  // Compartir URL con el módulo y panel activo
  const handleCompartirModulo = (wClave?: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    const targetW = wClave !== undefined ? wClave : widgetActivo;
    if (targetW) {
      url.searchParams.set("modulo", targetW);
    } else {
      url.searchParams.delete("modulo");
      url.searchParams.delete("widget");
    }

    window.history.replaceState({}, "", url.toString());

    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopiadoModulo(true);
        setTimeout(() => setCopiadoModulo(false), 2500);
      }).catch(() => {
        prompt("Copia este enlace para compartir el acceso a este módulo:", url.toString());
      });
    } else {
      prompt("Copia este enlace para compartir el acceso a este módulo:", url.toString());
    }
  };

  // Cargar configuración de panel y widgets asignados (BDD + Presets de Rol + LocalStorage)
  useEffect(() => {
    async function cargarConfiguracion() {
      try {
        const savedPaneles = localStorage.getItem(`tranqi_paneles_sidebar_${negocio}`) || localStorage.getItem("tranqi_paneles_sidebar_TRANQ");
        if (savedPaneles) {
          const parsed = JSON.parse(savedPaneles);
          if (Array.isArray(parsed)) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const pFound = parsed.find((p: any) => p.id === panelIdBuscado || p.ruta === `/panel/${slug}` || p.id === slug || p.id === slugNormalizado);
            if (pFound) {
              setPanelInfo({
                id: pFound.id,
                nombre: pFound.nombre,
                descripcion: pFound.descripcion || metaBase.descripcion,
                icono: pFound.icono,
                requiereMfa: pFound.requiereMfa
              });
            }
          }
        }

        let rolActivo = (rolInicial || "CLIENTE").toUpperCase();
        if (esSuperAdmin) {
          const cookieStore = typeof document !== "undefined" ? document.cookie : "";
          const matchModo = cookieStore.match(/tranqi_modo_rol=([^;]+)/);
          const matchFav = cookieStore.match(/tranqi_rol_favorito=([^;]+)/);
          if (matchModo && matchModo[1]) rolActivo = matchModo[1].toUpperCase();
          else if (matchFav && matchFav[1]) rolActivo = matchFav[1].toUpperCase();
        }

        let listW: string[] = [];
        let configuracionEncontrada = false;

        // 1. Consultar servidor (PostgreSQL comun_seguridad.seg_perfil / seg_rol_widget)
        const resBdd = await obtenerConfiguracionNavegacionRolAction(rolActivo, (negocio || "TRANQ").toUpperCase());
        if (resBdd.ok && resBdd.data && resBdd.data.widgetsPorPanel) {
          const wBdd =
            resBdd.data.widgetsPorPanel[panelIdBuscado] ??
            resBdd.data.widgetsPorPanel[slug] ??
            resBdd.data.widgetsPorPanel[slugNormalizado] ??
            resBdd.data.widgetsPorPanel[`panel_${slug}`] ??
            resBdd.data.widgetsPorPanel[`panel_${slugNormalizado}`];
          if (Array.isArray(wBdd)) {
            listW = wBdd;
            configuracionEncontrada = true;
          }

          // Si hay títulos personalizados por panel en base de datos, sincronizarlos
          if (resBdd.data.titulosWidgetsPorPanel && typeof window !== "undefined") {
            try {
              const rawTit = localStorage.getItem("tranqi_custom_widgets_config");
              const currentCustom = rawTit ? JSON.parse(rawTit) : {};
              let modificado = false;
              Object.entries(resBdd.data.titulosWidgetsPorPanel).forEach(([k, tit]) => {
                if (tit && (!currentCustom[k] || currentCustom[k].titulo !== tit)) {
                  currentCustom[k] = { ...(currentCustom[k] || {}), titulo: tit };
                  modificado = true;
                }
              });
              if (modificado) {
                localStorage.setItem("tranqi_custom_widgets_config", JSON.stringify(currentCustom));
                window.dispatchEvent(new CustomEvent("tranqi_widget_custom_updated"));
              }
            } catch (err) {
              console.warn("No se pudo sincronizar títulos de widgets desde BDD:", err);
            }
          }
        }

        // 2. Complementar con personalizaciones en localStorage si existen en esta máquina
        const savedPerfiles =
          localStorage.getItem(`tranqi_perfiles_${negocio}`) ||
          localStorage.getItem(`tranqi_perfiles_${(negocio || "").toUpperCase()}`) ||
          localStorage.getItem(`tranqi_perfiles_${(negocio || "").toLowerCase()}`) ||
          localStorage.getItem("tranqi_perfiles_TRANQ") ||
          localStorage.getItem("tranqi_perfiles_tranqi");

        if (savedPerfiles) {
          try {
            const perfiles = JSON.parse(savedPerfiles);
            if (Array.isArray(perfiles)) {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              let perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === rolActivo);
              if (!perfilObj && (rolActivo === "OPERADOR" || rolActivo === "AUXILIAR")) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                perfilObj = perfiles.find((p: any) => p.clave?.toUpperCase() === "OPERADOR");
              }
              if (perfilObj && perfilObj.widgetsAsignadosPorPanel) {
                const wLocal =
                  perfilObj.widgetsAsignadosPorPanel[panelIdBuscado] ??
                  perfilObj.widgetsAsignadosPorPanel[slug] ??
                  perfilObj.widgetsAsignadosPorPanel[slugNormalizado] ??
                  perfilObj.widgetsAsignadosPorPanel[`panel_${slug}`] ??
                  perfilObj.widgetsAsignadosPorPanel[`panel_${slugNormalizado}`];
                if (Array.isArray(wLocal)) {
                  const retiradosLocal = new Set<string>(
                    perfilObj.widgetsRetiradosPorPanel?.[panelIdBuscado] ||
                    perfilObj.widgetsRetiradosPorPanel?.[slug] ||
                    perfilObj.widgetsRetiradosPorPanel?.[slugNormalizado] ||
                    []
                  );
                  const wFiltrado = (rolActivo === "OPERADOR" && (panelIdBuscado === "panel_usuarios" || slugNormalizado === "usuarios"))
                    ? wLocal.filter((w: string) => w !== "crm_clientes")
                    : wLocal;
                  listW = wFiltrado.filter((w: string) => !retiradosLocal.has(w));
                  configuracionEncontrada = true;
                }
              }
            }
          } catch (e) {
            console.error("Error leyendo tranqi_perfiles de localStorage:", e);
          }
        }

        // 3. Si no existe configuración explícita en BDD ni en localStorage, usar los widgets canónicos de MATRIZ_FUNCIONAL_ROLES
        const wCanonicos = obtenerWidgetsInicialesDinamicos(panelIdBuscado, slug, rolActivo);
        if (!configuracionEncontrada) {
          listW = wCanonicos;
        }

        // Sanitización universal: Si el perfil es OPERADOR y el panel es usuarios, jamás mostrar crm_clientes
        if (rolActivo === "OPERADOR" && (panelIdBuscado === "panel_usuarios" || slugNormalizado === "usuarios")) {
          listW = listW.filter(w => w !== "crm_clientes");
        }

        // Unificar facturacion_electronica dentro de historial_pagos sin duplicados
        listW = Array.from(
          new Set(listW.map(w => (w === "facturacion_electronica" ? "historial_pagos" : w)))
        );

        setWidgetsAsignados(listW);
      } catch (err) {
        console.error("Error cargando panel dinámico:", err);
      }
    }

    cargarConfiguracion();
    window.addEventListener("storage", cargarConfiguracion);
    window.addEventListener("tranqi_perfiles_updated", cargarConfiguracion);
    return () => {
      window.removeEventListener("storage", cargarConfiguracion);
      window.removeEventListener("tranqi_perfiles_updated", cargarConfiguracion);
    };
  }, [slug, negocio, panelIdBuscado, rolInicial, metaBase.descripcion, slugNormalizado, esSuperAdmin]);

  const renderWidgetComponente = (wClave: string) => {
    switch (wClave) {
      case "agendar_cita":
        return <WidgetAgendarCitaInline />;
      case "mis_citas":
        return <WidgetMisCitasInline onIrAAgendar={() => abrir("agendar_cita")} />;
      case "citas_programadas":
        return <WidgetCitasProgramadasAbogadoInline onIrADisponibilidad={() => abrir("disponibilidad")} />;
      case "disponibilidad":
        return <MiPerfilRedAbogadoWidget tabInicial="disponibilidad" />;
      case "mi_perfil_abogado":
      case "perfil_abogado":
      case "especialidades_abogado":
        return <MiPerfilRedAbogadoWidget tabInicial="perfil" />;
      case "gestion_red_abogados":
      case "red_profesional":
      case "registro_abogados":
        return <GestionRedProfesionalWidget />;
      case "asignaciones_agenda":
        return <WidgetAsignacionesAgendaInline />;
      case "vitrina_comercial_personas":
      case "vitrina_personas":
      case "oferta_personas":
      case "servicios_personas":
        return <VitrinaComercialVisual negocio={negocio} filtroAudiencia="personas" />;
      case "vitrina_comercial_empresas":
      case "vitrina_empresas":
      case "oferta_empresas":
      case "planes_corporativos":
      case "servicios_empresas":
        return <VitrinaComercialVisual negocio={negocio} filtroAudiencia="empresas" />;
      case "vitrina_comercial":
      case "vitrina":
      case "servicios":
        return <VitrinaComercialVisual negocio={negocio} />;
      case "gestion_catalogo":
      case "catalogo_productos":
      case "catalogo":
      case "honorarios":
        return <CatalogoProductosComercio negocio={negocio} />;
      case "pasarela_payphone":
      case "payphone":
      case "pasarela":
        return <ConfiguracionPasarelaPayphone negocio={negocio} />;
      case "facturacion_electronica":
      case "comprobantes_electronicos":
      case "facturacion_sri":
        return <WidgetFacturacionElectronica negocio={negocio} />;
      case "historial_pagos":
      case "transacciones":
      case "pagos":
        return <HistorialTransaccionesPago negocio={negocio} />;
      case "crm_clientes":
      case "clientes_crm":
      case "clientes": {
        const tipoInicialCRM = slug === "clientes" ? "natural" : slug === "empresas" ? "juridica" : undefined;
        return <BandejaClientesCRM negocio={negocio} tipoPersoneriaPorDefecto={tipoInicialCRM} />;
      }
      case "agentes_ia":
        return <EnlaceConsolaAgentes />;
      case "firma_documentos_pdf":
      case "firma_documentos":
      case "firma_pdf":
      case "firma":
        return <WidgetFirmaDocumentosPdf negocio={negocio} onCerrar={cerrar} mostrarBotonCerrar={false} />;
      case "billetera_documentos":
      case "billetera":
      case "documentos":
        return <WidgetBilleteraDocumentos negocio={negocio} onCerrar={cerrar} />;
      case "mfa_seguridad":
      case "mfa":
      case "seguridad_mfa":
        return <WidgetConfiguracionMfa negocio={negocio} />;
      case "tokens_mcp":
      case "tokens":
      case "mcp_tokens":
        return <GestionTokensMcpWidget negocio={negocio} />;
      case "emision_notificaciones":
        return <EmisionNotificacionesWidget negocio={negocio} />;
      case "monitoreo_notificaciones_usuarios":
      case "monitoreo-notificaciones-usuarios":
        return <MonitoreoNotificacionesUsuariosWidget negocio={negocio} />;
      case "bitacora_notificaciones":
      case "bitacora-notificaciones":
        return <BitacoraNotificacionesWidget negocio={negocio} />;
      case "gestion_convenios_corporativos":
      case "convenios_corporativos":
      case "convenios":
        return <GestionConveniosCorporativos negocio={negocio} />;
      case "compliance_score_legal":
      case "compliance":
      case "compliance_empresarial":
      case "legal_compliance":
        return <ComplianceScoreEmpresarial negocio={negocio} />;
      case "legal_hr_laboral":
      case "legal_hr":
      case "laboral":
      case "finiquitos":
        return <LegalHRLaboral negocio={negocio} />;
      case "mis_beneficios_corporativos":
      case "beneficios_corporativos":
      case "beneficios_cliente":
        return <TarjetaBeneficiosCorporativosCliente negocio={negocio} />;
      case "gestion_informativos":
      case "informativos":
      case "avisos":
        return <ConsolaGestionInformativosWidget negocio={negocio} />;
      case "paquete_beneficios_abogados":
      case "beneficios_abogados":
      case "convenios_abogados":
        return <TableroBeneficiosAvisosWidget negocio={negocio} audienciaActiva="ABOGADOS" />;
      case "muro_informativo_comunidad":
      case "alertas_comunidad":
      case "cartelera_comunidad":
        return (
          <TableroBeneficiosAvisosWidget
            negocio={negocio}
            audienciaActiva="TODOS"
            linkGestion={
              esSuperAdmin || ["OPERADOR", "ADMINISTRADOR", "ADMIN", "AUXILIAR", "TECNICO"].includes(rolInicial.toUpperCase())
                ? "/panel/administrar?widget=gestion_informativos"
                : undefined
            }
          />
        );
      case "horarios_atencion_agenda":
      case "horarios_atencion":
      case "disponibilidad_abogados":
        return <ConfiguracionHorariosAtencionWidget />;
      case "disponibilidad_operativa":
        return negocio === "tranqi" || negocio === "TRANQ" ? (
          <ConfiguracionHorariosAtencionWidget />
        ) : (
          <TableroDisponibilidadOperativa negocio={negocio} />
        );
      case "gestion_usuarios":
      case "perfiles":
        return <AdministracionPerfilesWidget esAdmin={true} negocio={negocio} />;
      case "consulta_usuarios_perfiles":
      case "consulta_perfiles":
        return <ConsultaUsuariosPerfilesWidget negocio={negocio} />;
      case "gestion_terminos_consentimientos":
      case "terminos":
        return <GestionTerminosConsentimientosWidget />;
      case "notificaciones":
        return <PreferenciasNotificacionWidget negocio={negocio} />;
      case "configuracion_negocio":
      case "negocio":
        return <FormularioConfiguracionNegocio inicial={null} negocio={negocio} />;
      case "configuracion_correo":
      case "correo":
        return <FormularioSmtp inicial={null} negocio={negocio} />;
      case "mi_cuenta":
      case "perfil":
        return <FormularioPerfil inicial={{ nombres: "", apellidos: "", correo: "", whatsapp: "", autorizaWhatsapp: false }} />;
      case "ver_como":
      case "rol_activo":
        return <SelectorRolActivo roles={rolesDisponibles} />;
      case "socios":
      case "aprobacion_socios":
        return <SociosWidget />;
      case "solicitud_socio":
        return (
          <EnlacePantalla
            texto="Ver Solicitudes de Socios"
            descripcion="Revisión y procesamiento de formularios de postulación a socio profesional."
            ruta="/panel/solicitud-socio"
            color="#05876E"
          />
        );
      case "configuracion_contrato_abogado":
      case "contrato_socios":
        return <ConfiguracionContratoAbogadoWidget />;
      case "auditoria":
        return <VisorAuditoriaWidget negocio={negocio} />;
      case "financiamiento":
      case "proximamente":
        return <WidgetProximamente moduloClave={wClave} />;
      default:
        return (
          <WidgetProximamente
            moduloClave={wClave}
            titulo={INVENTARIO_GLOBAL_WIDGETS[wClave]?.titulo || `Módulo: ${wClave.toUpperCase()}`}
            subtitulo={
              INVENTARIO_GLOBAL_WIDGETS[wClave]?.subtitulo ||
              "Estamos trabajando en ello. Próximamente estará disponible esta funcionalidad en tu panel."
            }
          />
        );
    }
  };

  const widgetActivoDef = widgetActivo ? INVENTARIO_GLOBAL_WIDGETS[widgetActivo] : null;
  const esPanelRestringidoParaCliente =
    (rolInicial || "CLIENTE").toUpperCase() === "CLIENTE" &&
    (slug === "clientes" || slug === "empresas");

  const handleCerrarWidget = () => {
    if (esPanelRestringidoParaCliente && typeof window !== "undefined") {
      window.location.href = "/panel";
      return;
    }
    cerrar();
  };

  if (widgetActivo) {
    return (
      <div style={{ width: "100%", animation: "fadeIn 0.15s ease" }}>
        <section className="tarjeta-seccion" style={{ background: "#ffffff", borderRadius: "16px", overflow: "hidden", width: "100%", border: "1px solid #E4E4E4" }}>
          <header style={{ padding: "16px 20px", background: "#F7F6FA", borderBottom: "1px solid #E4E4E4", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <BotonVolverWidget
                onClick={handleCerrarWidget}
                destino={esPanelRestringidoParaCliente ? "Inicio" : (panelInfo.nombre || "el panel")}
              />
              <div>
                <h2 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#111" }}>
                  {widgetActivoDef?.titulo || widgetActivo.toUpperCase()}
                </h2>
                <p style={{ fontSize: "0.78rem", color: "#666", margin: 0 }}>
                  {widgetActivoDef?.subtitulo || `Panel ${panelInfo.nombre}`}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              {/* Botón Compartir Módulo y Parámetros URL */}
              <button
                type="button"
                onClick={() => handleCompartirModulo(widgetActivo)}
                className="btn-responsive-accion"
                style={{
                  background: copiadoModulo ? "#ECFDF5" : "#ffffff",
                  border: copiadoModulo ? "1px solid #10B981" : "1px solid #CBD5E1",
                  color: copiadoModulo ? "#047857" : "#334155",
                  padding: "7px 14px",
                  borderRadius: "20px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.2s ease",
                }}
                title="Copiar enlace directo con los parámetros de este módulo"
                aria-label="Compartir enlace directo a este módulo"
              >
                {copiadoModulo ? <CheckCircle2 size={14} color="#10B981" /> : <Share2 size={14} />}
                <span className="btn-texto-responsive">{copiadoModulo ? "¡Copiado!" : "Compartir Módulo"}</span>
              </button>
            </div>
          </header>
          <div style={{ padding: "24px" }}>
            {renderWidgetComponente(widgetActivo)}
          </div>
        </section>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "24px", width: "100%" }}>
      {/* BANNER PRINCIPAL DEL PANEL DINÁMICO */}
      <section
        style={{
          background: "linear-gradient(135deg, var(--violeta, #5000BA) 0%, #3B0087 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          color: "#ffffff",
          boxShadow: "0 10px 25px rgba(80, 0, 186, 0.18)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "8px" }}>
            <LayoutGrid size={24} color="#F59E0B" />
            <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "20px" }}>
              CONSOLA OPERATIVA DINÁMICA
            </span>
          </div>
          <h1 style={{ fontSize: "1.6rem", fontWeight: 900, margin: "0 0 6px 0", letterSpacing: "-0.02em" }}>
            {panelInfo.nombre}
          </h1>
          <p style={{ fontSize: "0.88rem", opacity: 0.9, margin: 0, maxWidth: "680px" }}>
            {panelInfo.descripcion}
          </p>
        </div>

        <div>
          <button
            type="button"
            onClick={() => handleCompartirModulo(null)}
            className="btn-responsive-accion"
            style={{
              background: copiadoModulo ? "#10B981" : "rgba(255,255,255,0.2)",
              border: "1px solid rgba(255,255,255,0.3)",
              color: "#ffffff",
              padding: "8px 16px",
              borderRadius: "20px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              backdropFilter: "blur(8px)",
              transition: "all 0.2s ease",
            }}
            title="Compartir enlace de este panel"
            aria-label="Compartir enlace del panel"
          >
            {copiadoModulo ? <CheckCircle2 size={15} /> : <Share2 size={15} />}
            <span className="btn-texto-responsive">{copiadoModulo ? "¡Copiado!" : "Compartir Panel"}</span>
          </button>
        </div>
      </section>

      {/* SECCIÓN WIDGETS ASIGNADOS AL PANEL */}
      <section>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px" }}>
          <h2 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#737373", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>
            MÓDULOS DE {panelInfo.nombre.toUpperCase()} ASIGNADOS
          </h2>
          <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--violeta, #5000BA)", background: "#F3E8FF", padding: "4px 10px", borderRadius: "12px" }}>
            {widgetsAsignados.length} Módulos Activos
          </span>
        </div>

        {widgetsAsignados.length === 0 ? (
          <div style={{ padding: "40px", textAlign: "center", background: "#ffffff", borderRadius: "16px", border: "1.5px dashed #E4E4E4" }}>
            <Wrench size={32} color="#9CA3AF" style={{ marginBottom: "12px" }} />
            <h3 style={{ fontSize: "1rem", fontWeight: 800, color: "#374151", margin: "0 0 6px 0" }}>
              No hay módulos asignados a este panel
            </h3>
            <p style={{ fontSize: "0.84rem", color: "#6B7280", margin: 0 }}>
              Asigna widgets a este panel desde la Matriz de Perfiles en la Consola de Administración.
            </p>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
            {widgetsAsignados.map((wClave) => {
              const def = INVENTARIO_GLOBAL_WIDGETS[wClave] || {
                titulo: wClave.toUpperCase(),
                subtitulo: `Módulo operativo ${wClave}`,
                icono: LayoutGrid,
                colorIcono: "var(--violeta, #5000BA)",
                categoria: "Operación"
              };
              const IconoComp = def.icono;
              const infoCustom = getWidgetInfo(wClave, def.titulo, def.subtitulo, undefined, panelIdBuscado || slug);

              return (
                <div
                  key={wClave}
                  onClick={() => abrir(wClave)}
                  style={{
                    background: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid #E4E4E4",
                    padding: "20px",
                    cursor: "pointer",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between"
                  }}
                  className="tarjeta-modulo-hover"
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "14px" }}>
                      <div style={{ width: "42px", height: "42px", borderRadius: "12px", background: "#F7F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                        <IconoComp size={22} color={def.colorIcono} />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        {(esSuperAdmin || rolInicial === "SUPERADMIN" || rolInicial === "ADMINISTRADOR") && (
                          <button
                            type="button"
                            title={`Editar personalización de ${infoCustom.titulo} en ${panelInfo.nombre}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setWidgetEditar({
                                id: wClave,
                                titulo: infoCustom.titulo,
                                subtitulo: infoCustom.subtitulo,
                                iconoKey: infoCustom.iconoKey,
                                requiereMfa: infoCustom.requiereMfa,
                                tiempoMfaMinutos: infoCustom.tiempoMfaMinutos
                              });
                            }}
                            style={{
                              background: "none",
                              border: "none",
                              cursor: "pointer",
                              padding: "4px",
                              borderRadius: "6px",
                              color: "#9CA3AF",
                              display: "flex",
                              alignItems: "center"
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                        )}
                        <ChevronRight size={18} color="#9CA3AF" />
                      </div>
                    </div>
                    <h3 style={{ fontSize: "0.98rem", fontWeight: 800, color: "#111", margin: "0 0 6px 0" }}>
                      {infoCustom.titulo}
                    </h3>
                    <p style={{ fontSize: "0.82rem", color: "#666", margin: 0, lineHeight: 1.4 }}>
                      {infoCustom.subtitulo}
                    </p>
                  </div>
                  <div style={{ marginTop: "16px", paddingTop: "12px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#6B7280", textTransform: "uppercase" }}>
                      {def.categoria}
                    </span>
                    <span style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--violeta, #5000BA)" }}>
                      Abrir Módulo →
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Modal para Editar Título, Subtítulo, Ícono y MFA de Widget en este Panel */}
      {widgetEditar && (
        <ModalEditarWidget
          abierto={Boolean(widgetEditar)}
          onCerrar={() => setWidgetEditar(null)}
          widgetId={widgetEditar.id}
          tituloActual={widgetEditar.titulo}
          subtituloActual={widgetEditar.subtitulo}
          iconoActualKey={widgetEditar.iconoKey}
          requiereMfaActual={widgetEditar.requiereMfa}
          tiempoMfaActualMinutos={widgetEditar.tiempoMfaMinutos}
          panelId={panelIdBuscado || slug}
          onGuardar={(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos, pId) => {
            guardarWidget(id, nuevoTitulo, nuevoSubtitulo, nuevoIconoKey, nuevoRequiereMfa, nuevoTiempoMfaMinutos, pId || panelIdBuscado || slug);
            setWidgetEditar(null);
          }}
        />
      )}
    </div>
  );
}
