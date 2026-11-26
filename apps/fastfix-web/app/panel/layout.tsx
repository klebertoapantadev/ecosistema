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
  MarcoPanelLateral,
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
    clave: "consola_chat",
    nombre: "Ventas y Chats en Vivo",
    ruta: "/panel/conversaciones",
    icono: "conversaciones",
    grupo: "operacion",
  },
  {
    clave: "directorio_contactos",
    nombre: "Contactos y Listas WA",
    ruta: "/panel/contactos",
    icono: "contactos",
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
    clave: "facturacion_electronica",
    nombre: "Facturación Electrónica",
    ruta: "/panel/facturacion",
    icono: "facturacion",
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
    clave: "configuracion_facturacion_sri",
    nombre: "Facturación SRI",
    ruta: "/panel/facturacion-sri",
    icono: "facturacion_sri",
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
    clave: "configuracion_marketing_meta",
    nombre: "Marketing & Meta",
    ruta: "/panel/marketing-meta",
    icono: "marketing_meta",
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
  const perfil = await obtenerPerfilActual(NEGOCIO);
  if (!perfil) redirect("/ingresar");

  const correo = perfil.usu_correo?.toLowerCase().trim() || "";
  const esSuperAdmin =
    Boolean(perfil.usu_superadmin_plataforma) ||
    correo === "kleber.toapanta.ch@gmail.com" ||
    correo === "jesus251296@gmail.com" ||
    correo === "familiammtg@gmail.com";

  if (!perfil.tiene_membresia_negocio && !esSuperAdmin) redirect("/ingresar");
  if (!perfil.usu_onboarding_completo && !esSuperAdmin) redirect("/bienvenida");
  if (!perfil.usu_correo_verificado_en && !esSuperAdmin) redirect("/verificar-correo");

  if (esSuperAdmin && !perfil.tiene_membresia_negocio) {
    const supabase = await crearClienteServidor();
    await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);
  }

  const widgets = await obtenerWidgetsVisibles(perfil.usu_id, esSuperAdmin, NEGOCIO);
  const clavesVisibles = new Set<string>(["resumen", "cuenta"]);

  for (const w of widgets) {
    clavesVisibles.add(w.wdg_clave);
  }
  if (clavesVisibles.has("pedidos_tienda") || clavesVisibles.has("gestion_usuarios")) {
    clavesVisibles.add("consola_chat");
    clavesVisibles.add("directorio_contactos");
  }
  if (esSuperAdmin) {
    CATALOGO_NAV_FASTFIX.forEach((item) => clavesVisibles.add(item.clave));
  }

  const navItems = CATALOGO_NAV_FASTFIX.filter((item) => clavesVisibles.has(item.clave));

  return (
    <MarcoPanelLateral
      marcaNombre="FastFix Home"
      marcaHref="/panel"
      etiquetaRol={esSuperAdmin ? "SuperAdmin" : undefined}
      urlTienda="/"
      etiquetaTienda="Inicio"
      barraLateral={
        <>
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
        </>
      }
    >
      {children}
    </MarcoPanelLateral>
  );
}

async function cerrarSesionYRedirigir() {
  "use server";
  await cerrarSesion();
  redirect("/");
}
