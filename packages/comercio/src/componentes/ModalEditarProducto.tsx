"use client";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  FileEdit,
  Sparkles,
  Flower2,
  Scale,
  Wrench,
  PackagePlus,
  Image as ImageIcon,
  Video,
  Clock,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  Layers,
  HelpCircle,
  BookOpen,
  Loader2,
  Wand2,
  Truck,
  Percent,
  FolderPlus,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  ArrowRight,
  Share2,
  Target,
  Tag,
  Hash,
  Upload,
  HardDrive,
  Calendar,
  Power,
  Camera,
  Settings2,
} from "lucide-react";
import {
  editarProductoAction,
  eliminarProductoAction,
  eliminarVarianteAction,
  resolverUrlImagenDirectaAction,
  subirImagenCatalogoAction,
  verificarUsoEnCatalogoAction,
  CategoriaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from "../acciones";
import { subirImagenClienteOAccion } from "../utils/clienteStorage";
import {
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  CANALES_REQUIEREN_IMAGEN,
  CanalVisibilidad,
} from "../canales";
import { TipoVigenciaTemporal, evaluarVigenciaProducto } from "../utils/vigencia";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalGaleriaMedios } from "./ModalGaleriaMedios";
import { detectarTipoNegocio, obtenerImagenFallbackNegocio } from "../utils/negocio";
import {
  obtenerPresetsPorNegocio,
  obtenerUsosEliminadosStorage,
  guardarUsosEliminadosStorage,
  obtenerUsosPersonalizadosStorage,
  guardarUsosPersonalizadosStorage,
  verificarUsoEnProductosLocales,
} from "../utils/usosCatalogo";
import { ModalBloqueoUso, ModalConfirmarEliminarUso } from "./ModalesValidacionUso";


export const COLOR_PRODUCTO_MASTER = {
  nombre: "Master Slate / Sky",
  bg: "#0F172A",
  border: "#38BDF8",
  text: "#38BDF8",
  badge: "rgba(56, 189, 248, 0.2)",
  dot: "#38BDF8",
};

export const PALETA_COLORES_VARIANTES = [
  { nombre: "Verde Esmeralda", bg: "#ECFDF5", border: "#10B981", text: "#065F46", badge: "#D1FAE5", dot: "#10B981" },
  { nombre: "Ámbar Cálido", bg: "#FFFBEB", border: "#F59E0B", text: "#92400E", badge: "#FEF3C7", dot: "#F59E0B" },
  { nombre: "Púrpura Imperial", bg: "#F5F3FF", border: "#8B5CF6", text: "#5B21B6", badge: "#EDE9FE", dot: "#8B5CF6" },
  { nombre: "Rosa Coral", bg: "#FFF1F2", border: "#F43F5E", text: "#9F1239", badge: "#FFE4E6", dot: "#F43F5E" },
  { nombre: "Azul Cielo", bg: "#F0F9FF", border: "#0EA5E9", text: "#075985", badge: "#E0F2FE", dot: "#0EA5E9" },
  { nombre: "Índigo Profundo", bg: "#EEF2FF", border: "#6366F1", text: "#3730A3", badge: "#E0E7FF", dot: "#6366F1" },
];

/**
 * Selector interactivo de encuadre, posición y ajuste de imagen para catálogo cuadrado
 */
