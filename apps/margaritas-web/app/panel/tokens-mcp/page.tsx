import type { Metadata } from "next";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Tokens & Servidor MCP — Margaritas Floristería" };
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaTokensMcp() {
  const [configuracion, smtp, aria] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="Margaritas Floristería"
      seccionInicial="tokens"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
    />
  );
}
