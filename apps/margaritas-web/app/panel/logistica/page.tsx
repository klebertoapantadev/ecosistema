import type { Metadata } from "next";
import { obtenerConfiguracionLogisticaAction } from "@eco/comercio";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = {
  title: "Envíos, Zonas y Tarifas — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaConfiguracionLogisticaMargaritas() {
  const [configuracion, smtp, aria, logistica] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
    obtenerConfiguracionLogisticaAction(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="Margaritas Floristería"
      seccionInicial="logistica"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      logistica={logistica}
    />
  );
}

