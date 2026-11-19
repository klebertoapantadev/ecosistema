import type { Metadata } from "next";
import { PantallaTvTaller, obtenerTableroTvTallerAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "TV Taller & Showroom Eventos — Tinkay",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaTvKioscoTinkay({
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
      nombreNegocio="Tinkay Floristería"
      colorMarca="#0D9488"
      tokenKiosco={token}
      datosIniciales={res?.ok ? res.datos : null}
    />
  );
}
