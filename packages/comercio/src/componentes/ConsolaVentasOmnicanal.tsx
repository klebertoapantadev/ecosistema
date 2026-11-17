"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bot,
  CheckCircle2,
  ClipboardList,
  Clock,
  Download,
  Filter,
  Forward,
  ImagePlus,
  Inbox,
  Loader2,
  MailWarning,
  MessageCircle,
  MessageSquare,
  PanelRightClose,
  PanelRightOpen,
  Pause,
  Play,
  RefreshCw,
  Search,
  Send,
  Settings2,
  Share2,
  ShoppingBag,
  Sparkles,
  Tag,
  Trash2,
  Users,
  X,
  Zap,
  ZoomIn,
} from "lucide-react";
import {
  listarEntregaInmediataAction,
  obtenerInventarioRosasAction,
} from "../acciones-operaciones-taller";
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
  eliminarRespuestaRapidaOmnicanalAction,
  enviarMensajeAsesorOmnicanalAction,
  guardarRespuestaRapidaOmnicanalAction,
  obtenerMensajesConversacionAction,
  obtenerTableroOmnicanalAction,
  sincronizarHistorialAriaOmnicanalAction,
  type DatosTableroOmnicanal,
  type PedidoWebConTipoCliente,
} from "../acciones-omnicanal";
import {
  calcularMetricasOmnicanal,
  emparejarComprasConConversacion,
  extraerSegmentosMultimediaMensaje,
  extraerTodasLasImagenesMensaje,
  interpolarRespuestaRapida,
  limpiarVistaPreviaMensajeOmnicanal,
  nombreCanalRealtimeOmnicanal,
  type CanalOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ConversacionOmnicanal,
  type ConversacionWhatsappResumen,
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
} from "./IconoCanalOmnicanal";
import { ModalAdministrarEtiquetas } from "./ModalAdministrarEtiquetas";
import { PanelCamposVentaChat } from "./PanelCamposVentaChat";
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

type PestanaPrincipal = "inbox" | "chat_equipo" | "compras" | "usuarios" | "ia_config";
type FiltroBandejaIzquierda =
  | "todos"
  | "no_asignado"
  | "mios"
  | "escalados"
  | "ia_activa"
  | "recordatorios"
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

