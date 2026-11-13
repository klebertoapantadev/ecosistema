"use server";

import { crearClienteServidor, crearClienteAdmin } from "@eco/supabase/servidor";
import { revalidatePath } from "next/cache";
import { normalizarIdentificadorNegocio } from "./utils/negocio";
import { obtenerCatalogoProductosAction } from "./acciones";
import {
  fusionarTiposOfertaConPresets,
  normalizarCodigoTipoOferta,
  obtenerTiposOfertaPorDefecto,
  type DetalleTipoOferta,
  type TipoOfertaComercial,
} from "./utils/tiposOferta";

// Respaldo en memoria del proceso para cold-starts / entornos sin migración aún aplicada
const memoriaTiposOfertaPorNegocio = new Map<string, TipoOfertaComercial[]>();
const memoriaCodigosEliminadosPorNegocio = new Map<string, Set<string>>();

function obtenerClienteOperativo(): Promise<any> {
  return (async () => {
    try {
      return crearClienteAdmin();
    } catch {
      try {
        return await crearClienteServidor();
      } catch {
        return null;
      }
    }
  })();
}

function esErrorTablaOFuncionInexistente(err: any): boolean {
  const msg = String(err?.message || err?.details || "").toLowerCase();
  const code = String(err?.code || "").toUpperCase();
  return (
    code === "42P01" ||
    code === "42883" ||
    code === "PGRST202" ||
    code === "PGRST205" ||
    msg.includes("com_tipo_oferta") ||
    msg.includes("com_fn_obtener_tipos_oferta_con_uso") ||
    msg.includes("com_fn_guardar_tipo_oferta") ||
    msg.includes("com_fn_eliminar_tipo_oferta") ||
    msg.includes("could not find the")
  );
}

async function leerRespaldoEnLogisticaNegocio(
  cliente: any,
  negocio: string
): Promise<{ lista: TipoOfertaComercial[]; eliminados: string[] } | null> {
  if (!cliente) return null;
  try {
    const res = await cliente
      .schema("comun_comercio")
      .from("com_logistica_negocio")
      .select("log_detalle_logistica")
      .eq("log_negocio", negocio)
      .maybeSingle();

    if (res.error || !res.data?.log_detalle_logistica) return null;
    const det = res.data.log_detalle_logistica;
    const lista = Array.isArray(det.tipos_oferta_catalogo) ? det.tipos_oferta_catalogo : [];
    const eliminados = Array.isArray(det.tipos_oferta_eliminados) ? det.tipos_oferta_eliminados : [];
    if (lista.length === 0 && eliminados.length === 0) return null;
    return { lista, eliminados };
  } catch {
    return null;
  }
}

async function escribirRespaldoEnLogisticaNegocio(
  cliente: any,
  negocio: string,
  lista: TipoOfertaComercial[],
  eliminados: string[]
): Promise<{ ok: boolean; error?: string }> {
  if (!cliente) return { ok: false, error: "Sin conexión a base de datos." };
  try {
    const actualRes = await cliente
      .schema("comun_comercio")
      .from("com_logistica_negocio")
      .select("log_id, log_detalle_logistica")
      .eq("log_negocio", negocio)
      .maybeSingle();

    if (actualRes.error) {
      return { ok: false, error: actualRes.error.message };
    }

    if (actualRes.data?.log_id) {
      const detPrev = actualRes.data.log_detalle_logistica || {};
      const upd = await cliente
        .schema("comun_comercio")
        .from("com_logistica_negocio")
        .update({
          log_detalle_logistica: {
            ...detPrev,
            tipos_oferta_catalogo: lista,
            tipos_oferta_eliminados: eliminados,
          },
        })
        .eq("log_id", actualRes.data.log_id);

      if (upd.error) return { ok: false, error: upd.error.message };
      return { ok: true };
    }

    const ins = await cliente
      .schema("comun_comercio")
      .from("com_logistica_negocio")
      .insert({
        log_negocio: negocio,
        log_detalle_logistica: {
          tipos_oferta_catalogo: lista,
          tipos_oferta_eliminados: eliminados,
        },
      });

    if (ins.error) return { ok: false, error: ins.error.message };
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Error al respaldar catálogo de ofertas." };
  }
}

