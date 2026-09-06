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
  Tag,
  CheckCircle,
  HelpCircle,
  Clock,
  ChevronRight,
  RefreshCw,
} from "lucide-react";
import {
  ProductoCatalogo,
  VarianteCatalogo,
  obtenerCatalogoProductosAction,
} from "../acciones";
import { ModalCheckoutPayphone } from "./ModalCheckoutPayphone";

interface Props {
  negocio?: string;
}

export function CatalogoProductosComercio({ negocio = "tranqi" }: Props) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");

  // Estado del modal de checkout
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [productoCheckout, setProductoCheckout] = useState<ProductoCatalogo | null>(null);
  const [varianteCheckout, setVarianteCheckout] = useState<VarianteCatalogo | null>(null);

  // Mapa de variantes seleccionadas por producto
  const [varianteSeleccionadaPorProducto, setVarianteSeleccionadaPorProducto] = useState<
    Record<string, string>
  >({});

  const cargarCatalogo = async () => {
    setCargando(true);
    try {
      const prods = await obtenerCatalogoProductosAction(negocio);
      setProductos(prods);

      // Preseleccionar primera variante por defecto para cada producto
      const iniciales: Record<string, string> = {};
      prods.forEach((p) => {
        if (p.variantes.length > 0 && p.variantes[0]) {
          iniciales[p.pro_id] = p.variantes[0].var_id;
        }
      });
      setVarianteSeleccionadaPorProducto(iniciales);
    } catch (err) {
      console.error("Error al cargar catálogo:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarCatalogo();
  }, [negocio]);

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

  // Categorías únicas
  const categorias = Array.from(
    new Set(
      productos
        .map((p) => p.categoria)
        .filter(Boolean)
        .map((c) => JSON.stringify(c))
    )
  ).map((s) => JSON.parse(s));

  // Abrir checkout para variante específica
  const abrirCheckout = (prod: ProductoCatalogo, varId?: string) => {
    const selectedVarId = varId || varianteSeleccionadaPorProducto[prod.pro_id];
    const targetVar = prod.variantes.find((v) => v.var_id === selectedVarId) || prod.variantes[0];
    if (!targetVar) return;

    setProductoCheckout(prod);
    setVarianteCheckout(targetVar);
    setCheckoutAbierto(true);
  };

  const getIconoProducto = (slug: string) => {
    if (slug.includes("honorarios") || slug.includes("patrocinio")) return <Scale size={24} color="#0284C7" />;
    if (slug.includes("plan") || slug.includes("proteccion")) return <ShieldCheck size={24} color="#059669" />;
    if (slug.includes("dictamen") || slug.includes("contrato")) return <FileCheck size={24} color="#7E22CE" />;
    return <ShoppingBag size={24} color="#D97706" />;
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Cabecera del Catálogo */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "16px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                background: "#E0F2FE",
                color: "#0284C7",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <Sparkles size={12} />
              comun_comercio • PLT-009
            </span>
            <span
              style={{
                background: "#FEF3C7",
                color: "#92400E",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <CreditCard size={12} />
              Payphone Botón de Pago
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F172A" }}>
            Catálogo Comercial y Honorarios Profesionales
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Contrata servicios jurídicos, liquida honorarios profesionales o activa planes legales con Payphone en modo simulado o real.
          </p>
        </div>

        <button
          type="button"
          onClick={cargarCatalogo}
          style={{
            background: "#F1F5F9",
            color: "#334155",
            border: "1px solid #CBD5E1",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 600,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <RefreshCw size={14} className={cargando ? "animate-spin" : ""} />
          Actualizar Catálogo
        </button>
      </div>

      {/* Barra de Búsqueda y Filtros de Categoría */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "16px",
          marginBottom: "24px",
          display: "flex",
          flexWrap: "wrap",
          alignItems: "center",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ flex: 1, minWidth: "240px", position: "relative" }}>
          <Search size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "11px" }} />
          <input
            type="text"
            placeholder="Buscar por servicio, honorario, plan o palabra clave..."
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            style={{
              width: "100%",
              padding: "8px 12px 8px 36px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.85rem",
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada("todas")}
            style={{
              padding: "6px 14px",
              borderRadius: "8px",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
              border: "none",
              background: categoriaSeleccionada === "todas" ? "#0F172A" : "#F1F5F9",
              color: categoriaSeleccionada === "todas" ? "#FFFFFF" : "#475569",
            }}
          >
            Todas las Categorías
          </button>
          {categorias.map((c: any) => (
            <button
              key={c.ctg_id}
              type="button"
              onClick={() => setCategoriaSeleccionada(c.ctg_slug)}
              style={{
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 600,
                cursor: "pointer",
                border: "none",
                background: categoriaSeleccionada === c.ctg_slug ? "#0284C7" : "#F1F5F9",
                color: categoriaSeleccionada === c.ctg_slug ? "#FFFFFF" : "#475569",
              }}
            >
              {c.ctg_nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Grid de Productos */}
      {cargando ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 12px" }} />
          <div>Cargando catálogo comercial unificado...</div>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div
          style={{
            background: "#FFFFFF",
            border: "1px dashed #CBD5E1",
            borderRadius: "16px",
            padding: "50px 20px",
            textAlign: "center",
          }}
        >
          <ShoppingBag size={40} color="#94A3B8" style={{ margin: "0 auto 12px" }} />
          <h3 style={{ margin: "0 0 6px", fontSize: "1rem", color: "#0F172A" }}>
            No se encontraron productos o servicios
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "#64748B" }}>
            Prueba ajustando los términos de búsqueda o cambiando la categoría seleccionada.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))",
            gap: "20px",
          }}
        >
          {productosFiltrados.map((p) => {
            const currentVarId = varianteSeleccionadaPorProducto[p.pro_id] || p.variantes[0]?.var_id;
            const currentVar = p.variantes.find((v) => v.var_id === currentVarId) || p.variantes[0];
            const esHonorario = p.pro_slug === "honorarios-profesionales-juridicos";

            return (
              <div
                key={p.pro_id}
                style={{
                  background: "#FFFFFF",
                  border: esHonorario ? "2px solid #0284C7" : "1px solid #E2E8F0",
                  borderRadius: "16px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  boxShadow: esHonorario
                    ? "0 4px 15px -3px rgba(2, 132, 199, 0.15)"
                    : "0 1px 3px rgba(0,0,0,0.05)",
                  position: "relative",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                }}
              >
                {/* Badge de Destacado / Honorario Especial */}
                {esHonorario && (
                  <div
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      padding: "4px 12px",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      letterSpacing: "0.05em",
                      textTransform: "uppercase",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Scale size={12} />
                    ★ Principal: Liquidación de Honorarios Abogados
                  </div>
                )}

                <div style={{ padding: "20px", flex: 1, display: "flex", flexDirection: "column" }}>
                  {/* Categoría y Tipo */}
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
                    <span
                      style={{
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        color: "#0284C7",
                        background: "#F0F9FF",
                        padding: "2px 8px",
                        borderRadius: "6px",
                      }}
                    >
                      {p.categoria?.ctg_nombre || "Servicio General"}
                    </span>
                    <span
                      style={{
                        fontSize: "0.7rem",
                        fontWeight: 600,
                        color: "#64748B",
                        textTransform: "uppercase",
                      }}
                    >
                      {p.pro_tipo}
                    </span>
                  </div>

                  {/* Icono y Título */}
                  <div style={{ display: "flex", gap: "12px", alignItems: "flex-start", marginBottom: "12px" }}>
                    <div
                      style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {getIconoProducto(p.pro_slug)}
                    </div>
                    <div>
                      <h3 style={{ margin: "0 0 4px", fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
                        {p.pro_nombre}
                      </h3>
                      <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B", lineHeight: 1.4 }}>
                        {p.pro_descripcion}
                      </p>
                    </div>
                  </div>

                  {/* Selector de Variantes (si tiene más de 1) */}
                  {p.variantes.length > 1 && (
                    <div style={{ marginBottom: "16px", marginTop: "8px" }}>
                      <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#475569", marginBottom: "6px" }}>
                        Selecciona el Alcance / Variante:
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {p.variantes.map((v) => {
                          const activa = currentVarId === v.var_id;
                          return (
                            <button
                              key={v.var_id}
                              type="button"
                              onClick={() =>
                                setVarianteSeleccionadaPorProducto((prev) => ({
                                  ...prev,
                                  [p.pro_id]: v.var_id,
                                }))
                              }
                              style={{
                                textAlign: "left",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: activa ? "1.5px solid #0284C7" : "1px solid #E2E8F0",
                                background: activa ? "#F0F9FF" : "#FFFFFF",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <div style={{ fontSize: "0.8rem", fontWeight: activa ? 700 : 500, color: activa ? "#0284C7" : "#334155" }}>
                                {v.var_nombre}
                              </div>
                              <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "#0F172A" }}>
                                ${v.precio_total.toFixed(2)}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Detalle de Precios e Impuestos */}
                  {currentVar && (
                    <div
                      style={{
                        background: "#F8FAFC",
                        borderRadius: "10px",
                        padding: "12px",
                        marginTop: "auto",
                        border: "1px solid #E2E8F0",
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                        <div>
                          <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                            Base Imponible: ${currentVar.var_precio.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "0.7rem", color: "#94A3B8" }}>
                            + IVA (15%): ${currentVar.monto_iva.toFixed(2)}
                          </div>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <div style={{ fontSize: "1.35rem", fontWeight: 800, color: "#0F172A" }}>
                            ${currentVar.precio_total.toFixed(2)}
                          </div>
                          <div style={{ fontSize: "0.65rem", color: "#059669", fontWeight: 700 }}>
                            TOTAL FACTURABLE
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Botón de Acción Directa Payphone */}
                  <button
                    type="button"
                    onClick={() => abrirCheckout(p, currentVar?.var_id)}
                    style={{
                      marginTop: "16px",
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 16px",
                      borderRadius: "10px",
                      fontSize: "0.85rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      gap: "8px",
                      boxShadow: "0 2px 6px rgba(2, 132, 199, 0.25)",
                    }}
                  >
                    <CreditCard size={16} />
                    Contratar y Pagar con Payphone
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal de Checkout */}
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