function renderTextoConEnlaces(texto: string, esFondoOscuro: boolean): React.ReactNode {
  const partes = texto.split(/(https?:\/\/[^\s]+)/g);
  return partes.map((parte, idx) => {
    if (/^https?:\/\//i.test(parte)) {
      return (
        <a
          key={idx}
          href={parte}
          target="_blank"
          rel="noreferrer"
          style={{
            color: esFondoOscuro ? "#BAE6FD" : "#0284C7",
            textDecoration: "underline",
            wordBreak: "break-all",
          }}
        >
          {parte}
        </a>
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
  const srcEfectivo = usarProxy ? construirUrlProxyMediaOmnicanal(url, false) : url;

  return (
    <div
      style={{
        display: "inline-flex",
        flexDirection: "column",
        gap: "5px",
        maxWidth: "245px",
      }}
    >
      <div
        role="button"
        tabIndex={0}
        onClick={onAmpliar}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onAmpliar();
        }}
        title={alt ? `Ampliar imagen: ${alt}` : "Clic para ampliar imagen"}
        aria-label="Ampliar imagen"
        style={{
          cursor: "zoom-in",
          borderRadius: "10px",
          overflow: "hidden",
          border: esFondoOscuro
            ? "1px solid rgba(255,255,255,0.28)"
            : "1px solid rgba(15,23,42,0.12)",
          background: "#FFFFFF",
        }}
      >
        <img
          src={srcEfectivo}
          alt={alt || "Fotografía en chat"}
          loading="lazy"
          onError={() => {
            if (!usarProxy) setUsarProxy(true);
          }}
          style={{
            display: "block",
            width: "100%",
            maxHeight: "265px",
            objectFit: "cover",
          }}
        />
      </div>

      {alt && (
        <span
          style={{
            fontSize: "0.72rem",
            fontWeight: 600,
            color: esFondoOscuro ? "#E2E8F0" : "#475569",
          }}
        >
          📷 {alt}
        </span>
      )}

      {/* Acciones directas: Ampliar, Descargar, Reenviar */}
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
            gap: "4px",
            padding: "3px 7px",
            borderRadius: "6px",
            border: esFondoOscuro ? "1px solid rgba(255,255,255,0.28)" : "1px solid #CBD5E1",
            background: esFondoOscuro ? "rgba(255,255,255,0.14)" : "#F8FAFC",
            color: esFondoOscuro ? "#FFFFFF" : "#0F172A",
            fontSize: "0.7rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <ZoomIn size={11} />
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
            gap: "4px",
            padding: "3px 7px",
            borderRadius: "6px",
            border: esFondoOscuro ? "1px solid rgba(255,255,255,0.28)" : "1px solid #BAE6FD",
            background: esFondoOscuro ? "rgba(255,255,255,0.14)" : "#F0F9FF",
            color: esFondoOscuro ? "#E0F2FE" : "#0369A1",
            fontSize: "0.7rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Download size={11} />
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
            gap: "4px",
            padding: "3px 7px",
            borderRadius: "6px",
            border: esFondoOscuro ? "1px solid rgba(255,255,255,0.28)" : "1px solid #86EFAC",
            background: esFondoOscuro ? "rgba(255,255,255,0.14)" : "#F0FDF4",
            color: esFondoOscuro ? "#BBF7D0" : "#15803D",
            fontSize: "0.7rem",
            fontWeight: 700,
            cursor: "pointer",
          }}
        >
          <Forward size={11} />
          <span className="btn-texto-responsive">Reenviar</span>
        </button>
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
  }
): React.ReactNode {
  const segmentos = extraerSegmentosMultimediaMensaje(
    mensaje.contenido || "",
    mensaje.detalle
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
      {segmentos.map((seg, idx) => {
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
        etiqueta: "🚨 Requiere Humano",
        fondo: "#FEF2F2",
        texto: "#B91C1C",
        borde: "#FECACA",
      };
    case "EN_ATENCION_ASESORA":
      return {
        etiqueta: "👩‍💼 Atención Humana",
        fondo: "#EFF6FF",
        texto: "#1D4ED8",
        borde: "#BFDBFE",
      };
    case "EN_ESPERA_CLIENTE":
      return {
        etiqueta: "⏳ Espera Cliente",
        fondo: "#FFFBEB",
        texto: "#B45309",
        borde: "#FDE68A",
      };
    case "CERRADO":
      return {
        etiqueta: "✅ Cerrado",
        fondo: "#F1F5F9",
        texto: "#475569",
        borde: "#CBD5E1",
      };
    default:
      return {
        etiqueta: "🤖 IA ARIA Activa",
        fondo: "#ECFDF5",
        texto: "#047857",
        borde: "#A7F3D0",
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

  // Compositor de respuesta humana / nota interna / adjunto de imagen
  const [textoRespuesta, setTextoRespuesta] = useState<string>("");
  const [modoNotaInterna, setModoNotaInterna] = useState<boolean>(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState<boolean>(false);
  const [mostrarMenuRespuestas, setMostrarMenuRespuestas] = useState<boolean>(false);
  const [respuestaSeleccionadaId, setRespuestaSeleccionadaId] = useState<string | null>(null);
  const [imagenAdjuntaAsesorUrl, setImagenAdjuntaAsesorUrl] = useState<string | null>(null);
  const [subiendoImagenAsesor, setSubiendoImagenAsesor] = useState<boolean>(false);
  const inputFotoAsesorRef = useRef<HTMLInputElement>(null);

  // Visor lightbox de imagen ampliada y modal de reenvío (a WhatsApp o Chat Grupal del Equipo)
  const [visorImagenDatos, setVisorImagenDatos] = useState<DatosImagenAmpliadaChat | null>(null);
  const [reenvioModalDatos, setReenvioModalDatos] = useState<{
    destino: "equipo" | "whatsapp";
    payload: DatosReenvioMensajeModal;
  } | null>(null);

  // Modales ligeros inline: recordatorio y crear respuesta rápida
  const [editandoRecordatorio, setEditandoRecordatorio] = useState<boolean>(false);
  const [recordatorioFecha, setRecordatorioFecha] = useState<string>("");
  const [recordatorioNota, setRecordatorioNota] = useState<string>("");

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
  const [selectorEtiquetasAbierto, setSelectorEtiquetasAbierto] = useState<boolean>(false);

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

  useEffect(() => {
    if (!conversacionActivaId) {
      setMensajesActivos([]);
      return;
    }
    void cargarMensajesConversacion(conversacionActivaId, false);
  }, [conversacionActivaId, cargarMensajesConversacion]);

  useEffect(() => {
    if (scrollMensajesRef.current) {
      scrollMensajesRef.current.scrollTop = scrollMensajesRef.current.scrollHeight;
    }
  }, [mensajesActivos.length, conversacionActivaId]);

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
              : payload.fase === "INTERVENCION_HUMANA"
                ? "ASESORA_HUMANA"
                : payload.fase === "EVENTO_ORDEN"
                  ? "SISTEMA"
                  : "CLIENTE";

          const nuevoMsg: MensajeOmnicanal = {
            id: payload.eventoId || `rtm-${ahoraMs}`,
            origen: origenMsg,
            autorNombre:
              payload.autorNombre ||
              (origenMsg === "BOT_ARIA"
                ? "Mía · ARIA"
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
                : payload.imagenUrl || (payload.imagenesUrls && payload.imagenesUrls.length > 0)
                  ? "IMAGEN"
                  : "TEXTO",
            estadoEntrega: "ENVIADO",
            detalle:
              payload.imagenUrl || (payload.imagenesUrls && payload.imagenesUrls.length > 0)
                ? {
                    imagen_url: payload.imagenUrl ?? undefined,
                    imagenes_urls: payload.imagenesUrls ?? undefined,
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
                ultimoMensajeTexto: payload.contenido.slice(0, 280),
                ultimoMensajeOrigen: origenMsg,
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

    const timer = setInterval(() => {
      if (pestana === "inbox") {
        void recargarTablero(true);
        const idActual = conversacionActivaIdRef.current;
        if (idActual && !idActual.startsWith("rt-")) {
          void cargarMensajesConversacion(idActual, true);
        }
      }
    }, 12000);

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      clearInterval(timer);
      liveConectadoRef.current = false;
      canalLiveRef.current = null;
      void supabase.removeChannel(canalLive);
      void supabase.removeChannel(canalPg);
    };
  }, [negNorm, pestana, recargarTablero, cargarMensajesConversacion]);

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

      if (etiquetaFiltroId && !(c.etiquetasIds ?? []).includes(etiquetaFiltroId)) return false;
      if (vendedorFiltroId && c.asesoraAsignadaId !== vendedorFiltroId) return false;
      if (soloNoLeidos && (c.noLeidosAsesora || 0) === 0) return false;
      if (canalFiltro !== "todos" && (c.canal || "web") !== canalFiltro) return false;

      if (q) {
        const textoBusqueda = [
          c.remitenteNombre,
          c.remitenteCorreo,
          c.remitenteTelefono,
          c.ultimoMensajeTexto,
          c.asesoraNombre,
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
    soloNoLeidos,
    canalFiltro,
    busquedaInbox,
  ]);

  const conversacionActiva = useMemo(
    () => tablero.conversaciones.find((c) => c.id === conversacionActivaId) ?? null,
    [tablero.conversaciones, conversacionActivaId]
  );

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
        setImagenAdjuntaAsesorUrl(pub.publicUrl);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error subiendo imagen.");
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
    if (!conversacionActiva || (!textoRespuesta.trim() && !imagenAdjuntaAsesorUrl) || enviandoMensaje) {
      return;
    }

    const textoLimpio = textoRespuesta.trim();
    const cuerpoFinal = imagenAdjuntaAsesorUrl
      ? `${textoLimpio ? `${textoLimpio}\n\n` : ""}![Fotografía adjunta](${imagenAdjuntaAsesorUrl})`
      : textoLimpio;

    setEnviandoMensaje(true);
    const res = await enviarMensajeAsesorOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      contenido: cuerpoFinal,
      esNotaInterna: modoNotaInterna,
      respuestaRapidaId: respuestaSeleccionadaId,
    });
    setEnviandoMensaje(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    if (res.avisoWhatsApp) {
      setErrorMsg(`Aviso de envío WhatsApp: ${res.avisoWhatsApp}`);
    }

    setTextoRespuesta("");
    setImagenAdjuntaAsesorUrl(null);
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

  const handleCambiarEstado = async (nuevoEstado: EstadoAtencionOmnicanal) => {
    if (!conversacionActiva) return;
    if (!conversacionActiva.id.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        nuevoEstado,
      });
      if (!res.ok) {
        setErrorMsg(res.error);
        return;
      }
    } else {
      setTablero((prev) => ({
        ...prev,
        conversaciones: prev.conversaciones.map((c) =>
          c.id === conversacionActiva.id ? { ...c, estadoAtencion: nuevoEstado } : c
        ),
      }));
    }

    emitirBroadcastAsesor({
      eventoId: `est-${Date.now()}`,
      claveHilo: conversacionActiva.claveHilo,
      conversacionId: conversacionActiva.id,
      estadoAtencion: nuevoEstado,
      asesoraAsignadaId: conversacionActiva.asesoraAsignadaId ?? tablero.usuarioActualId,
      asesoraNombre: conversacionActiva.asesoraNombre ?? tablero.usuarioActualNombre,
    });

    if (!conversacionActiva.id.startsWith("rt-")) {
      void recargarTablero(true);
      void cargarMensajesConversacion(conversacionActiva.id, true);
    }
  };

  const handleAsignarVendedor = async (valor: string) => {
    if (!conversacionActiva) return;
    const res = await actualizarConversacionOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      asesoraId: valor ? valor : null,
      desasignar: !valor,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    void recargarTablero(true);
  };

  const handleGuardarRecordatorio = async () => {
    if (!conversacionActiva || !recordatorioFecha) return;
    const res = await actualizarConversacionOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      recordatorioEn: new Date(recordatorioFecha).toISOString(),
      recordatorioNota: recordatorioNota.trim() || "Seguimiento comercial",
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setEditandoRecordatorio(false);
    setRecordatorioFecha("");
    setRecordatorioNota("");
    void recargarTablero(true);
  };

  const handleAlternarEtiqueta = async (etiquetaId: string) => {
    if (!conversacionActiva) return;
    const res = await alternarEtiquetaOmnicanalAction({
      negocio: negNorm,
      etiquetaId,
      conversacionId: conversacionActiva.id,
      clienteId: conversacionActiva.clienteId,
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setTablero((prev) => ({
      ...prev,
      conversaciones: prev.conversaciones.map((c) => {
        if (c.id !== conversacionActiva.id) return c;
        const tiene = c.etiquetasIds.includes(etiquetaId);
        return {
          ...c,
          etiquetasIds: tiene
            ? c.etiquetasIds.filter((id) => id !== etiquetaId)
            : [...c.etiquetasIds, etiquetaId],
        };
      }),
    }));
  };

  const handleMarcarComoNoLeido = async () => {
    if (!conversacionActiva) return;
    if (!conversacionActiva.id.startsWith("rt-")) {
      const res = await actualizarConversacionOmnicanalAction({
        negocio: negNorm,
        conversacionId: conversacionActiva.id,
        marcarNoLeido: true,
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
          ? { ...c, noLeidosAsesora: Math.max(1, c.noLeidosAsesora || 0) }
          : c
      ),
    }));
    setMensajeInfo(`📌 Chat con ${conversacionActiva.remitenteNombre} marcado como no leído.`);
    if (modoLayoutInbox === "movil") {
      setVistaMovilInbox("lista");
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
            <strong style={{ fontSize: "0.84rem", color: "#111827" }}>{p.codigoOrden}</strong>
            <span style={{ fontSize: "0.72rem", color: "#6B7280" }}>
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
              background: p.esUsuarioRegistrado ? "#DCFCE7" : "#FEF3C7",
              color: p.esUsuarioRegistrado ? "#166534" : "#92400E",
              border: `1px solid ${p.esUsuarioRegistrado ? "#BBF7D0" : "#FDE68A"}`,
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
            <strong style={{ fontSize: "0.83rem", color: "#1F2937" }}>{p.compradorNombre}</strong>
            <span style={{ fontSize: "0.73rem", color: "#6B7280" }}>
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
            <strong style={{ fontSize: "0.86rem", color: "#111827" }}>
              ${Number(p.total || 0).toFixed(2)}
            </strong>
            <span style={{ fontSize: "0.7rem", color: "#6B7280" }}>
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
                p.estado === "APROBADA" || p.estado === "ENTREGADO" ? "#DCFCE7" : "#FEF9C3",
              color: p.estado === "APROBADA" || p.estado === "ENTREGADO" ? "#15803D" : "#854D0E",
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
          <span style={{ fontSize: "0.76rem", color: "#4B5563" }}>
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
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#0F172A",
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
        valor: (u) => `${u.nombre} ${u.correo || ""} ${u.telefono || ""}`,
        render: (u) => (
          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
            <strong style={{ fontSize: "0.84rem", color: "#111827" }}>{u.nombre}</strong>
            <span style={{ fontSize: "0.73rem", color: "#6B7280" }}>
              {u.correo || "Sin correo"} {u.telefono ? `· ${u.telefono}` : ""}
            </span>
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
              background: u.tipoCuenta === "USUARIO_REGISTRADO" ? "#DBEAFE" : "#F3F4F6",
              color: u.tipoCuenta === "USUARIO_REGISTRADO" ? "#1E40AF" : "#374151",
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
              color: u.autorizaWhatsapp ? "#15803D" : "#6B7280",
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
          <strong style={{ fontSize: "0.83rem", color: "#111827" }}>
            {u.totalCompras} {u.totalCompras === 1 ? "compra" : "compras"}
          </strong>
        ),
      },
      {
        id: "monto",
        encabezado: "Monto Acumulado",
        valor: (u) => Number(u.montoAcumulado) || 0,
        render: (u) => (
          <strong style={{ fontSize: "0.84rem", color: "#047857" }}>
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
              <span style={{ fontSize: "0.72rem", color: "#9CA3AF" }}>Sin etiquetas</span>
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
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#0F172A",
              fontSize: "0.76rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            <MessageCircle size={14} />
            <span className="btn-texto-responsive">Abrir Chat</span>
          </button>
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
          background: "#FFFFFF",
          border: "1px solid rgba(34, 29, 26, 0.1)",
          borderRadius: "14px",
          padding: modoLayoutInbox === "movil" ? "7px 10px" : "8px 12px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
          boxShadow: "0 2px 10px rgba(34, 29, 26, 0.04)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          {(
            [
              {
                id: "inbox" as const,
                etiqueta: "Bandeja de Chats",
                icono: Inbox,
                contador: metricas.conversacionesAbiertas,
              },
              {
                id: "chat_equipo" as const,
                etiqueta: "Chat Equipo",
                icono: MessageCircle,
              },
              {
                id: "compras" as const,
                etiqueta: "Compras Web",
                icono: ShoppingBag,
                contador: metricas.totalComprasWeb,
              },
              {
                id: "usuarios" as const,
                etiqueta: "Usuarios y Clientes",
                icono: Users,
                contador: tablero.usuariosYClientes.length,
              },
              {
                id: "ia_config" as const,
                etiqueta: "IA vs Humano & Plantillas",
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
                  gap: "7px",
                  padding: "8px 14px",
                  borderRadius: "10px",
                  border: activa ? "1px solid #0F172A" : "1px solid #E2E8F0",
                  background: activa ? "#0F172A" : "#F8FAFC",
                  color: activa ? "#FFFFFF" : "#334155",
                  fontSize: "0.83rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Icono size={15} />
                <span>{tab.etiqueta}</span>
                {"contador" in tab && typeof tab.contador === "number" && (
                  <span
                    style={{
                      padding: "1px 7px",
                      borderRadius: "999px",
                      fontSize: "0.72rem",
                      background: activa ? "rgba(255,255,255,0.2)" : "#E2E8F0",
                      color: activa ? "#FFFFFF" : "#334155",
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
              borderRadius: "10px",
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              color: "#334155",
            }}
          >
            <span>
              🤖 ARIA: <strong>{metricas.totalRespuestasAria}</strong>
            </span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span>
              👩‍💼 Humanas: <strong>{metricas.totalIntervencionesHumanas}</strong>
            </span>
            <span style={{ color: "#CBD5E1" }}>|</span>
            <span>
              💰 Ventas Web: <strong>${metricas.montoTotalVentasUsd.toFixed(2)}</strong>
            </span>
          </div>

          <span
            title={
              realtimeConectado
                ? "Canal WebSocket en vivo conectado: los mensajes nuevos aparecen al instante sin recargar"
                : "Sincronizando canal en tiempo real..."
            }
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "6px 10px",
              borderRadius: "999px",
              background: realtimeConectado ? "#ECFDF5" : "#F8FAFC",
              border: `1px solid ${realtimeConectado ? "#A7F3D0" : "#E2E8F0"}`,
              color: realtimeConectado ? "#047857" : "#64748B",
              fontSize: "0.75rem",
              fontWeight: 700,
            }}
          >
            <span
              style={{
                width: "8px",
                height: "8px",
                borderRadius: "50%",
                background: realtimeConectado ? "#10B981" : "#94A3B8",
                boxShadow: realtimeConectado ? "0 0 0 3px rgba(16, 185, 129, 0.2)" : "none",
              }}
            />
            {realtimeConectado ? "En vivo" : "Conectando..."}
          </span>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => void handleImportarHistorialAria()}
            disabled={importandoHistorialAria}
            title="Importar conversaciones previas de WhatsApp registradas en la consola de ARIA"
            aria-label="Importar ARIA"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 12px",
              borderRadius: "9px",
              border: "1px solid #86EFAC",
              background: "#F0FDF4",
              color: "#15803D",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: importandoHistorialAria ? "wait" : "pointer",
            }}
          >
            {importandoHistorialAria ? <Loader2 size={14} /> : <Bot size={14} />}
            <span className="btn-texto-responsive">
              {importandoHistorialAria ? "Importando…" : "Importar ARIA"}
            </span>
          </button>

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
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#0F172A",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            {cargando ? <Loader2 size={14} /> : <RefreshCw size={14} />}
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
      </div>
      )}

      {tablero.usandoRespaldoHibrido && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "10px",
            background: "#FFFBEB",
            border: "1px solid #FDE68A",
            color: "#92400E",
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
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
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
              color: "#065F46",
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
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
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
              color: "#991B1B",
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
      {pestana === "chat_equipo" && <ChatEquipoInterno negocio={negNorm} embebido />}

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
            background: "#FFFFFF",
            border: "1px solid rgba(34, 29, 26, 0.11)",
            borderRadius: modoLayoutInbox === "movil" ? "12px" : "16px",
            overflow: "hidden",
            boxShadow: "0 8px 26px rgba(34, 29, 26, 0.06)",
          }}
        >
          {/* BARRA SUPERIOR UNIFICADA DE CANALES, BÚSQUEDA, VISTAS, ETIQUETAS Y EQUIPO */}
          {(modoLayoutInbox !== "movil" || vistaMovilInbox === "lista") && (
            <div
              style={{
                background: "#FAF8F5",
                borderBottom: "1px solid #ECE8E1",
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
                      color: "#94A3B8",
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
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
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
                    background: "#EFECE6",
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
                      background: canalFiltro === "todos" ? "#FFFFFF" : "transparent",
                      color: canalFiltro === "todos" ? "#0F172A" : "#475569",
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
                          background: activo ? "#FFFFFF" : "transparent",
                          color: activo ? "#0F172A" : "#475569",
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
                              color: activo ? c.color : "#64748B",
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
                      border: mostrarFiltrosInbox ? "1px solid #0F172A" : "1px solid #CBD5E1",
                      background: mostrarFiltrosInbox ? "#0F172A" : "#FFFFFF",
                      color: mostrarFiltrosInbox ? "#FFFFFF" : "#334155",
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
                    <select
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
                        border: "1px solid #CBD5E1",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        background: "#FFFFFF",
                        color: "#0F172A",
                      }}
                    >
                      <option value="todos">📂 Abiertos ({metricas.conversacionesAbiertas})</option>
                      <option value="no_asignado">📥 Sin asignar ({metricas.sinAsignar})</option>
                      <option value="mios">🙋 Asignado a mí</option>
                      <option value="escalados">
                        🚨 Requiere humano ({metricas.escaladasHumano})
                      </option>
                      <option value="ia_activa">🤖 IA ARIA ({metricas.atendidasPorIa})</option>
                      <option value="recordatorios">
                        ⏰ Recordatorios ({metricas.conRecordatorio})
                      </option>
                      <option value="cerrados">
                        ✅ Cerrados ({metricas.totalConversaciones - metricas.conversacionesAbiertas})
                      </option>
                      <option value="todos_historial">
                        📋 Todos ({metricas.totalConversaciones})
                      </option>
                    </select>

                    {/* Toggle No Leído */}
                    <button
                      type="button"
                      onClick={() => setSoloNoLeidos((v) => !v)}
                      title="Filtrar únicamente conversaciones con mensajes no leídos"
                      aria-label="No leído"
                      style={{
                        padding: "5px 9px",
                        borderRadius: "8px",
                        border: soloNoLeidos ? "1px solid #2563EB" : "1px solid #CBD5E1",
                        background: soloNoLeidos ? "#EFF6FF" : "#FFFFFF",
                        color: soloNoLeidos ? "#1D4ED8" : "#475569",
                        fontSize: "0.74rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      No leído
                    </button>

                    {/* Filtro por Etiqueta de Clasificación */}
                    <select
                      value={etiquetaFiltroId || ""}
                      onChange={(e) => setEtiquetaFiltroId(e.target.value || null)}
                      aria-label="Filtrar por etiqueta"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: etiquetaFiltroId ? "1px solid #DB2777" : "1px solid #CBD5E1",
                        fontSize: "0.75rem",
                        fontWeight: etiquetaFiltroId ? 700 : 500,
                        background: etiquetaFiltroId ? "#FDF2F8" : "#FFFFFF",
                        color: "#0F172A",
                        maxWidth: "175px",
                      }}
                    >
                      <option value="">🏷️ Etiquetas (Todas)</option>
                      {etiquetasClasificacion.map((etq) => (
                        <option key={etq.id} value={etq.id}>
                          {etq.icono} {etq.nombre}
                        </option>
                      ))}
                    </select>

                    {/* Filtro por Asesor / Operador */}
                    <select
                      value={vendedorFiltroId || ""}
                      onChange={(e) => setVendedorFiltroId(e.target.value || null)}
                      aria-label="Filtrar por asesor"
                      style={{
                        padding: "5px 8px",
                        borderRadius: "8px",
                        border: vendedorFiltroId ? "1px solid #2563EB" : "1px solid #CBD5E1",
                        fontSize: "0.75rem",
                        fontWeight: vendedorFiltroId ? 700 : 500,
                        background: vendedorFiltroId ? "#EFF6FF" : "#FFFFFF",
                        color: "#0F172A",
                        maxWidth: "165px",
                      }}
                    >
                      <option value="">👤 Equipo ({tablero.equipo.length})</option>
                      {tablero.equipo.map((m) => (
                        <option key={m.usuarioId} value={m.usuarioId}>
                          {m.usuarioId === tablero.usuarioActualId
                            ? `Tú (${m.nombre.split(" ")[0]})`
                            : m.nombre}{" "}
                          ({m.chatsActivos})
                        </option>
                      ))}
                    </select>

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
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#0F172A",
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
                borderRight: modoLayoutInbox !== "movil" ? "1px solid #ECE8E1" : "none",
                display:
                  modoLayoutInbox !== "movil" || vistaMovilInbox === "lista" ? "flex" : "none",
                flexDirection: "column",
                background: "#FFFFFF",
                minWidth: 0,
                minHeight: 0,
              }}
            >
              <div style={{ flex: 1, overflowY: "auto" }}>
                {conversacionesFiltradas.length === 0 ? (
                  <div
                    style={{
                      padding: "32px 18px",
                      textAlign: "center",
                      color: "#64748B",
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
                  conversacionesFiltradas.map((conv) => {
                    const seleccionada = conv.id === conversacionActivaId;
                    const tieneNoLeidos = (conv.noLeidosAsesora || 0) > 0;
                    const etiquetasVisibles = (conv.etiquetasIds ?? [])
                      .map((etqId) => mapaEtiquetas.get(etqId))
                      .filter((etq): etq is EtiquetaOmnicanal => Boolean(etq))
                      .slice(0, 2);

                    return (
                      <div
                        key={conv.id}
                        onClick={() => {
                          setConversacionActivaId(conv.id);
                          setMostrarFichaTablet(false);
                          setVistaMovilInbox("chat");
                        }}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            setConversacionActivaId(conv.id);
                            setMostrarFichaTablet(false);
                            setVistaMovilInbox("chat");
                          }
                        }}
                        style={{
                          padding: "10px 12px",
                          borderBottom: "1px solid #F1F5F9",
                          background: seleccionada
                            ? "#F0F9FF"
                            : tieneNoLeidos
                              ? "#F8FAFC"
                              : "#FFFFFF",
                          borderLeft: seleccionada
                            ? "3px solid #0284C7"
                            : tieneNoLeidos
                              ? "3px solid #2563EB"
                              : "3px solid transparent",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "flex-start",
                          gap: "10px",
                        }}
                      >
                        <AvatarConCanalOmnicanal
                          nombre={conv.remitenteNombre}
                          canal={conv.canal}
                          size={38}
                        />

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
                            <strong
                              style={{
                                fontSize: "0.83rem",
                                fontWeight: tieneNoLeidos ? 800 : 600,
                                color: "#0F172A",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {conv.remitenteNombre}
                            </strong>
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
                                    background: "#2563EB",
                                    color: "#FFFFFF",
                                    fontSize: "0.67rem",
                                    fontWeight: 800,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                  }}
                                >
                                  {conv.noLeidosAsesora}
                                </span>
                              )}
                              <span style={{ fontSize: "0.69rem", color: "#64748B" }}>
                                {formatearTiempoCorto(conv.ultimoMensajeEn)}
                              </span>
                            </div>
                          </div>

                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: tieneNoLeidos ? "#1E293B" : "#475569",
                              fontWeight: tieneNoLeidos ? 600 : 400,
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {conv.ultimoMensajeOrigen === "BOT_ARIA" && "🤖 "}
                            {conv.ultimoMensajeOrigen === "ASESORA_HUMANA" && "👩‍💼 "}
                            {limpiarVistaPreviaMensajeOmnicanal(conv.ultimoMensajeTexto)}
                          </div>

                          {(conv.estadoAtencion === "ESCALADO_HUMANO" ||
                            conv.estadoAtencion === "EN_ATENCION_ASESORA" ||
                            etiquetasVisibles.length > 0) && (
                            <div
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: "4px",
                                flexWrap: "wrap",
                                marginTop: "1px",
                              }}
                            >
                              {conv.estadoAtencion === "ESCALADO_HUMANO" && (
                                <span
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "#FEE2E2",
                                    color: "#B91C1C",
                                  }}
                                >
                                  🚨 Humano
                                </span>
                              )}

                              {conv.estadoAtencion === "EN_ATENCION_ASESORA" && (
                                <span
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: "#DBEAFE",
                                    color: "#1D4ED8",
                                  }}
                                >
                                  👩‍💼 {conv.asesoraNombre?.split(" ")[0] || "Humano"}
                                </span>
                              )}

                              {etiquetasVisibles.map((etq) => (
                                <span
                                  key={etq.id}
                                  style={{
                                    fontSize: "0.64rem",
                                    fontWeight: 600,
                                    padding: "1px 6px",
                                    borderRadius: "999px",
                                    background: `${etq.color}18`,
                                    color: etq.color,
                                  }}
                                >
                                  {etq.icono} {etq.nombre}
                                </span>
                              ))}
                            </div>
                          )}
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
                  ? "1px solid #ECE8E1"
                  : "none",
              display:
                modoLayoutInbox === "desktop" ||
                (modoLayoutInbox === "tablet" && !mostrarFichaTablet) ||
                (modoLayoutInbox === "movil" && vistaMovilInbox === "chat")
                  ? "flex"
                  : "none",
              flexDirection: "column",
              background: "#F6F4EF",
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
                  color: "#475569",
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
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={14} />
                    <span>Hilos</span>
                  </button>
                )}
                <Sparkles size={40} style={{ color: "#0284C7", marginBottom: "12px" }} />
                <h3 style={{ margin: "0 0 6px", fontSize: "1.05rem", color: "#0F172A" }}>
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
                {/* Cabecera Estilo ManyChat: Pausar IA, Asignar, Compartir al Equipo, No Leído y Etiquetas */}
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: modoLayoutInbox === "movil" ? "8px 10px" : "10px 14px",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "7px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "6px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        minWidth: 0,
                      }}
                    >
                      {modoLayoutInbox === "movil" && (
                        <button
                          type="button"
                          onClick={() => setVistaMovilInbox("lista")}
                          title="Volver a la lista de conversaciones"
                          aria-label="Volver a lista"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            justifyContent: "center",
                            width: "32px",
                            height: "32px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#0F172A",
                            cursor: "pointer",
                            flexShrink: 0,
                          }}
                        >
                          <ArrowLeft size={15} />
                        </button>
                      )}

                      <AvatarConCanalOmnicanal
                        nombre={conversacionActiva.remitenteNombre}
                        canal={conversacionActiva.canal}
                        size={32}
                      />

                      <div style={{ minWidth: 0, display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong
                          style={{
                            fontSize: "0.9rem",
                            color: "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                            maxWidth: modoLayoutInbox === "movil" ? "155px" : "240px",
                          }}
                        >
                          {conversacionActiva.remitenteNombre}
                        </strong>
                        {(() => {
                          const b = badgeEstadoAtencion(conversacionActiva.estadoAtencion);
                          return (
                            <span
                              style={{
                                padding: "2px 7px",
                                borderRadius: "999px",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                background: b.fondo,
                                color: b.texto,
                                border: `1px solid ${b.borde}`,
                                whiteSpace: "nowrap",
                              }}
                            >
                              {b.etiqueta}
                            </span>
                          );
                        })()}
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
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
                            gap: "5px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#1D4ED8",
                            color: "#FFFFFF",
                            fontSize: "0.73rem",
                            fontWeight: 700,
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
                            gap: "5px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #10B981",
                            background: "#ECFDF5",
                            color: "#047857",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Play size={13} />
                          <span className="btn-texto-responsive">Activar IA</span>
                        </button>
                      )}

                      <select
                        value={conversacionActiva.asesoraAsignadaId || ""}
                        onChange={(e) => void handleAsignarVendedor(e.target.value)}
                        title="Asignar conversación a un miembro del equipo"
                        aria-label="Asignar conversación"
                        style={{
                          padding: "5px 7px",
                          borderRadius: "8px",
                          border: conversacionActiva.asesoraAsignadaId
                            ? "1px solid #93C5FD"
                            : "1px solid #CBD5E1",
                          background: conversacionActiva.asesoraAsignadaId ? "#EFF6FF" : "#FFFFFF",
                          color: "#0F172A",
                          fontSize: "0.73rem",
                          fontWeight: 600,
                          maxWidth: modoLayoutInbox === "movil" ? "112px" : "148px",
                          cursor: "pointer",
                        }}
                      >
                        <option value="">👤 Sin asignar</option>
                        {tablero.equipo.map((m) => (
                          <option key={m.usuarioId} value={m.usuarioId}>
                            👤 {m.nombre.split(" ")[0]} ({m.rol})
                          </option>
                        ))}
                      </select>

                      <button
                        type="button"
                        className="btn-responsive-accion"
                        onClick={handleCompartirChatAlEquipo}
                        title="Compartir esta conversación en el Chat Grupal del Equipo (@kleber, @taller, @delivery)"
                        aria-label="Compartir en chat grupal"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 9px",
                          borderRadius: "8px",
                          border: "1px solid #DDD6FE",
                          background: "#F5F3FF",
                          color: "#5B21B6",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        <Share2 size={13} />
                        <span className="btn-texto-responsive">Compartir</span>
                      </button>

                      <button
                        type="button"
                        className="btn-responsive-accion"
                        onClick={() => void handleMarcarComoNoLeido()}
                        title="Marcar conversación como no leída para atenderla después"
                        aria-label="Marcar no leído"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 9px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: "#FFFFFF",
                          color: "#334155",
                          fontSize: "0.73rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <MailWarning size={13} />
                        <span className="btn-texto-responsive">No leído</span>
                      </button>

                      <button
                        type="button"
                        className="btn-responsive-accion"
                        onClick={() => setEditandoRecordatorio((v) => !v)}
                        title="Programar recordatorio de seguimiento comercial"
                        aria-label="Recordatorio"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "5px 8px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: conversacionActiva.recordatorioEn ? "#FEF3C7" : "#FFFFFF",
                          color: "#334155",
                          fontSize: "0.73rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Clock size={13} />
                        <span className="btn-texto-responsive">Recordar</span>
                      </button>

                      {conversacionActiva.estadoAtencion !== "CERRADO" ? (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("CERRADO")}
                          title="Marcar conversación como resuelta y cerrada"
                          aria-label="Cerrar chat"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#334155",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span className="btn-texto-responsive">Cerrar</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                          title="Reabrir conversación"
                          aria-label="Reabrir"
                          style={{
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reabrir
                        </button>
                      )}

                      {modoLayoutInbox === "desktop" ? (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => setFichaDerechaDesktop((v) => !v)}
                          title={
                            fichaDerechaDesktop
                              ? "Plegar panel derecho de Campos de Venta para ampliar el chat"
                              : "Mostrar Campos de Venta y Ficha 360°"
                          }
                          aria-label={fichaDerechaDesktop ? "Ocultar Datos" : "Campos de Venta"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: fichaDerechaDesktop ? "#FFFFFF" : "#0F172A",
                            color: fichaDerechaDesktop ? "#334155" : "#FFFFFF",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          {fichaDerechaDesktop ? (
                            <PanelRightClose size={13} />
                          ) : (
                            <PanelRightOpen size={13} />
                          )}
                          <span className="btn-texto-responsive">Datos</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            if (modoLayoutInbox === "movil") {
                              setVistaMovilInbox("ficha");
                            } else {
                              setMostrarFichaTablet(true);
                            }
                          }}
                          title="Abrir Campos de Venta (Pedido, Entrega, Tarjeta) y Ficha del Cliente"
                          aria-label="Campos de Venta"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #0F172A",
                            background: "#0F172A",
                            color: "#FFFFFF",
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <ClipboardList size={13} />
                          <span>Datos</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra compacta de selección de etiquetas de clasificación */}
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                    <Tag size={12} style={{ color: "#64748B" }} />
                    {etiquetasClasificacion
                      .filter((etq) =>
                        selectorEtiquetasAbierto
                          ? true
                          : (conversacionActiva.etiquetasIds ?? []).includes(etq.id)
                      )
                      .map((etq) => {
                        const puesta = (conversacionActiva.etiquetasIds ?? []).includes(etq.id);
                        return (
                          <button
                            key={etq.id}
                            type="button"
                            onClick={() => void handleAlternarEtiqueta(etq.id)}
                            title={puesta ? `Quitar etiqueta ${etq.nombre}` : `Asignar ${etq.nombre}`}
                            aria-label={`Etiqueta ${etq.nombre}`}
                            style={{
                              padding: "2px 8px",
                              borderRadius: "999px",
                              fontSize: "0.68rem",
                              fontWeight: 600,
                              border: puesta ? `1px solid ${etq.color}` : "1px solid #E2E8F0",
                              background: puesta ? `${etq.color}20` : "#F8FAFC",
                              color: puesta ? etq.color : "#64748B",
                              cursor: "pointer",
                            }}
                          >
                            {etq.icono} {etq.nombre}
                          </button>
                        );
                      })}
                    <button
                      type="button"
                      onClick={() => setSelectorEtiquetasAbierto((v) => !v)}
                      title={
                        selectorEtiquetasAbierto
                          ? "Contraer catálogo de etiquetas"
                          : "Seleccionar o quitar etiquetas en este chat"
                      }
                      aria-label="Seleccionar etiquetas"
                      style={{
                        padding: "2px 8px",
                        borderRadius: "999px",
                        fontSize: "0.68rem",
                        fontWeight: 700,
                        border: "1px dashed #CBD5E1",
                        background: selectorEtiquetasAbierto ? "#0F172A" : "#FFFFFF",
                        color: selectorEtiquetasAbierto ? "#FFFFFF" : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {selectorEtiquetasAbierto ? "Listo" : "+ Etiqueta"}
                    </button>

                    {selectorEtiquetasAbierto && Boolean(tablero.esAdminEtiquetas) && (
                      <button
                        type="button"
                        onClick={() => setModalEtiquetasAbierto(true)}
                        title="Crear, editar o eliminar etiquetas maestras"
                        aria-label="Administrar etiquetas"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "2px 8px",
                          borderRadius: "999px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          border: "1px solid #CBD5E1",
                          background: "#F8FAFC",
                          color: "#0F172A",
                          cursor: "pointer",
                        }}
                      >
                        <Settings2 size={11} />
                        <span>Administrar</span>
                      </button>
                    )}
                  </div>

                  {editandoRecordatorio && (
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        alignItems: "center",
                        flexWrap: "wrap",
                        padding: "8px 10px",
                        borderRadius: "9px",
                        background: "#FFFBEB",
                        border: "1px solid #FDE68A",
                      }}
                    >
                      <input
                        type="datetime-local"
                        value={recordatorioFecha}
                        onChange={(e) => setRecordatorioFecha(e.target.value)}
                        style={{
                          padding: "5px 8px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.76rem",
                        }}
                      />
                      <input
                        type="text"
                        value={recordatorioNota}
                        onChange={(e) => setRecordatorioNota(e.target.value)}
                        placeholder="Ej: Confirmar pago transferencia…"
                        style={{
                          flex: 1,
                          minWidth: "160px",
                          padding: "5px 8px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.76rem",
                        }}
                      />
                      <button
                        type="button"
                        onClick={() => void handleGuardarRecordatorio()}
                        title="Guardar recordatorio"
                        aria-label="Guardar"
                        style={{
                          padding: "5px 10px",
                          borderRadius: "6px",
                          border: "none",
                          background: "#B45309",
                          color: "#FFFFFF",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        Guardar
                      </button>
                    </div>
                  )}
                </div>

                {/* Línea de Tiempo de Mensajes (Cliente vs ARIA IA vs Vendedor Humano) */}
                <div
                  ref={scrollMensajesRef}
                  style={{
                    flex: 1,
                    padding: "16px",
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  {cargandoMensajes ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "#64748B" }}>
                      Cargando historial de la conversación…
                    </div>
                  ) : mensajesActivos.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "24px", color: "#64748B", fontSize: "0.82rem" }}>
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
                              padding: "5px 12px",
                              borderRadius: "999px",
                              background: "#E2E8F0",
                              color: "#334155",
                              fontSize: "0.73rem",
                              fontWeight: 600,
                              maxWidth: "88%",
                              textAlign: "center",
                            }}
                          >
                            ⚙️ {m.contenido}
                          </div>
                        );
                      }

                      const esCliente = m.origen === "CLIENTE";
                      const esAria = m.origen === "BOT_ARIA";
                      const esNota = m.origen === "NOTA_INTERNA";

                      return (
                        <div
                          key={m.id}
                          style={{
                            alignSelf: esCliente ? "flex-start" : "flex-end",
                            maxWidth: "82%",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                          }}
                        >
                          <div
                            style={{
                              fontSize: "0.69rem",
                              fontWeight: 700,
                              color: esCliente
                                ? "#475569"
                                : esAria
                                  ? "#047857"
                                  : esNota
                                    ? "#B45309"
                                    : "#1D4ED8",
                              textAlign: esCliente ? "left" : "right",
                            }}
                          >
                            {esCliente && `👤 ${m.autorNombre || conversacionActiva.remitenteNombre}`}
                            {esAria && `🤖 IA ARIA (${m.autorNombre || "Automático"})`}
                            {esNota && `📝 Nota Interna · ${m.autorNombre || "Equipo"}`}
                            {m.origen === "ASESORA_HUMANA" &&
                              `👩‍💼 Intervención Humana · ${m.autorNombre || "Asesor"}`}
                            {" · "}
                            {new Date(m.creadoEn).toLocaleTimeString("es-EC", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </div>

                          <div
                            style={{
                              padding: "10px 13px",
                              borderRadius: "12px",
                              background: esCliente
                                ? "#FFFFFF"
                                : esAria
                                  ? "#ECFDF5"
                                  : esNota
                                    ? "#FEF3C7"
                                    : "#1E40AF",
                              color:
                                m.origen === "ASESORA_HUMANA" ? "#FFFFFF" : "#0F172A",
                              border: esCliente
                                ? "1px solid #E2E8F0"
                                : esAria
                                  ? "1px solid #A7F3D0"
                                  : esNota
                                    ? "1px solid #FDE68A"
                                    : "none",
                              fontSize: "0.83rem",
                              lineHeight: 1.48,
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                            }}
                          >
                            {renderContenidoMensajeOmnicanal(
                              m,
                              m.origen === "ASESORA_HUMANA",
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
                              }
                            )}

                            {/* Botón rápido para enviar cualquier consulta/mensaje al Chat Grupal del Equipo con @menciones */}
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
                                  padding: "2px 6px",
                                  borderRadius: "6px",
                                  border: "none",
                                  background:
                                    m.origen === "ASESORA_HUMANA"
                                      ? "rgba(255,255,255,0.16)"
                                      : "rgba(109, 40, 217, 0.08)",
                                  color:
                                    m.origen === "ASESORA_HUMANA" ? "#E9D5FF" : "#5B21B6",
                                  fontSize: "0.68rem",
                                  fontWeight: 700,
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

                {/* Compositor Compacto y Responsive con /Atajos y Modo Nota Interna */}
                <form
                  onSubmit={handleEnviarMensaje}
                  style={{
                    background: "#FFFFFF",
                    borderTop: "1px solid #E2E8F0",
                    padding: modoLayoutInbox === "movil" ? "8px 10px" : "10px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    position: "relative",
                  }}
                >
                  {respuestasSugeridasPorAtajo.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "12px",
                        right: "12px",
                        marginBottom: "6px",
                        background: "#FFFFFF",
                        border: "1px solid #CBD5E1",
                        borderRadius: "12px",
                        boxShadow: "0 10px 25px rgba(15, 23, 42, 0.12)",
                        maxHeight: "220px",
                        overflowY: "auto",
                        zIndex: 20,
                      }}
                    >
                      {respuestasSugeridasPorAtajo.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => handleSeleccionarRespuestaRapida(r)}
                          style={{
                            width: "100%",
                            padding: "9px 12px",
                            border: "none",
                            borderBottom: "1px solid #F1F5F9",
                            background: "#FFFFFF",
                            textAlign: "left",
                            cursor: "pointer",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: "0.78rem", color: "#0F172A" }}>
                              <code style={{ color: "#2563EB" }}>{r.atajo}</code> · {r.titulo}
                            </strong>
                            <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                              {r.categoria}
                            </span>
                          </div>
                          <span
                            style={{
                              fontSize: "0.74rem",
                              color: "#475569",
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

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "inline-flex", gap: "4px" }}>
                      <button
                        type="button"
                        onClick={() => setModoNotaInterna(false)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "none",
                          background: !modoNotaInterna ? "#DBEAFE" : "transparent",
                          color: !modoNotaInterna ? "#1E40AF" : "#64748B",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        💬 Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoNotaInterna(true)}
                        style={{
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: "none",
                          background: modoNotaInterna ? "#FEF3C7" : "transparent",
                          color: modoNotaInterna ? "#92400E" : "#64748B",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        📝 Nota
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarMenuRespuestas((v) => !v)}
                      title="Insertar mensaje predeterminado (o escribe / en el cuadro)"
                      aria-label="Atajos de respuesta"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#334155",
                        fontSize: "0.72rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                      }}
                    >
                      <Zap size={12} />
                      <span>/Atajos</span>
                    </button>
                  </div>

                  {imagenAdjuntaAsesorUrl && (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "10px",
                        padding: "6px 10px",
                        borderRadius: "9px",
                        background: "#F8FAFC",
                        border: "1px solid #CBD5E1",
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
                      <span style={{ fontSize: "0.75rem", color: "#334155", flex: 1 }}>
                        📷 Foto lista para enviar
                      </span>
                      <button
                        type="button"
                        onClick={() => setImagenAdjuntaAsesorUrl(null)}
                        title="Quitar imagen adjunta"
                        aria-label="Quitar imagen"
                        style={{ border: "none", background: "transparent", cursor: "pointer" }}
                      >
                        <X size={15} />
                      </button>
                    </div>
                  )}

                  <div style={{ display: "flex", gap: "6px", alignItems: "flex-end" }}>
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
                    <button
                      type="button"
                      className="btn-responsive-accion"
                      disabled={subiendoImagenAsesor}
                      onClick={() => inputFotoAsesorRef.current?.click()}
                      title="Adjuntar fotografía para el cliente"
                      aria-label="Adjuntar foto"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "5px",
                        padding: modoLayoutInbox === "movil" ? "9px 10px" : "9px 11px",
                        borderRadius: "10px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#334155",
                        fontSize: "0.78rem",
                        fontWeight: 700,
                        cursor: subiendoImagenAsesor ? "wait" : "pointer",
                        flexShrink: 0,
                      }}
                    >
                      {subiendoImagenAsesor ? <Loader2 size={15} /> : <ImagePlus size={15} />}
                      <span className="btn-texto-responsive">Foto</span>
                    </button>

                    <textarea
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
                          ? "Escribe una nota interna para el equipo…"
                          : modoLayoutInbox === "movil"
                            ? "Escribe un mensaje o /atajo…"
                            : "Escribe al cliente, pega una foto (Ctrl+V) o usa /saludo, /transferencia…"
                      }
                      style={{
                        flex: 1,
                        minWidth: 0,
                        minHeight: modoLayoutInbox === "movil" ? "38px" : "46px",
                        maxHeight: "110px",
                        padding: "8px 11px",
                        borderRadius: "10px",
                        border: modoNotaInterna ? "1px solid #F59E0B" : "1px solid #CBD5E1",
                        background: modoNotaInterna ? "#FFFBEB" : "#FFFFFF",
                        fontSize: modoLayoutInbox === "movil" ? "16px" : "0.83rem",
                        fontFamily: "inherit",
                        resize: "none",
                      }}
                    />
                    <button
                      type="submit"
                      className="btn-responsive-accion"
                      disabled={
                        enviandoMensaje || (!textoRespuesta.trim() && !imagenAdjuntaAsesorUrl)
                      }
                      title={modoNotaInterna ? "Guardar nota interna" : "Enviar respuesta al cliente"}
                      aria-label="Enviar"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        padding: modoLayoutInbox === "movil" ? "10px 12px" : "10px 14px",
                        borderRadius: "10px",
                        border: "none",
                        background: modoNotaInterna ? "#D97706" : "#0F172A",
                        color: "#FFFFFF",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: enviandoMensaje ? "wait" : "pointer",
                        opacity: !textoRespuesta.trim() && !imagenAdjuntaAsesorUrl ? 0.55 : 1,
                        flexShrink: 0,
                      }}
                    >
                      {enviandoMensaje ? <Loader2 size={15} /> : <Send size={15} />}
                      <span className="btn-texto-responsive">
                        {modoNotaInterna ? "Guardar" : "Enviar"}
                      </span>
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>

            {/* COLUMNA 3: CAMPOS DE VENTA (PEDIDO / ENTREGA / TARJETA) Y FICHA 360° */}
            <div
              style={{
                background: "#FAF8F5",
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
                    borderBottom: "1px solid #E2E8F0",
                  }}
                >
                  <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
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
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      color: "#0F172A",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <ArrowLeft size={13} />
                    <span>Chat</span>
                  </button>
                </div>
              )}

              {!conversacionActiva ? (
                <div style={{ fontSize: "0.8rem", color: "#64748B" }}>
                  <strong>Resumen Rápido del Portal</strong>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "10px" }}>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "#64748B" }}>Usuarios Registrados Web</div>
                      <strong style={{ fontSize: "1.1rem", color: "#0F172A" }}>
                        {metricas.totalUsuariosRegistradosWeb}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                        Compras Web (Reg. / Invitados)
                      </div>
                      <strong style={{ fontSize: "1.05rem", color: "#0F172A" }}>
                        {metricas.comprasUsuariosRegistrados} reg. ·{" "}
                        {metricas.comprasInvitadosNoRegistrados} inv.
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "10px",
                        background: "#ECFDF5",
                        border: "1px solid #A7F3D0",
                      }}
                    >
                      <div style={{ fontSize: "0.72rem", color: "#065F46" }}>
                        Resolución Autónoma IA ARIA
                      </div>
                      <strong style={{ fontSize: "1.1rem", color: "#047857" }}>
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
                  />

                  {/* Perfil compacto del contacto */}
                  <div
                    style={{
                      padding: "10px 11px",
                      borderRadius: "11px",
                      background: "#FFFFFF",
                      border: "1px solid #E2E8F0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "4px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "6px" }}>
                      <span
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 700,
                          padding: "2px 7px",
                          borderRadius: "999px",
                          background:
                            contactoVinculadoActivo?.tipoCuenta === "USUARIO_REGISTRADO" ||
                            conversacionActiva.usuarioId
                              ? "#DBEAFE"
                              : comprasDeConversacionActiva.length > 0
                                ? "#FEF3C7"
                                : "#F1F5F9",
                          color:
                            contactoVinculadoActivo?.tipoCuenta === "USUARIO_REGISTRADO" ||
                            conversacionActiva.usuarioId
                              ? "#1E40AF"
                              : comprasDeConversacionActiva.length > 0
                                ? "#92400E"
                                : "#334155",
                        }}
                      >
                        {contactoVinculadoActivo?.tipoCuenta === "USUARIO_REGISTRADO" ||
                        conversacionActiva.usuarioId
                          ? "✅ Registrado Web"
                          : comprasDeConversacionActiva.length > 0
                            ? "🛒 Comprador Invitado"
                            : "👤 Contacto Directo"}
                      </span>
                      <span style={{ fontSize: "0.68rem", color: "#64748B", fontWeight: 600 }}>
                        🤖 {conversacionActiva.mensajesIaConteo} · 👩‍💼 {conversacionActiva.mensajesHumanoConteo}
                      </span>
                    </div>
                    <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>
                      {conversacionActiva.remitenteNombre}
                    </strong>
                    {conversacionActiva.remitenteTelefono && (
                      <span style={{ fontSize: "0.74rem", color: "#475569" }}>
                        📱 {conversacionActiva.remitenteTelefono}
                      </span>
                    )}
                    {conversacionActiva.remitenteCorreo && (
                      <span style={{ fontSize: "0.74rem", color: "#475569", wordBreak: "break-all" }}>
                        ✉️ {conversacionActiva.remitenteCorreo}
                      </span>
                    )}
                  </div>

                  {/* Historial de Compras y Proformas Web de este contacto */}
                  {comprasDeConversacionActiva.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                        Compras Web Vinculadas ({comprasDeConversacionActiva.length})
                      </span>
                      {comprasDeConversacionActiva.map((ord) => (
                        <div
                          key={ord.id}
                          style={{
                            padding: "8px 10px",
                            borderRadius: "9px",
                            border: "1px solid #E2E8F0",
                            background: "#FFFFFF",
                            display: "flex",
                            flexDirection: "column",
                            gap: "2px",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <strong style={{ fontSize: "0.76rem", color: "#0F172A" }}>
                              {ord.codigoOrden}
                            </strong>
                            <strong style={{ fontSize: "0.76rem", color: "#047857" }}>
                              ${Number(ord.total).toFixed(2)}
                            </strong>
                          </div>
                          <span style={{ fontSize: "0.69rem", color: "#64748B" }}>
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
                        borderTop: "1px solid #ECE8E1",
                      }}
                    >
                      <span
                        style={{
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          color: "#B45309",
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
                            border: "1px solid #FDE68A",
                            background: "#FFFBEB",
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
                                color: "#0F172A",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {disp.nombre}
                            </strong>
                            <span style={{ fontSize: "0.71rem", color: "#059669", fontWeight: 700 }}>
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
                              background: "#D97706",
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
                        background: "#FFFFFF",
                        border: "1px solid #E2E8F0",
                        fontSize: "0.72rem",
                        color: "#334155",
                      }}
                    >
                      <strong style={{ display: "block", color: "#0F172A", marginBottom: "2px" }}>
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
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
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
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
                Compras y Proformas Web — Usuarios Registrados e Invitados
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
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
                      filtroTipoComprador === f.id ? "1px solid #0F172A" : "1px solid #CBD5E1",
                    background: filtroTipoComprador === f.id ? "#0F172A" : "#FFFFFF",
                    color: filtroTipoComprador === f.id ? "#FFFFFF" : "#334155",
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
                  background: "#F8FAFC",
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
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
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
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
                Directorio Unificado de Usuarios Web y Compradores Invitados
              </h2>
              <p style={{ margin: "3px 0 0", fontSize: "0.8rem", color: "#64748B" }}>
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
                      filtroTipoUsuarioDir === f.id ? "1px solid #0F172A" : "1px solid #CBD5E1",
                    background: filtroTipoUsuarioDir === f.id ? "#0F172A" : "#FFFFFF",
                    color: filtroTipoUsuarioDir === f.id ? "#FFFFFF" : "#334155",
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
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
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
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#065F46" }}>
                🤖 Respuestas Automáticas ARIA
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#047857", marginTop: "4px" }}>
                {metricas.totalRespuestasAria}
              </div>
              <div style={{ fontSize: "0.73rem", color: "#065F46" }}>
                {metricas.porcentajeResolucionIa}% de hilos sin escalamiento humano
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "#EFF6FF",
                border: "1px solid #BFDBFE",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#1E40AF" }}>
                👩‍💼 Intervenciones de Vendedores
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#1D4ED8", marginTop: "4px" }}>
                {metricas.totalIntervencionesHumanas}
              </div>
              <div style={{ fontSize: "0.73rem", color: "#1E40AF" }}>
                {metricas.enAtencionHumana} conversaciones bajo control humano hoy
              </div>
            </div>

            <div
              style={{
                padding: "14px",
                borderRadius: "12px",
                background: "#FFFBEB",
                border: "1px solid #FDE68A",
              }}
            >
              <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "#92400E" }}>
                🚨 Escalados / En Cola
              </div>
              <div style={{ fontSize: "1.6rem", fontWeight: 800, color: "#B45309", marginTop: "4px" }}>
                {metricas.escaladasHumano}
              </div>
              <div style={{ fontSize: "0.73rem", color: "#92400E" }}>
                {metricas.sinAsignar} hilos abiertos sin vendedor asignado
              </div>
            </div>
          </div>

          {/* Bloque 2: Gestor de Mensajes Predeterminados (/atajo) */}
          <div
            style={{
              background: "#FFFFFF",
              border: "1px solid #E2E8F0",
              borderRadius: "16px",
              padding: "clamp(14px, 3vw, 20px)",
              display: "flex",
              flexDirection: "column",
              gap: "14px",
            }}
          >
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", fontWeight: 700, color: "#0F172A" }}>
                ⚡ Mensajes Predeterminados (Snippets para Vendedores)
              </h3>
              <p style={{ margin: "3px 0 0", fontSize: "0.79rem", color: "#64748B" }}>
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
                background: "#F8FAFC",
                padding: "12px",
                borderRadius: "12px",
                border: "1px solid #E2E8F0",
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
                  border: "1px solid #CBD5E1",
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
                  border: "1px solid #CBD5E1",
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
                  border: "1px solid #CBD5E1",
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
                  background: "#0F172A",
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
                  border: "1px solid #CBD5E1",
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
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", gap: "6px" }}>
                      <strong style={{ fontSize: "0.82rem", color: "#0F172A" }}>
                        <code style={{ color: "#2563EB" }}>{r.atajo}</code> · {r.titulo}
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
                          color: "#DC2626",
                          cursor: "pointer",
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <p style={{ margin: "6px 0 0", fontSize: "0.76rem", color: "#475569", lineHeight: 1.45 }}>
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
    </div>
  );
}
