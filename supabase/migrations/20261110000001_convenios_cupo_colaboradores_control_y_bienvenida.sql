-- ==============================================================================
-- Migración: 20261110000001_convenios_cupo_colaboradores_control_y_bienvenida.sql
-- Módulo: comun_comercio / comun_seguridad
-- Propósito:
--   1. Agregar columna cve_cupo_colaboradores a comun_comercio.com_convenio_empresa
--      para especificar el número máximo de colaboradores habilitados por convenio.
--   2. Controlar las personas registradas bajo cada convenio en com_beneficiario_empresa,
--      validando el cupo disponible en el auto-registro por dominio y registro manual.
--   3. RPCs transaccionales para listar, registrar, activar/pausar, eliminar y
--      controlar el envío del correo de bienvenida con los beneficios del convenio.
-- ==============================================================================

-- 1. Agregar columna de cupo de colaboradores habilitados en com_convenio_empresa
alter table comun_comercio.com_convenio_empresa
  add column if not exists cve_cupo_colaboradores integer not null default 50;

-- Sincronizar el valor en cve_detalle_convenio para convenios existentes (ej. SATCOM)
update comun_comercio.com_convenio_empresa
set
  cve_cupo_colaboradores = coalesce(
    (cve_detalle_convenio->>'cupo_colaboradores_habilitados')::integer,
    cve_cupo_colaboradores,
    50
  ),
  cve_detalle_convenio = jsonb_set(
    coalesce(cve_detalle_convenio, '{}'::jsonb),
    '{cupo_colaboradores_habilitados}',
    to_jsonb(coalesce((cve_detalle_convenio->>'cupo_colaboradores_habilitados')::integer, cve_cupo_colaboradores, 50)),
    true
  );

-- 2. Actualizar RPC com_fn_guardar_convenio_empresa para persistir cve_cupo_colaboradores
create or replace function comun_comercio.com_fn_guardar_convenio_empresa(p_datos jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_id_raw text;
  v_negocio text;
  v_nombre text;
  v_ruc text;
  v_dominio text;
  v_monto_bono numeric(12,4);
  v_cupo integer;
  v_activo boolean;
  v_valido_hasta timestamptz;
  v_detalle jsonb;
begin
  v_negocio := coalesce(lower(trim(p_datos->>'negocio')), 'tranqi');
  v_nombre := trim(p_datos->>'empresa_nombre');
  v_ruc := coalesce(trim(p_datos->>'empresa_ruc'), '');
  v_dominio := coalesce(trim(p_datos->>'dominio_correo'), '');
  v_monto_bono := coalesce((p_datos->>'monto_bono_inicial')::numeric, 0.00);
  v_activo := coalesce((p_datos->>'activo')::boolean, true);
  v_valido_hasta := (p_datos->>'valido_hasta')::timestamptz;
  v_detalle := coalesce(p_datos->'detalle_convenio', '{}'::jsonb);

  v_cupo := greatest(
    1,
    coalesce(
      (p_datos->>'cupo_colaboradores')::integer,
      (v_detalle->>'cupo_colaboradores_habilitados')::integer,
      50
    )
  );

  v_detalle := jsonb_set(v_detalle, '{cupo_colaboradores_habilitados}', to_jsonb(v_cupo), true);

  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la empresa es obligatorio');
  end if;

  v_id_raw := p_datos->>'cve_id';
  if v_id_raw is not null and v_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := v_id_raw::uuid;
  else
    v_id := null;
  end if;

  if v_id is null or not exists (select 1 from comun_comercio.com_convenio_empresa where cve_id = v_id) then
    select cve_id into v_id
    from comun_comercio.com_convenio_empresa
    where (cve_negocio = v_negocio or (v_negocio = 'tranqi' and cve_negocio in ('tranqi', 'TRANQ', 'TRANQI')))
      and (
        lower(trim(cve_empresa_nombre)) = lower(v_nombre)
        or (v_ruc <> '' and trim(coalesce(cve_empresa_ruc, '')) = v_ruc)
      )
    order by cve_creado_en asc
    limit 1;
  end if;

  if v_id is not null and exists (select 1 from comun_comercio.com_convenio_empresa where cve_id = v_id) then
    update comun_comercio.com_convenio_empresa
    set
      cve_empresa_nombre = v_nombre,
      cve_empresa_ruc = v_ruc,
      cve_dominio_correo = v_dominio,
      cve_monto_bono_inicial = v_monto_bono,
      cve_cupo_colaboradores = v_cupo,
      cve_activo = v_activo,
      cve_valido_hasta = v_valido_hasta,
      cve_detalle_convenio = v_detalle
    where cve_id = v_id;
  else
    insert into comun_comercio.com_convenio_empresa (
      cve_negocio,
      cve_empresa_nombre,
      cve_empresa_ruc,
      cve_dominio_correo,
      cve_monto_bono_inicial,
      cve_porcentaje_subsidio,
      cve_cupo_colaboradores,
      cve_activo,
      cve_valido_hasta,
      cve_detalle_convenio
    ) values (
      v_negocio,
      v_nombre,
      v_ruc,
      v_dominio,
      v_monto_bono,
      100.00,
      v_cupo,
      v_activo,
      v_valido_hasta,
      v_detalle
    )
    returning cve_id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'cve_id', v_id,
    'empresa_nombre', v_nombre,
    'cupo_colaboradores', v_cupo
  );
