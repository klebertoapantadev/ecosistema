import type { Metadata } from "next";
import Link from "next/link";
import { listarAuditoria } from "../../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Auditoría de socios — tranqi" };

const ETIQUETA_OPERACION: Record<string, string> = { INSERT: "Creado", UPDATE: "Modificado", DELETE: "Eliminado" };

export default async function PaginaAuditoria() {
  const registros = await listarAuditoria();

  return (
    <div>
      <h1>Auditoría</h1>
      <nav className="subnav-socios">
        <Link href="/panel/socios">Socios</Link>
        <span className="subnav-activo">Auditoría</span>
      </nav>
      <p className="historial-fecha">
        Solo visible para SuperAdmin de plataforma. Cambios en las tablas de socios (`tranqui_legal`), más recientes primero.
      </p>

      {registros.length === 0 ? (
        <p>Sin registros de auditoría todavía — o tu cuenta no es SuperAdmin.</p>
      ) : (
        <div className="tabla-panel-envoltura">
        <table className="tabla-panel">
          <thead>
            <tr>
              <th>Fecha</th>
              <th>Tabla</th>
              <th>Operación</th>
              <th>Usuario</th>
            </tr>
          </thead>
          <tbody>
            {registros.map((r) => (
              <tr key={r.reg_id}>
                <td>{new Date(r.reg_creado_en).toLocaleString("es-EC")}</td>
                <td>{r.reg_tabla}</td>
                <td>{ETIQUETA_OPERACION[r.reg_operacion] ?? r.reg_operacion}</td>
                <td>
                  {r.usuario
                    ? [r.usuario.usu_nombres, r.usuario.usu_apellidos].filter(Boolean).join(" ") || r.usuario.usu_correo
                    : "—"}
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
