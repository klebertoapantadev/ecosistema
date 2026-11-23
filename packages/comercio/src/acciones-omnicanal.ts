"use server";

import {
  ETIQUETAS_OMNICANAL_POR_DEFECTO,
  RESPUESTAS_RAPIDAS_POR_DEFECTO,
  esPedidoUsuarioRegistrado,
  extraerCodigoRefWebDeTexto,
  generarCodigoRefVisitanteWeb,
  generarCodigoRefWhatsapp,
  nombreCanalRealtimeChatEquipo,
  nombreCanalRealtimeOmnicanal,
  normalizarTelefonoOmnicanal,
  obtenerDefinicionMotivoCierre,
  type CitaRespuestaChatEquipo,
  type ContactoUnificadoOmnicanal,
  type ContextoReenvioChatEquipo,
  type ConversacionOmnicanal,
  type ConversacionWhatsappResumen,
  type DatosCierreConversacion,
  type DatosVentaConversacion,
  type EstadoAtencionOmnicanal,
  type EtiquetaOmnicanal,
  type EventoBroadcastChatEquipo,
  type EventoBroadcastChatWeb,
  type FichaClienteOmnicanal,
  type MensajeChatEquipo,
  type MensajeOmnicanal,
  type MiembroChatEquipo,
  type MiembroEquipoOmnicanal,
  type PuenteOmnicanalCliente,
  type RegistroVisitaWebOmnicanal,
  type RespuestaRapidaOmnicanal,
} from "./omnicanal";
import { obtenerPedidosTiendaAction, type PedidoTiendaRegistrado } from "./acciones-logistica";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

function normalizarNegocioComercio(negocio?: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}

async function emitirBroadcastServidorOmnicanal(
  supabase: any,
  negocio: string,
  evento: string,
  payload: Record<string, unknown>
): Promise<void> {
  try {
    const canal = supabase.channel(nombreCanalRealtimeOmnicanal(negocio));
    await Promise.race([
      canal.send({
        type: "broadcast",
        event: evento,
        payload,
      }),
      new Promise((resolve) => setTimeout(resolve, 1500)),
    ]);
    void supabase.removeChannel?.(canal);
  } catch {
    // El cliente también emite por WebSocket directo; no interrumpir flujo principal
  }
}

/**
 * Despacha notificaciones Push estilo WhatsApp (OS Web Push RFC 8291/8292 + Campana In-App)
 * con enlace directo hacia el chat exacto en la app de Tinkay.
 */
async function despacharPushYCampanaStaffOmnicanal(params: {
  supabase: any;
  negocio: string;
  tokenWebhook?: string | null;
  excluirUsuarioId?: string | null;
  soloVentas: boolean;
  titulo: string;
  cuerpoPlano: string;
  contenidoHtml: string;
  tag: string;
  claveRefBase: string;
  resolverUrlPorRol: (rol: string) => string;
}): Promise<void> {
  try {
    const esquemaComercio = params.supabase.schema("comun_comercio") as any;
    const { data: ctx } = await esquemaComercio.rpc("com_fn_push_obtener_contexto_envio_staff", {
      p_negocio: params.negocio,
      p_token_webhook: params.tokenWebhook ?? null,
      p_excluir_usuario_id:
        params.excluirUsuarioId && /^[0-9a-f-]{36}$/i.test(params.excluirUsuarioId)
          ? params.excluirUsuarioId
          : null,
      p_solo_ventas: params.soloVentas,
    });

    const miembros: Array<{ usuarioId: string; rol: string }> =
      ctx?.ok && Array.isArray(ctx.miembros) ? ctx.miembros : [];
    const suscripciones: Array<{
      usuarioId: string;
      rol: string;
      endpoint: string;
      p256dh: string;
      auth: string;
    }> = ctx?.ok && Array.isArray(ctx.suscripciones) ? ctx.suscripciones : [];

    // 1. Enviar Web Push nativo a teléfonos/navegadores suscritos (incluso con app cerrada)
    const vapidPub =
      (
        process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ||
        process.env.VAPID_PUBLIC_KEY ||
        ctx?.vapidPublicKey ||
        ""
      ).trim();
    const vapidPriv = (process.env.VAPID_PRIVATE_KEY || ctx?.vapidPrivateKey || "").trim();

    if (vapidPub && vapidPriv && suscripciones.length > 0) {
      const { enviarNotificacionWebPushNativa } = await import(
        "@eco/notificaciones/web-push-nativo"
      );
      await Promise.allSettled(
        suscripciones.map(async (sub) => {
          const refUsuario = `${params.claveRefBase}-${String(sub.usuarioId || "").slice(0, 8)}`;
          const notIdPush = `inapp-${refUsuario}`;
          const urlBase = params.resolverUrlPorRol(String(sub.rol || "OPERADOR"));
          const sep = urlBase.includes("?") ? "&" : "?";
          const urlDestino = `${urlBase}${sep}not_id=${encodeURIComponent(notIdPush)}`;
          const resPush = await enviarNotificacionWebPushNativa(
            {
              endpoint: sub.endpoint,
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
            {
              title: params.titulo,
              body: params.cuerpoPlano.slice(0, 160),
              url: urlDestino,
              notId: notIdPush,
              negocio: params.negocio,
              tag: params.tag,
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
                p_negocio: params.negocio,
                p_endpoint: sub.endpoint,
              })
              .catch(() => {});
          }
        })
      );
    }

    // 2. Registrar en CampanaNotificaciones (IN_APP + PUSH) con urlAccion directa al chat
    if (miembros.length > 0) {
      const { persistirNotificacionesInternasResiliente } = await import(
        "@eco/notificaciones/notificar-usuario"
      );
      const itemsNotif = miembros.flatMap((m) => {
        const urlDestino = params.resolverUrlPorRol(String(m.rol || "OPERADOR"));
        const ref = `${params.claveRefBase}-${m.usuarioId.slice(0, 8)}`;
        return [
          {
            usuarioId: m.usuarioId,
            negocioCode: params.negocio.toUpperCase(),
            canal: "IN_APP" as const,
            titulo: params.titulo,
            contenidoHtml: params.contenidoHtml,
            urlAccion: urlDestino,
            claveReferencia: `inapp-${ref}`,
          },
          {
            usuarioId: m.usuarioId,
            negocioCode: params.negocio.toUpperCase(),
            canal: "PUSH" as const,
            titulo: params.titulo,
            contenidoHtml: params.cuerpoPlano,
            urlAccion: urlDestino,
            claveReferencia: `push-${ref}`,
          },
        ];
      });
      await persistirNotificacionesInternasResiliente(params.negocio, itemsNotif);
    }
  } catch {
    // Nunca interrumpir el flujo conversacional si falla el despacho secundario de notificación
  }
}

export interface PedidoWebConTipoCliente extends PedidoTiendaRegistrado {
  esUsuarioRegistrado: boolean;
}

export interface DatosTableroOmnicanal {
  usuarioActualId: string | null;
  usuarioActualNombre: string;
  esAdminEtiquetas?: boolean;
  esAdminAplicacion?: boolean;
  conversaciones: ConversacionOmnicanal[];
  etiquetas: EtiquetaOmnicanal[];
  respuestasRapidas: RespuestaRapidaOmnicanal[];
  equipo: MiembroEquipoOmnicanal[];
  usuariosYClientes: ContactoUnificadoOmnicanal[];
  pedidosWeb: PedidoWebConTipoCliente[];
  usandoRespaldoHibrido?: boolean;
  avisoMigracionSql?: string | null;
}

interface AlmacenRespaldoOmnicanal {
  conversaciones: ConversacionOmnicanal[];
  mensajesPorConversacion: Record<string, MensajeOmnicanal[]>;
  etiquetas: EtiquetaOmnicanal[];
  respuestasRapidas: RespuestaRapidaOmnicanal[];
}

function esFuncionRpcPendienteMigracion(mensajeError?: string | null): boolean {
  const m = String(mensajeError ?? "").toLowerCase();
  return (
    m.includes("com_fn_omnicanal_") ||
    m.includes("could not find the function") ||
    m.includes("pgrst202") ||
    m.includes("pgrst106") ||
    m.includes("invalid schema") ||
    m.includes("schema must be one of") ||
    m.includes("does not exist") ||
    m.includes("invalid input syntax")
  );
}

function variantesCodigoNegocio(negocioCanonico: string): string[] {
  switch (negocioCanonico) {
    case "tinkay":
      return ["tinkay", "tnk", "TINKAY", "TNK"];
    case "tranqi":
      return ["tranqi", "tranq", "legal", "TRANQI", "TRANQ", "LEGAL"];
    case "fastfix":
      return ["fastfix", "ffh", "FASTFIX", "FFH"];
    case "margaritas":
      return ["margaritas", "mrg", "MARGARITAS", "MRG"];
    default:
      return [negocioCanonico, negocioCanonico.toUpperCase()];
  }
}

async function leerAlmacenRespaldoCfg(negocio: string): Promise<AlmacenRespaldoOmnicanal> {
  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const cliente: any = crearClienteAdmin() ?? (await crearClienteServidor());

    const { data } = await cliente
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();

    const detalle = (data?.cfg_detalle_configuracion ?? {}) as Record<string, any>;
    const guardado = (detalle.omnicanal_inbox ?? {}) as Partial<AlmacenRespaldoOmnicanal>;

    return {
      conversaciones: Array.isArray(guardado.conversaciones)
        ? guardado.conversaciones.map((c) => ({
            ...c,
            etiquetasIds: Array.isArray(c?.etiquetasIds) ? c.etiquetasIds : [],
          }))
        : [],
      mensajesPorConversacion:
        guardado.mensajesPorConversacion && typeof guardado.mensajesPorConversacion === "object"
          ? guardado.mensajesPorConversacion
          : {},
      etiquetas:
        Array.isArray(guardado.etiquetas) && guardado.etiquetas.length > 0
          ? guardado.etiquetas
          : ETIQUETAS_OMNICANAL_POR_DEFECTO,
      respuestasRapidas:
        Array.isArray(guardado.respuestasRapidas) && guardado.respuestasRapidas.length > 0
          ? guardado.respuestasRapidas
          : RESPUESTAS_RAPIDAS_POR_DEFECTO,
    };
  } catch {
    return {
      conversaciones: [],
      mensajesPorConversacion: {},
      etiquetas: ETIQUETAS_OMNICANAL_POR_DEFECTO,
      respuestasRapidas: RESPUESTAS_RAPIDAS_POR_DEFECTO,
    };
  }
}

async function escribirAlmacenRespaldoCfg(
  negocio: string,
  almacen: AlmacenRespaldoOmnicanal
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const cliente: any = crearClienteAdmin() ?? (await crearClienteServidor());

    const { data: actual } = await cliente
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();

    const detallePrevio = (actual?.cfg_detalle_configuracion ?? {}) as Record<string, unknown>;
    const nuevoDetalle = {
      ...detallePrevio,
      omnicanal_inbox: {
        conversaciones: almacen.conversaciones.slice(0, 200),
        mensajesPorConversacion: almacen.mensajesPorConversacion,
        etiquetas: almacen.etiquetas,
        respuestasRapidas: almacen.respuestasRapidas,
      },
    };

    if (actual?.cfg_id) {
      const { error } = await cliente
        .schema("comun_configuracion")
        .from("cfg_negocio")
        .update({ cfg_detalle_configuracion: nuevoDetalle })
        .eq("cfg_id", actual.cfg_id);
      if (error) return { ok: false, error: error.message };
      return { ok: true };
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al respaldar configuración",
    };
  }
}

function extraerDatosContactoDesdeMensajeWeb(texto: string): {
  correoDetectado?: string;
  telefonoDetectado?: string;
} {
  const matchCorreo = texto.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  const matchTel = texto.match(/(?:\+?593[\s-]?9\d{2}[\s-]?\d{3}[\s-]?\d{3}|09\d{2}[\s-]?\d{3}[\s-]?\d{3}|\+\d{10,15})/);
  return {
    correoDetectado: matchCorreo ? matchCorreo[0].trim().toLowerCase() : undefined,
    telefonoDetectado: matchTel ? matchTel[0].replace(/[\s-]+/g, "").trim() : undefined,
  };
}

/**
 * Registra cada interacción del Chat Web (entrada del cliente, respuesta de IA ARIA
 * o evento de compra web) y devuelve si ARIA debe silenciarse porque un vendedor
 * humano tomó el control de la conversación (`EN_ATENCION_ASESORA`).
 */
