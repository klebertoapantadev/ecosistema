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
  colorIcono: string;
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
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta?widget=mi_cuenta",
    origen: "Mi cuenta"
  },
  facturacion: {
    id: "facturacion",
    titulo: "Datos de Facturación & Comprobantes",
    subtitulo: "Razón social, RUC/Cédula, dirección fiscal y correo electrónico de facturación",
    icono: Receipt,
    colorIcono: "var(--esmeralda, #05876E)",
    href: "/panel/cuenta?widget=datos_facturacion",
    origen: "Mi cuenta"
  },
  historial: {
    id: "historial",
    titulo: "Historial de Accesos",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta?widget=historial_accesos",
    origen: "Mi cuenta"
  },
  sesion: {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta?widget=mfa_seguridad",
    origen: "Mi cuenta"
  },
  rol_activo: {
    id: "rol_activo",
    titulo: "Ver Como",
    subtitulo: "Alternar la vista previa del portal entre Cliente, Socio Abogado y Administrador",
    icono: ShieldCheck,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta?widget=ver_como",
    origen: "Mi cuenta"
  },
  peligro: {
    id: "peligro",
    titulo: "Baja de Cuenta",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    colorIcono: "#B00020",
    href: "/panel/cuenta?widget=baja_cuenta",
    origen: "Mi cuenta",
    esPeligro: true
  },
  negocio: {
    id: "negocio",
    titulo: "Configuración del Negocio",
    subtitulo: "Identidad legal, términos, locales, WhatsApp y redes sociales",
    icono: Settings,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion?widget=negocio",
    origen: "Configurar"
  },
  correo: {
    id: "correo",
    titulo: "Servidor SMTP & Plantillas Vault",
    subtitulo: "Credenciales cifradas, puerto TLS y plantilla HTML",
    icono: Mail,
    colorIcono: "var(--esmeralda, #05876E)",
    href: "/panel/configuracion?widget=correo",
    origen: "Configurar"
  },
  notificaciones: {
    id: "notificaciones",
    titulo: "Preferencias de Alertas",
    subtitulo: "Canales de contacto, WhatsApp y avisos legales",
    icono: Bell,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion?widget=notificaciones",
    origen: "Configurar"
  },
  perfiles: {
    id: "perfiles",
    titulo: "Gestión de Usuarios & Membresías",
    subtitulo: "Administración de miembros, asignación de perfiles y techo jerárquico",
    icono: Sliders,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion?widget=perfiles",
    origen: "Configurar"
  },
  configuracion_contrato_abogado: {
    id: "configuracion_contrato_abogado",
    titulo: "Configuración de Contrato de Socios",
    subtitulo: "Administración de la plantilla del contrato de sociedad de abogados (.MD/HTML)",
    icono: FileText,
    colorIcono: "#5000BA",
    href: "/panel/administrar?widget=configuracion_contrato_abogado",
    origen: "Configurar"
  },
  gestion_terminos_consentimientos: {
    id: "gestion_terminos_consentimientos",
    titulo: "Términos, Consentimientos & LOPDP",
    subtitulo: "Configuración de cláusulas LOPDP, notificaciones, WhatsApp y protección de datos",
    icono: FileText,
    colorIcono: "#5000BA",
    href: "/panel/administrar?widget=gestion_terminos_consentimientos",
    origen: "Configurar"
  },
  bitacora_notificaciones: {
    id: "bitacora_notificaciones",
    titulo: "Bitácora & Historial de Notificaciones",
    subtitulo: "Consulta auditada e historial en tiempo real de notificaciones emitidas",
    icono: BarChart2,
    colorIcono: "#2563EB",
    href: "/panel/administrar?widget=bitacora_notificaciones",
    origen: "Configurar"
  },
  firma_documentos_pdf: {
    id: "firma_documentos_pdf",
    titulo: "Firma Electrónica de Documentos PDF",
    subtitulo: "Firmado digital avanzado con certificado .p12 / .pfx y código QR oficial",
    icono: FileCheck,
    colorIcono: "#5000BA",
    href: "/panel/firma-documentos",
    origen: "Configurar"
  },
  billetera_documentos: {
    id: "billetera_documentos",
    titulo: "Billetera Digital de Documentos",
    subtitulo: "Bóveda segura de documentos personales, vehiculares y contratos con OCR y TTL",
    icono: Folder,
    colorIcono: "#5000BA",
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
            className="tarjeta-acceso"
            style={{
              border: "1px solid var(--panel-linea, #E4E4E4)",
              textDecoration: "none",
              color: "inherit",
              display: "flex",
              flexDirection: "column",
              position: "relative"
            }}
          >
            {/* Estrella de Favorito en la esquina superior derecha */}
            <div
              style={{
                position: "absolute",
                top: "10px",
                right: "10px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center"
              }}
            >
              <Star size={16} fill="#FEE300" color="#D97706" />
            </div>

            <div className="tarjeta-acceso-icono" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <IconoComponente size={20} color={item.esPeligro ? "#B00020" : item.colorIcono} />
            </div>

            <div style={{ minWidth: 0, marginTop: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                <span
                  style={{
                    fontSize: "0.58rem",
                    fontWeight: 800,
                    color: item.origen === "Mi cuenta" ? "#034D3F" : "#5000BA",
                    background: item.origen === "Mi cuenta" ? "var(--esmeralda-suave, #E6F4F1)" : "var(--violeta-suave, #F3E8FF)",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    letterSpacing: "0.04em"
                  }}
                >
                  {item.origen.toUpperCase()}
                </span>
                {infoCustom.requiereMfa && (
                  <span
                    style={{
                      fontSize: "0.58rem",
                      fontWeight: 800,
                      color: "var(--violeta, #5000BA)",
                      background: "var(--violeta-suave, #F3E8FF)",
                      padding: "1px 6px",
                      borderRadius: "999px",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "3px"
                    }}
                  >
                    <Lock size={10} /> MFA
                  </span>
                )}
              </div>
              <strong style={{ display: "block", color: item.esPeligro ? "#B00020" : undefined, lineHeight: 1.25 }}>
                {infoCustom.titulo}
              </strong>
            </div>

            <p style={{ margin: "4px 0 0 0" }}>{infoCustom.subtitulo}</p>

            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "flex-end",
                marginTop: "auto",
                paddingTop: "10px",
                color: "var(--violeta, #5000BA)"
              }}
            >
              <ChevronRight size={16} />
            </div>
          </Link>
        );
      })}
    </>
  );
}

export const TarjetasFavoritasGrid = SeccionFavoritosInicio;
