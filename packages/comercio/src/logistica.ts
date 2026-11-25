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
  /** Si es true, la zona de cobertura gratuita aplica exclusivamente a clientes registrados; visitantes sin cuenta pagan tarifa mínima + costo por km */
  envioGratisSoloRegistrados?: boolean;
  /** Tarifa mínima base en USD para compradores no registrados (default: $1.00) */
  tarifaBaseNoRegistradoUsd?: number;
  /** Costo por km en USD para compradores no registrados (default: $0.50) */
  tarifaPorKmNoRegistradoUsd?: number;
  zonas: ZonaCoberturaLogistica[];
  actualizadoEn?: string | null;
}

export interface DetalleDireccionGeoespacial {
  /** Resumen legible listo para autocompletar dirección de entrega (ej. "Av. Rodrigo de Chávez, Villaflora, Parroquia Chimbacalle, Quito") */
  resumenDireccion: string;
  /** Calle principal, intersección, numeración o edificio/lugar detectado */
  callePrincipal?: string;
  /** Barrio, sector, ciudadela o urbanización */
  sectorBarrio?: string;
  /** Parroquia urbana o rural (ej. Chimbacalle, Iñaquito, Cumbayá, Nayón, Tumbaco) */
  parroquia?: string;
  /** Cantón o ciudad (ej. Quito, Sangolquí) */
  ciudad?: string;
  /** Provincia (ej. Pichincha) */
  provincia?: string;
  /** Código postal referencial si existe (ej. 170111) */
  codigoPostal?: string;
  /** Cadena completa devuelta por el geocodificador */
  direccionCompleta?: string;
}

