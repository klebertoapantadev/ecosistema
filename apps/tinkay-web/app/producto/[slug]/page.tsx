import type { Metadata } from 'next';
import { LandingEcommerceTinkay } from '../../../modulos/ecommerce/componentes/LandingEcommerceTinkay';
import { generarMetadataEcommerceTinkay } from '../../../modulos/ecommerce/metadata-ecommerce';

type ParamsPromise = Promise<{ slug: string }>;
type SearchParamsPromise = Promise<Record<string, string | string[] | undefined>>;

function primerParam(val: string | string[] | undefined): string | undefined {
  if (typeof val === 'string') return val;
  if (Array.isArray(val) && val.length > 0) return val[0];
  return undefined;
}

export async function generateMetadata({
  params,
  searchParams,
}: {
  params: ParamsPromise;
  searchParams: SearchParamsPromise;
}): Promise<Metadata> {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const varianteSku = primerParam(sp.variante) || primerParam(sp.sku);
  return generarMetadataEcommerceTinkay({
    productoSlug: decodeURIComponent(slug || ''),
    varianteSku,
  });
}

export default async function PaginaProductoTinkay({
  params,
  searchParams,
}: {
  params: ParamsPromise;
  searchParams: SearchParamsPromise;
}) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const varianteSku = primerParam(sp.variante) || primerParam(sp.sku);
  return (
    <LandingEcommerceTinkay
      productoInicialUrl={decodeURIComponent(slug || '')}
      varianteInicialUrl={varianteSku}
    />
  );
}

