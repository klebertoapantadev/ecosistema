-- =============================================================================
-- Migración: Suscripciones Web Push PWA (Estilo WhatsApp) para Chat Grupal y Omnicanal
-- Fecha: 2026-11-17
-- Reglas cumplidas: RLS 100%, aud_fn_auditar_tabla(), Vault para clave privada VAPID,
--                   nomenclatura psu_* y GRANT UPDATE restringido por columna.
-- =============================================================================

-- 1. Columna Vault para clave privada VAPID en cfg_negocio
alter table comun_configuracion.cfg_negocio
  add column if not exists cfg_vapid_secreto_id uuid;

-- 2. Tabla de suscripciones Web Push por dispositivo/navegador
create table if not exists comun_seguridad.seg_push_suscripcion (
  psu_id uuid primary key default gen_random_uuid(),
  psu_secuencial bigint generated always as identity unique,
  psu_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  psu_negocio text not null,
  psu_endpoint text not null,
  psu_p256dh text not null,
  psu_auth text not null,
  psu_activo boolean not null default true,
  psu_detalle_suscripcion jsonb not null default '{}'::jsonb,
  psu_creado_en timestamptz not null default now(),
  psu_actualizado_en timestamptz not null default now(),
  psu_eliminado_en timestamptz,
  constraint uq_psu_negocio_endpoint unique (psu_negocio, psu_endpoint)
);

create index if not exists idx_psu_negocio_usuario_activo
  on comun_seguridad.seg_push_suscripcion (psu_negocio, psu_usuario_id)
  where psu_activo = true and psu_eliminado_en is null;

alter table comun_seguridad.seg_push_suscripcion enable row level security;

drop policy if exists psu_select_propio on comun_seguridad.seg_push_suscripcion;
create policy psu_select_propio
  on comun_seguridad.seg_push_suscripcion
  for select
  to authenticated
  using (psu_usuario_id = auth.uid() and psu_eliminado_en is null);

drop policy if exists psu_insert_propio on comun_seguridad.seg_push_suscripcion;
create policy psu_insert_propio
  on comun_seguridad.seg_push_suscripcion
  for insert
  to authenticated
  with check (psu_usuario_id = auth.uid());

drop policy if exists psu_update_propio on comun_seguridad.seg_push_suscripcion;
create policy psu_update_propio
  on comun_seguridad.seg_push_suscripcion
  for update
  to authenticated
  using (psu_usuario_id = auth.uid() and psu_eliminado_en is null)
  with check (psu_usuario_id = auth.uid());

revoke all on table comun_seguridad.seg_push_suscripcion from public, anon;
grant select, insert on table comun_seguridad.seg_push_suscripcion to authenticated;
revoke update on table comun_seguridad.seg_push_suscripcion from authenticated;
grant update (psu_p256dh, psu_auth, psu_activo, psu_detalle_suscripcion, psu_actualizado_en, psu_eliminado_en)
  on table comun_seguridad.seg_push_suscripcion to authenticated;
grant all on table comun_seguridad.seg_push_suscripcion to service_role;

drop trigger if exists trg_auditar_seg_push_suscripcion on comun_seguridad.seg_push_suscripcion;
create trigger trg_auditar_seg_push_suscripcion
  after insert or update or delete on comun_seguridad.seg_push_suscripcion
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 3. RPC: Obtener clave pública VAPID del negocio (o inicializar par VAPID en Vault)
create or replace function comun_comercio.com_fn_push_asegurar_claves_vapid(
  p_negocio text,
  p_public_key_propuesta text default null,
  p_private_key_propuesta text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_cfg comun_configuracion.cfg_negocio;
  v_pub text;
  v_sec_id uuid;
begin
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_pub := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'vapid_public_key', '')), '');

  if v_pub is not null and v_cfg.cfg_vapid_secreto_id is not null then
    return jsonb_build_object('ok', true, 'publicKey', v_pub);
  end if;

  if nullif(btrim(coalesce(p_public_key_propuesta, '')), '') is null
     or nullif(btrim(coalesce(p_private_key_propuesta, '')), '') is null then
    return jsonb_build_object('ok', false, 'requiereGenerar', true);
  end if;

  v_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_cfg.cfg_vapid_secreto_id,
    btrim(p_private_key_propuesta),
    'webpush_vapid_priv_' || v_negocio,
    'Clave privada VAPID Web Push del negocio ' || v_negocio
  );

  update comun_configuracion.cfg_negocio
     set cfg_vapid_secreto_id = v_sec_id,
         cfg_detalle_configuracion = coalesce(cfg_detalle_configuracion, '{}'::jsonb) || jsonb_build_object(
           'vapid_public_key', btrim(p_public_key_propuesta)
         ),
         cfg_actualizado_en = now()
   where cfg_id = v_cfg.cfg_id;

  return jsonb_build_object('ok', true, 'publicKey', btrim(p_public_key_propuesta));
