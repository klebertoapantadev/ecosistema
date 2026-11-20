import type { Metadata } from "next";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerMarketingMetaNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";

export const metadata: Metadata = { title: "Marketing & Meta — FastFix Home" };
export const dynamic = "force-dynamic";

const NEGOCIO = "fastfix";

export default async function PaginaMarketingMetaFastFix() {
  const [configuracion, smtp, aria, marketingMeta] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
    obtenerMarketingMetaNegocio(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="FastFix Home"
      seccionInicial="marketing_meta"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      marketingMeta={marketingMeta}
    />
  );
}
