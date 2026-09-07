-- ==============================================================================
-- Migración: 20260907000003_tinkay_catalogo_productos_semilla_y_aria.sql
-- Módulo: Catálogo de Productos Tinkay Floristería, Semillas Multidimensionales,
--         Cross-Selling, Pasarela Payphone y Suministro Conversacional para ARIA.
-- Cumple: ADR-0003, TNK-001, TNK-002, TNK-004, PLT-009, PLT-010 y AGENTS.md.
-- ==============================================================================

-- 0. Asegurar existencia del esquema de negocio de Tinkay
create schema if not exists tinkay_floristeria;
grant usage on schema tinkay_floristeria to anon, authenticated, service_role;

-- 1. Semillas de Taxonomía Multidimensional (Categorías N:M)
-- En Tinkay los arreglos se clasifican tanto por FORMATO/COLECCION como por OCASION/EVENTO.
insert into comun_comercio.com_categoria (
  ctg_negocio, ctg_nombre, ctg_slug, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo, ctg_detalle_categoria
) values
  -- Formatos y Colecciones
  (
    'tinkay',
    'Para Florero',
    'cat-floreros',
    'Ramos de tallos largos seleccionados, listos y preparados para hidratarse en florero de agua.',
    'FORMATO',
    1,
    true,
    jsonb_build_object(
      'codigo', 'CAT_FLOREROS',
      'icono', 'Flower2',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-floreros',
      'palabras_clave', jsonb_build_array('florero', 'tallos', 'rosas', 'agua', 'cristal')
    )
  ),
  (
    'tinkay',
    'Estilo Coreano',
    'cat-coreanos',
    'Bouquets de vanguardia envueltos en papeles traslúcidos, plisados, capas satinadas y texturas de alta costura.',
    'COLECCION',
    2,
    true,
    jsonb_build_object(
      'codigo', 'CAT_COREANOS',
      'icono', 'Sparkles',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-coreanos',
      'palabras_clave', jsonb_build_array('coreano', 'papel plisado', 'envoltura', 'satinado', 'tendencia', 'vip')
    )
  ),
  (
    'tinkay',
    'Especiales y Mix',
    'cat-especiales',
    'Combinaciones botánicas exóticas de temporada: orquídeas, tulipanes, hortensias y follajes aromáticos.',
    'FORMATO',
    3,
    true,
    jsonb_build_object(
      'codigo', 'CAT_ESPECIALES',
      'icono', 'Palmtree',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-especiales',
      'palabras_clave', jsonb_build_array('mix', 'exotico', 'temporada', 'hortensias', 'tulipanes')
    )
  ),
  (
    'tinkay',
    'Abanicos & Pedestales',
    'cat-abanicos',
    'Composiciones monumentales de gran escala sobre atril o pedestal, con presencia imponente y solemne.',
    'FORMATO',
    4,
    true,
    jsonb_build_object(
      'codigo', 'CAT_ABANICOS',
      'icono', 'Maximize2',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-abanicos',
      'palabras_clave', jsonb_build_array('abanico', 'pedestal', 'monumental', 'atril', 'solemne', 'corona')
    )
  ),
  (
    'tinkay',
    'Detalles y Regalos',
    'cat-detalles',
    'Complementos de cross-selling: chocolates gourmet, globos burbuja con helio y mariposas 3D decorativas.',
    'COMPLEMENTO',
    5,
    true,
    jsonb_build_object(
      'codigo', 'CAT_DETALLES',
      'icono', 'Gift',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-detalles',
      'palabras_clave', jsonb_build_array('chocolates', 'ferrero', 'globo', 'burbuja', 'mariposas', 'regalo')
    )
  ),
  (
    'tinkay',
    'Decoración & Altares',
    'cat-eventos',
    'Diseños integrales para matrimonios, recepciones solemnes, iglesias y altares florales.',
    'EVENTO',
    6,
    true,
    jsonb_build_object(
      'codigo', 'CAT_EVENTOS',
      'icono', 'Church',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-eventos',
      'palabras_clave', jsonb_build_array('boda', 'altar', 'iglesia', 'evento', 'arco', 'decoracion')
    )
  ),
  -- Facetas por Ocasión
  (
    'tinkay',
    'Amor & Pedida de Mano',
    'cat-ocas-amor',
    'Expresiones exuberantes de amor apasionado, ramos de 100 rosas y detalles románticos memorables.',
    'OCASION',
    7,
    true,
    jsonb_build_object(
      'codigo', 'CAT_OCAS_AMOR',
      'icono', 'Heart',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-romance',
      'palabras_clave', jsonb_build_array('amor', 'novia', 'pedida de mano', 'romance', 'rosas rojas', 'pareja')
    )
  ),
  (
    'tinkay',
    'Aniversario',
    'cat-ocas-aniv',
    'Bouquets refinados y combinaciones elegantes para conmemorar hitos y fechas inolvidables.',
    'OCASION',
    8,
    true,
    jsonb_build_object(
      'codigo', 'CAT_OCAS_ANIV',
      'icono', 'Crown',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-aniversario',
      'palabras_clave', jsonb_build_array('aniversario', 'celebracion', 'boda', 'compromiso')
    )
  ),
  (
    'tinkay',
    'Cumpleaños',
    'cat-ocas-cumple',
    'Ramos alegres, vibrantes y festivos con empaques coloridos ideales para festejar un año más de vida.',
    'OCASION',
    9,
    true,
    jsonb_build_object(
      'codigo', 'CAT_OCAS_CUMPLE',
      'icono', 'Cake',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-cumpleanos',
      'palabras_clave', jsonb_build_array('cumpleanos', 'festejo', 'alegria', 'colores', 'sorpresa')
    )
  ),
  (
    'tinkay',
    'Condolencias & Funerarios',
    'cat-ocas-condol',
    'Acompañamiento solemne y respetuoso en momentos de duelo. Activa el modo visual sobrio en UI y tono sereno en ARIA.',
    'OCASION',
    10,
    true,
    jsonb_build_object(
      'codigo', 'CAT_OCAS_CONDOL',
      'icono', 'Feather',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-condolencias',
      'modo_visual_sobrio', true,
      'palabras_clave', jsonb_build_array('condolencias', 'pesame', 'funebre', 'velacion', 'duelo', 'solemne', 'paz')
    )
  )
