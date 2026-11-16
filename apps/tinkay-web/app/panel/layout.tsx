import { redirect } from "next/navigation";
import Link from "next/link";
import { SelloCompilacion } from "@eco/primitivas";
import {
  cerrarSesion,
  asegurarMembresiaCliente,
} from "@eco/identidad";
import {
  MarcoPanelLateral,
  NavegacionPanelLateral,
  type ItemNavegacionPanel,
} from "@eco/configuracion-negocio";
import { CampanaNotificaciones } from "@eco/notificaciones";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { obtenerContextoAccesoTinkay } from "./acceso-tinkay";

const NEGOCIO = "tinkay";

const CATALOGO_NAV_TINKAY: Array<ItemNavegacionPanel> = [
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
    clave: "pedidos_tienda",
    nombre: "Pedidos de Tienda",
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
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial",
    ruta: "/panel/catalogo-productos",
    icono: "catalogo",
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
    clave: "testimonios_clientes",
    nombre: "Testimonios y Reseñas",
    ruta: "/panel/testimonios",
    icono: "testimonios",
    grupo: "operacion",
  },
  {
    clave: "configuracion_negocio",
    nombre: "Datos de la Floristería",
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
    nombre: "Envíos y Cobertura",
    ruta: "/panel/logistica",
    icono: "logistica",
    grupo: "configuracion",
  },
  {
    clave: "pasarelas_pago",
    nombre: "Pasarela de Pagos",
    ruta: "/panel/pasarelas",
    icono: "pasarelas",
    grupo: "configuracion",
  },
  {
    clave: "configuracion_aria",
    nombre: "Agente ARIA (Mía)",
    ruta: "/panel/aria",
    icono: "aria",
    grupo: "configuracion",
  },
  {
    clave: "servidor_correo",
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

const CATALOGO_NAV_CLIENTE_TINKAY: Array<ItemNavegacionPanel> = [
  {
    clave: "resumen",
    nombre: "Mis Compras y Proformas",
    ruta: "/panel",
    icono: "pedidos",
    grupo: "operacion",
  },
  {
    clave: "tienda_floral",
    nombre: "Catálogo de la Tienda",
    ruta: "/#catalogo",
    icono: "catalogo",
    grupo: "operacion",
  },
  {
    clave: "cotizar_evento",
    nombre: "Cotizar un Evento",
    ruta: "/#eventos",
    icono: "resumen",
    grupo: "operacion",
  },
  {
    clave: "cuenta",
    nombre: "Mi Cuenta",
    ruta: "/panel/cuenta",
    icono: "cuenta",
    grupo: "cuenta",
  },
];

const COLOR_BADGE_ROL: Record<string, { bg: string; color: string }> = {
  SUPERADMIN: { bg: "#C27D5F", color: "#FFFFFF" },
  ADMINISTRADOR: { bg: "#3D5A45", color: "#FFFFFF" },
  OPERADOR: { bg: "#15803D", color: "#FFFFFF" },
  VENTAS: { bg: "#1D4ED8", color: "#FFFFFF" },
  DELIVERY: { bg: "#B45309", color: "#FFFFFF" },
  CLIENTE: { bg: "rgba(255, 255, 255, 0.14)", color: "#F5F2EB" },
};

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContextoAccesoTinkay();
  const { perfil, rolPrincipal, etiquetaRol, esSuperAdmin, esAdminTienda, esCliente, clavesAutorizadas } = ctx;
  if (!perfil) redirect("/ingresar");

  // Aislamiento estricto: si la sesión viene de otro negocio sin membresía en Tinkay, exigir ingreso/registro propio
  if (!perfil.tiene_membresia_negocio && !esSuperAdmin) {
    redirect("/ingresar");
  }

  // PLT-001 regla 2: confirmar identidad + WhatsApp en Tinkay antes de usar el panel.
  if (!perfil.usu_onboarding_completo && !esSuperAdmin) redirect("/bienvenida");
  // Registro por correo/contraseña exige verificar el OTP enviado
  if (!perfil.usu_correo_verificado_en && !esSuperAdmin) redirect("/verificar-correo");

  if (esSuperAdmin && !perfil.tiene_membresia_negocio) {
    const supabase = await crearClienteServidor();
    await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);
  }

  const navItemsVisibles: ItemNavegacionPanel[] = esCliente
    ? CATALOGO_NAV_CLIENTE_TINKAY
    : CATALOGO_NAV_TINKAY.filter(
        (m) =>
          clavesAutorizadas.has(m.clave) ||
          (esAdminTienda &&
            (m.clave === "facturacion_electronica" || m.clave === "configuracion_facturacion_sri"))
      );

  const estiloBadge = COLOR_BADGE_ROL[rolPrincipal] ?? COLOR_BADGE_ROL.CLIENTE!;

  return (
    <MarcoPanelLateral
      marcaNombre="tinkay"
      marcaHref="/panel"
      etiquetaRol={etiquetaRol}
      estiloBadgeRol={estiloBadge}
      urlTienda="/"
      etiquetaTienda="Tienda"
      barraLateral={
        <>
          <div
            className="panel-marca"
            style={{
              padding: "0 8px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <Link
                href="/panel"
                style={{
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "1.35rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                }}
              >
                tinkay
              </Link>
              <CampanaNotificaciones negocio={NEGOCIO} usuarioId={perfil.usu_id} />
            </div>
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
            <span className="nombre-usuario-activo" style={{ fontSize: "0.86rem", color: "#FFFFFF" }}>
              {[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || etiquetaRol}
            </span>
            <span
              className="correo-usuario-activo"
              style={{
                fontSize: "0.74rem",
                color: "rgba(255, 255, 255, 0.65)",
                wordBreak: "break-all",
              }}
            >
              {perfil.usu_correo}
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginTop: "6px",
                flexWrap: "wrap",
              }}
            >
              <span
                className="etiqueta-superadmin"
                style={{
                  background: estiloBadge.bg,
                  color: estiloBadge.color,
                }}
              >
                {etiquetaRol}
              </span>
              <form action={cerrarSesionYRedirigir}>
                <button
                  type="submit"
                  title="Cerrar sesión activa"
                  aria-label="Cerrar sesión activa"
                  style={{
                    padding: "5px 11px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255, 255, 255, 0.18)",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "#FFFFFF",
                    fontFamily: "inherit",
                    fontSize: "0.74rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Salir
                </button>
              </form>
            </div>
          </div>

          <NavegacionPanelLateral items={navItemsVisibles} />
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
