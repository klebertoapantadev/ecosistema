-- 10 min resultaba corto en la practica: revisar el correo (sobre todo la
-- primera vez, buscando en la bandeja) mas escribir el codigo facilmente
-- pasa los 10 min. 15 min sigue siendo corto para fuerza bruta (6 digitos,
-- 5 intentos maximo igual aplica) pero da margen real.
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
  values (v_usuario_id, extensions.crypt(v_codigo, extensions.gen_salt('bf')), now() + interval '15 minutes');

  return v_codigo;
end;
$$;
