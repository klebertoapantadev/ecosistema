import { CategoriaEcommerce, ProductoEcommerce, VarianteEcommerce } from './tipos';

const CONECTORES_BUSQUEDA = new Set([
  'de',
  'del',
  'la',
  'las',
  'el',
  'los',
  'un',
  'una',
  'unos',
  'unas',
  'y',
  'e',
  'o',
  'u',
  'a',
  'en',
  'con',
  'por',
  'para',
  'al',
]);

const MAPA_SINONIMOS_USOS: Record<string, string> = {
  condolencias:
    'condolencias condolencia duelo pesame funebre funeral funerario funerarios velacion velaciones homenaje solemne solemnes luto respeto paz iglesia corona pedestal abanico',
  duelo:
    'duelo condolencias condolencia pesame funebre funeral funerario velacion homenaje solemne luto respeto',
  pesame: 'pesame condolencias condolencia duelo funebre funeral velacion nota de pesar',
  cumpleanos: 'cumpleanos cumple cumpleaños festejo festejos fiesta celebracion feliz dia',
  aniversario: 'aniversario aniversarios bodas matrimonio pareja',
  amor_romance:
    'amor romance romantico enamorados san valentin 14 de febrero novia esposa pareja te amo',
  pedida_mano: 'pedida de mano compromiso matrimonio anillo novia',
  recuperate: 'recuperate pronto salud hospital clinica mejoria animo',
  agradecimiento: 'agradecimiento gracias gratitud detalle',
  graduacion: 'graduacion grado graduado titulo universidad colegio ceremonia',
  corporativo:
    'corporativo corporativos eventos evento ceremonias ceremonia empresa empresas empresarial oficina inauguracion protocolo',
  nacimiento_bebe: 'nacimiento bebe baby shower maternidad recien nacido',
  dia_madre_mujer: 'dia de la madre dia de la mujer mama mujer',
  sorpresa_diaria: 'sorpresa diaria detalle regalo espontaneo',
};

/**
 * Normaliza cualquier texto para comparaciones y búsquedas tolerantes a tildes,
 * mayúsculas, emojis, guiones, barras y signos de puntuación.
 */
