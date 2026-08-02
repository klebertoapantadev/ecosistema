"use client";

import React, { useState } from "react";
import { User, Mail, MessageSquare, Check, ShieldCheck } from "lucide-react";
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
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
      {mensaje && (
        <div
          style={{
            padding: "10px 14px",
            borderRadius: "6px",
            background: mensaje.tipo === "exito" ? "rgba(46, 160, 67, 0.15)" : "rgba(248, 81, 73, 0.15)",
            border: mensaje.tipo === "exito" ? "1px solid #2ea043" : "1px solid #f85149",
            color: mensaje.tipo === "exito" ? "#3fb950" : "#f85149",
            fontSize: "0.82rem",
            fontWeight: 600
          }}
        >
          {mensaje.texto}
        </div>
      )}

      {/* Grid Nombres y Apellidos */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#8b949e", marginBottom: "4px" }}>
            Nombres
          </label>
          <input
            type="text"
            value={nombres}
            onChange={e => setNombres(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#c9d1d9",
              fontSize: "0.84rem"
            }}
          />
        </div>
        <div>
          <label style={{ display: "block", fontSize: "0.78rem", color: "#8b949e", marginBottom: "4px" }}>
            Apellidos
          </label>
          <input
            type="text"
            value={apellidos}
            onChange={e => setApellidos(e.target.value)}
            required
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#0d1117",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#c9d1d9",
              fontSize: "0.84rem"
            }}
          />
        </div>
      </div>

      {/* Correo Electrónico (Solo Lectura) */}
      <div>
        <label style={{ display: "block", fontSize: "0.78rem", color: "#8b949e", marginBottom: "4px" }}>
          Correo Electrónico (Identidad Unificada)
        </label>
        <div style={{ position: "relative" }}>
          <input
            type="email"
            value={inicial.correo}
            disabled
            style={{
              width: "100%",
              padding: "8px 12px",
              background: "#161b22",
              border: "1px solid #30363d",
              borderRadius: "6px",
              color: "#8b949e",
              fontSize: "0.84rem",
              cursor: "not-allowed"
            }}
          />
          <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", fontSize: "0.72rem", color: "#3fb950", display: "flex", alignItems: "center", gap: "2px" }}>
            <ShieldCheck size={14} /> Verificado
          </span>
        </div>
      </div>

      {/* Teléfono WhatsApp y Checkbox */}
      <div>
        <label style={{ display: "block", fontSize: "0.78rem", color: "#8b949e", marginBottom: "4px" }}>
          Número de Celular / WhatsApp (Opcional)
        </label>
        <input
          type="tel"
          placeholder="0991234567"
          value={whatsapp}
          onChange={e => setWhatsapp(e.target.value)}
          style={{
            width: "100%",
            padding: "8px 12px",
            background: "#0d1117",
            border: "1px solid #30363d",
            borderRadius: "6px",
            color: "#c9d1d9",
            fontSize: "0.84rem"
          }}
        />
      </div>

      <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "0.78rem", color: "#8b949e", cursor: "pointer", marginTop: "4px" }}>
        <input
          type="checkbox"
          checked={autorizaWhatsapp}
          onChange={e => setAutorizaWhatsapp(e.target.checked)}
        />
        Autorizo el contacto opcional vía WhatsApp para notificaciones de mis casos
      </label>

      {/* Botón de Guardado */}
      <div style={{ textAlign: "right", marginTop: "8px" }}>
        <button
          type="submit"
          disabled={guardando}
          className="btn-primario"
          style={{
            background: "#1f6feb",
            color: "#ffffff",
            border: "none",
            borderRadius: "6px",
            padding: "8px 18px",
            fontSize: "0.82rem",
            fontWeight: 700,
            cursor: guardando ? "not-allowed" : "pointer",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px"
          }}
        >
          <Check size={16} /> {guardando ? "Guardando..." : "Guardar Cambios de Perfil"}
        </button>
      </div>
    </form>
  );
}
