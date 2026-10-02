-- ==============================================================================
-- Migración: Variaciones Ecuatorianas de Notarización y Control de Vigencia Estacional
-- Negocios: Tranqi (Legal) y Tinkay / Margaritas / FastFix
-- ==============================================================================

do $$
declare
  v_prod_notarizacion uuid;
  v_prod_san_valentin uuid;
  v_cat_tramites uuid;
  v_cat_coreano uuid;
begin
  -- 1. Obtener o crear categoría 'Trámites Puntuales' para Tranqi
  select ctg_id into v_cat_tramites from comun_comercio.com_categoria
  where ctg_negocio = 'tranqi' and ctg_slug = 'tramites';

  if v_cat_tramites is null then
    insert into comun_comercio.com_categoria (ctg_negocio, ctg_nombre, ctg_slug, ctg_tipo, ctg_orden, ctg_activo)
    values ('tranqi', 'Trámites Puntuales', 'tramites', 'FORMATO', 1, true)
    returning ctg_id into v_cat_tramites;
  end if;

  -- 2. Asegurar Producto Master 'Notarización de Documentos & Poderes'
  insert into comun_comercio.com_producto (
    pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_categoria_principal_id, pro_detalle_producto
  )
  values (
    'tranqi',
    'Notarización de Documentos & Poderes',
    'notarizacion',
    'Notarización y gestión integral en notaría, con mensajería y traslado seguro de escrituras, poderes y declaraciones juramentadas.',
    'SERVICIO',
    true,
    true,
    v_cat_tramites,
    jsonb_build_object(
      'ambito', 'Trámite Notarial',
      'icono', 'FileCheck',
      'codigo_gobernanza', 'TRQ-NOT-DOC',
      'imagen_url', '/imagenes/catalogo/notarizacion.jpg',
      'video_url', 'https://www.youtube.com/watch?v=kXYiU_JCYtU',
      'tiempo_entrega', '24 a 48 horas hábiles',
      'vigencia_tipo', 'SIEMPRE',
      'pro_activo', true,
      'usos', jsonb_build_array('tramite_notarial', 'compraventa_inmueble', 'creacion_empresa', 'declaracion_juramentada', 'poder_especial'),
      'etiquetas', jsonb_build_array('notaria', 'poder notarial', 'escritura', 'protocolizacion', 'declaracion juramentada', 'union de hecho', 'materializacion digital', 'poder especial'),
      'logistica', jsonb_build_object(
        'delivery_incluido', true,
        'modalidad_transporte', 'COURIER_NOTARIAL',
        'etiqueta_transporte', '📦 Mensajería & Traslado Notarial',
        'cobertura_texto', 'Quito Urbano y Valles'
      ),
      'beneficios', jsonb_build_array(
        'Coordinación y turno prioritario en notaría de confianza',
        'Retiro y entrega de documentos a domicilio u oficina por mensajería segura',
        'Revisión jurídica previa de facultades, personerías y cláusulas habilitantes',
        'Emisión de constancia digital de protocolización'
      ),
      'requisitos', jsonb_build_array(
        'Cédula de ciudadanía o pasaporte vigente del compareciente',
        'Certificado de votación del último proceso electoral',
        'Minuta o borrador del mandato o documento a protocolizar'
      )
    )
  )
  on conflict (pro_negocio, pro_slug) do update set
    pro_nombre = excluded.pro_nombre,
    pro_descripcion = excluded.pro_descripcion,
    pro_destacado = true,
    pro_activo = true,
    pro_categoria_principal_id = excluded.pro_categoria_principal_id,
    pro_detalle_producto = excluded.pro_detalle_producto
  returning pro_id into v_prod_notarizacion;

  if v_prod_notarizacion is null then
    select pro_id into v_prod_notarizacion from comun_comercio.com_producto
    where pro_negocio = 'tranqi' and pro_slug = 'notarizacion';
  end if;

  -- 3. Insertar / Actualizar las 7 Variantes Notariales Ecuatorianas
  if v_prod_notarizacion is not null then
    -- 3.1 Declaración Juramentada para Personas Naturales
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-DEC-JUR',
      'Declaración Juramentada (Bienes, Ingresos o No Impedimento)',
      35.00, 45.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 1,
        'duracion_min', 30,
        'concepto_derecho', 'DECLARACION_JURAMENTADA',
        'modalidades', jsonb_build_array('virtual', 'presencial'),
        'descripcion_corta', 'Para concursos públicos, no impedimento laboral, justificación de ingresos o residencia.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_precio_comparacion = excluded.var_precio_comparacion,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.2 Declaración de Unión de Hecho
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-UNI-HEC',
      'Declaración Notarial de Unión de Hecho',
      90.00, 120.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 2,
        'duracion_min', 45,
        'concepto_derecho', 'UNION_DE_HECHO',
        'modalidades', jsonb_build_array('presencial', 'virtual'),
        'descripcion_corta', 'Reconocimiento solemne notarial con fines legales, IESS y patrimoniales.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.3 Otorgamiento de Poder Especial Notarial
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-POD-ESP',
      'Otorgamiento de Poder Especial Notarial',
      75.00, 95.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 3,
        'duracion_min', 45,
        'concepto_derecho', 'PODER_ESPECIAL',
        'modalidades', jsonb_build_array('virtual', 'presencial'),
        'descripcion_corta', 'Para venta de vehículo, cobro de pensión, trámites bancarios o IESS.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.4 Otorgamiento de Poder General Notarial
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-POD-GEN',
      'Otorgamiento de Poder General Notarial',
      140.00, 180.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 4,
        'duracion_min', 60,
        'concepto_derecho', 'PODER_GENERAL',
        'modalidades', jsonb_build_array('presencial'),
        'descripcion_corta', 'Facultades amplias de administración, disposición y representación judicial.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.5 Materialización de Documentos Digitales & Exterior
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-MAT-DOC',
      'Materialización de Documentos Digitales & Exterior (por hoja)',
      25.00, 35.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 5,
        'duracion_min', 30,
        'concepto_derecho', 'MATERIALIZACION_DIGITAL',
        'modalidades', jsonb_build_array('virtual'),
        'descripcion_corta', 'Certificación notarial con validez física de correos, contratos o firmas electrónicas.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.6 Reconocimiento de Firmas & Rúbricas
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-REC-FIR',
      'Reconocimiento de Firmas & Rúbricas en Contratos',
      40.00, 55.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 6,
        'duracion_min', 30,
        'concepto_derecho', 'RECONOCIMIENTO_FIRMA',
        'modalidades', jsonb_build_array('presencial', 'virtual'),
        'descripcion_corta', 'Autenticación notarial para contratos de arrendamiento, promesas y finiquitos.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;

    -- 3.7 Protocolización de Escrituras, Minutas y Estatutos
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_notarizacion, 'tranqi', 'TRQ-NOT-PRO-DOC',
      'Protocolización de Escrituras, Minutas y Estatutos',
      120.00, 160.00, 'IVA_15', 15, 'UNICO', true,
      jsonb_build_object(
        'orden', 7,
        'duracion_min', 60,
        'concepto_derecho', 'PROTOCOLIZACION',
        'modalidades', jsonb_build_array('presencial'),
        'descripcion_corta', 'Incorporación al libro de protocolo notarial con otorgamiento de copias de ley.'
      )
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 4. Semilla de Producto Estacional 'Bouquet San Valentín' en Tinkay
  select ctg_id into v_cat_coreano from comun_comercio.com_categoria
  where ctg_negocio = 'tinkay' and ctg_slug in ('cat-coreanos', 'cat-ocas-amor');

  insert into comun_comercio.com_producto (
    pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_categoria_principal_id, pro_detalle_producto
  )
  values (
    'tinkay',
    'Bouquet Edición Especial San Valentín',
    'tinkay-bouq-san-valentin',
    'Arreglo maestro de edición limitada para el Día del Amor y la Amistad. 24 a 50 rosas rojas premium aterciopeladas con bombones y dedicatoria.',
    'FISICO',
    true,
    true,
    v_cat_coreano,
    jsonb_build_object(
      'icono', 'Sparkles',
      'imagen_url', 'https://images.unsplash.com/photo-1563241527-3004b7be0ffd?w=1000&auto=format&fit=crop&q=80',
      'descripcion_corta', 'Edición estacional exclusiva San Valentín (10 al 15 de Febrero).',
      'etiquetas', jsonb_build_array('san valentin', '14 de febrero', 'amor', 'rosas rojas', 'edicion limitada'),
      'vigencia_tipo', 'ESTACIONAL_ANUAL',
      'fecha_inicio', '02-10',
      'fecha_fin', '02-15',
      'etiqueta_temporada', 'San Valentín',
      'mensaje_fuera_temporada', 'Disponible únicamente en temporada de San Valentín (del 10 al 15 de Febrero de cada año).',
      'tiempo_entrega', '🚚 Entrega garantizada 13 y 14 de Febrero',
      'tarifa_iva_predeterminada', 0,
      'codigo_impuesto_sri', 'IVA_0',
      'pro_activo', true
    )
  )
  on conflict (pro_negocio, pro_slug) do update set
    pro_nombre = excluded.pro_nombre,
    pro_descripcion = excluded.pro_descripcion,
    pro_destacado = true,
    pro_activo = true,
    pro_detalle_producto = excluded.pro_detalle_producto
  returning pro_id into v_prod_san_valentin;

  if v_prod_san_valentin is not null then
    insert into comun_comercio.com_variante (
      var_producto_id, var_negocio, var_sku, var_nombre, var_precio, var_precio_comparacion, var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    )
    values (
      v_prod_san_valentin, 'tinkay', 'TNK-VAL-24',
      'Bouquet San Valentín 24 Rosas Rojas + Bombones',
      35.00, 45.00, 'IVA_0', 0, 'REGULAR', true,
      jsonb_build_object('orden', 1, 'tallos', 24)
    )
    on conflict (var_negocio, var_sku) do update set
      var_nombre = excluded.var_nombre,
      var_precio = excluded.var_precio,
      var_activo = true;
  end if;

end $$;
