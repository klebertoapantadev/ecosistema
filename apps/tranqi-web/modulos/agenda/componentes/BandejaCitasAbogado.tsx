"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { salaAbierta } from "@eco/agenda";
import { decidirCitaAction } from "../acciones";
import { ETIQUETA_COBERTURA, ETIQUETA_ESTADO_CITA } from "../esquema";
import type { CitaResumen } from "../consultas";

const FORMATO = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "numeric",
  month: "short",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

export default function BandejaCitasAbogado({ citas }: { citas: CitaResumen[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [reagendando, setReagendando] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  function decidir(citaId: string, decision: string, nuevoInicio?: string, motivo?: string) {
    setError(null);
    iniciarEnvio(async () => {
      const r = await decidirCitaAction({
        cita_id: citaId,
        decision,
        nuevo_inicio: nuevoInicio ?? null,
        motivo: motivo ?? null,
      });
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setReagendando(null);
      router.refresh();
    });
  }

  if (citas.length === 0) {
    return <p className="estado-vacio">No tienes citas en los próximos siete días.</p>;
  }

  const porConfirmar = citas.filter((c) => c.cit_estado === "propuesta");
  const resto = citas.filter((c) => c.cit_estado !== "propuesta");

  function tarjeta(c: CitaResumen) {
    const inicio = new Date(c.cit_inicio_en);
    const fin = c.cit_fin_en ? new Date(c.cit_fin_en) : new Date(inicio.getTime() + 45 * 60_000);
    const abierta = salaAbierta(inicio, fin);
    const pasada = fin.getTime() < Date.now();

    return (
      <li key={c.cit_id} className="agenda-cita">
        <div className="agenda-cita-cabeza">
          <strong>{FORMATO.format(inicio)}</strong>
          <span className="pildora-estado">{ETIQUETA_ESTADO_CITA[c.cit_estado] ?? c.cit_estado}</span>
        </div>
        <p className="agenda-cita-meta">
          {c.cit_modalidad === "virtual" ? "Videollamada" : "Presencial"} ·{" "}
          {ETIQUETA_COBERTURA[c.cit_cobertura] ?? c.cit_cobertura}
        </p>
        {c.cit_motivo && <p className="agenda-cita-motivo">{c.cit_motivo}</p>}

        {c.cit_modalidad === "virtual" && abierta && c.cit_enlace && (
          <a className="btn btn-primario" href={c.cit_enlace} target="_blank" rel="noreferrer">
            Entrar a la videollamada
          </a>
        )}

        <div className="fila-botones">
          {c.cit_estado === "propuesta" && (
            <button
              type="button"
              className="btn btn-primario"
              onClick={() => decidir(c.cit_id, "confirmar")}
              disabled={enviando}
            >
              Confirmar
            </button>
          )}
          {!pasada && c.cit_estado !== "cancelada" && (
            <>
              <button type="button" className="accion-menor" onClick={() => setReagendando(c.cit_id)}>
                Reagendar
              </button>
              <button
                type="button"
                className="accion-menor"
                onClick={() =>
                  decidir(c.cit_id, "cancelar", undefined, "El abogado no puede atender a esa hora")
                }
                disabled={enviando}
              >
                No puedo atenderla
              </button>
            </>
          )}
          {pasada && c.cit_estado === "confirmada" && (
            <>
              <button
                type="button"
                className="accion-menor"
                onClick={() => decidir(c.cit_id, "marcar_realizada")}
                disabled={enviando}
              >
                Marcar realizada
              </button>
              <button
                type="button"
                className="accion-menor"
                onClick={() => decidir(c.cit_id, "marcar_no_asistio")}
                disabled={enviando}
              >
                No asistió
              </button>
            </>
          )}
        </div>

        {reagendando === c.cit_id && (
          <form
            className="agenda-reagendar"
            action={(datos) => {
              const valor = String(datos.get("nuevo") ?? "");
              if (!valor) return;
              // El input datetime-local da hora local del navegador; se envía
              // como instante para que el servidor no tenga que adivinar.
              decidir(c.cit_id, "reagendar", new Date(valor).toISOString(), String(datos.get("motivo") ?? ""));
            }}
          >
            <label className="etiqueta-campo" htmlFor={`nuevo-${c.cit_id}`}>
              Nueva fecha y hora
            </label>
            <input id={`nuevo-${c.cit_id}`} name="nuevo" type="datetime-local" required />
            <input name="motivo" type="text" placeholder="Motivo (opcional)" maxLength={200} />
            <div className="fila-botones">
              <button type="submit" className="btn btn-primario" disabled={enviando}>
                Mover la cita
              </button>
              <button type="button" className="btn btn-blanco-borde" onClick={() => setReagendando(null)}>
                Volver
              </button>
            </div>
          </form>
        )}
      </li>
    );
  }

  return (
    <>
      {error && <p className="editor-error">{error}</p>}

      {porConfirmar.length > 0 && (
        <section>
          <h3>Pendientes de que las confirmes ({porConfirmar.length})</h3>
          <p className="agenda-nota">
            Mientras no las confirmes, el afiliado no sabe si cuenta contigo.
          </p>
          <ul className="agenda-lista-citas">{porConfirmar.map(tarjeta)}</ul>
        </section>
      )}

      {resto.length > 0 && (
        <section>
          <h3>Confirmadas</h3>
          <ul className="agenda-lista-citas">{resto.map(tarjeta)}</ul>
        </section>
      )}
    </>
  );
}
