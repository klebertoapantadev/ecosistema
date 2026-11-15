import type { PedidoTiendaRegistrado } from "./acciones-logistica";

export type CanalOmnicanal =
  | "web"
  | "whatsapp"
  | "instagram"
  | "facebook"
  | "tiktok"
  | "telegram";

export type EstadoAtencionOmnicanal =
  | "BOT_ACTIVO"
  | "ESCALADO_HUMANO"
  | "EN_ATENCION_ASESORA"
  | "EN_ESPERA_CLIENTE"
  | "CERRADO";

export type OrigenMensajeOmnicanal =
  | "CLIENTE"
  | "BOT_ARIA"
  | "ASESORA_HUMANA"
  | "NOTA_INTERNA"
  | "SISTEMA";

export interface EtiquetaOmnicanal {
  id: string;
  slug: string;
  nombre: string;
  color: string;
  icono: string;
  orden: number;
}

export interface RespuestaRapidaOmnicanal {
  id: string;
  atajo: string;
  titulo: string;
  categoria: string;
  contenido: string;
  usoConteo: number;
}

export interface MiembroEquipoOmnicanal {
  usuarioId: string;
  nombre: string;
  correo: string;
  avatarUrl?: string | null;
  rol: string;
  chatsActivos: number;
}

export interface ConversacionOmnicanal {
  id: string;
  secuencial?: number;
  negocio: string;
  canal: CanalOmnicanal;
  claveHilo: string;
  remitenteId: string;
  remitenteNombre: string;
  remitenteCorreo?: string | null;
  remitenteTelefono?: string | null;
  usuarioId?: string | null;
  clienteId?: string | null;
  estadoAtencion: EstadoAtencionOmnicanal;
  asesoraAsignadaId?: string | null;
  asesoraNombre?: string | null;
  ultimoMensajeTexto?: string | null;
  ultimoMensajeOrigen?: OrigenMensajeOmnicanal | string | null;
  ultimoMensajeEn: string;
  noLeidosAsesora: number;
  mensajesClienteConteo: number;
  mensajesIaConteo: number;
  mensajesHumanoConteo: number;
  motivoEscalamiento?: string | null;
  recordatorioEn?: string | null;
  recordatorioNota?: string | null;
  ventana24hExpiraEn?: string | null;
  creadoEn: string;
  etiquetasIds: string[];
}

export interface MensajeOmnicanal {
  id: string;
  origen: OrigenMensajeOmnicanal;
  autorUsuarioId?: string | null;
  autorNombre?: string | null;
  contenido: string;
  tipoContenido: string;
  estadoEntrega: string;
  detalle?: Record<string, unknown>;
  creadoEn: string;
}

export interface ContactoUnificadoOmnicanal {
  claveUnica: string;
  usuarioId?: string | null;
  clienteId?: string | null;
  tipoCuenta: "USUARIO_REGISTRADO" | "INVITADO_NO_REGISTRADO" | "VISITANTE_CHAT";
  nombre: string;
  correo?: string | null;
  telefono?: string | null;
  identificacion?: string | null;
  autorizaWhatsapp: boolean;
  rolNegocio: string;
  totalCompras: number;
  montoAcumulado: number;
  ultimaCompraEn?: string | null;
  creadoEn: string;
  etiquetasIds: string[];
}

export interface MetricasOmnicanal {
  totalConversaciones: number;
  conversacionesAbiertas: number;
  sinAsignar: number;
  escaladasHumano: number;
  atendidasPorIa: number;
  enAtencionHumana: number;
  conRecordatorio: number;
  totalRespuestasAria: number;
  totalIntervencionesHumanas: number;
  porcentajeResolucionIa: number;
  totalComprasWeb: number;
  comprasUsuariosRegistrados: number;
  comprasInvitadosNoRegistrados: number;
  montoTotalVentasUsd: number;
  totalUsuariosRegistradosWeb: number;
}

export const ETIQUETAS_OMNICANAL_POR_DEFECTO: EtiquetaOmnicanal[] = [
  { id: "etq-seguimiento", slug: "seguimiento", nombre: "Seguimiento", color: "#DB2777", icono: "📢", orden: 1 },
  { id: "etq-pagado", slug: "pagado", nombre: "Pagado", color: "#16A34A", icono: "💸", orden: 2 },
  { id: "etq-hoy", slug: "hoy", nombre: "Hoy", color: "#EA580C", icono: "🟧", orden: 3 },
  { id: "etq-evento", slug: "evento", nombre: "Evento", color: "#2563EB", icono: "🔵", orden: 4 },
  { id: "etq-sur", slug: "sur", nombre: "SUR", color: "#D97706", icono: "🚚", orden: 5 },
  { id: "etq-condolencias", slug: "condolencias", nombre: "Condolencias", color: "#64748B", icono: "🕊️", orden: 6 },
  { id: "etq-vip", slug: "vip", nombre: "Cliente VIP", color: "#7C3AED", icono: "⭐", orden: 7 },
  { id: "etq-web", slug: "origen-web", nombre: "Chat Web", color: "#0D9488", icono: "🌐", orden: 8 },
];

