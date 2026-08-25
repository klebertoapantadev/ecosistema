import Link from "next/link";
import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SelloCompilacion } from "@eco/primitivas";
import { obtenerPerfilActual, asegurarMembresiaCliente, obtenerPerfiles } from "@eco/identidad";
import { CampanaNotificaciones } from "@eco/notificaciones";
import { NavegacionSidebar } from "./NavegacionSidebar";
import { CapaPerfilRail } from "./CapaPerfilRail";
import { BarraAsistente } from "./asistente/BarraAsistente";
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

  return (
    <Suspense fallback={<div className={`panel-layout ${clasePerfil}`}>{children}</div>}>
      <CapaPerfilRail claseBase={clasePerfil}>
        <aside className="panel-nav">
          <svg className="cinta-rail" viewBox="0 0 236 900" preserveAspectRatio="none" aria-hidden="true">
            <path d="M 200 -40 C 200 160 40 240 60 430 C 78 610 210 660 200 900" />
          </svg>

          <div className="panel-marca" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: "12px" }}>
            <Link href="/panel" style={{ display: "flex", alignItems: "center", textDecoration: "none" }} title="Ir al tablero principal (Inicio)">
              <img src="/assets/tranqi-white.svg" alt="tranqi" style={{ cursor: "pointer" }} />
            </Link>
            <CampanaNotificaciones negocio={NEGOCIO} usuarioId={perfil.usu_id} />
          </div>

          <NavegacionSidebar modoActivo={modoActivo} negocio={NEGOCIO} />

          <div className="panel-usuario">
            <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
            <span className="correo-usuario-activo">{perfil.usu_correo}</span>
            <SelloCompilacion className="sello-compilacion" />
            <span className="etiqueta-superadmin" title="Perfil o modo activo de visualización actual">
              {perfil.usu_superadmin_plataforma ? `SuperAdmin (${modoActivo})` : `Rol Activo (${modoActivo})`}
            </span>
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
        {(modoActivo === "cliente" || modoActivo === "abogado") && (
          <BarraAsistente nombre="tranqi" saludo={saludoDe(modoActivo, perfil.usu_nombres)} />
        )}
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
