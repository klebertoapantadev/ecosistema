"use client";

import React from "react";
import {
  Armchair,
  Camera,
  CheckCircle2,
  Download,
  ExternalLink,
  Layers,
  MapPin,
  Ribbon,
  Sparkles,
  Store,
  Truck,
  X,
} from "lucide-react";
import {
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  obtenerDefinicionClasificacionPedido,
  type ClasificacionOperativaPedido,
} from "../operaciones-taller";

export function IconoClasificacionPedido({
  clasificacion,
  size = 13,
  color,
}: {
  clasificacion?: ClasificacionOperativaPedido | string | null;
  size?: number;
  color?: string;
}) {
  const def = obtenerDefinicionClasificacionPedido(clasificacion);
  const c = color || def.textoHex;

  switch (def.iconoClave) {
    case "Store":
      return <Store size={size} color={c} strokeWidth={2.1} />;
    case "Ribbon":
      return <Ribbon size={size} color={c} strokeWidth={2.1} />;
    case "Sparkles":
      return <Sparkles size={size} color={c} strokeWidth={2.1} />;
    case "Armchair":
      return <Armchair size={size} color={c} strokeWidth={2.1} />;
    case "Truck":
    default:
      return <Truck size={size} color={c} strokeWidth={2.1} />;
  }
}

