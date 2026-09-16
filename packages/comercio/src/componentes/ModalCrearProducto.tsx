"use client";

import React, { useState, useEffect } from "react";
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
  Video,
  Clock,
  BookOpen,
  Loader2,
  Wand2,
  FolderPlus,
  Share2,
} from "lucide-react";
import {
  crearProductoAction,
  resolverUrlImagenDirectaAction,
  CategoriaCatalogo,
  ProductoCatalogo,
  CANALES_CATALOGO_OFICIALES,
  CANALES_POR_DEFECTO,
  CanalVisibilidad,
} from "../acciones";
import { ModalCrearCategoria } from "./ModalCrearCategoria";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onProductoCreado: (prod: ProductoCatalogo) => void;
  onCategoriaCreada?: (cat: CategoriaCatalogo) => void;
  categorias: CategoriaCatalogo[];
  negocio?: string;
}

export function ModalCrearProducto({
  abierto,
  onCerrar,
  onProductoCreado,
  onCategoriaCreada,
  categorias,
  negocio = "tranqi",
}: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esLegal = negocio === "tranqi";
  const esMantenimiento = negocio === "fastfix";

  const [categoriasLocales, setCategoriasLocales] = useState<CategoriaCatalogo[]>(categorias || []);
  const [modalCatAbierto, setModalCatAbierto] = useState(false);

  useEffect(() => {
    if (categorias && categorias.length > 0) {
      setCategoriasLocales(categorias);
    }
  }, [categorias]);

  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.ctg_id || "");
  const [tipo, setTipo] = useState<"SERVICIO" | "SUSCRIPCION" | "FISICO" | "DIGITAL">(
    esFloristeria ? "FISICO" : "SERVICIO"
  );
  const [precioBase, setPrecioBase] = useState<number | "">("");
  const [tarifaIva, setTarifaIva] = useState<number>(15);
  const [sku, setSku] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [icono, setIcono] = useState<string>(esFloristeria ? "Sparkles" : "Scale");
  const [modalidadPago, setModalidadPago] = useState("Botón Payphone / Tarjeta / Saldo");

  // Recursos Digitales y Multimedia
  const [imagenUrl, setImagenUrl] = useState("");
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState(
    esFloristeria ? "🌸 Pide hoy, recibe hoy (Mismo Día)" : "24 a 48 horas hábiles"
  );
  const [beneficiosTexto, setBeneficiosTexto] = useState(
    esFloristeria
      ? "Rosas de exportación seleccionadas de tallo largo\nEnvoltura en fino papel coreano plisado\nTarjeta dedicatoria y preservante floral gratis"
      : esLegal
      ? "Asignación de abogado especialista acreditado\nRevisión jurídica previa y asesoría continua\nConstancia digital con validez legal"
      : "Diagnóstico técnico en sitio\nGarantía de servicio por 90 días"
  );
  const [requisitosTexto, setRequisitosTexto] = useState(
    esFloristeria
      ? "Dirección exacta y número de contacto del destinatario\nMensaje para la tarjeta dedicatoria"
      : "Cédula de ciudadanía o pasaporte vigente\nDocumentación básica de soporte"
  );

  const [resolviendoImagen, setResolviendoImagen] = useState(false);
  const [exitoAutoConvertir, setExitoAutoConvertir] = useState<string | null>(null);
  const [canalesSeleccionados, setCanalesSeleccionados] = useState<CanalVisibilidad[]>([...CANALES_POR_DEFECTO]);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleCanal = (clave: CanalVisibilidad) => {
    setCanalesSeleccionados((prev) =>
      prev.includes(clave) ? prev.filter((c) => c !== clave) : [...prev, clave]
    );
  };

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

  if (!abierto) return null;

  // Cálculos en vivo
  const baseNum = typeof precioBase === "number" ? precioBase : 0;
  const montoIvaCalc = Number(((baseNum * tarifaIva) / 100).toFixed(2));
  const totalCalc = Number((baseNum + montoIvaCalc).toFixed(2));

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

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresa el nombre del producto.");
      return;
    }
    if (!precioBase || Number(precioBase) <= 0) {
      setError("El precio base debe ser mayor a 0.");
      return;
    }

    setGuardando(true);

    // Validación y auto-conversión de portada si es de Google Fotos
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
          `⚠️ Advertencia de Imagen: La URL de portada es un visor web de Google Fotos que no pudo resolverse automáticamente (${resImg.error}). Asegúrate de que el álbum sea público o haz clic derecho en la foto para 'Copiar dirección de la imagen' (lh3.googleusercontent.com).`
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

    try {
      const res = await crearProductoAction({
        nombre: nombre.trim(),
        descripcion: descripcion.trim(),
        categoriaId: categoriaId || categorias[0]?.ctg_id,
        tipo,
        precioBase: Number(precioBase),
        tarifaIva,
        sku: sku.trim() || undefined,
        destacado,
        icono: icono as any,
        imagenUrl: imagenUrlFinal || undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        beneficios,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        requisitos,
        modalidadPago,
        canales_visibilidad: canalesSeleccionados,
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
              {esFloristeria ? <Flower2 size={20} /> : esMantenimiento ? <Wrench size={20} /> : <PackagePlus size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 800, color: "#0F172A" }}>
                {esFloristeria
                  ? "Nuevo Arreglo / Producto Floral"
                  : esMantenimiento
                  ? "Nuevo Servicio de Mantenimiento"
                  : "Nuevo Servicio / Honorario Profesional"}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Registra tarifas, fotos de muestra, promesa de entrega y botón Payphone
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              padding: "6px",
            }}
          >
            <X size={20} />
          </button>
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

          {/* Nombre */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              Nombre del {esFloristeria ? "Arreglo / Producto Floral" : "Servicio"} *
            </label>
            <input
              type="text"
              required
              placeholder={esFloristeria ? "Ej. Bouquet Diseño Estilo Coreano" : "Ej. Elaboración de Minuta"}
              value={nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
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

          {/* Categoría y Tipo */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                <label style={{ fontSize: "0.78rem", fontWeight: 600, color: "#334155" }}>
                  Categoría / Colección *
                </label>
                <button
                  type="button"
                  onClick={() => setModalCatAbierto(true)}
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

          {/* Tarifa Base e IVA */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Precio Base Imponible ($ USD) *
                </label>
                <input
                  type="number"
                  step="0.0001"
                  min="0.01"
                  required
                  placeholder="0.00"
                  value={precioBase}
                  onChange={(e) => setPrecioBase(e.target.value === "" ? "" : parseFloat(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.95rem",
                    fontWeight: 800,
                    boxSizing: "border-box",
                    color: "#0F172A",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                  Tarifa IVA SRI (Ecuador)
                </label>
                <select
                  value={tarifaIva}
                  onChange={(e) => setTarifaIva(Number(e.target.value))}
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.85rem",
                    boxSizing: "border-box",
                    background: "#FFFFFF",
                  }}
                >
                  <option value={15}>IVA 15% (Estándar SRI)</option>
                  <option value={0}>IVA 0% (Exento SRI)</option>
                </select>
              </div>
            </div>

            {/* Resumen en vivo */}
            <div
              style={{
                marginTop: "10px",
                padding: "8px 12px",
                background: "#FFFFFF",
                border: "1px dashed #CBD5E1",
                borderRadius: "6px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                fontSize: "0.8rem",
              }}
            >
              <div>
                <span style={{ color: "#64748B" }}>Base: </span>
                <strong style={{ color: "#0F172A" }}>${baseNum.toFixed(2)}</strong>
                <span style={{ margin: "0 6px", color: "#CBD5E1" }}>|</span>
                <span style={{ color: "#64748B" }}>IVA ({tarifaIva}%): </span>
                <strong style={{ color: "#0F172A" }}>${montoIvaCalc.toFixed(2)}</strong>
              </div>
              <div>
                <span style={{ color: "#64748B", marginRight: "6px" }}>Total Payphone:</span>
                <strong style={{ color: "#059669", fontSize: "1.05rem", fontWeight: 800 }}>
                  ${totalCalc.toFixed(2)}
                </strong>
              </div>
            </div>
          </div>

          {/* Recursos Digitales */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
              <ImageIcon size={16} color="#15803D" />
              <span style={{ fontSize: "0.78rem", fontWeight: 800, color: "#15803D", textTransform: "uppercase" }}>
                Recursos Digitales (Fotos Reales, Álbum y Video/GIF)
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
              <div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                  <label style={{ fontSize: "0.72rem", fontWeight: 700, color: "#334155" }}>
                    URL Imagen de Portada Principal *
                  </label>
                  {(imagenUrl.includes("photos.google.com") || imagenUrl.includes("photos.app.goo.gl")) && (
                    <span style={{ fontSize: "0.68rem", color: "#D97706", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                      <AlertCircle size={12} /> Requiere Extracción
                    </span>
                  )}
                  {imagenUrl.includes("lh3.googleusercontent.com") && (
                    <span style={{ fontSize: "0.68rem", color: "#16A34A", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
                      <CheckCircle2 size={12} /> Imagen Directa
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
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                  URL Álbum de Fotos / Muestras (Google Photos)
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

            <div>
              <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                URL Video / GIF Demostrativo (YouTube / MP4)
              </label>
              <input
                type="url"
                placeholder="https://www.youtube.com/watch?v=... o archivo .mp4 / .gif"
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
          </div>

          {/* Tiempo de Entrega */}
          <div style={{ marginBottom: "14px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#1E293B", marginBottom: "4px" }}>
              Promesa y Tiempo de Entrega al Cliente *
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

          {/* Canales de Visibilidad y Distribución */}
          <div
            style={{
              background: "#F8FAFC",
              border: "1.5px solid #E2E8F0",
              borderRadius: "10px",
              padding: "14px",
              marginBottom: "14px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Share2 size={16} color="#0284C7" />
                <span style={{ fontSize: "0.8rem", fontWeight: 800, color: "#1E293B", textTransform: "uppercase" }}>
                  Canales de Visibilidad y Distribución
                </span>
              </div>
              <span style={{ fontSize: "0.75rem", color: "#64748B", fontWeight: 600 }}>
                {canalesSeleccionados.length} de {CANALES_CATALOGO_OFICIALES.length} activos
              </span>
            </div>
            <p style={{ fontSize: "0.75rem", color: "#64748B", margin: "0 0 10px 0" }}>
              Indica en qué plataformas, aplicaciones y agentes de IA estará disponible este producto:
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: "8px" }}>
              {CANALES_CATALOGO_OFICIALES.map((c) => {
                const activo = canalesSeleccionados.includes(c.clave);
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
                      border: `1.5px solid ${activo ? c.color : "#E2E8F0"}`,
                      background: activo ? `${c.color}12` : "#FFFFFF",
                      color: activo ? "#0F172A" : "#64748B",
                      cursor: "pointer",
                      fontSize: "0.78rem",
                      fontWeight: activo ? 700 : 500,
                      textAlign: "left",
                      transition: "all 0.15s ease",
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
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {c.nombre}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Botones de Acción */}
          <div
            style={{
              display: "flex",
              justifyContent: "flex-end",
              gap: "8px",
              paddingTop: "14px",
              borderTop: "1px solid #E2E8F0",
            }}
          >
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
              <span>{guardando ? "Registrando..." : "Crear Producto"}</span>
            </button>
          </div>
        </form>
      </div>

      {/* Modal para Crear Nueva Categoría / Colección en línea */}
      <ModalCrearCategoria
        abierto={modalCatAbierto}
        onCerrar={() => setModalCatAbierto(false)}
        onCategoriaCreada={(nueva) => {
          setCategoriasLocales((prev) => [...prev, nueva]);
          setCategoriaId(nueva.ctg_id);
          if (onCategoriaCreada) {
            onCategoriaCreada(nueva);
          }
        }}
        negocio={negocio}
      />
    </div>
  );
}
