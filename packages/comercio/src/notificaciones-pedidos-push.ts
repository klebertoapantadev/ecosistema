import {
  nombreCanalRealtimeOmnicanal,
  resolverUrlDirectaPedidoPorRol,
  type EventoBroadcastEstadoPedido,
} from "./omnicanal";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

export { resolverUrlDirectaPedidoPorRol, type EventoBroadcastEstadoPedido };

const ETIQUETAS_ESTADO_PEDIDO: Record<string, string> = {
  ENVIADA: "Proforma Emitida",
  PENDIENTE_PAGO: "Pendiente de Pago",
  ORDEN_CONFIRMADA: "Orden Confirmada",
  RESERVADA_70: "Reserva 70%",
  APROBADA: "Confirmado",
  PAGADO: "Pagado",
  PAGADA: "Pagado",
  NO_ACEPTADA: "No Aceptada",
  PENDIENTE_ENVIO: "Pendiente de Envío a Taller",
  ENVIADO_TALLER: "Enviado a Taller",
  EN_PREPARACION: "En Taller / Preparación",
  LISTO_ENTREGA: "Listo para Entrega",
  EN_RUTA: "En Ruta",
  DESPACHADO: "Despachado",
  ENTREGADO: "Entregado",
  ENTREGADA_PENDIENTE_INFORME: "Entregado",
  CANCELADO: "Cancelado",
};

export function obtenerEtiquetaLegibleEstadoPedido(estadoRaw: string): string {
  const clave = String(estadoRaw || "").trim().toUpperCase();
  return ETIQUETAS_ESTADO_PEDIDO[clave] || clave || "Actualizado";
}

/**
 * Emite notificaciones Push nativas (Web Push RFC 8291/8292), alertas en Campana (IN_APP)
 * y Broadcast en tiempo real (<50ms) a TODOS los roles del negocio con enlace directo
 * al pedido modificado y soporte de marcado como leída al hacer clic.
 */
