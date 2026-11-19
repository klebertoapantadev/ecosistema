"use client";
import { SelectConBuscador } from "@eco/datagrid";

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
import { obtenerConfiguracionLogisticaAction } from "../acciones-logistica";
import {
  crearConfiguracionLogisticaPorDefecto,
  type ConfiguracionLogisticaNegocio,
} from "../logistica";
import {
  obtenerPresetsPorNegocio,
  obtenerUsosEliminadosStorage,
  guardarUsosEliminadosStorage,
  obtenerUsosPersonalizadosStorage,
  guardarUsosPersonalizadosStorage,
  verificarUsoEnProductosLocales,
} from "../utils/usosCatalogo";
import { ModalBloqueoUso, ModalConfirmarEliminarUso } from "./ModalesValidacionUso";
import {
  EditorEscalasVolumenVariante,
  EditorSetComboConfigurable,
} from "./EditorComboYVolumen";
import {
  normalizarComponentesCombo,
  normalizarEscalasVolumen,
  type ComponenteComboConfig,
} from "../utils/combosVolumen";
import { obtenerTiposOfertaConUsoAction } from "../acciones-tipos-oferta";
import {
  esCodigoOfertaRenta,
  guardarTiposOfertaCacheLocal,
  leerTiposOfertaCacheLocal,
  leerTiposOfertaEliminadosLocal,
  normalizarConfiguracionRenta,
  obtenerEtiquetaCortaTipoOferta,
  obtenerTiposOfertaPorDefecto,
  type ConfiguracionRentaProducto,
  type TipoOfertaComercial,
} from "../utils/tiposOferta";
import {
  ModalGestionTiposOferta,
  PanelCondicionesRentaProducto,
} from "./ModalGestionTiposOferta";
import {
  BarraPasosWizardProducto,
  PASOS_WIZARD_PRODUCTO,
  type PasoWizardProducto,
} from "./BarraPasosWizardProducto";


export const COLOR_PRODUCTO_MASTER = {
  nombre: "Master Slate / Sky",
  bg: "#1F1C19",
  border: "#38BDF8",
  text: "#38BDF8",
  badge: "rgba(56, 189, 248, 0.2)",
  dot: "#38BDF8",
};

