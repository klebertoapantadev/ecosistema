// Motor común e isomórfico de cobertura geográfica, polígonos de Pichincha,
// extracción universal de enlaces de mapas (Google Maps, Apple Maps, Waze) y
// cálculo tarifario de servicio a domicilio (PLT-008 / PLT-009 / TNK-002).
// Nota: Cero imports de `next/*` para ser consumible en Web, Server Actions, MCP y Capacitor.

export type ModoCobroZona = "GRATIS" | "TARIFA_FIJA" | "POR_KM";

export interface CoordenadaGeo {
  lat: number;
  lng: number;
}

export interface ZonaCoberturaLogistica {
  id: string;
  codigo: string;
  nombre: string;
  provincia: string;
  modoCobro: ModoCobroZona;
  tarifaFija: number;
  prioridad: number;
  activo: boolean;
  color: string;
  sectoresReferencia: string[];
  /** Vértices del polígono expresados como pares [lat, lng] */
  poligono: [number, number][];
}

export interface ConfiguracionLogisticaNegocio {
  negocio: string;
  activo: boolean;
  origenNombre: string;
  origenDireccion: string;
  origenMapaUrl: string;
  origenLat: number;
  origenLng: number;
  zonaGratisNombre: string;
  etiquetaEnvioGratis: string;
  tarifaPorKm: number;
  subsidioBaseUsd: number;
  recargoMinimoExtra: number;
  tarifaBaseNoIncluido: number;
  recargoHoraExacta: number;
  radioMaximoKm: number;
  factorVialRespaldo: number;
  permitirRetiroLocal: boolean;
  /** Si es true, la etiqueta visible al cliente incluye la distancia vial en km (nunca la fórmula interna) */
  mostrarKilometrosCliente: boolean;
  zonas: ZonaCoberturaLogistica[];
  actualizadoEn?: string | null;
}

export interface OpcionesCotizacionEnvio {
  config: ConfiguracionLogisticaNegocio;
  destino: CoordenadaGeo;
  distanciaVialKm?: number;
  fuenteDistancia?: "OSRM" | "ESTIMACION_VIAL";
  rutaGeometria?: [number, number][];
  /** Si el producto incluye envío gratis dentro de la zona por defecto (default: true) */
  deliveryIncluidoProducto?: boolean;
  /** Recargo adicional específico del producto (ej. furgoneta para pedestal monumental) */
  recargoLogisticoProducto?: number;
  /** Si el cliente eligió retirar directamente en el taller físico */
  retiroEnLocal?: boolean;
}

export interface ResultadoCotizacionEnvio {
  ok: boolean;
  dentroCobertura: boolean;
  reglaAplicada:
    | "RETIRO_LOCAL"
    | "ZONA_GRATIS"
    | "TARIFA_BASE_PRODUCTO"
    | "ZONA_TARIFA_FIJA"
    | "CALCULO_POR_KM"
    | "FUERA_DE_COBERTURA";
  origen: CoordenadaGeo;
  destino: CoordenadaGeo;
  zonaDetectada: {
    id: string;
    codigo: string;
    nombre: string;
    modoCobro: ModoCobroZona;
  } | null;
  /** Cuando un punto cae en 2 o más polígonos activos solapados, lista todas las áreas evaluadas (gana la tarifa más baja) */
  zonasCoincidentes?: Array<{
    id: string;
    codigo: string;
    nombre: string;
    modoCobro: ModoCobroZona;
    costoTotalEnvio: number;
  }>;
  distanciaLinealKm: number;
  distanciaVialKm: number;
  fuenteDistancia: "OSRM" | "ESTIMACION_VIAL";
  costoBaseEnvio: number;
  recargoProducto: number;
  costoTotalEnvio: number;
  etiquetaResumen: string;
  formulaDetalle: string;
  rutaGeometria?: [number, number][];
  urlGoogleMapsDestino: string;
}

export interface SugerenciaDireccionMapa {
  nombreCorto: string;
  direccionCompleta: string;
  lat: number;
  lng: number;
}

export const COORDENADAS_TALLER_TINKAY_DEFECTO: CoordenadaGeo = {
  lat: -0.1648075,
  lng: -78.466175,
};

export const URL_TIENDA_TINKAY_DEFECTO = "https://maps.app.goo.gl/D56gQohzuwha4sLf8";

