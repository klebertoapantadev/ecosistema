import { redirect } from "next/navigation";
import Link from "next/link";
import { obtenerPerfilActual, obtenerWidgetsVisiblesTranqi } from "@/modulos/identidad/consultas";
import { cerrarSesion, asegurarMembresiaCliente } from "@/modulos/identidad/acciones";
import { crearClienteServidor } from "@/lib/supabase/server";

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  // PLT-001 regla 2: confirmar identidad + WhatsApp antes de usar el panel.
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");

  // Auto-reparacion: si signUp() se completo bajo "confirmar correo" activo,
  // no habia sesion todavia y la membresia CLIENTE pudo no crearse (ver
  // asegurarMembresiaCliente en acciones.ts). Aqui SI hay sesion valida
  // garantizada (ya se redirigio arriba si no la hay), asi que es el lugar
  // confiable para completar el aprovisionamiento si quedo pendiente.
  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id);

  const widgets = await obtenerWidgetsVisiblesTranqi(perfil.usu_id, perfil.usu_superadmin_plataforma);

  return (
    <div className="panel-layout">
      <aside className="panel-nav">
        <div className="panel-marca">tranqi</div>
        {/* div, no <nav>: el <nav> global de la landing es position:fixed y
            rompería este layout -- ver globals.css */}
        <div className="panel-nav-links">
          {widgets.map((w) => (
            <Link key={w.wdg_clave} href={`/panel/${rutaDeWidget(w.wdg_clave)}`}>
              {w.wdg_nombre}
            </Link>
          ))}
          <Link href="/panel/configuracion">Configuración del negocio</Link>
          <Link href="/panel/cuenta">Mi cuenta</Link>
        </div>
        <div className="panel-usuario">
          {/* Identificador del usuario activo en el portal: el nombre que
              confirmo en /bienvenida, no el correo crudo de Google. */}
          <span className="nombre-usuario-activo">{[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}</span>
          <span className="correo-usuario-activo">{perfil.usu_correo}</span>
          {perfil.usu_superadmin_plataforma && <span className="etiqueta-superadmin">SuperAdmin</span>}
          <form action={cerrarSesionYRedirigir}>
            <button type="submit" className="btn-mini">Cerrar sesión</button>
          </form>
        </div>
      </aside>
      <main className="panel-contenido">{children}</main>
    </div>
  );
}

function rutaDeWidget(clave: string) {
  // Mapeo explicito clave->ruta; evita construir rutas arbitrarias desde datos.
  if (clave === "gestion_usuarios") return "usuarios";
  return "";
}

async function cerrarSesionYRedirigir() {
  "use server";
  await cerrarSesion();
  redirect("/");
}
