import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaConfirmacionEntregas, obtenerTableroEntregasAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Confirmación de Entregas e Informes Quincenales — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaConfirmacionEntregasTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("confirmacion_entregas")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof obtenerTableroEntregasAction>> | null = null;
  try {
    res = await obtenerTableroEntregasAction(NEGOCIO);
  } catch {
    res = null;
  }

  const esRolDelivery =
    ctx.rolPrincipal === "DELIVERY" || ctx.rolPrincipal === "DELIVERY_EXTERNO";

  return (
    <div
      style={{
        maxWidth: "1360px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          {esRolDelivery
            ? "Mis Entregas Pendientes y Confirmación GPS"
            : "Confirmación de Entregas GPS, Exequiales IESS e Informes Quincenales"}
        </h1>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#6E6861", lineHeight: 1.5 }}>
          {ctx.rolPrincipal === "DELIVERY_EXTERNO"
            ? "Consulta los pedidos asignados a tu cuenta, comparte tu ubicación mientras estás en ruta y confirma cada entrega con fotografía GPS."
            : esRolDelivery
              ? "Consulta los pedidos listos o asignados, activa Iniciar Ruta cuando salgas a entregar y confirma con fotografía georreferenciada (incluso sin internet)."
              : "Captura fotográfica georreferenciada (incluso sin internet), órdenes de trabajo directas de Exequiales del IESS, confirmación del resto de pedidos y emisión de informes PDF."}
        </p>
      </div>

      <ConsolaConfirmacionEntregas
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
        modoRolDelivery={
          ctx.rolPrincipal === "DELIVERY" || ctx.rolPrincipal === "DELIVERY_EXTERNO"
            ? ctx.rolPrincipal
            : null
        }
      />
    </div>
  );
}
