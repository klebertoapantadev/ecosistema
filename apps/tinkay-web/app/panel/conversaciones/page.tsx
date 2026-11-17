import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaVentasOmnicanal, obtenerTableroOmnicanalAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Ventas Omnicanal — WhatsApp (YCloud) y Chat Web — Tinkay",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaConversacionesOmnicanalTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("consola_chat")) {
    redirect("/panel");
  }

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
        width: "100%",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
      }}
    >
      <div
        className="ocultar-en-movil"
        style={{
          display: "flex",
          alignItems: "baseline",
          justifyContent: "space-between",
          gap: "12px",
          flexWrap: "wrap",
        }}
      >
        <h1
          style={{
            fontSize: "1.18rem",
            fontWeight: 700,
            margin: 0,
            color: "#221D1A",
            letterSpacing: "-0.01em",
          }}
        >
          Ventas y Chats en Vivo
        </h1>
        <span style={{ fontSize: "0.78rem", color: "rgba(34, 29, 26, 0.58)" }}>
          WhatsApp (YCloud) · Chat Web · Chat del Equipo · Supervisión Mía (ARIA)
        </span>
      </div>

      <ConsolaVentasOmnicanal
        negocio={NEGOCIO}
        datosIniciales={datosIniciales?.ok ? datosIniciales.datos : undefined}
        errorInicial={errorCargaSSR}
      />
    </div>
  );
}
