import type { Metadata } from "next";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import {
  listarErroresSueltos,
  listarResumenTrazas,
  listarTrazasDeCorrelacion,
  type FilaTraza,
} from "@eco/auditoria/consultas-trazas";

export const metadata: Metadata = { title: "Trazas — tranqi" };
export const dynamic = "force-dynamic";

// Trazas de flujos (TRQ-040): qué pagos PLUX se quedaron a medias y en qué
// paso. Solo el superadmin de plataforma ve filas (RLS de aud_traza).

const NEGOCIO = "tranqi";

const COLOR_NIVEL: Record<string, string> = { INFO: "#2f7d4f", AVISO: "#a86a00", ERROR: "#b42318" };

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "medium" });
}

function Nivel({ nivel }: { nivel: string }) {
  return <strong style={{ color: COLOR_NIVEL[nivel] ?? "inherit" }}>{nivel}</strong>;
}

function TablaPasos({ filas }: { filas: FilaTraza[] }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tabla-trazas" style={{ width: "100%", fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Origen</th>
            <th>Paso</th>
            <th>Nivel</th>
            <th>ms</th>
            <th>Mensaje</th>
            <th>Detalle</th>
          </tr>
        </thead>
        <tbody>
          {filas.map((f) => (
            <tr key={f.tra_id}>
              <td style={{ whiteSpace: "nowrap" }}>{fecha(f.tra_creado_en)}</td>
              <td>{f.tra_origen}</td>
              <td>
                <code>{f.tra_paso}</code>
              </td>
              <td>
                <Nivel nivel={f.tra_nivel} />
              </td>
              <td>{f.tra_duracion_ms ?? ""}</td>
              <td>{f.tra_mensaje ?? ""}</td>
              <td>
                <details>
                  <summary>ver</summary>
                  <pre style={{ whiteSpace: "pre-wrap", maxWidth: 480, fontSize: "0.75rem" }}>
                    {JSON.stringify(f.tra_detalle_traza, null, 2)}
                  </pre>
                </details>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default async function PaginaTrazas({
  searchParams,
}: {
  searchParams: Promise<{ c?: string; problemas?: string; desde?: string }>;
}) {
  const { c = "", problemas = "", desde = "" } = await searchParams;

  const [resumen, sueltos, detalle] = await Promise.all([
    listarResumenTrazas({ negocio: NEGOCIO, flujo: "PAGO_PLUX", desde: desde || undefined, soloProblemas: problemas === "1" }),
    listarErroresSueltos({ negocio: NEGOCIO, flujo: "PAGO_PLUX" }),
    c ? listarTrazasDeCorrelacion(c) : Promise.resolve({ data: [] as FilaTraza[], error: null }),
  ]);
  const error = resumen.error || sueltos.error || detalle.error;

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div
        className="tarjeta-proteccion tarjeta-admin"
        style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderRadius: "16px" }}
      >
        <div>
          <div className="tarjeta-proteccion-plan" style={{ fontSize: "1.3rem", fontWeight: 800 }}>
            Trazas de pagos PLUX
          </div>
          <div className="tarjeta-proteccion-meta" style={{ marginTop: "4px" }}>
            Cada intento de pago y el último paso al que llegó (navegador, servidor y webhook).
          </div>
        </div>
        <Link
          href="/panel/auditoria"
          title="Volver a auditoría"
          style={{
            background: "#ffffff",
            border: "1.5px solid var(--linea)",
            color: "#111111",
            borderRadius: "50%",
            width: "36px",
            height: "36px",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            flexShrink: 0,
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
          Mostrar
          <select name="problemas" defaultValue={problemas}>
            <option value="">Todos los intentos</option>
            <option value="1">Solo los que acabaron en aviso o error</option>
          </select>
        </label>
        <button type="submit" className="btn-mini">
          Filtrar
        </button>
      </form>

      {error && <p className="error-auth">{error}</p>}

      {c && (
        <section style={{ marginBottom: 24 }}>
          <h2 style={{ fontSize: "1.05rem" }}>
            Pasos de <code>{c}</code>
          </h2>
          {detalle.data.length === 0 ? <p>Sin trazas para este identificador.</p> : <TablaPasos filas={detalle.data} />}
        </section>
      )}

      {resumen.data.length === 0 ? (
        <div className="estado-vacio">
          <Activity aria-hidden="true" strokeWidth={1.6} />
          <p>Sin intentos de pago registrados para estos filtros.</p>
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table className="tabla-trazas" style={{ width: "100%", fontSize: "0.85rem" }}>
            <thead>
              <tr>
                <th>Último paso</th>
                <th>Identificador</th>
                <th>Inicio</th>
                <th>Duración</th>
                <th>Pasos</th>
                <th>Errores</th>
                <th>Estado final</th>
                <th>Último problema</th>
              </tr>
            </thead>
            <tbody>
              {resumen.data.map((r) => (
                <tr key={r.tra_correlacion}>
                  <td style={{ whiteSpace: "nowrap" }}>{fecha(r.fin)}</td>
                  <td>
                    <Link href={`?${new URLSearchParams({ c: r.tra_correlacion, ...(desde ? { desde } : {}), ...(problemas ? { problemas } : {}) })}`}>
                      <code>{r.tra_correlacion}</code>
                    </Link>
                  </td>
                  <td style={{ whiteSpace: "nowrap" }}>{fecha(r.inicio)}</td>
                  <td>{Math.round((new Date(r.fin).getTime() - new Date(r.inicio).getTime()) / 1000)} s</td>
                  <td>{r.pasos}</td>
                  <td>{r.errores}</td>
                  <td>
                    <code>{r.ultimo_paso}</code> <Nivel nivel={r.ultimo_nivel} />
                  </td>
                  <td>{r.ultimo_problema ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {sueltos.data.length > 0 && (
        <section style={{ marginTop: 24 }}>
          <h2 style={{ fontSize: "1.05rem" }}>Errores sin identificador de pago</h2>
          <p className="tarjeta-proteccion-meta">Fallos antes de crear el pago o webhooks rechazados antes de leer el cuerpo.</p>
          <TablaPasos filas={sueltos.data} />
        </section>
      )}
    </div>
  );
}
