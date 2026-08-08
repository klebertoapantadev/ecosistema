"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ShieldCheck, Camera, Trash2, Upload } from "lucide-react";
import { actualizarPerfilUsuario } from "../acciones";

interface Props {
  inicial: {
    nombres: string;
    apellidos: string;
    correo: string;
    whatsapp: string;
    autorizaWhatsapp: boolean;
    fotoUrl?: string | null;
  };
}

export function FormularioPerfil({ inicial }: Props) {
  const [nombres, setNombres] = useState(inicial.nombres || "");
  const [apellidos, setApellidos] = useState(inicial.apellidos || "");
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp || "");
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(inicial.autorizaWhatsapp || false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial.fotoUrl || null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const [guardando, setGuardando] = useState(false);
  const [mensaje, setMensaje] = useState<{ tipo: "exito" | "error"; texto: string } | null>(null);

  // Leer foto guardada localmente si no vino desde props
  useEffect(() => {
    if (!inicial.fotoUrl && typeof window !== "undefined") {
      const local = localStorage.getItem("tranqi_foto_perfil");
      if (local) setFotoUrl(local);
    }
  }, [inicial.fotoUrl]);

  const handleSeleccionarArchivo = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setMensaje({ tipo: "error", texto: "Selecciona un archivo de imagen válido (JPG, PNG, WebP)." });
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      setMensaje({ tipo: "error", texto: "La imagen es demasiado grande. El tamaño máximo es 5MB." });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const base64 = event.target?.result as string;
      if (base64) {
        setFotoUrl(base64);
        try {
          localStorage.setItem("tranqi_foto_perfil", base64);
        } catch { /* Ignorar */ }
      }
    };
    reader.readAsDataURL(file);
  };

  const handleEliminarFoto = () => {
    setFotoUrl(null);
    try {
      localStorage.removeItem("tranqi_foto_perfil");
    } catch { /* Ignorar */ }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

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
      autorizaWhatsapp,
      fotoUrl,
    });

    setGuardando(false);
    if (res.ok) {
      setMensaje({ tipo: "exito", texto: "✅ Perfil y foto actualizados correctamente." });
      setTimeout(() => setMensaje(null), 4000);
    } else {
      setMensaje({ tipo: "error", texto: res.error || "No se pudo actualizar el perfil." });
    }
  };

  // Iniciales para fallback visual
  const iniciales = [nombres, apellidos]
    .filter(Boolean)
    .map((str) => str.trim()[0])
    .filter(Boolean)
    .join("")
    .substring(0, 2)
    .toUpperCase() || "U";

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

      {/* Sección de Foto de Perfil / Avatar */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "20px",
          padding: "16px",
          background: "var(--panel-papel, #F7F6FA)",
          borderRadius: "12px",
          border: "1px solid var(--panel-linea, #E4E4E4)",
          flexWrap: "wrap",
        }}
      >
        {/* Contenedor Circular del Avatar */}
        <div
          style={{
            position: "relative",
            width: "84px",
            height: "84px",
            borderRadius: "50%",
            background: "var(--violeta-suave, #F3E8FF)",
            border: "2px solid var(--blanco, #ffffff)",
            boxShadow: "0 4px 10px rgba(0,0,0,0.08)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            overflow: "hidden",
            flexShrink: 0,
          }}
        >
          {fotoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={fotoUrl}
              alt="Foto de perfil"
              style={{ width: "100%", height: "100%", objectFit: "cover" }}
            />
          ) : (
            <span style={{ fontSize: "1.5rem", fontWeight: 800, color: "var(--violeta, #5000BA)" }}>
              {iniciales}
            </span>
          )}
        </div>

        {/* Acciones de Carga de Foto */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ fontSize: "0.88rem", fontWeight: 800, color: "var(--negro, #111111)" }}>
            Foto de Perfil
          </div>
          <span style={{ fontSize: "0.78rem", color: "var(--panel-gris, #737373)" }}>
            Formatos admitidos: JPG, PNG o WebP (Máx. 5MB)
          </span>

          <input
            type="file"
            ref={fileInputRef}
            onChange={handleSeleccionarArchivo}
            accept="image/*"
            style={{ display: "none" }}
          />

          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "4px" }}>
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="btn-mini"
              style={{
                background: "var(--blanco, #ffffff)",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                color: "var(--negro, #111111)",
                gap: "6px",
                display: "inline-flex",
                alignItems: "center",
                fontWeight: 700,
              }}
            >
              {fotoUrl ? <Camera size={14} /> : <Upload size={14} />}
              {fotoUrl ? "Cambiar Foto" : "Cargar Foto"}
            </button>

            {fotoUrl && (
              <button
                type="button"
                onClick={handleEliminarFoto}
                className="btn-mini"
                style={{
                  background: "rgba(176, 0, 32, 0.08)",
                  border: "1px solid rgba(176, 0, 32, 0.3)",
                  color: "#B00020",
                  gap: "6px",
                  display: "inline-flex",
                  alignItems: "center",
                  fontWeight: 700,
                }}
              >
                <Trash2 size={14} /> Quitar
              </button>
            )}
          </div>
        </div>
      </div>

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