export async function registrarInteraccionChatWebAction(entrada: {
  negocio: string;
  claveHilo: string;
  fase: "ENTRADA_CLIENTE" | "RESPUESTA_ARIA" | "EVENTO_ORDEN";
  contenido: string;
  metadatos?: Record<string, unknown>;
}): Promise<{
  ok: boolean;
  conversacionId?: string;
  estadoAtencion: EstadoAtencionOmnicanal;
  asesoraNombre?: string | null;
  silenciarAria: boolean;
  error?: string;
}> {
  const neg = normalizarNegocioComercio(entrada.negocio);
  const hilo = (entrada.claveHilo || "").trim().slice(0, 96);
  const texto = (entrada.contenido || "").trim();

  if (!hilo || !texto) {
    return {
      ok: false,
      estadoAtencion: "BOT_ACTIVO",
      silenciarAria: false,
      error: "Conversación o contenido vacío",
    };
  }

  const autoContacto =
    entrada.fase === "ENTRADA_CLIENTE" ? extraerDatosContactoDesdeMensajeWeb(texto) : {};
  const metaBase = entrada.metadatos ?? {};
  const nombreMeta = String(metaBase.nombre_cliente || metaBase.nombre || "").trim();
  const correoMeta =
    String(metaBase.correo || "").trim().toLowerCase() || autoContacto.correoDetectado || "";
  const telMeta =
    String(metaBase.telefono || "").trim() || autoContacto.telefonoDetectado || "";

  const metadatosEfectivos: Record<string, unknown> = {
    ...metaBase,
    canal: "web",
    ...(nombreMeta ? { nombre_cliente: nombreMeta } : {}),
    ...(correoMeta ? { correo: correoMeta } : {}),
    ...(telMeta ? { telefono: telMeta } : {}),
  };

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_registrar_interaccion_web", {
    p_negocio: neg,
    p_clave_hilo: hilo,
    p_fase: entrada.fase,
    p_contenido: texto,
    p_metadatos: metadatosEfectivos,
  });

  if (!error && data?.ok) {
    const ahoraIso = new Date().toISOString();
    const payloadRt: EventoBroadcastChatWeb = {
      eventoId: String(data.mensaje_id || `${hilo}:${entrada.fase}:${ahoraIso}`),
      claveHilo: hilo,
      conversacionId: String(data.conversacion_id),
      fase: entrada.fase,
      contenido: texto,
      autorNombre:
        entrada.fase === "RESPUESTA_ARIA"
          ? String(entrada.metadatos?.nombre_agente || "ARIA IA")
          : entrada.fase === "EVENTO_ORDEN"
            ? "E-Commerce Web"
            : nombreMeta || null,
      remitenteNombre: nombreMeta || null,
      remitenteCorreo: correoMeta || null,
      remitenteTelefono: telMeta || null,
      estadoAtencion: (data.estado_atencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
      creadoEn: ahoraIso,
    };
    await emitirBroadcastServidorOmnicanal(
      supabase,
      neg,
      "actividad_chat_web",
      payloadRt as unknown as Record<string, unknown>
    );

    if (entrada.fase === "ENTRADA_CLIENTE" && data.conversacion_id) {
      const convIdStr = String(data.conversacion_id);
      const msgIdStr = String(data.mensaje_id || Date.now());
      const nombreVis = nombreMeta || "Visitante Web";
      const extracto = texto.replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "Foto").slice(0, 150);
      await despacharPushYCampanaStaffOmnicanal({
        supabase,
        negocio: neg,
        soloVentas: true,
        titulo: `${nombreVis} · Chat Web`,
        cuerpoPlano: extracto,
        contenidoHtml: `<p><strong>${nombreVis}:</strong> ${extracto}</p>`,
        tag: `wa-conv-${convIdStr}`,
        claveRefBase: `msg-web-${msgIdStr}`,
        resolverUrlPorRol: () =>
          `/panel/conversaciones?chat=${encodeURIComponent(convIdStr)}&msg=${encodeURIComponent(msgIdStr)}`,
      });
    }

    return {
      ok: true,
      conversacionId: String(data.conversacion_id),
      estadoAtencion: (data.estado_atencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
      asesoraNombre: data.asesora_nombre ? String(data.asesora_nombre) : null,
      silenciarAria: Boolean(data.silenciar_aria),
    };
  }

  if (error && !esFuncionRpcPendienteMigracion(error.message)) {
    return {
      ok: false,
      estadoAtencion: "BOT_ACTIVO",
      silenciarAria: false,
      error: error.message,
    };
  }

  // Respaldo híbrido en cfg_negocio mientras se aplica la migración SQL remota
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const almacen = await leerAlmacenRespaldoCfg(neg);
  const ahora = new Date().toISOString();
  let conv = almacen.conversaciones.find((c) => c.canal === "web" && c.claveHilo === hilo);

  if (!conv) {
    const idNuevo =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `cnv-${Date.now()}`;
    conv = {
      id: idNuevo,
      negocio: neg,
      canal: "web",
      claveHilo: hilo,
      remitenteId: user?.id ?? hilo,
      remitenteNombre:
        nombreMeta ||
        user?.email?.split("@")[0] ||
        `Visitante Web #${hilo.replace(/[^a-zA-Z0-9]/g, "").slice(-4).toUpperCase()}`,
      remitenteCorreo: correoMeta || user?.email || null,
      remitenteTelefono: telMeta || null,
      usuarioId: user?.id ?? null,
      estadoAtencion: "BOT_ACTIVO",
      ultimoMensajeTexto: texto.slice(0, 280),
      ultimoMensajeOrigen:
        entrada.fase === "RESPUESTA_ARIA"
          ? "BOT_ARIA"
          : entrada.fase === "EVENTO_ORDEN"
            ? "SISTEMA"
            : "CLIENTE",
      ultimoMensajeEn: ahora,
      noLeidosAsesora: entrada.fase === "ENTRADA_CLIENTE" ? 1 : 0,
      mensajesClienteConteo: entrada.fase === "ENTRADA_CLIENTE" ? 1 : 0,
      mensajesIaConteo: entrada.fase === "RESPUESTA_ARIA" ? 1 : 0,
      mensajesHumanoConteo: 0,
      creadoEn: ahora,
      etiquetasIds: ["etq-web"],
    };
    almacen.conversaciones.unshift(conv);
  } else {
    if (nombreMeta && conv.remitenteNombre.startsWith("Visitante Web")) {
      conv.remitenteNombre = nombreMeta;
    }
    if (correoMeta && !conv.remitenteCorreo) {
      conv.remitenteCorreo = correoMeta;
    }
    if (telMeta && !conv.remitenteTelefono) {
      conv.remitenteTelefono = telMeta;
    }
    if (user?.id && !conv.usuarioId) {
      conv.usuarioId = user.id;
    }
    const pideHumano =
      entrada.fase === "ENTRADA_CLIENTE" &&
      /(hablar con (un |una )?(asesor|humano|persona|vendedor)|atencion humana|reclamo|queja)/i.test(
        texto
      );
    if (pideHumano && conv.estadoAtencion !== "EN_ATENCION_ASESORA") {
      conv.estadoAtencion = "ESCALADO_HUMANO";
      conv.motivoEscalamiento = "Solicitud directa de atención humana";
    }
    conv.ultimoMensajeTexto = texto.slice(0, 280);
    conv.ultimoMensajeEn = ahora;
    if (entrada.fase === "ENTRADA_CLIENTE") {
      conv.ultimoMensajeOrigen = "CLIENTE";
      conv.noLeidosAsesora = (conv.noLeidosAsesora || 0) + 1;
      conv.mensajesClienteConteo = (conv.mensajesClienteConteo || 0) + 1;
    } else if (entrada.fase === "RESPUESTA_ARIA") {
      conv.ultimoMensajeOrigen = "BOT_ARIA";
      conv.mensajesIaConteo = (conv.mensajesIaConteo || 0) + 1;
    } else {
      conv.ultimoMensajeOrigen = "SISTEMA";
      conv.noLeidosAsesora = (conv.noLeidosAsesora || 0) + 1;
    }
  }

  const listaMsgs = almacen.mensajesPorConversacion[conv.id] ?? [];
  listaMsgs.push({
    id: `msg-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    origen:
      entrada.fase === "RESPUESTA_ARIA"
        ? "BOT_ARIA"
        : entrada.fase === "EVENTO_ORDEN"
          ? "SISTEMA"
          : "CLIENTE",
    autorNombre:
      entrada.fase === "RESPUESTA_ARIA"
        ? String(entrada.metadatos?.nombre_agente || "ARIA IA")
        : entrada.fase === "EVENTO_ORDEN"
          ? "E-Commerce Web"
          : conv.remitenteNombre,
    contenido: texto,
    tipoContenido: entrada.fase === "EVENTO_ORDEN" ? "ORDEN_WEB" : "TEXTO",
    estadoEntrega: "ENVIADO",
    detalle: entrada.metadatos,
    creadoEn: ahora,
  });
  almacen.mensajesPorConversacion[conv.id] = listaMsgs;

  await escribirAlmacenRespaldoCfg(neg, almacen);

  const payloadFallbackRt: EventoBroadcastChatWeb = {
    eventoId: `fb-${hilo}-${entrada.fase}-${ahora}`,
    claveHilo: hilo,
    conversacionId: conv.id.startsWith("cnv-") ? null : conv.id,
    fase: entrada.fase,
    contenido: texto,
    autorNombre:
      entrada.fase === "RESPUESTA_ARIA"
        ? String(entrada.metadatos?.nombre_agente || "ARIA IA")
        : entrada.fase === "EVENTO_ORDEN"
          ? "E-Commerce Web"
          : conv.remitenteNombre,
    remitenteNombre: conv.remitenteNombre,
    remitenteCorreo: conv.remitenteCorreo ?? null,
    remitenteTelefono: conv.remitenteTelefono ?? null,
    estadoAtencion: conv.estadoAtencion,
    creadoEn: ahora,
  };
  await emitirBroadcastServidorOmnicanal(
    supabase,
    neg,
    "actividad_chat_web",
    payloadFallbackRt as unknown as Record<string, unknown>
  );

  return {
    ok: true,
    conversacionId: conv.id,
    estadoAtencion: conv.estadoAtencion,
    asesoraNombre: conv.asesoraNombre ?? null,
    silenciarAria: conv.estadoAtencion === "EN_ATENCION_ASESORA",
  };
}

/**
 * Permite al widget de Chat Web del cliente sincronizar en vivo cualquier
 * respuesta enviada por un vendedor humano desde la Consola Omnicanal.
 */
export async function sincronizarHiloPublicoChatWebAction(
  negocio: string,
  claveHilo: string
): Promise<{
  ok: boolean;
  existe: boolean;
  estadoAtencion: EstadoAtencionOmnicanal;
  asesoraNombre?: string | null;
  mensajesHumanos: Array<{
    id: string;
    autorNombre: string;
    contenido: string;
    creadoEn: string;
  }>;
}> {
  const neg = normalizarNegocioComercio(negocio);
  const hilo = (claveHilo || "").trim();
  if (!hilo) {
    return { ok: true, existe: false, estadoAtencion: "BOT_ACTIVO", mensajesHumanos: [] };
  }

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_sincronizar_hilo_publico", {
    p_negocio: neg,
    p_clave_hilo: hilo,
  });

  if (!error && data?.ok) {
    return {
      ok: true,
      existe: Boolean(data.existe),
      estadoAtencion: (data.estado_atencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
      asesoraNombre: data.asesora_nombre ? String(data.asesora_nombre) : null,
      mensajesHumanos: Array.isArray(data.mensajes_humanos) ? data.mensajes_humanos : [],
    };
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const conv = almacen.conversaciones.find((c) => c.canal === "web" && c.claveHilo === hilo);
  if (!conv) {
    return { ok: true, existe: false, estadoAtencion: "BOT_ACTIVO", mensajesHumanos: [] };
  }

  const msgs = (almacen.mensajesPorConversacion[conv.id] ?? [])
    .filter((m) => m.origen === "ASESORA_HUMANA")
    .map((m) => ({
      id: m.id,
      autorNombre: m.autorNombre || conv.asesoraNombre || "Asesor Comercial",
      contenido: m.contenido,
      creadoEn: m.creadoEn,
    }));

  return {
    ok: true,
    existe: true,
    estadoAtencion: conv.estadoAtencion,
    asesoraNombre: conv.asesoraNombre ?? null,
    mensajesHumanos: msgs,
  };
}

/**
 * Obtiene el Tablero Unificado de Ventas Omnicanal:
 * - Conversaciones en vivo (Web + conectores futuros WhatsApp/IG/FB/TikTok)
 * - Equipo de ventas con carga activa
 * - Etiquetas personalizables y Mensajes Predeterminados (/atajos)
 * - Usuarios registrados en la web + Compradores invitados (No Registrados)
 * - Todas las compras y proformas realizadas desde la web
 */
export async function obtenerTableroOmnicanalAction(
  negocio: string
): Promise<{ ok: true; datos: DatosTableroOmnicanal } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Inicia sesión en el portal para acceder al monitoreo de ventas." };
    }

    const [resPedidos, resPerfilActual] = await Promise.all([
      obtenerPedidosTiendaAction(neg).catch(() => ({ ok: false as const, pedidos: [] })),
      supabase
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
        .eq("usu_id", user.id)
        .maybeSingle(),
    ]);

    const usuarioActualNombre =
      [resPerfilActual.data?.usu_nombres, resPerfilActual.data?.usu_apellidos]
        .filter(Boolean)
        .join(" ")
        .trim() ||
      resPerfilActual.data?.usu_correo ||
      user.email ||
      "Tú";

    const pedidosBase = resPedidos.ok ? resPedidos.pedidos : [];
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const { data: rpcTablero, error: errRpc } = await esquemaComercio.rpc(
      "com_fn_omnicanal_obtener_tablero",
      { p_negocio: neg }
    );

    if (!errRpc && rpcTablero?.ok) {
      const contactos: ContactoUnificadoOmnicanal[] = Array.isArray(rpcTablero.usuariosYClientes)
        ? rpcTablero.usuariosYClientes.map((u: any) => ({
            ...u,
            etiquetasIds: Array.isArray(u?.etiquetasIds) ? u.etiquetasIds : [],
          }))
        : [];
      let conversacionesNormalizadas: ConversacionOmnicanal[] = Array.isArray(
        rpcTablero.conversaciones
      )
        ? rpcTablero.conversaciones.map((c: any) => ({
            ...c,
            etiquetasIds: Array.isArray(c?.etiquetasIds) ? c.etiquetasIds : [],
            datosVenta:
              c?.datosVenta && typeof c.datosVenta === "object"
                ? (c.datosVenta as DatosVentaConversacion)
                : {},
            cierre:
              c?.cierre && typeof c.cierre === "object"
                ? (c.cierre as DatosCierreConversacion)
                : null,
            fichaCliente:
              c?.fichaCliente && typeof c.fichaCliente === "object"
                ? (c.fichaCliente as FichaClienteOmnicanal)
                : null,
            puenteOmnicanal:
              c?.puenteOmnicanal && typeof c.puenteOmnicanal === "object"
                ? (c.puenteOmnicanal as PuenteOmnicanalCliente)
                : null,
          }))
        : [];

      // Enriquecimiento resiliente de fichaCliente y puenteOmnicanal incluso antes de aplicar migración SQL
      if (
        conversacionesNormalizadas.length > 0 &&
        conversacionesNormalizadas.every((c) => !c.fichaCliente && !c.puenteOmnicanal)
      ) {
        try {
          const dbAux: any = crearClienteAdmin() ?? supabase;
          const idsUuid = conversacionesNormalizadas
            .map((c) => c.id)
            .filter((id) => /^[0-9a-f-]{36}$/i.test(id));
          if (idsUuid.length > 0) {
            const { data: filasDet } = await dbAux
              .schema("comun_agentes")
              .from("agc_conversacion")
              .select("cnv_id, cnv_detalle_conversacion")
              .in("cnv_id", idsUuid);
            if (Array.isArray(filasDet) && filasDet.length > 0) {
              const mapaDet = new Map<string, Record<string, any>>();
              for (const f of filasDet) {
                if (f?.cnv_id && f.cnv_detalle_conversacion && typeof f.cnv_detalle_conversacion === "object") {
                  mapaDet.set(String(f.cnv_id), f.cnv_detalle_conversacion as Record<string, any>);
                }
              }
              conversacionesNormalizadas = conversacionesNormalizadas.map((c) => {
                const det = mapaDet.get(c.id);
                if (!det) return c;
                return {
                  ...c,
                  fichaCliente:
                    det.ficha_cliente && typeof det.ficha_cliente === "object"
                      ? (det.ficha_cliente as FichaClienteOmnicanal)
                      : c.fichaCliente ?? null,
                  puenteOmnicanal:
                    det.puente_omnicanal && typeof det.puente_omnicanal === "object"
                      ? (det.puente_omnicanal as PuenteOmnicanalCliente)
                      : c.puenteOmnicanal ?? null,
                };
              });
            }
          }
        } catch {
          // Ignorar si falla enriquecimiento opcional
        }
      }

      conversacionesNormalizadas = propagarFichaClienteEntreCanales(conversacionesNormalizadas);

      const pedidosWeb: PedidoWebConTipoCliente[] = pedidosBase.map((p) => ({
        ...p,
        esUsuarioRegistrado: esPedidoUsuarioRegistrado(p, contactos),
      }));

      const contactosEnriquecidos = enriquecerContactosConFichaCliente(
        enriquecerContactosConPedidos(contactos, pedidosWeb),
        conversacionesNormalizadas
      );
      const miembroActual = Array.isArray(rpcTablero.equipo)
        ? rpcTablero.equipo.find((m: any) => m?.usuarioId === user.id)
        : null;
      const esAdminEtiquetasInferido =
        typeof rpcTablero.esAdminEtiquetas === "boolean"
          ? rpcTablero.esAdminEtiquetas
          : Boolean(resPerfilActual.data?.usu_superadmin_plataforma) ||
            ["SUPERADMIN", "ADMINISTRADOR", "ADMIN", "OPERADOR"].includes(
              String(miembroActual?.rol || "").toUpperCase()
            );
      const esAdminAplicacionInferido =
        typeof rpcTablero.esAdminAplicacion === "boolean"
          ? rpcTablero.esAdminAplicacion
          : Boolean(resPerfilActual.data?.usu_superadmin_plataforma) ||
            (neg === "tinkay" &&
              String(resPerfilActual.data?.usu_correo || user.email || "")
                .trim()
                .toLowerCase() === "tinkay.uio@gmail.com") ||
            ["SUPERADMIN", "ADMINISTRADOR", "ADMIN"].includes(
              String(miembroActual?.rol || "").toUpperCase()
            );

      const etiquetasFiltradas = (
        Array.isArray(rpcTablero.etiquetas) && rpcTablero.etiquetas.length > 0
          ? rpcTablero.etiquetas
          : ETIQUETAS_OMNICANAL_POR_DEFECTO
      ).filter(
        (e: any) => e?.slug !== "origen-whatsapp" && e?.slug !== "origen-web"
      );

      return {
        ok: true,
        datos: {
          usuarioActualId: user.id,
          usuarioActualNombre,
          esAdminEtiquetas: esAdminEtiquetasInferido,
          esAdminAplicacion: esAdminAplicacionInferido,
          conversaciones: conversacionesNormalizadas,
          etiquetas: etiquetasFiltradas,
          respuestasRapidas:
            Array.isArray(rpcTablero.respuestasRapidas) && rpcTablero.respuestasRapidas.length > 0
              ? rpcTablero.respuestasRapidas
              : RESPUESTAS_RAPIDAS_POR_DEFECTO,
          equipo: Array.isArray(rpcTablero.equipo) ? rpcTablero.equipo : [],
          usuariosYClientes: contactosEnriquecidos,
          pedidosWeb,
        },
      };
    }

    if (rpcTablero && rpcTablero.ok === false) {
      return { ok: false, error: String(rpcTablero.error || "Acceso no autorizado") };
    }

    // Respaldo resiliente (sin service_role requerido): usa crearClienteAdmin() ?? supabase
    const adminDb: any = crearClienteAdmin() ?? supabase;
    const codigos = variantesCodigoNegocio(neg);

    const [
      almacen,
      resMembresias,
      resClientes,
      resConvsTabla,
      resEtiquetasTabla,
      resRespuestasTabla,
      resConvEtqTabla,
    ] = await Promise.all([
      leerAlmacenRespaldoCfg(neg),
      Promise.resolve(
        adminDb
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select(
            "mem_usuario_id, mem_rol, mem_creado_en, seg_usuario(usu_id, usu_nombres, usu_apellidos, usu_correo, usu_whatsapp, usu_cedula, usu_autorizacion_whatsapp, usu_superadmin_plataforma, usu_detalle_usuario)"
          )
          .in("mem_negocio", codigos)
          .eq("mem_estado", "ACTIVO")
      ).catch(() => ({ data: null })),
      Promise.resolve(
        adminDb
          .schema("comun_comercio")
          .from("com_cliente")
          .select("*")
          .eq("cli_negocio", neg)
          .is("cli_eliminado_en", null)
          .limit(300)
      ).catch(() => ({ data: null })),
      Promise.resolve(
        adminDb
          .schema("comun_agentes")
          .from("agc_conversacion")
          .select("*")
          .eq("cnv_negocio", neg)
          .is("cnv_eliminado_en", null)
          .order("cnv_ultimo_mensaje_en", { ascending: false })
          .limit(250)
      ).catch(() => ({ data: null })),
      Promise.resolve(
        adminDb
          .schema("comun_agentes")
          .from("agc_etiqueta")
          .select("*")
          .eq("etq_negocio", neg)
          .eq("etq_activo", true)
          .is("etq_eliminado_en", null)
          .order("etq_orden", { ascending: true })
      ).catch(() => ({ data: null })),
      Promise.resolve(
        adminDb
          .schema("comun_agentes")
          .from("agc_respuesta_rapida")
          .select("*")
          .eq("rrp_negocio", neg)
          .eq("rrp_activo", true)
          .is("rrp_eliminado_en", null)
          .order("rrp_atajo", { ascending: true })
      ).catch(() => ({ data: null })),
      Promise.resolve(
        adminDb
          .schema("comun_agentes")
          .from("agc_conversacion_etiqueta")
          .select("cet_conversacion_id, cet_etiqueta_id")
          .is("cet_eliminado_en", null)
      ).catch(() => ({ data: null })),
    ]);

    const membresias = Array.isArray(resMembresias?.data) ? resMembresias.data : [];
    const clientesTabla = Array.isArray(resClientes?.data) ? resClientes.data : [];
    const convsTabla = Array.isArray(resConvsTabla?.data) ? resConvsTabla.data : null;
    const etiquetasTabla = Array.isArray(resEtiquetasTabla?.data) ? resEtiquetasTabla.data : null;
    const respuestasTabla = Array.isArray(resRespuestasTabla?.data) ? resRespuestasTabla.data : null;
    const convEtqTabla = Array.isArray(resConvEtqTabla?.data) ? resConvEtqTabla.data : [];

    const mapaEtqPorConv = new Map<string, string[]>();
    for (const rel of convEtqTabla) {
      if (!rel?.cet_conversacion_id || !rel?.cet_etiqueta_id) continue;
      const arr = mapaEtqPorConv.get(String(rel.cet_conversacion_id)) ?? [];
      arr.push(String(rel.cet_etiqueta_id));
      mapaEtqPorConv.set(String(rel.cet_conversacion_id), arr);
    }

    const nombresUsuariosMap = new Map<string, string>();
    const equipo: MiembroEquipoOmnicanal[] = [];
    const contactosMap = new Map<string, ContactoUnificadoOmnicanal>();

    for (const m of membresias) {
      const u = Array.isArray(m.seg_usuario) ? m.seg_usuario[0] : m.seg_usuario;
      if (!u?.usu_id) continue;
      const esSuperAdminCorreo =
        Boolean(u.usu_superadmin_plataforma) ||
        (neg === "tinkay" &&
          String(u.usu_correo || "")
            .trim()
            .toLowerCase() === "tinkay.uio@gmail.com");
      const rol = esSuperAdminCorreo
        ? "SUPERADMIN"
        : String(m.mem_rol || "CLIENTE").toUpperCase();
      const detalleUsu =
        u.usu_detalle_usuario && typeof u.usu_detalle_usuario === "object"
          ? (u.usu_detalle_usuario as Record<string, any>)
          : {};
      const regNegocio = detalleUsu.registros_negocio?.[neg] ?? {};
      const nombreCompleto =
        [regNegocio.nombres || u.usu_nombres, regNegocio.apellidos || u.usu_apellidos]
          .filter(Boolean)
          .join(" ")
          .trim() ||
        u.usu_correo ||
        "Usuario";

      nombresUsuariosMap.set(String(u.usu_id), nombreCompleto);

      if (
        ["VENTAS", "VENDEDOR", "ASESOR", "OPERADOR", "ADMINISTRADOR", "ADMIN", "SUPERADMIN"].includes(
          rol
        )
      ) {
        equipo.push({
          usuarioId: u.usu_id,
          nombre: nombreCompleto,
          correo: u.usu_correo || "",
          avatarUrl: typeof detalleUsu.foto === "string" ? detalleUsu.foto : null,
          rol,
          chatsActivos: 0,
        });
      }

      contactosMap.set(`usu:${u.usu_id}`, {
        claveUnica: `usu:${u.usu_id}`,
        usuarioId: u.usu_id,
        clienteId: null,
        tipoCuenta: "USUARIO_REGISTRADO",
        nombre: nombreCompleto,
        correo: u.usu_correo || null,
        telefono: String(regNegocio.whatsapp || u.usu_whatsapp || "").trim() || null,
        identificacion: u.usu_cedula || null,
        autorizaWhatsapp: Boolean(
          regNegocio.autorizacion_whatsapp ?? u.usu_autorizacion_whatsapp
        ),
        rolNegocio: rol,
        totalCompras: 0,
        montoAcumulado: 0,
        creadoEn: m.mem_creado_en || new Date().toISOString(),
        etiquetasIds: [],
      });
    }

    const conversacionesFinales: ConversacionOmnicanal[] =
      convsTabla !== null
        ? convsTabla
            .filter((c: any) => c.cnv_canal !== "interno")
            .map((c: any) => ({
              id: String(c.cnv_id),
              secuencial: Number(c.cnv_secuencial) || undefined,
              negocio: String(c.cnv_negocio || neg),
              canal: (c.cnv_canal as ConversacionOmnicanal["canal"]) || "web",
              claveHilo: String(c.cnv_clave_hilo || ""),
              remitenteId: String(c.cnv_remitente_id || ""),
              remitenteNombre: String(c.cnv_remitente_nombre || "Visitante Web"),
              remitenteCorreo: c.cnv_remitente_correo ?? null,
              remitenteTelefono: c.cnv_remitente_telefono ?? null,
              usuarioId: c.cnv_usuario_id ?? null,
              clienteId: c.cnv_cliente_id ?? null,
              estadoAtencion:
                (c.cnv_estado_atencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
              asesoraAsignadaId: c.cnv_asesora_asignada_id ?? null,
              asesoraNombre: c.cnv_asesora_asignada_id
                ? nombresUsuariosMap.get(String(c.cnv_asesora_asignada_id)) ?? null
                : null,
              ultimoMensajeTexto: c.cnv_ultimo_mensaje_texto ?? null,
              ultimoMensajeOrigen: c.cnv_ultimo_mensaje_origen ?? null,
              ultimoMensajeEn: c.cnv_ultimo_mensaje_en || c.cnv_creado_en || new Date().toISOString(),
              noLeidosAsesora: Number(c.cnv_no_leidos_asesora) || 0,
              mensajesClienteConteo: Number(c.cnv_mensajes_cliente_conteo) || 0,
              mensajesIaConteo: Number(c.cnv_mensajes_ia_conteo) || 0,
              mensajesHumanoConteo: Number(c.cnv_mensajes_humano_conteo) || 0,
              motivoEscalamiento: c.cnv_motivo_escalamiento ?? null,
              recordatorioEn: c.cnv_recordatorio_en ?? null,
              recordatorioNota: c.cnv_recordatorio_nota ?? null,
              ventana24hExpiraEn: c.cnv_ventana_24h_expira_en ?? null,
              creadoEn: c.cnv_creado_en || new Date().toISOString(),
              etiquetasIds: mapaEtqPorConv.get(String(c.cnv_id)) ?? [],
              datosVenta:
                c.cnv_detalle_conversacion?.datos_venta &&
                typeof c.cnv_detalle_conversacion.datos_venta === "object"
                  ? (c.cnv_detalle_conversacion.datos_venta as DatosVentaConversacion)
                  : {},
              cierre:
                c.cnv_detalle_conversacion?.cierre &&
                typeof c.cnv_detalle_conversacion.cierre === "object"
                  ? (c.cnv_detalle_conversacion.cierre as DatosCierreConversacion)
                  : null,
              fichaCliente:
                c.cnv_detalle_conversacion?.ficha_cliente &&
                typeof c.cnv_detalle_conversacion.ficha_cliente === "object"
                  ? (c.cnv_detalle_conversacion.ficha_cliente as FichaClienteOmnicanal)
                  : null,
              puenteOmnicanal:
                c.cnv_detalle_conversacion?.puente_omnicanal &&
                typeof c.cnv_detalle_conversacion.puente_omnicanal === "object"
                  ? (c.cnv_detalle_conversacion.puente_omnicanal as PuenteOmnicanalCliente)
                  : null,
            }))
        : almacen.conversaciones;

    const conversacionesPropagadas = propagarFichaClienteEntreCanales(conversacionesFinales);

    for (const miembro of equipo) {
      miembro.chatsActivos = conversacionesFinales.filter(
        (c) => c.asesoraAsignadaId === miembro.usuarioId && c.estadoAtencion !== "CERRADO"
      ).length;
    }

    const etiquetasFinales: EtiquetaOmnicanal[] = (
      etiquetasTabla && etiquetasTabla.length > 0
        ? etiquetasTabla.map((e: any) => ({
            id: String(e.etq_id),
            slug: String(e.etq_slug || ""),
            nombre: String(e.etq_nombre || ""),
            color: String(e.etq_color || "#2563EB"),
            icono: String(e.etq_icono || "🏷️"),
            orden: Number(e.etq_orden) || 0,
          }))
        : almacen.etiquetas
    ).filter((e: EtiquetaOmnicanal) => e.slug !== "origen-whatsapp" && e.slug !== "origen-web");

    const respuestasFinales: RespuestaRapidaOmnicanal[] =
      respuestasTabla && respuestasTabla.length > 0
        ? respuestasTabla.map((r: any) => ({
            id: String(r.rrp_id),
            atajo: String(r.rrp_atajo || ""),
            titulo: String(r.rrp_titulo || ""),
            categoria: String(r.rrp_categoria || "Ventas"),
            contenido: String(r.rrp_contenido || ""),
            usoConteo: Number(r.rrp_uso_conteo) || 0,
          }))
        : almacen.respuestasRapidas;

    for (const c of clientesTabla) {
      const correoNorm = String(c.cli_correo || "").trim().toLowerCase();
      const existentePorCorreo = Array.from(contactosMap.values()).find(
        (item) => correoNorm && (item.correo || "").trim().toLowerCase() === correoNorm
      );
      if (existentePorCorreo) {
        existentePorCorreo.clienteId = c.cli_id;
        existentePorCorreo.identificacion = c.cli_identificacion || existentePorCorreo.identificacion;
        existentePorCorreo.totalCompras = Number(c.cli_total_compras) || 0;
        existentePorCorreo.montoAcumulado = Number(c.cli_monto_acumulado) || 0;
        existentePorCorreo.ultimaCompraEn = c.cli_ultima_compra_en;
        continue;
      }

      if (!c.cli_usuario_id) {
        contactosMap.set(`cli:${c.cli_id}`, {
          claveUnica: `cli:${c.cli_id}`,
          usuarioId: null,
          clienteId: c.cli_id,
          tipoCuenta: "INVITADO_NO_REGISTRADO",
          nombre: c.cli_nombre || "Comprador Invitado",
          correo: c.cli_correo || null,
          telefono: c.cli_telefono || null,
          identificacion: c.cli_identificacion || null,
          autorizaWhatsapp: false,
          rolNegocio: "INVITADO",
          totalCompras: Number(c.cli_total_compras) || 0,
          montoAcumulado: Number(c.cli_monto_acumulado) || 0,
          ultimaCompraEn: c.cli_ultima_compra_en,
          creadoEn: c.cli_creado_en || new Date().toISOString(),
          etiquetasIds: [],
        });
      }
    }

    const contactosBase = Array.from(contactosMap.values());
    const pedidosWeb: PedidoWebConTipoCliente[] = pedidosBase.map((p) => ({
      ...p,
      esUsuarioRegistrado: esPedidoUsuarioRegistrado(p, contactosBase),
    }));

    const rolUsuarioActualFallback = equipo.find((m) => m.usuarioId === user.id)?.rol || "";
    const esAdminEtiquetasFallback =
      Boolean(resPerfilActual.data?.usu_superadmin_plataforma) ||
      ["SUPERADMIN", "ADMINISTRADOR", "ADMIN", "OPERADOR"].includes(
        rolUsuarioActualFallback.toUpperCase()
      );
    const esAdminAplicacionFallback =
      Boolean(resPerfilActual.data?.usu_superadmin_plataforma) ||
      (neg === "tinkay" &&
        String(resPerfilActual.data?.usu_correo || user.email || "")
          .trim()
          .toLowerCase() === "tinkay.uio@gmail.com") ||
      ["SUPERADMIN", "ADMINISTRADOR", "ADMIN"].includes(
        rolUsuarioActualFallback.toUpperCase()
      );

    return {
      ok: true,
      datos: {
        usuarioActualId: user.id,
        usuarioActualNombre,
        esAdminEtiquetas: esAdminEtiquetasFallback,
        esAdminAplicacion: esAdminAplicacionFallback,
        conversaciones: conversacionesPropagadas,
        etiquetas: etiquetasFinales,
        respuestasRapidas: respuestasFinales,
        equipo,
        usuariosYClientes: enriquecerContactosConFichaCliente(
          enriquecerContactosConPedidos(contactosBase, pedidosWeb),
          conversacionesPropagadas
        ),
        pedidosWeb,
        usandoRespaldoHibrido: convsTabla === null,
        avisoMigracionSql: convsTabla === null && errRpc ? errRpc.message : null,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? err.message
          : "No se pudo cargar el tablero de monitoreo de conversaciones.",
    };
  }
}

function claveIdentidadCruzadaConversacion(c: ConversacionOmnicanal): string[] {
  const claves: string[] = [];
  if (c.usuarioId) claves.push(`usu:${c.usuarioId}`);
  const tel = normalizarTelefonoOmnicanal(c.remitenteTelefono);
  if (tel.length >= 9) claves.push(`tel:${tel.slice(-9)}`);
  const cor = (c.remitenteCorreo || "").trim().toLowerCase();
  if (cor) claves.push(`cor:${cor}`);
  const refWeb = (c.puenteOmnicanal?.refWeb || "").trim().toUpperCase();
  if (refWeb) claves.push(`ref:${refWeb}`);
  return claves;
}

function propagarFichaClienteEntreCanales(
  conversaciones: ConversacionOmnicanal[]
): ConversacionOmnicanal[] {
  if (conversaciones.length <= 1) return conversaciones;
  const mejorFichaPorClave = new Map<string, FichaClienteOmnicanal>();

  for (const c of conversaciones) {
    const fc = c.fichaCliente;
    if (!fc || (!fc.calificacionEstrellas && !fc.notasCliente && !fc.nombrePersonalizado)) {
      continue;
    }
    for (const k of claveIdentidadCruzadaConversacion(c)) {
      const prev = mejorFichaPorClave.get(k);
      if (
        !prev ||
        String(fc.actualizadoEn || "") >= String(prev.actualizadoEn || "")
      ) {
        mejorFichaPorClave.set(k, fc);
      }
    }
  }

  if (mejorFichaPorClave.size === 0) return conversaciones;

  return conversaciones.map((c) => {
    const tienePropia = Boolean(
      c.fichaCliente &&
        (c.fichaCliente.calificacionEstrellas ||
          c.fichaCliente.notasCliente ||
          c.fichaCliente.nombrePersonalizado)
    );
    if (tienePropia) {
      if (
        c.fichaCliente?.nombrePersonalizado &&
        c.fichaCliente.nombrePersonalizado.trim() &&
        c.remitenteNombre !== c.fichaCliente.nombrePersonalizado.trim()
      ) {
        return { ...c, remitenteNombre: c.fichaCliente.nombrePersonalizado.trim() };
      }
      return c;
    }

    for (const k of claveIdentidadCruzadaConversacion(c)) {
      const compartida = mejorFichaPorClave.get(k);
      if (compartida) {
        return {
          ...c,
          remitenteNombre:
            compartida.nombrePersonalizado?.trim() || c.remitenteNombre,
          fichaCliente: compartida,
        };
      }
    }
    return c;
  });
}

function enriquecerContactosConFichaCliente(
  contactos: ContactoUnificadoOmnicanal[],
  conversaciones: ConversacionOmnicanal[]
): ContactoUnificadoOmnicanal[] {
  if (contactos.length === 0 || conversaciones.length === 0) return contactos;
  return contactos.map((ct) => {
    const telCt = normalizarTelefonoOmnicanal(ct.telefono);
    const corCt = (ct.correo || "").trim().toLowerCase();
    const convMatch = conversaciones.find((cv) => {
      if (!cv.fichaCliente) return false;
      if (ct.usuarioId && cv.usuarioId === ct.usuarioId) return true;
      if (corCt && (cv.remitenteCorreo || "").trim().toLowerCase() === corCt) return true;
      const telCv = normalizarTelefonoOmnicanal(cv.remitenteTelefono);
      return telCt.length >= 9 && telCv.length >= 9 && telCt.slice(-9) === telCv.slice(-9);
    });
    if (!convMatch?.fichaCliente) return ct;
    const fc = convMatch.fichaCliente;
    return {
      ...ct,
      nombre: fc.nombrePersonalizado?.trim() || ct.nombre,
      calificacionEstrellas: fc.calificacionEstrellas ?? ct.calificacionEstrellas ?? null,
      notasCliente: fc.notasCliente ?? ct.notasCliente ?? null,
    };
  });
}

function enriquecerContactosConPedidos(
  contactos: ContactoUnificadoOmnicanal[],
  pedidos: PedidoWebConTipoCliente[]
): ContactoUnificadoOmnicanal[] {
  const resultado = contactos.map((c) => ({ ...c }));

  for (const ped of pedidos) {
    if (ped.estado === "CANCELADO" || ped.estado === "NO_ACEPTADA") continue;
    const correoPed = (ped.compradorCorreo || "").trim().toLowerCase();
    const telPed = normalizarTelefonoOmnicanal(ped.compradorTelefono);

    let match = resultado.find((c) => {
      if (correoPed && (c.correo || "").trim().toLowerCase() === correoPed) return true;
      if (telPed.length >= 9 && normalizarTelefonoOmnicanal(c.telefono) === telPed) return true;
      return false;
    });

    if (!match) {
      const claveInvitado = `ped:${correoPed || telPed || ped.id}`;
      match = {
        claveUnica: claveInvitado,
        usuarioId: null,
        clienteId: null,
        tipoCuenta: "INVITADO_NO_REGISTRADO",
        nombre: ped.compradorNombre || "Comprador Invitado",
        correo: ped.compradorCorreo || null,
        telefono: ped.compradorTelefono || null,
        identificacion: ped.compradorIdentificacion || null,
        autorizaWhatsapp: Boolean(ped.autorizaWhatsapp),
        rolNegocio: "INVITADO",
        totalCompras: 1,
        montoAcumulado: Number(ped.total) || 0,
        ultimaCompraEn: ped.creadoEn,
        creadoEn: ped.creadoEn,
        etiquetasIds: [],
      };
      resultado.push(match);
    } else if (match.totalCompras === 0) {
      const pedidosDelContacto = pedidos.filter((x) => {
        if (x.estado === "CANCELADO" || x.estado === "NO_ACEPTADA") return false;
        const cx = (x.compradorCorreo || "").trim().toLowerCase();
        const tx = normalizarTelefonoOmnicanal(x.compradorTelefono);
        return (
          (correoPed && cx === correoPed) || (telPed.length >= 9 && tx.length >= 9 && tx === telPed)
        );
      });
      match.totalCompras = pedidosDelContacto.length;
      match.montoAcumulado =
        Math.round(
          pedidosDelContacto.reduce((acc, item) => acc + (Number(item.total) || 0), 0) * 100
        ) / 100;
      match.ultimaCompraEn = pedidosDelContacto[0]?.creadoEn ?? match.ultimaCompraEn;
    }
  }

  return resultado;
}

export async function obtenerMensajesConversacionAction(
  negocio: string,
  conversacionId: string
): Promise<{ ok: true; mensajes: MensajeOmnicanal[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(conversacionId)) {
      const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_obtener_mensajes", {
        p_negocio: neg,
        p_conversacion_id: conversacionId,
      });

      if (!error && data?.ok) {
        return { ok: true, mensajes: Array.isArray(data.mensajes) ? data.mensajes : [] };
      }
      if (error && !esFuncionRpcPendienteMigracion(error.message)) {
        return { ok: false, error: error.message };
      }
      if (data && data.ok === false) {
        return { ok: false, error: String(data.error) };
      }
    }

    const almacen = await leerAlmacenRespaldoCfg(neg);
    const conv = almacen.conversaciones.find((c) => c.id === conversacionId);
    if (conv && conv.noLeidosAsesora > 0) {
      conv.noLeidosAsesora = 0;
      await escribirAlmacenRespaldoCfg(neg, almacen);
    }
    return { ok: true, mensajes: almacen.mensajesPorConversacion[conversacionId] ?? [] };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudieron cargar los mensajes.",
    };
  }
}

export async function enviarMensajeAsesorOmnicanalAction(entrada: {
  negocio: string;
  conversacionId: string;
  contenido: string;
  esNotaInterna?: boolean;
  respuestaRapidaId?: string | null;
  imagenUrl?: string | null;
  documentoUrl?: string | null;
  documentoNombre?: string | null;
}): Promise<
  | {
      ok: true;
      mensaje: MensajeOmnicanal;
      estadoAtencion: EstadoAtencionOmnicanal;
      asesoraAsignadaId?: string | null;
      mensajesHumanoConteo: number;
      avisoWhatsApp?: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const imgUrl = (entrada.imagenUrl || "").trim() || null;
    const docUrl = (entrada.documentoUrl || "").trim() || null;
    const docNombre = (entrada.documentoNombre || "").trim() || null;
    let texto = (entrada.contenido || "").trim();

    if (!texto && !imgUrl && !docUrl) {
      return { ok: false, error: "Escribe un mensaje o selecciona un adjunto antes de enviar." };
    }

    if (!texto) {
      if (docUrl) {
        texto = `📄 [${docNombre || "Documento adjunto"}](${docUrl})`;
      } else if (imgUrl) {
        texto = `![Fotografía adjunta](${imgUrl})`;
      }
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(entrada.conversacionId)) {
      const argsBase5 = {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_contenido: texto,
        p_es_nota_interna: Boolean(entrada.esNotaInterna),
        p_respuesta_rapida_id:
          entrada.respuestaRapidaId && /^[0-9a-f-]{36}$/i.test(entrada.respuestaRapidaId)
            ? entrada.respuestaRapidaId
            : null,
      };

      let { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_enviar_mensaje_asesor", {
        ...argsBase5,
        p_imagen_url: imgUrl,
        p_documento_url: docUrl,
        p_documento_nombre: docNombre,
      });

      if (error && esFuncionRpcPendienteMigracion(error.message)) {
        const intento5 = await esquemaComercio.rpc(
          "com_fn_omnicanal_enviar_mensaje_asesor",
          argsBase5
        );
        data = intento5.data;
        error = intento5.error;
      }

      if (!error && data?.ok) {
        return {
          ok: true,
          mensaje: data.mensaje as MensajeOmnicanal,
          estadoAtencion: (data.estadoAtencion as EstadoAtencionOmnicanal) || "EN_ATENCION_ASESORA",
          asesoraAsignadaId: data.asesoraAsignadaId ? String(data.asesoraAsignadaId) : null,
          mensajesHumanoConteo: Number(data.mensajesHumanoConteo) || 1,
          avisoWhatsApp: data.avisoWhatsApp ? String(data.avisoWhatsApp) : null,
        };
      }
      if (error && !esFuncionRpcPendienteMigracion(error.message)) {
        return { ok: false, error: error.message };
      }
      if (data && data.ok === false) {
        return { ok: false, error: String(data.error) };
      }
    }

    // Respaldo híbrido
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return { ok: false, error: "Sesión expirada." };

    const almacen = await leerAlmacenRespaldoCfg(neg);
    const conv = almacen.conversaciones.find((c) => c.id === entrada.conversacionId);
    if (!conv) return { ok: false, error: "Conversación no encontrada." };

    const ahora = new Date().toISOString();
    const msg: MensajeOmnicanal = {
      id: `msg-${Date.now()}`,
      origen: entrada.esNotaInterna ? "NOTA_INTERNA" : "ASESORA_HUMANA",
      autorUsuarioId: user.id,
      autorNombre: user.email?.split("@")[0] || "Asesor",
      contenido: texto,
      tipoContenido: docUrl ? "DOCUMENTO" : imgUrl ? "IMAGEN" : "TEXTO",
      estadoEntrega: "ENVIADO",
      detalle: {
        ...(imgUrl ? { imagen_url: imgUrl } : {}),
        ...(docUrl ? { documento_url: docUrl, documento_nombre: docNombre || "documento" } : {}),
      },
      creadoEn: ahora,
    };

    const lista = almacen.mensajesPorConversacion[conv.id] ?? [];
    lista.push(msg);
    almacen.mensajesPorConversacion[conv.id] = lista;

    if (!entrada.esNotaInterna) {
      conv.estadoAtencion = "EN_ATENCION_ASESORA";
      conv.asesoraAsignadaId = conv.asesoraAsignadaId || user.id;
      conv.asesoraNombre = conv.asesoraNombre || msg.autorNombre;
      conv.ultimoMensajeTexto = texto.slice(0, 280);
      conv.ultimoMensajeOrigen = "ASESORA_HUMANA";
      conv.ultimoMensajeEn = ahora;
      conv.mensajesHumanoConteo = (conv.mensajesHumanoConteo || 0) + 1;
    }

    const resEsc = await escribirAlmacenRespaldoCfg(neg, almacen);
    if (!resEsc.ok) return { ok: false, error: resEsc.error || "No se pudo guardar la respuesta" };

    return {
      ok: true,
      mensaje: msg,
      estadoAtencion: conv.estadoAtencion,
      asesoraAsignadaId: conv.asesoraAsignadaId,
      mensajesHumanoConteo: conv.mensajesHumanoConteo,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al enviar mensaje.",
    };
  }
}

export async function actualizarConversacionOmnicanalAction(entrada: {
  negocio: string;
  conversacionId: string;
  nuevoEstado?: EstadoAtencionOmnicanal;
  asesoraId?: string | null;
  desasignar?: boolean;
  recordatorioEn?: string | null;
  recordatorioNota?: string | null;
  limpiarRecordatorio?: boolean;
  marcarNoLeido?: boolean;
  motivoCierre?: string | null;
  notaCierre?: string | null;
}): Promise<
  | {
      ok: true;
      estadoAtencion: EstadoAtencionOmnicanal;
      noLeidosAsesora?: number;
      cierre?: DatosCierreConversacion | null;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(entrada.conversacionId)) {
      const argsBase9 = {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_nuevo_estado: entrada.nuevoEstado ?? null,
        p_asesora_id: entrada.asesoraId ?? null,
        p_desasignar: Boolean(entrada.desasignar),
        p_recordatorio_en: entrada.recordatorioEn ?? null,
        p_recordatorio_nota: entrada.recordatorioNota ?? null,
        p_limpiar_recordatorio: Boolean(entrada.limpiarRecordatorio),
        p_marcar_no_leido: Boolean(entrada.marcarNoLeido),
      };

      let { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_actualizar_conversacion", {
        ...argsBase9,
        p_motivo_cierre: entrada.motivoCierre ?? null,
        p_nota_cierre: entrada.notaCierre ?? null,
      });

      if (error && esFuncionRpcPendienteMigracion(error.message)) {
        const intento9 = await esquemaComercio.rpc(
          "com_fn_omnicanal_actualizar_conversacion",
          argsBase9
        );
        data = intento9.data;
        error = intento9.error;
      }

      if (!error && data?.ok) {
        const defMotivo = entrada.motivoCierre
          ? obtenerDefinicionMotivoCierre(entrada.motivoCierre)
          : null;
        const cierreResuelto: DatosCierreConversacion | null =
          data.cierre && typeof data.cierre === "object"
            ? (data.cierre as DatosCierreConversacion)
            : entrada.nuevoEstado === "CERRADO" && defMotivo
              ? {
                  motivoCodigo: defMotivo.codigo,
                  motivoEtiqueta: `${defMotivo.icono} ${defMotivo.etiqueta}`,
                  nota: entrada.notaCierre?.trim() || null,
                  cerradoEn: new Date().toISOString(),
                }
              : null;

        return {
          ok: true,
          estadoAtencion: (data.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
          noLeidosAsesora:
            typeof data.noLeidosAsesora === "number" ? data.noLeidosAsesora : undefined,
          cierre: cierreResuelto,
        };
      }
      if (error && !esFuncionRpcPendienteMigracion(error.message)) {
        return { ok: false, error: error.message };
      }
      if (data && data.ok === false) {
        return { ok: false, error: String(data.error) };
      }
    }

    const almacen = await leerAlmacenRespaldoCfg(neg);
    const conv = almacen.conversaciones.find((c) => c.id === entrada.conversacionId);
    if (!conv) return { ok: false, error: "Conversación no encontrada." };

    if (entrada.nuevoEstado) {
      conv.estadoAtencion = entrada.nuevoEstado;
      if (entrada.nuevoEstado === "CERRADO") {
        const def = obtenerDefinicionMotivoCierre(entrada.motivoCierre);
        conv.cierre = {
          motivoCodigo: def.codigo,
          motivoEtiqueta: `${def.icono} ${def.etiqueta}`,
          nota: entrada.notaCierre?.trim() || null,
          cerradoEn: new Date().toISOString(),
        };
        conv.noLeidosAsesora = 0;
        conv.recordatorioEn = null;
        conv.recordatorioNota = null;
      } else {
        conv.cierre = null;
      }
    }
    if (entrada.desasignar) {
      conv.asesoraAsignadaId = null;
      conv.asesoraNombre = null;
    } else if (entrada.asesoraId) {
      conv.asesoraAsignadaId = entrada.asesoraId;
    }
    if (entrada.limpiarRecordatorio) {
      conv.recordatorioEn = null;
      conv.recordatorioNota = null;
    } else if (entrada.recordatorioEn) {
      conv.recordatorioEn = entrada.recordatorioEn;
      conv.recordatorioNota = entrada.recordatorioNota ?? null;
    }
    if (entrada.marcarNoLeido) {
      conv.noLeidosAsesora = Math.max(conv.noLeidosAsesora || 0, 1);
    }

    const resEsc = await escribirAlmacenRespaldoCfg(neg, almacen);
    if (!resEsc.ok) return { ok: false, error: resEsc.error || "Error al actualizar conversación" };

    return {
      ok: true,
      estadoAtencion: conv.estadoAtencion,
      noLeidosAsesora: conv.noLeidosAsesora,
      cierre: conv.cierre ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al actualizar conversación.",
    };
  }
}

/**
 * Elimina de forma completa una conversación y todos sus mensajes de la Bandeja Omnicanal.
 * Exclusivo para Administradores (`SUPERADMIN` / `ADMINISTRADOR`).
 */
export async function eliminarConversacionOmnicanalAction(entrada: {
  negocio: string;
  conversacionId: string;
  claveHilo?: string | null;
}): Promise<
  | { ok: true; conversacionId: string; remitenteNombre?: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const convId = String(entrada.conversacionId || "").trim();
    if (!convId) {
      return { ok: false, error: "Conversación no especificada." };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();

    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    }

    // Si es un hilo efímero en memoria `rt-...`, validar permiso de Administrador y confirmar limpieza
    const codigosNeg = variantesCodigoNegocio(neg);
    const adminDb: any = crearClienteAdmin() ?? supabase;

    const verificarPermisoAdminServidor = async (): Promise<{
      permitido: boolean;
      actorNombre: string;
    }> => {
      const [resUsu, resMem] = await Promise.all([
        adminDb
          .schema("comun_seguridad")
          .from("seg_usuario")
          .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
          .eq("usu_id", user.id)
          .maybeSingle(),
        adminDb
          .schema("comun_seguridad")
          .from("seg_membresia")
          .select("mem_rol, seg_membresia_perfil(seg_perfil(per_clave))")
          .eq("mem_usuario_id", user.id)
          .eq("mem_estado", "ACTIVO")
          .in("mem_negocio", codigosNeg),
      ]);

      const u = resUsu?.data;
      const actorNombre =
        [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(" ").trim() ||
        u?.usu_correo ||
        user.email ||
        "Administrador";

      if (
        Boolean(u?.usu_superadmin_plataforma) ||
        (neg === "tinkay" &&
          String(u?.usu_correo || user.email || "")
            .trim()
            .toLowerCase() === "tinkay.uio@gmail.com")
      ) {
        return { permitido: true, actorNombre };
      }

      const mems = Array.isArray(resMem?.data) ? resMem.data : [];
      for (const m of mems) {
        const rolBase = String(m?.mem_rol || "").toUpperCase();
        if (["SUPERADMIN", "ADMINISTRADOR", "ADMIN"].includes(rolBase)) {
          return { permitido: true, actorNombre };
        }
        const perfiles = Array.isArray(m?.seg_membresia_perfil) ? m.seg_membresia_perfil : [];
        for (const mp of perfiles) {
          const per = Array.isArray(mp?.seg_perfil) ? mp.seg_perfil[0] : mp?.seg_perfil;
          const clave = String(per?.per_clave || "").toUpperCase();
          if (["SUPERADMIN", "ADMINISTRADOR", "ADMIN"].includes(clave)) {
            return { permitido: true, actorNombre };
          }
        }
      }

      return { permitido: false, actorNombre };
    };

    if (/^[0-9a-f-]{36}$/i.test(convId)) {
      const esquemaComercio = supabase.schema("comun_comercio") as any;
      const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_eliminar_conversacion", {
        p_negocio: neg,
        p_conversacion_id: convId,
      });

      if (!error && data?.ok) {
        await emitirBroadcastServidorOmnicanal(supabase, neg, "intervencion_asesor", {
          eventoId: `del-${Date.now()}`,
          claveHilo: entrada.claveHilo || "",
          conversacionId: convId,
          estadoAtencion: "CERRADO",
          eliminada: true,
        });
        return {
          ok: true,
          conversacionId: convId,
          remitenteNombre: data.remitenteNombre ? String(data.remitenteNombre) : undefined,
        };
      }

      if (data && data.ok === false) {
        return { ok: false, error: String(data.error) };
      }

      if (error && !esFuncionRpcPendienteMigracion(error.message)) {
        return { ok: false, error: error.message };
      }

      // Respaldo inmediato si la migración 20261117000004 aún no se ha ejecutado en Supabase SQL Editor
      const checkAdmin = await verificarPermisoAdminServidor();
      if (!checkAdmin.permitido) {
        return {
          ok: false,
          error:
            "Permiso denegado: solo un Administrador de la aplicación puede eliminar conversaciones.",
        };
      }

      const ahoraIso = new Date().toISOString();
      await Promise.all([
        Promise.resolve(
          adminDb
            .schema("comun_agentes")
            .from("agc_conversacion_etiqueta")
            .update({ cet_eliminado_en: ahoraIso })
            .eq("cet_conversacion_id", convId)
            .is("cet_eliminado_en", null)
        ).catch(() => null),
        Promise.resolve(
          adminDb
            .schema("comun_agentes")
            .from("agc_mensaje")
            .update({ msg_eliminado_en: ahoraIso, msg_actualizado_en: ahoraIso })
            .eq("msg_conversacion_id", convId)
            .is("msg_eliminado_en", null)
        ).catch(() => null),
      ]);

      const { error: errDelConv } = await adminDb
        .schema("comun_agentes")
        .from("agc_conversacion")
        .update({
          cnv_eliminado_en: ahoraIso,
          cnv_actualizado_en: ahoraIso,
          cnv_no_leidos_asesora: 0,
          cnv_recordatorio_en: null,
          cnv_recordatorio_nota: null,
        })
        .eq("cnv_id", convId)
        .eq("cnv_negocio", neg)
        .neq("cnv_canal", "interno");

      if (errDelConv) {
        return { ok: false, error: errDelConv.message };
      }
    } else {
      const checkAdmin = await verificarPermisoAdminServidor();
      if (!checkAdmin.permitido) {
        return {
          ok: false,
          error:
            "Permiso denegado: solo un Administrador de la aplicación puede eliminar conversaciones.",
        };
      }
    }

    // Limpiar también del almacén híbrido si existía copia allí
    const almacen = await leerAlmacenRespaldoCfg(neg);
    if (almacen.conversaciones.some((c) => c.id === convId)) {
      almacen.conversaciones = almacen.conversaciones.filter((c) => c.id !== convId);
      delete almacen.mensajesPorConversacion[convId];
      await escribirAlmacenRespaldoCfg(neg, almacen);
    }

    await emitirBroadcastServidorOmnicanal(supabase, neg, "intervencion_asesor", {
      eventoId: `del-${Date.now()}`,
      claveHilo: entrada.claveHilo || "",
      conversacionId: convId,
      estadoAtencion: "CERRADO",
      eliminada: true,
    });

    return { ok: true, conversacionId: convId };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al eliminar conversación.",
    };
  }
}

export async function guardarEtiquetaOmnicanalAction(entrada: {
  negocio: string;
  id?: string | null;
  nombre: string;
  color: string;
  icono: string;
}): Promise<{ ok: true; etiqueta: EtiquetaOmnicanal } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(entrada.negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_guardar_etiqueta", {
    p_negocio: neg,
    p_nombre: entrada.nombre,
    p_color: entrada.color,
    p_icono: entrada.icono,
    p_etiqueta_id: entrada.id && /^[0-9a-f-]{36}$/i.test(entrada.id) ? entrada.id : null,
  });

  if (!error && data?.ok) {
    return { ok: true, etiqueta: data.etiqueta as EtiquetaOmnicanal };
  }
  if (data && data.ok === false) {
    return { ok: false, error: String(data.error) };
  }
  if (error && !esFuncionRpcPendienteMigracion(error.message)) {
    return { ok: false, error: error.message };
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const slug = entrada.nombre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const existenteIdx = entrada.id
    ? almacen.etiquetas.findIndex((e) => e.id === entrada.id)
    : -1;
  const nueva: EtiquetaOmnicanal = {
    id: entrada.id || `etq-${slug}-${Date.now()}`,
    slug,
    nombre: entrada.nombre.trim(),
    color: entrada.color || "#2563EB",
    icono: entrada.icono || "🏷️",
    orden: existenteIdx >= 0 ? almacen.etiquetas[existenteIdx]!.orden : almacen.etiquetas.length + 1,
  };
  if (existenteIdx >= 0) almacen.etiquetas[existenteIdx] = nueva;
  else almacen.etiquetas.push(nueva);
  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true, etiqueta: nueva };
}

export async function eliminarEtiquetaOmnicanalAction(
  negocio: string,
  etiquetaId: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  if (/^[0-9a-f-]{36}$/i.test(etiquetaId)) {
    const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_eliminar_etiqueta", {
      p_negocio: neg,
      p_etiqueta_id: etiquetaId,
    });
    if (!error && data?.ok) {
      return { ok: true };
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error) };
    }
    if (error && !esFuncionRpcPendienteMigracion(error.message)) {
      return { ok: false, error: error.message };
    }
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  almacen.etiquetas = almacen.etiquetas.filter((e) => e.id !== etiquetaId);
  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true };
}

export async function guardarDatosVentaOmnicanalAction(entrada: {
  negocio: string;
  conversacionId: string;
  datosVenta: DatosVentaConversacion;
}): Promise<
  | { ok: true; datosVenta: DatosVentaConversacion; remitenteNombre?: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(entrada.conversacionId)) {
      const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_guardar_datos_venta", {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_datos_venta: entrada.datosVenta,
      });
      if (!error && data?.ok) {
        return {
          ok: true,
          datosVenta: (data.datosVenta as DatosVentaConversacion) || entrada.datosVenta,
          remitenteNombre: data.remitenteNombre ? String(data.remitenteNombre) : undefined,
        };
      }
      if (data && data.ok === false) {
        return { ok: false, error: String(data.error) };
      }
      if (error && !esFuncionRpcPendienteMigracion(error.message)) {
        return { ok: false, error: error.message };
      }
    }

    const almacen = await leerAlmacenRespaldoCfg(neg);
    const conv = almacen.conversaciones.find((c) => c.id === entrada.conversacionId);
    if (conv) {
      conv.datosVenta = entrada.datosVenta;
      await escribirAlmacenRespaldoCfg(neg, almacen);
    }
    return { ok: true, datosVenta: entrada.datosVenta };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudieron guardar los campos de venta.",
    };
  }
}

export async function alternarEtiquetaOmnicanalAction(entrada: {
  negocio: string;
  etiquetaId: string;
  conversacionId?: string | null;
  clienteId?: string | null;
}): Promise<{ ok: true; asignada: boolean } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(entrada.negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  if (/^[0-9a-f-]{36}$/i.test(entrada.etiquetaId)) {
    const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_alternar_etiqueta", {
      p_negocio: neg,
      p_etiqueta_id: entrada.etiquetaId,
      p_conversacion_id: entrada.conversacionId ?? null,
      p_cliente_id: entrada.clienteId ?? null,
    });

    if (!error && data?.ok) {
      return { ok: true, asignada: Boolean(data.asignada) };
    }
    if (error && !esFuncionRpcPendienteMigracion(error.message)) {
      return { ok: false, error: error.message };
    }
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const conv = almacen.conversaciones.find((c) => c.id === entrada.conversacionId);
  if (!conv) return { ok: true, asignada: false };

  const yaTiene = conv.etiquetasIds.includes(entrada.etiquetaId);
  conv.etiquetasIds = yaTiene
    ? conv.etiquetasIds.filter((id) => id !== entrada.etiquetaId)
    : [...conv.etiquetasIds, entrada.etiquetaId];
  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true, asignada: !yaTiene };
}

export async function guardarRespuestaRapidaOmnicanalAction(entrada: {
  negocio: string;
  id?: string | null;
  atajo: string;
  titulo: string;
  categoria: string;
  contenido: string;
}): Promise<{ ok: true; respuesta: RespuestaRapidaOmnicanal } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(entrada.negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_guardar_respuesta_rapida", {
    p_negocio: neg,
    p_atajo: entrada.atajo,
    p_titulo: entrada.titulo,
    p_categoria: entrada.categoria,
    p_contenido: entrada.contenido,
    p_id: entrada.id && /^[0-9a-f-]{36}$/i.test(entrada.id) ? entrada.id : null,
  });

  if (!error && data?.ok) {
    return { ok: true, respuesta: data.respuesta as RespuestaRapidaOmnicanal };
  }
  if (error && !esFuncionRpcPendienteMigracion(error.message)) {
    return { ok: false, error: error.message };
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const atajoNorm = entrada.atajo.trim().startsWith("/")
    ? entrada.atajo.trim().toLowerCase()
    : `/${entrada.atajo.trim().toLowerCase()}`;
  const item: RespuestaRapidaOmnicanal = {
    id: entrada.id || `rrp-${Date.now()}`,
    atajo: atajoNorm,
    titulo: entrada.titulo.trim() || atajoNorm,
    categoria: entrada.categoria.trim() || "Ventas",
    contenido: entrada.contenido.trim(),
    usoConteo: 0,
  };
  const idx = almacen.respuestasRapidas.findIndex(
    (r) => r.id === entrada.id || r.atajo.toLowerCase() === atajoNorm
  );
  if (idx >= 0) almacen.respuestasRapidas[idx] = item;
  else almacen.respuestasRapidas.push(item);

  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true, respuesta: item };
}

export async function eliminarRespuestaRapidaOmnicanalAction(
  negocio: string,
  id: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  if (/^[0-9a-f-]{36}$/i.test(id)) {
    const { data, error } = await esquemaComercio.rpc(
      "com_fn_omnicanal_eliminar_respuesta_rapida",
      { p_negocio: neg, p_id: id }
    );
    if (!error && data?.ok) return { ok: true };
    if (error && !esFuncionRpcPendienteMigracion(error.message)) {
      return { ok: false, error: error.message };
    }
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  almacen.respuestasRapidas = almacen.respuestasRapidas.filter((r) => r.id !== id);
  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true };
}

export async function abrirSeguimientoContactoOmnicanalAction(entrada: {
  negocio: string;
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  usuarioId?: string | null;
  clienteId?: string | null;
  contextoOrden?: string | null;
}): Promise<{ ok: true; conversacionId: string } | { ok: false; error: string }> {
  const neg = normalizarNegocioComercio(entrada.negocio);
  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const esquemaComercio = supabase.schema("comun_comercio") as any;

  const { data, error } = await esquemaComercio.rpc(
    "com_fn_omnicanal_abrir_seguimiento_contacto",
    {
      p_negocio: neg,
      p_nombre: entrada.nombre,
      p_correo: entrada.correo ?? null,
      p_telefono: entrada.telefono ?? null,
      p_usuario_id:
        entrada.usuarioId && /^[0-9a-f-]{36}$/i.test(entrada.usuarioId) ? entrada.usuarioId : null,
      p_cliente_id:
        entrada.clienteId && /^[0-9a-f-]{36}$/i.test(entrada.clienteId) ? entrada.clienteId : null,
      p_contexto_orden: entrada.contextoOrden ?? null,
    }
  );

  if (!error && data?.ok) {
    return { ok: true, conversacionId: String(data.conversacionId) };
  }
  if (error && !esFuncionRpcPendienteMigracion(error.message)) {
    return { ok: false, error: error.message };
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const correoNorm = (entrada.correo || "").trim().toLowerCase();
  const telNorm = normalizarTelefonoOmnicanal(entrada.telefono);
  let conv = almacen.conversaciones.find(
    (c) =>
      (correoNorm && (c.remitenteCorreo || "").toLowerCase() === correoNorm) ||
      (telNorm.length >= 9 && normalizarTelefonoOmnicanal(c.remitenteTelefono) === telNorm)
  );

  if (!conv) {
    const ahora = new Date().toISOString();
    const nuevoId = `cnv-${Date.now()}`;
    conv = {
      id: nuevoId,
      negocio: neg,
      canal: "web",
      claveHilo: `crm-${Date.now()}`,
      remitenteId: entrada.telefono || entrada.correo || nuevoId,
      remitenteNombre: entrada.nombre || "Cliente Web",
      remitenteCorreo: entrada.correo ?? null,
      remitenteTelefono: entrada.telefono ?? null,
      usuarioId: entrada.usuarioId ?? null,
      clienteId: entrada.clienteId ?? null,
      estadoAtencion: "EN_ATENCION_ASESORA",
      ultimoMensajeTexto: entrada.contextoOrden || "Seguimiento comercial abierto",
      ultimoMensajeOrigen: "SISTEMA",
      ultimoMensajeEn: ahora,
      noLeidosAsesora: 0,
      mensajesClienteConteo: 0,
      mensajesIaConteo: 0,
      mensajesHumanoConteo: 0,
      creadoEn: ahora,
      etiquetasIds: ["etq-seguimiento"],
    };
    almacen.conversaciones.unshift(conv);
    almacen.mensajesPorConversacion[conv.id] = [
      {
        id: `msg-${Date.now()}`,
        origen: "SISTEMA",
        autorNombre: "Ventas",
        contenido: entrada.contextoOrden || "Ficha de seguimiento comercial abierta desde el panel.",
        tipoContenido: entrada.contextoOrden ? "ORDEN_WEB" : "TEXTO",
        estadoEntrega: "ENVIADO",
        creadoEn: ahora,
      },
    ];
    await escribirAlmacenRespaldoCfg(neg, almacen);
  }

  return { ok: true, conversacionId: conv.id };
}

/**
 * Importa las conversaciones previas ejecutadas directamente en la consola de ARIA (/v1/runs)
 * hacia comun_agentes.agc_conversacion y agc_mensaje.
 */
export async function sincronizarHistorialAriaOmnicanalAction(
  negocio: string,
  limite = 80
): Promise<
  | {
      ok: true;
      interaccionesImportadas: number;
      totalConversacionesWhatsApp: number;
    }
  | { ok: false; error: string; requiereTenantKey?: boolean }
> {
  try {
    const neg = normalizarNegocioComercio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquemaComercio.rpc(
      "com_fn_omnicanal_sincronizar_historial_aria",
      {
        p_negocio: neg,
        p_limite: Math.max(10, Math.min(150, Number(limite) || 80)),
      }
    );

    if (error) {
      return {
        ok: false,
        error: esFuncionRpcPendienteMigracion(error.message)
          ? "Ejecuta primero la migración 20261116000003_omnicanal_whatsapp_ycloud_orquestacion_e_historial.sql en el SQL Editor de Supabase."
          : error.message,
      };
    }

    if (!data?.ok) {
      return {
        ok: false,
        error: String(data?.error || "No se pudo sincronizar el historial desde ARIA."),
        requiereTenantKey: Boolean(data?.requiereTenantKey),
      };
    }

    return {
      ok: true,
      interaccionesImportadas: Number(data.interaccionesImportadas) || 0,
      totalConversacionesWhatsApp: Number(data.totalConversacionesWhatsApp) || 0,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al importar historial de ARIA.",
    };
  }
}

const PROMPT_STT_OMNICANAL =
  "Transcribe exactamente en español lo que dice el cliente en esta nota de voz para nuestra tienda. Devuelve ÚNICAMENTE el texto transcrito literal sin comillas ni explicaciones adicionales.";

function extensionDesdeMimeMultimedia(mime: string, respaldo = "bin"): string {
  const m = (mime || "").toLowerCase();
  if (m.includes("ogg") || m.includes("opus")) return "ogg";
  if (m.includes("mpeg") || m.includes("mp3")) return "mp3";
  if (m.includes("mp4") || m.includes("m4a") || m.includes("aac")) return "m4a";
  if (m.includes("wav")) return "wav";
  if (m.includes("webm")) return "webm";
  if (m.includes("pdf")) return "pdf";
  if (m.includes("wordprocessingml")) return "docx";
  if (m.includes("msword")) return "doc";
  if (m.includes("spreadsheetml")) return "xlsx";
  if (m.includes("ms-excel")) return "xls";
  if (m.includes("csv")) return "csv";
  if (m.includes("plain")) return "txt";
  if (m.includes("png")) return "png";
  if (m.includes("webp")) return "webp";
  if (m.includes("jpeg") || m.includes("jpg")) return "jpg";
  return respaldo;
}

/**
 * Transcribe audio usando variables de entorno del servidor si están configuradas
 * (GEMINI_API_KEY, GOOGLE_GENERATIVE_AI_API_KEY, GROQ_API_KEY, OPENAI_API_KEY).
 * Si no están configuradas, devuelve `null` para que PostgreSQL use la clave cifrada en Vault.
 */
async function transcribirAudioConEnvOpcional(
  bytes: Buffer,
  mimeType: string
): Promise<string | null> {
  const mimeLimpio = (mimeType || "audio/ogg").split(";")[0]!.trim().toLowerCase() || "audio/ogg";

  const geminiKey = (
    process.env.GEMINI_API_KEY ||
    process.env.GOOGLE_GENERATIVE_AI_API_KEY ||
    ""
  ).trim();
  if (geminiKey) {
    try {
      const b64 = bytes.toString("base64");
      for (const modelo of ["gemini-2.5-flash", "gemini-2.0-flash"]) {
        const resp = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent?key=${encodeURIComponent(geminiKey)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: [
                {
                  parts: [
                    { text: PROMPT_STT_OMNICANAL },
                    { inline_data: { mime_type: mimeLimpio, data: b64 } },
                  ],
                },
              ],
            }),
            signal: AbortSignal.timeout(35000),
          }
        );
        if (resp.ok) {
          const j: any = await resp.json().catch(() => null);
          const txt = String(j?.candidates?.[0]?.content?.parts?.[0]?.text || "").trim();
          if (txt) return txt;
        }
      }
    } catch {
      // Continuar al siguiente proveedor si falla
    }
  }

  const groqKey = (process.env.GROQ_API_KEY || "").trim();
  if (groqKey) {
    try {
      const ext = extensionDesdeMimeMultimedia(mimeLimpio, "ogg");
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(bytes)], { type: mimeLimpio }),
        `nota-voz.${ext}`
      );
      fd.append("model", "whisper-large-v3-turbo");
      fd.append("language", "es");
      const resp = await fetch("https://api.groq.com/openai/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${groqKey}` },
        body: fd,
        signal: AbortSignal.timeout(35000),
      });
      if (resp.ok) {
        const j: any = await resp.json().catch(() => null);
        const txt = String(j?.text || "").trim();
        if (txt) return txt;
      }
    } catch {
      // Continuar
    }
  }

  const openaiKey = (process.env.OPENAI_API_KEY || "").trim();
  if (openaiKey) {
    try {
      const ext = extensionDesdeMimeMultimedia(mimeLimpio, "ogg");
      const fd = new FormData();
      fd.append(
        "file",
        new Blob([new Uint8Array(bytes)], { type: mimeLimpio }),
        `nota-voz.${ext}`
      );
      fd.append("model", "whisper-1");
      fd.append("language", "es");
      const resp = await fetch("https://api.openai.com/v1/audio/transcriptions", {
        method: "POST",
        headers: { Authorization: `Bearer ${openaiKey}` },
        body: fd,
        signal: AbortSignal.timeout(35000),
      });
      if (resp.ok) {
        const j: any = await resp.json().catch(() => null);
        const txt = String(j?.text || "").trim();
        if (txt) return txt;
      }
    } catch {
      // Continuar
    }
  }

  return null;
}

