import { etiquetaDispositivo } from "../acceso";

interface FilaAcceso {
  acc_id: string;
  acc_ip: string | null;
  acc_user_agent: string | null;
  acc_creado_en: string;
}

// Server component -- recibe el historial ya resuelto por la pagina que lo
// monta (mismo patron que FormularioConfiguracionNegocio con `inicial`).
export function HistorialAccesos({ historial }: { historial: FilaAcceso[] }) {
  if (historial.length === 0) return null;

  return (
    <div className="historial-accesos">
      <h2>Accesos recientes</h2>
      <ul>
        {historial.map((fila) => (
          <li key={fila.acc_id}>
            <span>{etiquetaDispositivo(fila.acc_user_agent)}</span>
            <span className="historial-fecha">
              {new Date(fila.acc_creado_en).toLocaleString("es-EC", {
                dateStyle: "medium",
                timeStyle: "short",
              })}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