on conflict (ctg_negocio, ctg_slug) do update set
  ctg_nombre = excluded.ctg_nombre,
  ctg_descripcion = excluded.ctg_descripcion,
  ctg_tipo = excluded.ctg_tipo,
  ctg_orden = excluded.ctg_orden,
  ctg_activo = true,
  ctg_detalle_categoria = excluded.ctg_detalle_categoria,
  ctg_actualizado_en = now();

-- 2. Semillas de Productos Maestros
insert into comun_comercio.com_producto (
  pro_negocio, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_activo, pro_detalle_producto
) values
  (
    'tinkay',
    'Bouquet Clásico para Florero',
    'tinkay-bouq-florero',
    'Ramos de rosas de exportación seleccionadas de tallo largo, preparadas con follaje fino e hidratación prolongada para lucir en florero.',
    'FISICO',
    true,
    true,
    jsonb_build_object(
      'icono', 'Flower2',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-bouq-florero',
      'descripcion_corta', 'Rosas de exportación de tallo largo con follaje de hidratación prolongada.',
      'etiquetas', jsonb_build_array('rosas', 'florero', '25 rosas', '50 rosas', '100 rosas', 'amor', 'aniversario'),
      'ocasion_recomendada', 'CAT_OCAS_AMOR'
    )
  ),
  (
    'tinkay',
    'Bouquet Diseño Estilo Coreano',
    'tinkay-bouq-coreano',
    'Arreglo exclusivo de vanguardia envuelto en finos papeles coreanos plisados y translúcidos con caída de cintas de seda satinada.',
    'FISICO',
    true,
    true,
    jsonb_build_object(
      'icono', 'Sparkles',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-bouq-coreano',
      'descripcion_corta', 'Bouquet moderno envuelto en papel coreano plisado y cintas satinadas.',
      'etiquetas', jsonb_build_array('coreano', 'vanguardia', 'papel plisado', 'cumpleanos', 'vip', 'romance'),
      'ocasion_recomendada', 'CAT_OCAS_CUMPLE'
    )
  ),
  (
    'tinkay',
    'Bouquet Mix Exótico de Temporada',
    'tinkay-bouq-mix',
    'Composición floral multicolor que armoniza rosas ecuatorianas, orquídeas, eucalipto perfumado y flores silvestres de temporada.',
    'FISICO',
    true,
    true,
    jsonb_build_object(
      'icono', 'Palmtree',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-bouq-mix',
      'descripcion_corta', 'Armonía silvestre y exótica con flores de temporada y eucalipto aromático.',
      'etiquetas', jsonb_build_array('mix', 'exotico', 'silvestre', 'follaje', 'multicolor'),
      'ocasion_recomendada', 'CAT_OCAS_CUMPLE'
    )
  ),
  (
    'tinkay',
    'Arreglo Monumental en Abanico / Pedestal',
    'tinkay-abanico-monumental',
    'Diseño monumental de gran altura dispuesto en abanico sobre pedestal o base solemne. Ideal para tributos de condolencias y ceremonias.',
    'FISICO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Maximize2',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-abanico-monumental',
      'descripcion_corta', 'Imponente arreglo sobre pedestal para velaciones, iglesias y homenajes solemnes.',
      'etiquetas', jsonb_build_array('abanico', 'pedestal', 'condolencias', 'iglesia', 'altar', 'monumental'),
      'ocasion_recomendada', 'CAT_OCAS_CONDOL'
    )
  ),
  (
    'tinkay',
    'Caja de Chocolates Ferrero Rocher',
    'tinkay-choc-ferrero',
    'Exquisita selección de bombones de avellana entera y crema de avellanas crujientes bañados en chocolate con leche.',
    'FISICO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Gift',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-detalles',
      'descripcion_corta', 'Bombones de avellana y chocolate con leche para endulzar el momento.',
      'etiquetas', jsonb_build_array('chocolates', 'ferrero', 'regalo', 'dulce', 'cross-sell'),
      'es_complemento', true
    )
  ),
  (
    'tinkay',
    'Globo Burbuja Personalizado con Helio',
    'tinkay-globo-burbuja',
    'Globo burbuja transparente de cristal inflado con gas helio certificado y dedicatoria personalizada en vinil adhesivo metalizado.',
    'FISICO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Gift',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-detalles',
      'descripcion_corta', 'Globo transparente con helio y mensaje caligráfico en vinil metalizado.',
      'etiquetas', jsonb_build_array('globo', 'helio', 'burbuja', 'mensaje', 'personalizado'),
      'es_complemento', true
    )
  ),
  (
    'tinkay',
    'Set de Mariposas Decorativas 3D',
    'tinkay-mariposas-3d',
    'Trío de mariposas decorativas en relieve tridimensional para posar sutilmente sobre los pétalos del bouquet floral.',
    'FISICO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Sparkles',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-detalles',
      'descripcion_corta', 'Set de 3 mariposas 3D que aportan un toque de fantasía a los pétalos.',
      'etiquetas', jsonb_build_array('mariposas', '3d', 'adorno', 'dorado', 'complemento'),
      'es_complemento', true
    )
  ),
  (
    'tinkay',
    'Arco Floral y Decoración de Altar',
    'tinkay-arco-altar',
    'Estructura monumental de arco o columnas florales para matrimonios civiles, eclesiásticos o eventos corporativos de gala.',
    'SERVICIO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Church',
      'album_fotos_url', 'https://photos.app.goo.gl/tinkay-eventos',
      'descripcion_corta', 'Decoración botánica integral para ceremonias matrimoniales y altares solemnes.',
      'etiquetas', jsonb_build_array('arco', 'altar', 'iglesia', 'boda', 'montaje', 'proforma'),
      'ocasion_recomendada', 'CAT_EVENTOS'
    )
  ),
  (
    'tinkay',
    'Servicios Logísticos y Entrega en Horario Exacto',
    'tinkay-servicios-logisticos',
    'Líneas de servicio especializado: montaje floral en sitio, desmontaje nocturno y asignación de ruta exclusiva a hora exacta.',
    'SERVICIO',
    false,
    true,
    jsonb_build_object(
      'icono', 'Truck',
      'descripcion_corta', 'Servicios de montaje, logística e itinerario exclusivo programado.',
      'etiquetas', jsonb_build_array('montaje', 'flete', 'horario exacto', 'madrugador', 'logistica')
    )
  )