function SelectorEncuadreFoto({
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
  if (!imagenUrl) return null;

  const scaleVal = zoom && zoom !== 100 ? zoom / 100 : 1;

  const presetsPosicion = [
    { label: "⬆️ Superior (Rostros / Flores Altas)", val: "center 15%" },
    { label: "⏹️ Centro Equilibrado", val: "center center" },
    { label: "⬇️ Inferior (Base / Florero)", val: "center 85%" },
  ];

  return (
    <div
      style={{
        marginTop: "10px",
        background: "#F8FAFC",
        border: "1.5px dashed #CBD5E1",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={14} color={colorTema} />
          <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#1E293B" }}>
            {titulo}
          </span>
        </div>
        <span style={{ fontSize: "0.68rem", color: "#64748B", fontWeight: 600 }}>
          Proporción Cuadrada 1:1
        </span>
      </div>

      <div style={{ display: "flex", gap: "14px", alignItems: "center", flexWrap: "wrap" }}>
        {/* Vista previa cuadrada interactiva */}
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
            alt="Preview Encuadre"
            onError={(e) => {
              (e.target as HTMLImageElement).src =
                obtenerImagenFallbackNegocio();
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
              backdropFilter: "blur(3px)",
            }}
          >
            Vista Carrusel
          </div>
        </div>

        {/* Controles de Encuadre */}
        <div style={{ flex: 1, minWidth: "220px", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Posición / Enfoque */}
          <div>
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
              Enfoque Vertical (¿Qué parte mostrar?):
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
                      boxShadow: activo ? `0 1px 3px ${colorTema}33` : "none",
                    }}
                  >
                    {pr.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Modo de Ajuste: Cover vs Contain */}
          <div style={{ display: "flex", gap: "12px", alignItems: "center", flexWrap: "wrap" }}>
            <div>
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
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
                    border: ajuste === "cover" ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
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
                    border: ajuste === "contain" ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
                    background: ajuste === "contain" ? "#FFFFFF" : "#F1F5F9",
                    color: ajuste === "contain" ? colorTema : "#475569",
                    cursor: "pointer",
                  }}
                >
                  🖼️ Completa (Contain)
                </button>
              </div>
            </div>

            {/* Escala / Zoom */}
            {ajuste === "cover" && (
              <div>
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#475569", marginBottom: "4px" }}>
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
                        border: zoom === z ? `1.5px solid ${colorTema}` : "1px solid #CBD5E1",
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
  );
}

interface Props {
  abierto: boolean;
  producto: ProductoCatalogo | null;
  varianteInicialId?: string;
  onCerrar: () => void;
  onProductoEditado: (prod: ProductoCatalogo) => void;
  onProductoEliminado: (proId: string) => void;
  onCategoriaCreada?: (cat: CategoriaCatalogo) => void;
  onCategoriaEliminada?: (catId: string) => void;
  categorias: CategoriaCatalogo[];
  productos?: ProductoCatalogo[];
  negocio?: string;
  onAbrirManual?: () => void;
}

export function ModalEditarProducto({
  abierto,
  producto,
  varianteInicialId,
  onCerrar,
  onProductoEditado,
  onProductoEliminado,
  onCategoriaCreada,
  onCategoriaEliminada,
  categorias,
  productos = [],
  negocio = "tranqi",
  onAbrirManual,
}: Props) {
  const { esFloristeria, esLegal, esMantenimiento } = detectarTipoNegocio(negocio);

  const [categoriasLocales, setCategoriasLocales] = useState<CategoriaCatalogo[]>(categorias || []);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);
  const [catModalTab, setCatModalTab] = useState<"crear" | "gestionar">("crear");

  useEffect(() => {
    if (categorias && categorias.length > 0) {
      setCategoriasLocales(categorias);
    }
  }, [categorias]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState("");
  const [tipo, setTipo] = useState<"SERVICIO" | "SUSCRIPCION" | "FISICO" | "DIGITAL">("FISICO");
  const [destacado, setDestacado] = useState(false);
  const [icono, setIcono] = useState<string>("Sparkles");
  const [modalidadPago, setModalidadPago] = useState("Botón Payphone / Tarjeta / Saldo");

  // Recursos Multimedia y Digitales
  const [imagenUrl, setImagenUrl] = useState("");
  const [fotoPosicionMaster, setFotoPosicionMaster] = useState("center center");
  const [fotoAjusteMaster, setFotoAjusteMaster] = useState<"cover" | "contain">("cover");
  const [fotoZoomMaster, setFotoZoomMaster] = useState<number>(100);

  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [galeriaTexto, setGaleriaTexto] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState("");
  const [beneficiosTexto, setBeneficiosTexto] = useState("");
  const [requisitosTexto, setRequisitosTexto] = useState("");

  // Estado Activo y Temporalidad / Vigencia Estacional
  const [proActivo, setProActivo] = useState(true);
  const [vigenciaTipo, setVigenciaTipo] = useState<TipoVigenciaTemporal>("SIEMPRE");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mensajeFueraTemporada, setMensajeFueraTemporada] = useState("");
  const [etiquetaTemporada, setEtiquetaTemporada] = useState("");

  // Auto-Conversión y Subida Local de imágenes
  const [resolviendoImagen, setResolviendoImagen] = useState(false);
  const [resolviendoVarianteImg, setResolviendoVarianteImg] = useState(false);
  const [subiendoImagenGlobal, setSubiendoImagenGlobal] = useState(false);
  const [subiendoImagenVariante, setSubiendoImagenVariante] = useState(false);
  const [subiendoGaleria, setSubiendoGaleria] = useState(false);
  const [subiendoGaleriaVariante, setSubiendoGaleriaVariante] = useState(false);
  const [nuevoUsoVarianteTexto, setNuevoUsoVarianteTexto] = useState("");
  const [exitoAutoConvertir, setExitoAutoConvertir] = useState<string | null>(null);

  // Galería Multimedia del Negocio
  const [modalGaleriaAbierto, setModalGaleriaAbierto] = useState(false);
  const [contextoGaleria, setContextoGaleria] = useState<"master" | "variante" | "galeria" | "variante_galeria">("master");

  const handleSeleccionarDesdeGaleria = (url: string) => {
    if (contextoGaleria === "master") {
      setImagenUrl(url);
      setExitoAutoConvertir("¡Imagen seleccionada desde la galería del negocio!");
    } else if (contextoGaleria === "galeria") {
      setGaleriaTexto((prev) => (prev.trim() ? `${prev.trim()}\n${url}` : url));
    } else if (contextoGaleria === "variante" || contextoGaleria === "variante_galeria") {
      const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
        ? [...varianteActual.var_detalle_variante.galeria_urls]
        : [];
      const portActual = varianteActual?.var_detalle_variante?.portada_url;
      if (portActual && !actuales.includes(portActual)) {
        actuales.unshift(portActual);
      }
      if (!actuales.includes(url)) {
        const combinadas = [...actuales, url];
        const det = {
          ...(varianteActual?.var_detalle_variante || {}),
          galeria_urls: combinadas,
          portada_url: varianteActual?.var_detalle_variante?.portada_url || combinadas[0] || url,
        };
        actualizarVarianteActual("var_detalle_variante", det);
      }
    }
  };

  const handleSeleccionarMultiplesDesdeGaleria = (urls: string[]) => {
    if (!urls || urls.length === 0) return;
    if (contextoGaleria === "galeria") {
      setGaleriaTexto((prev) => {
        const lineasExistentes = prev
          .split("\n")
          .map((l) => l.trim())
          .filter((l) => l.length > 0);
        const combinadas = Array.from(new Set([...lineasExistentes, ...urls]));
        return combinadas.join("\n");
      });
    } else if (contextoGaleria === "variante" || contextoGaleria === "variante_galeria") {
      const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
        ? [...varianteActual.var_detalle_variante.galeria_urls]
        : [];
      const portActual = varianteActual?.var_detalle_variante?.portada_url;
      if (portActual && !actuales.includes(portActual)) {
        actuales.unshift(portActual);
      }
      const combinadas = Array.from(new Set([...actuales, ...urls]));
      const det = {
        ...(varianteActual?.var_detalle_variante || {}),
        galeria_urls: combinadas,
        portada_url: varianteActual?.var_detalle_variante?.portada_url || combinadas[0] || null,
      };
      actualizarVarianteActual("var_detalle_variante", det);
    } else if (contextoGaleria === "master") {
      const [primera, ...resto] = urls;
      if (primera) setImagenUrl(primera);
      if (resto.length > 0) {
        setGaleriaTexto((prev) => {
          const lineasExistentes = prev
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          const combinadas = Array.from(new Set([...lineasExistentes, ...resto]));
          return combinadas.join("\n");
        });
      }
    }
  };

  // Configuración Impositiva Global & Logística (Transporte / Delivery)
  const [tarifaIvaMaster, setTarifaIvaMaster] = useState<number>(15);
  const [autoAplicarIvaVariantes, setAutoAplicarIvaVariantes] = useState<boolean>(true);
  const [mensajeFeedbackIva, setMensajeFeedbackIva] = useState<string | null>(null);
  const [deliveryIncluido, setDeliveryIncluido] = useState<boolean>(true);
  const [modalidadTransporte, setModalidadTransporte] = useState<string>("INCLUIDO_GRATIS");
  const [etiquetaTransporte, setEtiquetaTransporte] = useState<string>("🚚 Envío a Domicilio Incluido");
  const [coberturaTransporte, setCoberturaTransporte] = useState<string>("Quito Urbano y Valles");
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<CanalVisibilidad[]>([...CANALES_POR_DEFECTO]);

  // Editor Multivariante (Tamaños / Modalidades)
  const [modoEdicion, setModoEdicion] = useState<"master" | "variante">("master");
  const [variantesLocales, setVariantesLocales] = useState<VarianteCatalogo[]>([]);
  const [varianteActivaIndex, setVarianteActivaIndex] = useState<number>(0);

  // Verificación reactiva de al menos una imagen (master, galería o variantes)
  const tieneAlMenosUnaImagen = useMemo(() => {
    if (imagenUrl && imagenUrl.trim().length > 0) return true;
    if (albumFotosUrl && albumFotosUrl.trim().length > 0) return true;
    const urlsGaleria = galeriaTexto
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);
    if (urlsGaleria.length > 0) return true;
    if (
      variantesLocales &&
      variantesLocales.some((v) => {
        const vdet = v.var_detalle_variante || {};
        if (vdet.portada_url && String(vdet.portada_url).trim().length > 0) return true;
        if (vdet.imagen_url && String(vdet.imagen_url).trim().length > 0) return true;
        if (vdet.foto_url && String(vdet.foto_url).trim().length > 0) return true;
        if (Array.isArray(vdet.imagenes) && vdet.imagenes.some((img: unknown) => typeof img === "string" && img.trim().length > 0)) return true;
        if (Array.isArray(vdet.galeria_urls) && vdet.galeria_urls.some((img: unknown) => typeof img === "string" && img.trim().length > 0)) return true;
        return false;
      })
    ) {
      return true;
    }
    return false;
  }, [imagenUrl, albumFotosUrl, galeriaTexto, variantesLocales]);

  const toggleCanal = (clave: CanalVisibilidad) => {
    if (CANALES_REQUIEREN_IMAGEN.includes(clave) && !canalesSeleccionados.includes(clave) && !tieneAlMenosUnaImagen) {
      setError("Para activar la visibilidad en E-Commerce Web o App Clientes, es obligatorio configurar al menos una imagen en la Portada, Galería o Variantes.");
      return;
    }
    setError(null);
    setCanalesSeleccionados((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    );
  };

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [eliminandoVariante, setEliminandoVariante] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [confirmarEliminarVariante, setConfirmarEliminarVariante] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Estado de Usos (Casos de Uso / Aplicación) y Etiquetas Semánticas IA
  const [usosSeleccionados, setUsosSeleccionados] = useState<string[]>([]);
  const [nuevoUsoTexto, setNuevoUsoTexto] = useState("");
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [nuevaEtiquetaTexto, setNuevaEtiquetaTexto] = useState("");

  // Usos eliminados y personalizados persistidos por negocio
  const [usosEliminados, setUsosEliminados] = useState<string[]>([]);
  const [usosPersonalizados, setUsosPersonalizados] = useState<{ clave: string; label: string }[]>([]);
  const [modalBloqueoUso, setModalBloqueoUso] = useState<{ clave: string; label: string; productos: string[] } | null>(null);
  const [modalConfirmarEliminarUso, setModalConfirmarEliminarUso] = useState<{ clave: string; label: string } | null>(null);
  const [verificandoUsoClave, setVerificandoUsoClave] = useState<string | null>(null);
  const [mensajeExitoUso, setMensajeExitoUso] = useState<string | null>(null);

  // Cargar usos eliminados y personalizados desde almacenamiento local
  useEffect(() => {
    if (abierto) {
      setUsosEliminados(obtenerUsosEliminadosStorage(negocio));
      setUsosPersonalizados(obtenerUsosPersonalizadosStorage(negocio));
    }
  }, [abierto, negocio]);

  const presetsBase = useMemo(() => obtenerPresetsPorNegocio(negocio), [negocio]);
  const presetsUsosActivos = useMemo(
    () => presetsBase.filter((p) => !usosEliminados.includes(p.clave)),
    [presetsBase, usosEliminados]
  );

  // Lista unificada completa de opciones de Usos disponibles
  const todosUsosDisponibles = useMemo(() => {
    const mapa = new Map<string, { clave: string; label: string; esPreset: boolean }>();

    // 1. Presets activos (no eliminados)
    for (const p of presetsUsosActivos) {
      mapa.set(p.clave, { clave: p.clave, label: p.label, esPreset: true });
    }

    // 2. Usos personalizados guardados (no eliminados)
    for (const u of usosPersonalizados) {
      if (!usosEliminados.includes(u.clave) && !mapa.has(u.clave)) {
        mapa.set(u.clave, { clave: u.clave, label: u.label, esPreset: false });
      }
    }

    // 3. Usos actualmente seleccionados en este producto (que no estén en eliminados)
    for (const u of usosSeleccionados) {
      if (!usosEliminados.includes(u) && !mapa.has(u)) {
        mapa.set(u, {
          clave: u,
          label: `🏷️ ${u.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}`,
          esPreset: false,
        });
      }
    }

    return Array.from(mapa.values());
  }, [presetsUsosActivos, usosPersonalizados, usosSeleccionados, usosEliminados]);

  const toggleUso = (clave: string) => {
    const normalizada = clave.toLowerCase().trim();
    setUsosSeleccionados((prev) =>
      prev.includes(normalizada)
        ? prev.filter((u) => u !== normalizada)
        : [...prev, normalizada]
    );
  };

  const handleAgregarUsoPersonalizado = () => {
    const limpio = nuevoUsoTexto.trim().toLowerCase().replace(/\s+/g, "_");
    if (!limpio) return;
    const label = `🏷️ ${nuevoUsoTexto.trim().replace(/\b\w/g, (c) => c.toUpperCase())}`;

    // Si estaba marcado como eliminado, se desmarca de eliminados
    if (usosEliminados.includes(limpio)) {
      const restantes = usosEliminados.filter((k) => k !== limpio);
      setUsosEliminados(restantes);
      guardarUsosEliminadosStorage(negocio, restantes);
    }

    // Guardar en personalizados del negocio si no existe
    if (!usosPersonalizados.some((u) => u.clave === limpio)) {
      const nuevosPers = [...usosPersonalizados, { clave: limpio, label }];
      setUsosPersonalizados(nuevosPers);
      guardarUsosPersonalizadosStorage(negocio, nuevosPers);
    }

    if (!usosSeleccionados.includes(limpio)) {
      setUsosSeleccionados((prev) => [...prev, limpio]);
    }
    setNuevoUsoTexto("");
  };

  // Solicitar eliminación de un Uso con validación cruzada estricta
  const handleSolicitarEliminarUso = async (clave: string, label: string) => {
    setVerificandoUsoClave(clave);
    try {
      // 1. Verificación local inmediata (catálogo cargado + cambios en memoria)
      const prodsQueUsanLocal = verificarUsoEnProductosLocales(
        clave,
        productos,
        producto?.pro_id,
        usosSeleccionados
      );

      if (prodsQueUsanLocal.length > 0) {
        setModalBloqueoUso({
          clave,
          label,
          productos: prodsQueUsanLocal,
        });
        return;
      }

      // 2. Verificación profunda en el servidor (Supabase com_producto y com_variante)
      const resServer = await verificarUsoEnCatalogoAction({
        negocio,
        claveUso: clave,
      });

      if (resServer.enUso && resServer.nombresProductos.length > 0) {
        setModalBloqueoUso({
          clave,
          label,
          productos: resServer.nombresProductos,
        });
        return;
      }

      // 3. Nadie lo usa: confirmar eliminación
      setModalConfirmarEliminarUso({ clave, label });
    } catch (err) {
      console.error("Error validando uso:", err);
      // Si la red falla pero localmente no está en uso, permitir confirmación
      setModalConfirmarEliminarUso({ clave, label });
    } finally {
      setVerificandoUsoClave(null);
    }
  };

  // Ejecución definitiva de la eliminación tras confirmación
  const ejecutarEliminacionUso = (clave: string, label: string) => {
    // 1. Registrar en lista de eliminados
    const actualizados = Array.from(new Set([...usosEliminados, clave]));
    setUsosEliminados(actualizados);
    guardarUsosEliminadosStorage(negocio, actualizados);

    // 2. Remover de personalizados
    const persActualizados = usosPersonalizados.filter((u) => u.clave !== clave);
    setUsosPersonalizados(persActualizados);
    guardarUsosPersonalizadosStorage(negocio, persActualizados);

    // 3. Desmarcar del producto actual
    setUsosSeleccionados((prev) => prev.filter((u) => u !== clave));

    // 4. Desmarcar de variantes locales si alguna lo tenía
    setVariantesLocales((prev) =>
      prev.map((v) => {
        const uVar: string[] = Array.isArray(v.var_detalle_variante?.usos)
          ? v.var_detalle_variante.usos
          : [];
        if (uVar.includes(clave)) {
          return {
            ...v,
            var_detalle_variante: {
              ...(v.var_detalle_variante || {}),
              usos: uVar.filter((u) => u !== clave),
            },
          };
        }
        return v;
      })
    );

    setModalConfirmarEliminarUso(null);
    setMensajeExitoUso(`Uso «${label}» eliminado correctamente del catálogo.`);
    setTimeout(() => setMensajeExitoUso(null), 3500);
  };

  // Restaurar todos los presets predeterminados
  const handleRestaurarUsosPredeterminados = () => {
    setUsosEliminados([]);
    guardarUsosEliminadosStorage(negocio, []);
    setMensajeExitoUso("Se han restaurado los usos predeterminados.");
    setTimeout(() => setMensajeExitoUso(null), 3000);
  };

  const handleAgregarEtiqueta = () => {
    const limpia = nuevaEtiquetaTexto.trim();
    if (limpia && !etiquetasSeleccionadas.includes(limpia)) {
      setEtiquetasSeleccionadas((prev) => [...prev, limpia]);
      setNuevaEtiquetaTexto("");
    }
  };

  const handleEliminarEtiqueta = (tagAEliminar: string) => {
    setEtiquetasSeleccionadas((prev) => prev.filter((t) => t !== tagAEliminar));
  };

  // Presets de tiempo de entrega según industria
  const presetsEntrega = esFloristeria
    ? [
        { label: "⚡ Entrega Inmediata (45-90 min)", val: "⚡ Entrega Inmediata Express (45 - 90 min)" },
        { label: "🌸 Pide hoy, recibe hoy (Mismo Día)", val: "🌸 Pide hoy, recibe hoy (Mismo Día)" },
        { label: "✨ Elaboración Especial (24h)", val: "✨ Elaboración Especial en Taller (24 horas)" },
        { label: "📅 Entrega Programada / Fecha Especial", val: "📅 Entrega Programada / Fecha Especial" },
      ]
    : esLegal
    ? [
        { label: "⚡ Agendamiento Inmediato / Mismo Día", val: "Agendamiento inmediato / Mismo día" },
        { label: "📄 Menos de 24 horas (Dictamen Express)", val: "Menos de 24 horas" },
        { label: "⚖️ 24 a 48 horas hábiles", val: "24 a 48 horas hábiles" },
        { label: "🏛️ 7 a 15 días hábiles (Procesal / Notarial)", val: "7 a 15 días hábiles" },
      ]
    : [
        { label: "⚡ Emergencia Técnica (45-60 min)", val: "⚡ Emergencia Técnica (45 - 60 min)" },
        { label: "🔧 Turno Mismo Día", val: "🔧 Mismo Día / Turno Tarde" },
        { label: "📅 Visita Programada", val: "📅 Visita Programada" },
      ];


  // Propagación de IVA Master a todas las variantes
  const aplicarIvaMasterATodos = (nuevaTarifa: number) => {
    setTarifaIvaMaster(nuevaTarifa);
    setVariantesLocales((prev) =>
      prev.map((v) => {
        const base = v.var_precio || 0;
        const montoIva = Number(((base * nuevaTarifa) / 100).toFixed(2));
        return {
          ...v,
          var_tarifa_iva_porcentaje: nuevaTarifa,
          var_codigo_impuesto_sri: nuevaTarifa > 0 ? "IVA_15" : "IVA_0",
          monto_iva: montoIva,
          precio_total: Number((base + montoIva).toFixed(2)),
        };
      })
    );
    setMensajeFeedbackIva(`✓ Tarifa IVA ${nuevaTarifa}% aplicada a todas las variantes (${variantesLocales.length})`);
    setTimeout(() => {
      setMensajeFeedbackIva(null);
    }, 3500);
  };

  useEffect(() => {
    if (producto) {
      setNombre(producto.pro_nombre || "");
      setDescripcion(producto.pro_descripcion || "");
      setCategoriaId(producto.pro_categoria_principal_id || categorias[0]?.ctg_id || "");
      setTipo(producto.pro_tipo || (esFloristeria ? "FISICO" : "SERVICIO"));
      setDestacado(Boolean(producto.pro_destacado));
      setIcono(producto.pro_detalle_producto?.icono || (esFloristeria ? "Sparkles" : "Scale"));
      setModalidadPago(producto.pro_detalle_producto?.modalidad_pago || "Botón Payphone / Tarjeta / Saldo");

      const det = producto.pro_detalle_producto || {};
      setImagenUrl(det.imagen_url || "");
      setFotoPosicionMaster(det.foto_posicion || "center center");
      setFotoAjusteMaster(det.foto_ajuste || "cover");
      setFotoZoomMaster(Number(det.foto_zoom) || 100);
      setAlbumFotosUrl(det.album_fotos_url || "");
      setVideoUrl(det.video_url || "");
      setGaleriaTexto(Array.isArray(det.galeria_urls) ? det.galeria_urls.join("\n") : "");
      setTiempoEntrega(
        det.tiempo_entrega ||
          (esFloristeria ? "🌸 Pide hoy, recibe hoy (Mismo Día)" : "24 a 48 horas hábiles")
      );
      setBeneficiosTexto(Array.isArray(det.beneficios) ? det.beneficios.join("\n") : "");
      setRequisitosTexto(Array.isArray(det.requisitos) ? det.requisitos.join("\n") : "");

      // Usos (Casos de Uso) y Etiquetas Semánticas
      const usosCargados = Array.isArray(det.usos)
        ? det.usos
        : Array.isArray(det.ocasiones)
        ? det.ocasiones
        : [];
      setUsosSeleccionados(usosCargados);

      const etiquetasCargadas = Array.isArray(det.etiquetas) ? det.etiquetas : [];
      setEtiquetasSeleccionadas(etiquetasCargadas);

      // Canales de visibilidad
      if (producto.canales_visibilidad && Array.isArray(producto.canales_visibilidad)) {
        setCanalesSeleccionados(producto.canales_visibilidad);
      } else if (det.canales_visibilidad && Array.isArray(det.canales_visibilidad)) {
        setCanalesSeleccionados(det.canales_visibilidad);
      } else {
        setCanalesSeleccionados([...CANALES_POR_DEFECTO]);
      }

      // IVA Master y Logística
      setTarifaIvaMaster(det.tarifa_iva_predeterminada !== undefined ? Number(det.tarifa_iva_predeterminada) : 15);
      
      // Estado Activo y Temporalidad / Vigencia Estacional
      setProActivo(producto.pro_activo !== false);
      setVigenciaTipo((det.vigencia_tipo as TipoVigenciaTemporal) || "SIEMPRE");
      setFechaInicio(det.fecha_inicio || "");
      setFechaFin(det.fecha_fin || "");
      setMensajeFueraTemporada(det.mensaje_fuera_temporada || "");
      setEtiquetaTemporada(det.etiqueta_temporada || "");

      const defaultDelivery = esFloristeria ? true : esLegal ? false : true;
      const tieneLogisticaDefinida = det.logistica && typeof det.logistica.delivery_incluido === "boolean";
      setDeliveryIncluido(tieneLogisticaDefinida ? Boolean(det.logistica.delivery_incluido) : defaultDelivery);
      setModalidadTransporte(det.logistica?.modalidad_transporte || (esLegal ? "TELEMATICO_DIGITAL" : "INCLUIDO_GRATIS"));
      
      const rawEtiqueta = det.logistica?.etiqueta_transporte;
      const rawCobertura = det.logistica?.cobertura_texto;
      if (esLegal) {
        setEtiquetaTransporte(
          rawEtiqueta && !rawEtiqueta.includes("Envío a Domicilio") && !rawEtiqueta.includes("Visita Técnica")
            ? rawEtiqueta
            : "🌐 Modalidad 100% Telemática"
        );
        setCoberturaTransporte(
          rawCobertura && !rawCobertura.includes("Quito Urbano y Valles")
            ? rawCobertura
            : "Nacional (Ecuador)"
        );
      } else {
        setEtiquetaTransporte(rawEtiqueta || (esFloristeria ? "🌸 Envío a Domicilio Incluido" : "🔧 Visita Técnica Incluida"));
        setCoberturaTransporte(rawCobertura || "Quito Urbano y Valles");
      }

      // Clonar y ordenar variantes por orden ascendente y precio
      const vars = producto.variantes && producto.variantes.length > 0
        ? [...producto.variantes]
            .sort((a, b) => {
              const ordA = typeof a.var_detalle_variante?.orden === "number" ? a.var_detalle_variante.orden : 999;
              const ordB = typeof b.var_detalle_variante?.orden === "number" ? b.var_detalle_variante.orden : 999;
              if (ordA !== ordB) return ordA - ordB;
              return (a.var_precio || 0) - (b.var_precio || 0);
            })
            .map((v, idx) => ({
              ...v,
              var_detalle_variante: {
                ...(v.var_detalle_variante || {}),
                orden: typeof v.var_detalle_variante?.orden === "number" ? v.var_detalle_variante.orden : idx + 1,
              },
            }))
        : [
            {
              var_id: `var-${Date.now()}`,
              var_producto_id: producto.pro_id,
              var_sku: `${negocio.toUpperCase().substring(0, 3)}-EST`,
              var_nombre: "Estándar",
              var_precio: 20,
              var_precio_comparacion: null,
              var_codigo_impuesto_sri: "IVA_15",
              var_tarifa_iva_porcentaje: 15,
              var_tipo_oferta: "REGULAR",
              var_activo: true,
              var_detalle_variante: { orden: 1 },
              monto_iva: 3,
              precio_total: 23,
            },
          ];

      setVariantesLocales(vars);
      if (varianteInicialId) {
        const targetIdx = vars.findIndex((v) => v.var_id === varianteInicialId);
        setVarianteActivaIndex(targetIdx >= 0 ? targetIdx : 0);
        setModoEdicion("variante");
      } else {
        setVarianteActivaIndex(0);
        setModoEdicion("master");
      }
      setConfirmarEliminar(false);
      setConfirmarEliminarVariante(false);
      setError(null);
    }
  }, [producto, varianteInicialId, categorias, negocio, esFloristeria, esLegal]);

  if (!abierto || !producto) return null;

  const esModoMaster = modoEdicion === "master";
  const varianteActual = variantesLocales[varianteActivaIndex] || variantesLocales[0];
  const colVariante = PALETA_COLORES_VARIANTES[varianteActivaIndex % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;
  const colActiva = esModoMaster ? COLOR_PRODUCTO_MASTER : colVariante;

  const actualizarVarianteActual = (campo: keyof VarianteCatalogo, valor: any) => {
    setVariantesLocales((prev) => {
      const nuevas = [...prev];
      const target = { ...nuevas[varianteActivaIndex] } as any;

      if (campo === "var_precio") {
        const base = typeof valor === "number" ? valor : parseFloat(valor) || 0;
        target.var_precio = base;
        const ivaPorc = target.var_tarifa_iva_porcentaje || 15;
        target.monto_iva = Number(((base * ivaPorc) / 100).toFixed(2));
        target.precio_total = Number((base + target.monto_iva).toFixed(2));
      } else if (campo === "var_tarifa_iva_porcentaje") {
        const ivaPorc = Number(valor);
        target.var_tarifa_iva_porcentaje = ivaPorc;
        target.var_codigo_impuesto_sri = ivaPorc > 0 ? "IVA_15" : "IVA_0";
        const base = target.var_precio || 0;
        target.monto_iva = Number(((base * ivaPorc) / 100).toFixed(2));
        target.precio_total = Number((base + target.monto_iva).toFixed(2));
      } else {
        target[campo] = valor;
      }

      nuevas[varianteActivaIndex] = target;
      return nuevas;
    });
  };

  const agregarNuevaVariante = () => {
    const base = 25;
    const ivaPorc = 15;
    const montoIva = Number(((base * ivaPorc) / 100).toFixed(2));
    const prodCode = (producto.pro_slug || producto.pro_nombre || "ITEM")
      .replace(/[^a-zA-Z0-9]/g, "")
      .substring(0, 8)
      .toUpperCase();
    const skuUnico = `${negocio.toUpperCase().substring(0, 3)}-${prodCode}-${Date.now().toString(36).toUpperCase()}-${variantesLocales.length + 1}`;
    const nueva: VarianteCatalogo = {
      var_id: `var-new-${Date.now()}`,
      var_producto_id: producto.pro_id,
      var_sku: skuUnico,
      var_nombre: esFloristeria
        ? `Tamaño Especial (${variantesLocales.length + 1})`
        : `Opción ${variantesLocales.length + 1}`,
      var_precio: base,
      var_precio_comparacion: null,
      var_codigo_impuesto_sri: "IVA_15",
      var_tarifa_iva_porcentaje: ivaPorc,
      var_tipo_oferta: "REGULAR",
      var_activo: true,
      var_detalle_variante: {},
      monto_iva: montoIva,
      precio_total: Number((base + montoIva).toFixed(2)),
    };

    setVariantesLocales([...variantesLocales, nueva]);
    setVarianteActivaIndex(variantesLocales.length);
    setModoEdicion("variante");
  };

  const eliminarVarianteActual = () => {
    if (variantesLocales.length <= 1) {
      setError(esFloristeria ? "El producto debe conservar al menos un tamaño." : "El producto debe conservar al menos una variante de tarifa.");
      return;
    }
    const filtradas = variantesLocales.filter((_, idx) => idx !== varianteActivaIndex);
    const reordenadas = filtradas.map((v, i) => ({
      ...v,
      var_detalle_variante: {
        ...(v.var_detalle_variante || {}),
        orden: i + 1,
      },
    }));
    setVariantesLocales(reordenadas);
    setVarianteActivaIndex(0);
    setConfirmarEliminarVariante(false);
    setError(null);
  };

  const handleEliminarVarianteClick = async () => {
    if (variantesLocales.length <= 1) {
      setError(esFloristeria ? "El producto debe conservar al menos un tamaño." : "El producto debe conservar al menos una variante de tarifa.");
      return;
    }
    if (!confirmarEliminarVariante) {
      setConfirmarEliminarVariante(true);
      return;
    }

    const varianteAEliminar = variantesLocales[varianteActivaIndex];
    if (!varianteAEliminar) return;

    setEliminandoVariante(true);
    setError(null);

    try {
      // Si la variante ya fue guardada en Supabase (tiene ID persistido que no sea temporal), eliminar en el servidor
      const esPersistida =
        varianteAEliminar.var_id &&
        !varianteAEliminar.var_id.startsWith("var-new-") &&
        !varianteAEliminar.var_id.startsWith("var-");

      if (esPersistida) {
        const res = await eliminarVarianteAction({
          var_id: varianteAEliminar.var_id,
          pro_id: producto.pro_id,
          negocio,
        });

        if (!res.ok) {
          setError(res.error || "No se pudo eliminar la variante de la base de datos.");
          setEliminandoVariante(false);
          return;
        }
      }

      eliminarVarianteActual();
    } catch (err: any) {
      setError(err.message || "Error al eliminar la variante.");
    } finally {
      setEliminandoVariante(false);
      setConfirmarEliminarVariante(false);
    }
  };

  const moverVariante = (idx: number, direccion: "arriba" | "abajo", e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    const targetIdx = direccion === "arriba" ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= variantesLocales.length) return;
    const nuevas = [...variantesLocales];
    const temp = nuevas[idx]!;
    nuevas[idx] = nuevas[targetIdx]!;
    nuevas[targetIdx] = temp;

    const nuevasConOrden = nuevas.map((v, i) => ({
      ...v,
      var_detalle_variante: {
        ...(v.var_detalle_variante || {}),
        orden: i + 1,
      },
    }));

    setVariantesLocales(nuevasConOrden);
    setVarianteActivaIndex(targetIdx);
  };

  const handleConvertirImagenGlobal = async (urlAConvertir?: string) => {
    const target = urlAConvertir !== undefined ? urlAConvertir : imagenUrl;
    if (!target.trim()) return;
    setResolviendoImagen(true);
    setExitoAutoConvertir(null);
    setError(null);
    try {
      const res = await resolverUrlImagenDirectaAction(target);
      if (res.ok && res.urlDirecta) {
        setImagenUrl(res.urlDirecta);
        setExitoAutoConvertir("¡Enlace de Google Fotos convertido con éxito a imagen directa de alta resolución!");
      } else {
        setError(res.error || "No se pudo convertir automáticamente la URL de Google Fotos.");
      }
    } catch (e: any) {
      setError(`Error al convertir: ${e.message || e}`);
    } finally {
      setResolviendoImagen(false);
    }
  };

  const handleConvertirImagenVariante = async (urlAConvertir?: string) => {
    const target = urlAConvertir !== undefined ? urlAConvertir : (varianteActual?.var_detalle_variante?.portada_url || "");
    if (!target.trim()) return;
    setResolviendoVarianteImg(true);
    setError(null);
    try {
      const res = await resolverUrlImagenDirectaAction(target);
      if (res.ok && res.urlDirecta) {
        const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
          ? [...varianteActual.var_detalle_variante.galeria_urls]
          : [];
        const galeriaActualizada = actuales.map((u) => (u === target ? res.urlDirecta! : u));
        if (!galeriaActualizada.includes(res.urlDirecta)) {
          galeriaActualizada.push(res.urlDirecta);
        }
        const det = {
          ...(varianteActual?.var_detalle_variante || {}),
          portada_url: res.urlDirecta,
          galeria_urls: galeriaActualizada,
        };
        actualizarVarianteActual("var_detalle_variante", det);
      } else {
        setError(res.error || "No se pudo convertir automáticamente la URL de Google Fotos de esta variante.");
      }
    } catch (e: any) {
      setError(`Error al convertir: ${e.message || e}`);
    } finally {
      setResolviendoVarianteImg(false);
    }
  };

  const LIMITE_MAX_IMAGEN_BYTES = 5 * 1024 * 1024; // 5 MB

  const handleSubirArchivoGlobal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setExitoAutoConvertir(null);

    if (file.size > LIMITE_MAX_IMAGEN_BYTES) {
      const tamanoMb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`⚠️ La imagen "${file.name}" supera el tamaño máximo permitido de 5 MB (tamaño detectado: ${tamanoMb} MB). Por favor selecciona una imagen menor a 5 MB.`);
      e.target.value = "";
      return;
    }

    setSubiendoImagenGlobal(true);
    try {
      const res = await subirImagenClienteOAccion(file, negocio || "comun", "portadas");
      if (res.ok && res.urlPublica) {
        setImagenUrl(res.urlPublica);
        setExitoAutoConvertir(`¡Imagen "${res.nombreArchivo || file.name}" cargada con éxito desde tu equipo!`);
      } else {
        setError(res.error || "No se pudo cargar la imagen seleccionada.");
      }
    } catch (err: any) {
      setError(`Error al cargar la imagen: ${err.message || err}`);
    } finally {
      setSubiendoImagenGlobal(false);
      e.target.value = "";
    }
  };

  // Admite varias imágenes: la primera queda como portada del tamaño y el resto
  // se anexa a la galería del tamaño (galeria_urls), igual que la selección múltiple de la galería.
  const handleSubirArchivoVariante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const listaArchivos = Array.from(e.target.files || []);
    if (listaArchivos.length === 0) return;
    setError(null);

    for (const file of listaArchivos) {
      if (file.size > LIMITE_MAX_IMAGEN_BYTES) {
        const tamanoMb = (file.size / (1024 * 1024)).toFixed(2);
        setError(`⚠️ La imagen "${file.name}" supera el tamaño máximo permitido de 5 MB (tamaño detectado: ${tamanoMb} MB). Por favor selecciona imágenes menores a 5 MB.`);
        e.target.value = "";
        return;
      }
    }

    setSubiendoImagenVariante(true);
    try {
      const nuevasUrls: string[] = [];
      const errores: string[] = [];
      for (const file of listaArchivos) {
        const res = await subirImagenClienteOAccion(file, negocio || "comun", "variantes");
        if (res.ok && res.urlPublica) {
          nuevasUrls.push(res.urlPublica);
        } else {
          errores.push(`${file.name}: ${res.error || "no se pudo cargar"}`);
        }
      }

      if (nuevasUrls.length > 0) {
        const [primera, ...resto] = nuevasUrls;
        const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
          ? [...varianteActual.var_detalle_variante.galeria_urls]
          : [];
        const det = {
          ...(varianteActual?.var_detalle_variante || {}),
          portada_url: primera,
          galeria_urls: resto.length > 0 ? Array.from(new Set([...actuales, ...resto])) : actuales,
        };
        actualizarVarianteActual("var_detalle_variante", det);
      }
      if (errores.length > 0) {
        setError(`No se pudieron cargar ${errores.length} imagen(es): ${errores.join(" · ")}`);
      }
    } catch (err: any) {
      setError(`Error al cargar la imagen de la variante: ${err.message || err}`);
    } finally {
      setSubiendoImagenVariante(false);
      e.target.value = "";
    }
  };

  const handleSubirArchivoGaleria = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);

    if (file.size > LIMITE_MAX_IMAGEN_BYTES) {
      const tamanoMb = (file.size / (1024 * 1024)).toFixed(2);
      setError(`⚠️ La foto "${file.name}" supera el tamaño máximo permitido de 5 MB (tamaño detectado: ${tamanoMb} MB). Por favor selecciona una imagen menor a 5 MB.`);
      e.target.value = "";
      return;
    }

    setSubiendoGaleria(true);
    try {
      const res = await subirImagenClienteOAccion(file, negocio || "comun", "galeria");
      if (res.ok && res.urlPublica) {
        setGaleriaTexto((prev) => (prev.trim() ? `${prev.trim()}\n${res.urlPublica}` : res.urlPublica!));
      } else {
        setError(res.error || "No se pudo cargar la foto a la galería.");
      }
    } catch (err: any) {
      setError(`Error al cargar imagen a la galería: ${err.message || err}`);
    } finally {
      setSubiendoGaleria(false);
      e.target.value = "";
    }
  };

  const handleSubirArchivosGaleriaVariante = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);

    const listaArchivos = Array.from(files);
    for (const f of listaArchivos) {
      if (f.size > LIMITE_MAX_IMAGEN_BYTES) {
        const tamanoMb = (f.size / (1024 * 1024)).toFixed(2);
        setError(`⚠️ El archivo "${f.name}" supera el tamaño máximo permitido de 5 MB (${tamanoMb} MB).`);
        e.target.value = "";
        return;
      }
    }

    setSubiendoGaleriaVariante(true);
    try {
      const nuevasUrls: string[] = [];
      for (const file of listaArchivos) {
        const res = await subirImagenClienteOAccion(file, negocio || "comun", "variantes");
        if (res.ok && res.urlPublica) {
          nuevasUrls.push(res.urlPublica);
        }
      }

      if (nuevasUrls.length > 0) {
        const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
          ? [...varianteActual.var_detalle_variante.galeria_urls]
          : [];
        const portActual = varianteActual?.var_detalle_variante?.portada_url;
        if (portActual && !actuales.includes(portActual)) {
          actuales.unshift(portActual);
        }
        const combinadas = Array.from(new Set([...actuales, ...nuevasUrls]));
        const det = {
          ...(varianteActual?.var_detalle_variante || {}),
          galeria_urls: combinadas,
          portada_url: varianteActual?.var_detalle_variante?.portada_url || combinadas[0] || null,
        };
        actualizarVarianteActual("var_detalle_variante", det);
      }
    } catch (err: any) {
      setError(`Error al cargar imágenes para la galería de la variante: ${err.message || err}`);
    } finally {
      setSubiendoGaleriaVariante(false);
      e.target.value = "";
    }
  };

  const handleQuitarFotoGaleriaVariante = (idxParaQuitar: number) => {
    const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
      ? [...varianteActual.var_detalle_variante.galeria_urls]
      : [];
    const portActual = varianteActual?.var_detalle_variante?.portada_url;
    if (portActual && !actuales.includes(portActual)) {
      actuales.unshift(portActual);
    }
    const [eliminada] = actuales.splice(idxParaQuitar, 1);
    let nuevaPortada = varianteActual?.var_detalle_variante?.portada_url;
    if (nuevaPortada === eliminada || !nuevaPortada) {
      nuevaPortada = actuales[0] || null;
    }
    const det = {
      ...(varianteActual?.var_detalle_variante || {}),
      galeria_urls: actuales,
      portada_url: nuevaPortada,
    };
    actualizarVarianteActual("var_detalle_variante", det);
  };

  const handleEstablecerPortadaDesdeGaleriaVariante = (url: string) => {
    const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
      ? [...varianteActual.var_detalle_variante.galeria_urls]
      : [];
    const portActual = varianteActual?.var_detalle_variante?.portada_url;
    if (portActual && !actuales.includes(portActual)) {
      actuales.unshift(portActual);
    }
    // Mover url al primer puesto para que la #1 sea siempre la portada principal
    const reordenadas = [url, ...actuales.filter((u) => u !== url)];
    const det = {
      ...(varianteActual?.var_detalle_variante || {}),
      portada_url: url,
      galeria_urls: reordenadas,
    };
    actualizarVarianteActual("var_detalle_variante", det);
  };

  const toggleUsoVariante = (clave: string) => {
    const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.usos)
      ? [...varianteActual.var_detalle_variante.usos]
      : [];
    const nuevo = actuales.includes(clave)
      ? actuales.filter((c) => c !== clave)
      : [...actuales, clave];
    const det = {
      ...(varianteActual?.var_detalle_variante || {}),
      usos: nuevo,
      usos_modo: "personalizado",
    };
    actualizarVarianteActual("var_detalle_variante", det);
  };

  const handleAgregarUsoPersonalizadoVariante = () => {
    if (!nuevoUsoVarianteTexto.trim()) return;
    const clean = nuevoUsoVarianteTexto.trim().toLowerCase().replace(/\s+/g, "_");
    const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.usos)
      ? [...varianteActual.var_detalle_variante.usos]
      : [];
    if (!actuales.includes(clean)) {
      const det = {
        ...(varianteActual?.var_detalle_variante || {}),
        usos: [...actuales, clean],
        usos_modo: "personalizado",
      };
      actualizarVarianteActual("var_detalle_variante", det);
    }
    setNuevoUsoVarianteTexto("");
  };

  const handleEliminarUsoVariante = (uso: string) => {
    const actuales: string[] = Array.isArray(varianteActual?.var_detalle_variante?.usos)
      ? [...varianteActual.var_detalle_variante.usos]
      : [];
    const det = {
      ...(varianteActual?.var_detalle_variante || {}),
      usos: actuales.filter((u) => u !== uso),
    };
    actualizarVarianteActual("var_detalle_variante", det);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresa el nombre del producto.");
      return;
    }

    if (variantesLocales.length === 0) {
      setError("Debes definir al menos una variante de precio.");
      return;
    }

    for (const v of variantesLocales) {
      if (!v.var_nombre.trim()) {
        setError("Todas las modalidades deben tener un nombre (ej. Pequeño, Mediano, Grande).");
        return;
      }
      if (v.var_precio <= 0) {
        setError(`El precio de "${v.var_nombre}" debe ser mayor a cero.`);
        return;
      }
    }

    setGuardando(true);

    // 1. Validación previa y auto-conversión de portada global si es un visor web de Google Fotos
    let imagenUrlFinal = imagenUrl.trim();
    if (
      imagenUrlFinal.includes("photos.google.com") ||
      imagenUrlFinal.includes("photos.app.goo.gl")
    ) {
      const resImg = await resolverUrlImagenDirectaAction(imagenUrlFinal);
      if (resImg.ok && resImg.urlDirecta) {
        imagenUrlFinal = resImg.urlDirecta;
        setImagenUrl(imagenUrlFinal);
      } else {
        setGuardando(false);
        setError(
          `⚠️ Advertencia de Imagen: La URL de portada principal es un visor web de Google Fotos que no pudo ser resuelto automáticamente (${resImg.error}). Copia la dirección de la imagen con clic derecho sobre la foto ('Copiar dirección de la imagen') o muévela al campo 'Álbum de Muestras'.`
        );
        return;
      }
    }

    // 2. Validación y auto-conversión de portadas de variantes y estampado de orden secuencial
    const variantesParaGuardar = await Promise.all(
      variantesLocales.map(async (v, i) => {
        const port = v.var_detalle_variante?.portada_url;
        let portFinal = port || null;
        if (
          port &&
          (port.includes("photos.google.com") || port.includes("photos.app.goo.gl"))
        ) {
          const resV = await resolverUrlImagenDirectaAction(port);
          if (resV.ok && resV.urlDirecta) {
            portFinal = resV.urlDirecta;
          }
        }

        // Auto-resolver también si hay URLs de visor web de Google Fotos en galeria_urls
        const rawGaleria = Array.isArray(v.var_detalle_variante?.galeria_urls)
          ? v.var_detalle_variante.galeria_urls
          : [];
        const galeriaFinal: string[] = [];
        for (const gUrl of rawGaleria) {
          if (typeof gUrl === "string" && gUrl.trim().length > 0) {
            const trimmedG = gUrl.trim();
            if (trimmedG.includes("photos.google.com") || trimmedG.includes("photos.app.goo.gl")) {
              const resG = await resolverUrlImagenDirectaAction(trimmedG);
              if (resG.ok && resG.urlDirecta) {
                galeriaFinal.push(resG.urlDirecta);
              } else {
                galeriaFinal.push(trimmedG);
              }
            } else {
              galeriaFinal.push(trimmedG);
            }
          }
        }

        // Sincronizar portada con la primera foto de la galería si hay fotos
        if (galeriaFinal.length > 0) {
          if (!portFinal || !galeriaFinal.includes(portFinal)) {
            portFinal = galeriaFinal[0];
          }
        } else {
          portFinal = null;
        }

        const usosFinal = Array.isArray(v.var_detalle_variante?.usos)
          ? v.var_detalle_variante.usos.filter((u: string) => typeof u === "string" && u.trim().length > 0)
          : [];

        return {
          ...v,
          var_detalle_variante: {
            ...(v.var_detalle_variante || {}),
            orden: i + 1,
            portada_url: portFinal,
            album_url: v.var_detalle_variante?.album_url?.trim() || null,
            galeria_urls: galeriaFinal,
            usos: usosFinal,
            usos_modo: v.var_detalle_variante?.usos_modo || "heredar",
          },
        };
      })
    );

    const beneficios = beneficiosTexto
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const requisitos = requisitosTexto
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    const galeriaUrls = galeriaTexto
      .split("\n")
      .map((g) => g.trim())
      .filter((g) => g.length > 0);

    try {
      const res = await editarProductoAction({
        pro_id: producto.pro_id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        destacado,
        icono,
        imagenUrl: imagenUrlFinal || undefined,
        fotoPosicion: fotoPosicionMaster,
        fotoAjuste: fotoAjusteMaster,
        fotoZoom: fotoZoomMaster,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        galeriaUrls: galeriaUrls.length > 0 ? galeriaUrls : undefined,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        beneficios,
        requisitos,
        modalidadPago,
        pro_activo: proActivo,
        vigencia_tipo: vigenciaTipo,
        fecha_inicio: fechaInicio.trim() || undefined,
        fecha_fin: fechaFin.trim() || undefined,
        mensaje_fuera_temporada: mensajeFueraTemporada.trim() || undefined,
        etiqueta_temporada: etiquetaTemporada.trim() || undefined,
        tarifaIvaPredeterminada: tarifaIvaMaster,
        codigoImpuestoSri: tarifaIvaMaster > 0 ? "IVA_15" : "IVA_0",
        logistica: {
          delivery_incluido: deliveryIncluido,
          modalidad_transporte: modalidadTransporte,
          etiqueta_transporte: etiquetaTransporte,
          cobertura_texto: coberturaTransporte,
        },
        usos: usosSeleccionados,
        etiquetas: etiquetasSeleccionadas,
        canales_visibilidad: canalesSeleccionados,
        variantes: variantesParaGuardar,
        negocio,
      });

      if (res.ok && res.producto) {
        onProductoEditado(res.producto);
        onCerrar();
      } else {
        setError(res.error || "No se pudo actualizar el producto.");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la actualización.");
    } finally {
      setGuardando(false);
    }
  };

  const handleEliminar = async () => {
    if (!confirmarEliminar) {
      setConfirmarEliminar(true);
      return;
    }

    setEliminando(true);
    try {
      const res = await eliminarProductoAction(producto.pro_id, negocio);
      if (res.ok) {
        onProductoEliminado(producto.pro_id);
        onCerrar();
      } else {
        setError(res.error || "No se pudo eliminar el producto.");
      }
    } catch (err: any) {
      setError(err.message || "Error al eliminar el producto.");
    } finally {
      setEliminando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.75)",
        backdropFilter: "blur(5px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 9999,
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "680px",
          maxHeight: "92vh",
          boxShadow: `0 25px 50px -12px rgba(0, 0, 0, 0.25), 0 0 0 3px ${colActiva.border}55`,
          border: `2.5px solid ${colActiva.border}`,
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
          transition: "border-color 0.2s ease, box-shadow 0.2s ease",
        }}
      >
        {/* Cabecera con Identidad Visual de Producto Master */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: `2px solid ${colActiva.border}`,
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #0F172A 0%, #1E293B 100%)",
            color: "#FFFFFF",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "38px",
                height: "38px",
                borderRadius: "10px",
                background: "rgba(56, 189, 248, 0.15)",
                color: "#38BDF8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                border: "1px solid rgba(56, 189, 248, 0.3)",
              }}
            >
              {esFloristeria ? <Flower2 size={20} /> : esMantenimiento ? <Wrench size={20} /> : <FileEdit size={20} />}
            </div>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                <span
                  style={{
                    background: "rgba(56, 189, 248, 0.2)",
                    color: "#38BDF8",
                    fontSize: "0.68rem",
                    fontWeight: 800,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(56, 189, 248, 0.4)",
                  }}
                >
                  📦 CAPA 2: PRODUCTO MASTER
                </span>
                {esModoMaster ? (
                  <span
                    style={{
                      background: "rgba(56, 189, 248, 0.12)",
                      color: "#38BDF8",
                      fontSize: "0.68rem",
                      fontWeight: 700,
                      padding: "2px 7px",
                      borderRadius: "4px",
                      border: "1px solid rgba(56, 189, 248, 0.3)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                    }}
                  >
                    🌐 Modo: Configuración Global Master
                  </span>
                ) : (
                  <>
                    <span
                      style={{
                        background: colVariante.bg,
                        color: colVariante.text,
                        fontSize: "0.68rem",
                        fontWeight: 800,
                        padding: "2px 7px",
                        borderRadius: "4px",
                        border: `1.5px solid ${colVariante.border}`,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                      }}
                    >
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: colVariante.dot }} />
                      Editando: {varianteActual?.var_nombre || "Variante"}
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setModoEdicion("master");
                        setConfirmarEliminar(false);
                        setConfirmarEliminarVariante(false);
                      }}
                      title="Volver al modo de configuración master"
                      style={{
                        background: "rgba(255, 255, 255, 0.15)",
                        border: "1px solid rgba(255, 255, 255, 0.25)",
                        color: "#FFFFFF",
                        fontSize: "0.65rem",
                        fontWeight: 700,
                        padding: "2px 6px",
                        borderRadius: "4px",
                        cursor: "pointer",
                      }}
                    >
                      ⬅ Configurar Master
                    </button>
                  </>
                )}
              </div>
              <h2 style={{ margin: "2px 0 0", fontSize: "1.02rem", fontWeight: 800, color: "#FFFFFF" }}>
                {esModoMaster
                  ? (esFloristeria
                    ? "Configuración General del Arreglo Floral Master"
                    : esMantenimiento
                    ? "Configuración General del Servicio de Mantenimiento Master"
                    : "Configuración General del Servicio Profesional Master")
                  : `Editar Tarifa y Variación: ${varianteActual?.var_nombre || ""}`}
              </h2>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "3px" }}>
                <span
                  title={`ID único en base de datos: ${producto.pro_id}`}
                  style={{
                    fontSize: "0.68rem",
                    color: "#94A3B8",
                    fontFamily: "monospace",
                    background: "rgba(255,255,255,0.08)",
                    padding: "1px 6px",
                    borderRadius: "4px",
                    border: "1px solid rgba(255,255,255,0.12)",
                  }}
                >
                  🔑 Código Único: {producto.pro_id.length > 20 ? `${producto.pro_id.slice(0, 13)}...` : producto.pro_id}
                </span>
                {producto.pro_slug && (
                  <span
                    title={`Slug URL comercial: ${producto.pro_slug}`}
                    style={{
                      fontSize: "0.68rem",
                      color: "#38BDF8",
                      fontFamily: "monospace",
                    }}
                  >
                    • {producto.pro_slug}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            {onAbrirManual && (
              <button
                type="button"
                onClick={onAbrirManual}
                title="Ver Manual de Configuración Floral"
                style={{
                  background: "#F1F5F9",
                  border: "1px solid #CBD5E1",
                  color: "#334155",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  cursor: "pointer",
                }}
              >
                <BookOpen size={13} />
                <span>Manual</span>
              </button>
            )}
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "#64748B",
                padding: "6px",
                borderRadius: "8px",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* BARRA DE NAVEGACIÓN ENTRE CAPA MASTER Y CAPA VARIANTES */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
            padding: "8px 18px",
            borderBottom: "1px solid #E2E8F0",
            flexWrap: "wrap",
            gap: "8px",
          }}
        >
          <div style={{ display: "flex", gap: "6px" }}>
            <button
              type="button"
              onClick={() => {
                setModoEdicion("master");
                setConfirmarEliminar(false);
                setConfirmarEliminarVariante(false);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: esModoMaster ? 800 : 600,
                border: esModoMaster ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                background: esModoMaster ? "#0284C7" : "#FFFFFF",
                color: esModoMaster ? "#FFFFFF" : "#475569",
                cursor: "pointer",
                boxShadow: esModoMaster ? "0 2px 4px rgba(2, 132, 199, 0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <PackagePlus size={14} />
              <span>🌐 1. Producto Master (Global)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setModoEdicion("variante");
                setConfirmarEliminar(false);
                setConfirmarEliminarVariante(false);
                if (varianteActivaIndex >= variantesLocales.length) setVarianteActivaIndex(0);
              }}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                padding: "6px 14px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: !esModoMaster ? 800 : 600,
                border: !esModoMaster ? `1.5px solid ${colVariante.border}` : "1px solid #CBD5E1",
                background: !esModoMaster ? colVariante.bg : "#FFFFFF",
                color: !esModoMaster ? colVariante.text : "#475569",
                cursor: "pointer",
                boxShadow: !esModoMaster ? `0 2px 4px ${colVariante.border}33` : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Layers size={14} />
              <span>{esFloristeria ? `🌸 2. Tamaños (${variantesLocales.length})` : `🏷️ 2. Variantes y Planes (${variantesLocales.length})`}</span>
            </button>
          </div>

          <div style={{ fontSize: "0.72rem", color: "#64748B" }}>
            {esModoMaster ? (
              <span>Modificando portada y atributos base globales</span>
            ) : (
              <span>
                Editando variante: <strong style={{ color: colVariante.text }}>{varianteActual?.var_nombre}</strong>
              </span>
            )}
          </div>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                padding: "10px 14px",
                borderRadius: "8px",
                marginBottom: "14px",
                fontSize: "0.82rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 1: CONFIGURACIÓN GENERAL DEL PRODUCTO MASTER (GLOBAL)                */}
          {/* ========================================================================= */}
          {esModoMaster && (
            <div>
              {/* 1. DATOS PRINCIPALES DEL PRODUCTO MASTER */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
                  Nombre del {esFloristeria ? "Arreglo / Producto Floral" : "Servicio Master"} *
                </label>
                <input
                  type="text"
                  required
                  placeholder={esFloristeria ? "Ej. Bouquet Diseño Estilo Coreano" : "Ej. Elaboración de Contrato"}
                  value={nombre}
                  onChange={(e) => setNombre(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                      Categoría / Colección *
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setCatModalTab("crear");
                          setModalCatAbierto(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: esFloristeria ? "#E11D48" : "#0284C7",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title={esFloristeria ? "Crear nueva colección floral" : "Crear nueva categoría"}
                      >
                        <FolderPlus size={13} />
                        <span>+ Nueva</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setCatModalTab("gestionar");
                          setModalCatAbierto(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#64748B",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Administrar y eliminar categorías existentes"
                      >
                        <Settings2 size={13} />
                        <span>Gestionar</span>
                      </button>
                    </div>
                  </div>
                  <select
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                    }}
                  >
                    {categoriasLocales.map((c) => (
                      <option key={c.ctg_id} value={c.ctg_id}>
                        {c.ctg_nombre}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Tipo de Oferta Comercial
                  </label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      background: "#FFFFFF",
                    }}
                  >
                    <option value="FISICO">
                      {esFloristeria
                        ? "Producto Físico / Entrega Floral a Domicilio"
                        : esMantenimiento
                        ? "Producto Físico / Repuesto"
                        : "Físico / Entrega Notarial"}
                    </option>
                    <option value="SERVICIO">
                      {esFloristeria
                        ? "Servicio de Decoración / Eventos"
                        : esMantenimiento
                        ? "Servicio Técnico / Reparación"
                        : "Servicio / Trámite Puntual"}
                    </option>
                    <option value="SUSCRIPCION">
                      {esFloristeria
                        ? "Suscripción Floral (Semanal / Mensual)"
                        : "Suscripción / Plan Periódico"}
                    </option>
                    <option value="DIGITAL">
                      {esFloristeria
                        ? "Tarjeta Dedicatoria Digital / Gift Card"
                        : "Producto Digital / Formato"}
                    </option>
                  </select>
                </div>
              </div>

              {/* 2. CONTROL DE ESTADO ACTIVO & TEMPORALIDAD ESTACIONAL */}
              <div
                style={{
                  background: !proActivo ? "#FEF2F2" : vigenciaTipo !== "SIEMPRE" ? "#FFFBEB" : "#F8FAFC",
                  border: !proActivo
                    ? "1.5px solid #FCA5A5"
                    : vigenciaTipo !== "SIEMPRE"
                    ? "1.5px solid #FDE68A"
                    : "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "14px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={16} color={!proActivo ? "#DC2626" : vigenciaTipo !== "SIEMPRE" ? "#D97706" : "#0284C7"} />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: !proActivo ? "#991B1B" : "#1E293B", textTransform: "uppercase" }}>
                      Disponibilidad & Temporalidad Estacional
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Switch Principal Activar / Desactivar Producto */}
                    <button
                      type="button"
                      onClick={() => setProActivo(!proActivo)}
                      style={{
                        background: proActivo ? "#ECFDF5" : "#FEF2F2",
                        border: proActivo ? "1.5px solid #10B981" : "1.5px solid #EF4444",
                        color: proActivo ? "#065F46" : "#991B1B",
                        padding: "5px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                      }}
                    >
                      <Power size={13} color={proActivo ? "#10B981" : "#EF4444"} />
                      <span>{proActivo ? "🟢 Activo en Catálogo" : "⚪ Desactivado (Oculto)"}</span>
                    </button>

                    {/* Switch Insignia Destacado (Web & Landing) */}
                    <button
                      type="button"
                      onClick={() => setDestacado(!destacado)}
                      style={{
                        background: destacado ? "linear-gradient(135deg, #FEF3C7, #FDE68A)" : "#F1F5F9",
                        border: destacado ? "1.5px solid #F59E0B" : "1.5px solid #CBD5E1",
                        color: destacado ? "#B45309" : "#64748B",
                        padding: "5px 12px",
                        borderRadius: "8px",
                        fontSize: "0.75rem",
                        fontWeight: 800,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
                        transition: "all 0.15s ease",
                      }}
                      title="Marca este producto con la insignia DESTACADO para priorizarlo en la sección de planes de la landing y en el catálogo"
                    >
                      <Sparkles size={13} color={destacado ? "#D97706" : "#94A3B8"} />
                      <span>{destacado ? "⭐ Insignia Destacado: SÍ" : "☆ Destacado: NO"}</span>
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0" }}>
                  Configura si el producto se ofrece todo el año o si pertenece a una temporada o rango de fechas específico (ej. "Bouquet San Valentín" del 10 al 15 de febrero):
                </p>

                {/* 3 Modos de Vigencia */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setVigenciaTipo("SIEMPRE")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: vigenciaTipo === "SIEMPRE" ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                      background: vigenciaTipo === "SIEMPRE" ? "#E0F2FE" : "#FFFFFF",
                      color: vigenciaTipo === "SIEMPRE" ? "#0369A1" : "#475569",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    🌐 Todo el Año (Siempre)
                  </button>

                  <button
                    type="button"
                    onClick={() => setVigenciaTipo("RANGO_FECHAS")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: vigenciaTipo === "RANGO_FECHAS" ? "1.5px solid #8B5CF6" : "1px solid #CBD5E1",
                      background: vigenciaTipo === "RANGO_FECHAS" ? "#F5F3FF" : "#FFFFFF",
                      color: vigenciaTipo === "RANGO_FECHAS" ? "#5B21B6" : "#475569",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    📅 Rango de Fechas (Único)
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setVigenciaTipo("ESTACIONAL_ANUAL");
                      if (!fechaInicio) setFechaInicio("02-10");
                      if (!fechaFin) setFechaFin("02-15");
                      if (!etiquetaTemporada) setEtiquetaTemporada(esFloristeria ? "San Valentín" : "Temporada Anual");
                      if (!mensajeFueraTemporada) setMensajeFueraTemporada("Disponible únicamente del 10 al 15 de febrero de cada año.");
                    }}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: vigenciaTipo === "ESTACIONAL_ANUAL" ? "1.5px solid #E11D48" : "1px solid #CBD5E1",
                      background: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#FFF1F2" : "#FFFFFF",
                      color: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#9F1239" : "#475569",
                      cursor: "pointer",
                      textAlign: "center",
                    }}
                  >
                    <Clock size={13} style={{ display: "inline-block", verticalAlign: "middle", marginRight: "4px" }} />
                    Estacional Anual (Recurrente)
                  </button>
                </div>

                {/* Campos contextuales para Rango de Fechas o Estacional Anual */}
                {vigenciaTipo === "RANGO_FECHAS" && (
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Fecha de Inicio (Desde YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Fecha de Fin (Hasta YYYY-MM-DD)
                      </label>
                      <input
                        type="date"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      />
                    </div>
                  </div>
                )}

                {vigenciaTipo === "ESTACIONAL_ANUAL" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                          Fecha Inicio Anual (Mes-Día, ej. 02-10 para 10 Feb)
                        </label>
                        <input
                          type="text"
                          placeholder="MM-DD (ej. 02-10)"
                          value={fechaInicio}
                          onChange={(e) => setFechaInicio(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                          Fecha Fin Anual (Mes-Día, ej. 02-15 para 15 Feb)
                        </label>
                        <input
                          type="text"
                          placeholder="MM-DD (ej. 02-15)"
                          value={fechaFin}
                          onChange={(e) => setFechaFin(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.8rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                          Etiqueta de Temporada (Badge visible)
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. San Valentín"
                          value={etiquetaTemporada}
                          onChange={(e) => setEtiquetaTemporada(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.78rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                          Mensaje informativo fuera de temporada
                        </label>
                        <input
                          type="text"
                          placeholder="Ej. Disponible únicamente del 10 al 15 de febrero de cada año."
                          value={mensajeFueraTemporada}
                          onChange={(e) => setMensajeFueraTemporada(e.target.value)}
                          style={{
                            width: "100%",
                            padding: "6px 10px",
                            borderRadius: "6px",
                            border: "1px solid #CBD5E1",
                            fontSize: "0.78rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* 3. RECURSOS DIGITALES Y MULTIMEDIA GLOBALES (MASTER) */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <ImageIcon size={16} color="#475569" />
                    <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#334155", textTransform: "uppercase" }}>
                      Recursos Digitales Globales (Foto Principal Master)
                    </span>
                  </div>
                  <span style={{ fontSize: "0.7rem", color: "#64748B", fontWeight: 600 }}>
                    Las variantes heredarán esta foto salvo que tengan una propia
                  </span>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                        URL Imagen de Portada Principal (Global) *
                      </label>
                      {(imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) && (
                        <span style={{ fontSize: "0.68rem", color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                          <AlertCircle size={12} /> Requiere Extracción
                        </span>
                      )}
                      {imagenUrl.includes("lh3.googleusercontent.com") && (
                        <span style={{ fontSize: "0.68rem", color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                          <CheckCircle2 size={12} /> Imagen Directa Lista
                        </span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                      <input
                        type="url"
                        placeholder="https://... o sube una imagen desde tu PC ➔"
                        value={imagenUrl}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
                          if (driveMatch && driveMatch[1]) {
                            setImagenUrl(`https://lh3.googleusercontent.com/d/${driveMatch[1]}=w1200`);
                          } else {
                            setImagenUrl(raw);
                          }
                          setExitoAutoConvertir(null);
                        }}
                        style={{
                          flex: 1,
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: (imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) ? "1.5px solid #F59E0B" : "1px solid #CBD5E1",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                        }}
                      />

                      <label
                        style={{
                          background: subiendoImagenGlobal ? "#94A3B8" : "#0F172A",
                          color: "#FFFFFF",
                          padding: "7px 11px",
                          borderRadius: "6px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: subiendoImagenGlobal ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                        }}
                        title="Seleccionar foto desde tu disco local o Google Drive en PC"
                      >
                        {subiendoImagenGlobal ? (
                          <>
                            <Loader2 size={13} className="animate-spin" />
                            <span>Subiendo...</span>
                          </>
                        ) : (
                          <>
                            <Upload size={13} />
                            <span>📁 Subir PC</span>
                          </>
                        )}
                        <input
                          type="file"
                          accept="image/*"
                          disabled={subiendoImagenGlobal}
                          onChange={handleSubirArchivoGlobal}
                          style={{ display: "none" }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setContextoGaleria("master");
                          setModalGaleriaAbierto(true);
                        }}
                        style={{
                          background: "#0284C7",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "7px 11px",
                          borderRadius: "6px",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          boxShadow: "0 1px 2px rgba(2, 132, 199, 0.2)",
                        }}
                        title="Abrir galería de imágenes del negocio"
                      >
                        <ImageIcon size={13} />
                        <span>🖼️ Galería</span>
                      </button>
                    </div>

                    {exitoAutoConvertir && (
                      <div style={{ marginTop: "4px", fontSize: "0.7rem", color: "#15803D", background: "#DCFCE7", padding: "4px 8px", borderRadius: "4px", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: "4px" }}>
                        <CheckCircle2 size={13} /> {exitoAutoConvertir}
                      </div>
                    )}

                    {(imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl") || imagenUrl.includes("drive.google.com/drive")) && (
                      <div style={{ marginTop: "6px", fontSize: "0.7rem", color: "#92400E", background: "#FEF3C7", padding: "8px 10px", borderRadius: "6px", border: "1px solid #FDE68A", lineHeight: 1.4 }}>
                        <div style={{ fontWeight: 800, marginBottom: "3px", display: "flex", alignItems: "center", gap: "4px" }}>
                          <AlertCircle size={13} color="#D97706" /> Enlace de Álbum Web Detectado
                        </div>
                        <div>Este enlace abre el visor web de Google Fotos, no un archivo de imagen directo (.jpg).</div>
                        <div style={{ marginTop: "6px", display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                          <button
                            type="button"
                            disabled={resolviendoImagen}
                            onClick={() => handleConvertirImagenGlobal()}
                            style={{
                              background: "#0284C7",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "4px 9px",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              cursor: resolviendoImagen ? "wait" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                            }}
                          >
                            {resolviendoImagen ? (
                              <>
                                <Loader2 size={12} className="animate-spin" /> Extrayendo Directa...
                              </>
                            ) : (
                              <>
                                <Wand2 size={12} /> 🪄 Auto-Convertir Foto
                              </>
                            )}
                          </button>

                          <button
                            type="button"
                            onClick={() => {
                              setAlbumFotosUrl(imagenUrl);
                              setImagenUrl("");
                            }}
                            style={{
                              background: "#B45309",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "4px 8px",
                              borderRadius: "4px",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            📁 Mover a "Álbum de Muestras"
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Selector de Encuadre & Posición en Carrusel Cuadrado para Master */}
                    {imagenUrl && (
                      <SelectorEncuadreFoto
                        imagenUrl={imagenUrl}
                        posicion={fotoPosicionMaster}
                        ajuste={fotoAjusteMaster}
                        zoom={fotoZoomMaster}
                        onCambiarPosicion={(pos) => setFotoPosicionMaster(pos)}
                        onCambiarAjuste={(aj) => setFotoAjusteMaster(aj)}
                        onCambiarZoom={(zm) => setFotoZoomMaster(zm)}
                        titulo="Encuadre & Posición en Carrusel Cuadrado (Portada Master)"
                        colorTema="#0284C7"
                      />
                    )}
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      URL Álbum de Muestras Reales (Google Photos / Instagram)
                    </label>
                    <input
                      type="url"
                      placeholder="https://photos.app.goo.gl/... o https://photos.google.com/share/..."
                      value={albumFotosUrl}
                      onChange={(e) => setAlbumFotosUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      URL Video / GIF Demostrativo (YouTube, MP4)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... o .mp4 / .webm"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                        Galería Adicional (URLs por salto de línea)
                      </label>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <label
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "#0284C7",
                            cursor: subiendoGaleria ? "wait" : "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          {subiendoGaleria ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                          <span>+ Subir PC</span>
                          <input
                            type="file"
                            accept="image/*"
                            disabled={subiendoGaleria}
                            onChange={handleSubirArchivoGaleria}
                            style={{ display: "none" }}
                          />
                        </label>

                        <button
                          type="button"
                          onClick={() => {
                            setContextoGaleria("galeria");
                            setModalGaleriaAbierto(true);
                          }}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#0284C7",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            padding: 0,
                          }}
                        >
                          <ImageIcon size={11} />
                          <span>+ De Galería</span>
                        </button>
                      </div>
                    </div>
                    <textarea
                      rows={2}
                      placeholder="https://...foto1.jpg&#10;https://...foto2.jpg"
                      value={galeriaTexto}
                      onChange={(e) => setGaleriaTexto(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* 3. TIEMPO DE ENTREGA GLOBAL & DESCRIPCIÓN BASE */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
                  Promesa y Tiempo de Entrega Global * (Heredado por defecto)
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                  {presetsEntrega.map((pr) => {
                    const sel = tiempoEntrega === pr.val;
                    return (
                      <button
                        key={pr.val}
                        type="button"
                        onClick={() => setTiempoEntrega(pr.val)}
                        style={{
                          padding: "4px 8px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: sel ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                          background: sel ? "#0F172A" : "#FFFFFF",
                          color: sel ? "#FFFFFF" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        {pr.label}
                      </button>
                    );
                  })}
                </div>
                <input
                  type="text"
                  required
                  placeholder="Ej. 🌸 Pide hoy, recibe hoy (Mismo Día)"
                  value={tiempoEntrega}
                  onChange={(e) => setTiempoEntrega(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Descripción Detallada Base (Global)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={esFloristeria ? "Arreglo exclusivo de vanguardia envuelto en finos papeles coreanos..." : "Alcance del servicio..."}
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Beneficios / ¿Qué incluye? Base (Una viñeta por línea)
                  </label>
                  <textarea
                    rows={3}
                    placeholder={
                      esFloristeria
                        ? "Rosas de exportación seleccionadas de tallo largo\nPapel coreano plisado y cintas de seda satinada\nTarjeta dedicatoria personalizada gratis"
                        : "Asesoría jurídica continua\nRevisión y dictamen formal avalado"
                    }
                    value={beneficiosTexto}
                    onChange={(e) => setBeneficiosTexto(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* 4. CONFIGURACIÓN GLOBAL DE IVA SRI (ECUADOR) */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Percent size={16} color="#0284C7" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B" }}>
                      Tarifa IVA SRI Predeterminada (Global para este Producto)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => aplicarIvaMasterATodos(tarifaIvaMaster)}
                    style={{
                      background: "#E0F2FE",
                      border: "1px solid #7DD3FC",
                      color: "#0369A1",
                      padding: "4px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 800,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      boxShadow: "0 1px 2px rgba(2, 132, 199, 0.1)",
                    }}
                    title="Aplica esta tarifa a todas las variantes existentes"
                  >
                    <span>⚡ Aplicar a todos los tamaños ({variantesLocales.length})</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      if (autoAplicarIvaVariantes) {
                        aplicarIvaMasterATodos(15);
                      } else {
                        setTarifaIvaMaster(15);
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      border: tarifaIvaMaster === 15 ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: tarifaIvaMaster === 15 ? "#F0F9FF" : "#FFFFFF",
                      color: tarifaIvaMaster === 15 ? "#0284C7" : "#475569",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: tarifaIvaMaster === 15 ? "0 2px 4px rgba(2, 132, 199, 0.15)" : "none",
                    }}
                  >
                    <span>🇪🇨 IVA 15% (Tarifa General SRI)</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748B" }}>
                      Calcula IVA 15% sobre la base imponible
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (autoAplicarIvaVariantes) {
                        aplicarIvaMasterATodos(0);
                      } else {
                        setTarifaIvaMaster(0);
                      }
                    }}
                    style={{
                      padding: "8px 12px",
                      borderRadius: "8px",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      border: tarifaIvaMaster === 0 ? "2px solid #10B981" : "1px solid #CBD5E1",
                      background: tarifaIvaMaster === 0 ? "#ECFDF5" : "#FFFFFF",
                      color: tarifaIvaMaster === 0 ? "#059669" : "#475569",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: tarifaIvaMaster === 0 ? "0 2px 4px rgba(16, 185, 129, 0.15)" : "none",
                    }}
                  >
                    <span>🌿 IVA 0% (Exento SRI / Tarifa Cero)</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#64748B" }}>
                      Servicios médicos, canasta básica o exentos
                    </span>
                  </button>
                </div>

                {/* Opción de sincronización automática y feedback */}
                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "#334155", cursor: "pointer", fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={autoAplicarIvaVariantes}
                      onChange={(e) => setAutoAplicarIvaVariantes(e.target.checked)}
                      style={{ accentColor: "#0284C7", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span>Sincronizar y aplicar automáticamente a todas las variantes / tamaños ({variantesLocales.length}) al hacer clic</span>
                  </label>
                  {mensajeFeedbackIva && (
                    <span style={{ fontSize: "0.72rem", color: "#047857", fontWeight: 800, background: "#ECFDF5", border: "1px solid #10B981", borderRadius: "6px", padding: "3px 8px" }}>
                      {mensajeFeedbackIva}
                    </span>
                  )}
                </div>
              </div>

              {/* 5. MODALIDAD DE ATENCIÓN / LOGÍSTICA & TRANSPORTE */}
              <div
                style={{
                  background: deliveryIncluido ? "#F0FDF4" : "#F8FAFC",
                  border: deliveryIncluido ? "1.5px solid #86EFAC" : "1px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                  {esLegal ? (
                    <Scale size={16} color={deliveryIncluido ? "#16A34A" : "#0284C7"} />
                  ) : esFloristeria ? (
                    <Flower2 size={16} color={deliveryIncluido ? "#16A34A" : "#E11D48"} />
                  ) : (
                    <Truck size={16} color={deliveryIncluido ? "#16A34A" : "#64748B"} />
                  )}
                  <label style={{ fontSize: "0.8rem", fontWeight: 800, color: deliveryIncluido ? "#166534" : "#1E293B" }}>
                    {esLegal
                      ? "Modalidad de Atención Legal & Entrega de Dictamen"
                      : esFloristeria
                      ? "Logística, Envíos & Entrega Floral"
                      : "Logística & Turnos de Cuadrilla Técnica"}
                  </label>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px", marginBottom: "10px" }}>
                  {esLegal ? (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("TELEMATICO_DIGITAL");
                          setEtiquetaTransporte("🌐 Modalidad 100% Telemática");
                          setCoberturaTransporte("Cobertura Nacional (Ecuador)");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                          background: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "#E0F2FE" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "#0369A1" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🌐 100% Telemático / Digital
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("NOTARIAL_PRESENCIAL");
                          setEtiquetaTransporte("🏛️ Gestión Notarial Segura");
                          setCoberturaTransporte("Sedes Notariales / Despacho");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "1.5px solid #6366F1" : "1px solid #CBD5E1",
                          background: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "#EEF2FF" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "#4338CA" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🏛️ Gestión Notarial / Despacho
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(true);
                          setModalidadTransporte("COURIER_NOTARIAL");
                          setEtiquetaTransporte("📦 Mensajería Notarial Segura");
                          setCoberturaTransporte("Quito Urbano y Valles");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: deliveryIncluido ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                          background: deliveryIncluido ? "#DCFCE7" : "#FFFFFF",
                          color: deliveryIncluido ? "#166534" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        📦 Courier Físico Escrituras
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(true);
                          setModalidadTransporte("INCLUIDO_GRATIS");
                          setEtiquetaTransporte(esFloristeria ? "🌸 Envío Floral Incluido" : "🚚 Visita Técnica Incluida");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                          background: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "#DCFCE7" : "#FFFFFF",
                          color: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "#166534" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🚚 Envío Incluido (Gratis)
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("COSTO_ADICIONAL");
                          setEtiquetaTransporte(esFloristeria ? "📦 Delivery con Costo Adicional" : "📦 Traslado con Costo");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "1.5px solid #F59E0B" : "1px solid #CBD5E1",
                          background: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "#FEF3C7" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "#92400E" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        📦 Costo Adicional en Checkout
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("SOLO_RETIRO");
                          setEtiquetaTransporte(esFloristeria ? "🏪 Retiro en Taller Floral" : "🏪 Solo Retiro en Local");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "1.5px solid #64748B" : "1px solid #CBD5E1",
                          background: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "#F1F5F9" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "#1E293B" : "#475569",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🏪 Solo Retiro en Local
                      </button>
                    </>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      {esLegal ? "Etiqueta Visible de Modalidad" : "Etiqueta Visible de Transporte"}
                    </label>
                    <input
                      type="text"
                      value={etiquetaTransporte}
                      onChange={(e) => setEtiquetaTransporte(e.target.value)}
                      placeholder={esLegal ? "Ej. 🌐 Modalidad 100% Telemática" : "Ej. 🚚 Envío a Domicilio Incluido"}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      {esLegal ? "Alcance de Cobertura Legal" : "Zona o Sector de Cobertura"}
                    </label>
                    <input
                      type="text"
                      value={coberturaTransporte}
                      onChange={(e) => setCoberturaTransporte(e.target.value)}
                      placeholder={esLegal ? "Ej. Cobertura Nacional (Ecuador)" : "Ej. Quito Urbano y Valles"}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                </div>
              </div>


              {/* 6. CANALES DE VISIBILIDAD Y DISTRIBUCIÓN */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Share2 size={16} color="#0284C7" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                      Canales de Visibilidad y Distribución
                    </label>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                    {canalesSeleccionados.length} de {CANALES_CATALOGO_OFICIALES.length} activos
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0 0 10px 0" }}>
                  Indica en qué plataformas, aplicaciones y agentes de IA estará disponible este producto:
                </p>

                {!tieneAlMenosUnaImagen && (
                  <div
                    style={{
                      background: "#FFFBEB",
                      border: "1px solid #FDE68A",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontSize: "0.74rem",
                      color: "#92400E",
                      lineHeight: "1.35",
                    }}
                  >
                    <AlertCircle size={15} color="#D97706" style={{ flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <strong style={{ fontWeight: 800 }}>Control de Calidad Visual:</strong> Los canales <strong>E-Commerce Web</strong> y <strong>App Clientes</strong> requieren al menos 1 imagen configurada para poder activarse y ser visibles al público.
                    </div>
                  </div>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
                  {CANALES_CATALOGO_OFICIALES.map((c) => {
                    const activo = canalesSeleccionados.includes(c.clave);
                    const exigeImagenYFalta = CANALES_REQUIEREN_IMAGEN.includes(c.clave) && !tieneAlMenosUnaImagen;

                    return (
                      <button
                        key={c.clave}
                        type="button"
                        onClick={() => toggleCanal(c.clave)}
                        title={
                          exigeImagenYFalta
                            ? `Requiere al menos 1 imagen configurada para activarse en ${c.nombre}`
                            : undefined
                        }
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border: `1.5px solid ${activo ? c.color : exigeImagenYFalta ? "#CBD5E1" : "#E2E8F0"}`,
                          background: activo ? `${c.color}12` : exigeImagenYFalta ? "#F1F5F9" : "#FFFFFF",
                          color: activo ? "#0F172A" : exigeImagenYFalta ? "#94A3B8" : "#64748B",
                          cursor: "pointer",
                          fontSize: "0.78rem",
                          fontWeight: activo ? 700 : 500,
                          textAlign: "left",
                          transition: "all 0.15s ease",
                          opacity: exigeImagenYFalta && !activo ? 0.75 : 1,
                        }}
                      >
                        <span
                          style={{
                            width: "8px",
                            height: "8px",
                            borderRadius: "50%",
                            background: activo ? c.color : "#CBD5E1",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.nombre}
                          </div>
                          {exigeImagenYFalta && (
                            <span style={{ fontSize: "0.65rem", background: "#FEF2F2", color: "#DC2626", border: "1px solid #FECACA", borderRadius: "4px", padding: "1px 4px", marginLeft: "4px", fontWeight: 700 }}>
                              📷 Foto req.
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 7. USOS Y APLICACIONES RECOMENDADAS (CASOS DE USO PARA IA & BUSCADOR) */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Target size={16} color="#0284C7" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                      {esFloristeria ? "Usos y Ocasiones Recomendadas (IA & Filtros)" : "Usos y Casos de Aplicación (IA & Filtros)"}
                    </label>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#0369A1", fontWeight: 700, background: "#E0F2FE", padding: "2px 8px", borderRadius: "12px" }}>
                    {usosSeleccionados.length} usos activos
                  </span>
                </div>
                <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                  Marca los escenarios donde los agentes de IA (como ARIA) y los filtros deben recomendar este ítem. Los productos sin un uso específico (ej. <em>Condolencias</em>) serán excluidos automáticamente de esas consultas.
                </p>

                {/* Mensaje de feedback tras eliminar uso */}
                {mensajeExitoUso && (
                  <div
                    style={{
                      background: "#ECFDF5",
                      color: "#065F46",
                      border: "1px solid #A7F3D0",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckCircle2 size={16} color="#059669" />
                    <span>{mensajeExitoUso}</span>
                  </div>
                )}

                {/* Grid Unificado de Usos (Presets + Personalizados) */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(165px, 1fr))", gap: "6px", marginBottom: "10px" }}>
                  {todosUsosDisponibles.map((u) => {
                    const activo = usosSeleccionados.includes(u.clave);
                    const estaVerificando = verificandoUsoClave === u.clave;

                    return (
                      <button
                        key={u.clave}
                        type="button"
                        onClick={() => toggleUso(u.clave)}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          fontSize: "0.75rem",
                          fontWeight: activo ? 700 : 500,
                          border: activo ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                          background: activo ? "#F0F9FF" : "#FFFFFF",
                          color: activo ? "#0369A1" : "#475569",
                          cursor: "pointer",
                          textAlign: "left",
                          transition: "all 0.15s ease",
                          gap: "4px",
                          opacity: estaVerificando ? 0.6 : 1,
                        }}
                      >
                        <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                          {u.label}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "5px", flexShrink: 0 }}>
                          {/* Botón Eliminar Uso con Validación */}
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleSolicitarEliminarUso(u.clave, u.label);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.stopPropagation();
                                handleSolicitarEliminarUso(u.clave, u.label);
                              }
                            }}
                            title="Eliminar este uso (solo permitido si ningún producto lo utiliza)"
                            style={{
                              color: "#94A3B8",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px",
                              borderRadius: "3px",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
                          >
                            {estaVerificando ? (
                              <Loader2 size={12} className="animate-spin" />
                            ) : (
                              <X size={12} />
                            )}
                          </span>
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: activo ? "#0284C7" : "#CBD5E1",
                              flexShrink: 0,
                            }}
                          />
                        </div>
                      </button>
                    );
                  })}
                </div>

                {/* Input para agregar uso libre */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Escribir otro uso personalizado (ej. graduacion_honor)..."
                    value={nuevoUsoTexto}
                    onChange={(e) => setNuevoUsoTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAgregarUsoPersonalizado();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarUsoPersonalizado}
                    style={{
                      background: "#0F172A",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Agregar Uso
                  </button>
                </div>

                {/* Enlace para restaurar presets si existen eliminados */}
                {usosEliminados.length > 0 && (
                  <div style={{ marginTop: "8px", display: "flex", justifyContent: "flex-end" }}>
                    <button
                      type="button"
                      onClick={handleRestaurarUsosPredeterminados}
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#0284C7",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                        padding: 0,
                        fontWeight: 600,
                      }}
                    >
                      ↺ Restaurar usos predeterminados ({usosEliminados.length} eliminados)
                    </button>
                  </div>
                )}
              </div>

              {/* 8. ETIQUETAS SEMÁNTICAS DE BÚSQUEDA (KEYWORDS IA) */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1.5px solid #E2E8F0",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Tag size={16} color="#0284C7" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                      Etiquetas Semánticas de Búsqueda (Keywords IA)
                    </label>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#64748B", fontWeight: 600 }}>
                    {etiquetasSeleccionadas.length} etiquetas
                  </span>
                </div>
                <p style={{ fontSize: "0.73rem", color: "#64748B", margin: "0 0 10px 0" }}>
                  Palabras clave o términos que el cliente o el asistente conversacional pueden usar (ej. <em>coreano</em>, <em>rosas rojas</em>, <em>papel importado</em>, <em>vanguardia</em>):
                </p>

                {/* Lista de tags activos */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px", minHeight: "26px", alignItems: "center" }}>
                  {etiquetasSeleccionadas.length === 0 ? (
                    <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontStyle: "italic" }}>
                      Sin etiquetas asignadas. Escribe una a continuación para agregarla.
                    </span>
                  ) : (
                    etiquetasSeleccionadas.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "#F1F5F9",
                          color: "#334155",
                          border: "1px solid #CBD5E1",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        <Hash size={12} color="#64748B" />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleEliminarEtiqueta(tag)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#94A3B8",
                            cursor: "pointer",
                            padding: 0,
                            display: "flex",
                            alignItems: "center",
                            marginLeft: "2px",
                          }}
                          title="Eliminar etiqueta"
                        >
                          <X size={12} />
                        </button>
                      </span>
                    ))
                  )}
                </div>

                {/* Input para agregar etiquetas */}
                <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="Escribir etiqueta y presionar Enter (ej. rosas de exportación)..."
                    value={nuevaEtiquetaTexto}
                    onChange={(e) => setNuevaEtiquetaTexto(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        handleAgregarEtiqueta();
                      }
                    }}
                    style={{
                      flex: 1,
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarEtiqueta}
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.74rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    + Añadir Tag
                  </button>
                </div>
              </div>

              {/* Banner resumen que invita a configurar tamaños */}
              <div
                style={{
                  background: "#F0F9FF",
                  border: "1.5px dashed #38BDF8",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                }}
              >
                <div>
                  <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#0369A1" }}>
                    🏷️ Variantes / Tamaños configurados: {variantesLocales.length}
                  </div>
                  <div style={{ fontSize: "0.72rem", color: "#0284C7" }}>
                    Puedes personalizar fotos individuales y precios para cada tamaño en la pestaña de variantes.
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setModoEdicion("variante");
                    setVarianteActivaIndex(0);
                  }}
                  style={{
                    background: "#0284C7",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  Configurar Tamaños ➔
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 2: EDITOR DE VARIANTES Y TAMAÑOS CON HERENCIA Y FOTO INDIVIDUAL      */}
          {/* ========================================================================= */}
          {!esModoMaster && (
            <div
              style={{
                background: "#F8FAFC",
                border: "1.5px solid #CBD5E1",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={17} color="#0F172A" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0F172A", textTransform: "uppercase" }}>
                    Selecciona el Tamaño / Variante para Personalizar ({variantesLocales.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={agregarNuevaVariante}
                  style={{
                    background: "#0F172A",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "6px",
                    padding: "5px 12px",
                    fontSize: "0.75rem",
                    fontWeight: 700,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    cursor: "pointer",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                  }}
                >
                  <Plus size={13} />
                  <span>+ Agregar Variante</span>
                </button>
              </div>

              {/* Pestañas de Variantes con Código de Color Individual y Reordenamiento */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                {variantesLocales.map((v, idx) => {
                  const activa = idx === varianteActivaIndex;
                  const col = PALETA_COLORES_VARIANTES[idx % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;
                  const pvpCalculado = (Number(v.var_precio || 0) * (1 + (v.var_tarifa_iva_porcentaje ?? 15) / 100));
                  const tieneFotoPropia = Boolean(v.var_detalle_variante?.portada_url);

                  return (
                    <div
                      key={v.var_id || idx}
                      onClick={() => {
                        setVarianteActivaIndex(idx);
                      }}
                      style={{
                        padding: "6px 10px",
                        borderRadius: "8px",
                        border: activa ? `2px solid ${col.border}` : `1.5px solid ${col.border}66`,
                        background: activa ? col.bg : "#FFFFFF",
                        color: activa ? col.text : "#475569",
                        fontWeight: activa ? 800 : 600,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        transition: "all 0.15s ease",
                        boxShadow: activa ? `0 2px 8px ${col.border}33` : "none",
                      }}
                    >
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                      <span>{v.var_nombre}</span>
                      <span style={{ fontWeight: 800, color: activa ? col.text : "#0F172A" }}>
                        ${(v.precio_total || pvpCalculado).toFixed(2)}
                      </span>
                      {tieneFotoPropia ? (
                        <span
                          title="Tiene Foto Propia Exclusiva"
                          style={{
                            fontSize: "0.62rem",
                            background: "#0284C7",
                            color: "#FFFFFF",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 800,
                          }}
                        >
                          📸 Foto Propia
                        </span>
                      ) : (
                        <span
                          title="Hereda la Foto Global"
                          style={{
                            fontSize: "0.62rem",
                            background: "#F1F5F9",
                            color: "#64748B",
                            padding: "1px 5px",
                            borderRadius: "4px",
                            fontWeight: 600,
                          }}
                        >
                          ⚪ Heredada
                        </span>
                      )}

                      {/* Botones rápidos de reordenamiento en la pestaña */}
                      {variantesLocales.length > 1 && (
                        <div
                          style={{ display: "inline-flex", gap: "2px", marginLeft: "4px" }}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <button
                            type="button"
                            disabled={idx === 0}
                            onClick={(e) => moverVariante(idx, "arriba", e)}
                            title="Mover antes / izquierda"
                            style={{
                              background: activa ? "rgba(0,0,0,0.08)" : "#F1F5F9",
                              border: "none",
                              borderRadius: "3px",
                              padding: "2px 4px",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              opacity: idx === 0 ? 0.25 : 1,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronLeft size={11} color={activa ? col.text : "#334155"} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === variantesLocales.length - 1}
                            onClick={(e) => moverVariante(idx, "abajo", e)}
                            title="Mover después / derecha"
                            style={{
                              background: activa ? "rgba(0,0,0,0.08)" : "#F1F5F9",
                              border: "none",
                              borderRadius: "3px",
                              padding: "2px 4px",
                              cursor: idx === variantesLocales.length - 1 ? "not-allowed" : "pointer",
                              opacity: idx === variantesLocales.length - 1 ? 0.25 : 1,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronRight size={11} color={activa ? col.text : "#334155"} />
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Formulario de la Variante Seleccionada con Indicador de Color */}
              {varianteActual && (
                <div
                  style={{
                    background: "#FFFFFF",
                    borderRadius: "10px",
                    padding: "14px",
                    border: `2px solid ${colActiva.border}`,
                    boxShadow: `0 3px 10px ${colActiva.border}22`,
                  }}
                >
                  {/* Banner de Variante Activa con Reordenamiento */}
                  <div
                    style={{
                      background: colActiva.bg,
                      borderRadius: "6px",
                      padding: "8px 12px",
                      marginBottom: "12px",
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: colActiva.text, fontWeight: 800, fontSize: "0.78rem" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colActiva.dot }} />
                      <span>🏷️ EDITANDO: {varianteActual.var_nombre || "Nueva Variante"} (Posición #{varianteActivaIndex + 1} de {variantesLocales.length})</span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {/* Botones de Reordenamiento en Banner */}
                      {variantesLocales.length > 1 && (
                        <div style={{ display: "inline-flex", gap: "4px" }}>
                          <button
                            type="button"
                            disabled={varianteActivaIndex === 0}
                            onClick={(e) => moverVariante(varianteActivaIndex, "arriba", e)}
                            title="Mover esta variante hacia arriba / antes"
                            style={{
                              background: "#FFFFFF",
                              border: `1px solid ${colActiva.border}`,
                              color: colActiva.text,
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              cursor: varianteActivaIndex === 0 ? "not-allowed" : "pointer",
                              opacity: varianteActivaIndex === 0 ? 0.4 : 1,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <ChevronLeft size={12} />
                            <span>Mover antes</span>
                          </button>

                          <button
                            type="button"
                            disabled={varianteActivaIndex === variantesLocales.length - 1}
                            onClick={(e) => moverVariante(varianteActivaIndex, "abajo", e)}
                            title="Mover esta variante hacia abajo / después"
                            style={{
                              background: "#FFFFFF",
                              border: `1px solid ${colActiva.border}`,
                              color: colActiva.text,
                              borderRadius: "4px",
                              padding: "3px 8px",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              cursor: varianteActivaIndex === variantesLocales.length - 1 ? "not-allowed" : "pointer",
                              opacity: varianteActivaIndex === variantesLocales.length - 1 ? 0.4 : 1,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "3px",
                            }}
                          >
                            <span>Mover después</span>
                            <ChevronRight size={12} />
                          </button>
                        </div>
                      )}

                      <span style={{ fontSize: "0.75rem", color: colActiva.text, fontWeight: 800 }}>
                        PVP: ${(varianteActual.precio_total || 0).toFixed(2)}
                      </span>
                    </div>
                  </div>

                  {/* 2. Datos básicos de la variante (Nombre y SKU) */}
                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "10px", marginBottom: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Nombre de la Variante / Tamaño *
                      </label>
                      <input
                        type="text"
                        required
                        placeholder={esFloristeria ? "Ej. Pequeño (12 Rosas) o Gigante VIP (50 Rosas + Corona)" : "Ej. Opción Estándar"}
                        value={varianteActual.var_nombre}
                        onChange={(e) => actualizarVarianteActual("var_nombre", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Código SKU / Referencia
                      </label>
                      <input
                        type="text"
                        placeholder="Ej. TNK-COR-MED"
                        value={varianteActual.var_sku || ""}
                        onChange={(e) => actualizarVarianteActual("var_sku", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Precio Base Imponible ($ USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={varianteActual.var_precio}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            actualizarVarianteActual("var_precio", "");
                            return;
                          }
                          const num = parseFloat(val);
                          if (!isNaN(num)) {
                            actualizarVarianteActual("var_precio", Math.round(num * 100) / 100);
                          } else {
                            actualizarVarianteActual("var_precio", val);
                          }
                        }}
                        onBlur={(e) => {
                          const num = parseFloat(e.target.value);
                          if (!isNaN(num)) {
                            actualizarVarianteActual("var_precio", parseFloat(num.toFixed(2)));
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.88rem",
                          fontWeight: 800,
                          boxSizing: "border-box",
                          color: "#0F172A",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                        Tarifa IVA SRI (Ecuador)
                      </label>
                      <select
                        value={varianteActual.var_tarifa_iva_porcentaje ?? 15}
                        onChange={(e) => actualizarVarianteActual("var_tarifa_iva_porcentaje", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #CBD5E1",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      >
                        <option value={15}>IVA 15% (Estándar)</option>
                        <option value={0}>IVA 0% (Exento SRI)</option>
                      </select>
                    </div>
                  </div>

                  {/* Resumen de PVP en vivo */}
                  <div
                    style={{
                      margin: "12px 0",
                      padding: "8px 12px",
                      background: "#F8FAFC",
                      border: "1px dashed #CBD5E1",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "#64748B" }}>Base: </span>
                      <strong style={{ color: "#0F172A" }}>${Number(varianteActual.var_precio || 0).toFixed(2)}</strong>
                      <span style={{ margin: "0 6px", color: "#CBD5E1" }}>|</span>
                      <span style={{ color: "#64748B" }}>IVA ({varianteActual.var_tarifa_iva_porcentaje ?? 15}%): </span>
                      <strong style={{ color: "#0F172A" }}>
                        ${(Number(varianteActual.var_precio || 0) * (varianteActual.var_tarifa_iva_porcentaje ?? 15) / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ color: "#64748B" }}>PVP Total:</span>
                      <strong style={{ color: "#059669", fontSize: "0.95rem", fontWeight: 800 }}>
                        ${(Number(varianteActual.var_precio || 0) * (1 + (varianteActual.var_tarifa_iva_porcentaje ?? 15) / 100)).toFixed(2)}
                      </strong>
                      {variantesLocales.length > 1 && (
                        <button
                          type="button"
                          onClick={handleEliminarVarianteClick}
                          disabled={eliminandoVariante}
                          title="Eliminar esta variante"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#EF4444",
                            cursor: eliminandoVariante ? "not-allowed" : "pointer",
                            padding: "2px",
                            marginLeft: "6px",
                            opacity: eliminandoVariante ? 0.5 : 1,
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* 1. SECCIÓN UNIFICADA: GALERÍA DE FOTOS (1 A N) PARA ESTA VARIANTE */}
                  {(() => {
                    const rawGal = Array.isArray(varianteActual?.var_detalle_variante?.galeria_urls)
                      ? varianteActual.var_detalle_variante.galeria_urls.filter((u: any) => typeof u === "string" && u.trim().length > 0)
                      : [];
                    const portActual = varianteActual?.var_detalle_variante?.portada_url?.trim() || null;
                    const fotosVariante: string[] = (portActual && !rawGal.includes(portActual))
                      ? [portActual, ...rawGal]
                      : rawGal;
                    const fotoPortada = portActual || (fotosVariante.length > 0 ? fotosVariante[0] : null);
                    const tieneFotosPropias = fotosVariante.length > 0;

                    return (
                      <div
                        style={{
                          background: "#F8FAFC",
                          border: "1.5px solid #E2E8F0",
                          borderRadius: "10px",
                          padding: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        {/* Cabecera del contenedor unificado */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <ImageIcon size={16} color={colActiva.text} />
                            <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B" }}>
                              Galería de Fotos para "{varianteActual.var_nombre}"
                            </label>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: tieneFotosPropias ? colActiva.badge : "#F1F5F9",
                                color: tieneFotosPropias ? colActiva.text : "#64748B",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                border: `1px solid ${tieneFotosPropias ? colActiva.border : "#CBD5E1"}`,
                              }}
                            >
                              {tieneFotosPropias
                                ? `${fotosVariante.length} ${fotosVariante.length === 1 ? "foto añadida" : "fotos añadidas"}`
                                : "⚪ Heredando del Master"}
                            </span>
                          </div>

                          {/* Acciones principales */}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                            {tieneFotosPropias && (
                              <button
                                type="button"
                                onClick={() => {
                                  const det = {
                                    ...(varianteActual.var_detalle_variante || {}),
                                    portada_url: null,
                                    galeria_urls: [],
                                  };
                                  actualizarVarianteActual("var_detalle_variante", det);
                                }}
                                style={{
                                  background: "#FFFFFF",
                                  color: "#64748B",
                                  border: "1px solid #CBD5E1",
                                  borderRadius: "6px",
                                  padding: "5px 10px",
                                  fontSize: "0.72rem",
                                  fontWeight: 600,
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                }}
                                title="Eliminar fotos exclusivas y volver a heredar la imagen del producto principal"
                              >
                                ⚪ Usar Foto del Master
                              </button>
                            )}

                            <label
                              style={{
                                background: "#FFFFFF",
                                color: "#0284C7",
                                border: "1px solid #BAE6FD",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: subiendoGaleriaVariante ? "wait" : "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
                              }}
                              title="Subir una o varias fotos desde tu PC para este tamaño"
                            >
                              {subiendoGaleriaVariante ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                <Upload size={13} />
                              )}
                              <span>{subiendoGaleriaVariante ? "Subiendo..." : "📁 Subir PC"}</span>
                              <input
                                type="file"
                                accept="image/*"
                                multiple
                                disabled={subiendoGaleriaVariante}
                                onChange={handleSubirArchivosGaleriaVariante}
                                style={{ display: "none" }}
                              />
                            </label>

                            <button
                              type="button"
                              onClick={() => {
                                setContextoGaleria("variante_galeria");
                                setModalGaleriaAbierto(true);
                              }}
                              style={{
                                background: "#0284C7",
                                color: "#FFFFFF",
                                border: "none",
                                borderRadius: "6px",
                                padding: "5px 12px",
                                fontSize: "0.74rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "5px",
                                boxShadow: "0 1px 2px rgba(2, 132, 199, 0.2)",
                              }}
                              title="Abrir galería de medios para seleccionar o subir fotos para este tamaño"
                            >
                              <ImageIcon size={13} />
                              <span>+ Seleccionar de Galería</span>
                            </button>
                          </div>
                        </div>

                        {/* Contenido: Si no tiene fotos propias -> estado heredado */}
                        {!tieneFotosPropias ? (
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              background: "#FFFFFF",
                              border: "1px dashed #CBD5E1",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              gap: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {imagenUrl ? (
                                <div style={{ width: "42px", height: "42px", borderRadius: "6px", overflow: "hidden", background: "#0F172A", flexShrink: 0, border: "1px solid #E2E8F0" }}>
                                  <img
                                    src={imagenUrl}
                                    alt="Master Heredada"
                                    onError={(e) => {
                                      (e.target as HTMLImageElement).src = obtenerImagenFallbackNegocio(producto?.pro_negocio);
                                    }}
                                    style={{ width: "100%", height: "100%", objectFit: "cover" }}
                                  />
                                </div>
                              ) : (
                                <div style={{ width: "42px", height: "42px", borderRadius: "6px", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                                  <ImageIcon size={18} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: "0.76rem", color: "#1E293B", fontWeight: 700 }}>
                                  ⚪ <strong>Foto Heredada del Master</strong>
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
                                  Este tamaño muestra la imagen de portada global en la vitrina. Agrega 1 o más fotos exclusivas para personalizarlo (la foto #1 será la portada).
                                </div>
                              </div>
                            </div>

                            <button
                              type="button"
                              onClick={() => {
                                const det = {
                                  ...(varianteActual.var_detalle_variante || {}),
                                  portada_url: imagenUrl || "https://",
                                  galeria_urls: imagenUrl ? [imagenUrl] : [],
                                };
                                actualizarVarianteActual("var_detalle_variante", det);
                              }}
                              style={{
                                background: colActiva.badge,
                                color: colActiva.text,
                                border: `1px solid ${colActiva.border}`,
                                padding: "6px 12px",
                                borderRadius: "6px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                              }}
                            >
                              + Personalizar Fotos Propias
                            </button>
                          </div>
                        ) : (
                          <div>
                            <p style={{ fontSize: "0.7rem", color: "#64748B", margin: "0 0 6px 0" }}>
                              Ingresa varias URLs (una por línea) o selecciónalas desde la Galería. La foto marcada como <strong>★ Portada</strong> (#1) es la que se mostrará en la vitrina y tarjeta del producto.
                            </p>

                            <textarea
                              rows={2}
                              placeholder={"https://...foto1.jpg\nhttps://...foto2.jpg"}
                              value={fotosVariante.join("\n")}
                              onChange={(e) => {
                                const urls = e.target.value
                                  .split("\n")
                                  .map((u) => u.trim())
                                  .filter((u) => u.length > 0);
                                const portOk = urls.includes(fotoPortada || "");
                                const det = {
                                  ...(varianteActual.var_detalle_variante || {}),
                                  galeria_urls: urls,
                                  portada_url: portOk ? fotoPortada : (urls[0] || null),
                                };
                                actualizarVarianteActual("var_detalle_variante", det);
                              }}
                              style={{
                                width: "100%",
                                padding: "6px 10px",
                                borderRadius: "6px",
                                border: "1px solid #CBD5E1",
                                fontSize: "0.75rem",
                                boxSizing: "border-box",
                                background: "#FFFFFF",
                                fontFamily: "monospace",
                              }}
                            />

                            {/* Miniaturas de Fotos de la Galería de la Variante */}
                            <div
                              style={{
                                marginTop: "8px",
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))",
                                gap: "8px",
                              }}
                            >
                              {fotosVariante.map((gUrl: string, idx: number) => {
                                const esPortada = fotoPortada === gUrl;
                                return (
                                  <div
                                    key={`${gUrl}-${idx}`}
                                    style={{
                                      position: "relative",
                                      borderRadius: "6px",
                                      overflow: "hidden",
                                      border: esPortada ? "2.5px solid #10B981" : "1px solid #E2E8F0",
                                      background: "#0F172A",
                                      aspectRatio: "1 / 1",
                                      display: "flex",
                                      flexDirection: "column",
                                      justifyContent: "space-between",
                                      boxShadow: esPortada ? "0 0 0 2px rgba(16, 185, 129, 0.25)" : "none",
                                    }}
                                  >
                                    <img
                                      src={gUrl}
                                      alt={`Foto ${idx + 1}`}
                                      style={{
                                        position: "absolute",
                                        top: 0,
                                        left: 0,
                                        width: "100%",
                                        height: "100%",
                                        objectFit: "cover",
                                      }}
                                    />
                                    <div
                                      style={{
                                        position: "relative",
                                        zIndex: 2,
                                        display: "flex",
                                        justifyContent: "space-between",
                                        alignItems: "center",
                                        padding: "3px",
                                        background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                                      }}
                                    >
                                      <span
                                        style={{
                                          fontSize: "0.62rem",
                                          color: "#FFFFFF",
                                          fontWeight: 800,
                                          background: "rgba(0,0,0,0.5)",
                                          padding: "1px 4px",
                                          borderRadius: "3px",
                                        }}
                                      >
                                        #{idx + 1}
                                      </span>
                                      <button
                                        type="button"
                                        onClick={() => handleQuitarFotoGaleriaVariante(idx)}
                                        style={{
                                          background: "rgba(220, 38, 38, 0.85)",
                                          color: "#FFFFFF",
                                          border: "none",
                                          borderRadius: "50%",
                                          width: "18px",
                                          height: "18px",
                                          display: "flex",
                                          alignItems: "center",
                                          justifyContent: "center",
                                          cursor: "pointer",
                                          padding: 0,
                                        }}
                                        title="Quitar foto de la galería"
                                      >
                                        <X size={10} />
                                      </button>
                                    </div>

                                    <div
                                      style={{
                                        position: "relative",
                                        zIndex: 2,
                                        display: "flex",
                                        justifyContent: "center",
                                        padding: "3px",
                                        background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                                      }}
                                    >
                                      <button
                                        type="button"
                                        onClick={() => handleEstablecerPortadaDesdeGaleriaVariante(gUrl)}
                                        style={{
                                          background: esPortada ? "#10B981" : "rgba(255,255,255,0.9)",
                                          color: esPortada ? "#FFFFFF" : "#0F172A",
                                          border: "none",
                                          borderRadius: "3px",
                                          fontSize: "0.6rem",
                                          fontWeight: 800,
                                          padding: "2px 6px",
                                          cursor: "pointer",
                                          whiteSpace: "nowrap",
                                        }}
                                        title={esPortada ? "Esta es la foto de portada actual" : "Hacer que esta foto sea la portada de este tamaño (mover a #1)"}
                                      >
                                        {esPortada ? "★ Portada" : "Hacer Portada"}
                                      </button>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>

                            {/* Selector de encuadre específico para la foto de portada */}
                            {fotoPortada && (
                              <div style={{ marginTop: "10px" }}>
                                <SelectorEncuadreFoto
                                  imagenUrl={fotoPortada}
                                  posicion={varianteActual.var_detalle_variante?.foto_posicion || fotoPosicionMaster || "center center"}
                                  ajuste={varianteActual.var_detalle_variante?.foto_ajuste || fotoAjusteMaster || "cover"}
                                  zoom={Number(varianteActual.var_detalle_variante?.foto_zoom) || fotoZoomMaster || 100}
                                  onCambiarPosicion={(pos) => {
                                    const det = { ...(varianteActual.var_detalle_variante || {}), foto_posicion: pos };
                                    actualizarVarianteActual("var_detalle_variante", det);
                                  }}
                                  onCambiarAjuste={(aj) => {
                                    const det = { ...(varianteActual.var_detalle_variante || {}), foto_ajuste: aj };
                                    actualizarVarianteActual("var_detalle_variante", det);
                                  }}
                                  onCambiarZoom={(zm) => {
                                    const det = { ...(varianteActual.var_detalle_variante || {}), foto_zoom: zm };
                                    actualizarVarianteActual("var_detalle_variante", det);
                                  }}
                                  titulo={`Encuadre & Posición de la Portada ("${varianteActual.var_nombre}")`}
                                  colorTema={colActiva.border}
                                />

                                {Boolean(
                                  fotoPortada.includes("photos.app.goo.gl") ||
                                  fotoPortada.includes("photos.google.com")
                                ) && (
                                  <div style={{ marginTop: "6px", fontSize: "0.68rem", color: "#B45309", background: "#FEF3C7", padding: "6px 10px", borderRadius: "6px", border: "1px solid #FDE68A", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>⚠️ La portada actual es un enlace web de Google Fotos.</span>
                                    <button
                                      type="button"
                                      disabled={resolviendoVarianteImg}
                                      onClick={() => handleConvertirImagenVariante(fotoPortada)}
                                      style={{
                                        background: "#0284C7",
                                        color: "#FFFFFF",
                                        border: "none",
                                        padding: "3px 8px",
                                        borderRadius: "4px",
                                        fontSize: "0.68rem",
                                        fontWeight: 700,
                                        cursor: resolviendoVarianteImg ? "wait" : "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                    >
                                      {resolviendoVarianteImg ? <Loader2 size={11} className="animate-spin" /> : <Wand2 size={11} />}
                                      <span>Auto-Convertir</span>
                                    </button>
                                  </div>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* 2. CONFIGURACIÓN DE ÁLBUM DE MUESTRAS REALES PARA ESTE TAMAÑO (HERENCIA VS PROPIO) */}
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px solid #E2E8F0",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Camera size={15} color={colActiva.dot} />
                        <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#1E293B" }}>
                          Álbum de Muestras Reales para "{varianteActual.var_nombre}"
                        </label>
                      </div>

                      {/* Selector de Herencia vs Álbum Propio */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), album_url: null };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            border: !varianteActual.var_detalle_variante?.album_url ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                            background: !varianteActual.var_detalle_variante?.album_url ? "#0F172A" : "#FFFFFF",
                            color: !varianteActual.var_detalle_variante?.album_url ? "#FFFFFF" : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          ⚪ Usar Álbum del Master
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!varianteActual.var_detalle_variante?.album_url) {
                              const det = { ...(varianteActual.var_detalle_variante || {}), album_url: albumFotosUrl || "https://" };
                              actualizarVarianteActual("var_detalle_variante", det);
                            }
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            border: Boolean(varianteActual.var_detalle_variante?.album_url) ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                            background: Boolean(varianteActual.var_detalle_variante?.album_url) ? colActiva.bg : "#FFFFFF",
                            color: Boolean(varianteActual.var_detalle_variante?.album_url) ? colActiva.text : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          📸 Álbum Propio de este Tamaño
                        </button>
                      </div>
                    </div>

                    {varianteActual.var_detalle_variante?.album_url ? (
                      <div>
                        <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                          <input
                            type="url"
                            placeholder="https://photos.app.goo.gl/... o enlace de fotos de este tamaño ➔"
                            value={varianteActual.var_detalle_variante.album_url}
                            onChange={(e) => {
                              const det = { ...(varianteActual.var_detalle_variante || {}), album_url: e.target.value.trim() || null };
                              actualizarVarianteActual("var_detalle_variante", det);
                            }}
                            style={{
                              flex: 1,
                              padding: "7px 10px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              fontSize: "0.8rem",
                              boxSizing: "border-box",
                              background: "#FFFFFF",
                            }}
                          />
                          {varianteActual.var_detalle_variante.album_url && (
                            <a
                              href={varianteActual.var_detalle_variante.album_url}
                              target="_blank"
                              rel="noreferrer"
                              style={{
                                background: colActiva.badge,
                                color: colActiva.text,
                                border: `1px solid ${colActiva.border}`,
                                padding: "7px 10px",
                                borderRadius: "6px",
                                fontSize: "0.72rem",
                                fontWeight: 700,
                                textDecoration: "none",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                whiteSpace: "nowrap",
                              }}
                            >
                              <ExternalLink size={12} />
                              <span>Probar Link</span>
                            </a>
                          )}
                        </div>
                        <div style={{ marginTop: "4px", fontSize: "0.68rem", color: "#64748B" }}>
                          🟢 Este tamaño abrirá este álbum exclusivo cuando el cliente haga clic en "📸 Muestras Reales".
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#FFFFFF",
                          border: "1px dashed #CBD5E1",
                          borderRadius: "6px",
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#1E293B", fontWeight: 700 }}>
                            ⚪ Álbum Heredado del Master:
                          </span>
                          <span style={{ fontSize: "0.72rem", color: albumFotosUrl ? "#0284C7" : "#94A3B8", fontStyle: albumFotosUrl ? "normal" : "italic" }}>
                            {albumFotosUrl || "Sin álbum global configurado en el master"}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), album_url: albumFotosUrl || "https://" };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            background: colActiva.badge,
                            color: colActiva.text,
                            border: `1px solid ${colActiva.border}`,
                            padding: "4px 9px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                          }}
                        >
                          + Configurar Álbum Exclusivo
                        </button>
                      </div>
                    )}
                  </div>

                  {/* 3. SUB-SECCIÓN: PERSONALIZACIÓN & SOBRESCRITURA DE ESTA VARIANTE */}
                  <div
                    style={{
                      marginTop: "12px",
                      borderTop: `1.5px solid ${colActiva.border}44`,
                      paddingTop: "12px",
                      background: colActiva.bg,
                      borderRadius: "8px",
                      padding: "10px",
                      border: `1px solid ${colActiva.border}66`,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Sparkles size={14} color={colActiva.dot} />
                        <span style={{ fontSize: "0.75rem", fontWeight: 800, color: colActiva.text, textTransform: "uppercase" }}>
                          Tiempo de Entrega & Beneficios de este Tamaño
                        </span>
                      </div>
                      <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                        Si se deja vacío, hereda automáticamente los valores globales
                      </span>
                    </div>

                    {/* Tiempo de Entrega Específico de esta variante */}
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                          Tiempo de Entrega para este Tamaño:
                        </label>
                        <span style={{ fontSize: "0.68rem", color: varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.text : "#64748B", fontWeight: 700 }}>
                          {varianteActual.var_detalle_variante?.tiempo_entrega ? "🟢 Tiempo Específico Activo" : `⚪ Hereda Global (${tiempoEntrega})`}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "4px", flexWrap: "wrap", marginBottom: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), tiempo_entrega: null };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            padding: "3px 7px",
                            borderRadius: "5px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            border: !varianteActual.var_detalle_variante?.tiempo_entrega ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                            background: !varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.badge : "#FFFFFF",
                            color: !varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.text : "#475569",
                            cursor: "pointer",
                          }}
                        >
                          Heredar Global
                        </button>
                        {presetsEntrega.map((pr) => {
                          const sel = varianteActual.var_detalle_variante?.tiempo_entrega === pr.val;
                          return (
                            <button
                              key={pr.val}
                              type="button"
                              onClick={() => {
                                const det = { ...(varianteActual.var_detalle_variante || {}), tiempo_entrega: pr.val };
                                actualizarVarianteActual("var_detalle_variante", det);
                              }}
                              style={{
                                padding: "3px 7px",
                                borderRadius: "5px",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                border: sel ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                                background: sel ? colActiva.badge : "#FFFFFF",
                                color: sel ? colActiva.text : "#475569",
                                cursor: "pointer",
                              }}
                            >
                              {pr.label}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Beneficios / ¿Qué incluye? con Selector de Modo (Heredar / Anexar / Reemplazar) */}
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                          Beneficios & Contenido de este Tamaño:
                        </label>
                        <div style={{ display: "flex", gap: "4px" }}>
                          {(["heredar", "anexar", "reemplazar"] as const).map((modo) => {
                            const actualModo = varianteActual.var_detalle_variante?.beneficios_modo || "heredar";
                            const activo = actualModo === modo;
                            return (
                              <button
                                key={modo}
                                type="button"
                                onClick={() => {
                                  const det = { ...(varianteActual.var_detalle_variante || {}), beneficios_modo: modo };
                                  actualizarVarianteActual("var_detalle_variante", det);
                                }}
                                style={{
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontSize: "0.65rem",
                                  fontWeight: 700,
                                  textTransform: "capitalize",
                                  border: activo ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                                  background: activo ? colActiva.badge : "#FFFFFF",
                                  color: activo ? colActiva.text : "#475569",
                                  cursor: "pointer",
                                }}
                              >
                                {modo === "heredar" ? "Heredar" : modo === "anexar" ? "Anexar Extras" : "Reemplazar"}
                              </button>
                            );
                          })}
                        </div>
                      </div>

                      {(!varianteActual.var_detalle_variante?.beneficios_modo || varianteActual.var_detalle_variante?.beneficios_modo === "heredar") ? (
                        <div style={{ fontSize: "0.7rem", color: "#64748B", background: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", border: "1px solid #E2E8F0" }}>
                          <em>Hereda los beneficios generales definidos en el producto master.</em>
                        </div>
                      ) : (
                        <div>
                          <textarea
                            rows={2}
                            placeholder={
                              varianteActual.var_detalle_variante?.beneficios_modo === "anexar"
                                ? "Escribe los extras exclusivos de este tamaño (ej. + Corona dorada de reina\n+ Mariposas 3D translúcidas)"
                                : "Escribe la lista completa de beneficios que sustituye a la global..."
                            }
                            value={
                              Array.isArray(varianteActual.var_detalle_variante?.beneficios_custom)
                                ? varianteActual.var_detalle_variante.beneficios_custom.join("\n")
                                : (varianteActual.var_detalle_variante?.beneficios_custom || "")
                            }
                            onChange={(e) => {
                              const lineas = e.target.value.split("\n").filter((l) => l.trim().length > 0);
                              const det = { ...(varianteActual.var_detalle_variante || {}), beneficios_custom: lineas };
                              actualizarVarianteActual("var_detalle_variante", det);
                            }}
                            style={{
                              width: "100%",
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              fontSize: "0.75rem",
                              boxSizing: "border-box",
                              background: "#FFFFFF",
                            }}
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  {/* 4. Usos y Ocasiones Recomendadas por Variante (IA & Filtros) */}
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1.5px solid #E2E8F0",
                      borderRadius: "10px",
                      padding: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Target size={15} color="#0284C7" />
                        <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "#1E293B" }}>
                          {esFloristeria
                            ? `Usos y Ocasiones para "${varianteActual.var_nombre}" (IA & Filtros)`
                            : `Usos y Casos de Aplicación para "${varianteActual.var_nombre}"`}
                        </label>
                      </div>

                      {/* Selector Modo: Heredar vs Personalizar */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), usos_modo: "heredar" };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            border:
                              (varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar"
                                ? "1.5px solid #0F172A"
                                : "1px solid #CBD5E1",
                            background:
                              (varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar"
                                ? "#0F172A"
                                : "#FFFFFF",
                            color:
                              (varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar"
                                ? "#FFFFFF"
                                : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          Heredar Master ({usosSeleccionados.length})
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            const actuales =
                              Array.isArray(varianteActual.var_detalle_variante?.usos) &&
                              varianteActual.var_detalle_variante.usos.length > 0
                                ? varianteActual.var_detalle_variante.usos
                                : [...usosSeleccionados];
                            const det = {
                              ...(varianteActual.var_detalle_variante || {}),
                              usos_modo: "personalizado",
                              usos: actuales,
                            };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "5px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            border:
                              varianteActual.var_detalle_variante?.usos_modo === "personalizado"
                                ? `1.5px solid ${colActiva.border}`
                                : "1px solid #CBD5E1",
                            background:
                              varianteActual.var_detalle_variante?.usos_modo === "personalizado"
                                ? colActiva.bg
                                : "#FFFFFF",
                            color:
                              varianteActual.var_detalle_variante?.usos_modo === "personalizado"
                                ? colActiva.text
                                : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          Usos Propios ({(varianteActual.var_detalle_variante?.usos || []).length})
                        </button>
                      </div>
                    </div>

                    {(varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar" ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          background: "#FFFFFF",
                          border: "1px dashed #CBD5E1",
                          borderRadius: "6px",
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.72rem", color: "#64748B" }}>
                            ⚪ Hereda las {usosSeleccionados.length} ocasiones configuradas en el Master:
                          </span>
                          {usosSeleccionados.length === 0 ? (
                            <span style={{ fontSize: "0.72rem", color: "#94A3B8", fontStyle: "italic" }}>
                              (Sin usos en el Master)
                            </span>
                          ) : (
                            usosSeleccionados.slice(0, 4).map((u) => {
                              const matchPreset = presetsUsosActivos.find((p) => p.clave === u);
                              return (
                                <span
                                  key={u}
                                  style={{
                                    fontSize: "0.68rem",
                                    background: "#F1F5F9",
                                    color: "#334155",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    fontWeight: 600,
                                  }}
                                >
                                  {matchPreset ? matchPreset.label : u.replace(/_/g, " ")}
                                </span>
                              );
                            })
                          )}
                          {usosSeleccionados.length > 4 && (
                            <span style={{ fontSize: "0.68rem", color: "#64748B", fontWeight: 700 }}>
                              +{usosSeleccionados.length - 4} más
                            </span>
                          )}
                        </div>

                        <button
                          type="button"
                          onClick={() => {
                            const actuales =
                              Array.isArray(varianteActual.var_detalle_variante?.usos) &&
                              varianteActual.var_detalle_variante.usos.length > 0
                                ? varianteActual.var_detalle_variante.usos
                                : [...usosSeleccionados];
                            const det = {
                              ...(varianteActual.var_detalle_variante || {}),
                              usos_modo: "personalizado",
                              usos: actuales,
                            };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            background: colActiva.badge,
                            color: colActiva.text,
                            border: `1px solid ${colActiva.border}`,
                            padding: "4px 8px",
                            borderRadius: "4px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            whiteSpace: "nowrap",
                            flexShrink: 0,
                          }}
                        >
                          + Personalizar Usos
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ fontSize: "0.7rem", color: "#64748B", margin: "0 0 8px 0" }}>
                          Configura para qué ocasiones la IA (ARIA) y los filtros recomendarán específicamente este tamaño:
                        </p>

                        {/* Grid Unificado de Usos para la Variante (Presets + Personalizados) */}
                        {(() => {
                          const usosVar = Array.isArray(varianteActual.var_detalle_variante?.usos)
                            ? varianteActual.var_detalle_variante.usos
                            : [];
                          const todosUsosVariante = todosUsosDisponibles;

                          return (
                            <div
                              style={{
                                display: "grid",
                                gridTemplateColumns: "repeat(auto-fill, minmax(150px, 1fr))",
                                gap: "5px",
                                marginBottom: "8px",
                              }}
                            >
                              {todosUsosVariante.map((u) => {
                                const activo = usosVar.includes(u.clave);
                                const estaVerificando = verificandoUsoClave === u.clave;

                                return (
                                  <button
                                    key={u.clave}
                                    type="button"
                                    onClick={() => toggleUsoVariante(u.clave)}
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "space-between",
                                      padding: "5px 8px",
                                      borderRadius: "6px",
                                      fontSize: "0.72rem",
                                      fontWeight: activo ? 700 : 500,
                                      border: activo ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                                      background: activo ? colActiva.bg : "#FFFFFF",
                                      color: activo ? colActiva.text : "#475569",
                                      cursor: "pointer",
                                      textAlign: "left",
                                      transition: "all 0.15s ease",
                                      gap: "4px",
                                      opacity: estaVerificando ? 0.6 : 1,
                                    }}
                                  >
                                    <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", flex: 1 }}>
                                      {u.label}
                                    </span>
                                    <div style={{ display: "flex", alignItems: "center", gap: "4px", flexShrink: 0 }}>
                                      <span
                                        role="button"
                                        tabIndex={0}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleSolicitarEliminarUso(u.clave, u.label);
                                        }}
                                        onKeyDown={(e) => {
                                          if (e.key === "Enter" || e.key === " ") {
                                            e.stopPropagation();
                                            handleSolicitarEliminarUso(u.clave, u.label);
                                          }
                                        }}
                                        title="Eliminar este uso del catálogo (validación estricta)"
                                        style={{
                                          color: "#94A3B8",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          padding: "1px",
                                          borderRadius: "3px",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#EF4444")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "#94A3B8")}
                                      >
                                        {estaVerificando ? (
                                          <Loader2 size={11} className="animate-spin" />
                                        ) : (
                                          <X size={11} />
                                        )}
                                      </span>
                                      <span
                                        style={{
                                          width: "7px",
                                          height: "7px",
                                          borderRadius: "50%",
                                          background: activo ? colActiva.text : "#CBD5E1",
                                          flexShrink: 0,
                                        }}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                            </div>
                          );
                        })()}

                        {/* Input para agregar uso personalizado a la variante */}
                        <div style={{ display: "flex", gap: "6px" }}>
                          <input
                            type="text"
                            placeholder="Escribir otro uso personalizado para este tamaño..."
                            value={nuevoUsoVarianteTexto}
                            onChange={(e) => setNuevoUsoVarianteTexto(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                handleAgregarUsoPersonalizadoVariante();
                              }
                            }}
                            style={{
                              flex: 1,
                              padding: "6px 10px",
                              borderRadius: "6px",
                              border: "1px solid #CBD5E1",
                              fontSize: "0.74rem",
                              background: "#FFFFFF",
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAgregarUsoPersonalizadoVariante}
                            style={{
                              background: "#0F172A",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "6px 12px",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            + Agregar Uso
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Botones de Acción */}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              paddingTop: "14px",
              borderTop: "1px solid #E2E8F0",
              marginTop: "8px",
            }}
          >
            {esModoMaster ? (
              <button
                type="button"
                onClick={handleEliminar}
                disabled={eliminando}
                title={
                  confirmarEliminar
                    ? "Eliminar permanentemente este producto y todas sus variantes de la base de datos"
                    : "Eliminar producto master del catálogo"
                }
                style={{
                  background: confirmarEliminar ? "#DC2626" : "transparent",
                  color: confirmarEliminar ? "#FFFFFF" : "#EF4444",
                  border: confirmarEliminar ? "none" : "1.5px solid #EF4444",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  transition: "all 0.15s ease",
                }}
              >
                <Trash2 size={14} />
                <span>
                  {confirmarEliminar
                    ? "⚠️ ¿Confirmar Eliminación Definitiva?"
                    : esFloristeria
                    ? "Eliminar Arreglo Completo"
                    : "Eliminar Producto"}
                </span>
              </button>
            ) : (
              <button
                type="button"
                onClick={handleEliminarVarianteClick}
                disabled={variantesLocales.length <= 1 || eliminandoVariante}
                title={
                  variantesLocales.length <= 1
                    ? (esFloristeria ? "Debe existir al menos un tamaño en el producto" : "Debe existir al menos una variante en el producto")
                    : (confirmarEliminarVariante ? "Confirmar eliminación definitiva de este tamaño" : "Quitar este tamaño / variante")
                }
                style={{
                  background: confirmarEliminarVariante ? "#DC2626" : "transparent",
                  color: variantesLocales.length <= 1 ? "#94A3B8" : confirmarEliminarVariante ? "#FFFFFF" : "#EF4444",
                  border: variantesLocales.length <= 1 ? "1px solid #E2E8F0" : confirmarEliminarVariante ? "none" : "1.5px solid #FCA5A5",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: (variantesLocales.length <= 1 || eliminandoVariante) ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  opacity: (variantesLocales.length <= 1 || eliminandoVariante) ? 0.6 : 1,
                  transition: "all 0.15s ease",
                }}
              >
                <Trash2 size={14} />
                <span>
                  {eliminandoVariante
                    ? "Eliminando..."
                    : confirmarEliminarVariante
                    ? `⚠️ ¿Confirmar Eliminar "${varianteActual?.var_nombre}"?`
                    : "Eliminar esta Variante"}
                </span>
              </button>
            )}

            <div style={{ display: "flex", gap: "8px" }}>
              <button
                type="button"
                onClick={onCerrar}
                style={{
                  background: "#F1F5F9",
                  color: "#475569",
                  border: "none",
                  padding: "9px 16px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="submit"
                disabled={guardando}
                style={{
                  background: esFloristeria ? "#E11D48" : "#0284C7",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "9px 20px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  boxShadow: "0 2px 4px rgba(0,0,0,0.1)",
                }}
              >
                <CheckCircle2 size={16} />
                <span>{guardando ? "Guardando..." : "Actualizar Catálogo"}</span>
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* Modal para Crear y Administrar / Eliminar Categorías */}
      <ModalCrearCategoria
        abierto={modalCatAbierto}
        tabInicial={catModalTab}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLocales((prev) => [...prev, nueva]);
          setCategoriaId(nueva.ctg_id);
          if (onCategoriaCreada) {
            onCategoriaCreada(nueva);
          }
        }}
        onCategoriaEliminada={(catIdEliminada) => {
          setCategoriasLocales((prev) => {
            const rest = prev.filter((c) => c.ctg_id !== catIdEliminada && c.ctg_slug !== catIdEliminada);
            if (categoriaId === catIdEliminada && rest[0]) {
              setCategoriaId(rest[0].ctg_id);
            }
            return rest;
          });
          if (onCategoriaEliminada) {
            onCategoriaEliminada(catIdEliminada);
          }
        }}
        negocio={negocio}
      />

      {/* Modal Galería y Biblioteca Multimedia por Negocio */}
      <ModalGaleriaMedios
        abierto={modalGaleriaAbierto}
        onCerrar={() => setModalGaleriaAbierto(false)}
        negocio={negocio}
        onSeleccionarImagen={(url) => handleSeleccionarDesdeGaleria(url)}
        onSeleccionarMultiples={(urls) => handleSeleccionarMultiplesDesdeGaleria(urls)}
        modoSeleccion={contextoGaleria === "galeria" || contextoGaleria === "variante_galeria" || contextoGaleria === "variante" ? "multiple" : "simple"}
        titulo={`Biblioteca de Medios (${negocio.toUpperCase()})`}
      />

      {/* Modales de Validación y Confirmación de Eliminación de Usos */}
      <ModalBloqueoUso
        abierto={Boolean(modalBloqueoUso)}
        usoLabel={modalBloqueoUso?.label || ""}
        productos={modalBloqueoUso?.productos || []}
        onCerrar={() => setModalBloqueoUso(null)}
      />

      <ModalConfirmarEliminarUso
        abierto={Boolean(modalConfirmarEliminarUso)}
        usoLabel={modalConfirmarEliminarUso?.label || ""}
        negocio={negocio}
        onCancelar={() => setModalConfirmarEliminarUso(null)}
        onConfirmar={() => {
          if (modalConfirmarEliminarUso) {
            ejecutarEliminacionUso(
              modalConfirmarEliminarUso.clave,
              modalConfirmarEliminarUso.label
            );
          }
        }}
      />
    </div>
  );
}
