"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Settings, Mail, Bell, Star, ChevronRight, ShieldCheck, Sliders, Receipt, type LucideIcon } from "lucide-react";
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
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  facturacion: {
    id: "facturacion",
    titulo: "Datos de Facturación & Comprobantes",
    subtitulo: "Razón social, RUC/Cédula, dirección fiscal y correo electrónico de facturación",
    icono: Receipt,
    colorIcono: "var(--esmeralda, #05876E)",
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  historial: {
    id: "historial",
    titulo: "Historial de Accesos",
    subtitulo: "Seguridad de inicio de sesión, IP y dispositivos",
    icono: History,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  sesion: {
    id: "sesion",
    titulo: "Sesión & Claves de Seguridad",
    subtitulo: "Gestión de sesión activa y cierre de sesión",
    icono: KeyRound,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  rol_activo: {
    id: "rol_activo",
    titulo: "Ver Como",
    subtitulo: "Alternar la vista previa del portal entre Cliente, Socio Abogado y Administrador",
    icono: ShieldCheck,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  peligro: {
    id: "peligro",
    titulo: "Baja de Cuenta",
    subtitulo: "Eliminación permanente conforme a Ley LOPDP",
    icono: ShieldAlert,
    colorIcono: "#B00020",
    href: "/panel/cuenta",
    origen: "Mi cuenta",
    esPeligro: true
  },
  negocio: {
    id: "negocio",
    titulo: "Configuración del Negocio",
    subtitulo: "Identidad legal, términos, locales, WhatsApp y redes",
    icono: Settings,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion",
    origen: "Configurar"
  },
  perfiles: {
    id: "perfiles",
    titulo: "Administración de Perfiles & Permisos",
    subtitulo: "Catálogo de perfiles, jerarquía de roles (1–100) y matriz de gobernanza",
    icono: Sliders,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion",
    origen: "Configurar"
  },
  correo: {
    id: "correo",
    titulo: "Servidor de Correo SMTP",
    subtitulo: "Servidor saliente, credenciales Vault y pruebas",
    icono: Mail,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion",
    origen: "Configurar"
  },
  notificaciones: {
    id: "notificaciones",
    titulo: "Preferencias de Alertas & Notificaciones",
    subtitulo: "Frecuencia, canales de recepción Email, WhatsApp y Push",
    icono: Bell,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/configuracion",
    origen: "Configurar"
  }
};

export function TarjetasFavoritasGrid() {
  const [favsCuenta, setFavsCuenta] = useState<string[]>([]);
  const [favsConfig, setFavsConfig] = useState<string[]>([]);
  const [cargado, setCargado] = useState(false);
  const { getWidgetInfo } = useCustomWidgets();

  useEffect(() => {
    try {
      const c = localStorage.getItem("tranqi_favoritos_cuenta");
      const cfg = localStorage.getItem("tranqi_favoritos_configuracion");
      setFavsCuenta(c ? JSON.parse(c) : ["perfil"]);
      setFavsConfig(cfg ? JSON.parse(cfg) : []);
    } catch {
      setFavsCuenta(["perfil"]);
    } finally {
      setCargado(true);
    }
  }, []);

  if (!cargado) return null;

  const idsUnicos = Array.from(new Set([...favsCuenta, ...favsConfig]));
  const itemsFavoritos = idsUnicos
    .map(id => CATALOGO_FAVORITOS[id])
    .filter((item): item is WidgetFavInfo => item !== undefined);

  if (itemsFavoritos.length === 0) return null;

  return (
    <>
      {itemsFavoritos.map(item => {
        const Icono = item.icono;
        const infoCustom = getWidgetInfo(item.id, item.titulo, item.subtitulo);

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
              <Icono size={20} color={item.esPeligro ? "#B00020" : item.colorIcono} />
            </div>

            <div style={{ minWidth: 0, marginTop: "6px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "4px" }}>
                <span
                  style={{
                    fontSize: "0.56rem",
                    fontWeight: 800,
                    color: "#92400E",
                    background: "var(--amarillo, #FEE300)",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    letterSpacing: "0.04em"
                  }}
                >
                  FAVORITO
                </span>
                <span style={{ fontSize: "0.62rem", color: "var(--panel-gris, #737373)", fontWeight: 700 }}>
                  • {item.origen}
                </span>
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

