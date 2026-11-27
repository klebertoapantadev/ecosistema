import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import {
  ProveedorMarketingMeta,
  obtenerConfiguracionMarketingPublicaAction,
} from "@eco/comercio";
import "./globals.css";
import "./tema-oscuro.generado.css";
import { GestorPwaCliente } from "./componentes/GestorPwaCliente";

// Inter: tipografía del brandbook de tranqi (antes Archivo). Va en el repo
// (TRQ-030) y no por next/font/google: en Vercel la descarga de Google falló
// dos veces y tumbó el build de producción. Es la variable (100–900) con el
// subconjunto latin que servía Google, el mismo que se usaba. Licencia OFL.
const inter = localFont({
  src: "./fuentes/inter-variable-latin.woff2",
  weight: "100 900",
  style: "normal",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "var(--ct-5000ba, #5000BA)",
  width: "device-width",
  initialScale: 1,
};

export async function generateMetadata(): Promise<Metadata> {
  const mkm = await obtenerConfiguracionMarketingPublicaAction("tranqi").catch(() => null);
  return {
    title: "Tranqi — Lo legal, para todos",
    description:
      "Plataforma digital de protección jurídica continua, agendamiento legal con ARIA y billetera de documentos.",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Tranqi",
    },
    icons: {
      icon: [
        { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
        { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
      ],
      apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
    },
    ...(mkm?.dominioVerificacion
      ? { other: { "facebook-domain-verification": mkm.dominioVerificacion } }
      : {}),
  };
}

const SCRIPT_TEMA = `(function(){var t;try{t=localStorage.getItem("tranqi-tema")}catch(e){}document.documentElement.dataset.tema=t==="claro"||t==="oscuro"?t:"sistema"})()`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    // suppressHydrationWarning: el script de abajo pone data-tema en <html>
    // antes de que React hidrate, y ese atributo no viene del servidor.
    <html lang="es" suppressHydrationWarning>
      <head>
        {/* TRQ-040: tema del panel ANTES de pintar (si no, quien eligió oscuro
            vería un fogonazo claro en cada carga). Solo tiene efecto dentro
            del panel: ver «Tema oscuro» en globals.css. */}
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_TEMA }} />
      </head>
      <body className={inter.className}>
        <ProveedorMarketingMeta negocio="tranqi" />
        {children}
        <GestorPwaCliente />
      </body>
    </html>
  );
}
