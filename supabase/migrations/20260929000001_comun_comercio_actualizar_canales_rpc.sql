-- ==============================================================================
-- Migración: 20260929000001_comun_comercio_actualizar_canales_rpc.sql
-- Módulo: comun_comercio
-- Propósito: RPC atómico y seguro (SECURITY DEFINER) para persistir la conmutación
--            de canales de visibilidad (ECOMMERCE_WEB, APP_CLIENTES, etc.) de productos.
-- ==============================================================================

create or replace function comun_comercio.com_fn_actualizar_canales_producto(
  p_pro_id uuid,
  p_canales jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detalle jsonb;
begin
  select coalesce(pro_detalle_producto, '{}'::jsonb) into v_detalle
  from comun_comercio.com_producto
  where pro_id = p_pro_id;

  if not found then
    return jsonb_build_object('ok', false, 'error', 'Producto no encontrado');
  end if;

  v_detalle := jsonb_set(v_detalle, '{canales_visibilidad}', coalesce(p_canales, '[]'::jsonb), true);
  v_detalle := jsonb_set(v_detalle, '{editado_en}', to_jsonb(now()::text), true);

  update comun_comercio.com_producto
  set
    pro_detalle_producto = v_detalle,
    pro_actualizado_en = now()
  where pro_id = p_pro_id;

  return jsonb_build_object('ok', true, 'canales', p_canales);
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_canales_producto(uuid, jsonb) to anon, authenticated, service_role;

create or replace function public.com_fn_actualizar_canales_producto(p_pro_id uuid, p_canales jsonb)
returns jsonb
language sql
security definer
as $$
  select comun_comercio.com_fn_actualizar_canales_producto(p_pro_id, p_canales);
$$;

grant execute on function public.com_fn_actualizar_canales_producto(uuid, jsonb) to anon, authenticated, service_role;
