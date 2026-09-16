-- Migration: 20260916000001_comun_seguridad_tokens_mcp.sql
-- Implementación de Tokens de Acceso MCP / API Keys por Negocio (PLT-022)
-- Permite que cada negocio genere, liste y revoque credenciales de integración seguras
-- para exponer herramientas MCP (como el Catálogo Comercial) a clientes externos (bots WhatsApp, n8n, Claude, etc.).

-- 1. TABLA comun_seguridad.seg_token_mcp
-- ====================================================================
create table if not exists comun_seguridad.seg_token_mcp (
  tkn_id uuid primary key default gen_random_uuid(),
  tkn_secuencial bigint generated always as identity,
  tkn_negocio_id text not null,               -- 'tinkay' | 'fastfix' | 'tranqi' | 'margaritas'
  tkn_nombre text not null,                   -- Nombre descriptivo ej: 'WhatsApp Bot YCloud'
  tkn_prefijo text not null,                  -- 'eco_live_ab1234...'
  tkn_hash_secreto text not null,             -- SHA-256 del token completo
  tkn_alcances jsonb not null default '["catalogo:leer"]'::jsonb, -- Scopes permitidos
  tkn_expira_en timestamptz,                  -- null = sin expiración
  tkn_ultimo_uso_en timestamptz,              -- Fecha de la última invocación válida
  tkn_revocado_en timestamptz,                -- null = activo; fecha = revocado
  tkn_detalle_token jsonb not null default '{}'::jsonb,
  tkn_creado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  tkn_creado_en timestamptz not null default now(),
  tkn_actualizado_en timestamptz not null default now()
);

-- Índices de búsqueda eficiente y unicidad
create unique index if not exists seg_token_mcp_hash_idx on comun_seguridad.seg_token_mcp (tkn_hash_secreto);
create index if not exists seg_token_mcp_negocio_idx on comun_seguridad.seg_token_mcp (tkn_negocio_id, tkn_creado_en desc);

-- RLS y Auditoría
alter table comun_seguridad.seg_token_mcp enable row level security;

drop trigger if exists trg_auditoria_seg_token_mcp on comun_seguridad.seg_token_mcp;
create trigger trg_auditoria_seg_token_mcp
  after insert or update or delete on comun_seguridad.seg_token_mcp
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- Políticas RLS: Administradores solo ven tokens de su propio negocio
drop policy if exists seg_token_mcp_admin_select on comun_seguridad.seg_token_mcp;
create policy seg_token_mcp_admin_select on comun_seguridad.seg_token_mcp
  for select using (comun_seguridad.seg_fn_es_admin_negocio(tkn_negocio_id));

-- 2. FUNCIONES RPC PARA ADMINISTRACIÓN Y VALIDACIÓN DE TOKENS MCP
-- ====================================================================

-- 2.1 Generar Token MCP (Retorna el token en texto plano UNA ÚNICA VEZ)
create or replace function comun_seguridad.seg_fn_generar_token_mcp(
  p_negocio_id text,
  p_nombre text,
  p_alcances jsonb default '["catalogo:leer"]'::jsonb,
  p_expira_en timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_negocio_normalizado text;
  v_raw_hex text;
  v_token_completo text;
  v_prefijo text;
  v_hash text;
  v_id uuid;
  v_secuencial bigint;
begin
  -- Validar autorización
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio_id) then
    raise exception 'No autorizado para generar tokens de integración en este negocio'
      using errcode = '42501';
  end if;

  v_negocio_normalizado := lower(trim(p_negocio_id));

  -- Generar 32 bytes aleatorios criptográficos
  v_raw_hex := encode(extensions.gen_random_bytes(32), 'hex');
  v_token_completo := 'eco_live_' || v_raw_hex;
  v_prefijo := substring(v_token_completo from 1 for 16) || '...';
  v_hash := encode(extensions.digest(v_token_completo, 'sha256'), 'hex');

  insert into comun_seguridad.seg_token_mcp (
    tkn_negocio_id,
    tkn_nombre,
    tkn_prefijo,
    tkn_hash_secreto,
    tkn_alcances,
    tkn_expira_en,
    tkn_creado_por
  ) values (
    v_negocio_normalizado,
    trim(p_nombre),
    v_prefijo,
    v_hash,
    coalesce(p_alcances, '["catalogo:leer"]'::jsonb),
    p_expira_en,
    auth.uid()
  )
  returning tkn_id, tkn_secuencial into v_id, v_secuencial;

  return jsonb_build_object(
    'token_id', v_id,
    'secuencial', v_secuencial,
    'token_secreto', v_token_completo,
    'prefijo', v_prefijo,
    'nombre', trim(p_nombre),
    'negocio_id', v_negocio_normalizado,
    'alcances', coalesce(p_alcances, '["catalogo:leer"]'::jsonb),
    'expira_en', p_expira_en,
    'creado_en', now()
  );
end;
$$;

