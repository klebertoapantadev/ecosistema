import type { Metadata } from "next";
import Link from "next/link";
import { listarSocios } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Socios — tranqi" };

export default async function PaginaSocios() {
  const socios = await listarSocios();

  return (
    <div>
      <h1>Socios</h1>
      <nav className="subnav-socios">
        <span className="subnav-activo">Socios</span>
        <Link href="/panel/socios/solicitudes">Solicitudes</Link>
      </nav>

      {socios.length === 0 ? (
        <p>Todavía no hay socios verificados.</p>
      ) : (
        <table className="tabla-panel">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Correo</th>
              <th>Verificado desde</th>
              <th>Estado</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {socios.map((s) => (
              <tr key={s.abg_id}>
                <td>{[s.usuario?.usu_nombres, s.usuario?.usu_apellidos].filter(Boolean).join(" ") || "—"}</td>
                <td>{s.usuario?.usu_correo}</td>
                <td>{new Date(s.abg_verificado_en).toLocaleDateString("es-EC")}</td>
                <td>{s.abg_estado}</td>
                <td>
                  <Link href={`/panel/socios/${s.abg_id}`} className="btn-mini">
                    Ver
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
