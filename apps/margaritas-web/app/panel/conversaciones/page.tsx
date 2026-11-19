import type { Metadata } from "next";
import { ConsolaVentasOmnicanal, obtenerTableroOmnicanalAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Ventas Omnicanal y Chats en Vivo — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaConversacionesMargaritas() {
  let datosIniciales: Awaited<ReturnType<typeof obtenerTableroOmnicanalAction>> | null = null;
  let errorCargaSSR: string | null = null;
  try {
    datosIniciales = await obtenerTableroOmnicanalAction(NEGOCIO);
    if (!datosIniciales.ok) {
      errorCargaSSR = datosIniciales.error;
    }
  } catch (err) {
    errorCargaSSR =
      err instanceof Error
        ? err.message
        : "Error temporal al pre-cargar conversaciones en el servidor.";
  }

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
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          Centro de Ventas y Monitoreo de Chat Web
        </h1>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#6E6861", lineHeight: 1.5 }}>
          Monitoreo multi-vendedor en tiempo real: Chat Web en vivo, trazabilidad IA (ARIA) vs
          humano, etiquetas, mensajes predeterminados, usuarios registrados y compras web.
        </p>
      </div>

      <ConsolaVentasOmnicanal
        negocio={NEGOCIO}
        datosIniciales={datosIniciales?.ok ? datosIniciales.datos : undefined}
        errorInicial={errorCargaSSR}
      />
    </div>
  );
}
