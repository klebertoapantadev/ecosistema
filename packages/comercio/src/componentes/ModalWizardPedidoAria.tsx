"use client";

import React, { useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import {
  analizarMensajePedidoConAriaAction,
  crearPedidoDesdeMensajeAriaAction,
} from "../acciones-operaciones-taller";
import {
  CLASIFICACIONES_OPERATIVAS_PEDIDO,
  OPCIONES_SALA_EXEQUIALES,
  RANGOS_HORARIO_ENTREGA_TIENDA,
  type ClasificacionOperativaPedido,
  type EstadoPedidoConfig,
} from "../operaciones-taller";
import type { ResultadoParseoPedidoAria } from "../utils/parsearPedidoAria";

export interface PropsModalWizardPedidoAria {
  abierto: boolean;
  negocio: string;
  estadosDisponibles: EstadoPedidoConfig[];
  onCerrar: () => void;
  onPedidoCreado: (resultado: { codigo: string; ordenId: string }) => void;
}

const EJEMPLO_TELEGRAM = `Pedido #3💸NUEVA VENTA💸

🛒PEDIDO
Fecha: Jueves 19 de noviembre
Hora: De 12 pm a 2pm
Arreglo: Bouquet Coreano grande de 40 rosas rojas
1 set de mariposas ll
Color: FALTA

✍🏻TARJETA
Mensaje: Te amo con un cariño que el tiempo no ha borrado. Me encanta estar contigo, ver tu felicidad y soñar con poder hacerte feliz cada día.

De Oscar
Para Alejus
Firma: S/F

🚚DATOS ENTREGA
Sector: Leonisa corporate norte de Quito para Carcelen industrial
Dirección: https://maps.app.goo.gl/JB35dyKv2uxFHeHi9?g_st=awb
Recibe: Alejandra Merino 0967361525
Envia: feliz (Feliz) +593987746739`;

const EJEMPLO_EXEQUIALES = `Exequiales sala 4 , pedido por cristina`;

export function ModalWizardPedidoAria({
  abierto,
  negocio,
  estadosDisponibles,
  onCerrar,
  onPedidoCreado,
}: PropsModalWizardPedidoAria) {
  const [paso, setPaso] = useState<1 | 2>(1);
  const [textoMensaje, setTextoMensaje] = useState<string>("");
  const [analizando, setAnalizando] = useState<boolean>(false);
  const [guardando, setGuardando] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [datos, setDatos] = useState<ResultadoParseoPedidoAria | null>(null);

  if (!abierto) return null;

  const handleAnalizar = async (textoOverride?: string) => {
    const txt = (textoOverride ?? textoMensaje).trim();
    if (txt.length < 4) {
      setErrorMsg("Pega el mensaje de Telegram o escribe los datos del pedido.");
      return;
    }
    setAnalizando(true);
    setErrorMsg(null);
    const res = await analizarMensajePedidoConAriaAction({
      negocio,
      textoMensaje: txt,
    });
    setAnalizando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setDatos(res.datos);
    setPaso(2);
  };

  const handleGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!datos) return;
    setGuardando(true);
    setErrorMsg(null);
    const res = await crearPedidoDesdeMensajeAriaAction({
      negocio,
      datos,
    });
    setGuardando(false);
    if (!res.ok) {
      setErrorMsg(res.error);
      return;
    }
    setTextoMensaje("");
    setDatos(null);
    setPaso(1);
    onPedidoCreado({ codigo: res.codigo, ordenId: res.ordenId });
  };

  const labelStyle: React.CSSProperties = {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "var(--ct-334155, #334155)",
    marginBottom: "4px",
  };
  const inputStyle: React.CSSProperties = {
    width: "100%",
    padding: "8px 10px",
    borderRadius: "8px",
    border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
    fontSize: "0.82rem",
    background: "var(--cf-ffffff, #FFFFFF)",
    color: "var(--ct-0f172a, #0F172A)",
    boxSizing: "border-box",
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
          maxWidth: "660px",
          maxHeight: "92vh",
          overflowY: "auto",
          background: "var(--cf-ffffff, #FFFFFF)",
          borderRadius: "16px",
          padding: "20px",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0 20px 50px rgba(0, 0, 0, 0.28)",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div
              style={{
                width: "34px",
                height: "34px",
                borderRadius: "10px",
                background: "linear-gradient(135deg, #EC4899 0%, #7C3AED 100%)",
                color: "#FFFFFF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <Sparkles size={17} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: "1rem", color: "var(--ct-0f172a, #0F172A)" }}>
                Nuevo Pedido con ARIA
              </h3>
              <div style={{ fontSize: "0.73rem", color: "var(--ct-64748b, #64748B)" }}>
                Paso {paso} de 2 · {paso === 1 ? "Pega el mensaje o dictado" : "Revisa y confirma"}
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={onCerrar}
            aria-label="Cerrar"
            style={{ border: "none", background: "transparent", cursor: "pointer", color: "var(--ct-64748b, #64748B)" }}
          >
            <X size={19} />
          </button>
        </div>

        {errorMsg && (
          <div
            style={{
              padding: "9px 12px",
              borderRadius: "9px",
              background: "var(--cf-fef2f2, #FEF2F2)",
              border: "1px solid var(--cb-fecaca, #FECACA)",
              color: "var(--ct-991b1b, #991B1B)",
              fontSize: "0.8rem",
            }}
          >
            {errorMsg}
          </div>
        )}

        {paso === 1 ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
              <span style={{ fontSize: "0.74rem", color: "var(--ct-64748b, #64748B)", fontWeight: 600 }}>
                Ejemplos rápidos:
              </span>
              <button
                type="button"
                onClick={() => setTextoMensaje(EJEMPLO_TELEGRAM)}
                style={{
                  padding: "4px 9px",
                  borderRadius: "999px",
                  border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
                  background: "var(--cf-f8fafc, #F8FAFC)",
                  color: "var(--ct-334155, #334155)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Mensaje Telegram / ManyChat
              </button>
              <button
                type="button"
                onClick={() => setTextoMensaje(EJEMPLO_EXEQUIALES)}
                style={{
                  padding: "4px 9px",
                  borderRadius: "999px",
                  border: "1px solid var(--cb-e9d5ff, #E9D5FF)",
                  background: "var(--cf-faf5ff, #FAF5FF)",
                  color: "var(--ct-6b21a8, #6B21A8)",
                  fontSize: "0.72rem",
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Exequiales rápido
              </button>
            </div>

            <textarea
              rows={9}
              value={textoMensaje}
              onChange={(e) => setTextoMensaje(e.target.value)}
              placeholder={`Pega aquí el mensaje de Telegram/ManyChat o escribe directo:\nEj: "Exequiales sala 4 , pedido por cristina"`}
              style={{
                ...inputStyle,
                resize: "vertical",
                fontFamily: "inherit",
                lineHeight: 1.45,
              }}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "8px" }}>
              <button
                type="button"
                onClick={onCerrar}
                style={{
                  padding: "8px 14px",
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
                disabled={analizando || !textoMensaje.trim()}
                onClick={() => void handleAnalizar()}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "9px 16px",
                  borderRadius: "9px",
                  border: "none",
                  background: "linear-gradient(135deg, #0F172A 0%, #312E81 100%)",
                  color: "#FFFFFF",
                  fontSize: "0.82rem",
                  fontWeight: 700,
                  cursor: analizando ? "wait" : "pointer",
                }}
              >
                {analizando ? <Loader2 size={14} /> : <Sparkles size={14} />}
                <span>{analizando ? "Analizando con ARIA..." : "Analizar con ARIA"}</span>
              </button>
            </div>
          </div>
        ) : (
          datos && (
            <form
              onSubmit={(e) => void handleGuardar(e)}
              style={{ display: "flex", flexDirection: "column", gap: "11px" }}
            >
              {datos.faltantes.length > 0 && (
                <div
                  style={{
                    padding: "9px 12px",
                    borderRadius: "9px",
                    background: "var(--cf-fffbeb, #FFFBEB)",
                    border: "1px solid var(--cb-fde68a, #FDE68A)",
                    color: "var(--ct-92400e, #92400E)",
                    fontSize: "0.77rem",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "7px",
                  }}
                >
                  <AlertTriangle size={15} style={{ flexShrink: 0, marginTop: "1px" }} />
                  <div>
                    <strong>Datos por confirmar:</strong> {datos.faltantes.join(" · ")}
                  </div>
                </div>
              )}

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>Clasificación *</label>
                  <select
                    value={datos.clasificacionPedido}
                    onChange={(e) => {
                      const cl = e.target.value as ClasificacionOperativaPedido;
                      setDatos((prev) =>
                        prev
                          ? {
                              ...prev,
                              clasificacionPedido: cl,
                              origenTipo: cl === "EXEQUIALES" ? "EXEQUIALES_LLAMADA" : "MANUAL_ADMIN",
                            }
                          : null
                      );
                    }}
                    style={inputStyle}
                  >
                    {CLASIFICACIONES_OPERATIVAS_PEDIDO.map((c) => (
                      <option key={c.clave} value={c.clave}>
                        {c.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label style={labelStyle}>Estado Inicial *</label>
                  <select
                    value={datos.estadoInicial}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, estadoInicial: e.target.value } : null))
                    }
                    style={{ ...inputStyle, fontWeight: 700, background: "var(--cf-fef3c7, #FEF3C7)", color: "var(--ct-92400e, #92400E)" }}
                  >
                    {estadosDisponibles.map((est) => (
                      <option key={est.valor} value={est.valor}>
                        {est.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(175px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>Fecha de Entrega *</label>
                  <input
                    type="date"
                    required
                    value={datos.fechaEntrega}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, fechaEntrega: e.target.value } : null))
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Franja Horaria</label>
                  <select
                    value={datos.franjaHoraria ?? ""}
                    onChange={(e) =>
                      setDatos((prev) =>
                        prev ? { ...prev, franjaHoraria: e.target.value || null } : null
                      )
                    }
                    style={inputStyle}
                  >
                    <option value="">Sin franja / Hora puntual</option>
                    {RANGOS_HORARIO_ENTREGA_TIENDA.map((r) => (
                      <option key={r.codigo} value={r.valor}>
                        {r.etiqueta}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={labelStyle}>Hora / Detalle Horario</label>
                  <input
                    type="text"
                    value={datos.horaEspecifica ?? ""}
                    onChange={(e) =>
                      setDatos((prev) =>
                        prev ? { ...prev, horaEspecifica: e.target.value || null } : null
                      )
                    }
                    placeholder="De 12 pm a 2pm / Lo antes posible"
                    style={inputStyle}
                  />
                </div>
              </div>

              <div>
                <label style={labelStyle}>Arreglo / Producto *</label>
                <input
                  type="text"
                  required
                  value={datos.productoResumen}
                  onChange={(e) =>
                    setDatos((prev) =>
                      prev
                        ? {
                            ...prev,
                            productoResumen: e.target.value,
                            items: [{ descripcion: e.target.value, cantidad: 1 }],
                          }
                        : null
                    )
                  }
                  style={inputStyle}
                />
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>Quien Solicita / Envía *</label>
                  <input
                    type="text"
                    required
                    value={datos.clienteSolicita}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, clienteSolicita: e.target.value } : null))
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Teléfono Remitente</label>
                  <input
                    type="text"
                    value={datos.clienteTelefono}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, clienteTelefono: e.target.value } : null))
                    }
                    style={inputStyle}
                  />
                </div>
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>
                    {datos.clasificacionPedido === "EXEQUIALES"
                      ? "Fallecido"
                      : "Destinatario / Recibe"}
                  </label>
                  <input
                    type="text"
                    value={datos.destinatarioFallecido}
                    onChange={(e) =>
                      setDatos((prev) =>
                        prev ? { ...prev, destinatarioFallecido: e.target.value } : null
                      )
                    }
                    style={inputStyle}
                  />
                </div>

                {datos.clasificacionPedido === "EXEQUIALES" ? (
                  <div>
                    <label style={labelStyle}>Sala Exequiales</label>
                    <select
                      value={datos.salaServicio ?? ""}
                      onChange={(e) =>
                        setDatos((prev) =>
                          prev ? { ...prev, salaServicio: e.target.value || null } : null
                        )
                      }
                      style={inputStyle}
                    >
                      <option value="">Por confirmar</option>
                      {OPCIONES_SALA_EXEQUIALES.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  </div>
                ) : (
                  <div>
                    <label style={labelStyle}>Total USD (opcional)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={datos.totalUsd ?? ""}
                      onChange={(e) =>
                        setDatos((prev) =>
                          prev
                            ? {
                                ...prev,
                                totalUsd: e.target.value ? Number(e.target.value) : undefined,
                              }
                            : null
                        )
                      }
                      placeholder="0.00"
                      style={inputStyle}
                    />
                  </div>
                )}
              </div>

              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))",
                  gap: "10px",
                }}
              >
                <div>
                  <label style={labelStyle}>Sector / Dirección de Entrega</label>
                  <input
                    type="text"
                    value={datos.ubicacionEntrega}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, ubicacionEntrega: e.target.value } : null))
                    }
                    style={inputStyle}
                  />
                </div>
                <div>
                  <label style={labelStyle}>Enlace Google Maps</label>
                  <input
                    type="url"
                    value={datos.enlaceMapa ?? ""}
                    onChange={(e) =>
                      setDatos((prev) =>
                        prev ? { ...prev, enlaceMapa: e.target.value || null } : null
                      )
                    }
                    placeholder="https://maps.app.goo.gl/..."
                    style={inputStyle}
                  />
                </div>
              </div>

              {datos.clasificacionPedido !== "EXEQUIALES" && (
                <div>
                  <label style={labelStyle}>Mensaje de Tarjeta (Dedicatoria)</label>
                  <textarea
                    rows={3}
                    value={datos.dedicatoria}
                    onChange={(e) =>
                      setDatos((prev) => (prev ? { ...prev, dedicatoria: e.target.value } : null))
                    }
                    style={{ ...inputStyle, resize: "vertical", fontFamily: "inherit" }}
                  />
                </div>
              )}

              <div>
                <label style={labelStyle}>Observaciones / Datos Adicionales</label>
                <input
                  type="text"
                  value={datos.observaciones}
                  onChange={(e) =>
                    setDatos((prev) => (prev ? { ...prev, observaciones: e.target.value } : null))
                  }
                  style={inputStyle}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", gap: "8px", flexWrap: "wrap", marginTop: "4px" }}>
                <button
                  type="button"
                  onClick={() => setPaso(1)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "8px 13px",
                    borderRadius: "8px",
                    border: "1px solid var(--cb-cbd5e1, #CBD5E1)",
                    background: "var(--cf-ffffff, #FFFFFF)",
                    color: "var(--ct-334155, #334155)",
                    fontSize: "0.8rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <ArrowLeft size={14} />
                  <span>Editar Texto</span>
                </button>

                <div style={{ display: "flex", gap: "8px" }}>
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
                    type="submit"
                    disabled={guardando}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      border: "none",
                      background: "#059669",
                      color: "#FFFFFF",
                      fontSize: "0.82rem",
                      fontWeight: 700,
                      cursor: guardando ? "wait" : "pointer",
                    }}
                  >
                    {guardando ? <Loader2 size={14} /> : <CheckCircle2 size={14} />}
                    <span>{guardando ? "Guardando..." : "Guardar Pedido"}</span>
                  </button>
                </div>
              </div>
            </form>
          )
        )}
      </div>
    </div>
  );
}
