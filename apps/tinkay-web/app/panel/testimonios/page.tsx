import type { Metadata } from "next";
import { ConsolaTestimoniosClientes } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Testimonios y Reseñas de Clientes — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaTestimoniosTinkay() {
  return <ConsolaTestimoniosClientes negocio={NEGOCIO} />;
}
