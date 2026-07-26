# Ecosistema — Contexto para Claude Code

Monorepo (Turborepo + pnpm) para 6 aplicaciones sobre 3 negocios (Tranqi, FastFix Home, Tinkay) que comparten una única instancia Supabase multi-esquema.

## Antes de escribir código, lee

- [`gobernanza/arquitectura/marco-de-trabajo.md`](gobernanza/arquitectura/marco-de-trabajo.md) — contrato de capas, qué se comparte y qué no.
- [`gobernanza/estandares/00-nomenclatura-base-datos.md`](gobernanza/estandares/00-nomenclatura-base-datos.md) — obligatorio para cualquier tabla o columna nueva.
- [`gobernanza/estandares/01-convenciones-codificacion.md`](gobernanza/estandares/01-convenciones-codificacion.md) — estructura de módulo, capas, manejo de errores.
- [`gobernanza/politicas/seguridad-y-datos.md`](gobernanza/politicas/seguridad-y-datos.md) — RLS, MFA, cifrado. No opcional.

## Reglas que no se negocian

1. **RLS habilitado en el 100% de las tablas nuevas.** Sin excepción temporal.
2. **`aud_fn_auditar_tabla()` en toda tabla de negocio nueva.**
3. **`service_role` nunca sale de `supabase/functions/`.** Nunca en `NEXT_PUBLIC_*`, nunca en una app nativa.
4. **`packages/primitivas` y `packages/core` no importan nada de `next/*`.** Se usan en apps nativas Capacitor.
5. **Transiciones de estado sensibles (aprobar, rechazar, pagar) son RPC transaccional, no `UPDATE` directo desde el cliente.**
6. **Rol ≠ capacidad.** Un rol en `seg_membresia` no habilita acceso si el proceso de negocio exige un estado adicional (ej. verificación aprobada). Verificar el estado real en la política RLS.
7. **Nomenclatura de base de datos**: prefijo de tabla de 3 letras, prefijo de columna por entidad, PK `uuid`, secuencial legible, columna JSONB `_detalle_*`. Ver el estándar antes de crear cualquier tabla.
8. **Si un PR cambia el comportamiento descrito en un artefacto de `gobernanza/`, el PR actualiza ese artefacto.**

## Estructura

```
apps/           Una carpeta por aplicación (web y nativa)
packages/       Código compartido — ver regla de qué se comparte en marco-de-trabajo.md
supabase/       Migraciones únicas, Edge Functions, seed
gobernanza/     Estándares, arquitectura, políticas, manuales, especificaciones por producto
```

## Esquemas de base de datos vigentes

| Esquema | Propietario | Prefijo de tabla |
| :--- | :--- | :--- |
| `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo` | Plataforma | `seg_`, `aud_`, `fac_`, `cat_` |
| `tranqui_legal` | Tranqi | `trq_` |
| `fastfix_mantenimiento` | FastFix Home | `ffh_` |
| `tinkay_floristeria` | Tinkay | `tnk_` |

## Estado actual

Sprint 0 (Entregable 1 — Tranqi: identidad de usuario y solicitud de socios abogados). Ver [`gobernanza/productos/tranqi/`](gobernanza/productos/tranqi/) para la especificación en progreso.
