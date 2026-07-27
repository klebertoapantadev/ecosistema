import { etiquetaDispositivo, etiquetaNegocio } from "../acceso";

interface FilaAcceso {
  acc_id: string;
  acc_ip: string | null;
  acc_user_agent: string | null;
  acc_creado_en: string;
  acc_negocio?: string | null;
}

// Server component -- recibe el historial ya resuelto por la pagina que lo
// monta (mismo patron que FormularioConfiguracionNegocio con `inicial`).
// PLT-018 regla 4: el historial es unico por usuario en todo el
// ecosistema, no por negocio -- por eso cada fila muestra en que app
// ocurrio el acceso (acc_negocio), para que no parezca una duplicacion
// confusa si el usuario entro a mas de un negocio.
export function HistorialAccesos({ historial }: { historial: FilaAcceso[] }) {
  if (historial.length === 0) return null;

  return (
    <div className="historial-accesos">
      <h2>Accesos recientes</h2>
      <ul>
        {historial.map((fila) => {
          const negocio = etiquetaNegocio(fila.acc_negocio ?? null);
          return (
            <li key={fila.acc_id}>
              <span>
                {etiquetaDispositivo(fila.acc_user_agent)}
                {negocio && <span className="historial-negocio"> · {negocio}</span>}
              </span>
              <span className="historial-fecha">
                {new Date(fila.acc_creado_en).toLocaleString("es-EC", {
                  dateStyle: "medium",
                  timeStyle: "short",
                })}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
