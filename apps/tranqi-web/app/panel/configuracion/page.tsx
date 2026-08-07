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
  const modoCookie = cookieStore.get("tranqi_modo_rol")?.value
    || cookieStore.get("tranqi_rol_favorito")?.value;

  const esSuperadmin = Boolean(perfil?.usu_superadmin_plataforma);
  const puedeConmutar = esSuperadmin;
  const modo = puedeConmutar && modoCookie ? modoCookie : (perfiles.includes("ADMINISTRADOR") ? "admin" : "cliente");

  const esAdmin = modo === "admin" || esSuperadmin;

  const configuracion = (esAdmin || esSuperadmin) ? await obtenerConfiguracionNegocio(NEGOCIO) : null;
  const smtp = (esAdmin || esSuperadmin) ? await obtenerSmtpNegocio(NEGOCIO) : null;

  return (
    <div style={{ width: "100%" }}>
      <PanelConfiguracionModular
        esAdmin={esAdmin}
        esSuperadmin={esSuperadmin}
        configuracion={configuracion}
        smtp={smtp}
        negocio={NEGOCIO}
      />
    </div>
  );
}
