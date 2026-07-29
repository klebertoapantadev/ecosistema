import type { Metadata } from "next";
import { listarAuditoria } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Auditoría — tranqi" };

const ETIQUETA_OPERACION: Record<string, string> = { INSERT: "Creado", UPDATE: "Modificado", DELETE: "Eliminado" };

export default async function PaginaAuditoria() {
  const registros = await listarAuditoria();

  return (
    <div>
      <h1>Auditoría</h1>
      <p className="historial-fecha">
        Cambios en las tablas de tranqi (`tranqui_legal`), más recientes primero. Visible para Administrador y SuperAdmin.
      </p>

      {registros.length === 0 ? (
        <p>Sin registros de auditoría todavía.</p>
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
