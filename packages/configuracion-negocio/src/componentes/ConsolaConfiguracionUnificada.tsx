"use client";

import { useEffect, useState } from "react";
import { Bot, Building2, CheckCircle2, CircleDashed, KeyRound, Mail, SlidersHorizontal, type LucideIcon } from "lucide-react";
import type { Tables } from "@eco/db";
import type { ConfiguracionAriaVista } from "../esquema-aria";
import { FormularioConfiguracionNegocio } from "./FormularioConfiguracionNegocio";
import { FormularioAria } from "./FormularioAria";
import { FormularioSmtp } from "./FormularioSmtp";
import { GestionTokensMcpWidget } from "./GestionTokensMcpWidget";
import { estiloTarjetaConfig } from "./estilos-configuracion";

type CfgNegocio = Tables<{ schema: "comun_configuracion" }, "cfg_negocio">;
type CfgSmtp = Tables<{ schema: "comun_configuracion" }, "cfg_smtp">;

export type SeccionConfiguracion = "negocio" | "aria" | "correo" | "tokens";

export interface PropsConsolaConfiguracionUnificada {
  negocio: string;
  nombreNegocioVisible?: string;
  seccionInicial?: SeccionConfiguracion;
  configuracion: CfgNegocio | null;
  smtp: CfgSmtp | null;
  aria: ConfiguracionAriaVista | null;
  mostrarCorreo?: boolean;
  mostrarAria?: boolean;
  mostrarTokens?: boolean;
}

interface DefinicionTab {
  id: SeccionConfiguracion;
  etiqueta: string;
  ruta: string;
  icono: LucideIcon;
}

const TABS_CONFIGURACION: DefinicionTab[] = [
  {
    id: "negocio",
    etiqueta: "Datos del Negocio",
    ruta: "/panel/configuracion",
    icono: Building2,
  },
  {
    id: "aria",
    etiqueta: "Agente ARIA",
    ruta: "/panel/aria",
    icono: Bot,
  },
  {
    id: "correo",
    etiqueta: "Servidor de Correo",
    ruta: "/panel/correo",
    icono: Mail,
  },
  {
    id: "tokens",
    etiqueta: "Tokens & MCP",
    ruta: "/panel/tokens-mcp",
    icono: KeyRound,
  },
];

