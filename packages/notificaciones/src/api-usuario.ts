/* eslint-disable @typescript-eslint/no-explicit-any */
import { crearClienteAdmin, crearClienteServidor } from "@eco/supabase/servidor";
import type { NotificacionItem } from "./WidgetNotificacionesCliente";

interface EstadoLocalNotificacion {
  leido_en?: string | null;
  eliminada?: boolean;
  eliminada_en?: string | null;
  pospuesta_hasta?: string | null;
  pospuesta_horas?: number | null;
}

function normalizarNegocioNotif(raw?: string | null): {
  canon: string;
  notifCode: string;
  nombreVisible: string;
  codigosUpper: Set<string>;
} {
  const limpio = (raw || "tinkay").trim().toLowerCase();
  if (limpio === "tinkay" || limpio === "tnk") {
    return {
      canon: "tinkay",
      notifCode: "TINKAY",
      nombreVisible: "Tinkay",
      codigosUpper: new Set(["TINKAY", "TNK"]),
    };
  }
  if (limpio === "fastfix" || limpio === "ffh") {
    return {
      canon: "fastfix",
      notifCode: "FASTFIX",
      nombreVisible: "FastFix Home",
      codigosUpper: new Set(["FASTFIX", "FFH"]),
    };
  }
  if (limpio === "margaritas" || limpio === "mrg") {
    return {
      canon: "margaritas",
      notifCode: "MARGARITAS",
      nombreVisible: "Margaritas Floristería",
      codigosUpper: new Set(["MARGARITAS", "MRG"]),
    };
  }
  return {
    canon: "tranqi",
    notifCode: "TRANQ",
    nombreVisible: "Tranqi",
    codigosUpper: new Set(["TRANQI", "TRANQ", "LEGAL"]),
  };
}

