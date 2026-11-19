import type { Metadata } from "next";
import {
  ConsolaEnvioPedidosTaller,
  obtenerConsolaTallerYDespachoAction,
} from "@eco/comercio";

export const metadata: Metadata = {
  title: "Enviar Pedidos a Taller — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaEnvioPedidosMargaritas() {
  let res: Awaited<ReturnType<typeof obtenerConsolaTallerYDespachoAction>> | null = null;
  try {
    res = await obtenerConsolaTallerYDespachoAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          Programación y Envío Diario de Pedidos a Taller
        </h1>
      </div>
      <ConsolaEnvioPedidosTaller
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
      />
    </div>
  );
}