/**
 * Procesa un evento de Webhook entrante desde YCloud (WhatsApp Business API v2),
 * espeja multimedia (imágenes, audios/notas de voz, documentos), transcribe notas de voz
 * como `NOTA_INTERNA`, emite broadcast en tiempo real hacia `/panel/conversaciones`
 * y delega la respuesta a Mía (ARIA) salvo cuando una asesora humana haya pulsado `Tomar Control`.
 */
export async function procesarWebhookYcloudOmnicanalAction(entrada: {
  token: string;
  firmaHeader?: string | null;
  cuerpoRaw: string;
  payload: Record<string, unknown>;
  origenTiendaUrl?: string;
}): Promise<{ ok: boolean; status: number; accion?: string; error?: string }> {
  try {
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase: any = crearClienteAdmin() ?? (await crearClienteServidor());
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const { data: rec, error: errRec } = await esquemaComercio.rpc(
      "com_fn_omnicanal_procesar_webhook_ycloud",
      {
        p_token: entrada.token,
        p_firma: entrada.firmaHeader ?? null,
        p_cuerpo_raw: entrada.cuerpoRaw,
        p_payload: entrada.payload,
      }
    );

    if (errRec) {
      return { ok: false, status: 500, error: errRec.message };
    }
    if (!rec?.ok) {
      return {
        ok: false,
        status: Number(rec?.status) || 401,
        error: String(rec?.error || "Webhook no autorizado"),
      };
    }

    const accion = String(rec.accion || "OK");
    const negocio = String(rec.negocio || "tinkay");
    const inboundWa: any =
      (entrada.payload as any)?.whatsappInboundMessage ??
      (entrada.payload as any)?.whatsappMessage ??
      null;
    const {
      construirBloqueReferralWhatsappParaAria,
      etiquetaIntencionLegible,
      extraerReferralMetaDePayloadYcloud,
    } = await import("./marketing-meta");
    const referralMeta = extraerReferralMetaDePayloadYcloud(entrada.payload);

    let imagenUrlCliente: string | null = rec.imagenUrl ? String(rec.imagenUrl) : null;
    let audioUrlCliente: string | null = rec.audioUrl
      ? String(rec.audioUrl)
      : inboundWa?.audio?.link || inboundWa?.voice?.link || null;
    let audioMimeCliente: string | null = rec.audioMime
      ? String(rec.audioMime)
      : inboundWa?.audio?.mime_type || inboundWa?.voice?.mime_type || null;
    let documentoUrlCliente: string | null = rec.documentoUrl
      ? String(rec.documentoUrl)
      : inboundWa?.document?.link || null;
    const documentoNombreCliente: string | null = rec.documentoNombre
      ? String(rec.documentoNombre)
      : inboundWa?.document?.filename || null;
    let contenidoCliente = String(rec.contenido || "");

    let bytesAudioDescargados: Buffer | null = null;
    const adminClient: any = crearClienteAdmin();

    // 1. Espejado permanente de imagen entrante en comun-publico si adminClient está disponible
    if (imagenUrlCliente && rec.mensajeId && adminClient) {
      try {
        const respImg = await fetch(imagenUrlCliente, {
          headers: { Accept: "image/*,*/*;q=0.8" },
          signal: AbortSignal.timeout(15000),
        });
        if (respImg.ok) {
          const mime = (respImg.headers.get("content-type") || "image/jpeg")
            .split(";")[0]!
            .trim();
          if (mime.startsWith("image/")) {
            const ext = extensionDesdeMimeMultimedia(mime, "jpg");
            const rutaStorage = `omnicanal-media/${negocio}/${rec.mensajeId}.${ext}`;
            const bytes = Buffer.from(await respImg.arrayBuffer());
            const { error: errUp } = await adminClient.storage
              .from("comun-publico")
              .upload(rutaStorage, bytes, { contentType: mime, upsert: true });
            if (!errUp) {
              const { data: pub } = adminClient.storage
                .from("comun-publico")
                .getPublicUrl(rutaStorage);
              if (pub?.publicUrl) {
                await esquemaComercio.rpc("com_fn_omnicanal_actualizar_imagen_mensaje", {
                  p_token: entrada.token,
                  p_mensaje_id: rec.mensajeId,
                  p_imagen_publica_url: pub.publicUrl,
                });
                contenidoCliente = contenidoCliente.split(imagenUrlCliente).join(pub.publicUrl);
                imagenUrlCliente = pub.publicUrl;
              }
            }
          }
        }
      } catch {
        // Mantener URL original de YCloud
      }
    }

    // 2. Descargar audio entrante (para transcripción + espejado permanente en comun-publico)
    if (audioUrlCliente) {
      try {
        const respAud = await fetch(audioUrlCliente, {
          headers: { Accept: "audio/*,video/ogg,application/ogg,*/*;q=0.8" },
          signal: AbortSignal.timeout(20000),
        });
        if (respAud.ok) {
          const mimeResp = (
            respAud.headers.get("content-type") ||
            audioMimeCliente ||
            "audio/ogg"
          )
            .split(";")[0]!
            .trim();
          const buf = Buffer.from(await respAud.arrayBuffer());
          if (buf.byteLength > 0 && buf.byteLength <= 10 * 1024 * 1024) {
            bytesAudioDescargados = buf;
            audioMimeCliente = mimeResp;
            if (adminClient && rec.mensajeId) {
              const ext = extensionDesdeMimeMultimedia(mimeResp, "ogg");
              const rutaStorage = `omnicanal-media/${negocio}/${rec.mensajeId}.${ext}`;
              const { error: errUpAud } = await adminClient.storage
                .from("comun-publico")
                .upload(rutaStorage, buf, { contentType: mimeResp, upsert: true });
              if (!errUpAud) {
                const { data: pubAud } = adminClient.storage
                  .from("comun-publico")
                  .getPublicUrl(rutaStorage);
                if (pubAud?.publicUrl) {
                  await esquemaComercio
                    .rpc("com_fn_omnicanal_actualizar_media_mensaje", {
                      p_token: entrada.token,
                      p_mensaje_id: rec.mensajeId,
                      p_audio_url: pubAud.publicUrl,
                    })
                    .catch(() => {});
                  audioUrlCliente = pubAud.publicUrl;
                }
              }
            }
          }
        }
      } catch {
        // Mantener URL original de YCloud
      }
    }

    // 3. Espejado permanente de documento entrante en comun-publico si adminClient está disponible
    if (documentoUrlCliente && rec.mensajeId && adminClient) {
      try {
        const respDoc = await fetch(documentoUrlCliente, {
          signal: AbortSignal.timeout(20000),
        });
        if (respDoc.ok) {
          const mimeDoc = (respDoc.headers.get("content-type") || "application/pdf")
            .split(";")[0]!
            .trim();
          const bufDoc = Buffer.from(await respDoc.arrayBuffer());
          if (bufDoc.byteLength > 0 && bufDoc.byteLength <= 15 * 1024 * 1024) {
            const extDoc = extensionDesdeMimeMultimedia(mimeDoc, "pdf");
            const rutaStorage = `omnicanal-media/${negocio}/${rec.mensajeId}.${extDoc}`;
            const { error: errUpDoc } = await adminClient.storage
              .from("comun-publico")
              .upload(rutaStorage, bufDoc, { contentType: mimeDoc, upsert: true });
            if (!errUpDoc) {
              const { data: pubDoc } = adminClient.storage
                .from("comun-publico")
                .getPublicUrl(rutaStorage);
              if (pubDoc?.publicUrl) {
                await esquemaComercio
                  .rpc("com_fn_omnicanal_actualizar_media_mensaje", {
                    p_token: entrada.token,
                    p_mensaje_id: rec.mensajeId,
                    p_documento_url: pubDoc.publicUrl,
                  })
                  .catch(() => {});
                documentoUrlCliente = pubDoc.publicUrl;
              }
            }
          }
        }
      } catch {
        // Mantener URL original de YCloud
      }
    }

    // 4. Emitir actualización instantánea (<50ms) a la Consola de Ventas en Vivo
    if (
      rec.conversacionId &&
      [
        "INVOCAR_ARIA",
        "SILENCIADO_HUMANO",
        "CANAL_SOLO_MONITOREO",
        "FUERA_LISTA_BLANCA",
        "CORTE_BUCLE_DESPEDIDA",
        "ECO_MOVIL_REGISTRADO",
      ].includes(accion)
    ) {
      const eventoEntrada: EventoBroadcastChatWeb = {
        eventoId: String(rec.mensajeId || `wa-in-${Date.now()}`),
        claveHilo: String(rec.claveHilo || ""),
        conversacionId: String(rec.conversacionId),
        canal: "whatsapp",
        fase: accion === "ECO_MOVIL_REGISTRADO" ? "INTERVENCION_HUMANA" : "ENTRADA_CLIENTE",
        contenido: contenidoCliente,
        imagenUrl: imagenUrlCliente,
        audioUrl: audioUrlCliente,
        audioMime: audioMimeCliente,
        documentoUrl: documentoUrlCliente,
        documentoNombre: documentoNombreCliente,
        autorNombre:
          accion === "ECO_MOVIL_REGISTRADO"
            ? "WhatsApp Móvil Tienda"
            : String(rec.remitenteNombre || "Cliente WhatsApp"),
        remitenteNombre: String(rec.remitenteNombre || "Cliente WhatsApp"),
        remitenteTelefono: rec.remitenteTelefono ? String(rec.remitenteTelefono) : null,
        estadoAtencion: (rec.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
        creadoEn: new Date().toISOString(),
      };
      await emitirBroadcastServidorOmnicanal(
        supabase,
        negocio,
        "actividad_chat_web",
        eventoEntrada as unknown as Record<string, unknown>
      );

      if (accion !== "ECO_MOVIL_REGISTRADO") {
        const convIdWa = String(rec.conversacionId);
        const msgIdWa = String(rec.mensajeId || Date.now());
        const remitenteWa = String(rec.remitenteNombre || "Cliente WhatsApp");
        const resumenWa = contenidoCliente
          .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "Imagen")
          .slice(0, 150);
        await despacharPushYCampanaStaffOmnicanal({
          supabase,
          negocio,
          tokenWebhook: entrada.token,
          soloVentas: true,
          titulo: `${remitenteWa} · WhatsApp`,
          cuerpoPlano: resumenWa || "Nuevo mensaje recibido",
          contenidoHtml: `<p><strong>${remitenteWa}:</strong> ${resumenWa || "Nuevo mensaje recibido"}</p>`,
          tag: `wa-conv-${convIdWa}`,
          claveRefBase: `msg-wa-${msgIdWa}`,
          resolverUrlPorRol: () =>
            `/panel/conversaciones?chat=${encodeURIComponent(convIdWa)}&msg=${encodeURIComponent(msgIdWa)}`,
        });
      }
    }

    // 5. Si el cliente envió una NOTA DE VOZ / AUDIO, escucharla y guardar su transcripción como "NOTA_INTERNA"
    let transcripcionNotaVoz: string | null = null;
    if (
      audioUrlCliente &&
      rec.conversacionId &&
      accion !== "ECO_MOVIL_REGISTRADO" &&
      bytesAudioDescargados &&
      bytesAudioDescargados.byteLength <= 8 * 1024 * 1024
    ) {
      try {
        const textoEnv = await transcribirAudioConEnvOpcional(
          bytesAudioDescargados,
          audioMimeCliente || "audio/ogg"
        );
        const audioBase64 = textoEnv ? null : bytesAudioDescargados.toString("base64");
        const { data: resStt } = await esquemaComercio.rpc(
          "com_fn_omnicanal_transcribir_y_guardar_nota_voz",
          {
            p_negocio: negocio,
            p_conversacion_id: rec.conversacionId,
            p_mensaje_audio_id: rec.mensajeId ?? null,
            p_audio_base64: audioBase64,
            p_mime_type: audioMimeCliente || "audio/ogg",
            p_transcripcion_precalculada: textoEnv,
            p_token_webhook: entrada.token,
          }
        );

        if (resStt?.ok && resStt.transcripcion) {
          transcripcionNotaVoz = String(resStt.transcripcion).trim();
          const notaInternaMsg = resStt.notaInterna as MensajeOmnicanal | undefined;
          const eventoNotaVoz: EventoBroadcastChatWeb = {
            eventoId: String(notaInternaMsg?.id || `stt-${Date.now()}`),
            claveHilo: String(rec.claveHilo || ""),
            conversacionId: String(rec.conversacionId),
            canal: "whatsapp",
            fase: "NOTA_INTERNA",
            contenido:
              notaInternaMsg?.contenido ||
              `🎙️ Transcripción de nota de voz: «${transcripcionNotaVoz}»`,
            autorNombre: notaInternaMsg?.autorNombre || "ARIA · Transcripción de Voz",
            remitenteNombre: String(rec.remitenteNombre || "Cliente WhatsApp"),
            remitenteTelefono: rec.remitenteTelefono ? String(rec.remitenteTelefono) : null,
            estadoAtencion: (rec.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
            creadoEn: notaInternaMsg?.creadoEn || new Date().toISOString(),
          };
          await emitirBroadcastServidorOmnicanal(
            supabase,
            negocio,
            "actividad_chat_web",
            eventoNotaVoz as unknown as Record<string, unknown>
          );
        }
      } catch {
        // Si aún no se configuró clave STT o migración 20261117000005, continuar sin bloquear webhook
      }
    }

    // 5.5. Puente Bidireccional Web -> WhatsApp: si el mensaje trae código `TNK-XXXXXX`, vincular identidad y producto visto en la web
    let bloquePuenteWeb = "";
    const textoBrutoEntrante = String(rec.caption || contenidoCliente || transcripcionNotaVoz || "");
    const codigoRefWebDetectado = extraerCodigoRefWebDeTexto(textoBrutoEntrante);
    if (codigoRefWebDetectado && rec.conversacionId && accion !== "ECO_MOVIL_REGISTRADO") {
      try {
        const ctxPuente = await vincularConversacionWhatsappConRefWebInterno({
          supabase,
          negocio,
          conversacionWhatsappId: String(rec.conversacionId),
          claveHiloWhatsapp: String(rec.claveHilo || ""),
          telefonoCliente: String(rec.remitenteTelefono || ""),
          refWeb: codigoRefWebDetectado,
        });
        if (ctxPuente?.bloquePromptAria) {
          bloquePuenteWeb = ctxPuente.bloquePromptAria;
        }
      } catch {
        // Nunca bloquear webhook por enlace auxiliar
      }
    }

    if (accion !== "INVOCAR_ARIA") {
      return { ok: true, status: 200, accion };
    }

    // Construir prompt para Mía (ARIA) con el formato exacto de WhatsApp + Entrega Inmediata + Cotización GPS
    const tel = String(rec.remitenteTelefono || "");
    const nombreCorto = String(rec.remitenteNombre || "Cliente").slice(0, 48);
    const wrefActual = rec.conversacionId
      ? generarCodigoRefWhatsapp(String(rec.conversacionId))
      : null;
    const sufijoWref = wrefActual ? `?wref=${encodeURIComponent(wrefActual)}` : "";
    const textoCliente = transcripcionNotaVoz
      ? `[NOTA DE VOZ ENVIADA POR EL CLIENTE — TRANSCRIPCIÓN]: ${transcripcionNotaVoz}`
      : audioUrlCliente
        ? `[SISTEMA: El cliente acaba de enviar una nota de voz de audio por WhatsApp pero la transcripción automática aún no pudo ejecutarse. Pídele con mucha calidez en 1 línea si te puede escribir brevemente su consulta o indícale que una asesora escuchará su audio enseguida.]`
        : String(rec.caption || contenidoCliente || "");
    const origenTienda = (entrada.origenTiendaUrl || "https://tinkay-web.vercel.app").replace(
      /\/+$/,
      ""
    );

    const encabezadoUsuario = `[USUARIO ACTUAL: chat_id=${tel} | canal=whatsapp | nombre_corto=${nombreCorto}]`;

    let bloqueInmediata = "";
    try {
      const { listarEntregaInmediataAction } = await import("./acciones-operaciones-taller");
      const resInm = await listarEntregaInmediataAction(negocio, false);
      if (resInm.ok && resInm.items.length > 0) {
        const lista = resInm.items
          .slice(0, 6)
          .map(
            (i) =>
              `"${i.nombre}" a $${Number(i.precio).toFixed(2)} USD (${i.tiempoEntregaTexto}${
                i.imagenUrl && /^https?:\/\//i.test(i.imagenUrl)
                  ? `, foto markdown para adjuntar: ![${i.nombre}](${i.imagenUrl})`
                  : ""
              }, link tienda: ${origenTienda}/producto/${i.slug}${sufijoWref})`
          )
          .join("; ");
        bloqueInmediata = `\n[ARREGLOS LISTOS EN TIENDA PARA ENTREGA INMEDIATA 1-2h: ${lista}. Cuando recomiendes uno en WhatsApp incluye su foto markdown ![Nombre](url) para que el cliente vea la fotografía real. Catálogo inmediato: ${origenTienda}/categoria/entrega-inmediata${sufijoWref}]`;
      }
    } catch {
      // Ignorar
    }

    let bloqueCotizacionGps = "";
    try {
      const { cotizarEnvioDesdeEntradaAction } = await import("./acciones-logistica");
      const { extraerCoordenadasDeTextoOUrl, extraerPrimeraUrlDeTexto } = await import(
        "./logistica"
      );
      const latPin = rec.latitud != null ? Number(rec.latitud) : null;
      const lngPin = rec.longitud != null ? Number(rec.longitud) : null;
      const urlMapa = extraerPrimeraUrlDeTexto(textoCliente);
      const tieneMapa =
        (latPin != null && lngPin != null && !Number.isNaN(latPin) && !Number.isNaN(lngPin)) ||
        Boolean(
          urlMapa &&
            /(maps\.app\.goo\.gl|goo\.gl\/maps|google\.[a-z.]+\/maps|maps\.google|waze\.com)/i.test(
              urlMapa
            )
        ) ||
        Boolean(extraerCoordenadasDeTextoOUrl(textoCliente));

      if (tieneMapa) {
        const entradaUbicacion =
          latPin != null && lngPin != null && !Number.isNaN(latPin) && !Number.isNaN(lngPin)
            ? `${latPin},${lngPin}`
            : urlMapa ?? textoCliente;
        const cot = await cotizarEnvioDesdeEntradaAction({
          negocio,
          enlaceOTexto: entradaUbicacion,
        });
        if (cot.ok) {
          const c = cot.cotizacion;
          const dirRef = c.detalleDireccion?.resumenDireccion || cot.direccionDetectada || "Pin GPS verificado";
          bloqueCotizacionGps = `\n[COTIZACIÓN OFICIAL DE ENVÍO CALCULADA POR SISTEMA: ${c.etiquetaResumen}. Costo final de envío: $${c.costoTotalEnvio.toFixed(2)} USD. Dirección referencial: ${dirRef}. Usa exactamente este costo final al responder al cliente.]`;

          // Auto-poblar los Campos de Venta de la conversación con la ubicación y envío detectados
          const linkGuardar =
            urlMapa ||
            (latPin != null && lngPin != null
              ? `https://www.google.com/maps?q=${latPin},${lngPin}`
              : null);
          await esquemaComercio
            .rpc("com_fn_omnicanal_fusionar_datos_venta_webhook", {
              p_token: entrada.token,
              p_conversacion_id: rec.conversacionId,
              p_parcial: {
                ubicacionUrl: linkGuardar,
                costoEnvio: c.costoTotalEnvio,
                sector: c.zonaDetectada?.nombre || c.detalleDireccion?.parroquia || c.etiquetaResumen,
                direccionReferencia: dirRef,
              },
            })
            .catch(() => {});
        }
      }
    } catch {
      // Ignorar si la cotización tarda
    }

    const bloqueReferralMeta = construirBloqueReferralWhatsappParaAria(referralMeta);
    if (referralMeta && rec.conversacionId) {
      const resumenRef = [
        `📢 Meta Ads (${etiquetaIntencionLegible(referralMeta.intencionDetectada)})`,
        referralMeta.headline ? `"${referralMeta.headline}"` : null,
        referralMeta.ctwaClid ? `CTWA: ${referralMeta.ctwaClid.slice(0, 18)}…` : null,
      ]
        .filter(Boolean)
        .join(" · ");
      await emitirBroadcastServidorOmnicanal(supabase, negocio, "actividad_chat_web", {
        eventoId: `ref-meta-${rec.mensajeId || Date.now()}`,
        claveHilo: String(rec.claveHilo || ""),
        conversacionId: String(rec.conversacionId),
        canal: "whatsapp",
        fase: "NOTA_INTERNA",
        contenido: resumenRef,
        autorNombre: "Atribución Meta Ads",
        remitenteNombre: String(rec.remitenteNombre || "Cliente WhatsApp"),
        remitenteTelefono: tel || null,
        estadoAtencion: (rec.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
        creadoEn: new Date().toISOString(),
      });
    }

    const promptCompleto =
      `${encabezadoUsuario}${bloqueReferralMeta}${bloquePuenteWeb}\n${textoCliente}\n\n` +
      `[ENLACES DIRECTOS E-COMMERCE TINKAY: Categorías ${origenTienda}/categoria/{slug}${sufijoWref}, Entrega Inmediata ${origenTienda}/categoria/entrega-inmediata${sufijoWref}, Producto ${origenTienda}/producto/{slug}${sufijoWref}]` +
      bloqueInmediata +
      bloqueCotizacionGps;

    const { data: resAria } = await esquemaComercio.rpc(
      "com_fn_omnicanal_responder_whatsapp_con_aria",
      {
        p_token: entrada.token,
        p_conversacion_id: rec.conversacionId,
        p_prompt: promptCompleto,
        p_imagen_url: imagenUrlCliente,
      }
    );

    if (resAria?.ok && !resAria?.silenciado && resAria?.respuestaAria) {
      const eventoBot: EventoBroadcastChatWeb = {
        eventoId: String(resAria.mensajeId || `wa-bot-${Date.now()}`),
        claveHilo: String(resAria.claveHilo || rec.claveHilo || ""),
        conversacionId: String(resAria.conversacionId || rec.conversacionId),
        canal: "whatsapp",
        fase: "RESPUESTA_ARIA",
        contenido: String(resAria.respuestaAria),
        imagenesUrls: Array.isArray(resAria.imagenesUrls)
          ? resAria.imagenesUrls.map((u: unknown) => String(u))
          : undefined,
        autorNombre: String(resAria.autorNombre || "Mía · ARIA"),
        remitenteNombre: String(rec.remitenteNombre || "Cliente WhatsApp"),
        remitenteTelefono: tel || null,
        estadoAtencion: (resAria.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
        creadoEn: new Date().toISOString(),
      };
      await emitirBroadcastServidorOmnicanal(
        supabase,
        negocio,
        "actividad_chat_web",
        eventoBot as unknown as Record<string, unknown>
      );
    }

    return { ok: true, status: 200, accion: "RESPONDIDO_ARIA" };
  } catch (err) {
    return {
      ok: false,
      status: 500,
      error: err instanceof Error ? err.message : "Error interno en webhook YCloud",
    };
  }
}

/**
 * Permite que cualquier operador desde `/panel/conversaciones` escuche/transcriba bajo demanda
 * una nota de voz en una `NOTA_INTERNA` y, si lo solicita, haga que Mía (ARIA) responda al cliente.
 */
export async function transcribirYResponderNotaVozOmnicanalAction(entrada: {
  negocio: string;
  conversacionId: string;
  mensajeAudioId?: string | null;
  audioUrl: string;
  mimeType?: string | null;
  remitenteNombre?: string | null;
  remitenteTelefono?: string | null;
  claveHilo?: string | null;
  responderConAria?: boolean;
  origenTiendaUrl?: string | null;
}): Promise<
  | {
      ok: true;
      transcripcion: string;
      notaInterna: MensajeOmnicanal;
      mensajeAria?: MensajeOmnicanal | null;
    }
  | { ok: false; error: string; requiereClaveStt?: boolean }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const urlAudio = (entrada.audioUrl || "").trim();
    if (!urlAudio || !/^https?:\/\//i.test(urlAudio)) {
      return { ok: false, error: "Este mensaje de voz no tiene una URL de audio descargable." };
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const respAudio = await fetch(urlAudio, {
      headers: { Accept: "audio/*,video/ogg,application/ogg,*/*;q=0.8" },
      signal: AbortSignal.timeout(25000),
    });
    if (!respAudio.ok) {
      return {
        ok: false,
        error: `No se pudo descargar la nota de voz (HTTP ${respAudio.status}). Es posible que el enlace temporal haya expirado.`,
      };
    }

    const mimeEfectivo = (
      respAudio.headers.get("content-type") ||
      entrada.mimeType ||
      "audio/ogg"
    )
      .split(";")[0]!
      .trim();
    const bytes = Buffer.from(await respAudio.arrayBuffer());
    if (bytes.byteLength === 0 || bytes.byteLength > 8 * 1024 * 1024) {
      return { ok: false, error: "El archivo de audio está vacío o supera los 8 MB permitidos." };
    }

    const textoEnv = await transcribirAudioConEnvOpcional(bytes, mimeEfectivo);
    const audioBase64 = textoEnv ? null : bytes.toString("base64");

    const { data: resStt, error: errStt } = await esquemaComercio.rpc(
      "com_fn_omnicanal_transcribir_y_guardar_nota_voz",
      {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_mensaje_audio_id:
          entrada.mensajeAudioId && /^[0-9a-f-]{36}$/i.test(entrada.mensajeAudioId)
            ? entrada.mensajeAudioId
            : null,
        p_audio_base64: audioBase64,
        p_mime_type: mimeEfectivo,
        p_transcripcion_precalculada: textoEnv,
        p_token_webhook: null,
      }
    );

    let transcripcionFinal = "";
    let notaInternaFinal: MensajeOmnicanal | null = null;

    if (!errStt && resStt?.ok) {
      transcripcionFinal = String(resStt.transcripcion || "").trim();
      notaInternaFinal = resStt.notaInterna as MensajeOmnicanal;
    } else if (errStt && esFuncionRpcPendienteMigracion(errStt.message) && textoEnv) {
      // Si la migración 20261117000005 aún no se ha corrido pero el servidor ya transcribió con env
      const resNotaFallback = await enviarMensajeAsesorOmnicanalAction({
        negocio: neg,
        conversacionId: entrada.conversacionId,
        contenido: `🎙️ Transcripción de nota de voz: «${textoEnv}»`,
        esNotaInterna: true,
      });
      if (!resNotaFallback.ok) {
        return { ok: false, error: resNotaFallback.error };
      }
      transcripcionFinal = textoEnv;
      notaInternaFinal = resNotaFallback.mensaje;
    } else {
      const msgErr = errStt
        ? esFuncionRpcPendienteMigracion(errStt.message)
          ? "Ejecuta primero la migración 20261117000005_omnicanal_audio_transcripcion_adjuntos_y_catalogo.sql en el SQL Editor de Supabase y guarda tu clave IA de voz en /panel/aria."
          : errStt.message
        : String(resStt?.error || "No se pudo transcribir la nota de voz.");
      return {
        ok: false,
        error: msgErr,
        requiereClaveStt: Boolean(resStt?.requiereClaveStt),
      };
    }

    if (!notaInternaFinal || !transcripcionFinal) {
      return { ok: false, error: "No se obtuvo transcripción válida del audio." };
    }

    await emitirBroadcastServidorOmnicanal(supabase, neg, "actividad_chat_web", {
      eventoId: notaInternaFinal.id,
      claveHilo: entrada.claveHilo || "",
      conversacionId: entrada.conversacionId,
      fase: "NOTA_INTERNA",
      contenido: notaInternaFinal.contenido,
      autorNombre: notaInternaFinal.autorNombre || "ARIA · Transcripción de Voz",
      creadoEn: notaInternaFinal.creadoEn,
    });

    let mensajeAria: MensajeOmnicanal | null = null;

    if (entrada.responderConAria) {
      const tel = String(entrada.remitenteTelefono || "");
      const nombreCorto = String(entrada.remitenteNombre || "Cliente").slice(0, 48);
      const origenTienda = (entrada.origenTiendaUrl || "https://tinkay-web.vercel.app").replace(
        /\/+$/,
        ""
      );
      const promptPanel =
        `[USUARIO ACTUAL: chat_id=${tel || entrada.conversacionId} | canal=whatsapp | nombre_corto=${nombreCorto}]\n` +
        `[NOTA DE VOZ ENVIADA POR EL CLIENTE — TRANSCRIPCIÓN]: ${transcripcionFinal}\n\n` +
        `[ENLACES DIRECTOS E-COMMERCE TINKAY: Categorías ${origenTienda}/categoria/{slug}, Entrega Inmediata ${origenTienda}/categoria/entrega-inmediata, Producto ${origenTienda}/producto/{slug}]`;

      const { data: resAriaPanel, error: errAriaPanel } = await esquemaComercio.rpc(
        "com_fn_omnicanal_responder_con_aria_panel",
        {
          p_negocio: neg,
          p_conversacion_id: entrada.conversacionId,
          p_prompt: promptPanel,
        }
      );

      if (!errAriaPanel && resAriaPanel?.ok && resAriaPanel.mensaje) {
        mensajeAria = resAriaPanel.mensaje as MensajeOmnicanal;
        await emitirBroadcastServidorOmnicanal(supabase, neg, "actividad_chat_web", {
          eventoId: mensajeAria.id,
          claveHilo: entrada.claveHilo || "",
          conversacionId: entrada.conversacionId,
          fase: "RESPUESTA_ARIA",
          contenido: mensajeAria.contenido,
          autorNombre: mensajeAria.autorNombre || "Mía · ARIA",
          creadoEn: mensajeAria.creadoEn,
        });
      } else if (errAriaPanel && esFuncionRpcPendienteMigracion(errAriaPanel.message)) {
        const { invocarAgentePorNegocio } = await import("@eco/agentes-ia");
        const inv = await invocarAgentePorNegocio(neg, promptPanel, {
          conversationId: `wa-${(tel || entrada.conversacionId).replace(/[^A-Za-z0-9_-]/g, "")}`,
          tiempoMaximoMs: 45000,
        });
        if (inv.response?.trim()) {
          const envioFallback = await enviarMensajeAsesorOmnicanalAction({
            negocio: neg,
            conversacionId: entrada.conversacionId,
            contenido: inv.response.trim(),
            esNotaInterna: false,
          });
          if (envioFallback.ok) {
            mensajeAria = envioFallback.mensaje;
          }
        }
      } else if (errAriaPanel || resAriaPanel?.ok === false) {
        return {
          ok: false,
          error: String(
            errAriaPanel?.message || resAriaPanel?.error || "ARIA no pudo enviar la respuesta."
          ),
        };
      }
    }

    return {
      ok: true,
      transcripcion: transcripcionFinal,
      notaInterna: notaInternaFinal,
      mensajeAria,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al procesar la nota de voz.",
    };
  }
}

export interface DatosSalaChatEquipo {
  conversacionId: string;
  sala: string;
  nombreSala: string;
  usuarioActual: {
    usuarioId: string;
    nombre: string;
    handle: string;
    rol: string;
  };
  miembros: MiembroChatEquipo[];
  mensajes: MensajeChatEquipo[];
  conversacionesWhatsapp: ConversacionWhatsappResumen[];
  migracionPendiente?: boolean;
}

export async function obtenerSalaChatEquipoAction(
  negocio: string,
  sala = "equipo-general"
): Promise<{ ok: true; datos: DatosSalaChatEquipo } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquemaComercio.rpc("com_fn_chat_equipo_obtener_sala", {
      p_negocio: neg,
      p_sala: sala,
    });

    if (error) {
      if (esFuncionRpcPendienteMigracion(error.message) || error.message.includes("com_fn_chat_equipo_")) {
        return {
          ok: false,
          error:
            "Ejecuta la migración 20261116000005_omnicanal_visor_imagenes_y_chat_grupal_equipo.sql en el SQL Editor de Supabase para activar el Chat Grupal del Equipo.",
        };
      }
      return { ok: false, error: error.message };
    }

    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "Sin acceso al chat del equipo.") };
    }

    return {
      ok: true,
      datos: {
        conversacionId: String(data.conversacionId),
        sala: String(data.sala || sala),
        nombreSala: String(data.nombreSala || "Chat del Equipo"),
        usuarioActual: {
          usuarioId: String(data.usuarioActual?.usuarioId || ""),
          nombre: String(data.usuarioActual?.nombre || "Equipo"),
          handle: String(data.usuarioActual?.handle || "equipo"),
          rol: String(data.usuarioActual?.rol || "OPERADOR"),
        },
        miembros: Array.isArray(data.miembros) ? (data.miembros as MiembroChatEquipo[]) : [],
        mensajes: Array.isArray(data.mensajes) ? (data.mensajes as MensajeChatEquipo[]) : [],
        conversacionesWhatsapp: Array.isArray(data.conversacionesWhatsapp)
          ? (data.conversacionesWhatsapp as ConversacionWhatsappResumen[])
          : [],
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando el chat del equipo.",
    };
  }
}