end;
$$;

revoke all on function comun_comercio.com_fn_push_asegurar_claves_vapid(text, text, text) from public;
grant execute on function comun_comercio.com_fn_push_asegurar_claves_vapid(text, text, text) to authenticated, service_role;

-- 4. RPC: Registrar o refrescar la suscripción Web Push del dispositivo actual
create or replace function comun_comercio.com_fn_push_registrar_suscripcion(
  p_negocio text,
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_ep text := btrim(coalesce(p_endpoint, ''));
  v_p256 text := btrim(coalesce(p_p256dh, ''));
  v_auth text := btrim(coalesce(p_auth, ''));
begin
  if v_uid is null then
    return jsonb_build_object('ok', false, 'error', 'Sesión requerida.');
  end if;
  if v_ep = '' or v_p256 = '' or v_auth = '' then
    return jsonb_build_object('ok', false, 'error', 'Datos de suscripción Push incompletos.');
  end if;

  insert into comun_seguridad.seg_push_suscripcion (
    psu_usuario_id,
    psu_negocio,
    psu_endpoint,
    psu_p256dh,
    psu_auth,
    psu_activo,
    psu_detalle_suscripcion,
    psu_actualizado_en,
    psu_eliminado_en
  ) values (
    v_uid,
    v_negocio,
    v_ep,
    v_p256,
    v_auth,
    true,
    jsonb_strip_nulls(jsonb_build_object('user_agent', left(coalesce(p_user_agent, ''), 240))),
    now(),
    null
  )
  on conflict (psu_negocio, psu_endpoint) do update set
    psu_usuario_id = excluded.psu_usuario_id,
    psu_p256dh = excluded.psu_p256dh,
    psu_auth = excluded.psu_auth,
    psu_activo = true,
    psu_detalle_suscripcion = excluded.psu_detalle_suscripcion,
    psu_actualizado_en = now(),
    psu_eliminado_en = null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function comun_comercio.com_fn_push_registrar_suscripcion(text, text, text, text, text) from public, anon;
grant execute on function comun_comercio.com_fn_push_registrar_suscripcion(text, text, text, text, text) to authenticated, service_role;

-- 5. RPC: Obtener destinatarios y suscripciones activas del equipo para despachar Web Push
create or replace function comun_comercio.com_fn_push_obtener_contexto_envio_staff(
  p_negocio text,
  p_token_webhook text default null,
  p_excluir_usuario_id uuid default null,
  p_solo_ventas boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_autorizado boolean := false;
  v_uid uuid := auth.uid();
  v_aria comun_configuracion.cfg_aria;
  v_cfg comun_configuracion.cfg_negocio;
  v_pub text;
  v_priv text;
  v_miembros jsonb;
  v_suscripciones jsonb;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio and a.ari_eliminado_en is null
  limit 1;

  if p_token_webhook is not null and btrim(p_token_webhook) <> ''
     and v_aria.ari_id is not null
     and btrim(coalesce(v_aria.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(p_token_webhook) then
    v_autorizado := true;
  elsif v_uid is not null then
    select exists (
      select 1
      from comun_seguridad.seg_usuario u
      left join comun_seguridad.seg_membresia m
        on m.mem_usuario_id = u.usu_id
       and m.mem_estado = 'ACTIVO'
       and lower(m.mem_negocio) in (v_negocio, case when v_negocio = 'tinkay' then 'tnk' else v_negocio end)
      where u.usu_id = v_uid
        and (
          u.usu_superadmin_plataforma = true
          or upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO')
        )
    ) into v_autorizado;
  end if;

  if not v_autorizado then
    return jsonb_build_object('ok', false, 'error', 'No autorizado');
  end if;

  select * into v_cfg
  from comun_configuracion.cfg_negocio
  where cfg_negocio = v_negocio
  limit 1;

  v_pub := nullif(btrim(coalesce(v_cfg.cfg_detalle_configuracion->>'vapid_public_key', '')), '');
  if v_cfg.cfg_vapid_secreto_id is not null then
    select d.decrypted_secret into v_priv
    from vault.decrypted_secrets d
    where d.id = v_cfg.cfg_vapid_secreto_id;
  end if;

  with personal as (
    select distinct on (u.usu_id)
      u.usu_id as usuario_id,
      case
        when u.usu_superadmin_plataforma = true
          or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
          then 'SUPERADMIN'
        else upper(coalesce(m.mem_rol, 'OPERADOR'))
      end as rol
    from comun_seguridad.seg_usuario u
    left join comun_seguridad.seg_membresia m
      on m.mem_usuario_id = u.usu_id
     and m.mem_estado = 'ACTIVO'
     and lower(m.mem_negocio) in (v_negocio, case when v_negocio = 'tinkay' then 'tnk' else v_negocio end)
    where u.usu_eliminado_en is null
      and (p_excluir_usuario_id is null or u.usu_id <> p_excluir_usuario_id)
      and (
        u.usu_superadmin_plataforma = true
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or (
          not coalesce(p_solo_ventas, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO')
        )
        or (
          coalesce(p_solo_ventas, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR')
        )
      )
  )
  select
    coalesce(
      (select jsonb_agg(jsonb_build_object('usuarioId', p.usuario_id, 'rol', p.rol)) from personal p),
      '[]'::jsonb
    ),
    coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'usuarioId', s.psu_usuario_id,
            'rol', p.rol,
            'endpoint', s.psu_endpoint,
            'p256dh', s.psu_p256dh,
            'auth', s.psu_auth
          )
        )
        from comun_seguridad.seg_push_suscripcion s
        join personal p on p.usuario_id = s.psu_usuario_id
        where s.psu_negocio = v_negocio
          and s.psu_activo = true
          and s.psu_eliminado_en is null
      ),
      '[]'::jsonb
    )
  into v_miembros, v_suscripciones;

  return jsonb_build_object(
    'ok', true,
    'vapidPublicKey', v_pub,
    'vapidPrivateKey', v_priv,
    'miembros', v_miembros,
    'suscripciones', v_suscripciones
  );
end;
$$;

revoke all on function comun_comercio.com_fn_push_obtener_contexto_envio_staff(text, text, uuid, boolean) from public;
grant execute on function comun_comercio.com_fn_push_obtener_contexto_envio_staff(text, text, uuid, boolean) to anon, authenticated, service_role;

-- 6. RPC: Desactivar suscripción expirada (HTTP 404/410)
create or replace function comun_comercio.com_fn_push_desactivar_suscripcion(
  p_negocio text,
  p_endpoint text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
begin
  update comun_seguridad.seg_push_suscripcion
     set psu_activo = false,
         psu_eliminado_en = now(),
         psu_actualizado_en = now()
   where psu_negocio = v_negocio
     and psu_endpoint = btrim(coalesce(p_endpoint, ''));
end;
$$;

revoke all on function comun_comercio.com_fn_push_desactivar_suscripcion(text, text) from public;
grant execute on function comun_comercio.com_fn_push_desactivar_suscripcion(text, text) to anon, authenticated, service_role;

notify pgrst, 'reload schema';
