import { redirect } from "next/navigation";
import Link from "next/link";
import { SelloCompilacion } from "@eco/primitivas";
import {
  obtenerPerfilActual,
  obtenerWidgetsVisibles,
  cerrarSesion,
  asegurarMembresiaCliente,
} from "@eco/identidad";
import {
  NavegacionPanelLateral,
  type ItemNavegacionPanel,
} from "@eco/configuracion-negocio";
import { crearClienteServidor } from "@eco/supabase/servidor";

const NEGOCIO = "fastfix";

const CATALOGO_NAV_FASTFIX: ItemNavegacionPanel[] = [
  {
    clave: "resumen",
    nombre: "Resumen del Panel",
    ruta: "/panel",
    icono: "resumen",
    grupo: "operacion",
  },
  {
    clave: "pedidos_tienda",
    nombre: "Órdenes y Despachos",
    ruta: "/panel/pedidos",
    icono: "pedidos",
    grupo: "operacion",
  },
  {
    clave: "gestion_usuarios",
    nombre: "Usuarios y Roles",
    ruta: "/panel/usuarios",
    icono: "usuarios",
    grupo: "operacion",
  },
  {
    clave: "configuracion_negocio",
    nombre: "Datos del Negocio",
    ruta: "/panel/configuracion",
    icono: "negocio",
    grupo: "configuracion",
  },
  {
    clave: "configuracion_logistica",
    nombre: "Zonas y Cobertura",
    ruta: "/panel/logistica",
    icono: "logistica",
    grupo: "configuracion",
  },
  {
    clave: "configuracion_aria",
    nombre: "Agente ARIA",
    ruta: "/panel/aria",
    icono: "aria",
    grupo: "configuracion",
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo",
    ruta: "/panel/correo",
    icono: "correo",
    grupo: "configuracion",
  },
  {
    clave: "tokens_mcp",
    nombre: "Tokens & MCP",
    ruta: "/panel/tokens-mcp",
    icono: "tokens",
    grupo: "configuracion",
  },
  {
    clave: "cuenta",
    nombre: "Mi Cuenta",
    ruta: "/panel/cuenta",
    icono: "cuenta",
    grupo: "cuenta",
  },
];

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const perfil = await obtenerPerfilActual();
  if (!perfil) redirect("/ingresar");
  if (!perfil.usu_onboarding_completo) redirect("/bienvenida");
  if (!perfil.usu_correo_verificado_en) redirect("/verificar-correo");

  const supabase = await crearClienteServidor();
  await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);

  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdmin =
    Boolean(perfil.usu_superadmin_plataforma) ||
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "jesus251296@gmail.com" ||
    correo === "familiammtg@gmail.com";

  const widgets = await obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO);
  const clavesVisibles = new Set<string>(["resumen", "cuenta"]);

  for (const w of widgets) {
    clavesVisibles.add(w.wdg_clave);
  }
  if (esSuperAdmin) {
    CATALOGO_NAV_FASTFIX.forEach((item) => clavesVisibles.add(item.clave));
  }

  const navItems = CATALOGO_NAV_FASTFIX.filter((item) => clavesVisibles.has(item.clave));

  return (
    <div className="panel-layout">
      <aside
        className="panel-nav"
        style={{
          width: "260px",
          padding: "22px 16px",
          gap: "20px",
          borderRight: "1px solid rgba(255, 255, 255, 0.08)",
        }}
      >
        <div className="panel-marca" style={{ padding: "0 8px" }}>
          <Link href="/panel" style={{ color: "#FFFFFF", textDecoration: "none" }}>
            FastFix Home
          </Link>
          <SelloCompilacion className="sello-compilacion" />
        </div>
        <div
          className="panel-usuario"
          style={{
            padding: "12px",
            borderRadius: "10px",
            background: "rgba(255, 255, 255, 0.04)",
            border: "1px solid rgba(255, 255, 255, 0.08)",
            gap: "6px",
            opacity: 1,
          }}
        >
          <span className="nombre-usuario-activo" style={{ color: "#FFFFFF" }}>
            {[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ")}
          </span>
          <span className="correo-usuario-activo" style={{ wordBreak: "break-all" }}>
            {perfil.usu_correo}
          </span>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "8px", marginTop: "4px" }}>
            {esSuperAdmin ? <span className="etiqueta-superadmin">SuperAdmin</span> : <span />}
            <form action={cerrarSesionYRedirigir}>
              <button type="submit" className="btn-mini" title="Cerrar sesión" aria-label="Cerrar sesión">
                Salir
              </button>
            </form>
          </div>
        </div>
        <NavegacionPanelLateral items={navItems} />
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
