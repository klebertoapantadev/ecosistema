"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, ShoppingBag, X } from "lucide-react";

export interface PropsMarcoPanelLateral {
  marcaNombre: string;
  marcaHref?: string;
  etiquetaRol?: string;
  estiloBadgeRol?: { bg: string; color: string };
  urlTienda?: string;
  etiquetaTienda?: string;
  barraLateral: React.ReactNode;
  children: React.ReactNode;
}

export function MarcoPanelLateral({
  marcaNombre,
  marcaHref = "/panel",
  etiquetaRol,
  estiloBadgeRol,
  urlTienda = "/",
  etiquetaTienda = "Tienda",
  barraLateral,
  children,
}: PropsMarcoPanelLateral) {
  const pathname = usePathname();
  const [menuAbierto, setMenuAbierto] = useState(false);

  useEffect(() => {
    setMenuAbierto(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuAbierto) return;
    const alPresionarTecla = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") setMenuAbierto(false);
    };
    window.addEventListener("keydown", alPresionarTecla);
    const overflowPrevio = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", alPresionarTecla);
      document.body.style.overflow = overflowPrevio;
    };
  }, [menuAbierto]);

  return (
    <div className="panel-layout">
      {/* Barra superior exclusiva para móvil/tablet (<= 880px) */}
      <header className="panel-barra-movil">
        <div className="panel-barra-movil-izq">
          <button
            type="button"
            className="panel-btn-hamburguesa"
            onClick={() => setMenuAbierto(true)}
            title="Abrir menú del panel"
            aria-label="Abrir menú del panel"
            aria-expanded={menuAbierto}
          >
            <Menu size={20} />
          </button>
          <Link href={marcaHref} className="panel-marca-movil">
            {marcaNombre}
          </Link>
          {etiquetaRol && (
            <span
              className="etiqueta-superadmin panel-rol-movil"
              style={
                estiloBadgeRol
                  ? { background: estiloBadgeRol.bg, color: estiloBadgeRol.color }
                  : undefined
              }
            >
              {etiquetaRol}
            </span>
          )}
        </div>

        {urlTienda && (
          <Link
            href={urlTienda}
            className="panel-link-tienda-movil"
            title={`Ir a ${etiquetaTienda}`}
            aria-label={`Ir a ${etiquetaTienda}`}
          >
            <ShoppingBag size={15} />
            <span>{etiquetaTienda}</span>
          </Link>
        )}
      </header>

      {/* Fondo semitransparente al abrir el menú en móvil */}
      <div
        className={`panel-nav-backdrop${menuAbierto ? " activo" : ""}`}
        onClick={() => setMenuAbierto(false)}
        aria-hidden="true"
      />

      {/* Menú lateral (fijo en desktop, drawer deslizable en móvil) */}
      <aside
        className={`panel-nav${menuAbierto ? " panel-nav-abierto" : ""}`}
        onClick={(ev) => {
          const target = ev.target as HTMLElement | null;
          if (target?.closest("a")) {
            setMenuAbierto(false);
          }
        }}
      >
        <button
          type="button"
          className="panel-nav-btn-cerrar"
          onClick={() => setMenuAbierto(false)}
          title="Cerrar menú"
          aria-label="Cerrar menú"
        >
          <X size={18} />
        </button>
        {barraLateral}
      </aside>

      <main className="panel-contenido">{children}</main>
    </div>
  );
}
