import { redirect } from "next/navigation";
import { Home, Users, UserCog, Settings, ShieldCheck, CircleUser, type LucideIcon } from "lucide-react";
import { obtenerPerfilActual, obtenerWidgetsVisibles, asegurarMembresiaCliente, obtenerMembresia } from "@eco/identidad";
import { EnlacePanel } from "./EnlacePanel";
import { crearClienteServidor } from "@eco/supabase/servidor";

const NEGOCIO = "tranqi";

const ICONOS_WIDGET: Record<string, LucideIcon> = {
  socios: Users,
  gestion_usuarios: UserCog,
  configuracion_negocio: Settings,
  auditoria: ShieldCheck,
};

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  // PLT-001 regla 2: confirmar identidad + WhatsApp antes de usar el panel.
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");

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
    <div className={`panel-layout ${clasePerfil}`}>
      <aside className="panel-nav">
        <div className="panel-marca">tranqi</div>
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
    </div>
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
  return "";
}
