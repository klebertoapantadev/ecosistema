import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SelloCompilacion } from "@eco/primitivas";
import { obtenerPerfilActual, asegurarMembresiaCliente, obtenerPerfiles } from "@eco/identidad";
import { CampanaNotificaciones } from "@eco/notificaciones";
import { NavegacionSidebar } from "./NavegacionSidebar";
import { CapaPerfilRail, COOKIE_RAIL_PLEGADO } from "./CapaPerfilRail";
import { BotonPlegarRail } from "./BotonPlegarRail";
import { ProveedorAvisos } from "./AvisosPanel";
import { BarraAsistente } from "./asistente/BarraAsistente";
import { rolConAsistente } from "../../modulos/asistente/rol";
import { crearClienteServidor } from "@eco/supabase/servidor";
import type { ModoRol } from "./SelectorRolActivo";

const NEGOCIO = "tranqi";

const ETIQUETAS_ROL: Record<string, string> = {
  abogado: "Socio Abogado",
  socio: "Socio Abogado",
  admin: "Administrador",
  administrador: "Administrador",
  operador: "Operador",
  auxiliar: "Auxiliar",
  tecnico: "Técnico",
  superadmin: "SuperAdmin",
  cliente: "Cliente"
};

function modoValido(valor: string | undefined): ModoRol | null {
  if (!valor || !valor.trim()) return null;
  return valor.toLowerCase().trim() as ModoRol;
}

function modoDePerfiles(perfiles: string[]): ModoRol {
  if (perfiles.includes("SUPERADMIN")) return "superadmin";
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  if (perfiles.includes("OPERADOR")) return "operador";
  if (perfiles.includes("TECNICO")) return "tecnico";
  if (perfiles.includes("AUXILIAR")) return "auxiliar";
  return (perfiles[0]?.toLowerCase() ?? "cliente") as ModoRol;
}

