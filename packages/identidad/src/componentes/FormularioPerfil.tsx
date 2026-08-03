"use client";

import React, { useState } from "react";
import { Check, ShieldCheck } from "lucide-react";
import { actualizarPerfilUsuario } from "../acciones";

interface Props {
  inicial: {
    nombres: string;
    apellidos: string;
    correo: string;
    whatsapp: string;
    autorizaWhatsapp: boolean;
  };
}

export function FormularioPerfil({ inicial }: Props) {
  const [nombres, setNombres] = useState(inicial.nombres || "");
  const [apellidos, setApellidos] = useState(inicial.apellidos || "");
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp || "");
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(inicial.autorizaWhatsapp || false);

  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!nombres.trim() || !apellidos.trim()) {
      setMensaje({ tipo: "error", texto: "Nombres y apellidos son obligatorios." });
      return;
    }

    setGuardando(true);
    setMensaje(null);

    const res = await actualizarPerfilUsuario({
      nombres,
      apellidos,
      whatsapp,
      autorizaWhatsapp
    });

    setGuardando(false);
    if (res.ok) {
      setMensaje({ tipo: "exito", texto: "✅ Perfil actualizado correctamente." });
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudo actualizar el perfil." });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="form-panel" style={{ maxWidth: "100%", gap: "16px" }}>
      {mensaje && (
        <div
          style={{
            padding: "12px 16px",
            borderRadius: "8px",
            background: mensaje.tipo === "exito" ? "rgba(5, 135, 110, 0.12)" : "rgba(176, 0, 32, 0.12)",
            border: mensaje.tipo === "exito" ? "1px solid var(--esmeralda, #05876e)" : "1px solid #B00020",
            color: mensaje.tipo === "exito" ? "var(--esmeralda, #05876e)" : "#B00020",
            fontSize: "0.86rem",
            fontWeight: 700
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Grid Nombres y Apellidos */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
        <label>
          Nombres
          <input
            type="text"
            value={nombres}
            onChange={e => setNombres(e.target.value)}
            required
            placeholder="Tus nombres"
          />
        </label>

        <label>
          Apellidos
          <input
            type="text"
            value={apellidos}
            onChange={e => setApellidos(e.target.value)}
            required
            placeholder="Tus apellidos"
          />
        </label>
      </div>

      {/* Correo Electrónico (Solo Lectura) */}
      <label>
        Correo Electrónico (Identidad Unificada)
        <div style={{ position: "relative" }}>
          <input
            type="email"
            value={inicial.correo}
            disabled
            style={{
              width: "100%",
              background: "var(--panel-linea-suave, #F1F1F1)",
              color: "var(--panel-gris, #737373)",
              cursor: "not-allowed"
            }}
          />
          <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", fontSize: "0.78rem", color: "var(--esmeralda, #05876e)", fontWeight: 700, display: "flex", alignItems: "center", gap: "3px" }}>
            <ShieldCheck size={16} /> Verificado
          </span>
        </div>
      </label>

      {/* Teléfono WhatsApp y Checkbox */}
      <label>
        Número de Celular / WhatsApp (Opcional)
        <input
          type="tel"
          placeholder="Ej: 0991234567"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
        />
      </label>

      <label className="campo-casilla" style={{ cursor: "pointer" }}>
        <input
          type="checkbox"
          checked={autorizaWhatsapp}
          onChange={e => setAutorizaWhatsapp(e.target.checked)}
        />
        <span>Autorizo el contacto opcional vía WhatsApp para notificaciones sobre el estado de mis casos</span>
      </label>

      {/* Botón de Guardado */}
      <div style={{ textAlign: "right", marginTop: "8px" }}>
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
            gap: "8px"
          }}
        >
          <Check size={16} /> {guardando ? "Guardando..." : "Guardar Cambios de Perfil"}
        </button>
      </div>
    </form>
  );
}
