// Catálogo maestro de variedades de rosas ecuatorianas basado en Floraroma S.A.
// Incluye las 11 categorías oficiales de color, nombres de variedades e imágenes
// de referencia, más configuración de variedad por defecto por color.

export interface VariedadRosaCatalogo {
  id: string;
  colorClave: string;
  nombre: string;
  imagenUrl: string;
  esDefecto: boolean;
  orden: number;
  esPersonalizada?: boolean;
}

export type TipoFlorInventario = "rosa" | "girasol" | "orquidea";

export interface DefinicionColorOrquidea {
  clave: string;
  etiqueta: string;
  nombreCorto: string;
  colorHex: string;
  fondoHex: string;
  textoHex: string;
}

export const COLORES_ORQUIDEA_CYMBIDIUM: DefinicionColorOrquidea[] = [
  {
    clave: "blanco",
    etiqueta: "Orquídea Blanca",
    nombreCorto: "Blanco",
    colorHex: "#F8FAFC",
    fondoHex: "#F8FAFC",
    textoHex: "#334155",
  },
  {
    clave: "beige",
    etiqueta: "Orquídea Beige",
    nombreCorto: "Beige",
    colorHex: "#D6C5A3",
    fondoHex: "#FFFBEB",
    textoHex: "#78350F",
  },
  {
    clave: "verde",
    etiqueta: "Orquídea Verde",
    nombreCorto: "Verde",
    colorHex: "#16A34A",
    fondoHex: "#F0FDF4",
    textoHex: "#166534",
  },
  {
    clave: "amarilla",
    etiqueta: "Orquídea Amarilla",
    nombreCorto: "Amarilla",
    colorHex: "#EAB308",
    fondoHex: "#FEFCE8",
    textoHex: "#854D0E",
  },
  {
    clave: "lila",
    etiqueta: "Orquídea Lila",
    nombreCorto: "Lila",
    colorHex: "#A855F7",
    fondoHex: "#FAF5FF",
    textoHex: "#6B21A8",
  },
];

export function normalizarColorOrquideaClave(texto: string): string {
  const t = String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/^orquidea[_\s-]+/i, "")
    .trim();
  if (t.includes("blanc") || t.includes("white")) return "blanco";
  if (t.includes("beige") || t.includes("crema") || t.includes("champagne") || t.includes("bronce") || t.includes("naranj"))
    return "beige";
  if (t.includes("verd") || t.includes("green") || t.includes("limon")) return "verde";
  if (t.includes("amarill") || t.includes("yellow") || t.includes("dorad")) return "amarilla";
  if (
    t.includes("lila") ||
    t.includes("lavand") ||
    t.includes("morad") ||
    t.includes("purpl") ||
    t.includes("rosa") ||
    t.includes("fucsia") ||
    t.includes("vino") ||
    t.includes("burdeo") ||
    t.includes("bicolor")
  )
    return "lila";
  return "blanco";
}

export interface ItemConteoVariedad {
  id: string;
  tipoFlor?: TipoFlorInventario;
  colorClave: string;
  variedadId?: string;
  variedadNombre: string;
  imagenUrl?: string;
  cantidad: number;
  /** Solo para orquídeas / Cymbidium: cantidad total de flores/campanas visibles. */
  numeroFlores?: number;
  origen?: "ia" | "manual";
}

export interface ResumenVariedadConsolidado {
  tipoFlor: TipoFlorInventario;
  colorClave: string;
  variedadNombre: string;
  imagenUrl?: string;
  cantidad: number;
  numeroFlores?: number;
}

export const BASE_IMAGEN_FLORAROMA = "https://sistema.floraroma.com.ec/public/img/productos/";

