import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConsolaInventarioRosas, obtenerInventarioRosasAction } from "@eco/comercio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = {
  title: "Inventario de Rosas (IA) — Tinkay Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaInventarioRosasTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("inventario_rosas")) {
    redirect("/panel");
  }

  let res: Awaited<ReturnType<typeof obtenerInventarioRosasAction>> | null = null;
  try {
    res = await obtenerInventarioRosasAction(NEGOCIO);
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
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: 0, color: "#111827" }}>
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
