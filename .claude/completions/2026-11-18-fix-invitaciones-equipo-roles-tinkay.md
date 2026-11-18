# Cierre de Tarea — Invitaciones de Equipo y Sincronización Transaccional de Roles en Tinkay

**Fecha:** 2026-11-18
**Requerimientos:** `PLT-003` / `PLT-011` / `TNK-005`

## Diagnóstico de Causa Raíz
1. En Vercel (`tinkay-web`), `service_role` no está expuesto (`crearClienteAdmin() === null` conforme a Regla 3 de `AGENTS.md`).
2. `tinkay.uio@gmail.com` tenía `usu_superadmin_plataforma = false` y solo el perfil `CLIENTE` en `seg_membresia_perfil`, por lo que `seg_fn_es_admin_negocio('tinkay')` devolvía `false` en PostgreSQL:
   - Al quitar la invitación anterior (`nancy...`) o enviar la nueva (`familiammtg@gmail.com`), `.from("cfg_negocio").update(...)` actualizaba **0 filas** por RLS sin reportar error, modificando únicamente el estado en memoria de React; al recargar la página, desaparecía `familiammtg@gmail.com` y reaparecía `nancy`.
   - `buscarUsuarios` solo podía ver la fila propia de `tinkay.uio@gmail.com` (`Usuarios Registrados en Tinkay (1)`).
3. Al registrarse o ingresar el usuario invitado, `sincronizarAccesoRolTinkayAction()` intentaba escribir directamente sobre `seg_membresia`, `seg_membresia_perfil` (sin `GRANT INSERT/UPDATE` para `authenticated`) y `cfg_negocio` (restringido a admin por RLS) con la sesión del invitado, fallando silenciosamente y dejándolo en rol `CLIENTE` con la invitación sin actualizar.

## Solución Implementada
- **Migración SQL idempotente:** `supabase/migrations/20261118000001_fix_invitaciones_equipo_y_sincronizacion_roles_tinkay.sql`
  - Repara membresía/perfiles de propietarios de Tinkay (`tinkay.uio@gmail.com`, `kleber.toapanta.ch@gmail.com`) y actualiza `seg_fn_es_admin_negocio`, `seg_fn_es_superadmin_negocio`, `seg_fn_nivel_maximo` y `seg_fn_obtener_rol_operativo_negocio`.
  - Crea RPCs transaccionales `SECURITY DEFINER`: `seg_fn_invitar_miembro_equipo`, `seg_fn_eliminar_invitacion_equipo`, `seg_fn_sincronizar_acceso_rol_tinkay`, `seg_fn_asignar_perfil_negocio`, `seg_fn_quitar_perfil_negocio` y `seg_fn_listar_usuarios_negocio`.
  - Regulariza de inmediato a `familiammtg@gmail.com` con el rol `VENTAS` (`ACEPTADA`) en Tinkay.
- **Paquetes y App (`@eco/gestion-usuarios`, `@eco/identidad`, `tinkay-web`):**
  - Eliminación de supresión silenciosa de errores (verificación de filas afectadas + uso primario de RPCs).
  - Reclamo automático de invitación en `registrarUsuario`, `iniciarSesion`, `completarBienvenida`, callback OAuth y `obtenerContextoAccesoTinkay` (secuencial sin condición de carrera).
  - Pre-llenado de correo y nombre en `/registro?correo=...&nombre=...`.
