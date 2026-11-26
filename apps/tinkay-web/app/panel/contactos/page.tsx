import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaDirectorioContactos } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Contactos y Listas WhatsApp — Tinkay",
};
export const dynamic = "force-dynamic";

export default async function PaginaContactosTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("directorio_contactos") && !ctx.clavesAutorizadas.has("consola_chat")) {
    redirect("/panel");
  }

  return <ConsolaDirectorioContactos negocio="tinkay" />;
}
