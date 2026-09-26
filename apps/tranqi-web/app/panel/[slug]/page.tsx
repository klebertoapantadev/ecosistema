import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { PanelDinamicoModular } from "./PanelDinamicoModular";

const NEGOCIO = "TRANQ";

interface Props {
  params: Promise<{ slug: string }>;
}

export default async function PaginaPanelDinamico({ params }: Props) {
  const { slug } = await params;
  const perfil = await obtenerPerfilActual();

  if (!perfil) {
    redirect(`/ingresar?redirect=/panel/${slug}`);
  }

  // Prevenir colisión con rutas estáticas existentes
  if (slug === "administrar" || slug === "configuracion" || slug === "cuenta" || slug === "auditoria") {
    redirect(`/panel/${slug}`);
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

  return <PanelDinamicoModular slug={slug} negocio={NEGOCIO} rolInicial={rolActivo} esSuperAdmin={esSuperAdmin} />;
}
