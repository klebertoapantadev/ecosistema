-- ==============================================================================
-- Migración: 20260926000002_catalogo_suscripciones_tranqi_tinkay.sql
-- Módulo: Catálogo Comercial de Suscripciones, Onboarding Gratuito y Cupones
--         de Bienvenida para Tranqi y Tinkay (ADR-0003, PLT-009, PLT-014, PLT-020).
-- ==============================================================================

-- 1. Asegurar Categorías de Suscripción y Catálogo en comun_comercio
insert into comun_comercio.com_categoria (
  ctg_negocio, ctg_nombre, ctg_slug, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo, ctg_detalle_categoria
) values
  ('tranqi', 'Suscripciones y Protección Legal', 'suscripciones-proteccion-legal', 'Planes de protección legal continua, consultas telemáticas y beneficios en trámites.', 'COLECCION', 1, true, '{"codigo":"TRQ_SUBS","preliminar":false}'::jsonb),
  ('tinkay', 'Club Floral y Suscripciones', 'club-floral-suscripciones', 'Suscripciones periódicas de flores frescas con entrega programada a domicilio.', 'COLECCION', 1, true, '{"codigo":"TNK_SUBS","preliminar":false}'::jsonb),
  ('tinkay', 'Bouquets y Diseños Florales', 'bouquets-disenos-florales', 'Arreglos y ramos de flores ecuatorianas de exportación para toda ocasión.', 'FORMATO', 2, true, '{"codigo":"TNK_BOUQUETS","preliminar":false}'::jsonb),
  ('tinkay', 'Floreros y Complementos', 'floreros-complementos', 'Floreros de cristal, tarjetas caligráficas, chocolates y complementos de regalo.', 'FORMATO', 3, true, '{"codigo":"TNK_COMPLEMENTOS","preliminar":false}'::jsonb)
on conflict (ctg_negocio, ctg_slug) do update set
  ctg_nombre = excluded.ctg_nombre,
  ctg_descripcion = excluded.ctg_descripcion,
  ctg_activo = true,
  ctg_detalle_categoria = excluded.ctg_detalle_categoria;

-- 2. Productos Maestros para Tranqi y Tinkay
insert into comun_comercio.com_producto (
  pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_detalle_producto
) values
  -- Tranqi: Planes de Protección Jurídica
  (
    'tranqi',
    'Plan de Protección Jurídica Tranqi',
    'plan-proteccion-juridica-tranqi',
    'Membresía y cobertura legal continua con consultas virtuales incluidas, revisión de contratos y descuentos preferenciales en trámites.',
    'SUSCRIPCION',
    true,
    true,
    jsonb_build_object('icono', 'ShieldCheck', 'es_plan', true)
  ),
  -- Tinkay: Club Floral Recurrente
  (
    'tinkay',
    'Club Floral Tinkay (Suscripción Periódica)',
    'club-floral-tinkay',
    'Entrega periódica programada de flores frescas seleccionadas con descuento permanente y florero de bienvenida.',
    'SUSCRIPCION',
    true,
    true,
    jsonb_build_object('icono', 'Flower', 'es_plan', true)
  ),
  -- Tinkay: Productos Físicos y Regalo de Bienvenida
  (
    'tinkay',
    'Bouquet 24 Rosas Ecuatorianas de Exportación',
    'bouquet-24-rosas-exportacion',
    'Exclusivo bouquet artesanal de 24 rosas seleccionadas con follaje fino y envoltura de lujo.',
    'FISICO',
    true,
    true,
    jsonb_build_object('tamanio', 'Grande', 'duracion_dias', 12)
  ),
  (
    'tinkay',
    'Caja Floral de Temporada Fresh Bloom',
    'caja-floral-fresh-bloom',
    'Selección fresca de flores mixtas de temporada en caja de diseño ecológico.',
    'FISICO',
    false,
    true,
    jsonb_build_object('tamanio', 'Mediano', 'duracion_dias', 10)
  ),
  (
    'tinkay',
    'Florero de Cristal Cilíndrico Premium',
    'florero-cristal-cilindrico',
    'Florero de vidrio grueso soplado artesanalmente, ideal para hidratación prolongada de tallos largos.',
    'FISICO',
    false,
    true,
    jsonb_build_object('material', 'Cristal', 'altura_cm', 25)
  )
