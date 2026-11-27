"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useEffect, useMemo, useState } from "react";
import {
  ShoppingBag,
  Scale,
  ShieldCheck,
  FileCheck,
  CreditCard,
  Search,
  Sparkles,
  Tag,
  Hash,
  CheckCircle,
  AlertCircle,
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
  Share2,
  CheckCircle2,
  CheckSquare,
  Square,
  Globe,
  Building2,
  Settings2,
  Gift,
  FileText,
  Trash2,
  Heart,
  ClipboardCopy,
  FileSpreadsheet,
} from "lucide-react";
import {
  ProductoCatalogo,
  VarianteCatalogo,
  CategoriaCatalogo,
  obtenerCatalogoProductosAction,
  obtenerCategoriasAction,
  restaurarCatalogoEjemploAction,
  eliminarProductoAction,
  alternarCanalVisibilidadProductoAction,
  alternarActivoProductoAction,
  alternarDestacadoProductoAction,
} from "../acciones";
import {
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  CANALES_REQUIEREN_IMAGEN,
  CanalVisibilidad,
  productoTieneAlMenosUnaImagen,
} from "../canales";
import { evaluarVigenciaProducto } from "../utils/vigencia";
import { ModalCheckoutPayphone } from "./ModalCheckoutPayphone";
import { ModalCrearProducto } from "./ModalCrearProducto";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalEditarProducto, PALETA_COLORES_VARIANTES } from "./ModalEditarProducto";
import { ManualConfiguracionCatalogoModal } from "./ManualConfiguracionCatalogoModal";
import { TableroDisponibilidadOperativa } from "./TableroDisponibilidadOperativa";
import { GestionConveniosCorporativos } from "./GestionConveniosCorporativos";
import { VitrinaComercialVisual } from "./VitrinaComercialVisual";
import { TarjetaBeneficiosCorporativosCliente } from "./TarjetaBeneficiosCorporativosCliente";
import { Flower2, Wrench, Activity, LayoutGrid, Users, Calendar, Power, Link2 } from "lucide-react";
import { detectarTipoNegocio, obtenerImagenFallbackNegocio } from "../utils/negocio";
import {
  URL_TIENDA_POR_NEGOCIO,
  construirEnlaceCategoriaTienda,
  construirEnlaceProductoTienda,
} from "../utils/enlacesTienda";
import { esCodigoOfertaRenta, normalizarConfiguracionRenta } from "../utils/tiposOferta";
import {
  normalizarComponentesCombo,
  normalizarEscalasVolumen,
  describirEscalaVolumen,
} from "../utils/combosVolumen";
import { ModalGestionTiposOferta } from "./ModalGestionTiposOferta";
import { ModalExportarImportarCatalogo } from "./ModalExportarImportarCatalogo";
import { formatearConfiguracionProductoTexto } from "../utils/catalogoMasivo";
import {
  formatearDescripcionComposicion,
  resolverComposicionRecetaEfectiva,
} from "../utils/recetaProducto";

interface Props {
  negocio?: string;
}

