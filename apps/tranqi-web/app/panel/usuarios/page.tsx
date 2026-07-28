import type { Metadata } from "next";
import { buscarUsuarios, FilaUsuario } from "@eco/gestion-usuarios";

export const metadata: Metadata = { title: "Gestión de usuarios — tranqi" };

const NEGOCIO = "tranqi";
const ROLES = ["CLIENTE", "ADMINISTRADOR", "ABOGADO"];

export default async function PaginaGestionUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { data: usuarios, error } = await buscarUsuarios(q, NEGOCIO);

  return (
    <div>
      <h1>Gestión de usuarios</h1>
      <form method="GET" className="form-busqueda">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre o correo…" />
        <button type="submit" className="btn-mini">Buscar</button>
      </form>

      {error && <p className="error-auth">{error}</p>}

      <div className="tabla-panel-envoltura">
      <table className="tabla-panel">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Estado</th>
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <FilaUsuario key={u.usu_id} usuario={u} negocio={NEGOCIO} roles={ROLES} />
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={5}>Sin resultados.</td>
            </tr>
          )}
        </tbody>
      </table>
      </div>
    </div>
  );
}
