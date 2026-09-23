"use client";

import { useLayoutEffect, useRef, useState } from "react";
import Link from "next/link";
import { Scale, Check, Clock } from "lucide-react";
import type { CasoReciente, EstadoCaso } from "../consultas";

/** El caso abierto más reciente del cliente (TRQ-013).
 *  Arriba, en qué etapa está (variante 6B); debajo, su detalle en pestañas
 *  con indicador deslizante (4A). Todo sale de trq_caso_judicial y sus
 *  documentos y citas: la maqueta traía también "Pagos" y "Mensajes", que no
 *  tienen tabla de la que leer, y no se trasladaron. */

const ETAPAS: { estado: EstadoCaso; nombre: string }[] = [
  { estado: "nuevo", nombre: "Recibido" },
  { estado: "asignado", nombre: "Asignado" },
  { estado: "en_curso", nombre: "En curso" },
  { estado: "cerrado", nombre: "Cerrado" },
];

const PILDORA: Record<EstadoCaso, { texto: string; clase: string }> = {
  nuevo: { texto: "Recibido", clase: "estado-pill es-accion" },
  asignado: { texto: "Asignado", clase: "estado-pill es-accion" },
  en_curso: { texto: "En curso", clase: "estado-pill es-ok" },
  suspendido: { texto: "Suspendido", clase: "estado-pill es-neutro" },
  cerrado: { texto: "Cerrado", clase: "estado-pill es-neutro" },
};

const FECHA = new Intl.DateTimeFormat("es-EC", { day: "numeric", month: "long", year: "numeric", timeZone: "America/Guayaquil" });
const FECHA_HORA = new Intl.DateTimeFormat("es-EC", {
  weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", timeZone: "America/Guayaquil",
});

/** Estado de revisión de un documento → píldora. Lo que pide acción del
 *  cliente (observado, rechazado) es lo único que va en naranja. */
function pildoraRevision(estado: string): { texto: string; clase: string } {
  const e = estado.toLowerCase();
  const texto = estado.replace(/_/g, " ").replace(/^\w/, (c) => c.toUpperCase());
  if (/observ|rechaz|correg/.test(e)) return { texto, clase: "estado-pill es-urgente" };
  if (/aprob|revisad|dictamin|valid|firmad/.test(e)) return { texto, clase: "estado-pill es-ok" };
  if (/pend|revision|espera/.test(e)) return { texto, clase: "estado-pill es-accion" };
  return { texto, clase: "estado-pill es-neutro" };
}

