import type { Metadata, Viewport } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
  title: "tinkay — Flores y Eventos",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Tinkay",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es" className={`${fraunces.variable} ${inter.variable}`}>
      <body>{children}</body>
    </html>
  );
}
