-- ==============================================================================
-- Migración: 20260929000002_widget_gestion_convenios_corporativos_y_satcom.sql
-- Módulo: comun_comercio / comun_seguridad
-- Propósito: 
--   1. Semilla del Convenio Corporativo SATCOM con su paquete de beneficios.
--   2. Registro y Pre-configuración del widget 'gestion_convenios_corporativos'
--      en comun_seguridad.seg_widget y comun_seguridad.seg_rol_widget para
--      los roles OPERADOR, ADMINISTRADOR y SUPERADMIN en panel_administrar.
--   3. RPCs seguros para gestión de convenios y beneficiarios.
-- ==============================================================================

-- 1. Registrar o actualizar Convenio SATCOM en Tranqi
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
  'tranqi',
  'SATCOM',
  '1790019283001',
  '@satcom.com.ec',
  0.00,
  100.00,
  true,
  '2027-12-31 23:59:59+00',
  jsonb_build_object(
    'paquete_beneficios', jsonb_build_object(
      'bolsa_derechos', jsonb_build_object(
        'consultas_telematicas', jsonb_build_object(
          'cupos_incluidos', 2,
          'frecuencia', 'ANUAL',
          'precio_liquidado', 0.00,
          'reagendamiento_gratuito', false
        )
      ),
      'reglas_descuento', jsonb_build_object(
        'descuento_general_servicios_pct', 15,
        'excepciones_por_producto', jsonb_build_array(
          jsonb_build_object(
            'producto_nombre', 'Notarización de Documentos & Poderes',
            'producto_slug', 'notarizacion-documentos-poderes',
            'descuento_pct', 10
          )
        )
      ),
      'billetera_bono_inicial', 0.00
    ),
    'dominios_autorizados', jsonb_build_array('@satcom.com.ec', '@satcomla.com'),
    'auto_afiliacion_dominio', true,
    'contacto_rrhh', jsonb_build_object(
      'nombre', 'Talento Humano SATCOM',
      'correo', 'rrhh@satcom.com.ec',
      'telefono', '+593 99 000 0000'
    )
  )
)
on conflict do nothing;

-- 2. Registrar el Widget 'gestion_convenios_corporativos' en comun_seguridad.seg_widget
insert into comun_seguridad.seg_widget (
  wdg_negocio,
  wdg_clave,
  wdg_nombre,
  wdg_activo,
  wdg_detalle_widget
)
select
  n.negocio,
  'gestion_convenios_corporativos',
  'Convenios y Beneficios Corporativos',
  true,
  jsonb_build_object(
    'descripcion', 'Administración de empresas asociadas, paquetes de beneficios B2B, reglas de descuento y nómina de colaboradores.',
    'categoria', 'operaciones',
    'ruta', '/panel/administrar?widget=gestion_convenios_corporativos',
    'panel_defecto', 'panel_administrar',
    'icono', 'Building2',
    'version', '1.0.0',
    'mfa_requerido', false
  )
from (values ('tranqi'), ('fastfix'), ('tinkay'), ('margaritas')) as n(negocio)
on conflict (wdg_negocio, wdg_clave) do update set
  wdg_nombre = excluded.wdg_nombre,
  wdg_activo = true,
  wdg_detalle_widget = excluded.wdg_detalle_widget;

-- 3. Pre-configurar el Widget para OPERADOR, ADMINISTRADOR y SUPERADMIN en seg_rol_widget
insert into comun_seguridad.seg_rol_widget (
  rlw_negocio,
  rlw_rol,
  rlw_widget_id,
  rlw_visible,
  rlw_configuracion_override
)
select
  w.wdg_negocio,
  r.rol,
  w.wdg_id,
  true,
  jsonb_build_object('panel_asignado', 'panel_administrar')
from comun_seguridad.seg_widget w
cross join (values ('OPERADOR'), ('ADMINISTRADOR'), ('SUPERADMIN')) as r(rol)
where w.wdg_clave = 'gestion_convenios_corporativos'
on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
  rlw_visible = true,
  rlw_configuracion_override = excluded.rlw_configuracion_override;

-- 4. RPCs de Gestión Transaccional de Convenios (SECURITY DEFINER)
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
  v_ruc := trim(p_datos->>'empresa_ruc');
  v_dominio := trim(p_datos->>'dominio_correo');
  v_monto_bono := coalesce((p_datos->>'monto_bono_inicial')::numeric, 0.00);
  v_activo := coalesce((p_datos->>'activo')::boolean, true);
  v_valido_hasta := (p_datos->>'valido_hasta')::timestamptz;
  v_detalle := coalesce(p_datos->'detalle_convenio', '{}'::jsonb);

  if v_nombre is null or v_nombre = '' then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la empresa es obligatorio');
  end if;

  v_id_raw := p_datos->>'cve_id';
  if v_id_raw is not null and v_id_raw ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then
    v_id := v_id_raw::uuid;
  else
    v_id := null;
  end if;

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
    insert into comun_comercio.com_convenio_empresa (
      cve_negocio, cve_empresa_nombre, cve_empresa_ruc, cve_dominio_correo,
      cve_monto_bono_inicial, cve_activo, cve_valido_hasta, cve_detalle_convenio
    ) values (
      v_negocio, v_nombre, v_ruc, v_dominio,
      v_monto_bono, v_activo, v_valido_hasta, v_detalle
    )
    returning cve_id into v_id;
  end if;

  return jsonb_build_object('ok', true, 'cve_id', v_id);
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
