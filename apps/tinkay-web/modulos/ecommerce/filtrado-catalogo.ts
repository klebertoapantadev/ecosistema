import type { CategoriaEcommerce, ProductoEcommerce, VarianteEcommerce } from './tipos';

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

export type IdClasificacionPrincipalTinkay =
  | 'grupo-arreglos-florales'
  | 'grupo-eventos'
  | 'grupo-condolencias';

export type IdFiltroEspecialTinkay =
  | 'grupo-ofertas'
  | 'grupo-entrega-inmediata'
  | 'grupo-favoritos';

export interface ClasificacionPrincipalTinkay {
  id: IdClasificacionPrincipalTinkay;
  slug: string;
  nombre: string;
  subtitulo: string;
  tituloVitrina: string;
  descripcionVitrina: string;
  modoVisualSobrio?: boolean;
}

export interface SubcategoriaVisualTinkay {
  id: string;
  slug: string;
  nombre: string;
  modoVisualSobrio?: boolean;
}

export interface EtiquetaBusquedaResumen {
  clave: string;
  etiqueta: string;
  cantidad: number;
}

/**
 * Primera clasificación de consulta de la tienda Tinkay:
 * 1. Arreglos Florales (para toda ocasión)
 * 2. Eventos
 * 3. Condolencias
 */
export const CLASIFICACIONES_PRINCIPALES_TINKAY: ClasificacionPrincipalTinkay[] = [
  {
    id: 'grupo-arreglos-florales',
    slug: 'arreglos-florales',
    nombre: 'Arreglos Florales',
    subtitulo: 'Para toda ocasión',
    tituloVitrina: 'Arreglos Florales — Para Toda Ocasión',
    descripcionVitrina:
      'Bouquets estilo coreano, box florales, ramos para florero, orquídeas y diseños de entrega inmediata preparados con rosas frescas de exportación.',
  },
  {
    id: 'grupo-eventos',
    slug: 'eventos',
    nombre: 'Eventos',
    subtitulo: 'Bodas, ceremonias y mobiliario',
    tituloVitrina: 'Eventos, Ceremonias & Mobiliario',
    descripcionVitrina:
      'Arcos florales, backings, bienvenidas de gala, decoración con globos y mobiliario en renta bajo proforma personalizada.',
  },
  {
    id: 'grupo-condolencias',
    slug: 'condolencias',
    nombre: 'Condolencias',
    subtitulo: 'Acompañamiento y respeto',
    tituloVitrina: 'Arreglos de Condolencias & Respeto',
    descripcionVitrina:
      'Composiciones solemnes en blanco y follajes andinos para acompañar en los momentos más difíciles con entrega puntual en velaciones e iglesias.',
    modoVisualSobrio: true,
  },
];

const IDS_CLASIFICACION_VIRTUAL = new Set<string>([
  'grupo-arreglos-florales',
  'grupo-eventos',
  'grupo-condolencias',
  'grupo-ofertas',
  'grupo-entrega-inmediata',
  'grupo-favoritos',
  'sub-eventos-decoracion',
  'sub-eventos-mobiliario',
  'col-arreglos-florales',
]);

export function esProductoEntregaInmediata(p: ProductoEcommerce): boolean {
  if (esProductoExtraOComplemento(p)) return false;
  const catPrin = normalizarTextoEcommerce(p.categoriaPrincipal);
  const catNom = normalizarTextoEcommerce(p.categoriaNombre);
  if (catPrin.includes('entrega inmediata') || catNom.includes('entrega inmediata')) {
    return true;
  }
  return (p.categoriasSecundarias || []).some((s) =>
    normalizarTextoEcommerce(s).includes('entrega inmediata')
  );
}

export function esIdentificadorClasificacionVirtual(catId: string): boolean {
  return IDS_CLASIFICACION_VIRTUAL.has(catId);
}

export function obtenerClasificacionPrincipalPorId(
  id: string
): ClasificacionPrincipalTinkay | undefined {
  return CLASIFICACIONES_PRINCIPALES_TINKAY.find((c) => c.id === id || c.slug === id);
}

