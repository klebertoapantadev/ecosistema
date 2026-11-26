import type { Metadata } from "next";
import { ConsolaDirectorioContactos } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Contactos y Listas WhatsApp — Tranqi",
};
export const dynamic = "force-dynamic";

export default function PaginaContactosTranqi() {
  return <ConsolaDirectorioContactos negocio="tranqi" />;
}
