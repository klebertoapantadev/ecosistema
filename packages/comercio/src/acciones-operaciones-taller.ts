"use server";

import { revalidatePath } from "next/cache";
import {
  DATOS_PROVEEDOR_TINKAY_DEFECTO,
  extraerConteoJsonDesdeRespuestaAria,
  normalizarFranjaHorariaTienda,
  obtenerFechaHoyEcuadorYmd,
  type ArregloEntregaInmediata,
  type ConvenioEntregaConfig,
  type CorteInventarioRosas,
  type DatosProveedorInformeIess,
  type EstadoOrdenTaller,
  type FotoConteoBonches,
  type InformeQuincenalEntregas,
  type ItemOrdenTaller,
  type OrdenTrabajoTaller,
  type OrigenOrdenTaller,
  type PedidoPendienteConfirmacion,
  type ProductoLigeroSelectorTaller,
  type RegistroEntregaEvidencia,
  type RepartidorDisponibleNegocio,
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
    m.includes("com_orden_taller") ||
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
    revalidatePath("/panel/envio-pedidos");
    revalidatePath("/panel/taller");
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
  rolOperativo?: string;
  esAdminOperador: boolean;
  esSubcontratado?: boolean;
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
          rolOperativo: data.rolOperativo ? String(data.rolOperativo) : undefined,
          esAdminOperador: Boolean(data.esAdminOperador),
          esSubcontratado: Boolean(data.esSubcontratado),
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

    if (!entrada.soloProgramarOt) {
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: entrada.proformaId || String(data.entregaId),
        codigoOrden: String(data.codigoOt || "PEDIDO"),
        nuevoEstado: "ENTREGADO",
        etiquetaEstado: "Entregado (GPS)",
        compradorNombre: entrada.fallecidoDestinatario || entrada.coordinadorNombre || null,
      });
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

// =============================================================================
// 4. PROGRAMACIÓN, ENVÍO DIARIO DE PEDIDOS Y CONSOLA DE TALLER FLORAL
// =============================================================================

export interface DatosConsolaTallerYDespacho {
  rolOperativo?: string;
  usuarioActualNombre: string;
  ordenes: OrdenTrabajoTaller[];
  productosCatalogo: ProductoLigeroSelectorTaller[];
  repartidoresNegocio?: RepartidorDisponibleNegocio[];
  migracionPendiente?: boolean;
}

async function notificarPersonalTallerODespacho(params: {
  negocio: string;
  titulo: string;
  contenidoHtml: string;
  urlAccion: string;
  roles: readonly string[];
  claveReferencia?: string;
}) {
  try {
    const {
      obtenerDestinatariosStaffNegocio,
      persistirNotificacionesInternasResiliente,
    } = await import("@eco/notificaciones/notificar-usuario");

    const destinatarios = await obtenerDestinatariosStaffNegocio(
      params.negocio,
      undefined,
      params.roles
    );
    const conId = destinatarios.filter((d) => Boolean(d.id));
    if (conId.length === 0) return;

    const codigoNeg =
      params.negocio === "tinkay"
        ? "TNK"
        : params.negocio === "margaritas"
          ? "MRG"
          : params.negocio === "fastfix"
            ? "FFH"
            : "TRQ";

    const itemsNotif = conId.flatMap((d) => [
      {
        usuarioId: String(d.id),
        negocioCode: codigoNeg,
        canal: "IN_APP" as const,
        titulo: params.titulo,
        contenidoHtml: params.contenidoHtml,
        urlAccion: params.urlAccion,
        claveReferencia: params.claveReferencia,
      },
      {
        usuarioId: String(d.id),
        negocioCode: codigoNeg,
        canal: "PUSH" as const,
        titulo: params.titulo,
        contenidoHtml: params.contenidoHtml,
        urlAccion: params.urlAccion,
        claveReferencia: params.claveReferencia ? `${params.claveReferencia}:push` : undefined,
      },
    ]);

    await persistirNotificacionesInternasResiliente(params.negocio, itemsNotif);
  } catch {
    // No interrumpir flujo operativo si el canal de notificación falla
  }
}

