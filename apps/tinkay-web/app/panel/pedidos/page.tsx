import type { Metadata } from "next";
import { BandejaPedidosTienda, obtenerPedidosTiendaAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Pedidos de Tienda y Despachos — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaPedidosTinkay() {
  const res = await obtenerPedidosTiendaAction(NEGOCIO);

  return (
    <div
      style={{
        maxWidth: "1180px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "20px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
          Pedidos de la Tienda y Auditoría Logística
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Órdenes registradas desde la tienda e-commerce con enlace GPS directo, dedicatorias y el
          detalle interno del cálculo de envío (oculto al cliente).
        </p>
      </div>

      <BandejaPedidosTienda
        negocio={NEGOCIO}
        pedidosIniciales={res.ok ? res.pedidos : undefined}
      />
    </div>
  );
}

