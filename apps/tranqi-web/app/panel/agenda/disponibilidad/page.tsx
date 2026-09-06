import { obtenerMiAgenda } from "../../../../modulos/agenda/consultas";
import EditorDisponibilidad from "../../../../modulos/agenda/componentes/EditorDisponibilidad";

export const dynamic = "force-dynamic";

const POR_DEFECTO = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 24,
  horizonte_dias: 60,
  modalidades: ["virtual", "presencial"],
  acepta_turno: true,
  direccion: null as string | null,
};

export default async function PaginaDisponibilidad() {
  const agenda = await obtenerMiAgenda();

  const configuracion = agenda
    ? {
        zona_horaria: agenda.profesional.agp_zona_horaria,
        duracion_cita_min: agenda.profesional.agp_duracion_cita_min,
        holgura_min: agenda.profesional.agp_holgura_min,
        antelacion_minima_horas: agenda.profesional.agp_antelacion_minima_horas,
        horizonte_dias: agenda.profesional.agp_horizonte_dias,
        modalidades: agenda.profesional.agp_modalidades ?? ["virtual", "presencial"],
        acepta_turno: agenda.profesional.agp_acepta_turno,
        direccion: agenda.profesional.agp_direccion,
      }
    : POR_DEFECTO;

  const franjas = (agenda?.franjas ?? []).map((f: { fra_dia_semana: number; fra_hora_inicio: string; fra_hora_fin: string; fra_modalidad: string }) => ({
    dia_semana: f.fra_dia_semana,
    hora_inicio: f.fra_hora_inicio,
    hora_fin: f.fra_hora_fin,
    modalidad: f.fra_modalidad as "virtual" | "presencial" | "ambas",
  }));

  return (
    <>
      <h1>Mi disponibilidad</h1>
      <p>
        Estas son las horas en las que los afiliados pueden reservarte. Mientras no tengas ninguna
        franja no apareces disponible ni entras en el reparto de casos por turno.
      </p>
      <EditorDisponibilidad configuracionInicial={configuracion} franjasIniciales={franjas} />
    </>
  );
}