async function adjuntarUsoDeProductos(
  negocio: string,
  tipos: TipoOfertaComercial[],
  cliente: any
): Promise<TipoOfertaComercial[]> {
  let productosActivos: Array<{ pro_nombre: string; pro_tipo: string }> = [];

  if (cliente) {
    try {
      const { variantes } = normalizarIdentificadorNegocio(negocio);
      const resProds = await cliente
        .schema("comun_comercio")
        .from("com_producto")
        .select("pro_nombre, pro_tipo, pro_activo")
        .in("pro_negocio", variantes)
        .eq("pro_activo", true);

      if (!resProds.error && Array.isArray(resProds.data)) {
        productosActivos = resProds.data.map((p: any) => ({
          pro_nombre: String(p.pro_nombre || "Producto"),
          pro_tipo: String(p.pro_tipo || "FISICO").toUpperCase().trim(),
        }));
      }
    } catch {}
  }

  if (productosActivos.length === 0) {
    try {
      const prodsMem = await obtenerCatalogoProductosAction(negocio, undefined, true);
      productosActivos = prodsMem
        .filter((p) => p.pro_activo !== false)
        .map((p) => ({
          pro_nombre: p.pro_nombre,
          pro_tipo: String(p.pro_tipo || "FISICO").toUpperCase().trim(),
        }));
    } catch {}
  }

  return tipos.map((t) => {
    const cod = t.tof_codigo.toUpperCase().trim();
    const enUsoLista = productosActivos.filter((p) => p.pro_tipo === cod);
    return {
      ...t,
      productos_conteo: enUsoLista.length,
      en_uso: enUsoLista.length > 0,
      productos_ejemplo: enUsoLista.slice(0, 5).map((p) => p.pro_nombre),
    };
  });
}

export async function obtenerTiposOfertaConUsoAction(
  negocio = "tinkay"
): Promise<TipoOfertaComercial[]> {
  const { principal } = normalizarIdentificadorNegocio(negocio);
  const cliente = await obtenerClienteOperativo();
  const eliminadosMem = Array.from(memoriaCodigosEliminadosPorNegocio.get(principal) || []);

  // 1. Intentar RPC transaccional com_fn_obtener_tipos_oferta_con_uso
  if (cliente) {
    try {
      let rpcRes = await cliente.rpc("com_fn_obtener_tipos_oferta_con_uso", {
        p_negocio: principal,
      });
      if (rpcRes.error) {
        rpcRes = await cliente
          .schema("comun_comercio")
          .rpc("com_fn_obtener_tipos_oferta_con_uso", { p_negocio: principal });
      }
      if (!rpcRes.error && Array.isArray(rpcRes.data) && rpcRes.data.length > 0) {
        const fusionados = fusionarTiposOfertaConPresets(
          principal,
          rpcRes.data as TipoOfertaComercial[],
          eliminadosMem
        );
        memoriaTiposOfertaPorNegocio.set(principal, fusionados);
        return fusionados;
      }
    } catch {}

    // 2. Intentar tabla directa com_tipo_oferta
    try {
      const tablaRes = await cliente
        .schema("comun_comercio")
        .from("com_tipo_oferta")
        .select("*")
        .eq("tof_negocio", principal)
        .eq("tof_activo", true)
        .order("tof_orden", { ascending: true });

      if (!tablaRes.error && Array.isArray(tablaRes.data) && tablaRes.data.length > 0) {
        const fusionados = fusionarTiposOfertaConPresets(
          principal,
          tablaRes.data as TipoOfertaComercial[],
          eliminadosMem
        );
        const conUso = await adjuntarUsoDeProductos(principal, fusionados, cliente);
        memoriaTiposOfertaPorNegocio.set(principal, conUso);
        return conUso;
      }
    } catch {}

    // 3. Respaldo híbrido en com_logistica_negocio si la tabla nueva aún no fue migrada
    const respaldo = await leerRespaldoEnLogisticaNegocio(cliente, principal);
    if (respaldo) {
      const elimCombinados = Array.from(new Set([...eliminadosMem, ...respaldo.eliminados]));
      const fusionados = fusionarTiposOfertaConPresets(principal, respaldo.lista, elimCombinados);
      const conUso = await adjuntarUsoDeProductos(principal, fusionados, cliente);
      memoriaTiposOfertaPorNegocio.set(principal, conUso);
      return conUso;
    }
  }

  const baseMem = memoriaTiposOfertaPorNegocio.get(principal) || [];
  const fusion = fusionarTiposOfertaConPresets(principal, baseMem, eliminadosMem);
  return adjuntarUsoDeProductos(principal, fusion, cliente);
}

