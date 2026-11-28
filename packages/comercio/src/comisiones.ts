import type { CanalOmnicanal, MensajeOmnicanal, MiembroEquipoOmnicanal } from "./omnicanal";

export type ReglaRepartoComision =
  | "GANADOR_UNICO"
  | "PROPORCIONAL_REAL"
  | "PROPORCIONAL_HUMANOS"
  | "MANUAL";

export type EstadoLiquidacionComision = "PENDIENTE" | "APROBADA" | "PAGADA" | "ANULADA";

export type PeriodoEstadisticasComision =
  | "hoy"
  | "ayer"
  | "semana"
  | "quincena"
  | "mes"
  | "personalizado"
  | "todos";

export interface ParticipanteChatCalculado {
  clave: string;
  usuarioId: string | null;
  nombre: string;
  esIa: boolean;
  mensajesConteo: number;
  porcentajeReal: number;
  porcentajeHumano: number;
}

export interface ResumenParticipacionChat {
  totalMensajesAtencion: number;
  mensajesIa: number;
  mensajesHumanos: number;
  porcentajeIa: number;
  liderHumano: ParticipanteChatCalculado | null;
  participantes: ParticipanteChatCalculado[];
}

export interface EntradaDesgloseFinancieroVenta {
  ventaTotalUsd: number;
  valorProductoUsd?: number;
  valorExtrasUsd?: number;
  extrasComisionan?: boolean;
  deliveryFijoUsd?: number;
  deliveryExtraUsd?: number;
  descuentosUsd?: number;
  comisionPasarelaUsd?: number;
}

export interface DesgloseFinancieroVenta {
  ventaTotalUsd: number;
  valorProductoUsd: number;
  valorExtrasUsd: number;
  extrasComisionan: boolean;
  deliveryFijoUsd: number;
  deliveryExtraUsd: number;
  descuentosUsd: number;
  comisionPasarelaUsd: number;
  baseComisionableUsd: number;
}

export interface AsignacionComisionAsesor {
  clave: string;
  usuarioId: string | null;
  asesorNombre: string;
  porcentajeParticipacionChat: number;
  porcentajeComisionAsignado: number;
  tasaComisionAsesorPct: number;
  montoComisionUsd: number;
}

export interface TasaComisionAsesor {
  usuarioId: string;
  nombre: string;
  rol?: string;
  tasaPorcentaje: number;
  activo: boolean;
  actualizadoEn?: string | null;
}

export interface VentaComisionRegistrada {
  id: string;
  negocio: string;
  conversacionId?: string | null;
  proformaId?: string | null;
  codigoPedido?: string | null;
  clienteNombre: string;
  clienteTelefono?: string | null;
  canal: CanalOmnicanal | string;
  productoResumen?: string | null;
  desglose: DesgloseFinancieroVenta;
  porcentajeIaChat: number;
  reglaReparto: ReglaRepartoComision;
  liderHumanoNombre?: string | null;
  asignaciones: AsignacionComisionAsesor[];
  totalComisionUsd: number;
  estadoLiquidacion: EstadoLiquidacionComision;
  notaAdmin?: string | null;
  cerradoPorId?: string | null;
  cerradoPorNombre?: string | null;
  cerradoEn: string;
  fechaDiaEc: string;
}

export interface ResumenAsesorEstadisticas {
  clave: string;
  usuarioId: string | null;
  nombre: string;
  ventasParticipadas: number;
  ventasLideradas: number;
  ventaTotalAtribuidaUsd: number;
  baseComisionableAtribuidaUsd: number;
  comisionTotalUsd: number;
  tasaVigentePct: number;
}

export interface ResumenTiendaComisiones {
  cantidadVentas: number;
  ventaTotalUsd: number;
  valorProductoUsd: number;
  valorExtrasUsd: number;
  deliveryFijoUsd: number;
  deliveryExtraUsd: number;
  descuentosUsd: number;
  comisionPasarelaUsd: number;
  baseComisionableUsd: number;
  totalComisionesUsd: number;
  promedioParticipacionIaPct: number;
  porAsesor: ResumenAsesorEstadisticas[];
}

