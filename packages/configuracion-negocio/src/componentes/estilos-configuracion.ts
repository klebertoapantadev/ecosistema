import type { CSSProperties } from "react";

export const estiloTarjetaConfig: CSSProperties = {
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  borderRadius: "14px",
  boxShadow: "0 1px 3px rgba(15, 23, 42, 0.04)",
  overflow: "hidden",
  width: "100%",
};

export const estiloCabeceraTarjeta: CSSProperties = {
  padding: "20px 24px",
  background: "#FAFAFA",
  borderBottom: "1px solid #E5E7EB",
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  flexWrap: "wrap",
  gap: "12px",
};

export const estiloCajaIconoCabecera: CSSProperties = {
  width: "40px",
  height: "40px",
  borderRadius: "10px",
  background: "#FFFFFF",
  border: "1px solid #E5E7EB",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  color: "#1F2937",
  flexShrink: 0,
};

export const estiloCuerpoTarjeta: CSSProperties = {
  padding: "24px",
  display: "flex",
  flexDirection: "column",
  gap: "20px",
};

export const estiloGrillaDosColumnas: CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))",
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
  color: "#1F2937",
  lineHeight: 1.35,
};

export const estiloCodigoBadge: CSSProperties = {
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.73rem",
  fontWeight: 600,
  padding: "1px 6px",
  borderRadius: "5px",
  background: "#F3F4F6",
  border: "1px solid #E5E7EB",
  color: "#374151",
};

export const estiloInputCampo: CSSProperties = {
  width: "100%",
  padding: "10px 13px",
  borderRadius: "9px",
  border: "1px solid #D1D5DB",
  fontFamily: "inherit",
  fontSize: "0.92rem",
  fontWeight: 400,
  color: "#111827",
  background: "#FFFFFF",
  outline: "none",
};

export const estiloInputMonoespaciado: CSSProperties = {
  ...estiloInputCampo,
  fontFamily: "ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace",
  fontSize: "0.86rem",
};

export const estiloTextoAyuda: CSSProperties = {
  fontSize: "0.78rem",
  color: "#6B7280",
  lineHeight: 1.45,
};

export const estiloSubtituloBloque: CSSProperties = {
  fontSize: "0.75rem",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  color: "#6B7280",
  marginBottom: "-6px",
};

export const estiloCajaToggle: CSSProperties = {
  display: "flex",
  alignItems: "flex-start",
  gap: "12px",
  padding: "14px 16px",
  borderRadius: "10px",
  border: "1px solid #E5E7EB",
  background: "#F9FAFB",
  cursor: "pointer",
};

export const estiloPieTarjeta: CSSProperties = {
  padding: "16px 24px",
  background: "#FAFAFA",
  borderTop: "1px solid #E5E7EB",
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
  border: "1px solid #18181B",
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
  border: "1px solid #D1D5DB",
  background: "#FFFFFF",
  color: "#1F2937",
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
  border: "1px solid #FECACA",
  background: "#FFFFFF",
  color: "#B91C1C",
  fontFamily: "inherit",
  fontSize: "0.83rem",
  fontWeight: 600,
  cursor: "pointer",
};

export function estiloPastillaEstado(tono: "activo" | "guardado" | "pendiente"): CSSProperties {
  const paleta =
    tono === "activo"
      ? { bg: "#ECFDF5", borde: "#A7F3D0", texto: "#065F46" }
      : tono === "guardado"
        ? { bg: "#FFFBEB", borde: "#FDE68A", texto: "#92400E" }
        : { bg: "#F3F4F6", borde: "#E5E7EB", texto: "#4B5563" };

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
    background: tipo === "ok" ? "#F0FDF4" : "#FEF2F2",
    border: `1px solid ${tipo === "ok" ? "#BBF7D0" : "#FECACA"}`,
    color: tipo === "ok" ? "#166534" : "#991B1B",
  };
}

