"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  CreditCard,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  Video,
} from "lucide-react";
import { ModalCheckoutPayphone, type VarianteCatalogo } from "@eco/comercio";
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

const EJEMPLOS_CORTOS = [
  { etiqueta: "Divorcio y bienes", texto: "Necesito asesoría sobre divorcio y repartición de bienes" },
  { etiqueta: "Arriendo o contrato", texto: "Tengo un problema con un contrato de arriendo o inquilino" },
  { etiqueta: "Despido o liquidación", texto: "Me despidieron o tengo dudas sobre mi liquidación laboral" },
  { etiqueta: "Deudas o cobros", texto: "Tengo una deuda, pagaré o incumplimiento de pago" },
  { etiqueta: "Herencia o escrituras", texto: "Necesito revisar una herencia, terreno o escrituras" },
  { etiqueta: "Tránsito o multa", texto: "Tuve un accidente, multa o trámite de tránsito" },
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

const SERVICIO_VIRTUAL_FALLBACK: ServicioAgendable = {
  var_id: "00000000-0000-4000-8000-000000000102",
  var_producto_id: "00000000-0000-4000-8000-000000000100",
  var_sku: "TRQ-CON-TEL",
  var_nombre: "Consulta Telemática con Especialista",
  var_precio: 25,
  var_tarifa_iva_porcentaje: 15,
  var_detalle_variante: { duracion_min: 45, modalidad: ["virtual"], concepto_derecho: "CONSULTA_TELEMATICA" },
  monto_iva: 3.75,
  precio_total: 28.75,
};

const SERVICIO_PRESENCIAL_FALLBACK: ServicioAgendable = {
  var_id: "00000000-0000-4000-8000-000000000101",
  var_producto_id: "00000000-0000-4000-8000-000000000100",
  var_sku: "TRQ-CON-PRE",
  var_nombre: "Consulta Presencial con Especialista",
  var_precio: 45,
  var_tarifa_iva_porcentaje: 15,
  var_detalle_variante: { duracion_min: 45, modalidad: ["presencial"], concepto_derecho: "CONSULTA_PRESENCIAL" },
  monto_iva: 6.75,
  precio_total: 51.75,
};

export default function FormularioAgendar({
  materias,
  servicios,
  cobertura,
  configAgenda,
  buscarHuecos,
}: Props) {
  const router = useRouter();
  const [paso, setPaso] = useState<0 | 1>(0);

  // Paso 1: Pregunta simple y respuesta de ARIA
  const [relatoUsuario, setRelatoUsuario] = useState("");
  const [analizandoAria, setAnalizandoAria] = useState(false);
  const [triaje, setTriaje] = useState<ResultadoClasificacionAria | null>(null);
  const [mostrarSelectorManual, setMostrarSelectorManual] = useState(false);
  const [materiaId, setMateriaId] = useState("");
  const [motivo, setMotivo] = useState("");

  // Paso 2: Modalidad (Telemática / Presencial), Fecha/Hora y Pago directo
  const [modalidad, setModalidad] = useState<"virtual" | "presencial">("virtual");
  const [huecos, setHuecos] = useState<Hueco[] | null>(null);
  const [diaSeleccionado, setDiaSeleccionado] = useState<string | null>(null);
  const [elegido, setElegido] = useState<string | null>(null);
  const [buscando, setBuscando] = useState(false);
  const [falloHuecos, setFalloHuecos] = useState(false);

  // Confirmación y Pago
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);
  const [citaConfirmadaId, setCitaConfirmadaId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, iniciarEnvio] = useTransition();

  const respuestaRef = useRef<HTMLDivElement>(null);

  const materiaPorDefecto = useMemo(() => {
    const nombreDefecto = (configAgenda.materia_defecto_nombre || "Civil").toLowerCase();
    return (
      materias.find((m) => m.mat_nombre.toLowerCase() === nombreDefecto) ??
      materias.find((m) => m.mat_nombre.toLowerCase().includes("civil")) ??
      materias[0] ??
      null
    );
  }, [materias, configAgenda.materia_defecto_nombre]);

  const materia = useMemo(
    () => materias.find((m) => m.mat_id === materiaId) ?? materiaPorDefecto,
    [materias, materiaId, materiaPorDefecto],
  );

  // Seleccionar automáticamente el servicio de consulta acorde a la modalidad (Telemática vs Presencial)
  const servicioVirtual = useMemo(() => {
    const encontrado = servicios.find((s) => {
      const n = s.var_nombre.toLowerCase();
      return n.includes("consulta") || n.includes("asesor") || n.includes("tele") || n.includes("virtual");
    });
    return encontrado ?? SERVICIO_VIRTUAL_FALLBACK;
  }, [servicios]);

  const servicioPresencial = useMemo(() => {
    const encontrado = servicios.find((s) => {
      const n = s.var_nombre.toLowerCase();
      return (n.includes("consulta") || n.includes("asesor")) && n.includes("presencial");
    });
    return encontrado ?? SERVICIO_PRESENCIAL_FALLBACK;
  }, [servicios]);

  const servicio = modalidad === "virtual" ? servicioVirtual : servicioPresencial;

  const conceptoServicio =
    modalidad === "virtual"
      ? ((servicio?.var_detalle_variante?.concepto_derecho as string) ?? "CONSULTA_TELEMATICA")
      : "CONSULTA_PRESENCIAL";
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

  async function cargarHuecos(
    matId = materiaId || materiaPorDefecto?.mat_id || "",
    mod: "virtual" | "presencial" = modalidad,
  ) {
    setBuscando(true);
    setFalloHuecos(false);
    try {
      const srv = mod === "virtual" ? servicioVirtual : servicioPresencial;
      const lista = await buscarHuecos(matId, srv?.var_id || null, mod);
      setHuecos(lista);
    } catch {
      setFalloHuecos(true);
    } finally {
      setBuscando(false);
    }
  }

  async function consultarNeedConAria(textoOpcional?: string) {
    const texto = (textoOpcional ?? relatoUsuario).trim();
    if (texto.length < 4 || analizandoAria) {
      setError("Cuéntanos brevemente tu necesidad legal para asignarte al especialista adecuado.");
      return;
    }

    if (textoOpcional) {
      setRelatoUsuario(textoOpcional);
    }

    setError(null);
    setAnalizandoAria(true);

    try {
      const historial: MensajeTriajeAria[] = [{ rol: "user", contenido: texto }];
      const res = await clasificarProblemaConAriaAction(historial);

      if (!res.ok) {
        const matFallback = materiaPorDefecto;
        if (matFallback) {
          setMateriaId(matFallback.mat_id);
          setMotivo(texto.slice(0, 500));
          setTriaje({
            respuesta_aria: `Hemos revisado tu solicitud. Para brindarte la mejor asesoría, te asignaremos un abogado especialista en ${matFallback.mat_nombre}.`,
            materia_id: matFallback.mat_id,
            materia_nombre: matFallback.mat_nombre,
            es_por_defecto: true,
            confianza: "por_defecto",
            motivo_resumido: texto.slice(0, 500),
            modalidad_sugerida: "virtual",
            necesita_aclaracion: false,
          });
        } else {
          setError(res.error);
        }
        return;
      }

      const resultado = res.data;
      setTriaje(resultado);
      setMateriaId(resultado.materia_id);
      setMotivo(resultado.motivo_resumido || texto.slice(0, 500));
      setTimeout(() => {
        respuestaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    } finally {
      setAnalizandoAria(false);
    }
  }

  async function irAPasoAgendamiento() {
    setError(null);
    const matEfectiva = materiaId || materiaPorDefecto?.mat_id || "";
    if (!matEfectiva) {
      setError("Primero cuéntanos tu necesidad para asignar la especialidad.");
      return;
    }
    if (!motivo || motivo.trim().length < 4) {
      setMotivo(relatoUsuario.trim().slice(0, 500) || "Consulta jurídica con especialista");
    }
    setPaso(1);
    await cargarHuecos(matEfectiva, modalidad);
  }

  function ejecutarReservaConfirmada(pagoId?: string | null) {
    setError(null);
    if (!elegido) {
      setError("Selecciona primero una fecha y hora disponible.");
      return;
    }
    const matEfectiva = materiaId || materiaPorDefecto?.mat_id || null;
    const motivoEfectivo =
      motivo.trim().length >= 4
        ? motivo.trim()
        : relatoUsuario.trim().slice(0, 500) || "Consulta jurídica clasificada por Tranqi";

    iniciarEnvio(async () => {
      const r = await reservarCitaAction({
        materia_id: matEfectiva,
        inicio_en: elegido,
        variante_id: servicio?.var_id || null,
        modalidad,
        motivo: motivoEfectivo,
        caso_id: null,
        pago_id: pagoId ?? null,
        confirmar_inmediato: true,
      });

      if (!r.ok) {
        setError(r.error);
        try {
          await cargarHuecos(matEfectiva || "", modalidad);
        } catch {
          setHuecos(null);
          setFalloHuecos(true);
        }
        setElegido(null);
        return;
      }

      setCitaConfirmadaId(r.data.citaId);
      setTimeout(() => {
        router.push("/panel/agendamiento?widget=mis_citas");
      }, 1500);
    });
  }

  function onProcederAlPago() {
    setError(null);
    if (!elegido) {
      setError("Selecciona un día y una hora para tu consulta antes de proceder al pago.");
      return;
    }

    if (entraEnPlan || !servicio || servicio.precio_total <= 0) {
      ejecutarReservaConfirmada(null);
      return;
    }

    setModalPagoAbierto(true);
  }

  const varianteParaCheckout: VarianteCatalogo | null = useMemo(() => {
    if (!servicio) return null;
    return {
      var_id: servicio.var_id,
      var_producto_id: servicio.var_producto_id,
      var_sku: servicio.var_sku,
      var_nombre: `${modalidad === "virtual" ? "Consulta Telemática" : "Consulta Presencial"} — Especialista en ${materia?.mat_nombre ?? "Derecho"}`,
      var_precio: servicio.var_precio,
      var_tipo_oferta: "UNICO",
      var_codigo_impuesto_sri: "2",
      var_tarifa_iva_porcentaje: servicio.var_tarifa_iva_porcentaje,
      var_activo: true,
      var_detalle_variante: servicio.var_detalle_variante ?? {},
      monto_iva: servicio.monto_iva,
      precio_total: servicio.precio_total,
    };
  }, [servicio, modalidad, materia]);

  const grupoDiaActual = huecosPorDia.find((g) => g.clave === diaSeleccionado) ?? huecosPorDia[0];

  if (citaConfirmadaId && elegido) {
    return (
      <div
        style={{
          background: "#ECFDF5",
          border: "1.5px solid #A7F3D0",
          borderRadius: "24px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(5, 135, 110, 0.08)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "18px",
            background: "#05876E",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <CheckCircle2 size={30} />
        </div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "#064E3B", margin: "0 0 8px" }}>
          ¡Consulta Agendada y Confirmada!
        </h2>
        <p style={{ fontSize: "0.95rem", color: "#065F46", maxWidth: "460px", margin: "0 auto", lineHeight: 1.5 }}>
          Tu cita con el especialista en <strong>{materia?.mat_nombre ?? "Derecho"}</strong> para el{" "}
          <strong>{FORMATO_FECHA_COMPLETA.format(new Date(elegido))}</strong> ha quedado confirmada. Redirigiendo a tus citas…
        </p>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Indicador minimalista de 2 pasos */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "#FFFFFF",
          border: "1px solid #E5E7EB",
          borderRadius: "16px",
          padding: "14px 20px",
          boxShadow: "0 2px 8px rgba(15, 23, 42, 0.03)",
        }}
      >
        <button
          type="button"
          onClick={() => setPaso(0)}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.82rem",
              fontWeight: 800,
              background: paso === 0 ? "#5000BA" : "#05876E",
              color: "#FFFFFF",
            }}
          >
            {paso > 0 ? <Check size={16} strokeWidth={2.8} /> : "1"}
          </span>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6B7280" }}>
              Paso 1
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: paso === 0 ? "#5000BA" : "#111827" }}>
              Cuéntanos tu necesidad
            </div>
          </div>
        </button>

        <div style={{ flex: 1, height: "2px", background: paso === 1 ? "#5000BA" : "#E5E7EB", margin: "0 16px", maxWidth: "120px" }} />

        <button
          type="button"
          disabled={!triaje && !materiaId}
          onClick={() => {
            if (triaje || materiaId) void irAPasoAgendamiento();
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: "10px",
            background: "transparent",
            border: "none",
            padding: 0,
            cursor: triaje || materiaId ? "pointer" : "default",
            opacity: paso === 1 || triaje || materiaId ? 1 : 0.5,
            textAlign: "left",
          }}
        >
          <span
            style={{
              width: "30px",
              height: "30px",
              borderRadius: "50%",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: "0.82rem",
              fontWeight: 800,
              background: paso === 1 ? "#5000BA" : "#F3F4F6",
              color: paso === 1 ? "#FFFFFF" : "#6B7280",
            }}
          >
            2
          </span>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "#6B7280" }}>
              Paso 2
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: paso === 1 ? "#5000BA" : "#374151" }}>
              Modalidad, horario y pago
            </div>
          </div>
        </button>
      </div>

      {/* =====================================================================
          PASO 1: PREGUNTA SIMPLE Y RESPUESTA DE ESPECIALIDAD CON ARIA
         ===================================================================== */}
      {paso === 0 && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "24px",
            padding: "28px 26px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "20px",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "#F3E8FF",
                color: "#5000BA",
                padding: "5px 12px",
                borderRadius: "999px",
                fontSize: "0.75rem",
                fontWeight: 800,
                letterSpacing: "0.03em",
                marginBottom: "10px",
              }}
            >
              <Sparkles size={14} /> Asistente Legal Tranqi
            </span>
            <h1 style={{ fontSize: "1.45rem", fontWeight: 800, color: "#111827", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
              ¿Qué necesitas resolver hoy?
            </h1>
            <p style={{ fontSize: "0.92rem", color: "#4B5563", margin: 0, lineHeight: 1.5 }}>
              Cuéntanos tu caso con tus propias palabras. Identificaremos de inmediato qué especialista legal debe atenderte.
            </p>
          </div>

          {/* Ejemplos rápidos en chips limpios */}
          <div>
            <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#6B7280", marginBottom: "8px" }}>
              Ideas rápidas (opcional):
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {EJEMPLOS_CORTOS.map((ej) => {
                const activo = relatoUsuario === ej.texto;
                return (
                  <button
                    key={ej.etiqueta}
                    type="button"
                    disabled={analizandoAria}
                    onClick={() => void consultarNeedConAria(ej.texto)}
                    style={{
                      background: activo ? "#F3E8FF" : "#F9FAFB",
                      border: activo ? "1.5px solid #5000BA" : "1px solid #E5E7EB",
                      color: activo ? "#5000BA" : "#374151",
                      borderRadius: "999px",
                      padding: "6px 13px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: analizandoAria ? "wait" : "pointer",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {ej.etiqueta}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Área de texto limpia y amplia */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <textarea
              rows={3}
              value={relatoUsuario}
              onChange={(e) => setRelatoUsuario(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void consultarNeedConAria();
                }
              }}
              placeholder="Escribe aquí tu necesidad... Ej.: Voy a divorciarme de mutuo acuerdo y quiero asesoría sobre la repartición de bienes."
              disabled={analizandoAria}
              style={{
                width: "100%",
                boxSizing: "border-box",
                borderRadius: "16px",
                border: "1.5px solid #D1D5DB",
                background: "#FAFAFA",
                padding: "14px 16px",
                fontSize: "0.95rem",
                color: "#111827",
                lineHeight: 1.5,
                resize: "vertical",
                outline: "none",
                fontFamily: "inherit",
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                onClick={() => void consultarNeedConAria()}
                disabled={analizandoAria || relatoUsuario.trim().length < 4}
                style={{
                  background: analizandoAria || relatoUsuario.trim().length < 4 ? "#D8B4FE" : "#5000BA",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "14px",
                  padding: "11px 20px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: analizandoAria || relatoUsuario.trim().length < 4 ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: "0 4px 14px rgba(80, 0, 186, 0.18)",
                }}
              >
                {analizandoAria ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Analizando tu necesidad…
                  </>
                ) : (
                  <>
                    <Sparkles size={16} />
                    {triaje ? "Actualizar análisis" : "Consultar con Tranqi"}
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Respuesta de Tranqi con la especialidad del especialista y botón de continuar */}
          {triaje && materia && (
            <div
              ref={respuestaRef}
              style={{
                background: "linear-gradient(135deg, #F5F3FF 0%, #ECFDF5 100%)",
                border: "1.5px solid #C4B5FD",
                borderRadius: "20px",
                padding: "22px",
                display: "flex",
                flexDirection: "column",
                gap: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "flex-start", gap: "14px" }}>
                <div
                  style={{
                    width: "42px",
                    height: "42px",
                    borderRadius: "14px",
                    background: "#5000BA",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  <Scale size={20} />
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "#5000BA", marginBottom: "4px" }}>
                    Recomendación de Tranqi
                  </div>
                  <p style={{ fontSize: "0.94rem", color: "#1F2937", margin: "0 0 12px", lineHeight: 1.55 }}>
                    {triaje.respuesta_aria}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      background: "#FFFFFF",
                      border: "1px solid #DDD6FE",
                      borderRadius: "14px",
                      padding: "12px 16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.74rem", color: "#6B7280", fontWeight: 600 }}>
                        Especialista para tu agendamiento:
                      </div>
                      <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "#05876E" }}>
                        Abogado Especialista en {materia.mat_nombre}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarSelectorManual((v) => !v)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#5000BA",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        textDecoration: "underline",
                        cursor: "pointer",
                      }}
                    >
                      {mostrarSelectorManual ? "Cerrar" : "Cambiar especialidad"}
                    </button>
                  </div>

                  {mostrarSelectorManual && (
                    <div style={{ marginTop: "10px" }}>
                      <select
                        value={materiaId}
                        onChange={(e) => {
                          setMateriaId(e.target.value);
                          setHuecos(null);
                          setElegido(null);
                        }}
                        style={{
                          width: "100%",
                          borderRadius: "12px",
                          border: "1px solid #D1D5DB",
                          background: "#FFFFFF",
                          padding: "10px 12px",
                          fontSize: "0.88rem",
                          color: "#111827",
                          fontWeight: 600,
                        }}
                      >
                        {materias.map((m) => (
                          <option key={m.mat_id} value={m.mat_id}>
                            {m.mat_nombre}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}
                </div>
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => void irAPasoAgendamiento()}
                  style={{
                    background: "#05876E",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "14px",
                    padding: "12px 24px",
                    fontSize: "0.94rem",
                    fontWeight: 800,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 6px 18px rgba(5, 135, 110, 0.24)",
                  }}
                >
                  Continuar al Agendamiento
                  <ArrowRight size={18} />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          PASO 2: MODALIDAD (TELEMÁTICA / PRESENCIAL), HORARIO Y PAGO DIRECTO
         ===================================================================== */}
      {paso === 1 && (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px solid #E5E7EB",
            borderRadius: "24px",
            padding: "28px 26px",
            boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "24px",
          }}
        >
          {/* Resumen superior de la especialidad */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: "#F5F3FF",
              border: "1px solid #DDD6FE",
              borderRadius: "16px",
              padding: "12px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Scale size={18} color="#5000BA" />
              <span style={{ fontSize: "0.88rem", color: "#1F2937" }}>
                Especialista asignado: <strong style={{ color: "#5000BA" }}>{materia?.mat_nombre ?? "Civil"}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPaso(0)}
              style={{
                background: "transparent",
                border: "none",
                color: "#5000BA",
                fontSize: "0.8rem",
                fontWeight: 700,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Cambiar caso
            </button>
          </div>

          {/* 1. Selección exclusiva entre Telemática o Presencial */}
          <div>
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: "#111827", margin: "0 0 12px" }}>
              1. ¿Cómo prefieres recibir tu consulta?
            </h2>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
                gap: "14px",
              }}
            >
              {/* Opción Telemática */}
              <button
                type="button"
                onClick={() => {
                  setModalidad("virtual");
                  setElegido(null);
                  void cargarHuecos(materia?.mat_id || "", "virtual");
                }}
                style={{
                  textAlign: "left",
                  borderRadius: "18px",
                  padding: "18px 20px",
                  border: modalidad === "virtual" ? "2px solid #5000BA" : "1.5px solid #E5E7EB",
                  background: modalidad === "virtual" ? "#F5F3FF" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: modalidad === "virtual" ? "#5000BA" : "#F3F4F6",
                      color: modalidad === "virtual" ? "#FFFFFF" : "#374151",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Video size={20} />
                  </div>
                  <span
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      color: modalidad === "virtual" ? "#5000BA" : "#111827",
                      background: modalidad === "virtual" ? "#EDE9FE" : "#F3F4F6",
                      padding: "4px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    {entraEnPlan ? "Incluida ($0.00)" : formatearUSD(servicioVirtual.precio_total)}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#111827", marginTop: "4px" }}>
                  Consulta Telemática
                </div>
                <div style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: 1.4 }}>
                  Videollamada en línea desde cualquier lugar con tu abogado especialista.
                </div>
              </button>

              {/* Opción Presencial */}
              <button
                type="button"
                onClick={() => {
                  setModalidad("presencial");
                  setElegido(null);
                  void cargarHuecos(materia?.mat_id || "", "presencial");
                }}
                style={{
                  textAlign: "left",
                  borderRadius: "18px",
                  padding: "18px 20px",
                  border: modalidad === "presencial" ? "2px solid #5000BA" : "1.5px solid #E5E7EB",
                  background: modalidad === "presencial" ? "#F5F3FF" : "#FFFFFF",
                  cursor: "pointer",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  transition: "all 0.15s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
                  <div
                    style={{
                      width: "40px",
                      height: "40px",
                      borderRadius: "12px",
                      background: modalidad === "presencial" ? "#5000BA" : "#F3F4F6",
                      color: modalidad === "presencial" ? "#FFFFFF" : "#374151",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    <Building2 size={20} />
                  </div>
                  <span
                    style={{
                      fontSize: "0.88rem",
                      fontWeight: 800,
                      color: modalidad === "presencial" ? "#5000BA" : "#111827",
                      background: modalidad === "presencial" ? "#EDE9FE" : "#F3F4F6",
                      padding: "4px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    {entraEnPlan ? "Incluida ($0.00)" : formatearUSD(servicioPresencial.precio_total)}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "#111827", marginTop: "4px" }}>
                  Consulta Presencial
                </div>
                <div style={{ fontSize: "0.82rem", color: "#6B7280", lineHeight: 1.4 }}>
                  {configAgenda.direccion_presencial || "Atención personalizada en Despacho Tranqi"}.
                </div>
              </button>
            </div>
          </div>

          {/* 2. Selección de fecha y hora */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={19} color="#5000BA" />
                2. Elige el día y la hora ({modalidad === "virtual" ? "Telemática" : "Presencial"})
              </h2>
              <button
                type="button"
                onClick={() => void cargarHuecos(materia?.mat_id || "", modalidad)}
                disabled={buscando}
                style={{
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "#374151",
                  cursor: buscando ? "wait" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                }}
              >
                <RefreshCw size={14} className={buscando ? "animate-spin" : ""} />
                Actualizar
              </button>
            </div>

            {falloHuecos && !buscando ? (
              <div style={{ padding: "20px", borderRadius: "16px", background: "#FEF2F2", border: "1px solid #FECACA", textAlign: "center" }}>
                <p style={{ fontSize: "0.88rem", color: "#991B1B", margin: "0 0 10px" }}>
                  No pudimos cargar los horarios disponibles.
                </p>
                <button
                  type="button"
                  onClick={() => void cargarHuecos(materia?.mat_id || "", modalidad)}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #FCA5A5",
                    borderRadius: "10px",
                    padding: "8px 16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "#991B1B",
                    cursor: "pointer",
                  }}
                >
                  Reintentar
                </button>
              </div>
            ) : buscando || huecos === null ? (
              <div
                style={{
                  padding: "28px",
                  borderRadius: "16px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "#4B5563",
                  fontSize: "0.9rem",
                  fontWeight: 600,
                }}
              >
                <Loader2 size={18} className="animate-spin" color="#5000BA" />
                Buscando horarios disponibles…
              </div>
            ) : huecosPorDia.length === 0 ? (
              <div
                style={{
                  padding: "24px",
                  borderRadius: "16px",
                  background: "#F9FAFB",
                  border: "1px solid #E5E7EB",
                  textAlign: "center",
                  color: "#4B5563",
                  fontSize: "0.88rem",
                }}
              >
                No hay horarios disponibles en esta modalidad para los próximos días. Prueba cambiando entre consulta telemática y presencial.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Selector horizontal de días estilizado */}
                <div
                  role="tablist"
                  aria-label="Días disponibles"
                  style={{
                    display: "flex",
                    gap: "8px",
                    overflowX: "auto",
                    paddingBottom: "6px",
                  }}
                >
                  {huecosPorDia.map((grupo) => {
                    const activo = grupo.clave === (grupoDiaActual?.clave ?? "");
                    return (
                      <button
                        key={grupo.clave}
                        type="button"
                        role="tab"
                        aria-selected={activo}
                        onClick={() => setDiaSeleccionado(grupo.clave)}
                        style={{
                          flexShrink: 0,
                          borderRadius: "14px",
                          padding: "10px 14px",
                          border: activo ? "2px solid #5000BA" : "1px solid #E5E7EB",
                          background: activo ? "#5000BA" : "#F9FAFB",
                          color: activo ? "#FFFFFF" : "#1F2937",
                          cursor: "pointer",
                          textAlign: "center",
                          minWidth: "96px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        <div style={{ fontSize: "0.82rem", fontWeight: 800, textTransform: "capitalize" }}>
                          {grupo.etiqueta}
                        </div>
                        <div
                          style={{
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            color: activo ? "#E9D5FF" : "#6B7280",
                            marginTop: "2px",
                          }}
                        >
                          {grupo.items.length} disponibles
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Cuadrícula de horas limpia (sin bullets) */}
                {grupoDiaActual && (
                  <div>
                    <div
                      style={{
                        fontSize: "0.8rem",
                        color: "#6B7280",
                        fontWeight: 600,
                        marginBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Clock size={14} color="#5000BA" />
                      <span>
                        Horas disponibles para el <strong style={{ color: "#111827", textTransform: "capitalize" }}>{grupoDiaActual.etiqueta}</strong>:
                      </span>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(92px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {grupoDiaActual.items.map((h) => {
                        const activo = elegido === h.hueco_inicio;
                        return (
                          <button
                            key={h.hueco_inicio}
                            type="button"
                            onClick={() => {
                              setElegido(h.hueco_inicio);
                              setError(null);
                            }}
                            aria-pressed={activo}
                            style={{
                              borderRadius: "12px",
                              padding: "11px 10px",
                              border: activo ? "2px solid #5000BA" : "1px solid #D1D5DB",
                              background: activo ? "#5000BA" : "#FFFFFF",
                              color: activo ? "#FFFFFF" : "#111827",
                              fontSize: "0.88rem",
                              fontWeight: 800,
                              cursor: "pointer",
                              textAlign: "center",
                              boxShadow: activo ? "0 4px 12px rgba(80, 0, 186, 0.22)" : "none",
                              transition: "all 0.12s ease",
                            }}
                          >
                            {FORMATO_SOLO_HORA.format(new Date(h.hueco_inicio))}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Barra inferior de resumen y pago directo */}
          <div
            style={{
              marginTop: "6px",
              paddingTop: "18px",
              borderTop: "1px solid #E5E7EB",
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "14px",
            }}
          >
            <button
              type="button"
              onClick={() => setPaso(0)}
              disabled={enviando}
              style={{
                background: "#F3F4F6",
                color: "#374151",
                border: "1px solid #E5E7EB",
                borderRadius: "14px",
                padding: "11px 18px",
                fontSize: "0.86rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <ArrowLeft size={16} />
              Atrás
            </button>

            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "14px" }}>
              {elegido && (
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontSize: "0.75rem", color: "#6B7280", fontWeight: 600, textTransform: "capitalize" }}>
                    {FORMATO_FECHA_COMPLETA.format(new Date(elegido))}
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "#111827" }}>
                    {entraEnPlan
                      ? "Cubierta por tu plan ($0.00)"
                      : `Total: ${formatearUSD(servicio.precio_total)} (IVA incl.)`}
                  </div>
                </div>
              )}

              <button
                type="button"
                onClick={onProcederAlPago}
                disabled={!elegido || enviando}
                style={{
                  background: !elegido || enviando ? "#CBD5E1" : "#5000BA",
                  color: "#FFFFFF",
                  border: "none",
                  borderRadius: "14px",
                  padding: "13px 24px",
                  fontSize: "0.94rem",
                  fontWeight: 800,
                  cursor: !elegido || enviando ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: !elegido || enviando ? "none" : "0 6px 20px rgba(80, 0, 186, 0.25)",
                }}
              >
                <CreditCard size={18} />
                {enviando
                  ? "Confirmando…"
                  : entraEnPlan
                    ? "Confirmar Cita"
                    : `Proceder al Pago (${formatearUSD(servicio.precio_total)})`}
              </button>
            </div>
          </div>
        </div>
      )}

      {error && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            padding: "12px 16px",
            borderRadius: "14px",
            fontSize: "0.86rem",
            fontWeight: 600,
          }}
        >
          {error}
        </div>
      )}

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