export interface PedidoCreadoDesdeChatEquipo {
  ordenId: string;
  codigo: string;
  estado: string;
  productoResumen: string;
  clasificacionPedido: string;
  faltantes: string[];
}

export async function enviarMensajeChatEquipoAction(entrada: {
  negocio: string;
  contenido: string;
  imagenUrl?: string | null;
  respuestaA?: CitaRespuestaChatEquipo | null;
  reenviadoDe?: ContextoReenvioChatEquipo | null;
  sala?: string;
}): Promise<
  | {
      ok: true;
      mensaje: MensajeChatEquipo;
      mencionadosUsuariosIds: string[];
      handlesMencionados: string[];
      pedidoCreado?: PedidoCreadoDesdeChatEquipo | null;
      avisoPedidoError?: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const sala = entrada.sala || "equipo-general";
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquemaComercio.rpc("com_fn_chat_equipo_enviar_mensaje", {
      p_negocio: neg,
      p_contenido: entrada.contenido,
      p_imagen_url: entrada.imagenUrl ?? null,
      p_respuesta_a: entrada.respuestaA ?? null,
      p_reenviado_de: entrada.reenviadoDe ?? null,
      p_sala: sala,
    });

    if (error) {
      return {
        ok: false,
        error:
          error.message.includes("com_fn_chat_equipo_") || esFuncionRpcPendienteMigracion(error.message)
            ? "Ejecuta primero la migración 20261116000005_omnicanal_visor_imagenes_y_chat_grupal_equipo.sql en Supabase."
            : error.message,
      };
    }

    if (!data?.ok || !data?.mensaje) {
      return { ok: false, error: String(data?.error || "No se pudo enviar el mensaje.") };
    }

    const mensaje = data.mensaje as MensajeChatEquipo;
    const mencionadosIds: string[] = Array.isArray(data.mencionadosUsuariosIds)
      ? data.mencionadosUsuariosIds.map((u: unknown) => String(u)).filter(Boolean)
      : [];
    const handles: string[] = Array.isArray(data.handlesMencionados)
      ? data.handlesMencionados.map((h: unknown) => String(h)).filter(Boolean)
      : [];

    // 1. Emitir broadcast en tiempo real (<50ms) a toda la sala del equipo
    try {
      const canalEq = (supabase as any).channel(nombreCanalRealtimeChatEquipo(neg));
      const payloadEq: EventoBroadcastChatEquipo = {
        eventoId: mensaje.id,
        sala,
        mensaje,
        mencionadosUsuariosIds: mencionadosIds,
        handlesMencionados: handles,
      };
      await Promise.race([
        canalEq.send({
          type: "broadcast",
          event: "mensaje_equipo",
          payload: payloadEq,
        }),
        new Promise((resolve) => setTimeout(resolve, 1200)),
      ]);
      void (supabase as any).removeChannel?.(canalEq);
    } catch {
      // El cliente también publica en el canal activo
    }

    // 2. Despachar notificación Push estilo WhatsApp + Campana a todo el equipo activo (con acceso directo al Chat Grupal)
    {
      const extracto = String(entrada.contenido || "Imagen compartida")
        .replace(/!\s*\[[^\]]*\]\s*\([^)]+\)/g, "Imagen")
        .slice(0, 180);
      const tieneMenciones = mencionadosIds.length > 0;
      const tituloEquipo = tieneMenciones
        ? `Equipo Tinkay · ${mensaje.autorNombre} (@mención)`
        : `Equipo Tinkay · ${mensaje.autorNombre}`;
      await despacharPushYCampanaStaffOmnicanal({
        supabase,
        negocio: neg,
        excluirUsuarioId: mensaje.autorUsuarioId ?? null,
        soloVentas: false,
        titulo: tituloEquipo,
        cuerpoPlano: extracto,
        contenidoHtml: `<p><strong>${mensaje.autorNombre}:</strong> ${extracto}</p>${
          entrada.reenviadoDe?.clienteNombre
            ? `<p style="font-size:12px;color:#52525B;">Cliente: ${entrada.reenviadoDe.clienteNombre}</p>`
            : ""
        }`,
        tag: `eq-sala-${sala}`,
        claveRefBase: `msg-eq-${mensaje.id}`,
        resolverUrlPorRol: (rol) =>
          ["TALLER", "DELIVERY", "DELIVERY_EXTERNO"].includes(rol.toUpperCase())
            ? `/panel/chat-equipo?msg=${encodeURIComponent(mensaje.id)}`
            : `/panel/conversaciones?pestana=chat_equipo&msg=${encodeURIComponent(mensaje.id)}`,
      });
    }

    // 3. Si el mensaje inicia con "Nuevo Pedido:", ARIA estructura y crea el pedido en "Nuevo - Por Confirmar"
    let pedidoCreado: PedidoCreadoDesdeChatEquipo | null = null;
    let avisoPedidoError: string | null = null;
    const matchNuevoPedido = String(entrada.contenido || "")
      .trim()
      .match(/^nuevo\s+pedido\s*:\s*([\s\S]+)$/i);

    if (matchNuevoPedido && matchNuevoPedido[1]!.trim().length >= 4) {
      try {
        const { crearPedidoDesdeMensajeAriaAction } = await import(
          "./acciones-operaciones-taller"
        );
        const resPed = await crearPedidoDesdeMensajeAriaAction({
          negocio: neg,
          textoMensaje: matchNuevoPedido[1]!.trim(),
        });
        if (resPed.ok) {
          pedidoCreado = {
            ordenId: resPed.ordenId,
            codigo: resPed.codigo,
            estado: "Nuevo - Por Confirmar",
            productoResumen: resPed.datos.productoResumen,
            clasificacionPedido: resPed.datos.clasificacionPedido,
            faltantes: resPed.datos.faltantes,
          };
        } else {
          avisoPedidoError = resPed.error;
        }
      } catch (errPed) {
        avisoPedidoError =
          errPed instanceof Error ? errPed.message : "No se pudo crear el pedido desde el chat.";
      }
    }

    return {
      ok: true,
      mensaje,
      mencionadosUsuariosIds: mencionadosIds,
      handlesMencionados: handles,
      pedidoCreado,
      avisoPedidoError,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando mensaje al equipo.",
    };
  }
}

