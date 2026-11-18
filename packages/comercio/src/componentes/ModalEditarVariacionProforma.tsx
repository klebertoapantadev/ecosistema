"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useMemo, useState } from "react";
import { CheckCircle2, FilePlus2, Loader2, Mail, Plus, Trash2, X } from "lucide-react";
import {
  crearVariacionProformaAsesorAction,
  type PedidoTiendaRegistrado,
} from "../acciones-logistica";

interface PropsModalEditarVariacionProforma {
  pedidoBase: PedidoTiendaRegistrado;
  alCerrar: () => void;
  alVariacionCreada: () => void;
}

interface LineaEditable {
  idLocal: string;
  descripcion: string;
  cantidad: number;
  precioUnitario: number;
  tarifaIva: number;
}

export function ModalEditarVariacionProforma({
  pedidoBase,
  alCerrar,
  alVariacionCreada,
}: PropsModalEditarVariacionProforma) {
  const siguienteVerSugerida = (pedidoBase.versionNumero ?? 1) + 1;

  const [etiquetaVersion, setEtiquetaVersion] = useState(
    `Propuesta V${siguienteVerSugerida} — Ajuste tras llamada`
  );
  const [notaAsesor, setNotaAsesor] = useState(
    pedidoBase.notaAsesor ||
      "Actualizamos tu proforma según lo conversado para que puedas comparar con tu versión original y elegir la opción ideal para tu evento."
  );
  const [tipoEvento, setTipoEvento] = useState(
    pedidoBase.evento?.tipoEvento || "Boda / Ceremonia"
  );
  const [fechaEvento, setFechaEvento] = useState(
    pedidoBase.evento?.fechaEvento || pedidoBase.logistica.fechaEntrega || ""
  );
  const [horaEvento, setHoraEvento] = useState(pedidoBase.evento?.horaEvento || "");
  const [invitados, setInvitados] = useState(
    pedidoBase.evento?.invitadosEstimados ? String(pedidoBase.evento.invitadosEstimados) : ""
  );
  const [paletaColores, setPaletaColores] = useState(pedidoBase.evento?.paletaColores || "");
  const [direccionEvento, setDireccionEvento] = useState(pedidoBase.logistica.direccion || "");
  const [costoEnvio, setCostoEnvio] = useState<string>(String(pedidoBase.costoEnvio ?? 0));
  const [descuentoTotal, setDescuentoTotal] = useState<string>(
    String(pedidoBase.descuento ?? 0)
  );

  const [lineas, setLineas] = useState<LineaEditable[]>(() =>
    pedidoBase.items.map((it, idx) => ({
      idLocal: `lin-${idx}-${Date.now()}`,
      descripcion: it.descripcion,
      cantidad: it.cantidad,
      precioUnitario: it.precioUnitario,
      tarifaIva: (it.impuesto || "").includes("15") ? 15 : 0,
    }))
  );

  const [enviando, setEnviando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resultadoExito, setResultadoExito] = useState<{
    codigoProforma: string;
    tokenAprobacion: string;
    correoEnviado: boolean;
    avisoCorreo?: string;
  } | null>(null);

  const resumenTotales = useMemo(() => {
    let subtotalBruto = 0;
    let iva = 0;
    lineas.forEach((l) => {
      const totalLin = Math.max(0, (Number(l.cantidad) || 0) * (Number(l.precioUnitario) || 0));
      subtotalBruto += totalLin;
      if (l.tarifaIva > 0) {
        const base = totalLin / (1 + l.tarifaIva / 100);
        iva += totalLin - base;
      }
    });
    const fleteNum = Math.max(0, Number(costoEnvio) || 0);
    const descNum = Math.max(0, Number(descuentoTotal) || 0);
    const total = Math.max(0, Math.round((subtotalBruto + fleteNum - descNum) * 100) / 100);
    const reserva70 = Math.round(total * 0.7 * 100) / 100;
    return {
      subtotalBruto: Math.round(subtotalBruto * 100) / 100,
      iva: Math.round(iva * 100) / 100,
      fleteNum,
      descNum,
      total,
      reserva70,
    };
  }, [lineas, costoEnvio, descuentoTotal]);

  const agregarLinea = () => {
    setLineas((prev) => [
      ...prev,
      {
        idLocal: `lin-new-${Date.now()}`,
        descripcion: "",
        cantidad: 1,
        precioUnitario: 50,
        tarifaIva: 0,
      },
    ]);
  };

  const eliminarLinea = (idLocal: string) => {
    setLineas((prev) => (prev.length > 1 ? prev.filter((l) => l.idLocal !== idLocal) : prev));
  };

  const actualizarLinea = (idLocal: string, cambios: Partial<LineaEditable>) => {
    setLineas((prev) =>
      prev.map((l) => (l.idLocal === idLocal ? { ...l, ...cambios } : l))
    );
  };

  const handleGuardarYEnviar = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    const lineasValidas = lineas.filter(
      (l) => l.descripcion.trim().length >= 2 && Number(l.cantidad) > 0
    );
    if (lineasValidas.length === 0) {
      setErrorMsg("Incluye al menos un ítem con descripción y cantidad mayor a cero.");
      return;
    }

    setEnviando(true);
    const res = await crearVariacionProformaAsesorAction({
      proformaBaseId: pedidoBase.id,
      negocio: pedidoBase.negocio,
      etiquetaVersion,
      notaAsesor,
      descuentoTotal: resumenTotales.descNum,
      costoEnvio: resumenTotales.fleteNum,
      direccionEvento,
      evento: {
        tipoEvento: tipoEvento || "Evento",
        fechaEvento: fechaEvento || "Por confirmar",
        horaEvento: horaEvento || undefined,
        invitadosEstimados: invitados ? Number(invitados) : undefined,
        paletaColores: paletaColores || undefined,
        notasEvento: pedidoBase.evento?.notasEvento,
      },
      items: lineasValidas.map((l) => ({
        descripcion: l.descripcion.trim(),
        cantidad: Number(l.cantidad) || 1,
        precioUnitario: Number(l.precioUnitario) || 0,
        tarifaIva: l.tarifaIva,
      })),
    });
    setEnviando(false);

    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }

    setResultadoExito({
      codigoProforma: res.codigoProforma,
      tokenAprobacion: res.tokenAprobacion,
      correoEnviado: res.correoEnviado,
      avisoCorreo: res.avisoCorreo,
    });
    alVariacionCreada();
  };

  const inputEstilo: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid #CBD5E1",
    fontSize: "0.84rem",
    color: "#0F172A",
    background: "#FFFFFF",
  };

  return (
    <div
      onClick={alCerrar}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1200,
        background: "rgba(15, 23, 42, 0.58)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        style={{
          width: "100%",
          maxWidth: "820px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "#FFFFFF",
          borderRadius: "16px",
          border: "1px solid #E2E8F0",
          boxShadow: "0 20px 50px rgba(15, 23, 42, 0.25)",
          padding: "22px",
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: "12px",
            borderBottom: "1px solid #E2E8F0",
            paddingBottom: "14px",
            marginBottom: "16px",
          }}
        >
          <div>
            <span
              style={{
                display: "inline-block",
                padding: "2px 8px",
                borderRadius: "999px",
                background: "#ECFDF5",
                color: "#065F46",
                fontSize: "0.72rem",
                fontWeight: 700,
                marginBottom: "4px",
              }}
            >
              ACTUALIZACIÓN DE ASESOR · CONSERVA VERSIÓN ORIGINAL
            </span>
            <h3 style={{ margin: 0, fontSize: "1.12rem", color: "#0F172A" }}>
              Nueva Variación sobre {pedidoBase.codigoOrden}
            </h3>
            <p style={{ margin: "4px 0 0", fontSize: "0.82rem", color: "#475569" }}>
              Cliente: <strong>{pedidoBase.compradorNombre}</strong> ({pedidoBase.compradorCorreo}) ·
              Se enviará por correo el PDF Original + el PDF de esta nueva variación.
            </p>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            title="Cerrar editor de proforma"
            aria-label="Cerrar"
            style={{
              border: "1px solid #E2E8F0",
              background: "#F8FAFC",
              borderRadius: "8px",
              padding: "6px",
              cursor: "pointer",
            }}
          >
            <X size={18} />
          </button>
        </div>

        {resultadoExito ? (
          <div
            style={{
              padding: "20px",
              borderRadius: "12px",
              background: "#F0FDF4",
              border: "1px solid #BBF7D0",
              textAlign: "center",
            }}
          >
            <CheckCircle2 size={42} style={{ color: "#15803D", marginBottom: "8px" }} />
            <h4 style={{ margin: "0 0 6px", fontSize: "1.05rem", color: "#14532D" }}>
              Variación {resultadoExito.codigoProforma} emitida con éxito
            </h4>
            <p style={{ margin: "0 0 12px", fontSize: "0.86rem", color: "#166534" }}>
              {resultadoExito.correoEnviado
                ? `Enviamos a ${pedidoBase.compradorCorreo} el correo con los 2 PDFs adjuntos (Proforma Original + Nueva Variación) y el link de selección.`
                : `La variación quedó almacenada y activa. (${
                    resultadoExito.avisoCorreo ||
                    "El correo automático no pudo despacharse; puedes compartir el link directo por WhatsApp."
                  })`}
            </p>
            <div style={{ display: "flex", justifyContent: "center", gap: "10px", flexWrap: "wrap" }}>
              <a
                href={`/proforma/${resultadoExito.tokenAprobacion}`}
                target="_blank"
                rel="noopener noreferrer"
                title="Ver nueva variación en línea"
                aria-label="Ver Variación"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  background: "#2D4734",
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "0.84rem",
                  fontWeight: 700,
                }}
              >
                Ver Variación
              </a>
              <button
                type="button"
                onClick={alCerrar}
                title="Cerrar ventana"
                aria-label="Listo"
                style={{
                  padding: "9px 16px",
                  borderRadius: "8px",
                  border: "1px solid #CBD5E1",
                  background: "#FFFFFF",
                  color: "#0F172A",
                  fontSize: "0.84rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Listo
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleGuardarYEnviar} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Nombre de esta Variación
                </label>
                <input
                  type="text"
                  required
                  value={etiquetaVersion}
                  onChange={(e) => setEtiquetaVersion(e.target.value)}
                  style={inputEstilo}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Tipo de Evento
                </label>
                <input
                  type="text"
                  required
                  value={tipoEvento}
                  onChange={(e) => setTipoEvento(e.target.value)}
                  style={inputEstilo}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Fecha del Evento
                </label>
                <input
                  type="date"
                  value={fechaEvento}
                  onChange={(e) => setFechaEvento(e.target.value)}
                  style={inputEstilo}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Hora / Invitados / Paleta
                </label>
                <div style={{ display: "flex", gap: "6px" }}>
                  <input
                    type="time"
                    value={horaEvento}
                    onChange={(e) => setHoraEvento(e.target.value)}
                    style={{ ...inputEstilo, width: "45%" }}
                  />
                  <input
                    type="text"
                    placeholder="Paleta / estilo"
                    value={paletaColores}
                    onChange={(e) => setPaletaColores(e.target.value)}
                    style={{ ...inputEstilo, width: "55%" }}
                  />
                </div>
              </div>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                Nota del Asesor para el Cliente (visible en correo, web y PDF)
              </label>
              <textarea
                rows={2}
                value={notaAsesor}
                onChange={(e) => setNotaAsesor(e.target.value)}
                placeholder="Ej. Según nuestra llamada, ajustamos las cantidades de centros de mesa e incluimos estructura de bienvenida..."
                style={inputEstilo}
              />
            </div>

            {/* Tabla editable de ítems */}
            <div
              style={{
                border: "1px solid #E2E8F0",
                borderRadius: "10px",
                padding: "12px",
                background: "#F8FAFC",
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "10px",
                }}
              >
                <strong style={{ fontSize: "0.84rem", color: "#0F172A" }}>
                  Ítems de esta Variación
                </strong>
                <button
                  type="button"
                  onClick={agregarLinea}
                  title="Añadir nuevo arreglo o servicio a esta variación"
                  aria-label="Agregar Ítem"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "1px solid #2D4734",
                    background: "#FFFFFF",
                    color: "#2D4734",
                    fontSize: "0.76rem",
                    fontWeight: 700,
                    cursor: "pointer",
                  }}
                >
                  <Plus size={14} />
                  <span>Agregar Ítem</span>
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {lineas.map((lin) => (
                  <div
                    key={lin.idLocal}
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "6px",
                      alignItems: "center",
                    }}
                  >
                    <input
                      type="text"
                      required
                      placeholder="Descripción del arreglo o servicio de evento"
                      value={lin.descripcion}
                      onChange={(e) => actualizarLinea(lin.idLocal, { descripcion: e.target.value })}
                      style={{ ...inputEstilo, flex: "1 1 220px", minWidth: 0 }}
                    />
                    <div style={{ display: "flex", gap: "6px", alignItems: "center", flex: "1 1 auto", flexWrap: "nowrap" }}>
                      <input
                        type="number"
                        min={1}
                        step={1}
                        value={lin.cantidad}
                        onChange={(e) =>
                          actualizarLinea(lin.idLocal, { cantidad: Math.max(1, Number(e.target.value) || 1) })
                        }
                        title="Cantidad"
                        style={{ ...inputEstilo, width: "68px", flex: "0 0 68px" }}
                      />
                      <input
                        type="number"
                        min={0}
                        step="0.01"
                        value={lin.precioUnitario}
                        onChange={(e) =>
                          actualizarLinea(lin.idLocal, {
                            precioUnitario: Math.max(0, Number(e.target.value) || 0),
                          })
                        }
                        title="Precio unitario PVP (USD)"
                        style={{ ...inputEstilo, width: "92px", flex: "1 1 84px", minWidth: "74px" }}
                      />
                      <SelectConBuscador
                        value={lin.tarifaIva}
                        onChange={(e) =>
                          actualizarLinea(lin.idLocal, { tarifaIva: Number(e.target.value) })
                        }
                        title="Tarifa IVA"
                        style={{ ...inputEstilo, width: "86px", flex: "0 0 86px" }}
                      >
                        <option value={0}>IVA 0%</option>
                        <option value={15}>IVA 15%</option>
                      </SelectConBuscador>
                      <button
                        type="button"
                        onClick={() => eliminarLinea(lin.idLocal)}
                        disabled={lineas.length <= 1}
                        title="Quitar ítem"
                        aria-label="Quitar ítem"
                        style={{
                          border: "1px solid #FECACA",
                          background: "#FEF2F2",
                          color: "#B91C1C",
                          borderRadius: "7px",
                          padding: "7px",
                          flexShrink: 0,
                          cursor: lineas.length <= 1 ? "not-allowed" : "pointer",
                          opacity: lineas.length <= 1 ? 0.45 : 1,
                        }}
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Ajustes logísticos y descuento */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                gap: "10px",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Locación del Evento
                </label>
                <input
                  type="text"
                  value={direccionEvento}
                  onChange={(e) => setDireccionEvento(e.target.value)}
                  placeholder="Quinta, iglesia o salón"
                  style={inputEstilo}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Transporte / Montaje (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={costoEnvio}
                  onChange={(e) => setCostoEnvio(e.target.value)}
                  style={inputEstilo}
                />
              </div>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, marginBottom: "4px" }}>
                  Descuento Especial (USD)
                </label>
                <input
                  type="number"
                  min={0}
                  step="0.01"
                  value={descuentoTotal}
                  onChange={(e) => setDescuentoTotal(e.target.value)}
                  style={inputEstilo}
                />
              </div>
            </div>

            {/* Resumen financiero comparativo */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                flexWrap: "wrap",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "10px",
                background: "#F0FDF4",
                border: "1px solid #BBF7D0",
                fontSize: "0.84rem",
              }}
            >
              <div>
                <span style={{ color: "#475569" }}>
                  Base anterior ({pedidoBase.codigoOrden}):{" "}
                  <strong>${pedidoBase.total.toFixed(2)}</strong>
                </span>
                <div style={{ color: "#14532D", fontWeight: 700, marginTop: "2px" }}>
                  Nuevo Total V{siguienteVerSugerida}: ${resumenTotales.total.toFixed(2)} USD ·
                  Reserva 70%: ${resumenTotales.reserva70.toFixed(2)} USD
                </div>
              </div>

              <div style={{ display: "flex", gap: "8px" }}>
                <button
                  type="button"
                  onClick={alCerrar}
                  title="Cancelar cambios"
                  aria-label="Cancelar"
                  style={{
                    padding: "9px 14px",
                    borderRadius: "8px",
                    border: "1px solid #CBD5E1",
                    background: "#FFFFFF",
                    fontSize: "0.82rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={enviando}
                  title="Guardar variación y enviar correo con PDF original y actualizado"
                  aria-label="Enviar Variación"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "9px 16px",
                    borderRadius: "8px",
                    border: "none",
                    background: "#2D4734",
                    color: "#FFFFFF",
                    fontSize: "0.84rem",
                    fontWeight: 700,
                    cursor: enviando ? "wait" : "pointer",
                    opacity: enviando ? 0.7 : 1,
                  }}
                >
                  {enviando ? <Loader2 size={15} /> : <Mail size={15} />}
                  <FilePlus2 size={15} />
                  <span>{enviando ? "Enviando..." : "Enviar Variación"}</span>
                </button>
              </div>
            </div>

            {errorMsg && (
              <div
                style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  background: "#FEF2F2",
                  border: "1px solid #FECACA",
                  color: "#B91C1C",
                  fontSize: "0.82rem",
                }}
              >
                {errorMsg}
              </div>
            )}
          </form>
        )}
      </div>
    </div>
  );
}

