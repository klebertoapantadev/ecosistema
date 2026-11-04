"use client";

// Botón de pago con PLUX dentro del checkout (TRQ-ADM-004).
//
// El paybox de PLUX está pensado para páginas clásicas: su script espera al
// evento `load` de la ventana para inyectar el botón y lee los globales
// `data` y `onAuthorize`. En una SPA ese `load` ya pasó, así que tras cargar
// los scripts se vuelve a disparar con jQuery. La tarjeta se escribe en un
// iframe de PLUX: nunca pasa por este componente.
import React, { useEffect, useRef, useState } from "react";
import { CheckCircle2, Lock, RefreshCw, XCircle } from "lucide-react";
import { consultarPagoPluxAction, prepararPagoPluxAction, type PagoPluxConsultado } from "../acciones-plux";
import { SCRIPT_JQUERY, SCRIPT_PAYBOX, respuestaExitosa, type PagadorPlux } from "../plux";

interface Props {
  negocio: string;
  varianteId: string;
  pagador: PagadorPlux;
  ambiente: string;
  alPagoAprobado: (identificador: string, pago: PagoPluxConsultado) => void;
}

type Fase = "inicio" | "preparando" | "listo" | "esperando" | "sin_confirmar" | "aprobado" | "rechazado" | "error";

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

export function BotonPagoPlux({ negocio, varianteId, pagador, ambiente, alPagoAprobado }: Props) {
  const [fase, setFase] = useState<Fase>("inicio");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const identificador = useRef<string | null>(null);
  const resuelto = useRef(false);

  // Con #ButtonPaybox ya en el DOM se dispara el `load` que espera PLUX para
  // inyectar su botón. En un efecto y no tras el setState: así es seguro que
  // React ya pintó el contenedor.
  useEffect(() => {
    if (fase === "listo") (window as any).jQuery?.(window).trigger("load");
  }, [fase]);

  // Si cambian los datos de facturación con el botón ya preparado, el pago
  // preparado lleva los viejos: se vuelve a empezar.
  const claveDatos = JSON.stringify([varianteId, pagador]);
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
    const r = await prepararPagoPluxAction({ negocio, varianteId, pagador });
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
    w.onAuthorize = (respuesta: unknown) => {
      // Al cerrar el modal llega un "failed" aunque el pago haya salido bien.
      if (!respuestaExitosa(respuesta) || !identificador.current) return;
      setFase("esperando");
      esperarWebhook(identificador.current);
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

  const caja: React.CSSProperties = {
    border: "1px solid #E2E8F0",
    borderRadius: "10px",
    padding: "14px",
    marginTop: "14px",
    background: "#F8FAFC",
  };

  return (
    <div style={caja}>
      <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px" }}>
        <Lock size={16} color="#0284C7" />
        <strong style={{ fontSize: "0.85rem", color: "#1E293B" }}>Pagar con PLUX</strong>
        {ambiente !== "PRODUCCION" && (
          <span
            style={{
              marginLeft: "auto",
              fontSize: "0.7rem",
              fontWeight: 700,
              background: "#FEF3C7",
              color: "#92400E",
              padding: "2px 8px",
              borderRadius: "999px",
            }}
          >
            MODO PRUEBA · solo tarjetas de prueba
          </span>
        )}
      </div>

      {(fase === "inicio" || fase === "error" || fase === "rechazado") && (
        <button
          type="button"
          onClick={preparar}
          style={{
            background: "#0284C7",
            color: "#FFFFFF",
            border: "none",
            padding: "10px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          {fase === "inicio" ? "Continuar con PLUX" : "Intentar de nuevo"}
        </button>
      )}

      {fase === "preparando" && (
        <span style={{ fontSize: "0.82rem", color: "#475569", display: "inline-flex", gap: "6px", alignItems: "center" }}>
          <RefreshCw size={14} className="animate-spin" /> Preparando el pago…
        </span>
      )}

      {/* PLUX inyecta aquí su botón "Pagar ahora" y, al pulsarlo, su modal. */}
      {(fase === "listo" || fase === "esperando" || fase === "sin_confirmar") && <div id="ButtonPaybox" style={{ minHeight: "48px" }} />}

      {fase === "esperando" && (
        <p style={{ fontSize: "0.82rem", color: "#475569", display: "flex", gap: "6px", alignItems: "center" }}>
          <RefreshCw size={14} className="animate-spin" /> Pago autorizado. Esperando la confirmación de PLUX…
        </p>
      )}

      {fase === "aprobado" && (
        <p style={{ fontSize: "0.85rem", color: "#059669", display: "flex", gap: "6px", alignItems: "center" }}>
          <CheckCircle2 size={16} /> PLUX confirmó el pago.
        </p>
      )}

      {mensaje && (
        <p style={{ fontSize: "0.8rem", color: fase === "sin_confirmar" ? "#475569" : "#B91C1C", display: "flex", gap: "6px" }}>
          {fase !== "sin_confirmar" && <XCircle size={14} style={{ flexShrink: 0, marginTop: "2px" }} />}
          {mensaje}
        </p>
      )}
    </div>
  );
}
