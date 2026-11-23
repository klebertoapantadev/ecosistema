// Motor transversal de Marketing Digital, Meta Pixel, Catálogo XML (Facebook / Instagram /
// WhatsApp Business) y Captura de Atribución e Intención para ARIA (PLT-025).
// Este módulo es 100% isomórfico y libre de dependencias de servidor (next/headers o fs)
// para poder importarse de forma segura tanto en componentes cliente como en rutas de servidor.

export interface ConfiguracionMarketingPublica {
  activo: boolean;
  pixelId: string | null;
  dominioVerificacion: string | null;
  catalogoActivo: boolean;
}

export type IntencionPublicitaria =
  | "CONDOLENCIAS"
  | "EVENTOS"
  | "ENTREGA_INMEDIATA"
  | "ROMANTICO"
  | "CUMPLEANOS"
  | "PRODUCTO_PUNTUAL"
  | "SERVICIO_LEGAL"
  | "SERVICIO_MANTENIMIENTO"
  | "GENERAL";

export interface ContextoVistaVisitante {
  rutaActual?: string;
  categoriaActiva?: string;
  productoVistoSlug?: string;
  productoVistoNombre?: string;
  varianteSku?: string;
  precioVista?: number;
}

export interface AtribucionPublicitariaVisitante extends ContextoVistaVisitante {
  utmSource?: string;
  utmMedium?: string;
  utmCampaign?: string;
  utmContent?: string;
  utmTerm?: string;
  fbclid?: string;
  fbc?: string;
  fbp?: string;
  landingPath?: string;
  referrer?: string;
  capturadoEn?: string;
  intencionDetectada: IntencionPublicitaria;
}

export interface ReferralMetaWhatsapp {
  sourceType?: string;
  sourceId?: string;
  sourceUrl?: string;
  headline?: string;
  body?: string;
  ctwaClid?: string;
  intencionDetectada: IntencionPublicitaria;
}

export interface ItemEventoMeta {
  id: string;
  quantity: number;
  item_price?: number;
  title?: string;
}

export interface DatosEventoPixelMeta {
  content_ids?: string[];
  contents?: ItemEventoMeta[];
  content_name?: string;
  content_category?: string;
  content_type?: "product" | "product_group";
  value?: number;
  currency?: string;
  num_items?: number;
}

export interface ProductoFeedCatalogoMeta {
  idVarianteSku: string;
  idGrupoProducto: string;
  titulo: string;
  descripcion: string;
  enlaceProducto: string;
  imagenPrincipalUrl: string;
  imagenesAdicionalesUrls?: string[];
  precioRegularUsd: number;
  precioOfertaUsd?: number | null;
  disponibilidad?: "in stock" | "out of stock" | "preorder";
  marca: string;
  categoriaTexto?: string;
}

const PREFIJO_STORAGE_ATRIBUCION = "eco_meta_attr_v1_";
const TTL_ATRIBUCION_MS = 30 * 24 * 60 * 60 * 1000; // 30 días

