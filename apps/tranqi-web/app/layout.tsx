import type { Metadata, Viewport } from "next";
import { Archivo } from "next/font/google";
import "./globals.css";
import { GestorPwaCliente } from "./componentes/GestorPwaCliente";

const archivo = Archivo({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800", "900"],
});

export const viewport: Viewport = {
  themeColor: "#5000BA",
  width: "device-width",
  initialScale: 1,
};

export const metadata: Metadata = {
  title: "tranqi — Lo legal, para todos",
  description:
    "Plataforma digital de protección jurídica continua, agendamiento legal con ARIA y billetera de documentos.",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "tranqi",
  },
  icons: {
    icon: [
      { url: "/icons/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icons/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={archivo.className}>
        {children}
        <GestorPwaCliente />
      </body>
    </html>
  );
}
