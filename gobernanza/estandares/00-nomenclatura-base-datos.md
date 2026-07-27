---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Estándar de Nomenclatura de Base de Datos

Todo proyecto del ecosistema comparte una única instancia PostgreSQL (Supabase), segmentada por esquemas. Esta nomenclatura es obligatoria y se valida en CI — no es una sugerencia de estilo.

## 1. Fórmula obligatoria

| Elemento | Regla | Ejemplo |
| :--- | :--- | :--- |
| Esquema de negocio | `{identificador_corto}_{dominio}`, minúsculas | `tranqui_legal`, `fastfix_mantenimiento`, `tinkay_floristeria`, `margaritas_floristeria` |
| Esquema transversal | `comun_{dominio}` | `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo` |
| Prefijo de tabla | 3 letras del identificador de marca + `_` | `trq_`, `ffh_`, `tnk_`, `mrg_` |
| Nombre de tabla | `{prefijo_tabla}{entidad_snake_case}` | `trq_caso_judicial` |
| Prefijo de columna | Abreviatura de 3 letras de la entidad (sin el prefijo de tabla) + `_` | `cas_`, `sol_`, `ped_` |
| Clave primaria | `{prefijo_columna}id`, tipo `uuid`, default `gen_random_uuid()` | `cas_id` |
| Clave secuencial legible | `{prefijo_columna}secuencial`, `bigint generated always as identity`, uso exclusivo en folios/reportes — nunca como FK | `cas_secuencial` |
| Columna JSONB de detalle | `{prefijo_columna}detalle_{entidad}`, para atributos flexibles sin migración | `cas_detalle_caso` |
| Timestamps | `{prefijo_columna}creado_en`, `{prefijo_columna}actualizado_en`, ambos `timestamptz` | `cas_creado_en` |
| Borrado lógico (si aplica) | `{prefijo_columna}eliminado_en`, `timestamptz` nullable. No hay borrado físico de filas de negocio. | `cas_eliminado_en` |
| Claves foráneas | `{prefijo_columna}{entidad_referenciada}_id` | `sol_abogado_id` referencia a `trq_abogado.abg_id` |

## 2. Reglas adicionales

- **Un proyecto nuevo no inventa su propio prefijo sin registrarlo.** El prefijo de 3 letras se define una sola vez en `gobernanza/productos/{producto}/especificacion-tecnica.md` y no cambia.
- **Ninguna tabla de negocio se crea sin:** RLS habilitado, trigger `aud_fn_auditar_tabla()` asignado, y las columnas de timestamps estándar.
- **Relaciones N:M usan tabla de unión explícita**, nunca arrays de IDs. Ejemplo: `trq_solicitud_materia`, no un array `materias_ids` en `trq_solicitud_socio`.
- **Catálogos compartidos entre proyectos van en un esquema `comun_*`**, no se duplican por negocio. Ejemplo: `comun_catalogo.cat_provincia`.
- **Nada de abreviaturas ambiguas.** `cas_` es claro para "caso"; evitar prefijos que colisionen en significado entre entidades del mismo esquema.

## 3. Ejemplo de tabla completa

```sql
create table tranqui_legal.trq_caso_judicial (
  cas_id uuid primary key default gen_random_uuid(),
  cas_secuencial bigint generated always as identity,
  cas_abogado_id uuid not null references tranqui_legal.trq_abogado(abg_id),
  cas_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  cas_titulo text not null,
  cas_estado text not null default 'abierto',
  cas_detalle_caso jsonb not null default '{}'::jsonb,
  cas_creado_en timestamptz not null default now(),
  cas_actualizado_en timestamptz not null default now(),
  cas_eliminado_en timestamptz
);

alter table tranqui_legal.trq_caso_judicial enable row level security;

create trigger trg_auditoria_caso_judicial
  after insert or update or delete on tranqui_legal.trq_caso_judicial
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();
```

## 4. Verificación en CI

El workflow `.github/workflows/validar-convenciones.yml` rechaza un PR si detecta:

- Una tabla nueva sin trigger `aud_fn_auditar_tabla()`.
- Una tabla nueva sin RLS habilitado (`rowsecurity = false` en `pg_tables`).
- Un nombre de columna que no respeta el prefijo de 3 letras de su tabla.
- Un esquema de negocio nuevo sin entrada correspondiente en `gobernanza/productos/`.

Ver [`arquitectura/marco-de-trabajo.md`](../arquitectura/marco-de-trabajo.md) para el contrato de capas que consume este esquema.
