/**
 * Dominio de agenda (PLT-020): reglas de disponibilidad que no dependen de
 * Next, de Supabase ni de ninguna app.
 *
 * La autoridad sobre los huecos es el RPC `comun_agenda.age_fn_huecos_disponibles`:
 * ahí se calcula contra los datos reales y bajo RLS. Lo de aquí sirve para tres
 * cosas distintas de esa:
 *
 *   - validar la forma de lo que entra y sale (Zod), antes de tocar la base;
 *   - previsualizar franjas en el editor de disponibilidad sin ir al servidor
 *     en cada tecla;
 *   - poder probar la aritmética de troceado sin levantar Postgres.
 *
 * Cuando las dos implementaciones discrepen, manda el RPC. Este módulo no debe
 * usarse jamás para decidir si un hueco está libre: eso depende de reservas y
 * bloqueos ajenos que el navegador no puede ni debe leer.
 */

import { z } from "zod";

/** 0 = domingo, como `extract(dow)` de Postgres y `Date#getDay()`. */
export const DIAS_SEMANA = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"] as const;

export const esquemaModalidad = z.enum(["virtual", "presencial"]);
export const esquemaModalidadFranja = z.enum(["virtual", "presencial", "ambas"]);

export const esquemaFranja = z
  .object({
    dia_semana: z.number().int().min(0).max(6),
    // Hora local del despacho, no un instante. "HH:MM" o "HH:MM:SS".
    hora_inicio: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Usa el formato HH:MM"),
    hora_fin: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/, "Usa el formato HH:MM"),
    modalidad: esquemaModalidadFranja.default("ambas"),
  })
  .refine((f) => aMinutos(f.hora_fin) > aMinutos(f.hora_inicio), {
    message: "La franja termina antes de empezar",
    path: ["hora_fin"],
  });

export const esquemaConfiguracionAgenda = z.object({
  // IANA, no un offset fijo: el "-05:00" escrito a mano deja Galápagos fuera.
  zona_horaria: z.string().min(3).default("America/Guayaquil"),
  duracion_cita_min: z.number().int().min(15).max(240).default(45),
  holgura_min: z.number().int().min(0).max(120).default(15),
  antelacion_minima_horas: z.number().int().min(0).max(720).default(24),
  horizonte_dias: z.number().int().min(1).max(365).default(60),
  modalidades: z.array(esquemaModalidad).min(1).default(["virtual", "presencial"]),
  acepta_turno: z.boolean().default(true),
  direccion: z.string().max(300).nullish(),
});

export const esquemaAgendaCompleta = z
  .object({
    configuracion: esquemaConfiguracionAgenda,
    franjas: z.array(esquemaFranja).max(60),
  })
  .refine(({ franjas }) => !haySolapeEntreFranjas(franjas), {
    message: "Hay franjas del mismo día que se pisan entre sí",
    path: ["franjas"],
  })
  .refine(
    ({ configuracion, franjas }) =>
      franjas.every((f) => aMinutos(f.hora_fin) - aMinutos(f.hora_inicio) >= configuracion.duracion_cita_min),
    {
      // Una franja más corta que una cita no produce ni un hueco. Es un error
      // silencioso caro: el profesional cree que abrió disponibilidad y nadie
      // le ve horarios.
      message: "Alguna franja es más corta que la duración de una cita",
      path: ["franjas"],
    },
  );

export type Franja = z.infer<typeof esquemaFranja>;
export type ConfiguracionAgenda = z.infer<typeof esquemaConfiguracionAgenda>;
export type AgendaCompleta = z.infer<typeof esquemaAgendaCompleta>;
export type Modalidad = z.infer<typeof esquemaModalidad>;

export interface Hueco {
  inicio: Date;
  fin: Date;
}

/** "09:30" o "09:30:00" -> 570. */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":");
  return Number(h) * 60 + Number(m);
}

