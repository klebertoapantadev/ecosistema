// ============================================================================
// Prompts oficiales de Tinkay Flores y Eventos para el Generador IA
// (Estudio + Taller en 3:4) portados desde tinkay-batch.mjs y SKILL.md.
// Módulo puro de servidor — sin dependencias de cliente ni de red.
// ============================================================================

export type ModoEstudioIa = "estudio" | "taller";
export type TipoSoporteIa = "mesa" | "piso" | "pedestal";
export type GeometriaIa = "auto" | "con_frente" | "recto";

export interface OpcionesEstudioIa {
  tipoSoporte: TipoSoporteIa;
  coreano: boolean;
  geometria: GeometriaIa;
  incluirTarjeta: boolean;
}

export type ClaveReferenciaIa =
  | "fondoTaller"
  | "fondoTallerAlto"
  | "fondoTallerPedestal"
  | "tarjeta"
  | "logo";

export interface DefinicionReferenciaIa {
  clave: ClaveReferenciaIa;
  archivo: string;
  etiquetaPrompt: string;
}

export const REFERENCIAS_IA_OFICIALES: Record<ClaveReferenciaIa, DefinicionReferenciaIa> = {
  fondoTaller: {
    clave: "fondoTaller",
    archivo: "fondo-taller.jpg",
    etiquetaPrompt: "FONDO TALLER",
  },
  fondoTallerAlto: {
    clave: "fondoTallerAlto",
    archivo: "fondo-taller-alto.jpg",
    etiquetaPrompt: "FONDO TALLER ALTO",
  },
  fondoTallerPedestal: {
    clave: "fondoTallerPedestal",
    archivo: "fondo-taller-pedestal.jpg",
    etiquetaPrompt: "FONDO TALLER PEDESTAL",
  },
  tarjeta: {
    clave: "tarjeta",
    archivo: "tarjeta-dedicatoria.jpg",
    etiquetaPrompt: "TARJETA",
  },
  logo: {
    clave: "logo",
    archivo: "logo-tinkay.jpg",
    etiquetaPrompt: "LOGO",
  },
};

export function obtenerReferenciasParaModo(
  modo: ModoEstudioIa,
  opciones: OpcionesEstudioIa
): DefinicionReferenciaIa[] {
  const lista: DefinicionReferenciaIa[] = [];

  if (modo === "taller") {
    if (opciones.tipoSoporte === "piso") {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTallerAlto);
    } else if (opciones.tipoSoporte === "pedestal") {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTallerPedestal);
    } else {
      lista.push(REFERENCIAS_IA_OFICIALES.fondoTaller);
    }
  }

  if (opciones.incluirTarjeta) {
    lista.push(REFERENCIAS_IA_OFICIALES.tarjeta);
  }

  // No adjuntamos logo-tinkay.jpg como imagen extra porque tarjeta-dedicatoria.jpg ya
  // contiene el logo sólido oficial a escala real y fondo-taller*.jpg ya contiene el neón
  // real. Enviar 4 imágenes diluye la atención sobre FOTO DEL PRODUCTO en Modo Taller y
  // sesga al modelo a agrandar el logo en la tarjeta.
  return lista;
}