export async function guardarTipoOfertaAction(datos: {
  negocio?: string;
  tof_id?: string;
  codigo?: string;
  nombre: string;
  descripcion?: string;
  orden?: number;
  esRenta?: boolean;
  etiquetaCorta?: string;
  icono?: string;
  periodoDefecto?: string;
  incluyeRetiroDefecto?: boolean;
  notaCondicionesDefecto?: string;
}): Promise<{ ok: boolean; tipoOferta?: TipoOfertaComercial; lista?: TipoOfertaComercial[]; error?: string }> {
  const { principal } = normalizarIdentificadorNegocio(datos.negocio || "tinkay");
  const nombre = String(datos.nombre || "").trim();
  if (!nombre) {
    return { ok: false, error: "Ingresa el nombre del tipo de oferta comercial." };
  }

  const codigo = normalizarCodigoTipoOferta(datos.codigo || nombre);
  const detalle: DetalleTipoOferta = {
    es_renta: Boolean(datos.esRenta),
    etiqueta_corta:
      datos.etiquetaCorta?.trim() ||
      (datos.esRenta ? "🪑 En Renta" : nombre.slice(0, 22)),
    icono: datos.icono?.trim() || (datos.esRenta ? "🪑" : "🏷️"),
    periodo_defecto: datos.periodoDefecto?.trim() || (datos.esRenta ? "Por evento (24h)" : undefined),
    incluye_retiro_defecto:
      datos.incluyeRetiroDefecto !== undefined ? datos.incluyeRetiroDefecto : Boolean(datos.esRenta),
    nota_condiciones_defecto: datos.notaCondicionesDefecto?.trim() || undefined,
  };

  // Si se vuelve a crear un código antes eliminado, retirarlo del conjunto de exclusión
  const setElim = memoriaCodigosEliminadosPorNegocio.get(principal) || new Set<string>();
  setElim.delete(codigo);
  memoriaCodigosEliminadosPorNegocio.set(principal, setElim);

  const cliente = await obtenerClienteOperativo();
  if (!cliente) {
    return { ok: false, error: "No fue posible conectar con Supabase para guardar el tipo de oferta." };
  }

  const payloadRpc = {
    tof_id: datos.tof_id || null,
    negocio: principal,
    codigo,
    nombre,
    descripcion: datos.descripcion?.trim() || null,
    orden: datos.orden ?? 10,
    detalle,
  };

  // 1. Intentar RPC oficial com_fn_guardar_tipo_oferta
  let rpcRes = await cliente.rpc("com_fn_guardar_tipo_oferta", { p_datos: payloadRpc });
  if (rpcRes.error) {
    rpcRes = await cliente
      .schema("comun_comercio")
      .rpc("com_fn_guardar_tipo_oferta", { p_datos: payloadRpc });
  }

  if (!rpcRes.error && rpcRes.data?.ok) {
    try {
      revalidatePath("/");
      revalidatePath("/panel/catalogo-productos");
    } catch {}
    const listaActualizada = await obtenerTiposOfertaConUsoAction(principal);
    return {
      ok: true,
      tipoOferta: rpcRes.data.tipo_oferta as TipoOfertaComercial,
      lista: listaActualizada,
    };
  }

  // Si el error NO es por falta de migración, propagar estrictamente
  if (rpcRes.error && !esErrorTablaOFuncionInexistente(rpcRes.error)) {
    return { ok: false, error: rpcRes.error.message || "Error al guardar el tipo de oferta en BDD." };
  }

  // 2. Respaldo persistente en PostgreSQL (com_logistica_negocio JSONB) mientras se aplica la migración
  const respaldoPrevio = await leerRespaldoEnLogisticaNegocio(cliente, principal);
  const elimActuales = (respaldoPrevio?.eliminados || []).filter((c) => c.toUpperCase() !== codigo);
  const baseActual = fusionarTiposOfertaConPresets(
    principal,
    respaldoPrevio?.lista || memoriaTiposOfertaPorNegocio.get(principal) || [],
    elimActuales
  );

  const nuevoItem: TipoOfertaComercial = {
    tof_id: datos.tof_id || `tof-${principal}-${codigo.toLowerCase()}`,
    tof_negocio: principal,
    tof_codigo: codigo,
    tof_nombre: nombre,
    tof_descripcion: datos.descripcion?.trim() || null,
    tof_orden: datos.orden ?? baseActual.length + 1,
    tof_es_sistema: false,
    tof_activo: true,
    tof_detalle_tipo_oferta: detalle,
  };

  const nuevaLista = [
    ...baseActual.filter((x) => x.tof_codigo.toUpperCase() !== codigo && x.tof_id !== datos.tof_id),
    nuevoItem,
  ].sort((a, b) => (a.tof_orden ?? 99) - (b.tof_orden ?? 99));

  const resBackup = await escribirRespaldoEnLogisticaNegocio(
    cliente,
    principal,
    nuevaLista,
    elimActuales
  );
  if (!resBackup.ok) {
    return { ok: false, error: resBackup.error || "No se pudo persistir el tipo de oferta." };
  }

  const conUso = await adjuntarUsoDeProductos(principal, nuevaLista, cliente);
  memoriaTiposOfertaPorNegocio.set(principal, conUso);
  try {
    revalidatePath("/");
    revalidatePath("/panel/catalogo-productos");
  } catch {}

  return { ok: true, tipoOferta: nuevoItem, lista: conUso };
}

