import type { Metadata } from "next";
import { ConsolaEntregaInmediata, listarEntregaInmediataAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Entrega Inmediata (1–2h) — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaEntregaInmediataMargaritas() {
  let res: Awaited<ReturnType<typeof listarEntregaInmediataAction>> | null = null;
  try {
    res = await listarEntregaInmediataAction(NEGOCIO, true);
  } catch {
    res = null;
  }

  return (
    <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "10px" }}>
      <h1 style={{ fontSize: "1.06rem", fontWeight: 600, margin: 0, color: "#1F1C19" }}>
        Entrega Inmediata (1–2h)
      </h1>
      <ConsolaEntregaInmediata
        negocio={NEGOCIO}
        itemsIniciales={res?.ok ? res.items : []}
        migracionPendienteInicial={Boolean(res?.ok && res.migracionPendiente)}
      />
    </div>
  );
}