export const RESPUESTAS_RAPIDAS_POR_DEFECTO: RespuestaRapidaOmnicanal[] = [
  {
    id: "rrp-saludo",
    atajo: "/saludo",
    titulo: "Saludo de Asesor Humano",
    categoria: "Bienvenida",
    contenido:
      "¡Hola {{nombre}}! Te saluda {{asesor}} del equipo de ventas. Tomo tu conversación personalmente para ayudarte con cada detalle. ¿Cómo te gustaría personalizar tu pedido?",
    usoConteo: 0,
  },
  {
    id: "rrp-transferencia",
    atajo: "/transferencia",
    titulo: "Datos de Pago y Transferencia",
    categoria: "Pagos",
    contenido:
      "Puedes completar tu pedido en línea con tarjeta de crédito/débito o mediante transferencia bancaria / Deuna. En cuanto nos compartas el comprobante pasamos tu orden a preparación inmediata.",
    usoConteo: 0,
  },
  {
    id: "rrp-ubicacion",
    atajo: "/ubicacion",
    titulo: "Solicitar Pin GPS de Entrega",
    categoria: "Logística",
    contenido:
      "Por favor compártenos el enlace de ubicación exacta de Google Maps o Waze de quien recibe, junto con su nombre y teléfono celular para programar la ruta.",
    usoConteo: 0,
  },
  {
    id: "rrp-confirmado",
    atajo: "/confirmado",
    titulo: "Confirmación de Pago",
    categoria: "Postventa",
    contenido:
      "¡Muchas gracias {{nombre}}! Hemos verificado tu pago correctamente. Tu pedido ya ingresó a preparación y te avisaremos apenas salga a ruta de entrega.",
    usoConteo: 0,
  },
  {
    id: "rrp-seguimiento",
    atajo: "/seguimiento",
    titulo: "Seguimiento de Cotización",
    categoria: "Cierre",
    contenido:
      "Hola {{nombre}}, quedamos atentos por si tienes alguna consulta sobre las opciones que revisamos. Todavía contamos con disponibilidad para programar tu entrega.",
    usoConteo: 0,
  },
];

export function normalizarTelefonoOmnicanal(telefono?: string | null): string {
  const digitos = String(telefono ?? "").replace(/\D/g, "");
  if (!digitos) return "";
  if (/^09\d{8}$/.test(digitos)) {
    return `593${digitos.slice(1)}`;
  }
  if (/^9\d{8}$/.test(digitos)) {
    return `593${digitos}`;
  }
  return digitos;
}

export function interpolarRespuestaRapida(
  plantilla: string,
  variables: {
    nombre?: string | null;
    asesor?: string | null;
    negocio?: string | null;
    orden?: string | null;
  }
): string {
  const primerNombre =
    (variables.nombre || "")
      .trim()
      .replace(/^Visitante Web.*$/i, "")
      .split(/\s+/)[0] || "allí";
  const asesor = (variables.asesor || "nuestro equipo").trim();
  const negocio = (variables.negocio || "").trim();
  const orden = (variables.orden || "").trim();

  return plantilla
    .replace(/\{\{\s*nombre\s*\}\}/gi, primerNombre === "allí" ? "" : primerNombre)
    .replace(/\{\{\s*asesor\s*\}\}/gi, asesor)
    .replace(/\{\{\s*negocio\s*\}\}/gi, negocio)
    .replace(/\{\{\s*orden\s*\}\}/gi, orden)
    .replace(/\s+([,!?.])/g, "$1")
    .replace(/¡Hola\s*!/g, "¡Hola!")
    .replace(/Hola\s*,/g, "Hola,")
    .trim();
}

export function esPedidoUsuarioRegistrado(
  pedido: Pick<PedidoTiendaRegistrado, "compradorCorreo" | "compradorTelefono">,
  contactosRegistrados: ContactoUnificadoOmnicanal[],
  tipoCompradorExplicito?: string | null
): boolean {
  if (tipoCompradorExplicito === "USUARIO_REGISTRADO") return true;
  if (tipoCompradorExplicito === "USUARIO_NO_AUTORIZADO" || tipoCompradorExplicito === "INVITADO") {
    const correoPed = (pedido.compradorCorreo || "").trim().toLowerCase();
    if (
      correoPed &&
      contactosRegistrados.some(
        (c) =>
          c.tipoCuenta === "USUARIO_REGISTRADO" &&
          (c.correo || "").trim().toLowerCase() === correoPed
      )
    ) {
      return true;
    }
    return false;
  }
  const correoPed = (pedido.compradorCorreo || "").trim().toLowerCase();
  const telPed = normalizarTelefonoOmnicanal(pedido.compradorTelefono);
  return contactosRegistrados.some((c) => {
    if (c.tipoCuenta !== "USUARIO_REGISTRADO") return false;
    if (correoPed && (c.correo || "").trim().toLowerCase() === correoPed) return true;
    if (telPed.length >= 9 && normalizarTelefonoOmnicanal(c.telefono) === telPed) return true;
    return false;
  });
}

