-- ==============================================================================
-- Migración: 20261119000008_cfg_marketing_meta_capi_catalogo_y_widget.sql
-- Módulo: comun_configuracion / comun_seguridad / comun_comercio (PLT-025)
-- Propósito:
--   1. Crear tabla comun_configuracion.cfg_marketing_meta (prefijo mkm_) con RLS
--      y auditoría obligatoria (aud_fn_auditar_tabla) para gestionar por negocio:
--      Meta Pixel ID, verificación de dominio, código de prueba CAPI y feed de
--      catálogo para Facebook, Instagram y WhatsApp Business.
--   2. Almacenar el Access Token de Meta Conversions API (CAPI) exclusivamente en
--      Supabase Vault (vault.secrets), jamás expuesto al cliente.
--   3. Proveer RPCs SECURITY DEFINER:
--      - cfg_fn_obtener_marketing_publico: lectura pública segura (sin secretos).
--      - cfg_fn_guardar_marketing_meta / cfg_fn_borrar_marketing_meta_token:
--        administración segura por negocio.
--      - cfg_fn_enviar_evento_meta_capi: despacho servidor hacia Meta Graph API
--        directamente desde PostgreSQL (pgsql-http + Vault) con validación de
--        transacción/pedido real para evitar abuso y sin requerir service_role
--        en el cliente ni variables manuales en Vercel.
--   4. Registrar y pre-configurar el widget común configuracion_marketing_meta
--      (/panel/marketing-meta) para ADMINISTRADOR y SUPERADMIN en los 4 negocios.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;

grant usage on schema comun_configuracion to anon, authenticated, service_role;

create table if not exists comun_configuracion.cfg_marketing_meta (
  mkm_id uuid primary key default gen_random_uuid(),
  mkm_secuencial bigint generated always as identity,
  mkm_negocio text not null unique references comun_configuracion.cfg_negocio(cfg_negocio) on delete cascade,
  mkm_pixel_id text,
  mkm_capi_secreto_id uuid,
  mkm_dominio_verificacion text,
  mkm_test_event_code text,
  mkm_catalogo_activo boolean not null default true,
  mkm_activo boolean not null default false,
  mkm_detalle_marketing jsonb not null default '{}'::jsonb,
  mkm_creado_en timestamptz not null default now(),
  mkm_actualizado_en timestamptz not null default now(),
  mkm_eliminado_en timestamptz
);

alter table comun_configuracion.cfg_marketing_meta enable row level security;