export const ZONAS_PICHINCHA_POR_DEFECTO: ZonaCoberturaLogistica[] = [
  {
    id: "zon-centro-norte-quito",
    codigo: "centro_norte_quito",
    nombre: "Centro-Norte de Quito",
    provincia: "Pichincha",
    modoCobro: "GRATIS",
    tarifaFija: 0,
    prioridad: 1,
    activo: true,
    color: "#16A34A",
    sectoresReferencia: [
      "La Carolina",
      "González Suárez",
      "Iñaquito",
      "El Batán / Monteserrín",
      "La Mariscal / El Ejido",
      "Centro Histórico",
      "El Bosque / Quito Tenis",
      "El Inca / Ponceano / Condado",
    ],
    poligono: [
      [-0.222, -78.52],
      [-0.225, -78.492],
      [-0.203, -78.472],
      [-0.168, -78.455],
      [-0.135, -78.453],
      [-0.095, -78.462],
      [-0.096, -78.503],
      [-0.145, -78.506],
      [-0.188, -78.514],
    ],
  },
  {
    id: "zon-cumbaya-nayon",
    codigo: "cumbaya_nayon",
    nombre: "Cumbayá, Nayón y Lumbisí",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 3.5,
    prioridad: 2,
    activo: true,
    color: "#0284C7",
    sectoresReferencia: ["Parque de Cumbayá", "USFQ", "Nayón", "Tanda", "Lumbisí", "Jacarandá"],
    poligono: [
      [-0.235, -78.454],
      [-0.235, -78.405],
      [-0.145, -78.405],
      [-0.145, -78.453],
      [-0.168, -78.455],
      [-0.203, -78.471],
    ],
  },
  {
    id: "zon-tumbaco-puembo",
    codigo: "tumbaco_puembo",
    nombre: "Tumbaco, Puembo y Ruta Viva",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 6.0,
    prioridad: 3,
    activo: true,
    color: "#4F46E5",
    sectoresReferencia: ["Tumbaco Centro", "La Morita", "Hilacril", "El Arenal", "Puembo"],
    poligono: [
      [-0.255, -78.405],
      [-0.255, -78.32],
      [-0.15, -78.32],
      [-0.15, -78.405],
    ],
  },
  {
    id: "zon-valle-los-chillos",
    codigo: "valle_los_chillos",
    nombre: "Valle de los Chillos (Conocoto, San Rafael, Sangolquí)",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 6.0,
    prioridad: 4,
    activo: true,
    color: "#7C3AED",
    sectoresReferencia: ["Conocoto", "La Armenia", "San Rafael", "Capelo", "Sangolquí / ESPE"],
    poligono: [
      [-0.37, -78.49],
      [-0.37, -78.41],
      [-0.245, -78.41],
      [-0.245, -78.49],
    ],
  },
  {
    id: "zon-sur-quito",
    codigo: "sur_quito",
    nombre: "Sur de Quito",
    provincia: "Pichincha",
    modoCobro: "POR_KM",
    tarifaFija: 4.0,
    prioridad: 5,
    activo: true,
    color: "#D97706",
    sectoresReferencia: ["Villaflora", "El Recreo", "Solanda", "Quitumbe", "Chillogallo"],
    poligono: [
      [-0.355, -78.58],
      [-0.355, -78.49],
      [-0.225, -78.492],
      [-0.222, -78.52],
      [-0.24, -78.565],
    ],
  },
  {
    id: "zon-calderon-carapungo",
    codigo: "calderon_carapungo",
    nombre: "Calderón y Carapungo",
    provincia: "Pichincha",
    modoCobro: "POR_KM",
    tarifaFija: 4.0,
    prioridad: 6,
    activo: true,
    color: "#EA580C",
    sectoresReferencia: ["Carapungo", "Calderón Centro", "Marianitas", "Llano Grande"],
    poligono: [
      [-0.134, -78.462],
      [-0.134, -78.395],
      [-0.04, -78.395],
      [-0.04, -78.462],
    ],
  },
  {
    id: "zon-pomasqui-mitad-mundo",
    codigo: "pomasqui_mitad_mundo",
    nombre: "Pomasqui y Mitad del Mundo",
    provincia: "Pichincha",
    modoCobro: "POR_KM",
    tarifaFija: 5.0,
    prioridad: 7,
    activo: true,
    color: "#0D9488",
    sectoresReferencia: ["Pomasqui", "San Antonio de Pichincha", "Ciudad Mitad del Mundo"],
    poligono: [
      [-0.095, -78.503],
      [-0.095, -78.435],
      [0.025, -78.435],
      [0.025, -78.503],
    ],
  },
];

