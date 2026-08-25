"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Settings, Mail, Bell, Star, ChevronRight, ShieldCheck, Sliders, Receipt, Lock, FileText, BarChart2, FileCheck, Folder, type LucideIcon } from "lucide-react";
import Link from "next/link";
import { useCustomWidgets } from "./gestorTitulosWidgets";

interface WidgetFavInfo {
  id: string;
  titulo: string;
  subtitulo: string;
  icono: LucideIcon;
  href: string;
  origen: "Mi cuenta" | "Configurar";
  esPeligro?: boolean;
}

const CATALOGO_FAVORITOS: Record<string, WidgetFavInfo> = {
  perfil: {
    id: "perfil",
    titulo: "Perfil & Datos de Contacto",
    subtitulo: "Nombres, apellidos, correo verificado, correos adicionales y WhatsApp",
    icono: User,
    href: "/panel/cuenta?widget=mi_cuenta",
    origen: "Mi cuenta"
  },
  facturacion: {
    id: "facturacion",
    titulo: "Datos de Facturación & Comprobantes",
    subtitulo: "Razón social, RUC/Cédula, dirección fiscal y correo electrónico de facturación",
    icono: Receipt,
    href: "/panel/cuenta?widget=datos_facturacion",
    origen: "Mi cuenta"
  },
  historial: {
    id: "historial",
    titulo: "Historial de Accesos",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    href: "/panel/cuenta?widget=historial_accesos",
    origen: "Mi cuenta"
  },
  sesion: {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    href: "/panel/cuenta?widget=mfa_seguridad",
    origen: "Mi cuenta"
  },
  rol_activo: {
    id: "rol_activo",
    titulo: "Ver Como",
    subtitulo: "Alternar la vista previa del portal entre Cliente, Socio Abogado y Administrador",
    icono: ShieldCheck,
    href: "/panel/cuenta?widget=ver_como",
    origen: "Mi cuenta"
  },
  peligro: {
    id: "peligro",
    titulo: "Baja de Cuenta",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    href: "/panel/cuenta?widget=baja_cuenta",
    origen: "Mi cuenta",
    esPeligro: true
  },
  negocio: {
    id: "negocio",
    titulo: "Configuración del Negocio",
    subtitulo: "Identidad legal, términos, locales, WhatsApp y redes sociales",
    icono: Settings,
    href: "/panel/configuracion?widget=negocio",
    origen: "Configurar"
  },
  correo: {
    id: "correo",
    titulo: "Servidor SMTP & Plantillas Vault",
    subtitulo: "Credenciales cifradas, puerto TLS y plantilla HTML",
    icono: Mail,
    href: "/panel/configuracion?widget=correo",
    origen: "Configurar"
  },
  notificaciones: {
    id: "notificaciones",
    titulo: "Preferencias de Alertas",
    subtitulo: "Canales de contacto, WhatsApp y avisos legales",
    icono: Bell,
    href: "/panel/configuracion?widget=notificaciones",
    origen: "Configurar"
  },
  perfiles: {
    id: "perfiles",
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: Sliders,
    href: "/panel/configuracion?widget=perfiles",
    origen: "Configurar"
  },
  configuracion_contrato_abogado: {
    id: "configuracion_contrato_abogado",
    titulo: "Configuración de Contrato de Socios",
    subtitulo: "Administración de la plantilla del contrato de sociedad de abogados (.MD/HTML)",
    icono: FileText,
    href: "/panel/administrar?widget=configuracion_contrato_abogado",
    origen: "Configurar"
  },
  gestion_terminos_consentimientos: {
    id: "gestion_terminos_consentimientos",
    titulo: "Términos, Consentimientos & LOPDP",
    subtitulo: "Configuración de cláusulas LOPDP, notificaciones, WhatsApp y protección de datos",
    icono: FileText,
    href: "/panel/administrar?widget=gestion_terminos_consentimientos",
    origen: "Configurar"
  },
  bitacora_notificaciones: {
    id: "bitacora_notificaciones",
    titulo: "Bitácora & Historial de Notificaciones",
    subtitulo: "Consulta auditada e historial en tiempo real de notificaciones emitidas",
    icono: BarChart2,
    href: "/panel/administrar?widget=bitacora_notificaciones",
    origen: "Configurar"
  },
  firma_documentos_pdf: {
    id: "firma_documentos_pdf",
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital avanzado con certificado .p12 / .pfx y código QR oficial",
    icono: FileCheck,
    href: "/panel/firma-documentos",
    origen: "Configurar"
  },
  billetera_documentos: {
    id: "billetera_documentos",
    titulo: "Billetera Digital de Documentos",
    subtitulo: "Bóveda segura de documentos personales, vehiculares y contratos con OCR y TTL",
    icono: Folder,
    href: "/panel/billetera-documentos",
    origen: "Configurar"
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
