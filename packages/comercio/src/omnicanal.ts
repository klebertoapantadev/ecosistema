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
  clasificacionPedido?: string; // 'FLORISTERIA_OCASIONES' | 'CONDOLENCIAS' | 'EVENTOS' | 'EXEQUIALES'
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
  franjaHora?: string; // Ej. `A) 09:00 - 13:00` o `HORA_EXACTA` (antes `-🕙 Hora`)
  horaExacta?: string; // Ej. `10:30` cuando aplica hora puntual
  salaServicio?: string; // Sala Exequiales (Sala 1..4 / Capilla / Oficina)
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

export interface FichaClienteOmnicanal {
  nombrePersonalizado?: string | null;
  calificacionEstrellas?: number | null;
  notasCliente?: string | null;
  actualizadoEn?: string | null;
  actualizadoPor?: string | null;
  actualizadoPorNombre?: string | null;
}

export interface RegistroVisitaWebOmnicanal {
  titulo?: string | null;
  productoNombre?: string | null;
  slugProducto?: string | null;
  productoSlug?: string | null;
  varianteNombre?: string | null;
  pvp?: number | null;
  url?: string | null;
  urlPagina?: string | null;
  vistoEn: string;
  direccion?: "WEB_A_WHATSAPP" | "WHATSAPP_A_WEB";
}

export interface PuenteOmnicanalCliente {
  refWeb?: string | null;
  refWhatsapp?: string | null;
  wref?: string | null;
  claveHiloWebVinculado?: string | null;
  conversacionWebVinculadaId?: string | null;
  conversacionWhatsappVinculadaId?: string | null;
  origenInicial?: "WEB_A_WHATSAPP" | "WHATSAPP_A_WEB" | null;
  vinculadoEn?: string | null;
  ultimoProductoVistoWeb?: RegistroVisitaWebOmnicanal | null;
  historialVisitasWeb?: RegistroVisitaWebOmnicanal[];
}

export const SUGERENCIAS_NOTAS_CLIENTE_OMNICANAL: string[] = [
  "Cliente de eventos",
  "Cliente frecuente",
  "Recomendado Nancy",
  "Cliente problemático",
  "Corporativo / Factura SRI",
];