on conflict (pro_negocio, pro_slug) do update set
  pro_nombre = excluded.pro_nombre,
  pro_descripcion = excluded.pro_descripcion,
  pro_tipo = excluded.pro_tipo,
  pro_destacado = excluded.pro_destacado,
  pro_activo = true,
  pro_detalle_producto = excluded.pro_detalle_producto,
  pro_actualizado_en = now();

-- 3. Asignación de Categoría Principal Canónica a Productos Maestros
update comun_comercio.com_producto p
set pro_categoria_principal_id = c.ctg_id
from comun_comercio.com_categoria c
where p.pro_negocio = 'tinkay' and c.ctg_negocio = 'tinkay'
  and (
    (p.pro_slug = 'tinkay-bouq-florero' and c.ctg_slug = 'cat-floreros') or
    (p.pro_slug = 'tinkay-bouq-coreano' and c.ctg_slug = 'cat-coreanos') or
    (p.pro_slug = 'tinkay-bouq-mix' and c.ctg_slug = 'cat-especiales') or
    (p.pro_slug = 'tinkay-abanico-monumental' and c.ctg_slug = 'cat-abanicos') or
    (p.pro_slug in ('tinkay-choc-ferrero', 'tinkay-globo-burbuja', 'tinkay-mariposas-3d') and c.ctg_slug = 'cat-detalles') or
    (p.pro_slug in ('tinkay-arco-altar', 'tinkay-servicios-logisticos') and c.ctg_slug = 'cat-eventos')
  );

