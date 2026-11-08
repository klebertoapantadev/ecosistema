import {
  listarMateriasAgendables,
  listarServiciosAgendables,
  obtenerCobertura,
  obtenerConfiguracionAgendaNegocio,
  obtenerHuecosDeMateria,
} from "../../../modulos/agenda/consultas";
import FormularioAgendar from "../../../modulos/agenda/componentes/FormularioAgendar";

export const dynamic = "force-dynamic";

export default async function PaginaAgendar() {
  const [materias, servicios, cobertura, configAgenda] = await Promise.all([
    listarMateriasAgendables(),
    listarServiciosAgendables(),
    obtenerCobertura(),
    obtenerConfiguracionAgendaNegocio(),
  ]);

  async function buscarHuecos(materiaId: string, varianteId: string | null, modalidad: string) {
    "use server";
    const desde = new Date();
    const horizonteDias = configAgenda.horizonte_dias || 21;
    const hasta = new Date(desde.getTime() + horizonteDias * 24 * 60 * 60 * 1000);
    return obtenerHuecosDeMateria(materiaId, desde, hasta, varianteId, modalidad);
  }

  return (
    <div className="space-y-4">
      <div>
        <h1>Agendar una consulta legal</h1>
        <p>
          Cuéntale a <strong>ARIA</strong> qué problema tienes con tus propias palabras. Ella identificará
          la especialidad jurídica adecuada, te mostrará los horarios disponibles y podrás confirmar tu cita con pago en línea.
        </p>
      </div>
      <FormularioAgendar
        materias={materias}
        servicios={servicios}
        cobertura={cobertura}
        configAgenda={configAgenda}
        buscarHuecos={buscarHuecos}
      />
    </div>
  );
}
