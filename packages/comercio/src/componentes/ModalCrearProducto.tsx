"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  PackagePlus,
  Flower2,
  Scale,
  Wrench,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Clock,
  Loader2,
  Wand2,
  FolderPlus,
  Share2,
  Target,
  Tag,
  Hash,
  Upload,
  Calendar,
  Power,
  Settings2,
  ArrowLeft,
  ArrowRight,
  Truck,
  FileText,
  ClipboardCopy,
  Check,
} from "lucide-react";
import {
  crearProductoAction,
  resolverUrlImagenDirectaAction,
  verificarUsoEnCatalogoAction,
  CategoriaCatalogo,
  ProductoCatalogo,
} from "../acciones";
import { subirImagenClienteOAccion } from "../utils/clienteStorage";
import {
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  CANALES_REQUIEREN_IMAGEN,
  CanalVisibilidad,
} from "../canales";
import { TipoVigenciaTemporal } from "../utils/vigencia";
import { ModalCrearCategoria } from "./ModalCrearCategoria";
import { ModalGaleriaMedios } from "./ModalGaleriaMedios";
import { detectarTipoNegocio } from "../utils/negocio";
import { formatearConfiguracionProductoTexto } from "../utils/catalogoMasivo";
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
  type EscalaVolumenVariante,
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
  obtenerPasosWizardProducto,
  SelectorEncuadreFoto,
  type PasoWizardProducto,
} from "./BarraPasosWizardProducto";
import { EditorPersonalizacionFloralProducto } from "./EditorPersonalizacionFloralProducto";
import {
  crearConfiguracionPersonalizacionFloralPorDefecto,
  inferirTipoEnvoltorioPorColeccion,
  obtenerColoresPorDefectoEnvoltorio,
  type ConfiguracionPersonalizacionFloral,
} from "../utils/personalizacionFloral";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onProductoCreado: (prod: ProductoCatalogo) => void;
  onCategoriaCreada?: (cat: CategoriaCatalogo) => void;
  onCategoriaEliminada?: (catId: string) => void;
  categorias: CategoriaCatalogo[];
  productos?: ProductoCatalogo[];
  negocio?: string;
}

