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
  { id: "etq-whatsapp", slug: "origen-whatsapp", nombre: "WhatsApp", color: "#16A34A", icono: "📱", orden: 9 },
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

export function nombreCanalRealtimeChatEquipo(negocio: string): string {
  return `eco-chat-equipo-${(negocio || "tinkay").trim().toLowerCase()}`;
}

export interface EventoBroadcastChatWeb {
  eventoId: string;
  claveHilo: string;
  conversacionId?: string | null;
  canal?: CanalOmnicanal;
  fase: "ENTRADA_CLIENTE" | "RESPUESTA_ARIA" | "EVENTO_ORDEN" | "INTERVENCION_HUMANA";
  contenido: string;
  imagenUrl?: string | null;
  imagenesUrls?: string[];
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
  canal?: string;
  clienteNombre: string;
  clienteTelefono?: string | null;
  autorOriginal?: string | null;
  textoOriginal?: string | null;
  imagenUrl?: string | null;
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
  | { tipo: "imagen"; alt: string; url: string };

interface TokenMarkdownEscaneado {
  inicio: number;
  fin: number;
  esImagen: boolean;
  alt: string;
  url: string;
  truncadoSinCerrar?: boolean;
}

const REGEX_EXT_IMAGEN = /\.(?:jpg|jpeg|png|webp|gif|heic)(?:\?.*)?$/i;

/**
 * Escáner determinista O(N) de un solo paso para etiquetas `![alt](https://...)` y `[texto](https://...)`
 * (soporta paréntesis balanceados `foto_(2).jpg`, espacios, saltos entre `]` y `(`, y cadenas truncadas
 * a 280 caracteres sin riesgo alguno de backtracking exponencial ReDoS en el navegador o servidor).
 */
function escanearEnlacesMarkdownLineal(texto: string): TokenMarkdownEscaneado[] {
  const tokens: TokenMarkdownEscaneado[] = [];
  const n = texto.length;
  let i = 0;

  while (i < n) {
    let inicioToken = i;
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

    const cierreCorchete = texto.indexOf("]", i + 1);
    if (cierreCorchete === -1 || cierreCorchete - i > 300) {
      i += 1;
      continue;
    }

    const alt = texto.slice(i + 1, cierreCorchete).trim();
    if (alt.includes("\n")) {
      i += 1;
      continue;
    }

    let p = cierreCorchete + 1;
    while (p < n && (texto[p] === " " || texto[p] === "\t" || texto[p] === "\r" || texto[p] === "\n")) {
      p += 1;
    }
    if (p >= n || texto[p] !== "(") {
      i = cierreCorchete + 1;
      continue;
    }

    let q = p + 1;
    while (q < n && (texto[q] === " " || texto[q] === "\t")) {
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
    const esUrlDeImagen = esImg || REGEX_EXT_IMAGEN.test(urlNormalizada);

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
 * (`![Abanico Canasta XL](https://.../abanico.jpg)`, saltos de línea entre `]` y `(`,
 * URLs con paréntesis `foto_(2).jpg` o espacios, enlaces directos a imágenes `.jpg/.png/.webp`
 * y metadatos `detalle.imagen_url` / `detalle.imagenes_urls`) en tiempo estrictamente lineal O(N).
 */
export function extraerSegmentosMultimediaMensaje(
  contenido: string,
  detalle?: Record<string, unknown> | null
): SegmentoMensajeMultimedia[] {
  let textoBase = String(contenido || "");
  const urlsVistas = new Set<string>();
  const normalizarUrlImg = (u: string): string => u.trim().replace(/\s+/g, "%20");

  // Si el mensaje vino como "📷 Imagen adjunta por el cliente: https://..." (historial previo sin extensión .jpg)
  textoBase = textoBase.replace(
    /📷\s*Imagen adjunta por el cliente:\s*(https?:\/\/[^\s<>"]+)/gi,
    (_m, url: string) => `![Foto enviada por el cliente](${normalizarUrlImg(url)})`
  );

  const tokens = escanearEnlacesMarkdownLineal(textoBase);
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
      urlsVistas.add(tk.url);
      segmentosPreliminares.push({ tipo: "imagen", alt: tk.alt, url: tk.url });
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

  // Detectar URLs de imagen sueltas dentro de bloques de texto (ej. https://.../foto.jpg sin corchetes)
  const segmentos: SegmentoMensajeMultimedia[] = [];
  const regexImgSuelta = /(https?:\/\/[^\s<>")]+\.(?:jpg|jpeg|png|webp|gif|heic)(?:\?[^\s<>")]*)?)/gi;

  for (const seg of segmentosPreliminares) {
    if (seg.tipo === "imagen") {
      segmentos.push(seg);
      continue;
    }
    const partes = seg.texto.split(regexImgSuelta);
    for (const parte of partes) {
      const p = parte.trim();
      if (!p) continue;
      if (/^https?:\/\//i.test(p) && REGEX_EXT_IMAGEN.test(p)) {
        const limpia = normalizarUrlImg(p);
        urlsVistas.add(limpia);
        segmentos.push({ tipo: "imagen", alt: "", url: limpia });
      } else {
        segmentos.push({ tipo: "texto", texto: p });
      }
    }
  }

  // Anexar imágenes de `detalle.imagen_url` o `detalle.imagenes_urls` si no estaban ya en el texto
  if (detalle && typeof detalle === "object") {
    const urlUnica =
      typeof detalle.imagen_url === "string" && /^https?:\/\//i.test(detalle.imagen_url.trim())
        ? normalizarUrlImg(detalle.imagen_url)
        : null;
    if (urlUnica && !urlsVistas.has(urlUnica)) {
      urlsVistas.add(urlUnica);
      segmentos.push({ tipo: "imagen", alt: "", url: urlUnica });
    }
    if (Array.isArray(detalle.imagenes_urls)) {
      for (const item of detalle.imagenes_urls) {
        if (typeof item === "string" && /^https?:\/\//i.test(item.trim())) {
          const limpia = normalizarUrlImg(item);
          if (!urlsVistas.has(limpia)) {
            urlsVistas.add(limpia);
            segmentos.push({ tipo: "imagen", alt: "", url: limpia });
          }
        }
      }
    }
  }

  return segmentos;
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
    .replace(/\*\*([^*]+)\*\*/g, "$1")
    .replace(/\s+/g, " ")
    .trim();
  return limpio || "📷 Imagen";
}
