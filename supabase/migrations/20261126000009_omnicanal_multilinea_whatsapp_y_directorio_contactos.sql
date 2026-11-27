-- =============================================================================
-- Migración: 20261126000009_omnicanal_multilinea_whatsapp_y_directorio_contactos.sql
-- Requerimiento: PLT-010 (Multi-Línea WhatsApp Coexistencia + Directorio Consolidado
--                de Contactos Join/Merge + Privacidad Estricta RLS/Realtime/Push)
-- Descripción:
--   1. Helpers telefónicos y de privacidad por conversación en `comun_agentes`.
--   2. Tablas con RLS y auditoría obligatoria (`aud_fn_auditar_tabla()`):
--      - `comun_agentes.agc_linea_whatsapp` (`lwa_`): múltiples celulares WhatsApp por negocio
--        con modo Auto/Manual independiente para desconocidos y clientes, y política de
--        contactos personales (`IGNORAR_TOTAL` por defecto, `OCULTO_ADMIN`, `SOLO_TITULAR`).
--      - `comun_agentes.agc_contacto_directorio` (`cdo_`): Golden Record consolidado tras
--        Join/Merge por teléfono E.164.
--      - `comun_agentes.agc_contacto_fuente` (`cfu_`): trazabilidad por propietario/línea
--        y precedencia cuando 2 agendas aportan el mismo número.
--   3. Extensión aditiva y retrocompatible de `comun_agentes.agc_conversacion` + RLS estricto.
--   4. RPCs transaccionales en `comun_comercio` (esquema expuesto en PostgREST):
--      - Gestión multi-línea WhatsApp (`listar`, `guardar`, `eliminar`).
--      - Gestión de directorio consolidado (`listar`, `importar_lote`, `actualizar`, `marcar_chat_privacidad`).
--      - Actualización de despacho YCloud multi-línea, webhook YCloud (inbound + eco móvil
--        con `IGNORAR_TOTAL` y anti-bucle interno), ARIA, tablero, mensajes y Web Push.
--   5. Registro y pre-configuración por defecto del widget `directorio_contactos` (Regla 15).
-- =============================================================================

create extension if not exists supabase_vault with schema vault;
create extension if not exists http with schema extensions;
create extension if not exists pgcrypto with schema extensions;

-- =============================================================================
-- 1. HELPERS DE NORMALIZACIÓN TELEFÓNICA Y PRIVACIDAD POR CONVERSACIÓN
-- =============================================================================

