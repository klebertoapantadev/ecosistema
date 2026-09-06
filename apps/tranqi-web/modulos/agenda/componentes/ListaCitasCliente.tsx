"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salaAbierta } from "@eco/agenda";
import { decidirCitaAction } from "../acciones";
import { ETIQUETA_COBERTURA, ETIQUETA_ESTADO_CITA } from "../esquema";
import type { CitaResumen } from "../consultas";

const FORMATO = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const HORAS_SIN_PENALIZACION = 24;

export default function ListaCitasCliente({ citas }: { citas: CitaResumen[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  function cancelar(cita: CitaResumen, motivo: string) {
    setError(null);
    iniciarEnvio(async () => {
      const r = await decidirCitaAction({ cita_id: cita.cit_id, decision: "cancelar", motivo });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setCancelando(null);
      router.refresh();
    });
  }

  if (citas.length === 0) {
    return <p className="estado-vacio">Todavía no tienes ninguna cita. Puedes agendar una cuando quieras.</p>;
  }

  return (
    <>
      {error && <p className="editor-error">{error}</p>}
      <ul className="agenda-lista-citas">
        {citas.map((c) => {
          const inicio = new Date(c.cit_inicio_en);
          const fin = c.cit_fin_en ? new Date(c.cit_fin_en) : new Date(inicio.getTime() + 45 * 60_000);
          const abierta = salaAbierta(inicio, fin);
          const futura = inicio.getTime() > Date.now();
          const conPenalizacion = inicio.getTime() - Date.now() < HORAS_SIN_PENALIZACION * 3_600_000;
          const cancelable = futura && c.cit_estado !== "cancelada" && c.cit_estado !== "realizada";

          return (
            <li key={c.cit_id} className="agenda-cita">
              <div className="agenda-cita-cabeza">
                <strong>{FORMATO.format(inicio)}</strong>
                <span className="pildora-estado">{ETIQUETA_ESTADO_CITA[c.cit_estado] ?? c.cit_estado}</span>
              </div>
              <p className="agenda-cita-meta">
                {c.cit_modalidad === "virtual" ? "Videollamada" : "Presencial"} ·{" "}
                {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
                {c.cit_asignacion === "contingencia" && " · Reasignando abogado"}
              </p>
              {c.cit_motivo && <p className="agenda-cita-motivo">{c.cit_motivo}</p>}

              {c.cit_asignacion === "contingencia" && (
                <p className="agenda-aviso">
                  Tu abogado no podrá atenderte a esa hora. Estamos asignándote otro y mantenemos tu
                  cita en el mismo horario; te avisaremos en cuanto esté confirmado.
                </p>
              )}

              {c.cit_modalidad === "virtual" && c.cit_estado === "confirmada" && (
                abierta && c.cit_enlace ? (
                  <a className="btn btn-primario" href={c.cit_enlace} target="_blank" rel="noreferrer">
                    Entrar a la videollamada
                  </a>
                ) : futura ? (
                  <p className="agenda-nota">El enlace se activa 10 minutos antes de la cita.</p>
                ) : null
              )}

              {cancelable &&
                (cancelando === c.cit_id ? (
                  <form
                    className="agenda-cancelar"
                    action={(datos) => cancelar(c, String(datos.get("motivo") ?? ""))}
                  >
                    <label className="etiqueta-campo" htmlFor={`motivo-${c.cit_id}`}>
                      ¿Por qué la cancelas?
                    </label>
                    <input id={`motivo-${c.cit_id}`} name="motivo" type="text" maxLength={200} />
                    {conPenalizacion && c.cit_cobertura === "plan" && (
                      <p className="agenda-aviso">
                        Faltan menos de {HORAS_SIN_PENALIZACION} horas: esta consulta no volverá a tu
                        plan si la cancelas ahora.
                      </p>
                    )}
                    <div className="fila-botones">
                      <button type="submit" className="btn btn-peligro" disabled={enviando}>
                        {enviando ? "Cancelando…" : "Sí, cancelar"}
                      </button>
                      <button type="button" className="btn btn-blanco-borde" onClick={() => setCancelando(null)}>
                        Volver
                      </button>
                    </div>
                  </form>
                ) : (
                  <button type="button" className="accion-menor" onClick={() => setCancelando(c.cit_id)}>
                    Cancelar cita
                  </button>
                ))}
            </li>
          );
        })}
      </ul>
    </>
  );
}