-- 2.2 Listar Tokens de un Negocio (Sin exponer hashes)
create or replace function comun_seguridad.seg_fn_listar_tokens_mcp(
  p_negocio_id text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_resultado jsonb;
begin
  if not comun_seguridad.seg_fn_es_admin_negocio(p_negocio_id) then
    raise exception 'No autorizado para consultar tokens en este negocio'
      using errcode = '42501';
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', t.tkn_id,
      'secuencial', t.tkn_secuencial,
      'nombre', t.tkn_nombre,
      'prefijo', t.tkn_prefijo,
      'negocio_id', t.tkn_negocio_id,
      'alcances', t.tkn_alcances,
      'expira_en', t.tkn_expira_en,
      'ultimo_uso_en', t.tkn_ultimo_uso_en,
      'revocado_en', t.tkn_revocado_en,
      'activo', (t.tkn_revocado_en is null and (t.tkn_expira_en is null or t.tkn_expira_en > now())),
      'creado_en', t.tkn_creado_en
    ) order by t.tkn_creado_en desc
  ), '[]'::jsonb)
  into v_resultado
  from comun_seguridad.seg_token_mcp t
  where t.tkn_negocio_id = lower(trim(p_negocio_id));

  return v_resultado;
end;
$$;

-- 2.3 Revocar Token MCP
create or replace function comun_seguridad.seg_fn_revocar_token_mcp(
  p_token_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_negocio_id text;
begin
  select tkn_negocio_id into v_negocio_id
  from comun_seguridad.seg_token_mcp
  where tkn_id = p_token_id;

  if v_negocio_id is null then
    return false;
  end if;

  if not comun_seguridad.seg_fn_es_admin_negocio(v_negocio_id) then
    raise exception 'No autorizado para revocar este token'
      using errcode = '42501';
  end if;

  update comun_seguridad.seg_token_mcp
  set tkn_revocado_en = now(),
      tkn_actualizado_en = now()
  where tkn_id = p_token_id and tkn_revocado_en is null;

  return true;
end;
$$;

-- 2.4 Validar Token MCP (Utilizado por middleware/servidor MCP)
create or replace function comun_seguridad.seg_fn_validar_token_mcp(
  p_token_texto text,
  p_alcance_requerido text default null
)
returns jsonb
language plpgsql
security definer
set search_path = extensions, public
as $$
declare
  v_hash text;
  r record;
begin
  if p_token_texto is null or length(trim(p_token_texto)) < 16 then
    return jsonb_build_object('valido', false, 'motivo', 'TOKEN_INVALIDO');
  end if;

  v_hash := encode(extensions.digest(trim(p_token_texto), 'sha256'), 'hex');

  select * into r
  from comun_seguridad.seg_token_mcp
  where tkn_hash_secreto = v_hash;

  if not found then
    return jsonb_build_object('valido', false, 'motivo', 'TOKEN_NO_ENCONTRADO');
  end if;

  if r.tkn_revocado_en is not null then
    return jsonb_build_object('valido', false, 'motivo', 'TOKEN_REVOCADO');
  end if;

  if r.tkn_expira_en is not null and r.tkn_expira_en <= now() then
    return jsonb_build_object('valido', false, 'motivo', 'TOKEN_EXPIRADO');
  end if;

  if p_alcance_requerido is not null then
    if not (r.tkn_alcances ? p_alcance_requerido or r.tkn_alcances ? '*') then
      return jsonb_build_object('valido', false, 'motivo', 'ALCANCE_INSUFICIENTE');
    end if;
  end if;

  -- Registrar fecha de uso
  update comun_seguridad.seg_token_mcp
  set tkn_ultimo_uso_en = now()
  where tkn_id = r.tkn_id;

  return jsonb_build_object(
    'valido', true,
    'token_id', r.tkn_id,
    'negocio_id', r.tkn_negocio_id,
    'nombre', r.tkn_nombre,
    'alcances', r.tkn_alcances
  );
end;
$$;

-- 3. PERMISOS & GRANTS
-- ====================================================================
grant execute on function comun_seguridad.seg_fn_generar_token_mcp to authenticated, service_role;
grant execute on function comun_seguridad.seg_fn_listar_tokens_mcp to authenticated, service_role;
grant execute on function comun_seguridad.seg_fn_revocar_token_mcp to authenticated, service_role;
grant execute on function comun_seguridad.seg_fn_validar_token_mcp to anon, authenticated, service_role;

-- 4. REGISTRO PRECONFIGURADO DE WIDGET EN seg_widget Y seg_rol_widget
-- ====================================================================
DO $$
DECLARE
  v_negocio text;
  v_negocios text[] := ARRAY['tranqi', 'fastfix', 'tinkay', 'margaritas'];
BEGIN
  FOREACH v_negocio IN ARRAY v_negocios
  LOOP
    -- Registrar en seg_widget
    INSERT INTO comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget,
      wdg_creado_en
    ) VALUES (
      v_negocio,
      'tokens_mcp',
      'Tokens & APIs MCP',
      true,
      jsonb_build_object(
        'descripcion', 'Gestión y emisión de tokens de acceso (API Keys) para integrar herramientas MCP con agentes externos y bots',
        'categoria', 'Seguridad & Integraciones',
        'ruta', '/panel/configuracion?widget=tokens_mcp',
        'panel_defecto', 'panel_configuracion',
        'icono', 'KeyRound'
      ),
      NOW()
    )
    ON CONFLICT (wdg_negocio, wdg_clave) DO UPDATE
    SET wdg_nombre = EXCLUDED.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = EXCLUDED.wdg_detalle_widget;

    -- Asignar por defecto a roles ADMINISTRADOR y SUPERADMIN
    INSERT INTO comun_seguridad.seg_rol_widget (
      rlw_negocio,
      rlw_rol,
      rlw_widget_id,
      rlw_panel_id,
      rlw_orden,
      rlw_es_fijo,
      rlw_visible,
      rlw_detalle_asignacion,
      rlw_creado_en
    )
    SELECT
      v_negocio,
      r.rol,
      w.wdg_id,
      'panel_configuracion',
      12,
      false,
      true,
      '{"origen": "preconfiguracion_default"}'::jsonb,
      NOW()
    FROM comun_seguridad.seg_widget w
    CROSS JOIN (
      SELECT 'ADMINISTRADOR' AS rol
      UNION ALL
      SELECT 'SUPERADMIN' AS rol
    ) r
    WHERE w.wdg_negocio = v_negocio
      AND w.wdg_clave = 'tokens_mcp'
    ON CONFLICT (rlw_negocio, rlw_rol, rlw_widget_id) DO UPDATE
    SET rlw_visible = true,
        rlw_panel_id = 'panel_configuracion';

  END LOOP;
