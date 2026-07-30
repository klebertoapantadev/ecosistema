import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { listarAuditoriaNegocio } from "@eco/auditoria";
import { TablaAuditoria, ETIQUETA_TABLA, ETIQUETA_OPERACION_EXPORT as ETIQUETA_OPERACION } from "./TablaAuditoria";

export const metadata: Metadata = { title: "Auditoría — tranqi" };

const NEGOCIO = "tranqi";
const ESQUEMA_NEGOCIO = "tranqui_legal";

export default async function PaginaAuditoria({
  searchParams,
}: {
  searchParams: Promise<{ desde?: string; hasta?: string; tabla?: string; operacion?: string; correo?: string }>;
}) {
  const { desde = "", hasta = "", tabla = "", operacion = "", correo = "" } = await searchParams;

  const { data: registros, error } = await listarAuditoriaNegocio(NEGOCIO, ESQUEMA_NEGOCIO, {
    desde: desde || undefined,
    hasta: hasta || undefined,
    tabla: tabla || undefined,
    operacion: operacion || undefined,
    correoActor: correo || undefined,
  });

  return (
    <div>
      <h1>Auditoría</h1>
      <p className="historial-fecha">
        Cambios en las tablas de tranqi (`tranqui_legal`) y eventos de identidad de sus usuarios (registro,
        verificación de correo, recuperación de contraseña). Visible para Administrador y SuperAdmin.
      </p>

      <form method="GET" className="form-filtros-auditoria">
        <label>
          Desde
          <input type="date" name="desde" defaultValue={desde} />
        </label>
        <label>
          Hasta
          <input type="date" name="hasta" defaultValue={hasta} />
        </label>
        <label>
          Tabla
          <select name="tabla" defaultValue={tabla}>
            <option value="">Todas</option>
            {Object.entries(ETIQUETA_TABLA).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          Operación
          <select name="operacion" defaultValue={operacion}>
            <option value="">Todas</option>
            {Object.entries(ETIQUETA_OPERACION).map(([clave, etiqueta]) => (
              <option key={clave} value={clave}>
                {etiqueta}
              </option>
            ))}
          </select>
        </label>
        <label>
          Correo del usuario
          <input type="text" name="correo" defaultValue={correo} placeholder="correo@ejemplo.com" />
        </label>
        <button type="submit" className="btn-mini">
          Filtrar
        </button>
      </form>

      {error && <p className="error-auth">{error}</p>}

      {registros.length === 0 ? (
        <div className="estado-vacio">
          <ShieldCheck aria-hidden="true" strokeWidth={1.6} />
          <p>Sin registros de auditoría para estos filtros.</p>
        </div>
      ) : (
        <TablaAuditoria registros={registros} />
      )}
    </div>
  );
}