-- 4. Categorización Multidimensional Muchos a Muchos (N:M)
-- Asocia productos a múltiples facetas (ej. Florero a Florero + Amor + Aniversario)
do $$
declare
  v_prod_florero uuid;
  v_prod_coreano uuid;
  v_prod_mix uuid;
  v_prod_abanico uuid;
  v_prod_ferrero uuid;
  v_prod_globo uuid;
  v_prod_mariposas uuid;
  v_prod_altar uuid;
  
  v_cat_floreros uuid;
  v_cat_coreanos uuid;
  v_cat_especiales uuid;
  v_cat_abanicos uuid;
  v_cat_detalles uuid;
  v_cat_eventos uuid;
  v_cat_amor uuid;
  v_cat_aniv uuid;
  v_cat_cumple uuid;
  v_cat_condol uuid;
begin
  -- Obtener IDs de Productos
  select pro_id into v_prod_florero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-florero';
  select pro_id into v_prod_coreano from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-coreano';
  select pro_id into v_prod_mix from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-mix';
  select pro_id into v_prod_abanico from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-abanico-monumental';
  select pro_id into v_prod_ferrero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-choc-ferrero';
  select pro_id into v_prod_globo from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-globo-burbuja';
  select pro_id into v_prod_mariposas from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-mariposas-3d';
  select pro_id into v_prod_altar from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-arco-altar';

  -- Obtener IDs de Categorías
  select ctg_id into v_cat_floreros from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-floreros';
  select ctg_id into v_cat_coreanos from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-coreanos';
  select ctg_id into v_cat_especiales from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-especiales';
  select ctg_id into v_cat_abanicos from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-abanicos';
  select ctg_id into v_cat_detalles from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-detalles';
  select ctg_id into v_cat_eventos from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-eventos';
  select ctg_id into v_cat_amor from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-ocas-amor';
  select ctg_id into v_cat_aniv from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-ocas-aniv';
  select ctg_id into v_cat_cumple from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-ocas-cumple';
  select ctg_id into v_cat_condol from comun_comercio.com_categoria where ctg_negocio = 'tinkay' and ctg_slug = 'cat-ocas-condol';

  -- 4.1 Bouquet Florero: Principal en Floreros, también en Amor y Aniversario
  if v_prod_florero is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values
      ('tinkay', v_prod_florero, v_cat_floreros, true, 1),
      ('tinkay', v_prod_florero, v_cat_amor, false, 2),
      ('tinkay', v_prod_florero, v_cat_aniv, false, 3)
    on conflict (pct_producto_id, pct_categoria_id) do update set pct_es_principal = excluded.pct_es_principal;
  end if;

  -- 4.2 Bouquet Coreano: Principal en Coreanos, también en Cumpleaños y Amor
  if v_prod_coreano is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values
      ('tinkay', v_prod_coreano, v_cat_coreanos, true, 1),
      ('tinkay', v_prod_coreano, v_cat_cumple, false, 2),
      ('tinkay', v_prod_coreano, v_cat_amor, false, 3)
    on conflict (pct_producto_id, pct_categoria_id) do update set pct_es_principal = excluded.pct_es_principal;
  end if;

  -- 4.3 Bouquet Mix: Principal en Especiales, también en Cumpleaños y Aniversario
  if v_prod_mix is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values
      ('tinkay', v_prod_mix, v_cat_especiales, true, 1),
      ('tinkay', v_prod_mix, v_cat_cumple, false, 2),
      ('tinkay', v_prod_mix, v_cat_aniv, false, 3)
    on conflict (pct_producto_id, pct_categoria_id) do update set pct_es_principal = excluded.pct_es_principal;
  end if;

  -- 4.4 Abanico Monumental: Principal en Abanicos, también en Condolencias y Eventos
  if v_prod_abanico is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values
      ('tinkay', v_prod_abanico, v_cat_abanicos, true, 1),
      ('tinkay', v_prod_abanico, v_cat_condol, false, 2),
      ('tinkay', v_prod_abanico, v_cat_eventos, false, 3)
    on conflict (pct_producto_id, pct_categoria_id) do update set pct_es_principal = excluded.pct_es_principal;
  end if;

  -- 4.5 Arco de Altar: Principal en Eventos, también en Aniversario
  if v_prod_altar is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values
      ('tinkay', v_prod_altar, v_cat_eventos, true, 1),
      ('tinkay', v_prod_altar, v_cat_aniv, false, 2)
    on conflict (pct_producto_id, pct_categoria_id) do update set pct_es_principal = excluded.pct_es_principal;
  end if;

  -- 4.6 Complementos en Detalles
  if v_prod_ferrero is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values ('tinkay', v_prod_ferrero, v_cat_detalles, true, 1)
    on conflict (pct_producto_id, pct_categoria_id) do nothing;
  end if;

  if v_prod_globo is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values ('tinkay', v_prod_globo, v_cat_detalles, true, 1)
    on conflict (pct_producto_id, pct_categoria_id) do nothing;
  end if;

  if v_prod_mariposas is not null then
    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal, pct_orden)
    values ('tinkay', v_prod_mariposas, v_cat_detalles, true, 1)
    on conflict (pct_producto_id, pct_categoria_id) do nothing;
  end if;
