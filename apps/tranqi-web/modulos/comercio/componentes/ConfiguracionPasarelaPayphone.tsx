"use client";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Key,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Sparkles,
  Save,
  Lock,
} from "lucide-react";
import {
  obtenerConfiguracionPasarelaAction,
  guardarConfiguracionPasarelaAction,
} from "../acciones";

interface Props {
  negocio?: string;
}

export function ConfiguracionPasarelaPayphone({ negocio = "tranqi" }: Props) {
  const [cargando, setCargando] = useState(true);
  const [guardando, setGuardando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Campos editables
  const [storeId, setStoreId] = useState("");
  const [token, setToken] = useState("");
  const [ambiente, setAmbiente] = useState<"PRUEBAS" | "PRODUCCION">("PRUEBAS");
  const [modoSimulado, setModoSimulado] = useState(true);
  const [activo, setActivo] = useState(true);

  const cargarConfig = async () => {
    setCargando(true);
    try {
      const c = await obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE");
      setStoreId(c.storeId);
      setToken(c.token || "");
      setAmbiente(c.psc_ambiente);
      setModoSimulado(c.modoSimulado);
      setActivo(c.psc_activo);
    } catch (err) {
      setErrorMsg((err instanceof Error ? err.message : String(err)) || "Error al cargar configuración de Payphone.");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargarConfig();
  }, [negocio]);

  const manejarGuardar = async (e: React.FormEvent) => {
    e.preventDefault();
    setGuardando(true);
    setErrorMsg(null);
    setMensajeExito(null);

    try {
      const res = await guardarConfiguracionPasarelaAction({
        negocio,
        storeId,
        token,
        ambiente,
        modoSimulado,
        activo,
      });

      if (!res.ok) {
        setErrorMsg(res.error || "No se pudo actualizar la configuración.");
      } else {
        setMensajeExito("¡Parámetros de Payphone guardados exitosamente!");
        setTimeout(() => setMensajeExito(null), 4000);
      }
    } catch (err) {
      setErrorMsg((err instanceof Error ? err.message : String(err)) || "Error al guardar parámetros.");
    } finally {
      setGuardando(false);
    }
  };

  if (cargando) {
    return (
      <div style={{ padding: "60px 20px", textAlign: "center", color: "var(--texto-suave)" }}>
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
                background: "var(--aviso-diluido)",
                color: "var(--aviso-texto)",
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
                background: activo ? "var(--exito-diluido)" : "var(--error-diluido)",
                color: activo ? "var(--exito-texto)" : "var(--error-texto)",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {activo ? "● HABILITADA" : "○ INACTIVA"}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "1.45rem", fontWeight: 800, color: "var(--texto)" }}>
            Configuración de Pasarela Payphone
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "var(--texto-suave)" }}>
            Administra las credenciales API, StoreID, entorno y el simulador de cobro de honorarios.
          </p>
        </div>

        <a
          href="https://docs.payphone.app/boton-de-pago"
          target="_blank"
          rel="noreferrer"
          style={{
            background: "var(--fondo-suave)",
            color: "var(--acento)",
            border: "1px solid var(--acento-linea)",
            padding: "8px 14px",
            borderRadius: "8px",
            fontSize: "0.8rem",
            fontWeight: 600,
            textDecoration: "none",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
          }}
        >
          <ExternalLink size={14} />
          Documentación Payphone
        </a>
      </div>

      {/* Alertas */}
      {mensajeExito && (
        <div
          style={{
            background: "var(--exito-diluido)",
            border: "1px solid var(--exito-linea)",
            color: "var(--exito-texto)",
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
            background: "var(--error-diluido)",
            border: "1px solid var(--error-linea)",
            color: "var(--error-texto)",
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
          border: "1px solid var(--linea)",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <form onSubmit={manejarGuardar}>
          {/* Banner de Modo Simulado */}
          <div
            style={{
              background: modoSimulado ? "var(--aviso-diluido)" : "var(--fondo-hundido)",
              border: modoSimulado ? "1.5px solid var(--aviso-linea)" : "1px solid var(--linea)",
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
                  background: modoSimulado ? "var(--aviso)" : "var(--texto-suave)",
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
                <div style={{ fontSize: "0.95rem", fontWeight: 700, color: modoSimulado ? "var(--aviso-texto)" : "var(--texto)" }}>
                  Modo de Respuesta Simulada (Sandbox de Pruebas)
                </div>
                <div style={{ fontSize: "0.8rem", color: modoSimulado ? "var(--aviso-texto)" : "var(--texto-suave)", marginTop: "2px" }}>
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
              <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--texto)" }}>
                {modoSimulado ? "Activo" : "Inactivo"}
              </span>
            </label>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
            {/* Store ID */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--texto-2)", marginBottom: "6px" }}>
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
                  border: "1px solid var(--linea-fuerte)",
                  boxSizing: "border-box",
                }}
              />
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                Identificador de la sucursal proporcionado en Payphone Developer.
              </p>
            </div>

            {/* Ambiente */}
            <div>
              <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "var(--texto-2)", marginBottom: "6px" }}>
                Ambiente de Ejecución
              </label>
              <select
                value={ambiente}
                onChange={(e) => setAmbiente(e.target.value as "PRUEBAS" | "PRODUCCION")}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "0.9rem",
                  borderRadius: "8px",
                  border: "1px solid var(--linea-fuerte)",
                  background: "#FFFFFF",
                  boxSizing: "border-box",
                }}
              >
                <option value="PRUEBAS">Pruebas / Staging</option>
                <option value="PRODUCCION">Producción en Vivo</option>
              </select>
              <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                Define la URL base de validación bancaria.
              </p>
            </div>
          </div>

          {/* Token Bearer (Privado) */}
          <div style={{ marginBottom: "24px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
              <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--texto-2)" }}>
                Token de Autenticación de Aplicación (Bearer Token)
              </label>
              <span style={{ fontSize: "0.7rem", color: "var(--acento)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <Lock size={12} />
                Almacenamiento Cifrado en Servidor (Nunca expuesto al cliente)
              </span>
            </div>
            <div style={{ position: "relative" }}>
              <Key size={16} color="var(--texto-tenue)" style={{ position: "absolute", left: "12px", top: "12px" }} />
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
                  border: "1px solid var(--linea-fuerte)",
                  boxSizing: "border-box",
                  fontFamily: "monospace",
                }}
              />
            </div>
          </div>

          {/* Switch de Disponibilidad en Checkout */}
          <div
            style={{
              padding: "16px",
              background: "var(--fondo-suave)",
              borderRadius: "10px",
              border: "1px solid var(--linea)",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "var(--texto)" }}>
                Habilitar Botón de Pago en la Tienda / Checkout
              </div>
              <div style={{ fontSize: "0.75rem", color: "var(--texto-suave)" }}>
                Si está desactivado, Payphone no aparecerá como opción de pago ante los clientes.
              </div>
            </div>

            <label style={{ display: "flex", alignItems: "center", cursor: "pointer", gap: "8px" }}>
              <input
                type="checkbox"
                checked={activo}
                onChange={(e) => setActivo(e.target.checked)}
                style={{ width: "20px", height: "20px", cursor: "pointer" }}
              />
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: activo ? "var(--exito)" : "var(--texto-suave)" }}>
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
                background: "var(--acento)",
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
