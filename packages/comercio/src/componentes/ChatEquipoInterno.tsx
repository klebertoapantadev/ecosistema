"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  AtSign,
  BellRing,
  Camera,
  Download,
  ExternalLink,
  Forward,
  ImagePlus,
  Loader2,
  RefreshCw,
  Reply,
  Send,
  Sparkles,
  Users,
  X,
  ZoomIn,
} from "lucide-react";
import {
  enviarMensajeChatEquipoAction,
  obtenerSalaChatEquipoAction,
  type DatosSalaChatEquipo,
  type PedidoCreadoDesdeChatEquipo,
} from "../acciones-omnicanal";
import {
  construirHrefRetornoChatCliente,
  extraerSegmentosMultimediaMensaje,
  extraerTodasLasImagenesMensaje,
  formatearEtiquetaEnlaceVisible,
  nombreCanalRealtimeChatEquipo,
  normalizarHandleMencion,
  type CitaRespuestaChatEquipo,
  type ContextoReenvioChatEquipo,
  type EventoBroadcastChatEquipo,
  type MensajeChatEquipo,
  type MiembroChatEquipo,
} from "../omnicanal";
import {
  construirUrlProxyMediaOmnicanal,
  descargarImagenChatOmnicanal,
  ModalReenviarMensajeChat,
  ModalVisorImagenChat,
  type DatosImagenAmpliadaChat,
  type DatosReenvioMensajeModal,
} from "./VisorMultimediaChatModal";

export interface PropsChatEquipoInterno {
  negocio: string;
  embebido?: boolean;
  datosIniciales?: DatosSalaChatEquipo | null;
  rutaConversaciones?: string;
  onAbrirConversacionCliente?: (reenvio: ContextoReenvioChatEquipo) => void;
}

const COLORES_ROL_EQUIPO: Record<string, { bg: string; color: string; etiqueta: string }> = {
  SUPERADMIN: { bg: "#F4F2EE", color: "#57524C", etiqueta: "SuperAdmin" },
  ADMINISTRADOR: { bg: "#F4F2EE", color: "#57524C", etiqueta: "Admin" },
  OPERADOR: { bg: "#F4F2EE", color: "#6E6861", etiqueta: "Operador" },
  VENTAS: { bg: "#F4F2EE", color: "#6E6861", etiqueta: "Ventas" },
  TALLER: { bg: "#F4F2EE", color: "#6E6861", etiqueta: "Taller" },
  DELIVERY: { bg: "#F4F2EE", color: "#6E6861", etiqueta: "Delivery" },
  DELIVERY_EXTERNO: { bg: "#F4F2EE", color: "#6E6861", etiqueta: "Delivery Ext." },
};

function renderTextoConMencionesYEnlaces(
  texto: string,
  miHandle: string,
  miRol: string,
  _esMio: boolean
): React.ReactNode {
  const tokenRegex = /(https?:\/\/[^\s]+|@[a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]{2,32})/g;
  const partes = texto.split(tokenRegex);
  const handlePropio = normalizarHandleMencion(miHandle);
  const rolNorm = miRol.toUpperCase();

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
              color: "#221E1B",
              textDecoration: "underline",
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

    if (parte.startsWith("@") && parte.length >= 3) {
      const h = normalizarHandleMencion(parte.slice(1));
      const meMenciona =
        h === "todos" ||
        h === "equipo" ||
        (handlePropio && h === handlePropio) ||
        (h === "taller" && (rolNorm === "TALLER" || rolNorm === "OPERADOR")) ||
        (h === "ventas" &&
          (rolNorm === "VENTAS" || rolNorm === "ADMINISTRADOR" || rolNorm === "SUPERADMIN")) ||
        (h === "delivery" && (rolNorm === "DELIVERY" || rolNorm === "DELIVERY_EXTERNO"));

      return (
        <span
          key={idx}
          style={{
            display: "inline-block",
            padding: "1px 6px",
            margin: "0 1px",
            borderRadius: "5px",
            fontWeight: 700,
            fontSize: "0.79rem",
            background: meMenciona ? "#E7E5E4" : "#F4F2EE",
            border: meMenciona ? "1px solid #A8A29E" : "1px solid #E6E2DA",
            color: "#221E1B",
          }}
        >
          {parte}
        </span>
      );
    }

    return <React.Fragment key={idx}>{parte}</React.Fragment>;
  });
}

