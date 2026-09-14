"use client";

import React, { useState } from "react";
import { X, FolderPlus, Flower2, Scale, Wrench, CheckCircle2, AlertCircle, Image as ImageIcon } from "lucide-react";
import { crearCategoriaAction, CategoriaCatalogo } from "../acciones";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCategoriaCreada: (cat: CategoriaCatalogo) => void;
  negocio?: string;
}

export function ModalCrearCategoria({ abierto, onCerrar, onCategoriaCreada, negocio = "tranqi" }: Props) {
  const esFloristeria = negocio === "tinkay" || negocio === "margaritas";
  const esMantenimiento = negocio === "fastfix";

  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState(esFloristeria ? "COLECCION" : "FORMATO");
  const [orden, setOrden] = useState(1);
  const [imagenUrl, setImagenUrl] = useState("");
  const [videoUrl, setVideoUrl] = useState("");
  const [albumFotosUrl, setAlbumFotosUrl] = useState("");
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  const handleNombreChange = (val: string) => {
    setNombre(val);
    const s = val
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
    setSlug(s);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!nombre.trim()) {
      setError(esFloristeria ? "Ingresa el nombre de la colección floral." : "Ingresa el nombre de la categoría.");
      return;
    }

    setGuardando(true);
    try {
      const res = await crearCategoriaAction({
        nombre: nombre.trim(),
        slug: slug.trim(),
        descripcion: descripcion.trim(),
        tipo,
        orden: Number(orden) || 1,
        imagenUrl: imagenUrl.trim() || undefined,
        videoUrl: videoUrl.trim() || undefined,
        albumFotosUrl: albumFotosUrl.trim() || undefined,
        negocio,
      });

      if (res.ok && res.categoria) {
        onCategoriaCreada(res.categoria);
        onCerrar();
        setNombre("");
        setSlug("");
        setDescripcion("");
        setImagenUrl("");
        setVideoUrl("");
        setAlbumFotosUrl("");
      } else {
        setError(res.error || "No se pudo crear la categoría.");
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
          maxWidth: "520px",
          boxShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.2)",
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
              {esFloristeria ? <Flower2 size={20} /> : <FolderPlus size={20} />}
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 800, color: "#0F172A" }}>
                {esFloristeria ? "Nueva Colección / Ocasión Floral" : "Nueva Categoría Comercial"}
              </h2>
              <span style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Organiza productos y vitrinas visuales en el catálogo
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
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} style={{ padding: "18px 22px" }}>
          {error && (
            <div
              style={{
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                color: "#991B1B",
                padding: "8px 12px",
                borderRadius: "8px",
                marginBottom: "12px",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={15} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
              Nombre de la {esFloristeria ? "Colección" : "Categoría"} *
            </label>
            <input
              type="text"
              required
              placeholder={esFloristeria ? "Ej. Bouquets Estilo Coreano o Ramos para Florero" : "Ej. Trámites Notariales"}
              value={nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
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

          <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "10px", marginBottom: "12px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                Identificador Slug
              </label>
              <input
                type="text"
                placeholder="ej. cat-coreanos"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
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
              <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                Posición / Orden
              </label>
              <input
                type="number"
                min="1"
                value={orden}
                onChange={(e) => setOrden(parseInt(e.target.value) || 1)}
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

          {/* Recursos Digitales de la Categoría */}
          <div
            style={{
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              borderRadius: "8px",
              padding: "10px 12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginBottom: "8px" }}>
              <ImageIcon size={14} color="#15803D" />
              <span style={{ fontSize: "0.75rem", fontWeight: 700, color: "#15803D", textTransform: "uppercase" }}>
                Recursos Digitales de la Colección
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "8px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                  URL Portada / Banner
                </label>
                <input
                  type="url"
                  placeholder="https://images.unsplash.com/..."
                  value={imagenUrl}
                  onChange={(e) => setImagenUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                  URL Video Reel / Spot (MP4 / YouTube)
                </label>
                <input
                  type="url"
                  placeholder="https://youtube.com/shorts/... o MP4"
                  value={videoUrl}
                  onChange={(e) => setVideoUrl(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "6px 8px",
                    borderRadius: "6px",
                    border: "1px solid #CBD5E1",
                    fontSize: "0.75rem",
                    boxSizing: "border-box",
                  }}
                />
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.7rem", fontWeight: 600, color: "#334155", marginBottom: "2px" }}>
                URL Álbum de Muestras / Galería (Drive / iCloud)
              </label>
              <input
                type="url"
                placeholder="https://photos.app.goo.gl/..."
                value={albumFotosUrl}
                onChange={(e) => setAlbumFotosUrl(e.target.value)}
                style={{
                  width: "100%",
                  padding: "6px 8px",
                  borderRadius: "6px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.75rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
              Descripción / Alcance
            </label>
            <textarea
              rows={2}
              placeholder={esFloristeria ? "Arreglos florales de exportación envueltos en papel coreano..." : "Breve resumen de la categoría..."}
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

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
            <button
              type="button"
              onClick={onCerrar}
              style={{
                background: "#F1F5F9",
                color: "#475569",
                border: "none",
                padding: "8px 14px",
                borderRadius: "8px",
                fontSize: "0.82rem",
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
                padding: "8px 18px",
                borderRadius: "8px",
                fontSize: "0.82rem",
                fontWeight: 700,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              <CheckCircle2 size={15} />
              <span>{guardando ? "Creando..." : "Crear Colección"}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