export async function reenviarMensajeAClienteWhatsappAction(entrada: {
  negocio: string;
  conversacionDestinoId: string;
  texto?: string;
  imagenUrl?: string | null;
  tituloImagen?: string | null;
}): Promise<{ ok: true; avisoWhatsApp?: string | null } | { ok: false; error: string }> {
  const comentario = (entrada.texto || "").trim();
  const img = (entrada.imagenUrl || "").trim();
  const alt = (entrada.tituloImagen || "Imagen").trim().replace(/[\[\]]/g, "");

  if (!comentario && !img) {
    return { ok: false, error: "Selecciona una imagen o escribe un mensaje para reenviar." };
  }

  const cuerpoFinal = img
    ? `${comentario ? `${comentario}\n\n` : ""}![${alt}](${img})`
    : comentario;

  const res = await enviarMensajeAsesorOmnicanalAction({
    negocio: entrada.negocio,
    conversacionId: entrada.conversacionDestinoId,
    contenido: cuerpoFinal,
    esNotaInterna: false,
  });

  if (!res.ok) {
    return { ok: false, error: res.error };
  }

  return { ok: true, avisoWhatsApp: res.avisoWhatsApp };
}

// =============================================================================
// FICHA UNIFICADA DEL CLIENTE (ESTRELLAS + NOTAS + NOMBRE EDITABLE) Y PUENTE
// BIDIRECCIONAL WEB <-> WHATSAPP
// =============================================================================

