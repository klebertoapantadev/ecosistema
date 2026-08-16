"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Edit3, RotateCcw, Trash2, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";
import { eliminarSolicitudSocioPropiaAction, reiniciarSolicitudSocioPropiaAction } from "../../modulos/socios/acciones";

interface Props {
  solicitud: Record<string, unknown>;
}

export function TarjetaEstadoSolicitudHome({ solicitud }: Props) {
  const router = useRouter();
  const estado = String(solicitud.ssc_estado || "enviada");
  const solicitudId = String(solicitud.ssc_id || "");
  const fechaStr = solicitud.ssc_enviada_en || solicitud.ssc_creado_en;
  const fecha = fechaStr ? new Date(String(fechaStr)).toLocaleDateString("es-EC") : null;

  const [modalConfirmar, setModalConfirmar] = useState<"eliminar" | "reiniciar" | null>(null);
  const [procesando, setProcesando] = useState(false);
  const [mensajeExito, setMensajeExito] = useState<string | null>(null);
  const [errorAccion, setErrorAccion] = useState<string | null>(null);

  const CONFIG: Record<string, { titulo: string; desc: string; chip: string; bg: string; border: string; color: string }> = {
    enviada: {
      titulo: "Solicitud de Socio Abogado — Recibida & En Proceso",
      desc: "Tu postulación fue recibida. Nuestro equipo de admisibilidad está revisando tu titulación y matrícula del Foro de Abogados.",
      chip: "🟡 Solicitud Ingresada",
      bg: "rgba(245, 158, 11, 0.08)",
      border: "#F59E0B",
      color: "#B45309",
    },
    en_revision: {
      titulo: "Solicitud de Socio Abogado — En Revisión Legal",
      desc: "Estamos validando tus credenciales en los portales oficiales de la SENESCYT y Consejo de la Judicatura.",
      chip: "🔵 En Revisión Legal",
      bg: "rgba(59, 130, 246, 0.08)",
      border: "#3B82F6",
      color: "#1D4ED8",
    },
    rechazada: {
      titulo: "Solicitud de Socio Abogado — Requiere Corrección / Actualización",
      desc: "Se identificaron observaciones en la documentación o datos ingresados. Por favor actualiza la información y vuelve a enviar.",
      chip: "🔴 No Autorizada (Modificación Requerida)",
      bg: "rgba(239, 68, 68, 0.08)",
      border: "#EF4444",
      color: "#B91C1C",
    },
  };

  const info = CONFIG[estado] ?? {
    titulo: "Solicitud de Socio Abogado — En Curso (Incompleta)",
    desc: "Tienes un proceso de registro como socio abogado iniciado. Puedes completarlo, reiniciarlo o eliminarlo en cualquier momento.",
    chip: "🟠 En Curso (Incompleta)",
    bg: "rgba(249, 115, 22, 0.08)",
    border: "#F97316",
    color: "#C2410C",
  };

  const manejarEliminar = async () => {
    setProcesando(true);
    setErrorAccion(null);
    try {
      // Limpiar borradores locales
      if (typeof window !== "undefined") {
        localStorage.removeItem("tranqi_solicitud_socio_borrador");
      }
      const res = await eliminarSolicitudSocioPropiaAction(solicitudId);
      if (res.ok) {
        setMensajeExito("Solicitud de socio eliminada correctamente.");
        setModalConfirmar(null);
        setTimeout(() => {
          router.refresh();
        }, 800);
      } else {
        setErrorAccion(res.error || "No se pudo eliminar la solicitud.");
      }
    } catch (err: unknown) {
      setErrorAccion(err instanceof Error ? err.message : "Error al procesar la eliminación.");
    } finally {
      setProcesando(false);
    }
  };

  const manejarReiniciar = async () => {
    setProcesando(true);
    setErrorAccion(null);
    try {
      if (typeof window !== "undefined") {
        localStorage.removeItem("tranqi_solicitud_socio_borrador");
      }
      const res = await reiniciarSolicitudSocioPropiaAction(solicitudId);
      if (res.ok) {
        setMensajeExito("Solicitud reiniciada. Redirigiendo al formulario limpio...");
        setModalConfirmar(null);
        setTimeout(() => {
          router.push("/panel/solicitud-socio");
          router.refresh();
        }, 800);
      } else {
        setErrorAccion(res.error || "No se pudo reiniciar la solicitud.");
      }
    } catch (err: unknown) {
      setErrorAccion(err instanceof Error ? err.message : "Error al reiniciar.");
    } finally {
      setProcesando(false);
    }
  };

  return (
    <section
      style={{
        width: "100%",
        background: info.bg,
        border: `1.5px solid ${info.border}`,
        borderRadius: "16px",
        padding: "20px 24px",
        marginBottom: "24px",
        boxShadow: "0 6px 18px rgba(0,0,0,0.04)",
        position: "relative",
      }}
    >
      {mensajeExito && (
        <div
          style={{
            background: "#ECFDF5",
            border: "1px solid #10B981",
            color: "#065F46",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.88rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <CheckCircle2 size={18} /> {mensajeExito}
        </div>
      )}

      {errorAccion && (
        <div
          style={{
            background: "#FEF2F2",
            border: "1px solid #EF4444",
            color: "#991B1B",
            padding: "10px 14px",
            borderRadius: "8px",
            marginBottom: "14px",
            fontSize: "0.88rem",
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <ShieldAlert size={18} /> {errorAccion}
        </div>
      )}

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
        <div style={{ flex: 1, minWidth: "280px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "6px" }}>
            <span
              style={{
                fontSize: "0.78rem",
                fontWeight: 800,
                padding: "4px 12px",
                borderRadius: "999px",
                background: "#FFFFFF",
                border: `1px solid ${info.border}`,
                color: info.color,
              }}
            >
              {info.chip}
            </span>
            {fecha && <span style={{ fontSize: "0.78rem", color: "#666" }}>Registrada el {fecha}</span>}
          </div>
          <h2 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111111", margin: "6px 0 4px" }}>{info.titulo}</h2>
          <p style={{ fontSize: "0.88rem", color: "#444444", margin: 0, lineHeight: "1.45" }}>{info.desc}</p>
        </div>

        {/* Botonera de Acciones: Editar, Reiniciar y Eliminar */}
        <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
          <Link
            href="/panel/solicitud-socio"
            style={{
              textDecoration: "none",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "linear-gradient(135deg, #5000BA 0%, #3B0088 100%)",
              color: "#FFF",
              padding: "10px 16px",
              borderRadius: "10px",
              fontSize: "0.84rem",
              fontWeight: 800,
              boxShadow: "0 4px 12px rgba(80, 0, 186, 0.25)",
              whiteSpace: "nowrap",
            }}
          >
            <Edit3 size={15} /> Continuar / Editar Solicitud
          </Link>

          <button
            type="button"
            onClick={() => setModalConfirmar("reiniciar")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#FFFFFF",
              color: "#5000BA",
              border: "1px solid #5000BA",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <RotateCcw size={15} /> Reiniciar
          </button>

          <button
            type="button"
            onClick={() => setModalConfirmar("eliminar")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "6px",
              background: "#FFFFFF",
              color: "#DC2626",
              border: "1px solid #DC2626",
              padding: "10px 14px",
              borderRadius: "10px",
              fontSize: "0.84rem",
              fontWeight: 700,
              cursor: "pointer",
              whiteSpace: "nowrap",
            }}
          >
            <Trash2 size={15} /> Eliminar Solicitud
          </button>
        </div>
      </div>

      {/* Modal de Confirmación para Reiniciar o Eliminar */}
      {modalConfirmar && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            width: "100%",
            height: "100%",
            background: "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 99999,
            padding: "16px",
          }}
        >
          <div
            style={{
              background: "#FFFFFF",
              borderRadius: "16px",
              padding: "24px",
              maxWidth: "460px",
              width: "100%",
              boxShadow: "0 20px 40px rgba(0,0,0,0.2)",
              textAlign: "center",
            }}
          >
            <div
              style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                background: modalConfirmar === "eliminar" ? "#FEE2E2" : "#EDE9FE",
                color: modalConfirmar === "eliminar" ? "#DC2626" : "#5000BA",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                margin: "0 auto 16px",
              }}
            >
              {modalConfirmar === "eliminar" ? <AlertTriangle size={26} /> : <RotateCcw size={26} />}
            </div>

            <h3 style={{ fontSize: "1.15rem", fontWeight: 800, color: "#111", margin: "0 0 8px" }}>
              {modalConfirmar === "eliminar" ? "¿Eliminar solicitud de socio abogado?" : "¿Reiniciar solicitud desde cero?"}
            </h3>

            <p style={{ fontSize: "0.88rem", color: "#555", lineHeight: "1.5", margin: "0 0 20px" }}>
              {modalConfirmar === "eliminar"
                ? "Esta acción cancelará tu postulación y eliminará los documentos y materias asociadas. Podrás volver a iniciar una nueva solicitud cuando lo desees."
                : "Se limpiarán los datos y archivos cargados previamente para que puedas comenzar el formulario completamente limpio."}
            </p>

            <div style={{ display: "flex", gap: "10px", justifyContent: "center" }}>
              <button
                type="button"
                onClick={() => setModalConfirmar(null)}
                disabled={procesando}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: "#F3F4F6",
                  color: "#374151",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Cancelar
              </button>

              <button
                type="button"
                onClick={modalConfirmar === "eliminar" ? manejarEliminar : manejarReiniciar}
                disabled={procesando}
                style={{
                  flex: 1,
                  padding: "10px 16px",
                  background: modalConfirmar === "eliminar" ? "#DC2626" : "#5000BA",
                  color: "#FFF",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "0.88rem",
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                {procesando ? "Procesando..." : modalConfirmar === "eliminar" ? "Sí, Eliminar" : "Sí, Reiniciar"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
