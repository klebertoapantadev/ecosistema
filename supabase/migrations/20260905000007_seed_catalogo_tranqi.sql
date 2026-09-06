-- ==============================================================================
-- Migración: 20260905000007_seed_catalogo_tranqi.sql
-- Siembra: catálogo comercial de Tranqi en comun_comercio (PLT-009) — el que
--          hace agendable el sistema de PLT-020.
-- ==============================================================================
--
-- Fuente: gobernanza/productos/tranqi/catalogo-productos.md, cuyo propio
-- encabezado dice "Propuesta Preliminar (Precios supuestos para calibracion
-- legal y comercial)". Son datos de calibracion, no la lista de precios
-- definitiva: se siembran para que el flujo de agenda y cobertura pueda
-- ejercitarse de punta a punta, y se corrigen cuando negocio cierre tarifas.
-- Por eso cada fila lleva `preliminar: true` en su jsonb de detalle: es
-- filtrable y nadie tiene que adivinar despues que era supuesto y que no.
--
-- Todo con `on conflict do nothing` sobre las claves naturales (slug, sku), de
-- modo que re-ejecutar la migracion no duplica ni pisa precios ya corregidos.
--
-- Los tres campos que consume la agenda viven en var_detalle_variante:
--   duracion_min      -> cuanto ocupa en el calendario del abogado
--   concepto_derecho  -> contra que cupo del plan se descuenta
--   materia_codigo    -> por que materia rutea el turno rotativo
-- «Divorcio» y «Conciliacion» son variantes, no materias: el primero cae en
-- Familia y Niñez y el segundo es un metodo (MASC) que atraviesa varias.
-- Meterlos en trq_materia ensuciaria el catalogo y romperia la clasificacion
-- de casos, que ya usa cas_materia_id.

-- ============ 1. Categorias de navegacion ============

insert into comun_comercio.com_categoria (ctg_negocio, ctg_nombre, ctg_slug, ctg_descripcion, ctg_tipo, ctg_orden, ctg_detalle_categoria)
values
  ('tranqi', 'Trámites Puntuales',   'tramites',      'Trámites con honorarios fijos y alcance estandarizado.',        'FORMATO', 1, '{"codigo":"TRQ_TRAMITES","preliminar":true}'),
  ('tranqi', 'Consultas Legales',    'consultas',     'Orientación y asesoría telemática con abogado verificado.',     'FORMATO', 2, '{"codigo":"TRQ_CONSULTAS","preliminar":true}'),
  ('tranqi', 'Planes Familiares',    'planes',        'Suscripción de protección y asesoría jurídica continua.',       'FORMATO', 3, '{"codigo":"TRQ_PLANES_B2C","preliminar":true}'),
  ('tranqi', 'Planes Corporativos',  'corporativos',  'Cobertura legal para empresas y colaboradores por tramos.',     'FORMATO', 4, '{"codigo":"TRQ_CORP_B2B","preliminar":true}'),
  ('tranqi', 'Procesos Judiciales',  'procesos',      'Litigios, divorcios y trámites complejos bajo demanda.',        'FORMATO', 5, '{"codigo":"TRQ_PROCESOS","preliminar":true}')
on conflict (ctg_negocio, ctg_slug) do nothing;

-- ============ 2. Productos maestros ============

