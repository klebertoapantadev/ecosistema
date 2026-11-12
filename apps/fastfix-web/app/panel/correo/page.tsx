import type { Metadata } from "next";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Servidor de Correo — FastFix Home" };
export const dynamic = "force-dynamic";

const NEGOCIO = "fastfix";

export default async function PaginaServidorCorreo() {
  const [configuracion, smtp, aria] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="FastFix Home"
      seccionInicial="correo"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
    />
  );
}