on conflict (pro_negocio, pro_slug) do update set
  pro_nombre = excluded.pro_nombre,
  pro_descripcion = excluded.pro_descripcion,
  pro_tipo = excluded.pro_tipo,
  pro_destacado = excluded.pro_destacado,
  pro_activo = true,
  pro_detalle_producto = excluded.pro_detalle_producto;

-- Asociar productos a su categoría principal
update comun_comercio.com_producto p
set pro_categoria_principal_id = c.ctg_id
from comun_comercio.com_categoria c
where p.pro_negocio = c.ctg_negocio
  and (
    (p.pro_slug = 'plan-proteccion-juridica-tranqi' and c.ctg_slug = 'suscripciones-proteccion-legal') or
    (p.pro_slug = 'club-floral-tinkay' and c.ctg_slug = 'club-floral-suscripciones') or
    (p.pro_slug in ('bouquet-24-rosas-exportacion', 'caja-floral-fresh-bloom') and c.ctg_slug = 'bouquets-disenos-florales') or
    (p.pro_slug = 'florero-cristal-cilindrico' and c.ctg_slug = 'floreros-complementos')
  );

-- 3. Variantes de Precios, Frecuencias y Derechos de Consumo
insert into comun_comercio.com_variante (
  var_negocio, var_producto_id, var_sku, var_nombre, var_precio,
  var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta,
  var_frecuencia_recurrencia, var_activo, var_detalle_variante
)
select
  p.pro_negocio, p.pro_id, v.sku, v.nombre, v.precio,
  'IVA_15', 15.00, v.tipo_oferta, v.frecuencia, true, v.detalle::jsonb
