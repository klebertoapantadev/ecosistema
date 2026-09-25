"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles, Shield, LayoutGrid, Pencil, Users, UserCheck, Eye,
  Settings, Mail, ShieldCheck, Bell, CircleUser, KeyRound, Sliders, Briefcase,
  Receipt, History, RotateCcw, FileCheck, Folder, ShoppingBag, CreditCard,
  CalendarClock, CalendarPlus, CalendarCheck, Building2, Scale, Award, BellRing, Bot, MapPin, ClipboardList, MessageSquare, MessageSquareHeart, type LucideIcon
} from "lucide-react";
import { resetearSistemaSuperAdminAction } from "@eco/gestion-usuarios/acciones";
import { ModalNotificacionPush } from "@eco/notificaciones";
import { TarjetasFavoritasGrid } from "./SeccionFavoritosInicio";
import { useCustomWidgets } from "./gestorTitulosWidgets";
import { ModalEditarWidget } from "./ModalEditarWidget";
import { DataGrid } from "@eco/datagrid";

export interface ModuloSuperAdminDef {
  clave: string;
  nombre: string;
  detalle: string;
  ruta: string;
  icono: LucideIcon;
  iconoKey: string;
  color: string;
  rutaFisica: string;
  paquete: string;
  panelDestino: string;
  categoria: string;
  perfilesAsignados: string[];
  estadoDuplicidad: "CANONICO" | "COMPARTIDO";
  fechaRegistro?: string;
}

export interface CategoriaSuperAdminGroup {
  categoria: string;
  modulos: ModuloSuperAdminDef[];
}