end $$;

-- 5. Semillas de Variantes Comerciales / SKUs (Precios Base SRI + IVA 15%)
-- Base imponible = PVP / 1.15 con 4 decimales
do $$
declare
  v_prod_florero uuid;
  v_prod_coreano uuid;
  v_prod_mix uuid;
  v_prod_abanico uuid;
  v_prod_ferrero uuid;
  v_prod_globo uuid;
  v_prod_mariposas uuid;
  v_prod_altar uuid;
  v_prod_logistica uuid;
begin
  select pro_id into v_prod_florero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-florero';
  select pro_id into v_prod_coreano from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-coreano';
  select pro_id into v_prod_mix from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-mix';
  select pro_id into v_prod_abanico from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-abanico-monumental';
  select pro_id into v_prod_ferrero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-choc-ferrero';
  select pro_id into v_prod_globo from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-globo-burbuja';
  select pro_id into v_prod_mariposas from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-mariposas-3d';
  select pro_id into v_prod_altar from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-arco-altar';
  select pro_id into v_prod_logistica from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-servicios-logisticos';

  -- 5.1 Variantes Bouquet Florero
  if v_prod_florero is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_florero, 'TNK-FLOR-25', '25 Tallos de Rosas', 17.3913, 20.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 20.00, 'tallos', 25, 'receta_bom', '25 Rosas Exportación + 1 Sobre Alimento + Cinta')),
      ('tinkay', v_prod_florero, 'TNK-FLOR-50', '50 Tallos de Rosas', 21.7391, 25.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 25.00, 'tallos', 50, 'receta_bom', '50 Rosas Exportación + 2 Sobres Alimento + Cinta')),
      ('tinkay', v_prod_florero, 'TNK-FLOR-100', '100 Tallos de Rosas (Gran Impacto)', 39.1304, 45.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 45.00, 'tallos', 100, 'receta_bom', '100 Rosas Exportación + 4 Sobres Alimento + 2 Cintas'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_precio_comparacion = excluded.var_precio_comparacion,
      var_nombre = excluded.var_nombre,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.2 Variantes Estilo Coreano
  if v_prod_coreano is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_coreano, 'TNK-COR-PEQ', 'Pequeño (12 Rosas)', 21.7391, 25.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 25.00, 'tamano', 'Pequeño', 'receta_bom', '12 Rosas + 2 Pliegos Coreanos + Follaje')),
      ('tinkay', v_prod_coreano, 'TNK-COR-MED', 'Mediano (24 Rosas)', 30.4348, 35.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 35.00, 'tamano', 'Mediano', 'receta_bom', '24 Rosas + 3 Pliegos Coreanos + Follaje Eucalipto')),
      ('tinkay', v_prod_coreano, 'TNK-COR-GRA', 'Grande (36 Rosas)', 39.1304, 45.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 45.00, 'tamano', 'Grande', 'receta_bom', '36 Rosas + 4 Pliegos Coreanos + Follaje Especial')),
      ('tinkay', v_prod_coreano, 'TNK-COR-GIG', 'Gigante VIP (50 Rosas + Corona + Mariposas)', 52.1739, 60.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 60.00, 'tamano', 'Gigante VIP', 'receta_bom', '50 Rosas + 6 Pliegos + Mariposas 3D + Corona'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_precio_comparacion = excluded.var_precio_comparacion,
      var_nombre = excluded.var_nombre,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.3 Variantes Mix Exótico
  if v_prod_mix is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_mix, 'TNK-MIX-PEQ', 'Mix Pequeño de Temporada', 30.4348, 35.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 35.00, 'tamano', 'Pequeño')),
      ('tinkay', v_prod_mix, 'TNK-MIX-GRA', 'Mix Grande de Temporada', 39.1304, 45.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 45.00, 'tamano', 'Grande'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_precio_comparacion = excluded.var_precio_comparacion,
      var_nombre = excluded.var_nombre,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.4 Variantes Abanico / Pedestal
  if v_prod_abanico is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_abanico, 'TNK-ABA-MONU', 'Abanico Monumental con Pedestal y Cinta', 69.5652, 80.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 80.00, 'incluye_pedestal', true, 'incluye_cinta_membretada', true))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.5 Variantes Detalles y Regalos
  if v_prod_ferrero is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_ferrero, 'TNK-CHOC-4', 'Ferrero Rocher Caja x4 Unidades', 4.3478, 5.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 5.00, 'unidades', 4)),
      ('tinkay', v_prod_ferrero, 'TNK-CHOC-8', 'Ferrero Rocher Caja x8 Unidades', 7.8261, 9.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 9.00, 'unidades', 8))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  if v_prod_globo is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_globo, 'TNK-GLO-BUR', 'Globo Burbuja Helio con Frase Personalizada', 4.3478, 5.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 5.00, 'gas', 'Helio certificado'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  if v_prod_mariposas is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_mariposas, 'TNK-MAR-SET', 'Set x3 Mariposas Decorativas 3D', 1.7391, 2.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 2.00, 'unidades', 3))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.6 Variantes Decoración de Altar
  if v_prod_altar is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_altar, 'TNK-ALT-BAS', 'Opción 1: Altar Básico', 86.9565, 100.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 100.00, 'nivel', 'Básico')),
      ('tinkay', v_prod_altar, 'TNK-ALT-MED', 'Opción 2: Altar Medio', 130.4348, 150.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 150.00, 'nivel', 'Medio')),
      ('tinkay', v_prod_altar, 'TNK-ALT-PRO', 'Opción 3: Full Floral / Pro', 173.9130, 200.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 200.00, 'nivel', 'Full Pro'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;

  -- 5.7 Variantes Servicios Logísticos
  if v_prod_logistica is not null then
    insert into comun_comercio.com_variante (
      var_negocio, var_producto_id, var_sku, var_nombre, var_precio, var_precio_comparacion,
      var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta, var_activo, var_detalle_variante
    ) values
      ('tinkay', v_prod_logistica, 'TNK-SRV-INST', 'Servicio de Montaje e Instalación en Sitio', 26.0870, 30.0000, 'IVA_15', 15.00, 'TIEMPO_MANO_OBRA', true,
       jsonb_build_object('pvp_nominal', 30.00)),
      ('tinkay', v_prod_logistica, 'TNK-SRV-DESM', 'Servicio de Desmontaje en Horario Especial', 17.3913, 20.0000, 'IVA_15', 15.00, 'TIEMPO_MANO_OBRA', true,
       jsonb_build_object('pvp_nominal', 20.00)),
      ('tinkay', v_prod_logistica, 'TNK-SRV-TRAN', 'Transporte y Flete Logístico para Eventos', 26.0870, 30.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 30.00)),
      ('tinkay', v_prod_logistica, 'TNK-LOG-HORA-EXACTA', 'Recargo por Entrega en Horario Exacto / Madrugador', 8.6957, 10.0000, 'IVA_15', 15.00, 'UNICO', true,
       jsonb_build_object('pvp_nominal', 10.00, 'prioridad', 'RUTA_EXCLUSIVA'))
    on conflict (var_negocio, var_sku) do update set
      var_precio = excluded.var_precio,
      var_activo = true,
      var_detalle_variante = excluded.var_detalle_variante;
  end if;