create or replace function comun_agentes.agc_fn_normalizar_telefono_e164(p_telefono text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digitos text := regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g');
begin
  if v_digitos = '' then
    return '';
  end if;

  if v_digitos ~ '^00\d{8,}$' then
    v_digitos := substring(v_digitos from 3);
  end if;

  -- Ecuador móvil local: 09XXXXXXXX (10 dígitos) -> 5939XXXXXXXX
  if v_digitos ~ '^09\d{8}$' then
    v_digitos := '593' || substring(v_digitos from 2);
  -- Ecuador móvil sin 0 inicial: 9XXXXXXXX (9 dígitos) -> 5939XXXXXXXX
  elsif v_digitos ~ '^9\d{8}$' then
    v_digitos := '593' || v_digitos;
  -- Ecuador móvil antiguo pre-2012: 0[89]XXXXXXX (9 dígitos) -> 5939[89]XXXXXXX
  elsif v_digitos ~ '^0[89]\d{7}$' then
    v_digitos := '5939' || substring(v_digitos from 2);
  -- Ecuador fijo con 0 inicial: 0[2-7]XXXXXXX (9 dígitos) -> 593[2-7]XXXXXXX
  elsif v_digitos ~ '^0[2-7]\d{7}$' then
    v_digitos := '593' || substring(v_digitos from 2);
  end if;

  if length(v_digitos) < 7 then
    return '';
  end if;

  return '+' || v_digitos;
end;
$$;

create or replace function comun_agentes.agc_fn_ultimos9_telefono(p_telefono text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when length(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')) >= 9
      then right(regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g'), 9)
    else regexp_replace(coalesce(p_telefono, ''), '\D', '', 'g')
  end;
$$;

grant execute on function comun_agentes.agc_fn_normalizar_telefono_e164(text) to anon, authenticated, service_role;
grant execute on function comun_agentes.agc_fn_ultimos9_telefono(text) to anon, authenticated, service_role;

create or replace function comun_agentes.agc_fn_puede_ver_conversacion(
  p_negocio text,
  p_visibilidad text,
  p_titular_privado_id uuid,
  p_usuario_id uuid default null
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_vis text := upper(coalesce(nullif(btrim(p_visibilidad), ''), 'EQUIPO_VENTAS'));
begin
  if v_uid is null then
    return false;
  end if;

  -- Cliente propietario de un hilo comercial Web
  if p_usuario_id is not null and p_usuario_id = v_uid and v_vis = 'EQUIPO_VENTAS' then
    return true;
  end if;

  -- SuperAdmin de plataforma o propietario del negocio
  if comun_seguridad.seg_fn_es_superadmin() then
    return true;
  end if;

  if v_vis = 'SOLO_TITULAR' then
    return (p_titular_privado_id is not null and p_titular_privado_id = v_uid);
  end if;

  if v_vis = 'SOLO_ADMIN' then
    return comun_seguridad.seg_fn_es_admin_negocio_omnicanal(p_negocio);
  end if;

  -- EQUIPO_VENTAS
  return comun_seguridad.seg_fn_es_equipo_ventas_negocio(p_negocio);
end;
$$;

revoke execute on function comun_agentes.agc_fn_puede_ver_conversacion(text, text, uuid, uuid) from public;
grant execute on function comun_agentes.agc_fn_puede_ver_conversacion(text, text, uuid, uuid) to authenticated, service_role;

-- =============================================================================
-- 2. TABLA comun_agentes.agc_linea_whatsapp (MULTI-CELULAR WHATSAPP POR NEGOCIO)
-- =============================================================================

create table if not exists comun_agentes.agc_linea_whatsapp (
  lwa_id uuid primary key default gen_random_uuid(),
  lwa_secuencial bigint generated always as identity,
  lwa_negocio text not null check (lwa_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  lwa_codigo text not null,
  lwa_nombre text not null,
  lwa_rol_linea text not null default 'VENTAS'
    check (lwa_rol_linea in ('VENTAS', 'DUENO', 'ADMINISTRADORA', 'OPERADOR', 'SOPORTE', 'OTRO')),
  lwa_numero_e164 text not null,
  lwa_numero_ultimos9 text not null,
  lwa_titular_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  lwa_proveedor text not null default 'ycloud' check (lwa_proveedor in ('ycloud', 'meta_cloud')),
  lwa_es_principal boolean not null default false,
  lwa_habilitado boolean not null default true,
  lwa_ia_desconocidos_activa boolean not null default true,
  lwa_ia_clientes_activa boolean not null default true,
  lwa_politica_personales text not null default 'IGNORAR_TOTAL'
    check (lwa_politica_personales in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR')),
  lwa_visibilidad_clientes text not null default 'EQUIPO_VENTAS'
    check (lwa_visibilidad_clientes in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR')),
  lwa_ycloud_api_secreto_id uuid,
  lwa_ycloud_webhook_secreto_id uuid,
  lwa_agente_ia_id text,
  lwa_color_badge text not null default '#16A34A',
  lwa_detalle_linea jsonb not null default '{}'::jsonb,
  lwa_creado_en timestamptz not null default now(),
  lwa_actualizado_en timestamptz not null default now(),
  lwa_eliminado_en timestamptz
);

create unique index if not exists idx_agc_linea_whatsapp_negocio_codigo_unico
  on comun_agentes.agc_linea_whatsapp (lwa_negocio, lwa_codigo)
  where lwa_eliminado_en is null;

create unique index if not exists idx_agc_linea_whatsapp_negocio_numero_unico
  on comun_agentes.agc_linea_whatsapp (lwa_negocio, lwa_numero_ultimos9)
  where lwa_eliminado_en is null;

create index if not exists idx_agc_linea_whatsapp_titular
  on comun_agentes.agc_linea_whatsapp (lwa_titular_usuario_id)
  where lwa_titular_usuario_id is not null and lwa_eliminado_en is null;

alter table comun_agentes.agc_linea_whatsapp enable row level security;

drop policy if exists agc_linea_whatsapp_lectura_equipo on comun_agentes.agc_linea_whatsapp;
create policy agc_linea_whatsapp_lectura_equipo on comun_agentes.agc_linea_whatsapp
  for select using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(lwa_negocio));

drop policy if exists agc_linea_whatsapp_gestion_admin on comun_agentes.agc_linea_whatsapp;
create policy agc_linea_whatsapp_gestion_admin on comun_agentes.agc_linea_whatsapp
  for all using (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(lwa_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(lwa_negocio));

drop trigger if exists trg_auditoria_agc_linea_whatsapp on comun_agentes.agc_linea_whatsapp;
create trigger trg_auditoria_agc_linea_whatsapp
  after insert or update or delete on comun_agentes.agc_linea_whatsapp
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_linea_whatsapp to authenticated;
grant all on comun_agentes.agc_linea_whatsapp to service_role;

-- Semilla retrocompatible de la línea principal desde `cfg_aria` existente
do $$
declare
  v_a record;
  v_e164 text;
  v_u9 text;
  v_ia_auto boolean;
begin
  for v_a in
    select a.ari_negocio, a.ari_detalle_aria
    from comun_configuracion.cfg_aria a
    where a.ari_eliminado_en is null
      and a.ari_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas')
  loop
    v_e164 := comun_agentes.agc_fn_normalizar_telefono_e164(
      coalesce(
        nullif(btrim(v_a.ari_detalle_aria->>'ycloud_numero_emisor'), ''),
        case when v_a.ari_negocio = 'tinkay' then '+593996438873' else '' end
      )
    );
    if v_e164 = '' then
      continue;
    end if;
    v_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_e164);
    v_ia_auto := not coalesce((v_a.ari_detalle_aria->>'ycloud_modo_manual_defecto')::boolean, false);

    if not exists (
      select 1 from comun_agentes.agc_linea_whatsapp
      where lwa_negocio = v_a.ari_negocio
        and (lwa_es_principal = true or lwa_numero_ultimos9 = v_u9)
        and lwa_eliminado_en is null
    ) then
      insert into comun_agentes.agc_linea_whatsapp (
        lwa_negocio, lwa_codigo, lwa_nombre, lwa_rol_linea,
        lwa_numero_e164, lwa_numero_ultimos9,
        lwa_es_principal, lwa_habilitado,
        lwa_ia_desconocidos_activa, lwa_ia_clientes_activa,
        lwa_politica_personales, lwa_visibilidad_clientes,
        lwa_color_badge, lwa_detalle_linea
      ) values (
        v_a.ari_negocio, 'ventas', 'WhatsApp Ventas (Principal)', 'VENTAS',
        v_e164, v_u9,
        true, true,
        v_ia_auto, v_ia_auto,
        'IGNORAR_TOTAL', 'EQUIPO_VENTAS',
        '#16A34A', jsonb_build_object('origen_semilla', 'cfg_aria')
      );
    end if;
  end loop;
end $$;

-- =============================================================================
-- 3. TABLA comun_agentes.agc_contacto_directorio (GOLDEN RECORD CONSOLIDADO)
-- =============================================================================

create table if not exists comun_agentes.agc_contacto_directorio (
  cdo_id uuid primary key default gen_random_uuid(),
  cdo_secuencial bigint generated always as identity,
  cdo_negocio text not null check (cdo_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cdo_telefono_e164 text not null,
  cdo_telefono_ultimos9 text not null,
  cdo_nombre_consolidado text not null,
  cdo_correo text,
  cdo_clasificacion text not null default 'PERSONAL'
    check (cdo_clasificacion in ('PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM')),
  cdo_politica_ia text not null default 'SIEMPRE_MANUAL'
    check (cdo_politica_ia in ('SIEMPRE_MANUAL', 'AUTO_IA', 'SEGUN_LINEA')),
  cdo_visibilidad text not null default 'IGNORAR_TOTAL'
    check (cdo_visibilidad in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR', 'IGNORAR_TOTAL')),
  cdo_titular_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cdo_cliente_id uuid references comun_comercio.com_cliente(cli_id) on delete set null,
  cdo_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cdo_detalle_contacto jsonb not null default '{}'::jsonb,
  cdo_creado_en timestamptz not null default now(),
  cdo_actualizado_en timestamptz not null default now(),
  cdo_eliminado_en timestamptz
);

create unique index if not exists idx_agc_contacto_directorio_negocio_tel_unico
  on comun_agentes.agc_contacto_directorio (cdo_negocio, cdo_telefono_ultimos9)
  where cdo_eliminado_en is null;

create index if not exists idx_agc_contacto_directorio_clasificacion
  on comun_agentes.agc_contacto_directorio (cdo_negocio, cdo_clasificacion)
  where cdo_eliminado_en is null;

create index if not exists idx_agc_contacto_directorio_cliente
  on comun_agentes.agc_contacto_directorio (cdo_cliente_id)
  where cdo_cliente_id is not null and cdo_eliminado_en is null;

create index if not exists idx_agc_contacto_directorio_titular
  on comun_agentes.agc_contacto_directorio (cdo_titular_usuario_id)
  where cdo_titular_usuario_id is not null and cdo_eliminado_en is null;

alter table comun_agentes.agc_contacto_directorio enable row level security;

drop policy if exists agc_contacto_directorio_lectura on comun_agentes.agc_contacto_directorio;
create policy agc_contacto_directorio_lectura on comun_agentes.agc_contacto_directorio
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cdo_negocio)
    or (
      auth.uid() is not null
      and cdo_titular_usuario_id = auth.uid()
      and comun_seguridad.seg_fn_es_equipo_ventas_negocio(cdo_negocio)
    )
    or (
      comun_seguridad.seg_fn_es_equipo_ventas_negocio(cdo_negocio)
      and cdo_clasificacion = 'CLIENTE'
      and cdo_visibilidad = 'EQUIPO_VENTAS'
    )
  );

drop policy if exists agc_contacto_directorio_gestion_admin on comun_agentes.agc_contacto_directorio;
create policy agc_contacto_directorio_gestion_admin on comun_agentes.agc_contacto_directorio
  for all using (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cdo_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cdo_negocio));

drop trigger if exists trg_auditoria_agc_contacto_directorio on comun_agentes.agc_contacto_directorio;
create trigger trg_auditoria_agc_contacto_directorio
  after insert or update or delete on comun_agentes.agc_contacto_directorio
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_contacto_directorio to authenticated;
grant all on comun_agentes.agc_contacto_directorio to service_role;

-- =============================================================================
-- 4. TABLA comun_agentes.agc_contacto_fuente (TRAZABILIDAD POR PROPIETARIO / LÍNEA)
-- =============================================================================

create table if not exists comun_agentes.agc_contacto_fuente (
  cfu_id uuid primary key default gen_random_uuid(),
  cfu_secuencial bigint generated always as identity,
  cfu_negocio text not null check (cfu_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cfu_contacto_id uuid not null references comun_agentes.agc_contacto_directorio(cdo_id) on delete cascade,
  cfu_propietario_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cfu_linea_whatsapp_id uuid references comun_agentes.agc_linea_whatsapp(lwa_id) on delete set null,
  cfu_origen text not null default 'VCF'
    check (cfu_origen in ('VCF', 'CSV', 'XLSX', 'CONTACT_PICKER', 'GOOGLE_CONTACTS', 'CRM', 'MANUAL_CHAT', 'LISTA_IGNORAR')),
  cfu_nombre_original text not null,
  cfu_clasificacion_origen text not null default 'PERSONAL'
    check (cfu_clasificacion_origen in ('PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM')),
  cfu_politica_personal text not null default 'IGNORAR_TOTAL'
    check (cfu_politica_personal in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR', 'EQUIPO_VENTAS')),
  cfu_detalle_fuente jsonb not null default '{}'::jsonb,
  cfu_creado_en timestamptz not null default now(),
  cfu_actualizado_en timestamptz not null default now(),
  cfu_eliminado_en timestamptz
);

create index if not exists idx_agc_contacto_fuente_contacto
  on comun_agentes.agc_contacto_fuente (cfu_contacto_id)
  where cfu_eliminado_en is null;

create index if not exists idx_agc_contacto_fuente_linea
  on comun_agentes.agc_contacto_fuente (cfu_negocio, cfu_linea_whatsapp_id, cfu_contacto_id)
  where cfu_eliminado_en is null;

create index if not exists idx_agc_contacto_fuente_propietario
  on comun_agentes.agc_contacto_fuente (cfu_propietario_usuario_id)
  where cfu_propietario_usuario_id is not null and cfu_eliminado_en is null;

create unique index if not exists idx_agc_contacto_fuente_unico_linea_prop
  on comun_agentes.agc_contacto_fuente (
    cfu_contacto_id,
    coalesce(cfu_linea_whatsapp_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(cfu_propietario_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid)
  )
  where cfu_eliminado_en is null;

alter table comun_agentes.agc_contacto_fuente enable row level security;

drop policy if exists agc_contacto_fuente_lectura on comun_agentes.agc_contacto_fuente;
create policy agc_contacto_fuente_lectura on comun_agentes.agc_contacto_fuente
  for select using (
    comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cfu_negocio)
    or (auth.uid() is not null and cfu_propietario_usuario_id = auth.uid())
  );

drop policy if exists agc_contacto_fuente_gestion_admin on comun_agentes.agc_contacto_fuente;
create policy agc_contacto_fuente_gestion_admin on comun_agentes.agc_contacto_fuente
  for all using (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cfu_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio_omnicanal(cfu_negocio));

drop trigger if exists trg_auditoria_agc_contacto_fuente on comun_agentes.agc_contacto_fuente;
create trigger trg_auditoria_agc_contacto_fuente
  after insert or update or delete on comun_agentes.agc_contacto_fuente
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_contacto_fuente to authenticated;
grant all on comun_agentes.agc_contacto_fuente to service_role;

-- =============================================================================
-- 5. EXTENSIÓN ADITIVA Y BLINDAJE RLS DE comun_agentes.agc_conversacion / agc_mensaje
-- =============================================================================

alter table comun_agentes.agc_conversacion
  add column if not exists cnv_linea_whatsapp_id uuid references comun_agentes.agc_linea_whatsapp(lwa_id) on delete set null,
  add column if not exists cnv_visibilidad text not null default 'EQUIPO_VENTAS'
    check (cnv_visibilidad in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR')),
  add column if not exists cnv_titular_privado_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  add column if not exists cnv_contacto_directorio_id uuid references comun_agentes.agc_contacto_directorio(cdo_id) on delete set null,
  add column if not exists cnv_ia_bloqueada_permanente boolean not null default false;

create index if not exists idx_agc_conversacion_visibilidad_bandeja
  on comun_agentes.agc_conversacion (cnv_negocio, cnv_visibilidad, cnv_ultimo_mensaje_en desc)
  where cnv_eliminado_en is null;

create index if not exists idx_agc_conversacion_linea_whatsapp
  on comun_agentes.agc_conversacion (cnv_linea_whatsapp_id)
  where cnv_linea_whatsapp_id is not null and cnv_eliminado_en is null;

-- Backfill de conversaciones WhatsApp previas hacia la línea principal del negocio
update comun_agentes.agc_conversacion c
   set cnv_linea_whatsapp_id = l.lwa_id
  from comun_agentes.agc_linea_whatsapp l
 where c.cnv_canal = 'whatsapp'
   and c.cnv_linea_whatsapp_id is null
   and c.cnv_eliminado_en is null
   and l.lwa_negocio = c.cnv_negocio
   and l.lwa_es_principal = true
   and l.lwa_eliminado_en is null;

-- Blindar RLS de `agc_conversacion` y `agc_mensaje` según visibilidad (preservando Chat Equipo `interno`)
drop policy if exists agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion
  for select using (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else comun_agentes.agc_fn_puede_ver_conversacion(
        cnv_negocio,
        cnv_visibilidad,
        cnv_titular_privado_id,
        cnv_usuario_id
      )
    end
  );

drop policy if exists agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion
  for all using (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else comun_agentes.agc_fn_puede_ver_conversacion(
        cnv_negocio,
        cnv_visibilidad,
        cnv_titular_privado_id,
        null::uuid
      )
    end
  ) with check (
    case
      when cnv_canal = 'interno' then comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cnv_negocio)
      else comun_agentes.agc_fn_puede_ver_conversacion(
        cnv_negocio,
        cnv_visibilidad,
        cnv_titular_privado_id,
        null::uuid
      )
    end
  );

drop policy if exists agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje
  for select using (
    exists (
      select 1 from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (
            c.cnv_canal <> 'interno'
            and comun_agentes.agc_fn_puede_ver_conversacion(
              c.cnv_negocio,
              c.cnv_visibilidad,
              c.cnv_titular_privado_id,
              case when msg_origen <> 'NOTA_INTERNA' then c.cnv_usuario_id else null::uuid end
            )
          )
        )
    )
  );

drop policy if exists agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje
  for all using (
    exists (
      select 1 from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (
            c.cnv_canal <> 'interno'
            and comun_agentes.agc_fn_puede_ver_conversacion(
              c.cnv_negocio,
              c.cnv_visibilidad,
              c.cnv_titular_privado_id,
              null::uuid
            )
          )
        )
    )
  ) with check (
    exists (
      select 1 from comun_agentes.agc_conversacion c
      where c.cnv_id = msg_conversacion_id
        and (
          (c.cnv_canal = 'interno' and comun_seguridad.seg_fn_es_delivery_o_staff_negocio(c.cnv_negocio))
          or (
            c.cnv_canal <> 'interno'
            and comun_agentes.agc_fn_puede_ver_conversacion(
              c.cnv_negocio,
              c.cnv_visibilidad,
              c.cnv_titular_privado_id,
              null::uuid
            )
          )
        )
    )
  );

-- =============================================================================
-- 6. RPCs DE GESTIÓN MULTI-LÍNEA WHATSAPP (EXPUESTAS EN comun_comercio)
-- =============================================================================

create or replace function comun_comercio.com_fn_omnicanal_listar_lineas_whatsapp(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_es_admin boolean := false;
  v_lineas jsonb;
  v_equipo jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo del negocio.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select coalesce(jsonb_agg(to_jsonb(sub) order by sub."esPrincipal" desc, sub."creadoEn" asc), '[]'::jsonb)
  into v_lineas
  from (
    select
      l.lwa_id as "id",
      l.lwa_codigo as "codigo",
      l.lwa_nombre as "nombre",
      l.lwa_rol_linea as "rolLinea",
      l.lwa_numero_e164 as "numeroE164",
      l.lwa_titular_usuario_id as "titularUsuarioId",
      coalesce(
        nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
        u.usu_correo
      ) as "titularNombre",
      l.lwa_proveedor as "proveedor",
      l.lwa_es_principal as "esPrincipal",
      l.lwa_habilitado as "habilitado",
      l.lwa_ia_desconocidos_activa as "iaDesconocidosActiva",
      l.lwa_ia_clientes_activa as "iaClientesActiva",
      l.lwa_politica_personales as "politicaPersonales",
      l.lwa_visibilidad_clientes as "visibilidadClientes",
      l.lwa_agente_ia_id as "agenteIaId",
      l.lwa_color_badge as "colorBadge",
      (l.lwa_ycloud_api_secreto_id is not null) as "tieneApiKeyPropia",
      (l.lwa_ycloud_webhook_secreto_id is not null) as "tieneWebhookSecretPropio",
      coalesce((
        select count(*)
        from comun_agentes.agc_contacto_fuente cf
        where cf.cfu_linea_whatsapp_id = l.lwa_id
          and cf.cfu_eliminado_en is null
      ), 0) as "totalContactosAportados",
      coalesce((
        select count(*)
        from comun_agentes.agc_contacto_fuente cf
        where cf.cfu_linea_whatsapp_id = l.lwa_id
          and cf.cfu_clasificacion_origen = 'PERSONAL'
          and cf.cfu_eliminado_en is null
      ), 0) as "totalPersonalesAportados",
      l.lwa_creado_en as "creadoEn",
      l.lwa_actualizado_en as "actualizadoEn"
    from comun_agentes.agc_linea_whatsapp l
    left join comun_seguridad.seg_usuario u on u.usu_id = l.lwa_titular_usuario_id
    where l.lwa_negocio = v_negocio
      and l.lwa_eliminado_en is null
  ) sub;

  select coalesce(jsonb_agg(to_jsonb(eq) order by eq."nombre" asc), '[]'::jsonb)
  into v_equipo
  from (
    select distinct on (u.usu_id)
      u.usu_id as "usuarioId",
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo) as "nombre",
      u.usu_correo as "correo",
      coalesce(p.per_clave, m.mem_rol, 'OPERADOR') as "rol"
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and u.usu_eliminado_en is null
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
      and (
        u.usu_superadmin_plataforma
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) eq;

  return jsonb_build_object(
    'ok', true,
    'esAdmin', v_es_admin,
    'lineas', v_lineas,
    'equipo', v_equipo
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_listar_lineas_whatsapp(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_listar_lineas_whatsapp(text) to authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_guardar_linea_whatsapp(
  p_negocio text,
  p_linea_id uuid default null,
  p_codigo text default null,
  p_nombre text default null,
  p_rol_linea text default 'VENTAS',
  p_numero_e164 text default null,
  p_titular_usuario_id uuid default null,
  p_es_principal boolean default false,
  p_habilitado boolean default true,
  p_ia_desconocidos_activa boolean default false,
  p_ia_clientes_activa boolean default true,
  p_politica_personales text default 'IGNORAR_TOTAL',
  p_visibilidad_clientes text default 'EQUIPO_VENTAS',
  p_color_badge text default '#16A34A',
  p_agente_ia_id text default null,
  p_ycloud_api_key text default null,
  p_ycloud_webhook_secret text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_nombre text := left(btrim(coalesce(p_nombre, '')), 100);
  v_rol text := upper(btrim(coalesce(p_rol_linea, 'VENTAS')));
  v_e164 text := comun_agentes.agc_fn_normalizar_telefono_e164(p_numero_e164);
  v_u9 text := comun_agentes.agc_fn_ultimos9_telefono(v_e164);
  v_codigo text;
  v_pol_per text := upper(btrim(coalesce(p_politica_personales, 'IGNORAR_TOTAL')));
  v_vis_cli text := upper(btrim(coalesce(p_visibilidad_clientes, 'EQUIPO_VENTAS')));
  v_color text := coalesce(nullif(btrim(coalesce(p_color_badge, '')), ''), '#16A34A');
  v_prev comun_agentes.agc_linea_whatsapp;
  v_api_sec_id uuid;
  v_wh_sec_id uuid;
  v_guardada comun_agentes.agc_linea_whatsapp;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede configurar líneas WhatsApp.');
  end if;

  if v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'Indica un nombre descriptivo para la línea (ej. Celular Dueño, WhatsApp Ventas).');
  end if;

  if v_e164 = '' or length(v_u9) < 8 then
    return jsonb_build_object('ok', false, 'error', 'Ingresa un número de WhatsApp válido en formato E.164 (ej. +593996438873).');
  end if;

  if v_rol not in ('VENTAS', 'DUENO', 'ADMINISTRADORA', 'OPERADOR', 'SOPORTE', 'OTRO') then
    v_rol := 'OTRO';
  end if;

  if v_pol_per not in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR') then
    v_pol_per := 'IGNORAR_TOTAL';
  end if;

  if v_vis_cli not in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR') then
    v_vis_cli := 'EQUIPO_VENTAS';
  end if;

  v_codigo := lower(regexp_replace(
    coalesce(nullif(btrim(p_codigo), ''), v_rol || '_' || right(v_u9, 4)),
    '[^a-z0-9_-]+', '_', 'g'
  ));
  v_codigo := left(trim(both '_' from v_codigo), 40);
  if v_codigo = '' then
    v_codigo := 'linea_' || right(v_u9, 4);
  end if;

  if p_linea_id is not null then
    select * into v_prev
    from comun_agentes.agc_linea_whatsapp
    where lwa_id = p_linea_id
      and lwa_negocio = v_negocio
      and lwa_eliminado_en is null;
  else
    select * into v_prev
    from comun_agentes.agc_linea_whatsapp
    where lwa_negocio = v_negocio
      and lwa_numero_ultimos9 = v_u9
      and lwa_eliminado_en is null
    limit 1;
  end if;

  if exists (
    select 1 from comun_agentes.agc_linea_whatsapp l
    where l.lwa_negocio = v_negocio
      and l.lwa_eliminado_en is null
      and (l.lwa_numero_ultimos9 = v_u9 or l.lwa_codigo = v_codigo)
      and (v_prev.lwa_id is null or l.lwa_id <> v_prev.lwa_id)
  ) then
    return jsonb_build_object('ok', false, 'error', 'Ya existe otra línea activa con ese mismo número o código en este negocio.');
  end if;

  v_api_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_prev.lwa_ycloud_api_secreto_id,
    p_ycloud_api_key,
    'ycloud_api_key_' || v_negocio || '_' || v_codigo,
    'YCloud API Key dedicada para línea ' || v_nombre || ' (' || v_negocio || ')'
  );

  v_wh_sec_id := comun_configuracion.cfg_fn_upsert_vault_secreto(
    v_prev.lwa_ycloud_webhook_secreto_id,
    p_ycloud_webhook_secret,
    'ycloud_wh_sec_' || v_negocio || '_' || v_codigo,
    'YCloud Webhook Secret dedicado para línea ' || v_nombre || ' (' || v_negocio || ')'
  );

  if coalesce(p_es_principal, false) then
    update comun_agentes.agc_linea_whatsapp
       set lwa_es_principal = false,
           lwa_actualizado_en = now()
     where lwa_negocio = v_negocio
       and lwa_eliminado_en is null
       and (v_prev.lwa_id is null or lwa_id <> v_prev.lwa_id);
  end if;

  if v_prev.lwa_id is not null then
    update comun_agentes.agc_linea_whatsapp
       set lwa_codigo = v_codigo,
           lwa_nombre = v_nombre,
           lwa_rol_linea = v_rol,
           lwa_numero_e164 = v_e164,
           lwa_numero_ultimos9 = v_u9,
           lwa_titular_usuario_id = p_titular_usuario_id,
           lwa_es_principal = coalesce(p_es_principal, lwa_es_principal),
           lwa_habilitado = coalesce(p_habilitado, true),
           lwa_ia_desconocidos_activa = coalesce(p_ia_desconocidos_activa, false),
           lwa_ia_clientes_activa = coalesce(p_ia_clientes_activa, true),
           lwa_politica_personales = v_pol_per,
           lwa_visibilidad_clientes = v_vis_cli,
           lwa_color_badge = v_color,
           lwa_agente_ia_id = nullif(btrim(coalesce(p_agente_ia_id, '')), ''),
           lwa_ycloud_api_secreto_id = v_api_sec_id,
           lwa_ycloud_webhook_secreto_id = v_wh_sec_id,
           lwa_actualizado_en = now()
     where lwa_id = v_prev.lwa_id
     returning * into v_guardada;
  else
    insert into comun_agentes.agc_linea_whatsapp (
      lwa_negocio, lwa_codigo, lwa_nombre, lwa_rol_linea,
      lwa_numero_e164, lwa_numero_ultimos9, lwa_titular_usuario_id,
      lwa_es_principal, lwa_habilitado,
      lwa_ia_desconocidos_activa, lwa_ia_clientes_activa,
      lwa_politica_personales, lwa_visibilidad_clientes,
      lwa_color_badge, lwa_agente_ia_id,
      lwa_ycloud_api_secreto_id, lwa_ycloud_webhook_secreto_id
    ) values (
      v_negocio, v_codigo, v_nombre, v_rol,
      v_e164, v_u9, p_titular_usuario_id,
      coalesce(p_es_principal, false) or not exists (
        select 1 from comun_agentes.agc_linea_whatsapp
        where lwa_negocio = v_negocio and lwa_es_principal = true and lwa_eliminado_en is null
      ),
      coalesce(p_habilitado, true),
      coalesce(p_ia_desconocidos_activa, false),
      coalesce(p_ia_clientes_activa, true),
      v_pol_per, v_vis_cli,
      v_color, nullif(btrim(coalesce(p_agente_ia_id, '')), ''),
      v_api_sec_id, v_wh_sec_id
    )
    returning * into v_guardada;
  end if;

  -- Si es línea principal, mantener sincronizado cfg_aria para retrocompatibilidad
  if v_guardada.lwa_es_principal then
    update comun_configuracion.cfg_aria
       set ari_detalle_aria = coalesce(ari_detalle_aria, '{}'::jsonb) || jsonb_build_object(
             'ycloud_numero_emisor', v_guardada.lwa_numero_e164,
             'ycloud_modo_manual_defecto', (not v_guardada.lwa_ia_desconocidos_activa)
           ),
           ari_actualizado_en = now()
     where ari_negocio = v_negocio
       and ari_eliminado_en is null;
  end if;

  return jsonb_build_object(
    'ok', true,
    'lineaId', v_guardada.lwa_id,
    'codigo', v_guardada.lwa_codigo,
    'numeroE164', v_guardada.lwa_numero_e164,
    'esPrincipal', v_guardada.lwa_es_principal
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_linea_whatsapp(text, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, text, text, text, text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_linea_whatsapp(text, uuid, text, text, text, text, uuid, boolean, boolean, boolean, boolean, text, text, text, text, text, text) to authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_eliminar_linea_whatsapp(
  p_negocio text,
  p_linea_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_linea comun_agentes.agc_linea_whatsapp;
  v_otras int := 0;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador o SuperAdmin puede eliminar líneas WhatsApp.');
  end if;

  select * into v_linea
  from comun_agentes.agc_linea_whatsapp
  where lwa_id = p_linea_id
    and lwa_negocio = v_negocio
    and lwa_eliminado_en is null;

  if v_linea.lwa_id is null then
    return jsonb_build_object('ok', false, 'error', 'Línea no encontrada.');
  end if;

  select count(*) into v_otras
  from comun_agentes.agc_linea_whatsapp
  where lwa_negocio = v_negocio
    and lwa_id <> p_linea_id
    and lwa_eliminado_en is null;

  if v_linea.lwa_es_principal and v_otras = 0 then
    return jsonb_build_object('ok', false, 'error', 'No puedes eliminar la única línea principal del negocio. Edítala o agrega otra primero.');
  end if;

  update comun_agentes.agc_linea_whatsapp
     set lwa_eliminado_en = now(),
         lwa_habilitado = false,
         lwa_es_principal = false,
         lwa_actualizado_en = now()
   where lwa_id = p_linea_id;

  if v_linea.lwa_es_principal then
    update comun_agentes.agc_linea_whatsapp
       set lwa_es_principal = true,
           lwa_actualizado_en = now()
     where lwa_id = (
       select lwa_id from comun_agentes.agc_linea_whatsapp
       where lwa_negocio = v_negocio and lwa_eliminado_en is null
       order by lwa_creado_en asc
       limit 1
     );
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_eliminar_linea_whatsapp(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_eliminar_linea_whatsapp(text, uuid) to authenticated, service_role;

-- =============================================================================
-- 7. RPCs DE DIRECTORIO CONSOLIDADO DE CONTACTOS (JOIN/MERGE + PRIVACIDAD)
-- =============================================================================

create or replace function comun_comercio.com_fn_omnicanal_listar_directorio_contactos(
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
  v_contactos jsonb;
  v_crm_semilla jsonb;
  v_lineas jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo del negocio.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select coalesce(jsonb_agg(to_jsonb(sub) order by sub."actualizadoEn" desc), '[]'::jsonb)
  into v_contactos
  from (
    select
      c.cdo_id as "id",
      c.cdo_secuencial as "secuencial",
      c.cdo_telefono_e164 as "telefonoE164",
      c.cdo_telefono_ultimos9 as "telefonoUltimos9",
      c.cdo_nombre_consolidado as "nombreConsolidado",
      c.cdo_correo as "correo",
      c.cdo_clasificacion as "clasificacion",
      c.cdo_politica_ia as "politicaIa",
      c.cdo_visibilidad as "visibilidad",
      c.cdo_titular_usuario_id as "titularUsuarioId",
      coalesce(
        nullif(btrim(coalesce(ut.usu_nombres, '') || ' ' || coalesce(ut.usu_apellidos, '')), ''),
        ut.usu_correo
      ) as "titularNombre",
      c.cdo_cliente_id as "clienteId",
      c.cdo_usuario_id as "usuarioId",
      coalesce(cl.cli_total_compras, 0) as "totalComprasCrm",
      coalesce(cl.cli_monto_acumulado, 0) as "montoAcumuladoCrm",
      coalesce(c.cdo_detalle_contacto, '{}'::jsonb) as "detalle",
      coalesce((
        select jsonb_agg(
          jsonb_build_object(
            'id', f.cfu_id,
            'origen', f.cfu_origen,
            'nombreOriginal', f.cfu_nombre_original,
            'clasificacionOrigen', f.cfu_clasificacion_origen,
            'politicaPersonal', f.cfu_politica_personal,
            'lineaWhatsappId', f.cfu_linea_whatsapp_id,
            'lineaNombre', lw.lwa_nombre,
            'propietarioUsuarioId', f.cfu_propietario_usuario_id,
            'propietarioNombre', coalesce(
              nullif(btrim(coalesce(up.usu_nombres, '') || ' ' || coalesce(up.usu_apellidos, '')), ''),
              up.usu_correo
            ),
            'creadoEn', f.cfu_creado_en
          ) order by f.cfu_actualizado_en desc
        )
        from comun_agentes.agc_contacto_fuente f
        left join comun_agentes.agc_linea_whatsapp lw on lw.lwa_id = f.cfu_linea_whatsapp_id
        left join comun_seguridad.seg_usuario up on up.usu_id = f.cfu_propietario_usuario_id
        where f.cfu_contacto_id = c.cdo_id
          and f.cfu_eliminado_en is null
          and (v_es_admin or f.cfu_propietario_usuario_id = v_uid)
      ), '[]'::jsonb) as "fuentes",
      c.cdo_creado_en as "creadoEn",
      c.cdo_actualizado_en as "actualizadoEn"
    from comun_agentes.agc_contacto_directorio c
    left join comun_seguridad.seg_usuario ut on ut.usu_id = c.cdo_titular_usuario_id
    left join comun_comercio.com_cliente cl on cl.cli_id = c.cdo_cliente_id
    where c.cdo_negocio = v_negocio
      and c.cdo_eliminado_en is null
      and (
        v_es_admin
        or c.cdo_titular_usuario_id = v_uid
        or exists (
          select 1 from comun_agentes.agc_contacto_fuente f2
          where f2.cfu_contacto_id = c.cdo_id
            and f2.cfu_propietario_usuario_id = v_uid
            and f2.cfu_eliminado_en is null
        )
        or (c.cdo_clasificacion = 'CLIENTE' and c.cdo_visibilidad = 'EQUIPO_VENTAS')
      )
  ) sub;

  -- Semilla CRM y chats existentes para el botón "Cruzar con CRM / Compras / Chats" del Join/Merge
  select coalesce(jsonb_agg(to_jsonb(crm)), '[]'::jsonb)
  into v_crm_semilla
  from (
    select distinct on (u9)
      u9 as "telefonoUltimos9",
      e164 as "telefonoE164",
      nombre as "nombre",
      correo as "correo",
      total_compras as "totalCompras",
      monto_acumulado as "montoAcumulado",
      origen as "origen",
      cliente_id as "clienteId",
      usuario_id as "usuarioId"
    from (
      select
        comun_agentes.agc_fn_ultimos9_telefono(cl.cli_telefono) as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(cl.cli_telefono) as e164,
        coalesce(nullif(btrim(coalesce(cl.cli_detalle_cliente->'ficha_cliente'->>'nombrePersonalizado', '')), ''), cl.cli_nombre) as nombre,
        cl.cli_correo as correo,
        coalesce(cl.cli_total_compras, 0) as total_compras,
        coalesce(cl.cli_monto_acumulado, 0) as monto_acumulado,
        'CRM_COMPRAS' as origen,
        cl.cli_id as cliente_id,
        cl.cli_usuario_id as usuario_id,
        1 as prioridad
      from comun_comercio.com_cliente cl
      where cl.cli_negocio = v_negocio
        and cl.cli_eliminado_en is null
        and length(comun_agentes.agc_fn_ultimos9_telefono(cl.cli_telefono)) >= 8

      union all

      select
        comun_agentes.agc_fn_ultimos9_telefono(ot.ota_cliente_telefono) as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(ot.ota_cliente_telefono) as e164,
        coalesce(nullif(btrim(ot.ota_cliente_solicita), ''), 'Cliente Pedido') as nombre,
        null::text as correo,
        count(*)::integer as total_compras,
        coalesce(sum(ot.ota_total_usd), 0)::numeric as monto_acumulado,
        'ORDEN_TALLER' as origen,
        null::uuid as cliente_id,
        null::uuid as usuario_id,
        1 as prioridad
      from comun_comercio.com_orden_taller ot
      where ot.ota_negocio = v_negocio
        and ot.ota_eliminado_en is null
        and length(comun_agentes.agc_fn_ultimos9_telefono(ot.ota_cliente_telefono)) >= 8
      group by 1, 2, 3

      union all

      select
        comun_agentes.agc_fn_ultimos9_telefono(pr.prf_cliente_contacto->>'telefono') as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(pr.prf_cliente_contacto->>'telefono') as e164,
        coalesce(nullif(btrim(pr.prf_cliente_nombre), ''), nullif(btrim(pr.prf_cliente_contacto->>'nombreCompleto'), ''), 'Cliente Proforma') as nombre,
        nullif(lower(btrim(coalesce(pr.prf_cliente_contacto->>'correo', ''))), '') as correo,
        count(*)::integer as total_compras,
        coalesce(sum(pr.prf_total), 0)::numeric as monto_acumulado,
        'PROFORMA' as origen,
        pr.prf_cliente_id as cliente_id,
        null::uuid as usuario_id,
        1 as prioridad
      from comun_comercio.com_proforma pr
      where pr.prf_negocio = v_negocio
        and pr.prf_eliminado_en is null
        and length(comun_agentes.agc_fn_ultimos9_telefono(pr.prf_cliente_contacto->>'telefono')) >= 8
      group by 1, 2, 3, 4, 8

      union all

      select
        comun_agentes.agc_fn_ultimos9_telefono(pg.pag_titular_telefono) as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(pg.pag_titular_telefono) as e164,
        coalesce(nullif(btrim(pg.pag_titular_email), ''), 'Cliente Pago Web') as nombre,
        nullif(lower(btrim(coalesce(pg.pag_titular_email, ''))), '') as correo,
        count(*)::integer as total_compras,
        coalesce(sum(pg.pag_monto_total), 0)::numeric as monto_acumulado,
        'PAGO_WEB' as origen,
        pg.pag_cliente_id as cliente_id,
        null::uuid as usuario_id,
        1 as prioridad
      from comun_comercio.com_transaccion_pago pg
      where pg.pag_negocio = v_negocio
        and pg.pag_eliminado_en is null
        and length(comun_agentes.agc_fn_ultimos9_telefono(pg.pag_titular_telefono)) >= 8
      group by 1, 2, 3, 4, 8

      union all

      select
        comun_agentes.agc_fn_ultimos9_telefono(coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          u.usu_whatsapp
        )) as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          u.usu_whatsapp
        )) as e164,
        coalesce(
          nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''),
          u.usu_correo
        ) as nombre,
        u.usu_correo as correo,
        0 as total_compras,
        0::numeric as monto_acumulado,
        'USUARIO_WEB' as origen,
        null::uuid as cliente_id,
        u.usu_id as usuario_id,
        2 as prioridad
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
      where m.mem_estado = 'ACTIVO'
        and u.usu_eliminado_en is null
        and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
        and length(comun_agentes.agc_fn_ultimos9_telefono(coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          u.usu_whatsapp
        ))) >= 8

      union all

      select
        comun_agentes.agc_fn_ultimos9_telefono(cv.cnv_remitente_telefono) as u9,
        comun_agentes.agc_fn_normalizar_telefono_e164(cv.cnv_remitente_telefono) as e164,
        cv.cnv_remitente_nombre as nombre,
        cv.cnv_remitente_correo as correo,
        0 as total_compras,
        0::numeric as monto_acumulado,
        'CHAT_WHATSAPP' as origen,
        cv.cnv_cliente_id as cliente_id,
        cv.cnv_usuario_id as usuario_id,
        3 as prioridad
      from comun_agentes.agc_conversacion cv
      where cv.cnv_negocio = v_negocio
        and cv.cnv_eliminado_en is null
        and cv.cnv_visibilidad = 'EQUIPO_VENTAS'
        and length(comun_agentes.agc_fn_ultimos9_telefono(cv.cnv_remitente_telefono)) >= 8
    ) cr
    where cr.e164 <> ''
    order by u9, prioridad asc, total_compras desc
  ) crm;

  select coalesce(jsonb_agg(to_jsonb(lw) order by lw."esPrincipal" desc, lw."nombre" asc), '[]'::jsonb)
  into v_lineas
  from (
    select
      l.lwa_id as "id",
      l.lwa_codigo as "codigo",
      l.lwa_nombre as "nombre",
      l.lwa_rol_linea as "rolLinea",
      l.lwa_numero_e164 as "numeroE164",
      l.lwa_titular_usuario_id as "titularUsuarioId",
      l.lwa_es_principal as "esPrincipal",
      l.lwa_ia_desconocidos_activa as "iaDesconocidosActiva",
      l.lwa_ia_clientes_activa as "iaClientesActiva",
      l.lwa_politica_personales as "politicaPersonales",
      l.lwa_visibilidad_clientes as "visibilidadClientes",
      l.lwa_color_badge as "colorBadge"
    from comun_agentes.agc_linea_whatsapp l
    where l.lwa_negocio = v_negocio
      and l.lwa_eliminado_en is null
  ) lw;

  return jsonb_build_object(
    'ok', true,
    'esAdmin', v_es_admin,
    'usuarioActualId', v_uid,
    'contactos', v_contactos,
    'crmSemilla', v_crm_semilla,
    'lineasWhatsapp', v_lineas
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_listar_directorio_contactos(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_listar_directorio_contactos(text) to authenticated, service_role;

-- Importación transaccional por lotes (resultado consolidado del Join/Merge)
create or replace function comun_comercio.com_fn_omnicanal_importar_contactos_lote(
  p_negocio text,
  p_linea_whatsapp_id uuid default null,
  p_origen text default 'VCF',
  p_contactos jsonb default '[]'::jsonb,
  p_ocultar_chats_personales_existentes boolean default true
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
  v_origen text := upper(btrim(coalesce(p_origen, 'VCF')));
  v_item jsonb;
  v_e164 text;
  v_u9 text;
  v_nombre text;
  v_correo text;
  v_clasif text;
  v_pol_ia text;
  v_vis text;
  v_cli_id uuid;
  v_usu_id uuid;
  v_cdo_id uuid;
  v_prev comun_agentes.agc_contacto_directorio;
  v_fuente jsonb;
  v_f_linea_id uuid;
  v_f_nombre text;
  v_f_origen text;
  v_f_clasif text;
  v_f_pol text;
  v_creados int := 0;
  v_actualizados int := 0;
  v_omitidos int := 0;
  v_hilos_protegidos int := 0;
  v_count_tmp int := 0;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para importar contactos en este negocio.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  if v_origen not in ('VCF', 'CSV', 'XLSX', 'CONTACT_PICKER', 'GOOGLE_CONTACTS', 'CRM', 'MANUAL_CHAT', 'LISTA_IGNORAR') then
    v_origen := 'VCF';
  end if;

  if jsonb_typeof(coalesce(p_contactos, '[]'::jsonb)) <> 'array' then
    return jsonb_build_object('ok', false, 'error', 'El lote de contactos debe ser un arreglo JSON.');
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_contactos, '[]'::jsonb))
  loop
    v_e164 := comun_agentes.agc_fn_normalizar_telefono_e164(v_item->>'telefonoE164');
    if v_e164 = '' then
      v_e164 := comun_agentes.agc_fn_normalizar_telefono_e164(v_item->>'telefono');
    end if;
    v_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_e164);

    if v_e164 = '' or length(v_u9) < 8 then
      v_omitidos := v_omitidos + 1;
      continue;
    end if;

    v_nombre := left(coalesce(nullif(btrim(coalesce(v_item->>'nombreConsolidado', v_item->>'nombre', '')), ''), 'Contacto ' || v_e164), 160);
    v_correo := nullif(lower(left(btrim(coalesce(v_item->>'correo', '')), 160)), '');
    v_clasif := upper(btrim(coalesce(v_item->>'clasificacion', 'PERSONAL')));
    if v_clasif not in ('PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM') then
      v_clasif := 'PERSONAL';
    end if;

    v_pol_ia := upper(btrim(coalesce(v_item->>'politicaIa', case when v_clasif = 'CLIENTE' then 'SEGUN_LINEA' else 'SIEMPRE_MANUAL' end)));
    if v_pol_ia not in ('SIEMPRE_MANUAL', 'AUTO_IA', 'SEGUN_LINEA') then
      v_pol_ia := 'SIEMPRE_MANUAL';
    end if;
    -- Invariante de seguridad: contactos no comerciales jamás tienen IA automática
    if v_clasif <> 'CLIENTE' then
      v_pol_ia := 'SIEMPRE_MANUAL';
    end if;

    v_vis := upper(btrim(coalesce(v_item->>'visibilidad', case when v_clasif = 'CLIENTE' then 'EQUIPO_VENTAS' else 'IGNORAR_TOTAL' end)));
    if v_vis = 'OCULTO_ADMIN' then
      v_vis := 'SOLO_ADMIN';
    end if;
    if v_vis not in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR', 'IGNORAR_TOTAL') then
      v_vis := case when v_clasif = 'CLIENTE' then 'EQUIPO_VENTAS' else 'IGNORAR_TOTAL' end;
    end if;

    -- Enlazar con com_cliente / seg_usuario si existen por teléfono
    select cl.cli_id into v_cli_id
    from comun_comercio.com_cliente cl
    where cl.cli_negocio = v_negocio
      and cl.cli_eliminado_en is null
      and comun_agentes.agc_fn_ultimos9_telefono(cl.cli_telefono) = v_u9
    order by cl.cli_actualizado_en desc
    limit 1;

    select u.usu_id into v_usu_id
    from comun_seguridad.seg_usuario u
    where u.usu_eliminado_en is null
      and comun_agentes.agc_fn_ultimos9_telefono(coalesce(
        nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
        u.usu_whatsapp
      )) = v_u9
    limit 1;

    select * into v_prev
    from comun_agentes.agc_contacto_directorio c
    where c.cdo_negocio = v_negocio
      and c.cdo_telefono_ultimos9 = v_u9
      and c.cdo_eliminado_en is null
    limit 1;

    if v_prev.cdo_id is null then
      insert into comun_agentes.agc_contacto_directorio (
        cdo_negocio, cdo_telefono_e164, cdo_telefono_ultimos9,
        cdo_nombre_consolidado, cdo_correo,
        cdo_clasificacion, cdo_politica_ia, cdo_visibilidad,
        cdo_titular_usuario_id, cdo_cliente_id, cdo_usuario_id,
        cdo_detalle_contacto
      ) values (
        v_negocio, v_e164, v_u9,
        v_nombre, v_correo,
        v_clasif, v_pol_ia, v_vis,
        v_uid, v_cli_id, v_usu_id,
        coalesce(v_item->'detalle', '{}'::jsonb)
      )
      returning cdo_id into v_cdo_id;
      v_creados := v_creados + 1;
    else
      v_cdo_id := v_prev.cdo_id;
      -- Si no es admin, solo puede sobrescribir datos globales de sus propios contactos aportados;
      -- para contactos ya existentes de otros dueños, preserva la clasificación global y solo suma su fuente.
      if v_es_admin or v_prev.cdo_titular_usuario_id = v_uid then
        update comun_agentes.agc_contacto_directorio
           set cdo_telefono_e164 = v_e164,
               cdo_nombre_consolidado = v_nombre,
               cdo_correo = coalesce(v_correo, cdo_correo),
               cdo_clasificacion = v_clasif,
               cdo_politica_ia = v_pol_ia,
               cdo_visibilidad = v_vis,
               cdo_cliente_id = coalesce(cdo_cliente_id, v_cli_id),
               cdo_usuario_id = coalesce(cdo_usuario_id, v_usu_id),
               cdo_detalle_contacto = coalesce(cdo_detalle_contacto, '{}'::jsonb) || coalesce(v_item->'detalle', '{}'::jsonb),
               cdo_actualizado_en = now()
         where cdo_id = v_prev.cdo_id;
      end if;
      v_actualizados := v_actualizados + 1;
    end if;

    -- Si el contacto es CLIENTE consolidado y aún no existe en com_cliente, crearlo para enriquecer CRM 360°
    if v_clasif = 'CLIENTE' and v_cli_id is null then
      insert into comun_comercio.com_cliente (
        cli_negocio, cli_usuario_id, cli_tipo_registro,
        cli_nombre, cli_correo, cli_telefono,
        cli_detalle_cliente
      ) values (
        v_negocio, v_usu_id,
        case when v_usu_id is not null then 'USUARIO_REGISTRADO' else 'USUARIO_NO_AUTORIZADO' end,
        v_nombre, v_correo, v_e164,
        jsonb_build_object('origen_directorio_contactos', v_origen, 'importado_en', now())
      )
      on conflict do nothing
      returning cli_id into v_cli_id;

      if v_cli_id is not null then
        update comun_agentes.agc_contacto_directorio
           set cdo_cliente_id = v_cli_id
         where cdo_id = v_cdo_id and cdo_cliente_id is null;
      end if;
    end if;

    -- Registrar trazabilidad de fuentes (multi-propietario / multi-línea)
    if jsonb_typeof(v_item->'fuentes') = 'array' and jsonb_array_length(v_item->'fuentes') > 0 then
      for v_fuente in select * from jsonb_array_elements(v_item->'fuentes')
      loop
        v_f_linea_id := case
          when nullif(btrim(coalesce(v_fuente->>'lineaWhatsappId', '')), '') ~* '^[0-9a-f-]{36}$'
            then (v_fuente->>'lineaWhatsappId')::uuid
          else p_linea_whatsapp_id
        end;
        v_f_nombre := left(coalesce(nullif(btrim(coalesce(v_fuente->>'nombreOriginal', '')), ''), v_nombre), 160);
        v_f_origen := upper(btrim(coalesce(v_fuente->>'origen', v_origen)));
        if v_f_origen not in ('VCF', 'CSV', 'XLSX', 'CONTACT_PICKER', 'GOOGLE_CONTACTS', 'CRM', 'MANUAL_CHAT', 'LISTA_IGNORAR') then
          v_f_origen := v_origen;
        end if;
        v_f_clasif := upper(btrim(coalesce(v_fuente->>'clasificacionOrigen', v_clasif)));
        if v_f_clasif not in ('PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM') then
          v_f_clasif := v_clasif;
        end if;
        v_f_pol := upper(btrim(coalesce(v_fuente->>'politicaPersonal', v_vis)));
        if v_f_pol = 'SOLO_ADMIN' then
          v_f_pol := 'OCULTO_ADMIN';
        end if;
        if v_f_pol not in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR', 'EQUIPO_VENTAS') then
          v_f_pol := case when v_vis = 'SOLO_ADMIN' then 'OCULTO_ADMIN' else v_vis end;
        end if;

        insert into comun_agentes.agc_contacto_fuente (
          cfu_negocio, cfu_contacto_id, cfu_propietario_usuario_id,
          cfu_linea_whatsapp_id, cfu_origen, cfu_nombre_original,
          cfu_clasificacion_origen, cfu_politica_personal, cfu_detalle_fuente
        ) values (
          v_negocio, v_cdo_id, v_uid,
          v_f_linea_id, v_f_origen, v_f_nombre,
          v_f_clasif, v_f_pol,
          coalesce(v_fuente->'detalle', '{}'::jsonb)
        )
        on conflict (
          cfu_contacto_id,
          coalesce(cfu_linea_whatsapp_id, '00000000-0000-0000-0000-000000000000'::uuid),
          coalesce(cfu_propietario_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid)
        ) where cfu_eliminado_en is null
        do update set
          cfu_nombre_original = excluded.cfu_nombre_original,
          cfu_clasificacion_origen = excluded.cfu_clasificacion_origen,
          cfu_politica_personal = excluded.cfu_politica_personal,
          cfu_origen = excluded.cfu_origen,
          cfu_actualizado_en = now();
      end loop;
    else
      insert into comun_agentes.agc_contacto_fuente (
        cfu_negocio, cfu_contacto_id, cfu_propietario_usuario_id,
        cfu_linea_whatsapp_id, cfu_origen, cfu_nombre_original,
        cfu_clasificacion_origen, cfu_politica_personal
      ) values (
        v_negocio, v_cdo_id, v_uid,
        p_linea_whatsapp_id, v_origen, v_nombre,
        v_clasif, case when v_vis = 'SOLO_ADMIN' then 'OCULTO_ADMIN' else v_vis end
      )
      on conflict (
        cfu_contacto_id,
        coalesce(cfu_linea_whatsapp_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(cfu_propietario_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) where cfu_eliminado_en is null
      do update set
        cfu_nombre_original = excluded.cfu_nombre_original,
        cfu_clasificacion_origen = excluded.cfu_clasificacion_origen,
        cfu_politica_personal = excluded.cfu_politica_personal,
        cfu_actualizado_en = now();
    end if;

    -- Aplicar efecto inmediato sobre conversaciones WhatsApp existentes con ese número
    if v_clasif in ('PERSONAL', 'EQUIPO_INTERNO', 'PROVEEDOR', 'BLOQUEADO_SPAM')
       and coalesce(p_ocultar_chats_personales_existentes, true) then
      update comun_agentes.agc_conversacion cv
         set cnv_contacto_directorio_id = v_cdo_id,
             cnv_ia_bloqueada_permanente = true,
             cnv_estado_atencion = 'EN_ATENCION_ASESORA',
             cnv_visibilidad = case
               when v_vis = 'SOLO_TITULAR' then 'SOLO_TITULAR'
               when v_vis = 'EQUIPO_VENTAS' then 'EQUIPO_VENTAS'
               else 'SOLO_ADMIN'
             end,
             cnv_titular_privado_id = coalesce(cv.cnv_titular_privado_id, v_uid),
             cnv_actualizado_en = now()
       where cv.cnv_negocio = v_negocio
         and cv.cnv_canal = 'whatsapp'
         and cv.cnv_eliminado_en is null
         and comun_agentes.agc_fn_ultimos9_telefono(coalesce(cv.cnv_remitente_telefono, cv.cnv_remitente_id)) = v_u9
         and (p_linea_whatsapp_id is null or cv.cnv_linea_whatsapp_id = p_linea_whatsapp_id);
      get diagnostics v_count_tmp = row_count;
      v_hilos_protegidos := v_hilos_protegidos + v_count_tmp;
    elsif v_clasif = 'CLIENTE' then
      update comun_agentes.agc_conversacion cv
         set cnv_contacto_directorio_id = v_cdo_id,
             cnv_cliente_id = coalesce(cv.cnv_cliente_id, v_cli_id),
             cnv_remitente_nombre = case
               when cv.cnv_remitente_nombre like 'WhatsApp +%' or cv.cnv_remitente_nombre like '+%' then v_nombre
               else cv.cnv_remitente_nombre
             end,
             cnv_actualizado_en = now()
       where cv.cnv_negocio = v_negocio
         and cv.cnv_canal = 'whatsapp'
         and cv.cnv_eliminado_en is null
         and comun_agentes.agc_fn_ultimos9_telefono(coalesce(cv.cnv_remitente_telefono, cv.cnv_remitente_id)) = v_u9;
    end if;
  end loop;

  return jsonb_build_object(
    'ok', true,
    'creados', v_creados,
    'actualizados', v_actualizados,
    'omitidos', v_omitidos,
    'hilosProtegidos', v_hilos_protegidos
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_importar_contactos_lote(text, uuid, text, jsonb, boolean) from public;
grant execute on function comun_comercio.com_fn_omnicanal_importar_contactos_lote(text, uuid, text, jsonb, boolean) to authenticated, service_role;

-- Edición o borrado lógico de un contacto del directorio
create or replace function comun_comercio.com_fn_omnicanal_actualizar_contacto_directorio(
  p_negocio text,
  p_contacto_id uuid,
  p_nombre text default null,
  p_correo text default null,
  p_clasificacion text default null,
  p_politica_ia text default null,
  p_visibilidad text default null,
  p_notas text default null,
  p_eliminar boolean default false
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
  v_prev comun_agentes.agc_contacto_directorio;
  v_clasif text;
  v_pol_ia text;
  v_vis text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para modificar contactos.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_prev
  from comun_agentes.agc_contacto_directorio
  where cdo_id = p_contacto_id
    and cdo_negocio = v_negocio
    and cdo_eliminado_en is null;

  if v_prev.cdo_id is null then
    return jsonb_build_object('ok', false, 'error', 'Contacto no encontrado.');
  end if;

  if not v_es_admin and v_prev.cdo_titular_usuario_id <> v_uid then
    return jsonb_build_object('ok', false, 'error', 'Solo el titular del contacto o un Administrador puede editar este registro.');
  end if;

  if coalesce(p_eliminar, false) then
    update comun_agentes.agc_contacto_directorio
       set cdo_eliminado_en = now(),
           cdo_actualizado_en = now()
     where cdo_id = p_contacto_id;
    return jsonb_build_object('ok', true, 'eliminado', true);
  end if;

  v_clasif := upper(coalesce(nullif(btrim(p_clasificacion), ''), v_prev.cdo_clasificacion));
  if v_clasif not in ('PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM') then
    v_clasif := v_prev.cdo_clasificacion;
  end if;

  v_pol_ia := upper(coalesce(nullif(btrim(p_politica_ia), ''), v_prev.cdo_politica_ia));
  if v_pol_ia not in ('SIEMPRE_MANUAL', 'AUTO_IA', 'SEGUN_LINEA') then
    v_pol_ia := v_prev.cdo_politica_ia;
  end if;
  if v_clasif <> 'CLIENTE' then
    v_pol_ia := 'SIEMPRE_MANUAL';
  end if;

  v_vis := upper(coalesce(nullif(btrim(p_visibilidad), ''), v_prev.cdo_visibilidad));
  if v_vis = 'OCULTO_ADMIN' then
    v_vis := 'SOLO_ADMIN';
  end if;
  if v_vis not in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR', 'IGNORAR_TOTAL') then
    v_vis := v_prev.cdo_visibilidad;
  end if;

  update comun_agentes.agc_contacto_directorio
     set cdo_nombre_consolidado = coalesce(nullif(left(btrim(coalesce(p_nombre, '')), 160), ''), cdo_nombre_consolidado),
         cdo_correo = case when p_correo is not null then nullif(lower(left(btrim(p_correo), 160)), '') else cdo_correo end,
         cdo_clasificacion = v_clasif,
         cdo_politica_ia = v_pol_ia,
         cdo_visibilidad = v_vis,
         cdo_detalle_contacto = case
           when p_notas is not null then jsonb_set(coalesce(cdo_detalle_contacto, '{}'::jsonb), '{notas}', to_jsonb(left(btrim(p_notas), 1000)), true)
           else cdo_detalle_contacto
         end,
         cdo_actualizado_en = now()
   where cdo_id = p_contacto_id;

  -- Sincronizar el bloqueo IA en conversaciones abiertas asociadas
  if v_clasif <> 'CLIENTE' then
    update comun_agentes.agc_conversacion
       set cnv_ia_bloqueada_permanente = true,
           cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_visibilidad = case when v_vis = 'SOLO_TITULAR' then 'SOLO_TITULAR' when v_vis = 'EQUIPO_VENTAS' then 'EQUIPO_VENTAS' else 'SOLO_ADMIN' end,
           cnv_actualizado_en = now()
     where cnv_negocio = v_negocio
       and cnv_canal = 'whatsapp'
       and cnv_eliminado_en is null
       and (cnv_contacto_directorio_id = p_contacto_id or comun_agentes.agc_fn_ultimos9_telefono(coalesce(cnv_remitente_telefono, cnv_remitente_id)) = v_prev.cdo_telefono_ultimos9);
  else
    update comun_agentes.agc_conversacion
       set cnv_ia_bloqueada_permanente = (v_pol_ia = 'SIEMPRE_MANUAL'),
           cnv_visibilidad = case when v_vis in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR') then v_vis else 'EQUIPO_VENTAS' end,
           cnv_actualizado_en = now()
     where cnv_negocio = v_negocio
       and cnv_canal = 'whatsapp'
       and cnv_eliminado_en is null
       and (cnv_contacto_directorio_id = p_contacto_id or comun_agentes.agc_fn_ultimos9_telefono(coalesce(cnv_remitente_telefono, cnv_remitente_id)) = v_prev.cdo_telefono_ultimos9);
  end if;

  return jsonb_build_object('ok', true, 'clasificacion', v_clasif, 'politicaIa', v_pol_ia, 'visibilidad', v_vis);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_actualizar_contacto_directorio(text, uuid, text, text, text, text, text, text, boolean) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_contacto_directorio(text, uuid, text, text, text, text, text, text, boolean) to authenticated, service_role;

-- Acción rápida de 1 clic en la Consola de Chat: Marcar Personal / Pasar a Ventas / Activar IA Cliente
create or replace function comun_comercio.com_fn_omnicanal_marcar_chat_privacidad(
  p_negocio text,
  p_conversacion_id uuid,
  p_accion text,
  p_politica_personal text default 'IGNORAR_TOTAL'
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
  v_accion text := upper(btrim(coalesce(p_accion, '')));
  v_pol text := upper(btrim(coalesce(p_politica_personal, 'IGNORAR_TOTAL')));
  v_cnv comun_agentes.agc_conversacion;
  v_e164 text;
  v_u9 text;
  v_cdo_id uuid;
  v_actor text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para modificar la privacidad de este chat.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_cnv.cnv_visibilidad, v_cnv.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'No tienes acceso a esta conversación privada.');
  end if;

  if v_pol = 'SOLO_ADMIN' then
    v_pol := 'OCULTO_ADMIN';
  end if;
  if v_pol not in ('IGNORAR_TOTAL', 'OCULTO_ADMIN', 'SOLO_TITULAR') then
    v_pol := 'IGNORAR_TOTAL';
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_e164 := comun_agentes.agc_fn_normalizar_telefono_e164(coalesce(v_cnv.cnv_remitente_telefono, v_cnv.cnv_remitente_id));
  v_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_e164);

  if v_accion = 'MARCAR_PERSONAL' then
    if not v_es_admin and v_cnv.cnv_titular_privado_id is distinct from v_uid then
      return jsonb_build_object('ok', false, 'error', 'Solo un Administrador o el titular de la línea puede marcar un chat como Personal.');
    end if;

    if v_e164 <> '' and length(v_u9) >= 8 then
      insert into comun_agentes.agc_contacto_directorio (
        cdo_negocio, cdo_telefono_e164, cdo_telefono_ultimos9,
        cdo_nombre_consolidado, cdo_correo,
        cdo_clasificacion, cdo_politica_ia, cdo_visibilidad,
        cdo_titular_usuario_id
      ) values (
        v_negocio, v_e164, v_u9,
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164), v_cnv.cnv_remitente_correo,
        'PERSONAL', 'SIEMPRE_MANUAL', case when v_pol = 'OCULTO_ADMIN' then 'SOLO_ADMIN' else v_pol end,
        v_uid
      )
      on conflict (cdo_negocio, cdo_telefono_ultimos9) where cdo_eliminado_en is null
      do update set
        cdo_clasificacion = 'PERSONAL',
        cdo_politica_ia = 'SIEMPRE_MANUAL',
        cdo_visibilidad = case when v_pol = 'OCULTO_ADMIN' then 'SOLO_ADMIN' else v_pol end,
        cdo_actualizado_en = now()
      returning cdo_id into v_cdo_id;

      insert into comun_agentes.agc_contacto_fuente (
        cfu_negocio, cfu_contacto_id, cfu_propietario_usuario_id,
        cfu_linea_whatsapp_id, cfu_origen, cfu_nombre_original,
        cfu_clasificacion_origen, cfu_politica_personal
      ) values (
        v_negocio, v_cdo_id, v_uid,
        v_cnv.cnv_linea_whatsapp_id, 'MANUAL_CHAT',
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164),
        'PERSONAL', v_pol
      )
      on conflict (
        cfu_contacto_id,
        coalesce(cfu_linea_whatsapp_id, '00000000-0000-0000-0000-000000000000'::uuid),
        coalesce(cfu_propietario_usuario_id, '00000000-0000-0000-0000-000000000000'::uuid)
      ) where cfu_eliminado_en is null
      do update set
        cfu_clasificacion_origen = 'PERSONAL',
        cfu_politica_personal = v_pol,
        cfu_actualizado_en = now();
    end if;

    if v_pol = 'IGNORAR_TOTAL' then
      -- Retirar el hilo de la consola (borrado lógico) y futuros mensajes quedarán solo en el celular
      update comun_agentes.agc_conversacion
         set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
             cnv_ia_bloqueada_permanente = true,
             cnv_estado_atencion = 'EN_ATENCION_ASESORA',
             cnv_visibilidad = 'SOLO_ADMIN',
             cnv_titular_privado_id = coalesce(cnv_titular_privado_id, v_uid),
             cnv_eliminado_en = now(),
             cnv_actualizado_en = now()
       where cnv_id = p_conversacion_id;
    else
      update comun_agentes.agc_conversacion
         set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
             cnv_ia_bloqueada_permanente = true,
             cnv_estado_atencion = 'EN_ATENCION_ASESORA',
             cnv_visibilidad = case when v_pol = 'SOLO_TITULAR' then 'SOLO_TITULAR' else 'SOLO_ADMIN' end,
             cnv_titular_privado_id = coalesce(cnv_titular_privado_id, v_uid),
             cnv_actualizado_en = now()
       where cnv_id = p_conversacion_id;

      insert into comun_agentes.agc_mensaje (
        msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
      ) values (
        v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor,
        v_actor || ' marcó este contacto como Personal (IA bloqueada y oculto a Ventas).', 'TEXTO'
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'accion', 'MARCAR_PERSONAL',
      'politicaPersonal', v_pol,
      'ocultoConsola', (v_pol = 'IGNORAR_TOTAL'),
      'visibilidad', case when v_pol = 'SOLO_TITULAR' then 'SOLO_TITULAR' else 'SOLO_ADMIN' end
    );

  elsif v_accion in ('PASAR_A_VENTAS', 'ACTIVAR_IA_CLIENTE') then
    if not v_es_admin and v_cnv.cnv_visibilidad <> 'EQUIPO_VENTAS' then
      return jsonb_build_object('ok', false, 'error', 'Solo un Administrador puede liberar un chat privado hacia Ventas.');
    end if;

    if v_e164 <> '' and length(v_u9) >= 8 then
      insert into comun_agentes.agc_contacto_directorio (
        cdo_negocio, cdo_telefono_e164, cdo_telefono_ultimos9,
        cdo_nombre_consolidado, cdo_correo,
        cdo_clasificacion, cdo_politica_ia, cdo_visibilidad,
        cdo_titular_usuario_id, cdo_cliente_id, cdo_usuario_id
      ) values (
        v_negocio, v_e164, v_u9,
        coalesce(nullif(btrim(v_cnv.cnv_remitente_nombre), ''), v_e164), v_cnv.cnv_remitente_correo,
        'CLIENTE',
        case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'AUTO_IA' else 'SEGUN_LINEA' end,
        'EQUIPO_VENTAS',
        v_uid, v_cnv.cnv_cliente_id, v_cnv.cnv_usuario_id
      )
      on conflict (cdo_negocio, cdo_telefono_ultimos9) where cdo_eliminado_en is null
      do update set
        cdo_clasificacion = 'CLIENTE',
        cdo_politica_ia = case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'AUTO_IA' else 'SEGUN_LINEA' end,
        cdo_visibilidad = 'EQUIPO_VENTAS',
        cdo_actualizado_en = now()
      returning cdo_id into v_cdo_id;
    end if;

    update comun_agentes.agc_conversacion
       set cnv_contacto_directorio_id = coalesce(v_cdo_id, cnv_contacto_directorio_id),
           cnv_ia_bloqueada_permanente = false,
           cnv_visibilidad = 'EQUIPO_VENTAS',
           cnv_estado_atencion = case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'BOT_ACTIVO' else cnv_estado_atencion end,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    ) values (
      v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor,
      case
        when v_accion = 'ACTIVAR_IA_CLIENTE'
          then v_actor || ' clasificó este contacto como Cliente y activó respuesta automática con ARIA.'
        else v_actor || ' clasificó este contacto como Cliente y lo habilitó para el equipo de Ventas.'
      end,
      'TEXTO'
    );

    return jsonb_build_object(
      'ok', true,
      'accion', v_accion,
      'visibilidad', 'EQUIPO_VENTAS',
      'estadoAtencion', case when v_accion = 'ACTIVAR_IA_CLIENTE' then 'BOT_ACTIVO' else v_cnv.cnv_estado_atencion end
    );
  end if;

  return jsonb_build_object('ok', false, 'error', 'Acción de privacidad no reconocida.');
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_marcar_chat_privacidad(text, uuid, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_marcar_chat_privacidad(text, uuid, text, text) to authenticated, service_role;

-- =============================================================================
-- 8. DESPACHADOR MULTI-LÍNEA YCLOUD (RESPETA NÚMERO EMISOR Y CREDENCIAL DE LA LÍNEA)
-- =============================================================================

create or replace function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(
  p_negocio text,
  p_destino text,
  p_texto text,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null,
  p_linea_whatsapp_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_api_key text;
  v_emisor text;
  v_linea comun_agentes.agc_linea_whatsapp;
  v_destino_e164 text := comun_agentes.agc_fn_normalizar_telefono_e164(p_destino);
  v_img_url text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_doc_url text := nullif(btrim(coalesce(p_documento_url, '')), '');
  v_doc_nombre text := coalesce(nullif(btrim(coalesce(p_documento_nombre, '')), ''), 'documento.pdf');
  v_texto_limpio text := btrim(coalesce(p_texto, ''));
  v_cuerpo jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
begin
  if v_destino_e164 = '' then
    return jsonb_build_object('ok', false, 'error', 'Número de WhatsApp destino vacío o inválido.');
  end if;

  if p_linea_whatsapp_id is not null then
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_id = p_linea_whatsapp_id
      and lwa_negocio = v_negocio
      and lwa_eliminado_en is null;
  else
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_negocio = v_negocio
      and lwa_es_principal = true
      and lwa_eliminado_en is null
    limit 1;
  end if;

  if v_linea.lwa_id is not null then
    v_emisor := v_linea.lwa_numero_e164;
    if v_linea.lwa_ycloud_api_secreto_id is not null then
      select d.decrypted_secret into v_api_key
      from vault.decrypted_secrets d
      where d.id = v_linea.lwa_ycloud_api_secreto_id;
    end if;
  end if;

  -- Heredar API Key y emisor de cfg_aria si la línea no tiene secreto dedicado
  if v_api_key is null or btrim(v_api_key) = '' or v_emisor is null or btrim(v_emisor) = '' then
    select
      coalesce(nullif(btrim(v_api_key), ''), d.decrypted_secret),
      coalesce(nullif(btrim(v_emisor), ''), nullif(btrim(a.ari_detalle_aria->>'ycloud_numero_emisor'), ''), '+593996438873')
    into v_api_key, v_emisor
    from comun_configuracion.cfg_aria a
    left join vault.decrypted_secrets d on d.id = a.ari_ycloud_api_secreto_id
    where a.ari_negocio = v_negocio
      and a.ari_eliminado_en is null
    limit 1;
  end if;

  if v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object(
      'ok', false,
      'error', 'Falta configurar la API Key de YCloud en /panel/aria para despachar mensajes a WhatsApp.'
    );
  end if;

  v_emisor := comun_agentes.agc_fn_normalizar_telefono_e164(v_emisor);

  if v_img_url is null and v_doc_url is null then
    v_img_url := substring(v_texto_limpio from '!\s*\[[^\]]*\]\s*\(\s*(https?://[^)\s]+)\s*\)');
  end if;

  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '!\s*\[[^\]]*\]\s*\(\s*https?://[^)]+\)', '', 'g'));
  v_texto_limpio := btrim(regexp_replace(v_texto_limpio, '📄\s*\[[^\]]+\]\(\s*https?://[^)]+\)', '', 'g'));

  perform pg_catalog.set_config('statement_timeout', '30000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '25');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '8');

  if v_doc_url is not null and v_doc_url ~* '^https?://' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'document',
      'document', jsonb_strip_nulls(jsonb_build_object(
        'link', v_doc_url,
        'filename', left(v_doc_nombre, 120),
        'caption', case when v_texto_limpio <> '' then left(v_texto_limpio, 1020) else null end
      ))
    );
  elsif v_img_url is not null and v_img_url ~* '^https?://' then
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'image',
      'image', jsonb_strip_nulls(jsonb_build_object(
        'link', v_img_url,
        'caption', case when v_texto_limpio <> '' then left(v_texto_limpio, 1020) else null end
      ))
    );
  else
    v_cuerpo := jsonb_build_object(
      'from', v_emisor,
      'to', v_destino_e164,
      'type', 'text',
      'text', jsonb_build_object(
        'body', left(coalesce(nullif(v_texto_limpio, ''), p_texto, 'Mensaje'), 4000),
        'preview_url', true
      )
    );
  end if;

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
      array[extensions.http_header('X-API-Key', v_api_key)],
      'application/json',
      v_cuerpo::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object(
      'ok', false,
      'error', 'No se pudo conectar con YCloud API (' || sqlerrm || ')'
    );
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'status', v_status,
      'error', coalesce(
        v_json->'error'->>'message',
        v_json->'error'->'whatsappApiError'->>'message',
        v_json->>'message',
        'YCloud respondió HTTP ' || coalesce(v_status::text, '?')
      )
    );
  end if;

  if (v_img_url is not null or v_doc_url is not null) and char_length(v_texto_limpio) > 1020 then
    begin
      perform extensions.http((
        'POST',
        'https://api.ycloud.com/v2/whatsapp/messages/sendDirectly',
        array[extensions.http_header('X-API-Key', v_api_key)],
        'application/json',
        jsonb_build_object(
          'from', v_emisor,
          'to', v_destino_e164,
          'type', 'text',
          'text', jsonb_build_object(
            'body', substring(v_texto_limpio from 1021 for 3000),
            'preview_url', true
          )
        )::text
      )::extensions.http_request);
    exception when others then
      null;
    end;
  end if;

  return jsonb_build_object(
    'ok', true,
    'idExterno', coalesce(v_json->>'wamid', v_json->>'id'),
    'ycloudId', v_json->>'id',
    'estado', coalesce(v_json->>'status', 'sent'),
    'emisor', v_emisor
  );
end;
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(text, text, text, text, text, text, uuid) from public, anon, authenticated;

-- Wrapper retrocompatible de 6 argumentos (sin sobrecarga ambigua)
create or replace function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(
  p_negocio text,
  p_destino text,
  p_texto text,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null
)
returns jsonb
language sql
security definer
set search_path = extensions, pg_temp
as $$
  select comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(
    p_negocio,
    p_destino,
    p_texto,
    p_imagen_url,
    p_documento_url,
    p_documento_nombre,
    null::uuid
  );
$$;

revoke all on function comun_comercio.com_fn_interno_despachar_whatsapp_ycloud(text, text, text, text, text, text) from public, anon, authenticated;

-- =============================================================================
-- 9. WEBHOOK YCLOUD MULTI-LÍNEA + FILTRADO DE CONTACTOS PERSONALES (IGNORAR_TOTAL)
-- =============================================================================

create or replace function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(
  p_token text,
  p_firma text default null,
  p_cuerpo_raw text default null,
  p_payload jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_webhook_secret text;
  v_t text;
  v_s text;
  v_hmac text;
  v_tipo_evento text := coalesce(p_payload->>'type', '');
  v_msg_obj jsonb;
  v_in jsonb;
  v_id_ext text;
  v_from_digitos text;
  v_to_digitos text;
  v_from_u9 text;
  v_to_u9 text;
  v_emisor_u9 text;
  v_linea comun_agentes.agc_linea_whatsapp;
  v_contacto comun_agentes.agc_contacto_directorio;
  v_fuente_linea comun_agentes.agc_contacto_fuente;
  v_clasif_efectiva text := 'DESCONOCIDO';
  v_politica_personal_efectiva text := 'IGNORAR_TOTAL';
  v_visibilidad_efectiva text := 'EQUIPO_VENTAS';
  v_ia_activa_por_regla boolean := true;
  v_ia_bloqueada_contacto boolean := false;
  v_titular_privado uuid := null;
  v_nombre_perfil text;
  v_msg_tipo text;
  v_texto text := '';
  v_tipo_bd text := 'TEXTO';
  v_imagen_url text := null;
  v_audio_url text := null;
  v_audio_mime text := null;
  v_doc_url text := null;
  v_doc_nombre text := null;
  v_lat numeric := null;
  v_lng numeric := null;
  v_clave_hilo text;
  v_usu_id uuid := null;
  v_cli_id uuid := null;
  v_pide_humano boolean := false;
  v_cnv comun_agentes.agc_conversacion;
  v_msg_ins comun_agentes.agc_mensaje;
  v_etq_wa_id uuid;
  v_habilitado boolean := false;
  v_lista_blanca text := '';
  v_autorizado_ia boolean := true;
  v_conteo_despedidas int := 0;
  v_es_despedida_corta boolean := false;
  v_estado_upd text;
begin
  if v_token = '' then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook ausente.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'status', 401, 'error', 'Token de webhook no reconocido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  if v_aria.ari_ycloud_webhook_secreto_id is not null then
    select d.decrypted_secret into v_webhook_secret
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_ycloud_webhook_secreto_id;

    if v_webhook_secret is not null and btrim(v_webhook_secret) <> '' then
      v_t := substring(coalesce(p_firma, '') from 't=([0-9]+)');
      v_s := lower(substring(coalesce(p_firma, '') from 's=([0-9a-fA-F]+)'));
      if v_t is null or v_s is null or p_cuerpo_raw is null then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature requerida.');
      end if;
      v_hmac := encode(extensions.hmac(v_t || '.' || p_cuerpo_raw, v_webhook_secret, 'sha256'), 'hex');
      if v_hmac <> v_s then
        return jsonb_build_object('ok', false, 'status', 401, 'error', 'Firma YCloud-Signature inválida.');
      end if;
    end if;
  end if;

  -- CASO A: Actualización de estado de entrega/lectura
  if v_tipo_evento = 'whatsapp.message.updated' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''));
    v_estado_upd := case lower(coalesce(v_msg_obj->>'status', ''))
      when 'delivered' then 'ENTREGADO'
      when 'read' then 'LEIDO'
      when 'failed' then 'FALLIDO'
      else 'ENVIADO'
    end;

    if v_id_ext is not null then
      update comun_agentes.agc_mensaje
         set msg_estado_entrega = v_estado_upd,
             msg_actualizado_en = now()
       where msg_negocio = v_negocio
         and msg_id_externo = v_id_ext;
    end if;

    return jsonb_build_object('ok', true, 'accion', 'ESTADO_ACTUALIZADO');
  end if;

  -- CASO B: Eco desde la App Móvil de WhatsApp Business (Coexistencia SMB)
  if v_tipo_evento = 'whatsapp.smb.message.echoes' then
    v_msg_obj := coalesce(p_payload->'whatsappMessage', '{}'::jsonb);
    v_id_ext := coalesce(nullif(v_msg_obj->>'wamid', ''), nullif(v_msg_obj->>'id', ''), nullif(p_payload->>'id', ''));
    v_from_digitos := regexp_replace(coalesce(v_msg_obj->>'from', ''), '\D', '', 'g');
    v_to_digitos := regexp_replace(coalesce(v_msg_obj->>'to', ''), '\D', '', 'g');
    v_from_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_from_digitos);
    v_to_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_to_digitos);

    if v_to_digitos = '' then
      return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
    end if;

    -- Resolver qué línea WhatsApp envió el eco móvil
    if length(v_from_u9) >= 8 then
      select * into v_linea
      from comun_agentes.agc_linea_whatsapp
      where lwa_negocio = v_negocio
        and lwa_numero_ultimos9 = v_from_u9
        and lwa_eliminado_en is null
      limit 1;
    end if;
    if v_linea.lwa_id is null then
      select * into v_linea
      from comun_agentes.agc_linea_whatsapp
      where lwa_negocio = v_negocio
        and lwa_es_principal = true
        and lwa_eliminado_en is null
      limit 1;
    end if;

    -- Anti-bucle interno: si el destinatario es otra línea WhatsApp del equipo, ignorar
    if length(v_to_u9) >= 8 and exists (
      select 1 from comun_agentes.agc_linea_whatsapp
      where lwa_negocio = v_negocio
        and lwa_numero_ultimos9 = v_to_u9
        and lwa_eliminado_en is null
    ) then
      return jsonb_build_object('ok', true, 'accion', 'IGNORADO_LINEA_INTERNA');
    end if;

    -- Evaluar si el destinatario del eco móvil está en el directorio como contacto PERSONAL
    if length(v_to_u9) >= 8 then
      select * into v_contacto
      from comun_agentes.agc_contacto_directorio
      where cdo_negocio = v_negocio
        and cdo_telefono_ultimos9 = v_to_u9
        and cdo_eliminado_en is null
      limit 1;

      if v_contacto.cdo_id is not null and v_linea.lwa_id is not null then
        select * into v_fuente_linea
        from comun_agentes.agc_contacto_fuente
        where cfu_contacto_id = v_contacto.cdo_id
          and cfu_linea_whatsapp_id = v_linea.lwa_id
          and cfu_eliminado_en is null
        limit 1;
      end if;

      v_clasif_efectiva := coalesce(v_fuente_linea.cfu_clasificacion_origen, v_contacto.cdo_clasificacion, 'DESCONOCIDO');
      if v_clasif_efectiva in ('PERSONAL', 'EQUIPO_INTERNO', 'PROVEEDOR', 'BLOQUEADO_SPAM') then
        v_politica_personal_efectiva := coalesce(
          nullif(v_fuente_linea.cfu_politica_personal, 'EQUIPO_VENTAS'),
          nullif(v_contacto.cdo_visibilidad, 'EQUIPO_VENTAS'),
          v_linea.lwa_politica_personales,
          'IGNORAR_TOTAL'
        );
        if v_politica_personal_efectiva = 'IGNORAR_TOTAL' then
          return jsonb_build_object('ok', true, 'accion', 'IGNORADO_CONTACTO_PERSONAL');
        end if;
        v_visibilidad_efectiva := case when v_politica_personal_efectiva = 'SOLO_TITULAR' then 'SOLO_TITULAR' else 'SOLO_ADMIN' end;
        v_ia_bloqueada_contacto := true;
        v_titular_privado := coalesce(v_linea.lwa_titular_usuario_id, v_contacto.cdo_titular_usuario_id);
      else
        v_visibilidad_efectiva := coalesce(
          case when v_contacto.cdo_visibilidad in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR') then v_contacto.cdo_visibilidad else null end,
          v_linea.lwa_visibilidad_clientes,
          'EQUIPO_VENTAS'
        );
        v_titular_privado := v_linea.lwa_titular_usuario_id;
      end if;
    end if;

    v_msg_tipo := lower(coalesce(v_msg_obj->>'type', 'text'));
    if v_msg_tipo = 'image' then
      v_tipo_bd := 'IMAGEN';
      v_imagen_url := nullif(btrim(coalesce(v_msg_obj->'image'->>'link', '')), '');
      v_texto := btrim(coalesce(
        nullif(v_msg_obj->'image'->>'caption', ''),
        case when v_imagen_url is not null then '![Imagen enviada desde WhatsApp Móvil](' || v_imagen_url || ')' else '📷 Imagen enviada desde WhatsApp Móvil' end
      ));
    elsif v_msg_tipo in ('audio', 'voice') then
      v_tipo_bd := 'AUDIO';
      v_audio_url := nullif(btrim(coalesce(v_msg_obj->'audio'->>'link', v_msg_obj->'voice'->>'link', '')), '');
      v_texto := '🎤 Nota de voz enviada desde WhatsApp Móvil';
    elsif v_msg_tipo = 'document' then
      v_tipo_bd := 'DOCUMENTO';
      v_doc_url := nullif(btrim(coalesce(v_msg_obj->'document'->>'link', '')), '');
      v_doc_nombre := coalesce(nullif(btrim(coalesce(v_msg_obj->'document'->>'filename', '')), ''), 'documento');
      v_texto := '📄 Documento enviado desde WhatsApp Móvil: ' || v_doc_nombre;
    else
      v_texto := btrim(coalesce(v_msg_obj->'text'->>'body', v_msg_obj->'image'->>'caption', ''));
    end if;

    if v_texto = '' then
      return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
    end if;

    if v_id_ext is not null and exists (
      select 1 from comun_agentes.agc_mensaje
      where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
    ) then
      return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
    end if;

    v_clave_hilo := case
      when v_linea.lwa_id is null or v_linea.lwa_es_principal then 'wa:' || v_to_digitos
      else 'wa:' || v_linea.lwa_codigo || ':' || v_to_digitos
    end;

    insert into comun_agentes.agc_conversacion (
      cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
      cnv_remitente_telefono, cnv_linea_whatsapp_id, cnv_visibilidad, cnv_titular_privado_id,
      cnv_contacto_directorio_id, cnv_ia_bloqueada_permanente,
      cnv_estado_atencion, cnv_ultimo_mensaje_texto,
      cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en, cnv_mensajes_humano_conteo
    ) values (
      v_negocio, 'whatsapp', v_clave_hilo, '+' || v_to_digitos,
      coalesce(v_contacto.cdo_nombre_consolidado, 'WhatsApp +' || v_to_digitos),
      '+' || v_to_digitos, v_linea.lwa_id, v_visibilidad_efectiva, v_titular_privado,
      v_contacto.cdo_id, v_ia_bloqueada_contacto,
      'EN_ATENCION_ASESORA', left(v_texto, 280),
      'ASESORA_HUMANA', now(), 1
    )
    on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
    do update set
      cnv_linea_whatsapp_id = coalesce(comun_agentes.agc_conversacion.cnv_linea_whatsapp_id, excluded.cnv_linea_whatsapp_id),
      cnv_visibilidad = case
        when excluded.cnv_visibilidad in ('SOLO_ADMIN', 'SOLO_TITULAR') then excluded.cnv_visibilidad
        else comun_agentes.agc_conversacion.cnv_visibilidad
      end,
      cnv_ia_bloqueada_permanente = comun_agentes.agc_conversacion.cnv_ia_bloqueada_permanente or excluded.cnv_ia_bloqueada_permanente,
      cnv_estado_atencion = 'EN_ATENCION_ASESORA',
      cnv_ultimo_mensaje_texto = left(v_texto, 280),
      cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
      cnv_ultimo_mensaje_en = now(),
      cnv_mensajes_humano_conteo = comun_agentes.agc_conversacion.cnv_mensajes_humano_conteo + 1,
      cnv_actualizado_en = now()
    returning * into v_cnv;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
      msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
    ) values (
      v_negocio, v_cnv.cnv_id, 'ASESORA_HUMANA',
      coalesce(v_linea.lwa_nombre, 'WhatsApp Móvil Tienda'),
      v_texto, v_tipo_bd, v_id_ext, 'ENVIADO',
      jsonb_strip_nulls(jsonb_build_object(
        'canal', 'whatsapp',
        'linea_codigo', v_linea.lwa_codigo,
        'imagen_url', v_imagen_url,
        'audio_url', v_audio_url,
        'documento_url', v_doc_url,
        'documento_nombre', v_doc_nombre
      ))
    )
    on conflict (msg_negocio, msg_id_externo) where msg_id_externo is not null and msg_eliminado_en is null
    do nothing
    returning * into v_msg_ins;

    return jsonb_build_object(
      'ok', true,
      'accion', 'ECO_MOVIL_REGISTRADO',
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'audioUrl', v_audio_url,
      'documentoUrl', v_doc_url,
      'documentoNombre', v_doc_nombre,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion,
      'visibilidad', v_cnv.cnv_visibilidad,
      'titularPrivadoId', v_cnv.cnv_titular_privado_id,
      'lineaWhatsappId', v_linea.lwa_id,
      'lineaWhatsappNombre', v_linea.lwa_nombre,
      'lineaWhatsappCodigo', v_linea.lwa_codigo,
      'lineaWhatsappColor', v_linea.lwa_color_badge
    );
  end if;

  -- CASO C: Mensaje Entrante del Cliente (whatsapp.inbound_message.received)
  if v_tipo_evento <> 'whatsapp.inbound_message.received' and not (p_payload ? 'whatsappInboundMessage') then
    return jsonb_build_object('ok', true, 'accion', 'EVENTO_IGNORADO', 'tipo', v_tipo_evento);
  end if;

  v_in := coalesce(p_payload->'whatsappInboundMessage', '{}'::jsonb);
  v_id_ext := coalesce(nullif(v_in->>'wamid', ''), nullif(v_in->>'id', ''), nullif(p_payload->>'id', ''));
  v_from_digitos := regexp_replace(coalesce(v_in->>'from', ''), '\D', '', 'g');
  v_to_digitos := regexp_replace(coalesce(v_in->>'to', ''), '\D', '', 'g');
  v_from_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_from_digitos);
  v_to_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_to_digitos);
  v_emisor_u9 := comun_agentes.agc_fn_ultimos9_telefono(v_aria.ari_detalle_aria->>'ycloud_numero_emisor');

  if v_from_digitos = '' or (v_emisor_u9 <> '' and v_from_u9 = v_emisor_u9) then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_EMISOR_PROPIO');
  end if;

  -- Anti-bucle interno: si el remitente es cualquiera de los celulares WhatsApp registrados en el negocio
  if length(v_from_u9) >= 8 and exists (
    select 1 from comun_agentes.agc_linea_whatsapp
    where lwa_negocio = v_negocio
      and lwa_numero_ultimos9 = v_from_u9
      and lwa_eliminado_en is null
  ) then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_LINEA_INTERNA');
  end if;

  -- Resolver qué línea WhatsApp del negocio recibió este mensaje (`to`)
  if length(v_to_u9) >= 8 then
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_negocio = v_negocio
      and lwa_numero_ultimos9 = v_to_u9
      and lwa_eliminado_en is null
    limit 1;
  end if;
  if v_linea.lwa_id is null then
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_negocio = v_negocio
      and lwa_es_principal = true
      and lwa_eliminado_en is null
    limit 1;
  end if;

  if v_linea.lwa_id is not null and not v_linea.lwa_habilitado then
    return jsonb_build_object('ok', true, 'accion', 'LINEA_DESHABILITADA');
  end if;

  -- Consultar directorio consolidado de contactos + precedencia por línea
  if length(v_from_u9) >= 8 then
    select * into v_contacto
    from comun_agentes.agc_contacto_directorio
    where cdo_negocio = v_negocio
      and cdo_telefono_ultimos9 = v_from_u9
      and cdo_eliminado_en is null
    limit 1;

    if v_contacto.cdo_id is not null and v_linea.lwa_id is not null then
      select * into v_fuente_linea
      from comun_agentes.agc_contacto_fuente
      where cfu_contacto_id = v_contacto.cdo_id
        and cfu_linea_whatsapp_id = v_linea.lwa_id
        and cfu_eliminado_en is null
      limit 1;
    end if;
  end if;

  v_clasif_efectiva := coalesce(
    v_fuente_linea.cfu_clasificacion_origen,
    v_contacto.cdo_clasificacion,
    'DESCONOCIDO'
  );

  -- REGLA DE PRIVACIDAD Y EXCLUSIÓN IA PARA CONTACTOS PERSONALES / INTERNOS / PROVEEDORES
  if v_clasif_efectiva in ('PERSONAL', 'EQUIPO_INTERNO', 'PROVEEDOR', 'BLOQUEADO_SPAM') then
    v_politica_personal_efectiva := coalesce(
      nullif(v_fuente_linea.cfu_politica_personal, 'EQUIPO_VENTAS'),
      nullif(v_contacto.cdo_visibilidad, 'EQUIPO_VENTAS'),
      v_linea.lwa_politica_personales,
      'IGNORAR_TOTAL'
    );

    -- Decisión 3.1: IGNORAR_TOTAL -> no almacenar en consola, queda solo en el celular
    if v_politica_personal_efectiva = 'IGNORAR_TOTAL' then
      return jsonb_build_object(
        'ok', true,
        'accion', 'IGNORADO_CONTACTO_PERSONAL',
        'negocio', v_negocio,
        'clasificacion', v_clasif_efectiva
      );
    end if;

    v_visibilidad_efectiva := case when v_politica_personal_efectiva = 'SOLO_TITULAR' then 'SOLO_TITULAR' else 'SOLO_ADMIN' end;
    v_ia_bloqueada_contacto := true;
    v_ia_activa_por_regla := false;
    v_titular_privado := coalesce(v_linea.lwa_titular_usuario_id, v_contacto.cdo_titular_usuario_id);
  else
    -- Decisión 3.2: Política IA configurable por teléfono (desconocidos vs clientes) + override por contacto
    v_visibilidad_efectiva := coalesce(
      case when v_contacto.cdo_visibilidad in ('EQUIPO_VENTAS', 'SOLO_ADMIN', 'SOLO_TITULAR') then v_contacto.cdo_visibilidad else null end,
      v_linea.lwa_visibilidad_clientes,
      'EQUIPO_VENTAS'
    );
    v_titular_privado := v_linea.lwa_titular_usuario_id;

    if v_contacto.cdo_id is not null and v_contacto.cdo_politica_ia = 'SIEMPRE_MANUAL' then
      v_ia_activa_por_regla := false;
      v_ia_bloqueada_contacto := true;
    elsif v_contacto.cdo_id is not null and v_contacto.cdo_politica_ia = 'AUTO_IA' then
      v_ia_activa_por_regla := true;
    elsif v_clasif_efectiva = 'CLIENTE' then
      v_ia_activa_por_regla := coalesce(
        v_linea.lwa_ia_clientes_activa,
        not coalesce((v_aria.ari_detalle_aria->>'ycloud_modo_manual_defecto')::boolean, false)
      );
    else
      -- DESCONOCIDO: aplica el modo por defecto configurado en ESE teléfono
      v_ia_activa_por_regla := coalesce(
        v_linea.lwa_ia_desconocidos_activa,
        not coalesce((v_aria.ari_detalle_aria->>'ycloud_modo_manual_defecto')::boolean, false)
      );
    end if;
  end if;

  -- Idempotencia ante reintentos de YCloud
  if v_id_ext is not null and exists (
    select 1 from comun_agentes.agc_mensaje
    where msg_negocio = v_negocio and msg_id_externo = v_id_ext and msg_eliminado_en is null
  ) then
    return jsonb_build_object('ok', true, 'accion', 'DUPLICADO');
  end if;

  v_nombre_perfil := coalesce(
    nullif(btrim(coalesce(v_contacto.cdo_nombre_consolidado, '')), ''),
    nullif(btrim(coalesce(v_in->'customerProfile'->>'name', '')), ''),
    'WhatsApp +' || v_from_digitos
  );
  v_msg_tipo := lower(coalesce(v_in->>'type', 'text'));

  if v_msg_tipo = 'text' then
    v_texto := btrim(coalesce(v_in->'text'->>'body', ''));
  elsif v_msg_tipo = 'interactive' then
    v_texto := btrim(coalesce(
      v_in->'interactive'->'button_reply'->>'title',
      v_in->'interactive'->'list_reply'->>'title',
      v_in->'interactive'->>'body',
      'Selección interactiva'
    ));
  elsif v_msg_tipo = 'button' then
    v_texto := btrim(coalesce(v_in->'button'->>'text', v_in->'button'->>'payload', 'Botón'));
  elsif v_msg_tipo = 'location' then
    v_tipo_bd := 'UBICACION';
    begin
      v_lat := (v_in->'location'->>'latitude')::numeric;
      v_lng := (v_in->'location'->>'longitude')::numeric;
    exception when others then
      v_lat := null; v_lng := null;
    end;
    v_texto := btrim(
      '📍 Ubicación compartida: ' ||
      coalesce(nullif(v_in->'location'->>'name', '') || ' - ', '') ||
      coalesce(nullif(v_in->'location'->>'address', '') || ' ', '') ||
      case when v_lat is not null and v_lng is not null
        then '(https://www.google.com/maps?q=' || v_lat::text || ',' || v_lng::text || ')'
        else ''
      end
    );
  elsif v_msg_tipo = 'image' then
    v_tipo_bd := 'IMAGEN';
    v_imagen_url := nullif(btrim(coalesce(v_in->'image'->>'link', '')), '');
    v_texto := btrim(coalesce(
      nullif(v_in->'image'->>'caption', ''),
      case when v_imagen_url is not null then '![Imagen adjunta](' || v_imagen_url || ')' else '📷 Imagen adjunta por el cliente' end
    ));
  elsif v_msg_tipo in ('audio', 'voice') then
    v_tipo_bd := 'AUDIO';
    v_audio_url := nullif(btrim(coalesce(v_in->'audio'->>'link', v_in->'voice'->>'link', '')), '');
    v_audio_mime := nullif(btrim(coalesce(v_in->'audio'->>'mime_type', v_in->'voice'->>'mime_type', '')), '');
    v_texto := '🎤 Nota de voz recibida por WhatsApp';
  elsif v_msg_tipo = 'document' then
    v_tipo_bd := 'DOCUMENTO';
    v_doc_url := nullif(btrim(coalesce(v_in->'document'->>'link', '')), '');
    v_doc_nombre := coalesce(nullif(btrim(coalesce(v_in->'document'->>'filename', '')), ''), 'archivo');
    v_texto := '📄 Documento recibido: ' || v_doc_nombre;
  else
    v_texto := btrim(coalesce(v_in->'text'->>'body', 'Mensaje (' || v_msg_tipo || ')'));
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', true, 'accion', 'IGNORADO_VACIO');
  end if;

  v_clave_hilo := case
    when v_linea.lwa_id is null or v_linea.lwa_es_principal then 'wa:' || v_from_digitos
    else 'wa:' || v_linea.lwa_codigo || ':' || v_from_digitos
  end;

  select u.usu_id into v_usu_id
  from comun_seguridad.seg_usuario u
  where comun_agentes.agc_fn_ultimos9_telefono(u.usu_whatsapp) = v_from_u9
  limit 1;

  select c.cli_id into v_cli_id
  from comun_comercio.com_cliente c
  where c.cli_negocio = v_negocio
    and c.cli_eliminado_en is null
    and comun_agentes.agc_fn_ultimos9_telefono(c.cli_telefono) = v_from_u9
  order by c.cli_actualizado_en desc
  limit 1;

  v_pide_humano := (v_texto ~* '(hablar con (un |una )?(asesor|humano|persona|vendedor)|atenci[oó]n humana|reclamo|queja)');

  insert into comun_agentes.agc_conversacion (
    cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
    cnv_remitente_telefono, cnv_usuario_id, cnv_cliente_id,
    cnv_linea_whatsapp_id, cnv_visibilidad, cnv_titular_privado_id,
    cnv_contacto_directorio_id, cnv_ia_bloqueada_permanente,
    cnv_estado_atencion, cnv_motivo_escalamiento,
    cnv_ultimo_mensaje_texto, cnv_ultimo_mensaje_origen, cnv_ultimo_mensaje_en,
    cnv_no_leidos_asesora, cnv_mensajes_cliente_conteo, cnv_ventana_24h_expira_en
  ) values (
    v_negocio, 'whatsapp', v_clave_hilo, '+' || v_from_digitos, v_nombre_perfil,
    '+' || v_from_digitos, coalesce(v_contacto.cdo_usuario_id, v_usu_id), coalesce(v_contacto.cdo_cliente_id, v_cli_id),
    v_linea.lwa_id, v_visibilidad_efectiva, v_titular_privado,
    v_contacto.cdo_id, v_ia_bloqueada_contacto,
    case
      when v_ia_bloqueada_contacto or not v_ia_activa_por_regla then 'EN_ATENCION_ASESORA'
      when v_pide_humano then 'ESCALADO_HUMANO'
      else 'BOT_ACTIVO'
    end,
    case when v_pide_humano and v_ia_activa_por_regla then 'Solicitud directa de atención humana en WhatsApp' else null end,
    left(v_texto, 280), 'CLIENTE', now(),
    1, 1, now() + interval '24 hours'
  )
  on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
  do update set
    cnv_remitente_nombre = case
      when comun_agentes.agc_conversacion.cnv_remitente_nombre like 'WhatsApp +%' then excluded.cnv_remitente_nombre
      else comun_agentes.agc_conversacion.cnv_remitente_nombre
    end,
    cnv_usuario_id = coalesce(comun_agentes.agc_conversacion.cnv_usuario_id, excluded.cnv_usuario_id),
    cnv_cliente_id = coalesce(comun_agentes.agc_conversacion.cnv_cliente_id, excluded.cnv_cliente_id),
    cnv_linea_whatsapp_id = coalesce(comun_agentes.agc_conversacion.cnv_linea_whatsapp_id, excluded.cnv_linea_whatsapp_id),
    cnv_contacto_directorio_id = coalesce(excluded.cnv_contacto_directorio_id, comun_agentes.agc_conversacion.cnv_contacto_directorio_id),
    cnv_ia_bloqueada_permanente = comun_agentes.agc_conversacion.cnv_ia_bloqueada_permanente or excluded.cnv_ia_bloqueada_permanente,
    cnv_visibilidad = case
      when excluded.cnv_visibilidad in ('SOLO_ADMIN', 'SOLO_TITULAR') then excluded.cnv_visibilidad
      else comun_agentes.agc_conversacion.cnv_visibilidad
    end,
    cnv_estado_atencion = case
      when comun_agentes.agc_conversacion.cnv_ia_bloqueada_permanente or excluded.cnv_ia_bloqueada_permanente then 'EN_ATENCION_ASESORA'
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then 'EN_ATENCION_ASESORA'
      when v_pide_humano then 'ESCALADO_HUMANO'
      when comun_agentes.agc_conversacion.cnv_estado_atencion = 'CERRADO' then
        case when v_ia_activa_por_regla then 'BOT_ACTIVO' else 'EN_ATENCION_ASESORA' end
      else comun_agentes.agc_conversacion.cnv_estado_atencion
    end,
    cnv_motivo_escalamiento = case
      when v_pide_humano then 'Solicitud directa de atención humana en WhatsApp'
      else comun_agentes.agc_conversacion.cnv_motivo_escalamiento
    end,
    cnv_ultimo_mensaje_texto = left(v_texto, 280),
    cnv_ultimo_mensaje_origen = 'CLIENTE',
    cnv_ultimo_mensaje_en = now(),
    cnv_no_leidos_asesora = comun_agentes.agc_conversacion.cnv_no_leidos_asesora + 1,
    cnv_mensajes_cliente_conteo = comun_agentes.agc_conversacion.cnv_mensajes_cliente_conteo + 1,
    cnv_ventana_24h_expira_en = now() + interval '24 hours',
    cnv_actualizado_en = now()
  returning * into v_cnv;

  select etq_id into v_etq_wa_id
  from comun_agentes.agc_etiqueta
  where etq_negocio = v_negocio and etq_slug = 'origen-whatsapp' and etq_eliminado_en is null
  limit 1;

  if v_etq_wa_id is not null then
    insert into comun_agentes.agc_conversacion_etiqueta (cet_negocio, cet_conversacion_id, cet_etiqueta_id)
    values (v_negocio, v_cnv.cnv_id, v_etq_wa_id)
    on conflict (cet_conversacion_id, cet_etiqueta_id) do update set cet_eliminado_en = null;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, v_cnv.cnv_id, 'CLIENTE', v_cnv.cnv_remitente_nombre,
    v_texto, v_tipo_bd, v_id_ext, 'ENTREGADO',
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'linea_codigo', v_linea.lwa_codigo,
      'linea_nombre', v_linea.lwa_nombre,
      'imagen_url', v_imagen_url,
      'audio_url', v_audio_url,
      'audio_mime', v_audio_mime,
      'documento_url', v_doc_url,
      'documento_nombre', v_doc_nombre,
      'latitud', v_lat,
      'longitud', v_lng
    ))
  )
  returning * into v_msg_ins;

  if v_cnv.cnv_ia_bloqueada_permanente or v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object(
      'ok', true,
      'accion', case when v_ia_bloqueada_contacto then 'SILENCIADO_CONTACTO_PERSONAL' else 'SILENCIADO_HUMANO' end,
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'audioUrl', v_audio_url,
      'audioMime', v_audio_mime,
      'documentoUrl', v_doc_url,
      'documentoNombre', v_doc_nombre,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion,
      'visibilidad', v_cnv.cnv_visibilidad,
      'titularPrivadoId', v_cnv.cnv_titular_privado_id,
      'lineaWhatsappId', v_linea.lwa_id,
      'lineaWhatsappNombre', v_linea.lwa_nombre,
      'lineaWhatsappCodigo', v_linea.lwa_codigo,
      'lineaWhatsappColor', v_linea.lwa_color_badge,
      'clasificacionContacto', v_clasif_efectiva
    );
  end if;

  v_habilitado := coalesce((v_aria.ari_detalle_aria->>'ycloud_habilitado')::boolean, false);
  if not v_habilitado then
    return jsonb_build_object(
      'ok', true,
      'accion', 'CANAL_SOLO_MONITOREO',
      'negocio', v_negocio,
      'conversacionId', v_cnv.cnv_id,
      'claveHilo', v_clave_hilo,
      'mensajeId', v_msg_ins.msg_id,
      'contenido', v_texto,
      'tipoMensaje', v_tipo_bd,
      'imagenUrl', v_imagen_url,
      'audioUrl', v_audio_url,
      'audioMime', v_audio_mime,
      'documentoUrl', v_doc_url,
      'documentoNombre', v_doc_nombre,
      'remitenteNombre', v_cnv.cnv_remitente_nombre,
      'remitenteTelefono', v_cnv.cnv_remitente_telefono,
      'estadoAtencion', v_cnv.cnv_estado_atencion,
      'visibilidad', v_cnv.cnv_visibilidad,
      'titularPrivadoId', v_cnv.cnv_titular_privado_id,
      'lineaWhatsappId', v_linea.lwa_id,
      'lineaWhatsappNombre', v_linea.lwa_nombre,
      'lineaWhatsappCodigo', v_linea.lwa_codigo,
      'lineaWhatsappColor', v_linea.lwa_color_badge,
      'clasificacionContacto', v_clasif_efectiva
    );
  end if;

  v_lista_blanca := regexp_replace(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[^0-9,;|\n]+', '', 'g');
  if btrim(regexp_replace(v_lista_blanca, '[,;|\n]', '', 'g')) <> '' then
    v_autorizado_ia := exists (
      select 1
      from regexp_split_to_table(coalesce(v_aria.ari_detalle_aria->>'ycloud_numeros_permitidos', ''), '[,;|\n]+') as item_num
      where length(regexp_replace(item_num, '\D', '', 'g')) >= 8
        and right(v_from_digitos, 9) = right(regexp_replace(item_num, '\D', '', 'g'), 9)
    );
    if not v_autorizado_ia then
      return jsonb_build_object(
        'ok', true,
        'accion', 'FUERA_LISTA_BLANCA',
        'negocio', v_negocio,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'tipoMensaje', v_tipo_bd,
        'imagenUrl', v_imagen_url,
        'audioUrl', v_audio_url,
        'audioMime', v_audio_mime,
        'documentoUrl', v_doc_url,
        'documentoNombre', v_doc_nombre,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion,
        'visibilidad', v_cnv.cnv_visibilidad,
        'titularPrivadoId', v_cnv.cnv_titular_privado_id,
        'lineaWhatsappId', v_linea.lwa_id,
        'lineaWhatsappNombre', v_linea.lwa_nombre,
        'lineaWhatsappCodigo', v_linea.lwa_codigo,
        'lineaWhatsappColor', v_linea.lwa_color_badge
      );
    end if;
  end if;

  v_es_despedida_corta := (
    v_tipo_bd = 'TEXTO'
    and char_length(v_texto) <= 160
    and v_texto ~* '(hasta luego|hasta pronto|que tengas un (buen|excelente) d[ií]a|quedo a la orden|buena tarde)'
    and v_texto !~* '(\?|precio|cu[aá]nto|ramo|arreglo|flores|pedido|enviar|comprar|direcci[oó]n)'
  );

  if v_es_despedida_corta then
    select count(*) into v_conteo_despedidas
    from comun_agentes.agc_mensaje m
    where m.msg_conversacion_id = v_cnv.cnv_id
      and m.msg_origen = 'BOT_ARIA'
      and m.msg_creado_en >= now() - interval '5 minutes'
      and m.msg_contenido ~* '(hasta luego|hasta pronto|excelente d[ií]a|buena tarde)';

    if v_conteo_despedidas >= 1 then
      return jsonb_build_object(
        'ok', true,
        'accion', 'CORTE_BUCLE_DESPEDIDA',
        'negocio', v_negocio,
        'conversacionId', v_cnv.cnv_id,
        'claveHilo', v_clave_hilo,
        'mensajeId', v_msg_ins.msg_id,
        'contenido', v_texto,
        'remitenteNombre', v_cnv.cnv_remitente_nombre,
        'remitenteTelefono', v_cnv.cnv_remitente_telefono,
        'estadoAtencion', v_cnv.cnv_estado_atencion,
        'visibilidad', v_cnv.cnv_visibilidad,
        'titularPrivadoId', v_cnv.cnv_titular_privado_id,
        'lineaWhatsappId', v_linea.lwa_id,
        'lineaWhatsappNombre', v_linea.lwa_nombre,
        'lineaWhatsappCodigo', v_linea.lwa_codigo,
        'lineaWhatsappColor', v_linea.lwa_color_badge
      );
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'accion', 'INVOCAR_ARIA',
    'negocio', v_negocio,
    'conversacionId', v_cnv.cnv_id,
    'claveHilo', v_clave_hilo,
    'mensajeId', v_msg_ins.msg_id,
    'contenido', v_texto,
    'tipoMensaje', v_tipo_bd,
    'imagenUrl', v_imagen_url,
    'audioUrl', v_audio_url,
    'audioMime', v_audio_mime,
    'documentoUrl', v_doc_url,
    'documentoNombre', v_doc_nombre,
    'latitud', v_lat,
    'longitud', v_lng,
    'remitenteNombre', v_cnv.cnv_remitente_nombre,
    'remitenteTelefono', v_cnv.cnv_remitente_telefono,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'visibilidad', v_cnv.cnv_visibilidad,
    'titularPrivadoId', v_cnv.cnv_titular_privado_id,
    'lineaWhatsappId', v_linea.lwa_id,
    'lineaWhatsappNombre', v_linea.lwa_nombre,
    'lineaWhatsappCodigo', v_linea.lwa_codigo,
    'lineaWhatsappRol', v_linea.lwa_rol_linea,
    'lineaWhatsappColor', v_linea.lwa_color_badge,
    'clasificacionContacto', v_clasif_efectiva
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_procesar_webhook_ycloud(text, text, text, jsonb) to anon, authenticated, service_role;

-- =============================================================================
-- 10. ACTUALIZAR RESPUESTA ARIA WHATSAPP, ENVÍO ASESOR, TABLERO, MENSAJES Y PUSH
-- =============================================================================

create or replace function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(
  p_token text,
  p_conversacion_id uuid,
  p_prompt text,
  p_imagen_url text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_token text := btrim(coalesce(p_token, ''));
  v_aria comun_configuracion.cfg_aria;
  v_negocio text;
  v_cnv comun_agentes.agc_conversacion;
  v_linea comun_agentes.agc_linea_whatsapp;
  v_base_url text;
  v_agente_id text;
  v_api_key text;
  v_cuerpo_aria jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_run_id text;
  v_escala boolean := false;
  v_envio_wa jsonb;
  v_tiene_img boolean := false;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_eliminado_en is null
    and btrim(coalesce(a.ari_detalle_aria->>'ycloud_webhook_token', '')) = v_token
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Token de webhook inválido.');
  end if;

  v_negocio := v_aria.ari_negocio;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if v_cnv.cnv_ia_bloqueada_permanente or v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  if v_cnv.cnv_linea_whatsapp_id is not null then
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_id = v_cnv.cnv_linea_whatsapp_id
      and lwa_eliminado_en is null;
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');
  v_agente_id := coalesce(
    nullif(btrim(coalesce(v_linea.lwa_agente_ia_id, '')), ''),
    nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), ''),
    nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '')
  );

  if v_aria.ari_whatsapp_agente_secreto_id is not null then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_whatsapp_agente_secreto_id;
  end if;

  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key
    from vault.decrypted_secrets d
    where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_cuerpo_aria := jsonb_strip_nulls(jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', 'wa-' || regexp_replace(coalesce(v_cnv.cnv_clave_hilo, v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g'),
    'image_urls', case when p_imagen_url is not null and btrim(p_imagen_url) <> '' then jsonb_build_array(btrim(p_imagen_url)) else null end
  ));

  begin
    select h.status, h.content
    into v_status, v_content
    from extensions.http((
      'POST',
      v_base_url || '/v1/agents/' || v_agente_id || '/invoke',
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      'application/json',
      v_cuerpo_aria::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Error invocando ARIA (' || sqlerrm || ')');
  end;

  begin
    v_json := v_content::jsonb;
  exception when others then
    v_json := null;
  end;

  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object(
      'ok', false,
      'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?'))
    );
  end if;

  v_respuesta := btrim(coalesce(v_json->>'response', v_json->>'detail', ''));
  v_run_id := v_json->>'run_id';

  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió respuesta vacía.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id;

  if v_cnv.cnv_ia_bloqueada_permanente or v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then
    return jsonb_build_object('ok', true, 'silenciado', true);
  end if;

  v_escala := (v_respuesta ~* '(te comunico ahora mismo con una de nuestras asesoras|transferir con una asesora|\[ESCALAR_HUMANO\])');
  v_respuesta := btrim(regexp_replace(v_respuesta, '\[ESCALAR_HUMANO\]', '', 'gi'));

  v_envio_wa := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(
    v_negocio,
    coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
    v_respuesta,
    null,
    null,
    null,
    v_cnv.cnv_linea_whatsapp_id
  );

  v_tiene_img := (
    coalesce((v_envio_wa->>'imagenesEnviadas')::integer, 0) > 0
    or v_respuesta ~ '!\s*\[[^\]]*\]\s*\(\s*https?://'
  );

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, v_cnv.cnv_id, 'BOT_ARIA', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta, case when v_tiene_img then 'IMAGEN' else 'TEXTO' end,
    v_envio_wa->>'idExterno',
    case when coalesce((v_envio_wa->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', 'whatsapp',
      'run_id', v_run_id,
      'linea_codigo', v_linea.lwa_codigo,
      'emisor', v_envio_wa->>'emisor',
      'imagenes_urls', v_envio_wa->'imagenesUrls',
      'error_whatsapp', case when not coalesce((v_envio_wa->>'ok')::boolean, false) then v_envio_wa->>'error' else null end
    ))
  )
  returning * into v_msg_bot;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = case when v_escala then 'ESCALADO_HUMANO' else cnv_estado_atencion end,
         cnv_motivo_escalamiento = case when v_escala then 'Mía solicitó transferencia a asesora humana' else cnv_motivo_escalamiento end,
         cnv_ultimo_mensaje_texto = left(v_respuesta, 280),
         cnv_ultimo_mensaje_origen = 'BOT_ARIA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv.cnv_id
   returning * into v_cnv;

  return jsonb_build_object(
    'ok', true,
    'conversacionId', v_cnv.cnv_id,
    'claveHilo', v_cnv.cnv_clave_hilo,
    'mensajeId', v_msg_bot.msg_id,
    'respuestaAria', v_respuesta,
    'imagenesUrls', coalesce(v_envio_wa->'imagenesUrls', '[]'::jsonb),
    'autorNombre', v_msg_bot.msg_autor_nombre,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'visibilidad', v_cnv.cnv_visibilidad,
    'titularPrivadoId', v_cnv.cnv_titular_privado_id
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_responder_whatsapp_con_aria(text, uuid, text, text) to anon, authenticated, service_role;

-- Actualizar envío de asesor para respetar privacidad y despachar por la línea del hilo
create or replace function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(
  p_negocio text,
  p_conversacion_id uuid,
  p_contenido text,
  p_es_nota_interna boolean default false,
  p_respuesta_rapida_id uuid default null,
  p_imagen_url text default null,
  p_documento_url text default null,
  p_documento_nombre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_autor_nombre text;
  v_texto text := btrim(coalesce(p_contenido, ''));
  v_img text := nullif(btrim(coalesce(p_imagen_url, '')), '');
  v_doc text := nullif(btrim(coalesce(p_documento_url, '')), '');
  v_doc_nom text := nullif(btrim(coalesce(p_documento_nombre, '')), '');
  v_origen text := case when coalesce(p_es_nota_interna, false) then 'NOTA_INTERNA' else 'ASESORA_HUMANA' end;
  v_tipo_contenido text;
  v_cnv_prev comun_agentes.agc_conversacion;
  v_envio_canal jsonb := null;
  v_estado_entrega text := 'ENVIADO';
  v_id_externo text := null;
  v_msg comun_agentes.agc_mensaje;
  v_cnv comun_agentes.agc_conversacion;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para responder en este negocio.');
  end if;

  if v_texto = '' and v_img is null and v_doc is null then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje o selecciona un adjunto antes de enviar.');
  end if;

  select * into v_cnv_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv_prev.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_cnv_prev.cnv_visibilidad, v_cnv_prev.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para responder en esta conversación privada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Asesor')
    into v_autor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_tipo_contenido := case
    when v_doc is not null then 'DOCUMENTO'
    when v_img is not null or v_texto ~* '!\s*\[[^\]]*\]\s*\(\s*https?://' then 'IMAGEN'
    else 'TEXTO'
  end;

  if v_texto = '' then
    if v_doc is not null then
      v_texto := '📄 Documento enviado: ' || coalesce(v_doc_nom, 'archivo');
    elsif v_img is not null then
      v_texto := '![Fotografía adjunta](' || v_img || ')';
    end if;
  end if;

  if not coalesce(p_es_nota_interna, false) then
    if v_cnv_prev.cnv_canal = 'whatsapp' then
      v_envio_canal := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(
        v_negocio,
        coalesce(nullif(v_cnv_prev.cnv_remitente_telefono, ''), v_cnv_prev.cnv_remitente_id),
        v_texto,
        v_img,
        v_doc,
        v_doc_nom,
        v_cnv_prev.cnv_linea_whatsapp_id
      );
    elsif v_cnv_prev.cnv_canal in ('facebook', 'instagram') then
      v_envio_canal := comun_comercio.com_fn_interno_despachar_meta_mensajeria(
        v_negocio,
        v_cnv_prev.cnv_canal,
        v_cnv_prev.cnv_remitente_id,
        v_texto,
        v_img,
        v_doc,
        v_doc_nom,
        v_cnv_prev.cnv_ventana_24h_expira_en,
        true
      );
    end if;

    if v_envio_canal is not null then
      if coalesce((v_envio_canal->>'ok')::boolean, false) then
        v_id_externo := v_envio_canal->>'idExterno';
        v_estado_entrega := 'ENVIADO';
      else
        v_estado_entrega := 'FALLIDO';
      end if;
    end if;
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, p_conversacion_id, v_origen, v_uid, v_autor_nombre,
    v_texto, v_tipo_contenido, v_id_externo, v_estado_entrega,
    jsonb_strip_nulls(jsonb_build_object(
      'intervencion_humana', (not coalesce(p_es_nota_interna, false)),
      'respuesta_rapida_id', p_respuesta_rapida_id,
      'canal', v_cnv_prev.cnv_canal,
      'emisor', case when v_envio_canal is not null then v_envio_canal->>'emisor' else null end,
      'imagen_url', v_img,
      'documento_url', v_doc,
      'documento_nombre', v_doc_nom,
      'error_whatsapp', case when v_cnv_prev.cnv_canal = 'whatsapp' and v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
      'error_canal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end
    ))
  )
  returning * into v_msg;

  if p_respuesta_rapida_id is not null then
    update comun_agentes.agc_respuesta_rapida
       set rrp_uso_conteo = rrp_uso_conteo + 1,
           rrp_actualizado_en = now()
     where rrp_id = p_respuesta_rapida_id
       and rrp_negocio = v_negocio;
  end if;

  if not coalesce(p_es_nota_interna, false) then
    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_asesora_asignada_id = coalesce(cnv_asesora_asignada_id, v_uid),
           cnv_atribuido_por = case when cnv_asesora_asignada_id is null then 'MANUAL' else cnv_atribuido_por end,
           cnv_ultimo_mensaje_texto = left(v_texto, 280),
           cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = 0,
           cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
     returning * into v_cnv;
  else
    select * into v_cnv from comun_agentes.agc_conversacion where cnv_id = p_conversacion_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'canal', v_cnv.cnv_canal,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo,
    'visibilidad', v_cnv.cnv_visibilidad,
    'avisoWhatsApp', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
    'avisoCanal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
    'mensaje', jsonb_build_object(
      'id', v_msg.msg_id,
      'origen', v_msg.msg_origen,
      'autorUsuarioId', v_msg.msg_autor_usuario_id,
      'autorNombre', v_msg.msg_autor_nombre,
      'contenido', v_msg.msg_contenido,
      'tipoContenido', v_msg.msg_tipo_contenido,
      'estadoEntrega', v_msg.msg_estado_entrega,
      'detalle', v_msg.msg_detalle_mensaje,
      'creadoEn', v_msg.msg_creado_en
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid, text, text, text) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid, text, text, text) to authenticated, service_role;

