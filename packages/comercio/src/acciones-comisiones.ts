"use server";

import {
  calcularBaseComisionableVenta,
  filtrarVentasPorPeriodoYRol,
  obtenerFechaDiaEcuador,
  resumirEstadisticasVentasYAsesores,
  type AsignacionComisionAsesor,
  type EntradaDesgloseFinancieroVenta,
  type EstadoLiquidacionComision,
  type PeriodoEstadisticasComision,
  type ReglaRepartoComision,
  type ResumenTiendaComisiones,
  type TasaComisionAsesor,
  type VentaComisionRegistrada,
} from "./comisiones";
import { normalizarIdentificadorNegocio } from "./utils/negocio";

function normalizarNegocioComisiones(negocio?: string): string {
  return normalizarIdentificadorNegocio(negocio).principal;
}

function variantesNegocio(neg: string): string[] {
  switch (neg) {
    case "tinkay":
      return ["tinkay", "tnk", "TINKAY", "TNK"];
    case "tranqi":
      return ["tranqi", "tranq", "legal", "TRANQI", "TRANQ", "LEGAL"];
    case "fastfix":
      return ["fastfix", "ffh", "FASTFIX", "FFH"];
    case "margaritas":
      return ["margaritas", "mrg", "MARGARITAS", "MRG"];
    default:
      return [neg, neg.toUpperCase()];
  }
}

interface AlmacenComisionesCfg {
  tasaPorDefectoPct: number;
  tasasPorUsuarioId: Record<string, { tasaPorcentaje: number; actualizadoEn?: string | null }>;
  ventas: VentaComisionRegistrada[];
}

async function verificarActorComisiones(negocio: string): Promise<
  | {
      ok: true;
      supabase: any;
      adminDb: any;
      usuarioId: string;
      actorNombre: string;
      esAdmin: boolean;
    }
  | { ok: false; error: string }
> {
  const { crearClienteAdmin, crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "Sesión expirada. Vuelve a iniciar sesión." };
  }

  const adminDb: any = crearClienteAdmin() ?? supabase;
  const codigosNeg = variantesNegocio(negocio);

  const [resUsu, resMem] = await Promise.all([
    adminDb
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma")
      .eq("usu_id", user.id)
      .maybeSingle(),
    adminDb
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select("mem_rol, seg_membresia_perfil(seg_perfil(per_clave))")
      .eq("mem_usuario_id", user.id)
      .eq("mem_estado", "ACTIVO")
      .in("mem_negocio", codigosNeg),
  ]);

  const u = resUsu?.data;
  const actorNombre =
    [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(" ").trim() ||
    u?.usu_correo ||
    user.email ||
    "Equipo";

  const correoLow = String(u?.usu_correo || user.email || "")
    .trim()
    .toLowerCase();
  const esSuper =
    Boolean(u?.usu_superadmin_plataforma) ||
    (negocio === "tinkay" && correoLow === "tinkay.uio@gmail.com");

  const rolesAdmin = new Set(["SUPERADMIN", "ADMINISTRADOR", "ADMIN"]);
  const rolesEquipo = new Set([
    "SUPERADMIN",
    "ADMINISTRADOR",
    "ADMIN",
    "VENTAS",
    "VENDEDOR",
    "ASESOR",
    "OPERADOR",
  ]);

  const mems = Array.isArray(resMem?.data) ? resMem.data : [];
  let esAdmin = esSuper;
  let esEquipo = esSuper;

  for (const m of mems) {
    const r = String(m?.mem_rol || "").toUpperCase();
    if (rolesAdmin.has(r)) esAdmin = true;
    if (rolesEquipo.has(r)) esEquipo = true;
    const perfiles = Array.isArray(m?.seg_membresia_perfil) ? m.seg_membresia_perfil : [];
    for (const mp of perfiles) {
      const pk = String(mp?.seg_perfil?.per_clave || "").toUpperCase();
      if (rolesAdmin.has(pk)) esAdmin = true;
      if (rolesEquipo.has(pk)) esEquipo = true;
    }
  }

  if (!esEquipo) {
    return { ok: false, error: "Acceso restringido al equipo comercial y administrativo." };
  }

  return {
    ok: true,
    supabase,
    adminDb,
    usuarioId: user.id,
    actorNombre,
    esAdmin,
  };
}

