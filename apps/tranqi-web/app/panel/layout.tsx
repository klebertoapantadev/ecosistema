import { Suspense } from "react";
import { redirect } from "next/navigation";
import {
  Home, Users, UserCog, Settings, ShieldCheck, CircleUser,
  Mail,
  ClipboardList, CalendarDays, FolderOpen, CreditCard, LifeBuoy,
  type LucideIcon,
} from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, asegurarMembresiaCliente, obtenerMembresia } from "@eco/identidad";
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
};

// Secciones del rail de maqueta-cliente.html sin pantalla todavia. El orden es
// el de la maqueta.
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
  // PLT-001 regla 2: confirmar identidad + WhatsApp antes de usar el panel.
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  // Registro por correo/contraseña exige verificar el OTP enviado -- Google
  // OAuth ya llega verificado (ver seg_fn_provisionar_usuario()).
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  // Auto-reparacion: si signUp() se completo bajo "confirmar correo" activo,
  // no habia sesion todavia y la membresia CLIENTE pudo no crearse (ver
  // asegurarMembresiaCliente en @eco/identidad). Aqui SI hay sesion valida
  // garantizada (ya se redirigio arriba si no la hay), asi que es el lugar
  // confiable para completar el aprovisionamiento si quedo pendiente.
  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const widgets = await obtenerWidgetsVisibles(perfil.usu_id, perfil.usu_superadmin_plataforma, NEGOCIO);

  // Perfil visual del rail (§4 del sistema visual). Va DESPUES de
  // asegurarMembresiaCliente, que es lo que garantiza que haya fila que leer.
  const membresia = await obtenerMembresia(perfil.usu_id, NEGOCIO);
  const clasePerfil = clasePerfilVisual(perfil.usu_superadmin_plataforma, membresia?.mem_rol);

  return (
    <Suspense fallback={<div className={`panel-layout ${clasePerfil}`}>{children}</div>}>
      <CapaPerfilRail claseBase={clasePerfil} puedeConmutar={perfil.usu_superadmin_plataforma}>
      <aside className="panel-nav">
        {/* La cinta como textura del rail (§7), en los tres perfiles. El path es
            el de maqueta-cliente.html; preserveAspectRatio="none" lo estira a la
            altura real del rail.

            Su intensidad la gradúa el CSS por perfil, no un condicional aquí:
            el perfil puede cambiar en cliente al usar el conmutador, y un
            condicional de servidor dejaría el rail sin textura hasta recargar. */}
        <svg className="cinta-rail" viewBox="0 0 236 900" preserveAspectRatio="none" aria-hidden="true">
          <path d="M 200 -40 C 200 160 40 240 60 430 C 78 610 210 660 200 900" />
        </svg>

        <div className="panel-marca">
          <img src="/assets/tranqi-white.svg" alt="tranqi" />
        </div>
        {/* div, no <nav>: el <nav> global de la landing es position:fixed y
            rompería este layout -- ver globals.css */}
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
          <EnlacePanel href="/panel/cuenta" icono={<CircleUser className="icono-nav" aria-hidden="true" strokeWidth={1.8} />}>
            Mi cuenta
          </EnlacePanel>

          {/* Secciones del rail de la maqueta de cliente que todavía no tienen
              pantalla. Se dibujan apagadas y etiquetadas, no como enlaces
              vivos: mantienen la forma del rail aprobado sin prometer un
              destino que no responde. Son <span>, así que no reciben foco ni
              clic. Solo para el perfil cliente -- un administrador tiene su
              consola real y no necesita ver un mapa de lo que vendrá. */}
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
          {/* Identificador del usuario activo en el portal: el nombre que
              confirmo en /bienvenida, no el correo crudo de Google. Cerrar
              sesion vive en Mi cuenta (TRQ-001 correccion de UX) -- este
              bloque ya solo identifica, no ejecuta acciones. */}
          <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
          <span className="correo-usuario-activo">{perfil.usu_correo}</span>
          {perfil.usu_superadmin_plataforma && <span className="etiqueta-superadmin">SuperAdmin</span>}
        </div>
      </aside>
        <main className="panel-contenido">{children}</main>
      </CapaPerfilRail>
    </Suspense>
  );
}

/** Clase de perfil que colorea el rail — solo apariencia, ningún permiso.
 *
 *  El flag de plataforma manda sobre `mem_rol`, y no es un caso teórico: hay
 *  superadmins cuya membresía en tranqi es CLIENTE (se crea sola al
 *  registrarse, ver `asegurarMembresiaCliente`). Mirando solo `mem_rol`
 *  verían el rail violeta de cliente teniendo delante la consola de
 *  administración, que es justo la confusión que la regla 2 evita.
 *
 *  Sin membresía todavía cae en administración, no en cliente: el negro es el
 *  rail neutro y es mejor no afirmar un perfil que afirmar el equivocado. */
function clasePerfilVisual(esSuperadmin: boolean, memRol: string | null | undefined): string {
  if (esSuperadmin) return "perfil-admin";
  if (memRol === "CLIENTE") return "perfil-cliente";
  if (memRol === "ABOGADO") return "perfil-abogado";
  return "perfil-admin";
}

function rutaDeWidget(clave: string) {
  // Mapeo explicito clave->ruta; evita construir rutas arbitrarias desde datos.
  if (clave === "gestion_usuarios") return "usuarios";
  if (clave === "configuracion_negocio") return "configuracion";
  if (clave === "socios") return "socios";
  if (clave === "auditoria") return "auditoria";
  if (clave === "configuracion_correo") return "correo";
  return "";
}
