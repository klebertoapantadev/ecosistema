import type { Metadata } from "next";
import { PantallaTvTaller, obtenerTableroTvTallerAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "TV Taller & Showroom Eventos — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaTvKioscoMargaritas({
  searchParams,
}: {
  searchParams: Promise<{ key?: string; token?: string }>;
}) {
  const sp = await searchParams;
  const token = (sp?.key || sp?.token || "").trim() || null;

  let res: Awaited<ReturnType<typeof obtenerTableroTvTallerAction>> | null = null;
  try {
    res = await obtenerTableroTvTallerAction(NEGOCIO, token);
  } catch {
    res = null;
  }

  return (
    <PantallaTvTaller
      negocio={NEGOCIO}
      nombreNegocio="Margaritas Floristería"
      colorMarca="#BE185D"
      tokenKiosco={token}
      datosIniciales={res?.ok ? res.datos : null}
    />
  );
}
