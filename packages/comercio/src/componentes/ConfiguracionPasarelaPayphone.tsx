"use client";
import { SelectConBuscador } from "@eco/datagrid";

import React, { useEffect, useState } from "react";
import {
  CreditCard,
  Key,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Sparkles,
  Save,
  Lock,
  Building2,
  Plus,
  Trash2,
} from "lucide-react";
import {
  ConfiguracionPasarela,
  obtenerConfiguracionPasarelaAction,
  guardarConfiguracionPasarelaAction,
  guardarConfiguracionPluxAction,
} from "../acciones";
import {
  crearConfiguracionTiendaCheckoutPorDefecto,
  type ConfiguracionTiendaCheckout,
  type CuentaBancariaTransferencia,
} from "../configuracion-tienda-checkout";
import {
  guardarConfiguracionTiendaCheckoutAction,
  obtenerConfiguracionTiendaCheckoutAction,
  subirComprobanteTransferenciaAction,
} from "../acciones-tienda-checkout";

interface Props {
  negocio?: string;
}

function nombreComercioDefectoPorNegocio(negocio: string): string {
  const n = negocio.toLowerCase();
  if (n.includes("tinkay")) return "Tinkay Floristería";
  if (n.includes("margarita")) return "Margaritas Floristería";
  if (n.includes("fastfix")) return "FastFix Home";
  return "Tranqi";
}