export async function obtenerConsolaTallerYDespachoAction(
  negocio: string
): Promise<
  | { ok: true; datos: DatosConsolaTallerYDespacho }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_obtener_consola_taller_y_despacho", {
      p_negocio: neg,
    });

    if (!error && data?.ok) {
      const ordenes: OrdenTrabajoTaller[] = Array.isArray(data.ordenes)
        ? (data.ordenes as any[]).map((o) => ({
            ...o,
            totalUsd: Number(o.totalUsd ?? 0),
            items: Array.isArray(o.items) ? o.items : [],
            franjaHoraria: o.franjaHoraria
              ? normalizarFranjaHorariaTienda(String(o.franjaHoraria))
              : null,
          }))
        : [];
      const productosCatalogo: ProductoLigeroSelectorTaller[] = Array.isArray(
        data.productosCatalogo
      )
        ? (data.productosCatalogo as any[]).map((p) => ({
            productoId: String(p.productoId),
            productoNombre: String(p.productoNombre),
            varianteId: p.varianteId ? String(p.varianteId) : undefined,
            sku: String(p.sku || ""),
            varianteNombre: String(p.varianteNombre || "Estándar"),
            pvp: Number(p.pvp ?? 0),
            portadaUrl: p.portadaUrl ? String(p.portadaUrl) : undefined,
          }))
        : [];

      const repartidoresNegocio: RepartidorDisponibleNegocio[] = Array.isArray(
        data.repartidoresNegocio
      )
        ? (data.repartidoresNegocio as any[]).map((r) => ({
            usuarioId: String(r.usuarioId),
            nombre: String(r.nombre || "Repartidor"),
            correo: r.correo ? String(r.correo) : undefined,
            modalidad: r.modalidad === "EXTERNO" ? "EXTERNO" : "INTERNO",
          }))
        : [];

      return {
        ok: true,
        datos: {
          rolOperativo: data.rolOperativo ? String(data.rolOperativo) : undefined,
          usuarioActualNombre: String(data.usuarioActualNombre || "Operador"),
          ordenes,
          productosCatalogo,
          repartidoresNegocio,
        },
      };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "Acceso no autorizado") };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo híbrido sobre tablas existentes (com_proforma + com_entrega_evidencia + com_producto)
    // si la migración 20261116000001 aún no ha sido ejecutada en Supabase remoto.
    const db: any = crearClienteAdmin() ?? supabase;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const hoyYmd = obtenerFechaHoyEcuadorYmd();

    const [resPrf, resEnt, resProd] = await Promise.all([
      db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("*")
        .eq("prf_negocio", neg)
        .is("prf_eliminado_en", null)
        .order("prf_creado_en", { ascending: false })
        .limit(250),
      db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("*")
        .eq("ent_negocio", neg)
        .is("ent_eliminado_en", null)
        .order("ent_creado_en", { ascending: false })
        .limit(200),
      db
        .schema("comun_comercio")
        .from("com_variante")
        .select("var_id, var_producto_id, var_sku, var_nombre, var_precio, var_detalle_variante, com_producto!inner(pro_id, pro_nombre, pro_activo, pro_eliminado_en, pro_detalle_producto)")
        .eq("var_negocio", neg)
        .eq("var_activo", true)
        .is("var_eliminado_en", null)
        .limit(200),
    ]);

    const ordenesRespaldo: OrdenTrabajoTaller[] = [];

    for (const f of resPrf.data ?? []) {
      const estadoPrf = String(f.prf_estado || "").toUpperCase();
      if (["CANCELADO", "ANULADO", "NO_ACEPTADA"].includes(estadoPrf)) continue;
      const det = (f.prf_detalle_proforma ?? {}) as Record<string, any>;
      const tipoOrig = String(det.tipo_origen || "");
      if (
        tipoOrig === "PROFORMA_EVENTO" &&
        !["ORDEN_CONFIRMADA", "RESERVADA_70", "APROBADA", "EN_PREPARACION", "EN_RUTA", "ENTREGADO"].includes(
          estadoPrf
        )
      ) {
        continue;
      }

      const log = (det.logistica_entrega ?? {}) as Record<string, any>;
      const itemsRaw = Array.isArray(det.items) ? det.items : [];
      const items: ItemOrdenTaller[] = itemsRaw.map((it: any) => ({
        sku: it.sku ? String(it.sku) : undefined,
        descripcion: String(it.producto_nombre || it.descripcion || it.nombre || "Arreglo"),
        cantidad: Number(it.cantidad ?? 1),
        precioUnitario: Number(it.pvp_unitario ?? it.precio_unitario ?? 0),
        dedicatoria: it.dedicatoria?.mensaje
          ? `Para: ${it.dedicatoria.para || "-"} | De: ${it.dedicatoria.de || "-"} — "${it.dedicatoria.mensaje}"`
          : undefined,
      }));

      const estTaller: EstadoOrdenTaller = (det.estado_taller as EstadoOrdenTaller) ||
        (estadoPrf === "ENTREGADO" || det.entrega_confirmada
          ? "ENTREGADO"
          : estadoPrf === "EN_RUTA"
            ? "LISTO_ENTREGA"
            : estadoPrf === "EN_PREPARACION"
              ? "EN_PREPARACION"
              : "PENDIENTE_ENVIO");

      ordenesRespaldo.push({
        id: String(f.prf_id),
        codigo: String(
          det.codigo_orden || det.codigo_proforma || `TNK-ORD-${String(f.prf_secuencial ?? 1).padStart(4, "0")}`
        ),
        origenTipo:
          tipoOrig === "PROFORMA_EVENTO"
            ? "PROFORMA_EVENTO"
            : tipoOrig === "MANUAL_ADMIN"
              ? "MANUAL_ADMIN"
              : "VENTA_TIENDA",
        proformaId: String(f.prf_id),
        estadoTaller: estTaller,
        estadoPago: estadoPrf,
        metodoPago: det.metodo_pago ? String(det.metodo_pago) : "web",
        fechaPedido: String(f.prf_creado_en),
        fechaEntrega: String(
          log.fecha_entrega || log.fechaEntrega || det.evento?.fechaEvento || hoyYmd
        ).slice(0, 10),
        fechaElaboracion: det.fecha_elaboracion ? String(det.fecha_elaboracion).slice(0, 10) : undefined,
        franjaHoraria: normalizarFranjaHorariaTienda(
          String(log.franja_horaria || log.franjaHoraria || "A) 09:00 - 13:00")
        ),
        horaEspecifica: log.hora_exacta || det.evento?.horaEvento || null,
        productoResumen:
          items.map((i) => `${i.cantidad}x ${i.descripcion}`).join(" + ") || "Pedido floral",
        items,
        clienteSolicita: String(
          det.comprador?.nombreCompleto || det.comprador?.nombre || "Cliente Tienda"
        ),
        clienteTelefono: String(det.comprador?.whatsapp || det.comprador?.telefono || ""),
        destinatarioFallecido: String(
          log.destinatario_nombre || log.destinatarioNombre || det.comprador?.nombreCompleto || ""
        ),
        ubicacionEntrega: String(log.direccion || det.ubicacion?.direccion || ""),
        enlaceMapa: log.enlace_mapa || log.enlaceMapa || null,
        retiroEnLocal: Boolean(log.retiro_en_local),
        dedicatoria: items.map((i) => i.dedicatoria).filter(Boolean).join(" || ") || undefined,
        observaciones: det.notas_taller || det.evento?.notasEvento || undefined,
        totalUsd: Number(f.prf_total ?? 0),
        enviadoTallerEn: det.enviado_taller_en || null,
        actualizadoTallerNombre: det.actualizado_taller_por || null,
      });
    }

    for (const e of resEnt.data ?? []) {
      if (e.ent_tipo_origen !== "ORDEN_TRABAJO_CONVENIO" || e.ent_estado === "ANULADA") continue;
      const detEnt = (e.ent_detalle_entrega ?? {}) as Record<string, any>;
      const estTaller: EstadoOrdenTaller =
        e.ent_estado !== "PROGRAMADA"
          ? "ENTREGADO"
          : (detEnt.estado_taller as EstadoOrdenTaller) || "ENVIADO_TALLER";

      ordenesRespaldo.push({
        id: String(e.ent_id),
        codigo: String(e.ent_codigo_ot || `OT-${String(e.ent_secuencial ?? 1).padStart(4, "0")}`),
        origenTipo: "EXEQUIALES_LLAMADA",
        entregaId: String(e.ent_id),
        estadoTaller: estTaller,
        estadoPago: "CONVENIO_IESS",
        metodoPago: "convenio",
        fechaPedido: String(e.ent_creado_en),
        fechaEntrega: String(e.ent_fecha_servicio || hoyYmd).slice(0, 10),
        fechaElaboracion: String(e.ent_fecha_servicio || hoyYmd).slice(0, 10),
        horaEspecifica: e.ent_hora_solicitada || detEnt.hora_solicitada || null,
        productoResumen: String(e.ent_descripcion_servicio || "Set condolencias (3 arreglos)"),
        items: [
          {
            descripcion: String(e.ent_descripcion_servicio || "Set condolencias (3 arreglos)"),
            cantidad: 1,
          },
        ],
        clienteSolicita: String(e.ent_coordinador_nombre || detEnt.quien_solicita || "Exequiales IESS"),
        destinatarioFallecido: String(e.ent_fallecido_destinatario || ""),
        salaServicio: e.ent_sala_servicio || detEnt.sala_servicio || null,
        ubicacionEntrega: String(e.ent_ubicacion_nombre || "Exequiales del IESS"),
        observaciones: e.ent_observaciones || undefined,
        enviadoTallerEn: String(e.ent_creado_en),
      });
    }

    const productosCatalogo: ProductoLigeroSelectorTaller[] = (resProd.data ?? []).map((v: any) => {
      const prod = Array.isArray(v.com_producto) ? v.com_producto[0] : v.com_producto;
      return {
        productoId: String(v.var_producto_id),
        productoNombre: String(prod?.pro_nombre || "Arreglo"),
        varianteId: String(v.var_id),
        sku: String(v.var_sku || ""),
        varianteNombre: String(v.var_nombre || "Estándar"),
        pvp: Number(v.var_precio ?? 0),
        portadaUrl:
          v.var_detalle_variante?.portada_url || prod?.pro_detalle_producto?.portada_url || undefined,
      };
    });

    return {
      ok: true,
      datos: {
        usuarioActualNombre: user?.email?.split("@")[0] || "Operador",
        ordenes: ordenesRespaldo,
        productosCatalogo,
        migracionPendiente: true,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando consola de Pedidos y Taller",
    };
  }
}

