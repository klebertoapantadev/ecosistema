import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { PantallaTvTaller, obtenerTableroTvTallerAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../../acceso-tinkay";

export const metadata: Metadata = {
  title: "Pantalla Smart TV Taller & Eventos — Tinkay",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaPantallaTvTallerTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("taller_floral")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof obtenerTableroTvTallerAction>> | null = null;
  try {
    res = await obtenerTableroTvTallerAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <PantallaTvTaller
      negocio={NEGOCIO}
      nombreNegocio="Tinkay Floristería"
      colorMarca="#0D9488"
      datosIniciales={res?.ok ? res.datos : null}
    />
  );
}
