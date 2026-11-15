import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetFacturacionElectronica } from "@eco/comercio";
import { obtenerPerfilActual } from "@eco/identidad";

export const metadata: Metadata = {
  title: "Facturación Electrónica y Pagos — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

export default async function PaginaFacturacionMargaritas() {
  const perfil = await obtenerPerfilActual("margaritas");
  if (!perfil) redirect("/ingresar");

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <WidgetFacturacionElectronica negocio="margaritas" />
    </div>
  );
}