-- Actualizar responder_con_aria_panel para respetar bloqueo de contacto personal y línea WhatsApp
create or replace function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(
  p_negocio text,
  p_conversacion_id uuid,
  p_prompt text
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, pg_temp
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_aria comun_configuracion.cfg_aria;
  v_cnv comun_agentes.agc_conversacion;
  v_linea comun_agentes.agc_linea_whatsapp;
  v_base_url text;
  v_agente_id text;
  v_api_key text;
  v_prefijo_conv text;
  v_cuerpo_aria jsonb;
  v_status integer;
  v_content text;
  v_json jsonb;
  v_respuesta text;
  v_run_id text;
  v_envio_canal jsonb := null;
  v_msg_bot comun_agentes.agc_mensaje;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para invocar ARIA en este chat.');
  end if;

  select * into v_aria
  from comun_configuracion.cfg_aria a
  where a.ari_negocio = v_negocio and a.ari_eliminado_en is null
  limit 1;

  if v_aria.ari_id is null then
    return jsonb_build_object('ok', false, 'error', 'Configura ARIA primero en /panel/aria.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_cnv.cnv_visibilidad, v_cnv.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'No tienes acceso a esta conversación privada.');
  end if;

  if v_cnv.cnv_ia_bloqueada_permanente then
    return jsonb_build_object('ok', false, 'error', 'La IA está bloqueada en este contacto Personal. Pásalo a Ventas/Cliente primero si deseas usar ARIA.');
  end if;

  if v_cnv.cnv_linea_whatsapp_id is not null then
    select * into v_linea
    from comun_agentes.agc_linea_whatsapp
    where lwa_id = v_cnv.cnv_linea_whatsapp_id and lwa_eliminado_en is null;
  end if;

  v_base_url := regexp_replace(btrim(coalesce(v_aria.ari_base_url, 'https://aria.midomo.site')), '/+$', '');
  v_agente_id := coalesce(
    nullif(btrim(coalesce(v_linea.lwa_agente_ia_id, '')), ''),
    nullif(btrim(coalesce(v_aria.ari_detalle_aria->>'whatsapp_agente_id', '')), ''),
    nullif(btrim(coalesce(v_aria.ari_agente_id, '')), '')
  );

  if v_aria.ari_whatsapp_agente_secreto_id is not null then
    select d.decrypted_secret into v_api_key from vault.decrypted_secrets d where d.id = v_aria.ari_whatsapp_agente_secreto_id;
  end if;
  if v_api_key is null or btrim(v_api_key) = '' then
    select d.decrypted_secret into v_api_key from vault.decrypted_secrets d where d.id = v_aria.ari_secreto_id;
  end if;

  if v_agente_id is null or v_api_key is null or btrim(v_api_key) = '' then
    return jsonb_build_object('ok', false, 'error', 'Faltan credenciales del agente ARIA en Vault (/panel/aria).');
  end if;

  perform pg_catalog.set_config('statement_timeout', '55000', true);
  perform extensions.http_set_curlopt('CURLOPT_TIMEOUT', '48');
  perform extensions.http_set_curlopt('CURLOPT_CONNECTTIMEOUT', '10');

  v_prefijo_conv := case v_cnv.cnv_canal
    when 'whatsapp' then 'wa-'
    when 'facebook' then 'fb-'
    when 'instagram' then 'ig-'
    else 'web-'
  end;

  v_cuerpo_aria := jsonb_build_object(
    'prompt', left(btrim(coalesce(p_prompt, '')), 3800),
    'conversation_id', v_prefijo_conv || regexp_replace(coalesce(v_cnv.cnv_clave_hilo, v_cnv.cnv_remitente_id, v_cnv.cnv_id::text), '[^A-Za-z0-9_-]', '', 'g')
  );

  begin
    select h.status, h.content into v_status, v_content
    from extensions.http((
      'POST',
      v_base_url || '/v1/agents/' || v_agente_id || '/invoke',
      array[extensions.http_header('Authorization', 'Bearer ' || v_api_key)],
      'application/json',
      v_cuerpo_aria::text
    )::extensions.http_request) as h;
  exception when others then
    return jsonb_build_object('ok', false, 'error', 'Error invocando ARIA (' || sqlerrm || ')');
  end;

  v_json := v_content::jsonb;
  if v_status < 200 or v_status >= 300 then
    return jsonb_build_object('ok', false, 'error', coalesce(v_json->>'detail', v_json->>'error', 'ARIA respondió HTTP ' || coalesce(v_status::text, '?')));
  end if;

  v_respuesta := btrim(regexp_replace(coalesce(v_json->>'response', v_json->>'detail', ''), '\[ESCALAR_HUMANO\]', '', 'gi'));
  v_run_id := v_json->>'run_id';

  if v_respuesta = '' then
    return jsonb_build_object('ok', false, 'error', 'ARIA devolvió una respuesta vacía.');
  end if;

  if v_cnv.cnv_canal = 'whatsapp' then
    v_envio_canal := comun_comercio.com_fn_interno_despachar_whatsapp_ycloud_linea(
      v_negocio,
      coalesce(nullif(v_cnv.cnv_remitente_telefono, ''), v_cnv.cnv_remitente_id),
      v_respuesta,
      null,
      null,
      null,
      v_cnv.cnv_linea_whatsapp_id
    );
  elsif v_cnv.cnv_canal in ('facebook', 'instagram') then
    v_envio_canal := comun_comercio.com_fn_interno_despachar_meta_mensajeria(
      v_negocio, v_cnv.cnv_canal, v_cnv.cnv_remitente_id, v_respuesta,
      null, null, null, v_cnv.cnv_ventana_24h_expira_en, false
    );
  end if;

  insert into comun_agentes.agc_mensaje (
    msg_negocio, msg_conversacion_id, msg_origen, msg_autor_nombre,
    msg_contenido, msg_tipo_contenido, msg_id_externo, msg_estado_entrega, msg_detalle_mensaje
  ) values (
    v_negocio, v_cnv.cnv_id, 'BOT_ARIA', coalesce(v_aria.ari_nombre_agente, 'Mía · ARIA'),
    v_respuesta, case when v_respuesta ~* '!\s*\[[^\]]*\]\s*\(\s*https?://' then 'IMAGEN' else 'TEXTO' end,
    case when v_envio_canal is not null then v_envio_canal->>'idExterno' else null end,
    case when v_envio_canal is null or coalesce((v_envio_canal->>'ok')::boolean, false) then 'ENVIADO' else 'FALLIDO' end,
    jsonb_strip_nulls(jsonb_build_object(
      'canal', v_cnv.cnv_canal,
      'run_id', v_run_id,
      'linea_codigo', v_linea.lwa_codigo,
      'emisor', case when v_envio_canal is not null then v_envio_canal->>'emisor' else null end,
      'error_canal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end
    ))
  )
  returning * into v_msg_bot;

  update comun_agentes.agc_conversacion
     set cnv_ultimo_mensaje_texto = left(v_respuesta, 280),
         cnv_ultimo_mensaje_origen = 'BOT_ARIA',
         cnv_ultimo_mensaje_en = now(),
         cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
         cnv_actualizado_en = now()
   where cnv_id = v_cnv.cnv_id;

  return jsonb_build_object(
    'ok', true,
    'respuestaAria', v_respuesta,
    'avisoCanal', case when v_envio_canal is not null and not coalesce((v_envio_canal->>'ok')::boolean, false) then v_envio_canal->>'error' else null end,
    'mensaje', jsonb_build_object(
      'id', v_msg_bot.msg_id,
      'origen', v_msg_bot.msg_origen,
      'autorNombre', v_msg_bot.msg_autor_nombre,
      'contenido', v_msg_bot.msg_contenido,
      'tipoContenido', v_msg_bot.msg_tipo_contenido,
      'estadoEntrega', v_msg_bot.msg_estado_entrega,
      'detalle', v_msg_bot.msg_detalle_mensaje,
      'creadoEn', v_msg_bot.msg_creado_en
    )
  );
end;
$$;

revoke all on function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(text, uuid, text) from public, anon;
grant execute on function comun_comercio.com_fn_omnicanal_responder_con_aria_panel(text, uuid, text) to authenticated, service_role;

-- Actualizar obtener_mensajes con control estricto de privacidad
create or replace function comun_comercio.com_fn_omnicanal_obtener_mensajes(
  p_negocio text,
  p_conversacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_cnv comun_agentes.agc_conversacion;
  v_mensajes jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin autorización para leer esta conversación.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id
    and cnv_negocio = v_negocio
    and cnv_eliminado_en is null;

  if v_cnv.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_cnv.cnv_visibilidad, v_cnv.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'Conversación privada restringida a Administradores o titular.');
  end if;

  update comun_agentes.agc_conversacion
     set cnv_no_leidos_asesora = 0
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.msg_id,
      'origen', m.msg_origen,
      'autorUsuarioId', m.msg_autor_usuario_id,
      'autorNombre', m.msg_autor_nombre,
      'contenido', m.msg_contenido,
      'tipoContenido', m.msg_tipo_contenido,
      'estadoEntrega', m.msg_estado_entrega,
      'detalle', m.msg_detalle_mensaje,
      'creadoEn', m.msg_creado_en
    ) order by m.msg_creado_en asc
  ), '[]'::jsonb)
  into v_mensajes
  from comun_agentes.agc_mensaje m
  where m.msg_conversacion_id = p_conversacion_id
    and m.msg_negocio = v_negocio
    and m.msg_eliminado_en is null;

  return jsonb_build_object('ok', true, 'mensajes', v_mensajes);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_mensajes(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_mensajes(text, uuid) to authenticated, service_role;

-- Actualizar actualizar_conversacion para validar privacidad y evitar reactivar IA en Personal
create or replace function comun_comercio.com_fn_omnicanal_actualizar_conversacion(
  p_negocio text,
  p_conversacion_id uuid,
  p_nuevo_estado text default null,
  p_asesora_id uuid default null,
  p_desasignar boolean default false,
  p_recordatorio_en timestamptz default null,
  p_recordatorio_nota text default null,
  p_limpiar_recordatorio boolean default false,
  p_marcar_no_leido boolean default false,
  p_motivo_cierre text default null,
  p_nota_cierre text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_actor text;
  v_prev comun_agentes.agc_conversacion;
  v_cnv comun_agentes.agc_conversacion;
  v_evento_texto text;
  v_motivo_codigo text := nullif(upper(btrim(coalesce(p_motivo_cierre, ''))), '');
  v_motivo_etiqueta text;
  v_nota_cierre text := nullif(btrim(coalesce(p_nota_cierre, '')), '');
  v_detalle_actualizado jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para gestionar esta conversación.');
  end if;

  select * into v_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id and cnv_negocio = v_negocio and cnv_eliminado_en is null;

  if v_prev.cnv_id is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  if not comun_agentes.agc_fn_puede_ver_conversacion(v_negocio, v_prev.cnv_visibilidad, v_prev.cnv_titular_privado_id, null) then
    return jsonb_build_object('ok', false, 'error', 'No tienes acceso a esta conversación privada.');
  end if;

  if p_nuevo_estado = 'BOT_ACTIVO' and v_prev.cnv_ia_bloqueada_permanente then
    return jsonb_build_object('ok', false, 'error', 'Este contacto está marcado como Personal (IA bloqueada). Usa «Pasar a Ventas» primero si deseas activar ARIA.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_motivo_etiqueta := case v_motivo_codigo
    when 'VENTA_COMPLETADA' then '✅ Venta completada'
    when 'COTIZACION_ENVIADA' then '📄 Cotización / Proforma enviada'
    when 'CONSULTA_RESUELTA' then 'ℹ️ Consulta informativa resuelta'
    when 'NO_RESPONDE' then '⏳ No responde'
    when 'NO_DESEA_CONTINUAR' then '❌ No desea continuar'
    when 'SIN_DISPONIBILIDAD_COBERTURA' then '🚫 Sin stock o fuera de cobertura'
    when 'SPAM_EQUIVOCADO' then '🗑️ Spam / Número equivocado'
    else coalesce(nullif(btrim(coalesce(p_motivo_cierre, '')), ''), 'Cerrado')
  end;

  v_detalle_actualizado := coalesce(v_prev.cnv_detalle_conversacion, '{}'::jsonb);

  if p_nuevo_estado = 'CERRADO' then
    v_detalle_actualizado := jsonb_set(
      v_detalle_actualizado,
      '{cierre}',
      jsonb_build_object(
        'motivoCodigo', coalesce(v_motivo_codigo, 'CONSULTA_RESUELTA'),
        'motivoEtiqueta', v_motivo_etiqueta,
        'nota', v_nota_cierre,
        'cerradoEn', now(),
        'cerradoPor', v_actor
      ),
      true
    );
  elsif p_nuevo_estado is not null and p_nuevo_estado <> 'CERRADO' then
    v_detalle_actualizado := v_detalle_actualizado - 'cierre';
  end if;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = coalesce(p_nuevo_estado, cnv_estado_atencion),
         cnv_asesora_asignada_id = case
           when p_desasignar then null
           when p_asesora_id is not null then p_asesora_id
           when p_nuevo_estado = 'EN_ATENCION_ASESORA' and cnv_asesora_asignada_id is null then v_uid
           else cnv_asesora_asignada_id
         end,
         cnv_atribuido_por = case
           when p_asesora_id is not null or p_nuevo_estado = 'EN_ATENCION_ASESORA' then 'MANUAL'
           else cnv_atribuido_por
         end,
         cnv_recordatorio_en = case
           when p_limpiar_recordatorio or p_nuevo_estado = 'CERRADO' then null
           when p_recordatorio_en is not null then p_recordatorio_en
           else cnv_recordatorio_en
         end,
         cnv_recordatorio_nota = case
           when p_limpiar_recordatorio or p_nuevo_estado = 'CERRADO' then null
           when p_recordatorio_nota is not null then btrim(p_recordatorio_nota)
           else cnv_recordatorio_nota
         end,
         cnv_no_leidos_asesora = case
           when coalesce(p_marcar_no_leido, false) then greatest(cnv_no_leidos_asesora, 1)
           when p_nuevo_estado = 'CERRADO' then 0
           else cnv_no_leidos_asesora
         end,
         cnv_detalle_conversacion = v_detalle_actualizado,
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
   returning * into v_cnv;

  if p_nuevo_estado is not null and p_nuevo_estado <> v_prev.cnv_estado_atencion then
    if p_nuevo_estado = 'CERRADO' then
      v_evento_texto := v_actor || ' cerró la conversación · Motivo: ' || v_motivo_etiqueta
        || case when v_nota_cierre is not null then ' (' || v_nota_cierre || ')' else '' end;
    elsif v_prev.cnv_estado_atencion = 'CERRADO' then
      v_evento_texto := v_actor || ' reabrió el hilo (Conversación Abierta).';
    else
      v_evento_texto := case p_nuevo_estado
        when 'EN_ATENCION_ASESORA' then v_actor || ' pausó a ARIA y tomó el control humano.'
        when 'BOT_ACTIVO' then v_actor || ' reactivó la atención automática con IA ARIA.'
        when 'ESCALADO_HUMANO' then v_actor || ' marcó el chat como Escalado a Humano.'
        when 'EN_ESPERA_CLIENTE' then v_actor || ' puso la conversación en espera del cliente.'
        else v_actor || ' cambió el estado a ' || p_nuevo_estado
      end;
    end if;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    ) values (
      v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor, v_evento_texto, 'TEXTO'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'recordatorioEn', v_cnv.cnv_recordatorio_en,
    'recordatorioNota', v_cnv.cnv_recordatorio_nota,
    'noLeidosAsesora', v_cnv.cnv_no_leidos_asesora,
    'cierre', coalesce(v_cnv.cnv_detalle_conversacion->'cierre', 'null'::jsonb)
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean, boolean, text, text) to authenticated, service_role;

-- Actualizar com_fn_omnicanal_obtener_tablero usando to_jsonb(sub) (sin límite de 100 args) + filtro de privacidad + líneas WhatsApp
create or replace function comun_comercio.com_fn_omnicanal_obtener_tablero(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_es_admin_etiquetas boolean := false;
  v_es_admin_aplicacion boolean := false;
  v_etiquetas jsonb;
  v_respuestas jsonb;
  v_equipo jsonb;
  v_lineas jsonb;
  v_conversaciones jsonb;
  v_usuarios_web jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo de ventas y administración.');
  end if;

  v_es_admin_etiquetas := comun_seguridad.seg_fn_es_admin_u_operador_etiquetas(v_negocio);
  v_es_admin_aplicacion := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.etq_id,
      'slug', e.etq_slug,
      'nombre', e.etq_nombre,
      'color', e.etq_color,
      'icono', e.etq_icono,
      'orden', e.etq_orden
    ) order by e.etq_orden asc, e.etq_nombre asc
  ), '[]'::jsonb)
  into v_etiquetas
  from comun_agentes.agc_etiqueta e
  where e.etq_negocio = v_negocio
    and e.etq_activo = true
    and e.etq_eliminado_en is null
    and e.etq_slug not in ('origen-whatsapp', 'origen-web');

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.rrp_id,
      'atajo', r.rrp_atajo,
      'titulo', r.rrp_titulo,
      'categoria', r.rrp_categoria,
      'contenido', r.rrp_contenido,
      'usoConteo', r.rrp_uso_conteo
    ) order by r.rrp_categoria asc, r.rrp_atajo asc
  ), '[]'::jsonb)
  into v_respuestas
  from comun_agentes.agc_respuesta_rapida r
  where r.rrp_negocio = v_negocio
    and r.rrp_activo = true
    and r.rrp_eliminado_en is null;

  select coalesce(jsonb_agg(to_jsonb(lw) order by lw."esPrincipal" desc, lw."nombre" asc), '[]'::jsonb)
  into v_lineas
  from (
    select
      l.lwa_id as "id",
      l.lwa_codigo as "codigo",
      l.lwa_nombre as "nombre",
      l.lwa_rol_linea as "rolLinea",
      l.lwa_numero_e164 as "numeroE164",
      l.lwa_titular_usuario_id as "titularUsuarioId",
      l.lwa_es_principal as "esPrincipal",
      l.lwa_habilitado as "habilitado",
      l.lwa_ia_desconocidos_activa as "iaDesconocidosActiva",
      l.lwa_ia_clientes_activa as "iaClientesActiva",
      l.lwa_politica_personales as "politicaPersonales",
      l.lwa_visibilidad_clientes as "visibilidadClientes",
      l.lwa_color_badge as "colorBadge"
    from comun_agentes.agc_linea_whatsapp l
    where l.lwa_negocio = v_negocio
      and l.lwa_eliminado_en is null
  ) lw;

  select coalesce(jsonb_agg(sub.miembro order by sub.nombre asc), '[]'::jsonb)
  into v_equipo
  from (
    select distinct on (u.usu_id)
      u.usu_id,
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo) as nombre,
      jsonb_build_object(
        'usuarioId', u.usu_id,
        'nombre', coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo),
        'correo', u.usu_correo,
        'avatarUrl', u.usu_detalle_usuario->>'foto',
        'rol', case
          when u.usu_superadmin_plataforma or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com') then 'SUPERADMIN'
          else coalesce(p.per_clave, m.mem_rol, 'VENTAS')
        end,
        'chatsActivos', (
          select count(*)
          from comun_agentes.agc_conversacion ca
          where ca.cnv_negocio = v_negocio
            and ca.cnv_canal <> 'interno'
            and ca.cnv_asesora_asignada_id = u.usu_id
            and ca.cnv_estado_atencion <> 'CERRADO'
            and ca.cnv_eliminado_en is null
            and comun_agentes.agc_fn_puede_ver_conversacion(ca.cnv_negocio, ca.cnv_visibilidad, ca.cnv_titular_privado_id, null)
        )
      ) as miembro
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
      and (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) sub;

  -- Proyección con to_jsonb(sub) para evitar límite de 100 argumentos en PostgreSQL
  select coalesce(jsonb_agg(
    to_jsonb(sub) order by
      case when sub."estadoAtencion" = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      sub."ultimoMensajeEn" desc
  ), '[]'::jsonb)
  into v_conversaciones
  from (
    select
      c.cnv_id as "id",
      c.cnv_secuencial as "secuencial",
      c.cnv_negocio as "negocio",
      c.cnv_canal as "canal",
      c.cnv_clave_hilo as "claveHilo",
      c.cnv_remitente_id as "remitenteId",
      c.cnv_remitente_nombre as "remitenteNombre",
      c.cnv_remitente_correo as "remitenteCorreo",
      c.cnv_remitente_telefono as "remitenteTelefono",
      c.cnv_usuario_id as "usuarioId",
      c.cnv_cliente_id as "clienteId",
      c.cnv_estado_atencion as "estadoAtencion",
      c.cnv_asesora_asignada_id as "asesoraAsignadaId",
      (
        select btrim(coalesce(ua.usu_nombres, '') || ' ' || coalesce(ua.usu_apellidos, ''))
        from comun_seguridad.seg_usuario ua
        where ua.usu_id = c.cnv_asesora_asignada_id
      ) as "asesoraNombre",
      c.cnv_ultimo_mensaje_texto as "ultimoMensajeTexto",
      c.cnv_ultimo_mensaje_origen as "ultimoMensajeOrigen",
      c.cnv_ultimo_mensaje_en as "ultimoMensajeEn",
      c.cnv_no_leidos_asesora as "noLeidosAsesora",
      c.cnv_mensajes_cliente_conteo as "mensajesClienteConteo",
      c.cnv_mensajes_ia_conteo as "mensajesIaConteo",
      c.cnv_mensajes_humano_conteo as "mensajesHumanoConteo",
      c.cnv_motivo_escalamiento as "motivoEscalamiento",
      c.cnv_recordatorio_en as "recordatorioEn",
      c.cnv_recordatorio_nota as "recordatorioNota",
      c.cnv_ventana_24h_expira_en as "ventana24hExpiraEn",
      c.cnv_creado_en as "creadoEn",
      c.cnv_linea_whatsapp_id as "lineaWhatsappId",
      lw.lwa_codigo as "lineaWhatsappCodigo",
      lw.lwa_nombre as "lineaWhatsappNombre",
      lw.lwa_rol_linea as "lineaWhatsappRol",
      lw.lwa_color_badge as "lineaWhatsappColor",
      lw.lwa_numero_e164 as "lineaWhatsappNumero",
      c.cnv_visibilidad as "visibilidad",
      c.cnv_titular_privado_id as "titularPrivadoId",
      c.cnv_ia_bloqueada_permanente as "iaBloqueadaPermanente",
      cd.cdo_clasificacion as "contactoClasificacion",
      cd.cdo_politica_ia as "contactoPoliticaIa",
      coalesce(c.cnv_detalle_conversacion->'datos_venta', '{}'::jsonb) as "datosVenta",
      coalesce(c.cnv_detalle_conversacion->'cierre', 'null'::jsonb) as "cierre",
      coalesce(c.cnv_detalle_conversacion->'ficha_cliente', 'null'::jsonb) as "fichaCliente",
      coalesce(c.cnv_detalle_conversacion->'puente_omnicanal', 'null'::jsonb) as "puenteOmnicanal",
      coalesce((
        select jsonb_agg(ce.cet_etiqueta_id)
        from comun_agentes.agc_conversacion_etiqueta ce
        join comun_agentes.agc_etiqueta et on et.etq_id = ce.cet_etiqueta_id
        where ce.cet_conversacion_id = c.cnv_id
          and ce.cet_eliminado_en is null
          and et.etq_activo = true
          and et.etq_eliminado_en is null
          and et.etq_slug not in ('origen-whatsapp', 'origen-web')
      ), '[]'::jsonb) as "etiquetasIds"
    from (
      select *
      from comun_agentes.agc_conversacion
      where cnv_negocio = v_negocio
        and cnv_canal <> 'interno'
        and cnv_eliminado_en is null
        and comun_agentes.agc_fn_puede_ver_conversacion(cnv_negocio, cnv_visibilidad, cnv_titular_privado_id, null)
      order by
        case when cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
        cnv_ultimo_mensaje_en desc
      limit 250
    ) c
    left join comun_agentes.agc_linea_whatsapp lw on lw.lwa_id = c.cnv_linea_whatsapp_id
    left join comun_agentes.agc_contacto_directorio cd on cd.cdo_id = c.cnv_contacto_directorio_id
  ) sub;

  select coalesce(jsonb_agg(item order by creado_en desc), '[]'::jsonb)
  into v_usuarios_web
  from (
    select
      u.usu_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'usu:' || u.usu_id::text,
        'usuarioId', u.usu_id,
        'clienteId', cl.cli_id,
        'tipoCuenta', 'USUARIO_REGISTRADO',
        'nombre', coalesce(
          nullif(btrim(coalesce(cl.cli_detalle_cliente->'ficha_cliente'->>'nombrePersonalizado', '')), ''),
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')), ''),
          u.usu_correo
        ),
        'correo', u.usu_correo,
        'telefono', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          nullif(btrim(coalesce(u.usu_whatsapp, '')), ''),
          cl.cli_telefono
        ),
        'identificacion', coalesce(cl.cli_identificacion, u.usu_cedula),
        'autorizaWhatsapp', coalesce(
          case
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('true', 't', '1', 'si', 'yes') then true
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('false', 'f', '0', 'no') then false
            else null
          end,
          u.usu_autorizacion_whatsapp,
          false
        ),
        'rolNegocio', coalesce(m.mem_rol, 'CLIENTE'),
        'totalCompras', coalesce(cl.cli_total_compras, 0),
        'montoAcumulado', coalesce(cl.cli_monto_acumulado, 0),
        'ultimaCompraEn', cl.cli_ultima_compra_en,
        'creadoEn', coalesce(m.mem_creado_en, u.usu_creado_en),
        'calificacionEstrellas', (cl.cli_detalle_cliente->'ficha_cliente'->>'calificacionEstrellas')::integer,
        'notasCliente', cl.cli_detalle_cliente->'ficha_cliente'->>'notasCliente',
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cl.cli_id is not null and cle.cle_cliente_id = cl.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join lateral (
      select c.*
      from comun_comercio.com_cliente c
      where c.cli_negocio = v_negocio
        and c.cli_eliminado_en is null
        and (c.cli_usuario_id = u.usu_id or (u.usu_correo is not null and lower(c.cli_correo) = lower(u.usu_correo)))
      order by c.cli_actualizado_en desc
      limit 1
    ) cl on true
    where m.mem_estado = 'ACTIVO'
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio

    union all

    select
      c.cli_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'cli:' || c.cli_id::text,
        'usuarioId', null,
        'clienteId', c.cli_id,
        'tipoCuenta', 'INVITADO_NO_REGISTRADO',
        'nombre', coalesce(nullif(btrim(coalesce(c.cli_detalle_cliente->'ficha_cliente'->>'nombrePersonalizado', '')), ''), c.cli_nombre),
        'correo', c.cli_correo,
        'telefono', c.cli_telefono,
        'identificacion', c.cli_identificacion,
        'autorizaWhatsapp', (
          lower(btrim(coalesce(c.cli_detalle_cliente->'datos_capturados'->>'autorizaWhatsapp', ''))) in ('true', 't', '1', 'si', 'yes')
        ),
        'rolNegocio', 'INVITADO',
        'totalCompras', c.cli_total_compras,
        'montoAcumulado', c.cli_monto_acumulado,
        'ultimaCompraEn', c.cli_ultima_compra_en,
        'creadoEn', c.cli_creado_en,
        'calificacionEstrellas', (c.cli_detalle_cliente->'ficha_cliente'->>'calificacionEstrellas')::integer,
        'notasCliente', c.cli_detalle_cliente->'ficha_cliente'->>'notasCliente',
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cle.cle_cliente_id = c.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and c.cli_eliminado_en is null
      and c.cli_usuario_id is null
      and not exists (
        select 1
        from comun_seguridad.seg_usuario u2
        join comun_seguridad.seg_membresia m2 on m2.mem_usuario_id = u2.usu_id
        where c.cli_correo is not null
          and lower(u2.usu_correo) = lower(c.cli_correo)
          and comun_seguridad.seg_fn_normalizar_negocio(m2.mem_negocio) = v_negocio
          and m2.mem_estado = 'ACTIVO'
      )
  ) directorio;

  return jsonb_build_object(
    'ok', true,
    'esAdminEtiquetas', v_es_admin_etiquetas,
    'esAdminAplicacion', v_es_admin_aplicacion,
    'conversaciones', v_conversaciones,
    'etiquetas', v_etiquetas,
    'respuestasRapidas', v_respuestas,
    'equipo', v_equipo,
    'lineasWhatsapp', v_lineas,
    'usuariosYClientes', v_usuarios_web
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) to authenticated, service_role;

