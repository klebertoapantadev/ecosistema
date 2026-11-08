import { crearClienteServidor } from "@eco/supabase/servidor";
import { aMinutos, deMinutos, trocearFranja } from "@eco/agenda";
import type {
  DatosConfigNegocioAgenda,
  FechaEspecialAgenda,
  FranjaHorarioNegocio,
  RangoHoraSimple,
} from "./esquema";

// Server-only. No importar desde un client component.
//
// Todo lo que sale de aquí pasa por RLS con la sesión del usuario: no hay
// service_role en este módulo. Los huecos de un tercero se piden por RPC
// `security definer`, que devuelve solo horas libres y nunca el detalle de lo
// ocupado (PLT-020 regla 6).

const NEGOCIO = "tranqi";

export interface HuecoDisponible {
  hueco_inicio: string;
  hueco_fin: string;
  disponibles: number;
}

export interface CitaResumen {
  cit_id: string;
  cit_inicio_en: string;
  cit_fin_en: string | null;
  cit_modalidad: string;
  cit_estado: string;
  cit_motivo: string | null;
  cit_enlace: string | null;
  cit_lugar: string | null;
  cit_cobertura: string;
  cit_asignacion: string;
  cit_abogado_id: string | null;
  cit_materia_id?: string | null;
  cit_detalle_cita?: Record<string, unknown> | null;
}

export interface ServicioAgendable {
  var_id: string;
  var_producto_id: string;
  var_sku: string;
  var_nombre: string;
  var_precio: number;
  var_tarifa_iva_porcentaje: number;
  var_detalle_variante: Record<string, unknown> | null;
  monto_iva: number;
  precio_total: number;
}

const FRANJAS_VIRTUAL_DEFECTO: FranjaHorarioNegocio[] = [
  { dia_semana: 1, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 2, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 3, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 4, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 5, hora_inicio: "08:00", hora_fin: "19:00" },
  { dia_semana: 6, hora_inicio: "09:00", hora_fin: "14:00" },
];

const FRANJAS_PRESENCIAL_DEFECTO: FranjaHorarioNegocio[] = [
  { dia_semana: 1, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 2, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 3, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 4, hora_inicio: "09:00", hora_fin: "17:30" },
  { dia_semana: 5, hora_inicio: "09:00", hora_fin: "17:30" },
];

const FECHAS_ESPECIALES_DEFECTO: FechaEspecialAgenda[] = [
  {
    fecha: "2026-12-25",
    nombre: "Navidad (Solo Teleconsultas)",
    cerrado_total: false,
    habilitar_virtual: true,
    franjas_virtual: [{ hora_inicio: "08:00", hora_fin: "16:00" }],
    habilitar_presencial: false,
    franjas_presencial: [],
    max_citas_simultaneas: 1,
  },
];

export const CONFIG_AGENDA_NEGOCIO_DEFECTO: DatosConfigNegocioAgenda = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 2,
  horizonte_dias: 45,
  permitir_sin_profesional: true,
  max_citas_simultaneas: 1,
  modo_capacidad: "fijo_negocio",
  direccion_presencial: "Despacho Central Tranqi · Quito, Ecuador",
  materia_defecto_nombre: "Civil",
  franjas_virtual: FRANJAS_VIRTUAL_DEFECTO,
  franjas_presencial: FRANJAS_PRESENCIAL_DEFECTO,
  fechas_especiales: FECHAS_ESPECIALES_DEFECTO,
};

let cacheConfigNegocioMemoria: DatosConfigNegocioAgenda | null = null;

export function actualizarCacheConfigAgendaNegocio(nueva: DatosConfigNegocioAgenda) {
  cacheConfigNegocioMemoria = nueva;
}

