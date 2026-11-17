"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  ClipboardList,
  CreditCard,
  FileCheck2,
  Flower2,
  Hammer,
  KeyRound,
  LayoutDashboard,
  Mail,
  MapPinCheck,
  MessageSquare,
  MessagesSquare,
  Receipt,
  Send,
  Settings,
  ShoppingBag,
  Truck,
  UserCircle,
  Users,
  MessageSquareHeart,
  Zap,
  type LucideIcon,
} from "lucide-react";
import { useBarraLateralPanel } from "./MarcoPanelLateral";

export type IconoNavegacionPanel =
  | "resumen"
  | "conversaciones"
  | "chat_equipo"
  | "inventario"
  | "entrega_inmediata"
  | "entregas_gps"
  | "envio_pedidos"
  | "taller"
  | "pedidos"
  | "facturacion"
  | "catalogo"
  | "usuarios"
  | "testimonios"
  | "negocio"
  | "facturacion_sri"
  | "logistica"
  | "pasarelas"
  | "aria"
  | "correo"
  | "tokens"
  | "cuenta";

export interface ItemNavegacionPanel {
  clave: string;
  nombre: string;
  ruta: string;
  icono: IconoNavegacionPanel;
  grupo: "operacion" | "configuracion" | "cuenta";
}

const MAPA_ICONOS: Record<IconoNavegacionPanel, LucideIcon> = {
  resumen: LayoutDashboard,
  conversaciones: MessageSquare,
  chat_equipo: MessagesSquare,
  inventario: Flower2,
  entrega_inmediata: Zap,
  entregas_gps: MapPinCheck,
  envio_pedidos: Send,
  taller: Hammer,
  pedidos: ClipboardList,
  facturacion: Receipt,
  catalogo: ShoppingBag,
  usuarios: Users,
  testimonios: MessageSquareHeart,
  negocio: Building2,
  facturacion_sri: FileCheck2,
  logistica: Truck,
  pasarelas: CreditCard,
  aria: Bot,
  correo: Mail,
  tokens: KeyRound,
  cuenta: UserCircle,
};

export function NavegacionPanelLateral({ items }: { items: ItemNavegacionPanel[] }) {
  const pathname = usePathname() || "/panel";
  const { plegada } = useBarraLateralPanel();

  const enRutaConfiguracion =
    pathname.startsWith("/panel/configuracion") ||
    pathname.startsWith("/panel/facturacion-sri") ||
    pathname.startsWith("/panel/logistica") ||
    pathname.startsWith("/panel/pasarelas") ||
    pathname.startsWith("/panel/aria") ||
    pathname.startsWith("/panel/correo") ||
    pathname.startsWith("/panel/tokens-mcp");

  const [configAbierta, setConfigAbierta] = useState(enRutaConfiguracion);

  const itemsOperacion = items.filter((i) => i.grupo === "operacion");
  const itemsConfiguracion = items.filter((i) => i.grupo === "configuracion");
  const itemsCuenta = items.filter((i) => i.grupo === "cuenta");

  function esRutaActiva(ruta: string) {
    if (ruta === "/panel") return pathname === "/panel";
    return pathname === ruta || pathname.startsWith(`${ruta}/`);
  }

  return (
    <nav
      aria-label="Menú principal del panel"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: plegada ? "10px" : "16px",
        flex: 1,
      }}
    >
      {/* Bloque 1: Operación */}
      {itemsOperacion.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: plegada ? "4px" : "2px",
            alignItems: plegada ? "center" : "stretch",
          }}
        >
          {!plegada && (
            <div
              style={{
                fontSize: "0.66rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.09em",
                color: "rgba(255, 255, 255, 0.42)",
                padding: "0 10px 5px",
              }}
            >
              Operación
            </div>
          )}
          {itemsOperacion.map((item) => (
            <EnlaceMenuLateral
              key={item.clave}
              item={item}
              activo={esRutaActiva(item.ruta)}
              plegada={plegada}
            />
          ))}
        </div>
      )}

      {/* Bloque 2: Sección Agrupada de Configuración */}
      {itemsConfiguracion.length > 0 &&
        (plegada ? (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              paddingTop: "8px",
              borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            }}
          >
            {itemsConfiguracion.map((item) => (
              <EnlaceMenuLateral
                key={item.clave}
                item={item}
                activo={esRutaActiva(item.ruta)}
                plegada
              />
            ))}
          </div>
        ) : (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: "4px",
              background: enRutaConfiguracion
                ? "rgba(255, 255, 255, 0.055)"
                : "rgba(255, 255, 255, 0.025)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              borderRadius: "11px",
              padding: "7px 6px",
            }}
          >
            <button
              type="button"
              onClick={() => setConfigAbierta((prev) => !prev)}
              title="Mostrar u ocultar opciones de configuración"
              aria-label="Mostrar u ocultar opciones de configuración"
              aria-expanded={configAbierta}
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                width: "100%",
                padding: "6px 8px",
                background: "transparent",
                border: "none",
                borderRadius: "7px",
                color: enRutaConfiguracion ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
                fontFamily: "inherit",
                fontSize: "0.71rem",
                fontWeight: 700,
                textTransform: "uppercase",
                letterSpacing: "0.07em",
                cursor: "pointer",
              }}
            >
              <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                <Settings size={14} />
                Configuración
              </span>
              {configAbierta ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
            </button>

            {configAbierta && (
              <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "2px" }}>
                {itemsConfiguracion.map((item) => (
                  <EnlaceMenuLateral
                    key={item.clave}
                    item={item}
                    activo={esRutaActiva(item.ruta)}
                    compacto
                  />
                ))}
              </div>
            )}
          </div>
        ))}

      {/* Bloque 3: Mi Cuenta (anclado abajo) */}
      {itemsCuenta.length > 0 && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "10px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            alignItems: plegada ? "center" : "stretch",
            gap: "3px",
          }}
        >
          {itemsCuenta.map((item) => (
            <EnlaceMenuLateral
              key={item.clave}
              item={item}
              activo={esRutaActiva(item.ruta)}
              plegada={plegada}
            />
          ))}
        </div>
      )}
    </nav>
  );
}

