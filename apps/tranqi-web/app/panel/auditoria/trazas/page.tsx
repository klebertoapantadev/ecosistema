import type { Metadata } from "next";
import Link from "next/link";
import { Activity, X } from "lucide-react";
import {
  listarErroresSueltos,
  listarFrecuenciaTrazas,
  listarResumenTrazas,
  listarTrazasDeCorrelacion,
  listarUltimasTrazas,
  type FilaTraza,
} from "@eco/auditoria/consultas-trazas";

export const metadata: Metadata = { title: "Trazas — tranqi" };
export const dynamic = "force-dynamic";

// Trazas (TRQ-040): qué falla en el panel (excepciones del servidor, llamadas
// a Supabase con error o lentas, errores JS del navegador) y dónde se quedan
// los pagos PLUX. Solo el superadmin de plataforma ve filas (RLS de aud_traza).

const NEGOCIO = "tranqi";

const COLOR_NIVEL: Record<string, string> = { INFO: "#2f7d4f", AVISO: "#a86a00", ERROR: "#b42318" };

type Pestana = "panel" | "pagos";

function fecha(iso: string) {
  return new Date(iso).toLocaleString("es-EC", { timeZone: "America/Guayaquil", dateStyle: "short", timeStyle: "medium" });
}

function enlace(params: Record<string, string>) {
  const limpios = Object.fromEntries(Object.entries(params).filter(([, v]) => v));
  return `?${new URLSearchParams(limpios)}`;
}

function Nivel({ nivel }: { nivel: string }) {
  return <strong style={{ color: COLOR_NIVEL[nivel] ?? "inherit" }}>{nivel}</strong>;
}

function rutaDe(f: FilaTraza): string {
  const d = f.tra_detalle_traza as Record<string, unknown>;
  return typeof d?.ruta === "string" ? d.ruta : "";
}

function TablaPasos({ filas, conRuta = false }: { filas: FilaTraza[]; conRuta?: boolean }) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table className="tabla-trazas" style={{ width: "100%", fontSize: "0.85rem" }}>
        <thead>
          <tr>
            <th>Hora</th>
            <th>Origen</th>
            {conRuta && <th>Ruta</th>}
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
              {conRuta && (
                <td>
                  <code>{rutaDe(f)}</code>
                </td>
              )}
              <td>
                <code>{f.tra_paso}</code>
              </td>
              <td>
                <Nivel nivel={f.tra_nivel} />
              </td>
              <td>{f.tra_duracion_ms ?? ""}</td>
              <td style={{ wordBreak: "break-word" }}>{f.tra_mensaje ?? ""}</td>
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

