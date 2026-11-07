-- ==============================================================================
-- Migración: 20261002120000_tranqui_legal_prospectos_chat.sql
-- Módulo: Registro y Gestión de Contactos (Prospectos) Captados por Buddie ARIA
-- Cumple: TRQ-CRM-001 (Regla 12), LOPDP y Estándar de Integración MCP (PLT-022)
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. TABLA tranqui_legal.trq_prospecto (Contactos Captados por Asistentes de Chat)
-- ------------------------------------------------------------------------------

create table if not exists tranqui_legal.trq_prospecto (
  psp_id uuid primary key default gen_random_uuid(),
  psp_secuencial bigint generated always as identity,
  psp_negocio text not null default 'tranqi',
  psp_nombre text not null check (char_length(btrim(psp_nombre)) between 2 and 120),
  psp_whatsapp text not null,
  psp_correo text,
  psp_ciudad text,
  psp_servicio_sku text,
  psp_interes text check (psp_interes is null or char_length(psp_interes) <= 500),
  psp_canal text not null default 'buddy_web' check (psp_canal in ('buddy_web', 'whatsapp_aria', 'otro')),
  psp_autoriza_contacto boolean not null check (psp_autoriza_contacto = true),
  psp_autorizado_en timestamptz not null default now(),
  psp_estado text not null default 'NUEVO' check (psp_estado in ('NUEVO', 'CONTACTADO', 'CONVERTIDO', 'DESCARTADO')),
  psp_atendido_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  psp_atendido_en timestamptz,
  psp_detalle_prospecto jsonb not null default '{}'::jsonb,
  psp_creado_en timestamptz not null default now(),
  psp_actualizado_en timestamptz not null default now(),
  psp_eliminado_en timestamptz
);

-- Índices de búsqueda y filtrado
create index if not exists idx_trq_prospecto_whatsapp on tranqui_legal.trq_prospecto(psp_whatsapp)
  where psp_eliminado_en is null;

create index if not exists idx_trq_prospecto_estado_creado on tranqui_legal.trq_prospecto(psp_estado, psp_creado_en desc)
  where psp_eliminado_en is null;

-- Row Level Security (RLS)
alter table tranqui_legal.trq_prospecto enable row level security;

drop policy if exists trq_prospecto_staff_select on tranqui_legal.trq_prospecto;
create policy trq_prospecto_staff_select on tranqui_legal.trq_prospecto
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    or tranqui_legal.trq_fn_abogado_actual() is not null
  );

drop policy if exists trq_prospecto_staff_update on tranqui_legal.trq_prospecto;
create policy trq_prospecto_staff_update on tranqui_legal.trq_prospecto
  for update using (
    comun_seguridad.seg_fn_es_admin_negocio('tranqi')
  );

-- Permisos por rol (UPDATE restringido por columna)
grant select on tranqui_legal.trq_prospecto to authenticated;
grant update (psp_estado, psp_atendido_por, psp_atendido_en, psp_detalle_prospecto, psp_actualizado_en)
  on tranqui_legal.trq_prospecto to authenticated;

-- Auditoría
drop trigger if exists trg_auditoria_trq_prospecto on tranqui_legal.trq_prospecto;
create trigger trg_auditoria_trq_prospecto
  after insert or update or delete on tranqui_legal.trq_prospecto
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ------------------------------------------------------------------------------
-- 2. FUNCIÓN RPC TRANQUI_LEGAL.TRQ_FN_REGISTRAR_PROSPECTO
-- ------------------------------------------------------------------------------

create or replace function tranqui_legal.trq_fn_registrar_prospecto(
  p_token_texto text,
  p_nombre text,
  p_whatsapp text,
  p_autoriza_contacto boolean,
  p_correo text default null,
  p_ciudad text default null,
  p_servicio_sku text default null,
  p_interes text default null,
  p_canal text default 'buddy_web'
)
returns jsonb
language plpgsql
security definer
set search_path = tranqui_legal, comun_seguridad, public
as $$
declare
  v_validacion jsonb;
  v_token_valido boolean;
  v_negocio text;
  v_token_nombre text;
  v_digits text;
  v_whatsapp_norm text;
  v_correo_norm text;
  v_nombre_norm text;
  v_ciudad_norm text;
  v_sku_norm text;
  v_interes_norm text;
  v_canal_norm text;
  v_existente_id uuid;
  v_total_ultima_hora integer;
  v_nuevo_id uuid;