export async function eliminarTipoOfertaAction(
  negocio: string,
  identificador: string
): Promise<{
  ok: boolean;
  enUso?: boolean;
  conteo?: number;
  ejemplos?: string[];
  codigoEliminado?: string;
  lista?: TipoOfertaComercial[];
  error?: string;
}> {
  const { principal } = normalizarIdentificadorNegocio(negocio || "tinkay");
  const ident = String(identificador || "").trim();
  if (!ident) {
    return { ok: false, error: "Identificador de tipo de oferta requerido." };
  }

  const cliente = await obtenerClienteOperativo();
  if (!cliente) {
    return { ok: false, error: "Sin conexión a Supabase para validar y eliminar el tipo de oferta." };
  }

  // Resolver elemento y validar que ningún producto activo lo utilice
  const listaActual = await obtenerTiposOfertaConUsoAction(principal);
  const objetivo = listaActual.find(
    (t) => t.tof_id === ident || t.tof_codigo.toUpperCase() === ident.toUpperCase()
  );
  const codigoObj = (objetivo?.tof_codigo || ident).toUpperCase().trim();

  if (objetivo?.en_uso && (objetivo.productos_conteo || 0) > 0) {
    return {
      ok: false,
      enUso: true,
      conteo: objetivo.productos_conteo,
      ejemplos: objetivo.productos_ejemplo || [],
      error: `No se puede eliminar "${objetivo.tof_nombre}" porque está asignado a ${objetivo.productos_conteo} producto(s) activo(s).`,
    };
  }

  if (listaActual.length <= 1) {
    return {
      ok: false,
      error: "Debe permanecer al menos 1 tipo de oferta comercial activo en el catálogo.",
    };
  }

  // 1. Intentar RPC oficial com_fn_eliminar_tipo_oferta
  let rpcRes = await cliente.rpc("com_fn_eliminar_tipo_oferta", {
    p_negocio: principal,
    p_identificador: codigoObj,
  });
  if (rpcRes.error) {
    rpcRes = await cliente.schema("comun_comercio").rpc("com_fn_eliminar_tipo_oferta", {
      p_negocio: principal,
      p_identificador: codigoObj,
    });
  }

  if (!rpcRes.error && rpcRes.data) {
    if (rpcRes.data.ok === false && rpcRes.data.en_uso) {
      return {
        ok: false,
        enUso: true,
        conteo: rpcRes.data.conteo,
        ejemplos: rpcRes.data.ejemplos || [],
        error: rpcRes.data.error,
      };
    }
    if (rpcRes.data.ok === true) {
      const setElim = memoriaCodigosEliminadosPorNegocio.get(principal) || new Set<string>();
      setElim.add(codigoObj);
      memoriaCodigosEliminadosPorNegocio.set(principal, setElim);
      const actualizada = await obtenerTiposOfertaConUsoAction(principal);
      return { ok: true, codigoEliminado: codigoObj, lista: actualizada };
    }
  }

  if (rpcRes.error && !esErrorTablaOFuncionInexistente(rpcRes.error)) {
    return { ok: false, error: rpcRes.error.message || "Error al eliminar el tipo de oferta." };
  }

  // 2. Respaldo en com_logistica_negocio JSONB
  const respaldoPrevio = await leerRespaldoEnLogisticaNegocio(cliente, principal);
  const elimNuevos = Array.from(
    new Set([...(respaldoPrevio?.eliminados || []), codigoObj])
  );
  const listaFiltrada = listaActual.filter((t) => t.tof_codigo.toUpperCase() !== codigoObj);

  const resBackup = await escribirRespaldoEnLogisticaNegocio(
    cliente,
    principal,
    listaFiltrada,
    elimNuevos
  );
  if (!resBackup.ok) {
    return { ok: false, error: resBackup.error || "No se pudo eliminar el tipo de oferta." };
  }

  const setElim = memoriaCodigosEliminadosPorNegocio.get(principal) || new Set<string>();
  setElim.add(codigoObj);
  memoriaCodigosEliminadosPorNegocio.set(principal, setElim);
  memoriaTiposOfertaPorNegocio.set(principal, listaFiltrada);

  return { ok: true, codigoEliminado: codigoObj, lista: listaFiltrada };
}