const TUPLAS_SEMILLA_FLORAROMA: ReadonlyArray<readonly [string, string, string, 0 | 1]> = [
  [
    "rojo",
    "Black magic",
    "black-magic-1-6af5b934cdcbf.webp",
    0
  ],
  [
    "rojo",
    "Explorer",
    "explorer2-1-6af5b85c22fb1.webp",
    1
  ],
  [
    "rojo",
    "Freedom",
    "freedom2-1-6af5b84bd30d1.webp",
    0
  ],
  [
    "rojo",
    "Redvolution",
    "redvolution-ok-web-convertido-de-png-69b1722e95da4.webp",
    0
  ],
  [
    "rojo",
    "Sexy red",
    "sexy-red-2-6af5b9478d893.webp",
    0
  ],
  [
    "blanco",
    "Candlelight",
    "candlelight.webp",
    0
  ],
  [
    "blanco",
    "Cotton x-pression",
    "cotton xpression.webp",
    0
  ],
  [
    "blanco",
    "Dynamic",
    "dynamic.webp",
    0
  ],
  [
    "blanco",
    "Mia",
    "mia.webp",
    0
  ],
  [
    "blanco",
    "Mondial",
    "mondial.webp",
    1
  ],
  [
    "blanco",
    "Moonstone",
    "moonstone.webp",
    0
  ],
  [
    "blanco",
    "Playa blanca",
    "playa-blanca2-6af5b391bb07b.webp",
    0
  ],
  [
    "blanco",
    "Polar star",
    "POLARSTART-6af5b5fb4ed66.webp",
    0
  ],
  [
    "blanco",
    "Proud",
    "proud-1-6af5b60d82c1b.webp",
    0
  ],
  [
    "blanco",
    "Quicksand",
    "quicksand.webp",
    0
  ],
  [
    "blanco",
    "Soul",
    "soul.webp",
    0
  ],
  [
    "blanco",
    "Tibet",
    "tibet.webp",
    0
  ],
  [
    "blanco",
    "Vendela",
    "vendela.webp",
    0
  ],
  [
    "blanco",
    "White Shimmer",
    "white shimmer.webp",
    0
  ],
  [
    "rosado",
    "Amorosa",
    "amorosa.webp",
    0
  ],
  [
    "rosado",
    "Be Sweet",
    "be sweet.webp",
    0
  ],
  [
    "rosado",
    "Engagement",
    "engagement.webp",
    0
  ],
  [
    "rosado",
    "Esperance",
    "esperance.webp",
    0
  ],
  [
    "rosado",
    "Frutteto",
    "frutteto.webp",
    1
  ],
  [
    "rosado",
    "Geraldine",
    "GERALDINE-2-69c5944571e95.webp",
    0
  ],
  [
    "rosado",
    "Hermosa",
    "hermosa.webp",
    0
  ],
  [
    "rosado",
    "Lorraine",
    "lorraine.webp",
    0
  ],
  [
    "rosado",
    "Luciano",
    "luciano-69c5937c2faa3.webp",
    0
  ],
  [
    "rosado",
    "Mandala",
    "mandala.webp",
    0
  ],
  [
    "rosado",
    "Nena",
    "nena.webp",
    0
  ],
  [
    "rosado",
    "Novia",
    "novia.webp",
    0
  ],
  [
    "rosado",
    "Paloma",
    "paloma-66a289928a3ca.webp",
    0
  ],
  [
    "rosado",
    "Pink Mondial",
    "pink mondial.webp",
    0
  ],
  [
    "rosado",
    "Pricelss",
    "priceless-6af4db286629a.webp",
    0
  ],
  [
    "rosado",
    "Saga",
    "saga.webp",
    0
  ],
  [
    "rosado",
    "Salma",
    "salma.webp",
    0
  ],
  [
    "rosado",
    "Sweet Memory",
    "sweet memory.webp",
    0
  ],
  [
    "rosado",
    "Sweet Unique",
    "sweet unique.webp",
    0
  ],
  [
    "fucsia",
    "Full Monty",
    "full monty.webp",
    0
  ],
  [
    "fucsia",
    "Gotcha",
    "gotcha.webp",
    0
  ],
  [
    "fucsia",
    "Hot Explorer",
    "hot explorer.webp",
    0
  ],
  [
    "fucsia",
    "Hotspot",
    "hotspot.webp",
    0
  ],
  [
    "fucsia",
    "Janeiro",
    "janeiro.webp",
    0
  ],
  [
    "fucsia",
    "Lola",
    "lola.webp",
    0
  ],
  [
    "fucsia",
    "Pink Floyd",
    "pink floyd.webp",
    1
  ],
  [
    "fucsia",
    "Vi pink",
    "vi-pink-6995b13234823.webp",
    0
  ],
  [
    "amarillo",
    "Brighton",
    "brighton.webp",
    1
  ],
  [
    "amarillo",
    "Bumblebee",
    "bumblebee-66c63eb210e58.webp",
    0
  ],
  [
    "amarillo",
    "Goldfinch",
    "goldfinch.webp",
    0
  ],
  [
    "amarillo",
    "Momentum",
    "momentum.webp",
    0
  ],
  [
    "amarillo",
    "Newsflash",
    "newsflash.webp",
    0
  ],
  [
    "amarillo",
    "Silantoi",
    "silantoi.webp",
    0
  ],
  [
    "amarillo",
    "Stardust",
    "stardust.webp",
    0
  ],
  [
    "amarillo",
    "Super Sun",
    "super sun.webp",
    0
  ],
  [
    "durazno",
    "Kahala",
    "kahala.webp",
    1
  ],
  [
    "durazno",
    "Phoenix",
    "phoenix.webp",
    0
  ],
  [
    "durazno",
    "Primavera",
    "primavera.webp",
    0
  ],
  [
    "durazno",
    "Shimmer",
    "shimmer.webp",
    0
  ],
  [
    "durazno",
    "Tiffany",
    "tiffany.webp",
    0
  ],
  [
    "naranja",
    "Aloha",
    "aloha.webp",
    0
  ],
  [
    "naranja",
    "High Booming",
    "high booming.webp",
    0
  ],
  [
    "naranja",
    "High magic",
    "high-magic-6af5b17b065df.webp",
    1
  ],
  [
    "naranja",
    "High orange",
    "high-orange-2-6af5b12fc9c5e.webp",
    0
  ],
  [
    "naranja",
    "Hilux",
    "hilux.webp",
    0
  ],
  [
    "naranja",
    "Iguana",
    "iguana.webp",
    0
  ],
  [
    "naranja",
    "Mandarin",
    "mandarin-6af4dd1fe2273.webp",
    0
  ],
  [
    "naranja",
    "Nina",
    "nina.webp",
    0
  ],
  [
    "naranja",
    "Orange Bowl",
    "orange bowl.webp",
    0
  ],
  [
    "naranja",
    "Orange crush",
    "orange crush.webp",
    0
  ],
  [
    "naranja",
    "Showgirl",
    "showgirl-6af53c9d42044.webp",
    0
  ],
  [
    "naranja",
    "Tamara",
    "tamara1-67fd08aac9171.webp",
    0
  ],
  [
    "naranja",
    "Trottola",
    "trottola.webp",
    0
  ],
  [
    "lavanda",
    "Cool Water",
    "cool water.webp",
    1
  ],
  [
    "lavanda",
    "Deep Purple",
    "deep purple.webp",
    0
  ],
  [
    "lavanda",
    "Faith",
    "fait-6af4dbcbb4063.webp",
    0
  ],
  [
    "lavanda",
    "Moody blues",
    "moody blues.webp",
    0
  ],
  [
    "lavanda",
    "Ocean Song",
    "ocean song.webp",
    0
  ],
  [
    "novedad",
    "Abaude",
    "abaude-6af4c8ece2f36.webp",
    0
  ],
  [
    "novedad",
    "Blush",
    "blush.webp",
    0
  ],
  [
    "novedad",
    "Magic Times",
    "magic times.webp",
    1
  ],
  [
    "novedad",
    "Sweetness",
    "sweetness.webp",
    0
  ],
  [
    "tinturado",
    "Black",
    "black.webp",
    0
  ],
  [
    "tinturado",
    "Blue",
    "blue.webp",
    1
  ],
  [
    "tinturado",
    "Gold",
    "gold.webp",
    0
  ],
  [
    "verde",
    "Wasabi",
    "wasabi-667c6d0f12fa7.webp",
    1
  ]
];

