"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  Bell,
  Bot,
  Check,
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  Globe,
  Hand,
  Inbox,
  Loader2,
  MessageCircle,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  StickyNote,
  Tag,
  Trash2,
  User,
  UserCheck,
  UserPlus,
  Users,
  Zap,
} from "lucide-react";
import {
  abrirSeguimientoContactoOmnicanalAction,
  actualizarConversacionOmnicanalAction,
  alternarEtiquetaOmnicanalAction,
  eliminarRespuestaRapidaOmnicanalAction,
  enviarMensajeAsesorOmnicanalAction,
  guardarEtiquetaOmnicanalAction,
  guardarRespuestaRapidaOmnicanalAction,
  obtenerMensajesConversacionAction,
  obtenerTableroOmnicanalAction,
  type DatosTableroOmnicanal,
  type PedidoWebConTipoCliente,
} from "../acciones-omnicanal";
import {
  calcularMetricasOmnicanal,
  emparejarComprasConConversacion,
  interpolarRespuestaRapida,
  nombreCanalRealtimeOmnicanal,
  type CanalOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ConversacionOmnicanal,
  type EstadoAtencionOmnicanal,
  type EtiquetaOmnicanal,
  type EventoBroadcastChatWeb,
  type EventoBroadcastIntervencionAsesor,
  type MensajeOmnicanal,
  type RespuestaRapidaOmnicanal,
} from "../omnicanal";

export interface PropsConsolaVentasOmnicanal {
  negocio: string;
  datosIniciales?: DatosTableroOmnicanal;
  errorInicial?: string | null;
}

type PestanaPrincipal = "inbox" | "compras" | "usuarios" | "ia_config";
type FiltroBandejaIzquierda =
  | "todos"
  | "no_asignado"
  | "mios"
  | "escalados"
  | "ia_activa"
  | "recordatorios"
  | "cerrados";

const COLORES_ETIQUETA_PRESET = [
  "#DB2777",
  "#16A34A",
  "#EA580C",
  "#2563EB",
  "#7C3AED",
  "#0D9488",
  "#D97706",
  "#64748B",
];

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

