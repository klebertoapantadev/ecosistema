import type { Metadata } from "next";
import Link from "next/link";
import { listarSolicitudes } from "../../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Solicitudes de socios — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Enviada",
  en_revision: "En revisión",
  aceptada: "Aceptada",
  rechazada: "Rechazada",
};

export default async function PaginaSolicitudesSocios() {
  const solicitudes = await listarSolicitudes();

  return (
    <div>
      <h1>Solicitudes de socios</h1>
      <nav className="subnav-socios">
        <Link href="/panel/socios">Socios</Link>
        <span className="subnav-activo">Solicitudes</span>
      </nav>

      {solicitudes.length === 0 ? (
        <p>Todavía no hay solicitudes.</p>
      ) : (
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
                  <Link href={`/panel/socios/solicitudes/${s.ssc_id}`} className="btn-mini">
                    Revisar
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
