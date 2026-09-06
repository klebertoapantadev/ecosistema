"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reasignarCitaAction } from "../acciones";
import type { CitaResumen } from "../consultas";

// Mesa de contingencia (PLT-020 regla 4).
//
// Cada fila de aquí es un afiliado que tiene una cita en pie y ningún abogado
// detrás, porque el que tenía canceló. No se le canceló la cita a propósito:
// trasladarle el problema sería lo cómodo para la plataforma y lo peor para él.
// Pero eso solo funciona si alguien mira esta pantalla — una alerta que nadie
// atiende deja al cliente esperando a nadie.

const FORMATO = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

interface AbogadoOpcion {
  abg_id: string;
  nombre: string;
}

export default function MesaAsignaciones({
  citas,
  abogados,
}: {
  citas: CitaResumen[];
  abogados: AbogadoOpcion[];
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  function reasignar(citaId: string, abogadoId: string, motivo: string) {
    setError(null);
    iniciarEnvio(async () => {
      const r = await reasignarCitaAction({
        cita_id: citaId,
        abogado_destino: abogadoId,
        motivo: motivo || null,
      });
      if (!r.ok) {
        // El caso típico: el abogado destino ya tiene algo a esa hora y la
        // restricción de solape lo rechaza. Mejor enterarse aquí que el día de
        // la cita.
        setError(r.error);
        return;
      }
      router.refresh();
    });
  }

  if (citas.length === 0) {
    return <p className="estado-vacio">No hay ninguna cita esperando abogado.</p>;
  }

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      <ul className="agenda-lista-citas">
        {citas.map((c) => {
          const inicio = new Date(c.cit_inicio_en);
          const horasRestantes = Math.round((inicio.getTime() - Date.now()) / 3_600_000);
          return (
            <li key={c.cit_id} className="agenda-cita agenda-cita-urgente">
              <div className="agenda-cita-cabeza">
                <strong>{FORMATO.format(inicio)}</strong>
                <span className="pildora-estado">
                  {horasRestantes < 24 ? `en ${horasRestantes} h` : `en ${Math.round(horasRestantes / 24)} días`}
                </span>
              </div>
              {c.cit_motivo && <p className="agenda-cita-motivo">{c.cit_motivo}</p>}
              <p className="agenda-cita-meta">
                {c.cit_modalidad === "virtual" ? "Videollamada" : "Presencial"} · sin abogado asignado
              </p>

              <form
                className="agenda-reasignar"
                action={(datos) =>
                  reasignar(c.cit_id, String(datos.get("abogado") ?? ""), String(datos.get("motivo") ?? ""))
                }
              >
                <label className="etiqueta-campo" htmlFor={`abogado-${c.cit_id}`}>
                  Asignar a
                </label>
                <select id={`abogado-${c.cit_id}`} name="abogado" required defaultValue="">
                  <option value="" disabled>
                    Elige un abogado…
                  </option>
                  {abogados.map((a) => (
                    <option key={a.abg_id} value={a.abg_id}>
                      {a.nombre}
                    </option>
                  ))}
                </select>
                <input name="motivo" type="text" placeholder="Motivo (opcional)" maxLength={200} />
                <button type="submit" className="btn btn-primario" disabled={enviando}>
                  {enviando ? "Asignando…" : "Asignar y confirmar"}
                </button>
              </form>
            </li>
          );
        })}
      </ul>
    </>
  );
}
