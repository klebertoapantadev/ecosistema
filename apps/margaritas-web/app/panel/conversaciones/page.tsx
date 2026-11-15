import type { Metadata } from "next";
import { ConsolaVentasOmnicanal, obtenerTableroOmnicanalAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Ventas Omnicanal y Chats en Vivo — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaConversacionesMargaritas() {
  const res = await obtenerTableroOmnicanalAction(NEGOCIO);

  return (
    <div
      style={{
        maxWidth: "1440px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "16px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
          Centro de Ventas y Monitoreo de Chat Web
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Monitoreo multi-vendedor en tiempo real: Chat Web en vivo, trazabilidad IA (ARIA) vs
          humano, etiquetas, mensajes predeterminados, usuarios registrados y compras web.
        </p>
      </div>

      <ConsolaVentasOmnicanal
        negocio={NEGOCIO}
        datosIniciales={res.ok ? res.datos : undefined}
      />
    </div>
  );
}
