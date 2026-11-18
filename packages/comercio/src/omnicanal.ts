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

export type EstadoCobroChatVenta = "COTIZANDO" | "PAGO_SOLICITADO" | "PAGADO";

/**
 * Campos personalizados de venta depurados (reemplazo limpio de los 36 campos de ManyChat,
 * eliminando 19 variables auxiliares `🔍`/`💤` de control de flujo y dejando los 15 datos comerciales reales).
 */
export interface DatosVentaConversacion {
  // 🛒 1. Producto y Valores
  producto?: string;
  preferenciasDetalle?: string; // Unifica Colores, NumGirasoles/tallos y NOTAS de elaboración
  precioProducto?: number | null;
  extras?: string;
  precioExtras?: number | null;
  costoEnvio?: number | null;
  totalManual?: number | null;
  estadoCobro?: EstadoCobroChatVenta;
  codigoPedido?: string;

  // 📍 2. Ubicación y Entrega
  fechaEntrega?: string; // YYYY-MM-DD (antes `-ℹ️ Cuando`)
  franjaHora?: string; // Ej. `A) 09:00 - 13:00` o hora específica (antes `-🕙 Hora`)
  sector?: string; // Ej. Centro-Norte, Cumbayá, Sur (antes `.📍Sector`)
  direccionReferencia?: string; // Dirección escrita / sala funeraria (antes `-❓ Donde`)
  ubicacionUrl?: string; // Link Google Maps / Waze / GPS (antes `.📍Ubicacion`)

  // ✍🏼 3. Cliente, Destinatario y Tarjeta
  nombreCliente?: string; // Quién compra (antes `🤵🏻NombreCliente`)
  quienRecibe?: string; // Nombre + celular de quien recibe (antes `✍🏼QuienRecibe`)
  dedicatoriaTarjeta?: string; // Mensaje para la tarjeta (antes `✍🏼Tarjeta`)
  firmaTarjeta?: string; // Firma al pie de la tarjeta (antes `✍🏼FirmaTarjeta`)
}

export type CodigoMotivoCierreOmnicanal =
  | "VENTA_COMPLETADA"
  | "COTIZACION_ENVIADA"
  | "CONSULTA_RESUELTA"
  | "SIN_DISPONIBILIDAD_COBERTURA"
  | "NO_RESPONDE"
  | "NO_DESEA_CONTINUAR"
  | "SPAM_EQUIVOCADO";

export interface DefinicionMotivoCierreOmnicanal {
  codigo: CodigoMotivoCierreOmnicanal;
  etiqueta: string;
  icono: string;
  descripcion: string;
  color: string;
  fondo: string;
}

export const MOTIVOS_CIERRE_OMNICANAL: DefinicionMotivoCierreOmnicanal[] = [
  {
    codigo: "VENTA_COMPLETADA",
    etiqueta: "Venta completada",
    icono: "✅",
    descripcion: "Pedido confirmado o pagado por el cliente",
    color: "#15803D",
    fondo: "#DCFCE7",
  },
  {
    codigo: "COTIZACION_ENVIADA",
    etiqueta: "Cotización / Proforma enviada",
    icono: "📄",
    descripcion: "Propuesta de evento o corporativo enviada para revisión",
    color: "#1D4ED8",
    fondo: "#DBEAFE",
  },
  {
    codigo: "CONSULTA_RESUELTA",
    etiqueta: "Consulta informativa resuelta",
    icono: "ℹ️",
    descripcion: "Duda sobre horarios, catálogo o estado de entrega atendida",
    color: "#0F766E",
    fondo: "#CCFBF1",
  },
  {
    codigo: "NO_RESPONDE",
    etiqueta: "No responde",
    icono: "⏳",
    descripcion: "Cliente dejó de responder tras el seguimiento",
    color: "#B45309",
    fondo: "#FEF3C7",
  },
  {
    codigo: "NO_DESEA_CONTINUAR",
    etiqueta: "No desea continuar",
    icono: "❌",
    descripcion: "Desistió por presupuesto, horario u otra alternativa",
    color: "#B91C1C",
    fondo: "#FEE2E2",
  },
  {
    codigo: "SIN_DISPONIBILIDAD_COBERTURA",
    etiqueta: "Sin stock o fuera de cobertura",
    icono: "🚫",
    descripcion: "Producto no disponible para esa hora o fuera de zona",
    color: "#7C2D12",
    fondo: "#FFEDD5",
  },
  {
    codigo: "SPAM_EQUIVOCADO",
    etiqueta: "Spam / Número equivocado",
    icono: "🗑️",
    descripcion: "Mensaje automático, proveedor externo o prueba",
    color: "#475569",
    fondo: "#F1F5F9",
  },
];

