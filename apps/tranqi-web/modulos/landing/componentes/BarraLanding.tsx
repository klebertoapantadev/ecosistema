"use client";

import { useEffect, useRef, useState } from "react";
import { Ico } from "./IconosLanding";

/** Barra fija de la landing: menú con el desplegable de Planes y hamburguesa en móvil. */
export function BarraLanding() {
  const [abierta, setAbierta] = useState(false);
  const [planes, setPlanes] = useState(false);
  const desplegable = useRef<HTMLLIElement>(null);

  useEffect(() => {
    const fuera = (e: MouseEvent) => {
      if (!desplegable.current?.contains(e.target as Node)) setPlanes(false);
    };
    document.addEventListener("click", fuera);
    return () => document.removeEventListener("click", fuera);
  }, []);

  const cerrar = () => {
    setAbierta(false);
    setPlanes(false);
  };

  return (
    <nav className={`barra${abierta ? " abierta" : ""}`}>
      <div className="wrap">
        <a className="logo" href="#hero" onClick={cerrar}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/assets/tranqi-white.svg" alt="tranqi" />
        </a>
        <button
          className="hamburguesa"
          type="button"
          aria-label={abierta ? "Cerrar menú" : "Abrir menú"}
          aria-expanded={abierta}
          onClick={() => setAbierta((v) => !v)}
        >
          <Ico nombre="menu" />
        </button>
        <ul className="menu">
          <li ref={desplegable} className={`desplegable${planes ? " abierto" : ""}`}>
            <button type="button" aria-expanded={planes} aria-haspopup="true" onClick={() => setPlanes((v) => !v)}>
              Planes <Ico nombre="abajo" />
            </button>
            <ul className="submenu">
              <li>
                <a href="#planes" onClick={cerrar}>
                  <Ico nombre="familia" />
                  <div><b>Personas</b><span>Individual y familiar, desde $23 al año</span></div>
                </a>
              </li>
              <li>
                <a href="/empresas/contacto">
                  <Ico nombre="edificio" />
                  <div><b>Empresas</b><span>Protección jurídica para tu equipo</span></div>
                </a>
              </li>
            </ul>
          </li>
          <li><a href="#como" onClick={cerrar}>Cómo funciona</a></li>
          <li><a href="#beneficios" onClick={cerrar}>Beneficios</a></li>
          <li><a href="#red" onClick={cerrar}>Red profesional</a></li>
          <li><a href="#nosotros" onClick={cerrar}>Nosotros</a></li>
          <li><a href="#contacto" onClick={cerrar}>Contacto</a></li>
          <li><a className="ingresar" href="/ingresar">Ingresar</a></li>
        </ul>
      </div>
    </nav>
  );
}
