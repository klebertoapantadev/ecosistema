-- =============================================================================
-- Migración: 20261126000010_omnicanal_google_contacts_oauth_y_depurador.sql
-- Requerimiento: PLT-010 Fase 3 (Depurador 2D de Agenda + Sincronización Directa
--                Google Contacts / Google People API OAuth 2.0 con Supabase Vault)
-- Descripción:
--   1. Tabla `comun_agentes.agc_google_contacts_conexion` (`gcn_`) con RLS estricto
--      y auditoría obligatoria (`aud_fn_auditar_tabla()`). Almacena el `refresh_token`
--      OAuth 2.0 cifrado en `vault.secrets` (`gcn_refresh_secreto_id`), permitiendo
--      conectar cuentas Gmail independientes de la sesión de login (ej. Dueño,
--      Administradora, Operador) sin cerrar sesión en el ecosistema.
--   2. RPCs en `comun_comercio` (expuesto en PostgREST):
--      - `com_fn_omnicanal_google_contacts_obtener_estado`
--      - `com_fn_omnicanal_google_contacts_guardar_app_oauth`
--      - `com_fn_omnicanal_google_contacts_obtener_app_oauth`
--      - `com_fn_omnicanal_google_contacts_guardar_conexion`
--      - `com_fn_omnicanal_google_contacts_obtener_refresh_token`
--      - `com_fn_omnicanal_google_contacts_desconectar`
--      - `com_fn_omnicanal_google_contacts_registrar_sync`
-- =============================================================================

create extension if not exists supabase_vault with schema vault;

create table if not exists comun_agentes.agc_google_contacts_conexion (
  gcn_id uuid primary key default gen_random_uuid(),
  gcn_secuencial bigint generated always as identity,
  gcn_negocio text not null check (gcn_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  gcn_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  gcn_linea_whatsapp_id uuid references comun_agentes.agc_linea_whatsapp(lwa_id) on delete set null,
  gcn_correo_google text not null,
  gcn_nombre_google text,
  gcn_foto_url text,
  gcn_refresh_secreto_id uuid,
  gcn_scopes text not null default 'https://www.googleapis.com/auth/contacts',
  gcn_estado text not null default 'ACTIVA' check (gcn_estado in ('ACTIVA', 'REVOCADA', 'ERROR')),
  gcn_ultima_lectura_en timestamptz,
  gcn_ultima_escritura_en timestamptz,
  gcn_total_contactos_leidos integer not null default 0,
  gcn_detalle_conexion jsonb not null default '{}'::jsonb,
  gcn_creado_en timestamptz not null default now(),
  gcn_actualizado_en timestamptz not null default now(),
  gcn_eliminado_en timestamptz
);

create unique index if not exists idx_agc_google_contacts_negocio_usu_correo_unico
  on comun_agentes.agc_google_contacts_conexion (gcn_negocio, gcn_usuario_id, lower(gcn_correo_google))
  where gcn_eliminado_en is null;

create index if not exists idx_agc_google_contacts_negocio_activo
  on comun_agentes.agc_google_contacts_conexion (gcn_negocio, gcn_estado)
  where gcn_eliminado_en is null;

alter table comun_agentes.agc_google_contacts_conexion enable row level security;

do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'comun_agentes'
      and tablename = 'agc_google_contacts_conexion'
      and policyname = 'agc_google_contacts_lectura_propia_o_admin'
  ) then
    create policy agc_google_contacts_lectura_propia_o_admin
      on comun_agentes.agc_google_contacts_conexion
      for select using (
        (auth.uid() is not null and gcn_usuario_id = auth.uid())
        or comun_seguridad.seg_fn_es_admin_negocio_omnicanal(gcn_negocio)
      );
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname = 'comun_agentes'
      and tablename = 'agc_google_contacts_conexion'
      and policyname = 'agc_google_contacts_gestion_propia_o_admin'
  ) then
    create policy agc_google_contacts_gestion_propia_o_admin
      on comun_agentes.agc_google_contacts_conexion
      for all using (
        (auth.uid() is not null and gcn_usuario_id = auth.uid())
        or comun_seguridad.seg_fn_es_admin_negocio_omnicanal(gcn_negocio)
      )
      with check (
        (auth.uid() is not null and gcn_usuario_id = auth.uid())
        or comun_seguridad.seg_fn_es_admin_negocio_omnicanal(gcn_negocio)
      );
  end if;
end $$;