async function leerAlmacenComisionesCfg(
  adminDb: any,
  negocio: string
): Promise<AlmacenComisionesCfg> {
  try {
    const { data } = await adminDb
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();
    const raw = (data?.cfg_detalle_configuracion?.omnicanal_comisiones ?? {}) as Partial<AlmacenComisionesCfg>;
    return {
      tasaPorDefectoPct:
        typeof raw.tasaPorDefectoPct === "number" && Number.isFinite(raw.tasaPorDefectoPct)
          ? raw.tasaPorDefectoPct
          : 5,
      tasasPorUsuarioId:
        raw.tasasPorUsuarioId && typeof raw.tasasPorUsuarioId === "object"
          ? raw.tasasPorUsuarioId
          : {},
      ventas: Array.isArray(raw.ventas) ? raw.ventas : [],
    };
  } catch {
    return {
      tasaPorDefectoPct: 5,
      tasasPorUsuarioId: {},
      ventas: [],
    };
  }
}

async function escribirAlmacenComisionesCfg(
  adminDb: any,
  negocio: string,
  almacen: AlmacenComisionesCfg
): Promise<{ ok: boolean; error?: string }> {
  try {
    const { data: actual } = await adminDb
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .select("cfg_id, cfg_detalle_configuracion")
      .eq("cfg_negocio", negocio)
      .maybeSingle();

    if (!actual?.cfg_id) return { ok: true };

    const detPrev = (actual.cfg_detalle_configuracion ?? {}) as Record<string, unknown>;
    const { error } = await adminDb
      .schema("comun_configuracion")
      .from("cfg_negocio")
      .update({
        cfg_detalle_configuracion: {
          ...detPrev,
          omnicanal_comisiones: {
            tasaPorDefectoPct: almacen.tasaPorDefectoPct,
            tasasPorUsuarioId: almacen.tasasPorUsuarioId,
            ventas: almacen.ventas.slice(0, 500),
          },
        },
      })
      .eq("cfg_id", actual.cfg_id);

    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error guardando comisiones.",
    };
  }
}

export interface DatosTableroComisiones {
  esAdmin: boolean;
  usuarioActualId: string;
  hoyEcuador: string;
  periodoEfectivo: PeriodoEstadisticasComision;
  tasaPorDefectoPct: number;
  tasasAsesores: TasaComisionAsesor[];
  tasasMapa: Record<string, number>;
  ventas: VentaComisionRegistrada[];
  resumen: ResumenTiendaComisiones;
}

/**
 * Carga el tablero de Ventas Cerradas y Comisiones respetando estrictamente la regla:
 * - Asesores de ventas (`esAdmin = false`) SOLO reciben ventas del día actual (`hoy`),
 *   nunca totales de semana, quincena ni mes.
 * - Administradores (`esAdmin = true`) acceden a todos los periodos y tasas.
 */
