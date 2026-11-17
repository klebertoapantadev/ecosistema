import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ChatEquipoInterno, obtenerSalaChatEquipoAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Chat del Equipo — Comunicación Interna — Tinkay",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaChatEquipoTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.esPersonalTienda || !ctx.clavesAutorizadas.has("chat_equipo")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof obtenerSalaChatEquipoAction>> | null = null;
  try {
    res = await obtenerSalaChatEquipoAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <div
      style={{
        maxWidth: "1260px",
        margin: "0 auto",
        display: "flex",
        flexDirection: "column",
        gap: "14px",
      }}
    >
      <div>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 4px 0", color: "#111827" }}>
          Chat de Trabajo del Equipo — Floristería Tinkay
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Conversación interna en vivo entre Ventas, Taller, Delivery y Administración. Usa{" "}
          <strong>@nombre</strong> (ej. <code>@kleber</code>) o <code>@taller</code> /{" "}
          <code>@delivery</code> para consultar disponibilidad, compartir fotos y reenviar arreglos.
        </p>
      </div>

      <ChatEquipoInterno negocio={NEGOCIO} datosIniciales={res?.ok ? res.datos : null} />
    </div>
  );
}
