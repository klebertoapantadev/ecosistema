"use client";

import React, { useState } from "react";
import { X, FolderPlus, CheckCircle2, AlertCircle } from "lucide-react";
import { crearCategoriaAction, CategoriaCatalogo } from "../acciones";

interface Props {
  abierto: boolean;
  onCerrar: () => void;
  onCategoriaCreada: (cat: CategoriaCatalogo) => void;
  negocio?: string;
}

export function ModalCrearCategoria({ abierto, onCerrar, onCategoriaCreada, negocio = "tranqi" }: Props) {
  const [nombre, setNombre] = useState("");
  const [slug, setSlug] = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [tipo, setTipo] = useState("FORMATO");
  const [orden, setOrden] = useState(1);
  const [guardando, setGuardando] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!abierto) return null;

  const handleNombreChange = (val: string) => {
    setNombre(val);
    // Auto-generar slug si no se editó a mano
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
      setError("Ingresa el nombre de la categoría.");
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
        negocio,
      });

      if (res.ok && res.categoria) {
        onCategoriaCreada(res.categoria);
        onCerrar();
        setNombre("");
        setSlug("");
        setDescripcion("");
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
          maxWidth: "480px",
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
                background: "#EEF2FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#4338CA",
              }}
            >
              <FolderPlus size={20} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#0F172A" }}>
                Nueva Categoría
              </h3>
              <p style={{ margin: 0, fontSize: "0.75rem", color: "#64748B" }}>
                Clasificación para servicios y honorarios
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
              color: "#64748B",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleGuardar} style={{ padding: "24px" }}>
          {error && (
            <div
              style={{
                marginBottom: "16px",
                padding: "10px 14px",
                background: "#FEF2F2",
                border: "1px solid #FCA5A5",
                borderRadius: "8px",
                color: "#991B1B",
                fontSize: "0.8rem",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertCircle size={16} />
              <span>{error}</span>
            </div>
          )}

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Nombre de la Categoría *
            </label>
            <input
              type="text"
              required
              placeholder="Ej. Litigio y Defensa Penal"
              value={nombre}
              onChange={(e) => handleNombreChange(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Identificador (Slug)
            </label>
            <input
              type="text"
              placeholder="litigio-defensa-penal"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
                backgroundColor: "#F8FAFC",
              }}
            />
          </div>

          <div style={{ marginBottom: "16px" }}>
            <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
              Descripción
            </label>
            <textarea
              rows={2}
              placeholder="Breve descripción del alcance de esta categoría..."
              value={descripcion}
              onChange={(e) => setDescripcion(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.85rem",
                boxSizing: "border-box",
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Tipo de Agrupación
              </label>
              <select
                value={tipo}
                onChange={(e) => setTipo(e.target.value)}
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
                <option value="FORMATO">Formato de Servicio</option>
                <option value="COLECCION">Colección / Planes</option>
                <option value="ESTACIONAL">Estacional / Temporal</option>
                <option value="LINEA">Línea de Negocio</option>
              </select>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.8rem", fontWeight: 600, color: "#334155", marginBottom: "6px" }}>
                Orden de Despliegue
              </label>
              <input
                type="number"
                min="1"
                value={orden}
                onChange={(e) => setOrden(parseInt(e.target.value, 10) || 1)}
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          </div>

          {/* Botones */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
            <button
              type="button"
              onClick={onCerrar}
              style={{
                padding: "9px 16px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                background: "#FFFFFF",
                color: "#475569",
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
                padding: "9px 18px",
                borderRadius: "8px",
                border: "none",
                background: "#0F172A",
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
              {guardando ? "Guardando..." : "Crear Categoría"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
