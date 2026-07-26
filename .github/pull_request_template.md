## Qué cambia y por qué

<!-- Una o dos frases. El código ya muestra el "qué"; esto explica el "por qué". -->

## Checklist (Definition of Done)

Ver [`gobernanza/estandares/03-definition-of-done.md`](../gobernanza/estandares/03-definition-of-done.md) para el detalle completo de cada punto.

- [ ] CI verde (build, lint, tipos, verificaciones de conformidad).
- [ ] Si toca base de datos: migración nueva (no editada), nomenclatura conforme, RLS habilitado, trigger de auditoría asignado, tipos regenerados.
- [ ] Si toca un flujo crítico (datos sensibles, dinero, identidad): exige `aal2` en RLS, datos sensibles cifrados/enmascarados.
- [ ] Si agrega/modifica un requerimiento: código (`TRQ-014`, etc.) presente en el issue, la especificación funcional y el README del módulo.
- [ ] Si cambia el comportamiento descrito en un artefacto de `gobernanza/`, ese artefacto queda actualizado en este mismo PR.
- [ ] `service_role` no aparece fuera de `supabase/functions/`.

## Issue relacionado

Closes #
