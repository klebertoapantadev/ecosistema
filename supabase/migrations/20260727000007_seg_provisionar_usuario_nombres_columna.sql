-- La bienvenida (PLT-001 regla 2) necesita precargar nombre/apellido reales
-- para que el usuario los confirme o corrija (Google no siempre los da
-- claros -- ej. cuentas de correo comerciales). El trigger original solo
-- los guardaba en usu_detalle_usuario (JSONB); ahora tambien poblan las
-- columnas dedicadas, que es lo que la pantalla de bienvenida lee y edita.
create or replace function comun_seguridad.seg_fn_provisionar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_superadmin boolean;
  v_nombres text;
  v_apellidos text;
begin
  v_es_superadmin := (new.email = 'kleber.toapanta.ch@gmail.com');
  v_nombres := new.raw_user_meta_data ->> 'given_name';
  v_apellidos := new.raw_user_meta_data ->> 'family_name';

  insert into comun_seguridad.seg_usuario (usu_id, usu_correo, usu_nombres, usu_apellidos, usu_superadmin_plataforma, usu_detalle_usuario)
  values (
    new.id,
    new.email,
    v_nombres,
    v_apellidos,
    v_es_superadmin,
    jsonb_build_object(
      'nombres', v_nombres,
      'apellidos', v_apellidos,
      'foto', new.raw_user_meta_data ->> 'avatar_url'
    )
  )
  on conflict (usu_id) do nothing;

  return new;
end;
$$;
