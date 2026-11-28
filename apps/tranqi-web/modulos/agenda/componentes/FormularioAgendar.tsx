"use client";

import { useEffect, useMemo, useRef, useState, useTransition, type CSSProperties } from "react";
import Link from "next/link";
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
  /**
   * "pasos": asistente de dos pasos del widget de Agendamiento (al confirmar, va a Mis citas).
   * "recorrido": inicio del cliente (TRQ-041). Una sola tarjeta que va del problema a la
   * solución sin cambiar de vista: lo contado queda resumido arriba, la cita se elige debajo
   * y al confirmar se queda en el inicio con el caso "en marcha".
   */
  variante?: "pasos" | "recorrido";
}

const HITOS_RECORRIDO = ["Tu problema", "Tu especialista", "Tu cita", "En marcha"] as const;

/** Los cuatro hitos del recorrido, siempre visibles: orientan sin ser pestañas. */
function CaminoRecorrido({ hito }: { hito: number }) {
  return (
    <ol className="camino-recorrido" aria-label="Progreso">
      {HITOS_RECORRIDO.map((nombre, i) => {
        const estado = i < hito ? "es-hecho" : i === hito ? "es-activo" : "";
        return (
          <li key={nombre} className={estado} aria-current={i === hito ? "step" : undefined}>
            <span className="camino-numero" aria-hidden="true">
              {i < hito ? <Check size={13} strokeWidth={3} /> : i + 1}
            </span>
            <span className="camino-etiqueta">{nombre}</span>
          </li>
        );
      })}
    </ol>
  );
}