function resolverModoRolSeguro(
  perfiles: string[],
  esSuperAdmin: boolean,
  modoCookie?: string | null
): ModoRol {
  const modoNormalizado = modoValido(modoCookie ?? undefined);

  // 1. Si es SUPERADMIN de la plataforma, tiene permiso de conmutar a cualquier rol ("Ver como")
  if (esSuperAdmin) {
    return modoNormalizado ?? "superadmin";
  }

  // 2. Si el usuario NO es superadmin, solo puede usar un rol que REALMENTE tenga asignado en la BDD
  const perfilesUpper = perfiles.map((p) => p.toUpperCase().trim());

  if (modoNormalizado) {
    const modoUpper = modoNormalizado.toUpperCase();
    const esValido = perfilesUpper.some((p) => {
      if (p === "ADMINISTRADOR" && (modoUpper === "ADMIN" || modoUpper === "ADMINISTRADOR")) return true;
      if (p === "OPERADOR" && modoUpper === "OPERADOR") return true;
      if (p === "ABOGADO" && modoUpper === "ABOGADO") return true;
      if (p === "TECNICO" && modoUpper === "TECNICO") return true;
      if (p === "AUXILIAR" && modoUpper === "AUXILIAR") return true;
      if (p === "CLIENTE" && modoUpper === "CLIENTE") return true;
      return false;
    });

    if (esValido) {
      return modoNormalizado;
    }
  }

  // 3. Fallback estricto al rol más alto que el usuario posea
  return modoDePerfiles(perfiles);
}

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const perfiles = await obtenerPerfiles(NEGOCIO);
  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail = correo === "familiammtg@gmail.com" || correo === "jesus251296@gmail.com";
  const esSuperAdminPlataforma = Boolean(perfil.usu_superadmin_plataforma);
  const esSuperAdmin = esSuperAdminEmail || esSuperAdminPlataforma || perfiles.includes("SUPERADMIN");

  const MAPA_CLASES_PERFIL: Record<string, string> = {
    cliente: "perfil-cliente",
    operador: "perfil-operador",
    auxiliar: "perfil-operador",
    abogado: "perfil-abogado",
    socio: "perfil-abogado",
    tecnico: "perfil-tecnico",
    admin: "perfil-admin",
    administrador: "perfil-admin",
    superadmin: "perfil-superadmin"
  };

  const cookieStore = await cookies();
  const modoCookie = cookieStore.get("tranqi_modo_rol")?.value || cookieStore.get("tranqi_rol_favorito")?.value;
  const modoActivo: ModoRol = resolverModoRolSeguro(perfiles, esSuperAdmin, modoCookie);

  const clasePerfil = MAPA_CLASES_PERFIL[modoActivo.toLowerCase()] || `perfil-${modoActivo.toLowerCase()}`;
  const railPlegado = cookieStore.get(COOKIE_RAIL_PLEGADO)?.value === "1";

  return (
    <Suspense fallback={<div className={`panel-layout ${clasePerfil}${railPlegado ? " rail-plegado" : ""}`}>{children}</div>}>
      <CapaPerfilRail claseBase={clasePerfil} railPlegadoInicial={railPlegado}>
        {/* TRQ-013: avisos flotantes (9A) para cualquier pantalla del panel.
            Su contenedor es `position: fixed`, no ocupa sitio en el flex. */}
        <ProveedorAvisos>
        <aside className="panel-nav">
          <svg className="cinta-rail" viewBox="0 0 236 900" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 200 -40 C 200 160 40 240 60 430 C 78 610 210 660 200 900" />
          </svg>

          <div className="panel-marca">
            <Link href="/panel" className="panel-marca-logo" title="Ir al tablero principal (Inicio)">
              <img src="/assets/tranqi-white.svg" alt="tranqi" />
            </Link>
            <CampanaNotificaciones negocio={NEGOCIO} usuarioId={perfil.usu_id} />
            <BotonPlegarRail />
          </div>

          <div style={{ padding: "0 20px 8px 20px", marginTop: "-6px" }}>
            <SelloCompilacion className="sello-compilacion" />
          </div>

          <div className="panel-usuario">
            <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
            <span className="correo-usuario-activo">{perfil.usu_correo}</span>
            {perfil.usu_superadmin_plataforma ? (
              <Link
                href="/panel/cuenta?widget=ver_como"
                className="etiqueta-superadmin"
                title="Cambiar el rol con el que ves la plataforma"
              >
                {`SuperAdmin (${ETIQUETAS_ROL[modoActivo.toLowerCase()] || modoActivo}) ▾`}
              </Link>
            ) : modoActivo.toLowerCase() !== "cliente" ? (
              <span className="etiqueta-rol-activo">
                {ETIQUETAS_ROL[modoActivo.toLowerCase()] || modoActivo.toUpperCase()}
              </span>
            ) : null}
          </div>

          <NavegacionSidebar modoActivo={modoActivo} negocio={NEGOCIO} />
        </aside>
        <main className="panel-contenido">
          {children}
        </main>

        {/* PLT-004. Tercera columna, no burbuja flotante: el asistente convive
            con la pantalla en vez de taparla.

            Se decide por `modoActivo`, que es lo que resuelve el servidor. Ojo:
            CapaPerfilRail puede recolorear el rail en cliente con `?modo=`, y
            eso NO mueve esta condicion -- el color es apariencia, pero que
            aparezca un asistente con herramientas es una capacidad, y esa se
            decide en el servidor a partir de la cookie y los perfiles reales.

            Solo cliente y abogado: son los dos perfiles con agente propio en
            ARIA. Operador, tecnico, admin y superadmin no tienen todavia el
            suyo (TRQ-ADM-002), y darles el de cliente seria ofrecerles una
            herramienta que no responde a su trabajo. */}
        {rolConAsistente(modoActivo) && (
          <BarraAsistente nombre="tranqi" saludo={saludoDe(modoActivo, perfil.usu_nombres)} />
        )}
        </ProveedorAvisos>
      </CapaPerfilRail>
    </Suspense>
  );
}

/** Primer mensaje de la barra. Dice lo que el asistente SABE hacer, para que
 *  nadie tenga que adivinar qué preguntarle -- y para no prometer de más. */
function saludoDe(modoActivo: string, nombres: string | null): string {
  const saludo = nombres ? `Hola, ${nombres.split(" ")[0]}.` : "Hola.";
  return modoActivo === "abogado"
    ? `${saludo} Puedo darte tu agenda del día, tus casos asignados, los documentos de un expediente o cómo van tus honorarios.`
    : `${saludo} Puedo contarte cómo va tu caso, agendarte una cita o decirte qué documentos te faltan.`;
}
