"use client";

import React, { useState, useEffect } from "react";
import {
  X,
  FileEdit,
  Sparkles,
  Flower2,
  Scale,
  Wrench,
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
} from "lucide-react";
import {
  editarProductoAction,
  eliminarProductoAction,
  CategoriaCatalogo,
  ProductoCatalogo,
  VarianteCatalogo,
} from "../acciones";

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
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [galeriaTexto, setGaleriaTexto] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState("");
  const [beneficiosTexto, setBeneficiosTexto] = useState("");
  const [requisitosTexto, setRequisitosTexto] = useState("");

  // Editor Multivariante (Tamaños / Modalidades)
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
      const targetIdx = varianteInicialId ? vars.findIndex((v) => v.var_id === varianteInicialId) : 0;
      setVarianteActivaIndex(targetIdx >= 0 ? targetIdx : 0);
      setConfirmarEliminar(false);
      setError(null);
    }
  }, [producto, varianteInicialId, categorias, negocio, esFloristeria, esLegal]);

  if (!abierto || !producto) return null;

  const varianteActual = variantesLocales[varianteActivaIndex] || variantesLocales[0];

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

    setGuardando(true);
    try {
      const res = await editarProductoAction({
        pro_id: producto.pro_id,
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        destacado,
        icono,
        imagenUrl: imagenUrl.trim() || undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        galeriaUrls: galeriaUrls.length > 0 ? galeriaUrls : undefined,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        beneficios,
        requisitos,
        modalidadPago,
        variantes: variantesLocales,
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
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          display: "flex",
          flexDirection: "column",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "16px 20px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: esFloristeria ? "#FFFDF8" : "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: esFloristeria ? "#FEF2F2" : "#E0F2FE",
                color: esFloristeria ? "#E11D48" : "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {esFloristeria ? <Flower2 size={20} /> : esMantenimiento ? <Wrench size={20} /> : <FileEdit size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>
                {esFloristeria
                  ? "Editar Arreglo / Diseño Floral"
                  : esMantenimiento
                  ? "Editar Servicio de Mantenimiento"
                  : "Editar Servicio / Honorario Profesional"}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Configura tarifas multivariante, recursos multimedia y promesa de entrega
              </span>
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
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <ImageIcon size={16} color="#15803D" />
                <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803D", textTransform: "uppercase" }}>
                  Recursos Digitales Globales (Comunes para todas las Variantes)
                </span>
              </div>
              <span style={{ fontSize: "0.7rem", color: "#166534", fontWeight: 600 }}>
                Las variantes heredarán estos enlaces salvo que se personalicen
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                  URL Imagen de Portada Principal (Global) *
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/... o CDN"
                  value={imagenUrl}
                  onChange={(e) => setImagenUrl(e.target.value)}
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

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                  URL Álbum de Muestras Reales (Google Photos / Instagram)
                </label>
                <input
                  type="url"
                  placeholder="https://photos.app.goo.gl/... o drive"
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
                  placeholder="https://www.youtube.com/watch?v=... o .mp4 / .gif"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
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
              {presetsEntrega.map((pr) => (
                <button
                  key={pr.val}
                  type="button"
                  onClick={() => setTiempoEntrega(pr.val)}
                  style={{
                    padding: "4px 8px",
                    borderRadius: "6px",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    border: tiempoEntrega === pr.val ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                    background: tiempoEntrega === pr.val ? "#DCFCE7" : "#FFFFFF",
                    color: tiempoEntrega === pr.val ? "#15803D" : "#475569",
                    cursor: "pointer",
                  }}
                >
                  {pr.label}
                </button>
              ))}
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

          {/* 4. EDITOR DE VARIANTES CON HERENCIA Y SOBRESCRITURA INDIVIDUAL */}
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
                <Layers size={17} color="#0284C7" />
                <span style={{ fontSize: "0.85rem", fontWeight: 800, color: "#0F172A", textTransform: "uppercase" }}>
                  Variantes de Producto / Tamaños ({variantesLocales.length})
                </span>
              </div>
              <button
                type="button"
                onClick={agregarNuevaVariante}
                style={{
                  background: "#0284C7",
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

            {/* Pestañas de Variantes */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", marginBottom: "12px" }}>
              {variantesLocales.map((v, idx) => {
                const activa = idx === varianteActivaIndex;
                const pvpCalculado = (Number(v.var_precio || 0) * (1 + (v.var_tarifa_iva_porcentaje ?? 15) / 100));
                const tieneOverrides = Boolean(
                  v.var_detalle_variante?.portada_url ||
                  v.var_detalle_variante?.tiempo_entrega ||
                  (v.var_detalle_variante?.beneficios_modo && v.var_detalle_variante?.beneficios_modo !== "heredar")
                );

                return (
                  <button
                    key={v.var_id || idx}
                    type="button"
                    onClick={() => setVarianteActivaIndex(idx)}
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: activa ? "2px solid #0284C7" : "1px solid #CBD5E1",
                      background: activa ? "#E0F2FE" : "#FFFFFF",
                      color: activa ? "#0369A1" : "#475569",
                      fontWeight: activa ? 800 : 500,
                      fontSize: "0.78rem",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      transition: "all 0.15s ease",
                    }}
                  >
                    <span>{v.var_nombre}</span>
                    <span style={{ fontWeight: 800, color: activa ? "#0F172A" : "#64748B" }}>
                      ${(v.precio_total || pvpCalculado).toFixed(2)}
                    </span>
                    {tieneOverrides && (
                      <span
                        title="Esta variante tiene personalizaciones propias (foto/entrega/beneficios)"
                        style={{
                          width: "7px",
                          height: "7px",
                          borderRadius: "50%",
                          background: "#F59E0B",
                          display: "inline-block",
                        }}
                      />
                    )}
                  </button>
                );
              })}
            </div>

            {/* Formulario de la Variante Seleccionada */}
            {varianteActual && (
              <div
                style={{
                  background: "#FFFFFF",
                  borderRadius: "10px",
                  padding: "14px",
                  border: "1px solid #CBD5E1",
                }}
              >
                {/* 1. Datos básicos de la variante */}
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

                {/* 2. SUB-SECCIÓN: PERSONALIZACIÓN & SOBRESCRITURA DE ESTA VARIANTE */}
                <div
                  style={{
                    marginTop: "12px",
                    borderTop: "1.5px solid #F1F5F9",
                    paddingTop: "12px",
                    background: "#FAFAFA",
                    borderRadius: "8px",
                    padding: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <Sparkles size={14} color="#D97706" />
                      <span style={{ fontSize: "0.75rem", fontWeight: 800, color: "#92400E", textTransform: "uppercase" }}>
                        Personalización Exclusiva de esta Variante (Opcional)
                      </span>
                    </div>
                    <span style={{ fontSize: "0.68rem", color: "#64748B" }}>
                      Si se deja vacío, hereda automáticamente los valores globales
                    </span>
                  </div>

                  {/* Foto de Portada Específica para este tamaño */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                        Foto / Portada Específica de este Tamaño:
                      </label>
                      <span style={{ fontSize: "0.68rem", color: varianteActual.var_detalle_variante?.portada_url ? "#059669" : "#64748B", fontWeight: 600 }}>
                        {varianteActual.var_detalle_variante?.portada_url ? "🟢 Portada Propia Activa" : "🟢 Hereda Portada Global"}
                      </span>
                    </div>
                    <input
                      type="url"
                      placeholder="Dejar vacío para heredar la foto global, o pegar URL específica de este tamaño"
                      value={varianteActual.var_detalle_variante?.portada_url || ""}
                      onChange={(e) => {
                        const val = e.target.value.trim();
                        const det = { ...(varianteActual.var_detalle_variante || {}), portada_url: val || null };
                        actualizarVarianteActual("var_detalle_variante", det);
                      }}
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

                  {/* Tiempo de Entrega Específico de esta variante */}
                  <div style={{ marginBottom: "8px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "2px" }}>
                      <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                        Tiempo de Entrega para este Tamaño:
                      </label>
                      <span style={{ fontSize: "0.68rem", color: varianteActual.var_detalle_variante?.tiempo_entrega ? "#059669" : "#64748B", fontWeight: 600 }}>
                        {varianteActual.var_detalle_variante?.tiempo_entrega ? "🟢 Tiempo Específico Activo" : `🟢 Hereda Global (${tiempoEntrega})`}
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
                          border: !varianteActual.var_detalle_variante?.tiempo_entrega ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                          background: !varianteActual.var_detalle_variante?.tiempo_entrega ? "#E0F2FE" : "#FFFFFF",
                          color: !varianteActual.var_detalle_variante?.tiempo_entrega ? "#0369A1" : "#475569",
                          cursor: "pointer",
                        }}
                      >
                        Heredar Global
                      </button>
                      {presetsEntrega.map((pr) => (
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
                            border: varianteActual.var_detalle_variante?.tiempo_entrega === pr.val ? "1.5px solid #16A34A" : "1px solid #CBD5E1",
                            background: varianteActual.var_detalle_variante?.tiempo_entrega === pr.val ? "#DCFCE7" : "#FFFFFF",
                            color: varianteActual.var_detalle_variante?.tiempo_entrega === pr.val ? "#15803D" : "#475569",
                            cursor: "pointer",
                          }}
                        >
                          {pr.label}
                        </button>
                      ))}
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
                                border: activo ? "1.5px solid #0284C7" : "1px solid #CBD5E1",
                                background: activo ? "#0284C7" : "#FFFFFF",
                                color: activo ? "#FFFFFF" : "#475569",
                                cursor: "pointer",
                              }}
                            >
                              {modo === "heredar" ? "🟢 Heredar" : modo === "anexar" ? "🟡 Anexar Extras" : "🔵 Reemplazar"}
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
