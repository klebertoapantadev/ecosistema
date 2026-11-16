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
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
          Confirmación de Entregas GPS, Exequiales IESS e Informes Quincenales
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Captura fotográfica georreferenciada (incluso sin internet), órdenes de trabajo directas
          de Exequiales del IESS, confirmación del resto de pedidos y emisión de informes PDF.
        </p>
      </div>

      <ConsolaConfirmacionEntregas
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
      />
    </div>
  );
}
