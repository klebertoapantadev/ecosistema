import {
  listarAbogadosAsignables,
  listarCitasEnContingencia,
  listarMateriasAgendables,
  obtenerConfiguracionAgendaNegocio,
} from "../../../../modulos/agenda/consultas";
import MesaAsignaciones from "../../../../modulos/agenda/componentes/MesaAsignaciones";
import { ConfiguracionHorariosAtencionWidget } from "../../../../modulos/agenda/componentes/ConfiguracionHorariosAtencionWidget";

export const dynamic = "force-dynamic";

export default async function PaginaAsignaciones() {
  const [citas, abogados, configAgenda, materias] = await Promise.all([
    listarCitasEnContingencia(),
    listarAbogadosAsignables(),
    obtenerConfiguracionAgendaNegocio(),
    listarMateriasAgendables(),
  ]);

  return (
    <div className="space-y-8">
      <div>
        <h1>Asignaciones y Horarios de Atención</h1>
        <p>
          Configura los horarios de atención por defecto para consultas telemáticas y presenciales,
          y asigna abogado a las citas reservadas que están pendientes de profesional.
        </p>
      </div>

      <ConfiguracionHorariosAtencionWidget
        configInicial={configAgenda}
        materiasIniciales={materias}
      />

      <section className="space-y-3">
        <h2 className="text-lg font-bold text-slate-900">
          Citas agendadas pendientes de asignación de abogado ({citas.length})
        </h2>
        <p className="text-sm text-slate-600">
          Citas confirmadas en los horarios de atención del negocio que aún no tienen un abogado
          asignado o cuyo abogado requiere reemplazo.
        </p>
        <MesaAsignaciones citas={citas} abogados={abogados} />
      </section>
    </div>
  );
}