export async function obtenerConfiguracionAgendaNegocio(): Promise<DatosConfigNegocioAgenda> {
  try {
    const supabase = await crearClienteServidor();
    const { data: rawData, error } = await supabase
      .schema("comun_agenda")
      .from("age_config_negocio" as never)
      .select("*")
      .eq("cgn_negocio", NEGOCIO)
      .is("cgn_eliminado_en", null)
      .maybeSingle();

    const data = rawData as Record<string, unknown> | null;
    if (error || !data) {
      return cacheConfigNegocioMemoria ?? CONFIG_AGENDA_NEGOCIO_DEFECTO;
    }

    const detalle = (data.cgn_detalle_config ?? {}) as Record<string, unknown>;
    const franjasVirtual =
      Array.isArray(data.cgn_franjas_virtual) && data.cgn_franjas_virtual.length > 0
        ? (data.cgn_franjas_virtual as FranjaHorarioNegocio[])
        : FRANJAS_VIRTUAL_DEFECTO;
    const franjasPresencial =
      Array.isArray(data.cgn_franjas_presencial) && data.cgn_franjas_presencial.length > 0
        ? (data.cgn_franjas_presencial as FranjaHorarioNegocio[])
        : FRANJAS_PRESENCIAL_DEFECTO;

    const rawFechasCol = data.cgn_fechas_especiales;
    const rawFechasDet = detalle.fechas_especiales;
    const fechasEspeciales: FechaEspecialAgenda[] = Array.isArray(rawFechasCol)
      ? (rawFechasCol as FechaEspecialAgenda[])
      : Array.isArray(rawFechasDet)
        ? (rawFechasDet as FechaEspecialAgenda[])
        : FECHAS_ESPECIALES_DEFECTO;

    const maxCitasRaw =
      typeof data.cgn_max_citas_simultaneas === "number"
        ? data.cgn_max_citas_simultaneas
        : typeof detalle.max_citas_simultaneas === "number"
          ? detalle.max_citas_simultaneas
          : 1;

    const modoCapacidadRaw =
      detalle.modo_capacidad === "hibrido_abogados" ||
      detalle.modo_capacidad === "solo_abogados" ||
      detalle.modo_capacidad === "fijo_negocio"
        ? detalle.modo_capacidad
        : "fijo_negocio";

    const configFinal: DatosConfigNegocioAgenda = {
      zona_horaria: typeof data.cgn_zona_horaria === "string" ? data.cgn_zona_horaria : "America/Guayaquil",
      duracion_cita_min: Number(data.cgn_duracion_cita_min ?? 45),
      holgura_min: Number(data.cgn_holgura_min ?? 15),
      antelacion_minima_horas: Number(data.cgn_antelacion_minima_horas ?? 2),
      horizonte_dias: Number(data.cgn_horizonte_dias ?? 45),
      permitir_sin_profesional: Boolean(data.cgn_permitir_sin_profesional ?? true),
      max_citas_simultaneas: Math.max(1, Math.min(50, Number(maxCitasRaw) || 1)),
      modo_capacidad: modoCapacidadRaw,
      direccion_presencial:
        typeof data.cgn_direccion_presencial === "string"
          ? data.cgn_direccion_presencial
          : CONFIG_AGENDA_NEGOCIO_DEFECTO.direccion_presencial,
      materia_defecto_nombre:
        typeof detalle.materia_defecto_nombre === "string" && detalle.materia_defecto_nombre.trim()
          ? detalle.materia_defecto_nombre.trim()
          : "Civil",
      franjas_virtual: franjasVirtual,
      franjas_presencial: franjasPresencial,
      fechas_especiales: fechasEspeciales,
    };

    cacheConfigNegocioMemoria = configFinal;
    return configFinal;
  } catch {
    return cacheConfigNegocioMemoria ?? CONFIG_AGENDA_NEGOCIO_DEFECTO;
  }
}

export async function listarMateriasAgendables() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .schema("tranqui_legal")
    .from("trq_materia")
    .select("mat_id, mat_nombre")
    .eq("mat_activa", true)
    .order("mat_nombre");
  return data ?? [];
}

