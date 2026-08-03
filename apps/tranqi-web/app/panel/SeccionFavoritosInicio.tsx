"use client";

import React, { useState, useEffect } from "react";
import { User, History, KeyRound, ShieldAlert, Settings, Mail, Bell, Star, ChevronRight, type LucideIcon } from "lucide-react";
import Link from "next/link";

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
    subtitulo: "Nombres, apellidos, correo verificado y WhatsApp",
    icono: User,
    colorIcono: "var(--violeta, #5000BA)",
    href: "/panel/cuenta",
    origen: "Mi cuenta"
  },
  historial: {
    id: "historial",
    titulo: "Historial de Accesos (PLT-018)",
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
  peligro: {
    id: "peligro",
    titulo: "Baja de Cuenta (PLT-012)",
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
  correo: {
    id: "correo",
    titulo: "Servidor de Correo SMTP (PLT-008)",
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

export function SeccionFavoritosInicio() {
  const [favsCuenta, setFavsCuenta] = useState<string[]>([]);
  const [favsConfig, setFavsConfig] = useState<string[]>([]);
  const [cargado, setCargado] = useState(false);

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
    <section style={{ marginBottom: "24px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
        <h2 style={{ fontSize: "0.92rem", fontWeight: 800, color: "var(--negro, #111111)", display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
          <Star size={18} fill="#FEE300" color="#D97706" /> Mis Accesos Favoritos
        </h2>
        <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)", fontWeight: 600 }}>
          {itemsFavoritos.length} {itemsFavoritos.length === 1 ? "widget fijado" : "widgets fijados"}
        </span>
      </div>

      <div className="accesos-cliente">
        {itemsFavoritos.map(item => {
          const Icono = item.icono;
          return (
            <Link
              key={item.id}
              href={item.href}
              className="tarjeta-acceso"
              style={{
                border: "2px solid var(--amarillo, #FEE300)",
                textDecoration: "none",
                color: "inherit",
                display: "flex",
                flexDirection: "column"
              }}
            >
              <div className="tarjeta-acceso-icono" style={{ margin: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Icono size={20} color={item.esPeligro ? "#B00020" : item.colorIcono} />
              </div>

              <div style={{ minWidth: 0, marginTop: "6px" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "4px", marginBottom: "4px" }}>
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
                    {item.origen}
                  </span>
                </div>
                <strong style={{ display: "block", color: item.esPeligro ? "#B00020" : undefined, lineHeight: 1.25 }}>
                  {item.titulo}
                </strong>
              </div>

              <p style={{ margin: "4px 0 0 0" }}>{item.subtitulo}</p>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginTop: "auto",
                  paddingTop: "10px",
                  fontSize: "0.76rem",
                  color: "var(--violeta, #5000BA)",
                  fontWeight: 700
                }}
              >
                <span>Ir al widget</span>
                <ChevronRight size={14} />
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
}