export function construirReglasComunes(opciones: OpcionesEstudioIa): string {
  let textoGeometria: string;
  if (opciones.geometria === "con_frente") {
    textoGeometria =
      "MODIFICADOR con frente: fuerza vista frontal escalonada, flores en abanico mirando a la cámara.";
  } else if (opciones.geometria === "recto") {
    textoGeometria =
      "MODIFICADOR sin frente / recto: copa simétrica radial 360°, domo nivelado hacia arriba, SIN inclinación hacia la cámara.";
  } else {
    textoGeometria =
      "Respeta la geometría de la copa de la FOTO DEL PRODUCTO: si es recta/radial 360° (copa esférica nivelada hacia arriba) PROHIBIDO inclinarla hacia la cámara; si es con frente 180°, flores en abanico escalonado mirando al frente.";
  }

  const textoBase = opciones.coreano
    ? "BOUQUET ESTILO COREANO: base cónica plástica interna oculta por el papel; el ramo permanece estrictamente PARADO, erguido y vertical por sí mismo sobre su base plana (sin florero)."
    : "Respeta el tipo de base de la foto del producto (box, esfera/cilindro de cristal con piedras o hidrogel, bouquet tradicional con tallos visibles, trípode de pedestal o el formato exacto que tenga).";

  const lineas: string[] = [
    'Actúa como fotógrafo publicitario y director de arte para "Tinkay Flores y Eventos". Genera UNA fotografía publicitaria fotorrealista de alta gama.',
    "",
    "REGLA SUPREMA – AISLAMIENTO Y FIDELIDAD PIXEL-A-PIXEL DEL PRODUCTO: La imagen etiquetada como FOTO DEL PRODUCTO es la ÚNICA fuente del arreglo floral. Conserva ÍNTEGRO y SIN REINTERPRETAR el arreglo exacto de FOTO DEL PRODUCTO: exactamente la misma cantidad y densidad de flores/rosas (si tiene 50–100+ rosas, conserva las 50–100+ rosas completas; PROHIBIDO reducirlo o simplificarlo a un ramo pequeño de 12–18 flores), exactamente las mismas especies y colores (PROHIBIDO inventar margaritas u otras flores que no estén en FOTO DEL PRODUCTO), exactamente las mismas hojas y follajes (forma, rayas, caída y ancho), la misma silueta/volumen y exactamente el mismo contenedor, canasta, caja, piedras/hidrogel, chocolates, envoltura y accesorios. Las demás imágenes de referencia son SOLO para el fondo o la tarjeta.",
    "",
    "LIMPIEZA: Elimina por completo cualquier marca de agua, texto sobrepuesto, fondo desordenado de tienda o mesa ajena de la foto original.",
    "",
    "ESCALA REALISTA: Cada rosa ~5 cm. Conserva proporciones, densidad y ancho reales del arreglo (en arreglos grandes de 50–100+ rosas, copa amplia de 50–75 cm de ancho).",
    "",
    `BASE: ${textoBase}`,
    `GEOMETRÍA: ${textoGeometria}`,
  ];

  if (opciones.incluirTarjeta) {
    lineas.push(
      "",
      "TARJETA PEQUEÑA Y DISCRETA: Si el arreglo ya trae una tarjeta, estandarízala o consérvala sin duplicar. Si no tiene, inserta UNA SOLA tarjeta oficial Tinkay idéntica a REFERENCIA TARJETA (cartulina marfil texturizada en su clip de estrella dorado, derecha y vertical entre las flores superiores — nunca torcida ni gigante). ESCALA PEQUEÑA OBLIGATORIA: la tarjeta completa debe medir apenas ~1.5 rosas de ancho (pequeña y proporcionada al tamaño del arreglo), y el logo 'Tinkay / FLORES Y EVENTOS' impreso en el centro debe verse PEQUEÑO, FINO Y SUTIL — ocupando solo ~30% a 35% del ancho de la tarjeta (un 25% más pequeño que lo habitual, en tono gris topo/grafito suave, con amplios márgenes limpios de cartulina marfil alrededor)."
    );
  }

  lineas.push(
    "",
    "SALIDA: Una sola fotografía publicitaria fotorrealista vertical 3:4 a pantalla completa, sin textos sobrepuestos, marcas de agua ni collage."
  );

  return lineas.join("\n");
}

