-- Recuperacion de contrasena (Opcion A del diseno acordado): token propio,
-- remitente por negocio via @eco/notificaciones, cambio real de contrasena
-- delegado a una Edge Function (unico lugar permitido para service_role,
-- ver gobernanza/politicas/gestion-credenciales.md §3).
--
-- Token con SHA-256 (no bcrypt/crypt como el OTP de 6 digitos): el token
-- tiene 256 bits de entropia via gen_random_bytes(32) -- no necesita hash
-- lento para resistir fuerza bruta, y SI necesita ser buscable por igualdad
-- directa (bcrypt genera una sal distinta cada vez, no se puede indexar).

create table comun_seguridad.seg_recuperacion_correo (
  rec_id uuid primary key default gen_random_uuid(),
  rec_secuencial bigint generated always as identity,
  rec_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  rec_token_hash text not null,
  rec_expira_en timestamptz not null,
  rec_usado_en timestamptz,
  rec_creado_en timestamptz not null default now()
);

create unique index seg_recuperacion_correo_token_idx on comun_seguridad.seg_recuperacion_correo (rec_token_hash);
create index seg_recuperacion_correo_usuario_idx on comun_seguridad.seg_recuperacion_correo (rec_usuario_id, rec_creado_en desc);

alter table comun_seguridad.seg_recuperacion_correo enable row level security;
-- Sin politica de cliente: ni siquiera el propio usuario tiene sesion en
-- este flujo. Solo accesible via la funcion de abajo y la Edge Function
-- (que usa service_role, bypassea RLS).

create trigger trg_auditoria_seg_recuperacion_correo after insert or update or delete on comun_seguridad.seg_recuperacion_correo for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- Genera el token para quien pida recuperar, buscando por correo (no hay
-- auth.uid(): nadie tiene sesion en este flujo). SIEMPRE hace el mismo
-- trabajo exista o no la cuenta y retorna null si no existe -- el llamador
-- (server action) manda el MISMO mensaje al usuario en ambos casos, para no
-- filtrar que correos estan registrados.
create or replace function comun_seguridad.seg_fn_solicitar_recuperacion(p_correo text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid;
  v_ultimo_creado timestamptz;
  v_token text;
begin
  select usu_id into v_usuario_id from comun_seguridad.seg_usuario where usu_correo = p_correo;
  if v_usuario_id is null then
    return null;
  end if;

  select rec_creado_en into v_ultimo_creado
  from comun_seguridad.seg_recuperacion_correo
  where rec_usuario_id = v_usuario_id and rec_usado_en is null
  order by rec_creado_en desc
  limit 1;

  if v_ultimo_creado is not null and v_ultimo_creado > now() - interval '60 seconds' then
    return null;
  end if;

  v_token := encode(extensions.gen_random_bytes(32), 'hex');

  insert into comun_seguridad.seg_recuperacion_correo (rec_usuario_id, rec_token_hash, rec_expira_en)
  values (v_usuario_id, encode(extensions.digest(v_token, 'sha256'), 'hex'), now() + interval '30 minutes');

  return v_token;
end;
$$;

grant execute on function comun_seguridad.seg_fn_solicitar_recuperacion(text) to anon, authenticated;
