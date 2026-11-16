"use server";

import { revalidatePath } from "next/cache";
import {
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  extraerConteoJsonDesdeRespuestaAria,
  type ArregloEntregaInmediata,
  type ConvenioEntregaConfig,
  type CorteInventarioRosas,
  type DatosProveedorInformeIess,
  type FotoConteoBonches,
  type InformeQuincenalEntregas,
  type PedidoPendienteConfirmacion,
  type RegistroEntregaEvidencia,
  type TipoOrigenEntrega,
} from "./operaciones-taller";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

function normalizarNegocio(negocio?: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}

function esErrorMigracionPendiente(msg?: string | null): boolean {
  const m = String(msg ?? "").toLowerCase();
  return (
    m.includes("com_fn_") ||
    m.includes("could not find the function") ||
    m.includes("pgrst202") ||
    m.includes("does not exist")
  );
}

function revalidarRutasTienda(negocio: string) {
  try {
    revalidatePath("/");
    revalidatePath("/categoria/entrega-inmediata");
    revalidatePath("/panel/entrega-inmediata");
    revalidatePath("/panel/inventario-rosas");
    revalidatePath("/panel/entregas");
    revalidatePath("/panel/pedidos");
    revalidatePath("/panel/conversaciones");
    void negocio;
  } catch {
    // Ignorar fuera de contexto de request Next.js (ej. tests unitarios)
  }
}

// =============================================================================
// 1. INVENTARIO FOTOGRÁFICO DE ROSAS CON VISIÓN IA (ARIA)
// =============================================================================

export async function obtenerInventarioRosasAction(negocio: string): Promise<
  | {
      ok: true;
      ultimoCorte: CorteInventarioRosas | null;
      historial: CorteInventarioRosas[];
      migracionPendiente?: boolean;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_obtener_inventario_rosas", {
      p_negocio: neg,
    });

    if (!error && data?.ok) {
      return {
        ok: true,
        ultimoCorte: (data.ultimoCorte as CorteInventarioRosas | null) ?? null,
        historial: Array.isArray(data.historial) ? (data.historial as CorteInventarioRosas[]) : [],
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    return {
      ok: true,
      ultimoCorte: null,
      historial: [],
      migracionPendiente: true,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al consultar inventario de rosas",
    };
  }
}

export async function analizarFotoBonchesConAriaAction(
  negocio: string,
  imagenUrl: string
): Promise<
  | {
      ok: true;
      conteoColores: Record<string, number>;
      notaIa?: string;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const urlLimpia = String(imagenUrl || "").trim();
    if (!/^https?:\/\//i.test(urlLimpia)) {
      return {
        ok: false,
        error: "La imagen debe tener una URL pública o firmada accesible para ARIA.",
      };
    }

    const { invocarAgentePorNegocio } = await import("@eco/agentes-ia");

    const promptVision =
      "TAREA OPERATIVA DE INVENTARIO DE TALLER FLORAL (MODO VISIÓN ESTRICTO):\n" +
      "Observa detenidamente esta fotografía de paquetes/bonches de rosas (normalmente de 25 tallos envueltos en capuchón/cartón o papel).\n" +
      "Cuenta exactamente cuántos paquetes (bonches individuales, NO tallos sueltos) ves agrupados por su color principal.\n" +
      "Responde ÚNICAMENTE con un objeto JSON válido usando estas claves exactas cuando apliquen: " +
      '{"colores": {"rojo": 0, "blanco": 0, "rosado": 0, "fucsia": 0, "amarillo": 0, "durazno": 0, "bicolor": 0, "azul": 0, "otro": 0}, "nota": "observación breve de 1 línea"}.\n' +
      "Omite colores con valor 0. No agregues saludo comercial ni markdown adicional.";

    const respuesta = await invocarAgentePorNegocio(neg, promptVision, {
      imageUrls: [urlLimpia],
      tiempoMaximoMs: 45000,
    });

    const extraido = extraerConteoJsonDesdeRespuestaAria(respuesta.response);
    return {
      ok: true,
      conteoColores: extraido.conteoColores,
      notaIa: extraido.notaIa,
    };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error
          ? `ARIA no pudo contar automáticamente (${err.message}). Puedes ajustar las cantidades con +/- manualmente.`
          : "No se pudo invocar a ARIA para esta imagen.",
    };
  }
}

