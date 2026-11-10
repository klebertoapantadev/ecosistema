# Completado: Integración Automática de Salas de Videollamada con Daily.co (`tranqi.daily.co`)

**Fecha:** 2026-11-10
**Requerimiento:** `TRQ-ABG-004` / `TRQ-CLI-001` — Agendamiento y Consultas Telemáticas

## Resumen de Implementación

1. **Servicio de Videollamadas Daily.co (`apps/tranqi-web/modulos/agenda/daily-video.ts`)**:
   - Integración con la API REST de Daily.co (`https://api.daily.co/v1/rooms`) sobre el dominio corporativo `tranqi.daily.co`.
   - Generación estandarizada de salas con fecha y hora de Ecuador en la URL (`https://tranqi.daily.co/cita-trq-[id]-[ddmes]-[hhmm]`), interfaz en español (`lang: "es"`), chat interno, uso compartido de pantalla y pre-join UI.
   - Rotación e invalidación automática: cuando cambia el horario de la cita o se solicita un nuevo enlace, la sala del horario anterior se elimina en Daily.co (`DELETE /v1/rooms/:name`) y se aprovisiona la nueva sala con expiración (`exp`) sincronizada al nuevo horario.
   - Expiración/eliminación automática de la sala cuando una cita es cancelada.

2. **Automatización en el Flujo de Citas (`acciones.ts` y `consultas.ts`)**:
   - **Reserva y Confirmación**: Aprovisionamiento automático de sala en Daily.co al agendar, asignar abogado o confirmar cita telemática, incluyendo el link oficial en el correo y en el archivo `.ics`.
   - **Cambio de Hora (`reagendar` / `reagendar_y_aceptar`)**: Al reprogramar la cita, se actualiza/recrea automáticamente la sala en Daily.co para el nuevo horario, se registra en el Tracking y se envía actualización `.ics` a cliente, abogado y agenda institucional.
   - **Autoprovisión en Lectura**: Si una cita telemática activa carece de un enlace válido de videollamada (ej. enlace vacío o buzón de correo de prueba), se autoprovisiona su sala en Daily.co y se persiste en `tranqui_legal.trq_cita`.

3. **Panel del Abogado (`BandejaCitasAbogado.tsx`) y Cliente (`ListaCitasCliente.tsx`)**:
   - Insignia `Daily.co Automático` para enlaces de `tranqi.daily.co`.
   - Botón de 1 clic `Sala Daily.co` / `Nuevo Daily.co` para generar o regenerar el enlace de videollamada e informar al cliente automáticamente.
