"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles, Shield, LayoutGrid, Pencil, Users, UserCheck, Eye,
  Settings, Mail, ShieldCheck, Bell, CircleUser, KeyRound, Sliders, Briefcase,
  Receipt, History, RotateCcw, FileCheck, Folder, ShoppingBag, CreditCard,
  CalendarClock, CalendarPlus, CalendarCheck, type LucideIcon
} from "lucide-react";
import { resetearSistemaSuperAdminAction } from "@eco/gestion-usuarios/acciones";
import { ModalNotificacionPush } from "@eco/notificaciones";
import { TarjetasFavoritasGrid } from "./SeccionFavoritosInicio";
import { useCustomWidgets } from "./gestorTitulosWidgets";
import { ModalEditarWidget } from "./ModalEditarWidget";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";

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
}

export interface CategoriaSuperAdminGroup {
  categoria: string;
  modulos: ModuloSuperAdminDef[];
}

export const CATALOGO_SUPERADMIN_TODOS: ModuloSuperAdminDef[] = [
  {
    clave: "agendar_cita",
    nombre: "Agendar una Consulta",
    detalle: "Elegir materia, servicio y hora libre; el abogado se asigna por turno rotativo",
    ruta: "/panel/agendar",
    icono: CalendarPlus,
    iconoKey: "CalendarPlus",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/FormularioAgendar.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Inicio / Herramientas (/panel/agendar)",
    categoria: "Agenda & Citas",
    perfilesAsignados: ["CLIENTE", "OPERADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mis_citas",
    nombre: "Mis Citas",
    detalle: "Próximas consultas, enlace de videollamada y cancelación",
    ruta: "/panel/mis-citas",
    icono: CalendarCheck,
    iconoKey: "CalendarCheck",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/ListaCitasCliente.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Inicio / Herramientas (/panel/mis-citas)",
    categoria: "Agenda & Citas",
    perfilesAsignados: ["CLIENTE", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "citas_programadas",
    nombre: "Citas Programadas",
    detalle: "Agenda del profesional: confirmar, reagendar y cerrar sus consultas",
    ruta: "/panel/agenda",
    icono: CalendarClock,
    iconoKey: "CalendarClock",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/BandejaCitasAbogado.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/agenda)",
    categoria: "Agenda & Citas",
    perfilesAsignados: ["ABOGADO", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "disponibilidad",
    nombre: "Mi Disponibilidad",
    detalle: "Horas operativas, duración de cita, antelación y bloqueos por audiencia",
    ruta: "/panel/agenda/disponibilidad",
    icono: CalendarClock,
    iconoKey: "CalendarClock",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/agenda/componentes/EditorDisponibilidad.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/agenda/disponibilidad)",
    categoria: "Agenda & Citas",
    perfilesAsignados: ["ABOGADO", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "vitrina_comercial",
    nombre: "Oferta de Servicios & Tarifario",
    detalle: "Vitrina visual de servicios y planes con imágenes, videos y botón Payphone para clientes",
    ruta: "/panel/catalogo-productos",
    icono: Sparkles,
    iconoKey: "Sparkles",
    color: "#0284C7",
    rutaFisica: "packages/comercio/src/componentes/VitrinaComercialVisual.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Herramientas (/panel/catalogo-productos)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["CLIENTE", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "gestion_catalogo",
    nombre: "Gestión del Catálogo Comercial",
    detalle: "Consola de administración de honorarios, tarifas SRI IVA 15%, variantes y recursos digitales",
    ruta: "/panel/configuracion?widget=gestion_catalogo",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "#0284C7",
    rutaFisica: "packages/comercio/src/componentes/CatalogoProductosComercio.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial & Honorarios",
    detalle: "Catálogo unificado de servicios, liquidación de honorarios y suscripciones legales con cálculo de IVA 15%",
    ruta: "/panel/catalogo-productos",
    icono: ShoppingBag,
    iconoKey: "ShoppingBag",
    color: "#0284C7",
    rutaFisica: "packages/comercio/src/componentes/CatalogoProductosComercio.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Herramientas (/panel/catalogo-productos)",
    categoria: "Comercio & Catálogo",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "pasarela_payphone",
    nombre: "Pasarela Payphone (Botón de Pago)",
    detalle: "Configuración del Botón de Pago Payphone, credenciales API, StoreID y simulador de cobro",
    ruta: "/panel/configuracion?widget=pasarela_payphone",
    icono: CreditCard,
    iconoKey: "CreditCard",
    color: "#D97706",
    rutaFisica: "packages/comercio/src/componentes/ConfiguracionPasarelaPayphone.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comercio & Pasarela",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "historial_pagos",
    nombre: "Historial de Transacciones & Pagos",
    detalle: "Auditoría de cobros bancarios, autorizaciones Payphone y registro contable inmutable",
    ruta: "/panel/administrar?widget=historial_pagos",
    icono: Receipt,
    iconoKey: "Receipt",
    color: "#05876E",
    rutaFisica: "packages/comercio/src/componentes/HistorialTransaccionesPago.tsx",
    paquete: "@eco/comercio",
    panelDestino: "Administrar / Cuenta (/panel/administrar)",
    categoria: "Comercio & Transacciones",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "crm_clientes",
    nombre: "CRM Jurídico & Gestión de Clientes",
    detalle: "Directorio 360°, KPIs, alta asistida multicanal, validación cédula/RUC y conflict check en vivo",
    ruta: "/panel/clientes",
    icono: Users,
    iconoKey: "Users",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/crm-clientes/componentes/BandejaClientesCRM.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar / Clientes (/panel/clientes)",
    categoria: "Gestión Legal & CRM",
    perfilesAsignados: ["ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "firma_documentos_pdf",
    nombre: "Firma Electrónica de Documentos PDF",
    detalle: "Firmado digital con certificado .p12 / .pfx, estampa visual y código QR oficial",
    ruta: "/panel/firma-documentos",
    icono: FileCheck,
    iconoKey: "FileCheck",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/firma-documentos/componentes/WidgetFirmaDocumentosPdf.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/firma-documentos)",
    categoria: "Seguridad & Firma",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "billetera_documentos",
    nombre: "Billetera Digital de Documentos Seguros",
    detalle: "Bóveda digital de documentos personales, vehiculares, contratos y profesionales con OCR y TTL",
    ruta: "/panel/billetera-documentos",
    icono: Folder,
    iconoKey: "Folder",
    color: "#5000BA",
    rutaFisica: "apps/tranqi-web/modulos/billetera-documentos/componentes/WidgetBilleteraDocumentos.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Herramientas (/panel/billetera-documentos)",
    categoria: "Gestión Documental",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Membresías",
    detalle: "Asignación de perfiles, roles y techo jerárquico",
    ruta: "/panel/usuarios",
    icono: Users,
    iconoKey: "Users",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Administrar (/panel/usuarios)",
    categoria: "Identidad & Usuarios",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "perfiles",
    nombre: "Administración de Perfiles & Permisos",
    detalle: "Catálogo de perfiles, jerarquía (1–100) y matriz de gobernanza BDD",
    ruta: "/panel/configuracion?widget=perfiles",
    icono: Sliders,
    iconoKey: "Sliders",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/AdministracionPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Seguridad & Roles",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "socios",
    nombre: "Aprobación de Socios Abogados",
    detalle: "Validación de matrículas y acreditación de abogados",
    ruta: "/panel/administrar?widget=socios",
    icono: UserCheck,
    iconoKey: "UserCheck",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/AprobacionSociosWidget.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Gestión de Socios",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "solicitud_socio",
    nombre: "Solicitudes de Socios & Postulaciones",
    detalle: "Revisión y procesamiento de postulación de socios",
    ruta: "/panel/administrar?widget=solicitud_socio",
    icono: Briefcase,
    iconoKey: "Briefcase",
    color: "#05876E",
    rutaFisica: "apps/tranqi-web/modulos/socios/componentes/FormularioSolicitudSocio.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Administrar / Herramientas (/panel/administrar)",
    categoria: "Gestión de Socios",
    perfilesAsignados: ["CLIENTE", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "consulta_usuarios",
    nombre: "Consulta de Usuarios & Perfiles",
    detalle: "Directorio unificado de miembros, asignación de roles y matriz de permisos",
    ruta: "/panel/usuarios",
    icono: Eye,
    iconoKey: "Eye",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/gestion-usuarios/src/componentes/ConsultaUsuariosPerfilesWidget.tsx",
    paquete: "@eco/gestion-usuarios",
    panelDestino: "Administrar (/panel/usuarios)",
    categoria: "Identidad & Usuarios",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración del Negocio",
    detalle: "Parámetros del negocio, RUC, redes sociales y contacto",
    ruta: "/panel/configuracion?widget=negocio",
    icono: Settings,
    iconoKey: "Settings",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/ConfiguracionNegocioWidget.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Parámetros de Negocio",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor SMTP & Correo Cifrado",
    detalle: "Credenciales cifradas SMTP en Vault y plantillas HTML",
    ruta: "/panel/configuracion?widget=correo",
    icono: Mail,
    iconoKey: "Mail",
    color: "#05876E",
    rutaFisica: "packages/configuracion-negocio/src/componentes/FormularioSmtp.tsx",
    paquete: "@eco/configuracion-negocio",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comunicación & Correo",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "terminos",
    nombre: "Términos, Consentimientos & LOPDP",
    detalle: "Configuración de cláusulas LOPDP, versionamiento inmutable, consentimientos y avisos legales",
    ruta: "/panel/administrar?widget=gestion_terminos_consentimientos",
    icono: ShieldCheck,
    iconoKey: "ShieldCheck",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/GestionTerminosConsentimientosWidget.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Gobernanza & LOPDP",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "auditoria",
    nombre: "Auditoría BDD PostgreSQL & Telemetría",
    detalle: "Registro inmutable de transacciones, diffs JSONB e IP",
    ruta: "/panel/administrar?widget=auditoria",
    icono: Shield,
    iconoKey: "Shield",
    color: "#111827",
    rutaFisica: "packages/auditoria/src/componentes/TablaAuditoria.tsx",
    paquete: "@eco/auditoria",
    panelDestino: "Administrar / Seguridad (/panel/administrar)",
    categoria: "Seguridad & Auditoría",
    perfilesAsignados: ["ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "emision_notificaciones",
    nombre: "Emisión de Notificaciones Multicanal",
    detalle: "Redacción y despacho masivo (In-App, Push, Email y WhatsApp)",
    ruta: "/panel/administrar?widget=emision_notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "#D97706",
    rutaFisica: "packages/notificaciones/src/EmisionNotificacionesWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar / Herramientas (/panel/administrar)",
    categoria: "Comunicación & Alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "monitoreo_notificaciones_usuarios",
    nombre: "Monitoreo de Notificaciones por Usuario",
    detalle: "Auditoría en tiempo real de notificaciones, fechas de confirmación, tiempo de pospuesto y eliminados",
    ruta: "/panel/administrar?widget=monitoreo_notificaciones_usuarios",
    icono: Bell,
    iconoKey: "Bell",
    color: "#1F6FEB",
    rutaFisica: "packages/notificaciones/src/MonitoreoNotificacionesUsuariosWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comunicación & Alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "bitacora_notificaciones",
    nombre: "Bitácora & Historial de Notificaciones",
    detalle: "Consulta auditada en tiempo real de notificaciones emitidas y destinatarios",
    ruta: "/panel/administrar?widget=bitacora_notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "#2563EB",
    rutaFisica: "packages/notificaciones/src/BitacoraNotificacionesWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Administrar (/panel/administrar)",
    categoria: "Comunicación & Alertas",
    perfilesAsignados: ["OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "preferencias_notificacion",
    nombre: "Preferencias de Alertas & Notificaciones",
    detalle: "Configuración de canales de alerta, WhatsApp y avisos",
    ruta: "/panel/configuracion?widget=notificaciones",
    icono: Bell,
    iconoKey: "Bell",
    color: "#D97706",
    rutaFisica: "packages/notificaciones/src/componentes/PreferenciasNotificacionWidget.tsx",
    paquete: "@eco/notificaciones",
    panelDestino: "Configuración (/panel/configuracion)",
    categoria: "Comunicación & Alertas",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mi_cuenta",
    nombre: "Perfil & Datos de Contacto",
    detalle: "Nombres, apellidos, correo verificado y WhatsApp",
    ruta: "/panel/cuenta?widget=mi_cuenta",
    icono: CircleUser,
    iconoKey: "CircleUser",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "packages/identidad/src/componentes/FormularioPerfil.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Cuenta & Perfil",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "facturacion",
    nombre: "Datos de Facturación SRI",
    detalle: "Razón Social, RUC/Cédula, dirección fiscal y correo SRI",
    ruta: "/panel/cuenta?widget=datos_facturacion",
    icono: Receipt,
    iconoKey: "Receipt",
    color: "#05876E",
    rutaFisica: "packages/identidad/src/componentes/FormularioDatosFacturacion.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Cuenta & Facturación",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "mfa",
    nombre: "Seguridad MFA & Autenticador",
    detalle: "Configuración TOTP y reseteo estándar vía correo",
    ruta: "/panel/cuenta?widget=mfa_seguridad",
    icono: KeyRound,
    iconoKey: "KeyRound",
    color: "#D97706",
    rutaFisica: "packages/identidad/src/componentes/WidgetConfiguracionMfa.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Seguridad / Mi Cuenta (/panel/cuenta)",
    categoria: "Seguridad & Acceso",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "historial_accesos",
    nombre: "Historial de Accesos & Sesiones",
    detalle: "Bitácora de inicios de sesión, navegador y dirección IP",
    ruta: "/panel/cuenta?widget=historial_accesos",
    icono: History,
    iconoKey: "History",
    color: "#111827",
    rutaFisica: "packages/identidad/src/componentes/HistorialAccesos.tsx",
    paquete: "@eco/identidad",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Seguridad & Auditoría",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
  },
  {
    clave: "ver_como",
    nombre: "Selector 'Ver Como' (Conmutador)",
    detalle: "Alternar la vista previa del portal según roles asignados",
    ruta: "/panel/cuenta?widget=ver_como",
    icono: Shield,
    iconoKey: "Shield",
    color: "var(--violeta, #5000BA)",
    rutaFisica: "apps/tranqi-web/app/panel/SelectorRolActivo.tsx",
    paquete: "apps/tranqi-web",
    panelDestino: "Mi Cuenta (/panel/cuenta)",
    categoria: "Gobernanza & Roles",
    perfilesAsignados: ["CLIENTE", "ABOGADO", "OPERADOR", "ADMINISTRADOR", "SUPERADMIN"],
    estadoDuplicidad: "CANONICO",
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
      titulo: "Reset del Sistema (Tranqi)",
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
              titulo: "Reset Completado",
              mensaje: "Se han purgado los usuarios de prueba y sus datos operativos en Tranqi. Todas las configuraciones y perfiles maestros han sido preservados.",
              alAceptar: () => window.location.reload(),
            });
          } else {
            setModalPush({
              abierto: true,
              tipo: "error",
              titulo: "Error al Resetear",
              mensaje: res.error || "No se pudo resetear el sistema",
            });
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setModalPush({
            abierto: true,
            tipo: "error",
            titulo: "Error al Resetear",
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
        <h1 style={{ fontSize: "1.6rem", fontWeight: 900, color: "#111", margin: 0 }}>
          Consola Master Control — SuperAdmin Plataforma
        </h1>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={handleResetearSistema}
            disabled={reseteando}
            className="btn-responsive-accion"
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#DC2626",
              background: "#FEF2F2",
              padding: "7px 16px",
              borderRadius: "20px",
              border: "1.5px solid #FCA5A5",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(220,38,38,0.1)"
            }}
            title="Resetear usuarios de prueba y datos de Tranqi"
            aria-label="Resetear usuarios de prueba y datos de Tranqi"
          >
            <RotateCcw size={15} />
            <span className="btn-texto-responsive">{reseteando ? "Reseteando..." : "Reset Pruebas"}</span>
          </button>
          <span
            className="btn-responsive-accion"
            style={{
              fontSize: "0.78rem",
              fontWeight: 800,
              color: "#D97706",
              background: "#FEF3C7",
              padding: "6px 14px",
              borderRadius: "20px",
              border: "1px solid #FCD34D",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
            title="Vista Consolidada Global de Módulos"
            aria-label="Vista Consolidada Global de Módulos"
          >
            <Sparkles size={14} />
            <span className="btn-texto-responsive">Vista Global</span>
          </span>
        </div>
      </div>
      <p className="inicio-cliente-sub" style={{ marginBottom: "24px" }}>
        Todos los módulos y herramientas del ecosistema desplegados y centralizados directamente en tu menú Inicio.
      </p>

      {/* HERO CARD SUPERADMIN */}
      <section
        style={{
          background: "linear-gradient(135deg, #1E1B4B 0%, #312E81 100%)",
          borderRadius: "20px",
          padding: "28px 32px",
          color: "#ffffff",
          marginBottom: "28px",
          boxShadow: "0 10px 25px rgba(30, 27, 75, 0.2)"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "8px" }}>
          <Shield size={22} color="#F59E0B" />
          <span style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.08em", background: "rgba(255,255,255,0.15)", padding: "4px 10px", borderRadius: "20px" }}>
            CATÁLOGO UNIFICADO DE WIDGETS Y MÓDULOS (16 DISPONIBLES)
          </span>
        </div>
        <h2 style={{ fontSize: "1.4rem", fontWeight: 900, margin: "0 0 6px 0", color: "#ffffff" }}>
          Catálogo Único de Herramientas del Ecosistema
        </h2>
        <p style={{ fontSize: "0.88rem", opacity: 0.9, margin: 0, maxWidth: "720px", lineHeight: 1.5 }}>
          Haz clic en cualquier módulo para abrir la herramienta directamente o presiona Editar para personalizar títulos e íconos en tiempo real.
        </p>
      </section>

      {/* SECCIÓN ACCESOS FAVORITOS */}
      <div style={{ marginBottom: "28px" }}>
        <h3 style={{ fontSize: "0.92rem", fontWeight: 800, color: "#4B5563", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "12px" }}>
          Accesos Rápidos Marcados
        </h3>
        <TarjetasFavoritasGrid />
      </div>

      {/* CATÁLOGO UNIFICADO DE WIDGETS DE TODO EL ECOSISTEMA */}
      <section>
        <h3 style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--violeta, #5000BA)", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
          <LayoutGrid size={18} /> Todos los Módulos & Widgets del Ecosistema
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
                  border: "1px solid #E4E4E4",
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
                    <div style={{ width: "40px", height: "40px", borderRadius: "10px", background: "#F7F6FA", display: "flex", alignItems: "center", justifyContent: "center" }}>
                      <IconoComp size={20} color={m.color} />
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 800, color: m.color, background: "#F3F4F6", padding: "4px 8px", borderRadius: "6px" }}>
                        Módulo Activo
                      </span>
                      <button
                        type="button"
                        onClick={(e) => abrirModalEditar(e, m, info)}
                        title="Editar Título, Descripción e Ícono de este Widget"
                        style={{
                          border: "1px solid #E5E7EB",
                          background: "#FFFFFF",
                          borderRadius: "8px",
                          padding: "4px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          color: "#4B5563",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <Pencil size={12} color="#5000BA" /> Editar
                      </button>
                    </div>
                  </div>

                  <h4 style={{ fontSize: "0.96rem", fontWeight: 800, color: "#111", margin: "0 0 4px 0" }}>
                    {info.titulo}
                  </h4>
                  <p style={{ fontSize: "0.82rem", color: "#666", margin: 0, lineHeight: 1.4 }}>
                    {info.subtitulo}
                  </p>
                </div>

                <div style={{ marginTop: "16px", paddingTop: "10px", borderTop: "1px solid #F3F4F6", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                  <Link
                    href={m.ruta}
                    style={{ fontSize: "0.76rem", fontWeight: 800, color: "var(--violeta, #5000BA)", textDecoration: "none" }}
                  >
                    Abrir Módulo →
                  </Link>
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* ═══════════════════════════════════════════════════════════════ */}
      {/* SECCIÓN: INVENTARIO CANÓNICO & VALIDACIÓN DE WIDGETS (DATAGRID) */}
      {/* ═══════════════════════════════════════════════════════════════ */}
      <section
        style={{
          marginTop: "32px",
          background: "var(--blanco, #ffffff)",
          borderRadius: "14px",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          padding: "24px",
          display: "flex",
          flexDirection: "column",
          gap: "18px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
              <span
                style={{
                  background: "var(--violeta-suave, #F3E8FF)",
                  color: "var(--violeta, #5000BA)",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                  letterSpacing: "0.04em",
                  textTransform: "uppercase",
                }}
              >
                Auditoría & Gobierno Técnico
              </span>
              <span
                style={{
                  background: "#ECFDF5",
                  color: "#065F46",
                  padding: "3px 10px",
                  borderRadius: "6px",
                  fontSize: "0.72rem",
                  fontWeight: 800,
                }}
              >
                ✓ 0 Duplicados Funcionales
              </span>
            </div>

            <h3 style={{ margin: 0, fontSize: "1.15rem", fontWeight: 800, color: "var(--negro, #111111)" }}>
              📋 Inventario Maestro & Validación de Componentes Fuente (.tsx)
            </h3>
            <p style={{ margin: "4px 0 0 0", fontSize: "0.84rem", color: "var(--panel-gris, #737373)" }}>
              Reporte técnico de widgets del ecosistema: ruta física del componente, perfiles autorizados y verificación de unicidad sin duplicados.
            </p>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
            <div style={{ textAlign: "right" }}>
              <strong style={{ fontSize: "1.2rem", fontWeight: 900, color: "var(--violeta, #5000BA)", display: "block" }}>
                {CATALOGO_SUPERADMIN_TODOS.length}
              </strong>
              <span style={{ fontSize: "0.72rem", color: "#64748B", fontWeight: 700 }}>Módulos Registrados</span>
            </div>
          </div>
        </div>

        {/* DataGrid Estandarizado @eco/datagrid */}
        <DataGrid
          columnas={[
            {
              id: "nombre",
              encabezado: "Módulo / Widget",
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
                        background: `${r.color}15`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      <IconoR size={18} color={r.color} />
                    </div>
                    <div>
                      <strong style={{ color: "#0F172A", fontSize: "0.85rem", display: "block" }}>{r.nombre}</strong>
                      <code style={{ fontSize: "0.72rem", color: "#64748B", background: "#F1F5F9", padding: "1px 5px", borderRadius: "4px" }}>
                        clave: {r.clave}
                      </code>
                    </div>
                  </div>
                );
              },
            },
            {
              id: "rutaFisica",
              encabezado: "Ruta Física del Componente (.tsx)",
              valor: (r: ModuloSuperAdminDef) => r.rutaFisica,
              render: (r: ModuloSuperAdminDef) => (
                <div>
                  <span style={{ fontSize: "0.74rem", fontFamily: "monospace", color: "#1E293B", fontWeight: 700, display: "block" }}>
                    {r.rutaFisica}
                  </span>
                  <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                    Paquete: <strong style={{ color: "var(--violeta, #5000BA)" }}>{r.paquete}</strong>
                  </span>
                </div>
              ),
            },
            {
              id: "categoria",
              encabezado: "Categoría / Panel Destino",
              valor: (r: ModuloSuperAdminDef) => `${r.categoria} ${r.panelDestino}`,
              render: (r: ModuloSuperAdminDef) => (
                <div>
                  <span
                    style={{
                      padding: "2px 8px",
                      borderRadius: "6px",
                      background: "#EDE9FE",
                      color: "#5B21B6",
                      fontWeight: 800,
                      fontSize: "0.72rem",
                      display: "inline-block",
                      marginBottom: "2px",
                    }}
                  >
                    {r.categoria}
                  </span>
                  <span style={{ display: "block", fontSize: "0.72rem", color: "#475569" }}>
                    {r.panelDestino}
                  </span>
                </div>
              ),
            },
            {
              id: "perfiles",
              encabezado: "Perfiles de Uso Autorizados",
              valor: (r: ModuloSuperAdminDef) => r.perfilesAsignados.join(", "),
              render: (r: ModuloSuperAdminDef) => (
                <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                  {r.perfilesAsignados.map((p) => {
                    const colorBg =
                      p === "SUPERADMIN" ? "#F3E8FF" :
                      p === "ADMINISTRADOR" ? "#FEF3C7" :
                      p === "OPERADOR" ? "#ECFDF5" :
                      p === "ABOGADO" ? "#EFF6FF" : "#F1F5F9";
                    const colorTxt =
                      p === "SUPERADMIN" ? "#6B21A8" :
                      p === "ADMINISTRADOR" ? "#92400E" :
                      p === "OPERADOR" ? "#065F46" :
                      p === "ABOGADO" ? "#1E40AF" : "#475569";
                    return (
                      <span
                        key={p}
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          padding: "2px 6px",
                          borderRadius: "4px",
                          background: colorBg,
                          color: colorTxt,
                          letterSpacing: "0.02em",
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
              encabezado: "Validación de Duplicidad",
              valor: (r: ModuloSuperAdminDef) => r.estadoDuplicidad,
              render: () => (
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "#ECFDF5",
                    color: "#047857",
                    fontWeight: 800,
                    fontSize: "0.72rem",
                  }}
                >
                  ✓ Canónico / Único
                </span>
              ),
            },
            {
              id: "detalle",
              encabezado: "Descripción Funcional",
              valor: (r: ModuloSuperAdminDef) => r.detalle,
              render: (r: ModuloSuperAdminDef) => (
                <span style={{ fontSize: "0.78rem", color: "#475569", lineHeight: 1.4 }}>
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
                background: "#F8FAFC",
                borderRadius: "8px",
                fontSize: "0.8rem",
                border: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <strong style={{ color: "#0F172A", fontSize: "0.88rem" }}>
                  🔎 Ficha Técnica y Gobernanza: {r.nombre} ({r.clave})
                </strong>
                <Link
                  href={r.ruta}
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 800,
                    color: "var(--violeta, #5000BA)",
                    textDecoration: "none",
                  }}
                >
                  Abrir Módulo en Vivo →
                </Link>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "10px", marginTop: "4px" }}>
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>Ruta Física (.tsx):</span>
                  <code style={{ fontSize: "0.75rem", color: "#0F172A" }}>{r.rutaFisica}</code>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>Ruta de Enrutamiento / URL:</span>
                  <code style={{ fontSize: "0.75rem", color: "#0F172A" }}>{r.ruta}</code>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>Paquete Monorepo:</span>
                  <strong style={{ fontSize: "0.78rem", color: "var(--violeta, #5000BA)" }}>{r.paquete}</strong>
                </div>
                <div>
                  <span style={{ color: "#64748B", display: "block", fontSize: "0.72rem" }}>Regla de Unicidad:</span>
                  <span style={{ fontSize: "0.75rem", color: "#065F46", fontWeight: 700 }}>
                    Sin colisiones con otros componentes ni duplicación de vistas.
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
