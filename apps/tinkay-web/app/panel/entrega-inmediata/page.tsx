import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaEntregaInmediata, listarEntregaInmediataAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Galería de Entrega Inmediata (1–2h) — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaEntregaInmediataTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("galeria_inmediata")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof listarEntregaInmediataAction>> | null = null;
  try {
    res = await listarEntregaInmediataAction(NEGOCIO, true);
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
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          Galería de Disponibles para Entrega Inmediata (1 a 2 Horas)
        </h1>
        <p style={{ margin: 0, fontSize: "0.8rem", color: "#6E6861", lineHeight: 1.5 }}>
          Fotografía los arreglos conforme se elaboran en tienda con su precio especial de vitrina.
          Se muestran al instante en Web y Chat, y se descartan automáticamente si se venden online.
        </p>
      </div>

      <ConsolaEntregaInmediata
        negocio={NEGOCIO}
        itemsIniciales={res?.ok ? res.items : []}
        migracionPendienteInicial={Boolean(res?.ok && res.migracionPendiente)}
        endpointEstudioIa="/api/entrega-inmediata/generar-fotos"
      />
    </div>
  );
}
