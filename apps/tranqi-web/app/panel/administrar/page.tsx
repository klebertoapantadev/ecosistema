import { redirect } from "next/navigation";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { PanelAdministrarModular } from "./PanelAdministrarModular";

const NEGOCIO = "TRANQ";

export default async function PaginaPanelAdministrar() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/administrar`);
  }

  const perfiles = await obtenerPerfiles(NEGOCIO);
  const esSuperAdmin = perfiles.includes("SUPERADMIN");

  return <PanelAdministrarModular negocio={NEGOCIO} esSuperAdmin={esSuperAdmin} />;
}
