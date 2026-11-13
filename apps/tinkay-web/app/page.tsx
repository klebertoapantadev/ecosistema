import type { Metadata } from 'next';
import { LandingEcommerceTinkay } from '../modulos/ecommerce/componentes/LandingEcommerceTinkay';
import { generarMetadataEcommerceTinkay } from '../modulos/ecommerce/metadata-ecommerce';

type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

function primerParam(val: string | string[] | undefined): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return val[0];
  return undefined;
}

export async function generateMetadata({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}): Promise<Metadata> {
  const sp = await searchParams;
  const productoSlug = primerParam(sp.producto) || primerParam(sp.prod) || primerParam(sp.arreglo);
  const categoriaSlug = primerParam(sp.categoria) || primerParam(sp.cat) || primerParam(sp.coleccion);
  const varianteSku = primerParam(sp.variante) || primerParam(sp.sku);

  return generarMetadataEcommerceTinkay({
    categoriaSlug,
    productoSlug,
    varianteSku,
  });
}

export default async function PaginaEcommerceTinkay({
  searchParams,
}: {
  searchParams: SearchParamsPromise;
}) {
  const sp = await searchParams;
  const productoInicialUrl =
    primerParam(sp.producto) || primerParam(sp.prod) || primerParam(sp.arreglo);
  const categoriaInicialUrl =
    primerParam(sp.categoria) || primerParam(sp.cat) || primerParam(sp.coleccion);
  const varianteInicialUrl = primerParam(sp.variante) || primerParam(sp.sku);

  return (
    <LandingEcommerceTinkay
      categoriaInicialUrl={categoriaInicialUrl}
      productoInicialUrl={productoInicialUrl}
      varianteInicialUrl={varianteInicialUrl}
    />
  );
}