export function InsigniaClasificacionPedido({
  clasificacion,
  opaco = false,
  compacto = false,
  sufijoTexto,
}: {
  clasificacion?: ClasificacionOperativaPedido | string | null;
  opaco?: boolean;
  compacto?: boolean;
  sufijoTexto?: string | null;
}) {
  const def = obtenerDefinicionClasificacionPedido(clasificacion);
  const colorTexto = opaco ? def.textoOpacoHex : def.textoHex;
  const colorFondo = opaco ? def.fondoOpacoHex : def.fondoHex;
  const colorBorde = opaco ? def.bordeOpacoHex : def.bordeHex;
  const colorPunto = opaco ? def.acentoOpacoHex : def.acentoHex;

  return (
    <span
      title={`${def.etiqueta}: ${def.descripcion}${opaco ? " · Entrega confirmada" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: compacto ? "4px" : "5px",
        padding: compacto ? "2px 6px" : "2.5px 8px",
        borderRadius: "6px",
        background: colorFondo,
        border: `1px solid ${colorBorde}`,
        color: colorTexto,
        fontSize: compacto ? "0.66rem" : "0.71rem",
        fontWeight: 700,
        letterSpacing: "0.01em",
        lineHeight: 1.25,
        whiteSpace: "nowrap",
        opacity: opaco ? 0.82 : 1,
      }}
    >
      <span
        style={{
          width: "6px",
          height: "6px",
          borderRadius: "999px",
          background: colorPunto,
          flexShrink: 0,
        }}
      />
      <IconoClasificacionPedido
        clasificacion={def.clave}
        size={compacto ? 11 : 12}
        color={colorTexto}
      />
      <span>
        {def.etiqueta}
        {sufijoTexto ? ` · ${sufijoTexto}` : ""}
      </span>
    </span>
  );
}

export interface PropsBarraFiltroClasificacionPedido {
  seleccionada: ClasificacionOperativaPedido | "TODOS";
  onSeleccionar: (valor: ClasificacionOperativaPedido | "TODOS") => void;
  conteos: Partial<Record<ClasificacionOperativaPedido, number>>;
  totalGeneral: number;
  compacta?: boolean;
}

export function BarraFiltroClasificacionPedido({
  seleccionada,
  onSeleccionar,
  conteos,
  totalGeneral,
  compacta = false,
}: PropsBarraFiltroClasificacionPedido) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "6px",
        flexWrap: "wrap",
      }}
    >
      <button
        type="button"
        onClick={() => onSeleccionar("TODOS")}
        title="Mostrar todas las clasificaciones de pedidos"
        aria-label="Todas las clasificaciones"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "6px",
          padding: compacta ? "5px 10px" : "6px 12px",
          borderRadius: "8px",
          border: seleccionada === "TODOS" ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
          background: seleccionada === "TODOS" ? "#0F172A" : "#FFFFFF",
          color: seleccionada === "TODOS" ? "#FFFFFF" : "#334155",
          fontSize: compacta ? "0.73rem" : "0.76rem",
          fontWeight: 700,
          cursor: "pointer",
        }}
      >
        <Layers size={13} color={seleccionada === "TODOS" ? "#FFFFFF" : "#475569"} />
        <span>Todos</span>
        <span
          style={{
            padding: "1px 6px",
            borderRadius: "999px",
            background: seleccionada === "TODOS" ? "rgba(255,255,255,0.18)" : "#F1F5F9",
            color: seleccionada === "TODOS" ? "#FFFFFF" : "#475569",
            fontSize: "0.68rem",
            fontWeight: 800,
          }}
        >
          {totalGeneral}
        </span>
      </button>

      {CLASIFICACIONES_OPERATIVAS_PEDIDO.map((cat) => {
        const activa = seleccionada === cat.clave;
        const cantidad = conteos[cat.clave] ?? 0;
        return (
          <button
            key={cat.clave}
            type="button"
            onClick={() => onSeleccionar(activa ? "TODOS" : cat.clave)}
            title={`Filtrar pedidos de ${cat.etiqueta} (${cat.descripcion})`}
            aria-label={cat.etiqueta}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: compacta ? "5px 10px" : "6px 11px",
              borderRadius: "8px",
              border: activa ? `1.5px solid ${cat.acentoHex}` : `1px solid ${cat.bordeHex}`,
              background: activa ? cat.acentoHex : cat.fondoHex,
              color: activa ? "#FFFFFF" : cat.textoHex,
              fontSize: compacta ? "0.73rem" : "0.76rem",
              fontWeight: 700,
              cursor: "pointer",
              transition: "all 0.15s ease",
            }}
          >
            <IconoClasificacionPedido
              clasificacion={cat.clave}
              size={13}
              color={activa ? "#FFFFFF" : cat.acentoHex}
            />
            <span>{cat.etiqueta}</span>
            <span
              style={{
                padding: "1px 6px",
                borderRadius: "999px",
                background: activa ? "rgba(255,255,255,0.22)" : "#FFFFFF",
                color: activa ? "#FFFFFF" : cat.textoHex,
                fontSize: "0.68rem",
                fontWeight: 800,
              }}
            >
              {cantidad}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export interface DatosVisorEvidenciaModal {
  codigo: string;
  clasificacion?: ClasificacionOperativaPedido | string | null;
  productoResumen: string;
  quienSolicita?: string | null;
  destinatarioFallecido?: string | null;
  salaServicio?: string | null;
  fechaEntrega?: string | null;
  horaEntrega?: string | null;
  direccionEntrega?: string | null;
  entregadoEn?: string | null;
  entregadorNombre?: string | null;
  fotoUrl?: string | null;
  mapaUrl?: string | null;
  latitud?: number | null;
  longitud?: number | null;
  numeroInforme?: string | null;
}

export function ModalVisorEvidenciaEntrega({
  datos,
  onCerrar,
}: {
  datos: DatosVisorEvidenciaModal | null;
  onCerrar: () => void;
}) {
  if (!datos) return null;

  const esExeq = String(datos.clasificacion || "").toUpperCase() === "EXEQUIALES" || Boolean(datos.salaServicio);

  return (
    <div
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
        zIndex: 10050,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "92vh",
          overflowY: "auto",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 24px 48px rgba(15, 23, 42, 0.35)",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
          }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "1rem", color: "#0F172A" }}>{datos.codigo}</strong>
              <InsigniaClasificacionPedido clasificacion={datos.clasificacion} />
              <span
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "2.5px 8px",
                  borderRadius: "6px",
                  background: "#ECFDF5",
                  border: "1px solid #A7F3D0",
                  color: "#065F46",
                  fontSize: "0.71rem",
                  fontWeight: 700,
                }}
              >
                <CheckCircle2 size={12} />
                <span>Entrega Confirmada</span>
              </span>
              {datos.numeroInforme && (
                <span
                  style={{
                    padding: "2.5px 8px",
                    borderRadius: "6px",
                    background: "#EFF6FF",
                    border: "1px solid #BFDBFE",
                    color: "#1E40AF",
                    fontSize: "0.71rem",
                    fontWeight: 700,
                  }}
                >
                  Informe: {datos.numeroInforme}
                </span>
              )}
            </div>
            <span style={{ fontSize: "0.86rem", fontWeight: 700, color: "#1E293B" }}>
              {datos.productoResumen}
            </span>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar visor de confirmación"
            aria-label="Cerrar"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              color: "#334155",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Ficha permanente del pedido y entrega */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
            gap: "10px",
            padding: "12px 14px",
            borderRadius: "12px",
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            fontSize: "0.8rem",
            color: "#334155",
            lineHeight: 1.5,
          }}
        >
          <div>
            {esExeq && (
              <div>
                <strong>Sala de entrega:</strong> {datos.salaServicio || "Por confirmar"}
              </div>
            )}
            <div>
              <strong>{esExeq ? "Quién solicitó:" : "Comprador:"}</strong>{" "}
              {datos.quienSolicita || "—"}
            </div>
            <div>
              <strong>{esExeq ? "Nombre del fallecido:" : "Destinatario:"}</strong>{" "}
              {datos.destinatarioFallecido || "—"}
            </div>
          </div>

          <div>
            <div>
              <strong>Fecha / Hora programada:</strong> {datos.fechaEntrega || "—"}
              {datos.horaEntrega ? ` · ${datos.horaEntrega}` : ""}
            </div>
            {datos.entregadoEn && (
              <div>
                <strong>Confirmado en:</strong>{" "}
                {new Date(datos.entregadoEn).toLocaleString("es-EC", {
                  dateStyle: "short",
                  timeStyle: "short",
                })}
              </div>
            )}
            <div>
              <strong>Dirección:</strong> {datos.direccionEntrega || "—"}
            </div>
            {datos.entregadorNombre && (
              <div>
                <strong>Entregado por:</strong> {datos.entregadorNombre}
              </div>
            )}
          </div>
        </div>

        {/* Fotografía georreferenciada */}
        {datos.fotoUrl ? (
          <div
            style={{
              borderRadius: "12px",
              overflow: "hidden",
              border: "1px solid #CBD5E1",
              background: "#0F172A",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              maxHeight: "460px",
            }}
          >
            <img
              src={datos.fotoUrl}
              alt={`Confirmación de entrega ${datos.codigo}`}
              style={{
                width: "100%",
                maxHeight: "460px",
                objectFit: "contain",
                display: "block",
              }}
            />
          </div>
        ) : (
          <div
            style={{
              padding: "24px",
              borderRadius: "12px",
              border: "1px dashed #CBD5E1",
              background: "#F8FAFC",
              textAlign: "center",
              color: "#64748B",
              fontSize: "0.82rem",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Camera size={22} color="#94A3B8" />
            <span>Entrega marcada como confirmada sin fotografía adjunta.</span>
          </div>
        )}

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            {datos.latitud != null && datos.longitud != null && (
              <a
                href={`https://www.google.com/maps?q=${datos.latitud},${datos.longitud}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir coordenadas GPS exactas de confirmación en Google Maps"
                aria-label="Mapa GPS"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  textDecoration: "none",
                  fontSize: "0.79rem",
                  fontWeight: 700,
                }}
              >
                <MapPin size={14} color="#0D9488" />
                <span>Mapa GPS</span>
                <ExternalLink size={12} />
              </a>
            )}

            {datos.fotoUrl && (
              <a
                href={datos.fotoUrl}
                target="_blank"
                rel="noopener noreferrer"
                download={`evidencia-${datos.codigo}.jpg`}
                title="Abrir o descargar fotografía de confirmación"
                aria-label="Descargar Foto"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 13px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "0.79rem",
                  fontWeight: 700,
                }}
              >
                <Download size={14} />
                <span>Descargar Foto</span>
              </a>
            )}
          </div>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana"
            aria-label="Cerrar"
            style={{
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#F8FAFC",
              color: "#334155",
              fontSize: "0.79rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Cerrar
          </button>
        </div>
      </div>
    </div>
  );
}