export const CATALOGO_SEMILLA_VARIEDADES_ROSAS: VariedadRosaCatalogo[] =
  TUPLAS_SEMILLA_FLORAROMA.map(([colorClave, nombre, archivo, esDef], idx) => ({
    id: `seed-${colorClave}-${nombre
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")}-${idx}`,
    colorClave,
    nombre,
    imagenUrl: archivo
      ? archivo.startsWith("http")
        ? archivo
        : `${BASE_IMAGEN_FLORAROMA}${archivo}`
      : "",
    esDefecto: esDef === 1,
    orden: idx + 1,
  }));

export function normalizarNombreVariedadComparacion(texto: string): string {
  return String(texto || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function obtenerVariedadesPorColor(
  catalogo: VariedadRosaCatalogo[],
  colorClave: string
): VariedadRosaCatalogo[] {
  const lista = catalogo.filter((v) => v.colorClave === colorClave);
  return [...lista].sort((a, b) => {
    if (a.esDefecto !== b.esDefecto) return a.esDefecto ? -1 : 1;
    return a.nombre.localeCompare(b.nombre, "es");
  });
}

export function obtenerVariedadDefectoPorColor(
  catalogo: VariedadRosaCatalogo[],
  colorClave: string
): VariedadRosaCatalogo | null {
  const delColor = catalogo.filter((v) => v.colorClave === colorClave);
  return delColor.find((v) => v.esDefecto) ?? delColor[0] ?? null;
}

export function resolverVariedadDesdeCatalogo(
  catalogo: VariedadRosaCatalogo[],
  colorClave: string,
  nombreDetectado?: string | null
): VariedadRosaCatalogo | null {
  const buscado = normalizarNombreVariedadComparacion(nombreDetectado || "");
  if (buscado) {
    const exactaEnColor = catalogo.find(
      (v) =>
        v.colorClave === colorClave &&
        normalizarNombreVariedadComparacion(v.nombre) === buscado
    );
    if (exactaEnColor) return exactaEnColor;

    const exactaGlobal = catalogo.find(
      (v) => normalizarNombreVariedadComparacion(v.nombre) === buscado
    );
    if (exactaGlobal) return exactaGlobal;

    const parcialEnColor = catalogo.find(
      (v) =>
        v.colorClave === colorClave &&
        (normalizarNombreVariedadComparacion(v.nombre).includes(buscado) ||
          buscado.includes(normalizarNombreVariedadComparacion(v.nombre)))
    );
    if (parcialEnColor) return parcialEnColor;
  }
  return obtenerVariedadDefectoPorColor(catalogo, colorClave);
}

export function convertirConteoColoresAItemsVariedad(
  conteoColores: Record<string, number>,
  catalogo: VariedadRosaCatalogo[],
  origen: "ia" | "manual" = "ia"
): ItemConteoVariedad[] {
  const items: ItemConteoVariedad[] = [];
  for (const [colorClaveRaw, rawCant] of Object.entries(conteoColores || {})) {
    const cantidad = Math.max(0, Math.round(Number(rawCant) || 0));
    if (cantidad <= 0) continue;
    const colorLimpio = String(colorClaveRaw || "").trim().toLowerCase();
    if (colorLimpio === "girasol" || colorLimpio === "girasoles") {
      items.push({
        id: `item-girasol-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipoFlor: "girasol",
        colorClave: "girasol",
        variedadNombre: "Girasoles",
        cantidad,
        origen,
      });
      continue;
    }
    if (colorLimpio.startsWith("orquidea_")) {
      const claveOrq = normalizarColorOrquideaClave(colorLimpio.slice(9));
      const defOrq =
        COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === claveOrq) ??
        COLORES_ORQUIDEA_CYMBIDIUM[0]!;
      items.push({
        id: `item-orq-${claveOrq}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        tipoFlor: "orquidea",
        colorClave: claveOrq,
        variedadNombre: defOrq.etiqueta,
        cantidad: 1,
        numeroFlores: cantidad,
        origen,
      });
      continue;
    }
    const def = obtenerVariedadDefectoPorColor(catalogo, colorLimpio);
    items.push({
      id: `item-${colorLimpio}-${def?.id ?? "def"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      tipoFlor: "rosa",
      colorClave: colorLimpio,
      variedadId: def?.id,
      variedadNombre: def?.nombre ?? colorLimpio,
      imagenUrl: def?.imagenUrl,
      cantidad,
      origen,
    });
  }
  return items;
}

export function calcularResumenColoresDesdeItems(
  items: ItemConteoVariedad[]
): Record<string, number> {
  const resumen: Record<string, number> = {};
  for (const item of items) {
    if (item.tipoFlor === "orquidea") {
      const flores = Math.max(0, Math.round(Number(item.numeroFlores) || 0));
      const varas = Math.max(0, Math.round(Number(item.cantidad) || 0));
      const unidades = flores > 0 ? flores : varas;
      if (unidades <= 0) continue;
      const claveOrq = normalizarColorOrquideaClave(item.colorClave);
      resumen[`orquidea_${claveOrq}`] = (resumen[`orquidea_${claveOrq}`] ?? 0) + unidades;
      continue;
    }
    const n = Math.max(0, Math.round(Number(item.cantidad) || 0));
    if (n <= 0) continue;
    const clave = item.tipoFlor === "girasol" ? "girasol" : item.colorClave;
    resumen[clave] = (resumen[clave] ?? 0) + n;
  }
  return resumen;
}

export function consolidarVariedadesDesdeFotos(
  fotos: Array<{
    conteoColores?: Record<string, number>;
    itemsVariedad?: ItemConteoVariedad[];
  }>,
  catalogo: VariedadRosaCatalogo[]
): {
  resumenVariedades: ResumenVariedadConsolidado[];
  resumenColores: Record<string, number>;
  totalPaquetes: number;
  totalGirasoles: number;
  totalVarasOrquidea: number;
  totalFloresOrquidea: number;
} {
  const mapaVariedad = new Map<string, ResumenVariedadConsolidado>();
  const resumenColores: Record<string, number> = {};
  let totalPaquetes = 0;
  let totalGirasoles = 0;
  let totalVarasOrquidea = 0;
  let totalFloresOrquidea = 0;

  for (const foto of fotos) {
    const items =
      Array.isArray(foto.itemsVariedad) && foto.itemsVariedad.length > 0
        ? foto.itemsVariedad
        : convertirConteoColoresAItemsVariedad(foto.conteoColores || {}, catalogo, "ia");

    for (const item of items) {
      const tipo: TipoFlorInventario =
        item.tipoFlor === "orquidea"
          ? "orquidea"
          : item.tipoFlor === "girasol" || item.colorClave === "girasol"
            ? "girasol"
            : "rosa";
      const cant = Math.max(0, Math.round(Number(item.cantidad) || 0));
      const flores = Math.max(0, Math.round(Number(item.numeroFlores) || 0));
      if (cant <= 0 && flores <= 0) continue;

      const colorNormalizado =
        tipo === "orquidea"
          ? normalizarColorOrquideaClave(item.colorClave)
          : tipo === "girasol"
            ? "girasol"
            : item.colorClave;

      const defOrq =
        tipo === "orquidea"
          ? COLORES_ORQUIDEA_CYMBIDIUM.find((c) => c.clave === colorNormalizado)
          : null;
      const nombreNormalizado =
        tipo === "girasol"
          ? "Girasoles"
          : tipo === "orquidea"
            ? defOrq?.etiqueta || item.variedadNombre || `Orquídea ${colorNormalizado}`
            : item.variedadNombre;

      const key = `${tipo}::${colorNormalizado}::${normalizarNombreVariedadComparacion(nombreNormalizado)}`;
      const existente = mapaVariedad.get(key);
      if (existente) {
        existente.cantidad += cant;
        if (tipo === "orquidea") {
          existente.numeroFlores = (existente.numeroFlores ?? 0) + (flores > 0 ? flores : cant);
        }
      } else {
        const ref =
          tipo === "rosa"
            ? resolverVariedadDesdeCatalogo(catalogo, colorNormalizado, item.variedadNombre)
            : null;
        mapaVariedad.set(key, {
          tipoFlor: tipo,
          colorClave: colorNormalizado,
          variedadNombre: nombreNormalizado || ref?.nombre || colorNormalizado,
          imagenUrl: item.imagenUrl || ref?.imagenUrl,
          cantidad: cant,
          numeroFlores: tipo === "orquidea" ? (flores > 0 ? flores : cant) : undefined,
        });
      }

      if (tipo === "orquidea") {
        const claveOrq = `orquidea_${colorNormalizado}`;
        const unidadesOrq = flores > 0 ? flores : Math.max(1, cant);
        resumenColores[claveOrq] = (resumenColores[claveOrq] ?? 0) + unidadesOrq;
        totalVarasOrquidea += cant;
        totalFloresOrquidea += unidadesOrq;
      } else if (tipo === "girasol") {
        resumenColores.girasol = (resumenColores.girasol ?? 0) + cant;
        totalGirasoles += cant;
      } else {
        resumenColores[colorNormalizado] = (resumenColores[colorNormalizado] ?? 0) + cant;
        totalPaquetes += cant;
      }
    }
  }

  const ordenTipo: Record<TipoFlorInventario, number> = {
    rosa: 0,
    girasol: 1,
    orquidea: 2,
  };

  return {
    resumenVariedades: Array.from(mapaVariedad.values()).sort((a, b) => {
      if (a.tipoFlor !== b.tipoFlor) return ordenTipo[a.tipoFlor] - ordenTipo[b.tipoFlor];
      const valA = a.tipoFlor === "orquidea" ? a.numeroFlores ?? a.cantidad : a.cantidad;
      const valB = b.tipoFlor === "orquidea" ? b.numeroFlores ?? b.cantidad : b.cantidad;
      return valB - valA;
    }),
    resumenColores,
    totalPaquetes,
    totalGirasoles,
    totalVarasOrquidea,
    totalFloresOrquidea,
  };
}
