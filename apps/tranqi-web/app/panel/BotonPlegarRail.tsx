"use client";

import { PanelLeft } from "lucide-react";
import { useRail } from "./CapaPerfilRail";

/** Pliega el rail a solo iconos (TRQ-013, variante 1A del muestrario).
 *  Plegado, el contenido gana ~164 px: justo el hueco que en monitores medios
 *  empujaba la columna derecha del inicio fuera de cuadro.
 *
 *  En móvil (≤860 px) no se muestra: allí el rail ya es una barra inferior. */
export function BotonPlegarRail() {
  const { plegado, alternar } = useRail();
  return (
    <button
      type="button"
      className="btn-plegar-rail"
      onClick={alternar}
      aria-expanded={!plegado}
      aria-label={plegado ? "Desplegar menú" : "Plegar menú"}
      title={plegado ? "Desplegar menú" : "Plegar menú"}
    >
      <PanelLeft className="icono-nav" aria-hidden="true" strokeWidth={1.8} />
    </button>
  );
}
