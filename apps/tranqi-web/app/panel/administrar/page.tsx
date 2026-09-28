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
  const perfilesUpper = perfiles.map((p) => p.toUpperCase().trim());
  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "familiammtg@gmail.com" || correo === "jesus251296@gmail.com";
  const esSuperAdminPlataforma = Boolean(perfil.usu_superadmin_plataforma);
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfilesUpper.includes("SUPERADMIN");

  const cookieStore = await cookies();
  const modoCookie = (cookieStore.get("tranqi_modo_rol")?.value || cookieStore.get("tranqi_rol_favorito")?.value || "").toUpperCase().trim();

  let rolActivo = "CLIENTE";
  if (esSuperAdmin) {
    rolActivo = modoCookie || "SUPERADMIN";
  } else if (modoCookie && perfilesUpper.includes(modoCookie)) {
    rolActivo = modoCookie;
  } else if (perfilesUpper.includes("ADMINISTRADOR") || perfilesUpper.includes("ADMIN")) {
    rolActivo = "ADMINISTRADOR";
  } else if (perfilesUpper.includes("OPERADOR")) {
    rolActivo = "OPERADOR";
  } else if (perfilesUpper.includes("ABOGADO")) {
    rolActivo = "ABOGADO";
  } else if (perfilesUpper.includes("TECNICO")) {
    rolActivo = "TECNICO";
  } else if (perfilesUpper.includes("AUXILIAR")) {
    rolActivo = "AUXILIAR";
  } else {
    rolActivo = perfilesUpper[0] || "CLIENTE";
  }

  // Si el usuario es un CLIENTE estándar sin permisos de staff, redirigir al inicio del panel
  if (rolActivo === "CLIENTE" && !esSuperAdmin) {
    redirect("/panel");
  }

  return <PanelAdministrarModular negocio={NEGOCIO} esSuperAdmin={esSuperAdmin} rolInicial={rolActivo} />;
}