export function ConfiguracionPasarelaPayphone({ negocio = "tranqi" }: Props) {
  const negLower = negocio.toLowerCase();
  const prefierePluxPorDefecto = negLower.includes("tranq") || negLower.includes("tinkay");
  const nombreDefecto = nombreComercioDefectoPorNegocio(negocio);

  const [pasarelaSeleccionada, setPasarelaSeleccionada] = useState<"PLUX" | "PAYPHONE">(
    prefierePluxPorDefecto ? "PLUX" : "PAYPHONE"
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
  const [nombreComercio, setNombreComercio] = useState(nombreDefecto);
  const [clienteIdPlux, setClienteIdPlux] = useState("");
  const [claveSecretaPlux, setClaveSecretaPlux] = useState("");
  const [visibilidadPlux, setVisibilidadPlux] = useState<"TODOS" | "PROBADORES">("TODOS");
  const [probadoresTexto, setProbadoresTexto] = useState("");

  // Parámetros configurables de Tienda, Compra Rápida (< $50), WhatsApp y Transferencia / QR DeUna
  const [configCheckout, setConfigCheckout] = useState<ConfiguracionTiendaCheckout>(() =>
    crearConfiguracionTiendaCheckoutPorDefecto(negocio)
  );
  const [guardandoCheckout, setGuardandoCheckout] = useState(false);
  const [subiendoQr, setSubiendoQr] = useState(false);

  const cargarConfig = async (pasarelaObjetivo?: "PLUX" | "PAYPHONE") => {
    setCargando(true);
    try {
      const [cPlux, cPayphone, cfgTienda] = await Promise.all([
        obtenerConfiguracionPasarelaAction(negocio, "PLUX"),
        obtenerConfiguracionPasarelaAction(negocio, "PAYPHONE"),
        obtenerConfiguracionTiendaCheckoutAction(negocio),
      ]);

      setConfigCheckout(cfgTienda);

      const activa =
        pasarelaObjetivo ||
        (cPlux.psc_activo ? "PLUX" : cPayphone.psc_activo ? "PAYPHONE" : prefierePluxPorDefecto ? "PLUX" : "PAYPHONE");

      setPasarelaSeleccionada(activa);
      const c = activa === "PLUX" ? cPlux : cPayphone;
      setConfig(c);
      setAmbiente(c.psc_ambiente);
      setActivo(c.psc_activo);

      setStoreId(cPayphone.storeId);
      setToken(cPayphone.token || "");
      setModoSimulado(cPayphone.modoSimulado);

      setRemail(cPlux.remail || "admin.operaciones@tranqi24.com");
      setNombreComercio(cPlux.nombreComercio || nombreDefecto);
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
      <div style={{ padding: "60px 20px", textAlign: "center", color: "#847D74" }}>
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
                background: "#FAF6EE",
                color: "#745622",
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
                background: activo ? "#EAF1EC" : "#F6E9E9",
                color: activo ? "#2B4A36" : "#8A2E2E",
                padding: "3px 10px",
                borderRadius: "12px",
                fontSize: "0.75rem",
                fontWeight: 700,
              }}
            >
              {activo ? "● HABILITADA" : "○ INACTIVA"}
            </span>
          </div>
          <h1 style={{ margin: 0, fontSize: "0.9rem", fontWeight: 800, color: "#1F1C19" }}>
            Configuración de Pasarela de Pago ({pasarelaSeleccionada})
          </h1>
          <p style={{ margin: "4px 0 0", fontSize: "0.85rem", color: "#847D74" }}>
            Selecciona qué procesador de tarjeta usar en el checkout (PLUX o Payphone) y administra sus credenciales.
          </p>
        </div>

        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <button
            type="button"
            onClick={() => cambiarProcesador("PLUX")}
            style={{
              background: pasarelaSeleccionada === "PLUX" ? "#221E1B" : "#F8F7F4",
              color: pasarelaSeleccionada === "PLUX" ? "#FFFFFF" : "#57524C",
              border: pasarelaSeleccionada === "PLUX" ? "1px solid #221E1B" : "1px solid #D5CFC4",
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
              background: pasarelaSeleccionada === "PAYPHONE" ? "#221E1B" : "#F8F7F4",
              color: pasarelaSeleccionada === "PAYPHONE" ? "#FFFFFF" : "#57524C",
              border: pasarelaSeleccionada === "PAYPHONE" ? "1px solid #221E1B" : "1px solid #D5CFC4",
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
            background: "#F2F6F3",
            border: "1px solid #CEDDD3",
            color: "#2B4A36",
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
            background: "#FAF2F2",
            border: "1px solid #E5CACA",
            color: "#8A2E2E",
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
          border: "1px solid #E6E2DA",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <form onSubmit={manejarGuardar}>
          {pasarelaSeleccionada === "PLUX" ? (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "20px", marginBottom: "20px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
                    Ambiente de Ejecución
                  </label>
                  <SelectConBuscador
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="PRUEBAS">Pruebas / Sandbox (Tarjetas de prueba)</option>
                    <option value="PRODUCCION">Producción en Vivo (Cobro real)</option>
                  </SelectConBuscador>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
                    Visibilidad en Checkout
                  </label>
                  <SelectConBuscador
                    value={visibilidadPlux}
                    onChange={(e) => setVisibilidadPlux(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="TODOS">Visible para todos los usuarios</option>
                    <option value="PROBADORES">Solo superadmins y correos de probadores</option>
                  </SelectConBuscador>
                </div>
              </div>

              {visibilidadPlux === "PROBADORES" && (
                <div style={{ marginBottom: "20px" }}>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "20px", marginBottom: "24px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                      fontFamily: "monospace",
                    }}
                  />
                </div>
              </div>

              <div
                style={{
                  marginBottom: "20px",
                  padding: "12px 14px",
                  borderRadius: "10px",
                  background: "#F8F7F4",
                  border: "1px solid #E6E2DA",
                  fontSize: "0.8rem",
                  color: "#57524C",
                }}
              >
                <strong>Webhook exclusivo de esta empresa ({negocio}):</strong>{" "}
                <code style={{ background: "#E6E2DA", padding: "2px 6px", borderRadius: "4px" }}>
                  {`/functions/v1/plux-webhook?negocio=${negocio.toLowerCase()}`}
                </code>{" "}
                — Las credenciales guardadas aquí se aíslan estrictamente por comercio sin afectar a las demás empresas del ecosistema.
              </div>
            </>
          ) : (
            <>
              {/* Banner de Modo Simulado */}
              <div
                style={{
                  background: modoSimulado ? "#FAF6EE" : "#F4F2EE",
                  border: modoSimulado ? "1.5px solid #E5D7BC" : "1px solid #E6E2DA",
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
                      background: modoSimulado ? "#8F6A2E" : "#847D74",
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
                    <div style={{ fontSize: "0.95rem", fontWeight: 700, color: modoSimulado ? "#745622" : "#221E1B" }}>
                      Modo de Respuesta Simulada (Sandbox de Pruebas)
                    </div>
                    <div style={{ fontSize: "0.8rem", color: modoSimulado ? "#745622" : "#847D74", marginTop: "2px" }}>
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
                  <span style={{ fontSize: "0.85rem", fontWeight: 700, color: "#221E1B" }}>
                    {modoSimulado ? "Activo" : "Inactivo"}
                  </span>
                </label>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(220px, 100%), 1fr))", gap: "20px", marginBottom: "20px" }}>
                {/* Store ID */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
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
                      border: "1px solid #D5CFC4",
                      boxSizing: "border-box",
                    }}
                  />
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#847D74" }}>
                    Identificador de la sucursal proporcionado en Payphone Developer.
                  </p>
                </div>

                {/* Ambiente */}
                <div>
                  <label style={{ display: "block", fontSize: "0.85rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
                    Ambiente de Ejecución
                  </label>
                  <SelectConBuscador
                    value={ambiente}
                    onChange={(e) => setAmbiente(e.target.value as any)}
                    style={{
                      width: "100%",
                      padding: "10px 14px",
                      fontSize: "0.9rem",
                      borderRadius: "8px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      boxSizing: "border-box",
                    }}
                  >
                    <option value="PRUEBAS">Pruebas / Staging</option>
                    <option value="PRODUCCION">Producción en Vivo</option>
                  </SelectConBuscador>
                  <p style={{ margin: "4px 0 0", fontSize: "0.75rem", color: "#847D74" }}>
                    Define la URL base de validación bancaria.
                  </p>
                </div>
              </div>

              {/* Token Bearer (Privado) */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                  <label style={{ fontSize: "0.85rem", fontWeight: 700, color: "#57524C" }}>
                    Token de Autenticación de Aplicación (Bearer Token)
                  </label>
                  <span style={{ fontSize: "0.7rem", color: "#221E1B", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                    <Lock size={12} />
                    Almacenamiento Cifrado en Servidor (Nunca expuesto al cliente)
                  </span>
                </div>
                <div style={{ position: "relative" }}>
                  <Key size={16} color="#847D74" style={{ position: "absolute", left: "12px", top: "12px" }} />
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
                      border: "1px solid #D5CFC4",
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
              background: "#F8F7F4",
              borderRadius: "10px",
              border: "1px solid #E6E2DA",
              marginBottom: "24px",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div>
              <div style={{ fontSize: "0.85rem", fontWeight: 700, color: "#221E1B" }}>
                Usar {pasarelaSeleccionada} como Procesador Activo en el Checkout
              </div>
              <div style={{ fontSize: "0.75rem", color: "#847D74" }}>
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
              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: activo ? "#2F4737" : "#847D74" }}>
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
                background: "#221E1B",
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

      {/* Tarjeta de Parámetros de Compra Rápida, WhatsApp Tienda y Transferencia Bancaria + QR DeUna */}
      <div
        style={{
          marginTop: "28px",
          background: "#FFFFFF",
          border: "1px solid #E6E2DA",
          borderRadius: "16px",
          padding: "24px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
          <Building2 size={20} color="#2F4737" />
          <h2 style={{ margin: 0, fontSize: "0.95rem", fontWeight: 800, color: "#1F1C19" }}>
            Compra Rápida, WhatsApp y Transferencia Bancaria / QR DeUna
          </h2>
        </div>
        <p style={{ margin: "0 0 20px", fontSize: "0.84rem", color: "#847D74" }}>
          Configura el monto límite sin datos de factura (Consumidor Final), el WhatsApp oficial de atención y las cuentas bancarias visibles en el checkout de <strong>{negocio}</strong>.
        </p>

        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setGuardandoCheckout(true);
            setErrorMsg(null);
            setMensajeExito(null);
            try {
              const res = await guardarConfiguracionTiendaCheckoutAction(negocio, configCheckout);
              if (!res.ok) {
                setErrorMsg(res.error);
              } else {
                setConfigCheckout(res.data);
                setMensajeExito("¡Parámetros de compra rápida, WhatsApp y transferencia actualizados!");
                setTimeout(() => setMensajeExito(null), 4000);
              }
            } finally {
              setGuardandoCheckout(false);
            }
          }}
        >
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
              gap: "16px",
              marginBottom: "20px",
            }}
          >
            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
                WhatsApp Oficial de la Tienda *
              </label>
              <input
                type="tel"
                required
                placeholder="+593 99 292 2343"
                value={configCheckout.whatsappTienda}
                onChange={(e) =>
                  setConfigCheckout((prev) => ({ ...prev, whatsappTienda: e.target.value }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "0.9rem",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ display: "block", marginTop: "4px", fontSize: "0.73rem", color: "#847D74" }}>
                Usado para recibir comprobantes de pago y consultas de proformas.
              </span>
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 700, color: "#57524C", marginBottom: "6px" }}>
                Monto Máximo sin Datos de Factura (USD) *
              </label>
              <input
                type="number"
                min={0}
                max={500}
                step="0.01"
                required
                value={configCheckout.montoMaximoPagoSinDatosUsd}
                onChange={(e) =>
                  setConfigCheckout((prev) => ({
                    ...prev,
                    montoMaximoPagoSinDatosUsd: Math.max(0, Number(e.target.value || 0)),
                  }))
                }
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  fontSize: "0.9rem",
                  borderRadius: "8px",
                  border: "1px solid #D5CFC4",
                  boxSizing: "border-box",
                }}
              />
              <span style={{ display: "block", marginTop: "4px", fontSize: "0.73rem", color: "#847D74" }}>
                Si la compra es menor a este monto (ej. $50.00), nombre y cédula son opcionales.
              </span>
            </div>
          </div>

          <div
            style={{
              padding: "16px",
              borderRadius: "12px",
              background: "#F8F7F4",
              border: "1px solid #E6E2DA",
              marginBottom: "20px",
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px", flexWrap: "wrap", gap: "8px" }}>
              <strong style={{ fontSize: "0.9rem", color: "#1F1C19" }}>
                Datos del Titular para Transferencia Bancaria
              </strong>
              <label style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "0.82rem", fontWeight: 700, cursor: "pointer" }}>
                <input
                  type="checkbox"
                  checked={configCheckout.transferencia.habilitada}
                  onChange={(e) =>
                    setConfigCheckout((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, habilitada: e.target.checked },
                    }))
                  }
                />
                <span>Habilitar pago por transferencia</span>
              </label>
            </div>

            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
                gap: "12px",
                marginBottom: "16px",
              }}
            >
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                  Nombre del Titular
                </label>
                <input
                  type="text"
                  value={configCheckout.transferencia.nombreTitular}
                  onChange={(e) =>
                    setConfigCheckout((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, nombreTitular: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 11px", borderRadius: "8px", border: "1px solid #D5CFC4", boxSizing: "border-box", fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                  Cédula / RUC Titular
                </label>
                <input
                  type="text"
                  value={configCheckout.transferencia.identificacionTitular}
                  onChange={(e) =>
                    setConfigCheckout((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, identificacionTitular: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 11px", borderRadius: "8px", border: "1px solid #D5CFC4", boxSizing: "border-box", fontSize: "0.85rem" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                  Correo Notificación Bancaria
                </label>
                <input
                  type="email"
                  value={configCheckout.transferencia.correoTitular}
                  onChange={(e) =>
                    setConfigCheckout((prev) => ({
                      ...prev,
                      transferencia: { ...prev.transferencia, correoTitular: e.target.value },
                    }))
                  }
                  style={{ width: "100%", padding: "8px 11px", borderRadius: "8px", border: "1px solid #D5CFC4", boxSizing: "border-box", fontSize: "0.85rem" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <strong style={{ fontSize: "0.82rem", color: "#57524C" }}>Cuentas Bancarias Activas</strong>
              <button
                type="button"
                title="Agregar nueva cuenta bancaria"
                aria-label="Agregar Cuenta"
                onClick={() =>
                  setConfigCheckout((prev) => ({
                    ...prev,
                    transferencia: {
                      ...prev.transferencia,
                      cuentas: [
                        ...prev.transferencia.cuentas,
                        { banco: "", tipoCuenta: "Ahorros", numeroCuenta: "" },
                      ],
                    },
                  }))
                }
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  padding: "5px 10px",
                  borderRadius: "7px",
                  border: "1px solid #D5CFC4",
                  background: "#FFFFFF",
                  color: "#1F1C19",
                  fontSize: "0.76rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                <Plus size={13} />
                <span>Agregar Cuenta</span>
              </button>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "16px" }}>
              {configCheckout.transferencia.cuentas.map((cta: CuentaBancariaTransferencia, idx: number) => (
                <div
                  key={`cta-${idx}`}
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "8px",
                    alignItems: "center",
                  }}
                >
                  <input
                    type="text"
                    placeholder="Banco (ej. Banco Pichincha)"
                    value={cta.banco}
                    onChange={(e) => {
                      const nuevas = [...configCheckout.transferencia.cuentas];
                      nuevas[idx] = { ...cta, banco: e.target.value };
                      setConfigCheckout((prev) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, cuentas: nuevas },
                      }));
                    }}
                    style={{ flex: "1 1 160px", minWidth: 0, padding: "8px 10px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.83rem" }}
                  />
                  <input
                    type="text"
                    placeholder="Ahorros / Corriente"
                    value={cta.tipoCuenta}
                    onChange={(e) => {
                      const nuevas = [...configCheckout.transferencia.cuentas];
                      nuevas[idx] = { ...cta, tipoCuenta: e.target.value };
                      setConfigCheckout((prev) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, cuentas: nuevas },
                      }));
                    }}
                    style={{ flex: "1 1 120px", minWidth: 0, padding: "8px 10px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.83rem" }}
                  />
                  <input
                    type="text"
                    placeholder="Número de cuenta"
                    value={cta.numeroCuenta}
                    onChange={(e) => {
                      const nuevas = [...configCheckout.transferencia.cuentas];
                      nuevas[idx] = { ...cta, numeroCuenta: e.target.value };
                      setConfigCheckout((prev) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, cuentas: nuevas },
                      }));
                    }}
                    style={{ flex: "1 1 160px", minWidth: 0, padding: "8px 10px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.83rem", fontFamily: "monospace" }}
                  />
                  <button
                    type="button"
                    title="Eliminar cuenta bancaria"
                    aria-label="Quitar cuenta"
                    onClick={() => {
                      const nuevas = configCheckout.transferencia.cuentas.filter((_, i) => i !== idx);
                      setConfigCheckout((prev) => ({
                        ...prev,
                        transferencia: { ...prev.transferencia, cuentas: nuevas },
                      }));
                    }}
                    style={{
                      padding: "7px",
                      borderRadius: "7px",
                      border: "1px solid #E5CACA",
                      background: "#FAF2F2",
                      color: "#8A2E2E",
                      cursor: "pointer",
                    }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: "14px", alignItems: "center", marginBottom: "14px" }}>
              <div>
                <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                  Código QR DeUna (URL o Imagen Subida)
                </label>
                <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  <input
                    type="text"
                    placeholder="/img/qr-deuna-tinkay.png"
                    value={configCheckout.transferencia.qrDeunaUrl || ""}
                    onChange={(e) =>
                      setConfigCheckout((prev) => ({
                        ...prev,
                        transferencia: {
                          ...prev.transferencia,
                          qrDeunaUrl: e.target.value || null,
                        },
                      }))
                    }
                    style={{ flex: 1, minWidth: "200px", padding: "8px 10px", borderRadius: "7px", border: "1px solid #D5CFC4", fontSize: "0.83rem" }}
                  />
                  <label
                    title="Subir imagen del código QR DeUna"
                    style={{
                      padding: "8px 12px",
                      borderRadius: "7px",
                      border: "1px solid #D5CFC4",
                      background: "#FFFFFF",
                      fontSize: "0.78rem",
                      fontWeight: 700,
                      cursor: subiendoQr ? "wait" : "pointer",
                    }}
                  >
                    {subiendoQr ? "Subiendo..." : "Subir QR"}
                    <input
                      type="file"
                      accept="image/*"
                      disabled={subiendoQr}
                      style={{ display: "none" }}
                      onChange={async (ev) => {
                        const file = ev.target.files?.[0];
                        if (!file) return;
                        setSubiendoQr(true);
                        try {
                          const fd = new FormData();
                          fd.set("negocio", negocio);
                          fd.set("archivo", file);
                          const resUp = await subirComprobanteTransferenciaAction(fd);
                          if (resUp.ok) {
                            setConfigCheckout((prev) => ({
                              ...prev,
                              transferencia: {
                                ...prev.transferencia,
                                qrDeunaUrl: resUp.comprobante.url,
                              },
                            }));
                          } else {
                            setErrorMsg(resUp.error);
                          }
                        } finally {
                          setSubiendoQr(false);
                        }
                      }}
                    />
                  </label>
                </div>
              </div>
              {configCheckout.transferencia.qrDeunaUrl && (
                <img
                  src={configCheckout.transferencia.qrDeunaUrl}
                  alt="QR DeUna"
                  style={{
                    width: "76px",
                    height: "76px",
                    objectFit: "contain",
                    borderRadius: "8px",
                    border: "1px solid #D5CFC4",
                    background: "#FFFFFF",
                  }}
                />
              )}
            </div>

            <div>
              <label style={{ display: "block", fontSize: "0.76rem", fontWeight: 700, color: "#57524C", marginBottom: "4px" }}>
                Advertencia de Acreditación en Checkout
              </label>
              <input
                type="text"
                value={configCheckout.transferencia.advertenciaAcreditacion}
                onChange={(e) =>
                  setConfigCheckout((prev) => ({
                    ...prev,
                    transferencia: {
                      ...prev.transferencia,
                      advertenciaAcreditacion: e.target.value,
                    },
                  }))
                }
                style={{ width: "100%", padding: "8px 10px", borderRadius: "7px", border: "1px solid #D5CFC4", boxSizing: "border-box", fontSize: "0.83rem" }}
              />
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              disabled={guardandoCheckout}
              title="Guardar parámetros de compra rápida, WhatsApp y transferencia bancaria"
              aria-label="Guardar Parámetros"
              style={{
                background: "#2F4737",
                color: "#FFFFFF",
                border: "none",
                padding: "10px 22px",
                borderRadius: "8px",
                fontSize: "0.85rem",
                fontWeight: 700,
                cursor: guardandoCheckout ? "not-allowed" : "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              {guardandoCheckout ? <RefreshCw size={16} className="animate-spin" /> : <Save size={16} />}
              <span>Guardar Parámetros</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