export function construirPromptModo(modo: ModoEstudioIa, opciones: OpcionesEstudioIa): string {
  if (modo === "estudio") {
    if (opciones.tipoSoporte === "piso") {
      return "MODO ESTUDIO DE PRODUCTO (DE PISO / TRÍPODE): CERO PERSONAS, SIN PEANA DE MESA. Toma vertical de cuerpo entero desde el piso hasta la cúspide floral. El trípode real del arreglo (carrizo cilíndrico para XL o madera sólida rectangular para XXL) apoya directamente sobre el piso pulcro de estudio con sombra de contacto natural. Fondo infinito gris claro neutro, iluminación suave envolvente de catálogo.";
    }

    if (opciones.tipoSoporte === "pedestal") {
      return "MODO ESTUDIO DE PRODUCTO (PEDESTAL): CERO PERSONAS. Aísla el arreglo floral sobre fondo infinito neutro de estudio comercial limpio, apoyado en su soporte real de Tinkay (PROHIBIDO inventar columnas griegas o ficticias). Iluminación envolvente de catálogo.";
    }

    const extraCoreano = opciones.coreano
      ? " En bouquet estilo coreano, el ramo asienta vertical y erguido en el centro de la peana y las flores rebasan sus bordes."
      : "";
    return `MODO ESTUDIO DE PRODUCTO (MESA): CERO PERSONAS. El arreglo descansa centrado sobre una peana circular de madera pulida con bisel metálico dorado de 30 cm de diámetro (si incluye caja de chocolates u otro extra junto al arreglo, ambos descansan armónicamente sobre la peana). En ramos grandes (50-100 rosas) la peana es visiblemente más angosta que la copa.${extraCoreano} 3 a 4 pétalos caídos delicadamente sobre la madera de la peana. Fondo infinito de estudio gris claro neutro y minimalista, iluminación suave envolvente de softbox con sombras delicadas y reflejos limpios.`;
  }

  // Modo 2: taller
  if (opciones.tipoSoporte === "piso") {
    return "MODO TALLER OFICIAL TINKAY (DE PISO): Usa estrictamente el entorno de FONDO TALLER ALTO (pared de madera clara, letrero neón cálido 'Tinkay', estanterías laterales y piso de cemento gris pulido MATE). CERO MESAS, CERO PERSONAS, CERO REFLEJOS INVERTIDOS del texto 'Tinkay' en el suelo. El trípode apoya directamente en el suelo. PRIORIDAD FLORAL ABSOLUTA: la cresta floral superior nunca debe recortarse ni aplanarse para mostrar el letrero; si el arreglo es alto, las flores quedan naturalmente por delante cubriendo parcialmente las letras del neón.";
  }

  if (opciones.tipoSoporte === "pedestal") {
    return "MODO TALLER OFICIAL TINKAY (PEDESTAL): Monta el arreglo directamente sobre el pedestal oficial de Tinkay visible en FONDO TALLER PEDESTAL frente a la pared de madera clara y el letrero neón cálido 'Tinkay'. PROHIBIDO inventar columnas ficticias. CERO PERSONAS, sin reflejos invertidos del texto en el suelo.";
  }

  const extraCoreanoTaller = opciones.coreano
    ? " En bouquet estilo coreano, se asienta erguido y de pie directamente sobre la mesa."
    : "";
  return `MODO TALLER OFICIAL TINKAY (MESA): Fotomontaje fotorrealista colocando el arreglo COMPLETO, INTACTO E IDÉNTICO de FOTO DEL PRODUCTO (misma cantidad exacta de rosas, mismas flores, mismos follajes/hojas, misma silueta ancha y misma base — PROHIBIDO redibujar o achicar el arreglo) centrado sobre la mesa rústica de madera de REFERENCIA FONDO TALLER (SIN peana dorada).${extraCoreanoTaller} Mantén el encuadre suficientemente abierto para que quepa todo el ancho real del arreglo sin recortarlo ni simplificarlo. La pared de madera natural clara y el letrero neón cálido encendido 'Tinkay' (con lazo sobre la 'T' y detalle floral sobre 'a/y' en acrílico transparente) deben ser IDÉNTICOS a REFERENCIA FONDO TALLER en escala, tipografía, proporción y posición, quedando detrás y arriba del arreglo. PROHIBIDO redibujar, deformar o agrandar el letrero. CERO PERSONAS.`;
}

export function construirPromptCompletoEstudioIa(
  modo: ModoEstudioIa,
  opciones: OpcionesEstudioIa
): string {
  return `${construirReglasComunes(opciones)}\n\n${construirPromptModo(modo, opciones)}`;
}