end $$;

-- 6. Cross-Selling / Complementos Relacionados (`com_producto_relacionado`)
-- Asocia los bouquets principales a Ferrero Rocher, Globo Burbuja y Mariposas 3D
do $$
declare
  v_p_florero uuid;
  v_p_coreano uuid;
  v_p_mix uuid;
  v_p_ferrero uuid;
  v_p_globo uuid;
  v_p_mariposas uuid;
begin
  select pro_id into v_p_florero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-florero';
  select pro_id into v_p_coreano from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-coreano';
  select pro_id into v_p_mix from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-bouq-mix';
  select pro_id into v_p_ferrero from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-choc-ferrero';
  select pro_id into v_p_globo from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-globo-burbuja';
  select pro_id into v_p_mariposas from comun_comercio.com_producto where pro_negocio = 'tinkay' and pro_slug = 'tinkay-mariposas-3d';

  -- Cross-sell para Bouquet Florero
  if v_p_florero is not null then
    if v_p_ferrero is not null then
      insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
      values ('tinkay', v_p_florero, v_p_ferrero, 'CROSS_SELL', 1)
      on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
    end if;
    if v_p_globo is not null then
      insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
      values ('tinkay', v_p_florero, v_p_globo, 'CROSS_SELL', 2)
      on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
    end if;
  end if;

  -- Cross-sell para Bouquet Coreano
  if v_p_coreano is not null then
    if v_p_mariposas is not null then
      insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
      values ('tinkay', v_p_coreano, v_p_mariposas, 'CROSS_SELL', 1)
      on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
    end if;
    if v_p_ferrero is not null then
      insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
      values ('tinkay', v_p_coreano, v_p_ferrero, 'CROSS_SELL', 2)
      on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
    end if;
    if v_p_globo is not null then
      insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
      values ('tinkay', v_p_coreano, v_p_globo, 'CROSS_SELL', 3)
      on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
    end if;
  end if;

  -- Cross-sell para Bouquet Mix
  if v_p_mix is not null and v_p_ferrero is not null then
    insert into comun_comercio.com_producto_relacionado (prl_negocio, prl_producto_origen_id, prl_producto_destino_id, prl_tipo_relacion, prl_orden)
    values ('tinkay', v_p_mix, v_p_ferrero, 'CROSS_SELL', 1)
    on conflict (prl_producto_origen_id, prl_producto_destino_id) do nothing;
  end if;