function redondear2(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 100) / 100;
}

function redondear1(n: number): number {
  if (!Number.isFinite(n)) return 0;
  return Math.round(n * 10) / 10;
}

function numeroPositivo(v: unknown): number {
  const n = Number(v);
  if (!Number.isFinite(n) || n < 0) return 0;
  return redondear2(n);
}

/**
 * Devuelve la fecha calendario local de Ecuador (UTC-5, `YYYY-MM-DD`) para filtrar
 * correctamente las ventas del día sin corrimientos nocturnos por UTC.
 */
export function obtenerFechaDiaEcuador(fecha?: string | Date | null): string {
  const d =
    fecha instanceof Date
      ? fecha
      : fecha
        ? new Date(fecha)
        : new Date();
  const baseMs = Number.isNaN(d.getTime()) ? Date.now() : d.getTime();
  // Ecuador continental = UTC-5 fijo todo el año
  const ecuador = new Date(baseMs - 5 * 60 * 60 * 1000);
  const y = ecuador.getUTCFullYear();
  const m = String(ecuador.getUTCMonth() + 1).padStart(2, "0");
  const day = String(ecuador.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

/**
 * Calcula los indicadores/porcentajes de atención del chat entre la IA (Mía) y
 * cada integrante del equipo humano que intervino con respuestas al cliente.
 * Excluye notas internas y mensajes del propio cliente.
 */
export function calcularParticipacionChatOmnicanal(
  mensajes: Pick<
    MensajeOmnicanal,
    "origen" | "autorUsuarioId" | "autorNombre" | "creadoEn"
  >[],
  equipo: Pick<MiembroEquipoOmnicanal, "usuarioId" | "nombre">[] = [],
  desdeIso?: string | null
): ResumenParticipacionChat {
  const desdeMs = desdeIso ? new Date(desdeIso).getTime() : 0;
  const mapaEquipoPorId = new Map<string, string>();
  const mapaEquipoPorNombreNorm = new Map<string, { usuarioId: string; nombre: string }>();

  for (const m of equipo) {
    if (m.usuarioId) {
      mapaEquipoPorId.set(m.usuarioId, m.nombre);
      const norm = m.nombre.trim().toLowerCase();
      if (norm) mapaEquipoPorNombreNorm.set(norm, { usuarioId: m.usuarioId, nombre: m.nombre });
      const primer = norm.split(/\s+/)[0];
      if (primer && !mapaEquipoPorNombreNorm.has(primer)) {
        mapaEquipoPorNombreNorm.set(primer, { usuarioId: m.usuarioId, nombre: m.nombre });
      }
    }
  }

  let mensajesIa = 0;
  let mensajesHumanos = 0;
  const conteosHumanos = new Map<
    string,
    { clave: string; usuarioId: string | null; nombre: string; conteo: number }
  >();

  for (const msg of mensajes) {
    if (msg.origen === "NOTA_INTERNA" || msg.origen === "SISTEMA" || msg.origen === "CLIENTE") {
      continue;
    }
    if (desdeMs > 0 && msg.creadoEn) {
      const t = new Date(msg.creadoEn).getTime();
      if (!Number.isNaN(t) && t < desdeMs) continue;
    }

    if (msg.origen === "BOT_ARIA") {
      mensajesIa += 1;
      continue;
    }

    if (msg.origen === "ASESORA_HUMANA") {
      mensajesHumanos += 1;
      let usuarioId = msg.autorUsuarioId ? String(msg.autorUsuarioId).trim() : null;
      let nombre = String(msg.autorNombre || "").trim();

      if (usuarioId && mapaEquipoPorId.has(usuarioId)) {
        nombre = mapaEquipoPorId.get(usuarioId)!;
      } else if (!usuarioId && nombre) {
        const matchEq = mapaEquipoPorNombreNorm.get(nombre.toLowerCase());
        if (matchEq) {
          usuarioId = matchEq.usuarioId;
          nombre = matchEq.nombre;
        }
      }

      if (!nombre) nombre = "Equipo";
      const clave = usuarioId ? `usu:${usuarioId}` : `nom:${nombre.toLowerCase()}`;
      const actual = conteosHumanos.get(clave);
      if (actual) {
        actual.conteo += 1;
      } else {
        conteosHumanos.set(clave, { clave, usuarioId, nombre, conteo: 1 });
      }
    }
  }

  const total = mensajesIa + mensajesHumanos;
  const participantes: ParticipanteChatCalculado[] = [];

  if (mensajesIa > 0) {
    participantes.push({
      clave: "ia:aria",
      usuarioId: null,
      nombre: "IA (Mía)",
      esIa: true,
      mensajesConteo: mensajesIa,
      porcentajeReal: total > 0 ? redondear1((mensajesIa / total) * 100) : 0,
      porcentajeHumano: 0,
    });
  }

  const humanosOrdenados = Array.from(conteosHumanos.values()).sort(
    (a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre)
  );

  for (const h of humanosOrdenados) {
    participantes.push({
      clave: h.clave,
      usuarioId: h.usuarioId,
      nombre: h.nombre,
      esIa: false,
      mensajesConteo: h.conteo,
      porcentajeReal: total > 0 ? redondear1((h.conteo / total) * 100) : 0,
      porcentajeHumano: mensajesHumanos > 0 ? redondear1((h.conteo / mensajesHumanos) * 100) : 0,
    });
  }

  const liderHumano = participantes.find((p) => !p.esIa) ?? null;

  return {
    totalMensajesAtencion: total,
    mensajesIa,
    mensajesHumanos,
    porcentajeIa: total > 0 ? redondear1((mensajesIa / total) * 100) : 0,
    liderHumano,
    participantes,
  };
}

/**
 * Calcula el desglose financiero y la Base Comisionable Neta de una venta cerrada,
 * descontando delivery fijo, cargo extra por delivery, descuentos, comisión de pasarela
 * y (opcionalmente) los extras si el administrador indica que no comisionan.
 */
export function calcularBaseComisionableVenta(
  entrada: EntradaDesgloseFinancieroVenta
): DesgloseFinancieroVenta {
  const deliveryFijoUsd = numeroPositivo(entrada.deliveryFijoUsd);
  const deliveryExtraUsd = numeroPositivo(entrada.deliveryExtraUsd);
  const valorExtrasUsd = numeroPositivo(entrada.valorExtrasUsd);
  const descuentosUsd = numeroPositivo(entrada.descuentosUsd);
  const comisionPasarelaUsd = numeroPositivo(entrada.comisionPasarelaUsd);
  const extrasComisionan = entrada.extrasComisionan !== false;

  const ventaTotalCalculada =
    entrada.ventaTotalUsd > 0
      ? numeroPositivo(entrada.ventaTotalUsd)
      : redondear2(
          numeroPositivo(entrada.valorProductoUsd) +
            valorExtrasUsd +
            deliveryFijoUsd +
            deliveryExtraUsd -
            descuentosUsd
        );

  const valorProductoUsd =
    entrada.valorProductoUsd != null && entrada.valorProductoUsd >= 0
      ? numeroPositivo(entrada.valorProductoUsd)
      : Math.max(
          0,
          redondear2(ventaTotalCalculada - valorExtrasUsd - deliveryFijoUsd - deliveryExtraUsd)
        );

  const baseBruta =
    ventaTotalCalculada -
    deliveryFijoUsd -
    deliveryExtraUsd -
    (extrasComisionan ? 0 : valorExtrasUsd) -
    descuentosUsd -
    comisionPasarelaUsd;

  return {
    ventaTotalUsd: ventaTotalCalculada,
    valorProductoUsd,
    valorExtrasUsd,
    extrasComisionan,
    deliveryFijoUsd,
    deliveryExtraUsd,
    descuentosUsd,
    comisionPasarelaUsd,
    baseComisionableUsd: Math.max(0, redondear2(baseBruta)),
  };
}

/**
 * Calcula las asignaciones y montos de comisión por asesor aplicando la regla
 * elegida por el administrador al cierre y la tasa variable individual de cada asesor.
 */
export function calcularRepartoComisionesVenta(params: {
  baseComisionableUsd: number;
  participantesHumanos: Array<{
    clave: string;
    usuarioId: string | null;
    nombre: string;
    porcentajeReal: number;
    porcentajeHumano: number;
  }>;
  regla: ReglaRepartoComision;
  ganadorClave?: string | null;
  porcentajesManuales?: Record<string, number>;
  tasasPorUsuarioId?: Record<string, number>;
  tasaPorDefectoPct?: number;
}): {
  asignaciones: AsignacionComisionAsesor[];
  totalPorcentajeAsignado: number;
  totalComisionUsd: number;
} {
  const base = Math.max(0, numeroPositivo(params.baseComisionableUsd));
  const tasas = params.tasasPorUsuarioId ?? {};
  const tasaDef = Math.max(0, Math.min(100, Number(params.tasaPorDefectoPct ?? 5)));
  const humanos = params.participantesHumanos;

  const claveGanadorEfectiva =
    params.ganadorClave || humanos[0]?.clave || null;

  const asignaciones: AsignacionComisionAsesor[] = [];

  for (const h of humanos) {
    let pctAsignado = 0;
    if (params.regla === "GANADOR_UNICO") {
      pctAsignado = h.clave === claveGanadorEfectiva ? 100 : 0;
    } else if (params.regla === "PROPORCIONAL_REAL") {
      pctAsignado = Math.max(0, Math.min(100, redondear1(h.porcentajeReal)));
    } else if (params.regla === "PROPORCIONAL_HUMANOS") {
      pctAsignado = Math.max(0, Math.min(100, redondear1(h.porcentajeHumano)));
    } else {
      const manualRaw = params.porcentajesManuales?.[h.clave] ?? 0;
      pctAsignado = Math.max(0, Math.min(100, redondear1(Number(manualRaw) || 0)));
    }

    const tasaAsesor =
      h.usuarioId && tasas[h.usuarioId] != null
        ? Math.max(0, Math.min(100, Number(tasas[h.usuarioId])))
        : tasaDef;

    const montoComisionUsd = redondear2(base * (pctAsignado / 100) * (tasaAsesor / 100));

    asignaciones.push({
      clave: h.clave,
      usuarioId: h.usuarioId,
      asesorNombre: h.nombre,
      porcentajeParticipacionChat: redondear1(h.porcentajeReal),
      porcentajeComisionAsignado: pctAsignado,
      tasaComisionAsesorPct: tasaAsesor,
      montoComisionUsd,
    });
  }

  const totalPorcentajeAsignado = redondear1(
    asignaciones.reduce((acc, a) => acc + a.porcentajeComisionAsignado, 0)
  );
  const totalComisionUsd = redondear2(
    asignaciones.reduce((acc, a) => acc + a.montoComisionUsd, 0)
  );

  return {
    asignaciones,
    totalPorcentajeAsignado,
    totalComisionUsd,
  };
}

/**
 * Filtra ventas cerradas respetando estrictamente la visibilidad por rol:
 * - Asesores de ventas (`esAdmin = false`): ÚNICAMENTE las ventas de HOY (propias y
 *   de sus compañeros), bloqueando cualquier consulta semanal, mensual o histórica.
 * - Administradores (`esAdmin = true`): cualquier periodo (`hoy`, `ayer`, `semana`,
 *   `quincena`, `mes`, `personalizado`, `todos`).
 */
export function filtrarVentasPorPeriodoYRol(params: {
  ventas: VentaComisionRegistrada[];
  periodo: PeriodoEstadisticasComision;
  esAdmin: boolean;
  fechaDesde?: string | null;
  fechaHasta?: string | null;
  ahora?: Date;
}): {
  periodoEfectivo: PeriodoEstadisticasComision;
  ventasFiltradas: VentaComisionRegistrada[];
} {
  const ahora = params.ahora ?? new Date();
  const hoyEc = obtenerFechaDiaEcuador(ahora);
  const periodoEfectivo: PeriodoEstadisticasComision = params.esAdmin ? params.periodo : "hoy";

  const activas = params.ventas.filter((v) => v.estadoLiquidacion !== "ANULADA");

  if (periodoEfectivo === "todos") {
    return { periodoEfectivo, ventasFiltradas: activas };
  }

  if (periodoEfectivo === "hoy") {
    return {
      periodoEfectivo,
      ventasFiltradas: activas.filter((v) => (v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn)) === hoyEc),
    };
  }

  const msDia = 24 * 60 * 60 * 1000;
  if (periodoEfectivo === "ayer") {
    const ayerEc = obtenerFechaDiaEcuador(new Date(ahora.getTime() - msDia));
    return {
      periodoEfectivo,
      ventasFiltradas: activas.filter((v) => (v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn)) === ayerEc),
    };
  }

  if (periodoEfectivo === "semana") {
    const desde = obtenerFechaDiaEcuador(new Date(ahora.getTime() - 6 * msDia));
    return {
      periodoEfectivo,
      ventasFiltradas: activas.filter((v) => {
        const d = v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn);
        return d >= desde && d <= hoyEc;
      }),
    };
  }

  if (periodoEfectivo === "quincena") {
    const diaNum = Number(hoyEc.slice(8, 10));
    const prefijoMes = hoyEc.slice(0, 7);
    const desde = diaNum <= 15 ? `${prefijoMes}-01` : `${prefijoMes}-16`;
    return {
      periodoEfectivo,
      ventasFiltradas: activas.filter((v) => {
        const d = v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn);
        return d >= desde && d <= hoyEc;
      }),
    };
  }

  if (periodoEfectivo === "mes") {
    const prefijoMes = hoyEc.slice(0, 7);
    return {
      periodoEfectivo,
      ventasFiltradas: activas.filter((v) =>
        (v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn)).startsWith(prefijoMes)
      ),
    };
  }

  // personalizado
  const desde = (params.fechaDesde || "").trim() || hoyEc;
  const hasta = (params.fechaHasta || "").trim() || hoyEc;
  return {
    periodoEfectivo,
    ventasFiltradas: activas.filter((v) => {
      const d = v.fechaDiaEc || obtenerFechaDiaEcuador(v.cerradoEn);
      return d >= desde && d <= hasta;
    }),
  };
}