export async function obtenerTableroComisionesAction(entrada: {
  negocio: string;
  periodo?: PeriodoEstadisticasComision;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
}): Promise<{ ok: true; datos: DatosTableroComisiones } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComisiones(entrada.negocio);
    const ctx = await verificarActorComisiones(neg);
    if (!ctx.ok) return ctx;

    const { adminDb, esAdmin, usuarioId } = ctx;
    const hoyEc = obtenerFechaDiaEcuador();

    // 1. Cargar miembros activos del equipo para listar sus tasas variables
    const codigosNeg = variantesNegocio(neg);
    const { data: memsEquipo } = await adminDb
      .schema("comun_seguridad")
      .from("seg_membresia")
      .select(
        "mem_usuario_id, mem_rol, seg_usuario(usu_id, usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma), seg_membresia_perfil(seg_perfil(per_clave))"
      )
      .eq("mem_estado", "ACTIVO")
      .in("mem_negocio", codigosNeg);

    const rolesComerciales = new Set([
      "SUPERADMIN",
      "ADMINISTRADOR",
      "ADMIN",
      "VENTAS",
      "VENDEDOR",
      "ASESOR",
      "OPERADOR",
    ]);
    const equipoMap = new Map<string, { usuarioId: string; nombre: string; rol: string }>();
    for (const m of Array.isArray(memsEquipo) ? memsEquipo : []) {
      const u = m?.seg_usuario;
      if (!u?.usu_id) continue;
      const perfiles = Array.isArray(m?.seg_membresia_perfil) ? m.seg_membresia_perfil : [];
      const rolPerfil = perfiles
        .map((p: any) => String(p?.seg_perfil?.per_clave || "").toUpperCase())
        .find((r: string) => rolesComerciales.has(r));
      const rolMem = String(m?.mem_rol || "").toUpperCase();
      const rol = u.usu_superadmin_plataforma
        ? "SUPERADMIN"
        : rolPerfil || (rolesComerciales.has(rolMem) ? rolMem : "");
      if (!rol) continue;
      const nombre =
        [u.usu_nombres, u.usu_apellidos].filter(Boolean).join(" ").trim() ||
        u.usu_correo ||
        "Equipo";
      if (!equipoMap.has(String(u.usu_id))) {
        equipoMap.set(String(u.usu_id), { usuarioId: String(u.usu_id), nombre, rol });
      }
    }

    // 2. Leer tasas y ventas desde tablas relacionales (si migración aplicada) + respaldo cfg_negocio
    const almacenCfg = await leerAlmacenComisionesCfg(adminDb, neg);
    const tasasMapa: Record<string, number> = {};
    for (const [uid, info] of Object.entries(almacenCfg.tasasPorUsuarioId)) {
      tasasMapa[uid] = Number(info.tasaPorcentaje ?? almacenCfg.tasaPorDefectoPct);
    }

    let ventasBrutas: VentaComisionRegistrada[] = [...almacenCfg.ventas];
    const ventasPorId = new Map<string, VentaComisionRegistrada>();
    for (const v of ventasBrutas) {
      ventasPorId.set(v.id, v);
    }

    try {
      const { data: tasasSql } = await adminDb
        .schema("comun_comercio")
        .from("com_comision_asesor_tasa")
        .select("cat_usuario_id, cat_tasa_porcentaje, cat_actualizado_en")
        .eq("cat_negocio", neg)
        .is("cat_eliminado_en", null);

      if (Array.isArray(tasasSql)) {
        for (const t of tasasSql) {
          tasasMapa[String(t.cat_usuario_id)] = Number(t.cat_tasa_porcentaje ?? 5);
        }
      }

      const consultaVentas = adminDb
        .schema("comun_comercio")
        .from("com_venta_comision")
        .select(
          "*, participaciones:com_venta_comision_participacion(vcp_id, vcp_usuario_id, vcp_asesor_nombre, vcp_porcentaje_chat, vcp_porcentaje_asignado, vcp_tasa_asesor, vcp_monto_comision, vcp_eliminado_en)"
        )
        .eq("vco_negocio", neg)
        .is("vco_eliminado_en", null)
        .order("vco_cerrado_en", { ascending: false })
        .limit(400);

      // Si NO es admin, acotar directamente en SQL al día actual de Ecuador
      if (!esAdmin) {
        consultaVentas.eq("vco_fecha_dia_ec", hoyEc);
      }

      const { data: ventasSql, error: errSql } = await consultaVentas;
      if (!errSql && Array.isArray(ventasSql)) {
        for (const r of ventasSql) {
          const parts = Array.isArray(r.participaciones)
            ? r.participaciones
                .filter((p: any) => !p.vcp_eliminado_en)
                .map(
                  (p: any): AsignacionComisionAsesor => ({
                    clave: p.vcp_usuario_id
                      ? `usu:${p.vcp_usuario_id}`
                      : `nom:${String(p.vcp_asesor_nombre || "").toLowerCase()}`,
                    usuarioId: p.vcp_usuario_id ? String(p.vcp_usuario_id) : null,
                    asesorNombre: String(p.vcp_asesor_nombre || "Equipo"),
                    porcentajeParticipacionChat: Number(p.vcp_porcentaje_chat || 0),
                    porcentajeComisionAsignado: Number(p.vcp_porcentaje_asignado || 0),
                    tasaComisionAsesorPct: Number(p.vcp_tasa_asesor || 0),
                    montoComisionUsd: Number(p.vcp_monto_comision || 0),
                  })
                )
            : [];

          const ventaMapeada: VentaComisionRegistrada = {
            id: String(r.vco_id),
            negocio: neg,
            conversacionId: r.vco_conversacion_id ? String(r.vco_conversacion_id) : null,
            proformaId: r.vco_proforma_id ? String(r.vco_proforma_id) : null,
            codigoPedido: r.vco_codigo_pedido || null,
            clienteNombre: String(r.vco_cliente_nombre || "Cliente"),
            clienteTelefono: r.vco_cliente_telefono || null,
            canal: String(r.vco_canal || "whatsapp"),
            productoResumen: r.vco_producto_resumen || null,
            desglose: {
              ventaTotalUsd: Number(r.vco_venta_total || 0),
              valorProductoUsd: Number(r.vco_valor_producto || 0),
              valorExtrasUsd: Number(r.vco_valor_extras || 0),
              extrasComisionan: r.vco_extras_comisionan !== false,
              deliveryFijoUsd: Number(r.vco_delivery_fijo || 0),
              deliveryExtraUsd: Number(r.vco_delivery_extra || 0),
              descuentosUsd: Number(r.vco_descuentos || 0),
              comisionPasarelaUsd: Number(r.vco_comision_pasarela || 0),
              baseComisionableUsd: Number(r.vco_base_comisionable || 0),
            },
            porcentajeIaChat: Number(r.vco_porcentaje_ia || 0),
            reglaReparto: (r.vco_regla_reparto || "GANADOR_UNICO") as ReglaRepartoComision,
            liderHumanoNombre: r.vco_lider_humano_nombre || null,
            asignaciones: parts,
            totalComisionUsd: Number(r.vco_total_comision || 0),
            estadoLiquidacion: (r.vco_estado_liquidacion || "PENDIENTE") as EstadoLiquidacionComision,
            notaAdmin: r.vco_nota_admin || null,
            cerradoPorId: r.vco_cerrado_por_id ? String(r.vco_cerrado_por_id) : null,
            cerradoPorNombre: r.vco_cerrado_por_nombre || null,
            cerradoEn: String(r.vco_cerrado_en || r.vco_creado_en),
            fechaDiaEc: String(r.vco_fecha_dia_ec || obtenerFechaDiaEcuador(r.vco_cerrado_en)),
          };
          ventasPorId.set(ventaMapeada.id, ventaMapeada);
        }
      }
    } catch {
      // Tablas relacionales aún pendientes de migración: usar almacén híbrido cfg_negocio
    }

    ventasBrutas = Array.from(ventasPorId.values()).sort((a, b) =>
      String(b.cerradoEn || "").localeCompare(String(a.cerradoEn || ""))
    );

    const { periodoEfectivo, ventasFiltradas } = filtrarVentasPorPeriodoYRol({
      ventas: ventasBrutas,
      periodo: entrada.periodo ?? "hoy",
      esAdmin,
      fechaDesde: entrada.fechaDesde,
      fechaHasta: entrada.fechaHasta,
    });

    const tasasAsesores: TasaComisionAsesor[] = Array.from(equipoMap.values())
      .map((m) => ({
        usuarioId: m.usuarioId,
        nombre: m.nombre,
        rol: m.rol,
        tasaPorcentaje:
          tasasMapa[m.usuarioId] != null
            ? tasasMapa[m.usuarioId]!
            : almacenCfg.tasaPorDefectoPct,
        activo: true,
        actualizadoEn: almacenCfg.tasasPorUsuarioId[m.usuarioId]?.actualizadoEn ?? null,
      }))
      .sort((a, b) => a.nombre.localeCompare(b.nombre));

    const resumen = resumirEstadisticasVentasYAsesores(
      ventasFiltradas,
      tasasMapa,
      almacenCfg.tasaPorDefectoPct
    );

    return {
      ok: true,
      datos: {
        esAdmin,
        usuarioActualId: usuarioId,
        hoyEcuador: hoyEc,
        periodoEfectivo,
        tasaPorDefectoPct: almacenCfg.tasaPorDefectoPct,
        tasasAsesores,
        tasasMapa,
        ventas: ventasFiltradas,
        resumen,
      },
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error cargando tablero de comisiones.",
    };
  }
}

