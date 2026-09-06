import { describe, expect, it } from "vitest";
import {
  aMinutos,
  describirAgenda,
  esquemaAgendaCompleta,
  esquemaFranja,
  haySolapeEntreFranjas,
  huecosPorSemana,
  salaAbierta,
  trocearFranja,
} from "./dominio";

const config = {
  zona_horaria: "America/Guayaquil",
  duracion_cita_min: 45,
  holgura_min: 15,
  antelacion_minima_horas: 24,
  horizonte_dias: 60,
  modalidades: ["virtual" as const],
  acepta_turno: true,
  direccion: null,
};

describe("trocearFranja", () => {
  it("reproduce el troceado del RPC: 09:00-13:00, 45 min, holgura 15", () => {
    // El mismo caso que verifica la migración: 09:00, 10:00, 11:00, 12:00.
    // A las 13:00 no cabe otra de 45 min, así que no se ofrece.
    const huecos = trocearFranja(aMinutos("09:00"), aMinutos("13:00"), 45, 15);
    expect(huecos.map((h) => h.inicioMin)).toEqual([
      aMinutos("09:00"),
      aMinutos("10:00"),
      aMinutos("11:00"),
      aMinutos("12:00"),
    ]);
  });

  it("no ofrece un hueco que se sale de la franja", () => {
    // 09:00-09:30 con citas de 45 min no da ni una: media cita no es una cita.
    expect(trocearFranja(aMinutos("09:00"), aMinutos("09:30"), 45, 15)).toEqual([]);
  });

  it("sin holgura los huecos van pegados", () => {
    const huecos = trocearFranja(aMinutos("09:00"), aMinutos("11:00"), 60, 0);
    expect(huecos).toHaveLength(2);
    expect(huecos[1]?.inicioMin).toBe(huecos[0]?.finMin);
  });
});

describe("haySolapeEntreFranjas", () => {
  it("detecta dos franjas del mismo día que se pisan", () => {
    expect(
      haySolapeEntreFranjas([
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 2, hora_inicio: "12:00", hora_fin: "16:00", modalidad: "ambas" },
      ]),
    ).toBe(true);
  });

  it("no confunde el mismo horario en días distintos", () => {
    expect(
      haySolapeEntreFranjas([
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 3, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
      ]),
    ).toBe(false);
  });

  it("dos franjas contiguas no se pisan", () => {
    expect(
      haySolapeEntreFranjas([
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 2, hora_inicio: "13:00", hora_fin: "17:00", modalidad: "ambas" },
      ]),
    ).toBe(false);
  });
});

describe("esquemaFranja", () => {
  it("rechaza una franja que termina antes de empezar", () => {
    const r = esquemaFranja.safeParse({ dia_semana: 1, hora_inicio: "18:00", hora_fin: "09:00" });
    expect(r.success).toBe(false);
  });

  it("acepta HH:MM y HH:MM:SS", () => {
    expect(esquemaFranja.safeParse({ dia_semana: 1, hora_inicio: "09:00", hora_fin: "13:00" }).success).toBe(true);
    expect(esquemaFranja.safeParse({ dia_semana: 1, hora_inicio: "09:00:00", hora_fin: "13:00:00" }).success).toBe(true);
  });

  it("rechaza una hora inexistente", () => {
    expect(esquemaFranja.safeParse({ dia_semana: 1, hora_inicio: "25:00", hora_fin: "26:00" }).success).toBe(false);
  });
});

describe("esquemaAgendaCompleta", () => {
  it("rechaza una franja más corta que una cita", () => {
    const r = esquemaAgendaCompleta.safeParse({
      configuracion: config,
      franjas: [{ dia_semana: 2, hora_inicio: "09:00", hora_fin: "09:30", modalidad: "ambas" }],
    });
    expect(r.success).toBe(false);
  });

  it("rechaza franjas solapadas", () => {
    const r = esquemaAgendaCompleta.safeParse({
      configuracion: config,
      franjas: [
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 2, hora_inicio: "10:00", hora_fin: "14:00", modalidad: "ambas" },
      ],
    });
    expect(r.success).toBe(false);
  });

  it("acepta una agenda razonable", () => {
    const r = esquemaAgendaCompleta.safeParse({
      configuracion: config,
      franjas: [
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 4, hora_inicio: "14:00", hora_fin: "18:00", modalidad: "virtual" },
      ],
    });
    expect(r.success).toBe(true);
  });
});

describe("huecosPorSemana", () => {
  it("suma los huecos de todas las franjas", () => {
    expect(
      huecosPorSemana({
        configuracion: config,
        franjas: [
          { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
          { dia_semana: 4, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        ],
      }),
    ).toBe(8);
  });
});

describe("describirAgenda", () => {
  it("agrupa por día para que el asistente lo lea en voz alta", () => {
    const texto = describirAgenda({
      configuracion: config,
      franjas: [
        { dia_semana: 2, hora_inicio: "09:00", hora_fin: "13:00", modalidad: "ambas" },
        { dia_semana: 2, hora_inicio: "15:00", hora_fin: "18:00", modalidad: "ambas" },
      ],
    });
    expect(texto).toContain("martes 09:00–13:00 y 15:00–18:00");
    expect(texto).toContain("45 min");
  });
});

describe("salaAbierta", () => {
  const inicio = new Date("2026-09-08T15:00:00Z");
  const fin = new Date("2026-09-08T15:45:00Z");

  it("cerrada mucho antes", () => {
    expect(salaAbierta(inicio, fin, new Date("2026-09-08T14:00:00Z"))).toBe(false);
  });

  it("abierta 10 minutos antes", () => {
    expect(salaAbierta(inicio, fin, new Date("2026-09-08T14:51:00Z"))).toBe(true);
  });

  it("abierta durante la cita", () => {
    expect(salaAbierta(inicio, fin, new Date("2026-09-08T15:20:00Z"))).toBe(true);
  });

  it("cerrada pasada la ventana de cortesía", () => {
    expect(salaAbierta(inicio, fin, new Date("2026-09-08T16:20:00Z"))).toBe(false);
  });
});