export async function crearOActualizarPedidoOperadorAction(entrada: {
  negocio: string;
  ordenId?: string | null;
  origenTipo: OrigenOrdenTaller;
  enviarATaller?: boolean;
  fechaEntrega: string;
  fechaElaboracion?: string;
  franjaHoraria?: string;
  horaEspecifica?: string;
  productoResumen: string;
  items?: ItemOrdenTaller[];
  clienteSolicita: string;
  clienteTelefono?: string;
  destinatarioFallecido?: string;
  salaServicio?: string;
  ubicacionEntrega?: string;
  enlaceMapa?: string;
  retiroEnLocal?: boolean;
  dedicatoria?: string;
  observaciones?: string;
  totalUsd?: number;
  estadoPago?: string;
  metodoPago?: string;
}): Promise<
  | { ok: true; ordenId: string; codigo: string; estadoTaller: EstadoOrdenTaller }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const enviar = entrada.enviarATaller ?? entrada.origenTipo === "EXEQUIALES_LLAMADA";

    const { data, error } = await esquema.rpc("com_fn_crear_o_actualizar_pedido_operador", {
      p_negocio: neg,
      p_payload: {
        ...entrada,
        enviarATaller: enviar,
      },
    });

    if (!error && data?.ok) {
      if (enviar) {
        const esExeq = entrada.origenTipo === "EXEQUIALES_LLAMADA";
        const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
          "./notificaciones-pedidos-push"
        );
        await despacharPushCambioEstadoPedidoTodosLosRoles({
          supabase,
          negocio: neg,
          pedidoId: String(data.ordenId),
          codigoOrden: String(data.codigo),
          nuevoEstado: "ENVIADO_TALLER",
          etiquetaEstado: esExeq ? "Urgente Exequiales · En Taller" : "Enviado a Taller",
          compradorNombre: entrada.destinatarioFallecido || entrada.clienteSolicita,
          tituloPersonalizado: esExeq
            ? `🕊️ URGENTE Exequiales (${entrada.salaServicio || "Sala"}): ${data.codigo}`
            : `🌸 Pedido enviado a Taller (${entrada.fechaEntrega}): ${data.codigo}`,
          cuerpoPlanoPersonalizado: `${data.codigo} · ${entrada.productoResumen} (${entrada.destinatarioFallecido || entrada.clienteSolicita})`,
          contenidoHtmlPersonalizado: esExeq
            ? `<p><strong>Orden Exequiales:</strong> ${data.codigo}</p>
               <p><strong>Producto:</strong> ${entrada.productoResumen}</p>
               <p><strong>Fecha / Hora:</strong> ${entrada.fechaEntrega}${entrada.horaEspecifica ? ` · ${entrada.horaEspecifica}` : ""}</p>
               <p><strong>Solicita:</strong> ${entrada.clienteSolicita} · <strong>Sala:</strong> ${entrada.salaServicio || "Por confirmar"}</p>
               <p><strong>Fallecido:</strong> ${entrada.destinatarioFallecido || "Por confirmar"}</p>`
            : `<p><strong>Pedido:</strong> ${data.codigo}</p>
               <p><strong>Detalle:</strong> ${entrada.productoResumen}</p>
               <p><strong>Entrega:</strong> ${entrada.fechaEntrega} (${entrada.franjaHoraria || "Horario estándar"})</p>
               <p><strong>Destinatario:</strong> ${entrada.destinatarioFallecido || entrada.clienteSolicita}</p>`,
        });
      }

      revalidarRutasTienda(neg);
      return {
        ok: true,
        ordenId: String(data.ordenId),
        codigo: String(data.codigo),
        estadoTaller: (data.estadoTaller as EstadoOrdenTaller) || "ENVIADO_TALLER",
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo guardar el pedido") };
    }

    // Respaldo resiliente sobre com_entrega_evidencia (si es Exequiales) o com_proforma (si es Manual)
    if (entrada.origenTipo === "EXEQUIALES_LLAMADA") {
      const uuidCli = crypto.randomUUID();
      const resOt = await registrarOSincronizarEntregaAction({
        negocio: neg,
        uuidCliente: uuidCli,
        tipoOrigen: "ORDEN_TRABAJO_CONVENIO",
        soloProgramarOt: true,
        fallecidoDestinatario:
          entrada.destinatarioFallecido?.trim() ||
          `Por confirmar (${entrada.salaServicio || "Exequiales"})`,
        fechaServicio: `${entrada.fechaEntrega}T12:00:00.000Z`,
        descripcionServicio: entrada.productoResumen || "Set condolencias (3 arreglos)",
        salaServicio: entrada.salaServicio,
        ubicacionNombre: entrada.ubicacionEntrega || "Exequiales del IESS",
        coordinadorNombre: entrada.clienteSolicita,
        observaciones: entrada.horaEspecifica
          ? `Hora: ${entrada.horaEspecifica}${entrada.observaciones ? ` · ${entrada.observaciones}` : ""}`
          : entrada.observaciones,
      });
      if (!resOt.ok) return { ok: false, error: resOt.error };
      revalidarRutasTienda(neg);
      return {
        ok: true,
        ordenId: resOt.entregaId,
        codigo: resOt.codigoOt,
        estadoTaller: "ENVIADO_TALLER",
      };
    }

    const db: any = crearClienteAdmin() ?? supabase;
    const codigoManual = `PED-${Date.now().toString().slice(-5)}`;
    const estTaller: EstadoOrdenTaller = enviar ? "ENVIADO_TALLER" : "PENDIENTE_ENVIO";
    const { data: insPrf, error: errPrf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .insert({
        prf_negocio: neg,
        prf_estado: enviar ? "EN_PREPARACION" : entrada.estadoPago || "APROBADA",
        prf_subtotal: Number(entrada.totalUsd ?? 0),
        prf_impuestos: 0,
        prf_total: Number(entrada.totalUsd ?? 0),
        prf_token_aprobacion: crypto.randomUUID(),
        prf_cliente_contacto: {
          nombre: entrada.clienteSolicita,
          telefono: entrada.clienteTelefono || "",
        },
        prf_detalle_proforma: {
          tipo_origen: "MANUAL_ADMIN",
          codigo_orden: codigoManual,
          estado_taller: estTaller,
          fecha_elaboracion: enviar ? obtenerFechaHoyEcuadorYmd() : entrada.fechaElaboracion,
          enviado_taller_en: enviar ? new Date().toISOString() : null,
          metodo_pago: entrada.metodoPago || "manual",
          comprador: {
            nombreCompleto: entrada.clienteSolicita,
            whatsapp: entrada.clienteTelefono || "",
          },
          logistica_entrega: {
            destinatario_nombre: entrada.destinatarioFallecido || entrada.clienteSolicita,
            direccion: entrada.ubicacionEntrega || "",
            enlace_mapa: entrada.enlaceMapa || "",
            retiro_en_local: Boolean(entrada.retiroEnLocal),
            fecha_entrega: entrada.fechaEntrega,
            franja_horaria: normalizarFranjaHorariaTienda(entrada.franjaHoraria),
          },
          items: (
            entrada.items && entrada.items.length > 0
              ? entrada.items
              : [{ descripcion: entrada.productoResumen, cantidad: 1 }]
          ).map((it) => ({
            producto_nombre: it.descripcion,
            descripcion: it.descripcion,
            sku: it.sku || "MANUAL",
            cantidad: it.cantidad,
            pvp_unitario: it.precioUnitario ?? 0,
            total_linea: (it.precioUnitario ?? 0) * it.cantidad,
            dedicatoria: entrada.dedicatoria
              ? { para: entrada.destinatarioFallecido || "", de: entrada.clienteSolicita, mensaje: entrada.dedicatoria }
              : undefined,
          })),
          notas_taller: entrada.observaciones || "",
        },
      })
      .select("prf_id")
      .single();

    if (errPrf || !insPrf?.prf_id) {
      return { ok: false, error: errPrf?.message || "No se pudo registrar el pedido manual" };
    }

    revalidarRutasTienda(neg);
    return {
      ok: true,
      ordenId: String(insPrf.prf_id),
      codigo: codigoManual,
      estadoTaller: estTaller,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al guardar y programar pedido",
    };
  }
}

