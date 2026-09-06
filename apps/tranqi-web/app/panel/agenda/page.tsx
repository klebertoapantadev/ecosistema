import Link from "next/link";
import { listarAgendaDelAbogado, obtenerMiAgenda } from "../../../modulos/agenda/consultas";
import BandejaCitasAbogado from "../../../modulos/agenda/componentes/BandejaCitasAbogado";

export const dynamic = "force-dynamic";

export default async function PaginaAgendaAbogado() {
  const ahora = new Date();
  const finSemana = new Date(ahora.getTime() + 7 * 24 * 60 * 60 * 1000);
  const [citas, agenda] = await Promise.all([
    listarAgendaDelAbogado(ahora, finSemana),
    obtenerMiAgenda(),
  ]);

  const sinConfigurar = !agenda || !agenda.profesional.agp_configurada_en;

  return (
    <>
      <h1>Mi agenda</h1>

      {sinConfigurar && (
        <p className="agenda-aviso">
          Todavía no has definido tus horas de atención, así que nadie puede reservarte ni recibes
          casos por turno. <Link href="/panel/agenda/disponibilidad">Configúralas aquí</Link> — o
          pídeselo a tu asistente y las levantamos conversando.
        </p>
      )}

      <h2>Los próximos siete días</h2>
      <BandejaCitasAbogado citas={citas} />

      <p className="fila-botones">
        <Link href="/panel/agenda/disponibilidad" className="btn btn-blanco-borde">
          Cambiar mi disponibilidad
        </Link>
      </p>
    </>
  );
}
