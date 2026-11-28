"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  Building2,
  Calendar,
  Camera,
  Check,
  CheckCircle2,
  ChevronRight,
  ClipboardList,
  Clock,
  CreditCard,
  Download,
  ExternalLink,
  FileText,
  Filter,
  Forward,
  ImagePlus,
  Inbox,
  Link2,
  Loader2,
  Lock,
  MailWarning,
  MessageCircle,
  MessageSquare,
  Mic,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Pencil,
  Play,
  Plus,
  RefreshCw,
  RotateCcw,
  Search,
  Send,
  Settings2,
  Share2,
  Shield,
  ShoppingBag,
  Smartphone,
  Sparkles,
  Star,
  StickyNote,
  Store,
  FlaskConical,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import {
  listarEntregaInmediataAction,
  obtenerInventarioRosasAction,
} from "../acciones-operaciones-taller";
import { sincronizarFotosGoogleContactsAction } from "../acciones-google-contacts";
import {
  formatearFechaCorteInventario,
  formatearResumenInventarioTexto,
  type ArregloEntregaInmediata,
  type CorteInventarioRosas,
} from "../operaciones-taller";
import {
  abrirSeguimientoContactoOmnicanalAction,
  actualizarConversacionOmnicanalAction,
  alternarEtiquetaOmnicanalAction,
  eliminarConversacionOmnicanalAction,
  eliminarRespuestaRapidaOmnicanalAction,
  enviarMensajeAsesorOmnicanalAction,
  guardarRespuestaRapidaOmnicanalAction,
  marcarChatPrivacidadOmnicanalAction,
  obtenerMensajesConversacionAction,
  obtenerTableroOmnicanalAction,
  sincronizarHistorialAriaOmnicanalAction,
  transcribirYResponderNotaVozOmnicanalAction,
  type DatosTableroOmnicanal,
  type PedidoWebConTipoCliente,
} from "../acciones-omnicanal";
import { obtenerConfiguracionTiendaCheckoutAction } from "../acciones-tienda-checkout";
import {
  construirMensajeConfianzaChat,
  construirMensajeDatosPagoChat,
  crearConfiguracionTiendaCheckoutPorDefecto,
  detectarSolicitudPagoTarjetaEnMensaje,
  parsearComandoChatPago,
  type ConfiguracionTiendaCheckout,
} from "../configuracion-tienda-checkout";
import {
  agruparConversacionesPorClienteOmnicanal,
  autoCompletarDatosVentaDesdeMensajes,
  calcularFechaRecordatorioRapido,
  calcularMetricasOmnicanal,
  calcularTotalDatosVenta,
  emparejarComprasConConversacion,
  extraerSegmentosMultimediaMensaje,
  extraerTodasLasImagenesMensaje,
  formatearEtiquetaEnlaceVisible,
  generarCodigoRefWhatsapp,
  interpolarRespuestaRapida,
  limpiarVistaPreviaMensajeOmnicanal,
  MOTIVOS_CIERRE_OMNICANAL,
  nombreCanalRealtimeOmnicanal,
  nombreCanalRealtimeOmnicanalPrivado,
  normalizarTelefonoOmnicanal,
  OPCIONES_RECORDATORIO_RAPIDO_OMNICANAL,
  resolverConversacionPorContextoReenvio,
  type CanalOmnicanal,
  type ClaveRecordatorioRapido,
  type CodigoMotivoCierreOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ContextoReenvioChatEquipo,
  type ConversacionOmnicanal,
  type ConversacionWhatsappResumen,
  type DatosVentaConversacion,
  type EstadoAtencionOmnicanal,
  type EtiquetaOmnicanal,
  type EventoBroadcastChatWeb,
  type EventoBroadcastIntervencionAsesor,
  type MensajeOmnicanal,
  type RespuestaRapidaOmnicanal,
} from "../omnicanal";
import { ChatEquipoInterno } from "./ChatEquipoInterno";
import {
  AvatarConCanalOmnicanal,
  CANALES_OMNICANAL_DISPONIBLES,
  IconoVectorCanal,
  nombreLegibleCanal,
} from "./IconoCanalOmnicanal";
import { ModalAdministrarEtiquetas } from "./ModalAdministrarEtiquetas";
import { ModalFichaClienteOmnicanal } from "./ModalFichaClienteOmnicanal";
import { ModalLinkPagoChat } from "./ModalLinkPagoChat";
import {
  ModalSelectorCatalogoChat,
  type SeleccionProductoCatalogoChat,
} from "./ModalSelectorCatalogoChat";
import { PanelCamposVentaChat } from "./PanelCamposVentaChat";
import { SimuladorChatAriaPanel } from "./SimuladorChatAriaPanel";
import {
  construirUrlProxyMediaOmnicanal,
  descargarImagenChatOmnicanal,
  ModalReenviarMensajeChat,
  ModalVisorImagenChat,
  type DatosImagenAmpliadaChat,
  type DatosReenvioMensajeModal,
} from "./VisorMultimediaChatModal";

export interface PropsConsolaVentasOmnicanal {
  negocio: string;
  datosIniciales?: DatosTableroOmnicanal;
  errorInicial?: string | null;
}

type PestanaPrincipal =
  | "inbox"
  | "chat_equipo"
  | "simulador_ia"
  | "compras"
  | "usuarios"
  | "ia_config";
type FiltroBandejaIzquierda =
  | "todos"
  | "no_asignado"
  | "mios"
  | "escalados"
  | "ia_activa"
  | "recordatorios"
  | "privados"
  | "cerrados";

function formatearTiempoCorto(iso?: string | null): string {
  if (!iso) return "";
  const fecha = new Date(iso);
  if (Number.isNaN(fecha.getTime())) return "";
  const diffMin = Math.max(0, Math.floor((Date.now() - fecha.getTime()) / 60000));
  if (diffMin < 1) return "Ahora";
  if (diffMin < 60) return `${diffMin}m`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias < 7) return `${diffDias}d`;
  return fecha.toLocaleDateString("es-EC", { day: "2-digit", month: "short" });
}

function formatearNombreVisibleChat(
  nombre?: string | null,
  telefono?: string | null
): string {
  const n = String(nombre || "").trim();
  if (/^whatsapp\s*\+?\d+/i.test(n)) {
    return n.replace(/^whatsapp\s+/i, "").trim();
  }
  if (n) return n;
  return String(telefono || "Cliente").trim();
}

function resolverLineaWhatsappConversacion(
  conv: ConversacionOmnicanal,
  lineas?: DatosTableroOmnicanal["lineasWhatsapp"]
): {
  nombre: string;
  numero: string;
  ultimos4: string;
  color: string;
} | null {
  if (conv.canal !== "whatsapp") return null;
  const lista = Array.isArray(lineas) ? lineas : [];
  const encontrada =
    (conv.lineaWhatsappId
      ? lista.find((l) => l.id === conv.lineaWhatsappId)
      : null) ??
    lista.find((l) => l.esPrincipal) ??
    (lista.length === 1 ? lista[0] : null);

  const nombre = String(conv.lineaWhatsappNombre || encontrada?.nombre || "").trim();
  const numero = String(conv.lineaWhatsappNumero || encontrada?.numeroE164 || "").trim();
  if (!nombre && !numero) return null;

  const digitos = numero.replace(/\D+/g, "");
  const ultimos4 = digitos.length >= 4 ? digitos.slice(-4) : digitos;
  const color = String(conv.lineaWhatsappColor || encontrada?.colorBadge || "#16A34A").trim();

  return {
    nombre: nombre || "WhatsApp",
    numero,
    ultimos4,
    color,
  };
}

function renderTextoConEnlaces(texto: string, esFondoOscuro: boolean): React.ReactNode {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return partes.map((parte, idx) => {
    if (/^https?:\/\//i.test(parte)) {
      const info = formatearEtiquetaEnlaceVisible(parte, 48);
      return (
        <React.Fragment key={idx}>
          <a
            href={info.href}
            target="_blank"
            rel="noreferrer"
            title={info.href}
            style={{
              color: esFondoOscuro ? "#E6E2DA" : "var(--ct-221e1b, #221E1B)",
              textDecoration: "underline",
              textUnderlineOffset: "2px",
              wordBreak: "break-word",
              fontWeight: 600,
            }}
          >
            {info.etiqueta}
          </a>
          {info.sufijo}
        </React.Fragment>
      );
    }
    return <React.Fragment key={idx}>{parte}</React.Fragment>;
  });
}

function TarjetaImagenBurbujaOmnicanal({
  url,
  alt,
  esFondoOscuro,
  onAmpliar,
  onReenviar,
}: {
  url: string;
  alt?: string;
  esFondoOscuro: boolean;
  onAmpliar: () => void;
  onReenviar: () => void;
}) {
  const [usarProxy, setUsarProxy] = useState(false);
  const [falloCarga, setFalloCarga] = useState(false);

  useEffect(() => {
    setUsarProxy(false);
    setFalloCarga(false);
  }, [url]);

  const srcEfectivo = usarProxy ? construirUrlProxyMediaOmnicanal(url, false) : url;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "6px",
        maxWidth: "min(245px, 100%)",
      }}
    >
      {falloCarga ? (
        <div
          style={{
            padding: "10px 12px",
            borderRadius: "10px",
            border: esFondoOscuro
              ? "1px dashed var(--cb-ffffff-a350, rgba(255,255,255,0.35))"
              : "1px dashed var(--cb-d5cfc4, #D5CFC4)",
            background: esFondoOscuro ? "rgba(255,255,255,0.1)" : "var(--cf-f8f7f4, #F8F7F4)",
            color: esFondoOscuro ? "#E6E2DA" : "var(--ct-6e6861, #6E6861)",
            fontSize: "0.75rem",
            lineHeight: 1.4,
          }}
        >
          {alt || "Imagen adjunta en chat"} (enlace temporal expirado)
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onClick={onAmpliar}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onAmpliar();
          }}
          title={alt ? `Ampliar imagen: ${alt}` : "Toca para ampliar imagen"}
          aria-label="Ampliar imagen"
          style={{
            cursor: "zoom-in",
            borderRadius: "10px",
            overflow: "hidden",
            border: esFondoOscuro
              ? "1px solid var(--cb-ffffff-a240, rgba(255,255,255,0.24))"
              : "1px solid var(--cb-e6e2da, #E6E2DA)",
            background: "var(--cf-ffffff, #FFFFFF)",
          }}
        >
          <img
            src={srcEfectivo}
            alt={alt || "Fotografía en chat"}
            loading="lazy"
            onError={() => {
              if (!usarProxy) {
                setUsarProxy(true);
              } else {
                setFalloCarga(true);
              }
            }}
            style={{
              display: "block",
              width: "100%",
              maxHeight: "265px",
              objectFit: "cover",
            }}
          />
        </div>
      )}

      {alt && !falloCarga && (
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: esFondoOscuro ? "#E6E2DA" : "var(--ct-6e6861, #6E6861)",
          }}
        >
          {alt}
        </span>
      )}

      {/* Acciones directas sobrias: Ampliar, Descargar, Reenviar */}
      {!falloCarga && (
        <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-responsive-accion"
            onClick={onAmpliar}
            title="Ampliar fotografía en pantalla completa"
            aria-label="Ampliar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "30px",
              minWidth: "32px",
              padding: "4px 9px",
              borderRadius: "7px",
              border: esFondoOscuro ? "1px solid var(--cb-ffffff-a250, rgba(255,255,255,0.25))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: esFondoOscuro ? "rgba(255,255,255,0.12)" : "var(--cf-ffffff, #FFFFFF)",
              color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
              fontSize: "0.71rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <ZoomIn size={13} />
            <span className="btn-texto-responsive">Ampliar</span>
          </button>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => void descargarImagenChatOmnicanal(url, alt || "imagen-chat")}
            title="Descargar fotografía"
            aria-label="Descargar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "30px",
              minWidth: "32px",
              padding: "4px 9px",
              borderRadius: "7px",
              border: esFondoOscuro ? "1px solid var(--cb-ffffff-a250, rgba(255,255,255,0.25))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: esFondoOscuro ? "rgba(255,255,255,0.12)" : "var(--cf-ffffff, #FFFFFF)",
              color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
              fontSize: "0.71rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Download size={13} />
            <span className="btn-texto-responsive">Descargar</span>
          </button>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={onReenviar}
            title="Reenviar fotografía por WhatsApp o al Chat Grupal del Equipo"
            aria-label="Reenviar"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "4px",
              minHeight: "30px",
              minWidth: "32px",
              padding: "4px 9px",
              borderRadius: "7px",
              border: esFondoOscuro ? "1px solid var(--cb-ffffff-a250, rgba(255,255,255,0.25))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: esFondoOscuro ? "rgba(255,255,255,0.12)" : "var(--cf-ffffff, #FFFFFF)",
              color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
              fontSize: "0.71rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <Forward size={13} />
            <span className="btn-texto-responsive">Reenviar</span>
          </button>
        </div>
      )}
    </div>
  );
}

function TarjetaAudioBurbujaOmnicanal({
  url,
  mimeType,
  yaTranscrito,
  procesando,
  esFondoOscuro,
  onTranscribir,
  onResponderAria,
}: {
  url: string | null;
  mimeType?: string;
  yaTranscrito?: boolean;
  procesando?: boolean;
  esFondoOscuro: boolean;
  onTranscribir?: () => void;
  onResponderAria?: () => void;
}) {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [usarProxy, setUsarProxy] = useState(false);
  const [falloAudio, setFalloAudio] = useState(false);
  const [velocidad, setVelocidad] = useState<1 | 1.5 | 2>(1);

  useEffect(() => {
    setUsarProxy(false);
    setFalloAudio(false);
    setVelocidad(1);
  }, [url]);

  const srcEfectivo = url
    ? usarProxy
      ? construirUrlProxyMediaOmnicanal(url, false)
      : url
    : null;

  const alternarVelocidad = () => {
    const siguiente: 1 | 1.5 | 2 = velocidad === 1 ? 1.5 : velocidad === 1.5 ? 2 : 1;
    setVelocidad(siguiente);
    if (audioRef.current) {
      audioRef.current.playbackRate = siguiente;
    }
  };

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        padding: "9px 11px",
        borderRadius: "10px",
        background: esFondoOscuro ? "rgba(255,255,255,0.12)" : "var(--cf-f8f7f4, #F8F7F4)",
        border: esFondoOscuro ? "1px solid var(--cb-ffffff-a240, rgba(255,255,255,0.24))" : "1px solid var(--cb-e6e2da, #E6E2DA)",
        minWidth: "min(255px, 100%)",
        maxWidth: "330px",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            fontSize: "0.75rem",
            fontWeight: 700,
            color: esFondoOscuro ? "#FFFFFF" : "var(--ct-221e1b, #221E1B)",
          }}
        >
          <Mic size={14} color={esFondoOscuro ? "#E6E2DA" : "#57524C"} />
          <span>Nota de voz</span>
        </span>

        {srcEfectivo && !falloAudio && (
          <button
            type="button"
            onClick={alternarVelocidad}
            title="Cambiar velocidad de reproducción (1x / 1.5x / 2x)"
            aria-label={`Velocidad ${velocidad}x`}
            style={{
              padding: "2px 8px",
              borderRadius: "999px",
              border: esFondoOscuro ? "1px solid var(--cb-ffffff-a300, rgba(255,255,255,0.3))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: esFondoOscuro ? "rgba(255,255,255,0.16)" : "var(--cf-ffffff, #FFFFFF)",
              color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
              fontSize: "0.69rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {velocidad}x
          </button>
        )}
      </div>

      {srcEfectivo && !falloAudio ? (
        <audio
          ref={audioRef}
          controls
          preload="metadata"
          src={srcEfectivo}
          onPlay={() => {
            if (audioRef.current) {
              audioRef.current.playbackRate = velocidad;
            }
          }}
          onError={() => {
            if (!usarProxy) {
              setUsarProxy(true);
            } else {
              setFalloAudio(true);
            }
          }}
          style={{
            width: "100%",
            height: "36px",
            borderRadius: "8px",
          }}
        >
          {mimeType && <source src={srcEfectivo} type={mimeType} />}
        </audio>
      ) : (
        <div
          style={{
            fontSize: "0.74rem",
            color: esFondoOscuro ? "#E6E2DA" : "var(--ct-6e6861, #6E6861)",
            lineHeight: 1.38,
          }}
        >
          {url
            ? "El enlace temporal del audio expiró en WhatsApp."
            : "Nota de voz recibida antes de activar la captura de audio. Las nuevas notas incluirán reproductor y transcripción automática."}
        </div>
      )}

      {url && !falloAudio && (onTranscribir || onResponderAria) && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
          {onTranscribir && (
            <button
              type="button"
              disabled={procesando}
              onClick={onTranscribir}
              title="Escuchar nota de voz con IA y guardar transcripción como Nota Interna"
              aria-label="Transcribir nota de voz"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                minHeight: "30px",
                padding: "4px 9px",
                borderRadius: "7px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-ffffff, #FFFFFF)",
                color: "var(--ct-3a3530, #3A3530)",
                fontSize: "0.71rem",
                fontWeight: 600,
                cursor: procesando ? "wait" : "pointer",
              }}
            >
              {procesando ? <Loader2 size={12} /> : <StickyNote size={12} />}
              <span>{yaTranscrito ? "Ver nota" : "Transcribir"}</span>
            </button>
          )}

          {onResponderAria && (
            <button
              type="button"
              disabled={procesando}
              onClick={onResponderAria}
              title="Transcribir nota de voz como Nota Interna y responder al cliente usando ARIA"
              aria-label="Responder con ARIA"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                minHeight: "30px",
                padding: "4px 9px",
                borderRadius: "7px",
                border: "1px solid #2F4737",
                background: "#2F4737",
                color: "#FFFFFF",
                fontSize: "0.71rem",
                fontWeight: 600,
                cursor: procesando ? "wait" : "pointer",
              }}
            >
              {procesando ? <Loader2 size={12} /> : <Bot size={12} />}
              <span>Responder IA</span>
            </button>
          )}
        </div>
      )}
    </div>
  );
}

function TarjetaDocumentoBurbujaOmnicanal({
  url,
  nombre,
  esFondoOscuro,
}: {
  url: string;
  nombre: string;
  esFondoOscuro: boolean;
}) {
  const urlDescarga = construirUrlProxyMediaOmnicanal(url, true);
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        padding: "9px 11px",
        borderRadius: "10px",
        background: esFondoOscuro ? "rgba(255,255,255,0.12)" : "var(--cf-f8f7f4, #F8F7F4)",
        border: esFondoOscuro ? "1px solid var(--cb-ffffff-a240, rgba(255,255,255,0.24))" : "1px solid var(--cb-e6e2da, #E6E2DA)",
        maxWidth: "320px",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
        <div
          style={{
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: esFondoOscuro ? "rgba(255,255,255,0.18)" : "var(--cf-f4f2ee, #F4F2EE)",
            color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
            border: esFondoOscuro ? "none" : "1px solid var(--cb-e6e2da, #E6E2DA)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
          }}
        >
          <FileText size={16} />
        </div>
        <span
          title={nombre}
          style={{
            fontSize: "0.77rem",
            fontWeight: 600,
            color: esFondoOscuro ? "#FFFFFF" : "var(--ct-221e1b, #221E1B)",
            overflow: "hidden",
            textOverflow: "ellipsis",
            whiteSpace: "nowrap",
          }}
        >
          {nombre}
        </span>
      </div>

      <div style={{ display: "inline-flex", gap: "5px", flexShrink: 0 }}>
        <a
          href={url}
          target="_blank"
          rel="noreferrer"
          title="Abrir documento en nueva pestaña"
          aria-label="Abrir documento"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            border: esFondoOscuro ? "1px solid var(--cb-ffffff-a280, rgba(255,255,255,0.28))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
            background: esFondoOscuro ? "rgba(255,255,255,0.14)" : "var(--cf-ffffff, #FFFFFF)",
            color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
            textDecoration: "none",
          }}
        >
          <ExternalLink size={14} />
        </a>
        <a
          href={urlDescarga}
          download={nombre}
          title="Descargar documento"
          aria-label="Descargar documento"
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "30px",
            height: "30px",
            borderRadius: "7px",
            border: esFondoOscuro ? "1px solid var(--cb-ffffff-a280, rgba(255,255,255,0.28))" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
            background: esFondoOscuro ? "rgba(255,255,255,0.14)" : "var(--cf-ffffff, #FFFFFF)",
            color: esFondoOscuro ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
            textDecoration: "none",
          }}
        >
          <Download size={14} />
        </a>
      </div>
    </div>
  );
}

function renderContenidoMensajeOmnicanal(
  mensaje: MensajeOmnicanal,
  esFondoOscuro: boolean,
  acciones?: {
    onAmpliarImagen?: (url: string, alt?: string) => void;
    onReenviarImagen?: (url: string, alt?: string) => void;
    onTranscribirAudio?: (url: string, mime?: string) => void;
    onResponderAudioConAria?: (url: string, mime?: string) => void;
    procesandoAudio?: boolean;
  }
): React.ReactNode {
  if (/^mensaje\s*\(\s*unsupported\s*\)$/i.test((mensaje.contenido || "").trim())) {
    return (
      <div
        style={{
          padding: "8px 10px",
          borderRadius: "8px",
          border: "1px solid var(--cb-fde68a, #FDE68A)",
          background: "var(--cf-fffbeb, #FFFBEB)",
          color: "var(--ct-92400e, #92400E)",
          display: "flex",
          flexDirection: "column",
          gap: "3px",
          fontSize: "0.77rem",
          lineHeight: 1.4,
        }}
      >
        <strong style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
          <AlertTriangle size={13} style={{ flexShrink: 0 }} />
          <span>Aviso no compatible con la API de WhatsApp</span>
        </strong>
        <span style={{ fontSize: "0.73rem", color: "var(--ct-78350f, #78350F)" }}>
          Meta no entrega a la web el contenido de alertas automáticas de otras empresas (ej. Facebook, bancos o códigos OTP), encuestas ni mensajes editados. Puedes verlo completo en tu celular.
        </span>
      </div>
    );
  }

  const segmentos = extraerSegmentosMultimediaMensaje(
    mensaje.contenido || "",
    mensaje.detalle
  );
  const tieneSegmentoAudio = segmentos.some((s) => s.tipo === "audio");
  const esMensajeVozSinUrl =
    !tieneSegmentoAudio &&
    (mensaje.tipoContenido === "AUDIO" ||
      /🎤\s*Nota de voz recibida/i.test(mensaje.contenido || ""));
  const yaTranscrito = Boolean(
    mensaje.detalle &&
      typeof mensaje.detalle === "object" &&
      ((mensaje.detalle as Record<string, unknown>).transcripcion ||
        (mensaje.detalle as Record<string, unknown>).nota_transcripcion_id)
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {esMensajeVozSinUrl && (
        <TarjetaAudioBurbujaOmnicanal
          url={null}
          esFondoOscuro={esFondoOscuro}
        />
      )}

      {segmentos.map((seg, idx) => {
        if (seg.tipo === "audio") {
          return (
            <TarjetaAudioBurbujaOmnicanal
              key={`aud-${idx}`}
              url={seg.url}
              mimeType={seg.mime ?? undefined}
              yaTranscrito={yaTranscrito}
              procesando={acciones?.procesandoAudio}
              esFondoOscuro={esFondoOscuro}
              onTranscribir={
                acciones?.onTranscribirAudio
                  ? () => acciones.onTranscribirAudio!(seg.url, seg.mime ?? undefined)
                  : undefined
              }
              onResponderAria={
                acciones?.onResponderAudioConAria
                  ? () => acciones.onResponderAudioConAria!(seg.url, seg.mime ?? undefined)
                  : undefined
              }
            />
          );
        }
        if (seg.tipo === "documento") {
          return (
            <TarjetaDocumentoBurbujaOmnicanal
              key={`doc-${idx}`}
              url={seg.url}
              nombre={seg.nombre}
              esFondoOscuro={esFondoOscuro}
            />
          );
        }
        if (seg.tipo === "imagen") {
          return (
            <TarjetaImagenBurbujaOmnicanal
              key={`img-${idx}`}
              url={seg.url}
              alt={seg.alt}
              esFondoOscuro={esFondoOscuro}
              onAmpliar={() => acciones?.onAmpliarImagen?.(seg.url, seg.alt)}
              onReenviar={() => acciones?.onReenviarImagen?.(seg.url, seg.alt)}
            />
          );
        }
        if (esMensajeVozSinUrl && /^🎤\s*Nota de voz recibida por WhatsApp$/i.test(seg.texto.trim())) {
          return null;
        }
        return (
          <div key={`txt-${idx}`} style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}>
            {renderTextoConEnlaces(seg.texto, esFondoOscuro)}
          </div>
        );
      })}
    </div>
  );
}

function badgeEstadoAtencion(estado: EstadoAtencionOmnicanal): {
  etiqueta: string;
  fondo: string;
  texto: string;
  borde: string;
} {
  switch (estado) {
    case "ESCALADO_HUMANO":
      return {
        etiqueta: "Requiere humano",
        fondo: "var(--cf-faf2f2, #FAF2F2)",
        texto: "var(--ct-8a2e2e, #8A2E2E)",
        borde: "var(--cb-e5caca, #E5CACA)",
      };
    case "EN_ATENCION_ASESORA":
      return {
        etiqueta: "Atención humana",
        fondo: "var(--cf-f4f2ee, #F4F2EE)",
        texto: "var(--ct-3a3530, #3A3530)",
        borde: "var(--cb-e6e2da, #E6E2DA)",
      };
    case "EN_ESPERA_CLIENTE":
      return {
        etiqueta: "Espera cliente",
        fondo: "var(--cf-f4f2ee, #F4F2EE)",
        texto: "var(--ct-6e6861, #6E6861)",
        borde: "var(--cb-e6e2da, #E6E2DA)",
      };
    case "CERRADO":
      return {
        etiqueta: "Cerrado",
        fondo: "var(--cf-f4f2ee, #F4F2EE)",
        texto: "var(--ct-847d74, #847D74)",
        borde: "var(--cb-e6e2da, #E6E2DA)",
      };
    default:
      return {
        etiqueta: "IA activa",
        fondo: "var(--cf-f2f5f3, #F2F5F3)",
        texto: "var(--ct-2f4737, #2F4737)",
        borde: "var(--cb-dce4df, #DCE4DF)",
      };
  }
}

