-- ==============================================================================
-- Migración: 20260906000003_comun_comercio_seed_y_payphone.sql
-- Módulo: Catálogo Comercial Unificado - Semillas de Productos y Pasarela Payphone
-- Cumple: ADR-0003, PLT-009, PLT-006 y estándares de gobernanza del ecosistema.
-- ==============================================================================

-- 1. Semillas de Categorías Comerciales
insert into comun_comercio.com_categoria (ctg_negocio, ctg_nombre, ctg_slug, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo)
values
  ('tranqi', 'Servicios Legales y Patrocinio', 'servicios-legales-patrocinio', 'Servicios jurídicos puntuales, honorarios profesionales y defensa judicial.', 'FORMATO', 1, true),
  ('tranqi', 'Planes de Protección Jurídica', 'planes-proteccion-juridica', 'Suscripciones y planes corporativos o familiares de asesoría legal continua.', 'COLECCION', 2, true),
  ('fastfix', 'Mantenimiento de Hogar', 'mantenimiento-hogar', 'Servicios de reparación, gasfitería y mantenimiento técnico residencial.', 'FORMATO', 1, true),
  ('tinkay', 'Floristería y Bouquets', 'floristeria-bouquets', 'Arreglos florales de exportación, rosas preservadas y detalles especiales.', 'FORMATO', 1, true)
on conflict (ctg_negocio, ctg_slug) do update set
  ctg_nombre = excluded.ctg_nombre,
  ctg_descripcion = excluded.ctg_descripcion,
  ctg_activo = true;

-- 2. Semillas de Productos Maestros
-- 2.1 Tranqi: Honorarios Profesionales Jurídicos
insert into comun_comercio.com_producto (pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_detalle_producto)
values
  (
    'tranqi',
    'Honorarios Profesionales Jurídicos',
    'honorarios-profesionales-juridicos',
    'Contratación y liquidación de honorarios para patrocinio legal, consultas especializadas y representación en causas judiciales o extrajudiciales.',
    'SERVICIO',
    true,
    true,
    jsonb_build_object(
      'ambito', 'Litigio y Asesoría Legal',
      'incluye_dictamen', true,
      'modalidad_pago', 'Boton Payphone / Tarjeta / Diferido',
      'icono', 'Scale'
    )
  ),
  (
    'tranqi',
    'Plan Anual de Protección Legal Familiar',
    'plan-proteccion-legal-familiar',
    'Cobertura jurídica integral durante 365 días: consultas ilimitadas con abogados acreditados, revisión de contratos y descuentos preferenciales.',
    'SUSCRIPCION',
    true,
    true,
    jsonb_build_object(
      'frecuencia', 'ANUAL',
      'beneficiarios', 'Hasta 4 miembros familiares',
      'icono', 'ShieldCheck'
    )
  ),
  (
    'tranqi',
    'Revisión y Dictamen Legal Express de Contratos',
    'revision-dictamen-legal-express',
    'Análisis exhaustivo de minutas, contratos de arrendamiento, compraventa o laborales con dictamen emitido por abogado titular en menos de 24 horas.',
    'SERVICIO',
    false,
    true,
    jsonb_build_object(
      'tiempo_entrega', '24 horas',
      'formato_entrega', 'Dictamen en PDF con firma electrónica PAdES',
      'icono', 'FileCheck'
    )
  ),
  (
    'fastfix',
    'Mantenimiento Preventivo de Calefón a Gas',
    'mantenimiento-preventivo-calefon',
    'Inspección integral de serpentín, quemadores, válvula de gas y calibración de tiro de evacuación con garantía técnica certificada.',
    'SERVICIO',
    true,
    true,
    jsonb_build_object('duracion_estimada', '60 a 90 minutos', 'garantia_dias', 90)
  ),
  (
    'tinkay',
    'Bouquet Romance 24 Rosas Ecuatorianas',
    'bouquet-romance-24-rosas',
    'Exclusivo bouquet elaborado con 24 rosas de exportación seleccionadas, follaje fino importado y envoltura de lujo artesanal.',
    'FISICO',
    true,
    true,
    jsonb_build_object('altura_aprox', '55 cm', 'durabilidad_dias', 12)
  )
on conflict (pro_negocio, pro_slug) do update set
  pro_nombre = excluded.pro_nombre,
  pro_descripcion = excluded.pro_descripcion,
  pro_activo = true,
  pro_destacado = excluded.pro_destacado;

-- Asociar productos a su categoría principal
update comun_comercio.com_producto p
set pro_categoria_principal_id = c.ctg_id
from comun_comercio.com_categoria c
where p.pro_negocio = c.ctg_negocio
  and (
    (p.pro_slug in ('honorarios-profesionales-juridicos', 'revision-dictamen-legal-express') and c.ctg_slug = 'servicios-legales-patrocinio') or
    (p.pro_slug = 'plan-proteccion-legal-familiar' and c.ctg_slug = 'planes-proteccion-juridica') or
    (p.pro_slug = 'mantenimiento-preventivo-calefon' and c.ctg_slug = 'mantenimiento-hogar') or
    (p.pro_slug = 'bouquet-romance-24-rosas' and c.ctg_slug = 'floristeria-bouquets')
  );

-- 3. Semillas de Variantes Comerciales / SKUs con Precios e Impuestos
-- Las variantes almacenan la BASE IMPONIBLE (var_precio). El IVA 15% se calcula como var_tarifa_iva_porcentaje = 15.00
do $$
declare
  v_prod_honorarios uuid;
  v_prod_plan uuid;
  v_prod_dictamen uuid;
  v_prod_calefon uuid;
  v_prod_bouquet uuid;
