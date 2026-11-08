# Cierre de Tarea — Disponibilidad de Abogados, Horarios por Defecto (Telemático y Oficina), Fechas Exactas y Cupo por Hora

- **Fecha:** 2026-11-08
- **Requerimientos actualizados:** `PLT-020`, `TRQ-CLI-001`, `TRQ-ABG-004`
- **Resumen de cambios:**
  1. **Unificación del widget `disponibilidad_abogados` con el motor real de agendamiento (`ConfiguracionHorariosAtencionWidget`):** Al abrir `/panel/agendamiento?widget=disponibilidad_abogados` o `/panel/agendamiento?widget=horarios_atencion_agenda`, se presenta el gestor real conectado con `comun_agenda.age_config_negocio` y `tranqui_legal.trq_cita`.
  2. **Horario laborable normal por defecto (editable) separado por modalidad:**
     - **Consultas Telemáticas (Videollamada)**: editable por día de semana (`cgn_franjas_virtual`).
     - **Consultas en Oficina (Presencial)**: editable por día de semana y con dirección de oficina (`cgn_franjas_presencial`).
  3. **Horarios diferenciados por Fechas Exactas (`cgn_fechas_especiales`):**
     - Permite definir fechas exactas (`YYYY-MM-DD`, ej. `2026-12-25` Navidad) con horario propio por modalidad (ej. solo teleconsultas de `08:00` a `16:00` y oficina cerrada) o cierre total por feriado.
  4. **Parámetro de número máximo de citas en la misma fecha/hora (`cgn_max_citas_simultaneas`, por defecto `1`):**
     - Descuenta en tiempo real las citas activas en esa fecha/hora y bloquea reservas adicionales cuando se alcanza el cupo configurado.
  5. **Modos evolutivos de capacidad (`modo_capacidad`):**
     - *1. Horario Base Tranqi (`fijo_negocio`)*, *2. Híbrido Inteligente (`hibrido_abogados`)* y *3. Exclusivo Socios Abogados (`solo_abogados`)*.