export function obtenerSlugCategoriaPublico(
  catId: string,
  categorias: CategoriaEcommerce[] = []
): string {
  if (!catId || catId === 'cat-todos' || catId === 'todos') return 'todos';
  if (catId === 'grupo-arreglos-florales') return 'arreglos-florales';
  if (catId === 'grupo-eventos') return 'eventos';
  if (catId === 'grupo-condolencias') return 'condolencias';
  if (catId === 'grupo-ofertas') return 'ofertas';
  if (catId === 'grupo-entrega-inmediata') return 'entrega-inmediata';
  if (catId === 'grupo-favoritos') return 'me-gusta';
  if (catId === 'sub-eventos-decoracion') return 'eventos-decoracion';
  if (catId === 'sub-eventos-mobiliario') return 'eventos-mobiliario';
  if (catId === 'col-arreglos-florales') return 'col-arreglos-florales';
  const catObj = categorias.find((c) => c.id === catId || c.slug === catId);
  return catObj?.slug || catId;
}

/**
 * Determina a cuál de las 3 clasificaciones principales pertenece un producto
 * cuando corresponde a Arreglos Florales para toda ocasión.
 */
export function esProductoArregloTodaOcasion(p: ProductoEcommerce): boolean {
  if (esProductoExtraOComplemento(p)) return false;
  if (esProductoMobiliario(p) || esProductoEvento(p) || esProductoCondolencias(p)) {
    return false;
  }
  return true;
}

/**
 * Mapea cualquier categoría (principal o sub-colección) a su clasificación principal.
 */
export function obtenerClasificacionPrincipalDeCategoria(
  catId: string,
  categorias: CategoriaEcommerce[] = []
): IdClasificacionPrincipalTinkay | IdFiltroEspecialTinkay | 'cat-todos' {
  if (!catId || catId === 'cat-todos' || catId === 'todos') return 'cat-todos';
  if (catId === 'grupo-ofertas') return 'grupo-ofertas';
  if (catId === 'grupo-entrega-inmediata') return 'grupo-entrega-inmediata';
  if (catId === 'grupo-favoritos') return 'grupo-favoritos';
  if (catId === 'grupo-arreglos-florales' || catId === 'col-arreglos-florales') {
    return 'grupo-arreglos-florales';
  }
  if (
    catId === 'grupo-eventos' ||
    catId === 'sub-eventos-decoracion' ||
    catId === 'sub-eventos-mobiliario'
  ) {
    return 'grupo-eventos';
  }
  if (catId === 'grupo-condolencias' || catId === 'cat-ocas-condol') {
    return 'grupo-condolencias';
  }

  const catObj = categorias.find((c) => c.id === catId || c.slug === catId);
  const textoRef = normalizarTextoEcommerce(
    `${catId} ${catObj?.slug || ''} ${catObj?.nombre || ''}`
  );

  if (
    catObj?.modoVisualSobrio ||
    textoRef.includes('condol') ||
    textoRef.includes('funer')
  ) {
    return 'grupo-condolencias';
  }
  if (
    catObj?.tipo === 'EVENTO' ||
    textoRef.includes('evento') ||
    textoRef.includes('ceremonia') ||
    textoRef.includes('mobiliario') ||
    textoRef.includes('renta')
  ) {
    return 'grupo-eventos';
  }

  return 'grupo-arreglos-florales';
}

/**
 * Devuelve las sub-colecciones visibles correspondientes a una clasificación principal.
 */
