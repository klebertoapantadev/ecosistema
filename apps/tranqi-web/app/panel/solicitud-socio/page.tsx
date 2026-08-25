import type { Metadata } from "next";
import Link from "next/link";
import { X } from "lucide-react";
import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { FormularioSolicitudSocio } from "../../../modulos/socios/componentes/FormularioSolicitudSocio";
import { GestionContratoPostulante } from "../../../modulos/socios/componentes/GestionContratoPostulante";

export const metadata: Metadata = { title: "Solicitud de socio — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Solicitud Recibida / Actualizada — Pendiente de Revisión",
  en_revision: "En Revisión Legal",
  aceptada: "¡Aprobada! Acreditación completada",
  rechazada: "Requiere Corrección / Actualización",
};

export default async function PaginaSolicitudSocio() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null;

  const solicitud = await obtenerSolicitudPropia(perfil.usu_id);

  // Si ya esta APROBADA (aceptada), la solicitud fue exitosa
  if (solicitud && solicitud.ssc_estado === "aceptada") {
    return (
      <div style={{ padding: "24px", maxWidth: "800px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h2 style={{ margin: 0, color: "#065F46" }}>Estatus de Acreditación</h2>
          <Link
            href="/panel"
            title="Cerrar y volver al menú principal"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "1.5px solid #E4E4E4",
              color: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              textDecoration: "none",
            }}
          >
            <X size={20} />
          </Link>
        </div>
        <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid #10B981", borderRadius: "16px", padding: "24px" }}>
          <span className="chip-estado-solicitud chip-aceptada" style={{ fontSize: "0.88rem", fontWeight: 800 }}>
            {ETIQUETA_ESTADO.aceptada}
          </span>
          <h3 style={{ color: "#065F46", margin: "16px 0 8px" }}>¡Felicitaciones! Tu acreditación como Socio Abogado fue Aprobada</h3>
          <p style={{ color: "#047857", fontSize: "0.95rem", lineHeight: 1.5, marginBottom: "16px" }}>
            Ya formas parte del Equipo Jurídico de <strong>tranqi</strong>. Tienes acceso completo a las herramientas y funciones profesionales en la plataforma.
          </p>

          <hr style={{ border: "none", borderTop: "1px solid #10B981", opacity: 0.3, margin: "20px 0" }} />

          {/* Gestión de la firma y subida del contrato de sociedad */}
          <GestionContratoPostulante solicitud={solicitud} />
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "16px" }}>
        <div>
          <h1>Solicitud de socio abogado</h1>
          <p style={{ margin: 0, color: "var(--panel-gris, #737373)" }}>
            Únete a la red de abogados de tranqi — nuevos clientes, capacitación constante y tu cuenta digital.
          </p>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {solicitud && (
            <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
              {ETIQUETA_ESTADO[solicitud.ssc_estado] ?? solicitud.ssc_estado}
            </span>
          )}

          <Link
            href="/panel"
            title="Cerrar y volver al menú principal"
            style={{
              width: "38px",
              height: "38px",
              borderRadius: "50%",
              background: "#ffffff",
              border: "1.5px solid var(--panel-linea, #E4E4E4)",
              color: "#111111",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
              boxShadow: "0 2px 6px rgba(0,0,0,0.08)",
              textDecoration: "none",
              flexShrink: 0,
              transition: "transform 0.15s ease",
            }}
          >
            <X size={20} />
          </Link>
        </div>
      </div>

      {solicitud && (
        <div style={{ background: "var(--violeta-suave, #F3E8FF)", border: "1px solid var(--violeta, #5000BA)", padding: "14px 18px", borderRadius: "12px", marginBottom: "20px" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--violeta, #5000BA)", fontSize: "0.88rem" }}>
            ℹTienes una solicitud registrada enviada el {new Date(solicitud.ssc_enviada_en || solicitud.ssc_creado_en).toLocaleDateString("es-EC")}. Puedes modificar tus datos o adjuntar nuevos archivos a continuación y enviar una actualización.
          </p>
        </div>
      )}

      <FormularioSolicitudSocioConDatos usuarioId={perfil.usu_id} correoInicial={perfil.usu_correo} solicitudExistente={solicitud} />
    </div>
  );
}

async function FormularioSolicitudSocioConDatos({
  usuarioId,
  correoInicial,
  solicitudExistente,
}: {
  usuarioId: string;
  correoInicial: string | null;
  solicitudExistente?: Record<string, unknown> | null;
}) {
  const [materias, provincias] = await Promise.all([listarMaterias(), listarProvincias()]);
  return (
    <FormularioSolicitudSocio
      usuarioId={usuarioId}
      materias={materias}
      provincias={provincias}
      correoInicial={correoInicial}
      solicitudExistente={solicitudExistente}
    />
  );
}
