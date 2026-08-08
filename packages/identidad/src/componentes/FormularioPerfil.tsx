"use client";

import React, { useState, useRef, useEffect } from "react";
import { Check, ShieldCheck, Camera, Trash2, Upload, Plus, X, Globe, Mail, FileText, ChevronDown } from "lucide-react";
import { actualizarPerfilUsuario } from "../acciones";
import { ModalTerminosNotificaciones } from "./ModalTerminosNotificaciones";

export interface PaisWhatsappDef {
  codigo: string;
  iso: string;
  nombre: string;
  bandera: string;
}

export const PAISES_WHATSAPP: PaisWhatsappDef[] = [
  { codigo: "+593", iso: "EC", nombre: "Ecuador", bandera: "🇪🇨" },
  { codigo: "+57", iso: "CO", nombre: "Colombia", bandera: "🇨🇴" },
  { codigo: "+51", iso: "PE", nombre: "Perú", bandera: "🇵🇪" },
  { codigo: "+1", iso: "US", nombre: "EE.UU. / Canadá", bandera: "🇺🇸" },
  { codigo: "+34", iso: "ES", nombre: "España", bandera: "🇪🇸" },
  { codigo: "+54", iso: "AR", nombre: "Argentina", bandera: "🇦🇷" },
  { codigo: "+56", iso: "CL", nombre: "Chile", bandera: "🇨🇱" },
  { codigo: "+52", iso: "MX", nombre: "México", bandera: "🇲🇽" },
];

interface Props {
  inicial: {
    nombres: string;
    apellidos: string;
    correo: string;
    whatsapp: string;
    autorizaWhatsapp: boolean;
    fotoUrl?: string | null;
    codigoPaisWhatsapp?: string;
    correosAdicionales?: string[];
  };
}