/**
 * Configura la tasa de comisión (%) variable para un asesor específico (exclusivo Admin).
 */
export async function guardarTasaComisionAsesorAction(entrada: {
  negocio: string;
  usuarioId: string;
  tasaPorcentaje: number;
}): Promise<{ ok: true; usuarioId: string; tasaPorcentaje: number } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComisiones(entrada.negocio);
    const ctx = await verificarActorComisiones(neg);
    if (!ctx.ok) return ctx;
    if (!ctx.esAdmin) {
      return {
        ok: false,
        error: "Solo un Administrador puede modificar las tasas de comisión por asesor.",
      };
    }

    const tasa = Math.max(0, Math.min(100, Math.round(Number(entrada.tasaPorcentaje || 0) * 100) / 100));

    // 1. Intentar RPC relacional
    try {
      await ctx.supabase
        .schema("comun_comercio")
        .rpc("com_fn_comisiones_guardar_tasa_asesor", {
          p_negocio: neg,
          p_usuario_id: entrada.usuarioId,
          p_tasa_porcentaje: tasa,
        });
    } catch {
      // Continuar con respaldo cfg_negocio
    }

    // 2. Respaldo híbrido inmediato en cfg_negocio
    const almacen = await leerAlmacenComisionesCfg(ctx.adminDb, neg);
    almacen.tasasPorUsuarioId[entrada.usuarioId] = {
      tasaPorcentaje: tasa,
      actualizadoEn: new Date().toISOString(),
    };
    await escribirAlmacenComisionesCfg(ctx.adminDb, neg, almacen);

    return { ok: true, usuarioId: entrada.usuarioId, tasaPorcentaje: tasa };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo guardar la tasa del asesor.",
    };
  }
}

