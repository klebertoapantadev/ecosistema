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
  const perfilesUpper = perfiles.map((p) => p.toUpperCase().trim());
  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "kleber.toapanta.ch@gmail.com" || correo === "jesus251296@gmail.com";
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

  // Protección de acceso por rol para CLIENTE
  if (!esSuperAdmin && rolActivo === "CLIENTE") {
    const slugsPermitidosCliente = ["agendamiento", "herramientas", "cuenta"];
    if (!slugsPermitidosCliente.includes(slug.toLowerCase().trim())) {
      redirect("/panel");
    }
  }

  return <PanelDinamicoModular slug={slug} negocio={NEGOCIO} rolInicial={rolActivo} esSuperAdmin={esSuperAdmin} />;
}
