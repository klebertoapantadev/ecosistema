# supabase/migrations

Historial único de migraciones para toda la instancia compartida. Nombre de archivo: `AAAAMMDDHHMMSS_esquema_descripcion.sql`.

Nunca se edita una migración ya aplicada; se crea una nueva. Ver [`gobernanza/estandares/00-nomenclatura-base-datos.md`](../../gobernanza/estandares/00-nomenclatura-base-datos.md).

Primeras migraciones pendientes (Sprint 0):
1. Esquemas `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo`.
2. Función `aud_fn_auditar_tabla()`.
3. Función `seg_enmascarar_texto()`.
4. Seed de `comun_catalogo.cat_provincia` / `cat_ciudad`.
