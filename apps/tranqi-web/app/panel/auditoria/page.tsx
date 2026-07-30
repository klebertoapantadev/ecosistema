import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { listarAuditoriaNegocio, type RegistroAuditoria } from "@eco/auditoria";
import { DataGrid, type ColumnaDataGrid } from "@eco/datagrid";

export const metadata: Metadata = { title: "Auditoría — tranqi" };

const NEGOCIO = "tranqi";
const ESQUEMA_NEGOCIO = "tranqui_legal";

const ETIQUETA_OPERACION: Record<string, string> = { INSERT: "Creado", UPDATE: "Modificado", DELETE: "Eliminado" };

// PK real de cada tabla -- no se puede inferir del orden de claves de un
// jsonb (Postgres no garantiza preservar el orden de columnas al pasar por
// el tipo jsonb), asi que se declara explicito. Incluye tranqui_legal (el
// negocio) y comun_seguridad (identidad de plataforma, acotada a miembros
// de este negocio por aud_fn_listar_auditoria_negocio en el servidor).
const PK_POR_TABLA: Record<string, string> = {
  trq_abogado: "abg_id",
  trq_documento_socio: "dcs_id",
  trq_experiencia_laboral: "exp_id",
  trq_materia: "mat_id",
  trq_revision_solicitud: "rev_id",
  trq_solicitud_materia: "sma_id",
  trq_solicitud_provincia: "spr_id",
  trq_solicitud_socio: "ssc_id",
  seg_usuario: "usu_id",
  seg_membresia: "mem_id",
  seg_otp_correo: "otp_id",
  seg_recuperacion_correo: "rec_id",
};

const ETIQUETA_TABLA: Record<string, string> = {
  trq_abogado: "Abogado",
  trq_documento_socio: "Documento de socio",
  trq_experiencia_laboral: "Experiencia laboral",
  trq_materia: "Materia",
  trq_revision_solicitud: "Revisión de solicitud",
  trq_solicitud_materia: "Solicitud × materia",
  trq_solicitud_provincia: "Solicitud × provincia",
  trq_solicitud_socio: "Solicitud de socio",
  seg_usuario: "Cuenta de usuario",
  seg_membresia: "Membresía",
  seg_otp_correo: "Verificación de correo (OTP)",
  seg_recuperacion_correo: "Recuperación de contraseña",
};

const SUFIJOS_OMITIDOS = new Set(["creado_en", "actualizado_en"]);

function sufijoCampo(campo: string) {
  const i = campo.indexOf("_");
  return i === -1 ? campo : campo.slice(i + 1);
}

function formatearValor(v: unknown): string {
  if (v === null || v === undefined || v === "") return "—";
  if (typeof v === "boolean") return v ? "Sí" : "No";
  if (typeof v === "string" && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(v)) return new Date(v).toLocaleString("es-EC");
  const texto = String(v);
  return texto.length > 90 ? `${texto.slice(0, 90)}…` : texto;
}

type Diferencia = { campo: string; antes: string; despues: string };

function calcularDiferencias(
  anteriores: Record<string, unknown> | null,
  nuevos: Record<string, unknown> | null,
): Diferencia[] {
  if (!anteriores || !nuevos) return [];
  const campos = new Set([...Object.keys(anteriores), ...Object.keys(nuevos)]);
  const diferencias: Diferencia[] = [];
  for (const campo of campos) {
    if (SUFIJOS_OMITIDOS.has(sufijoCampo(campo))) continue;
    const antes = anteriores[campo];
    const despues = nuevos[campo];
    if (JSON.stringify(antes) === JSON.stringify(despues)) continue;
    diferencias.push({ campo, antes: formatearValor(antes), despues: formatearValor(despues) });
  }
  return diferencias;
}

function camposDelRegistro(datos: Record<string, unknown> | null, pk: string | undefined): Diferencia[] {
  if (!datos) return [];
  return Object.entries(datos)
    .filter(([campo]) => campo !== pk && !SUFIJOS_OMITIDOS.has(sufijoCampo(campo)))
    .map(([campo, valor]) => ({ campo, antes: "", despues: formatearValor(valor) }));
}

function idCorto(registro: RegistroAuditoria): string {
  const pk = PK_POR_TABLA[registro.reg_tabla];
  const id = pk ? ((registro.reg_datos_nuevos?.[pk] ?? registro.reg_datos_anteriores?.[pk]) as string | undefined) : undefined;
  return typeof id === "string" ? id.slice(0, 8) : "—";
}

function nombreActor(registro: RegistroAuditoria): string {
  const nombre = [registro.actor_nombres, registro.actor_apellidos].filter(Boolean).join(" ");
  return nombre || registro.actor_correo || "—";
}

const COLUMNAS: ColumnaDataGrid<RegistroAuditoria>[] = [
  {
    id: "fecha",
    encabezado: "Fecha",
    valor: (r) => new Date(r.reg_creado_en).getTime(),
    render: (r) => new Date(r.reg_creado_en).toLocaleString("es-EC"),
  },
  {
    id: "tabla",
    encabezado: "Tabla",
    valor: (r) => ETIQUETA_TABLA[r.reg_tabla] ?? r.reg_tabla,
  },
  {
    id: "operacion",
    encabezado: "Operación",
    valor: (r) => ETIQUETA_OPERACION[r.reg_operacion] ?? r.reg_operacion,
    render: (r) => (
      <span className={`chip-operacion chip-operacion-${r.reg_operacion}`}>
        {ETIQUETA_OPERACION[r.reg_operacion] ?? r.reg_operacion}
      </span>
    ),
  },
  { id: "registro", encabezado: "Registro", valor: idCorto, render: (r) => <code className="id-registro">{idCorto(r)}</code> },
  { id: "usuario", encabezado: "Usuario", valor: nombreActor },
];

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
        <DataGrid
          columnas={COLUMNAS}
          filas={registros}
          idFila={(r) => r.reg_id}
          nombreExportacion="auditoria-tranqi"
          contenidoExpandible={(r) => {
            const pk = PK_POR_TABLA[r.reg_tabla];
            const cambios =
              r.reg_operacion === "UPDATE"
                ? calcularDiferencias(r.reg_datos_anteriores, r.reg_datos_nuevos)
                : camposDelRegistro(r.reg_operacion === "DELETE" ? r.reg_datos_anteriores : r.reg_datos_nuevos, pk);

            if (cambios.length === 0) return <p className="historial-fecha">Sin cambios de campos registrados.</p>;

            return (
              <dl className="diferencias-auditoria">
                {cambios.map((c) => (
                  <div key={c.campo}>
                    <dt>{c.campo}</dt>
                    <dd>
                      {c.antes && (
                        <>
                          <s>{c.antes}</s> →{" "}
                        </>
                      )}
                      {c.despues}
                    </dd>
                  </div>
                ))}
              </dl>
            );
          }}
        />
      )}
    </div>
  );
}
