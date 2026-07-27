# Ecosistema — Instrucciones para agentes de IA

Este archivo es la fuente de contexto para **cualquier agente de codificación** que trabaje en este repositorio — Claude Code, GitHub Copilot, Antigravity, Cursor, Windsurf u otro. Sigue el estándar abierto [AGENTS.md](https://agents.md).

Monorepo (Turborepo + pnpm) para 8 aplicaciones sobre 4 negocios (Tranqi, FastFix Home, Tinkay, Margaritas Floristería) que comparten una única instancia Supabase multi-esquema.

## Antes de escribir código, lee

- [`gobernanza/arquitectura/marco-de-trabajo.md`](gobernanza/arquitectura/marco-de-trabajo.md) — contrato de capas, qué se comparte y qué no.
- [`gobernanza/estandares/00-nomenclatura-base-datos.md`](gobernanza/estandares/00-nomenclatura-base-datos.md) — obligatorio para cualquier tabla o columna nueva.
- [`gobernanza/estandares/01-convenciones-codificacion.md`](gobernanza/estandares/01-convenciones-codificacion.md) — estructura de módulo, capas, manejo de errores.
- [`gobernanza/politicas/seguridad-y-datos.md`](gobernanza/politicas/seguridad-y-datos.md) — RLS, MFA, cifrado. No opcional.
- [`gobernanza/productos/plataforma/especificacion-funcional.md`](gobernanza/productos/plataforma/especificacion-funcional.md) — identidad, MFA, roles, chat ARIA, auditoría, facturación. Antes de tocar cualquiera de estos temas en un producto, verificar si ya está resuelto aquí (código `PLT-xxx`).

## Reglas que no se negocian

1. **RLS habilitado en el 100% de las tablas nuevas.** Sin excepción temporal.
2. **`aud_fn_auditar_tabla()` en toda tabla de negocio nueva.**
3. **`service_role` nunca sale de `supabase/functions/`.** Nunca en `NEXT_PUBLIC_*`, nunca en una app nativa.
4. **`packages/primitivas` y `packages/core` no importan nada de `next/*`.** Se usan en apps nativas Capacitor.
5. **Transiciones de estado sensibles (aprobar, rechazar, pagar) son RPC transaccional, no `UPDATE` directo desde el cliente.**
6. **Rol ≠ capacidad.** Un rol en `seg_membresia` no habilita acceso si el proceso de negocio exige un estado adicional (ej. verificación aprobada). Verificar el estado real en la política RLS.
7. **Nomenclatura de base de datos**: prefijo de tabla de 3 letras, prefijo de columna por entidad, PK `uuid`, secuencial legible, columna JSONB `_detalle_*`. Ver el estándar antes de crear cualquier tabla.
8. **Si un PR cambia el comportamiento descrito en un artefacto de `gobernanza/`, el PR actualiza ese artefacto.**
9. **Todo chat o agente conversacional de producto usa `packages/agentes-ia`.** Ninguna app reimplementa su propio proxy hacia ARIA. Ver [ADR-0002](gobernanza/arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).
10. **Ninguna dependencia de producción usa rangos flotantes (`^`, `~`).** Versión exacta fijada; las actualizaciones llegan vía Dependabot. Ver [`politicas/seguridad-dependencias.md`](gobernanza/politicas/seguridad-dependencias.md).
11. **Ningún producto tiene su propia tabla de catálogo de productos.** Todo lo que se vende (físico, servicio, suscripción, digital) vive en `comun_comercio`. Ver [ADR-0003](gobernanza/arquitectura/adr/0003-catalogo-comercial-unificado.md).
12. **El ecosistema vive en su propio proyecto Supabase dedicado (`ecosistema`, ver [`inventario-supabase.md`](gobernanza/arquitectura/inventario-supabase.md)).** Nunca se reutiliza o comparte instancia con una base de datos operativa ajena a este monorepo — si alguna vez se conecta un proyecto Supabase distinto al listado en ese inventario, confirmar con el usuario antes de crear o modificar cualquier esquema.
13. **Toda tabla donde el usuario edita su propia fila revoca `UPDATE` de tabla completa y otorga `GRANT UPDATE` solo por columna.** RLS filtra filas, no columnas — sin esto, un `PATCH` directo puede escribir campos privilegiados (`*_superadmin_*`, `*_rol`) aunque la UI nunca lo permita. Ver [`politicas/seguridad-y-datos.md`](gobernanza/politicas/seguridad-y-datos.md) §9 (encontrado y corregido en `seg_usuario`, 2026-07-27).

## Comandos del proyecto

```bash
pnpm install        # instalar dependencias del monorepo
pnpm dev             # levantar todas las apps en paralelo
pnpm --filter {app} dev   # levantar una app específica
pnpm lint
pnpm typecheck
pnpm build           # Turborepo construye solo lo afectado por el cambio
supabase start       # Supabase local (requiere Supabase CLI)
supabase db reset    # aplica todas las migraciones desde cero
```

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
| `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo`, `comun_agentes`, `comun_comercio` | Plataforma | `seg_`, `aud_`, `fac_`, `cat_`, `agc_`, `com_` |
| `tranqui_legal` | Tranqi | `trq_` |
| `fastfix_mantenimiento` | FastFix Home | `ffh_` |
| `tinkay_floristeria` | Tinkay | `tnk_` |
| `margaritas_floristeria` | Margaritas Floristería | `mrg_` |

## Qué hacer si una instrucción del usuario contradice este archivo

Señalarlo explícitamente antes de proceder, citando la regla de `gobernanza/` en conflicto. No asumir que la instrucción puntual deroga el estándar — el estándar cambia por PR a `gobernanza/`, no por una instrucción de chat.

## Estado actual

Sprint 0 en curso. En `tranqi-web` ya funcionan de punta a punta: registro (Google OAuth + correo/contraseña), pantalla de bienvenida (PLT-001 regla 2), configuración del negocio (PLT-008/011) y gestión de usuarios/roles (el widget, PLT-011). Pendiente del Entregable 1: solicitud de socios abogados. Ver [`gobernanza/productos/tranqi/`](gobernanza/productos/tranqi/).
