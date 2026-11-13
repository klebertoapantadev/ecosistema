import { ProductoEcommerce, CategoriaEcommerce, VarianteEcommerce } from './tipos';
import { CATEGORIAS_TINKAY, PRODUCTOS_TINKAY } from './datos-catalogo';

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
    beneficios_custom?: string[];
    detalle?: string;
    modalidad_pago?: string;
    receta_bom?: string;
    tallos?: number;
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
    etiquetas?: string[];
    ocasion_recomendada?: string;
    usos?: string[];
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
  ctg_tipo?: 'FORMATO' | 'COLECCION' | 'OCASION' | 'COMPLEMENTO' | 'EVENTO';
  ctg_detalle_categoria?: {
    icono?: string;
    modo_visual_sobrio?: boolean;
  };
}

/**
 * Carga en tiempo real los productos y variantes configurados en Supabase (public.com_producto y public.com_variante)
 * para el negocio 'tinkay', reflejando de inmediato cualquier cambio de precio, foto o variante realizado en el panel.
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
    const catsDb: SupabaseCategoriaRaw[] = resCats.ok ? await resCats.json() : [];

    if (!Array.isArray(prodsDb) || prodsDb.length === 0) {
      return { productos: PRODUCTOS_TINKAY, categorias: CATEGORIAS_TINKAY };
    }

    // Mapeo de Categorías
    const categorias: CategoriaEcommerce[] = [...CATEGORIAS_TINKAY];
    if (Array.isArray(catsDb) && catsDb.length > 0) {
      catsDb.forEach((c) => {
        if (!categorias.some((cat) => cat.id === c.ctg_slug || cat.id === c.ctg_id)) {
          categorias.push({
            id: c.ctg_slug || c.ctg_id,
            slug: c.ctg_slug || c.ctg_id,
            nombre: c.ctg_nombre,
            descripcion: c.ctg_descripcion || '',
            tipo: c.ctg_tipo || 'COLECCION',
            icono: c.ctg_detalle_categoria?.icono || undefined,
            modoVisualSobrio: c.ctg_detalle_categoria?.modo_visual_sobrio === true,
          });
        }
      });
    }

    // Mapeo de Productos
    const productos: ProductoEcommerce[] = prodsDb
      .filter((p) => p.pro_tipo !== 'SERVICIO' && p.pro_slug !== 'combo-aniversario-especial')
      .map((p) => {
        const fallbackMatch = PRODUCTOS_TINKAY.find((orig) => orig.slug === p.pro_slug || orig.id === p.pro_slug);
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
        const galeriaMasterExplicita: string[] = [];
        if (typeof detalle.imagen_url === 'string' && detalle.imagen_url.trim()) {
          fotosMaster.push(detalle.imagen_url.trim());
        }
        if (Array.isArray(detalle.galeria_urls)) {
          detalle.galeria_urls.forEach((f) => {
            if (typeof f === 'string' && f.trim()) {
              const limpia = f.trim();
              if (!fotosMaster.includes(limpia)) fotosMaster.push(limpia);
              if (!galeriaMasterExplicita.includes(limpia)) galeriaMasterExplicita.push(limpia);
            }
          });
        }

        const variantes: VarianteEcommerce[] = varsActivas.map((v) => {
          const tarifaIva = Number(v.var_tarifa_iva_porcentaje ?? 0);
          const base = Number(v.var_precio ?? 0);
          // El PVP es la base más el IVA correspondiente
          const pvp = tarifaIva > 0 ? Number((base * (1 + tarifaIva / 100)).toFixed(2)) : base;
          const compRaw = v.var_precio_comparacion
            ? Number(v.var_precio_comparacion)
            : v.var_detalle_variante?.pvp_nominal
            ? Number(v.var_detalle_variante.pvp_nominal)
            : undefined;
          const precioComparacion = compRaw && compRaw > pvp ? compRaw : undefined;

          // Construir la galería completa de esta variante igual que en ModalEditarProducto
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

          // Si la variante tiene sus propias fotos configuradas, usar estrictamente sus fotos propias.
          // Solo si no tiene fotos propias, hereda la galería/portada de la ficha maestra como fallback.
          let fotosVarianteFinal: string[] = [];
          if (fotosPropias.length > 0) {
            fotosVarianteFinal = [...fotosPropias];
          } else if (fotosMaster.length > 0) {
            fotosVarianteFinal = [...fotosMaster];
          }

          // Si el producto tiene una sola variante (producto simple), asegurar que incluya todas las fotos del producto
          if (varsActivas.length === 1) {
            fotosMaster.forEach((fm) => {
              if (!fotosVarianteFinal.includes(fm)) fotosVarianteFinal.push(fm);
            });
          }

          const beneficiosVarRaw = Array.isArray(v.var_detalle_variante?.beneficios_custom)
            ? v.var_detalle_variante.beneficios_custom
            : typeof v.var_detalle_variante?.beneficios_custom === 'string'
            ? (v.var_detalle_variante.beneficios_custom as string).split('\n')
            : [];
          const beneficiosVar = beneficiosVarRaw
            .map((b: any) => String(b).trim())
            .filter((b: string) => b.length > 0);

          return {
            sku: v.var_sku || `VAR-${v.var_id.slice(0, 6)}`,
            nombre: v.var_nombre,
            pvp,
            baseImponible: base,
            tarifaIva,
            precioComparacion,
            foto: fotosVarianteFinal[0],
            fotos: fotosVarianteFinal,
            detalle:
              v.var_detalle_variante?.beneficios_custom?.[0] ||
              v.var_detalle_variante?.detalle ||
              undefined,
            beneficiosCustom: beneficiosVar.length > 0 ? beneficiosVar : undefined,
            recetaBom: v.var_detalle_variante?.receta_bom || undefined,
            unidadesFlores: v.var_detalle_variante?.tallos || undefined,
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

        // Fallback fotográfico de seguridad
        if (fotos.length === 0 && fallbackMatch && fallbackMatch.fotos.length > 0) {
          fotos.push(...fallbackMatch.fotos);
        }

        // Buscar categoría en catsDb por UUID o slug
        const catEncontrada = catsDb.find(
          (c) => c.ctg_id === p.pro_categoria_principal_id || c.ctg_slug === p.pro_categoria_principal_id
        );
        const catNombre = catEncontrada?.ctg_nombre || '';
        const catSlug = catEncontrada?.ctg_slug || '';
        const catTipo = catEncontrada?.ctg_tipo;

        const usosRaw = Array.isArray(detalle.usos)
          ? detalle.usos
          : typeof detalle.usos === 'string'
          ? [detalle.usos]
          : [];
        let usos: string[] = usosRaw.map((u: any) => String(u).trim().toLowerCase());

        const esExtra =
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
          catNombre.toLowerCase().includes('condol') ||
          catSlug.toLowerCase().includes('condol') ||
          p.pro_slug?.includes('abanico') ||
          p.pro_slug?.includes('pedestal') ||
          detalle.ocasion_recomendada?.toUpperCase().includes('CONDOL') ||
          usos.some((u: string) => u.includes('condol') || u.includes('duelo') || u.includes('pesame'));

        // Si no es extra ni condolencias y no tiene usos explícitos, asignar usos florales versátiles por defecto
        if (usos.length === 0 && !esExtra && !esCondol) {
          usos = ['amor_romance', 'aniversario', 'cumpleanos'];
        }

        const tieneUso = (palabra: string) =>
          usos.some((u: string) => u.includes(palabra)) ||
          (typeof detalle.ocasion_recomendada === 'string' && detalle.ocasion_recomendada.toLowerCase().includes(palabra)) ||
          (Array.isArray(detalle.etiquetas) && detalle.etiquetas.some((e: any) => String(e).toLowerCase().includes(palabra)));

        const catsSecundarias: string[] = [];
        if (esCondol || tieneUso('condol') || tieneUso('duelo') || tieneUso('pesame')) {
          catsSecundarias.push('cat-ocas-condol');
        }
        if (tieneUso('amor') || tieneUso('romance') || tieneUso('pedida') || p.pro_slug?.includes('san-valentin') || p.pro_slug?.includes('amor')) {
          catsSecundarias.push('cat-ocas-amor');
        }
        if (tieneUso('aniv') || p.pro_slug?.includes('aniversario')) {
          catsSecundarias.push('cat-ocas-aniv');
        }
        if (tieneUso('cumple') || tieneUso('festejo') || tieneUso('sorpresa') || tieneUso('celebracion')) {
          catsSecundarias.push('cat-ocas-cumple');
        }

        const beneficiosDbRaw = Array.isArray(detalle.beneficios)
          ? detalle.beneficios
          : typeof detalle.beneficios === 'string'
          ? (detalle.beneficios as string).split('\n')
          : [];
        const beneficiosDb = beneficiosDbRaw
          .map((b: any) => String(b).trim())
          .filter((b: string) => b.length > 0);

        const beneficiosFinal =
          beneficiosDb.length > 0
            ? beneficiosDb
            : fallbackMatch?.beneficios && fallbackMatch.beneficios.length > 0
            ? fallbackMatch.beneficios
            : [];

        const descripcionFinal =
          p.pro_descripcion && p.pro_descripcion.trim().length > 0
            ? p.pro_descripcion.trim()
            : detalle.descripcion_corta && detalle.descripcion_corta.trim().length > 0
            ? detalle.descripcion_corta.trim()
            : fallbackMatch?.descripcionLarga || fallbackMatch?.descripcionCorta || '';

        return {
          id: p.pro_slug || p.pro_id,
          slug: p.pro_slug || p.pro_id,
          nombre: p.pro_nombre,
          descripcionCorta: detalle.descripcion_corta || p.pro_descripcion || fallbackMatch?.descripcionCorta || 'Arreglo floral exclusivo de exportación.',
          descripcionLarga: descripcionFinal,
          beneficios: beneficiosFinal,
          categoriaPrincipal: catSlug || catEncontrada?.ctg_id || (p.pro_slug?.includes('coreano')
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
          variantes: variantes.length > 0 ? variantes : [
            {
              sku: 'DEF-1',
              nombre: 'Presentación Única',
              pvp: 40,
              baseImponible: 34.78,
              tarifaIva: 15,
            }
          ],
          destacado: p.pro_slug === 'box-florales' ? true : esCondol || esExtra ? false : p.pro_destacado === true,
          nuevo: false,
          entregaHoy: true,
          esCondolencias: esCondol,
          esComplemento: esExtra,
          esExtra: esExtra,
          usos,
          ocasionRecomendada: esCondol ? 'Condolencias y Homenajes Solemnes' : 'Amor, Cumpleaños o Aniversario',
          etiquetas: Array.isArray(detalle.etiquetas) ? detalle.etiquetas : ['Flores de Exportación', 'Quito'],
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

    return { productos, categorias };
  } catch (error) {
    console.error('Error cargando catálogo dinámico desde Supabase:', error);
    return { productos: PRODUCTOS_TINKAY, categorias: CATEGORIAS_TINKAY };
  }
}