export function deMinutos(minutos: number): string {
  const h = Math.floor(minutos / 60);
  const m = minutos % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function haySolapeEntreFranjas(franjas: Franja[]): boolean {
  for (let i = 0; i < franjas.length; i += 1) {
    for (let j = i + 1; j < franjas.length; j += 1) {
      const a = franjas[i];
      const b = franjas[j];
      if (!a || !b || a.dia_semana !== b.dia_semana) continue;
      if (aMinutos(a.hora_inicio) < aMinutos(b.hora_fin) && aMinutos(b.hora_inicio) < aMinutos(a.hora_fin)) {
        return true;
      }
    }
  }
  return false;
}

/**
 * Trocea una franja en huecos, con la misma aritmética que el RPC: cada hueco
 * dura `duracionMin` y el siguiente empieza `duracionMin + holguraMin` después.
 * El último hueco tiene que caber entero dentro de la franja.
 */
export function trocearFranja(
  inicioMin: number,
  finMin: number,
  duracionMin: number,
  holguraMin: number,
): Array<{ inicioMin: number; finMin: number }> {
  const salida: Array<{ inicioMin: number; finMin: number }> = [];
  const paso = duracionMin + holguraMin;
  if (paso <= 0) return salida;
  for (let t = inicioMin; t + duracionMin <= finMin; t += paso) {
    salida.push({ inicioMin: t, finMin: t + duracionMin });
  }
  return salida;
}

/**
 * Cuántos huecos ofrece una semana con esta configuración. Es el número que se
 * le enseña al profesional mientras edita ("tu agenda ofrece 24 citas por
 * semana"), para que vea el efecto de subir la holgura o acortar una franja
 * antes de guardar.
 */
export function huecosPorSemana(agenda: AgendaCompleta): number {
  const { duracion_cita_min: dur, holgura_min: hol } = agenda.configuracion;
  return agenda.franjas.reduce(
    (total, f) => total + trocearFranja(aMinutos(f.hora_inicio), aMinutos(f.hora_fin), dur, hol).length,
    0,
  );
}

/** Resumen legible de una agenda, para que el asistente lo repita antes de guardar. */
export function describirAgenda(agenda: AgendaCompleta): string {
  if (agenda.franjas.length === 0) return "Sin días de atención configurados.";
  const porDia = new Map<number, string[]>();
  for (const f of [...agenda.franjas].sort(
    (a, b) => a.dia_semana - b.dia_semana || aMinutos(a.hora_inicio) - aMinutos(b.hora_inicio),
  )) {
    const lista = porDia.get(f.dia_semana) ?? [];
    lista.push(`${f.hora_inicio.slice(0, 5)}–${f.hora_fin.slice(0, 5)}`);
    porDia.set(f.dia_semana, lista);
  }
  const dias = [...porDia.entries()].map(([dia, horas]) => `${DIAS_SEMANA[dia]} ${horas.join(" y ")}`);
  const c = agenda.configuracion;
  return [
    dias.join("; "),
    `citas de ${c.duracion_cita_min} min con ${c.holgura_min} min entre una y otra`,
    `se reserva con ${c.antelacion_minima_horas} h de antelación`,
    `modalidad: ${c.modalidades.join(" y ")}`,
  ].join(". ");
}

/**
 * La ventana en la que el enlace de la sala está disponible: desde 10 minutos
 * antes hasta 30 después del final. Fuera de ella no se entrega la URL, ni
 * siquiera a las partes — un enlace de Meet que vive para siempre en el correo
 * es una sala abierta para siempre.
 */
export const MINUTOS_ANTES_SALA = 10;
export const MINUTOS_DESPUES_SALA = 30;

export function salaAbierta(inicio: Date, fin: Date, ahora: Date = new Date()): boolean {
  return (
    ahora.getTime() >= inicio.getTime() - MINUTOS_ANTES_SALA * 60_000 &&
    ahora.getTime() <= fin.getTime() + MINUTOS_DESPUES_SALA * 60_000
  );
}