/**
 * Consolida KPIs de tienda y ranking por asesor a partir de una lista ya filtrada de ventas.
 */
export function resumirEstadisticasVentasYAsesores(
  ventas: VentaComisionRegistrada[],
  tasasPorUsuarioId: Record<string, number> = {},
  tasaPorDefectoPct = 5
): ResumenTiendaComisiones {
  let ventaTotalUsd = 0;
  let valorProductoUsd = 0;
  let valorExtrasUsd = 0;
  let deliveryFijoUsd = 0;
  let deliveryExtraUsd = 0;
  let descuentosUsd = 0;
  let comisionPasarelaUsd = 0;
  let baseComisionableUsd = 0;
  let totalComisionesUsd = 0;
  let sumaIaPct = 0;

  const mapaAsesor = new Map<string, ResumenAsesorEstadisticas>();

  for (const v of ventas) {
    if (v.estadoLiquidacion === "ANULADA") continue;
    ventaTotalUsd += Number(v.desglose.ventaTotalUsd || 0);
    valorProductoUsd += Number(v.desglose.valorProductoUsd || 0);
    valorExtrasUsd += Number(v.desglose.valorExtrasUsd || 0);
    deliveryFijoUsd += Number(v.desglose.deliveryFijoUsd || 0);
    deliveryExtraUsd += Number(v.desglose.deliveryExtraUsd || 0);
    descuentosUsd += Number(v.desglose.descuentosUsd || 0);
    comisionPasarelaUsd += Number(v.desglose.comisionPasarelaUsd || 0);
    baseComisionableUsd += Number(v.desglose.baseComisionableUsd || 0);
    totalComisionesUsd += Number(v.totalComisionUsd || 0);
    sumaIaPct += Number(v.porcentajeIaChat || 0);

    const mayorAsig = [...(v.asignaciones || [])].sort(
      (a, b) => b.porcentajeComisionAsignado - a.porcentajeComisionAsignado
    )[0];

    for (const asig of v.asignaciones || []) {
      if (asig.porcentajeComisionAsignado <= 0 && asig.porcentajeParticipacionChat <= 0) continue;
      const clave = asig.usuarioId ? `usu:${asig.usuarioId}` : asig.clave;
      const factor = Math.max(0, asig.porcentajeComisionAsignado) / 100;
      const actual = mapaAsesor.get(clave) ?? {
        clave,
        usuarioId: asig.usuarioId,
        nombre: asig.asesorNombre,
        ventasParticipadas: 0,
        ventasLideradas: 0,
        ventaTotalAtribuidaUsd: 0,
        baseComisionableAtribuidaUsd: 0,
        comisionTotalUsd: 0,
        tasaVigentePct:
          asig.usuarioId && tasasPorUsuarioId[asig.usuarioId] != null
            ? tasasPorUsuarioId[asig.usuarioId]!
            : asig.tasaComisionAsesorPct ?? tasaPorDefectoPct,
      };
      actual.ventasParticipadas += 1;
      if (mayorAsig && mayorAsig.clave === asig.clave && asig.porcentajeComisionAsignado > 0) {
        actual.ventasLideradas += 1;
      }
      actual.ventaTotalAtribuidaUsd = redondear2(
        actual.ventaTotalAtribuidaUsd + v.desglose.ventaTotalUsd * factor
      );
      actual.baseComisionableAtribuidaUsd = redondear2(
        actual.baseComisionableAtribuidaUsd + v.desglose.baseComisionableUsd * factor
      );
      actual.comisionTotalUsd = redondear2(actual.comisionTotalUsd + asig.montoComisionUsd);
      mapaAsesor.set(clave, actual);
    }
  }

  const cantidadVentas = ventas.filter((v) => v.estadoLiquidacion !== "ANULADA").length;

  return {
    cantidadVentas,
    ventaTotalUsd: redondear2(ventaTotalUsd),
    valorProductoUsd: redondear2(valorProductoUsd),
    valorExtrasUsd: redondear2(valorExtrasUsd),
    deliveryFijoUsd: redondear2(deliveryFijoUsd),
    deliveryExtraUsd: redondear2(deliveryExtraUsd),
    descuentosUsd: redondear2(descuentosUsd),
    comisionPasarelaUsd: redondear2(comisionPasarelaUsd),
    baseComisionableUsd: redondear2(baseComisionableUsd),
    totalComisionesUsd: redondear2(totalComisionesUsd),
    promedioParticipacionIaPct: cantidadVentas > 0 ? redondear1(sumaIaPct / cantidadVentas) : 0,
    porAsesor: Array.from(mapaAsesor.values()).sort(
      (a, b) =>
        b.ventaTotalAtribuidaUsd - a.ventaTotalAtribuidaUsd ||
        b.comisionTotalUsd - a.comisionTotalUsd
    ),
  };
}
