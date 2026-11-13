import { ProductoEcommerce, CategoriaEcommerce, VarianteEcommerce } from './tipos';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from './datos-catalogo';
import { normalizarTextoEcommerce } from './filtrado-catalogo';
import {
  normalizarComponentesCombo,
  normalizarEscalasVolumen,
} from '@eco/comercio';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://oaybbpdxhlxjbpwnoymy.supabase.co';
const SUPABASE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || 'sb_publishable_vC-t-FcOQ2Q5_XkTCcPKdQ_bveIh5YS';

interface SupabaseVarianteRaw {
  var_id: string;
  var_sku?: string;
  var_nombre: string;
  var_precio?: number;
  var_tarifa_iva_porcentaje?: number;
  var_precio_comparacion?: number;
  var_activo?: boolean;
  var_detalle_variante?: {
    orden?: number;
    pvp_nominal?: number;
    portada_url?: string;
    album_url?: string;
    galeria_urls?: string[];
    beneficios_custom?: string[] | string;
    detalle?: string;
    modalidad_pago?: string;
    receta_bom?: string;
    tallos?: number;
    usos?: string[];
    ocasiones?: string[];
    usos_modo?: 'heredar' | 'personalizado';
    escalas_volumen?: unknown;
  };
}

interface SupabaseProductoRaw {
  pro_id: string;
  pro_slug?: string;
  pro_categoria_principal_id?: string;
  pro_nombre: string;
  pro_descripcion?: string;
  pro_tipo?: string;
  pro_destacado?: boolean;
  pro_activo?: boolean;
  pro_detalle_producto?: {
    imagen_url?: string;
    galeria_urls?: string[];
    descripcion_corta?: string;
    beneficios?: string[] | string;
    requisitos?: string[] | string;
    etiquetas?: string[];
    etiqueta_temporada?: string;
    ocasion_recomendada?: string;
    usos?: string[] | string;
    ocasiones?: string[] | string;
    es_complemento?: boolean;
    es_combo?: boolean;
    combo_componentes?: unknown;
    canales_visibilidad?: string[];
    vigencia_tipo?: 'SIEMPRE' | 'RANGO_FECHAS' | 'ESTACIONAL_ANUAL';
    fecha_inicio?: string;
    fecha_fin?: string;
    tarifa_iva_predeterminada?: number;
    logistica?: {
      delivery_incluido?: boolean;
      modalidad_transporte?: string;
      etiqueta_transporte?: string;
      cobertura_texto?: string;
      recargo_transporte_usd?: number;
    };
  };
  com_variante?: SupabaseVarianteRaw[];
}

interface SupabaseCategoriaRaw {
  ctg_id: string;
  ctg_slug?: string;
  ctg_nombre: string;
  ctg_descripcion?: string;
  ctg_orden?: number;
  ctg_activo?: boolean;
  ctg_eliminado_en?: string | null;
  ctg_tipo?: 'FORMATO' | 'COLECCION' | 'OCASION' | 'COMPLEMENTO' | 'EVENTO';
  ctg_detalle_categoria?: {
    icono?: string;
    modo_visual_sobrio?: boolean;
    palabras_clave?: string[];
  };
}

function productoEstaVigenteEnFecha(
  detalle?: SupabaseProductoRaw['pro_detalle_producto'],
  proActivo = true,
  fechaRef = new Date()
): boolean {
  if (proActivo === false) return false;
  const tipo = detalle?.vigencia_tipo || 'SIEMPRE';
  if (tipo === 'SIEMPRE') return true;

  const inicio = detalle?.fecha_inicio?.trim();
  const fin = detalle?.fecha_fin?.trim();
  if (!inicio || !fin) return true;

  if (tipo === 'RANGO_FECHAS') {
    const hoyYMD = fechaRef.toISOString().split('T')[0] ?? '';
    return Boolean(hoyYMD && hoyYMD >= inicio && hoyYMD <= fin);
  }

  if (tipo === 'ESTACIONAL_ANUAL') {
    const aMD = (val: string) => {
      const partes = val.split('-');
      return partes.length === 3 ? `${partes[1]}-${partes[2]}` : val;
    };
    const inicioMD = aMD(inicio);
    const finMD = aMD(fin);
    const mes = String(fechaRef.getMonth() + 1).padStart(2, '0');
    const dia = String(fechaRef.getDate()).padStart(2, '0');
    const hoyMD = `${mes}-${dia}`;
    return inicioMD <= finMD
      ? hoyMD >= inicioMD && hoyMD <= finMD
      : hoyMD >= inicioMD || hoyMD <= finMD;
  }

  return true;
}

