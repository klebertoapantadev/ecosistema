import type { Metadata } from "next";
import { obtenerConfiguracionLogisticaAction } from "@eco/comercio";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = {
  title: "Facturación Electrónica SRI — Margaritas Floristería",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaFacturacionSriMargaritas() {
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
      seccionInicial="facturacion_sri"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      logistica={logistica}
    />
  );
}