export function ConsolaVentasOmnicanal({
  negocio,
  datosIniciales,
  errorInicial,
}: PropsConsolaVentasOmnicanal) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_omnicanal_tablero_${negNorm}`;

  const [pestana, setPestana] = useState<PestanaPrincipal>("inbox");
  const [tablero, setTablero] = useState<DatosTableroOmnicanal>(
    datosIniciales ?? {
      usuarioActualId: null,
      usuarioActualNombre: "Tú",
      conversaciones: [],
      etiquetas: [],
      respuestasRapidas: [],
      equipo: [],
      usuariosYClientes: [],
      pedidosWeb: [],
    }
  );
  const [cargando, setCargando] = useState<boolean>(!datosIniciales);
  const [importandoHistorialAria, setImportandoHistorialAria] = useState<boolean>(false);
  const [mensajeInfo, setMensajeInfo] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(errorInicial ?? null);

  // Estado de la Bandeja estilo ManyChat (WhatsApp YCloud, Web, Facebook, Instagram, Telegram, TikTok)
  const [filtroIzquierdo, setFiltroIzquierdo] = useState<FiltroBandejaIzquierda>("todos");
  const [canalFiltro, setCanalFiltro] = useState<"todos" | CanalOmnicanal>("todos");
  const [etiquetaFiltroId, setEtiquetaFiltroId] = useState<string | null>(null);
  const [vendedorFiltroId, setVendedorFiltroId] = useState<string | null>(null);
  const [soloNoLeidos, setSoloNoLeidos] = useState<boolean>(false);
  const [estadoAperturaFiltro, setEstadoAperturaFiltro] = useState<"abiertos" | "cerrados" | "todos">(
    "abiertos"
  );
  const [busquedaInbox, setBusquedaInbox] = useState<string>("");
  const [modalEtiquetasAbierto, setModalEtiquetasAbierto] = useState<boolean>(false);

  const [conversacionActivaId, setConversacionActivaId] = useState<string | null>(
    datosIniciales?.conversaciones[0]?.id ?? null
  );
  const [mensajesActivos, setMensajesActivos] = useState<MensajeOmnicanal[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState<boolean>(false);

  // Compositor de respuesta humana / nota interna / menú Opciones unificado
  const [textoRespuesta, setTextoRespuesta] = useState<string>("");
  const [modoNotaInterna, setModoNotaInterna] = useState<boolean>(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState<boolean>(false);
  const [mostrarMenuRespuestas, setMostrarMenuRespuestas] = useState<boolean>(false);
  const [mostrarMenuAdjuntar, setMostrarMenuAdjuntar] = useState<boolean>(false);
  const [vistaMenuOpciones, setVistaMenuOpciones] = useState<"principal" | "asignar">("principal");
  const [modalCatalogoChatAbierto, setModalCatalogoChatAbierto] = useState<boolean>(false);
  const [modalLinkPagoAbierto, setModalLinkPagoAbierto] = useState<boolean>(false);
  const [montoLinkPagoOverride, setMontoLinkPagoOverride] = useState<number | null>(null);
  const [configCheckoutTienda, setConfigCheckoutTienda] =
    useState<ConfiguracionTiendaCheckout | null>(null);
  const [cargandoDatosPago, setCargandoDatosPago] = useState<boolean>(false);
  const [qrDeunaSugeridoUrl, setQrDeunaSugeridoUrl] = useState<string | null>(null);
  const [solicitudTarjetaDescartadaMsgId, setSolicitudTarjetaDescartadaMsgId] = useState<
    string | null
  >(null);
  const [respuestaSeleccionadaId, setRespuestaSeleccionadaId] = useState<string | null>(null);
  const [imagenAdjuntaAsesorUrl, setImagenAdjuntaAsesorUrl] = useState<string | null>(null);
  const [documentoAdjuntoAsesor, setDocumentoAdjuntoAsesor] = useState<{
    url: string;
    nombre: string;
  } | null>(null);
  const [subiendoImagenAsesor, setSubiendoImagenAsesor] = useState<boolean>(false);
  const [procesandoAudioMsgId, setProcesandoAudioMsgId] = useState<string | null>(null);
  const inputFotoAsesorRef = useRef<HTMLInputElement>(null);
  const inputCamaraAsesorRef = useRef<HTMLInputElement>(null);
  const inputDocumentoAsesorRef = useRef<HTMLInputElement>(null);
  const textareaCompositorRef = useRef<HTMLTextAreaElement>(null);

  // Pull-to-refresh táctil en móvil (deslizar hacia abajo en lista o conversación)
  const [pullOffsetPx, setPullOffsetPx] = useState<number>(0);
  const [refrescandoPull, setRefrescandoPull] = useState<boolean>(false);
  const touchPullInicioYRef = useRef<number | null>(null);
  const scrollListaRef = useRef<HTMLDivElement>(null);

  // Visor lightbox de imagen ampliada y modal de reenvío (a WhatsApp o Chat Grupal del Equipo)
  const [visorImagenDatos, setVisorImagenDatos] = useState<DatosImagenAmpliadaChat | null>(null);
  const [reenvioModalDatos, setReenvioModalDatos] = useState<{
    destino: "equipo" | "whatsapp";
    payload: DatosReenvioMensajeModal;
  } | null>(null);

  // Popovers flotantes estilo ManyChat en cabecera (Etiquetas, Recuérdamelo en, Motivo de cierre, Privacidad Personal)
  const [menuCabeceraAbierto, setMenuCabeceraAbierto] = useState<
    "etiquetas" | "recordatorio" | "cierre" | "privacidad" | null
  >(null);
  const usuarioActualIdRef = useRef<string | null>(tablero.usuarioActualId ?? null);
  usuarioActualIdRef.current = tablero.usuarioActualId ?? null;
  const [mostrarSelectorFechaCustom, setMostrarSelectorFechaCustom] = useState<boolean>(false);
  const [recordatorioFecha, setRecordatorioFecha] = useState<string>("");
  const [recordatorioNota, setRecordatorioNota] = useState<string>("");
  const [notaCierreInput, setNotaCierreInput] = useState<string>("");
  const [ahoraMsTick, setAhoraMsTick] = useState<number>(() => Date.now());

  // Retorno desde Chat Grupal del Equipo hacia una conversación/mensaje compartido
  const [mensajeResaltadoId, setMensajeResaltadoId] = useState<string | null>(null);
  const [citaResaltadaTexto, setCitaResaltadaTexto] = useState<string | null>(null);
  const deepLinkProcesadoRef = useRef<boolean>(false);

  // Eliminación completa de conversación (exclusivo Administrador)
  const [conversacionAEliminar, setConversacionAEliminar] =
    useState<ConversacionOmnicanal | null>(null);
  const [eliminandoConversacion, setEliminandoConversacion] = useState<boolean>(false);
  const [actualizandoPrivacidad, setActualizandoPrivacidad] = useState<boolean>(false);
  const [sincronizandoFotosGoogle, setSincronizandoFotosGoogle] = useState<boolean>(false);
  const [lineaWhatsappFiltroId, setLineaWhatsappFiltroId] = useState<string>("");
  const esAdminAplicacion = Boolean(tablero.esAdminAplicacion);
  const [modalFichaClienteContexto, setModalFichaClienteContexto] = useState<{
    conversacion?: ConversacionOmnicanal | null;
    contactoDirectorio?: ContactoUnificadoOmnicanal | null;
  } | null>(null);

  const [formRespuesta, setFormRespuesta] = useState<{
    id?: string | null;
    atajo: string;
    titulo: string;
    categoria: string;
    contenido: string;
  }>({ atajo: "", titulo: "", categoria: "Ventas", contenido: "" });
  const [guardandoRespuesta, setGuardandoRespuesta] = useState<boolean>(false);

  // Filtros en pestañas Compras Web y Usuarios Web
  const [filtroTipoComprador, setFiltroTipoComprador] = useState<
    "todos" | "registrados" | "invitados" | "eventos"
  >("todos");
  const [filtroTipoUsuarioDir, setFiltroTipoUsuarioDir] = useState<
    "todos" | "registrados" | "invitados"
  >("todos");

  // Adaptación responsive y paneles laterales plegables (móvil / tablet / desktop)
  const [modoLayoutInbox, setModoLayoutInbox] = useState<"desktop" | "tablet" | "movil">("desktop");
  const [vistaMovilInbox, setVistaMovilInbox] = useState<"lista" | "chat" | "ficha">("lista");
  const [mostrarFiltrosInbox, setMostrarFiltrosInbox] = useState<boolean>(false);
  const [mostrarFichaTablet, setMostrarFichaTablet] = useState<boolean>(false);
  const [fichaDerechaDesktop, setFichaDerechaDesktop] = useState<boolean>(true);

  useEffect(() => {
    const actualizarModo = () => {
      const ancho = window.innerWidth;
      if (ancho <= 820) {
        setModoLayoutInbox("movil");
      } else if (ancho <= 1220) {
        setModoLayoutInbox("tablet");
      } else {
        setModoLayoutInbox("desktop");
      }
    };
    actualizarModo();
    window.addEventListener("resize", actualizarModo);
    return () => window.removeEventListener("resize", actualizarModo);
  }, []);

  const scrollMensajesRef = useRef<HTMLDivElement>(null);
  const canalLiveRef = useRef<any>(null);
  const liveConectadoRef = useRef<boolean>(false);
  const [realtimeConectado, setRealtimeConectado] = useState<boolean>(false);
  const [disponiblesHoy, setDisponiblesHoy] = useState<ArregloEntregaInmediata[]>([]);
  const [ultimoInvRosas, setUltimoInvRosas] = useState<CorteInventarioRosas | null>(null);

  useEffect(() => {
    let cancelado = false;
    Promise.all([
      listarEntregaInmediataAction(negNorm, false).catch(() => null),
      obtenerInventarioRosasAction(negNorm).catch(() => null),
    ]).then(([resInm, resInv]) => {
      if (cancelado) return;
      if (resInm && resInm.ok) setDisponiblesHoy(resInm.items);
      if (resInv && resInv.ok) setUltimoInvRosas(resInv.ultimoCorte);
    });
    return () => {
      cancelado = true;
    };
  }, [negNorm]);
  const huellasBroadcastVistasRef = useRef<Map<string, number>>(new Map());
  const conversacionActivaIdRef = useRef<string | null>(conversacionActivaId);
  const mensajesBufferLiveRef = useRef<Record<string, MensajeOmnicanal[]>>({});

  useEffect(() => {
    conversacionActivaIdRef.current = conversacionActivaId;
  }, [conversacionActivaId]);

  const emitirBroadcastAsesor = useCallback((payload: EventoBroadcastIntervencionAsesor) => {
    try {
      const canal = canalLiveRef.current;
      if (!canal) return;
      void canal.send({
        type: "broadcast",
        event: "intervencion_asesor",
        payload,
      });
    } catch {
      // Silencioso
    }
  }, []);

  const recargarTablero = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      const res = await obtenerTableroOmnicanalAction(negNorm);
      if (!res.ok) {
        if (!silencioso) setErrorMsg(res.error);
        setCargando(false);
        return;
      }
      setErrorMsg(null);
      setTablero((prev) => {
        const clavesServidor = new Set(res.datos.conversaciones.map((c) => c.claveHilo));
        const pendientesTiempoReal = prev.conversaciones.filter(
          (c) => c.id.startsWith("rt-") && !clavesServidor.has(c.claveHilo)
        );
        const fusionadas = [...pendientesTiempoReal, ...res.datos.conversaciones];
        return {
          ...res.datos,
          conversaciones: fusionadas,
        };
      });
      setConversacionActivaId((prev) => {
        if (prev && prev.startsWith("rt-")) {
          const hilo = prev.slice(3);
          const encontrada = res.datos.conversaciones.find((c) => c.claveHilo === hilo);
          if (encontrada) return encontrada.id;
          return prev;
        }
        return prev ?? res.datos.conversaciones[0]?.id ?? null;
      });
      try {
        localStorage.setItem(cacheKey, JSON.stringify(res.datos));
      } catch {
        // Ignorar límite de almacenamiento del navegador
      }
      setCargando(false);
    },
    [negNorm, cacheKey]
  );

  // Hidratación híbrida desde localStorage + Supabase
  useEffect(() => {
    if (!datosIniciales) {
      try {
        const cache = localStorage.getItem(cacheKey);
        if (cache) {
          const parsed = JSON.parse(cache) as DatosTableroOmnicanal;
          if (parsed && Array.isArray(parsed.conversaciones)) {
            setTablero(parsed);
            setConversacionActivaId((prev) => prev ?? parsed.conversaciones[0]?.id ?? null);
          }
        }
      } catch {
        // Ignorar caché corrupto
      }
      void recargarTablero(false);
    } else {
      try {
        localStorage.setItem(cacheKey, JSON.stringify(datosIniciales));
      } catch {
        // Ignorar cuota
      }
    }
  }, [datosIniciales, cacheKey, recargarTablero]);

  const cargarMensajesConversacion = useCallback(
    async (convId: string, silencioso = false) => {
      if (convId.startsWith("rt-")) {
        const hilo = convId.slice(3);
        setMensajesActivos(mensajesBufferLiveRef.current[hilo] ?? []);
        return;
      }
      if (!silencioso) setCargandoMensajes(true);
      const res = await obtenerMensajesConversacionAction(negNorm, convId);
      if (res.ok) {
        if (res.mensajes.length > 0 || !silencioso) {
          setMensajesActivos(res.mensajes);
        }
        setTablero((prev) => ({
          ...prev,
          conversaciones: prev.conversaciones.map((c) =>
            c.id === convId ? { ...c, noLeidosAsesora: 0 } : c
          ),
        }));
      }
      if (!silencioso) setCargandoMensajes(false);
    },
    [negNorm]
  );

  const iniciarPullMovil = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (modoLayoutInbox !== "movil" || refrescandoPull) return;
      if (e.currentTarget.scrollTop <= 2 && e.touches[0]) {
        touchPullInicioYRef.current = e.touches[0].clientY;
      } else {
        touchPullInicioYRef.current = null;
      }
    },
    [modoLayoutInbox, refrescandoPull]
  );

  const moverPullMovil = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (
        modoLayoutInbox !== "movil" ||
        refrescandoPull ||
        touchPullInicioYRef.current === null
      ) {
        return;
      }
      if (e.currentTarget.scrollTop > 2) {
        touchPullInicioYRef.current = null;
        if (pullOffsetPx !== 0) setPullOffsetPx(0);
        return;
      }
      const deltaY = (e.touches[0]?.clientY ?? touchPullInicioYRef.current) - touchPullInicioYRef.current;
      if (deltaY > 10) {
        setPullOffsetPx(Math.min(72, Math.round((deltaY - 10) * 0.45)));
      } else if (pullOffsetPx !== 0) {
        setPullOffsetPx(0);
      }
    },
    [modoLayoutInbox, refrescandoPull, pullOffsetPx]
  );

  const finalizarPullMovil = useCallback(async () => {
    touchPullInicioYRef.current = null;
    if (modoLayoutInbox !== "movil" || refrescandoPull) return;
    if (pullOffsetPx >= 46) {
      setRefrescandoPull(true);
      setPullOffsetPx(48);
      try {
        const promesas: Array<Promise<unknown>> = [recargarTablero(true)];
        if (conversacionActivaId && !conversacionActivaId.startsWith("rt-")) {
          promesas.push(cargarMensajesConversacion(conversacionActivaId, true));
        }
        await Promise.all(promesas);
      } finally {
        setRefrescandoPull(false);
        setPullOffsetPx(0);
      }
    } else if (pullOffsetPx !== 0) {
      setPullOffsetPx(0);
    }
  }, [
    modoLayoutInbox,
    refrescandoPull,
    pullOffsetPx,
    recargarTablero,
    conversacionActivaId,
    cargarMensajesConversacion,
  ]);

  useEffect(() => {
    setMenuCabeceraAbierto(null);
    setMostrarSelectorFechaCustom(false);
    setMostrarMenuAdjuntar(false);
    setVistaMenuOpciones("principal");
    setMostrarMenuRespuestas(false);
    setNotaCierreInput("");
    if (!conversacionActivaId) {
      setMensajesActivos([]);
      return;
    }
    void cargarMensajesConversacion(conversacionActivaId, false);
  }, [conversacionActivaId, cargarMensajesConversacion]);

  useEffect(() => {
    const t = setInterval(() => {
      setAhoraMsTick(Date.now());
    }, 30000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!menuCabeceraAbierto) return;
    const alEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") {
        setMenuCabeceraAbierto(null);
        setMostrarSelectorFechaCustom(false);
      }
    };
    window.addEventListener("keydown", alEsc);
    return () => window.removeEventListener("keydown", alEsc);
  }, [menuCabeceraAbierto]);

  // Navegación directa desde notificaciones Push estilo WhatsApp (?pestana=chat_equipo o ?chat=...&msg=...&tel=...)
  useEffect(() => {
    if (typeof window === "undefined") return;

    const aplicarRutaDesdeSearch = (searchStr: string, desdeEventoPush: boolean): boolean => {
      const params = new URLSearchParams(searchStr);
      const pestanaParam = params.get("pestana");
      const chatParam = params.get("chat");
      const telParam = params.get("tel");
      const cliParam = params.get("cliente");
      const msgParam = params.get("msg");
      const citaParam = params.get("cita");

      if (pestanaParam === "chat_equipo") {
        setPestana("chat_equipo");
        return true;
      }

      if (!chatParam && !telParam && !cliParam) return false;

      const encontrada = resolverConversacionPorContextoReenvio(tablero.conversaciones, {
        conversacionId: chatParam,
        clienteTelefono: telParam,
        clienteNombre: cliParam || "",
      });

      if (encontrada) {
        setPestana("inbox");
        setEstadoAperturaFiltro("todos");
        setFiltroIzquierdo("todos");
        setCanalFiltro("todos");
        setSoloNoLeidos(false);
        setConversacionActivaId(encontrada.id);
        setVistaMovilInbox("chat");
        if (msgParam) setMensajeResaltadoId(msgParam);
        if (citaParam) setCitaResaltadaTexto(citaParam);
        return true;
      }

      if (desdeEventoPush && chatParam) {
        setPestana("inbox");
        setEstadoAperturaFiltro("todos");
        setFiltroIzquierdo("todos");
        setCanalFiltro("todos");
        setSoloNoLeidos(false);
        setConversacionActivaId(chatParam);
        setVistaMovilInbox("chat");
        if (msgParam) setMensajeResaltadoId(msgParam);
        void recargarTablero(true);
        return true;
      }

      return false;
    };

    if (!deepLinkProcesadoRef.current) {
      const paramsIniciales = new URLSearchParams(window.location.search);
      if (paramsIniciales.get("pestana") === "chat_equipo") {
        deepLinkProcesadoRef.current = true;
        setPestana("chat_equipo");
      } else if (tablero.conversaciones.length > 0) {
        if (aplicarRutaDesdeSearch(window.location.search, false)) {
          deepLinkProcesadoRef.current = true;
        }
      }
    }

    const alAbrirRutaPush = (ev: Event) => {
      const detalle = (ev as CustomEvent<{ url?: string }>).detail;
      const urlRaw = detalle?.url || window.location.href;
      try {
        const parsed = new URL(urlRaw, window.location.origin);
        if (parsed.pathname.startsWith("/panel/conversaciones")) {
          aplicarRutaDesdeSearch(parsed.search, true);
        }
      } catch {
        aplicarRutaDesdeSearch(window.location.search, true);
      }
    };

    window.addEventListener("eco:abrir-ruta-push", alAbrirRutaPush);
    return () => window.removeEventListener("eco:abrir-ruta-push", alAbrirRutaPush);
  }, [tablero.conversaciones, recargarTablero]);

  // Auto-scroll al último mensaje o al mensaje compartido resaltado al volver del Chat Grupal
  useEffect(() => {
    const contenedor = scrollMensajesRef.current;
    if (!contenedor) return;

    if ((mensajeResaltadoId || citaResaltadaTexto) && mensajesActivos.length > 0) {
      let idObjetivo = mensajeResaltadoId;
      if (!idObjetivo && citaResaltadaTexto) {
        const frag = citaResaltadaTexto.trim().toLowerCase();
        const coincidencia = mensajesActivos.find((m) =>
          (m.contenido || "").toLowerCase().includes(frag)
        );
        if (coincidencia) {
          idObjetivo = coincidencia.id;
          setMensajeResaltadoId(coincidencia.id);
        }
      }
      if (idObjetivo) {
        const nodo = contenedor.querySelector(`[data-msg-id="${idObjetivo}"]`) as HTMLElement | null;
        if (nodo) {
          nodo.scrollIntoView({ behavior: "smooth", block: "center" });
          const timerLimpiar = setTimeout(() => {
            setMensajeResaltadoId(null);
            setCitaResaltadaTexto(null);
          }, 6500);
          return () => clearTimeout(timerLimpiar);
        }
      }
    }

    contenedor.scrollTop = contenedor.scrollHeight;
  }, [mensajesActivos, conversacionActivaId, mensajeResaltadoId, citaResaltadaTexto]);

  // Canal WebSocket Instantáneo (<50ms Broadcast) + Postgres Changes + respaldo periódico suave
  useEffect(() => {
    const supabase = crearClienteNavegador();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const programarSincronizacionSuave = () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        void recargarTablero(true);
        const idActual = conversacionActivaIdRef.current;
        if (idActual && !idActual.startsWith("rt-")) {
          void cargarMensajesConversacion(idActual, true);
        }
      }, 900);
    };

    const canalLive = supabase
      .channel(nombreCanalRealtimeOmnicanal(negNorm), {
        config: { broadcast: { self: false } },
      })
      .on(
        "broadcast",
        { event: "actividad_chat_web" },
        ({ payload }: { payload: EventoBroadcastChatWeb }) => {
          if (!payload || !payload.claveHilo || !payload.contenido) return;

          // Deduplicación entre WebSocket directo del visitante (<50ms) y httpSend del servidor
          const huella = `${payload.claveHilo}::${payload.fase}::${payload.contenido.trim().slice(0, 100)}`;
          const ahoraMs = Date.now();
          const ultimoMs = huellasBroadcastVistasRef.current.get(huella) ?? 0;
          if (ahoraMs - ultimoMs < 12000) {
            if (payload.conversacionId) {
              setTablero((prev) => ({
                ...prev,
                conversaciones: prev.conversaciones.map((c) =>
                  c.claveHilo === payload.claveHilo && c.id.startsWith("rt-")
                    ? { ...c, id: String(payload.conversacionId) }
                    : c
                ),
              }));
              setConversacionActivaId((prev) =>
                prev === `rt-${payload.claveHilo}` ? String(payload.conversacionId) : prev
              );
            }
            return;
          }
          huellasBroadcastVistasRef.current.set(huella, ahoraMs);

          const canalPayload: CanalOmnicanal =
            payload.canal ||
            (payload.claveHilo?.startsWith("wa:") ? "whatsapp" : "web");

          const origenMsg: MensajeOmnicanal["origen"] =
            payload.fase === "RESPUESTA_ARIA"
              ? "BOT_ARIA"
              : payload.fase === "NOTA_INTERNA"
                ? "NOTA_INTERNA"
                : payload.fase === "INTERVENCION_HUMANA"
                  ? "ASESORA_HUMANA"
                  : payload.fase === "EVENTO_ORDEN"
                    ? "SISTEMA"
                    : "CLIENTE";

          const tieneMediaPayload = Boolean(
            payload.imagenUrl ||
              (payload.imagenesUrls && payload.imagenesUrls.length > 0) ||
              payload.audioUrl ||
              payload.documentoUrl
          );

          const nuevoMsg: MensajeOmnicanal = {
            id: payload.eventoId || `rtm-${ahoraMs}`,
            origen: origenMsg,
            autorNombre:
              payload.autorNombre ||
              (origenMsg === "BOT_ARIA"
                ? "Mía · ARIA"
                : origenMsg === "NOTA_INTERNA"
                  ? "ARIA · Transcripción de Voz"
                  : origenMsg === "ASESORA_HUMANA"
                    ? "Asesor Ventas"
                    : origenMsg === "SISTEMA"
                      ? "E-Commerce Web"
                      : payload.remitenteNombre ||
                        (canalPayload === "whatsapp" ? "Cliente WhatsApp" : "Visitante Web")),
            contenido: payload.contenido,
            tipoContenido:
              payload.fase === "EVENTO_ORDEN"
                ? "ORDEN_WEB"
                : payload.audioUrl
                  ? "AUDIO"
                  : payload.documentoUrl
                    ? "DOCUMENTO"
                    : payload.imagenUrl || (payload.imagenesUrls && payload.imagenesUrls.length > 0)
                      ? "IMAGEN"
                      : "TEXTO",
            estadoEntrega: "ENVIADO",
            detalle: tieneMediaPayload
              ? {
                  imagen_url: payload.imagenUrl ?? undefined,
                  imagenes_urls: payload.imagenesUrls ?? undefined,
                  audio_url: payload.audioUrl ?? undefined,
                  audio_mime: payload.audioMime ?? undefined,
                  documento_url: payload.documentoUrl ?? undefined,
                  documento_nombre: payload.documentoNombre ?? undefined,
                }
              : undefined,
            creadoEn: payload.creadoEn || new Date().toISOString(),
          };

          const bufActual = mensajesBufferLiveRef.current[payload.claveHilo] ?? [];
          mensajesBufferLiveRef.current[payload.claveHilo] = [...bufActual, nuevoMsg];

          const idObjetivo = payload.conversacionId || `rt-${payload.claveHilo}`;
          let idSeleccionadoFinal = conversacionActivaIdRef.current;

          setTablero((prev) => {
            const existente = prev.conversaciones.find((c) => c.claveHilo === payload.claveHilo);
            const idEfectivo =
              payload.conversacionId ||
              (existente && !existente.id.startsWith("rt-") ? existente.id : idObjetivo);
            const estaAbierta =
              idSeleccionadoFinal === idEfectivo ||
              idSeleccionadoFinal === `rt-${payload.claveHilo}` ||
              idSeleccionadoFinal === null;

            if (existente) {
              const actualizada: ConversacionOmnicanal = {
                ...existente,
                id: idEfectivo,
                remitenteNombre:
                  payload.remitenteNombre && existente.remitenteNombre.startsWith("Visitante Web")
                    ? payload.remitenteNombre
                    : existente.remitenteNombre,
                remitenteCorreo: payload.remitenteCorreo || existente.remitenteCorreo,
                remitenteTelefono: payload.remitenteTelefono || existente.remitenteTelefono,
                estadoAtencion: payload.estadoAtencion || existente.estadoAtencion,
                ultimoMensajeTexto:
                  origenMsg === "NOTA_INTERNA"
                    ? existente.ultimoMensajeTexto
                    : payload.contenido.slice(0, 280),
                ultimoMensajeOrigen:
                  origenMsg === "NOTA_INTERNA" ? existente.ultimoMensajeOrigen : origenMsg,
                ultimoMensajeEn: nuevoMsg.creadoEn,
                noLeidosAsesora:
                  origenMsg === "CLIENTE" && !estaAbierta
                    ? (existente.noLeidosAsesora || 0) + 1
                    : existente.noLeidosAsesora,
                mensajesClienteConteo:
                  origenMsg === "CLIENTE"
                    ? (existente.mensajesClienteConteo || 0) + 1
                    : existente.mensajesClienteConteo,
                mensajesIaConteo:
                  origenMsg === "BOT_ARIA"
                    ? (existente.mensajesIaConteo || 0) + 1
                    : existente.mensajesIaConteo,
              };
              return {
                ...prev,
                conversaciones: [
                  actualizada,
                  ...prev.conversaciones.filter((c) => c.claveHilo !== payload.claveHilo),
                ],
              };
            }

            const nuevaConv: ConversacionOmnicanal = {
              id: idEfectivo,
              negocio: negNorm,
              canal: canalPayload,
              claveHilo: payload.claveHilo,
              remitenteId: payload.remitenteTelefono || payload.claveHilo,
              remitenteNombre:
                payload.remitenteNombre ||
                (canalPayload === "whatsapp"
                  ? `WhatsApp ${payload.remitenteTelefono || ""}`.trim()
                  : `Visitante Web #${payload.claveHilo.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`),
              remitenteCorreo: payload.remitenteCorreo ?? null,
              remitenteTelefono: payload.remitenteTelefono ?? null,
              estadoAtencion: payload.estadoAtencion || "BOT_ACTIVO",
              ultimoMensajeTexto: payload.contenido.slice(0, 280),
              ultimoMensajeOrigen: origenMsg,
              ultimoMensajeEn: nuevoMsg.creadoEn,
              noLeidosAsesora: idSeleccionadoFinal === null ? 0 : 1,
              mensajesClienteConteo: origenMsg === "CLIENTE" ? 1 : 0,
              mensajesIaConteo: origenMsg === "BOT_ARIA" ? 1 : 0,
              mensajesHumanoConteo: 0,
              creadoEn: nuevoMsg.creadoEn,
              etiquetasIds: [],
            };
            return {
              ...prev,
              conversaciones: [nuevaConv, ...prev.conversaciones],
            };
          });

          if (!conversacionActivaIdRef.current) {
            conversacionActivaIdRef.current = idObjetivo;
            setFiltroIzquierdo("todos");
            setEstadoAperturaFiltro("abiertos");
            setSoloNoLeidos(false);
            setConversacionActivaId(idObjetivo);
            setMensajesActivos([nuevoMsg]);
          } else {
            setTablero((prev) => {
              const activaObj = prev.conversaciones.find(
                (c) => c.id === conversacionActivaIdRef.current
              );
              if (
                activaObj?.claveHilo === payload.claveHilo ||
                conversacionActivaIdRef.current === `rt-${payload.claveHilo}` ||
                (payload.conversacionId &&
                  conversacionActivaIdRef.current === payload.conversacionId)
              ) {
                setMensajesActivos((msgs) => {
                  const yaEsta = msgs.some(
                    (m) =>
                      m.id === nuevoMsg.id ||
                      (m.origen === nuevoMsg.origen &&
                        m.contenido.trim() === nuevoMsg.contenido.trim() &&
                        Math.abs(new Date(m.creadoEn).getTime() - ahoraMs) < 12000)
                  );
                  return yaEsta ? msgs : [...msgs, nuevoMsg];
                });
              }
              return prev;
            });
          }

          programarSincronizacionSuave();
        }
      )
      .on(
        "broadcast",
        { event: "intervencion_asesor" },
        ({ payload }: { payload: EventoBroadcastIntervencionAsesor }) => {
          if (!payload) return;
          if (payload.eliminada && payload.conversacionId) {
            // Si el chat pasó a SOLO_TITULAR y pertenece a este mismo usuario (otra pestaña), mantenerlo y sincronizar
            if (
              payload.visibilidad === "SOLO_TITULAR" &&
              payload.titularPrivadoId &&
              usuarioActualIdRef.current &&
              payload.titularPrivadoId === usuarioActualIdRef.current
            ) {
              programarSincronizacionSuave();
              return;
            }
            if (payload.visibilidad === "SOLO_ADMIN" && esAdminAplicacion) {
              programarSincronizacionSuave();
              return;
            }
            if (payload.claveHilo) {
              delete mensajesBufferLiveRef.current[payload.claveHilo];
            }
            setTablero((prev) => ({
              ...prev,
              conversaciones: prev.conversaciones.filter(
                (c) => c.id !== payload.conversacionId
              ),
            }));
            if (conversacionActivaIdRef.current === payload.conversacionId) {
              setConversacionActivaId(null);
              setMensajesActivos([]);
            }
            return;
          }
          programarSincronizacionSuave();
          if (
            payload.mensaje &&
            (conversacionActivaIdRef.current === payload.conversacionId ||
              conversacionActivaIdRef.current === `rt-${payload.claveHilo}`)
          ) {
            const msgRecibido = payload.mensaje;
            setMensajesActivos((prev) =>
              prev.some((m) => m.id === msgRecibido.id) ? prev : [...prev, msgRecibido]
            );
          }
        }
      )
      .subscribe((status: string) => {
        const ok = status === "SUBSCRIBED";
        liveConectadoRef.current = ok;
        setRealtimeConectado(ok);
      });

    canalLiveRef.current = canalLive;

    // Canal Realtime privado (solo Admin/Titular) para hilos SOLO_ADMIN / SOLO_TITULAR sin fuga al canal de Ventas
    const canalPrivado = esAdminAplicacion
      ? supabase
          .channel(nombreCanalRealtimeOmnicanalPrivado(negNorm), {
            config: { broadcast: { self: false } },
          })
          .on("broadcast", { event: "actividad_chat_web" }, () => {
            programarSincronizacionSuave();
          })
          .subscribe()
      : null;

    const canalPg = supabase
      .channel(`omnicanal-pg-${negNorm}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "comun_agentes",
          table: "agc_conversacion",
          filter: `cnv_negocio=eq.${negNorm}`,
        },
        () => {
          programarSincronizacionSuave();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "comun_agentes",
          table: "agc_mensaje",
        },
        () => {
          programarSincronizacionSuave();
        }
      )
      .subscribe();

    let ultimoRespaldoMs = Date.now();
    const ejecutarRespaldoInbox = () => {
      if (pestana !== "inbox") return;
      ultimoRespaldoMs = Date.now();
      void recargarTablero(true);
      const idActual = conversacionActivaIdRef.current;
      if (idActual && !idActual.startsWith("rt-")) {
        void cargarMensajesConversacion(idActual, true);
      }
    };

    // Realtime (Broadcast + Postgres Changes) entrega actualizaciones en vivo;
    // el temporizador actúa solo como respaldo (cada 2 min si Realtime está activo,
    // 30 s si está desconectado) y nunca consulta con la pestaña oculta.
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const intervaloObjetivoMs = liveConectadoRef.current ? 120000 : 30000;
      if (Date.now() - ultimoRespaldoMs >= intervaloObjetivoMs) {
        ejecutarRespaldoInbox();
      }
    }, 30000);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimoRespaldoMs >= 15000) {
        ejecutarRespaldoInbox();
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", alCambiarVisibilidad);
    }

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      }
      liveConectadoRef.current = false;
      canalLiveRef.current = null;
      void supabase.removeChannel(canalLive);
      if (canalPrivado) void supabase.removeChannel(canalPrivado);
      void supabase.removeChannel(canalPg);
    };
  }, [negNorm, pestana, esAdminAplicacion, recargarTablero, cargarMensajesConversacion]);

  const metricas = useMemo(
    () =>
      calcularMetricasOmnicanal(
        tablero.conversaciones,
        tablero.pedidosWeb,
        tablero.usuariosYClientes
      ),
    [tablero.conversaciones, tablero.pedidosWeb, tablero.usuariosYClientes]
  );

  const etiquetasClasificacion = useMemo(
    () =>
      tablero.etiquetas.filter(
        (e) => e.slug !== "origen-whatsapp" && e.slug !== "origen-web"
      ),
    [tablero.etiquetas]
  );

  const mapaEtiquetas = useMemo(() => {
    const m = new Map<string, EtiquetaOmnicanal>();
    for (const e of etiquetasClasificacion) m.set(e.id, e);
    return m;
  }, [etiquetasClasificacion]);

  const conversacionesFiltradas = useMemo(() => {
    const q = busquedaInbox.trim().toLowerCase();
    return tablero.conversaciones.filter((c) => {
      if (filtroIzquierdo === "cerrados") {
        if (c.estadoAtencion !== "CERRADO") return false;
      } else if (estadoAperturaFiltro === "abiertos" && c.estadoAtencion === "CERRADO") {
        return false;
      } else if (estadoAperturaFiltro === "cerrados" && c.estadoAtencion !== "CERRADO") {
        return false;
      }

      if (filtroIzquierdo === "no_asignado" && c.asesoraAsignadaId) return false;
      if (
        filtroIzquierdo === "mios" &&
        (!tablero.usuarioActualId || c.asesoraAsignadaId !== tablero.usuarioActualId)
      ) {
        return false;
      }
      if (filtroIzquierdo === "escalados" && c.estadoAtencion !== "ESCALADO_HUMANO") return false;
      if (filtroIzquierdo === "ia_activa" && c.estadoAtencion !== "BOT_ACTIVO") return false;
      if (filtroIzquierdo === "recordatorios" && !c.recordatorioEn) return false;
      if (
        filtroIzquierdo === "privados" &&
        c.visibilidad !== "SOLO_ADMIN" &&
        c.visibilidad !== "SOLO_TITULAR"
      ) {
        return false;
      }

      if (etiquetaFiltroId && !(c.etiquetasIds ?? []).includes(etiquetaFiltroId)) return false;
      if (vendedorFiltroId && c.asesoraAsignadaId !== vendedorFiltroId) return false;
      if (lineaWhatsappFiltroId && c.lineaWhatsappId !== lineaWhatsappFiltroId) return false;
      if (soloNoLeidos && (c.noLeidosAsesora || 0) === 0) return false;
      if (canalFiltro !== "todos" && (c.canal || "web") !== canalFiltro) return false;

      if (q) {
        const textoBusqueda = [
          c.remitenteNombre,
          c.remitenteCorreo,
          c.remitenteTelefono,
          c.ultimoMensajeTexto,
          c.asesoraNombre,
          c.lineaWhatsappNombre,
        ]
          .filter(Boolean)
          .join(" ")
          .toLowerCase();
        if (!textoBusqueda.includes(q)) return false;
      }

      return true;
    });
  }, [
    tablero.conversaciones,
    tablero.usuarioActualId,
    filtroIzquierdo,
    estadoAperturaFiltro,
    etiquetaFiltroId,
    vendedorFiltroId,
    lineaWhatsappFiltroId,
    soloNoLeidos,
    canalFiltro,
    busquedaInbox,
  ]);

  const conversacionActiva = useMemo(
    () => tablero.conversaciones.find((c) => c.id === conversacionActivaId) ?? null,
    [tablero.conversaciones, conversacionActivaId]
  );

  const gruposClientesFiltrados = useMemo(
    () => agruparConversacionesPorClienteOmnicanal(conversacionesFiltradas),
    [conversacionesFiltradas]
  );

  const todosGruposClientes = useMemo(
    () => agruparConversacionesPorClienteOmnicanal(tablero.conversaciones),
    [tablero.conversaciones]
  );

  const grupoClienteActivo = useMemo(() => {
    if (!conversacionActiva) return null;
    return (
      todosGruposClientes.find((g) =>
        g.conversaciones.some((c) => c.id === conversacionActiva.id)
      ) ?? null
    );
  }, [todosGruposClientes, conversacionActiva]);

  const comprasDeConversacionActiva = useMemo(() => {
    if (!conversacionActiva) return [];
    return emparejarComprasConConversacion(conversacionActiva, tablero.pedidosWeb);
  }, [conversacionActiva, tablero.pedidosWeb]);

  const contactoVinculadoActivo = useMemo(() => {
    if (!conversacionActiva) return null;
    const correo = (conversacionActiva.remitenteCorreo || "").trim().toLowerCase();
    return (
      tablero.usuariosYClientes.find(
        (u) =>
          (conversacionActiva.usuarioId && u.usuarioId === conversacionActiva.usuarioId) ||
          (conversacionActiva.clienteId && u.clienteId === conversacionActiva.clienteId) ||
          (correo && (u.correo || "").trim().toLowerCase() === correo)
      ) ?? null
    );
  }, [conversacionActiva, tablero.usuariosYClientes]);

  const respuestasSugeridasPorAtajo = useMemo(() => {
    const t = textoRespuesta.trim().toLowerCase();
    if (!mostrarMenuRespuestas && !t.startsWith("/")) return [];
    const filtro = t.startsWith("/") ? t : "";
    return tablero.respuestasRapidas.filter(
      (r) =>
        !filtro ||
        r.atajo.toLowerCase().includes(filtro) ||
        r.titulo.toLowerCase().includes(filtro.slice(1))
    );
  }, [textoRespuesta, mostrarMenuRespuestas, tablero.respuestasRapidas]);

  const herramientasCobroPorAtajo = useMemo(() => {
    const t = textoRespuesta.trim().toLowerCase();
    if (!mostrarMenuRespuestas && !t.startsWith("/")) return [];
    const comandoSolo = t.startsWith("/") ? t.split(/\s+/)[0] || "" : "";
    const catalogoHerramientas = [
      {
        clave: "LINK_PAGO" as const,
        atajo: "/LinkPago",
        titulo: "Generar Link de Pago (Tarjeta / DeUna)",
        descripcion:
          "Toma el valor de los campos del chat (editable), genera el enlace seguro y lo envía al cliente.",
        aliases: ["/linkpago", "/link", "/pago", "/tarjeta", "/plux", "/cobro"],
      },
      {
        clave: "DATOS_PAGO" as const,
        atajo: "/DatosPago",
        titulo: "Datos de Pago (DeUna + Bancos + Tarjeta)",
        descripcion:
          "Incluye link DeUna, datos bancarios configurados y opción para que el cliente solicite pago con tarjeta.",
        aliases: ["/datospago", "/datos", "/deuna", "/banco", "/cuentas", "/transferencia"],
      },
      {
        clave: "CONFIANZA" as const,
        atajo: "/Confianza",
        titulo: "Testimonios de Nuestros Clientes",
        descripcion:
          "Envía el enlace directo a los testimonios verificados y entregas reales de clientes.",
        aliases: ["/confianza", "/testimonios", "/clientes", "/resenas", "/reseñas"],
      },
    ];
    if (!comandoSolo || comandoSolo === "/") return catalogoHerramientas;
    return catalogoHerramientas.filter(
      (h) =>
        h.atajo.toLowerCase().includes(comandoSolo) ||
        h.titulo.toLowerCase().includes(comandoSolo.slice(1)) ||
        h.aliases.some((a) => a.includes(comandoSolo) || comandoSolo.startsWith(a))
    );
  }, [textoRespuesta, mostrarMenuRespuestas]);

  const solicitudTarjetaDetectada = useMemo(() => {
    if (!conversacionActiva || mensajesActivos.length === 0) return null;
    // Buscar el último mensaje del cliente posterior a cualquier link de pago ya enviado
    let ultimoIdxLinkEnviado = -1;
    for (let i = mensajesActivos.length - 1; i >= 0; i -= 1) {
      const m = mensajesActivos[i];
      if (
        m &&
        m.origen !== "CLIENTE" &&
        m.origen !== "NOTA_INTERNA" &&
        /\/pagar\/[a-z0-9_-]{8,}/i.test(m.contenido || "")
      ) {
        ultimoIdxLinkEnviado = i;
        break;
      }
    }
    for (let i = mensajesActivos.length - 1; i > ultimoIdxLinkEnviado; i -= 1) {
      const m = mensajesActivos[i];
      if (!m || m.origen !== "CLIENTE") continue;
      if (m.id === solicitudTarjetaDescartadaMsgId) return null;
      if (detectarSolicitudPagoTarjetaEnMensaje(m.contenido || "")) {
        return m;
      }
      // Revisar hasta los 2 mensajes más recientes del cliente
      break;
    }
    return null;
  }, [conversacionActiva, mensajesActivos, solicitudTarjetaDescartadaMsgId]);

  const abrirModalLinkPago = (montoOverride?: number | null) => {
    setMostrarMenuRespuestas(false);
    setMostrarMenuAdjuntar(false);
    if (textoRespuesta.trim().startsWith("/")) {
      setTextoRespuesta("");
    }
    setMontoLinkPagoOverride(
      montoOverride != null && Number.isFinite(montoOverride) && montoOverride > 0
        ? montoOverride
        : null
    );
    setModalLinkPagoAbierto(true);
  };

  const aplicarComandoDatosPago = async () => {
    if (!conversacionActiva || cargandoDatosPago) return;
    setMostrarMenuRespuestas(false);
    setMostrarMenuAdjuntar(false);
    setModoNotaInterna(false);
    setCargandoDatosPago(true);
    setErrorMsg(null);
    try {
      let cfg = configCheckoutTienda;
      try {
        const fresca = await obtenerConfiguracionTiendaCheckoutAction(negNorm);
        if (fresca) {
          cfg = fresca;
          setConfigCheckoutTienda(fresca);
        }
      } catch {
        // Usar respaldo en caché o defecto si la red falla temporalmente
      }
      const cfgEfectiva = cfg ?? crearConfiguracionTiendaCheckoutPorDefecto(negNorm);
      const datosAuto = autoCompletarDatosVentaDesdeMensajes(
        conversacionActiva.datosVenta,
        mensajesActivos,
        conversacionActiva
      );
      const totalChat = calcularTotalDatosVenta(datosAuto);
      const mensajeFormateado = construirMensajeDatosPagoChat(cfgEfectiva, {
        montoTotal: totalChat > 0 ? totalChat : null,
        concepto: datosAuto.producto?.trim() || null,
      });

      setTextoRespuesta(mensajeFormateado);
      setRespuestaSeleccionadaId(null);

      // Si hay imagen QR DeUna configurada, ofrecer adjuntarla en 1 clic
      const qrRaw = cfgEfectiva.transferencia.qrDeunaUrl?.trim() || "";
      if (qrRaw) {
        const qrAbsoluta =
          /^https?:\/\//i.test(qrRaw)
            ? qrRaw
            : typeof window !== "undefined" && window.location?.origin
              ? `${window.location.origin}${qrRaw.startsWith("/") ? qrRaw : `/${qrRaw}`}`
              : qrRaw;
        setQrDeunaSugeridoUrl(qrAbsoluta);
      } else {
        setQrDeunaSugeridoUrl(null);
      }

      setTimeout(() => textareaCompositorRef.current?.focus(), 60);
    } finally {
      setCargandoDatosPago(false);
    }
  };

  const aplicarComandoConfianza = () => {
    if (!conversacionActiva) return;
    setMostrarMenuRespuestas(false);
    setMostrarMenuAdjuntar(false);
    setModoNotaInterna(false);
    setErrorMsg(null);
    const origenActual =
      typeof window !== "undefined" &&
      window.location?.origin &&
      !/localhost|127\.0\.0\.1/i.test(window.location.origin)
        ? window.location.origin
        : null;
    const mensajeConfianza = construirMensajeConfianzaChat(negNorm, {
      urlBase: origenActual,
    });
    setTextoRespuesta(mensajeConfianza);
    setRespuestaSeleccionadaId(null);
    setQrDeunaSugeridoUrl(null);
    setTimeout(() => textareaCompositorRef.current?.focus(), 60);
  };

  const handleSeleccionarHerramientaCobro = (clave: "LINK_PAGO" | "DATOS_PAGO" | "CONFIANZA") => {
    if (clave === "LINK_PAGO") {
      const parsed = parsearComandoChatPago(textoRespuesta.trim());
      abrirModalLinkPago(parsed?.tipo === "LINK_PAGO" ? parsed.montoExplicito : null);
      return;
    }
    if (clave === "CONFIANZA") {
      aplicarComandoConfianza();
      return;
    }
    void aplicarComandoDatosPago();
  };

  const handleSeleccionarRespuestaRapida = (r: RespuestaRapidaOmnicanal) => {
    const interpolado = interpolarRespuestaRapida(r.contenido, {
      nombre: conversacionActiva?.remitenteNombre,
      asesor: tablero.usuarioActualNombre,
      negocio: negNorm.toUpperCase(),
      orden: comprasDeConversacionActiva[0]?.codigoOrden,
    });
    setTextoRespuesta(interpolado);
    setRespuestaSeleccionadaId(r.id);
    setMostrarMenuRespuestas(false);
  };

  const chatsWhatsappResumen = useMemo<ConversacionWhatsappResumen[]>(
    () =>
      tablero.conversaciones
        .filter((c) => c.canal === "whatsapp" && c.estadoAtencion !== "CERRADO")
        .map((c) => ({
          id: c.id,
          nombre: c.remitenteNombre,
          telefono: c.remitenteTelefono ?? null,
          ultimoMensajeEn: c.ultimoMensajeEn,
        })),
    [tablero.conversaciones]
  );

  const subirImagenAsesorOmnicanal = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) {
      setErrorMsg("Selecciona una imagen válida (JPG, PNG o WEBP).");
      return;
    }
    setSubiendoImagenAsesor(true);
    setErrorMsg(null);
    try {
      const supabase = crearClienteNavegador();
      const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
      const ruta = `omnicanal-media/${negNorm}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from("comun-publico")
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (errUp) {
        setErrorMsg(`No se pudo subir la imagen: ${errUp.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("comun-publico").getPublicUrl(ruta);
      if (pub?.publicUrl) {
        setDocumentoAdjuntoAsesor(null);
        setImagenAdjuntaAsesorUrl(pub.publicUrl);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error subiendo imagen.");
    } finally {
      setSubiendoImagenAsesor(false);
    }
  };

  const subirDocumentoAsesorOmnicanal = async (archivo: File) => {
    if (archivo.size > 15 * 1024 * 1024) {
      setErrorMsg("El documento supera el límite de 15 MB.");
      return;
    }
    setSubiendoImagenAsesor(true);
    setErrorMsg(null);
    try {
      const supabase = crearClienteNavegador();
      const ext =
        archivo.name
          .split(".")
          .pop()
          ?.toLowerCase()
          .replace(/[^a-z0-9]/g, "") || "pdf";
      const ruta = `omnicanal-media/${negNorm}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: errUp } = await supabase.storage.from("comun-publico").upload(ruta, archivo, {
        contentType: archivo.type || "application/octet-stream",
        upsert: false,
      });
      if (errUp) {
        setErrorMsg(`No se pudo subir el documento: ${errUp.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("comun-publico").getPublicUrl(ruta);
      if (pub?.publicUrl) {
        setImagenAdjuntaAsesorUrl(null);
        setDocumentoAdjuntoAsesor({
          url: pub.publicUrl,
          nombre: archivo.name || `documento.${ext}`,
        });
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error subiendo documento.");
    } finally {
      setSubiendoImagenAsesor(false);
    }
  };

  const handlePegarImagenCompositor = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const it = items[i];
      if (it && it.type.startsWith("image/")) {
        const file = it.getAsFile();
        if (file) {
          e.preventDefault();
          void subirImagenAsesorOmnicanal(file);
          break;
        }
      }
    }
  };

  const handleEnviarMensaje = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (
      !conversacionActiva ||
      (!textoRespuesta.trim() && !imagenAdjuntaAsesorUrl && !documentoAdjuntoAsesor) ||
      enviandoMensaje
    ) {
      return;
    }

    const textoLimpio = textoRespuesta.trim();

    // Interceptar comandos rápidos integrados (`/LinkPago`, `/DatosPago`, `/Confianza`) al presionar Enter
    if (!modoNotaInterna && !imagenAdjuntaAsesorUrl && !documentoAdjuntoAsesor) {
      const cmdPago = parsearComandoChatPago(textoLimpio);
      if (cmdPago?.tipo === "LINK_PAGO") {
        abrirModalLinkPago(cmdPago.montoExplicito);
        return;
      }
      if (cmdPago?.tipo === "DATOS_PAGO") {
        void aplicarComandoDatosPago();
        return;
      }
      if (cmdPago?.tipo === "CONFIANZA") {
        aplicarComandoConfianza();
        return;
      }
    }

    const cuerpoFinal = documentoAdjuntoAsesor
      ? `${textoLimpio ? `${textoLimpio}\n\n` : ""}📄 [${documentoAdjuntoAsesor.nombre}](${documentoAdjuntoAsesor.url})`
      : imagenAdjuntaAsesorUrl
        ? `${textoLimpio ? `${textoLimpio}\n\n` : ""}![Fotografía adjunta](${imagenAdjuntaAsesorUrl})`
        : textoLimpio;

    setEnviandoMensaje(true);
    const res = await enviarMensajeAsesorOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      contenido: cuerpoFinal,
      esNotaInterna: modoNotaInterna,
      respuestaRapidaId: respuestaSeleccionadaId,
      imagenUrl: imagenAdjuntaAsesorUrl,
      documentoUrl: documentoAdjuntoAsesor?.url ?? null,
      documentoNombre: documentoAdjuntoAsesor?.nombre ?? null,
    });
    setEnviandoMensaje(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    const avisoEnvio = res.avisoCanal || res.avisoWhatsApp;
    if (avisoEnvio) {
      setErrorMsg(`Aviso de envío (${nombreLegibleCanal(conversacionActiva.canal)}): ${avisoEnvio}`);
    }

    setTextoRespuesta("");
    setImagenAdjuntaAsesorUrl(null);
    setDocumentoAdjuntoAsesor(null);
    setQrDeunaSugeridoUrl(null);
    setRespuestaSeleccionadaId(null);
    setMensajesActivos((prev) => [...prev, res.mensaje]);
    if (conversacionActiva.claveHilo) {
      const buf = mensajesBufferLiveRef.current[conversacionActiva.claveHilo] ?? [];
      mensajesBufferLiveRef.current[conversacionActiva.claveHilo] = [...buf, res.mensaje];
    }

    // Emitir respuesta del asesor en tiempo real (<50ms) directo al widget web del visitante
    emitirBroadcastAsesor({
      eventoId: res.mensaje.id,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: conversacionActiva.id,
      estadoAtencion: res.estadoAtencion,
      asesoraAsignadaId: res.asesoraAsignadaId ?? conversacionActiva.asesoraAsignadaId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
      esNotaInterna: modoNotaInterna,
      mensaje: res.mensaje,
    });

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? {
              ...c,
              estadoAtencion: res.estadoAtencion,
              asesoraAsignadaId: res.asesoraAsignadaId ?? c.asesoraAsignadaId,
              asesoraNombre: c.asesoraNombre ?? tablero.usuarioActualNombre,
              ultimoMensajeTexto: modoNotaInterna ? c.ultimoMensajeTexto : res.mensaje.contenido,
              ultimoMensajeOrigen: modoNotaInterna ? c.ultimoMensajeOrigen : "ASESORA_HUMANA",
              ultimoMensajeEn: res.mensaje.creadoEn,
              mensajesHumanoConteo: res.mensajesHumanoConteo,
            }
          : c
      ),
    }));
  };

  const handleInsertarProductoCatalogoEnCompositor = (sel: SeleccionProductoCatalogoChat) => {
    setModoNotaInterna(false);
    setDocumentoAdjuntoAsesor(null);
    setImagenAdjuntaAsesorUrl(sel.imagenPrincipalUrl);
    setTextoRespuesta((prev) =>
      prev.trim() ? `${prev.trim()}\n\n${sel.textoMensaje}` : sel.textoMensaje
    );
    setModalCatalogoChatAbierto(false);
    setTimeout(() => textareaCompositorRef.current?.focus(), 60);
  };

  const handleEnviarProductoCatalogoDirecto = async (sel: SeleccionProductoCatalogoChat) => {
    if (!conversacionActiva || enviandoMensaje) return;
    setEnviandoMensaje(true);
    const res = await enviarMensajeAsesorOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      contenido: sel.cuerpoConMarkdown,
      esNotaInterna: false,
      imagenUrl: sel.imagenPrincipalUrl,
    });
    setEnviandoMensaje(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    const avisoEnvio = res.avisoCanal || res.avisoWhatsApp;
    if (avisoEnvio) {
      setErrorMsg(`Aviso de envío (${nombreLegibleCanal(conversacionActiva.canal)}): ${avisoEnvio}`);
    }

    setModalCatalogoChatAbierto(false);
    setMensajesActivos((prev) => [...prev, res.mensaje]);
    if (conversacionActiva.claveHilo) {
      const buf = mensajesBufferLiveRef.current[conversacionActiva.claveHilo] ?? [];
      mensajesBufferLiveRef.current[conversacionActiva.claveHilo] = [...buf, res.mensaje];
    }

    emitirBroadcastAsesor({
      eventoId: res.mensaje.id,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: conversacionActiva.id,
      estadoAtencion: res.estadoAtencion,
      asesoraAsignadaId: res.asesoraAsignadaId ?? conversacionActiva.asesoraAsignadaId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
      esNotaInterna: false,
      mensaje: res.mensaje,
    });

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? {
              ...c,
              estadoAtencion: res.estadoAtencion,
              asesoraAsignadaId: res.asesoraAsignadaId ?? c.asesoraAsignadaId,
              asesoraNombre: c.asesoraNombre ?? tablero.usuarioActualNombre,
              ultimoMensajeTexto: res.mensaje.contenido,
              ultimoMensajeOrigen: "ASESORA_HUMANA",
              ultimoMensajeEn: res.mensaje.creadoEn,
              mensajesHumanoConteo: res.mensajesHumanoConteo,
            }
          : c
      ),
    }));
    setMensajeInfo(`🌸 Producto "${sel.nombreProducto}" enviado al cliente.`);
  };

  const handleInsertarLinkPagoEnCompositor = (
    textoMensaje: string,
    datosActualizados?: DatosVentaConversacion
  ) => {
    setModoNotaInterna(false);
    setQrDeunaSugeridoUrl(null);
    setTextoRespuesta(textoMensaje);
    if (conversacionActiva && datosActualizados) {
      setTablero((prev) => ({
        ...prev,
        conversaciones: prev.conversaciones.map((c) =>
          c.id === conversacionActiva.id ? { ...c, datosVenta: datosActualizados } : c
        ),
      }));
    }
    setTimeout(() => textareaCompositorRef.current?.focus(), 60);
  };

  const handleEnviarLinkPagoDesdeModal = async (
    textoMensaje: string,
    datosActualizados?: DatosVentaConversacion
  ) => {
    if (!conversacionActiva || enviandoMensaje) return;
    setEnviandoMensaje(true);
    setErrorMsg(null);
    const res = await enviarMensajeAsesorOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      contenido: textoMensaje,
      esNotaInterna: false,
    });
    setEnviandoMensaje(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    const avisoEnvio = res.avisoCanal || res.avisoWhatsApp;
    if (avisoEnvio) {
      setErrorMsg(`Aviso de envío (${nombreLegibleCanal(conversacionActiva.canal)}): ${avisoEnvio}`);
    }

    setQrDeunaSugeridoUrl(null);
    setMensajesActivos((prev) => [...prev, res.mensaje]);
    if (conversacionActiva.claveHilo) {
      const buf = mensajesBufferLiveRef.current[conversacionActiva.claveHilo] ?? [];
      mensajesBufferLiveRef.current[conversacionActiva.claveHilo] = [...buf, res.mensaje];
    }

    emitirBroadcastAsesor({
      eventoId: res.mensaje.id,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: conversacionActiva.id,
      estadoAtencion: res.estadoAtencion,
      asesoraAsignadaId: res.asesoraAsignadaId ?? conversacionActiva.asesoraAsignadaId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
      esNotaInterna: false,
      mensaje: res.mensaje,
    });

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? {
              ...c,
              estadoAtencion: res.estadoAtencion,
              asesoraAsignadaId: res.asesoraAsignadaId ?? c.asesoraAsignadaId,
              asesoraNombre: c.asesoraNombre ?? tablero.usuarioActualNombre,
              ultimoMensajeTexto: res.mensaje.contenido,
              ultimoMensajeOrigen: "ASESORA_HUMANA",
              ultimoMensajeEn: res.mensaje.creadoEn,
              mensajesHumanoConteo: res.mensajesHumanoConteo,
              datosVenta: datosActualizados ?? c.datosVenta,
            }
          : c
      ),
    }));
    setMensajeInfo("💳 Link de pago generado y enviado al cliente.");
  };

  const handleProcesarNotaVozPanel = async (
    mensajeAudio: MensajeOmnicanal,
    audioUrl: string,
    mimeType?: string,
    responderConAria = false
  ) => {
    if (!conversacionActiva || procesandoAudioMsgId) return;
    setProcesandoAudioMsgId(mensajeAudio.id);
    setErrorMsg(null);
    try {
      const baseTienda =
        typeof window !== "undefined" && window.location?.origin
          ? window.location.origin
          : undefined;
      const res = await transcribirYResponderNotaVozOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        mensajeAudioId: mensajeAudio.id,
        audioUrl,
        mimeType: mimeType ?? null,
        remitenteNombre: conversacionActiva.remitenteNombre,
        remitenteTelefono: conversacionActiva.remitenteTelefono ?? null,
        claveHilo: conversacionActiva.claveHilo,
        responderConAria,
        origenTiendaUrl: baseTienda,
      });

      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }

      setMensajesActivos((prev) => {
        const idsExistentes = new Set(prev.map((m) => m.id));
        const actualizados = prev.map((m) =>
          m.id === mensajeAudio.id
            ? {
                ...m,
                detalle: {
                  ...(m.detalle ?? {}),
                  transcripcion: res.transcripcion,
                  nota_transcripcion_id: res.notaInterna.id,
                },
              }
            : m
        );
        if (!idsExistentes.has(res.notaInterna.id)) {
          actualizados.push(res.notaInterna);
        }
        if (res.mensajeAria && !idsExistentes.has(res.mensajeAria.id)) {
          actualizados.push(res.mensajeAria);
        }
        return actualizados;
      });

      if (res.mensajeAria) {
        setMensajeInfo("🎙️ Nota de voz transcrita en Nota Interna y respondida con ARIA.");
        void recargarTablero(true);
      } else {
        setMensajeInfo("🎙️ Nota de voz transcrita y guardada como Nota Interna.");
      }
    } finally {
      setProcesandoAudioMsgId(null);
    }
  };

  const handleSincronizarFotosGoogle = async () => {
    setSincronizandoFotosGoogle(true);
    setErrorMsg(null);
    const res = await sincronizarFotosGoogleContactsAction({ negocio: negNorm });
    setSincronizandoFotosGoogle(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    await recargarTablero(true);
    setMensajeInfo(
      `📷 Fotos Google sincronizadas (${res.cuentasProcesadas} cuenta${res.cuentasProcesadas === 1 ? "" : "s"}): ${res.fotosDetectadas} foto(s) encontradas · ${res.chatsActualizados} chat(s) en vivo actualizados.`
    );
  };

  const handleCambiarPrivacidadChat = async (
    accion: "MARCAR_PERSONAL" | "PASAR_A_VENTAS" | "ACTIVAR_IA_CLIENTE",
    politicaPersonal: "SOLO_TITULAR" | "OCULTO_ADMIN" | "IGNORAR_TOTAL" = "SOLO_TITULAR",
    convObjetivo?: ConversacionOmnicanal
  ) => {
    const objetivo = convObjetivo ?? conversacionActiva;
    if (!objetivo || objetivo.id.startsWith("rt-")) return;
    setActualizandoPrivacidad(true);
    setMenuCabeceraAbierto(null);
    setErrorMsg(null);
    const res = await marcarChatPrivacidadOmnicanalAction({
      negocio: negNorm,
      conversacionId: objetivo.id,
      claveHilo: objetivo.claveHilo,
      accion,
      politicaPersonal,
    });
    setActualizandoPrivacidad(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    if (accion === "MARCAR_PERSONAL") {
      if (res.ocultoConsola) {
        setTablero((prev) => ({
          ...prev,
          conversaciones: prev.conversaciones.filter((c) => c.id !== objetivo.id),
        }));
        if (conversacionActiva?.id === objetivo.id) {
          setConversacionActivaId(null);
          setMensajesActivos([]);
        }
        setMensajeInfo(
          "📵 Contacto en Ignorar Total: oculto para todos en la web; futuros mensajes solo quedarán en tu celular."
        );
      } else {
        setTablero((prev) => ({
          ...prev,
          conversaciones: prev.conversaciones.map((c) =>
            c.id === objetivo.id
              ? {
                  ...c,
                  visibilidad: res.visibilidad,
                  titularPrivadoId: res.titularPrivadoId ?? prev.usuarioActualId ?? c.titularPrivadoId,
                  iaBloqueadaPermanente: true,
                  estadoAtencion: "EN_ATENCION_ASESORA",
                  asesoraAsignadaId: null,
                  asesoraNombre: null,
                  contactoClasificacion: "PERSONAL",
                }
              : c
          ),
        }));
        setMensajeInfo(
          res.visibilidad === "SOLO_TITULAR"
            ? "🔒 Chat convertido a Personal (Solo yo): dejó de ser visible para todos los demás usuarios y se bloqueó ARIA."
            : "🛡️ Chat marcado como Personal (Solo Administradores): oculto para Ventas y con IA bloqueada."
        );
      }
      return;
    }

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === objetivo.id
          ? {
              ...c,
              visibilidad: "EQUIPO_VENTAS",
              iaBloqueadaPermanente: false,
              contactoClasificacion: "CLIENTE",
              estadoAtencion: res.estadoAtencion || c.estadoAtencion,
            }
          : c
      ),
    }));
    setMensajeInfo(
      accion === "ACTIVAR_IA_CLIENTE"
        ? "⚡ Contacto clasificado como Cliente con IA Automática activada."
        : "💼 Chat liberado como Cliente para el equipo de Ventas."
    );
  };

  const handleCambiarEstado = async (nuevoEstado: EstadoAtencionOmnicanal) => {
    if (!conversacionActiva) return;
    const convId = conversacionActiva.id;
    const estadoPrevio = conversacionActiva.estadoAtencion;
    const cierrePrevio = conversacionActiva.cierre;

    setMenuCabeceraAbierto(null);
    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === convId
          ? {
              ...c,
              estadoAtencion: nuevoEstado,
              cierre: nuevoEstado === "CERRADO" ? c.cierre : null,
            }
          : c
      ),
    }));

    if (nuevoEstado === "EN_ATENCION_ASESORA" && estadoPrevio === "CERRADO") {
      setMensajeInfo("↺ Conversación reabierta.");
    } else if (nuevoEstado === "EN_ATENCION_ASESORA") {
      setMensajeInfo("⏸ IA pausada · Atención humana activa.");
    } else if (nuevoEstado === "BOT_ACTIVO") {
      setMensajeInfo("▶ IA ARIA reactivada en este chat.");
    }

    if (!convId.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: convId,
        nuevoEstado,
      });
      if (!res.ok) {
        setTablero((prev) => ({
          ...prev,
          conversaciones: prev.conversaciones.map((c) =>
            c.id === convId ? { ...c, estadoAtencion: estadoPrevio, cierre: cierrePrevio } : c
          ),
        }));
        setErrorMsg(res.error);
        return;
      }
    }

    emitirBroadcastAsesor({
      eventoId: `est-${Date.now()}`,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: convId,
      estadoAtencion: nuevoEstado,
      asesoraAsignadaId: conversacionActiva.asesoraAsignadaId ?? tablero.usuarioActualId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
    });

    if (!convId.startsWith("rt-")) {
      void recargarTablero(true);
      void cargarMensajesConversacion(convId, true);
    }
  };

  const handleAsignarVendedor = async (valor: string) => {
    if (!conversacionActiva) return;
    const convId = conversacionActiva.id;
    const previoId = conversacionActiva.asesoraAsignadaId ?? null;
    const previoNombre = conversacionActiva.asesoraNombre ?? null;
    const miembroNuevo = valor
      ? tablero.equipo.find((m) => m.usuarioId === valor)
      : null;

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === convId
          ? {
              ...c,
              asesoraAsignadaId: valor || null,
              asesoraNombre: miembroNuevo ? miembroNuevo.nombre : null,
            }
          : c
      ),
    }));

    const res = await actualizarConversacionOmnicanalAction({
      negocio: negNorm,
      conversacionId: convId,
      asesoraId: valor ? valor : null,
      desasignar: !valor,
    });
    if (!res.ok) {
      setTablero((prev) => ({
        ...prev,
        conversaciones: prev.conversaciones.map((c) =>
          c.id === convId
            ? { ...c, asesoraAsignadaId: previoId, asesoraNombre: previoNombre }
            : c
        ),
      }));
      setErrorMsg(res.error);
      return;
    }
    void recargarTablero(true);
  };

  const handleProgramarRecordatorioEnIso = async (
    isoObjetivo: string,
    notaTexto: string
  ) => {
    if (!conversacionActiva) return;
    if (!conversacionActiva.id.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        recordatorioEn: isoObjetivo,
        recordatorioNota: notaTexto.trim() || "Seguimiento comercial",
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    }

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? {
              ...c,
              recordatorioEn: isoObjetivo,
              recordatorioNota: notaTexto.trim() || "Seguimiento comercial",
            }
          : c
      ),
    }));
    setMenuCabeceraAbierto(null);
    setMostrarSelectorFechaCustom(false);
    setRecordatorioFecha("");
    setRecordatorioNota("");
    setMensajeInfo(
      `⏰ Recordatorio programado para ${new Date(isoObjetivo).toLocaleString("es-EC", {
        dateStyle: "short",
        timeStyle: "short",
      })}.`
    );
    void recargarTablero(true);
  };

  const handleGuardarRecordatorio = async () => {
    if (!conversacionActiva || !recordatorioFecha) return;
    await handleProgramarRecordatorioEnIso(
      new Date(recordatorioFecha).toISOString(),
      recordatorioNota
    );
  };

  const handleProgramarRecordatorioRapido = async (clave: ClaveRecordatorioRapido) => {
    const iso = calcularFechaRecordatorioRapido(clave);
    await handleProgramarRecordatorioEnIso(iso, recordatorioNota || "Seguimiento comercial");
  };

  const handleLimpiarRecordatorio = async () => {
    if (!conversacionActiva) return;
    if (!conversacionActiva.id.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        limpiarRecordatorio: true,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    }
    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? { ...c, recordatorioEn: null, recordatorioNota: null }
          : c
      ),
    }));
    setMenuCabeceraAbierto(null);
    setMensajeInfo("⏰ Recordatorio eliminado.");
    void recargarTablero(true);
  };

  const handleCerrarConversacionConMotivo = async (
    motivoCodigo: CodigoMotivoCierreOmnicanal
  ) => {
    if (!conversacionActiva) return;
    const defMotivo = MOTIVOS_CIERRE_OMNICANAL.find((m) => m.codigo === motivoCodigo);
    const notaLimpia = notaCierreInput.trim() || null;

    if (!conversacionActiva.id.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        nuevoEstado: "CERRADO",
        motivoCierre: motivoCodigo,
        notaCierre: notaLimpia,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    }

    const etiquetaCierre = defMotivo
      ? `${defMotivo.icono} ${defMotivo.etiqueta}`
      : "Cerrado";

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === conversacionActiva.id
          ? {
              ...c,
              estadoAtencion: "CERRADO",
              noLeidosAsesora: 0,
              recordatorioEn: null,
              recordatorioNota: null,
              cierre: {
                motivoCodigo,
                motivoEtiqueta: etiquetaCierre,
                nota: notaLimpia,
                cerradoEn: new Date().toISOString(),
                cerradoPor: tablero.usuarioActualNombre,
              },
            }
          : c
      ),
    }));

    emitirBroadcastAsesor({
      eventoId: `cierre-${Date.now()}`,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: conversacionActiva.id,
      estadoAtencion: "CERRADO",
      asesoraAsignadaId: conversacionActiva.asesoraAsignadaId ?? tablero.usuarioActualId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
    });

    setMenuCabeceraAbierto(null);
    setNotaCierreInput("");
    setMensajeInfo(`✅ Conversación cerrada (${etiquetaCierre}).`);

    if (!conversacionActiva.id.startsWith("rt-")) {
      void recargarTablero(true);
      void cargarMensajesConversacion(conversacionActiva.id, true);
    }
  };

  const handleAbrirConversacionDesdeEquipo = useCallback(
    (reenvio: ContextoReenvioChatEquipo) => {
      const encontrada = resolverConversacionPorContextoReenvio(
        tablero.conversaciones,
        reenvio
      );
      setPestana("inbox");
      setEstadoAperturaFiltro("todos");
      setFiltroIzquierdo("todos");
      setCanalFiltro("todos");
      setSoloNoLeidos(false);
      setEtiquetaFiltroId(null);
      setVendedorFiltroId(null);

      if (encontrada) {
        setConversacionActivaId(encontrada.id);
        setVistaMovilInbox("chat");
        setMensajeResaltadoId(reenvio.mensajeId ?? null);
        setCitaResaltadaTexto(reenvio.textoOriginal ?? null);
      } else if (reenvio.clienteTelefono || reenvio.clienteNombre) {
        setBusquedaInbox(reenvio.clienteTelefono || reenvio.clienteNombre);
        setMensajeInfo(
          `Buscando conversación de ${reenvio.clienteNombre}${reenvio.clienteTelefono ? ` (${reenvio.clienteTelefono})` : ""}…`
        );
      }
    },
    [tablero.conversaciones]
  );

  const handleAlternarEtiqueta = async (etiquetaId: string) => {
    if (!conversacionActiva) return;
    const convId = conversacionActiva.id;
    const clienteId = conversacionActiva.clienteId;

    // Actualización optimista inmediata para respuesta táctil instantánea en móvil
    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) => {
        if (c.id !== convId) return c;
        const tiene = c.etiquetasIds.includes(etiquetaId);
        return {
          ...c,
          etiquetasIds: tiene
            ? c.etiquetasIds.filter((id) => id !== etiquetaId)
            : [...c.etiquetasIds, etiquetaId],
        };
      }),
    }));

    const res = await alternarEtiquetaOmnicanalAction({
      negocio: negNorm,
      etiquetaId,
      conversacionId: convId,
      clienteId,
    });
    if (!res.ok) {
      // Revertir si falló
      setTablero((prev) => ({
        ...prev,
        conversaciones: prev.conversaciones.map((c) => {
          if (c.id !== convId) return c;
          const tiene = c.etiquetasIds.includes(etiquetaId);
          return {
            ...c,
            etiquetasIds: tiene
              ? c.etiquetasIds.filter((id) => id !== etiquetaId)
              : [...c.etiquetasIds, etiquetaId],
          };
        }),
      }));
      setErrorMsg(res.error);
    }
  };

  const handleMarcarComoNoLeido = async () => {
    if (!conversacionActiva) return;
    const convId = conversacionActiva.id;
    const nombreCliente = conversacionActiva.remitenteNombre;

    setMenuCabeceraAbierto(null);
    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) =>
        c.id === convId ? { ...c, noLeidosAsesora: Math.max(1, c.noLeidosAsesora || 0) } : c
      ),
    }));
    setMensajeInfo(`📌 Chat con ${nombreCliente} marcado como no leído.`);
    if (modoLayoutInbox === "movil") {
      setVistaMovilInbox("lista");
    }

    if (!convId.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: convId,
        marcarNoLeido: true,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
      }
    }
  };

  const handleCompartirChatAlEquipo = () => {
    if (!conversacionActiva) return;
    const ultimoMsg = mensajesActivos[mensajesActivos.length - 1] ?? null;
    const imgReciente =
      (ultimoMsg ? extraerTodasLasImagenesMensaje(ultimoMsg)[0]?.url : null) ?? null;
    const resumenTexto = ultimoMsg
      ? ultimoMsg.contenido.replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "").trim()
      : conversacionActiva.ultimoMensajeTexto || "";

    setReenvioModalDatos({
      destino: "equipo",
      payload: {
        imagenUrl: imgReciente,
        tituloImagen: conversacionActiva.remitenteNombre,
        textoOriginal:
          resumenTexto || `Seguimiento de chat con ${conversacionActiva.remitenteNombre}`,
        contextoCliente: {
          conversacionId: conversacionActiva.id,
          mensajeId: ultimoMsg?.id ?? null,
          canal: conversacionActiva.canal,
          clienteNombre: conversacionActiva.remitenteNombre,
          clienteTelefono: conversacionActiva.remitenteTelefono ?? null,
          autorOriginal: ultimoMsg?.autorNombre || conversacionActiva.remitenteNombre,
          textoOriginal: resumenTexto,
          imagenUrl: imgReciente,
        },
      },
    });
  };

  const handleConfirmarEliminarConversacion = async () => {
    if (!conversacionAEliminar || eliminandoConversacion) return;
    const objetivo = conversacionAEliminar;
    setEliminandoConversacion(true);
    setErrorMsg(null);

    const res = await eliminarConversacionOmnicanalAction({
      negocio: negNorm,
      conversacionId: objetivo.id,
      claveHilo: objetivo.claveHilo,
    });
    setEliminandoConversacion(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      setConversacionAEliminar(null);
      return;
    }

    if (objetivo.claveHilo) {
      delete mensajesBufferLiveRef.current[objetivo.claveHilo];
    }

    const siguienteEnLista =
      conversacionesFiltradas.find((c) => c.id !== objetivo.id) ?? null;

    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.filter((c) => c.id !== objetivo.id),
    }));

    if (conversacionActivaId === objetivo.id) {
      setConversacionActivaId(siguienteEnLista ? siguienteEnLista.id : null);
      setMensajesActivos([]);
      if (modoLayoutInbox === "movil") {
        setVistaMovilInbox("lista");
      }
    }

    emitirBroadcastAsesor({
      eventoId: `del-cli-${Date.now()}`,
      claveHilo: objetivo.claveHilo,
      conversacionId: objetivo.id,
      estadoAtencion: "CERRADO",
      eliminada: true,
    });

    setMenuCabeceraAbierto(null);
    setConversacionAEliminar(null);
    setMensajeInfo(`🗑️ Conversación con ${objetivo.remitenteNombre} eliminada permanentemente.`);
  };

  const handleIniciarSeguimiento = async (entrada: {
    nombre: string;
    correo?: string | null;
    telefono?: string | null;
    usuarioId?: string | null;
    clienteId?: string | null;
    contextoOrden?: string | null;
  }) => {
    const res = await abrirSeguimientoContactoOmnicanalAction({
      negocio: negNorm,
      ...entrada,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    await recargarTablero(true);
    setEstadoAperturaFiltro("todos");
    setFiltroIzquierdo("todos");
    setConversacionActivaId(res.conversacionId);
    setMostrarFichaTablet(false);
    setVistaMovilInbox("chat");
    setPestana("inbox");
  };

  const handleGuardarRespuestaRapida = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formRespuesta.atajo.trim() || !formRespuesta.contenido.trim()) return;
    setGuardandoRespuesta(true);
    const res = await guardarRespuestaRapidaOmnicanalAction({
      negocio: negNorm,
      id: formRespuesta.id,
      atajo: formRespuesta.atajo,
      titulo: formRespuesta.titulo || formRespuesta.atajo,
      categoria: formRespuesta.categoria || "Ventas",
      contenido: formRespuesta.contenido,
    });
    setGuardandoRespuesta(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setFormRespuesta({ atajo: "", titulo: "", categoria: "Ventas", contenido: "" });
    void recargarTablero(true);
  };

  // =========================================================================
  // COLUMNAS DATAGRID ESTÁNDAR (2 CAPAS) — COMPRAS WEB (REGISTRADOS E INVITADOS)
  // =========================================================================
  const pedidosFiltradosTab = useMemo(() => {
    return tablero.pedidosWeb.filter((p) => {
      if (filtroTipoComprador === "registrados") return p.esUsuarioRegistrado;
      if (filtroTipoComprador === "invitados") return !p.esUsuarioRegistrado;
      if (filtroTipoComprador === "eventos") return p.tipoOrigen === "PROFORMA_EVENTO";
      return true;
    });
  }, [tablero.pedidosWeb, filtroTipoComprador]);

  const columnasComprasWeb = useMemo<ColumnaDataGrid<PedidoWebConTipoCliente>[]>(
    () => [
      {
        id: "codigo",
        encabezado: "Orden / Proforma",
        valor: (p) => `${p.codigoOrden} ${p.tipoOrigen || ""}`,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
            <strong style={{ fontSize: "0.84rem", color: "var(--ct-1f1c19, #1F1C19)" }}>{p.codigoOrden}</strong>
            <span style={{ fontSize: "0.72rem", color: "var(--ct-847d74, #847D74)" }}>
              {p.tipoOrigen === "PROFORMA_EVENTO" ? "✨ Proforma Evento" : "🛍️ Compra Tienda"}
            </span>
          </div>
        ),
      },
      {
        id: "tipo_cliente",
        encabezado: "Tipo de Comprador",
        valor: (p) => (p.esUsuarioRegistrado ? "Usuario Registrado" : "Invitado No Registrado"),
        render: (p) => (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 9px",
              borderRadius: "999px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: p.esUsuarioRegistrado ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf6ee, #FAF6EE)",
              color: p.esUsuarioRegistrado ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-745622, #745622)",
              border: `1px solid ${p.esUsuarioRegistrado ? "var(--cb-ceddd3, #CEDDD3)" : "var(--cb-e5d7bc, #E5D7BC)"}`,
            }}
          >
            {p.esUsuarioRegistrado ? "✅ Registrado Web" : "🛒 Invitado (Sin Cuenta)"}
          </span>
        ),
      },
      {
        id: "comprador",
        encabezado: "Cliente y Contacto",
        valor: (p) => `${p.compradorNombre} ${p.compradorCorreo} ${p.compradorTelefono}`,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.83rem", color: "var(--ct-2e2a26, #2E2A26)" }}>{p.compradorNombre}</strong>
            <span style={{ fontSize: "0.73rem", color: "var(--ct-847d74, #847D74)" }}>
              {p.compradorTelefono || "Sin tel."} · {p.compradorCorreo || "Sin correo"}
            </span>
          </div>
        ),
      },
      {
        id: "total",
        encabezado: "Total USD",
        valor: (p) => Number(p.total) || 0,
        render: (p) => (
          <div style={{ display: "flex", flexDirection: "column" }}>
            <strong style={{ fontSize: "0.86rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
              ${Number(p.total || 0).toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.7rem", color: "var(--ct-847d74, #847D74)" }}>
              {(p.metodoPago || "ONLINE").toUpperCase()}
            </span>
          </div>
        ),
      },
      {
        id: "estado",
        encabezado: "Estado",
        valor: (p) => p.estado,
        render: (p) => (
          <span
            style={{
              padding: "3px 8px",
              borderRadius: "999px",
              fontSize: "0.72rem",
              fontWeight: 700,
              background:
                p.estado === "APROBADA" || p.estado === "ENTREGADO" ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf6ee, #FAF6EE)",
              color: p.estado === "APROBADA" || p.estado === "ENTREGADO" ? "var(--ct-2f4737, #2F4737)" : "var(--ct-745622, #745622)",
            }}
          >
            {p.estado}
          </span>
        ),
      },
      {
        id: "fecha",
        encabezado: "Fecha",
        valor: (p) => new Date(p.creadoEn).getTime(),
        render: (p) => (
          <span style={{ fontSize: "0.76rem", color: "var(--ct-4b5563, #4B5563)" }}>
            {new Date(p.creadoEn).toLocaleString("es-EC", {
              dateStyle: "short",
              timeStyle: "short",
            })}
          </span>
        ),
      },
      {
        id: "accion_crm",
        encabezado: "Seguimiento",
        valor: (p) => p.codigoOrden,
        render: (p) => (
          <button
            type="button"
            className="btn-responsive-accion"
            title={`Abrir seguimiento en bandeja para ${p.compradorNombre}`}
            aria-label={`Seguimiento de ${p.compradorNombre}`}
            onClick={() =>
              void handleIniciarSeguimiento({
                nombre: p.compradorNombre,
                correo: p.compradorCorreo,
                telefono: p.compradorTelefono,
                contextoOrden: `🛍️ Seguimiento de ${p.codigoOrden} ($${Number(p.total).toFixed(
                  2
                )} USD · ${p.estado})`,
              })
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "8px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-1f1c19, #1F1C19)",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <MessageSquare size={14} />
            <span className="btn-texto-responsive">Seguimiento</span>
          </button>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [negNorm]
  );

  // =========================================================================
  // COLUMNAS DATAGRID ESTÁNDAR — DIRECTORIO 360° USUARIOS WEB + INVITADOS
  // =========================================================================
  const contactosFiltradosTab = useMemo(() => {
    return tablero.usuariosYClientes.filter((u) => {
      if (filtroTipoUsuarioDir === "registrados") return u.tipoCuenta === "USUARIO_REGISTRADO";
      if (filtroTipoUsuarioDir === "invitados") return u.tipoCuenta !== "USUARIO_REGISTRADO";
      return true;
    });
  }, [tablero.usuariosYClientes, filtroTipoUsuarioDir]);

  const columnasUsuariosWeb = useMemo<ColumnaDataGrid<ContactoUnificadoOmnicanal>[]>(
    () => [
      {
        id: "nombre",
        encabezado: "Cliente / Usuario Web",
        valor: (u) => `${u.nombre} ${u.correo || ""} ${u.telefono || ""} ${u.notasCliente || ""}`,
        render: (u) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <button
                type="button"
                onClick={() => setModalFichaClienteContexto({ contactoDirectorio: u })}
                title="Ver y editar ficha del cliente"
                aria-label={`Editar ficha de ${u.nombre}`}
                style={{
                  border: "none",
                  background: "transparent",
                  padding: 0,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--ct-1f1c19, #1F1C19)",
                  fontWeight: 700,
                  fontSize: "0.84rem",
                  textAlign: "left",
                }}
              >
                <span>{u.nombre}</span>
                <Pencil size={11} style={{ color: "var(--ct-847d74, #847D74)", flexShrink: 0 }} />
              </button>
              {u.calificacionEstrellas != null && u.calificacionEstrellas > 0 && (
                <span
                  title={`Calificación: ${u.calificacionEstrellas}/5 estrellas`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "2px",
                    padding: "1px 6px",
                    borderRadius: "999px",
                    background: "var(--cf-fffbeb, #FFFBEB)",
                    border: "1px solid var(--cb-e8dec6, #E8DEC6)",
                    color: "var(--ct-b45309, #B45309)",
                    fontSize: "0.68rem",
                    fontWeight: 700,
                  }}
                >
                  <Star size={10} fill="#D97706" color="#D97706" />
                  <span>{u.calificacionEstrellas}</span>
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.73rem", color: "var(--ct-847d74, #847D74)" }}>
              {u.correo || "Sin correo"} {u.telefono ? `· ${u.telefono}` : ""}
            </span>
            {u.notasCliente && (
              <span
                style={{
                  fontSize: "0.71rem",
                  color: "var(--ct-745622, #745622)",
                  fontWeight: 600,
                }}
              >
                📝 {u.notasCliente}
              </span>
            )}
          </div>
        ),
      },
      {
        id: "origen_cuenta",
        encabezado: "Registro en Web",
        valor: (u) =>
          u.tipoCuenta === "USUARIO_REGISTRADO" ? "Registrado en Web" : "Invitado No Registrado",
        render: (u) => (
          <span
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "3px 9px",
              borderRadius: "999px",
              fontSize: "0.73rem",
              fontWeight: 700,
              background: u.tipoCuenta === "USUARIO_REGISTRADO" ? "var(--cf-efece6, #EFECE6)" : "var(--cf-f4f2ee, #F4F2EE)",
              color: u.tipoCuenta === "USUARIO_REGISTRADO" ? "var(--ct-3a3530, #3A3530)" : "var(--ct-57524c, #57524C)",
            }}
          >
            {u.tipoCuenta === "USUARIO_REGISTRADO" ? "✅ Usuario Registrado" : "🛒 Invitado"}
          </span>
        ),
      },
      {
        id: "lopdp_wa",
        encabezado: "WhatsApp LOPDP",
        valor: (u) => (u.autorizaWhatsapp ? "Autorizado" : "Pendiente"),
        render: (u) => (
          <span
            style={{
              fontSize: "0.74rem",
              fontWeight: 600,
              color: u.autorizaWhatsapp ? "var(--ct-2f4737, #2F4737)" : "var(--ct-847d74, #847D74)",
            }}
          >
            {u.autorizaWhatsapp ? "✔ Autorizado" : "— Sin opt-in"}
          </span>
        ),
      },
      {
        id: "compras",
        encabezado: "Compras Realizadas",
        valor: (u) => u.totalCompras,
        render: (u) => (
          <strong style={{ fontSize: "0.83rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
            {u.totalCompras} {u.totalCompras === 1 ? "compra" : "compras"}
          </strong>
        ),
      },
      {
        id: "monto",
        encabezado: "Monto Acumulado",
        valor: (u) => Number(u.montoAcumulado) || 0,
        render: (u) => (
          <strong style={{ fontSize: "0.84rem", color: "var(--ct-2f4737, #2F4737)" }}>
            ${Number(u.montoAcumulado || 0).toFixed(2)}
          </strong>
        ),
      },
      {
        id: "etiquetas",
        encabezado: "Etiquetas",
        valor: (u) =>
          (u.etiquetasIds ?? [])
            .map((id) => mapaEtiquetas.get(id)?.nombre)
            .filter(Boolean)
            .join(", "),
        render: (u) => (
          <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
            {(u.etiquetasIds ?? []).length === 0 && (
              <span style={{ fontSize: "0.72rem", color: "var(--ct-9b948b, #9B948B)" }}>Sin etiquetas</span>
            )}
            {(u.etiquetasIds ?? []).map((id) => {
              const etq = mapaEtiquetas.get(id);
              if (!etq) return null;
              return (
                <span
                  key={id}
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 600,
                    padding: "2px 7px",
                    borderRadius: "999px",
                    background: `${etq.color}18`,
                    color: etq.color,
                    border: `1px solid ${etq.color}40`,
                  }}
                >
                  {etq.icono} {etq.nombre}
                </span>
              );
            })}
          </div>
        ),
      },
      {
        id: "accion",
        encabezado: "Acción",
        valor: (u) => u.nombre,
        render: (u) => (
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <button
              type="button"
              className="btn-responsive-accion"
              title={`Editar ficha y notas de ${u.nombre}`}
              aria-label={`Editar ficha de ${u.nombre}`}
              onClick={() => setModalFichaClienteContexto({ contactoDirectorio: u })}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 9px",
                borderRadius: "8px",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                background: "var(--cf-faf8f5, #FAF8F5)",
                color: "var(--ct-3a3530, #3A3530)",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <Pencil size={13} />
              <span className="btn-texto-responsive">Ficha</span>
            </button>

            <button
              type="button"
              className="btn-responsive-accion"
              title={`Abrir hilo de conversación con ${u.nombre}`}
              aria-label={`Abrir chat con ${u.nombre}`}
              onClick={() =>
                void handleIniciarSeguimiento({
                  nombre: u.nombre,
                  correo: u.correo,
                  telefono: u.telefono,
                  usuarioId: u.usuarioId,
                  clienteId: u.clienteId,
                })
              }
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-ffffff, #FFFFFF)",
                color: "var(--ct-1f1c19, #1F1C19)",
                fontSize: "0.76rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <MessageCircle size={14} />
              <span className="btn-texto-responsive">Abrir Chat</span>
            </button>
          </div>
        ),
      },
    ],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [mapaEtiquetas, negNorm]
  );

  const handleImportarHistorialAria = async () => {
    setImportandoHistorialAria(true);
    setErrorMsg(null);
    setMensajeInfo(null);
    const res = await sincronizarHistorialAriaOmnicanalAction(negNorm, 100);
    setImportandoHistorialAria(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    await recargarTablero(false);
    setCanalFiltro("todos");
    setMensajeInfo(
      res.interaccionesImportadas > 0
        ? `✅ Se importaron ${res.interaccionesImportadas} mensaje(s) previos desde ARIA (${res.totalConversacionesWhatsApp} chat(s) de WhatsApp en total).`
        : `Sincronización completada (${res.totalConversacionesWhatsApp} chat(s) de WhatsApp al día).`
    );
  };

  const ocultarCabeceraModulosEnMovil =
    pestana === "inbox" && modoLayoutInbox === "movil" && vistaMovilInbox !== "lista";

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "9px" }}>
      {/* Barra Superior Compacta de Módulos y Estado en Vivo (oculta en móvil al entrar a un chat) */}
      {!ocultarCabeceraModulosEnMovil && (
      <div
        style={{
          background: "var(--cf-ffffff, #FFFFFF)",
          border: "1px solid var(--cb-221d1a-a100, rgba(34, 29, 26, 0.1))",
          borderRadius: "14px",
          padding: modoLayoutInbox === "movil" ? "7px 9px" : "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: modoLayoutInbox === "movil" ? "nowrap" : "wrap",
          gap: "8px",
          boxShadow: "0 2px 10px rgba(34, 29, 26, 0.04)",
          minWidth: 0,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: modoLayoutInbox === "movil" ? "6px" : "8px",
            flexWrap: modoLayoutInbox === "movil" ? "nowrap" : "wrap",
            overflowX: modoLayoutInbox === "movil" ? "auto" : "visible",
            WebkitOverflowScrolling: "touch",
            minWidth: 0,
            flex: modoLayoutInbox === "movil" ? "1 1 auto" : undefined,
          }}
        >
          {(
            [
              {
                id: "inbox" as const,
                etiqueta: "Bandeja de Chats",
                cortoMovil: "Chats",
                icono: Inbox,
                contador: metricas.conversacionesAbiertas,
              },
              {
                id: "chat_equipo" as const,
                etiqueta: "Chat Equipo",
                cortoMovil: "Equipo",
                icono: MessageCircle,
              },
              {
                id: "simulador_ia" as const,
                etiqueta: "Simulador IA",
                cortoMovil: "Simular IA",
                icono: FlaskConical,
              },
              {
                id: "compras" as const,
                etiqueta: "Compras Web",
                cortoMovil: "Compras",
                icono: ShoppingBag,
                contador: metricas.totalComprasWeb,
              },
              {
                id: "usuarios" as const,
                etiqueta: "Usuarios y Clientes",
                cortoMovil: "Clientes",
                icono: Users,
                contador: tablero.usuariosYClientes.length,
              },
              {
                id: "ia_config" as const,
                etiqueta: "IA vs Humano & Plantillas",
                cortoMovil: "IA & Atajos",
                icono: BarChart3,
              },
            ] as const
          ).map((tab) => {
            const Icono = tab.icono;
            const activa = pestana === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setPestana(tab.id)}
                title={`Cambiar a vista ${tab.etiqueta}`}
                aria-label={tab.etiqueta}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: modoLayoutInbox === "movil" ? "5px" : "7px",
                  padding: modoLayoutInbox === "movil" ? "7px 10px" : "8px 14px",
                  minHeight: "36px",
                  borderRadius: "10px",
                  border: activa ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  background: activa ? "#1F1C19" : "var(--cf-f8f7f4, #F8F7F4)",
                  color: activa ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  fontSize: modoLayoutInbox === "movil" ? "0.76rem" : "0.83rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <Icono size={14} />
                <span>{modoLayoutInbox === "movil" ? tab.cortoMovil : tab.etiqueta}</span>
                {"contador" in tab && typeof tab.contador === "number" && (
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      fontSize: "0.7rem",
                      background: activa ? "rgba(255,255,255,0.2)" : "var(--cf-e6e2da, #E6E2DA)",
                      color: activa ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                    }}
                  >
                    {tab.contador}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <div
            className="ocultar-en-movil"
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.74rem",
              padding: "5px 10px",
              borderRadius: "9px",
              background: "var(--cf-f8f7f4, #F8F7F4)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              color: "var(--ct-57524c, #57524C)",
            }}
          >
            <span>
              ARIA: <strong style={{ color: "var(--ct-221e1b, #221E1B)" }}>{metricas.totalRespuestasAria}</strong>
            </span>
            <span style={{ color: "#D5CFC4" }}>|</span>
            <span>
              Humanas: <strong style={{ color: "var(--ct-221e1b, #221E1B)" }}>{metricas.totalIntervencionesHumanas}</strong>
            </span>
            <span style={{ color: "#D5CFC4" }}>|</span>
            <span>
              Ventas Web: <strong style={{ color: "var(--ct-221e1b, #221E1B)" }}>${metricas.montoTotalVentasUsd.toFixed(2)}</strong>
            </span>
          </div>

          {modoLayoutInbox !== "movil" && esAdminAplicacion && (
            <button
              type="button"
              className="btn-responsive-accion"
              disabled={sincronizandoFotosGoogle}
              onClick={() => void handleSincronizarFotosGoogle()}
              title="Traer fotos de perfil y nombres de tus contactos desde Google Contacts hacia los chats en vivo"
              aria-label="Fotos Google"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 11px",
                borderRadius: "9px",
                border: "1px solid var(--cb-bfdbfe, #BFDBFE)",
                background: "var(--cf-eef4ff, #EFF6FF)",
                color: "var(--ct-1e40af, #1E40AF)",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: sincronizandoFotosGoogle ? "wait" : "pointer",
              }}
            >
              {sincronizandoFotosGoogle ? <Loader2 size={14} /> : <Camera size={14} />}
              <span className="btn-texto-responsive">
                {sincronizandoFotosGoogle ? "Cargando…" : "Fotos Google"}
              </span>
            </button>
          )}

          {modoLayoutInbox !== "movil" && (
            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => void recargarTablero(false)}
              title="Sincronizar conversaciones, usuarios y compras en tiempo real"
              aria-label="Actualizar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "8px 12px",
                borderRadius: "9px",
                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                background: "var(--cf-ffffff, #FFFFFF)",
                color: "var(--ct-1f1c19, #1F1C19)",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
              <span className="btn-texto-responsive">Actualizar</span>
            </button>
          )}
        </div>
      </div>
      )}

      {tablero.usandoRespaldoHibrido && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "var(--cf-faf6ee, #FAF6EE)",
            border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
            color: "var(--ct-745622, #745622)",
            fontSize: "0.8rem",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            flexWrap: "wrap",
          }}
        >
          <AlertTriangle size={15} style={{ flexShrink: 0 }} />
          <span>
            <strong>Sincronización SQL pendiente:</strong> La transmisión instantánea en vivo está
            activa, pero para guardar permanentemente el historial de visitantes anónimos vuelve a
            ejecutar la versión actualizada de{" "}
            <code>20261115000007_omnicanal_chats_etiquetas_respuestas_y_ventas.sql</code> en el SQL
            Editor de Supabase
            {tablero.avisoMigracionSql ? ` (${tablero.avisoMigracionSql})` : ""}.
          </span>
        </div>
      )}

      {mensajeInfo && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "var(--cf-f2f6f3, #F2F6F3)",
            border: "1px solid var(--cb-ceddd3, #CEDDD3)",
            color: "var(--ct-2b4a36, #2B4A36)",
            fontSize: "0.82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{mensajeInfo}</span>
          <button
            type="button"
            onClick={() => setMensajeInfo(null)}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--ct-2b4a36, #2B4A36)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "var(--cf-faf2f2, #FAF2F2)",
            border: "1px solid var(--cb-e5caca, #E5CACA)",
            color: "var(--ct-8a2e2e, #8A2E2E)",
            fontSize: "0.82rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            title="Cerrar alerta"
            aria-label="Cerrar alerta"
            style={{
              border: "none",
              background: "transparent",
              color: "var(--ct-8a2e2e, #8A2E2E)",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            ✕
          </button>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA CHAT GRUPAL DEL EQUIPO (MENCIONES @KLEBER, FOTOS Y REENVÍO)
      ===================================================================== */}
      {pestana === "chat_equipo" && (
        <ChatEquipoInterno
          negocio={negNorm}
          embebido
          onAbrirConversacionCliente={handleAbrirConversacionDesdeEquipo}
        />
      )}

      {/* =====================================================================
          PESTAÑA SIMULADOR IA ARIA (PRUEBAS MULTI-TURNO CON REINICIO EN 1 CLIC)
      ===================================================================== */}
      {pestana === "simulador_ia" && <SimuladorChatAriaPanel negocio={negNorm} />}

      {/* =====================================================================
          PESTAÑA 1: BANDEJA UNIFICADA ESTILO MANYCHAT (FILTROS ARRIBA + 3 COLUMNAS AMPLIAS)
      ===================================================================== */}
      {pestana === "inbox" && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            height:
              modoLayoutInbox === "movil"
                ? vistaMovilInbox === "lista"
                  ? "calc(100dvh - 122px)"
                  : "calc(100dvh - 68px)"
                : "calc(100vh - 132px)",
            minHeight: modoLayoutInbox === "movil" ? "480px" : "580px",
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-221d1a-a110, rgba(34, 29, 26, 0.11))",
            borderRadius: modoLayoutInbox === "movil" ? "12px" : "16px",
            overflow: "hidden",
            boxShadow: "0 8px 26px rgba(34, 29, 26, 0.06)",
          }}
        >
          {/* BARRA SUPERIOR UNIFICADA DE CANALES, BÚSQUEDA, VISTAS, ETIQUETAS Y EQUIPO */}
          {(modoLayoutInbox !== "movil" || vistaMovilInbox === "lista") && (
            <div
              style={{
                background: "var(--cf-faf8f5, #FAF8F5)",
                borderBottom: "1px solid var(--cb-ece8e1, #ECE8E1)",
                padding: modoLayoutInbox === "movil" ? "8px 10px" : "8px 12px",
                display: "flex",
                flexDirection: "column",
                gap: "7px",
                flexShrink: 0,
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  flexWrap: "wrap",
                }}
              >
                {/* Buscador rápido */}
                <div
                  style={{
                    position: "relative",
                    flex: modoLayoutInbox === "movil" ? "1 1 160px" : "0 1 215px",
                    minWidth: "140px",
                  }}
                >
                  <Search
                    size={14}
                    style={{
                      position: "absolute",
                      left: "9px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "var(--ct-847d74, #847D74)",
                    }}
                  />
                  <input
                    type="search"
                    value={busquedaInbox}
                    onChange={(e) => setBusquedaInbox(e.target.value)}
                    placeholder="Buscar chat o teléfono…"
                    style={{
                      width: "100%",
                      padding: "6px 9px 6px 29px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      fontSize: modoLayoutInbox === "movil" ? "16px" : "0.78rem",
                    }}
                  />
                </div>

                {/* Selector Multi-Canal por Ícono (WhatsApp, Web, Facebook, Instagram, Telegram, TikTok) */}
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "3px",
                    background: "var(--cf-efece6, #EFECE6)",
                    padding: "3px",
                    borderRadius: "9px",
                    overflowX: "auto",
                    maxWidth: "100%",
                  }}
                >
                  <button
                    type="button"
                    onClick={() => setCanalFiltro("todos")}
                    title="Mostrar todos los canales conectados"
                    aria-label="Todos los canales"
                    style={{
                      padding: "4px 9px",
                      borderRadius: "7px",
                      border: "none",
                      background: canalFiltro === "todos" ? "var(--cf-ffffff, #FFFFFF)" : "transparent",
                      color: canalFiltro === "todos" ? "var(--ct-1f1c19, #1F1C19)" : "var(--ct-57524c, #57524C)",
                      fontSize: "0.72rem",
                      fontWeight: canalFiltro === "todos" ? 800 : 600,
                      boxShadow:
                        canalFiltro === "todos" ? "0 1px 2px rgba(15,23,42,0.1)" : "none",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    Todos
                  </button>
                  {CANALES_OMNICANAL_DISPONIBLES.map((c) => {
                    const activo = canalFiltro === c.id;
                    const conteoCanal = tablero.conversaciones.filter(
                      (conv) =>
                        conv.estadoAtencion !== "CERRADO" && (conv.canal || "web") === c.id
                    ).length;
                    return (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() =>
                          setCanalFiltro((prev) => (prev === c.id ? "todos" : c.id))
                        }
                        title={`Filtrar por ${c.nombre}${conteoCanal > 0 ? ` (${conteoCanal} abiertos)` : ""}`}
                        aria-label={`Canal ${c.nombre}`}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "4px 7px",
                          borderRadius: "7px",
                          border: "none",
                          background: activo ? "var(--cf-ffffff, #FFFFFF)" : "transparent",
                          color: activo ? "var(--ct-1f1c19, #1F1C19)" : "var(--ct-57524c, #57524C)",
                          fontSize: "0.71rem",
                          fontWeight: activo ? 800 : 600,
                          boxShadow: activo ? "0 1px 2px rgba(15,23,42,0.12)" : "none",
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                          opacity: conteoCanal === 0 && !activo && c.id !== "whatsapp" && c.id !== "web" ? 0.65 : 1,
                        }}
                      >
                        <IconoVectorCanal canal={c.id} size={15} />
                        {modoLayoutInbox !== "movil" && <span>{c.corto}</span>}
                        {conteoCanal > 0 && (
                          <span
                            style={{
                              fontSize: "0.66rem",
                              fontWeight: 800,
                              color: activo ? c.color : "var(--ct-847d74, #847D74)",
                            }}
                          >
                            {conteoCanal}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>

                {modoLayoutInbox === "movil" && (
                  <button
                    type="button"
                    onClick={() => setMostrarFiltrosInbox((v) => !v)}
                    title="Mostrar filtros de estado, etiquetas y asesores"
                    aria-label="Filtros"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "6px 9px",
                      borderRadius: "8px",
                      border: mostrarFiltrosInbox ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: mostrarFiltrosInbox ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                      color: mostrarFiltrosInbox ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Filter size={13} />
                    <span>Filtros</span>
                  </button>
                )}

                {/* Controles de Bandeja, No Leído, Etiquetas y Equipo (visibles siempre en desktop/tablet, desplegables en móvil) */}
                {(modoLayoutInbox !== "movil" || mostrarFiltrosInbox) && (
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      flexWrap: "wrap",
                      flex: modoLayoutInbox === "movil" ? "1 1 100%" : "1 1 auto",
                    }}
                  >
                    {/* Vista / Cola de atención */}
                    <SelectConBuscador
                      value={
                        filtroIzquierdo === "todos" && estadoAperturaFiltro === "todos"
                          ? "todos_historial"
                          : filtroIzquierdo
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        if (val === "todos_historial") {
                          setFiltroIzquierdo("todos");
                          setEstadoAperturaFiltro("todos");
                        } else if (val === "cerrados") {
                          setFiltroIzquierdo("cerrados");
                          setEstadoAperturaFiltro("cerrados");
                        } else {
                          setFiltroIzquierdo(val as FiltroBandejaIzquierda);
                          setEstadoAperturaFiltro("abiertos");
                        }
                      }}
                      aria-label="Vista de bandeja"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "var(--cf-ffffff, #FFFFFF)",
                        color: "var(--ct-221e1b, #221E1B)",
                      }}
                    >
                      <option value="todos">Abiertos ({metricas.conversacionesAbiertas})</option>
                      <option value="no_asignado">Sin asignar ({metricas.sinAsignar})</option>
                      <option value="mios">Asignado a mí</option>
                      <option value="escalados">
                        Requiere humano ({metricas.escaladasHumano})
                      </option>
                      <option value="ia_activa">IA ARIA ({metricas.atendidasPorIa})</option>
                      <option value="recordatorios">
                        Recordatorios ({metricas.conRecordatorio})
                      </option>
                      {esAdminAplicacion && (
                        <option value="privados">
                          🔒 Privados (
                          {
                            tablero.conversaciones.filter(
                              (c) =>
                                c.visibilidad === "SOLO_ADMIN" || c.visibilidad === "SOLO_TITULAR"
                            ).length
                          }
                          )
                        </option>
                      )}
                      <option value="cerrados">
                        Cerrados ({metricas.totalConversaciones - metricas.conversacionesAbiertas})
                      </option>
                      <option value="todos_historial">
                        Todos ({metricas.totalConversaciones})
                      </option>
                    </SelectConBuscador>

                    {/* Selector de Línea WhatsApp cuando hay múltiples celulares conectados */}
                    {(tablero.lineasWhatsapp?.length ?? 0) > 1 && (
                      <select
                        value={lineaWhatsappFiltroId}
                        onChange={(e) => setLineaWhatsappFiltroId(e.target.value)}
                        aria-label="Filtrar por teléfono WhatsApp"
                        title="Filtrar conversaciones por celular WhatsApp conectado"
                        style={{
                          padding: "5px 8px",
                          borderRadius: "8px",
                          border: lineaWhatsappFiltroId ? "1px solid #1D4ED8" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          background: lineaWhatsappFiltroId ? "var(--cf-eef4ff, #EEF4FF)" : "var(--cf-ffffff, #FFFFFF)",
                          color: lineaWhatsappFiltroId ? "var(--ct-1d4ed8, #1D4ED8)" : "var(--ct-221e1b, #221E1B)",
                        }}
                      >
                        <option value="">📱 Todas las líneas</option>
                        {(tablero.lineasWhatsapp ?? []).map((lw) => {
                          const dig = String(lw.numeroE164 || "").replace(/\D+/g, "");
                          const ult4 = dig.length >= 4 ? ` · ···${dig.slice(-4)}` : "";
                          return (
                            <option key={lw.id} value={lw.id}>
                              {lw.nombre}{ult4} ({lw.iaDesconocidosActiva ? "Auto" : "Manual"})
                            </option>
                          );
                        })}
                      </select>
                    )}

                    {/* Toggle No Leído */}
                    <button
                      type="button"
                      onClick={() => setSoloNoLeidos((v) => !v)}
                      title="Filtrar únicamente conversaciones con mensajes no leídos"
                      aria-label="No leído"
                      style={{
                        padding: "5px 9px",
                        borderRadius: "8px",
                        border: soloNoLeidos ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: soloNoLeidos ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                        color: soloNoLeidos ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      No leído
                    </button>

                    {/* Toggle rápido Chats Personales (Privados) */}
                    {esAdminAplicacion && (() => {
                      const cantPrivados = tablero.conversaciones.filter(
                        (c) =>
                          c.estadoAtencion !== "CERRADO" &&
                          (c.visibilidad === "SOLO_ADMIN" || c.visibilidad === "SOLO_TITULAR")
                      ).length;
                      const activoPrivados = filtroIzquierdo === "privados";
                      return (
                        <button
                          type="button"
                          onClick={() =>
                            setFiltroIzquierdo((prev) => (prev === "privados" ? "todos" : "privados"))
                          }
                          title="Ver únicamente tus chats personales (ocultos para los demás usuarios)"
                          aria-label="Chats Personales"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: activoPrivados
                              ? "1px solid #6B21A8"
                              : "1px solid var(--cb-ddd6fe, #DDD6FE)",
                            background: activoPrivados
                              ? "#6B21A8"
                              : "var(--cf-faf5ff, #FAF5FF)",
                            color: activoPrivados
                              ? "#FFFFFF"
                              : "var(--ct-6b21a8, #6B21A8)",
                            fontSize: "0.74rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          <Lock size={12} />
                          <span>Personales{cantPrivados > 0 ? ` (${cantPrivados})` : ""}</span>
                        </button>
                      );
                    })()}

                    {/* Filtro por Etiqueta de Clasificación */}
                    <SelectConBuscador
                      value={etiquetaFiltroId || ""}
                      onChange={(e) => setEtiquetaFiltroId(e.target.value || null)}
                      aria-label="Filtrar por etiqueta"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: etiquetaFiltroId ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.75rem",
                        fontWeight: etiquetaFiltroId ? 700 : 500,
                        background: etiquetaFiltroId ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                        color: "var(--ct-221e1b, #221E1B)",
                        maxWidth: "175px",
                      }}
                    >
                      <option value="">Etiquetas (Todas)</option>
                      {etiquetasClasificacion.map((etq) => (
                        <option key={etq.id} value={etq.id}>
                          {etq.nombre}
                        </option>
                      ))}
                    </SelectConBuscador>

                    {/* Filtro por Asesor / Operador */}
                    <SelectConBuscador
                      value={vendedorFiltroId || ""}
                      onChange={(e) => setVendedorFiltroId(e.target.value || null)}
                      aria-label="Filtrar por asesor"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: vendedorFiltroId ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.75rem",
                        fontWeight: vendedorFiltroId ? 700 : 500,
                        background: vendedorFiltroId ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                        color: "var(--ct-221e1b, #221E1B)",
                        maxWidth: "165px",
                      }}
                    >
                      <option value="">Equipo ({tablero.equipo.length})</option>
                      {tablero.equipo.map((m) => (
                        <option key={m.usuarioId} value={m.usuarioId}>
                          {m.usuarioId === tablero.usuarioActualId
                            ? `Tú (${m.nombre.split(" ")[0]})`
                            : m.nombre}{" "}
                          ({m.chatsActivos})
                        </option>
                      ))}
                    </SelectConBuscador>

                    {/* Botón Administrar Etiquetas — Exclusivo para Administrador y Operador */}
                    {Boolean(tablero.esAdminEtiquetas) && (
                      <button
                        type="button"
                        className="btn-responsive-accion"
                        onClick={() => setModalEtiquetasAbierto(true)}
                        title="Administrar etiquetas de clasificación de chats y clientes (Crear, editar, eliminar)"
                        aria-label="Etiquetas"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          color: "var(--ct-1f1c19, #1F1C19)",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          marginLeft: modoLayoutInbox === "desktop" ? "auto" : undefined,
                        }}
                      >
                        <Settings2 size={13} />
                        <span className="btn-texto-responsive">Etiquetas</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ÁREA PRINCIPAL DE 3 COLUMNAS (LISTA DE CHATS | TIMELINE EN VIVO | CAMPOS DE VENTA & FICHA) */}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              display: "grid",
              gridTemplateColumns:
                modoLayoutInbox === "desktop"
                  ? [
                      "286px",
                      "minmax(350px, 1fr)",
                      fichaDerechaDesktop ? "324px" : null,
                    ]
                      .filter(Boolean)
                      .join(" ")
                  : modoLayoutInbox === "tablet"
                    ? "262px minmax(0, 1fr)"
                    : "minmax(0, 1fr)",
            }}
          >
            {/* COLUMNA 1: LISTA DE CONVERSACIONES CON ÍCONO DE CANAL (SIN TEXTO DE CANAL) */}
            <div
              style={{
                borderRight: modoLayoutInbox !== "movil" ? "1px solid var(--cb-ece8e1, #ECE8E1)" : "none",
                display:
                  modoLayoutInbox !== "movil" || vistaMovilInbox === "lista" ? "flex" : "none",
                flexDirection: "column",
                background: "var(--cf-ffffff, #FFFFFF)",
                minWidth: 0,
                minHeight: 0,
              }}
            >
              {modoLayoutInbox === "movil" &&
                vistaMovilInbox === "lista" &&
                (pullOffsetPx > 0 || refrescandoPull) && (
                  <div
                    style={{
                      height: `${Math.max(refrescandoPull ? 44 : 0, pullOffsetPx)}px`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "7px",
                      background: "var(--cf-f8f7f4, #F8F7F4)",
                      borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      color: "var(--ct-57524c, #57524C)",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      overflow: "hidden",
                      transition: refrescandoPull ? "height 160ms ease" : "none",
                      flexShrink: 0,
                    }}
                  >
                    <RefreshCw size={14} />
                    <span>
                      {refrescandoPull
                        ? "Actualizando conversaciones…"
                        : pullOffsetPx >= 46
                          ? "Suelta para actualizar"
                          : "Desliza hacia abajo para actualizar"}
                    </span>
                  </div>
                )}

              <div
                ref={scrollListaRef}
                onTouchStart={iniciarPullMovil}
                onTouchMove={moverPullMovil}
                onTouchEnd={() => void finalizarPullMovil()}
                style={{
                  flex: 1,
                  overflowY: "auto",
                  overscrollBehaviorY: "contain",
                }}
              >
                {conversacionesFiltradas.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 18px",
                      textAlign: "center",
                      color: "var(--ct-847d74, #847D74)",
                      fontSize: "0.82rem",
                      lineHeight: 1.5,
                    }}
                  >
                    <MessageSquare
                      size={28}
                      style={{ margin: "0 auto 8px", opacity: 0.45, display: "block" }}
                    />
                    <strong>Sin conversaciones en este filtro</strong>
                    <p style={{ margin: "6px 0 0", fontSize: "0.76rem" }}>
                      Prueba cambiando el canal o el filtro superior para ver más chats.
                    </p>
                  </div>
                ) : (
                  gruposClientesFiltrados.map((grupo) => {
                    const conv = grupo.conversacionPrincipal;
                    const seleccionada = grupo.conversaciones.some(
                      (c) => c.id === conversacionActivaId
                    );
                    const convActivaEnGrupo =
                      grupo.conversaciones.find((c) => c.id === conversacionActivaId) ?? conv;
                    const tieneNoLeidos = grupo.noLeidosTotal > 0;
                    const etiquetasVisibles = grupo.etiquetasIds
                      .map((etqId) => mapaEtiquetas.get(etqId))
                      .filter((etq): etq is EtiquetaOmnicanal => Boolean(etq))
                      .slice(0, 2);
                    const esMulticanal = grupo.conversaciones.length > 1;

                    return (
                      <div
                        key={grupo.claveGrupo}
                        onClick={() => {
                          setConversacionActivaId(convActivaEnGrupo.id);
                          setMostrarFichaTablet(false);
                          setVistaMovilInbox("chat");
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setConversacionActivaId(convActivaEnGrupo.id);
                            setMostrarFichaTablet(false);
                            setVistaMovilInbox("chat");
                          }
                        }}
                        aria-current={seleccionada ? "true" : undefined}
                        style={{
                          padding: "10px 12px",
                          borderTop: seleccionada
                            ? "1px solid var(--cb-86efac, #86EFAC)"
                            : "none",
                          borderBottom: seleccionada
                            ? "1px solid var(--cb-86efac, #86EFAC)"
                            : "1px solid var(--cb-f4f2ee, #F4F2EE)",
                          background: seleccionada
                            ? "var(--cf-e6f4ec, #E6F4EC)"
                            : tieneNoLeidos
                              ? "var(--cf-f8f7f4, #F8F7F4)"
                              : "var(--cf-ffffff, #FFFFFF)",
                          borderLeft: seleccionada
                            ? "4px solid #15803D"
                            : tieneNoLeidos
                              ? "4px solid var(--cb-a39d94, #A39D94)"
                              : "4px solid transparent",
                          boxShadow: seleccionada
                            ? "inset 0 0 0 1px rgba(21, 128, 61, 0.14)"
                            : "none",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                          position: "relative",
                          transition: "background 0.15s ease, border-color 0.15s ease",
                        }}
                      >
                        <div
                          style={{
                            borderRadius: "999px",
                            flexShrink: 0,
                            boxShadow: seleccionada ? "0 0 0 2.5px #15803D" : "none",
                            transition: "box-shadow 0.15s ease",
                          }}
                        >
                          <AvatarConCanalOmnicanal
                            nombre={grupo.nombreMostrado}
                            canal={convActivaEnGrupo.canal}
                            fotoUrl={convActivaEnGrupo.remitenteFotoUrl || conv.remitenteFotoUrl}
                            size={38}
                          />
                        </div>

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                minWidth: 0,
                              }}
                            >
                                {seleccionada && (
                                  <span
                                    title="Conversación abierta actualmente"
                                    style={{
                                      width: "7px",
                                      height: "7px",
                                      borderRadius: "999px",
                                      background: "#15803D",
                                      boxShadow: "0 0 0 2px rgba(21, 128, 61, 0.25)",
                                      flexShrink: 0,
                                    }}
                                  />
                                )}
                                <strong
                                  title={`${grupo.nombreMostrado}${grupo.telefonoEstandar ? ` (${grupo.telefonoEstandar})` : ""}`}
                                  style={{
                                    fontSize: "0.83rem",
                                    fontWeight: seleccionada || tieneNoLeidos ? 800 : 600,
                                    color: seleccionada
                                      ? "var(--ct-14532d, #14532D)"
                                      : "var(--ct-221e1b, #221E1B)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap",
                                  }}
                                >
                                  {formatearNombreVisibleChat(
                                    grupo.nombreMostrado,
                                    grupo.telefonoEstandar || conv.remitenteTelefono
                                  )}
                                </strong>
                                {(conv.visibilidad === "SOLO_ADMIN" ||
                                  conv.visibilidad === "SOLO_TITULAR") && (
                                  <span
                                    title="Conversación privada (oculta a Ventas)"
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      padding: "1px 5px",
                                      borderRadius: "999px",
                                      background: "var(--cf-f3e8ff, #F3E8FF)",
                                      color: "var(--ct-6b21a8, #6B21A8)",
                                      fontSize: "0.63rem",
                                      fontWeight: 700,
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Lock size={9} />
                                  </span>
                                )}
                              {grupo.calificacionEstrellas != null &&
                                grupo.calificacionEstrellas > 0 && (
                                  <span
                                    title={`Calificación: ${grupo.calificacionEstrellas}/5`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "2px",
                                      fontSize: "0.66rem",
                                      fontWeight: 700,
                                      color: "var(--ct-b45309, #B45309)",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Star size={10} fill="#D97706" color="#D97706" />
                                    <span>{grupo.calificacionEstrellas}</span>
                                  </span>
                                )}
                              {grupo.notasCliente && (
                                <span
                                  title={`Nota del cliente: ${grupo.notasCliente}`}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    color: "var(--ct-745622, #745622)",
                                    flexShrink: 0,
                                  }}
                                >
                                  <StickyNote size={11} />
                                </span>
                              )}
                            </div>
                            <div
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                flexShrink: 0,
                              }}
                            >
                              {tieneNoLeidos && (
                                <span
                                  style={{
                                    minWidth: "18px",
                                    height: "18px",
                                    padding: "0 5px",
                                    borderRadius: "999px",
                                    background: "#221E1B",
                                    color: "#FFFFFF",
                                    fontSize: "0.67rem",
                                    fontWeight: 700,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {grupo.noLeidosTotal}
                                </span>
                              )}
                              <span style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                                {formatearTiempoCorto(conv.ultimoMensajeEn)}
                              </span>
                              {esAdminAplicacion && seleccionada && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setMenuCabeceraAbierto((prev) =>
                                      prev === "privacidad" ? null : "privacidad"
                                    );
                                  }}
                                  title="Convertir este chat en Personal (oculto a otros usuarios) o gestionar privacidad"
                                  aria-label={`Privacidad Personal de ${grupo.nombreMostrado}`}
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "6px",
                                    border:
                                      convActivaEnGrupo.visibilidad === "SOLO_TITULAR" ||
                                      convActivaEnGrupo.visibilidad === "SOLO_ADMIN"
                                        ? "1px solid #6B21A8"
                                        : "1px solid var(--cb-ddd6fe, #DDD6FE)",
                                    background:
                                      convActivaEnGrupo.visibilidad === "SOLO_TITULAR" ||
                                      convActivaEnGrupo.visibilidad === "SOLO_ADMIN"
                                        ? "#6B21A8"
                                        : "var(--cf-faf5ff, #FAF5FF)",
                                    color:
                                      convActivaEnGrupo.visibilidad === "SOLO_TITULAR" ||
                                      convActivaEnGrupo.visibilidad === "SOLO_ADMIN"
                                        ? "#FFFFFF"
                                        : "var(--ct-6b21a8, #6B21A8)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  <Lock size={11} />
                                </button>
                              )}
                              {esAdminAplicacion && seleccionada && (
                                <button
                                  type="button"
                                  onClick={(ev) => {
                                    ev.stopPropagation();
                                    setConversacionAEliminar(convActivaEnGrupo);
                                  }}
                                  title={`Eliminar conversación activa (${nombreLegibleCanal(convActivaEnGrupo.canal)}) de ${grupo.nombreMostrado}`}
                                  aria-label={`Eliminar chat de ${grupo.nombreMostrado}`}
                                  style={{
                                    width: "22px",
                                    height: "22px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                    background: "var(--cf-ffffff, #FFFFFF)",
                                    color: "var(--ct-847d74, #847D74)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    cursor: "pointer",
                                    padding: 0,
                                  }}
                                >
                                  <Trash2 size={12} />
                                </button>
                              )}
                              {seleccionada && (
                                <span
                                  aria-hidden="true"
                                  title="Chat abierto"
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    width: "20px",
                                    height: "20px",
                                    borderRadius: "999px",
                                    background: "#15803D",
                                    color: "#FFFFFF",
                                    flexShrink: 0,
                                  }}
                                >
                                  <ChevronRight size={13} />
                                </span>
                              )}
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: tieneNoLeidos ? "var(--ct-221e1b, #221E1B)" : "var(--ct-6e6861, #6E6861)",
                              fontWeight: tieneNoLeidos ? 600 : 400,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {conv.ultimoMensajeOrigen === "BOT_ARIA" && "ARIA · "}
                            {limpiarVistaPreviaMensajeOmnicanal(conv.ultimoMensajeTexto)}
                          </div>

                          {esMulticanal && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                flexWrap: "wrap",
                                marginTop: "2px",
                              }}
                            >
                              {grupo.canalesActivos.map((canalItem) => {
                                const hilosCanal = grupo.conversaciones.filter(
                                  (c) => (c.canal || "web") === canalItem
                                );
                                const hiloDestino = hilosCanal[0];
                                if (!hiloDestino) return null;
                                const activoEsteCanal =
                                  seleccionada &&
                                  (convActivaEnGrupo.canal || "web") === canalItem;
                                const noLeidosCanal = hilosCanal.reduce(
                                  (acc, h) => acc + Number(h.noLeidosAsesora || 0),
                                  0
                                );
                                return (
                                  <button
                                    key={canalItem}
                                    type="button"
                                    onClick={(ev) => {
                                      ev.stopPropagation();
                                      setConversacionActivaId(hiloDestino.id);
                                      setMostrarFichaTablet(false);
                                      setVistaMovilInbox("chat");
                                    }}
                                    title={`Abrir canal ${nombreLegibleCanal(canalItem)} de ${grupo.nombreMostrado}`}
                                    aria-label={`Canal ${nombreLegibleCanal(canalItem)}`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      border: activoEsteCanal
                                        ? "1px solid var(--cb-221e1b, #221E1B)"
                                        : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                      background: activoEsteCanal ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                                      color: activoEsteCanal ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                                      fontSize: "0.64rem",
                                      fontWeight: 700,
                                      cursor: "pointer",
                                    }}
                                  >
                                    <IconoVectorCanal canal={canalItem} size={11} />
                                    <span>
                                      {canalItem === "whatsapp"
                                        ? "WhatsApp"
                                        : canalItem === "web"
                                          ? "Web"
                                          : nombreLegibleCanal(canalItem)}
                                      {hilosCanal.length > 1 ? ` (${hilosCanal.length})` : ""}
                                    </span>
                                    {noLeidosCanal > 0 && !activoEsteCanal && (
                                      <span
                                        style={{
                                          minWidth: "13px",
                                          height: "13px",
                                          padding: "0 3px",
                                          borderRadius: "999px",
                                          background: "#221E1B",
                                          color: "#FFFFFF",
                                          fontSize: "0.58rem",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                        }}
                                      >
                                        {noLeidosCanal}
                                      </span>
                                    )}
                                  </button>
                                );
                              })}
                            </div>
                          )}

                          {(() => {
                            const lineaWaItem = resolverLineaWhatsappConversacion(
                              convActivaEnGrupo,
                              tablero.lineasWhatsapp
                            );
                            const mostrarFilaChips =
                              Boolean(lineaWaItem) ||
                              conv.estadoAtencion === "ESCALADO_HUMANO" ||
                              conv.estadoAtencion === "EN_ATENCION_ASESORA" ||
                              (conv.estadoAtencion === "CERRADO" && Boolean(conv.cierre?.motivoEtiqueta)) ||
                              Boolean(conv.recordatorioEn) ||
                              etiquetasVisibles.length > 0;
                            if (!mostrarFilaChips) return null;
                            return (
                              <div
                                style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  flexWrap: "wrap",
                                  marginTop: "1px",
                                }}
                              >
                                {lineaWaItem && (
                                  <span
                                    title={`Línea WhatsApp: ${lineaWaItem.nombre}${
                                      lineaWaItem.numero ? ` (${lineaWaItem.numero})` : ""
                                    }`}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      fontSize: "0.63rem",
                                      fontWeight: 700,
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      background: `${lineaWaItem.color}16`,
                                      color: lineaWaItem.color,
                                      border: `1px solid ${lineaWaItem.color}40`,
                                      maxWidth: "155px",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap",
                                    }}
                                  >
                                    <Smartphone size={9} style={{ flexShrink: 0 }} />
                                    <span
                                      style={{
                                        overflow: "hidden",
                                        textOverflow: "ellipsis",
                                        whiteSpace: "nowrap",
                                      }}
                                    >
                                      {lineaWaItem.nombre}
                                      {lineaWaItem.ultimos4 ? ` · ${lineaWaItem.ultimos4}` : ""}
                                    </span>
                                  </span>
                                )}
                              {conv.recordatorioEn && (() => {
                                const vencido =
                                  new Date(conv.recordatorioEn).getTime() <= ahoraMsTick;
                                return (
                                  <span
                                    title={`Recordatorio: ${new Date(
                                      conv.recordatorioEn
                                    ).toLocaleString("es-EC", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}${conv.recordatorioNota ? ` · ${conv.recordatorioNota}` : ""}`}
                                    style={{
                                      fontSize: "0.64rem",
                                      fontWeight: 600,
                                      padding: "1px 6px",
                                      borderRadius: "999px",
                                      background: vencido ? "var(--cf-faf6ec, #FAF6EC)" : "var(--cf-f4f2ee, #F4F2EE)",
                                      color: vencido ? "var(--ct-745622, #745622)" : "var(--ct-6e6861, #6E6861)",
                                      border: vencido ? "1px solid var(--cb-e8dec6, #E8DEC6)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                    }}
                                  >
                                    {vencido
                                      ? "Seguimiento"
                                      : new Date(conv.recordatorioEn).toLocaleTimeString(
                                          "es-EC",
                                          { hour: "2-digit", minute: "2-digit" }
                                        )}
                                  </span>
                                );
                              })()}

                              {conv.estadoAtencion === "CERRADO" && conv.cierre?.motivoEtiqueta && (
                                <span
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "var(--cf-f4f2ee, #F4F2EE)",
                                    color: "var(--ct-6e6861, #6E6861)",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  }}
                                >
                                  {conv.cierre.motivoEtiqueta}
                                </span>
                              )}

                              {conv.estadoAtencion === "ESCALADO_HUMANO" && (
                                <span
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "var(--cf-faf2f2, #FAF2F2)",
                                    color: "var(--ct-8a2e2e, #8A2E2E)",
                                    border: "1px solid var(--cb-e5caca, #E5CACA)",
                                  }}
                                >
                                  Humano
                                </span>
                              )}

                              {conv.estadoAtencion === "EN_ATENCION_ASESORA" && (
                                <span
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "var(--cf-f4f2ee, #F4F2EE)",
                                    color: "var(--ct-57524c, #57524C)",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  }}
                                >
                                  {conv.asesoraNombre?.split(" ")[0] || "Manual"}
                                </span>
                              )}

                              {etiquetasVisibles.map((etq) => (
                                <span
                                  key={etq.id}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    fontSize: "0.64rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "var(--cf-f8f7f4, #F8F7F4)",
                                    color: "var(--ct-57524c, #57524C)",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  }}
                                >
                                  <span
                                    style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "999px",
                                      background: etq.color,
                                      flexShrink: 0,
                                    }}
                                  />
                                  <span>{etq.nombre}</span>
                                </span>
                              ))}
                              </div>
                            );
                          })()}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

          {/* COLUMNA 3: VISOR DE CONVERSACIÓN EN VIVO Y COMPOSITOR DE RESPUESTA HUMANA */}
          <div
            style={{
              borderRight:
                modoLayoutInbox === "desktop" && fichaDerechaDesktop
                  ? "1px solid var(--cb-ece8e1, #ECE8E1)"
                  : "none",
              display:
                modoLayoutInbox === "desktop" ||
                (modoLayoutInbox === "tablet" && !mostrarFichaTablet) ||
                (modoLayoutInbox === "movil" && vistaMovilInbox === "chat")
                  ? "flex"
                  : "none",
              flexDirection: "column",
              background: "var(--cf-f6f4ef, #F6F4EF)",
              minWidth: 0,
              minHeight: 0,
            }}
          >
            {!conversacionActiva ? (
              <div
                style={{
                  flex: 1,
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  padding: "clamp(20px, 5vw, 36px)",
                  textAlign: "center",
                  color: "var(--ct-57524c, #57524C)",
                }}
              >
                {modoLayoutInbox === "movil" && (
                  <button
                    type="button"
                    onClick={() => setVistaMovilInbox("lista")}
                    title="Volver a la lista de hilos"
                    aria-label="Volver a hilos"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "6px 12px",
                      marginBottom: "16px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-1f1c19, #1F1C19)",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Hilos</span>
                  </button>
                )}
                <Sparkles size={40} style={{ color: "var(--ct-221e1b, #221E1B)", marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px", fontSize: "0.9rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                  Monitoreo Omnicanal de Ventas e IA ARIA
                </h3>
                <p style={{ margin: 0, maxWidth: "400px", fontSize: "0.84rem", lineHeight: 1.55 }}>
                  Selecciona una conversación o abre el seguimiento de un cliente
                  desde las pestañas <strong>Compras Web</strong> o{" "}
                  <strong>Usuarios y Clientes</strong>.
                </p>
              </div>
            ) : (
              <>
                {/* Cabecera Optimizada Mobile-First + ManyChat: Fila Táctil en Móvil + Bottom Sheet / Popovers */}
                <div
                  style={{
                    background: "var(--cf-ffffff, #FFFFFF)",
                    padding: modoLayoutInbox === "movil" ? "8px 10px" : "9px 14px",
                    borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    display: "flex",
                    flexDirection: "column",
                    gap: modoLayoutInbox === "movil" ? "7px" : "6px",
                    position: "relative",
                    zIndex: 25,
                  }}
                >
                  {/* Backdrop transparente click-outside en Desktop/Tablet para cerrar popovers con un clic */}
                  {modoLayoutInbox !== "movil" && menuCabeceraAbierto !== null && (
                    <div
                      aria-hidden="true"
                      onClick={() => {
                        setMenuCabeceraAbierto(null);
                        setMostrarSelectorFechaCustom(false);
                      }}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 35,
                        background: "transparent",
                      }}
                    />
                  )}

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: modoLayoutInbox === "movil" ? "nowrap" : "wrap",
                      gap: "6px",
                    }}
                  >
                    {/* Izquierda: Flecha atrás (móvil) + Avatar + Nombre + Estado + Selector de asesor */}
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        minWidth: 0,
                        flex: 1,
                      }}
                    >
                      {modoLayoutInbox === "movil" && (
                        <button
                          type="button"
                          onClick={() => {
                            setMenuCabeceraAbierto(null);
                            setVistaMovilInbox("lista");
                          }}
                          title="Volver a la lista de conversaciones"
                          aria-label="Volver a lista"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "36px",
                            height: "36px",
                            borderRadius: "10px",
                            border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            background: "var(--cf-f8f7f4, #F8F7F4)",
                            color: "var(--ct-1f1c19, #1F1C19)",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <ArrowLeft size={16} />
                        </button>
                      )}

                      <button
                        type="button"
                        onClick={() =>
                          setModalFichaClienteContexto({
                            conversacion: conversacionActiva,
                            contactoDirectorio: contactoVinculadoActivo,
                          })
                        }
                        title="Clic para abrir y editar ficha del cliente (nombre, WhatsApp, estrellas y notas)"
                        aria-label={`Ver información de ${conversacionActiva.remitenteNombre}`}
                        style={{
                          border: "none",
                          background: "transparent",
                          padding: 0,
                          cursor: "pointer",
                          flexShrink: 0,
                          display: "inline-flex",
                          borderRadius: "999px",
                        }}
                      >
                        <AvatarConCanalOmnicanal
                          nombre={conversacionActiva.remitenteNombre}
                          canal={conversacionActiva.canal}
                          fotoUrl={conversacionActiva.remitenteFotoUrl}
                          size={34}
                        />
                      </button>

                      <div style={{ minWidth: 0, flex: 1, display: "flex", flexDirection: "column", gap: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "nowrap", minWidth: 0 }}>
                          <button
                            type="button"
                            onClick={() =>
                              setModalFichaClienteContexto({
                                conversacion: conversacionActiva,
                                contactoDirectorio: contactoVinculadoActivo,
                              })
                            }
                            title="Clic para abrir y editar ficha del cliente (nombre, WhatsApp, estrellas y notas)"
                            aria-label={`Editar ficha de ${conversacionActiva.remitenteNombre}`}
                            style={{
                              border: "none",
                              background: "transparent",
                              padding: "1px 4px",
                              marginLeft: "-4px",
                              borderRadius: "6px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              minWidth: 0,
                              maxWidth: modoLayoutInbox === "movil" ? "180px" : "290px",
                            }}
                          >
                            <strong
                              style={{
                                fontSize: "0.88rem",
                                color: "var(--ct-1f1c19, #1F1C19)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {formatearNombreVisibleChat(
                                grupoClienteActivo?.nombreMostrado ||
                                  conversacionActiva.remitenteNombre,
                                conversacionActiva.remitenteTelefono
                              )}
                            </strong>
                            <Pencil
                              size={12}
                              style={{ color: "var(--ct-847d74, #847D74)", flexShrink: 0 }}
                            />
                          </button>

                          {conversacionActiva.fichaCliente?.calificacionEstrellas != null &&
                            conversacionActiva.fichaCliente.calificacionEstrellas > 0 && (
                              <button
                                type="button"
                                onClick={() =>
                                  setModalFichaClienteContexto({
                                    conversacion: conversacionActiva,
                                    contactoDirectorio: contactoVinculadoActivo,
                                  })
                                }
                                title={`Calificación: ${conversacionActiva.fichaCliente.calificacionEstrellas}/5 estrellas (clic para editar)`}
                                aria-label={`${conversacionActiva.fichaCliente.calificacionEstrellas} estrellas`}
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  border: "1px solid var(--cb-e8dec6, #E8DEC6)",
                                  background: "var(--cf-fffbeb, #FFFBEB)",
                                  color: "var(--ct-b45309, #B45309)",
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "2px",
                                  cursor: "pointer",
                                  flexShrink: 0,
                                }}
                              >
                                <Star size={10} fill="#D97706" color="#D97706" />
                                <span>{conversacionActiva.fichaCliente.calificacionEstrellas}</span>
                              </button>
                            )}

                          {(() => {
                            const b = badgeEstadoAtencion(conversacionActiva.estadoAtencion);
                            return (
                              <span
                                style={{
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  background: b.fondo,
                                  color: b.texto,
                                  border: `1px solid ${b.borde}`,
                                  whiteSpace: "nowrap",
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  maxWidth: modoLayoutInbox === "movil" ? "118px" : undefined,
                                }}
                              >
                                {conversacionActiva.estadoAtencion === "CERRADO" &&
                                conversacionActiva.cierre?.motivoEtiqueta
                                  ? conversacionActiva.cierre.motivoEtiqueta
                                  : b.etiqueta}
                              </span>
                            );
                          })()}
                        </div>

                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          {(() => {
                            const lineaActiva = resolverLineaWhatsappConversacion(
                              conversacionActiva,
                              tablero.lineasWhatsapp
                            );
                            if (!lineaActiva) return null;
                            return (
                              <span
                                title={`Línea WhatsApp del negocio: ${lineaActiva.nombre}${
                                  lineaActiva.numero ? ` (${lineaActiva.numero})` : ""
                                }`}
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "1px 7px",
                                  borderRadius: "999px",
                                  background: `${lineaActiva.color}16`,
                                  color: lineaActiva.color,
                                  border: `1px solid ${lineaActiva.color}45`,
                                  fontSize: "0.67rem",
                                  fontWeight: 700,
                                  whiteSpace: "nowrap",
                                }}
                              >
                                <Smartphone size={10} />
                                <span>
                                  {lineaActiva.nombre}
                                  {lineaActiva.numero
                                    ? modoLayoutInbox === "movil"
                                      ? ` · ${lineaActiva.ultimos4}`
                                      : ` · ${lineaActiva.numero}`
                                    : ""}
                                </span>
                              </span>
                            );
                          })()}

                          {conversacionActiva.remitenteTelefono &&
                            !formatearNombreVisibleChat(
                              grupoClienteActivo?.nombreMostrado ||
                                conversacionActiva.remitenteNombre,
                              conversacionActiva.remitenteTelefono
                            ).includes(
                              conversacionActiva.remitenteTelefono.replace(/\D+/g, "").slice(-7)
                            ) && (
                              <span
                                title={`Número del cliente: ${conversacionActiva.remitenteTelefono}`}
                                style={{
                                  fontSize: "0.68rem",
                                  fontWeight: 600,
                                  color: "var(--ct-6e6861, #6E6861)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {conversacionActiva.remitenteTelefono}
                              </span>
                            )}

                          <button
                            type="button"
                            onClick={() => {
                              setMenuCabeceraAbierto(null);
                              setMostrarMenuRespuestas(false);
                              setVistaMenuOpciones("asignar");
                              setMostrarMenuAdjuntar(true);
                            }}
                            title="Cambiar asignación de este chat (también disponible en Opciones)"
                            aria-label="Asignar conversación"
                            style={{
                              padding: "1px 7px",
                              borderRadius: "999px",
                              border: conversacionActiva.asesoraAsignadaId
                                ? "1px solid var(--cb-d5cfc4, #D5CFC4)"
                                : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: conversacionActiva.asesoraAsignadaId
                                ? "var(--cf-f4f2ee, #F4F2EE)"
                                : "var(--cf-f8f7f4, #F8F7F4)",
                              color: conversacionActiva.asesoraAsignadaId ? "var(--ct-221e1b, #221E1B)" : "var(--ct-847d74, #847D74)",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <UserCheck size={11} />
                            <span>
                              {conversacionActiva.asesoraAsignadaId
                                ? conversacionActiva.asesoraAsignadaId === tablero.usuarioActualId
                                  ? "Asignado a mí"
                                  : conversacionActiva.asesoraNombre?.split(" ")[0] || "Asignado"
                                : "Sin asignar"}
                            </span>
                          </button>

                          {conversacionActiva.fichaCliente?.notasCliente && (
                            <button
                              type="button"
                              onClick={() =>
                                setModalFichaClienteContexto({
                                  conversacion: conversacionActiva,
                                  contactoDirectorio: contactoVinculadoActivo,
                                })
                              }
                              title={`Nota interna del cliente: ${conversacionActiva.fichaCliente.notasCliente} (clic para editar)`}
                              aria-label="Ver notas del cliente"
                              style={{
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                padding: "1px 7px",
                                borderRadius: "999px",
                                background: "var(--cf-faf6ec, #FAF6EC)",
                                color: "var(--ct-745622, #745622)",
                                border: "1px solid var(--cb-e8dec6, #E8DEC6)",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                maxWidth: modoLayoutInbox === "movil" ? "170px" : "260px",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <StickyNote size={10} style={{ flexShrink: 0 }} />
                              <span
                                style={{
                                  overflow: "hidden",
                                  textOverflow: "ellipsis",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {conversacionActiva.fichaCliente.notasCliente}
                              </span>
                            </button>
                          )}

                          {conversacionActiva.recordatorioEn && (() => {
                            const vencido =
                              new Date(conversacionActiva.recordatorioEn).getTime() <= ahoraMsTick;
                            return (
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  fontWeight: 600,
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: vencido ? "var(--cf-faf6ec, #FAF6EC)" : "var(--cf-f4f2ee, #F4F2EE)",
                                  color: vencido ? "var(--ct-745622, #745622)" : "var(--ct-6e6861, #6E6861)",
                                  border: vencido ? "1px solid var(--cb-e8dec6, #E8DEC6)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  whiteSpace: "nowrap",
                                }}
                              >
                                {vencido
                                  ? "Seguimiento"
                                  : new Date(
                                      conversacionActiva.recordatorioEn
                                    ).toLocaleString("es-EC", {
                                      dateStyle: "short",
                                      timeStyle: "short",
                                    })}
                              </span>
                            );
                          })()}
                        </div>
                      </div>
                    </div>

                    {/* En móvil: botón directo a Campos de Venta / Datos arriba a la derecha */}
                    {modoLayoutInbox === "movil" && (
                      <button
                        type="button"
                        onClick={() => {
                          setMenuCabeceraAbierto(null);
                          setVistaMovilInbox("ficha");
                        }}
                        title="Abrir Campos de Venta (Pedido, Entrega, Tarjeta) y Ficha del Cliente"
                        aria-label="Datos de Venta"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "5px",
                          height: "36px",
                          padding: "0 11px",
                          borderRadius: "10px",
                          border: "1px solid var(--cb-1f1c19, #1F1C19)",
                          background: "#1F1C19",
                          color: "#FFFFFF",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          flexShrink: 0,
                        }}
                      >
                        <ClipboardList size={14} />
                        <span>Datos</span>
                      </button>
                    )}

                    {/* En Desktop / Tablet: Barra de Acciones en la misma fila derecha */}
                    {modoLayoutInbox !== "movil" && (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          flexWrap: "wrap",
                          position: "relative",
                          zIndex: 40,
                        }}
                      >
                        {/* 1. GESTIONAR ETIQUETAS (Desktop/Tablet Popover) */}
                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={() =>
                              setMenuCabeceraAbierto((prev) =>
                                prev === "etiquetas" ? null : "etiquetas"
                              )
                            }
                            title="Gestionar etiquetas de esta conversación"
                            aria-label="Etiquetas"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              border:
                                menuCabeceraAbierto === "etiquetas"
                                  ? "1px solid var(--cb-1f1c19, #1F1C19)"
                                  : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background:
                                menuCabeceraAbierto === "etiquetas" ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                              color: "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            <Tag size={15} />
                          </button>

                          {menuCabeceraAbierto === "etiquetas" && (
                            <div
                              style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                right: 0,
                                width: "232px",
                                maxWidth: "calc(100vw - 24px)",
                                background: "var(--cf-ffffff, #FFFFFF)",
                                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                borderRadius: "12px",
                                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
                                padding: "8px 0",
                                zIndex: 45,
                              }}
                            >
                              <div
                                style={{
                                  padding: "4px 12px 6px",
                                  fontSize: "0.73rem",
                                  fontWeight: 700,
                                  color: "var(--ct-847d74, #847D74)",
                                  borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                }}
                              >
                                Gestionar etiquetas
                              </div>
                              <div style={{ maxHeight: "240px", overflowY: "auto", padding: "4px 0" }}>
                                {etiquetasClasificacion.map((etq) => {
                                  const puesta = (conversacionActiva.etiquetasIds ?? []).includes(
                                    etq.id
                                  );
                                  return (
                                    <button
                                      key={etq.id}
                                      type="button"
                                      onClick={() => void handleAlternarEtiqueta(etq.id)}
                                      style={{
                                        width: "100%",
                                        padding: "7px 12px",
                                        border: "none",
                                        background: puesta ? "var(--cf-f8f7f4, #F8F7F4)" : "var(--cf-ffffff, #FFFFFF)",
                                        display: "flex",
                                        alignItems: "center",
                                        gap: "9px",
                                        cursor: "pointer",
                                        textAlign: "left",
                                        fontSize: "0.8rem",
                                        color: "var(--ct-1f1c19, #1F1C19)",
                                        fontWeight: puesta ? 700 : 500,
                                      }}
                                    >
                                      <span
                                        style={{
                                          width: "16px",
                                          height: "16px",
                                          borderRadius: "4px",
                                          border: puesta
                                            ? "1.5px solid var(--cb-221e1b, #221E1B)"
                                            : "1.5px solid var(--cb-d5cfc4, #D5CFC4)",
                                          background: puesta ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                                          color: "#FFFFFF",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          flexShrink: 0,
                                        }}
                                      >
                                        {puesta && <Check size={11} />}
                                      </span>
                                      <span
                                        style={{
                                          width: "8px",
                                          height: "8px",
                                          borderRadius: "999px",
                                          background: etq.color,
                                          flexShrink: 0,
                                        }}
                                      />
                                      <span style={{ flex: 1 }}>
                                        {etq.icono} {etq.nombre}
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                              {Boolean(tablero.esAdminEtiquetas) && (
                                <div
                                  style={{
                                    borderTop: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                    padding: "6px 10px 2px",
                                  }}
                                >
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setMenuCabeceraAbierto(null);
                                      setModalEtiquetasAbierto(true);
                                    }}
                                    style={{
                                      width: "100%",
                                      padding: "6px 8px",
                                      borderRadius: "7px",
                                      border: "none",
                                      background: "var(--cf-f8f7f4, #F8F7F4)",
                                      color: "var(--ct-1f1c19, #1F1C19)",
                                      fontSize: "0.75rem",
                                      fontWeight: 700,
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "6px",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <Settings2 size={13} />
                                    <span>+ Nueva / Administrar</span>
                                  </button>
                                </div>
                              )}
                            </div>
                          )}
                        </div>

                        {/* 2. RECUÉRDAMELO EN (Desktop/Tablet Popover) */}
                        <div style={{ position: "relative" }}>
                          <button
                            type="button"
                            onClick={() => {
                              setMenuCabeceraAbierto((prev) =>
                                prev === "recordatorio" ? null : "recordatorio"
                              );
                              setMostrarSelectorFechaCustom(false);
                            }}
                            title="Recuérdamelo en… (programar seguimiento del cliente)"
                            aria-label="Recuérdamelo en"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              border: conversacionActiva.recordatorioEn
                                ? "1px solid #8F6A2E"
                                : menuCabeceraAbierto === "recordatorio"
                                  ? "1px solid var(--cb-1f1c19, #1F1C19)"
                                  : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: conversacionActiva.recordatorioEn
                                ? "var(--cf-faf6ee, #FAF6EE)"
                                : menuCabeceraAbierto === "recordatorio"
                                  ? "var(--cf-f4f2ee, #F4F2EE)"
                                  : "var(--cf-ffffff, #FFFFFF)",
                              color: conversacionActiva.recordatorioEn ? "var(--ct-745622, #745622)" : "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            <Clock size={15} />
                          </button>

                          {menuCabeceraAbierto === "recordatorio" && (
                            <div
                              style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                right: 0,
                                width: "240px",
                                maxWidth: "calc(100vw - 24px)",
                                background: "var(--cf-ffffff, #FFFFFF)",
                                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                borderRadius: "12px",
                                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.14)",
                                padding: "8px 0",
                                zIndex: 45,
                              }}
                            >
                              <div
                                style={{
                                  padding: "4px 12px 6px",
                                  fontSize: "0.73rem",
                                  fontWeight: 700,
                                  color: "var(--ct-847d74, #847D74)",
                                  borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                }}
                              >
                                Recuérdamelo en
                              </div>

                              {OPCIONES_RECORDATORIO_RAPIDO_OMNICANAL.map((op) => (
                                <button
                                  key={op.clave}
                                  type="button"
                                  onClick={() => void handleProgramarRecordatorioRapido(op.clave)}
                                  style={{
                                    width: "100%",
                                    padding: "7px 12px",
                                    border: "none",
                                    background: "var(--cf-ffffff, #FFFFFF)",
                                    textAlign: "left",
                                    fontSize: "0.8rem",
                                    color: "var(--ct-1f1c19, #1F1C19)",
                                    fontWeight: 500,
                                    cursor: "pointer",
                                  }}
                                >
                                  {op.etiqueta}
                                </button>
                              ))}

                              <div
                                style={{
                                  borderTop: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                  marginTop: "4px",
                                  paddingTop: "4px",
                                }}
                              >
                                <button
                                  type="button"
                                  onClick={() => setMostrarSelectorFechaCustom((v) => !v)}
                                  style={{
                                    width: "100%",
                                    padding: "7px 12px",
                                    border: "none",
                                    background: mostrarSelectorFechaCustom ? "var(--cf-f8f7f4, #F8F7F4)" : "var(--cf-ffffff, #FFFFFF)",
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "7px",
                                    fontSize: "0.79rem",
                                    fontWeight: 700,
                                    color: "var(--ct-1f1c19, #1F1C19)",
                                    cursor: "pointer",
                                  }}
                                >
                                  <Calendar size={13} />
                                  <span>Elegir fecha y hora</span>
                                </button>

                                {mostrarSelectorFechaCustom && (
                                  <div
                                    style={{
                                      padding: "8px 12px",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                      background: "var(--cf-f8f7f4, #F8F7F4)",
                                    }}
                                  >
                                    <input
                                      type="datetime-local"
                                      value={recordatorioFecha}
                                      onChange={(e) => setRecordatorioFecha(e.target.value)}
                                      style={{
                                        width: "100%",
                                        padding: "5px 7px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                    <input
                                      type="text"
                                      value={recordatorioNota}
                                      onChange={(e) => setRecordatorioNota(e.target.value)}
                                      placeholder="Nota opcional (ej. confirmar pago)…"
                                      style={{
                                        width: "100%",
                                        padding: "5px 7px",
                                        borderRadius: "6px",
                                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                        fontSize: "0.75rem",
                                      }}
                                    />
                                    <button
                                      type="button"
                                      disabled={!recordatorioFecha}
                                      onClick={() => void handleGuardarRecordatorio()}
                                      style={{
                                        padding: "6px 10px",
                                        borderRadius: "6px",
                                        border: "none",
                                        background: "#1F1C19",
                                        color: "#FFFFFF",
                                        fontSize: "0.75rem",
                                        fontWeight: 700,
                                        cursor: recordatorioFecha ? "pointer" : "not-allowed",
                                        opacity: recordatorioFecha ? 1 : 0.5,
                                      }}
                                    >
                                      Programar
                                    </button>
                                  </div>
                                )}

                                {conversacionActiva.recordatorioEn && (
                                  <button
                                    type="button"
                                    onClick={() => void handleLimpiarRecordatorio()}
                                    style={{
                                      width: "100%",
                                      padding: "7px 12px",
                                      border: "none",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                      textAlign: "left",
                                      fontSize: "0.76rem",
                                      fontWeight: 700,
                                      color: "var(--ct-8a2e2e, #8A2E2E)",
                                      cursor: "pointer",
                                    }}
                                  >
                                    ✕ Quitar recordatorio actual
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 3. MARCAR COMO CERRADO / REABRIR (Desktop/Tablet Popover) */}
                        <div style={{ position: "relative" }}>
                          {conversacionActiva.estadoAtencion !== "CERRADO" ? (
                            <button
                              type="button"
                              onClick={() =>
                                setMenuCabeceraAbierto((prev) =>
                                  prev === "cierre" ? null : "cierre"
                                )
                              }
                              title="Marcar como Cerrado (seleccionar motivo de cierre)"
                              aria-label="Marcar como Cerrado"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                width: "34px",
                                height: "34px",
                                borderRadius: "8px",
                                border:
                                  menuCabeceraAbierto === "cierre"
                                    ? "1px solid var(--cb-1f1c19, #1F1C19)"
                                    : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                background:
                                  menuCabeceraAbierto === "cierre" ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                                color: "var(--ct-57524c, #57524C)",
                                cursor: "pointer",
                              }}
                            >
                              <CheckCircle2 size={15} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              className="btn-responsive-accion"
                              onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                              title="Marcar como Conversación Abierta (reabrir chat)"
                              aria-label="Conversación Abierta"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "6px 9px",
                                borderRadius: "8px",
                                border: "1px solid #2F4737",
                                background: "var(--cf-f2f6f3, #F2F6F3)",
                                color: "var(--ct-2f4737, #2F4737)",
                                fontSize: "0.73rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              <RotateCcw size={13} />
                              <span className="btn-texto-responsive">Abrir chat</span>
                            </button>
                          )}

                          {menuCabeceraAbierto === "cierre" && (
                            <div
                              style={{
                                position: "absolute",
                                top: "calc(100% + 6px)",
                                right: 0,
                                width: "272px",
                                maxWidth: "calc(100vw - 24px)",
                                background: "var(--cf-ffffff, #FFFFFF)",
                                border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                borderRadius: "12px",
                                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                                padding: "8px 0",
                                zIndex: 45,
                              }}
                            >
                              <div
                                style={{
                                  padding: "4px 12px 6px",
                                  fontSize: "0.73rem",
                                  fontWeight: 700,
                                  color: "var(--ct-1f1c19, #1F1C19)",
                                  borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                }}
                              >
                                Cerrar chat · Selecciona el motivo
                              </div>

                              <div style={{ padding: "6px 12px 4px" }}>
                                <input
                                  type="text"
                                  value={notaCierreInput}
                                  onChange={(e) => setNotaCierreInput(e.target.value)}
                                  placeholder="Nota breve opcional (ej. TNK-ORD-0045)…"
                                  style={{
                                    width: "100%",
                                    padding: "5px 8px",
                                    borderRadius: "6px",
                                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                    fontSize: "0.75rem",
                                  }}
                                />
                              </div>

                              <div style={{ maxHeight: "260px", overflowY: "auto", paddingTop: "2px" }}>
                                {MOTIVOS_CIERRE_OMNICANAL.map((mot) => (
                                  <button
                                    key={mot.codigo}
                                    type="button"
                                    onClick={() => void handleCerrarConversacionConMotivo(mot.codigo)}
                                    style={{
                                      width: "100%",
                                      padding: "7px 12px",
                                      border: "none",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "1px",
                                      textAlign: "left",
                                      cursor: "pointer",
                                    }}
                                  >
                                    <span
                                      style={{
                                        fontSize: "0.79rem",
                                        fontWeight: 700,
                                        color: mot.color,
                                      }}
                                    >
                                      {mot.icono} {mot.etiqueta}
                                    </span>
                                    <span style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                                      {mot.descripcion}
                                    </span>
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>

                        {/* 4. MARCAR COMO NO LEÍDO */}
                        <button
                          type="button"
                          onClick={() => void handleMarcarComoNoLeido()}
                          title="Marcar como No Leído"
                          aria-label="Marcar como No Leído"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "34px",
                            height: "34px",
                            borderRadius: "8px",
                            border:
                              (conversacionActiva.noLeidosAsesora || 0) > 0
                                ? "1px solid var(--cb-221e1b, #221E1B)"
                                : "1px solid var(--cb-e6e2da, #E6E2DA)",
                            background:
                              (conversacionActiva.noLeidosAsesora || 0) > 0
                                ? "#221E1B"
                                : "var(--cf-ffffff, #FFFFFF)",
                            color:
                              (conversacionActiva.noLeidosAsesora || 0) > 0
                                ? "#FFFFFF"
                                : "var(--ct-57524c, #57524C)",
                            cursor: "pointer",
                          }}
                        >
                          <MailWarning size={15} />
                        </button>

                        {/* 5. PAUSAR IA / ACTIVAR IA */}
                        {conversacionActiva.estadoAtencion !== "EN_ATENCION_ASESORA" ? (
                          <button
                            type="button"
                            className="btn-responsive-accion"
                            onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                            title="Pausar respuestas automáticas de Mía (ARIA) y atender manualmente"
                            aria-label="Pausar IA"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 9px",
                              borderRadius: "8px",
                              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              background: "var(--cf-ffffff, #FFFFFF)",
                              color: "var(--ct-221e1b, #221E1B)",
                              fontSize: "0.73rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <Pause size={13} />
                            <span className="btn-texto-responsive">Pausar IA</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn-responsive-accion"
                            onClick={() => void handleCambiarEstado("BOT_ACTIVO")}
                            title="Reactivar respuestas automáticas de Mía (ARIA)"
                            aria-label="Activar IA"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 9px",
                              borderRadius: "8px",
                              border: "1px solid #2F4737",
                              background: "#2F4737",
                              color: "#FFFFFF",
                              fontSize: "0.73rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <Play size={13} />
                            <span className="btn-texto-responsive">Activar IA</span>
                          </button>
                        )}

                        {/* 5B. PRIVACIDAD PERSONAL: CONVERTIR A SOLO YO / SOLO CELULAR / SOLO ADMIN / VENTAS */}
                        {(esAdminAplicacion ||
                          (conversacionActiva.visibilidad === "SOLO_TITULAR" &&
                            conversacionActiva.titularPrivadoId === tablero.usuarioActualId)) && (() => {
                            const esChatPersonalActivo =
                              conversacionActiva.visibilidad === "SOLO_TITULAR" ||
                              conversacionActiva.visibilidad === "SOLO_ADMIN" ||
                              Boolean(conversacionActiva.iaBloqueadaPermanente);
                            return (
                              <div style={{ position: "relative" }}>
                                <button
                                  type="button"
                                  className="btn-responsive-accion"
                                  disabled={actualizandoPrivacidad}
                                  onClick={() =>
                                    setMenuCabeceraAbierto((prev) =>
                                      prev === "privacidad" ? null : "privacidad"
                                    )
                                  }
                                  title={
                                    esChatPersonalActivo
                                      ? "Chat Personal (oculto a otros usuarios) — clic para cambiar privacidad o devolver a Ventas"
                                      : "Convertir este chat en Personal para ocultarlo a los demás usuarios"
                                  }
                                  aria-label={esChatPersonalActivo ? "Personal activo" : "Hacer Personal"}
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    padding: "6px 9px",
                                    borderRadius: "8px",
                                    border: esChatPersonalActivo
                                      ? "1px solid #6B21A8"
                                      : "1px solid var(--cb-ddd6fe, #DDD6FE)",
                                    background: esChatPersonalActivo
                                      ? "#6B21A8"
                                      : "var(--cf-faf5ff, #FAF5FF)",
                                    color: esChatPersonalActivo
                                      ? "#FFFFFF"
                                      : "var(--ct-6b21a8, #6B21A8)",
                                    fontSize: "0.73rem",
                                    fontWeight: 600,
                                    cursor: actualizandoPrivacidad ? "wait" : "pointer",
                                  }}
                                >
                                  <Lock size={13} />
                                  <span className="btn-texto-responsive">
                                    {conversacionActiva.visibilidad === "SOLO_TITULAR"
                                      ? "Solo yo"
                                      : conversacionActiva.visibilidad === "SOLO_ADMIN"
                                        ? "Solo Admin"
                                        : "Personal"}
                                  </span>
                                </button>

                                {menuCabeceraAbierto === "privacidad" && (
                                  <div
                                    style={{
                                      position: "absolute",
                                      top: "calc(100% + 6px)",
                                      right: 0,
                                      width: "276px",
                                      maxWidth: "calc(100vw - 24px)",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                      borderRadius: "12px",
                                      boxShadow: "0 14px 32px rgba(15, 23, 42, 0.16)",
                                      padding: "8px",
                                      zIndex: 55,
                                      display: "flex",
                                      flexDirection: "column",
                                      gap: "6px",
                                    }}
                                  >
                                    <div
                                      style={{
                                        padding: "2px 6px 6px",
                                        fontSize: "0.73rem",
                                        fontWeight: 700,
                                        color: "var(--ct-6b21a8, #6B21A8)",
                                        borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                      }}
                                    >
                                      🔒 Privacidad del chat
                                    </div>

                                    <button
                                      type="button"
                                      disabled={actualizandoPrivacidad}
                                      onClick={() =>
                                        void handleCambiarPrivacidadChat(
                                          "MARCAR_PERSONAL",
                                          "SOLO_TITULAR"
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: "9px",
                                        border:
                                          conversacionActiva.visibilidad === "SOLO_TITULAR"
                                            ? "1.5px solid #6B21A8"
                                            : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                        background:
                                          conversacionActiva.visibilidad === "SOLO_TITULAR"
                                            ? "var(--cf-faf5ff, #FAF5FF)"
                                            : "var(--cf-ffffff, #FFFFFF)",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "2px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "0.78rem",
                                          fontWeight: 700,
                                          color: "var(--ct-6b21a8, #6B21A8)",
                                        }}
                                      >
                                        👤 Personal (Solo yo)
                                        {conversacionActiva.visibilidad === "SOLO_TITULAR"
                                          ? " · Activo"
                                          : ""}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.69rem",
                                          color: "var(--ct-6e6861, #6E6861)",
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        Deja de ser visible para todos los demás usuarios y bloquea ARIA. Solo tú lo ves aquí.
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={actualizandoPrivacidad}
                                      onClick={() =>
                                        void handleCambiarPrivacidadChat(
                                          "MARCAR_PERSONAL",
                                          "IGNORAR_TOTAL"
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: "9px",
                                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                        background: "var(--cf-ffffff, #FFFFFF)",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "2px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "0.78rem",
                                          fontWeight: 700,
                                          color: "var(--ct-991b1b, #991B1B)",
                                        }}
                                      >
                                        📵 Solo en mi celular
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.69rem",
                                          color: "var(--ct-6e6861, #6E6861)",
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        Lo saca de la web para todos (incluyéndote). Futuros mensajes quedan solo en tu teléfono.
                                      </span>
                                    </button>

                                    <button
                                      type="button"
                                      disabled={actualizandoPrivacidad}
                                      onClick={() =>
                                        void handleCambiarPrivacidadChat(
                                          "MARCAR_PERSONAL",
                                          "OCULTO_ADMIN"
                                        )
                                      }
                                      style={{
                                        width: "100%",
                                        padding: "8px 10px",
                                        borderRadius: "9px",
                                        border:
                                          conversacionActiva.visibilidad === "SOLO_ADMIN"
                                            ? "1.5px solid #1D4ED8"
                                            : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                        background:
                                          conversacionActiva.visibilidad === "SOLO_ADMIN"
                                            ? "var(--cf-eef4ff, #EEF4FF)"
                                            : "var(--cf-ffffff, #FFFFFF)",
                                        textAlign: "left",
                                        cursor: "pointer",
                                        display: "flex",
                                        flexDirection: "column",
                                        gap: "2px",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "0.78rem",
                                          fontWeight: 700,
                                          color: "var(--ct-1e40af, #1E40AF)",
                                        }}
                                      >
                                        🛡️ Solo Administradores
                                        {conversacionActiva.visibilidad === "SOLO_ADMIN"
                                          ? " · Activo"
                                          : ""}
                                      </span>
                                      <span
                                        style={{
                                          fontSize: "0.69rem",
                                          color: "var(--ct-6e6861, #6E6861)",
                                          lineHeight: 1.35,
                                        }}
                                      >
                                        Oculto para Ventas/Asesoras y sin IA; visible solo para Admins.
                                      </span>
                                    </button>

                                    {esChatPersonalActivo && (
                                      <button
                                        type="button"
                                        disabled={actualizandoPrivacidad}
                                        onClick={() =>
                                          void handleCambiarPrivacidadChat("PASAR_A_VENTAS")
                                        }
                                        style={{
                                          width: "100%",
                                          padding: "8px 10px",
                                          borderRadius: "9px",
                                          border: "1px solid #15803D",
                                          background: "var(--cf-f0fdf4, #F0FDF4)",
                                          textAlign: "left",
                                          cursor: "pointer",
                                          display: "flex",
                                          flexDirection: "column",
                                          gap: "2px",
                                        }}
                                      >
                                        <span
                                          style={{
                                            fontSize: "0.78rem",
                                            fontWeight: 700,
                                            color: "#166534",
                                          }}
                                        >
                                          💼 Devolver a Ventas
                                        </span>
                                        <span
                                          style={{
                                            fontSize: "0.69rem",
                                            color: "#166534",
                                            lineHeight: 1.35,
                                          }}
                                        >
                                          Vuelve a mostrar este chat al equipo comercial.
                                        </span>
                                      </button>
                                    )}
                                  </div>
                                )}
                              </div>
                            );
                          })()}

                        {/* 6. MOSTRAR / PLEGAR PANEL DERECHO */}
                        {modoLayoutInbox === "desktop" ? (
                          <button
                            type="button"
                            onClick={() => setFichaDerechaDesktop((v) => !v)}
                            title={
                              fichaDerechaDesktop
                                ? "Plegar panel derecho de Campos de Venta"
                                : "Mostrar Campos de Venta y Ficha 360°"
                            }
                            aria-label={fichaDerechaDesktop ? "Ocultar Datos" : "Campos de Venta"}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              border: fichaDerechaDesktop
                                ? "1px solid var(--cb-221e1b, #221E1B)"
                                : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: fichaDerechaDesktop ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                              color: fichaDerechaDesktop ? "var(--ct-221e1b, #221E1B)" : "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            {fichaDerechaDesktop ? (
                              <PanelRightClose size={15} />
                            ) : (
                              <PanelRightOpen size={15} />
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setMostrarFichaTablet(true)}
                            title="Abrir Campos de Venta (Pedido, Entrega, Tarjeta) y Ficha del Cliente"
                            aria-label="Campos de Venta"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "6px 9px",
                              borderRadius: "8px",
                              border: "1px solid var(--cb-221e1b, #221E1B)",
                              background: "#221E1B",
                              color: "#FFFFFF",
                              fontSize: "0.73rem",
                              fontWeight: 600,
                              cursor: "pointer",
                            }}
                          >
                            <ClipboardList size={13} />
                            <span>Datos</span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* FILA 2 EXCLUSIVA EN MÓVIL: Rejilla táctil sobria de acciones rápidas de estado (38px alto) */}
                  {modoLayoutInbox === "movil" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          esAdminAplicacion ||
                          (conversacionActiva.visibilidad === "SOLO_TITULAR" &&
                            conversacionActiva.titularPrivadoId === tablero.usuarioActualId)
                            ? "repeat(6, minmax(0, 1fr))"
                            : "repeat(5, minmax(0, 1fr))",
                        gap: "6px",
                        width: "100%",
                      }}
                    >
                      {/* 1. Etiquetas */}
                      <button
                        type="button"
                        onClick={() =>
                          setMenuCabeceraAbierto((prev) =>
                            prev === "etiquetas" ? null : "etiquetas"
                          )
                        }
                        title="Gestionar etiquetas"
                        aria-label="Etiquetas"
                        style={{
                          height: "38px",
                          borderRadius: "9px",
                          border:
                            menuCabeceraAbierto === "etiquetas"
                              ? "1.5px solid var(--cb-221e1b, #221E1B)"
                              : (conversacionActiva.etiquetasIds ?? []).length > 0
                                ? "1px solid var(--cb-847d74, #847D74)"
                                : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            menuCabeceraAbierto === "etiquetas"
                              ? "#221E1B"
                              : (conversacionActiva.etiquetasIds ?? []).length > 0
                                ? "var(--cf-f4f2ee, #F4F2EE)"
                                : "var(--cf-f8f7f4, #F8F7F4)",
                          color:
                            menuCabeceraAbierto === "etiquetas"
                              ? "#FFFFFF"
                              : "var(--ct-3a3530, #3A3530)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "3px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Tag size={16} />
                        {(conversacionActiva.etiquetasIds ?? []).length > 0 && (
                          <span>{(conversacionActiva.etiquetasIds ?? []).length}</span>
                        )}
                      </button>

                      {/* 2. Recordatorio */}
                      <button
                        type="button"
                        onClick={() => {
                          setMenuCabeceraAbierto((prev) =>
                            prev === "recordatorio" ? null : "recordatorio"
                          );
                          setMostrarSelectorFechaCustom(false);
                        }}
                        title="Recuérdamelo en…"
                        aria-label="Recordatorio"
                        style={{
                          height: "38px",
                          borderRadius: "9px",
                          border:
                            menuCabeceraAbierto === "recordatorio"
                              ? "1.5px solid var(--cb-221e1b, #221E1B)"
                              : conversacionActiva.recordatorioEn
                                ? "1px solid var(--cb-847d74, #847D74)"
                                : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            menuCabeceraAbierto === "recordatorio"
                              ? "#221E1B"
                              : conversacionActiva.recordatorioEn
                                ? "var(--cf-f4f2ee, #F4F2EE)"
                                : "var(--cf-f8f7f4, #F8F7F4)",
                          color:
                            menuCabeceraAbierto === "recordatorio"
                              ? "#FFFFFF"
                              : "var(--ct-3a3530, #3A3530)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <Clock size={16} />
                      </button>

                      {/* 3. Cerrar conversación (con motivo) o Reabrir */}
                      {conversacionActiva.estadoAtencion !== "CERRADO" ? (
                        <button
                          type="button"
                          onClick={() =>
                            setMenuCabeceraAbierto((prev) =>
                              prev === "cierre" ? null : "cierre"
                            )
                          }
                          title="Cerrar chat y elegir motivo"
                          aria-label="Cerrar chat"
                          style={{
                            height: "38px",
                            borderRadius: "9px",
                            border:
                              menuCabeceraAbierto === "cierre"
                                ? "1.5px solid var(--cb-221e1b, #221E1B)"
                                : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            background:
                              menuCabeceraAbierto === "cierre" ? "#221E1B" : "var(--cf-f8f7f4, #F8F7F4)",
                            color: menuCabeceraAbierto === "cierre" ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <CheckCircle2 size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                          title="Reabrir conversación"
                          aria-label="Reabrir chat"
                          style={{
                            height: "38px",
                            borderRadius: "9px",
                            border: "1px solid #2F4737",
                            background: "#2F4737",
                            color: "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <RotateCcw size={16} />
                        </button>
                      )}

                      {/* 4. Marcar como No Leído */}
                      <button
                        type="button"
                        onClick={() => void handleMarcarComoNoLeido()}
                        title="Marcar como No Leído"
                        aria-label="Marcar como No Leído"
                        style={{
                          height: "38px",
                          borderRadius: "9px",
                          border:
                            (conversacionActiva.noLeidosAsesora || 0) > 0
                              ? "1px solid var(--cb-221e1b, #221E1B)"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            (conversacionActiva.noLeidosAsesora || 0) > 0
                              ? "#221E1B"
                              : "var(--cf-f8f7f4, #F8F7F4)",
                          color:
                            (conversacionActiva.noLeidosAsesora || 0) > 0
                              ? "#FFFFFF"
                              : "var(--ct-3a3530, #3A3530)",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        <MailWarning size={16} />
                      </button>

                      {/* 5. Pausar IA / Activar IA */}
                      {conversacionActiva.estadoAtencion !== "EN_ATENCION_ASESORA" ? (
                        <button
                          type="button"
                          onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                          title="Pausar IA ARIA y tomar control humano"
                          aria-label="Pausar IA"
                          style={{
                            height: "38px",
                            borderRadius: "9px",
                            border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            background: "var(--cf-f8f7f4, #F8F7F4)",
                            color: "var(--ct-3a3530, #3A3530)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Pause size={16} />
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleCambiarEstado("BOT_ACTIVO")}
                          title="Reactivar IA ARIA"
                          aria-label="Activar IA"
                          style={{
                            height: "38px",
                            borderRadius: "9px",
                            border: "1px solid #2F4737",
                            background: "#2F4737",
                            color: "#FFFFFF",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Play size={16} />
                        </button>
                      )}

                      {/* 6. Privacidad Personal en móvil */}
                      {(esAdminAplicacion ||
                        (conversacionActiva.visibilidad === "SOLO_TITULAR" &&
                          conversacionActiva.titularPrivadoId === tablero.usuarioActualId)) && (
                        <button
                          type="button"
                          onClick={() =>
                            setMenuCabeceraAbierto((prev) =>
                              prev === "privacidad" ? null : "privacidad"
                            )
                          }
                          title="Convertir en chat Personal (oculto a los demás usuarios)"
                          aria-label="Privacidad Personal"
                          style={{
                            height: "38px",
                            borderRadius: "9px",
                            border:
                              conversacionActiva.visibilidad === "SOLO_TITULAR" ||
                              conversacionActiva.visibilidad === "SOLO_ADMIN"
                                ? "1.5px solid #6B21A8"
                                : "1px solid var(--cb-ddd6fe, #DDD6FE)",
                            background:
                              conversacionActiva.visibilidad === "SOLO_TITULAR" ||
                              conversacionActiva.visibilidad === "SOLO_ADMIN" ||
                              menuCabeceraAbierto === "privacidad"
                                ? "#6B21A8"
                                : "var(--cf-faf5ff, #FAF5FF)",
                            color:
                              conversacionActiva.visibilidad === "SOLO_TITULAR" ||
                              conversacionActiva.visibilidad === "SOLO_ADMIN" ||
                              menuCabeceraAbierto === "privacidad"
                                ? "#FFFFFF"
                                : "var(--ct-6b21a8, #6B21A8)",
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                          }}
                        >
                          <Lock size={16} />
                        </button>
                      )}
                    </div>
                  )}

                  {/* BOTTOM SHEET MÓVIL DE PANTALLA COMPLETA (Etiquetas / Recordatorio / Motivo de Cierre / Privacidad) — CERO RECORTE LATERAL */}
                  {modoLayoutInbox === "movil" && menuCabeceraAbierto !== null && (
                    <div
                      role="dialog"
                      aria-modal="true"
                      aria-label={
                        menuCabeceraAbierto === "etiquetas"
                          ? "Gestionar etiquetas"
                          : menuCabeceraAbierto === "recordatorio"
                            ? "Recuérdamelo en"
                            : menuCabeceraAbierto === "privacidad"
                              ? "Privacidad del chat"
                              : "Seleccionar motivo de cierre"
                      }
                      onClick={() => {
                        setMenuCabeceraAbierto(null);
                        setMostrarSelectorFechaCustom(false);
                      }}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 9975,
                        background: "rgba(15, 23, 42, 0.54)",
                        backdropFilter: "blur(2px)",
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "flex-end",
                      }}
                    >
                      <div
                        onClick={(e) => e.stopPropagation()}
                        style={{
                          width: "100%",
                          maxHeight: "82dvh",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          borderRadius: "18px 18px 0 0",
                          boxShadow: "0 -12px 36px rgba(15, 23, 42, 0.24)",
                          display: "flex",
                          flexDirection: "column",
                          paddingBottom: "calc(14px + env(safe-area-inset-bottom, 0px))",
                          overflow: "hidden",
                        }}
                      >
                        {/* Tirador visual superior + Título + Cerrar */}
                        <div
                          style={{
                            padding: "10px 16px 10px",
                            borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "8px",
                          }}
                        >
                          <div
                            style={{
                              width: "40px",
                              height: "4px",
                              borderRadius: "999px",
                              background: "var(--cf-d5cfc4, #D5CFC4)",
                              margin: "0 auto",
                            }}
                          />
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                          >
                            <strong style={{ fontSize: "0.94rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                              {menuCabeceraAbierto === "etiquetas" && "🏷️ Gestionar etiquetas"}
                              {menuCabeceraAbierto === "recordatorio" && "⏰ Recuérdamelo en…"}
                              {menuCabeceraAbierto === "privacidad" && "🔒 Privacidad Personal del chat"}
                              {menuCabeceraAbierto === "cierre" &&
                                "✅ Cerrar chat · Selecciona el motivo"}
                            </strong>
                            <button
                              type="button"
                              onClick={() => {
                                setMenuCabeceraAbierto(null);
                                setMostrarSelectorFechaCustom(false);
                              }}
                              title="Cerrar menú"
                              aria-label="Cerrar menú"
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "9px",
                                border: "none",
                                background: "var(--cf-f4f2ee, #F4F2EE)",
                                color: "var(--ct-57524c, #57524C)",
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                cursor: "pointer",
                              }}
                            >
                              <X size={17} />
                            </button>
                          </div>
                        </div>

                        {/* Contenido desplazable táctil del Bottom Sheet */}
                        <div style={{ overflowY: "auto", padding: "8px 14px", display: "flex", flexDirection: "column", gap: "4px" }}>
                          {menuCabeceraAbierto === "etiquetas" && (
                            <>
                              {etiquetasClasificacion.map((etq) => {
                                const puesta = (conversacionActiva.etiquetasIds ?? []).includes(
                                  etq.id
                                );
                                return (
                                  <button
                                    key={etq.id}
                                    type="button"
                                    onClick={() => void handleAlternarEtiqueta(etq.id)}
                                    style={{
                                      width: "100%",
                                      minHeight: "46px",
                                      padding: "10px 12px",
                                      borderRadius: "10px",
                                      border: puesta ? "1px solid var(--cb-ddd8ce, #DDD8CE)" : "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                      background: puesta ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                                      display: "flex",
                                      alignItems: "center",
                                      gap: "10px",
                                      cursor: "pointer",
                                      textAlign: "left",
                                      fontSize: "0.88rem",
                                      color: "var(--ct-1f1c19, #1F1C19)",
                                      fontWeight: puesta ? 700 : 500,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "20px",
                                        height: "20px",
                                        borderRadius: "6px",
                                        border: puesta
                                          ? "1.5px solid var(--cb-221e1b, #221E1B)"
                                          : "1.5px solid var(--cb-d5cfc4, #D5CFC4)",
                                        background: puesta ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                                        color: "#FFFFFF",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        flexShrink: 0,
                                      }}
                                    >
                                      {puesta && <Check size={13} />}
                                    </span>
                                    <span
                                      style={{
                                        width: "10px",
                                        height: "10px",
                                        borderRadius: "999px",
                                        background: etq.color,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span style={{ flex: 1 }}>
                                      {etq.icono} {etq.nombre}
                                    </span>
                                  </button>
                                );
                              })}

                              {Boolean(tablero.esAdminEtiquetas) && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setMenuCabeceraAbierto(null);
                                    setModalEtiquetasAbierto(true);
                                  }}
                                  style={{
                                    marginTop: "6px",
                                    width: "100%",
                                    minHeight: "44px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                    background: "var(--cf-f8f7f4, #F8F7F4)",
                                    color: "var(--ct-1f1c19, #1F1C19)",
                                    fontSize: "0.84rem",
                                    fontWeight: 700,
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    gap: "7px",
                                    cursor: "pointer",
                                  }}
                                >
                                  <Settings2 size={15} />
                                  <span>+ Nueva / Administrar etiquetas</span>
                                </button>
                              )}
                            </>
                          )}

                          {menuCabeceraAbierto === "recordatorio" && (
                            <>
                              {OPCIONES_RECORDATORIO_RAPIDO_OMNICANAL.map((op) => (
                                <button
                                  key={op.clave}
                                  type="button"
                                  onClick={() => void handleProgramarRecordatorioRapido(op.clave)}
                                  style={{
                                    width: "100%",
                                    minHeight: "46px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                                    background: "var(--cf-ffffff, #FFFFFF)",
                                    textAlign: "left",
                                    fontSize: "0.88rem",
                                    color: "var(--ct-1f1c19, #1F1C19)",
                                    fontWeight: 600,
                                    cursor: "pointer",
                                  }}
                                >
                                  🕒 {op.etiqueta}
                                </button>
                              ))}

                              <button
                                type="button"
                                onClick={() => setMostrarSelectorFechaCustom((v) => !v)}
                                style={{
                                  width: "100%",
                                  minHeight: "46px",
                                  padding: "10px 12px",
                                  borderRadius: "10px",
                                  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background: mostrarSelectorFechaCustom ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-f8f7f4, #F8F7F4)",
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "8px",
                                  fontSize: "0.86rem",
                                  fontWeight: 700,
                                  color: "var(--ct-1f1c19, #1F1C19)",
                                  cursor: "pointer",
                                }}
                              >
                                <Calendar size={16} />
                                <span>Elegir fecha y hora exacta</span>
                              </button>

                              {mostrarSelectorFechaCustom && (
                                <div
                                  style={{
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    background: "var(--cf-f8f7f4, #F8F7F4)",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "8px",
                                  }}
                                >
                                  <input
                                    type="datetime-local"
                                    value={recordatorioFecha}
                                    onChange={(e) => setRecordatorioFecha(e.target.value)}
                                    style={{
                                      width: "100%",
                                      minHeight: "42px",
                                      padding: "8px 10px",
                                      borderRadius: "8px",
                                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                      fontSize: "16px",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                    }}
                                  />
                                  <input
                                    type="text"
                                    value={recordatorioNota}
                                    onChange={(e) => setRecordatorioNota(e.target.value)}
                                    placeholder="Nota opcional (ej. confirmar pago)…"
                                    style={{
                                      width: "100%",
                                      minHeight: "42px",
                                      padding: "8px 10px",
                                      borderRadius: "8px",
                                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                      fontSize: "16px",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                    }}
                                  />
                                  <button
                                    type="button"
                                    disabled={!recordatorioFecha}
                                    onClick={() => void handleGuardarRecordatorio()}
                                    style={{
                                      minHeight: "44px",
                                      padding: "10px 14px",
                                      borderRadius: "9px",
                                      border: "none",
                                      background: "#1F1C19",
                                      color: "#FFFFFF",
                                      fontSize: "0.86rem",
                                      fontWeight: 700,
                                      cursor: recordatorioFecha ? "pointer" : "not-allowed",
                                      opacity: recordatorioFecha ? 1 : 0.5,
                                    }}
                                  >
                                    Programar seguimiento
                                  </button>
                                </div>
                              )}

                              {conversacionActiva.recordatorioEn && (
                                <button
                                  type="button"
                                  onClick={() => void handleLimpiarRecordatorio()}
                                  style={{
                                    marginTop: "4px",
                                    width: "100%",
                                    minHeight: "44px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--cb-e5caca, #E5CACA)",
                                    background: "var(--cf-faf2f2, #FAF2F2)",
                                    textAlign: "center",
                                    fontSize: "0.84rem",
                                    fontWeight: 700,
                                    color: "var(--ct-8a2e2e, #8A2E2E)",
                                    cursor: "pointer",
                                  }}
                                >
                                  ✕ Quitar recordatorio actual
                                </button>
                              )}
                            </>
                          )}

                          {menuCabeceraAbierto === "cierre" && (
                            <>
                              <input
                                type="text"
                                value={notaCierreInput}
                                onChange={(e) => setNotaCierreInput(e.target.value)}
                                placeholder="Nota opcional (ej. TNK-ORD-0045)…"
                                style={{
                                  width: "100%",
                                  minHeight: "42px",
                                  padding: "8px 11px",
                                  marginBottom: "4px",
                                  borderRadius: "9px",
                                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                  fontSize: "16px",
                                  background: "var(--cf-f8f7f4, #F8F7F4)",
                                }}
                              />

                              {MOTIVOS_CIERRE_OMNICANAL.map((mot) => (
                                <button
                                  key={mot.codigo}
                                  type="button"
                                  onClick={() => void handleCerrarConversacionConMotivo(mot.codigo)}
                                  style={{
                                    width: "100%",
                                    minHeight: "52px",
                                    padding: "10px 12px",
                                    borderRadius: "10px",
                                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                    background: "var(--cf-ffffff, #FFFFFF)",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "2px",
                                    textAlign: "left",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span
                                    style={{
                                      fontSize: "0.88rem",
                                      fontWeight: 700,
                                      color: mot.color,
                                    }}
                                  >
                                    {mot.icono} {mot.etiqueta}
                                  </span>
                                  <span style={{ fontSize: "0.75rem", color: "var(--ct-847d74, #847D74)" }}>
                                    {mot.descripcion}
                                  </span>
                                </button>
                              ))}
                            </>
                          )}

                          {menuCabeceraAbierto === "privacidad" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "8px", paddingBottom: "4px" }}>
                              <button
                                type="button"
                                disabled={actualizandoPrivacidad}
                                onClick={() =>
                                  void handleCambiarPrivacidadChat(
                                    "MARCAR_PERSONAL",
                                    "SOLO_TITULAR"
                                  )
                                }
                                style={{
                                  width: "100%",
                                  minHeight: "56px",
                                  padding: "11px 13px",
                                  borderRadius: "11px",
                                  border:
                                    conversacionActiva.visibilidad === "SOLO_TITULAR"
                                      ? "1.5px solid #6B21A8"
                                      : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background:
                                    conversacionActiva.visibilidad === "SOLO_TITULAR"
                                      ? "var(--cf-faf5ff, #FAF5FF)"
                                      : "var(--cf-ffffff, #FFFFFF)",
                                  textAlign: "left",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "3px",
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#6B21A8" }}>
                                  👤 Personal (Solo yo)
                                  {conversacionActiva.visibilidad === "SOLO_TITULAR" ? " · Activo" : ""}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "var(--ct-6e6861, #6E6861)" }}>
                                  Deja de ser visible para todos los demás usuarios y bloquea ARIA. Solo tú lo ves aquí.
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={actualizandoPrivacidad}
                                onClick={() =>
                                  void handleCambiarPrivacidadChat(
                                    "MARCAR_PERSONAL",
                                    "IGNORAR_TOTAL"
                                  )
                                }
                                style={{
                                  width: "100%",
                                  minHeight: "56px",
                                  padding: "11px 13px",
                                  borderRadius: "11px",
                                  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background: "var(--cf-ffffff, #FFFFFF)",
                                  textAlign: "left",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "3px",
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#991B1B" }}>
                                  📵 Solo en mi celular
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "var(--ct-6e6861, #6E6861)" }}>
                                  Oculto de la web para todos (incluyéndote). Futuros mensajes quedan solo en tu celular.
                                </span>
                              </button>

                              <button
                                type="button"
                                disabled={actualizandoPrivacidad}
                                onClick={() =>
                                  void handleCambiarPrivacidadChat(
                                    "MARCAR_PERSONAL",
                                    "OCULTO_ADMIN"
                                  )
                                }
                                style={{
                                  width: "100%",
                                  minHeight: "56px",
                                  padding: "11px 13px",
                                  borderRadius: "11px",
                                  border:
                                    conversacionActiva.visibilidad === "SOLO_ADMIN"
                                      ? "1.5px solid #1D4ED8"
                                      : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background:
                                    conversacionActiva.visibilidad === "SOLO_ADMIN"
                                      ? "var(--cf-eef4ff, #EEF4FF)"
                                      : "var(--cf-ffffff, #FFFFFF)",
                                  textAlign: "left",
                                  display: "flex",
                                  flexDirection: "column",
                                  gap: "3px",
                                  cursor: "pointer",
                                }}
                              >
                                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1E40AF" }}>
                                  🛡️ Solo Administradores
                                  {conversacionActiva.visibilidad === "SOLO_ADMIN" ? " · Activo" : ""}
                                </span>
                                <span style={{ fontSize: "0.75rem", color: "var(--ct-6e6861, #6E6861)" }}>
                                  Oculto para Ventas/Asesoras y sin IA; visible solo para Admins.
                                </span>
                              </button>

                              {(conversacionActiva.visibilidad === "SOLO_TITULAR" ||
                                conversacionActiva.visibilidad === "SOLO_ADMIN" ||
                                conversacionActiva.iaBloqueadaPermanente) && (
                                <button
                                  type="button"
                                  disabled={actualizandoPrivacidad}
                                  onClick={() => void handleCambiarPrivacidadChat("PASAR_A_VENTAS")}
                                  style={{
                                    width: "100%",
                                    minHeight: "52px",
                                    padding: "11px 13px",
                                    borderRadius: "11px",
                                    border: "1px solid #15803D",
                                    background: "var(--cf-f0fdf4, #F0FDF4)",
                                    textAlign: "left",
                                    display: "flex",
                                    flexDirection: "column",
                                    gap: "3px",
                                    cursor: "pointer",
                                  }}
                                >
                                  <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#166534" }}>
                                    💼 Devolver a Ventas
                                  </span>
                                  <span style={{ fontSize: "0.75rem", color: "#166534" }}>
                                    Vuelve a mostrar este chat al equipo comercial.
                                  </span>
                                </button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Píldoras compactas y sobrias de etiquetas asignadas actualmente al chat */}
                  {(conversacionActiva.etiquetasIds ?? []).some((id) => mapaEtiquetas.has(id)) && (
                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                      {(conversacionActiva.etiquetasIds ?? [])
                        .map((id) => mapaEtiquetas.get(id))
                        .filter((etq): etq is EtiquetaOmnicanal => Boolean(etq))
                        .map((etq) => (
                          <button
                            key={etq.id}
                            type="button"
                            onClick={() => void handleAlternarEtiqueta(etq.id)}
                            title={`Toca para quitar etiqueta ${etq.nombre}`}
                            aria-label={`Quitar etiqueta ${etq.nombre}`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontSize: "0.69rem",
                              fontWeight: 600,
                              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: "var(--cf-f8f7f4, #F8F7F4)",
                              color: "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            <span
                              style={{
                                width: "6px",
                                height: "6px",
                                borderRadius: "999px",
                                background: etq.color,
                                flexShrink: 0,
                              }}
                            />
                            <span>{etq.nombre} ×</span>
                          </button>
                        ))}
                    </div>
                  )}
                </div>

                {/* Pull-to-refresh táctil superior en el chat móvil */}
                {modoLayoutInbox === "movil" &&
                  vistaMovilInbox === "chat" &&
                  (pullOffsetPx > 0 || refrescandoPull) && (
                    <div
                      style={{
                        height: `${Math.max(refrescandoPull ? 42 : 0, pullOffsetPx)}px`,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "7px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        color: "var(--ct-57524c, #57524C)",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        overflow: "hidden",
                        transition: refrescandoPull ? "height 160ms ease" : "none",
                        flexShrink: 0,
                      }}
                    >
                      <RefreshCw size={13} />
                      <span>
                        {refrescandoPull
                          ? "Actualizando chat…"
                          : pullOffsetPx >= 46
                            ? "Suelta para actualizar"
                            : "Desliza hacia abajo para actualizar"}
                      </span>
                    </div>
                  )}

                {/* Selector de Canales del mismo Cliente (sin mezclar historiales entre canales) */}
                {grupoClienteActivo && grupoClienteActivo.conversaciones.length > 1 && (
                  <div
                    role="tablist"
                    aria-label="Canales del cliente"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: modoLayoutInbox === "movil" ? "6px 10px" : "6px 14px",
                      background: "var(--cf-faf8f5, #FAF8F5)",
                      borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      overflowX: "auto",
                      flexShrink: 0,
                    }}
                  >
                    <span
                      style={{
                        fontSize: "0.69rem",
                        fontWeight: 700,
                        color: "var(--ct-847d74, #847D74)",
                        whiteSpace: "nowrap",
                        marginRight: "2px",
                      }}
                    >
                      Canales ({grupoClienteActivo.conversaciones.length}):
                    </span>
                    {(() => {
                      const conteoPorCanal: Record<string, number> = {};
                      const totalesPorCanal: Record<string, number> = {};
                      for (const h of grupoClienteActivo.conversaciones) {
                        const ch = h.canal || "web";
                        totalesPorCanal[ch] = (totalesPorCanal[ch] || 0) + 1;
                      }
                      return grupoClienteActivo.conversaciones.map((hilo) => {
                        const ch = hilo.canal || "web";
                        conteoPorCanal[ch] = (conteoPorCanal[ch] || 0) + 1;
                        const idxCanal = conteoPorCanal[ch]!;
                        const hayMultiplesMismoCanal = (totalesPorCanal[ch] || 0) > 1;
                        const esActivo = hilo.id === conversacionActiva.id;
                        const noLeidosHilo = Number(hilo.noLeidosAsesora || 0);
                        const etiquetaBase =
                          ch === "whatsapp"
                            ? "WhatsApp"
                            : ch === "web"
                              ? "Chat Web"
                              : nombreLegibleCanal(ch);

                        return (
                          <button
                            key={hilo.id}
                            type="button"
                            role="tab"
                            aria-selected={esActivo}
                            onClick={() => setConversacionActivaId(hilo.id)}
                            title={`Ver chat de ${etiquetaBase}${
                              hayMultiplesMismoCanal ? ` #${idxCanal}` : ""
                            } (${formatearTiempoCorto(hilo.ultimoMensajeEn)})`}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "5px",
                              padding: "4px 10px",
                              borderRadius: "999px",
                              border: esActivo ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: esActivo ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                              color: esActivo ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                              flexShrink: 0,
                            }}
                          >
                            <IconoVectorCanal canal={ch} size={13} />
                            <span>
                              {etiquetaBase}
                              {hayMultiplesMismoCanal ? ` #${idxCanal}` : ""}
                            </span>
                            {noLeidosHilo > 0 && !esActivo && (
                              <span
                                style={{
                                  minWidth: "16px",
                                  height: "16px",
                                  padding: "0 4px",
                                  borderRadius: "999px",
                                  background: "#221E1B",
                                  color: "#FFFFFF",
                                  fontSize: "0.62rem",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                {noLeidosHilo}
                              </span>
                            )}
                          </button>
                        );
                      });
                    })()}
                  </div>
                )}

                {/* Línea de Tiempo de Mensajes — Paleta Limpia y Sobria */}
                <div
                  ref={scrollMensajesRef}
                  onTouchStart={iniciarPullMovil}
                  onTouchMove={moverPullMovil}
                  onTouchEnd={() => void finalizarPullMovil()}
                  style={{
                    flex: 1,
                    padding: modoLayoutInbox === "movil" ? "12px 10px" : "16px",
                    overflowY: "auto",
                    overscrollBehaviorY: "contain",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {cargandoMensajes ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "var(--ct-847d74, #847D74)" }}>
                      Cargando historial de la conversación…
                    </div>
                  ) : mensajesActivos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "var(--ct-847d74, #847D74)", fontSize: "0.82rem" }}>
                      Aún no hay mensajes registrados en este hilo.
                    </div>
                  ) : (
                    mensajesActivos.map((m) => {
                      if (m.origen === "SISTEMA") {
                        return (
                          <div
                            key={m.id}
                            style={{
                              alignSelf: "center",
                              padding: "4px 12px",
                              borderRadius: "999px",
                              background: "var(--cf-efece6, #EFECE6)",
                              border: "1px solid var(--cb-e4e0d8, #E4E0D8)",
                              color: "var(--ct-6e6861, #6E6861)",
                              fontSize: "0.72rem",
                              fontWeight: 500,
                              maxWidth: "90%",
                              textAlign: "center",
                            }}
                          >
                            {m.contenido}
                          </div>
                        );
                      }

                      const esCliente = m.origen === "CLIENTE";
                      const esAria = m.origen === "BOT_ARIA";
                      const esNota = m.origen === "NOTA_INTERNA";
                      const esResaltado = Boolean(mensajeResaltadoId && m.id === mensajeResaltadoId);

                      return (
                        <div
                          key={m.id}
                          data-msg-id={m.id}
                          style={{
                            alignSelf: esCliente ? "flex-start" : "flex-end",
                            maxWidth: modoLayoutInbox === "movil" ? "88%" : "80%",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              color: esNota
                                ? "var(--ct-745622, #745622)"
                                : esAria
                                  ? "var(--ct-2f4737, #2F4737)"
                                  : "var(--ct-847d74, #847D74)",
                              textAlign: esCliente ? "left" : "right",
                            }}
                          >
                            {esResaltado && (
                              <span
                                style={{
                                  display: "inline-block",
                                  marginRight: "6px",
                                  padding: "1px 6px",
                                  borderRadius: "999px",
                                  background: "var(--cf-faf6ec, #FAF6EC)",
                                  color: "var(--ct-745622, #745622)",
                                  border: "1px solid var(--cb-d6c7a9, #D6C7A9)",
                                  fontSize: "0.63rem",
                                  fontWeight: 700,
                                }}
                              >
                                Mensaje compartido
                              </span>
                            )}
                            {esCliente && (m.autorNombre || conversacionActiva.remitenteNombre)}
                            {esAria && `ARIA · ${m.autorNombre || "Automático"}`}
                            {esNota && `Nota interna · ${m.autorNombre || "Equipo"}`}
                            {m.origen === "ASESORA_HUMANA" &&
                              `${m.autorNombre || "Asesor"}`}
                            {" · "}
                            {new Date(m.creadoEn).toLocaleTimeString("es-EC", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>

                          <div
                            style={{
                              padding: "10px 13px",
                              borderRadius: esCliente
                                ? "14px 14px 14px 4px"
                                : "14px 14px 4px 14px",
                              background: esCliente
                                ? "var(--cf-ffffff, #FFFFFF)"
                                : esAria
                                  ? "var(--cf-f2f5f3, #F2F5F3)"
                                  : esNota
                                    ? "var(--cf-faf6ec, #FAF6EC)"
                                    : "var(--cf-eceae4, #ECEAE4)",
                              color: esNota ? "var(--ct-292524, #292524)" : "var(--ct-221e1b, #221E1B)",
                              border: esResaltado
                                ? "1.5px solid var(--cb-221e1b, #221E1B)"
                                : esCliente
                                  ? "1px solid var(--cb-e6e2da, #E6E2DA)"
                                  : esAria
                                    ? "1px solid var(--cb-dce4df, #DCE4DF)"
                                    : esNota
                                      ? "1px solid var(--cb-e8dec6, #E8DEC6)"
                                      : "1px solid var(--cb-dcd8d0, #DCD8D0)",
                              fontSize: "0.83rem",
                              lineHeight: 1.48,
                              boxShadow: esResaltado
                                ? "0 0 0 3px rgba(24, 24, 27, 0.10)"
                                : "0 1px 2px rgba(24, 24, 27, 0.03)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              transition: "box-shadow 0.25s ease, border-color 0.25s ease",
                            }}
                          >
                            {renderContenidoMensajeOmnicanal(
                              m,
                              false,
                              {
                                onAmpliarImagen: (url, alt) =>
                                  setVisorImagenDatos({
                                    url,
                                    titulo:
                                      alt ||
                                      `Conversación con ${conversacionActiva.remitenteNombre}`,
                                    autorNombre:
                                      m.autorNombre || conversacionActiva.remitenteNombre,
                                    creadoEn: m.creadoEn,
                                    contextoReenvio: {
                                      conversacionId: conversacionActiva.id,
                                      mensajeId: m.id,
                                      canal: conversacionActiva.canal,
                                      clienteNombre: conversacionActiva.remitenteNombre,
                                      clienteTelefono:
                                        conversacionActiva.remitenteTelefono ?? null,
                                      autorOriginal:
                                        m.autorNombre || conversacionActiva.remitenteNombre,
                                      textoOriginal: m.contenido
                                        .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                        .trim(),
                                      imagenUrl: url,
                                    },
                                  }),
                                onReenviarImagen: (url, alt) =>
                                  setReenvioModalDatos({
                                    destino: "whatsapp",
                                    payload: {
                                      imagenUrl: url,
                                      tituloImagen: alt || "Arreglo Tinkay",
                                      textoOriginal: m.contenido
                                        .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                        .trim(),
                                      contextoCliente: {
                                        conversacionId: conversacionActiva.id,
                                        mensajeId: m.id,
                                        canal: conversacionActiva.canal,
                                        clienteNombre: conversacionActiva.remitenteNombre,
                                        clienteTelefono:
                                          conversacionActiva.remitenteTelefono ?? null,
                                        autorOriginal:
                                          m.autorNombre || conversacionActiva.remitenteNombre,
                                        textoOriginal: m.contenido
                                          .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                          .trim(),
                                        imagenUrl: url,
                                      },
                                    },
                                  }),
                                onTranscribirAudio: (url, mime) =>
                                  void handleProcesarNotaVozPanel(m, url, mime, false),
                                onResponderAudioConAria: (url, mime) =>
                                  void handleProcesarNotaVozPanel(m, url, mime, true),
                                procesandoAudio: procesandoAudioMsgId === m.id,
                              }
                            )}

                            {/* Botón discreto para enviar cualquier consulta/mensaje al Chat Grupal del Equipo */}
                            <div
                              style={{
                                display: "flex",
                                justifyContent: "flex-end",
                                gap: "6px",
                              }}
                            >
                              <button
                                type="button"
                                className="btn-responsive-accion"
                                onClick={() => {
                                  const imgPrincipal =
                                    extraerTodasLasImagenesMensaje(m)[0]?.url ?? null;
                                  setReenvioModalDatos({
                                    destino: "equipo",
                                    payload: {
                                      imagenUrl: imgPrincipal,
                                      tituloImagen: conversacionActiva.remitenteNombre,
                                      textoOriginal: m.contenido
                                        .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                        .trim(),
                                      contextoCliente: {
                                        conversacionId: conversacionActiva.id,
                                        mensajeId: m.id,
                                        canal: conversacionActiva.canal,
                                        clienteNombre: conversacionActiva.remitenteNombre,
                                        clienteTelefono:
                                          conversacionActiva.remitenteTelefono ?? null,
                                        autorOriginal:
                                          m.autorNombre || conversacionActiva.remitenteNombre,
                                        textoOriginal: m.contenido
                                          .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                          .trim(),
                                        imagenUrl: imgPrincipal,
                                      },
                                    },
                                  });
                                }}
                                title="Compartir este mensaje o foto en el Chat Grupal del Equipo (@kleber, @taller)"
                                aria-label="Compartir con equipo"
                                style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  padding: "2px 7px",
                                  borderRadius: "6px",
                                  border: "1px solid var(--cb-18181b-a100, rgba(24, 24, 27, 0.10))",
                                  background: "var(--cf-ffffff-a720, rgba(255, 255, 255, 0.72))",
                                  color: "var(--ct-6e6861, #6E6861)",
                                  fontSize: "0.67rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                }}
                              >
                                <Share2 size={11} />
                                <span className="btn-texto-responsive">Equipo</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Compositor Compacto y Sobrio (Sin botón "Enviar y cerrar" y con "Opciones" anclado sobre el botón en Web) */}
                <form
                  onSubmit={handleEnviarMensaje}
                  style={{
                    background: "var(--cf-ffffff, #FFFFFF)",
                    borderTop: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    padding:
                      modoLayoutInbox === "movil"
                        ? "8px 10px calc(8px + env(safe-area-inset-bottom, 0px))"
                        : "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    position: "relative",
                  }}
                >
                  {mostrarMenuRespuestas && (
                    <div
                      aria-hidden="true"
                      onClick={() => setMostrarMenuRespuestas(false)}
                      style={{
                        position: "fixed",
                        inset: 0,
                        zIndex: 18,
                        background: "transparent",
                      }}
                    />
                  )}

                  {(herramientasCobroPorAtajo.length > 0 ||
                    respuestasSugeridasPorAtajo.length > 0) && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: modoLayoutInbox === "movil" ? "8px" : "12px",
                        right: modoLayoutInbox === "movil" ? "8px" : "12px",
                        marginBottom: "6px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        borderRadius: "12px",
                        boxShadow: "0 12px 28px rgba(24, 24, 27, 0.12)",
                        maxHeight: "260px",
                        overflowY: "auto",
                        zIndex: 25,
                      }}
                    >
                      {herramientasCobroPorAtajo.map((h) => (
                        <button
                          key={h.clave}
                          type="button"
                          onClick={() => handleSeleccionarHerramientaCobro(h.clave)}
                          style={{
                            width: "100%",
                            minHeight: "48px",
                            padding: "9px 12px",
                            border: "none",
                            borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                            background:
                              h.clave === "LINK_PAGO"
                                ? "var(--cf-f4faf6, #F4FAF6)"
                                : h.clave === "CONFIANZA"
                                  ? "var(--cf-fffbeb, #FFFBEB)"
                                  : "var(--cf-f8f7f4, #F8F7F4)",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                            <strong
                              style={{
                                fontSize: "0.8rem",
                                color: "var(--ct-1f1c19, #1F1C19)",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                              }}
                            >
                              {h.clave === "LINK_PAGO" ? (
                                <Link2 size={13} color="#2F4737" />
                              ) : h.clave === "CONFIANZA" ? (
                                <Star size={13} color="#92400E" />
                              ) : (
                                <Building2 size={13} color="#2F4737" />
                              )}
                              <code style={{ color: h.clave === "CONFIANZA" ? "var(--ct-92400e, #92400E)" : "var(--ct-2f4737, #2F4737)", fontWeight: 800 }}>{h.atajo}</code> ·{" "}
                              {h.titulo}
                            </strong>
                            <span
                              style={{
                                fontSize: "0.66rem",
                                fontWeight: 700,
                                color: h.clave === "CONFIANZA" ? "var(--ct-92400e, #92400E)" : "var(--ct-2f4737, #2F4737)",
                                background: h.clave === "CONFIANZA" ? "var(--cf-fef3c7, #FEF3C7)" : "var(--cf-eaf3ed, #EAF3ED)",
                                border: h.clave === "CONFIANZA" ? "1px solid var(--cb-fde68a, #FDE68A)" : "1px solid var(--cb-c6dec9, #C6DEC9)",
                                borderRadius: "999px",
                                padding: "1px 7px",
                                flexShrink: 0,
                              }}
                            >
                              {h.clave === "CONFIANZA" ? "Testimonios" : "Cobro"}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.73rem",
                              color: "var(--ct-57524c, #57524C)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {h.descripcion}
                          </span>
                        </button>
                      ))}

                      {respuestasSugeridasPorAtajo.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSeleccionarRespuestaRapida(r)}
                          style={{
                            width: "100%",
                            minHeight: "46px",
                            padding: "9px 12px",
                            border: "none",
                            borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                            background: "var(--cf-ffffff, #FFFFFF)",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                            <strong style={{ fontSize: "0.79rem", color: "var(--ct-221e1b, #221E1B)" }}>
                              <code style={{ color: "var(--ct-2f4737, #2F4737)" }}>{r.atajo}</code> · {r.titulo}
                            </strong>
                            <span style={{ fontSize: "0.68rem", color: "var(--ct-847d74, #847D74)", flexShrink: 0 }}>
                              {r.categoria}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              color: "var(--ct-6e6861, #6E6861)",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {r.contenido}
                          </span>
                        </button>
                      ))}
                    </div>
                  )}

                  {solicitudTarjetaDetectada && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "7px 10px",
                        borderRadius: "9px",
                        background: "var(--cf-f0fdf4, #F0FDF4)",
                        border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
                        color: "var(--ct-166534, #166534)",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <CreditCard size={15} />
                        <span>El cliente solicitó pago con tarjeta</span>
                      </span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => abrirModalLinkPago()}
                          title="Generar y enviar link de pago con tarjeta (/LinkPago)"
                          aria-label="Generar Link"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 10px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#2F4737",
                            color: "#FFFFFF",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Link2 size={13} />
                          <span>Generar Link</span>
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setSolicitudTarjetaDescartadaMsgId(solicitudTarjetaDetectada.id)
                          }
                          title="Descartar sugerencia"
                          aria-label="Descartar"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--ct-166534, #166534)",
                            cursor: "pointer",
                            padding: "2px 4px",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {qrDeunaSugeridoUrl && !imagenAdjuntaAsesorUrl && !documentoAdjuntoAsesor && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "6px 10px",
                        borderRadius: "9px",
                        background: "var(--cf-f5f3ff, #F5F3FF)",
                        border: "1px solid var(--cb-ddd6fe, #DDD6FE)",
                        color: "var(--ct-4c1d95, #4C1D95)",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                      }}
                    >
                      <span>¿Adjuntar también la imagen del QR DeUna?</span>
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            setImagenAdjuntaAsesorUrl(qrDeunaSugeridoUrl);
                            setQrDeunaSugeridoUrl(null);
                          }}
                          title="Adjuntar código QR DeUna al mensaje"
                          aria-label="Adjuntar QR"
                          style={{
                            padding: "4px 9px",
                            borderRadius: "7px",
                            border: "none",
                            background: "#5B21B6",
                            color: "#FFFFFF",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          Adjuntar QR
                        </button>
                        <button
                          type="button"
                          onClick={() => setQrDeunaSugeridoUrl(null)}
                          title="Ocultar sugerencia QR"
                          aria-label="Cerrar sugerencia QR"
                          style={{
                            border: "none",
                            background: "transparent",
                            color: "var(--ct-4c1d95, #4C1D95)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                          }}
                        >
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                  )}

                  {modoNotaInterna && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "8px",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        background: "var(--cf-faf6ec, #FAF6EC)",
                        border: "1px solid var(--cb-e8dec6, #E8DEC6)",
                        color: "var(--ct-745622, #745622)",
                        fontSize: "0.73rem",
                        fontWeight: 600,
                      }}
                    >
                      <span>Modo nota interna activo (solo equipo)</span>
                      <button
                        type="button"
                        onClick={() => setModoNotaInterna(false)}
                        title="Volver a responder al cliente"
                        aria-label="Cambiar a cliente"
                        style={{
                          border: "1px solid var(--cb-d6c7a9, #D6C7A9)",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          color: "var(--ct-745622, #745622)",
                          borderRadius: "6px",
                          padding: "2px 8px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        ✕ Cliente
                      </button>
                    </div>
                  )}

                  {imagenAdjuntaAsesorUrl && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 10px",
                        borderRadius: "9px",
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      }}
                    >
                      <img
                        src={imagenAdjuntaAsesorUrl}
                        alt="Fotografía adjunta"
                        style={{
                          width: "44px",
                          height: "44px",
                          objectFit: "cover",
                          borderRadius: "7px",
                        }}
                      />
                      <span style={{ fontSize: "0.75rem", color: "var(--ct-3a3530, #3A3530)", flex: 1 }}>
                        Imagen lista para enviar
                      </span>
                      <button
                        type="button"
                        onClick={() => setImagenAdjuntaAsesorUrl(null)}
                        title="Quitar imagen adjunta"
                        aria-label="Quitar imagen"
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "none",
                          background: "transparent",
                          color: "var(--ct-6e6861, #6E6861)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {documentoAdjuntoAsesor && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 10px",
                        borderRadius: "9px",
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      }}
                    >
                      <div
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "8px",
                          background: "var(--cf-f4f2ee, #F4F2EE)",
                          color: "var(--ct-3a3530, #3A3530)",
                          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <FileText size={18} />
                      </div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          color: "var(--ct-221e1b, #221E1B)",
                          flex: 1,
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {documentoAdjuntoAsesor.nombre}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDocumentoAdjuntoAsesor(null)}
                        title="Quitar documento adjunto"
                        aria-label="Quitar documento"
                        style={{
                          width: "32px",
                          height: "32px",
                          border: "none",
                          background: "transparent",
                          color: "var(--ct-6e6861, #6E6861)",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  )}

                  {(() => {
                    const contenidoPanelOpciones =
                      vistaMenuOpciones === "asignar" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              paddingBottom: "8px",
                              borderBottom: "1px solid var(--cb-f4f2ee, #F4F2EE)",
                            }}
                          >
                            <button
                              type="button"
                              onClick={() => setVistaMenuOpciones("principal")}
                              title="Volver a Opciones"
                              aria-label="Volver"
                              style={{
                                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                background: "var(--cf-f8f7f4, #F8F7F4)",
                                color: "var(--ct-3a3530, #3A3530)",
                                borderRadius: "8px",
                                padding: "5px 10px",
                                fontSize: "0.75rem",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                cursor: "pointer",
                              }}
                            >
                              <ArrowLeft size={14} />
                              <span>Volver</span>
                            </button>
                            <strong style={{ fontSize: "0.82rem", color: "var(--ct-221e1b, #221E1B)" }}>
                              Asignar al equipo
                            </strong>
                          </div>

                          <button
                            type="button"
                            onClick={() => {
                              void handleAsignarVendedor("");
                              setMostrarMenuAdjuntar(false);
                              setVistaMenuOpciones("principal");
                            }}
                            style={{
                              width: "100%",
                              minHeight: "42px",
                              padding: "8px 12px",
                              borderRadius: "10px",
                              border: !conversacionActiva.asesoraAsignadaId
                                ? "1px solid var(--cb-221e1b, #221E1B)"
                                : "1px solid var(--cb-e6e2da, #E6E2DA)",
                              background: !conversacionActiva.asesoraAsignadaId
                                ? "var(--cf-f4f2ee, #F4F2EE)"
                                : "var(--cf-ffffff, #FFFFFF)",
                              color: "var(--ct-221e1b, #221E1B)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              fontSize: "0.81rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              textAlign: "left",
                            }}
                          >
                            <span>— Sin asignar (Cola general)</span>
                            {!conversacionActiva.asesoraAsignadaId && (
                              <Check size={15} color="#221E1B" />
                            )}
                          </button>

                          {tablero.equipo.map((m) => {
                            const activo = conversacionActiva.asesoraAsignadaId === m.usuarioId;
                            return (
                              <button
                                key={m.usuarioId}
                                type="button"
                                onClick={() => {
                                  void handleAsignarVendedor(m.usuarioId);
                                  setMostrarMenuAdjuntar(false);
                                  setVistaMenuOpciones("principal");
                                }}
                                style={{
                                  width: "100%",
                                  minHeight: "44px",
                                  padding: "8px 12px",
                                  borderRadius: "10px",
                                  border: activo ? "1px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background: activo ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                                  color: "var(--ct-221e1b, #221E1B)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  cursor: "pointer",
                                  textAlign: "left",
                                }}
                              >
                                <div style={{ display: "flex", flexDirection: "column", gap: "1px" }}>
                                  <span style={{ fontSize: "0.81rem", fontWeight: 700 }}>
                                    {m.usuarioId === tablero.usuarioActualId
                                      ? `Yo (${m.nombre})`
                                      : m.nombre}
                                  </span>
                                  <span style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                                    {m.rol} · {m.chatsActivos} chats activos
                                  </span>
                                </div>
                                {activo && <Check size={15} color="#221E1B" />}
                              </button>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
                            gap: "12px 10px",
                          }}
                        >
                          {[
                            {
                              clave: "nota",
                              etiqueta: modoNotaInterna ? "Modo cliente" : "Nota",
                              titulo: modoNotaInterna
                                ? "Volver a escribir al cliente"
                                : "Escribir Nota Interna para el equipo",
                              esPeligro: false,
                              icono: <StickyNote size={20} />,
                              visible: true,
                              onAccion: () => {
                                setModoNotaInterna((prev) => !prev);
                                setMostrarMenuAdjuntar(false);
                                setTimeout(() => textareaCompositorRef.current?.focus(), 50);
                              },
                            },
                            {
                              clave: "documento",
                              etiqueta: "Documento",
                              titulo: "Adjuntar documento PDF, Word o Excel",
                              esPeligro: false,
                              icono: <FileText size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                inputDocumentoAsesorRef.current?.click();
                              },
                            },
                            {
                              clave: "imagen",
                              etiqueta: "Imagen",
                              titulo: "Seleccionar imagen de la galería",
                              esPeligro: false,
                              icono: <ImagePlus size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                inputFotoAsesorRef.current?.click();
                              },
                            },
                            {
                              clave: "foto",
                              etiqueta: "Foto",
                              titulo: "Tomar foto directa con la cámara",
                              esPeligro: false,
                              icono: <Camera size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                inputCamaraAsesorRef.current?.click();
                              },
                            },
                            {
                              clave: "rapida",
                              etiqueta: "Respuesta '/'",
                              titulo: "Abrir respuestas rápidas (/atajos)",
                              esPeligro: false,
                              icono: <Zap size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                setMostrarMenuRespuestas(true);
                                setTimeout(() => textareaCompositorRef.current?.focus(), 50);
                              },
                            },
                            {
                              clave: "link_pago",
                              etiqueta: "Link Pago",
                              titulo: "Generar y enviar link de pago (/LinkPago) con valor editable",
                              esPeligro: false,
                              icono: <Link2 size={20} color="#2F4737" />,
                              visible: true,
                              onAccion: () => {
                                abrirModalLinkPago();
                              },
                            },
                            {
                              clave: "datos_pago",
                              etiqueta: "Datos Pago",
                              titulo:
                                "Insertar /DatosPago (link DeUna, datos bancarios y opción de tarjeta)",
                              esPeligro: false,
                              icono: <Building2 size={20} color="#2F4737" />,
                              visible: true,
                              onAccion: () => {
                                void aplicarComandoDatosPago();
                              },
                            },
                            {
                              clave: "confianza",
                              etiqueta: "Confianza",
                              titulo:
                                "Insertar /Confianza con el enlace a testimonios y entregas reales",
                              esPeligro: false,
                              icono: <Star size={20} color="#92400E" />,
                              visible: true,
                              onAccion: () => {
                                aplicarComandoConfianza();
                              },
                            },
                            {
                              clave: "catalogo",
                              etiqueta: "Catálogo",
                              titulo:
                                "Enviar producto del catálogo (foto principal + link web + álbum)",
                              esPeligro: false,
                              icono: <Store size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                setModalCatalogoChatAbierto(true);
                              },
                            },
                            {
                              clave: "asignar",
                              etiqueta: "Asignar",
                              titulo: "Asignar esta conversación a un miembro del equipo",
                              esPeligro: false,
                              icono: <UserCheck size={20} />,
                              visible: true,
                              onAccion: () => {
                                setVistaMenuOpciones("asignar");
                              },
                            },
                            {
                              clave: "compartir",
                              etiqueta: "Compartir",
                              titulo: "Compartir conversación en el Chat Grupal del Equipo",
                              esPeligro: false,
                              icono: <Share2 size={20} />,
                              visible: true,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                handleCompartirChatAlEquipo();
                              },
                            },
                            {
                              clave: "eliminar",
                              etiqueta: "Eliminar",
                              titulo:
                                "Eliminar conversación completa (Exclusivo Administrador)",
                              esPeligro: true,
                              icono: <Trash2 size={20} />,
                              visible: esAdminAplicacion,
                              onAccion: () => {
                                setMostrarMenuAdjuntar(false);
                                setConversacionAEliminar(conversacionActiva);
                              },
                            },
                          ]
                            .filter((item) => item.visible)
                            .map((item) => (
                              <button
                                key={item.clave}
                                type="button"
                                onClick={item.onAccion}
                                title={item.titulo}
                                aria-label={item.etiqueta}
                                style={{
                                  border: "none",
                                  background: "transparent",
                                  color: item.esPeligro ? "var(--ct-8a2e2e, #8A2E2E)" : "var(--ct-3a3530, #3A3530)",
                                  display: "flex",
                                  flexDirection: "column",
                                  alignItems: "center",
                                  gap: "6px",
                                  padding: "4px 2px",
                                  cursor: "pointer",
                                }}
                              >
                                <span
                                  style={{
                                    width: "50px",
                                    height: "46px",
                                    borderRadius: "14px",
                                    background: item.esPeligro ? "var(--cf-faf2f2, #FAF2F2)" : "var(--cf-f4f2ee, #F4F2EE)",
                                    border: item.esPeligro
                                      ? "1px solid var(--cb-e5caca, #E5CACA)"
                                      : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                    color: item.esPeligro ? "var(--ct-8a2e2e, #8A2E2E)" : "var(--ct-3a3530, #3A3530)",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {item.icono}
                                </span>
                                <span
                                  style={{
                                    fontSize: "0.74rem",
                                    fontWeight: 600,
                                    color: item.esPeligro ? "var(--ct-8a2e2e, #8A2E2E)" : "var(--ct-57524c, #57524C)",
                                    lineHeight: 1.2,
                                    textAlign: "center",
                                  }}
                                >
                                  {item.etiqueta}
                                </span>
                              </button>
                            ))}
                        </div>
                      );

                    return (
                      <>
                        {/* En móvil: Bottom Sheet sobrio de pantalla inferior; en Web: Backdrop transparente click-outside */}
                        {mostrarMenuAdjuntar &&
                          (modoLayoutInbox === "movil" ? (
                            <div
                              role="dialog"
                              aria-label="Opciones de la conversación"
                              onClick={() => {
                                setMostrarMenuAdjuntar(false);
                                setVistaMenuOpciones("principal");
                              }}
                              style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 9940,
                                background: "rgba(24, 24, 27, 0.42)",
                                backdropFilter: "blur(2px)",
                                display: "flex",
                                alignItems: "flex-end",
                                justifyContent: "center",
                              }}
                            >
                              <div
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  width: "100%",
                                  maxHeight: "82dvh",
                                  overflowY: "auto",
                                  background: "var(--cf-ffffff, #FFFFFF)",
                                  color: "var(--ct-221e1b, #221E1B)",
                                  borderTop: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  borderRadius: "20px 20px 0 0",
                                  padding:
                                    "12px 18px calc(20px + env(safe-area-inset-bottom, 0px))",
                                  boxShadow: "0 -14px 36px rgba(24, 24, 27, 0.18)",
                                }}
                              >
                                <div
                                  style={{
                                    width: "40px",
                                    height: "4px",
                                    borderRadius: "999px",
                                    background: "var(--cf-d5cfc4, #D5CFC4)",
                                    margin: "0 auto 14px",
                                  }}
                                />
                                {contenidoPanelOpciones}
                              </div>
                            </div>
                          ) : (
                            <div
                              aria-hidden="true"
                              onClick={() => {
                                setMostrarMenuAdjuntar(false);
                                setVistaMenuOpciones("principal");
                              }}
                              style={{
                                position: "fixed",
                                inset: 0,
                                zIndex: 35,
                                background: "transparent",
                              }}
                            />
                          ))}

                        <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
                          {/* Inputs ocultos para Imagen (galería), Foto (cámara) y Documento */}
                          <input
                            ref={inputFotoAsesorRef}
                            type="file"
                            accept="image/*"
                            onChange={(e) => {
                              const archivo = e.target.files?.[0];
                              if (archivo) void subirImagenAsesorOmnicanal(archivo);
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                          />
                          <input
                            ref={inputCamaraAsesorRef}
                            type="file"
                            accept="image/*"
                            capture="environment"
                            onChange={(e) => {
                              const archivo = e.target.files?.[0];
                              if (archivo) void subirImagenAsesorOmnicanal(archivo);
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                          />
                          <input
                            ref={inputDocumentoAsesorRef}
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,application/pdf"
                            onChange={(e) => {
                              const archivo = e.target.files?.[0];
                              if (archivo) void subirDocumentoAsesorOmnicanal(archivo);
                              e.target.value = "";
                            }}
                            style={{ display: "none" }}
                          />

                          {/* Contenedor relativo para anclar el Popover de "Opciones" exactamente encima del botón en Web */}
                          <div
                            style={{
                              position: "relative",
                              flexShrink: 0,
                              zIndex: mostrarMenuAdjuntar && modoLayoutInbox !== "movil" ? 45 : undefined,
                            }}
                          >
                            {mostrarMenuAdjuntar && modoLayoutInbox !== "movil" && (
                              <div
                                role="dialog"
                                aria-label="Opciones de la conversación"
                                onClick={(e) => e.stopPropagation()}
                                style={{
                                  position: "absolute",
                                  bottom: "calc(100% + 8px)",
                                  left: 0,
                                  width: "316px",
                                  maxHeight: "72vh",
                                  overflowY: "auto",
                                  background: "var(--cf-ffffff, #FFFFFF)",
                                  color: "var(--ct-221e1b, #221E1B)",
                                  borderRadius: "16px",
                                  padding: "14px",
                                  boxShadow: "0 16px 38px rgba(24, 24, 27, 0.14)",
                                  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  zIndex: 50,
                                }}
                              >
                                {contenidoPanelOpciones}
                              </div>
                            )}

                            <button
                              type="button"
                              className="btn-responsive-accion"
                              disabled={subiendoImagenAsesor}
                              onClick={() => {
                                setMostrarMenuRespuestas(false);
                                setVistaMenuOpciones("principal");
                                setMostrarMenuAdjuntar((prev) => !prev);
                              }}
                              title="Opciones (Nota, Documento, Imagen, Foto, Respuesta '/', Catálogo, Asignar, Compartir)"
                              aria-label="Opciones"
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                                gap: "5px",
                                minWidth: modoLayoutInbox === "movil" ? "42px" : undefined,
                                minHeight: modoLayoutInbox === "movil" ? "42px" : undefined,
                                padding: modoLayoutInbox === "movil" ? "0 10px" : "9px 11px",
                                borderRadius: "10px",
                                border: mostrarMenuAdjuntar
                                  ? "1px solid var(--cb-221e1b, #221E1B)"
                                  : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                background: mostrarMenuAdjuntar ? "#221E1B" : "var(--cf-f8f7f4, #F8F7F4)",
                                color: mostrarMenuAdjuntar ? "#FFFFFF" : "var(--ct-3a3530, #3A3530)",
                                fontSize: "0.78rem",
                                fontWeight: 600,
                                cursor: subiendoImagenAsesor ? "wait" : "pointer",
                                flexShrink: 0,
                              }}
                            >
                              {subiendoImagenAsesor ? (
                                <Loader2 size={16} />
                              ) : (
                                <Plus
                                  size={18}
                                  style={{
                                    transform: mostrarMenuAdjuntar ? "rotate(45deg)" : "none",
                                    transition: "transform 160ms ease",
                                  }}
                                />
                              )}
                              <span className="btn-texto-responsive">Opciones</span>
                            </button>
                          </div>

                          <textarea
                            ref={textareaCompositorRef}
                            value={textoRespuesta}
                            onChange={(e) => setTextoRespuesta(e.target.value)}
                            onPaste={handlePegarImagenCompositor}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" && !e.shiftKey) {
                                e.preventDefault();
                                void handleEnviarMensaje();
                              }
                            }}
                            rows={modoLayoutInbox === "movil" ? 1 : 2}
                            placeholder={
                              modoNotaInterna
                                ? "Nota interna…"
                                : modoLayoutInbox === "movil"
                                  ? "Mensaje, /LinkPago o /DatosPago…"
                                  : "Escribe al cliente, pega una foto (Ctrl+V) o usa /LinkPago, /DatosPago…"
                            }
                            style={{
                              flex: 1,
                              minWidth: 0,
                              minHeight: modoLayoutInbox === "movil" ? "42px" : "44px",
                              maxHeight: "110px",
                              padding: modoLayoutInbox === "movil" ? "9px 11px" : "8px 11px",
                              lineHeight: 1.35,
                              borderRadius: "10px",
                              border: modoNotaInterna ? "1px solid var(--cb-d6c7a9, #D6C7A9)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              background: modoNotaInterna ? "var(--cf-faf6ec, #FAF6EC)" : "var(--cf-ffffff, #FFFFFF)",
                              color: "var(--ct-221e1b, #221E1B)",
                              fontSize: modoLayoutInbox === "movil" ? "16px" : "0.83rem",
                              fontFamily: "inherit",
                              resize: "none",
                            }}
                          />

                          <button
                            type="submit"
                            className="btn-responsive-accion"
                            disabled={
                              enviandoMensaje ||
                              (!textoRespuesta.trim() &&
                                !imagenAdjuntaAsesorUrl &&
                                !documentoAdjuntoAsesor)
                            }
                            title={modoNotaInterna ? "Guardar nota interna" : "Enviar respuesta al cliente"}
                            aria-label="Enviar"
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              gap: "6px",
                              minWidth: modoLayoutInbox === "movil" ? "44px" : undefined,
                              minHeight: modoLayoutInbox === "movil" ? "42px" : undefined,
                              padding: modoLayoutInbox === "movil" ? "0 12px" : "10px 14px",
                              borderRadius: "10px",
                              border: "none",
                              background: modoNotaInterna ? "#44403C" : "#221E1B",
                              color: "#FFFFFF",
                              fontSize: "0.82rem",
                              fontWeight: 600,
                              cursor: enviandoMensaje ? "wait" : "pointer",
                              opacity:
                                !textoRespuesta.trim() &&
                                !imagenAdjuntaAsesorUrl &&
                                !documentoAdjuntoAsesor
                                  ? 0.48
                                  : 1,
                              flexShrink: 0,
                            }}
                          >
                            {enviandoMensaje ? <Loader2 size={16} /> : <Send size={16} />}
                            <span className="btn-texto-responsive">
                              {modoNotaInterna ? "Guardar" : "Enviar"}
                            </span>
                          </button>
                        </div>
                      </>
                    );
                  })()}
                </form>
              </>
            )}
          </div>

            {/* COLUMNA 3: CAMPOS DE VENTA (PEDIDO / ENTREGA / TARJETA) Y FICHA 360° */}
            <div
              style={{
                background: "var(--cf-faf8f5, #FAF8F5)",
                padding: "12px",
                display:
                  (modoLayoutInbox === "desktop" && fichaDerechaDesktop) ||
                  (modoLayoutInbox === "tablet" && mostrarFichaTablet) ||
                  (modoLayoutInbox === "movil" && vistaMovilInbox === "ficha")
                    ? "flex"
                    : "none",
                flexDirection: "column",
                gap: "11px",
                minHeight: 0,
                overflowY: "auto",
                minWidth: 0,
              }}
            >
              {modoLayoutInbox !== "desktop" && (
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    paddingBottom: "8px",
                    borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
                  }}
                >
                  <strong style={{ fontSize: "0.86rem", color: "var(--ct-221e1b, #221E1B)" }}>
                    Campos de Venta y Datos 360°
                  </strong>
                  <button
                    type="button"
                    onClick={() => {
                      if (modoLayoutInbox === "movil") {
                        setVistaMovilInbox("chat");
                      } else {
                        setMostrarFichaTablet(false);
                      }
                    }}
                    title="Volver al visor de conversación"
                    aria-label="Volver al chat"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      padding: "5px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-221e1b, #221E1B)",
                      fontSize: "0.75rem",
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={13} />
                    <span>Chat</span>
                  </button>
                </div>
              )}

              {!conversacionActiva ? (
                <div style={{ fontSize: "0.8rem", color: "var(--ct-847d74, #847D74)" }}>
                  <strong style={{ color: "var(--ct-221e1b, #221E1B)" }}>Resumen Rápido del Portal</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "var(--ct-847d74, #847D74)" }}>Usuarios Registrados Web</div>
                      <strong style={{ fontSize: "0.92rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        {metricas.totalUsuariosRegistradosWeb}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "var(--ct-847d74, #847D74)" }}>
                        Compras Web (Reg. / Invitados)
                      </div>
                      <strong style={{ fontSize: "0.9rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        {metricas.comprasUsuariosRegistrados} reg. ·{" "}
                        {metricas.comprasInvitadosNoRegistrados} inv.
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "var(--cf-f2f5f3, #F2F5F3)",
                        border: "1px solid var(--cb-dce4df, #DCE4DF)",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "var(--ct-2f4737, #2F4737)" }}>
                        Resolución Autónoma IA ARIA
                      </div>
                      <strong style={{ fontSize: "0.92rem", color: "var(--ct-2f4737, #2F4737)" }}>
                        {metricas.porcentajeResolucionIa}%
                      </strong>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  {/* SECCIÓN PRINCIPAL: CAMPOS DE VENTA DEPURADOS (PEDIDO / ENTREGA / TARJETA + ENVÍO A TALLER) */}
                  <PanelCamposVentaChat
                    negocio={negNorm}
                    conversacion={conversacionActiva}
                    mensajes={mensajesActivos}
                    onGuardado={(datosActualizados, nuevoNombreCliente) => {
                      setTablero((prev) => ({
                        ...prev,
                        conversaciones: prev.conversaciones.map((c) =>
                          c.id === conversacionActiva.id
                            ? {
                                ...c,
                                remitenteNombre:
                                  nuevoNombreCliente && nuevoNombreCliente.trim()
                                    ? nuevoNombreCliente.trim()
                                    : c.remitenteNombre,
                                datosVenta: datosActualizados,
                              }
                            : c
                        ),
                      }));
                    }}
                    onNotificar={(aviso) => {
                      setMensajeInfo(aviso);
                    }}
                    onAbrirLinkPago={(montoActual) => {
                      abrirModalLinkPago(montoActual > 0 ? montoActual : null);
                    }}
                  />

                  {/* Perfil compacto y sobrio del contacto (clic para abrir Ficha 360°) */}
                  <div
                    onClick={() =>
                      setModalFichaClienteContexto({
                        conversacion: conversacionActiva,
                        contactoDirectorio: contactoVinculadoActivo,
                      })
                    }
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        setModalFichaClienteContexto({
                          conversacion: conversacionActiva,
                          contactoDirectorio: contactoVinculadoActivo,
                        });
                      }
                    }}
                    title="Clic para ver y editar ficha completa del cliente"
                    style={{
                      padding: "10px 11px",
                      borderRadius: "11px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "5px",
                      cursor: "pointer",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 600,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          background: "var(--cf-f4f2ee, #F4F2EE)",
                          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                          color: "var(--ct-57524c, #57524C)",
                        }}
                      >
                        {contactoVinculadoActivo?.tipoCuenta === "USUARIO_REGISTRADO" ||
                        conversacionActiva.usuarioId
                          ? "Registrado Web"
                          : comprasDeConversacionActiva.length > 0
                            ? "Comprador invitado"
                            : "Contacto directo"}
                      </span>
                      <span
                        style={{
                          fontSize: "0.68rem",
                          color: "var(--ct-57524c, #57524C)",
                          fontWeight: 600,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Pencil size={11} />
                        <span>Editar ficha</span>
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      <strong style={{ fontSize: "0.84rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        {conversacionActiva.remitenteNombre}
                      </strong>
                      {conversacionActiva.fichaCliente?.calificacionEstrellas != null &&
                        conversacionActiva.fichaCliente.calificacionEstrellas > 0 && (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "2px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              color: "var(--ct-b45309, #B45309)",
                            }}
                          >
                            <Star size={11} fill="#D97706" color="#D97706" />
                            <span>{conversacionActiva.fichaCliente.calificacionEstrellas}/5</span>
                          </span>
                        )}
                    </div>

                    {conversacionActiva.remitenteTelefono && (
                      <span style={{ fontSize: "0.74rem", color: "var(--ct-6e6861, #6E6861)" }}>
                        WhatsApp: {conversacionActiva.remitenteTelefono}
                      </span>
                    )}
                    {(() => {
                      const lineaFicha = resolverLineaWhatsappConversacion(
                        conversacionActiva,
                        tablero.lineasWhatsapp
                      );
                      if (!lineaFicha) return null;
                      return (
                        <span
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontSize: "0.72rem",
                            fontWeight: 700,
                            color: lineaFicha.color,
                          }}
                        >
                          <Smartphone size={11} />
                          <span>
                            Línea: {lineaFicha.nombre}
                            {lineaFicha.numero ? ` (${lineaFicha.numero})` : ""}
                          </span>
                        </span>
                      );
                    })()}
                    {conversacionActiva.remitenteCorreo && (
                      <span style={{ fontSize: "0.74rem", color: "var(--ct-6e6861, #6E6861)", wordBreak: "break-all" }}>
                        {conversacionActiva.remitenteCorreo}
                      </span>
                    )}
                    {conversacionActiva.fichaCliente?.notasCliente && (
                      <div
                        style={{
                          marginTop: "2px",
                          padding: "5px 8px",
                          borderRadius: "7px",
                          background: "var(--cf-faf6ec, #FAF6EC)",
                          border: "1px solid var(--cb-e8dec6, #E8DEC6)",
                          color: "var(--ct-745622, #745622)",
                          fontSize: "0.72rem",
                          lineHeight: 1.38,
                        }}
                      >
                        📝 {conversacionActiva.fichaCliente.notasCliente}
                      </div>
                    )}
                    {conversacionActiva.puenteOmnicanal?.ultimoProductoVistoWeb?.productoNombre && (
                      <div
                        style={{
                          marginTop: "2px",
                          padding: "5px 8px",
                          borderRadius: "7px",
                          background: "var(--cf-f2f6f3, #F2F6F3)",
                          border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                          color: "var(--ct-2b4a36, #2B4A36)",
                          fontSize: "0.71rem",
                          lineHeight: 1.35,
                        }}
                      >
                        🛍️ Vio en Web:{" "}
                        <strong>
                          {conversacionActiva.puenteOmnicanal.ultimoProductoVistoWeb.productoNombre}
                        </strong>
                      </div>
                    )}
                    <span style={{ fontSize: "0.67rem", color: "var(--ct-847d74, #847D74)" }}>
                      Mensajes IA: {conversacionActiva.mensajesIaConteo} · Humanos:{" "}
                      {conversacionActiva.mensajesHumanoConteo}
                    </span>
                  </div>

                  {/* Historial de Compras y Proformas Web de este contacto */}
                  {comprasDeConversacionActiva.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>
                        Compras Web Vinculadas ({comprasDeConversacionActiva.length})
                      </span>
                      {comprasDeConversacionActiva.map((ord) => (
                        <div
                          key={ord.id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "9px",
                            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                            background: "var(--cf-ffffff, #FFFFFF)",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: "0.76rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                              {ord.codigoOrden}
                            </strong>
                            <strong style={{ fontSize: "0.76rem", color: "var(--ct-2f4737, #2F4737)" }}>
                              ${Number(ord.total).toFixed(2)}
                            </strong>
                          </div>
                          <span style={{ fontSize: "0.69rem", color: "var(--ct-847d74, #847D74)" }}>
                            {ord.estado} ·{" "}
                            {new Date(ord.creadoEn).toLocaleDateString("es-EC", {
                              day: "2-digit",
                              month: "short",
                            })}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* APOYO DE TALLER PARA VENDEDORAS: DISPONIBLES 1-2H E INVENTARIO DE ROSAS */}
                  {disponiblesHoy.length > 0 && (
                    <div
                      style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "6px",
                        paddingTop: "8px",
                        borderTop: "1px solid var(--cb-ece8e1, #ECE8E1)",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "var(--ct-745622, #745622)",
                          textTransform: "uppercase",
                        }}
                      >
                        ⚡ Entrega Inmediata 1–2h ({disponiblesHoy.length})
                      </span>
                      {disponiblesHoy.slice(0, 4).map((disp) => (
                        <div
                          key={disp.productoId}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "7px 8px",
                            borderRadius: "9px",
                            border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                            background: "var(--cf-faf6ee, #FAF6EE)",
                          }}
                        >
                          {disp.imagenUrl && (
                            <img
                              src={disp.imagenUrl}
                              alt={disp.nombre}
                              style={{
                                width: "34px",
                                height: "34px",
                                borderRadius: "6px",
                                objectFit: "cover",
                              }}
                            />
                          )}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong
                              style={{
                                display: "block",
                                fontSize: "0.74rem",
                                color: "var(--ct-1f1c19, #1F1C19)",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {disp.nombre}
                            </strong>
                            <span style={{ fontSize: "0.71rem", color: "var(--ct-2f4737, #2F4737)", fontWeight: 700 }}>
                              ${Number(disp.precio).toFixed(2)}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              const orig =
                                typeof window !== "undefined" ? window.location.origin : "";
                              const bloqueFoto =
                                disp.imagenUrl && /^https?:\/\//i.test(disp.imagenUrl)
                                  ? `\n![${disp.nombre}](${disp.imagenUrl})\n`
                                  : " ";
                              setTextoRespuesta(
                                `¡Tenemos disponible para entrega inmediata (1 a 2 horas) *${disp.nombre}* por $${Number(disp.precio).toFixed(2)} USD! 🌸${bloqueFoto}Puedes pedirlo directo aquí: ${orig}/producto/${disp.slug}`
                              );
                            }}
                            title="Insertar oferta de entrega inmediata en el mensaje"
                            aria-label="Ofrecer arreglo"
                            style={{
                              padding: "4px 8px",
                              borderRadius: "7px",
                              border: "none",
                              background: "#8F6A2E",
                              color: "#FFFFFF",
                              fontSize: "0.7rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Ofrecer
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {ultimoInvRosas && (
                    <div
                      style={{
                        padding: "8px 10px",
                        borderRadius: "9px",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        fontSize: "0.72rem",
                        color: "var(--ct-57524c, #57524C)",
                      }}
                    >
                      <strong style={{ display: "block", color: "var(--ct-1f1c19, #1F1C19)", marginBottom: "2px" }}>
                        🌹 Rosas ({formatearFechaCorteInventario(ultimoInvRosas.fechaCorte)})
                      </strong>
                      <span>{formatearResumenInventarioTexto(ultimoInvRosas.resumenColores)}</span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 2: COMPRAS REALIZADAS EN LA WEB (REGISTRADOS Y NO REGISTRADOS)
      ===================================================================== */}
      {pestana === "compras" && (
        <div
          style={{
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            borderRadius: "16px",
            padding: "clamp(14px, 3vw, 20px)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Compras y Proformas Web — Usuarios Registrados e Invitados
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--ct-847d74, #847D74)" }}>
                Monitorea todas las ventas generadas en el e-commerce distinguiendo clientes con
                cuenta registrada vs compradores invitados sin registro, e inicia seguimiento en 1
                clic.
              </p>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(
                [
                  { id: "todos", texto: `Todas (${metricas.totalComprasWeb})` },
                  {
                    id: "registrados",
                    texto: `✅ Registrados (${metricas.comprasUsuariosRegistrados})`,
                  },
                  {
                    id: "invitados",
                    texto: `🛒 No Registrados (${metricas.comprasInvitadosNoRegistrados})`,
                  },
                  { id: "eventos", texto: "✨ Eventos / Proformas" },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroTipoComprador(f.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border:
                      filtroTipoComprador === f.id ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: filtroTipoComprador === f.id ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                    color: filtroTipoComprador === f.id ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </div>

          <DataGrid
            columnas={columnasComprasWeb}
            filas={pedidosFiltradosTab}
            idFila={(r) => r.id}
            nombreExportacion={`compras-web-${negNorm}`}
            contenidoExpandible={(p) => (
              <div
                style={{
                  padding: "10px 14px",
                  background: "var(--cf-f8f7f4, #F8F7F4)",
                  borderRadius: "10px",
                  fontSize: "0.8rem",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px",
                }}
              >
                <strong>Detalle de Productos ({p.items?.length || 0}):</strong>
                {(p.items ?? []).map((it, idx) => (
                  <div key={idx}>
                    • {it.cantidad} × {it.descripcion} — ${Number(it.totalLinea).toFixed(2)}
                    {it.dedicatoria?.mensaje ? ` (💌 "${it.dedicatoria.mensaje}")` : ""}
                  </div>
                ))}
                {p.logistica?.direccion && (
                  <div>
                    📍 <strong>Entrega:</strong> {p.logistica.direccion} (
                    {p.logistica.destinatarioNombre})
                  </div>
                )}
              </div>
            )}
          />
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 3: USUARIOS REGISTRADOS EN LA WEB Y CONTACTOS INVITADOS 360°
      ===================================================================== */}
      {pestana === "usuarios" && (
        <div
          style={{
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-e6e2da, #E6E2DA)",
            borderRadius: "16px",
            padding: "clamp(14px, 3vw, 20px)",
            display: "flex",
            flexDirection: "column",
            gap: "16px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
            }}
          >
            <div>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                Directorio Unificado de Usuarios Web y Compradores Invitados
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "var(--ct-847d74, #847D74)" }}>
                Sustituye la base de suscriptores de ManyChat sin cobro por contacto almacenado,
                cruzando membresías web, autorización LOPDP y compras acumuladas.
              </p>
            </div>

            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(
                [
                  { id: "todos", texto: `Todos (${tablero.usuariosYClientes.length})` },
                  {
                    id: "registrados",
                    texto: `✅ Registrados Web (${metricas.totalUsuariosRegistradosWeb})`,
                  },
                  {
                    id: "invitados",
                    texto: `🛒 Invitados (${
                      tablero.usuariosYClientes.length - metricas.totalUsuariosRegistradosWeb
                    })`,
                  },
                ] as const
              ).map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroTipoUsuarioDir(f.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "8px",
                    border:
                      filtroTipoUsuarioDir === f.id ? "1px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: filtroTipoUsuarioDir === f.id ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                    color: filtroTipoUsuarioDir === f.id ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f.texto}
                </button>
              ))}
            </div>
          </div>

          <DataGrid
            columnas={columnasUsuariosWeb}
            filas={contactosFiltradosTab}
            idFila={(u) => u.claveUnica}
            nombreExportacion={`clientes-omnicanal-${negNorm}`}
          />
        </div>
      )}

      {/* =====================================================================
          PESTAÑA 4: TELEMETRÍA IA ARIA VS HUMANO, PLANTILLAS Y CANALES SOCIALES
      ===================================================================== */}
      {pestana === "ia_config" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
          {/* Bloque 1: Comparativa Respuestas IA (ARIA) vs Intervenciones Humanas */}
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "clamp(14px, 3vw, 20px)",
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))",
              gap: "14px",
            }}
          >
            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "var(--cf-f2f6f3, #F2F6F3)",
                border: "1px solid var(--cb-ceddd3, #CEDDD3)",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-2b4a36, #2B4A36)" }}>
                🤖 Respuestas Automáticas ARIA
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "var(--ct-2f4737, #2F4737)", marginTop: "4px" }}>
                {metricas.totalRespuestasAria}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--ct-2b4a36, #2B4A36)" }}>
                {metricas.porcentajeResolucionIa}% de hilos sin escalamiento humano
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "var(--cf-f4f2ee, #F4F2EE)",
                border: "1px solid var(--cb-ddd8ce, #DDD8CE)",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-3a3530, #3A3530)" }}>
                👩‍💼 Intervenciones de Vendedores
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "var(--ct-221e1b, #221E1B)", marginTop: "4px" }}>
                {metricas.totalIntervencionesHumanas}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--ct-3a3530, #3A3530)" }}>
                {metricas.enAtencionHumana} conversaciones bajo control humano hoy
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "var(--cf-faf6ee, #FAF6EE)",
                border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-745622, #745622)" }}>
                🚨 Escalados / En Cola
              </div>
              <div style={{ fontSize: "1.08rem", fontWeight: 800, color: "var(--ct-745622, #745622)", marginTop: "4px" }}>
                {metricas.escaladasHumano}
              </div>
              <div style={{ fontSize: "0.73rem", color: "var(--ct-745622, #745622)" }}>
                {metricas.sinAsignar} hilos abiertos sin vendedor asignado
              </div>
            </div>
          </div>

          {/* Bloque 2: Gestor de Mensajes Predeterminados (/atajo) */}
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "16px",
              padding: "clamp(14px, 3vw, 20px)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
                ⚡ Mensajes Predeterminados (Snippets para Vendedores)
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.79rem", color: "var(--ct-847d74, #847D74)" }}>
                Invócalos escribiendo <code>/</code> en el chat. Soporta variables dinámicas{" "}
                <code>{"{{nombre}}"}</code> y <code>{"{{asesor}}"}</code>.
              </p>
            </div>

            <form
              onSubmit={handleGuardarRespuestaRapida}
              style={{
                display: "grid",
                gridTemplateColumns:
                  modoLayoutInbox === "desktop" ? "140px 1fr 150px auto" : "minmax(0, 1fr)",
                gap: "8px",
                alignItems: "start",
                background: "var(--cf-f8f7f4, #F8F7F4)",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              }}
            >
              <input
                type="text"
                value={formRespuesta.atajo}
                onChange={(e) => setFormRespuesta((p) => ({ ...p, atajo: e.target.value }))}
                placeholder="/atajo"
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.8rem",
                }}
              />
              <input
                type="text"
                value={formRespuesta.titulo}
                onChange={(e) => setFormRespuesta((p) => ({ ...p, titulo: e.target.value }))}
                placeholder="Título descriptivo (ej. Horarios de entrega)"
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.8rem",
                }}
              />
              <input
                type="text"
                value={formRespuesta.categoria}
                onChange={(e) => setFormRespuesta((p) => ({ ...p, categoria: e.target.value }))}
                placeholder="Categoría"
                style={{
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.8rem",
                }}
              />
              <button
                type="submit"
                disabled={guardandoRespuesta}
                title="Guardar mensaje predeterminado"
                aria-label="Guardar plantilla"
                style={{
                  padding: "8px 14px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#1F1C19",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Guardar
              </button>
              <textarea
                value={formRespuesta.contenido}
                onChange={(e) => setFormRespuesta((p) => ({ ...p, contenido: e.target.value }))}
                rows={2}
                placeholder="Hola {{nombre}}, te saluda {{asesor}}…"
                style={{
                  gridColumn: "1 / -1",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.8rem",
                  fontFamily: "inherit",
                }}
              />
            </form>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(min(260px, 100%), 1fr))",
                gap: "10px",
              }}
            >
              {tablero.respuestasRapidas.map((r) => (
                <div
                  key={r.id}
                  style={{
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                      <strong style={{ fontSize: "0.82rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                        <code style={{ color: "var(--ct-221e1b, #221E1B)" }}>{r.atajo}</code> · {r.titulo}
                      </strong>
                      <button
                        type="button"
                        onClick={() =>
                          void eliminarRespuestaRapidaOmnicanalAction(negNorm, r.id).then(() =>
                            recargarTablero(true)
                          )
                        }
                        title="Eliminar mensaje predeterminado"
                        aria-label="Eliminar"
                        style={{
                          border: "none",
                          background: "transparent",
                          color: "var(--ct-8a2e2e, #8A2E2E)",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.76rem", color: "var(--ct-57524c, #57524C)", lineHeight: 1.45 }}>
                      {r.contenido}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Visor de imagen a pantalla completa (Ampliar, Descargar, Reenviar WA o Al Equipo) */}
      <ModalVisorImagenChat
        abierto={Boolean(visorImagenDatos)}
        datos={visorImagenDatos}
        onCerrar={() => setVisorImagenDatos(null)}
        onAbrirReenvio={(destinoInicial) => {
          if (!visorImagenDatos) return;
          const actual = visorImagenDatos;
          setVisorImagenDatos(null);
          setReenvioModalDatos({
            destino: destinoInicial,
            payload: {
              imagenUrl: actual.url,
              tituloImagen: actual.titulo,
              textoOriginal: actual.contextoReenvio?.textoOriginal ?? "",
              contextoCliente: actual.contextoReenvio,
            },
          });
        }}
      />

      {/* Modal de reenvío rápido (a Chat Grupal del Equipo con @mención o a otro WhatsApp) */}
      <ModalReenviarMensajeChat
        abierto={Boolean(reenvioModalDatos)}
        negocio={negNorm}
        destinoInicial={reenvioModalDatos?.destino ?? "equipo"}
        datos={reenvioModalDatos?.payload ?? null}
        conversacionesWhatsapp={chatsWhatsappResumen}
        onCerrar={() => setReenvioModalDatos(null)}
        onExito={(confirmacion) => {
          setMensajeInfo(confirmacion);
          void recargarTablero(true);
        }}
      />

      {/* Modal selector de producto del Catálogo para enviar foto principal + link web + álbum */}
      <ModalSelectorCatalogoChat
        abierto={modalCatalogoChatAbierto}
        negocio={negNorm}
        wref={
          conversacionActiva &&
          conversacionActiva.canal === "whatsapp" &&
          /^[0-9a-f-]{36}$/i.test(conversacionActiva.id)
            ? generarCodigoRefWhatsapp(conversacionActiva.id)
            : null
        }
        esMovil={modoLayoutInbox === "movil"}
        enviandoDirecto={enviandoMensaje}
        onCerrar={() => setModalCatalogoChatAbierto(false)}
        onInsertarEnCompositor={handleInsertarProductoCatalogoEnCompositor}
        onEnviarDirecto={(sel) => void handleEnviarProductoCatalogoDirecto(sel)}
      />

      {/* Modal de Ficha Unificada del Cliente (Nombre editable, WhatsApp, Estrellas 1-5 y Notas) */}
      <ModalFichaClienteOmnicanal
        abierto={Boolean(modalFichaClienteContexto)}
        negocio={negNorm}
        esMovil={modoLayoutInbox === "movil"}
        conversacion={modalFichaClienteContexto?.conversacion ?? null}
        contactoDirectorio={modalFichaClienteContexto?.contactoDirectorio ?? null}
        todasConversaciones={tablero.conversaciones}
        pedidosWeb={tablero.pedidosWeb}
        onCerrar={() => setModalFichaClienteContexto(null)}
        onSeleccionarConversacion={(convDestinoId) => {
          setPestana("inbox");
          setEstadoAperturaFiltro("todos");
          setCanalFiltro("todos");
          setConversacionActivaId(convDestinoId);
          setVistaMovilInbox("chat");
        }}
        onGuardado={(resultado) => {
          const idsSet = new Set(resultado.conversacionesActualizadasIds);
          const telRes = normalizarTelefonoOmnicanal(resultado.remitenteTelefono);
          const mailRes = String(resultado.remitenteCorreo || "").trim().toLowerCase();

          setTablero((prev) => ({
            ...prev,
            conversaciones: prev.conversaciones.map((c) => {
              const telC = normalizarTelefonoOmnicanal(c.remitenteTelefono);
              const mailC = String(c.remitenteCorreo || "").trim().toLowerCase();
              const coincide =
                idsSet.has(c.id) ||
                (telRes && telRes.length >= 8 && telC === telRes) ||
                (mailRes && mailC && mailC === mailRes);
              if (!coincide) return c;
              const esPrincipal = modalFichaClienteContexto?.conversacion?.id === c.id;
              return {
                ...c,
                remitenteNombre: resultado.remitenteNombre,
                remitenteTelefono: esPrincipal
                  ? resultado.remitenteTelefono
                  : c.remitenteTelefono || resultado.remitenteTelefono,
                remitenteCorreo: esPrincipal
                  ? resultado.remitenteCorreo
                  : c.remitenteCorreo || resultado.remitenteCorreo,
                fichaCliente: resultado.fichaCliente,
              };
            }),
            usuariosYClientes: prev.usuariosYClientes.map((u) => {
              const telU = normalizarTelefonoOmnicanal(u.telefono);
              const mailU = String(u.correo || "").trim().toLowerCase();
              const esMismoContacto =
                modalFichaClienteContexto?.contactoDirectorio?.claveUnica === u.claveUnica ||
                (telRes && telRes.length >= 8 && telU === telRes) ||
                (mailRes && mailU && mailU === mailRes);
              if (!esMismoContacto) return u;
              return {
                ...u,
                nombre: resultado.remitenteNombre,
                telefono: resultado.remitenteTelefono || u.telefono,
                correo: resultado.remitenteCorreo || u.correo,
                calificacionEstrellas: resultado.fichaCliente.calificacionEstrellas ?? null,
                notasCliente: resultado.fichaCliente.notasCliente ?? null,
              };
            }),
          }));
          setMensajeInfo("Ficha del cliente guardada y sincronizada en todos sus canales.");
        }}
      />

      {/* Modal generador de Link de Pago desde Chat (/LinkPago) */}
      <ModalLinkPagoChat
        abierto={modalLinkPagoAbierto}
        negocio={negNorm}
        conversacion={conversacionActiva}
        mensajes={mensajesActivos}
        montoInicialOverride={montoLinkPagoOverride}
        esMovil={modoLayoutInbox === "movil"}
        enviandoChat={enviandoMensaje}
        onCerrar={() => {
          setModalLinkPagoAbierto(false);
          setMontoLinkPagoOverride(null);
        }}
        onEnviarLinkAlChat={handleEnviarLinkPagoDesdeModal}
        onInsertarEnCompositor={handleInsertarLinkPagoEnCompositor}
      />

      {/* Modal de administración de etiquetas (restringido a Admin y Operador de la tienda) */}
      {Boolean(tablero.esAdminEtiquetas) && (
        <ModalAdministrarEtiquetas
          abierto={modalEtiquetasAbierto}
          negocio={negNorm}
          etiquetas={etiquetasClasificacion}
          onCerrar={() => setModalEtiquetasAbierto(false)}
          onActualizado={() => {
            void recargarTablero(true);
          }}
        />
      )}

      {/* Modal de confirmación para eliminar una conversación completa (exclusivo Administrador) */}
      {esAdminAplicacion && conversacionAEliminar && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Confirmar eliminación de conversación"
          onClick={() => {
            if (!eliminandoConversacion) setConversacionAEliminar(null);
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9994,
            background: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(2px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: "100%",
              maxWidth: "420px",
              background: "var(--cf-ffffff, #FFFFFF)",
              borderRadius: "16px",
              border: "1px solid var(--cb-e5caca, #E5CACA)",
              boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
              padding: "20px",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
              <div
                style={{
                  width: "40px",
                  height: "40px",
                  borderRadius: "10px",
                  background: "var(--cf-faf2f2, #FAF2F2)",
                  border: "1px solid var(--cb-e5caca, #E5CACA)",
                  color: "var(--ct-8a2e2e, #8A2E2E)",
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0,
                }}
              >
                <Trash2 size={20} />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px", minWidth: 0 }}>
                <strong style={{ fontSize: "0.96rem", color: "var(--ct-1f1c19, #1F1C19)" }}>
                  ¿Eliminar conversación completa?
                </strong>
                <span style={{ fontSize: "0.82rem", color: "var(--ct-57524c, #57524C)", lineHeight: 1.48 }}>
                  Se eliminará el hilo completo con{" "}
                  <strong style={{ color: "var(--ct-1f1c19, #1F1C19)" }}>
                    {conversacionAEliminar.remitenteNombre}
                  </strong>
                  {conversacionAEliminar.remitenteTelefono
                    ? ` (${conversacionAEliminar.remitenteTelefono})`
                    : ""}{" "}
                  y todos sus mensajes de la bandeja omnicanal.
                </span>
              </div>
            </div>

            <div
              style={{
                padding: "8px 11px",
                borderRadius: "9px",
                background: "var(--cf-faf6ee, #FAF6EE)",
                border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                color: "var(--ct-745622, #745622)",
                fontSize: "0.75rem",
                lineHeight: 1.4,
              }}
            >
              ⚠️ Acción exclusiva de Administrador. Si la persona vuelve a escribir en el futuro,
              se abrirá una conversación nueva limpia.
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                disabled={eliminandoConversacion}
                onClick={() => setConversacionAEliminar(null)}
                title="Cancelar y conservar conversación"
                aria-label="Cancelar"
                style={{
                  minHeight: "40px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  background: "var(--cf-ffffff, #FFFFFF)",
                  color: "var(--ct-57524c, #57524C)",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: eliminandoConversacion ? "not-allowed" : "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                disabled={eliminandoConversacion}
                onClick={() => void handleConfirmarEliminarConversacion()}
                title="Eliminar conversación permanentemente"
                aria-label="Eliminar conversación"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "6px",
                  minHeight: "40px",
                  padding: "8px 16px",
                  borderRadius: "10px",
                  border: "none",
                  background: "#8A2E2E",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: eliminandoConversacion ? "wait" : "pointer",
                }}
              >
                {eliminandoConversacion ? <Loader2 size={15} /> : <Trash2 size={15} />}
                <span>{eliminandoConversacion ? "Eliminando…" : "Eliminar"}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
