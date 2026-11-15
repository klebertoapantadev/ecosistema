"use client";

// Botón de pago con PLUX dentro del checkout (TRQ-ADM-004).
//
// El paybox de PLUX está pensado para páginas clásicas: su script espera al
// evento `load` de la ventana para inyectar el botón y lee los globales
// `data` y `onAuthorize`. En una SPA ese `load` ya pasó, así que tras cargar
// los scripts se vuelve a disparar con jQuery. La tarjeta se escribe en un
// iframe de PLUX: nunca pasa por este componente.
import React, { useEffect, useRef, useState } from "react";
import { Lock, RefreshCw } from "lucide-react";
import {
  confirmarPagoPluxAction,
  consultarPagoPluxAction,
  prepararPagoPluxAction,
  prepararPagoPluxProformaAction,
  type ModalidadCobroProforma,
  type PagoPluxConsultado,
} from "../acciones-plux";
import { SCRIPT_JQUERY, SCRIPT_PAYBOX, respuestaExitosa, type PagadorPlux } from "../plux";

interface Props {
  negocio: string;
  varianteId?: string;
  proformaId?: string;
  tokenAprobacion?: string;
  respaldoFirmado?: string;
  modalidadCobro?: ModalidadCobroProforma;
  pagador: PagadorPlux;
  ambiente: string;
  alPagoAprobado: (identificador: string, pago: PagoPluxConsultado) => void;
  /**
   * Avisa al checkout de cada fase para que muestre «procesando» o el rechazo.
   * `motivo` viene de PLUX (p. ej. MONTO_DISTINTO: hubo cobro y va a revisión).
   */
  alCambiarFase?: (fase: FasePlux, mensaje: string | null, motivo: string | null) => void;
  /** Texto del botón principal, p. ej. el importe. */
  etiqueta?: React.ReactNode;
}

export type FasePlux = "inicio" | "preparando" | "listo" | "esperando" | "sin_confirmar" | "aprobado" | "rechazado" | "error";
type Fase = FasePlux;

const ESPERA_MS = 3000;
const ESPERA_INTENTOS = 40; // 2 minutos: PLUX suele avisar en segundos

function cargarScript(src: string): Promise<void> {
  const existente = document.querySelector<HTMLScriptElement>(`script[src="${src}"]`);
  if (existente?.dataset.cargado) return Promise.resolve();
  return new Promise((ok, mal) => {
    const s = existente ?? document.createElement("script");
    s.addEventListener("load", () => {
      s.dataset.cargado = "1";
      ok();
    });
    s.addEventListener("error", () => {
      // Sin quitarlo, el reintento encontraría el <script> fallido y esperaría
      // para siempre un load que no llega.
      s.remove();
      mal(new Error(`No se pudo cargar ${src}`));
    });
    if (!existente) {
      s.src = src;
      document.head.appendChild(s);
    }
  });
}

// index.js carga environments.js por su cuenta; si se dispara `load` antes de
// que exista getEnvJson, PLUX inyecta el botón tarde y sin su manejador de clic.
async function esperarEntornoPlux(): Promise<void> {
  for (let i = 0; i < 100; i++) {
    if (typeof (window as any).getEnvJson === "function") return;
    await new Promise((ok) => setTimeout(ok, 50));
  }
  throw new Error("PLUX no terminó de cargar");
}

