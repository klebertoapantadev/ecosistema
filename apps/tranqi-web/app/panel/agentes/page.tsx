import Link from "next/link";
import { listarAgentes, listarRuns, listarServidoresMcp } from "../../../modulos/agentes/consultas";

export const dynamic = "force-dynamic";

export default async function PaginaAgentes() {
  // En paralelo: son tres llamadas independientes a ARIA y encadenarlas
  // triplicaria la espera de la pantalla sin ganar nada.
  const [agentes, servidores, runs] = await Promise.all([
    listarAgentes(),
    listarServidoresMcp(),
    listarRuns(15),
  ]);

  return (
    <>
      <h1>Agentes</h1>
      <p>
        Los asistentes de IA de tranqi, su configuración y lo que han respondido. Solo se ven los
        de tranqi: la credencial de esta pantalla está atada a este negocio y no alcanza a ningún
        otro.
      </p>

      <section className="bloque-agentes">
        <h2>Asistentes</h2>
        {agentes.ok ? (
          agentes.datos.length === 0 ? (
            <p className="agentes-vacio">No hay ningún agente creado todavía.</p>
          ) : (
            <ul className="lista-agentes">
              {agentes.datos.map((a) => (
                <li key={a.id}>
                  <Link href={`/panel/agentes/${a.id}`} className="tarjeta-agente">
                    <span className="agente-nombre">
                      {a.name}
                      {!a.enabled && <span className="chip-apagado">desactivado</span>}
                    </span>
                    {a.description && <span className="agente-descripcion">{a.description}</span>}
                    <span className="agente-meta">
                      {a.slug} · {a.model}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Aviso motivo={agentes.motivo} />
        )}
      </section>

      <section className="bloque-agentes">
        <h2>Servidores de herramientas (MCP)</h2>
        <p className="agentes-nota">
          De aquí sacan los asistentes lo que saben de cada usuario. Cada servidor recibe la
          identidad de quien habla en una cápsula firmada por esta app, no como un dato que el
          modelo pueda elegir.
        </p>
        {servidores.ok ? (
          servidores.datos.length === 0 ? (
            <p className="agentes-vacio">
              No hay servidores MCP registrados. Sin ellos los asistentes conversan, pero no pueden
              consultar casos, citas ni documentos.
            </p>
          ) : (
            <ul className="lista-mcp">
              {servidores.datos.map((s) => (
                <li key={s.id}>
                  <b>{s.name}</b>
                  <span className="agente-meta">
                    {s.transport} · {s.url ?? "sin url"}
                    {!s.enabled && " · desactivado"}
                  </span>
                </li>
              ))}
            </ul>
          )
        ) : (
          <Aviso motivo={servidores.motivo} />
        )}
      </section>

      <section className="bloque-agentes">
        <h2>Últimas respuestas</h2>
        {runs.ok ? (
          runs.datos.length === 0 ? (
            <p className="agentes-vacio">Todavía no hay conversaciones registradas.</p>
          ) : (
            <table className="tabla-runs">
              <thead>
                <tr>
                  <th>Cuándo</th>
                  <th>Origen</th>
                  <th>Estado</th>
                  <th>Duración</th>
                </tr>
              </thead>
              <tbody>
                {runs.datos.map((r) => (
                  <tr key={r.id}>
                    <td>
                      {new Intl.DateTimeFormat("es-EC", {
                        dateStyle: "short",
                        timeStyle: "short",
                        timeZone: "America/Guayaquil",
                      }).format(new Date(r.created_at))}
                    </td>
                    <td>{r.source}</td>
                    <td>{r.status}</td>
                    <td>{(r.duration_ms / 1000).toFixed(1)} s</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )
        ) : (
          <Aviso motivo={runs.motivo} />
        )}
      </section>
    </>
  );
}

/** Un fallo de ARIA se cuenta, no se disfraza de "no hay nada". */
function Aviso({ motivo }: { motivo: string }) {
  return (
    <p className="agentes-aviso" role="status">
      No se pudo consultar ARIA: {motivo}
    </p>
  );
}
