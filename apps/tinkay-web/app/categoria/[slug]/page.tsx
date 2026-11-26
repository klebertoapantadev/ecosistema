import type { Metadata } from 'next';
import { LandingEcommerceTinkay } from '../../../modulos/ecommerce/componentes/LandingEcommerceTinkay';
import { generarMetadataEcommerceTinkay } from '../../../modulos/ecommerce/metadata-ecommerce';
import {
  cargarCatalogoDinamicoTinkay,
  cargarColoresInventarioTinkay,
} from '../../../modulos/ecommerce/servicio-catalogo';

export const dynamic = 'force-dynamic';

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
  const [{ slug }, catalogoInicial, inventarioColoresInicial] = await Promise.all([
    params,
    cargarCatalogoDinamicoTinkay(),
    cargarColoresInventarioTinkay(),
  ]);
  return (
    <LandingEcommerceTinkay
      categoriaInicialUrl={decodeURIComponent(slug || '')}
      productosIniciales={catalogoInicial.productos}
      categoriasIniciales={catalogoInicial.categorias}
      inventarioColoresInicial={inventarioColoresInicial}
    />
  );
}

