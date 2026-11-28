import { obtenerCatalogoProductosAction, type ProductoCatalogo } from "@eco/comercio";
import { crearClienteServidor } from "@eco/supabase/servidor";
import type { TramiteCatalogo, TramitePedido } from "./esquema";

/** Slug de la categoría del catálogo cuyos productos son trámites («Trámites Puntuales»). */
export const CATEGORIA_TRAMITES = "tramites";

function textos(valor: unknown): string[] {
  return Array.isArray(valor) ? valor.filter((v): v is string => typeof v === "string" && v.trim().length > 0) : [];
}

/** Variantes con las que tranqi puede guardar su negocio en los pagos (`normalizarIdentificadorNegocio`). */
const NEGOCIO_TRANQI = ["tranqi", "TRANQI", "TRANQ", "TRQ"];

function aTramite(p: ProductoCatalogo, incluirInactivas = false): TramiteCatalogo {
  const detalle = (p.pro_detalle_producto ?? {}) as Record<string, unknown>;
  return {
    productoId: p.pro_id,
    slug: p.pro_slug,
    nombre: p.pro_nombre,
    descripcion: p.pro_descripcion,
    tiempoEntrega: typeof detalle.tiempo_entrega === "string" && detalle.tiempo_entrega ? detalle.tiempo_entrega : null,
    requisitos: textos(detalle.requisitos),
    etiquetas: textos(detalle.etiquetas),
    opciones: p.variantes
      .filter((v) => incluirInactivas || (v.var_activo !== false && v.precio_total > 0))
      .map((v) => {
        const dv = (v.var_detalle_variante ?? {}) as Record<string, unknown>;
        return {
          variante: v,
          nombre: v.var_nombre,
          descripcion: typeof dv.descripcion_corta === "string" ? dv.descripcion_corta : null,
          concepto: typeof dv.concepto_derecho === "string" ? dv.concepto_derecho : null,
        };
      }),
  };
}

/**
 * Trámites del catálogo de tranqi, con sus opciones (variantes) y precios con IVA.
 * `incluirInactivos`: también los dados de baja, para reconocer pedidos antiguos.
 */
export async function listarTramitesDelCatalogo(incluirInactivos = false): Promise<TramiteCatalogo[]> {
  const productos = await obtenerCatalogoProductosAction("tranqi", undefined, incluirInactivos);
  return productos
    .filter((p) => p.categoria?.ctg_slug === CATEGORIA_TRAMITES && p.pro_tipo === "SERVICIO")
    .map((p) => aTramite(p, incluirInactivos))
    .filter((t) => t.opciones.length > 0);
}

/**
 * Trámites que el cliente autenticado ya pagó. No hay tabla de trámites: el pedido es el
 * pago aprobado de una opción del catálogo (`pag_detalle_transaccion.variante_id`).
 * RLS `com_pago_cliente_select` limita a sus propios pagos.
 */
export async function listarTramitesPedidos(): Promise<TramitePedido[]> {
  const supabase = await crearClienteServidor();
  const { data: auth } = await supabase.auth.getUser();
  const usuarioId = auth.user?.id;
  if (!usuarioId) return [];

  const [tramites, pagos] = await Promise.all([
    // Con los dados de baja: un trámite ya pagado no desaparece si sale del catálogo.
    listarTramitesDelCatalogo(true),
    supabase
      .schema("comun_comercio")
      .from("com_transaccion_pago")
      .select("pag_id, pag_creado_en, pag_confirmado_en, pag_monto_total, pag_detalle_transaccion")
      .eq("pag_cliente_id", usuarioId)
      .in("pag_negocio", NEGOCIO_TRANQI)
      .eq("pag_estado", "APROBADO")
      .order("pag_creado_en", { ascending: false })
      .limit(50),
  ]);
  // Un fallo no se disfraza de «no has pedido nada»: la acción lo convierte en aviso.
  if (pagos.error) throw new Error(pagos.error.message);

  const porVariante = new Map<string, { tramite: TramiteCatalogo; nombre: string }>();
  for (const t of tramites) for (const o of t.opciones) porVariante.set(o.variante.var_id, { tramite: t, nombre: o.nombre });

  const pedidos: TramitePedido[] = [];
  for (const pago of pagos.data ?? []) {
    const detalle = (pago.pag_detalle_transaccion ?? {}) as Record<string, unknown>;
    const varianteId = typeof detalle.variante_id === "string" ? detalle.variante_id : null;
    const encontrado = varianteId ? porVariante.get(varianteId) : undefined;
    if (!encontrado) continue;
    pedidos.push({
      id: pago.pag_id,
      nombre: encontrado.nombre,
      tramite: encontrado.tramite.nombre,
      pedidoEn: pago.pag_confirmado_en ?? pago.pag_creado_en,
      montoTotal: Number(pago.pag_monto_total ?? 0),
      tiempoEntrega: encontrado.tramite.tiempoEntrega,
    });
  }
  return pedidos;
}