export interface DatosCierreConversacion {
  motivoCodigo: CodigoMotivoCierreOmnicanal | string;
  motivoEtiqueta: string;
  nota?: string | null;
  cerradoEn?: string | null;
  cerradoPor?: string | null;
}

export function obtenerDefinicionMotivoCierre(
  codigo?: string | null
): DefinicionMotivoCierreOmnicanal {
  const norm = String(codigo || "").trim().toUpperCase();
  return (
    MOTIVOS_CIERRE_OMNICANAL.find((m) => m.codigo === norm) ?? {
      codigo: "CONSULTA_RESUELTA",
      etiqueta: codigo?.trim() || "Cerrado",
      icono: "✅",
      descripcion: "",
      color: "#475569",
      fondo: "#F1F5F9",
    }
  );
}

export type ClaveRecordatorioRapido = "20m" | "1h" | "3h" | "6h" | "12h" | "manana_9am";

export interface OpcionRecordatorioRapidoOmnicanal {
  clave: ClaveRecordatorioRapido;
  etiqueta: string;
}

export const OPCIONES_RECORDATORIO_RAPIDO_OMNICANAL: OpcionRecordatorioRapidoOmnicanal[] = [
  { clave: "20m", etiqueta: "20 minutos" },
  { clave: "1h", etiqueta: "1 hora" },
  { clave: "3h", etiqueta: "3 horas" },
  { clave: "6h", etiqueta: "6 horas" },
  { clave: "12h", etiqueta: "12 horas" },
  { clave: "manana_9am", etiqueta: "Mañana 09:00" },
];

export function calcularFechaRecordatorioRapido(
  clave: ClaveRecordatorioRapido,
  ahoraBase: Date = new Date()
): string {
  const baseMs = ahoraBase.getTime();
  switch (clave) {
    case "20m":
      return new Date(baseMs + 20 * 60 * 1000).toISOString();
    case "1h":
      return new Date(baseMs + 60 * 60 * 1000).toISOString();
    case "3h":
      return new Date(baseMs + 3 * 60 * 60 * 1000).toISOString();
    case "6h":
      return new Date(baseMs + 6 * 60 * 60 * 1000).toISOString();
    case "12h":
      return new Date(baseMs + 12 * 60 * 60 * 1000).toISOString();
    case "manana_9am": {
      const manana = new Date(baseMs + 24 * 60 * 60 * 1000);
      manana.setHours(9, 0, 0, 0);
      return manana.toISOString();
    }
  }
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
  datosVenta?: DatosVentaConversacion;
  cierre?: DatosCierreConversacion | null;
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
];

export function calcularTotalDatosVenta(datos?: DatosVentaConversacion | null): number {
  if (!datos) return 0;
  if (datos.totalManual != null && !Number.isNaN(Number(datos.totalManual)) && Number(datos.totalManual) > 0) {
    return Math.round(Number(datos.totalManual) * 100) / 100;
  }
  const prod = Number(datos.precioProducto) || 0;
  const ext = Number(datos.precioExtras) || 0;
  const env = Number(datos.costoEnvio) || 0;
  return Math.round((prod + ext + env) * 100) / 100;
}

/**
 * Sugiere valores iniciales no destructivos en los Campos de Venta a partir de lo ya conversado
 * en el hilo (ej. enlaces de Google Maps/Waze enviados por el cliente, orden web o nombre real).
 */
export function autoCompletarDatosVentaDesdeMensajes(
  actual: DatosVentaConversacion | undefined | null,
  mensajes: MensajeOmnicanal[],
  conversacion?: Pick<ConversacionOmnicanal, "remitenteNombre"> | null
): DatosVentaConversacion {
  const base: DatosVentaConversacion = {
    estadoCobro: "COTIZANDO",
    ...(actual ?? {}),
  };

  if (
    !base.nombreCliente &&
    conversacion?.remitenteNombre &&
    !/^(Visitante Web|WhatsApp\s*\+)/i.test(conversacion.remitenteNombre)
  ) {
    base.nombreCliente = conversacion.remitenteNombre;
  }

  for (const m of mensajes) {
    const txt = String(m.contenido || "");
    if (!base.ubicacionUrl) {
      const matchMapa = txt.match(
        /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|(?:www\.)?google\.[a-z.]+\/maps|maps\.google\.[a-z.]+|(?:www\.)?waze\.com)[^\s)]*/i
      );
      if (matchMapa?.[0]) {
        base.ubicacionUrl = matchMapa[0];
      }
    }
    if (!base.codigoPedido) {
      const matchOrd = txt.match(/\b(TNK-(?:ORD|PRF|OT)-\d+|OT-[A-Z0-9-]+)\b/i);
      if (matchOrd?.[1]) {
        base.codigoPedido = matchOrd[1].toUpperCase();
      }
    }
  }

  return base;
}

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

