# Cierre de Tarea — Agendamiento con Clasificación de Especialidad por ARIA y Horarios por Defecto (Telemático / Presencial)

**Fecha:** 2026-11-08  
**Requerimientos:** `TRQ-CLI-001`, `TRQ-ABG-004`, `PLT-020`  
**Rama:** `master`

## Resumen de Cambios
1. **Base de Datos (`supabase/migrations/20261108000001_agenda_horarios_defecto_negocio_y_aria.sql`)**:
   - Tabla `comun_agenda.age_config_negocio` con RLS habilitado y auditoría `aud_fn_auditar_tabla()` para almacenar las franjas horarias por defecto de **consultas telemáticas** (`cgn_franjas_virtual`) y **consultas presenciales** (`cgn_franjas_presencial`), `cgn_permitir_sin_profesional = true` y la especialidad por defecto (`materia_defecto_nombre = 'Civil'`).
   - Funciones RPC `comun_agenda.age_fn_guardar_config_negocio` y `comun_agenda.age_fn_huecos_negocio_defecto`.
   - Actualización de `tranqui_legal.trq_fn_horarios_materia` y `tranqui_legal.trq_fn_reservar_cita` para proyectar horarios de atención por defecto y permitir reservar/confirmar citas pagadas incluso cuando no hay un abogado disponible en ese horario (`cit_abogado_id = null`, `cit_asignacion = 'contingencia'`, `cit_materia_id` clasificada por ARIA).
   - Registro del widget `horarios_atencion_agenda` en `comun_seguridad.seg_widget` y `seg_rol_widget`.
2. **Clasificador Conversacional ARIA (`apps/tranqi-web/modulos/agenda/clasificador-aria.ts` y `/api/agentes/aria-clasificar-consulta`)**:
   - Integración con `@eco/agentes-ia` (`invocarAgente` / `resolverAgenteDesdeEntorno`) + heurística jurídica ecuatoriana determinista y fallback automático a la especialidad por defecto (`Civil`).
3. **Flujo de Agendamiento del Cliente (`apps/tranqi-web/modulos/agenda/componentes/FormularioAgendar.tsx`)**:
   - **Paso 1 (`Tu Caso (ARIA)`)**: Chat guiado con ARIA donde el cliente describe su problema en palabras sencillas y ARIA clasifica la especialidad o asigna la especialidad por defecto.
   - **Paso 2 (`Fecha y Horario`)**: Selección de modalidad (`Consulta Telemática` o `Consulta Presencial`), tipo de atención y fecha/hora agrupada por día calendario.
   - **Paso 3 (`Confirmar y Pagar`)**: Resumen de la cita, integración con `ModalCheckoutPayphone` (`confirmarPagoPayphoneAction` retorna `pagoId`) y confirmación inmediata de la cita pagada.
4. **Configuración Operativa de Horarios (`apps/tranqi-web/modulos/agenda/componentes/ConfiguracionHorariosAtencionWidget.tsx`)**:
   - Widget para operadores y administradores que permite configurar horarios por defecto de consultas telemáticas y presenciales, especialidad por defecto de ARIA y agendamiento sin abogado disponible.
   - Pre-configurado en los 10 puntos de registro (`MATRIZ_FUNCIONAL_ROLES`, `AdministracionPerfilesWidget`, `PanelDinamicoModular`, `ConsolaSuperAdminModular`, `ModalEditarWidget`, `SeccionFavoritosInicio`, `BuscadorModulosGlobal` y `/panel/agenda/asignaciones`).