end;
$$;

grant execute on function comun_comercio.com_fn_guardar_convenio_empresa(jsonb) to anon, authenticated, service_role;

create or replace function public.com_fn_guardar_convenio_empresa(p_datos jsonb)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_guardar_convenio_empresa(p_datos);
$$;

grant execute on function public.com_fn_guardar_convenio_empresa(jsonb) to anon, authenticated, service_role;

-- 3. Actualizar com_fn_verificar_y_autoafiliar_usuario_convenio con control estricto de cupo
create or replace function comun_comercio.com_fn_verificar_y_autoafiliar_usuario_convenio(
  p_usuario_id uuid,
  p_correo text,
  p_negocio text default 'tranqi'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := coalesce(lower(trim(p_negocio)), 'tranqi');
  v_correo text := lower(trim(coalesce(p_correo, '')));
  v_dominio text;
  v_convenio record;
  v_beneficiario record;
  v_paquete jsonb;
  v_cupos_totales int := 2;
  v_frecuencia text := 'ANUAL';
  v_descuento_general int := 15;
  v_excepciones jsonb := '[]'::jsonb;
  v_bono_inicial numeric(12,4) := 0;
  v_cupo_colaboradores int := 50;
  v_registrados_activos int := 0;
  v_nombres_usuario text := '';
  v_recien_afiliado boolean := false;
  v_bienvenida_enviada boolean := false;
  v_bnf_id uuid := null;
begin
  if v_correo = '' or position('@' in v_correo) = 0 then
    return jsonb_build_object('tiene_convenio', false);
  end if;

  v_dominio := substring(v_correo from position('@' in v_correo));

  -- 3.1 Primero verificar si el correo o usuario ya está pre-registrado en algún convenio activo
  select c.*
  into v_convenio
  from comun_comercio.com_beneficiario_empresa b
  join comun_comercio.com_convenio_empresa c on c.cve_id = b.bnf_convenio_id
  where (c.cve_negocio = v_negocio or (v_negocio = 'tranqi' and c.cve_negocio in ('tranqi', 'TRANQ', 'TRANQI')))
    and c.cve_activo = true
    and b.bnf_eliminado_en is null
    and (
      lower(trim(coalesce(b.bnf_correo_corporativo, ''))) = v_correo
      or (p_usuario_id is not null and b.bnf_usuario_vinculado_id = p_usuario_id)
    )
  order by b.bnf_creado_en asc
  limit 1;

  -- 3.2 Si no está pre-registrado directamente, buscar convenio activo por dominio de correo
  if v_convenio.cve_id is null then
    select *
    into v_convenio
    from comun_comercio.com_convenio_empresa
    where (cve_negocio = v_negocio or (v_negocio = 'tranqi' and cve_negocio in ('tranqi', 'TRANQ', 'TRANQI')))
      and cve_activo = true
      and (
        lower(trim(coalesce(cve_dominio_correo, ''))) = v_dominio
        or lower(trim(coalesce(cve_dominio_correo, ''))) = '@' || v_dominio
        or '@' || ltrim(lower(trim(coalesce(cve_dominio_correo, ''))), '@') = v_dominio
        or coalesce(cve_detalle_convenio->'dominios_autorizados', '[]'::jsonb) @> to_jsonb(v_dominio)
        or coalesce(cve_detalle_convenio->'dominios_autorizados', '[]'::jsonb) @> to_jsonb('@' || ltrim(v_dominio, '@'))
      )
    order by cve_creado_en asc
    limit 1;
  end if;

  if v_convenio.cve_id is null then
    return jsonb_build_object('tiene_convenio', false);
  end if;

  -- Extraer cupo de colaboradores habilitados y paquete de beneficios
  v_cupo_colaboradores := greatest(
    1,
    coalesce(
      v_convenio.cve_cupo_colaboradores,
      (v_convenio.cve_detalle_convenio->>'cupo_colaboradores_habilitados')::int,
      50
    )
  );

  v_paquete := coalesce(v_convenio.cve_detalle_convenio->'paquete_beneficios', '{}'::jsonb);
  v_cupos_totales := coalesce((v_paquete->'bolsa_derechos'->'consultas_telematicas'->>'cupos_incluidos')::int, 2);
  v_frecuencia := coalesce(v_paquete->'bolsa_derechos'->'consultas_telematicas'->>'frecuencia', 'ANUAL');
  v_descuento_general := coalesce((v_paquete->'reglas_descuento'->>'descuento_general_servicios_pct')::int, 15);
  v_excepciones := coalesce(v_paquete->'reglas_descuento'->'excepciones_por_producto', '[]'::jsonb);
  v_bono_inicial := coalesce((v_paquete->>'billetera_bono_inicial')::numeric, v_convenio.cve_monto_bono_inicial, 0);

  -- Buscar si el colaborador ya tiene registro en com_beneficiario_empresa
  select *
  into v_beneficiario
  from comun_comercio.com_beneficiario_empresa
  where bnf_convenio_id = v_convenio.cve_id
    and bnf_eliminado_en is null
    and (
      lower(trim(coalesce(bnf_correo_corporativo, ''))) = v_correo
      or lower(trim(coalesce(bnf_identificacion, ''))) = v_correo
      or (p_usuario_id is not null and bnf_usuario_vinculado_id = p_usuario_id)
    )
  order by bnf_creado_en asc
  limit 1;

  -- Si el colaborador fue pausado/inactivado explícitamente por el administrador del convenio
  if v_beneficiario.bnf_id is not null and v_beneficiario.bnf_estado = 'INACTIVO' then
    return jsonb_build_object(
      'tiene_convenio', false,
      'cupo_suspendido', true,
      'convenio_id', v_convenio.cve_id,
      'empresa_nombre', v_convenio.cve_empresa_nombre,
      'mensaje', 'Tu afiliación al convenio corporativo de ' || v_convenio.cve_empresa_nombre || ' se encuentra inactiva.'
    );
  end if;

  -- Contar colaboradores activos / vinculados actualmente en el convenio
  select count(*)::int
  into v_registrados_activos
  from comun_comercio.com_beneficiario_empresa
  where bnf_convenio_id = v_convenio.cve_id
    and bnf_eliminado_en is null
    and bnf_estado in ('VINCULADO', 'PENDIENTE');

  -- Obtener nombre del usuario desde seg_usuario si existe
  if p_usuario_id is not null then
    select trim(coalesce(usu_nombres, '') || ' ' || coalesce(usu_apellidos, ''))
    into v_nombres_usuario
    from comun_seguridad.seg_usuario
    where usu_id = p_usuario_id;
  end if;

  if v_beneficiario.bnf_id is null then
    -- Es un nuevo colaborador intentando registrarse bajo el convenio: validar cupo habilitado
    if v_registrados_activos >= v_cupo_colaboradores then
      return jsonb_build_object(
        'tiene_convenio', false,
        'cupo_agotado', true,
        'convenio_id', v_convenio.cve_id,
        'empresa_nombre', v_convenio.cve_empresa_nombre,
        'cupo_colaboradores', v_cupo_colaboradores,
        'colaboradores_registrados', v_registrados_activos,
        'mensaje', 'El convenio corporativo de ' || v_convenio.cve_empresa_nombre || ' ha alcanzado el límite de ' || v_cupo_colaboradores || ' colaboradores habilitados.'
      );
    end if;

    -- Si hay cupo disponible, registrar al colaborador
    insert into comun_comercio.com_beneficiario_empresa (
      bnf_negocio,
      bnf_convenio_id,
      bnf_identificacion,
      bnf_correo_corporativo,
      bnf_nombres,
      bnf_usuario_vinculado_id,
      bnf_estado,
      bnf_vinculado_en,
      bnf_detalle_beneficiario
    ) values (
      v_negocio,
      v_convenio.cve_id,
      v_correo,
      v_correo,
      nullif(trim(v_nombres_usuario), ''),
      p_usuario_id,
      'VINCULADO',
      now(),
      jsonb_build_object(
        'auto_afiliado_por_dominio', v_dominio,
        'fecha_registro', now(),
        'correo_bienvenida_enviado', false
      )
    )
    returning bnf_id into v_bnf_id;

    v_recien_afiliado := true;
    v_bienvenida_enviada := false;
    v_registrados_activos := v_registrados_activos + 1;
  else
    v_bnf_id := v_beneficiario.bnf_id;
    v_bienvenida_enviada := coalesce((v_beneficiario.bnf_detalle_beneficiario->>'correo_bienvenida_enviado')::boolean, false);

    if v_beneficiario.bnf_estado = 'PENDIENTE' then
      v_recien_afiliado := true;
    end if;

    update comun_comercio.com_beneficiario_empresa
    set
      bnf_usuario_vinculado_id = coalesce(p_usuario_id, bnf_usuario_vinculado_id),
      bnf_correo_corporativo = coalesce(nullif(bnf_correo_corporativo, ''), v_correo),
      bnf_nombres = coalesce(nullif(trim(bnf_nombres), ''), nullif(trim(v_nombres_usuario), ''), bnf_nombres),
      bnf_estado = 'VINCULADO',
      bnf_vinculado_en = coalesce(bnf_vinculado_en, now())
    where bnf_id = v_bnf_id;
  end if;

  return jsonb_build_object(
    'tiene_convenio', true,
    'beneficiario_id', v_bnf_id,
    'recien_afiliado', v_recien_afiliado,
    'requiere_correo_bienvenida', (not v_bienvenida_enviada),
    'convenio_id', v_convenio.cve_id,
    'empresa_nombre', v_convenio.cve_empresa_nombre,
    'empresa_ruc', v_convenio.cve_empresa_ruc,
    'dominio', v_dominio,
    'cupo_colaboradores', v_cupo_colaboradores,
    'colaboradores_registrados', v_registrados_activos,
    'consultas_gratis_total', v_cupos_totales,
    'consultas_disponibles', v_cupos_totales,
    'frecuencia_consultas', v_frecuencia,
    'descuento_general_pct', v_descuento_general,
    'excepciones_por_producto', v_excepciones,
    'billetera_bono_inicial', v_bono_inicial,
    'valido_hasta', v_convenio.cve_valido_hasta
  );
end;
$$;

grant execute on function comun_comercio.com_fn_verificar_y_autoafiliar_usuario_convenio(uuid, text, text) to anon, authenticated, service_role;

create or replace function public.com_fn_verificar_y_autoafiliar_usuario_convenio(
  p_usuario_id uuid,
  p_correo text,
  p_negocio text default 'tranqi'
)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_verificar_y_autoafiliar_usuario_convenio(p_usuario_id, p_correo, p_negocio);
$$;

grant execute on function public.com_fn_verificar_y_autoafiliar_usuario_convenio(uuid, text, text) to anon, authenticated, service_role;

-- 4. RPC para marcar el correo de bienvenida como enviado en com_beneficiario_empresa
create or replace function comun_comercio.com_fn_marcar_bienvenida_convenio_enviada(
  p_bnf_id uuid default null,
  p_convenio_id uuid default null,
  p_correo text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_bnf_id is not null then
    update comun_comercio.com_beneficiario_empresa
    set bnf_detalle_beneficiario = coalesce(bnf_detalle_beneficiario, '{}'::jsonb) || jsonb_build_object(
      'correo_bienvenida_enviado', true,
      'correo_bienvenida_fecha', now()
    )
    where bnf_id = p_bnf_id;
  elsif p_convenio_id is not null and p_correo is not null then
    update comun_comercio.com_beneficiario_empresa
    set bnf_detalle_beneficiario = coalesce(bnf_detalle_beneficiario, '{}'::jsonb) || jsonb_build_object(
      'correo_bienvenida_enviado', true,
      'correo_bienvenida_fecha', now()
    )
    where bnf_convenio_id = p_convenio_id
      and lower(trim(coalesce(bnf_correo_corporativo, ''))) = lower(trim(p_correo));
  end if;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function comun_comercio.com_fn_marcar_bienvenida_convenio_enviada(uuid, uuid, text) to anon, authenticated, service_role;

create or replace function public.com_fn_marcar_bienvenida_convenio_enviada(
  p_bnf_id uuid default null,
  p_convenio_id uuid default null,
  p_correo text default null
)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_marcar_bienvenida_convenio_enviada(p_bnf_id, p_convenio_id, p_correo);
$$;

grant execute on function public.com_fn_marcar_bienvenida_convenio_enviada(uuid, uuid, text) to anon, authenticated, service_role;

-- 5. Políticas RLS para lectura y gestión de com_beneficiario_empresa
alter table comun_comercio.com_beneficiario_empresa enable row level security;

drop policy if exists com_beneficiario_lectura_autenticada on comun_comercio.com_beneficiario_empresa;
create policy com_beneficiario_lectura_autenticada on comun_comercio.com_beneficiario_empresa
  for select using (true);

drop policy if exists com_beneficiario_staff_gestion on comun_comercio.com_beneficiario_empresa;
create policy com_beneficiario_staff_gestion on comun_comercio.com_beneficiario_empresa
  for all using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(bnf_negocio)
    or auth.role() = 'service_role'
  );