drop policy if exists cfg_marketing_meta_admin_lectura on comun_configuracion.cfg_marketing_meta;
create policy cfg_marketing_meta_admin_lectura on comun_configuracion.cfg_marketing_meta
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio(mkm_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(mkm_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  );

drop trigger if exists trg_auditoria_cfg_marketing_meta on comun_configuracion.cfg_marketing_meta;
create trigger trg_auditoria_cfg_marketing_meta
  after insert or update or delete on comun_configuracion.cfg_marketing_meta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_configuracion.cfg_marketing_meta to authenticated;

-- Asegurar helper de Vault idempotente por si esta migración corre aislada
create or replace function comun_configuracion.cfg_fn_upsert_vault_secreto(
  p_secreto_actual_id uuid,
  p_valor text,
  p_nombre text,
  p_descripcion text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid := p_secreto_actual_id;
begin
  if p_valor is null or trim(p_valor) = '' then
    return v_id;
  end if;

  if v_id is not null and not exists (select 1 from vault.secrets where id = v_id) then
    v_id := null;
  end if;

  if v_id is null then
    select id into v_id
    from vault.secrets
    where name = p_nombre
    limit 1;
  end if;

  if v_id is null then
    v_id := vault.create_secret(trim(p_valor), p_nombre, p_descripcion);
  else
    perform vault.update_secret(v_id, trim(p_valor));
  end if;

  return v_id;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_upsert_vault_secreto(uuid, text, text, text) from public, anon, authenticated;

-- ═══════════ 1. Lectura pública segura (sin secretos) para layout/feed ═══════════
create or replace function comun_configuracion.cfg_fn_obtener_marketing_publico(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_fila comun_configuracion.cfg_marketing_meta%rowtype;
begin
  if v_negocio = '' then
    return jsonb_build_object(
      'activo', false,
      'pixel_id', null,
      'dominio_verificacion', null,
      'catalogo_activo', true
    );
  end if;

  select * into v_fila
  from comun_configuracion.cfg_marketing_meta
  where mkm_negocio = v_negocio
    and mkm_eliminado_en is null;

  if not found then
    return jsonb_build_object(
      'activo', false,
      'pixel_id', null,
      'dominio_verificacion', null,
      'catalogo_activo', true
    );
  end if;

  return jsonb_build_object(
    'activo', coalesce(v_fila.mkm_activo, false),
    'pixel_id', v_fila.mkm_pixel_id,
    'dominio_verificacion', v_fila.mkm_dominio_verificacion,
    'catalogo_activo', coalesce(v_fila.mkm_catalogo_activo, true)
  );
end;
$$;

grant execute on function comun_configuracion.cfg_fn_obtener_marketing_publico(text) to anon, authenticated, service_role;

-- ═══════════ 2. Guardar configuración Marketing & Meta (Admin o SuperAdmin) ═══════════
create or replace function comun_configuracion.cfg_fn_guardar_marketing_meta(
  p_negocio text,
  p_pixel_id text,
  p_dominio_verificacion text,
  p_test_event_code text,
  p_catalogo_activo boolean,
  p_activo boolean,
  p_capi_token text default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_pixel text := nullif(regexp_replace(trim(coalesce(p_pixel_id, '')), '[^0-9]', '', 'g'), '');
  v_dom text := nullif(trim(coalesce(p_dominio_verificacion, '')), '');
  v_test text := nullif(trim(coalesce(p_test_event_code, '')), '');
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_secreto_id uuid;
  v_detalle_actual jsonb;
begin
  if v_negocio = '' then
    raise exception 'Negocio inválido';
  end if;

  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado para configurar Marketing & Meta en este negocio';
  end if;

  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select mkm_capi_secreto_id, mkm_detalle_marketing
  into v_secreto_id, v_detalle_actual
  from comun_configuracion.cfg_marketing_meta
  where mkm_negocio = v_negocio;

  v_secreto_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_secreto_id,
    p_capi_token,
    'meta_capi_token_' || v_negocio,
    'Meta Conversions API Access Token del negocio ' || v_negocio
  );

  if coalesce(p_activo, false) and v_pixel is null then
    raise exception 'Indica el Meta Pixel ID (solo dígitos) antes de activar la sincronización';
  end if;

  insert into comun_configuracion.cfg_marketing_meta as m (
    mkm_negocio,
    mkm_pixel_id,
    mkm_capi_secreto_id,
    mkm_dominio_verificacion,
    mkm_test_event_code,
    mkm_catalogo_activo,
    mkm_activo,
    mkm_detalle_marketing,
    mkm_eliminado_en
  )
  values (
    v_negocio,
    v_pixel,
    v_secreto_id,
    v_dom,
    v_test,
    coalesce(p_catalogo_activo, true),
    coalesce(p_activo, false),
    coalesce(p_detalle, v_detalle_actual, '{}'::jsonb),
    null
  )
  on conflict (mkm_negocio) do update set
    mkm_pixel_id = excluded.mkm_pixel_id,
    mkm_capi_secreto_id = coalesce(v_secreto_id, m.mkm_capi_secreto_id),
    mkm_dominio_verificacion = excluded.mkm_dominio_verificacion,
    mkm_test_event_code = excluded.mkm_test_event_code,
    mkm_catalogo_activo = excluded.mkm_catalogo_activo,
    mkm_activo = excluded.mkm_activo,
    mkm_detalle_marketing = coalesce(p_detalle, m.mkm_detalle_marketing, '{}'::jsonb),
    mkm_eliminado_en = null,
    mkm_actualizado_en = now();

  -- Sincronizar copia pública (sin secretos) en cfg_negocio para lecturas rápidas resilientes
  update comun_configuracion.cfg_negocio
  set cfg_detalle_configuracion = coalesce(cfg_detalle_configuracion, '{}'::jsonb) || jsonb_build_object(
    'marketing_meta', jsonb_build_object(
      'activo', coalesce(p_activo, false),
      'pixel_id', v_pixel,
      'dominio_verificacion', v_dom,
      'catalogo_activo', coalesce(p_catalogo_activo, true)
    )
  )
  where cfg_negocio = v_negocio;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_guardar_marketing_meta(text, text, text, text, boolean, boolean, text, jsonb) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_marketing_meta(text, text, text, text, boolean, boolean, text, jsonb) to authenticated, service_role;

-- ═══════════ 3. Borrar token CAPI guardado en Vault ═══════════
create or replace function comun_configuracion.cfg_fn_borrar_marketing_meta_token(
  p_negocio text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_secreto_id uuid;
begin
  if not v_es_service and not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado';
  end if;

  select mkm_capi_secreto_id into v_secreto_id
  from comun_configuracion.cfg_marketing_meta
  where mkm_negocio = v_negocio;

  if v_secreto_id is not null then
    update comun_configuracion.cfg_marketing_meta
    set mkm_capi_secreto_id = null,
        mkm_actualizado_en = now()
    where mkm_negocio = v_negocio;
    delete from vault.secrets where id = v_secreto_id;
  end if;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_borrar_marketing_meta_token(text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_borrar_marketing_meta_token(text) to authenticated, service_role;

-- ═══════════ 4. Leer credenciales CAPI descifradas (SOLO service_role) ═══════════
create or replace function comun_configuracion.cfg_fn_obtener_marketing_credenciales(
  p_negocio text
)
returns table (
  pixel_id text,
  capi_token text,
  test_event_code text,
  activo boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
begin
  return query
  select
    m.mkm_pixel_id,
    d.decrypted_secret as capi_token,
    m.mkm_test_event_code,
    m.mkm_activo
  from comun_configuracion.cfg_marketing_meta m
  join vault.decrypted_secrets d on d.id = m.mkm_capi_secreto_id
  where m.mkm_negocio = v_negocio
    and m.mkm_eliminado_en is null
    and m.mkm_pixel_id is not null;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_obtener_marketing_credenciales(text) from public, anon, authenticated;
grant execute on function comun_configuracion.cfg_fn_obtener_marketing_credenciales(text) to service_role;

-- ═══════════ 5. Despachar evento Meta Conversions API desde PostgreSQL + Vault ═══════════
create or replace function comun_configuracion.cfg_fn_enviar_evento_meta_capi(
  p_negocio text,
  p_evento jsonb,
  p_es_prueba boolean default false,
  p_test_event_code_override text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
set statement_timeout = '25s'
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_es_service boolean := coalesce(auth.role(), '') = 'service_role';
  v_es_staff boolean := false;
  v_event_name text := trim(coalesce(p_evento->>'event_name', ''));
  v_event_id text := trim(coalesce(p_evento->>'event_id', ''));
  v_pixel_id text;
  v_capi_token text;
  v_test_code text;
  v_activo boolean;
  v_autorizado_transaccion boolean := false;
  v_payload jsonb;
  v_url text;
  v_status integer;
  v_content text;
  v_resp_json jsonb;
begin
  if v_negocio = '' or p_evento is null then
    return jsonb_build_object('ok', false, 'error', 'Parámetros incompletos');
  end if;

  if not v_es_service and auth.uid() is not null then
    v_es_staff := coalesce(comun_seguridad.seg_fn_es_admin_negocio(v_negocio), false)
      or coalesce(comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio)), false)
      or coalesce(comun_seguridad.seg_fn_es_superadmin(), false)
      or coalesce(comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio), false);
  end if;

  if coalesce(p_es_prueba, false) then
    if not v_es_service and not v_es_staff then
      return jsonb_build_object('ok', false, 'error', 'Solo un administrador puede disparar eventos de prueba CAPI');
    end if;
  else
    -- Validar que eventos transaccionales públicos correspondan a una orden/pago real del negocio
    if v_es_service or v_es_staff then
      v_autorizado_transaccion := true;
    elsif v_event_id <> '' then
      select exists (
        select 1
        from comun_comercio.com_transaccion_pago t
        where lower(t.pag_negocio) = v_negocio
          and t.pag_estado = 'APROBADO'
          and (t.pag_identificador_cliente = v_event_id or t.pag_id::text = v_event_id)
      ) or exists (
        select 1
        from comun_comercio.com_proforma p
        where lower(p.prf_negocio) = v_negocio
          and (
            p.prf_id::text = v_event_id
            or coalesce(p.prf_detalle_proforma->>'codigo_orden', '') = v_event_id
            or coalesce(p.prf_detalle_proforma->>'codigo_proforma', '') = v_event_id
            or 'lead-' || p.prf_id::text = v_event_id
            or 'lead-' || coalesce(p.prf_detalle_proforma->>'codigo_proforma', '') = v_event_id
          )
      )
      into v_autorizado_transaccion;
    end if;

    if not coalesce(v_autorizado_transaccion, false) then
      return jsonb_build_object('ok', false, 'error', 'Evento no vinculado a una transacción o proforma verificada');
    end if;
  end if;

  select
    m.mkm_pixel_id,
    d.decrypted_secret,
    m.mkm_test_event_code,
    m.mkm_activo
  into v_pixel_id, v_capi_token, v_test_code, v_activo
  from comun_configuracion.cfg_marketing_meta m
  left join vault.decrypted_secrets d on d.id = m.mkm_capi_secreto_id
  where m.mkm_negocio = v_negocio
    and m.mkm_eliminado_en is null;

  if v_pixel_id is null or trim(v_pixel_id) = '' then
    return jsonb_build_object('ok', false, 'omitido', true, 'error', 'Meta Pixel ID no configurado');
  end if;

  if v_capi_token is null or trim(v_capi_token) = '' then
    return jsonb_build_object('ok', false, 'omitido', true, 'error', 'Token de Conversions API no configurado en Vault');
  end if;

  if not coalesce(p_es_prueba, false) and not coalesce(v_activo, false) then
    return jsonb_build_object('ok', false, 'omitido', true, 'error', 'Sincronización Meta desactivada para este negocio');
  end if;

  v_test_code := coalesce(nullif(trim(coalesce(p_test_event_code_override, '')), ''), nullif(trim(coalesce(v_test_code, '')), ''));

  v_payload := jsonb_build_object('data', jsonb_build_array(p_evento));
  if v_test_code is not null then
    v_payload := v_payload || jsonb_build_object('test_event_code', v_test_code);
  end if;

  v_url := 'https://graph.facebook.com/v21.0/' || trim(v_pixel_id) || '/events?access_token=' || extensions.urlencode(trim(v_capi_token));

  select status, content
  into v_status, v_content
  from extensions.http_post(
    v_url,
    v_payload::text,
    'application/json'
  );

  begin
    v_resp_json := v_content::jsonb;
  exception when others then
    v_resp_json := jsonb_build_object('raw', left(coalesce(v_content, ''), 400));
  end;

  if v_status >= 200 and v_status < 300 then
    return jsonb_build_object(
      'ok', true,
      'status', v_status,
      'event_name', v_event_name,
      'event_id', v_event_id,
      'respuesta_meta', v_resp_json
    );
  end if;

  return jsonb_build_object(
    'ok', false,
    'status', v_status,
    'error', coalesce(v_resp_json#>>'{error,message}', 'Meta Graph API rechazó el evento (' || coalesce(v_status::text, '0') || ')'),
    'respuesta_meta', v_resp_json
  );
end;
$$;

grant execute on function comun_configuracion.cfg_fn_enviar_evento_meta_capi(text, jsonb, boolean, text) to anon, authenticated, service_role;

-- ═══════════ 6. Registrar y pre-asignar widget configuracion_marketing_meta ═══════════
do $$
declare
  v_negocio text;
begin
  foreach v_negocio in array array['tranqi', 'TRANQ', 'fastfix', 'FFH', 'tinkay', 'TNK', 'margaritas', 'MRG'] loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget,
      wdg_creado_en
    )
    values (
      v_negocio,
      'configuracion_marketing_meta',
      'Marketing & Meta (Pixel / Catálogo)',
      true,
      jsonb_build_object(
        'descripcion', 'Meta Pixel, Conversions API (CAPI) en Vault, verificación de dominio, feed de catálogo Facebook/WhatsApp y atribución de campañas para ARIA.',
        'categoria', 'Integraciones',
        'ruta', '/panel/marketing-meta',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Megaphone'
      ),
      now()
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now();

    insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    select v_negocio, r.rol, w.wdg_id, true
    from comun_seguridad.seg_widget w
    cross join (values ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
    where w.wdg_negocio = v_negocio
      and w.wdg_clave = 'configuracion_marketing_meta'
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;
  end loop;
end $$;
