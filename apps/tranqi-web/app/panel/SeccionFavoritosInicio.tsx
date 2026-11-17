"use client";

import React, { useState, useEffect } from "react";
import { User, Users, History, KeyRound, ShieldAlert, Settings, Mail, Bell, Star, ChevronRight, ShieldCheck, Sliders, Receipt, Lock, FileText, BarChart2, FileCheck, Folder, ShoppingBag, CreditCard, CalendarPlus, CalendarCheck, CalendarClock, Shuffle, Building2, Scale, Briefcase, Bot, MapPin, ClipboardList, MessageSquare, MessageSquareHeart, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCustomWidgets } from "./gestorTitulosWidgets";

interface WidgetFavInfo {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: LucideIcon;
  href: string;
  origen: "Mi cuenta" | "Configurar" | "Herramientas" | "Administrar";
  esPeligro?: boolean;
}

const CATALOGO_FAVORITOS: Record<string, WidgetFavInfo> = {
  vitrina_comercial_personas: {
    id: "vitrina_comercial_personas",
    titulo: "Servicios para Personas & Familias",
    subtitulo: "Trámites notariales, videoconsultas individuales, defensa legal y planes familiares",
    icono: ShoppingBag,
    href: "/panel/clientes?widget=vitrina_comercial_personas",
    origen: "Herramientas"
  },
  vitrina_comercial_empresas: {
    id: "vitrina_comercial_empresas",
    titulo: "Soluciones & Planes Empresas",
    subtitulo: "Planes legales corporativos, constitución SAS, convenios y asesoría empresarial",
    icono: Building2,
    href: "/panel/empresas?widget=vitrina_comercial_empresas",
    origen: "Herramientas"
  },
  catalogo_productos: {
    id: "catalogo_productos",
    titulo: "Catálogo y honorarios",
    subtitulo: "Servicios, honorarios y suscripciones con IVA",
    icono: ShoppingBag,
    href: "/panel/catalogo-productos",
    origen: "Configurar"
  },
  gestion_convenios_corporativos: {
    id: "gestion_convenios_corporativos",
    titulo: "Convenios Corporativos & B2B",
    subtitulo: "Gestión de alianzas empresariales, bolsas de consultas y descuentos automáticos",
    icono: Building2,
    href: "/panel/administrar?widget=gestion_convenios_corporativos",
    origen: "Administrar"
  },
  compliance_score_legal: {
    id: "compliance_score_legal",
    titulo: "Compliance & Score Legal",
    subtitulo: "Matriz de obligaciones normativas, monitoreo con Tranqi y Legal Health Score",
    icono: ShieldCheck,
    href: "/panel/administrar?widget=compliance_score_legal",
    origen: "Administrar"
  },
  legal_hr_laboral: {
    id: "legal_hr_laboral",
    titulo: "Legal HR & Finiquitos",
    subtitulo: "Contratos de trabajo tipificados, firma .p12, avisos IESS y actas SUT",
    icono: Briefcase,
    href: "/panel/administrar?widget=legal_hr_laboral",
    origen: "Administrar"
  },
  disponibilidad_abogados: {
    id: "disponibilidad_abogados",
    titulo: "Disponibilidad de Abogados & Turnos",
    subtitulo: "Control de horas disponibles por especialista. Postulación preliminar y aprobación con sincronización Tranqi",
    icono: Scale,
    href: "/panel/agendamiento?widget=disponibilidad_abogados",
    origen: "Administrar"
  },
  gestion_red_abogados: {
    id: "gestion_red_abogados",
    titulo: "Red Profesional & Registro de Abogados",
    subtitulo: "Convertir usuarios registrados en abogados, alta manual y gestión de especialidades, cobertura y disponibilidad",
    icono: Scale,
    href: "/panel/red-profesional?widget=gestion_red_abogados",
    origen: "Administrar"
  },
  mi_perfil_abogado: {
    id: "mi_perfil_abogado",
    titulo: "Mis Especialidades, Cobertura y Disponibilidad",
    subtitulo: "Configura tus materias legales, provincias de cobertura y horarios de atención presencial y teleconsulta",
    icono: Scale,
    href: "/panel/red-profesional?widget=mi_perfil_abogado",
    origen: "Herramientas"
  },
  horarios_atencion_agenda: {
    id: "horarios_atencion_agenda",
    titulo: "Horarios de Atención (Telemático y Presencial)",
    subtitulo: "Configura horarios por defecto para consultas telemáticas y presenciales y la especialidad por defecto de Tranqi",
    icono: Scale,
    href: "/panel/agendamiento?widget=horarios_atencion_agenda",
    origen: "Administrar"
  },
  pasarela_payphone: {
    id: "pasarela_payphone",
    titulo: "Pasarela PLUX / Payphone",
    subtitulo: "Credenciales multiempresa PLUX y Payphone en Vault y webhook de pagos",
    icono: CreditCard,
    href: "/panel/configuracion?widget=pasarela_payphone",
    origen: "Configurar"
  },
  configuracion_facturacion_sri: {
    id: "configuracion_facturacion_sri",
    titulo: "Parámetros Facturación SRI",
    subtitulo: "RUC, régimen RIMPE/General, serie 001-001, secuenciales y firma electrónica .p12 en Vault",
    icono: FileCheck,
    href: "/panel/configuracion?widget=configuracion_facturacion_sri",
    origen: "Configurar"
  },
  perfil: {
    id: "perfil",
    titulo: "Perfil y contacto",
    subtitulo: "Nombres, correo verificado y WhatsApp",
    icono: User,
    href: "/panel/cuenta?widget=mi_cuenta",
    origen: "Mi cuenta"
  },
  facturacion_electronica: {
    id: "facturacion_electronica",
    titulo: "Facturación Electrónica & Comprobantes",
    subtitulo: "Valores generados, valores pagados, detalle del rubro facturado y comprobantes electrónicos SRI",
    icono: Receipt,
    href: "/panel/herramientas?widget=facturacion_electronica",
    origen: "Herramientas"
  },
  historial_pagos: {
    id: "historial_pagos",
    titulo: "Historial de Pagos & Facturas",
    subtitulo: "Consulta de pagos realizados, detalle de rubro facturado y factura electrónica SRI",
    icono: CreditCard,
    href: "/panel/cuenta?widget=historial_pagos",
    origen: "Mi cuenta"
  },
  facturacion: {
    id: "facturacion",
    titulo: "Datos de facturación",
    subtitulo: "Razón social, RUC o cédula y dirección fiscal",
    icono: Receipt,
    href: "/panel/cuenta?widget=datos_facturacion",
    origen: "Mi cuenta"
  },
  historial: {
    id: "historial",
    titulo: "Historial de accesos",
    subtitulo: "Inicios de sesión y dispositivos",
    icono: History,
    href: "/panel/cuenta?widget=historial_accesos",
    origen: "Mi cuenta"
  },
  sesion: {
    id: "sesion",
    titulo: "Sesión",
    subtitulo: "Gestión de sesión activa y seguridad",
    icono: KeyRound,
    href: "/panel/cuenta?widget=mfa_seguridad",
    origen: "Mi cuenta"
  },
  rol_activo: {
    id: "rol_activo",
    titulo: "Ver como otro rol",
    subtitulo: "Alterna la vista previa según los roles asignados",
    icono: ShieldCheck,
    href: "/panel/cuenta?widget=ver_como",
    origen: "Mi cuenta"
  },
  peligro: {
    id: "peligro",
    titulo: "Baja de cuenta",
    subtitulo: "Eliminación permanente conforme a la ley LOPDP",
    icono: ShieldAlert,
    href: "/panel/cuenta?widget=baja_cuenta",
    origen: "Mi cuenta",
    esPeligro: true
  },
  negocio: {
    id: "negocio",
    titulo: "Configuración del negocio",
    subtitulo: "Datos del negocio, términos y contacto",
    icono: Settings,
    href: "/panel/configuracion?widget=negocio",
    origen: "Configurar"
  },
  correo: {
    id: "correo",
    titulo: "Correo saliente (SMTP)",
    subtitulo: "Servidor de correo saliente y credenciales",
    icono: Mail,
    href: "/panel/configuracion?widget=correo",
    origen: "Configurar"
  },
  notificaciones: {
    id: "notificaciones",
    titulo: "Preferencias de avisos",
    subtitulo: "Canales de notificación y avisos",
    icono: Bell,
    href: "/panel/configuracion?widget=notificaciones",
    origen: "Configurar"
  },
  perfiles: {
    id: "perfiles",
    titulo: "Perfiles y permisos",
    subtitulo: "Catálogo de perfiles y permisos asignados",
    icono: Sliders,
    href: "/panel/configuracion?widget=perfiles",
    origen: "Configurar"
  },
  configuracion_contrato_abogado: {
    id: "configuracion_contrato_abogado",
    titulo: "Contrato de socios",
    subtitulo: "Plantilla del contrato de sociedad de abogados",
    icono: FileText,
    href: "/panel/administrar?widget=configuracion_contrato_abogado",
    origen: "Configurar"
  },
  gestion_terminos_consentimientos: {
    id: "gestion_terminos_consentimientos",
    titulo: "Términos y consentimientos",
    subtitulo: "Cláusulas LOPDP y avisos legales",
    icono: FileText,
    href: "/panel/administrar?widget=gestion_terminos_consentimientos",
    origen: "Configurar"
  },
  configuracion_aria: {
    id: "configuracion_aria",
    titulo: "Agente Conversacional ARIA",
    subtitulo: "Parámetros ARIA_BASE, ARIA_AGENT_ID y claves en Vault aislados por negocio",
    icono: Bot,
    href: "/panel/aria",
    origen: "Configurar"
  },
  configuracion_logistica: {
    id: "configuracion_logistica",
    titulo: "Envíos, Zonas y Cobertura GPS",
    subtitulo: "Polígonos de cobertura en Pichincha, envío gratis por sector y tarifa por km vial",
    icono: MapPin,
    href: "/panel/logistica",
    origen: "Configurar"
  },
  consola_chat: {
    id: "consola_chat",
    titulo: "Ventas Omnicanal & Chats en Vivo",
    subtitulo: "Monitoreo de conversaciones, intervención humana vs ARIA, etiquetas, /atajos y compras web",
    icono: MessageSquare,
    href: "/panel/conversaciones",
    origen: "Administrar"
  },
  galeria_inmediata: {
    id: "galeria_inmediata",
    titulo: "Entrega Inmediata (1–2h)",
    subtitulo: "Arreglos listos en tienda con precio especial y baja automática al venderse",
    icono: MessageSquare,
    href: "/panel/entrega-inmediata",
    origen: "Administrar"
  },
  inventario_rosas: {
    id: "inventario_rosas",
    titulo: "Inventario de Rosas (Conteo IA)",
    subtitulo: "Conteo fotográfico de bonches por color asistido por ARIA",
    icono: MessageSquare,
    href: "/panel/inventario-rosas",
    origen: "Administrar"
  },
  envio_pedidos_taller: {
    id: "envio_pedidos_taller",
    titulo: "Enviar Pedidos a Taller",
    subtitulo: "Validación de ventas, calendario de entregas, llamadas Exequiales y despacho diario",
    icono: ClipboardList,
    href: "/panel/envio-pedidos",
    origen: "Administrar"
  },
  chat_equipo: {
    id: "chat_equipo",
    titulo: "Chat del Equipo",
    subtitulo: "Sala grupal interna con @menciones, fotografías y reenvío de consultas",
    icono: MessageSquare,
    href: "/panel/chat-equipo",
    origen: "Administrar"
  },
  taller_floral: {
    id: "taller_floral",
    titulo: "Taller — Producción",
    subtitulo: "Alertas en tiempo real, calendario de elaboración y estado En Preparación / Listo Entrega",
    icono: ClipboardList,
    href: "/panel/taller",
    origen: "Administrar"
  },
  confirmacion_entregas: {
    id: "confirmacion_entregas",
    titulo: "Entregas e Informes GPS",
    subtitulo: "Confirmación offline de entregas, OTs Exequiales IESS e informes quincenales PDF",
    icono: MessageSquare,
    href: "/panel/entregas",
    origen: "Administrar"
  },
  pedidos_tienda: {
    id: "pedidos_tienda",
    titulo: "Pedidos de Tienda y Despachos",
    subtitulo: "Bandeja de órdenes con mapa GPS, dedicatorias y desglose interno de logística",
    icono: ClipboardList,
    href: "/panel/pedidos",
    origen: "Administrar"
  },
  testimonios_clientes: {
    id: "testimonios_clientes",
    titulo: "Testimonios & Reseñas de Clientes",
    subtitulo: "Capturas de WhatsApp, entregas en vivo y enlace a Google Photos",
    icono: MessageSquareHeart,
    href: "/panel/testimonios",
    origen: "Administrar"
  },
  tokens_mcp: {
    id: "tokens_mcp",
    titulo: "Tokens & APIs MCP",
    subtitulo: "Generación de API Keys Bearer para conectar herramientas MCP con bots y agentes externos",
    icono: KeyRound,
    href: "/panel/configuracion?widget=tokens_mcp",
    origen: "Configurar"
  },
  bitacora_notificaciones: {
    id: "bitacora_notificaciones",
    titulo: "Historial de notificaciones",
    subtitulo: "Registro de avisos enviados y destinatarios",
    icono: BarChart2,
    href: "/panel/administrar?widget=bitacora_notificaciones",
    origen: "Configurar"
  },
  firma_documentos_pdf: {
    id: "firma_documentos_pdf",
    titulo: "Firma de documentos PDF",
    subtitulo: "Firma digital con certificado .p12 y código QR",
    icono: FileCheck,
    href: "/panel/firma-documentos",
    origen: "Configurar"
  },
  billetera_documentos: {
    id: "billetera_documentos",
    titulo: "Billetera de documentos",
    subtitulo: "Tus documentos, con aviso antes de que caduquen",
    icono: Folder,
    href: "/panel/billetera-documentos",
    origen: "Configurar"
  },
  agendar_cita: {
    id: "agendar_cita",
    titulo: "Agendar una consulta",
    subtitulo: "Elige materia, servicio y horario disponible",
    icono: CalendarPlus,
    href: "/panel/agendar",
    origen: "Herramientas"
  },
  mis_citas: {
    id: "mis_citas",
    titulo: "Mis citas",
    subtitulo: "Próximas consultas, videollamada y cancelación",
    icono: CalendarCheck,
    href: "/panel/mis-citas",
    origen: "Herramientas"
  },
  citas_programadas: {
    id: "citas_programadas",
    titulo: "Citas programadas",
    subtitulo: "Confirma, reagenda y cierra tus consultas",
    icono: CalendarClock,
    href: "/panel/agenda",
    origen: "Herramientas"
  },
  disponibilidad: {
    id: "disponibilidad",
    titulo: "Mi disponibilidad",
    subtitulo: "Horarios de atención, duración y bloqueos",
    icono: CalendarClock,
    href: "/panel/agenda/disponibilidad",
    origen: "Herramientas"
  },
  asignaciones_agenda: {
    id: "asignaciones_agenda",
    titulo: "Asignaciones y contingencia",
    subtitulo: "Reasignación de citas canceladas",
    icono: Shuffle,
    href: "/panel/agenda/asignaciones",
    origen: "Administrar"
  },
  crm_clientes: {
    id: "crm_clientes",
    titulo: "Clientes",
    subtitulo: "Directorio de clientes y expedientes",
    icono: Users,
    href: "/panel/clientes",
    origen: "Configurar"
  },
  financiamiento: {
    id: "financiamiento",
    titulo: "Financiamiento & Cuotas",
    subtitulo: "Cuotas para tu caso legal (Próximamente disponible)",
    icono: CreditCard,
    href: "/panel/clientes?widget=financiamiento",
    origen: "Herramientas"
  }
};

