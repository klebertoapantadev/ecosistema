"use client";

import React, { useEffect, useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  FileText,
  Image as ImageIcon,
  LayoutList,
  Palette,
  Settings2,
  Share2,
  Sparkles,
  Tag,
  Truck,
} from "lucide-react";
import { obtenerImagenFallbackNegocio } from "../utils/negocio";

export type PasoWizardProducto =
  | "identidad_precio"
  | "colores_flores"
  | "caracteristicas"
  | "imagenes"
  | "logistica"
  | "canales_ia";

export interface DefinicionPasoWizardProducto {
  id: PasoWizardProducto;
  numero: number;
  tituloCorto: string;
  subtitulo: string;
}

export const PASOS_WIZARD_PRODUCTO: DefinicionPasoWizardProducto[] = [
  {
    id: "identidad_precio",
    numero: 1,
    tituloCorto: "Nombre y Precio",
    subtitulo: "Categoría, oferta, IVA y PVP",
  },
  {
    id: "caracteristicas",
    numero: 2,
    tituloCorto: "Características",
    subtitulo: "Descripción, qué incluye y entrega",
  },
  {
    id: "imagenes",
    numero: 3,
    tituloCorto: "Imágenes y Galería",
    subtitulo: "Portada, fotos, encuadre y video",
  },
  {
    id: "logistica",
    numero: 4,
    tituloCorto: "Logística y Vigencia",
    subtitulo: "Envío, temporada y estado",
  },
  {
    id: "canales_ia",
    numero: 5,
    tituloCorto: "Canales y Búsqueda",
    subtitulo: "Web, WhatsApp IA, usos y tags",
  },
];

export function obtenerPasosWizardProducto(
  mostrarPasoColoresFlores = false
): DefinicionPasoWizardProducto[] {
  if (!mostrarPasoColoresFlores) return PASOS_WIZARD_PRODUCTO;
  return [
    {
      id: "identidad_precio",
      numero: 1,
      tituloCorto: "Nombre y Precio",
      subtitulo: "Categoría, oferta, IVA y PVP",
    },
    {
      id: "colores_flores",
      numero: 2,
      tituloCorto: "Colores y Flores",
      subtitulo: "Rosas 1..N, girasoles, orquídeas y papel",
    },
    {
      id: "caracteristicas",
      numero: 3,
      tituloCorto: "Características",
      subtitulo: "Descripción, qué incluye y entrega",
    },
    {
      id: "imagenes",
      numero: 4,
      tituloCorto: "Imágenes y Galería",
      subtitulo: "Portada, fotos, encuadre y video",
    },
    {
      id: "logistica",
      numero: 5,
      tituloCorto: "Logística y Vigencia",
      subtitulo: "Envío, temporada y estado",
    },
    {
      id: "canales_ia",
      numero: 6,
      tituloCorto: "Canales y Búsqueda",
      subtitulo: "Web, WhatsApp IA, usos y tags",
    },
  ];
}

function iconoPaso(id: PasoWizardProducto, size = 14) {
  switch (id) {
    case "identidad_precio":
      return <Tag size={size} />;
    case "colores_flores":
      return <Palette size={size} />;
    case "caracteristicas":
      return <FileText size={size} />;
    case "imagenes":
      return <ImageIcon size={size} />;
    case "logistica":
      return <Truck size={size} />;
    case "canales_ia":
      return <Share2 size={size} />;
  }
}

export interface PropsBarraPasosWizardProducto {
  pasoActivo: PasoWizardProducto;
  onCambiarPaso: (paso: PasoWizardProducto) => void;
  completados?: Partial<Record<PasoWizardProducto, boolean>>;
  colorPrimario?: string;
  permitirModoTodo?: boolean;
  verTodo?: boolean;
  onAlternarVerTodo?: () => void;
  mostrarPasoColoresFlores?: boolean;
}