function ImagenConRespaldoChatEquipo({
  url,
  alt,
  onAmpliar,
  onReenviar,
}: {
  url: string;
  alt?: string;
  onAmpliar: () => void;
  onReenviar: () => void;
}) {
  const [usarProxy, setUsarProxy] = useState(false);
  const srcEfectivo = usarProxy ? construirUrlProxyMediaOmnicanal(url, false) : url;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxWidth: "260px" }}>
      <div
        onClick={onAmpliar}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") onAmpliar();
        }}
        title="Clic para ampliar fotografía"
        aria-label="Ampliar fotografía"
        style={{
          position: "relative",
          cursor: "zoom-in",
          borderRadius: "10px",
          overflow: "hidden",
          border: "1px solid #E6E2DA",
          background: "#FFFFFF",
        }}
      >
        <img
          src={srcEfectivo}
          alt={alt || "Imagen del equipo"}
          loading="lazy"
          onError={() => {
            if (!usarProxy) setUsarProxy(true);
          }}
          style={{
            display: "block",
            width: "100%",
            maxHeight: "270px",
            objectFit: "cover",
          }}
        />
      </div>

      {/* Acciones directas de imagen: Ampliar, Descargar, Reenviar */}
      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
        <button
          type="button"
          className="btn-responsive-accion"
          onClick={onAmpliar}
          title="Ampliar imagen en pantalla completa"
          aria-label="Ampliar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #D5CFC4",
            background: "#FFFFFF",
            color: "#3A3530",
            fontSize: "0.71rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <ZoomIn size={12} />
          <span className="btn-texto-responsive">Ampliar</span>
        </button>

        <button
          type="button"
          className="btn-responsive-accion"
          onClick={() => void descargarImagenChatOmnicanal(url, alt || "foto-equipo")}
          title="Descargar fotografía"
          aria-label="Descargar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #D5CFC4",
            background: "#FFFFFF",
            color: "#3A3530",
            fontSize: "0.71rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Download size={12} />
          <span className="btn-texto-responsive">Descargar</span>
        </button>

        <button
          type="button"
          className="btn-responsive-accion"
          onClick={onReenviar}
          title="Reenviar esta fotografía por WhatsApp a un cliente"
          aria-label="Reenviar"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "4px 8px",
            borderRadius: "6px",
            border: "1px solid #D5CFC4",
            background: "#FFFFFF",
            color: "#3A3530",
            fontSize: "0.71rem",
            fontWeight: 600,
            cursor: "pointer",
          }}
        >
          <Forward size={12} />
          <span className="btn-texto-responsive">Reenviar</span>
        </button>
      </div>
    </div>
  );
}

