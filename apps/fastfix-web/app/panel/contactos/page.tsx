import type { Metadata } from "next";
import { ConsolaDirectorioContactos } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Contactos y Listas WhatsApp — FastFix Home",
};
export const dynamic = "force-dynamic";

export default function PaginaContactosFastfix() {
  return <ConsolaDirectorioContactos negocio="fastfix" />;
}
