"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useEffect, useMemo, useState } from "react";
import {
  Check,
  ExternalLink,
  Image as ImageIcon,
  Images,
  Loader2,
  Search,
  Send,
  ShoppingBag,
  Sparkles,
  X,
} from "lucide-react";
import { obtenerCatalogoProductosAction, type ProductoCatalogo } from "../acciones";
import { listarEntregaInmediataAction } from "../acciones-operaciones-taller";
import {
  construirMensajeProductoCatalogoOmnicanal,
  type SalidaCompartirProductoCatalogo,
} from "../omnicanal";

export interface SeleccionProductoCatalogoChat extends SalidaCompartirProductoCatalogo {
  productoId: string;
  nombreProducto: string;
  nombreVariante?: string | null;
  precioUsd?: number | null;
}

export interface PropiedadesModalSelectorCatalogoChat {
  abierto: boolean;
  negocio: string;
  wref?: string | null;
  esMovil?: boolean;
  enviandoDirecto?: boolean;
  onCerrar: () => void;
  onInsertarEnCompositor: (seleccion: SeleccionProductoCatalogoChat) => void;
  onEnviarDirecto: (seleccion: SeleccionProductoCatalogoChat) => void;
}

function resolverImagenPrincipalProducto(
  prod: ProductoCatalogo,
  varianteIdx: number
): string | null {
  const varAct = prod.variantes?.[varianteIdx] ?? prod.variantes?.[0];
  const detVar = (varAct?.var_detalle_variante ?? {}) as Record<string, any>;
  const detProd = (prod.pro_detalle_producto ?? {}) as Record<string, any>;
  const candidata =
    detVar.portada_url ||
    detVar.imagen_url ||
    (Array.isArray(detVar.galeria_urls) ? detVar.galeria_urls[0] : null) ||
    detProd.imagen_url ||
    detProd.portada_url ||
    (Array.isArray(detProd.galeria_urls) ? detProd.galeria_urls[0] : null) ||
    null;
  return typeof candidata === "string" && candidata.trim() ? candidata.trim() : null;
}

function resolverAlbumProducto(prod: ProductoCatalogo, varianteIdx: number): string | null {
  const varAct = prod.variantes?.[varianteIdx] ?? prod.variantes?.[0];
  const detVar = (varAct?.var_detalle_variante ?? {}) as Record<string, any>;
  const detProd = (prod.pro_detalle_producto ?? {}) as Record<string, any>;
  const detCat = ((prod.categoria as any)?.ctg_detalle_categoria ?? {}) as Record<string, any>;
  const candidata =
    detVar.album_url ||
    detVar.album_fotos_url ||
    detProd.album_fotos_url ||
    detProd.album_url ||
    detCat.album_fotos_url ||
    null;
  return typeof candidata === "string" && /^https?:\/\//i.test(candidata.trim())
    ? candidata.trim()
    : null;
}

