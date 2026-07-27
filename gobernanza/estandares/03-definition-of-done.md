---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Definition of Done

Un issue no pasa a `Hecho` en el GitHub Project si falta alguno de estos puntos aplicables.

## Todo cambio

- [ ] CI verde: build, lint, tipos, verificaciones de conformidad de nomenclatura.
- [ ] PR revisado y aprobado (CODEOWNERS si toca `comun_*`, `supabase/migrations/**` o `packages/auth/**`).
- [ ] Sin `service_role` fuera de `supabase/functions/`.
- [ ] `pnpm audit --audit-level=high` en verde; sin dependencias de producción con rango flotante (`^`/`~`). Ver [`politicas/seguridad-dependencias.md`](../politicas/seguridad-dependencias.md).
- [ ] `pnpm test` en verde. Lógica nueva en `packages/*` tiene test unitario — ver criterio de qué probar en [`04-pruebas.md`](04-pruebas.md).

## Si el cambio toca base de datos

- [ ] Migración nueva en `supabase/migrations/`, nunca edición de una migración ya aplicada.
- [ ] Nomenclatura conforme al [estándar](00-nomenclatura-base-datos.md).
- [ ] RLS habilitado en toda tabla nueva.
- [ ] Trigger `aud_fn_auditar_tabla()` asignado en toda tabla de negocio nueva.
- [ ] Tipos regenerados (`packages/db`) y commiteados.
- [ ] Prueba negativa de RLS: al menos un rol que **no** debería poder leer/escribir, verificado que falla.

## Si el cambio expone un flujo crítico (datos sensibles, dinero, identidad)

- [ ] Requiere `aal2` (MFA) en la política RLS correspondiente, no solo en la UI.
- [ ] Datos sensibles cifrados (`pgp_sym_encrypt`) y enmascarados en lectura por defecto.
- [ ] Revisado contra [`politicas/seguridad-y-datos.md`](../politicas/seguridad-y-datos.md).

## Si el cambio agrega o modifica un requerimiento funcional

- [ ] Código de requerimiento (ej. `TRQ-014`) presente en: el issue, la especificación funcional del producto, y el `README.md` del módulo.
- [ ] `especificacion-funcional.md` del producto actualizada en el mismo PR.

## Si el cambio es visible para el usuario final

- [ ] Probado manualmente en al menos un navegador/dispositivo real (no solo en desarrollo local).
- [ ] `manual-usuario.md` del producto actualizado si cambia un flujo existente.

## Si el cambio afecta despliegue o infraestructura

- [ ] `manuales/habilitar-ambiente.md` actualizado si cambia el procedimiento de setup.
- [ ] Verificado que el build selectivo (`turbo-ignore`) no reconstruye apps no afectadas.

## Regla general

Un artefacto de `gobernanza/` desactualizado por un PR ya mergeado es un bug, no un detalle. Se corrige con la misma prioridad que un defecto funcional.