export function ConsolaConfiguracionUnificada({
  negocio,
  nombreNegocioVisible,
  seccionInicial = "negocio",
  configuracion,
  smtp,
  aria,
  mostrarCorreo = true,
  mostrarAria = true,
  mostrarTokens = true,
}: PropsConsolaConfiguracionUnificada) {
  const [seccionActiva, setSeccionActiva] = useState<SeccionConfiguracion>(seccionInicial);

  useEffect(() => {
    setSeccionActiva(seccionInicial);
  }, [seccionInicial]);

  const tabsVisibles = TABS_CONFIGURACION.filter((tab) => {
    if (tab.id === "correo" && !mostrarCorreo) return false;
    if (tab.id === "aria" && !mostrarAria) return false;
    if (tab.id === "tokens" && !mostrarTokens) return false;
    return true;
  });

  function cambiarSeccion(tab: DefinicionTab) {
    setSeccionActiva(tab.id);
    if (typeof window !== "undefined" && window.location.pathname !== tab.ruta) {
      window.history.replaceState(null, "", tab.ruta);
    }
  }

  function cambiarSeccionPorId(id: SeccionConfiguracion) {
    const tab = TABS_CONFIGURACION.find((t) => t.id === id);
    if (tab) cambiarSeccion(tab);
  }

  const etiquetaNegocio = nombreNegocioVisible ?? negocio.charAt(0).toUpperCase() + negocio.slice(1);
  const negocioListo = Boolean(configuracion?.cfg_nombre_comercial || configuracion?.cfg_razon_social);
  const ariaActiva = Boolean(aria?.activo && aria?.tieneApiKey);
  const ariaEnVault = Boolean(aria?.tieneApiKey);
  const smtpActivo = Boolean(smtp?.smt_activo && smtp?.smt_secreto_id);

  return (
    <div
      style={{
        maxWidth: "960px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      {/* Cabecera Ejecutiva Sobria */}
      <section
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "14px",
          padding: "22px 24px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "16px",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: "14px",
          }}
        >
          <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                background: "#F4F4F5",
                border: "1px solid #E4E4E7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#18181B",
                flexShrink: 0,
              }}
            >
              <SlidersHorizontal size={20} />
            </div>
            <div>
              <div
                style={{
                  fontSize: "0.73rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#6B7280",
                  marginBottom: "4px",
                }}
              >
                Configuración del Sistema · {etiquetaNegocio}
              </div>
              <h1
                style={{
                  margin: 0,
                  fontSize: "1.35rem",
                  fontWeight: 700,
                  color: "#111827",
                  lineHeight: 1.25,
                }}
              >
                Parámetros Generales e Integraciones
              </h1>
              <p
                style={{
                  margin: "5px 0 0 0",
                  fontSize: "0.86rem",
                  color: "#6B7280",
                  lineHeight: 1.45,
                  maxWidth: "640px",
                }}
              >
                Gestiona la identidad comercial, las credenciales cifradas en Vault del asistente ARIA, el
                despacho de correos y los tokens MCP exclusivos de este negocio.
              </p>
            </div>
          </div>
        </div>

        {/* Resumen compacto de estado */}
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "10px",
            paddingTop: "14px",
            borderTop: "1px solid #F3F4F6",
          }}
        >
          <IndicadorResumen
            etiqueta="Identidad"
            valor={negocioListo ? "Configurada" : "Pendiente"}
            activo={negocioListo}
            onClick={() => cambiarSeccionPorId("negocio")}
          />
          {mostrarAria && (
            <IndicadorResumen
              etiqueta="Agente ARIA"
              valor={ariaActiva ? "Activo" : ariaEnVault ? "En Vault (Inactivo)" : "Sin clave"}
              activo={ariaActiva}
              onClick={() => cambiarSeccionPorId("aria")}
            />
          )}
          {mostrarCorreo && (
            <IndicadorResumen
              etiqueta="Correo SMTP"
              valor={smtpActivo ? "Activo" : "Inactivo"}
              activo={smtpActivo}
              onClick={() => cambiarSeccionPorId("correo")}
            />
          )}
        </div>
      </section>

      {/* Barra de Navegación por Pestañas (Agrupación de Configuración) */}
      <nav
        aria-label="Secciones de configuración"
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: "6px",
          padding: "6px",
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "12px",
          boxShadow: "0 1px 2px rgba(15, 23, 42, 0.03)",
        }}
      >
        {tabsVisibles.map((tab) => {
          const Icono = tab.icono;
          const esActiva = seccionActiva === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => cambiarSeccion(tab)}
              aria-current={esActiva ? "page" : undefined}
              title={tab.etiqueta}
              aria-label={tab.etiqueta}
              style={{
                flex: "1 1 auto",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "8px",
                border: esActiva ? "1px solid #18181B" : "1px solid transparent",
                background: esActiva ? "#18181B" : "transparent",
                color: esActiva ? "#FFFFFF" : "#4B5563",
                fontFamily: "inherit",
                fontSize: "0.85rem",
                fontWeight: esActiva ? 600 : 500,
                cursor: "pointer",
                transition: "all 0.15s ease",
              }}
            >
              <Icono size={16} />
              <span>{tab.etiqueta}</span>
            </button>
          );
        })}
      </nav>

      {/* Contenido de la Sección Seleccionada */}
      <div>
        {seccionActiva === "negocio" && (
          <FormularioConfiguracionNegocio inicial={configuracion} negocio={negocio} />
        )}

        {seccionActiva === "aria" && mostrarAria && (
          <FormularioAria inicial={aria} negocio={negocio} />
        )}

        {seccionActiva === "correo" && mostrarCorreo && (
          <FormularioSmtp inicial={smtp} negocio={negocio} />
        )}

        {seccionActiva === "tokens" && mostrarTokens && (
          <div style={{ ...estiloTarjetaConfig, padding: "24px" }}>
            <GestionTokensMcpWidget negocio={negocio} />
          </div>
        )}
      </div>
    </div>
  );
}

function IndicadorResumen({
  etiqueta,
  valor,
  activo,
  onClick,
}: {
  etiqueta: string;
  valor: string;
  activo: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      title={`${etiqueta}: ${valor}`}
      aria-label={`${etiqueta}: ${valor}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: "7px",
        padding: "5px 11px",
        borderRadius: "999px",
        border: `1px solid ${activo ? "#BBF7D0" : "#E5E7EB"}`,
        background: activo ? "#F0FDF4" : "#F9FAFB",
        color: activo ? "#166534" : "#4B5563",
        fontFamily: "inherit",
        fontSize: "0.76rem",
        cursor: "pointer",
      }}
    >
      {activo ? <CheckCircle2 size={13} color="#16A34A" /> : <CircleDashed size={13} color="#9CA3AF" />}
      <span style={{ color: "#6B7280", fontWeight: 500 }}>{etiqueta}:</span>
      <strong style={{ fontWeight: 600 }}>{valor}</strong>
    </button>
  );
}
