import type { Metadata } from "next";
import { PantallaTvTaller, obtenerTableroTvTallerAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Pantalla Smart TV Taller & Eventos — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaPantallaTvTallerMargaritas() {
  let res: Awaited<ReturnType<typeof obtenerTableroTvTallerAction>> | null = null;
  try {
    res = await obtenerTableroTvTallerAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <PantallaTvTaller
      negocio={NEGOCIO}
      nombreNegocio="Margaritas Floristería"
      colorMarca="#BE185D"
      datosIniciales={res?.ok ? res.datos : null}
    />
  );
}
