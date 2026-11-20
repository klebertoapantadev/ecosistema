import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  EditorTarjetaPublicoCliente,
  obtenerTarjetaParaEdicionAction,
} from "@eco/comercio";

export const dynamic = "force-dynamic";

interface PropsPage {
  params: Promise<{ token: string }>;
}

export const metadata: Metadata = {
  title: "Personaliza tu Tarjeta — Margaritas Floristería",
  description:
    "Visualiza tu tarjeta en díptico 3D y personaliza destinatario, mensaje, firma, imágenes, música y modo de impresión.",
  robots: { index: false, follow: false },
};

export default async function TarjetaEditarPage({ params }: PropsPage) {
  const { token } = await params;
  const res = await obtenerTarjetaParaEdicionAction(token);

  if (!res.ok || !res.tarjeta) {
    return (
      <div
        style={{
          minHeight: "100vh",
          backgroundColor: "#0F172A",
          color: "#FFFFFF",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          padding: "24px",
          textAlign: "center",
          fontFamily: "'Inter', sans-serif",
        }}
      >
        <span style={{ fontSize: "2.8rem", marginBottom: "12px" }}>🔒</span>
        <h1 style={{ fontSize: "1.35rem", fontWeight: 700, margin: "0 0 8px 0" }}>
          Enlace de edición no válido o inactivo
        </h1>
        <p style={{ color: "#94A3B8", maxWidth: "430px", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
          {res.error || "Solicita el enlace exclusivo de edición de tu pedido a nuestro equipo."}
        </p>
        <Link
          href="/"
          style={{
            padding: "10px 20px",
            borderRadius: "999px",
            backgroundColor: "#0284C7",
            color: "#FFFFFF",
            textDecoration: "none",
            fontSize: "0.85rem",
            fontWeight: 600,
          }}
        >
          Ir a Margaritas
        </Link>
      </div>
    );
  }

  return <EditorTarjetaPublicoCliente datosIniciales={res.tarjeta} tokenEdicion={token} />;
}