insert into comun_comercio.com_producto (pro_negocio, pro_categoria_principal_id, pro_nombre, pro_slug, pro_descripcion, pro_tipo, pro_destacado, pro_detalle_producto)
select 'tranqi', c.ctg_id, p.nombre, p.slug, p.descripcion, p.tipo, p.destacado, '{"preliminar":true}'::jsonb
from (values
  ('consultas',    'Consulta Legal Telemática',        'consulta-telematica',   'Videoconsulta con abogado verificado de la materia que necesitas.',                'SERVICIO',    true),
  ('consultas',    'Conciliación Extrajudicial',       'conciliacion',          'Acompañamiento en mediación y acuerdos sin llegar a juicio.',                      'SERVICIO',    false),
  ('consultas',    'Asesoría por Accidente de Tránsito','accidente-transito',   'Orientación inmediata tras un siniestro: partes, seguros y responsabilidades.',    'SERVICIO',    false),
  ('tramites',     'Notarización de Documentos',       'notarizacion',          'Notarización y gestión en notaría, con mensajería de documentos incluida.',        'SERVICIO',    true),
  ('tramites',     'Permiso de Salida del País',       'permiso-salida',        'Trámite integral de autorización de salida para menores de edad.',                 'SERVICIO',    false),
  ('tramites',     'Revisión Express de Contratos',    'revision-contratos',    'Análisis de contrato de arriendo o servicios con semáforo de riesgo.',             'SERVICIO',    true),
  ('procesos',     'Divorcio por Mutuo Acuerdo',       'divorcio-mutuo-acuerdo','Patrocinio completo del divorcio consensuado, desde la minuta hasta la sentencia.', 'SERVICIO',    false),
  ('planes',       'Plan de Protección Jurídica',      'plan-proteccion',       'Suscripción con consultas y trámites incluidos para ti y tu familia.',             'SUSCRIPCION', true)
) as p(cat, nombre, slug, descripcion, tipo, destacado)
join comun_comercio.com_categoria c on c.ctg_negocio = 'tranqi' and c.ctg_slug = p.cat
on conflict (pro_negocio, pro_slug) do nothing;

insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id, pct_es_principal)
select 'tranqi', pro_id, pro_categoria_principal_id, true
from comun_comercio.com_producto
where pro_negocio = 'tranqi' and pro_categoria_principal_id is not null
on conflict (pct_producto_id, pct_categoria_id) do nothing;

-- ============ 3. Variantes ============
-- var_precio es Base Imponible (sin IVA), como fija el estándar monetario:
-- el catálogo cotiza "Subtotal $200 + IVA", así que aquí va 200.

insert into comun_comercio.com_variante (
  var_negocio, var_producto_id, var_sku, var_nombre, var_precio,
  var_codigo_impuesto_sri, var_tarifa_iva_porcentaje, var_tipo_oferta,
  var_frecuencia_recurrencia, var_detalle_variante)
select 'tranqi', p.pro_id, v.sku, v.nombre, v.precio,
       'IVA_15', 15.00, v.tipo_oferta, v.frecuencia, v.detalle::jsonb
from (values
  -- Consultas agendables sueltas. La de orientación es la que consume el cupo
  -- del plan; la de especialista es la que se cobra cuando no hay cupo.
  ('consulta-telematica',    'TRQ-CON-ORI', 'Orientación Legal (30 min)',              25.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":30,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual"]}'),
  ('consulta-telematica',    'TRQ-CON-ESP', 'Consulta con Especialista (45 min)',      45.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":45,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual","presencial"]}'),
  ('conciliacion',           'TRQ-CNC-EXT', 'Conciliación Extrajudicial (60 min)',     60.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":60,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual","presencial"],"materia_codigo":"CIVIL"}'),
  ('accidente-transito',     'TRQ-TRA-ACC', 'Asesoría por Accidente de Tránsito',      45.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":45,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual"],"materia_codigo":"TRANSITO"}'),
  -- Trámites del catálogo, con los precios supuestos tal cual están escritos.
  ('notarizacion',           'TRQ-NOT-DOC', 'Notarización y Gestión en Notaría',      200.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":45,"concepto_derecho":"PODER_NOTARIAL","modalidades":["virtual","presencial"]}'),
  ('permiso-salida',         'TRQ-SAL-PAI', 'Trámite Integral de Salida de Menores',  150.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":45,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual"],"materia_codigo":"FAMILIA"}'),
  ('revision-contratos',     'TRQ-REV-CON', 'Análisis de Contrato (hasta 10 págs.)',   80.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":30,"concepto_derecho":"REVISION_CONTRATO","modalidades":["virtual"],"materia_codigo":"ARRENDAMIENTO"}'),
  ('divorcio-mutuo-acuerdo', 'TRQ-DIV-MUT', 'Divorcio por Mutuo Acuerdo',             400.00,  'UNICO', null,
   '{"preliminar":true,"duracion_min":60,"concepto_derecho":"CONSULTA_TELEMATICA","modalidades":["virtual","presencial"],"materia_codigo":"FAMILIA"}'),
  -- Planes. `derechos` es lo que lee com_fn_consumir_derecho: "incluidos": null
  -- significa ilimitado, y es el Plan Plus Familiar.
  ('plan-proteccion',        'TRQ-PLAN-BAS', 'Plan Básico Individual',                 20.00,  'RECURRENTE_MENSUAL', 'MENSUAL',
   '{"preliminar":true,"derechos":[{"concepto":"CONSULTA_TELEMATICA","incluidos":1,"periodo":"MENSUAL"},{"concepto":"REVISION_CONTRATO","incluidos":1,"periodo":"ANUAL"}]}'),
  ('plan-proteccion',        'TRQ-PLAN-MED', 'Plan Medio / Profesionales',             30.00,  'RECURRENTE_MENSUAL', 'MENSUAL',
   '{"preliminar":true,"derechos":[{"concepto":"CONSULTA_TELEMATICA","incluidos":3,"periodo":"MENSUAL"},{"concepto":"REVISION_CONTRATO","incluidos":2,"periodo":"ANUAL"},{"concepto":"PODER_NOTARIAL","incluidos":1,"periodo":"ANUAL"}]}'),
  ('plan-proteccion',        'TRQ-PLAN-PLUS','Plan Plus Familiar',                     50.00,  'RECURRENTE_MENSUAL', 'MENSUAL',
   '{"preliminar":true,"derechos":[{"concepto":"CONSULTA_TELEMATICA","incluidos":null,"periodo":"MENSUAL"},{"concepto":"REVISION_CONTRATO","incluidos":null,"periodo":"MENSUAL"}]}')
) as v(slug, sku, nombre, precio, tipo_oferta, frecuencia, detalle)
join comun_comercio.com_producto p on p.pro_negocio = 'tranqi' and p.pro_slug = v.slug
on conflict (var_negocio, var_sku) do nothing;

