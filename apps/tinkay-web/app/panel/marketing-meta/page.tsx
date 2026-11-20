import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerConfiguracionLogisticaAction } from "@eco/comercio";
import {
  ConsolaConfiguracionUnificada,
  obtenerAriaNegocio,
  obtenerConfiguracionNegocio,
  obtenerMarketingMetaNegocio,
  obtenerSmtpNegocio,
} from "@eco/configuracion-negocio";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = { title: "Marketing & Meta — Tinkay Floristería" };
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaMarketingMetaTinkay() {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("configuracion_marketing_meta")) {
    redirect("/panel");
  }
  const [configuracion, smtp, aria, marketingMeta, logistica] = await Promise.all([
    obtenerConfiguracionNegocio(NEGOCIO),
    obtenerSmtpNegocio(NEGOCIO),
    obtenerAriaNegocio(NEGOCIO),
    obtenerMarketingMetaNegocio(NEGOCIO),
    obtenerConfiguracionLogisticaAction(NEGOCIO),
  ]);

  return (
    <ConsolaConfiguracionUnificada
      negocio={NEGOCIO}
      nombreNegocioVisible="Tinkay Floristería"
      seccionInicial="marketing_meta"
      configuracion={configuracion}
      smtp={smtp}
      aria={aria}
      marketingMeta={marketingMeta}
      logistica={logistica}
    />
  );
}
