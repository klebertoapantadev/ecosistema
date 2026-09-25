import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { PanelAdministrarModular } from "./PanelAdministrarModular";

const NEGOCIO = "TRANQ";

export default async function PaginaPanelAdministrar() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/administrar`);
  }

  const perfiles = await obtenerPerfiles(NEGOCIO);
  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
  const esSuperAdminPlataforma = Boolean(perfil.usu_superadmin_plataforma);
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfiles.includes("SUPERADMIN");

  const cookieStore = await cookies();
  const modoCookie = cookieStore.get("tranqi_modo_rol")?.value || cookieStore.get("tranqi_rol_favorito")?.value;
  const rolActivo = (modoCookie && modoCookie.trim())
    ? modoCookie.toUpperCase().trim()
    : (perfiles.includes("SUPERADMIN") ? "SUPERADMIN" : perfiles.includes("ADMINISTRADOR") ? "ADMINISTRADOR" : perfiles.includes("OPERADOR") ? "OPERADOR" : perfiles[0] || "CLIENTE");

  return <PanelAdministrarModular negocio={NEGOCIO} esSuperAdmin={esSuperAdmin} rolInicial={rolActivo} />;
}
