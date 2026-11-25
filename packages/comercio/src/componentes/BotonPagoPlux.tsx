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
import { leerAtribucionNavegador } from "../marketing-meta";
import { SCRIPT_JQUERY, SCRIPT_PAYBOX, respuestaExitosa, type PagadorPlux } from "../plux";

export interface DetalleErrorPlux {
  codigo: string;
  mensajeUsuario: string;
  detalleTecnico: string;
}

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
  /**
   * Avisa de inmediato ante cualquier error de carga, CORS/red en Paybox, apertura fallida o rechazo.
   */
  alErrorPago?: (detalle: DetalleErrorPlux) => void;
  /** Texto del botón principal, p. ej. el importe. */
  etiqueta?: React.ReactNode;
  /** Prepara y despliega de inmediato el botón oficial PLUX sin requerir un clic intermedio. */
  autoIniciar?: boolean;
  /** Tras inyectarse #ButtonPaybox, dispara automáticamente su apertura mostrando spinner. */
  autoAbrirModal?: boolean;
  /** Evita generar factura electrónica SRI automática (usado en links de pago rápidos desde chat). */
  omitirFacturaAutomatica?: boolean;
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

// Detecta si PLUX ya pintó visible su ventana/iframe de tarjeta en el DOM.
function existeModalPluxVisible(): boolean {
  if (typeof document === "undefined") return false;
  const candidatos = document.querySelectorAll<HTMLElement>(
    'iframe[src*="pagoplux" i], iframe[src*="paybox" i], #modalPaybox, .pbox-modal, [id*="paybox" i]:not(#ButtonPaybox)'
  );
  for (const el of candidatos) {
    const style = window.getComputedStyle(el);
    if (
      style.display !== "none" &&
      style.visibility !== "hidden" &&
      el.offsetWidth > 0 &&
      el.offsetHeight > 0
    ) {
      return true;
    }
  }
  return false;
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
  alErrorPago,
  etiqueta,
  autoIniciar = false,
  autoAbrirModal = false,
  omitirFacturaAutomatica = false,
}: Props) {
  const [fase, setFase] = useState<Fase>(autoIniciar ? "preparando" : "inicio");
  const [mensaje, setMensaje] = useState<string | null>(null);
  const [abriendoFormulario, setAbriendoFormulario] = useState<boolean>(false);
  const identificador = useRef<string | null>(null);
  const resuelto = useRef(false);
  const motivo = useRef<string | null>(null);
  const faseRef = useRef<Fase>(autoIniciar ? "preparando" : "inicio");
  const autoIniciadoRef = useRef(false);
  const autoAbiertoRef = useRef(false);
  const esperaModalTimerRef = useRef<number | null>(null);

  faseRef.current = fase;

  const avisarError = useRef(alErrorPago);
  avisarError.current = alErrorPago;

  const reportarErrorPlux = (
    codigo: string,
    mensajeUsuario: string,
    detalleTecnico: string,
    faseDestino: "error" | "rechazado" = "error"
  ) => {
    limpiarEsperaModal();
    setAbriendoFormulario(false);
    setFase(faseDestino);
    setMensaje(mensajeUsuario);
    avisarError.current?.({ codigo, mensajeUsuario, detalleTecnico });
  };

  const limpiarEsperaModal = () => {
    if (esperaModalTimerRef.current !== null && typeof window !== "undefined") {
      window.clearInterval(esperaModalTimerRef.current);
      esperaModalTimerRef.current = null;
    }
  };

  const iniciarEsperaAperturaFormulario = () => {
    if (typeof window === "undefined") return;
    limpiarEsperaModal();
    setAbriendoFormulario(true);
    let ticks = 0;
    esperaModalTimerRef.current = window.setInterval(() => {
      ticks += 1;
      if (existeModalPluxVisible()) {
        limpiarEsperaModal();
        setAbriendoFormulario(false);
        return;
      }
      if (faseRef.current !== "listo") {
        limpiarEsperaModal();
        setAbriendoFormulario(false);
        return;
      }
      if (ticks >= 36) {
        reportarErrorPlux(
          "PLUX_MODAL_NO_ABRIO",
          "No se pudo abrir la ventana segura de pago con tarjeta (PLUX). Puedes pagar por Transferencia / DeUna o escribirnos por WhatsApp.",
          `La ventana de Paybox PLUX (${ambiente}) no se abrió tras hacer clic en Pagar ahora (posible error CORS o desajuste de ambiente Sandbox/Producción).`,
          "error"
        );
      }
    }, 150);
  };

  const avisar = useRef(alCambiarFase);
  avisar.current = alCambiarFase;
  useEffect(() => {
    avisar.current?.(fase, mensaje, motivo.current);
  }, [fase, mensaje]);

  // Intercepta errores XHR/CORS del script oficial de PLUX (que usa jQuery.ajax)
  // para que nunca quede un fallo silencioso sin aviso al cliente.
  useEffect(() => {
    if (fase !== "listo" || typeof window === "undefined") return;
    const jq = (window as any).jQuery;
    if (!jq) return;

    const manejarAjaxError = (
      _evt: unknown,
      jqXHR: { status?: number; statusText?: string; responseText?: string } | undefined,
      settings: { url?: string } | undefined,
      thrownError: string | undefined
    ) => {
      const url = String(settings?.url || "");
      if (!/pagoplux|paybox|getEstablishmentByEmail/i.test(url)) return;
      if (resuelto.current || faseRef.current !== "listo") return;

      const status = Number(jqXHR?.status ?? 0);
      const urlSinQuery = url.split("?")[0] ?? url;
      const endpointCorto = urlSinQuery.split("/").slice(-2).join("/") || url;
      const detalle =
        status === 0
          ? `CORS/red bloqueada en ${endpointCorto} (ambiente: ${ambiente})`
          : `HTTP ${status} (${thrownError || jqXHR?.statusText || "error"}) en ${endpointCorto} (ambiente: ${ambiente})`;

      reportarErrorPlux(
        status === 0 ? "PLUX_XHR_CORS" : `PLUX_XHR_${status}`,
        "La pasarela de tarjetas PLUX presentó un error de conexión en este momento. Puedes pagar al instante por Transferencia / DeUna o contactarnos por WhatsApp.",
        detalle,
        "error"
      );
    };

    jq(document).on("ajaxError.ecoPlux", manejarAjaxError);
    return () => {
      try {
        jq(document).off("ajaxError.ecoPlux", manejarAjaxError);
      } catch {
        // Ignorar si jQuery ya no está disponible
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, ambiente]);

  // Con #ButtonPaybox ya en el DOM se dispara el `load` que espera PLUX para
  // inyectar su botón. En un efecto y no tras el setState: así es seguro que
  // React ya pintó el contenedor. Si `autoAbrirModal` está activo, se abre
  // automáticamente la ventana segura de PLUX mientras se muestra el spinner.
  useEffect(() => {
    if (fase !== "listo") {
      limpiarEsperaModal();
      setAbriendoFormulario(false);
      return;
    }
    (window as any).jQuery?.(window).trigger("load");

    if (!autoAbrirModal || autoAbiertoRef.current) return;
    setAbriendoFormulario(true);
    let intentos = 0;
    const intervalo = window.setInterval(() => {
      intentos += 1;
      const contenedor = document.getElementById("ButtonPaybox");
      const botonInyectado = contenedor?.querySelector<HTMLElement>(
        'button, input[type="button"], input[type="submit"], a'
      );
      if (botonInyectado) {
        window.clearInterval(intervalo);
        autoAbiertoRef.current = true;
        botonInyectado.click();
        iniciarEsperaAperturaFormulario();
        return;
      }
      if (intentos >= 35) {
        window.clearInterval(intervalo);
        setAbriendoFormulario(false);
      }
    }, 100);

    return () => {
      window.clearInterval(intervalo);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fase, autoAbrirModal]);

  // Si cambian los datos de facturación o modalidad con el botón ya preparado,
  // el pago preparado lleva los viejos: se vuelve a empezar.
  const claveDatos = JSON.stringify([varianteId, proformaId, tokenAprobacion, modalidadCobro, pagador]);
  useEffect(() => {
    autoIniciadoRef.current = false;
    autoAbiertoRef.current = false;
    setFase((f) => (f === "listo" ? "inicio" : f));
  }, [claveDatos]);

  useEffect(() => {
    if (!autoIniciar || autoIniciadoRef.current) return;
    if (fase !== "inicio" && fase !== "preparando") return;
    autoIniciadoRef.current = true;
    void preparar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoIniciar, fase, claveDatos]);

  // Al desmontar se quitan los globales (data lleva los datos del pagador):
  // el siguiente checkout empieza limpio.
  useEffect(
    () => () => {
      resuelto.current = true;
      limpiarEsperaModal();
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
        const msgRechazo =
          r.data.motivo === "MONTO_DISTINTO"
            ? "PLUX informó un monto distinto al del pedido. No se activó nada; el equipo lo revisará."
            : "PLUX no aprobó el pago. No se te cobró; puedes intentarlo de nuevo, pagar por transferencia o escribirnos por WhatsApp.";
        reportarErrorPlux(
          r.data.motivo || "PLUX_RECHAZADO",
          msgRechazo,
          `Webhook PLUX devolvió estado ${r.data.estado} (motivo: ${r.data.motivo || "rechazado"})`,
          "rechazado"
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
    autoAbiertoRef.current = false;
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
      reportarErrorPlux("PLUX_PREPARAR_ERROR", r.error, `Error en prepararPagoPlux: ${r.error}`, "error");
      return;
    }
    identificador.current = r.data.identificador;
    resuelto.current = false;

    const w = window as any;
    // El script de PLUX lee `data` cada vez que se abre el modal.
    w.data = r.data.paybox;
    w.onAuthorize = async (respuesta: unknown) => {
      // Al cerrar el modal llega un "failed" con "Paybox cerrado" aunque el pago haya salido bien.
      if (!respuestaExitosa(respuesta)) {
        if (resuelto.current) return;
        const desc = String(
          (respuesta as { description?: unknown; message?: unknown } | null)?.description ??
            (respuesta as { message?: unknown } | null)?.message ??
            ""
        ).trim();
        if (desc && !/cerrad|closed|cancel/i.test(desc)) {
          reportarErrorPlux(
            "PLUX_AUTORIZACION_FALLIDA",
            `No se pudo completar el pago con tarjeta (${desc}). Puedes pagar por Transferencia / DeUna o contactarnos por WhatsApp.`,
            `onAuthorize PLUX falló: ${desc}`,
            "rechazado"
          );
        }
        return;
      }
      if (!identificador.current || resuelto.current) return;
      const idActual = identificador.current;
      setFase("esperando");

      try {
        const attr = leerAtribucionNavegador(negocio);
        const conf = await confirmarPagoPluxAction({
          negocio,
          identificador: idActual,
          respuestaPaybox: respuesta,
          tokenAprobacion,
          pagador,
          modalidadCobro,
          omitirFacturaAutomatica,
          atribucion: {
            fbc: attr.fbc,
            fbp: attr.fbp,
            eventSourceUrl: typeof window !== "undefined" ? window.location.href : undefined,
          },
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
      const msg = e?.message || "No se pudo cargar la pasarela PLUX.";
      reportarErrorPlux("PLUX_SCRIPT_ERROR", msg, `Error cargando scripts PLUX (${ambiente}): ${msg}`, "error");
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
          {preparando ? "Conectando con PLUX…" : fase === "inicio" ? etiqueta ?? "Pagar con PLUX" : "Reintentar"}
        </button>
      )}

      {fase === "listo" && abriendoFormulario && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "9px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "#F0FDF4",
            border: "1px solid #86EFAC",
            color: "#166534",
            fontSize: "0.85rem",
            fontWeight: 700,
          }}
        >
          <RefreshCw size={17} className="ckt-girar" />
          <span>Abriendo formulario seguro de PLUX…</span>
        </div>
      )}

      {fase === "listo" && !abriendoFormulario && (
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
          Pulsa el botón oficial de PLUX abajo para ingresar tu tarjeta.
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
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            gap: "8px",
          }}
        >
          <RefreshCw size={16} className="ckt-girar" />
          <span>Verificando autorización bancaria con PLUX…</span>
        </p>
      )}

      {/* PLUX inyecta aquí su botón "Pagar ahora" y, al pulsarlo, su modal. */}
      {(fase === "listo" || fase === "esperando" || fase === "sin_confirmar") && (
        <div
          id="ButtonPaybox"
          onClickCapture={() => {
            if (fase === "listo") {
              iniciarEsperaAperturaFormulario();
            }
          }}
        />
      )}

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
