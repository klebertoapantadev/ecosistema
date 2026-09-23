"use client";

import { ArrowLeft } from "lucide-react";

/**
 * Salida visible de una subvista del panel hacia la vista que la abrió
 * (TRQ-012). Sustituye a la X circular: una X se lee como "descartar", y lo que
 * pedían las pruebas era una flecha para retroceder entre secciones. En móvil
 * queda solo el icono (`.btn-responsive-accion`), con el destino en
 * `aria-label` y `title`.
 */
export function BotonVolverWidget({ onClick, destino }: { onClick: () => void; destino: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="boton-volver-widget btn-responsive-accion"
      title={`Volver a ${destino}`}
      aria-label={`Volver a ${destino}`}
    >
      <ArrowLeft size={18} strokeWidth={2} aria-hidden="true" />
      <span className="btn-texto-responsive">Volver</span>
    </button>
  );
}