export interface OpcionesCotizacionEnvio {
  config: ConfiguracionLogisticaNegocio;
  destino: CoordenadaGeo;
  distanciaVialKm?: number;
  fuenteDistancia?: "OSRM" | "ESTIMACION_VIAL";
  rutaGeometria?: [number, number][];
  detalleDireccion?: DetalleDireccionGeoespacial | null;
  /** Si el producto incluye envío gratis dentro de la zona por defecto (default: true) */
  deliveryIncluidoProducto?: boolean;
  /** Recargo adicional específico del producto (ej. furgoneta para pedestal monumental) */
  recargoLogisticoProducto?: number;
  /** Si el cliente eligió retirar directamente en el taller físico */
  retiroEnLocal?: boolean;
  /** Indica si el comprador cuenta con registro/membresía activa en el negocio (default: true). Si es false y envioGratisSoloRegistrados está activo, se cobra tarifaBaseNoRegistradoUsd + tarifaPorKmNoRegistradoUsd * km */
  clienteRegistrado?: boolean;
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
    | "TARIFA_NO_REGISTRADO_KM"
    | "FUERA_DE_COBERTURA";
  clienteRegistrado?: boolean;
  /** Costo que pagaría un cliente registrado en este mismo destino (para mostrar el beneficio de registrarse) */
  costoSiFueraRegistradoUsd?: number;
  /** Ahorro directo en envío si el visitante crea su cuenta gratuita */
  ahorroPorRegistrarseUsd?: number;
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
  /** Calles, sector/barrio y parroquia obtenidos por geocodificación inversa del pin o enlace */
  detalleDireccion?: DetalleDireccionGeoespacial | null;
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
      "El Batán / Monteserrín",
      "La Carolina / Iñaquito",
      "Quicentro / Shirys",
      "El Inca / Jipijapa",
      "González Suárez",
      "El Bosque / Granda Centeno",
      "Kennedy / Bicentenario",
      "Granados / Zámbiza",
    ],
    // Polígono real de isodistancia en auto <= 5.0 km desde Taller Tinkay (-0.1648075, -78.466175)
    // calculado sobre la red vial OSRM excluyendo áreas sin calles transitables en auto (ej. bosque Parque Metropolitano).
    poligono: [
      [-0.166819, -78.466268],
      [-0.191362, -78.47095],
      [-0.190686, -78.473125],
      [-0.194184, -78.477217],
      [-0.197785, -78.485064],
      [-0.19805, -78.489426],
      [-0.193999, -78.490561],
      [-0.191817, -78.493242],
      [-0.186427, -78.492322],
      [-0.176321, -78.497958],
      [-0.170663, -78.499425],
      [-0.167382, -78.49768],
      [-0.161865, -78.501731],
      [-0.158596, -78.501649],
      [-0.156676, -78.49665],
      [-0.153243, -78.497772],
      [-0.150555, -78.49674],
      [-0.14908, -78.493493],
      [-0.143153, -78.492127],
      [-0.147317, -78.483685],
      [-0.142838, -78.484849],
      [-0.142709, -78.481659],
      [-0.137578, -78.481704],
      [-0.137323, -78.476176],
      [-0.132288, -78.475027],
      [-0.129391, -78.472472],
      [-0.128939, -78.469125],
      [-0.131082, -78.466172],
      [-0.131267, -78.46316],
      [-0.136775, -78.458617],
      [-0.135548, -78.455282],
      [-0.143427, -78.453774],
      [-0.142952, -78.450738],
      [-0.144137, -78.44886],
      [-0.141227, -78.442187],
      [-0.146404, -78.443866],
      [-0.147763, -78.442147],
      [-0.157237, -78.452984],
      [-0.156477, -78.443036],
      [-0.161367, -78.446315],
      [-0.162951, -78.445799],
      [-0.168299, -78.453407],
      [-0.170261, -78.449878],
      [-0.167677, -78.460743],
      [-0.168524, -78.462514],
      [-0.168692, -78.463924],
    ],
  },
  {
    id: "zon-entrega-1-usd",
    codigo: "entrega_1_usd",
    nombre: "Entrega $1",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 1.0,
    prioridad: 2,
    activo: true,
    color: "#0EA5E9",
    sectoresReferencia: [
      "La Mariscal / Plaza Foch",
      "Nayón",
      "Santa Clara / La Colón",
      "San Isidro del Inca",
      "Cotocollao / La Concepción",
      "Miraflores / La Gasca",
    ],
    // Polígono real de isodistancia en auto <= 7.0 km (+2 km extra alrededor de la zona gratuita)
    // excluyendo áreas sin calles transitables en auto.
    poligono: [
      [-0.191477, -78.468607],
      [-0.191362, -78.47095],
      [-0.210199, -78.482591],
      [-0.206905, -78.490434],
      [-0.209548, -78.496631],
      [-0.208208, -78.502597],
      [-0.197414, -78.505517],
      [-0.194255, -78.50799],
      [-0.181931, -78.502499],
      [-0.179002, -78.503674],
      [-0.175967, -78.507859],
      [-0.167723, -78.501148],
      [-0.163656, -78.501239],
      [-0.161066, -78.509142],
      [-0.157687, -78.505522],
      [-0.154291, -78.50694],
      [-0.145918, -78.49872],
      [-0.141593, -78.499073],
      [-0.13357, -78.503178],
      [-0.131863, -78.498406],
      [-0.127242, -78.497824],
      [-0.125136, -78.488979],
      [-0.128141, -78.483108],
      [-0.119266, -78.482819],
      [-0.118276, -78.479018],
      [-0.111676, -78.475468],
      [-0.119869, -78.458627],
      [-0.129668, -78.453504],
      [-0.125683, -78.447948],
      [-0.127408, -78.439972],
      [-0.13395, -78.440169],
      [-0.137002, -78.426236],
      [-0.150252, -78.434468],
      [-0.154795, -78.435271],
      [-0.157008, -78.426834],
      [-0.162281, -78.426216],
      [-0.164172, -78.427921],
      [-0.166453, -78.44736],
      [-0.174079, -78.452931],
      [-0.166002, -78.465065],
      [-0.193736, -78.46595],
    ],
  },
  {
    id: "zon-entrega-2-usd",
    codigo: "entrega_2_usd",
    nombre: "Entrega $2",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 2.0,
    prioridad: 3,
    activo: true,
    color: "#8B5CF6",
    sectoresReferencia: [
      "Centro Histórico",
      "Ponceano",
      "El Ejido / San Juan",
      "San Carlos / Comité del Pueblo",
      "Llano Chico / Zámbiza Alto",
      "Miravalle / Guápulo",
    ],
    // Polígono real de isodistancia en auto <= 9.0 km (+4 km extra alrededor de la zona gratuita)
    // excluyendo áreas sin calles transitables en auto.
    poligono: [
      [-0.197974, -78.468555],
      [-0.191362, -78.47095],
      [-0.216597, -78.480742],
      [-0.220509, -78.486417],
      [-0.218584, -78.497191],
      [-0.224312, -78.50781],
      [-0.220544, -78.513076],
      [-0.210642, -78.511808],
      [-0.207178, -78.515712],
      [-0.197292, -78.512534],
      [-0.192571, -78.514592],
      [-0.189267, -78.519421],
      [-0.183299, -78.51649],
      [-0.17853, -78.520784],
      [-0.172031, -78.506244],
      [-0.168844, -78.511841],
      [-0.165798, -78.506593],
      [-0.161066, -78.509142],
      [-0.157687, -78.505522],
      [-0.154291, -78.50694],
      [-0.150962, -78.504202],
      [-0.142826, -78.512752],
      [-0.138888, -78.510422],
      [-0.117251, -78.50613],
      [-0.111222, -78.497543],
      [-0.105971, -78.493731],
      [-0.107501, -78.481347],
      [-0.097332, -78.466112],
      [-0.11634, -78.461755],
      [-0.111663, -78.456865],
      [-0.113109, -78.451726],
      [-0.111573, -78.446802],
      [-0.125065, -78.443435],
      [-0.125162, -78.438339],
      [-0.13395, -78.440169],
      [-0.132646, -78.42738],
      [-0.138586, -78.409935],
      [-0.144584, -78.410089],
      [-0.153885, -78.42203],
      [-0.155966, -78.415617],
      [-0.161318, -78.422754],
      [-0.165423, -78.423294],
      [-0.168019, -78.428503],
      [-0.171572, -78.426699],
      [-0.172448, -78.437568],
      [-0.174597, -78.438767],
      [-0.174079, -78.452931],
      [-0.166002, -78.465065],
      [-0.198768, -78.46587],
    ],
  },
  {
    id: "zon-entrega-3-usd",
    codigo: "entrega_3_usd",
    nombre: "Entrega $3",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 3.0,
    prioridad: 4,
    activo: true,
    color: "#F59E0B",
    sectoresReferencia: [
      "El Condado Shopping",
      "San Blas / La Tola",
      "Cotocollao Norte",
      "Ponceano Norte",
      "Tanda / Nayón Este",
      "El Trébol / Monjas",
    ],
    // Polígono real de isodistancia en auto <= 11.0 km (+6 km sobre zona gratuita)
    poligono: [
      [-0.195823, -78.466536],
      [-0.199838, -78.473388],
      [-0.218621, -78.480836],
      [-0.220867, -78.486249],
      [-0.218776, -78.491425],
      [-0.237281, -78.508591],
      [-0.23678, -78.516603],
      [-0.212621, -78.514087],
      [-0.208305, -78.518367],
      [-0.20819, -78.527931],
      [-0.194676, -78.518419],
      [-0.191776, -78.524002],
      [-0.184329, -78.517321],
      [-0.178725, -78.519798],
      [-0.176538, -78.529404],
      [-0.168776, -78.513867],
      [-0.165946, -78.514294],
      [-0.154902, -78.504399],
      [-0.144911, -78.522145],
      [-0.141243, -78.516709],
      [-0.133522, -78.521202],
      [-0.119918, -78.511222],
      [-0.105868, -78.507578],
      [-0.102593, -78.502306],
      [-0.103496, -78.494652],
      [-0.095299, -78.484761],
      [-0.086609, -78.479841],
      [-0.100925, -78.471408],
      [-0.09695, -78.466272],
      [-0.10123, -78.460724],
      [-0.098005, -78.454392],
      [-0.108648, -78.445749],
      [-0.106677, -78.439016],
      [-0.116394, -78.438201],
      [-0.116057, -78.431588],
      [-0.134517, -78.440457],
      [-0.132675, -78.427336],
      [-0.135424, -78.400488],
      [-0.141218, -78.403088],
      [-0.153917, -78.422669],
      [-0.155705, -78.415392],
      [-0.161085, -78.422603],
      [-0.165233, -78.418643],
      [-0.172366, -78.419802],
      [-0.176446, -78.424121],
      [-0.18106, -78.421397],
      [-0.181722, -78.435237],
      [-0.196163, -78.448638],
      [-0.192818, -78.452841],
      [-0.20775, -78.458212],
      [-0.208493, -78.461703],
    ],
  },
  {
    id: "zon-entrega-4-usd",
    codigo: "entrega_4_usd",
    nombre: "Entrega $4",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 4.0,
    prioridad: 5,
    activo: true,
    color: "#F97316",
    sectoresReferencia: [
      "Carcelén",
      "Chimbacalle / La Magdalena",
      "San Bartolo Norte",
      "Carapungo Sur / Llano Grande",
      "Cumbayá Oeste / Jacarandá",
      "Alma Lojana / Monjas Sur",
    ],
    // Polígono real de isodistancia en auto <= 13.0 km (+8 km sobre zona gratuita)
    poligono: [
      [-0.197033, -78.467874],
      [-0.210994, -78.474925],
      [-0.218621, -78.480836],
      [-0.220867, -78.486249],
      [-0.248452, -78.505038],
      [-0.244674, -78.512195],
      [-0.23678, -78.516603],
      [-0.222895, -78.515161],
      [-0.221336, -78.522884],
      [-0.21109, -78.521224],
      [-0.20819, -78.527931],
      [-0.194676, -78.518419],
      [-0.191776, -78.524002],
      [-0.184329, -78.517321],
      [-0.178725, -78.519798],
      [-0.176538, -78.529404],
      [-0.169411, -78.517758],
      [-0.154902, -78.504399],
      [-0.143441, -78.525223],
      [-0.139594, -78.520331],
      [-0.126921, -78.531946],
      [-0.124126, -78.525316],
      [-0.115731, -78.523558],
      [-0.102728, -78.509653],
      [-0.094998, -78.506224],
      [-0.092261, -78.499997],
      [-0.097533, -78.489692],
      [-0.083279, -78.487852],
      [-0.082, -78.48079],
      [-0.089104, -78.472785],
      [-0.08882, -78.465965],
      [-0.093047, -78.459753],
      [-0.081757, -78.452369],
      [-0.087595, -78.445471],
      [-0.085607, -78.437418],
      [-0.09257, -78.432577],
      [-0.105596, -78.431988],
      [-0.105802, -78.424991],
      [-0.115913, -78.425144],
      [-0.117622, -78.418675],
      [-0.133364, -78.420565],
      [-0.135424, -78.400488],
      [-0.141218, -78.403088],
      [-0.153917, -78.422669],
      [-0.155705, -78.415392],
      [-0.161085, -78.422603],
      [-0.164892, -78.414778],
      [-0.169172, -78.414651],
      [-0.172366, -78.419802],
      [-0.177342, -78.419883],
      [-0.183346, -78.415101],
      [-0.188717, -78.416037],
      [-0.184242, -78.43176],
      [-0.18772, -78.438849],
      [-0.198512, -78.432468],
      [-0.207883, -78.44637],
      [-0.197478, -78.454238],
      [-0.218412, -78.451812],
      [-0.219669, -78.456539],
      [-0.216766, -78.465839],
    ],
  },
  {
    id: "zon-entrega-5-usd",
    codigo: "entrega_5_usd",
    nombre: "Entrega $5",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 5.0,
    prioridad: 6,
    activo: true,
    color: "#EC4899",
    sectoresReferencia: [
      "Calderón / Carapungo",
      "Cumbayá / USFQ",
      "Pusuquí / La Pampa",
      "Chilibulo / La Raya",
      "Lumbisí",
    ],
    // Polígono real de isodistancia en auto <= 15.0 km (+10 km sobre zona gratuita)
    poligono: [
      [-0.232716, -78.471298],
      [-0.210994, -78.474925],
      [-0.220867, -78.486249],
      [-0.255777, -78.508371],
      [-0.244674, -78.512195],
      [-0.24164, -78.530638],
      [-0.232779, -78.534224],
      [-0.221463, -78.533465],
      [-0.194676, -78.518419],
      [-0.191776, -78.524002],
      [-0.184329, -78.517321],
      [-0.178725, -78.519798],
      [-0.176538, -78.529404],
      [-0.169411, -78.517758],
      [-0.154902, -78.504399],
      [-0.137172, -78.542466],
      [-0.124836, -78.535489],
      [-0.120925, -78.528664],
      [-0.10531, -78.525629],
      [-0.085125, -78.512078],
      [-0.081269, -78.505137],
      [-0.097533, -78.489692],
      [-0.083279, -78.487852],
      [-0.076983, -78.473785],
      [-0.08476, -78.466428],
      [-0.081118, -78.459341],
      [-0.066684, -78.448864],
      [-0.083436, -78.444168],
      [-0.081874, -78.43603],
      [-0.088411, -78.430754],
      [-0.081446, -78.418139],
      [-0.099326, -78.420182],
      [-0.120467, -78.414233],
      [-0.121644, -78.403963],
      [-0.130857, -78.407336],
      [-0.135424, -78.400488],
      [-0.141218, -78.403088],
      [-0.153917, -78.422669],
      [-0.155705, -78.415392],
      [-0.161085, -78.422603],
      [-0.164892, -78.414778],
      [-0.169172, -78.414651],
      [-0.172366, -78.419802],
      [-0.177342, -78.419883],
      [-0.183346, -78.415101],
      [-0.188717, -78.416037],
      [-0.190524, -78.421306],
      [-0.207604, -78.424236],
      [-0.208086, -78.435515],
      [-0.220034, -78.43417],
      [-0.215134, -78.442644],
      [-0.220795, -78.445691],
      [-0.221659, -78.450344],
      [-0.216766, -78.465839],
    ],
  },
  {
    id: "zon-entrega-6-usd",
    codigo: "entrega_6_usd",
    nombre: "Entrega $6",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 6.0,
    prioridad: 7,
    activo: true,
    color: "#E11D48",
    sectoresReferencia: [
      "Villaflora / El Recreo",
      "San Bartolo / Mena 2",
      "Calderón Norte / Marianitas",
      "San José de Morán",
      "La Primavera / Ruta Viva Oeste",
      "Puengasí Sur / Ferroviaria",
    ],
    // Polígono real de isodistancia en auto <= 17.0 km (+12 km sobre zona gratuita)
    poligono: [
      [-0.232716, -78.471298],
      [-0.210994, -78.474925],
      [-0.220867, -78.486249],
      [-0.255777, -78.508371],
      [-0.25868, -78.520495],
      [-0.257254, -78.543509],
      [-0.244161, -78.545633],
      [-0.22715, -78.540353],
      [-0.194676, -78.518419],
      [-0.191776, -78.524002],
      [-0.184329, -78.517321],
      [-0.178725, -78.519798],
      [-0.176538, -78.529404],
      [-0.157678, -78.505515],
      [-0.143879, -78.544036],
      [-0.124836, -78.535489],
      [-0.105018, -78.53662],
      [-0.09762, -78.534191],
      [-0.077873, -78.516571],
      [-0.081269, -78.505137],
      [-0.097533, -78.489692],
      [-0.083279, -78.487852],
      [-0.082, -78.48079],
      [-0.073023, -78.474228],
      [-0.076946, -78.458459],
      [-0.0461, -78.445359],
      [-0.064128, -78.439194],
      [-0.066778, -78.430496],
      [-0.077715, -78.425546],
      [-0.067443, -78.409984],
      [-0.094331, -78.407128],
      [-0.113871, -78.415278],
      [-0.120467, -78.414233],
      [-0.125835, -78.397593],
      [-0.141218, -78.403088],
      [-0.153917, -78.422669],
      [-0.155705, -78.415392],
      [-0.161085, -78.422603],
      [-0.164892, -78.414778],
      [-0.177342, -78.419883],
      [-0.196635, -78.410794],
      [-0.207604, -78.424236],
      [-0.220002, -78.42019],
      [-0.216675, -78.429867],
      [-0.223096, -78.43268],
      [-0.228439, -78.443377],
      [-0.234396, -78.447404],
      [-0.231324, -78.453962],
      [-0.216951, -78.461806],
      [-0.216766, -78.465839],
    ],
  },
  {
    id: "zon-entrega-7-usd",
    codigo: "entrega_7_usd",
    nombre: "Entrega $7",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 7.0,
    prioridad: 8,
    activo: true,
    color: "#9333EA",
    sectoresReferencia: [
      "Solanda / Mayorista",
      "Chillogallo Norte",
      "San Antonio Sur / Pomasqui Sur",
      "Tumbaco Oeste / La Morita Oeste",
      "Armenia Norte",
    ],
    // Polígono real de isodistancia en auto <= 19.0 km (+14 km sobre zona gratuita)
    poligono: [
      [-0.218132, -78.471902],
      [-0.246865, -78.480695],
      [-0.244967, -78.487622],
      [-0.226464, -78.488617],
      [-0.266592, -78.513275],
      [-0.272262, -78.52822],
      [-0.266315, -78.537498],
      [-0.268747, -78.55342],
      [-0.244246, -78.560773],
      [-0.219195, -78.543826],
      [-0.198474, -78.522091],
      [-0.183299, -78.51649],
      [-0.178702, -78.518265],
      [-0.176094, -78.53074],
      [-0.169542, -78.520043],
      [-0.158075, -78.542486],
      [-0.150775, -78.547503],
      [-0.13721, -78.525457],
      [-0.126829, -78.533147],
      [-0.119767, -78.52991],
      [-0.100275, -78.543666],
      [-0.097608, -78.533257],
      [-0.077233, -78.52733],
      [-0.077601, -78.516473],
      [-0.062902, -78.513646],
      [-0.059154, -78.50467],
      [-0.073236, -78.490818],
      [-0.071397, -78.482637],
      [-0.05859, -78.457048],
      [-0.0365, -78.443491],
      [-0.050945, -78.435366],
      [-0.053668, -78.425816],
      [-0.063333, -78.418496],
      [-0.067443, -78.409984],
      [-0.077599, -78.40491],
      [-0.096575, -78.409063],
      [-0.097666, -78.399206],
      [-0.107548, -78.397939],
      [-0.121658, -78.403491],
      [-0.125044, -78.398647],
      [-0.141721, -78.403985],
      [-0.154407, -78.413879],
      [-0.183286, -78.415449],
      [-0.192066, -78.406708],
      [-0.199244, -78.417182],
      [-0.221924, -78.39799],
      [-0.223587, -78.407566],
      [-0.233064, -78.418199],
      [-0.231862, -78.441945],
      [-0.246302, -78.452029],
      [-0.23594, -78.459867],
      [-0.235449, -78.465247],
    ],
  },
  {
    id: "zon-entrega-8-usd",
    codigo: "entrega_8_usd",
    nombre: "Entrega $8",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 8.0,
    prioridad: 9,
    activo: true,
    color: "#4F46E5",
    sectoresReferencia: [
      "Pomasqui",
      "Tumbaco Centro",
      "Chillogallo / Las Cuadras",
      "Calderón Extremo Norte",
      "La Morita / Hilacril",
    ],
    // Polígono real de isodistancia en auto <= 21.0 km (+16 km sobre zona gratuita)
    poligono: [
      [-0.241818, -78.473203],
      [-0.252219, -78.481297],
      [-0.256539, -78.490579],
      [-0.243054, -78.494636],
      [-0.266592, -78.513275],
      [-0.287482, -78.536998],
      [-0.277772, -78.56096],
      [-0.260796, -78.562229],
      [-0.252091, -78.570164],
      [-0.208982, -78.544348],
      [-0.202778, -78.546119],
      [-0.183299, -78.51649],
      [-0.178702, -78.518265],
      [-0.176094, -78.53074],
      [-0.169542, -78.520043],
      [-0.149347, -78.554048],
      [-0.142752, -78.551638],
      [-0.13721, -78.525457],
      [-0.107185, -78.54858],
      [-0.079051, -78.538373],
      [-0.072523, -78.530374],
      [-0.057227, -78.528175],
      [-0.042374, -78.510658],
      [-0.050609, -78.496757],
      [-0.071397, -78.482637],
      [-0.019566, -78.440549],
      [-0.0427, -78.421885],
      [-0.046776, -78.412185],
      [-0.062475, -78.407006],
      [-0.066829, -78.399234],
      [-0.096575, -78.409063],
      [-0.097666, -78.399206],
      [-0.116771, -78.383931],
      [-0.154407, -78.413879],
      [-0.183286, -78.415449],
      [-0.192066, -78.406708],
      [-0.198784, -78.409327],
      [-0.222915, -78.383926],
      [-0.229805, -78.389647],
      [-0.233079, -78.408636],
      [-0.246684, -78.429196],
      [-0.237455, -78.439822],
      [-0.239297, -78.446505],
      [-0.253143, -78.458468],
      [-0.235449, -78.465247],
    ],
  },
  {
    id: "zon-entrega-9-usd",
    codigo: "entrega_9_usd",
    nombre: "Entrega $9",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 9.0,
    prioridad: 10,
    activo: true,
    color: "#0D9488",
    sectoresReferencia: [
      "Quitumbe",
      "Turubamba / La Ecuatoriana",
      "El Arenal / Tumbaco Este",
      "San Antonio Sur",
      "La Armenia / Puente 3",
    ],
    // Polígono real de isodistancia en auto <= 23.0 km (+18 km sobre zona gratuita)
    poligono: [
      [-0.26501, -78.474953],
      [-0.273393, -78.495181],
      [-0.266592, -78.513275],
      [-0.302734, -78.54634],
      [-0.304763, -78.564027],
      [-0.29139, -78.57227],
      [-0.269134, -78.570104],
      [-0.259383, -78.5791],
      [-0.239596, -78.572271],
      [-0.208982, -78.544348],
      [-0.206415, -78.556749],
      [-0.195601, -78.549669],
      [-0.178702, -78.518265],
      [-0.176094, -78.53074],
      [-0.169542, -78.520043],
      [-0.149347, -78.554048],
      [-0.139773, -78.557122],
      [-0.134395, -78.549235],
      [-0.13721, -78.525457],
      [-0.100057, -78.558222],
      [-0.084683, -78.560804],
      [-0.081999, -78.548687],
      [-0.063789, -78.535885],
      [-0.05191, -78.51842],
      [-0.03776, -78.512096],
      [-0.050609, -78.496757],
      [-0.071397, -78.482637],
      [-0.05244, -78.466202],
      [-0.006029, -78.452171],
      [-0.014226, -78.439716],
      [-0.033724, -78.430738],
      [-0.046776, -78.412185],
      [-0.07383, -78.39026],
      [-0.093558, -78.395084],
      [-0.100115, -78.388655],
      [-0.116771, -78.383931],
      [-0.154407, -78.413879],
      [-0.168693, -78.412335],
      [-0.207014, -78.374281],
      [-0.221223, -78.369002],
      [-0.226219, -78.379194],
      [-0.23704, -78.380089],
      [-0.241114, -78.401674],
      [-0.247446, -78.40839],
      [-0.242858, -78.42284],
      [-0.250397, -78.424578],
      [-0.237455, -78.439822],
      [-0.251172, -78.442982],
      [-0.246302, -78.452029],
      [-0.259284, -78.457803],
      [-0.24209, -78.465874],
    ],
  },
  {
    id: "zon-entrega-10-usd",
    codigo: "entrega_10_usd",
    nombre: "Entrega $10",
    provincia: "Pichincha",
    modoCobro: "TARIFA_FIJA",
    tarifaFija: 10.0,
    prioridad: 11,
    activo: true,
    color: "#475569",
    sectoresReferencia: [
      "San Antonio / Mitad del Mundo",
      "Caupicho / Quitumbe Sur",
      "Puembo Oeste / Ruta Viva",
      "Conocoto Norte / La Armenia",
      "Calacalí Acceso",
    ],
    // Polígono real de isodistancia en auto <= 25.0 km (+20 km sobre zona gratuita)
    poligono: [
      [-0.282624, -78.476419],
      [-0.292808, -78.488753],
      [-0.284908, -78.498128],
      [-0.27117, -78.504264],
      [-0.314357, -78.536057],
      [-0.322798, -78.557457],
      [-0.314447, -78.570937],
      [-0.289714, -78.589629],
      [-0.259383, -78.5791],
      [-0.256255, -78.596525],
      [-0.206415, -78.556749],
      [-0.196076, -78.555779],
      [-0.191029, -78.563739],
      [-0.169542, -78.520043],
      [-0.149347, -78.554048],
      [-0.139773, -78.557122],
      [-0.134395, -78.549235],
      [-0.13721, -78.525457],
      [-0.105363, -78.568552],
      [-0.100057, -78.558222],
      [-0.084683, -78.560804],
      [-0.081999, -78.548687],
      [-0.063789, -78.535885],
      [-0.05191, -78.51842],
      [-0.03776, -78.512096],
      [-0.050609, -78.496757],
      [-0.071397, -78.482637],
      [-0.05942, -78.474279],
      [0.005932, -78.466235],
      [0.011479, -78.451116],
      [0.003519, -78.436646],
      [-0.010591, -78.423821],
      [-0.0427, -78.421885],
      [-0.04725, -78.399596],
      [-0.066829, -78.399234],
      [-0.07383, -78.39026],
      [-0.093558, -78.395084],
      [-0.106036, -78.3836],
      [-0.116771, -78.383931],
      [-0.154407, -78.413879],
      [-0.168693, -78.412335],
      [-0.177205, -78.395776],
      [-0.183154, -78.396878],
      [-0.203207, -78.360449],
      [-0.221223, -78.369002],
      [-0.236185, -78.3655],
      [-0.244546, -78.386404],
      [-0.241114, -78.401674],
      [-0.247446, -78.40839],
      [-0.242858, -78.42284],
      [-0.250397, -78.424578],
      [-0.258267, -78.450138],
      [-0.271053, -78.456912],
      [-0.271239, -78.466121],
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
    envioGratisSoloRegistrados: true,
    tarifaBaseNoRegistradoUsd: 1.0,
    tarifaPorKmNoRegistradoUsd: 0.5,
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

/**
 * Redondeo comercial de tarifas de envío en tramos de $0.50 USD:
 *  - Menos de $0.25 (0 a 24 ctv)   -> aproxima hacia abajo al entero inferior ($X.00)
 *  - De $0.25 a $0.50 (25 a 50 ctv) -> aproxima a $X.50
 *  - Más de $0.50 (51 a 99 ctv)     -> aproxima al siguiente entero superior ($(X+1).00)
 */
export function redondearTarifaComercialEnvio(valor: number): number {
  if (!Number.isFinite(valor) || valor <= 0) return 0;
  const totalCentavos = Math.round(valor * 100);
  const enteros = Math.floor(totalCentavos / 100);
  const centavos = totalCentavos % 100;

  if (centavos < 25) {
    return enteros;
  }
  if (centavos <= 50) {
    return enteros + 0.5;
  }
  return enteros + 1;
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
 * Extrae el nombre legible de lugar o calle codificado dentro de una URL expandida de Google Maps (`/maps/place/...`).
 */
export function extraerNombreLugarDeUrlMapa(urlOTexto: string): string | undefined {
  if (!urlOTexto || typeof urlOTexto !== "string") return undefined;
  const match = urlOTexto.match(/\/maps\/place\/([^/?#]+)/i);
  if (!match?.[1]) return undefined;
  let decodificado = match[1].replace(/\+/g, " ");
  try {
    decodificado = decodeURIComponent(decodificado);
  } catch {
    // Conservar valor
  }
  const limpio = decodificado.trim();
  if (!limpio || limpio.length < 3) return undefined;
  // Descartar si son únicamente coordenadas DMS o decimales (ej. "-0.245,-78.518" o "0°14'42.0\"S")
  if (/^[-+\d.,\s°'"NSEW]+$/i.test(limpio)) return undefined;
  if (/^google\s*maps$/i.test(limpio)) return undefined;
  return limpio;
}

/**
 * Resuelve en servidor enlaces acortados de Google Maps / Waze / Apple Maps siguiendo redirecciones HTTP.
 */
export async function resolverEnlaceMapaACoordenadas(
  entrada: string
): Promise<{ coordenadas: CoordenadaGeo | null; urlExpandida?: string; nombreLugar?: string }> {
  const directo = extraerCoordenadasDeTextoOUrl(entrada);
  if (directo) {
    return {
      coordenadas: directo,
      nombreLugar: extraerNombreLugarDeUrlMapa(entrada),
    };
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
    const pistaUrl = extraerNombreLugarDeUrlMapa(urlFinal);
    const desdeUrlFinal = extraerCoordenadasDeTextoOUrl(urlFinal);
    if (desdeUrlFinal) {
      return {
        coordenadas: desdeUrlFinal,
        urlExpandida: urlFinal,
        nombreLugar: pistaUrl,
      };
    }

    const html = await respuesta.text();
    const matchOgTitle = html.match(
      /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i
    );
    const tituloOg = matchOgTitle?.[1]?.trim();
    const pistaLugar =
      pistaUrl ||
      (tituloOg &&
      !/^google\s*maps$/i.test(tituloOg) &&
      !/^[-+\d.,\s°'"NSEW]+$/i.test(tituloOg)
        ? tituloOg.replace(/\s*[-·|]\s*Google Maps.*$/i, "").trim()
        : undefined);

    const desdeHtml = extraerCoordenadasDeTextoOUrl(html.slice(0, 120000));
    if (desdeHtml) {
      return {
        coordenadas: desdeHtml,
        urlExpandida: urlFinal,
        nombreLugar: pistaLugar,
      };
    }

    // Buscar meta og:image de Google Maps estático (center=lat%2Clng)
    const matchCenter = html.match(/center=(-?\d{1,2}\.\d{4,})(?:%2C|,)(-?\d{1,3}\.\d{4,})/i);
    if (matchCenter) {
      const lat = Number(matchCenter[1]);
      const lng = Number(matchCenter[2]);
      if (esCoordenadaValida(lat, lng)) {
        return {
          coordenadas: { lat, lng },
          urlExpandida: urlFinal,
          nombreLugar: pistaLugar,
        };
      }
    }

    return { coordenadas: null, urlExpandida: urlFinal, nombreLugar: pistaLugar };
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
 * Extrae calles, barrio/sector, parroquia y ciudad desde una respuesta de geocodificación inversa (Nominatim)
 * combinada opcionalmente con el nombre de lugar del enlace de Google Maps.
 */
export function construirDetalleDireccionDesdeNominatim(
  datos: {
    name?: string;
    display_name?: string;
    address?: Record<string, string | undefined>;
  } | null,
  nombreLugarPista?: string
): DetalleDireccionGeoespacial | null {
  const addr = datos?.address ?? {};
  const pista = (nombreLugarPista || "").trim();

  const limpiarAdmin = (txt?: string) => {
    const v = (txt || "").trim();
    if (!v) return "";
    if (/^administraci[oó]n\s+zonal/i.test(v)) return "";
    if (/^distrito\s+metropolitano\s+de\s+quito$/i.test(v)) return "";
    if (/^cant[oó]n\s+/i.test(v)) return v.replace(/^cant[oó]n\s+/i, "").trim();
    return v;
  };

  const calleBase = (
    addr.road ||
    addr.pedestrian ||
    addr.footway ||
    addr.street ||
    addr.path ||
    ""
  ).trim();
  const numeroCasa = (addr.house_number || "").trim();
  const viaConNumero =
    calleBase && numeroCasa ? `${calleBase} ${numeroCasa}` : calleBase;

  const poiONombre = (
    pista ||
    addr.building ||
    addr.amenity ||
    addr.shop ||
    addr.office ||
    addr.commercial ||
    datos?.name ||
    ""
  ).trim();

  let callePrincipal = viaConNumero;
  if (
    poiONombre &&
    (!callePrincipal ||
      !callePrincipal.toLowerCase().includes(poiONombre.toLowerCase())) &&
    (!callePrincipal ||
      !poiONombre.toLowerCase().includes(callePrincipal.toLowerCase()))
  ) {
    callePrincipal = callePrincipal
      ? `${poiONombre} (${callePrincipal})`
      : poiONombre;
  } else if (!callePrincipal && poiONombre) {
    callePrincipal = poiONombre;
  }

  // Sector / Barrio / Urbanización
  const candidatosSector = [
    addr.neighbourhood,
    addr.quarter,
    addr.residential,
    addr.hamlet,
    addr.allotments,
  ]
    .map(limpiarAdmin)
    .filter(Boolean);

  // Parroquia urbana o rural (ej. Chimbacalle, Iñaquito, Cumbayá, Tumbaco, Nayón, Conocoto, Calderón)
  const candidatosParroquia = [
    addr.suburb,
    addr.town,
    addr.village,
    addr.municipality,
    addr.city_district,
  ]
    .map(limpiarAdmin)
    .filter(Boolean);

  let sectorBarrio = candidatosSector[0] || "";
  let parroquia =
    candidatosParroquia.find(
      (p) => p.toLowerCase() !== sectorBarrio.toLowerCase()
    ) || "";

  // Si Nominatim puso el barrio en `suburb` y la parroquia en `town`/`village`/`city_district`
  if (!sectorBarrio && candidatosParroquia.length >= 2) {
    sectorBarrio = candidatosParroquia[0]!;
    parroquia =
      candidatosParroquia.find(
        (p) => p.toLowerCase() !== sectorBarrio.toLowerCase()
      ) || "";
  } else if (!sectorBarrio && candidatosParroquia.length === 1) {
    // Cuando solo existe una entidad sub-municipal (ej. Cumbayá o Nayón), funciona como parroquia/sector
    parroquia = candidatosParroquia[0]!;
  }

  const ciudadBruta =
    limpiarAdmin(addr.city) ||
    (addr.county && /rumi[ñn]ahui/i.test(addr.county)
      ? "Sangolquí"
      : addr.county && /quito/i.test(addr.county)
      ? "Quito"
      : limpiarAdmin(addr.county)) ||
    "";

  const ciudad =
    ciudadBruta &&
    ciudadBruta.toLowerCase() !== parroquia.toLowerCase() &&
    ciudadBruta.toLowerCase() !== sectorBarrio.toLowerCase()
      ? ciudadBruta
      : ciudadBruta || (addr.state && /pichincha/i.test(addr.state) ? "Quito" : "");

  const provincia = (addr.state || "").trim() || undefined;
  const codigoPostal = (addr.postcode || "").trim() || undefined;

  const vistos = new Set<string>();
  const partesResumen: string[] = [];
  const agregarUnico = (fragmento?: string, prefijo = "") => {
    const limpio = (fragmento || "").trim();
    if (!limpio) return;
    const clave = limpio.toLowerCase();
    if (vistos.has(clave)) return;
    vistos.add(clave);
    partesResumen.push(prefijo ? `${prefijo}${limpio}` : limpio);
  };

  agregarUnico(callePrincipal);
  agregarUnico(sectorBarrio);
  agregarUnico(parroquia, parroquia && sectorBarrio ? "Parroquia " : "");
  agregarUnico(ciudad);

  const direccionCompleta = (datos?.display_name || "").trim() || undefined;
  const resumenDireccion =
    partesResumen.join(", ") ||
    (direccionCompleta
      ? direccionCompleta
          .split(",")
          .map((s) => s.trim())
          .slice(0, 4)
          .join(", ")
      : "");

  if (!resumenDireccion) return null;

  return {
    resumenDireccion,
    ...(callePrincipal ? { callePrincipal } : {}),
    ...(sectorBarrio ? { sectorBarrio } : {}),
    ...(parroquia ? { parroquia } : {}),
    ...(ciudad ? { ciudad } : {}),
    ...(provincia ? { provincia } : {}),
    ...(codigoPostal ? { codigoPostal } : {}),
    ...(direccionCompleta ? { direccionCompleta } : {}),
  };
}

/**
 * Obtiene calles, sector/barrio y parroquia a partir de coordenadas GPS mediante Nominatim (OpenStreetMap).
 */
export async function geocodificarInversoCoordenadas(
  coordenadas: CoordenadaGeo,
  nombreLugarPista?: string
): Promise<DetalleDireccionGeoespacial | null> {
  if (!esCoordenadaValida(coordenadas.lat, coordenadas.lng)) {
    return null;
  }

  try {
    const url =
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2` +
      `&lat=${encodeURIComponent(String(coordenadas.lat))}` +
      `&lon=${encodeURIComponent(String(coordenadas.lng))}` +
      `&zoom=18&addressdetails=1`;

    const res = await fetch(url, {
      headers: {
        Accept: "application/json",
        "Accept-Language": "es",
        "User-Agent": "EcosistemaTinkayLogistica/1.0 (https://tinkay-web.vercel.app)",
      },
      signal: AbortSignal.timeout(3800),
    });

    if (!res.ok) {
      return nombreLugarPista
        ? construirDetalleDireccionDesdeNominatim(null, nombreLugarPista)
        : null;
    }

    const json = (await res.json()) as {
      name?: string;
      display_name?: string;
      address?: Record<string, string | undefined>;
    };

    return construirDetalleDireccionDesdeNominatim(json, nombreLugarPista);
  } catch {
    return nombreLugarPista
      ? construirDetalleDireccionDesdeNominatim(null, nombreLugarPista)
      : null;
  }
}

/**
 * Motor determinista de cotización de envío a domicilio.
 * Regla híbrida aprobada:
 *  1. Retiro en local -> $0.00.
 *  2. Fuera de radioMaximoKm -> bloquea cobro automático y solicita coordinación con asesora.
 *  3. Si el comprador NO está registrado (`clienteRegistrado === false` y `config.envioGratisSoloRegistrados !== false`):
 *     No existe zona de cobertura gratuita. Se cobra tarifa mínima (`tarifaBaseNoRegistradoUsd`, default $1.00)
 *     + (`distanciaVialKm × tarifaPorKmNoRegistradoUsd`, default $0.50/km), con redondeo comercial.
 *  4. Para clientes registrados (`clienteRegistrado !== false`):
 *     - Zona con modo GRATIS (ej. Centro-Norte de Quito) -> $0.00 si el producto incluye envío, o tarifaBaseNoIncluido si no lo incluye.
 *     - Zona con modo TARIFA_FIJA (ej. Cumbayá, Tumbaco, Los Chillos) -> tarifaFija de la zona (+ subsidioBaseUsd si el producto no incluía envío base).
 *     - Zona POR_KM o cualquier sector en Pichincha fuera de polígonos fijos ->
 *       Máx(recargoMinimoExtra, (distanciaVialKmDesdeTaller × tarifaPorKm) − subsidioBaseUsd),
 *       aplicando redondeo comercial (<25 ctv baja a entero, 25..50 ctv aproxima a .50, >50 ctv sube al siguiente entero).
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
    detalleDireccion = null,
    deliveryIncluidoProducto = true,
    recargoLogisticoProducto = 0,
    retiroEnLocal = false,
    clienteRegistrado = true,
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
      detalleDireccion: {
        resumenDireccion: config.origenDireccion
          ? `${config.origenNombre} (${config.origenDireccion})`
          : config.origenNombre,
        callePrincipal: config.origenDireccion || config.origenNombre,
      },
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
      detalleDireccion,
    };
  }

  // Cálculo por km base con aproximación comercial (<25 ctv -> .00 | 25..50 ctv -> .50 | >50 ctv -> +1.00)
  const subsidioAplicado = deliveryIncluidoProducto ? config.subsidioBaseUsd : 0;
  const brutoPorKm = redondearMoneda(vialKm * config.tarifaPorKm);
  const netoPorKm = redondearMoneda(brutoPorKm - subsidioAplicado);
  const minimoExtra = deliveryIncluidoProducto
    ? config.recargoMinimoExtra
    : Math.max(config.tarifaBaseNoIncluido, config.recargoMinimoExtra);
  const costoExactoSinRedondeo = redondearMoneda(Math.max(minimoExtra, netoPorKm));
  const costoBaseKm = Math.max(
    redondearTarifaComercialEnvio(minimoExtra),
    redondearTarifaComercialEnvio(costoExactoSinRedondeo)
  );
  const totalKm = redondearTarifaComercialEnvio(costoBaseKm + recargoProd);

  const sufijoAproximacion =
    Math.abs(costoBaseKm - costoExactoSinRedondeo) >= 0.01
      ? ` → aproximado $${costoBaseKm.toFixed(2)}`
      : "";

  const formulaKmBase =
    subsidioAplicado > 0
      ? `${vialKm.toFixed(1)} km × $${config.tarifaPorKm.toFixed(2)}/km ($${brutoPorKm.toFixed(2)}) − $${subsidioAplicado.toFixed(2)} incluido = $${costoExactoSinRedondeo.toFixed(2)}${sufijoAproximacion} (mín. $${minimoExtra.toFixed(2)})${
          recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
        }.`
      : `${vialKm.toFixed(1)} km × $${config.tarifaPorKm.toFixed(2)}/km = $${costoExactoSinRedondeo.toFixed(2)}${sufijoAproximacion}${
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
            const total = redondearTarifaComercialEnvio(recargoProd);
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

          const baseNoInc = redondearTarifaComercialEnvio(config.tarifaBaseNoIncluido);
          const total = redondearTarifaComercialEnvio(baseNoInc + recargoProd);
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
          const baseSinRedondeo = redondearMoneda(z.tarifaFija + compensacionNoIncluido);
          const baseZona = redondearTarifaComercialEnvio(baseSinRedondeo);
          const total = redondearTarifaComercialEnvio(baseZona + recargoProd);
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

    const resultadoRegistradoEnZona: ResultadoCotizacionEnvio = {
      ok: true,
      dentroCobertura: true,
      reglaAplicada: ganadora.reglaAplicada,
      clienteRegistrado: true,
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
      detalleDireccion,
    };

    if (!clienteRegistrado && config.envioGratisSoloRegistrados !== false) {
      return aplicarTarifaVisitanteNoRegistrado({
        config,
        vialKm,
        sufijoKm,
        recargoProd,
        baseRegistrado: resultadoRegistradoEnZona,
      });
    }

    return resultadoRegistradoEnZona;
  }

  // Fuera de polígonos zonificados (pero dentro del radio máximo en Pichincha): cálculo por km
  const resultadoRegistradoFueraPoligonos: ResultadoCotizacionEnvio = {
    ok: true,
    dentroCobertura: true,
    reglaAplicada: "CALCULO_POR_KM",
    clienteRegistrado: true,
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
    detalleDireccion,
  };

  if (!clienteRegistrado && config.envioGratisSoloRegistrados !== false) {
    return aplicarTarifaVisitanteNoRegistrado({
      config,
      vialKm,
      sufijoKm,
      recargoProd,
      baseRegistrado: resultadoRegistradoFueraPoligonos,
    });
  }

  return resultadoRegistradoFueraPoligonos;
}

function aplicarTarifaVisitanteNoRegistrado(params: {
  config: ConfiguracionLogisticaNegocio;
  vialKm: number;
  sufijoKm: string;
  recargoProd: number;
  baseRegistrado: ResultadoCotizacionEnvio;
}): ResultadoCotizacionEnvio {
  const { config, vialKm, sufijoKm, recargoProd, baseRegistrado } = params;
  const baseMinima = Number.isFinite(Number(config.tarifaBaseNoRegistradoUsd))
    ? Math.max(0, Number(config.tarifaBaseNoRegistradoUsd))
    : 1.0;
  const costoKm = Number.isFinite(Number(config.tarifaPorKmNoRegistradoUsd))
    ? Math.max(0, Number(config.tarifaPorKmNoRegistradoUsd))
    : Number.isFinite(Number(config.tarifaPorKm))
    ? Math.max(0, Number(config.tarifaPorKm))
    : 0.5;

  const variableKm = redondearMoneda(vialKm * costoKm);
  const exactoSinRedondeo = redondearMoneda(baseMinima + variableKm);
  const costoBaseInvitado = Math.max(
    redondearMoneda(baseMinima),
    redondearTarifaComercialEnvio(exactoSinRedondeo)
  );
  const totalInvitado = redondearTarifaComercialEnvio(costoBaseInvitado + recargoProd);
  const costoReg = baseRegistrado.costoTotalEnvio;
  const ahorro = Math.max(0, redondearMoneda(totalInvitado - costoReg));

  const sufijoRedondeo =
    Math.abs(costoBaseInvitado - exactoSinRedondeo) >= 0.01
      ? ` → aproximado $${costoBaseInvitado.toFixed(2)}`
      : "";
  const nombreSector = baseRegistrado.zonaDetectada?.nombre || "Envío a domicilio";

  return {
    ...baseRegistrado,
    reglaAplicada: "TARIFA_NO_REGISTRADO_KM",
    clienteRegistrado: false,
    costoBaseEnvio: costoBaseInvitado,
    costoTotalEnvio: totalInvitado,
    costoSiFueraRegistradoUsd: costoReg,
    ahorroPorRegistrarseUsd: ahorro,
    etiquetaResumen: `${nombreSector}${sufijoKm}`,
    formulaDetalle: `Visitante no registrado (sin zona gratuita): $${baseMinima.toFixed(
      2
    )} base + (${vialKm.toFixed(1)} km × $${costoKm.toFixed(2)}/km = $${variableKm.toFixed(
      2
    )}) = $${exactoSinRedondeo.toFixed(2)}${sufijoRedondeo}${
      recargoProd > 0 ? ` + $${recargoProd.toFixed(2)} transporte especial` : ""
    } [Cliente registrado pagaría $${costoReg.toFixed(2)}].`,
  };
}

