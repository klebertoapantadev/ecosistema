-- ==============================================================================
-- Migración: 20261111000002_cfg_aria_por_negocio_y_widget.sql
-- Módulo: comun_configuracion / comun_seguridad (PLT-008 / PLT-010 / ADR-0002)
-- Propósito:
--   1. Crear tabla comun_configuracion.cfg_aria (prefijo ari_) para gestionar
--      por negocio la conexión al agente conversacional de ARIA (URL base,
--      ID del agente, nombre descriptivo y estado activo).
--   2. Almacenar las credenciales secretas (ARIA_AGENT_KEY, ARIA_TENANT_KEY,
--      ARIA_GATE_KEY) exclusivamente en Supabase Vault (vault.secrets), nunca
--      en columnas en texto plano ni legibles de vuelta por la interfaz.
--   3. Restringir el descifrado (cfg_fn_obtener_aria_credenciales) únicamente
--      a service_role (Edge Function invocar-aria).
--   4. Registrar y pre-configurar el widget común configuracion_aria (/panel/aria)
--      para ADMINISTRADOR y SUPERADMIN en los 4 negocios del ecosistema.
-- ==============================================================================

create extension if not exists supabase_vault with schema vault;

grant usage on schema comun_configuracion to service_role, authenticated;

create table if not exists comun_configuracion.cfg_aria (
  ari_id uuid primary key default gen_random_uuid(),
  ari_secuencial bigint generated always as identity,
  ari_negocio text not null unique references comun_configuracion.cfg_negocio(cfg_negocio) on delete cascade,
  ari_base_url text not null default 'https://aria.midomo.site',
  ari_agente_id text,
  ari_nombre_agente text,
  ari_secreto_id uuid,
  ari_tenant_secreto_id uuid,
  ari_gate_secreto_id uuid,
  ari_activo boolean not null default false,
  ari_detalle_aria jsonb not null default '{}'::jsonb,
  ari_creado_en timestamptz not null default now(),
  ari_actualizado_en timestamptz not null default now(),
  ari_eliminado_en timestamptz
);

alter table comun_configuracion.cfg_aria enable row level security;

drop policy if exists cfg_aria_admin_lectura on comun_configuracion.cfg_aria;
create policy cfg_aria_admin_lectura on comun_configuracion.cfg_aria
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio(ari_negocio)
    or comun_seguridad.seg_fn_es_superadmin()
  );

drop trigger if exists trg_auditoria_cfg_aria on comun_configuracion.cfg_aria;
create trigger trg_auditoria_cfg_aria
  after insert or update or delete on comun_configuracion.cfg_aria
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_configuracion.cfg_aria to authenticated;

-- Helper interno para crear o actualizar un secreto nombrado en Vault de forma idempotente
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

