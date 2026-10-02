-- ==============================================================================
-- Migración: Módulo Unificado de Campañas Informativas, Alertas y Paquete de Beneficios
-- Esquema: comun_comercio (Datos) y comun_seguridad (Widgets y Roles)
-- ==============================================================================

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
  -- { imagen_url, video_url, cta_texto, cta_url, institucion, porcentaje_descuento, etiqueta_temporada }
  inf_creado_en timestamptz not null default now(),
  inf_actualizado_en timestamptz not null default now()
);

-- Índices de búsqueda y filtrado
create index if not exists idx_com_campana_negocio_activo on comun_comercio.com_campana_informativa (inf_negocio, inf_activo);
create index if not exists idx_com_campana_fechas on comun_comercio.com_campana_informativa (inf_fecha_inicio, inf_fecha_fin);

-- RLS
alter table comun_comercio.com_campana_informativa enable row level security;

-- Política de lectura: Público y usuarios autenticados leen si está activo, o si tienen rol administrador
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

-- Política de gestión: Solo administradores / superadmins / operadores del negocio
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

-- Auditoría
drop trigger if exists trg_auditoria_com_campana_informativa on comun_comercio.com_campana_informativa;
create trigger trg_auditoria_com_campana_informativa
  after insert or update or delete on comun_comercio.com_campana_informativa
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ==============================================================================
-- Seeds Iniciales para Tranqi Legal
-- ==============================================================================

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
  'Convenio de Capacitación: Diplomados & Maestrías en Derecho Societario y Procesal',
  'convenio-capacitacion-socios-abogados',
  '25% de beca y descuento exclusivo para Abogados Socios de la Red Tranqi',
  'Accede a programas de especialización y formación jurídica continua con certificación oficial. Válido para todos los profesionales activos en la red.',
  'BENEFICIO_CONVENIO',
  array['ABOGADOS', 'TODOS'],
  array['PANEL_BENEFICIOS', 'PANEL_INICIO'],
  now() - interval '2 days',
  now() + interval '90 days',
  true,
  'ALTA',
  jsonb_build_object(
    'institucion', 'Instituto Superior de Postgrados Jurídicos',
    'porcentaje_descuento', '25% Beca',
    'imagen_url', 'https://images.unsplash.com/photo-1524178232363-1fb2b075b655?auto=format&fit=crop&w=1200&q=80',
    'cta_texto', 'Postular a Beca de Capacitación',
    'cta_url', 'https://wa.me/593999999999?text=Deseo%20informacion%20del%20convenio%20de%20capacitacion%20Tranqi'
  )
),
(
  'tranqi',
  'Alerta ANT: Suspensión Temporal en Sistema de Matriculación y Turnos Vehiculares',
  'alerta-ant-suspension-sistema-matriculacion',
  'Mantenimiento preventivo en la plataforma de la Agencia Nacional de Tránsito',
  'Informamos a nuestros clientes y socios que la ANT suspenderá temporalmente sus trámites telemáticos de bloqueo vehicular y validación de poderes durante el fin de semana programado.',
  'ALERTA_REGULATORIA',
  array['CLIENTES', 'EMPRESAS', 'ABOGADOS', 'TODOS'],
  array['LANDING_BANNER', 'LANDING_GRID', 'PANEL_INICIO'],
  now() - interval '1 day',
  now() + interval '15 days',
  true,
  'ALTA',
  jsonb_build_object(
    'institucion', 'Agencia Nacional de Tránsito (ANT)',
    'imagen_url', 'https://images.unsplash.com/photo-1549399542-7e3f8b79c341?auto=format&fit=crop&w=1200&q=80',
    'cta_texto', 'Ver Comunicado Oficial',
    'cta_url', 'https://www.ant.gob.ec'
  )
),
(
  'tranqi',
  'Oportunidad Tributaria: Descuento del 10% en Patente Municipal de Quito en Noviembre',
  'descuento-patente-municipal-quito-noviembre',
  'Ahorro por pronto pago en obligaciones y patentes comerciales del Distrito Metropolitano',
  'Las personas naturales obligadas y empresas con actividad comercial en Quito pueden acogerse al incentivo de pronto pago en la patente municipal 2026. Te asesoramos en la liquidación exacta.',
  'NOTICIA_TRIBUTARIA_MUNICIPAL',
  array['CLIENTES', 'EMPRESAS', 'TODOS'],
  array['LANDING_GRID', 'PANEL_INICIO'],
  now(),
  now() + interval '60 days',
  true,
  'MEDIA',
  jsonb_build_object(
    'institucion', 'Municipio del Distrito Metropolitano de Quito',
    'porcentaje_descuento', '10% Descuento',
    'imagen_url', 'https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?auto=format&fit=crop&w=1200&q=80',
    'cta_texto', 'Solicitar Liquidación Asistida',
    'cta_url', '/panel/agendar'
  )
),
(
  'tranqi',
  'Convenio Firma Electrónica .p12 y Bóveda Segura para Abogados',
  'convenio-firma-electronica-abogados',
  'Emisión express de firma digital para patrocinio y casilleros judiciales',
  'Obtén tu firma digital jurídica en menos de 15 minutos con soporte prioritario e integración directa en Tranqi.',
  'BENEFICIO_CONVENIO',
  array['ABOGADOS'],
  array['PANEL_BENEFICIOS', 'PANEL_INICIO'],
  now() - interval '5 days',
  now() + interval '180 days',
  true,
  'MEDIA',
  jsonb_build_object(
    'institucion', 'BCEC & Security Data Ecuador',
    'porcentaje_descuento', 'Tarifa Reducida $18.50',
    'imagen_url', 'https://images.unsplash.com/photo-1450133064473-71024230f91b?auto=format&fit=crop&w=1200&q=80',
    'cta_texto', 'Obtener Firma .p12',
    'cta_url', '/panel/firma-documentos'
  )
)
on conflict do nothing;

-- ==============================================================================
-- Registro de Widgets de Gobernanza en comun_seguridad
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
