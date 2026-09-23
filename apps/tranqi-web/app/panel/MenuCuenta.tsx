"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, CircleUser, ShieldCheck, Check } from "lucide-react";
import { BotonCerrarSesion } from "./BotonCerrarSesion";
import { ROLES_DEFAULT } from "./SelectorRolActivo";

/** Menú de cuenta de la barra superior del inicio (TRQ-013, variante 5A).
 *  Sustituye al enlace suelto con la foto y a la etiqueta amarilla "Rol
 *  Activo" del rail: perfil, seguridad, "ver como" (solo quien puede
 *  conmutar, TRQ-007) y cerrar sesión, en un solo sitio.
 *
 *  Teclado del patrón menu de WAI-ARIA: ↓ ↑ Inicio Fin recorren, Esc cierra y
 *  devuelve el foco al botón, Tab cierra. */
export function MenuCuenta({
  nombreCompleto,
  correo,
  fotoUrl,
  iniciales,
  rolTexto,
  puedeConmutar,
  modoActual,
}: {
  nombreCompleto: string;
  correo: string | null;
  fotoUrl: string | null;
  iniciales: string;
  rolTexto: string;
  puedeConmutar: boolean;
  modoActual: string;
}) {
  const router = useRouter();
  const [abierto, setAbierto] = useState(false);
  const boton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  const elementos = () => Array.from(menu.current?.querySelectorAll<HTMLElement>('[role^="menuitem"]') ?? []);

  function cerrar(devolverFoco: boolean) {
    setAbierto(false);
    if (devolverFoco) boton.current?.focus();
  }

  // Al abrir, el foco entra en el menú: en el rol marcado si lo hay.
  useEffect(() => {
    if (!abierto) return;
    const lista = elementos();
    (lista.find((el) => el.getAttribute("aria-checked") === "true") ?? lista[0])?.focus();
    const fuera = (e: MouseEvent) => {
      if (!menu.current?.contains(e.target as Node) && !boton.current?.contains(e.target as Node)) setAbierto(false);
    };
    document.addEventListener("mousedown", fuera);
    return () => document.removeEventListener("mousedown", fuera);
  }, [abierto]);

  function teclado(e: React.KeyboardEvent) {
    const lista = elementos();
    const k = lista.indexOf(document.activeElement as HTMLElement);
    const mapa: Record<string, number> = { ArrowDown: k + 1, ArrowUp: k - 1, Home: 0, End: lista.length - 1 };
    const destino = mapa[e.key];
    if (destino !== undefined) {
      e.preventDefault();
      lista[(destino + lista.length) % lista.length]?.focus();
    } else if (e.key === "Escape") {
      e.preventDefault();
      cerrar(true);
    } else if (e.key === "Tab") {
      setAbierto(false);
    }
  }

  // Mismo cambio de rol que SelectorRolActivo: cookie + ?modo= + refresh,
  // conservando el resto de parámetros de la URL (widget abierto, filtros).
  function verComo(clave: string) {
    const modo = clave.toLowerCase();
    document.cookie = `tranqi_modo_rol=${modo}; path=/; max-age=31536000; SameSite=Lax`;
    cerrar(true);
    const params = new URLSearchParams(window.location.search);
    params.set("modo", modo);
    router.push(`${window.location.pathname}?${params.toString()}`);
    router.refresh();
  }

  return (
    <div className="menu-cuenta">
      <button
        ref={boton}
        type="button"
        className="menu-cuenta-boton"
        aria-haspopup="menu"
        aria-expanded={abierto}
        aria-controls="menu-cuenta-lista"
        onClick={() => setAbierto((a) => !a)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" || e.key === "ArrowUp") {
            e.preventDefault();
            setAbierto(true);
          }
        }}
      >
        <span className="menu-cuenta-foto">
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={fotoUrl} alt="" />
          ) : (
            iniciales
          )}
        </span>
        <span className="menu-cuenta-txt">
          <b>{nombreCompleto}</b>
          <span>{rolTexto}</span>
        </span>
        <ChevronDown size={15} aria-hidden="true" className="menu-cuenta-flecha" />
      </button>

      <div
        ref={menu}
        id="menu-cuenta-lista"
        role="menu"
        aria-label="Cuenta"
        className={`menu-cuenta-lista${abierto ? " es-abierto" : ""}`}
        onKeyDown={teclado}
      >
        <div className="menu-cuenta-yo">
          <b>{nombreCompleto}</b>
          {correo && <span>{correo}</span>}
        </div>
        <div className="menu-cuenta-sep" role="separator" />
        <Link href="/panel/cuenta" role="menuitem" tabIndex={-1} className="menu-cuenta-item" onClick={() => setAbierto(false)}>
          <CircleUser size={17} aria-hidden="true" />
          Mi cuenta
        </Link>
        <Link href="/panel/cuenta?widget=mfa_seguridad" role="menuitem" tabIndex={-1} className="menu-cuenta-item" onClick={() => setAbierto(false)}>
          <ShieldCheck size={17} aria-hidden="true" />
          Seguridad
        </Link>
        {puedeConmutar && (
          <>
            <div className="menu-cuenta-sep" role="separator" />
            <span className="menu-cuenta-etiqueta">Ver como</span>
            {ROLES_DEFAULT.map((r) => {
              const marcado = r.clave.toLowerCase() === modoActual.toLowerCase();
              return (
                <button
                  key={r.clave}
                  type="button"
                  role="menuitemradio"
                  aria-checked={marcado}
                  tabIndex={-1}
                  className="menu-cuenta-item"
                  onClick={() => (marcado ? cerrar(true) : verComo(r.clave))}
                >
                  <Check size={17} aria-hidden="true" className="menu-cuenta-marca" />
                  {r.nombre}
                </button>
              );
            })}
          </>
        )}
        <div className="menu-cuenta-sep" role="separator" />
        <BotonCerrarSesion variante="menu" />
      </div>
    </div>
  );
}
