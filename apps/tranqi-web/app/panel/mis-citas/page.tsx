import Link from "next/link";
import { listarCitasDelCliente, obtenerCobertura } from "../../../modulos/agenda/consultas";
import ListaCitasCliente from "../../../modulos/agenda/componentes/ListaCitasCliente";

export const dynamic = "force-dynamic";

export default async function PaginaMisCitas() {
  const [citas, cobertura] = await Promise.all([listarCitasDelCliente(), obtenerCobertura()]);

  return (
    <>
      <h1>Mis citas</h1>

      {cobertura.length > 0 && (
        <section className="agenda-cobertura">
          <h2>Tu plan este mes</h2>
          <ul className="lista-detalle">
            {cobertura.map((c) => (
              <li key={`${c.suscripcion_id}-${c.concepto}`}>
                {c.concepto.toLowerCase().replaceAll("_", " ")}:{" "}
                {c.incluidos === null ? "sin límite" : `${c.restantes} de ${c.incluidos} disponibles`}
              </li>
            ))}
          </ul>
        </section>
      )}

      <ListaCitasCliente citas={citas} />

      <p className="fila-botones">
        <Link href="/panel/agendar" className="btn btn-primario">
          Agendar otra consulta
        </Link>
      </p>
    </>
  );
}
