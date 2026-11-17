"use client";

import React, { useState } from "react";
import { Check, Loader2, Pencil, Plus, Tag, Trash2, X } from "lucide-react";
import {
  eliminarEtiquetaOmnicanalAction,
  guardarEtiquetaOmnicanalAction,
} from "../acciones-omnicanal";
import type { EtiquetaOmnicanal } from "../omnicanal";

const PALETA_ETIQUETAS = [
  "#DB2777",
  "#16A34A",
  "#EA580C",
  "#2563EB",
  "#7C3AED",
  "#0D9488",
  "#D97706",
  "#64748B",
  "#E11D48",
  "#0284C7",
];

export interface PropsModalAdministrarEtiquetas {
  abierto: boolean;
  negocio: string;
  etiquetas: EtiquetaOmnicanal[];
  onCerrar: () => void;
  onActualizado: () => void;
}

export function ModalAdministrarEtiquetas({
  abierto,
  negocio,
  etiquetas,
  onCerrar,
  onActualizado,
}: PropsModalAdministrarEtiquetas) {
  const [editandoId, setEditandoId] = useState<string | null>(null);
  const [nombre, setNombre] = useState<string>("");
  const [icono, setIcono] = useState<string>("🏷️");
  const [color, setColor] = useState<string>(PALETA_ETIQUETAS[0]!);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [eliminandoId, setEliminandoId] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!abierto) return null;

  const limpiarFormulario = () => {
    setEditandoId(null);
    setNombre("");
    setIcono("🏷️");
    setColor(PALETA_ETIQUETAS[0]!);
    setErrorMsg(null);
  };

  const iniciarEdicion = (etq: EtiquetaOmnicanal) => {
    setEditandoId(etq.id);
    setNombre(etq.nombre);
    setIcono(etq.icono || "🏷️");
    setColor(etq.color || PALETA_ETIQUETAS[0]!);
    setErrorMsg(null);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombre.trim() || guardando) return;

    setGuardando(true);
    setErrorMsg(null);
    const res = await guardarEtiquetaOmnicanalAction({
      negocio,
      id: editandoId,
      nombre: nombre.trim(),
      icono: icono.trim() || "🏷️",
      color,
    });
    setGuardando(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    limpiarFormulario();
    onActualizado();
  };

  const handleEliminar = async (id: string) => {
    setEliminandoId(id);
    setErrorMsg(null);
    const res = await eliminarEtiquetaOmnicanalAction(negocio, id);
    setEliminandoId(null);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    if (editandoId === id) limpiarFormulario();
    onActualizado();
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Administrar etiquetas de chats y clientes"
      onClick={onCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9992,
        background: "rgba(15, 23, 42, 0.58)",
        backdropFilter: "blur(2px)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "500px",
          maxHeight: "88vh",
          overflowY: "auto",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.24)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Tag size={18} style={{ color: "#0F172A" }} />
            <div>
              <strong style={{ fontSize: "0.96rem", color: "#0F172A", display: "block" }}>
                Administrar Etiquetas Comerciales
              </strong>
              <span style={{ fontSize: "0.73rem", color: "#64748B" }}>
                Clasificación de chats y clientes (exclusivo Administrador / Operador)
              </span>
            </div>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            title="Cerrar ventana"
            aria-label="Cerrar"
            style={{
              border: "none",
              background: "#F1F5F9",
              borderRadius: "8px",
              width: "30px",
              height: "30px",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <X size={15} />
          </button>
        </div>

        <form
          onSubmit={handleGuardar}
          style={{
            background: "#F8FAFC",
            border: "1px solid #E2E8F0",
            borderRadius: "12px",
            padding: "12px",
            display: "flex",
            flexDirection: "column",
            gap: "10px",
          }}
        >
          <div style={{ display: "flex", gap: "8px" }}>
            <input
              type="text"
              value={icono}
              onChange={(e) => setIcono(e.target.value)}
              maxLength={4}
              title="Emoji o ícono de la etiqueta"
              aria-label="Ícono"
              style={{
                width: "48px",
                padding: "7px",
                textAlign: "center",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.95rem",
                background: "#FFFFFF",
              }}
            />
            <input
              type="text"
              value={nombre}
              onChange={(e) => setNombre(e.target.value)}
              placeholder="Ej: Pagado, Urgente Hoy, Evento, Condolencias…"
              style={{
                flex: 1,
                padding: "7px 10px",
                borderRadius: "8px",
                border: "1px solid #CBD5E1",
                fontSize: "0.84rem",
                background: "#FFFFFF",
              }}
            />
          </div>

          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              gap: "8px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              {PALETA_ETIQUETAS.map((col) => (
                <button
                  key={col}
                  type="button"
                  onClick={() => setColor(col)}
                  title={`Color ${col}`}
                  aria-label={`Color ${col}`}
                  style={{
                    width: "22px",
                    height: "22px",
                    borderRadius: "999px",
                    background: col,
                    border: color === col ? "2.5px solid #0F172A" : "2px solid #FFFFFF",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.16)",
                    cursor: "pointer",
                  }}
                />
              ))}
            </div>

            <div style={{ display: "flex", gap: "6px" }}>
              {editandoId && (
                <button
                  type="button"
                  onClick={limpiarFormulario}
                  title="Cancelar edición"
                  aria-label="Cancelar"
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    color: "#475569",
                    fontSize: "0.76rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
              )}
              <button
                type="submit"
                disabled={guardando || !nombre.trim()}
                title={editandoId ? "Guardar cambios de etiqueta" : "Crear nueva etiqueta"}
                aria-label={editandoId ? "Actualizar" : "Crear etiqueta"}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "5px",
                  padding: "6px 12px",
                  borderRadius: "8px",
                  border: "none",
                  background: "#0F172A",
                  color: "#FFFFFF",
                  fontSize: "0.78rem",
                  fontWeight: 700,
                  cursor: guardando ? "wait" : "pointer",
                }}
              >
                {guardando ? <Loader2 size={13} /> : editandoId ? <Check size={13} /> : <Plus size={13} />}
                <span>{editandoId ? "Guardar" : "Agregar"}</span>
              </button>
            </div>
          </div>
        </form>

        {errorMsg && (
          <div
            style={{
              padding: "8px 10px",
              borderRadius: "8px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.78rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <span style={{ fontSize: "0.74rem", fontWeight: 700, color: "#64748B" }}>
            Etiquetas activas ({etiquetas.length})
          </span>
          {etiquetas.length === 0 ? (
            <div style={{ fontSize: "0.8rem", color: "#64748B", padding: "12px 0" }}>
              Aún no hay etiquetas creadas.
            </div>
          ) : (
            etiquetas.map((etq) => (
              <div
                key={etq.id}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "8px 10px",
                  borderRadius: "9px",
                  border: editandoId === etq.id ? "1.5px solid #0F172A" : "1px solid #E2E8F0",
                  background: "#FFFFFF",
                }}
              >
                <span
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "3px 10px",
                    borderRadius: "999px",
                    fontSize: "0.78rem",
                    fontWeight: 700,
                    background: `${etq.color}18`,
                    color: etq.color,
                    border: `1px solid ${etq.color}45`,
                  }}
                >
                  <span>{etq.icono}</span>
                  <span>{etq.nombre}</span>
                </span>

                <div style={{ display: "inline-flex", gap: "6px" }}>
                  <button
                    type="button"
                    onClick={() => iniciarEdicion(etq)}
                    title={`Editar etiqueta ${etq.nombre}`}
                    aria-label={`Editar ${etq.nombre}`}
                    style={{
                      border: "1px solid #E2E8F0",
                      background: "#F8FAFC",
                      borderRadius: "7px",
                      padding: "5px 8px",
                      color: "#334155",
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    <Pencil size={13} />
                  </button>
                  <button
                    type="button"
                    disabled={eliminandoId === etq.id}
                    onClick={() => void handleEliminar(etq.id)}
                    title={`Eliminar etiqueta ${etq.nombre}`}
                    aria-label={`Eliminar ${etq.nombre}`}
                    style={{
                      border: "1px solid #FECACA",
                      background: "#FEF2F2",
                      borderRadius: "7px",
                      padding: "5px 8px",
                      color: "#DC2626",
                      cursor: eliminandoId === etq.id ? "wait" : "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                    }}
                  >
                    {eliminandoId === etq.id ? <Loader2 size={13} /> : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
