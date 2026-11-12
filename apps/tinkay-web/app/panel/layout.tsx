import { redirect } from "next/navigation";
import Link from "next/link";
import { SelloCompilacion } from "@eco/primitivas";
import {
  obtenerPerfilActual,
  obtenerWidgetsVisibles,
  cerrarSesion,
  asegurarMembresiaCliente,
  obtenerPerfiles,
} from "@eco/identidad";
import {
  NavegacionPanelLateral,
  type ItemNavegacionPanel,
} from "@eco/configuracion-negocio";
import { crearClienteServidor } from "@eco/supabase/servidor";

const NEGOCIO = "tinkay";

const CATALOGO_NAV_TINKAY: Array<ItemNavegacionPanel & { soloAdmin?: boolean }> = [
  {
    clave: "resumen",
    nombre: "Resumen del Panel",
    ruta: "/panel",
    icono: "resumen",
    grupo: "operacion",
  },
  {
    clave: "pedidos_tienda",
    nombre: "Pedidos de Tienda",
    ruta: "/panel/pedidos",
    icono: "pedidos",
    grupo: "operacion",
    soloAdmin: true,
  },
  {
    clave: "catalogo_productos",
    nombre: "Catálogo Comercial",
    ruta: "/panel/catalogo-productos",
    icono: "catalogo",
    grupo: "operacion",
    soloAdmin: false,
  },
  {
    clave: "gestion_usuarios",
    nombre: "Usuarios y Roles",
    ruta: "/panel/usuarios",
    icono: "usuarios",
    grupo: "operacion",
    soloAdmin: true,
  },
  {
    clave: "configuracion_negocio",
    nombre: "Datos de la Floristería",
    ruta: "/panel/configuracion",
    icono: "negocio",
    grupo: "configuracion",
    soloAdmin: true,
  },
  {
    clave: "configuracion_logistica",
    nombre: "Envíos y Cobertura",
    ruta: "/panel/logistica",
    icono: "logistica",
    grupo: "configuracion",
    soloAdmin: true,
  },
  {
    clave: "configuracion_aria",
    nombre: "Agente ARIA (Mía)",
    ruta: "/panel/aria",
    icono: "aria",
    grupo: "configuracion",
    soloAdmin: true,
  },
  {
    clave: "configuracion_correo",
    nombre: "Servidor de Correo",
    ruta: "/panel/correo",
    icono: "correo",
    grupo: "configuracion",
    soloAdmin: true,
  },
  {
    clave: "tokens_mcp",
    nombre: "Tokens & MCP",
    ruta: "/panel/tokens-mcp",
    icono: "tokens",
    grupo: "configuracion",
    soloAdmin: true,
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
    correo === "jesus251296@gmail.com" ||
    correo === "tinkay.uio@gmail.com";
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

  const clavesAutorizadas = new Set<string>(["resumen", "catalogo_productos", "cuenta"]);

  if (esAdmin) {
    CATALOGO_NAV_TINKAY.forEach((m) => clavesAutorizadas.add(m.clave));
  } else {
    for (const w of widgets) {
      if (w.wdg_clave === "vitrina_comercial" || w.wdg_clave === "gestion_catalogo") {
        clavesAutorizadas.add("catalogo_productos");
      } else if (CATALOGO_NAV_TINKAY.some((m) => m.clave === w.wdg_clave)) {
        clavesAutorizadas.add(w.wdg_clave);
      }
    }
  }

  const navItemsVisibles: ItemNavegacionPanel[] = CATALOGO_NAV_TINKAY.filter((m) =>
    clavesAutorizadas.has(m.clave)
  ).map(({ clave, nombre, ruta, icono, grupo }) => ({
    clave,
    nombre,
    ruta,
    icono,
    grupo,
  }));

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
        <div
          className="panel-marca"
          style={{
            padding: "0 8px",
            display: "flex",
            flexDirection: "column",
            gap: "2px",
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
            {[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || "Administrador"}
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