end $$;

-- 7. Configuración de Pasarela Payphone para Tinkay (Modo Pruebas / Simulado)
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
  'tinkay',
  'PAYPHONE',
  'Payphone (Tarjetas Visa / MasterCard y Saldo App)',
  'PRUEBAS',
  true,
  jsonb_build_object(
    'storeId', 'STORE-DEMO-TINKAY-001',
    'modoSimulado', true,
    'moneda', 'USD',
    'pais', 'EC'
  ),
  jsonb_build_object(
    'token', 'TOKEN_DEMO_PRUEBAS_TINKAY',
    'modoSimulado', true
  ),
  6.00,
  0.0000,
  1,
  jsonb_build_object(
    'soporta_diferidos', true,
    'meses_diferido_permitidos', jsonb_build_array(3, 6),
    'auto_reverso_minutos', 5,
    'descripcion', 'Pasarela oficial Payphone para Tinkay Floristería con confirmación automática y modo simulado.'
  )
)
on conflict (psc_negocio, psc_pasarela) do update set
  psc_activo = true,
  psc_nombre_visible = excluded.psc_nombre_visible,
  psc_credenciales_publicas = excluded.psc_credenciales_publicas,
  psc_credenciales_privadas = excluded.psc_credenciales_privadas,
  psc_detalle_pasarela = excluded.psc_detalle_pasarela;