function etiquetaCanal(canal: CanalOmnicanal | string): {
  texto: string;
  icono: string;
  fondo: string;
  color: string;
} {
  switch (canal) {
    case "whatsapp":
      return { texto: "WhatsApp", icono: "📱", fondo: "#DCFCE7", color: "#15803D" };
    case "instagram":
      return { texto: "Instagram", icono: "📸", fondo: "#FCE7F3", color: "#BE185D" };
    case "facebook":
      return { texto: "Messenger", icono: "📘", fondo: "#DBEAFE", color: "#1D4ED8" };
    case "tiktok":
      return { texto: "TikTok", icono: "🎵", fondo: "#F3E8FF", color: "#6B21A8" };
    default:
      return { texto: "Chat Web", icono: "🌐", fondo: "#CCFBF1", color: "#0F766E" };
  }
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
  const [errorMsg, setErrorMsg] = useState<string | null>(errorInicial ?? null);

  // Estado de la Bandeja estilo ManyChat
  const [filtroIzquierdo, setFiltroIzquierdo] = useState<FiltroBandejaIzquierda>("todos");
  const [etiquetaFiltroId, setEtiquetaFiltroId] = useState<string | null>(null);
  const [vendedorFiltroId, setVendedorFiltroId] = useState<string | null>(null);
  const [soloNoLeidos, setSoloNoLeidos] = useState<boolean>(false);
  const [estadoAperturaFiltro, setEstadoAperturaFiltro] = useState<"abiertos" | "cerrados" | "todos">(
    "abiertos"
  );
  const [busquedaInbox, setBusquedaInbox] = useState<string>("");

  const [conversacionActivaId, setConversacionActivaId] = useState<string | null>(
    datosIniciales?.conversaciones[0]?.id ?? null
  );
  const [mensajesActivos, setMensajesActivos] = useState<MensajeOmnicanal[]>([]);
  const [cargandoMensajes, setCargandoMensajes] = useState<boolean>(false);

  // Compositor de respuesta humana / nota interna
  const [textoRespuesta, setTextoRespuesta] = useState<string>("");
  const [modoNotaInterna, setModoNotaInterna] = useState<boolean>(false);
  const [enviandoMensaje, setEnviandoMensaje] = useState<boolean>(false);
  const [mostrarMenuRespuestas, setMostrarMenuRespuestas] = useState<boolean>(false);
  const [respuestaSeleccionadaId, setRespuestaSeleccionadaId] = useState<string | null>(null);

  // Modales ligeros inline: crear etiqueta, recordatorio y crear respuesta rápida
  const [creandoEtiqueta, setCreandoEtiqueta] = useState<boolean>(false);
  const [nuevaEtqNombre, setNuevaEtqNombre] = useState<string>("");
  const [nuevaEtqColor, setNuevaEtqColor] = useState<string>(COLORES_ETIQUETA_PRESET[0]!);
  const [nuevaEtqIcono, setNuevaEtqIcono] = useState<string>("🏷️");

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

  // Adaptación responsive de la bandeja de 4 columnas (móvil / tablet / desktop)
  const [modoLayoutInbox, setModoLayoutInbox] = useState<"desktop" | "tablet" | "movil">("desktop");
  const [vistaMovilInbox, setVistaMovilInbox] = useState<"lista" | "chat" | "ficha">("lista");
  const [mostrarFiltrosInbox, setMostrarFiltrosInbox] = useState<boolean>(false);
  const [mostrarFichaTablet, setMostrarFichaTablet] = useState<boolean>(false);

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

          const origenMsg: MensajeOmnicanal["origen"] =
            payload.fase === "RESPUESTA_ARIA"
              ? "BOT_ARIA"
              : payload.fase === "EVENTO_ORDEN"
                ? "SISTEMA"
                : "CLIENTE";

          const nuevoMsg: MensajeOmnicanal = {
            id: payload.eventoId || `rtm-${ahoraMs}`,
            origen: origenMsg,
            autorNombre:
              payload.autorNombre ||
              (origenMsg === "BOT_ARIA"
                ? "ARIA IA"
                : origenMsg === "SISTEMA"
                  ? "E-Commerce Web"
                  : payload.remitenteNombre || "Visitante Web"),
            contenido: payload.contenido,
            tipoContenido: payload.fase === "EVENTO_ORDEN" ? "ORDEN_WEB" : "TEXTO",
            estadoEntrega: "ENVIADO",
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
              canal: "web",
              claveHilo: payload.claveHilo,
              remitenteId: payload.claveHilo,
              remitenteNombre:
                payload.remitenteNombre ||
                `Visitante Web #${payload.claveHilo.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`,
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

  const mapaEtiquetas = useMemo(() => {
    const m = new Map<string, EtiquetaOmnicanal>();
    for (const e of tablero.etiquetas) m.set(e.id, e);
    return m;
  }, [tablero.etiquetas]);

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
      if ((c.canal || "web") !== "web") return false;

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

  const handleEnviarMensaje = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!conversacionActiva || !textoRespuesta.trim() || enviandoMensaje) return;

    setEnviandoMensaje(true);
    const res = await enviarMensajeAsesorOmnicanalAction({
      negocio: negNorm,
      conversacionId: conversacionActiva.id,
      contenido: textoRespuesta.trim(),
      esNotaInterna: modoNotaInterna,
      respuestaRapidaId: respuestaSeleccionadaId,
    });
    setEnviandoMensaje(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setTextoRespuesta("");
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

  const handleCrearEtiqueta = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nuevaEtqNombre.trim()) return;
    const res = await guardarEtiquetaOmnicanalAction({
      negocio: negNorm,
      nombre: nuevaEtqNombre.trim(),
      color: nuevaEtqColor,
      icono: nuevaEtqIcono || "🏷️",
    });
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setTablero((prev) => ({
      ...prev,
      etiquetas: [...prev.etiquetas.filter((x) => x.id !== res.etiqueta.id), res.etiqueta],
    }));
    setNuevaEtqNombre("");
    setCreandoEtiqueta(false);
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

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
      {/* Barra Superior de KPIs Rápidos y Conmutador de Módulos */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "14px 18px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
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

        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "8px",
              fontSize: "0.75rem",
              padding: "6px 12px",
              borderRadius: "12px",
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
          PESTAÑA 1: BANDEJA UNIFICADA ESTILO MANYCHAT (4 COLUMNAS RESPONSIVE)
      ===================================================================== */}
      {pestana === "inbox" && (
        <div
          style={{
            display: "grid",
            gridTemplateColumns:
              modoLayoutInbox === "desktop"
                ? "210px 290px minmax(320px, 1fr) 280px"
                : modoLayoutInbox === "tablet"
                  ? "275px minmax(0, 1fr)"
                  : "minmax(0, 1fr)",
            minHeight: modoLayoutInbox === "movil" ? "540px" : "650px",
            background: "#FFFFFF",
            border: "1px solid #E2E8F0",
            borderRadius: "16px",
            overflow: "hidden",
            boxShadow: "0 4px 16px rgba(15, 23, 42, 0.04)",
          }}
        >
          {/* COLUMNA 1: VISTAS DE BANDEJA, ETIQUETAS Y EQUIPO (ESTILO MANYCHAT) */}
          <div
            style={{
              background: "#F8FAFC",
              borderRight: modoLayoutInbox === "desktop" ? "1px solid #E2E8F0" : "none",
              borderBottom: modoLayoutInbox !== "desktop" ? "1px solid #E2E8F0" : "none",
              gridColumn: modoLayoutInbox === "tablet" ? "1 / -1" : undefined,
              padding: "14px 10px",
              display:
                modoLayoutInbox === "desktop" ||
                (mostrarFiltrosInbox && (modoLayoutInbox === "tablet" || vistaMovilInbox === "lista"))
                  ? "flex"
                  : "none",
              flexDirection: "column",
              gap: "16px",
              overflowY: "auto",
            }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              {(
                [
                  { id: "todos", texto: "Todos los chats", conteo: metricas.conversacionesAbiertas },
                  { id: "no_asignado", texto: "No asignado", conteo: metricas.sinAsignar },
                  {
                    id: "mios",
                    texto: "Asignado a mí",
                    conteo: tablero.conversaciones.filter(
                      (c) =>
                        c.estadoAtencion !== "CERRADO" &&
                        tablero.usuarioActualId &&
                        c.asesoraAsignadaId === tablero.usuarioActualId
                    ).length,
                  },
                  { id: "escalados", texto: "🚨 Requiere humano", conteo: metricas.escaladasHumano },
                  { id: "ia_activa", texto: "🤖 IA ARIA activa", conteo: metricas.atendidasPorIa },
                  { id: "recordatorios", texto: "⏰ Recordatorios", conteo: metricas.conRecordatorio },
                  {
                    id: "cerrados",
                    texto: "✅ Cerrados",
                    conteo:
                      metricas.totalConversaciones - metricas.conversacionesAbiertas,
                  },
                ] as const
              ).map((item) => {
                const activo = filtroIzquierdo === item.id && !etiquetaFiltroId && !vendedorFiltroId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => {
                      setFiltroIzquierdo(item.id);
                      setEtiquetaFiltroId(null);
                      setVendedorFiltroId(null);
                    }}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: activo ? "#E2E8F0" : "transparent",
                      color: activo ? "#0F172A" : "#334155",
                      fontSize: "0.81rem",
                      fontWeight: activo ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span>{item.texto}</span>
                    <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748B" }}>
                      {item.conteo}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* SECCIÓN ETIQUETAS (IDÉNTICA A MANYCHAT) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "0 8px",
                }}
              >
                <span
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#64748B",
                  }}
                >
                  Etiquetas
                </span>
                <button
                  type="button"
                  onClick={() => setCreandoEtiqueta((v) => !v)}
                  title="Crear nueva etiqueta de clientes"
                  aria-label="Nueva etiqueta"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#334155",
                    cursor: "pointer",
                    padding: "2px",
                  }}
                >
                  <Plus size={14} />
                </button>
              </div>

              {creandoEtiqueta && (
                <form
                  onSubmit={handleCrearEtiqueta}
                  style={{
                    background: "#FFFFFF",
                    border: "1px solid #CBD5E1",
                    borderRadius: "9px",
                    padding: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                    marginBottom: "4px",
                  }}
                >
                  <input
                    type="text"
                    value={nuevaEtqNombre}
                    onChange={(e) => setNuevaEtqNombre(e.target.value)}
                    placeholder="Nombre etiqueta…"
                    style={{
                      width: "100%",
                      padding: "5px 8px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.78rem",
                    }}
                  />
                  <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                    {COLORES_ETIQUETA_PRESET.map((col) => (
                      <button
                        key={col}
                        type="button"
                        onClick={() => setNuevaEtqColor(col)}
                        title={`Color ${col}`}
                        aria-label={`Color ${col}`}
                        style={{
                          width: "16px",
                          height: "16px",
                          borderRadius: "999px",
                          background: col,
                          border: nuevaEtqColor === col ? "2px solid #0F172A" : "none",
                          cursor: "pointer",
                        }}
                      />
                    ))}
                  </div>
                  <div style={{ display: "flex", gap: "4px" }}>
                    <input
                      type="text"
                      value={nuevaEtqIcono}
                      onChange={(e) => setNuevaEtqIcono(e.target.value)}
                      maxLength={3}
                      style={{
                        width: "38px",
                        padding: "4px",
                        textAlign: "center",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                      }}
                    />
                    <button
                      type="submit"
                      title="Guardar etiqueta"
                      aria-label="Guardar"
                      style={{
                        flex: 1,
                        padding: "5px 8px",
                        borderRadius: "6px",
                        border: "none",
                        background: "#0F172A",
                        color: "#FFFFFF",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Guardar
                    </button>
                  </div>
                </form>
              )}

              {tablero.etiquetas.map((etq) => {
                const activa = etiquetaFiltroId === etq.id;
                const conteo = tablero.conversaciones.filter((c) =>
                  (c.etiquetasIds ?? []).includes(etq.id)
                ).length;
                return (
                  <button
                    key={etq.id}
                    type="button"
                    onClick={() =>
                      setEtiquetaFiltroId((prev) => (prev === etq.id ? null : etq.id))
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: activa ? "#E2E8F0" : "transparent",
                      color: "#1E293B",
                      fontSize: "0.8rem",
                      fontWeight: activa ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: "7px" }}>
                      <span
                        style={{
                          width: "9px",
                          height: "9px",
                          borderRadius: "999px",
                          background: etq.color,
                        }}
                      />
                      <span>
                        {etq.icono} {etq.nombre}
                      </span>
                    </span>
                    {conteo > 0 && (
                      <span style={{ fontSize: "0.72rem", color: "#64748B" }}>{conteo}</span>
                    )}
                  </button>
                );
              })}
            </div>

            {/* SECCIÓN EQUIPO DE VENTAS (MULTI-VENDEDOR EN TIEMPO REAL) */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "#64748B",
                  padding: "0 8px",
                }}
              >
                Equipo ({tablero.equipo.length})
              </span>
              {tablero.equipo.map((miembro) => {
                const activo = vendedorFiltroId === miembro.usuarioId;
                const esYo = miembro.usuarioId === tablero.usuarioActualId;
                return (
                  <button
                    key={miembro.usuarioId}
                    type="button"
                    onClick={() =>
                      setVendedorFiltroId((prev) =>
                        prev === miembro.usuarioId ? null : miembro.usuarioId
                      )
                    }
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: activo ? "#E2E8F0" : "transparent",
                      color: "#1E293B",
                      fontSize: "0.79rem",
                      fontWeight: activo ? 700 : 500,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    <span
                      style={{
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        whiteSpace: "nowrap",
                        maxWidth: "150px",
                      }}
                    >
                      👤 {esYo ? `Tú (${miembro.nombre.split(" ")[0]})` : miembro.nombre}
                    </span>
                    <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B" }}>
                      {miembro.chatsActivos}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* COLUMNA 2: LISTA DE HILOS CON FILTROS RÁPIDOS ESTILO MANYCHAT */}
          <div
            style={{
              borderRight: modoLayoutInbox !== "movil" ? "1px solid #E2E8F0" : "none",
              display:
                modoLayoutInbox !== "movil" || vistaMovilInbox === "lista" ? "flex" : "none",
              flexDirection: "column",
              background: "#FFFFFF",
              minWidth: 0,
            }}
          >
            <div
              style={{
                padding: "12px",
                borderBottom: "1px solid #E2E8F0",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ position: "relative" }}>
                <Search
                  size={14}
                  style={{
                    position: "absolute",
                    left: "10px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    color: "#94A3B8",
                  }}
                />
                <input
                  type="search"
                  value={busquedaInbox}
                  onChange={(e) => setBusquedaInbox(e.target.value)}
                  placeholder="Buscar en conversaciones…"
                  style={{
                    width: "100%",
                    padding: "7px 10px 7px 30px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: modoLayoutInbox === "movil" ? "16px" : "0.8rem",
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                {modoLayoutInbox !== "desktop" && (
                  <button
                    type="button"
                    onClick={() => setMostrarFiltrosInbox((v) => !v)}
                    title="Mostrar u ocultar vistas de bandeja, etiquetas y asesores"
                    aria-label="Filtros de bandeja"
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "4px 8px",
                      borderRadius: "7px",
                      border: mostrarFiltrosInbox ? "1px solid #0F172A" : "1px solid #CBD5E1",
                      background: mostrarFiltrosInbox ? "#0F172A" : "#FFFFFF",
                      color: mostrarFiltrosInbox ? "#FFFFFF" : "#334155",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    <Filter size={12} />
                    <span>Filtros</span>
                  </button>
                )}

                <select
                  value={estadoAperturaFiltro}
                  onChange={(e) => setEstadoAperturaFiltro(e.target.value as any)}
                  aria-label="Filtrar chats abiertos o cerrados"
                  style={{
                    padding: "4px 7px",
                    borderRadius: "7px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.74rem",
                    background: "#FFFFFF",
                  }}
                >
                  <option value="abiertos">Abiertos</option>
                  <option value="cerrados">Cerrados</option>
                  <option value="todos">Todos</option>
                </select>

                <button
                  type="button"
                  onClick={() => setSoloNoLeidos((v) => !v)}
                  title="Mostrar únicamente conversaciones con mensajes no leídos"
                  aria-label="No leído"
                  style={{
                    padding: "4px 8px",
                    borderRadius: "7px",
                    border: soloNoLeidos ? "1px solid #2563EB" : "1px solid #CBD5E1",
                    background: soloNoLeidos ? "#EFF6FF" : "#FFFFFF",
                    color: soloNoLeidos ? "#1D4ED8" : "#475569",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  No Leído
                </button>

                <span
                  title="Canal activo Fase 1: Chat en vivo desde el portal web"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 9px",
                    borderRadius: "7px",
                    border: "1px solid #CCFBF1",
                    background: "#F0FDFA",
                    color: "#0F766E",
                    fontSize: "0.73rem",
                    fontWeight: 700,
                    marginLeft: "auto",
                  }}
                >
                  🌐 Chat Web
                </span>
              </div>
            </div>

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
                    Cuando un visitante o cliente registrado escriba en el Chat Web de la tienda,
                    aparecerá aquí en tiempo real.
                  </p>
                </div>
              ) : (
                conversacionesFiltradas.map((conv) => {
                  const seleccionada = conv.id === conversacionActivaId;
                  const infoCanal = etiquetaCanal(conv.canal);
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
                        padding: "12px 14px",
                        borderBottom: "1px solid #F1F5F9",
                        background: seleccionada ? "#F0F9FF" : "#FFFFFF",
                        borderLeft: seleccionada ? "3px solid #0284C7" : "3px solid transparent",
                        cursor: "pointer",
                        display: "flex",
                        flexDirection: "column",
                        gap: "5px",
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
                            fontSize: "0.84rem",
                            color: "#0F172A",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            whiteSpace: "nowrap",
                          }}
                        >
                          {conv.remitenteNombre}
                        </strong>
                        <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          {conv.noLeidosAsesora > 0 && (
                            <span
                              style={{
                                minWidth: "18px",
                                height: "18px",
                                padding: "0 5px",
                                borderRadius: "999px",
                                background: "#2563EB",
                                color: "#FFFFFF",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                display: "inline-flex",
                                alignItems: "center",
                                justifyContent: "center",
                              }}
                            >
                              {conv.noLeidosAsesora}
                            </span>
                          )}
                          <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                            {formatearTiempoCorto(conv.ultimoMensajeEn)}
                          </span>
                        </div>
                      </div>

                      <div
                        style={{
                          fontSize: "0.77rem",
                          color: "#475569",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {conv.ultimoMensajeOrigen === "BOT_ARIA" && "🤖 "}
                        {conv.ultimoMensajeOrigen === "ASESORA_HUMANA" && "👩‍💼 "}
                        {conv.ultimoMensajeTexto || "Conversación iniciada"}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          flexWrap: "wrap",
                          marginTop: "2px",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            padding: "1px 6px",
                            borderRadius: "999px",
                            background: infoCanal.fondo,
                            color: infoCanal.color,
                          }}
                        >
                          {infoCanal.icono} {infoCanal.texto}
                        </span>

                        {conv.estadoAtencion === "ESCALADO_HUMANO" && (
                          <span
                            style={{
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              padding: "1px 6px",
                              borderRadius: "999px",
                              background: "#FEE2E2",
                              color: "#B91C1C",
                            }}
                          >
                            🚨 Escalado
                          </span>
                        )}

                        {conv.estadoAtencion === "EN_ATENCION_ASESORA" && (
                          <span
                            style={{
                              fontSize: "0.66rem",
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

                        {(conv.etiquetasIds ?? []).slice(0, 3).map((etqId) => {
                          const etq = mapaEtiquetas.get(etqId);
                          if (!etq) return null;
                          return (
                            <span
                              key={etqId}
                              style={{
                                fontSize: "0.66rem",
                                fontWeight: 600,
                                padding: "1px 6px",
                                borderRadius: "999px",
                                background: `${etq.color}18`,
                                color: etq.color,
                              }}
                            >
                              {etq.icono} {etq.nombre}
                            </span>
                          );
                        })}
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
              borderRight: modoLayoutInbox === "desktop" ? "1px solid #E2E8F0" : "none",
              display:
                modoLayoutInbox === "desktop" ||
                (modoLayoutInbox === "tablet" && !mostrarFichaTablet) ||
                (modoLayoutInbox === "movil" && vistaMovilInbox === "chat")
                  ? "flex"
                  : "none",
              flexDirection: "column",
              background: "#F8FAFC",
              minWidth: 0,
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
                {/* Cabecera de Control HITL */}
                <div
                  style={{
                    background: "#FFFFFF",
                    padding: "12px 14px",
                    borderBottom: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      {modoLayoutInbox === "movil" && (
                        <button
                          type="button"
                          onClick={() => setVistaMovilInbox("lista")}
                          title="Volver a la lista de conversaciones"
                          aria-label="Volver a hilos"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "5px 9px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#0F172A",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <ArrowLeft size={14} />
                          <span>Hilos</span>
                        </button>
                      )}
                      <strong style={{ fontSize: "0.95rem", color: "#0F172A" }}>
                        {conversacionActiva.remitenteNombre}
                      </strong>
                      {(() => {
                        const b = badgeEstadoAtencion(conversacionActiva.estadoAtencion);
                        return (
                          <span
                            style={{
                              padding: "3px 9px",
                              borderRadius: "999px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              background: b.fondo,
                              color: b.texto,
                              border: `1px solid ${b.borde}`,
                            }}
                          >
                            {b.etiqueta}
                          </span>
                        );
                      })()}
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                      {conversacionActiva.estadoAtencion !== "EN_ATENCION_ASESORA" ? (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                          title="Pausar a ARIA y tomar el control humano de este chat"
                          aria-label="Tomar Control"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "8px",
                            border: "none",
                            background: "#1D4ED8",
                            color: "#FFFFFF",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Hand size={13} />
                          <span className="btn-texto-responsive">Tomar Control</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("BOT_ACTIVO")}
                          title="Devolver la conversación al agente automático IA ARIA"
                          aria-label="Reactivar ARIA"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 11px",
                            borderRadius: "8px",
                            border: "1px solid #10B981",
                            background: "#ECFDF5",
                            color: "#047857",
                            fontSize: "0.76rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <Bot size={13} />
                          <span className="btn-texto-responsive">Reactivar ARIA</span>
                        </button>
                      )}

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
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          background: conversacionActiva.recordatorioEn ? "#FEF3C7" : "#FFFFFF",
                          color: "#334155",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Clock size={13} />
                        <span className="btn-texto-responsive">Recordatorio</span>
                      </button>

                      {conversacionActiva.estadoAtencion !== "CERRADO" ? (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("CERRADO")}
                          title="Marcar conversación como resuelta y cerrada"
                          aria-label="Cerrar Chat"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            color: "#334155",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          <CheckCircle2 size={13} />
                          <span className="btn-texto-responsive">Cerrar Chat</span>
                        </button>
                      ) : (
                        <button
                          type="button"
                          className="btn-responsive-accion"
                          onClick={() => void handleCambiarEstado("EN_ATENCION_ASESORA")}
                          title="Reabrir conversación"
                          aria-label="Reabrir"
                          style={{
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#FFFFFF",
                            fontSize: "0.75rem",
                            fontWeight: 600,
                            cursor: "pointer",
                          }}
                        >
                          Reabrir
                        </button>
                      )}

                      {modoLayoutInbox !== "desktop" && (
                        <button
                          type="button"
                          onClick={() => {
                            if (modoLayoutInbox === "movil") {
                              setVistaMovilInbox("ficha");
                            } else {
                              setMostrarFichaTablet(true);
                            }
                          }}
                          title="Ver Ficha 360° del cliente, compras y asignación"
                          aria-label="Ficha 360°"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "6px 10px",
                            borderRadius: "8px",
                            border: "1px solid #CBD5E1",
                            background: "#F8FAFC",
                            color: "#0F172A",
                            fontSize: "0.75rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          <User size={13} />
                          <span>Ficha 360°</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Barra rápida de etiquetas en 1 clic */}
                  <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "wrap" }}>
                    <Tag size={13} style={{ color: "#64748B" }} />
                    {tablero.etiquetas.map((etq) => {
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
                            fontSize: "0.7rem",
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
                              whiteSpace: "pre-wrap",
                              boxShadow: "0 1px 2px rgba(15, 23, 42, 0.04)",
                            }}
                          >
                            {m.contenido}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>

                {/* Compositor con Mensajes Predeterminados (/atajo) y Modo Nota Interna */}
                <form
                  onSubmit={handleEnviarMensaje}
                  style={{
                    background: "#FFFFFF",
                    borderTop: "1px solid #E2E8F0",
                    padding: "12px 14px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    position: "relative",
                  }}
                >
                  {respuestasSugeridasPorAtajo.length > 0 && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "100%",
                        left: "14px",
                        right: "14px",
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

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setModoNotaInterna(false)}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "none",
                          background: !modoNotaInterna ? "#DBEAFE" : "transparent",
                          color: !modoNotaInterna ? "#1E40AF" : "#64748B",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        💬 Responder Cliente
                      </button>
                      <button
                        type="button"
                        onClick={() => setModoNotaInterna(true)}
                        style={{
                          padding: "4px 9px",
                          borderRadius: "6px",
                          border: "none",
                          background: modoNotaInterna ? "#FEF3C7" : "transparent",
                          color: modoNotaInterna ? "#92400E" : "#64748B",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📝 Nota Interna
                      </button>
                    </div>

                    <button
                      type="button"
                      onClick={() => setMostrarMenuRespuestas((v) => !v)}
                      title="Insertar mensaje predeterminado (o escribe / en el cuadro)"
                      aria-label="Respuestas rápidas"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "4px 9px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        background: "#F8FAFC",
                        color: "#334155",
                        fontSize: "0.74rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      <Zap size={13} />
                      <span>Respuestas (/)</span>
                    </button>
                  </div>

                  <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
                    <textarea
                      value={textoRespuesta}
                      onChange={(e) => setTextoRespuesta(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          void handleEnviarMensaje();
                        }
                      }}
                      rows={2}
                      placeholder={
                        modoNotaInterna
                          ? "Escribe una nota interna solo visible para el equipo de ventas…"
                          : "Escribe al cliente (o usa /saludo, /transferencia, /ubicacion)… Al enviar tomas el control humano."
                      }
                      style={{
                        flex: 1,
                        padding: "9px 11px",
                        borderRadius: "10px",
                        border: modoNotaInterna ? "1px solid #F59E0B" : "1px solid #CBD5E1",
                        background: modoNotaInterna ? "#FFFBEB" : "#FFFFFF",
                        fontSize: "0.83rem",
                        fontFamily: "inherit",
                        resize: "none",
                      }}
                    />
                    <button
                      type="submit"
                      disabled={enviandoMensaje || !textoRespuesta.trim()}
                      title={modoNotaInterna ? "Guardar nota interna" : "Enviar respuesta al cliente"}
                      aria-label="Enviar"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        padding: "10px 15px",
                        borderRadius: "10px",
                        border: "none",
                        background: modoNotaInterna ? "#D97706" : "#0F172A",
                        color: "#FFFFFF",
                        fontSize: "0.82rem",
                        fontWeight: 700,
                        cursor: enviandoMensaje ? "wait" : "pointer",
                        opacity: !textoRespuesta.trim() ? 0.55 : 1,
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

          {/* COLUMNA 4: FICHA 360° DEL CONTACTO, ASIGNACIÓN, MÉTRICAS IA VS HUMANO Y COMPRAS WEB */}
          <div
            style={{
              background: "#FFFFFF",
              padding: "14px",
              display:
                modoLayoutInbox === "desktop" ||
                (modoLayoutInbox === "tablet" && mostrarFichaTablet) ||
                (modoLayoutInbox === "movil" && vistaMovilInbox === "ficha")
                  ? "flex"
                  : "none",
              flexDirection: "column",
              gap: "14px",
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
                  paddingBottom: "10px",
                  borderBottom: "1px solid #E2E8F0",
                }}
              >
                <strong style={{ fontSize: "0.86rem", color: "#0F172A" }}>
                  Ficha 360° del Contacto
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
                    background: "#F8FAFC",
                    color: "#0F172A",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={13} />
                  <span>Volver al Chat</span>
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
                {/* Perfil y Estado de Registro Web */}
                <div
                  style={{
                    padding: "12px",
                    borderRadius: "12px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span
                      style={{
                        fontSize: "0.69rem",
                        fontWeight: 700,
                        padding: "2px 8px",
                        borderRadius: "999px",
                        background:
                          contactoVinculadoActivo?.tipoCuenta === "USUARIO_REGISTRADO" ||
                          conversacionActiva.usuarioId
                            ? "#DBEAFE"
                            : comprasDeConversacionActiva.length > 0
                              ? "#FEF3C7"
                              : "#E2E8F0",
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
                        ? "✅ Usuario Registrado Web"
                        : comprasDeConversacionActiva.length > 0
                          ? "🛒 Comprador Invitado"
                          : "💬 Visitante Web"}
                    </span>
                  </div>
                  <strong style={{ fontSize: "0.9rem", color: "#0F172A" }}>
                    {conversacionActiva.remitenteNombre}
                  </strong>
                  {conversacionActiva.remitenteCorreo && (
                    <span style={{ fontSize: "0.76rem", color: "#475569", wordBreak: "break-all" }}>
                      ✉️ {conversacionActiva.remitenteCorreo}
                    </span>
                  )}
                  {conversacionActiva.remitenteTelefono && (
                    <span style={{ fontSize: "0.76rem", color: "#475569" }}>
                      📱 {conversacionActiva.remitenteTelefono}
                    </span>
                  )}
                </div>

                {/* Asignación de Vendedor */}
                <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                  <label style={{ fontSize: "0.73rem", fontWeight: 700, color: "#475569" }}>
                    Vendedor Responsable
                  </label>
                  <select
                    value={conversacionActiva.asesoraAsignadaId || ""}
                    onChange={(e) => void handleAsignarVendedor(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "7px 9px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="">— Sin asignar (Cola general) —</option>
                    {tablero.equipo.map((m) => (
                      <option key={m.usuarioId} value={m.usuarioId}>
                        {m.nombre} ({m.rol})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Telemetría IA ARIA vs Intervención Humana de este hilo */}
                <div
                  style={{
                    padding: "10px 12px",
                    borderRadius: "10px",
                    background: "#F8FAFC",
                    border: "1px solid #E2E8F0",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px",
                  }}
                >
                  <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#475569" }}>
                    Registro IA vs. Intervención Humana
                  </span>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                    <div
                      style={{
                        padding: "7px",
                        borderRadius: "8px",
                        background: "#ECFDF5",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.68rem", color: "#065F46" }}>🤖 ARIA (IA)</div>
                      <strong style={{ fontSize: "0.95rem", color: "#047857" }}>
                        {conversacionActiva.mensajesIaConteo}
                      </strong>
                    </div>
                    <div
                      style={{
                        padding: "7px",
                        borderRadius: "8px",
                        background: "#EFF6FF",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.68rem", color: "#1E40AF" }}>👩‍💼 Humano</div>
                      <strong style={{ fontSize: "0.95rem", color: "#1D4ED8" }}>
                        {conversacionActiva.mensajesHumanoConteo}
                      </strong>
                    </div>
                  </div>
                </div>

                {/* Historial de Compras y Proformas Web de este contacto */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#475569" }}>
                    Compras y Proformas Web ({comprasDeConversacionActiva.length})
                  </span>
                  {comprasDeConversacionActiva.length === 0 ? (
                    <div
                      style={{
                        padding: "10px",
                        borderRadius: "9px",
                        border: "1px dashed #CBD5E1",
                        fontSize: "0.75rem",
                        color: "#64748B",
                      }}
                    >
                      Sin órdenes asociadas aún a este correo o teléfono.
                    </div>
                  ) : (
                    comprasDeConversacionActiva.map((ord) => (
                      <div
                        key={ord.id}
                        style={{
                          padding: "9px 10px",
                          borderRadius: "9px",
                          border: "1px solid #E2E8F0",
                          background: "#FFFFFF",
                          display: "flex",
                          flexDirection: "column",
                          gap: "3px",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between" }}>
                          <strong style={{ fontSize: "0.78rem", color: "#0F172A" }}>
                            {ord.codigoOrden}
                          </strong>
                          <strong style={{ fontSize: "0.78rem", color: "#047857" }}>
                            ${Number(ord.total).toFixed(2)}
                          </strong>
                        </div>
                        <span style={{ fontSize: "0.7rem", color: "#64748B" }}>
                          {ord.estado} ·{" "}
                          {new Date(ord.creadoEn).toLocaleDateString("es-EC", {
                            day: "2-digit",
                            month: "short",
                          })}
                        </span>
                      </div>
                    ))
                  )}
                </div>
              </>
            )}
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
    </div>
  );
}
