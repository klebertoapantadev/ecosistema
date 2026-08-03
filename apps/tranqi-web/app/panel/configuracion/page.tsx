import type { Metadata } from "next";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { obtenerConfiguracionNegocio, obtenerSmtpNegocio } from "@eco/configuracion-negocio/consultas";
import { PanelConfiguracionModular } from "./PanelConfiguracionModular";

export const metadata: Metadata = { title: "Configuración & Preferencias — tranqi" };

const NEGOCIO = "tranqi";

export default async function PaginaConfiguracion() {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles(NEGOCIO);
  const esAdmin = Boolean(perfil?.usu_superadmin_plataforma || perfiles.includes("ADMINISTRADOR"));

  const configuracion = esAdmin ? await obtenerConfiguracionNegocio(NEGOCIO) : null;
  const smtp = esAdmin ? await obtenerSmtpNegocio(NEGOCIO) : null;

  return (
    <div style={{ width: "100%" }}>
      <PanelConfiguracionModular
        esAdmin={esAdmin}
        configuracion={configuracion}
        smtp={smtp}
        negocio={NEGOCIO}
      />
    </div>
  );
}