from (values
  -- ================= TRANQI =================
  (
    'plan-proteccion-juridica-tranqi', 'TRQ-PLAN-FREE', 'Suscripción Gratuita de Bienvenida', 0.00,
    'RECURRENTE_ANUAL', 'ANUAL',
    jsonb_build_object(
      'tipo_plan', 'GRATUITO_ONBOARDING',
      'es_gratuito', true,
      'derechos', jsonb_build_array(
        jsonb_build_object(
          'concepto', 'CONSULTA_TELEMATICA',
          'incluidos', 1,
          'periodo', 'ANUAL',
          'descripcion', '1 Consulta Virtual Gratuita de Orientación Legal (30 min)'
        )
      ),
      'beneficios_extra', jsonb_build_object(
        'descuento_primer_tramite_porcentaje', 10.00,
        'codigo_cupon_tramite', 'TRANQI10TRAMITE'
      )
    )::text
  ),
  (
    'plan-proteccion-juridica-tranqi', 'TRQ-PLAN-BAS', 'Plan Básico Individual', 20.00,
    'RECURRENTE_MENSUAL', 'MENSUAL',
    jsonb_build_object(
      'tipo_plan', 'INDIVIDUAL',
      'derechos', jsonb_build_array(
        jsonb_build_object('concepto', 'CONSULTA_TELEMATICA', 'incluidos', 1, 'periodo', 'MENSUAL'),
        jsonb_build_object('concepto', 'REVISION_CONTRATO', 'incluidos', 1, 'periodo', 'ANUAL')
      ),
      'descuento_tramites_porcentaje', 10.00
    )::text
  ),
  (
    'plan-proteccion-juridica-tranqi', 'TRQ-PLAN-MED', 'Plan Medio / Profesionales', 30.00,
    'RECURRENTE_MENSUAL', 'MENSUAL',
    jsonb_build_object(
      'tipo_plan', 'PROFESIONAL',
      'derechos', jsonb_build_array(
        jsonb_build_object('concepto', 'CONSULTA_TELEMATICA', 'incluidos', 3, 'periodo', 'MENSUAL'),
        jsonb_build_object('concepto', 'REVISION_CONTRATO', 'incluidos', 2, 'periodo', 'ANUAL'),
        jsonb_build_object('concepto', 'PODER_NOTARIAL', 'incluidos', 1, 'periodo', 'ANUAL')
      ),
      'descuento_tramites_porcentaje', 15.00
    )::text
  ),
  (
    'plan-proteccion-juridica-tranqi', 'TRQ-PLAN-PLUS', 'Plan Plus Familiar', 50.00,
    'RECURRENTE_MENSUAL', 'MENSUAL',
    jsonb_build_object(
      'tipo_plan', 'FAMILIAR',
      'derechos', jsonb_build_array(
        jsonb_build_object('concepto', 'CONSULTA_TELEMATICA', 'incluidos', null, 'periodo', 'MENSUAL'),
        jsonb_build_object('concepto', 'REVISION_CONTRATO', 'incluidos', null, 'periodo', 'MENSUAL')
      ),
      'descuento_tramites_porcentaje', 20.00
    )::text
  ),

  -- ================= TINKAY =================
  (
    'club-floral-tinkay', 'TNK-PLAN-FREE', 'Suscripción Gratuita Club Tinkay', 0.00,
    'RECURRENTE_ANUAL', 'ANUAL',
    jsonb_build_object(
      'tipo_plan', 'GRATUITO_ONBOARDING',
      'es_gratuito', true,
      'beneficios_extra', jsonb_build_object(
        'envio_gratis_primera_compra', true,
        'codigo_cupon_envio', 'TINKAY-ENVIOGRATIS'
      )
    )::text
  ),
  (
    'club-floral-tinkay', 'TNK-PLAN-SEM', 'Club Floral Semanal (Ahorra 20%)', 28.00,
    'RECURRENTE_SEMANAL', 'SEMANAL',
    jsonb_build_object(
      'tipo_plan', 'SUSCRIPCION_FISICA',
      'descuento_porcentaje', 20.00,
      'regalo_bienvenida_sku', 'TNK-ACC-VAS01',
      'logistica_entrega', jsonb_build_object(
        'frecuencia', 'SEMANAL',
        'dias_disponibles', jsonb_build_array('LUNES', 'MIERCOLES', 'VIERNES'),
        'reprogramable_horas_antes', 48
      )
    )::text
  ),
  (
    'club-floral-tinkay', 'TNK-PLAN-MEN', 'Club Floral Mensual (Ahorra 10%)', 31.50,
    'RECURRENTE_MENSUAL', 'MENSUAL',
    jsonb_build_object(
      'tipo_plan', 'SUSCRIPCION_FISICA',
      'descuento_porcentaje', 10.00,
      'logistica_entrega', jsonb_build_object(
        'frecuencia', 'MENSUAL',
        'reprogramable_horas_antes', 48
      )
    )::text
  ),
  (
    'club-floral-tinkay', 'TNK-PLAN-ANU', 'Plan Fechas Inolvidables Anual (Ahorra 15%)', 120.00,
    'RECURRENTE_ANUAL', 'ANUAL',
    jsonb_build_object(
      'tipo_plan', 'SUSCRIPCION_FISICA',
      'descuento_porcentaje', 15.00,
      'entregas_incluidas', 4,
      'beneficio_adicional', 'Envio prioritario garantizado en fechas pico'
    )::text
  ),
  -- Productos Físicos Sueltos Tinkay
  (
    'bouquet-24-rosas-exportacion', 'TNK-BOU-ROS24', 'Bouquet 24 Rosas Ecuatorianas', 35.00,
    'UNICO', null,
    jsonb_build_object('incluye_nutrientes', true, 'empaque', 'Papel Seda y Cinta Satinada')::text
  ),
  (
    'caja-floral-fresh-bloom', 'TNK-BOX-TEM01', 'Caja Floral de Temporada Fresh Bloom', 25.00,
    'UNICO', null,
    jsonb_build_object('incluye_nutrientes', true, 'empaque', 'Eco-Box')::text
  ),
  (
    'florero-cristal-cilindrico', 'TNK-ACC-VAS01', 'Florero de Cristal Cilíndrico', 12.00,
    'UNICO', null,
    jsonb_build_object('material', 'Vidrio templado grueso')::text
  )
) as v(slug, sku, nombre, precio, tipo_oferta, frecuencia, detalle)
join comun_comercio.com_producto p on p.pro_slug = v.slug
on conflict (var_negocio, var_sku) do update set
  var_nombre = excluded.var_nombre,
  var_precio = excluded.var_precio,
  var_tipo_oferta = excluded.var_tipo_oferta,
  var_frecuencia_recurrencia = excluded.var_frecuencia_recurrencia,
  var_detalle_variante = excluded.var_detalle_variante,
  var_activo = true;

