"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Scale,
  ShieldCheck,
  FileCheck,
  CreditCard,
  Search,
  Sparkles,
  CheckCircle2,
  Clock,
  Play,
  Info,
  RefreshCw,
  ExternalLink,
  ChevronRight,
  Layers,
} from "lucide-react";
import {
  ProductoCatalogo,
  VarianteCatalogo,
  CategoriaCatalogo,
  obtenerCatalogoProductosAction,
  obtenerCategoriasAction,
  restaurarCatalogoEjemploAction,
} from "../acciones";
import { ModalCheckoutPayphone } from "./ModalCheckoutPayphone";
import { ModalDetalleServicioVisual } from "./ModalDetalleServicioVisual";

interface Props {
  negocio?: string;
}

export function VitrinaComercialVisual({ negocio = "tranqi" }: Props) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<CategoriaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSemillas, setCargandoSemillas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");

  // Estado de modales
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [productoCheckout, setProductoCheckout] = useState<ProductoCatalogo | null>(null);
  const [varianteCheckout, setVarianteCheckout] = useState<VarianteCatalogo | null>(null);

  const [detalleModalAbierto, setDetalleModalAbierto] = useState(false);
  const [productoDetalle, setProductoDetalle] = useState<ProductoCatalogo | null>(null);

  // Mapa de variantes seleccionadas por producto
  const [varianteSeleccionadaPorProducto, setVarianteSeleccionadaPorProducto] = useState<
    Record<string, string>
  >({});

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, cats] = await Promise.all([
        obtenerCatalogoProductosAction(negocio),
        obtenerCategoriasAction(negocio),
      ]);
      setProductos(prods);
      setCategoriasLista(cats);

      const iniciales: Record<string, string> = {};
      prods.forEach((p) => {
        if (p.variantes.length > 0 && p.variantes[0]) {
          iniciales[p.pro_id] = p.variantes[0].var_id;
        }
      });
      setVarianteSeleccionadaPorProducto(iniciales);
    } catch (err) {
      console.error("Error al cargar vitrina comercial:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  // Carga de catálogo de ejemplo si está vacío
  const handleCargarSemillas = async () => {
    setCargandoSemillas(true);
    try {
      await restaurarCatalogoEjemploAction(negocio);
      await cargarDatos();
    } catch (err) {
      console.error("Error al restaurar catálogo inicial:", err);
    } finally {
      setCargandoSemillas(false);
    }
  };

  // Filtrado
  const productosFiltrados = productos.filter((p) => {
    const cumpleBusqueda =
      busqueda.trim() === "" ||
      p.pro_nombre.toLowerCase().includes(busqueda.toLowerCase()) ||
      (p.pro_descripcion && p.pro_descripcion.toLowerCase().includes(busqueda.toLowerCase()));

    const cumpleCategoria =
      categoriaSeleccionada === "todas" ||
      (p.categoria && p.categoria.ctg_slug === categoriaSeleccionada);

    return cumpleBusqueda && cumpleCategoria;
  });

  // Abrir checkout directo
  const abrirCheckout = (prod: ProductoCatalogo, varId?: string) => {
    const selectedVarId = varId || varianteSeleccionadaPorProducto[prod.pro_id];
    const targetVar = prod.variantes.find((v) => v.var_id === selectedVarId) || prod.variantes[0];
    if (!targetVar) return;

    setProductoCheckout(prod);
    setVarianteCheckout(targetVar);
    setCheckoutAbierto(true);
  };

  // Abrir modal de detalles y media
  const abrirDetalles = (prod: ProductoCatalogo) => {
    setProductoDetalle(prod);
    setDetalleModalAbierto(true);
  };

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "24px" }}>
      {/* Hero Banner Visual de la Vitrina */}
      <div
        style={{
          background: "linear-gradient(135deg, #0F172A 0%, #1E293B 50%, #0369A1 100%)",
          borderRadius: "20px",
          padding: "32px 28px",
          color: "#FFFFFF",
          boxShadow: "0 10px 25px -5px rgba(15, 23, 42, 0.3)",
          position: "relative",
          overflow: "hidden",
        }}
      >
        <div style={{ position: "relative", zIndex: 2, maxWidth: "620px" }}>
          <div
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "rgba(255, 255, 255, 0.15)",
              backdropFilter: "blur(8px)",
              padding: "4px 12px",
              borderRadius: "20px",
              fontSize: "0.75rem",
              fontWeight: 700,
              letterSpacing: "0.5px",
              textTransform: "uppercase",
              marginBottom: "12px",
            }}
          >
            <Sparkles size={14} color="#38BDF8" />
            Servicios Jurídicos & Protección Legal
          </div>
          <h1
            style={{
              margin: "0 0 10px",
              fontSize: "1.75rem",
              fontWeight: 800,
              lineHeight: 1.2,
              letterSpacing: "-0.5px",
            }}
          >
            Oferta de Servicios & Tarifario Oficial
          </h1>
          <p
            style={{
              margin: 0,
              fontSize: "0.95rem",
              color: "#E2E8F0",
              lineHeight: 1.5,
            }}
          >
            Contrata trámites puntuales, videoconsultas con abogados certificados o activa planes familiares y corporativos con liquidación inmediata vía Payphone.
          </p>
        </div>

        {/* Decoración geométrica */}
        <div
          style={{
            position: "absolute",
            right: "-40px",
            bottom: "-40px",
            width: "220px",
            height: "220px",
            borderRadius: "50%",
            background: "rgba(56, 189, 248, 0.12)",
            pointerEvents: "none",
          }}
        />
      </div>

      {/* Barra de Búsqueda y Filtros de Categoría */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "16px 20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        {/* Buscador */}
        <div style={{ position: "relative", width: "100%" }}>
          <Search
            size={18}
            style={{
              position: "absolute",
              left: "14px",
              top: "50%",
              transform: "translateY(-50%)",
              color: "#94A3B8",
            }}
          />
          <input
            type="text"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar por servicio, trámite, plan o palabra clave..."
            style={{
              width: "100%",
              padding: "10px 14px 10px 42px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              fontSize: "0.9rem",
              outline: "none",
              background: "#F8FAFC",
            }}
          />
        </div>

        {/* Píldoras de Categorías */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            gap: "8px",
            overflowX: "auto",
            paddingBottom: "4px",
          }}
        >
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada("todas")}
            style={{
              padding: "6px 14px",
              borderRadius: "20px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              border: "none",
              background: categoriaSeleccionada === "todas" ? "#0284C7" : "#F1F5F9",
              color: categoriaSeleccionada === "todas" ? "#FFFFFF" : "#475569",
              whiteSpace: "nowrap",
              transition: "all 0.15s ease",
            }}
          >
            Todos ({productos.length})
          </button>
          {categoriasLista.map((c) => {
            const count = productos.filter((p) => p.categoria?.ctg_slug === c.ctg_slug).length;
            const activa = categoriaSeleccionada === c.ctg_slug;
            return (
              <button
                key={c.ctg_id}
                type="button"
                onClick={() => setCategoriaSeleccionada(c.ctg_slug)}
                style={{
                  padding: "6px 14px",
                  borderRadius: "20px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  border: "none",
                  background: activa ? "#0284C7" : "#F1F5F9",
                  color: activa ? "#FFFFFF" : "#475569",
                  whiteSpace: "nowrap",
                  transition: "all 0.15s ease",
                }}
              >
                {c.ctg_nombre} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {/* Rejilla de Tarjetas Visuales de Servicios */}
      {cargando ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#0284C7" }} />
          <div style={{ fontWeight: 600 }}>Cargando catálogo de servicios jurídicos...</div>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px dashed #CBD5E1",
            borderRadius: "16px",
            padding: "50px 24px",
            textAlign: "center",
          }}
        >
          <div
            style={{
              width: "56px",
              height: "56px",
              borderRadius: "16px",
              background: "#F1F5F9",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "#64748B",
            }}
          >
            <ShoppingBag size={28} />
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "1.1rem", fontWeight: 700, color: "#0F172A" }}>
            No se encontraron productos o servicios disponibles
          </h3>
          <p style={{ margin: "0 auto 20px", fontSize: "0.85rem", color: "#64748B", maxWidth: "420px" }}>
            Puedes recargar el catálogo oficial de servicios y planes con tarifas preconfiguradas.
          </p>
          <button
            type="button"
            onClick={handleCargarSemillas}
            disabled={cargandoSemillas}
            style={{
              background: "#0284C7",
              color: "#FFFFFF",
              border: "none",
              padding: "10px 20px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: cargandoSemillas ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={16} />
            {cargandoSemillas ? "Cargando..." : "Cargar Catálogo Inicial"}
          </button>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "24px",
          }}
        >
          {productosFiltrados.map((p) => {
            const currentVarId = varianteSeleccionadaPorProducto[p.pro_id] || p.variantes[0]?.var_id;
            const currentVar = p.variantes.find((v) => v.var_id === currentVarId) || p.variantes[0];

            const detalle = p.pro_detalle_producto || {};
            const imagenUrl =
              detalle.imagen_url ||
              "https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1000&q=80";
            const videoUrl = detalle.video_url;
            const beneficios: string[] = Array.isArray(detalle.beneficios) ? detalle.beneficios.slice(0, 2) : [];

            return (
              <div
                key={p.pro_id}
                style={{
                  background: "#FFFFFF",
                  border: p.pro_destacado ? "2px solid #0284C7" : "1px solid #E2E8F0",
                  borderRadius: "18px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: p.pro_destacado
                    ? "0 10px 25px -5px rgba(2, 132, 199, 0.15)"
                    : "0 4px 12px rgba(0,0,0,0.05)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  position: "relative",
                }}
              >
                {/* Portada Multimedia */}
                <div
                  style={{
                    position: "relative",
                    width: "100%",
                    height: "170px",
                    background: "#0F172A",
                    cursor: "pointer",
                  }}
                  onClick={() => abrirDetalles(p)}
                >
                  <img
                    src={imagenUrl}
                    alt={p.pro_nombre}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                    }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      inset: 0,
                      background: "linear-gradient(to top, rgba(15, 23, 42, 0.8) 0%, rgba(15, 23, 42, 0.1) 60%, transparent 100%)",
                    }}
                  />

                  {/* Badges de Categoría y Destacado */}
                  <div style={{ position: "absolute", top: "12px", left: "12px", display: "flex", gap: "6px" }}>
                    <span
                      style={{
                        background: "rgba(15, 23, 42, 0.85)",
                        backdropFilter: "blur(4px)",
                        color: "#FFFFFF",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        textTransform: "uppercase",
                      }}
                    >
                      {p.categoria?.ctg_nombre || "Servicio"}
                    </span>
                    {p.pro_destacado && (
                      <span
                        style={{
                          background: "linear-gradient(135deg, #F59E0B, #D97706)",
                          color: "#FFFFFF",
                          padding: "3px 8px",
                          borderRadius: "12px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          display: "flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        <Sparkles size={10} /> DESTACADO
                      </span>
                    )}
                  </div>

                  {/* Icono de Video si tiene recurso digital */}
                  {videoUrl && (
                    <div
                      style={{
                        position: "absolute",
                        bottom: "12px",
                        right: "12px",
                        background: "rgba(2, 132, 199, 0.9)",
                        color: "#FFFFFF",
                        padding: "4px 8px",
                        borderRadius: "8px",
                        fontSize: "0.7rem",
                        fontWeight: 700,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
                      }}
                    >
                      <Play size={12} fill="#FFFFFF" /> Video Guía
                    </div>
                  )}
                </div>

                {/* Contenido de la Tarjeta */}
                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  <h3
                    style={{
                      margin: "0 0 6px",
                      fontSize: "1.05rem",
                      fontWeight: 800,
                      color: "#0F172A",
                      lineHeight: 1.3,
                      cursor: "pointer",
                    }}
                    onClick={() => abrirDetalles(p)}
                  >
                    {p.pro_nombre}
                  </h3>

                  <p
                    style={{
                      margin: "0 0 14px",
                      fontSize: "0.82rem",
                      color: "#475569",
                      lineHeight: 1.45,
                      display: "-webkit-box",
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: "vertical",
                      overflow: "hidden",
                    }}
                  >
                    {p.pro_descripcion}
                  </p>

                  {/* Beneficios Clave */}
                  {beneficios.length > 0 && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginBottom: "14px" }}>
                      {beneficios.map((b, idx) => (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                            fontSize: "0.78rem",
                            color: "#334155",
                          }}
                        >
                          <CheckCircle2 size={13} color="#059669" style={{ flexShrink: 0 }} />
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {b}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Selector de Variantes / Modalidades si tiene > 1 */}
                  {p.variantes.length > 1 && (
                    <div style={{ marginBottom: "14px" }}>
                      <select
                        value={currentVarId}
                        onChange={(e) =>
                          setVarianteSeleccionadaPorProducto((prev) => ({
                            ...prev,
                            [p.pro_id]: e.target.value,
                          }))
                        }
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8rem",
                          fontWeight: 600,
                          background: "#F8FAFC",
                          color: "#1E293B",
                          outline: "none",
                        }}
                      >
                        {p.variantes.map((v) => (
                          <option key={v.var_id} value={v.var_id}>
                            {v.var_nombre} — ${v.precio_total.toFixed(2)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  <div style={{ marginTop: "auto", paddingTop: "12px", borderTop: "1px solid #F1F5F9" }}>
                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: "12px" }}>
                      <div>
                        <span style={{ fontSize: "0.7rem", color: "#64748B", display: "block" }}>
                          Total facturable (IVA 15% incl.)
                        </span>
                        <div style={{ fontSize: "1.3rem", fontWeight: 800, color: "#0F172A" }}>
                          ${currentVar?.precio_total.toFixed(2)}{" "}
                          <span style={{ fontSize: "0.75rem", fontWeight: 600, color: "#64748B" }}>USD</span>
                        </div>
                      </div>

                      <button
                        type="button"
                        onClick={() => abrirDetalles(p)}
                        style={{
                          background: "transparent",
                          border: "none",
                          color: "#0284C7",
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "3px",
                        }}
                      >
                        Ver Ficha <ChevronRight size={14} />
                      </button>
                    </div>

                    {/* Botón de Acción Principal Directo Payphone */}
                    <button
                      type="button"
                      onClick={() => abrirCheckout(p, currentVar?.var_id)}
                      className="btn-responsive-accion"
                      title="Contratar servicio con Payphone"
                      aria-label="Contratar servicio con Payphone"
                      style={{
                        width: "100%",
                        background: "#0284C7",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "10px 14px",
                        borderRadius: "10px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        boxShadow: "0 2px 8px rgba(2, 132, 199, 0.25)",
                      }}
                    >
                      <CreditCard size={16} />
                      <span className="btn-texto-responsive">Contratar con Payphone</span>
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Detalle Visual y Multimedia */}
      <ModalDetalleServicioVisual
        abierto={detalleModalAbierto}
        producto={productoDetalle}
        onCerrar={() => {
          setDetalleModalAbierto(false);
          setProductoDetalle(null);
        }}
        onContratar={(prod, variante) => {
          setDetalleModalAbierto(false);
          setProductoCheckout(prod);
          setVarianteCheckout(variante);
          setCheckoutAbierto(true);
        }}
        negocio={negocio}
      />

      {/* Modal de Checkout Payphone */}
      <ModalCheckoutPayphone
        abierto={checkoutAbierto}
        alCerrar={() => setCheckoutAbierto(false)}
        productoNombre={productoCheckout?.pro_nombre || ""}
        variante={varianteCheckout}
        negocio={negocio}
      />
    </div>
  );
}
