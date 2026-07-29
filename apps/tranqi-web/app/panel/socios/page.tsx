import type { Metadata } from "next";
import Link from "next/link";
import { Users } from "lucide-react";
import { listarSolicitudes } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Socios — tranqi" };

// Un socio existe desde que envia la solicitud -- no solo desde que se
// acepta. Antes "Socios" y "Solicitudes" eran pestañas separadas y una
// solicitud recien enviada no aparecia en ningun lado obvio; ahora es una
// sola lista con estado visible.
const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Pendiente aprobación",
  en_revision: "En revisión",
  aceptada: "Aprobado",
  rechazada: "Rechazado",
};

export default async function PaginaSocios() {
  const solicitudes = await listarSolicitudes();

  return (
    <div>
      <h1>Socios</h1>
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
