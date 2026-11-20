import { NextRequest } from "next/server";
import {
  generarFeedXmlCatalogoMetaNegocio,
  generarXmlCatalogoMeta,
  obtenerConfiguracionMarketingPublicaAction,
  type ProductoFeedCatalogoMeta,
} from "@eco/comercio";
import { cargarCatalogoDinamicoTinkay } from "../../../../modulos/ecommerce/servicio-catalogo";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export async function GET(req: NextRequest) {
  const urlBase = (
    req.nextUrl?.origin ||
    process.env.NEXT_PUBLIC_SITE_URL ||
    process.env.NEXT_PUBLIC_APP_URL ||
    "https://tinkay-web.vercel.app"
  ).replace(/\/+$/, "");

  const cfgPub = await obtenerConfiguracionMarketingPublicaAction(NEGOCIO);
  if (!cfgPub.catalogoActivo) {
    const xmlInactivo = generarXmlCatalogoMeta({
      tituloTienda: "Tinkay Flores y Eventos — Catálogo",
      descripcionTienda: "Feed de catálogo desactivado temporalmente",
      urlBaseTienda: urlBase,
      items: [],
    });
    return new Response(xmlInactivo, {
      status: 200,
      headers: {
        "Content-Type": "application/xml; charset=utf-8",
        "Cache-Control": "public, max-age=300, s-maxage=300",
      },
    });
  }

  // Cargar el catálogo vivo unificado de Tinkay (con variantes, fotos y precios combo resueltos)
  try {
    const { productos } = await cargarCatalogoDinamicoTinkay();
    if (Array.isArray(productos) && productos.length > 0) {
      const normalizarImg = (u?: string) => {
        const s = (u || "").trim();
        if (!s) return "";
        return s.startsWith("/") ? `${urlBase}${s}` : s;
      };

      const items: ProductoFeedCatalogoMeta[] = [];
      for (const p of productos) {
        if (p.esExtra) continue;
        const slug = (p.slug || p.id || "").trim();
        if (!slug) continue;
        const fotosProd = (p.fotos || []).map(normalizarImg).filter((u) => /^https?:\/\//i.test(u));

        for (const v of p.variantes || []) {
          const sku = (v.sku || "").trim();
          if (!sku || !(v.pvp > 0)) continue;
          const imgPrincipal =
            normalizarImg(v.foto) || fotosProd[0] || "";
          if (!/^https?:\/\//i.test(imgPrincipal)) continue;

          const galeriaVar = (v.fotos || [])
            .map(normalizarImg)
            .filter((u: string) => /^https?:\/\//i.test(u));
          const tieneDescuento =
            typeof v.precioComparacion === "number" && v.precioComparacion > v.pvp;

          const titulo =
            v.nombre &&
            v.nombre.toLowerCase() !== p.nombre.toLowerCase() &&
            p.variantes.length > 1
              ? `${p.nombre} — ${v.nombre}`
              : p.nombre;

          items.push({
            idVarianteSku: sku,
            idGrupoProducto: slug,
            titulo,
            descripcion: v.detalle || p.descripcionLarga || p.descripcionCorta || titulo,
            enlaceProducto: `${urlBase}/producto/${encodeURIComponent(slug)}?variante=${encodeURIComponent(sku)}`,
            imagenPrincipalUrl: imgPrincipal,
            imagenesAdicionalesUrls: [...galeriaVar, ...fotosProd],
            precioRegularUsd: tieneDescuento ? Number(v.precioComparacion) : v.pvp,
            precioOfertaUsd: tieneDescuento ? v.pvp : null,
            disponibilidad: "in stock",
            marca: "Tinkay Flores y Eventos",
            categoriaTexto: p.categoriaNombre || p.ocasionRecomendada,
          });
        }
      }

      if (items.length > 0) {
        const xml = generarXmlCatalogoMeta({
          tituloTienda: "Tinkay Flores y Eventos — Catálogo Oficial",
          descripcionTienda:
            "Arreglos florales, boxes de lujo, ramos coreanos, condolencias y decoración de eventos en Quito.",
          urlBaseTienda: urlBase,
          items,
        });
        return new Response(xml, {
          status: 200,
          headers: {
            "Content-Type": "application/xml; charset=utf-8",
            "Cache-Control": "public, max-age=900, s-maxage=900",
          },
        });
      }
    }
  } catch {
    // Continuar al generador directo desde comun_comercio
  }

  const res = await generarFeedXmlCatalogoMetaNegocio({
    negocio: NEGOCIO,
    urlBaseTienda: urlBase,
  });

  return new Response(res.xml, {
    status: 200,
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=900, s-maxage=900",
    },
  });
}
