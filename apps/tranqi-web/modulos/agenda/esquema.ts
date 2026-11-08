import { z } from "zod";
import { esquemaAgendaCompleta, esquemaFranja } from "@eco/agenda";

// Fuente de verdad de la forma de los datos que entran al módulo (01-convenciones §2).
// Las reglas de agenda propiamente dichas viven en @eco/agenda, que las comparte
// con cualquier negocio; aquí solo se declaran las entradas de las acciones de
// Tranqi.

export const esquemaReserva = z.object({
  materia_id: z.string().uuid("Elige una materia").nullish(),
  inicio_en: z.string().datetime({ offset: true }),
  variante_id: z.string().uuid().nullish(),
  modalidad: z.enum(["virtual", "presencial"]),
  motivo: z.string().trim().min(5, "Cuéntanos en una frase de qué se trata").max(500),
  caso_id: z.string().uuid().nullish(),
  pago_id: z.string().uuid().nullish(),
  confirmar_inmediato: z.boolean().optional(),
});

export const esquemaRangoHoraSimple = z
  .object({
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inicio inválida (HH:MM)"),
    hora_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora fin inválida (HH:MM)"),
  })
  .refine((f) => f.hora_fin > f.hora_inicio, {
    message: "La hora de cierre debe ser posterior a la de apertura",
    path: ["hora_fin"],
  });

export const esquemaFranjaHorarioNegocio = z
  .object({
    dia_semana: z.number().int().min(1).max(7),
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora inicio inválida (HH:MM)"),
    hora_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Hora fin inválida (HH:MM)"),
  })
  .refine((f) => f.hora_fin > f.hora_inicio, {
    message: "La hora de cierre debe ser posterior a la de apertura",
    path: ["hora_fin"],
  });

export const esquemaFechaEspecialAgenda = z.object({
  fecha: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Fecha inválida (YYYY-MM-DD)"),
  nombre: z.string().trim().min(2, "Ingresa una descripción para la fecha (ej. Navidad)").max(120),
  cerrado_total: z.boolean().default(false),
  habilitar_virtual: z.boolean().default(true),
  franjas_virtual: z.array(esquemaRangoHoraSimple).default([]),
  habilitar_presencial: z.boolean().default(false),
  franjas_presencial: z.array(esquemaRangoHoraSimple).default([]),
  max_citas_simultaneas: z.number().int().min(1).max(50).nullish(),
});

export const esquemaConfigNegocioAgenda = z.object({
  zona_horaria: z.string().trim().min(3).default("America/Guayaquil"),
  duracion_cita_min: z.number().int().min(15).max(180).default(45),
  holgura_min: z.number().int().min(0).max(60).default(15),
  antelacion_minima_horas: z.number().int().min(0).max(168).default(2),
  horizonte_dias: z.number().int().min(1).max(180).default(21),
  permitir_sin_profesional: z.boolean().default(true),
  max_citas_simultaneas: z.number().int().min(1).max(50).default(1),
  modo_capacidad: z
    .enum(["fijo_negocio", "hibrido_abogados", "solo_abogados"])
    .default("fijo_negocio"),
  direccion_presencial: z.string().trim().max(300).nullish(),
  materia_defecto_nombre: z.string().trim().min(2).max(100).default("Civil"),
  franjas_virtual: z.array(esquemaFranjaHorarioNegocio).min(1, "Configura al menos una franja telemática"),
  franjas_presencial: z.array(esquemaFranjaHorarioNegocio).min(1, "Configura al menos una franja de oficina"),
  fechas_especiales: z.array(esquemaFechaEspecialAgenda).default([]),
});

export const esquemaDecisionCita = z.object({
  cita_id: z.string().uuid(),
  decision: z.enum(["confirmar", "reagendar", "cancelar", "marcar_realizada", "marcar_no_asistio"]),
  nuevo_inicio: z.string().datetime({ offset: true }).nullish(),
  motivo: z.string().trim().max(500).nullish(),
});

export const esquemaReasignacion = z.object({
  cita_id: z.string().uuid(),
  abogado_destino: z.string().uuid("Elige el abogado que la atenderá"),
  motivo: z.string().trim().max(500).nullish(),
});

export const esquemaBloqueo = z
  .object({
    inicio_en: z.string().datetime({ offset: true }),
    fin_en: z.string().datetime({ offset: true }),
    motivo: z.string().trim().max(300).nullish(),
    es_audiencia: z.boolean().default(false),
  })
  .refine((b) => new Date(b.fin_en) > new Date(b.inicio_en), {
    message: "El bloqueo termina antes de empezar",
    path: ["fin_en"],
  });

export { esquemaAgendaCompleta, esquemaFranja };

export type DatosReserva = z.infer<typeof esquemaReserva>;
export type DatosDecisionCita = z.infer<typeof esquemaDecisionCita>;
export type DatosReasignacion = z.infer<typeof esquemaReasignacion>;
export type DatosBloqueo = z.infer<typeof esquemaBloqueo>;
export type RangoHoraSimple = z.infer<typeof esquemaRangoHoraSimple>;
export type FranjaHorarioNegocio = z.infer<typeof esquemaFranjaHorarioNegocio>;
export type FechaEspecialAgenda = z.infer<typeof esquemaFechaEspecialAgenda>;
export type DatosConfigNegocioAgenda = z.infer<typeof esquemaConfigNegocioAgenda>;

/** Cómo se le explica al usuario de dónde sale el precio de su cita. */
export const ETIQUETA_COBERTURA: Record<string, string> = {
  pendiente: "Pendiente de pago",
  plan: "Incluida en tu plan",
  cupon: "Cubierta por un cupón",
  pagada: "Pagada",
  cortesia: "Sin costo",
};

export const ETIQUETA_ESTADO_CITA: Record<string, string> = {
  propuesta: "Por confirmar",
  confirmada: "Confirmada",
  reagendada: "Reagendada",
  cancelada: "Cancelada",
  realizada: "Realizada",
};
