-- =============================================================================
-- Migración: 20261119000006_depurar_tinturados_y_alias_colores_rosas.sql
-- Requerimientos: PLT-009 / TNK-005 (Catálogo de Variedades de Rosas)
-- Descripción:
--   1. Elimina lógicamente todas las variedades de color 'tinturado' en
--      comun_comercio.com_variedad_rosa excepto 'Blue', 'Black' y 'Gold'.
--   2. Garantiza que 'Blue' quede activa como variedad por defecto de tinturado.
-- =============================================================================

update comun_comercio.com_variedad_rosa
   set vro_eliminado_en = now(),
       vro_activo = false,
       vro_es_defecto = false,
       vro_actualizado_en = now()
 where vro_color_clave = 'tinturado'
   and vro_eliminado_en is null
   and lower(btrim(vro_nombre)) not in ('blue', 'black', 'gold');

-- Asegurar que 'Blue' quede activa como variedad por defecto de tinturado por negocio
do $$
declare
  v_neg record;
begin
  for v_neg in
    select distinct vro_negocio
      from comun_comercio.com_variedad_rosa
     where vro_color_clave = 'tinturado'
       and vro_eliminado_en is null
  loop
    if not exists (
      select 1
        from comun_comercio.com_variedad_rosa
       where vro_negocio = v_neg.vro_negocio
         and vro_color_clave = 'tinturado'
         and vro_es_defecto = true
         and vro_eliminado_en is null
    ) then
      update comun_comercio.com_variedad_rosa
         set vro_es_defecto = true,
             vro_actualizado_en = now()
       where vro_id = (
         select vro_id
           from comun_comercio.com_variedad_rosa
          where vro_negocio = v_neg.vro_negocio
            and vro_color_clave = 'tinturado'
            and vro_eliminado_en is null
            and vro_activo = true
          order by case when lower(btrim(vro_nombre)) = 'blue' then 0 else 1 end, vro_orden asc
          limit 1
       );
    end if;
  end loop;
end $$;