export async function guardarCorteInventarioRosasAction(entrada: {
  negocio: string;
  resumenColores: Record<string, number>;
  fotos: FotoConteoBonches[];
  observaciones?: string;
}): Promise<{ ok: true; corte: CorteInventarioRosas } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_guardar_corte_inventario_rosas", {
      p_negocio: neg,
      p_resumen_colores: entrada.resumenColores,
      p_fotos: entrada.fotos,
      p_observaciones: entrada.observaciones ?? null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo guardar el inventario") };
    }

    revalidarRutasTienda(neg);
    return { ok: true, corte: data.corte as CorteInventarioRosas };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al guardar inventario",
    };
  }
}

// =============================================================================
// 2. GALERÍA DE DISPONIBLES PARA ENTREGA INMEDIATA (1 A 2 HORAS)
// =============================================================================

export async function listarEntregaInmediataAction(
  negocio: string,
  incluirInactivos = false
): Promise<
  | { ok: true; items: ArregloEntregaInmediata[]; migracionPendiente?: boolean }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_listar_entrega_inmediata", {
      p_negocio: neg,
      p_incluir_inactivos: Boolean(incluirInactivos),
    });

    if (!error && data?.ok) {
      const items = Array.isArray(data.items)
        ? (data.items as ArregloEntregaInmediata[]).map((x) => ({
            ...x,
            precio: Number(x.precio) || 0,
            precioComparacion:
              x.precioComparacion != null ? Number(x.precioComparacion) : null,
            stockDisponible: Number(x.stockDisponible) || 0,
            galeriaUrls: Array.isArray(x.galeriaUrls) ? x.galeriaUrls : [],
          }))
        : [];
      return { ok: true, items };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    return { ok: true, items: [], migracionPendiente: true };
  } catch (err) {
    return {
      ok: false,
      error:
        err instanceof Error ? err.message : "No se pudo consultar la galería de entrega inmediata",
    };
  }
}

export async function publicarEntregaInmediataAction(entrada: {
  negocio: string;
  nombre: string;
  precio: number;
  imagenUrl: string;
  galeriaUrls?: string[];
  stock?: number;
  precioComparacion?: number | null;
  descripcion?: string;
  productoId?: string | null;
}): Promise<
  | { ok: true; productoId: string; slug: string; sku: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_publicar_entrega_inmediata", {
      p_negocio: neg,
      p_nombre: entrada.nombre,
      p_precio: Number(entrada.precio) || 0,
      p_imagen_url: entrada.imagenUrl,
      p_stock: Math.max(1, Math.round(Number(entrada.stock) || 1)),
      p_precio_comparacion:
        entrada.precioComparacion && Number(entrada.precioComparacion) > 0
          ? Number(entrada.precioComparacion)
          : null,
      p_descripcion: entrada.descripcion ?? null,
      p_galeria:
        Array.isArray(entrada.galeriaUrls) && entrada.galeriaUrls.length > 0
          ? entrada.galeriaUrls
          : [entrada.imagenUrl],
      p_producto_id:
        entrada.productoId && /^[0-9a-f-]{36}$/i.test(entrada.productoId)
          ? entrada.productoId
          : null,
    });

    if (error) {
      return { ok: false, error: error.message };
    }
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo publicar el arreglo") };
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      productoId: String(data.productoId),
      slug: String(data.slug),
      sku: String(data.sku),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al publicar arreglo disponible",
    };
  }
}

export async function descartarEntregaInmediataAction(entrada: {
  negocio: string;
  productoId: string;
  motivo: "VENDIDO_TIENDA" | "VENDIDO_WHATSAPP" | "DESCARTADO";
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_descartar_entrega_inmediata", {
      p_negocio: neg,
      p_producto_id: entrada.productoId,
      p_motivo: entrada.motivo,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo retirar el arreglo") };
    }

    revalidarRutasTienda(neg);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al retirar arreglo de entrega inmediata",
    };
  }
}