export function nombreCanalRealtimeChatEquipo(negocio: string): string {
  return `eco-chat-equipo-${(negocio || "tinkay").trim().toLowerCase()}`;
}

export interface EventoBroadcastChatWeb {
  eventoId: string;
  claveHilo: string;
  conversacionId?: string | null;
  canal?: CanalOmnicanal;
  fase:
    | "ENTRADA_CLIENTE"
    | "RESPUESTA_ARIA"
    | "EVENTO_ORDEN"
    | "INTERVENCION_HUMANA"
    | "NOTA_INTERNA";
  contenido: string;
  imagenUrl?: string | null;
  imagenesUrls?: string[];
  audioUrl?: string | null;
  audioMime?: string | null;
  documentoUrl?: string | null;
  documentoNombre?: string | null;
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
  eliminada?: boolean;
}

export interface EventoBroadcastEstadoPedido {
  eventoId: string;
  negocio: string;
  pedidoId?: string | null;
  codigoOrden: string;
  nuevoEstado: string;
  etiquetaEstado: string;
  titulo: string;
  cuerpo: string;
  clienteUsuarioId?: string | null;
  repartidorAsignadoId?: string | null;
  notificacionesPorUsuario?: Record<
    string,
    {
      notId: string;
      rol: string;
      url: string;
    }
  >;
  emitidoEn: string;
}

export function resolverUrlDirectaPedidoPorRol(
  rolRaw: string,
  codigoOrden: string,
  notId?: string | null
): string {
  const rol = String(rolRaw || "CLIENTE").trim().toUpperCase();
  const params = new URLSearchParams();
  if (codigoOrden) params.set("pedido", codigoOrden);
  if (notId) params.set("not_id", notId);

  if (
    [
      "SUPERADMIN",
      "ADMINISTRADOR",
      "ADMIN",
      "OPERADOR",
      "AUXILIAR",
      "VENTAS",
      "VENDEDOR",
      "ASESOR",
    ].includes(rol)
  ) {
    return `/panel/pedidos?${params.toString()}`;
  }
  if (["TALLER", "FLORISTA"].includes(rol)) {
    return `/panel/taller?${params.toString()}`;
  }
  if (["DELIVERY", "REPARTIDOR", "DELIVERY_EXTERNO", "SUBCONTRATADO"].includes(rol)) {
    return `/panel/entregas?${params.toString()}`;
  }

  const paramsCli = new URLSearchParams({ vista: "pedidos" });
  if (codigoOrden) paramsCli.set("pedido", codigoOrden);
  if (notId) paramsCli.set("not_id", notId);
  return `/panel?${paramsCli.toString()}`;
}

export interface MiembroChatEquipo {
  usuarioId: string;
  nombre: string;
  correo: string;
  avatarUrl?: string | null;
  rol: string;
  handle: string;
}

export interface CitaRespuestaChatEquipo {
  id: string;
  autorNombre: string;
  extracto: string;
  imagenUrl?: string | null;
}

export interface ContextoReenvioChatEquipo {
  conversacionId?: string | null;
  mensajeId?: string | null;
  canal?: string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  autorOriginal?: string | null;
  textoOriginal?: string | null;
  imagenUrl?: string | null;
}

export function construirHrefRetornoChatCliente(
  ctx: ContextoReenvioChatEquipo,
  rutaBase = "/panel/conversaciones"
): string {
  const params = new URLSearchParams();
  if (ctx.conversacionId) params.set("chat", ctx.conversacionId);
  if (ctx.mensajeId) params.set("msg", ctx.mensajeId);
  if (ctx.clienteTelefono) params.set("tel", ctx.clienteTelefono);
  if (ctx.clienteNombre) params.set("cliente", ctx.clienteNombre);
  if (ctx.textoOriginal) params.set("cita", ctx.textoOriginal.slice(0, 80));
  const qs = params.toString();
  return qs ? `${rutaBase}?${qs}` : rutaBase;
}

export function resolverConversacionPorContextoReenvio(
  conversaciones: ConversacionOmnicanal[],
  ctx: Pick<ContextoReenvioChatEquipo, "conversacionId" | "clienteTelefono" | "clienteNombre">
): ConversacionOmnicanal | null {
  if (ctx.conversacionId) {
    const exacta = conversaciones.find((c) => c.id === ctx.conversacionId);
    if (exacta) return exacta;
  }
  const telNorm = normalizarTelefonoOmnicanal(ctx.clienteTelefono);
  if (telNorm.length >= 9) {
    const porTel = conversaciones.find(
      (c) => normalizarTelefonoOmnicanal(c.remitenteTelefono) === telNorm
    );
    if (porTel) return porTel;
  }
  const nom = (ctx.clienteNombre || "").trim().toLowerCase();
  if (nom) {
    const porNom = conversaciones.find(
      (c) => (c.remitenteNombre || "").trim().toLowerCase() === nom
    );
    if (porNom) return porNom;
  }
  return null;
}

