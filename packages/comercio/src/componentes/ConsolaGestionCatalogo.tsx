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
  Share2,
  Settings2,
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
import { ModalGaleriaMedios } from "./ModalGaleriaMedios";
import { productoCatalogoCoincideBusqueda } from "../utils/usosCatalogo";

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
  const [copiadoConsulta, setCopiadoConsulta] = useState(false);

  // Modales
  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);
  const [catModalTab, setCatModalTab] = useState<"crear" | "gestionar">("crear");
  const [productoAEditar, setProductoAEditar] = useState<ProductoCatalogo | null>(null);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalGaleriaGlobalAbierto, setModalGaleriaGlobalAbierto] = useState(false);

  // 1. Inicializar parámetros desde URL (Deep Linking & Compartir)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlQ = params.get("q") || params.get("busqueda");
      const urlCat = params.get("categoria");

      if (urlQ) {
        setBusqueda(urlQ);
      }
      if (urlCat) {
        setCategoriaSeleccionada(urlCat);
      }
    }
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, cats] = await Promise.all([
        obtenerCatalogoProductosAction(negocio, undefined, true),
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

  // Compartir parámetros de consulta mediante URL
  const handleCompartirConsulta = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (busqueda.trim()) {
      url.searchParams.set("q", busqueda.trim());
    } else {
      url.searchParams.delete("q");
      url.searchParams.delete("busqueda");
    }
    if (categoriaSeleccionada && categoriaSeleccionada !== "todas") {
      url.searchParams.set("categoria", categoriaSeleccionada);
    } else {
      url.searchParams.delete("categoria");
    }

    // Actualizar historial del navegador sin recargar
    window.history.replaceState({}, "", url.toString());

    // Copiar al portapapeles
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopiadoConsulta(true);
        setTimeout(() => setCopiadoConsulta(false), 2500);
      }).catch(() => {
        prompt("Copia este enlace para compartir la consulta:", url.toString());
      });
    } else {
      prompt("Copia este enlace para compartir la consulta:", url.toString());
    }
  };

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
    const cumpleBusqueda = productoCatalogoCoincideBusqueda(
      p,
      busqueda,
      categoriasLista
    );

    const catSlug = p.categoria?.ctg_slug || "";
    const catId = p.categoria?.ctg_id || p.pro_categoria_principal_id || "";
    const cumpleCategoria =
      categoriaSeleccionada === "todas" ||
      catSlug === categoriaSeleccionada ||
      catId === categoriaSeleccionada;

    return cumpleBusqueda && cumpleCategoria;
  });

  return (
    <div style={{ width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Header Operativo */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
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
                background: "#EFECE6",
                color: "#3A3530",
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
                background: "#FAF6EE",
                color: "#745622",
                fontSize: "0.72rem",
                fontWeight: 700,
                padding: "2px 8px",
                borderRadius: "6px",
              }}
            >
              Consola del Operador
            </span>
          </div>
          <h2 style={{ margin: 0, fontSize: "0.98rem", fontWeight: 800, color: "#1F1C19" }}>
            Gestión y Administración del Catálogo Comercial
          </h2>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#847D74" }}>
            Administra honorarios, servicios jurídicos, suscripciones y sus recursos multimedia asociados.
          </p>
        </div>

        {/* Botones de Acción Operativa */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          {/* Botón Compartir Parámetros de Consulta */}
          <button
            type="button"
            onClick={handleCompartirConsulta}
            className="btn-responsive-accion"
            title="Copiar enlace con los parámetros de consulta"
            aria-label="Compartir parámetros de consulta"
            style={{
              background: copiadoConsulta ? "#F2F6F3" : "#F8F7F4",
              color: copiadoConsulta ? "#2F4737" : "#57524C",
              border: copiadoConsulta ? "1px solid #2F4737" : "1px solid #D5CFC4",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              transition: "all 0.2s ease",
            }}
          >
            {copiadoConsulta ? <CheckCircle2 size={15} color="#2F4737" /> : <Share2 size={15} color="#221E1B" />}
            <span className="btn-texto-responsive">{copiadoConsulta ? "¡Copiado!" : "Compartir"}</span>
          </button>

          <button
            type="button"
            onClick={() => setModalProdAbierto(true)}
            className="btn-responsive-accion"
            title="Crear nuevo honorario o producto"
            aria-label="Crear nuevo honorario o producto"
            style={{
              background: "#221E1B",
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
            onClick={() => {
              setCatModalTab("crear");
              setModalCatAbierto(true);
            }}
            className="btn-responsive-accion"
            title="Crear nueva categoría de servicios"
            aria-label="Crear nueva categoría de servicios"
            style={{
              background: "#FFFFFF",
              border: "1px solid #D5CFC4",
              color: "#57524C",
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
            onClick={() => {
              setCatModalTab("gestionar");
              setModalCatAbierto(true);
            }}
            className="btn-responsive-accion"
            title="Administrar y eliminar categorías"
            aria-label="Administrar categorías"
            style={{
              background: "#FFFFFF",
              border: "1px solid #D5CFC4",
              color: "#57524C",
              padding: "8px 12px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 600,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <Settings2 size={16} />
            <span className="btn-texto-responsive">Gestionar</span>
          </button>

          <button
            type="button"
            onClick={() => setModalGaleriaGlobalAbierto(true)}
            className="btn-responsive-accion"
            title="Abrir biblioteca y galería de imágenes del negocio"
            aria-label="Abrir biblioteca y galería de imágenes del negocio"
            style={{
              background: "#F8F7F4",
              border: "1px solid #D5CFC4",
              color: "#1F1C19",
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
            <ImageIcon size={16} color="#221E1B" />
            <span className="btn-texto-responsive">Biblioteca de Medios</span>
          </button>

          <button
            type="button"
            onClick={cargarDatos}
            disabled={cargando}
            className="btn-responsive-accion"
            title="Refrescar catálogo"
            aria-label="Refrescar catálogo"
            style={{
              background: "#F4F2EE",
              border: "1px solid #E6E2DA",
              color: "#57524C",
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
              background: "#1F1C19",
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
        <div style={{ background: "#FFFFFF", border: "1px solid #E6E2DA", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 600, textTransform: "uppercase" }}>
            Total Productos / Honorarios
          </span>
          <div style={{ fontSize: "1.04rem", fontWeight: 800, color: "#1F1C19", marginTop: "4px" }}>
            {productos.length}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E6E2DA", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 600, textTransform: "uppercase" }}>
            Categorías Comerciales
          </span>
          <div style={{ fontSize: "1.04rem", fontWeight: 800, color: "#221E1B", marginTop: "4px" }}>
            {categoriasLista.length}
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E6E2DA", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 600, textTransform: "uppercase" }}>
            Tarifa SRI Vigente
          </span>
          <div style={{ fontSize: "1.04rem", fontWeight: 800, color: "#2F4737", marginTop: "4px" }}>
            IVA 15%
          </div>
        </div>

        <div style={{ background: "#FFFFFF", border: "1px solid #E6E2DA", borderRadius: "12px", padding: "14px 18px" }}>
          <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 600, textTransform: "uppercase" }}>
            Con Recursos Digitales
          </span>
          <div style={{ fontSize: "1.04rem", fontWeight: 800, color: "#221E1B", marginTop: "4px" }}>
            {productos.filter((p) => p.pro_detalle_producto?.imagen_url || p.pro_detalle_producto?.video_url).length}
          </div>
        </div>
      </div>

      {/* Buscador y Filtros */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
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
              color: "#847D74",
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
              border: "1px solid #D5CFC4",
              fontSize: "0.85rem",
              background: "#F8F7F4",
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
              background: categoriaSeleccionada === "todas" ? "#221E1B" : "#F4F2EE",
              color: categoriaSeleccionada === "todas" ? "#FFFFFF" : "#57524C",
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
                background: categoriaSeleccionada === c.ctg_slug ? "#221E1B" : "#F4F2EE",
                color: categoriaSeleccionada === c.ctg_slug ? "#FFFFFF" : "#57524C",
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
        <div style={{ padding: "40px", textAlign: "center", color: "#847D74" }}>
          <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 8px", color: "#221E1B" }} />
          <div>Cargando registros comerciales...</div>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div style={{ padding: "40px", textAlign: "center", background: "#FFFFFF", borderRadius: "14px", border: "1px dashed #D5CFC4" }}>
          <p style={{ margin: 0, color: "#847D74", fontSize: "0.9rem" }}>No se encontraron registros en esta categoría.</p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {productosFiltrados.map((p) => {
            const variantesLista = Array.isArray(p.variantes) ? p.variantes : [];
            const varPrincipal = variantesLista[0];
            const tieneImagen = Boolean(p.pro_detalle_producto?.imagen_url);
            const tieneVideo = Boolean(p.pro_detalle_producto?.video_url);

            return (
              <div
                key={p.pro_id}
                style={{
                  background: "#FFFFFF",
                  border: "1px solid #E6E2DA",
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
                <div style={{ display: "flex", alignItems: "center", gap: "14px", minWidth: "min(220px, 100%)", flex: 1 }}>
                  {/* Thumbnail o Icono */}
                  <div
                    style={{
                      width: "48px",
                      height: "48px",
                      borderRadius: "10px",
                      background: "#F8F7F4",
                      border: "1px solid #E6E2DA",
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
                      <Scale size={20} color="#221E1B" />
                    )}
                  </div>

                  <div>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "2px" }}>
                      <span style={{ fontSize: "0.72rem", fontWeight: 700, color: "#847D74", textTransform: "uppercase" }}>
                        {p.categoria?.ctg_nombre || "Servicio"}
                      </span>
                      {p.pro_destacado && (
                        <span style={{ background: "#FAF6EE", color: "#745622", fontSize: "0.68rem", fontWeight: 800, padding: "1px 6px", borderRadius: "4px" }}>
                          DESTACADO
                        </span>
                      )}
                      {tieneVideo && (
                        <span style={{ background: "#EFECE6", color: "#3A3530", fontSize: "0.68rem", fontWeight: 700, padding: "1px 6px", borderRadius: "4px", display: "inline-flex", alignItems: "center", gap: "2px" }}>
                          <Video size={10} /> Video
                        </span>
                      )}
                    </div>

                    <h4 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1F1C19" }}>
                      {p.pro_nombre}
                    </h4>

                    <div style={{ fontSize: "0.78rem", color: "#847D74", marginTop: "2px" }}>
                      SKU: <strong style={{ color: "#57524C" }}>{varPrincipal?.var_sku || "N/A"}</strong> • {variantesLista.length} modalidad(es)
                    </div>
                  </div>
                </div>

                {/* Precios e Impuestos */}
                <div style={{ textAlign: "right", minWidth: "140px" }}>
                  <div style={{ fontSize: "0.92rem", fontWeight: 800, color: "#1F1C19" }}>
                    ${varPrincipal?.precio_total ? varPrincipal.precio_total.toFixed(2) : "0.00"}{" "}
                    <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 500 }}>USD</span>
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#847D74" }}>
                    Base: ${varPrincipal?.var_precio !== undefined ? varPrincipal.var_precio.toFixed(2) : "0.00"} + IVA 15%
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
                      border: "1px solid #D5CFC4",
                      color: "#57524C",
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
                    <Pencil size={13} color="#221E1B" />
                    <span className="btn-texto-responsive">Editar</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleEliminar(p.pro_id)}
                    className="btn-responsive-accion"
                    title="Desactivar producto del catálogo"
                    aria-label="Desactivar producto del catálogo"
                    style={{
                      background: "#FAF2F2",
                      border: "1px solid #E5CACA",
                      color: "#221E1B",
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
        productos={productos}
        negocio={negocio}
      />

      <ModalCrearCategoria
        abierto={modalCatAbierto}
        tabInicial={catModalTab}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => setCategoriasLista((prev) => [...prev, nueva])}
        onCategoriaEliminada={(catIdEliminada) => {
          setCategoriasLista((prev) =>
            prev.filter((c) => c.ctg_id !== catIdEliminada && c.ctg_slug !== catIdEliminada)
          );
          if (categoriaSeleccionada === catIdEliminada) {
            setCategoriaSeleccionada("todas");
          }
        }}
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
        productos={productos}
        negocio={negocio}
      />

      {/* Modal Biblioteca Multimedia Global del Negocio */}
      <ModalGaleriaMedios
        abierto={modalGaleriaGlobalAbierto}
        onCerrar={() => setModalGaleriaGlobalAbierto(false)}
        negocio={negocio}
        titulo={`Biblioteca Multimedia y Galería (${negocio.toUpperCase()})`}
      />
    </div>
  );
}
