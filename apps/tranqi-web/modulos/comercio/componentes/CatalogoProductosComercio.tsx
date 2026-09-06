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
  Plus,
  FolderPlus,
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
import { ModalCrearProducto } from "./ModalCrearProducto";
import { ModalCrearCategoria } from "./ModalCrearCategoria";

interface Props {
  negocio?: string;
}

export function CatalogoProductosComercio({ negocio = "tranqi" }: Props) {
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

  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);

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

      // Preseleccionar primera variante por defecto para cada producto
      const iniciales: Record<string, string> = {};
      prods.forEach((p) => {
        if (p.variantes.length > 0 && p.variantes[0]) {
          iniciales[p.pro_id] = p.variantes[0].var_id;
        }
      });
      setVarianteSeleccionadaPorProducto(iniciales);
    } catch (err) {
      console.error("Error al cargar catálogo comercial:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  // Carga rápida de catálogo inicial / semillas
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

  // Abrir checkout para variante específica
  const abrirCheckout = (prod: ProductoCatalogo, varId?: string) => {
    const selectedVarId = varId || varianteSeleccionadaPorProducto[prod.pro_id];
    const targetVar = prod.variantes.find((v) => v.var_id === selectedVarId) || prod.variantes[0];
    if (!targetVar) return;

    setProductoCheckout(prod);
    setVarianteCheckout(targetVar);
    setCheckoutAbierto(true);
  };

  const getIconoProducto = (p: ProductoCatalogo) => {
    const iconoTipo = p.pro_detalle_producto?.icono;
    if (iconoTipo === "Scale" || p.pro_slug.includes("honorarios") || p.pro_slug.includes("patrocinio")) {
      return <Scale size={24} color="#0284C7" />;
    }
    if (iconoTipo === "ShieldCheck" || p.pro_slug.includes("plan") || p.pro_slug.includes("proteccion")) {
      return <ShieldCheck size={24} color="#059669" />;
    }
    if (iconoTipo === "FileCheck" || p.pro_slug.includes("dictamen") || p.pro_slug.includes("contrato")) {
      return <FileCheck size={24} color="#7E22CE" />;
    }
    return <CreditCard size={24} color="#D97706" />;
  };

  return (
    <div style={{ padding: "8px 0" }}>
      {/* Cabecera del Catálogo y Barra de Acciones */}
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

        {/* Botones de Gestión de Catálogo para Administrador */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => setModalProdAbierto(true)}
            className="btn-responsive-accion"
            title="Crear Nuevo Honorario o Servicio"
            aria-label="Crear Nuevo Honorario o Servicio"
            style={{
              background: "#0F172A",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.15)",
            }}
          >
            <Plus size={15} />
            <span className="btn-texto-responsive">Nuevo Honorario</span>
          </button>

          <button
            type="button"
            onClick={() => setModalCatAbierto(true)}
            className="btn-responsive-accion"
            title="Crear Nueva Categoría"
            aria-label="Crear Nueva Categoría"
            style={{
              background: "#FFFFFF",
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
            <FolderPlus size={15} />
            <span className="btn-texto-responsive">Nueva Categoría</span>
          </button>

          <button
            type="button"
            onClick={cargarDatos}
            className="btn-responsive-accion"
            title="Actualizar Catálogo"
            aria-label="Actualizar Catálogo"
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
            <span className="btn-texto-responsive">Actualizar</span>
          </button>
        </div>
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

        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
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
            Todas ({productos.length})
          </button>
          {categoriasLista.map((c) => (
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
          <RefreshCw size={32} className="animate-spin" style={{ margin: "0 auto 12px", color: "#0284C7" }} />
          <div style={{ fontWeight: 600 }}>Cargando catálogo comercial unificado...</div>
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
            No se encontraron productos o servicios
          </h3>
          <p style={{ margin: "0 auto 20px", fontSize: "0.85rem", color: "#64748B", maxWidth: "420px" }}>
            Puedes crear un nuevo honorario profesional o cargar inmediatamente el catálogo de ejemplo con tarifas y planes preconfigurados.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              onClick={() => setModalProdAbierto(true)}
              style={{
                background: "#0F172A",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 18px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <Plus size={16} />
              Crear Honorario
            </button>
            <button
              type="button"
              onClick={handleCargarSemillas}
              disabled={cargandoSemillas}
              style={{
                background: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "9px 18px",
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
            const esHonorario = p.pro_tipo === "SERVICIO" || p.pro_slug.includes("honorarios");

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
                    ? "0 4px 12px rgba(2, 132, 199, 0.1)"
                    : "0 2px 6px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease",
                  position: "relative",
                }}
              >
                {/* Badge Superior */}
                {p.pro_destacado && (
                  <div
                    style={{
                      position: "absolute",
                      top: "12px",
                      right: "12px",
                      background: "linear-gradient(135deg, #F59E0B, #D97706)",
                      color: "#FFFFFF",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      fontSize: "0.7rem",
                      fontWeight: 800,
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                    }}
                  >
                    <Sparkles size={10} />
                    DESTACADO
                  </div>
                )}

                <div style={{ padding: "20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  {/* Icono y Categoría */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "12px" }}>
                    <div
                      style={{
                        width: "46px",
                        height: "46px",
                        borderRadius: "12px",
                        background: "#F8FAFC",
                        border: "1px solid #E2E8F0",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {getIconoProducto(p)}
                    </div>
                    <div>
                      <span
                        style={{
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {p.categoria?.ctg_nombre || "Servicio Jurídico"}
                      </span>
                      <h3
                        style={{
                          margin: "2px 0 0",
                          fontSize: "1.05rem",
                          fontWeight: 800,
                          color: "#0F172A",
                          lineHeight: 1.3,
                        }}
                      >
                        {p.pro_nombre}
                      </h3>
                    </div>
                  </div>

                  {/* Descripción */}
                  <p
                    style={{
                      margin: "0 0 16px",
                      fontSize: "0.82rem",
                      color: "#475569",
                      lineHeight: 1.45,
                      flex: 1,
                    }}
                  >
                    {p.pro_descripcion}
                  </p>

                  {/* Selector de Variantes / Tarifas */}
                  {p.variantes.length > 1 && (
                    <div style={{ marginBottom: "16px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "#334155",
                          marginBottom: "6px",
                        }}
                      >
                        Selecciona la modalidad de tarifa:
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
                            + IVA ({currentVar.var_tarifa_iva_porcentaje}%): ${currentVar.monto_iva.toFixed(2)}
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

      {/* Modal de Checkout Payphone */}
      <ModalCheckoutPayphone
        abierto={checkoutAbierto}
        alCerrar={() => setCheckoutAbierto(false)}
        productoNombre={productoCheckout?.pro_nombre || ""}
        variante={varianteCheckout}
        negocio={negocio}
      />

      {/* Modal Crear Producto / Honorario */}
      <ModalCrearProducto
        abierto={modalProdAbierto}
        onCerrar={() => setModalProdAbierto(false)}
        onProductoCreado={(nuevo) => {
          setProductos((prev) => [nuevo, ...prev]);
        }}
        categorias={categoriasLista}
        negocio={negocio}
      />

      {/* Modal Crear Categoría */}
      <ModalCrearCategoria
        abierto={modalCatAbierto}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLista((prev) => [...prev, nueva]);
        }}
        negocio={negocio}
      />
    </div>
  );
}