export function FormularioPerfil({ inicial }: Props) {
  const [nombres, setNombres] = useState(inicial.nombres || "");
  const [apellidos, setApellidos] = useState(inicial.apellidos || "");
  const [whatsapp, setWhatsapp] = useState(inicial.whatsapp || "");
  const [codigoPaisWhatsapp, setCodigoPaisWhatsapp] = useState(inicial.codigoPaisWhatsapp || "+593");
  const [autorizaWhatsapp, setAutorizaWhatsapp] = useState(inicial.autorizaWhatsapp || false);
  const [fotoUrl, setFotoUrl] = useState<string | null>(inicial.fotoUrl || null);

  const [correosAdicionales, setCorreosAdicionales] = useState<string[]>(inicial.correosAdicionales || []);
  const [nuevoCorreoAdicional, setNuevoCorreoAdicional] = useState("");

  const [modalTerminosAbierto, setModalTerminosAbierto] = useState(false);
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

  const handleAgregarCorreoAdicional = () => {
    const correoLimpio = nuevoCorreoAdicional.trim().toLowerCase();
    if (!correoLimpio) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoLimpio)) {
      setMensaje({ tipo: "error", texto: "Ingresa un correo electrónico adicional válido." });
      return;
    }
    if (correoLimpio === inicial.correo.toLowerCase()) {
      setMensaje({ tipo: "error", texto: "El correo adicional no puede ser igual al correo principal." });
      return;
    }
    if (correosAdicionales.includes(correoLimpio)) {
      setMensaje({ tipo: "error", texto: "Este correo adicional ya está agregado." });
      return;
    }

    setCorreosAdicionales([...correosAdicionales, correoLimpio]);
    setNuevoCorreoAdicional("");
    setMensaje(null);
  };

  const handleEliminarCorreoAdicional = (correoBorrar: string) => {
    setCorreosAdicionales(correosAdicionales.filter((c) => c !== correoBorrar));
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
      codigoPaisWhatsapp,
      correosAdicionales,
    });

    setGuardando(false);
    if (res.ok) {
      setMensaje({ tipo: "exito", texto: "✅ Perfil, WhatsApp y correos de notificación guardados correctamente." });
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

      {/* Correo Electrónico Principal (Solo Lectura) */}
      <label>
        Correo Electrónico Principal (Identidad Unificada)
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

      {/* Correos Adicionales de Notificación */}
      <div>
        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
          Correos Adicionales para Notificaciones
        </label>
        <div style={{ display: "flex", gap: "8px", marginBottom: "8px" }}>
          <div style={{ position: "relative", flex: 1 }}>
            <input
              type="email"
              placeholder="Ej: equipo@empresa.com o mi_otro_correo@gmail.com"
              value={nuevoCorreoAdicional}
              onChange={(e) => setNuevoCorreoAdicional(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  handleAgregarCorreoAdicional();
                }
              }}
              style={{ width: "100%", paddingLeft: "34px" }}
            />
            <Mail size={16} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--panel-gris, #737373)" }} />
          </div>
          <button
            type="button"
            onClick={handleAgregarCorreoAdicional}
            className="btn-mini"
            style={{
              background: "var(--violeta-suave, #F3E8FF)",
              color: "var(--violeta, #5000BA)",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              fontWeight: 700,
              gap: "4px",
              display: "inline-flex",
              alignItems: "center",
              padding: "0 16px",
            }}
          >
            <Plus size={16} /> Agregar
          </button>
        </div>

        {/* Chips de Correos Adicionales */}
        {correosAdicionales.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
            {correosAdicionales.map((c) => (
              <span
                key={c}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  background: "var(--panel-papel, #F7F6FA)",
                  border: "1px solid var(--panel-linea, #E4E4E4)",
                  padding: "4px 10px",
                  borderRadius: "999px",
                  fontSize: "0.8rem",
                  fontWeight: 600,
                  color: "var(--negro, #111111)",
                }}
              >
                <Mail size={13} color="var(--violeta, #5000BA)" />
                {c}
                <button
                  type="button"
                  onClick={() => handleEliminarCorreoAdicional(c)}
                  style={{
                    background: "transparent",
                    border: "none",
                    cursor: "pointer",
                    padding: 0,
                    color: "var(--panel-gris, #737373)",
                    display: "flex",
                  }}
                  title="Eliminar correo adicional"
                >
                  <X size={14} />
                </button>
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Teléfono WhatsApp con Selector de País */}
      <div>
        <label style={{ display: "block", marginBottom: "6px", fontSize: "0.82rem", fontWeight: 700, color: "var(--negro, #111111)" }}>
          Número de Celular / WhatsApp (Opcional)
        </label>
        <div style={{ display: "flex", gap: "8px", alignItems: "center", flexWrap: "wrap" }}>
          {/* Dropdown de Código de País */}
          <div style={{ position: "relative", width: "190px", flexShrink: 0 }}>
            <select
              value={codigoPaisWhatsapp}
              onChange={(e) => setCodigoPaisWhatsapp(e.target.value)}
              aria-label="Seleccionar país de WhatsApp"
              style={{
                width: "100%",
                height: "42px",
                padding: "0 28px 0 36px",
                borderRadius: "8px",
                border: "1px solid var(--panel-linea, #E4E4E4)",
                background: "var(--blanco, #ffffff)",
                color: "var(--negro, #111111)",
                fontSize: "0.85rem",
                fontWeight: 700,
                fontFamily: "inherit",
                appearance: "none",
                WebkitAppearance: "none",
                MozAppearance: "none",
                cursor: "pointer",
                outline: "none",
                boxSizing: "border-box",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
                overflow: "hidden",
              }}
            >
              {PAISES_WHATSAPP.map((p) => (
                <option key={p.codigo} value={p.codigo} style={{ padding: "8px", color: "#111111" }}>
                  {p.bandera} {p.nombre} ({p.codigo})
                </option>
              ))}
            </select>

            {/* Icono de Bandera del País Seleccionado en la esquina izquierda */}
            <span
              style={{
                position: "absolute",
                left: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                fontSize: "1.1rem",
                lineHeight: 1,
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
              }}
            >
              {PAISES_WHATSAPP.find((p) => p.codigo === codigoPaisWhatsapp)?.bandera || "🌐"}
            </span>

            {/* Flecha Desplegable a la Derecha */}
            <ChevronDown
              size={14}
              style={{
                position: "absolute",
                right: "10px",
                top: "50%",
                transform: "translateY(-50%)",
                color: "var(--panel-gris, #737373)",
                pointerEvents: "none",
              }}
            />
          </div>

          {/* Campo de Entrada de Número de Teléfono */}
          <input
            type="tel"
            placeholder="Ej: 0991234567"
            value={whatsapp}
            onChange={(e) => setWhatsapp(e.target.value)}
            style={{
              flex: "1 1 200px",
              height: "42px",
              padding: "0 14px",
              borderRadius: "8px",
              border: "1px solid var(--panel-linea, #E4E4E4)",
              background: "var(--blanco, #ffffff)",
              color: "var(--negro, #111111)",
              fontSize: "0.88rem",
              fontFamily: "inherit",
              boxSizing: "border-box",
            }}
          />
        </div>
      </div>

      {/* Checkbox y Términos y Condiciones de Notificaciones */}
      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
        <label className="campo-casilla" style={{ cursor: "pointer", display: "flex", alignItems: "flex-start", gap: "8px" }}>
          <input
            type="checkbox"
            checked={autorizaWhatsapp}
            onChange={(e) => setAutorizaWhatsapp(e.target.checked)}
            style={{ marginTop: "3px" }}
          />
          <span style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>
            Autorizo el contacto vía WhatsApp y correo para notificaciones legales, avisos y seguimiento sobre el estado de mis casos.
          </span>
        </label>

        {/* Enlace/Botón a Términos y Condiciones de Notificaciones */}
        <div style={{ paddingLeft: "26px" }}>
          <button
            type="button"
            onClick={() => setModalTerminosAbierto(true)}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: "var(--violeta, #5000BA)",
              fontSize: "0.8rem",
              fontWeight: 700,
              textDecoration: "underline",
              display: "inline-flex",
              alignItems: "center",
              gap: "4px",
              padding: 0,
            }}
          >
            <FileText size={14} /> Ver Términos y Condiciones de Notificaciones & Privacidad (LOPDP)
          </button>
        </div>
      </div>

      {/* Modal Términos */}
      <ModalTerminosNotificaciones
        abierto={modalTerminosAbierto}
        onCerrar={() => setModalTerminosAbierto(false)}
        onAceptar={() => setAutorizaWhatsapp(true)}
        aceptado={autorizaWhatsapp}
      />

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


