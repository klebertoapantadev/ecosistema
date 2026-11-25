-- ============================================================================
-- Zonas concéntricas por isodistancia vial real en auto alrededor de Taller Tinkay:
--   1) "Entrega $1" (entrega_1_usd): hasta 7.0 km en auto (+2 km sobre zona gratuita), tarifa fija $1.00
--   2) "Entrega $2" (entrega_2_usd): hasta 9.0 km en auto (+4 km sobre zona gratuita), tarifa fija $2.00
-- Excluyen áreas sin calles transitables en auto (bosque Parque Metropolitano, laderas del Pichincha).
-- ============================================================================

do $$
declare
  v_poly_7km jsonb := '[
    [-0.191477,-78.468607],[-0.191362,-78.47095],[-0.210199,-78.482591],[-0.206905,-78.490434],
    [-0.209548,-78.496631],[-0.208208,-78.502597],[-0.197414,-78.505517],[-0.194255,-78.50799],
    [-0.181931,-78.502499],[-0.179002,-78.503674],[-0.175967,-78.507859],[-0.167723,-78.501148],
    [-0.163656,-78.501239],[-0.161066,-78.509142],[-0.157687,-78.505522],[-0.154291,-78.50694],
    [-0.145918,-78.49872],[-0.141593,-78.499073],[-0.13357,-78.503178],[-0.131863,-78.498406],
    [-0.127242,-78.497824],[-0.125136,-78.488979],[-0.128141,-78.483108],[-0.119266,-78.482819],
    [-0.118276,-78.479018],[-0.111676,-78.475468],[-0.119869,-78.458627],[-0.129668,-78.453504],
    [-0.125683,-78.447948],[-0.127408,-78.439972],[-0.13395,-78.440169],[-0.137002,-78.426236],
    [-0.150252,-78.434468],[-0.154795,-78.435271],[-0.157008,-78.426834],[-0.162281,-78.426216],
    [-0.164172,-78.427921],[-0.166453,-78.44736],[-0.174079,-78.452931],[-0.166002,-78.465065],
    [-0.193736,-78.46595]
  ]'::jsonb;

  v_poly_9km jsonb := '[
    [-0.197974,-78.468555],[-0.191362,-78.47095],[-0.216597,-78.480742],[-0.220509,-78.486417],
    [-0.218584,-78.497191],[-0.224312,-78.50781],[-0.220544,-78.513076],[-0.210642,-78.511808],
    [-0.207178,-78.515712],[-0.197292,-78.512534],[-0.192571,-78.514592],[-0.189267,-78.519421],
    [-0.183299,-78.51649],[-0.17853,-78.520784],[-0.172031,-78.506244],[-0.168844,-78.511841],
    [-0.165798,-78.506593],[-0.161066,-78.509142],[-0.157687,-78.505522],[-0.154291,-78.50694],
    [-0.150962,-78.504202],[-0.142826,-78.512752],[-0.138888,-78.510422],[-0.117251,-78.50613],
    [-0.111222,-78.497543],[-0.105971,-78.493731],[-0.107501,-78.481347],[-0.097332,-78.466112],
    [-0.11634,-78.461755],[-0.111663,-78.456865],[-0.113109,-78.451726],[-0.111573,-78.446802],
    [-0.125065,-78.443435],[-0.125162,-78.438339],[-0.13395,-78.440169],[-0.132646,-78.42738],
    [-0.138586,-78.409935],[-0.144584,-78.410089],[-0.153885,-78.42203],[-0.155966,-78.415617],
    [-0.161318,-78.422754],[-0.165423,-78.423294],[-0.168019,-78.428503],[-0.171572,-78.426699],
    [-0.172448,-78.437568],[-0.174597,-78.438767],[-0.174079,-78.452931],[-0.166002,-78.465065],
    [-0.198768,-78.46587]
  ]'::jsonb;

  v_det_7km jsonb := jsonb_build_object(
    'color', '#0EA5E9',
    'criterio_cobertura', 'ISODISTANCIA_VIAL_7KM_AUTO',
    'sectores_referencia', jsonb_build_array(
      'La Mariscal / Plaza Foch',
      'Nayón',
      'Santa Clara / La Colón',
      'San Isidro del Inca',
      'Cotocollao / La Concepción',
      'Miraflores / La Gasca'
    )
  );

  v_det_9km jsonb := jsonb_build_object(
    'color', '#8B5CF6',
    'criterio_cobertura', 'ISODISTANCIA_VIAL_9KM_AUTO',
    'sectores_referencia', jsonb_build_array(
      'Centro Histórico',
      'Ponceano',
      'El Ejido / San Juan',
      'San Carlos / Comité del Pueblo',
      'Llano Chico / Zámbiza Alto',
      'Miravalle / Guápulo'
    )
  );
begin
  -- 1. Upsert "Entrega $1" (7 km en auto)
  if exists (
    select 1 from comun_comercio.com_zona_cobertura
    where zon_negocio = 'tinkay' and zon_codigo = 'entrega_1_usd' and zon_eliminado_en is null
  ) then
    update comun_comercio.com_zona_cobertura
       set zon_nombre = 'Entrega $1',
           zon_modo_cobro = 'TARIFA_FIJA',
           zon_tarifa_fija = 1.00,
           zon_prioridad = 2,
           zon_activo = true,
           zon_poligono = v_poly_7km,
           zon_detalle_zona = coalesce(zon_detalle_zona, '{}'::jsonb) || v_det_7km,
           zon_actualizado_en = now()
     where zon_negocio = 'tinkay' and zon_codigo = 'entrega_1_usd' and zon_eliminado_en is null;
  else
    insert into comun_comercio.com_zona_cobertura (
      zon_negocio, zon_codigo, zon_nombre, zon_provincia, zon_modo_cobro,
      zon_tarifa_fija, zon_prioridad, zon_activo, zon_poligono, zon_detalle_zona
    ) values (
      'tinkay', 'entrega_1_usd', 'Entrega $1', 'Pichincha', 'TARIFA_FIJA',
      1.00, 2, true, v_poly_7km, v_det_7km
    );
  end if;

  -- 2. Upsert "Entrega $2" (9 km en auto)
  if exists (
    select 1 from comun_comercio.com_zona_cobertura
    where zon_negocio = 'tinkay' and zon_codigo = 'entrega_2_usd' and zon_eliminado_en is null
  ) then
    update comun_comercio.com_zona_cobertura
       set zon_nombre = 'Entrega $2',
           zon_modo_cobro = 'TARIFA_FIJA',
           zon_tarifa_fija = 2.00,
           zon_prioridad = 3,
           zon_activo = true,
           zon_poligono = v_poly_9km,
           zon_detalle_zona = coalesce(zon_detalle_zona, '{}'::jsonb) || v_det_9km,
           zon_actualizado_en = now()
     where zon_negocio = 'tinkay' and zon_codigo = 'entrega_2_usd' and zon_eliminado_en is null;
  else
    insert into comun_comercio.com_zona_cobertura (
      zon_negocio, zon_codigo, zon_nombre, zon_provincia, zon_modo_cobro,
      zon_tarifa_fija, zon_prioridad, zon_activo, zon_poligono, zon_detalle_zona
    ) values (
      'tinkay', 'entrega_2_usd', 'Entrega $2', 'Pichincha', 'TARIFA_FIJA',
      2.00, 3, true, v_poly_9km, v_det_9km
    );
  end if;
end $$;
