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

export type TipoFlorInventario = "rosa" | "orquidea";

export interface DefinicionColorOrquidea {
  clave: string;
  etiqueta: string;
  colorHex: string;
  fondoHex: string;
  textoHex: string;
}

export const COLORES_ORQUIDEA_CYMBIDIUM: DefinicionColorOrquidea[] = [
  { clave: "amarillo", etiqueta: "Cymbidium Amarillo", colorHex: "#EAB308", fondoHex: "#FEFCE8", textoHex: "#854D0E" },
  { clave: "blanco", etiqueta: "Cymbidium Blanco", colorHex: "#CBD5E1", fondoHex: "#F8FAFC", textoHex: "#334155" },
  { clave: "verde", etiqueta: "Cymbidium Verde", colorHex: "#16A34A", fondoHex: "#F0FDF4", textoHex: "#166534" },
  { clave: "rosado", etiqueta: "Cymbidium Rosado", colorHex: "#F472B6", fondoHex: "#FDF2F8", textoHex: "#9D174D" },
  { clave: "vino", etiqueta: "Cymbidium Vino / Burdeos", colorHex: "#881337", fondoHex: "#FFF1F2", textoHex: "#881337" },
  { clave: "crema", etiqueta: "Cymbidium Crema / Champagne", colorHex: "#D6C5A3", fondoHex: "#FFFBEB", textoHex: "#78350F" },
  { clave: "naranja", etiqueta: "Cymbidium Naranja / Bronce", colorHex: "#EA580C", fondoHex: "#FFEDD5", textoHex: "#9A3412" },
  { clave: "bicolor", etiqueta: "Cymbidium Bicolor", colorHex: "#8B5CF6", fondoHex: "#F5F3FF", textoHex: "#5B21B6" },
];

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
    "Adore",
    "m0129.webp",
    0
  ],
  [
    "tinturado",
    "Agape",
    "m0133-667da23c61d1f.webp",
    0
  ],
  [
    "tinturado",
    "Amber",
    "amber.webp",
    0
  ],
  [
    "tinturado",
    "Amethyst marbled",
    "amethyst marbled.webp",
    0
  ],
  [
    "tinturado",
    "Antique gold",
    "m0031.webp",
    0
  ],
  [
    "tinturado",
    "Aquamarine",
    "m0103.webp",
    0
  ],
  [
    "tinturado",
    "Armageddon marbled",
    "m0069.webp",
    0
  ],
  [
    "tinturado",
    "Arty",
    "m0060.webp",
    0
  ],
  [
    "tinturado",
    "Autum mix tinted",
    "autum mix tinted.webp",
    0
  ],
  [
    "tinturado",
    "Beetlejuice",
    "7-671c07b11fc21.webp",
    0
  ],
  [
    "tinturado",
    "Beige",
    "m0056.webp",
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
    "Black brushed",
    "m0064.webp",
    0
  ],
  [
    "tinturado",
    "Black edge hot pink",
    "black edge hot pink.webp",
    0
  ],
  [
    "tinturado",
    "Black edge white",
    "black edge white.webp",
    0
  ],
  [
    "tinturado",
    "Black glittered rainbow",
    "black glittered rainbow.webp",
    0
  ],
  [
    "tinturado",
    "Black heart",
    "black heart.webp",
    0
  ],
  [
    "tinturado",
    "Black ink",
    "m0123.webp",
    0
  ],
  [
    "tinturado",
    "Black magic t",
    "m0126.webp",
    0
  ],
  [
    "tinturado",
    "Black marbled",
    "m0053.webp",
    0
  ],
  [
    "tinturado",
    "Black party marbled",
    "m0066.webp",
    0
  ],
  [
    "tinturado",
    "Black purple blue",
    "black purple blue.webp",
    0
  ],
  [
    "tinturado",
    "Black purple glittered",
    "black blue glittered.webp",
    0
  ],
  [
    "tinturado",
    "Black rainbow",
    "black rainbow.webp",
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
    "Blue lace pink white",
    "blue lace pink white.webp",
    0
  ],
  [
    "tinturado",
    "Blue lagoon",
    "m0120.webp",
    0
  ],
  [
    "tinturado",
    "Blue silk white",
    "blue lance white.webp",
    0
  ],
  [
    "tinturado",
    "Blue treasure",
    "m0035.webp",
    0
  ],
  [
    "tinturado",
    "Blue velvet",
    "blue velvet.webp",
    0
  ],
  [
    "tinturado",
    "Blue white",
    "blue white.webp",
    0
  ],
  [
    "tinturado",
    "Boogie",
    "m0063.webp",
    0
  ],
  [
    "tinturado",
    "Bubblegum",
    "m0045.webp",
    0
  ],
  [
    "tinturado",
    "Burgundy marbled",
    "burgundy marbled.webp",
    0
  ],
  [
    "tinturado",
    "Celebration",
    "m0131.webp",
    0
  ],
  [
    "tinturado",
    "Christmas pine",
    "m0018.webp",
    0
  ],
  [
    "tinturado",
    "Christmas punch",
    "m0021.webp",
    0
  ],
  [
    "tinturado",
    "Christmas tree",
    "m0019.webp",
    0
  ],
  [
    "tinturado",
    "Clover",
    "m0017.webp",
    0
  ],
  [
    "tinturado",
    "Cocoa",
    "m0046.webp",
    0
  ],
  [
    "tinturado",
    "Confetti celebration",
    "m0130.webp",
    0
  ],
  [
    "tinturado",
    "Cosmic blue",
    "cosmic blue.webp",
    0
  ],
  [
    "tinturado",
    "Cotton candy",
    "m0098.webp",
    0
  ],
  [
    "tinturado",
    "Cream purple edge",
    "cream purple edge.webp",
    0
  ],
  [
    "tinturado",
    "Dark halloween",
    "m0061.webp",
    0
  ],
  [
    "tinturado",
    "Dark purple brushed",
    "m0074.webp",
    0
  ],
  [
    "tinturado",
    "Dark purple marbled",
    "m0072.webp",
    0
  ],
  [
    "tinturado",
    "Drakon",
    "m0092.webp",
    0
  ],
  [
    "tinturado",
    "Dream velvet",
    "m0106.webp",
    0
  ],
  [
    "tinturado",
    "Elf",
    "m0023.webp",
    0
  ],
  [
    "tinturado",
    "Eucalyptus",
    "eucalyptus.webp",
    0
  ],
  [
    "tinturado",
    "Eva",
    "m0089.webp",
    0
  ],
  [
    "tinturado",
    "Fairy",
    "m0039.webp",
    0
  ],
  [
    "tinturado",
    "Fairy pink",
    "fairy pink.webp",
    0
  ],
  [
    "tinturado",
    "Flames",
    "m0088.webp",
    0
  ],
  [
    "tinturado",
    "Forest moon",
    "m0020.webp",
    0
  ],
  [
    "tinturado",
    "Forever",
    "david.webp",
    0
  ],
  [
    "tinturado",
    "Frog",
    "m0058.webp",
    0
  ],
  [
    "tinturado",
    "Frosty",
    "m0026.webp",
    0
  ],
  [
    "tinturado",
    "Gleam",
    "m0030.webp",
    0
  ],
  [
    "tinturado",
    "Glint",
    "m0029.webp",
    0
  ],
  [
    "tinturado",
    "Goblin",
    "m0093.webp",
    0
  ],
  [
    "tinturado",
    "Gold",
    "gold.webp",
    0
  ],
  [
    "tinturado",
    "Gradient green",
    "gradient green.webp",
    0
  ],
  [
    "tinturado",
    "Gray blue",
    "purple moon.webp",
    0
  ],
  [
    "tinturado",
    "Gray moon",
    "gray moon.webp",
    0
  ],
  [
    "tinturado",
    "Green",
    "green.webp",
    0
  ],
  [
    "tinturado",
    "Green white",
    "green white.webp",
    0
  ],
  [
    "tinturado",
    "Grinch",
    "m0022.webp",
    0
  ],
  [
    "tinturado",
    "Halloween night",
    "1-1-671c08184db10.webp",
    0
  ],
  [
    "tinturado",
    "Heartbreaker",
    "m0011.webp",
    0
  ],
  [
    "tinturado",
    "Iridicent",
    "m0055.webp",
    0
  ],
  [
    "tinturado",
    "Iris",
    "m0025.webp",
    0
  ],
  [
    "tinturado",
    "Jassie",
    "jassie.webp",
    0
  ],
  [
    "tinturado",
    "Jingle bells",
    "2-672bc800abee4.webp",
    0
  ],
  [
    "tinturado",
    "Lavender",
    "lavender.webp",
    0
  ],
  [
    "tinturado",
    "Lavender rainbow",
    "lavender rainbow.webp",
    0
  ],
  [
    "tinturado",
    "Lavender velvet",
    "lavender velvet.webp",
    0
  ],
  [
    "tinturado",
    "Lemon time",
    "m0087.webp",
    0
  ],
  [
    "tinturado",
    "Light blue",
    "light blue.webp",
    0
  ],
  [
    "tinturado",
    "Light orange",
    "light orange.webp",
    0
  ],
  [
    "tinturado",
    "Light periwinkle",
    "light periwinkle.webp",
    0
  ],
  [
    "tinturado",
    "Ligth blue marbled",
    "ligth blue marbled.webp",
    0
  ],
  [
    "tinturado",
    "Lilac marbled",
    "m0136-66a297804bdd9.webp",
    0
  ],
  [
    "tinturado",
    "Lime",
    "m0122.webp",
    0
  ],
  [
    "tinturado",
    "Lucky",
    "m0091.webp",
    0
  ],
  [
    "tinturado",
    "M410",
    "1-672bc7ec31d84.webp",
    0
  ],
  [
    "tinturado",
    "M412",
    "3-672bc816196b2.webp",
    0
  ],
  [
    "tinturado",
    "M413",
    "4-672bc82fede40.webp",
    0
  ],
  [
    "tinturado",
    "M414",
    "5-672bc85954c03.webp",
    0
  ],
  [
    "tinturado",
    "M415",
    "6-672bc86c3e980.webp",
    0
  ],
  [
    "tinturado",
    "Manjar",
    "manjar.webp",
    0
  ],
  [
    "tinturado",
    "Marshmallow",
    "marshmallow.webp",
    0
  ],
  [
    "tinturado",
    "Mauvy",
    "mauvy.webp",
    0
  ],
  [
    "tinturado",
    "Mex fusion",
    "m0002.webp",
    0
  ],
  [
    "tinturado",
    "Mex time",
    "1-673f656ebb1c2.webp",
    0
  ],
  [
    "tinturado",
    "Midas",
    "m0033.webp",
    0
  ],
  [
    "tinturado",
    "Milky way",
    "starry nebula2.webp",
    0
  ],
  [
    "tinturado",
    "Minty christmas",
    "m0007.webp",
    0
  ],
  [
    "tinturado",
    "Moon",
    "m0096.webp",
    0
  ],
  [
    "tinturado",
    "Mystic purple",
    "mystic purple.webp",
    0
  ],
  [
    "tinturado",
    "Nejire",
    "nejire.webp",
    0
  ],
  [
    "tinturado",
    "Nemo",
    "m0118.webp",
    0
  ],
  [
    "tinturado",
    "Neon lime",
    "neon lime.webp",
    0
  ],
  [
    "tinturado",
    "Neon yellow",
    "neon yellow.webp",
    0
  ],
  [
    "tinturado",
    "Octopus glittered",
    "blue pink edge glittered.webp",
    0
  ],
  [
    "tinturado",
    "Oracle",
    "m0077.webp",
    0
  ],
  [
    "tinturado",
    "Orange marbled",
    "m0059.webp",
    0
  ],
  [
    "tinturado",
    "Papaya",
    "m0135-667da89c8b8e1.webp",
    0
  ],
  [
    "tinturado",
    "Pastel rainbow",
    "pastel.webp",
    0
  ],
  [
    "tinturado",
    "Patriotic",
    "m0112.webp",
    0
  ],
  [
    "tinturado",
    "Patriotic dove",
    "m0132.webp",
    0
  ],
  [
    "tinturado",
    "Peach booming",
    "m0116.webp",
    0
  ],
  [
    "tinturado",
    "Peach velvet",
    "peach velvet.webp",
    0
  ],
  [
    "tinturado",
    "Pearl",
    "m0028.webp",
    0
  ],
  [
    "tinturado",
    "Pearl rose gold",
    "satin peach.webp",
    0
  ],
  [
    "tinturado",
    "Peppermint mocha",
    "m0036.webp",
    0
  ],
  [
    "tinturado",
    "Pink",
    "pink.webp",
    0
  ],
  [
    "tinturado",
    "Pink lemonade",
    "m0038.webp",
    0
  ],
  [
    "tinturado",
    "Pink marbled",
    "pink marbled.webp",
    0
  ],
  [
    "tinturado",
    "Powder blue",
    "powder blue.webp",
    0
  ],
  [
    "tinturado",
    "Psycho killer",
    "3-2-671c087d93b01.webp",
    0
  ],
  [
    "tinturado",
    "Purple cream",
    "purple cream.webp",
    0
  ],
  [
    "tinturado",
    "Purple manjar",
    "4-672bc96b92073.webp",
    0
  ],
  [
    "tinturado",
    "Purple marbled",
    "m0075.webp",
    0
  ],
  [
    "tinturado",
    "Purple rain",
    "purple rain.webp",
    0
  ],
  [
    "tinturado",
    "Purple white",
    "purple white.webp",
    0
  ],
  [
    "tinturado",
    "Quartz",
    "quartz.webp",
    0
  ],
  [
    "tinturado",
    "Rainbow",
    "rainbow.webp",
    0
  ],
  [
    "tinturado",
    "Red black",
    "red black.webp",
    0
  ],
  [
    "tinturado",
    "Red royal tea",
    "red royal tea.webp",
    0
  ],
  [
    "tinturado",
    "Red white",
    "red white.webp",
    0
  ],
  [
    "tinturado",
    "Reindeer",
    "m0047.webp",
    0
  ],
  [
    "tinturado",
    "Rhys",
    "m0043.webp",
    0
  ],
  [
    "tinturado",
    "Salmon velvet",
    "m0105.webp",
    0
  ],
  [
    "tinturado",
    "Sandy",
    "m0086.webp",
    0
  ],
  [
    "tinturado",
    "Santa",
    "m0010.webp",
    0
  ],
  [
    "tinturado",
    "Santa sprinkle",
    "m0008.webp",
    0
  ],
  [
    "tinturado",
    "Sapphire",
    "m0082.webp",
    0
  ],
  [
    "tinturado",
    "Sea foam silver",
    "sea foam silver.webp",
    0
  ],
  [
    "tinturado",
    "Seahorse",
    "m0134-667da87254fa1.webp",
    0
  ],
  [
    "tinturado",
    "Silver",
    "silver.webp",
    0
  ],
  [
    "tinturado",
    "Silver lavender",
    "silver lavender.webp",
    0
  ],
  [
    "tinturado",
    "Silver mist",
    "m0041.webp",
    0
  ],
  [
    "tinturado",
    "Sky blue cream",
    "sky blue cream marbled.webp",
    0
  ],
  [
    "tinturado",
    "Sky blue velvet",
    "m0107.webp",
    0
  ],
  [
    "tinturado",
    "Smooth violet",
    "smooth violet.webp",
    0
  ],
  [
    "tinturado",
    "Snowfall",
    "m0012.webp",
    0
  ],
  [
    "tinturado",
    "Snowy christmas",
    "m0003.webp",
    0
  ],
  [
    "tinturado",
    "Snowy red",
    "m0014.webp",
    0
  ],
  [
    "tinturado",
    "Snowy storm",
    "m0034.webp",
    0
  ],
  [
    "tinturado",
    "Soft blue",
    "soft-blue-6696796db1d02.webp",
    0
  ],
  [
    "tinturado",
    "Soft blueberry",
    "m0117.webp",
    0
  ],
  [
    "tinturado",
    "Sour candy",
    "m0054.webp",
    0
  ],
  [
    "tinturado",
    "Space odyssey",
    "space odyssesy 3.webp",
    0
  ],
  [
    "tinturado",
    "Sparkly christmas",
    "m0005.webp",
    0
  ],
  [
    "tinturado",
    "Sparkly night",
    "2-1-671c08cc534a5.webp",
    0
  ],
  [
    "tinturado",
    "Sparkly ocean",
    "m0078.webp",
    0
  ],
  [
    "tinturado",
    "Sprinkle",
    "sprinkle.webp",
    0
  ],
  [
    "tinturado",
    "Starfish",
    "6-2-671c0837ebd91.webp",
    0
  ],
  [
    "tinturado",
    "Starry galaxy",
    "starry galaxy.webp",
    0
  ],
  [
    "tinturado",
    "Starry halloween",
    "4-2-671c086519047.webp",
    0
  ],
  [
    "tinturado",
    "Starry nebula",
    "starry nebula.webp",
    0
  ],
  [
    "tinturado",
    "Stormy",
    "m0083.webp",
    0
  ],
  [
    "tinturado",
    "Sugar belle",
    "sugar belle.webp",
    0
  ],
  [
    "tinturado",
    "Sugar cane",
    "m0024.webp",
    0
  ],
  [
    "tinturado",
    "Sunny pink",
    "sunny pink.webp",
    0
  ],
  [
    "tinturado",
    "Sunset",
    "m0111.webp",
    0
  ],
  [
    "tinturado",
    "Sweet sugar",
    "m0121.webp",
    0
  ],
  [
    "tinturado",
    "Teal",
    "m0095.webp",
    0
  ],
  [
    "tinturado",
    "Tinker bell",
    "m0097.webp",
    0
  ],
  [
    "tinturado",
    "Tiramisu",
    "m0057.webp",
    0
  ],
  [
    "tinturado",
    "Tropical",
    "m0085.webp",
    0
  ],
  [
    "tinturado",
    "Turquoise",
    "turquoise.webp",
    0
  ],
  [
    "tinturado",
    "Turquoise marbled",
    "sky blue marbled.webp",
    0
  ],
  [
    "tinturado",
    "Twilight",
    "m0090.webp",
    0
  ],
  [
    "tinturado",
    "Unicorn",
    "unicorn.webp",
    0
  ],
  [
    "tinturado",
    "Ursula",
    "m0099.webp",
    0
  ],
  [
    "tinturado",
    "Usa mix",
    "m0113.webp",
    0
  ],
  [
    "tinturado",
    "Usa mix 2",
    "m0114.webp",
    0
  ],
  [
    "tinturado",
    "Usa mix 3",
    "m0115.webp",
    0
  ],
  [
    "tinturado",
    "Valentine",
    "m0013.webp",
    0
  ],
  [
    "tinturado",
    "Velaris",
    "m0079.webp",
    0
  ],
  [
    "tinturado",
    "Vibrant sunset",
    "m0127.webp",
    0
  ],
  [
    "tinturado",
    "Violet",
    "m0100.webp",
    0
  ],
  [
    "tinturado",
    "Waves",
    "m0101.webp",
    0
  ],
  [
    "tinturado",
    "Whale",
    "white light blue marbled.webp",
    0
  ],
  [
    "tinturado",
    "White marbled",
    "white marbled.webp",
    0
  ],
  [
    "tinturado",
    "White mint",
    "m0119.webp",
    0
  ],
  [
    "tinturado",
    "White pine",
    "white pine.webp",
    0
  ],
  [
    "tinturado",
    "White silver marbled",
    "m0051.webp",
    0
  ],
  [
    "tinturado",
    "White splash",
    "m0048.webp",
    0
  ],
  [
    "tinturado",
    "X-mas",
    "m0001.webp",
    0
  ],
  [
    "tinturado",
    "Yellomallow",
    "yellomallow.webp",
    0
  ],
  [
    "tinturado",
    "Yellow",
    "yellow.webp",
    0
  ],
  [
    "tinturado",
    "Yellow drop",
    "m0124.webp",
    0
  ],
  [
    "tinturado",
    "Yellow marbled",
    "yellow marbled.webp",
    0
  ],
  [
    "tinturado",
    "Zury",
    "zury.webp",
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
  for (const [colorClave, rawCant] of Object.entries(conteoColores || {})) {
    const cantidad = Math.max(0, Math.round(Number(rawCant) || 0));
    if (cantidad <= 0) continue;
    const def = obtenerVariedadDefectoPorColor(catalogo, colorClave);
    items.push({
      id: `item-${colorClave}-${def?.id ?? "def"}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      colorClave,
      variedadId: def?.id,
      variedadNombre: def?.nombre ?? colorClave,
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
    const n = Math.max(0, Math.round(Number(item.cantidad) || 0));
    if (n <= 0) continue;
    const clave =
      item.tipoFlor === "orquidea" ? `orquidea_${item.colorClave}` : item.colorClave;
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
  totalVarasOrquidea: number;
  totalFloresOrquidea: number;
} {
  const mapaVariedad = new Map<string, ResumenVariedadConsolidado>();
  const resumenColores: Record<string, number> = {};
  let totalPaquetes = 0;
  let totalVarasOrquidea = 0;
  let totalFloresOrquidea = 0;

  for (const foto of fotos) {
    const items =
      Array.isArray(foto.itemsVariedad) && foto.itemsVariedad.length > 0
        ? foto.itemsVariedad
        : convertirConteoColoresAItemsVariedad(foto.conteoColores || {}, catalogo, "ia");

    for (const item of items) {
      const tipo: TipoFlorInventario = item.tipoFlor === "orquidea" ? "orquidea" : "rosa";
      const cant = Math.max(0, Math.round(Number(item.cantidad) || 0));
      const flores = Math.max(0, Math.round(Number(item.numeroFlores) || 0));
      if (cant <= 0 && flores <= 0) continue;

      const key = `${tipo}::${item.colorClave}::${normalizarNombreVariedadComparacion(item.variedadNombre)}`;
      const existente = mapaVariedad.get(key);
      if (existente) {
        existente.cantidad += cant;
        if (tipo === "orquidea") {
          existente.numeroFlores = (existente.numeroFlores ?? 0) + flores;
        }
      } else {
        const ref =
          tipo === "rosa"
            ? resolverVariedadDesdeCatalogo(catalogo, item.colorClave, item.variedadNombre)
            : null;
        mapaVariedad.set(key, {
          tipoFlor: tipo,
          colorClave: item.colorClave,
          variedadNombre: item.variedadNombre || ref?.nombre || item.colorClave,
          imagenUrl: item.imagenUrl || ref?.imagenUrl,
          cantidad: cant,
          numeroFlores: tipo === "orquidea" ? flores : undefined,
        });
      }

      if (tipo === "orquidea") {
        const claveOrq = `orquidea_${item.colorClave}`;
        resumenColores[claveOrq] = (resumenColores[claveOrq] ?? 0) + Math.max(1, cant);
        totalVarasOrquidea += cant;
        totalFloresOrquidea += flores;
      } else {
        resumenColores[item.colorClave] = (resumenColores[item.colorClave] ?? 0) + cant;
        totalPaquetes += cant;
      }
    }
  }

  return {
    resumenVariedades: Array.from(mapaVariedad.values()).sort((a, b) => {
      if (a.tipoFlor !== b.tipoFlor) return a.tipoFlor === "rosa" ? -1 : 1;
      return b.cantidad - a.cantidad;
    }),
    resumenColores,
    totalPaquetes,
    totalVarasOrquidea,
    totalFloresOrquidea,
  };
}
