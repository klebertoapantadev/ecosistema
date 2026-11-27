"use client";

import React, { useCallback, useEffect, useRef, useState } from "react";
import { Bell, MessageSquare, Package, Users, X } from "lucide-react";
import { crearClienteNavegador } from "@eco/supabase/cliente";
import {
  limpiarVistaPreviaMensajeOmnicanal,
  nombreCanalRealtimeChatEquipo,
  nombreCanalRealtimeOmnicanal,
  resolverUrlDirectaPedidoPorRol,
  type EventoBroadcastChatEquipo,
  type EventoBroadcastChatWeb,
  type EventoBroadcastEstadoPedido,
} from "../omnicanal";

export interface PropsGestorPushChatsOmnicanal {
  negocio: string;
  usuarioId: string;
  rolPrincipal: string;
  puedeVerConversacionesClientes?: boolean;
  modoClientePedidos?: boolean;
}

interface ToastChatEnVivo {
  id: string;
  esEquipo: boolean;
  esPedido?: boolean;
  notId?: string | null;
  titulo: string;
  extracto: string;
  urlDestino: string;
}

function base64UrlAUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i += 1) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

function reproducirTonoSuaveMensaje(): void {
  try {
    const AudioCtx =
      window.AudioContext || (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const ahora = ctx.currentTime;

    const tocarNota = (frecuencia: number, inicio: number, duracion: number) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(frecuencia, inicio);
      gain.gain.setValueAtTime(0.0001, inicio);
      gain.gain.exponentialRampToValueAtTime(0.07, inicio + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.0001, inicio + duracion);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(inicio);
      osc.stop(inicio + duracion + 0.02);
    };

    tocarNota(587.33, ahora, 0.11);
    tocarNota(880, ahora + 0.09, 0.15);
    setTimeout(() => {
      void ctx.close().catch(() => {});
    }, 500);
  } catch {
    // Silencioso si el navegador aún no tuvo gesto del usuario
  }
}

