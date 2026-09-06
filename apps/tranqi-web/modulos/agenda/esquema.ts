import { z } from "zod";
import { esquemaAgendaCompleta, esquemaFranja } from "@eco/agenda";

// Fuente de verdad de la forma de los datos que entran al módulo (01-convenciones §2).
// Las reglas de agenda propiamente dichas viven en @eco/agenda, que las comparte
// con cualquier negocio; aquí solo se declaran las entradas de las acciones de
// Tranqi.

export const esquemaReserva = z.object({
  materia_id: z.string().uuid("Elige una materia"),
  inicio_en: z.string().datetime({ offset: true }),
  variante_id: z.string().uuid().nullish(),
  modalidad: z.enum(["virtual", "presencial"]),
  motivo: z.string().trim().min(5, "Cuéntanos en una frase de qué se trata").max(500),
  caso_id: z.string().uuid().nullish(),
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
