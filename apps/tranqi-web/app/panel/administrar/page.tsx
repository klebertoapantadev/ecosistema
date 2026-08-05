import { redirect } from "next/navigation";
import { obtenerSesionServidor, esMembroNegocio, seg_fn_es_superadmin } from "@eco/identidad";
import { PanelAdministrarModular } from "./PanelAdministrarModular";

const NEGOCIO = "TRANQ";

export default async function PaginaPanelAdministrar() {
  const sesion = await obtenerSesionServidor();

  if (!sesion) {
    redirect(`/ingresar?redirect=/panel/administrar`);
  }

  const esAdmin = await esMembroNegocio(sesion.usuario.usu_id, NEGOCIO);
  const esSuperadmin = await seg_fn_es_superadmin(sesion.usuario.usu_id);

  if (!esAdmin && !esSuperadmin) {
    redirect("/panel");
  }

  return <PanelAdministrarModular negocio={NEGOCIO} />;
}
