# Módulo de agenda

Cubre **TRQ-ABG-004** (agenda profesional y videoconsulta) y la parte de agendamiento de
**TRQ-CLI-001** (consultas telemáticas), sobre el motor transversal de **PLT-020**.

## Qué es de aquí y qué no

El motor vive en `comun_agenda` y en `packages/agenda`, no aquí: el mismo widget «Citas
Programadas» lo comparten el abogado de Tranqi y el técnico de FastFix (`PLT-011` regla 8). Este
módulo es la **cara de Tranqi** de ese motor: las pantallas, su estilo y las acciones que llaman a
los RPC.

- `packages/agenda` — reglas de disponibilidad sin apariencia: Zod, troceado de franjas, ventana de
  la sala. Se comparte.
- `apps/tranqi-web/modulos/agenda` — este módulo: pantallas con el violeta del cliente y el verde
  del abogado. No se comparte (`marco-de-trabajo.md` §2).

## Decisiones locales

**El afiliado no elige abogado.** La asignación es por turno rotativo entre los profesionales de la
materia (`catalogo-productos.md` §6.1). Por eso `buscar_horarios` devuelve horas agregadas, sin
decir de quién son: enseñar el nombre antes de reservar convertiría el reparto en una elección.

**Ninguna pantalla escribe directamente en las tablas.** Todo pasa por RPC transaccional, porque
reservar implica resolver turno, cobertura y solape a la vez. Partirlo en escrituras sueltas deja
estados imposibles a la primera concurrencia.

**El cálculo de huecos del navegador no decide nada.** `huecosPorSemana` sirve para que el abogado
vea el efecto de subir la holgura mientras edita. Quién está libre lo dice el RPC, que es el único
que puede leer reservas ajenas.

**Cancelar no es simétrico.** Si cancela el cliente, la cita se cancela. Si cancela el abogado, la
cita del cliente **sigue viva** y pasa a la mesa de contingencia del operador
(`/panel/agenda/asignaciones`). Trasladarle el problema al afiliado sería lo cómodo para la
plataforma y lo peor para él — pero solo funciona si alguien mira esa pantalla.

**El enlace de la sala solo existe dentro de su ventana** (10 min antes, 30 después). Un enlace de
videollamada que vive para siempre en el correo es una sala abierta para siempre.

## Deuda abierta

- `puente-tipos.ts` existe porque `packages/db` todavía no tipa `comun_agenda` ni `comun_comercio`.
  Ese fichero explica cómo se retira.
- La sala de Google Meet no se genera todavía: falta la Edge Function que llama a Google Calendar.
  `cit_google_evento_id` y `cit_enlace` ya están listos para recibirla.
- Los recordatorios de cita necesitan un despachador de tareas programadas que el ecosistema no
  tiene (ver la nota de `PLT-013`).