-- ============ 4. Cupón de lanzamiento ============
-- "Primera Consulta Gratis" del catálogo §4.B, con vigencia acotada: la
-- caducidad de una promoción se define por campaña, no se deja abierta.

insert into comun_comercio.com_cupon (
  cup_negocio, cup_codigo, cup_descripcion, cup_tipo, cup_valor,
  cup_limite_usos_por_usuario, cup_valido_desde, cup_valido_hasta,
  cup_aplica_a, cup_regla_suscripcion, cup_detalle_cupon)
values (
  'tranqi', 'PRIMERACONSULTA', 'Primera consulta de orientación legal sin costo.',
  'PORCENTAJE', 100.0000, 1, now(), now() + interval '180 days',
  'SOLO_PRODUCTOS', 'SOLO_PRIMER_CICLO',
  '{"preliminar":true,"skus":["TRQ-CON-ORI"]}')
on conflict (cup_negocio, cup_codigo) do nothing;

-- ============ 5. Materias que el catálogo da por existentes ============
-- El seed de 20260728000002 trae 12 especialidades. El catálogo comercial
-- rutea por código, no por nombre: se añade el código a cada materia para que
-- `materia_codigo` de las variantes resuelva sin depender de la tildación ni
-- del texto exacto del nombre.

alter table tranqui_legal.trq_materia
  add column if not exists mat_codigo text;

update tranqui_legal.trq_materia set mat_codigo = c.codigo
from (values
  ('Civil','CIVIL'), ('Penal','PENAL'), ('Laboral','LABORAL'),
  ('Familia y Niñez','FAMILIA'), ('Societario y Corporativo','SOCIETARIO'),
  ('Tributario','TRIBUTARIO'), ('Migratorio','MIGRATORIO'), ('Tránsito','TRANSITO'),
  ('Propiedad Intelectual','PROPIEDAD_INTELECTUAL'), ('Administrativo','ADMINISTRATIVO'),
  ('Constitucional','CONSTITUCIONAL'), ('Arrendamiento e Inquilinato','ARRENDAMIENTO')
) as c(nombre, codigo)
where trq_materia.mat_nombre = c.nombre and trq_materia.mat_codigo is null;

create unique index if not exists idx_trq_materia_codigo on tranqui_legal.trq_materia (mat_codigo)
  where mat_codigo is not null;