/** Servicios del catálogo que se pueden agendar: los que declaran duración. */
export async function listarServiciosAgendables(): Promise<ServicioAgendable[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.schema("comun_comercio")
    .from("com_variante")
    .select("var_id, var_producto_id, var_sku, var_nombre, var_precio, var_tarifa_iva_porcentaje, var_detalle_variante")
    .eq("var_negocio", NEGOCIO)
    .eq("var_activo", true)
    .eq("var_tipo_oferta", "UNICO")
    .is("var_eliminado_en", null)
    .order("var_precio");

  const filtrados = ((data ?? []) as Array<{
    var_id: string;
    var_producto_id?: string;
    var_sku: string;
    var_nombre: string;
    var_precio: number;
    var_tarifa_iva_porcentaje: number;
    var_detalle_variante: Record<string, unknown> | null;
  }>).filter((v) => typeof v.var_detalle_variante?.duracion_min === "number");

  if (filtrados.length === 0) {
    return [
      {
        var_id: "00000000-0000-4000-8000-000000000101",
        var_producto_id: "00000000-0000-4000-8000-000000000100",
        var_sku: "TRQ-CON-ESP",
        var_nombre: "Consulta con Abogado Especialista (45 min)",
        var_precio: 45,
        var_tarifa_iva_porcentaje: 15,
        var_detalle_variante: { duracion_min: 45, modalidad: ["virtual", "presencial"] },
        monto_iva: 6.75,
        precio_total: 51.75,
      },
      {
        var_id: "00000000-0000-4000-8000-000000000102",
        var_producto_id: "00000000-0000-4000-8000-000000000100",
        var_sku: "TRQ-CON-RAP",
        var_nombre: "Consulta Jurídica Rápida (30 min)",
        var_precio: 25,
        var_tarifa_iva_porcentaje: 15,
        var_detalle_variante: { duracion_min: 30, modalidad: ["virtual"] },
        monto_iva: 3.75,
        precio_total: 28.75,
      },
    ];
  }

  return filtrados.map((v) => {
    const subtotal = Number(v.var_precio ?? 0);
    const ivaPct = Number(v.var_tarifa_iva_porcentaje ?? 15);
    const montoIva = Math.round(subtotal * (ivaPct / 100) * 100) / 100;
    const total = Math.round((subtotal + montoIva) * 100) / 100;
    return {
      var_id: v.var_id,
      var_producto_id: v.var_producto_id ?? v.var_id,
      var_sku: v.var_sku,
      var_nombre: v.var_nombre,
      var_precio: subtotal,
      var_tarifa_iva_porcentaje: ivaPct,
      var_detalle_variante: v.var_detalle_variante,
      monto_iva: montoIva,
      precio_total: total,
    };
  });
}

