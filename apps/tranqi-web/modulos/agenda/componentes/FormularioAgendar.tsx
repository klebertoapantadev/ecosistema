"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { reservarCitaAction } from "../acciones";

// Flujo de reserva del afiliado (TRQ-CLI-001).
//
// El afiliado elige materia, servicio y hora. NO elige abogado: la asignación
// es por turno rotativo (PLT-020 regla 4), y por eso los huecos llegan
// agregados, sin decir de quién son. Saber quién le toca antes de reservar
// convertiría el reparto en una elección, que es justo lo que la gobernanza
// descartó.

interface Materia {
  mat_id: string;
  mat_nombre: string;
}

interface Servicio {
  var_id: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number;
  var_tarifa_iva_porcentaje: number;
  var_detalle_variante: Record<string, unknown> | null;
}

interface Hueco {
  hueco_inicio: string;
  hueco_fin: string;
  disponibles: number;
}

interface Cobertura {
  plan_nombre: string;
  concepto: string;
  incluidos: number | null;
  restantes: number | null;
}

interface Props {
  materias: Materia[];
  servicios: Servicio[];
  cobertura: Cobertura[];
  buscarHuecos: (materiaId: string, varianteId: string | null, modalidad: string) => Promise<Hueco[]>;
}

const FORMATO_HORA = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

function formatearUSD(baseImponible: number, ivaPorcentaje: number): string {
  // El catálogo guarda base imponible; al afiliado se le enseña lo que paga.
  const total = Math.round(baseImponible * (1 + ivaPorcentaje / 100) * 100) / 100;
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(total);
}

