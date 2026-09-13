"use client";

import React, { useState } from "react";
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
} from "lucide-react";
import {
  crearProductoAction,
  CategoriaCatalogo,
  ProductoCatalogo,
} from "../acciones";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onProductoCreado: (prod: ProductoCatalogo) => void;
  categorias: CategoriaCatalogo[];
  negocio?: string;
}

export function ModalCrearProducto({
  abierto,
  onCerrar,
  onProductoCreado,
  categorias,
  negocio = "tranqi",
}: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esLegal = negocio === "tranqi";
  const esMantenimiento = negocio === "fastfix";

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

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

    const beneficios = beneficiosTexto
      .split("\n")
      .map((b) => b.trim())
      .filter((b) => b.length > 0);

    const requisitos = requisitosTexto
      .split("\n")
      .map((r) => r.trim())
      .filter((r) => r.length > 0);

    setGuardando(true);
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
        imagenUrl: imagenUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        beneficios,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        requisitos,
        modalidadPago,
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
                <label style={{ display: "block", fontSize: "0.72rem", fontWeight: 700, color: "#334155", marginBottom: "2px" }}>
                  URL Imagen de Portada
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
    </div>
  );
}