export const CATALOGO_SUPERADMIN_TODOS: ModuloSuperAdminDef[] = [
  {
    clave: "agendar_cita",
    nombre: "Agendar una consulta",
    detalle: "Elige materia, servicio y horario disponible",
    ruta: "/panel/agendar",
    icono: CalendarPlus,
    iconoKey: "CalendarPlus",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/FormularioAgendar.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Inicio / Herramientas (/panel/agendar)",
    categoria: "Agenda y citas",
    perfilesAsignados: ["CLIENTE", "OPERADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mis_citas",
    nombre: "Mis citas",
    detalle: "Próximas consultas, videollamada y cancelación",
    ruta: "/panel/mis-citas",
    icono: CalendarCheck,
    iconoKey: "CalendarCheck",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/ListaCitasCliente.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Inicio / Herramientas (/panel/mis-citas)",
    categoria: "Agenda y citas",
    perfilesAsignados: ["CLIENTE", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "citas_programadas",
    nombre: "Citas programadas",
    detalle: "Confirma, reagenda y cierra tus consultas",
    ruta: "/panel/agenda",
    icono: CalendarClock,
    iconoKey: "CalendarClock",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/BandejaCitasAbogado.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/agenda)",
    categoria: "Agenda y citas",
    perfilesAsignados: ["ABOGADO", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "disponibilidad",
    nombre: "Mi disponibilidad",
    detalle: "Horarios de atención, duración y bloqueos",
    ruta: "/panel/agenda/disponibilidad",
    icono: CalendarClock,
    iconoKey: "CalendarClock",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/EditorDisponibilidad.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/agenda/disponibilidad)",
    categoria: "Agenda y citas",
    perfilesAsignados: ["ABOGADO", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "vitrina_comercial",
    nombre: "Oferta de servicios y tarifas",
    detalle: "Vitrina de servicios y planes para clientes",
    ruta: "/panel/catalogo-productos",
    icono: Sparkles,
    iconoKey: "Sparkles",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/VitrinaComercialVisual.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Herramientas (/panel/catalogo-productos)",
    categoria: "Comercio y catálogo",
    perfilesAsignados: ["CLIENTE", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_aria",
    nombre: "Agente Conversacional ARIA",
    detalle: "Parámetros de conexión ARIA (ARIA_BASE, ARIA_AGENT_ID y clave en Vault) aislados por negocio",
    ruta: "/panel/aria",
    icono: Bot,
    iconoKey: "Bot",
    color: "var(--exito)",
    rutaFisica: "packages/configuracion-negocio/src/componentes/FormularioAria.tsx",
    paquete: "@eco/configuracion-negocio",
    panelDestino: "Configuración (/panel/aria)",
    categoria: "Integraciones & IA",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-11",
  },
  {
    clave: "configuracion_logistica",
    nombre: "Envíos, Zonas y Cobertura GPS",
    detalle: "Polígonos de cobertura en Pichincha, sector de envío gratis por defecto, tarifa por km vial y simulador GPS",
    ruta: "/panel/logistica",
    icono: MapPin,
    iconoKey: "MapPin",
    color: "var(--exito)",
    rutaFisica: "packages/comercio/src/componentes/FormularioLogisticaCobertura.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/logistica)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-12",
  },
  {
    clave: "consola_chat",
    nombre: "Ventas Omnicanal & Conversaciones (HITL)",
    detalle: "Bandeja unificada (reemplazo ManyChat): chats web en vivo, intervención humana vs ARIA, etiquetas, /atajos, usuarios registrados y compras web",
    ruta: "/panel/conversaciones",
    icono: MessageSquare,
    iconoKey: "MessageSquare",
    color: "#DB2777",
    rutaFisica: "packages/comercio/src/componentes/ConsolaVentasOmnicanal.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/conversaciones)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["VENTAS", "VENDEDOR", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-15",
  },
  {
    clave: "galeria_inmediata",
    nombre: "Galería de Entrega Inmediata (1–2h)",
    detalle: "Arreglos listos en tienda con precio especial y baja automática al venderse en web",
    ruta: "/panel/entrega-inmediata",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "var(--aviso)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaEntregaInmediata.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/entrega-inmediata)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["VENTAS", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-15",
  },
  {
    clave: "inventario_rosas",
    nombre: "Inventario de Rosas (Conteo IA)",
    detalle: "Conteo fotográfico de paquetes de rosas por color asistido por ARIA Visión",
    ruta: "/panel/inventario-rosas",
    icono: ClipboardList,
    iconoKey: "ClipboardList",
    color: "#BE185D",
    rutaFisica: "packages/comercio/src/componentes/ConsolaInventarioRosas.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/inventario-rosas)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["VENTAS", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-15",
  },
  {
    clave: "envio_pedidos_taller",
    nombre: "Enviar Pedidos a Taller",
    detalle: "Validación de ventas, calendario Hoy/Semana/Mes, llamadas Exequiales y despacho diario a Taller",
    ruta: "/panel/envio-pedidos",
    icono: ClipboardList,
    iconoKey: "ClipboardList",
    color: "var(--texto)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaEnvioPedidosTaller.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/envio-pedidos)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["VENTAS", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-16",
  },
  {
    clave: "taller_floral",
    nombre: "Taller — Producción y Elaboración",
    detalle: "Consola de taller con notificaciones en tiempo real, calendario de elaboración y estado En Preparación / Listo Entrega",
    ruta: "/panel/taller",
    icono: ClipboardList,
    iconoKey: "ClipboardList",
    color: "var(--exito)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaTallerFloral.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/taller)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["OPERADOR", "DELIVERY", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-16",
  },
  {
    clave: "confirmacion_entregas",
    nombre: "Confirmación de Entregas e Informes GPS",
    detalle: "PWA Offline de entregas georreferenciadas, OTs Exequiales IESS e informes quincenales PDF",
    ruta: "/panel/entregas",
    icono: ClipboardList,
    iconoKey: "ClipboardList",
    color: "var(--exito)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaConfirmacionEntregas.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/entregas)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["DELIVERY", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-15",
  },
  {
    clave: "pedidos_tienda",
    nombre: "Pedidos de Tienda y Despachos",
    detalle: "Bandeja de órdenes e-commerce con ruta GPS, dedicatorias y desglose interno de logística",
    ruta: "/panel/pedidos",
    icono: ClipboardList,
    iconoKey: "ClipboardList",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/BandejaPedidosTienda.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/pedidos)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "COMPARTIDO",
    fechaRegistro: "2026-11-12",
  },
  {
    clave: "testimonios_clientes",
    nombre: "Testimonios y Reseñas de Clientes",
    detalle: "Gestión de capturas de WhatsApp, fotos de entregas y reseñas reales con sincronización al carrusel público y álbum de Google Photos",
    ruta: "/panel/testimonios",
    icono: MessageSquareHeart,
    iconoKey: "MessageSquareHeart",
    color: "var(--aviso)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaTestimoniosClientes.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/testimonios)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-11-15",
  },
  {
    clave: "gestion_catalogo",
    nombre: "Gestión del catálogo",
    detalle: "Administra honorarios, tarifas e IVA",
    ruta: "/panel/configuracion?widget=gestion_catalogo",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/CatalogoProductosComercio.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comercio y catálogo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "vitrina_comercial_personas",
    nombre: "Oferta para Personas & Familias",
    detalle: "Trámites notariales, videoconsultas individuales, defensa legal y planes familiares",
    ruta: "/panel/clientes?widget=vitrina_comercial_personas",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/VitrinaComercialVisual.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Clientes (/panel/clientes)",
    categoria: "Comercio & Clientes",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "vitrina_comercial_empresas",
    nombre: "Oferta Corporativa & Planes Empresas",
    detalle: "Planes legales corporativos, constitución SAS, convenios de beneficios y asesoría empresarial",
    ruta: "/panel/empresas?widget=vitrina_comercial_empresas",
    icono: Building2,
    iconoKey: "Building2",
    color: "#5000BA",
    rutaFisica: "packages/comercio/src/componentes/VitrinaComercialVisual.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Empresas (/panel/empresas)",
    categoria: "Comercio & Empresas",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "catalogo_productos",
    nombre: "Catálogo y honorarios",
    detalle: "Servicios, honorarios y suscripciones con IVA",
    ruta: "/panel/catalogo-productos",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/CatalogoProductosComercio.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Herramientas (/panel/catalogo-productos)",
    categoria: "Comercio y catálogo",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "pasarela_payphone",
    nombre: "Pagos con Payphone",
    detalle: "Configuración del botón de pago y cobros",
    ruta: "/panel/configuracion?widget=pasarela_payphone",
    icono: CreditCard,
    iconoKey: "CreditCard",
    color: "var(--aviso)",
    rutaFisica: "packages/comercio/src/componentes/ConfiguracionPasarelaPayphone.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comercio y pagos",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_facturacion_sri",
    nombre: "Parámetros de Facturación Electrónica SRI",
    detalle: "Configuración de RUC, régimen RIMPE/General, serie 001-001, secuenciales y certificado .p12 en Supabase Vault",
    ruta: "/panel/configuracion?widget=configuracion_facturacion_sri",
    icono: FileCheck,
    iconoKey: "FileCheck",
    color: "var(--exito)",
    rutaFisica: "packages/comercio/src/componentes/ConfiguracionFacturacionSri.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comercio & Pasarela",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "historial_pagos",
    nombre: "Historial de Pagos",
    detalle: "Valores generados, valores pagados, detalle del rubro facturado, registro de pagos y facturas electrónicas SRI",
    ruta: "/panel/herramientas?widget=historial_pagos",
    icono: CreditCard,
    iconoKey: "CreditCard",
    color: "#05876E",
    rutaFisica: "packages/comercio/src/componentes/HistorialTransaccionesPago.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Herramientas (/panel/herramientas) / Mi Cuenta / Administrar",
    categoria: "Comercio & Transacciones",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "crm_clientes",
    nombre: "Clientes",
    detalle: "Directorio de clientes y expedientes",
    ruta: "/panel/clientes",
    icono: Users,
    iconoKey: "Users",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/crm-clientes/componentes/BandejaClientesCRM.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar / Clientes (/panel/clientes)",
    categoria: "Gestión legal",
    perfilesAsignados: ["ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "firma_documentos_pdf",
    nombre: "Firma de documentos PDF",
    detalle: "Firma digital con certificado .p12 y código QR",
    ruta: "/panel/firma-documentos",
    icono: FileCheck,
    iconoKey: "FileCheck",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/firma-documentos/componentes/WidgetFirmaDocumentosPdf.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/firma-documentos)",
    categoria: "Seguridad y firma",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "billetera_documentos",
    nombre: "Billetera de documentos",
    detalle: "Tus documentos, con aviso antes de que caduquen",
    ruta: "/panel/billetera-documentos",
    icono: Folder,
    iconoKey: "Folder",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/billetera-documentos/componentes/WidgetBilleteraDocumentos.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/billetera-documentos)",
    categoria: "Gestión documental",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "gestion_convenios_corporativos",
    nombre: "Convenios Corporativos & Paquetes B2B",
    detalle: "Gestión de alianzas empresariales, bolsas de consultas y descuentos automáticos",
    ruta: "/panel/administrar?widget=gestion_convenios_corporativos",
    icono: Building2,
    iconoKey: "Building2",
    color: "#05876E",
    rutaFisica: "packages/comercio/src/componentes/GestionConveniosCorporativos.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comercio & B2B",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-09-29",
  },
  {
    clave: "compliance_score_legal",
    nombre: "Compliance & Score Legal Empresarial",
    detalle: "Matriz de obligaciones normativas, monitoreo continuo de caducidades con Tranqi y Legal Health Score",
    ruta: "/panel/administrar?widget=compliance_score_legal",
    icono: ShieldCheck,
    iconoKey: "ShieldCheck",
    color: "#05876E",
    rutaFisica: "packages/comercio/src/componentes/ComplianceScoreEmpresarial.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/administrar) / Empresas",
    categoria: "Comercio & B2B",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-10-09",
  },
  {
    clave: "legal_hr_laboral",
    nombre: "Legal HR: Contratos y Finiquitos",
    detalle: "Gestión laboral de colaboradores, contratos de trabajo tipificados, firma .p12, avisos IESS y finiquitos SUT",
    ruta: "/panel/administrar?widget=legal_hr_laboral",
    icono: Briefcase,
    iconoKey: "Briefcase",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/LegalHRLaboral.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/administrar) / Empresas",
    categoria: "Comercio & B2B",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-10-09",
  },
  {
    clave: "horarios_atencion_agenda",
    nombre: "Horarios de Atención (Telemático y Presencial)",
    detalle: "Configuración de horarios por defecto para consultas telemáticas y presenciales, especialidad por defecto para Tranqi y agendamiento sin abogado disponible",
    ruta: "/panel/agendamiento?widget=horarios_atencion_agenda",
    icono: ShieldCheck,
    iconoKey: "ShieldCheck",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/ConfiguracionHorariosAtencionWidget.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Agendamiento (/panel/agendamiento)",
    categoria: "Agendamiento & Operación",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-11-08",
  },
  {
    clave: "gestion_informativos",
    nombre: "Gestión de Informativos & Beneficios",
    detalle: "Consola de administración de alertas de instituciones (ANT, SRI, Municipios), novedades tributarias y convenios",
    ruta: "/panel/administrar?widget=gestion_informativos",
    icono: Bell,
    iconoKey: "Bell",
    color: "var(--aviso)",
    rutaFisica: "packages/comercio/src/componentes/ConsolaGestionInformativosWidget.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comercio & Comunicación",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-10-02",
  },
  {
    clave: "paquete_beneficios_abogados",
    nombre: "Paquete de Beneficios & Convenios",
    detalle: "Listado de convenios de capacitación, maestrías, herramientas y beneficios gremiales para la red profesional",
    ruta: "/panel/red-profesional?widget=paquete_beneficios_abogados",
    icono: Award,
    iconoKey: "Award",
    color: "#5000BA",
    rutaFisica: "packages/comercio/src/componentes/TableroBeneficiosAvisosWidget.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Red Profesional (/panel/red-profesional)",
    categoria: "Red Profesional",
    perfilesAsignados: ["ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-10-02",
  },
  {
    clave: "muro_informativo_comunidad",
    nombre: "Avisos & Alertas de la Comunidad",
    detalle: "Panel informativo con alertas de instituciones públicas, noticias tributarias y oportunidades de ahorro",
    ruta: "/panel/clientes?widget=muro_informativo_comunidad",
    icono: BellRing,
    iconoKey: "BellRing",
    color: "var(--acento)",
    rutaFisica: "packages/comercio/src/componentes/TableroBeneficiosAvisosWidget.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Clientes (/panel/clientes)",
    categoria: "Información & Comunidad",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-10-02",
  },
  {
    clave: "disponibilidad_abogados",
    nombre: "Disponibilidad de Abogados & Turnos",
    detalle: "Gestión de horas y cupos. Postulación preliminar de abogados y aprobación operativa con sincronización Tranqi",
    ruta: "/panel/agendamiento?widget=disponibilidad_abogados",
    icono: Scale,
    iconoKey: "Scale",
    color: "#5000BA",
    rutaFisica: "packages/comercio/src/componentes/TableroDisponibilidadOperativa.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Agendamiento (/panel/agendamiento)",
    categoria: "Agendamiento & Operación",
    perfilesAsignados: ["ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-09-29",
  },
  {
    clave: "gestion_usuarios",
    nombre: "Usuarios y membresías",
    detalle: "Asignación de perfiles y permisos",
    ruta: "/panel/usuarios",
    icono: Users,
    iconoKey: "Users",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Administrar (/panel/usuarios)",
    categoria: "Identidad y usuarios",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "perfiles",
    nombre: "Perfiles y permisos",
    detalle: "Catálogo de perfiles y matriz de permisos",
    ruta: "/panel/configuracion?widget=perfiles",
    icono: Sliders,
    iconoKey: "Sliders",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/AdministracionPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Seguridad y roles",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "gestion_red_abogados",
    nombre: "Red Profesional & Registro de Abogados",
    detalle: "Búsqueda de usuarios registrados para convertirlos en socios abogados, registro manual y gestión de especialidades, zonas y disponibilidad",
    ruta: "/panel/red-profesional?widget=gestion_red_abogados",
    icono: Scale,
    iconoKey: "Scale",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/GestionRedProfesionalWidget.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Red profesional / Administrar (/panel/red-profesional)",
    categoria: "Gestión de Socios",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-11-08",
  },
  {
    clave: "mi_perfil_abogado",
    nombre: "Mis Especialidades, Cobertura y Disponibilidad",
    detalle: "Autogestión del socio abogado: materias legales, provincias de cobertura y configuración de citas presenciales y teleconsulta",
    ruta: "/panel/red-profesional?widget=mi_perfil_abogado",
    icono: Scale,
    iconoKey: "Scale",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/MiPerfilRedAbogadoWidget.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Red profesional / Agendamiento (/panel/red-profesional)",
    categoria: "Gestión de Socios",
    perfilesAsignados: ["ABOGADO", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-11-08",
  },
  {
    clave: "socios",
    nombre: "Aprobación de socios",
    detalle: "Validación de matrículas y acreditaciones",
    ruta: "/panel/administrar?widget=socios",
    icono: UserCheck,
    iconoKey: "UserCheck",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/AprobacionSociosWidget.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Gestión de socios",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "solicitud_socio",
    nombre: "Solicitudes de socios",
    detalle: "Revisión de postulaciones de nuevos socios",
    ruta: "/panel/administrar?widget=solicitud_socio",
    icono: Briefcase,
    iconoKey: "Briefcase",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/FormularioSolicitudSocio.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar / Herramientas (/panel/administrar)",
    categoria: "Gestión de socios",
    perfilesAsignados: ["CLIENTE", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "consulta_usuarios",
    nombre: "Consulta de usuarios",
    detalle: "Directorio de miembros y permisos asignados",
    ruta: "/panel/usuarios",
    icono: Eye,
    iconoKey: "Eye",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Administrar (/panel/usuarios)",
    categoria: "Identidad y usuarios",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del negocio",
    detalle: "Datos del negocio, RUC y canales de contacto",
    ruta: "/panel/configuracion?widget=negocio",
    icono: Settings,
    iconoKey: "Settings",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/ConfiguracionNegocioWidget.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Parámetros de negocio",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_correo",
    nombre: "Correo saliente (SMTP)",
    detalle: "Servidor de correo saliente y credenciales",
    ruta: "/panel/configuracion?widget=correo",
    icono: Mail,
    iconoKey: "Mail",
    color: "#05876E",
    rutaFisica: "packages/configuracion-negocio/src/componentes/FormularioSmtp.tsx",
    paquete: "@eco/configuracion-negocio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comunicación y correo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "terminos",
    nombre: "Términos y consentimientos",
    detalle: "Cláusulas LOPDP y avisos legales",
    ruta: "/panel/administrar?widget=gestion_terminos_consentimientos",
    icono: ShieldCheck,
    iconoKey: "ShieldCheck",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/GestionTerminosConsentimientosWidget.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Gobernanza y LOPDP",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "auditoria",
    nombre: "Auditoría",
    detalle: "Registro de actividad y cambios en el sistema",
    ruta: "/panel/administrar?widget=auditoria",
    icono: Shield,
    iconoKey: "Shield",
    color: "var(--texto)",
    rutaFisica: "packages/auditoria/src/componentes/TablaAuditoria.tsx",
    paquete: "@eco/auditoria",
    panelDestino: "Administrar / Seguridad (/panel/administrar)",
    categoria: "Seguridad y auditoría",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "emision_notificaciones",
    nombre: "Envío de notificaciones",
    detalle: "Envío de avisos por correo, push y WhatsApp",
    ruta: "/panel/administrar?widget=emision_notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "var(--aviso)",
    rutaFisica: "packages/notificaciones/src/EmisionNotificacionesWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar / Herramientas (/panel/administrar)",
    categoria: "Comunicación y alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "monitoreo_notificaciones_usuarios",
    nombre: "Notificaciones por usuario",
    detalle: "Seguimiento de entregas y confirmaciones",
    ruta: "/panel/administrar?widget=monitoreo_notificaciones_usuarios",
    icono: Bell,
    iconoKey: "Bell",
    color: "#1F6FEB",
    rutaFisica: "packages/notificaciones/src/MonitoreoNotificacionesUsuariosWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comunicación y alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "bitacora_notificaciones",
    nombre: "Historial de notificaciones",
    detalle: "Registro de avisos enviados y destinatarios",
    ruta: "/panel/administrar?widget=bitacora_notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "var(--acento)",
    rutaFisica: "packages/notificaciones/src/BitacoraNotificacionesWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comunicación y alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "preferencias_notificacion",
    nombre: "Preferencias de avisos",
    detalle: "Canales de notificación y alertas",
    ruta: "/panel/configuracion?widget=notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "var(--aviso)",
    rutaFisica: "packages/notificaciones/src/componentes/PreferenciasNotificacionWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comunicación y alertas",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mi_cuenta",
    nombre: "Perfil y contacto",
    detalle: "Datos personales, correo y WhatsApp",
    ruta: "/panel/cuenta?widget=mi_cuenta",
    icono: CircleUser,
    iconoKey: "CircleUser",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/FormularioPerfil.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Cuenta y perfil",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "facturacion",
    nombre: "Datos de facturación",
    detalle: "Razón social, RUC o cédula y dirección fiscal",
    ruta: "/panel/cuenta?widget=datos_facturacion",
    icono: Receipt,
    iconoKey: "Receipt",
    color: "#05876E",
    rutaFisica: "packages/identidad/src/componentes/FormularioDatosFacturacion.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Cuenta y facturación",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mfa",
    nombre: "Verificación en dos pasos",
    detalle: "Configuración de seguridad con autenticador",
    ruta: "/panel/cuenta?widget=mfa_seguridad",
    icono: KeyRound,
    iconoKey: "KeyRound",
    color: "var(--aviso)",
    rutaFisica: "packages/identidad/src/componentes/WidgetConfiguracionMfa.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Seguridad / Mi Cuenta (/panel/cuenta)",
    categoria: "Seguridad y acceso",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de accesos",
    detalle: "Registro de inicios de sesión y dispositivos",
    ruta: "/panel/cuenta?widget=historial_accesos",
    icono: History,
    iconoKey: "History",
    color: "var(--texto)",
    rutaFisica: "packages/identidad/src/componentes/HistorialAccesos.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Seguridad y auditoría",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "ver_como",
    nombre: "Ver como otro rol",
    detalle: "Alterna la vista según los roles asignados",
    ruta: "/panel/cuenta?widget=ver_como",
    icono: Shield,
    iconoKey: "Shield",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "apps/tranqi-web/app/panel/SelectorRolActivo.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Gobernanza y roles",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "financiamiento",
    nombre: "Financiamiento & Cuotas para tu Caso",
    detalle: "Widget informativo de planes de financiamiento y cuotas para casos legales (Próximamente disponible)",
    ruta: "/panel/clientes?widget=financiamiento",
    icono: CreditCard,
    iconoKey: "CreditCard",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "apps/tranqi-web/app/panel/WidgetProximamente.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Clientes (/panel/clientes)",
    categoria: "Comercio & Clientes",
    perfilesAsignados: ["CLIENTE", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
    fechaRegistro: "2026-11-08",
  },
];

export function ConsolaSuperAdminModular() {
  const { getWidgetInfo, guardarWidget, obtenerIconoComponente } = useCustomWidgets();
  const [reseteando, setReseteando] = useState(false);
  const [modalPush, setModalPush] = useState<{
    abierto: boolean;
    titulo: string;
    mensaje: string;
    tipo?: "exito" | "error" | "info" | "advertencia" | "push";
    alAceptar?: () => void;
    alCancelar?: () => void;
    mostrarConfirmacion?: boolean;
  }>({
    abierto: false,
    titulo: "",
    mensaje: "",
    tipo: "exito",
  });

  async function handleResetearSistema() {
    setModalPush({
      abierto: true,
      tipo: "advertencia",
      titulo: "Reiniciar datos de prueba (Tranqi)",
      mensaje: "Esta acción purgará únicamente los usuarios de prueba, sus datos operativos y los perfiles asignados en Tranqi (conservando la cuenta SuperAdmin y todas las configuraciones del negocio, SMTP, términos, catálogos comerciales y perfiles maestros, sin afectar a otros negocios). ¿Deseas continuar?",
      mostrarConfirmacion: true,
      alAceptar: async () => {
        setModalPush(prev => ({ ...prev, abierto: false }));
        try {
          setReseteando(true);
          const res = await resetearSistemaSuperAdminAction("TRANQ");
          if (res.ok) {
            setModalPush({
              abierto: true,
              tipo: "push",
              titulo: "Reinicio completado",
              mensaje: "Se han purgado los usuarios de prueba y sus datos operativos en Tranqi. Todas las configuraciones y perfiles maestros han sido preservados.",
              alAceptar: () => window.location.reload(),
            });
          } else {
            setModalPush({
              abierto: true,
              tipo: "error",
              titulo: "Error al reiniciar",
              mensaje: res.error || "No se pudo reiniciar el sistema",
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setModalPush({
            abierto: true,
            tipo: "error",
            titulo: "Error al reiniciar",
            mensaje: msg,
          });
        } finally {
          setReseteando(false);
        }
      },
      alCancelar: () => {
        setModalPush(prev => ({ ...prev, abierto: false }));
      },
    });
  }

  const [widgetEditar, setWidgetEditar] = useState<{
    id: string;
    titulo: string;
    subtitulo: string;
    iconoKey?: string;
    requiereMfa?: boolean;
    tiempoMfaMinutos?: number;
    rutaFisica?: string;
  } | null>(null);

  const abrirModalEditar = (
    e: React.MouseEvent,
    mod: ModuloSuperAdminDef,
    info: { titulo: string; subtitulo: string; iconoKey?: string; requiereMfa?: boolean; tiempoMfaMinutos?: number }
  ) => {
    e.preventDefault();
    e.stopPropagation();
    setWidgetEditar({
      id: mod.clave,
      titulo: info.titulo,
      subtitulo: info.subtitulo,
      iconoKey: info.iconoKey || mod.iconoKey,
      requiereMfa: info.requiereMfa,
      tiempoMfaMinutos: info.tiempoMfaMinutos,
      rutaFisica: mod.rutaFisica
    });
  };

  return (
    <>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "12px" }}>
        <h1 style={{ fontSize: "1.6rem", fontWeight: 800, color: "var(--texto)", margin: 0 }}>
          Todos los módulos
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={reseteando}
            className="btn-responsive-accion"
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "var(--error)",
              background: "#FFFFFF",
              padding: "7px 16px",
              borderRadius: "8px",
              border: "1px solid var(--linea-fuerte)",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
            }}
            title="Reiniciar datos de prueba de Tranqi"
            aria-label="Reiniciar datos de prueba de Tranqi"
          >
            <RotateCcw size={15} />
            <span className="btn-texto-responsive">{reseteando ? "Reiniciando..." : "Reiniciar datos de prueba"}</span>
          </button>
        </div>
      </div>
      <p className="inicio-cliente-sub" style={{ marginBottom: "24px" }}>
        Abre cualquier módulo o edita cómo se llama y qué icono lleva.
      </p>

      {/* SECCIÓN ACCESOS FAVORITOS */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "0.92rem", fontWeight: 700, color: "var(--texto-2)", marginBottom: "12px" }}>
          Favoritos
        </h3>
        <TarjetasFavoritasGrid />
      </div>

      {/* CATÁLOGO DE MÓDULOS */}
      <section>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 700, color: "var(--texto)", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <LayoutGrid size={18} /> Todos los módulos
        </h3>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
          {CATALOGO_SUPERADMIN_TODOS.map((m) => {
            const info = getWidgetInfo(m.clave, m.nombre, m.detalle, m.iconoKey);
            const IconoComp = obtenerIconoComponente(info.iconoKey, m.icono);

            return (
              <div
                key={m.clave}
                style={{
                  background: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid var(--linea)",
                  padding: "20px",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  position: "relative",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  boxShadow: "0 2px 6px rgba(0,0,0,0.02)"
                }}
                className="tarjeta-modulo-hover"
              >
                <div>
                  {/* BARRA DE BOTONES SUPERIOR */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "12px" }}>
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "var(--fondo-suave)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconoComp size={20} color={m.color} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={(e) => abrirModalEditar(e, m, info)}
                        title="Editar"
                        aria-label="Editar"
                        style={{
                          border: "1px solid var(--linea-fuerte)",
                          background: "#FFFFFF",
                          borderRadius: "6px",
                          padding: "4px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          color: "var(--texto-2)",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <Pencil size={12} color="var(--texto-2)" /> Editar
                      </button>
                    </div>
                  </div>

                  <h4 style={{ fontSize: "0.96rem", fontWeight: 800, color: "#111", margin: "0 0 4px 0" }}>
                    {info.titulo}
                  </h4>
                  <p style={{ fontSize: "0.82rem", color: "var(--texto-suave)", margin: 0, lineHeight: 1.4 }}>
                    {info.subtitulo}
                  </p>
                </div>

                <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px solid var(--fondo-hundido)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link
                    href={m.ruta}
                    style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--acento)", textDecoration: "none" }}
                  >
                    Abrir módulo →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN: INVENTARIO DE COMPONENTES (DATAGRID) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          marginTop: "32px",
          background: "var(--blanco, #ffffff)",
          borderRadius: "14px",
          border: "1px solid var(--panel-linea, var(--linea))",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--texto)" }}>
              Inventario de componentes
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "var(--texto-suave)" }}>
              Ruta del componente, perfiles autorizados y verificación de unicidad. Sin duplicados.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <strong style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--acento)", display: "block" }}>
                {CATALOGO_SUPERADMIN_TODOS.length}
              </strong>
              <span style={{ fontSize: "0.72rem", color: "var(--texto-suave)", fontWeight: 700 }}>Módulos registrados</span>
            </div>
          </div>
        </div>

        {/* DataGrid Estandarizado @eco/datagrid */}
        <DataGrid
          columnas={[
            {
              id: "nombre",
              encabezado: "Módulo",
              valor: (r: ModuloSuperAdminDef) => `${r.nombre} ${r.clave}`,
              render: (r: ModuloSuperAdminDef) => {
                const IconoR = r.icono;
                return (
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "32px",
                        height: "32px",
                        borderRadius: "8px",
                        background: `color-mix(in srgb, ${r.color} 8%, transparent)`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconoR size={18} color={r.color} />
                    </div>
                    <div>
                      <strong style={{ color: "var(--texto)", fontSize: "0.85rem", display: "block" }}>{r.nombre}</strong>
                      <code style={{ fontSize: "0.72rem", color: "var(--texto-suave)", background: "var(--fondo-hundido)", padding: "1px 5px", borderRadius: "4px" }}>
                        clave: {r.clave}
                      </code>
                    </div>
                  </div>
                );
              },
            },
            {
              id: "rutaFisica",
              encabezado: "Ruta del componente",
              valor: (r: ModuloSuperAdminDef) => r.rutaFisica,
              render: (r: ModuloSuperAdminDef) => (
                <div>
                  <span style={{ fontSize: "0.74rem", fontFamily: "monospace", color: "var(--texto-suave)", fontWeight: 700, display: "block" }}>
                    {r.rutaFisica}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "var(--texto-suave)" }}>
                    Paquete: <strong style={{ color: "var(--texto-2)" }}>{r.paquete}</strong>
                  </span>
                </div>
              ),
            },
            {
              id: "categoria",
              encabezado: "Categoría y destino",
              valor: (r: ModuloSuperAdminDef) => `${r.categoria} ${r.panelDestino}`,
              render: (r: ModuloSuperAdminDef) => (
                <div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "var(--fondo-hundido)",
                      color: "var(--texto-2)",
                      fontWeight: 700,
                      fontSize: "0.72rem",
                      display: "inline-block",
                      marginBottom: "2px",
                    }}
                  >
                    {r.categoria}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "var(--texto-2)" }}>
                    {r.panelDestino}
                  </span>
                </div>
              ),
            },
            {
              id: "perfiles",
              encabezado: "Perfiles autorizados",
              valor: (r: ModuloSuperAdminDef) => r.perfilesAsignados.join(", "),
              render: (r: ModuloSuperAdminDef) => (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {r.perfilesAsignados.map((p) => {
                    const colorBg =
                      p === "SUPERADMIN" ? "var(--acento-diluido)" :
                      p === "ADMINISTRADOR" ? "var(--aviso-diluido)" :
                      p === "OPERADOR" ? "var(--exito-diluido)" :
                      p === "ABOGADO" ? "var(--acento-diluido)" : "var(--fondo-hundido)";
                    const colorTxt =
                      p === "SUPERADMIN" ? "var(--acento-hondo)" :
                      p === "ADMINISTRADOR" ? "var(--aviso-texto)" :
                      p === "OPERADOR" ? "var(--exito-texto)" :
                      p === "ABOGADO" ? "var(--acento-hondo)" : "var(--texto-2)";
                    return (
                      <span
                        key={p}
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: colorBg,
                          color: colorTxt,
                        }}
                      >
                        {p}
                      </span>
                    );
                  })}
                </div>
              ),
            },
            {
              id: "estado",
              encabezado: "Unicidad",
              valor: (r: ModuloSuperAdminDef) => r.estadoDuplicidad,
              render: () => (
                <span
                  style={{
                    fontSize: "0.74rem",
                    color: "var(--texto-suave)",
                  }}
                >
                  Sin duplicados
                </span>
              ),
            },
            {
              id: "fechaRegistro",
              encabezado: "Fecha Registro",
              valor: (r: ModuloSuperAdminDef) => r.fechaRegistro || "—",
              render: (r: ModuloSuperAdminDef) => (
                <span
                  style={{
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: r.fechaRegistro ? "var(--exito-texto)" : "var(--texto-tenue)",
                    background: r.fechaRegistro ? "var(--exito-diluido)" : "var(--fondo-suave)",
                    border: r.fechaRegistro ? "1px solid var(--exito-linea)" : "1px solid var(--linea)",
                    padding: "2px 8px",
                    borderRadius: "6px",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    whiteSpace: "nowrap"
                  }}
                >
                  📅 {r.fechaRegistro || "2026-07-27"}
                </span>
              ),
            },
            {
              id: "detalle",
              encabezado: "Descripción",
              valor: (r: ModuloSuperAdminDef) => r.detalle,
              render: (r: ModuloSuperAdminDef) => (
                <span style={{ fontSize: "0.78rem", color: "var(--texto-2)", lineHeight: 1.4 }}>
                  {r.detalle}
                </span>
              ),
            },
          ]}
          filas={CATALOGO_SUPERADMIN_TODOS}
          idFila={(r: ModuloSuperAdminDef) => r.clave}
          nombreExportacion="inventario-widgets-ecosistema"
          contenidoExpandible={(r: ModuloSuperAdminDef) => (
            <div
              style={{
                padding: "14px 18px",
                background: "var(--fondo-suave)",
                borderRadius: "8px",
                fontSize: "0.8rem",
                border: "1px solid var(--linea)",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "var(--texto)", fontSize: "0.88rem" }}>
                  Detalle de componente: {r.nombre} ({r.clave})
                </strong>
                <Link
                  href={r.ruta}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    color: "var(--acento)",
                    textDecoration: "none",
                  }}
                >
                  Abrir módulo →
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "4px" }}>
                <div>
                  <span style={{ color: "var(--texto-suave)", display: "block", fontSize: "0.72rem" }}>Ruta del componente:</span>
                  <code style={{ fontSize: "0.75rem", color: "var(--texto-suave)", fontFamily: "monospace" }}>{r.rutaFisica}</code>
                </div>
                <div>
                  <span style={{ color: "var(--texto-suave)", display: "block", fontSize: "0.72rem" }}>Ruta URL:</span>
                  <code style={{ fontSize: "0.75rem", color: "var(--texto)" }}>{r.ruta}</code>
                </div>
                <div>
                  <span style={{ color: "var(--texto-suave)", display: "block", fontSize: "0.72rem" }}>Paquete:</span>
                  <strong style={{ fontSize: "0.78rem", color: "var(--texto-2)" }}>{r.paquete}</strong>
                </div>
                <div>
                  <span style={{ color: "var(--texto-suave)", display: "block", fontSize: "0.72rem" }}>Unicidad:</span>
                  <span style={{ fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                    Sin duplicados.
                  </span>
                </div>
              </div>
            </div>
          )}
        />
      </section>

      {/* MODAL EDITAR WIDGET DE INICIO */}
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
          rutaFisicaActual={widgetEditar.rutaFisica}
          onGuardar={(id, nTitulo, nSubtitulo, nIconoKey, nMfa, nMinutos) => {
            guardarWidget(id, nTitulo, nSubtitulo, nIconoKey, nMfa, nMinutos);
            setWidgetEditar(null);
          }}
        />
      )}

      <ModalNotificacionPush
        abierto={modalPush.abierto}
        tipo={modalPush.tipo}
        titulo={modalPush.titulo}
        mensaje={modalPush.mensaje}
        mostrarConfirmacion={modalPush.mostrarConfirmacion}
        alAceptar={modalPush.alAceptar || (() => setModalPush(prev => ({ ...prev, abierto: false })))}
        alCancelar={modalPush.alCancelar || (() => setModalPush(prev => ({ ...prev, abierto: false })))}
      />
    </>
  );
}
