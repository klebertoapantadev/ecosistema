import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
import {
  ProveedorMarketingMeta,
  obtenerConfiguracionMarketingPublicaAction,
} from "@eco/comercio";
import { SplashAnimadoTinkay } from "../componentes/SplashAnimadoTinkay";
import "./globals.css";

// Fuentes locales dentro del repo (evita fallos de descarga de Google Fonts en Vercel)
const fraunces = localFont({
  src: [
    {
      path: "./fuentes/fraunces-variable-latin.woff2",
      weight: "500 600",
      style: "normal",
    },
    {
      path: "./fuentes/fraunces-italic-variable-latin.woff2",
      weight: "500 600",
      style: "italic",
    },
  ],
  variable: "--font-fraunces",
  display: "swap",
});

const inter = localFont({
  src: "./fuentes/inter-variable-latin.woff2",
  weight: "100 900",
  style: "normal",
  variable: "--font-inter",
  display: "swap",
});

export const viewport: Viewport = {
  themeColor: "#1B2E22",
};

export async function generateMetadata(): Promise<Metadata> {
  const mkm = await obtenerConfiguracionMarketingPublicaAction("tinkay").catch(() => null);
  return {
    title: "tinkay — Flores y Eventos",
    manifest: "/manifest.webmanifest",
    appleWebApp: {
      capable: true,
      statusBarStyle: "black-translucent",
      title: "Tinkay",
    },
    icons: {
      icon: "/icons/icon-192.png?v=3",
      apple: "/icons/apple-touch-icon.png?v=3",
    },
    ...(mkm?.dominioVerificacion
      ? {
          other: {
            "facebook-domain-verification": mkm.dominioVerificacion,
          },
        }
      : {}),
  };
}

const SCRIPT_SPLASH_SIN_PARPADEO = `(function(){try{var s=(window.matchMedia&&(window.matchMedia('(display-mode: standalone)').matches||window.matchMedia('(display-mode: fullscreen)').matches))||window.navigator.standalone===true;var p=/[?&]splash=1(?:&|$)/.test(window.location.search);if((s&&window.sessionStorage.getItem('tinkay_pwa_splash_v3')!=='1')||p){window.__tinkaySplashInicioMs=Date.now();document.documentElement.classList.add('tinkay-splash-activo');window.setTimeout(function(){document.documentElement.classList.remove('tinkay-splash-activo');},4500);}}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: SCRIPT_SPLASH_SIN_PARPADEO }} />
      </head>
      <body>
        <SplashAnimadoTinkay />
        <ProveedorMarketingMeta negocio="tinkay" />
        {children}
      </body>
    </html>
  );
}
