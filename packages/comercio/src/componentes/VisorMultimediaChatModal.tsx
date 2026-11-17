"use client";

import React, { useEffect, useMemo, useState } from "react";
import {
  AtSign,
  Check,
  Download,
  ExternalLink,
  Forward,
  Loader2,
  MessageCircle,
  Search,
  Send,
  Share2,
  Users,
  X,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import {
  enviarMensajeChatEquipoAction,
  obtenerSalaChatEquipoAction,
  reenviarMensajeAClienteWhatsappAction,
} from "../acciones-omnicanal";
import type {
  ContextoReenvioChatEquipo,
  ConversacionWhatsappResumen,
  MiembroChatEquipo,
} from "../omnicanal";

export function construirUrlProxyMediaOmnicanal(
  urlOriginal: string,
  descargar = false,
  nombre?: string
): string {
  const params = new URLSearchParams({ url: urlOriginal });
  if (descargar) params.set("dl", "1");
  if (nombre) params.set("nombre", nombre);
  return `/api/omnicanal/media?${params.toString()}`;
}

export async function descargarImagenChatOmnicanal(
  url: string,
  titulo?: string | null
): Promise<void> {
  const baseNombre = (titulo || "imagen-tinkay")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9_-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);

  const urlDescarga = construirUrlProxyMediaOmnicanal(
    url,
    true,
    baseNombre || `tinkay-${Date.now()}`
  );

  try {
    const res = await fetch(urlDescarga);
    if (res.ok) {
      const blob = await res.blob();
      const ext = blob.type.includes("png")
        ? "png"
        : blob.type.includes("webp")
          ? "webp"
          : "jpg";
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objUrl;
      a.download = `${baseNombre || "tinkay-chat"}.${ext}`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(objUrl), 5000);
      return;
    }
  } catch {
    // Respaldo directo
  }

  const a = document.createElement("a");
  a.href = urlDescarga;
  a.download = `${baseNombre || "tinkay-chat"}.jpg`;
  a.target = "_blank";
  a.rel = "noreferrer";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

export async function compartirImagenWhatsappNativo(
  url: string,
  titulo?: string | null
): Promise<void> {
  const texto = [titulo?.trim(), url].filter(Boolean).join("\n");
  try {
    if (typeof navigator !== "undefined" && typeof navigator.share === "function") {
      const res = await fetch(construirUrlProxyMediaOmnicanal(url, false));
      if (res.ok) {
        const blob = await res.blob();
        const archivo = new File([blob], "arreglo-tinkay.jpg", {
          type: blob.type || "image/jpeg",
        });
        if (!navigator.canShare || navigator.canShare({ files: [archivo] })) {
          await navigator.share({
            title: titulo || "Tinkay Floristería",
            text: titulo || undefined,
            files: [archivo],
          });
          return;
        }
      }
    }
  } catch {
    // Si el usuario cancela o el navegador de escritorio no soporta archivos en Web Share, abrir wa.me
  }

  window.open(
    `https://wa.me/?text=${encodeURIComponent(texto)}`,
    "_blank",
    "noopener,noreferrer"
  );
}

export interface DatosImagenAmpliadaChat {
  url: string;
  titulo?: string | null;
  autorNombre?: string | null;
  creadoEn?: string | null;
  contextoReenvio?: ContextoReenvioChatEquipo | null;
}

export interface PropsModalVisorImagenChat {
  abierto: boolean;
  datos: DatosImagenAmpliadaChat | null;
  onCerrar: () => void;
  onAbrirReenvio: (destinoInicial: "equipo" | "whatsapp") => void;
}