export function ChatEquipoInterno({
  negocio,
  embebido = false,
  datosIniciales,
  rutaConversaciones = "/panel/conversaciones",
  onAbrirConversacionCliente,
}: PropsChatEquipoInterno) {
  const negNorm = negocio.trim().toLowerCase();
  const cacheKey = `eco_chat_equipo_sala_${negNorm}`;

  const [sala, setSala] = useState<DatosSalaChatEquipo | null>(datosIniciales ?? null);
  const [cargando, setCargando] = useState<boolean>(!datosIniciales);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [ultimoPedidoCreado, setUltimoPedidoCreado] =
    useState<PedidoCreadoDesdeChatEquipo | null>(null);
  const [avisoOk, setAvisoOk] = useState<string | null>(null);
  const [enVivo, setEnVivo] = useState<boolean>(false);

  const [filtroVista, setFiltroVista] = useState<"todos" | "menciones" | "fotos">("todos");
  const [texto, setTexto] = useState<string>("");
  const [respuestaA, setRespuestaA] = useState<CitaRespuestaChatEquipo | null>(null);
  const [imagenPendienteUrl, setImagenPendienteUrl] = useState<string | null>(null);
  const [subiendoFoto, setSubiendoFoto] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);

  // Autocompletado de @menciones al escribir `@`
  const [consultaMencion, setConsultaMencion] = useState<string | null>(null);

  // Modales de Visor Ampliado y Reenvío
  const [visorDatos, setVisorDatos] = useState<DatosImagenAmpliadaChat | null>(null);
  const [reenvioDatos, setReenvioDatos] = useState<{
    destino: "equipo" | "whatsapp";
    payload: DatosReenvioMensajeModal;
  } | null>(null);

  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canalRef = useRef<any>(null);

  // Hidratación rápida desde LocalStorage
  useEffect(() => {
    if (datosIniciales) return;
    try {
      const guardado = window.localStorage.getItem(cacheKey);
      if (guardado) {
        const parsed = JSON.parse(guardado) as DatosSalaChatEquipo;
        if (parsed?.conversacionId && Array.isArray(parsed.mensajes)) {
          setSala(parsed);
          setCargando(false);
        }
      }
    } catch {
      // Ignorar cache inválido
    }
  }, [cacheKey, datosIniciales]);

  const recargarSala = useCallback(
    async (silencioso = false) => {
      if (!silencioso) setCargando(true);
      const res = await obtenerSalaChatEquipoAction(negNorm);
      if (res.ok) {
        setSala(res.datos);
        setErrorMsg(null);
        try {
          window.localStorage.setItem(cacheKey, JSON.stringify(res.datos));
        } catch {
          // Ignorar límite de cuota
        }
      } else if (!silencioso) {
        setErrorMsg(res.error);
      }
      if (!silencioso) setCargando(false);
    },
    [negNorm, cacheKey]
  );

  useEffect(() => {
    void recargarSala(Boolean(datosIniciales));
  }, [recargarSala, datosIniciales]);

  // Suscripción en tiempo real (<50ms Broadcast + Postgres INSERT de respaldo)
  useEffect(() => {
    const supabase = crearClienteNavegador();
    let realtimeActivo = false;
    let ultimoRespaldoMs = Date.now();
    const canal = supabase
      .channel(nombreCanalRealtimeChatEquipo(negNorm), {
        config: { broadcast: { self: false } },
      })
      .on(
        "broadcast",
        { event: "mensaje_equipo" },
        ({ payload }: { payload: EventoBroadcastChatEquipo }) => {
          if (!payload?.mensaje) return;
          setSala((prev) => {
            if (!prev) return prev;
            if (prev.mensajes.some((m) => m.id === payload.mensaje.id)) return prev;
            return { ...prev, mensajes: [...prev.mensajes, payload.mensaje] };
          });
        }
      )
      .subscribe((status: string) => {
        realtimeActivo = status === "SUBSCRIBED";
        setEnVivo(realtimeActivo);
      });

    canalRef.current = canal;

    // Respaldo adaptativo: 2 min cuando Realtime está conectado, 30 s si se desconecta; pausado en segundo plano.
    const timer = setInterval(() => {
      if (typeof document !== "undefined" && document.visibilityState !== "visible") return;
      const intervaloObjetivoMs = realtimeActivo ? 120000 : 30000;
      if (Date.now() - ultimoRespaldoMs >= intervaloObjetivoMs) {
        ultimoRespaldoMs = Date.now();
        void recargarSala(true);
      }
    }, 30000);

    const alCambiarVisibilidad = () => {
      if (document.visibilityState === "visible" && Date.now() - ultimoRespaldoMs >= 15000) {
        ultimoRespaldoMs = Date.now();
        void recargarSala(true);
      }
    };
    if (typeof document !== "undefined") {
      document.addEventListener("visibilitychange", alCambiarVisibilidad);
    }

    return () => {
      clearInterval(timer);
      if (typeof document !== "undefined") {
        document.removeEventListener("visibilitychange", alCambiarVisibilidad);
      }
      canalRef.current = null;
      void supabase.removeChannel(canal);
    };
  }, [negNorm, recargarSala]);

  // Auto-scroll al último mensaje o al mensaje indicado en ?msg= desde notificación Push
  useEffect(() => {
    const contenedor = scrollRef.current;
    if (!contenedor) return;
    if (typeof window !== "undefined") {
      const msgParam = new URLSearchParams(window.location.search).get("msg");
      if (msgParam) {
        const nodo = contenedor.querySelector(`[data-eq-msg-id="${msgParam}"]`) as HTMLElement | null;
        if (nodo) {
          nodo.scrollIntoView({ behavior: "smooth", block: "center" });
          return;
        }
      }
    }
    contenedor.scrollTop = contenedor.scrollHeight;
  }, [sala?.mensajes.length, filtroVista]);

  const opcionesMencion = useMemo(() => {
    const grupos = [
      { handle: "todos", nombre: "Todo el equipo", rol: "GRUPO" },
      { handle: "taller", nombre: "Equipo de Taller Floral", rol: "TALLER" },
      { handle: "ventas", nombre: "Equipo de Ventas", rol: "VENTAS" },
      { handle: "delivery", nombre: "Repartidores / Delivery", rol: "DELIVERY" },
    ];
    const personas = (sala?.miembros ?? []).map((m: MiembroChatEquipo) => ({
      handle: m.handle,
      nombre: m.nombre,
      rol: m.rol,
    }));
    const todas = [...grupos, ...personas];
    if (consultaMencion === null) return [];
    const q = normalizarHandleMencion(consultaMencion);
    if (!q) return todas.slice(0, 10);
    return todas
      .filter(
        (item) =>
          item.handle.includes(q) || normalizarHandleMencion(item.nombre).includes(q)
      )
      .slice(0, 8);
  }, [sala?.miembros, consultaMencion]);

  const actualizarTextoYDetectarMencion = (nuevoValor: string, cursorPos?: number) => {
    setTexto(nuevoValor);
    const pos = cursorPos ?? nuevoValor.length;
    const hastaCursor = nuevoValor.slice(0, pos);
    const matchAt = hastaCursor.match(/(?:^|\s)@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]{0,24})$/);
    if (matchAt) {
      setConsultaMencion(matchAt[1] ?? "");
    } else {
      setConsultaMencion(null);
    }
  };

  const insertarMencionEnCursor = (handle: string) => {
    const el = textareaRef.current;
    const pos = el?.selectionStart ?? texto.length;
    const antes = texto.slice(0, pos);
    const despues = texto.slice(pos);
    const reemplazado = antes.replace(
      /(?:^|(\s))@([a-zA-Z0-9_áéíóúÁÉÍÓÚñÑ]{0,24})$/,
      `$1@${handle} `
    );
    const finalTxt =
      reemplazado === antes
        ? `${texto}${texto && !texto.endsWith(" ") ? " " : ""}@${handle} `
        : `${reemplazado}${despues}`;
    setTexto(finalTxt);
    setConsultaMencion(null);
    setTimeout(() => textareaRef.current?.focus(), 20);
  };

  const subirArchivoFotoEquipo = async (archivo: File) => {
    if (!archivo.type.startsWith("image/")) {
      setErrorMsg("Selecciona un archivo de imagen válido (JPG, PNG o WEBP).");
      return;
    }
    setSubiendoFoto(true);
    setErrorMsg(null);
    try {
      const supabase = crearClienteNavegador();
      const ext = archivo.name.split(".").pop()?.toLowerCase() || "jpg";
      const ruta = `chat-equipo/${negNorm}/${Date.now()}-${Math.random().toString(36).slice(2, 7)}.${ext}`;
      const { error: errUp } = await supabase.storage
        .from("comun-publico")
        .upload(ruta, archivo, { contentType: archivo.type, upsert: false });
      if (errUp) {
        setErrorMsg(`No se pudo subir la imagen: ${errUp.message}`);
        return;
      }
      const { data: pub } = supabase.storage.from("comun-publico").getPublicUrl(ruta);
      if (pub?.publicUrl) {
        setImagenPendienteUrl(pub.publicUrl);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Error subiendo fotografía.");
    } finally {
      setSubiendoFoto(false);
    }
  };

  const handlePegarPortapapeles = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item && item.type.startsWith("image/")) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          void subirArchivoFotoEquipo(file);
          break;
        }
      }
    }
  };

  const handleEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    if ((!texto.trim() && !imagenPendienteUrl) || enviando) return;

    setEnviando(true);
    setErrorMsg(null);
    const textoEnviar = texto.trim();
    const imgEnviar = imagenPendienteUrl;
    const citaEnviar = respuestaA;

    const res = await enviarMensajeChatEquipoAction({
      negocio: negNorm,
      contenido: textoEnviar,
      imagenUrl: imgEnviar,
      respuestaA: citaEnviar,
    });

    setEnviando(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    if (res.pedidoCreado) {
      setUltimoPedidoCreado(res.pedidoCreado);
    } else if (res.avisoPedidoError) {
      setErrorMsg(`Mensaje enviado, pero ARIA no pudo crear el pedido: ${res.avisoPedidoError}`);
    }

    setTexto("");
    setImagenPendienteUrl(null);
    setRespuestaA(null);
    setConsultaMencion(null);

    setSala((prev) => {
      if (!prev) return prev;
      if (prev.mensajes.some((m) => m.id === res.mensaje.id)) return prev;
      return { ...prev, mensajes: [...prev.mensajes, res.mensaje] };
    });

    try {
      if (canalRef.current) {
        void canalRef.current.send({
          type: "broadcast",
          event: "mensaje_equipo",
          payload: {
            eventoId: res.mensaje.id,
            sala: sala?.sala || "equipo-general",
            mensaje: res.mensaje,
            mencionadosUsuariosIds: res.mencionadosUsuariosIds,
            handlesMencionados: res.handlesMencionados,
          } satisfies EventoBroadcastChatEquipo,
        });
      }
    } catch {
      // Ya enviado por servidor
    }
  };

  const miUid = sala?.usuarioActual.usuarioId || "";
  const miHandle = sala?.usuarioActual.handle || "";
  const miRol = sala?.usuarioActual.rol || "OPERADOR";

  const esMensajeConMencionMia = useCallback(
    (m: MensajeChatEquipo): boolean => {
      const ids = Array.isArray(m.detalle?.menciones_usuarios_ids)
        ? (m.detalle.menciones_usuarios_ids as unknown[]).map(String)
        : [];
      if (miUid && ids.includes(miUid)) return true;
      const handles = Array.isArray(m.detalle?.menciones_handles)
        ? (m.detalle.menciones_handles as unknown[]).map((h) => normalizarHandleMencion(String(h)))
        : [];
      if (handles.includes("todos") || handles.includes("equipo")) return true;
      if (miHandle && handles.includes(normalizarHandleMencion(miHandle))) return true;
      return false;
    },
    [miUid, miHandle]
  );

  const mensajesVisibles = useMemo(() => {
    const lista = sala?.mensajes ?? [];
    if (filtroVista === "menciones") {
      return lista.filter((m) => esMensajeConMencionMia(m));
    }
    if (filtroVista === "fotos") {
      return lista.filter((m) => extraerTodasLasImagenesMensaje(m).length > 0);
    }
    return lista;
  }, [sala?.mensajes, filtroVista, esMensajeConMencionMia]);

  const conteoMencionesMias = useMemo(
    () => (sala?.mensajes ?? []).filter((m) => esMensajeConMencionMia(m)).length,
    [sala?.mensajes, esMensajeConMencionMia]
  );

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        height: embebido
          ? "clamp(480px, calc(100dvh - 140px), 680px)"
          : "calc(100dvh - 125px)",
        minHeight: "460px",
      }}
    >
      {/* Cabecera del Chat Grupal de Trabajo */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "14px",
          padding: "12px 16px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "0 1px 3px rgba(24, 24, 27, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#F4F2EE",
                border: "1px solid #E6E2DA",
                color: "#3A3530",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Users size={18} />
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <strong style={{ fontSize: "0.95rem", color: "#221E1B" }}>
                  {sala?.nombreSala || "Chat Grupal del Equipo"}
                </strong>
                {!enVivo && (
                  <span style={{ fontSize: "0.71rem", color: "#847D74" }}>
                    Sincronizando…
                  </span>
                )}
              </div>
              <div style={{ fontSize: "0.75rem", color: "#847D74" }}>
                Escribe <strong>@nombre</strong> (ej. <code>@kleber</code>) o{" "}
                <code>@taller</code> / <code>@ventas</code> / <code>@delivery</code> para etiquetar.
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            {(
              [
                { id: "todos" as const, etiqueta: "Todos" },
                {
                  id: "menciones" as const,
                  etiqueta: `@Menciones${conteoMencionesMias > 0 ? ` (${conteoMencionesMias})` : ""}`,
                },
                { id: "fotos" as const, etiqueta: "Fotos" },
              ] as const
            ).map((f) => {
              const act = filtroVista === f.id;
              return (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setFiltroVista(f.id)}
                  title={`Filtrar mensajes: ${f.etiqueta}`}
                  aria-label={f.etiqueta}
                  style={{
                    padding: "5px 10px",
                    borderRadius: "8px",
                    border: act ? "1px solid #221E1B" : "1px solid #E6E2DA",
                    background: act ? "#221E1B" : "#F8F7F4",
                    color: act ? "#FFFFFF" : "#57524C",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  {f.etiqueta}
                </button>
              );
            })}

            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => void recargarSala(false)}
              title="Actualizar mensajes del equipo"
              aria-label="Actualizar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "6px 10px",
                borderRadius: "8px",
                border: "1px solid #D5CFC4",
                background: "#FFFFFF",
                color: "#221E1B",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {cargando ? <Loader2 size={13} /> : <RefreshCw size={13} />}
              <span className="btn-texto-responsive">Actualizar</span>
            </button>
          </div>
        </div>

        {/* Barra de miembros conectados / disponibles para mencionar en 1 clic */}
        {sala && sala.miembros.length > 0 && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "6px",
              overflowX: "auto",
              paddingBottom: "2px",
            }}
          >
            <span style={{ fontSize: "0.71rem", fontWeight: 700, color: "#847D74", flexShrink: 0 }}>
              Equipo ({sala.miembros.length}):
            </span>
            {sala.miembros.map((mb) => {
              const badge = COLORES_ROL_EQUIPO[mb.rol] ?? COLORES_ROL_EQUIPO.OPERADOR!;
              return (
                <button
                  key={mb.usuarioId}
                  type="button"
                  onClick={() => insertarMencionEnCursor(mb.handle)}
                  title={`Mencionar a ${mb.nombre} (@${mb.handle} · ${badge.etiqueta})`}
                  aria-label={`Mencionar a ${mb.nombre}`}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "3px 9px",
                    borderRadius: "999px",
                    border: "1px solid #E6E2DA",
                    background: "#F8F7F4",
                    fontSize: "0.72rem",
                    color: "#3A3530",
                    cursor: "pointer",
                    flexShrink: 0,
                  }}
                >
                  <strong style={{ color: "#221E1B" }}>@{mb.handle}</strong>
                  <span style={{ color: "#6E6861" }}>{mb.nombre.split(" ")[0]}</span>
                  <span
                    style={{
                      padding: "1px 6px",
                      borderRadius: "999px",
                      fontSize: "0.64rem",
                      fontWeight: 600,
                      background: "#ECECEE",
                      color: "#6E6861",
                    }}
                  >
                    {badge.etiqueta}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {avisoOk && (
        <div
          style={{
            padding: "8px 12px",
            borderRadius: "10px",
            background: "#F2F6F3",
            border: "1px solid #CEDDD3",
            color: "#2B4A36",
            fontSize: "0.8rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <span>{avisoOk}</span>
          <button
            type="button"
            onClick={() => setAvisoOk(null)}
            title="Cerrar aviso"
            aria-label="Cerrar aviso"
            style={{ border: "none", background: "transparent", cursor: "pointer", fontWeight: 700 }}
          >
            ✕
          </button>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            padding: "9px 12px",
            borderRadius: "10px",
            background: "#FAF2F2",
            border: "1px solid #E5CACA",
            color: "#8A2E2E",
            fontSize: "0.8rem",
          }}
        >
          {errorMsg}
        </div>
      )}

      {/* Área principal de conversación + compositor */}
      <div
        style={{
          flex: 1,
          minHeight: 0,
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "14px",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Historial de mensajes */}
        <div
          ref={scrollRef}
          style={{
            flex: 1,
            overflowY: "auto",
            padding: "16px",
            background: "#F8F7F4",
            display: "flex",
            flexDirection: "column",
            gap: "12px",
          }}
        >
          {cargando && !sala ? (
            <div style={{ textAlign: "center", padding: "32px", color: "#847D74", fontSize: "0.84rem" }}>
              Cargando sala de trabajo del equipo…
            </div>
          ) : mensajesVisibles.length === 0 ? (
            <div
              style={{
                textAlign: "center",
                padding: "38px 20px",
                color: "#847D74",
                fontSize: "0.84rem",
                lineHeight: 1.6,
              }}
            >
              {filtroVista === "todos"
                ? "Sala lista para el equipo. Escribe un mensaje, adjunta una fotografía o usa @kleber / @taller para hacer una consulta."
                : "No hay mensajes que coincidan con este filtro."}
            </div>
          ) : (
            mensajesVisibles.map((m) => {
              const esMio = Boolean(miUid && m.autorUsuarioId === miUid);
              const meMenciona = esMensajeConMencionMia(m);
              const rolAutor = String(m.detalle?.autor_rol || "OPERADOR").toUpperCase();
              const badgeRol = COLORES_ROL_EQUIPO[rolAutor] ?? COLORES_ROL_EQUIPO.OPERADOR!;
              const cita = (m.detalle?.respuesta_a as CitaRespuestaChatEquipo | undefined) ?? null;
              const reenvio =
                (m.detalle?.reenviado_de as ContextoReenvioChatEquipo | undefined) ?? null;
              const segmentos = extraerSegmentosMultimediaMensaje(m.contenido, m.detalle);
              const primeraImg = extraerTodasLasImagenesMensaje(m)[0]?.url ?? null;

              return (
                <div
                  key={m.id}
                  data-eq-msg-id={m.id}
                  style={{
                    alignSelf: esMio ? "flex-end" : "flex-start",
                    maxWidth: "85%",
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px",
                  }}
                >
                  {/* Encabezado de autor + rol + hora */}
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: esMio ? "flex-end" : "flex-start",
                      gap: "6px",
                      fontSize: "0.71rem",
                      color: "#847D74",
                      flexWrap: "wrap",
                    }}
                  >
                    {meMenciona && !esMio && (
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                          padding: "1px 6px",
                          borderRadius: "999px",
                          background: "#F4F2EE",
                          border: "1px solid #D5CFC4",
                          color: "#221E1B",
                          fontWeight: 700,
                        }}
                      >
                        <BellRing size={11} />
                        Mención
                      </span>
                    )}
                    <strong style={{ color: "#3A3530" }}>
                      {esMio ? `Tú (${m.autorNombre.split(" ")[0]})` : m.autorNombre}
                    </strong>
                    <span
                      style={{
                        padding: "1px 6px",
                        borderRadius: "999px",
                        fontSize: "0.65rem",
                        fontWeight: 600,
                        background: badgeRol.bg,
                        color: badgeRol.color,
                      }}
                    >
                      {badgeRol.etiqueta}
                    </span>
                    <span>
                      {new Date(m.creadoEn).toLocaleTimeString("es-EC", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                  </div>

                  {/* Globo del mensaje — Diseño limpio y sobrio */}
                  <div
                    style={{
                      padding: "10px 13px",
                      borderRadius: "12px",
                      background: esMio
                        ? "#ECEAE4"
                        : meMenciona
                          ? "#FAFAF9"
                          : "#FFFFFF",
                      color: "#221E1B",
                      border: esMio
                        ? "1px solid #DCD8D0"
                        : meMenciona
                          ? "1.5px solid #78716C"
                          : "1px solid #E6E2DA",
                      boxShadow: "0 1px 2px rgba(24, 24, 27, 0.04)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "0.84rem",
                      lineHeight: 1.48,
                    }}
                  >
                    {/* Cita de pregunta respondida */}
                    {cita && (
                      <div
                        style={{
                          padding: "6px 9px",
                          borderRadius: "8px",
                          borderLeft: "3px solid #6E6861",
                          background: esMio ? "rgba(255,255,255,0.65)" : "#F4F2EE",
                          color: "#3A3530",
                          fontSize: "0.75rem",
                        }}
                      >
                        <div style={{ fontWeight: 700 }}>
                          ↩ En respuesta a {cita.autorNombre}
                        </div>
                        <div style={{ color: "#6E6861" }}>{cita.extracto}</div>
                      </div>
                    )}

                    {/* Contexto de mensaje/foto reenviado desde chat de un cliente con enlace directo de retorno */}
                    {reenvio && (() => {
                      const hrefRetorno = construirHrefRetornoChatCliente(
                        reenvio,
                        rutaConversaciones
                      );
                      return (
                        <div
                          style={{
                            padding: "7px 10px",
                            borderRadius: "8px",
                            borderLeft: "3px solid #57524C",
                            background: esMio ? "rgba(255,255,255,0.7)" : "#F8F7F4",
                            color: "#3A3530",
                            fontSize: "0.75rem",
                            display: "flex",
                            flexDirection: "column",
                            gap: "4px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              flexWrap: "wrap",
                            }}
                          >
                            <strong>
                              ↪ Cliente: {reenvio.clienteNombre}
                              {reenvio.clienteTelefono ? ` (${reenvio.clienteTelefono})` : ""}
                            </strong>

                            <a
                              href={hrefRetorno}
                              onClick={(ev) => {
                                if (onAbrirConversacionCliente) {
                                  ev.preventDefault();
                                  onAbrirConversacionCliente(reenvio);
                                }
                              }}
                              title={`Ir directamente al chat con ${reenvio.clienteNombre} en la Bandeja de Chats`}
                              aria-label={`Ir al chat de ${reenvio.clienteNombre}`}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                borderRadius: "999px",
                                background: "#221E1B",
                                color: "#FFFFFF",
                                fontSize: "0.69rem",
                                fontWeight: 700,
                                textDecoration: "none",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <ExternalLink size={11} />
                              <span>Ir al chat</span>
                            </a>
                          </div>

                          {reenvio.textoOriginal && (
                            <span style={{ color: "#6E6861" }}>“{reenvio.textoOriginal}”</span>
                          )}
                        </div>
                      );
                    })()}

                    {/* Segmentos de texto + imágenes */}
                    {segmentos.map((seg, idx) => {
                      if (seg.tipo === "imagen") {
                        return (
                          <ImagenConRespaldoChatEquipo
                            key={`eq-img-${idx}`}
                            url={seg.url}
                            alt={seg.alt}
                            onAmpliar={() =>
                              setVisorDatos({
                                url: seg.url,
                                titulo: seg.alt || reenvio?.clienteNombre || "Foto del Equipo",
                                autorNombre: m.autorNombre,
                                creadoEn: m.creadoEn,
                                contextoReenvio: reenvio,
                              })
                            }
                            onReenviar={() =>
                              setReenvioDatos({
                                destino: "whatsapp",
                                payload: {
                                  imagenUrl: seg.url,
                                  tituloImagen: seg.alt || "Arreglo Tinkay",
                                  textoOriginal: "",
                                  contextoCliente: reenvio,
                                },
                              })
                            }
                          />
                        );
                      }
                      if (seg.tipo !== "texto") {
                        return null;
                      }
                      return (
                        <div
                          key={`eq-txt-${idx}`}
                          style={{ whiteSpace: "pre-wrap", wordBreak: "break-word" }}
                        >
                          {renderTextoConMencionesYEnlaces(seg.texto, miHandle, miRol, esMio)}
                        </div>
                      );
                    })}

                    {/* Barra rápida de respuesta, retorno al chat y reenvío por burbuja */}
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "flex-end",
                        gap: "6px",
                        flexWrap: "wrap",
                        paddingTop: "2px",
                      }}
                    >
                      {reenvio && (
                        <a
                          href={construirHrefRetornoChatCliente(reenvio, rutaConversaciones)}
                          onClick={(ev) => {
                            if (onAbrirConversacionCliente) {
                              ev.preventDefault();
                              onAbrirConversacionCliente(reenvio);
                            }
                          }}
                          title={`Volver al mensaje compartido del cliente ${reenvio.clienteNombre}`}
                          aria-label="Ir al chat del cliente"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            padding: "2px 7px",
                            borderRadius: "6px",
                            border: "1px solid #D5CFC4",
                            background: "#FFFFFF",
                            color: "#3A3530",
                            fontSize: "0.7rem",
                            fontWeight: 600,
                            textDecoration: "none",
                          }}
                        >
                          <ExternalLink size={11} />
                          <span>Ir al chat</span>
                        </a>
                      )}

                      <button
                        type="button"
                        onClick={() => {
                          setRespuestaA({
                            id: m.id,
                            autorNombre: m.autorNombre,
                            extracto: m.contenido
                              .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "Foto")
                              .slice(0, 110),
                            imagenUrl: primeraImg,
                          });
                          textareaRef.current?.focus();
                        }}
                        title="Responder esta pregunta o comentario"
                        aria-label="Responder"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 7px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          color: "#57524C",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Reply size={11} />
                        <span>Responder</span>
                      </button>

                      <button
                        type="button"
                        onClick={() =>
                          setReenvioDatos({
                            destino: "whatsapp",
                            payload: {
                              imagenUrl: primeraImg,
                              tituloImagen: "Tinkay Floristería",
                              textoOriginal: m.contenido
                                .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "")
                                .trim(),
                            },
                          })
                        }
                        title="Reenviar este mensaje o foto a un cliente por WhatsApp"
                        aria-label="Reenviar WhatsApp"
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 7px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          background: "#FFFFFF",
                          color: "#57524C",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                      >
                        <Forward size={11} />
                        <span>A WhatsApp</span>
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Compositor inferior con Autocompletado @menciones, Cita y Subida de Fotos */}
        <form
          onSubmit={handleEnviar}
          style={{
            position: "relative",
            borderTop: "1px solid #E6E2DA",
            background: "#FFFFFF",
            padding: "10px 12px calc(10px + env(safe-area-inset-bottom, 0px))",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          {/* Menú flotante de autocompletado de @menciones */}
          {consultaMencion !== null && opcionesMencion.length > 0 && (
            <div
              style={{
                position: "absolute",
                bottom: "100%",
                left: "14px",
                right: "14px",
                maxWidth: "360px",
                marginBottom: "6px",
                background: "#FFFFFF",
                border: "1px solid #D5CFC4",
                borderRadius: "12px",
                boxShadow: "0 12px 28px rgba(15, 23, 42, 0.16)",
                overflow: "hidden",
                zIndex: 40,
              }}
            >
              <div
                style={{
                  padding: "6px 10px",
                  background: "#F8F7F4",
                  borderBottom: "1px solid #E6E2DA",
                  fontSize: "0.71rem",
                  fontWeight: 700,
                  color: "#847D74",
                }}
              >
                Mencionar compañero o área
              </div>
              {opcionesMencion.map((op) => (
                <button
                  key={op.handle}
                  type="button"
                  onClick={() => insertarMencionEnCursor(op.handle)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    border: "none",
                    borderBottom: "1px solid #F4F2EE",
                    background: "#FFFFFF",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    fontSize: "0.8rem",
                    cursor: "pointer",
                    textAlign: "left",
                  }}
                >
                  <span>
                    <strong style={{ color: "#221E1B" }}>@{op.handle}</strong> · {op.nombre}
                  </span>
                  <span style={{ fontSize: "0.69rem", color: "#847D74", fontWeight: 700 }}>
                    {op.rol}
                  </span>
                </button>
              ))}
            </div>
          )}

          {/* Barra de cita activa ("Respondiendo a...") */}
          {respuestaA && (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
                padding: "6px 10px",
                borderRadius: "8px",
                background: "#F4F2EE",
                borderLeft: "3px solid #57524C",
                fontSize: "0.76rem",
                color: "#3A3530",
              }}
            >
              <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                ↩ Respondiendo a <strong>{respuestaA.autorNombre}</strong>: {respuestaA.extracto}
              </span>
              <button
                type="button"
                onClick={() => setRespuestaA(null)}
                title="Quitar cita de respuesta"
                aria-label="Cancelar cita"
                style={{ border: "none", background: "transparent", cursor: "pointer" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* Vista previa de fotografía adjunta lista para enviar */}
          {imagenPendienteUrl && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "10px",
                padding: "6px 10px",
                borderRadius: "9px",
                background: "#F8F7F4",
                border: "1px solid #D5CFC4",
              }}
            >
              <img
                src={imagenPendienteUrl}
                alt="Foto lista para enviar"
                style={{
                  width: "52px",
                  height: "52px",
                  objectFit: "cover",
                  borderRadius: "7px",
                }}
              />
              <span style={{ fontSize: "0.77rem", color: "#57524C", flex: 1 }}>
                📷 Fotografía adjunta lista para enviar al equipo
              </span>
              <button
                type="button"
                onClick={() => setImagenPendienteUrl(null)}
                title="Quitar fotografía adjunta"
                aria-label="Quitar foto"
                style={{ border: "none", background: "transparent", cursor: "pointer" }}
              >
                <X size={15} />
              </button>
            </div>
          )}

          {ultimoPedidoCreado && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "10px",
                padding: "8px 12px",
                borderRadius: "10px",
                background: "#ECFDF5",
                border: "1px solid #A7F3D0",
                color: "#065F46",
                fontSize: "0.78rem",
                flexWrap: "wrap",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                <Sparkles size={14} />
                <span>
                  Pedido <strong>{ultimoPedidoCreado.codigo}</strong> creado en estado{" "}
                  <strong>{ultimoPedidoCreado.estado}</strong> ({ultimoPedidoCreado.productoResumen})
                </span>
                <a
                  href={`/panel/pedidos?pedido=${encodeURIComponent(ultimoPedidoCreado.codigo)}`}
                  style={{
                    color: "#047857",
                    fontWeight: 800,
                    textDecoration: "underline",
                  }}
                >
                  Ver pedido
                </a>
              </div>
              <button
                type="button"
                onClick={() => setUltimoPedidoCreado(null)}
                aria-label="Cerrar aviso"
                style={{ border: "none", background: "transparent", cursor: "pointer", color: "#065F46" }}
              >
                <X size={14} />
              </button>
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", alignItems: "flex-end" }}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void subirArchivoFotoEquipo(f);
                e.target.value = "";
              }}
              style={{ display: "none" }}
            />

            <button
              type="button"
              className="btn-responsive-accion"
              disabled={subiendoFoto}
              onClick={() => fileInputRef.current?.click()}
              title="Adjuntar fotografía o tomar foto con cámara"
              aria-label="Adjuntar foto"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                padding: "9px 11px",
                borderRadius: "10px",
                border: "1px solid #D5CFC4",
                background: "#F8F7F4",
                color: "#57524C",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: subiendoFoto ? "wait" : "pointer",
              }}
            >
              {subiendoFoto ? <Loader2 size={16} /> : <ImagePlus size={16} />}
              <span className="btn-texto-responsive">Foto</span>
            </button>

            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => {
                actualizarTextoYDetectarMencion(`${texto}${texto && !texto.endsWith(" ") ? " " : ""}@`);
                textareaRef.current?.focus();
              }}
              title="Mencionar a un miembro del equipo (@kleber, @taller, @delivery)"
              aria-label="Mencionar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "9px 11px",
                borderRadius: "10px",
                border: "1px solid #D5CFC4",
                background: "#F8F7F4",
                color: "#3A3530",
                fontSize: "0.78rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              <AtSign size={16} />
              <span className="btn-texto-responsive">Mencionar</span>
            </button>

            <button
              type="button"
              className="btn-responsive-accion"
              onClick={() => {
                if (!/^nuevo\s+pedido\s*:/i.test(texto.trim())) {
                  setTexto((prev) => `Nuevo Pedido: ${prev}`.trimStart());
                }
                textareaRef.current?.focus();
              }}
              title="Iniciar mensaje con 'Nuevo Pedido:' para que ARIA cree el pedido en estado Nuevo - Por Confirmar"
              aria-label="Nuevo Pedido"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
                padding: "9px 11px",
                borderRadius: "10px",
                border: "1px solid #C7D2FE",
                background: "#EEF2FF",
                color: "#312E81",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              <Sparkles size={15} />
              <span className="btn-texto-responsive">Pedido</span>
            </button>

            <textarea
              ref={textareaRef}
              rows={1}
              value={texto}
              onChange={(e) =>
                actualizarTextoYDetectarMencion(e.target.value, e.target.selectionStart)
              }
              onPaste={handlePegarPortapapeles}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  void handleEnviar(e);
                }
              }}
              placeholder="Mensaje al equipo o @kleber…"
              style={{
                flex: 1,
                minWidth: 0,
                minHeight: "42px",
                maxHeight: "105px",
                padding: "9px 12px",
                lineHeight: 1.35,
                borderRadius: "10px",
                border: "1px solid #D5CFC4",
                fontSize: "16px",
                fontFamily: "inherit",
                resize: "none",
              }}
            />

            <button
              type="submit"
              className="btn-responsive-accion"
              disabled={enviando || (!texto.trim() && !imagenPendienteUrl)}
              title="Enviar mensaje al equipo"
              aria-label="Enviar"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "10px 15px",
                borderRadius: "10px",
                border: "none",
                background: "#221E1B",
                color: "#FFFFFF",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: enviando ? "wait" : "pointer",
                opacity: !texto.trim() && !imagenPendienteUrl ? 0.45 : 1,
              }}
            >
              {enviando ? <Loader2 size={15} /> : <Send size={15} />}
              <span className="btn-texto-responsive">Enviar</span>
            </button>
          </div>
        </form>
      </div>

      {/* Visor de imagen ampliada */}
      <ModalVisorImagenChat
        abierto={Boolean(visorDatos)}
        datos={visorDatos}
        onCerrar={() => setVisorDatos(null)}
        onAbrirReenvio={(destinoInicial) => {
          if (!visorDatos) return;
          const actual = visorDatos;
          setVisorDatos(null);
          setReenvioDatos({
            destino: destinoInicial,
            payload: {
              imagenUrl: actual.url,
              tituloImagen: actual.titulo,
              textoOriginal: "",
              contextoCliente: actual.contextoReenvio,
            },
          });
        }}
      />

      {/* Modal de reenvío a WhatsApp o al Equipo */}
      <ModalReenviarMensajeChat
        abierto={Boolean(reenvioDatos)}
        negocio={negNorm}
        destinoInicial={reenvioDatos?.destino ?? "whatsapp"}
        datos={reenvioDatos?.payload ?? null}
        conversacionesWhatsapp={sala?.conversacionesWhatsapp}
        miembrosEquipo={sala?.miembros}
        onCerrar={() => setReenvioDatos(null)}
        onExito={(msg) => {
          setAvisoOk(msg);
          void recargarSala(true);
        }}
      />
    </div>
  );
}