// =============================================================================
// 3. ÓRDENES DE TRABAJO (EXEQUIALES IESS), CONFIRMACIÓN DE ENTREGAS & INFORMES
// =============================================================================

export interface DatosTableroEntregas {
  usuarioActualId: string | null;
  usuarioActualNombre: string;
  esAdminOperador: boolean;
  convenios: ConvenioEntregaConfig[];
  entregas: RegistroEntregaEvidencia[];
  informes: InformeQuincenalEntregas[];
  pedidosPendientesTienda: PedidoPendienteConfirmacion[];
  migracionPendiente?: boolean;
}

export async function obtenerTableroEntregasAction(
  negocio: string
): Promise<{ ok: true; datos: DatosTableroEntregas } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_obtener_tablero_entregas", {
      p_negocio: neg,
    });

    if (!error && data?.ok) {
      const convenios: ConvenioEntregaConfig[] =
        Array.isArray(data.convenios) && data.convenios.length > 0
          ? data.convenios
          : [
              {
                id: "conv-exequiales-defecto",
                codigo: "EXEQUIALES_IESS",
                nombre: "Exequiales del IESS",
                prefijoInforme: "INF-IESS",
                siguienteNumero: 1,
                datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
              },
            ];

      return {
        ok: true,
        datos: {
          usuarioActualId: data.usuarioActualId ? String(data.usuarioActualId) : null,
          usuarioActualNombre: String(data.usuarioActualNombre || "Colaborador"),
          esAdminOperador: Boolean(data.esAdminOperador),
          convenios,
          entregas: Array.isArray(data.entregas) ? data.entregas : [],
          informes: Array.isArray(data.informes) ? data.informes : [],
          pedidosPendientesTienda: Array.isArray(data.pedidosPendientesTienda)
            ? data.pedidosPendientesTienda
            : [],
        },
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    const {
      data: { user },
    } = await supabase.auth.getUser();

    return {
      ok: true,
      datos: {
        usuarioActualId: user?.id ?? null,
        usuarioActualNombre: user?.email?.split("@")[0] || "Colaborador",
        esAdminOperador: true,
        convenios: [
          {
            id: "conv-exequiales-defecto",
            codigo: "EXEQUIALES_IESS",
            nombre: "Exequiales del IESS",
            prefijoInforme: "INF-IESS",
            siguienteNumero: 1,
            datosProveedor: DATOS_PROVEEDOR_TINKAY_DEFECTO,
          },
        ],
        entregas: [],
        informes: [],
        pedidosPendientesTienda: [],
        migracionPendiente: true,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al cargar el tablero de entregas",
    };
  }
}

export async function registrarOSincronizarEntregaAction(entrada: {
  negocio: string;
  uuidCliente: string;
  entregaId?: string | null;
  tipoOrigen: TipoOrigenEntrega;
  convenioId?: string | null;
  proformaId?: string | null;
  soloProgramarOt?: boolean;
  entregadorNombre?: string;
  fallecidoDestinatario?: string;
  fechaServicio?: string;
  capturadoEn?: string;
  descripcionServicio: string;
  salaServicio?: string;
  ubicacionNombre?: string;
  coordinadorNombre?: string;
  recursosUtilizados?: string;
  latitud?: number | null;
  longitud?: number | null;
  precisionMetros?: number | null;
  direccionGps?: string | null;
  fotoUrl?: string | null;
  mapaUrl?: string | null;
  facturaReferencia?: string | null;
  documentosAdjuntos?: string | null;
  observaciones?: string | null;
}): Promise<
  | { ok: true; entregaId: string; codigoOt: string; estado: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_registrar_o_sincronizar_entrega", {
      p_negocio: neg,
      p_payload: {
        uuidCliente: entrada.uuidCliente,
        entregaId:
          entrada.entregaId && /^[0-9a-f-]{36}$/i.test(entrada.entregaId)
            ? entrada.entregaId
            : null,
        tipoOrigen: entrada.tipoOrigen,
        convenioId:
          entrada.convenioId && /^[0-9a-f-]{36}$/i.test(entrada.convenioId)
            ? entrada.convenioId
            : null,
        proformaId:
          entrada.proformaId && /^[0-9a-f-]{36}$/i.test(entrada.proformaId)
            ? entrada.proformaId
            : null,
        soloProgramarOt: Boolean(entrada.soloProgramarOt),
        entregadorNombre: entrada.entregadorNombre,
        fallecidoDestinatario: entrada.fallecidoDestinatario ?? "",
        fechaServicio: entrada.fechaServicio,
        capturadoEn: entrada.capturadoEn,
        descripcionServicio: entrada.descripcionServicio,
        salaServicio: entrada.salaServicio ?? "",
        ubicacionNombre: entrada.ubicacionNombre ?? "",
        detalleExtra: entrada.salaServicio
          ? { sala_servicio: entrada.salaServicio }
          : undefined,
        coordinadorNombre: entrada.coordinadorNombre,
        recursosUtilizados: entrada.recursosUtilizados,
        latitud: entrada.latitud != null ? String(entrada.latitud) : null,
        longitud: entrada.longitud != null ? String(entrada.longitud) : null,
        precisionMetros:
          entrada.precisionMetros != null ? String(entrada.precisionMetros) : null,
        direccionGps: entrada.direccionGps,
        fotoUrl: entrada.fotoUrl,
        mapaUrl: entrada.mapaUrl,
        facturaReferencia: entrada.facturaReferencia,
        documentosAdjuntos: entrada.documentosAdjuntos,
        observaciones: entrada.observaciones,
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo registrar la entrega") };
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      entregaId: String(data.entregaId),
      codigoOt: String(data.codigoOt || "OT"),
      estado: String(data.estado || "ENTREGADA_PENDIENTE_INFORME"),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error inesperado al sincronizar entrega",
    };
  }
}