export function ModalVisorImagenChat({
  abierto,
  datos,
  onCerrar,
  onAbrirReenvio,
}: PropsModalVisorImagenChat) {
  const [zoomActivo, setZoomActivo] = useState<boolean>(false);
  const [usarProxy, setUsarProxy] = useState<boolean>(false);
  const [descargando, setDescargando] = useState<boolean>(false);

  useEffect(() => {
    setZoomActivo(false);
    setUsarProxy(false);
  }, [datos?.url]);

  useEffect(() => {
    if (!abierto) return;
    const alPresionarEsc = (ev: KeyboardEvent) => {
      if (ev.key === "Escape") onCerrar();
    };
    window.addEventListener("keydown", alPresionarEsc);
    return () => window.removeEventListener("keydown", alPresionarEsc);
  }, [abierto, onCerrar]);

  if (!abierto || !datos) return null;

  const srcEfectivo = usarProxy
    ? construirUrlProxyMediaOmnicanal(datos.url, false)
    : datos.url;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Visor de imagen ampliada"
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9990,
        background: "rgba(15, 23, 42, 0.88)",
        backdropFilter: "blur(4px)",
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        padding: "16px",
      }}
    >
      {/* Barra superior con metadatos y acciones rápidas */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "12px",
          flexWrap: "wrap",
          padding: "10px 14px",
          borderRadius: "12px",
          background: "rgba(15, 23, 42, 0.78)",
          border: "1px solid rgba(255, 255, 255, 0.14)",
          color: "#FFFFFF",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", minWidth: 0 }}>
          <strong
            style={{
              fontSize: "0.88rem",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {datos.titulo || "Fotografía de conversación"}
          </strong>
          {(datos.autorNombre || datos.creadoEn) && (
            <span style={{ fontSize: "0.74rem", color: "#CBD5E1" }}>
              {[
                datos.autorNombre,
                datos.creadoEn
                  ? new Date(datos.creadoEn).toLocaleString("es-EC", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })
                  : null,
              ]
                .filter(Boolean)
                .join(" · ")}
            </span>
          )}
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => setZoomActivo((z) => !z)}
            title={zoomActivo ? "Restaurar tamaño ajustado" : "Acercar imagen al doble"}
            aria-label={zoomActivo ? "Ajustar" : "Acercar"}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.1)",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {zoomActivo ? <ZoomOut size={15} /> : <ZoomIn size={15} />}
            <span className="btn-texto-responsive">{zoomActivo ? "Ajustar" : "Zoom 2x"}</span>
          </button>

          <button
            type="button"
            className="btn-responsive-accion"
            disabled={descargando}
            onClick={async () => {
              setDescargando(true);
              await descargarImagenChatOmnicanal(datos.url, datos.titulo);
              setDescargando(false);
            }}
            title="Descargar fotografía en tu dispositivo"
            aria-label="Descargar imagen"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid #38BDF8",
              background: "#0284C7",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: descargando ? "wait" : "pointer",
            }}
          >
            {descargando ? <Loader2 size={15} /> : <Download size={15} />}
            <span className="btn-texto-responsive">Descargar</span>
          </button>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => onAbrirReenvio("equipo")}
            title="Reenviar esta imagen al Chat Grupal del Equipo con @mención"
            aria-label="Enviar al equipo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid #A78BFA",
              background: "#6D28D9",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Users size={15} />
            <span className="btn-texto-responsive">Al Equipo</span>
          </button>

          <button
            type="button"
            className="btn-responsive-accion"
            onClick={() => onAbrirReenvio("whatsapp")}
            title="Reenviar esta imagen por WhatsApp a un cliente o contacto"
            aria-label="Reenviar por WhatsApp"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "7px 12px",
              borderRadius: "8px",
              border: "1px solid #4ADE80",
              background: "#15803D",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Forward size={15} />
            <span className="btn-texto-responsive">Reenviar WA</span>
          </button>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar visor de imagen"
            aria-label="Cerrar visor"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              width: "34px",
              height: "34px",
              borderRadius: "8px",
              border: "1px solid rgba(255,255,255,0.22)",
              background: "rgba(255,255,255,0.12)",
              color: "#FFFFFF",
              cursor: "pointer",
            }}
          >
            <X size={17} />
          </button>
        </div>
      </div>

      {/* Lienzo central con soporte de zoom */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          overflow: "auto",
          padding: "16px 8px",
        }}
      >
        <img
          src={srcEfectivo}
          alt={datos.titulo || "Imagen ampliada"}
          onClick={() => setZoomActivo((z) => !z)}
          onError={() => {
            if (!usarProxy) setUsarProxy(true);
          }}
          style={{
            maxWidth: zoomActivo ? "none" : "92vw",
            maxHeight: zoomActivo ? "none" : "78vh",
            width: zoomActivo ? "auto" : undefined,
            transform: zoomActivo ? "scale(1.65)" : "scale(1)",
            transformOrigin: "center center",
            transition: "transform 0.18s ease",
            borderRadius: "12px",
            boxShadow: "0 20px 50px rgba(0, 0, 0, 0.55)",
            background: "#FFFFFF",
            cursor: zoomActivo ? "zoom-out" : "zoom-in",
            objectFit: "contain",
          }}
        />
      </div>

      {/* Pie con acceso directo externo */}
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "12px",
          fontSize: "0.76rem",
          color: "#CBD5E1",
        }}
      >
        <span>Haz clic sobre la imagen para acercar o alejar</span>
        <a
          href={srcEfectivo}
          target="_blank"
          rel="noreferrer"
          style={{
            color: "#7DD3FC",
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            textDecoration: "underline",
          }}
        >
          <ExternalLink size={13} />
          Abrir pestaña
        </a>
      </div>
    </div>
  );
}