-- Actualizar Push staff (v2 sin sobrecarga PostgREST) para soportar chats SOLO_ADMIN y SOLO_TITULAR
create or replace function comun_comercio.com_fn_push_obtener_contexto_envio_staff_v2(
  p_negocio text,
  p_token_webhook text default null,
  p_excluir_usuario_id uuid default null,
  p_solo_ventas boolean default false,
  p_solo_admins boolean default false,
  p_solo_usuario_id uuid default null
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
     and (
       btrim(coalesce(v_aria.ari_detalle_aria->>'ycloud_webhook_token', '')) = btrim(p_token_webhook)
       or btrim(coalesce(v_aria.ari_detalle_aria->>'meta_webhook_token', '')) = btrim(p_token_webhook)
     ) then
    v_autorizado := true;
  elsif v_uid is not null then
    select exists (
      select 1
      from comun_seguridad.seg_usuario u
      left join comun_seguridad.seg_membresia m
        on m.mem_usuario_id = u.usu_id
       and m.mem_estado = 'ACTIVO'
       and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
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
     and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio
    where u.usu_eliminado_en is null
      and (p_excluir_usuario_id is null or u.usu_id <> p_excluir_usuario_id)
      and (p_solo_usuario_id is null or u.usu_id = p_solo_usuario_id)
      and (
        u.usu_superadmin_plataforma = true
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or (
          coalesce(p_solo_admins, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN')
        )
        or (
          not coalesce(p_solo_admins, false)
          and not coalesce(p_solo_ventas, false)
          and upper(coalesce(m.mem_rol, '')) in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN', 'OPERADOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'TALLER', 'DELIVERY', 'DELIVERY_EXTERNO')
        )
        or (
          not coalesce(p_solo_admins, false)
          and coalesce(p_solo_ventas, false)
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

revoke all on function comun_comercio.com_fn_push_obtener_contexto_envio_staff_v2(text, text, uuid, boolean, boolean, uuid) from public;
grant execute on function comun_comercio.com_fn_push_obtener_contexto_envio_staff_v2(text, text, uuid, boolean, boolean, uuid) to anon, authenticated, service_role;

-- =============================================================================
-- 11. REGISTRO Y PRE-CONFIGURACIÓN DEL WIDGET `directorio_contactos` (Regla 15)
-- =============================================================================

do $$
declare
  v_negocio text;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'tranqi', 'fastfix', 'margaritas']) loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget
    ) values (
      v_negocio,
      'directorio_contactos',
      'Contactos y Listas WhatsApp',
      true,
      jsonb_build_object(
        'descripcion', 'Extracción multi-fuente (.vcf, .csv, .xlsx, Android Contact Picker), consolidación Join/Merge, clasificación Personal/Cliente y listas a ignorar por línea WhatsApp.',
        'categoria', 'Comercio y Atención Omnicanal',
        'ruta', '/panel/contactos',
        'panel_defecto', 'panel_administrar',
        'icono', 'Contact'
      )
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now()
    returning wdg_id into v_widget_id;

    if v_widget_id is null then
      select wdg_id into v_widget_id
      from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio and wdg_clave = 'directorio_contactos';
    end if;

    if v_widget_id is not null then
      insert into comun_seguridad.seg_rol_widget (
        rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible
      ) values
        (v_negocio, 'VENTAS', v_widget_id, true),
        (v_negocio, 'VENDEDOR', v_widget_id, true),
        (v_negocio, 'OPERADOR', v_widget_id, true),
        (v_negocio, 'ADMINISTRADOR', v_widget_id, true),
        (v_negocio, 'SUPERADMIN', v_widget_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
