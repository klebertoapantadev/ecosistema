import { redirect } from "next/navigation";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { SelloCompilacion } from "@eco/primitivas";
import {
  cerrarSesion,
  asegurarMembresiaCliente,
  obtenerPerfilActual,
  obtenerRegistroNegocioDetalle,
} from "@eco/identidad";
import {
  MarcoPanelLateral,
  NavegacionPanelLateral,
  type ItemNavegacionPanel,
} from "@eco/configuracion-negocio";
import { CampanaNotificaciones } from "@eco/notificaciones";
import {
  AlertaInventarioRosasBanner,
  GestorPushChatsOmnicanal,
  obtenerMisProformasEventoAction,
} from "@eco/comercio";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { MarcoEcommerceClienteTinkay } from "../../modulos/ecommerce/componentes/MarcoEcommerceClienteTinkay";
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
    clave: "directorio_contactos",
    nombre: "Contactos y Listas WA",
    ruta: "/panel/contactos",
    icono: "contactos",
    grupo: "operacion",
  },
  {
    clave: "chat_equipo",
    nombre: "Chat del Equipo",
    ruta: "/panel/chat-equipo",
    icono: "chat_equipo",
    grupo: "operacion",
  },
  {
    clave: "envio_pedidos_taller",
    nombre: "Enviar Pedidos",
    ruta: "/panel/envio-pedidos",
    icono: "envio_pedidos",
    grupo: "operacion",
  },
  {
    clave: "taller_floral",
    nombre: "Taller",
    ruta: "/panel/taller",
    icono: "taller",
    grupo: "operacion",
  },
  {
    clave: "confirmacion_entregas",
    nombre: "Entregas e Informes GPS",
    ruta: "/panel/entregas",
    icono: "entregas_gps",
    grupo: "operacion",
  },
  {
    clave: "galeria_inmediata",
    nombre: "Entrega Inmediata (1–2h)",
    ruta: "/panel/entrega-inmediata",
    icono: "entrega_inmediata",
    grupo: "operacion",
  },
  {
    clave: "inventario_rosas",
    nombre: "Inventario de Rosas (IA)",
    ruta: "/panel/inventario-rosas",
    icono: "inventario",
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
    clave: "configuracion_marketing_meta",
    nombre: "Marketing & Meta",
    ruta: "/panel/marketing-meta",
    icono: "marketing_meta",
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

const COLOR_BADGE_ROL: Record<string, { bg: string; color: string }> = {
  SUPERADMIN: { bg: "rgba(200, 162, 90, 0.2)", color: "#E8D5AE" },
  ADMINISTRADOR: { bg: "rgba(126, 163, 137, 0.2)", color: "#D4E5D9" },
  OPERADOR: { bg: "rgba(255, 255, 255, 0.12)", color: "#EAE4DC" },
  VENTAS: { bg: "rgba(255, 255, 255, 0.12)", color: "#EAE4DC" },
  TALLER: { bg: "rgba(126, 163, 137, 0.18)", color: "#D4E5D9" },
  DELIVERY: { bg: "rgba(200, 162, 90, 0.16)", color: "#E8D5AE" },
  DELIVERY_EXTERNO: { bg: "rgba(200, 162, 90, 0.16)", color: "#E8D5AE" },
  CLIENTE: { bg: "rgba(255, 255, 255, 0.1)", color: "#EAE4DC" },
};

export default async function LayoutPanel({ children }: { children: React.ReactNode }) {
  const ctx = await obtenerContextoAccesoTinkay();
  const {
    rolPrincipal,
    etiquetaRol,
    rutaInicioRol,
    esSuperAdmin,
    esAdminTienda,
    esCliente,
    clavesAutorizadas,
  } = ctx;
  let perfil = ctx.perfil;
  if (!perfil) redirect("/ingresar");

  // Aislamiento estricto: si la sesión viene de otro negocio sin membresía en Tinkay, exigir ingreso/registro propio.
  // Si ya completó explícitamente la bienvenida de Tinkay pero quedó sin membresía por un fallo previo de RPC, auto-reparar una vez.
  if (!perfil.tiene_membresia_negocio && !esSuperAdmin) {
    const regTinkay = obtenerRegistroNegocioDetalle(perfil.usu_detalle_usuario, NEGOCIO);
    if (regTinkay?.onboarding_completo) {
      const supabase = await crearClienteServidor();
      const resReparacion = await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);
      if (resReparacion.ok) {
        const perfilRevalidado = await obtenerPerfilActual(NEGOCIO);
        if (perfilRevalidado?.tiene_membresia_negocio) {
          perfil = perfilRevalidado;
        }
      } else {
        redirect(`/ingresar?error=${encodeURIComponent(resReparacion.error)}`);
      }
    }

    if (!perfil.tiene_membresia_negocio) {
      redirect(
        `/ingresar?error=${encodeURIComponent(
          "Tu sesión no tiene una cuenta activa en Tinkay. Crea tu cuenta o continúa con Google para activar tu acceso."
        )}`
      );
    }
  }

  // PLT-001 regla 2: confirmar identidad + WhatsApp en Tinkay antes de usar el panel.
  if (!perfil.usu_onboarding_completo && !esSuperAdmin) redirect("/bienvenida");
  // Registro por correo/contraseña exige verificar el OTP enviado
  if (!perfil.usu_correo_verificado_en && !esSuperAdmin) redirect("/verificar-correo");

  if (esSuperAdmin && !perfil.tiene_membresia_negocio) {
    const supabase = await crearClienteServidor();
    await asegurarMembresiaCliente(supabase, perfil.usu_id, NEGOCIO);
  }

  // Si el usuario tiene rol CLIENTE, renderizar la experiencia 100% E-Commerce (sin menú lateral de gestión)
  if (esCliente) {
    const resMis = await obtenerMisProformasEventoAction(NEGOCIO).catch(() => ({
      ok: true as const,
      proformas: [],
    }));
    const lista = resMis.ok ? resMis.proformas : [];
    const estadosCompra = new Set([
      "PAGADO",
      "ORDEN_CONFIRMADA",
      "EN_PREPARACION",
      "EN_RUTA",
      "DESPACHADO",
      "ENTREGADO",
      "FACTURADA",
      "RESERVADA_70",
      "APROBADA",
    ]);
    const conteoPedidos = lista.filter(
      (p) =>
        p.tipoOrigen === "ORDEN_DIRECTA" ||
        estadosCompra.has((p.estado || "").toUpperCase())
    ).length;
    const conteoProformas = lista.filter((p) => p.tipoOrigen === "PROFORMA_EVENTO").length;
    const nombreComp =
      [perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ").trim() ||
      perfil.usu_correo ||
      "Cliente";
    const iniciales = (
      [perfil.usu_nombres?.[0], perfil.usu_apellidos?.[0]].filter(Boolean).join("") ||
      nombreComp[0] ||
      "C"
    ).toUpperCase();

    return (
      <MarcoEcommerceClienteTinkay
        usuarioId={perfil.usu_id}
        nombreCompleto={nombreComp}
        correo={perfil.usu_correo || ""}
        iniciales={iniciales}
        conteoPedidosInicial={conteoPedidos}
        conteoProformasInicial={conteoProformas}
        cerrarSesionAction={cerrarSesionYRedirigir}
      >
        {children}
      </MarcoEcommerceClienteTinkay>
    );
  }

  const navItemsVisibles: ItemNavegacionPanel[] = CATALOGO_NAV_TINKAY.filter(
    (m) =>
      clavesAutorizadas.has(m.clave) ||
      (esAdminTienda &&
        (m.clave === "facturacion_electronica" || m.clave === "configuracion_facturacion_sri"))
  );

  const estiloBadge = COLOR_BADGE_ROL[rolPrincipal] ?? COLOR_BADGE_ROL.CLIENTE!;

  return (
    <MarcoPanelLateral
      marcaNombre="tinkay"
      marcaHref={rutaInicioRol}
      etiquetaRol={etiquetaRol}
      estiloBadgeRol={estiloBadge}
      urlTienda="/"
      etiquetaTienda="Tienda"
      barraLateral={
        <>
          <div
            className="panel-marca"
            style={{
              padding: "0 6px",
              display: "flex",
              flexDirection: "column",
              gap: "2px",
            }}
          >
            <div
              className="panel-marca-fila"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
              }}
            >
              <Link
                href="/panel"
                title="Ir al inicio del panel Tinkay"
                style={{
                  color: "#FFFFFF",
                  textDecoration: "none",
                  fontSize: "1.35rem",
                  fontWeight: 600,
                  letterSpacing: "-0.01em",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <span className="panel-marca-completo">
                  <img
                    src="/img/logo/tinkay-logo.png?v=2"
                    alt="Tinkay"
                    style={{
                      height: "30px",
                      width: "auto",
                      maxWidth: "118px",
                      objectFit: "contain",
                      filter: "brightness(0) invert(1)",
                      display: "block",
                    }}
                  />
                </span>
                <span className="panel-marca-monograma">
                  <img
                    src="/img/logo/tinkay-isotipo.png?v=2"
                    alt="Tinkay"
                    style={{
                      height: "28px",
                      width: "28px",
                      objectFit: "contain",
                      filter: "brightness(0) invert(1)",
                      display: "block",
                    }}
                  />
                </span>
              </Link>
              <CampanaNotificaciones negocio={NEGOCIO} usuarioId={perfil.usu_id} />
            </div>
            <SelloCompilacion className="sello-compilacion" />
          </div>

          <div
            className="panel-usuario"
            style={{
              padding: "10px 11px",
              borderRadius: "11px",
              background: "rgba(255, 255, 255, 0.045)",
              border: "1px solid rgba(255, 255, 255, 0.08)",
              gap: "7px",
              opacity: 1,
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "9px",
                minWidth: 0,
              }}
            >
              <div
                title={`${[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || etiquetaRol} (${etiquetaRol})`}
                style={{
                  width: "34px",
                  height: "34px",
                  borderRadius: "999px",
                  background: estiloBadge.bg,
                  color: estiloBadge.color,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.78rem",
                  fontWeight: 800,
                  letterSpacing: "0.02em",
                  flexShrink: 0,
                  boxShadow: "0 2px 6px rgba(0, 0, 0, 0.25)",
                }}
              >
                {([perfil.usu_nombres?.[0], perfil.usu_apellidos?.[0]]
                  .filter(Boolean)
                  .join("") || etiquetaRol[0] || "T"
                ).toUpperCase()}
              </div>
              <div className="panel-usuario-textos" style={{ minWidth: 0, flex: 1 }}>
                <span
                  className="nombre-usuario-activo"
                  style={{
                    fontSize: "0.83rem",
                    color: "#FFFFFF",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {[perfil.usu_nombres, perfil.usu_apellidos].filter(Boolean).join(" ") || etiquetaRol}
                </span>
                <span
                  className="correo-usuario-activo"
                  style={{
                    fontSize: "0.71rem",
                    color: "rgba(255, 255, 255, 0.6)",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {perfil.usu_correo}
                </span>
              </div>
            </div>

            <div
              className="panel-usuario-acciones"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                gap: "8px",
                marginTop: "2px",
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
                    display: "inline-flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "5px",
                    padding: "5px 10px",
                    borderRadius: "7px",
                    border: "1px solid rgba(255, 255, 255, 0.16)",
                    background: "rgba(255, 255, 255, 0.06)",
                    color: "#FFFFFF",
                    fontFamily: "inherit",
                    fontSize: "0.73rem",
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  <LogOut size={13} />
                  <span className="panel-btn-salir-texto">Salir</span>
                </button>
              </form>
            </div>
          </div>

          <NavegacionPanelLateral items={navItemsVisibles} />
        </>
      }
    >
      <GestorPushChatsOmnicanal
        negocio={NEGOCIO}
        usuarioId={perfil.usu_id}
        rolPrincipal={rolPrincipal}
        puedeVerConversacionesClientes={clavesAutorizadas.has("consola_chat")}
      />
      {clavesAutorizadas.has("inventario_rosas") && (
        <AlertaInventarioRosasBanner negocio={NEGOCIO} horasLimite={15} />
      )}
      {children}
    </MarcoPanelLateral>
  );
}

async function cerrarSesionYRedirigir() {
  "use server";
  await cerrarSesion();
  redirect("/");
}
