import type { Metadata } from "next";
import { buscarUsuariosTranqi } from "@/modulos/gestion-usuarios/consultas";
import { FilaUsuario } from "@/modulos/gestion-usuarios/componentes/FilaUsuario";

export const metadata: Metadata = { title: "Gestión de usuarios — tranqi" };

export default async function PaginaGestionUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const { data: usuarios, error } = await buscarUsuariosTranqi(q);

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
            <th>Rol</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {usuarios.map((u) => (
            <FilaUsuario key={u.usu_id} usuario={u} />
          ))}
          {usuarios.length === 0 && (
            <tr>
              <td colSpan={5}>Sin resultados.</td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