export async function enviarPedidosATallerAction(entrada: {
  negocio: string;
  ordenesIds: string[];
}): Promise<{ ok: true; enviados: number; codigos: string[] } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const ids = Array.from(
      new Set((entrada.ordenesIds || []).filter((x) => /^[0-9a-f-]{36}$/i.test(x)))
    );
    if (ids.length === 0) {
      return { ok: false, error: "Selecciona al menos un pedido válido para enviar a Taller." };
    }

    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_enviar_pedidos_a_taller", {
      p_negocio: neg,
      p_ids: ids,
    });

    if (!error && data?.ok) {
      const codigos: string[] = Array.isArray(data.codigos) ? data.codigos.map(String) : [];
      const codigoPrincipal = codigos[0] || "PEDIDO";
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: ids[0] ?? null,
        codigoOrden: codigoPrincipal,
        nuevoEstado: "ENVIADO_TALLER",
        etiquetaEstado: "Enviado a Taller",
        tituloPersonalizado:
          codigos.length === 1
            ? `🌸 Pedido ${codigoPrincipal} · Enviado a Taller`
            : `🌸 ${Number(data.enviados || ids.length)} pedidos enviados a Taller (${codigos.join(", ")})`,
        cuerpoPlanoPersonalizado: `Pedidos enviados a elaboración en Taller: ${codigos.join(", ")}. Toca para ver detalle.`,
        contenidoHtmlPersonalizado: `<p>Se enviaron <strong>${Number(
          data.enviados || ids.length
        )}</strong> pedido(s) para elaboración en Taller: <strong>${codigos.join(", ")}</strong>.</p>`,
      });

      revalidarRutasTienda(neg);
      return {
        ok: true,
        enviados: Number(data.enviados || ids.length),
        codigos,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo híbrido sobre com_proforma
    const db: any = crearClienteAdmin() ?? supabase;
    const codigos: string[] = [];
    for (const id of ids) {
      const { data: fila } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_detalle_proforma")
        .eq("prf_id", id)
        .maybeSingle();
      if (fila?.prf_id) {
        const det = (fila.prf_detalle_proforma ?? {}) as Record<string, any>;
        codigos.push(String(det.codigo_orden || id.slice(0, 8)));
        await db
          .schema("comun_comercio")
          .from("com_proforma")
          .update({
            prf_estado: "EN_PREPARACION",
            prf_detalle_proforma: {
              ...det,
              estado_taller: "ENVIADO_TALLER",
              fecha_elaboracion: obtenerFechaHoyEcuadorYmd(),
              enviado_taller_en: new Date().toISOString(),
            },
            prf_actualizado_en: new Date().toISOString(),
          })
          .eq("prf_id", id);
      }
    }

    revalidarRutasTienda(neg);
    return { ok: true, enviados: codigos.length, codigos };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error enviando pedidos a Taller",
    };
  }
}

