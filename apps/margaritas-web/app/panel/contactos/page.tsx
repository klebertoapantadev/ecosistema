import type { Metadata } from "next";
import { ConsolaDirectorioContactos } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Contactos y Listas WhatsApp — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

export default function PaginaContactosMargaritas() {
  return <ConsolaDirectorioContactos negocio="margaritas" />;
}
