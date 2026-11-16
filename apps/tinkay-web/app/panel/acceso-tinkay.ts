import { obtenerPerfilActual, type PerfilUsuario } from "@eco/identidad";
import { sincronizarAccesoRolTinkayAction } from "@eco/gestion-usuarios";

export type RolTinkayPortal =
  | "SUPERADMIN"
  | "ADMINISTRADOR"
  | "OPERADOR"
  | "VENTAS"
  | "TALLER"
  | "DELIVERY"
  | "DELIVERY_EXTERNO"
  | "CLIENTE";

export interface ContextoAccesoTinkay {
  perfil: PerfilUsuario | null;
  rolPrincipal: RolTinkayPortal;
  etiquetaRol: string;
  rutaInicioRol: string;
  esSuperAdmin: boolean;
  esAdminTienda: boolean;
  esPersonalTienda: boolean;
  esCliente: boolean;
  clavesAutorizadas: Set<string>;
}

const ETIQUETAS_ROL: Record<RolTinkayPortal, string> = {
  SUPERADMIN: "SuperAdmin",
  ADMINISTRADOR: "Administrador",
  OPERADOR: "Operador",
  VENTAS: "Ventas",
  TALLER: "Taller",
  DELIVERY: "Delivery Interno",
  DELIVERY_EXTERNO: "Delivery Externo",
  CLIENTE: "Cliente",
};

/**
 * Ruta de aterrizaje directo al abrir el portal o la PWA instalada (`/panel`).
 * Los roles operativos específicos entran directo a su herramienta sin pasar por un menú intermedio.
 */
export function obtenerRutaAterrizajePorRolTinkay(rol: RolTinkayPortal): string | null {
  switch (rol) {
    case "VENTAS":
      return "/panel/conversaciones";
    case "TALLER":
      return "/panel/taller";
    case "DELIVERY":
    case "DELIVERY_EXTERNO":
      return "/panel/entregas";
    default:
      return null;
  }
}

const MODULOS_POR_ROL: Record<RolTinkayPortal, string[]> = {
  SUPERADMIN: [
    "resumen",
    "consola_chat",
    "envio_pedidos_taller",
    "taller_floral",
    "confirmacion_entregas",
    "galeria_inmediata",
    "inventario_rosas",
    "pedidos_tienda",
    "facturacion_electronica",
    "catalogo_productos",
    "gestion_usuarios",
    "testimonios_clientes",
    "configuracion_negocio",
    "configuracion_facturacion_sri",
    "configuracion_logistica",
    "pasarelas_pago",
    "configuracion_aria",
    "servidor_correo",
    "tokens_mcp",
    "cuenta",
  ],
  ADMINISTRADOR: [
    "resumen",
    "consola_chat",
    "envio_pedidos_taller",
    "taller_floral",
    "confirmacion_entregas",
    "galeria_inmediata",
    "inventario_rosas",
    "pedidos_tienda",
    "facturacion_electronica",
    "catalogo_productos",
    "gestion_usuarios",
    "testimonios_clientes",
    "configuracion_negocio",
    "configuracion_facturacion_sri",
    "configuracion_logistica",
    "pasarelas_pago",
    "configuracion_aria",
    "servidor_correo",
    "tokens_mcp",
    "cuenta",
  ],
  OPERADOR: [
    "resumen",
    "consola_chat",
    "envio_pedidos_taller",
    "taller_floral",
    "confirmacion_entregas",
    "galeria_inmediata",
    "inventario_rosas",
    "pedidos_tienda",
    "facturacion_electronica",
    "catalogo_productos",
    "testimonios_clientes",
    "configuracion_logistica",
    "cuenta",
  ],
  // Ventas: concentrado en chats, envío de órdenes de trabajo, proformas/pedidos, entrega inmediata e inventario
  VENTAS: [
    "consola_chat",
    "envio_pedidos_taller",
    "pedidos_tienda",
    "galeria_inmediata",
    "inventario_rosas",
    "cuenta",
  ],
  // Taller: producción floral sin precios + inventario de rosas + entrega inmediata
  TALLER: ["taller_floral", "inventario_rosas", "galeria_inmediata", "cuenta"],
  // Delivery Interno y Subcontratado: únicamente confirmación de entregas + GPS en ruta
  DELIVERY: ["confirmacion_entregas", "cuenta"],
  DELIVERY_EXTERNO: ["confirmacion_entregas", "cuenta"],
  CLIENTE: ["resumen", "mis_compras", "mis_proformas", "cuenta"],
};

export async function obtenerContextoAccesoTinkay(): Promise<ContextoAccesoTinkay> {
  const [perfil, sync] = await Promise.all([
    obtenerPerfilActual("tinkay"),
    sincronizarAccesoRolTinkayAction(),
  ]);

  if (!perfil) {
    return {
      perfil: null,
      rolPrincipal: "CLIENTE",
      etiquetaRol: "Cliente",
      rutaInicioRol: "/panel",
      esSuperAdmin: false,
      esAdminTienda: false,
      esPersonalTienda: false,
      esCliente: true,
      clavesAutorizadas: new Set(MODULOS_POR_ROL.CLIENTE),
    };
  }

  const rolPrincipal: RolTinkayPortal = sync.rolEfectivo || "CLIENTE";
  const esSuperAdmin = rolPrincipal === "SUPERADMIN";
  const esAdminTienda = rolPrincipal === "SUPERADMIN" || rolPrincipal === "ADMINISTRADOR";
  const esPersonalTienda =
    esAdminTienda ||
    rolPrincipal === "OPERADOR" ||
    rolPrincipal === "VENTAS" ||
    rolPrincipal === "TALLER" ||
    rolPrincipal === "DELIVERY" ||
    rolPrincipal === "DELIVERY_EXTERNO";
  const esCliente = rolPrincipal === "CLIENTE";

  return {
    perfil,
    rolPrincipal,
    etiquetaRol: ETIQUETAS_ROL[rolPrincipal] || "Cliente",
    rutaInicioRol: obtenerRutaAterrizajePorRolTinkay(rolPrincipal) || "/panel",
    esSuperAdmin,
    esAdminTienda,
    esPersonalTienda,
    esCliente,
    clavesAutorizadas: new Set(MODULOS_POR_ROL[rolPrincipal] || MODULOS_POR_ROL.CLIENTE),
  };
}