interface SnapshotPuenteWebCfg {
  refWeb: string;
  claveHiloWeb?: string | null;
  productoNombre?: string | null;
  productoSlug?: string | null;
  varianteNombre?: string | null;
  pvp?: number | null;
  urlPagina?: string | null;
  visitanteNombre?: string | null;
  visitanteCorreo?: string | null;
  visitanteTelefono?: string | null;
  registradoEn: string;
}

function normalizarEstrellasFicha(valor?: number | null): number | null {
  if (valor == null) return null;
  const num = Math.round(Number(valor));
  if (!Number.isFinite(num) || num < 1 || num > 5) return null;
  return num;
}

async function vincularConversacionWhatsappConRefWebInterno(params: {
  supabase: any;
  negocio: string;
  conversacionWhatsappId: string;
  claveHiloWhatsapp: string;
  telefonoCliente: string;
  refWeb: string;
}): Promise<{ bloquePromptAria: string } | null> {
  const { crearClienteAdmin } = await import("@eco/supabase/servidor");
  const adminDb: any = crearClienteAdmin() ?? params.supabase;
  const refWeb = String(params.refWeb || "").trim().toUpperCase();
  if (!refWeb) return null;

  const ahoraIso = new Date().toISOString();

  // 1. Buscar snapshot temporal registrado al pulsar el botón WhatsApp en la Web
  let snap: SnapshotPuenteWebCfg | null = null;
  try {
    const { data: cfgRow } = await adminDb
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", params.negocio)
      .maybeSingle();
    const mapa = (cfgRow?.cfg_detalle_configuracion?.omnicanal_puentes_web ?? {}) as Record<
      string,
      SnapshotPuenteWebCfg
    >;
    if (mapa && mapa[refWeb]) {
      snap = mapa[refWeb] ?? null;
    }
  } catch {
    // Continuar con búsqueda directa en conversaciones Web
  }

  // 2. Buscar conversación Web existente vinculada al mismo `claveHiloWeb` o `refWeb`
  let convWeb: any = null;
  try {
    if (snap?.claveHiloWeb) {
      const { data } = await adminDb
        .schema("comun_agentes")
        .from("agc_conversacion")
        .select(
          "cnv_id, cnv_clave_hilo, cnv_remitente_nombre, cnv_remitente_correo, cnv_remitente_telefono, cnv_usuario_id, cnv_cliente_id, cnv_detalle_conversacion"
        )
        .eq("cnv_negocio", params.negocio)
        .eq("cnv_canal", "web")
        .eq("cnv_clave_hilo", snap.claveHiloWeb)
        .is("cnv_eliminado_en", null)
        .maybeSingle();
      convWeb = data ?? null;
    }
    if (!convWeb) {
      const { data: candidatasWeb } = await adminDb
        .schema("comun_agentes")
        .from("agc_conversacion")
        .select(
          "cnv_id, cnv_clave_hilo, cnv_remitente_nombre, cnv_remitente_correo, cnv_remitente_telefono, cnv_usuario_id, cnv_cliente_id, cnv_detalle_conversacion"
        )
        .eq("cnv_negocio", params.negocio)
        .eq("cnv_canal", "web")
        .is("cnv_eliminado_en", null)
        .order("cnv_ultimo_mensaje_en", { ascending: false })
        .limit(80);
      if (Array.isArray(candidatasWeb)) {
        convWeb =
          candidatasWeb.find((cw: any) => {
            const pRef = cw?.cnv_detalle_conversacion?.puente_omnicanal?.refWeb;
            const genRef = generarCodigoRefVisitanteWeb(String(cw?.cnv_clave_hilo || ""), params.negocio);
            return pRef === refWeb || genRef === refWeb;
          }) ?? null;
      }
    }
  } catch {
    // Ignorar si tabla aún no existe
  }

  // 3. Cargar conversación WhatsApp actual y fusionar puente + ficha + producto de interés
  const { data: convWa } = await adminDb
    .schema("comun_agentes")
    .from("agc_conversacion")
    .select(
      "cnv_id, cnv_remitente_nombre, cnv_remitente_correo, cnv_usuario_id, cnv_cliente_id, cnv_detalle_conversacion"
    )
    .eq("cnv_id", params.conversacionWhatsappId)
    .maybeSingle();

  if (!convWa) return null;

  const detalleWa = (convWa.cnv_detalle_conversacion ?? {}) as Record<string, any>;
  const puentePrevio = (detalleWa.puente_omnicanal ?? {}) as PuenteOmnicanalCliente;
  const yaVinculadoMismoRef = puentePrevio.refWeb === refWeb && Boolean(puentePrevio.vinculadoEn);

  const visitaProducto: RegistroVisitaWebOmnicanal | null =
    snap?.productoNombre || snap?.urlPagina
      ? {
          productoNombre: snap.productoNombre ?? null,
          productoSlug: snap.productoSlug ?? null,
          varianteNombre: snap.varianteNombre ?? null,
          pvp: snap.pvp != null ? Number(snap.pvp) : null,
          urlPagina: snap.urlPagina ?? null,
          vistoEn: snap.registradoEn || ahoraIso,
        }
      : (convWeb?.cnv_detalle_conversacion?.puente_omnicanal?.ultimoProductoVistoWeb ?? null);

  const historialPrevio = Array.isArray(puentePrevio.historialVisitasWeb)
    ? puentePrevio.historialVisitasWeb
    : [];
  const nuevoHistorial = visitaProducto
    ? [
        visitaProducto,
        ...historialPrevio.filter(
          (h) =>
            !(
              h.productoSlug &&
              visitaProducto.productoSlug &&
              h.productoSlug === visitaProducto.productoSlug
            )
        ),
      ].slice(0, 15)
    : historialPrevio;

  const nuevoPuenteWa: PuenteOmnicanalCliente = {
    ...puentePrevio,
    refWeb,
    wref: generarCodigoRefWhatsapp(params.conversacionWhatsappId),
    claveHiloWebVinculado: convWeb?.cnv_clave_hilo ?? snap?.claveHiloWeb ?? puentePrevio.claveHiloWebVinculado ?? null,
    conversacionWebVinculadaId: convWeb?.cnv_id ? String(convWeb.cnv_id) : (puentePrevio.conversacionWebVinculadaId ?? null),
    origenInicial: puentePrevio.origenInicial || "WEB_A_WHATSAPP",
    ultimoProductoVistoWeb: visitaProducto ?? puentePrevio.ultimoProductoVistoWeb ?? null,
    historialVisitasWeb: nuevoHistorial,
    vinculadoEn: puentePrevio.vinculadoEn || ahoraIso,
  };

  const fichaWeb = (convWeb?.cnv_detalle_conversacion?.ficha_cliente ?? null) as FichaClienteOmnicanal | null;
  const fichaWaPrevia = (detalleWa.ficha_cliente ?? null) as FichaClienteOmnicanal | null;
  const fichaCombinada = fichaWaPrevia ?? fichaWeb ?? undefined;

  const datosVentaPrev = (detalleWa.datos_venta ?? {}) as DatosVentaConversacion;
  const datosVentaActualizados: DatosVentaConversacion = {
    ...datosVentaPrev,
    ...(visitaProducto?.productoNombre && !datosVentaPrev.producto
      ? {
          producto: visitaProducto.varianteNombre
            ? `${visitaProducto.productoNombre} (${visitaProducto.varianteNombre})`
            : visitaProducto.productoNombre,
        }
      : {}),
    ...(visitaProducto?.pvp != null && !datosVentaPrev.precioProducto
      ? { precioProducto: Number(visitaProducto.pvp) }
      : {}),
  };

  const nombreWaActual = String(convWa.cnv_remitente_nombre || "");
  const nombreVisitanteCandidato =
    fichaCombinada?.nombrePersonalizado ||
    (convWeb?.cnv_remitente_nombre && !/^Visitante Web/i.test(String(convWeb.cnv_remitente_nombre))
      ? String(convWeb.cnv_remitente_nombre)
      : null) ||
    snap?.visitanteNombre ||
    null;

  const patchWa: Record<string, any> = {
    cnv_detalle_conversacion: {
      ...detalleWa,
      puente_omnicanal: nuevoPuenteWa,
      datos_venta: datosVentaActualizados,
      ...(fichaCombinada ? { ficha_cliente: fichaCombinada } : {}),
    },
    cnv_actualizado_en: ahoraIso,
  };

  if (nombreVisitanteCandidato && /^WhatsApp \+/i.test(nombreWaActual)) {
    patchWa.cnv_remitente_nombre = nombreVisitanteCandidato;
  }
  if (!convWa.cnv_remitente_correo && (convWeb?.cnv_remitente_correo || snap?.visitanteCorreo)) {
    patchWa.cnv_remitente_correo = convWeb?.cnv_remitente_correo || snap?.visitanteCorreo;
  }
  if (!convWa.cnv_usuario_id && convWeb?.cnv_usuario_id) {
    patchWa.cnv_usuario_id = convWeb.cnv_usuario_id;
  }
  if (!convWa.cnv_cliente_id && convWeb?.cnv_cliente_id) {
    patchWa.cnv_cliente_id = convWeb.cnv_cliente_id;
  }

  await adminDb
    .schema("comun_agentes")
    .from("agc_conversacion")
    .update(patchWa)
    .eq("cnv_id", params.conversacionWhatsappId);

  // 4. Vincular de vuelta en la conversación Web (si existe)
  if (convWeb?.cnv_id) {
    const detWeb = (convWeb.cnv_detalle_conversacion ?? {}) as Record<string, any>;
    const puenteWebPrev = (detWeb.puente_omnicanal ?? {}) as PuenteOmnicanalCliente;
    const patchWeb: Record<string, any> = {
      cnv_detalle_conversacion: {
        ...detWeb,
        puente_omnicanal: {
          ...puenteWebPrev,
          refWeb,
          wref: generarCodigoRefWhatsapp(params.conversacionWhatsappId),
          conversacionWhatsappVinculadaId: params.conversacionWhatsappId,
          origenInicial: puenteWebPrev.origenInicial || "WEB_A_WHATSAPP",
          vinculadoEn: puenteWebPrev.vinculadoEn || ahoraIso,
        },
      },
      cnv_actualizado_en: ahoraIso,
    };
    if (!convWeb.cnv_remitente_telefono && params.telefonoCliente) {
      patchWeb.cnv_remitente_telefono = params.telefonoCliente;
    }
    await adminDb
      .schema("comun_agentes")
      .from("agc_conversacion")
      .update(patchWeb)
      .eq("cnv_id", convWeb.cnv_id);
  }

  // 5. Registrar nota interna de trazabilidad (solo la primera vez que se enlaza este refWeb)
  if (!yaVinculadoMismoRef) {
    const descProd = visitaProducto?.productoNombre
      ? ` · Viendo en tienda: ${visitaProducto.productoNombre}${
          visitaProducto.varianteNombre ? ` (${visitaProducto.varianteNombre})` : ""
        }${visitaProducto.pvp != null ? ` — $${Number(visitaProducto.pvp).toFixed(2)}` : ""}`
      : "";
    const notaPuente = `🔗 Cliente vinculado desde la Tienda Web (${refWeb})${descProd}`;

    try {
      await adminDb
        .schema("comun_agentes")
        .from("agc_mensaje")
        .insert({
          msg_conversacion_id: params.conversacionWhatsappId,
          msg_negocio: params.negocio,
          msg_origen: "SISTEMA",
          msg_autor_nombre: "Puente Web ↔ WhatsApp",
          msg_contenido: notaPuente,
          msg_es_nota_interna: true,
          msg_detalle_mensaje: {
            tipo: "puente_web_whatsapp",
            refWeb,
            producto: visitaProducto,
          },
        });
    } catch {
      // Ignorar si esquema varía
    }

    await emitirBroadcastServidorOmnicanal(params.supabase, params.negocio, "actividad_chat_web", {
      eventoId: `puente-web-${refWeb}-${Date.now()}`,
      claveHilo: params.claveHiloWhatsapp,
      conversacionId: params.conversacionWhatsappId,
      canal: "whatsapp",
      fase: "NOTA_INTERNA",
      contenido: notaPuente,
      autorNombre: "Puente Web ↔ WhatsApp",
      remitenteNombre: patchWa.cnv_remitente_nombre || convWa.cnv_remitente_nombre || "Cliente WhatsApp",
      remitenteTelefono: params.telefonoCliente || null,
      estadoAtencion: "BOT_ACTIVO",
      creadoEn: ahoraIso,
    });
  }

  const resumenProductoAria = visitaProducto?.productoNombre
    ? `Estaba revisando en la web el arreglo "${visitaProducto.productoNombre}"${
        visitaProducto.varianteNombre ? ` (variante: ${visitaProducto.varianteNombre})` : ""
      }${visitaProducto.pvp != null ? ` con precio $${Number(visitaProducto.pvp).toFixed(2)} USD` : ""}${
        visitaProducto.urlPagina ? ` (${visitaProducto.urlPagina})` : ""
      }.`
    : "Viene directamente desde nuestra tienda web oficial.";

  return {
    bloquePromptAria: `\n[CONTEXTO OMNICANAL WEB → WHATSAPP (${refWeb}): ${resumenProductoAria} Atiéndelo con continuidad inmediata sin pedirle repetir qué arreglo vio.]`,
  };
}