export function emparejarComprasConConversacion(
  conversacion: Pick<
    ConversacionOmnicanal,
    "remitenteCorreo" | "remitenteTelefono" | "remitenteNombre"
  >,
  pedidos: PedidoTiendaRegistrado[]
): PedidoTiendaRegistrado[] {
  const correoConv = (conversacion.remitenteCorreo || "").trim().toLowerCase();
  const telConv = normalizarTelefonoOmnicanal(conversacion.remitenteTelefono);

  return pedidos.filter((p) => {
    const correoPed = (p.compradorCorreo || "").trim().toLowerCase();
    const telPed = normalizarTelefonoOmnicanal(p.compradorTelefono);
    if (correoConv && correoPed && correoConv === correoPed) return true;
    if (telConv.length >= 9 && telPed.length >= 9 && telConv === telPed) return true;
    return false;
  });
}

export function nombreCanalRealtimeOmnicanal(negocio: string): string {
  return `eco-omnicanal-live-${(negocio || "tinkay").trim().toLowerCase()}`;
}

export interface EventoBroadcastChatWeb {
  eventoId: string;
  claveHilo: string;
  conversacionId?: string | null;
  fase: "ENTRADA_CLIENTE" | "RESPUESTA_ARIA" | "EVENTO_ORDEN";
  contenido: string;
  autorNombre?: string | null;
  remitenteNombre?: string | null;
  remitenteCorreo?: string | null;
  remitenteTelefono?: string | null;
  estadoAtencion?: EstadoAtencionOmnicanal;
  creadoEn: string;
}

export interface EventoBroadcastIntervencionAsesor {
  eventoId: string;
  claveHilo: string;
  conversacionId: string;
  estadoAtencion: EstadoAtencionOmnicanal;
  asesoraAsignadaId?: string | null;
  asesoraNombre?: string | null;
  esNotaInterna?: boolean;
  mensaje?: MensajeOmnicanal | null;
}

export function calcularMetricasOmnicanal(
  conversaciones: ConversacionOmnicanal[],
  pedidos: Array<PedidoTiendaRegistrado & { esUsuarioRegistrado?: boolean }>,
  contactos: ContactoUnificadoOmnicanal[]
): MetricasOmnicanal {
  const abiertas = conversaciones.filter((c) => c.estadoAtencion !== "CERRADO");
  const totalRespuestasAria = conversaciones.reduce(
    (acc, c) => acc + (Number(c.mensajesIaConteo) || 0),
    0
  );
  const totalIntervencionesHumanas = conversaciones.reduce(
    (acc, c) => acc + (Number(c.mensajesHumanoConteo) || 0),
    0
  );
  const conInteraccion = conversaciones.filter(
    (c) => (c.mensajesIaConteo || 0) > 0 || (c.mensajesHumanoConteo || 0) > 0
  );
  const resueltasSoloIa = conInteraccion.filter(
    (c) => (c.mensajesIaConteo || 0) > 0 && (c.mensajesHumanoConteo || 0) === 0
  );

  const porcentajeResolucionIa =
    conInteraccion.length > 0
      ? Math.round((resueltasSoloIa.length / conInteraccion.length) * 100)
      : 100;

  const comprasUsuariosRegistrados = pedidos.filter((p) => Boolean(p.esUsuarioRegistrado)).length;
  const comprasInvitadosNoRegistrados = pedidos.length - comprasUsuariosRegistrados;
  const montoTotalVentasUsd =
    Math.round(
      pedidos
        .filter((p) => p.estado !== "CANCELADO" && p.estado !== "NO_ACEPTADA")
        .reduce((acc, p) => acc + (Number(p.total) || 0), 0) * 100
    ) / 100;

  const totalUsuariosRegistradosWeb = contactos.filter(
    (c) => c.tipoCuenta === "USUARIO_REGISTRADO"
  ).length;

  return {
    totalConversaciones: conversaciones.length,
    conversacionesAbiertas: abiertas.length,
    sinAsignar: abiertas.filter((c) => !c.asesoraAsignadaId).length,
    escaladasHumano: abiertas.filter((c) => c.estadoAtencion === "ESCALADO_HUMANO").length,
    atendidasPorIa: abiertas.filter((c) => c.estadoAtencion === "BOT_ACTIVO").length,
    enAtencionHumana: abiertas.filter((c) => c.estadoAtencion === "EN_ATENCION_ASESORA").length,
    conRecordatorio: conversaciones.filter((c) => Boolean(c.recordatorioEn)).length,
    totalRespuestasAria,
    totalIntervencionesHumanas,
    porcentajeResolucionIa,
    totalComprasWeb: pedidos.length,
    comprasUsuariosRegistrados,
    comprasInvitadosNoRegistrados,
    montoTotalVentasUsd,
    totalUsuariosRegistradosWeb,
  };
}
