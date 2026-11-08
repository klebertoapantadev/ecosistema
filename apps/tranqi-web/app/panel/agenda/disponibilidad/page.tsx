import { MiPerfilRedAbogadoWidget } from "../../../../modulos/socios/componentes/MiPerfilRedAbogadoWidget";

export const dynamic = "force-dynamic";

export default async function PaginaDisponibilidad() {
  return (
    <div style={{ width: "100%" }}>
      <h1>Mi disponibilidad, especialidades y cobertura</h1>
      <p style={{ color: "#4B5563", marginBottom: "18px" }}>
        Configura tus horarios de atención de citas presenciales y teleconsulta, así como tus especialidades legales y provincias de cobertura.
      </p>
      <MiPerfilRedAbogadoWidget tabInicial="disponibilidad" />
    </div>
  );
}