export async function despacharPushCambioEstadoPedidoTodosLosRoles(params: {
  supabase: any;
  negocio: string;
  pedidoId?: string | null;
  codigoOrden?: string | null;
  nuevoEstado: string;
  etiquetaEstado?: string;
  compradorNombre?: string | null;
  clienteUsuarioId?: string | null;
  repartidorAsignadoId?: string | null;
  tituloPersonalizado?: string;
  cuerpoPlanoPersonalizado?: string;
  contenidoHtmlPersonalizado?: string;
}): Promise<void> {
  try {
    const neg = normalizarIdentificadorNegocio(params.negocio).principal;
    const etiqueta =
      params.etiquetaEstado?.trim() || obtenerEtiquetaLegibleEstadoPedido(params.nuevoEstado);
    let codigo = String(params.codigoOrden || "").trim() || "PEDIDO";
    const comprador = String(params.compradorNombre || "").trim();

    const titulo =
      params.tituloPersonalizado?.trim() || `📦 Pedido ${codigo} · ${etiqueta}`;
    const cuerpoPlano =
      params.cuerpoPlanoPersonalizado?.trim() ||
      `El pedido ${codigo}${comprador ? ` (${comprador})` : ""} pasó a estado: ${etiqueta}. Toca para ir al pedido.`;
    const contenidoHtml =
      params.contenidoHtmlPersonalizado?.trim() ||
      `<div>El pedido <strong>${codigo}</strong>${
        comprador ? ` (${comprador})` : ""
      } se actualizó al estado <strong>${etiqueta}</strong>.</div>`;

    const esquemaComercio = params.supabase.schema("comun_comercio") as any;
    const tagPush = `pedido-${codigo}-${Date.now()}`;

    let vapidPub = (
      process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
      process.env.VAPID_PUBLIC_KEY ||
      ""
    ).trim();
    let vapidPriv = (process.env.VAPID_PRIVATE_KEY || "").trim();

    let suscripciones: Array<{
      usuarioId: string;
      rol: string;
      notId?: string;
      url?: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = [];
    let notificacionesPorUsuario: Record<string, { notId: string; rol: string; url: string }> = {};
    let emitioViaNuevoRpc = false;

    // 1. Vía primaria: RPC transaccional SECURITY DEFINER (cubre TODOS los roles + cliente titular + not_id exacto)
    try {
      const { data: rpcRes, error: rpcErr } = await esquemaComercio.rpc(
        "com_fn_push_emitir_cambio_estado_pedido",
        {
          p_negocio: neg,
          p_pedido_id:
            params.pedidoId && /^[0-9a-f-]{36}$/i.test(params.pedidoId)
              ? params.pedidoId
              : null,
          p_codigo_orden: codigo !== "PEDIDO" ? codigo : null,
          p_nuevo_estado: params.nuevoEstado,
          p_etiqueta_estado: etiqueta,
          p_titulo: titulo,
          p_cuerpo_plano: cuerpoPlano,
          p_contenido_html: contenidoHtml,
        }
      );

      if (!rpcErr && rpcRes?.ok) {
        emitioViaNuevoRpc = true;
        if (rpcRes.codigoOrden) {
          codigo = String(rpcRes.codigoOrden);
        }
        if (!vapidPub && rpcRes.vapidPublicKey) vapidPub = String(rpcRes.vapidPublicKey).trim();
        if (!vapidPriv && rpcRes.vapidPrivateKey) vapidPriv = String(rpcRes.vapidPrivateKey).trim();
        if (Array.isArray(rpcRes.suscripciones)) {
          suscripciones = rpcRes.suscripciones;
        }
        if (rpcRes.notificacionesPorUsuario && typeof rpcRes.notificacionesPorUsuario === "object") {
          notificacionesPorUsuario = rpcRes.notificacionesPorUsuario;
        }
      }
    } catch {
      // Continuar con respaldo sobre RPC existente 20261117000006
    }

    // 2. Respaldo compatible si la migración 20261118000002 aún no se corrió en Supabase
    if (!emitioViaNuevoRpc) {
      try {
        const { data: ctx } = await esquemaComercio.rpc("com_fn_push_obtener_contexto_envio_staff", {
          p_negocio: neg,
          p_token_webhook: null,
          p_excluir_usuario_id: null,
          p_solo_ventas: false,
        });

        if (ctx?.ok) {
          if (!vapidPub && ctx.vapidPublicKey) vapidPub = String(ctx.vapidPublicKey).trim();
          if (!vapidPriv && ctx.vapidPrivateKey) vapidPriv = String(ctx.vapidPrivateKey).trim();

          const miembros: Array<{ usuarioId: string; rol: string }> = Array.isArray(ctx.miembros)
            ? [...ctx.miembros]
            : [];
          if (
            params.clienteUsuarioId &&
            !miembros.some((m) => m.usuarioId === params.clienteUsuarioId)
          ) {
            miembros.push({ usuarioId: params.clienteUsuarioId, rol: "CLIENTE" });
          }

          const { persistirNotificacionesInternasResiliente } = await import(
            "@eco/notificaciones/notificar-usuario"
          );

          const ts = Date.now();
          const itemsFallback = miembros.map((m) => {
            const claveRef = `ped-est-${codigo}-${ts}-${m.usuarioId.slice(0, 8)}`;
            const urlRol = resolverUrlDirectaPedidoPorRol(m.rol, codigo, claveRef);
            notificacionesPorUsuario[m.usuarioId] = {
              notId: claveRef,
              rol: m.rol,
              url: urlRol,
            };
            return {
              usuarioId: m.usuarioId,
              negocioCode: neg.toUpperCase(),
              canal: "IN_APP" as const,
              titulo,
              contenidoHtml,
              urlAccion: urlRol,
              claveReferencia: claveRef,
            };
          });

          await persistirNotificacionesInternasResiliente(neg, itemsFallback);

          if (Array.isArray(ctx.suscripciones)) {
            suscripciones = ctx.suscripciones.map((s: any) => {
              const info = notificacionesPorUsuario[String(s.usuarioId)];
              return {
                usuarioId: String(s.usuarioId),
                rol: String(s.rol || "OPERADOR"),
                notId: info?.notId,
                url: info?.url || resolverUrlDirectaPedidoPorRol(String(s.rol || "OPERADOR"), codigo),
                endpoint: String(s.endpoint),
                p256dh: String(s.p256dh),
                auth: String(s.auth),
              };
            });
          }
        }
      } catch {
        // Ignorar fallo secundario en fallback
      }
    }

    // 3. Despachar Web Push nativo a cada dispositivo suscrito con enlace directo y notId
    if (vapidPub && vapidPriv && suscripciones.length > 0) {
      const { enviarNotificacionWebPushNativa } = await import(
        "@eco/notificaciones/web-push-nativo"
      );
      await Promise.allSettled(
        suscripciones.map(async (sub) => {
          const urlDestino =
            sub.url || resolverUrlDirectaPedidoPorRol(sub.rol, codigo, sub.notId || null);
          const resPush = await enviarNotificacionWebPushNativa(
            {
              endpoint: sub.endpoint,
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
            {
              title: titulo,
              body: cuerpoPlano.slice(0, 170),
              url: urlDestino,
              notId: sub.notId,
              negocio: neg,
              tag: tagPush,
              icon: "/icons/icon-192.png",
              badge: "/icons/icon-192.png",
              renotify: true,
            },
            {
              publicKey: vapidPub,
              privateKey: vapidPriv,
            }
          );

          if (resPush.suscripcionExpirada) {
            await esquemaComercio
              .rpc("com_fn_push_desactivar_suscripcion", {
                p_negocio: neg,
                p_endpoint: sub.endpoint,
              })
              .catch(() => {});
          }
        })
      );
    }

    // 4. Emitir Broadcast Realtime inmediato (<50ms) para pestañas abiertas en todos los roles
    try {
      const eventoPayload: EventoBroadcastEstadoPedido = {
        eventoId: `evt-ped-${codigo}-${Date.now()}`,
        negocio: neg,
        pedidoId: params.pedidoId ?? null,
        codigoOrden: codigo,
        nuevoEstado: params.nuevoEstado,
        etiquetaEstado: etiqueta,
        titulo,
        cuerpo: cuerpoPlano,
        clienteUsuarioId: params.clienteUsuarioId ?? null,
        repartidorAsignadoId: params.repartidorAsignadoId ?? null,
        notificacionesPorUsuario,
        emitidoEn: new Date().toISOString(),
      };

      const canal = params.supabase.channel(nombreCanalRealtimeOmnicanal(neg));
      await Promise.race([
        canal.send({
          type: "broadcast",
          event: "estado_pedido_actualizado",
          payload: eventoPayload,
        }),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
      void params.supabase.removeChannel?.(canal);
    } catch {
      // No interrumpir flujo principal si broadcast expira
    }
  } catch {
    // Nunca interrumpir la transición de estado del pedido si falla el despacho de alertas
  }
}
