import type { Metadata } from "next";
import { obtenerPerfilActual } from "@eco/identidad";
import { obtenerSolicitudPropia, listarMaterias, listarProvincias } from "../../../modulos/socios/consultas";
import { FormularioSolicitudSocio } from "../../../modulos/socios/componentes/FormularioSolicitudSocio";

export const metadata: Metadata = { title: "Solicitud de socio — tranqi" };

const ETIQUETA_ESTADO: Record<string, string> = {
  enviada: "Enviada — en espera de revisión",
  en_revision: "En revisión",
  aceptada: "¡Aceptada! Ya eres parte de la red",
  rechazada: "No aceptada esta vez",
};

export default async function PaginaSolicitudSocio() {
  const perfil = await obtenerPerfilActual();
  if (!perfil) return null; // el layout de /panel ya redirige si no hay sesión

  const solicitud = await obtenerSolicitudPropia(perfil.usu_id);
  const puedePostular = !solicitud || solicitud.ssc_estado === "rechazada";

  return (
    <div>
      <h1>Solicitud de socio abogado</h1>
      <p>Únete a la red de abogados de tranqi — nuevos clientes, capacitación constante y una cuenta digital propia.</p>

      {solicitud && (
        <div className="tarjeta-estado-solicitud">
          <span className={`chip-estado-solicitud chip-${solicitud.ssc_estado}`}>{ETIQUETA_ESTADO[solicitud.ssc_estado]}</span>
          <p className="historial-fecha">Enviada el {new Date(solicitud.ssc_enviada_en).toLocaleDateString("es-EC")}</p>
        </div>
      )}

      {puedePostular && (
        <FormularioSolicitudSocioConDatos usuarioId={perfil.usu_id} correoInicial={perfil.usu_correo} />
      )}
    </div>
  );
}

async function FormularioSolicitudSocioConDatos({ usuarioId, correoInicial }: { usuarioId: string; correoInicial: string | null }) {
  const [materias, provincias] = await Promise.all([listarMaterias(), listarProvincias()]);
  return <FormularioSolicitudSocio usuarioId={usuarioId} materias={materias} provincias={provincias} correoInicial={correoInicial} />;
}
