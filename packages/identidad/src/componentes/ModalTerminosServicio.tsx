"use client";

import { useState, useRef, useEffect } from "react";
import { ShieldCheck, ScrollText, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ModalTerminosServicioProps {
  abierto: boolean;
  alCerrar: () => void;
  alAceptar: () => void;
  negocioNombre?: string;
}

export function ModalTerminosServicio({
  abierto,
  alCerrar,
  alAceptar,
  negocioNombre = "Ecosistema Web Apps",
}: ModalTerminosServicioProps) {
  const [leidoFinal, setLeidoFinal] = useState(false);
  const [porcentajeLectura, setPorcentajeLectura] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto) {
      setLeidoFinal(false);
      setPorcentajeLectura(0);
    }
  }, [abierto]);

  if (!abierto) return null;

  function manejarScroll() {
    const el = contenedorRef.current;
    if (!el) return;

    const scrollTop = el.scrollTop;
    const scrollHeight = el.scrollHeight;
    const clientHeight = el.clientHeight;

    const totalScrolleable = scrollHeight - clientHeight;
    if (totalScrolleable <= 0) {
      setPorcentajeLectura(100);
      setLeidoFinal(true);
      return;
    }

    const porcentaje = Math.min(100, Math.round((scrollTop / totalScrolleable) * 100));
    setPorcentajeLectura(porcentaje);

    // Margen de 20px antes del fondo
    if (totalScrolleable - scrollTop <= 20) {
      setLeidoFinal(true);
    }
  }

  function confirmarAceptacion() {
    if (leidoFinal) {
      alAceptar();
      alCerrar();
    }
  }

  return (
    <div
      style={{
        position: "fixed",
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: "rgba(17, 24, 39, 0.75)",
        backdropFilter: "blur(6px)",
        zIndex: 99999,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "16px",
      }}
    >
      <div
        style={{
          backgroundColor: "#ffffff",
          borderRadius: "20px",
          maxWidth: "680px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid #E5E7EB",
          overflow: "hidden",
        }}
      >
        {/* CABECERA MODAL */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid #F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, #F9FAFB 0%, #F3F4F6 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "40px",
                height: "40px",
                borderRadius: "10px",
                background: "#EEF2FF",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              <ScrollText size={22} color="#4F46E5" />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "#111827" }}>
                Términos y Condiciones de Servicio
              </h3>
              <p style={{ fontSize: "0.78rem", color: "#6B7280", margin: 0 }}>
                {negocioNombre} — Lectura obligatoria requerida
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={alCerrar}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              padding: "6px",
              color: "#9CA3AF",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE PROGRESO DE LECTURA */}
        <div style={{ height: "4px", width: "100%", background: "#E5E7EB" }}>
          <div
            style={{
              height: "100%",
              width: `${porcentajeLectura}%`,
              background: leidoFinal
                ? "#10B981"
                : "linear-gradient(90deg, #4F46E5 0%, #6366F1 100%)",
              transition: "width 0.15s ease",
            }}
          />
        </div>

        {/* ALERTA INFORMATIVA SCROLL */}
        <div
          style={{
            padding: "10px 24px",
            background: leidoFinal ? "#ECFDF5" : "#EFF6FF",
            borderBottom: "1px solid #E5E7EB",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: leidoFinal ? "#047857" : "#1D4ED8",
          }}
        >
          {leidoFinal ? (
            <>
              <CheckCircle2 size={16} color="#10B981" />
              <span>¡Excelente! Has leído los términos de servicio hasta el final. Ya puedes aceptarlos.</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} color="#3B82F6" />
              <span>
                Por favor desplázate hacia abajo hasta leer el final del documento para habilitar el botón de aceptación ({porcentajeLectura}%).
              </span>
            </>
          )}
        </div>

        {/* CONTENIDO DEL DOCUMENTO SCROLLEABLE */}
        <div
          ref={contenedorRef}
          onScroll={manejarScroll}
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "#374151",
          }}
        >
          <h4 style={{ fontSize: "1rem", color: "#111827", marginTop: 0 }}>1. Aceptación y Consentimiento Expreso (LOPDP)</h4>
          <p>
            Al registrarte e interactuar en nuestras plataformas digitales y servicios web/móviles (en adelante la Plataforma), otorgas tu consentimiento libre, previo, expreso, informado e inequívoco para la creación de tu cuenta de usuario e identidad base única.
          </p>

          <h4 style={{ fontSize: "1rem", color: "#111827" }}>2. Registro Ultra-Fluido e Identidad Única</h4>
          <p>
            El usuario declara que la información provista en los formularios de registro (vía Google OAuth o correo directo) es veraz y actualizada. Se asignará por defecto el perfil jerárquico base de Cliente en la membresía correspondiente.
          </p>

          <h4 style={{ fontSize: "1rem", color: "#111827" }}>3. Protección de Datos y Privacidad</h4>
          <p>
            En estricto cumplimiento de la Ley Orgánica de Protección de Datos Personales (LOPDP), nos comprometemos a salvaguardar y proteger la privacidad de tu información. La Plataforma aplica cifrado a nivel de base de datos (`pgcrypto`) y almacenamiento seguro para documentos confidenciales.
          </p>

          <h4 style={{ fontSize: "1rem", color: "#111827" }}>4. Uso de Notificaciones y WhatsApp</h4>
          <p>
            El envío de notificaciones por WhatsApp o medios de mensajería directa es estrictamente opcional y requerirá tu autorización explícita posterior. En cualquier momento podrás configurar tus preferencias de notificaciones desde tu perfil.
          </p>

          <h4 style={{ fontSize: "1rem", color: "#111827" }}>5. Derecho al Olvido y Baja de Cuenta (PLT-012)</h4>
          <p>
            Tienes derecho a solicitar la eliminación de tu cuenta e historial en cualquier momento desde la sección Mi Cuenta (Zona de Peligro). Se procesará la baja lógica o borrado de conformidad con las regulaciones aplicables.
          </p>

          <h4 style={{ fontSize: "1rem", color: "#111827" }}>6. Actualización de Términos</h4>
          <p>
            Nos reservamos el derecho de actualizar estos Términos y Condiciones en cualquier momento. Se notificará a los usuarios sobre cambios relevantes a través de los canales oficiales de la Plataforma.
          </p>

          <div
            style={{
              marginTop: "30px",
              padding: "16px",
              background: "#F9FAFB",
              borderRadius: "12px",
              border: "1px dashed #D1D5DB",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "0.82rem",
              color: leidoFinal ? "#047857" : "#6B7280",
            }}
          >
            fin del documento de términos y condiciones de servicio 
          </div>
        </div>

        {/* PIE DEL MODAL CON BOTÓN DE ACCIÓN */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid #F3F4F6",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "#ffffff",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid #D1D5DB",
              background: "#ffffff",
              color: "#374151",
              fontWeight: 700,
              fontSize: "0.85rem",
              cursor: "pointer",
            }}
          >
            Cancelar
          </button>

          <button
            type="button"
            onClick={confirmarAceptacion}
            disabled={!leidoFinal}
            style={{
              padding: "12px 24px",
              borderRadius: "10px",
              border: "none",
              background: leidoFinal
                ? "linear-gradient(135deg, #059669 0%, #047857 100%)"
                : "#E5E7EB",
              color: leidoFinal ? "#ffffff" : "#9CA3AF",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: leidoFinal ? "pointer" : "not-allowed",
              boxShadow: leidoFinal ? "0 4px 12px rgba(5, 150, 105, 0.3)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            <ShieldCheck size={18} />
            {leidoFinal
              ? "Aceptar Términos de Servicio"
              : `Lee hasta el final para aceptar (${porcentajeLectura}%)`}
          </button>
        </div>
      </div>
    </div>
  );
}