export function obtenerSubcategoriasDeClasificacion(
  clasificacion: IdClasificacionPrincipalTinkay | IdFiltroEspecialTinkay | 'cat-todos',
  categoriasVisibles: CategoriaEcommerce[],
  productosBaseDesplegados: ProductoEcommerce[]
): SubcategoriaVisualTinkay[] {
  if (
    clasificacion === 'grupo-ofertas' ||
    clasificacion === 'grupo-entrega-inmediata' ||
    clasificacion === 'grupo-favoritos'
  ) {
    return [];
  }

  if (clasificacion === 'grupo-eventos') {
    const tieneDecoracion = productosBaseDesplegados.some(
      (p) => !esProductoExtraOComplemento(p) && esProductoEvento(p)
    );
    const tieneMobiliario = productosBaseDesplegados.some(
      (p) => !esProductoExtraOComplemento(p) && esProductoMobiliario(p)
    );
    if (!tieneDecoracion || !tieneMobiliario) return [];
    return [
      {
        id: 'sub-eventos-decoracion',
        slug: 'eventos-decoracion',
        nombre: 'Decoración y Ceremonias',
      },
      {
        id: 'sub-eventos-mobiliario',
        slug: 'eventos-mobiliario',
        nombre: 'Mobiliario en Renta',
      },
    ];
  }

  if (clasificacion === 'grupo-condolencias') {
    return [];
  }

  // Para 'grupo-arreglos-florales' (o 'cat-todos'), exponer las colecciones florales de toda ocasión
  const subFlorales = categoriasVisibles.filter((cat) => {
    if (cat.id === 'cat-todos' || cat.slug === 'todos') return false;
    return (
      obtenerClasificacionPrincipalDeCategoria(cat.id, categoriasVisibles) ===
      'grupo-arreglos-florales'
    );
  });

  return subFlorales.map((cat) => {
    const esSlugArreglos = normalizarTextoEcommerce(cat.slug) === 'arreglos florales';
    return {
      id: esSlugArreglos ? 'col-arreglos-florales' : cat.id,
      slug: esSlugArreglos ? 'col-arreglos-florales' : cat.slug,
      nombre: cat.nombre,
      modoVisualSobrio: cat.modoVisualSobrio,
    };
  });
}

/**
 * Evalúa si un producto pertenece a la categoría o clasificación seleccionada.
 */
export function productoCoincideConCategoria(
  p: ProductoEcommerce,
  catId: string,
  categorias: CategoriaEcommerce[] = []
): boolean {
  if (esProductoExtraOComplemento(p)) return false;
  if (!catId || catId === 'cat-todos' || catId === 'todos') return true;

  if (catId === 'grupo-arreglos-florales') {
    return esProductoArregloTodaOcasion(p);
  }
  if (catId === 'grupo-ofertas') {
    return productoTieneOferta(p);
  }
  if (catId === 'grupo-entrega-inmediata') {
    return esProductoEntregaInmediata(p);
  }
  if (catId === 'grupo-favoritos') {
    return true;
  }
  if (catId === 'grupo-eventos') {
    return esProductoEvento(p) || esProductoMobiliario(p);
  }
  if (catId === 'sub-eventos-decoracion') {
    return esProductoEvento(p);
  }
  if (catId === 'sub-eventos-mobiliario') {
    return esProductoMobiliario(p);
  }
  if (catId === 'grupo-condolencias') {
    const usosNorm = (p.usos || []).map((u) => expandirTerminosUso(u)).join(' ');
    return (
      esProductoCondolencias(p) ||
      Boolean(p.esCondolencias) ||
      usosNorm.includes('condolenc') ||
      usosNorm.includes('duelo') ||
      usosNorm.includes('pesame')
    );
  }

  const catIdReal = catId === 'col-arreglos-florales' ? 'arreglos-florales' : catId;

  const catObj = categorias.find((c) => c.id === catIdReal || c.slug === catIdReal);
  const idsEquivalentes = new Set<string>(
    [catIdReal, catObj?.id, catObj?.slug]
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
  const textoCatRef = `${normalizarTextoEcommerce(catIdReal)} ${nombreCatObjetivoNorm}`.trim();
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

  const norm = normalizarTextoEcommerce(identificador);

  if (
    identificador === 'grupo-ofertas' ||
    norm === 'ofertas' ||
    norm === 'solo ofertas' ||
    norm === 'promociones'
  ) {
    return 'grupo-ofertas';
  }

  if (
    identificador === 'grupo-entrega-inmediata' ||
    norm === 'entrega inmediata'
  ) {
    return 'grupo-entrega-inmediata';
  }

  if (
    identificador === 'grupo-favoritos' ||
    norm === 'me gusta' ||
    norm === 'favoritos' ||
    norm === 'likes'
  ) {
    return 'grupo-favoritos';
  }

  if (
    identificador === 'grupo-arreglos-florales' ||
    norm === 'arreglos florales' ||
    norm === 'arreglos florales toda ocasion' ||
    norm === 'para toda ocasion' ||
    norm === 'toda ocasion'
  ) {
    return 'grupo-arreglos-florales';
  }

  if (identificador === 'col-arreglos-florales' || norm === 'col arreglos florales') {
    return 'col-arreglos-florales';
  }

  if (
    identificador === 'sub-eventos-decoracion' ||
    norm === 'eventos decoracion' ||
    norm === 'decoracion y ceremonias'
  ) {
    return 'sub-eventos-decoracion';
  }

  if (
    identificador === 'sub-eventos-mobiliario' ||
    norm === 'eventos mobiliario' ||
    norm === 'mobiliario en renta'
  ) {
    return 'sub-eventos-mobiliario';
  }

  if (
    identificador === 'grupo-eventos' ||
    norm === 'eventos' ||
    norm === 'eventos y ceremonias' ||
    norm === 'ceremonias' ||
    norm === 'bodas'
  ) {
    return 'grupo-eventos';
  }

  if (
    identificador === 'grupo-condolencias' ||
    identificador === 'cat-ocas-condol' ||
    norm === 'condolencias' ||
    norm === 'condolencias y funerarios' ||
    norm === 'condolencias y respeto' ||
    norm.includes('condol')
  ) {
    return 'grupo-condolencias';
  }

  const exacta = categorias.find(
    (c) => c.id === identificador || c.slug === identificador
  );
  if (exacta) return exacta.id;

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
      (norm.includes('corean') && (slugNorm.includes('corean') || nomNorm.includes('corean'))) ||
      (norm.includes('florero') && (slugNorm.includes('florero') || nomNorm.includes('florero'))) ||
      (norm.includes('box') && (slugNorm.includes('box') || nomNorm.includes('box'))) ||
      (norm.includes('entrega') && (slugNorm.includes('entrega') || nomNorm.includes('entrega')))
    );
  });

  return porNorm ? porNorm.id : 'cat-todos';
}