export function proyectarHuecosPorDefectoLocal(
  desde: Date,
  hasta: Date,
  modalidad: string | null | undefined,
  config: DatosConfigNegocioAgenda,
  duracionOverrideMin?: number | null,
  ignorarAntelacion?: boolean,
): HuecoDisponible[] {
  const duracion = duracionOverrideMin ?? config.duracion_cita_min ?? 45;
  const holgura = config.holgura_min ?? 15;
  const maxCitasDefecto = Math.max(1, config.max_citas_simultaneas ?? 1);
  const antelacionMs = ignorarAntelacion ? 0 : (config.antelacion_minima_horas ?? 2) * 3600 * 1000;
  const horizonteMs = ignorarAntelacion
    ? 365 * 86400 * 1000
    : (config.horizonte_dias ?? 45) * 86400 * 1000;
  const ahoraMs = Date.now();
  const minInicioMs = ignorarAntelacion ? desde.getTime() : Math.max(desde.getTime(), ahoraMs + antelacionMs);
  const maxFinMs = ignorarAntelacion ? hasta.getTime() : Math.min(hasta.getTime(), ahoraMs + horizonteMs);

  const esPresencial = modalidad === "presencial";
  const franjasSemanales = esPresencial ? config.franjas_presencial : config.franjas_virtual;
  const fechasEspeciales = Array.isArray(config.fechas_especiales) ? config.fechas_especiales : [];
  const mapaFechasEspeciales = new Map<string, FechaEspecialAgenda>();
  for (const fe of fechasEspeciales) {
    if (fe?.fecha) {
      mapaFechasEspeciales.set(fe.fecha, fe);
    }
  }

  const resultado: HuecoDisponible[] = [];
  // Iterar día a día en horario Ecuador (UTC-5)
  const cursor = new Date(minInicioMs);
  cursor.setUTCHours(5, 0, 0, 0); // 00:00 America/Guayaquil = 05:00 UTC

  while (cursor.getTime() <= maxFinMs) {
    // Día de la semana en Ecuador (1=Lunes ... 7=Domingo)
    const fechaEcu = new Date(cursor.getTime() - 5 * 3600 * 1000);
    const jsDay = fechaEcu.getUTCDay(); // 0=Dom, 1=Lun...
    const isoDay = jsDay === 0 ? 7 : jsDay;
    const yyyy = fechaEcu.getUTCFullYear();
    const mm = String(fechaEcu.getUTCMonth() + 1).padStart(2, "0");
    const dd = String(fechaEcu.getUTCDate()).padStart(2, "0");
    const claveFecha = `${yyyy}-${mm}-${dd}`;

    const reglaEspecial = mapaFechasEspeciales.get(claveFecha);
    let rangosDelDia: RangoHoraSimple[] = [];
    let cupoDelDia = maxCitasDefecto;

    if (reglaEspecial) {
      // Si la fecha tiene un horario diferenciado configurado, reemplaza al horario semanal normal
      if (!reglaEspecial.cerrado_total) {
        if (esPresencial && reglaEspecial.habilitar_presencial) {
          rangosDelDia = Array.isArray(reglaEspecial.franjas_presencial)
            ? reglaEspecial.franjas_presencial
            : [];
        } else if (!esPresencial && reglaEspecial.habilitar_virtual) {
          rangosDelDia = Array.isArray(reglaEspecial.franjas_virtual)
            ? reglaEspecial.franjas_virtual
            : [];
        }
      }
      cupoDelDia = Math.max(1, reglaEspecial.max_citas_simultaneas ?? maxCitasDefecto);
    } else {
      rangosDelDia = franjasSemanales
        .filter((f) => f.dia_semana === isoDay)
        .map((f) => ({ hora_inicio: f.hora_inicio, hora_fin: f.hora_fin }));
    }

    for (const f of rangosDelDia) {
      const bloques = trocearFranja(
        aMinutos(f.hora_inicio),
        aMinutos(f.hora_fin),
        duracion,
        holgura,
      );
      for (const b of bloques) {
        const horaIniStr = deMinutos(b.inicioMin);
        const horaFinStr = deMinutos(b.finMin);
        const inicioIso = new Date(`${yyyy}-${mm}-${dd}T${horaIniStr}:00-05:00`);
        const finIso = new Date(`${yyyy}-${mm}-${dd}T${horaFinStr}:00-05:00`);
        if (inicioIso.getTime() >= minInicioMs && finIso.getTime() <= maxFinMs) {
          resultado.push({
            hueco_inicio: inicioIso.toISOString(),
            hueco_fin: finIso.toISOString(),
            disponibles: cupoDelDia,
          });
        }
      }
    }

    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }

  return resultado;
}