export async function consultarBandejaNotificacionesUsuario(
  negocioParam = "tinkay"
): Promise<{ success: boolean; notificaciones: NotificacionItem[] }> {
  try {
    const metaNeg = normalizarNegocioNotif(negocioParam);
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user?.id) {
      return { success: true, notificaciones: [] };
    }

    const db: any = crearClienteAdmin() || supabase;

    const [{ data: usuRow }, { data: membresiasRows }] = await Promise.all([
      db
        .schema("comun_seguridad")
        .from("seg_usuario")
        .select("usu_id, usu_nombres, usu_apellidos, usu_correo, usu_superadmin_plataforma, usu_detalle_usuario")
        .eq("usu_id", user.id)
        .maybeSingle(),
      db
        .schema("comun_seguridad")
        .from("seg_membresia")
        .select("mem_negocio, mem_rol, mem_estado, seg_membresia_perfil(seg_perfil(per_clave))")
        .eq("mem_usuario_id", user.id)
        .eq("mem_estado", "ACTIVO"),
    ]);

    const correoActual = String(usuRow?.usu_correo || user.email || "").trim().toLowerCase();
    const esSuperAdminGlobal =
      Boolean(usuRow?.usu_superadmin_plataforma) ||
      (metaNeg.canon === "tinkay" &&
        (correoActual === "tinkay.uio@gmail.com" ||
          correoActual === "kleber.toapanta.ch@gmail.com"));

    const rolesEnNegocio = new Set<string>();
    if (esSuperAdminGlobal) {
      rolesEnNegocio.add("SUPERADMIN");
      rolesEnNegocio.add("ADMINISTRADOR");
    }

    if (Array.isArray(membresiasRows)) {
      for (const m of membresiasRows) {
        const negM = String(m?.mem_negocio || "").toUpperCase();
        if (!metaNeg.codigosUpper.has(negM)) continue;
        if (m?.mem_rol) rolesEnNegocio.add(String(m.mem_rol).toUpperCase());
        if (Array.isArray(m?.seg_membresia_perfil)) {
          for (const mp of m.seg_membresia_perfil) {
            const per = Array.isArray(mp?.seg_perfil) ? mp.seg_perfil[0] : mp?.seg_perfil;
            if (per?.per_clave) rolesEnNegocio.add(String(per.per_clave).toUpperCase());
          }
        }
      }
    }

    const esOperadorOAdmin =
      rolesEnNegocio.has("SUPERADMIN") ||
      rolesEnNegocio.has("ADMINISTRADOR") ||
      rolesEnNegocio.has("ADMIN") ||
      rolesEnNegocio.has("OPERADOR");

    const esVendedor =
      rolesEnNegocio.has("VENTAS") ||
      rolesEnNegocio.has("VENDEDOR") ||
      rolesEnNegocio.has("ASESOR");

    const detUsu = (usuRow?.usu_detalle_usuario || {}) as Record<string, any>;
    const estadosPorNegocio =
      (detUsu.notificaciones_estados_negocio?.[metaNeg.canon] as Record<
        string,
        EstadoLocalNotificacion
      >) || {};

    const aplicarEstadoLocal = (item: NotificacionItem): NotificacionItem => {
      const ov = estadosPorNegocio[item.not_id];
      if (!ov) return item;
      return {
        ...item,
        not_leido_en: ov.leido_en !== undefined ? ov.leido_en : item.not_leido_en,
        not_eliminada: ov.eliminada !== undefined ? ov.eliminada : item.not_eliminada,
        not_eliminada_en:
          ov.eliminada_en !== undefined ? ov.eliminada_en : item.not_eliminada_en,
        not_pospuesta_hasta:
          ov.pospuesta_hasta !== undefined ? ov.pospuesta_hasta : item.not_pospuesta_hasta,
        not_pospuesta_horas:
          ov.pospuesta_horas !== undefined ? ov.pospuesta_horas : item.not_pospuesta_horas,
      };
    };

    const mapaItems = new Map<string, NotificacionItem>();
    const titulosVistos = new Set<string>();

    const registrarItem = (cand: NotificacionItem) => {
      if (!cand?.not_id || !cand?.not_titulo) return;
      const itemFinal = aplicarEstadoLocal(cand);
      const huellaTitulo = `${itemFinal.not_titulo.trim()}`;
      if (mapaItems.has(itemFinal.not_id)) return;
      if (titulosVistos.has(huellaTitulo)) return;
      titulosVistos.add(huellaTitulo);
      mapaItems.set(itemFinal.not_id, itemFinal);
    };

    // 1. Leer desde RPC dedicada seg_fn_listar_mis_notificaciones (cuando la migración 20261115000009 está activa)
    try {
      const { data: filasMis, error: errMis } = await db
        .schema("comun_seguridad")
        .rpc("seg_fn_listar_mis_notificaciones", { p_negocio: metaNeg.canon });

      if (!errMis && Array.isArray(filasMis)) {
        for (const r of filasMis) {
          const detalles = (r.not_detalles || {}) as Record<string, any>;
          const idUnico = String(detalles.clave_original || r.not_id);
          registrarItem({
            not_id: idUnico,
            not_titulo: String(r.not_titulo || ""),
            not_contenido_html: String(r.not_contenido_html || ""),
            not_url_accion: r.not_url_accion || "/panel",
            not_leido_en: r.not_leido_en ?? null,
            not_creado_en: String(r.not_creado_en || new Date().toISOString()),
            not_canal: String(r.not_canal || "IN_APP"),
            not_pospuesta_hasta: detalles.pospuesta_hasta ?? null,
            not_pospuesta_horas: detalles.pospuesta_horas ?? null,
            not_eliminada: Boolean(detalles.eliminada),
            not_eliminada_en: detalles.eliminada_en ?? null,
          });
        }
      }
    } catch {
      // Continuar con RPC existente
    }

    // 2. Respaldo mediante RPC ya existente en producción `seg_fn_monitoreo_notificaciones`
    if (mapaItems.size === 0 && (esOperadorOAdmin || esVendedor)) {
      try {
        const { data: filasMon, error: errMon } = await db
          .schema("comun_seguridad")
          .rpc("seg_fn_monitoreo_notificaciones", {
            p_negocio: metaNeg.notifCode,
            p_usuario_id: user.id,
          });

        if (!errMon && Array.isArray(filasMon)) {
          for (const r of filasMon) {
            if (String(r.usuario_id || "") !== user.id) continue;
            const detalles = (r.not_detalles || {}) as Record<string, any>;
            const idUnico = String(detalles.clave_original || r.not_id);
            registrarItem({
              not_id: idUnico,
              not_titulo: String(r.not_titulo || ""),
              not_contenido_html: String(r.not_contenido_html || ""),
              not_url_accion: r.not_url_accion || "/panel",
              not_leido_en: r.not_leido_en ?? null,
              not_creado_en: String(r.not_creado_en || new Date().toISOString()),
              not_canal: String(r.not_canal || "IN_APP"),
              not_pospuesta_hasta: r.not_pospuesta_hasta ?? detalles.pospuesta_hasta ?? null,
              not_pospuesta_horas: r.not_pospuesta_horas ?? detalles.pospuesta_horas ?? null,
              not_eliminada: Boolean(r.not_eliminada ?? detalles.eliminada),
              not_eliminada_en: r.not_eliminada_en ?? detalles.eliminada_en ?? null,
            });
          }
        }
      } catch {
        // Continuar
      }
    }

    // 3. Leer bandeja espejo en seg_usuario.usu_detalle_usuario.notificaciones_bandeja
    const bandejaUsu: any[] = Array.isArray(detUsu.notificaciones_bandeja)
      ? detUsu.notificaciones_bandeja
      : [];
    for (const itemB of bandejaUsu) {
      if (!itemB?.not_id) continue;
      const negItem = String(itemB.not_negocio || "").toLowerCase();
      if (negItem && negItem !== metaNeg.canon && !metaNeg.codigosUpper.has(negItem.toUpperCase())) {
        continue;
      }
      registrarItem({
        not_id: String(itemB.not_id),
        not_titulo: String(itemB.not_titulo || ""),
        not_contenido_html: String(itemB.not_contenido_html || ""),
        not_url_accion: itemB.not_url_accion || "/panel",
        not_leido_en: itemB.not_leido_en ?? null,
        not_creado_en: String(itemB.not_creado_en || new Date().toISOString()),
        not_canal: String(itemB.not_canal || "PUSH"),
        not_pospuesta_hasta: itemB.not_pospuesta_hasta ?? null,
        not_pospuesta_horas: itemB.not_pospuesta_horas ?? null,
        not_eliminada: Boolean(itemB.not_eliminada),
        not_eliminada_en: itemB.not_eliminada_en ?? null,
      });
    }

    // 4. Síntesis en tiempo real desde órdenes y proformas del negocio (para staff operativo/admin/ventas)
    //    Garantiza que compras como TNK-ORD-0008 aparezcan en la campana y disparen alerta incluso sin service_role.
    if (esOperadorOAdmin || esVendedor) {
      try {
        const { data: ordenesStaff, error: errOrd } = await db
          .schema("comun_comercio")
          .rpc("com_fn_listar_pedidos_tienda", { p_negocio: metaNeg.canon });

        if (!errOrd && Array.isArray(ordenesStaff)) {
          for (const fila of ordenesStaff.slice(0, 35)) {
            const det = (fila.prf_detalle_proforma || {}) as Record<string, any>;
            const tipoOrigen = String(det.tipo_origen || "PEDIDO_TIENDA").toUpperCase();
            const codigo = String(
              det.codigo_orden ||
                det.codigo_proforma ||
                fila.prf_numero_legible ||
                `ORD-${fila.prf_secuencial || ""}`
            ).trim();
            if (!codigo) continue;

            const yaExisteCodigo = Array.from(mapaItems.values()).some((n) =>
              n.not_titulo.includes(codigo)
            );
            if (yaExisteCodigo) continue;

            const estadoFila = String(fila.prf_estado || det.estado || "").toUpperCase();
            const metodoPago = String(det.metodo_pago || "PLUX").toUpperCase();
            const totalUsd = Number(fila.prf_total ?? det.total_pagar ?? 0);
            const compradorNom = String(
              fila.prf_cliente_nombre || det.comprador?.nombreCompleto || "Cliente"
            );
            const contacto = (fila.prf_cliente_contacto || det.comprador || {}) as Record<
              string,
              any
            >;
            const tel = String(contacto.telefono || contacto.whatsapp || "").trim();
            const mail = String(contacto.correo || contacto.email || "").trim();

            if (tipoOrigen === "PROFORMA_EVENTO") {
              const esReg = Boolean(fila.prf_cliente_id || det.usuario_autorizado);
              if (!esReg && tel.replace(/\D+/g, "").length < 7) continue;

              const fechaCreacion = String(fila.prf_creado_en || new Date().toISOString());
              registrarItem({
                not_id: `syn-prf-${fila.prf_id}`,
                not_titulo: `📋 Proforma de Evento (${metaNeg.nombreVisible}): ${compradorNom} generó ${codigo} ($${totalUsd.toFixed(2)})`,
                not_contenido_html: `<div><strong>Cliente:</strong> ${compradorNom}${
                  tel ? ` · <strong>WhatsApp:</strong> ${tel}` : ""
                }${mail ? ` · <strong>Correo:</strong> ${mail}` : ""}<br/><strong>Total:</strong> $${totalUsd.toFixed(
                  2
                )} USD · <strong>Estado:</strong> ${estadoFila}</div>`,
                not_url_accion: `/panel/pedidos?codigo=${encodeURIComponent(codigo)}`,
                not_leido_en: null,
                not_creado_en: fechaCreacion,
                not_canal: "PUSH",
              });
            } else if (esOperadorOAdmin) {
              const tieneComprobante = Boolean(det.comprobante_transferencia?.url);
              const tienePagoPlux = Boolean(det.ultimo_pago_plux);
              const esVentaActiva =
                ["APROBADA", "PAGADA", "PAGADO", "RESERVADA_70", "ORDEN_CONFIRMADA", "FACTURADA"].includes(
                  estadoFila
                ) ||
                tienePagoPlux ||
                (metodoPago === "TRANSFERENCIA" && tieneComprobante);

              if (!esVentaActiva) continue;

              const logistica = (det.logistica_entrega || {}) as Record<string, any>;
              const entregaResumen = logistica.retiro_en_local
                ? "Retiro en tienda"
                : String(logistica.zona_detectada || logistica.direccion || "Domicilio");
              const fechaEventoOrden = String(
                det.aprobada_en || fila.prf_actualizado_en || fila.prf_creado_en || new Date().toISOString()
              );

              registrarItem({
                not_id: `syn-ord-${fila.prf_id}`,
                not_titulo: `🌸 ¡Venta Realizada! (${metaNeg.nombreVisible}): ${codigo} - $${totalUsd.toFixed(2)} [${metodoPago}]`,
                not_contenido_html: `<div><strong>Cliente:</strong> ${compradorNom}${
                  tel ? ` · <strong>Tel:</strong> ${tel}` : ""
                }${mail ? `<br/><strong>Correo:</strong> ${mail}` : ""}<br/><strong>Entrega:</strong> ${entregaResumen}${
                  logistica.fecha_entrega ? ` (${logistica.fecha_entrega})` : ""
                }</div>`,
                not_url_accion: `/panel/pedidos?codigo=${encodeURIComponent(codigo)}`,
                not_leido_en: null,
                not_creado_en: fechaEventoOrden,
                not_canal: "PUSH",
              });
            }
          }
        }
      } catch {
        // Continuar
      }
    }

    // 5. Síntesis de compras y pedidos propios del cliente autenticado en com_proforma
    try {
      const { data: misProformas } = await db
        .schema("comun_comercio")
        .from("com_proforma")
        .select("prf_id, prf_estado, prf_total, prf_creado_en, prf_detalle_proforma")
        .eq("prf_negocio", metaNeg.canon)
        .eq("prf_cliente_id", user.id)
        .is("prf_eliminado_en", null)
        .order("prf_creado_en", { ascending: false })
        .limit(15);

      if (Array.isArray(misProformas)) {
        for (const prf of misProformas) {
          const det = (prf.prf_detalle_proforma || {}) as Record<string, any>;
          const estado = String(prf.prf_estado || det.estado || "").toUpperCase();
          const metodo = String(det.metodo_pago || "").toLowerCase();
          const codigo = String(det.codigo_proforma || prf.prf_id);
          const yaExiste = Array.from(mapaItems.values()).some((n) =>
            n.not_titulo.includes(codigo)
          );
          if (yaExiste) continue;

          const esPagada =
            ["APROBADA", "RESERVADA_70", "ORDEN_CONFIRMADA"].includes(estado) ||
            Boolean(det.ultimo_pago_plux?.autorizacion);
          const esTransfConArchivo =
            metodo === "transferencia" && Boolean(det.comprobante_transferencia?.url);

          if (!esPagada && !esTransfConArchivo) continue;

          const total = Number(prf.prf_total ?? 0);
          registrarItem({
            not_id: `cli-ord-${prf.prf_id}`,
            not_titulo: esPagada
              ? `🧾 ¡Compra Confirmada! ${codigo} — $${total.toFixed(2)} USD`
              : `🏦 Pedido Registrado (${codigo}) — $${total.toFixed(2)} USD`,
            not_contenido_html: esPagada
              ? `<div>Tu orden <strong>${codigo}</strong> ha sido confirmada por <strong>$${total.toFixed(
                  2
                )} USD</strong>.</div>`
              : `<div>Recibimos tu pedido <strong>${codigo}</strong> y tu comprobante adjunto. Procesaremos el envío tras verificar la acreditación.</div>`,
            not_url_accion: "/panel",
            not_leido_en: null,
            not_creado_en: String(
              det.aprobada_en || prf.prf_creado_en || new Date().toISOString()
            ),
            not_canal: "IN_APP",
          });
        }
      }
    } catch {
      // Continuar con respaldo pagos_plux_confirmados
    }

    // 6. Síntesis de compras propias del cliente desde pagos_plux_confirmados en su perfil
    const pagosConfirmadosUsu: any[] = Array.isArray(detUsu.pagos_plux_confirmados)
      ? detUsu.pagos_plux_confirmados
      : [];
    const prefijoEsperado =
      metaNeg.canon === "tinkay"
        ? "TNK-"
        : metaNeg.canon === "margaritas"
        ? "MRG-"
        : metaNeg.canon === "fastfix"
        ? "FFH-"
        : "TRQ-";

    for (const p of pagosConfirmadosUsu.slice(0, 15)) {
      const ident = String(p?.identificador || "");
      const prodNom = String(p?.producto_nombre || "");
      if (!ident.startsWith(prefijoEsperado) && !prodNom.startsWith(prefijoEsperado)) continue;

      const codigoMatch = prodNom.match(/^[A-Z]{3}-[A-Z]+-\d+/)?.[0] || ident;
      const yaExiste = Array.from(mapaItems.values()).some((n) =>
        n.not_titulo.includes(codigoMatch)
      );
      if (yaExiste) continue;

      const monto = Number(p?.monto_total ?? 0);
      registrarItem({
        not_id: `cli-plx-${ident}`,
        not_titulo: `🧾 ¡Compra Confirmada! ${prodNom} — $${monto.toFixed(2)} USD`,
        not_contenido_html: `<div>Pago acreditado con <strong>PLUX (${
          p?.tarjeta_marca || "Tarjeta"
        } •••• ${p?.tarjeta_ultimos_digitos || "0000"})</strong> · Aut. <code>${
          p?.autorizacion || ident
        }</code>.</div>`,
        not_url_accion: "/panel",
        not_leido_en: null,
        not_creado_en: String(p?.confirmado_en || new Date().toISOString()),
        not_canal: "IN_APP",
      });
    }

    const ordenadas = Array.from(mapaItems.values()).sort(
      (a, b) => new Date(b.not_creado_en).getTime() - new Date(a.not_creado_en).getTime()
    );

    return { success: true, notificaciones: ordenadas };
  } catch (err) {
    console.warn("Error en consultarBandejaNotificacionesUsuario:", err);
    return { success: true, notificaciones: [] };
  }
}