export function ModalSelectorCatalogoChat({
  abierto,
  negocio,
  wref = null,
  esMovil = false,
  enviandoDirecto = false,
  onCerrar,
  onInsertarEnCompositor,
  onEnviarDirecto,
}: PropiedadesModalSelectorCatalogoChat) {
  const [cargando, setCargando] = useState(false);
  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [busqueda, setBusqueda] = useState("");
  const [categoriaFiltro, setCategoriaFiltro] = useState<string>("TODAS");
  const [productoSelId, setProductoSelId] = useState<string | null>(null);
  const [variantePorProducto, setVariantePorProducto] = useState<Record<string, number>>({});

  const [incluirFotoPrincipal, setIncluirFotoPrincipal] = useState(true);
  const [incluirLinkWeb, setIncluirLinkWeb] = useState(true);
  const [incluirLinkAlbum, setIncluirLinkAlbum] = useState(true);
  const [albumManualOverride, setAlbumManualOverride] = useState("");

  useEffect(() => {
    if (!abierto) return;
    let cancelado = false;
    setCargando(true);

    Promise.all([
      obtenerCatalogoProductosAction(negocio).catch(() => [] as ProductoCatalogo[]),
      listarEntregaInmediataAction(negocio, false).catch(() => ({ ok: false as const, items: [] })),
    ])
      .then(([listaCatalogo, resInmediata]) => {
        if (cancelado) return;
        const itemsInmediatos: ProductoCatalogo[] =
          resInmediata.ok && Array.isArray(resInmediata.items)
            ? resInmediata.items.map((it) => ({
                pro_id: `inm-${it.productoId}`,
                pro_negocio: negocio,
                pro_nombre: `⚡ ${it.nombre}`,
                pro_slug: it.slug || "entrega-inmediata",
                pro_descripcion: it.descripcion || it.tiempoEntregaTexto || "Listo hoy en tienda",
                pro_tipo: "FISICO",
                pro_destacado: true,
                pro_activo: true,
                pro_categoria_principal_id: "cat-entrega-inmediata",
                pro_detalle_producto: {
                  imagen_url: it.imagenUrl || null,
                  tiempo_entrega: it.tiempoEntregaTexto,
                },
                categoria: {
                  ctg_id: "cat-entrega-inmediata",
                  ctg_nombre: "⚡ Entrega Inmediata",
                  ctg_slug: "entrega-inmediata",
                },
                variantes: [
                  {
                    var_id: `var-inm-${it.varianteId || it.productoId}`,
                    var_producto_id: `inm-${it.productoId}`,
                    var_sku: it.sku || "",
                    var_nombre: it.tiempoEntregaTexto || "Listo 1–2h",
                    var_precio: Number(it.precio) || 0,
                    var_codigo_impuesto_sri: "IVA_0",
                    var_tarifa_iva_porcentaje: 0,
                    var_tipo_oferta: "REGULAR",
                    var_activo: true,
                    var_detalle_variante: { imagen_url: it.imagenUrl || null },
                    monto_iva: 0,
                    precio_total: Number(it.precio) || 0,
                  },
                ],
              }))
            : [];

        const combinados = [...itemsInmediatos, ...(Array.isArray(listaCatalogo) ? listaCatalogo : [])];
        setProductos(combinados);
        if (combinados.length > 0 && !productoSelId) {
          setProductoSelId(combinados[0]!.pro_id);
        }
      })
      .finally(() => {
        if (!cancelado) setCargando(false);
      });

    return () => {
      cancelado = true;
    };
  }, [abierto, negocio]);

  const categoriasDisponibles = useMemo(() => {
    const mapa = new Map<string, string>();
    for (const p of productos) {
      const slug = p.categoria?.ctg_slug || "general";
      const nombre = p.categoria?.ctg_nombre || "Catálogo";
      if (!mapa.has(slug)) mapa.set(slug, nombre);
    }
    return Array.from(mapa.entries()).map(([slug, nombre]) => ({ slug, nombre }));
  }, [productos]);

  const productosFiltrados = useMemo(() => {
    const q = busqueda.trim().toLowerCase();
    return productos.filter((p) => {
      if (categoriaFiltro !== "TODAS" && (p.categoria?.ctg_slug || "general") !== categoriaFiltro) {
        return false;
      }
      if (!q) return true;
      const enNombre = p.pro_nombre.toLowerCase().includes(q);
      const enSlug = (p.pro_slug || "").toLowerCase().includes(q);
      const enCat = (p.categoria?.ctg_nombre || "").toLowerCase().includes(q);
      const enVar = (p.variantes || []).some(
        (v) => v.var_nombre.toLowerCase().includes(q) || (v.var_sku || "").toLowerCase().includes(q)
      );
      return enNombre || enSlug || enCat || enVar;
    });
  }, [productos, busqueda, categoriaFiltro]);

  const productoSeleccionado = useMemo(
    () =>
      productos.find((p) => p.pro_id === productoSelId) ??
      productosFiltrados[0] ??
      null,
    [productos, productoSelId, productosFiltrados]
  );

  useEffect(() => {
    setAlbumManualOverride("");
  }, [productoSeleccionado?.pro_id]);

  const indiceVarianteSel = productoSeleccionado
    ? variantePorProducto[productoSeleccionado.pro_id] ?? 0
    : 0;
  const variantesActivas = useMemo(
    () =>
      (productoSeleccionado?.variantes || []).filter((v) => v.var_activo !== false),
    [productoSeleccionado]
  );
  const varianteActual = variantesActivas[indiceVarianteSel] ?? variantesActivas[0] ?? null;

  const baseTiendaActual =
    typeof window !== "undefined" && window.location?.origin
      ? window.location.origin
      : undefined;

  const vistaPrevia = useMemo<SeleccionProductoCatalogoChat | null>(() => {
    if (!productoSeleccionado) return null;
    const imgUrl = resolverImagenPrincipalProducto(productoSeleccionado, indiceVarianteSel);
    const albumCatalogo = resolverAlbumProducto(productoSeleccionado, indiceVarianteSel);
    const albumEfectivo = albumManualOverride.trim() || albumCatalogo;
    const precio = varianteActual
      ? Number(varianteActual.precio_total ?? varianteActual.var_precio ?? 0)
      : null;

    const construido = construirMensajeProductoCatalogoOmnicanal({
      negocio,
      baseUrlTienda: baseTiendaActual,
      nombreProducto: productoSeleccionado.pro_nombre.replace(/^⚡\s*/, ""),
      slugProducto: productoSeleccionado.pro_slug,
      nombreVariante:
        variantesActivas.length > 1 ? varianteActual?.var_nombre ?? null : null,
      skuVariante:
        variantesActivas.length > 1 ? varianteActual?.var_sku ?? null : null,
      precioUsd: precio,
      imagenUrl: imgUrl,
      albumFotosUrl: albumEfectivo,
      incluirFotoPrincipal,
      incluirLinkWeb,
      incluirLinkAlbum: incluirLinkAlbum && Boolean(albumEfectivo),
      wref,
    });

    return {
      ...construido,
      productoId: productoSeleccionado.pro_id,
      nombreProducto: productoSeleccionado.pro_nombre,
      nombreVariante: varianteActual?.var_nombre ?? null,
      precioUsd: precio,
    };
  }, [
    productoSeleccionado,
    indiceVarianteSel,
    varianteActual,
    variantesActivas.length,
    negocio,
    baseTiendaActual,
    albumManualOverride,
    incluirFotoPrincipal,
    incluirLinkWeb,
    incluirLinkAlbum,
    wref,
  ]);

  if (!abierto) return null;

  const imgSeleccionada = productoSeleccionado
    ? resolverImagenPrincipalProducto(productoSeleccionado, indiceVarianteSel)
    : null;
  const albumSeleccionado = productoSeleccionado
    ? resolverAlbumProducto(productoSeleccionado, indiceVarianteSel)
    : null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Seleccionar producto del catálogo para enviar al chat"
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9950,
        backgroundColor: "rgba(15, 23, 42, 0.56)",
        backdropFilter: "blur(3px)",
        display: "flex",
        alignItems: esMovil ? "flex-end" : "center",
        justifyContent: "center",
        padding: esMovil ? "0" : "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: esMovil ? "100%" : "780px",
          maxHeight: esMovil ? "92dvh" : "86vh",
          backgroundColor: "#FFFFFF",
          borderRadius: esMovil ? "20px 20px 0 0" : "18px",
          boxShadow: "0 24px 54px rgba(15, 23, 42, 0.28)",
          border: "1px solid #E6E2DA",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: esMovil ? "14px 16px 12px" : "16px 20px",
            borderBottom: "1px solid #E6E2DA",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "12px",
            backgroundColor: "#F8F7F4",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0 }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                backgroundColor: "#F2F6F3",
                color: "#2F4737",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0,
              }}
            >
              <ShoppingBag size={18} />
            </div>
            <div style={{ minWidth: 0 }}>
              <div
                style={{
                  fontSize: "15px",
                  fontWeight: 700,
                  color: "#1F1C19",
                  lineHeight: 1.2,
                }}
              >
                Enviar Producto del Catálogo
              </div>
              <div style={{ fontSize: "12px", color: "#847D74", marginTop: "2px" }}>
                Foto principal · Link web · Álbum de fotos
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar selector de catálogo"
            aria-label="Cerrar selector de catálogo"
            style={{
              width: "36px",
              height: "36px",
              borderRadius: "10px",
              border: "1px solid #E6E2DA",
              backgroundColor: "#FFFFFF",
              color: "#57524C",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              flexShrink: 0,
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Buscador y filtros */}
        <div
          style={{
            padding: "10px 16px",
            borderBottom: "1px solid #F4F2EE",
            display: "flex",
            flexDirection: "column",
            gap: "8px",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              border: "1px solid #D5CFC4",
              borderRadius: "10px",
              padding: "0 12px",
              backgroundColor: "#FFFFFF",
              height: "40px",
            }}
          >
            <Search size={16} color="#847D74" />
            <input
              type="search"
              value={busqueda}
              onChange={(e) => setBusqueda(e.target.value)}
              placeholder="Buscar arreglo, código o categoría..."
              style={{
                flex: 1,
                border: "none",
                outline: "none",
                fontSize: "16px",
                color: "#1F1C19",
                backgroundColor: "transparent",
              }}
            />
            {busqueda && (
              <button
                type="button"
                onClick={() => setBusqueda("")}
                title="Limpiar búsqueda"
                aria-label="Limpiar búsqueda"
                style={{
                  border: "none",
                  background: "transparent",
                  color: "#847D74",
                  cursor: "pointer",
                  padding: "4px",
                  display: "flex",
                }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {categoriasDisponibles.length > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                overflowX: "auto",
                paddingBottom: "2px",
              }}
            >
              <button
                type="button"
                onClick={() => setCategoriaFiltro("TODAS")}
                title="Ver todas las categorías"
                aria-label="Ver todas las categorías"
                style={{
                  padding: "5px 11px",
                  borderRadius: "999px",
                  border:
                    categoriaFiltro === "TODAS"
                      ? "1px solid #1F1C19"
                      : "1px solid #E6E2DA",
                  backgroundColor: categoriaFiltro === "TODAS" ? "#1F1C19" : "#F8F7F4",
                  color: categoriaFiltro === "TODAS" ? "#FFFFFF" : "#57524C",
                  fontSize: "12px",
                  fontWeight: 600,
                  whiteSpace: "nowrap",
                  cursor: "pointer",
                }}
              >
                Todos ({productos.length})
              </button>
              {categoriasDisponibles.map((cat) => {
                const activa = categoriaFiltro === cat.slug;
                return (
                  <button
                    key={cat.slug}
                    type="button"
                    onClick={() => setCategoriaFiltro(cat.slug)}
                    title={`Filtrar por ${cat.nombre}`}
                    aria-label={`Filtrar por ${cat.nombre}`}
                    style={{
                      padding: "5px 11px",
                      borderRadius: "999px",
                      border: activa ? "1px solid #2F4737" : "1px solid #E6E2DA",
                      backgroundColor: activa ? "#F2F6F3" : "#F8F7F4",
                      color: activa ? "#2B4A36" : "#57524C",
                      fontSize: "12px",
                      fontWeight: 600,
                      whiteSpace: "nowrap",
                      cursor: "pointer",
                    }}
                  >
                    {cat.nombre}
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* Cuerpo principal: Lista de productos + Configuración de envío */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            display: "flex",
            flexDirection: esMovil ? "column" : "row",
            overflowY: esMovil ? "auto" : "hidden",
          }}
        >
          {/* Columna izquierda: Lista de productos */}
          <div
            style={{
              flex: esMovil ? "0 0 auto" : "1 1 54%",
              maxHeight: esMovil ? "245px" : "none",
              overflowY: "auto",
              borderRight: esMovil ? "none" : "1px solid #E6E2DA",
              borderBottom: esMovil ? "1px solid #E6E2DA" : "none",
              padding: "10px 12px",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
            }}
          >
            {cargando ? (
              <div
                style={{
                  padding: "36px 16px",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "10px",
                  color: "#847D74",
                  fontSize: "13px",
                }}
              >
                <Loader2 size={22} />
                <span>Cargando catálogo comercial...</span>
              </div>
            ) : productosFiltrados.length === 0 ? (
              <div
                style={{
                  padding: "28px 16px",
                  textAlign: "center",
                  color: "#847D74",
                  fontSize: "13px",
                }}
              >
                No se encontraron productos con ese criterio.
              </div>
            ) : (
              productosFiltrados.map((prod) => {
                const seleccionado = productoSeleccionado?.pro_id === prod.pro_id;
                const idxVar = variantePorProducto[prod.pro_id] ?? 0;
                const vars = (prod.variantes || []).filter((v) => v.var_activo !== false);
                const varPrincipal = vars[idxVar] ?? vars[0];
                const precio = varPrincipal
                  ? Number(varPrincipal.precio_total ?? varPrincipal.var_precio ?? 0)
                  : 0;
                const miniatura = resolverImagenPrincipalProducto(prod, idxVar);
                const tieneAlbum = Boolean(resolverAlbumProducto(prod, idxVar));

                return (
                  <div
                    key={prod.pro_id}
                    onClick={() => setProductoSelId(prod.pro_id)}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      padding: "9px 10px",
                      borderRadius: "12px",
                      border: seleccionado
                        ? "2px solid #2F4737"
                        : "1px solid #E6E2DA",
                      backgroundColor: seleccionado ? "#F2F6F3" : "#FFFFFF",
                      cursor: "pointer",
                      transition: "border-color 120ms ease, background-color 120ms ease",
                    }}
                  >
                    {miniatura ? (
                      <img
                        src={miniatura}
                        alt={prod.pro_nombre}
                        loading="lazy"
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "10px",
                          objectFit: "cover",
                          flexShrink: 0,
                          border: "1px solid #E6E2DA",
                          backgroundColor: "#F8F7F4",
                        }}
                      />
                    ) : (
                      <div
                        style={{
                          width: "52px",
                          height: "52px",
                          borderRadius: "10px",
                          backgroundColor: "#F4F2EE",
                          color: "#847D74",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <ImageIcon size={20} />
                      </div>
                    )}

                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div
                        style={{
                          fontSize: "13.5px",
                          fontWeight: 700,
                          color: "#1F1C19",
                          whiteSpace: "nowrap",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                        }}
                      >
                        {prod.pro_nombre}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          flexWrap: "wrap",
                          gap: "6px",
                          marginTop: "3px",
                        }}
                      >
                        {precio > 0 && (
                          <span
                            style={{
                              fontSize: "12px",
                              fontWeight: 700,
                              color: "#2F4737",
                            }}
                          >
                            ${precio.toFixed(2)}
                          </span>
                        )}
                        {miniatura && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "1px 6px",
                              borderRadius: "6px",
                              backgroundColor: "#F4F2EE",
                              color: "#221E1B",
                              fontWeight: 600,
                            }}
                          >
                            🖼️ Foto
                          </span>
                        )}
                        <span
                          style={{
                            fontSize: "11px",
                            padding: "1px 6px",
                            borderRadius: "6px",
                            backgroundColor: "#F4F2EE",
                            color: "#57524C",
                            fontWeight: 600,
                          }}
                        >
                          🌐 Web
                        </span>
                        {tieneAlbum && (
                          <span
                            style={{
                              fontSize: "11px",
                              padding: "1px 6px",
                              borderRadius: "6px",
                              backgroundColor: "#F8F7F4",
                              color: "#7E22CE",
                              fontWeight: 600,
                            }}
                          >
                            📸 Álbum
                          </span>
                        )}
                      </div>
                    </div>

                    {seleccionado && (
                      <div
                        style={{
                          width: "24px",
                          height: "24px",
                          borderRadius: "999px",
                          backgroundColor: "#2F4737",
                          color: "#FFFFFF",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                        }}
                      >
                        <Check size={14} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Columna derecha: Opciones de envío y vista previa */}
          <div
            style={{
              flex: esMovil ? "1 1 auto" : "1 1 46%",
              overflowY: esMovil ? "visible" : "auto",
              padding: "14px 16px",
              backgroundColor: "#F8F7F4",
              display: "flex",
              flexDirection: "column",
              gap: "12px",
            }}
          >
            {productoSeleccionado && vistaPrevia ? (
              <>
                {variantesActivas.length > 1 && (
                  <div>
                    <label
                      style={{
                        display: "block",
                        fontSize: "11.5px",
                        fontWeight: 700,
                        color: "#57524C",
                        marginBottom: "4px",
                      }}
                    >
                      Variación / Tamaño
                    </label>
                    <SelectConBuscador
                      value={indiceVarianteSel}
                      onChange={(e) =>
                        setVariantePorProducto((prev) => ({
                          ...prev,
                          [productoSeleccionado.pro_id]: Number(e.target.value) || 0,
                        }))
                      }
                      style={{
                        width: "100%",
                        height: "38px",
                        borderRadius: "9px",
                        border: "1px solid #D5CFC4",
                        backgroundColor: "#FFFFFF",
                        padding: "0 10px",
                        fontSize: "14px",
                        color: "#1F1C19",
                      }}
                    >
                      {variantesActivas.map((v, idx) => (
                        <option key={v.var_id} value={idx}>
                          {v.var_nombre} — $
                          {Number(v.precio_total ?? v.var_precio ?? 0).toFixed(2)}
                        </option>
                      ))}
                    </SelectConBuscador>
                  </div>
                )}

                {/* Checkboxes de elementos a enviar */}
                <div
                  style={{
                    backgroundColor: "#FFFFFF",
                    border: "1px solid #E6E2DA",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11.5px",
                      fontWeight: 700,
                      color: "#57524C",
                      textTransform: "uppercase",
                      letterSpacing: "0.03em",
                    }}
                  >
                    ¿Qué deseas enviar al cliente?
                  </div>

                  {/* 1. Foto principal */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: imgSeleccionada ? "#1F1C19" : "#847D74",
                      cursor: imgSeleccionada ? "pointer" : "not-allowed",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={incluirFotoPrincipal && Boolean(imgSeleccionada)}
                      disabled={!imgSeleccionada}
                      onChange={(e) => setIncluirFotoPrincipal(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#2F4737" }}
                    />
                    <ImageIcon size={15} color={imgSeleccionada ? "#221E1B" : "#847D74"} />
                    <span style={{ fontWeight: 600 }}>
                      Foto principal del producto
                      {!imgSeleccionada ? " (sin foto cargada)" : ""}
                    </span>
                  </label>

                  {/* 2. Link para revisar en la web */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#1F1C19",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={incluirLinkWeb}
                      onChange={(e) => setIncluirLinkWeb(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#2F4737" }}
                    />
                    <ExternalLink size={15} color="#2F4737" />
                    <span style={{ fontWeight: 600 }}>Link para revisar en la web</span>
                  </label>

                  {/* 3. Link del álbum del producto */}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                      fontSize: "13px",
                      color: "#1F1C19",
                      cursor: "pointer",
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={incluirLinkAlbum}
                      onChange={(e) => setIncluirLinkAlbum(e.target.checked)}
                      style={{ width: "16px", height: "16px", accentColor: "#2F4737" }}
                    />
                    <Images size={15} color="#7E22CE" />
                    <span style={{ fontWeight: 600 }}>Link del álbum del producto</span>
                  </label>

                  {incluirLinkAlbum && !albumSeleccionado && (
                    <input
                      type="url"
                      value={albumManualOverride}
                      onChange={(e) => setAlbumManualOverride(e.target.value)}
                      placeholder="https://photos.app.goo.gl/... (opcional si aún no está en catálogo)"
                      style={{
                        width: "100%",
                        height: "36px",
                        borderRadius: "8px",
                        border: "1px solid #D5CFC4",
                        padding: "0 10px",
                        fontSize: "14px",
                        color: "#1F1C19",
                        boxSizing: "border-box",
                      }}
                    />
                  )}
                </div>

                {/* Vista previa de cómo le llegará al cliente */}
                <div
                  style={{
                    backgroundColor: "#DCF8C6",
                    border: "1px solid #BBF7D0",
                    borderRadius: "12px",
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "11px",
                      fontWeight: 700,
                      color: "#2B4A36",
                      display: "flex",
                      alignItems: "center",
                      gap: "5px",
                    }}
                  >
                    <Sparkles size={13} />
                    Vista previa en WhatsApp / Chat
                  </div>

                  {vistaPrevia.imagenPrincipalUrl && (
                    <img
                      src={vistaPrevia.imagenPrincipalUrl}
                      alt={productoSeleccionado.pro_nombre}
                      style={{
                        width: "100%",
                        maxHeight: "130px",
                        objectFit: "cover",
                        borderRadius: "8px",
                        border: "1px solid rgba(22, 101, 52, 0.15)",
                      }}
                    />
                  )}

                  <div
                    style={{
                      fontSize: "12.5px",
                      color: "#14532D",
                      whiteSpace: "pre-wrap",
                      wordBreak: "break-word",
                      lineHeight: 1.4,
                    }}
                  >
                    {vistaPrevia.textoMensaje}
                  </div>
                </div>
              </>
            ) : (
              <div
                style={{
                  fontSize: "13px",
                  color: "#847D74",
                  padding: "20px 8px",
                  textAlign: "center",
                }}
              >
                Selecciona un producto de la lista para previsualizar.
              </div>
            )}
          </div>
        </div>

        {/* Pie de acciones */}
        <div
          style={{
            padding: esMovil
              ? "12px 16px calc(12px + env(safe-area-inset-bottom, 0px))"
              : "12px 20px",
            borderTop: "1px solid #E6E2DA",
            backgroundColor: "#FFFFFF",
            display: "flex",
            alignItems: "center",
            justifyContent: "flex-end",
            gap: "10px",
          }}
        >
          <button
            type="button"
            disabled={!vistaPrevia || enviandoDirecto}
            onClick={() => vistaPrevia && onInsertarEnCompositor(vistaPrevia)}
            title="Insertar producto en la caja de texto para personalizar antes de enviar"
            aria-label="Insertar producto en la caja de texto"
            style={{
              height: "42px",
              padding: "0 16px",
              borderRadius: "10px",
              border: "1px solid #D5CFC4",
              backgroundColor: "#FFFFFF",
              color: "#1F1C19",
              fontSize: "13.5px",
              fontWeight: 700,
              cursor: !vistaPrevia || enviandoDirecto ? "not-allowed" : "pointer",
              opacity: !vistaPrevia || enviandoDirecto ? 0.55 : 1,
            }}
          >
            Insertar
          </button>

          <button
            type="button"
            disabled={!vistaPrevia || enviandoDirecto}
            onClick={() => vistaPrevia && onEnviarDirecto(vistaPrevia)}
            title="Enviar foto principal, link web y álbum ahora mismo al cliente"
            aria-label="Enviar producto del catálogo al cliente"
            style={{
              height: "42px",
              padding: "0 18px",
              borderRadius: "10px",
              border: "none",
              backgroundColor: "#2F4737",
              color: "#FFFFFF",
              fontSize: "13.5px",
              fontWeight: 700,
              display: "flex",
              alignItems: "center",
              gap: "7px",
              cursor: !vistaPrevia || enviandoDirecto ? "not-allowed" : "pointer",
              opacity: !vistaPrevia || enviandoDirecto ? 0.6 : 1,
            }}
          >
            {enviandoDirecto ? <Loader2 size={16} /> : <Send size={15} />}
            <span>Enviar</span>
          </button>
        </div>
      </div>
    </div>
  );
}