function EnlaceMenuLateral({
  item,
  activo,
  compacto = false,
  plegada = false,
}: {
  item: ItemNavegacionPanel;
  activo: boolean;
  compacto?: boolean;
  plegada?: boolean;
}) {
  const Icono = MAPA_ICONOS[item.icono];

  if (plegada) {
    return (
      <Link
        href={item.ruta}
        aria-current={activo ? "page" : undefined}
        title={item.nombre}
        aria-label={item.nombre}
        style={{
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          width: "42px",
          height: "40px",
          borderRadius: "10px",
          textDecoration: "none",
          color: activo ? "#FFFFFF" : "rgba(255, 255, 255, 0.72)",
          background: activo
            ? "linear-gradient(135deg, rgba(236, 127, 167, 0.24), rgba(184, 146, 63, 0.22))"
            : "transparent",
          border: activo ? "1px solid rgba(236, 127, 167, 0.45)" : "1px solid transparent",
          boxShadow: activo ? "0 4px 12px rgba(0, 0, 0, 0.22)" : "none",
          transition: "background 0.15s ease, color 0.15s ease, border-color 0.15s ease",
        }}
      >
        <Icono size={18} style={{ flexShrink: 0, opacity: activo ? 1 : 0.85 }} />
      </Link>
    );
  }

  return (
    <Link
      href={item.ruta}
      aria-current={activo ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: compacto ? "7px 10px" : "8px 11px",
        borderRadius: "9px",
        textDecoration: "none",
        fontSize: compacto ? "0.82rem" : "0.85rem",
        fontWeight: activo ? 600 : 400,
        color: activo ? "#FFFFFF" : "rgba(255, 255, 255, 0.78)",
        background: activo ? "rgba(255, 255, 255, 0.12)" : "transparent",
        boxShadow: activo ? "inset 2.5px 0 0 #EC7FA7" : "none",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <Icono size={compacto ? 15 : 16} style={{ flexShrink: 0, opacity: activo ? 1 : 0.78 }} />
      <span style={{ lineHeight: 1.28 }}>{item.nombre}</span>
    </Link>
  );
}