export const PALETA_COLORES_VARIANTES = [
  { nombre: "Verde Esmeralda", bg: "#F2F6F3", border: "#2F4737", text: "#2B4A36", badge: "#EAF1EC", dot: "#2F4737" },
  { nombre: "Ámbar Cálido", bg: "#FAF6EE", border: "#8F6A2E", text: "#745622", badge: "#FAF6EE", dot: "#8F6A2E" },
  { nombre: "Púrpura Imperial", bg: "#F4F2EE", border: "#4A453F", text: "#3A3530", badge: "#EDE9FE", dot: "#4A453F" },
  { nombre: "Rosa Coral", bg: "#FAF2F2", border: "#8A2E2E", text: "#8A2E2E", badge: "#F5E9E9", dot: "#8A2E2E" },
  { nombre: "Azul Cielo", bg: "#F4F2EE", border: "#4A453F", text: "#3A3530", badge: "#EFECE6", dot: "#4A453F" },
  { nombre: "Índigo Profundo", bg: "#F4F2EE", border: "#4A453F", text: "#3A3530", badge: "#EFECE6", dot: "#4A453F" },
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
  colorTema = "#221E1B",
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
        background: "#F8F7F4",
        border: "1.5px dashed #D5CFC4",
        borderRadius: "10px",
        padding: "12px",
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
          <Sparkles size={14} color={colorTema} />
          <span style={{ fontSize: "0.74rem", fontWeight: 800, color: "#221E1B" }}>
            {titulo}
          </span>
        </div>
        <span style={{ fontSize: "0.68rem", color: "#847D74", fontWeight: 600 }}>
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
            background: "#1F1C19",
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
            <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
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
                      border: activo ? `1.5px solid ${colorTema}` : "1px solid #D5CFC4",
                      background: activo ? "#FFFFFF" : "#F4F2EE",
                      color: activo ? colorTema : "#57524C",
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
              <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
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
                    border: ajuste === "cover" ? `1.5px solid ${colorTema}` : "1px solid #D5CFC4",
                    background: ajuste === "cover" ? "#FFFFFF" : "#F4F2EE",
                    color: ajuste === "cover" ? colorTema : "#57524C",
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
                    border: ajuste === "contain" ? `1.5px solid ${colorTema}` : "1px solid #D5CFC4",
                    background: ajuste === "contain" ? "#FFFFFF" : "#F4F2EE",
                    color: ajuste === "contain" ? colorTema : "#57524C",
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
                <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
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
                        border: zoom === z ? `1.5px solid ${colorTema}` : "1px solid #D5CFC4",
                        background: zoom === z ? "#FFFFFF" : "#F4F2EE",
                        color: zoom === z ? colorTema : "#57524C",
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
  const [tipo, setTipo] = useState<string>("FISICO");
  const [tiposOfertaLocales, setTiposOfertaLocales] = useState<TipoOfertaComercial[]>(() =>
    obtenerTiposOfertaPorDefecto(negocio)
  );
  const [modalTiposOfertaAbierto, setModalTiposOfertaAbierto] = useState(false);
  const [tiposOfertaTab, setTiposOfertaTab] = useState<"crear" | "gestionar">("crear");
  const [rentaConfig, setRentaConfig] = useState<ConfiguracionRentaProducto>(() =>
    normalizarConfiguracionRenta()
  );

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    const cache = leerTiposOfertaCacheLocal(negocio);
    if (cache.length > 0) {
      setTiposOfertaLocales(cache);
    }
    obtenerTiposOfertaConUsoAction(negocio)
      .then((remotos) => {
        if (!vivo || !Array.isArray(remotos) || remotos.length === 0) return;
        const elim = new Set(leerTiposOfertaEliminadosLocal(negocio));
        const filtrados = remotos.filter((t) => !elim.has(t.tof_codigo.toUpperCase()));
        const finalLista = filtrados.length > 0 ? filtrados : remotos;
        setTiposOfertaLocales(finalLista);
        guardarTiposOfertaCacheLocal(negocio, finalLista);
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [abierto, negocio]);

  const esOfertaRentaActiva = useMemo(
    () => esCodigoOfertaRenta(tipo, undefined, tiposOfertaLocales),
    [tipo, tiposOfertaLocales]
  );

  const opcionesTiposOferta = useMemo(() => {
    const existeActual = tiposOfertaLocales.some(
      (t) => t.tof_codigo.toUpperCase() === String(tipo || "").toUpperCase()
    );
    if (existeActual || !tipo) return tiposOfertaLocales;
    return [
      ...tiposOfertaLocales,
      {
        tof_id: `actual-${tipo}`,
        tof_negocio: negocio,
        tof_codigo: tipo,
        tof_nombre: tipo,
        tof_orden: 99,
        tof_activo: true,
      },
    ];
  }, [tiposOfertaLocales, tipo, negocio]);
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
      if (!imagenUrl.trim()) {
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
      } else {
        setGaleriaTexto((prev) => {
          const lineasExistentes = prev
            .split("\n")
            .map((l) => l.trim())
            .filter((l) => l.length > 0);
          const combinadas = Array.from(new Set([...lineasExistentes, ...urls]));
          return combinadas.join("\n");
        });
      }
      setExitoAutoConvertir(`¡${urls.length} imagen(es) seleccionada(s) desde la galería!`);
    }
  };

  // Configuración Impositiva Global & Logística (Transporte / Delivery)
  const [tarifaIvaMaster, setTarifaIvaMaster] = useState<number>(esFloristeria ? 0 : 15);
  const [autoAplicarIvaVariantes, setAutoAplicarIvaVariantes] = useState<boolean>(true);
  const [mensajeFeedbackIva, setMensajeFeedbackIva] = useState<string | null>(null);
  const [configLogisticaNegocio, setConfigLogisticaNegocio] =
    useState<ConfiguracionLogisticaNegocio>(() => crearConfiguracionLogisticaPorDefecto(negocio));
  const [deliveryIncluido, setDeliveryIncluido] = useState<boolean>(true);
  const [modalidadTransporte, setModalidadTransporte] = useState<string>("INCLUIDO_GRATIS");
  const [etiquetaTransporte, setEtiquetaTransporte] = useState<string>("🌸 Envío Gratis en Centro-Norte de Quito");
  const [coberturaTransporte, setCoberturaTransporte] = useState<string>("Centro-Norte de Quito");
  const [recargoTransporteUsd, setRecargoTransporteUsd] = useState<number>(0);
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<CanalVisibilidad[]>([...CANALES_POR_DEFECTO]);

  useEffect(() => {
    if (!abierto) return;
    let vivo = true;
    obtenerConfiguracionLogisticaAction(negocio)
      .then((cfg) => {
        if (!vivo || !cfg) return;
        setConfigLogisticaNegocio(cfg);
        setCoberturaTransporte((actual) =>
          !actual || actual === "Quito Urbano y Valles" ? cfg.zonaGratisNombre : actual
        );
      })
      .catch(() => {});
    return () => {
      vivo = false;
    };
  }, [abierto, negocio]);

  // Editor Multivariante (Tamaños / Modalidades) y Sets/Combos Configurables
  const [modoEdicion, setModoEdicion] = useState<"master" | "variante">("master");
  const [variantesLocales, setVariantesLocales] = useState<VarianteCatalogo[]>([]);
  const [varianteActivaIndex, setVarianteActivaIndex] = useState<number>(0);
  const [esCombo, setEsCombo] = useState<boolean>(false);
  const [comboComponentes, setComboComponentes] = useState<ComponenteComboConfig[]>([]);

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

  // Galería de fotos unificada para la ficha master / producto simple (Hook de nivel superior)
  const fotosMaster = useMemo(() => {
    const list: string[] = [];
    if (imagenUrl && imagenUrl.trim()) {
      list.push(imagenUrl.trim());
    }
    if (galeriaTexto && galeriaTexto.trim()) {
      galeriaTexto.split("\n").forEach((u) => {
        const trimmed = u.trim();
        if (trimmed && !list.includes(trimmed)) {
          list.push(trimmed);
        }
      });
    }
    return list;
  }, [imagenUrl, galeriaTexto]);

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


  // Propagación de IVA Master a las variantes (respeta overrides explícitos salvo que se fuerce a todas)
  const aplicarIvaMasterATodos = (nuevaTarifa: number, forzarTodas = false) => {
    setTarifaIvaMaster(nuevaTarifa);
    setVariantesLocales((prev) =>
      prev.map((v) => {
        if (!forzarTodas && v.var_detalle_variante?.iva_personalizado === true) {
          return v;
        }
        const base = v.var_precio || 0;
        const montoIva = Number(((base * nuevaTarifa) / 100).toFixed(2));
        return {
          ...v,
          var_tarifa_iva_porcentaje: nuevaTarifa,
          var_codigo_impuesto_sri: nuevaTarifa > 0 ? "IVA_15" : "IVA_0",
          var_detalle_variante: {
            ...(v.var_detalle_variante || {}),
            iva_personalizado: false,
          },
          monto_iva: montoIva,
          precio_total: Number((base + montoIva).toFixed(2)),
        };
      })
    );
    setMensajeFeedbackIva(
      forzarTodas
        ? `✓ Tarifa IVA ${nuevaTarifa}% aplicada a todas las variantes (${variantesLocales.length})`
        : `✓ Tarifa IVA ${nuevaTarifa}% sincronizada con las variantes heredadas`
    );
    setTimeout(() => {
      setMensajeFeedbackIva(null);
    }, 3500);
  };

  const [pasoMaster, setPasoMaster] = useState<PasoWizardProducto>("identidad_precio");
  const [verTodoMaster, setVerTodoMaster] = useState<boolean>(false);

  useEffect(() => {
    if (producto) {
      setPasoMaster("identidad_precio");
      setNombre(producto.pro_nombre || "");
      setDescripcion(producto.pro_descripcion || "");
      setCategoriaId(producto.pro_categoria_principal_id || categorias[0]?.ctg_id || "");
      setTipo(producto.pro_tipo || (esFloristeria ? "FISICO" : "SERVICIO"));
      setDestacado(Boolean(producto.pro_destacado));
      setIcono(producto.pro_detalle_producto?.icono || (esFloristeria ? "Sparkles" : "Scale"));
      setModalidadPago(producto.pro_detalle_producto?.modalidad_pago || "Botón Payphone / Tarjeta / Saldo");

      const det = producto.pro_detalle_producto || {};
      setRentaConfig(normalizarConfiguracionRenta(det.renta_config));
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
      setEsCombo(Boolean(det.es_combo));
      setComboComponentes(normalizarComponentesCombo(det.combo_componentes));

      // Canales de visibilidad
      if (producto.canales_visibilidad && Array.isArray(producto.canales_visibilidad)) {
        setCanalesSeleccionados(producto.canales_visibilidad);
      } else if (det.canales_visibilidad && Array.isArray(det.canales_visibilidad)) {
        setCanalesSeleccionados(det.canales_visibilidad);
      } else {
        setCanalesSeleccionados([...CANALES_POR_DEFECTO]);
      }

      // IVA Master y Logística
      const tarifaMasterInicial =
        det.tarifa_iva_predeterminada !== undefined && det.tarifa_iva_predeterminada !== null
          ? Number(det.tarifa_iva_predeterminada)
          : esFloristeria
            ? 0
            : 15;
      setTarifaIvaMaster(tarifaMasterInicial);
      
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
      setRecargoTransporteUsd(
        Number.isFinite(Number(det.logistica?.recargo_transporte_usd))
          ? Math.max(0, Number(det.logistica.recargo_transporte_usd))
          : 0
      );
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
        setEtiquetaTransporte(
          rawEtiqueta && rawEtiqueta !== "🌸 Envío a Domicilio Incluido"
            ? rawEtiqueta
            : esFloristeria
            ? configLogisticaNegocio.etiquetaEnvioGratis || "🌸 Envío Gratis en Centro-Norte de Quito"
            : "🔧 Visita Técnica Incluida"
        );
        setCoberturaTransporte(
          rawCobertura && rawCobertura !== "Quito Urbano y Valles"
            ? rawCobertura
            : configLogisticaNegocio.zonaGratisNombre || "Centro-Norte de Quito"
        );
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
              var_codigo_impuesto_sri: tarifaMasterInicial > 0 ? "IVA_15" : "IVA_0",
              var_tarifa_iva_porcentaje: tarifaMasterInicial,
              var_tipo_oferta: "REGULAR",
              var_activo: true,
              var_detalle_variante: { orden: 1, iva_personalizado: false },
              monto_iva: Number(((20 * tarifaMasterInicial) / 100).toFixed(2)),
              precio_total: Number((20 + (20 * tarifaMasterInicial) / 100).toFixed(2)),
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

  const indicePasoMaster = PASOS_WIZARD_PRODUCTO.findIndex((p) => p.id === pasoMaster);
  const beneficiosLineasMaster = beneficiosTexto
    .split("\n")
    .map((b) => b.trim())
    .filter(Boolean);
  const fotosMasterCount = Array.from(
    new Set(
      [
        imagenUrl.trim(),
        ...galeriaTexto
          .split("\n")
          .map((g) => g.trim())
          .filter(Boolean),
      ].filter(Boolean)
    )
  ).length;
  const completadosMaster: Partial<Record<PasoWizardProducto, boolean>> = {
    identidad_precio:
      nombre.trim().length > 0 &&
      variantesLocales.length > 0 &&
      variantesLocales.every((v) => v.var_precio > 0),
    caracteristicas:
      descripcion.trim().length > 0 || beneficiosLineasMaster.length > 0,
    imagenes: fotosMasterCount > 0,
    logistica: true,
    canales_ia: canalesSeleccionados.length > 0,
  };

  const actualizarVariantePorIndex = (index: number, campo: keyof VarianteCatalogo, valor: any) => {
    setVariantesLocales((prev) => {
      const nuevas = [...prev];
      if (!nuevas[index]) return prev;
      const target = { ...nuevas[index] } as any;

      if (campo === "var_precio") {
        const base = typeof valor === "number" ? valor : parseFloat(valor) || 0;
        target.var_precio = base;
        const ivaPorc =
          target.var_tarifa_iva_porcentaje !== undefined && target.var_tarifa_iva_porcentaje !== null
            ? Number(target.var_tarifa_iva_porcentaje)
            : tarifaIvaMaster;
        target.monto_iva = Number(((base * ivaPorc) / 100).toFixed(2));
        target.precio_total = Number((base + target.monto_iva).toFixed(2));
      } else if (campo === "var_tarifa_iva_porcentaje") {
        const ivaPorc = Number(valor);
        target.var_tarifa_iva_porcentaje = ivaPorc;
        target.var_codigo_impuesto_sri = ivaPorc > 0 ? "IVA_15" : "IVA_0";
        target.var_detalle_variante = {
          ...(target.var_detalle_variante || {}),
          iva_personalizado: ivaPorc !== tarifaIvaMaster,
        };
        const base = target.var_precio || 0;
        target.monto_iva = Number(((base * ivaPorc) / 100).toFixed(2));
        target.precio_total = Number((base + target.monto_iva).toFixed(2));
      } else {
        target[campo] = valor;
      }

      nuevas[index] = target;
      return nuevas;
    });
  };

  const actualizarVarianteActual = (campo: keyof VarianteCatalogo, valor: any) => {
    actualizarVariantePorIndex(varianteActivaIndex, campo, valor);
  };

  const agregarNuevaVariante = () => {
    const base = 25;
    const ivaPorc = tarifaIvaMaster;
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
      var_codigo_impuesto_sri: ivaPorc > 0 ? "IVA_15" : "IVA_0",
      var_tarifa_iva_porcentaje: ivaPorc,
      var_tipo_oferta: "REGULAR",
      var_activo: true,
      var_detalle_variante: { iva_personalizado: false },
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
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setExitoAutoConvertir(null);

    const listaArchivos = Array.from(files);
    for (const f of listaArchivos) {
      if (f.size > LIMITE_MAX_IMAGEN_BYTES) {
        const tamanoMb = (f.size / (1024 * 1024)).toFixed(2);
        setError(`⚠️ La imagen "${f.name}" supera el tamaño máximo permitido de 5 MB (${tamanoMb} MB).`);
        e.target.value = "";
        return;
      }
    }

    setSubiendoImagenGlobal(true);
    try {
      const nuevasUrls: string[] = [];
      const errores: string[] = [];
      for (const file of listaArchivos) {
        const res = await subirImagenClienteOAccion(file, negocio || "comun", "portadas");
        if (res.ok && res.urlPublica) {
          nuevasUrls.push(res.urlPublica);
        } else {
          errores.push(`${file.name}: ${res.error || "error"}`);
        }
      }

      if (nuevasUrls.length > 0) {
        if (!imagenUrl.trim()) {
          const [primera, ...resto] = nuevasUrls;
          setImagenUrl(primera || "");
          if (resto.length > 0) {
            setGaleriaTexto((prev) => {
              const actuales = prev.split("\n").map((l) => l.trim()).filter(Boolean);
              return Array.from(new Set([...actuales, ...resto])).join("\n");
            });
          }
        } else {
          setGaleriaTexto((prev) => {
            const actuales = prev.split("\n").map((l) => l.trim()).filter(Boolean);
            return Array.from(new Set([...actuales, ...nuevasUrls])).join("\n");
          });
        }
        setExitoAutoConvertir(`¡${nuevasUrls.length} imagen(es) cargada(s) con éxito desde tu equipo!`);
      }
      if (errores.length > 0) {
        setError(`No se pudieron subir ${errores.length} imagen(es): ${errores.join(" · ")}`);
      }
    } catch (err: any) {
      setError(`Error al cargar imágenes: ${err.message || err}`);
    } finally {
      setSubiendoImagenGlobal(false);
      e.target.value = "";
    }
  };

  const handleEstablecerPortadaMaster = (urlSeleccionada: string) => {
    if (!urlSeleccionada || urlSeleccionada === imagenUrl) return;
    const todas = [...fotosMaster];
    const reordenadas = [urlSeleccionada, ...todas.filter((u) => u !== urlSeleccionada)];
    setImagenUrl(reordenadas[0] || "");
    const resto = reordenadas.slice(1);
    setGaleriaTexto(resto.join("\n"));
  };

  const handleQuitarFotoMaster = (urlAQuitar: string) => {
    const todas = fotosMaster.filter((u) => u !== urlAQuitar);
    if (todas.length === 0) {
      setImagenUrl("");
      setGaleriaTexto("");
    } else {
      setImagenUrl(todas[0] || "");
      setGaleriaTexto(todas.slice(1).join("\n"));
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
      setModoEdicion("master");
      setPasoMaster("identidad_precio");
      setError("Ingresa el nombre del producto.");
      return;
    }

    if (variantesLocales.length === 0) {
      setModoEdicion("master");
      setPasoMaster("identidad_precio");
      setError("Debes definir al menos una variante de precio.");
      return;
    }

    for (const v of variantesLocales) {
      if (!v.var_nombre.trim()) {
        setError("Todas las modalidades deben tener un nombre (ej. Pequeño, Mediano, Grande).");
        return;
      }
      if (v.var_precio <= 0) {
        if (variantesLocales.length === 1) {
          setModoEdicion("master");
          setPasoMaster("identidad_precio");
        }
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
            escalas_volumen: normalizarEscalasVolumen(v.var_detalle_variante?.escalas_volumen),
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

    // Si es un producto simple (1 sola variante), sincronizar fotos y atributos con la variante única
    if (variantesParaGuardar.length === 1 && variantesParaGuardar[0]) {
      const v0 = variantesParaGuardar[0];
      const fotosMasterSimple = [imagenUrlFinal, ...galeriaUrls].filter((u): u is string => Boolean(u && u.trim()));
      if (fotosMasterSimple.length > 0) {
        v0.var_detalle_variante = {
          ...(v0.var_detalle_variante || {}),
          portada_url: imagenUrlFinal || fotosMasterSimple[0] || null,
          galeria_urls: fotosMasterSimple,
        };
      }
    }

    try {
      const res = await editarProductoAction({
        pro_id: producto.pro_id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        esRenta: esOfertaRentaActiva,
        tipoOfertaEtiqueta: obtenerEtiquetaCortaTipoOferta(tipo, undefined, tiposOfertaLocales),
        rentaConfig: esOfertaRentaActiva ? rentaConfig : undefined,
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
          recargo_transporte_usd: recargoTransporteUsd > 0 ? recargoTransporteUsd : 0,
        },
        usos: usosSeleccionados,
        etiquetas: etiquetasSeleccionadas,
        canales_visibilidad: canalesSeleccionados,
        esCombo,
        comboComponentes: esCombo ? normalizarComponentesCombo(comboComponentes) : [],
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
            background: "linear-gradient(135deg, #1F1C19 0%, #221E1B 100%)",
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
                    color: "#847D74",
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
                  background: "#F4F2EE",
                  border: "1px solid #D5CFC4",
                  color: "#57524C",
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
                color: "#847D74",
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
            background: "#F8F7F4",
            padding: "8px 18px",
            borderBottom: "1px solid #E6E2DA",
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
                border: esModoMaster ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                background: esModoMaster ? "#221E1B" : "#FFFFFF",
                color: esModoMaster ? "#FFFFFF" : "#57524C",
                cursor: "pointer",
                boxShadow: esModoMaster ? "0 2px 4px rgba(2, 132, 199, 0.25)" : "none",
                transition: "all 0.15s ease",
              }}
            >
              <PackagePlus size={14} />
              <span>{variantesLocales.length === 1 ? "📦 1. Datos y Precio (Producto Simple)" : "🌐 1. Producto Master (Global)"}</span>
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
                border: !esModoMaster ? `1.5px solid ${colVariante.border}` : "1px solid #D5CFC4",
                background: !esModoMaster ? colVariante.bg : "#FFFFFF",
                color: !esModoMaster ? colVariante.text : "#57524C",
                cursor: "pointer",
                boxShadow: !esModoMaster ? `0 2px 4px ${colVariante.border}33` : "none",
                transition: "all 0.15s ease",
              }}
            >
              <Layers size={14} />
              <span>
                {variantesLocales.length === 1
                  ? "➕ Gestionar Variantes / Tamaños"
                  : esFloristeria
                  ? `🌸 2. Tamaños (${variantesLocales.length})`
                  : `🏷️ 2. Variantes y Planes (${variantesLocales.length})`}
              </span>
            </button>
          </div>

          <div style={{ fontSize: "0.72rem", color: "#847D74" }}>
            {esModoMaster ? (
              <span>Configuración guiada por pasos del producto</span>
            ) : (
              <span>
                Editando variante: <strong style={{ color: colVariante.text }}>{varianteActual?.var_nombre}</strong>
              </span>
            )}
          </div>
        </div>

        {/* BARRA WIZARD DE PASOS EN MODO MASTER */}
        {esModoMaster && (
          <BarraPasosWizardProducto
            pasoActivo={pasoMaster}
            onCambiarPaso={(nuevoPaso) => {
              setError(null);
              setPasoMaster(nuevoPaso);
            }}
            completados={completadosMaster}
            colorPrimario={esFloristeria ? "#221E1B" : "#221E1B"}
            permitirModoTodo={true}
            verTodo={verTodoMaster}
            onAlternarVerTodo={() => setVerTodoMaster((prev) => !prev)}
          />
        )}

        {/* Formulario */}
        <form onSubmit={handleGuardar} style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
          {error && (
            <div
              style={{
                background: "#FAF2F2",
                border: "1px solid #DEBABA",
                color: "#8A2E2E",
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
              {(verTodoMaster || pasoMaster === "identidad_precio") && (
                <div>
              {/* 1. DATOS PRINCIPALES DEL PRODUCTO MASTER */}
              <div style={{ marginBottom: "14px" }}>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#221E1B", marginBottom: "4px" }}>
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
                    border: "1px solid #D5CFC4",
                    fontSize: "0.9rem",
                    boxSizing: "border-box",
                    fontWeight: 600,
                  }}
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: "12px", marginBottom: "14px" }}>
                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#57524C" }}>
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
                          color: esFloristeria ? "#221E1B" : "#221E1B",
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
                          color: "#847D74",
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
                  <SelectConBuscador
                    value={categoriaId}
                    onChange={(e) => setCategoriaId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
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
                  </SelectConBuscador>
                </div>

                <div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px", gap: "6px", flexWrap: "wrap" }}>
                    <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#57524C" }}>
                      Tipo de Oferta Comercial
                    </label>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <button
                        type="button"
                        onClick={() => {
                          setTiposOfertaTab("crear");
                          setModalTiposOfertaAbierto(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: esFloristeria ? "#221E1B" : "#221E1B",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Crear nuevo tipo de oferta comercial (ej. Renta de Mobiliario)"
                      >
                        <span>+ Nueva</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setTiposOfertaTab("gestionar");
                          setModalTiposOfertaAbierto(true);
                        }}
                        style={{
                          background: "none",
                          border: "none",
                          color: "#847D74",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                        title="Administrar, editar y eliminar tipos de oferta comercial"
                      >
                        <Settings2 size={13} />
                        <span>Gestionar</span>
                      </button>
                    </div>
                  </div>
                  <SelectConBuscador
                    value={tipo}
                    onChange={(e) => {
                      const nextTipo = e.target.value;
                      setTipo(nextTipo);
                      const objOferta = opcionesTiposOferta.find(
                        (o) => o.tof_codigo.toUpperCase() === nextTipo.toUpperCase()
                      );
                      const detOferta = objOferta?.tof_detalle_tipo_oferta;
                      if (detOferta?.es_renta) {
                        setRentaConfig((prev) => ({
                          ...prev,
                          periodo: detOferta.periodo_defecto || prev.periodo || "Por evento (24h)",
                          incluye_retiro:
                            detOferta.incluye_retiro_defecto !== undefined
                              ? detOferta.incluye_retiro_defecto
                              : prev.incluye_retiro,
                          nota_condiciones:
                            detOferta.nota_condiciones_defecto || prev.nota_condiciones,
                        }));
                      }
                    }}
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: "8px",
                      border: esOfertaRentaActiva ? "1.5px solid #8F6A2E" : "1px solid #D5CFC4",
                      fontSize: "0.85rem",
                      boxSizing: "border-box",
                      background: esOfertaRentaActiva ? "#FFFDF5" : "#FFFFFF",
                      fontWeight: esOfertaRentaActiva ? 700 : 500,
                    }}
                  >
                    {opcionesTiposOferta.map((op) => (
                      <option key={op.tof_codigo} value={op.tof_codigo}>
                        {op.tof_nombre}
                      </option>
                    ))}
                  </SelectConBuscador>
                </div>
              </div>

              {esOfertaRentaActiva && (
                <PanelCondicionesRentaProducto
                  config={rentaConfig}
                  onChange={setRentaConfig}
                />
              )}

              {/* BLOQUE DE PRECIO Y FACTURACIÓN DIRECTA (PRODUCTO SIMPLE) */}
              {variantesLocales.length === 1 ? (
                <div
                  style={{
                    background: "#F8F7F4",
                    border: "1.5px solid #221E1B",
                    borderRadius: "12px",
                    padding: "16px",
                    marginBottom: "14px",
                    boxShadow: "0 2px 8px rgba(2, 132, 199, 0.08)",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span style={{ fontSize: "0.92rem" }}>📦</span>
                      <div>
                        <h4 style={{ margin: 0, fontSize: "0.88rem", fontWeight: 800, color: "#1F1C19" }}>
                          Precio y Facturación (Producto Simple)
                        </h4>
                        <span style={{ fontSize: "0.72rem", color: "#847D74" }}>
                          Define aquí el precio base, oferta tachada, código SKU y stock disponible.
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        agregarNuevaVariante();
                        setModoEdicion("variante");
                      }}
                      title="Agregar múltiples tamaños o variantes"
                      aria-label="Agregar múltiples tamaños o variantes"
                      style={{
                        background: "#1F1C19",
                        color: "#FFFFFF",
                        border: "none",
                        borderRadius: "8px",
                        padding: "6px 12px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                      }}
                    >
                      <Plus size={13} />
                      <span>Usar Tamaños / Variantes</span>
                    </button>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(165px, 100%), 1fr))", gap: "10px", marginBottom: "12px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Código SKU / Referencia *
                      </label>
                      <input
                        type="text"
                        value={variantesLocales[0]?.var_sku || ""}
                        onChange={(e) => actualizarVariantePorIndex(0, "var_sku", e.target.value)}
                        placeholder="Ej. TNK-001"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Precio Base Imponible ($ USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={variantesLocales[0]?.var_precio ?? ""}
                        onChange={(e) => actualizarVariantePorIndex(0, "var_precio", Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0.00"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                          fontWeight: 700,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#8F6A2E", marginBottom: "2px" }}>
                        Precio Oferta / Comparación ($ USD)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={variantesLocales[0]?.var_precio_comparacion ?? ""}
                        onChange={(e) => actualizarVariantePorIndex(0, "var_precio_comparacion", e.target.value === "" ? null : Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0.00 (Opcional tachado)"
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                          fontWeight: 700,
                          color: "#8F6A2E",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(190px, 100%), 1fr))", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Stock Disponible (Unidades)
                      </label>
                      <input
                        type="number"
                        min="0"
                        value={variantesLocales[0]?.var_detalle_variante?.stock ?? 999}
                        onChange={(e) =>
                          actualizarVariantePorIndex(0, "var_detalle_variante", {
                            ...(variantesLocales[0]?.var_detalle_variante || {}),
                            stock: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #E6E2DA",
                        borderRadius: "8px",
                        padding: "8px 12px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                      }}
                    >
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#847D74" }}>Tarifa IVA: </span>
                        <strong style={{ fontSize: "0.8rem", color: "#1F1C19" }}>
                          {variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster}%
                        </strong>
                      </div>
                      <div>
                        <span style={{ fontSize: "0.72rem", color: "#847D74" }}>PVP Final al Público: </span>
                        <strong style={{ fontSize: "0.95rem", color: "#2F4737" }}>
                          $
                          {(
                            Number(variantesLocales[0]?.var_precio || 0) *
                            (1 + (variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)
                          ).toFixed(2)}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Escalas de descuento por volumen para Producto Simple */}
                  <EditorEscalasVolumenVariante
                    escalas={normalizarEscalasVolumen(variantesLocales[0]?.var_detalle_variante?.escalas_volumen)}
                    pvpUnitarioNominal={
                      Number(variantesLocales[0]?.var_precio || 0) *
                      (1 + (variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)
                    }
                    onChange={(nuevasEscalas) =>
                      actualizarVariantePorIndex(0, "var_detalle_variante", {
                        ...(variantesLocales[0]?.var_detalle_variante || {}),
                        escalas_volumen: nuevasEscalas,
                      })
                    }
                  />
                </div>
              ) : (
                <div
                  style={{
                    background: "#F4F2EE",
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
                    <div style={{ fontSize: "0.82rem", fontWeight: 800, color: "#3A3530" }}>
                      🏷️ Variantes / Tamaños configurados: {variantesLocales.length}
                    </div>
                    <div style={{ fontSize: "0.72rem", color: "#221E1B" }}>
                      Personaliza fotos individuales y precios para cada tamaño en la pestaña de variantes.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setModoEdicion("variante");
                      setVarianteActivaIndex(0);
                    }}
                    title="Abrir editor de tamaños y variantes"
                    aria-label="Abrir editor de tamaños y variantes"
                    style={{
                      background: "#221E1B",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "6px 12px",
                      borderRadius: "6px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                    }}
                  >
                    Configurar Tamaños
                  </button>
                </div>
              )}

              {/* CONFIGURACIÓN GLOBAL DE IVA SRI (ECUADOR) */}
              <div
                style={{
                  background: "#F8F7F4",
                  border: "1px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "14px",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Percent size={16} color="#221E1B" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B" }}>
                      Tarifa IVA SRI Predeterminada (Global para este Producto)
                    </label>
                  </div>
                  <button
                    type="button"
                    onClick={() => aplicarIvaMasterATodos(tarifaIvaMaster, true)}
                    style={{
                      background: "#EFECE6",
                      border: "1px solid #DDD8CE",
                      color: "#3A3530",
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
                    aria-label="Aplicar tarifa IVA a todas las variantes"
                  >
                    <span>⚡ Aplicar a todos ({variantesLocales.length})</span>
                  </button>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(200px, 100%), 1fr))", gap: "8px" }}>
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
                      border: tarifaIvaMaster === 15 ? "2px solid #221E1B" : "1px solid #D5CFC4",
                      background: tarifaIvaMaster === 15 ? "#F4F2EE" : "#FFFFFF",
                      color: tarifaIvaMaster === 15 ? "#221E1B" : "#57524C",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: tarifaIvaMaster === 15 ? "0 2px 4px rgba(2, 132, 199, 0.15)" : "none",
                    }}
                  >
                    <span>🇪🇨 IVA 15% (Tarifa General SRI)</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#847D74" }}>
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
                      border: tarifaIvaMaster === 0 ? "2px solid #2F4737" : "1px solid #D5CFC4",
                      background: tarifaIvaMaster === 0 ? "#F2F6F3" : "#FFFFFF",
                      color: tarifaIvaMaster === 0 ? "#2F4737" : "#57524C",
                      cursor: "pointer",
                      textAlign: "left",
                      display: "flex",
                      flexDirection: "column",
                      boxShadow: tarifaIvaMaster === 0 ? "0 2px 4px rgba(16, 185, 129, 0.15)" : "none",
                    }}
                  >
                    <span>🌿 IVA 0% (Exento SRI / Tarifa Cero)</span>
                    <span style={{ fontSize: "0.68rem", fontWeight: 500, color: "#847D74" }}>
                      Flores naturales, servicios médicos o exentos
                    </span>
                  </button>
                </div>

                <div style={{ marginTop: "10px", display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.74rem", color: "#57524C", cursor: "pointer", fontWeight: 700 }}>
                    <input
                      type="checkbox"
                      checked={autoAplicarIvaVariantes}
                      onChange={(e) => setAutoAplicarIvaVariantes(e.target.checked)}
                      style={{ accentColor: "#221E1B", width: "14px", height: "14px", cursor: "pointer" }}
                    />
                    <span>Sincronizar automáticamente con todas las variantes ({variantesLocales.length})</span>
                  </label>
                  {mensajeFeedbackIva && (
                    <span style={{ fontSize: "0.72rem", color: "#2F4737", fontWeight: 800, background: "#F2F6F3", border: "1px solid #2F4737", borderRadius: "6px", padding: "3px 8px" }}>
                      {mensajeFeedbackIva}
                    </span>
                  )}
                </div>
              </div>

              {/* CONSTRUCTOR DE SET / COMBO DE EVENTOS (COMPUESTO POR PRODUCTOS INDIVIDUALES) */}
              <EditorSetComboConfigurable
                esCombo={esCombo}
                onCambiarEsCombo={setEsCombo}
                componentes={comboComponentes}
                onCambiarComponentes={(nuevos) => {
                  setComboComponentes(nuevos);
                  const suma = nuevos.reduce((acc, comp) => {
                    const p = (productos || []).find(
                      (item) =>
                        item.pro_id === comp.producto_id ||
                        (comp.producto_slug && item.pro_slug === comp.producto_slug)
                    );
                    const v =
                      p?.variantes.find(
                        (vi) =>
                          (comp.variante_id && vi.var_id === comp.variante_id) ||
                          (comp.variante_sku && vi.var_sku === comp.variante_sku)
                      ) || p?.variantes[0];
                    const pvpV = v
                      ? typeof v.precio_total === "number" && v.precio_total > 0
                        ? v.precio_total
                        : Number((Number(v.var_precio || 0) * (1 + Number(v.var_tarifa_iva_porcentaje || 0) / 100)).toFixed(2))
                      : 0;
                    return acc + pvpV * comp.cantidad_base;
                  }, 0);
                  const pvpActualSet =
                    Number(variantesLocales[0]?.var_precio || 0) *
                    (1 + (variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100);
                  if (suma > pvpActualSet) {
                    actualizarVariantePorIndex(0, "var_precio_comparacion", Number(suma.toFixed(2)));
                  }
                }}
                catalogoProductos={productos}
                productoActualId={producto.pro_id}
                pvpSetCompleto={
                  Number(variantesLocales[0]?.var_precio || 0) *
                  (1 + (variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)
                }
                tarifaIvaSet={variantesLocales[0]?.var_tarifa_iva_porcentaje ?? tarifaIvaMaster}
                onCambiarPrecioSetBase={(nuevoBase) => actualizarVariantePorIndex(0, "var_precio", nuevoBase)}
                onSincronizarPrecioComparacion={(sumaNominal) =>
                  actualizarVariantePorIndex(0, "var_precio_comparacion", Number(sumaNominal.toFixed(2)))
                }
              />
                </div>
              )}

              {/* 2. CONTROL DE ESTADO ACTIVO & TEMPORALIDAD ESTACIONAL */}
              {(verTodoMaster || pasoMaster === "logistica") && (
                <div>
              <div
                style={{
                  background: !proActivo ? "#FAF2F2" : vigenciaTipo !== "SIEMPRE" ? "#FAF6EE" : "#F8F7F4",
                  border: !proActivo
                    ? "1.5px solid #DEBABA"
                    : vigenciaTipo !== "SIEMPRE"
                    ? "1.5px solid #E5D7BC"
                    : "1px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "14px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Calendar size={16} color={!proActivo ? "#8A2E2E" : vigenciaTipo !== "SIEMPRE" ? "#8F6A2E" : "#221E1B"} />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: !proActivo ? "#8A2E2E" : "#221E1B", textTransform: "uppercase" }}>
                      Disponibilidad & Temporalidad Estacional
                    </label>
                  </div>

                  <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                    {/* Switch Principal Activar / Desactivar Producto */}
                    <button
                      type="button"
                      onClick={() => setProActivo(!proActivo)}
                      style={{
                        background: proActivo ? "#F2F6F3" : "#FAF2F2",
                        border: proActivo ? "1.5px solid #2F4737" : "1.5px solid #8A2E2E",
                        color: proActivo ? "#2B4A36" : "#8A2E2E",
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
                      <Power size={13} color={proActivo ? "#2F4737" : "#8A2E2E"} />
                      <span>{proActivo ? "🟢 Activo en Catálogo" : "⚪ Desactivado (Oculto)"}</span>
                    </button>

                    {/* Switch Insignia Destacado (Web & Landing) */}
                    <button
                      type="button"
                      onClick={() => setDestacado(!destacado)}
                      style={{
                        background: destacado ? "linear-gradient(135deg, #FAF6EE, #E5D7BC)" : "#F4F2EE",
                        border: destacado ? "1.5px solid #8F6A2E" : "1.5px solid #D5CFC4",
                        color: destacado ? "#745622" : "#847D74",
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
                      <Sparkles size={13} color={destacado ? "#8F6A2E" : "#847D74"} />
                      <span>{destacado ? "⭐ Insignia Destacado: SÍ" : "☆ Destacado: NO"}</span>
                    </button>
                  </div>
                </div>

                <p style={{ fontSize: "0.73rem", color: "#847D74", margin: "0 0 10px 0" }}>
                  Configura si el producto se ofrece todo el año o si pertenece a una temporada o rango de fechas específico (ej. "Bouquet San Valentín" del 10 al 15 de febrero):
                </p>

                {/* 3 Modos de Vigencia */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(145px, 100%), 1fr))", gap: "6px", marginBottom: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setVigenciaTipo("SIEMPRE")}
                    style={{
                      padding: "8px 10px",
                      borderRadius: "6px",
                      fontSize: "0.72rem",
                      fontWeight: 700,
                      border: vigenciaTipo === "SIEMPRE" ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                      background: vigenciaTipo === "SIEMPRE" ? "#EFECE6" : "#FFFFFF",
                      color: vigenciaTipo === "SIEMPRE" ? "#3A3530" : "#57524C",
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
                      border: vigenciaTipo === "RANGO_FECHAS" ? "1.5px solid #4A453F" : "1px solid #D5CFC4",
                      background: vigenciaTipo === "RANGO_FECHAS" ? "#F4F2EE" : "#FFFFFF",
                      color: vigenciaTipo === "RANGO_FECHAS" ? "#3A3530" : "#57524C",
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
                      border: vigenciaTipo === "ESTACIONAL_ANUAL" ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                      background: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#FAF2F2" : "#FFFFFF",
                      color: vigenciaTipo === "ESTACIONAL_ANUAL" ? "#8A2E2E" : "#57524C",
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: "10px", marginTop: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                          border: "1px solid #D5CFC4",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                          border: "1px solid #D5CFC4",
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
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(170px, 100%), 1fr))", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                            border: "1px solid #D5CFC4",
                            fontSize: "0.8rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                            border: "1px solid #D5CFC4",
                            fontSize: "0.8rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "10px" }}>
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                            border: "1px solid #D5CFC4",
                            fontSize: "0.78rem",
                            boxSizing: "border-box",
                            background: "#FFFFFF",
                          }}
                        />
                      </div>

                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                            border: "1px solid #D5CFC4",
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
                </div>
              )}

              {/* 3. RECURSOS DIGITALES Y GALERÍA DE FOTOS (PRODUCTO / MASTER) */}
              {(verTodoMaster || pasoMaster === "imagenes") && (
                <div>
              <div
                style={{
                  background: "#F8F7F4",
                  border: "1.5px solid #D5CFC4",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "16px",
                }}
              >
                {/* Cabecera de la Galería Unificada */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px", flexWrap: "wrap", gap: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <ImageIcon size={18} color="#221E1B" />
                    <div>
                      <label style={{ fontSize: "0.85rem", fontWeight: 800, color: "#221E1B", textTransform: "uppercase" }}>
                        Galería de Fotos del Producto
                      </label>
                      <div style={{ fontSize: "0.72rem", color: "#847D74" }}>
                        {fotosMaster.length > 0
                          ? `Total: ${fotosMaster.length} foto${fotosMaster.length === 1 ? "" : "s"}. La foto #1 es la Portada principal.`
                          : "Agrega una o varias fotos para el producto o vitrina."}
                      </div>
                    </div>
                  </div>

                  {/* Acciones para Subir o Seleccionar Múltiples */}
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                    <label
                      style={{
                        background: subiendoImagenGlobal ? "#847D74" : "#1F1C19",
                        color: "#FFFFFF",
                        padding: "6px 12px",
                        borderRadius: "7px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: subiendoImagenGlobal ? "wait" : "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                      }}
                      title="Subir una o varias fotos desde tu PC simultáneamente"
                    >
                      {subiendoImagenGlobal ? (
                        <>
                          <Loader2 size={13} className="animate-spin" />
                          <span>Subiendo fotos...</span>
                        </>
                      ) : (
                        <>
                          <Upload size={13} />
                          <span>📁 Subir Fotos PC</span>
                        </>
                      )}
                      <input
                        type="file"
                        accept="image/*"
                        multiple
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
                        background: "#221E1B",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "6px 14px",
                        borderRadius: "7px",
                        fontSize: "0.75rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "6px",
                        boxShadow: "0 1px 3px rgba(2, 132, 199, 0.25)",
                      }}
                      title="Seleccionar una o varias imágenes de la galería multimedia"
                    >
                      <ImageIcon size={13} />
                      <span>+ Seleccionar de Galería</span>
                    </button>
                  </div>
                </div>

                {exitoAutoConvertir && (
                  <div style={{ marginBottom: "10px", fontSize: "0.72rem", color: "#2F4737", background: "#F2F6F3", padding: "6px 10px", borderRadius: "6px", border: "1px solid #BBF7D0", display: "flex", alignItems: "center", gap: "6px" }}>
                    <CheckCircle2 size={14} /> {exitoAutoConvertir}
                  </div>
                )}

                {/* Grid Visual de Miniaturas de Fotos */}
                {fotosMaster.length === 0 ? (
                  <div
                    style={{
                      border: "2px dashed #D5CFC4",
                      borderRadius: "10px",
                      padding: "24px 16px",
                      textAlign: "center",
                      background: "#FFFFFF",
                      color: "#847D74",
                      marginBottom: "12px",
                    }}
                  >
                    <ImageIcon size={32} color="#847D74" style={{ margin: "0 auto 8px auto", display: "block" }} />
                    <p style={{ margin: "0 0 6px 0", fontSize: "0.82rem", fontWeight: 700, color: "#57524C" }}>
                      Este producto no tiene fotos configuradas
                    </p>
                    <p style={{ margin: 0, fontSize: "0.74rem" }}>
                      Haz clic en <strong>📁 Subir Fotos PC</strong> para cargar varias imágenes a la vez, o en <strong>+ Seleccionar de Galería</strong>.
                    </p>
                  </div>
                ) : (
                  <div style={{ marginBottom: "12px" }}>
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(105px, 1fr))",
                        gap: "10px",
                      }}
                    >
                      {fotosMaster.map((gUrl: string, idx: number) => {
                        const esPortada = idx === 0 || gUrl === imagenUrl;
                        return (
                          <div
                            key={`${gUrl}-${idx}`}
                            style={{
                              position: "relative",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: esPortada ? "2.5px solid #2F4737" : "1px solid #D5CFC4",
                              background: "#1F1C19",
                              aspectRatio: "1 / 1",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              boxShadow: esPortada ? "0 0 0 2px rgba(16, 185, 129, 0.25)" : "none",
                              cursor: esPortada ? "default" : "pointer",
                            }}
                            onClick={() => {
                              if (!esPortada) handleEstablecerPortadaMaster(gUrl);
                            }}
                            title={esPortada ? "Foto de Portada Principal" : "Haz clic para establecer esta foto como Portada"}
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
                            {/* Cabecera sobre la foto: Badge Portada / Número y botón eliminar */}
                            <div
                              style={{
                                position: "relative",
                                zIndex: 2,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                padding: "4px",
                                background: "linear-gradient(to bottom, rgba(0,0,0,0.7), transparent)",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.65rem",
                                  color: "#FFFFFF",
                                  fontWeight: 800,
                                  background: esPortada ? "#2F4737" : "rgba(0,0,0,0.55)",
                                  padding: "2px 5px",
                                  borderRadius: "4px",
                                }}
                              >
                                {esPortada ? "★ Portada" : `#${idx + 1}`}
                              </span>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleQuitarFotoMaster(gUrl);
                                }}
                                title="Eliminar foto del producto"
                                style={{
                                  background: "rgba(220, 38, 38, 0.9)",
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
                              >
                                <X size={11} />
                              </button>
                            </div>

                            {/* Pie sobre la foto si no es portada */}
                            {!esPortada && (
                              <div
                                style={{
                                  position: "relative",
                                  zIndex: 2,
                                  textAlign: "center",
                                  padding: "3px",
                                  background: "linear-gradient(to top, rgba(0,0,0,0.75), transparent)",
                                  color: "#FFFFFF",
                                  fontSize: "0.62rem",
                                  fontWeight: 700,
                                }}
                              >
                                <span>Poner de Portada</span>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}

                {/* Encuadre & Posición en Carrusel Cuadrado para Portada Master */}
                {imagenUrl && (
                  <div style={{ marginTop: "10px", marginBottom: "14px" }}>
                    <SelectorEncuadreFoto
                      imagenUrl={imagenUrl}
                      posicion={fotoPosicionMaster}
                      ajuste={fotoAjusteMaster}
                      zoom={fotoZoomMaster}
                      onCambiarPosicion={(pos) => setFotoPosicionMaster(pos)}
                      onCambiarAjuste={(aj) => setFotoAjusteMaster(aj)}
                      onCambiarZoom={(zm) => setFotoZoomMaster(zm)}
                      titulo="Encuadre & Posición en Carrusel Cuadrado (Foto Portada Principal)"
                      colorTema="#221E1B"
                    />
                  </div>
                )}

                {/* Álbum y Video / GIF */}
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(210px, 100%), 1fr))", gap: "10px", marginBottom: "10px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                        border: "1px solid #D5CFC4",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                      URL Video / GIF Demostrativo (YouTube, MP4)
                    </label>
                    <input
                      type="url"
                      placeholder="https://www.youtube.com/watch?v=... o .mp4 / .webm"
                      value={videoUrl}
                      onChange={(e) => setVideoUrl(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>
                </div>

                {/* Acordeón opcional para ver o editar URLs en texto directo */}
                <details style={{ marginTop: "10px", background: "#FFFFFF", border: "1px solid #E6E2DA", borderRadius: "8px", padding: "8px 12px" }}>
                  <summary style={{ fontSize: "0.72rem", fontWeight: 700, color: "#847D74", cursor: "pointer" }}>
                    ✏️ Modo Avanzado: Ver o editar URLs de fotos en texto directo
                  </summary>
                  <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "8px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        URL Foto de Portada Principal (#1)
                      </label>
                      <input
                        type="url"
                        value={imagenUrl}
                        onChange={(e) => setImagenUrl(e.target.value)}
                        placeholder="https://..."
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.75rem",
                          boxSizing: "border-box",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Fotos adicionales de la galería (URLs, una por línea)
                      </label>
                      <textarea
                        rows={2}
                        value={galeriaTexto}
                        onChange={(e) => setGaleriaTexto(e.target.value)}
                        placeholder={"https://...foto2.jpg\nhttps://...foto3.jpg"}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.75rem",
                          boxSizing: "border-box",
                          fontFamily: "monospace",
                        }}
                      />
                    </div>
                  </div>
                </details>
              </div>
                </div>
              )}

              {/* PASO 2: CARACTERÍSTICAS, DESCRIPCIÓN, BENEFICIOS Y PROMESA DE ENTREGA */}
              {(verTodoMaster || pasoMaster === "caracteristicas") && (
                <div>
                  <div style={{ marginBottom: "14px" }}>
                    <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#221E1B", marginBottom: "4px" }}>
                      Descripción Detallada del Producto
                    </label>
                    <textarea
                      rows={4}
                      placeholder={
                        esOfertaRentaActiva
                          ? "Ej. Números luminosos LED de estructura firme en calidad de renta para eventos, graduaciones, cumpleaños y bodas..."
                          : esFloristeria
                          ? "Ej. Arreglo floral elaborado con flores frescas seleccionadas y acabados de autor..."
                          : "Describe con claridad qué es el producto o servicio y su propuesta de valor..."
                      }
                      value={descripcion}
                      onChange={(e) => setDescripcion(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.84rem",
                        boxSizing: "border-box",
                        lineHeight: 1.45,
                      }}
                    />
                  </div>

                  <div
                    style={{
                      background: "#F8F7F4",
                      border: "1px solid #E6E2DA",
                      borderRadius: "10px",
                      padding: "12px 14px",
                      marginBottom: "14px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "6px",
                        marginBottom: "6px",
                      }}
                    >
                      <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B" }}>
                        Beneficios / ¿Qué incluye? (Una viñeta por línea)
                      </label>
                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                        {esFloristeria && (
                          <>
                            <button
                              type="button"
                              onClick={() =>
                                setBeneficiosTexto(
                                  "Rosas de exportación seleccionadas de tallo largo\nEnvoltura decorativa de diseño\nTarjeta dedicatoria personalizada incluida"
                                )
                              }
                              title="Insertar sugerencia para arreglo floral"
                              aria-label="Insertar sugerencia para arreglo floral"
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                border: "1px solid #D5CFC4",
                                background: "#FFFFFF",
                                color: "#57524C",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              + Sugerir Flores
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setBeneficiosTexto(
                                  "Mobiliario / elemento decorativo verificado y limpio\nEntrega y retiro coordinados para tu evento\nInstalación lista para fotografía y ambientación"
                                )
                              }
                              title="Insertar sugerencia para mobiliario o renta de eventos"
                              aria-label="Insertar sugerencia para mobiliario o renta de eventos"
                              style={{
                                padding: "3px 8px",
                                borderRadius: "6px",
                                border: "1px solid #DDD8CE",
                                background: "#F4F2EE",
                                color: "#3A3530",
                                fontSize: "0.68rem",
                                fontWeight: 700,
                                cursor: "pointer",
                              }}
                            >
                              + Sugerir Renta / Evento
                            </button>
                          </>
                        )}
                        {beneficiosTexto.trim().length > 0 && (
                          <button
                            type="button"
                            onClick={() => setBeneficiosTexto("")}
                            title="Vaciar beneficios para dejar sin viñetas o escribir desde cero"
                            aria-label="Limpiar beneficios"
                            style={{
                              padding: "3px 8px",
                              borderRadius: "6px",
                              border: "1px solid #DEBABA",
                              background: "#FAF2F2",
                              color: "#8A2E2E",
                              fontSize: "0.68rem",
                              fontWeight: 700,
                              cursor: "pointer",
                            }}
                          >
                            Limpiar
                          </button>
                        )}
                      </div>
                    </div>

                    <textarea
                      rows={4}
                      placeholder={
                        esOfertaRentaActiva
                          ? "Ej.\nIluminación LED cálida lista para conectar\nInstalación y retiro en el lugar del evento\nReserva garantizada para la fecha seleccionada"
                          : "Escribe un beneficio o elemento incluido por cada línea (déjalo vacío si no aplica)..."
                      }
                      value={beneficiosTexto}
                      onChange={(e) => setBeneficiosTexto(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "9px 12px",
                        borderRadius: "8px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.82rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />

                    {beneficiosLineasMaster.length > 0 ? (
                      <div style={{ marginTop: "8px", display: "flex", flexDirection: "column", gap: "3px" }}>
                        <span style={{ fontSize: "0.68rem", fontWeight: 700, color: "#847D74" }}>
                          Vista previa ({beneficiosLineasMaster.length} {beneficiosLineasMaster.length === 1 ? "viñeta" : "viñetas"}):
                        </span>
                        {beneficiosLineasMaster.map((linea, idx) => (
                          <div
                            key={`${idx}-${linea}`}
                            style={{
                              fontSize: "0.74rem",
                              color: "#1F1C19",
                              display: "flex",
                              alignItems: "center",
                              gap: "6px",
                            }}
                          >
                            <span style={{ color: "#2F4737", fontWeight: 800 }}>✓</span>
                            <span>{linea}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ display: "block", marginTop: "4px", fontSize: "0.68rem", color: "#847D74" }}>
                        Sin viñetas configuradas (no se mostrará texto genérico por defecto).
                      </span>
                    )}
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "12px", marginBottom: "16px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#221E1B", marginBottom: "4px" }}>
                        Promesa y Tiempo de Entrega Global *
                      </label>
                      <div style={{ display: "flex", gap: "5px", flexWrap: "wrap", marginBottom: "6px" }}>
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
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                border: sel ? "1.5px solid #1F1C19" : "1px solid #D5CFC4",
                                background: sel ? "#1F1C19" : "#FFFFFF",
                                color: sel ? "#FFFFFF" : "#57524C",
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
                        placeholder="Ej. 🌸 Pide hoy, recibe hoy (Mismo Día)"
                        value={tiempoEntrega}
                        onChange={(e) => setTiempoEntrega(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.83rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                        Requisitos / Condiciones del Cliente (Opcional, una por línea)
                      </label>
                      <textarea
                        rows={3}
                        placeholder={
                          esOfertaRentaActiva
                            ? "Ej. Punto eléctrico cercano 110V\nConfirmar dirección y hora de montaje"
                            : "Ej. Dirección exacta y teléfono de quien recibe (opcional)"
                        }
                        value={requisitosTexto}
                        onChange={(e) => setRequisitosTexto(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.8rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* 5. MODALIDAD DE ATENCIÓN / LOGÍSTICA & TRANSPORTE */}
              {(verTodoMaster || pasoMaster === "logistica") && (
                <div>
              <div
                style={{
                  background: deliveryIncluido ? "#F2F6F3" : "#F8F7F4",
                  border: deliveryIncluido ? "1.5px solid #CEDDD3" : "1px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  marginBottom: "16px",
                  transition: "all 0.2s ease",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    {esLegal ? (
                      <Scale size={16} color={deliveryIncluido ? "#2F4737" : "#221E1B"} />
                    ) : esFloristeria ? (
                      <Flower2 size={16} color={deliveryIncluido ? "#2F4737" : "#221E1B"} />
                    ) : (
                      <Truck size={16} color={deliveryIncluido ? "#2F4737" : "#847D74"} />
                    )}
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: deliveryIncluido ? "#2B4A36" : "#221E1B" }}>
                      {esLegal
                        ? "Modalidad de Atención Legal & Entrega de Dictamen"
                        : esFloristeria
                        ? "Logística, Envíos & Entrega Floral"
                        : "Logística & Turnos de Cuadrilla Técnica"}
                    </label>
                  </div>

                  {!esLegal && (
                    <a
                      href="/panel/logistica"
                      title="Abrir configuración de zonas de cobertura en Pichincha y tarifas por km"
                      aria-label="Configurar zonas y tarifas"
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "0.71rem",
                        fontWeight: 700,
                        color: "#2B4A36",
                        background: "#FFFFFF",
                        border: "1px solid #BBF7D0",
                        padding: "3px 8px",
                        borderRadius: "999px",
                        textDecoration: "none",
                      }}
                    >
                      <Settings2 size={12} />
                      <span>Zonas y Km</span>
                    </a>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(155px, 100%), 1fr))", gap: "6px", marginBottom: "10px" }}>
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
                          border: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                          background: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "#EFECE6" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "TELEMATICO_DIGITAL" ? "#3A3530" : "#57524C",
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
                          border: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "1.5px solid #4A453F" : "1px solid #D5CFC4",
                          background: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "#F4F2EE" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "NOTARIAL_PRESENCIAL" ? "#221E1B" : "#57524C",
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
                          border: deliveryIncluido ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                          background: deliveryIncluido ? "#F2F6F3" : "#FFFFFF",
                          color: deliveryIncluido ? "#2B4A36" : "#57524C",
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
                          setEtiquetaTransporte(
                            esFloristeria
                              ? configLogisticaNegocio.etiquetaEnvioGratis || "🌸 Envío Gratis en Centro-Norte de Quito"
                              : "🚚 Visita Técnica Incluida"
                          );
                          setCoberturaTransporte(
                            configLogisticaNegocio.zonaGratisNombre || "Centro-Norte de Quito"
                          );
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "1.5px solid #2F4737" : "1px solid #D5CFC4",
                          background: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "#F2F6F3" : "#FFFFFF",
                          color: deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS" ? "#2B4A36" : "#57524C",
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
                          setEtiquetaTransporte(esFloristeria ? "📦 Delivery Calculado por Ubicación" : "📦 Traslado con Costo");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "6px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "1.5px solid #8F6A2E" : "1px solid #D5CFC4",
                          background: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "#FAF6EE" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL" ? "#745622" : "#57524C",
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
                          border: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "1.5px solid #847D74" : "1px solid #D5CFC4",
                          background: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "#F4F2EE" : "#FFFFFF",
                          color: !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO" ? "#221E1B" : "#57524C",
                          cursor: "pointer",
                          textAlign: "center",
                        }}
                      >
                        🏪 Solo Retiro en Local
                      </button>
                    </>
                  )}
                </div>

                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))",
                    gap: "10px",
                  }}
                >
                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                      {esLegal ? "Etiqueta Visible de Modalidad" : "Etiqueta Visible de Transporte"}
                    </label>
                    <input
                      type="text"
                      value={etiquetaTransporte}
                      onChange={(e) => setEtiquetaTransporte(e.target.value)}
                      placeholder={esLegal ? "Ej. 🌐 Modalidad 100% Telemática" : "Ej. 🌸 Envío Gratis en Centro-Norte de Quito"}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                      {esLegal ? "Alcance de Cobertura Legal" : "Zona o Sector de Cobertura"}
                    </label>
                    <input
                      type="text"
                      value={coberturaTransporte}
                      onChange={(e) => setCoberturaTransporte(e.target.value)}
                      placeholder={esLegal ? "Ej. Cobertura Nacional (Ecuador)" : "Ej. Centro-Norte de Quito"}
                      style={{
                        width: "100%",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid #D5CFC4",
                        fontSize: "0.78rem",
                        boxSizing: "border-box",
                        background: "#FFFFFF",
                      }}
                    />
                  </div>

                  {!esLegal && (
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Recargo Especial (+USD)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        value={recargoTransporteUsd}
                        onChange={(e) => setRecargoTransporteUsd(Math.max(0, Number(e.target.value) || 0))}
                        placeholder="0.00"
                        title="Opcional: recargo adicional por furgoneta o volumen monumental de este arreglo"
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      />
                    </div>
                  )}
                </div>

                {!esLegal && modalidadTransporte !== "SOLO_RETIRO" && (
                  <div
                    style={{
                      marginTop: "8px",
                      fontSize: "0.71rem",
                      color: "#57524C",
                      background: "rgba(255,255,255,0.75)",
                      border: "1px dashed #D5CFC4",
                      borderRadius: "6px",
                      padding: "6px 9px",
                    }}
                  >
                    {deliveryIncluido ? (
                      <>
                        ✅ <strong>Gratis ($0.00)</strong> dentro de <strong>{configLogisticaNegocio.zonaGratisNombre}</strong>. Fuera de esta zona se calcula por enlace de Maps/Waze o mapa: tarifa de zona o{" "}
                        <strong>
                          (${configLogisticaNegocio.tarifaPorKm.toFixed(2)}/km − ${configLogisticaNegocio.subsidioBaseUsd.toFixed(2)}, mín. ${configLogisticaNegocio.recargoMinimoExtra.toFixed(2)})
                        </strong>
                        {recargoTransporteUsd > 0 ? ` + $${recargoTransporteUsd.toFixed(2)} transporte especial.` : "."}
                      </>
                    ) : (
                      <>
                        📦 Cobra tarifa base de <strong>${configLogisticaNegocio.tarifaBaseNoIncluido.toFixed(2)}</strong> en {configLogisticaNegocio.zonaGratisNombre} y cálculo completo por zona/km fuera de cobertura base
                        {recargoTransporteUsd > 0 ? ` + $${recargoTransporteUsd.toFixed(2)} transporte especial.` : "."}
                      </>
                    )}
                  </div>
                )}
              </div>
                </div>
              )}

              {/* 6. CANALES DE VISIBILIDAD Y DISTRIBUCIÓN */}
              {(verTodoMaster || pasoMaster === "canales_ia") && (
                <div>
              <div
                style={{
                  background: "#F8F7F4",
                  border: "1.5px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Share2 size={16} color="#221E1B" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B", textTransform: "uppercase" }}>
                      Canales de Visibilidad y Distribución
                    </label>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#847D74", fontWeight: 600 }}>
                    {canalesSeleccionados.length} de {CANALES_CATALOGO_OFICIALES.length} activos
                  </span>
                </div>
                <p style={{ fontSize: "0.75rem", color: "#847D74", margin: "0 0 10px 0" }}>
                  Indica en qué plataformas, aplicaciones y agentes de IA estará disponible este producto:
                </p>

                {!tieneAlMenosUnaImagen && (
                  <div
                    style={{
                      background: "#FAF6EE",
                      border: "1px solid #E5D7BC",
                      borderRadius: "8px",
                      padding: "8px 12px",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "flex-start",
                      gap: "8px",
                      fontSize: "0.74rem",
                      color: "#745622",
                      lineHeight: "1.35",
                    }}
                  >
                    <AlertCircle size={15} color="#8F6A2E" style={{ flexShrink: 0, marginTop: "2px" }} />
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
                          border: `1.5px solid ${activo ? c.color : exigeImagenYFalta ? "#D5CFC4" : "#E6E2DA"}`,
                          background: activo ? `${c.color}12` : exigeImagenYFalta ? "#F4F2EE" : "#FFFFFF",
                          color: activo ? "#1F1C19" : exigeImagenYFalta ? "#847D74" : "#847D74",
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
                            background: activo ? c.color : "#D5CFC4",
                            flexShrink: 0,
                          }}
                        />
                        <div style={{ flex: 1, minWidth: 0, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                          <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                            {c.nombre}
                          </div>
                          {exigeImagenYFalta && (
                            <span style={{ fontSize: "0.65rem", background: "#FAF2F2", color: "#8A2E2E", border: "1px solid #E5CACA", borderRadius: "4px", padding: "1px 4px", marginLeft: "4px", fontWeight: 700 }}>
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
                  background: "#F8F7F4",
                  border: "1.5px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px", flexWrap: "wrap", gap: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Target size={16} color="#221E1B" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B", textTransform: "uppercase" }}>
                      {esFloristeria ? "Usos y Ocasiones Recomendadas (IA & Filtros)" : "Usos y Casos de Aplicación (IA & Filtros)"}
                    </label>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#3A3530", fontWeight: 700, background: "#EFECE6", padding: "2px 8px", borderRadius: "12px" }}>
                    {usosSeleccionados.length} usos activos
                  </span>
                </div>
                <p style={{ fontSize: "0.73rem", color: "#847D74", margin: "0 0 10px 0", lineHeight: 1.4 }}>
                  Marca los escenarios donde los agentes de IA (como Tranqi) y los filtros deben recomendar este ítem. Los productos sin un uso específico (ej. <em>Condolencias</em>) serán excluidos automáticamente de esas consultas.
                </p>

                {/* Mensaje de feedback tras eliminar uso */}
                {mensajeExitoUso && (
                  <div
                    style={{
                      background: "#F2F6F3",
                      color: "#2B4A36",
                      border: "1px solid #CEDDD3",
                      padding: "8px 12px",
                      borderRadius: "6px",
                      fontSize: "0.78rem",
                      marginBottom: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    <CheckCircle2 size={16} color="#2F4737" />
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
                          border: activo ? "1.5px solid #221E1B" : "1px solid #D5CFC4",
                          background: activo ? "#F4F2EE" : "#FFFFFF",
                          color: activo ? "#3A3530" : "#57524C",
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
                              color: "#847D74",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px",
                              borderRadius: "3px",
                              transition: "all 0.15s ease",
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.color = "#8A2E2E")}
                            onMouseLeave={(e) => (e.currentTarget.style.color = "#847D74")}
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
                              background: activo ? "#221E1B" : "#D5CFC4",
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
                      border: "1px solid #D5CFC4",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarUsoPersonalizado}
                    style={{
                      background: "#1F1C19",
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
                        color: "#221E1B",
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
                  background: "#F8F7F4",
                  border: "1.5px solid #E6E2DA",
                  borderRadius: "10px",
                  padding: "14px",
                  marginBottom: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Tag size={16} color="#221E1B" />
                    <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B", textTransform: "uppercase" }}>
                      Etiquetas Semánticas de Búsqueda (Keywords IA)
                    </label>
                  </div>
                  <span style={{ fontSize: "0.74rem", color: "#847D74", fontWeight: 600 }}>
                    {etiquetasSeleccionadas.length} etiquetas
                  </span>
                </div>
                <p style={{ fontSize: "0.73rem", color: "#847D74", margin: "0 0 10px 0" }}>
                  Palabras clave o términos que el cliente o el asistente conversacional pueden usar (ej. <em>coreano</em>, <em>rosas rojas</em>, <em>papel importado</em>, <em>vanguardia</em>):
                </p>

                {/* Lista de tags activos */}
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "10px", minHeight: "26px", alignItems: "center" }}>
                  {etiquetasSeleccionadas.length === 0 ? (
                    <span style={{ fontSize: "0.72rem", color: "#847D74", fontStyle: "italic" }}>
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
                          background: "#F4F2EE",
                          color: "#57524C",
                          border: "1px solid #D5CFC4",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        <Hash size={12} color="#847D74" />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() => handleEliminarEtiqueta(tag)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "#847D74",
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
                      border: "1px solid #D5CFC4",
                      fontSize: "0.76rem",
                      background: "#FFFFFF",
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleAgregarEtiqueta}
                    style={{
                      background: "#221E1B",
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
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* MODO 2: EDITOR DE VARIANTES Y TAMAÑOS CON HERENCIA Y FOTO INDIVIDUAL      */}
          {/* ========================================================================= */}
          {!esModoMaster && (
            <div
              style={{
                background: "#F8F7F4",
                border: "1.5px solid #D5CFC4",
                borderRadius: "12px",
                padding: "16px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Layers size={17} color="#1F1C19" />
                  <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#1F1C19", textTransform: "uppercase" }}>
                    Selecciona el Tamaño / Variante para Personalizar ({variantesLocales.length})
                  </span>
                </div>
                <button
                  type="button"
                  onClick={agregarNuevaVariante}
                  style={{
                    background: "#1F1C19",
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
                  const pvpCalculado = (Number(v.var_precio || 0) * (1 + (v.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100));
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
                        color: activa ? col.text : "#57524C",
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
                      <span style={{ fontWeight: 800, color: activa ? col.text : "#1F1C19" }}>
                        ${(v.precio_total || pvpCalculado).toFixed(2)}
                      </span>
                      {tieneFotoPropia ? (
                        <span
                          title="Tiene Foto Propia Exclusiva"
                          style={{
                            fontSize: "0.62rem",
                            background: "#221E1B",
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
                            background: "#F4F2EE",
                            color: "#847D74",
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
                              background: activa ? "rgba(0,0,0,0.08)" : "#F4F2EE",
                              border: "none",
                              borderRadius: "3px",
                              padding: "2px 4px",
                              cursor: idx === 0 ? "not-allowed" : "pointer",
                              opacity: idx === 0 ? 0.25 : 1,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronLeft size={11} color={activa ? col.text : "#57524C"} />
                          </button>
                          <button
                            type="button"
                            disabled={idx === variantesLocales.length - 1}
                            onClick={(e) => moverVariante(idx, "abajo", e)}
                            title="Mover después / derecha"
                            style={{
                              background: activa ? "rgba(0,0,0,0.08)" : "#F4F2EE",
                              border: "none",
                              borderRadius: "3px",
                              padding: "2px 4px",
                              cursor: idx === variantesLocales.length - 1 ? "not-allowed" : "pointer",
                              opacity: idx === variantesLocales.length - 1 ? 0.25 : 1,
                              display: "flex",
                              alignItems: "center",
                            }}
                          >
                            <ChevronRight size={11} color={activa ? col.text : "#57524C"} />
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
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(180px, 100%), 1fr))", gap: "10px", marginBottom: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                          border: "1px solid #D5CFC4",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                          fontWeight: 600,
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
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
                          border: "1px solid #D5CFC4",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(165px, 100%), 1fr))", gap: "10px" }}>
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Precio Venta Sin IVA ($) *
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
                          border: "1px solid #D5CFC4",
                          fontSize: "0.88rem",
                          fontWeight: 800,
                          boxSizing: "border-box",
                          color: "#1F1C19",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        Tarifa IVA SRI
                      </label>
                      <SelectConBuscador
                        value={varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster}
                        onChange={(e) => actualizarVarianteActual("var_tarifa_iva_porcentaje", e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.82rem",
                          boxSizing: "border-box",
                          background: "#FFFFFF",
                        }}
                      >
                        <option value={15}>IVA 15%</option>
                        <option value={0}>IVA 0%</option>
                      </SelectConBuscador>
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#57524C", marginBottom: "2px" }}>
                        PVP Anterior / Tachado ($)
                      </label>
                      <input
                        type="number"
                        step="0.50"
                        min="0"
                        placeholder="Ej. 80.00 (Oferta)"
                        value={varianteActual.var_precio_comparacion ?? ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "" || val === "0") {
                            actualizarVarianteActual("var_precio_comparacion", null);
                          } else {
                            const num = parseFloat(val);
                            actualizarVarianteActual("var_precio_comparacion", !isNaN(num) ? num : null);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid #D5CFC4",
                          fontSize: "0.85rem",
                          boxSizing: "border-box",
                          color: "#847D74",
                        }}
                      />
                    </div>
                  </div>

                  {/* Resumen de PVP en vivo */}
                  <div
                    style={{
                      margin: "12px 0",
                      padding: "8px 12px",
                      background: "#F8F7F4",
                      border: "1px dashed #D5CFC4",
                      borderRadius: "6px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      fontSize: "0.78rem",
                    }}
                  >
                    <div>
                      <span style={{ color: "#847D74" }}>Base: </span>
                      <strong style={{ color: "#1F1C19" }}>${Number(varianteActual.var_precio || 0).toFixed(2)}</strong>
                      <span style={{ margin: "0 6px", color: "#D5CFC4" }}>|</span>
                      <span style={{ color: "#847D74" }}>IVA ({varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster}%): </span>
                      <strong style={{ color: "#1F1C19" }}>
                        ${(Number(varianteActual.var_precio || 0) * (varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100).toFixed(2)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                      <span style={{ color: "#847D74" }}>PVP Total:</span>
                      <strong style={{ color: "#2F4737", fontSize: "0.95rem", fontWeight: 800 }}>
                        ${(Number(varianteActual.var_precio || 0) * (1 + (varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)).toFixed(2)}
                      </strong>
                      {varianteActual.var_precio_comparacion &&
                        Number(varianteActual.var_precio_comparacion) >
                          Number(varianteActual.var_precio || 0) * (1 + (varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100) && (
                          <>
                            <span style={{ textDecoration: "line-through", color: "#847D74", fontSize: "0.85rem", fontWeight: 500 }} title="Precio regular tachado">
                              ${Number(varianteActual.var_precio_comparacion).toFixed(2)}
                            </span>
                            <span
                              style={{
                                background: "#F6E9E9",
                                color: "#8A2E2E",
                                fontSize: "0.72rem",
                                fontWeight: 800,
                                padding: "2px 7px",
                                borderRadius: "999px",
                              }}
                            >
                              🔥 -{Math.round(
                                ((Number(varianteActual.var_precio_comparacion) -
                                  Number(varianteActual.var_precio || 0) * (1 + (varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)) /
                                  Number(varianteActual.var_precio_comparacion)) *
                                  100
                              )}% OFF
                            </span>
                          </>
                        )}
                      {variantesLocales.length > 1 && (
                        <button
                          type="button"
                          onClick={handleEliminarVarianteClick}
                          disabled={eliminandoVariante}
                          title="Eliminar esta variante"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#8A2E2E",
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

                  {/* Escalas de descuento por cantidad / volumen para esta variante */}
                  <div style={{ marginBottom: "12px" }}>
                    <EditorEscalasVolumenVariante
                      escalas={normalizarEscalasVolumen(varianteActual?.var_detalle_variante?.escalas_volumen)}
                      pvpUnitarioNominal={
                        Number(varianteActual.var_precio || 0) *
                        (1 + (varianteActual.var_tarifa_iva_porcentaje ?? tarifaIvaMaster) / 100)
                      }
                      onChange={(nuevasEscalas) =>
                        actualizarVarianteActual("var_detalle_variante", {
                          ...(varianteActual?.var_detalle_variante || {}),
                          escalas_volumen: nuevasEscalas,
                        })
                      }
                    />
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
                          background: "#F8F7F4",
                          border: "1.5px solid #E6E2DA",
                          borderRadius: "10px",
                          padding: "12px",
                          marginBottom: "12px",
                        }}
                      >
                        {/* Cabecera del contenedor unificado */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <ImageIcon size={16} color={colActiva.text} />
                            <label style={{ fontSize: "0.8rem", fontWeight: 800, color: "#221E1B" }}>
                              Galería de Fotos para "{varianteActual.var_nombre}"
                            </label>
                            <span
                              style={{
                                fontSize: "0.7rem",
                                fontWeight: 700,
                                background: tieneFotosPropias ? colActiva.badge : "#F4F2EE",
                                color: tieneFotosPropias ? colActiva.text : "#847D74",
                                padding: "2px 8px",
                                borderRadius: "12px",
                                border: `1px solid ${tieneFotosPropias ? colActiva.border : "#D5CFC4"}`,
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
                                  color: "#847D74",
                                  border: "1px solid #D5CFC4",
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
                                color: "#221E1B",
                                border: "1px solid #DDD8CE",
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
                                background: "#221E1B",
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
                              border: "1px dashed #D5CFC4",
                              borderRadius: "8px",
                              padding: "10px 14px",
                              gap: "12px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                              {imagenUrl ? (
                                <div style={{ width: "42px", height: "42px", borderRadius: "6px", overflow: "hidden", background: "#1F1C19", flexShrink: 0, border: "1px solid #E6E2DA" }}>
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
                                <div style={{ width: "42px", height: "42px", borderRadius: "6px", background: "#E6E2DA", display: "flex", alignItems: "center", justifyContent: "center", color: "#847D74" }}>
                                  <ImageIcon size={18} />
                                </div>
                              )}
                              <div>
                                <div style={{ fontSize: "0.76rem", color: "#221E1B", fontWeight: 700 }}>
                                  ⚪ <strong>Foto Heredada del Master</strong>
                                </div>
                                <div style={{ fontSize: "0.7rem", color: "#847D74" }}>
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
                            <p style={{ fontSize: "0.7rem", color: "#847D74", margin: "0 0 6px 0" }}>
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
                                border: "1px solid #D5CFC4",
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
                                      border: esPortada ? "2.5px solid #2F4737" : "1px solid #E6E2DA",
                                      background: "#1F1C19",
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
                                          background: esPortada ? "#2F4737" : "rgba(255,255,255,0.9)",
                                          color: esPortada ? "#FFFFFF" : "#1F1C19",
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
                                  <div style={{ marginTop: "6px", fontSize: "0.68rem", color: "#745622", background: "#FAF6EE", padding: "6px 10px", borderRadius: "6px", border: "1px solid #E5D7BC", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                    <span>⚠️ La portada actual es un enlace web de Google Fotos.</span>
                                    <button
                                      type="button"
                                      disabled={resolviendoVarianteImg}
                                      onClick={() => handleConvertirImagenVariante(fotoPortada)}
                                      style={{
                                        background: "#221E1B",
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
                      background: "#F8F7F4",
                      border: "1px solid #E6E2DA",
                      borderRadius: "8px",
                      padding: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Camera size={15} color={colActiva.dot} />
                        <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#221E1B" }}>
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
                            border: !varianteActual.var_detalle_variante?.album_url ? "1.5px solid #1F1C19" : "1px solid #D5CFC4",
                            background: !varianteActual.var_detalle_variante?.album_url ? "#1F1C19" : "#FFFFFF",
                            color: !varianteActual.var_detalle_variante?.album_url ? "#FFFFFF" : "#847D74",
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
                            border: Boolean(varianteActual.var_detalle_variante?.album_url) ? `1.5px solid ${colActiva.border}` : "1px solid #D5CFC4",
                            background: Boolean(varianteActual.var_detalle_variante?.album_url) ? colActiva.bg : "#FFFFFF",
                            color: Boolean(varianteActual.var_detalle_variante?.album_url) ? colActiva.text : "#847D74",
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
                              border: "1px solid #D5CFC4",
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
                        <div style={{ marginTop: "4px", fontSize: "0.68rem", color: "#847D74" }}>
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
                          border: "1px dashed #D5CFC4",
                          borderRadius: "6px",
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "0.75rem", color: "#221E1B", fontWeight: 700 }}>
                            ⚪ Álbum Heredado del Master:
                          </span>
                          <span style={{ fontSize: "0.72rem", color: albumFotosUrl ? "#221E1B" : "#847D74", fontStyle: albumFotosUrl ? "normal" : "italic" }}>
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
                      <span style={{ fontSize: "0.68rem", color: "#847D74" }}>
                        Si se deja vacío, hereda automáticamente los valores globales
                      </span>
                    </div>

                    {/* Tiempo de Entrega Específico de esta variante */}
                    <div style={{ marginBottom: "8px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#57524C" }}>
                          Tiempo de Entrega para este Tamaño:
                        </label>
                        <span style={{ fontSize: "0.68rem", color: varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.text : "#847D74", fontWeight: 700 }}>
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
                            border: !varianteActual.var_detalle_variante?.tiempo_entrega ? `1.5px solid ${colActiva.border}` : "1px solid #D5CFC4",
                            background: !varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.badge : "#FFFFFF",
                            color: !varianteActual.var_detalle_variante?.tiempo_entrega ? colActiva.text : "#57524C",
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
                                border: sel ? `1.5px solid ${colActiva.border}` : "1px solid #D5CFC4",
                                background: sel ? colActiva.badge : "#FFFFFF",
                                color: sel ? colActiva.text : "#57524C",
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
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#57524C" }}>
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
                                  border: activo ? `1.5px solid ${colActiva.border}` : "1px solid #D5CFC4",
                                  background: activo ? colActiva.badge : "#FFFFFF",
                                  color: activo ? colActiva.text : "#57524C",
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
                        <div style={{ fontSize: "0.7rem", color: "#847D74", background: "#FFFFFF", padding: "6px 10px", borderRadius: "6px", border: "1px solid #E6E2DA" }}>
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
                              border: "1px solid #D5CFC4",
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
                      background: "#F8F7F4",
                      border: "1.5px solid #E6E2DA",
                      borderRadius: "10px",
                      padding: "12px",
                      marginBottom: "12px",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Target size={15} color="#221E1B" />
                        <label style={{ fontSize: "0.78rem", fontWeight: 800, color: "#221E1B" }}>
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
                                ? "1.5px solid #1F1C19"
                                : "1px solid #D5CFC4",
                            background:
                              (varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar"
                                ? "#1F1C19"
                                : "#FFFFFF",
                            color:
                              (varianteActual.var_detalle_variante?.usos_modo || "heredar") === "heredar"
                                ? "#FFFFFF"
                                : "#847D74",
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
                                : "1px solid #D5CFC4",
                            background:
                              varianteActual.var_detalle_variante?.usos_modo === "personalizado"
                                ? colActiva.bg
                                : "#FFFFFF",
                            color:
                              varianteActual.var_detalle_variante?.usos_modo === "personalizado"
                                ? colActiva.text
                                : "#847D74",
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
                          border: "1px dashed #D5CFC4",
                          borderRadius: "6px",
                          padding: "8px 12px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "0.72rem", color: "#847D74" }}>
                            ⚪ Hereda las {usosSeleccionados.length} ocasiones configuradas en el Master:
                          </span>
                          {usosSeleccionados.length === 0 ? (
                            <span style={{ fontSize: "0.72rem", color: "#847D74", fontStyle: "italic" }}>
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
                                    background: "#F4F2EE",
                                    color: "#57524C",
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
                            <span style={{ fontSize: "0.68rem", color: "#847D74", fontWeight: 700 }}>
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
                        <p style={{ fontSize: "0.7rem", color: "#847D74", margin: "0 0 8px 0" }}>
                          Configura para qué ocasiones la IA (Tranqi) y los filtros recomendarán específicamente este tamaño:
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
                                      border: activo ? `1.5px solid ${colActiva.border}` : "1px solid #D5CFC4",
                                      background: activo ? colActiva.bg : "#FFFFFF",
                                      color: activo ? colActiva.text : "#57524C",
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
                                          color: "#847D74",
                                          cursor: "pointer",
                                          display: "inline-flex",
                                          alignItems: "center",
                                          padding: "1px",
                                          borderRadius: "3px",
                                        }}
                                        onMouseEnter={(e) => (e.currentTarget.style.color = "#8A2E2E")}
                                        onMouseLeave={(e) => (e.currentTarget.style.color = "#847D74")}
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
                                          background: activo ? colActiva.text : "#D5CFC4",
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
                              border: "1px solid #D5CFC4",
                              fontSize: "0.74rem",
                              background: "#FFFFFF",
                            }}
                          />
                          <button
                            type="button"
                            onClick={handleAgregarUsoPersonalizadoVariante}
                            style={{
                              background: "#1F1C19",
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
              borderTop: "1px solid #E6E2DA",
              marginTop: "8px",
              flexWrap: "wrap",
              gap: "8px",
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
                aria-label="Eliminar producto"
                style={{
                  background: confirmarEliminar ? "#8A2E2E" : "transparent",
                  color: confirmarEliminar ? "#FFFFFF" : "#8A2E2E",
                  border: confirmarEliminar ? "none" : "1.5px solid #8A2E2E",
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
                    ? "Confirmar Eliminar"
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
                aria-label="Eliminar variante"
                style={{
                  background: confirmarEliminarVariante ? "#8A2E2E" : "transparent",
                  color: variantesLocales.length <= 1 ? "#847D74" : confirmarEliminarVariante ? "#FFFFFF" : "#8A2E2E",
                  border: variantesLocales.length <= 1 ? "1px solid #E6E2DA" : confirmarEliminarVariante ? "none" : "1.5px solid #DEBABA",
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
                    ? "Confirmar Eliminar"
                    : "Eliminar Variante"}
                </span>
              </button>
            )}

            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <button
                type="button"
                onClick={onCerrar}
                title="Cerrar sin guardar"
                aria-label="Cancelar"
                style={{
                  background: "#F4F2EE",
                  color: "#57524C",
                  border: "none",
                  padding: "9px 14px",
                  borderRadius: "8px",
                  fontSize: "0.83rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              {esModoMaster && !verTodoMaster && indicePasoMaster > 0 && (
                <button
                  type="button"
                  onClick={() => {
                    const prev = PASOS_WIZARD_PRODUCTO[indicePasoMaster - 1];
                    if (prev) setPasoMaster(prev.id);
                  }}
                  title="Ir al paso anterior"
                  aria-label="Paso anterior"
                  style={{
                    background: "#FFFFFF",
                    color: "#57524C",
                    border: "1px solid #D5CFC4",
                    padding: "9px 13px",
                    borderRadius: "8px",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Anterior</span>
                </button>
              )}

              {esModoMaster && !verTodoMaster && indicePasoMaster < PASOS_WIZARD_PRODUCTO.length - 1 && (
                <button
                  type="button"
                  onClick={() => {
                    const sig = PASOS_WIZARD_PRODUCTO[indicePasoMaster + 1];
                    if (sig) setPasoMaster(sig.id);
                  }}
                  title="Avanzar al siguiente paso"
                  aria-label="Siguiente paso"
                  style={{
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 14px",
                    borderRadius: "8px",
                    fontSize: "0.83rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                  }}
                >
                  <span>Siguiente</span>
                  <ArrowRight size={14} />
                </button>
              )}

              <button
                type="submit"
                disabled={guardando}
                title="Guardar cambios del producto"
                aria-label="Actualizar catálogo"
                style={{
                  background: esFloristeria ? "#221E1B" : "#221E1B",
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
        modoSeleccion={contextoGaleria === "master" || contextoGaleria === "galeria" || contextoGaleria === "variante_galeria" || contextoGaleria === "variante" ? "multiple" : "simple"}
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
      <ModalGestionTiposOferta
        abierto={modalTiposOfertaAbierto}
        onCerrar={() => setModalTiposOfertaAbierto(false)}
        negocio={negocio}
        tabInicial={tiposOfertaTab}
        onCambioCatalogo={(nuevaLista, nuevoCodigo) => {
          setTiposOfertaLocales(nuevaLista);
          if (nuevoCodigo) {
            setTipo(nuevoCodigo);
          } else if (
            nuevaLista.length > 0 &&
            !nuevaLista.some((t) => t.tof_codigo.toUpperCase() === tipo.toUpperCase())
          ) {
            setTipo(nuevaLista[0]!.tof_codigo);
          }
        }}
      />
    </div>
  );
}