function productoTieneFotografiaConfigurada(p: SupabaseProductoRaw): boolean {
  const det = p.pro_detalle_producto || {};
  if (typeof det.imagen_url === 'string' && det.imagen_url.trim().length > 0) return true;
  if (
    Array.isArray(det.galeria_urls) &&
    det.galeria_urls.some((u) => typeof u === 'string' && u.trim().length > 0)
  ) {
    return true;
  }
  const vars = Array.isArray(p.com_variante) ? p.com_variante : [];
  return vars.some((v) => {
    if (v.var_activo === false) return false;
    const vdet = v.var_detalle_variante || {};
    if (typeof vdet.portada_url === 'string' && vdet.portada_url.trim().length > 0) return true;
    return (
      Array.isArray(vdet.galeria_urls) &&
      vdet.galeria_urls.some((u) => typeof u === 'string' && u.trim().length > 0)
    );
  });
}

function formatearOcasionRecomendada(
  ocasionRaw: string | undefined,
  esCondol: boolean,
  usos: string[],
  catNombre: string
): string | undefined {
  if (esCondol) return 'Condolencias y Homenajes Solemnes';

  if (typeof ocasionRaw === 'string' && ocasionRaw.trim()) {
    const limpia = ocasionRaw.trim();
    const upper = limpia.toUpperCase();
    if (upper === 'CAT_OCAS_CONDOL') return 'Condolencias y Homenajes Solemnes';
    if (upper === 'CAT_OCAS_AMOR') return 'Amor, Romance y Pedida de Mano';
    if (upper === 'CAT_OCAS_ANIV') return 'Aniversario y Fechas Especiales';
    if (upper === 'CAT_OCAS_CUMPLE') return 'Cumpleaños y Celebraciones';
    if (!upper.startsWith('CAT_')) return limpia;
  }

  if (usos.length > 0) {
    const etiquetasLegibles: string[] = [];
    const usosNorm = usos.map((u) => normalizarTextoEcommerce(u)).join(' ');
    if (usosNorm.includes('amor') || usosNorm.includes('romance')) etiquetasLegibles.push('Amor y Romance');
    if (usosNorm.includes('pedida')) etiquetasLegibles.push('Pedida de Mano');
    if (usosNorm.includes('aniversario')) etiquetasLegibles.push('Aniversario');
    if (usosNorm.includes('cumple')) etiquetasLegibles.push('Cumpleaños');
    if (usosNorm.includes('agradecimiento')) etiquetasLegibles.push('Agradecimiento');
    if (usosNorm.includes('graduacion')) etiquetasLegibles.push('Graduación');
    if (usosNorm.includes('corporativo')) etiquetasLegibles.push('Corporativo y Eventos');
    if (usosNorm.includes('nacimiento')) etiquetasLegibles.push('Nacimiento');
    if (usosNorm.includes('madre') || usosNorm.includes('mujer')) etiquetasLegibles.push('Día de la Madre y Mujer');
    if (usosNorm.includes('recuperate')) etiquetasLegibles.push('Recupérate Pronto');
    if (usosNorm.includes('sorpresa')) etiquetasLegibles.push('Sorpresa y Detalle');
    if (etiquetasLegibles.length > 0) return etiquetasLegibles.join(', ');
  }

  return catNombre || undefined;
}