export async function restaurarTiposOfertaPredeterminadosAction(
  negocio = "tinkay"
): Promise<{ ok: boolean; lista: TipoOfertaComercial[]; error?: string }> {
  const { principal } = normalizarIdentificadorNegocio(negocio);
  memoriaCodigosEliminadosPorNegocio.set(principal, new Set<string>());
  const cliente = await obtenerClienteOperativo();
  const presets = obtenerTiposOfertaPorDefecto(principal);

  if (cliente) {
    // Reinsertar presets faltantes en tabla com_tipo_oferta si existe, o limpiar eliminados en respaldo
    for (const p of presets) {
      try {
        await cliente.rpc("com_fn_guardar_tipo_oferta", {
          p_datos: {
            negocio: principal,
            codigo: p.tof_codigo,
            nombre: p.tof_nombre,
            descripcion: p.tof_descripcion,
            orden: p.tof_orden,
            detalle: p.tof_detalle_tipo_oferta || {},
          },
        });
      } catch {}
    }
    const respaldo = await leerRespaldoEnLogisticaNegocio(cliente, principal);
    if (respaldo) {
      const combinados = fusionarTiposOfertaConPresets(principal, respaldo.lista, []);
      await escribirRespaldoEnLogisticaNegocio(cliente, principal, combinados, []);
    }
  }

  const actualizada = await obtenerTiposOfertaConUsoAction(principal);
  return { ok: true, lista: actualizada };
}

