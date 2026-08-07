import type { Metadata } from "next";
import Link from "next/link";
import { ShieldCheck, X } from "lucide-react";
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
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      {/* Banner de Cabecera con Botón Circular de Cierre (X) */}
      <div
        className="tarjeta-proteccion tarjeta-admin"
        style={{
          marginBottom: "20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "20px 24px",
          borderRadius: "16px",
          position: "relative"
        }}
      >
        <div>
          <div className="eyebrow-cliente">Gobernanza & Seguridad</div>
          <div className="tarjeta-proteccion-plan" style={{ fontSize: "1.3rem", fontWeight: 800 }}>
            Bitácora de Auditoría del Sistema <i>({NEGOCIO})</i>
          </div>
          <div className="tarjeta-proteccion-meta" style={{ marginTop: "4px" }}>
            Registro inmutable auditado por disparadores PostgreSQL (`tranqui_legal` y `comun_seguridad`).
          </div>
        </div>

        {/* Botón Circular de Cierre (X) */}
        <Link
          href="/panel/administrar"
          title="Cerrar vista de auditoría y regresar al panel de administración"
          style={{
            background: "#ffffff",
            border: "1.5px solid #E4E4E4",
            color: "#111111",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            cursor: "pointer",
            boxShadow: "0 1px 3px rgba(0,0,0,0.06)",
            flexShrink: 0,
            textDecoration: "none"
          }}
        >
          <X size={18} />
        </Link>
      </div>

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