export function crearConfiguracionLogisticaPorDefecto(
  negocio: string
): ConfiguracionLogisticaNegocio {
  const negNorm = (negocio || "tinkay").trim().toLowerCase();
  const esFloristeria = negNorm === "tinkay" || negNorm === "margaritas";
  return {
    negocio: negNorm,
    activo: true,
    origenNombre:
      negNorm === "tinkay"
        ? "Taller Tinkay Floristería"
        : negNorm === "margaritas"
        ? "Taller Margaritas Floristería"
        : `Sede Matriz ${negNorm.charAt(0).toUpperCase() + negNorm.slice(1)}`,
    origenDireccion: "El Batán Alto / Monteserrín, Quito, Pichincha",
    origenMapaUrl: URL_TIENDA_TINKAY_DEFECTO,
    origenLat: COORDENADAS_TALLER_TINKAY_DEFECTO.lat,
    origenLng: COORDENADAS_TALLER_TINKAY_DEFECTO.lng,
    zonaGratisNombre: "Centro-Norte de Quito",
    etiquetaEnvioGratis: esFloristeria
      ? "🌸 Envío Gratis en Centro-Norte de Quito"
      : "🚚 Envío Gratis en Centro-Norte de Quito",
    tarifaPorKm: 0.5,
    subsidioBaseUsd: 3.0,
    recargoMinimoExtra: 1.0,
    tarifaBaseNoIncluido: 3.0,
    recargoHoraExacta: 10.0,
    radioMaximoKm: 45.0,
    factorVialRespaldo: 1.32,
    permitirRetiroLocal: true,
    mostrarKilometrosCliente: true,
    zonas: ZONAS_PICHINCHA_POR_DEFECTO.map((z) => ({
      ...z,
      sectoresReferencia: [...z.sectoresReferencia],
      poligono: z.poligono.map(([lat, lng]) => [lat, lng]),
    })),
    actualizadoEn: null,
  };
}

function redondearMoneda(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function redondearKm(valor: number): number {
  return Math.round(valor * 100) / 100;
}

export function esCoordenadaValida(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180 &&
    !(lat === 0 && lng === 0)
  );
}

/**
 * Calcula la distancia geodésica en línea recta (Haversine) en kilómetros.
 */
export function distanciaHaversineKm(a: CoordenadaGeo, b: CoordenadaGeo): number {
  const R = 6371; // Radio medio de la Tierra en km
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const lat1 = (a.lat * Math.PI) / 180;
  const lat2 = (b.lat * Math.PI) / 180;

  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h = sinLat * sinLat + Math.cos(lat1) * Math.cos(lat2) * sinLng * sinLng;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(Math.max(0, 1 - h)));
  return R * c;
}

/**
 * Algoritmo Ray-Casting para determinar si un punto (lat, lng) cae dentro de un polígono.
 */
export function puntoEnPoligono(
  punto: CoordenadaGeo,
  poligono: [number, number][]
): boolean {
  if (!Array.isArray(poligono) || poligono.length < 3) return false;

  const y = punto.lat;
  const x = punto.lng;
  let dentro = false;

  for (let i = 0, j = poligono.length - 1; i < poligono.length; j = i++) {
    const vertI = poligono[i];
    const vertJ = poligono[j];
    if (!vertI || !vertJ) continue;

    const yi = vertI[0];
    const xi = vertI[1];
    const yj = vertJ[0];
    const xj = vertJ[1];

    const intersecta =
      yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi + 1e-12) + xi;
    if (intersecta) dentro = !dentro;
  }

  return dentro;
}

/**
 * Detecta si un texto contiene una URL acortada de mapas que requiere resolución HTTP en servidor.
 */