export interface DatosReenvioMensajeModal {
  imagenUrl?: string | null;
  tituloImagen?: string | null;
  textoOriginal?: string | null;
  contextoCliente?: ContextoReenvioChatEquipo | null;
}

export interface PropsModalReenviarMensajeChat {
  abierto: boolean;
  negocio: string;
  destinoInicial?: "equipo" | "whatsapp";
  datos: DatosReenvioMensajeModal | null;
  conversacionesWhatsapp?: ConversacionWhatsappResumen[];
  miembrosEquipo?: MiembroChatEquipo[];
  onCerrar: () => void;
  onExito?: (mensajeConfirmacion: string, destino: "equipo" | "whatsapp") => void;
}

export function ModalReenviarMensajeChat({
  abierto,
  negocio,
  destinoInicial = "equipo",
  datos,
  conversacionesWhatsapp: chatsProp,
  miembrosEquipo: miembrosProp,
  onCerrar,
  onExito,
}: PropsModalReenviarMensajeChat) {
  const [destino, setDestino] = useState<"equipo" | "whatsapp">(destinoInicial);
  const [comentario, setComentario] = useState<string>("");
  const [busquedaWa, setBusquedaWa] = useState<string>("");
  const [chatWaDestinoId, setChatWaDestinoId] = useState<string>("");
  const [miembros, setMiembros] = useState<MiembroChatEquipo[]>(miembrosProp ?? []);
  const [chatsWa, setChatsWa] = useState<ConversacionWhatsappResumen[]>(chatsProp ?? []);
  const [cargandoMeta, setCargandoMeta] = useState<boolean>(false);
  const [enviando, setEnviando] = useState<boolean>(false);
  const [errorLocal, setErrorLocal] = useState<string | null>(null);

  useEffect(() => {
    setDestino(destinoInicial);
    setErrorLocal(null);
    if (destinoInicial === "equipo") {
      setComentario("");
    } else {
      setComentario(datos?.tituloImagen || datos?.textoOriginal || "");
    }
  }, [abierto, destinoInicial, datos]);

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargandoMeta(true);
    obtenerSalaChatEquipoAction(negocio)
      .then((res) => {
        if (cancelado || !res.ok) return;
        setMiembros(res.datos.miembros);
        if (!chatsProp || chatsProp.length === 0) {
          setChatsWa(res.datos.conversacionesWhatsapp);
          if (res.datos.conversacionesWhatsapp[0]?.id) {
            setChatWaDestinoId((prev) => prev || res.datos.conversacionesWhatsapp[0]!.id);
          }
        }
      })
      .finally(() => {
        if (!cancelado) setCargandoMeta(false);
      });
    return () => {
      cancelado = true;
    };
  }, [abierto, negocio, chatsProp]);

  useEffect(() => {
    if (chatsProp && chatsProp.length > 0) {
      setChatsWa(chatsProp);
      setChatWaDestinoId((prev) => prev || chatsProp[0]!.id);
    }
  }, [chatsProp]);

  const chatsFiltrados = useMemo(() => {
    const q = busquedaWa.trim().toLowerCase();
    if (!q) return chatsWa;
    return chatsWa.filter(
      (c) =>
        c.nombre.toLowerCase().includes(q) ||
        (c.telefono || "").toLowerCase().includes(q)
    );
  }, [chatsWa, busquedaWa]);

  if (!abierto || !datos) return null;

  const insertarMencion = (handle: string) => {
    const token = `@${handle} `;
    setComentario((prev) =>
      prev.includes(`@${handle}`) ? prev : `${prev}${prev && !prev.endsWith(" ") ? " " : ""}${token}`
    );
  };

  const handleConfirmarReenvio = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorLocal(null);
    setEnviando(true);

    try {
      if (destino === "equipo") {
        const cuerpoEquipo =
          comentario.trim() ||
          (datos.imagenUrl
            ? `📷 Consulta sobre imagen${
                datos.contextoCliente?.clienteNombre
                  ? ` de ${datos.contextoCliente.clienteNombre}`
                  : ""
              }`
            : datos.textoOriginal || "Mensaje reenviado al equipo");

        const res = await enviarMensajeChatEquipoAction({
          negocio,
          contenido: cuerpoEquipo,
          imagenUrl: datos.imagenUrl ?? null,
          reenviadoDe: datos.contextoCliente ?? {
            clienteNombre: "Conversación en vivo",
            textoOriginal: datos.textoOriginal ?? null,
            imagenUrl: datos.imagenUrl ?? null,
          },
        });

        if (!res.ok) {
          setErrorLocal(res.error);
          setEnviando(false);
          return;
        }

        const mencionesTxt =
          res.handlesMencionados.length > 0
            ? ` (notificados: ${res.handlesMencionados.map((h) => `@${h}`).join(", ")})`
            : "";
        onExito?.(`Enviado al Chat Grupal del Equipo${mencionesTxt}.`, "equipo");
        onCerrar();
        return;
      }

      // Destino: Cliente en WhatsApp (YCloud API)
      if (!chatWaDestinoId) {
        setErrorLocal(
          "Selecciona una conversación de WhatsApp de la lista o usa 'WhatsApp Externo'."
        );
        setEnviando(false);
        return;
      }

      const resWa = await reenviarMensajeAClienteWhatsappAction({
        negocio,
        conversacionDestinoId: chatWaDestinoId,
        texto: comentario.trim(),
        imagenUrl: datos.imagenUrl ?? null,
        tituloImagen: datos.tituloImagen ?? "Arreglo Tinkay",
      });

      if (!resWa.ok) {
        setErrorLocal(resWa.error);
        setEnviando(false);
        return;
      }

      onExito?.(
        resWa.avisoWhatsApp
          ? `Registrado en el chat (${resWa.avisoWhatsApp}).`
          : "Reenviado correctamente al WhatsApp del cliente.",
        "whatsapp"
      );
      onCerrar();
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Reenviar mensaje o fotografía"
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9995,
        background: "rgba(15, 23, 42, 0.65)",
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
          maxWidth: "520px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Forward size={18} style={{ color: "#0F172A" }} />
            <strong style={{ fontSize: "0.96rem", color: "#0F172A" }}>
              Reenviar {datos.imagenUrl ? "Fotografía" : "Mensaje"}
            </strong>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana de reenvío"
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "#F1F5F9",
              borderRadius: "8px",
              width: "30px",
              height: "30px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        {/* Selector de destino */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "8px",
            background: "#F8FAFC",
            padding: "4px",
            borderRadius: "10px",
            border: "1px solid #E2E8F0",
          }}
        >
          <button
            type="button"
            onClick={() => setDestino("equipo")}
            title="Enviar al Chat Grupal Interno del Equipo con @menciones"
            aria-label="Chat del Equipo"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: destino === "equipo" ? "#6D28D9" : "transparent",
              color: destino === "equipo" ? "#FFFFFF" : "#334155",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Users size={15} />
            <span>Chat Equipo</span>
          </button>

          <button
            type="button"
            onClick={() => setDestino("whatsapp")}
            title="Reenviar a un cliente por WhatsApp"
            aria-label="WhatsApp Cliente"
            style={{
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              padding: "8px 10px",
              borderRadius: "8px",
              border: "none",
              background: destino === "whatsapp" ? "#15803D" : "transparent",
              color: destino === "whatsapp" ? "#FFFFFF" : "#334155",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <MessageCircle size={15} />
            <span>WhatsApp</span>
          </button>
        </div>

        {/* Vista previa de la foto o mensaje que se va a reenviar */}
        <div
          style={{
            display: "flex",
            gap: "10px",
            alignItems: "center",
            padding: "10px",
            borderRadius: "10px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
          }}
        >
          {datos.imagenUrl && (
            <img
              src={datos.imagenUrl}
              alt={datos.tituloImagen || "Vista previa"}
              style={{
                width: "64px",
                height: "64px",
                objectFit: "cover",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                flexShrink: 0,
              }}
            />
          )}
          <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
            {datos.contextoCliente?.clienteNombre && (
              <span style={{ fontSize: "0.73rem", fontWeight: 700, color: "#475569" }}>
                Origen: {datos.contextoCliente.clienteNombre}
                {datos.contextoCliente.clienteTelefono
                  ? ` (${datos.contextoCliente.clienteTelefono})`
                  : ""}
              </span>
            )}
            <span
              style={{
                fontSize: "0.8rem",
                color: "#0F172A",
                display: "-webkit-box",
                WebkitLineClamp: 3,
                WebkitBoxOrient: "vertical",
                overflow: "hidden",
              }}
            >
              {datos.textoOriginal || datos.tituloImagen || "📷 Fotografía seleccionada"}
            </span>
          </div>
        </div>

        <form
          onSubmit={handleConfirmarReenvio}
          style={{ display: "flex", flexDirection: "column", gap: "12px" }}
        >
          {destino === "equipo" ? (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569" }}>
                  Mencionar rápido para que respondan (clic para insertar):
                </span>
                <div style={{ display: "flex", gap: "5px", flexWrap: "wrap" }}>
                  {[
                    { handle: "todos", etiqueta: "@todos" },
                    { handle: "taller", etiqueta: "@taller" },
                    { handle: "ventas", etiqueta: "@ventas" },
                    { handle: "delivery", etiqueta: "@delivery" },
                    ...miembros.map((m) => ({
                      handle: m.handle,
                      etiqueta: `@${m.handle} (${m.nombre.split(" ")[0]})`,
                    })),
                  ].map((chip) => (
                    <button
                      key={chip.handle}
                      type="button"
                      onClick={() => insertarMencion(chip.handle)}
                      title={`Mencionar a ${chip.etiqueta}`}
                      aria-label={`Mencionar ${chip.etiqueta}`}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "3px",
                        padding: "3px 9px",
                        borderRadius: "999px",
                        border: "1px solid #DDD6FE",
                        background: "#F5F3FF",
                        color: "#5B21B6",
                        fontSize: "0.73rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      <AtSign size={11} />
                      <span>{chip.etiqueta.replace(/^@/, "")}</span>
                    </button>
                  ))}
                </div>
              </div>

              <textarea
                rows={3}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Escribe tu pregunta al equipo… Ej: @kleber @taller ¿podemos armar este arreglo para hoy?"
                style={{
                  width: "100%",
                  padding: "9px 11px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.83rem",
                  fontFamily: "inherit",
                  resize: "vertical",
                }}
              />
            </>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label
                  style={{ fontSize: "0.76rem", fontWeight: 700, color: "#334155" }}
                >
                  Enviar directo a un chat de WhatsApp activo en Tinkay:
                </label>
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
                    value={busquedaWa}
                    onChange={(e) => setBusquedaWa(e.target.value)}
                    placeholder="Buscar cliente o teléfono WhatsApp…"
                    style={{
                      width: "100%",
                      padding: "7px 10px 7px 30px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.8rem",
                    }}
                  />
                </div>

                <div
                  style={{
                    maxHeight: "145px",
                    overflowY: "auto",
                    border: "1px solid #E2E8F0",
                    borderRadius: "9px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {cargandoMeta ? (
                    <div style={{ padding: "12px", fontSize: "0.78rem", color: "#64748B" }}>
                      Cargando chats de WhatsApp…
                    </div>
                  ) : chatsFiltrados.length === 0 ? (
                    <div style={{ padding: "12px", fontSize: "0.78rem", color: "#64748B" }}>
                      No hay conversaciones abiertas con ese filtro. También puedes usar el botón{" "}
                      <strong>WhatsApp Externo</strong> abajo.
                    </div>
                  ) : (
                    chatsFiltrados.map((ch) => {
                      const sel = chatWaDestinoId === ch.id;
                      return (
                        <button
                          key={ch.id}
                          type="button"
                          onClick={() => setChatWaDestinoId(ch.id)}
                          style={{
                            display: "flex",
                            justifyContent: "space-between",
                            alignItems: "center",
                            padding: "8px 11px",
                            border: "none",
                            borderBottom: "1px solid #F1F5F9",
                            background: sel ? "#ECFDF5" : "#FFFFFF",
                            color: "#0F172A",
                            fontSize: "0.8rem",
                            fontWeight: sel ? 700 : 500,
                            cursor: "pointer",
                            textAlign: "left",
                          }}
                        >
                          <span>
                            📱 {ch.nombre}{" "}
                            {ch.telefono ? (
                              <span style={{ color: "#64748B", fontSize: "0.74rem" }}>
                                ({ch.telefono})
                              </span>
                            ) : null}
                          </span>
                          {sel && <Check size={15} style={{ color: "#15803D" }} />}
                        </button>
                      );
                    })
                  )}
                </div>
              </div>

              <textarea
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                placeholder="Pie de foto o mensaje opcional para el cliente…"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.82rem",
                  fontFamily: "inherit",
                }}
              />
            </>
          )}

          {errorLocal && (
            <div
              style={{
                padding: "8px 10px",
                borderRadius: "8px",
                background: "#FEF2F2",
                border: "1px solid #FECACA",
                color: "#991B1B",
                fontSize: "0.78rem",
              }}
            >
              {errorLocal}
            </div>
          )}

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            {destino === "whatsapp" && datos.imagenUrl ? (
              <button
                type="button"
                onClick={() =>
                  void compartirImagenWhatsappNativo(
                    datos.imagenUrl!,
                    comentario.trim() || datos.tituloImagen
                  )
                }
                title="Compartir o abrir directamente en la aplicación de WhatsApp de tu teléfono o PC"
                aria-label="WhatsApp Externo"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 12px",
                  borderRadius: "9px",
                  border: "1px solid #86EFAC",
                  background: "#F0FDF4",
                  color: "#15803D",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Share2 size={14} />
                <span>WhatsApp Externo</span>
              </button>
            ) : (
              <span />
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={onCerrar}
                title="Cancelar reenvío"
                aria-label="Cancelar"
                style={{
                  padding: "8px 13px",
                  borderRadius: "9px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#334155",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={enviando}
                title={
                  destino === "equipo"
                    ? "Publicar en el Chat Grupal del Equipo"
                    : "Enviar ahora al WhatsApp del cliente"
                }
                aria-label="Enviar ahora"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 15px",
                  borderRadius: "9px",
                  border: "none",
                  background: destino === "equipo" ? "#6D28D9" : "#15803D",
                  color: "#FFFFFF",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: enviando ? "wait" : "pointer",
                }}
              >
                {enviando ? <Loader2 size={15} /> : <Send size={15} />}
                <span>{destino === "equipo" ? "Enviar al Equipo" : "Enviar WhatsApp"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
