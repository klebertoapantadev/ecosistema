# Módulo: Gestión de Usuarios (widget)

Implementa el widget obligatorio de `PLT-011` (buscar entre usuarios registrados en Tranqi y asignarles rol). Visible por defecto para el rol `ADMINISTRADOR` — seed aplicado en `20260727000002_comun_seguridad.sql`.

## Alcance actual

- Solo ve/gestiona usuarios que **ya tienen membresía en Tranqi** (registrados vía `/registro`), no todo el ecosistema — coherente con PLT-003 regla 2 (aislamiento de roles por negocio).
- Asignar rol es un RPC transaccional (`seg_fn_asignar_rol`), no un `UPDATE` directo — ver [`acciones.ts`](acciones.ts) y la regla 5 de `AGENTS.md`.

## Pendiente

- Búsqueda vía formulario GET (`?q=`), sin paginación (límite fijo de 50 resultados) — suficiente para el volumen actual, revisar si crece.
- Suspender/reactivar membresía (`mem_estado`) — no implementado en esta pasada, solo cambio de rol.