/** Bloque interior de la tarjeta del recorrido: sin borde propio, separado por una línea. */
const BLOQUE_RECORRIDO: CSSProperties = {
  padding: "24px clamp(18px, 3vw, 30px)",
  borderTop: "1px solid var(--linea)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

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
  variante = "pasos",
}: Props) {
  const esRecorrido = variante === "recorrido";
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
          if (esRecorrido) void irAPasoAgendamiento(matFallback.mat_id, texto.slice(0, 500));
        } else {
          setError(res.error);
        }
        return;
      }

      const resultado = res.data;
      setTriaje(resultado);
      setMateriaId(resultado.materia_id);
      setMotivo(resultado.motivo_resumido || texto.slice(0, 500));
      // En el recorrido no hay botón "Continuar": si ARIA ya sabe de qué va, la cita
      // aparece debajo directamente. Si necesita una aclaración, se queda en la pregunta.
      if (esRecorrido && !resultado.necesita_aclaracion) {
        void irAPasoAgendamiento(resultado.materia_id, resultado.motivo_resumido || texto.slice(0, 500));
        return;
      }
      setTimeout(() => {
        respuestaRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }, 80);
    } finally {
      setAnalizandoAria(false);
    }
  }

  // matId y motivoNuevo llegan explícitos cuando se llama justo tras setMateriaId/setMotivo
  // (el estado aún no se ha actualizado en este render).
  async function irAPasoAgendamiento(matId?: string, motivoNuevo?: string) {
    setError(null);
    const matEfectiva = matId || materiaId || materiaPorDefecto?.mat_id || "";
    if (!matEfectiva) {
      setError("Primero cuéntanos tu necesidad para asignar la especialidad.");
      return;
    }
    const motivoEfectivo = motivoNuevo ?? motivo;
    if (!motivoEfectivo || motivoEfectivo.trim().length < 4) {
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
      if (esRecorrido) {
        // Se queda en el inicio: refresca las cifras (próxima cita, trámites) sin perder este estado.
        router.refresh();
        return;
      }
      setTimeout(() => {
        router.push("/panel/agendamiento?widget=mis_citas");
      }, 1500);
    });
  }

  /** "Resolver otra cosa": vuelve a la pregunta en blanco. */
  function reiniciarRecorrido() {
    setPaso(0);
    setRelatoUsuario("");
    setTriaje(null);
    setMateriaId("");
    setMotivo("");
    setMostrarSelectorManual(false);
    setModalidad("virtual");
    setHuecos(null);
    setElegido(null);
    setCitaConfirmadaId(null);
    setError(null);
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

  const pasosRestantes = [
    { titulo: "Revisamos lo que nos contaste", detalle: `Un abogado especialista en ${materia?.mat_nombre ?? "Derecho"} llega a la cita sabiendo de qué va tu caso.` },
    {
      titulo: `Tu cita: ${elegido ? FORMATO_FECHA_COMPLETA.format(new Date(elegido)) : ""}`,
      detalle: modalidad === "virtual" ? "La verás en Mis citas, con el enlace para unirte." : "La verás en Mis citas, con la dirección del despacho.",
    },
    { titulo: "Sales con la solución", detalle: "Los pasos para resolverlo: qué hacer, cuánto cuesta y cuánto tarda." },
  ];

  if (citaConfirmadaId && elegido && esRecorrido) {
    return (
      <section className="recorrido-resolver" id="resolver" aria-label="Resolver una necesidad legal">
        <CaminoRecorrido hito={4} />
        <div className="recorrido-en-marcha" role="status">
          <span className="en-marcha-sello" aria-hidden="true">
            <Check size={26} strokeWidth={2.6} />
          </span>
          <div>
            <h2>Tu caso ya está en marcha</h2>
            <p>
              Consulta {modalidad === "virtual" ? "por videollamada" : "en el despacho"} con un especialista en{" "}
              <strong>{materia?.mat_nombre ?? "Derecho"}</strong>.
            </p>
            <ol className="en-marcha-pasos">
              <li className="es-hecho">
                <b>Nos contaste tu problema</b>
                <span>Quedó registrado junto a tu cita.</span>
              </li>
              {pasosRestantes.map((p) => (
                <li key={p.titulo}>
                  <b>{p.titulo}</b>
                  <span>{p.detalle}</span>
                </li>
              ))}
            </ol>
            <div className="en-marcha-acciones">
              <Link href="/panel/agendamiento?widget=mis_citas" className="btn btn-primario">
                Ver mis citas
              </Link>
              <button type="button" className="btn btn-neutro" onClick={reiniciarRecorrido}>
                Resolver otra cosa
              </button>
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (citaConfirmadaId && elegido) {
    return (
      <div
        style={{
          background: "var(--exito-diluido)",
          border: "1.5px solid var(--exito-linea)",
          borderRadius: "24px",
          padding: "36px 28px",
          textAlign: "center",
          boxShadow: "0 10px 30px rgba(14, 102, 72, 0.08)",
        }}
      >
        <div
          style={{
            width: "56px",
            height: "56px",
            borderRadius: "18px",
            background: "#0E6648",
            color: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
          }}
        >
          <CheckCircle2 size={30} />
        </div>
        <h2 style={{ fontSize: "1.35rem", fontWeight: 800, color: "var(--exito-texto)", margin: "0 0 8px" }}>
          ¡Consulta Agendada y Confirmada!
        </h2>
        <p style={{ fontSize: "0.95rem", color: "var(--exito-texto)", maxWidth: "460px", margin: "0 auto", lineHeight: 1.5 }}>
          Tu cita con el especialista en <strong>{materia?.mat_nombre ?? "Derecho"}</strong> para el{" "}
          <strong>{FORMATO_FECHA_COMPLETA.format(new Date(elegido))}</strong> ha quedado confirmada. Redirigiendo a tus citas…
        </p>
      </div>
    );
  }

  const hitoActual = paso === 1 ? 2 : triaje ? 1 : 0;

  return (
    <div
      {...(esRecorrido
        ? { className: "recorrido-resolver", id: "resolver", role: "region", "aria-label": "Resolver una necesidad legal" }
        : { style: { display: "flex", flexDirection: "column", gap: "20px" } })}
    >
      {esRecorrido && <CaminoRecorrido hito={hitoActual} />}

      {/* Lo contado, resumido: en el recorrido no desaparece al pasar a la cita */}
      {esRecorrido && paso === 1 && (
        <div style={{ ...BLOQUE_RECORRIDO, borderTop: "none", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "12px" }}>
            <div style={{ minWidth: 0 }}>
              <div className="recorrido-eyebrow">Nos contaste</div>
              <p style={{ margin: "4px 0 0", fontSize: "0.94rem", color: "var(--texto)", fontStyle: "italic", lineHeight: 1.5 }}>
                «{relatoUsuario.trim()}»
              </p>
            </div>
            <button
              type="button"
              onClick={() => setPaso(0)}
              style={{ background: "transparent", border: "none", color: "var(--panel-accion)", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer", padding: 0, whiteSpace: "nowrap" }}
            >
              Cambiar
            </button>
          </div>

          <div
            style={{
              background: "var(--acento-diluido)",
              border: "1px solid var(--acento-linea)",
              borderRadius: "16px",
              padding: "16px 18px",
              display: "flex",
              flexDirection: "column",
              gap: "10px",
            }}
          >
            <div className="recorrido-eyebrow" style={{ color: "var(--panel-accion)" }}>Lo que entendimos</div>
            {triaje?.respuesta_aria && (
              <p style={{ margin: 0, fontSize: "0.94rem", color: "var(--texto)", lineHeight: 1.55 }}>{triaje.respuesta_aria}</p>
            )}
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px 14px" }}>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "8px", fontSize: "0.92rem", color: "var(--texto)" }}>
                <Scale size={17} color="var(--panel-accion)" aria-hidden="true" />
                Te atiende un especialista en <strong>{materia?.mat_nombre ?? "Civil"}</strong>
              </span>
              <button
                type="button"
                onClick={() => setMostrarSelectorManual((v) => !v)}
                style={{ background: "transparent", border: "none", color: "var(--panel-accion)", fontSize: "0.8rem", fontWeight: 700, textDecoration: "underline", cursor: "pointer", padding: 0 }}
              >
                {mostrarSelectorManual ? "Cerrar" : "¿No es tu tema?"}
              </button>
            </div>
            {mostrarSelectorManual && (
              <select
                aria-label="Especialidad"
                value={materia?.mat_id ?? ""}
                onChange={(e) => {
                  setMateriaId(e.target.value);
                  setElegido(null);
                  setMostrarSelectorManual(false);
                  void cargarHuecos(e.target.value, modalidad);
                }}
                style={{
                  width: "100%",
                  borderRadius: "12px",
                  border: "1px solid var(--linea-fuerte)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  padding: "10px 12px",
                  fontSize: "0.88rem",
                  color: "var(--texto)",
                  fontWeight: 600,
                }}
              >
                {materias.map((m) => (
                  <option key={m.mat_id} value={m.mat_id}>
                    {m.mat_nombre}
                  </option>
                ))}
              </select>
            )}
          </div>
        </div>
      )}

      {/* Indicador minimalista de 2 pasos */}
      {!esRecorrido && (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--linea)",
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
              background: paso === 0 ? "#5000BA" : "#0E6648",
              color: "#FFFFFF",
            }}
          >
            {paso > 0 ? <Check size={16} strokeWidth={2.8} /> : "1"}
          </span>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--texto-suave)" }}>
              Paso 1
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: paso === 0 ? "var(--ct-5000ba, #5000BA)" : "var(--texto)" }}>
              Cuéntanos tu necesidad
            </div>
          </div>
        </button>

        <div style={{ flex: 1, height: "2px", background: paso === 1 ? "#5000BA" : "var(--linea)", margin: "0 16px", maxWidth: "120px" }} />

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
              background: paso === 1 ? "#5000BA" : "var(--fondo-hundido)",
              color: paso === 1 ? "#FFFFFF" : "var(--texto-suave)",
            }}
          >
            2
          </span>
          <div>
            <div style={{ fontSize: "0.72rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--texto-suave)" }}>
              Paso 2
            </div>
            <div style={{ fontSize: "0.9rem", fontWeight: 800, color: paso === 1 ? "var(--ct-5000ba, #5000BA)" : "var(--texto-2)" }}>
              Modalidad, horario y pago
            </div>
          </div>
        </button>
      </div>
      )}

      {/* =====================================================================
          PASO 1: PREGUNTA SIMPLE Y RESPUESTA DE ESPECIALIDAD CON ARIA
         ===================================================================== */}
      {paso === 0 && (
        <div
          style={
            esRecorrido
              ? BLOQUE_RECORRIDO
              : {
                  background: "var(--cf-ffffff, #FFFFFF)",
                  border: "1px solid var(--linea)",
                  borderRadius: "24px",
                  padding: "28px 26px",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "20px",
                }
          }
        >
          <div>
            {!esRecorrido && (
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                background: "var(--acento-diluido)",
                color: "var(--ct-5000ba, #5000BA)",
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
            )}
            {/* En el inicio el h1 es el saludo: aquí la pregunta baja a h2 */}
            {(() => {
              const Titulo = esRecorrido ? "h2" : "h1";
              return (
                <Titulo style={{ fontSize: esRecorrido ? "clamp(1.3rem, 2.4vw, 1.6rem)" : "1.45rem", fontWeight: 800, color: "var(--texto)", margin: "0 0 6px", letterSpacing: "-0.02em" }}>
                  ¿Qué necesitas resolver hoy?
                </Titulo>
              );
            })()}
            <p style={{ fontSize: "0.92rem", color: "var(--texto-2)", margin: 0, lineHeight: 1.5 }}>
              {esRecorrido
                ? "Cuéntalo con tus palabras, como se lo contarías a un amigo. Identificamos el tema y te asignamos al especialista que mejor lo conoce."
                : "Cuéntanos tu caso con tus propias palabras. Identificaremos de inmediato qué especialista legal debe atenderte."}
            </p>
          </div>

          {/* Ejemplos rápidos en chips limpios */}
          <div>
            <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--texto-suave)", marginBottom: "8px" }}>
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
                      background: activo ? "var(--acento-diluido)" : "var(--fondo-suave)",
                      border: activo ? "1.5px solid #5000BA" : "1px solid var(--linea)",
                      color: activo ? "var(--ct-5000ba, #5000BA)" : "var(--texto-2)",
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
                border: "1.5px solid var(--linea-fuerte)",
                background: "var(--fondo-suave)",
                padding: "14px 16px",
                fontSize: "0.95rem",
                color: "var(--texto)",
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
                background: "linear-gradient(135deg, var(--acento-diluido) 0%, var(--exito-diluido) 100%)",
                border: "1.5px solid var(--acento-linea)",
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
                  <div style={{ fontSize: "0.75rem", fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.04em", color: "var(--ct-5000ba, #5000BA)", marginBottom: "4px" }}>
                    Recomendación de Tranqi
                  </div>
                  <p style={{ fontSize: "0.94rem", color: "var(--texto)", margin: "0 0 12px", lineHeight: 1.55 }}>
                    {triaje.respuesta_aria}
                  </p>

                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "10px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: "1px solid var(--acento-linea)",
                      borderRadius: "14px",
                      padding: "12px 16px",
                    }}
                  >
                    <div>
                      <div style={{ fontSize: "0.74rem", color: "var(--texto-suave)", fontWeight: 600 }}>
                        Especialista para tu agendamiento:
                      </div>
                      <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--ct-0e6648, #0E6648)" }}>
                        Abogado Especialista en {materia.mat_nombre}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarSelectorManual((v) => !v)}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "var(--ct-5000ba, #5000BA)",
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
                          border: "1px solid var(--linea-fuerte)",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          padding: "10px 12px",
                          fontSize: "0.88rem",
                          color: "var(--texto)",
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
                    background: "#0E6648",
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
                    boxShadow: "0 6px 18px rgba(14, 102, 72, 0.24)",
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
          style={
            esRecorrido
              ? { ...BLOQUE_RECORRIDO, gap: "24px" }
              : {
                  background: "var(--cf-ffffff, #FFFFFF)",
                  border: "1px solid var(--linea)",
                  borderRadius: "24px",
                  padding: "28px 26px",
                  boxShadow: "0 10px 30px rgba(15, 23, 42, 0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "24px",
                }
          }
        >
          {/* Resumen superior de la especialidad (en el recorrido ya está en "Lo que entendimos") */}
          {!esRecorrido && (
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              background: "var(--acento-diluido)",
              border: "1px solid var(--acento-linea)",
              borderRadius: "16px",
              padding: "12px 16px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <Scale size={18} color="#5000BA" />
              <span style={{ fontSize: "0.88rem", color: "var(--texto)" }}>
                Especialista asignado: <strong style={{ color: "var(--ct-5000ba, #5000BA)" }}>{materia?.mat_nombre ?? "Civil"}</strong>
              </span>
            </div>
            <button
              type="button"
              onClick={() => setPaso(0)}
              style={{
                background: "transparent",
                border: "none",
                color: "var(--ct-5000ba, #5000BA)",
                fontSize: "0.8rem",
                fontWeight: 700,
                textDecoration: "underline",
                cursor: "pointer",
              }}
            >
              Cambiar caso
            </button>
          </div>
          )}

          {/* 1. Selección exclusiva entre Telemática o Presencial */}
          <div>
            <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: "var(--texto)", margin: "0 0 12px" }}>
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
                  border: modalidad === "virtual" ? "2px solid #5000BA" : "1.5px solid var(--linea)",
                  background: modalidad === "virtual" ? "var(--acento-diluido)" : "var(--cf-ffffff, #FFFFFF)",
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
                      background: modalidad === "virtual" ? "#5000BA" : "var(--fondo-hundido)",
                      color: modalidad === "virtual" ? "#FFFFFF" : "var(--texto-2)",
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
                      color: modalidad === "virtual" ? "var(--ct-5000ba, #5000BA)" : "var(--texto)",
                      background: modalidad === "virtual" ? "var(--acento-diluido)" : "var(--fondo-hundido)",
                      padding: "4px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    {entraEnPlan ? "Incluida ($0.00)" : formatearUSD(servicioVirtual.precio_total)}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--texto)", marginTop: "4px" }}>
                  Consulta Telemática
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--texto-suave)", lineHeight: 1.4 }}>
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
                  border: modalidad === "presencial" ? "2px solid #5000BA" : "1.5px solid var(--linea)",
                  background: modalidad === "presencial" ? "var(--acento-diluido)" : "var(--cf-ffffff, #FFFFFF)",
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
                      background: modalidad === "presencial" ? "#5000BA" : "var(--fondo-hundido)",
                      color: modalidad === "presencial" ? "#FFFFFF" : "var(--texto-2)",
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
                      color: modalidad === "presencial" ? "var(--ct-5000ba, #5000BA)" : "var(--texto)",
                      background: modalidad === "presencial" ? "var(--acento-diluido)" : "var(--fondo-hundido)",
                      padding: "4px 10px",
                      borderRadius: "999px",
                    }}
                  >
                    {entraEnPlan ? "Incluida ($0.00)" : formatearUSD(servicioPresencial.precio_total)}
                  </span>
                </div>
                <div style={{ fontSize: "1rem", fontWeight: 800, color: "var(--texto)", marginTop: "4px" }}>
                  Consulta Presencial
                </div>
                <div style={{ fontSize: "0.82rem", color: "var(--texto-suave)", lineHeight: 1.4 }}>
                  {configAgenda.direccion_presencial || "Atención personalizada en Despacho Tranqi"}.
                </div>
              </button>
            </div>
          </div>

          {/* 2. Selección de fecha y hora */}
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
              <h2 style={{ fontSize: "1.12rem", fontWeight: 800, color: "var(--texto)", margin: 0, display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={19} color="#5000BA" />
                2. Elige el día y la hora ({modalidad === "virtual" ? "Telemática" : "Presencial"})
              </h2>
              <button
                type="button"
                onClick={() => void cargarHuecos(materia?.mat_id || "", modalidad)}
                disabled={buscando}
                style={{
                  background: "var(--fondo-suave)",
                  border: "1px solid var(--linea)",
                  borderRadius: "10px",
                  padding: "6px 12px",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  color: "var(--texto-2)",
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
              <div style={{ padding: "20px", borderRadius: "16px", background: "var(--error-diluido)", border: "1px solid var(--error-linea)", textAlign: "center" }}>
                <p style={{ fontSize: "0.88rem", color: "var(--error-texto)", margin: "0 0 10px" }}>
                  No pudimos cargar los horarios disponibles.
                </p>
                <button
                  type="button"
                  onClick={() => void cargarHuecos(materia?.mat_id || "", modalidad)}
                  style={{
                    background: "var(--cf-ffffff, #FFFFFF)",
                    border: "1px solid var(--error-linea)",
                    borderRadius: "10px",
                    padding: "8px 16px",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    color: "var(--error-texto)",
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
                  background: "var(--fondo-suave)",
                  border: "1px solid var(--linea)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "var(--texto-2)",
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
                  background: "var(--fondo-suave)",
                  border: "1px solid var(--linea)",
                  textAlign: "center",
                  color: "var(--texto-2)",
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
                          border: activo ? "2px solid #5000BA" : "1px solid var(--linea)",
                          background: activo ? "#5000BA" : "var(--fondo-suave)",
                          color: activo ? "#FFFFFF" : "var(--texto)",
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
                            color: activo ? "var(--acento-linea)" : "var(--texto-suave)",
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
                        color: "var(--texto-suave)",
                        fontWeight: 600,
                        marginBottom: "10px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <Clock size={14} color="#5000BA" />
                      <span>
                        Horas disponibles para el <strong style={{ color: "var(--texto)", textTransform: "capitalize" }}>{grupoDiaActual.etiqueta}</strong>:
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
                              border: activo ? "2px solid #5000BA" : "1px solid var(--linea-fuerte)",
                              background: activo ? "#5000BA" : "var(--cf-ffffff, #FFFFFF)",
                              color: activo ? "#FFFFFF" : "var(--texto)",
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
              borderTop: "1px solid var(--linea)",
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
                background: "var(--fondo-hundido)",
                color: "var(--texto-2)",
                border: "1px solid var(--linea)",
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
                  <div style={{ fontSize: "0.75rem", color: "var(--texto-suave)", fontWeight: 600, textTransform: "capitalize" }}>
                    {FORMATO_FECHA_COMPLETA.format(new Date(elegido))}
                  </div>
                  <div style={{ fontSize: "0.95rem", fontWeight: 800, color: "var(--texto)" }}>
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
                  background: !elegido || enviando ? "var(--linea-fuerte)" : "#5000BA",
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
            background: "var(--error-diluido)",
            border: "1px solid var(--error-linea)",
            color: "var(--error-texto)",
            padding: "12px 16px",
            borderRadius: "14px",
            fontSize: "0.86rem",
            fontWeight: 600,
            margin: esRecorrido ? "0 clamp(18px, 3vw, 30px) 20px" : undefined,
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