export async function actualizarEntregaEvidenciaAction(entrada: {
  negocio: string;
  entregaId: string;
  cambios: {
    fallecidoDestinatario?: string;
    fechaServicio?: string;
    descripcionServicio?: string;
    salaServicio?: string;
    ubicacionNombre?: string;
    coordinadorNombre?: string;
    recursosUtilizados?: string;
    entregadorNombre?: string;
    facturaReferencia?: string;
    documentosAdjuntos?: string;
    fotoUrl?: string;
    mapaUrl?: string;
    anular?: boolean;
  };
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_actualizar_entrega_evidencia", {
      p_negocio: neg,
      p_entrega_id: entrada.entregaId,
      p_cambios: entrada.cambios,
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo actualizar la entrega") };
    }

    revalidarRutasTienda(neg);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar entrega",
    };
  }
}

export async function emitirInformeQuincenalAction(entrada: {
  negocio: string;
  convenioId?: string | null;
  numeroInforme: string;
  fechaInforme: string;
  fechaInicio: string;
  fechaFin: string;
  entregasIds: string[];
  datosProveedor: DatosProveedorInformeIess;
  facturaReferencia?: string;
  documentosAdjuntos?: string;
  pdfUrl?: string | null;
}): Promise<
  | { ok: true; informeId: string; numeroInforme: string }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_emitir_informe_quincenal", {
      p_negocio: neg,
      p_payload: {
        convenioId:
          entrada.convenioId && /^[0-9a-f-]{36}$/i.test(entrada.convenioId)
            ? entrada.convenioId
            : null,
        numeroInforme: entrada.numeroInforme,
        fechaInforme: entrada.fechaInforme,
        fechaInicio: entrada.fechaInicio,
        fechaFin: entrada.fechaFin,
        entregasIds: entrada.entregasIds,
        datosProveedor: entrada.datosProveedor,
        facturaReferencia: entrada.facturaReferencia ?? "",
        documentosAdjuntos: entrada.documentosAdjuntos ?? "",
        pdfUrl: entrada.pdfUrl ?? null,
      },
    });

    if (error) return { ok: false, error: error.message };
    if (!data?.ok) {
      return { ok: false, error: String(data?.error || "No se pudo emitir el informe quincenal") };
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      informeId: String(data.informeId),
      numeroInforme: String(data.numeroInforme),
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar informe quincenal",
    };
  }
}
