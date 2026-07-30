-- Fix real: search_path = '' (correcto por seguridad) hace que crypt()/
-- gen_salt() no resuelvan sin calificar el esquema -- pgcrypto vive en
-- "extensions" en este proyecto, no en "public". Confirmado en produccion:
-- "function gen_salt(unknown) does not exist" al registrar una cuenta real.
create or replace function comun_seguridad.seg_fn_generar_otp_registro()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_ultimo_creado timestamptz;
  v_codigo text;
begin
  if v_usuario_id is null then
    raise exception 'No autenticado';
  end if;

  select otp_creado_en into v_ultimo_creado
  from comun_seguridad.seg_otp_correo
  where otp_usuario_id = v_usuario_id and otp_verificado_en is null
  order by otp_creado_en desc
  limit 1;

  if v_ultimo_creado is not null and v_ultimo_creado > now() - interval '60 seconds' then
    raise exception 'Espera un momento antes de pedir otro codigo';
  end if;

  v_codigo := lpad(floor(random() * 1000000)::text, 6, '0');

  insert into comun_seguridad.seg_otp_correo (otp_usuario_id, otp_codigo_hash, otp_expira_en)
  values (v_usuario_id, extensions.crypt(v_codigo, extensions.gen_salt('bf')), now() + interval '10 minutes');

  return v_codigo;
end;
$$;

create or replace function comun_seguridad.seg_fn_verificar_otp_registro(p_codigo text)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_fila comun_seguridad.seg_otp_correo;
begin
  if v_usuario_id is null then
    raise exception 'No autenticado';
  end if;

  select * into v_fila
  from comun_seguridad.seg_otp_correo
  where otp_usuario_id = v_usuario_id and otp_verificado_en is null
  order by otp_creado_en desc
  limit 1
  for update;

  if not found or v_fila.otp_expira_en < now() or v_fila.otp_intentos >= 5 then
    return false;
  end if;

  if v_fila.otp_codigo_hash <> extensions.crypt(p_codigo, v_fila.otp_codigo_hash) then
    update comun_seguridad.seg_otp_correo set otp_intentos = otp_intentos + 1 where otp_id = v_fila.otp_id;
    return false;
  end if;

  update comun_seguridad.seg_otp_correo set otp_verificado_en = now() where otp_id = v_fila.otp_id;
  update comun_seguridad.seg_usuario set usu_correo_verificado_en = now() where usu_id = v_usuario_id;
  return true;
end;
$$;
