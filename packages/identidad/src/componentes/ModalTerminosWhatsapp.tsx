"use client";

import { useState, useRef, useEffect } from "react";
import { MessageSquare, ShieldCheck, CheckCircle2, AlertCircle, X } from "lucide-react";

interface ModalTerminosWhatsappProps {
  abierto: boolean;
  alCerrar: () => void;
  alAceptar: () => void;
  negocioNombre?: string;
}

export function ModalTerminosWhatsapp({
  abierto,
  alCerrar,
  alAceptar,
  negocioNombre = "Ecosistema Web Apps",
}: ModalTerminosWhatsappProps) {
  const [leidoFinal, setLeidoFinal] = useState(false);
  const [porcentajeLectura, setPorcentajeLectura] = useState(0);
  const contenedorRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (abierto) {
      setLeidoFinal(false);
      setPorcentajeLectura(0);

      const verificarScroll = () => {
        const el = contenedorRef.current;
        if (!el) return;

        const scrollTop = el.scrollTop;
        const scrollHeight = el.scrollHeight;
        const clientHeight = el.clientHeight;

        const totalScrolleable = scrollHeight - clientHeight;
        if (totalScrolleable <= 25) {
          setPorcentajeLectura(100);
          setLeidoFinal(true);
          return;
        }

        const porcentaje = Math.min(100, Math.round((scrollTop / totalScrolleable) * 100));
        setPorcentajeLectura(porcentaje);

        if (totalScrolleable - scrollTop <= 35) {
          setPorcentajeLectura(100);
          setLeidoFinal(true);
        }
      };

      verificarScroll();
      const timer = setTimeout(verificarScroll, 120);
      return () => clearTimeout(timer);
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
    if (totalScrolleable <= 25) {
      setPorcentajeLectura(100);
      setLeidoFinal(true);
      return;
    }

    const porcentaje = Math.min(100, Math.round((scrollTop / totalScrolleable) * 100));
    setPorcentajeLectura(porcentaje);

    if (totalScrolleable - scrollTop <= 35) {
      setPorcentajeLectura(100);
      setLeidoFinal(true);
    }
  }

  function confirmarAceptacion() {
    alAceptar();
    alCerrar();
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
          backgroundColor: "var(--cf-ffffff, #ffffff)",
          borderRadius: "20px",
          maxWidth: "640px",
          width: "100%",
          maxHeight: "90vh",
          display: "flex",
          flexDirection: "column",
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
          border: "1px solid var(--cb-e5e7eb, #E5E7EB)",
          overflow: "hidden",
        }}
      >
        {/* CABECERA MODAL WHATSAPP */}
        <div
          style={{
            padding: "20px 24px",
            borderBottom: "1px solid var(--cb-f3f4f6, #F3F4F6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "linear-gradient(135deg, var(--cf-ecfdf5, #ECFDF5) 0%, var(--cf-d1fae5, #D1FAE5) 100%)",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div
              style={{
                width: "42px",
                height: "42px",
                borderRadius: "12px",
                background: "#059669",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 12px rgba(5, 150, 105, 0.3)",
              }}
            >
              <MessageSquare size={22} color="#ffffff" />
            </div>
            <div>
              <h3 style={{ fontSize: "1.1rem", fontWeight: 800, margin: 0, color: "var(--ct-065f46, #065F46)" }}>
                Autorización de Contacto por WhatsApp
              </h3>
              <p style={{ fontSize: "0.78rem", color: "var(--ct-047857, #047857)", margin: 0 }}>
                {negocioNombre} — Cláusula de Consentimiento LOPDP
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
              color: "var(--ct-059669, #059669)",
              borderRadius: "8px",
            }}
          >
            <X size={20} />
          </button>
        </div>

        {/* BARRA DE PROGRESO */}
        <div style={{ height: "4px", width: "100%", background: "var(--cf-e5e7eb, #E5E7EB)" }}>
          <div
            style={{
              height: "100%",
              width: `${porcentajeLectura}%`,
              background: leidoFinal ? "#059669" : "#10B981",
              transition: "width 0.15s ease",
            }}
          />
        </div>

        {/* ALERTA DE SCROLL */}
        <div
          style={{
            padding: "10px 24px",
            background: leidoFinal ? "var(--cf-ecfdf5, #ECFDF5)" : "var(--cf-f0fdf4, #F0FDF4)",
            borderBottom: "1px solid var(--cb-e5e7eb, #E5E7EB)",
            display: "flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "0.8rem",
            fontWeight: 700,
            color: leidoFinal ? "var(--ct-047857, #047857)" : "var(--ct-065f46, #065F46)",
          }}
        >
          {leidoFinal ? (
            <>
              <CheckCircle2 size={16} color="#059669" />
              <span>¡Excelente! Has leído la cláusula de autorización hasta el final. Ya puedes aceptar.</span>
            </>
          ) : (
            <>
              <AlertCircle size={16} color="#10B981" />
              <span>
                Por favor desplázate hasta el final para autorizar el uso de WhatsApp como canal de contacto ({porcentajeLectura}%).
              </span>
            </>
          )}
        </div>

        {/* CUERPO DE LA CLÁUSULA WHATSAPP */}
        <div
          ref={contenedorRef}
          onScroll={manejarScroll}
          style={{
            padding: "24px",
            overflowY: "auto",
            flex: 1,
            fontSize: "0.88rem",
            lineHeight: 1.65,
            color: "var(--ct-374151, #374151)",
          }}
        >
          <h4 style={{ fontSize: "1rem", color: "var(--ct-065f46, #065F46)", marginTop: 0 }}>
            Cláusula de Consentimiento Expreso para Contacto por WhatsApp
          </h4>
          <p>
            Al marcar la opción de contacto por WhatsApp en la Plataforma <strong>{negocioNombre}</strong>, autorizas de forma libre, voluntaria, explícita e informada la vinculación de tu número telefónico registrado para la recepción de mensajes automáticos e interactivos de WhatsApp.
          </p>

          <h4 style={{ fontSize: "0.95rem", color: "var(--ct-111827, #111827)" }}>1. Finalidad del Contacto y Envío de Información</h4>
          <p>
            Tu número telefónico de WhatsApp se utilizará para:
          </p>
          <ul style={{ paddingLeft: "20px", marginTop: "4px" }}>
            <li>Envío de proformas, cotizaciones personalizadas, información de productos/servicios y asesoría comercial solicitada.</li>
            <li>Notificaciones de estado de tus solicitudes, eventos, trámites, pedidos o servicios contratados.</li>
            <li>Recordatorios de citas, entregas, confirmaciones de seguridad y soporte directo al cliente.</li>
          </ul>

          <h4 style={{ fontSize: "0.95rem", color: "var(--ct-111827, #111827)" }}>2. Confidencialidad y Protección LOPDP</h4>
          <p>
            En cumplimiento estricto con la Ley Orgánica de Protección de Datos Personales (LOPDP) de Ecuador, tu número telefónico no será compartido, cedido ni vendido a terceros no autorizados.
          </p>

          <h4 style={{ fontSize: "0.95rem", color: "var(--ct-111827, #111827)" }}>3. Revocación del Consentimiento (Carácter Opcional)</h4>
          <p>
            Recordamos que el contacto por WhatsApp es <strong>100% opcional</strong>. Puedes revocar esta autorización o desvincular tu número telefónico en cualquier momento desde la configuración de tu perfil en <code>Mi Cuenta → Notificaciones & Consentimientos</code>.
          </p>

          <div
            style={{
              marginTop: "24px",
              padding: "14px",
              background: "var(--cf-ecfdf5, #ECFDF5)",
              borderRadius: "12px",
              border: "1px dashed #6EE7B7",
              textAlign: "center",
              fontWeight: 800,
              fontSize: "0.82rem",
              color: "var(--ct-047857, #047857)",
            }}
          >
            fin de la cláusula de autorización de whatsapp 
          </div>
        </div>

        {/* PIE DEL MODAL */}
        <div
          style={{
            padding: "16px 24px",
            borderTop: "1px solid var(--cb-f3f4f6, #F3F4F6)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            background: "var(--cf-ffffff, #ffffff)",
            gap: "12px",
          }}
        >
          <button
            type="button"
            onClick={alCerrar}
            style={{
              padding: "10px 18px",
              borderRadius: "10px",
              border: "1px solid var(--cb-d1d5db, #D1D5DB)",
              background: "var(--cf-ffffff, #ffffff)",
              color: "var(--ct-374151, #374151)",
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
                : "var(--cf-e5e7eb, #E5E7EB)",
              color: leidoFinal ? "#ffffff" : "var(--ct-9ca3af, #9CA3AF)",
              fontWeight: 800,
              fontSize: "0.9rem",
              cursor: leidoFinal ? "pointer" : "not-allowed",
              boxShadow: leidoFinal ? "0 4px 14px rgba(5, 150, 105, 0.3)" : "none",
              display: "flex",
              alignItems: "center",
              gap: "8px",
              transition: "all 0.2s ease",
            }}
          >
            <ShieldCheck size={18} />
            {leidoFinal
              ? "Autorizar Contacto por WhatsApp"
              : `Lee hasta el final para autorizar (${porcentajeLectura}%)`}
          </button>
        </div>
      </div>
    </div>
  );
}