async function VistaPanel({ desde, problemas }: { desde: string; problemas: string }) {
  const [frecuentes, ultimas] = await Promise.all([
    listarFrecuenciaTrazas({ negocio: NEGOCIO, flujo: "PANEL" }),
    listarUltimasTrazas({ negocio: NEGOCIO, flujo: "PANEL", desde: desde || undefined, soloProblemas: problemas !== "0", limite: 150 }),
  ]);
  const error = frecuentes.error || ultimas.error;
  return (
    <>
      {error && <p className="error-auth">{error}</p>}
      <section style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: "1.05rem" }}>Lo que más falla (últimos 7 días)</h2>
        {frecuentes.data.length === 0 ? (
          <div className="estado-vacio">
            <Activity aria-hidden="true" strokeWidth={1.6} />
            <p>Sin avisos ni errores en los últimos 7 días.</p>
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="tabla-trazas" style={{ width: "100%", fontSize: "0.85rem" }}>
              <thead>
                <tr>
                  <th>Veces</th>
                  <th>Nivel</th>
                  <th>Paso</th>
                  <th>Mensaje</th>
                  <th>Última ruta</th>
                  <th>Última vez</th>
                </tr>
              </thead>
              <tbody>
                {frecuentes.data.map((r, i) => (
                  <tr key={`${r.tra_paso}-${i}`}>
                    <td>
                      <strong>{r.veces}</strong>
                    </td>
                    <td>
                      <Nivel nivel={r.tra_nivel} />
                    </td>
                    <td>
                      <code>{r.tra_paso}</code>
                    </td>
                    <td style={{ wordBreak: "break-word" }}>{r.mensaje}</td>
                    <td>
                      <code>{r.ultima_ruta ?? ""}</code>
                    </td>
                    <td style={{ whiteSpace: "nowrap" }}>{fecha(r.ultima)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
      <section>
        <h2 style={{ fontSize: "1.05rem" }}>Últimas trazas</h2>
        {ultimas.data.length === 0 ? <p>Sin trazas para estos filtros.</p> : <TablaPasos filas={ultimas.data} conRuta />}
      </section>
    </>
  );
}

async function VistaPagos({ c, desde, problemas }: { c: string; desde: string; problemas: string }) {
  const [resumen, sueltos, detalle] = await Promise.all([
    listarResumenTrazas({ negocio: NEGOCIO, flujo: "PAGO_PLUX", desde: desde || undefined, soloProblemas: problemas === "1" }),
    listarErroresSueltos({ negocio: NEGOCIO, flujo: "PAGO_PLUX" }),
    c ? listarTrazasDeCorrelacion(c) : Promise.resolve({ data: [] as FilaTraza[], error: null }),
  ]);
  const error = resumen.error || sueltos.error || detalle.error;
  return (
    <>
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
                    <Link href={enlace({ vista: "pagos", c: r.tra_correlacion, desde, problemas })}>
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
    </>
  );
}

export default async function PaginaTrazas({
  searchParams,
}: {
  searchParams: Promise<{ vista?: string; c?: string; problemas?: string; desde?: string }>;
}) {
  const { vista = "panel", c = "", problemas = "", desde = "" } = await searchParams;
  const pestana: Pestana = vista === "pagos" ? "pagos" : "panel";

  return (
    <div style={{ width: "100%", boxSizing: "border-box" }}>
      <div
        className="tarjeta-proteccion tarjeta-admin"
        style={{ marginBottom: "20px", display: "flex", alignItems: "center", justifyContent: "space-between", padding: "20px 24px", borderRadius: "16px" }}
      >
        <div>
          <div className="tarjeta-proteccion-plan" style={{ fontSize: "1.3rem", fontWeight: 800 }}>
            Trazas
          </div>
          <div className="tarjeta-proteccion-meta" style={{ marginTop: "4px" }}>
            Qué falla en el panel y dónde se quedan los pagos. Se guardan 90 días.
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

      <nav className="pestanas-trazas" aria-label="Tipo de traza">
        <Link href={enlace({ vista: "panel", desde })} aria-current={pestana === "panel" ? "page" : undefined}>
          Panel
        </Link>
        <Link href={enlace({ vista: "pagos", desde })} aria-current={pestana === "pagos" ? "page" : undefined}>
          Pagos PLUX
        </Link>
      </nav>

      <form method="GET" className="form-filtros-auditoria" key={`${pestana}-${problemas}-${desde}`}>
        <input type="hidden" name="vista" value={pestana} />
        <label>
          Desde
          <input type="date" name="desde" defaultValue={desde} />
        </label>
        <label>
          Mostrar
          {pestana === "panel" ? (
            <select name="problemas" defaultValue={problemas || "1"}>
              <option value="1">Solo avisos y errores</option>
              <option value="0">Todo</option>
            </select>
          ) : (
            <select name="problemas" defaultValue={problemas}>
              <option value="">Todos los intentos</option>
              <option value="1">Solo los que acabaron en aviso o error</option>
            </select>
          )}
        </label>
        <button type="submit" className="btn-mini">
          Filtrar
        </button>
      </form>

      {pestana === "panel" ? <VistaPanel desde={desde} problemas={problemas} /> : <VistaPagos c={c} desde={desde} problemas={problemas} />}
    </div>
  );
}