export interface EntradaGuardarFichaClienteOmnicanal {
  negocio: string;
  conversacionId?: string | null;
  clienteId?: string | null;
  usuarioId?: string | null;
  nombre: string;
  telefono?: string | null;
  correo?: string | null;
  calificacionEstrellas?: number | null;
  notasCliente?: string | null;
}

export interface RespuestaGuardarFichaClienteOmnicanal {
  fichaCliente: FichaClienteOmnicanal;
  remitenteNombre: string;
  remitenteTelefono: string | null;
  remitenteCorreo: string | null;
  conversacionesActualizadasIds: string[];
}

/**
 * Guarda la Ficha Unificada del Cliente (nombre editable para registro interno,
 * WhatsApp/teléfono, correo, calificación de 1 a 5 estrellas y notas operativas)
 * y la sincroniza automáticamente en todos los canales asociados al mismo cliente.
 */
export async function guardarFichaClienteOmnicanalAction(
  entrada: EntradaGuardarFichaClienteOmnicanal
): Promise<
  | ({ ok: true } & RespuestaGuardarFichaClienteOmnicanal)
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const nombreLimpio = String(entrada.nombre || "").trim().slice(0, 140);
    if (!nombreLimpio) {
      return { ok: false, error: "Ingresa un nombre válido para el registro del cliente." };
    }

    const telefonoLimpio = String(entrada.telefono || "").trim().slice(0, 40) || null;
    const correoLimpio = String(entrada.correo || "").trim().toLowerCase().slice(0, 160) || null;
    const estrellas = normalizarEstrellasFicha(entrada.calificacionEstrellas);
    const notasLimpias = String(entrada.notasCliente || "").trim().slice(0, 2000) || null;

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
    }

    const adminDb: any = crearClienteAdmin() ?? supabase;
    const codigosNeg = variantesCodigoNegocio(neg);

    // Verificar pertenencia al equipo del negocio (Ventas / Operador / Admin / Superadmin)
    const [resUsu, resMem] = await Promise.all([
      adminDb
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
        .eq("usu_id", user.id)
        .maybeSingle(),
      adminDb
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_rol, seg_membresia_perfil(seg_perfil(per_clave))")
        .eq("mem_usuario_id", user.id)
        .eq("mem_estado", "ACTIVO")
        .in("mem_negocio", codigosNeg),
    ]);

    const uActor = resUsu?.data;
    const actorNombre =
      [uActor?.usu_nombres, uActor?.usu_apellidos].filter(Boolean).join(" ").trim() ||
      uActor?.usu_correo ||
      user.email ||
      "Equipo";

    const esSuper =
      Boolean(uActor?.usu_superadmin_plataforma) ||
      (neg === "tinkay" &&
        String(uActor?.usu_correo || user.email || "")
          .trim()
          .toLowerCase() === "tinkay.uio@gmail.com");

    const rolesPermitidos = new Set([
      "SUPERADMIN",
      "ADMINISTRADOR",
      "ADMIN",
      "VENTAS",
      "VENDEDOR",
      "ASESOR",
      "OPERADOR",
    ]);
    const mems = Array.isArray(resMem?.data) ? resMem.data : [];
    const tieneRolStaff =
      esSuper ||
      mems.some((m: any) => {
        const rolDirecto = String(m?.mem_rol || "").toUpperCase();
        if (rolesPermitidos.has(rolDirecto)) return true;
        const perfiles = Array.isArray(m?.seg_membresia_perfil) ? m.seg_membresia_perfil : [];
        return perfiles.some((mp: any) =>
          rolesPermitidos.has(String(mp?.seg_perfil?.per_clave || "").toUpperCase())
        );
      });

    if (!tieneRolStaff) {
      return { ok: false, error: "Acceso restringido al equipo comercial y administrativo." };
    }

    const ahoraIso = new Date().toISOString();
    const fichaCliente: FichaClienteOmnicanal = {
      nombrePersonalizado: nombreLimpio,
      calificacionEstrellas: estrellas,
      notasCliente: notasLimpias,
      actualizadoEn: ahoraIso,
      actualizadoPorNombre: actorNombre,
    };

    const convId = String(entrada.conversacionId || "").trim();
    const esUuidConv = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(convId);

    // 1. Intentar primero RPC transaccional en BD (si la migración 20261122000003 ya está aplicada)
    if (esUuidConv) {
      try {
        const esquemaComercio = supabase.schema("comun_comercio") as any;
        const { data: rpcData, error: rpcErr } = await esquemaComercio.rpc(
          "com_fn_omnicanal_guardar_ficha_cliente",
          {
            p_negocio: neg,
            p_conversacion_id: convId,
            p_nombre: nombreLimpio,
            p_telefono: telefonoLimpio,
            p_correo: correoLimpio,
            p_calificacion_estrellas: estrellas,
            p_notas_cliente: notasLimpias,
          }
        );
        if (!rpcErr && rpcData?.ok) {
          const idsRpc = Array.isArray(rpcData.conversacionesActualizadasIds)
            ? rpcData.conversacionesActualizadasIds.map((x: unknown) => String(x))
            : [convId];
          return {
            ok: true,
            fichaCliente: (rpcData.fichaCliente as FichaClienteOmnicanal) ?? fichaCliente,
            remitenteNombre: String(rpcData.remitenteNombre || nombreLimpio),
            remitenteTelefono:
              rpcData.remitenteTelefono !== undefined ? rpcData.remitenteTelefono : telefonoLimpio,
            remitenteCorreo:
              rpcData.remitenteCorreo !== undefined ? rpcData.remitenteCorreo : correoLimpio,
            conversacionesActualizadasIds: idsRpc,
          };
        }
      } catch {
        // Continuar con sincronización directa resiliente
      }
    }

    // 2. Sincronización directa resiliente en `comun_agentes.agc_conversacion` + `com_cliente` + respaldo híbrido
    const conversacionesActualizadasIds = new Set<string>();
    let telSemilla = normalizarTelefonoOmnicanal(telefonoLimpio);
    let correoSemilla = correoLimpio || "";
    let usuarioSemilla = String(entrada.usuarioId || "").trim();
    let clienteSemilla = String(entrada.clienteId || "").trim();
    let refWebSemilla = "";

    try {
      const { data: todasConvs } = await adminDb
        .schema("comun_agentes")
        .from("agc_conversacion")
        .select(
          "cnv_id, cnv_canal, cnv_remitente_nombre, cnv_remitente_telefono, cnv_remitente_correo, cnv_usuario_id, cnv_cliente_id, cnv_detalle_conversacion"
        )
        .eq("cnv_negocio", neg)
        .neq("cnv_canal", "interno")
        .is("cnv_eliminado_en", null)
        .limit(300);

      const listaConvs: any[] = Array.isArray(todasConvs) ? todasConvs : [];
      const convObjetivo = esUuidConv
        ? listaConvs.find((c) => String(c.cnv_id) === convId)
        : null;

      if (convObjetivo) {
        if (!telSemilla) {
          telSemilla = normalizarTelefonoOmnicanal(convObjetivo.cnv_remitente_telefono);
        }
        if (!correoSemilla && convObjetivo.cnv_remitente_correo) {
          correoSemilla = String(convObjetivo.cnv_remitente_correo).trim().toLowerCase();
        }
        if (!usuarioSemilla && convObjetivo.cnv_usuario_id) {
          usuarioSemilla = String(convObjetivo.cnv_usuario_id);
        }
        if (!clienteSemilla && convObjetivo.cnv_cliente_id) {
          clienteSemilla = String(convObjetivo.cnv_cliente_id);
        }
        const refDeObj = convObjetivo?.cnv_detalle_conversacion?.puente_omnicanal?.refWeb;
        if (refDeObj) refWebSemilla = String(refDeObj);
      }

      const convsHermanas = listaConvs.filter((c) => {
        const idActual = String(c.cnv_id);
        if (esUuidConv && idActual === convId) return true;
        const telC = normalizarTelefonoOmnicanal(c.cnv_remitente_telefono);
        if (telSemilla && telSemilla.length >= 8 && telC === telSemilla) return true;
        const mailC = String(c.cnv_remitente_correo || "").trim().toLowerCase();
        if (correoSemilla && mailC && mailC === correoSemilla) return true;
        if (usuarioSemilla && c.cnv_usuario_id && String(c.cnv_usuario_id) === usuarioSemilla) {
          return true;
        }
        if (clienteSemilla && c.cnv_cliente_id && String(c.cnv_cliente_id) === clienteSemilla) {
          return true;
        }
        const refC = c?.cnv_detalle_conversacion?.puente_omnicanal?.refWeb;
        if (refWebSemilla && refC && String(refC) === refWebSemilla) return true;
        return false;
      });

      for (const fila of convsHermanas) {
        const esPrincipal = esUuidConv && String(fila.cnv_id) === convId;
        const detPrev = (fila.cnv_detalle_conversacion ?? {}) as Record<string, any>;
        const datosVentaPrev = (detPrev.datos_venta ?? {}) as Record<string, any>;
        const patchFila: Record<string, any> = {
          cnv_remitente_nombre: nombreLimpio,
          cnv_detalle_conversacion: {
            ...detPrev,
            ficha_cliente: fichaCliente,
            datos_venta: {
              ...datosVentaPrev,
              nombreCliente: nombreLimpio,
            },
          },
          cnv_actualizado_en: ahoraIso,
        };

        if (esPrincipal) {
          patchFila.cnv_remitente_telefono = telefonoLimpio;
          patchFila.cnv_remitente_correo = correoLimpio;
        } else {
          if (!fila.cnv_remitente_telefono && telefonoLimpio) {
            patchFila.cnv_remitente_telefono = telefonoLimpio;
          }
          if (!fila.cnv_remitente_correo && correoLimpio) {
            patchFila.cnv_remitente_correo = correoLimpio;
          }
        }

        const { error: errUpd } = await adminDb
          .schema("comun_agentes")
          .from("agc_conversacion")
          .update(patchFila)
          .eq("cnv_id", fila.cnv_id);

        if (!errUpd) {
          conversacionesActualizadasIds.add(String(fila.cnv_id));
        }
      }
    } catch {
      // Continuar con actualización en com_cliente y respaldo híbrido
    }

    // 3. Sincronizar también en `comun_comercio.com_cliente` si existe ficha comercial
    try {
      let cliObjetivo: any = null;
      if (clienteSemilla && /^[0-9a-f-]{36}$/i.test(clienteSemilla)) {
        const { data } = await adminDb
          .schema("comun_comercio")
          .from("com_cliente")
          .select("cli_id, cli_telefono, cli_correo, cli_detalle_cliente")
          .eq("cli_id", clienteSemilla)
          .maybeSingle();
        cliObjetivo = data ?? null;
      } else if (usuarioSemilla && /^[0-9a-f-]{36}$/i.test(usuarioSemilla)) {
        const { data } = await adminDb
          .schema("comun_comercio")
          .from("com_cliente")
          .select("cli_id, cli_telefono, cli_correo, cli_detalle_cliente")
          .eq("cli_negocio", neg)
          .eq("cli_usuario_id", usuarioSemilla)
          .is("cli_eliminado_en", null)
          .maybeSingle();
        cliObjetivo = data ?? null;
      } else if (correoSemilla) {
        const { data } = await adminDb
          .schema("comun_comercio")
          .from("com_cliente")
          .select("cli_id, cli_telefono, cli_correo, cli_detalle_cliente")
          .eq("cli_negocio", neg)
          .ilike("cli_correo", correoSemilla)
          .is("cli_eliminado_en", null)
          .maybeSingle();
        cliObjetivo = data ?? null;
      }

      if (cliObjetivo?.cli_id) {
        const detCli = (cliObjetivo.cli_detalle_cliente ?? {}) as Record<string, any>;
        await adminDb
          .schema("comun_comercio")
          .from("com_cliente")
          .update({
            cli_nombre: nombreLimpio,
            ...(telefonoLimpio ? { cli_telefono: telefonoLimpio } : {}),
            ...(correoLimpio ? { cli_correo: correoLimpio } : {}),
            cli_detalle_cliente: {
              ...detCli,
              ficha_cliente: fichaCliente,
            },
            cli_actualizado_en: ahoraIso,
          })
          .eq("cli_id", cliObjetivo.cli_id);
      }
    } catch {
      // No interrumpir si com_cliente no tiene fila aún
    }

    // 4. Actualizar respaldo híbrido en `cfg_negocio` si existiera la conversación ahí
    try {
      const almacen = await leerAlmacenRespaldoCfg(neg);
      let tocoRespaldo = false;
      for (const c of almacen.conversaciones) {
        const telC = normalizarTelefonoOmnicanal(c.remitenteTelefono);
        const mailC = String(c.remitenteCorreo || "").trim().toLowerCase();
        const coincide =
          (convId && c.id === convId) ||
          (telSemilla && telSemilla.length >= 8 && telC === telSemilla) ||
          (correoSemilla && mailC && mailC === correoSemilla);
        if (coincide) {
          c.remitenteNombre = nombreLimpio;
          if (convId && c.id === convId) {
            c.remitenteTelefono = telefonoLimpio;
            c.remitenteCorreo = correoLimpio;
          } else {
            if (!c.remitenteTelefono && telefonoLimpio) c.remitenteTelefono = telefonoLimpio;
            if (!c.remitenteCorreo && correoLimpio) c.remitenteCorreo = correoLimpio;
          }
          c.fichaCliente = fichaCliente;
          conversacionesActualizadasIds.add(c.id);
          tocoRespaldo = true;
        }
      }
      if (tocoRespaldo) {
        await escribirAlmacenRespaldoCfg(neg, almacen);
      }
    } catch {
      // Ignorar respaldo secundario
    }

    if (convId) {
      conversacionesActualizadasIds.add(convId);
    }

    return {
      ok: true,
      fichaCliente,
      remitenteNombre: nombreLimpio,
      remitenteTelefono: telefonoLimpio,
      remitenteCorreo: correoLimpio,
      conversacionesActualizadasIds: Array.from(conversacionesActualizadasIds),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar la ficha del cliente.",
    };
  }
}

