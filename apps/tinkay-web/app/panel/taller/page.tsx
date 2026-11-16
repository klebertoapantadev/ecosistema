import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  ConsolaTallerFloral,
  obtenerConsolaTallerYDespachoAction,
} from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Taller Floral — Producción y Elaboración — Tinkay",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaTallerFloralTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("taller_floral")) {
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
          Taller — Producción y Elaboración de Arreglos
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B7280", lineHeight: 1.5 }}>
          Recibe notificaciones en vivo de nuevos pedidos, consulta el calendario de elaboración de
          hoy y entregas futuras, y marca cada arreglo En Preparación o Listo para Entrega.
        </p>
      </div>

      <ConsolaTallerFloral
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
      />
    </div>
  );
}
