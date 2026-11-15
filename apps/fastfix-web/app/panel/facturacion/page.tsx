import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetFacturacionElectronica } from "@eco/comercio";
import { obtenerPerfilActual } from "@eco/identidad";

export const metadata: Metadata = {
  title: "Facturación Electrónica y Pagos — FastFix Home",
};
export const dynamic = "force-dynamic";

export default async function PaginaFacturacionFastFix() {
  const perfil = await obtenerPerfilActual("fastfix");
  if (!perfil) redirect("/ingresar");

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <WidgetFacturacionElectronica negocio="fastfix" />
    </div>
  );
}
