import { Check } from "lucide-react";

/** Hitos del recorrido cuando termina en una cita (TRQ-041). */
export const HITOS_CITA = ["Tu necesidad", "Tu especialista", "Tu cita", "En marcha"] as const;
/** Hitos del recorrido cuando termina en un trámite (TRQ-043). */
export const HITOS_TRAMITE = ["Tu necesidad", "Tu trámite", "Pedirlo", "En marcha"] as const;

/** Los cuatro hitos del recorrido, siempre visibles: orientan sin ser pestañas. */
export function CaminoRecorrido({ hito, etiquetas = HITOS_CITA }: { hito: number; etiquetas?: readonly string[] }) {
  return (
    <ol className="camino-recorrido" aria-label="Progreso">
      {etiquetas.map((nombre, i) => {
        const estado = i < hito ? "es-hecho" : i === hito ? "es-activo" : "";
        return (
          <li key={nombre} className={estado} aria-current={i === hito ? "step" : undefined}>
            <span className="camino-numero" aria-hidden="true">
              {i < hito ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className="camino-etiqueta">{nombre}</span>
          </li>
        );
      })}
    </ol>
  );
}