export async function actualizarEstadoOrdenTallerAction(entrada: {
  negocio: string;
  ordenId: string;
  nuevoEstado: EstadoOrdenTaller;
  notasTaller?: string;
}): Promise<{ ok: true; estadoTaller: EstadoOrdenTaller } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_actualizar_estado_taller", {
      p_negocio: neg,
      p_orden_id: entrada.ordenId,
      p_nuevo_estado: entrada.nuevoEstado,
      p_notas_taller: entrada.notasTaller ?? null,
    });

    if (!error && data?.ok) {
      const { despacharPushCambioEstadoPedidoTodosLosRoles } = await import(
        "./notificaciones-pedidos-push"
      );
      await despacharPushCambioEstadoPedidoTodosLosRoles({
        supabase,
        negocio: neg,
        pedidoId: entrada.ordenId,
        codigoOrden: String(data.codigo || "PEDIDO"),
        nuevoEstado: entrada.nuevoEstado,
        compradorNombre: data.productoResumen ? String(data.productoResumen) : null,
      });

      revalidarRutasTienda(neg);
      return {
        ok: true,
        estadoTaller: (data.estadoTaller as EstadoOrdenTaller) || entrada.nuevoEstado,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }

    // Respaldo sobre com_proforma o com_entrega_evidencia
    const db: any = crearClienteAdmin() ?? supabase;
    const { data: filaPrf } = await db
      .schema("comun_comercio")
      .from("com_proforma")
      .select("prf_id, prf_detalle_proforma")
      .eq("prf_id", entrada.ordenId)
      .maybeSingle();

    if (filaPrf?.prf_id) {
      const det = (filaPrf.prf_detalle_proforma ?? {}) as Record<string, any>;
      await db
        .schema("comun_comercio")
        .from("com_proforma")
        .update({
          prf_estado:
            entrada.nuevoEstado === "LISTO_ENTREGA"
              ? "EN_RUTA"
              : entrada.nuevoEstado === "ENTREGADO"
                ? "ENTREGADO"
                : "EN_PREPARACION",
          prf_detalle_proforma: {
            ...det,
            estado_taller: entrada.nuevoEstado,
            notas_taller: entrada.notasTaller ?? det.notas_taller,
          },
          prf_actualizado_en: new Date().toISOString(),
        })
        .eq("prf_id", entrada.ordenId);
    } else {
      const { data: filaEnt } = await db
        .schema("comun_comercio")
        .from("com_entrega_evidencia")
        .select("ent_id, ent_detalle_entrega")
        .eq("ent_id", entrada.ordenId)
        .maybeSingle();
      if (filaEnt?.ent_id) {
        const detE = (filaEnt.ent_detalle_entrega ?? {}) as Record<string, any>;
        await db
          .schema("comun_comercio")
          .from("com_entrega_evidencia")
          .update({
            ent_detalle_entrega: {
              ...detE,
              estado_taller: entrada.nuevoEstado,
            },
            ent_actualizado_en: new Date().toISOString(),
          })
          .eq("ent_id", entrada.ordenId);
      }
    }

    revalidarRutasTienda(neg);
    return { ok: true, estadoTaller: entrada.nuevoEstado };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error al actualizar estado en Taller",
    };
  }
}

export async function asignarRepartidorEntregaAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  repartidorId: string | null;
  repartidorNombre?: string | null;
  repartidorTipo?: "INTERNO" | "EXTERNO" | null;
}): Promise<
  | {
      ok: true;
      repartidorId: string | null;
      repartidorNombre: string | null;
      repartidorTipo: string | null;
    }
  | { ok: false; error: string }
> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_asignar_repartidor_entrega", {
      p_negocio: neg,
      p_orden_taller_id: entrada.ordenTallerId ?? null,
      p_entrega_id: entrada.entregaId ?? null,
      p_repartidor_id: entrada.repartidorId ?? null,
      p_repartidor_nombre: entrada.repartidorNombre ?? null,
      p_repartidor_tipo: entrada.repartidorTipo ?? "INTERNO",
    });

    if (!error && data?.ok) {
      if (entrada.repartidorId) {
        await notificarPersonalTallerODespacho({
          negocio: neg,
          titulo: `🛵 Entrega asignada: ${entrada.repartidorNombre || "Delivery"}`,
          contenidoHtml: `<p>Tienes un pedido asignado para entrega en tu consola de Entregas GPS.</p>`,
          urlAccion: "/panel/entregas",
          roles: ["DELIVERY", "DELIVERY_EXTERNO", "REPARTIDOR"],
          claveReferencia: `delivery-asignado:${entrada.ordenTallerId || entrada.entregaId || Date.now()}`,
        });
      }
      revalidarRutasTienda(neg);
      return {
        ok: true,
        repartidorId: data.repartidorId ? String(data.repartidorId) : null,
        repartidorNombre: data.repartidorNombre ? String(data.repartidorNombre) : null,
        repartidorTipo: data.repartidorTipo ? String(data.repartidorTipo) : null,
      };
    }

    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }
    if (data && data.ok === false) {
      return { ok: false, error: String(data.error || "No se pudo asignar el repartidor") };
    }

    return {
      ok: true,
      repartidorId: entrada.repartidorId,
      repartidorNombre: entrada.repartidorNombre ?? null,
      repartidorTipo: entrada.repartidorTipo ?? null,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error asignando repartidor",
    };
  }
}

