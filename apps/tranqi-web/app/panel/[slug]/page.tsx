import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { obtenerPerfilActual, obtenerPerfiles } from "@eco/identidad";
import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { obtenerConfiguracionNavegacionRolAction } from "@eco/gestion-usuarios/acciones";
import { ROLES_DEFAULT } from "../roles-sistema";
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

  const perfilesBase = await obtenerPerfiles(NEGOCIO);
  const supabase = await crearClienteServidor();
  const adminClient = (crearClienteAdmin() || supabase) as any;

  let regAbogado: { abg_id: string; abg_estado: string } | null = null;
  if (perfil.usu_id) {
    const { data } = await adminClient
      .schema("tranqui_legal")
      .from("trq_abogado")
      .select("abg_id, abg_estado")
      .eq("abg_usuario_id", perfil.usu_id)
      .maybeSingle();
    regAbogado = data;
  }

  let perfilesUpper = perfilesBase.map((p) => p.toUpperCase().trim());
  if (regAbogado?.abg_estado === "verificado" && !perfilesUpper.includes("ABOGADO")) {
    perfilesUpper.push("ABOGADO");
  } else if (regAbogado?.abg_estado === "suspendido") {
    perfilesUpper = perfilesUpper.filter((p) => p !== "ABOGADO");
  }

  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail =
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com";
  const esSuperAdminPlataforma = Boolean(perfil.usu_superadmin_plataforma);
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfilesUpper.includes("SUPERADMIN");

  const cookieStore = await cookies();
  const modoCookie = (cookieStore.get("tranqi_modo_rol")?.value || cookieStore.get("tranqi_rol_favorito")?.value || "").toUpperCase().trim();

  let rolActivo = "CLIENTE";
  if (esSuperAdmin) {
    rolActivo = modoCookie || "SUPERADMIN";
  } else if (modoCookie && (perfilesUpper.includes(modoCookie) || modoCookie === "CLIENTE")) {
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

  const slugLimpio = slug.toLowerCase().trim();

  // Protección de acceso por rol para CLIENTE
  if (rolActivo === "CLIENTE") {
    const slugsPermitidosCliente = ["productos-servicios", "clientes", "empresas", "agendamiento", "herramientas", "cuenta"];
    if (!slugsPermitidosCliente.includes(slugLimpio)) {
      redirect("/panel");
    }
  }

  // Protección de acceso por rol para ABOGADO (no exponer consolas de Operador como Clientes, Empresas o Red profesional)
  if (rolActivo === "ABOGADO") {
    if (slugLimpio === "red-profesional") {
      redirect("/panel/agendamiento?widget=mi_perfil_abogado");
    }
    const slugsPermitidosAbogado = ["agendamiento", "cuenta"];
    if (!slugsPermitidosAbogado.includes(slugLimpio)) {
      redirect("/panel");
    }
  }

  const rolesDisponibles = esSuperAdmin
    ? ROLES_DEFAULT
    : ROLES_DEFAULT.filter((r) => {
        const setPerfiles = new Set(perfilesUpper);
        setPerfiles.add("CLIENTE");
        return setPerfiles.has(r.clave.toUpperCase());
      });

  const resBdd = await obtenerConfiguracionNavegacionRolAction(rolActivo, NEGOCIO);
  const slugNorm = slug.replace(/-/g, "_");
  const panelKey = slugNorm.startsWith("panel_") ? slugNorm : `panel_${slugNorm}`;
  const widgetsIniciales = resBdd.ok && resBdd.data?.widgetsPorPanel
    ? (resBdd.data.widgetsPorPanel[panelKey] ??
       resBdd.data.widgetsPorPanel[slug] ??
       resBdd.data.widgetsPorPanel[slugNorm] ??
       resBdd.data.widgetsPorPanel[`panel_${slug}`] ??
       [])
    : [];

  return (
    <PanelDinamicoModular
      slug={slug}
      negocio={NEGOCIO}
      rolInicial={rolActivo}
      esSuperAdmin={esSuperAdmin}
      widgetsIniciales={widgetsIniciales}
      rolesDisponibles={rolesDisponibles}
    />
  );
}
