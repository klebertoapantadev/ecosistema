import { redirect } from "next/navigation";
import { SelloCompilacion } from "@eco/primitivas";
import Link from "next/link";
import {
  obtenerPerfilActual,
  obtenerWidgetsVisibles,
  cerrarSesion,
  asegurarMembresiaCliente,
  obtenerPerfiles,
} from "@eco/identidad";
import { crearClienteServidor } from "@eco/supabase/servidor";

const NEGOCIO = "tinkay";

interface ItemNavegacionTinkay {
  clave: string;
  nombre: string;
  ruta: string;
  soloAdmin?: boolean;
}

const MODULOS_NAV_TINKAY: ItemNavegacionTinkay[] = [
  {
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial & Portafolio",
    ruta: "/panel/catalogo-productos",
    soloAdmin: false,
  },
  {
    clave: "gestion_usuarios",
    nombre: "Gestión de Usuarios & Roles",
    ruta: "/panel/usuarios",
    soloAdmin: true,
  },
  {
    clave: "tokens_mcp",
    nombre: "Tokens & Servidor MCP",
    ruta: "/panel/tokens-mcp",
    soloAdmin: true,
  },
  {
    clave: "configuracion_negocio",
    nombre: "Configuración de la Floristería",
    ruta: "/panel/configuracion",
    soloAdmin: true,
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo (SMTP)",
    ruta: "/panel/correo",
    soloAdmin: true,
  },
];

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  // PLT-001 regla 2: confirmar identidad + WhatsApp antes de usar el panel.
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  // Registro por correo/contraseña exige verificar el OTP enviado -- Google
  // OAuth ya llega verificado (ver seg_fn_provisionar_usuario()).
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  // Auto-reparación de membresía si fue interrumpida
  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdminEmail =
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "familiammtg@gmail.com" ||
    correo === "jesus251296@gmail.com";
  const esSuperAdmin = esSuperAdminEmail || Boolean(perfil.usu_superadmin_plataforma);

  const perfiles = await obtenerPerfiles(NEGOCIO);
  const widgets = await obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO);

  const esAdmin =
    esSuperAdmin ||
    perfiles.some((p) =>
      ["ADMINISTRADOR", "SUPERADMIN", "OPERADOR"].includes(p.toUpperCase().trim())
    ) ||
    widgets.some((w) =>
      ["gestion_usuarios", "catalogo_productos", "configuracion_negocio"].includes(w.wdg_clave)
    );

  // Determinar enlaces visibles exclusivos de Tinkay (excluyendo cualquier widget de otros negocios)
  const clavesAutorizadas = new Set<string>();

  // El catálogo comercial es el núcleo de la floristería y siempre está disponible
  clavesAutorizadas.add("catalogo_productos");

  if (esAdmin) {
    MODULOS_NAV_TINKAY.forEach((m) => clavesAutorizadas.add(m.clave));
  } else {
    for (const w of widgets) {
      if (w.wdg_clave === "vitrina_comercial" || w.wdg_clave === "gestion_catalogo") {
        clavesAutorizadas.add("catalogo_productos");
      } else if (MODULOS_NAV_TINKAY.some((m) => m.clave === w.wdg_clave)) {
        clavesAutorizadas.add(w.wdg_clave);
      }
    }
  }

  const navLinksVisibles = MODULOS_NAV_TINKAY.filter((m) => clavesAutorizadas.has(m.clave));

  return (
    <div className="panel-layout">
      <aside className="panel-nav">
        <div className="panel-marca">
          tinkay
          <SelloCompilacion className="sello-compilacion" />
        </div>
        <div className="panel-usuario">
          <span className="nombre-usuario-activo">
            {[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}
          </span>
          <span className="correo-usuario-activo">{perfil.usu_correo}</span>
          {esSuperAdmin ? (
            <span className="etiqueta-superadmin">SuperAdmin</span>
          ) : esAdmin ? (
            <span
              className="etiqueta-superadmin"
              style={{ background: "#3D5A45", color: "#FFFFFF" }}
            >
              Administrador
            </span>
          ) : null}
          <form action={cerrarSesionYRedirigir}>
            <button type="submit" className="btn-mini">
              Cerrar sesión
            </button>
          </form>
        </div>
        <div className="panel-nav-links">
          {navLinksVisibles.map((item) => (
            <Link key={item.clave} href={item.ruta}>
              {item.nombre}
            </Link>
          ))}
          <Link href="/panel/cuenta">Mi cuenta</Link>
        </div>
      </aside>
      <main className="panel-contenido">{children}</main>
    </div>
  );
}

async function cerrarSesionYRedirigir() {
  "use server";
  await cerrarSesion();
  redirect("/");
}
