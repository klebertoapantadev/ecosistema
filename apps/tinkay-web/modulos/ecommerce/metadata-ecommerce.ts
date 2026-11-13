import type { Metadata } from 'next';
import { cargarCatalogoDinamicoTinkay } from './servicio-catalogo';
import {
  obtenerNombreProductoIndividual,
  obtenerVarianteActivaProducto,
  productoCoincideConCategoria,
  resolverCategoriaPorIdentificador,
  resolverProductoPorIdentificador,
} from './filtrado-catalogo';

const URL_BASE_TINKAY = (
  process.env.NEXT_PUBLIC_SITE_URL ||
  process.env.NEXT_PUBLIC_APP_URL ||
  'https://tinkay-web.vercel.app'
).replace(/\/+$/, '');

function normalizarUrlImagenAbsoluta(urlFoto?: string): string {
  if (!urlFoto || !urlFoto.trim()) {
    return `${URL_BASE_TINKAY}/img/logo/tinkay-tienda-neon.jpg`;
  }
  if (/^https?:\/\//i.test(urlFoto)) {
    return urlFoto;
  }
  return `${URL_BASE_TINKAY}${urlFoto.startsWith('/') ? '' : '/'}${urlFoto}`;
}

export async function generarMetadataEcommerceTinkay(opciones: {
  categoriaSlug?: string;
  productoSlug?: string;
  varianteSku?: string;
}): Promise<Metadata> {
  const tituloBase = 'Tinkay — Flores y Eventos en Quito y Valles';
  const descripcionBase =
    'Arreglos florales, box de rosas de exportación, bouquets estilo coreano y decoración para eventos y bodas en Quito y Valles.';

  try {
    if (!opciones.categoriaSlug && !opciones.productoSlug) {
      return {
        title: tituloBase,
        description: descripcionBase,
        openGraph: {
          title: tituloBase,
          description: descripcionBase,
          type: 'website',
          images: [normalizarUrlImagenAbsoluta('/img/logo/tinkay-tienda-neon.jpg')],
        },
      };
    }

    const { productos, categorias } = await cargarCatalogoDinamicoTinkay();

    if (opciones.productoSlug) {
      const prod = resolverProductoPorIdentificador(
        opciones.productoSlug,
        productos,
        opciones.varianteSku
      );
      if (prod) {
        const varActiva = obtenerVarianteActivaProducto(prod);
        const nombreMostrar = varActiva
          ? obtenerNombreProductoIndividual(prod.nombreBase || prod.nombre, varActiva.nombre)
          : prod.nombre;
        const precioTxt = varActiva ? ` — $${varActiva.pvp.toFixed(2)}` : '';
        const tituloProd = `${nombreMostrar}${precioTxt} | Tinkay Flores y Eventos`;
        const descProd =
          prod.descripcionCorta ||
          prod.descripcionLarga ||
          descripcionBase;
        const fotoPrincipal = normalizarUrlImagenAbsoluta(
          varActiva?.foto || varActiva?.fotos?.[0] || prod.fotos[0]
        );

        return {
          title: tituloProd,
          description: descProd,
          openGraph: {
            title: tituloProd,
            description: descProd,
            type: 'website',
            images: [fotoPrincipal],
          },
          twitter: {
            card: 'summary_large_image',
            title: tituloProd,
            description: descProd,
            images: [fotoPrincipal],
          },
        };
      }
    }

    if (opciones.categoriaSlug) {
      const catId = resolverCategoriaPorIdentificador(opciones.categoriaSlug, categorias);
      const catObj = categorias.find((c) => c.id === catId || c.slug === catId);
      if (catObj && catObj.id !== 'cat-todos') {
        const primerProdCat = productos.find((p) =>
          productoCoincideConCategoria(p, catObj.id, categorias)
        );
        const tituloCat = `${catObj.nombre} | Tinkay Flores y Eventos`;
        const descCat =
          catObj.descripcion ||
          `Explora nuestra colección de ${catObj.nombre} en Tinkay Flores y Eventos.`;
        const fotoCat = normalizarUrlImagenAbsoluta(primerProdCat?.fotos?.[0]);

        return {
          title: tituloCat,
          description: descCat,
          openGraph: {
            title: tituloCat,
            description: descCat,
            type: 'website',
            images: [fotoCat],
          },
          twitter: {
            card: 'summary_large_image',
            title: tituloCat,
            description: descCat,
            images: [fotoCat],
          },
        };
      }
    }
  } catch {
    // Fallback seguro si falla la consulta en build/edge
  }

  return {
    title: tituloBase,
    description: descripcionBase,
  };
}