export function esUrlMapaAcortada(texto: string): boolean {
  const limpio = (texto || "").trim();
  return /https?:\/\/(?:maps\.app\.goo\.gl|goo\.gl\/maps|waze\.com\/ul|ul\.waze\.com|maps\.apple\.com\/\?[^#]*address=|bit\.ly|tinyurl\.com)\/[^\s]*/i.test(
    limpio
  );
}

/**
 * Extrae la primera URL HTTP/HTTPS de mapas encontrada dentro de un mensaje libre (ej. chat o WhatsApp).
 */
export function extraerPrimeraUrlDeTexto(texto: string): string | null {
  const match = (texto || "").match(/https?:\/\/[^\s<>"')]+/i);
  if (!match?.[0]) return null;
  return match[0].replace(/[.,;!?]+$/, "");
}

/**
 * Extrae coordenadas (lat, lng) directamente de enlaces de Google Maps, Apple Maps, Waze,
 * OpenStreetMap o texto con coordenadas decimales.
 * Prioriza el pin exacto (!3d...!4d...) sobre el centro de cámara (@lat,lng).
 */
export function extraerCoordenadasDeTextoOUrl(entrada: string): CoordenadaGeo | null {
  if (!entrada || typeof entrada !== "string") return null;
  let texto = entrada.trim();
  try {
    texto = decodeURIComponent(texto);
  } catch {
    // Conservar cadena original si contiene % aislados
  }

  // 1. Pin exacto de lugar en Google Maps: !3d-0.1648075!4d-78.466175 (el último par suele ser el lugar seleccionado)
  const matches3d4d = Array.from(
    texto.matchAll(/!3d(-?\d{1,2}\.\d{3,})!4d(-?\d{1,3}\.\d{3,})/g)
  );
  if (matches3d4d.length > 0) {
    const ultimo = matches3d4d[matches3d4d.length - 1];
    if (ultimo) {
      const lat = Number(ultimo[1]);
      const lng = Number(ultimo[2]);
      if (esCoordenadaValida(lat, lng)) return { lat, lng };
    }
  }

  // 2. Parámetros explícitos en Google Maps, Apple Maps o Waze: ?q=lat,lng | ?ll=lat,lng | ?query=lat,lng | ?destination=lat,lng | ?coordinate=lat,lng
  const matchQuery = texto.match(
    /[?&](?:q|query|ll|sll|destination|daddr|coordinate|center)=(?:loc:)?\s*(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/i
  );
  if (matchQuery) {
    const lat = Number(matchQuery[1]);
    const lng = Number(matchQuery[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  // 3. Ruta /maps/search/lat,lng o /maps/place/lat,lng
  const matchSearchPath = texto.match(
    /\/maps\/(?:search|place|dir)\/[^\s/?#]*?(-?\d{1,2}\.\d{3,})\s*,\s*(-?\d{1,3}\.\d{3,})/i
  );
  if (matchSearchPath) {
    const lat = Number(matchSearchPath[1]);
    const lng = Number(matchSearchPath[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  // 4. Waze con parámetros separados lat=...&lon=...
  const matchWazeLat = texto.match(/[?&]lat=(-?\d{1,2}\.\d{3,})/i);
  const matchWazeLon = texto.match(/[?&](?:lon|lng)=(-?\d{1,3}\.\d{3,})/i);
  if (matchWazeLat && matchWazeLon) {
    const lat = Number(matchWazeLat[1]);
    const lng = Number(matchWazeLon[1]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  // 5. OpenStreetMap: #map=17/-0.18065/-78.46783 o mlat=...&mlon=...
  const matchOsmHash = texto.match(
    /#map=\d+(?:\.\d+)?\/(-?\d{1,2}\.\d{3,})\/(-?\d{1,3}\.\d{3,})/i
  );
  if (matchOsmHash) {
    const lat = Number(matchOsmHash[1]);
    const lng = Number(matchOsmHash[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }
  const matchOsmMlat = texto.match(/mlat=(-?\d{1,2}\.\d{3,}).*?mlon=(-?\d{1,3}\.\d{3,})/i);
  if (matchOsmMlat) {
    const lat = Number(matchOsmMlat[1]);
    const lng = Number(matchOsmMlat[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  // 6. Viewport de Google Maps: /@-0.1648075,-78.4687499,17z
  const matchViewport = texto.match(/\/@(-?\d{1,2}\.\d{3,}),(-?\d{1,3}\.\d{3,})/);
  if (matchViewport) {
    const lat = Number(matchViewport[1]);
    const lng = Number(matchViewport[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  // 7. Coordenadas directas pegadas en texto (ej. "-0.18065, -78.46783")
  const matchPlano = texto.match(
    /(?:^|[\s(])(-?\d{1,2}\.\d{4,})\s*,\s*(-?\d{1,3}\.\d{4,})(?:$|[\s)])/
  );
  if (matchPlano) {
    const lat = Number(matchPlano[1]);
    const lng = Number(matchPlano[2]);
    if (esCoordenadaValida(lat, lng)) return { lat, lng };
  }

  return null;
}

/**
 * Resuelve en servidor enlaces acortados de Google Maps / Waze / Apple Maps siguiendo redirecciones HTTP.
 */
export async function resolverEnlaceMapaACoordenadas(
  entrada: string
): Promise<{ coordenadas: CoordenadaGeo | null; urlExpandida?: string }> {
  const directo = extraerCoordenadasDeTextoOUrl(entrada);
  if (directo) {
    return { coordenadas: directo };
  }

  const urlDetectada = extraerPrimeraUrlDeTexto(entrada);
  if (!urlDetectada) {
    return { coordenadas: null };
  }

  try {
    const respuesta = await fetch(urlDetectada, {
      method: "GET",
      redirect: "follow",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
      signal: AbortSignal.timeout(6000),
    });

    const urlFinal = respuesta.url || urlDetectada;
    const desdeUrlFinal = extraerCoordenadasDeTextoOUrl(urlFinal);
    if (desdeUrlFinal) {
      return { coordenadas: desdeUrlFinal, urlExpandida: urlFinal };
    }

    const html = await respuesta.text();
    const desdeHtml = extraerCoordenadasDeTextoOUrl(html.slice(0, 120000));
    if (desdeHtml) {
      return { coordenadas: desdeHtml, urlExpandida: urlFinal };
    }

    // Buscar meta og:image de Google Maps estático (center=lat%2Clng)
    const matchCenter = html.match(/center=(-?\d{1,2}\.\d{4,})(?:%2C|,)(-?\d{1,3}\.\d{4,})/i);
    if (matchCenter) {
      const lat = Number(matchCenter[1]);
      const lng = Number(matchCenter[2]);
      if (esCoordenadaValida(lat, lng)) {
        return { coordenadas: { lat, lng }, urlExpandida: urlFinal };
      }
    }

    return { coordenadas: null, urlExpandida: urlFinal };
  } catch {
    return { coordenadas: null };
  }
}

/**
 * Calcula la distancia vial real en Quito / Pichincha usando OSRM (OpenStreetMap Routing Machine)
 * con respaldo instantáneo por Haversine × factor topográfico.
 */
export async function calcularRutaVialOsrm(
  origen: CoordenadaGeo,
  destino: CoordenadaGeo,
  factorRespaldo = 1.32
): Promise<{
  distanciaKm: number;
  duracionMinutos: number | null;
  geometria?: [number, number][];
  fuente: "OSRM" | "ESTIMACION_VIAL";
}> {
  const lineal = distanciaHaversineKm(origen, destino);
  if (lineal < 0.05) {
    return { distanciaKm: 0, duracionMinutos: 1, fuente: "OSRM" };
  }

  try {
    const endpoint = `https://router.project-osrm.org/route/v1/driving/${origen.lng},${origen.lat};${destino.lng},${destino.lat}?overview=simplified&geometries=geojson`;
    const res = await fetch(endpoint, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(4000),
    });

    if (res.ok) {
      const json = (await res.json()) as {
        code?: string;
        routes?: Array<{
          distance?: number;
          duration?: number;
          geometry?: { coordinates?: [number, number][] };
        }>;
      };
      const ruta = json.routes?.[0];
      if (json.code === "Ok" && ruta && typeof ruta.distance === "number" && ruta.distance > 0) {
        const coords = Array.isArray(ruta.geometry?.coordinates)
          ? ruta.geometry!.coordinates!.map(
              ([lng, lat]) => [lat, lng] as [number, number]
            )
          : undefined;
        return {
          distanciaKm: redondearKm(ruta.distance / 1000),
          duracionMinutos:
            typeof ruta.duration === "number" ? Math.max(1, Math.round(ruta.duration / 60)) : null,
          geometria: coords,
          fuente: "OSRM",
        };
      }
    }
  } catch {
    // Respaldo topográfico si OSRM público está saturado o sin red
  }

  const estimada = redondearKm(lineal * (factorRespaldo > 1 ? factorRespaldo : 1.32));
  return {
    distanciaKm: estimada,
    duracionMinutos: Math.max(5, Math.round((estimada / 28) * 60)),
    fuente: "ESTIMACION_VIAL",
  };
}

/**
 * Busca calles, barrios, edificios o parroquias en Pichincha / Ecuador mediante Nominatim (OpenStreetMap).
 */
export async function buscarDireccionesPichincha(
  consulta: string
): Promise<SugerenciaDireccionMapa[]> {
  const q = (consulta || "").trim();
  if (q.length < 3) return [];

  const terminoConContexto = /quito|pichincha|ecuador|cumbay|tumbaco|sangolqu|conocoto|calder/i.test(
    q
  )
    ? q
    : `${q}, Quito, Pichincha, Ecuador`;

  try {
    const url =
      `https://nominatim.openstreetmap.org/search?format=jsonv2` +
      `&countrycodes=ec&viewbox=-79.10,0.18,-78.10,-0.65&bounded=0&limit=6&addressdetails=1` +
      `&q=${encodeURIComponent(terminoConContexto)}`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "EcosistemaTinkayLogistica/1.0 (https://tinkay-web.vercel.app)",
      },
      signal: AbortSignal.timeout(4500),
    });

    if (!res.ok) return [];
    const items = (await res.json()) as Array<{
      display_name?: string;
      name?: string;
      lat?: string;
      lon?: string;
    }>;

    if (!Array.isArray(items)) return [];
    return items
      .map((it) => {
        const lat = Number(it.lat);
        const lng = Number(it.lon);
        if (!esCoordenadaValida(lat, lng)) return null;
        const completa = (it.display_name || "").trim();
        const partes = completa.split(",").map((p) => p.trim());
        const nombreCorto =
          (it.name && it.name.trim()) || partes.slice(0, 2).join(", ") || completa;
        return {
          nombreCorto,
          direccionCompleta: completa,
          lat,
          lng,
        };
      })
      .filter((x): x is SugerenciaDireccionMapa => x !== null);
  } catch {
    return [];
  }
}

/**
 * Motor determinista de cotización de envío a domicilio.
 * Regla híbrida aprobada:
 *  1. Retiro en local -> $0.00.
 *  2. Fuera de radioMaximoKm -> bloquea cobro automático y solicita coordinación con asesora.
 *  3. Zona con modo GRATIS (ej. Centro-Norte de Quito) -> $0.00 si el producto incluye envío, o tarifaBaseNoIncluido si no lo incluye.
 *  4. Zona con modo TARIFA_FIJA (ej. Cumbayá, Tumbaco, Los Chillos) -> tarifaFija de la zona (+ subsidioBaseUsd si el producto no incluía envío base).
 *  5. Zona POR_KM o cualquier sector en Pichincha fuera de polígonos fijos ->
 *     Máx(recargoMinimoExtra, (distanciaVialKmDesdeTaller × tarifaPorKm) − subsidioBaseUsd).
 */
export function cotizarEnvioDomicilio(
  opciones: OpcionesCotizacionEnvio
): ResultadoCotizacionEnvio {
  const {
    config,
    destino,
    distanciaVialKm: vialInyectada,
    fuenteDistancia = "ESTIMACION_VIAL",
    rutaGeometria,
    deliveryIncluidoProducto = true,
    recargoLogisticoProducto = 0,
    retiroEnLocal = false,
  } = opciones;

  const origen: CoordenadaGeo = {
    lat: config.origenLat,
    lng: config.origenLng,
  };

  const urlGoogleMapsDestino = `https://www.google.com/maps?q=${destino.lat},${destino.lng}`;
  const recargoProd = Math.max(0, redondearMoneda(recargoLogisticoProducto || 0));

  if (retiroEnLocal) {
    return {
      ok: true,
      dentroCobertura: true,
      reglaAplicada: "RETIRO_LOCAL",
      origen,
      destino: origen,
      zonaDetectada: null,
      distanciaLinealKm: 0,
      distanciaVialKm: 0,
      fuenteDistancia: "OSRM",
      costoBaseEnvio: 0,
      recargoProducto: 0,
      costoTotalEnvio: 0,
      etiquetaResumen: `Retiro en ${config.origenNombre} ($0.00)`,
      formulaDetalle: "Retiro presencial en tienda física sin recargo de transporte.",
      urlGoogleMapsDestino: config.origenMapaUrl || urlGoogleMapsDestino,
    };
  }

  const linealKm = redondearKm(distanciaHaversineKm(origen, destino));
  const vialKm =
    typeof vialInyectada === "number" && vialInyectada >= 0
      ? redondearKm(vialInyectada)
      : redondearKm(linealKm * (config.factorVialRespaldo > 1 ? config.factorVialRespaldo : 1.32));

  const mostrarKm = config.mostrarKilometrosCliente !== false;
  const sufijoKm = mostrarKm ? ` (${vialKm.toFixed(1)} km)` : "";

  if (linealKm > config.radioMaximoKm) {
    return {
      ok: false,
      dentroCobertura: false,
      reglaAplicada: "FUERA_DE_COBERTURA",
      origen,
      destino,
      zonaDetectada: null,
      distanciaLinealKm: linealKm,
      distanciaVialKm: vialKm,
      fuenteDistancia,
      costoBaseEnvio: 0,
      recargoProducto: recargoProd,
      costoTotalEnvio: 0,
      etiquetaResumen: mostrarKm
        ? `Fuera de cobertura (${linealKm.toFixed(1)} km)`
        : "Fuera de cobertura automática",
      formulaDetalle: `La ubicación está a ${linealKm.toFixed(1)} km del taller (máximo automático ${config.radioMaximoKm} km en Pichincha). Coordina entrega especial con nuestra asesora o elige retiro en tienda.`,
      rutaGeometria,
      urlGoogleMapsDestino,
    };
  }

  // Cálculo por km base reutilizable tanto en zonas POR_KM como fuera de polígonos
  const subsidioAplicado = deliveryIncluidoProducto ? config.subsidioBaseUsd : 0;
  const brutoPorKm = vialKm * config.tarifaPorKm;
  const netoPorKm = brutoPorKm - subsidioAplicado;
  const minimoExtra = deliveryIncluidoProducto
    ? config.recargoMinimoExtra
    : Math.max(config.tarifaBaseNoIncluido, config.recargoMinimoExtra);
  const costoBaseKm = redondearMoneda(Math.max(minimoExtra, netoPorKm));
  const totalKm = redondearMoneda(costoBaseKm + recargoProd);

  const formulaKmBase =
    subsidioAplicado > 0
      ? `${vialKm.toFixed(1)} km × $${config.tarifaPorKm.toFixed(2)}/km ($${brutoPorKm.toFixed(2)}) − $${subsidioAplicado.toFixed(2)} incluido = $${costoBaseKm.toFixed(2)} (mín. $${minimoExtra.toFixed(2)})${
          recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
        }.`
      : `${vialKm.toFixed(1)} km × $${config.tarifaPorKm.toFixed(2)}/km = $${costoBaseKm.toFixed(2)}${
          recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
        }.`;

  // Evaluar TODAS las áreas activas cuyo polígono contenga el punto (soporta solapamiento de áreas:
  // si 2 o más zonas se solapan en el destino, siempre se cobra la tarifa más baja).
  const zonasEnPunto = [...(config.zonas || [])].filter(
    (z) => z.activo && Array.isArray(z.poligono) && z.poligono.length >= 3 && puntoEnPoligono(destino, z.poligono)
  );

  if (zonasEnPunto.length > 0) {
    const pesoModo: Record<ModoCobroZona, number> = {
      GRATIS: 0,
      TARIFA_FIJA: 1,
      POR_KM: 2,
    };

    const evaluaciones = zonasEnPunto
      .map((z) => {
        if (z.modoCobro === "GRATIS") {
          if (deliveryIncluidoProducto) {
            const total = recargoProd;
            return {
              zona: z,
              reglaAplicada: "ZONA_GRATIS" as const,
              costoBaseEnvio: 0,
              costoTotalEnvio: total,
              etiquetaResumen:
                total === 0
                  ? `${z.nombre}${sufijoKm} — Envío Gratis`
                  : `${z.nombre}${sufijoKm}`,
              formulaDetalle:
                recargoProd > 0
                  ? `Dentro de ${z.nombre} ($0.00 base) + $${recargoProd.toFixed(2)} por transporte especial del arreglo.`
                  : `Ubicación dentro de la zona de cobertura incluida (${z.nombre} · ${vialKm.toFixed(1)} km desde taller).`,
            };
          }

          const baseNoInc = redondearMoneda(config.tarifaBaseNoIncluido);
          const total = redondearMoneda(baseNoInc + recargoProd);
          return {
            zona: z,
            reglaAplicada: "TARIFA_BASE_PRODUCTO" as const,
            costoBaseEnvio: baseNoInc,
            costoTotalEnvio: total,
            etiquetaResumen: `${z.nombre}${sufijoKm}`,
            formulaDetalle: `Tarifa base en ${z.nombre}: $${baseNoInc.toFixed(2)}${
              recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
            }.`,
          };
        }

        if (z.modoCobro === "TARIFA_FIJA") {
          const compensacionNoIncluido = deliveryIncluidoProducto ? 0 : config.subsidioBaseUsd;
          const baseZona = redondearMoneda(z.tarifaFija + compensacionNoIncluido);
          const total = redondearMoneda(baseZona + recargoProd);
          return {
            zona: z,
            reglaAplicada: "ZONA_TARIFA_FIJA" as const,
            costoBaseEnvio: baseZona,
            costoTotalEnvio: total,
            etiquetaResumen: `${z.nombre}${sufijoKm}`,
            formulaDetalle: `Tarifa zonificada para ${z.nombre}: $${baseZona.toFixed(2)} (${vialKm.toFixed(1)} km viales desde taller)${
              recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
            }.`,
          };
        }

        return {
          zona: z,
          reglaAplicada: "CALCULO_POR_KM" as const,
          costoBaseEnvio: costoBaseKm,
          costoTotalEnvio: totalKm,
          etiquetaResumen: `${z.nombre}${sufijoKm}`,
          formulaDetalle: formulaKmBase,
        };
      })
      .sort((a, b) => {
        if (a.costoTotalEnvio !== b.costoTotalEnvio) {
          return a.costoTotalEnvio - b.costoTotalEnvio;
        }
        const diffModo = pesoModo[a.zona.modoCobro] - pesoModo[b.zona.modoCobro];
        if (diffModo !== 0) return diffModo;
        return a.zona.prioridad - b.zona.prioridad;
      });

    const ganadora = evaluaciones[0]!;
    const notaSolapamiento =
      evaluaciones.length > 1
        ? ` [Áreas solapadas: ${evaluaciones
            .map((ev) => `${ev.zona.nombre} ($${ev.costoTotalEnvio.toFixed(2)})`)
            .join(" vs ")} → aplicada tarifa más baja]`
        : "";

    return {
      ok: true,
      dentroCobertura: true,
      reglaAplicada: ganadora.reglaAplicada,
      origen,
      destino,
      zonaDetectada: {
        id: ganadora.zona.id,
        codigo: ganadora.zona.codigo,
        nombre: ganadora.zona.nombre,
        modoCobro: ganadora.zona.modoCobro,
      },
      zonasCoincidentes: evaluaciones.map((ev) => ({
        id: ev.zona.id,
        codigo: ev.zona.codigo,
        nombre: ev.zona.nombre,
        modoCobro: ev.zona.modoCobro,
        costoTotalEnvio: ev.costoTotalEnvio,
      })),
      distanciaLinealKm: linealKm,
      distanciaVialKm: vialKm,
      fuenteDistancia,
      costoBaseEnvio: ganadora.costoBaseEnvio,
      recargoProducto: recargoProd,
      costoTotalEnvio: ganadora.costoTotalEnvio,
      etiquetaResumen: ganadora.etiquetaResumen,
      formulaDetalle: `${ganadora.formulaDetalle}${notaSolapamiento}`,
      rutaGeometria,
      urlGoogleMapsDestino,
    };
  }

  // Fuera de polígonos zonificados (pero dentro del radio máximo en Pichincha): cálculo por km
  return {
    ok: true,
    dentroCobertura: true,
    reglaAplicada: "CALCULO_POR_KM",
    origen,
    destino,
    zonaDetectada: null,
    zonasCoincidentes: [],
    distanciaLinealKm: linealKm,
    distanciaVialKm: vialKm,
    fuenteDistancia,
    costoBaseEnvio: costoBaseKm,
    recargoProducto: recargoProd,
    costoTotalEnvio: totalKm,
    etiquetaResumen: `Envío a domicilio${sufijoKm}`,
    formulaDetalle: formulaKmBase,
    rutaGeometria,
    urlGoogleMapsDestino,
  };
}

