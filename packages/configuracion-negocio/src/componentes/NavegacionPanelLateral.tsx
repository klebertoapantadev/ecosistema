"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bot,
  Building2,
  ChevronDown,
  ChevronRight,
  KeyRound,
  LayoutDashboard,
  Mail,
  Settings,
  ShoppingBag,
  UserCircle,
  Users,
  type LucideIcon,
} from "lucide-react";

export type IconoNavegacionPanel =
  | "resumen"
  | "catalogo"
  | "usuarios"
  | "negocio"
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
  catalogo: ShoppingBag,
  usuarios: Users,
  negocio: Building2,
  aria: Bot,
  correo: Mail,
  tokens: KeyRound,
  cuenta: UserCircle,
};

export function NavegacionPanelLateral({ items }: { items: ItemNavegacionPanel[] }) {
  const pathname = usePathname() || "/panel";
  const enRutaConfiguracion =
    pathname.startsWith("/panel/configuracion") ||
    pathname.startsWith("/panel/aria") ||
    pathname.startsWith("/panel/correo") ||
    pathname.startsWith("/panel/tokens-mcp");

  const [configAbierta, setConfigAbierta] = useState(true);

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
        gap: "18px",
        flex: 1,
      }}
    >
      {/* Bloque 1: Operación */}
      {itemsOperacion.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
          <div
            style={{
              fontSize: "0.68rem",
              fontWeight: 700,
              textTransform: "uppercase",
              letterSpacing: "0.08em",
              color: "rgba(255, 255, 255, 0.45)",
              padding: "0 10px 4px",
            }}
          >
            Operación
          </div>
          {itemsOperacion.map((item) => (
            <EnlaceMenuLateral key={item.clave} item={item} activo={esRutaActiva(item.ruta)} />
          ))}
        </div>
      )}

      {/* Bloque 2: Sección Agrupada de Configuración */}
      {itemsConfiguracion.length > 0 && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "4px",
            background: enRutaConfiguracion ? "rgba(255, 255, 255, 0.05)" : "rgba(255, 255, 255, 0.025)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            borderRadius: "11px",
            padding: "8px 6px",
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
              fontSize: "0.73rem",
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
      )}

      {/* Bloque 3: Mi Cuenta (anclado abajo) */}
      {itemsCuenta.length > 0 && (
        <div
          style={{
            marginTop: "auto",
            paddingTop: "12px",
            borderTop: "1px solid rgba(255, 255, 255, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "3px",
          }}
        >
          {itemsCuenta.map((item) => (
            <EnlaceMenuLateral key={item.clave} item={item} activo={esRutaActiva(item.ruta)} />
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
}: {
  item: ItemNavegacionPanel;
  activo: boolean;
  compacto?: boolean;
}) {
  const Icono = MAPA_ICONOS[item.icono];
  return (
    <Link
      href={item.ruta}
      aria-current={activo ? "page" : undefined}
      style={{
        display: "flex",
        alignItems: "center",
        gap: "9px",
        padding: compacto ? "8px 10px" : "9px 11px",
        borderRadius: "8px",
        textDecoration: "none",
        fontSize: compacto ? "0.84rem" : "0.88rem",
        fontWeight: activo ? 600 : 400,
        color: activo ? "#FFFFFF" : "rgba(255, 255, 255, 0.78)",
        background: activo ? "rgba(255, 255, 255, 0.13)" : "transparent",
        boxShadow: activo ? "inset 2px 0 0 #FFFFFF" : "none",
        transition: "background 0.15s ease, color 0.15s ease",
      }}
    >
      <Icono size={compacto ? 15 : 16} style={{ flexShrink: 0, opacity: activo ? 1 : 0.78 }} />
      <span style={{ lineHeight: 1.3 }}>{item.nombre}</span>
    </Link>
  );
}

