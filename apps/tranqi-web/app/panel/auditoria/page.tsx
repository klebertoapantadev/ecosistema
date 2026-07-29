import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { listarAuditoria } from "../../../modulos/socios/consultas";

export const metadata: Metadata = { title: "Auditoría — tranqi" };

const ETIQUETA_OPERACION: Record<string, string> = { INSERT: "Creado", UPDATE: "Modificado", DELETE: "Eliminado" };

// PK real de cada tabla de tranqui_legal -- no se puede inferir del orden
// de claves de un jsonb (Postgres no garantiza preservar el orden de
// columnas al pasar por el tipo jsonb), así que se declara explícito.
const PK_POR_TABLA: Record<string, string> = {
  trq_abogado: "abg_id",
  trq_documento_socio: "dcs_id",
  trq_experiencia_laboral: "exp_id",
  trq_materia: "mat_id",
  trq_revision_solicitud: "rev_id",
  trq_solicitud_materia: "sma_id",
  trq_solicitud_provincia: "spr_id",
  trq_solicitud_socio: "ssc_id",
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
};

// *_creado_en/*_actualizado_en cambian en casi todo UPDATE y no aportan
// nada que la columna Fecha ya no diga -- se omiten del diff para que lo
// que sí importa (el campo de negocio que cambió) no quede enterrado.
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

// INSERT/DELETE no tienen "antes y después" que comparar -- se muestra el
// registro completo (menos la PK, ya visible aparte, y los timestamps de
// auditoría, redundantes con la columna Fecha).
function camposDelRegistro(datos: Record<string, unknown> | null, pk: string | undefined): Diferencia[] {
  if (!datos) return [];
  return Object.entries(datos)
    .filter(([campo]) => campo !== pk && !SUFIJOS_OMITIDOS.has(sufijoCampo(campo)))
    .map(([campo, valor]) => ({ campo, antes: "", despues: formatearValor(valor) }));
}

export default async function PaginaAuditoria() {
  const registros = await listarAuditoria();

  return (
    <div>
      <h1>Auditoría</h1>
      <p className="historial-fecha">
        Cambios en las tablas de tranqi (`tranqui_legal`), más recientes primero. Visible para Administrador y SuperAdmin.
      </p>

      {registros.length === 0 ? (
        <div className="estado-vacio">
          <ShieldCheck aria-hidden="true" strokeWidth={1.6} />
          <p>Sin registros de auditoría todavía.</p>
        </div>
      ) : (
        <ul className="lista-auditoria">
          {registros.map((r) => {
            const pk = PK_POR_TABLA[r.reg_tabla];
            const idRegistro = pk
              ? ((r.reg_datos_nuevos as Record<string, unknown> | null)?.[pk] ??
                (r.reg_datos_anteriores as Record<string, unknown> | null)?.[pk])
              : null;
            const cambios =
              r.reg_operacion === "UPDATE"
                ? calcularDiferencias(
                    r.reg_datos_anteriores as Record<string, unknown> | null,
                    r.reg_datos_nuevos as Record<string, unknown> | null,
                  )
                : camposDelRegistro(
                    (r.reg_operacion === "DELETE" ? r.reg_datos_anteriores : r.reg_datos_nuevos) as Record<
                      string,
                      unknown
                    > | null,
                    pk,
                  );

            return (
              <li key={r.reg_id} className="fila-auditoria">
                <details>
                  <summary>
                    <span className="historial-fecha">{new Date(r.reg_creado_en).toLocaleString("es-EC")}</span>
                    <span className={`chip-operacion chip-operacion-${r.reg_operacion}`}>
                      {ETIQUETA_OPERACION[r.reg_operacion] ?? r.reg_operacion}
                    </span>
                    <strong>{ETIQUETA_TABLA[r.reg_tabla] ?? r.reg_tabla}</strong>
                    {typeof idRegistro === "string" && <code className="id-registro">{idRegistro.slice(0, 8)}</code>}
                    <span className="historial-fecha">
                      {r.usuario
                        ? [r.usuario.usu_nombres, r.usuario.usu_apellidos].filter(Boolean).join(" ") || r.usuario.usu_correo
                        : "—"}
                    </span>
                  </summary>
                  {cambios.length === 0 ? (
                    <p className="historial-fecha">Sin cambios de campos registrados.</p>
                  ) : (
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
                  )}
                </details>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
