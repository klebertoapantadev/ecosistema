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
    <div style={{ maxWidth: "780px", margin: "0 auto", padding: "8px 0 32px" }}>
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
