import type { Metadata } from "next";
import Link from "next/link";
import { X, UserCog } from "lucide-react";
import { buscarUsuarios, obtenerPerfilesAsignables, FilaUsuario } from "@eco/gestion-usuarios";
import { obtenerNivelMaximo } from "@eco/identidad";

export const metadata: Metadata = { title: "Gestión de usuarios — tranqi" };

const NEGOCIO = "tranqi";

export default async function PaginaGestionUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q = "" } = await searchParams;
  const [{ data: usuarios, error }, perfiles, nivelMaximoGestor] = await Promise.all([
    buscarUsuarios(q, NEGOCIO),
    obtenerPerfilesAsignables(),
    obtenerNivelMaximo(NEGOCIO),
  ]);

  return (
    <div style={{ width: "100%" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <UserCog size={22} color="var(--violeta, #5000BA)" />
          <h1 style={{ margin: 0, fontSize: "1.35rem" }}>Gestión de Usuarios & Membresías</h1>
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
            <th>Perfiles</th>
            <th>Acción</th>
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
    </div>
  );
}
