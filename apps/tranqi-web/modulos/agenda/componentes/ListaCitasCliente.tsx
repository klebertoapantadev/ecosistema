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

export default function ListaCitasCliente({
  citas,
  alActualizar,
}: {
  citas: CitaResumen[];
  alActualizar?: () => void;
}) {
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
      alActualizar?.();
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
                {c.cit_modalidad === "virtual" ? "🎥 Videollamada" : "🏢 Presencial"} ·{" "}
                {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
                {c.materia_nombre ? ` · ⚖️ ${c.materia_nombre}` : ""}
              </p>
              {c.abogado_nombre && (
                <p
                  style={{
                    margin: "4px 0 6px 0",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    color: "#059669",
                  }}
                >
                  👨‍⚖️ Abogado asignado: Dr(a). {c.abogado_nombre}
                </p>
              )}
              {c.cit_motivo && <p className="agenda-cita-motivo">{c.cit_motivo}</p>}
              {c.caso_vinculado && (
                <div
                  style={{
                    margin: "6px 0",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    background: "#F5F3FF",
                    border: "1px solid #DDD6FE",
                    fontSize: "0.8rem",
                    color: "#4C1D95",
                  }}
                >
                  <strong>📁 Expediente / Caso vinculado:</strong> {c.caso_vinculado.cas_titulo} (
                  {c.caso_vinculado.cas_estado.replace("_", " ")})
                </div>
              )}
              {c.gestion_reunion?.siguientes_pasos &&
                c.gestion_reunion.siguientes_pasos.length > 0 && (
                  <div
                    style={{
                      margin: "6px 0",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      fontSize: "0.8rem",
                    }}
                  >
                    <strong style={{ display: "block", marginBottom: "4px", color: "#0F172A" }}>
                      📌 Siguientes pasos acordados en tu consulta:
                    </strong>
                    <ul style={{ margin: 0, paddingLeft: "18px", color: "#334155" }}>
                      {c.gestion_reunion.siguientes_pasos.map((p) => (
                        <li key={p.id}>
                          {p.descripcion} — <em>Responsable: {p.responsable_nombre} ({p.responsable_rol})</em>
                        </li>
                      ))}
                    </ul>
                  </div>
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
