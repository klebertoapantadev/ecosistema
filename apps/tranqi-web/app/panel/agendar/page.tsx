import {
  listarMateriasAgendables,
  listarServiciosAgendables,
  obtenerCobertura,
  obtenerHuecosDeMateria,
} from "../../../modulos/agenda/consultas";
import FormularioAgendar from "../../../modulos/agenda/componentes/FormularioAgendar";

export const dynamic = "force-dynamic";

// Esta ruta ya estaba enlazada desde el inicio del cliente (`ACCESOS_CLIENTE`)
// pero no existia: caia en el catch-all [slug] y mostraba un panel vacio.

export default async function PaginaAgendar() {
  const [materias, servicios, cobertura] = await Promise.all([
    listarMateriasAgendables(),
    listarServiciosAgendables(),
    obtenerCobertura(),
  ]);

  // Server Action acotada a leer huecos. Next no permite pasar funciones de un
  // Server Component a uno de cliente si no estan marcadas, y el calculo tiene
  // que ocurrir en el servidor: el RPC es security definer y el navegador no
  // puede -- ni debe -- leer la agenda de nadie.
  async function buscarHuecos(materiaId: string, varianteId: string | null, modalidad: string) {
    "use server";
    const desde = new Date();
    const hasta = new Date(desde.getTime() + 21 * 24 * 60 * 60 * 1000);
    return obtenerHuecosDeMateria(materiaId, desde, hasta, varianteId, modalidad);
  }

  return (
    <>
      <h1>Agendar una consulta</h1>
      <p>
        Dinos de qué se trata y te mostramos las horas libres. Al reservar te asignamos al abogado
        de turno especializado en esa materia, y él confirma la cita.
      </p>
      <FormularioAgendar
        materias={materias}
        servicios={servicios}
        cobertura={cobertura}
        buscarHuecos={buscarHuecos}
      />
    </>
  );
}