function normalizarTexto(valor?: string | null): string {
  if (!valor) return "";
  return valor
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

export function detectarIntencionPublicitaria(fuentes: {
  utmCampaign?: string | null;
  utmContent?: string | null;
  utmTerm?: string | null;
  landingPath?: string | null;
  rutaActual?: string | null;
  categoriaActiva?: string | null;
  productoVistoNombre?: string | null;
  varianteSku?: string | null;
  headlineAnuncio?: string | null;
  textoAnuncio?: string | null;
}): IntencionPublicitaria {
  const combinado = normalizarTexto(
    [
      fuentes.utmCampaign,
      fuentes.utmContent,
      fuentes.utmTerm,
      fuentes.headlineAnuncio,
      fuentes.textoAnuncio,
      fuentes.categoriaActiva !== "todas" ? fuentes.categoriaActiva : "",
      fuentes.rutaActual,
      fuentes.landingPath,
      fuentes.productoVistoNombre,
    ]
      .filter(Boolean)
      .join(" | ")
  );

  if (
    /(condolenc|funebr|fallec|velaci|difunt|corona|tripode|pesame|sepelio|luto|exequi)/.test(
      combinado
    )
  ) {
    return "CONDOLENCIAS";
  }

  if (
    /(evento|boda|matrimonio|ceremonia|corporativ|graduaci|quincean|15\s*anos|proforma|decoracion|banquete|recepcion)/.test(
      combinado
    )
  ) {
    return "EVENTOS";
  }

  if (/(entrega[\s_-]*inmediata|urgente|hoy[\s_-]*mismo|express|1[\s_-]*2\s*h)/.test(combinado)) {
    return "ENTREGA_INMEDIATA";
  }

  if (/(aniversario|romantic|amor|san[\s_-]*valentin|novia|esposa|enamorad|pedida)/.test(combinado)) {
    return "ROMANTICO";
  }

  if (/(cumplean|happy[\s_-]*birthday|festejo|celebracion)/.test(combinado)) {
    return "CUMPLEANOS";
  }

  if (/(abogad|divorcio|juicio|demanda|contrato|legal|notari|juridic|mediacion)/.test(combinado)) {
    return "SERVICIO_LEGAL";
  }

  if (
    /(plomer|electric|reparaci|mantenimiento|fuga|instalaci|tecnico[\s_-]*hogar|cerraj)/.test(
      combinado
    )
  ) {
    return "SERVICIO_MANTENIMIENTO";
  }

  if (
    (fuentes.varianteSku && fuentes.varianteSku.trim().length > 0) ||
    /\/producto\//.test(combinado)
  ) {
    return "PRODUCTO_PUNTUAL";
  }

  return "GENERAL";
}

export function etiquetaIntencionLegible(intencion: IntencionPublicitaria): string {
  switch (intencion) {
    case "CONDOLENCIAS":
      return "Condolencias y Homenajes";
    case "EVENTOS":
      return "Eventos, Bodas y Ceremonias";
    case "ENTREGA_INMEDIATA":
      return "Entrega Inmediata Hoy";
    case "ROMANTICO":
      return "Amor y Aniversario";
    case "CUMPLEANOS":
      return "Cumpleaños y Celebración";
    case "PRODUCTO_PUNTUAL":
      return "Interés en Producto Específico";
    case "SERVICIO_LEGAL":
      return "Asesoría Legal";
    case "SERVICIO_MANTENIMIENTO":
      return "Mantenimiento del Hogar";
    default:
      return "Consulta General";
  }
}

function guiaTonoAriaPorIntencion(
  intencion: IntencionPublicitaria,
  productoDetalle?: string
): string {
  switch (intencion) {
    case "CONDOLENCIAS":
      return (
        "TONO OBLIGATORIO: Sereno, empático, muy respetuoso y sobrio. " +
        "PROHIBIDO usar emojis festivos (🎉, 😍, 🎂, 🥳). " +
        "Prioriza recomendar coronas, trípodes o arreglos fúnebres sobrios, consulta con delicadeza la sala de velación/capilla, horario requerido y el texto para la cinta o tarjeta de condolencia."
      );
    case "EVENTOS":
      return (
        "ENFOQUE CONSULTIVO DE EVENTOS: El cliente llega interesado en decoración de eventos, bodas o ceremonias. " +
        "Si su consulta es abierta, saluda como especialista en eventos, pregúntale qué tipo de celebración planea, fecha aproximada y lugar, sugiere la colección de Eventos y ofrécele armar una Proforma formal."
      );
    case "ENTREGA_INMEDIATA":
      return (
        "PRIORIDAD RAPIDEZ HOY: El cliente busca entrega rápida en el día. " +
        "Prioriza los arreglos listos para Entrega Inmediata (1 a 2 horas) e invítale a compartir su ubicación de Google Maps para confirmar el envío al instante."
      );
    case "ROMANTICO":
      return (
        "ENFOQUE ROMÁNTICO / DETALLE ESPECIAL: Sugiere boxes de rosas, ramos coreanos o arreglos de autor e invita a personalizar la tarjeta dedicatoria (incluso con canción/QR si desea)."
      );
    case "CUMPLEANOS":
      return (
        "ENFOQUE CUMPLEAÑOS: Tono cálido y alegre; sugiere arreglos coloridos, boxes florales y complementos de celebración."
      );
    case "PRODUCTO_PUNTUAL":
      return (
        `ENFOQUE EN ARREGLO ESPECÍFICO${productoDetalle ? ` (${productoDetalle})` : ""}: ` +
        "El cliente estaba revisando este producto/variante puntual. Si hace una pregunta general como 'precio', 'disponibilidad' o 'envío', responde tomando este arreglo como referencia principal."
      );
    case "SERVICIO_LEGAL":
      return (
        "ENFOQUE ASESORÍA JURÍDICA: El visitante proviene de una campaña legal específica; orienta con claridad, empatía profesional y guía al agendamiento o plan de protección aplicable."
      );
    case "SERVICIO_MANTENIMIENTO":
      return (
        "ENFOQUE TÉCNICO HOGAR: El visitante proviene de una campaña de reparación/mantenimiento; indaga brevemente la urgencia y sector para coordinar atención técnica."
      );
    default:
      return "Atiende con calidez y descubre la ocasión o necesidad principal del cliente.";
  }
}

export function construirBloqueAtribucionParaAria(
  atribucion?: Partial<AtribucionPublicitariaVisitante> | null
): string {
  if (!atribucion) return "";

  const tieneSenal = Boolean(
    atribucion.utmSource ||
      atribucion.utmCampaign ||
      atribucion.utmContent ||
      atribucion.fbclid ||
      atribucion.productoVistoNombre ||
      atribucion.varianteSku ||
      (atribucion.categoriaActiva && atribucion.categoriaActiva !== "todas") ||
      (atribucion.rutaActual && atribucion.rutaActual !== "/")
  );
  if (!tieneSenal) return "";

  const intencion =
    atribucion.intencionDetectada ||
    detectarIntencionPublicitaria({
      utmCampaign: atribucion.utmCampaign,
      utmContent: atribucion.utmContent,
      utmTerm: atribucion.utmTerm,
      landingPath: atribucion.landingPath,
      rutaActual: atribucion.rutaActual,
      categoriaActiva: atribucion.categoriaActiva,
      productoVistoNombre: atribucion.productoVistoNombre,
      varianteSku: atribucion.varianteSku,
    });

  const origenRed = atribucion.utmSource
    ? atribucion.utmSource
    : atribucion.fbclid || atribucion.fbc
      ? "Meta Ads (Facebook / Instagram)"
      : "Navegación Web";

  const detalleProd = [
    atribucion.productoVistoNombre,
    atribucion.varianteSku ? `SKU ${atribucion.varianteSku}` : "",
    typeof atribucion.precioVista === "number" && atribucion.precioVista > 0
      ? `$${atribucion.precioVista.toFixed(2)} USD`
      : "",
  ]
    .filter(Boolean)
    .join(" · ");

  const partes: string[] = [`Origen=${origenRed}`];
  if (atribucion.utmCampaign) partes.push(`Campaña="${atribucion.utmCampaign}"`);
  if (atribucion.utmContent) partes.push(`Anuncio="${atribucion.utmContent}"`);
  if (atribucion.landingPath && atribucion.landingPath !== "/") {
    partes.push(`Aterrizaje="${atribucion.landingPath}"`);
  }
  if (atribucion.rutaActual && atribucion.rutaActual !== "/") {
    partes.push(`Página actual="${atribucion.rutaActual}"`);
  }
  if (atribucion.categoriaActiva && atribucion.categoriaActiva !== "todas") {
    partes.push(`Categoría vista="${atribucion.categoriaActiva}"`);
  }
  if (detalleProd) partes.push(`Producto en pantalla="${detalleProd}"`);
  partes.push(`Intención inicial=${etiquetaIntencionLegible(intencion)}`);

  return (
    `\n[CONTEXTO PUBLICITARIO Y NAVEGACIÓN DEL CLIENTE: ${partes.join(" | ")}. ` +
    `${guiaTonoAriaPorIntencion(intencion, detalleProd)} ` +
    `REGLA DE PRIORIDAD: Usa este contexto cuando el mensaje del cliente sea breve o abierto (ej. "Hola", "Información", "Precios"). ` +
    `Si el cliente solicita explícitamente otra ocasión, categoría o producto distinto al anuncio, prioriza de inmediato lo que el cliente escribió sin forzar el tema de la campaña.]`
  );
}

export function extraerReferralMetaDePayloadYcloud(
  payload: Record<string, unknown> | null | undefined
): ReferralMetaWhatsapp | null {
  if (!payload || typeof payload !== "object") return null;
  const inbound: any =
    (payload as any).whatsappInboundMessage ??
    (payload as any).whatsappMessage ??
    (payload as any).message ??
    null;
  const ref: any = inbound?.referral ?? (payload as any).referral ?? null;
  if (!ref || typeof ref !== "object") return null;

  const sourceType = typeof ref.source_type === "string" ? ref.source_type.trim() : undefined;
  const sourceId = typeof ref.source_id === "string" ? ref.source_id.trim() : undefined;
  const sourceUrl = typeof ref.source_url === "string" ? ref.source_url.trim() : undefined;
  const headline = typeof ref.headline === "string" ? ref.headline.trim() : undefined;
  const body = typeof ref.body === "string" ? ref.body.trim() : undefined;
  const ctwaClid = typeof ref.ctwa_clid === "string" ? ref.ctwa_clid.trim() : undefined;

  if (!sourceType && !headline && !body && !ctwaClid && !sourceUrl) {
    return null;
  }

  const intencionDetectada = detectarIntencionPublicitaria({
    headlineAnuncio: headline,
    textoAnuncio: body,
    rutaActual: sourceUrl,
  });

  return {
    sourceType,
    sourceId,
    sourceUrl,
    headline,
    body,
    ctwaClid,
    intencionDetectada,
  };
}

export function construirBloqueReferralWhatsappParaAria(
  referral?: ReferralMetaWhatsapp | null
): string {
  if (!referral) return "";
  const partes: string[] = [
    `Origen=Anuncio Meta Click-to-WhatsApp (${referral.sourceType || "ad"})`,
    `Intención detectada=${etiquetaIntencionLegible(referral.intencionDetectada)}`,
  ];
  if (referral.headline) partes.push(`Título del anuncio="${referral.headline.slice(0, 160)}"`);
  if (referral.body) partes.push(`Texto del anuncio="${referral.body.slice(0, 260)}"`);
  if (referral.sourceUrl) partes.push(`URL anuncio=${referral.sourceUrl}`);

  return (
    `\n[ORIGEN PUBLICITARIO META ADS EN WHATSAPP: ${partes.join(" | ")}. ` +
    `${guiaTonoAriaPorIntencion(referral.intencionDetectada, referral.headline)} ` +
    `Aunque el cliente escriba solo "Hola" o "Precio", responde conectando directamente con lo anunciado. ` +
    `Si el cliente pide explícitamente algo distinto al anuncio, atiende de inmediato lo que él solicite.]`
  );
}

export function obtenerSaludoInicialChatPorIntencion(
  intencion: IntencionPublicitaria,
  opciones?: { nombreAgente?: string; nombreNegocio?: string; productoNombre?: string }
): string {
  const agente = opciones?.nombreAgente || "Mía";
  const negocio = opciones?.nombreNegocio || "Tinkay";

  switch (intencion) {
    case "CONDOLENCIAS":
      return `Hola, soy ${agente} de ${negocio}. Te acompaño con total respeto a elegir un arreglo sobrio de condolencias y coordinar su entrega puntual en sala de velación o domicilio. ¿Para qué sector o capilla necesitas el envío?`;
    case "EVENTOS":
      return `¡Hola! Soy ${agente} 🌿, asesora de eventos y diseño floral de ${negocio}. Cuéntame qué celebración estás planeando (boda, evento corporativo o ceremonia) y la fecha aproximada para ayudarte con ideas o armar tu proforma.`;
    case "ENTREGA_INMEDIATA":
      return `¡Hola! Soy ${agente} 🌿 de ${negocio}. Tenemos arreglos frescos listos para entrega inmediata en 1 a 2 horas. Escríbeme aquí o toca el botón de WhatsApp para coordinar tu envío al instante.`;
    case "PRODUCTO_PUNTUAL":
      if (opciones?.productoNombre) {
        return `¡Hola! Soy ${agente} 🌿 de ${negocio}. Veo que estás revisando "${opciones.productoNombre}". ¿Te ayudo aquí o prefieres continuar directo por WhatsApp?`;
      }
      break;
    default:
      break;
  }

  return `¡Hola! Soy ${agente} 🌿, sommelier floral de ${negocio}. ¿Para qué ocasión o evento especial buscamos flores hoy? Puedo asesorarte aquí en vivo o toca el ícono de WhatsApp para hablar directo con nuestra tienda.`;
}

export function construirMensajeWhatsappContextual(
  intencion: IntencionPublicitaria,
  opciones?: { nombreNegocio?: string; productoNombre?: string; varianteSku?: string }
): string {
  const neg = opciones?.nombreNegocio || "Tinkay";
  if (opciones?.productoNombre) {
    const skuTxt = opciones.varianteSku ? ` (${opciones.varianteSku})` : "";
    return `Hola ${neg}, estoy viendo "${opciones.productoNombre}"${skuTxt} en su web y quisiera consultar disponibilidad.`;
  }
  switch (intencion) {
    case "CONDOLENCIAS":
      return `Hola ${neg}, quisiera consultar por arreglos de condolencias y tiempos de entrega.`;
    case "EVENTOS":
      return `Hola ${neg}, vi su información de decoración para eventos y quisiera cotizar una fecha.`;
    case "ENTREGA_INMEDIATA":
      return `Hola ${neg}, busco un arreglo floral con entrega inmediata hoy.`;
    case "ROMANTICO":
      return `Hola ${neg}, busco un detalle floral especial para aniversario / sorpresa.`;
    default:
      return `Hola ${neg}, vengo desde su página web y quisiera asesoría con un pedido.`;
  }
}

// ═══════════ Helpers de Cookies (_fbc, _fbp) y Persistencia en Navegador ═══════════

function leerCookieNavegador(nombre: string): string | undefined {
  if (typeof document === "undefined") return undefined;
  const prefijo = `${nombre}=`;
  const partes = document.cookie ? document.cookie.split("; ") : [];
  for (const p of partes) {
    if (p.startsWith(prefijo)) {
      return decodeURIComponent(p.slice(prefijo.length));
    }
  }
  return undefined;
}

function escribirCookieNavegador(nombre: string, valor: string, dias = 90): void {
  if (typeof document === "undefined") return;
  try {
    const exp = new Date(Date.now() + dias * 24 * 60 * 60 * 1000).toUTCString();
    document.cookie = `${nombre}=${encodeURIComponent(valor)}; expires=${exp}; path=/; SameSite=Lax`;
  } catch {
    // Ignorar entornos restringidos
  }
}

export function capturarYPersistirAtribucionNavegador(
  negocio: string,
  contextoVista?: ContextoVistaVisitante
): AtribucionPublicitariaVisitante {
  const neg = (negocio || "ecosistema").trim().toLowerCase();
  const claveStorage = `${PREFIJO_STORAGE_ATRIBUCION}${neg}`;

  if (typeof window === "undefined") {
    return {
      ...contextoVista,
      intencionDetectada: detectarIntencionPublicitaria(contextoVista ?? {}),
    };
  }

  let previo: Partial<AtribucionPublicitariaVisitante> = {};
  try {
    const crudo = window.localStorage.getItem(claveStorage);
    if (crudo) {
      const parsed = JSON.parse(crudo) as Partial<AtribucionPublicitariaVisitante>;
      const ts = parsed.capturadoEn ? Date.parse(parsed.capturadoEn) : 0;
      if (!ts || Date.now() - ts <= TTL_ATRIBUCION_MS) {
        previo = parsed;
      } else {
        window.localStorage.removeItem(claveStorage);
      }
    }
  } catch {
    previo = {};
  }

  const sp = new URLSearchParams(window.location.search || "");
  const utmSourceUrl = sp.get("utm_source")?.trim() || undefined;
  const utmMediumUrl = sp.get("utm_medium")?.trim() || undefined;
  const utmCampaignUrl = sp.get("utm_campaign")?.trim() || undefined;
  const utmContentUrl = sp.get("utm_content")?.trim() || undefined;
  const utmTermUrl = sp.get("utm_term")?.trim() || undefined;
  const fbclidUrl = sp.get("fbclid")?.trim() || undefined;

  let fbc = leerCookieNavegador("_fbc") || previo.fbc;
  if (fbclidUrl) {
    fbc = `fb.1.${Date.now()}.${fbclidUrl}`;
    escribirCookieNavegador("_fbc", fbc, 90);
  }

  let fbp = leerCookieNavegador("_fbp") || previo.fbp;
  if (!fbp) {
    const azar = Math.floor(1000000000 + Math.random() * 9000000000);
    fbp = `fb.1.${Date.now()}.${azar}`;
    escribirCookieNavegador("_fbp", fbp, 90);
  }

  const llegaNuevaCampana = Boolean(utmSourceUrl || utmCampaignUrl || fbclidUrl);
  const rutaActual =
    contextoVista?.rutaActual || `${window.location.pathname}${window.location.search || ""}`;

  const consolidado: AtribucionPublicitariaVisitante = {
    utmSource: utmSourceUrl ?? previo.utmSource,
    utmMedium: utmMediumUrl ?? previo.utmMedium,
    utmCampaign: utmCampaignUrl ?? previo.utmCampaign,
    utmContent: utmContentUrl ?? previo.utmContent,
    utmTerm: utmTermUrl ?? previo.utmTerm,
    fbclid: fbclidUrl ?? previo.fbclid,
    fbc,
    fbp,
    landingPath: llegaNuevaCampana
      ? `${window.location.pathname}${window.location.search || ""}`
      : previo.landingPath || `${window.location.pathname}${window.location.search || ""}`,
    referrer: llegaNuevaCampana ? document.referrer || previo.referrer : previo.referrer || document.referrer || undefined,
    capturadoEn: llegaNuevaCampana || !previo.capturadoEn ? new Date().toISOString() : previo.capturadoEn,
    rutaActual,
    categoriaActiva: contextoVista?.categoriaActiva ?? previo.categoriaActiva,
    productoVistoSlug: contextoVista?.productoVistoSlug ?? previo.productoVistoSlug,
    productoVistoNombre: contextoVista?.productoVistoNombre ?? previo.productoVistoNombre,
    varianteSku: contextoVista?.varianteSku ?? previo.varianteSku,
    precioVista: contextoVista?.precioVista ?? previo.precioVista,
    intencionDetectada: "GENERAL",
  };

  consolidado.intencionDetectada = detectarIntencionPublicitaria({
    utmCampaign: consolidado.utmCampaign,
    utmContent: consolidado.utmContent,
    utmTerm: consolidado.utmTerm,
    landingPath: consolidado.landingPath,
    rutaActual: consolidado.rutaActual,
    categoriaActiva: consolidado.categoriaActiva,
    productoVistoNombre: consolidado.productoVistoNombre,
    varianteSku: consolidado.varianteSku,
  });

  try {
    window.localStorage.setItem(claveStorage, JSON.stringify(consolidado));
  } catch {
    // Ignorar cuota o modo privado
  }

  return consolidado;
}

export function leerAtribucionNavegador(
  negocio: string,
  contextoVista?: ContextoVistaVisitante
): AtribucionPublicitariaVisitante {
  return capturarYPersistirAtribucionNavegador(negocio, contextoVista);
}

// ═══════════ Disparo seguro de eventos en el Pixel del Navegador (fbq) ═══════════

export function generarEventIdMeta(prefijo: string, identificadorUnico?: string): string {
  const limpio = (identificadorUnico || "").trim().replace(/[^A-Za-z0-9_-]/g, "");
  if (limpio) return limpio;
  const rand = Math.random().toString(36).slice(2, 10);
  return `${prefijo}-${Date.now()}-${rand}`;
}

export function dispararEventoPixelNavegador(
  nombreEvento:
    | "PageView"
    | "ViewContent"
    | "AddToCart"
    | "InitiateCheckout"
    | "Lead"
    | "Purchase",
  datos?: DatosEventoPixelMeta,
  eventId?: string
): void {
  if (typeof window === "undefined") return;
  const fbq = (window as unknown as { fbq?: (...args: unknown[]) => void }).fbq;
  if (typeof fbq !== "function") return;

  try {
    const payload: Record<string, unknown> = {};
    if (datos) {
      if (datos.content_ids && datos.content_ids.length > 0) payload.content_ids = datos.content_ids;
      if (datos.contents && datos.contents.length > 0) payload.contents = datos.contents;
      if (datos.content_name) payload.content_name = datos.content_name;
      if (datos.content_category) payload.content_category = datos.content_category;
      if (datos.content_type) payload.content_type = datos.content_type;
      if (typeof datos.value === "number" && Number.isFinite(datos.value)) {
        payload.value = Math.round(datos.value * 100) / 100;
      }
      if (datos.currency) payload.currency = datos.currency;
      if (typeof datos.num_items === "number") payload.num_items = datos.num_items;
    }

    if (eventId) {
      fbq("track", nombreEvento, payload, { eventID: eventId });
    } else if (Object.keys(payload).length > 0) {
      fbq("track", nombreEvento, payload);
    } else {
      fbq("track", nombreEvento);
    }
  } catch {
    // Nunca interrumpir la experiencia de compra por un bloqueador de anuncios
  }
}

// ═══════════ Generador XML Estándar Meta Commerce / WhatsApp Business ═══════════

function escaparXml(texto: string): string {
  return texto
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

export function generarXmlCatalogoMeta(params: {
  tituloTienda: string;
  descripcionTienda: string;
  urlBaseTienda: string;
  items: ProductoFeedCatalogoMeta[];
}): string {
  const urlTienda = params.urlBaseTienda.replace(/\/+$/, "");
  const nodosItems = params.items
    .filter((it) => it.idVarianteSku && it.titulo && it.imagenPrincipalUrl && it.precioRegularUsd > 0)
    .map((it) => {
      const adicionales = (it.imagenesAdicionalesUrls ?? [])
        .filter((u) => /^https?:\/\//i.test(u) && u !== it.imagenPrincipalUrl)
        .slice(0, 8)
        .map((u) => `      <g:additional_image_link>${escaparXml(u)}</g:additional_image_link>`)
        .join("\n");

      const tieneOferta =
        typeof it.precioOfertaUsd === "number" &&
        it.precioOfertaUsd > 0 &&
        it.precioOfertaUsd < it.precioRegularUsd;

      return [
        "    <item>",
        `      <g:id>${escaparXml(it.idVarianteSku)}</g:id>`,
        `      <g:item_group_id>${escaparXml(it.idGrupoProducto)}</g:item_group_id>`,
        `      <g:title>${escaparXml(it.titulo.slice(0, 150))}</g:title>`,
        `      <g:description>${escaparXml((it.descripcion || it.titulo).slice(0, 4900))}</g:description>`,
        `      <g:link>${escaparXml(it.enlaceProducto)}</g:link>`,
        `      <g:image_link>${escaparXml(it.imagenPrincipalUrl)}</g:image_link>`,
        ...(adicionales ? [adicionales] : []),
        `      <g:availability>${it.disponibilidad || "in stock"}</g:availability>`,
        "      <g:condition>new</g:condition>",
        `      <g:price>${it.precioRegularUsd.toFixed(2)} USD</g:price>`,
        ...(tieneOferta
          ? [`      <g:sale_price>${Number(it.precioOfertaUsd).toFixed(2)} USD</g:sale_price>`]
          : []),
        `      <g:brand>${escaparXml(it.marca.slice(0, 70))}</g:brand>`,
        ...(it.categoriaTexto
          ? [`      <g:product_type>${escaparXml(it.categoriaTexto.slice(0, 120))}</g:product_type>`]
          : []),
        "    </item>",
      ].join("\n");
    })
    .join("\n");

  return [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<rss version="2.0" xmlns:g="http://base.google.com/ns/1.0">',
    "  <channel>",
    `    <title>${escaparXml(params.tituloTienda)}</title>`,
    `    <link>${escaparXml(urlTienda)}</link>`,
    `    <description>${escaparXml(params.descripcionTienda)}</description>`,
    nodosItems,
    "  </channel>",
    "</rss>",
  ].join("\n");
}
