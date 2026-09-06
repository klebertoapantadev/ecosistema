import { listarAbogadosAsignables, listarCitasEnContingencia } from "../../../../modulos/agenda/consultas";
import MesaAsignaciones from "../../../../modulos/agenda/componentes/MesaAsignaciones";

export const dynamic = "force-dynamic";

export default async function PaginaAsignaciones() {
  const [citas, abogados] = await Promise.all([listarCitasEnContingencia(), listarAbogadosAsignables()]);

  return (
    <>
      <h1>Asignaciones y contingencia</h1>
      <p>
        Citas que se quedaron sin abogado porque el asignado canceló. La cita del afiliado sigue en
        pie: hay que ponerle otro profesional antes de la hora, no cancelársela.
      </p>
      <MesaAsignaciones citas={citas} abogados={abogados} />
    </>
  );
}
