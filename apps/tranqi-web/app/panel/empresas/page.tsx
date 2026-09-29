import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { PanelDinamicoModular } from "../[slug]/PanelDinamicoModular";

export const metadata: Metadata = {
  title: "Soluciones & Convenios para Empresas — tranqi",
  description: "Catálogo corporativo, constitución SAS, convenios de beneficios SATCOM y planes mensuales para empresas.",
};

const NEGOCIO = "TRANQ";

export default async function PaginaPanelEmpresas() {
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/empresas`);
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

  return <PanelDinamicoModular slug="empresas" negocio={NEGOCIO} rolInicial={rolActivo} esSuperAdmin={esSuperAdmin} />;
}
