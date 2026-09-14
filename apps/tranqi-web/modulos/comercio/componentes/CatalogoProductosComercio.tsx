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
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Plus,
  FolderPlus,
  Layers,
  Pencil,
  Play,
  Video,
  Eye,
  X,
  ExternalLink,
  Truck,
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
import { ModalEditarProducto, PALETA_COLORES_VARIANTES } from "./ModalEditarProducto";
import { ManualConfiguracionCatalogoModal } from "./ManualConfiguracionCatalogoModal";
import { TableroDisponibilidadOperativa } from "./TableroDisponibilidadOperativa";
import { BookOpen, Flower2, Wrench, Activity, LayoutGrid } from "lucide-react";

interface Props {
  negocio?: string;
}

export function CatalogoProductosComercio({ negocio = "tranqi" }: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esMantenimiento = negocio === "fastfix";

  const [pestanaActiva, setPestanaActiva] = useState<"catalogo" | "disponibilidad">("catalogo");
  const [modoVista, setModoVista] = useState<"admin" | "cliente">("admin");
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);

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
  const [productoAEditar, setProductoAEditar] = useState<ProductoCatalogo | null>(null);
  const [varianteAEditarId, setVarianteAEditarId] = useState<string | undefined>(undefined);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);

  // Mapa de variantes seleccionadas por producto
  const [varianteSeleccionadaPorProducto, setVarianteSeleccionadaPorProducto] = useState<
    Record<string, string>
  >({});

  // Índice de foto activa en el carrusel de cada producto
  const [fotoCarouselIndexPorProducto, setFotoCarouselIndexPorProducto] = useState<
    Record<string, number>
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
            {esFloristeria
              ? "Catálogo Comercial y Diseños Florales"
              : esMantenimiento
              ? "Catálogo de Servicios y Mantenimiento"
              : "Catálogo Comercial y Honorarios Profesionales"}
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            {esFloristeria
              ? "Arreglos florales, bouquets estilo coreano, complementos y suscripciones con entrega express y Payphone."
              : esMantenimiento
              ? "Servicios de mantenimiento, visitas de diagnóstico y reparaciones residenciales con cobro Payphone."
              : "Contrata servicios jurídicos, liquida honorarios profesionales o activa planes legales con Payphone en modo simulado o real."}
          </p>
        </div>

        {/* Selector de Modo: Administrador vs Vista Cliente */}
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <div
            style={{
              display: "inline-flex",
              background: "#F1F5F9",
              padding: "3px",
              borderRadius: "10px",
              border: "1px solid #CBD5E1",
              marginRight: "4px",
            }}
          >
            <button
              type="button"
              onClick={() => setModoVista("admin")}
              title="Modo Configuración (Crear y editar productos)"
              style={{
                padding: "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: modoVista === "admin" ? "#0F172A" : "transparent",
                color: modoVista === "admin" ? "#FFFFFF" : "#475569",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Pencil size={13} />
              <span>Configuración</span>
            </button>

            <button
              type="button"
              onClick={() => setModoVista("cliente")}
              title="Vista de Cliente (Simulación de catálogo para comprador)"
              style={{
                padding: "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: modoVista === "cliente" ? (esFloristeria ? "#E11D48" : "#0284C7") : "transparent",
                color: modoVista === "cliente" ? "#FFFFFF" : "#475569",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "5px",
                transition: "all 0.15s ease",
              }}
            >
              <Eye size={13} />
              <span>Vista Cliente</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => setModalManualAbierto(true)}
            className="btn-responsive-accion"
            title="Ver Manual de Configuración"
            aria-label="Ver Manual de Configuración"
            style={{
              background: "#F8FAFC",
              color: "#334155",
              border: "1.5px solid #CBD5E1",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.85rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
            }}
          >
            <BookOpen size={15} color={esFloristeria ? "#E11D48" : "#0284C7"} />
            <span className="btn-texto-responsive">Manual de Uso</span>
          </button>

          {modoVista === "admin" && (
            <>
              <button
                type="button"
                onClick={() => setModalProdAbierto(true)}
                className="btn-responsive-accion"
                title={esFloristeria ? "Crear Nuevo Arreglo Floral" : "Crear Nuevo Producto"}
                aria-label={esFloristeria ? "Crear Nuevo Arreglo Floral" : "Crear Nuevo Producto"}
                style={{
                  background: esFloristeria ? "#E11D48" : "#0F172A",
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
                <span className="btn-texto-responsive">
                  {esFloristeria ? "Nuevo Arreglo" : esMantenimiento ? "Nuevo Servicio" : "Nuevo Honorario"}
                </span>
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
                <span className="btn-texto-responsive">{esFloristeria ? "Nueva Colección" : "Nueva Categoría"}</span>
              </button>
            </>
          )}

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

      {/* Selector de Pestaña: Catálogo vs Disponibilidad Operativa */}
      <div
        style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid #E2E8F0",
          marginBottom: "20px",
          paddingBottom: "8px",
        }}
      >
        <button
          type="button"
          onClick={() => setPestanaActiva("catalogo")}
          style={{
            background: pestanaActiva === "catalogo" ? (esFloristeria ? "#E11D48" : "#0284C7") : "transparent",
            color: pestanaActiva === "catalogo" ? "#FFFFFF" : "#64748B",
            border: "none",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
        >
          <LayoutGrid size={15} />
          <span>{esFloristeria ? "Catálogo y Diseños" : esMantenimiento ? "Servicios y Tarifas" : "Honorarios y Planes"}</span>
        </button>

        <button
          type="button"
          onClick={() => setPestanaActiva("disponibilidad")}
          style={{
            background: pestanaActiva === "disponibilidad" ? (esFloristeria ? "#E11D48" : "#0284C7") : "transparent",
            color: pestanaActiva === "disponibilidad" ? "#FFFFFF" : "#64748B",
            border: "none",
            padding: "8px 16px",
            borderRadius: "8px",
            fontSize: "0.85rem",
            fontWeight: 700,
            cursor: "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            transition: "all 0.15s ease",
          }}
        >
          <Activity size={15} />
          <span>
            {esFloristeria
              ? "Disponibilidad Taller (Rosas y Papel)"
              : esMantenimiento
              ? "Cuadrillas y Zonas en Vivo"
              : "Disponibilidad de Abogados"}
          </span>
        </button>
      </div>

      {pestanaActiva === "disponibilidad" ? (
        <TableroDisponibilidadOperativa negocio={negocio} />
      ) : (
        <>
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
                background: categoriaSeleccionada === c.ctg_slug ? (esFloristeria ? "#E11D48" : "#0284C7") : "#F1F5F9",
                color: categoriaSeleccionada === c.ctg_slug ? "#FFFFFF" : "#475569",
              }}
            >
              {c.ctg_nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Banner de Colección / Categoría con Recursos Digitales */}
      {categoriaSeleccionada !== "todas" && (() => {
        const catActiva = categoriasLista.find((c) => c.ctg_slug === categoriaSeleccionada);
        if (!catActiva) return null;
        const detalleCat = catActiva.ctg_detalle_categoria || {};
        const videoCat = detalleCat.video_url;
        const albumCat = detalleCat.album_fotos_url;

        return (
          <div
            style={{
              background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
              borderRadius: "14px",
              padding: "16px 20px",
              color: "#FFFFFF",
              marginBottom: "20px",
              display: "flex",
              flexWrap: "wrap",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "14px",
              boxShadow: "0 4px 15px rgba(15, 23, 42, 0.12)",
            }}
          >
            <div style={{ maxWidth: "560px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <span
                  style={{
                    background: esFloristeria ? "#E11D48" : "#0284C7",
                    color: "#FFFFFF",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    fontSize: "0.7rem",
                    fontWeight: 800,
                    textTransform: "uppercase",
                  }}
                >
                  {esFloristeria ? "Colección Floral" : "Categoría Comercial"}
                </span>
                <h2 style={{ margin: 0, fontSize: "1.18rem", fontWeight: 800 }}>{catActiva.ctg_nombre}</h2>
              </div>
              {catActiva.ctg_descripcion && (
                <p style={{ margin: "4px 0 0", fontSize: "0.83rem", color: "#CBD5E1", lineHeight: 1.4 }}>
                  {catActiva.ctg_descripcion}
                </p>
              )}
            </div>

            {/* Acciones de Recursos Digitales de la Categoría */}
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              {videoCat && (
                <button
                  type="button"
                  onClick={() => setVideoModalUrl(videoCat)}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(4px)",
                    color: "#FFFFFF",
                    border: "1px solid rgba(255, 255, 255, 0.3)",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <Play size={13} color="#38BDF8" />
                  <span>Ver Reel / Video</span>
                </button>
              )}
              {albumCat && (
                <a
                  href={albumCat}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: "rgba(255, 255, 255, 0.95)",
                    color: "#0F172A",
                    padding: "6px 12px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    textDecoration: "none",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <span>📸 Galería de Muestras</span>
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          </div>
        );
      })()}

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
            {modoVista === "admin" && (
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
            )}
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

            // Recolección de fotos de cada variante y del master para el carrusel
            const fotosDisponibles: Array<{
              url: string;
              origen: "master" | "variante" | "galeria";
              etiqueta: string;
              varianteId?: string;
              col?: any;
              posicion?: string;
              ajuste?: string;
              zoom?: number;
            }> = [];

            if (p.pro_detalle_producto?.imagen_url) {
              fotosDisponibles.push({
                url: p.pro_detalle_producto.imagen_url,
                origen: "master",
                etiqueta: "Foto Master",
                posicion: p.pro_detalle_producto.foto_posicion || "center center",
                ajuste: p.pro_detalle_producto.foto_ajuste || "cover",
                zoom: p.pro_detalle_producto.foto_zoom || 100,
              });
            }

            p.variantes.forEach((v, idx) => {
              if (v.var_detalle_variante?.portada_url && !fotosDisponibles.some((f) => f.url === v.var_detalle_variante.portada_url)) {
                const col = PALETA_COLORES_VARIANTES[idx % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;
                fotosDisponibles.push({
                  url: v.var_detalle_variante.portada_url,
                  origen: "variante",
                  etiqueta: v.var_nombre,
                  varianteId: v.var_id,
                  col,
                  posicion: v.var_detalle_variante.foto_posicion || p.pro_detalle_producto?.foto_posicion || "center center",
                  ajuste: v.var_detalle_variante.foto_ajuste || p.pro_detalle_producto?.foto_ajuste || "cover",
                  zoom: v.var_detalle_variante.foto_zoom || p.pro_detalle_producto?.foto_zoom || 100,
                });
              }
            });

            if (Array.isArray(p.pro_detalle_producto?.galeria_urls)) {
              p.pro_detalle_producto.galeria_urls.forEach((url: string, idx: number) => {
                if (url && !fotosDisponibles.some((f) => f.url === url)) {
                  fotosDisponibles.push({
                    url,
                    origen: "galeria",
                    etiqueta: `Muestra ${idx + 1}`,
                    posicion: p.pro_detalle_producto?.foto_posicion || "center center",
                    ajuste: p.pro_detalle_producto?.foto_ajuste || "cover",
                    zoom: p.pro_detalle_producto?.foto_zoom || 100,
                  });
                }
              });
            }

            const activeCarouselIdx = Math.min(
              fotoCarouselIndexPorProducto[p.pro_id] || 0,
              Math.max(0, fotosDisponibles.length - 1)
            );
            const fotoActual = fotosDisponibles[activeCarouselIdx];
            const fotoMostrar = fotoActual?.url || currentVar?.var_detalle_variante?.portada_url || p.pro_detalle_producto?.imagen_url;
            const posicionActual = fotoActual?.posicion || currentVar?.var_detalle_variante?.foto_posicion || p.pro_detalle_producto?.foto_posicion || "center center";
            const ajusteActual = fotoActual?.ajuste || currentVar?.var_detalle_variante?.foto_ajuste || p.pro_detalle_producto?.foto_ajuste || "cover";
            const zoomActual = Number(fotoActual?.zoom || currentVar?.var_detalle_variante?.foto_zoom || p.pro_detalle_producto?.foto_zoom || 100);
            const scaleFactor = zoomActual && zoomActual !== 100 ? zoomActual / 100 : 1;

            const videoMostrar = currentVar?.var_detalle_variante?.video_url || p.pro_detalle_producto?.video_url;
            const tiempoMostrar = currentVar?.var_detalle_variante?.tiempo_entrega || p.pro_detalle_producto?.tiempo_entrega;
            const albumUrl = currentVar?.var_detalle_variante?.album_url || p.pro_detalle_producto?.album_fotos_url;

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
                {/* Carrusel de Imágenes: Portada Master + Fotos de Variantes */}
                {fotoMostrar && (
                  <div style={{ position: "relative", width: "100%", aspectRatio: "1 / 1", background: "#0F172A", overflow: "hidden" }}>
                    {/* Fondo difuminado si el ajuste es contain */}
                    {ajusteActual === "contain" && (
                      <img
                        src={fotoMostrar}
                        alt=""
                        aria-hidden="true"
                        style={{
                          position: "absolute",
                          inset: 0,
                          width: "100%",
                          height: "100%",
                          objectFit: "cover",
                          filter: "blur(20px) brightness(0.6)",
                          transform: "scale(1.2)",
                          pointerEvents: "none",
                        }}
                      />
                    )}
                    <img
                      src={fotoMostrar}
                      alt={p.pro_nombre}
                      onError={(e) => {
                        // Si la URL falla (ej. página web o link caducado), fallback a placeholder floral estilizado
                        (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80";
                      }}
                      style={{
                        position: "relative",
                        width: "100%",
                        height: "100%",
                        objectFit: ajusteActual as any,
                        objectPosition: posicionActual,
                        transform: scaleFactor !== 1 ? `scale(${scaleFactor})` : undefined,
                        transformOrigin: posicionActual,
                        transition: "all 0.3s ease",
                      }}
                    />

                    {/* Botón de Video Demo si existe */}
                    {videoMostrar && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setVideoModalUrl(videoMostrar);
                        }}
                        style={{
                          position: "absolute",
                          top: "8px",
                          left: "8px",
                          background: "rgba(15, 23, 42, 0.85)",
                          backdropFilter: "blur(4px)",
                          color: "#FFFFFF",
                          border: "1px solid rgba(56, 189, 248, 0.4)",
                          padding: "4px 8px",
                          borderRadius: "8px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          zIndex: 3,
                          boxShadow: "0 2px 5px rgba(0,0,0,0.25)",
                        }}
                      >
                        <Play size={10} color="#38BDF8" fill="#38BDF8" />
                        <span>Video Reel</span>
                      </button>
                    )}

                    {/* Etiqueta de la foto actual del carrusel */}
                    {fotoActual && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          left: videoMostrar ? "105px" : "8px",
                          background: fotoActual.col ? fotoActual.col.bg : "rgba(15, 23, 42, 0.85)",
                          color: fotoActual.col ? fotoActual.col.text : "#FFFFFF",
                          border: fotoActual.col ? `1.5px solid ${fotoActual.col.border}` : "1px solid rgba(255,255,255,0.3)",
                          backdropFilter: "blur(4px)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          fontWeight: 800,
                          zIndex: 2,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                        }}
                      >
                        {fotoActual.col && (
                          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: fotoActual.col.dot }} />
                        )}
                        <span>{fotoActual.etiqueta}</span>
                      </div>
                    )}

                    {/* Flechas de Navegación del Carrusel si hay más de 1 imagen */}
                    {fotosDisponibles.length > 1 && (
                      <>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const prevIdx = (activeCarouselIdx - 1 + fotosDisponibles.length) % fotosDisponibles.length;
                            setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: prevIdx }));
                            const targetFoto = fotosDisponibles[prevIdx];
                            if (targetFoto?.varianteId) {
                              setVarianteSeleccionadaPorProducto((prev) => ({ ...prev, [p.pro_id]: targetFoto.varianteId! }));
                            }
                          }}
                          title="Foto anterior"
                          aria-label="Foto anterior"
                          style={{
                            position: "absolute",
                            top: "50%",
                            left: "8px",
                            transform: "translateY(-50%)",
                            background: "rgba(255, 255, 255, 0.9)",
                            border: "none",
                            borderRadius: "50%",
                            width: "28px",
                            height: "28px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                            zIndex: 3,
                          }}
                        >
                          <ChevronLeft size={16} color="#0F172A" />
                        </button>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            const nextIdx = (activeCarouselIdx + 1) % fotosDisponibles.length;
                            setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: nextIdx }));
                            const targetFoto = fotosDisponibles[nextIdx];
                            if (targetFoto?.varianteId) {
                              setVarianteSeleccionadaPorProducto((prev) => ({ ...prev, [p.pro_id]: targetFoto.varianteId! }));
                            }
                          }}
                          title="Foto siguiente"
                          aria-label="Foto siguiente"
                          style={{
                            position: "absolute",
                            top: "50%",
                            right: "8px",
                            transform: "translateY(-50%)",
                            background: "rgba(255, 255, 255, 0.9)",
                            border: "none",
                            borderRadius: "50%",
                            width: "28px",
                            height: "28px",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            cursor: "pointer",
                            boxShadow: "0 2px 6px rgba(0,0,0,0.25)",
                            zIndex: 3,
                          }}
                        >
                          <ChevronRight size={16} color="#0F172A" />
                        </button>

                        {/* Indicadores de bolitas del carrusel */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: "8px",
                            left: "50%",
                            transform: "translateX(-50%)",
                            display: "flex",
                            gap: "5px",
                            background: "rgba(15, 23, 42, 0.65)",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backdropFilter: "blur(4px)",
                            zIndex: 3,
                          }}
                        >
                          {fotosDisponibles.map((f, fIdx) => {
                            const isDotActive = fIdx === activeCarouselIdx;
                            return (
                              <button
                                key={fIdx}
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: fIdx }));
                                  if (f.varianteId) {
                                    setVarianteSeleccionadaPorProducto((prev) => ({ ...prev, [p.pro_id]: f.varianteId! }));
                                  }
                                }}
                                style={{
                                  width: isDotActive ? "16px" : "6px",
                                  height: "6px",
                                  borderRadius: "3px",
                                  border: "none",
                                  background: isDotActive ? (f.col ? f.col.border : "#38BDF8") : "rgba(255, 255, 255, 0.5)",
                                  cursor: "pointer",
                                  padding: 0,
                                  transition: "all 0.2s ease",
                                }}
                              />
                            );
                          })}
                        </div>
                      </>
                    )}

                    {tiempoMostrar && (
                      <div
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          left: "8px",
                          background: "rgba(15, 23, 42, 0.85)",
                          backdropFilter: "blur(4px)",
                          color: "#FFFFFF",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          zIndex: 2,
                        }}
                      >
                        <Clock size={11} color="#38BDF8" />
                        <span>{tiempoMostrar}</span>
                      </div>
                    )}
                    {albumUrl && (
                      <a
                        href={albumUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          right: "8px",
                          background: "rgba(255, 255, 255, 0.9)",
                          color: "#0F172A",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          zIndex: 2,
                        }}
                      >
                        📸 Muestras Reales
                      </a>
                    )}
                  </div>
                )}

                {/* Barra Superior de la Tarjeta: Destacado + Botón Editar Master */}
                <div
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    zIndex: 4,
                  }}
                >
                  {p.pro_destacado && (
                    <div
                      style={{
                        background: "linear-gradient(135deg, #F59E0B, #D97706)",
                        color: "#FFFFFF",
                        padding: "2px 8px",
                        borderRadius: "12px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        display: "flex",
                        alignItems: "center",
                        gap: "4px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                      }}
                    >
                      <Sparkles size={10} />
                      DESTACADO
                    </div>
                  )}

                  {modoVista === "admin" && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setProductoAEditar(p);
                        setVarianteAEditarId(undefined); // Abre pestaña del Producto Master
                        setModalEditarAbierto(true);
                      }}
                      className="btn-responsive-accion"
                      title="Editar datos generales del producto master"
                      aria-label="Editar datos generales del producto master"
                      style={{
                        background: "rgba(15, 23, 42, 0.9)",
                        border: "1.5px solid rgba(56, 189, 248, 0.4)",
                        color: "#FFFFFF",
                        padding: "5px 10px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        boxShadow: "0 2px 6px rgba(0,0,0,0.2)",
                      }}
                    >
                      <Pencil size={12} color="#38BDF8" />
                      <span className="btn-texto-responsive">Editar Master</span>
                    </button>
                  )}
                </div>

                <div style={{ padding: "18px 20px", display: "flex", flexDirection: "column", flex: 1 }}>
                  {/* Icono y Categoría */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    {!fotoMostrar && (
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
                        }}
                      >
                        {getIconoProducto(p)}
                      </div>
                    )}
                    <div>
                      <span
                        style={{
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "#64748B",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {p.categoria?.ctg_nombre || "Catálogo"}
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
                      margin: "0 0 14px",
                      fontSize: "0.82rem",
                      color: "#475569",
                      lineHeight: 1.45,
                      flex: 1,
                    }}
                  >
                    {p.pro_descripcion}
                  </p>

                  {/* Badge de Logística / Entrega a Domicilio */}
                  {Boolean(p.pro_detalle_producto?.logistica?.delivery_incluido) && (
                    <div
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        background: "linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%)",
                        border: "1px solid #10B981",
                        color: "#065F46",
                        padding: "4px 10px",
                        borderRadius: "8px",
                        fontSize: "0.72rem",
                        fontWeight: 800,
                        marginBottom: "12px",
                        boxShadow: "0 1px 2px rgba(16, 185, 129, 0.1)",
                        alignSelf: "flex-start",
                      }}
                    >
                      <Truck size={13} color="#059669" />
                      <span>{p.pro_detalle_producto?.logistica?.etiqueta_transporte || "🚚 Envío a Domicilio Incluido"}</span>
                      {p.pro_detalle_producto?.logistica?.cobertura_texto && (
                        <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "#047857", marginLeft: "2px" }}>
                          • {p.pro_detalle_producto.logistica.cobertura_texto}
                        </span>
                      )}
                    </div>
                  )}

                  {/* Selector de Variantes / Tamaños con Colores Individuales */}
                  {p.variantes.length > 1 && (
                    <div style={{ marginBottom: "14px" }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.73rem",
                          fontWeight: 700,
                          color: "#334155",
                          marginBottom: "6px",
                        }}
                      >
                        {esFloristeria ? "Selecciona el tamaño / cantidad de rosas:" : "Selecciona la variante / opción:"}
                      </label>
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {p.variantes.map((v, vIdx) => {
                          const activa = currentVarId === v.var_id;
                          const colVar = PALETA_COLORES_VARIANTES[vIdx % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;

                          return (
                            <div
                              key={v.var_id}
                              onClick={() => {
                                setVarianteSeleccionadaPorProducto((prev) => ({
                                  ...prev,
                                  [p.pro_id]: v.var_id,
                                }));
                                // Sincronizar carrusel si la variante tiene su propia foto
                                const fotoVarIdx = fotosDisponibles.findIndex(
                                  (f) => f.varianteId === v.var_id || (v.var_detalle_variante?.portada_url && f.url === v.var_detalle_variante.portada_url)
                                );
                                if (fotoVarIdx >= 0) {
                                  setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: fotoVarIdx }));
                                } else {
                                  setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: 0 }));
                                }
                              }}
                              style={{
                                textAlign: "left",
                                padding: "8px 12px",
                                borderRadius: "8px",
                                border: activa
                                  ? `2px solid ${colVar.border}`
                                  : `1.5px solid ${colVar.border}44`,
                                background: activa
                                  ? colVar.bg
                                  : "#FFFFFF",
                                cursor: "pointer",
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                transition: "all 0.15s ease",
                                boxShadow: activa ? `0 2px 6px ${colVar.border}22` : "none",
                              }}
                            >
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colVar.dot, flexShrink: 0 }} />
                                <div
                                  style={{
                                    fontSize: "0.8rem",
                                    fontWeight: activa ? 800 : 600,
                                    color: activa
                                      ? colVar.text
                                      : "#334155",
                                  }}
                                >
                                  {v.var_nombre}
                                </div>
                                {v.var_detalle_variante?.portada_url && (
                                  <span style={{ fontSize: "0.62rem", background: colVar.badge, color: colVar.text, padding: "1px 5px", borderRadius: "4px", fontWeight: 700 }}>
                                    📸 Foto
                                  </span>
                                )}
                              </div>

                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <div style={{ fontSize: "0.85rem", fontWeight: 800, color: activa ? colVar.text : "#0F172A" }}>
                                  ${v.precio_total.toFixed(2)}
                                </div>

                                {modoVista === "admin" && (
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setProductoAEditar(p);
                                      setVarianteAEditarId(v.var_id);
                                      setModalEditarAbierto(true);
                                    }}
                                    title={`Editar variante ${v.var_nombre}`}
                                    aria-label={`Editar variante ${v.var_nombre}`}
                                    style={{
                                      background: colVar.badge,
                                      border: `1px solid ${colVar.border}`,
                                      borderRadius: "6px",
                                      padding: "3px 7px",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      fontSize: "0.7rem",
                                      color: colVar.text,
                                      fontWeight: 800,
                                    }}
                                  >
                                    <Pencil size={11} />
                                    <span className="btn-texto-responsive">Editar</span>
                                  </button>
                                )}
                              </div>
                            </div>
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
                      background: esFloristeria ? "#E11D48" : "#0284C7",
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
                      boxShadow: esFloristeria
                        ? "0 2px 6px rgba(225, 29, 72, 0.25)"
                        : "0 2px 6px rgba(2, 132, 199, 0.25)",
                    }}
                  >
                    <CreditCard size={16} />
                    {esFloristeria ? "Comprar Arreglo con Payphone" : "Contratar y Pagar con Payphone"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
      </>
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

      {/* Modal Editar Producto / Honorario */}
      <ModalEditarProducto
        abierto={modalEditarAbierto}
        producto={productoAEditar}
        varianteInicialId={varianteAEditarId}
        onCerrar={() => {
          setModalEditarAbierto(false);
          setProductoAEditar(null);
          setVarianteAEditarId(undefined);
        }}
        onProductoEditado={(editado) => {
          setProductos((prev) =>
            prev.map((item) => (item.pro_id === editado.pro_id ? editado : item))
          );
        }}
        onProductoEliminado={(proId) => {
          setProductos((prev) => prev.filter((item) => item.pro_id !== proId));
        }}
        categorias={categoriasLista}
        negocio={negocio}
        onAbrirManual={() => setModalManualAbierto(true)}
      />

      {/* Manual Interactivo de Configuración Comercial por Negocio */}
      <ManualConfiguracionCatalogoModal
        abierto={modalManualAbierto}
        onCerrar={() => setModalManualAbierto(false)}
        negocio={negocio}
      />

      {/* Reproductor de Video / Reels en Modal */}
      {videoModalUrl && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            backgroundColor: "rgba(15, 23, 42, 0.85)",
            backdropFilter: "blur(6px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 10001,
            padding: "16px",
          }}
          onClick={() => setVideoModalUrl(null)}
        >
          <div
            style={{
              background: "#0F172A",
              borderRadius: "16px",
              width: "100%",
              maxWidth: "760px",
              overflow: "hidden",
              position: "relative",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.5)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              style={{
                padding: "12px 18px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                borderBottom: "1px solid #334155",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "#38BDF8", fontWeight: 700, fontSize: "0.88rem" }}>
                <Video size={17} />
                <span>Demostración en Video / Reel</span>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalUrl(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#94A3B8",
                  cursor: "pointer",
                  padding: "4px",
                }}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ position: "relative", width: "100%", paddingTop: "56.25%", background: "#000000" }}>
              {videoModalUrl.includes("youtube.com") || videoModalUrl.includes("youtu.be") || videoModalUrl.includes("vimeo.com") ? (
                <iframe
                  src={videoModalUrl.replace("watch?v=", "embed/").replace("youtu.be/", "youtube.com/embed/")}
                  title="Video de Demostración"
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <video
                  src={videoModalUrl}
                  controls
                  autoPlay
                  style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", objectFit: "contain" }}
                />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
