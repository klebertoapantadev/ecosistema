import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaTestimoniosClientes } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Testimonios y Reseñas de Clientes — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaTestimoniosTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("testimonios_clientes")) {
    redirect("/panel");
  }

  return <ConsolaTestimoniosClientes negocio={NEGOCIO} />;
}
