"use client";

import React, { useState } from "react";
import {
  X,
  PackagePlus,
  Scale,
  ShieldCheck,
  FileCheck,
  CreditCard,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  Image as ImageIcon,
  Video,
  Clock,
  ListPlus,
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
  const [nombre, setNombre] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [categoriaId, setCategoriaId] = useState(categorias[0]?.ctg_id || "");
  const [tipo, setTipo] = useState<"SERVICIO" | "SUSCRIPCION" | "FISICO" | "DIGITAL">("SERVICIO");
  const [precioBase, setPrecioBase] = useState<number | "">("");
  const [tarifaIva, setTarifaIva] = useState<number>(15);
  const [sku, setSku] = useState("");
  const [destacado, setDestacado] = useState(false);
  const [icono, setIcono] = useState<"Scale" | "ShieldCheck" | "FileCheck" | "CreditCard">("Scale");
  const [modalidadPago, setModalidadPago] = useState("Botón Payphone / Tarjeta / Diferido");

  // Recursos Digitales y Multimedia
  const [imagenUrl, setImagenUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [tiempoEntrega, setTiempoEntrega] = useState("24 a 48 horas hábiles");
  const [beneficiosTexto, setBeneficiosTexto] = useState(
    "Asignación de abogado especialista acreditado\nRevisión jurídica previa y asesoría continua\nConstancia digital con validez legal"
  );
  const [requisitosTexto, setRequisitosTexto] = useState(
    "Cédula de ciudadanía o pasaporte vigente\nDocumentación básica de soporte"
  );

  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  // Cálculos en vivo
  const baseNum = typeof precioBase === "number" ? precioBase : 0;
  const montoIvaCalc = Number(((baseNum * tarifaIva) / 100).toFixed(2));
  const totalCalc = Number((baseNum + montoIvaCalc).toFixed(2));

  const handleNombreChange = (val: string) => {
    setNombre(val);
    if (!sku || sku.startsWith("TRQ-")) {
      const clean = val
        .toUpperCase()
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^A-Z0-9]+/g, "")
        .substring(0, 8);
      setSku(clean ? `TRQ-HON-${clean}` : "");
    }
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!nombre.trim()) {
      setError("Ingresa el nombre del producto u honorario.");
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
        sku: sku.trim(),
        destacado,
        icono,
        imagenUrl: imagenUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        tiempoEntrega: tiempoEntrega.trim() || undefined,
        beneficios,
        requisitos,
        modalidadPago,
        negocio,
      });

      if (res.ok && res.producto) {
        onProductoCreado(res.producto);
        onCerrar();
        // Reset
        setNombre("");
        setDescripcion("");
        setPrecioBase("");
        setSku("");
        setDestacado(false);
        setImagenUrl("");
        setVideoUrl("");
      } else {
        setError(res.error || "No se pudo guardar el producto.");
      }
    } catch (err: any) {
      setError(err.message || "Error al procesar la solicitud.");
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.65)",
        backdropFilter: "blur(4px)",
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
          maxWidth: "620px",
          maxHeight: "92vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
          overflow: "hidden",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "18px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "10px",
                background: "#E0F2FE",
                color: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <PackagePlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0F172A" }}>
                Nuevo Servicio / Honorario Profesional
              </h3>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                Registra un nuevo honorario con tarifa SRI e imagen/video de portada.
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "#94A3B8",
              padding: "4px",
              display: "flex",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Formulario con scroll */}
        <form onSubmit={handleGuardar} style={{ display: "flex", flexDirection: "column", flex: 1, overflow: "hidden" }}>
          <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
            {error && (
              <div
                style={{
                  background: "#FEF2F2",
                  border: "1px solid #FCA5A5",
                  borderRadius: "8px",
                  padding: "10px 14px",
                  color: "#991B1B",
                  fontSize: "0.85rem",
                  marginBottom: "16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                <AlertCircle size={16} />
                <span>{error}</span>
              </div>
            )}

            {/* Nombre y Categoría */}
            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Nombre del Honorario / Servicio *
              </label>
              <input
                type="text"
                required
                placeholder="Ej. Notarización de Poder Especial, Consulta Mercantil..."
                value={nombre}
                onChange={(e) => handleNombreChange(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.9rem",
                  boxSizing: "border-box",
                }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Categoría Comercial *
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
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Tipo de Oferta
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
                  <option value="SERVICIO">Servicio / Trámite Puntual</option>
                  <option value="SUSCRIPCION">Suscripción / Plan Periódico</option>
                  <option value="DIGITAL">Producto Digital / Formato</option>
                  <option value="FISICO">Físico / Entrega Notarial</option>
                </select>
              </div>
            </div>

            {/* Tarifario SRI */}
            <div
              style={{
                background: "#F8FAFC",
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#475569", textTransform: "uppercase" }}>
                Tarifa y Desglose SRI (Ecuador)
              </span>

              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "12px", marginTop: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Precio Base Imponible ($ USD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
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
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      boxSizing: "border-box",
                      color: "#0F172A",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    Tarifa IVA SRI
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
                    <option value={15}>IVA 15% (Estándar)</option>
                    <option value={0}>IVA 0% (Exento SRI)</option>
                  </select>
                </div>
              </div>

              {/* Resumen Calculado en Vivo */}
              <div
                style={{
                  marginTop: "12px",
                  padding: "10px 14px",
                  background: "#FFFFFF",
                  border: "1px dashed #CBD5E1",
                  borderRadius: "8px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  fontSize: "0.82rem",
                }}
              >
                <div>
                  <span style={{ color: "#64748B" }}>Subtotal: </span>
                  <strong style={{ color: "#0F172A" }}>${baseNum.toFixed(2)}</strong>
                  <span style={{ margin: "0 8px", color: "#CBD5E1" }}>|</span>
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

            {/* SECCIÓN MULTIMEDIA Y RECURSOS DIGITALES */}
            <div
              style={{
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                borderRadius: "10px",
                padding: "14px",
                marginBottom: "16px",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "10px" }}>
                <ImageIcon size={16} color="#15803D" />
                <span style={{ fontSize: "0.78rem", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>
                  Recursos Digitales (Imagen & Video para la Vitrina)
                </span>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginBottom: "10px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    URL Imagen / Portada
                  </label>
                  <input
                    type="url"
                    placeholder="https://images.unsplash.com/..."
                    value={imagenUrl}
                    onChange={(e) => setImagenUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                    URL Video (YouTube / MP4 / GIF)
                  </label>
                  <input
                    type="url"
                    placeholder="https://www.youtube.com/watch?v=..."
                    value={videoUrl}
                    onChange={(e) => setVideoUrl(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 10px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.82rem",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              {/* Previsualización en vivo si hay imagen */}
              {imagenUrl && (
                <div style={{ marginBottom: "10px", borderRadius: "8px", overflow: "hidden", height: "100px", border: "1px solid #CBD5E1" }}>
                  <img src={imagenUrl} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                </div>
              )}

              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Tiempo Estimado de Entrega o Atención
                </label>
                <input
                  type="text"
                  placeholder="Ej. 24 a 48 horas hábiles, Mismo día..."
                  value={tiempoEntrega}
                  onChange={(e) => setTiempoEntrega(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div style={{ marginBottom: "10px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Beneficios / ¿Qué incluye? (Una viñeta por línea)
                </label>
                <textarea
                  rows={3}
                  value={beneficiosTexto}
                  onChange={(e) => setBeneficiosTexto(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Requisitos del Cliente (Una viñeta por línea)
                </label>
                <textarea
                  rows={2}
                  value={requisitosTexto}
                  onChange={(e) => setRequisitosTexto(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.82rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Código SKU / Referencia
                </label>
                <input
                  type="text"
                  placeholder="TRQ-HON-..."
                  value={sku}
                  onChange={(e) => setSku(e.target.value)}
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

              <div>
                <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                  Ícono Representativo
                </label>
                <select
                  value={icono}
                  onChange={(e) => setIcono(e.target.value as any)}
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
                  <option value="Scale">⚖️ Balanza (Patrocinio / Litigio)</option>
                  <option value="ShieldCheck">🛡️ Escudo (Protección / Plan)</option>
                  <option value="FileCheck">📄 Documento (Contrato / Minuta)</option>
                  <option value="CreditCard">💳 Tarjeta (Asesoría / Consulta)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: "14px" }}>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "4px" }}>
                Descripción y Alcance Jurídico
              </label>
              <textarea
                rows={2}
                placeholder="Detalla qué incluye el honorario (ej. análisis de expediente, preparación de minuta, representación en audiencia)..."
                value={descripcion}
                onChange={(e) => setDescripcion(e.target.value)}
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

            <div style={{ marginBottom: "18px", display: "flex", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                id="destacado"
                checked={destacado}
                onChange={(e) => setDestacado(e.target.checked)}
                style={{ width: "16px", height: "16px", cursor: "pointer" }}
              />
              <label htmlFor="destacado" style={{ fontSize: "0.85rem", fontWeight: 600, color: "#1E293B", cursor: "pointer" }}>
                Marcar como servicio DESTACADO en vitrina
              </label>
            </div>
          </div>

          {/* Footer del Modal */}
          <div
            style={{
              padding: "16px 24px",
              borderTop: "1px solid #E2E8F0",
              background: "#F8FAFC",
              display: "flex",
              justifyContent: "flex-end",
              gap: "10px",
            }}
          >
            <button
              type="button"
              onClick={onCerrar}
              disabled={guardando}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
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
                padding: "8px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#0284C7",
                color: "#FFFFFF",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: guardando ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={16} />
              {guardando ? "Guardando..." : "Guardar Honorario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
