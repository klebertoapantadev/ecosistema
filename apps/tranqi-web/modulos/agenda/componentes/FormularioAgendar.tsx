"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Video,
} from "lucide-react";
import { ModalCheckoutPayphone } from "../../comercio/componentes/ModalCheckoutPayphone";
import type { VarianteCatalogo } from "../../comercio/acciones";
import { clasificarProblemaConAriaAction, reservarCitaAction } from "../acciones";
import type { MensajeTriajeAria, ResultadoClasificacionAria } from "../clasificador-aria";
import type { ServicioAgendable } from "../consultas";
import type { DatosConfigNegocioAgenda } from "../esquema";

interface Materia {
  mat_id: string;
  mat_nombre: string;
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
  servicios: ServicioAgendable[];
  cobertura: Cobertura[];
  configAgenda: DatosConfigNegocioAgenda;
  buscarHuecos: (materiaId: string, varianteId: string | null, modalidad: string) => Promise<Hueco[]>;
}

const PASOS = ["Tu Caso (ARIA)", "Fecha y Horario", "Confirmar y Pagar"] as const;

const SUGERENCIAS_RAPIDAS = [
  "Tengo un problema con un contrato de arriendo o inquilino",
  "Necesito asesoría sobre divorcio, tenencia o pensión alimenticia",
  "Me despidieron o tengo dudas con mi liquidación laboral",
  "Tengo una deuda, pagaré o incumplimiento de contrato",
  "Tuve un accidente, multa o trámite de tránsito",
  "Necesito revisar una herencia, terreno o escrituras",
  "Quiero poner una denuncia penal o me acusan de un delito",
  "No estoy seguro, necesito una orientación legal general",
];

const FORMATO_FECHA_COMPLETA = new Intl.DateTimeFormat("es-EC", {
  weekday: "long",
  day: "numeric",
  month: "long",
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Guayaquil",
});

const FORMATO_DIA_CORTO = new Intl.DateTimeFormat("es-EC", {
  weekday: "short",
  day: "numeric",
  month: "short",
  timeZone: "America/Guayaquil",
});

const FORMATO_SOLO_HORA = new Intl.DateTimeFormat("es-EC", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "America/Guayaquil",
});

const FORMATO_CLAVE_DIA = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Guayaquil",
});

function formatearUSD(monto: number): string {
  return new Intl.NumberFormat("es-EC", { style: "currency", currency: "USD" }).format(monto);
}

