"use client";

import React, { useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { guardarEstadosPedidosAdminAction } from "../acciones-logistica";
import { ESTADOS_PEDIDO_DEFECTO, type EstadoPedidoConfig } from "../operaciones-taller";

export interface PropsModalAdminEstadosPedido {
  abierto: boolean;
  negocio: string;
  estadosActuales: EstadoPedidoConfig[];
  onCerrar: () => void;
  onEstadosActualizados: (nuevos: EstadoPedidoConfig[]) => void;
}

export function ModalAdminEstadosPedido({
  abierto,
  negocio,
  estadosActuales,
  onCerrar,
  onEstadosActualizados,
}: PropsModalAdminEstadosPedido) {
  const [lista, setLista] = useState<EstadoPedidoConfig[]>(() =>
    estadosActuales.length > 0 ? estadosActuales : ESTADOS_PEDIDO_DEFECTO
  );
  const [nuevaEtiqueta, setNuevaEtiqueta] = useState<string>("");
  const [nuevoFondo, setNuevoFondo] = useState<string>("#E0F2FE");
  const [nuevoTexto, setNuevoTexto] = useState<string>("#0369A1");
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  if (!abierto) return null;

  const mover = (idx: number, dir: -1 | 1) => {
    const dest = idx + dir;
    if (dest < 0 || dest >= lista.length) return;
    const copia = [...lista];
    const tmp = copia[idx]!;
    copia[idx] = copia[dest]!;
    copia[dest] = tmp;
    setLista(copia.map((e, i) => ({ ...e, orden: (i + 1) * 10 })));
  };

  const agregarEstado = () => {
    const et = nuevaEtiqueta.trim();
    if (!et) return;
    const valor = et
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toUpperCase()
      .replace(/[^A-Z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    if (!valor || lista.some((e) => e.valor === valor)) {
      setErrorMsg("Ese estado ya existe o el nombre es inválido.");
      return;
    }
    setErrorMsg(null);
    setLista((prev) => [
      ...prev,
      {
        valor,
        etiqueta: et,
        colorFondo: nuevoFondo,
        colorTexto: nuevoTexto,
        orden: (prev.length + 1) * 10,
        activo: true,
      },
    ]);
    setNuevaEtiqueta("");
  };

  const handleGuardar = async () => {
    setGuardando(true);
    setErrorMsg(null);
    const res = await guardarEstadosPedidosAdminAction({
      negocio,
      estados: lista.map((e, i) => ({ ...e, orden: (i + 1) * 10 })),
    });
    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    onEstadosActualizados(res.estadosConfig);
    onCerrar();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(15, 23, 42, 0.58)",
        zIndex: 80,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "14px",
      }}
    >
      <div
        style={{
          width: "100%",
          maxWidth: "600px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "#FFFFFF",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h3 style={{ margin: 0, fontSize: "1rem", color: "#0F172A" }}>
            Administrar Estados de Pedidos
          </h3>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748B" }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "8px 11px",
              borderRadius: "8px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.79rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {lista.map((est, idx) => (
            <div
              key={est.valor}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "7px 10px",
                borderRadius: "9px",
                border: "1px solid #E2E8F0",
                background: "#F8FAFC",
                flexWrap: "wrap",
              }}
            >
              <input
                type="text"
                value={est.etiqueta}
                onChange={(e) =>
                  setLista((prev) =>
                    prev.map((x) => (x.valor === est.valor ? { ...x, etiqueta: e.target.value } : x))
                  )
                }
                style={{
                  flex: "1 1 160px",
                  padding: "6px 8px",
                  borderRadius: "7px",
                  border: "1px solid #CBD5E1",
                  fontSize: "0.8rem",
                  fontWeight: 700,
                  background: est.colorFondo,
                  color: est.colorTexto,
                }}
              />
              <input
                type="color"
                value={est.colorFondo}
                title="Color de fondo"
                onChange={(e) =>
                  setLista((prev) =>
                    prev.map((x) => (x.valor === est.valor ? { ...x, colorFondo: e.target.value } : x))
                  )
                }
                style={{ width: "30px", height: "28px", border: "none", background: "transparent", cursor: "pointer" }}
              />
              <input
                type="color"
                value={est.colorTexto}
                title="Color de texto"
                onChange={(e) =>
                  setLista((prev) =>
                    prev.map((x) => (x.valor === est.valor ? { ...x, colorTexto: e.target.value } : x))
                  )
                }
                style={{ width: "30px", height: "28px", border: "none", background: "transparent", cursor: "pointer" }}
              />
              <button
                type="button"
                disabled={idx === 0}
                onClick={() => mover(idx, -1)}
                title="Subir"
                style={{ padding: "4px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}
              >
                <ArrowUp size={12} />
              </button>
              <button
                type="button"
                disabled={idx === lista.length - 1}
                onClick={() => mover(idx, 1)}
                title="Bajar"
                style={{ padding: "4px", borderRadius: "6px", border: "1px solid #CBD5E1", background: "#FFFFFF", cursor: "pointer" }}
              >
                <ArrowDown size={12} />
              </button>
              {est.valor !== "NUEVO_POR_CONFIRMAR" && (
                <button
                  type="button"
                  onClick={() => setLista((prev) => prev.filter((x) => x.valor !== est.valor))}
                  title="Quitar estado"
                  style={{
                    padding: "4px 6px",
                    borderRadius: "6px",
                    border: "1px solid #FECACA",
                    background: "#FEF2F2",
                    color: "#B91C1C",
                    cursor: "pointer",
                  }}
                >
                  <Trash2 size={12} />
                </button>
              )}
            </div>
          ))}
        </div>

        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px",
            borderRadius: "10px",
            background: "#F1F5F9",
          }}
        >
          <input
            type="text"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            placeholder="Nuevo estado (ej. Listo para Retiro)"
            style={{
              flex: "1 1 180px",
              padding: "7px 10px",
              borderRadius: "7px",
              border: "1px solid #CBD5E1",
              fontSize: "0.8rem",
              background: "#FFFFFF",
            }}
          />
          <input
            type="color"
            value={nuevoFondo}
            onChange={(e) => setNuevoFondo(e.target.value)}
            title="Fondo"
            style={{ width: "32px", height: "30px", border: "none", cursor: "pointer" }}
          />
          <input
            type="color"
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            title="Texto"
            style={{ width: "32px", height: "30px", border: "none", cursor: "pointer" }}
          />
          <button
            type="button"
            onClick={agregarEstado}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "7px 11px",
              borderRadius: "7px",
              border: "none",
              background: "#0F172A",
              color: "#FFFFFF",
              fontSize: "0.78rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            <Plus size={13} />
            <span>Agregar</span>
          </button>
        </div>

        <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
          <button
            type="button"
            onClick={onCerrar}
            style={{
              padding: "8px 13px",
              borderRadius: "8px",
              border: "1px solid #CBD5E1",
              background: "#FFFFFF",
              color: "#475569",
              fontSize: "0.8rem",
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={guardando}
            onClick={() => void handleGuardar()}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              padding: "8px 15px",
              borderRadius: "8px",
              border: "none",
              background: "#059669",
              color: "#FFFFFF",
              fontSize: "0.8rem",
              fontWeight: 700,
              cursor: guardando ? "wait" : "pointer",
            }}
          >
            {guardando ? <Loader2 size={14} /> : <Save size={14} />}
            <span>Guardar Estados</span>
          </button>
        </div>
      </div>
    </div>
  );
}
