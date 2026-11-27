"use client";

import React from "react";
import { Globe } from "lucide-react";
import type { CanalOmnicanal } from "../omnicanal";

export interface DefinicionCanalOmnicanal {
  id: CanalOmnicanal;
  nombre: string;
  corto: string;
  color: string;
  fondo: string;
}

export const CANALES_OMNICANAL_DISPONIBLES: DefinicionCanalOmnicanal[] = [
  { id: "whatsapp", nombre: "WhatsApp", corto: "WA", color: "#15803D", fondo: "#DCFCE7" },
  { id: "web", nombre: "Chat Web", corto: "Web", color: "#0F766E", fondo: "#CCFBF1" },
  { id: "facebook", nombre: "Facebook", corto: "FB", color: "#1D4ED8", fondo: "#DBEAFE" },
  { id: "instagram", nombre: "Instagram", corto: "IG", color: "#BE185D", fondo: "#FCE7F3" },
  { id: "telegram", nombre: "Telegram", corto: "TG", color: "#0284C7", fondo: "#E0F2FE" },
  { id: "tiktok", nombre: "TikTok", corto: "TK", color: "#18181B", fondo: "#F4F4F5" },
];

export function IconoVectorCanal({
  canal,
  size = 14,
}: {
  canal: CanalOmnicanal | string;
  size?: number;
}) {
  switch (canal) {
    case "whatsapp":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M12 2C6.48 2 2 6.48 2 12c0 1.82.49 3.53 1.35 5L2 22l5.14-1.32C8.58 21.52 10.24 22 12 22c5.52 0 10-4.48 10-10S17.52 2 12 2Z"
            fill="#22C55E"
          />
          <path
            d="M16.6 14.3c-.26-.13-1.52-.75-1.76-.84-.24-.09-.41-.13-.58.13-.17.26-.67.84-.82 1.01-.15.17-.3.19-.56.06-.26-.13-1.09-.4-2.08-1.28-.77-.68-1.29-1.53-1.44-1.79-.15-.26-.02-.4.11-.53.12-.12.26-.3.39-.45.13-.15.17-.26.26-.43.09-.17.04-.32-.02-.45-.06-.13-.58-1.4-.8-1.92-.21-.5-.42-.43-.58-.44h-.5c-.17 0-.45.06-.69.32-.24.26-.9.88-.9 2.15s.92 2.49 1.05 2.66c.13.17 1.82 2.78 4.41 3.9.62.27 1.1.43 1.48.55.62.2 1.18.17 1.63.1.5-.07 1.52-.62 1.74-1.22.21-.6.21-1.11.15-1.22-.06-.11-.24-.17-.5-.3Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case "facebook":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#1877F2" />
          <path
            d="M15.1 12.6h-2v7.4h-3v-7.4H8.6V10h1.5V8.3c0-1.3.6-3.3 3.3-3.3l2.4.01v2.6h-1.7c-.3 0-.7.14-.7.75V10h2.4l-.7 2.6Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case "instagram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <rect x="2" y="2" width="20" height="20" rx="6" fill="#E1306C" />
          <circle cx="12" cy="12" r="4.2" stroke="#FFFFFF" strokeWidth="2" />
          <circle cx="17.3" cy="6.7" r="1.3" fill="#FFFFFF" />
        </svg>
      );
    case "telegram":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#0EA5E9" />
          <path
            d="M17.2 7.4 6.1 11.7c-.75.3-.74.72-.14.9l2.85.89 6.6-4.16c.31-.19.6-.09.36.12l-5.35 4.83-.2 2.91c.29 0 .42-.13.58-.29l1.39-1.35 2.89 2.13c.53.29.91.14 1.05-.49l1.89-8.92c.2-.78-.3-1.13-.82-.88Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    case "tiktok":
      return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="10" fill="#18181B" />
          <path
            d="M15.9 8.8a3.5 3.5 0 0 1-2.1-2.2V6h-2.1v8.2a1.7 1.7 0 1 1-1.2-1.63V10.4a3.8 3.8 0 1 0 3.3 3.77V10.1c.68.49 1.5.78 2.4.78V8.8h-.3Z"
            fill="#FFFFFF"
          />
        </svg>
      );
    default:
      return (
        <span
          style={{
            width: `${size}px`,
            height: `${size}px`,
            borderRadius: "999px",
            background: "#0D9488",
            color: "#FFFFFF",
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <Globe size={Math.max(10, Math.round(size * 0.66))} />
        </span>
      );
  }
}

export function nombreLegibleCanal(canal: CanalOmnicanal | string): string {
  const encontrado = CANALES_OMNICANAL_DISPONIBLES.find((c) => c.id === canal);
  return encontrado ? encontrado.nombre : "Chat Web";
}

function obtenerInicialesNombre(nombre?: string | null): string {
  const limpio = String(nombre || "")
    .replace(/^WhatsApp\s*\+?\d*/i, "WA")
    .replace(/^Visitante Web.*/i, "VW")
    .trim();
  const partes = limpio.split(/\s+/).filter(Boolean);
  if (partes.length >= 2) {
    return `${partes[0]![0] || ""}${partes[1]![0] || ""}`.toUpperCase();
  }
  return (limpio.slice(0, 2) || "CL").toUpperCase();
}

/**
 * Avatar circular de conversación con insignia vectorial del canal (WhatsApp, Web, Facebook,
 * Instagram, Telegram, TikTok) en la esquina inferior derecha — sin texto redundante de canal.
 */
export function AvatarConCanalOmnicanal({
  nombre,
  canal,
  size = 38,
}: {
  nombre?: string | null;
  canal: CanalOmnicanal | string;
  size?: number;
}) {
  const iniciales = obtenerInicialesNombre(nombre);
  const badgeSize = Math.max(15, Math.round(size * 0.44));

  return (
    <div
      title={`${nombre || "Cliente"} · ${nombreLegibleCanal(canal)}`}
      style={{
        position: "relative",
        width: `${size}px`,
        height: `${size}px`,
        flexShrink: 0,
      }}
    >
      <div
        style={{
          width: "100%",
          height: "100%",
          borderRadius: "999px",
          background: "var(--cf-f1ece4, #F1ECE4)",
          border: "1px solid var(--cb-221d1a-a120, rgba(34, 29, 26, 0.12))",
          color: "var(--ct-221d1a, #221D1A)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          fontSize: `${Math.max(11, Math.round(size * 0.33))}px`,
          fontWeight: 800,
          letterSpacing: "0.02em",
        }}
      >
        {iniciales}
      </div>
      <span
        style={{
          position: "absolute",
          right: "-2px",
          bottom: "-2px",
          width: `${badgeSize + 2}px`,
          height: `${badgeSize + 2}px`,
          borderRadius: "999px",
          background: "var(--cf-ffffff, #FFFFFF)",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          boxShadow: "0 1px 3px rgba(0,0,0,0.18)",
        }}
      >
        <IconoVectorCanal canal={canal} size={badgeSize} />
      </span>
    </div>
  );
}