/**
 * Registra eventos públicos de correlación entre Tienda Web y WhatsApp:
 * - `WEB_A_WHATSAPP`: visitante en la web pulsa un botón hacia WhatsApp (`TNK-XXXXXX`).
 * - `WHATSAPP_A_WEB`: cliente de WhatsApp abre un link enviado desde el chat (`?wref=WA-XXXXXX`).
 */
export async function registrarEventoPuenteOmnicanalPublicoAction(entrada: {
  negocio?: string;
  direccion: "WEB_A_WHATSAPP" | "WHATSAPP_A_WEB";
  refWeb?: string | null;
  wref?: string | null;
  claveHiloWeb?: string | null;
  productoNombre?: string | null;
  productoSlug?: string | null;
  varianteNombre?: string | null;
  pvp?: number | null;
  urlPagina?: string | null;
  visitanteNombre?: string | null;
  visitanteCorreo?: string | null;
  visitanteTelefono?: string | null;
}): Promise<{ ok: boolean }> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio || "tinkay");
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase: any = crearClienteAdmin() ?? (await crearClienteServidor());
    const ahoraIso = new Date().toISOString();

    const refWeb = String(entrada.refWeb || "")
      .trim()
      .toUpperCase()
      .slice(0, 24);
    const wref = String(entrada.wref || "")
      .trim()
      .toUpperCase()
      .slice(0, 24);
    const claveHiloWeb = String(entrada.claveHiloWeb || "").trim().slice(0, 120) || null;

    const visitaActual: RegistroVisitaWebOmnicanal | null =
      entrada.productoNombre || entrada.urlPagina
        ? {
            productoNombre: entrada.productoNombre ? String(entrada.productoNombre).slice(0, 160) : null,
            productoSlug: entrada.productoSlug ? String(entrada.productoSlug).slice(0, 160) : null,
            varianteNombre: entrada.varianteNombre ? String(entrada.varianteNombre).slice(0, 120) : null,
            pvp:
              entrada.pvp != null && Number.isFinite(Number(entrada.pvp))
                ? Number(entrada.pvp)
                : null,
            urlPagina: entrada.urlPagina ? String(entrada.urlPagina).slice(0, 500) : null,
            vistoEn: ahoraIso,
          }
        : null;

    // A) Visitante en Tienda Web salta a WhatsApp -> guardar snapshot indexado por `refWeb`
    if (entrada.direccion === "WEB_A_WHATSAPP" && refWeb) {
      try {
        const { data: cfgActual } = await supabase
          .schema("comun_configuracion")
          .from("cfg_negocio")
          .select("cfg_id, cfg_detalle_configuracion")
          .eq("cfg_negocio", neg)
          .maybeSingle();

        if (cfgActual?.cfg_id) {
          const detPrev = (cfgActual.cfg_detalle_configuracion ?? {}) as Record<string, any>;
          const puentesPrev = (detPrev.omnicanal_puentes_web ?? {}) as Record<
            string,
            SnapshotPuenteWebCfg
          >;
          const entradasOrdenadas = Object.entries(puentesPrev)
            .sort((a, b) =>
              String(b[1]?.registradoEn || "").localeCompare(String(a[1]?.registradoEn || ""))
            )
            .slice(0, 149);
          const nuevoMapa: Record<string, SnapshotPuenteWebCfg> = Object.fromEntries(entradasOrdenadas);
          nuevoMapa[refWeb] = {
            refWeb,
            claveHiloWeb,
            productoNombre: visitaActual?.productoNombre ?? null,
            productoSlug: visitaActual?.productoSlug ?? null,
            varianteNombre: visitaActual?.varianteNombre ?? null,
            pvp: visitaActual?.pvp ?? null,
            urlPagina: visitaActual?.urlPagina ?? null,
            visitanteNombre: entrada.visitanteNombre ? String(entrada.visitanteNombre).slice(0, 120) : null,
            visitanteCorreo: entrada.visitanteCorreo
              ? String(entrada.visitanteCorreo).trim().toLowerCase().slice(0, 160)
              : null,
            visitanteTelefono: entrada.visitanteTelefono
              ? String(entrada.visitanteTelefono).trim().slice(0, 40)
              : null,
            registradoEn: ahoraIso,
          };

          await supabase
            .schema("comun_configuracion")
            .from("cfg_negocio")
            .update({
              cfg_detalle_configuracion: {
                ...detPrev,
                omnicanal_puentes_web: nuevoMapa,
              },
            })
            .eq("cfg_id", cfgActual.cfg_id);
        }
      } catch {
        // No bloquear si cfg_negocio no es editable con sesión anónima
      }

      // Estampar `refWeb` y producto visto en la conversación Web activa (si existe)
      if (claveHiloWeb) {
        try {
          const { data: convWeb } = await supabase
            .schema("comun_agentes")
            .from("agc_conversacion")
            .select("cnv_id, cnv_detalle_conversacion")
            .eq("cnv_negocio", neg)
            .eq("cnv_canal", "web")
            .eq("cnv_clave_hilo", claveHiloWeb)
            .is("cnv_eliminado_en", null)
            .maybeSingle();

          if (convWeb?.cnv_id) {
            const det = (convWeb.cnv_detalle_conversacion ?? {}) as Record<string, any>;
            const puentePrev = (det.puente_omnicanal ?? {}) as PuenteOmnicanalCliente;
            const histPrev = Array.isArray(puentePrev.historialVisitasWeb)
              ? puentePrev.historialVisitasWeb
              : [];
            await supabase
              .schema("comun_agentes")
              .from("agc_conversacion")
              .update({
                cnv_detalle_conversacion: {
                  ...det,
                  puente_omnicanal: {
                    ...puentePrev,
                    refWeb,
                    origenInicial: puentePrev.origenInicial || "WEB_A_WHATSAPP",
                    ultimoProductoVistoWeb: visitaActual ?? puentePrev.ultimoProductoVistoWeb ?? null,
                    historialVisitasWeb: visitaActual
                      ? [visitaActual, ...histPrev].slice(0, 15)
                      : histPrev,
                  },
                },
                cnv_actualizado_en: ahoraIso,
              })
              .eq("cnv_id", convWeb.cnv_id);
          }
        } catch {
          // Ignorar
        }
      }
      return { ok: true };
    }

    // B) Cliente de WhatsApp visita la Tienda Web mediante un link con `?wref=WA-XXXXXX`
    if (entrada.direccion === "WHATSAPP_A_WEB" && /^WA-[A-Z0-9]{4,10}$/.test(wref)) {
      const { data: convsWa } = await supabase
        .schema("comun_agentes")
        .from("agc_conversacion")
        .select(
          "cnv_id, cnv_clave_hilo, cnv_remitente_nombre, cnv_remitente_telefono, cnv_estado_atencion, cnv_detalle_conversacion"
        )
        .eq("cnv_negocio", neg)
        .eq("cnv_canal", "whatsapp")
        .is("cnv_eliminado_en", null)
        .order("cnv_ultimo_mensaje_en", { ascending: false })
        .limit(250);

      const convWa = Array.isArray(convsWa)
        ? convsWa.find((c: any) => generarCodigoRefWhatsapp(String(c.cnv_id)) === wref)
        : null;

      if (convWa?.cnv_id) {
        const detWa = (convWa.cnv_detalle_conversacion ?? {}) as Record<string, any>;
        const puentePrev = (detWa.puente_omnicanal ?? {}) as PuenteOmnicanalCliente;
        const histPrev = Array.isArray(puentePrev.historialVisitasWeb)
          ? puentePrev.historialVisitasWeb
          : [];
        const yaVioMismoProductoReciente =
          Boolean(visitaActual?.productoSlug) &&
          puentePrev.ultimoProductoVistoWeb?.productoSlug === visitaActual?.productoSlug;

        const nuevoHistorial = visitaActual
          ? [
              visitaActual,
              ...histPrev.filter(
                (h) =>
                  !(
                    h.productoSlug &&
                    visitaActual.productoSlug &&
                    h.productoSlug === visitaActual.productoSlug
                  )
              ),
            ].slice(0, 15)
          : histPrev;

        await supabase
          .schema("comun_agentes")
          .from("agc_conversacion")
          .update({
            cnv_detalle_conversacion: {
              ...detWa,
              puente_omnicanal: {
                ...puentePrev,
                wref,
                ...(refWeb ? { refWeb } : {}),
                ...(claveHiloWeb ? { claveHiloWebVinculado: claveHiloWeb } : {}),
                origenInicial: puentePrev.origenInicial || "WHATSAPP_A_WEB",
                ultimoProductoVistoWeb: visitaActual ?? puentePrev.ultimoProductoVistoWeb ?? null,
                historialVisitasWeb: nuevoHistorial,
                vinculadoEn: puentePrev.vinculadoEn || ahoraIso,
              },
            },
            cnv_actualizado_en: ahoraIso,
          })
          .eq("cnv_id", convWa.cnv_id);

        // Si el cliente abrió un producto específico en la web, dejar rastro en vivo en la consola
        if (visitaActual?.productoNombre && !yaVioMismoProductoReciente) {
          const notaVisita = `🛍️ El cliente abrió en la Tienda Web: ${visitaActual.productoNombre}${
            visitaActual.varianteNombre ? ` (${visitaActual.varianteNombre})` : ""
          }${visitaActual.pvp != null ? ` — $${Number(visitaActual.pvp).toFixed(2)}` : ""}`;

          try {
            await supabase
              .schema("comun_agentes")
              .from("agc_mensaje")
              .insert({
                msg_conversacion_id: convWa.cnv_id,
                msg_negocio: neg,
                msg_origen: "SISTEMA",
                msg_autor_nombre: "Actividad Tienda Web",
                msg_contenido: notaVisita,
                msg_es_nota_interna: true,
                msg_detalle_mensaje: {
                  tipo: "visita_web_desde_whatsapp",
                  wref,
                  producto: visitaActual,
                },
              });
          } catch {
            // Ignorar si esquema varía
          }

          await emitirBroadcastServidorOmnicanal(supabase, neg, "actividad_chat_web", {
            eventoId: `wref-visita-${wref}-${Date.now()}`,
            claveHilo: String(convWa.cnv_clave_hilo || ""),
            conversacionId: String(convWa.cnv_id),
            canal: "whatsapp",
            fase: "NOTA_INTERNA",
            contenido: notaVisita,
            autorNombre: "Actividad Tienda Web",
            remitenteNombre: String(convWa.cnv_remitente_nombre || "Cliente WhatsApp"),
            remitenteTelefono: convWa.cnv_remitente_telefono
              ? String(convWa.cnv_remitente_telefono)
              : null,
            estadoAtencion: (convWa.cnv_estado_atencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
            creadoEn: ahoraIso,
          });
        }
      }
    }

    return { ok: true };
  } catch {
    return { ok: false };
  }
}

