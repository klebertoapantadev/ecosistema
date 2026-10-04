-- ==============================================================================
-- Migración: Banners, Campañas Informativas y Registro de Widgets para Tranqi
-- Esquema: comun_comercio (com_campana_informativa) y comun_seguridad (Widgets y Roles)
-- ==============================================================================

-- 1. Crear tabla comun_comercio.com_campana_informativa si no existe
create table if not exists comun_comercio.com_campana_informativa (
  inf_id uuid primary key default gen_random_uuid(),
  inf_negocio text not null default 'tranqi',
  inf_titulo text not null,
  inf_slug text not null,
  inf_subtitulo text,
  inf_contenido_md text,
  inf_tipo text not null default 'COMUNICADO_GENERAL', 
  -- Tipos: 'BENEFICIO_CONVENIO', 'ALERTA_REGULATORIA', 'NOTICIA_TRIBUTARIA_MUNICIPAL', 'COMUNICADO_GENERAL'
  inf_audiencia text[] not null default array['TODOS'], 
  -- Audiencias: 'TODOS', 'ABOGADOS', 'CLIENTES', 'EMPRESAS'
  inf_ubicaciones text[] not null default array['PANEL_INICIO'], 
  -- Ubicaciones: 'LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO', 'PANEL_BENEFICIOS'
  inf_fecha_inicio timestamptz not null default now(),
  inf_fecha_fin timestamptz,
  inf_activo boolean not null default true,
  inf_prioridad text not null default 'MEDIA', -- 'ALTA', 'MEDIA', 'BAJA'
  inf_detalle jsonb not null default '{}'::jsonb, 
  -- { imagen_url, video_url, cta_texto, cta_url, institucion, porcentaje_descuento, categoria, color_tag, icono, cta_tipo }
  inf_creado_en timestamptz not null default now(),
  inf_actualizado_en timestamptz not null default now()
);

-- 2. Índices de búsqueda y filtrado
create index if not exists idx_com_campana_negocio_activo on comun_comercio.com_campana_informativa (inf_negocio, inf_activo);
create index if not exists idx_com_campana_fechas on comun_comercio.com_campana_informativa (inf_fecha_inicio, inf_fecha_fin);

-- 3. RLS
alter table comun_comercio.com_campana_informativa enable row level security;

drop policy if exists com_campana_informativa_select_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_select_policy on comun_comercio.com_campana_informativa
  for select
  using (
    inf_activo = true
    or exists (
      select 1 from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_rol r on r.rol_id = m.mbr_rol_id
      where m.mbr_usuario_id = auth.uid()
        and m.mbr_activo = true
        and r.rol_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
    )
  );

drop policy if exists com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa;
create policy com_campana_informativa_admin_policy on comun_comercio.com_campana_informativa
  for all
  using (
    exists (
      select 1 from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_rol r on r.rol_id = m.mbr_rol_id
      where m.mbr_usuario_id = auth.uid()
        and m.mbr_activo = true
        and r.rol_clave in ('ADMINISTRADOR', 'SUPERADMIN', 'OPERADOR')
    )
  );

-- 4. Auditoría
drop trigger if exists trg_auditoria_com_campana_informativa on comun_comercio.com_campana_informativa;
create trigger trg_auditoria_com_campana_informativa
  after insert or update or delete on comun_comercio.com_campana_informativa
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 5. Constraint único en slug por negocio para inserciones idempotentes
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

-- 6. Inserción / Actualización de las 6 Noticias y Banners de Actualidad
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

-- ==============================================================================
-- 7. Registro y Pre-configuración de Widgets y Roles en comun_seguridad
-- ==============================================================================

do $$
declare
  neg text;
  w_id uuid;
begin
  for neg in select unnest(array['tranqi', 'fastfix', 'tinkay', 'margaritas']) loop

    -- 1. Widget de Gestión: gestion_informativos
    insert into comun_seguridad.seg_widget (wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
    values (
      'gestion_informativos',
      'Gestión de Informativos & Beneficios',
      true,
      jsonb_build_object(
        'negocio', neg,
        'descripcion', 'Consola de administración de alertas de instituciones, noticias tributarias y convenios de capacitación.',
        'categoria', 'Comercio & Comunicación',
        'ruta', '/panel/administrar?widget=gestion_informativos',
        'panel_defecto', 'panel_administrar',
        'icono', 'Megaphone'
      )
    )
    on conflict (wdg_clave) do update
    set wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = excluded.wdg_detalle_widget
    returning wdg_id into w_id;

    if w_id is null then
      select wdg_id into w_id from comun_seguridad.seg_widget where wdg_clave = 'gestion_informativos';
    end if;

    insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    values
      (neg, 'ADMINISTRADOR', w_id, true),
      (neg, 'SUPERADMIN', w_id, true),
      (neg, 'OPERADOR', w_id, true)
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

    -- 2. Widget de Vista: paquete_beneficios_abogados
    insert into comun_seguridad.seg_widget (wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
    values (
      'paquete_beneficios_abogados',
      'Paquete de Beneficios & Convenios',
      true,
      jsonb_build_object(
        'negocio', neg,
        'descripcion', 'Listado de convenios de capacitación, maestrías, herramientas y beneficios gremiales para la red profesional.',
        'categoria', 'Red Profesional',
        'ruta', '/panel/red-profesional?widget=paquete_beneficios_abogados',
        'panel_defecto', 'panel_red_profesional',
        'icono', 'Award'
      )
    )
    on conflict (wdg_clave) do update
    set wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = excluded.wdg_detalle_widget
    returning wdg_id into w_id;

    if w_id is null then
      select wdg_id into w_id from comun_seguridad.seg_widget where wdg_clave = 'paquete_beneficios_abogados';
    end if;

    insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    values
      (neg, 'ABOGADO', w_id, true),
      (neg, 'ADMINISTRADOR', w_id, true),
      (neg, 'SUPERADMIN', w_id, true),
      (neg, 'OPERADOR', w_id, true)
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

    -- 3. Widget de Vista: muro_informativo_comunidad
    insert into comun_seguridad.seg_widget (wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget)
    values (
      'muro_informativo_comunidad',
      'Avisos & Alertas de la Comunidad',
      true,
      jsonb_build_object(
        'negocio', neg,
        'descripcion', 'Panel informativo con alertas de instituciones públicas, noticias tributarias y oportunidades de ahorro.',
        'categoria', 'Información & Comunidad',
        'ruta', '/panel/clientes?widget=muro_informativo_comunidad',
        'panel_defecto', 'panel_clientes',
        'icono', 'BellRing'
      )
    )
    on conflict (wdg_clave) do update
    set wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = excluded.wdg_detalle_widget
    returning wdg_id into w_id;

    if w_id is null then
      select wdg_id into w_id from comun_seguridad.seg_widget where wdg_clave = 'muro_informativo_comunidad';
    end if;

    insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
    values
      (neg, 'CLIENTE', w_id, true),
      (neg, 'ABOGADO', w_id, true),
      (neg, 'ADMINISTRADOR', w_id, true),
      (neg, 'SUPERADMIN', w_id, true),
      (neg, 'OPERADOR', w_id, true)
    on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set rlw_visible = true;

  end loop;
end $$;