begin
  -- 1. Validar token MCP y alcance 'prospectos:crear'
  v_validacion := comun_seguridad.seg_fn_validar_token_mcp(p_token_texto, 'prospectos:crear');
  v_token_valido := coalesce((v_validacion->>'valido')::boolean, false);
  v_negocio := coalesce(v_validacion->>'negocio_id', '');
  v_token_nombre := coalesce(v_validacion->>'nombre', 'Token MCP');

  if not v_token_valido or v_negocio <> 'tranqi' then
    return jsonb_build_object('ok', false, 'error', 'no_autorizado');
  end if;

  -- 2. Validar consentimiento expreso LOPDP
  if p_autoriza_contacto is not true then
    return jsonb_build_object('ok', false, 'error', 'sin_consentimiento');
  end if;

  -- 3. Normalizar WhatsApp
  v_digits := regexp_replace(coalesce(p_whatsapp, ''), '\D', '', 'g');
  if v_digits ~ '^09[0-9]{8}$' then
    v_whatsapp_norm := '+593' || substring(v_digits from 2);
  elsif v_digits ~ '^9[0-9]{8}$' then
    -- Celular ecuatoriano escrito sin el 0 inicial.
    v_whatsapp_norm := '+593' || v_digits;
  elsif v_digits ~ '^593[0-9]+' then
    v_whatsapp_norm := '+' || v_digits;
  else
    v_whatsapp_norm := '+' || v_digits;
  end if;

  if length(regexp_replace(v_whatsapp_norm, '\D', '', 'g')) not between 8 and 15 then
    return jsonb_build_object('ok', false, 'error', 'whatsapp_invalido');
  end if;

  -- 4. Validar y normalizar Correo (si viene provisto)
  if p_correo is not null and length(btrim(p_correo)) > 0 then
    v_correo_norm := lower(btrim(p_correo));
    if v_correo_norm !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      return jsonb_build_object('ok', false, 'error', 'correo_invalido');
    end if;
  else
    v_correo_norm := null;
  end if;

  -- 5. Validar y normalizar Nombre e Interés
  v_nombre_norm := btrim(coalesce(p_nombre, ''));
  if length(v_nombre_norm) < 2 or length(v_nombre_norm) > 120 then
    return jsonb_build_object('ok', false, 'error', 'nombre_invalido');
  end if;

  v_interes_norm := case
    when p_interes is not null and length(btrim(p_interes)) > 0
    then substring(btrim(p_interes) from 1 for 500)
    else null
  end;

  v_ciudad_norm := case
    when p_ciudad is not null and length(btrim(p_ciudad)) > 0
    then btrim(p_ciudad)
    else null
  end;

  v_sku_norm := case
    when p_servicio_sku is not null and length(btrim(p_servicio_sku)) > 0
    then btrim(p_servicio_sku)
    else null
  end;

  v_canal_norm := case
    when p_canal in ('buddy_web', 'whatsapp_aria', 'otro')
    then p_canal
    else 'buddy_web'
  end;

  -- 6. Anti-duplicado (últimas 24 horas para mismo WhatsApp y estado NUEVO)
  select psp_id into v_existente_id
  from tranqui_legal.trq_prospecto
  where psp_whatsapp = v_whatsapp_norm
    and psp_estado = 'NUEVO'
    and psp_eliminado_en is null
    and psp_creado_en >= now() - interval '24 hours'
  order by psp_creado_en desc
  limit 1;

  if v_existente_id is not null then
    update tranqui_legal.trq_prospecto
    set psp_nombre = coalesce(v_nombre_norm, psp_nombre),
        psp_correo = coalesce(v_correo_norm, psp_correo),
        psp_ciudad = coalesce(v_ciudad_norm, psp_ciudad),
        psp_servicio_sku = coalesce(v_sku_norm, psp_servicio_sku),
        psp_interes = coalesce(v_interes_norm, psp_interes),
        psp_actualizado_en = now()
    where psp_id = v_existente_id;

    return jsonb_build_object('ok', true, 'id', v_existente_id, 'duplicado', true);
  end if;

  -- 7. Límite anti-abuso (máximo 30 prospectos por hora para el negocio)
  select count(*) into v_total_ultima_hora
  from tranqui_legal.trq_prospecto
  where psp_negocio = 'tranqi'
    and psp_creado_en >= now() - interval '1 hour';

  if v_total_ultima_hora >= 30 then
    return jsonb_build_object('ok', false, 'error', 'limite_excedido');
  end if;

  -- 8. Inserción del nuevo prospecto
  insert into tranqui_legal.trq_prospecto (
    psp_negocio,
    psp_nombre,
    psp_whatsapp,
    psp_correo,
    psp_ciudad,
    psp_servicio_sku,
    psp_interes,
    psp_canal,
    psp_autoriza_contacto,
    psp_autorizado_en,
    psp_estado,
    psp_detalle_prospecto,
    psp_creado_en,
    psp_actualizado_en
  ) values (
    'tranqi',
    v_nombre_norm,
    v_whatsapp_norm,
    v_correo_norm,
    v_ciudad_norm,
    v_sku_norm,
    v_interes_norm,
    v_canal_norm,
    true,
    now(),
    'NUEVO',
    jsonb_build_object('token_nombre', v_token_nombre),
    now(),
    now()
  ) returning psp_id into v_nuevo_id;

  return jsonb_build_object('ok', true, 'id', v_nuevo_id, 'duplicado', false);
end;
$$;

-- ------------------------------------------------------------------------------
-- 3. WRAPPER EN ESQUEMA PUBLIC PARA COMPATIBILIDAD POSTGREST Y PERMISOS
-- ------------------------------------------------------------------------------

create or replace function public.trq_fn_registrar_prospecto(
  p_token_texto text,
  p_nombre text,
  p_whatsapp text,
  p_autoriza_contacto boolean,
  p_correo text default null,
  p_ciudad text default null,
  p_servicio_sku text default null,
  p_interes text default null,
  p_canal text default 'buddy_web'
)
returns jsonb
language sql
security definer
set search_path = ''
as $$
  select tranqui_legal.trq_fn_registrar_prospecto(
    p_token_texto,
    p_nombre,
    p_whatsapp,
    p_autoriza_contacto,
    p_correo,
    p_ciudad,
    p_servicio_sku,
    p_interes,
    p_canal
  );
$$;

revoke all on function tranqui_legal.trq_fn_registrar_prospecto(text, text, text, boolean, text, text, text, text, text) from public;
revoke all on function public.trq_fn_registrar_prospecto(text, text, text, boolean, text, text, text, text, text) from public;

grant execute on function public.trq_fn_registrar_prospecto(text, text, text, boolean, text, text, text, text, text) to anon, authenticated;
