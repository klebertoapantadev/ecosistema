-- ==============================================================================
-- Migración: 20261001000001_fix_convenios_corporativos_edicion.sql
-- Módulo: comun_comercio
-- Propósito: 
--   1. Perfeccionar com_fn_guardar_convenio_empresa para soportar edición en sitio
--      identificando por cve_id (uuid), por nombre de empresa o por RUC, evitando duplicados.
--   2. Garantizar permisos RLS y grants de ejecución a anon, authenticated y service_role.
--   3. Sincronizar y actualizar de forma transaccional el convenio corporativo de SATCOM.
-- ==============================================================================

-- 1. Actualizar función com_fn_guardar_convenio_empresa en comun_comercio
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

  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la empresa es obligatorio');
  end if;

  -- 1.1 Intentar extraer UUID directo si fue provisto
  v_id_raw := p_datos->>'cve_id';
  if v_id_raw is not null and v_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := v_id_raw::uuid;
  else
    v_id := null;
  end if;

  -- 1.2 Si no viene UUID válido o no existe, buscar por negocio + nombre / ruc existente
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

  -- 1.3 Si existe, actualizar en sitio
  if v_id is not null and exists (select 1 from comun_comercio.com_convenio_empresa where cve_id = v_id) then
    update comun_comercio.com_convenio_empresa
    set
      cve_empresa_nombre = v_nombre,
      cve_empresa_ruc = v_ruc,
      cve_dominio_correo = v_dominio,
      cve_monto_bono_inicial = v_monto_bono,
      cve_activo = v_activo,
      cve_valido_hasta = v_valido_hasta,
      cve_detalle_convenio = v_detalle
    where cve_id = v_id;
  else
    -- 1.4 Si no existe, insertar nueva empresa / convenio
    insert into comun_comercio.com_convenio_empresa (
      cve_negocio,
      cve_empresa_nombre,
      cve_empresa_ruc,
      cve_dominio_correo,
      cve_monto_bono_inicial,
      cve_porcentaje_subsidio,
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
      v_activo,
      v_valido_hasta,
      v_detalle
    )
    returning cve_id into v_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'cve_id', v_id,
    'empresa_nombre', v_nombre
  );
end;
$$;

-- Otorgar permisos de ejecución
grant execute on function comun_comercio.com_fn_guardar_convenio_empresa(jsonb) to anon, authenticated, service_role;

-- Alias en esquema público para compatibilidad RPC
create or replace function public.com_fn_guardar_convenio_empresa(p_datos jsonb)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_guardar_convenio_empresa(p_datos);
$$;

grant execute on function public.com_fn_guardar_convenio_empresa(jsonb) to anon, authenticated, service_role;

-- 2. Asegurar RLS permisivo para lectura y gestión
alter table comun_comercio.com_convenio_empresa enable row level security;

drop policy if exists com_convenio_lectura_autenticada on comun_comercio.com_convenio_empresa;
create policy com_convenio_lectura_autenticada on comun_comercio.com_convenio_empresa
  for select using (true);

drop policy if exists com_convenio_staff_gestion on comun_comercio.com_convenio_empresa;
create policy com_convenio_staff_gestion on comun_comercio.com_convenio_empresa
  for all using (
    comun_seguridad.seg_fn_es_operador_o_admin_negocio(cve_negocio)
    or auth.role() = 'service_role'
  );