export async function obtenerHuecosDeMateria(
  materiaId: string,
  desde: Date,
  hasta: Date,
  varianteId?: string | null,
  modalidad?: string | null,
): Promise<HuecoDisponible[]> {
  const supabase = await crearClienteServidor();
  const [rpcRes, config, citasRes] = await Promise.all([
    supabase.schema("tranqui_legal").rpc("trq_fn_horarios_materia", {
      p_materia_id: materiaId,
      p_desde: desde.toISOString(),
      p_hasta: hasta.toISOString(),
      p_variante_id: varianteId ?? undefined,
      p_modalidad: modalidad ?? undefined,
      p_provincia_id: undefined,
    }),
    obtenerConfiguracionAgendaNegocio(),
    supabase
      .schema("tranqui_legal")
      .from("trq_cita")
      .select("cit_inicio_en, cit_fin_en, cit_estado")
      .is("cit_eliminado_en", null)
      .neq("cit_estado", "cancelada")
      .gte("cit_inicio_en", new Date(desde.getTime() - 4 * 3600 * 1000).toISOString())
      .lte("cit_inicio_en", hasta.toISOString()),
  ]);

  const huecosRpc = (!rpcRes.error && Array.isArray(rpcRes.data) ? rpcRes.data : []) as HuecoDisponible[];
  const citasActivas = ((citasRes.data ?? []) as Array<{
    cit_inicio_en: string;
    cit_fin_en: string | null;
    cit_estado: string;
  }>).map((c) => {
    const iniMs = new Date(c.cit_inicio_en).getTime();
    const finMs = c.cit_fin_en
      ? new Date(c.cit_fin_en).getTime()
      : iniMs + (config.duracion_cita_min ?? 45) * 60 * 1000;
    return { iniMs, finMs };
  });

  if (!config.permitir_sin_profesional || config.modo_capacidad === "solo_abogados") {
    return huecosRpc;
  }

  // Generar los horarios según el horario laborable por defecto + fechas exactas diferenciadas
  const huecosDefecto = proyectarHuecosPorDefectoLocal(desde, hasta, modalidad, config);
  const fechasEspecialesSet = new Set(
    (config.fechas_especiales ?? []).map((fe) => fe.fecha),
  );

  // Descontar citas ya ocupadas en cada bloque horario según max_citas_simultaneas
  const mapa = new Map<string, HuecoDisponible>();
  for (const h of huecosDefecto) {
    const iniMs = new Date(h.hueco_inicio).getTime();
    const finMs = new Date(h.hueco_fin).getTime();
    const ocupadas = citasActivas.filter((c) => c.iniMs < finMs && c.finMs > iniMs).length;
    const restantes = Math.max(0, h.disponibles - ocupadas);
    if (restantes > 0) {
      mapa.set(new Date(h.hueco_inicio).toISOString(), {
        hueco_inicio: new Date(h.hueco_inicio).toISOString(),
        hueco_fin: new Date(h.hueco_fin).toISOString(),
        disponibles: restantes,
      });
    }
  }

  // Si el modo es 'hibrido_abogados', sumar disponibilidad de abogados en días que no tengan excepción especial
  if (config.modo_capacidad === "hibrido_abogados") {
    for (const h of huecosRpc) {
      const fechaSlot = new Date(new Date(h.hueco_inicio).getTime() - 5 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      if (fechasEspecialesSet.has(fechaSlot)) continue;

      const clave = new Date(h.hueco_inicio).toISOString();
      const existente = mapa.get(clave);
      if (!existente && h.disponibles > 0) {
        const iniMs = new Date(h.hueco_inicio).getTime();
        const finMs = new Date(h.hueco_fin).getTime();
        const ocupadas = citasActivas.filter((c) => c.iniMs < finMs && c.finMs > iniMs).length;
        const restantes = Math.max(0, h.disponibles - ocupadas);
        if (restantes > 0) {
          mapa.set(clave, {
            hueco_inicio: clave,
            hueco_fin: new Date(h.hueco_fin).toISOString(),
            disponibles: restantes,
          });
        }
      } else if (existente && h.disponibles > existente.disponibles) {
        mapa.set(clave, {
          ...existente,
          disponibles: Math.max(existente.disponibles, h.disponibles),
        });
      }
    }
  }

  return Array.from(mapa.values()).sort(
    (a, b) => new Date(a.hueco_inicio).getTime() - new Date(b.hueco_inicio).getTime(),
  );
}

/** Qué le cubre el plan al usuario en sesión este periodo. */
export async function obtenerCobertura() {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.schema("comun_comercio").rpc("com_fn_cobertura_usuario", {
    p_negocio: NEGOCIO,
  });
  return (data ?? []) as Array<{
    suscripcion_id: string;
    plan_nombre: string;
    concepto: string;
    incluidos: number | null;
    consumidos: number;
    restantes: number | null;
  }>;
}

export async function listarCitasDelCliente(soloFuturas = false): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  let consulta = supabase.schema("tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .is("cit_eliminado_en", null)
    .order("cit_inicio_en", { ascending: false })
    .limit(50);
  if (soloFuturas) consulta = consulta.gte("cit_inicio_en", new Date().toISOString());
  const { data } = await consulta;
  return (data ?? []) as CitaResumen[];
}

/**
 * Agenda del abogado en sesión. RLS ya la acota a lo suyo: aquí no se filtra
 * por abogado, porque hacerlo a mano invitaría a olvidarlo en la siguiente
 * consulta y a creer que el filtro de la aplicación es la protección.
 */
export async function listarAgendaDelAbogado(desde: Date, hasta: Date): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.schema("tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .is("cit_eliminado_en", null)
    .gte("cit_inicio_en", desde.toISOString())
    .lt("cit_inicio_en", hasta.toISOString())
    .neq("cit_estado", "cancelada")
    .order("cit_inicio_en");
  return (data ?? []) as CitaResumen[];
}

/** Configuración de agenda del profesional en sesión, o null si no la ha creado. */
export async function obtenerMiAgenda() {
  const supabase = await crearClienteServidor();
  const { data: prof } = await supabase.schema("comun_agenda")
    .from("age_profesional")
    .select("*")
    .eq("agp_negocio", NEGOCIO)
    .is("agp_eliminado_en", null)
    .maybeSingle();
  if (!prof) return null;

  const { data: franjas } = await supabase.schema("comun_agenda")
    .from("age_franja")
    .select("fra_id, fra_dia_semana, fra_hora_inicio, fra_hora_fin, fra_modalidad")
    .eq("fra_profesional_id", prof.agp_id)
    .is("fra_eliminado_en", null)
    .order("fra_dia_semana")
    .order("fra_hora_inicio");

  const { data: bloqueos } = await supabase.schema("comun_agenda")
    .from("age_bloqueo")
    .select("blq_id, blq_inicio_en, blq_fin_en, blq_motivo, blq_origen")
    .eq("blq_profesional_id", prof.agp_id)
    .is("blq_eliminado_en", null)
    .gte("blq_fin_en", new Date().toISOString())
    .order("blq_inicio_en");

  return { profesional: prof, franjas: franjas ?? [], bloqueos: bloqueos ?? [] };
}

/**
 * Cola de contingencia del operador: citas vivas que se quedaron sin abogado
 * porque el asignado canceló. No es una lista informativa — cada fila es un
 * cliente que llegará a su hora y no encontrará a nadie.
 */
export async function listarCitasEnContingencia(): Promise<CitaResumen[]> {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.schema("tranqui_legal")
    .from("trq_cita")
    .select(
      "cit_id, cit_inicio_en, cit_fin_en, cit_modalidad, cit_estado, cit_motivo, cit_enlace, cit_lugar, cit_cobertura, cit_asignacion, cit_abogado_id",
    )
    .eq("cit_asignacion", "contingencia")
    .is("cit_eliminado_en", null)
    .gte("cit_inicio_en", new Date().toISOString())
    .order("cit_inicio_en");
  return (data ?? []) as CitaResumen[];
}

/**
 * Abogados verificados, para la mesa de reasignación. Solo lo ve el staff: la
 * RLS de trq_abogado ya restringe la lectura a administradores del negocio.
 *
 * Dos consultas en vez de un join anidado: PostgREST no resuelve la relación
 * trq_abogado -> seg_usuario por sí solo (abg_usuario_id no está declarada como
 * FK con nombre que pueda seguir), y forzarla con un alias es más frágil que
 * cruzar dos listas de una docena de filas.
 */
export async function listarAbogadosAsignables() {
  const supabase = await crearClienteServidor();
  const { data: abogados } = await supabase
    .schema("tranqui_legal")
    .from("trq_abogado")
    .select("abg_id, abg_usuario_id")
    .eq("abg_estado", "verificado");
  if (!abogados || abogados.length === 0) return [];

  const { data: usuarios } = await supabase
    .schema("comun_seguridad")
    .from("seg_usuario")
    .select("usu_id, usu_nombres, usu_apellidos")
    .in(
      "usu_id",
      abogados.map((a) => a.abg_usuario_id),
    );

  const porId = new Map((usuarios ?? []).map((u) => [u.usu_id, u]));
  return abogados.map((a) => {
    const u = porId.get(a.abg_usuario_id);
    return {
      abg_id: a.abg_id,
      nombre: [u?.usu_nombres, u?.usu_apellidos].filter(Boolean).join(" ") || "Abogado sin nombre",
    };
  });
}
