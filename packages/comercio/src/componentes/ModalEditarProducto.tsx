"use client";

import React, { useState, useEffect } from "react";
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
} from "lucide-react";
import {
  editarProductoAction,
  eliminarProductoAction,
  resolverUrlImagenDirectaAction,
  CategoriaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from "../acciones";

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
                "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80";
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
  categorias: CategoriaCatalogo[];
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
  categorias,
  negocio = "tranqi",
  onAbrirManual,
}: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esLegal = negocio === "tranqi";
  const esMantenimiento = negocio === "fastfix";

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

  // Auto-Conversión de imágenes
  const [resolviendoImagen, setResolviendoImagen] = useState(false);
  const [resolviendoVarianteImg, setResolviendoVarianteImg] = useState(false);
  const [exitoAutoConvertir, setExitoAutoConvertir] = useState<string | null>(null);

  // Editor Multivariante (Tamaños / Modalidades)
  const [modoEdicion, setModoEdicion] = useState<"master" | "variante">("master");
  const [variantesLocales, setVariantesLocales] = useState<VarianteCatalogo[]>([]);
  const [varianteActivaIndex, setVarianteActivaIndex] = useState<number>(0);

  const [guardando, setGuardando] = useState(false);
  const [eliminando, setEliminando] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
        { label: "⚡ Asesoría Inmediata (Mismo Día)", val: "⚡ Asesoría Inmediata (Mismo Día)" },
        { label: "📄 24 a 48 horas hábiles", val: "24 a 48 horas hábiles" },
        { label: "⚖️ 3 a 5 días hábiles", val: "3 a 5 días hábiles" },
      ]
    : [
        { label: "⚡ Emergencia Técnica (45-60 min)", val: "⚡ Emergencia Técnica (45 - 60 min)" },
        { label: "🔧 Turno Mismo Día", val: "🔧 Mismo Día / Turno Tarde" },
        { label: "📅 Visita Programada", val: "📅 Visita Programada" },
      ];

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

      // Clonar variantes
      const vars = producto.variantes && producto.variantes.length > 0
        ? producto.variantes.map((v) => ({ ...v }))
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
              var_detalle_variante: {},
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
    const nueva: VarianteCatalogo = {
      var_id: `var-new-${Date.now()}`,
      var_producto_id: producto.pro_id,
      var_sku: `${negocio.toUpperCase().substring(0, 3)}-VAR-${variantesLocales.length + 1}`,
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
      setError("El producto debe tener al menos una modalidad de tarifa.");
      return;
    }
    const filtradas = variantesLocales.filter((_, idx) => idx !== varianteActivaIndex);
    setVariantesLocales(filtradas);
    setVarianteActivaIndex(0);
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
        const det = { ...(varianteActual?.var_detalle_variante || {}), portada_url: res.urlDirecta };
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

    // 2. Validación y auto-conversión de portadas de variantes
    const variantesParaGuardar = await Promise.all(
      variantesLocales.map(async (v) => {
        const port = v.var_detalle_variante?.portada_url;
        if (
          port &&
          (port.includes("photos.google.com") || port.includes("photos.app.goo.gl"))
        ) {
          const resV = await resolverUrlImagenDirectaAction(port);
          if (resV.ok && resV.urlDirecta) {
            return {
              ...v,
              var_detalle_variante: {
                ...(v.var_detalle_variante || {}),
                portada_url: resV.urlDirecta,
              },
            };
          }
        }
        return v;
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
                      onClick={() => setModoEdicion("master")}
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
              onClick={() => setModoEdicion("master")}
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
              <span>🏷️ 2. Tamaños y Variantes ({variantesLocales.length})</span>
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
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Categoría / Colección *
                  </label>
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
                    {categorias.map((c) => (
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

              {/* 2. RECURSOS DIGITALES Y MULTIMEDIA GLOBALES (MASTER) */}
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
                    <input
                      type="url"
                      placeholder="https://photos.google.com/share/... o https://lh3.googleusercontent.com/..."
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
                        width: "100%",
                        padding: "7px 10px",
                        borderRadius: "6px",
                        border: (imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) ? "1.5px solid #F59E0B" : "1px solid #CBD5E1",
                        fontSize: "0.8rem",
                        boxSizing: "border-box",
                      }}
                    />

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
                    <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                      Galería Adicional (URLs por salto de línea)
                    </label>
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

              {/* Pestañas de Variantes con Código de Color Individual */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "14px" }}>
                {variantesLocales.map((v, idx) => {
                  const activa = idx === varianteActivaIndex;
                  const col = PALETA_COLORES_VARIANTES[idx % PALETA_COLORES_VARIANTES.length] || PALETA_COLORES_VARIANTES[0]!;
                  const pvpCalculado = (Number(v.var_precio || 0) * (1 + (v.var_tarifa_iva_porcentaje ?? 15) / 100));
                  const tieneFotoPropia = Boolean(v.var_detalle_variante?.portada_url);

                  return (
                    <button
                      key={v.var_id || idx}
                      type="button"
                      onClick={() => {
                        setVarianteActivaIndex(idx);
                      }}
                      style={{
                        padding: "7px 12px",
                        borderRadius: "8px",
                        border: activa ? `2px solid ${col.border}` : `1.5px solid ${col.border}66`,
                        background: activa ? col.bg : "#FFFFFF",
                        color: activa ? col.text : "#475569",
                        fontWeight: activa ? 800 : 600,
                        fontSize: "0.78rem",
                        cursor: "pointer",
                        display: "flex",
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
                    </button>
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
                  {/* Banner de Variante Activa */}
                  <div
                    style={{
                      background: colActiva.bg,
                      borderRadius: "6px",
                      padding: "6px 10px",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", color: colActiva.text, fontWeight: 800, fontSize: "0.75rem" }}>
                      <div style={{ width: "8px", height: "8px", borderRadius: "50%", background: colActiva.dot }} />
                      <span>🏷️ EDITANDO: {varianteActual.var_nombre || "Nueva Variante"} (Tamaño #{varianteActivaIndex + 1})</span>
                    </div>
                    <span style={{ fontSize: "0.7rem", color: colActiva.text, fontWeight: 700 }}>
                      PVP: ${(varianteActual.precio_total || 0).toFixed(2)}
                    </span>
                  </div>

                  {/* 1. SECCIÓN DE FOTO DE PORTADA PARA ESTE TAMAÑO (HERENCIA VS SOBREESCRITURA) */}
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
                        <ImageIcon size={15} color={colActiva.dot} />
                        <label style={{ fontSize: "0.75rem", fontWeight: 800, color: "#1E293B" }}>
                          Foto de Portada para "{varianteActual.var_nombre}"
                        </label>
                      </div>

                      {/* Selector de Herencia vs Personalizado */}
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), portada_url: null };
                            actualizarVarianteActual("var_detalle_variante", det);
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            border: !varianteActual.var_detalle_variante?.portada_url ? "1.5px solid #0F172A" : "1px solid #CBD5E1",
                            background: !varianteActual.var_detalle_variante?.portada_url ? "#0F172A" : "#FFFFFF",
                            color: !varianteActual.var_detalle_variante?.portada_url ? "#FFFFFF" : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          ⚪ Usar Foto Global (Heredada)
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            if (!varianteActual.var_detalle_variante?.portada_url) {
                              const det = { ...(varianteActual.var_detalle_variante || {}), portada_url: imagenUrl || "" };
                              actualizarVarianteActual("var_detalle_variante", det);
                            }
                          }}
                          style={{
                            padding: "3px 8px",
                            borderRadius: "4px",
                            fontSize: "0.68rem",
                            fontWeight: 700,
                            border: Boolean(varianteActual.var_detalle_variante?.portada_url) ? `1.5px solid ${colActiva.border}` : "1px solid #CBD5E1",
                            background: Boolean(varianteActual.var_detalle_variante?.portada_url) ? colActiva.bg : "#FFFFFF",
                            color: Boolean(varianteActual.var_detalle_variante?.portada_url) ? colActiva.text : "#64748B",
                            cursor: "pointer",
                          }}
                        >
                          📸 Foto Propia de este Tamaño
                        </button>
                      </div>
                    </div>

                    {varianteActual.var_detalle_variante?.portada_url ? (
                      <div>
                        <div style={{ display: "flex", gap: "8px", alignItems: "center", marginBottom: "6px" }}>
                          <input
                            type="url"
                            placeholder="Pega URL de Google Fotos, Drive o CDN para este tamaño..."
                            value={varianteActual.var_detalle_variante.portada_url}
                            onChange={(e) => {
                              const raw = e.target.value.trim();
                              const driveMatch = raw.match(/drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/) || raw.match(/drive\.google\.com\/(?:open|uc)\?(?:.*&)?id=([a-zA-Z0-9_-]+)/);
                              const valFinal = driveMatch && driveMatch[1] ? `https://lh3.googleusercontent.com/d/${driveMatch[1]}=w1200` : raw;
                              const det = { ...(varianteActual.var_detalle_variante || {}), portada_url: valFinal || null };
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
                          <button
                            type="button"
                            disabled={resolviendoVarianteImg}
                            onClick={() => handleConvertirImagenVariante()}
                            style={{
                              background: "#0284C7",
                              color: "#FFFFFF",
                              border: "none",
                              padding: "7px 12px",
                              borderRadius: "6px",
                              fontSize: "0.72rem",
                              fontWeight: 700,
                              cursor: resolviendoVarianteImg ? "wait" : "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {resolviendoVarianteImg ? (
                              <>
                                <Loader2 size={12} className="animate-spin" /> Extrayendo...
                              </>
                            ) : (
                              <>
                                <Wand2 size={12} /> 🪄 Auto-Convertir
                              </>
                            )}
                          </button>
                        </div>

                        {/* Selector de encuadre específico para esta variante */}
                        <SelectorEncuadreFoto
                          imagenUrl={varianteActual.var_detalle_variante.portada_url}
                          posicion={varianteActual.var_detalle_variante.foto_posicion || fotoPosicionMaster || "center center"}
                          ajuste={varianteActual.var_detalle_variante.foto_ajuste || fotoAjusteMaster || "cover"}
                          zoom={Number(varianteActual.var_detalle_variante.foto_zoom) || fotoZoomMaster || 100}
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
                          titulo={`Encuadre & Posición ("${varianteActual.var_nombre}")`}
                          colorTema={colActiva.border}
                        />

                        {Boolean(
                          varianteActual.var_detalle_variante.portada_url.includes("photos.app.goo.gl") ||
                          varianteActual.var_detalle_variante.portada_url.includes("photos.google.com")
                        ) && (
                          <div style={{ marginTop: "6px", fontSize: "0.68rem", color: "#B45309", background: "#FEF3C7", padding: "4px 8px", borderRadius: "4px", border: "1px solid #FDE68A", lineHeight: 1.35 }}>
                            ⚠️ Haz clic en <strong>🪄 Auto-Convertir</strong> para extraer la foto directa de Google Fotos para este tamaño.
                          </div>
                        )}
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
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          {imagenUrl ? (
                            <div style={{ width: "36px", height: "36px", borderRadius: "4px", overflow: "hidden", background: "#0F172A", flexShrink: 0 }}>
                              <img
                                src={imagenUrl}
                                alt="Master Heredada"
                                onError={(e) => {
                                  (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1561181286-d3fee7d55364?w=600&auto=format&fit=crop&q=80";
                                }}
                                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                              />
                            </div>
                          ) : (
                            <div style={{ width: "36px", height: "36px", borderRadius: "4px", background: "#E2E8F0", display: "flex", alignItems: "center", justifyContent: "center", color: "#94A3B8" }}>
                              <ImageIcon size={16} />
                            </div>
                          )}
                          <div>
                            <div style={{ fontSize: "0.75rem", color: "#1E293B", fontWeight: 700 }}>
                              ⚪ <strong>Foto Heredada del Master</strong>
                            </div>
                            <div style={{ fontSize: "0.68rem", color: "#64748B" }}>
                              Este tamaño muestra la imagen de portada global en la vitrina.
                            </div>
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => {
                            const det = { ...(varianteActual.var_detalle_variante || {}), portada_url: imagenUrl || "https://" };
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
                          + Personalizar Foto Propia
                        </button>
                      </div>
                    )}
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
                        step="0.0001"
                        min="0.01"
                        required
                        placeholder="0.00"
                        value={varianteActual.var_precio}
                        onChange={(e) => actualizarVarianteActual("var_precio", e.target.value)}
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
                          onClick={eliminarVarianteActual}
                          title="Eliminar esta variante"
                          style={{
                            background: "transparent",
                            border: "none",
                            color: "#EF4444",
                            cursor: "pointer",
                            padding: "2px",
                            marginLeft: "6px",
                          }}
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
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
            <button
              type="button"
              onClick={handleEliminar}
              disabled={eliminando}
              style={{
                background: confirmarEliminar ? "#DC2626" : "transparent",
                color: confirmarEliminar ? "#FFFFFF" : "#EF4444",
                border: confirmarEliminar ? "none" : "1px solid #FCA5A5",
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
              <Trash2 size={14} />
              <span>{confirmarEliminar ? "Confirmar Desactivación" : "Desactivar"}</span>
            </button>

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
    </div>
  );
}