/**
 * Registra o actualiza el cierre financiero de una venta junto con la decisión de
 * reparto de comisiones entre los asesores que participaron en el chat.
 */
export async function registrarVentaComisionAction(entrada: {
  negocio: string;
  id?: string | null;
  conversacionId?: string | null;
  proformaId?: string | null;
  codigoPedido?: string | null;
  clienteNombre: string;
  clienteTelefono?: string | null;
  canal: string;
  productoResumen?: string | null;
  desglose: EntradaDesgloseFinancieroVenta;
  porcentajeIaChat: number;
  reglaReparto: ReglaRepartoComision;
  liderHumanoNombre?: string | null;
  asignaciones: AsignacionComisionAsesor[];
  notaAdmin?: string | null;
}): Promise<{ ok: true; venta: VentaComisionRegistrada } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComisiones(entrada.negocio);
    const ctx = await verificarActorComisiones(neg);
    if (!ctx.ok) return ctx;

    if (entrada.id && !ctx.esAdmin) {
      return {
        ok: false,
        error: "Solo un Administrador puede editar o recalcular una venta ya registrada.",
      };
    }

    const sumaPct = entrada.asignaciones.reduce(
      (acc, a) => acc + Math.max(0, Number(a.porcentajeComisionAsignado || 0)),
      0
    );
    if (sumaPct > 100.5) {
      return {
        ok: false,
        error: `La suma de porcentajes asignados (${sumaPct.toFixed(1)}%) no puede superar el 100%.`,
      };
    }

    const desglose = calcularBaseComisionableVenta(entrada.desglose);
    const asignacionesLimpias: AsignacionComisionAsesor[] = entrada.asignaciones.map((a) => {
      const pct = Math.max(0, Math.min(100, Number(a.porcentajeComisionAsignado || 0)));
      const tasa = Math.max(0, Math.min(100, Number(a.tasaComisionAsesorPct || 0)));
      const monto = Math.round(desglose.baseComisionableUsd * (pct / 100) * (tasa / 100) * 100) / 100;
      return {
        clave: a.clave,
        usuarioId: a.usuarioId ?? null,
        asesorNombre: String(a.asesorNombre || "Equipo"),
        porcentajeParticipacionChat: Math.max(0, Math.min(100, Number(a.porcentajeParticipacionChat || 0))),
        porcentajeComisionAsignado: pct,
        tasaComisionAsesorPct: tasa,
        montoComisionUsd: monto,
      };
    });

    const totalComisionUsd =
      Math.round(asignacionesLimpias.reduce((acc, a) => acc + a.montoComisionUsd, 0) * 100) / 100;
    const ahoraIso = new Date().toISOString();
    const hoyEc = obtenerFechaDiaEcuador(ahoraIso);

    let ventaIdFinal =
      entrada.id ||
      (typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `vco-${Date.now()}`);

    const ventaObjeto: VentaComisionRegistrada = {
      id: ventaIdFinal,
      negocio: neg,
      conversacionId: entrada.conversacionId ?? null,
      proformaId: entrada.proformaId ?? null,
      codigoPedido: entrada.codigoPedido?.trim() || null,
      clienteNombre: String(entrada.clienteNombre || "Cliente").trim(),
      clienteTelefono: entrada.clienteTelefono?.trim() || null,
      canal: entrada.canal || "whatsapp",
      productoResumen: entrada.productoResumen?.trim() || null,
      desglose,
      porcentajeIaChat: Math.max(0, Math.min(100, Number(entrada.porcentajeIaChat || 0))),
      reglaReparto: entrada.reglaReparto,
      liderHumanoNombre: entrada.liderHumanoNombre ?? null,
      asignaciones: asignacionesLimpias,
      totalComisionUsd,
      estadoLiquidacion: ctx.esAdmin ? "APROBADA" : "PENDIENTE",
      notaAdmin: entrada.notaAdmin?.trim() || null,
      cerradoPorId: ctx.usuarioId,
      cerradoPorNombre: ctx.actorNombre,
      cerradoEn: ahoraIso,
      fechaDiaEc: hoyEc,
    };

    // 1. Intentar persistencia relacional vía RPC
    try {
      const { data: resRpc, error: errRpc } = await ctx.supabase
        .schema("comun_comercio")
        .rpc("com_fn_comisiones_registrar_venta", {
          p_negocio: neg,
          p_venta: {
            ...ventaObjeto,
            id: entrada.id ?? null,
          },
        });
      if (!errRpc && resRpc?.ok && resRpc?.ventaId) {
        ventaIdFinal = String(resRpc.ventaId);
        ventaObjeto.id = ventaIdFinal;
      }
    } catch {
      // Continuar con respaldo híbrido cfg_negocio
    }

    // 2. Respaldo híbrido inmediato en cfg_negocio
    const almacen = await leerAlmacenComisionesCfg(ctx.adminDb, neg);
    const idxPrev = almacen.ventas.findIndex((v) => v.id === ventaObjeto.id);
    if (idxPrev >= 0) {
      ventaObjeto.cerradoEn = almacen.ventas[idxPrev]!.cerradoEn;
      ventaObjeto.fechaDiaEc = almacen.ventas[idxPrev]!.fechaDiaEc;
      almacen.ventas[idxPrev] = ventaObjeto;
    } else {
      almacen.ventas.unshift(ventaObjeto);
    }
    await escribirAlmacenComisionesCfg(ctx.adminDb, neg, almacen);

    return { ok: true, venta: ventaObjeto };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "No se pudo registrar la venta y comisión.",
    };
  }
}