export function GestorPushChatsOmnicanal({
  negocio,
  usuarioId,
  rolPrincipal,
  puedeVerConversacionesClientes = true,
  modoClientePedidos = false,
}: PropsGestorPushChatsOmnicanal) {
  const negNorm = negocio.trim().toLowerCase();
  const [permisoPush, setPermisoPush] = useState<NotificationPermission | "unsupported">("default");
  const [ocultarBannerPermiso, setOcultarBannerPermiso] = useState<boolean>(false);
  const [activandoPush, setActivandoPush] = useState<boolean>(false);
  const [toastActivo, setToastActivo] = useState<ToastChatEnVivo | null>(null);

  const swRegRef = useRef<ServiceWorkerRegistration | null>(null);
  const vistosRef = useRef<Set<string>>(new Set());
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const marcarNotificacionLeidaClick = useCallback(
    (notId?: string | null, urlDestino?: string) => {
      if (typeof window === "undefined") return;
      let idCandidato = notId?.trim() || "";
      if (!idCandidato && urlDestino) {
        try {
          const u = new URL(urlDestino, window.location.origin);
          idCandidato = u.searchParams.get("not_id")?.trim() || "";
        } catch {
          // Ignorar URL inválida
        }
      }
      if (!idCandidato) return;

      window.dispatchEvent(
        new CustomEvent("eco:marcar-notificacion-leida", { detail: { notId: idCandidato } })
      );
      fetch(`/api/notificaciones/usuario?negocio=${encodeURIComponent(negNorm)}`, {
        method: "POST",
        keepalive: true,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          negocio: negNorm,
          not_id: idCandidato,
          accion: "aceptar",
        }),
      }).catch(() => {});
    },
    [negNorm]
  );

  const navegarADestinoChat = useCallback(
    (urlDestino: string, notId?: string | null) => {
      setToastActivo(null);
      if (typeof window === "undefined") return;
      marcarNotificacionLeidaClick(notId, urlDestino);
      window.dispatchEvent(
        new CustomEvent("eco:abrir-ruta-push", { detail: { url: urlDestino } })
      );
      const actual = `${window.location.pathname}${window.location.search}`;
      if (actual !== urlDestino) {
        window.location.assign(urlDestino);
      }
    },
    [marcarNotificacionLeidaClick]
  );

  const sincronizarSuscripcionPushServidor = useCallback(
    async (reg: ServiceWorkerRegistration) => {
      try {
        if (!("pushManager" in reg)) return;
        const respKey = await fetch(
          `/api/notificaciones/push?negocio=${encodeURIComponent(negNorm)}`,
          { cache: "no-store" }
        );
        const dataKey = (await respKey.json().catch(() => null)) as {
          ok?: boolean;
          publicKey?: string | null;
        } | null;
        const publicKey = dataKey?.publicKey?.trim();
        if (!publicKey) return;

        let sub = await reg.pushManager.getSubscription();
        if (!sub) {
          const appServerKey = base64UrlAUint8Array(publicKey);
          sub = await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: appServerKey.buffer as ArrayBuffer,
          });
        }

        const jsonSub = sub.toJSON();
        if (jsonSub?.endpoint && jsonSub.keys?.p256dh && jsonSub.keys?.auth) {
          await fetch("/api/notificaciones/push", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              negocio: negNorm,
              endpoint: jsonSub.endpoint,
              keys: {
                p256dh: jsonSub.keys.p256dh,
                auth: jsonSub.keys.auth,
              },
            }),
          });
        }
      } catch {
        // Ignorar en navegadores sin soporte PushManager
      }
    },
    [negNorm]
  );

  // 1. Registrar Service Worker PWA y escuchar clics en notificaciones del sistema
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) {
      setPermisoPush("unsupported");
    } else {
      setPermisoPush(Notification.permission);
      try {
        if (window.sessionStorage.getItem(`eco_push_banner_cerrado_${negNorm}`) === "1") {
          setOcultarBannerPermiso(true);
        }
      } catch {}
    }

    if (!("serviceWorker" in navigator)) return;

    const alMensajeSw = (event: MessageEvent) => {
      const data = event.data as { tipo?: string; url?: string; notId?: string | null } | null;
      if (data?.tipo === "ECO_ABRIR_RUTA_PUSH" && data.url) {
        navegarADestinoChat(data.url, data.notId ?? null);
      }
    };

    navigator.serviceWorker.addEventListener("message", alMensajeSw);

    navigator.serviceWorker
      .register("/sw-operaciones.js", { scope: "/" })
      .then((reg) => {
        swRegRef.current = reg;
        if ("Notification" in window && Notification.permission === "granted") {
          void sincronizarSuscripcionPushServidor(reg);
        }
      })
      .catch(() => {});

    return () => {
      navigator.serviceWorker.removeEventListener("message", alMensajeSw);
    };
  }, [negNorm, navegarADestinoChat, sincronizarSuscripcionPushServidor]);

  const handleSolicitarPermisoPush = async () => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    setActivandoPush(true);
    try {
      const resultado = await Notification.requestPermission();
      setPermisoPush(resultado);
      if (resultado === "granted") {
        const reg =
          swRegRef.current ||
          ("serviceWorker" in navigator ? await navigator.serviceWorker.ready : null);
        if (reg) {
          swRegRef.current = reg;
          await sincronizarSuscripcionPushServidor(reg);
        }
      } else {
        setOcultarBannerPermiso(true);
      }
    } finally {
      setActivandoPush(false);
    }
  };

  const dispararNotificacionEstiloWhatsapp = useCallback(
    (entrada: {
      huella: string;
      tag: string;
      esEquipo: boolean;
      esPedido?: boolean;
      notId?: string | null;
      titulo: string;
      cuerpo: string;
      urlDestino: string;
    }) => {
      if (typeof window === "undefined") return;
      if (vistosRef.current.has(entrada.huella)) return;
      vistosRef.current.add(entrada.huella);
      if (vistosRef.current.size > 120) {
        const primero = vistosRef.current.values().next().value;
        if (primero) vistosRef.current.delete(primero);
      }

      reproducirTonoSuaveMensaje();
      window.dispatchEvent(new Event("eco:refrescar-notificaciones"));

      const pestanaOculta = document.visibilityState !== "visible" || !document.hasFocus();
      const rutaActual = window.location.pathname;
      const yaEnConversaciones = rutaActual.startsWith("/panel/conversaciones");
      const yaEnChatEquipoRuta = rutaActual.startsWith("/panel/chat-equipo");

      // Notificación nativa del sistema operativo (Android / iOS PWA / Windows / macOS)
      if ("Notification" in window && Notification.permission === "granted") {
        if (entrada.esPedido || pestanaOculta || (!yaEnConversaciones && !yaEnChatEquipoRuta)) {
          const mostrarViaSw = async () => {
            try {
              const reg =
                swRegRef.current ||
                ("serviceWorker" in navigator ? await navigator.serviceWorker.ready : null);
              if (reg && "showNotification" in reg) {
                await reg.showNotification(entrada.titulo, {
                  body: entrada.cuerpo,
                  icon: "/icons/icon-192.png",
                  badge: "/icons/icon-192.png",
                  tag: entrada.tag,
                  data: {
                    url: entrada.urlDestino,
                    notId: entrada.notId ?? null,
                    negocio: negNorm,
                  },
                });
                return;
              }
            } catch {}

            try {
              const notif = new Notification(entrada.titulo, {
                body: entrada.cuerpo,
                icon: "/icons/icon-192.png",
                tag: entrada.tag,
              });
              notif.onclick = () => {
                window.focus();
                navegarADestinoChat(entrada.urlDestino, entrada.notId ?? null);
                notif.close();
              };
            } catch {}
          };
          void mostrarViaSw();
        }
      }

      // Banner emergente limpio dentro del panel con acceso directo al pedido o chat
      const mostrarToastInterno =
        Boolean(entrada.esPedido) ||
        (!entrada.esEquipo && !yaEnConversaciones) ||
        (entrada.esEquipo && !yaEnChatEquipoRuta);

      if (mostrarToastInterno) {
        if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
        setToastActivo({
          id: entrada.huella,
          esEquipo: entrada.esEquipo,
          esPedido: Boolean(entrada.esPedido),
          notId: entrada.notId ?? null,
          titulo: entrada.titulo,
          extracto: entrada.cuerpo,
          urlDestino: entrada.urlDestino,
        });
        toastTimerRef.current = setTimeout(() => {
          setToastActivo(null);
        }, 8500);
      }
    },
    [navegarADestinoChat, negNorm]
  );

  // 2. Suscripción en vivo (<50ms) a cambios de estado de pedidos (todos los roles), mensajes de clientes y Chat Grupal
  useEffect(() => {
    const supabase = crearClienteNavegador();
    const canalesActivos: any[] = [];

    const canalOmnicanalGlobal = supabase
      .channel(`${nombreCanalRealtimeOmnicanal(negNorm)}:push-global-${usuarioId.slice(0, 8)}`, {
        config: { broadcast: { self: true } },
      })
      .on(
        "broadcast",
        { event: "estado_pedido_actualizado" },
        ({ payload }: { payload: EventoBroadcastEstadoPedido }) => {
          if (!payload || !payload.codigoOrden) return;
          const rolUpper = rolPrincipal.toUpperCase();

          // En modo cliente, notificar únicamente si el pedido pertenece al cliente autenticado
          if (modoClientePedidos || rolUpper === "CLIENTE") {
            if (!payload.clienteUsuarioId || payload.clienteUsuarioId !== usuarioId) {
              return;
            }
          }

          // Para Delivery Subcontratado, respetar aislamiento de pedidos asignados
          if (
            rolUpper === "DELIVERY_EXTERNO" &&
            payload.repartidorAsignadoId &&
            payload.repartidorAsignadoId !== usuarioId
          ) {
            return;
          }

          const infoDest = payload.notificacionesPorUsuario?.[usuarioId];
          const notId = infoDest?.notId || null;
          const urlDestino =
            infoDest?.url ||
            resolverUrlDirectaPedidoPorRol(rolUpper, payload.codigoOrden, notId);

          dispararNotificacionEstiloWhatsapp({
            huella: `ped:${payload.eventoId || `${payload.codigoOrden}-${payload.nuevoEstado}-${payload.emitidoEn}`}`,
            tag: `pedido-${payload.codigoOrden}`,
            esEquipo: false,
            esPedido: true,
            notId,
            titulo: payload.titulo || `📦 Pedido ${payload.codigoOrden} · ${payload.etiquetaEstado}`,
            cuerpo: payload.cuerpo || `Estado actualizado a ${payload.etiquetaEstado}.`,
            urlDestino,
          });
        }
      );

    if (puedeVerConversacionesClientes && !modoClientePedidos) {
      canalOmnicanalGlobal.on(
        "broadcast",
        { event: "actividad_chat_web" },
        ({ payload }: { payload: EventoBroadcastChatWeb }) => {
          if (!payload || payload.fase !== "ENTRADA_CLIENTE") return;
          const remitente =
            payload.remitenteNombre || payload.autorNombre || "Nuevo mensaje de cliente";
          const canalTxt =
            payload.canal === "whatsapp" || payload.claveHilo?.startsWith("wa:")
              ? "WhatsApp"
              : "Chat Web";
          const limpio = limpiarVistaPreviaMensajeOmnicanal(payload.contenido).slice(0, 140);
          const params = new URLSearchParams();
          if (payload.conversacionId) params.set("chat", payload.conversacionId);
          if (payload.remitenteTelefono) params.set("tel", payload.remitenteTelefono);
          if (payload.eventoId) params.set("msg", payload.eventoId);
          const qs = params.toString();
          const urlDestino = `/panel/conversaciones${qs ? `?${qs}` : ""}`;

          dispararNotificacionEstiloWhatsapp({
            huella: `cli:${payload.eventoId || `${payload.claveHilo}-${payload.creadoEn}`}`,
            tag: `wa-conv-${payload.conversacionId || payload.claveHilo}`,
            esEquipo: false,
            titulo: `${remitente} · ${canalTxt}`,
            cuerpo: limpio,
            urlDestino,
          });
        }
      );
    }

    canalOmnicanalGlobal.subscribe();
    canalesActivos.push(canalOmnicanalGlobal);

    if (!modoClientePedidos) {
      const canalEquipo = supabase
        .channel(`${nombreCanalRealtimeChatEquipo(negNorm)}:push-global`, {
          config: { broadcast: { self: false } },
        })
        .on(
          "broadcast",
          { event: "mensaje_equipo" },
          ({ payload }: { payload: EventoBroadcastChatEquipo }) => {
            const msg = payload?.mensaje;
            if (!msg) return;
            if (msg.autorUsuarioId && msg.autorUsuarioId === usuarioId) return;

            const limpio = limpiarVistaPreviaMensajeOmnicanal(msg.contenido).slice(0, 140);
            const rolUpper = rolPrincipal.toUpperCase();
            const urlDestino = ["TALLER", "DELIVERY", "DELIVERY_EXTERNO"].includes(rolUpper)
              ? `/panel/chat-equipo?msg=${encodeURIComponent(msg.id)}`
              : `/panel/conversaciones?pestana=chat_equipo&msg=${encodeURIComponent(msg.id)}`;

            dispararNotificacionEstiloWhatsapp({
              huella: `eq:${msg.id}`,
              tag: `eq-sala-${payload.sala || "general"}`,
              esEquipo: true,
              titulo: `Equipo Tinkay · ${msg.autorNombre}`,
              cuerpo: limpio,
              urlDestino,
            });
          }
        )
        .subscribe();

      canalesActivos.push(canalEquipo);
    }

    return () => {
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
      for (const ch of canalesActivos) {
        void supabase.removeChannel(ch);
      }
    };
  }, [
    negNorm,
    usuarioId,
    rolPrincipal,
    puedeVerConversacionesClientes,
    modoClientePedidos,
    dispararNotificacionEstiloWhatsapp,
  ]);

  return (
    <>
      {/* Aviso discreto de 1 clic para activar notificaciones Push estilo WhatsApp cuando aún no se concedió permiso */}
      {permisoPush === "default" && !ocultarBannerPermiso && (
        <div
          style={{
            margin: "0 0 10px 0",
            padding: "8px 12px",
            borderRadius: "10px",
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px solid var(--cb-e4e4e7, #E4E4E7)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "10px",
            flexWrap: "wrap",
            boxShadow: "0 1px 3px rgba(24, 24, 27, 0.04)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.79rem", color: "var(--ct-27272a, #27272A)" }}>
            <Bell size={15} color="#52525B" />
            <span>
              {modoClientePedidos
                ? "Activa las notificaciones Push para recibir actualizaciones del estado de tus pedidos en vivo."
                : "Activa las notificaciones Push para recibir estados de pedidos, mensajes de clientes y Chat Grupal con acceso directo."}
            </span>
          </div>
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <button
              type="button"
              disabled={activandoPush}
              onClick={() => void handleSolicitarPermisoPush()}
              title="Activar notificaciones Push en este dispositivo"
              aria-label="Activar notificaciones"
              style={{
                padding: "5px 12px",
                borderRadius: "8px",
                border: "none",
                background: "#18181B",
                color: "#FFFFFF",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: activandoPush ? "wait" : "pointer",
              }}
            >
              {activandoPush ? "Activando…" : "Activar"}
            </button>
            <button
              type="button"
              onClick={() => {
                setOcultarBannerPermiso(true);
                try {
                  window.sessionStorage.setItem(`eco_push_banner_cerrado_${negNorm}`, "1");
                } catch {}
              }}
              title="Ocultar aviso por ahora"
              aria-label="Cerrar aviso"
              style={{
                width: "28px",
                height: "28px",
                borderRadius: "7px",
                border: "none",
                background: "transparent",
                color: "var(--ct-71717a, #71717A)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
              }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}

      {/* Notificación flotante sobria estilo WhatsApp con acceso directo al pedido o chat correspondiente */}
      {toastActivo && (
        <div
          role="status"
          onClick={() => navegarADestinoChat(toastActivo.urlDestino, toastActivo.notId ?? null)}
          style={{
            position: "fixed",
            top: "14px",
            right: "14px",
            zIndex: 100020,
            width: "calc(100vw - 28px)",
            maxWidth: "360px",
            background: "#18181B",
            color: "#FAFAFA",
            borderRadius: "14px",
            border: "1px solid var(--cb-27272a, #27272A)",
            boxShadow: "0 16px 36px rgba(0, 0, 0, 0.28)",
            padding: "12px 14px",
            display: "flex",
            alignItems: "flex-start",
            gap: "11px",
            cursor: "pointer",
          }}
        >
          <div
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              background: "#27272A",
              color: "#E4E4E7",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            {toastActivo.esPedido ? (
              <Package size={17} />
            ) : toastActivo.esEquipo ? (
              <Users size={17} />
            ) : (
              <MessageSquare size={17} />
            )}
          </div>

          <div style={{ flex: 1, minWidth: 0 }}>
            <div
              style={{
                fontSize: "0.81rem",
                fontWeight: 700,
                color: "#FFFFFF",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
              }}
            >
              {toastActivo.titulo}
            </div>
            <div
              style={{
                fontSize: "0.76rem",
                color: "var(--ct-a1a1aa, #A1A1AA)",
                marginTop: "2px",
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {toastActivo.extracto}
            </div>
            <span
              style={{
                display: "inline-block",
                marginTop: "6px",
                fontSize: "0.72rem",
                fontWeight: 700,
                color: "#E4E4E7",
                textDecoration: "underline",
              }}
            >
              {toastActivo.esPedido ? "Abrir pedido →" : "Abrir chat →"}
            </span>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setToastActivo(null);
            }}
            title="Cerrar notificación"
            aria-label="Cerrar notificación"
            style={{
              width: "26px",
              height: "26px",
              borderRadius: "7px",
              border: "none",
              background: "transparent",
              color: "var(--ct-a1a1aa, #A1A1AA)",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}
