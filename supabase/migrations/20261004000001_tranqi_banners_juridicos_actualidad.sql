-- ==============================================================================
-- Migración: Banners y Campañas Informativas Jurídicas de Actualidad para Tranqi
-- Esquema: comun_comercio (com_campana_informativa)
-- ==============================================================================

-- Asegurar constraint único en slug por negocio para inserciones idempotentes
do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'uq_com_campana_negocio_slug'
  ) then
    alter table comun_comercio.com_campana_informativa
      add constraint uq_com_campana_negocio_slug unique (inf_negocio, inf_slug);
  end if;
end $$;

-- Inserción / Actualización de las 6 Noticias y Banners de Actualidad
insert into comun_comercio.com_campana_informativa (
  inf_negocio,
  inf_titulo,
  inf_slug,
  inf_subtitulo,
  inf_contenido_md,
  inf_tipo,
  inf_audiencia,
  inf_ubicaciones,
  inf_fecha_inicio,
  inf_fecha_fin,
  inf_activo,
  inf_prioridad,
  inf_detalle
) values
(
  'tranqi',
  'Proyecto de Reforma a la Ley de Inquilinato',
  'reforma-ley-inquilinato-arriendos-garantias',
  'Se debate fijar un plazo mínimo contractual de 2 años y un tope de 2 meses de garantía para arriendos.',
  'La Asamblea Nacional analiza reformas clave para regular cánones de arrendamiento, contratos de vivienda y límites a garantías en el territorio ecuatoriano.',
  'ALERTA_REGULATORIA',
  array['CLIENTES', 'ABOGADOS', 'TODOS'],
  array['LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-01T08:00:00Z',
  '2026-12-31T23:59:59Z',
  true,
  'ALTA',
  jsonb_build_object(
    'categoria', 'Inquilinato',
    'color_tag', '#1E3A8A',
    'icono', 'home-outline',
    'institucion', 'Asamblea Nacional del Ecuador',
    'cta_texto', 'Ver detalles de la reforma',
    'cta_url', 'https://www.asambleanacional.gob.ec/es/proyectos-ley',
    'cta_tipo', 'external',
    'imagen_url', 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1200&q=80'
  )
),
(
  'tranqi',
  'Control de Horas Suplementarias y Jornadas',
  'control-horas-suplementarias-registro-digital',
  'El Ministerio del Trabajo refuerza el registro digital obligatorio de horas suplementarias y descansos.',
  'Normativa de estricto cumplimiento para empleadores y trabajadores sobre liquidación de recargos extraordinarios, pausas activas y control biométrico.',
  'ALERTA_REGULATORIA',
  array['EMPRESAS', 'ABOGADOS', 'CLIENTES', 'TODOS'],
  array['LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-02T09:30:00Z',
  '2026-12-31T23:59:59Z',
  true,
  'ALTA',
  jsonb_build_object(
    'categoria', 'Laboral',
    'color_tag', '#065F46',
    'icono', 'briefcase-outline',
    'institucion', 'Ministerio del Trabajo Ecuador',
    'cta_texto', 'Revisar cálculo legal',
    'cta_url', '/panel/agendar',
    'cta_tipo', 'internal',
    'imagen_url', 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80'
  )
),
(
  'tranqi',
  'Decreto 515: Autogeneración Energética',
  'decreto-515-autogeneracion-energetica-empresas',
  'Nuevas reglas facilitan a empresas la creación de Distritos Autónomos de Energía y autogestión de excedentes.',
  'Marco legal y tarifario para proyectos de autogeneración eléctrica solar, eólica o biomasa en parques industriales y empresas privadas.',
  'NOTICIA_TRIBUTARIA_MUNICIPAL',
  array['EMPRESAS', 'ABOGADOS', 'TODOS'],
  array['LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-02T14:15:00Z',
  '2027-03-31T23:59:59Z',
  true,
  'MEDIA',
  jsonb_build_object(
    'categoria', 'Corporativo',
    'color_tag', '#9A3412',
    'icono', 'flash-outline',
    'institucion', 'Ministerio de Energía y Minas',
    'cta_texto', 'Leer normativa empresarial',
    'cta_url', 'https://www.recursosyenergia.gob.ec/regulaciones',
    'cta_tipo', 'external',
    'imagen_url', 'https://images.unsplash.com/photo-1497435334941-8c899ee9e8e9?auto=format&fit=crop&w=1200&q=80'
  )
),
(
  'tranqi',
  'Cumplimiento de Protección de Datos Personales',
  'cumplimiento-obligatorio-proteccion-datos-lopdp',
  'Todo tratamiento de bases de datos exige consentimiento expreso previo y responsable técnico registrado.',
  'La Superintendencia de Protección de Datos inicia ciclo de auditorías a empresas y profesionales. Asegura tus cláusulas, políticas de privacidad y registros ARCO.',
  'ALERTA_REGULATORIA',
  array['EMPRESAS', 'ABOGADOS', 'CLIENTES', 'TODOS'],
  array['LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-03T11:00:00Z',
  '2026-12-31T23:59:59Z',
  true,
  'ALTA',
  jsonb_build_object(
    'categoria', 'Privacidad',
    'color_tag', '#4C1D95',
    'icono', 'shield-checkmark-outline',
    'institucion', 'Superintendencia de Protección de Datos',
    'cta_texto', 'Auditar cumplimiento',
    'cta_url', '/panel/terminos',
    'cta_tipo', 'internal',
    'imagen_url', 'https://images.unsplash.com/photo-1563986768609-322da13575f3?auto=format&fit=crop&w=1200&q=80'
  )
),
(
  'tranqi',
  'Validez Legal de la Firma Electrónica',
  'validez-legal-firma-electronica-juntas-actas',
  'Actas de junta celebradas telemáticamente con firma digital certificada mantienen pleno valor probatorio.',
  'La Superintendencia de Compañías ratifica la validez de firmas electrónicas avanzadas (.p12 / QR) para reformas de estatutos, cesión de participaciones y aumento de capital.',
  'BENEFICIO_CONVENIO',
  array['EMPRESAS', 'ABOGADOS', 'TODOS'],
  array['LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-03T16:45:00Z',
  '2027-06-30T23:59:59Z',
  true,
  'MEDIA',
  jsonb_build_object(
    'categoria', 'Societario',
    'color_tag', '#1E293B',
    'icono', 'document-text-outline',
    'institucion', 'Superintendencia de Compañías (SUPERCIAS)',
    'cta_texto', 'Ver guía de formalización',
    'cta_url', '/panel/firma-documentos',
    'cta_tipo', 'internal',
    'imagen_url', 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80'
  )
),
(
  'tranqi',
  'Protección Integral a Niñas, Niños y Adolescentes',
  'proteccion-integral-reforma-penal-menores',
  'Aprobada reforma legal que endurece sanciones para la prevención del reclutamiento y explotación de menores.',
  'Publicado en el Registro Oficial el paquete de reformas penales y procesales que agravan delitos contra la infancia y fortalecen medidas de protección inmediata.',
  'ALERTA_REGULATORIA',
  array['CLIENTES', 'ABOGADOS', 'TODOS'],
  array['LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'],
  '2026-10-04T07:00:00Z',
  '2026-12-31T23:59:59Z',
  true,
  'ALTA',
  jsonb_build_object(
    'categoria', 'Niñez y Familia',
    'color_tag', '#831843',
    'icono', 'scale-outline',
    'institucion', 'Registro Oficial del Ecuador',
    'cta_texto', 'Consultar texto aprobado',
    'cta_url', 'https://www.registroficial.gob.ec',
    'cta_tipo', 'external',
    'imagen_url', 'https://images.unsplash.com/photo-1488521787991-ed7bbaae773c?auto=format&fit=crop&w=1200&q=80'
  )
)
on conflict (inf_negocio, inf_slug) do update set
  inf_titulo = excluded.inf_titulo,
  inf_subtitulo = excluded.inf_subtitulo,
  inf_contenido_md = excluded.inf_contenido_md,
  inf_tipo = excluded.inf_tipo,
  inf_audiencia = excluded.inf_audiencia,
  inf_ubicaciones = excluded.inf_ubicaciones,
  inf_fecha_inicio = excluded.inf_fecha_inicio,
  inf_fecha_fin = excluded.inf_fecha_fin,
  inf_activo = excluded.inf_activo,
  inf_prioridad = excluded.inf_prioridad,
  inf_detalle = excluded.inf_detalle,
  inf_actualizado_en = now();
