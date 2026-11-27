"use client";

import React, { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, Eye, EyeOff, Loader2, Plus, Save, Trash2, X } from "lucide-react";
import { guardarEstadosPedidosAdminAction } from "../acciones-logistica";
import {
  ESTADOS_PEDIDO_DEFECTO,
  estadoVisibleEnTallerPorDefecto,
  type EstadoPedidoConfig,
} from "../operaciones-taller";

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
  const [nuevoVisibleTaller, setNuevoVisibleTaller] = useState<boolean>(true);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (abierto) {
      const base = estadosActuales.length > 0 ? estadosActuales : ESTADOS_PEDIDO_DEFECTO;
      setLista(
        base.map((e) => ({
          ...e,
          visibleEnTaller:
            typeof e.visibleEnTaller === "boolean"
              ? e.visibleEnTaller
              : estadoVisibleEnTallerPorDefecto(e.valor),
        }))
      );
      setErrorMsg(null);
    }
  }, [abierto, estadosActuales]);

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
        visibleEnTaller: nuevoVisibleTaller,
      },
    ]);
    setNuevaEtiqueta("");
  };

  const handleEliminar = (valor: string) => {
    if (lista.length <= 1) {
      setErrorMsg("Debe permanecer al menos un estado de pedido.");
      return;
    }
    setErrorMsg(null);
    setLista((prev) => prev.filter((x) => x.valor !== valor));
  };

  const handleGuardar = async () => {
    if (lista.length === 0) {
      setErrorMsg("Agrega al menos un estado antes de guardar.");
      return;
    }
    setGuardando(true);
    setErrorMsg(null);
    const res = await guardarEstadosPedidosAdminAction({
      negocio,
      estados: lista.map((e, i) => ({
        ...e,
        orden: (i + 1) * 10,
        visibleEnTaller: e.visibleEnTaller !== false,
      })),
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
      onClick={onCerrar}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: "700px",
          maxHeight: "90vh",
          overflowY: "auto",
          background: "var(--cf-ffffff, #FFFFFF)",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "12px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "1.02rem", color: "var(--ct-0f172a, #0F172A)" }}>
              Administrar Estados de Pedidos
            </h3>
            <p style={{ margin: "3px 0 0", fontSize: "0.76rem", color: "var(--ct-64748b, #64748B)" }}>
              Edita, agrega o elimina estados y define cuáles son visibles en la Consola de Taller.
            </p>
          </div>
          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            title="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ct-64748b, #64748B)" }}
          >
            <X size={18} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "8px 11px",
              borderRadius: "8px",
              background: "var(--cf-fef2f2, #FEF2F2)",
              border: "1px solid var(--cb-fecaca, #FECACA)",
              color: "var(--ct-991b1b, #991B1B)",
              fontSize: "0.79rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        <div style={{ display: "flex", flexDirection: "column", gap: "7px" }}>
          {lista.map((est, idx) => {
            const visibleTaller = est.visibleEnTaller !== false;
            return (
              <div
                key={est.valor}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "7px",
                  padding: "8px 10px",
                  borderRadius: "10px",
                  border: "1px solid var(--cb-e2e8f0, #E2E8F0)",
                  background: "var(--cf-f8fafc, #F8FAFC)",
                  flexWrap: "wrap",
                }}
              >
                <input
                  type="text"
                  value={est.etiqueta}
                  aria-label={`Nombre del estado ${est.valor}`}
                  onChange={(e) =>
                    setLista((prev) =>
                      prev.map((x) => (x.valor === est.valor ? { ...x, etiqueta: e.target.value } : x))
                    )
                  }
                  style={{
                    flex: "1 1 170px",
                    padding: "6px 9px",
                    borderRadius: "7px",
                    border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
                    fontSize: "0.8rem",
                    fontWeight: 700,
                    background: est.colorFondo,
                    color: est.colorTexto,
                  }}
                />

                {/* Interruptor: Visible en Taller */}
                <button
                  type="button"
                  onClick={() =>
                    setLista((prev) =>
                      prev.map((x) =>
                        x.valor === est.valor
                          ? { ...x, visibleEnTaller: !(x.visibleEnTaller !== false) }
                          : x
                      )
                    )
                  }
                  aria-pressed={visibleTaller}
                  title={
                    visibleTaller
                      ? "Los pedidos en este estado SÍ se muestran en Taller. Clic para ocultar."
                      : "Los pedidos en este estado NO se muestran en Taller. Clic para activar."
                  }
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "999px",
                    border: visibleTaller ? "1px solid #86EFAC" : "1px solid var(--cb-cbd5e1, #CBD5E1)",
                    background: visibleTaller ? "var(--cf-dcfce7, #DCFCE7)" : "var(--cf-f1f5f9, #F1F5F9)",
                    color: visibleTaller ? "var(--ct-166534, #166534)" : "var(--ct-64748b, #64748B)",
                    fontSize: "0.72rem",
                    fontWeight: 700,
                    cursor: "pointer",
                    whiteSpace: "nowrap",
                  }}
                >
                  {visibleTaller ? <Eye size={13} /> : <EyeOff size={13} />}
                  <span>{visibleTaller ? "Taller: Sí" : "Taller: No"}</span>
                </button>

                <input
                  type="color"
                  value={est.colorFondo}
                  title="Color de fondo"
                  aria-label="Color de fondo"
                  onChange={(e) =>
                    setLista((prev) =>
                      prev.map((x) => (x.valor === est.valor ? { ...x, colorFondo: e.target.value } : x))
                    )
                  }
                  style={{ width: "28px", height: "28px", border: "none", background: "transparent", cursor: "pointer" }}
                />
                <input
                  type="color"
                  value={est.colorTexto}
                  title="Color de texto"
                  aria-label="Color de texto"
                  onChange={(e) =>
                    setLista((prev) =>
                      prev.map((x) => (x.valor === est.valor ? { ...x, colorTexto: e.target.value } : x))
                    )
                  }
                  style={{ width: "28px", height: "28px", border: "none", background: "transparent", cursor: "pointer" }}
                />
                <button
                  type="button"
                  disabled={idx === 0}
                  onClick={() => mover(idx, -1)}
                  title="Subir"
                  aria-label="Subir estado"
                  style={{
                    padding: "5px",
                    borderRadius: "6px",
                    border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    cursor: idx === 0 ? "not-allowed" : "pointer",
                    opacity: idx === 0 ? 0.45 : 1,
                  }}
                >
                  <ArrowUp size={12} />
                </button>
                <button
                  type="button"
                  disabled={idx === lista.length - 1}
                  onClick={() => mover(idx, 1)}
                  title="Bajar"
                  aria-label="Bajar estado"
                  style={{
                    padding: "5px",
                    borderRadius: "6px",
                    border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    cursor: idx === lista.length - 1 ? "not-allowed" : "pointer",
                    opacity: idx === lista.length - 1 ? 0.45 : 1,
                  }}
                >
                  <ArrowDown size={12} />
                </button>
                <button
                  type="button"
                  disabled={lista.length <= 1}
                  onClick={() => handleEliminar(est.valor)}
                  title="Eliminar estado"
                  aria-label={`Eliminar estado ${est.etiqueta}`}
                  style={{
                    padding: "5px 7px",
                    borderRadius: "6px",
                    border: "1px solid var(--cb-fecaca, #FECACA)",
                    background: "var(--cf-fef2f2, #FEF2F2)",
                    color: "var(--ct-b91c1c, #B91C1C)",
                    cursor: lista.length <= 1 ? "not-allowed" : "pointer",
                    opacity: lista.length <= 1 ? 0.4 : 1,
                  }}
                >
                  <Trash2 size={12} />
                </button>
              </div>
            );
          })}
        </div>

        {/* Barra para agregar nuevo estado */}
        <div
          style={{
            display: "flex",
            gap: "8px",
            alignItems: "center",
            flexWrap: "wrap",
            padding: "10px",
            borderRadius: "10px",
            background: "var(--cf-f1f5f9, #F1F5F9)",
          }}
        >
          <input
            type="text"
            value={nuevaEtiqueta}
            onChange={(e) => setNuevaEtiqueta(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                agregarEstado();
              }
            }}
            placeholder="Nuevo estado (ej. Listo para Retiro)"
            style={{
              flex: "1 1 180px",
              padding: "7px 10px",
              borderRadius: "7px",
              border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
              fontSize: "0.8rem",
              background: "var(--cf-ffffff, #FFFFFF)",
            }}
          />
          <button
            type="button"
            onClick={() => setNuevoVisibleTaller((prev) => !prev)}
            aria-pressed={nuevoVisibleTaller}
            title="Define si el nuevo estado será visible en Taller"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "5px",
              padding: "6px 10px",
              borderRadius: "999px",
              border: nuevoVisibleTaller ? "1px solid #86EFAC" : "1px solid var(--cb-cbd5e1, #CBD5E1)",
              background: nuevoVisibleTaller ? "var(--cf-dcfce7, #DCFCE7)" : "var(--cf-ffffff, #FFFFFF)",
              color: nuevoVisibleTaller ? "var(--ct-166534, #166534)" : "var(--ct-64748b, #64748B)",
              fontSize: "0.73rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {nuevoVisibleTaller ? <Eye size={13} /> : <EyeOff size={13} />}
            <span>{nuevoVisibleTaller ? "Taller: Sí" : "Taller: No"}</span>
          </button>
          <input
            type="color"
            value={nuevoFondo}
            onChange={(e) => setNuevoFondo(e.target.value)}
            title="Color de fondo"
            style={{ width: "30px", height: "30px", border: "none", cursor: "pointer" }}
          />
          <input
            type="color"
            value={nuevoTexto}
            onChange={(e) => setNuevoTexto(e.target.value)}
            title="Color de texto"
            style={{ width: "30px", height: "30px", border: "none", cursor: "pointer" }}
          />
          <button
            type="button"
            onClick={agregarEstado}
            title="Agregar estado"
            aria-label="Agregar estado"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: "7px 12px",
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
              border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
              background: "var(--cf-ffffff, #FFFFFF)",
              color: "var(--ct-475569, #475569)",
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