-- 4. Cupones de Bienvenida para Tranqi y Tinkay
insert into comun_comercio.com_cupon (
  cup_negocio, cup_codigo, cup_descripcion, cup_tipo, cup_valor,
  cup_limite_usos_por_usuario, cup_valido_desde, cup_valido_hasta,
  cup_aplica_a, cup_regla_suscripcion, cup_activo, cup_detalle_cupon
) values
  -- Tranqi: 10% en el primer trámite legal
  (
    'tranqi',
    'TRANQI10TRAMITE',
    '10% de descuento en tu primer trámite legal con Tranqi.',
    'PORCENTAJE',
    10.0000,
    1,
    now(),
    now() + interval '365 days',
    'SOLO_PRODUCTOS',
    'SOLO_PRIMER_CICLO',
    true,
    jsonb_build_object('aplica_en', 'PRIMER_TRAMITE', 'origen', 'ONBOARDING_GRATUITO')
  ),
  -- Tinkay: Entrega gratuita en primera compra online
  (
    'tinkay',
    'TINKAY-ENVIOGRATIS',
    'Entrega a domicilio 100% gratuita en tu primera compra online.',
    'ENVIO_GRATIS',
    100.0000,
    1,
    now(),
    now() + interval '365 days',
    'TODOS',
    'SOLO_PRIMER_CICLO',
    true,
    jsonb_build_object('aplica_en', 'PRIMERA_COMPRA', 'origen', 'ONBOARDING_GRATUITO')
  )
on conflict (cup_negocio, cup_codigo) do update set
  cup_descripcion = excluded.cup_descripcion,
  cup_tipo = excluded.cup_tipo,
  cup_valor = excluded.cup_valor,
  cup_activo = true,
  cup_detalle_cupon = excluded.cup_detalle_cupon;