-- ═══════════ Guardar configuración ARIA del negocio (Admin o SuperAdmin) ═══════════
create or replace function comun_configuracion.cfg_fn_guardar_aria(
  p_negocio text,
  p_base_url text,
  p_agente_id text,
  p_nombre_agente text,
  p_activo boolean,
  p_api_key text default null,
  p_tenant_key text default null,
  p_gate_key text default null,
  p_detalle jsonb default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_base_url text := regexp_replace(trim(coalesce(p_base_url, '')), '/+$', '');
  v_agente_id text := nullif(trim(coalesce(p_agente_id, '')), '');
  v_nombre text := nullif(trim(coalesce(p_nombre_agente, '')), '');
  v_secreto_id uuid;
  v_tenant_id uuid;
  v_gate_id uuid;
  v_detalle_actual jsonb;
begin
  if v_negocio = '' then
    raise exception 'Negocio inválido';
  end if;

  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado para configurar ARIA en este negocio';
  end if;

  -- Asegurar fila base en cfg_negocio si el negocio aún no fue inicializado
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values (v_negocio, initcap(v_negocio))
  on conflict (cfg_negocio) do nothing;

  select ari_secreto_id, ari_tenant_secreto_id, ari_gate_secreto_id, ari_detalle_aria
  into v_secreto_id, v_tenant_id, v_gate_id, v_detalle_actual
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  v_secreto_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_secreto_id,
    p_api_key,
    'aria_agent_key_' || v_negocio,
    'ARIA_AGENT_KEY del negocio ' || v_negocio
  );

  v_tenant_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_tenant_id,
    p_tenant_key,
    'aria_tenant_key_' || v_negocio,
    'ARIA_TENANT_KEY del negocio ' || v_negocio
  );

  v_gate_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_gate_id,
    p_gate_key,
    'aria_gate_key_' || v_negocio,
    'ARIA_GATE_KEY del negocio ' || v_negocio
  );

  if coalesce(p_activo, false) then
    if v_base_url = '' then
      raise exception 'Indica la URL base de ARIA (ARIA_BASE) antes de activar el agente';
    end if;
    if v_agente_id is null then
      raise exception 'Indica el ID del agente (ARIA_AGENT_ID) antes de activar el agente';
    end if;
    if v_secreto_id is null then
      raise exception 'Guarda la API Key del agente (ARIA_AGENT_KEY) antes de activarlo';
    end if;
  end if;

  insert into comun_configuracion.cfg_aria as a (
    ari_negocio,
    ari_base_url,
    ari_agente_id,
    ari_nombre_agente,
    ari_secreto_id,
    ari_tenant_secreto_id,
    ari_gate_secreto_id,
    ari_activo,
    ari_detalle_aria,
    ari_eliminado_en
  )
  values (
    v_negocio,
    coalesce(nullif(v_base_url, ''), 'https://aria.midomo.site'),
    v_agente_id,
    v_nombre,
    v_secreto_id,
    v_tenant_id,
    v_gate_id,
    coalesce(p_activo, false),
    coalesce(p_detalle, v_detalle_actual, '{}'::jsonb),
    null
  )
  on conflict (ari_negocio) do update set
    ari_base_url = excluded.ari_base_url,
    ari_agente_id = excluded.ari_agente_id,
    ari_nombre_agente = excluded.ari_nombre_agente,
    ari_secreto_id = coalesce(v_secreto_id, a.ari_secreto_id),
    ari_tenant_secreto_id = coalesce(v_tenant_id, a.ari_tenant_secreto_id),
    ari_gate_secreto_id = coalesce(v_gate_id, a.ari_gate_secreto_id),
    ari_activo = excluded.ari_activo,
    ari_detalle_aria = coalesce(p_detalle, a.ari_detalle_aria, '{}'::jsonb),
    ari_eliminado_en = null,
    ari_actualizado_en = now();
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_guardar_aria(text, text, text, text, boolean, text, text, text, jsonb) from public, anon;
grant execute on function comun_configuracion.cfg_fn_guardar_aria(text, text, text, text, boolean, text, text, text, jsonb) to authenticated;

