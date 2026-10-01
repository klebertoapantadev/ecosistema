-- ==============================================================================
-- Migración: 20261001000002_autoafiliacion_convenio_y_derechos_consumo.sql
-- Módulo: comun_comercio / comun_seguridad
-- Propósito: 
--   1. RPCs para auto-afiliación inmediata por dominio corporativo (@satcom.com.ec, etc.)
--   2. Consulta segura de beneficios y cupos de consumo para el cliente autenticado.
--   3. Registro del Widget 'mis_beneficios_corporativos' en seg_widget y seg_rol_widget.
-- ==============================================================================

-- 1. Función RPC para verificar y auto-afiliar usuario por dominio de correo
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
  v_descuento_general int := 15;
  v_excepciones jsonb := '[]'::jsonb;
begin
  if v_correo = '' or position('@' in v_correo) = 0 then
    return jsonb_build_object('tiene_convenio', false);
  end if;

  v_dominio := substring(v_correo from position('@' in v_correo));

  -- Buscar convenio activo con auto-afiliación por dominio
  select *
  into v_convenio
  from comun_comercio.com_convenio_empresa
  where (cve_negocio = v_negocio or (v_negocio = 'tranqi' and cve_negocio in ('tranqi', 'TRANQ', 'TRANQI')))
    and cve_activo = true
    and (
      lower(trim(coalesce(cve_dominio_correo, ''))) = v_dominio
      or lower(trim(coalesce(cve_dominio_correo, ''))) = '@' || v_dominio
      or coalesce(cve_detalle_convenio->'dominios_autorizados', '[]'::jsonb) @> to_jsonb(v_dominio)
      or coalesce(cve_detalle_convenio->'dominios_autorizados', '[]'::jsonb) @> to_jsonb('@' || v_dominio)
    )
  order by cve_creado_en asc
  limit 1;

  if v_convenio.cve_id is null then
    return jsonb_build_object('tiene_convenio', false);
  end if;

  -- Extraer paquete de beneficios configurado
  v_paquete := coalesce(v_convenio.cve_detalle_convenio->'paquete_beneficios', '{}'::jsonb);
  v_cupos_totales := coalesce((v_paquete->'bolsa_derechos'->'consultas_telematicas'->>'cupos_incluidos')::int, 2);
  v_descuento_general := coalesce((v_paquete->'reglas_descuento'->>'descuento_general_servicios_pct')::int, 15);
  v_excepciones := coalesce(v_paquete->'reglas_descuento'->'excepciones_por_producto', '[]'::jsonb);

  -- Si el usuario está registrado, asegurar su vinculación en com_beneficiario_empresa
  if p_usuario_id is not null then
    insert into comun_comercio.com_beneficiario_empresa (
      bnf_negocio,
      bnf_convenio_id,
      bnf_identificacion,
      bnf_correo_corporativo,
      bnf_usuario_vinculado_id,
      bnf_estado,
      bnf_vinculado_en,
      bnf_detalle_beneficiario
    ) values (
      v_negocio,
      v_convenio.cve_id,
      coalesce(v_correo, p_usuario_id::text),
      v_correo,
      p_usuario_id,
      'VINCULADO',
      now(),
      jsonb_build_object('auto_afiliado_por_dominio', v_dominio, 'fecha', now())
    )
    on conflict (bnf_convenio_id, bnf_identificacion) do update set
      bnf_usuario_vinculado_id = p_usuario_id,
      bnf_estado = 'VINCULADO',
      bnf_correo_corporativo = v_correo,
      bnf_vinculado_en = coalesce(comun_comercio.com_beneficiario_empresa.bnf_vinculado_en, now());
  end if;

  return jsonb_build_object(
    'tiene_convenio', true,
    'convenio_id', v_convenio.cve_id,
    'empresa_nombre', v_convenio.cve_empresa_nombre,
    'empresa_ruc', v_convenio.cve_empresa_ruc,
    'dominio', v_dominio,
    'consultas_gratis_total', v_cupos_totales,
    'consultas_disponibles', v_cupos_totales,
    'descuento_general_pct', v_descuento_general,
    'excepciones_por_producto', v_excepciones,
    'valido_hasta', v_convenio.cve_valido_hasta
  );
end;
$$;

grant execute on function comun_comercio.com_fn_verificar_y_autoafiliar_usuario_convenio(uuid, text, text) to anon, authenticated, service_role;

-- Alias público
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

-- 2. Registrar el Widget 'mis_beneficios_corporativos' en seg_widget
insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'mis_beneficios_corporativos',
  'Mis Beneficios Corporativos & Convenio',
  true,
  jsonb_build_object(
    'descripcion', 'Visualización de consultas gratuitas subsidiadas, descuentos especiales y estado de convenio B2B para colaboradores de empresas aliadas.',
    'categoria', 'comercio',
    'ruta', '/panel/clientes?widget=mis_beneficios_corporativos',
    'panel_defecto', 'panel_clientes',
    'icono', 'Gift',
    'version', '1.0.0',
    'mfa_requerido', false
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

-- 3. Pre-configurar el Widget para CLIENTE, OPERADOR, ADMINISTRADOR y SUPERADMIN
insert into comun_seguridad.seg_rol_widget (
  rlw_negocio,
  rlw_rol,
  rlw_widget_id,
  rlw_visible
)
select
  w.wdg_negocio,
  r.rol,
  w.wdg_id,
  true
from comun_seguridad.seg_widget w
cross join (values ('CLIENTE'), ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN'), ('ABOGADO')) as r(rol)
where w.wdg_clave = 'mis_beneficios_corporativos'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
  rlw_visible = true;
