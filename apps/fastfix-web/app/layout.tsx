import type { Metadata } from "next";
import {
  ProveedorMarketingMeta,
  obtenerConfiguracionMarketingPublicaAction,
} from "@eco/comercio";
import "@eco/identidad/estilos-base.css";
import "./globals.css";

export async function generateMetadata(): Promise<Metadata> {
  const mkm = await obtenerConfiguracionMarketingPublicaAction("fastfix").catch(() => null);
  return {
    title: "FastFix Home — Próximamente",
    ...(mkm?.dominioVerificacion
      ? { other: { "facebook-domain-verification": mkm.dominioVerificacion } }
      : {}),
  };
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <ProveedorMarketingMeta negocio="fastfix" />
        {children}
      </body>
    </html>
  );
}
