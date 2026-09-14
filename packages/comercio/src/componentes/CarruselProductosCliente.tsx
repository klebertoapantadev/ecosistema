"use client";

import React, { useEffect, useState, useRef } from "react";
import Link from "next/link";
import {
  ChevronLeft,
  ChevronRight,
  Sparkles,
  ShieldCheck,
  FileCheck,
  CheckCircle2,
  ArrowRight,
  CreditCard,
} from "lucide-react";
import {
  obtenerCatalogoProductosAction,
  ProductoCatalogo,
  VarianteCatalogo,
} from "../acciones";
import { ModalCheckoutPayphone } from "./ModalCheckoutPayphone";

interface Props {
  negocio?: string;
  onCompraCompletada?: () => void;
}

export function CarruselProductosCliente({
  negocio = "tranqi",
  onCompraCompletada,
}: Props) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [productoSeleccionado, setProductoSeleccionado] = useState<{
    producto: ProductoCatalogo;
    variante: VarianteCatalogo;
  } | null>(null);
  const [modalPagoAbierto, setModalPagoAbierto] = useState(false);

  const contenedorRef = useRef<HTMLDivElement>(null);

  const cargarProductos = async () => {
    try {
      const data = await obtenerCatalogoProductosAction(negocio);
      setProductos(data);
    } catch {
      // Fallback
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarProductos();
  }, [negocio]);

  const scroll = (direccion: "izq" | "der") => {
    if (contenedorRef.current) {
      const cantidad = 340;
      contenedorRef.current.scrollBy({
        left: direccion === "der" ? cantidad : -cantidad,
        behavior: "smooth",
      });
    }
  };

  const manejarIniciarCompra = (producto: ProductoCatalogo, variante: VarianteCatalogo) => {
    setProductoSeleccionado({ producto, variante });
    setModalPagoAbierto(true);
  };

  if (cargando || productos.length === 0) {
    return null;
  }

  return (
    <section
      style={{
        marginBottom: "32px",
        position: "relative",
      }}
      aria-labelledby="t-carrusel-productos"
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          marginBottom: "16px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              color: "#6366F1",
              fontSize: "0.75rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              marginBottom: "4px",
            }}
          >
            <Sparkles size={14} /> Oferta & Planes Disponibles
          </div>
          <h2
            id="t-carrusel-productos"
            style={{
              margin: 0,
              fontSize: "1.35rem",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.02em",
            }}
          >
            Servicios Legales & Suscripciones para Ti
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Adquiere servicios puntuales o contrata planes de cobertura continua con activación inmediata.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <button
            type="button"
            onClick={() => scroll("izq")}
            aria-label="Ver productos anteriores"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            onClick={() => scroll("der")}
            aria-label="Ver productos siguientes"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 4px rgba(0,0,0,0.04)",
              transition: "all 0.15s ease",
            }}
          >
            <ChevronRight size={18} />
          </button>
          <Link
            href="/panel/catalogo-productos"
            style={{
              fontSize: "0.82rem",
              fontWeight: 700,
              color: "#4F46E5",
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              marginLeft: "6px",
            }}
          >
            Ver catálogo completo <ArrowRight size={14} />
          </Link>
        </div>
      </div>

      {/* CONTENEDOR DESPLAZABLE */}
      <div
        ref={contenedorRef}
        style={{
          display: "flex",
          gap: "18px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          paddingBottom: "12px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
        }}
      >
        {productos.map((prod) => {
          const varPrincipal = prod.variantes[0];
          if (!varPrincipal) return null;

          const esSuscripcion = prod.pro_tipo === "SUSCRIPCION";
          const imagenUrl = prod.pro_detalle_producto?.imagen_url || "/imagenes/catalogo/notarizacion.jpg";
          const beneficios = prod.pro_detalle_producto?.beneficios || [];

          return (
            <div
              key={prod.pro_id}
              style={{
                flex: "0 0 310px",
                scrollSnapAlign: "start",
                background: "#FFFFFF",
                borderRadius: "20px",
                border: esSuscripcion ? "2px solid #818CF8" : "1px solid #E2E8F0",
                boxShadow: esSuscripcion
                  ? "0 10px 25px -5px rgba(99, 102, 241, 0.18)"
                  : "0 4px 12px rgba(15, 23, 42, 0.05)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                position: "relative",
                transition: "transform 0.2s ease, box-shadow 0.2s ease",
              }}
            >
              {/* IMAGEN DE CABECERA */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "145px",
                  background: "#1E293B",
                  overflow: "hidden",
                }}
              >
                <img
                  src={imagenUrl}
                  alt={prod.pro_nombre}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transition: "transform 0.3s ease",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(15, 23, 42, 0.75) 0%, transparent 60%)",
                  }}
                />

                {/* BADGE DE TIPO */}
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    left: "12px",
                    background: esSuscripcion ? "rgba(99, 102, 241, 0.9)" : "rgba(15, 23, 42, 0.8)",
                    backdropFilter: "blur(6px)",
                    color: "#FFFFFF",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    padding: "3px 10px",
                    borderRadius: "12px",
                    letterSpacing: "0.04em",
                    textTransform: "uppercase",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {esSuscripcion ? <ShieldCheck size={12} /> : <FileCheck size={12} />}
                  {esSuscripcion ? "Plan Suscripción" : "Servicio Legal"}
                </div>

                {prod.pro_destacado && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "rgba(245, 158, 11, 0.95)",
                      color: "#FFFFFF",
                      fontSize: "0.65rem",
                      fontWeight: 800,
                      padding: "3px 8px",
                      borderRadius: "10px",
                      textTransform: "uppercase",
                    }}
                  >
                    ★ Destacado
                  </div>
                )}
              </div>

              {/* CONTENIDO DEL CUERPO */}
              <div
                style={{
                  padding: "18px",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.3,
                    }}
                  >
                    {prod.pro_nombre}
                  </h3>
                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: "0.8rem",
                      color: "#64748B",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {prod.pro_descripcion}
                  </p>

                  {/* BENEFICIOS RESUMIDOS */}
                  {beneficios.length > 0 && (
                    <div style={{ marginBottom: "16px", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {beneficios.slice(0, 2).map((ben: string, bIdx: number) => (
                        <div
                          key={bIdx}
                          style={{
                            fontSize: "0.75rem",
                            color: "#334155",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "6px",
                            lineHeight: 1.3,
                          }}
                        >
                          <CheckCircle2 size={13} color="#10B981" style={{ flexShrink: 0, marginTop: "2px" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{ben}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PRECIO & BOTÓN DE COMPRA */}
                <div
                  style={{
                    borderTop: "1px solid #F1F5F9",
                    paddingTop: "14px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "10px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "4px" }}>
                      <span style={{ fontSize: "1.25rem", fontWeight: 900, color: "#0F172A" }}>
                        ${varPrincipal.precio_total.toFixed(2)}
                      </span>
                      <span style={{ fontSize: "0.7rem", fontWeight: 700, color: "#64748B" }}>
                        {esSuscripcion ? "/mes" : "total"}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#94A3B8", fontWeight: 600 }}>
                      IVA 15% incluido
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => manejarIniciarCompra(prod, varPrincipal)}
                    style={{
                      background: esSuscripcion
                        ? "linear-gradient(135deg, #4F46E5 0%, #4338CA 100%)"
                        : "#0F172A",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 14px",
                      borderRadius: "12px",
                      fontWeight: 800,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      boxShadow: esSuscripcion
                        ? "0 4px 12px rgba(79, 70, 229, 0.35)"
                        : "0 2px 6px rgba(15, 23, 42, 0.15)",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CreditCard size={14} />
                    {esSuscripcion ? "Contratar" : "Adquirir"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CHECKOUT PAYPHONE CON TARJETA INTERACTIVA */}
      {modalPagoAbierto && productoSeleccionado && (
        <ModalCheckoutPayphone
          abierto={modalPagoAbierto}
          alCerrar={() => {
            setModalPagoAbierto(false);
            setProductoSeleccionado(null);
          }}
          negocio={negocio}
          productoNombre={productoSeleccionado.producto.pro_nombre}
          variante={productoSeleccionado.variante}
          alPagoExitoso={() => {
            setModalPagoAbierto(false);
            setProductoSeleccionado(null);
            if (onCompraCompletada) {
              onCompraCompletada();
            }
          }}
        />
      )}
    </section>
  );
}