END $$;

-- 5. WRAPPERS EN ESQUEMA PUBLIC PARA COMPATIBILIDAD POSTGREST TRANSPARENTE
-- ====================================================================
create or replace function public.seg_fn_validar_token_mcp(
  p_token_texto text,
  p_alcance_requerido text default null
)
returns jsonb
language sql
security definer
as $$
  select comun_seguridad.seg_fn_validar_token_mcp(p_token_texto, p_alcance_requerido);
$$;

create or replace function public.tnk_fn_buscar_catalogo_conversacional(
  p_ocasion text default null,
  p_formato text default null,
  p_presupuesto_max_usd numeric default null,
  p_termino text default null
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_resultado jsonb;
  v_presupuesto_centavos integer;
begin
  if p_presupuesto_max_usd is not null then
    v_presupuesto_centavos := round(p_presupuesto_max_usd * 100);
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'producto_id', p.pro_id,
      'nombre', p.pro_nombre,
      'slug', p.pro_slug,
      'descripcion', coalesce(p.pro_detalle_producto->>'descripcion_corta', p.pro_descripcion),
      'album_fotos_url', coalesce(
        p.pro_detalle_producto->>'album_fotos_url',
        'https://photos.app.goo.gl/tinkay-catalogo-oficial'
      ),
      'icono', p.pro_detalle_producto->>'icono',
      'variantes', (
        select jsonb_agg(
          jsonb_build_object(
            'variante_id', v.var_id,
            'nombre', v.var_nombre,
            'precio_usd', round((v.var_precio_centavos / 100.0)::numeric, 2),
            'iva_tarifa', 0.15
          )
        )
        from comun_comercio.com_variante_precio v
        where v.var_producto_id = p.pro_id
          and (v_presupuesto_centavos is null or v.var_precio_centavos <= v_presupuesto_centavos)
      )
    )
  ), '[]'::jsonb)
  into v_resultado
  from comun_comercio.com_producto_servicio p
  where p.pro_negocio = 'tinkay'
    and p.pro_activo = true
    and (
      p_termino is null
      or p.pro_nombre ilike '%' || trim(p_termino) || '%'
      or p.pro_descripcion ilike '%' || trim(p_termino) || '%'
    );

  return v_resultado;
end;
$$;

create or replace function public.seg_fn_listar_tokens_mcp(
  p_negocio_id text
)
returns jsonb
language sql
security definer
as $$
  select comun_seguridad.seg_fn_listar_tokens_mcp(p_negocio_id);
$$;

create or replace function public.seg_fn_generar_token_mcp(
  p_negocio_id text,
  p_nombre text,
  p_alcances jsonb default '["catalogo:leer"]'::jsonb,
  p_expira_en timestamptz default null
)
returns jsonb
language sql
security definer
as $$
  select comun_seguridad.seg_fn_generar_token_mcp(p_negocio_id, p_nombre, p_alcances, p_expira_en);
$$;

create or replace function public.seg_fn_revocar_token_mcp(
  p_token_id uuid
)
returns boolean
language sql
security definer
as $$
  select comun_seguridad.seg_fn_revocar_token_mcp(p_token_id);
$$;

grant execute on function public.seg_fn_validar_token_mcp to anon, authenticated, service_role;
grant execute on function public.seg_fn_listar_tokens_mcp to authenticated, service_role;
grant execute on function public.seg_fn_generar_token_mcp to authenticated, service_role;
grant execute on function public.seg_fn_revocar_token_mcp to authenticated, service_role;

