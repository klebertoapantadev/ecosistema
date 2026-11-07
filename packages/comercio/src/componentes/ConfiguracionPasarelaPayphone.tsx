"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Key,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Info,
  Save,
  Lock,
} from "lucide-react";
import {
  ConfiguracionPasarela,
  obtenerConfiguracionPasarelaAction,
  guardarConfiguracionPasarelaAction,
  guardarConfiguracionPluxAction,
} from "../acciones";

interface Props {
  negocio?: string;
}

export function ConfiguracionPasarelaPayphone({ negocio = "tranqi" }: Props) {
  const [pasarelaSeleccionada, setPasarelaSeleccionada] = useState<"PLUX" | "PAYPHONE">(
    negocio.toLowerCase().includes("tranq") ? "PLUX" : "PAYPHONE"
  );
  const [config, setConfig] = useState<ConfiguracionPasarela | null>(null);
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos editables Payphone
  const [storeId, setStoreId] = useState("");
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<"PRUEBAS" | "PRODUCCION">("PRUEBAS");
  const [modoSimulado, setModoSimulado] = useState(true);
  const [activo, setActivo] = useState(true);

  // Campos editables PLUX
  const [remail, setRemail] = useState("admin.operaciones@tranqi24.com");
  const [nombreComercio, setNombreComercio] = useState("Tranqi");
  const [clienteIdPlux, setClienteIdPlux] = useState("");
  const [claveSecretaPlux, setClaveSecretaPlux] = useState("");
  const [visibilidadPlux, setVisibilidadPlux] = useState<"TODOS" | "PROBADORES">("TODOS");
  const [probadoresTexto, setProbadoresTexto] = useState("");

  const cargarConfig = async (pasarelaObjetivo?: "PLUX" | "PAYPHONE") => {
    setCargando(true);
    try {
      const [cPlux, cPayphone] = await Promise.all([
        obtenerConfiguracionPasarelaAction(negocio, "PLUX"),
        obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE"),
      ]);

      const activa =
        pasarelaObjetivo ||
        (cPlux.psc_activo ? "PLUX" : cPayphone.psc_activo ? "PAYPHONE" : negocio.toLowerCase().includes("tranq") ? "PLUX" : "PAYPHONE");

      setPasarelaSeleccionada(activa);
      const c = activa === "PLUX" ? cPlux : cPayphone;
      setConfig(c);
      setAmbiente(c.psc_ambiente);
      setActivo(c.psc_activo);

      setStoreId(cPayphone.storeId);
      setToken(cPayphone.token || "");
      setModoSimulado(cPayphone.modoSimulado);

      setRemail(cPlux.remail || "admin.operaciones@tranqi24.com");
      setNombreComercio(cPlux.nombreComercio || "Tranqi");
      setVisibilidadPlux(cPlux.visibilidad || "TODOS");
      setProbadoresTexto((cPlux.probadores || []).join(", "));
    } catch (err: any) {
      setErrorMsg(err.message || "Error al cargar configuración de pasarela.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfig();
  }, [negocio]);

  const cambiarProcesador = async (nueva: "PLUX" | "PAYPHONE") => {
    setPasarelaSeleccionada(nueva);
    await cargarConfig(nueva);
  };

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg(null);
    setMensajeExito(null);

    try {
      if (pasarelaSeleccionada === "PLUX") {
        const res = await guardarConfiguracionPluxAction({
          negocio,
          remail,
          nombreComercio,
          clienteId: clienteIdPlux || undefined,
          claveSecreta: claveSecretaPlux || undefined,
          ambiente,
          visibilidad: visibilidadPlux,
          probadores: probadoresTexto
            .split(",")
            .map((s) => s.trim())
            .filter(Boolean),
          activo,
        });

        if (!res.ok) {
          setErrorMsg(res.error || "No se pudo actualizar la configuración de PLUX.");
        } else {
          setClienteIdPlux("");
          setClaveSecretaPlux("");
          setMensajeExito("¡Procesador PLUX guardado y activado como pasarela del negocio!");
          setTimeout(() => setMensajeExito(null), 4000);
        }
      } else {
        const res = await guardarConfiguracionPasarelaAction({
          negocio,
          storeId,
          token,
          ambiente,
          modoSimulado,
          activo,
        });

        if (!res.ok) {
          setErrorMsg(res.error || "No se pudo actualizar la configuración de Payphone.");
        } else {
          setMensajeExito("¡Procesador Payphone guardado y activado como pasarela del negocio!");
          setTimeout(() => setMensajeExito(null), 4000);
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message || "Error al guardar parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#64748B" }}>
        <RefreshCw size={28} className="animate-spin" style={{ margin: "0 auto 12px" }} />
        <div>Cargando parámetros de pasarela Payphone...</div>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "16px 0" }}>
      {/* Encabezado */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          marginBottom: "24px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <span
              style={{
                background: "#FEF3C7",
                color: "#92400E",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
                display: "inline-flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <CreditCard size={12} />
              Pasarela de Pago Oficial
            </span>
            <span
              style={{
                background: activo ? "#D1FAE5" : "#FEE2E2",
                color: activo ? "#065F46" : "#991B1B",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {activo ? "● HABILITADA" : "○ INACTIVA"}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "#0F172A" }}>
            Configuración de Pasarela de Pago ({pasarelaSeleccionada})
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#64748B" }}>
            Selecciona qué procesador de tarjeta usar en el checkout (PLUX o Payphone) y administra sus credenciales.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => cambiarProcesador("PLUX")}
            style={{
              background: pasarelaSeleccionada === "PLUX" ? "#0284C7" : "#F8FAFC",
              color: pasarelaSeleccionada === "PLUX" ? "#FFFFFF" : "#334155",
              border: pasarelaSeleccionada === "PLUX" ? "1px solid #0284C7" : "1px solid #CBD5E1",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Procesador PLUX
          </button>
          <button
            type="button"
            onClick={() => cambiarProcesador("PAYPHONE")}
            style={{
              background: pasarelaSeleccionada === "PAYPHONE" ? "#0284C7" : "#F8FAFC",
              color: pasarelaSeleccionada === "PAYPHONE" ? "#FFFFFF" : "#334155",
              border: pasarelaSeleccionada === "PAYPHONE" ? "1px solid #0284C7" : "1px solid #CBD5E1",
              padding: "8px 14px",
              borderRadius: "8px",
              fontSize: "0.82rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            Procesador Payphone
          </button>
        </div>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div
          style={{
            background: "#ECFDF5",
            border: "1px solid #A7F3D0",
            color: "#065F46",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.85rem",
          }}
        >
          <CheckCircle2 size={18} />
          <div>{mensajeExito}</div>
        </div>
      )}

      {errorMsg && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #FECACA",
            color: "#991B1B",
            padding: "12px 16px",
            borderRadius: "10px",
            marginBottom: "20px",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.85rem",
          }}
        >
          <AlertCircle size={18} />
          <div>{errorMsg}</div>
        </div>
      )}

      {/* Tarjeta de Formulario */}
      <div
        style={{
          background: "#FFFFFF",
          border: "1px solid #E2E8F0",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <form onSubmit={manejarGuardar}>
          {pasarelaSeleccionada === "PLUX" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Correo del Comercio en PLUX (PayboxRemail) *
                  </label>
                  <input
                    type="email"
                    required
                    placeholder="admin.operaciones@tranqi24.com"
                    value={remail}
                    onChange={(e) => setRemail(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Nombre Comercial (PayboxSendname) *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Tranqi"
                    value={nombreComercio}
                    onChange={(e) => setNombreComercio(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Ambiente de Ejecución
                  </label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="PRUEBAS">Pruebas / Sandbox (Tarjetas de prueba)</option>
                    <option value="PRODUCCION">Producción en Vivo (Cobro real)</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Visibilidad en Checkout
                  </label>
                  <select
                    value={visibilidadPlux}
                    onChange={(e) => setVisibilidadPlux(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="TODOS">Visible para todos los usuarios</option>
                    <option value="PROBADORES">Solo superadmins y correos de probadores</option>
                  </select>
                </div>
              </div>

              {visibilidadPlux === "PROBADORES" && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Correos de Probadores Autorizados (separados por coma)
                  </label>
                  <input
                    type="text"
                    placeholder="correo1@ejemplo.com, correo2@ejemplo.com"
                    value={probadoresTexto}
                    onChange={(e) => setProbadoresTexto(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    PLUX Id Cliente (Webhook API, opcional si ya está guardado)
                  </label>
                  <input
                    type="text"
                    placeholder="Dejar en blanco para conservar el actual"
                    value={clienteIdPlux}
                    onChange={(e) => setClienteIdPlux(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    PLUX Clave Secreta (Webhook API, opcional si ya está guardada)
                  </label>
                  <input
                    type="password"
                    placeholder="Dejar en blanco para conservar la actual"
                    value={claveSecretaPlux}
                    onChange={(e) => setClaveSecretaPlux(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            </>
          ) : (
            <>
              {/* Banner de Modo Simulado */}
              <div
                style={{
                  background: modoSimulado ? "#FEF3C7" : "#F1F5F9",
                  border: modoSimulado ? "1.5px solid #FCD34D" : "1px solid #E2E8F0",
                  borderRadius: "12px",
                  padding: "16px",
                  marginBottom: "24px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: "16px",
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: modoSimulado ? "#D97706" : "#64748B",
                      color: "#FFFFFF",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <Sparkles size={20} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: modoSimulado ? "#92400E" : "#1E293B" }}>
                      Modo de Respuesta Simulada (Sandbox de Pruebas)
                    </div>
                    <div style={{ fontSize: "0.8rem", color: modoSimulado ? "#B45309" : "#64748B", marginTop: "2px" }}>
                      Al estar activado, el checkout simula el pago de honorarios y genera códigos de autorización bancarios sin debitar tarjetas reales.
                    </div>
                  </div>
                </div>

                <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}>
                  <input
                    type="checkbox"
                    checked={modoSimulado}
                    onChange={(e) => setModoSimulado(e.target.checked)}
                    style={{ width: "20px", height: "20px", cursor: "pointer" }}
                  />
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                    {modoSimulado ? "Activo" : "Inactivo"}
                  </span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
                {/* Store ID */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Payphone Store ID *
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="Ej. STORE-DEMO-TRANQI-001"
                    value={storeId}
                    onChange={(e) => setStoreId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                    Identificador de la sucursal proporcionado en Payphone Developer.
                  </p>
                </div>

                {/* Ambiente */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Ambiente de Ejecución
                  </label>
                  <select
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="PRUEBAS">Pruebas / Staging</option>
                    <option value="PRODUCCION">Producción en Vivo</option>
                  </select>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#64748B" }}>
                    Define la URL base de validación bancaria.
                  </p>
                </div>
              </div>

              {/* Token Bearer (Privado) */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#334155" }}>
                    Token de Autenticación de Aplicación (Bearer Token)
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "#0284C7", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <Lock size={12} />
                    Almacenamiento Cifrado en Servidor (Nunca expuesto al cliente)
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <Key size={16} color="#94A3B8" style={{ position: "absolute", left: "12px", top: "12px" }} />
                  <input
                    type="password"
                    placeholder={modoSimulado ? "No requerido en modo simulado (dejar en blanco para pruebas)" : "Pega tu Bearer Token de Payphone aquí"}
                    value={token}
                    onChange={(e) => setToken(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 38px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #CBD5E1",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>
            </>
          )}

          {/* Switch de Disponibilidad en Checkout */}
          <div
            style={{
              padding: "16px",
              background: "#F8FAFC",
              borderRadius: "10px",
              border: "1px solid #E2E8F0",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#1E293B" }}>
                Usar {pasarelaSeleccionada} como Procesador Activo en el Checkout
              </div>
              <div style={{ fontSize: "0.75rem", color: "#64748B" }}>
                Al guardar como habilitado, {pasarelaSeleccionada} será el único procesador mostrado en el checkout del negocio.
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}>
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: activo ? "#059669" : "#64748B" }}>
                {activo ? "Habilitado" : "Deshabilitado"}
              </span>
            </label>
          </div>

          {/* Botones de Acción */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "12px" }}>
            <button
              type="submit"
              disabled={guardando}
              style={{
                background: "#0284C7",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 24px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: guardando ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {guardando ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              Guardar Configuración
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