export async function actualizarUbicacionRutaDeliveryAction(entrada: {
  negocio: string;
  ordenTallerId?: string | null;
  entregaId?: string | null;
  proformaId?: string | null;
  enRuta: boolean;
  latitud?: number | null;
  longitud?: number | null;
  precision?: number | null;
}): Promise<{ ok: true; enRuta: boolean } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocio(entrada.negocio);
    const { crearClienteServidor } = await import("@eco/supabase/servidor");
    const supabase = await crearClienteServidor();
    const esquema = supabase.schema("comun_comercio") as any;

    const { data, error } = await esquema.rpc("com_fn_actualizar_ubicacion_ruta_delivery", {
      p_negocio: neg,
      p_orden_taller_id: entrada.ordenTallerId ?? null,
      p_entrega_id: entrada.entregaId ?? null,
      p_proforma_id: entrada.proformaId ?? null,
      p_en_ruta: entrada.enRuta,
      p_latitud: entrada.latitud ?? null,
      p_longitud: entrada.longitud ?? null,
      p_precision: entrada.precision ?? null,
    });

    if (!error && data?.ok) {
      return { ok: true, enRuta: Boolean(data.enRuta) };
    }
    if (error && !esErrorMigracionPendiente(error.message)) {
      return { ok: false, error: error.message };
    }
    return { ok: true, enRuta: entrada.enRuta };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error reportando ubicación en ruta",
    };
  }
}