/**
 * Resuelve un producto del catálogo (y su variante seleccionada si aplica) a partir de
 * un slug, UUID, nombre o SKU compartido por WhatsApp o Chat Web.
 */
export function resolverProductoPorIdentificador(
  identificador: string,
  productos: ProductoEcommerce[],
  varianteSkuONombre?: string
): ProductoEcommerce | null {
  const idRaw = (identificador || '').trim();
  if (!idRaw || !Array.isArray(productos) || productos.length === 0) return null;

  const idLower = idRaw.toLowerCase();
  const idNorm = normalizarTextoEcommerce(idRaw);

  let varianteDetectada: VarianteEcommerce | undefined;

  // 1. Coincidencia exacta por slug, id o UUID
  let encontrado = productos.find(
    (p) =>
      p.slug.toLowerCase() === idLower ||
      p.id.toLowerCase() === idLower ||
      (p.proIdUuid && p.proIdUuid.toLowerCase() === idLower)
  );

  // 2. Coincidencia por SKU de variante o slug expandido `${slug}-${sku}`
  if (!encontrado) {
    for (const p of productos) {
      const varPorSku = p.variantes.find(
        (v) =>
          v.sku.toLowerCase() === idLower ||
          (v.varId && v.varId.toLowerCase() === idLower) ||
          `${p.slug}-${v.sku}`.toLowerCase() === idLower ||
          `${p.id}__${v.sku}`.toLowerCase() === idLower
      );
      if (varPorSku) {
        encontrado = p;
        varianteDetectada = varPorSku;
        break;
      }
    }
  }

  // 3. Coincidencia normalizada por slug o nombre exacto
  if (!encontrado && idNorm) {
    encontrado = productos.find((p) => {
      const slugN = normalizarTextoEcommerce(p.slug);
      const nomN = normalizarTextoEcommerce(p.nombreBase || p.nombre);
      return slugN === idNorm || nomN === idNorm;
    });
  }

  // 4. Coincidencia parcial por nombre o slug (ej. "cartel-bienvenida" -> "Cartel Bienvenida")
  if (!encontrado && idNorm && idNorm.length >= 3) {
    encontrado = productos.find((p) => {
      const slugN = normalizarTextoEcommerce(p.slug);
      const nomN = normalizarTextoEcommerce(p.nombreBase || p.nombre);
      return (
        slugN.includes(idNorm) ||
        nomN.includes(idNorm) ||
        (slugN.length >= 4 && idNorm.includes(slugN)) ||
        (nomN.length >= 4 && idNorm.includes(nomN))
      );
    });
  }

  if (!encontrado) return null;

  // Resolver variante explícita si se envió `?variante=...` o `?sku=...`
  if (varianteSkuONombre && varianteSkuONombre.trim()) {
    const varRaw = varianteSkuONombre.trim();
    const varLower = varRaw.toLowerCase();
    const varNorm = normalizarTextoEcommerce(varRaw);
    const varMatch =
      encontrado.variantes.find(
        (v) =>
          v.sku.toLowerCase() === varLower ||
          (v.varId && v.varId.toLowerCase() === varLower)
      ) ||
      encontrado.variantes.find(
        (v) =>
          normalizarTextoEcommerce(v.nombre) === varNorm ||
          normalizarTextoEcommerce(v.sku) === varNorm ||
          normalizarTextoEcommerce(v.nombre).includes(varNorm)
      );
    if (varMatch) {
      varianteDetectada = varMatch;
    }
  }

  if (varianteDetectada) {
    return {
      ...encontrado,
      varianteInicialSku: varianteDetectada.sku,
    };
  }

  return encontrado;
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
    ...(p.etiquetasBusqueda || []),
    p.etiquetaTemporada,
    ...(p.requisitos || []),
    p.coberturaTexto,
    ...textosVariantes,
  ];

  return normalizarTextoEcommerce(partes.filter(Boolean).join(' '));
}