do $$
begin
  if not exists (
    select 1 from pg_trigger
    where tgname = 'trg_auditoria_agc_google_contacts_conexion'
      and tgrelid = 'comun_agentes.agc_google_contacts_conexion'::regclass
  ) then
    create trigger trg_auditoria_agc_google_contacts_conexion
      after insert or update or delete on comun_agentes.agc_google_contacts_conexion
      for each row execute function comun_auditoria.aud_fn_auditar_tabla();
  end if;
end $$;

grant select on comun_agentes.agc_google_contacts_conexion to authenticated;
grant all on comun_agentes.agc_google_contacts_conexion to service_role;

-- 1. Estado público seguro de Google Contacts (sin exponer secretos)
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_obtener_estado(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := false;
  v_cfg comun_configuracion.cfg_negocio;
  v_client_id text;
  v_tiene_secret boolean := false;
  v_conexiones jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo del negocio.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_client_id := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'google_contacts_client_id', '')), '');
  v_tiene_secret := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'google_contacts_secret_vault_id', '')), '') is not null;

  select coalesce(jsonb_agg(to_jsonb(sub) order by sub."actualizadoEn" desc), '[]'::jsonb)
  into v_conexiones
  from (
    select
      g.gcn_id as "id",
      g.gcn_correo_google as "correoGoogle",
      g.gcn_nombre_google as "nombreGoogle",
      g.gcn_foto_url as "fotoUrl",
      g.gcn_usuario_id as "usuarioId",
      coalesce(
        nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
        u.usu_correo
      ) as "usuarioNombre",
      g.gcn_linea_whatsapp_id as "lineaWhatsappId",
      lw.lwa_nombre as "lineaWhatsappNombre",
      g.gcn_scopes as "scopes",
      g.gcn_estado as "estado",
      (g.gcn_refresh_secreto_id is not null) as "tieneRefreshToken",
      g.gcn_ultima_lectura_en as "ultimaLecturaEn",
      g.gcn_ultima_escritura_en as "ultimaEscrituraEn",
      g.gcn_total_contactos_leidos as "totalContactosLeidos",
      g.gcn_creado_en as "creadoEn",
      g.gcn_actualizado_en as "actualizadoEn"
    from comun_agentes.agc_google_contacts_conexion g
    left join comun_seguridad.seg_usuario u on u.usu_id = g.gcn_usuario_id
    left join comun_agentes.agc_linea_whatsapp lw on lw.lwa_id = g.gcn_linea_whatsapp_id
    where g.gcn_negocio = v_negocio
      and g.gcn_eliminado_en is null
      and g.gcn_estado = 'ACTIVA'
      and (v_es_admin or g.gcn_usuario_id = v_uid)
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'esAdmin', v_es_admin,
    'tieneCredencialesVault', (v_client_id is not null and v_tiene_secret),
    'clientIdVault', v_client_id,
    'conexiones', v_conexiones
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_estado(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_estado(text) to authenticated, service_role;

-- 2. Guardar Client ID y Client Secret de Google OAuth en Supabase Vault (Solo Admin)
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_guardar_app_oauth(
  p_negocio text,
  p_client_id text,
  p_client_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_client_id text := btrim(coalesce(p_client_id, ''));
  v_secret text := btrim(coalesce(p_client_secret, ''));
  v_cfg comun_configuracion.cfg_negocio;
  v_prev_vault_id uuid;
  v_new_vault_id uuid;
  v_det jsonb;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede configurar las credenciales OAuth de Google Contacts.');
  end if;

  if v_client_id = '' then
    return jsonb_build_object('ok', false, 'error', 'Ingresa el Client ID de Google Cloud OAuth.');
  end if;

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  if v_cfg.cfg_id is null then
    return jsonb_build_object('ok', false, 'error', 'Configuración base del negocio no encontrada.');
  end if;

  if nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'google_contacts_secret_vault_id', '')), '') ~* '^[0-9a-f-]{36}$' then
    v_prev_vault_id := (v_cfg.cfg_detalle_configuracion->>'google_contacts_secret_vault_id')::uuid;
  end if;

  if v_secret <> '' then
    v_new_vault_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
      v_prev_vault_id,
      v_secret,
      'google_contacts_oauth_secret_' || v_negocio,
      'Google Cloud OAuth Client Secret para Google Contacts (' || v_negocio || ')'
    );
  else
    v_new_vault_id := v_prev_vault_id;
  end if;

  if v_new_vault_id is null then
    return jsonb_build_object('ok', false, 'error', 'Ingresa el Client Secret la primera vez que configures Google Contacts.');
  end if;

  v_det := coalesce(v_cfg.cfg_detalle_configuracion, '{}'::jsonb);
  v_det := jsonb_set(v_det, '{google_contacts_client_id}', to_jsonb(v_client_id), true);
  v_det := jsonb_set(v_det, '{google_contacts_secret_vault_id}', to_jsonb(v_new_vault_id::text), true);

  update comun_configuracion.cfg_negocio
     set cfg_detalle_configuracion = v_det,
         cfg_actualizado_en = now()
   where cfg_id = v_cfg.cfg_id;

  return jsonb_build_object('ok', true, 'clientId', v_client_id, 'tieneSecret', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_guardar_app_oauth(text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_guardar_app_oauth(text, text, text) to authenticated, service_role;

-- 3. Leer credenciales OAuth de Google desde Vault para uso exclusivo en el servidor Next.js
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_obtener_app_oauth(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_cfg comun_configuracion.cfg_negocio;
  v_client_id text;
  v_vault_id uuid;
  v_secret text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_client_id := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'google_contacts_client_id', '')), '');
  if nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'google_contacts_secret_vault_id', '')), '') ~* '^[0-9a-f-]{36}$' then
    v_vault_id := (v_cfg.cfg_detalle_configuracion->>'google_contacts_secret_vault_id')::uuid;
  end if;

  if v_vault_id is not null then
    select d.decrypted_secret into v_secret
    from vault.decrypted_secrets d
    where d.id = v_vault_id;
  end if;

  if v_client_id is null or v_secret is null or btrim(v_secret) = '' then
    return jsonb_build_object('ok', false, 'error', 'Credenciales OAuth de Google Contacts no configuradas en Vault.');
  end if;

  return jsonb_build_object(
    'ok', true,
    'clientId', v_client_id,
    'clientSecret', v_secret
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_app_oauth(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_app_oauth(text) to authenticated, service_role;

-- 4. Guardar o actualizar una cuenta Google Contacts conectada (refresh_token en Vault)
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_guardar_conexion(
  p_negocio text,
  p_correo_google text,
  p_nombre_google text default null,
  p_foto_url text default null,
  p_refresh_token text default null,
  p_scopes text default 'https://www.googleapis.com/auth/contacts',
  p_linea_whatsapp_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_correo text := lower(btrim(coalesce(p_correo_google, '')));
  v_refresh text := btrim(coalesce(p_refresh_token, ''));
  v_prev comun_agentes.agc_google_contacts_conexion;
  v_sec_id uuid;
  v_id uuid;
  v_clave_sec text;
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para vincular Google Contacts en este negocio.');
  end if;

  if v_correo = '' or position('@' in v_correo) = 0 then
    return jsonb_build_object('ok', false, 'error', 'Correo de cuenta Google inválido.');
  end if;

  select * into v_prev
  from comun_agentes.agc_google_contacts_conexion
  where gcn_negocio = v_negocio
    and gcn_usuario_id = v_uid
    and lower(gcn_correo_google) = v_correo
    and gcn_eliminado_en is null
  limit 1;

  v_clave_sec := 'gcontacts_rt_' || v_negocio || '_' || left(md5(v_uid::text || ':' || v_correo), 16);

  if v_refresh <> '' then
    v_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
      v_prev.gcn_refresh_secreto_id,
      v_refresh,
      v_clave_sec,
      'Google Contacts OAuth refresh token para ' || v_correo || ' (' || v_negocio || ')'
    );
  else
    v_sec_id := v_prev.gcn_refresh_secreto_id;
  end if;

  if v_prev.gcn_id is not null then
    update comun_agentes.agc_google_contacts_conexion
       set gcn_nombre_google = coalesce(nullif(btrim(coalesce(p_nombre_google, '')), ''), gcn_nombre_google),
           gcn_foto_url = coalesce(nullif(btrim(coalesce(p_foto_url, '')), ''), gcn_foto_url),
           gcn_refresh_secreto_id = v_sec_id,
           gcn_scopes = coalesce(nullif(btrim(coalesce(p_scopes, '')), ''), gcn_scopes),
           gcn_linea_whatsapp_id = coalesce(p_linea_whatsapp_id, gcn_linea_whatsapp_id),
           gcn_estado = 'ACTIVA',
           gcn_actualizado_en = now()
     where gcn_id = v_prev.gcn_id
     returning gcn_id into v_id;
  else
    insert into comun_agentes.agc_google_contacts_conexion (
      gcn_negocio, gcn_usuario_id, gcn_linea_whatsapp_id,
      gcn_correo_google, gcn_nombre_google, gcn_foto_url,
      gcn_refresh_secreto_id, gcn_scopes, gcn_estado
    ) values (
      v_negocio, v_uid, p_linea_whatsapp_id,
      v_correo, nullif(btrim(coalesce(p_nombre_google, '')), ''), nullif(btrim(coalesce(p_foto_url, '')), ''),
      v_sec_id, coalesce(nullif(btrim(coalesce(p_scopes, '')), ''), 'https://www.googleapis.com/auth/contacts'), 'ACTIVA'
    )
    returning gcn_id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'conexionId', v_id,
    'correoGoogle', v_correo,
    'tieneRefreshToken', (v_sec_id is not null)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_guardar_conexion(text, text, text, text, text, text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_guardar_conexion(text, text, text, text, text, text, uuid) to authenticated, service_role;

-- 5. Obtener refresh_token desencriptado para Server Actions (solo propietario o Admin)
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_obtener_refresh_token(
  p_negocio text,
  p_conexion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := false;
  v_con comun_agentes.agc_google_contacts_conexion;
  v_refresh text;
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_con
  from comun_agentes.agc_google_contacts_conexion
  where gcn_id = p_conexion_id
    and gcn_negocio = v_negocio
    and gcn_eliminado_en is null
    and gcn_estado = 'ACTIVA';

  if v_con.gcn_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conexión de Google Contacts no encontrada o inactiva.');
  end if;

  if not v_es_admin and v_con.gcn_usuario_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'Solo el titular de esta cuenta Google o un Administrador puede sincronizarla.');
  end if;

  if v_con.gcn_refresh_secreto_id is not null then
    select d.decrypted_secret into v_refresh
    from vault.decrypted_secrets d
    where d.id = v_con.gcn_refresh_secreto_id;
  end if;

  if v_refresh is null or btrim(v_refresh) = '' then
    return jsonb_build_object('ok', false, 'error', 'La conexión no tiene refresh token válido. Vuelve a pulsar «Conectar Google».');
  end if;

  return jsonb_build_object(
    'ok', true,
    'conexionId', v_con.gcn_id,
    'correoGoogle', v_con.gcn_correo_google,
    'nombreGoogle', v_con.gcn_nombre_google,
    'lineaWhatsappId', v_con.gcn_linea_whatsapp_id,
    'refreshToken', v_refresh
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_refresh_token(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_obtener_refresh_token(text, uuid) to authenticated, service_role;

-- 6. Desconectar cuenta Google Contacts
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_desconectar(
  p_negocio text,
  p_conexion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := false;
  v_con comun_agentes.agc_google_contacts_conexion;
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_con
  from comun_agentes.agc_google_contacts_conexion
  where gcn_id = p_conexion_id
    and gcn_negocio = v_negocio
    and gcn_eliminado_en is null;

  if v_con.gcn_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conexión no encontrada.');
  end if;

  if not v_es_admin and v_con.gcn_usuario_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'Solo el titular o un Administrador puede desconectar esta cuenta.');
  end if;

  update comun_agentes.agc_google_contacts_conexion
     set gcn_estado = 'REVOCADA',
         gcn_eliminado_en = now(),
         gcn_actualizado_en = now()
   where gcn_id = p_conexion_id;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_desconectar(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_desconectar(text, uuid) to authenticated, service_role;

-- 7. Registrar marca de lectura o escritura de sincronización
create or replace function comun_comercio.com_fn_omnicanal_google_contacts_registrar_sync(
  p_negocio text,
  p_conexion_id uuid,
  p_tipo text,
  p_cantidad integer default 0,
  p_detalle jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := false;
  v_tipo text := upper(btrim(coalesce(p_tipo, 'LECTURA')));
begin
  if v_uid is null or not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No autorizado.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  update comun_agentes.agc_google_contacts_conexion
     set gcn_ultima_lectura_en = case when v_tipo = 'LECTURA' then now() else gcn_ultima_lectura_en end,
         gcn_ultima_escritura_en = case when v_tipo = 'ESCRITURA' then now() else gcn_ultima_escritura_en end,
         gcn_total_contactos_leidos = case when v_tipo = 'LECTURA' then greatest(coalesce(p_cantidad, 0), 0) else gcn_total_contactos_leidos end,
         gcn_detalle_conexion = coalesce(gcn_detalle_conexion, '{}'::jsonb) || coalesce(p_detalle, '{}'::jsonb),
         gcn_actualizado_en = now()
   where gcn_id = p_conexion_id
     and gcn_negocio = v_negocio
     and gcn_eliminado_en is null
     and (v_es_admin or gcn_usuario_id = v_uid);

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_google_contacts_registrar_sync(text, uuid, text, integer, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_google_contacts_registrar_sync(text, uuid, text, integer, jsonb) to authenticated, service_role;

notify pgrst, 'reload schema';