export function CatalogoProductosComercio({ negocio = "tranqi" }: Props) {
  const { esFloristeria, esLegal, esMantenimiento } = detectarTipoNegocio(negocio);

  const [pestanaActiva, setPestanaActiva] = useState<"catalogo" | "disponibilidad" | "convenios" | "empresas">("catalogo");
  const [modoVista, setModoVista] = useState<"admin" | "cliente">("admin");
  const [videoModalUrl, setVideoModalUrl] = useState<string | null>(null);
  const [esModoMovil, setEsModoMovil] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return;
    const mq = window.matchMedia("(max-width: 640px)");
    const sincronizarMovil = () => setEsModoMovil(mq.matches);
    sincronizarMovil();
    mq.addEventListener("change", sincronizarMovil);
    return () => mq.removeEventListener("change", sincronizarMovil);
  }, []);

  const [productos, setProductos] = useState<ProductoCatalogo[]>([]);
  const [categoriasLista, setCategoriasLista] = useState<CategoriaCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [cargandoSemillas, setCargandoSemillas] = useState(false);
  const [busqueda, setBusqueda] = useState("");
  const [etiquetasActivas, setEtiquetasActivas] = useState<string[]>([]);
  const [categoriaSeleccionada, setCategoriaSeleccionada] = useState<string>("todas");
  const [canalSeleccionado, setCanalSeleccionado] = useState<string>("todos");
  const [filtroEstadoAdmin, setFiltroEstadoAdmin] = useState<"todos" | "activos" | "inactivos">("todos");
  const [soloDestacados, setSoloDestacados] = useState<boolean>(false);
  const [soloEnOferta, setSoloEnOferta] = useState<boolean>(false);
  const [verTodosEnFiltroCanal, setVerTodosEnFiltroCanal] = useState<boolean>(false);
  const [guardandoCanalKey, setGuardandoCanalKey] = useState<string | null>(null);
  const [guardandoActivoKey, setGuardandoActivoKey] = useState<string | null>(null);
  const [guardandoDestacadoKey, setGuardandoDestacadoKey] = useState<string | null>(null);
  const [confirmarEliminarProdId, setConfirmarEliminarProdId] = useState<string | null>(null);
  const [eliminandoProdId, setEliminandoProdId] = useState<string | null>(null);
  const [mensajeErrorCanal, setMensajeErrorCanal] = useState<string | null>(null);

  // Estado de modales
  const [checkoutAbierto, setCheckoutAbierto] = useState(false);
  const [productoCheckout, setProductoCheckout] = useState<ProductoCatalogo | null>(null);
  const [varianteCheckout, setVarianteCheckout] = useState<VarianteCatalogo | null>(null);

  const [modalProdAbierto, setModalProdAbierto] = useState(false);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);
  const [catModalTab, setCatModalTab] = useState<"crear" | "gestionar">("crear");
  const [modalTiposOfertaAbierto, setModalTiposOfertaAbierto] = useState(false);
  const [productoAEditar, setProductoAEditar] = useState<ProductoCatalogo | null>(null);
  const [varianteAEditarId, setVarianteAEditarId] = useState<string | undefined>(undefined);
  const [modalEditarAbierto, setModalEditarAbierto] = useState(false);
  const [modalManualAbierto, setModalManualAbierto] = useState(false);
  const [modalMasivoAbierto, setModalMasivoAbierto] = useState(false);
  const [configCopiadaProdId, setConfigCopiadaProdId] = useState<string | null>(null);

  const copiarConfiguracionProducto = async (prod: ProductoCatalogo) => {
    try {
      const texto = formatearConfiguracionProductoTexto(prod, { negocio });
      await navigator.clipboard.writeText(texto);
      setConfigCopiadaProdId(prod.pro_id);
      setTimeout(() => {
        setConfigCopiadaProdId((prev) => (prev === prod.pro_id ? null : prev));
      }, 2200);
    } catch {
      // Fallback silencioso si el navegador bloquea clipboard
    }
  };

  // Mapa de variantes seleccionadas por producto
  const [varianteSeleccionadaPorProducto, setVarianteSeleccionadaPorProducto] = useState<
    Record<string, string>
  >({});

  // Índice de foto activa en el carrusel de cada producto
  const [fotoCarouselIndexPorProducto, setFotoCarouselIndexPorProducto] = useState<
    Record<string, number>
  >({});

  // Estado de feedback al copiar URL de consulta
  const [copiadoConsulta, setCopiadoConsulta] = useState(false);
  // Estado de feedback al copiar link público de tienda (categoría o producto)
  const [linkTiendaCopiadoKey, setLinkTiendaCopiadoKey] = useState<string | null>(null);

  const copiarLinkPublicoTienda = async (key: string, url: string) => {
    try {
      await navigator.clipboard.writeText(url);
      setLinkTiendaCopiadoKey(key);
      setTimeout(() => {
        setLinkTiendaCopiadoKey((prev) => (prev === key ? null : prev));
      }, 2200);
    } catch {
      // Fallback silencioso si el navegador restringe portapapeles
    }
  };

  // Inicializar parámetros de consulta desde URL (Deep Linking & Compartir)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const params = new URLSearchParams(window.location.search);
      const urlPestana = params.get("pestana");
      const urlModo = params.get("vista") || params.get("modo");
      const urlQ = params.get("q") || params.get("busqueda");
      const urlCat = params.get("categoria");
      const urlCanal = params.get("canal");
      const urlDestacados = params.get("destacados");
      const urlOfertas = params.get("ofertas");

      if (urlPestana === "catalogo" || urlPestana === "disponibilidad" || urlPestana === "convenios" || urlPestana === "empresas") {
        setPestanaActiva(urlPestana as any);
      }
      if (urlModo === "admin" || urlModo === "cliente") {
        setModoVista(urlModo);
      }
      if (urlQ) {
        setBusqueda(urlQ);
      }
      if (urlCat) {
        setCategoriaSeleccionada(urlCat);
      }
      if (urlCanal) {
        setCanalSeleccionado(urlCanal);
      }
      if (urlDestacados === "1" || urlDestacados === "true") {
        setSoloDestacados(true);
      }
      if (urlOfertas === "1" || urlOfertas === "true") {
        setSoloEnOferta(true);
      }
    }
  }, []);

  const cargarDatos = async () => {
    setCargando(true);
    try {
      const [prods, cats] = await Promise.all([
        obtenerCatalogoProductosAction(negocio, undefined, true), // Incluye inactivos para gestión de catálogo
        obtenerCategoriasAction(negocio),
      ]);
      const prodsSeguros = Array.isArray(prods) ? prods : [];
      setProductos(prodsSeguros);
      setCategoriasLista(Array.isArray(cats) ? cats : []);

      // Preseleccionar primera variante por defecto para cada producto
      const iniciales: Record<string, string> = {};
      prodsSeguros.forEach((p) => {
        if (p && Array.isArray(p.variantes) && p.variantes.length > 0 && p.variantes[0]) {
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

  // Alternar estado activo / inactivo de un producto en un clic con actualización optimista
  const handleAlternarActivo = async (proId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGuardandoActivoKey(proId);
    const prodActual = productos.find((p) => p.pro_id === proId);
    if (!prodActual) {
      setGuardandoActivoKey(null);
      return;
    }
    const nuevoActivo = prodActual.pro_activo === false ? true : false;

    // Actualización optimista inmediata en UI
    setProductos((prev) =>
      prev.map((p) => (p.pro_id === proId ? { ...p, pro_activo: nuevoActivo } : p))
    );

    try {
      const res = await alternarActivoProductoAction({
        pro_id: proId,
        activo: nuevoActivo,
        negocio,
      });

      if (res.ok && res.producto) {
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? res.producto! : p))
        );
      } else if (!res.ok) {
        // Rollback
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? prodActual : p))
        );
        alert(res.error || "No se pudo cambiar el estado del producto.");
      }
    } catch (err: any) {
      // Rollback
      setProductos((prev) =>
        prev.map((p) => (p.pro_id === proId ? prodActual : p))
      );
      alert(err.message || "Error al actualizar estado del producto.");
    } finally {
      setGuardandoActivoKey(null);
    }
  };

  // Alternar estado destacado de un producto en un clic con actualización optimista
  const handleAlternarDestacado = async (proId: string, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setGuardandoDestacadoKey(proId);
    const prodActual = productos.find((p) => p.pro_id === proId);
    if (!prodActual) {
      setGuardandoDestacadoKey(null);
      return;
    }
    const nuevoDestacado = !prodActual.pro_destacado;

    // Actualización optimista inmediata en UI
    setProductos((prev) =>
      prev.map((p) => (p.pro_id === proId ? { ...p, pro_destacado: nuevoDestacado } : p))
    );

    try {
      const res = await alternarDestacadoProductoAction({
        pro_id: proId,
        destacado: nuevoDestacado,
        negocio,
      });

      if (res.ok && res.producto) {
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? res.producto! : p))
        );
      } else if (!res.ok) {
        // Rollback
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? prodActual : p))
        );
        alert(res.error || "No se pudo cambiar el estado destacado.");
      }
    } catch (err: any) {
      // Rollback
      setProductos((prev) =>
        prev.map((p) => (p.pro_id === proId ? prodActual : p))
      );
      alert(err.message || "Error al actualizar estado destacado.");
    } finally {
      setGuardandoDestacadoKey(null);
    }
  };

  // Alternar canal de visibilidad de un producto con actualización optimista
  const handleAlternarCanal = async (proId: string, canal: CanalVisibilidad) => {
    const key = `${proId}_${canal}`;
    setGuardandoCanalKey(key);
    setMensajeErrorCanal(null);

    const prodActual = productos.find((p) => p.pro_id === proId);
    if (!prodActual) {
      setGuardandoCanalKey(null);
      return;
    }

    const canalesActuales: CanalVisibilidad[] = Array.isArray(prodActual.canales_visibilidad)
      ? [...prodActual.canales_visibilidad]
      : Array.isArray(prodActual.pro_detalle_producto?.canales_visibilidad)
      ? [...prodActual.pro_detalle_producto.canales_visibilidad]
      : [...CANALES_POR_DEFECTO];

    const estaActivo = canalesActuales.includes(canal);
    const nuevoEstado = !estaActivo;

    // Validación preventiva de imagen obligatoria
    if (nuevoEstado && CANALES_REQUIEREN_IMAGEN.includes(canal) && !productoTieneAlMenosUnaImagen(prodActual)) {
      const infoCanal = CANALES_CATALOGO_OFICIALES.find((c) => c.clave === canal);
      setMensajeErrorCanal(
        `📷 El canal "${infoCanal?.nombre || canal}" exige que el producto tenga al menos una foto (en portada, galería o variantes). Agrega una imagen antes de activarlo.`
      );
      setGuardandoCanalKey(null);
      return;
    }

    const nuevosCanales = nuevoEstado
      ? Array.from(new Set([...canalesActuales, canal]))
      : canalesActuales.filter((c) => c !== canal);

    // Actualización optimista inmediata en UI
    setProductos((prev) =>
      prev.map((p) =>
        p.pro_id === proId
          ? {
              ...p,
              canales_visibilidad: nuevosCanales,
              pro_detalle_producto: {
                ...(p.pro_detalle_producto || {}),
                canales_visibilidad: nuevosCanales,
              },
            }
          : p
      )
    );

    try {
      const res = await alternarCanalVisibilidadProductoAction({
        pro_id: proId,
        canal,
        activo: nuevoEstado,
        negocio,
      });

      if (res.ok && res.producto) {
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? res.producto! : p))
        );
      } else if (!res.ok) {
        // Rollback
        setProductos((prev) =>
          prev.map((p) => (p.pro_id === proId ? prodActual : p))
        );
        setMensajeErrorCanal(res.error || "No se pudo actualizar la visibilidad en el canal.");
      }
    } catch (err: any) {
      // Rollback
      setProductos((prev) =>
        prev.map((p) => (p.pro_id === proId ? prodActual : p))
      );
      setMensajeErrorCanal(err.message || "Error de conexión al actualizar canal.");
    } finally {
      setGuardandoCanalKey(null);
    }
  };

  // Compartir parámetros de consulta mediante URL
  const handleCompartirConsulta = () => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (pestanaActiva) url.searchParams.set("pestana", pestanaActiva);
    if (modoVista) url.searchParams.set("vista", modoVista);
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
    if (canalSeleccionado && canalSeleccionado !== "todos") {
      url.searchParams.set("canal", canalSeleccionado);
    } else {
      url.searchParams.delete("canal");
    }
    if (soloDestacados) {
      url.searchParams.set("destacados", "1");
    } else {
      url.searchParams.delete("destacados");
    }
    if (soloEnOferta) {
      url.searchParams.set("ofertas", "1");
    } else {
      url.searchParams.delete("ofertas");
    }

    // Actualizar historial del navegador sin recargar
    window.history.replaceState({}, "", url.toString());

    // Copiar al portapapeles
    if (navigator.clipboard) {
      navigator.clipboard.writeText(url.toString()).then(() => {
        setCopiadoConsulta(true);
        setTimeout(() => setCopiadoConsulta(false), 2500);
      }).catch(() => {
        prompt("Copia este enlace para compartir la consulta del catálogo:", url.toString());
      });
    } else {
      prompt("Copia este enlace para compartir la consulta del catálogo:", url.toString());
    }
  };

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

  const calcularPvpVariante = (v?: VarianteCatalogo | null): number => {
    if (!v) return 0;
    if (v.precio_total !== undefined && v.precio_total > 0) {
      return Number(v.precio_total);
    }
    return Number(
      (
        Number(v.var_precio || 0) *
        (1 + Number(v.var_tarifa_iva_porcentaje || 0) / 100)
      ).toFixed(2)
    );
  };

  const productoEstaEnOferta = (p: ProductoCatalogo): boolean => {
    if (!p) return false;
    const vars = Array.isArray(p.variantes) ? p.variantes : [];
    const tienePrecioTachado = vars.some((v) => {
      const pvpV = calcularPvpVariante(v);
      return Number(v.var_precio_comparacion || 0) > pvpV;
    });
    if (tienePrecioTachado) return true;

    if (p.pro_detalle_producto?.es_combo && vars.length > 0) {
      const comps = normalizarComponentesCombo(p.pro_detalle_producto?.combo_componentes);
      if (comps.length > 0) {
        const sumaNominal = comps.reduce((acc, comp) => {
          const prodHijo = (productos || []).find(
            (item) =>
              item.pro_id === comp.producto_id ||
              (comp.producto_slug && item.pro_slug === comp.producto_slug)
          );
          const varHijo =
            prodHijo?.variantes.find(
              (vh) =>
                (comp.variante_id && vh.var_id === comp.variante_id) ||
                (comp.variante_sku && vh.var_sku === comp.variante_sku)
            ) || prodHijo?.variantes[0];
          return acc + calcularPvpVariante(varHijo) * comp.cantidad_base;
        }, 0);
        const pvpMinCombo = Math.min(...vars.map((v) => calcularPvpVariante(v)));
        if (sumaNominal > pvpMinCombo) return true;
      }
    }
    return false;
  };

  const totalInactivos = (productos || []).filter((p) => p && p.pro_activo === false).length;
  const totalActivos = (productos || []).filter((p) => p && p.pro_activo !== false).length;
  const totalDestacados = (productos || []).filter((p) => p && Boolean(p.pro_destacado)).length;
  const totalEnOferta = (productos || []).filter((p) => p && productoEstaEnOferta(p)).length;
  const totalMeGustaGlobal = (productos || []).reduce(
    (acc, p) => acc + Math.max(0, Number(p?.pro_total_me_gusta ?? 0) || 0),
    0
  );
  const [ordenarPorMeGusta, setOrdenarPorMeGusta] = useState<boolean>(false);

  // Filtrado y ordenamiento (en Configuración siempre muestra primero los productos más recientemente creados)
  const normalizarTextoFiltro = (valor: unknown): string =>
    String(valor ?? "")
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .replace(/[_/\\|•·—–#-]+/g, " ")
      .replace(/[^a-z0-9]+/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const tokenCoincideConTexto = (token: string, corpus: string): boolean => {
    if (!token) return true;
    if (corpus.includes(token)) return true;
    if (token.endsWith("ces") && token.length > 4 && corpus.includes(`${token.slice(0, -3)}z`)) {
      return true;
    }
    if (token.endsWith("es") && token.length > 4 && corpus.includes(token.slice(0, -2))) {
      return true;
    }
    if (token.endsWith("s") && token.length > 3 && corpus.includes(token.slice(0, -1))) {
      return true;
    }
    return false;
  };

  const obtenerEtiquetasProducto = (p: ProductoCatalogo): string[] => {
    const raw = p.pro_detalle_producto?.etiquetas;
    const lista = Array.isArray(raw)
      ? raw
      : typeof raw === "string"
      ? String(raw).split(",")
      : [];
    return lista
      .map((item: unknown) => String(item).replace(/^#+/, "").trim())
      .filter((item: string) => item.length > 0);
  };

  const productosBasePorAmbito = (productos || []).filter((p) => {
    if (!p) return false;

    // En vista de cliente, ocultar productos inactivos o fuera de temporada
    if (modoVista === "cliente") {
      if (p.pro_activo === false) return false;
      const vig = evaluarVigenciaProducto(p.pro_detalle_producto, p.pro_activo);
      if (!vig.estaVigente) return false;
    } else {
      if (filtroEstadoAdmin === "activos" && p.pro_activo === false) return false;
      if (filtroEstadoAdmin === "inactivos" && p.pro_activo !== false) return false;
      if (soloDestacados && !p.pro_destacado) return false;
      if (soloEnOferta && !productoEstaEnOferta(p)) return false;
    }

    const queryNorm = normalizarTextoFiltro(busqueda);
    let cumpleBusqueda = true;
    if (queryNorm) {
      const det = p.pro_detalle_producto || {};
      const etiquetas = obtenerEtiquetasProducto(p);
      const usos = Array.isArray(det.usos) ? det.usos : Array.isArray(det.ocasiones) ? det.ocasiones : [];
      const textosVariantes = Array.isArray(p.variantes)
        ? p.variantes.flatMap((v) => [v.var_nombre, v.var_sku, v.var_detalle_variante?.detalle])
        : [];
      const corpus = normalizarTextoFiltro(
        [
          p.pro_nombre,
          p.pro_slug,
          p.pro_descripcion,
          det.descripcion_corta,
          p.categoria?.ctg_nombre,
          ...etiquetas,
          ...usos,
          ...textosVariantes,
        ]
          .filter(Boolean)
          .join(" ")
      );
      const tokens = queryNorm.split(" ").filter(Boolean);
      cumpleBusqueda =
        tokenCoincideConTexto(queryNorm, corpus) ||
        tokens.every((tok) => tokenCoincideConTexto(tok, corpus));
    }

    const cumpleCategoria =
      categoriaSeleccionada === "todas" ||
      (p.categoria && p.categoria.ctg_slug === categoriaSeleccionada);

    const canales = p.canales_visibilidad || p.pro_detalle_producto?.canales_visibilidad || CANALES_POR_DEFECTO;
    const cumpleCanal =
      canalSeleccionado === "todos" ||
      (verTodosEnFiltroCanal ? true : canales.includes(canalSeleccionado as CanalVisibilidad));

    return cumpleBusqueda && cumpleCategoria && cumpleCanal;
  });

  const etiquetasDisponiblesCatalogo = useMemo(() => {
    const mapa = new Map<string, { etiqueta: string; cantidad: number; prio: number }>();
    for (const p of productosBasePorAmbito) {
      const etiquetas = obtenerEtiquetasProducto(p);
      const vistasProd = new Set<string>();
      for (const raw of etiquetas) {
        const clave = normalizarTextoFiltro(raw);
        if (!clave || vistasProd.has(clave)) continue;
        vistasProd.add(clave);
        const prio = /[A-ZÁÉÍÓÚÑáéíóúñ]/.test(raw) ? 1 : 0;
        const actual = mapa.get(clave);
        if (!actual) {
          mapa.set(clave, { etiqueta: raw, cantidad: 1, prio });
        } else {
          actual.cantidad += 1;
          if (prio > actual.prio) {
            actual.etiqueta = raw;
            actual.prio = prio;
          }
        }
      }
    }
    const lista = Array.from(mapa.entries())
      .map(([clave, info]) => ({ clave, etiqueta: info.etiqueta, cantidad: info.cantidad }))
      .sort((a, b) => (b.cantidad !== a.cantidad ? b.cantidad - a.cantidad : a.etiqueta.localeCompare(b.etiqueta, "es")));

    if (etiquetasActivas.length === 0) return lista;
    const existentes = new Set(lista.map((i) => i.clave));
    const extras = etiquetasActivas
      .filter((cl) => !existentes.has(cl))
      .map((cl) => ({ clave: cl, etiqueta: cl, cantidad: 0 }));
    return [...extras, ...lista];
  }, [productosBasePorAmbito, etiquetasActivas]);

  const productosFiltradosBase =
    etiquetasActivas.length === 0
      ? productosBasePorAmbito
      : productosBasePorAmbito.filter((p) => {
          const etNorms = obtenerEtiquetasProducto(p).map((e) => normalizarTextoFiltro(e)).filter(Boolean);
          if (etNorms.length === 0) return false;
          return etiquetasActivas.every((cl) => {
            const tokensCl = cl.split(" ").filter(Boolean);
            return etNorms.some(
              (et) =>
                et === cl ||
                tokenCoincideConTexto(cl, et) ||
                (tokensCl.length > 0 && tokensCl.every((t) => tokenCoincideConTexto(t, et)))
            );
          });
        });

  const productosFiltrados = ordenarPorMeGusta
    ? [...productosFiltradosBase].sort((a, b) => {
        const likesA = Math.max(0, Number(a.pro_total_me_gusta ?? 0) || 0);
        const likesB = Math.max(0, Number(b.pro_total_me_gusta ?? 0) || 0);
        if (likesA !== likesB) return likesB - likesA;
        const tsA = a.pro_creado_en ? new Date(a.pro_creado_en).getTime() : 0;
        const tsB = b.pro_creado_en ? new Date(b.pro_creado_en).getTime() : 0;
        return tsB - tsA;
      })
    : modoVista === "admin"
    ? [...productosFiltradosBase].sort((a, b) => {
        const tsA = a.pro_creado_en ? new Date(a.pro_creado_en).getTime() : 0;
        const tsB = b.pro_creado_en ? new Date(b.pro_creado_en).getTime() : 0;
        if (tsA !== tsB) return tsB - tsA;
        const seqA = Number(a.pro_secuencial ?? 0);
        const seqB = Number(b.pro_secuencial ?? 0);
        if (seqA !== seqB) return seqB - seqA;
        return 0;
      })
    : productosFiltradosBase;

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
      return <Scale size={24} color="#221E1B" />;
    }
    if (iconoTipo === "ShieldCheck" || p.pro_slug.includes("plan") || p.pro_slug.includes("proteccion")) {
      return <ShieldCheck size={24} color="#2F4737" />;
    }
    if (iconoTipo === "FileCheck" || p.pro_slug.includes("dictamen") || p.pro_slug.includes("contrato")) {
      return <FileCheck size={24} color="#4A453F" />;
    }
    return <CreditCard size={24} color="#8F6A2E" />;
  };

  return (
    <div style={{ padding: esModoMovil ? "2px 0" : "6px 0" }}>
      {/* Estilos responsivos y rieles horizontales deslizables */}
      <style>{`
        @media (max-width: 640px) {
          .catalogo-solo-pantalla-grande,
          .catalogo-solo-escritorio {
            display: none !important;
          }
        }
        .catalogo-riel-deslizable {
          display: flex;
          flex-wrap: nowrap;
          overflow-x: auto;
          -webkit-overflow-scrolling: touch;
          scrollbar-width: none;
          scroll-snap-type: x proximity;
        }
        .catalogo-riel-deslizable::-webkit-scrollbar {
          display: none;
        }
        @keyframes ecoGiroCatalogo {
          to { transform: rotate(360deg); }
        }
        .eco-icono-girando {
          animation: ecoGiroCatalogo 0.9s linear infinite;
        }
      `}</style>

      {/* Cabecera compacta del Catálogo y Barra Lineal Deslizable de Acciones */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: esModoMovil ? "10px" : "14px",
          flexWrap: "wrap",
          gap: esModoMovil ? "8px" : "12px",
        }}
      >
        <h1
          style={{
            margin: 0,
            fontSize: esModoMovil ? "0.98rem" : "1.08rem",
            fontWeight: 700,
            color: "var(--ct-1f1c19, #1F1C19)",
            lineHeight: 1.25,
          }}
        >
          {esFloristeria
            ? "Catálogo Comercial"
            : esMantenimiento
            ? "Catálogo de Servicios"
            : "Catálogo Comercial"}
        </h1>

        {/* Barra de acciones en riel lineal deslizable (sin botones Guía ni Actualizar en ninguna pantalla) */}
        <div
          className="catalogo-riel-deslizable"
          style={{
            gap: "6px",
            alignItems: "center",
            maxWidth: "100%",
            width: esModoMovil ? "100%" : "auto",
            paddingBottom: "2px",
          }}
        >
          <div
            style={{
              display: "inline-flex",
              background: "var(--cf-f4f2ee, #F4F2EE)",
              padding: "3px",
              borderRadius: "9px",
              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
              flexShrink: 0,
            }}
          >
            <button
              type="button"
              onClick={() => setModoVista("admin")}
              title="Modo Configuración (Crear y editar productos)"
              style={{
                padding: esModoMovil ? "6px 10px" : "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: modoVista === "admin" ? "#1F1C19" : "transparent",
                color: modoVista === "admin" ? "#FFFFFF" : "#57524C",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                whiteSpace: "nowrap",
                flexShrink: 0,
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
                padding: esModoMovil ? "6px 10px" : "6px 12px",
                borderRadius: "7px",
                border: "none",
                background: modoVista === "cliente" ? "#221E1B" : "transparent",
                color: modoVista === "cliente" ? "#FFFFFF" : "#57524C",
                fontSize: "0.78rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.15s ease",
              }}
            >
              <Eye size={13} />
              <span>Vista Cliente</span>
            </button>
          </div>

          {modoVista === "admin" && (
            <>
              <button
                type="button"
                onClick={() => setModalProdAbierto(true)}
                className="btn-responsive-accion"
                title={esFloristeria ? "Crear Nuevo Arreglo Floral" : "Crear Nuevo Producto"}
                aria-label={esFloristeria ? "Nuevo Arreglo" : "Nuevo Producto"}
                style={{
                  background: "#221E1B",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <Plus size={15} />
                <span className="btn-texto-responsive">
                  {esFloristeria ? "Nuevo Arreglo" : esMantenimiento ? "Nuevo Servicio" : "Nuevo Honorario"}
                </span>
              </button>

              <button
                type="button"
                onClick={() => setModalMasivoAbierto(true)}
                className="btn-responsive-accion"
                title="Ver, exportar a Markdown / Excel o importar actualización masiva de productos"
                aria-label="Exportar Catálogo"
                style={{
                  background: "var(--cf-eaf3ed, #EAF3ED)",
                  color: "var(--ct-1f352c, #1F352C)",
                  border: "1px solid var(--cb-c6dec9, #C6DEC9)",
                  padding: "7px 12px",
                  borderRadius: "8px",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                }}
              >
                <FileSpreadsheet size={14} color="#2F4737" />
                <span className="btn-texto-responsive">Exportar / Masivo</span>
              </button>

              {!esModoMovil && (
                <>
                  {/* Botón unificado para Nueva Colección + Gestionar Colecciones (solo PC y Tablet) */}
                  <button
                    type="button"
                    onClick={() => {
                      setCatModalTab("gestionar");
                      setModalCatAbierto(true);
                    }}
                    className="btn-responsive-accion catalogo-solo-pantalla-grande"
                    title={
                      esFloristeria
                        ? "Crear y gestionar colecciones del catálogo"
                        : "Crear y gestionar categorías del catálogo"
                    }
                    aria-label={esFloristeria ? "Colecciones" : "Categorías"}
                    style={{
                      background: "var(--cf-ffffff, #FFFFFF)",
                      color: "var(--ct-57524c, #57524C)",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <FolderPlus size={14} />
                    <span className="btn-texto-responsive">
                      {esFloristeria ? "Colecciones" : "Categorías"}
                    </span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setModalTiposOfertaAbierto(true)}
                    className="btn-responsive-accion catalogo-solo-pantalla-grande"
                    title="Administrar Tipos de Oferta Comercial (Venta, Decoración, Renta de Mobiliario, etc.)"
                    aria-label="Tipos Oferta"
                    style={{
                      background: "var(--cf-faf6ee, #FAF6EE)",
                      color: "var(--ct-745622, #745622)",
                      border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                      padding: "7px 11px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <Tag size={14} color="#8F6A2E" />
                    <span className="btn-texto-responsive">Tipos Oferta</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      if (typeof window !== "undefined") {
                        window.location.href = "/panel/administrar?widget=gestion_convenios_corporativos";
                      }
                    }}
                    className="btn-responsive-accion catalogo-solo-pantalla-grande"
                    title="Ver y Gestionar Convenios Corporativos y Beneficios B2B (SATCOM)"
                    aria-label="Convenios B2B"
                    style={{
                      background: "var(--cf-f2f6f3, #F2F6F3)",
                      color: "var(--ct-2f4737, #2F4737)",
                      border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                      padding: "7px 12px",
                      borderRadius: "8px",
                      fontSize: "0.8rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                    }}
                  >
                    <Building2 size={14} />
                    <span className="btn-texto-responsive">Convenios B2B</span>
                  </button>
                </>
              )}
            </>
          )}

          {!esModoMovil && (
            <button
              type="button"
              onClick={handleCompartirConsulta}
              className="btn-responsive-accion catalogo-solo-pantalla-grande"
              title="Copiar enlace con los filtros y parámetros de consulta del catálogo"
              aria-label="Compartir"
              style={{
                background: copiadoConsulta ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-f8f7f4, #F8F7F4)",
                color: copiadoConsulta ? "var(--ct-2f4737, #2F4737)" : "var(--ct-57524c, #57524C)",
                border: copiadoConsulta ? "1px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                padding: "7px 12px",
                borderRadius: "8px",
                fontSize: "0.8rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                whiteSpace: "nowrap",
                flexShrink: 0,
                transition: "all 0.2s ease",
              }}
            >
              {copiadoConsulta ? (
                <CheckCircle size={14} color="#2F4737" />
              ) : (
                <Share2 size={14} color="#221E1B" />
              )}
              <span className="btn-texto-responsive">
                {copiadoConsulta ? "¡Copiado!" : "Compartir"}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Banner Compacto de Beneficios Corporativos (si el cliente está vinculado a un convenio) */}
      <div style={{ marginBottom: esModoMovil ? "8px" : "12px" }}>
        <TarjetaBeneficiosCorporativosCliente negocio={negocio} ocultarSiNoTiene={true} variante="banner_compacto" />
      </div>

      {/* Selector de Pestaña: oculto en móvil y eliminado en Floristería (Catálogo / Disponibilidad ya tiene módulo propio) */}
      {!esModoMovil && !esFloristeria && (
        <div
          className="catalogo-solo-pantalla-grande catalogo-riel-deslizable"
          style={{
            gap: "6px",
            borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
            marginBottom: "14px",
            paddingBottom: "8px",
            alignItems: "center",
          }}
        >
          <button
            type="button"
            onClick={() => setPestanaActiva("catalogo")}
            style={{
              background: pestanaActiva === "catalogo" ? "#221E1B" : "transparent",
              color: pestanaActiva === "catalogo" ? "#FFFFFF" : "#847D74",
              border: "none",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
          >
            <LayoutGrid size={14} />
            <span>{esMantenimiento ? "Servicios y Tarifas" : "Honorarios y Planes"}</span>
          </button>

          {esLegal && (
            <>
              <button
                type="button"
                onClick={() => setPestanaActiva("empresas")}
                style={{
                  background: pestanaActiva === "empresas" ? "#5000BA" : "transparent",
                  color: pestanaActiva === "empresas" ? "#FFFFFF" : "#847D74",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                <Building2 size={14} />
                <span>Oferta Corporativa</span>
              </button>

              <button
                type="button"
                onClick={() => setPestanaActiva("convenios")}
                style={{
                  background: pestanaActiva === "convenios" ? "#2F4737" : "transparent",
                  color: pestanaActiva === "convenios" ? "#FFFFFF" : "#847D74",
                  border: "none",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  whiteSpace: "nowrap",
                  flexShrink: 0,
                  transition: "all 0.15s ease",
                }}
              >
                <Users size={14} />
                <span>Convenios B2B</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setPestanaActiva("disponibilidad")}
            style={{
              background: pestanaActiva === "disponibilidad" ? "#221E1B" : "transparent",
              color: pestanaActiva === "disponibilidad" ? "#FFFFFF" : "#847D74",
              border: "none",
              padding: "7px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              whiteSpace: "nowrap",
              flexShrink: 0,
              transition: "all 0.15s ease",
            }}
          >
            <Activity size={14} />
            <span>
              {esMantenimiento ? "Cuadrillas y Zonas" : "Disponibilidad"}
            </span>
          </button>
        </div>
      )}

      {pestanaActiva === "convenios" && !esFloristeria ? (
        <div style={{ width: "100%" }}>
          <GestionConveniosCorporativos negocio={negocio} />
        </div>
      ) : pestanaActiva === "empresas" && !esFloristeria ? (
        <div style={{ width: "100%" }}>
          <VitrinaComercialVisual negocio={negocio} filtroAudiencia="empresas" />
        </div>
      ) : pestanaActiva === "disponibilidad" && !esFloristeria ? (
        <TableroDisponibilidadOperativa negocio={negocio} />
      ) : (
        <>
          {/* Barra de Búsqueda y Rieles Lineales Deslizables de Filtros */}
          <div
            style={{
              background: "var(--cf-ffffff, #FFFFFF)",
              border: "1px solid var(--cb-e6e2da, #E6E2DA)",
              borderRadius: "14px",
              padding: esModoMovil ? "10px" : "14px",
              marginBottom: esModoMovil ? "12px" : "18px",
              display: "flex",
              flexDirection: "column",
              gap: esModoMovil ? "8px" : "10px",
            }}
          >
            <div style={{ position: "relative", width: "100%" }}>
              <Search size={15} color="#847D74" style={{ position: "absolute", left: "11px", top: "50%", transform: "translateY(-50%)" }} />
              <input
                type="text"
                placeholder={
                  esFloristeria
                    ? "Buscar arreglo, etiqueta (#orquídeas), flor, ocasión o SKU..."
                    : esMantenimiento
                    ? "Buscar servicio, etiqueta, tarifa o palabra clave..."
                    : "Buscar servicio, etiqueta, honorario, plan o palabra clave..."
                }
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                style={{
                  width: "100%",
                  minHeight: "38px",
                  padding: "7px 12px 7px 34px",
                  borderRadius: "9px",
                  border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                  fontSize: "0.84rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            {/* Riel lineal deslizable: Estado (Todos / Activos / Inactivos) + Canal (vista Administrador) */}
            {modoVista === "admin" && (
              <div
                className="catalogo-riel-deslizable"
                style={{
                  gap: "6px",
                  alignItems: "center",
                  width: "100%",
                  paddingBottom: "2px",
                }}
              >
                <button
                  type="button"
                  onClick={() => setFiltroEstadoAdmin("todos")}
                  title="Mostrar productos activos e inactivos"
                  aria-label="Todos los estados"
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    border: filtroEstadoAdmin === "todos" ? "1.5px solid var(--cb-1f1c19, #1F1C19)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: filtroEstadoAdmin === "todos" ? "#1F1C19" : "var(--cf-ffffff, #FFFFFF)",
                    color: filtroEstadoAdmin === "todos" ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  }}
                >
                  Todos ({productos.length})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoAdmin("activos")}
                  title="Mostrar solo productos activos en tienda"
                  aria-label="Productos activos"
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    border: filtroEstadoAdmin === "activos" ? "1.5px solid #2F4737" : "1px solid var(--cb-ceddd3, #CEDDD3)",
                    background: filtroEstadoAdmin === "activos" ? "#2F4737" : "var(--cf-f2f6f3, #F2F6F3)",
                    color: filtroEstadoAdmin === "activos" ? "#FFFFFF" : "var(--ct-2b4a36, #2B4A36)",
                  }}
                >
                  Activos ({totalActivos})
                </button>
                <button
                  type="button"
                  onClick={() => setFiltroEstadoAdmin("inactivos")}
                  title="Mostrar productos inactivos para volver a activarlos"
                  aria-label="Productos inactivos"
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    border:
                      filtroEstadoAdmin === "inactivos"
                        ? "1.5px solid #8A2E2E"
                        : totalInactivos > 0
                        ? "1.5px solid #8F6A2E"
                        : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background:
                      filtroEstadoAdmin === "inactivos"
                        ? "#8A2E2E"
                        : totalInactivos > 0
                        ? "var(--cf-faf6ee, #FAF6EE)"
                        : "var(--cf-f8f7f4, #F8F7F4)",
                    color:
                      filtroEstadoAdmin === "inactivos"
                        ? "#FFFFFF"
                        : totalInactivos > 0
                        ? "var(--ct-745622, #745622)"
                        : "var(--ct-847d74, #847D74)",
                  }}
                >
                  Inactivos ({totalInactivos})
                </button>

                <button
                  type="button"
                  onClick={() => setSoloDestacados((prev) => !prev)}
                  title="Filtrar solo productos marcados como destacados"
                  aria-label="Filtrar solo destacados"
                  aria-pressed={soloDestacados}
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: soloDestacados ? "1.5px solid #8F6A2E" : "1px solid var(--cb-e5d7bc, #E5D7BC)",
                    background: soloDestacados ? "#8F6A2E" : "var(--cf-faf6ee, #FAF6EE)",
                    color: soloDestacados ? "#FFFFFF" : "var(--ct-745622, #745622)",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Sparkles size={13} color={soloDestacados ? "#FFFFFF" : "#8F6A2E"} />
                  <span>Destacados ({totalDestacados})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setSoloEnOferta((prev) => !prev)}
                  title="Filtrar solo productos con precio de oferta o descuento de set"
                  aria-label="Filtrar solo en oferta"
                  aria-pressed={soloEnOferta}
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: soloEnOferta ? "1.5px solid #B91C1C" : "1px solid var(--cb-fecaca, #FECACA)",
                    background: soloEnOferta ? "#B91C1C" : "var(--cf-fef2f2, #FEF2F2)",
                    color: soloEnOferta ? "#FFFFFF" : "var(--ct-991b1b, #991B1B)",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Tag size={13} color={soloEnOferta ? "#FFFFFF" : "#B91C1C"} />
                  <span>En oferta ({totalEnOferta})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setOrdenarPorMeGusta((prev) => !prev)}
                  title="Ordenar del producto más deseado (más Me gusta) al menos votado"
                  aria-label="Ordenar por más deseados"
                  aria-pressed={ordenarPorMeGusta}
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    border: ordenarPorMeGusta ? "1.5px solid #BE123C" : "1px solid var(--cb-fbcfe8, #FBCFE8)",
                    background: ordenarPorMeGusta ? "#BE123C" : "var(--cf-fff1f2, #FFF1F2)",
                    color: ordenarPorMeGusta ? "#FFFFFF" : "var(--ct-be123c, #BE123C)",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                    transition: "all 0.15s ease",
                  }}
                >
                  <Heart size={13} fill="currentColor" />
                  <span>Más deseados ({totalMeGustaGlobal})</span>
                </button>

                <div style={{ flexShrink: 0, scrollSnapAlign: "start" }}>
                  <SelectConBuscador
                    value={canalSeleccionado}
                    onChange={(e) => {
                      setCanalSeleccionado(e.target.value);
                      if (e.target.value === "todos") setVerTodosEnFiltroCanal(false);
                    }}
                    aria-label="Filtrar por canal de visibilidad"
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: canalSeleccionado !== "todos" ? "1.5px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      background: canalSeleccionado !== "todos" ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-f8f7f4, #F8F7F4)",
                      color: canalSeleccionado !== "todos" ? "var(--ct-3a3530, #3A3530)" : "var(--ct-1f1c19, #1F1C19)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                    }}
                  >
                    <option value="todos">Canales ({productos.length})</option>
                    {CANALES_CATALOGO_OFICIALES.map((c) => {
                      const count = (productos || []).filter((p) =>
                        (p.canales_visibilidad || p.pro_detalle_producto?.canales_visibilidad || CANALES_POR_DEFECTO).includes(c.clave)
                      ).length;
                      return (
                        <option key={c.clave} value={c.clave}>
                          {c.nombre} ({count})
                        </option>
                      );
                    })}
                  </SelectConBuscador>
                </div>

                {canalSeleccionado !== "todos" && (
                  <button
                    type="button"
                    onClick={() => setVerTodosEnFiltroCanal((prev) => !prev)}
                    className="btn-responsive-accion"
                    title={
                      verTodosEnFiltroCanal
                        ? "Mostrando todos los productos para activar/desactivar con el check. Clic para volver a ver solo los activos."
                        : "Clic para ver todos los productos y activar o desactivar su visibilidad en este canal usando el check de cada tarjeta."
                    }
                    aria-label="Ver todos en canal"
                    style={{
                      padding: "6px 10px",
                      borderRadius: "8px",
                      border: verTodosEnFiltroCanal ? "1.5px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      background: verTodosEnFiltroCanal ? "#221E1B" : "var(--cf-ffffff, #FFFFFF)",
                      color: verTodosEnFiltroCanal ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                      fontSize: "0.76rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "5px",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      transition: "all 0.15s ease",
                    }}
                  >
                    {verTodosEnFiltroCanal ? <CheckSquare size={13} /> : <Eye size={13} />}
                    <span className="btn-texto-responsive">
                      {verTodosEnFiltroCanal ? `Todos (${productos.length})` : "Ver Todos"}
                    </span>
                  </button>
                )}
              </div>
            )}

            {/* Riel lineal deslizable de categorías / colecciones */}
            <div
              className="catalogo-riel-deslizable"
              style={{
                gap: "6px",
                width: "100%",
                paddingBottom: "2px",
                alignItems: "center",
              }}
            >
              <button
                type="button"
                onClick={() => setCategoriaSeleccionada("todas")}
                style={{
                  padding: esModoMovil ? "7px 12px" : "6px 13px",
                  borderRadius: "8px",
                  fontSize: "0.78rem",
                  fontWeight: 600,
                  cursor: "pointer",
                  border: "none",
                  flexShrink: 0,
                  whiteSpace: "nowrap",
                  scrollSnapAlign: "start",
                  background: categoriaSeleccionada === "todas" ? "#1F1C19" : "var(--cf-f4f2ee, #F4F2EE)",
                  color: categoriaSeleccionada === "todas" ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
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
                    padding: esModoMovil ? "7px 12px" : "6px 13px",
                    borderRadius: "8px",
                    fontSize: "0.78rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    border: "none",
                    flexShrink: 0,
                    whiteSpace: "nowrap",
                    scrollSnapAlign: "start",
                    background: categoriaSeleccionada === c.ctg_slug ? "#221E1B" : "var(--cf-f4f2ee, #F4F2EE)",
                    color: categoriaSeleccionada === c.ctg_slug ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                  }}
                >
                  {c.ctg_nombre}
                </button>
              ))}

              {modoVista === "admin" && !esModoMovil && (
                <button
                  type="button"
                  onClick={() => {
                    setCatModalTab("gestionar");
                    setModalCatAbierto(true);
                  }}
                  className="catalogo-solo-pantalla-grande"
                  title={
                    esFloristeria
                      ? "Crear y gestionar colecciones florales"
                      : "Crear y gestionar categorías"
                  }
                  aria-label={esFloristeria ? "Colecciones" : "Categorías"}
                  style={{
                    padding: "6px 11px",
                    borderRadius: "8px",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    border: "1.5px dashed var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-221e1b, #221E1B)",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                    scrollSnapAlign: "start",
                  }}
                >
                  <FolderPlus size={13} />
                  <span>{esFloristeria ? "Colecciones" : "Categorías"}</span>
                </button>
              )}
            </div>

            {/* Riel deslizable de etiquetas semánticas de búsqueda (Keywords IA) */}
            {etiquetasDisponiblesCatalogo.length > 0 && (
              <div
                className="catalogo-riel-deslizable"
                style={{
                  gap: "6px",
                  width: "100%",
                  paddingBottom: "2px",
                  alignItems: "center",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    color: "var(--ct-847d74, #847D74)",
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    whiteSpace: "nowrap",
                    flexShrink: 0,
                  }}
                >
                  <Tag size={12} />
                  <span>Etiquetas:</span>
                </span>
                {etiquetasDisponiblesCatalogo.map((item) => {
                  const activa = etiquetasActivas.includes(item.clave);
                  return (
                    <button
                      key={item.clave}
                      type="button"
                      aria-pressed={activa}
                      onClick={() =>
                        setEtiquetasActivas((prev) =>
                          prev.includes(item.clave)
                            ? prev.filter((k) => k !== item.clave)
                            : [...prev, item.clave]
                        )
                      }
                      title={
                        activa
                          ? `Quitar filtro #${item.etiqueta}`
                          : `Filtrar por etiqueta #${item.etiqueta}`
                      }
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "4px 10px",
                        borderRadius: "7px",
                        fontSize: "0.75rem",
                        fontWeight: 600,
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        flexShrink: 0,
                        scrollSnapAlign: "start",
                        border: activa ? "1.5px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        background: activa ? "#2F4737" : "var(--cf-ffffff, #FFFFFF)",
                        color: activa ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                      }}
                    >
                      <Hash size={11} />
                      <span>{item.etiqueta}</span>
                      {activa && <X size={11} />}
                    </button>
                  );
                })}
                {etiquetasActivas.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setEtiquetasActivas([])}
                    title="Limpiar filtro de etiquetas"
                    aria-label="Limpiar etiquetas"
                    style={{
                      padding: "4px 9px",
                      borderRadius: "7px",
                      fontSize: "0.73rem",
                      fontWeight: 600,
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      border: "1px dashed var(--cb-b8b0a4, #B8B0A4)",
                      background: "transparent",
                      color: "var(--ct-57524c, #57524C)",
                    }}
                  >
                    Limpiar
                  </button>
                )}
              </div>
            )}
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
              background: "#221E1B",
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
                    background: esFloristeria ? "#221E1B" : "#221E1B",
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
                <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800 }}>{catActiva.ctg_nombre}</h2>
              </div>
              {catActiva.ctg_descripcion && (
                <p style={{ margin: "4px 0 0", fontSize: "0.83rem", color: "#D5CFC4", lineHeight: 1.4 }}>
                  {catActiva.ctg_descripcion}
                </p>
              )}
            </div>

            {/* Acciones de Recursos Digitales de la Categoría */}
            <div className="catalogo-riel-deslizable" style={{ gap: "6px", maxWidth: "100%", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => {
                  const urlCatPublica = construirEnlaceCategoriaTienda({
                    negocio,
                    slugCategoria: catActiva.ctg_slug || catActiva.ctg_nombre,
                    baseUrl: URL_TIENDA_POR_NEGOCIO[negocio],
                  });
                  copiarLinkPublicoTienda(`cat_${catActiva.ctg_id}`, urlCatPublica);
                }}
                className="btn-responsive-accion"
                title={`Copiar link directo de la categoría "${catActiva.ctg_nombre}" para compartir por WhatsApp o Chat`}
                aria-label={`Copiar link directo de la categoría ${catActiva.ctg_nombre}`}
                style={{
                  background:
                    linkTiendaCopiadoKey === `cat_${catActiva.ctg_id}`
                      ? "rgba(5, 150, 105, 0.95)"
                      : "rgba(255, 255, 255, 0.2)",
                  backdropFilter: "blur(4px)",
                  color: "#FFFFFF",
                  border:
                    linkTiendaCopiadoKey === `cat_${catActiva.ctg_id}`
                      ? "1px solid var(--cb-7ea389, #7EA389)"
                      : "1px solid var(--cb-ffffff-a380, rgba(255, 255, 255, 0.38))",
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
                {linkTiendaCopiadoKey === `cat_${catActiva.ctg_id}` ? (
                  <>
                    <CheckCircle2 size={13} color="#FFFFFF" />
                    <span className="btn-texto-responsive">Copiado</span>
                  </>
                ) : (
                  <>
                    <Link2 size={13} color="#C8A25A" />
                    <span className="btn-texto-responsive">Link Tienda</span>
                  </>
                )}
              </button>
              {videoCat && (
                <button
                  type="button"
                  onClick={() => setVideoModalUrl(videoCat)}
                  style={{
                    background: "rgba(255, 255, 255, 0.15)",
                    backdropFilter: "blur(4px)",
                    color: "#FFFFFF",
                    border: "1px solid var(--cb-ffffff-a300, rgba(255, 255, 255, 0.3))",
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
                  <Play size={13} color="#C8A25A" />
                  <span>Ver Reel / Video</span>
                </button>
              )}
              {albumCat && (
                <a
                  href={albumCat}
                  target="_blank"
                  rel="noreferrer"
                  style={{
                    background: "var(--cf-ffffff-a950, rgba(255, 255, 255, 0.95))",
                    color: "var(--ct-1f1c19, #1F1C19)",
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

      {/* Mensaje de Feedback o Advertencia de Canales */}
      {mensajeErrorCanal && (
        <div
          style={{
            background: "var(--cf-faf2f2, #FAF2F2)",
            border: "1px solid var(--cb-e5caca, #E5CACA)",
            color: "var(--ct-8a2e2e, #8A2E2E)",
            padding: "10px 16px",
            borderRadius: "10px",
            marginBottom: "16px",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            fontSize: "0.82rem",
            fontWeight: 600,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertCircle size={16} color="#8A2E2E" />
            <span>{mensajeErrorCanal}</span>
          </div>
          <button
            type="button"
            onClick={() => setMensajeErrorCanal(null)}
            style={{
              background: "none",
              border: "none",
              color: "var(--ct-8a2e2e, #8A2E2E)",
              cursor: "pointer",
              padding: "2px",
            }}
          >
            <X size={15} />
          </button>
        </div>
      )}

      {/* Grid de Productos */}
      {cargando ? (
        <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--ct-847d74, #847D74)" }}>
          <RefreshCw size={32} className="eco-icono-girando" style={{ margin: "0 auto 12px", color: "var(--ct-221e1b, #221E1B)" }} />
          <div style={{ fontWeight: 600 }}>Cargando catálogo comercial unificado...</div>
        </div>
      ) : productosFiltrados.length === 0 ? (
        <div
          style={{
            background: "var(--cf-ffffff, #FFFFFF)",
            border: "1px dashed var(--cb-d5cfc4, #D5CFC4)",
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
              background: "var(--cf-f4f2ee, #F4F2EE)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              margin: "0 auto 16px",
              color: "var(--ct-847d74, #847D74)",
            }}
          >
            <ShoppingBag size={28} />
          </div>
          <h3 style={{ margin: "0 0 6px", fontSize: "0.92rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)" }}>
            No se encontraron productos o servicios
          </h3>
          <p style={{ margin: "0 auto 20px", fontSize: "0.85rem", color: "var(--ct-847d74, #847D74)", maxWidth: "420px" }}>
            Puedes crear un nuevo honorario profesional o cargar inmediatamente el catálogo de ejemplo con tarifas y planes preconfigurados.
          </p>
          <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
            {modoVista === "admin" && (
              <button
                type="button"
                onClick={() => setModalProdAbierto(true)}
                style={{
                  background: "#1F1C19",
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
                background: "#221E1B",
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
            gridTemplateColumns:
              modoVista === "admin"
                ? "repeat(auto-fill, minmax(min(340px, 100%), 1fr))"
                : "repeat(auto-fill, minmax(min(285px, 100%), 1fr))",
            gap: "20px",
          }}
        >
          {productosFiltrados.map((p) => {
            const variantesLista = (Array.isArray(p.variantes) ? [...p.variantes] : []).sort((a, b) => {
              const ordA = typeof a.var_detalle_variante?.orden === "number" ? a.var_detalle_variante.orden : 999;
              const ordB = typeof b.var_detalle_variante?.orden === "number" ? b.var_detalle_variante.orden : 999;
              if (ordA !== ordB) return ordA - ordB;
              return (a.var_precio || 0) - (b.var_precio || 0);
            });
            const currentVarId = varianteSeleccionadaPorProducto[p.pro_id] || variantesLista[0]?.var_id;
            const currentVar = variantesLista.find((v) => v.var_id === currentVarId) || variantesLista[0];
            const esHonorario = p.pro_tipo === "SERVICIO" || (p.pro_slug && p.pro_slug.includes("honorarios"));

            const normalizarBeneficiosCustom = (raw: unknown): string[] => {
              if (Array.isArray(raw)) {
                return raw
                  .map((b: unknown) => (typeof b === "string" ? b.trim() : ""))
                  .filter((b: string) => b.length > 0);
              }
              if (typeof raw === "string") {
                return raw
                  .split("\n")
                  .map((b) => b.trim())
                  .filter((b) => b.length > 0);
              }
              return [];
            };

            const recetaMasterRaw =
              p.pro_detalle_producto?.composicion_receta ??
              p.pro_detalle_producto?.personalizacion_floral?.composicionReceta ??
              p.pro_detalle_producto?.personalizacion_floral?.composicion_receta;

            const obtenerComposicionTextoVariante = (v?: VarianteCatalogo | null): string => {
              const vd = v?.var_detalle_variante || {};
              const recetaEfectiva = resolverComposicionRecetaEfectiva({
                recetaMaster: recetaMasterRaw,
                recetaVariante:
                  vd.composicion_receta ??
                  vd.personalizacion_floral?.composicionReceta ??
                  vd.personalizacion_floral?.composicion_receta,
                modoVariante: vd.personalizacion_floral_modo,
              });
              return formatearDescripcionComposicion(recetaEfectiva);
            };

            const obtenerResumenVariante = (v: VarianteCatalogo): string => {
              const vd = v.var_detalle_variante || {};
              const txtRecetaVar = obtenerComposicionTextoVariante(v);
              const custom = normalizarBeneficiosCustom(vd.beneficios_custom);
              if (txtRecetaVar) {
                return custom.length > 0 && !custom[0]!.toLowerCase().includes(txtRecetaVar.toLowerCase())
                  ? `${txtRecetaVar} · ${custom[0]!}`
                  : txtRecetaVar;
              }
              if (custom.length > 0) return custom[0]!;
              if (typeof vd.receta_bom === "string" && vd.receta_bom.trim()) {
                return vd.receta_bom.trim();
              }
              if (typeof vd.detalle === "string" && vd.detalle.trim()) {
                return vd.detalle.trim();
              }
              if (typeof vd.tallos === "number" && vd.tallos > 0) {
                return `${vd.tallos} tallos`;
              }
              return "";
            };

            // Beneficios / ¿Qué incluye? activos para la variante seleccionada o master
            const beneficiosLista: string[] = (() => {
              const masterBen: string[] = Array.isArray(p.pro_detalle_producto?.beneficios)
                ? p.pro_detalle_producto.beneficios
                    .map((b: unknown) => (typeof b === "string" ? b.trim() : ""))
                    .filter((b: string) => b.length > 0)
                : [];

              if (!currentVar) return masterBen;

              const vdet = currentVar.var_detalle_variante || {};
              const modoExplicito = vdet.beneficios_modo;
              const modo = modoExplicito || "heredar";
              const customBen = normalizarBeneficiosCustom(vdet.beneficios_custom);

              if (modo === "reemplazar" && customBen.length > 0) {
                return customBen;
              }
              if (modo === "anexar" && customBen.length > 0) {
                return Array.from(new Set([...masterBen, ...customBen]));
              }
              if (customBen.length > 0 && (masterBen.length === 0 || !modoExplicito)) {
                return Array.from(new Set([...masterBen, ...customBen]));
              }
              return masterBen;
            })();

            const currentVarDet = currentVar?.var_detalle_variante || {};
            const composicionRecetaActual = obtenerComposicionTextoVariante(currentVar);
            const recetaBomLegacy =
              typeof currentVarDet.receta_bom === "string" ? currentVarDet.receta_bom.trim() : "";
            const recetaBomActual = composicionRecetaActual || recetaBomLegacy;
            const detalleVarActual =
              typeof currentVarDet.detalle === "string" ? currentVarDet.detalle.trim() : "";
            const tallosActual =
              typeof currentVarDet.tallos === "number" && currentVarDet.tallos > 0
                ? currentVarDet.tallos
                : 0;
            const skuActual = typeof currentVar?.var_sku === "string" ? currentVar.var_sku.trim() : "";

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

            variantesLista.forEach((v, idx) => {
              const col = PALETA_COLORES_VARIANTES[idx % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;
              if (v.var_detalle_variante?.portada_url && !fotosDisponibles.some((f) => f.url === v.var_detalle_variante.portada_url)) {
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

              if (Array.isArray(v.var_detalle_variante?.galeria_urls)) {
                v.var_detalle_variante.galeria_urls.forEach((url: string, gIdx: number) => {
                  if (url && typeof url === "string" && !fotosDisponibles.some((f) => f.url === url)) {
                    fotosDisponibles.push({
                      url,
                      origen: "variante",
                      etiqueta: `${v.var_nombre} (#${gIdx + 2})`,
                      varianteId: v.var_id,
                      col,
                      posicion: v.var_detalle_variante.foto_posicion || p.pro_detalle_producto?.foto_posicion || "center center",
                      ajuste: v.var_detalle_variante.foto_ajuste || p.pro_detalle_producto?.foto_ajuste || "cover",
                      zoom: v.var_detalle_variante.foto_zoom || p.pro_detalle_producto?.foto_zoom || 100,
                    });
                  }
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
            const fallbackDefault = obtenerImagenFallbackNegocio(p.pro_negocio || negocio);
            const fotoMostrar = fotoActual?.url || currentVar?.var_detalle_variante?.portada_url || p.pro_detalle_producto?.imagen_url || fallbackDefault;
            const posicionActual = fotoActual?.posicion || currentVar?.var_detalle_variante?.foto_posicion || p.pro_detalle_producto?.foto_posicion || "center center";
            const ajusteActual = fotoActual?.ajuste || currentVar?.var_detalle_variante?.foto_ajuste || p.pro_detalle_producto?.foto_ajuste || "cover";
            const zoomActual = Number(fotoActual?.zoom || currentVar?.var_detalle_variante?.foto_zoom || p.pro_detalle_producto?.foto_zoom || 100);
            const scaleFactor = zoomActual && zoomActual !== 100 ? zoomActual / 100 : 1;

            const videoMostrar = currentVar?.var_detalle_variante?.video_url || p.pro_detalle_producto?.video_url;
            const tiempoMostrar = currentVar?.var_detalle_variante?.tiempo_entrega || p.pro_detalle_producto?.tiempo_entrega;
            const albumUrl = currentVar?.var_detalle_variante?.album_url || p.pro_detalle_producto?.album_fotos_url;

            const vigenciaInfo = evaluarVigenciaProducto(p.pro_detalle_producto, p.pro_activo);
            const estaActivoGeneral = p.pro_activo !== false;
            const isSavingActivo = guardandoActivoKey === p.pro_id;

            // Datos comerciales exactos visibles para el cliente (Set/Combo, Renta, Eventos, Ofertas y Escalas)
            const esRentaProd = esCodigoOfertaRenta(p.pro_tipo, p.pro_detalle_producto);
            const catNombreLower = (p.categoria?.ctg_nombre || "").toLowerCase();
            const catSlugLower = (p.categoria?.ctg_slug || "").toLowerCase();
            const esEventoProd = Boolean(
              esFloristeria &&
                !esRentaProd &&
                (catNombreLower.includes("evento") ||
                  catNombreLower.includes("ceremonia") ||
                  catSlugLower.includes("evento") ||
                  (p.pro_tipo || "").toUpperCase() === "SERVICIO")
            );
            const pvpActual =
              currentVar?.precio_total !== undefined && currentVar.precio_total > 0
                ? Number(currentVar.precio_total)
                : Number(
                    (
                      Number(currentVar?.var_precio || 0) *
                      (1 + Number(currentVar?.var_tarifa_iva_porcentaje || 0) / 100)
                    ).toFixed(2)
                  );
            const escalasVolumenVar = normalizarEscalasVolumen(
              currentVar?.var_detalle_variante?.escalas_volumen
            );
            const componentesComboRaw = p.pro_detalle_producto?.es_combo
              ? normalizarComponentesCombo(p.pro_detalle_producto?.combo_componentes)
              : [];
            const componentesComboVista = componentesComboRaw.map((comp) => {
              const prodHijo = (productos || []).find(
                (item) =>
                  item.pro_id === comp.producto_id ||
                  (comp.producto_slug && item.pro_slug === comp.producto_slug)
              );
              const varHijo =
                prodHijo?.variantes.find(
                  (v) =>
                    (comp.variante_id && v.var_id === comp.variante_id) ||
                    (comp.variante_sku && v.var_sku === comp.variante_sku)
                ) || prodHijo?.variantes[0];
              const pvpUnit = varHijo
                ? varHijo.precio_total && varHijo.precio_total > 0
                  ? Number(varHijo.precio_total)
                  : Number(
                      (
                        Number(varHijo.var_precio || 0) *
                        (1 + Number(varHijo.var_tarifa_iva_porcentaje || 0) / 100)
                      ).toFixed(2)
                    )
                : 0;
              const subtotalLinea = Number((pvpUnit * comp.cantidad_base).toFixed(2));
              const miniatura =
                varHijo?.var_detalle_variante?.portada_url ||
                prodHijo?.pro_detalle_producto?.imagen_url ||
                (Array.isArray(prodHijo?.pro_detalle_producto?.galeria_urls)
                  ? prodHijo?.pro_detalle_producto?.galeria_urls[0]
                  : "") ||
                "";
              const escalasHijo = normalizarEscalasVolumen(
                varHijo?.var_detalle_variante?.escalas_volumen
              );
              return {
                comp,
                prodHijo,
                varHijo,
                nombreMostrar: prodHijo?.pro_nombre || comp.producto_nombre || "Pieza",
                varianteMostrar:
                  prodHijo && prodHijo.variantes.length > 1
                    ? varHijo?.var_nombre || comp.variante_nombre || ""
                    : "",
                pvpUnit,
                subtotalLinea,
                miniatura,
                escalasHijo,
              };
            });
            const esComboActivo = Boolean(
              p.pro_detalle_producto?.es_combo && componentesComboVista.length > 0
            );
            const totalPiezasCombo = componentesComboVista.reduce(
              (acc, f) => acc + f.comp.cantidad_base,
              0
            );
            const sumaSetNominal = Number(
              componentesComboVista.reduce((acc, f) => acc + f.subtotalLinea, 0).toFixed(2)
            );
            const precioComparacionVar =
              currentVar?.var_precio_comparacion && Number(currentVar.var_precio_comparacion) > pvpActual
                ? Number(currentVar.var_precio_comparacion)
                : undefined;
            const precioTachadoEfectivo =
              esComboActivo && sumaSetNominal > pvpActual
                ? sumaSetNominal
                : precioComparacionVar;
            const ahorroEfectivo =
              precioTachadoEfectivo && precioTachadoEfectivo > pvpActual
                ? Number((precioTachadoEfectivo - pvpActual).toFixed(2))
                : 0;
            const pctDescuentoEfectivo =
              precioTachadoEfectivo && ahorroEfectivo > 0
                ? Math.round((ahorroEfectivo / precioTachadoEfectivo) * 100)
                : 0;
            const descripcionEfectiva =
              (p.pro_descripcion && p.pro_descripcion.trim()) ||
              (typeof p.pro_detalle_producto?.descripcion_corta === "string" &&
                p.pro_detalle_producto.descripcion_corta.trim()) ||
              "";
            const urlTiendaPublica = construirEnlaceProductoTienda({
              negocio,
              slugProducto: p.pro_slug || p.pro_id,
              skuVariante: variantesLista.length > 1 ? currentVar?.var_sku : undefined,
              baseUrl: URL_TIENDA_POR_NEGOCIO[negocio],
            });

            return (
              <div
                key={p.pro_id}
                style={{
                  background: !estaActivoGeneral ? "var(--cf-f8f7f4, #F8F7F4)" : "var(--cf-ffffff, #FFFFFF)",
                  border: !estaActivoGeneral
                    ? "2px dashed var(--cb-847d74, #847D74)"
                    : !vigenciaInfo.estaVigente
                    ? "2px solid #8F6A2E"
                    : esHonorario
                    ? "2px solid var(--cb-221e1b, #221E1B)"
                    : "1px solid var(--cb-e6e2da, #E6E2DA)",
                  borderRadius: "16px",
                  overflow: "hidden",
                  display: "flex",
                  flexDirection: "column",
                  opacity: !estaActivoGeneral ? 0.78 : 1,
                  boxShadow: esHonorario
                    ? "0 4px 12px rgba(2, 132, 199, 0.1)"
                    : "0 2px 6px rgba(0,0,0,0.04)",
                  transition: "transform 0.15s ease, box-shadow 0.15s ease, opacity 0.15s ease",
                  position: "relative",
                }}
              >
                {/* Barra Superior Dedicada para Operador (sin tapar ni recortar la foto) */}
                {modoVista === "admin" && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "6px",
                      padding: "8px 10px",
                      background: "var(--cf-f8f7f4, #F8F7F4)",
                      borderBottom: "1px solid var(--cb-eae6df, #EAE6DF)",
                    }}
                  >
                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px" }}>
                      <button
                        type="button"
                        onClick={(e) => handleAlternarActivo(p.pro_id, e)}
                        disabled={isSavingActivo}
                        className="btn-responsive-accion"
                        title={estaActivoGeneral ? "Producto activo en catálogo. Clic para desactivar" : "Producto inactivo. Clic para activar"}
                        aria-label={estaActivoGeneral ? "Desactivar producto" : "Activar producto"}
                        style={{
                          background: isSavingActivo
                            ? "var(--cf-f4f2ee, #F4F2EE)"
                            : estaActivoGeneral
                            ? "#2F4737"
                            : "#57524C",
                          border: estaActivoGeneral
                            ? "1px solid #2F4737"
                            : "1px solid var(--cb-57524c, #57524C)",
                          color: "#FFFFFF",
                          padding: "4px 8px",
                          borderRadius: "7px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          cursor: isSavingActivo ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {isSavingActivo ? (
                          <RefreshCw size={11} className="eco-icono-girando" />
                        ) : (
                          <Power size={11} color={estaActivoGeneral ? "#FFFFFF" : "#D5CFC4"} />
                        )}
                        <span className="btn-texto-responsive">
                          {estaActivoGeneral ? "Activo" : "Inactivo"}
                        </span>
                      </button>

                      {canalSeleccionado !== "todos" && (() => {
                        const infoCanalFiltro = CANALES_CATALOGO_OFICIALES.find((c) => c.clave === canalSeleccionado);
                        const canalesProd = p.canales_visibilidad || p.pro_detalle_producto?.canales_visibilidad || CANALES_POR_DEFECTO;
                        const estaActivoEnCanal = canalesProd.includes(canalSeleccionado as CanalVisibilidad);
                        const isSaving = guardandoCanalKey === `${p.pro_id}_${canalSeleccionado}`;
                        const requiereImgYFalta = !productoTieneAlMenosUnaImagen(p) && CANALES_REQUIEREN_IMAGEN.includes(canalSeleccionado as CanalVisibilidad);

                        return (
                          <button
                            type="button"
                            onClick={async (e) => {
                              e.stopPropagation();
                              await handleAlternarCanal(p.pro_id, canalSeleccionado as CanalVisibilidad);
                            }}
                            disabled={isSaving}
                            className="btn-responsive-accion"
                            title={
                              requiereImgYFalta
                                ? `⚠️ Requiere al menos una imagen configurada para activarse en ${infoCanalFiltro?.nombre || canalSeleccionado}`
                                : estaActivoEnCanal
                                ? `Desactivar visibilidad en ${infoCanalFiltro?.nombre || canalSeleccionado}`
                                : `Activar visibilidad en ${infoCanalFiltro?.nombre || canalSeleccionado}`
                            }
                            aria-label={`Alternar visibilidad en ${infoCanalFiltro?.nombre || canalSeleccionado}`}
                            style={{
                              background: estaActivoEnCanal ? "var(--cf-e8f1eb, #E8F1EB)" : "var(--cf-ffffff, #FFFFFF)",
                              border: estaActivoEnCanal ? "1px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              color: estaActivoEnCanal ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-57524c, #57524C)",
                              padding: "4px 8px",
                              borderRadius: "7px",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              cursor: isSaving ? "wait" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              transition: "all 0.15s ease",
                            }}
                          >
                            {isSaving ? (
                              <RefreshCw size={11} className="eco-icono-girando" />
                            ) : estaActivoEnCanal ? (
                              <CheckCircle2 size={11} color="#2F4737" />
                            ) : (
                              <div
                                style={{
                                  width: "10px",
                                  height: "10px",
                                  borderRadius: "2px",
                                  border: "1.5px solid var(--cb-847d74, #847D74)",
                                }}
                              />
                            )}
                            <span className="btn-texto-responsive">
                              {estaActivoEnCanal ? "En Canal" : "Oculto"}
                            </span>
                          </button>
                        );
                      })()}

                      <button
                        type="button"
                        onClick={async (e) => {
                          e.stopPropagation();
                          await handleAlternarDestacado(p.pro_id);
                        }}
                        disabled={guardandoDestacadoKey === p.pro_id}
                        className="btn-responsive-accion"
                        title={p.pro_destacado ? "Quitar insignia de producto destacado" : "Asignar insignia de producto destacado"}
                        aria-label={p.pro_destacado ? "Quitar insignia de producto destacado" : "Asignar insignia de producto destacado"}
                        style={{
                          background: p.pro_destacado ? "#8F6A2E" : "var(--cf-ffffff, #FFFFFF)",
                          border: p.pro_destacado ? "1px solid #8F6A2E" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          color: p.pro_destacado ? "#FFFFFF" : "var(--ct-57524c, #57524C)",
                          padding: "4px 8px",
                          borderRadius: "7px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          cursor: guardandoDestacadoKey === p.pro_id ? "wait" : "pointer",
                          transition: "all 0.15s ease",
                        }}
                      >
                        {guardandoDestacadoKey === p.pro_id ? (
                          <RefreshCw size={10} className="eco-icono-girando" />
                        ) : (
                          <Sparkles size={11} color={p.pro_destacado ? "#FFFFFF" : "#8F6A2E"} />
                        )}
                        <span className="btn-texto-responsive">
                          {p.pro_destacado ? "Destacado" : "Destacar"}
                        </span>
                      </button>

                      {Math.max(0, Number(p.pro_total_me_gusta ?? 0) || 0) > 0 && (
                        <div
                          title={`${p.pro_total_me_gusta} Me gusta acumulados de clientes`}
                          aria-label={`${p.pro_total_me_gusta} Me gusta globales`}
                          style={{
                            background: "var(--cf-fff1f2, #FFF1F2)",
                            border: "1px solid var(--cb-fecdd3, #FECDD3)",
                            color: "var(--ct-be123c, #BE123C)",
                            padding: "3px 7px",
                            borderRadius: "999px",
                            fontSize: "0.69rem",
                            fontWeight: 800,
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Heart size={10} fill="currentColor" />
                          <span>{p.pro_total_me_gusta}</span>
                        </div>
                      )}
                    </div>

                    <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "5px" }}>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          const urlProdPublico = construirEnlaceProductoTienda({
                            negocio,
                            slugProducto: p.pro_slug || p.pro_id,
                            skuVariante: variantesLista.length > 1 ? currentVar?.var_sku : undefined,
                            baseUrl: URL_TIENDA_POR_NEGOCIO[negocio],
                          });
                          copiarLinkPublicoTienda(`prod_${p.pro_id}`, urlProdPublico);
                        }}
                        className="btn-responsive-accion"
                        title={`Copiar link directo en tienda para compartir "${p.pro_nombre}" por WhatsApp o Chat`}
                        aria-label={`Copiar link en tienda de ${p.pro_nombre}`}
                        style={{
                          background:
                            linkTiendaCopiadoKey === `prod_${p.pro_id}`
                              ? "#2F4737"
                              : "var(--cf-ffffff, #FFFFFF)",
                          border:
                            linkTiendaCopiadoKey === `prod_${p.pro_id}`
                              ? "1px solid #2F4737"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          color:
                            linkTiendaCopiadoKey === `prod_${p.pro_id}`
                              ? "#FFFFFF"
                              : "var(--ct-221e1b, #221E1B)",
                          padding: "4px 8px",
                          borderRadius: "7px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {linkTiendaCopiadoKey === `prod_${p.pro_id}` ? (
                          <>
                            <CheckCircle2 size={11} color="#FFFFFF" />
                            <span className="btn-texto-responsive">Copiado</span>
                          </>
                        ) : (
                          <>
                            <Link2 size={11} color="#2F4737" />
                            <span className="btn-texto-responsive">Link</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void copiarConfiguracionProducto(p);
                        }}
                        className="btn-responsive-accion"
                        title={`Copiar en texto toda la configuración de "${p.pro_nombre}"`}
                        aria-label={`Copiar configuración de ${p.pro_nombre}`}
                        style={{
                          background:
                            configCopiadaProdId === p.pro_id ? "#2F4737" : "var(--cf-ffffff, #FFFFFF)",
                          border:
                            configCopiadaProdId === p.pro_id
                              ? "1px solid #2F4737"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          color:
                            configCopiadaProdId === p.pro_id ? "#FFFFFF" : "var(--ct-221e1b, #221E1B)",
                          padding: "4px 8px",
                          borderRadius: "7px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        {configCopiadaProdId === p.pro_id ? (
                          <>
                            <CheckCircle2 size={11} color="#FFFFFF" />
                            <span className="btn-texto-responsive">Copiado</span>
                          </>
                        ) : (
                          <>
                            <ClipboardCopy size={11} color="#8F6A2E" />
                            <span className="btn-texto-responsive">Copiar</span>
                          </>
                        )}
                      </button>

                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setProductoAEditar(p);
                          setVarianteAEditarId(undefined);
                          setModalEditarAbierto(true);
                        }}
                        className="btn-responsive-accion"
                        title="Editar datos generales del producto master"
                        aria-label="Editar producto master"
                        style={{
                          background: "#221E1B",
                          border: "1px solid var(--cb-221e1b, #221E1B)",
                          color: "#FFFFFF",
                          padding: "4px 9px",
                          borderRadius: "7px",
                          fontSize: "0.7rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <Pencil size={11} color="#E5D7BC" />
                        <span className="btn-texto-responsive">Editar</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* Carrusel de Imágenes: Portada Master + Fotos de Variantes */}
                {fotoMostrar && (
                  <div
                    style={{
                      position: "relative",
                      width: "100%",
                      aspectRatio: esModoMovil ? "4 / 3.4" : "1 / 1",
                      background: "#1F1C19",
                      overflow: "hidden",
                    }}
                  >
                    {/* Fondo difuminado si el ajuste es contain */}
                    {ajusteActual === "contain" && (
                      <img
                        src={fotoMostrar}
                        alt=""
                        aria-hidden="true"
                        onError={(e) => {
                          (e.target as HTMLImageElement).src = fallbackDefault;
                        }}
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
                        (e.target as HTMLImageElement).src = fallbackDefault;
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
                        <Play size={10} color="#C8A25A" fill="#C8A25A" />
                        <span>Video Reel</span>
                      </button>
                    )}

                    {/* Etiqueta de la foto actual del carrusel (Admin) o Chips comerciales del cliente (Vista Cliente) */}
                    {modoVista === "admin" && fotoActual && (
                      <div
                        style={{
                          position: "absolute",
                          top: "8px",
                          left: videoMostrar ? "105px" : "8px",
                          background: fotoActual.col ? fotoActual.col.bg : "rgba(15, 23, 42, 0.85)",
                          color: fotoActual.col ? fotoActual.col.text : "#FFFFFF",
                          border: fotoActual.col ? `1.5px solid ${fotoActual.col.border}` : "1px solid var(--cb-ffffff-a300, rgba(255,255,255,0.3))",
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

                    {modoVista === "cliente" && (esComboActivo || pctDescuentoEfectivo > 0 || esRentaProd || esEventoProd) && (
                      <div
                        style={{
                          position: "absolute",
                          top: "10px",
                          left: videoMostrar ? "105px" : "10px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "5px",
                          zIndex: 2,
                          maxWidth: "72%",
                        }}
                      >
                        {esComboActivo ? (
                          <span
                            style={{
                              background: "#5B21B6",
                              color: "#FFFFFF",
                              padding: "3px 9px",
                              borderRadius: "999px",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                            }}
                          >
                            {pctDescuentoEfectivo > 0
                              ? `🎁 SET -${pctDescuentoEfectivo}% OFF`
                              : "🎁 SET ESPECIAL"}
                          </span>
                        ) : pctDescuentoEfectivo > 0 ? (
                          <span
                            style={{
                              background: "#BE123C",
                              color: "#FFFFFF",
                              padding: "3px 9px",
                              borderRadius: "999px",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                              boxShadow: "0 2px 6px rgba(0,0,0,0.22)",
                            }}
                          >
                            🔥 -{pctDescuentoEfectivo}% OFF
                          </span>
                        ) : null}
                        {esRentaProd && (
                          <span
                            style={{
                              background: "rgba(15, 23, 42, 0.88)",
                              color: "#FDE68A",
                              border: "1px solid rgba(251, 191, 36, 0.55)",
                              padding: "3px 9px",
                              borderRadius: "999px",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                            }}
                          >
                            🪑 EN RENTA
                          </span>
                        )}
                        {esEventoProd && !esRentaProd && (
                          <span
                            style={{
                              background: "rgba(45, 71, 52, 0.92)",
                              color: "#FEF3C7",
                              padding: "3px 9px",
                              borderRadius: "999px",
                              fontSize: "0.68rem",
                              fontWeight: 800,
                            }}
                          >
                            ✨ EVENTOS
                          </span>
                        )}
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
                            background: "var(--cf-ffffff-a900, rgba(255, 255, 255, 0.9))",
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
                          <ChevronLeft size={16} color="#1F1C19" />
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
                            background: "var(--cf-ffffff-a900, rgba(255, 255, 255, 0.9))",
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
                          <ChevronRight size={16} color="#1F1C19" />
                        </button>

                        {/* Indicadores de bolitas del carrusel */}
                        <div
                          style={{
                            position: "absolute",
                            bottom: tiempoMostrar || albumUrl ? "36px" : "8px",
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
                                aria-label={`Ver imagen ${fIdx + 1}`}
                                title={`Imagen ${fIdx + 1}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setFotoCarouselIndexPorProducto((prev) => ({ ...prev, [p.pro_id]: fIdx }));
                                  if (f.varianteId) {
                                    setVarianteSeleccionadaPorProducto((prev) => ({ ...prev, [p.pro_id]: f.varianteId! }));
                                  }
                                }}
                                style={{
                                  minWidth: "24px",
                                  height: "24px",
                                  border: "none",
                                  background: "transparent",
                                  cursor: "pointer",
                                  padding: 0,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                }}
                              >
                                <span
                                  style={{
                                    width: isDotActive ? "16px" : "6px",
                                    height: "6px",
                                    borderRadius: "3px",
                                    background: isDotActive ? (f.col ? f.col.border : "#C8A25A") : "var(--cf-ffffff-a500, rgba(255, 255, 255, 0.5))",
                                    transition: "all 0.2s ease",
                                    display: "block",
                                  }}
                                />
                              </button>
                            );
                          })}
                        </div>
                      </>
                    )}

                    {tiempoMostrar && (
                      <div
                        title={tiempoMostrar}
                        style={{
                          position: "absolute",
                          bottom: "8px",
                          left: "8px",
                          maxWidth: albumUrl ? "56%" : "calc(100% - 16px)",
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
                        <Clock size={11} color="#C8A25A" style={{ flexShrink: 0 }} />
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                          {tiempoMostrar}
                        </span>
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
                          background: "var(--cf-ffffff-a920, rgba(255, 255, 255, 0.92))",
                          color: "var(--ct-1f1c19, #1F1C19)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.68rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          boxShadow: "0 1px 3px rgba(0,0,0,0.2)",
                          whiteSpace: "nowrap",
                          zIndex: 2,
                        }}
                      >
                        📸 Muestras
                      </a>
                    )}
                  </div>
                )}

                {/* Badges Flotantes en Vista Cliente (Destacado + Me Gusta) */}
                {modoVista !== "admin" && (p.pro_destacado || Math.max(0, Number(p.pro_total_me_gusta ?? 0) || 0) > 0) && (
                  <div
                    style={{
                      position: "absolute",
                      top: "10px",
                      right: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      zIndex: 4,
                    }}
                  >
                    {Math.max(0, Number(p.pro_total_me_gusta ?? 0) || 0) > 0 && (
                      <div
                        title={`${p.pro_total_me_gusta} Me gusta acumulados de clientes`}
                        aria-label={`${p.pro_total_me_gusta} Me gusta globales`}
                        style={{
                          background: "var(--cf-ffffff-a940, rgba(255, 255, 255, 0.94))",
                          border: "1.5px solid var(--cb-f9a8d4, #F9A8D4)",
                          color: "var(--ct-be123c, #BE123C)",
                          padding: "3px 8px",
                          borderRadius: "999px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          boxShadow: "0 2px 6px rgba(0,0,0,0.16)",
                          backdropFilter: "blur(6px)",
                        }}
                      >
                        <Heart size={11} fill="currentColor" />
                        <span>{p.pro_total_me_gusta}</span>
                      </div>
                    )}
                    {p.pro_destacado && (
                      <div
                        style={{
                          background: "#8F6A2E",
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
                  </div>
                )}

                <div
                  style={{
                    padding: esModoMovil ? "14px 15px" : "18px 20px",
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                  }}
                >
                  {/* Badge de Inactivo o Vigencia Estacional (+ Eliminar directo en Entrega Inmediata vendida/inactiva) */}
                  {!estaActivoGeneral ? (
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "6px",
                        flexWrap: "wrap",
                        marginBottom: "8px",
                      }}
                    >
                      <div
                        style={{
                          background: "var(--cf-faf2f2, #FAF2F2)",
                          border: "1px solid var(--cb-e5caca, #E5CACA)",
                          color: "var(--ct-8a2e2e, #8A2E2E)",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          fontSize: "0.7rem",
                          fontWeight: 800,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                        }}
                      >
                        <AlertCircle size={12} color="#8A2E2E" />
                        <span>⚪ INACTIVO — Oculto al público</span>
                      </div>

                      {modoVista === "admin" &&
                        (Boolean(p.pro_detalle_producto?.es_entrega_inmediata) ||
                          (p.categoria?.ctg_slug || "").toLowerCase().includes("entrega-inmediata") ||
                          (p.categoria?.ctg_nombre || "").toLowerCase().includes("entrega inmediata")) && (
                          <button
                            type="button"
                            disabled={eliminandoProdId === p.pro_id}
                            onClick={async (e) => {
                              e.stopPropagation();
                              if (confirmarEliminarProdId !== p.pro_id) {
                                setConfirmarEliminarProdId(p.pro_id);
                                return;
                              }
                              setConfirmarEliminarProdId(null);
                              setEliminandoProdId(p.pro_id);
                              setMensajeErrorCanal(null);
                              try {
                                const res = await eliminarProductoAction(p.pro_id, negocio);
                                if (res.ok) {
                                  setProductos((prev) =>
                                    prev.filter((item) => item.pro_id !== p.pro_id)
                                  );
                                } else {
                                  setMensajeErrorCanal(
                                    res.error || "No se pudo eliminar definitivamente el producto."
                                  );
                                }
                              } catch (err) {
                                setMensajeErrorCanal(
                                  err instanceof Error
                                    ? err.message
                                    : "Error al eliminar el producto."
                                );
                              } finally {
                                setEliminandoProdId(null);
                              }
                            }}
                            title={
                              confirmarEliminarProdId === p.pro_id
                                ? "Confirmar eliminación definitiva de este arreglo vendido"
                                : "Eliminar definitivamente este arreglo de entrega inmediata vendido"
                            }
                            aria-label={
                              confirmarEliminarProdId === p.pro_id
                                ? "Confirmar eliminar"
                                : "Eliminar definitivo"
                            }
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "3px 8px",
                              borderRadius: "6px",
                              border:
                                confirmarEliminarProdId === p.pro_id
                                  ? "none"
                                  : "1px solid var(--cb-e5caca, #E5CACA)",
                              background:
                                confirmarEliminarProdId === p.pro_id ? "#8A2E2E" : "var(--cf-ffffff, #FFFFFF)",
                              color:
                                confirmarEliminarProdId === p.pro_id ? "#FFFFFF" : "var(--ct-8a2e2e, #8A2E2E)",
                              fontSize: "0.7rem",
                              fontWeight: 800,
                              cursor: eliminandoProdId === p.pro_id ? "wait" : "pointer",
                              whiteSpace: "nowrap",
                            }}
                          >
                            <Trash2 size={11} />
                            <span>
                              {eliminandoProdId === p.pro_id
                                ? "Eliminando..."
                                : confirmarEliminarProdId === p.pro_id
                                  ? "Confirmar"
                                  : "Eliminar"}
                            </span>
                          </button>
                        )}
                    </div>
                  ) : vigenciaInfo.vigenciaTipo !== "SIEMPRE" ? (
                    <div
                      style={{
                        background: vigenciaInfo.estaVigente ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf6ee, #FAF6EE)",
                        border: vigenciaInfo.estaVigente ? "1px solid var(--cb-ceddd3, #CEDDD3)" : "1px solid var(--cb-e5d7bc, #E5D7BC)",
                        color: vigenciaInfo.estaVigente ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-745622, #745622)",
                        padding: "3px 8px",
                        borderRadius: "6px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        marginBottom: "8px",
                        alignSelf: "flex-start",
                      }}
                      title={vigenciaInfo.mensaje}
                    >
                      <Calendar size={12} color={vigenciaInfo.estaVigente ? "#2F4737" : "#8F6A2E"} />
                      <span>{vigenciaInfo.etiquetaBadge}</span>
                    </div>
                  ) : null}

                  {/* Badge Modalidad de Renta de Mobiliario */}
                  {esCodigoOfertaRenta(p.pro_tipo, p.pro_detalle_producto) && (
                    <div
                      style={{
                        background: "var(--cf-faf6ee, #FAF6EE)",
                        border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                        color: "var(--ct-745622, #745622)",
                        padding: "3px 9px",
                        borderRadius: "6px",
                        fontSize: "0.7rem",
                        fontWeight: 800,
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        marginBottom: "8px",
                        alignSelf: "flex-start",
                      }}
                    >
                      <span>
                        🪑 EN RENTA •{" "}
                        {normalizarConfiguracionRenta(p.pro_detalle_producto?.renta_config).periodo}
                      </span>
                    </div>
                  )}

                  {/* Icono y Categoría */}
                  <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "10px" }}>
                    {!fotoMostrar && (
                      <div
                        style={{
                          width: "44px",
                          height: "44px",
                          borderRadius: "12px",
                          background: "var(--cf-f8f7f4, #F8F7F4)",
                          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
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
                          color: "var(--ct-847d74, #847D74)",
                          textTransform: "uppercase",
                          letterSpacing: "0.5px",
                        }}
                      >
                        {p.categoria?.ctg_nombre || "Catálogo"}
                      </span>
                      <h3
                        style={{
                          margin: "2px 0 0",
                          fontSize: "0.9rem",
                          fontWeight: 800,
                          color: "var(--ct-1f1c19, #1F1C19)",
                          lineHeight: 1.3,
                        }}
                      >
                        {p.pro_nombre}
                      </h3>
                    </div>
                  </div>

                  {/* Descripción */}
                  {descripcionEfectiva && (
                    <p
                      style={{
                        margin: "0 0 12px",
                        fontSize: "0.82rem",
                        color: "var(--ct-57524c, #57524C)",
                        lineHeight: 1.45,
                      }}
                    >
                      {descripcionEfectiva}
                    </p>
                  )}

                  {/* Badge de Modalidad / Logística */}
                  {esLegal ? (
                    p.pro_detalle_producto?.logistica?.delivery_incluido ? (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "var(--cf-f2f6f3, #F2F6F3)",
                          border: "1px solid #2F4737",
                          color: "var(--ct-2b4a36, #2B4A36)",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          marginBottom: "10px",
                          alignSelf: "flex-start",
                        }}
                      >
                        <Truck size={13} color="#2F4737" />
                        <span>{p.pro_detalle_producto?.logistica?.etiqueta_transporte || "📦 Mensajería Notarial Segura"}</span>
                        {p.pro_detalle_producto?.logistica?.cobertura_texto && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ct-2f4737, #2F4737)", marginLeft: "2px" }}>
                            • {p.pro_detalle_producto.logistica.cobertura_texto}
                          </span>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          background: "var(--cf-f4f2ee, #F4F2EE)",
                          border: "1px solid var(--cb-ddd8ce, #DDD8CE)",
                          color: "var(--ct-3a3530, #3A3530)",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          marginBottom: "10px",
                          alignSelf: "flex-start",
                        }}
                      >
                        <Scale size={13} color="#221E1B" />
                        <span>
                          {p.pro_tipo === "SUSCRIPCION"
                            ? "🛡️ Cobertura Legal Continua"
                            : p.pro_detalle_producto?.logistica?.etiqueta_transporte && !p.pro_detalle_producto.logistica.etiqueta_transporte.includes("Envío")
                            ? p.pro_detalle_producto.logistica.etiqueta_transporte
                            : "🌐 Modalidad 100% Telemática"}
                        </span>
                        {p.pro_detalle_producto?.logistica?.cobertura_texto && !p.pro_detalle_producto.logistica.cobertura_texto.includes("Quito Urbano") && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ct-221e1b, #221E1B)", marginLeft: "2px" }}>
                            • {p.pro_detalle_producto.logistica.cobertura_texto}
                          </span>
                        )}
                      </div>
                    )
                  ) : Boolean(p.pro_detalle_producto?.logistica?.delivery_incluido) ? (() => {
                    const etiquetaTransp =
                      p.pro_detalle_producto?.logistica?.etiqueta_transporte || "🚚 Envío a Domicilio Incluido";
                    const coberturaTxt = (p.pro_detalle_producto?.logistica?.cobertura_texto || "").trim();
                    const mostrarCobertura =
                      Boolean(coberturaTxt) &&
                      !etiquetaTransp.toLowerCase().includes(coberturaTxt.toLowerCase());
                    return (
                      <div
                        style={{
                          display: "inline-flex",
                          flexWrap: "wrap",
                          alignItems: "center",
                          gap: "5px",
                          background: "var(--cf-f2f6f3, #F2F6F3)",
                          border: "1px solid #2F4737",
                          color: "var(--ct-2b4a36, #2B4A36)",
                          padding: "4px 10px",
                          borderRadius: "8px",
                          fontSize: "0.72rem",
                          fontWeight: 800,
                          marginBottom: "10px",
                          boxShadow: "0 1px 2px rgba(16, 185, 129, 0.1)",
                          alignSelf: "flex-start",
                          maxWidth: "100%",
                          lineHeight: 1.3,
                        }}
                      >
                        <Truck size={13} color="#2F4737" style={{ flexShrink: 0 }} />
                        <span>{etiquetaTransp}</span>
                        {mostrarCobertura && (
                          <span style={{ fontSize: "0.68rem", fontWeight: 600, color: "var(--ct-2f4737, #2F4737)" }}>
                            • {coberturaTxt}
                          </span>
                        )}
                      </div>
                    );
                  })() : null}


                  {/* Canales de Visibilidad (exclusivo de vista Administrador; multilínea sin recortes) */}
                  {modoVista === "admin" && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "5px",
                      marginBottom: "12px",
                      alignItems: "center",
                      width: "100%",
                    }}
                  >
                    {!productoTieneAlMenosUnaImagen(p) && (
                      <span
                        title="Este producto no tiene fotos configuradas. Está oculto en E-Commerce Web y App Clientes hasta que agregues al menos una imagen."
                        style={{
                          fontSize: "0.66rem",
                          fontWeight: 800,
                          background: "var(--cf-faf2f2, #FAF2F2)",
                          color: "var(--ct-8a2e2e, #8A2E2E)",
                          border: "1px solid var(--cb-e5caca, #E5CACA)",
                          borderRadius: "6px",
                          padding: "2px 6px",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          flexShrink: 0,
                          whiteSpace: "nowrap",
                        }}
                      >
                        <AlertCircle size={11} color="#8A2E2E" />
                        <span>Sin imagen</span>
                      </span>
                    )}

                    {CANALES_CATALOGO_OFICIALES.map((canalObj) => {
                      const cid = canalObj.clave;
                      const canalesProd = p.canales_visibilidad || p.pro_detalle_producto?.canales_visibilidad || CANALES_POR_DEFECTO;
                      const estaActivo = canalesProd.includes(cid);
                      const requiereImgYFalta = !productoTieneAlMenosUnaImagen(p) && CANALES_REQUIEREN_IMAGEN.includes(cid);
                      const isSaving = guardandoCanalKey === `${p.pro_id}_${cid}`;

                      return (
                        <button
                          key={cid}
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await handleAlternarCanal(p.pro_id, cid);
                          }}
                          disabled={isSaving}
                          title={
                            requiereImgYFalta
                              ? `${canalObj.nombre}: requiere al menos 1 foto para activarse en Web/App`
                              : estaActivo
                              ? `Activo en ${canalObj.nombre} (clic para desactivar)`
                              : `Inactivo en ${canalObj.nombre} (clic para activar)`
                          }
                          aria-label={`Alternar ${canalObj.nombre}`}
                          style={{
                            fontSize: "0.66rem",
                            fontWeight: 700,
                            background: isSaving
                              ? "var(--cf-f4f2ee, #F4F2EE)"
                              : estaActivo
                              ? "var(--cf-f2f6f3, #F2F6F3)"
                              : "var(--cf-f8f7f4, #F8F7F4)",
                            color: isSaving
                              ? "var(--ct-847d74, #847D74)"
                              : estaActivo
                              ? "var(--ct-2b4a36, #2B4A36)"
                              : "var(--ct-847d74, #847D74)",
                            border: isSaving
                              ? "1px dashed var(--cb-d5cfc4, #D5CFC4)"
                              : estaActivo
                              ? "1px solid #2F4737"
                              : "1px dashed var(--cb-d5cfc4, #D5CFC4)",
                            borderRadius: "6px",
                            padding: "3px 7px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                            flexShrink: 0,
                            whiteSpace: "nowrap",
                            scrollSnapAlign: "start",
                            cursor: isSaving ? "wait" : "pointer",
                            textDecoration: requiereImgYFalta && estaActivo ? "line-through" : "none",
                            opacity: estaActivo ? 1 : 0.65,
                            transition: "all 0.15s ease",
                          }}
                        >
                          {isSaving ? (
                            <RefreshCw size={9} className="eco-icono-girando" />
                          ) : estaActivo ? (
                            <CheckCircle2 size={10} color="#2F4737" />
                          ) : (
                            <div style={{ width: "8px", height: "8px", borderRadius: "2px", border: "1.5px solid var(--cb-847d74, #847D74)" }} />
                          )}
                          <span>{canalObj.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                  )}

                  {/* Composición de Set / Combo (visible fielmente igual que en la tienda para el cliente) */}
                  {esComboActivo && (
                    <div
                      style={{
                        background: "var(--cf-faf7ff, #FAF7FF)",
                        border: "1px solid var(--cb-ddd6fe, #DDD6FE)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        marginBottom: "12px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.71rem",
                            fontWeight: 800,
                            color: "var(--ct-5b21b6, #5B21B6)",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                          }}
                        >
                          <Gift size={13} color="#7C3AED" />
                          <span>
                            {esEventoProd ? "SET / COMBO PARA EVENTOS" : "SET / COMBO ESPECIAL"}
                          </span>
                        </span>
                        <span
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--ct-be185d, #BE185D)",
                          }}
                        >
                          ✨ Incluye {totalPiezasCombo} {totalPiezasCombo === 1 ? "pieza" : "piezas"} • Personalizable
                        </span>
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        {componentesComboVista.map((fila, fIdx) => (
                          <div
                            key={`${fila.comp.producto_id}-${fila.comp.variante_id || fila.comp.variante_sku || fIdx}`}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              background: "var(--cf-ffffff, #FFFFFF)",
                              border: "1px solid var(--cb-ede9fe, #EDE9FE)",
                              borderRadius: "8px",
                              padding: "6px 8px",
                            }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0, flex: 1 }}>
                              {fila.miniatura && (
                                <img
                                  src={fila.miniatura}
                                  alt={fila.nombreMostrar}
                                  style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "6px",
                                    objectFit: "cover",
                                    flexShrink: 0,
                                    border: "1px solid var(--cb-e4e4e7, #E4E4E7)",
                                  }}
                                />
                              )}
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div style={{ fontSize: "0.76rem", fontWeight: 700, color: "var(--ct-1f1c19, #1F1C19)", lineHeight: 1.25 }}>
                                  <span
                                    style={{
                                      display: "inline-block",
                                      background: "var(--cf-ede9fe, #EDE9FE)",
                                      color: "var(--ct-5b21b6, #5B21B6)",
                                      borderRadius: "5px",
                                      padding: "0 5px",
                                      fontSize: "0.7rem",
                                      fontWeight: 800,
                                      marginRight: "5px",
                                    }}
                                  >
                                    {fila.comp.cantidad_base}×
                                  </span>
                                  {fila.nombreMostrar}
                                </div>
                                {fila.varianteMostrar && (
                                  <div style={{ fontSize: "0.68rem", color: "var(--ct-5b21b6, #5B21B6)", fontWeight: 600 }}>
                                    {fila.varianteMostrar}
                                  </div>
                                )}
                                <div style={{ fontSize: "0.68rem", color: "var(--ct-57524c, #57524C)" }}>
                                  Unitario: ${fila.pvpUnit.toFixed(2)}
                                </div>
                                {fila.escalasHijo[0] && (
                                  <div style={{ fontSize: "0.66rem", color: "var(--ct-2f4737, #2F4737)", fontWeight: 700, marginTop: "2px" }}>
                                    🏷️ {describirEscalaVolumen(fila.escalasHijo[0], fila.pvpUnit)}
                                  </div>
                                )}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", flexShrink: 0 }}>
                              <div style={{ fontSize: "0.78rem", fontWeight: 800, color: "var(--ct-1f1c19, #1F1C19)" }}>
                                ${fila.subtotalLinea.toFixed(2)}
                              </div>
                              {fila.comp.cantidad_base > 1 && (
                                <div style={{ fontSize: "0.64rem", color: "var(--ct-847d74, #847D74)" }}>
                                  ({fila.comp.cantidad_base} × ${fila.pvpUnit.toFixed(2)})
                                </div>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>

                      {sumaSetNominal > 0 && (
                        <div
                          style={{
                            borderTop: "1px dashed var(--cb-ddd6fe, #DDD6FE)",
                            paddingTop: "7px",
                            display: "flex",
                            flexDirection: "column",
                            gap: "3px",
                            fontSize: "0.74rem",
                          }}
                        >
                          <div style={{ display: "flex", justifyContent: "space-between", color: "var(--ct-57524c, #57524C)" }}>
                            <span>Suma de elementos por separado:</span>
                            <span style={{ textDecoration: sumaSetNominal > pvpActual ? "line-through" : "none" }}>
                              ${sumaSetNominal.toFixed(2)}
                            </span>
                          </div>
                          <div style={{ display: "flex", justifyContent: "space-between", fontWeight: 800, color: "var(--ct-5b21b6, #5B21B6)" }}>
                            <span>
                              Precio Set Completo{pctDescuentoEfectivo > 0 ? ` (-${pctDescuentoEfectivo}%)` : ""}:
                            </span>
                            <span>${pvpActual.toFixed(2)}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Selector de Variantes / Tamaños */}
                  {(modoVista === "admin" ? variantesLista.length >= 1 : variantesLista.length > 1) && (
                    <div style={{ marginBottom: "12px" }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px",
                          marginBottom: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span
                          style={{
                            fontSize: "0.71rem",
                            fontWeight: 800,
                            color: "var(--ct-57524c, #57524C)",
                            textTransform: "uppercase",
                            letterSpacing: "0.02em",
                          }}
                        >
                          {modoVista === "admin"
                            ? esFloristeria
                              ? `Tamaños y variantes (${variantesLista.length})`
                              : `Variantes (${variantesLista.length})`
                            : esFloristeria
                            ? "Tamaño:"
                            : "Opción:"}
                        </span>
                        {modoVista === "admin" && (
                          <span style={{ fontSize: "0.66rem", color: "var(--ct-847d74, #847D74)", fontWeight: 600 }}>
                            Toca para ver • ✏️ editar
                          </span>
                        )}
                      </div>

                      {modoVista === "admin" ? (
                        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                          {variantesLista.map((v, vIdx) => {
                            const activa = currentVarId === v.var_id;
                            const colVar =
                              PALETA_COLORES_VARIANTES[vIdx % PALETA_COLORES_VARIANTES.length] ||
                              PALETA_COLORES_VARIANTES[0]!;
                            const pvpVarItem = calcularPvpVariante(v);
                            const precioTexto = pvpVarItem > 0 ? pvpVarItem.toFixed(2) : "0.00";
                            const compVarItem =
                              v.var_precio_comparacion && Number(v.var_precio_comparacion) > pvpVarItem
                                ? Number(v.var_precio_comparacion)
                                : 0;
                            const pctVarOferta =
                              compVarItem > 0
                                ? Math.round(((compVarItem - pvpVarItem) / compVarItem) * 100)
                                : 0;
                            const resumenVar = obtenerResumenVariante(v);
                            const skuVarItem = typeof v.var_sku === "string" ? v.var_sku.trim() : "";

                            return (
                              <div
                                key={v.var_id}
                                role="button"
                                tabIndex={0}
                                onClick={() => {
                                  setVarianteSeleccionadaPorProducto((prev) => ({
                                    ...prev,
                                    [p.pro_id]: v.var_id,
                                  }));
                                  const fotoVarIdx = fotosDisponibles.findIndex(
                                    (f) =>
                                      f.varianteId === v.var_id ||
                                      (v.var_detalle_variante?.portada_url &&
                                        f.url === v.var_detalle_variante.portada_url)
                                  );
                                  if (fotoVarIdx >= 0) {
                                    setFotoCarouselIndexPorProducto((prev) => ({
                                      ...prev,
                                      [p.pro_id]: fotoVarIdx,
                                    }));
                                  } else {
                                    setFotoCarouselIndexPorProducto((prev) => ({
                                      ...prev,
                                      [p.pro_id]: 0,
                                    }));
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    setVarianteSeleccionadaPorProducto((prev) => ({
                                      ...prev,
                                      [p.pro_id]: v.var_id,
                                    }));
                                  }
                                }}
                                title={`Seleccionar ${v.var_nombre} ($${precioTexto}) para ver sus características`}
                                aria-label={`Seleccionar variante ${v.var_nombre}`}
                                style={{
                                  padding: "7px 9px",
                                  borderRadius: "9px",
                                  border: activa
                                    ? `1.5px solid ${colVar.border}`
                                    : "1px solid var(--cb-e6e2da, #E6E2DA)",
                                  background: activa ? colVar.bg : "var(--cf-ffffff, #FFFFFF)",
                                  cursor: "pointer",
                                  display: "flex",
                                  alignItems: "flex-start",
                                  justifyContent: "space-between",
                                  gap: "8px",
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <div style={{ minWidth: 0, flex: 1 }}>
                                  <div
                                    style={{
                                      display: "flex",
                                      alignItems: "center",
                                      flexWrap: "wrap",
                                      gap: "5px",
                                      lineHeight: 1.25,
                                    }}
                                  >
                                    <span
                                      style={{
                                        width: "8px",
                                        height: "8px",
                                        borderRadius: "50%",
                                        background: colVar.dot,
                                        flexShrink: 0,
                                      }}
                                    />
                                    <span
                                      style={{
                                        fontSize: "0.78rem",
                                        fontWeight: activa ? 800 : 700,
                                        color: activa ? colVar.text : "var(--ct-1f1c19, #1F1C19)",
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {v.var_nombre}
                                    </span>
                                    {skuVarItem && (
                                      <span
                                        style={{
                                          fontSize: "0.64rem",
                                          fontWeight: 700,
                                          color: "var(--ct-6e675f, #6E675F)",
                                          background: "var(--cf-ffffff-a800, rgba(255,255,255,0.8))",
                                          border: "1px solid var(--cb-e2ddd4, #E2DDD4)",
                                          borderRadius: "5px",
                                          padding: "0px 5px",
                                        }}
                                      >
                                        {skuVarItem}
                                      </span>
                                    )}
                                  </div>
                                  {resumenVar && (
                                    <div
                                      style={{
                                        marginTop: "3px",
                                        marginLeft: "13px",
                                        fontSize: "0.7rem",
                                        color: "var(--ct-57524c, #57524C)",
                                        lineHeight: 1.35,
                                        wordBreak: "break-word",
                                      }}
                                    >
                                      {resumenVar}
                                    </div>
                                  )}
                                </div>

                                <div
                                  style={{
                                    display: "flex",
                                    alignItems: "center",
                                    gap: "6px",
                                    flexShrink: 0,
                                  }}
                                >
                                  <div style={{ textAlign: "right", lineHeight: 1.15 }}>
                                    <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "4px" }}>
                                      {compVarItem > 0 && (
                                        <span
                                          style={{
                                            fontSize: "0.68rem",
                                            color: "var(--ct-847d74, #847D74)",
                                            textDecoration: "line-through",
                                            fontVariantNumeric: "tabular-nums",
                                          }}
                                        >
                                          ${compVarItem.toFixed(2)}
                                        </span>
                                      )}
                                      <strong
                                        style={{
                                          fontSize: "0.82rem",
                                          fontWeight: 800,
                                          color: compVarItem > 0 ? "var(--ct-b91c1c, #B91C1C)" : activa ? colVar.text : "var(--ct-1f1c19, #1F1C19)",
                                          fontVariantNumeric: "tabular-nums",
                                          whiteSpace: "nowrap",
                                        }}
                                      >
                                        ${precioTexto}
                                      </strong>
                                    </div>
                                    {pctVarOferta > 0 && (
                                      <span
                                        style={{
                                          display: "inline-block",
                                          marginTop: "2px",
                                          background: "var(--cf-fef2f2, #FEF2F2)",
                                          border: "1px solid var(--cb-fecaca, #FECACA)",
                                          color: "var(--ct-b91c1c, #B91C1C)",
                                          fontSize: "0.61rem",
                                          fontWeight: 800,
                                          padding: "0px 4px",
                                          borderRadius: "4px",
                                        }}
                                      >
                                        -{pctVarOferta}% OFF
                                      </span>
                                    )}
                                  </div>
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setVarianteSeleccionadaPorProducto((prev) => ({
                                        ...prev,
                                        [p.pro_id]: v.var_id,
                                      }));
                                      setProductoAEditar(p);
                                      setVarianteAEditarId(v.var_id);
                                      setModalEditarAbierto(true);
                                    }}
                                    title={`Editar variante ${v.var_nombre}`}
                                    aria-label={`Editar variante ${v.var_nombre}`}
                                    style={{
                                      width: "26px",
                                      height: "26px",
                                      borderRadius: "7px",
                                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                                      background: "var(--cf-ffffff, #FFFFFF)",
                                      color: "var(--ct-221e1b, #221E1B)",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      cursor: "pointer",
                                      flexShrink: 0,
                                    }}
                                  >
                                    <Pencil size={12} color="#8F6A2E" />
                                  </button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      ) : (
                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "6px",
                            alignItems: "center",
                          }}
                        >
                          {variantesLista.map((v, vIdx) => {
                            const activa = currentVarId === v.var_id;
                            const colVar =
                              PALETA_COLORES_VARIANTES[vIdx % PALETA_COLORES_VARIANTES.length] ||
                              PALETA_COLORES_VARIANTES[0]!;
                            const precioTexto = v.precio_total ? v.precio_total.toFixed(2) : "0.00";

                            return (
                              <button
                                key={v.var_id}
                                type="button"
                                onClick={() => {
                                  setVarianteSeleccionadaPorProducto((prev) => ({
                                    ...prev,
                                    [p.pro_id]: v.var_id,
                                  }));
                                  const fotoVarIdx = fotosDisponibles.findIndex(
                                    (f) =>
                                      f.varianteId === v.var_id ||
                                      (v.var_detalle_variante?.portada_url &&
                                        f.url === v.var_detalle_variante.portada_url)
                                  );
                                  if (fotoVarIdx >= 0) {
                                    setFotoCarouselIndexPorProducto((prev) => ({
                                      ...prev,
                                      [p.pro_id]: fotoVarIdx,
                                    }));
                                  } else {
                                    setFotoCarouselIndexPorProducto((prev) => ({
                                      ...prev,
                                      [p.pro_id]: 0,
                                    }));
                                  }
                                }}
                                title={`Seleccionar ${v.var_nombre} ($${precioTexto})`}
                                aria-label={`Seleccionar ${v.var_nombre}`}
                                style={{
                                  padding: "6px 10px",
                                  borderRadius: "8px",
                                  border: activa
                                    ? `1.5px solid ${colVar.border}`
                                    : `1px solid ${colVar.border}55`,
                                  background: activa ? colVar.bg : "var(--cf-ffffff, #FFFFFF)",
                                  color: activa ? colVar.text : "var(--ct-57524c, #57524C)",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  fontSize: "0.76rem",
                                  fontWeight: activa ? 700 : 600,
                                  transition: "all 0.15s ease",
                                }}
                              >
                                <span
                                  style={{
                                    width: "7px",
                                    height: "7px",
                                    borderRadius: "50%",
                                    background: colVar.dot,
                                    flexShrink: 0,
                                  }}
                                />
                                <span>{v.var_nombre}</span>
                                <strong
                                  style={{
                                    color: activa ? colVar.text : "var(--ct-1f1c19, #1F1C19)",
                                    fontVariantNumeric: "tabular-nums",
                                  }}
                                >
                                  ${precioTexto}
                                </strong>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* Beneficios / Características / Receta del Producto y Variante Activa */}
                  {(beneficiosLista.length > 0 ||
                    Boolean(recetaBomActual) ||
                    Boolean(detalleVarActual) ||
                    (modoVista === "admin" && (tallosActual > 0 || Boolean(skuActual)))) && (
                    <div
                      style={{
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        borderRadius: "10px",
                        padding: "10px 12px",
                        marginBottom: "14px",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.71rem",
                          fontWeight: 800,
                          color: "var(--ct-57524c, #57524C)",
                          textTransform: "uppercase",
                          letterSpacing: "0.02em",
                          marginBottom: "6px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "6px",
                          flexWrap: "wrap",
                        }}
                      >
                        <span style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                          <Sparkles size={12} color="#221E1B" />
                          <span>
                            {esFloristeria
                              ? "¿Qué incluye este arreglo?"
                              : esLegal
                              ? "Alcance y Beneficios:"
                              : "Características y Beneficios:"}
                          </span>
                        </span>
                        {modoVista === "admin" && currentVar && variantesLista.length > 1 && (
                          <span
                            style={{
                              fontSize: "0.66rem",
                              fontWeight: 700,
                              color: "var(--ct-2b4a36, #2B4A36)",
                              background: "var(--cf-e8f1eb, #E8F1EB)",
                              borderRadius: "5px",
                              padding: "1px 6px",
                              textTransform: "none",
                              letterSpacing: 0,
                            }}
                          >
                            {currentVar.var_nombre}
                          </span>
                        )}
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
                        {beneficiosLista.map((ben: string, bIdx: number) => (
                          <div
                            key={bIdx}
                            style={{
                              fontSize: "0.75rem",
                              color: "var(--ct-3a3530, #3A3530)",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              lineHeight: 1.38,
                            }}
                          >
                            <CheckCircle2 size={13} color="#2F4737" style={{ flexShrink: 0, marginTop: "2px" }} />
                            <span style={{ wordBreak: "break-word" }}>{ben}</span>
                          </div>
                        ))}

                        {detalleVarActual &&
                          !beneficiosLista.some(
                            (b) => b.toLowerCase() === detalleVarActual.toLowerCase()
                          ) && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "var(--ct-3a3530, #3A3530)",
                                display: "flex",
                                alignItems: "flex-start",
                                gap: "6px",
                                lineHeight: 1.38,
                              }}
                            >
                              <CheckCircle2 size={13} color="#2F4737" style={{ flexShrink: 0, marginTop: "2px" }} />
                              <span style={{ wordBreak: "break-word" }}>{detalleVarActual}</span>
                            </div>
                          )}

                        {recetaBomActual && (
                          <div
                            style={{
                              fontSize: "0.74rem",
                              color: "var(--ct-2b4a36, #2B4A36)",
                              background: "var(--cf-f2f6f3, #F2F6F3)",
                              border: "1px solid var(--cb-d5e4da, #D5E4DA)",
                              borderRadius: "7px",
                              padding: "6px 8px",
                              display: "flex",
                              alignItems: "flex-start",
                              gap: "6px",
                              lineHeight: 1.38,
                              marginTop: beneficiosLista.length > 0 ? "3px" : 0,
                            }}
                          >
                            <Flower2 size={13} color="#2F4737" style={{ flexShrink: 0, marginTop: "2px" }} />
                            <span style={{ wordBreak: "break-word" }}>
                              <strong>Composición:</strong> {recetaBomActual}
                            </span>
                          </div>
                        )}

                        {modoVista === "admin" && (tallosActual > 0 || skuActual) && (
                          <div
                            style={{
                              display: "flex",
                              flexWrap: "wrap",
                              gap: "5px",
                              marginTop: "4px",
                            }}
                          >
                            {skuActual && (
                              <span
                                style={{
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                  color: "var(--ct-57524c, #57524C)",
                                  background: "var(--cf-ffffff, #FFFFFF)",
                                  border: "1px solid var(--cb-e2ddd4, #E2DDD4)",
                                  borderRadius: "6px",
                                  padding: "2px 6px",
                                }}
                              >
                                SKU: {skuActual}
                              </span>
                            )}
                            {tallosActual > 0 && (
                              <span
                                style={{
                                  fontSize: "0.66rem",
                                  fontWeight: 700,
                                  color: "var(--ct-745622, #745622)",
                                  background: "var(--cf-faf6ee, #FAF6EE)",
                                  border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                                  borderRadius: "6px",
                                  padding: "2px 6px",
                                }}
                              >
                                🌹 {tallosActual} tallos
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Detalle de Precios: Vista Cliente fiel al E-Commerce vs Vista Admin tributaria */}
                  {currentVar && (
                    modoVista === "cliente" ? (
                      <div
                        style={{
                          background: "var(--cf-faf8f5, #FAF8F5)",
                          borderRadius: "10px",
                          padding: "12px",
                          marginTop: "auto",
                          border: "1px solid var(--cb-eae6df, #EAE6DF)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "4px",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "baseline", flexWrap: "wrap", gap: "8px" }}>
                          <span style={{ fontSize: "1.22rem", fontWeight: 800, color: "var(--ct-1f1c19, #1F1C19)" }}>
                            ${pvpActual.toFixed(2)}
                          </span>
                          {precioTachadoEfectivo && precioTachadoEfectivo > pvpActual && (
                            <span
                              style={{
                                fontSize: "0.88rem",
                                color: "var(--ct-847d74, #847D74)",
                                textDecoration: "line-through",
                                fontWeight: 600,
                              }}
                            >
                              ${precioTachadoEfectivo.toFixed(2)}
                            </span>
                          )}
                          {pctDescuentoEfectivo > 0 && (
                            <span
                              style={{
                                background: esComboActivo ? "#7C3AED" : "#BE123C",
                                color: "#FFFFFF",
                                fontSize: "0.68rem",
                                fontWeight: 800,
                                padding: "2px 7px",
                                borderRadius: "999px",
                              }}
                            >
                              {esComboActivo
                                ? `Set -${pctDescuentoEfectivo}% OFF`
                                : `-${pctDescuentoEfectivo}% OFF`}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.72rem", color: "var(--ct-57524c, #57524C)" }}>
                          {esRentaProd
                            ? `Renta (${normalizarConfiguracionRenta(p.pro_detalle_producto?.renta_config).periodo}) • ${
                                (currentVar.var_tarifa_iva_porcentaje ?? 0) > 0
                                  ? `IVA ${currentVar.var_tarifa_iva_porcentaje}%`
                                  : "IVA 0%"
                              }`
                            : (currentVar.var_tarifa_iva_porcentaje ?? 0) > 0
                            ? `PVP (Inc. IVA ${currentVar.var_tarifa_iva_porcentaje}%)`
                            : "PVP (Tarifa IVA 0%)"}
                        </div>
                        {!esComboActivo && escalasVolumenVar[0] && (
                          <div style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-8f6a2e, #8F6A2E)", marginTop: "2px" }}>
                            🏷️ {describirEscalaVolumen(escalasVolumenVar[0], pvpActual)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div
                        style={{
                          background: "var(--cf-f8f7f4, #F8F7F4)",
                          borderRadius: "10px",
                          padding: "12px",
                          marginTop: "auto",
                          border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "var(--ct-847d74, #847D74)" }}>
                              Base Imponible: ${currentVar.var_precio !== undefined ? currentVar.var_precio.toFixed(2) : "0.00"}
                            </div>
                            <div style={{ fontSize: "0.7rem", color: "var(--ct-847d74, #847D74)" }}>
                              + IVA ({currentVar.var_tarifa_iva_porcentaje ?? 0}%): ${currentVar.monto_iva !== undefined ? currentVar.monto_iva.toFixed(2) : "0.00"}
                            </div>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "baseline", justifyContent: "flex-end", gap: "6px" }}>
                              {precioTachadoEfectivo && precioTachadoEfectivo > pvpActual && (
                                <span style={{ fontSize: "0.78rem", color: "var(--ct-847d74, #847D74)", textDecoration: "line-through" }}>
                                  ${precioTachadoEfectivo.toFixed(2)}
                                </span>
                              )}
                              <div style={{ fontSize: "1.02rem", fontWeight: 800, color: "var(--ct-1f1c19, #1F1C19)" }}>
                                ${pvpActual.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ fontSize: "0.65rem", color: "var(--ct-2f4737, #2F4737)", fontWeight: 700 }}>
                              TOTAL FACTURABLE
                            </div>
                          </div>
                        </div>
                        {!esComboActivo && escalasVolumenVar[0] && (
                          <div style={{ fontSize: "0.7rem", fontWeight: 700, color: "var(--ct-8f6a2e, #8F6A2E)", marginTop: "6px" }}>
                            🏷️ {describirEscalaVolumen(escalasVolumenVar[0], pvpActual)}
                          </div>
                        )}
                      </div>
                    )
                  )}

                  {/* Botón de Acción Principal (fiel a la tienda en Vista Cliente) */}
                  {modoVista === "cliente" && esFloristeria ? (
                    <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
                      <a
                        href={urlTiendaPublica}
                        target="_blank"
                        rel="noopener noreferrer"
                        title={`Abrir ficha interactiva de "${p.pro_nombre}" en la tienda`}
                        aria-label={`Ver ${p.pro_nombre} en tienda`}
                        style={{
                          flex: 1,
                          minHeight: "42px",
                          background: esEventoProd ? "#2D4734" : "#221E1B",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "10px 14px",
                          borderRadius: "10px",
                          fontSize: "0.84rem",
                          fontWeight: 700,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "7px",
                        }}
                      >
                        {esEventoProd ? <FileText size={15} /> : <ShoppingBag size={15} />}
                        <span>{esEventoProd ? "Proforma" : esComboActivo ? "Personalizar / Comprar" : "Comprar"}</span>
                      </a>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => abrirCheckout(p, currentVar?.var_id)}
                      style={{
                        marginTop: "14px",
                        minHeight: "42px",
                        background: "#221E1B",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: "10px",
                        fontSize: "0.84rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                      }}
                    >
                      <CreditCard size={16} />
                      <span>{esFloristeria ? "Vista Checkout" : "Contratar Servicio"}</span>
                    </button>
                  )}
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
          const conFecha: ProductoCatalogo = {
            ...nuevo,
            pro_creado_en: nuevo.pro_creado_en || new Date().toISOString(),
          };
          setProductos((prev) => [conFecha, ...prev]);
        }}
        onCategoriaCreada={(nueva) => {
          setCategoriasLista((prev) => [...prev, nueva]);
        }}
        categorias={categoriasLista}
        productos={productos}
        negocio={negocio}
      />

      {/* Modal Crear y Administrar Categoría */}
      <ModalCrearCategoria
        abierto={modalCatAbierto}
        tabInicial={catModalTab}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLista((prev) => [...prev, nueva]);
        }}
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
        onCategoriaCreada={(nueva) => {
          setCategoriasLista((prev) => [...prev, nueva]);
        }}
        categorias={categoriasLista}
        productos={productos}
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
              background: "#1F1C19",
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
                borderBottom: "1px solid var(--cb-57524c, #57524C)",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--ct-c8a25a, #C8A25A)", fontWeight: 700, fontSize: "0.88rem" }}>
                <Video size={17} />
                <span>Demostración en Video / Reel</span>
              </div>
              <button
                type="button"
                onClick={() => setVideoModalUrl(null)}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "var(--ct-847d74, #847D74)",
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

      <ModalGestionTiposOferta
        abierto={modalTiposOfertaAbierto}
        onCerrar={() => setModalTiposOfertaAbierto(false)}
        negocio={negocio}
        tabInicial="gestionar"
      />

      <ModalExportarImportarCatalogo
        abierto={modalMasivoAbierto}
        negocio={negocio}
        productos={productos}
        productosFiltrados={productosFiltrados}
        categorias={categoriasLista}
        onCerrar={() => setModalMasivoAbierto(false)}
        onCatalogoActualizado={cargarDatos}
      />
    </div>
  );
}
