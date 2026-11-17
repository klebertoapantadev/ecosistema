"use server";

import {
  ETIQUETAS_OMNICANAL_POR_DEFECTO,
  RESPUESTAS_RAPIDAS_POR_DEFECTO,
  esPedidoUsuarioRegistrado,
  nombreCanalRealtimeOmnicanal,
  normalizarTelefonoOmnicanal,
  type ContactoUnificadoOmnicanal,
  type ConversacionOmnicanal,
  type EstadoAtencionOmnicanal,
  type EtiquetaOmnicanal,
  type EventoBroadcastChatWeb,
  type MensajeOmnicanal,
  type MiembroEquipoOmnicanal,
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

export interface PedidoWebConTipoCliente extends PedidoTiendaRegistrado {
  esUsuarioRegistrado: boolean;
}

export interface DatosTableroOmnicanal {
  usuarioActualId: string | null;
  usuarioActualNombre: string;
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
        .select("usu_nombres, usu_apellidos, usu_correo")
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
      const conversacionesNormalizadas: ConversacionOmnicanal[] = Array.isArray(
        rpcTablero.conversaciones
      )
        ? rpcTablero.conversaciones.map((c: any) => ({
            ...c,
            etiquetasIds: Array.isArray(c?.etiquetasIds) ? c.etiquetasIds : [],
          }))
        : [];

      const pedidosWeb: PedidoWebConTipoCliente[] = pedidosBase.map((p) => ({
        ...p,
        esUsuarioRegistrado: esPedidoUsuarioRegistrado(p, contactos),
      }));

      const contactosEnriquecidos = enriquecerContactosConPedidos(contactos, pedidosWeb);

      return {
        ok: true,
        datos: {
          usuarioActualId: user.id,
          usuarioActualNombre,
          conversaciones: conversacionesNormalizadas,
          etiquetas:
            Array.isArray(rpcTablero.etiquetas) && rpcTablero.etiquetas.length > 0
              ? rpcTablero.etiquetas
              : ETIQUETAS_OMNICANAL_POR_DEFECTO,
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
        ? convsTabla.map((c: any) => ({
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
          }))
        : almacen.conversaciones;

    for (const miembro of equipo) {
      miembro.chatsActivos = conversacionesFinales.filter(
        (c) => c.asesoraAsignadaId === miembro.usuarioId && c.estadoAtencion !== "CERRADO"
      ).length;
    }

    const etiquetasFinales: EtiquetaOmnicanal[] =
      etiquetasTabla && etiquetasTabla.length > 0
        ? etiquetasTabla.map((e: any) => ({
            id: String(e.etq_id),
            slug: String(e.etq_slug || ""),
            nombre: String(e.etq_nombre || ""),
            color: String(e.etq_color || "#2563EB"),
            icono: String(e.etq_icono || "🏷️"),
            orden: Number(e.etq_orden) || 0,
          }))
        : almacen.etiquetas;

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

    return {
      ok: true,
      datos: {
        usuarioActualId: user.id,
        usuarioActualNombre,
        conversaciones: conversacionesFinales,
        etiquetas: etiquetasFinales,
        respuestasRapidas: respuestasFinales,
        equipo,
        usuariosYClientes: enriquecerContactosConPedidos(contactosBase, pedidosWeb),
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
    const texto = (entrada.contenido || "").trim();
    if (!texto) {
      return { ok: false, error: "Escribe un mensaje antes de enviar." };
    }

    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(entrada.conversacionId)) {
      const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_enviar_mensaje_asesor", {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_contenido: texto,
        p_es_nota_interna: Boolean(entrada.esNotaInterna),
        p_respuesta_rapida_id:
          entrada.respuestaRapidaId && /^[0-9a-f-]{36}$/i.test(entrada.respuestaRapidaId)
            ? entrada.respuestaRapidaId
            : null,
      });

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
      tipoContenido: "TEXTO",
      estadoEntrega: "ENVIADO",
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
}): Promise<{ ok: true; estadoAtencion: EstadoAtencionOmnicanal } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComercio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquemaComercio = supabase.schema("comun_comercio") as any;

    if (/^[0-9a-f-]{36}$/i.test(entrada.conversacionId)) {
      const { data, error } = await esquemaComercio.rpc("com_fn_omnicanal_actualizar_conversacion", {
        p_negocio: neg,
        p_conversacion_id: entrada.conversacionId,
        p_nuevo_estado: entrada.nuevoEstado ?? null,
        p_asesora_id: entrada.asesoraId ?? null,
        p_desasignar: Boolean(entrada.desasignar),
        p_recordatorio_en: entrada.recordatorioEn ?? null,
        p_recordatorio_nota: entrada.recordatorioNota ?? null,
        p_limpiar_recordatorio: Boolean(entrada.limpiarRecordatorio),
      });

      if (!error && data?.ok) {
        return {
          ok: true,
          estadoAtencion: (data.estadoAtencion as EstadoAtencionOmnicanal) || "BOT_ACTIVO",
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

    if (entrada.nuevoEstado) conv.estadoAtencion = entrada.nuevoEstado;
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

    const resEsc = await escribirAlmacenRespaldoCfg(neg, almacen);
    if (!resEsc.ok) return { ok: false, error: resEsc.error || "Error al actualizar conversación" };

    return { ok: true, estadoAtencion: conv.estadoAtencion };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al actualizar conversación.",
    };
  }
}

export async function guardarEtiquetaOmnicanalAction(entrada: {
  negocio: string;
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
  });

  if (!error && data?.ok) {
    return { ok: true, etiqueta: data.etiqueta as EtiquetaOmnicanal };
  }
  if (error && !esFuncionRpcPendienteMigracion(error.message)) {
    return { ok: false, error: error.message };
  }

  const almacen = await leerAlmacenRespaldoCfg(neg);
  const slug = entrada.nombre
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-");
  const nueva: EtiquetaOmnicanal = {
    id: `etq-${slug}-${Date.now()}`,
    slug,
    nombre: entrada.nombre.trim(),
    color: entrada.color || "#2563EB",
    icono: entrada.icono || "🏷️",
    orden: almacen.etiquetas.length + 1,
  };
  almacen.etiquetas.push(nueva);
  await escribirAlmacenRespaldoCfg(neg, almacen);
  return { ok: true, etiqueta: nueva };
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

/**
 * Procesa un evento de Webhook entrante desde YCloud (WhatsApp Business API v2),
 * emite broadcast en tiempo real hacia `/panel/conversaciones`, enriquece el contexto
 * logístico/catálogo cuando aplica y delega la respuesta a Mía (ARIA) salvo cuando
 * una asesora humana haya pulsado `Tomar Control`.
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

    // Emitir actualización instantánea (<50ms) a la Consola de Ventas en Vivo
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
        contenido: String(rec.contenido || ""),
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
    }

    if (accion !== "INVOCAR_ARIA") {
      return { ok: true, status: 200, accion };
    }

    // Construir prompt para Mía (ARIA) con el formato exacto de WhatsApp + Entrega Inmediata + Cotización GPS
    const tel = String(rec.remitenteTelefono || "");
    const nombreCorto = String(rec.remitenteNombre || "Cliente").slice(0, 48);
    const textoCliente = String(rec.contenido || "");
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
              }, link tienda: ${origenTienda}/producto/${i.slug})`
          )
          .join("; ");
        bloqueInmediata = `\n[ARREGLOS LISTOS EN TIENDA PARA ENTREGA INMEDIATA 1-2h: ${lista}. Cuando recomiendes uno en WhatsApp incluye su foto markdown ![Nombre](url) para que el cliente vea la fotografía real. Catálogo inmediato: ${origenTienda}/categoria/entrega-inmediata]`;
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
        }
      }
    } catch {
      // Ignorar si la cotización tarda
    }

    const promptCompleto =
      `${encabezadoUsuario}\n${textoCliente}\n\n` +
      `[ENLACES DIRECTOS E-COMMERCE TINKAY: Categorías ${origenTienda}/categoria/{slug}, Entrega Inmediata ${origenTienda}/categoria/entrega-inmediata, Producto ${origenTienda}/producto/{slug}]` +
      bloqueInmediata +
      bloqueCotizacionGps;

    const { data: resAria } = await esquemaComercio.rpc(
      "com_fn_omnicanal_responder_whatsapp_con_aria",
      {
        p_token: entrada.token,
        p_conversacion_id: rec.conversacionId,
        p_prompt: promptCompleto,
        p_imagen_url: rec.imagenUrl ? String(rec.imagenUrl) : null,
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
