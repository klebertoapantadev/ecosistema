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

  // Estado del simulador de tarjeta interactivo
  const [tarjetaNumero, setTarjetaNumero] = useState("4500 8912 3456 7890");
  const [tarjetaTitular, setTarjetaTitular] = useState("");
  const [tarjetaExp, setTarjetaExp] = useState("08/29");
  const [tarjetaCvv, setTarjetaCvv] = useState("456");
  const [tarjetaMarca, setTarjetaMarca] = useState("Visa");
  const [enDesafioOTP, setEnDesafioOTP] = useState(false);
  const [codigoOTP, setCodigoOTP] = useState("");

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

  // Detectar marca según primeros dígitos
  const detectarMarca = (num: string) => {
    const limpio = num.replace(/\s+/g, "");
    if (limpio.startsWith("4")) return "Visa";
    if (/^5[1-5]/.test(limpio) || /^2[2-7]/.test(limpio)) return "Mastercard";
    if (/^3[47]/.test(limpio)) return "American Express";
    if (/^3(?:0[0-5]|[68])/.test(limpio)) return "Diners Club";
    return "Visa";
  };

  const aplicarPresetTarjeta = (preset: {
    numero: string;
    exp: string;
    cvv: string;
    marca: string;
    otp?: boolean;
  }) => {
    setTarjetaNumero(preset.numero);
    setTarjetaExp(preset.exp);
    setTarjetaCvv(preset.cvv);
    setTarjetaMarca(preset.marca);
    if (!tarjetaTitular) {
      setTarjetaTitular(`${nombres.trim() || "MARTIN"} ${apellidos.trim() || "TOAPANTA"}`.toUpperCase());
    }
  };

  // 1. Manejar envío para preparar transacción
  const manejarPrepararPago = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!identificacion.trim() || !email.trim() || !nombres.trim() || !telefono.trim()) {
      setErrorMsg("Por favor completa todos los campos de facturación obligatorios.");
      return;
    }

    setTarjetaTitular(`${nombres.trim()} ${apellidos.trim() || "CLIENTE"}`.toUpperCase());
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

  // 2. Manejar simulación interactiva completa de tarjeta
  const manejarProcesarSimulacionTarjeta = async (resultadoForzado?: "APROBADO" | "RECHAZADO") => {
    if (!prepData) return;

    if (!tarjetaNumero || tarjetaNumero.replace(/\s+/g, "").length < 14) {
      setErrorMsg("Ingresa un número de tarjeta válido (16 dígitos).");
      return;
    }
    if (!tarjetaExp || !tarjetaExp.includes("/")) {
      setErrorMsg("Ingresa la fecha de expiración en formato MM/AA.");
      return;
    }
    if (!tarjetaCvv || tarjetaCvv.length < 3) {
      setErrorMsg("Ingresa el código de seguridad CVV (3-4 dígitos).");
      return;
    }

    setProcesando(true);
    setErrorMsg(null);

    const ultimos4 = tarjetaNumero.replace(/\s+/g, "").slice(-4);
    const resultado = resultadoForzado || (tarjetaNumero.includes("3612") ? "RECHAZADO" : "APROBADO");

    try {
      const res = await confirmarPagoPayphoneAction({
        negocio,
        id: prepData.paymentId,
        clientTxId: prepData.clientTransactionId,
        esSimulado: true,
        resultadoSimulacion: resultado,
        marcaTarjetaSimulada: tarjetaMarca,
        ultimosDigitos: ultimos4,
        titularNombre: tarjetaTitular || `${nombres} ${apellidos}`,
        varianteId: variante.var_id,
        productoNombre,
        clienteEmail: email,
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

          {/* PASO 2: SIMULADOR INTERACTIVO DE TARJETA BANCARIA */}
          {paso === "simulando" && prepData && (
            <div style={{ padding: "8px 0" }}>
              {/* TARJETA VISUAL DINÁMICA */}
              <div
                style={{
                  background:
                    tarjetaMarca === "Mastercard"
                      ? "linear-gradient(135deg, #1E293B 0%, #0F172A 100%)"
                      : tarjetaMarca === "Diners Club"
                      ? "linear-gradient(135deg, #0284C7 0%, #0369A1 100%)"
                      : tarjetaMarca === "American Express"
                      ? "linear-gradient(135deg, #047857 0%, #065F46 100%)"
                      : "linear-gradient(135deg, #312E81 0%, #4338CA 50%, #6366F1 100%)",
                  borderRadius: "20px",
                  padding: "24px",
                  color: "#FFFFFF",
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: "0 12px 28px -6px rgba(0, 0, 0, 0.35)",
                  marginBottom: "20px",
                  border: "1px solid rgba(255, 255, 255, 0.18)",
                }}
              >
                {/* Micro-chip y Logo */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "24px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <div
                      style={{
                        width: "42px",
                        height: "30px",
                        background: "linear-gradient(135deg, #FDE047 0%, #CA8A04 100%)",
                        borderRadius: "6px",
                        border: "1px solid #EAB308",
                        position: "relative",
                        overflow: "hidden",
                      }}
                    >
                      <div style={{ position: "absolute", inset: "3px", border: "1px solid rgba(0,0,0,0.15)", borderRadius: "3px" }} />
                    </div>
                    <span style={{ fontSize: "0.75rem", letterSpacing: "1px", opacity: 0.8, fontWeight: 700 }}>
                      BANCO EMISOR EC
                    </span>
                  </div>

                  <span
                    style={{
                      fontSize: "1.1rem",
                      fontWeight: 900,
                      letterSpacing: "1px",
                      textTransform: "uppercase",
                      background: "rgba(255, 255, 255, 0.15)",
                      padding: "4px 12px",
                      borderRadius: "8px",
                      border: "1px solid rgba(255, 255, 255, 0.2)",
                    }}
                  >
                    {tarjetaMarca}
                  </span>
                </div>

                {/* Número de Tarjeta */}
                <div
                  style={{
                    fontFamily: "monospace",
                    fontSize: "1.3rem",
                    letterSpacing: "3px",
                    fontWeight: 700,
                    marginBottom: "20px",
                    textShadow: "0 2px 4px rgba(0,0,0,0.4)",
                  }}
                >
                  {tarjetaNumero || "•••• •••• •••• ••••"}
                </div>

                {/* Titular y Expiración */}
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
                  <div>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", opacity: 0.7, letterSpacing: "1px" }}>
                      Titular de la Tarjeta
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, letterSpacing: "1px", textTransform: "uppercase" }}>
                      {tarjetaTitular || `${nombres} ${apellidos}`.toUpperCase() || "TITULAR AUTORIZADO"}
                    </div>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "0.65rem", textTransform: "uppercase", opacity: 0.7, letterSpacing: "1px" }}>
                      Vence
                    </div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, fontFamily: "monospace" }}>
                      {tarjetaExp || "MM/AA"}
                    </div>
                  </div>
                </div>
              </div>

              {/* PRESETS RÁPIDOS DE PRUEBA */}
              <div style={{ marginBottom: "18px" }}>
                <div style={{ fontSize: "0.78rem", fontWeight: 700, color: "#475569", marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Sparkles size={14} color="#D97706" /> Presets de Prueba Rápida (1 Clic):
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() =>
                      aplicarPresetTarjeta({
                        numero: "4500 8912 3456 7890",
                        exp: "08/29",
                        cvv: "456",
                        marca: "Visa",
                      })
                    }
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      color: "#166534",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🟢 Visa Pichincha (Aprobada)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      aplicarPresetTarjeta({
                        numero: "5412 7534 8901 2345",
                        exp: "11/28",
                        cvv: "123",
                        marca: "Mastercard",
                      })
                    }
                    style={{
                      background: "#F0FDF4",
                      border: "1px solid #86EFAC",
                      color: "#166534",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🟢 Mastercard Guayaquil (Aprobada)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      aplicarPresetTarjeta({
                        numero: "3612 3456 7890 12",
                        exp: "04/27",
                        cvv: "890",
                        marca: "Diners Club",
                      })
                    }
                    style={{
                      background: "#FEF2F2",
                      border: "1px solid #FECACA",
                      color: "#991B1B",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🔴 Diners (Sin Fondos / Rechazo)
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      aplicarPresetTarjeta({
                        numero: "4111 2222 3333 4444",
                        exp: "12/30",
                        cvv: "777",
                        marca: "Visa",
                      })
                    }
                    style={{
                      background: "#EFF6FF",
                      border: "1px solid #BFDBFE",
                      color: "#1E40AF",
                      borderRadius: "8px",
                      padding: "8px",
                      fontSize: "0.75rem",
                      fontWeight: 700,
                      cursor: "pointer",
                      textAlign: "left",
                    }}
                  >
                    🟡 Produbanco (Aprobación Rápida)
                  </button>
                </div>
              </div>

              {/* INPUTS DE TARJETA INTERACTIVOS */}
              <div
                style={{
                  background: "#F8FAFC",
                  border: "1px solid #E2E8F0",
                  borderRadius: "14px",
                  padding: "16px",
                  marginBottom: "20px",
                  textAlign: "left",
                }}
              >
                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Número de Tarjeta (16 Dígitos)
                  </label>
                  <input
                    type="text"
                    value={tarjetaNumero}
                    onChange={(e) => {
                      const val = e.target.value.replace(/\D/g, "").slice(0, 16);
                      const fmt = val.match(/.{1,4}/g)?.join(" ") || val;
                      setTarjetaNumero(fmt);
                      setTarjetaMarca(detectarMarca(val));
                    }}
                    placeholder="4500 0000 0000 0000"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.95rem",
                      fontFamily: "monospace",
                      fontWeight: 700,
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ marginBottom: "12px" }}>
                  <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                    Nombre del Titular (en la Tarjeta)
                  </label>
                  <input
                    type="text"
                    value={tarjetaTitular}
                    onChange={(e) => setTarjetaTitular(e.target.value.toUpperCase())}
                    placeholder="NOMBRE APELLIDO"
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      fontSize: "0.88rem",
                      fontWeight: 700,
                      textTransform: "uppercase",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Vencimiento (MM/AA)
                    </label>
                    <input
                      type="text"
                      value={tarjetaExp}
                      onChange={(e) => {
                        let val = e.target.value.replace(/\D/g, "").slice(0, 4);
                        if (val.length >= 3) {
                          val = `${val.slice(0, 2)}/${val.slice(2)}`;
                        }
                        setTarjetaExp(val);
                      }}
                      placeholder="MM/AA"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.9rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: "block", fontSize: "0.78rem", fontWeight: 700, color: "#334155", marginBottom: "4px" }}>
                      Código de Seguridad (CVV)
                    </label>
                    <input
                      type="password"
                      maxLength={4}
                      value={tarjetaCvv}
                      onChange={(e) => setTarjetaCvv(e.target.value.replace(/\D/g, "").slice(0, 4))}
                      placeholder="•••"
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "8px",
                        border: "1px solid #CBD5E1",
                        fontSize: "0.9rem",
                        fontFamily: "monospace",
                        fontWeight: 700,
                        boxSizing: "border-box",
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* BOTONES DE ACCIÓN DE SIMULACIÓN */}
              <div style={{ display: "flex", gap: "12px", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => manejarProcesarSimulacionTarjeta("RECHAZADO")}
                  style={{
                    background: "#FEE2E2",
                    color: "#991B1B",
                    border: "1px solid #FCA5A5",
                    padding: "10px 16px",
                    borderRadius: "8px",
                    fontSize: "0.85rem",
                    fontWeight: 700,
                    cursor: procesando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                  }}
                >
                  <XCircle size={16} /> Simular Rechazo
                </button>

                <button
                  type="button"
                  disabled={procesando}
                  onClick={() => manejarProcesarSimulacionTarjeta("APROBADO")}
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#FFFFFF",
                    border: "none",
                    padding: "11px 24px",
                    borderRadius: "8px",
                    fontSize: "0.9rem",
                    fontWeight: 800,
                    cursor: procesando ? "not-allowed" : "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    boxShadow: "0 4px 14px rgba(5, 150, 105, 0.35)",
                  }}
                >
                  {procesando ? <RefreshCw size={16} className="animate-spin" /> : <Lock size={16} />}
                  Pagar ${variante.precio_total.toFixed(2)} USD (Simulación)
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
