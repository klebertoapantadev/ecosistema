"use client";

import React, { useState } from "react";
import {
  CreditCard,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  ExternalLink,
  RefreshCw,
  X,
  FileText,
  User,
  Mail,
  Phone,
  Hash,
  Sparkles,
  Lock,
} from "lucide-react";
import {
  VarianteCatalogo,
  prepararPagoPayphoneAction,
  confirmarPagoPayphoneAction,
} from "../acciones";

interface Props {
  abierto: boolean;
  alCerrar: () => void;
  productoNombre: string;
  variante: VarianteCatalogo | null;
  negocio?: string;
  alPagoExitoso?: (transaccion: any) => void;
}

export function ModalCheckoutPayphone({
  abierto,
  alCerrar,
  productoNombre,
  variante,
  negocio = "tranqi",
  alPagoExitoso,
}: Props) {
  // Estado del formulario del pagador
  const [nombres, setNombres] = useState("");
  const [apellidos, setApellidos] = useState("");
  const [identificacion, setIdentificacion] = useState("");
  const [email, setEmail] = useState("");
  const [telefono, setTelefono] = useState("");

  // Estado del proceso
  const [paso, setPaso] = useState<"formulario" | "simulando" | "real_abierto" | "resultado">("formulario");
  const [modoSimulado, setModoSimulado] = useState(true);
  const [procesando, setProcesando] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Datos devueltos tras preparar
  const [prepData, setPrepData] = useState<{
    paymentId: string;
    clientTransactionId: string;
    payWithPayPhone: string | null;
    payWithCard: string | null;
  } | null>(null);

  // Resultado de confirmación
  const [resultadoPago, setResultadoPago] = useState<any | null>(null);

  if (!abierto || !variante) return null;

  // 1. Manejar envío para preparar transacción
  const manejarPrepararPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identificacion.trim() || !email.trim() || !nombres.trim() || !telefono.trim()) {
      setErrorMsg("Por favor completa todos los campos de facturación obligatorios.");
      return;
    }

    setProcesando(true);
    try {
      const res = await prepararPagoPayphoneAction({
        negocio,
        varianteId: variante.var_id,
        nombreServicio: `${productoNombre} - ${variante.var_nombre}`,
        montoBase: variante.var_precio,
        montoIva: variante.monto_iva,
        montoTotal: variante.precio_total,
        pagador: {
          nombres: nombres.trim(),
          apellidos: apellidos.trim() || "Cliente",
          identificacion: identificacion.trim(),
          email: email.trim(),
          telefono: telefono.trim(),
        },
        esSimulado: modoSimulado,
      });

      if (!res.ok || !res.paymentId || !res.clientTransactionId) {
        setErrorMsg(res.error || "No se pudo preparar la transacción de pago.");
        setProcesando(false);
        return;
      }

      setPrepData({
        paymentId: res.paymentId,
        clientTransactionId: res.clientTransactionId,
        payWithPayPhone: res.payWithPayPhone ?? null,
        payWithCard: res.payWithCard ?? null,
      });

      if (res.esSimulado) {
        setPaso("simulando");
      } else {
        setPaso("real_abierto");
        // Abrir pasarela real en pestaña nueva (PCI DSS compliant)
        if (res.payWithCard) {
          window.open(res.payWithCard, "_blank", "noopener,noreferrer");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error inesperado al conectar con la pasarela.");
    } finally {
      setProcesando(false);
    }
  };

  // 2. Manejar simulación de respuesta (Aprobar o Rechazar)
  const manejarConfirmarSimulacion = async (resultado: "APROBADO" | "RECHAZADO") => {
    if (!prepData) return;
    setProcesando(true);
    setErrorMsg(null);

    try {
      const res = await confirmarPagoPayphoneAction({
        negocio,
        id: prepData.paymentId,
        clientTxId: prepData.clientTransactionId,
        esSimulado: true,
        resultadoSimulacion: resultado,
        marcaTarjetaSimulada: "Visa",
      });

      if (!res.ok) {
        setErrorMsg(res.error || "Error al procesar simulación.");
        setProcesando(false);
        return;
      }

      setResultadoPago(res);
      setPaso("resultado");
      if (resultado === "APROBADO" && alPagoExitoso) {
        alPagoExitoso(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al confirmar simulación.");
    } finally {
      setProcesando(false);
    }
  };

  // 3. Manejar confirmación de transacción real
  const manejarConfirmarPagoReal = async () => {
    if (!prepData) return;
    setProcesando(true);
    setErrorMsg(null);

    try {
      const res = await confirmarPagoPayphoneAction({
        negocio,
        id: prepData.paymentId,
        clientTxId: prepData.clientTransactionId,
        esSimulado: false,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "La transacción aún no se ha completado en Payphone o fue rechazada.");
        setProcesando(false);
        return;
      }

      setResultadoPago(res);
      setPaso("resultado");
      if (res.estado === "APROBADO" && alPagoExitoso) {
        alPagoExitoso(res);
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al consultar estado en Payphone.");
    } finally {
      setProcesando(false);
    }
  };

  // Reiniciar estado al cerrar
  const reiniciarYCerrar = () => {
    setPaso("formulario");
    setPrepData(null);
    setResultadoPago(null);
    setErrorMsg(null);
    alCerrar();
  };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        backgroundColor: "rgba(15, 23, 42, 0.6)",
        backdropFilter: "blur(4px)",
        zIndex: 9999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          background: "#FFFFFF",
          borderRadius: "20px",
          width: "100%",
          maxWidth: "580px",
          maxHeight: "90vh",
          overflowY: "auto",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #E2E8F0",
          position: "relative",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Cabecera */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #E2E8F0",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#F8FAFC",
            borderTopLeftRadius: "20px",
            borderTopRightRadius: "20px",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#0284C7",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#FFFFFF",
              }}
            >
              <CreditCard size={22} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: "1.1rem", fontWeight: 700, color: "#0F172A" }}>
                Botón de Pago Payphone
              </h2>
              <p style={{ margin: 0, fontSize: "0.8rem", color: "#64748B" }}>
                Tarjetas de Crédito / Débito & Saldo Digital
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={reiniciarYCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "#64748B",
              padding: "6px",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* Resumen del Servicio e Importe */}
        <div
          style={{
            padding: "16px 24px",
            background: "#F0F9FF",
            borderBottom: "1px solid #BAE6FD",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}
        >
          <div>
            <div style={{ fontSize: "0.75rem", fontWeight: 700, color: "#0284C7", textTransform: "uppercase" }}>
              Servicio a Contratar
            </div>
            <div style={{ fontSize: "0.95rem", fontWeight: 700, color: "#0F172A" }}>
              {productoNombre}
            </div>
            <div style={{ fontSize: "0.8rem", color: "#475569" }}>
              Variante: {variante.var_nombre}
            </div>
          </div>
          <div style={{ textAlign: "right" }}>
            <div style={{ fontSize: "1.25rem", fontWeight: 800, color: "#0F172A" }}>
              ${variante.precio_total.toFixed(2)}
            </div>
            <div style={{ fontSize: "0.7rem", color: "#64748B" }}>
              Base: ${variante.var_precio.toFixed(2)} + IVA: ${variante.monto_iva.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Alerta de Error si existe */}
        {errorMsg && (
          <div
            style={{
              margin: "16px 24px 0",
              padding: "12px 16px",
              borderRadius: "10px",
              background: "#FEF2F2",
              border: "1px solid #FECACA",
              color: "#991B1B",
              fontSize: "0.85rem",
              display: "flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <AlertTriangle size={18} />
            <div>{errorMsg}</div>
          </div>
        )}

        {/* Contenido según Paso */}
        <div style={{ padding: "20px 24px", flex: 1 }}>
          {/* PASO 1: Formulario de Facturación y Selección de Modo */}
          {paso === "formulario" && (
            <form onSubmit={manejarPrepararPago}>
              {/* Selector Modo Simulado vs Modo Real */}
              <div
                style={{
                  background: modoSimulado ? "#FEF3C7" : "#F1F5F9",
                  border: modoSimulado ? "1px solid #FCD34D" : "1px solid #CBD5E1",
                  borderRadius: "12px",
                  padding: "12px 16px",
                  marginBottom: "20px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Sparkles size={20} color={modoSimulado ? "#B45309" : "#64748B"} />
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 700, color: modoSimulado ? "#92400E" : "#334155" }}>
                      {modoSimulado ? "⚡ Modo Simulado Activo (Sandbox)" : "🔒 Modo Real Payphone"}
                    </div>
                    <div style={{ fontSize: "0.75rem", color: modoSimulado ? "#B45309" : "#64748B" }}>
                      {modoSimulado
                        ? "Permite probar el flujo de cobro sin débito bancario real."
                        : "Conecta con la pasarela oficial Payphone para cobro real."}
                    </div>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "6px" }}>
                  <input
                    type="checkbox"
                    checked={modoSimulado}
                    onChange={(e) => setModoSimulado(e.target.checked)}
                    style={{ width: "16px", height: "16px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.8rem", fontWeight: 600, color: "#334155" }}>Simular</span>
                </label>
              </div>

              <h4 style={{ margin: "0 0 12px", fontSize: "0.9rem", color: "#334155", fontWeight: 700 }}>
                Datos de Facturación del Cliente
              </h4>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Nombres *
                  </label>
                  <div style={{ position: "relative" }}>
                    <User size={14} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
                    <input
                      type="text"
                      required
                      placeholder="Ej. Kleber"
                      value={nombres}
                      onChange={(e) => setNombres(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Apellidos
                  </label>
                  <input
                    type="text"
                    placeholder="Ej. Toapanta"
                    value={apellidos}
                    onChange={(e) => setApellidos(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px",
                      fontSize: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "12px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Cédula / RUC *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Hash size={14} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
                    <input
                      type="text"
                      required
                      placeholder="Ej. 1718192021"
                      value={identificacion}
                      onChange={(e) => setIdentificacion(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                    Teléfono Celular *
                  </label>
                  <div style={{ position: "relative" }}>
                    <Phone size={14} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
                    <input
                      type="tel"
                      required
                      placeholder="0999999999"
                      value={telefono}
                      onChange={(e) => setTelefono(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "8px 12px 8px 32px",
                        fontSize: "0.85rem",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              <div style={{ marginBottom: "20px" }}>
                <label style={{ display: "block", fontSize: "0.75rem", fontWeight: 600, color: "#475569", marginBottom: "4px" }}>
                  Correo Electrónico (Para envío del comprobante) *
                </label>
                <div style={{ position: "relative" }}>
                  <Mail size={14} color="#94A3B8" style={{ position: "absolute", left: "10px", top: "10px" }} />
                  <input
                    type="email"
                    required
                    placeholder="cliente@ejemplo.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "8px 12px 8px 32px",
                      fontSize: "0.85rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  onClick={reiniciarYCerrar}
                  style={{
                    background: "#F1F5F9",
                    color: "#475569",
                    border: "none",
                    padding: "10px 16px",
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
                  disabled={procesando}
                  style={{
                    background: "#0284C7",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "10px 20px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: procesando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {procesando ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                  {modoSimulado ? "Continuar con Simulación" : "Pagar con Payphone"}
                </button>
              </div>
            </form>
          )}

          {/* PASO 2: SIMULADOR INTERACTIVO */}
          {paso === "simulando" && prepData && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "#FEF3C7",
                  color: "#D97706",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <Sparkles size={30} />
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "#0F172A", fontWeight: 700 }}>
                Simulador de Pasarela Payphone
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#64748B" }}>
                La transacción ha sido preparada con ID: <code style={{ fontWeight: 700 }}>{prepData.clientTransactionId}</code>.
                Elige el resultado bancario a simular para probar el sistema:
              </p>

              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "24px",
                  textAlign: "left",
                  fontSize: "0.8rem",
                  color: "#334155",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Total a Cobrar:</span>
                  <span style={{ fontWeight: 700 }}>${variante.precio_total.toFixed(2)} USD</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                  <span>Cliente Facturación:</span>
                  <span>{nombres} {apellidos} ({identificacion})</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span>Correo Comprobante:</span>
                  <span>{email}</span>
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", justifyContent: "center" }}>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => manejarConfirmarSimulacion("RECHAZADO")}
                  style={{
                    background: "#FEE2E2",
                    color: "#991B1B",
                    border: "1px solid #FCA5A5",
                    padding: "10px 18px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: procesando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  <XCircle size={16} />
                  Simular Rechazo (Sin Fondos)
                </button>

                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => manejarConfirmarSimulacion("APROBADO")}
                  style={{
                    background: "#059669",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "10px 22px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: procesando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  {procesando ? <RefreshCw size={16} className="animate-spin" /> : <CheckCircle2 size={16} />}
                  Simular Pago Aprobado
                </button>
              </div>
            </div>
          )}

          {/* PASO 3: ENTORNO REAL ABIERTO EN PESTAÑA NUEVA */}
          {paso === "real_abierto" && prepData && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              <div
                style={{
                  width: "60px",
                  height: "60px",
                  borderRadius: "50%",
                  background: "#E0F2FE",
                  color: "#0284C7",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  margin: "0 auto 16px",
                }}
              >
                <ExternalLink size={30} />
              </div>

              <h3 style={{ margin: "0 0 8px", fontSize: "1.2rem", color: "#0F172A", fontWeight: 700 }}>
                Ventana de Pago Payphone Abierta
              </h3>
              <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#64748B" }}>
                Hemos abierto la pasarela en una pestaña segura externa. Completa el pago allí con tu tarjeta o app.
              </p>

              <div style={{ display: "flex", gap: "10px", justifyContent: "center", marginBottom: "20px" }}>
                {prepData.payWithCard && (
                  <a
                    href={prepData.payWithCard}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ExternalLink size={14} />
                    Reabrir Formulario Tarjeta
                  </a>
                )}
                {prepData.payWithPayPhone && (
                  <a
                    href={prepData.payWithPayPhone}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      background: "#FF6600",
                      color: "#FFFFFF",
                      padding: "8px 16px",
                      borderRadius: "8px",
                      fontSize: "0.85rem",
                      fontWeight: 600,
                      textDecoration: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <ExternalLink size={14} />
                    Pagar con App Payphone
                  </a>
                )}
              </div>

              <p style={{ fontSize: "0.75rem", color: "#B45309", margin: "0 0 16px" }}>
                ⚠️ Una vez completado el pago en Payphone, haz clic en "Verificar y Confirmar Pago" para emitir tu comprobante.
              </p>

              <button
                type="button"
                disabled={procesando}
                onClick={manejarConfirmarPagoReal}
                style={{
                  background: "#059669",
                  color: "#FFFFFF",
                  border: "none",
                  padding: "10px 20px",
                  borderRadius: "8px",
                  fontSize: "0.85rem",
                  fontWeight: 700,
                  cursor: procesando ? "not-allowed" : "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                }}
              >
                {procesando ? <RefreshCw size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                Verificar y Confirmar Pago
              </button>
            </div>
          )}

          {/* PASO 4: RESULTADO FINAL (APROBADO O RECHAZADO) */}
          {paso === "resultado" && resultadoPago && (
            <div style={{ textAlign: "center", padding: "10px 0" }}>
              {resultadoPago.estado === "APROBADO" ? (
                <>
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "#D1FAE5",
                      color: "#059669",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <CheckCircle2 size={36} />
                  </div>

                  <h3 style={{ margin: "0 0 6px", fontSize: "1.25rem", color: "#065F46", fontWeight: 800 }}>
                    ¡Pago Aprobado Exitosamente!
                  </h3>
                  <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#475569" }}>
                    Tu transacción ha sido procesada y registrada en el sistema contable de Tranqi.
                  </p>

                  {/* Ficha Comprobante */}
                  <div
                    style={{
                      background: "#F8FAFC",
                      border: "1px dashed #CBD5E1",
                      borderRadius: "12px",
                      padding: "16px",
                      marginBottom: "24px",
                      textAlign: "left",
                      fontSize: "0.85rem",
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748B" }}>Código de Autorización:</span>
                      <span style={{ fontWeight: 800, color: "#0F172A" }}>{resultadoPago.autorizacionCodigo}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748B" }}>ID Transacción:</span>
                      <span style={{ fontFamily: "monospace", color: "#334155" }}>{resultadoPago.clientTransactionId}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748B" }}>Medio de Pago:</span>
                      <span>{resultadoPago.marcaTarjeta || "Tarjeta"} •••• {resultadoPago.ultimosDigitos || "4242"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px" }}>
                      <span style={{ color: "#64748B" }}>Titular / Cédula:</span>
                      <span>{nombres} {apellidos} ({identificacion})</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", paddingTop: "8px", borderTop: "1px solid #E2E8F0" }}>
                      <span style={{ fontWeight: 700, color: "#0F172A" }}>Monto Total Liquidado:</span>
                      <span style={{ fontWeight: 800, color: "#059669", fontSize: "1.05rem" }}>
                        ${variante.precio_total.toFixed(2)} USD
                      </span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={reiniciarYCerrar}
                    style={{
                      background: "#0284C7",
                      color: "#FFFFFF",
                      border: "none",
                      padding: "10px 24px",
                      borderRadius: "8px",
                      fontSize: "0.9rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "6px",
                    }}
                  >
                    <FileText size={16} />
                    Finalizar y Ver Ficha
                  </button>
                </>
              ) : (
                <>
                  <div
                    style={{
                      width: "60px",
                      height: "60px",
                      borderRadius: "50%",
                      background: "#FEE2E2",
                      color: "#DC2626",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 16px",
                    }}
                  >
                    <XCircle size={36} />
                  </div>

                  <h3 style={{ margin: "0 0 6px", fontSize: "1.25rem", color: "#991B1B", fontWeight: 800 }}>
                    Transacción Declinada
                  </h3>
                  <p style={{ margin: "0 0 20px", fontSize: "0.85rem", color: "#64748B" }}>
                    {resultadoPago.mensaje || "La pasarela de pago o el banco declinaron la operación."}
                  </p>

                  <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
                    <button
                      type="button"
                      onClick={() => setPaso("formulario")}
                      style={{
                        background: "#0284C7",
                        color: "#FFFFFF",
                        border: "none",
                        padding: "10px 20px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Intentar Nuevamente
                    </button>
                    <button
                      type="button"
                      onClick={reiniciarYCerrar}
                      style={{
                        background: "#F1F5F9",
                        color: "#475569",
                        border: "none",
                        padding: "10px 16px",
                        borderRadius: "8px",
                        fontSize: "0.85rem",
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      Cerrar
                    </button>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
