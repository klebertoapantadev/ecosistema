---
name: nomenclatura-bd
description: Aplica el estándar de nomenclatura de base de datos del ecosistema al diseñar o revisar una tabla nueva de Supabase/PostgreSQL. Úsalo cada vez que se cree una tabla, columna, migración o política RLS nueva en cualquier esquema del ecosistema.
---

# Nomenclatura de Base de Datos

Antes de proponer o revisar una tabla nueva, aplica esta fórmula sin excepción. El estándar completo está en `gobernanza/estandares/00-nomenclatura-base-datos.md` — léelo si hay cualquier duda de un caso no cubierto aquí.

## Checklist al crear una tabla

1. **Esquema**: ¿es transversal (`comun_{dominio}`) o de negocio (`{marca}_{dominio}`)? No crear un esquema nuevo sin que esté registrado en `gobernanza/productos/{producto}/especificacion-tecnica.md`.
2. **Prefijo de tabla**: 3 letras del identificador de marca ya asignado (`trq_`, `ffh_`, `tnk_`, o el prefijo del esquema común correspondiente). Nunca inventar uno nuevo sin registrarlo.
3. **Nombre de tabla**: `{prefijo_tabla}{entidad_snake_case}`.
4. **Prefijo de columna**: abreviatura de 3 letras de la entidad (sin el prefijo de tabla), aplicada a *todas* las columnas de esa tabla.
5. **Columnas obligatorias en toda tabla:**
   - `{prefijo}id` — `uuid primary key default gen_random_uuid()`
   - `{prefijo}secuencial` — `bigint generated always as identity` (solo para folios/reportes, nunca FK)
   - `{prefijo}detalle_{entidad}` — `jsonb not null default '{}'::jsonb`
   - `{prefijo}creado_en`, `{prefijo}actualizado_en` — `timestamptz`
   - `{prefijo}eliminado_en` — `timestamptz` nullable, si la entidad admite borrado lógico
6. **RLS**: `alter table ... enable row level security;` en la misma migración que crea la tabla.
7. **Auditoría**: trigger `aud_fn_auditar_tabla()` `after insert or update or delete`, en la misma migración.
8. **Relaciones N:M**: tabla de unión explícita con su propio prefijo, nunca un array de IDs.
9. **Datos sensibles**: si la tabla guarda cédula, documentos de identidad, notas de expediente o equivalente, cifrar la columna con `pgp_sym_encrypt` y prever enmascaramiento con `seg_enmascarar_texto()` en la vista de lectura por defecto.

## Al revisar una tabla existente

Señala como bloqueante cualquier tabla nueva que:
- No siga el prefijo de 3 letras.
- No tenga RLS habilitado.
- No tenga el trigger de auditoría.
- Use un array de IDs para una relación que debería ser tabla de unión.
- Exponga una columna sensible sin cifrado ni enmascaramiento.

No propongas excepciones "temporales" a estas reglas — no existen en este ecosistema.