export function BotonPagoPlux({
  negocio,
  varianteId,
  proformaId,
  tokenAprobacion,
  respaldoFirmado,
  modalidadCobro = "TOTAL_100",
  pagador,
  ambiente,
  alPagoAprobado,
  alCambiarFase,
  etiqueta,
}: Props) {
  const [fase, setFase] = useState<Fase>("inicio");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const identificador = useRef<string | null>(null);
  const resuelto = useRef(false);
  const motivo = useRef<string | null>(null);

  const avisar = useRef(alCambiarFase);
  avisar.current = alCambiarFase;
  useEffect(() => {
    avisar.current?.(fase, mensaje, motivo.current);
  }, [fase, mensaje]);

  // Con #ButtonPaybox ya en el DOM se dispara el `load` que espera PLUX para
  // inyectar su botón. En un efecto y no tras el setState: así es seguro que
  // React ya pintó el contenedor.
  useEffect(() => {
    if (fase === "listo") (window as any).jQuery?.(window).trigger("load");
  }, [fase]);

  // Si cambian los datos de facturación o modalidad con el botón ya preparado,
  // el pago preparado lleva los viejos: se vuelve a empezar.
  const claveDatos = JSON.stringify([varianteId, proformaId, tokenAprobacion, modalidadCobro, pagador]);
  useEffect(() => {
    setFase((f) => (f === "listo" ? "inicio" : f));
  }, [claveDatos]);

  // Al desmontar se quitan los globales (data lleva los datos del pagador):
  // el siguiente checkout empieza limpio.
  useEffect(
    () => () => {
      resuelto.current = true;
      delete (window as any).onAuthorize;
      delete (window as any).data;
    },
    [],
  );

  async function esperarWebhook(id: string) {
    for (let i = 0; i < ESPERA_INTENTOS && !resuelto.current; i++) {
      await new Promise((ok) => setTimeout(ok, ESPERA_MS));
      const r = await consultarPagoPluxAction(id);
      if (!r.ok || r.data.estado === "PENDIENTE") continue;
      resuelto.current = true;
      if (r.data.estado === "APROBADO") {
        setFase("aprobado");
        alPagoAprobado(id, r.data);
      } else {
        motivo.current = r.data.motivo;
        setFase("rechazado");
        setMensaje(
          r.data.motivo === "MONTO_DISTINTO"
            ? "PLUX informó un monto distinto al del pedido. No se activó nada; el equipo lo revisará."
            : "PLUX no aprobó el pago. No se te cobró y puedes intentarlo de nuevo.",
        );
      }
      return;
    }
    if (!resuelto.current) {
      // Sin botón de reintentar: el banco ya aprobó y otro intento cobraría dos veces.
      setFase("sin_confirmar");
      setMensaje("El banco aprobó el pago, pero PLUX aún no lo confirma. Tu plan se activará en cuanto llegue la confirmación.");
    }
  }

  async function preparar() {
    setFase("preparando");
    setMensaje(null);
    motivo.current = null;
    const r = proformaId && tokenAprobacion
      ? await prepararPagoPluxProformaAction({
          negocio,
          proformaId,
          tokenAprobacion,
          respaldoFirmado,
          modalidadCobro,
          pagador,
        })
      : varianteId
        ? await prepararPagoPluxAction({ negocio, varianteId, pagador })
        : { ok: false as const, error: "Falta el producto o la proforma para iniciar el pago." };
    if (!r.ok) {
      setFase("error");
      setMensaje(r.error);
      return;
    }
    identificador.current = r.data.identificador;
    resuelto.current = false;

    const w = window as any;
    // El script de PLUX lee `data` cada vez que se abre el modal.
    w.data = r.data.paybox;
    w.onAuthorize = async (respuesta: unknown) => {
      // Al cerrar el modal llega un "failed" aunque el pago haya salido bien.
      if (!respuestaExitosa(respuesta) || !identificador.current || resuelto.current) return;
      const idActual = identificador.current;
      setFase("esperando");

      try {
        const conf = await confirmarPagoPluxAction({
          negocio,
          identificador: idActual,
          respuestaPaybox: respuesta,
          tokenAprobacion,
          pagador,
          modalidadCobro,
        });
        if (conf.ok && conf.data.estado === "APROBADO") {
          resuelto.current = true;
          setFase("aprobado");
          alPagoAprobado(idActual, conf.data);
          return;
        }
      } catch {
        // Si falla la acción inmediata, continúa esperando por polling del webhook
      }

      esperarWebhook(idActual);
    };

    try {
      await cargarScript(SCRIPT_JQUERY);
      await cargarScript(SCRIPT_PAYBOX[ambiente === "PRODUCCION" ? "PRODUCCION" : "PRUEBAS"]);
      await esperarEntornoPlux();
      setFase("listo");
    } catch (e: any) {
      setFase("error");
      setMensaje(e?.message || "No se pudo cargar PLUX.");
    }
  }

  const preparando = fase === "preparando";
  const conBoton = fase === "inicio" || fase === "error" || fase === "rechazado" || preparando;

  // Funciona tanto dentro del checkout modal (.ckt-velo) como en páginas autónomas (/proforma/[token], ModalCheckoutTinkay).
  return (
    <div className="ckt-plux-zona" style={{ display: "flex", flexDirection: "column", gap: "10px", width: "100%" }}>
      <style>{`
        @keyframes ecoPluxSpin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
        .ckt-plux-zona .ckt-girar { animation: ecoPluxSpin 0.9s linear infinite; }
        .ckt-plux-zona #ButtonPaybox { display: flex; justify-content: center; width: 100%; margin-top: 4px; }
      `}</style>
      {conBoton && (
        <button
          type="button"
          className="ckt-btn ckt-btn-primario"
          onClick={preparar}
          disabled={preparando}
          style={{
            width: "100%",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
            padding: "13px 20px",
            borderRadius: "12px",
            border: "none",
            background: preparando ? "#9CA3AF" : "linear-gradient(135deg, #2D4A3E 0%, #1F352C 100%)",
            color: "#FFFFFF",
            fontWeight: 700,
            fontSize: "0.95rem",
            cursor: preparando ? "wait" : "pointer",
            boxShadow: "0 4px 14px rgba(31, 53, 44, 0.22)",
          }}
        >
          {preparando ? <RefreshCw size={18} className="ckt-girar" /> : <Lock size={18} />}
          {preparando ? "Preparando…" : fase === "inicio" ? etiqueta ?? "Pagar con PLUX" : "Reintentar"}
        </button>
      )}

      {fase === "listo" && (
        <p
          className="ckt-nota"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#F0FDF4",
            border: "1px solid #BBF7D0",
            color: "#166534",
            fontSize: "0.83rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Pulsa el botón oficial de PLUX abajo e ingresa tu tarjeta en su ventana segura.
        </p>
      )}

      {fase === "esperando" && (
        <p
          className="ckt-nota"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#EFF6FF",
            border: "1px solid #BFDBFE",
            color: "#1E40AF",
            fontSize: "0.83rem",
            fontWeight: 600,
            textAlign: "center",
          }}
        >
          Verificando autorización bancaria con PLUX…
        </p>
      )}

      {/* PLUX inyecta aquí su botón "Pagar ahora" y, al pulsarlo, su modal. */}
      {(fase === "listo" || fase === "esperando" || fase === "sin_confirmar") && <div id="ButtonPaybox" />}

      {mensaje && (fase === "error" || fase === "rechazado" || fase === "sin_confirmar") && (
        <p
          className="ckt-error"
          role="alert"
          style={{
            margin: 0,
            padding: "10px 12px",
            borderRadius: "10px",
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#B91C1C",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          {mensaje}
        </p>
      )}
    </div>
  );
}
