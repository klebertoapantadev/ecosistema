import type { CSSProperties } from "react";

export const estiloTarjetaConfig: CSSProperties = {
  background: "var(--cf-ffffff, #FFFFFF)",
  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
  borderRadius: "12px",
  boxShadow: "none",
  overflow: "hidden",
  width: "100%",
};

export const estiloCabeceraTarjeta: CSSProperties = {
  padding: "clamp(12px, 2.5vw, 16px) clamp(14px, 3vw, 20px)",
  background: "var(--cf-f8f7f4, #F8F7F4)",
  borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
};

export const estiloCajaIconoCabecera: CSSProperties = {
  width: "36px",
  height: "36px",
  borderRadius: "8px",
  background: "var(--cf-ffffff, #FFFFFF)",
  border: "1px solid var(--cb-e6e2da, #E6E2DA)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "var(--ct-1f1c19, #1F1C19)",
  flexShrink: 0,
};

export const estiloCuerpoTarjeta: CSSProperties = {
  padding: "clamp(14px, 3.5vw, 24px)",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

export const estiloGrillaDosColumnas: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))",
  gap: "18px",
};

export const estiloGrupoCampo: CSSProperties = {
  display: "flex",
  flexDirection: "column",
  gap: "6px",
};

export const estiloEtiquetaCampo: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  flexWrap: "wrap",
  gap: "6px",
  fontSize: "0.84rem",
  fontWeight: 600,
  color: "var(--ct-1f2937, #1F2937)",
  lineHeight: 1.35,
};

export const estiloCodigoBadge: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.73rem",
  fontWeight: 600,
  padding: "1px 6px",
  borderRadius: "5px",
  background: "var(--cf-f3f4f6, #F3F4F6)",
  border: "1px solid var(--cb-e5e7eb, #E5E7EB)",
  color: "var(--ct-374151, #374151)",
};

export const estiloInputCampo: CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: "9px",
  border: "1px solid var(--cb-d1d5db, #D1D5DB)",
  fontFamily: "inherit",
  fontSize: "0.92rem",
  fontWeight: 400,
  color: "var(--ct-111827, #111827)",
  background: "var(--cf-ffffff, #FFFFFF)",
  outline: "none",
};

export const estiloInputMonoespaciado: CSSProperties = {
  ...estiloInputCampo,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.86rem",
};

export const estiloTextoAyuda: CSSProperties = {
  fontSize: "0.78rem",
  color: "var(--ct-6b7280, #6B7280)",
  lineHeight: 1.45,
};

export const estiloSubtituloBloque: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "var(--ct-6b7280, #6B7280)",
  marginBottom: "-6px",
};

export const estiloCajaToggle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid var(--cb-e5e7eb, #E5E7EB)",
  background: "var(--cf-f9fafb, #F9FAFB)",
  cursor: "pointer",
};

export const estiloPieTarjeta: CSSProperties = {
  padding: "16px 24px",
  background: "var(--cf-fafafa, #FAFAFA)",
  borderTop: "1px solid var(--cb-e5e7eb, #E5E7EB)",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "10px",
};

export const estiloBotonPrimario: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "8px",
  padding: "10px 18px",
  borderRadius: "9px",
  border: "1px solid var(--cb-18181b, #18181B)",
  background: "#18181B",
  color: "#FFFFFF",
  fontFamily: "inherit",
  fontSize: "0.86rem",
  fontWeight: 600,
  cursor: "pointer",
};

export const estiloBotonSecundario: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "10px 16px",
  borderRadius: "9px",
  border: "1px solid var(--cb-d1d5db, #D1D5DB)",
  background: "var(--cf-ffffff, #FFFFFF)",
  color: "var(--ct-1f2937, #1F2937)",
  fontFamily: "inherit",
  fontSize: "0.85rem",
  fontWeight: 600,
  cursor: "pointer",
};

export const estiloBotonPeligroSuave: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: "7px",
  padding: "9px 14px",
  borderRadius: "9px",
  border: "1px solid var(--cb-fecaca, #FECACA)",
  background: "var(--cf-ffffff, #FFFFFF)",
  color: "var(--ct-b91c1c, #B91C1C)",
  fontFamily: "inherit",
  fontSize: "0.83rem",
  fontWeight: 600,
  cursor: "pointer",
};

export function estiloPastillaEstado(tono: "activo" | "guardado" | "pendiente"): CSSProperties {
  const paleta =
    tono === "activo"
      ? { bg: "var(--cf-ecfdf5, #ECFDF5)", borde: "var(--cb-a7f3d0, #A7F3D0)", texto: "var(--ct-065f46, #065F46)" }
      : tono === "guardado"
        ? { bg: "var(--cf-fffbeb, #FFFBEB)", borde: "var(--cb-fde68a, #FDE68A)", texto: "var(--ct-92400e, #92400E)" }
        : { bg: "var(--cf-f3f4f6, #F3F4F6)", borde: "var(--cb-e5e7eb, #E5E7EB)", texto: "var(--ct-4b5563, #4B5563)" };

  return {
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    padding: "4px 11px",
    borderRadius: "999px",
    fontSize: "0.76rem",
    fontWeight: 600,
    background: paleta.bg,
    border: `1px solid ${paleta.borde}`,
    color: paleta.texto,
  };
}

export function estiloAlertaMensaje(tipo: "ok" | "error"): CSSProperties {
  return {
    padding: "12px 15px",
    borderRadius: "10px",
    fontSize: "0.85rem",
    lineHeight: 1.45,
    fontWeight: 500,
    background: tipo === "ok" ? "var(--cf-f0fdf4, #F0FDF4)" : "var(--cf-fef2f2, #FEF2F2)",
    border: `1px solid ${tipo === "ok" ? "var(--cb-bbf7d0, #BBF7D0)" : "var(--cb-fecaca, #FECACA)"}`,
    color: tipo === "ok" ? "var(--ct-166534, #166534)" : "var(--ct-991b1b, #991B1B)",
  };
}