export function SeccionFavoritosInicio() {
  const [favsCuenta, setFavsCuenta] = useState<string[]>(["perfil"]);
  const [favsConfig, setFavsConfig] = useState<string[]>([]);
  const { getWidgetInfo, obtenerIconoComponente } = useCustomWidgets();

  useEffect(() => {
    try {
      const c = localStorage.getItem("tranqi_favoritos_cuenta");
      const cfg = localStorage.getItem("tranqi_favoritos_configuracion");
      if (c) setFavsCuenta(JSON.parse(c));
      if (cfg) setFavsConfig(JSON.parse(cfg));
    } catch {
      /* Mantener valor inicial */
    }
  }, []);

  const idsUnicos = Array.from(new Set([...favsCuenta, ...favsConfig]));
  const itemsFavoritos = idsUnicos
    .map(id => CATALOGO_FAVORITOS[id])
    .filter((item): item is WidgetFavInfo => item !== undefined);

  if (itemsFavoritos.length === 0) return null;

  return (
    <>
      {itemsFavoritos.map(item => {
        const infoCustom = getWidgetInfo(item.id, item.titulo, item.subtitulo);
        const IconoComponente = obtenerIconoComponente(infoCustom.iconoKey, item.icono);

        return (
          <Link
            key={`fav-${item.id}`}
            href={item.href}
            className={`tarjeta-acceso es-favorita${item.esPeligro ? " es-peligro" : ""}`}
          >
            {/* La estrella dice "esto lo fijaste tú". Va en el amarillo de marca,
                sin contorno ámbar propio: era un tercer color en una tarjeta que
                ya tiene el suyo. */}
            <Star className="marca-favorito" size={16} aria-label="Fijado en el inicio" />

            {/* Sin `color` inline: el icono lo hereda de `.tarjeta-acceso-icono`,
                que ya define el tratamiento único de la rejilla (neutro en
                reposo, menta al pasar por encima). Antes cada módulo traía su
                propio hex y la rejilla quedaba de siete colores. */}
            <div className="tarjeta-acceso-icono">
              <IconoComponente size={20} aria-hidden="true" />
            </div>

            <div className="tarjeta-acceso-cabeza">
              <div className="fila-chips">
                <span className={`chip-origen${item.origen === "Mi cuenta" ? " es-cuenta" : ""}`}>
                  {item.origen}
                </span>
                {infoCustom.requiereMfa && (
                  <span className="chip-origen es-mfa">
                    <Lock size={10} aria-hidden="true" /> MFA
                  </span>
                )}
              </div>
              <strong>{infoCustom.titulo}</strong>
            </div>

            <p>{infoCustom.subtitulo}</p>

            <ChevronRight className="flecha-acceso" size={16} aria-hidden="true" />
          </Link>
        );
      })}
    </>
  );
}

export const TarjetasFavoritasGrid = SeccionFavoritosInicio;