export function BarraPasosWizardProducto({
  pasoActivo,
  onCambiarPaso,
  completados = {},
  colorPrimario = "#0284C7",
  permitirModoTodo = false,
  verTodo = false,
  onAlternarVerTodo,
  mostrarPasoColoresFlores = false,
}: PropsBarraPasosWizardProducto) {
  const pasosVisibles = obtenerPasosWizardProducto(mostrarPasoColoresFlores);
  const indiceActivo = Math.max(
    0,
    pasosVisibles.findIndex((p) => p.id === pasoActivo)
  );

  // En móvil (<= 640px) siempre operamos por pasos (sin vista "Ver Todo")
  useEffect(() => {
    if (!verTodo || !onAlternarVerTodo || typeof window === "undefined") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const aplicar = () => {
      if (mq.matches && verTodo) onAlternarVerTodo();
    };
    aplicar();
    mq.addEventListener("change", aplicar);
    return () => mq.removeEventListener("change", aplicar);
  }, [verTodo, onAlternarVerTodo]);

  const porcentajeProgreso = verTodo
    ? 100
    : Math.round(((indiceActivo + 1) / pasosVisibles.length) * 100);

  return (
    <div
      style={{
        background: "#F8F7F4",
        borderBottom: "1px solid #E6E2DA",
        padding: "10px 14px 8px",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        flexShrink: 0,
      }}
    >
      <style>{`
        .barra-pasos-wizard-rail {
          display: flex;
          gap: 6px;
          flex: 1;
          min-width: 0;
          overflow-x: auto;
          scrollbar-width: none;
          -ms-overflow-style: none;
          scroll-snap-type: x proximity;
          -webkit-overflow-scrolling: touch;
          padding-bottom: 2px;
        }
        .barra-pasos-wizard-rail::-webkit-scrollbar {
          display: none;
        }
        .btn-paso-wizard-item {
          flex: 0 0 auto;
          scroll-snap-align: start;
        }
        @media (max-width: 640px) {
          .subtitulo-paso-wizard {
            display: none !important;
          }
          .wizard-btn-ver-todo {
            display: none !important;
          }
        }
      `}</style>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "8px",
        }}
      >
        <div className="barra-pasos-wizard-rail">
          {pasosVisibles.map((paso) => {
            const esActivo = !verTodo && pasoActivo === paso.id;
            const listo = Boolean(completados[paso.id]);

            return (
              <button
                key={paso.id}
                type="button"
                className="btn-paso-wizard-item"
                onClick={(e) => {
                  if (verTodo && onAlternarVerTodo) onAlternarVerTodo();
                  onCambiarPaso(paso.id);
                  e.currentTarget.scrollIntoView({ behavior: "smooth", inline: "nearest", block: "nearest" });
                }}
                title={`${paso.numero}. ${paso.tituloCorto} — ${paso.subtitulo}`}
                aria-label={`Paso ${paso.numero}: ${paso.tituloCorto}`}
                aria-current={esActivo ? "step" : undefined}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "7px 11px",
                  minHeight: "40px",
                  borderRadius: "10px",
                  border: esActivo
                    ? `2px solid ${colorPrimario}`
                    : listo
                      ? "1px solid #86EFAC"
                      : "1px solid #D5CFC4",
                  background: esActivo
                    ? "#FFFFFF"
                    : listo
                      ? "#F0FDF4"
                      : "#FFFFFF",
                  color: esActivo ? "#1F1C19" : "#3F3B36",
                  cursor: "pointer",
                  textAlign: "left",
                  boxShadow: esActivo ? `0 2px 8px ${colorPrimario}22` : "none",
                  whiteSpace: "nowrap",
                }}
              >
                <span
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: esActivo
                      ? colorPrimario
                      : listo
                        ? "#10B981"
                        : "#E6E2DA",
                    color: esActivo || listo ? "#FFFFFF" : "#57524C",
                    fontSize: "0.72rem",
                    fontWeight: 800,
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {listo && !esActivo ? <Check size={12} /> : paso.numero}
                </span>

                <div style={{ minWidth: 0 }}>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      fontSize: "0.75rem",
                      fontWeight: esActivo ? 800 : 700,
                      color: esActivo ? colorPrimario : "#1F1C19",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {iconoPaso(paso.id, 12)}
                    <span>{paso.tituloCorto}</span>
                  </div>
                  <div
                    className="subtitulo-paso-wizard"
                    style={{
                      fontSize: "0.65rem",
                      color: "#6B655E",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {paso.subtitulo}
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {permitirModoTodo && onAlternarVerTodo && (
          <button
            type="button"
            className="wizard-btn-ver-todo"
            onClick={onAlternarVerTodo}
            title="Alternar entre asistente paso a paso o vista completa en una sola hoja"
            aria-label="Alternar vista completa"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "8px 10px",
              minHeight: "40px",
              borderRadius: "8px",
              border: verTodo ? `1.5px solid ${colorPrimario}` : "1px solid #D5CFC4",
              background: verTodo ? `${colorPrimario}14` : "#FFFFFF",
              color: verTodo ? colorPrimario : "#57524C",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
              whiteSpace: "nowrap",
            }}
          >
            <LayoutList size={13} />
            <span>{verTodo ? "Pasos" : "Ver Todo"}</span>
          </button>
        )}
      </div>

      {/* Barra de progreso del asistente */}
      <div
        aria-hidden="true"
        style={{
          height: "3px",
          width: "100%",
          borderRadius: "999px",
          background: "#E6E2DA",
          overflow: "hidden",
        }}
      >
        <div
          style={{
            height: "100%",
            width: `${porcentajeProgreso}%`,
            background: colorPrimario,
            borderRadius: "999px",
            transition: "width 0.2s ease",
          }}
        />
      </div>
    </div>
  );
}

