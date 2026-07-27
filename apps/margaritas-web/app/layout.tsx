import type { Metadata } from "next";
import "@eco/identidad/estilos-base.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Margaritas Floristería — Próximamente",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>{children}</body>
    </html>
  );
}
