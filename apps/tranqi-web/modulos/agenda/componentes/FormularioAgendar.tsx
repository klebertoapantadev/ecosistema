"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Video, Building2 } from "lucide-react";
import { reservarCitaAction } from "../acciones";

// Flujo de reserva del afiliado (TRQ-CLI-001).
//
// El afiliado elige materia, servicio y hora. NO elige abogado: la asignación
// es por turno rotativo (PLT-020 regla 4), y por eso los huecos llegan
// agregados, sin decir de quién son. Saber quién le toca antes de reservar
// convertiría el reparto en una elección, que es justo lo que la gobernanza
// descartó.
//
// TRQ-013: el mismo flujo, en cuatro pasos (variante 10C del muestrario) y
// con tarjetas de opción en vez de selects (8B). La lógica no cambia: la
// cobertura, la búsqueda de huecos y el reintento si el hueco se ocupa son
// los de antes. Cambia que se ve un paso a la vez y que no se avanza sin
// haber elegido lo que ese paso pide.

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

const PASOS = ["Materia", "Atención", "Horario", "Confirmar"] as const;

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
  const [paso, setPaso] = useState(0);
  const [alcanzado, setAlcanzado] = useState(0);
  const [direccion, setDireccion] = useState<"der" | "izq">("der");
  const [materiaId, setMateriaId] = useState("");
  const [varianteId, setVarianteId] = useState("");
  const [modalidad, setModalidad] = useState<"virtual" | "presencial">("virtual");
  const [motivo, setMotivo] = useState("");
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [falloHuecos, setFalloHuecos] = useState(false);
  const [enviando, iniciarEnvio] = useTransition();
  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);

  const servicio = servicios.find((s) => s.var_id === varianteId);
  const materia = materias.find((m) => m.mat_id === materiaId);
  const conceptoServicio = (servicio?.var_detalle_variante?.concepto_derecho as string) ?? "CONSULTA_TELEMATICA";
  const cupo = cobertura.find((c) => c.concepto === conceptoServicio);
  const entraEnPlan = cupo ? cupo.incluidos === null || (cupo.restantes ?? 0) > 0 : false;

  // Al cambiar de paso, el foco va a su título: quien navega con teclado o
  // lector de pantalla empieza por lo que ese paso pregunta. No en la carga
  // inicial, que robaría el foco de la página.
  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus({ preventScroll: true });
  }, [paso]);

  function irA(nuevo: number) {
    setError(null);
    setDireccion(nuevo > paso ? "der" : "izq");
    setPaso(nuevo);
    setAlcanzado((a) => Math.max(a, nuevo));
  }

  // Cambiar algo de lo que decide los huecos invalida los ya buscados, y con
  // ellos todo paso posterior: no se puede saltar a "Confirmar" con una hora
  // que ya no corresponde a lo elegido.
  function invalidarHorario() {
    setHuecos(null);
    setElegido(null);
    setFalloHuecos(false);
    setAlcanzado((a) => Math.min(a, 1));
  }

  // Si la búsqueda falla (red, servidor), el paso de horario ofrece reintentar
  // en vez de quedarse para siempre en "Buscando horarios…".
  async function buscar() {
    setBuscando(true);
    setFalloHuecos(false);
    try {
      setHuecos(await buscarHuecos(materiaId, varianteId || null, modalidad));
    } catch {
      setFalloHuecos(true);
    } finally {
      setBuscando(false);
    }
  }

  async function continuar() {
    if (paso === 0 && !materiaId) {
      setError("Elige primero la materia de tu consulta.");
      return;
    }
    if (paso === 1) {
      irA(2);
      if (huecos === null) await buscar();
      return;
    }
    if (paso === 2 && !elegido) {
      setError("Elige uno de los horarios disponibles.");
      return;
    }
    irA(paso + 1);
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
        // refresca la lista y se vuelve al paso de horario para elegir otro.
        // Si refrescar también falla, el paso de horario ofrece reintentar.
        try {
          setHuecos(await buscarHuecos(materiaId, varianteId || null, modalidad));
        } catch {
          setHuecos(null);
          setFalloHuecos(true);
        }
        setElegido(null);
        setAlcanzado(2);
        setDireccion("izq");
        setPaso(2);
        return;
      }
      router.push("/panel/mis-citas");
    });
  }

  const puedeContinuar =
    (paso === 0 && Boolean(materiaId)) || paso === 1 || (paso === 2 && Boolean(elegido));

  return (
    <div className="agenda-formulario asistente-pasos">
      <ol className="pasos-agenda" aria-label="Pasos para agendar">
        {PASOS.map((nombre, k) => {
          const estado = k < paso ? "hecho" : k === paso ? "actual" : "pendiente";
          return (
            <li key={nombre} className={`paso-agenda es-${estado}`}>
              <button
                type="button"
                onClick={() => irA(k)}
                disabled={k > alcanzado || k === paso || enviando}
                aria-current={k === paso ? "step" : undefined}
                aria-label={`Paso ${k + 1}: ${nombre}`}
              >
                {k < paso ? <Check size={15} strokeWidth={2.6} aria-hidden="true" /> : k + 1}
              </button>
              <span className="paso-agenda-nombre">{nombre}</span>
            </li>
          );
        })}
      </ol>
      <p className="lector-oculto" aria-live="polite">{`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}</p>

      <div key={paso} className={`paso-agenda-cuerpo entra-${direccion}`}>
        {paso === 0 && (
          <fieldset className="opciones-tarjeta">
            <legend>
              <h2 ref={titulo} tabIndex={-1}>¿De qué trata tu consulta?</h2>
              <span>Te asignamos a quien más sabe de esa materia.</span>
            </legend>
            {materias.map((m) => (
              <label key={m.mat_id} className="opcion-tarjeta">
                <input
                  type="radio"
                  name="materia"
                  value={m.mat_id}
                  checked={materiaId === m.mat_id}
                  onChange={() => {
                    setMateriaId(m.mat_id);
                    invalidarHorario();
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <b>{m.mat_nombre}</b>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        {paso === 1 && (
          <>
            <fieldset className="opciones-tarjeta">
              <legend>
                <h2 ref={titulo} tabIndex={-1}>¿Qué tipo de atención?</h2>
              </legend>
              <label className="opcion-tarjeta">
                <input
                  type="radio"
                  name="servicio"
                  value=""
                  checked={varianteId === ""}
                  onChange={() => {
                    setVarianteId("");
                    invalidarHorario();
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <b>Consulta general</b>
                </span>
              </label>
              {servicios.map((s) => (
                <label key={s.var_id} className="opcion-tarjeta">
                  <input
                    type="radio"
                    name="servicio"
                    value={s.var_id}
                    checked={varianteId === s.var_id}
                    onChange={() => {
                      setVarianteId(s.var_id);
                      invalidarHorario();
                    }}
                  />
                  <span className="opcion-tarjeta-cuerpo">
                    <b>{s.var_nombre}</b>
                    <small>{formatearUSD(s.var_precio, s.var_tarifa_iva_porcentaje)}</small>
                  </span>
                </label>
              ))}
            </fieldset>

            {servicio && (
              <p className={entraEnPlan ? "agenda-cobertura-ok" : "agenda-cobertura-pago"}>
                {entraEnPlan
                  ? cupo?.incluidos === null
                    ? `Incluida en tu ${cupo.plan_nombre}: sin costo.`
                    : `Incluida en tu ${cupo?.plan_nombre}: te quedan ${cupo?.restantes} este periodo.`
                  : `Tiene un costo de ${formatearUSD(servicio.var_precio, servicio.var_tarifa_iva_porcentaje)}. Podrás pagarla tras reservar.`}
              </p>
            )}

            <fieldset className="opciones-tarjeta opciones-dos">
              <legend className="etiqueta-campo">¿Cómo prefieres atenderte?</legend>
              <label className="opcion-tarjeta">
                <input
                  type="radio"
                  name="modalidad"
                  checked={modalidad === "virtual"}
                  onChange={() => {
                    setModalidad("virtual");
                    invalidarHorario();
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <Video size={18} aria-hidden="true" />
                  <b>Videollamada</b>
                  <small>Desde donde estés</small>
                </span>
              </label>
              <label className="opcion-tarjeta">
                <input
                  type="radio"
                  name="modalidad"
                  checked={modalidad === "presencial"}
                  onChange={() => {
                    setModalidad("presencial");
                    invalidarHorario();
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <Building2 size={18} aria-hidden="true" />
                  <b>En el despacho</b>
                  <small>Presencial</small>
                </span>
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
          </>
        )}

        {paso === 2 && (
          <section className="agenda-huecos">
            <h2 ref={titulo} tabIndex={-1}>¿Cuándo te viene bien?</h2>
            {falloHuecos && !buscando ? (
              <div className="agenda-reintentar">
                <p className="estado-vacio">No pudimos cargar los horarios. Revisa tu conexión e inténtalo otra vez.</p>
                <button type="button" className="btn btn-neutro" onClick={buscar}>Reintentar</button>
              </div>
            ) : buscando || huecos === null ? (
              <p className="agenda-nota">Buscando horarios…</p>
            ) : huecos.length === 0 ? (
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
                        onClick={() => {
                          setElegido(h.hueco_inicio);
                          setError(null);
                        }}
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

        {paso === 3 && elegido && (
          <section className="agenda-confirmar">
            <h2 ref={titulo} tabIndex={-1}>Revisa y confirma</h2>
            <dl className="resumen-agenda">
              <div><dt>Materia</dt><dd>{materia?.mat_nombre ?? "—"}</dd></div>
              <div><dt>Atención</dt><dd>{servicio?.var_nombre ?? "Consulta general"}</dd></div>
              <div><dt>Modalidad</dt><dd>{modalidad === "virtual" ? "Videollamada" : "En el despacho"}</dd></div>
              <div><dt>Cuándo</dt><dd>{FORMATO_HORA.format(new Date(elegido))}</dd></div>
              {servicio && (
                <div>
                  <dt>Costo</dt>
                  <dd>{entraEnPlan ? "Incluida en tu plan" : formatearUSD(servicio.var_precio, servicio.var_tarifa_iva_porcentaje)}</dd>
                </div>
              )}
            </dl>
          </section>
        )}
      </div>

      {error && <p className="editor-error">{error}</p>}

      <div className="pie-pasos">
        <button type="button" className="btn btn-neutro" onClick={() => irA(paso - 1)} disabled={paso === 0 || enviando}>
          Atrás
        </button>
        {paso < 3 ? (
          <button type="button" className="btn btn-primario" onClick={continuar} disabled={!puedeContinuar || buscando}>
            Continuar
          </button>
        ) : (
          <button type="button" className="btn btn-primario" onClick={onReservar} disabled={enviando}>
            {enviando ? "Reservando…" : "Confirmar reserva"}
          </button>
        )}
      </div>
    </div>
  );
}
