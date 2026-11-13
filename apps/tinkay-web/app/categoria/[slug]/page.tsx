import type { Metadata } from 'next';
import { LandingEcommerceTinkay } from '../../../modulos/ecommerce/componentes/LandingEcommerceTinkay';
import { generarMetadataEcommerceTinkay } from '../../../modulos/ecommerce/metadata-ecommerce';

type ParamsPromise = Promise<{ slug: string }>;

export async function generateMetadata({
  params,
}: {
  params: ParamsPromise;
}): Promise<Metadata> {
  const { slug } = await params;
  return generarMetadataEcommerceTinkay({
    categoriaSlug: decodeURIComponent(slug || ''),
  });
}

export default async function PaginaCategoriaTinkay({
  params,
}: {
  params: ParamsPromise;
}) {
  const { slug } = await params;
  return <LandingEcommerceTinkay categoriaInicialUrl={decodeURIComponent(slug || '')} />;
}