export function describirCalificacionCliente(estrellas?: number | null): string {
  const n = Number(estrellas || 0);
  switch (n) {
    case 1:
      return "1★ · Cliente crítico / alerta";
    case 2:
      return "2★ · Atención delicada";
    case 3:
      return "3★ · Cliente regular";
    case 4:
      return "4★ · Buen cliente";
    case 5:
      return "5★ · Cliente excelente / VIP";
    default:
      return "Sin calificación";
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
  fichaCliente?: FichaClienteOmnicanal | null;
  puenteOmnicanal?: PuenteOmnicanalCliente | null;
  lineaWhatsappId?: string | null;
  lineaWhatsappCodigo?: string | null;
  lineaWhatsappNombre?: string | null;
  lineaWhatsappRol?: string | null;
  lineaWhatsappColor?: string | null;
  lineaWhatsappNumero?: string | null;
  visibilidad?: "EQUIPO_VENTAS" | "SOLO_ADMIN" | "SOLO_TITULAR";
  titularPrivadoId?: string | null;
  iaBloqueadaPermanente?: boolean;
  contactoClasificacion?: string | null;
  contactoPoliticaIa?: string | null;
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
  calificacionEstrellas?: number | null;
  notasCliente?: string | null;
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
    !/^(Visitante Web|WhatsApp\s*\+|Facebook\s+\d+|Instagram\s+\d+)/i.test(
      conversacion.remitenteNombre
    )
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

export function nombreCanalRealtimeOmnicanalPrivado(negocio: string): string {
  return `eco-omnicanal-privado-${(negocio || "tinkay").trim().toLowerCase()}`;
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
  visibilidad?: "EQUIPO_VENTAS" | "SOLO_ADMIN" | "SOLO_TITULAR";
  titularPrivadoId?: string | null;
  lineaWhatsappId?: string | null;
  lineaWhatsappNombre?: string | null;
  lineaWhatsappCodigo?: string | null;
  lineaWhatsappColor?: string | null;
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
  visibilidad?: "EQUIPO_VENTAS" | "SOLO_ADMIN" | "SOLO_TITULAR";
  titularPrivadoId?: string | null;
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
  wref?: string | null;
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
  const urlWebSinRef = slugLimpio
    ? `${baseTienda}/producto/${encodeURIComponent(slugLimpio)}${
        sku ? `?variante=${encodeURIComponent(sku)}` : ""
      }`
    : `${baseTienda}/#catalogo`;
  const urlWebProducto = entrada.wref
    ? anexarParametroRefUrl(urlWebSinRef, "wref", entrada.wref)
    : urlWebSinRef;

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

function hashFnv1aBase36Corto(semilla: string, longitud = 6): string {
  const txt = String(semilla || "eco").trim();
  let h1 = 0x811c9dc5;
  let h2 = 0x01000193;
  for (let i = 0; i < txt.length; i++) {
    const ch = txt.charCodeAt(i);
    h1 ^= ch;
    h1 = Math.imul(h1, 0x01000193) >>> 0;
    h2 ^= ch + i;
    h2 = Math.imul(h2, 0x85ebca6b) >>> 0;
  }
  const combinado = `${h1.toString(36)}${h2.toString(36)}`
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "");
  return (combinado + "8K4P2M").slice(0, longitud);
}

/**
 * Genera un código corto determinístico (`TNK-XXXXXX`) para correlacionar la sesión Web de un
 * visitante cuando salta a escribirnos por WhatsApp (`Web → WhatsApp`).
 */
export function generarCodigoRefVisitanteWeb(semillaId: string, negocio = "tinkay"): string {
  const neg = (negocio || "tinkay").trim().toLowerCase();
  const pref =
    neg.startsWith("mrg") || neg.includes("margarita")
      ? "MRG"
      : neg.startsWith("ffh") || neg.includes("fastfix")
        ? "FFH"
        : neg.startsWith("trq") || neg.includes("tranq")
          ? "TRQ"
          : "TNK";
  return `${pref}-${hashFnv1aBase36Corto(semillaId, 6)}`;
}

/**
 * Genera un código corto determinístico (`WA-XXXXXX`) sin exponer datos sensibles para adjuntar
 * en los enlaces enviados por WhatsApp hacia la tienda web (`WhatsApp → Web`).
 */
export function generarCodigoRefWhatsapp(conversacionId: string): string {
  return `WA-${hashFnv1aBase36Corto(conversacionId, 6)}`;
}

/**
 * Extrae el código de correlación Web (`TNK-XXXXXX`) de un mensaje entrante de WhatsApp o URL.
 */
export function extraerCodigoRefWebDeTexto(texto?: string | null): string | null {
  if (!texto) return null;
  const porQuery = texto.match(/[?&]ref=((?:TNK|MRG|FFH|TRQ|WEB)-[A-Z0-9]{5,8})/i);
  if (porQuery?.[1]) return porQuery[1].toUpperCase();
  const directo = texto.match(/\b((?:TNK|MRG|FFH|TRQ|WEB)-[A-Z0-9]{5,8})\b/i);
  if (directo?.[1]) return directo[1].toUpperCase();
  return null;
}

/**
 * Extrae el código de correlación de WhatsApp (`WA-XXXXXX`) cuando un cliente llega a la web.
 */
export function extraerCodigoRefWhatsappDeUrl(urlOSearch?: string | null): string | null {
  if (!urlOSearch) return null;
  const porParam = urlOSearch.match(/[?&]wref=(WA-[A-Z0-9]{5,8})/i);
  if (porParam?.[1]) return porParam[1].toUpperCase();
  const directo = urlOSearch.match(/\b(WA-[A-Z0-9]{5,8})\b/i);
  if (directo?.[1]) return directo[1].toUpperCase();
  return null;
}

export function anexarParametroRefUrl(
  url: string,
  clave: string,
  valor?: string | null
): string {
  const valLimpio = (valor || "").trim();
  if (!valLimpio) return url;
  const hashIdx = url.indexOf("#");
  const baseSinHash = hashIdx >= 0 ? url.slice(0, hashIdx) : url;
  const hashParte = hashIdx >= 0 ? url.slice(hashIdx) : "";
  const separador = baseSinHash.includes("?") ? "&" : "?";
  return `${baseSinHash}${separador}${encodeURIComponent(clave)}=${encodeURIComponent(
    valLimpio
  )}${hashParte}`;
}

/**
 * Estandariza números telefónicos de distintos formatos (`0996438873`, `996438873`,
 * `593996438873`, `+593 99 643 8873`) a formato internacional uniforme (`+593996438873`).
 */
export function formatearTelefonoEstandarOmnicanal(telefono?: string | null): string | null {
  const raw = String(telefono || "").trim();
  if (!raw) return null;
  const digitos = raw.replace(/\D+/g, "");
  if (digitos.length === 10 && digitos.startsWith("09")) {
    return `+593${digitos.slice(1)}`;
  }
  if (digitos.length === 9 && digitos.startsWith("9")) {
    return `+593${digitos}`;
  }
  if (digitos.length === 12 && digitos.startsWith("5939")) {
    return `+${digitos}`;
  }
  if (digitos.length >= 10) {
    return `+${digitos}`;
  }
  return raw;
}

export interface GrupoClienteOmnicanal {
  claveGrupo: string;
  nombreMostrado: string;
  telefonoEstandar: string | null;
  correo: string | null;
  conversacionPrincipal: ConversacionOmnicanal;
  conversaciones: ConversacionOmnicanal[];
  canalesActivos: CanalOmnicanal[];
  noLeidosTotal: number;
  calificacionEstrellas: number | null;
  notasCliente: string | null;
  etiquetasIds: string[];
}

const ORDEN_PRIORIDAD_CANAL: Record<string, number> = {
  whatsapp: 0,
  web: 1,
  instagram: 2,
  facebook: 3,
  telegram: 4,
  tiktok: 5,
};

function esNombreGenericoOmnicanal(nombre?: string | null): boolean {
  const n = String(nombre || "").trim();
  if (!n) return true;
  return /^(whatsapp\s*\+?\d*|facebook\s+\d+|instagram\s+\d+|visitante\s+web.*|cliente(\s+web|\s+whatsapp|\s+facebook|\s+instagram)?)$/i.test(
    n
  );
}

export function etiquetaCanalMensajeria(canal: CanalOmnicanal | string): string {
  switch (String(canal || "").trim().toLowerCase()) {
    case "whatsapp":
      return "WhatsApp";
    case "facebook":
      return "Facebook Messenger";
    case "instagram":
      return "Instagram Direct";
    case "telegram":
      return "Telegram";
    case "tiktok":
      return "TikTok";
    default:
      return "Chat Web";
  }
}

/**
 * Regla determinística del modo inicial Manual vs. IA ARIA individual por chat
 * (espejo exacto de `com_fn_omnicanal_procesar_webhook_meta` y `ycloud`):
 * - Si `modoManualDefecto = true`, todo chat nuevo o reabierto inicia en `EN_ATENCION_ASESORA` (Manual).
 * - Si el asesor activó IA individualmente en ese chat (`estadoPrevio = 'BOT_ACTIVO'`),
 *   el hilo conserva `BOT_ACTIVO` y permite la respuesta automática de ARIA.
 */
export function resolverEstadoAtencionMetaEntrante(entrada: {
  modoManualDefecto: boolean;
  canalHabilitado: boolean;
  pideHumano?: boolean;
  estadoPrevio?: EstadoAtencionOmnicanal | null;
}): {
  estadoAtencion: EstadoAtencionOmnicanal;
  debeInvocarAria: boolean;
} {
  const { modoManualDefecto, canalHabilitado, pideHumano = false, estadoPrevio = null } = entrada;

  let estadoAtencion: EstadoAtencionOmnicanal;
  if (!estadoPrevio) {
    if (pideHumano) {
      estadoAtencion = "ESCALADO_HUMANO";
    } else if (modoManualDefecto || !canalHabilitado) {
      estadoAtencion = "EN_ATENCION_ASESORA";
    } else {
      estadoAtencion = "BOT_ACTIVO";
    }
  } else if (estadoPrevio === "EN_ATENCION_ASESORA") {
    estadoAtencion = "EN_ATENCION_ASESORA";
  } else if (pideHumano) {
    estadoAtencion = "ESCALADO_HUMANO";
  } else if (estadoPrevio === "CERRADO") {
    estadoAtencion = modoManualDefecto || !canalHabilitado ? "EN_ATENCION_ASESORA" : "BOT_ACTIVO";
  } else {
    estadoAtencion = estadoPrevio;
  }

  return {
    estadoAtencion,
    debeInvocarAria: canalHabilitado && estadoAtencion === "BOT_ACTIVO",
  };
}

export type ModoAutoRespuestaComentariosMeta = "PALABRAS_CLAVE" | "TODOS";

export interface ReglaAutoRespuestaComentariosMeta {
  habilitado: boolean;
  modo: ModoAutoRespuestaComentariosMeta;
  soloRaiz: boolean;
  palabrasClave: string;
  urlTienda: string;
  respuestaCorta: string;
  respuestaCondolencias: string;
  respuestaEventos: string;
  enviarDm: boolean;
  plantillaDm: string;
}

export interface RegistroComentarioMetaOmnicanal {
  id: string;
  canal: "facebook" | "instagram";
  comentarioExternoId: string;
  postId?: string | null;
  autorNombre: string;
  textoComentario: string;
  reglaAplicada?: string | null;
  respuestaPublica?: string | null;
  respuestaDm?: string | null;
  estado: "RECIBIDO" | "RESPONDIDO" | "IGNORADO" | "ERROR";
  detalle?: Record<string, unknown>;
  creadoEn: string;
}

export const PALABRAS_CLAVE_COMENTARIOS_META_DEFECTO =
  "precio, precios, info, informacion, información, catalogo, catálogo, cuanto, cuánto, valor, costo, envio, envío, disponible, rosas, arreglo, arreglos, ramo, ramos, donde, dónde, ubicacion, ubicación, horario, quiero, pedir, comprar, whatsapp, necesito, corona, coronas, condolencias, velorio, boda, evento, eventos, cotizacion, cotización, direccion, dirección, ?";

export function evaluarAutoRespuestaComentarioMeta(entrada: {
  textoComentario: string;
  autorNombre?: string | null;
  esSubcomentario?: boolean;
  esCuentaPropia?: boolean;
  regla: ReglaAutoRespuestaComentariosMeta;
}): {
  debeResponder: boolean;
  motivo:
    | "CUENTA_PROPIA"
    | "DESHABILITADO"
    | "IGNORADO_SUBCOMENTARIO"
    | "SIN_PALABRA_CLAVE"
    | "CONDOLENCIAS"
    | "EVENTOS"
    | "PALABRA_CLAVE"
    | "GENERAL_TODOS";
  respuestaPublica: string | null;
  respuestaDm: string | null;
} {
  const texto = String(entrada.textoComentario || "").trim();
  if (!texto || entrada.esCuentaPropia) {
    return { debeResponder: false, motivo: "CUENTA_PROPIA", respuestaPublica: null, respuestaDm: null };
  }

  const r = entrada.regla;
  if (!r.habilitado) {
    return { debeResponder: false, motivo: "DESHABILITADO", respuestaPublica: null, respuestaDm: null };
  }
  if (r.soloRaiz && entrada.esSubcomentario) {
    return {
      debeResponder: false,
      motivo: "IGNORADO_SUBCOMENTARIO",
      respuestaPublica: null,
      respuestaDm: null,
    };
  }

  const esCondolencias =
    /(condolencia|corona|velaci[oó]n|velorio|funeral|p[eé]same|fallec|f[uú]nebre|exequi)/i.test(
      texto
    );
  const esEventos =
    /(evento|boda|matrimonio|decoraci[oó]n|proforma|corporativo|quincea[ñn])/i.test(texto);

  const textoMin = texto.toLowerCase();
  const coincide =
    esCondolencias ||
    esEventos ||
    (r.modo === "TODOS"
      ? texto.length >= 2
      : String(r.palabrasClave || "")
          .split(/[,;\n]+/)
          .map((k) => k.trim().toLowerCase())
          .filter(Boolean)
          .some((k) => textoMin.includes(k)));

  if (!coincide) {
    return {
      debeResponder: false,
      motivo: "SIN_PALABRA_CLAVE",
      respuestaPublica: null,
      respuestaDm: null,
    };
  }

  let motivo: "CONDOLENCIAS" | "EVENTOS" | "PALABRA_CLAVE" | "GENERAL_TODOS";
  let plantilla = r.respuestaCorta;
  if (esCondolencias) {
    motivo = "CONDOLENCIAS";
    plantilla = r.respuestaCondolencias || r.respuestaCorta;
  } else if (esEventos) {
    motivo = "EVENTOS";
    plantilla = r.respuestaEventos || r.respuestaCorta;
  } else {
    motivo = r.modo === "TODOS" ? "GENERAL_TODOS" : "PALABRA_CLAVE";
  }

  const primerNombre = String(entrada.autorNombre || "")
    .replace(/^@/, "")
    .trim()
    .split(/\s+/)[0] || "";
  const url = String(r.urlTienda || "https://www.tinkay.net")
    .trim()
    .replace(/\/+$/, "");

  const interpolar = (tpl: string) =>
    tpl
      .replace(/\{\{\s*nombre\s*\}\}/gi, primerNombre)
      .replace(/\{\{\s*url_tienda\s*\}\}/gi, url)
      .replace(/¡Hola\s+!/g, "¡Hola!")
      .replace(/Hola\s+,/g, "Hola,")
      .replace(/\s{2,}/g, " ")
      .trim();

  const respuestaPublica = interpolar(plantilla);
  const plantillaDmEfectiva =
    motivo === "CONDOLENCIAS"
      ? "Hola {{nombre}}, con todo respeto te compartimos nuestros arreglos de condolencias y entregas prioritarias en Quito: {{url_tienda}}/categoria/condolencias. Si necesitas ayuda personalizada, escríbenos por aquí y una asesora te atenderá de inmediato."
      : r.plantillaDm;
  const respuestaDm = r.enviarDm && plantillaDmEfectiva?.trim() ? interpolar(plantillaDmEfectiva) : null;

  return {
    debeResponder: Boolean(respuestaPublica),
    motivo,
    respuestaPublica: respuestaPublica || null,
    respuestaDm,
  };
}

/**
 * Agrupa conversaciones que pertenecen al mismo cliente a través de distintos canales
 * (teléfono normalizado sin importar formato `09...` vs `+593...`, correo electrónico,
 * `usuarioId`, `clienteId` o puente Web <-> WhatsApp), conservando cada hilo/canal
 * diferenciado dentro del grupo para alternar entre canales sin mezclar mensajes.
 */
export function agruparConversacionesPorClienteOmnicanal(
  conversaciones: ConversacionOmnicanal[]
): GrupoClienteOmnicanal[] {
  const n = conversaciones.length;
  if (n === 0) return [];

  const padre = Array.from({ length: n }, (_, i) => i);
  const encontrar = (x: number): number => {
    let r = x;
    while (padre[r] !== r) r = padre[r]!;
    let cur = x;
    while (padre[cur] !== r) {
      const sig = padre[cur]!;
      padre[cur] = r;
      cur = sig;
    }
    return r;
  };
  const unir = (a: number, b: number) => {
    const ra = encontrar(a);
    const rb = encontrar(b);
    if (ra !== rb) padre[rb] = ra;
  };

  const indicePorClave = new Map<string, number>();
  const registrarClave = (clave: string, idx: number) => {
    const prev = indicePorClave.get(clave);
    if (prev !== undefined) {
      unir(prev, idx);
    } else {
      indicePorClave.set(clave, idx);
    }
  };

  for (let i = 0; i < n; i++) {
    const c = conversaciones[i]!;
    registrarClave(`id:${c.id}`, i);

    const telNorm = normalizarTelefonoOmnicanal(c.remitenteTelefono);
    if (telNorm.length >= 8) {
      registrarClave(`tel:${telNorm}`, i);
    }

    const correoNorm = String(c.remitenteCorreo || "").trim().toLowerCase();
    if (correoNorm && correoNorm.includes("@")) {
      registrarClave(`mail:${correoNorm}`, i);
    }

    if (c.usuarioId) {
      registrarClave(`usu:${c.usuarioId}`, i);
    }

    if (c.clienteId) {
      registrarClave(`cli:${c.clienteId}`, i);
    }

    const refWeb = String(c.puenteOmnicanal?.refWeb || "").trim().toUpperCase();
    if (refWeb) {
      registrarClave(`ref:${refWeb}`, i);
    }

    if (c.puenteOmnicanal?.conversacionWebVinculadaId) {
      registrarClave(`id:${c.puenteOmnicanal.conversacionWebVinculadaId}`, i);
    }
    if (c.puenteOmnicanal?.conversacionWhatsappVinculadaId) {
      registrarClave(`id:${c.puenteOmnicanal.conversacionWhatsappVinculadaId}`, i);
    }
  }

  const buckets = new Map<number, ConversacionOmnicanal[]>();
  for (let i = 0; i < n; i++) {
    const r = encontrar(i);
    const lista = buckets.get(r);
    if (lista) {
      lista.push(conversaciones[i]!);
    } else {
      buckets.set(r, [conversaciones[i]!]);
    }
  }

  const grupos: GrupoClienteOmnicanal[] = [];
  for (const listaRaw of buckets.values()) {
    const ordenadas = [...listaRaw].sort((a, b) => {
      const aEsc = a.estadoAtencion === "ESCALADO_HUMANO" ? 0 : 1;
      const bEsc = b.estadoAtencion === "ESCALADO_HUMANO" ? 0 : 1;
      if (aEsc !== bEsc) return aEsc - bEsc;
      return (
        new Date(b.ultimoMensajeEn || 0).getTime() - new Date(a.ultimoMensajeEn || 0).getTime()
      );
    });

    const principal = ordenadas[0]!;

    // Nombre unificado: primero nombrePersonalizado de fichaCliente, luego primer nombre no genérico
    const conFichaNombre = ordenadas
      .filter((c) => Boolean(c.fichaCliente?.nombrePersonalizado?.trim()))
      .sort((a, b) =>
        String(b.fichaCliente?.actualizadoEn || "").localeCompare(
          String(a.fichaCliente?.actualizadoEn || "")
        )
      );
    const nombreMostrado =
      conFichaNombre[0]?.fichaCliente?.nombrePersonalizado?.trim() ||
      ordenadas.find((c) => !esNombreGenericoOmnicanal(c.remitenteNombre))?.remitenteNombre?.trim() ||
      principal.remitenteNombre ||
      "Cliente";

    const telEstandar =
      ordenadas
        .map((c) => formatearTelefonoEstandarOmnicanal(c.remitenteTelefono))
        .find((t): t is string => Boolean(t)) ?? null;

    const correo =
      ordenadas
        .map((c) => String(c.remitenteCorreo || "").trim().toLowerCase())
        .find((m) => Boolean(m && m.includes("@"))) ?? null;

    const canalesSet = new Set<CanalOmnicanal>();
    let noLeidosTotal = 0;
    const etiquetasSet = new Set<string>();
    let calificacionEstrellas: number | null = null;
    let notasCliente: string | null = null;

    for (const c of ordenadas) {
      canalesSet.add(c.canal || "web");
      noLeidosTotal += Number(c.noLeidosAsesora || 0);
      for (const etqId of c.etiquetasIds ?? []) {
        etiquetasSet.add(etqId);
      }
      if (calificacionEstrellas == null && c.fichaCliente?.calificacionEstrellas != null) {
        calificacionEstrellas = c.fichaCliente.calificacionEstrellas;
      }
      if (!notasCliente && c.fichaCliente?.notasCliente?.trim()) {
        notasCliente = c.fichaCliente.notasCliente.trim();
      }
    }

    const canalesActivos = Array.from(canalesSet).sort(
      (a, b) => (ORDEN_PRIORIDAD_CANAL[a] ?? 99) - (ORDEN_PRIORIDAD_CANAL[b] ?? 99)
    );

    const telClave = normalizarTelefonoOmnicanal(telEstandar);
    const claveGrupo = telClave.length >= 8 ? `tel:${telClave}` : `cnv:${principal.id}`;

    grupos.push({
      claveGrupo,
      nombreMostrado,
      telefonoEstandar: telEstandar,
      correo,
      conversacionPrincipal: principal,
      conversaciones: ordenadas,
      canalesActivos,
      noLeidosTotal,
      calificacionEstrellas,
      notasCliente,
      etiquetasIds: Array.from(etiquetasSet),
    });
  }

  return grupos.sort((a, b) => {
    const aEsc = a.conversaciones.some((c) => c.estadoAtencion === "ESCALADO_HUMANO") ? 0 : 1;
    const bEsc = b.conversaciones.some((c) => c.estadoAtencion === "ESCALADO_HUMANO") ? 0 : 1;
    if (aEsc !== bEsc) return aEsc - bEsc;
    return (
      new Date(b.conversacionPrincipal.ultimoMensajeEn || 0).getTime() -
      new Date(a.conversacionPrincipal.ultimoMensajeEn || 0).getTime()
    );
  });
}