export function TarjetaCaso({ caso }: { caso: CasoReciente }) {
  // Suspendido no es una etapa: se queda donde estaba (en curso) y lo dice la píldora.
  const indiceEtapa = Math.max(0, ETAPAS.findIndex((e) => e.estado === (caso.estado === "suspendido" ? "en_curso" : caso.estado)));
  const ahora = Date.now();
  const proximaCita = [...caso.citas]
    .filter((c) => new Date(c.inicio).getTime() > ahora && c.estado !== "cancelada")
    .sort((a, b) => a.inicio.localeCompare(b.inicio))[0];

  const pestanas = [
    { id: "resumen", nombre: "Resumen", cuenta: null as number | null },
    { id: "documentos", nombre: "Documentos", cuenta: caso.documentosTotal },
    { id: "citas", nombre: "Citas", cuenta: caso.citasTotal },
  ];
  const [activa, setActiva] = useState(0);
  const botones = useRef<(HTMLButtonElement | null)[]>([]);
  const paneles = useRef<(HTMLDivElement | null)[]>([]);
  const linea = useRef<HTMLSpanElement>(null);
  const marco = useRef<HTMLDivElement>(null);

  // La línea y el alto del marco se miden: dependen del texto de cada
  // pestaña y del contenido de cada panel.
  useLayoutEffect(() => {
    const colocar = () => {
      const b = botones.current[activa];
      const p = paneles.current[activa];
      if (b && linea.current) {
        linea.current.style.width = `${b.offsetWidth}px`;
        linea.current.style.transform = `translateX(${b.offsetLeft}px)`;
      }
      if (p && marco.current) marco.current.style.height = `${p.offsetHeight}px`;
    };
    colocar();
    window.addEventListener("resize", colocar);
    return () => window.removeEventListener("resize", colocar);
  }, [activa]);

  function teclado(e: React.KeyboardEvent) {
    const mapa: Record<string, number> = { ArrowRight: activa + 1, ArrowLeft: activa - 1, Home: 0, End: pestanas.length - 1 };
    const destino = mapa[e.key];
    if (destino === undefined) return;
    e.preventDefault();
    const n = (destino + pestanas.length) % pestanas.length;
    setActiva(n);
    botones.current[n]?.focus();
  }

  const pildora = PILDORA[caso.estado] ?? PILDORA.nuevo;

  return (
    <section className="tarjeta-seccion tarjeta-caso" aria-labelledby="t-caso">
      <div className="caso-cabecera">
        <span className="caso-icono" aria-hidden="true"><Scale size={20} strokeWidth={1.7} /></span>
        <div>
          <span className="caso-eyebrow">
            Caso {caso.secuencial}{caso.materia ? ` · ${caso.materia}` : ""}
          </span>
          <h2 id="t-caso">{caso.titulo}</h2>
        </div>
        <span className={pildora.clase}>{pildora.texto}</span>
      </div>

      <div className="caso-progreso">
        <ol className="etapas-caso" style={{ ["--avance" as string]: indiceEtapa / (ETAPAS.length - 1) }} aria-label="Etapas del caso">
          {ETAPAS.map((etapa, k) => {
            const clase = k < indiceEtapa || caso.estado === "cerrado" ? "es-hecha" : k === indiceEtapa ? "es-actual" : "";
            return (
              <li key={etapa.estado} className={clase} aria-current={k === indiceEtapa ? "step" : undefined}>
                <span className="etapa-punto" aria-hidden="true"><Check size={14} strokeWidth={2.6} /></span>
                {etapa.nombre}
              </li>
            );
          })}
        </ol>
        {proximaCita ? (
          <div className="caso-siguiente">
            <Clock size={18} aria-hidden="true" />
            <div>
              <b>Próxima cita del caso</b>
              <small>
                {FECHA_HORA.format(new Date(proximaCita.inicio))} · {proximaCita.modalidad === "presencial" ? "en el despacho" : "por videollamada"}
              </small>
            </div>
          </div>
        ) : !caso.tieneAbogado ? (
          <div className="caso-siguiente">
            <Clock size={18} aria-hidden="true" />
            <div>
              <b>Pendiente de asignar abogado</b>
              <small>Te avisamos cuando tu caso tenga abogado.</small>
            </div>
          </div>
        ) : null}
      </div>

      <div className="pestanas-caso" role="tablist" aria-label="Detalle del caso" onKeyDown={teclado}>
        {pestanas.map((p, k) => (
          <button
            key={p.id}
            ref={(el) => { botones.current[k] = el; }}
            type="button"
            role="tab"
            id={`tab-caso-${p.id}`}
            aria-controls={`panel-caso-${p.id}`}
            aria-selected={k === activa}
            tabIndex={k === activa ? 0 : -1}
            onClick={() => setActiva(k)}
          >
            {p.nombre}
            {p.cuenta ? <span className="pestana-cuenta">{p.cuenta}</span> : null}
          </button>
        ))}
        <span className="pestanas-linea" ref={linea} aria-hidden="true" />
      </div>

      <div className="paneles-caso" ref={marco}>
        <div className="paneles-caso-pista" style={{ transform: `translateX(${-100 * activa}%)` }}>
          <div
            ref={(el) => { paneles.current[0] = el; }}
            role="tabpanel"
            id="panel-caso-resumen"
            aria-labelledby="tab-caso-resumen"
            inert={activa !== 0}
          >
            <dl className="ficha-caso">
              <div><dt>Materia</dt><dd>{caso.materia ?? "Por definir"}</dd></div>
              <div><dt>N.º de proceso</dt><dd>{caso.numeroProceso ?? "Aún sin número"}</dd></div>
              <div><dt>Abierto</dt><dd>{FECHA.format(new Date(caso.abiertoEn))}</dd></div>
              <div><dt>Actualizado</dt><dd>{FECHA.format(new Date(caso.actualizadoEn))}</dd></div>
              <div><dt>Abogado</dt><dd>{caso.tieneAbogado ? "Asignado" : "Por asignar"}</dd></div>
            </dl>
            {caso.descripcion && <p className="caso-descripcion">{caso.descripcion}</p>}
          </div>
          <div
            ref={(el) => { paneles.current[1] = el; }}
            role="tabpanel"
            id="panel-caso-documentos"
            aria-labelledby="tab-caso-documentos"
            inert={activa !== 1}
          >
            {caso.documentos.length === 0 ? (
              <p className="caso-vacio">Este caso aún no tiene documentos.</p>
            ) : (
              <ul className="filas-caso">
                {caso.documentos.map((d) => {
                  const p = pildoraRevision(d.estadoRevision);
                  return (
                    <li key={d.id}>
                      <span>{d.nombre}</span>
                      <span className={p.clase}>{p.texto}</span>
                    </li>
                  );
                })}
              </ul>
            )}
            {caso.documentosTotal > caso.documentos.length && (
              <p className="caso-vacio">Y {caso.documentosTotal - caso.documentos.length} más en el expediente.</p>
            )}
          </div>
          <div
            ref={(el) => { paneles.current[2] = el; }}
            role="tabpanel"
            id="panel-caso-citas"
            aria-labelledby="tab-caso-citas"
            inert={activa !== 2}
          >
            {caso.citas.length === 0 ? (
              <p className="caso-vacio">Este caso aún no tiene citas.</p>
            ) : (
              <ul className="filas-caso">
                {caso.citas.map((c) => (
                  <li key={c.id}>
                    <span>{FECHA_HORA.format(new Date(c.inicio))}</span>
                    <span className={c.estado === "cancelada" ? "estado-pill es-neutro" : c.estado === "completada" ? "estado-pill es-ok" : "estado-pill es-accion"}>
                      {c.estado.replace(/^\w/, (x) => x.toUpperCase())}
                    </span>
                  </li>
                ))}
              </ul>
            )}
            {caso.citasTotal > caso.citas.length && (
              <p className="caso-vacio">Y {caso.citasTotal - caso.citas.length} más en Mis citas.</p>
            )}
          </div>
        </div>
      </div>

      <div className="caso-pie">
        <Link href="/panel/mis-citas" className="enlace-accion">Ver mis citas</Link>
      </div>
    </section>
  );
}
