import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaVentasOmnicanal, obtenerTableroOmnicanalAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Ventas y Monitoreo de Chat Web — Tinkay Floristería",
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
          Monitorea en vivo las conversaciones del Chat Web de la tienda, interviene como asesor
          humano o delega a Mía (ARIA), aplica etiquetas y mensajes predeterminados (<code>/atajos</code>),
          y vincula cada cliente con sus compras y proformas web (registrados e invitados).
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
