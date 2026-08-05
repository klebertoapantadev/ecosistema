import type { Metadata } from "next";
import { cookies } from "next/headers";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { obtenerConfiguracionNegocio, obtenerSmtpNegocio } from "@eco/configuracion-negocio/consultas";
import { PanelConfiguracionModular } from "./PanelConfiguracionModular";

export const metadata: Metadata = { title: "Configuración & Preferencias — tranqi" };

const NEGOCIO = "tranqi";

export default async function PaginaConfiguracion() {
  const perfil = await obtenerPerfilActual();
  const perfiles = await obtenerPerfiles(NEGOCIO);
  const cookieStore = await cookies();
  const modoCookie = cookieStore.get("tranqi_modo_rol")?.value;

  const puedeConmutar = Boolean(perfil?.usu_superadmin_plataforma);
  const modo = puedeConmutar && modoCookie ? modoCookie : (perfiles.includes("ADMINISTRADOR") ? "admin" : "cliente");

  const esAdmin = modo === "admin";

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