export default function FormularioAgendar({
  materias,
  servicios,
  cobertura,
  configAgenda,
  buscarHuecos,
}: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState(0);
  const [alcanzado, setAlcanzado] = useState(0);
  const [direccion, setDireccion] = useState<"der" | "izq">("der");

  // Estado Paso 1: Chat y Clasificación con ARIA
  const [mensajesAria, setMensajesAria] = useState<MensajeTriajeAria[]>([
    {
      rol: "assistant",
      contenido:
        "¡Hola! Soy ARIA, tu asistente legal en Tranqi. No necesitas saber términos jurídicos: cuéntame en tus propias palabras qué problema tienes o qué necesitas resolver y yo determinaré la especialidad adecuada para tu consulta.",
    },
  ]);
  const [entradaChat, setEntradaChat] = useState("");
  const [analizandoAria, setAnalizandoAria] = useState(false);
  const [triaje, setTriaje] = useState<ResultadoClasificacionAria | null>(null);
  const [mostrarSelectorManual, setMostrarSelectorManual] = useState(false);

  // Datos de la cita clasificada
  const [materiaId, setMateriaId] = useState("");
  const [motivo, setMotivo] = useState("");

  // Estado Paso 2: Modalidad, Servicio y Horario
  const [modalidad, setModalidad] = useState<"virtual" | "presencial">("virtual");
  const [varianteId, setVarianteId] = useState<string>(() => servicios[0]?.var_id ?? "");
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [falloHuecos, setFalloHuecos] = useState(false);

  // Estado Paso 3: Confirmación y Pago
  const [aceptaPolitica, setAceptaPolitica] = useState(true);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  const [citaConfirmadaId, setCitaConfirmadaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const titulo = useRef<HTMLHeadingElement>(null);
  const primeraVez = useRef(true);
  const finChatRef = useRef<HTMLDivElement>(null);

  // Materia por defecto (ej. Civil) configurada por los operadores
  const materiaPorDefecto = useMemo(() => {
    const nombreDefecto = (configAgenda.materia_defecto_nombre || "Civil").toLowerCase();
    return (
      materias.find((m) => m.mat_nombre.toLowerCase() === nombreDefecto) ??
      materias.find((m) => m.mat_nombre.toLowerCase().includes("civil")) ??
      materias[0] ??
      null
    );
  }, [materias, configAgenda.materia_defecto_nombre]);

  const servicio = useMemo(
    () => servicios.find((s) => s.var_id === varianteId) ?? servicios[0] ?? null,
    [servicios, varianteId],
  );
  const materia = useMemo(
    () => materias.find((m) => m.mat_id === materiaId) ?? materiaPorDefecto,
    [materias, materiaId, materiaPorDefecto],
  );

  const conceptoServicio =
    (servicio?.var_detalle_variante?.concepto_derecho as string) ?? "CONSULTA_TELEMATICA";
  const cupo = cobertura.find((c) => c.concepto === conceptoServicio);
  const entraEnPlan = cupo ? cupo.incluidos === null || (cupo.restantes ?? 0) > 0 : false;

  // Agrupar huecos por día calendario (America/Guayaquil)
  const huecosPorDia = useMemo(() => {
    if (!huecos || huecos.length === 0) return [];
    const mapa = new Map<string, { clave: string; etiqueta: string; items: Hueco[] }>();
    for (const h of huecos) {
      const fecha = new Date(h.hueco_inicio);
      const clave = FORMATO_CLAVE_DIA.format(fecha);
      let grupo = mapa.get(clave);
      if (!grupo) {
        grupo = {
          clave,
          etiqueta: FORMATO_DIA_CORTO.format(fecha),
          items: [],
        };
        mapa.set(clave, grupo);
      }
      grupo.items.push(h);
    }
    return Array.from(mapa.values());
  }, [huecos]);

  useEffect(() => {
    if (huecosPorDia.length > 0) {
      const existeDia = huecosPorDia.some((d) => d.clave === diaSeleccionado);
      if (!existeDia) {
        setDiaSeleccionado(huecosPorDia[0]?.clave ?? null);
      }
    } else {
      setDiaSeleccionado(null);
    }
  }, [huecosPorDia, diaSeleccionado]);

  useEffect(() => {
    if (primeraVez.current) {
      primeraVez.current = false;
      return;
    }
    titulo.current?.focus({ preventScroll: true });
  }, [paso]);

  useEffect(() => {
    finChatRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [mensajesAria, analizandoAria]);

  function irA(nuevo: number) {
    setError(null);
    setDireccion(nuevo > paso ? "der" : "izq");
    setPaso(nuevo);
    setAlcanzado((a) => Math.max(a, nuevo));
  }

  function invalidarHorario() {
    setHuecos(null);
    setElegido(null);
    setFalloHuecos(false);
    setAlcanzado((a) => Math.min(a, 1));
  }

  async function cargarHuecos(
    matId = materiaId || materiaPorDefecto?.mat_id || "",
    varId = varianteId || servicio?.var_id || null,
    mod: "virtual" | "presencial" = modalidad,
  ) {
    setBuscando(true);
    setFalloHuecos(false);
    try {
      const lista = await buscarHuecos(matId, varId, mod);
      setHuecos(lista);
    } catch {
      setFalloHuecos(true);
    } finally {
      setBuscando(false);
    }
  }

  async function enviarMensajeAria(textoDirecto?: string) {
    const texto = (textoDirecto ?? entradaChat).trim();
    if (!texto || analizandoAria) return;

    setError(null);
    const nuevosMensajes: MensajeTriajeAria[] = [
      ...mensajesAria,
      { rol: "user", contenido: texto },
    ];
    setMensajesAria(nuevosMensajes);
    if (!textoDirecto) setEntradaChat("");
    setAnalizandoAria(true);

    try {
      const res = await clasificarProblemaConAriaAction(nuevosMensajes);
      if (!res.ok) {
        // Fallback inmediato a la especialidad por defecto para nunca bloquear al cliente
        const matFallback = materiaPorDefecto;
        if (matFallback) {
          setMateriaId(matFallback.mat_id);
          setMotivo(texto.slice(0, 500));
          setTriaje({
            respuesta_aria: `Gracias por explicarme tu situación. He registrado tu caso y lo asigné a la especialidad de ${matFallback.mat_nombre} para que puedas elegir tu horario de atención.`,
            materia_id: matFallback.mat_id,
            materia_nombre: matFallback.mat_nombre,
            es_por_defecto: true,
            confianza: "por_defecto",
            motivo_resumido: texto.slice(0, 500),
            modalidad_sugerida: "virtual",
            necesita_aclaracion: false,
          });
          setMensajesAria((prev) => [
            ...prev,
            {
              rol: "assistant",
              contenido: `Gracias por explicarme tu situación. He asignado tu consulta a la especialidad de **${matFallback.mat_nombre}**. Ya puedes continuar para elegir fecha y horario.`,
            },
          ]);
        } else {
          setError(res.error);
        }
        return;
      }

      const resultado = res.data;
      setTriaje(resultado);
      setMateriaId(resultado.materia_id);
      setMotivo(resultado.motivo_resumido || texto.slice(0, 500));
      invalidarHorario();

      setMensajesAria((prev) => [
        ...prev,
        {
          rol: "assistant",
          contenido: resultado.respuesta_aria,
        },
      ]);
    } finally {
      setAnalizandoAria(false);
    }
  }

  function usarEspecialidadPorDefectoDirecto() {
    if (!materiaPorDefecto) return;
    const motivoFinal =
      motivo.trim().length >= 5
        ? motivo.trim()
        : entradaChat.trim().length >= 5
          ? entradaChat.trim()
          : "Consulta de orientación jurídica general";
    setMateriaId(materiaPorDefecto.mat_id);
    setMotivo(motivoFinal);
    setTriaje({
      respuesta_aria: `He asignado la especialidad por defecto (${materiaPorDefecto.mat_nombre}) para tu orientación jurídica.`,
      materia_id: materiaPorDefecto.mat_id,
      materia_nombre: materiaPorDefecto.mat_nombre,
      es_por_defecto: true,
      confianza: "por_defecto",
      motivo_resumido: motivoFinal,
      modalidad_sugerida: "virtual",
      necesita_aclaracion: false,
    });
    invalidarHorario();
  }

  async function continuar() {
    setError(null);
    if (paso === 0) {
      // Si el usuario escribió en la caja pero no pulsó Enviar, analizar primero con ARIA
      if (!materiaId && entradaChat.trim().length >= 5) {
        await enviarMensajeAria(entradaChat.trim());
        return;
      }
      const matEfectiva = materiaId || materiaPorDefecto?.mat_id || "";
      if (!matEfectiva) {
        setError("Cuéntale brevemente tu problema a ARIA para identificar la especialidad.");
        return;
      }
      if (!motivo || motivo.trim().length < 5) {
        setMotivo("Consulta jurídica clasificada por ARIA");
      }
      irA(1);
      await cargarHuecos(matEfectiva, varianteId || servicio?.var_id || null, modalidad);
      return;
    }

    if (paso === 1) {
      if (!elegido) {
        setError("Selecciona una fecha y horario disponible para tu consulta.");
        return;
      }
      irA(2);
      return;
    }
  }

  function ejecutarReservaConfirmada(pagoId?: string | null) {
    setError(null);
    if (!elegido) {
      setError("Selecciona primero un horario disponible.");
      return;
    }
    const matEfectiva = materiaId || materiaPorDefecto?.mat_id || null;
    const motivoEfectivo =
      motivo.trim().length >= 5 ? motivo.trim() : "Consulta jurídica clasificada por ARIA";

    iniciarEnvio(async () => {
      const r = await reservarCitaAction({
        materia_id: matEfectiva,
        inicio_en: elegido,
        variante_id: varianteId || servicio?.var_id || null,
        modalidad,
        motivo: motivoEfectivo,
        caso_id: null,
        pago_id: pagoId ?? null,
        confirmar_inmediato: true,
      });

      if (!r.ok) {
        setError(r.error);
        try {
          await cargarHuecos(matEfectiva || "", varianteId || null, modalidad);
        } catch {
          setHuecos(null);
          setFalloHuecos(true);
        }
        setElegido(null);
        setAlcanzado(1);
        setDireccion("izq");
        setPaso(1);
        return;
      }

      setCitaConfirmadaId(r.data.citaId);
      setTimeout(() => {
        router.push("/panel/mis-citas");
      }, 1500);
    });
  }

  function onConfirmarOPagar() {
    setError(null);
    if (!elegido) {
      setError("Elige uno de los horarios disponibles.");
      return;
    }
    if (!aceptaPolitica) {
      setError("Debes aceptar las condiciones de agendamiento para continuar.");
      return;
    }

    if (entraEnPlan || !servicio || servicio.precio_total <= 0) {
      ejecutarReservaConfirmada(null);
      return;
    }

    // Abrir pasarela de pago para confirmar pago antes/junto con el agendamiento
    setModalPagoAbierto(true);
  }

  const varianteParaCheckout: VarianteCatalogo | null = useMemo(() => {
    if (!servicio) return null;
    return {
      var_id: servicio.var_id,
      var_producto_id: servicio.var_producto_id,
      var_sku: servicio.var_sku,
      var_nombre: `${servicio.var_nombre} — ${materia?.mat_nombre ?? "Consulta Legal"}`,
      var_precio: servicio.var_precio,
      var_tipo_oferta: "UNICO",
      var_codigo_impuesto_sri: "2",
      var_tarifa_iva_porcentaje: servicio.var_tarifa_iva_porcentaje,
      var_activo: true,
      var_detalle_variante: servicio.var_detalle_variante ?? {},
      monto_iva: servicio.monto_iva,
      precio_total: servicio.precio_total,
    };
  }, [servicio, materia]);

  const puedeContinuarPaso0 = Boolean(materiaId) && motivo.trim().length >= 5;
  const puedeContinuarPaso1 = Boolean(elegido);
  const grupoDiaActual = huecosPorDia.find((g) => g.clave === diaSeleccionado) ?? huecosPorDia[0];

  if (citaConfirmadaId && elegido) {
    return (
      <div className="rounded-3xl border border-emerald-200 bg-emerald-50/70 p-6 sm:p-8 text-center space-y-4 shadow-sm">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-emerald-600 text-white shadow-md">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="text-xl font-bold text-slate-900">¡Consulta Agendada y Confirmada!</h2>
        <p className="text-sm text-slate-600 max-w-md mx-auto">
          Tu cita de <strong>{materia?.mat_nombre ?? "Orientación Legal"}</strong> para el{" "}
          <strong>{FORMATO_FECHA_COMPLETA.format(new Date(elegido))}</strong> ha quedado registrada y
          confirmada. Redirigiendo a tus citas…
        </p>
      </div>
    );
  }

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
      <p className="lector-oculto" aria-live="polite">
        {`Paso ${paso + 1} de ${PASOS.length}: ${PASOS[paso]}`}
      </p>

      <div key={paso} className={`paso-agenda-cuerpo entra-${direccion}`}>
        {/* =====================================================================
            PASO 1: CHAT DE DIAGNÓSTICO Y CLASIFICACIÓN CON ARIA (IA)
           ===================================================================== */}
        {paso === 0 && (
          <div className="space-y-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 pb-3">
              <div>
                <h2 ref={titulo} tabIndex={-1} className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <Sparkles className="h-5 w-5 text-violet-600" />
                  ¿Qué problema legal necesitas resolver?
                </h2>
                <p className="text-xs sm:text-sm text-slate-600">
                  Explícalo con tus propias palabras. <strong>ARIA</strong> entenderá tu caso y asignará la especialidad jurídica automáticamente.
                </p>
              </div>
              {!triaje && materiaPorDefecto && (
                <button
                  type="button"
                  onClick={usarEspecialidadPorDefectoDirecto}
                  title={`Asignar especialidad por defecto (${materiaPorDefecto.mat_nombre})`}
                  aria-label={`Asignar especialidad por defecto (${materiaPorDefecto.mat_nombre})`}
                  className="btn-responsive-accion self-start sm:self-auto inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  <ShieldCheck className="h-4 w-4 text-violet-600" />
                  <span className="btn-texto-responsive">Consulta General</span>
                </button>
              )}
            </div>

            {/* Ventana de conversación con ARIA */}
            <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-3 sm:p-4 space-y-3 max-h-80 overflow-y-auto">
              {mensajesAria.map((msg, idx) => {
                const esAria = msg.rol === "assistant";
                return (
                  <div
                    key={idx}
                    className={`flex items-start gap-2.5 ${esAria ? "justify-start" : "justify-end"}`}
                  >
                    {esAria && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-violet-600 text-white shadow-sm">
                        <Bot className="h-4 w-4" />
                      </div>
                    )}
                    <div
                      className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed shadow-xs ${
                        esAria
                          ? "bg-white text-slate-800 border border-slate-200/80"
                          : "bg-violet-600 text-white"
                      }`}
                    >
                      {msg.contenido}
                    </div>
                    {!esAria && (
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-slate-800 text-white">
                        <User className="h-4 w-4" />
                      </div>
                    )}
                  </div>
                );
              })}

              {analizandoAria && (
                <div className="flex items-center gap-2.5 text-xs font-medium text-violet-700 bg-violet-50 border border-violet-200/70 rounded-xl px-3 py-2 w-fit">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  ARIA está analizando tu situación y determinando la especialidad…
                </div>
              )}
              <div ref={finChatRef} />
            </div>

            {/* Sugerencias rápidas en lenguaje cotidiano */}
            <div className="space-y-1.5">
              <p className="text-xs font-semibold text-slate-500">
                Ejemplos frecuentes (toca uno o escribe tu caso abajo):
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGERENCIAS_RAPIDAS.map((sug) => (
                  <button
                    key={sug}
                    type="button"
                    disabled={analizandoAria}
                    onClick={() => enviarMensajeAria(sug)}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs text-slate-700 hover:border-violet-300 hover:bg-violet-50/60 hover:text-violet-900 transition disabled:opacity-50 text-left"
                  >
                    {sug}
                  </button>
                ))}
              </div>
            </div>

            {/* Caja de entrada del chat con ARIA */}
            <div className="flex flex-col sm:flex-row gap-2">
              <textarea
                rows={2}
                value={entradaChat}
                onChange={(e) => setEntradaChat(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !e.shiftKey) {
                    e.preventDefault();
                    enviarMensajeAria();
                  }
                }}
                placeholder="Ej.: Mi inquilino lleva 3 meses sin pagar el arriendo y no quiere entregar el departamento..."
                disabled={analizandoAria}
                className="flex-1 rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 focus:border-violet-600 focus:outline-none"
              />
              <button
                type="button"
                onClick={() => enviarMensajeAria()}
                disabled={analizandoAria || entradaChat.trim().length < 3}
                title="Enviar descripción a ARIA para clasificar especialidad"
                aria-label="Enviar descripción a ARIA para clasificar especialidad"
                className="btn btn-primario btn-responsive-accion inline-flex items-center justify-center gap-2 self-end sm:self-stretch px-4 py-2.5 rounded-xl font-semibold"
              >
                {analizandoAria ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                <span className="btn-texto-responsive">Analizar Caso</span>
              </button>
            </div>

            {/* Tarjeta de resultado de clasificación de ARIA */}
            {triaje && materia && (
              <div className="rounded-2xl border border-violet-200 bg-violet-50/60 p-4 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center gap-1 rounded-full bg-violet-600 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-white">
                      <Sparkles className="h-3 w-3" />
                      {triaje.es_por_defecto ? "Especialidad por Defecto" : "Clasificado por ARIA"}
                    </span>
                    <span className="text-sm font-bold text-slate-900">
                      Especialidad: {materia.mat_nombre}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => setMostrarSelectorManual((v) => !v)}
                    className="text-xs font-semibold text-violet-700 underline hover:text-violet-900"
                  >
                    {mostrarSelectorManual ? "Ocultar lista" : "Cambiar especialidad"}
                  </button>
                </div>

                {mostrarSelectorManual && (
                  <div className="pt-1">
                    <label htmlFor="selector-materia-manual" className="block text-xs font-semibold text-slate-700 mb-1">
                      Seleccionar otra especialidad manualmente:
                    </label>
                    <select
                      id="selector-materia-manual"
                      value={materiaId}
                      onChange={(e) => {
                        setMateriaId(e.target.value);
                        invalidarHorario();
                      }}
                      className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900"
                    >
                      {materias.map((m) => (
                        <option key={m.mat_id} value={m.mat_id}>
                          {m.mat_nombre}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <div>
                  <label htmlFor="resumen-motivo-aria" className="block text-xs font-semibold text-slate-700 mb-1">
                    Motivo registrado para tu abogado (puedes editarlo si deseas):
                  </label>
                  <input
                    id="resumen-motivo-aria"
                    type="text"
                    value={motivo}
                    maxLength={500}
                    onChange={(e) => setMotivo(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800"
                  />
                </div>
              </div>
            )}
          </div>
        )}

        {/* =====================================================================
            PASO 2: MODALIDAD Y SELECCIÓN DE FECHA / HORARIO DE ATENCIÓN
           ===================================================================== */}
        {paso === 1 && (
          <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-violet-200 bg-violet-50/50 px-4 py-3">
              <div className="text-xs sm:text-sm text-slate-800">
                <span className="font-semibold text-violet-800">Especialidad determinada:</span>{" "}
                <strong>{materia?.mat_nombre ?? configAgenda.materia_defecto_nombre}</strong>
                {motivo && <span className="text-slate-600"> · “{motivo}”</span>}
              </div>
              <button
                type="button"
                onClick={() => irA(0)}
                className="text-xs font-semibold text-violet-700 underline"
              >
                Editar caso
              </button>
            </div>

            {/* Selección de modalidad (Telemática vs Presencial) */}
            <fieldset className="opciones-tarjeta opciones-dos">
              <legend>
                <h2 ref={titulo} tabIndex={-1}>1. Modalidad de la consulta</h2>
              </legend>
              <label className="opcion-tarjeta">
                <input
                  type="radio"
                  name="modalidad"
                  checked={modalidad === "virtual"}
                  onChange={() => {
                    setModalidad("virtual");
                    setElegido(null);
                    void cargarHuecos(materia?.mat_id || "", varianteId || null, "virtual");
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <Video size={18} aria-hidden="true" />
                  <b>Consulta Telemática</b>
                  <small>Videollamada en línea</small>
                </span>
              </label>
              <label className="opcion-tarjeta">
                <input
                  type="radio"
                  name="modalidad"
                  checked={modalidad === "presencial"}
                  onChange={() => {
                    setModalidad("presencial");
                    setElegido(null);
                    void cargarHuecos(materia?.mat_id || "", varianteId || null, "presencial");
                  }}
                />
                <span className="opcion-tarjeta-cuerpo">
                  <Building2 size={18} aria-hidden="true" />
                  <b>Consulta Presencial</b>
                  <small>{configAgenda.direccion_presencial || "En el despacho"}</small>
                </span>
              </label>
            </fieldset>

            {/* Selección de tipo de consulta / tarifa */}
            {servicios.length > 0 && (
              <fieldset className="opciones-tarjeta">
                <legend className="etiqueta-campo">2. Tipo de atención</legend>
                {servicios.map((s) => (
                  <label key={s.var_id} className="opcion-tarjeta">
                    <input
                      type="radio"
                      name="servicio"
                      value={s.var_id}
                      checked={servicio?.var_id === s.var_id}
                      onChange={() => {
                        setVarianteId(s.var_id);
                        setElegido(null);
                        void cargarHuecos(materia?.mat_id || "", s.var_id, modalidad);
                      }}
                    />
                    <span className="opcion-tarjeta-cuerpo">
                      <b>{s.var_nombre}</b>
                      <small>
                        {entraEnPlan ? "Incluida en tu plan ($0.00)" : `${formatearUSD(s.precio_total)} (IVA incl.)`}
                      </small>
                    </span>
                  </label>
                ))}
              </fieldset>
            )}

            {/* Calendario / Selector de Fecha y Hora */}
            <section className="agenda-huecos space-y-3">
              <div className="flex items-center justify-between gap-2">
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-violet-600" />
                  3. Selecciona fecha y horario de atención ({modalidad === "virtual" ? "Telemática" : "Presencial"})
                </h3>
                <button
                  type="button"
                  onClick={() => cargarHuecos(materia?.mat_id || "", servicio?.var_id || null, modalidad)}
                  disabled={buscando}
                  title="Actualizar horarios disponibles"
                  aria-label="Actualizar horarios disponibles"
                  className="btn-responsive-accion inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                >
                  <RefreshCw className={`h-3.5 w-3.5 ${buscando ? "animate-spin" : ""}`} />
                  <span className="btn-texto-responsive">Actualizar</span>
                </button>
              </div>

              {falloHuecos && !buscando ? (
                <div className="agenda-reintentar">
                  <p className="estado-vacio">
                    No pudimos cargar los horarios. Revisa tu conexión e inténtalo otra vez.
                  </p>
                  <button
                    type="button"
                    className="btn btn-neutro"
                    onClick={() => cargarHuecos(materia?.mat_id || "", servicio?.var_id || null, modalidad)}
                  >
                    Reintentar
                  </button>
                </div>
              ) : buscando || huecos === null ? (
                <div className="flex items-center gap-2 py-6 text-sm text-slate-600">
                  <Loader2 className="h-4 w-4 animate-spin text-violet-600" />
                  Buscando horarios de atención disponibles…
                </div>
              ) : huecosPorDia.length === 0 ? (
                <p className="estado-vacio">
                  No hay horarios habilitados en esta modalidad para los próximos días. Prueba cambiando entre
                  consulta telemática y presencial.
                </p>
              ) : (
                <div className="space-y-4">
                  {/* Pestañas de días */}
                  <div className="flex gap-2 overflow-x-auto pb-2" role="tablist" aria-label="Días disponibles">
                    {huecosPorDia.map((grupo) => {
                      const activo = grupo.clave === (grupoDiaActual?.clave ?? "");
                      return (
                        <button
                          key={grupo.clave}
                          type="button"
                          role="tab"
                          aria-selected={activo}
                          onClick={() => setDiaSeleccionado(grupo.clave)}
                          className={`shrink-0 rounded-xl border px-3.5 py-2 text-xs font-semibold capitalize transition ${
                            activo
                              ? "border-violet-600 bg-violet-600 text-white shadow-xs"
                              : "border-slate-200 bg-white text-slate-700 hover:border-violet-300"
                          }`}
                        >
                          <div>{grupo.etiqueta}</div>
                          <div className={`text-[10px] ${activo ? "text-violet-100" : "text-slate-400"}`}>
                            {grupo.items.length} horas
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  {/* Horas del día seleccionado */}
                  {grupoDiaActual && (
                    <div className="space-y-2">
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-slate-400" />
                        Horarios disponibles para el <strong className="capitalize">{grupoDiaActual.etiqueta}</strong> (Hora de Ecuador):
                      </p>
                      <ul className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-6 gap-2 list-none p-0 m-0">
                        {grupoDiaActual.items.map((h) => {
                          const activo = elegido === h.hueco_inicio;
                          return (
                            <li key={h.hueco_inicio}>
                              <button
                                type="button"
                                onClick={() => {
                                  setElegido(h.hueco_inicio);
                                  setError(null);
                                }}
                                aria-pressed={activo}
                                className={`w-full rounded-xl border py-2.5 px-3 text-sm font-semibold transition ${
                                  activo
                                    ? "border-violet-600 bg-violet-600 text-white shadow-sm"
                                    : "border-slate-200 bg-white text-slate-800 hover:border-violet-400 hover:bg-violet-50/50"
                                }`}
                              >
                                {FORMATO_SOLO_HORA.format(new Date(h.hueco_inicio))}
                              </button>
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}

                  {elegido && (
                    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3.5 py-2.5 text-xs sm:text-sm text-emerald-950 flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
                      <span>
                        Horario seleccionado:{" "}
                        <strong className="capitalize">{FORMATO_FECHA_COMPLETA.format(new Date(elegido))}</strong>
                      </span>
                    </div>
                  )}
                </div>
              )}
            </section>
          </div>
        )}

        {/* =====================================================================
            PASO 3: CONFIRMAR Y SOLICITAR EL PAGO
           ===================================================================== */}
        {paso === 2 && elegido && (
          <section className="agenda-confirmar space-y-5">
            <h2 ref={titulo} tabIndex={-1}>Revisa tu cita y confirma el pago</h2>

            <dl className="resumen-agenda">
              <div>
                <dt>Especialidad (ARIA)</dt>
                <dd className="font-semibold text-violet-900">
                  {materia?.mat_nombre ?? configAgenda.materia_defecto_nombre}
                  {triaje?.es_por_defecto ? " (Asignada por defecto)" : ""}
                </dd>
              </div>
              <div>
                <dt>Motivo de consulta</dt>
                <dd>{motivo}</dd>
              </div>
              <div>
                <dt>Servicio</dt>
                <dd>{servicio?.var_nombre ?? "Consulta Jurídica"}</dd>
              </div>
              <div>
                <dt>Modalidad</dt>
                <dd>
                  {modalidad === "virtual"
                    ? "Consulta Telemática (Videollamada)"
                    : `Consulta Presencial (${configAgenda.direccion_presencial || "En Despacho"})`}
                </dd>
              </div>
              <div>
                <dt>Fecha y Hora</dt>
                <dd className="capitalize font-semibold">{FORMATO_FECHA_COMPLETA.format(new Date(elegido))}</dd>
              </div>
              {servicio && (
                <div>
                  <dt>Total a pagar</dt>
                  <dd className="text-base font-bold text-slate-900">
                    {entraEnPlan
                      ? "Incluida en tu plan ($0.00)"
                      : `${formatearUSD(servicio.precio_total)} (Subtotal ${formatearUSD(servicio.var_precio)} + IVA ${formatearUSD(servicio.monto_iva)})`}
                  </dd>
                </div>
              )}
            </dl>

            <label className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 p-3.5 text-xs sm:text-sm text-slate-700 cursor-pointer">
              <input
                type="checkbox"
                checked={aceptaPolitica}
                onChange={(e) => setAceptaPolitica(e.target.checked)}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-violet-600 focus:ring-violet-500"
              />
              <span>
                Confirmo los datos de mi consulta jurídica. Al confirmar el pago, mi horario queda reservado y
                confirmado inmediatamente con un abogado especialista de Tranqi.
              </span>
            </label>
          </section>
        )}
      </div>

      {error && <p className="editor-error">{error}</p>}

      <div className="pie-pasos">
        <button
          type="button"
          onClick={() => irA(paso - 1)}
          disabled={paso === 0 || enviando}
          title="Volver al paso anterior"
          aria-label="Volver al paso anterior"
          className="btn btn-neutro btn-responsive-accion inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="h-4 w-4" />
          <span className="btn-texto-responsive">Atrás</span>
        </button>

        {paso < 2 ? (
          <button
            type="button"
            onClick={continuar}
            disabled={
              (paso === 0 && !puedeContinuarPaso0 && entradaChat.trim().length < 5) ||
              (paso === 1 && !puedeContinuarPaso1) ||
              buscando ||
              analizandoAria
            }
            title={paso === 0 ? "Continuar a selección de fecha y horario" : "Continuar a confirmación y pago"}
            aria-label={paso === 0 ? "Continuar a selección de fecha y horario" : "Continuar a confirmación y pago"}
            className="btn btn-primario btn-responsive-accion inline-flex items-center gap-1.5"
          >
            <span className="btn-texto-responsive">
              {paso === 0 ? "Elegir Horario" : "Continuar"}
            </span>
            <ArrowRight className="h-4 w-4" />
          </button>
        ) : (
          <button
            type="button"
            onClick={onConfirmarOPagar}
            disabled={enviando || !aceptaPolitica}
            title={entraEnPlan ? "Confirmar cita cubierta por el plan" : "Pagar consulta y confirmar agendamiento"}
            aria-label={entraEnPlan ? "Confirmar cita cubierta por el plan" : "Pagar consulta y confirmar agendamiento"}
            className="btn btn-primario btn-responsive-accion inline-flex items-center gap-2"
          >
            <CreditCard className="h-4 w-4" />
            <span className="btn-texto-responsive">
              {enviando
                ? "Confirmando…"
                : entraEnPlan
                  ? "Confirmar Cita"
                  : `Pagar y Agendar (${servicio ? formatearUSD(servicio.precio_total) : ""})`}
            </span>
          </button>
        )}
      </div>

      {/* Modal de Checkout con Payphone para confirmar el pago de la cita */}
      {varianteParaCheckout && (
        <ModalCheckoutPayphone
          abierto={modalPagoAbierto}
          alCerrar={() => setModalPagoAbierto(false)}
          productoNombre={`Consulta Jurídica — ${materia?.mat_nombre ?? "Especialista"}`}
          variante={varianteParaCheckout}
          negocio="tranqi"
          alPagoExitoso={(resultado) => {
            setModalPagoAbierto(false);
            ejecutarReservaConfirmada(resultado?.pagoId ?? null);
          }}
        />
      )}
    </div>
  );
}
