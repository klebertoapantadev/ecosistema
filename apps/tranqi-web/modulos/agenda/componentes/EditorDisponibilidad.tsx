"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { DIAS_SEMANA, describirAgenda, huecosPorSemana, type Franja } from "@eco/agenda";
import { guardarDisponibilidadAction } from "../acciones";

// Editor de horas operativas (TRQ-ABG-004, PLT-020 regla 2).
//
// El mismo `age_fn_configurar_agenda` que llama el asistente por chat, para que
// las dos vías no puedan divergir. Y el contador de huecos por semana se calcula
// en el navegador con la misma aritmética que el RPC (@eco/agenda): el abogado
// ve el efecto de subir la holgura antes de guardar, no después de quedarse sin
// citas.

interface Props {
  configuracionInicial: {
    zona_horaria: string;
    duracion_cita_min: number;
    holgura_min: number;
    antelacion_minima_horas: number;
    horizonte_dias: number;
    modalidades: string[];
    acepta_turno: boolean;
    direccion: string | null;
  };
  franjasIniciales: Franja[];
}

const HORARIO_SUGERIDO: Franja[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
];

export default function EditorDisponibilidad({ configuracionInicial, franjasIniciales }: Props) {
  const router = useRouter();
  const [config, setConfig] = useState(configuracionInicial);
  const [franjas, setFranjas] = useState<Franja[]>(franjasIniciales);
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();

  const agenda = {
    configuracion: { ...config, modalidades: config.modalidades as ("virtual" | "presencial")[] },
    franjas,
  };
  let huecos = 0;
  try {
    huecos = huecosPorSemana(agenda);
  } catch {
    huecos = 0;
  }

  function actualizarFranja(indice: number, cambio: Partial<Franja>) {
    setFranjas((f) => f.map((x, i) => (i === indice ? { ...x, ...cambio } : x)));
    setGuardado(false);
  }

  function guardar() {
    setError(null);
    setGuardado(false);
    iniciarEnvio(async () => {
      const r = await guardarDisponibilidadAction(agenda);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setGuardado(true);
      router.refresh();
    });
  }

  return (
    <div className="agenda-editor">
      <section>
        <h2>Días y horas en que atiendes</h2>
        {franjas.length === 0 ? (
          <>
            <p className="estado-vacio">
              No tienes ninguna franja. Mientras esté así no apareces disponible para ningún
              afiliado ni recibes citas por turno.
            </p>
            <button type="button" className="btn btn-blanco-borde" onClick={() => setFranjas(HORARIO_SUGERIDO)}>
              Empezar con lunes a viernes, 09:00–13:00
            </button>
          </>
        ) : (
          <ul className="agenda-franjas">
            {franjas.map((f, i) => (
              <li key={i} className="agenda-franja">
                <select
                  aria-label="Día"
                  value={f.dia_semana}
                  onChange={(e) => actualizarFranja(i, { dia_semana: Number(e.target.value) })}
                >
                  {DIAS_SEMANA.map((d, n) => (
                    <option key={n} value={n}>
                      {d}
                    </option>
                  ))}
                </select>
                <input
                  type="time"
                  aria-label="Desde"
                  value={f.hora_inicio.slice(0, 5)}
                  onChange={(e) => actualizarFranja(i, { hora_inicio: e.target.value })}
                />
                <span>a</span>
                <input
                  type="time"
                  aria-label="Hasta"
                  value={f.hora_fin.slice(0, 5)}
                  onChange={(e) => actualizarFranja(i, { hora_fin: e.target.value })}
                />
                <select
                  aria-label="Modalidad"
                  value={f.modalidad}
                  onChange={(e) => actualizarFranja(i, { modalidad: e.target.value as Franja["modalidad"] })}
                >
                  <option value="ambas">Ambas</option>
                  <option value="virtual">Solo videollamada</option>
                  <option value="presencial">Solo presencial</option>
                </select>
                <button
                  type="button"
                  className="accion-menor"
                  onClick={() => setFranjas((fs) => fs.filter((_, k) => k !== i))}
                >
                  Quitar
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          className="accion-menor"
          onClick={() =>
            setFranjas((f) => [...f, { dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" }])
          }
        >
          + Añadir franja
        </button>
      </section>

      <section>
        <h2>Cómo son tus citas</h2>
        <div className="agenda-parametros">
          <label>
            Duración
            <select
              value={config.duracion_cita_min}
              onChange={(e) => setConfig({ ...config, duracion_cita_min: Number(e.target.value) })}
            >
              {[15, 30, 45, 60, 90, 120].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
          <label>
            Descanso entre citas
            <select
              value={config.holgura_min}
              onChange={(e) => setConfig({ ...config, holgura_min: Number(e.target.value) })}
            >
              {[0, 5, 10, 15, 30].map((n) => (
                <option key={n} value={n}>
                  {n} minutos
                </option>
              ))}
            </select>
          </label>
          <label>
            Antelación mínima
            <select
              value={config.antelacion_minima_horas}
              onChange={(e) => setConfig({ ...config, antelacion_minima_horas: Number(e.target.value) })}
            >
              {[1, 2, 6, 12, 24, 48, 72].map((n) => (
                <option key={n} value={n}>
                  {n} horas
                </option>
              ))}
            </select>
          </label>
          <label>
            Se puede reservar hasta
            <select
              value={config.horizonte_dias}
              onChange={(e) => setConfig({ ...config, horizonte_dias: Number(e.target.value) })}
            >
              {[15, 30, 60, 90, 180].map((n) => (
                <option key={n} value={n}>
                  {n} días
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="campo-check">
          <input
            type="checkbox"
            checked={config.acepta_turno}
            onChange={(e) => setConfig({ ...config, acepta_turno: e.target.checked })}
          />{" "}
          Recibir casos nuevos por turno rotativo
        </label>

        {config.modalidades.includes("presencial") && (
          <label className="etiqueta-campo">
            Dirección del despacho
            <input
              type="text"
              value={config.direccion ?? ""}
              onChange={(e) => setConfig({ ...config, direccion: e.target.value })}
              maxLength={300}
            />
          </label>
        )}

        <label className="etiqueta-campo">
          Zona horaria
          <select value={config.zona_horaria} onChange={(e) => setConfig({ ...config, zona_horaria: e.target.value })}>
            <option value="America/Guayaquil">Ecuador continental</option>
            <option value="Pacific/Galapagos">Galápagos</option>
          </select>
        </label>
      </section>

      <p className="agenda-resumen">
        <strong>{huecos} citas por semana.</strong> {describirAgenda(agenda)}
      </p>

      {error && <p className="editor-error">{error}</p>}
      {guardado && <p className="editor-ok">Guardado. Ya apareces disponible con este horario.</p>}

      <button type="button" className="btn btn-primario" onClick={guardar} disabled={enviando}>
        {enviando ? "Guardando…" : "Guardar disponibilidad"}
      </button>
    </div>
  );
}