export function normalizarTextoEcommerce(valor: unknown): string {
  return String(valor ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[_/\\|•·—–-]+/g, ' ')
    .replace(/[^a-z0-9$]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Expande una clave de uso (ej. "🕊️_condolencias", "amor_romance", "cumpleanos")
 * a todos sus términos naturales y sinónimos en español para enriquecer el buscador.
 */
export function expandirTerminosUso(usoRaw: string): string {
  const limpio = normalizarTextoEcommerce(usoRaw);
  if (!limpio) return '';

  const partes = [limpio];
  const claveGuionBajo = limpio.replace(/\s+/g, '_');

  if (MAPA_SINONIMOS_USOS[claveGuionBajo]) {
    partes.push(MAPA_SINONIMOS_USOS[claveGuionBajo]!);
  }
  if (MAPA_SINONIMOS_USOS[limpio]) {
    partes.push(MAPA_SINONIMOS_USOS[limpio]!);
  }

  for (const [clave, sinonimos] of Object.entries(MAPA_SINONIMOS_USOS)) {
    const claveNorm = clave.replace(/_/g, ' ');
    if (limpio.includes(claveNorm) || claveNorm.includes(limpio)) {
      partes.push(sinonimos);
    }
  }

  return partes.join(' ');
}

export function esProductoExtraOComplemento(p: ProductoEcommerce): boolean {
  if (p.esExtra || p.esComplemento) return true;
  const catPrincipal = normalizarTextoEcommerce(p.categoriaPrincipal);
  const catNombre = normalizarTextoEcommerce(p.categoriaNombre);
  return catPrincipal.includes('extra') || catNombre.includes('extra');
}

export function obtenerVarianteActivaProducto(
  p: ProductoEcommerce
): VarianteEcommerce | undefined {
  return (
    (p.varianteInicialSku
      ? p.variantes.find((v) => v.sku === p.varianteInicialSku)
      : null) ?? p.variantes[0]
  );
}

export function obtenerPvpProducto(p: ProductoEcommerce): number {
  return obtenerVarianteActivaProducto(p)?.pvp ?? 0;
}

export function productoTieneOferta(p: ProductoEcommerce): boolean {
  const varCorresp = obtenerVarianteActivaProducto(p);
  return Boolean(
    varCorresp &&
      varCorresp.precioComparacion &&
      varCorresp.precioComparacion > varCorresp.pvp
  );
}

export function obtenerNombreProductoIndividual(
  nombreProducto: string,
  nombreVariante: string
): string {
  const eraTarifaEstandar = /\(\s*tarifa\s+est[aá]ndar\s*\)/i.test(nombreVariante || '');
  const vLimpio = (nombreVariante || '')
    .replace(/\(\s*tarifa\s+est[aá]ndar\s*\)/gi, '')
    .replace(/\s+/g, ' ')
    .trim();
  const pNorm = (nombreProducto || '').replace(/\s+/g, ' ').trim();

  if (!vLimpio) return pNorm;
  if (!pNorm) return vLimpio;
  if (eraTarifaEstandar && pNorm) return pNorm;

  const vLower = normalizarTextoEcommerce(vLimpio);
  const pLower = normalizarTextoEcommerce(pNorm);
  const sinDobles = (s: string) => s.replace(/(.)\1+/g, '$1');

  if (
    vLower === 'presentacion unica' ||
    vLower === 'estandar' ||
    vLower === 'tarifa estandar' ||
    vLower === pLower ||
    sinDobles(vLower) === sinDobles(pLower)
  ) {
    return pNorm;
  }

  if (
    vLower.includes(pLower) ||
    vLower.startsWith('box') ||
    vLower.startsWith('mix floral') ||
    vLower.startsWith('pedestal') ||
    vLower.startsWith('abanico') ||
    vLower.startsWith('corona')
  ) {
    return vLimpio;
  }

  return `${pNorm} — ${vLimpio}`;
}

/**
 * Despliega las variaciones de los productos del catálogo como tarjetas individuales
 * preservando íntegramente los metadatos maestros y propios de cada variante.
 */
export function expandirProductosVitrina(
  catalogoProductos: ProductoEcommerce[]
): ProductoEcommerce[] {
  return catalogoProductos.flatMap((p) => {
    if (esProductoExtraOComplemento(p)) return [];

    if (p.variantes && p.variantes.length > 1) {
      return p.variantes.map((v) => {
        const fotosTarjetaIndividual =
          v.fotos && v.fotos.length > 0
            ? v.fotos
            : v.foto
            ? [v.foto]
            : p.fotos;
        const nombreIndividual = obtenerNombreProductoIndividual(p.nombre, v.nombre);

        const usosVariante =
          v.usosModo === 'personalizado' && Array.isArray(v.usos)
            ? v.usos
            : p.usos;

        const beneficiosCombinados = Array.from(
          new Set([...(v.beneficiosCustom || []), ...(p.beneficios || [])])
        );

        const productoIndividual: ProductoEcommerce = {
          ...p,
          id: `${p.id}__${v.sku}`,
          slug: `${p.slug}-${v.sku.toLowerCase()}`,
          nombre: nombreIndividual,
          nombreBase: p.nombre,
          descripcionMasterCorta: p.descripcionMasterCorta || p.descripcionCorta,
          descripcionCorta: v.detalle || p.descripcionCorta,
          beneficios: beneficiosCombinados,
          usos: usosVariante,
          fotos: fotosTarjetaIndividual,
          fotosModal: fotosTarjetaIndividual,
          variantes: p.variantes,
          varianteInicialSku: v.sku,
          destacado: p.destacado,
        };
        return productoIndividual;
      });
    }

    if (p.variantes && p.variantes.length === 1) {
      const unica = p.variantes[0]!;
      const nombreUnico = obtenerNombreProductoIndividual(p.nombre, unica.nombre);
      const usosUnico =
        unica.usosModo === 'personalizado' && Array.isArray(unica.usos)
          ? unica.usos
          : p.usos;
      const beneficiosCombinados = Array.from(
        new Set([...(unica.beneficiosCustom || []), ...(p.beneficios || [])])
      );

      return [
        {
          ...p,
          nombre: nombreUnico,
          nombreBase: p.nombre,
          descripcionMasterCorta: p.descripcionMasterCorta || p.descripcionCorta,
          beneficios: beneficiosCombinados,
          usos: usosUnico,
          varianteInicialSku: unica.sku,
        },
      ];
    }

    return [p];
  });
}

/**
 * Evalúa si un producto pertenece a la categoría seleccionada.
 * - Para categorías de formato o colección (ej. Box Florales, Estilo Coreano, Para Florero, Eventos),
 *   aplica coincidencia exacta de categoría principal o secundaria para evitar mezclas indebidas.
 * - Para categorías de ocasión (ej. Condolencias & Funerarios, Cumpleaños, Aniversario, Amor),
 *   además evalúa los usos recomendados configurados en el producto/variante.
 */
export function productoCoincideConCategoria(
  p: ProductoEcommerce,
  catId: string,
  categorias: CategoriaEcommerce[] = []
): boolean {
  if (esProductoExtraOComplemento(p)) return false;
  if (!catId || catId === 'cat-todos' || catId === 'todos') return true;

  const catObj = categorias.find((c) => c.id === catId || c.slug === catId);
  const idsEquivalentes = new Set<string>(
    [catId, catObj?.id, catObj?.slug]
      .filter((x): x is string => Boolean(x))
      .map((x) => normalizarTextoEcommerce(x))
  );

  const principalNorm = normalizarTextoEcommerce(p.categoriaPrincipal);
  const nombreCatProdNorm = normalizarTextoEcommerce(p.categoriaNombre);
  const nombreCatObjetivoNorm = catObj ? normalizarTextoEcommerce(catObj.nombre) : '';

  if (principalNorm && idsEquivalentes.has(principalNorm)) return true;
  if (
    nombreCatProdNorm &&
    nombreCatObjetivoNorm &&
    nombreCatProdNorm === nombreCatObjetivoNorm
  ) {
    return true;
  }

  const secundariasNorm = (p.categoriasSecundarias || []).map((s) =>
    normalizarTextoEcommerce(s)
  );
  if (secundariasNorm.some((s) => idsEquivalentes.has(s))) return true;

  // Si la categoría es de tipo OCASION (o un identificador de ocasión como condolencias/amor/aniv/cumple),
  // cruzar también con los usos configurados en el producto.
  const textoCatRef = `${normalizarTextoEcommerce(catId)} ${nombreCatObjetivoNorm}`.trim();
  const esCategoriaOcasion =
    catObj?.tipo === 'OCASION' ||
    Boolean(catObj?.modoVisualSobrio) ||
    textoCatRef.includes('condol') ||
    textoCatRef.includes('ocas ');

  if (!esCategoriaOcasion) {
    return false;
  }

  const usosNorm = (p.usos || []).map((u) => expandirTerminosUso(u)).join(' ');

  if (textoCatRef.includes('condol') || textoCatRef.includes('funer')) {
    return (
      Boolean(p.esCondolencias) ||
      usosNorm.includes('condolenc') ||
      usosNorm.includes('duelo') ||
      usosNorm.includes('pesame')
    );
  }
  if (textoCatRef.includes('aniv')) {
    return usosNorm.includes('aniversario');
  }
  if (textoCatRef.includes('amor') || textoCatRef.includes('pedida')) {
    return usosNorm.includes('amor') || usosNorm.includes('pedida');
  }
  if (textoCatRef.includes('cumple') || textoCatRef.includes('festejo')) {
    return usosNorm.includes('cumple');
  }

  return (p.usos || []).some((u) => {
    const uNorm = normalizarTextoEcommerce(u);
    return (
      Boolean(uNorm) &&
      (textoCatRef.includes(uNorm) || uNorm.includes(textoCatRef))
    );
  });
}

export function obtenerCategoriasVisibles(
  catalogoCategorias: CategoriaEcommerce[],
  productosBaseDesplegados: ProductoEcommerce[]
): CategoriaEcommerce[] {
  const candidatas = catalogoCategorias.filter((cat) => {
    const nombreLower = normalizarTextoEcommerce(cat.nombre);
    const slugLower = normalizarTextoEcommerce(cat.slug);
    return (
      !nombreLower.includes('extra') &&
      !slugLower.includes('extra') &&
      cat.tipo !== 'COMPLEMENTO'
    );
  });

  return candidatas.filter((cat) => {
    if (cat.id === 'cat-todos' || cat.slug === 'todos') return true;
    return productosBaseDesplegados.some((p) =>
      productoCoincideConCategoria(p, cat.id, candidatas)
    );
  });
}

/**
 * Resuelve el ID real de una categoría visible a partir de un slug, ID o alias de navegación
 * (por ejemplo desde el encabezado o el pie de página).
 */
export function resolverCategoriaPorIdentificador(
  identificador: string,
  categorias: CategoriaEcommerce[]
): string {
  if (!identificador || identificador === 'cat-todos' || identificador === 'todos') {
    return 'cat-todos';
  }

  const exacta = categorias.find(
    (c) => c.id === identificador || c.slug === identificador
  );
  if (exacta) return exacta.id;

  const norm = normalizarTextoEcommerce(identificador);
  const porNorm = categorias.find((c) => {
    const idNorm = normalizarTextoEcommerce(c.id);
    const slugNorm = normalizarTextoEcommerce(c.slug);
    const nomNorm = normalizarTextoEcommerce(c.nombre);
    return (
      idNorm === norm ||
      slugNorm === norm ||
      nomNorm === norm ||
      nomNorm.includes(norm) ||
      norm.includes(nomNorm) ||
      (norm.includes('condol') && (Boolean(c.modoVisualSobrio) || nomNorm.includes('condol'))) ||
      (norm.includes('corean') && (slugNorm.includes('corean') || nomNorm.includes('corean'))) ||
      (norm.includes('florero') && (slugNorm.includes('florero') || nomNorm.includes('florero'))) ||
      (norm.includes('box') && (slugNorm.includes('box') || nomNorm.includes('box'))) ||
      (norm.includes('evento') && (slugNorm.includes('evento') || nomNorm.includes('evento')))
    );
  });

  return porNorm ? porNorm.id : 'cat-todos';
}

/**
 * Construye el texto completo indexable de un producto reuniendo TODA su información disponible:
 * nombres, variantes, SKUs, categoría, palabras clave de categoría, usos y sinónimos, ocasiones,
 * descripciones cortas y largas, beneficios, receta floral, tallos, etiquetas, requisitos y precio.
 */
export function construirCorpusBusquedaProducto(
  p: ProductoEcommerce,
  categorias: CategoriaEcommerce[] = []
): string {
  const varActiva = obtenerVarianteActivaProducto(p);
  const variantesIndexadas = p.varianteInicialSku && varActiva ? [varActiva] : p.variantes || [];

  const catPrincipalObj = categorias.find(
    (c) => c.id === p.categoriaPrincipal || c.slug === p.categoriaPrincipal
  );
  const catsSecundariasObjs = (p.categoriasSecundarias || [])
    .map((secId) => categorias.find((c) => c.id === secId || c.slug === secId))
    .filter((c): c is CategoriaEcommerce => Boolean(c));

  const textosVariantes = variantesIndexadas.flatMap((v) => [
    v.nombre,
    v.sku,
    v.detalle,
    ...(v.beneficiosCustom || []),
    v.recetaBom,
    v.unidadesFlores ? `${v.unidadesFlores} rosas ${v.unidadesFlores} tallos ${v.unidadesFlores} flores` : '',
    ...(v.usos || []).map((u) => expandirTerminosUso(u)),
    Number.isFinite(v.pvp) ? `$${v.pvp.toFixed(0)} $${v.pvp.toFixed(2)} ${v.pvp}` : '',
  ]);

  const textosUsos = (p.usos || []).map((u) => expandirTerminosUso(u));

  const partes = [
    p.nombre,
    p.nombreBase,
    p.slug,
    p.categoriaNombre,
    p.categoriaPrincipal,
    catPrincipalObj?.nombre,
    catPrincipalObj?.descripcion,
    ...(catPrincipalObj?.palabrasClave || []),
    ...(p.palabrasClaveCategoria || []),
    ...catsSecundariasObjs.flatMap((c) => [c.nombre, c.descripcion, ...(c.palabrasClave || [])]),
    ...textosUsos,
    p.ocasionRecomendada,
    p.esCondolencias
      ? 'condolencias solemnes funebre funeral funerarios duelo pesame velaciones homenaje respeto'
      : '',
    p.descripcionCorta,
    p.descripcionMasterCorta,
    p.descripcionLarga,
    ...(p.beneficios || []),
    ...(p.etiquetas || []),
    p.etiquetaTemporada,
    ...(p.requisitos || []),
    p.coberturaTexto,
    ...textosVariantes,
  ];

  return normalizarTextoEcommerce(partes.filter(Boolean).join(' '));
}

/**
 * Evalúa si un producto coincide con la consulta de búsqueda del cliente.
 * Soporta búsquedas parciales ("condole"), múltiples palabras en cualquier orden
 * ("corona rosas", "box orquidea"), sinónimos de usos ("pesame", "cumpleaños") y sin tildes.
 */
export function productoCoincideConBusqueda(
  p: ProductoEcommerce,
  terminoBusqueda: string,
  categorias: CategoriaEcommerce[] = []
): boolean {
  const queryNorm = normalizarTextoEcommerce(terminoBusqueda);
  if (!queryNorm) return true;

  const corpus = construirCorpusBusquedaProducto(p, categorias);
  if (corpus.includes(queryNorm)) return true;

  const palabrasRaw = queryNorm.split(' ').filter(Boolean);
  const palabrasSignificativas = palabrasRaw.filter(
    (pal) => pal.length > 1 && !CONECTORES_BUSQUEDA.has(pal)
  );
  const tokens =
    palabrasSignificativas.length > 0 ? palabrasSignificativas : palabrasRaw;

  return tokens.every((token) => corpus.includes(token));
}
