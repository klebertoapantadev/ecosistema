import React from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { obtenerTarjetaPublicaAction } from "@eco/comercio";
import { TarjetaDedicatoriaDigitalInteractiva } from "@eco/comercio";

export const dynamic = "force-dynamic";

interface PropsPage {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PropsPage): Promise<Metadata> {
  const { token } = await params;
  const res = await obtenerTarjetaPublicaAction(token);

  if (!res.ok || !res.tarjeta) {
    return {
      title: "Tarjeta Dedicatoria — Tinkay Flores y Eventos",
      description: "Dedicatoria especial de flores.",
    };
  }

  if (res.tarjeta.tipo === "CONDOLENCIAS_PLANA") {
    return {
      title: "Tarjeta de Condolencias — Tinkay Flores y Eventos",
      description: "Mensaje de condolencias y acompañamiento.",
      openGraph: {
        title: "Tarjeta de Condolencias — Tinkay Flores y Eventos",
        description: "Mensaje de condolencias y acompañamiento.",
      },
    };
  }

  const remitenteVisible =
    res.tarjeta.diseno?.remitentePortada?.trim() || res.tarjeta.remitente || "alguien especial";

  return {
    title: `Dedicatoria para ${res.tarjeta.destinatario} — Tinkay`,
    description: `Tienes un detalle especial de ${remitenteVisible}. Abre tu tarjeta digital.`,
    openGraph: {
      title: `Dedicatoria para ${res.tarjeta.destinatario}`,
      description: `De: ${remitenteVisible}. Toca para abrir tu tarjeta digital.`,
    },
  };
}

export default async function DedicatoriaPage({ params }: PropsPage) {
  const { token } = await params;
  const res = await obtenerTarjetaPublicaAction(token);

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
        <span style={{ fontSize: "3rem", marginBottom: "12px" }}>🥀</span>
        <h1 style={{ fontSize: "1.4rem", fontWeight: 700, margin: "0 0 8px 0" }}>
          Tarjeta no encontrada o enlace inactivo
        </h1>
        <p style={{ color: "#94A3B8", maxWidth: "420px", fontSize: "0.9rem", margin: "0 0 20px 0" }}>
          Verifica que el código escaneado del código QR sea correcto o comunícate con atención al cliente.
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
          Ir a la tienda Tinkay
        </Link>
      </div>
    );
  }

  return <TarjetaDedicatoriaDigitalInteractiva datosIniciales={res.tarjeta} token={token} />;
}
