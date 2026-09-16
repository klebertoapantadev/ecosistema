import type { Metadata } from "next";
import { GestionTokensMcpWidget } from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Tokens & Servidor MCP — Margaritas" };

const NEGOCIO = "margaritas";

export default function PaginaTokensMcp() {
  return (
    <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "16px 0" }}>
      <GestionTokensMcpWidget negocio={NEGOCIO} />
    </div>
  );
}