function prioridadVisualCategoria(c: SupabaseCategoriaRaw): number {
  const slug = (c.ctg_slug || '').toLowerCase();
  if (slug === 'box-florales') return 1;
  if (slug === 'cat-coreanos') return 2;
  if (slug === 'cat-floreros') return 3;
  if (slug.includes('evento')) return 4;
  if (c.ctg_detalle_categoria?.modo_visual_sobrio || slug.includes('condol')) return 90;
  return 50;
}

/**
 * Carga en tiempo real los productos, categorías y variantes configurados en Supabase
 * (`com_producto`, `com_variante`, `com_categoria`) para el negocio `tinkay`.
 */
export async function cargarCatalogoDinamicoTinkay(): Promise<{
  productos: ProductoEcommerce[];
  categorias: CategoriaEcommerce[];
}> {
  try {
    const headers = {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
    };

    const [resProds, resCats] = await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/com_producto?pro_negocio=eq.tinkay&pro_activo=eq.true&select=*,com_variante(*)`, {
        headers,
        cache: 'no-store',
      }),
      fetch(`${SUPABASE_URL}/rest/v1/com_categoria?ctg_negocio=eq.tinkay&ctg_activo=eq.true&select=*`, {
        headers,
        cache: 'no-store',
      }),
    ]);

    if (!resProds.ok) {
      console.warn('No se pudo obtener productos dinámicos de Supabase, usando fallback.');
      return { productos: PRODUCTOS_TINKAY, categorias: CATEGORIAS_TINKAY };
    }

    const prodsDb: SupabaseProductoRaw[] = await resProds.json();
    const catsDbRaw: SupabaseCategoriaRaw[] = resCats.ok ? await resCats.json() : [];
    const catsDb = Array.isArray(catsDbRaw)
      ? catsDbRaw.filter((c) => c.ctg_activo !== false && !c.ctg_eliminado_en)
      : [];

    if (!Array.isArray(prodsDb) || prodsDb.length === 0) {
      return { productos: PRODUCTOS_TINKAY, categorias: CATEGORIAS_TINKAY };
    }

    // 1. Mapeo de Categorías fiel a Supabase (com_categoria)
    const categoriaTodos: CategoriaEcommerce = CATEGORIAS_TINKAY[0] ?? {
      id: 'cat-todos',
      slug: 'todos',
      nombre: 'Todo el Catálogo',
      descripcion: 'Colección floral completa de exportación y detalles para regalar.',
      tipo: 'COLECCION',
      icono: 'Sparkles',
      orden: 0,
    };

    let categorias: CategoriaEcommerce[];
    if (catsDb.length > 0) {
      const ordenadas = [...catsDb].sort((a, b) => {
        const prioSobrioA = a.ctg_detalle_categoria?.modo_visual_sobrio ? 1 : 0;
        const prioSobrioB = b.ctg_detalle_categoria?.modo_visual_sobrio ? 1 : 0;
        if (prioSobrioA !== prioSobrioB) return prioSobrioA - prioSobrioB;

        const ordA = a.ctg_orden ?? 99;
        const ordB = b.ctg_orden ?? 99;
        if (ordA !== ordB) return ordA - ordB;

        return prioridadVisualCategoria(a) - prioridadVisualCategoria(b);
      });

      categorias = [categoriaTodos];
      ordenadas.forEach((c) => {
        const slugCat = c.ctg_slug || c.ctg_id;
        if (!categorias.some((cat) => cat.id === slugCat || cat.slug === slugCat)) {
          const esSobrio =
            c.ctg_detalle_categoria?.modo_visual_sobrio === true ||
            normalizarTextoEcommerce(c.ctg_nombre).includes('condol') ||
            normalizarTextoEcommerce(slugCat).includes('condol');

          categorias.push({
            id: slugCat,
            slug: slugCat,
            nombre: c.ctg_nombre,
            descripcion: c.ctg_descripcion || '',
            tipo: c.ctg_tipo || 'COLECCION',
            icono: c.ctg_detalle_categoria?.icono || undefined,
            modoVisualSobrio: esSobrio,
            orden: c.ctg_orden ?? 99,
            palabrasClave: Array.isArray(c.ctg_detalle_categoria?.palabras_clave)
              ? c.ctg_detalle_categoria.palabras_clave
              : undefined,
          });
        }
      });
    } else {
      categorias = [...CATEGORIAS_TINKAY];
    }

    // 2. Mapeo de Productos activos y vigentes
    const productos: ProductoEcommerce[] = prodsDb
      .filter((p) => {
        if (p.pro_activo === false) return false;
        if (p.pro_slug === 'combo-aniversario-especial') return false;
        if (!productoEstaVigenteEnFecha(p.pro_detalle_producto, p.pro_activo)) return false;

        // Permitir productos tipo SERVICIO únicamente si están publicados para E-Commerce Web o tienen fotos reales
        // (ej. Backing Floral en Eventos y Ceremonias), excluyendo recargos internos sin imagen.
        if (p.pro_tipo === 'SERVICIO') {
          const canales = p.pro_detalle_producto?.canales_visibilidad || [];
          const visibleEnWeb = canales.includes('ECOMMERCE_WEB');
          return visibleEnWeb || productoTieneFotografiaConfigurada(p);
        }

        return true;
      })
      .map((p) => {
        const fallbackMatch = PRODUCTOS_TINKAY.find(
          (orig) => orig.slug === p.pro_slug || orig.id === p.pro_slug
        );
        const detalle = p.pro_detalle_producto || {};
        const varsRaw: SupabaseVarianteRaw[] = Array.isArray(p.com_variante) ? p.com_variante : [];
        const varsActivas = varsRaw
          .filter((v) => v.var_activo !== false)
          .sort((a, b) => {
            const ordA = a.var_detalle_variante?.orden ?? 99;
            const ordB = b.var_detalle_variante?.orden ?? 99;
            return ordA - ordB;
          });

        // Fotografías globales configuradas en la ficha maestra del producto
        const fotosMaster: string[] = [];
        if (typeof detalle.imagen_url === 'string' && detalle.imagen_url.trim()) {
          fotosMaster.push(detalle.imagen_url.trim());
        }
        if (Array.isArray(detalle.galeria_urls)) {
          detalle.galeria_urls.forEach((f) => {
            if (typeof f === 'string' && f.trim()) {
              const limpia = f.trim();
              if (!fotosMaster.includes(limpia)) fotosMaster.push(limpia);
            }
          });
        }

        const tarifaPredeterminada = Number(detalle.tarifa_iva_predeterminada ?? 0);

        const variantes: VarianteEcommerce[] = varsActivas.map((v) => {
          const tarifaIva = Number(v.var_tarifa_iva_porcentaje ?? tarifaPredeterminada ?? 0);
          const base = Number(v.var_precio ?? 0);
          const pvp = tarifaIva > 0 ? Number((base * (1 + tarifaIva / 100)).toFixed(2)) : base;
          const compRaw = v.var_precio_comparacion
            ? Number(v.var_precio_comparacion)
            : v.var_detalle_variante?.pvp_nominal
            ? Number(v.var_detalle_variante.pvp_nominal)
            : undefined;
          const precioComparacion = compRaw && compRaw > pvp ? compRaw : undefined;

          const fotosPropias: string[] = [];
          const portadaVar =
            typeof v.var_detalle_variante?.portada_url === 'string'
              ? v.var_detalle_variante.portada_url.trim()
              : '';
          if (portadaVar) {
            fotosPropias.push(portadaVar);
          }
          if (Array.isArray(v.var_detalle_variante?.galeria_urls)) {
            v.var_detalle_variante.galeria_urls.forEach((u) => {
              if (typeof u === 'string' && u.trim() && !fotosPropias.includes(u.trim())) {
                fotosPropias.push(u.trim());
              }
            });
          }

          let fotosVarianteFinal: string[] = [];
          if (fotosPropias.length > 0) {
            fotosVarianteFinal = [...fotosPropias];
          } else if (fotosMaster.length > 0) {
            fotosVarianteFinal = [...fotosMaster];
          }

          if (varsActivas.length === 1) {
            fotosMaster.forEach((fm) => {
              if (!fotosVarianteFinal.includes(fm)) fotosVarianteFinal.push(fm);
            });
          }

          const beneficiosVarRaw = Array.isArray(v.var_detalle_variante?.beneficios_custom)
            ? v.var_detalle_variante.beneficios_custom
            : typeof v.var_detalle_variante?.beneficios_custom === 'string'
            ? v.var_detalle_variante.beneficios_custom.split('\n')
            : [];
          const beneficiosVar = beneficiosVarRaw
            .map((b: unknown) => String(b).trim())
            .filter((b: string) => b.length > 0);

          const usosVarRaw = [
            ...(Array.isArray(v.var_detalle_variante?.usos) ? v.var_detalle_variante.usos : []),
            ...(Array.isArray(v.var_detalle_variante?.ocasiones) ? v.var_detalle_variante.ocasiones : []),
          ]
            .map((u: unknown) => String(u).trim())
            .filter((u: string) => u.length > 0);

          const escalasVolumen = normalizarEscalasVolumen(
            v.var_detalle_variante?.escalas_volumen
          );

          return {
            varId: v.var_id,
            sku: v.var_sku || `VAR-${v.var_id.slice(0, 6)}`,
            nombre: v.var_nombre,
            pvp,
            pvpNominalSinVolumen: pvp,
            baseImponible: base,
            tarifaIva,
            precioComparacion,
            escalasVolumen: escalasVolumen.length > 0 ? escalasVolumen : undefined,
            foto: fotosVarianteFinal[0],
            fotos: fotosVarianteFinal,
            detalle:
              beneficiosVar[0] ||
              v.var_detalle_variante?.detalle ||
              undefined,
            beneficiosCustom: beneficiosVar.length > 0 ? beneficiosVar : undefined,
            recetaBom: v.var_detalle_variante?.receta_bom || undefined,
            unidadesFlores: v.var_detalle_variante?.tallos || undefined,
            usos: usosVarRaw.length > 0 ? usosVarRaw : undefined,
            usosModo: v.var_detalle_variante?.usos_modo || 'heredar',
          };
        });

        // Recolección y desduplicación de todas las fotografías del producto y sus variantes
        const fotos: string[] = [];
        variantes.forEach((v) => {
          if (v.foto && !fotos.includes(v.foto)) fotos.push(v.foto);
        });
        variantes.forEach((v) => {
          (v.fotos || []).forEach((f) => {
            if (f && !fotos.includes(f)) fotos.push(f);
          });
        });
        fotosMaster.forEach((f) => {
          if (f && !fotos.includes(f)) fotos.push(f);
        });

        if (fotos.length === 0 && fallbackMatch && fallbackMatch.fotos.length > 0) {
          fotos.push(...fallbackMatch.fotos);
        }

        // Buscar categoría en catsDb por UUID o slug
        const catEncontrada = catsDb.find(
          (c) =>
            c.ctg_id === p.pro_categoria_principal_id ||
            c.ctg_slug === p.pro_categoria_principal_id
        );
        const catNombre = catEncontrada?.ctg_nombre || '';
        const catSlug = catEncontrada?.ctg_slug || '';
        const catTipo = catEncontrada?.ctg_tipo;
        const palabrasClaveCat = Array.isArray(catEncontrada?.ctg_detalle_categoria?.palabras_clave)
          ? catEncontrada.ctg_detalle_categoria.palabras_clave
          : undefined;

        const usosRaw = [
          ...(Array.isArray(detalle.usos)
            ? detalle.usos
            : typeof detalle.usos === 'string'
            ? [detalle.usos]
            : []),
          ...(Array.isArray(detalle.ocasiones)
            ? detalle.ocasiones
            : typeof detalle.ocasiones === 'string'
            ? [detalle.ocasiones]
            : []),
        ];
        const usos: string[] = Array.from(
          new Set(
            usosRaw
              .map((u: unknown) => String(u).trim())
              .filter((u: string) => u.length > 0)
          )
        );
        const usosNormTexto = usos.map((u) => normalizarTextoEcommerce(u)).join(' ');

        const esExtra =
          detalle.es_complemento === true ||
          catNombre.toLowerCase().includes('extra') ||
          catSlug.toLowerCase().includes('extra') ||
          catTipo === 'COMPLEMENTO' ||
          p.pro_tipo === 'COMPLEMENTO' ||
          p.pro_slug?.includes('ferrero') ||
          p.pro_slug?.includes('choc') ||
          p.pro_slug?.includes('globo') ||
          p.pro_slug?.includes('mariposa') ||
          p.pro_slug?.includes('servicios-logisticos') ||
          p.pro_slug?.includes('cinta');

        const esCondol =
          catEncontrada?.ctg_detalle_categoria?.modo_visual_sobrio === true ||
          catNombre.toLowerCase().includes('condol') ||
          catSlug.toLowerCase().includes('condol') ||
          p.pro_slug?.includes('abanico') ||
          p.pro_slug?.includes('pedestal') ||
          p.pro_slug?.includes('corona') ||
          (detalle.ocasion_recomendada || '').toUpperCase().includes('CONDOL') ||
          usosNormTexto.includes('condol') ||
          usosNormTexto.includes('duelo') ||
          usosNormTexto.includes('pesame');

        const catsSecundarias: string[] = [];
        if (esCondol && catSlug !== 'cat-ocas-condol') {
          catsSecundarias.push('cat-ocas-condol');
        }

        const beneficiosDbRaw = Array.isArray(detalle.beneficios)
          ? detalle.beneficios
          : typeof detalle.beneficios === 'string'
          ? detalle.beneficios.split('\n')
          : [];
        const beneficiosDb = beneficiosDbRaw
          .map((b: unknown) => String(b).trim())
          .filter((b: string) => b.length > 0);

        const beneficiosFinal =
          beneficiosDb.length > 0
            ? beneficiosDb
            : fallbackMatch?.beneficios && fallbackMatch.beneficios.length > 0
            ? fallbackMatch.beneficios
            : [];

        const requisitosDbRaw = Array.isArray(detalle.requisitos)
          ? detalle.requisitos
          : typeof detalle.requisitos === 'string'
          ? detalle.requisitos.split('\n')
          : [];
        const requisitosFinal = requisitosDbRaw
          .map((r: unknown) => String(r).trim())
          .filter((r: string) => r.length > 0);

        const descripcionMasterCorta =
          detalle.descripcion_corta && detalle.descripcion_corta.trim().length > 0
            ? detalle.descripcion_corta.trim()
            : '';

        const descripcionFinal =
          p.pro_descripcion && p.pro_descripcion.trim().length > 0
            ? p.pro_descripcion.trim()
            : descripcionMasterCorta ||
              fallbackMatch?.descripcionLarga ||
              fallbackMatch?.descripcionCorta ||
              '';

        const etiquetasDb = Array.isArray(detalle.etiquetas)
          ? detalle.etiquetas
              .map((e: unknown) => String(e).trim())
              .filter((e: string) => e.length > 0)
          : [];

        const esCombo = Boolean(detalle.es_combo);
        const comboComponentes = esCombo
          ? normalizarComponentesCombo(detalle.combo_componentes)
          : [];

        return {
          id: p.pro_slug || p.pro_id,
          proIdUuid: p.pro_id,
          slug: p.pro_slug || p.pro_id,
          nombre: p.pro_nombre,
          descripcionCorta:
            descripcionMasterCorta ||
            p.pro_descripcion ||
            fallbackMatch?.descripcionCorta ||
            'Arreglo floral exclusivo de exportación.',
          descripcionMasterCorta: descripcionMasterCorta || undefined,
          descripcionLarga: descripcionFinal,
          beneficios: beneficiosFinal,
          requisitos: requisitosFinal.length > 0 ? requisitosFinal : undefined,
          etiquetaTemporada: detalle.etiqueta_temporada || undefined,
          palabrasClaveCategoria: palabrasClaveCat,
          categoriaPrincipal:
            catSlug ||
            catEncontrada?.ctg_id ||
            (p.pro_slug?.includes('coreano')
              ? 'cat-coreanos'
              : p.pro_slug?.includes('florero')
              ? 'cat-floreros'
              : p.pro_slug?.includes('box')
              ? 'box-florales'
              : esCondol
              ? 'cat-ocas-condol'
              : esExtra
              ? 'extras-condolencias'
              : 'cat-coreanos'),
          categoriaNombre: catNombre || undefined,
          categoriasSecundarias: catsSecundarias,
          fotos,
          fotosMaster,
          variantes:
            variantes.length > 0
              ? variantes
              : [
                  {
                    sku: 'DEF-1',
                    nombre: 'Presentación Única',
                    pvp: 40,
                    baseImponible: 34.78,
                    tarifaIva: 15,
                  },
                ],
          destacado:
            p.pro_slug === 'box-florales'
              ? true
              : esCondol || esExtra
              ? false
              : p.pro_destacado === true,
          nuevo: false,
          entregaHoy: true,
          esCondolencias: esCondol,
          esComplemento: esExtra,
          esExtra,
          esCombo: esCombo && comboComponentes.length > 0,
          comboComponentes: esCombo && comboComponentes.length > 0 ? comboComponentes : undefined,
          usos,
          ocasionRecomendada: formatearOcasionRecomendada(
            detalle.ocasion_recomendada,
            esCondol,
            usos,
            catNombre
          ),
          etiquetas: etiquetasDb,
          deliveryIncluido:
            typeof detalle.logistica?.delivery_incluido === 'boolean'
              ? detalle.logistica.delivery_incluido
              : true,
          modalidadTransporte: detalle.logistica?.modalidad_transporte || 'INCLUIDO_GRATIS',
          etiquetaTransporte: detalle.logistica?.etiqueta_transporte || undefined,
          coberturaTexto: detalle.logistica?.cobertura_texto || 'Centro-Norte de Quito',
          recargoLogisticoUsd: Number.isFinite(Number(detalle.logistica?.recargo_transporte_usd))
            ? Math.max(0, Number(detalle.logistica?.recargo_transporte_usd))
            : 0,
        };
      });

    // 3. Para productos tipo Set / Combo, sincronizar automáticamente el precio tachado con la suma real de sus componentes
    productos.forEach((prodCombo) => {
      if (!prodCombo.esCombo || !prodCombo.comboComponentes || prodCombo.comboComponentes.length === 0) {
        return;
      }
      const sumaComponentes = prodCombo.comboComponentes.reduce((acc, comp) => {
        const prodHijo = productos.find(
          (item) =>
            item.proIdUuid === comp.producto_id ||
            item.id === comp.producto_id ||
            (comp.producto_slug && item.slug === comp.producto_slug)
        );
        const varHija =
          prodHijo?.variantes.find(
            (v) =>
              (comp.variante_id && v.varId === comp.variante_id) ||
              (comp.variante_sku && v.sku === comp.variante_sku)
          ) || prodHijo?.variantes[0];
        const pvpUnit = varHija ? (varHija.pvpNominalSinVolumen ?? varHija.pvp) : 0;
        return acc + pvpUnit * comp.cantidad_base;
      }, 0);

      const sumaRedondeada = Number(sumaComponentes.toFixed(2));
      const varCombo = prodCombo.variantes[0];
      if (varCombo && sumaRedondeada > varCombo.pvp) {
        varCombo.precioComparacion = sumaRedondeada;
      }
    });

    return { productos, categorias };
  } catch (error) {
    console.error('Error cargando catálogo dinámico desde Supabase:', error);
    return { productos: PRODUCTOS_TINKAY, categorias: CATEGORIAS_TINKAY };
  }
}
