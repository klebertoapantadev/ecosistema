# Cierre: Corrección de rebote silencioso en registro Google OAuth (`/bienvenida` -> `/panel` -> `/ingresar`)

- **Fecha:** 2026-11-20
- **Requerimientos:** `PLT-001`, `PLT-003`, `TNK-005`
- **Rama:** `master`

## Causa raíz identificada
Al registrarse con una cuenta de Gmail en `tinkay-web.vercel.app`, el usuario completaba `/bienvenida?destino=%2Fpanel` (`completarBienvenida` devolvía `200 OK`), navegaba a `/panel` y `apps/tinkay-web/app/panel/layout.tsx` lo rebotaba silenciosamente a `/ingresar` sin mensaje de error:

1. `asegurarMembresiaCliente()` en `packages/identidad/src/acciones.ts` invocaba `comun_seguridad.seg_fn_asegurar_membresia_cliente` ignorando `{ error }` y sin verificar que realmente quedara una membresía `ACTIVO`.
2. En PostgreSQL (`20261115000001`), `seg_fn_asegurar_membresia_cliente`:
   - Si encontraba una membresía previa no activa (`INACTIVO`/`PENDIENTE`/`SUSPENDIDO`) o con otro casing, el `ELSE` solo actualizaba `mem_actualizado_en` sin reactivar `mem_estado = 'ACTIVO'` ni normalizar `mem_negocio`.
   - Ejecutaba `comun_comercio.com_fn_asegurar_suscripcion_gratuita(...)` sin `BEGIN ... EXCEPTION WHEN OTHERS`, por lo que cualquier error secundario en suscripciones hacía `ROLLBACK` completo del `INSERT INTO seg_membresia`.
3. Tanto `/auth/callback` (`packages/identidad/src/servidor.ts`) como `completarBienvenida` invocaban `seg_fn_sincronizar_acceso_rol_tinkay` con `p_crear_cliente_si_no_existe: false`, perdiendo la red de seguridad `SECURITY DEFINER`.
4. `FormularioBienvenida.tsx` ejecutaba `router.push()` + `router.refresh()` en paralelo, disparando dos renderizados simultáneos de `/panel`.
5. `apps/tinkay-web/app/panel/layout.tsx` redirigía a `/ingresar` sin parámetro `?error=...` y sin auto-reparar cuentas cuyo `registros_negocio.tinkay.onboarding_completo` ya era `true`.

## Cambios realizados
- `packages/identidad/src/acciones.ts`: `asegurarMembresiaCliente` ahora retorna `Resultado`, registra errores, verifica membresía `ACTIVO`, usa fallback `SECURITY DEFINER` (`seg_fn_sincronizar_acceso_rol_tinkay` con `p_crear_cliente_si_no_existe: true`) y fallback directo por RLS/admin; `completarBienvenida` y `registrarUsuario` propagan fallos en lugar de ocultar el error.
- `packages/identidad/src/servidor.ts`: callback OAuth activa `p_crear_cliente_si_no_existe: true` y propaga errores explícitos en `?error=...`.
- `packages/identidad/src/consultas.ts`: `obtenerMembresia` normaliza con `perteneceAlNegocio` (tolerando cualquier casing/espacios) y registra errores de PostgREST.
- `packages/identidad/src/componentes/FormularioBienvenida.tsx`: navegación limpia `window.location.assign(destinoTarget)` sin carrera de doble request.
- `packages/gestion-usuarios/src/acciones.ts` y `apps/tinkay-web/app/panel/acceso-tinkay.ts`: propagación de `tieneMembresia` desde el RPC `SECURITY DEFINER`.
- `apps/tinkay-web/app/panel/layout.tsx`: auto-reparación idempotente cuando `registros_negocio.tinkay.onboarding_completo === true` y redirección explícita con `?error=...` si realmente falta cuenta activa en Tinkay.
- `supabase/migrations/20261120000003_fix_asegurar_membresia_cliente_y_oauth_onboarding.sql`: corrección permanente en `seg_fn_asegurar_membresia_cliente` (reactivación a `ACTIVO`, normalización, verificación de correo OAuth y aislamiento de `com_fn_asegurar_suscripcion_gratuita`) + backfill idempotente para cuentas afectadas.
- `gobernanza/productos/plataforma/especificacion-funcional.md`: actualización de `PLT-001` y matriz de avance (`97%`).
