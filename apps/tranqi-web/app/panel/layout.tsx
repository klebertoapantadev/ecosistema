import { Suspense } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import { SelloCompilacion } from "@eco/primitivas";
import { obtenerPerfilActual, asegurarMembresiaCliente, obtenerPerfiles } from "@eco/identidad";
import { CampanaNotificaciones } from "@eco/notificaciones";
import { NavegacionSidebar } from "./NavegacionSidebar";
import { CapaPerfilRail } from "./CapaPerfilRail";
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
            <a href="/panel" style={{ display: "flex", alignItems: "center", textDecoration: "none" }} title="Ir al tablero principal (Inicio)">
              <img src="/assets/tranqi-white.svg" alt="tranqi" style={{ cursor: "pointer" }} />
            </a>
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
      </CapaPerfilRail>
    </Suspense>
  );
}