/**
 * Actualiza el estado de liquidación de una venta (`PENDIENTE` / `APROBADA` / `PAGADA` / `ANULADA`).
 * Exclusivo para Administradores.
 */
export async function actualizarEstadoLiquidacionComisionAction(entrada: {
  negocio: string;
  ventaId: string;
  estado: EstadoLiquidacionComision;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  try {
    const neg = normalizarNegocioComisiones(entrada.negocio);
    const ctx = await verificarActorComisiones(neg);
    if (!ctx.ok) return ctx;
    if (!ctx.esAdmin) {
      return {
        ok: false,
        error: "Solo un Administrador puede aprobar, pagar o anular liquidaciones.",
      };
    }

    try {
      if (/^[0-9a-f-]{36}$/i.test(entrada.ventaId)) {
        await ctx.supabase
          .schema("comun_comercio")
          .rpc("com_fn_comisiones_actualizar_estado", {
            p_negocio: neg,
            p_venta_id: entrada.ventaId,
            p_estado: entrada.estado,
          });
      }
    } catch {
      // Continuar con respaldo híbrido
    }

    const almacen = await leerAlmacenComisionesCfg(ctx.adminDb, neg);
    const encontrada = almacen.ventas.find((v) => v.id === entrada.ventaId);
    if (encontrada) {
      encontrada.estadoLiquidacion = entrada.estado;
      await escribirAlmacenComisionesCfg(ctx.adminDb, neg, almacen);
    }

    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Error actualizando estado de liquidación.",
    };
  }
}
