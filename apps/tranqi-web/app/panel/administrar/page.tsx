import { redirect } from "next/navigation";
import { obtenerPerfilActual } from "@eco/identidad";
import { PanelAdministrarModular } from "./PanelAdministrarModular";

const NEGOCIO = "TRANQ";

export default async function PaginaPanelAdministrar() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/administrar`);
  }

  if (perfil.nivelMaximo < 80) {
    redirect("/panel");
  }

  return <PanelAdministrarModular negocio={NEGOCIO} />;
}
