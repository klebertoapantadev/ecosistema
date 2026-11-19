import type { Metadata } from "next";
import { ConsolaInventarioRosas, obtenerInventarioRosasAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Inventario de Rosas (IA) — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaInventarioRosasMargaritas() {
  let res: Awaited<ReturnType<typeof obtenerInventarioRosasAction>> | null = null;
  try {
    res = await obtenerInventarioRosasAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          Inventario de Rosas con Conteo IA (ARIA)
        </h1>
      </div>
      <ConsolaInventarioRosas
        negocio={NEGOCIO}
        ultimoCorteInicial={res?.ok ? res.ultimoCorte : null}
        historialInicial={res?.ok ? res.historial : []}
        migracionPendienteInicial={Boolean(res?.ok && res.migracionPendiente)}
      />
    </div>
  );
}
