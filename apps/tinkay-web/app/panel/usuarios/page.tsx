import type { Metadata } from "next";
import { redirect } from "next/navigation";
import {
  buscarUsuarios,
  obtenerPerfilesAsignables,
  obtenerInvitacionesEquipoAction,
  FilaUsuario,
  FormularioInvitacionEquipo,
} from "@eco/gestion-usuarios";
import { obtenerContextoAccesoTinkay } from "../acceso-tinkay";

export const metadata: Metadata = { title: "Usuarios, Invitaciones y Roles — Tinkay Floristería" };
export const dynamic = "force-dynamic";

const NEGOCIO = "tinkay";

export default async function PaginaGestionUsuarios({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const ctx = await obtenerContextoAccesoTinkay();
  if (!ctx.clavesAutorizadas.has("gestion_usuarios")) {
    redirect("/panel");
  }

  const { q = "" } = await searchParams;
  const [{ data: usuarios, error }, perfiles, resInv] = await Promise.all([
    buscarUsuarios(q, NEGOCIO),
    obtenerPerfilesAsignables(NEGOCIO),
    obtenerInvitacionesEquipoAction(NEGOCIO),
  ]);

  const nivelMaximoGestor = ctx.esSuperAdmin ? 100 : ctx.esAdminTienda ? 80 : 10;
  const invitaciones = resInv.ok ? resInv.invitaciones : [];

  return (
    <div style={{ maxWidth: "1140px", margin: "0 auto" }}>
      <div style={{ marginBottom: 20 }}>
        <h1 style={{ fontSize: "22px", fontWeight: 700, margin: "0 0 6px 0", color: "#1C261F" }}>
          Gestión de Equipo, Invitaciones y Roles
        </h1>
        <p style={{ margin: 0, fontSize: "13.5px", color: "#6B746C", lineHeight: 1.5 }}>
          Envía invitaciones por correo electrónico definiendo el rol en el portal (<strong>Ventas</strong>, <strong>Taller Floral</strong>, <strong>Delivery Interno</strong>, <strong>Delivery Subcontratado</strong>, <strong>Operador</strong> o <strong>Administrador</strong>). Al instalar una única App en su celular, cada perfil ingresa directamente a las pantallas de su rol.
        </p>
      </div>

      <FormularioInvitacionEquipo
        negocio={NEGOCIO}
        invitacionesIniciales={invitaciones}
      />

      <section
        style={{
          background: "#FFFFFF",
          border: "1px solid #E5DFD5",
          borderRadius: 16,
          padding: "clamp(14px, 3.5vw, 24px)",
          boxShadow: "0 4px 18px rgba(28, 38, 31, 0.04)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            flexWrap: "wrap",
            gap: 12,
            marginBottom: 16,
          }}
        >
          <h2 style={{ margin: 0, fontSize: "1.05rem", fontWeight: 700, color: "#1C261F" }}>
            Usuarios Registrados en Tinkay ({usuarios.length})
          </h2>
          <form method="GET" className="form-busqueda" style={{ margin: 0 }}>
            <input
              type="search"
              name="q"
              defaultValue={q}
              placeholder="Buscar por nombre o correo…"
            />
            <button
              type="submit"
              className="btn-mini"
              title="Buscar usuario por nombre o correo"
              aria-label="Buscar"
            >
              Buscar
            </button>
          </form>
        </div>

        {error && <p className="error-auth">{error}</p>}

        <div className="tabla-panel-envoltura">
          <table className="tabla-panel">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Correo</th>
                <th>Estado</th>
                <th>Roles en el Portal</th>
                <th style={{ textAlign: "center" }}>Acciones</th>
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
                  <td colSpan={5}>Sin usuarios encontrados para esta búsqueda.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}
