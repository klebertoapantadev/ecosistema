import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { WidgetFacturacionElectronica } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Facturación Electrónica SRI y Cobros — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaFacturacionTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.perfil) redirect("/ingresar");

  const esOperadorOAdmin =
    ctx.esAdminTienda ||
    ctx.rolPrincipal === "OPERADOR" ||
    ctx.rolPrincipal === "VENTAS";

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto" }}>
      <WidgetFacturacionElectronica
        negocio={NEGOCIO}
        modoVistaForzado={esOperadorOAdmin ? "operador" : "cliente"}
      />
    </div>
  );
}
