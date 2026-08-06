import type { Metadata } from "next";
import Link from "next/link";
import { Users, X } from "lucide-react";
import { listarSolicitudes } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Socios — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Pendiente aprobación",
  en_revision: "En revisión",
  aceptada: "Aprobado",
  rechazada: "Rechazado",
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
              <th>Nombre</th>
              <th>Correo</th>
              <th>Enviada</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {solicitudes.map((s) => (
              <tr key={s.ssc_id}>
                <td>{[s.usuario?.usu_nombres, s.usuario?.usu_apellidos].filter(Boolean).join(" ") || "—"}</td>
                <td>{s.usuario?.usu_correo}</td>
                <td>{new Date(s.ssc_enviada_en).toLocaleDateString("es-EC")}</td>
                <td>
                  <span className={`chip-estado-solicitud chip-${s.ssc_estado}`}>{ETIQUETA_ESTADO[s.ssc_estado]}</span>
                </td>
                <td>
                  <Link href={`/panel/socios/${s.ssc_id}`} className="btn-mini">
                    Ver
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      )}
    </div>
  );
}