export async function ejecutarAccionBandejaNotificacionUsuario(
  negocioParam: string,
  cuerpo: {
    not_id?: string;
    accion?: "aceptar" | "eliminar" | "posponer" | "restaurar" | "eliminar_todas";
    horas?: number;
    items?: Array<{ not_id: string }>;
  }
): Promise<{ success: boolean; error?: string }> {
  try {
    const metaNeg = normalizarNegocioNotif(negocioParam);
    const supabase = await crearClienteServidor();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user?.id) {
      return { success: false, error: "Sesión no activa" };
    }

    const db: any = crearClienteAdmin() || supabase;
    const { data: usuRow } = await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .select("usu_detalle_usuario")
      .eq("usu_id", user.id)
      .maybeSingle();

    const detUsu = (usuRow?.usu_detalle_usuario || {}) as Record<string, any>;
    const mapaGlobal = {
      ...((detUsu.notificaciones_estados_negocio as Record<string, any>) || {}),
    };
    const estadosNegocio: Record<string, EstadoLocalNotificacion> = {
      ...((mapaGlobal[metaNeg.canon] as Record<string, EstadoLocalNotificacion>) || {}),
    };
    const ahoraIso = new Date().toISOString();

    if (cuerpo.accion === "eliminar_todas" && Array.isArray(cuerpo.items)) {
      for (const it of cuerpo.items) {
        if (!it?.not_id) continue;
        estadosNegocio[it.not_id] = {
          ...(estadosNegocio[it.not_id] || {}),
          leido_en: estadosNegocio[it.not_id]?.leido_en || ahoraIso,
          eliminada: true,
          eliminada_en: ahoraIso,
        };
      }
    } else if (cuerpo.not_id && cuerpo.accion) {
      const prev = estadosNegocio[cuerpo.not_id] || {};
      if (cuerpo.accion === "aceptar") {
        estadosNegocio[cuerpo.not_id] = { ...prev, leido_en: ahoraIso };
      } else if (cuerpo.accion === "posponer") {
        const h = Math.max(1, Number(cuerpo.horas || 3));
        estadosNegocio[cuerpo.not_id] = {
          ...prev,
          pospuesta_horas: h,
          pospuesta_hasta: new Date(Date.now() + h * 3600 * 1000).toISOString(),
        };
      } else if (cuerpo.accion === "eliminar") {
        estadosNegocio[cuerpo.not_id] = {
          ...prev,
          leido_en: prev.leido_en || ahoraIso,
          eliminada: true,
          eliminada_en: ahoraIso,
        };
      } else if (cuerpo.accion === "restaurar") {
        estadosNegocio[cuerpo.not_id] = {
          ...prev,
          eliminada: false,
          eliminada_en: null,
        };
      }

      // Si el ID es un UUID nativo de not_registro, sincronizar también vía RPC cuando esté disponible
      if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(cuerpo.not_id)) {
        try {
          await db.schema("comun_seguridad").rpc("seg_fn_accion_mi_notificacion", {
            p_not_id: cuerpo.not_id,
            p_accion: cuerpo.accion,
            p_horas: Number(cuerpo.horas || 3),
          });
        } catch {
          // El estado en usu_detalle_usuario ya preserva la acción del usuario
        }
      }
    }

    // Recortar estados antiguos para evitar crecimiento indefinido
    const entradasRecientes = Object.entries(estadosNegocio).slice(-250);
    mapaGlobal[metaNeg.canon] = Object.fromEntries(entradasRecientes);

    await db
      .schema("comun_seguridad")
      .from("seg_usuario")
      .update({
        usu_detalle_usuario: {
          ...detUsu,
          notificaciones_estados_negocio: mapaGlobal,
        },
      })
      .eq("usu_id", user.id);

    return { success: true };
  } catch (err: any) {
    return { success: false, error: err?.message || "No se pudo actualizar la notificación" };
  }
}