export interface MensajeChatEquipo {
  id: string;
  autorUsuarioId?: string | null;
  autorNombre: string;
  contenido: string;
  tipoContenido: string;
  detalle?: Record<string, unknown>;
  creadoEn: string;
}

export interface ConversacionWhatsappResumen {
  id: string;
  nombre: string;
  telefono?: string | null;
  ultimoMensajeEn: string;
}

export interface EventoBroadcastChatEquipo {
  eventoId: string;
  sala: string;
  mensaje: MensajeChatEquipo;
  mencionadosUsuariosIds?: string[];
  handlesMencionados?: string[];
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

export type SegmentoMensajeMultimedia =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagen"; alt: string; url: string }
  | {
      tipo: "audio";
      url: string;
      mime?: string | null;
      transcripcion?: string | null;
    }
  | {
      tipo: "documento";
      url: string;
      nombre: string;
    };

interface TokenMarkdownEscaneado {
  inicio: number;
  fin: number;
  esImagen: boolean;
  alt: string;
  url: string;
  truncadoSinCerrar?: boolean;
}

const REGEX_EXT_IMAGEN = /\.(?:jpg|jpeg|png|webp|gif|heic)(?:\?.*)?$/i;
const REGEX_EXT_NO_IMAGEN =
  /\.(?:ogg|oga|opus|mp3|m4a|wav|webm|pdf|doc|docx|xls|xlsx|csv|txt)(?:\?.*)?$/i;
const REGEX_RUTA_MEDIA_CONOCIDA =
  /\/omnicanal-media\/|\/whatsapp_business\/attachments|lookaside\.fbsbx\.com|mmg\.whatsapp\.net|\/v2\/whatsapp\/media|\/storage\/v1\/object\/(?:public|sign)\//i;
const REGEX_QUERY_MEDIA_FIRMADA = /[?&](?:token|jwt|sig|signature)=eyJ[a-zA-Z0-9_-]{12,}/;
const REGEX_ALT_DESCRIPTIVO_IMAGEN =
  /\b(?:foto|fotograf[ií]a|imagen|captura|sticker|adjunt[ao]|comprobante)\b/i;

export function esUrlMultimediaChat(
  url: string,
  alt?: string | null,
  urlsDetalle?: Set<string>
): boolean {
  const limpia = url.trim();
  if (!/^https?:\/\//i.test(limpia)) return false;
  if (REGEX_EXT_NO_IMAGEN.test(limpia)) return false;
  if (urlsDetalle?.has(limpia)) return true;
  if (REGEX_EXT_IMAGEN.test(limpia)) return true;
  if (REGEX_RUTA_MEDIA_CONOCIDA.test(limpia)) return true;
  if (REGEX_QUERY_MEDIA_FIRMADA.test(limpia)) return true;
  if (alt && REGEX_ALT_DESCRIPTIVO_IMAGEN.test(alt)) return true;
  return false;
}

/**
 * Separa puntuación de cierre pegada al final de una URL en texto libre (`(https://...token=abc)` -> sufijo `)`)
 * y genera una etiqueta compacta legible para pantallas móviles cuando la URL es extensa.
 */
export function formatearEtiquetaEnlaceVisible(
  urlCruda: string,
  maxCaracteres = 48
): {
  href: string;
  etiqueta: string;
  sufijo: string;
} {
  let href = urlCruda;
  let sufijo = "";

  while (href.length > 10) {
    const ultimo = href[href.length - 1]!;
    if (ultimo === "." || ultimo === "," || ultimo === ";" || ultimo === ":") {
      sufijo = ultimo + sufijo;
      href = href.slice(0, -1);
      continue;
    }
    if (ultimo === ")") {
      let abiertos = 0;
      let cerrados = 0;
      for (let idx = 0; idx < href.length; idx += 1) {
        if (href[idx] === "(") abiertos += 1;
        else if (href[idx] === ")") cerrados += 1;
      }
      if (cerrados > abiertos) {
        sufijo = ")" + sufijo;
        href = href.slice(0, -1);
        continue;
      }
    }
    break;
  }

  if (href.length <= maxCaracteres) {
    return { href, etiqueta: href, sufijo };
  }

  try {
    const parsed = new URL(href);
    const host = parsed.hostname.replace(/^www\./i, "");
    const segs = parsed.pathname.split("/").filter(Boolean);
    const colaRuta = segs.length > 0 ? `/${segs[0]!.slice(0, 14)}${segs.length > 1 || segs[0]!.length > 14 ? "…" : ""}` : "/…";
    return {
      href,
      etiqueta: `🔗 ${host}${colaRuta}`,
      sufijo,
    };
  } catch {
    return {
      href,
      etiqueta: `${href.slice(0, maxCaracteres - 3)}…`,
      sufijo,
    };
  }
}

/**
 * Escáner determinista O(N) de un solo paso para etiquetas `![alt](https://...)` y `[texto](https://...)`
 * (soporta corchetes anidados en alt, paréntesis balanceados `foto_(2).jpg`, saltos cortos en alt o entre `]` y `(`,
 * URLs firmadas JWT sin extensión `.jpg` y cadenas truncadas sin riesgo alguno de ReDoS).
 */
function escanearEnlacesMarkdownLineal(
  texto: string,
  urlsDetalle?: Set<string>
): TokenMarkdownEscaneado[] {
  const tokens: TokenMarkdownEscaneado[] = [];
  const n = texto.length;
  let i = 0;

  while (i < n) {
    const inicioToken = i;
    let esImg = false;

    if (texto[i] === "!") {
      let j = i + 1;
      while (j < n && (texto[j] === " " || texto[j] === "\t" || texto[j] === "\r" || texto[j] === "\n")) {
        j += 1;
      }
      if (j < n && texto[j] === "[") {
        esImg = true;
        i = j;
      } else {
        i += 1;
        continue;
      }
    } else if (texto[i] !== "[") {
      i += 1;
      continue;
    }

    // Buscar `]` respetando posibles corchetes internos en alt (ej. `![Foto [WhatsApp]](https://...)`)
    let cierreCorchete = -1;
    let nivelCorchetes = 0;
    const limiteAlt = Math.min(n, i + 260);
    for (let c = i + 1; c < limiteAlt; c += 1) {
      const ch = texto[c];
      if (ch === "[") {
        nivelCorchetes += 1;
      } else if (ch === "]") {
        if (nivelCorchetes > 0) {
          nivelCorchetes -= 1;
        } else {
          cierreCorchete = c;
          break;
        }
      }
    }

    if (cierreCorchete === -1) {
      i += 1;
      continue;
    }

    const altCrudo = texto.slice(i + 1, cierreCorchete);
    // Permitir a lo sumo un salto accidental en etiquetas cortas (ej. wrap automático de móvil/webhook)
    if ((altCrudo.match(/\n/g)?.length ?? 0) > 2) {
      i += 1;
      continue;
    }
    const alt = altCrudo.replace(/\s+/g, " ").trim();

    let p = cierreCorchete + 1;
    while (p < n && (texto[p] === " " || texto[p] === "\t" || texto[p] === "\r" || texto[p] === "\n")) {
      p += 1;
    }
    if (p >= n || texto[p] !== "(") {
      i = cierreCorchete + 1;
      continue;
    }

    let q = p + 1;
    while (q < n && (texto[q] === " " || texto[q] === "\t" || texto[q] === "\r" || texto[q] === "\n")) {
      q += 1;
    }

    const prefijoHttp = texto.slice(q, q + 8).toLowerCase();
    if (!prefijoHttp.startsWith("https://") && !prefijoHttp.startsWith("http://")) {
      i = p + 1;
      continue;
    }

    let k = q;
    let nivelParentesis = 0;
    let finParentesis = -1;

    while (k < n) {
      const ch = texto[k];
      if (ch === "\r" || ch === "\n") {
        break;
      }
      if (ch === "(") {
        nivelParentesis += 1;
      } else if (ch === ")") {
        if (nivelParentesis > 0) {
          nivelParentesis -= 1;
        } else {
          finParentesis = k;
          break;
        }
      }
      k += 1;
    }

    if (finParentesis === -1) {
      if (esImg && k === n) {
        tokens.push({
          inicio: inicioToken,
          fin: n,
          esImagen: true,
          alt,
          url: "",
          truncadoSinCerrar: true,
        });
        break;
      }
      i = q + 7;
      continue;
    }

    const urlCruda = texto.slice(q, finParentesis).trim();
    const urlNormalizada = urlCruda.replace(/\s+/g, "%20");
    const esUrlDeImagen = esImg || esUrlMultimediaChat(urlNormalizada, alt, urlsDetalle);

    tokens.push({
      inicio: inicioToken,
      fin: finParentesis + 1,
      esImagen: esUrlDeImagen,
      alt,
      url: urlNormalizada,
    });

    i = finParentesis + 1;
  }

  return tokens;
}

/**
 * Extrae bloques ordenados de texto e imágenes desde mensajes con formato Markdown
 * (`![Abanico Canasta XL](https://.../abanico.jpg)`, enlaces firmados JWT de WhatsApp/YCloud/Supabase,
 * URLs con paréntesis `foto_(2).jpg`, enlaces directos y metadatos `detalle.imagen_url` / `detalle.imagenes_urls`)
 * evitando duplicar URLs firmadas como texto crudo sobre la tarjeta de imagen.
 */
export function extraerSegmentosMultimediaMensaje(
  contenido: string,
  detalle?: Record<string, unknown> | null
): SegmentoMensajeMultimedia[] {
  let textoBase = String(contenido || "");
  const urlsVistas = new Set<string>();
  const urlsDetalle = new Set<string>();
  const normalizarUrlImg = (u: string): string => u.trim().replace(/\s+/g, "%20");

  if (detalle && typeof detalle === "object") {
    if (typeof detalle.imagen_url === "string" && /^https?:\/\//i.test(detalle.imagen_url.trim())) {
      urlsDetalle.add(normalizarUrlImg(detalle.imagen_url));
    }
    if (Array.isArray(detalle.imagenes_urls)) {
      for (const item of detalle.imagenes_urls) {
        if (typeof item === "string" && /^https?:\/\//i.test(item.trim())) {
          urlsDetalle.add(normalizarUrlImg(item));
        }
      }
    }
  }

  // Normalizar variantes previas de adjuntos ("📷 Imagen adjunta...: https://...")
  textoBase = textoBase.replace(
    /📷\s*(?:Imagen|Foto|Fotograf[ií]a)([^:\n]{0,45}):\s*(https?:\/\/[^\s<>"]+)/gi,
    (_m, etiquetaExtra: string, url: string) => {
      const { href, sufijo } = formatearEtiquetaEnlaceVisible(url);
      const altBase = /cliente/i.test(etiquetaExtra)
        ? "Foto enviada por el cliente"
        : "Foto enviada";
      return `![${altBase}](${normalizarUrlImg(href)})${sufijo}`;
    }
  );

  const tokens = escanearEnlacesMarkdownLineal(textoBase, urlsDetalle);
  const segmentosPreliminares: SegmentoMensajeMultimedia[] = [];
  let cursor = 0;

  const limpiarNegritasYSaltos = (raw: string): string =>
    raw
      .replace(/\*\*([^*]+)\*\*/g, "$1")
      .replace(/\n{3,}/g, "\n\n")
      .trim();

  let acumuladorTexto = "";

  for (const tk of tokens) {
    if (tk.inicio > cursor) {
      acumuladorTexto += textoBase.slice(cursor, tk.inicio);
    }

    if (tk.truncadoSinCerrar) {
      if (tk.alt) {
        acumuladorTexto += `📷 ${tk.alt}`;
      }
    } else if (tk.esImagen && tk.url) {
      const bloquePrevio = limpiarNegritasYSaltos(acumuladorTexto);
      if (bloquePrevio) {
        segmentosPreliminares.push({ tipo: "texto", texto: bloquePrevio });
      }
      acumuladorTexto = "";
      if (!urlsVistas.has(tk.url)) {
        urlsVistas.add(tk.url);
        segmentosPreliminares.push({ tipo: "imagen", alt: tk.alt, url: tk.url });
      }
    } else {
      acumuladorTexto += tk.alt ? `${tk.alt}: ${tk.url}` : tk.url;
    }

    cursor = tk.fin;
  }

  if (cursor < textoBase.length) {
    acumuladorTexto += textoBase.slice(cursor);
  }
  const colaTexto = limpiarNegritasYSaltos(acumuladorTexto);
  if (colaTexto) {
    segmentosPreliminares.push({ tipo: "texto", texto: colaTexto });
  }

  // Detectar URLs multimedia sueltas en texto (con extensión o firmadas JWT / presentes en `detalle.imagen_url`)
  const segmentos: SegmentoMensajeMultimedia[] = [];
  const regexUrlCandidata = /(\(?https?:\/\/[^\s<>"]+)/gi;

  for (const seg of segmentosPreliminares) {
    if (seg.tipo !== "texto") {
      segmentos.push(seg);
      continue;
    }

    let bufferTexto = "";
    let ultimoFin = 0;
    const txt = seg.texto;
    regexUrlCandidata.lastIndex = 0;
    let match: RegExpExecArray | null = regexUrlCandidata.exec(txt);

    while (match !== null) {
      const inicioMatch = match.index;
      const bruto = match[0]!;
      const tieneParenInicial = bruto.startsWith("(");
      const sinParenInicial = tieneParenInicial ? bruto.slice(1) : bruto;
      const { href, sufijo } = formatearEtiquetaEnlaceVisible(sinParenInicial);
      const limpia = normalizarUrlImg(href);

      if (esUrlMultimediaChat(limpia, null, urlsDetalle)) {
        bufferTexto += txt.slice(ultimoFin, inicioMatch);
        // Si estaba envuelta como `(https://...token=eyJ...)`, consumir también el `)` de cierre
        const sufijoRestante =
          tieneParenInicial && sufijo.startsWith(")") ? sufijo.slice(1) : sufijo;
        const previoLimpio = bufferTexto
          .replace(/!\s*\[[^\]]*\]\s*$/g, "")
          .trim();
        if (previoLimpio) {
          segmentos.push({ tipo: "texto", texto: previoLimpio });
        }
        bufferTexto = sufijoRestante;
        if (!urlsVistas.has(limpia)) {
          urlsVistas.add(limpia);
          segmentos.push({ tipo: "imagen", alt: "", url: limpia });
        }
        ultimoFin = inicioMatch + bruto.length;
      }

      match = regexUrlCandidata.exec(txt);
    }

    if (ultimoFin < txt.length) {
      bufferTexto += txt.slice(ultimoFin);
    }
    const restoLimpio = bufferTexto.trim();
    if (restoLimpio) {
      segmentos.push({ tipo: "texto", texto: restoLimpio });
    }
  }

  // Anexar imágenes de `detalle.imagen_url` o `detalle.imagenes_urls` si no estaban ya en el texto
  for (const urlDet of urlsDetalle) {
    if (!urlsVistas.has(urlDet)) {
      urlsVistas.add(urlDet);
      segmentos.push({ tipo: "imagen", alt: "", url: urlDet });
    }
  }

  // Anexar audio (nota de voz) o documento si vienen en `detalle`
  if (detalle && typeof detalle === "object") {
    const audioUrl =
      typeof detalle.audio_url === "string" && /^https?:\/\//i.test(detalle.audio_url.trim())
        ? normalizarUrlImg(detalle.audio_url)
        : null;
    if (audioUrl) {
      segmentos.push({
        tipo: "audio",
        url: audioUrl,
        mime: typeof detalle.audio_mime === "string" ? detalle.audio_mime : null,
        transcripcion:
          typeof detalle.transcripcion === "string" && detalle.transcripcion.trim()
            ? detalle.transcripcion.trim()
            : null,
      });
    }

    const docUrl =
      typeof detalle.documento_url === "string" &&
      /^https?:\/\//i.test(detalle.documento_url.trim())
        ? normalizarUrlImg(detalle.documento_url)
        : null;
    if (docUrl) {
      segmentos.push({
        tipo: "documento",
        url: docUrl,
        nombre:
          typeof detalle.documento_nombre === "string" && detalle.documento_nombre.trim()
            ? detalle.documento_nombre.trim()
            : "Documento adjunto",
      });
    }
  }

  return segmentos;
}

export interface EntradaCompartirProductoCatalogo {
  negocio: string;
  nombreProducto: string;
  slugProducto: string;
  nombreVariante?: string | null;
  skuVariante?: string | null;
  precioUsd?: number | null;
  imagenUrl?: string | null;
  albumFotosUrl?: string | null;
  baseUrlTienda?: string;
  incluirFotoPrincipal?: boolean;
  incluirLinkWeb?: boolean;
  incluirLinkAlbum?: boolean;
  notaPersonalizada?: string;
}

export interface SalidaCompartirProductoCatalogo {
  imagenPrincipalUrl: string | null;
  urlWebProducto: string;
  urlAlbumProducto: string | null;
  textoMensaje: string;
  cuerpoConMarkdown: string;
}

const BASE_TIENDA_OMNICANAL: Record<string, string> = {
  tinkay: "https://tinkay-web.vercel.app",
  margaritas: "https://margaritas-web.vercel.app",
  tranqi: "https://tranqi-web.vercel.app",
  fastfix: "https://fastfix-web.vercel.app",
};

/**
 * Construye el mensaje comercial listo para enviar a WhatsApp o Chat Web desde un producto
 * del catálogo unificado: Foto principal + Link para revisar en la web + Link del álbum del producto.
 */
export function construirMensajeProductoCatalogoOmnicanal(
  entrada: EntradaCompartirProductoCatalogo
): SalidaCompartirProductoCatalogo {
  const neg = (entrada.negocio || "tinkay").trim().toLowerCase();
  const baseTienda = (
    entrada.baseUrlTienda?.trim() ||
    BASE_TIENDA_OMNICANAL[neg] ||
    BASE_TIENDA_OMNICANAL.tinkay!
  ).replace(/\/+$/, "");

  const slugLimpio = String(entrada.slugProducto || "")
    .trim()
    .replace(/^\/+|\/+$/g, "");
  const sku = entrada.skuVariante?.trim() || "";
  const urlWebProducto = slugLimpio
    ? `${baseTienda}/producto/${encodeURIComponent(slugLimpio)}${
        sku ? `?variante=${encodeURIComponent(sku)}` : ""
      }`
    : `${baseTienda}/#catalogo`;

  let imgAbsoluta: string | null = null;
  const imgCruda = entrada.imagenUrl?.trim() || "";
  if (imgCruda) {
    if (/^https?:\/\//i.test(imgCruda)) {
      imgAbsoluta = imgCruda;
    } else if (imgCruda.startsWith("/")) {
      imgAbsoluta = `${baseTienda}${imgCruda}`;
    }
  }

  const urlAlbumProducto =
    entrada.albumFotosUrl && /^https?:\/\//i.test(entrada.albumFotosUrl.trim())
      ? entrada.albumFotosUrl.trim()
      : null;

  const incluirFoto = entrada.incluirFotoPrincipal !== false && Boolean(imgAbsoluta);
  const incluirWeb = entrada.incluirLinkWeb !== false;
  const incluirAlbum = entrada.incluirLinkAlbum !== false && Boolean(urlAlbumProducto);

  const lineas: string[] = [];
  if (entrada.notaPersonalizada?.trim()) {
    lineas.push(entrada.notaPersonalizada.trim());
    lineas.push("");
  }

  const tituloCompleto = entrada.nombreVariante?.trim()
    ? `${entrada.nombreProducto.trim()} (${entrada.nombreVariante.trim()})`
    : entrada.nombreProducto.trim();

  const precioTxt =
    entrada.precioUsd != null && Number(entrada.precioUsd) > 0
      ? ` — $${Number(entrada.precioUsd).toFixed(2)} USD`
      : "";

  lineas.push(`🌸 *${tituloCompleto}*${precioTxt}`);

  if (incluirWeb) {
    lineas.push(`🌐 Revisar en la web: ${urlWebProducto}`);
  }
  if (incluirAlbum && urlAlbumProducto) {
    lineas.push(`📸 Álbum del producto: ${urlAlbumProducto}`);
  }

  const textoMensaje = lineas.join("\n").trim();
  const imagenPrincipalUrl = incluirFoto ? imgAbsoluta : null;
  const cuerpoConMarkdown = imagenPrincipalUrl
    ? `${textoMensaje}\n\n![${tituloCompleto}](${imagenPrincipalUrl})`
    : textoMensaje;

  return {
    imagenPrincipalUrl,
    urlWebProducto,
    urlAlbumProducto,
    textoMensaje,
    cuerpoConMarkdown,
  };
}

export function extraerTodasLasImagenesMensaje(mensaje: {
  contenido?: string | null;
  detalle?: Record<string, unknown> | null;
}): Array<{ tipo: "imagen"; alt: string; url: string }> {
  return extraerSegmentosMultimediaMensaje(mensaje.contenido || "", mensaje.detalle).filter(
    (s): s is { tipo: "imagen"; alt: string; url: string } => s.tipo === "imagen"
  );
}

export function normalizarHandleMencion(texto?: string | null): string {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "");
}

/**
 * Convierte sintaxis Markdown cruda (`![Título](https://...)`) en una vista previa limpia
 * de una sola línea para la lista izquierda de conversaciones en tiempo O(N) lineal.
 */
export function limpiarVistaPreviaMensajeOmnicanal(texto?: string | null): string {
  if (!texto) return "Conversación iniciada";
  const tokens = escanearEnlacesMarkdownLineal(texto);
  let reconstruido = "";
  let cursor = 0;

  for (const tk of tokens) {
    if (tk.inicio > cursor) {
      reconstruido += texto.slice(cursor, tk.inicio);
    }
    if (tk.esImagen) {
      reconstruido += tk.alt ? ` 📷 ${tk.alt} ` : " 📷 Foto ";
    } else {
      reconstruido += tk.alt || tk.url;
    }
    cursor = tk.fin;
  }
  if (cursor < texto.length) {
    reconstruido += texto.slice(cursor);
  }

  const limpio = reconstruido
    .replace(
      /https?:\/\/[^\s<>")]+\.(?:jpg|jpeg|png|webp|gif|heic)(?:\?[^\s<>")]*)?/gi,
      "📷 Foto"
    )
    .replace(
      /\(?https?:\/\/[^\s<>")]*(?:[?&](?:token|jwt|sig|signature)=eyJ[^\s<>")]*|\/whatsapp_business\/attachments[^\s<>")]*|\/v2\/whatsapp\/media[^\s<>")]*)\)?/gi,
      "📷 Foto"
    )
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return limpio || "📷 Imagen";
}