export function ModalCrearProducto({
  abierto,
  onCerrar,
  onProductoCreado,
  onCategoriaCreada,
  onCategoriaEliminada,
  categorias,
  productos = [],
  negocio = "tranqi",
}: Props) {
  const { esFloristeria, esLegal, esMantenimiento } = detectarTipoNegocio(negocio);
  const colorTema = esFloristeria ? "#221E1B" : "#221E1B";

  const [pasoActivo, setPasoActivo] = useState<PasoWizardProducto>("identidad_precio");

  const [categoriasLocales, setCategoriasLocales] = useState<CategoriaCatalogo[]>(categorias || []);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);
  const [catModalTab, setCatModalTab] = useState<"crear" | "gestionar">("crear");

  useEffect(() => {
    if (categorias && categorias.length > 0) {
      setCategoriasLocales(categorias);
      if (!categoriaId && categorias[0]) {
        setCategoriaId(categorias[0].ctg_id);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categorias]);

  // Paso 1: Identidad, Categoría, Oferta y Precio
  const [nombre, setNombre] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.ctg_id || "");
  const [tipo, setTipo] = useState<string>(esFloristeria ? "FISICO" : "SERVICIO");
  const [tiposOfertaLocales, setTiposOfertaLocales] = useState<TipoOfertaComercial[]>(() =>
    obtenerTiposOfertaPorDefecto(negocio)
  );
  const [modalTiposOfertaAbierto, setModalTiposOfertaAbierto] = useState(false);
  const [tiposOfertaTab, setTiposOfertaTab] = useState<"crear" | "gestionar">("crear");
  const [rentaConfig, setRentaConfig] = useState<ConfiguracionRentaProducto>(() =>
    normalizarConfiguracionRenta()
  );
  const [envoltorioEditadoManual, setEnvoltorioEditadoManual] = useState(false);
  const [personalizacionFloral, setPersonalizacionFloral] =
    useState<ConfiguracionPersonalizacionFloral>(() => {
      const catInicial = categorias[0];
      const tipoEnvInicial = esFloristeria
        ? inferirTipoEnvoltorioPorColeccion({
            categoriaNombre: catInicial?.ctg_nombre,
            categoriaSlug: catInicial?.ctg_slug,
          })
        : "no_aplica";
      return crearConfiguracionPersonalizacionFloralPorDefecto(esFloristeria, tipoEnvInicial);
    });

  useEffect(() => {
    if (!esFloristeria || envoltorioEditadoManual) return;
    const catSel = categoriasLocales.find((c) => c.ctg_id === categoriaId);
    if (!catSel) return;
    const tipoEnv = inferirTipoEnvoltorioPorColeccion({
      categoriaNombre: catSel.ctg_nombre,
      categoriaSlug: catSel.ctg_slug,
    });
    setPersonalizacionFloral((prev) => ({
      ...prev,
      tipoEnvoltorio: tipoEnv,
      mostrarColorBase: tipoEnv !== "no_aplica",
      coloresBaseDisponibles: obtenerColoresPorDefectoEnvoltorio(tipoEnv),
    }));
  }, [categoriaId, categoriasLocales, esFloristeria, envoltorioEditadoManual]);
  const [precioBase, setPrecioBase] = useState<number | "">("");
  const [precioComparacion, setPrecioComparacion] = useState<number | "">("");
  const [tarifaIva, setTarifaIva] = useState<number>(esFloristeria ? 0 : 15);
  const [sku, setSku] = useState("");
  const [esComboCrear, setEsComboCrear] = useState<boolean>(false);
  const [comboComponentesCrear, setComboComponentesCrear] = useState<ComponenteComboConfig[]>([]);
  const [escalasVolumenCrear, setEscalasVolumenCrear] = useState<EscalaVolumenVariante[]>([]);
  const [icono] = useState<string>(esFloristeria ? "Sparkles" : "Scale");
  const [modalidadPago] = useState("Botón Payphone / Tarjeta / Saldo");

  // Paso 2: Características (SIN valores forzados por defecto: inician vacíos para cada producto)
  const [descripcion, setDescripcion] = useState("");
  const [beneficiosTexto, setBeneficiosTexto] = useState("");
  const [requisitosTexto, setRequisitosTexto] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState(
    esFloristeria ? "🌸 Pide hoy, recibe hoy (Mismo Día)" : "24 a 48 horas hábiles"
  );

  // Paso 3: Imágenes, Encuadre y Multimedia
  const [imagenUrl, setImagenUrl] = useState("");
  const [fotoPosicion, setFotoPosicion] = useState("center center");
  const [fotoAjuste, setFotoAjuste] = useState<"cover" | "contain">("cover");
  const [fotoZoom, setFotoZoom] = useState<number>(100);
  const [galeriaTexto, setGaleriaTexto] = useState("");
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [contextoMedios, setContextoMedios] = useState<"portada" | "galeria">("portada");
  const [subiendoGaleria, setSubiendoGaleria] = useState(false);
  const [resolviendoImagen, setResolviendoImagen] = useState(false);
  const [subiendoImagen, setSubiendoImagen] = useState(false);
  const [modalGaleriaAbierto, setModalGaleriaAbierto] = useState(false);
  const [exitoAutoConvertir, setExitoAutoConvertir] = useState<string | null>(null);

  // Paso 4: Logística, Estado y Vigencia Estacional
  const [proActivo, setProActivo] = useState(true);
  const [destacado, setDestacado] = useState(false);
  const [vigenciaTipo, setVigenciaTipo] = useState<TipoVigenciaTemporal>("SIEMPRE");
  const [fechaInicio, setFechaInicio] = useState("");
  const [fechaFin, setFechaFin] = useState("");
  const [mensajeFueraTemporada, setMensajeFueraTemporada] = useState("");
  const [etiquetaTemporada, setEtiquetaTemporada] = useState("");

  const [configLogisticaNegocio, setConfigLogisticaNegocio] =
    useState<ConfiguracionLogisticaNegocio>(() => crearConfiguracionLogisticaPorDefecto(negocio));
  const [deliveryIncluido, setDeliveryIncluido] = useState<boolean>(esLegal ? false : true);
  const [modalidadTransporte, setModalidadTransporte] = useState<string>(
    esLegal ? "TELEMATICO_DIGITAL" : "INCLUIDO_GRATIS"
  );
  const [etiquetaTransporte, setEtiquetaTransporte] = useState<string>(
    esLegal
      ? "🌐 Modalidad 100% Telemática"
      : esFloristeria
        ? "🌸 Envío Gratis en Centro-Norte de Quito"
        : "🚚 Visita Técnica Incluida"
  );
  const [coberturaTransporte, setCoberturaTransporte] = useState<string>(
    esLegal ? "Nacional (Ecuador)" : "Centro-Norte de Quito"
  );
  const [recargoTransporteUsd, setRecargoTransporteUsd] = useState<number>(0);

  // Paso 5: Canales, Usos y Etiquetas IA
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<CanalVisibilidad[]>([
    ...CANALES_POR_DEFECTO,
  ]);
  const [usosSeleccionados, setUsosSeleccionados] = useState<string[]>([]);
  const [nuevoUsoTexto, setNuevoUsoTexto] = useState("");
  const [etiquetasSeleccionadas, setEtiquetasSeleccionadas] = useState<string[]>([]);
  const [nuevaEtiquetaTexto, setNuevaEtiquetaTexto] = useState("");

  const [usosEliminados, setUsosEliminados] = useState<string[]>([]);
  const [usosPersonalizados, setUsosPersonalizados] = useState<{ clave: string; label: string }[]>(
    []
  );
  const [modalBloqueoUso, setModalBloqueoUso] = useState<{
    clave: string;
    label: string;
    productos: string[];
  } | null>(null);
  const [modalConfirmarEliminarUso, setModalConfirmarEliminarUso] = useState<{
    clave: string;
    label: string;
  } | null>(null);
  const [verificandoUsoClave, setVerificandoUsoClave] = useState<string | null>(null);
  const [mensajeExitoUso, setMensajeExitoUso] = useState<string | null>(null);

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [configCopiadaTexto, setConfigCopiadaTexto] = useState(false);

  const handleCopiarConfiguracionBorrador = async () => {
    const catSel = categoriasLocales.find((c) => c.ctg_id === categoriaId);
    const tipoObj = tiposOfertaLocales.find(
      (t) => t.tof_codigo.toUpperCase() === String(tipo || "").toUpperCase()
    );
    const precioNum = Number(precioBase) || 0;
    const precioCompNum = Number(precioComparacion) || 0;
    const texto = formatearConfiguracionProductoTexto({
      negocio,
      nombre: nombre.trim() || "(Borrador sin nombre)",
      categoriaNombre: catSel?.ctg_nombre || "Sin categoría",
      tipo,
      tipoOfertaEtiqueta: tipoObj?.tof_nombre || null,
      activo: proActivo,
      destacado,
      tarifaIvaPredeterminada: tarifaIva,
      descripcion,
      beneficios: beneficiosTexto
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      requisitos: requisitosTexto
        .split("\n")
        .map((l) => l.trim())
        .filter(Boolean),
      tiempoEntrega,
      canalesVisibilidad: canalesSeleccionados,
      usos: usosSeleccionados,
      etiquetas: etiquetasSeleccionadas,
      vigenciaTipo,
      fechaInicio: fechaInicio || null,
      fechaFin: fechaFin || null,
      etiquetaTemporada: etiquetaTemporada || null,
      mensajeFueraTemporada: mensajeFueraTemporada || null,
      logistica: {
        delivery_incluido: deliveryIncluido,
        modalidad_transporte: modalidadTransporte,
        etiqueta_transporte: etiquetaTransporte,
        cobertura_texto: coberturaTransporte,
        recargo_transporte_usd: recargoTransporteUsd,
      },
      personalizacionFloral: esFloristeria ? personalizacionFloral : null,
      imagenUrl: imagenUrl || null,
      galeriaUrls: galeriaTexto
        .split("\n")
        .map((g) => g.trim())
        .filter(Boolean),
      albumFotosUrl: albumFotosUrl || null,
      videoUrl: videoUrl || null,
      esCombo: esComboCrear,
      comboComponentes: comboComponentesCrear.map((c) => ({
        nombre: c.producto_nombre || c.producto_slug || c.producto_id,
        cantidad: c.cantidad_base,
        sku: c.variante_sku,
      })),
      variantes: [
        {
          var_sku: sku.trim() || "(Auto)",
          var_nombre: nombre.trim() || "Estándar",
          var_precio: precioNum,
          var_precio_comparacion: precioCompNum > 0 ? precioCompNum : null,
          var_tarifa_iva_porcentaje: tarifaIva,
          var_activo: proActivo,
          tipo_envoltorio: esFloristeria ? personalizacionFloral.tipoEnvoltorio : null,
          portada_url: imagenUrl || null,
          escalas_volumen: escalasVolumenCrear.map((e) => ({
            cantidad_minima: e.min_cantidad,
            tipo: e.tipo,
            valor: e.valor,
          })),
        },
      ],
    });
    try {
      await navigator.clipboard.writeText(texto);
      setConfigCopiadaTexto(true);
      setTimeout(() => setConfigCopiadaTexto(false), 2200);
    } catch {
      setError("No se pudo copiar la configuración al portapapeles.");
    }
  };

  // Al abrir el modal para crear un producto nuevo, reiniciar a un formulario limpio en Paso 1
  useEffect(() => {
    if (!abierto) return;
    setPasoActivo("identidad_precio");
    setNombre("");
    setSku("");
    setPrecioBase("");
    setPrecioComparacion("");
    setTarifaIva(esFloristeria ? 0 : 15);
    setDescripcion("");
    setBeneficiosTexto("");
    setRequisitosTexto("");
    setImagenUrl("");
    setFotoPosicion("center center");
    setFotoAjuste("cover");
    setFotoZoom(100);
    setGaleriaTexto("");
    setAlbumFotosUrl("");
    setVideoUrl("");
    setEsComboCrear(false);
    setComboComponentesCrear([]);
    setEscalasVolumenCrear([]);
    setProActivo(true);
    setDestacado(false);
    setVigenciaTipo("SIEMPRE");
    setFechaInicio("");
    setFechaFin("");
    setUsosSeleccionados([]);
    setEtiquetasSeleccionadas([]);
    setError(null);
    setExitoAutoConvertir(null);

    setUsosEliminados(obtenerUsosEliminadosStorage(negocio));
    setUsosPersonalizados(obtenerUsosPersonalizadosStorage(negocio));

    let vivo = true;
    const cache = leerTiposOfertaCacheLocal(negocio);
    if (cache.length > 0) setTiposOfertaLocales(cache);
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

    obtenerConfiguracionLogisticaAction(negocio)
      .then((cfg) => {
        if (!vivo || !cfg) return;
        setConfigLogisticaNegocio(cfg);
        if (!esLegal) {
          setCoberturaTransporte(cfg.zonaGratisNombre || "Centro-Norte de Quito");
          if (esFloristeria && cfg.etiquetaEnvioGratis) {
            setEtiquetaTransporte(cfg.etiquetaEnvioGratis);
          }
        }
      })
      .catch(() => {});

    return () => {
      vivo = false;
    };
  }, [abierto, negocio, esFloristeria, esLegal]);

  const esOfertaRentaActiva = useMemo(
    () => esCodigoOfertaRenta(tipo, undefined, tiposOfertaLocales),
    [tipo, tiposOfertaLocales]
  );

  const presetsBase = useMemo(() => obtenerPresetsPorNegocio(negocio), [negocio]);
  const presetsUsosActivos = useMemo(
    () => presetsBase.filter((p) => !usosEliminados.includes(p.clave)),
    [presetsBase, usosEliminados]
  );

  const todosUsosDisponibles = useMemo(() => {
    const mapa = new Map<string, { clave: string; label: string; esPreset: boolean }>();
    for (const p of presetsUsosActivos) {
      mapa.set(p.clave, { clave: p.clave, label: p.label, esPreset: true });
    }
    for (const u of usosPersonalizados) {
      if (!usosEliminados.includes(u.clave) && !mapa.has(u.clave)) {
        mapa.set(u.clave, { clave: u.clave, label: u.label, esPreset: false });
      }
    }
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

  const tieneAlMenosUnaImagen = useMemo(() => {
    if (imagenUrl && imagenUrl.trim().length > 0) return true;
    if (galeriaTexto && galeriaTexto.trim().length > 0) return true;
    if (albumFotosUrl && albumFotosUrl.trim().length > 0) return true;
    return false;
  }, [imagenUrl, galeriaTexto, albumFotosUrl]);

  const fotosCrear = useMemo(() => {
    const list: string[] = [];
    if (imagenUrl && imagenUrl.trim()) list.push(imagenUrl.trim());
    if (galeriaTexto && galeriaTexto.trim()) {
      galeriaTexto.split("\n").forEach((u) => {
        const trimmed = u.trim();
        if (trimmed && !list.includes(trimmed)) list.push(trimmed);
      });
    }
    return list;
  }, [imagenUrl, galeriaTexto]);

  const listaViñetasPreview = useMemo(
    () =>
      beneficiosTexto
        .split("\n")
        .map((b) => b.trim())
        .filter((b) => b.length > 0),
    [beneficiosTexto]
  );

  const baseNum = typeof precioBase === "number" ? precioBase : 0;
  const montoIvaCalc = Number(((baseNum * tarifaIva) / 100).toFixed(2));
  const totalCalc = Number((baseNum + montoIvaCalc).toFixed(2));

  const mostrarPasoColoresFlores = esFloristeria && !esOfertaRentaActiva;
  const pasosWizardActivos = useMemo(
    () => obtenerPasosWizardProducto(mostrarPasoColoresFlores),
    [mostrarPasoColoresFlores]
  );

  const completadosPorPaso = useMemo<Partial<Record<PasoWizardProducto, boolean>>>(
    () => ({
      identidad_precio: Boolean(nombre.trim() && baseNum > 0),
      colores_flores: Boolean(personalizacionFloral.habilitada),
      caracteristicas: Boolean(descripcion.trim() || listaViñetasPreview.length > 0),
      imagenes: tieneAlMenosUnaImagen,
      logistica: Boolean(proActivo || vigenciaTipo !== "SIEMPRE"),
      canales_ia: canalesSeleccionados.length > 0,
    }),
    [
      nombre,
      baseNum,
      personalizacionFloral.habilitada,
      descripcion,
      listaViñetasPreview.length,
      tieneAlMenosUnaImagen,
      proActivo,
      vigenciaTipo,
      canalesSeleccionados.length,
    ]
  );

  const presetsEntrega = esFloristeria
    ? [
        { label: "⚡ Entrega Inmediata (45-90 min)", val: "⚡ Entrega Inmediata Express (45 - 90 min)" },
        { label: "🌸 Pide hoy, recibe hoy (Mismo Día)", val: "🌸 Pide hoy, recibe hoy (Mismo Día)" },
        { label: "✨ Elaboración Especial (24h)", val: "✨ Elaboración Especial en Taller (24 horas)" },
        { label: "📅 Entrega Programada / Evento", val: "📅 Entrega Programada / Fecha Especial" },
      ]
    : esLegal
      ? [
          { label: "⚡ Agendamiento Mismo Día", val: "Agendamiento inmediato / Mismo día" },
          { label: "📄 Menos de 24 horas", val: "Menos de 24 horas" },
          { label: "⚖️ 24 a 48 horas hábiles", val: "24 a 48 horas hábiles" },
        ]
      : [
          { label: "⚡ Emergencia Técnica (45-60 min)", val: "⚡ Emergencia Técnica (45 - 60 min)" },
          { label: "🔧 Turno Mismo Día", val: "🔧 Mismo Día / Turno Tarde" },
          { label: "📅 Visita Programada", val: "📅 Visita Programada" },
        ];

  if (!abierto) return null;

  const indicePaso = Math.max(
    0,
    pasosWizardActivos.findIndex((p) => p.id === pasoActivo)
  );

  const irPasoSiguiente = () => {
    setError(null);
    if (pasoActivo === "identidad_precio") {
      if (!nombre.trim()) {
        setError("Ingresa el nombre del producto antes de continuar.");
        return;
      }
      if (!precioBase || Number(precioBase) <= 0) {
        setError("Ingresa un precio base mayor a $0.00 para continuar.");
        return;
      }
    }
    const sig = pasosWizardActivos[indicePaso + 1];
    if (sig) setPasoActivo(sig.id);
  };

  const irPasoAnterior = () => {
    setError(null);
    const ant = pasosWizardActivos[indicePaso - 1];
    if (ant) setPasoActivo(ant.id);
  };

  const toggleUso = (clave: string) => {
    const normalizada = clave.toLowerCase().trim();
    setUsosSeleccionados((prev) =>
      prev.includes(normalizada) ? prev.filter((u) => u !== normalizada) : [...prev, normalizada]
    );
  };

  const handleAgregarUsoPersonalizado = () => {
    const limpio = nuevoUsoTexto.trim().toLowerCase().replace(/\s+/g, "_");
    if (!limpio) return;
    const label = `🏷️ ${nuevoUsoTexto.trim().replace(/\b\w/g, (c) => c.toUpperCase())}`;

    if (usosEliminados.includes(limpio)) {
      const restantes = usosEliminados.filter((k) => k !== limpio);
      setUsosEliminados(restantes);
      guardarUsosEliminadosStorage(negocio, restantes);
    }
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

  const handleSolicitarEliminarUso = async (clave: string, label: string) => {
    setVerificandoUsoClave(clave);
    try {
      const prodsQueUsanLocal = verificarUsoEnProductosLocales(
        clave,
        productos,
        undefined,
        usosSeleccionados
      );
      if (prodsQueUsanLocal.length > 0) {
        setModalBloqueoUso({ clave, label, productos: prodsQueUsanLocal });
        return;
      }
      const resServer = await verificarUsoEnCatalogoAction({ negocio, claveUso: clave });
      if (resServer.enUso && resServer.nombresProductos.length > 0) {
        setModalBloqueoUso({ clave, label, productos: resServer.nombresProductos });
        return;
      }
      setModalConfirmarEliminarUso({ clave, label });
    } catch {
      setModalConfirmarEliminarUso({ clave, label });
    } finally {
      setVerificandoUsoClave(null);
    }
  };

  const ejecutarEliminacionUso = (clave: string, label: string) => {
    const actualizados = Array.from(new Set([...usosEliminados, clave]));
    setUsosEliminados(actualizados);
    guardarUsosEliminadosStorage(negocio, actualizados);
    const persActualizados = usosPersonalizados.filter((u) => u.clave !== clave);
    setUsosPersonalizados(persActualizados);
    guardarUsosPersonalizadosStorage(negocio, persActualizados);
    setUsosSeleccionados((prev) => prev.filter((u) => u !== clave));
    setModalConfirmarEliminarUso(null);
    setMensajeExitoUso(`Uso «${label}» eliminado correctamente del catálogo.`);
    setTimeout(() => setMensajeExitoUso(null), 3500);
  };

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

  const toggleCanal = (clave: CanalVisibilidad) => {
    if (
      CANALES_REQUIEREN_IMAGEN.includes(clave) &&
      !canalesSeleccionados.includes(clave) &&
      !tieneAlMenosUnaImagen
    ) {
      setError(
        "Para activar E-Commerce Web o App Clientes, configura primero al menos 1 imagen en el Paso 3 (Imágenes y Galería)."
      );
      return;
    }
    setError(null);
    setCanalesSeleccionados((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    );
  };

  const handleNombreChange = (val: string) => {
    setNombre(val);
    const prefijo = negocio.toUpperCase().substring(0, 3);
    const clean = val
      .toUpperCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Z0-9]+/g, "")
      .substring(0, 8);
    setSku(clean ? `${prefijo}-${clean}` : "");
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
        setExitoAutoConvertir("¡Enlace de Google Fotos convertido con éxito a imagen directa!");
      } else {
        setError(res.error || "No se pudo convertir automáticamente la URL de Google Fotos.");
      }
    } catch (e: any) {
      setError(`Error al convertir: ${e.message || e}`);
    } finally {
      setResolviendoImagen(false);
    }
  };

  const LIMITE_MAX_IMAGEN_BYTES = 5 * 1024 * 1024;

  const handleSubirArchivoLocal = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);
    setExitoAutoConvertir(null);

    const listaArchivos = Array.from(files);
    for (const f of listaArchivos) {
      if (f.size > LIMITE_MAX_IMAGEN_BYTES) {
        const tamanoMb = (f.size / (1024 * 1024)).toFixed(2);
        setError(`⚠️ La imagen "${f.name}" supera el límite de 5 MB (${tamanoMb} MB).`);
        e.target.value = "";
        return;
      }
    }

    setSubiendoImagen(true);
    try {
      const nuevasUrls: string[] = [];
      for (const file of listaArchivos) {
        const res = await subirImagenClienteOAccion(file, negocio || "comun", "portadas");
        if (res.ok && res.urlPublica) nuevasUrls.push(res.urlPublica);
      }
      if (nuevasUrls.length > 0) {
        if (!imagenUrl.trim()) {
          const [primera, ...resto] = nuevasUrls;
          setImagenUrl(primera || "");
          if (resto.length > 0) {
            setGaleriaTexto((prev) => (prev ? `${prev}\n${resto.join("\n")}` : resto.join("\n")));
          }
        } else {
          setGaleriaTexto((prev) =>
            prev ? `${prev}\n${nuevasUrls.join("\n")}` : nuevasUrls.join("\n")
          );
        }
        setExitoAutoConvertir(`¡${nuevasUrls.length} imagen(es) cargada(s) desde tu equipo!`);
      }
    } catch (err: any) {
      setError(`Error al cargar la imagen: ${err.message || err}`);
    } finally {
      setSubiendoImagen(false);
      e.target.value = "";
    }
  };

  const handleSubirArchivoGaleria = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    setError(null);

    const listaArchivos = Array.from(files);
    for (const f of listaArchivos) {
      if (f.size > LIMITE_MAX_IMAGEN_BYTES) {
        const tamanoMb = (f.size / (1024 * 1024)).toFixed(2);
        setError(`⚠️ El archivo "${f.name}" supera el límite de 5 MB (${tamanoMb} MB).`);
        e.target.value = "";
        return;
      }
    }

    setSubiendoGaleria(true);
    try {
      const nuevasUrls: string[] = [];
      for (const file of listaArchivos) {
        const res = await subirImagenClienteOAccion(file, negocio || "comun", "galeria");
        if (res.ok && res.urlPublica) nuevasUrls.push(res.urlPublica);
      }
      if (nuevasUrls.length > 0) {
        if (!imagenUrl.trim()) {
          const [primera, ...resto] = nuevasUrls;
          setImagenUrl(primera || "");
          if (resto.length > 0) {
            setGaleriaTexto((prev) => (prev ? `${prev}\n${resto.join("\n")}` : resto.join("\n")));
          }
        } else {
          setGaleriaTexto((prev) =>
            prev ? `${prev}\n${nuevasUrls.join("\n")}` : nuevasUrls.join("\n")
          );
        }
      }
    } catch (err: any) {
      setError(`Error al subir la imagen: ${err.message || err}`);
    } finally {
      setSubiendoGaleria(false);
      e.target.value = "";
    }
  };

  const handleEstablecerPortadaCrear = (url: string) => {
    if (!url || url === imagenUrl) return;
    const todas = [...fotosCrear];
    const reordenadas = [url, ...todas.filter((u) => u !== url)];
    setImagenUrl(reordenadas[0] || "");
    setGaleriaTexto(reordenadas.slice(1).join("\n"));
  };

  const handleQuitarFotoCrear = (urlAQuitar: string) => {
    const todas = fotosCrear.filter((u) => u !== urlAQuitar);
    if (todas.length === 0) {
      setImagenUrl("");
      setGaleriaTexto("");
    } else {
      setImagenUrl(todas[0] || "");
      setGaleriaTexto(todas.slice(1).join("\n"));
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setPasoActivo("identidad_precio");
      setError("Ingresa el nombre del producto.");
      return;
    }
    if (!precioBase || Number(precioBase) <= 0) {
      setPasoActivo("identidad_precio");
      setError("El precio base debe ser mayor a $0.00.");
      return;
    }

    setGuardando(true);

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
        setPasoActivo("imagenes");
        setError(
          `⚠️ La URL de portada de Google Fotos no pudo convertirse automáticamente (${resImg.error}). Sube la foto desde tu PC o pega el enlace directo.`
        );
        return;
      }
    }

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
      const res = await crearProductoAction({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        esRenta: esOfertaRentaActiva,
        tipoOfertaEtiqueta: obtenerEtiquetaCortaTipoOferta(tipo, undefined, tiposOfertaLocales),
        rentaConfig: esOfertaRentaActiva ? rentaConfig : undefined,
        precioBase: Number(precioBase),
        precioComparacion:
          typeof precioComparacion === "number" && precioComparacion > 0
            ? precioComparacion
            : undefined,
        tarifaIva,
        sku: sku.trim() || undefined,
        destacado,
        icono: icono as any,
        imagenUrl: imagenUrlFinal || undefined,
        fotoPosicion,
        fotoAjuste,
        fotoZoom,
        galeriaUrls: galeriaUrls.length > 0 ? galeriaUrls : undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        beneficios,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        requisitos,
        modalidadPago,
        logistica: {
          delivery_incluido: deliveryIncluido,
          modalidad_transporte: modalidadTransporte,
          etiqueta_transporte: etiquetaTransporte,
          cobertura_texto: coberturaTransporte,
          recargo_transporte_usd: recargoTransporteUsd > 0 ? recargoTransporteUsd : 0,
        },
        pro_activo: proActivo,
        vigencia_tipo: vigenciaTipo,
        fecha_inicio: fechaInicio.trim() || undefined,
        fecha_fin: fechaFin.trim() || undefined,
        mensaje_fuera_temporada: mensajeFueraTemporada.trim() || undefined,
        etiqueta_temporada: etiquetaTemporada.trim() || undefined,
        usos: usosSeleccionados,
        etiquetas: etiquetasSeleccionadas,
        canales_visibilidad: canalesSeleccionados,
        esCombo: esComboCrear,
        comboComponentes: esComboCrear ? normalizarComponentesCombo(comboComponentesCrear) : [],
        escalasVolumen: normalizarEscalasVolumen(escalasVolumenCrear),
        personalizacionFloral:
          esFloristeria && !esOfertaRentaActiva ? personalizacionFloral : null,
        negocio,
      });

      if (res.ok && res.producto) {
        onProductoCreado(res.producto);
        onCerrar();
      } else {
        setError(res.error || "No se pudo registrar el producto.");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la creación.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      className="modal-comercio-crear-overlay"
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
      <style>{`
        @media (max-width: 640px) {
          .modal-comercio-crear-overlay {
            padding: 0 !important;
            align-items: flex-end !important;
          }
          .modal-comercio-crear-dialog {
            max-width: 100% !important;
            max-height: 100dvh !important;
            height: 100dvh !important;
            border-radius: 0 !important;
          }
          .modal-comercio-crear-dialog input,
          .modal-comercio-crear-dialog select,
          .modal-comercio-crear-dialog textarea {
            font-size: 16px !important;
          }
          .modal-comercio-crear-footer {
            padding: 10px 14px max(12px, env(safe-area-inset-bottom)) !important;
          }
        }
      `}</style>
      <div
        className="modal-comercio-crear-dialog"
        style={{
          background: "var(--cf-ffffff, #FFFFFF)",
          borderRadius: "16px",
          width: "100%",
          maxWidth: "740px",
          maxHeight: "92dvh",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "14px 20px",
            borderBottom: "1px solid var(--cb-e6e2da, #E6E2DA)",
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
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "rgba(255,255,255,0.12)",
                color: esFloristeria ? "#FB7185" : "#38BDF8",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esFloristeria ? (
                <Flower2 size={20} />
              ) : esMantenimiento ? (
                <Wrench size={20} />
              ) : (
                <PackagePlus size={20} />
              )}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#FFFFFF" }}>
                {esFloristeria
                  ? "Asistente de Nuevo Producto / Arreglo"
                  : esMantenimiento
                    ? "Asistente de Nuevo Servicio Técnico"
                    : "Asistente de Nuevo Producto / Servicio"}
              </h2>
              <span style={{ fontSize: "0.74rem", color: "var(--ct-847d74, #847D74)" }}>
                Paso {indicePaso + 1} de {pasosWizardActivos.length} ·{" "}
                {nombre.trim() ? `${nombre} ($${totalCalc.toFixed(2)})` : "Configuración guiada"}
              </span>
            </div>
          </div>

          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexShrink: 0 }}>
            <button
              type="button"
              onClick={() => void handleCopiarConfiguracionBorrador()}
              className="btn-responsive-accion"
              title="Copiar en texto todos los detalles configurados hasta este paso"
              aria-label="Copiar Config"
              style={{
                background: configCopiadaTexto
                  ? "rgba(5, 150, 105, 0.28)"
                  : "rgba(255, 255, 255, 0.1)",
                color: configCopiadaTexto ? "#A7F3D0" : "#E6E2DA",
                border: configCopiadaTexto
                  ? "1px solid var(--cb-a7f3d0-a450, rgba(167, 243, 208, 0.45))"
                  : "1px solid var(--cb-ffffff-a200, rgba(255, 255, 255, 0.2))",
                height: "32px",
                padding: "0 10px",
                borderRadius: "8px",
                fontSize: "0.75rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
              }}
            >
              {configCopiadaTexto ? <Check size={14} /> : <ClipboardCopy size={14} />}
              <span className="btn-texto-responsive">
                {configCopiadaTexto ? "Copiado" : "Copiar Config"}
              </span>
            </button>

            <button
              type="button"
              onClick={onCerrar}
              title="Cerrar asistente"
              aria-label="Cerrar"
              style={{
                background: "transparent",
                border: "none",
                cursor: "pointer",
                color: "var(--ct-847d74, #847D74)",
                padding: "6px",
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Barra de Pasos del Wizard */}
        <BarraPasosWizardProducto
          pasoActivo={pasoActivo}
          onCambiarPaso={(nuevo) => {
            setError(null);
            setPasoActivo(nuevo);
          }}
          completados={completadosPorPaso}
          colorPrimario={colorTema}
          mostrarPasoColoresFlores={mostrarPasoColoresFlores}
        />

        {/* Contenido del Paso Activo */}
        <form
          onSubmit={handleGuardar}
          style={{
            display: "flex",
            flexDirection: "column",
            flex: 1,
            minHeight: 0,
          }}
        >
          <div style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
            {error && (
              <div
                style={{
                  background: "var(--cf-faf2f2, #FAF2F2)",
                  border: "1px solid var(--cb-debaba, #DEBABA)",
                  color: "var(--ct-8a2e2e, #8A2E2E)",
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

            {/* ===============================================================
                PASO 1: NOMBRE, CATEGORÍA, TIPO DE OFERTA Y PRECIO
            =============================================================== */}
            {pasoActivo === "identidad_precio" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                    gap: "12px",
                  }}
                >
                  <div style={{ gridColumn: "1 / -1" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.8rem",
                        fontWeight: 700,
                        color: "var(--ct-221e1b, #221E1B)",
                        marginBottom: "4px",
                      }}
                    >
                      Nombre del Producto / Servicio *
                    </label>
                    <input
                      type="text"
                      placeholder={
                        esFloristeria
                          ? "Ej. Bouquet Coreano Rosado / Números de Luces / Aro Floral"
                          : "Ej. Elaboración de Minuta"
                      }
                      value={nombre}
                      onChange={(e) => handleNombreChange(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.92rem",
                        boxSizing: "border-box",
                        fontWeight: 700,
                      }}
                    />
                  </div>

                  <div>
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>
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
                            color: colorTema,
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <FolderPlus size={12} />
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
                            color: "var(--ct-847d74, #847D74)",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Settings2 size={12} />
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
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.85rem",
                        background: "var(--cf-ffffff, #FFFFFF)",
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
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: "4px",
                      }}
                    >
                      <label style={{ fontSize: "0.78rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>
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
                            color: colorTema,
                            fontSize: "0.73rem",
                            fontWeight: 700,
                            cursor: "pointer",
                          }}
                        >
                          + Nueva
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
                            color: "var(--ct-847d74, #847D74)",
                            fontSize: "0.73rem",
                            fontWeight: 600,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "3px",
                          }}
                        >
                          <Settings2 size={12} />
                          <span>Gestionar</span>
                        </button>
                      </div>
                    </div>
                    <SelectConBuscador
                      value={tipo}
                      onChange={(e) => {
                        const nextTipo = e.target.value;
                        setTipo(nextTipo);
                        const objOferta = tiposOfertaLocales.find(
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
                        border: esOfertaRentaActiva ? "1.5px solid #8F6A2E" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.85rem",
                        background: esOfertaRentaActiva ? "var(--cf-fffdf5, #FFFDF5)" : "var(--cf-ffffff, #FFFFFF)",
                        fontWeight: esOfertaRentaActiva ? 700 : 500,
                      }}
                    >
                      {tiposOfertaLocales.map((op) => (
                        <option key={op.tof_codigo} value={op.tof_codigo}>
                          {op.tof_nombre}
                        </option>
                      ))}
                    </SelectConBuscador>
                  </div>
                </div>

                {esOfertaRentaActiva && (
                  <PanelCondicionesRentaProducto config={rentaConfig} onChange={setRentaConfig} />
                )}

                {/* Bloque de Precio, Oferta, SKU e IVA */}
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "4px",
                        }}
                      >
                        Precio Base ($ USD) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="0.00"
                        value={precioBase}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setPrecioBase("");
                            return;
                          }
                          const num = parseFloat(val);
                          if (!isNaN(num)) setPrecioBase(Math.round(num * 100) / 100);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.95rem",
                          fontWeight: 800,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--ct-8f6a2e, #8F6A2E)",
                          marginBottom: "4px",
                        }}
                      >
                        Precio Tachado / Oferta ($)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="Opcional"
                        value={precioComparacion}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "") {
                            setPrecioComparacion("");
                            return;
                          }
                          const num = parseFloat(val);
                          if (!isNaN(num)) setPrecioComparacion(Math.round(num * 100) / 100);
                        }}
                        style={{
                          width: "100%",
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.92rem",
                          fontWeight: 700,
                          color: "var(--ct-8f6a2e, #8F6A2E)",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "4px",
                        }}
                      >
                        Tarifa IVA SRI
                      </label>
                      <SelectConBuscador
                        value={tarifaIva}
                        onChange={(e) => setTarifaIva(Number(e.target.value))}
                        style={{
                          width: "100%",
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.84rem",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          fontWeight: 700,
                        }}
                      >
                        <option value={0}>IVA 0% (Flores / Exento)</option>
                        <option value={15}>IVA 15% (Tarifa General)</option>
                      </SelectConBuscador>
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.75rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "4px",
                        }}
                      >
                        Código SKU
                      </label>
                      <input
                        type="text"
                        value={sku}
                        onChange={(e) => setSku(e.target.value)}
                        placeholder="Auto-generado"
                        style={{
                          width: "100%",
                          padding: "8px 11px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.83rem",
                          fontWeight: 600,
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      marginTop: "10px",
                      padding: "8px 12px",
                      background: "var(--cf-ffffff, #FFFFFF)",
                      border: "1px dashed var(--cb-d5cfc4, #D5CFC4)",
                      borderRadius: "8px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      fontSize: "0.8rem",
                      flexWrap: "wrap",
                      gap: "8px",
                    }}
                  >
                    <div>
                      <span style={{ color: "var(--ct-847d74, #847D74)" }}>Base: </span>
                      <strong>${baseNum.toFixed(2)}</strong>
                      <span style={{ margin: "0 6px", color: "#D5CFC4" }}>|</span>
                      <span style={{ color: "var(--ct-847d74, #847D74)" }}>IVA ({tarifaIva}%): </span>
                      <strong>${montoIvaCalc.toFixed(2)}</strong>
                    </div>
                    <div>
                      <span style={{ color: "var(--ct-847d74, #847D74)", marginRight: "6px" }}>PVP Final:</span>
                      <strong style={{ color: "var(--ct-2f4737, #2F4737)", fontSize: "0.9rem", fontWeight: 800 }}>
                        ${totalCalc.toFixed(2)}
                      </strong>
                    </div>
                  </div>

                  <EditorEscalasVolumenVariante
                    escalas={escalasVolumenCrear}
                    pvpUnitarioNominal={totalCalc}
                    onChange={setEscalasVolumenCrear}
                  />
                </div>

                <EditorSetComboConfigurable
                  esCombo={esComboCrear}
                  onCambiarEsCombo={setEsComboCrear}
                  componentes={comboComponentesCrear}
                  onCambiarComponentes={(nuevos) => {
                    setComboComponentesCrear(nuevos);
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
                          : Number(
                              (
                                Number(v.var_precio || 0) *
                                (1 + Number(v.var_tarifa_iva_porcentaje || 0) / 100)
                              ).toFixed(2)
                            )
                        : 0;
                      return acc + pvpV * comp.cantidad_base;
                    }, 0);
                    if (suma > totalCalc) {
                      setPrecioComparacion(Number(suma.toFixed(2)));
                    }
                  }}
                  catalogoProductos={productos}
                  pvpSetCompleto={totalCalc}
                  tarifaIvaSet={tarifaIva}
                  onCambiarPrecioSetBase={(nuevoBase) => setPrecioBase(nuevoBase)}
                  onSincronizarPrecioComparacion={(sumaNominal) =>
                    setPrecioComparacion(Number(sumaNominal.toFixed(2)))
                  }
                />
              </div>
            )}

            {/* ===============================================================
                PASO 2: CARACTERÍSTICAS (DESCRIPCIÓN, QUÉ INCLUYE Y ENTREGA)
            =============================================================== */}
            {mostrarPasoColoresFlores && pasoActivo === "colores_flores" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <EditorPersonalizacionFloralProducto
                  valor={personalizacionFloral}
                  onChange={(nuevo) => {
                    if (nuevo.tipoEnvoltorio !== personalizacionFloral.tipoEnvoltorio) {
                      setEnvoltorioEditadoManual(true);
                    }
                    setPersonalizacionFloral(nuevo);
                  }}
                />
              </div>
            )}

            {pasoActivo === "caracteristicas" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div
                  style={{
                    padding: "12px 14px",
                    borderRadius: "10px",
                    background: "var(--cf-f4f2ee, #F4F2EE)",
                    border: "1px solid var(--cb-ddd8ce, #DDD8CE)",
                    fontSize: "0.78rem",
                    color: "var(--ct-3a3530, #3A3530)",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <FileText size={16} />
                  <span>
                    Escribe la <strong>Descripción</strong> y los <strong>Beneficios / ¿Qué incluye?</strong>{" "}
                    reales de <strong>{nombre || "este producto"}</strong>. No se rellenan textos por
                    defecto a menos que elijas una sugerencia rápida abajo.
                  </span>
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.82rem",
                      fontWeight: 800,
                      color: "var(--ct-1f1c19, #1F1C19)",
                      marginBottom: "5px",
                    }}
                  >
                    Descripción Detallada del Producto
                  </label>
                  <textarea
                    rows={4}
                    placeholder={
                      esOfertaRentaActiva
                        ? "Ej. Números luminosos de gran formato ideales para recepción de eventos, cumpleaños y bodas..."
                        : esFloristeria
                          ? "Describe el diseño, estilo, tamaño aproximado o detalles especiales del producto..."
                          : "Describe en detalle en qué consiste el producto o servicio..."
                    }
                    value={descripcion}
                    onChange={(e) => setDescripcion(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.86rem",
                      lineHeight: 1.45,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "6px",
                    }}
                  >
                    <label style={{ fontSize: "0.82rem", fontWeight: 800, color: "var(--ct-1f1c19, #1F1C19)" }}>
                      Beneficios / ¿Qué incluye? (una viñeta por línea)
                    </label>
                    <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                      {esFloristeria && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              setBeneficiosTexto(
                                "Rosas seleccionadas frescas con follaje natural\nTarjeta dedicatoria impresa incluida\nHidratación y empaque de presentación"
                              )
                            }
                            style={{
                              padding: "3px 9px",
                              borderRadius: "999px",
                              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              background: "var(--cf-ffffff, #FFFFFF)",
                              fontSize: "0.71rem",
                              fontWeight: 700,
                              color: "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            + Sugerir Flores
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              setBeneficiosTexto(
                                "Estructura / mobiliario revisado y listo para evento\nInstalación y retiro coordinado\nAsesoría en montaje decorativo"
                              )
                            }
                            style={{
                              padding: "3px 9px",
                              borderRadius: "999px",
                              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              background: "var(--cf-ffffff, #FFFFFF)",
                              fontSize: "0.71rem",
                              fontWeight: 700,
                              color: "var(--ct-57524c, #57524C)",
                              cursor: "pointer",
                            }}
                          >
                            + Sugerir Renta / Evento
                          </button>
                        </>
                      )}
                      {beneficiosTexto.trim() && (
                        <button
                          type="button"
                          onClick={() => setBeneficiosTexto("")}
                          style={{
                            padding: "3px 9px",
                            borderRadius: "999px",
                            border: "1px solid var(--cb-e5caca, #E5CACA)",
                            background: "var(--cf-faf2f2, #FAF2F2)",
                            fontSize: "0.71rem",
                            fontWeight: 700,
                            color: "var(--ct-8a2e2e, #8A2E2E)",
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
                      "Escribe un beneficio o elemento incluido por cada línea.\nEj: Incluye iluminación cálida LED\nAltura de 1.20 m\nInstalación y retiro en el lugar del evento"
                    }
                    value={beneficiosTexto}
                    onChange={(e) => setBeneficiosTexto(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.85rem",
                      lineHeight: 1.45,
                      boxSizing: "border-box",
                    }}
                  />

                  {listaViñetasPreview.length > 0 && (
                    <div
                      style={{
                        marginTop: "8px",
                        padding: "10px 12px",
                        borderRadius: "9px",
                        background: "var(--cf-f8f7f4, #F8F7F4)",
                        border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "4px",
                      }}
                    >
                      <span style={{ fontSize: "0.71rem", fontWeight: 700, color: "var(--ct-847d74, #847D74)" }}>
                        Vista previa en tienda ({listaViñetasPreview.length} viñetas):
                      </span>
                      {listaViñetasPreview.map((item, idx) => (
                        <div
                          key={idx}
                          style={{
                            fontSize: "0.78rem",
                            color: "var(--ct-221e1b, #221E1B)",
                            display: "flex",
                            alignItems: "center",
                            gap: "6px",
                          }}
                        >
                          <CheckCircle2 size={13} color="#2F4737" />
                          <span>{item}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--ct-57524c, #57524C)",
                      marginBottom: "4px",
                    }}
                  >
                    Promesa y Tiempo de Entrega
                  </label>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "6px" }}>
                    {presetsEntrega.map((pr) => (
                      <button
                        key={pr.val}
                        type="button"
                        onClick={() => setTiempoEntrega(pr.val)}
                        style={{
                          padding: "5px 9px",
                          borderRadius: "7px",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          border:
                            tiempoEntrega === pr.val
                              ? "1.5px solid #2F4737"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background: tiempoEntrega === pr.val ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-ffffff, #FFFFFF)",
                          color: tiempoEntrega === pr.val ? "var(--ct-2f4737, #2F4737)" : "var(--ct-57524c, #57524C)",
                          cursor: "pointer",
                        }}
                      >
                        {pr.label}
                      </button>
                    ))}
                  </div>
                  <input
                    type="text"
                    value={tiempoEntrega}
                    onChange={(e) => setTiempoEntrega(e.target.value)}
                    placeholder="Ej. 🌸 Pide hoy, recibe hoy (Mismo Día)"
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.84rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: "block",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      color: "var(--ct-57524c, #57524C)",
                      marginBottom: "4px",
                    }}
                  >
                    Requisitos o Condiciones para el Cliente (opcional, uno por línea)
                  </label>
                  <textarea
                    rows={2}
                    placeholder="Opcional: Ej. Punto eléctrico cercano a menos de 5 metros..."
                    value={requisitosTexto}
                    onChange={(e) => setRequisitosTexto(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>
            )}

            {/* ===============================================================
                PASO 3: IMÁGENES, GALERÍA, ENCUADRE 1:1 Y VIDEO
            =============================================================== */}
            {pasoActivo === "imagenes" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div
                  style={{
                    background: "var(--cf-f2f6f3, #F2F6F3)",
                    border: "1px solid var(--cb-bbf7d0, #BBF7D0)",
                    borderRadius: "12px",
                    padding: "16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "8px",
                      flexWrap: "wrap",
                      marginBottom: "12px",
                    }}
                  >
                    <div>
                      <div
                        style={{
                          fontSize: "0.84rem",
                          fontWeight: 800,
                          color: "var(--ct-2f4737, #2F4737)",
                          textTransform: "uppercase",
                        }}
                      >
                        📷 Galería de Fotos del Producto ({fotosCrear.length})
                      </div>
                      <span style={{ fontSize: "0.73rem", color: "var(--ct-2b4a36, #2B4A36)" }}>
                        La foto marcada como ★ #1 será la portada principal en vitrina.
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <label
                        style={{
                          background: subiendoImagen ? "#847D74" : "#2F4737",
                          color: "#FFFFFF",
                          padding: "7px 13px",
                          borderRadius: "8px",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          cursor: subiendoImagen ? "wait" : "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        {subiendoImagen ? <Loader2 size={14} /> : <Upload size={14} />}
                        <span>{subiendoImagen ? "Subiendo..." : "Subir Fotos PC"}</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          disabled={subiendoImagen}
                          onChange={handleSubirArchivoLocal}
                          style={{ display: "none" }}
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() => {
                          setContextoMedios("portada");
                          setModalGaleriaAbierto(true);
                        }}
                        style={{
                          background: "#221E1B",
                          color: "#FFFFFF",
                          border: "none",
                          padding: "7px 13px",
                          borderRadius: "8px",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <ImageIcon size={14} />
                        <span>De Galería</span>
                      </button>
                    </div>
                  </div>

                  {exitoAutoConvertir && (
                    <div
                      style={{
                        marginBottom: "10px",
                        fontSize: "0.74rem",
                        color: "var(--ct-2f4737, #2F4737)",
                        background: "var(--cf-f2f6f3, #F2F6F3)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px",
                      }}
                    >
                      <CheckCircle2 size={14} /> {exitoAutoConvertir}
                    </div>
                  )}

                  {/* Cuadrícula de miniaturas */}
                  {fotosCrear.length === 0 ? (
                    <div
                      style={{
                        border: "2px dashed var(--cb-ceddd3, #CEDDD3)",
                        borderRadius: "10px",
                        padding: "22px 16px",
                        textAlign: "center",
                        background: "var(--cf-ffffff, #FFFFFF)",
                        color: "var(--ct-57524c, #57524C)",
                        marginBottom: "12px",
                        fontSize: "0.8rem",
                      }}
                    >
                      Sube una o varias fotos desde tu equipo o selecciónalas desde la biblioteca.
                    </div>
                  ) : (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(95px, 1fr))",
                        gap: "10px",
                        marginBottom: "12px",
                      }}
                    >
                      {fotosCrear.map((url, idx) => {
                        const esPortada = idx === 0 || url === imagenUrl;
                        return (
                          <div
                            key={`${url}-${idx}`}
                            onClick={() => {
                              if (!esPortada) handleEstablecerPortadaCrear(url);
                            }}
                            title={esPortada ? "Foto de Portada (#1)" : "Clic para hacer Portada"}
                            style={{
                              position: "relative",
                              borderRadius: "8px",
                              overflow: "hidden",
                              border: esPortada ? "2.5px solid #2F4737" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              aspectRatio: "1 / 1",
                              background: "#1F1C19",
                              cursor: esPortada ? "default" : "pointer",
                            }}
                          >
                            <img
                              src={url}
                              alt={`Foto ${idx + 1}`}
                              style={{ width: "100%", height: "100%", objectFit: "cover" }}
                            />
                            <div
                              style={{
                                position: "absolute",
                                top: 3,
                                left: 3,
                                right: 3,
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                              }}
                            >
                              <span
                                style={{
                                  fontSize: "0.62rem",
                                  fontWeight: 800,
                                  background: esPortada ? "#2F4737" : "rgba(0,0,0,0.65)",
                                  color: "#FFFFFF",
                                  padding: "2px 5px",
                                  borderRadius: "4px",
                                }}
                              >
                                {esPortada ? "★ Portada" : `#${idx + 1}`}
                              </span>
                              <button
                                type="button"
                                onClick={(ev) => {
                                  ev.stopPropagation();
                                  handleQuitarFotoCrear(url);
                                }}
                                style={{
                                  background: "rgba(220, 38, 38, 0.92)",
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
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Selector de Encuadre 1:1 para la portada */}
                  {imagenUrl && (
                    <SelectorEncuadreFoto
                      imagenUrl={imagenUrl}
                      posicion={fotoPosicion}
                      ajuste={fotoAjuste}
                      zoom={fotoZoom}
                      onCambiarPosicion={setFotoPosicion}
                      onCambiarAjuste={setFotoAjuste}
                      onCambiarZoom={setFotoZoom}
                      colorTema="#2F4737"
                    />
                  )}

                  {/* Pegar URL directa o convertir desde Google Fotos */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                      marginTop: "12px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "3px",
                        }}
                      >
                        URL Imagen Portada (opcional)
                      </label>
                      <input
                        type="url"
                        placeholder="https://..."
                        value={imagenUrl}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const driveMatch =
                            raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) ||
                            raw.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
                          if (driveMatch && driveMatch[1]) {
                            setImagenUrl(`https://lh3.googleusercontent.com/d/${driveMatch[1]}=w1200`);
                          } else {
                            setImagenUrl(raw);
                          }
                        }}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                        }}
                      />
                      {(imagenUrl.includes("photos.google.com") ||
                        imagenUrl.includes("photos.app.goo.gl")) && (
                        <button
                          type="button"
                          disabled={resolviendoImagen}
                          onClick={() => void handleConvertirImagenGlobal()}
                          style={{
                            marginTop: "6px",
                            background: "#221E1B",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "5px 10px",
                            borderRadius: "6px",
                            fontSize: "0.7rem",
                            fontWeight: 700,
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Wand2 size={12} />
                          <span>Auto-Convertir Google Fotos</span>
                        </button>
                      )}
                    </div>

                    <div>
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "3px",
                        }}
                      >
                        <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)" }}>
                          URLs adicionales de galería (1 por línea)
                        </label>
                        <label
                          style={{
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            color: "var(--ct-2f4737, #2F4737)",
                            cursor: "pointer",
                          }}
                        >
                          + Subir más
                          <input
                            type="file"
                            accept="image/*"
                            multiple
                            disabled={subiendoGaleria}
                            onChange={handleSubirArchivoGaleria}
                            style={{ display: "none" }}
                          />
                        </label>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="https://...foto2.jpg"
                        value={galeriaTexto}
                        onChange={(e) => setGaleriaTexto(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "6px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.76rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                      gap: "10px",
                      marginTop: "10px",
                    }}
                  >
                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "3px",
                        }}
                      >
                        URL Álbum Muestras (Google Photos)
                      </label>
                      <input
                        type="url"
                        placeholder="https://photos.app.goo.gl/..."
                        value={albumFotosUrl}
                        onChange={(e) => setAlbumFotosUrl(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>

                    <div>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.72rem",
                          fontWeight: 700,
                          color: "var(--ct-57524c, #57524C)",
                          marginBottom: "3px",
                        }}
                      >
                        URL Video / GIF Demostrativo
                      </label>
                      <input
                        type="url"
                        placeholder="https://youtube.com/... o .mp4"
                        value={videoUrl}
                        onChange={(e) => setVideoUrl(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                        }}
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                PASO 4: LOGÍSTICA, ENVÍO Y VIGENCIA ESTACIONAL
            =============================================================== */}
            {pasoActivo === "logistica" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Estado y Temporalidad */}
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: "8px",
                      marginBottom: "10px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Calendar size={16} color="#221E1B" />
                      <strong style={{ fontSize: "0.82rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        Estado en Catálogo y Vigencia Estacional
                      </strong>
                    </div>

                    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                      <button
                        type="button"
                        onClick={() => setProActivo(!proActivo)}
                        style={{
                          background: proActivo ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-faf2f2, #FAF2F2)",
                          border: proActivo ? "1.5px solid #2F4737" : "1.5px solid #8A2E2E",
                          color: proActivo ? "var(--ct-2b4a36, #2B4A36)" : "var(--ct-8a2e2e, #8A2E2E)",
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Power size={13} />
                        <span>{proActivo ? "🟢 Activo" : "⚪ Oculto"}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => setDestacado(!destacado)}
                        style={{
                          background: destacado ? "var(--cf-faf6ee, #FAF6EE)" : "var(--cf-ffffff, #FFFFFF)",
                          border: destacado ? "1.5px solid #8F6A2E" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          color: destacado ? "var(--ct-745622, #745622)" : "var(--ct-57524c, #57524C)",
                          padding: "5px 12px",
                          borderRadius: "8px",
                          fontSize: "0.75rem",
                          fontWeight: 800,
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                        }}
                      >
                        <Sparkles size={13} />
                        <span>{destacado ? "⭐ Destacado" : "☆ Normal"}</span>
                      </button>
                    </div>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {(
                      [
                        { id: "SIEMPRE", label: "🌐 Todo el Año" },
                        { id: "RANGO_FECHAS", label: "📅 Rango Fechas" },
                        { id: "ESTACIONAL_ANUAL", label: "🌸 Estacional Anual" },
                      ] as Array<{ id: TipoVigenciaTemporal; label: string }>
                    ).map((v) => (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVigenciaTipo(v.id);
                          if (v.id === "ESTACIONAL_ANUAL" && !fechaInicio) {
                            setFechaInicio("02-10");
                            setFechaFin("02-15");
                            setEtiquetaTemporada("San Valentín");
                          }
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border:
                            vigenciaTipo === v.id ? "1.5px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background: vigenciaTipo === v.id ? "var(--cf-efece6, #EFECE6)" : "var(--cf-ffffff, #FFFFFF)",
                          color: vigenciaTipo === v.id ? "var(--ct-3a3530, #3A3530)" : "var(--ct-57524c, #57524C)",
                          fontSize: "0.76rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        {v.label}
                      </button>
                    ))}
                  </div>

                  {vigenciaTipo !== "SIEMPRE" && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: "10px",
                        marginTop: "10px",
                      }}
                    >
                      <input
                        type={vigenciaTipo === "RANGO_FECHAS" ? "date" : "text"}
                        placeholder="Inicio (MM-DD)"
                        value={fechaInicio}
                        onChange={(e) => setFechaInicio(e.target.value)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.8rem",
                        }}
                      />
                      <input
                        type={vigenciaTipo === "RANGO_FECHAS" ? "date" : "text"}
                        placeholder="Fin (MM-DD)"
                        value={fechaFin}
                        onChange={(e) => setFechaFin(e.target.value)}
                        style={{
                          padding: "7px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.8rem",
                        }}
                      />
                      {vigenciaTipo === "ESTACIONAL_ANUAL" && (
                        <>
                          <input
                            type="text"
                            placeholder="Etiqueta (ej. San Valentín)"
                            value={etiquetaTemporada}
                            onChange={(e) => setEtiquetaTemporada(e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              fontSize: "0.8rem",
                            }}
                          />
                          <input
                            type="text"
                            placeholder="Aviso fuera de temporada"
                            value={mensajeFueraTemporada}
                            onChange={(e) => setMensajeFueraTemporada(e.target.value)}
                            style={{
                              padding: "7px 10px",
                              borderRadius: "8px",
                              border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                              fontSize: "0.8rem",
                            }}
                          />
                        </>
                      )}
                    </div>
                  )}
                </div>

                {/* Logística y Transporte */}
                <div
                  style={{
                    background: deliveryIncluido ? "var(--cf-f2f6f3, #F2F6F3)" : "var(--cf-f8f7f4, #F8F7F4)",
                    border: deliveryIncluido ? "1.5px solid var(--cb-ceddd3, #CEDDD3)" : "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                    <Truck size={16} color="#2F4737" />
                    <strong style={{ fontSize: "0.82rem", color: "var(--ct-221e1b, #221E1B)" }}>
                      Logística, Envíos y Modalidad de Entrega
                    </strong>
                  </div>

                  {!esLegal && (
                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fit, minmax(155px, 1fr))",
                        gap: "8px",
                        marginBottom: "10px",
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(true);
                          setModalidadTransporte("INCLUIDO_GRATIS");
                          setEtiquetaTransporte(
                            configLogisticaNegocio.etiquetaEnvioGratis ||
                              "🌸 Envío Gratis en Centro-Norte de Quito"
                          );
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border:
                            deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS"
                              ? "1.5px solid #2F4737"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            deliveryIncluido && modalidadTransporte === "INCLUIDO_GRATIS"
                              ? "var(--cf-f2f6f3, #F2F6F3)"
                              : "var(--cf-ffffff, #FFFFFF)",
                          color: "var(--ct-2b4a36, #2B4A36)",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🚚 Envío Gratis en Zona Base
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("COSTO_ADICIONAL");
                          setEtiquetaTransporte("📦 Delivery Calculado por Ubicación");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border:
                            !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL"
                              ? "1.5px solid #8F6A2E"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            !deliveryIncluido && modalidadTransporte === "COSTO_ADICIONAL"
                              ? "var(--cf-faf6ee, #FAF6EE)"
                              : "var(--cf-ffffff, #FFFFFF)",
                          color: "var(--ct-745622, #745622)",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        📦 Costo Adicional en Checkout
                      </button>

                      <button
                        type="button"
                        onClick={() => {
                          setDeliveryIncluido(false);
                          setModalidadTransporte("SOLO_RETIRO");
                          setEtiquetaTransporte("🏪 Solo Retiro en Local");
                        }}
                        style={{
                          padding: "8px 10px",
                          borderRadius: "8px",
                          border:
                            !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO"
                              ? "1.5px solid var(--cb-57524c, #57524C)"
                              : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          background:
                            !deliveryIncluido && modalidadTransporte === "SOLO_RETIRO"
                              ? "var(--cf-f4f2ee, #F4F2EE)"
                              : "var(--cf-ffffff, #FFFFFF)",
                          color: "var(--ct-221e1b, #221E1B)",
                          fontSize: "0.74rem",
                          fontWeight: 700,
                          cursor: "pointer",
                        }}
                      >
                        🏪 Solo Retiro en Local
                      </button>
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                      gap: "10px",
                    }}
                  >
                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)", marginBottom: "2px" }}>
                        Etiqueta Visible de Transporte
                      </label>
                      <input
                        type="text"
                        value={etiquetaTransporte}
                        onChange={(e) => setEtiquetaTransporte(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                          background: "var(--cf-ffffff, #FFFFFF)",
                        }}
                      />
                    </div>

                    <div>
                      <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)", marginBottom: "2px" }}>
                        Zona de Cobertura
                      </label>
                      <input
                        type="text"
                        value={coberturaTransporte}
                        onChange={(e) => setCoberturaTransporte(e.target.value)}
                        style={{
                          width: "100%",
                          padding: "7px 10px",
                          borderRadius: "6px",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          fontSize: "0.78rem",
                          boxSizing: "border-box",
                          background: "var(--cf-ffffff, #FFFFFF)",
                        }}
                      />
                    </div>

                    {!esLegal && (
                      <div>
                        <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "var(--ct-57524c, #57524C)", marginBottom: "2px" }}>
                          Recargo Especial (+USD)
                        </label>
                        <input
                          type="number"
                          step="0.50"
                          min="0"
                          value={recargoTransporteUsd}
                          onChange={(e) =>
                            setRecargoTransporteUsd(Math.max(0, Number(e.target.value) || 0))
                          }
                          style={{
                            width: "100%",
                            padding: "7px 10px",
                            borderRadius: "6px",
                            border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            fontSize: "0.78rem",
                            boxSizing: "border-box",
                            background: "var(--cf-ffffff, #FFFFFF)",
                          }}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ===============================================================
                PASO 5: CANALES DE VISIBILIDAD, OCASIONES Y ETIQUETAS IA
            =============================================================== */}
            {pasoActivo === "canales_ia" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Canales */}
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Share2 size={16} color="#221E1B" />
                      <strong style={{ fontSize: "0.82rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        Canales de Visibilidad y Venta
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.74rem", color: "var(--ct-847d74, #847D74)", fontWeight: 600 }}>
                      {canalesSeleccionados.length} activos
                    </span>
                  </div>

                  {!tieneAlMenosUnaImagen && (
                    <div
                      style={{
                        background: "var(--cf-faf6ee, #FAF6EE)",
                        border: "1px solid var(--cb-e5d7bc, #E5D7BC)",
                        borderRadius: "8px",
                        padding: "8px 10px",
                        marginBottom: "10px",
                        fontSize: "0.74rem",
                        color: "var(--ct-745622, #745622)",
                      }}
                    >
                      📷 Los canales <strong>E-Commerce Web</strong> y <strong>App Clientes</strong>{" "}
                      requieren subir al menos 1 foto en el <strong>Paso 3</strong>.
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))",
                      gap: "8px",
                    }}
                  >
                    {CANALES_CATALOGO_OFICIALES.map((c) => {
                      const activo = canalesSeleccionados.includes(c.clave);
                      const exigeFoto =
                        CANALES_REQUIEREN_IMAGEN.includes(c.clave) && !tieneAlMenosUnaImagen;
                      return (
                        <button
                          key={c.clave}
                          type="button"
                          onClick={() => toggleCanal(c.clave)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            padding: "8px 10px",
                            borderRadius: "8px",
                            border: `1.5px solid ${activo ? c.color : "var(--cb-e6e2da, #E6E2DA)"}`,
                            background: activo ? `${c.color}12` : "var(--cf-ffffff, #FFFFFF)",
                            color: activo ? "var(--ct-1f1c19, #1F1C19)" : "var(--ct-847d74, #847D74)",
                            cursor: "pointer",
                            fontSize: "0.77rem",
                            fontWeight: activo ? 700 : 500,
                            textAlign: "left",
                            opacity: exigeFoto && !activo ? 0.65 : 1,
                          }}
                        >
                          <span
                            style={{
                              width: "8px",
                              height: "8px",
                              borderRadius: "50%",
                              background: activo ? c.color : "var(--cf-d5cfc4, #D5CFC4)",
                            }}
                          />
                          <span style={{ flex: 1 }}>{c.nombre}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Usos y Ocasiones */}
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      marginBottom: "8px",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Target size={16} color="#221E1B" />
                      <strong style={{ fontSize: "0.82rem", color: "var(--ct-221e1b, #221E1B)" }}>
                        Usos y Ocasiones Recomendadas (IA y Buscador)
                      </strong>
                    </div>
                    <span style={{ fontSize: "0.73rem", color: "var(--ct-3a3530, #3A3530)", fontWeight: 700 }}>
                      {usosSeleccionados.length} seleccionados
                    </span>
                  </div>

                  {mensajeExitoUso && (
                    <div
                      style={{
                        background: "var(--cf-f2f6f3, #F2F6F3)",
                        color: "var(--ct-2b4a36, #2B4A36)",
                        border: "1px solid var(--cb-ceddd3, #CEDDD3)",
                        padding: "6px 10px",
                        borderRadius: "6px",
                        fontSize: "0.75rem",
                        marginBottom: "8px",
                      }}
                    >
                      {mensajeExitoUso}
                    </div>
                  )}

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
                      gap: "6px",
                      marginBottom: "8px",
                    }}
                  >
                    {todosUsosDisponibles.map((u) => {
                      const activo = usosSeleccionados.includes(u.clave);
                      const estaVerif = verificandoUsoClave === u.clave;
                      return (
                        <button
                          key={u.clave}
                          type="button"
                          onClick={() => toggleUso(u.clave)}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "6px 9px",
                            borderRadius: "6px",
                            fontSize: "0.74rem",
                            fontWeight: activo ? 700 : 500,
                            border: activo ? "1.5px solid var(--cb-221e1b, #221E1B)" : "1px solid var(--cb-d5cfc4, #D5CFC4)",
                            background: activo ? "var(--cf-f4f2ee, #F4F2EE)" : "var(--cf-ffffff, #FFFFFF)",
                            color: activo ? "var(--ct-3a3530, #3A3530)" : "var(--ct-57524c, #57524C)",
                            cursor: "pointer",
                            textAlign: "left",
                            gap: "4px",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {u.label}
                          </span>
                          <span
                            role="button"
                            tabIndex={0}
                            onClick={(ev) => {
                              ev.stopPropagation();
                              void handleSolicitarEliminarUso(u.clave, u.label);
                            }}
                            style={{ color: "var(--ct-847d74, #847D74)", display: "inline-flex" }}
                          >
                            {estaVerif ? <Loader2 size={11} /> : <X size={11} />}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      placeholder="Agregar otro uso u ocasión..."
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
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.76rem",
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
                      }}
                    >
                      + Uso
                    </button>
                  </div>

                  {usosEliminados.length > 0 && (
                    <button
                      type="button"
                      onClick={handleRestaurarUsosPredeterminados}
                      style={{
                        marginTop: "6px",
                        background: "transparent",
                        border: "none",
                        color: "var(--ct-221e1b, #221E1B)",
                        fontSize: "0.72rem",
                        cursor: "pointer",
                        textDecoration: "underline",
                      }}
                    >
                      ↺ Restaurar usos predeterminados
                    </button>
                  )}
                </div>

                {/* Etiquetas Semánticas */}
                <div
                  style={{
                    background: "var(--cf-f8f7f4, #F8F7F4)",
                    border: "1px solid var(--cb-e6e2da, #E6E2DA)",
                    borderRadius: "12px",
                    padding: "14px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
                    <Tag size={15} color="#221E1B" />
                    <strong style={{ fontSize: "0.8rem", color: "var(--ct-221e1b, #221E1B)" }}>
                      Etiquetas de Búsqueda (Keywords)
                    </strong>
                  </div>

                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "8px" }}>
                    {etiquetasSeleccionadas.map((tag) => (
                      <span
                        key={tag}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          background: "var(--cf-ffffff, #FFFFFF)",
                          border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                          borderRadius: "6px",
                          padding: "3px 8px",
                          fontSize: "0.74rem",
                          fontWeight: 600,
                        }}
                      >
                        <Hash size={11} />
                        <span>{tag}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setEtiquetasSeleccionadas((prev) => prev.filter((t) => t !== tag))
                          }
                          style={{ background: "none", border: "none", cursor: "pointer", padding: 0 }}
                        >
                          <X size={11} />
                        </button>
                      </span>
                    ))}
                  </div>

                  <div style={{ display: "flex", gap: "6px" }}>
                    <input
                      type="text"
                      placeholder="Escribir palabra clave y Enter..."
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
                        border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                        fontSize: "0.76rem",
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
                      }}
                    >
                      + Tag
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Barra Inferior Fija de Navegación del Wizard */}
          <div
            className="modal-comercio-crear-footer"
            style={{
              padding: "12px 20px",
              borderTop: "1px solid var(--cb-e6e2da, #E6E2DA)",
              background: "var(--cf-f8f7f4, #F8F7F4)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "10px",
              flexWrap: "wrap",
            }}
          >
            <div>
              {indicePaso > 0 ? (
                <button
                  type="button"
                  onClick={irPasoAnterior}
                  title="Volver al paso anterior"
                  aria-label="Anterior"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-57524c, #57524C)",
                    fontSize: "0.82rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={15} />
                  <span>Anterior</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={onCerrar}
                  style={{
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-d5cfc4, #D5CFC4)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-57524c, #57524C)",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              )}
            </div>

            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              {indicePaso < pasosWizardActivos.length - 1 && (
                <button
                  type="button"
                  onClick={irPasoSiguiente}
                  title="Avanzar al siguiente paso del asistente"
                  aria-label="Siguiente"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#1F1C19",
                    color: "#FFFFFF",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <span>Siguiente</span>
                  <ArrowRight size={15} />
                </button>
              )}

              {(indicePaso === pasosWizardActivos.length - 1 ||
                Boolean(nombre.trim() && baseNum > 0)) && (
                <button
                  type="submit"
                  disabled={guardando}
                  title="Registrar y publicar producto en catálogo"
                  aria-label="Crear Producto"
                  style={{
                    background: colorTema,
                    color: "#FFFFFF",
                    border: "none",
                    padding: "9px 18px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 800,
                    cursor: guardando ? "wait" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  {guardando ? <Loader2 size={16} /> : <CheckCircle2 size={16} />}
                  <span>{guardando ? "Guardando..." : "Crear Producto"}</span>
                </button>
              )}
            </div>
          </div>
        </form>
      </div>

      <ModalCrearCategoria
        abierto={modalCatAbierto}
        tabInicial={catModalTab}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLocales((prev) => [...prev, nueva]);
          setCategoriaId(nueva.ctg_id);
          if (onCategoriaCreada) onCategoriaCreada(nueva);
        }}
        onCategoriaEliminada={(catIdEliminada) => {
          setCategoriasLocales((prev) => {
            const rest = prev.filter(
              (c) => c.ctg_id !== catIdEliminada && c.ctg_slug !== catIdEliminada
            );
            if (categoriaId === catIdEliminada && rest[0]) setCategoriaId(rest[0].ctg_id);
            return rest;
          });
          if (onCategoriaEliminada) onCategoriaEliminada(catIdEliminada);
        }}
        negocio={negocio}
      />

      <ModalGaleriaMedios
        abierto={modalGaleriaAbierto}
        onCerrar={() => setModalGaleriaAbierto(false)}
        negocio={negocio}
        modoSeleccion="multiple"
        onSeleccionarImagen={(url) => {
          if (contextoMedios === "galeria") {
            setGaleriaTexto((prev) => (prev ? `${prev}\n${url}` : url));
          } else {
            setImagenUrl(url);
            setExitoAutoConvertir("¡Imagen seleccionada desde la galería!");
          }
        }}
        onSeleccionarMultiples={(urls) => {
          if (contextoMedios === "galeria") {
            setGaleriaTexto((prev) => (prev ? `${prev}\n${urls.join("\n")}` : urls.join("\n")));
          } else {
            if (!imagenUrl.trim()) {
              const [primera, ...resto] = urls;
              if (primera) setImagenUrl(primera);
              if (resto.length > 0) {
                setGaleriaTexto((prev) =>
                  prev ? `${prev}\n${resto.join("\n")}` : resto.join("\n")
                );
              }
            } else {
              setGaleriaTexto((prev) =>
                prev ? `${prev}\n${urls.join("\n")}` : urls.join("\n")
              );
            }
            setExitoAutoConvertir(`¡${urls.length} imagen(es) seleccionadas desde la galería!`);
          }
        }}
        titulo={`Biblioteca de Medios (${negocio.toUpperCase()})`}
      />

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
