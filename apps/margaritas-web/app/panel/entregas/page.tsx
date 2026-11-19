import type { Metadata } from "next";
import { ConsolaConfirmacionEntregas, obtenerTableroEntregasAction } from "@eco/comercio";

export const metadata: Metadata = {
  title: "Confirmación de Entregas — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaConfirmacionEntregasMargaritas() {
  let res: Awaited<ReturnType<typeof obtenerTableroEntregasAction>> | null = null;
  try {
    res = await obtenerTableroEntregasAction(NEGOCIO);
  } catch {
    res = null;
  }

  return (
    <div style={{ maxWidth: "1360px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "16px" }}>
      <div>
        <h1 style={{ fontSize: "1.12rem", fontWeight: 600, margin: "0 0 4px 0", color: "#1F1C19" }}>
          Confirmación de Entregas e Informes Georreferenciados
        </h1>
      </div>
      <ConsolaConfirmacionEntregas
        negocio={NEGOCIO}
        datosIniciales={res?.ok ? res.datos : null}
      />
    </div>
  );
}
