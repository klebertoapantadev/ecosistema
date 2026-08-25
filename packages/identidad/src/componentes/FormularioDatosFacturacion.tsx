"use client";

import React, { useState, useEffect } from "react";
import { Check, Receipt, UserCheck, FileText, MapPin, Mail, Phone, ShieldCheck } from "lucide-react";
import { actualizarDatosFacturacion } from "../acciones";

interface Props {
  nombresRegistro?: string;
  apellidosRegistro?: string;
  correoRegistro?: string;
  inicial?: {
    razonSocial?: string;
    tipoIdentificacion?: string;
    identificacion?: string;
    telefono?: string;
    direccion?: string;
    correoFacturacion?: string;
  };
}

export function FormularioDatosFacturacion({
  nombresRegistro = "",
  apellidosRegistro = "",
  correoRegistro = "",
  inicial,
}: Props) {
  const [razonSocial, setRazonSocial] = useState(inicial?.razonSocial || "");
  const [tipoIdentificacion, setTipoIdentificacion] = useState(inicial?.tipoIdentificacion || "cedula");
  const [identificacion, setIdentificacion] = useState(inicial?.identificacion || "");
  const [telefono, setTelefono] = useState(inicial?.telefono || "");
  const [direccion, setDireccion] = useState(inicial?.direccion || "");
  const [correoFacturacion, setCorreoFacturacion] = useState(inicial?.correoFacturacion || "");

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Cargar datos locales respaldados si no existen props iniciales
  useEffect(() => {
    if (!inicial?.razonSocial && typeof window !== "undefined") {
      try {
        const local = localStorage.getItem("tranqi_datos_facturacion");
        if (local) {
          const parsed = JSON.parse(local);
          if (parsed.razonSocial) setRazonSocial(parsed.razonSocial);
          if (parsed.tipoIdentificacion) setTipoIdentificacion(parsed.tipoIdentificacion);
          if (parsed.identificacion) setIdentificacion(parsed.identificacion);
          if (parsed.telefono) setTelefono(parsed.telefono);
          if (parsed.direccion) setDireccion(parsed.direccion);
          if (parsed.correoFacturacion) setCorreoFacturacion(parsed.correoFacturacion);
        }
      } catch { /* Ignorar */ }
    }
  }, [inicial]);

  const handleUsarDatosRegistro = () => {
    const nombreCompleto = [nombresRegistro, apellidosRegistro].filter(Boolean).join(" ").trim();
    if (nombreCompleto) {
      setRazonSocial(nombreCompleto);
    }
    if (correoRegistro && !correoFacturacion) {
      setCorreoFacturacion(correoRegistro);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!razonSocial.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el Nombre Completo o Razón Social para la factura." });
      return;
    }
    if (!identificacion.trim()) {
      setMensaje({ tipo: "error", texto: "Ingresa el número de Cédula, RUC o Pasaporte." });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const datosGuardar = {
      razonSocial: razonSocial.trim(),
      tipoIdentificacion,
      identificacion: identificacion.trim(),
      telefono: telefono.trim(),
      direccion: direccion.trim(),
      correoFacturacion: correoFacturacion.trim(),
    };

    // Guardar respaldo local inmediato
    try {
      localStorage.setItem("tranqi_datos_facturacion", JSON.stringify(datosGuardar));
    } catch { /* Ignorar */ }

    const res = await actualizarDatosFacturacion(datosGuardar);
    setGuardando(false);

    if (res.ok) {
      setMensaje({ tipo: "exito", texto: "Datos de facturación guardados correctamente." });
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudieron guardar los datos de facturación." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-panel" style={{ maxWidth: "100%", gap: "18px" }}>
      {/* Banner de Ayuda y Auto-Relleno */}
      <div
        style={{
          padding: "16px",
          background: "var(--panel-papel, #F7F6FA)",
          borderRadius: "12px",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              padding: "8px",
              borderRadius: "8px",
              background: "var(--esmeralda-suave, #E6F4F1)",
              color: "var(--esmeralda, #05876E)",
              display: "flex",
            }}
          >
            <Receipt size={20} />
          </div>
          <div>
            <strong style={{ fontSize: "0.92rem", display: "block", color: "var(--negro, #111111)" }}>
              Comprobantes Electrónicos SRI
            </strong>
            <span style={{ fontSize: "0.8rem", color: "var(--panel-gris, #737373)" }}>
              Esta información se emitirá en tus facturas y recibos de servicios.
            </span>
          </div>
        </div>

        {(nombresRegistro || apellidosRegistro) && (
          <button
            type="button"
            onClick={handleUsarDatosRegistro}
            className="btn-mini btn-responsive-accion"
            title="Usar Nombres del Registro"
            aria-label="Usar Nombres del Registro"
            style={{
              background: "var(--blanco, #ffffff)",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              color: "var(--violeta, #5000BA)",
              fontWeight: 700,
              gap: "6px",
              display: "inline-flex",
              alignItems: "center",
            }}
          >
            <UserCheck size={15} />
            <span className="btn-texto-responsive">Usar Nombres del Registro</span>
          </button>
        )}
      </div>

      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "rgba(5, 135, 110, 0.12)" : "rgba(176, 0, 32, 0.12)",
            border: mensaje.tipo === "exito" ? "1px solid var(--esmeralda, #05876e)" : "1px solid #B00020",
            color: mensaje.tipo === "exito" ? "var(--esmeralda, #05876e)" : "#B00020",
            fontSize: "0.86rem",
            fontWeight: 700,
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Razón Social / Nombre Completo */}
      <label>
        Nombre Completo / Razón Social para la Factura
        <div style={{ position: "relative" }}>
          <input
            type="text"
            value={razonSocial}
            onChange={(e) => setRazonSocial(e.target.value)}
            required
            placeholder="Ej: Juan Carlos Perez u Organizacion S.A."
            style={{ paddingLeft: "36px" }}
          />
          <FileText size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
        </div>
      </label>

      {/* Grid Tipo Identificación e Identificación */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        <label>
          Tipo de Documento
          <select
            value={tipoIdentificacion}
            onChange={(e) => setTipoIdentificacion(e.target.value)}
            style={{ width: "100%" }}
          >
            <option value="cedula">Cédula de Identidad</option>
            <option value="ruc">RUC (Registro Único de Contribuyentes)</option>
            <option value="pasaporte">Pasaporte / Doc. Internacional</option>
          </select>
        </label>

        <label>
          Número de Cédula / RUC / Pasaporte
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={identificacion}
              onChange={(e) => setIdentificacion(e.target.value)}
              required
              placeholder="Ej: 1715000000001"
              style={{ paddingLeft: "36px" }}
            />
            <ShieldCheck size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
          </div>
        </label>
      </div>

      {/* Correo de Facturación (Diferente a los de Notificación) */}
      <label>
        Correo Electrónico de Facturación (Diferente a los de Notificación)
        <div style={{ position: "relative" }}>
          <input
            type="email"
            value={correoFacturacion}
            onChange={(e) => setCorreoFacturacion(e.target.value)}
            placeholder="Ej: facturacion@micompania.com"
            style={{ paddingLeft: "36px" }}
          />
          <Mail size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
        </div>
        <span style={{ fontSize: "0.76rem", color: "var(--panel-gris, #737373)", marginTop: "4px", display: "block" }}>
          Aquí se enviarán las facturas y notas de crédito en XML/PDF emitidas por el SRI.
        </span>
      </label>

      {/* Teléfono de Facturación & Dirección Domiciliaria/Fiscal */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        <label>
          Teléfono de Contacto
          <div style={{ position: "relative" }}>
            <input
              type="tel"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              placeholder="Ej: 022123456"
              style={{ paddingLeft: "36px" }}
            />
            <Phone size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
          </div>
        </label>

        <label>
          Dirección Domiciliaria / Fiscal
          <div style={{ position: "relative" }}>
            <input
              type="text"
              value={direccion}
              onChange={(e) => setDireccion(e.target.value)}
              placeholder="Ej: Av. 6 de Diciembre y Orellana, Edif. Central Piso 4"
              style={{ paddingLeft: "36px" }}
            />
            <MapPin size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
          </div>
        </label>
      </div>

      {/* Botón de Guardado */}
      <div style={{ textAlign: "right", marginTop: "10px" }}>
        <button
          type="submit"
          disabled={guardando}
          className="btn-mini"
          style={{
            padding: "11px 24px",
            fontSize: "0.88rem",
            fontWeight: 700,
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            background: "var(--esmeralda, #05876E)",
            color: "#FFFFFF",
            border: "none",
          }}
        >
          <Check size={16} /> {guardando ? "Guardando..." : "Guardar Datos de Facturación"}
        </button>
      </div>
    </form>
  );
}