-- 8. Función RPC de Consulta Conversacional para ARIA (`consultar_catalogo_tinkay`)
-- Expone el suministro agéntico para WhatsApp YCloud.
create or replace function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(
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

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'producto_id', p.pro_id,
      'nombre', p.pro_nombre,
      'slug', p.pro_slug,
      'descripcion', coalesce(p.pro_detalle_producto->>'descripcion_corta', p.pro_descripcion),
      'categoria_principal', cp.ctg_nombre,
      'album_fotos_url', coalesce(
        p.pro_detalle_producto->>'album_fotos_url',
        cp.ctg_detalle_categoria->>'album_fotos_url',
        'https://photos.app.goo.gl/tinkay-catalogo-oficial'
      ),
      'icono', p.pro_detalle_producto->>'icono',
      'es_condolencias', exists (
        select 1 from comun_comercio.com_producto_categoria pc_chk
        join comun_comercio.com_categoria c_chk on c_chk.ctg_id = pc_chk.pct_categoria_id
        where pc_chk.pct_producto_id = p.pro_id
          and (c_chk.ctg_slug = 'cat-ocas-condol' or c_chk.ctg_detalle_categoria->>'codigo' = 'CAT_OCAS_CONDOL')
      ),
      'variantes', (
        select jsonb_agg(
          jsonb_build_object(
            'sku', v.var_sku,
            'nombre', v.var_nombre,
            'pvp_usd', round(v.var_precio * (1 + v.var_tarifa_iva_porcentaje / 100.0), 2),
            'pvp_formateado', concat('$', to_char(round(v.var_precio * (1 + v.var_tarifa_iva_porcentaje / 100.0), 2), 'FM999,990.00')),
            'pvp_centavos', round(v.var_precio * (1 + v.var_tarifa_iva_porcentaje / 100.0) * 100),
            'base_imponible', v.var_precio,
            'tarifa_iva', v.var_tarifa_iva_porcentaje,
            'receta_bom', v.var_detalle_variante->>'receta_bom'
          )
          order by v.var_precio asc
        )
        from comun_comercio.com_variante v
        where v.var_producto_id = p.pro_id
          and v.var_activo = true
          and (
            v_presupuesto_centavos is null
            or round(v.var_precio * (1 + v.var_tarifa_iva_porcentaje / 100.0) * 100) <= v_presupuesto_centavos
          )
      ),
      'complementos_sugeridos', (
        select jsonb_agg(
          jsonb_build_object(
            'producto_id', rel_p.pro_id,
            'nombre', rel_p.pro_nombre,
            'descripcion', rel_p.pro_detalle_producto->>'descripcion_corta',
            'pvp_desde', (
              select concat('$', to_char(min(round(rel_v.var_precio * (1 + rel_v.var_tarifa_iva_porcentaje / 100.0), 2)), 'FM999,990.00'))
              from comun_comercio.com_variante rel_v
              where rel_v.var_producto_id = rel_p.pro_id and rel_v.var_activo = true
            )
          )
        )
        from comun_comercio.com_producto_relacionado prl
        join comun_comercio.com_producto rel_p on rel_p.pro_id = prl.prl_producto_destino_id
        where prl.prl_producto_origen_id = p.pro_id
          and prl.prl_tipo_relacion = 'CROSS_SELL'
          and rel_p.pro_activo = true
      )
    ) as item
    from comun_comercio.com_producto p
    left join comun_comercio.com_categoria cp on cp.ctg_id = p.pro_categoria_principal_id
    where p.pro_negocio = 'tinkay'
      and p.pro_activo = true
      -- Filtro de búsqueda por texto libre
      and (
        p_termino is null
        or trim(p_termino) = ''
        or p.pro_nombre ilike concat('%', trim(p_termino), '%')
        or p.pro_descripcion ilike concat('%', trim(p_termino), '%')
        or exists (
          select 1 from jsonb_array_elements_text(coalesce(p.pro_detalle_producto->'etiquetas', '[]'::jsonb)) elem
          where elem ilike concat('%', trim(p_termino), '%')
        )
      )
      -- Filtro por Ocasión
      and (
        p_ocasion is null
        or upper(trim(p_ocasion)) in ('CUALQUIERA', 'TODAS', '')
        or exists (
          select 1 from comun_comercio.com_producto_categoria pc
          join comun_comercio.com_categoria c on c.ctg_id = pc.pct_categoria_id
          where pc.pct_producto_id = p.pro_id
            and (
              c.ctg_slug ilike concat('%', lower(trim(p_ocasion)), '%')
              or (c.ctg_detalle_categoria->>'codigo') ilike concat('%', upper(trim(p_ocasion)), '%')
              or c.ctg_nombre ilike concat('%', trim(p_ocasion), '%')
            )
        )
      )
      -- Filtro por Formato o Colección
      and (
        p_formato is null
        or upper(trim(p_formato)) in ('CUALQUIERA', 'TODAS', '')
        or exists (
          select 1 from comun_comercio.com_producto_categoria pc
          join comun_comercio.com_categoria c on c.ctg_id = pc.pct_categoria_id
          where pc.pct_producto_id = p.pro_id
            and (
              c.ctg_slug ilike concat('%', lower(trim(p_formato)), '%')
              or (c.ctg_detalle_categoria->>'codigo') ilike concat('%', upper(trim(p_formato)), '%')
              or c.ctg_nombre ilike concat('%', trim(p_formato), '%')
            )
        )
      )
      -- Filtro por presupuesto: debe tener al menos una variante dentro del presupuesto
      and (
        v_presupuesto_centavos is null
        or exists (
          select 1 from comun_comercio.com_variante v_chk
          where v_chk.var_producto_id = p.pro_id
            and v_chk.var_activo = true
            and round(v_chk.var_precio * (1 + v_chk.var_tarifa_iva_porcentaje / 100.0) * 100) <= v_presupuesto_centavos
        )
      )
    order by p.pro_destacado desc, p.pro_nombre asc
  ) sub;

  return v_resultado;
end;
$$;

-- Permisos de ejecución de la función para usuarios anónimos, autenticados y service_role
grant execute on function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(text, text, numeric, text) to anon, authenticated, service_role;

-- Comentario descriptivo de auditoría
comment on function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional is
  'Suministro oficial de catálogo conversacional para el agente ARIA (WhatsApp/YCloud) y vitrina web de Tinkay Floristería.';