/**
 * Comprueba si un token normalizado coincide en el corpus aplicando tolerancia
 * de plural/singular en español (ej. "orquidea" <-> "orquideas", "floreros" <-> "florero",
 * "girasoles" <-> "girasol", "luces" <-> "luz").
 */
export function tokenCoincideEnCorpus(token: string, corpus: string): boolean {
  if (!token) return true;
  if (corpus.includes(token)) return true;

  if (token.endsWith('ces') && token.length > 4) {
    if (corpus.includes(`${token.slice(0, -3)}z`)) return true;
  }
  if (token.endsWith('es') && token.length > 4) {
    if (corpus.includes(token.slice(0, -2))) return true;
  }
  if (token.endsWith('s') && token.length > 3) {
    if (corpus.includes(token.slice(0, -1))) return true;
  }

  return false;
}

/**
 * Retorna las etiquetas semánticas de búsqueda configuradas en el producto
 * (Keywords IA de `pro_detalle_producto.etiquetas`).
 */
export function obtenerEtiquetasBusquedaProducto(p: ProductoEcommerce): string[] {
  const fuente = Array.isArray(p.etiquetasBusqueda)
    ? p.etiquetasBusqueda
    : Array.isArray(p.etiquetas)
    ? p.etiquetas
    : [];
  return fuente
    .map((e) => String(e).replace(/^#+/, '').trim())
    .filter((e) => e.length > 0);
}

/**
 * Extrae las etiquetas semánticas de búsqueda disponibles en un conjunto de productos,
 * deduplicadas por forma normalizada (tildes/mayúsculas) y ordenadas por frecuencia.
 */
export function obtenerEtiquetasBusquedaDisponibles(
  productos: ProductoEcommerce[]
): EtiquetaBusquedaResumen[] {
  const mapa = new Map<
    string,
    { etiqueta: string; productosUnicos: Set<string>; prioridadCapital: number }
  >();

  for (const p of productos) {
    const idConteo = p.proIdUuid || p.id.split('__')[0] || p.id;
    const etiquetas = obtenerEtiquetasBusquedaProducto(p);
    for (const raw of etiquetas) {
      const clave = normalizarTextoEcommerce(raw);
      if (!clave) continue;
      const tieneTildeOMayus = /[A-ZÁÉÍÓÚÑáéíóúñ]/.test(raw) ? 1 : 0;
      const actual = mapa.get(clave);
      if (!actual) {
        mapa.set(clave, {
          etiqueta: raw,
          productosUnicos: new Set([idConteo]),
          prioridadCapital: tieneTildeOMayus,
        });
      } else {
        actual.productosUnicos.add(idConteo);
        if (tieneTildeOMayus > actual.prioridadCapital) {
          actual.etiqueta = raw;
          actual.prioridadCapital = tieneTildeOMayus;
        }
      }
    }
  }

  return Array.from(mapa.entries())
    .map(([clave, info]) => ({
      clave,
      etiqueta: info.etiqueta,
      cantidad: info.productosUnicos.size,
    }))
    .sort((a, b) => {
      if (b.cantidad !== a.cantidad) return b.cantidad - a.cantidad;
      return a.etiqueta.localeCompare(b.etiqueta, 'es');
    });
}

/**
 * Verifica si un producto cumple con TODAS las etiquetas de búsqueda seleccionadas.
 */
export function productoCoincideConEtiquetas(
  p: ProductoEcommerce,
  clavesEtiquetasActivas: string[]
): boolean {
  if (!clavesEtiquetasActivas || clavesEtiquetasActivas.length === 0) return true;
  const etiquetasProd = Array.from(
    new Set([...obtenerEtiquetasBusquedaProducto(p), ...(p.etiquetas || [])])
  )
    .map((e) => normalizarTextoEcommerce(e))
    .filter(Boolean);

  if (etiquetasProd.length === 0) return false;

  return clavesEtiquetasActivas.every((claveActiva) => {
    const claveNorm = normalizarTextoEcommerce(claveActiva);
    if (!claveNorm) return true;
    const tokensClave = claveNorm.split(' ').filter(Boolean);
    return etiquetasProd.some(
      (etNorm) =>
        etNorm === claveNorm ||
        tokenCoincideEnCorpus(claveNorm, etNorm) ||
        (tokensClave.length > 0 && tokensClave.every((tok) => tokenCoincideEnCorpus(tok, etNorm)))
    );
  });
}

/**
 * Evalúa si un producto coincide con la consulta de búsqueda del cliente.
 * Soporta búsquedas parciales ("condole"), etiquetas ("#orquídeas"), múltiples palabras en cualquier orden
 * ("corona rosas", "box orquidea"), plural/singular en español y sinónimos de usos ("pesame", "cumpleaños").
 */
export function productoCoincideConBusqueda(
  p: ProductoEcommerce,
  terminoBusqueda: string,
  categorias: CategoriaEcommerce[] = []
): boolean {
  const queryNorm = normalizarTextoEcommerce(terminoBusqueda);
  if (!queryNorm) return true;

  const corpus = construirCorpusBusquedaProducto(p, categorias);
  if (tokenCoincideEnCorpus(queryNorm, corpus)) return true;

  const palabrasRaw = queryNorm.split(' ').filter(Boolean);
  const palabrasSignificativas = palabrasRaw.filter(
    (pal) => pal.length > 1 && !CONECTORES_BUSQUEDA.has(pal)
  );
  const tokens =
    palabrasSignificativas.length > 0 ? palabrasSignificativas : palabrasRaw;

  return tokens.every((token) => tokenCoincideEnCorpus(token, corpus));
}

/**
 * Clasifica si un producto corresponde a Mobiliario en Renta / Alquiler.
 */
export function esProductoMobiliario(p: ProductoEcommerce): boolean {
  if (p.esRenta === true) return true;
  const tipoOferta = (p.tipoOferta || '').toUpperCase();
  if (tipoOferta.includes('RENTA') || tipoOferta.includes('ALQUILER')) return true;

  const catNom = normalizarTextoEcommerce(p.categoriaNombre);
  const catPrin = normalizarTextoEcommerce(p.categoriaPrincipal);
  if (
    catNom.includes('mobiliario') ||
    catPrin.includes('mobiliario') ||
    catNom.includes('alquiler') ||
    catPrin.includes('alquiler') ||
    catNom.includes('renta') ||
    catPrin.includes('renta')
  ) {
    return true;
  }

  const slug = normalizarTextoEcommerce(p.slug || p.id);
  const nombre = normalizarTextoEcommerce(p.nombre);
  const etiquetas = (p.etiquetas || []).map((e) => normalizarTextoEcommerce(e));

  if (
    etiquetas.some(
      (et) =>
        et.includes('mobiliario') ||
        et.includes('renta') ||
        et.includes('alquiler')
    )
  ) {
    return true;
  }

  if (
    slug.includes('mobiliario') ||
    slug.includes('alquiler') ||
    slug.includes('backing') ||
    slug.includes('atril') ||
    slug.includes('cilindro') ||
    slug.includes('mampara') ||
    nombre.includes('mobiliario') ||
    nombre.includes('backing') ||
    nombre.includes('atril') ||
    nombre.includes('mampara') ||
    nombre.includes('mesas cilindro')
  ) {
    return true;
  }

  return false;
}

/**
 * Clasifica si un producto corresponde a Eventos y Ceremonias (bajo proforma personalizada).
 */
export function esProductoEvento(p: ProductoEcommerce): boolean {
  if (esProductoMobiliario(p)) return false;

  if (p.esEvento === true) return true;
  const tipoOferta = (p.tipoOferta || '').toUpperCase();
  if (tipoOferta === 'SERVICIO') return true;

  const catNom = normalizarTextoEcommerce(p.categoriaNombre);
  const catPrin = normalizarTextoEcommerce(p.categoriaPrincipal);
  if (
    catNom.includes('evento') ||
    catNom.includes('ceremonia') ||
    catPrin.includes('evento') ||
    catPrin.includes('ceremonia')
  ) {
    return true;
  }

  const slug = normalizarTextoEcommerce(p.slug || p.id);
  const nombre = normalizarTextoEcommerce(p.nombre);
  const etiquetas = (p.etiquetas || []).map((e) => normalizarTextoEcommerce(e));

  if (
    etiquetas.some(
      (et) =>
        et.includes('evento') ||
        et.includes('ceremonia') ||
        et.includes('boda')
    )
  ) {
    return true;
  }

  if (
    slug.includes('evento') ||
    slug.includes('ceremonia') ||
    slug.includes('aro floral') ||
    slug.includes('aro-floral') ||
    slug.includes('bienvenida de gala') ||
    slug.includes('bienvenida-de-gala') ||
    nombre.includes('evento') ||
    nombre.includes('ceremonia') ||
    nombre.includes('aro floral') ||
    nombre.includes('bienvenida de gala') ||
    nombre.includes('arco floral')
  ) {
    return true;
  }

  return false;
}

/**
 * Clasifica si un producto corresponde a Condolencias, Duelo o Funerarios.
 */
export function esProductoCondolencias(p: ProductoEcommerce): boolean {
  if (esProductoMobiliario(p) || esProductoEvento(p)) return false;

  if (p.esCondolencias === true) return true;

  const catNom = normalizarTextoEcommerce(p.categoriaNombre);
  const catPrin = normalizarTextoEcommerce(p.categoriaPrincipal);
  if (
    catNom.includes('condol') ||
    catNom.includes('funer') ||
    catPrin.includes('condol') ||
    catPrin.includes('funer')
  ) {
    return true;
  }

  const slug = normalizarTextoEcommerce(p.slug || p.id);
  const nombre = normalizarTextoEcommerce(p.nombre);
  const etiquetas = (p.etiquetas || []).map((e) => normalizarTextoEcommerce(e));

  if (
    etiquetas.some(
      (et) =>
        et.includes('condol') ||
        et.includes('funer') ||
        et.includes('duelo') ||
        et.includes('pesame')
    )
  ) {
    return true;
  }

  if (
    slug.includes('condol') ||
    slug.includes('corona') ||
    slug.includes('abanico') ||
    slug.includes('pedestal') ||
    slug.includes('cruz') ||
    nombre.includes('condolencia') ||
    nombre.includes('corona') ||
    nombre.includes('abanico') ||
    nombre.includes('pedestal') ||
    nombre.includes('cruz')
  ) {
    return true;
  }

  return false;
}

/**
 * Jerarquía del catálogo Tinkay requerida por el usuario:
 * Nivel 1: Todo los demás — Primero los destacados (Bouquets, Box florales, etc. destacados)
 * Nivel 2: Todo los demás — Luego el resto (Bouquets, Box florales, etc. regulares)
 * Nivel 3: Trasantepenúltimo: Condolencias
 * Nivel 4: Penúltimo: Eventos
 * Nivel 5: Último: Mobiliario
 */
export function obtenerJerarquiaCatalogoTinkay(p: ProductoEcommerce): number {
  if (esProductoMobiliario(p)) return 5;
  if (esProductoEvento(p)) return 4;
  if (esProductoCondolencias(p)) return 3;
  if (p.destacado) return 1;
  return 2;
}
