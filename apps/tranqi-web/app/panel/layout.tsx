import { Suspense } from "react";
import { redirect } from "next/navigation";
import { SelloCompilacion } from "@eco/primitivas";
import {
  Home, Users, UserCog, Settings, ShieldCheck, CircleUser,
  Mail, Bell,
  ClipboardList, CalendarDays, FolderOpen, CreditCard, LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, asegurarMembresiaCliente, obtenerPerfiles } from "@eco/identidad";
import { CampanaNotificaciones } from "@eco/notificaciones";
import { EnlacePanel } from "./EnlacePanel";
import { CapaPerfilRail } from "./CapaPerfilRail";
import { crearClienteServidor } from "@eco/supabase/servidor";

const NEGOCIO = "tranqi";

const ICONOS_WIDGET: Record<string, LucideIcon> = {
  socios: Users,
  gestion_usuarios: UserCog,
  configuracion_negocio: Settings,
  auditoria: ShieldCheck,
  configuracion_correo: Mail,
  emision_notificaciones: Bell,
};

const SECCIONES_CLIENTE: { icono: LucideIcon; et: string }[] = [
  { icono: ClipboardList, et: "Mis trámites" },
  { icono: CalendarDays, et: "Citas" },
  { icono: FolderOpen, et: "Documentos" },
  { icono: CreditCard, et: "Pagos y plan" },
  { icono: LifeBuoy, et: "Ayuda" },
];

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const widgetsRaw = await obtenerWidgetsVisibles(perfil.usu_id, perfil.usu_superadmin_plataforma, NEGOCIO);
  // Filtrar configuracion_negocio y configuracion_correo porque ahora estan agrupados bajo el panel modular 'Configurar' (/panel/configuracion)
  const widgets = widgetsRaw.filter(w => w.wdg_clave !== "configuracion_negocio" && w.wdg_clave !== "configuracion_correo");

  const perfiles = await obtenerPerfiles(NEGOCIO);
  const clasePerfil = clasePerfilVisual(perfil.usu_superadmin_plataforma, perfiles);

  return (
    <Suspense fallback={<div className={`panel-layout ${clasePerfil}`}>{children}</div>}>
      <CapaPerfilRail claseBase={clasePerfil} puedeConmutar={perfil.usu_superadmin_plataforma}>
      <aside className="panel-nav">
        <svg className="cinta-rail" viewBox="0 0 236 900" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 200 -40 C 200 160 40 240 60 430 C 78 610 210 660 200 900" />
        </svg>

        <div className="panel-marca" style={{ display: "flex", alignItems: "center", justifyContent: "space-between", paddingRight: "12px" }}>
          <img src="/assets/tranqi-white.svg" alt="tranqi" />
          <CampanaNotificaciones negocio={NEGOCIO} usuarioId={perfil.usu_id} />
        </div>

        <div className="panel-nav-links">
          <EnlacePanel href="/panel" icono={<Home className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}>
            Inicio
          </EnlacePanel>
          {widgets.map((w) => {
            const IconoWidget = ICONOS_WIDGET[w.wdg_clave] ?? Home;
            return (
              <EnlacePanel
                key={w.wdg_clave}
                href={`/panel/${rutaDeWidget(w.wdg_clave)}`}
                icono={<IconoWidget className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}
              >
                {w.wdg_nombre}
              </EnlacePanel>
            );
          })}
          <EnlacePanel href="/panel/configuracion" icono={<Settings className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}>
            Configurar
          </EnlacePanel>
          <EnlacePanel href="/panel/cuenta" icono={<CircleUser className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}>
            Mi cuenta
          </EnlacePanel>

          {clasePerfil === "perfil-cliente" && (
            <>
              <div className="separador-nav">Pronto</div>
              {SECCIONES_CLIENTE.map((s) => (
                <span className="enlace-inerte" key={s.et}>
                  <s.icono className="icono-nav" aria-hidden="true" strokeWidth={1.8} />
                  <span className="etiqueta-nav">{s.et}</span>
                  <span className="chip-pronto-nav">pronto</span>
                </span>
              ))}
            </>
          )}
        </div>
        <div className="panel-usuario">
          <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
          <span className="correo-usuario-activo">{perfil.usu_correo}</span>
          <SelloCompilacion className="sello-compilacion" />
          {perfil.usu_superadmin_plataforma && <span className="etiqueta-superadmin">SuperAdmin</span>}
        </div>
      </aside>
        <main className="panel-contenido">{children}</main>
      </CapaPerfilRail>
    </Suspense>
  );
}

function clasePerfilVisual(esSuperadmin: boolean, perfiles: string[]): string {
  if (esSuperadmin) return "perfil-admin";
  if (perfiles.includes("ADMINISTRADOR")) return "perfil-admin";
  if (perfiles.includes("ABOGADO")) return "perfil-abogado";
  if (perfiles.includes("CLIENTE")) return "perfil-cliente";
  return "perfil-admin";
}

function rutaDeWidget(clave: string) {
  if (clave === "gestion_usuarios") return "usuarios";
  if (clave === "configuracion_negocio") return "configuracion";
  if (clave === "socios") return "socios";
  if (clave === "auditoria") return "auditoria";
  if (clave === "configuracion_correo") return "correo";
  if (clave === "emision_notificaciones") return "emision-notificaciones";
  return "";
}
