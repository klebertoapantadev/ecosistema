import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ConsolaEnvioPedidosTaller,
  obtenerConsolaTallerYDespachoAction,
} from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Enviar Pedidos a Taller — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaEnvioPedidosTallerTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("envio_pedidos_taller")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof obtenerConsolaTallerYDespachoAction>> | null = null;
  try {
    res = await obtenerConsolaTallerYDespachoAction(NEGOCIO);
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
          Programación y Envío Diario de Pedidos a Taller
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Valida las ventas recibidas, revisa el calendario de entregas (Hoy / Semana / Mes), carga
          pedidos futuros o llamadas urgentes de Exequiales y despáchalos al Taller.
        </p>
      </div>

      <ConsolaEnvioPedidosTaller
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
      />
    </div>
  );
}