-- ═══════════ Borrar claves guardadas en Vault ═══════════
create or replace function comun_configuracion.cfg_fn_borrar_aria_clave(
  p_negocio text,
  p_tipo text default 'agent'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := lower(trim(coalesce(p_negocio, '')));
  v_fila comun_configuracion.cfg_aria%rowtype;
begin
  if not (
    comun_seguridad.seg_fn_es_admin_negocio(v_negocio)
    or comun_seguridad.seg_fn_es_admin_negocio(upper(v_negocio))
    or comun_seguridad.seg_fn_es_superadmin()
  ) then
    raise exception 'No autorizado';
  end if;

  select * into v_fila
  from comun_configuracion.cfg_aria
  where ari_negocio = v_negocio;

  if not found then
    return;
  end if;

  if p_tipo in ('agent', 'todas') and v_fila.ari_secreto_id is not null then
    update comun_configuracion.cfg_aria
    set ari_secreto_id = null,
        ari_activo = false,
        ari_actualizado_en = now()
    where ari_negocio = v_negocio;
    delete from vault.secrets where id = v_fila.ari_secreto_id;
  end if;

  if p_tipo in ('tenant', 'todas') and v_fila.ari_tenant_secreto_id is not null then
    update comun_configuracion.cfg_aria
    set ari_tenant_secreto_id = null,
        ari_actualizado_en = now()
    where ari_negocio = v_negocio;
    delete from vault.secrets where id = v_fila.ari_tenant_secreto_id;
  end if;

  if p_tipo in ('gate', 'todas') and v_fila.ari_gate_secreto_id is not null then
    update comun_configuracion.cfg_aria
    set ari_gate_secreto_id = null,
        ari_actualizado_en = now()
    where ari_negocio = v_negocio;
    delete from vault.secrets where id = v_fila.ari_gate_secreto_id;
  end if;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_borrar_aria_clave(text, text) from public, anon;
grant execute on function comun_configuracion.cfg_fn_borrar_aria_clave(text, text) to authenticated;

-- ═══════════ Leer credenciales descifradas (SOLO service_role) ═══════════
create or replace function comun_configuracion.cfg_fn_obtener_aria_credenciales(p_negocio text)
returns table (
  base_url text,
  agente_id text,
  nombre_agente text,
  api_key text,
  tenant_key text,
  gate_key text,
  detalle_aria jsonb
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
    a.ari_base_url,
    a.ari_agente_id,
    a.ari_nombre_agente,
    d_agent.decrypted_secret as api_key,
    d_tenant.decrypted_secret as tenant_key,
    d_gate.decrypted_secret as gate_key,
    a.ari_detalle_aria
  from comun_configuracion.cfg_aria a
  join vault.decrypted_secrets d_agent on d_agent.id = a.ari_secreto_id
  left join vault.decrypted_secrets d_tenant on d_tenant.id = a.ari_tenant_secreto_id
  left join vault.decrypted_secrets d_gate on d_gate.id = a.ari_gate_secreto_id
  where a.ari_negocio = v_negocio
    and a.ari_activo = true
    and a.ari_eliminado_en is null
    and a.ari_base_url is not null
    and a.ari_agente_id is not null;
end;
$$;

revoke execute on function comun_configuracion.cfg_fn_obtener_aria_credenciales(text) from public;
revoke execute on function comun_configuracion.cfg_fn_obtener_aria_credenciales(text) from anon, authenticated;
grant execute on function comun_configuracion.cfg_fn_obtener_aria_credenciales(text) to service_role;

-- ═══════════ Registrar y pre-asignar el widget común configuracion_aria ═══════════
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
      'configuracion_aria',
      'Agente Conversacional ARIA',
      true,
      jsonb_build_object(
        'descripcion', 'Parámetros de conexión ARIA (ARIA_BASE, ARIA_AGENT_ID y claves en Vault) propios de este negocio.',
        'categoria', 'Integraciones',
        'ruta', '/panel/aria',
        'panel_defecto', 'panel_configuracion',
        'icono', 'Bot'
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
      and w.wdg_clave = 'configuracion_aria'
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;
  end loop;

  -- Semilla no sensible del agente Mía de Tinkay (la API Key se carga en Vault desde /panel/aria)
  insert into comun_configuracion.cfg_negocio (cfg_negocio, cfg_nombre_comercial)
  values ('tinkay', 'Tinkay Floristería')
  on conflict (cfg_negocio) do nothing;

  insert into comun_configuracion.cfg_aria (
    ari_negocio,
    ari_base_url,
    ari_agente_id,
    ari_nombre_agente,
    ari_activo
  )
  values (
    'tinkay',
    'https://aria.midomo.site',
    'c717f44a-028e-4e9c-a190-4eb0b774c588',
    'Mía — Asesora Floral',
    false
  )
  on conflict (ari_negocio) do update set
    ari_base_url = coalesce(nullif(comun_configuracion.cfg_aria.ari_base_url, ''), excluded.ari_base_url),
    ari_agente_id = coalesce(comun_configuracion.cfg_aria.ari_agente_id, excluded.ari_agente_id),
    ari_nombre_agente = coalesce(comun_configuracion.cfg_aria.ari_nombre_agente, excluded.ari_nombre_agente);
end $$;

