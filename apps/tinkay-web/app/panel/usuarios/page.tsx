import type { Metadata } from "next";
import { buscarUsuarios, obtenerPerfilesAsignables, FilaUsuario } from "@eco/gestion-usuarios";
import { obtenerNivelMaximo } from "@eco/identidad";

export const metadata: Metadata = { title: "Gestión de usuarios — tinkay" };

const NEGOCIO = "tinkay";


export default async function PaginaGestionUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  // El catálogo de perfiles y el techo del gestor salen de la base, no de una
  // lista fija en código: PLT-003 regla 4 los estandariza a nivel plataforma.
  const [{ data: usuarios, error }, perfiles, nivelMaximoGestor] = await Promise.all([
    buscarUsuarios(q, NEGOCIO),
    obtenerPerfilesAsignables(),
    obtenerNivelMaximo(NEGOCIO),
  ]);

  return (
    <div>
      <h1>Gestión de usuarios</h1>
      <form method="GET" className="form-busqueda">
        <input type="search" name="q" defaultValue={q} placeholder="Buscar por nombre o correo…" />
        <button type="submit" className="btn-mini">Buscar</button>
      </form>

      {error && <p className="error-auth">{error}</p>}

      <table className="tabla-panel">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Correo</th>
            <th>Estado</th>
            <th>Perfiles</th>
            </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <FilaUsuario
              key={u.usu_id}
              usuario={u}
              negocio={NEGOCIO}
              perfiles={perfiles}
              nivelMaximoGestor={nivelMaximoGestor}
            />
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={4}>Sin resultados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
