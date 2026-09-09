"use client";

import React, { useEffect, useState } from "react";
import {
  ShoppingBag,
  Plus,
  FolderPlus,
  RefreshCw,
  Search,
  Pencil,
  Trash2,
  Sparkles,
  Layers,
  Image as ImageIcon,
  Video,
  ShieldCheck,
  CreditCard,
  Scale,
  FileCheck,
  CheckCircle2,
} from "lucide-react";
import {
  ProductoCatalogo,
  CategoriaCatalogo,
  obtenerCatalogoProductosAction,
  obtenerCategoriasAction,
  restaurarCatalogoEjemploAction,
  eliminarProductoAction,
} from "../acciones";
import { ModalCrearProducto } from "./ModalCrearProducto";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalEditarProducto } from "./ModalEditarProducto";

interface Props {
  negocio?: string;
}

export function ConsolaGestionCatalogo({ negocio = "tranqi" }: Props) {
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<CategoriaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSemillas, setCargandoSemillas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");

  // Modales
  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);
  const [productoAEditar, setProductoAEditar] = useState<ProductoCatalogo | null>(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, cats] = await Promise.all([
        obtenerCatalogoProductosAction(negocio),
        obtenerCategoriasAction(negocio),
      ]);
      setProductos(prods);
      setCategoriasLista(cats);
    } catch (err) {
      console.error("Error al cargar gestión de catálogo:", err);
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarDatos();
  }, [negocio]);

  const handleCargarSemillas = async () => {
    setCargandoSemillas(true);
    try {
      await restaurarCatalogoEjemploAction(negocio);
      await cargarDatos();
    } catch (err) {
      console.error("Error al restaurar catálogo:", err);
    } finally {
      setCargandoSemillas(false);
    }
  };

  const handleEliminar = async (proId: string) => {
    if (!confirm("¿Estás seguro de desactivar este producto del catálogo?")) return;
    try {
      await eliminarProductoAction(proId, negocio);
      setProductos((prev) => prev.filter((p) => p.pro_id !== proId));
    } catch (err) {
      console.error("Error al desactivar:", err);
    }
  };

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

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Operativo */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "20px 24px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "16px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                background: "#E0F2FE",
                color: "#0369A1",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              comun_comercio • PLT-009
            </span>
            <span
              style={{
                background: "#FEF3C7",
                color: "#92400E",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              Consola del Operador
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: "1.25rem", fontWeight: 800, color: "#0F172A" }}>
            Gestión y Administración del Catálogo Comercial
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Administra honorarios, servicios jurídicos, suscripciones y sus recursos multimedia asociados.
          </p>
        </div>

        {/* Botones de Acción Operativa */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
          <button
            type="button"
            onClick={() => setModalProdAbierto(true)}
            className="btn-responsive-accion"
            title="Crear nuevo honorario o producto"
            aria-label="Crear nuevo honorario o producto"
            style={{
              background: "#0284C7",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Plus size={16} />
            <span className="btn-texto-responsive">Nuevo Honorario</span>
          </button>

          <button
            type="button"
            onClick={() => setModalCatAbierto(true)}
            className="btn-responsive-accion"
            title="Crear nueva categoría de servicios"
            aria-label="Crear nueva categoría de servicios"
            style={{
              background: "#FFFFFF",
              border: "1px solid #CBD5E1",
              color: "#334155",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <FolderPlus size={16} />
            <span className="btn-texto-responsive">Nueva Categoría</span>
          </button>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            className="btn-responsive-accion"
            title="Refrescar catálogo"
            aria-label="Refrescar catálogo"
            style={{
              background: "#F1F5F9",
              border: "1px solid #E2E8F0",
              color: "#475569",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: cargando ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <RefreshCw size={15} className={cargando ? "animate-spin" : ""} />
            <span className="btn-texto-responsive">Actualizar</span>
          </button>

          <button
            type="button"
            onClick={handleCargarSemillas}
            disabled={cargandoSemillas}
            className="btn-responsive-accion"
            title="Restaurar y sincronizar catálogo oficial en Supabase"
            aria-label="Restaurar y sincronizar catálogo oficial en Supabase"
            style={{
              background: "#0F172A",
              color: "#FFFFFF",
              border: "none",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: cargandoSemillas ? "not-allowed" : "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Sparkles size={15} />
            <span className="btn-texto-responsive">{cargandoSemillas ? "Sembrando..." : "Sembrar BDD"}</span>
          </button>
        </div>
      </div>

      {/* Tarjetas de Métricas Rápidas */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
          gap: "14px",
        }}
      >
        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
            Total Productos / Honorarios
          </span>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0F172A", marginTop: "4px" }}>
            {productos.length}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
            Categorías Comerciales
          </span>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#0284C7", marginTop: "4px" }}>
            {categoriasLista.length}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
            Tarifa SRI Vigente
          </span>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#059669", marginTop: "4px" }}>
            IVA 15%
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E2E8F0", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600, textTransform: "uppercase" }}>
            Con Recursos Digitales
          </span>
          <div style={{ fontSize: "1.4rem", fontWeight: 800, color: "#7C3AED", marginTop: "4px" }}>
            {productos.filter((p) => p.pro_detalle_producto?.imagen_url || p.pro_detalle_producto?.video_url).length}
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "14px",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
        }}
      >
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
            placeholder="Buscar por código SKU, nombre de servicio o término técnico..."
            style={{
              width: "100%",
              padding: "8px 14px 8px 40px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              fontSize: "0.85rem",
              background: "#F8FAFC",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "6px", overflowX: "auto" }}>
          <button
            type="button"
            onClick={() => setCategoriaSeleccionada("todas")}
            style={{
              padding: "5px 12px",
              borderRadius: "16px",
              fontSize: "0.78rem",
              fontWeight: 700,
              border: "none",
              background: categoriaSeleccionada === "todas" ? "#0284C7" : "#F1F5F9",
              color: categoriaSeleccionada === "todas" ? "#FFFFFF" : "#475569",
              cursor: "pointer",
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
                padding: "5px 12px",
                borderRadius: "16px",
                fontSize: "0.78rem",
                fontWeight: 700,
                border: "none",
                background: categoriaSeleccionada === c.ctg_slug ? "#0284C7" : "#F1F5F9",
                color: categoriaSeleccionada === c.ctg_slug ? "#FFFFFF" : "#475569",
                cursor: "pointer",
                whiteSpace: "nowrap",
              }}
            >
              {c.ctg_nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Lista Técnica de Gestión */}
      {cargando ? (
        <div style={{ padding: "40px", textAlign: "center", color: "#64748B" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 8px", color: "#0284C7" }} />
          <div>Cargando registros comerciales...</div>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#FFFFFF", borderRadius: "14px", border: "1px dashed #CBD5E1" }}>
          <p style={{ margin: 0, color: "#64748B", fontSize: "0.9rem" }}>No se encontraron registros en esta categoría.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {productosFiltrados.map((p) => {
            const varPrincipal = p.variantes[0];
            const tieneImagen = Boolean(p.pro_detalle_producto?.imagen_url);
            const tieneVideo = Boolean(p.pro_detalle_producto?.video_url);

            return (
              <div
                key={p.pro_id}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E2E8F0",
                  borderRadius: "14px",
                  padding: "16px 20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: "14px",
                  boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                }}
              >
                {/* Info Izquierda */}
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "260px", flex: 1 }}>
                  {/* Thumbnail o Icono */}
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      overflow: "hidden",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    {tieneImagen ? (
                      <img
                        src={p.pro_detalle_producto.imagen_url}
                        alt=""
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    ) : (
                      <Scale size={20} color="#0284C7" />
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#64748B", textTransform: "uppercase" }}>
                        {p.categoria?.ctg_nombre || "Servicio"}
                      </span>
                      {p.pro_destacado && (
                        <span style={{ background: "#FEF3C7", color: "#B45309", fontSize: "0.68rem", fontWeight: 800, padding: "1px 6px", borderRadius: "4px" }}>
                          DESTACADO
                        </span>
                      )}
                      {tieneVideo && (
                        <span style={{ background: "#E0F2FE", color: "#0369A1", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <Video size={10} /> Video
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#0F172A" }}>
                      {p.pro_nombre}
                    </h4>

                    <div style={{ fontSize: "0.78rem", color: "#64748B", marginTop: "2px" }}>
                      SKU: <strong style={{ color: "#334155" }}>{varPrincipal?.var_sku || "N/A"}</strong> • {p.variantes.length} modalidad(es)
                    </div>
                  </div>
                </div>

                {/* Precios e Impuestos */}
                <div style={{ textAlign: "right", minWidth: "140px" }}>
                  <div style={{ fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>
                    ${varPrincipal?.precio_total.toFixed(2) || "0.00"}{" "}
                    <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 500 }}>USD</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
                    Base: ${varPrincipal?.var_precio.toFixed(2)} + IVA 15%
                  </div>
                </div>

                {/* Botones de Acción Operador */}
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      setProductoAEditar(p);
                      setModalEditarAbierto(true);
                    }}
                    className="btn-responsive-accion"
                    title="Editar producto, tarifas y recursos digitales"
                    aria-label="Editar producto, tarifas y recursos digitales"
                    style={{
                      background: "#FFFFFF",
                      border: "1px solid #CBD5E1",
                      color: "#334155",
                      padding: "6px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Pencil size={13} color="#0284C7" />
                    <span className="btn-texto-responsive">Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEliminar(p.pro_id)}
                    className="btn-responsive-accion"
                    title="Desactivar producto del catálogo"
                    aria-label="Desactivar producto del catálogo"
                    style={{
                      background: "#FFF1F2",
                      border: "1px solid #FECDD3",
                      color: "#E11D48",
                      padding: "6px 10px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    <Trash2 size={13} />
                    <span className="btn-texto-responsive">Desactivar</span>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modales */}
      <ModalCrearProducto
        abierto={modalProdAbierto}
        onCerrar={() => setModalProdAbierto(false)}
        onProductoCreado={(nuevo) => setProductos((prev) => [nuevo, ...prev])}
        categorias={categoriasLista}
        negocio={negocio}
      />

      <ModalCrearCategoria
        abierto={modalCatAbierto}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => setCategoriasLista((prev) => [...prev, nueva])}
        negocio={negocio}
      />

      <ModalEditarProducto
        abierto={modalEditarAbierto}
        producto={productoAEditar}
        onCerrar={() => {
          setModalEditarAbierto(false);
          setProductoAEditar(null);
        }}
        onProductoEditado={(editado) => {
          setProductos((prev) => prev.map((item) => (item.pro_id === editado.pro_id ? editado : item)));
        }}
        onProductoEliminado={(proId) => {
          setProductos((prev) => prev.filter((item) => item.pro_id !== proId));
        }}
        categorias={categoriasLista}
        negocio={negocio}
      />
    </div>
  );
}
