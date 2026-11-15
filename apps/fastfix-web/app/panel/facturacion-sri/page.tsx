import type { Metadata } from "next";
import { obtenerConfiguracionLogisticaAction } from "@eco/comercio";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = {
  title: "Facturación Electrónica SRI — FastFix Home",
};
export const dynamic = "force-dynamic";

const NEGOCIO = "fastfix";

export default async function PaginaFacturacionSriFastFix() {
  const [configuracion, smtp, aria, logistica] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
    obtenerConfiguracionLogisticaAction(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="FastFix Home"
      seccionInicial="facturacion_sri"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      logistica={logistica}
    />
  );
}
