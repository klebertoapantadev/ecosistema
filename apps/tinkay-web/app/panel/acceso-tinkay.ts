import { obtenerPerfilActual, type PerfilUsuario } from "@eco/identidad";
import { sincronizarAccesoRolTinkayAction } from "@eco/gestion-usuarios";

export type RolTinkayPortal =
  | "SUPERADMIN"
  | "ADMINISTRADOR"
  | "OPERADOR"
  | "VENTAS"
  | "DELIVERY"
  | "CLIENTE";

export interface ContextoAccesoTinkay {
  perfil: PerfilUsuario | null;
  rolPrincipal: RolTinkayPortal;
  etiquetaRol: string;
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
  DELIVERY: "Delivery",
  CLIENTE: "Cliente",
};

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
  VENTAS: [
    "resumen",
    "consola_chat",
    "envio_pedidos_taller",
    "galeria_inmediata",
    "inventario_rosas",
    "pedidos_tienda",
    "facturacion_electronica",
    "catalogo_productos",
    "testimonios_clientes",
    "cuenta",
  ],
  DELIVERY: ["resumen", "taller_floral", "confirmacion_entregas", "pedidos_tienda", "cuenta"],
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
    rolPrincipal === "DELIVERY";
  const esCliente = rolPrincipal === "CLIENTE";

  return {
    perfil,
    rolPrincipal,
    etiquetaRol: ETIQUETAS_ROL[rolPrincipal] || "Cliente",
    esSuperAdmin,
    esAdminTienda,
    esPersonalTienda,
    esCliente,
    clavesAutorizadas: new Set(MODULOS_POR_ROL[rolPrincipal] || MODULOS_POR_ROL.CLIENTE),
  };
}
