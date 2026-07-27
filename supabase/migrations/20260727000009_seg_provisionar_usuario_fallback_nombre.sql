-- Bug real detectado con las cuentas de Google de kleber.toapanta.ch@gmail.com
-- y familiammtg@gmail.com: el proveedor Google de este proyecto Supabase NO
-- envia given_name/family_name en raw_user_meta_data (solo name/full_name,
-- ej. "Kleber Toapanta" o "Familia Toapanta Guerrero"). El trigger
-- (20260727000007/000008) leia exclusivamente given_name/family_name, asi
-- que usu_nombres/usu_apellidos quedaban NULL y la bienvenida (PLT-001
-- regla 2) no prellenaba nada -- el usuario tenia que escribir todo desde
-- cero, contrario a la intencion original.
--
-- Fallback: si no hay given_name/family_name, se parte "name"/"full_name"
-- por el primer espacio. Es una heuristica imperfecta para nombres
-- compuestos o de cuentas familiares/comerciales -- exactamente el caso que
-- la pantalla de bienvenida ya cubre dejando editar antes de guardar.
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
  v_nombre_completo text;
  v_terminos_version text;
begin
  v_es_superadmin := (new.email = 'kleber.toapanta.ch@gmail.com');
  v_nombres := new.raw_user_meta_data ->> 'given_name';
  v_apellidos := new.raw_user_meta_data ->> 'family_name';
  v_terminos_version := new.raw_user_meta_data ->> 'terminos_version';

  if v_nombres is null and v_apellidos is null then
    v_nombre_completo := trim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name'));
    if v_nombre_completo is not null and v_nombre_completo <> '' then
      v_nombres := split_part(v_nombre_completo, ' ', 1);
      v_apellidos := nullif(trim(substring(v_nombre_completo from length(v_nombres) + 1)), '');
    end if;
  end if;

  insert into comun_seguridad.seg_usuario (
    usu_id, usu_correo, usu_nombres, usu_apellidos, usu_superadmin_plataforma,
    usu_terminos_aceptados_en, usu_terminos_version, usu_detalle_usuario
  )
  values (
    new.id,
    new.email,
    v_nombres,
    v_apellidos,
    v_es_superadmin,
    case when v_terminos_version is not null then now() else null end,
    v_terminos_version,
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
