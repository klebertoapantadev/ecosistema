-- OTP de registro por correo (reemplaza el link magico de Supabase Auth para
-- el camino de registro por correo/contrasena) + remitente propio por negocio
-- (packages/notificaciones, fuera de esta migracion). Google OAuth sigue sin
-- pasar por OTP -- Supabase ya confirma el correo por el proveedor.

alter table comun_seguridad.seg_usuario
  add column usu_correo_verificado_en timestamptz;

-- Backfill: cuentas ya existentes (creadas antes de este gate) se consideran
-- verificadas -- no romper acceso de cuentas reales ya en uso.
update comun_seguridad.seg_usuario
set usu_correo_verificado_en = coalesce(usu_creado_en, now())
where usu_correo_verificado_en is null;

create table comun_seguridad.seg_otp_correo (
  otp_id uuid primary key default gen_random_uuid(),
  otp_secuencial bigint generated always as identity,
  otp_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  otp_codigo_hash text not null,
  otp_expira_en timestamptz not null,
  otp_intentos int not null default 0,
  otp_verificado_en timestamptz,
  otp_creado_en timestamptz not null default now()
);

create index seg_otp_correo_usuario_idx on comun_seguridad.seg_otp_correo (otp_usuario_id, otp_creado_en desc);

alter table comun_seguridad.seg_otp_correo enable row level security;
-- Sin politica de cliente: solo accesible via las funciones security definer
-- de abajo, mismo criterio que comun_notificaciones.not_cola_correo.

create trigger trg_auditoria_seg_otp_correo after insert or update or delete on comun_seguridad.seg_otp_correo for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- Genera un codigo de 6 digitos para el usuario autenticado (auth.uid()) --
-- nunca recibe un id como parametro, para que nadie pueda pedir el codigo de
-- otra persona. Retorna el codigo en texto plano: el llamador es la Server
-- Action (server-side), nunca se expone al navegador via RPC directo.
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
  values (v_usuario_id, crypt(v_codigo, gen_salt('bf')), now() + interval '10 minutes');

  return v_codigo;
end;
$$;

-- Verifica el codigo mas reciente sin consumir del usuario autenticado. 5
-- intentos fallidos invalidan ese codigo -- hay que pedir uno nuevo.
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

  if v_fila.otp_codigo_hash <> crypt(p_codigo, v_fila.otp_codigo_hash) then
    update comun_seguridad.seg_otp_correo set otp_intentos = otp_intentos + 1 where otp_id = v_fila.otp_id;
    return false;
  end if;

  update comun_seguridad.seg_otp_correo set otp_verificado_en = now() where otp_id = v_fila.otp_id;
  update comun_seguridad.seg_usuario set usu_correo_verificado_en = now() where usu_id = v_usuario_id;
  return true;
end;
$$;

grant execute on function comun_seguridad.seg_fn_generar_otp_registro() to authenticated;
grant execute on function comun_seguridad.seg_fn_verificar_otp_registro(text) to authenticated;

-- Ajuste al trigger de aprovisionamiento: si el correo ya viene confirmado
-- (Google OAuth, independiente del toggle "Confirm email" de la app Email),
-- se marca verificado de una vez -- ese camino no pasa por OTP.
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
    usu_terminos_aceptados_en, usu_terminos_version, usu_detalle_usuario,
    usu_correo_verificado_en
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
    ),
    case when new.email_confirmed_at is not null then now() else null end
  )
  on conflict (usu_id) do nothing;

  return new;
end;
$$;