export default function FormularioAgendar({ materias, servicios, cobertura, buscarHuecos }: Props) {
  const router = useRouter();
  const [materiaId, setMateriaId] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [modalidad, setModalidad] = useState<"virtual" | "presencial">("virtual");
  const [motivo, setMotivo] = useState("");
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();

  const servicio = servicios.find((s) => s.var_id === varianteId);
  const conceptoServicio = (servicio?.var_detalle_variante?.concepto_derecho as string) ?? "CONSULTA_TELEMATICA";
  const cupo = cobertura.find((c) => c.concepto === conceptoServicio);
  const entraEnPlan = cupo ? cupo.incluidos === null || (cupo.restantes ?? 0) > 0 : false;

  async function onBuscar() {
    setError(null);
    setElegido(null);
    if (!materiaId) {
      setError("Elige primero la materia de tu consulta.");
      return;
    }
    setBuscando(true);
    try {
      setHuecos(await buscarHuecos(materiaId, varianteId || null, modalidad));
    } finally {
      setBuscando(false);
    }
  }

  function onReservar() {
    setError(null);
    if (!elegido) {
      setError("Elige uno de los horarios disponibles.");
      return;
    }
    iniciarEnvio(async () => {
      const r = await reservarCitaAction({
        materia_id: materiaId,
        inicio_en: elegido,
        variante_id: varianteId || null,
        modalidad,
        motivo,
        caso_id: null,
      });
      if (!r.ok) {
        setError(r.error);
        // El hueco pudo ocuparse entre la búsqueda y la confirmación: se
        // refresca la lista para que no vuelva a elegir el mismo.
        setHuecos(await buscarHuecos(materiaId, varianteId || null, modalidad));
        setElegido(null);
        return;
      }
      router.push("/panel/mis-citas");
    });
  }

  return (
    <div className="agenda-formulario">
      <label className="etiqueta-campo" htmlFor="materia">
        ¿De qué trata tu consulta?
      </label>
      <select
        id="materia"
        value={materiaId}
        onChange={(e) => {
          setMateriaId(e.target.value);
          setHuecos(null);
          setElegido(null);
        }}
      >
        <option value="">Elige una materia…</option>
        {materias.map((m) => (
          <option key={m.mat_id} value={m.mat_id}>
            {m.mat_nombre}
          </option>
        ))}
      </select>

      <label className="etiqueta-campo" htmlFor="servicio">
        Tipo de atención
      </label>
      <select
        id="servicio"
        value={varianteId}
        onChange={(e) => {
          setVarianteId(e.target.value);
          setHuecos(null);
          setElegido(null);
        }}
      >
        <option value="">Consulta general</option>
        {servicios.map((s) => (
          <option key={s.var_id} value={s.var_id}>
            {s.var_nombre} · {formatearUSD(s.var_precio, s.var_tarifa_iva_porcentaje)}
          </option>
        ))}
      </select>

      {servicio && (
        <p className={entraEnPlan ? "agenda-cobertura-ok" : "agenda-cobertura-pago"}>
          {entraEnPlan
            ? cupo?.incluidos === null
              ? `Incluida en tu ${cupo.plan_nombre}: sin costo.`
              : `Incluida en tu ${cupo?.plan_nombre}: te quedan ${cupo?.restantes} este periodo.`
            : `Tiene un costo de ${formatearUSD(servicio.var_precio, servicio.var_tarifa_iva_porcentaje)}. Podrás pagarla tras reservar.`}
        </p>
      )}

      <fieldset className="agenda-modalidad">
        <legend className="etiqueta-campo">¿Cómo prefieres atenderte?</legend>
        <label>
          <input
            type="radio"
            name="modalidad"
            checked={modalidad === "virtual"}
            onChange={() => {
              setModalidad("virtual");
              setHuecos(null);
            }}
          />{" "}
          Videollamada
        </label>
        <label>
          <input
            type="radio"
            name="modalidad"
            checked={modalidad === "presencial"}
            onChange={() => {
              setModalidad("presencial");
              setHuecos(null);
            }}
          />{" "}
          En el despacho
        </label>
      </fieldset>

      <label className="etiqueta-campo" htmlFor="motivo">
        Cuéntanos en una frase qué necesitas
      </label>
      <textarea
        id="motivo"
        value={motivo}
        onChange={(e) => setMotivo(e.target.value)}
        rows={3}
        maxLength={500}
        placeholder="Ej.: quiero saber cómo iniciar un divorcio de mutuo acuerdo"
      />

      <button type="button" className="btn btn-primario" onClick={onBuscar} disabled={buscando}>
        {buscando ? "Buscando horarios…" : "Ver horarios disponibles"}
      </button>

      {huecos !== null && (
        <section className="agenda-huecos">
          <h2>Horarios disponibles</h2>
          {huecos.length === 0 ? (
            <p className="estado-vacio">
              No hay horarios libres para esa materia en los próximos días. Prueba con otra
              modalidad, o escríbenos y un operador te contacta.
            </p>
          ) : (
            <>
              <p className="agenda-nota">
                Te asignaremos al abogado de turno especializado en la materia que elegiste.
              </p>
              <ul className="agenda-lista-huecos">
                {huecos.map((h) => (
                  <li key={h.hueco_inicio}>
                    <button
                      type="button"
                      className={elegido === h.hueco_inicio ? "agenda-hueco agenda-hueco-elegido" : "agenda-hueco"}
                      onClick={() => setElegido(h.hueco_inicio)}
                      aria-pressed={elegido === h.hueco_inicio}
                    >
                      {FORMATO_HORA.format(new Date(h.hueco_inicio))}
                    </button>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
      )}

      {error && <p className="editor-error">{error}</p>}

      {elegido && (
        <div className="agenda-confirmar">
          <p>
            Vas a reservar el <strong>{FORMATO_HORA.format(new Date(elegido))}</strong>
            {servicio ? ` para ${servicio.var_nombre}` : ""}, {modalidad === "virtual" ? "por videollamada" : "en el despacho"}.
          </p>
          <button type="button" className="btn btn-primario" onClick={onReservar} disabled={enviando}>
            {enviando ? "Reservando…" : "Confirmar reserva"}
          </button>
        </div>
      )}
    </div>
  );
}
