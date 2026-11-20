import type { Metadata } from "next";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerMarketingMetaNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Marketing & Meta — Margaritas Floristería" };
export const dynamic = "force-dynamic";

const NEGOCIO = "margaritas";

export default async function PaginaMarketingMetaMargaritas() {
  const [configuracion, smtp, aria, marketingMeta] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
    obtenerMarketingMetaNegocio(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="Margaritas Floristería"
      seccionInicial="marketing_meta"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      marketingMeta={marketingMeta}
    />
  );
}