begin
  select pro_id into v_prod_honorarios from comun_comercio.com_producto where pro_negocio = 'tranqi' and pro_slug = 'honorarios-profesionales-juridicos';
  select pro_id into v_prod_plan from comun_comercio.com_producto where pro_negocio = 'tranqi' and pro_slug = 'plan-proteccion-legal-familiar';
  select pro_id into v_prod_dictamen from comun_comercio.com_producto where pro_negocio = 'tranqi' and pro_slug = 'revision-dictamen-legal-express';
  select pro_id into v_prod_calefon from comun_comercio.com_producto where pro_negocio = 'fastfix' and pro_slug = 'mantenimiento-preventivo-calefon';
  select pro_id into v_prod_bouquet from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'bouquet-romance-24-rosas';

  -- Variantes de Honorarios Profesionales
  if v_prod_honorarios is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tranqi', v_prod_honorarios, 'TRQ-HON-CONSULTA', 'Consulta y Asesoría Legal Inicial (1 hora)', 30.0000, 40.0000, 'IVA_15', 15.00, 'UNICO', true, jsonb_build_object('duracion_min', 60, 'etapa', 'Asesoría Preliminar')),
      ('tranqi', v_prod_honorarios, 'TRQ-HON-PATROCINIO', 'Patrocinio en Trámite Extrajudicial / Mediación', 150.0000, 180.0000, 'IVA_15', 15.00, 'UNICO', true, jsonb_build_object('cobertura', 'Audiencias de Mediación y Acta Final')),
      ('tranqi', v_prod_honorarios, 'TRQ-HON-JUICIO', 'Representación y Patrocinio en Juicio Ordinario', 500.0000, 600.0000, 'IVA_15', 15.00, 'UNICO', true, jsonb_build_object('cobertura', 'Demanda, Audiencia Preliminar, Juicio y Sentencia'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_tarifa_iva_porcentaje = excluded.var_tarifa_iva_porcentaje,
      var_nombre = excluded.var_nombre,
      var_activo = true;
  end if;

  -- Variante de Plan Anual
  if v_prod_plan is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_frecuencia_recurrencia, var_activo, var_detalle_variante
    ) values
      ('tranqi', v_prod_plan, 'TRQ-PLN-ANUAL-FAM', 'Suscripción Anual Familiar', 120.0000, 150.0000, 'IVA_15', 15.00, 'RECURRENTE_ANUAL', 'ANUAL', true, jsonb_build_object('meses_cobertura', 12))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true;
  end if;

  -- Variante de Dictamen Express
  if v_prod_dictamen is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tranqi', v_prod_dictamen, 'TRQ-SER-DICTAMEN', 'Dictamen Express Certificado (Hasta 15 págs)', 45.0000, 60.0000, 'IVA_15', 15.00, 'UNICO', true, jsonb_build_object('max_paginas', 15))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true;
  end if;

  -- Variante Fastfix
  if v_prod_calefon is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo
    ) values
      ('fastfix', v_prod_calefon, 'FFH-CAL-PREVENTIVO', 'Servicio Técnico Especializado', 35.0000, 'IVA_15', 15.00, 'UNICO', true)
    on conflict (var_negocio, var_sku) do update set var_precio = excluded.var_precio, var_activo = true;
  end if;

  -- Variante Tinkay
  if v_prod_bouquet is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo
    ) values
      ('tinkay', v_prod_bouquet, 'TNK-BOU-24ROSAS', 'Presentación Estándar 24 Rosas', 45.0000, 'IVA_15', 15.00, 'UNICO', true)
    on conflict (var_negocio, var_sku) do update set var_precio = excluded.var_precio, var_activo = true;
  end if;
end $$;

-- 4. Semillas de Configuración de Pasarela Payphone (con Modo Simulado Habilitado)
insert into comun_comercio.com_pasarela_configuracion (
  psc_negocio,
  psc_pasarela,
  psc_nombre_visible,
  psc_ambiente,
  psc_activo,
  psc_credenciales_publicas,
  psc_credenciales_privadas,
  psc_comision_porcentaje,
  psc_comision_fija,
  psc_orden_visual,
  psc_detalle_pasarela
) values (
  'tranqi',
  'PAYPHONE',
  'Payphone (Tarjetas Visa / MasterCard / Diners y Saldo)',
  'PRUEBAS',
  true,
  jsonb_build_object(
    'storeId', 'STORE-DEMO-TRANQI-001',
    'modoSimulado', true,
    'moneda', 'USD',
    'pais', 'EC'
  ),
  jsonb_build_object(
    'token', 'TOKEN_DEMO_PRUEBAS_SIMULADOR',
    'modoSimulado', true
  ),
  6.00,
  0.0000,
  1,
  jsonb_build_object(
    'soporta_diferidos', true,
    'meses_diferido_permitidos', jsonb_build_array(3, 6, 12),
    'auto_reverso_minutos', 5,
    'descripcion', 'Pasarela oficial Payphone Botón de Pago con simulación de respuesta habilitada para pruebas.'
  )
)
on conflict (psc_negocio, psc_pasarela) do update set
  psc_activo = true,
  psc_nombre_visible = excluded.psc_nombre_visible,
  psc_credenciales_publicas = excluded.psc_credenciales_publicas,
  psc_credenciales_privadas = excluded.psc_credenciales_privadas,
  psc_detalle_pasarela = excluded.psc_detalle_pasarela;
