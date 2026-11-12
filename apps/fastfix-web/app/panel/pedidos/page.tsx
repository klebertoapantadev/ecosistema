import type { Metadata } from "next";
import { BandejaPedidosTienda, obtenerPedidosTiendaAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Órdenes y Despachos — FastFix Home",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "fastfix";

export default async function PaginaPedidosFastFix() {
  const res = await obtenerPedidosTiendaAction(NEGOCIO);

  return (
    <div style={{ maxWidth: "1180px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "20px" }}>
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
          Órdenes y Despachos
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280" }}>
          Solicitudes y pedidos registrados con ubicación GPS y detalle interno de transporte.
        </p>
      </div>
      <BandejaPedidosTienda
        negocio={NEGOCIO}
        pedidosIniciales={res.ok ? res.pedidos : undefined}
      />
    </div>
  );
}