/**
 * Selector interactivo compartido de encuadre, posición y ajuste de imagen 1:1
 */
export function SelectorEncuadreFoto({
  imagenUrl,
  posicion = "center center",
  ajuste = "cover",
  zoom = 100,
  onCambiarPosicion,
  onCambiarAjuste,
  onCambiarZoom,
  titulo = "Encuadre & Posición en Catálogo (Cuadrado 1:1)",
  colorTema = "#0284C7",
}: {
  imagenUrl: string;
  posicion?: string;
  ajuste?: "cover" | "contain";
  zoom?: number;
  onCambiarPosicion: (pos: string) => void;
  onCambiarAjuste: (ajuste: "cover" | "contain") => void;
  onCambiarZoom: (zoom: number) => void;
  titulo?: string;
  colorTema?: string;
}) {
  const [abiertoAvanzado, setAbiertoAvanzado] = useState(false);
  const [esMovil, setEsMovil] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const actualizar = () => setEsMovil(mq.matches);
    actualizar();
    mq.addEventListener("change", actualizar);
    return () => mq.removeEventListener("change", actualizar);
  }, []);

  if (!imagenUrl || esMovil) return null;

  const tieneAjusteCustom =
    posicion !== "center center" || ajuste !== "cover" || (Number(zoom) || 100) !== 100;
  const scaleVal = zoom && zoom !== 100 ? zoom / 100 : 1;

  const presetsPosicion = [
    { label: "⬆️ Superior (Rostros / Flores Altas)", val: "center 15%" },
    { label: "⏹️ Centro Equilibrado", val: "center center" },
    { label: "⬇️ Inferior (Base / Florero)", val: "center 85%" },
  ];

  return (
    <div className="ocultar-en-movil catalogo-solo-pantalla-grande" style={{ marginTop: "8px" }}>
      {!abiertoAvanzado ? (
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "8px",
            padding: "6px 10px",
            borderRadius: "8px",
            border: "1px dashed #D5CFC4",
            background: "#F8F7F4",
          }}
        >
          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", minWidth: 0 }}>
            <Settings2 size={13} color="#57524C" />
            <span style={{ fontSize: "0.73rem", fontWeight: 600, color: "#57524C" }}>
              Encuadre de portada (1:1)
            </span>
            {tieneAjusteCustom && (
              <span
                style={{
                  fontSize: "0.65rem",
                  fontWeight: 700,
                  padding: "1px 6px",
                  borderRadius: "999px",
                  background: "#FAF6EE",
                  border: "1px solid #E5D7BC",
                  color: "#745622",
                }}
              >
                Personalizado
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setAbiertoAvanzado(true)}
            aria-expanded={false}
            aria-label="Avanzado"
            title="Mostrar opciones avanzadas de encuadre y posición"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "4px 9px",
              borderRadius: "6px",
              border: "1px solid #D5CFC4",
              background: "#FFFFFF",
              color: "#221E1B",
              fontSize: "0.72rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <span>Avanzado</span>
            <ChevronDown size={13} />
          </button>
        </div>
      ) : (
    <div
      style={{
        background: "#F8F7F4",
        border: "1.5px dashed #D5CFC4",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: "8px",
          marginBottom: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={14} color={colorTema} />
          <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#1F1C19" }}>
            {titulo}
          </span>
        </div>
        <button
          type="button"
          onClick={() => setAbiertoAvanzado(false)}
          aria-expanded={true}
          aria-label="Ocultar avanzado"
          title="Ocultar opciones avanzadas de encuadre"
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "4px",
            padding: "3px 8px",
            borderRadius: "6px",
            border: "1px solid #D5CFC4",
            background: "#FFFFFF",
            color: "#57524C",
            fontSize: "0.7rem",
            fontWeight: 700,
            cursor: "pointer",
            whiteSpace: "nowrap",
          }}
        >
          <span>Ocultar</span>
          <ChevronUp size={12} />
        </button>
      </div>

      <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
        <div
          style={{
            position: "relative",
            width: "105px",
            height: "105px",
            borderRadius: "10px",
            overflow: "hidden",
            background: "#0F172A",
            border: `2px solid ${colorTema}`,
            flexShrink: 0,
            boxShadow: "0 3px 8px rgba(0,0,0,0.15)",
          }}
        >
          {ajuste === "contain" && (
            <img
              src={imagenUrl}
              alt=""
              aria-hidden="true"
              style={{
                position: "absolute",
                inset: 0,
                width: "100%",
                height: "100%",
                objectFit: "cover",
                filter: "blur(12px) brightness(0.6)",
                transform: "scale(1.2)",
                pointerEvents: "none",
              }}
            />
          )}
          <img
            src={imagenUrl}
            alt="Vista previa encuadre"
            onError={(e) => {
              (e.target as HTMLImageElement).src = obtenerImagenFallbackNegocio();
            }}
            style={{
              position: "relative",
              width: "100%",
              height: "100%",
              objectFit: ajuste,
              objectPosition: posicion,
              transform: scaleVal !== 1 ? `scale(${scaleVal})` : undefined,
              transformOrigin: posicion,
              transition: "all 0.2s ease",
            }}
          />
          <div
            style={{
              position: "absolute",
              bottom: "4px",
              left: "4px",
              background: "rgba(0,0,0,0.7)",
              color: "#FFF",
              fontSize: "0.58rem",
              fontWeight: 700,
              padding: "1px 5px",
              borderRadius: "4px",
            }}
          >
            Vista Carrusel
          </div>
        </div>

        <div
          style={{
            flex: 1,
            minWidth: "220px",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "0.7rem",
                fontWeight: 700,
                color: "#475569",
                marginBottom: "4px",
              }}
            >
              Enfoque Vertical:
            </div>
            <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
              {presetsPosicion.map((pr) => {
                const activo = posicion === pr.val;
                return (
                  <button
                    key={pr.val}
                    type="button"
                    onClick={() => onCambiarPosicion(pr.val)}
                    style={{
                      padding: "4px 8px",
                      borderRadius: "6px",
                      fontSize: "0.68rem",
                      fontWeight: activo ? 800 : 600,
                      border: activo ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
                      background: activo ? "#FFFFFF" : "#F1F5F9",
                      color: activo ? colorTema : "#475569",
                      cursor: "pointer",
                    }}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div
                style={{
                  fontSize: "0.7rem",
                  fontWeight: 700,
                  color: "#475569",
                  marginBottom: "4px",
                }}
              >
                Ajuste:
              </div>
              <div style={{ display: "flex", gap: "4px" }}>
                <button
                  type="button"
                  onClick={() => onCambiarAjuste("cover")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.68rem",
                    fontWeight: ajuste === "cover" ? 800 : 600,
                    border:
                      ajuste === "cover" ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
                    background: ajuste === "cover" ? "#FFFFFF" : "#F1F5F9",
                    color: ajuste === "cover" ? colorTema : "#475569",
                    cursor: "pointer",
                  }}
                >
                  🔲 Llenar (Cover)
                </button>
                <button
                  type="button"
                  onClick={() => onCambiarAjuste("contain")}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.68rem",
                    fontWeight: ajuste === "contain" ? 800 : 600,
                    border:
                      ajuste === "contain"
                        ? `1.5px solid ${colorTema}`
                        : "1px solid #CBD5E1",
                    background: ajuste === "contain" ? "#FFFFFF" : "#F1F5F9",
                    color: ajuste === "contain" ? colorTema : "#475569",
                    cursor: "pointer",
                  }}
                >
                  🖼️ Completa (Contain)
                </button>
              </div>
            </div>

            {ajuste === "cover" && (
              <div>
                <div
                  style={{
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    color: "#475569",
                    marginBottom: "4px",
                  }}
                >
                  Escala: {zoom}%
                </div>
                <div style={{ display: "flex", gap: "3px" }}>
                  {[100, 115, 130].map((z) => (
                    <button
                      key={z}
                      type="button"
                      onClick={() => onCambiarZoom(z)}
                      style={{
                        padding: "3px 6px",
                        borderRadius: "4px",
                        fontSize: "0.65rem",
                        fontWeight: zoom === z ? 800 : 600,
                        border:
                          zoom === z ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
                        background: zoom === z ? "#FFFFFF" : "#F1F5F9",
                        color: zoom === z ? colorTema : "#475569",
                        cursor: "pointer",
                      }}
                    >
                      {z === 100 ? "1x" : `${z}%`}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
      )}
    </div>
  );
}
