import type { Metadata } from "next";
import Link from "next/link";
import { Users, X } from "lucide-react";
import { listarSolicitudes } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Socios — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Pendiente de Aprobación",
  en_revision: "En Revisión Legal",
  aceptada: "Aprobada",
  rechazada: "Requiere Corrección / Observada",
  cancelada: "Cancelada",
};

export default async function PaginaSocios() {
  const solicitudes = await listarSolicitudes();

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <Users size={22} color="#05876E" />
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Aprobación de Socios Abogados</h1>
        </div>
        <Link
          href="/panel/administrar"
          title="Cerrar módulo y volver a Administrar"
          style={{
            background: "var(--blanco, #ffffff)",
            border: "1.5px solid var(--panel-linea, #E4E4E4)",
            color: "var(--negro, #111111)",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            textDecoration: "none",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)"
          }}
        >
          <X size={18} />
        </Link>
      </div>
      {/* Auditoría vivía aquí como subnav -- ahora es su propia sección
          en el rail (app/panel/auditoria), visible a Administrador y
          SuperAdmin sin pasar por Socios. */}

      {solicitudes.length === 0 ? (
        <div className="estado-vacio">
          <Users aria-hidden="true" strokeWidth={1.6} />
          <p>Todavía no hay solicitudes de socios.</p>
        </div>
      ) : (
        <div className="tabla-panel-envoltura">
        <table className="tabla-panel">
          <thead>
            <tr>
              <th>Nombre Completo</th>
              <th>Correo Electrónico</th>
              <th>Fecha Envío</th>
              <th>Estado Acreditación</th>
              <th>Atención / Requerimiento</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody>
            {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
            {solicitudes.map((s: any) => {
              const esActivo = s.nivelUrgencia === "activo_confirmado";
              const esUrgenteContrato = s.nivelUrgencia === "urgente_contrato";
              const esUrgentePropuesta = s.nivelUrgencia === "urgente_propuesta";
              const fondoFila = esActivo
                ? "rgba(236, 253, 245, 0.45)"
                : esUrgenteContrato
                ? "rgba(238, 242, 255, 0.65)"
                : esUrgentePropuesta
                ? "rgba(254, 243, 199, 0.35)"
                : undefined;

              return (
                <tr key={s.ssc_id} style={{ background: fondoFila }}>
                  <td>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <strong>{[s.usuario?.usu_nombres, s.usuario?.usu_apellidos].filter(Boolean).join(" ") || "—"}</strong>
                      {esUrgenteContrato && (
                        <span title="Contrato firmado cargado listo para contra-firma" style={{ fontSize: "0.7rem", background: "#5000BA", color: "#FFF", borderRadius: "999px", padding: "1px 7px", fontWeight: 800 }}>
                          POR CONTRA-FIRMAR
                        </span>
                      )}
                      {esUrgentePropuesta && (
                        <span title="Propuesta de modificación al contrato pendiente de revisión" style={{ fontSize: "0.7rem", background: "#D97706", color: "#FFF", borderRadius: "999px", padding: "1px 7px", fontWeight: 800 }}>
                          PROPUESTA
                        </span>
                      )}
                      {esActivo && (
                        <span title="Socio acreditado formalmente con contrato bi-firmado" style={{ fontSize: "0.7rem", background: "#05876E", color: "#FFF", borderRadius: "999px", padding: "1px 7px", fontWeight: 800 }}>
                          ACTIVO
                        </span>
                      )}
                    </div>
                  </td>
                  <td>{s.usuario?.usu_correo || "—"}</td>
                  <td>{new Date(s.ssc_enviada_en || s.ssc_creado_en).toLocaleDateString("es-EC")}</td>
                  <td>
                    <span className={`chip-estado-solicitud chip-${s.ssc_estado}`}>
                      {esActivo
                        ? "Acreditado y Activo"
                        : esUrgenteContrato
                        ? "Firma Abogado Recibida"
                        : ETIQUETA_ESTADO[s.ssc_estado] || s.ssc_estado}
                    </span>
                  </td>
                  <td>
                    {esActivo ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#ECFDF5",
                        color: "#065F46",
                        border: "1.5px solid #10B981",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                      }}>
                        Contrato Bi-firmado
                      </span>
                    ) : esUrgenteContrato ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#EEF2FF",
                        color: "#4338CA",
                        border: "1.5px solid #6366F1",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                        boxShadow: "0 1px 3px rgba(99, 102, 241, 0.2)",
                      }}>
                        Contrato Listo para Contra-firma
                      </span>
                    ) : esUrgentePropuesta ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#FEF3C7",
                        color: "#92400E",
                        border: "1.5px solid #F59E0B",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "0.76rem",
                        fontWeight: 800,
                      }}>
                        Propuesta Word ({s.propuestasPendientesCount})
                      </span>
                    ) : s.nivelUrgencia === "esperando_abogado" ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#F3F4F6",
                        color: "#4B5563",
                        border: "1px solid #D1D5DB",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "0.76rem",
                        fontWeight: 600,
                      }}>
                        Esperando Firma del Abogado
                      </span>
                    ) : s.nivelUrgencia === "pendiente_revision" ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        background: "#EFF6FF",
                        color: "#1E40AF",
                        border: "1px solid #93C5FD",
                        borderRadius: "8px",
                        padding: "4px 8px",
                        fontSize: "0.76rem",
                        fontWeight: 700,
                      }}>
                        ⏳ Postulación Inicial
                      </span>
                    ) : (
                      <span style={{ fontSize: "0.78rem", color: "#9CA3AF" }}>—</span>
                    )}
                  </td>
                  <td>
                    <Link
                      href={`/panel/socios/${s.ssc_id}`}
                      className="btn-mini"
                      style={{
                        textDecoration: "none",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        background: esUrgenteContrato ? "#5000BA" : esUrgentePropuesta ? "#D97706" : undefined,
                        color: esUrgenteContrato || esUrgentePropuesta ? "#FFFFFF" : undefined,
                        fontWeight: esUrgenteContrato || esUrgentePropuesta ? 800 : undefined,
                        boxShadow: esUrgenteContrato ? "0 2px 6px rgba(80, 0, 186, 0.25)" : undefined,
                      }}
                    >
                      {esActivo
                        ? "Ver Expediente"
                        : esUrgenteContrato
                        ? "Contra-firmar y Activar"
                        : esUrgentePropuesta
                        ? "Revisar Propuesta"
                        : "Evaluar"}
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
