import {
  listarCitasCalendarioOperador,
  listarMateriasAgendables,
  obtenerConfiguracionAgendaNegocio,
} from "../../../../modulos/agenda/consultas";
import MesaAsignaciones from "../../../../modulos/agenda/componentes/MesaAsignaciones";
import { ConfiguracionHorariosAtencionWidget } from "../../../../modulos/agenda/componentes/ConfiguracionHorariosAtencionWidget";

export const dynamic = "force-dynamic";

export default async function PaginaAsignaciones() {
  const [datosCalendario, configAgenda, materias] = await Promise.all([
    listarCitasCalendarioOperador(),
    obtenerConfiguracionAgendaNegocio(),
    listarMateriasAgendables(),
  ]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
      <div>
        <h1>Agenda, Citas Abogados</h1>
        <p>
          Calendario de citas confirmadas (telemáticas vs presenciales), identificación de citas con
          y sin abogado asignado, notificación automática y log de asignaciones.
        </p>
      </div>

      <MesaAsignaciones
        citas={datosCalendario.citas}
        abogados={datosCalendario.abogados}
        historialGlobal={datosCalendario.historialGlobal}
      />

      <ConfiguracionHorariosAtencionWidget
        configInicial={configAgenda}
        materiasIniciales={materias}
      />
    </div>
  );
}