-- 5. Función Aprovisionamiento Automático de Suscripción Gratuita (PLT-009 / PLT-020)
create or replace function comun_comercio.com_fn_asegurar_suscripcion_gratuita(
  p_usuario_id uuid,
  p_negocio text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_suscripcion_id uuid;
  v_variante_id uuid;
  v_sku_gratuito text;
  v_periodo date := date_trunc('month', now())::date;
begin
  if p_usuario_id is null or p_negocio is null then
    return null;
  end if;

  -- Determinar SKU gratuito según el negocio
  if p_negocio = 'tranqi' then
    v_sku_gratuito := 'TRQ-PLAN-FREE';
  elsif p_negocio = 'tinkay' then
    v_sku_gratuito := 'TNK-PLAN-FREE';
  else
    return null;
  end if;

  -- 1. Verificar si el usuario ya cuenta con alguna suscripción activa en este negocio
  select sub_id into v_suscripcion_id
  from comun_comercio.com_suscripcion
  where sub_cliente_id = p_usuario_id
    and sub_negocio = p_negocio
    and sub_estado = 'ACTIVA'
    and sub_eliminado_en is null
  limit 1;

  if v_suscripcion_id is not null then
    return v_suscripcion_id;
  end if;

  -- 2. Obtener el ID de la variante gratuita
  select var_id into v_variante_id
  from comun_comercio.com_variante
  where var_negocio = p_negocio
    and var_sku = v_sku_gratuito
    and var_activo = true
  limit 1;

  if v_variante_id is null then
    return null;
  end if;

  -- 3. Crear la suscripción gratuita
  insert into comun_comercio.com_suscripcion (
    sub_negocio,
    sub_cliente_id,
    sub_variante_id,
    sub_estado,
    sub_frecuencia,
    sub_monto_periodo,
    sub_proximo_cobro_en,
    sub_detalle_suscripcion
  ) values (
    p_negocio,
    p_usuario_id,
    v_variante_id,
    'ACTIVA',
    'ANUAL',
    0.0000,
    now() + interval '365 days',
    jsonb_build_object(
      'origen', 'ALTA_AUTOMATICA_GRATUITA',
      'plan_codigo', v_sku_gratuito,
      'activado_en', now()
    )
  )
  returning sub_id into v_suscripcion_id;

  -- 4. Si es Tranqi, inicializar inmediatamente su derecho a 1 consulta virtual de orientación gratuita
  if p_negocio = 'tranqi' and v_suscripcion_id is not null then
    insert into comun_comercio.com_derecho_consumo (
      der_negocio,
      der_suscripcion_id,
      der_concepto,
      der_periodo,
      der_incluidos,
      der_consumidos,
      der_detalle_derecho
    ) values (
      'tranqi',
      v_suscripcion_id,
      'CONSULTA_TELEMATICA',
      v_periodo,
      1,
      0,
      jsonb_build_object('descripcion', '1 Consulta Virtual Gratuita de Bienvenida')
    )
    on conflict (der_suscripcion_id, der_concepto, der_periodo) do nothing;
  end if;

  return v_suscripcion_id;
end;
$$;

revoke execute on function comun_comercio.com_fn_asegurar_suscripcion_gratuita(uuid, text) from public;
grant execute on function comun_comercio.com_fn_asegurar_suscripcion_gratuita(uuid, text) to authenticated, service_role;

-- 6. Actualizar seg_fn_asegurar_membresia_cliente para activar la suscripción gratuita al conectar
create or replace function comun_seguridad.seg_fn_asegurar_membresia_cliente(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_membresia_id uuid;
  v_perfil_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesion';
  end if;

  -- 1. Asegurar membresía de CLIENTE
  insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
  values (auth.uid(), p_negocio, 'CLIENTE', 'ACTIVO')
  on conflict (mem_usuario_id, mem_negocio) do update set mem_actualizado_en = now()
  returning mem_id into v_membresia_id;

  -- 2. Asegurar perfil de CLIENTE
  select per_id into v_perfil_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  if v_perfil_id is not null then
    insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
    values (v_membresia_id, v_perfil_id)
    on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
  end if;

  -- 3. Aprovisionar automáticamente suscripción gratuita del negocio
  perform comun_comercio.com_fn_asegurar_suscripcion_gratuita(auth.uid(), p_negocio);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) from public;
grant execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) to authenticated;

-- 7. Poblado Retroactivo para Usuarios Actuales de Tranqi y Tinkay
do $$
declare
  r record;
begin
  for r in (
    select distinct mem_usuario_id, mem_negocio
    from comun_seguridad.seg_membresia
    where mem_negocio in ('tranqi', 'tinkay')
      and mem_estado = 'ACTIVO'
  ) loop
    perform comun_comercio.com_fn_asegurar_suscripcion_gratuita(r.mem_usuario_id, r.mem_negocio);
  end loop;
end;
$$;
