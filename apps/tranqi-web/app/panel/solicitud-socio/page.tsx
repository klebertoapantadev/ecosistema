import type { Metadata } from "next";
import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { FormularioSolicitudSocio } from "../../../modulos/socios/componentes/FormularioSolicitudSocio";

export const metadata: Metadata = { title: "Solicitud de socio — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Enviada — en espera de revisión",
  en_revision: "En revisión",
  aceptada: "¡Aprobada! Acreditación completada",
  rechazada: "No aceptada (puedes actualizar y volver a enviar)",
};

export default async function PaginaSolicitudSocio() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null;

  const solicitud = await obtenerSolicitudPropia(perfil.usu_id);

  // Si ya esta APROBADA (aceptada), la solicitud fue exitosa
  if (solicitud && solicitud.ssc_estado === "aceptada") {
    return (
      <div style={{ padding: "24px", maxWidth: "800px" }}>
        <div style={{ background: "rgba(16, 185, 129, 0.08)", border: "1px solid #10B981", borderRadius: "16px", padding: "24px" }}>
          <span className="chip-estado-solicitud chip-aceptada" style={{ fontSize: "0.88rem", fontWeight: 800 }}>
            {ETIQUETA_ESTADO.aceptada}
          </span>
          <h2 style={{ color: "#065F46", margin: "16px 0 8px" }}>¡Felicitaciones! Tu acreditación como Socio Abogado fue Aprobada</h2>
          <p style={{ color: "#047857", fontSize: "0.95rem", lineHeight: 1.5 }}>
            Ya formas parte del Equipo Jurídico de <strong>tranqi</strong>. Tienes acceso completo a las herramientas y funciones profesionales en la plataforma.
          </p>
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
        {solicitud && (
          <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`} style={{ fontSize: "0.85rem", fontWeight: 800 }}>
            {ETIQUETA_ESTADO[solicitud.ssc_estado] ?? solicitud.ssc_estado}
          </span>
        )}
      </div>

      {solicitud && (
        <div style={{ background: "var(--violeta-suave, #F3E8FF)", border: "1px solid var(--violeta, #5000BA)", padding: "14px 18px", borderRadius: "12px", marginBottom: "20px" }}>
          <p style={{ margin: 0, fontWeight: 700, color: "var(--violeta, #5000BA)", fontSize: "0.88rem" }}>
            ℹ️ Tienes una solicitud registrada enviada el {new Date(solicitud.ssc_enviada_en || solicitud.ssc_creado_en).toLocaleDateString("es-EC")}. Puedes modificar tus datos o adjuntar nuevos archivos a continuación y enviar una actualización.
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
