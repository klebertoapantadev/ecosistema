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
  obtenerProductosDestacadosClienteAction,
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
      const data = await obtenerProductosDestacadosClienteAction(negocio);
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
      const cantidad = 280;
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
        width: "100%",
        maxWidth: "100%",
        boxSizing: "border-box",
        marginBottom: "24px",
        overflow: "hidden",
      }}
      aria-labelledby="t-carrusel-productos"
    >
      {/* CABECERA DEL CARRUSEL */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "12px",
          gap: "8px",
          width: "100%",
          boxSizing: "border-box",
        }}
      >
        <div style={{ minWidth: 0 }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              color: "#4F46E5",
              fontSize: "0.7rem",
              fontWeight: 800,
              textTransform: "uppercase",
              letterSpacing: "0.05em",
              marginBottom: "2px",
            }}
          >
            <Sparkles size={13} /> Recomendados para Ti
          </div>
          <h2
            id="t-carrusel-productos"
            style={{
              margin: 0,
              fontSize: "1.15rem",
              fontWeight: 800,
              color: "#0F172A",
              letterSpacing: "-0.01em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            Servicios & Planes Legales
          </h2>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => scroll("izq")}
            aria-label="Anterior"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronLeft size={16} />
          </button>
          <button
            type="button"
            onClick={() => scroll("der")}
            aria-label="Siguiente"
            style={{
              width: "32px",
              height: "32px",
              borderRadius: "8px",
              border: "1px solid #E2E8F0",
              background: "#FFFFFF",
              color: "#334155",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <ChevronRight size={16} />
          </button>
          <Link
            href="/panel/catalogo-productos"
            style={{
              fontSize: "0.78rem",
              fontWeight: 700,
              color: "#4F46E5",
              textDecoration: "none",
              marginLeft: "4px",
              whiteSpace: "nowrap",
            }}
          >
            Ver todos →
          </Link>
        </div>
      </div>

      {/* TRACK HORIZONTAL CON SNAP TÁCTIL */}
      <div
        ref={contenedorRef}
        style={{
          display: "flex",
          gap: "14px",
          overflowX: "auto",
          scrollSnapType: "x mandatory",
          WebkitOverflowScrolling: "touch",
          paddingBottom: "8px",
          scrollbarWidth: "none",
          msOverflowStyle: "none",
          width: "100%",
          boxSizing: "border-box",
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
                flex: "0 0 260px",
                width: "260px",
                maxWidth: "80vw",
                scrollSnapAlign: "start",
                background: "#FFFFFF",
                borderRadius: "16px",
                border: esSuscripcion ? "2px solid #818CF8" : "1px solid #E2E8F0",
                boxShadow: esSuscripcion
                  ? "0 4px 14px rgba(99, 102, 241, 0.15)"
                  : "0 2px 8px rgba(15, 23, 42, 0.04)",
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                justifyContent: "space-between",
                boxSizing: "border-box",
              }}
            >
              {/* IMAGEN DE PORTADA */}
              <div
                style={{
                  position: "relative",
                  width: "100%",
                  height: "120px",
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
                    display: "block",
                  }}
                />
                <div
                  style={{
                    position: "absolute",
                    inset: 0,
                    background: "linear-gradient(to top, rgba(15, 23, 42, 0.7) 0%, transparent 60%)",
                  }}
                />

                {/* BADGE DE TIPO */}
                <div
                  style={{
                    position: "absolute",
                    top: "8px",
                    left: "8px",
                    background: esSuscripcion ? "rgba(79, 70, 229, 0.9)" : "rgba(15, 23, 42, 0.8)",
                    color: "#FFFFFF",
                    fontSize: "0.65rem",
                    fontWeight: 800,
                    padding: "2px 8px",
                    borderRadius: "8px",
                    textTransform: "uppercase",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  {esSuscripcion ? <ShieldCheck size={11} /> : <FileCheck size={11} />}
                  {esSuscripcion ? "Plan" : "Servicio"}
                </div>
              </div>

              {/* CUERPO DE LA TARJETA */}
              <div
                style={{
                  padding: "12px 14px",
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  justifyContent: "space-between",
                }}
              >
                <div>
                  <h3
                    style={{
                      margin: "0 0 4px",
                      fontSize: "0.95rem",
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.3,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                      minHeight: "2.4em",
                    }}
                  >
                    {prod.pro_nombre}
                  </h3>

                  {beneficios.length > 0 && (
                    <div style={{ marginBottom: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {beneficios.slice(0, 2).map((ben: string, bIdx: number) => (
                        <div
                          key={bIdx}
                          style={{
                            fontSize: "0.72rem",
                            color: "#475569",
                            display: "flex",
                            alignItems: "flex-start",
                            gap: "5px",
                            lineHeight: 1.25,
                          }}
                        >
                          <CheckCircle2 size={12} color="#10B981" style={{ flexShrink: 0, marginTop: "2px" }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {ben}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* PRECIO Y BOTÓN DE COMPRA */}
                <div
                  style={{
                    borderTop: "1px solid #F1F5F9",
                    paddingTop: "10px",
                    marginTop: "6px",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                  }}
                >
                  <div>
                    <div style={{ display: "flex", alignItems: "baseline", gap: "2px" }}>
                      <span style={{ fontSize: "1.1rem", fontWeight: 900, color: "#0F172A" }}>
                        ${varPrincipal.precio_total.toFixed(2)}
                      </span>
                      <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#64748B" }}>
                        {esSuscripcion ? "/mes" : ""}
                      </span>
                    </div>
                    <span style={{ fontSize: "0.65rem", color: "#94A3B8", fontWeight: 600 }}>
                      IVA 15% incl.
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
                      padding: "8px 12px",
                      borderRadius: "10px",
                      fontWeight: 800,
                      fontSize: "0.75rem",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <CreditCard size={13} />
                    {esSuscripcion ? "Contratar" : "Adquirir"}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* MODAL DE CHECKOUT PAYPHONE */}
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
