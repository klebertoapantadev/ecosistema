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

function modoValido(valor: string | undefined): ModoRol | null {
  if (!valor || !valor.trim()) return null;
  return valor.toLowerCase().trim() as ModoRol;
}

function modoDePerfiles(perfiles: string[]): ModoRol {
  if (perfiles.includes("SUPERADMIN")) return "superadmin";
  if (perfiles.includes("ADMINISTRADOR")) return "admin";
  if (perfiles.includes("ABOGADO")) return "abogado";
  if (perfiles.includes("OPERADOR")) return "operador";
  return (perfiles[0]?.toLowerCase() ?? "cliente") as ModoRol;
}

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const perfiles = await obtenerPerfiles(NEGOCIO);

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
  const modoCookie = modoValido(cookieStore.get("tranqi_modo_rol")?.value)
    || modoValido(cookieStore.get("tranqi_rol_favorito")?.value);
  const modoActivo: ModoRol = modoCookie ? modoCookie : modoDePerfiles(perfiles);

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

          <NavegacionSidebar modoActivo={modoActivo} negocio={NEGOCIO} />

          {/* TRQ-013: la etiqueta amarilla "Rol Activo" sale del rail; el
              cambio de rol vive en el menú de cuenta del inicio y en Mi cuenta
              (widget ver_como), y el color del rail ya dice el perfil. Se
              queda solo para el superadmin: le recuerda que está viendo la
              plataforma con el rol de otro, y eso es un aviso, no decoración. */}
          <div className="panel-usuario">
            <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
            <span className="correo-usuario-activo">{perfil.usu_correo}</span>
            <SelloCompilacion className="sello-compilacion" />
            {perfil.usu_superadmin_plataforma && (
              <Link
                href="/panel/cuenta?widget=ver_como"
                className="etiqueta-superadmin"
                title="Cambiar el rol con el que ves la plataforma"
              >
                {`SuperAdmin (${modoActivo}) ▾`}
              </Link>
            )}
          </div>
        </aside>
        <main className="panel-contenido">{children}</main>

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
