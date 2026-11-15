-- =============================================================================
-- Migración: 20261115000007_omnicanal_chats_etiquetas_respuestas_y_ventas.sql
-- Requerimiento: PLT-010 (Reemplazo Integral de ManyChat — Fase 1 Web + Base Omnicanal)
-- Descripción:
--   1. Esquema comun_agentes y tablas canónicas con RLS y aud_fn_auditar_tabla():
--      - agc_conversacion (hilos Web, WhatsApp YCloud, Instagram, Facebook, TikTok)
--      - agc_mensaje (mensajes Cliente, IA ARIA, Intervención Humana, Nota Interna, Sistema)
--      - agc_etiqueta (etiquetas personalizables estilo ManyChat por negocio)
--      - agc_conversacion_etiqueta y comun_comercio.com_cliente_etiqueta (tablas N:M explícitas)
--      - agc_respuesta_rapida (mensajes predeterminados / snippets con /atajo)
--      - agc_flujo_automatizacion (base de flujos para Fase 2 YCloud / Meta / TikTok)
--   2. Función de autorización multi-vendedor comun_seguridad.seg_fn_es_equipo_ventas_negocio
--   3. RPCs transaccionales SECURITY DEFINER en comun_comercio (expuesto en PostgREST)
--      para chat web en vivo, intervención humana HITL, etiquetas, respuestas rápidas y
--      vista 360° de usuarios registrados + compras web (registrados e invitados).
--   4. Registro y pre-configuración por defecto del widget `consola_chat` (Regla 15).
-- =============================================================================

create schema if not exists comun_agentes;

grant usage on schema comun_agentes to anon, authenticated, service_role;

-- 1. Función de autorización para Equipo Comercial (Ventas, Operadores, Administradores, SuperAdmin)
create or replace function comun_seguridad.seg_fn_es_equipo_ventas_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid()
      and (
        u.usu_superadmin_plataforma
        or (
          lower(trim(coalesce(p_negocio, ''))) in ('tinkay', 'tnk')
          and lower(trim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com'
        )
      )
  )
  or exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = auth.uid()
      and m.mem_estado = 'ACTIVO'
      and (
        upper(m.mem_negocio) = upper(p_negocio)
        or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
        or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and (
        upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'AUXILIAR', 'TECNICO', 'ABOGADO', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'AUXILIAR', 'TECNICO', 'ABOGADO', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
      )
  );
$$;

grant execute on function comun_seguridad.seg_fn_es_equipo_ventas_negocio(text) to authenticated, service_role;

-- 2. Tabla comun_agentes.agc_conversacion
create table if not exists comun_agentes.agc_conversacion (
  cnv_id uuid primary key default gen_random_uuid(),
  cnv_secuencial bigint generated always as identity,
  cnv_negocio text not null check (cnv_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cnv_canal text not null default 'web' check (cnv_canal in ('web', 'whatsapp', 'instagram', 'facebook', 'tiktok', 'telegram')),
  cnv_clave_hilo text not null,
  cnv_remitente_id text not null,
  cnv_remitente_nombre text not null default 'Visitante Web',
  cnv_remitente_correo text,
  cnv_remitente_telefono text,
  cnv_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cnv_cliente_id uuid references comun_comercio.com_cliente(cli_id) on delete set null,
  cnv_estado_atencion text not null default 'BOT_ACTIVO'
    check (cnv_estado_atencion in ('BOT_ACTIVO', 'ESCALADO_HUMANO', 'EN_ATENCION_ASESORA', 'EN_ESPERA_CLIENTE', 'CERRADO')),
  cnv_asesora_asignada_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cnv_atribuido_por text not null default 'AUTOMATICO'
    check (cnv_atribuido_por in ('AUTOMATICO', 'ENLACE_REF', 'ROTATIVO', 'MANUAL')),
  cnv_ultimo_mensaje_texto text,
  cnv_ultimo_mensaje_origen text default 'CLIENTE',
  cnv_ultimo_mensaje_en timestamptz not null default now(),
  cnv_no_leidos_asesora integer not null default 0,
  cnv_no_leidos_cliente integer not null default 0,
  cnv_mensajes_cliente_conteo integer not null default 0,
  cnv_mensajes_ia_conteo integer not null default 0,
  cnv_mensajes_humano_conteo integer not null default 0,
  cnv_motivo_escalamiento text,
  cnv_recordatorio_en timestamptz,
  cnv_recordatorio_nota text,
  cnv_ventana_24h_expira_en timestamptz,
  cnv_detalle_conversacion jsonb not null default '{}'::jsonb,
  cnv_creado_en timestamptz not null default now(),
  cnv_actualizado_en timestamptz not null default now(),
  cnv_eliminado_en timestamptz
);

create unique index if not exists idx_agc_conversacion_negocio_canal_hilo_unico
  on comun_agentes.agc_conversacion (cnv_negocio, cnv_canal, cnv_clave_hilo)
  where cnv_eliminado_en is null;

create index if not exists idx_agc_conversacion_bandeja
  on comun_agentes.agc_conversacion (cnv_negocio, cnv_estado_atencion, cnv_ultimo_mensaje_en desc)
  where cnv_eliminado_en is null;

create index if not exists idx_agc_conversacion_asesora
  on comun_agentes.agc_conversacion (cnv_negocio, cnv_asesora_asignada_id, cnv_ultimo_mensaje_en desc)
  where cnv_eliminado_en is null;

alter table comun_agentes.agc_conversacion enable row level security;

drop policy if exists agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_lectura_equipo on comun_agentes.agc_conversacion
  for select using (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
    or (auth.uid() is not null and cnv_usuario_id = auth.uid())
  );

drop policy if exists agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion;
create policy agc_conversacion_gestion_equipo on comun_agentes.agc_conversacion
  for all using (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
  ) with check (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(cnv_negocio)
  );

drop trigger if exists trg_auditoria_agc_conversacion on comun_agentes.agc_conversacion;
create trigger trg_auditoria_agc_conversacion
  after insert or update or delete on comun_agentes.agc_conversacion
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_conversacion to authenticated;
grant all on comun_agentes.agc_conversacion to service_role;

-- 3. Tabla comun_agentes.agc_mensaje
create table if not exists comun_agentes.agc_mensaje (
  msg_id uuid primary key default gen_random_uuid(),
  msg_secuencial bigint generated always as identity,
  msg_negocio text not null,
  msg_conversacion_id uuid not null references comun_agentes.agc_conversacion(cnv_id) on delete cascade,
  msg_origen text not null check (msg_origen in ('CLIENTE', 'BOT_ARIA', 'ASESORA_HUMANA', 'NOTA_INTERNA', 'SISTEMA')),
  msg_autor_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  msg_autor_nombre text,
  msg_contenido text not null,
  msg_tipo_contenido text not null default 'TEXTO'
    check (msg_tipo_contenido in ('TEXTO', 'IMAGEN', 'UBICACION', 'AUDIO', 'PLANTILLA', 'DOCUMENTO', 'ORDEN_WEB')),
  msg_id_externo text,
  msg_estado_entrega text not null default 'ENVIADO'
    check (msg_estado_entrega in ('ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO')),
  msg_detalle_mensaje jsonb not null default '{}'::jsonb,
  msg_creado_en timestamptz not null default now(),
  msg_actualizado_en timestamptz not null default now(),
  msg_eliminado_en timestamptz
);

create index if not exists idx_agc_mensaje_hilo
  on comun_agentes.agc_mensaje (msg_conversacion_id, msg_creado_en asc)
  where msg_eliminado_en is null;

alter table comun_agentes.agc_mensaje enable row level security;

drop policy if exists agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_lectura_equipo on comun_agentes.agc_mensaje
  for select using (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(msg_negocio)
    or (
      msg_origen <> 'NOTA_INTERNA'
      and exists (
        select 1 from comun_agentes.agc_conversacion c
        where c.cnv_id = msg_conversacion_id
          and auth.uid() is not null
          and c.cnv_usuario_id = auth.uid()
      )
    )
  );

drop policy if exists agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje;
create policy agc_mensaje_gestion_equipo on comun_agentes.agc_mensaje
  for all using (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(msg_negocio)
  ) with check (
    comun_seguridad.seg_fn_es_equipo_ventas_negocio(msg_negocio)
  );

drop trigger if exists trg_auditoria_agc_mensaje on comun_agentes.agc_mensaje;
create trigger trg_auditoria_agc_mensaje
  after insert or update or delete on comun_agentes.agc_mensaje
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_mensaje to authenticated;
grant all on comun_agentes.agc_mensaje to service_role;

-- 4. Tabla comun_agentes.agc_etiqueta (Etiquetas personalizables estilo ManyChat)
create table if not exists comun_agentes.agc_etiqueta (
  etq_id uuid primary key default gen_random_uuid(),
  etq_secuencial bigint generated always as identity,
  etq_negocio text not null,
  etq_slug text not null,
  etq_nombre text not null,
  etq_color text not null default '#2563EB',
  etq_icono text not null default '🏷️',
  etq_descripcion text,
  etq_orden integer not null default 0,
  etq_activo boolean not null default true,
  etq_detalle_etiqueta jsonb not null default '{}'::jsonb,
  etq_creado_en timestamptz not null default now(),
  etq_actualizado_en timestamptz not null default now(),
  etq_eliminado_en timestamptz
);

create unique index if not exists idx_agc_etiqueta_negocio_slug_unico
  on comun_agentes.agc_etiqueta (etq_negocio, etq_slug)
  where etq_eliminado_en is null;

alter table comun_agentes.agc_etiqueta enable row level security;

drop policy if exists agc_etiqueta_lectura_equipo on comun_agentes.agc_etiqueta;
create policy agc_etiqueta_lectura_equipo on comun_agentes.agc_etiqueta
  for select using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(etq_negocio));

drop policy if exists agc_etiqueta_gestion_equipo on comun_agentes.agc_etiqueta;
create policy agc_etiqueta_gestion_equipo on comun_agentes.agc_etiqueta
  for all using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(etq_negocio))
  with check (comun_seguridad.seg_fn_es_equipo_ventas_negocio(etq_negocio));

drop trigger if exists trg_auditoria_agc_etiqueta on comun_agentes.agc_etiqueta;
create trigger trg_auditoria_agc_etiqueta
  after insert or update or delete on comun_agentes.agc_etiqueta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_etiqueta to authenticated;
grant all on comun_agentes.agc_etiqueta to service_role;

-- 5. Tablas de unión N:M para etiquetas en conversaciones y en clientes
create table if not exists comun_agentes.agc_conversacion_etiqueta (
  cet_id uuid primary key default gen_random_uuid(),
  cet_secuencial bigint generated always as identity,
  cet_negocio text not null,
  cet_conversacion_id uuid not null references comun_agentes.agc_conversacion(cnv_id) on delete cascade,
  cet_etiqueta_id uuid not null references comun_agentes.agc_etiqueta(etq_id) on delete cascade,
  cet_asignado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cet_detalle_asignacion jsonb not null default '{}'::jsonb,
  cet_creado_en timestamptz not null default now(),
  cet_actualizado_en timestamptz not null default now(),
  cet_eliminado_en timestamptz,
  unique (cet_conversacion_id, cet_etiqueta_id)
);

alter table comun_agentes.agc_conversacion_etiqueta enable row level security;

drop policy if exists agc_conversacion_etiqueta_equipo on comun_agentes.agc_conversacion_etiqueta;
create policy agc_conversacion_etiqueta_equipo on comun_agentes.agc_conversacion_etiqueta
  for all using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cet_negocio))
  with check (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cet_negocio));

drop trigger if exists trg_auditoria_agc_conversacion_etiqueta on comun_agentes.agc_conversacion_etiqueta;
create trigger trg_auditoria_agc_conversacion_etiqueta
  after insert or update or delete on comun_agentes.agc_conversacion_etiqueta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_conversacion_etiqueta to authenticated;
grant all on comun_agentes.agc_conversacion_etiqueta to service_role;

create table if not exists comun_comercio.com_cliente_etiqueta (
  cle_id uuid primary key default gen_random_uuid(),
  cle_secuencial bigint generated always as identity,
  cle_negocio text not null,
  cle_cliente_id uuid not null references comun_comercio.com_cliente(cli_id) on delete cascade,
  cle_etiqueta_id uuid not null references comun_agentes.agc_etiqueta(etq_id) on delete cascade,
  cle_asignado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  cle_detalle_asignacion jsonb not null default '{}'::jsonb,
  cle_creado_en timestamptz not null default now(),
  cle_actualizado_en timestamptz not null default now(),
  cle_eliminado_en timestamptz,
  unique (cle_cliente_id, cle_etiqueta_id)
);

alter table comun_comercio.com_cliente_etiqueta enable row level security;

drop policy if exists com_cliente_etiqueta_equipo on comun_comercio.com_cliente_etiqueta;
create policy com_cliente_etiqueta_equipo on comun_comercio.com_cliente_etiqueta
  for all using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cle_negocio))
  with check (comun_seguridad.seg_fn_es_equipo_ventas_negocio(cle_negocio));

drop trigger if exists trg_auditoria_com_cliente_etiqueta on comun_comercio.com_cliente_etiqueta;
create trigger trg_auditoria_com_cliente_etiqueta
  after insert or update or delete on comun_comercio.com_cliente_etiqueta
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_cliente_etiqueta to authenticated;
grant all on comun_comercio.com_cliente_etiqueta to service_role;

-- 6. Tabla comun_agentes.agc_respuesta_rapida (Mensajes Predeterminados / Snippets)
create table if not exists comun_agentes.agc_respuesta_rapida (
  rrp_id uuid primary key default gen_random_uuid(),
  rrp_secuencial bigint generated always as identity,
  rrp_negocio text not null,
  rrp_atajo text not null,
  rrp_titulo text not null,
  rrp_categoria text not null default 'Ventas',
  rrp_contenido text not null,
  rrp_uso_conteo integer not null default 0,
  rrp_activo boolean not null default true,
  rrp_detalle_respuesta jsonb not null default '{}'::jsonb,
  rrp_creado_en timestamptz not null default now(),
  rrp_actualizado_en timestamptz not null default now(),
  rrp_eliminado_en timestamptz
);

create unique index if not exists idx_agc_respuesta_rapida_atajo_unico
  on comun_agentes.agc_respuesta_rapida (rrp_negocio, rrp_atajo)
  where rrp_eliminado_en is null;

alter table comun_agentes.agc_respuesta_rapida enable row level security;

drop policy if exists agc_respuesta_rapida_equipo on comun_agentes.agc_respuesta_rapida;
create policy agc_respuesta_rapida_equipo on comun_agentes.agc_respuesta_rapida
  for all using (comun_seguridad.seg_fn_es_equipo_ventas_negocio(rrp_negocio))
  with check (comun_seguridad.seg_fn_es_equipo_ventas_negocio(rrp_negocio));

drop trigger if exists trg_auditoria_agc_respuesta_rapida on comun_agentes.agc_respuesta_rapida;
create trigger trg_auditoria_agc_respuesta_rapida
  after insert or update or delete on comun_agentes.agc_respuesta_rapida
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_respuesta_rapida to authenticated;
grant all on comun_agentes.agc_respuesta_rapida to service_role;

-- 7. Tabla comun_agentes.agc_flujo_automatizacion (Base Motor de Flujos Fase 2 YCloud / Meta / TikTok)
create table if not exists comun_agentes.agc_flujo_automatizacion (
  flj_id uuid primary key default gen_random_uuid(),
  flj_secuencial bigint generated always as identity,
  flj_negocio text not null,
  flj_nombre text not null,
  flj_disparador text not null default 'PALABRA_CLAVE'
    check (flj_disparador in ('PALABRA_CLAVE', 'COMENTARIO_SOCIAL', 'PRIMER_MENSAJE', 'COMPRA_WEB', 'ETIQUETA_APLICADA', 'VENTANA_24H')),
  flj_canal_objetivo text not null default 'todos'
    check (flj_canal_objetivo in ('todos', 'web', 'whatsapp', 'instagram', 'facebook', 'tiktok')),
  flj_activo boolean not null default false,
  flj_ejecuciones_conteo integer not null default 0,
  flj_detalle_flujo jsonb not null default '{}'::jsonb,
  flj_creado_en timestamptz not null default now(),
  flj_actualizado_en timestamptz not null default now(),
  flj_eliminado_en timestamptz
);

alter table comun_agentes.agc_flujo_automatizacion enable row level security;

drop policy if exists agc_flujo_automatizacion_equipo on comun_agentes.agc_flujo_automatizacion;
create policy agc_flujo_automatizacion_equipo on comun_agentes.agc_flujo_automatizacion
  for all using (comun_seguridad.seg_fn_es_admin_negocio(flj_negocio))
  with check (comun_seguridad.seg_fn_es_admin_negocio(flj_negocio));

drop trigger if exists trg_auditoria_agc_flujo_automatizacion on comun_agentes.agc_flujo_automatizacion;
create trigger trg_auditoria_agc_flujo_automatizacion
  after insert or update or delete on comun_agentes.agc_flujo_automatizacion
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_agentes.agc_flujo_automatizacion to authenticated;
grant all on comun_agentes.agc_flujo_automatizacion to service_role;

-- Publicar tablas de chat en Supabase Realtime de manera idempotente
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'comun_agentes' and tablename = 'agc_conversacion'
    ) then
      execute 'alter publication supabase_realtime add table comun_agentes.agc_conversacion';
    end if;
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'comun_agentes' and tablename = 'agc_mensaje'
    ) then
      execute 'alter publication supabase_realtime add table comun_agentes.agc_mensaje';
    end if;
  end if;
exception when others then
  null;
end $$;

-- 8. Semilla idempotente de Etiquetas (paridad exacta ManyChat) y Mensajes Predeterminados por negocio
do $$
declare
  v_neg text;
begin
  for v_neg in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
    insert into comun_agentes.agc_etiqueta (etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden)
    values
      (v_neg, 'seguimiento', 'Seguimiento', '#DB2777', '📢', 1),
      (v_neg, 'pagado', 'Pagado', '#16A34A', '💸', 2),
      (v_neg, 'hoy', 'Hoy', '#EA580C', '🟧', 3),
      (v_neg, 'evento', 'Evento', '#2563EB', '🔵', 4),
      (v_neg, 'sur', 'SUR', '#D97706', '🚚', 5),
      (v_neg, 'condolencias', 'Condolencias', '#64748B', '🕊️', 6),
      (v_neg, 'vip', 'Cliente VIP', '#7C3AED', '⭐', 7),
      (v_neg, 'origen-web', 'Chat Web', '#0D9488', '🌐', 8)
    on conflict (etq_negocio, etq_slug) where etq_eliminado_en is null do nothing;

    insert into comun_agentes.agc_respuesta_rapida (rrp_negocio, rrp_atajo, rrp_titulo, rrp_categoria, rrp_contenido)
    values
      (v_neg, '/saludo', 'Saludo de Asesor Humano', 'Bienvenida', '¡Hola {{nombre}}! Te saluda {{asesor}} del equipo de ventas. Tomo tu conversación personalmente para ayudarte con cada detalle. ¿Cómo te gustaría personalizar tu pedido?'),
      (v_neg, '/transferencia', 'Datos de Pago y Transferencia', 'Pagos', 'Puedes completar tu pedido directamente en línea con tarjeta de crédito/débito o mediante transferencia bancaria / Deuna. En cuanto nos envíes el comprobante pasamos tu orden a preparación inmediata.'),
      (v_neg, '/ubicacion', 'Solicitar Pin GPS de Entrega', 'Logística', 'Por favor compártenos el enlace de ubicación exacta de Google Maps o Waze de quien recibe, junto con su nombre y teléfono celular para programar la ruta de entrega.'),
      (v_neg, '/confirmado', 'Confirmación de Pago y Pase a Taller', 'Postventa', '¡Muchas gracias {{nombre}}! Hemos verificado tu pago correctamente. Tu pedido ya ingresó a preparación y te avisaremos en cuanto salga a ruta de entrega.'),
      (v_neg, '/seguimiento', 'Seguimiento de Cotización / Carrito', 'Cierre', 'Hola {{nombre}}, quedamos atentos por si tienes alguna duda sobre las opciones que revisamos. Si deseas confirmar para hoy todavía contamos con disponibilidad de entrega.')
    on conflict (rrp_negocio, rrp_atajo) where rrp_eliminado_en is null do nothing;
  end loop;
end $$;

-- =============================================================================
-- 9. RPCs TRANSACCIONALES EN comun_comercio (EXPUESTO EN POSTGREST)
-- =============================================================================

-- 9.A Registrar interacción desde el Chat Web (Visitante o Usuario Registrado) + estado HITL
create or replace function comun_comercio.com_fn_omnicanal_registrar_interaccion_web(
  p_negocio text,
  p_clave_hilo text,
  p_fase text, -- 'ENTRADA_CLIENTE' | 'RESPUESTA_ARIA' | 'EVENTO_ORDEN'
  p_contenido text,
  p_metadatos jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_hilo text := left(btrim(coalesce(p_clave_hilo, '')), 96);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_usu_correo text;
  v_usu_tel text;
  v_cli_id uuid;
  v_cnv record;
  v_asesora_nombre text;
  v_escalar boolean := false;
  v_nuevo_estado text;
  v_msg_id uuid;
begin
  if v_hilo = '' then
    return jsonb_build_object('ok', false, 'error', 'Identificador de conversación requerido');
  end if;

  if v_uid is not null then
    select
      btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')),
      lower(btrim(coalesce(u.usu_correo, ''))),
      btrim(coalesce(nullif(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', ''), u.usu_whatsapp, ''))
    into v_usu_nombre, v_usu_correo, v_usu_tel
    from comun_seguridad.seg_usuario u
    where u.usu_id = v_uid;

    select c.cli_id into v_cli_id
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and (c.cli_usuario_id = v_uid or (v_usu_correo <> '' and lower(c.cli_correo) = v_usu_correo))
      and c.cli_eliminado_en is null
    order by c.cli_actualizado_en desc
    limit 1;
  end if;

  -- Buscar también por metadatos de comprador (correo o teléfono) si vienen en chat u orden web
  if v_cli_id is null and coalesce(p_metadatos->>'correo', '') <> '' then
    select c.cli_id into v_cli_id
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and lower(c.cli_correo) = lower(btrim(p_metadatos->>'correo'))
      and c.cli_eliminado_en is null
    order by c.cli_actualizado_en desc
    limit 1;
  end if;

  if v_cli_id is null and length(regexp_replace(coalesce(p_metadatos->>'telefono', ''), '\D', '', 'g')) >= 9 then
    select c.cli_id into v_cli_id
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and right(regexp_replace(coalesce(c.cli_telefono, ''), '\D', '', 'g'), 9)
          = right(regexp_replace(coalesce(p_metadatos->>'telefono', ''), '\D', '', 'g'), 9)
      and c.cli_eliminado_en is null
    order by c.cli_actualizado_en desc
    limit 1;
  end if;

  insert into comun_agentes.agc_conversacion (
    cnv_negocio,
    cnv_canal,
    cnv_clave_hilo,
    cnv_remitente_id,
    cnv_remitente_nombre,
    cnv_remitente_correo,
    cnv_remitente_telefono,
    cnv_usuario_id,
    cnv_cliente_id,
    cnv_estado_atencion,
    cnv_ultimo_mensaje_texto,
    cnv_ultimo_mensaje_origen,
    cnv_ultimo_mensaje_en,
    cnv_ventana_24h_expira_en,
    cnv_detalle_conversacion
  )
  values (
    v_negocio,
    'web',
    v_hilo,
    coalesce(v_uid::text, v_hilo),
    coalesce(
      nullif(v_usu_nombre, ''),
      nullif(btrim(coalesce(p_metadatos->>'nombre_cliente', p_metadatos->>'nombre', '')), ''),
      'Visitante Web #' || upper(right(replace(v_hilo, '-', ''), 4))
    ),
    coalesce(nullif(v_usu_correo, ''), nullif(lower(btrim(p_metadatos->>'correo')), '')),
    coalesce(nullif(v_usu_tel, ''), nullif(btrim(p_metadatos->>'telefono'), '')),
    v_uid,
    v_cli_id,
    'BOT_ACTIVO',
    left(coalesce(p_contenido, ''), 280),
    case
      when p_fase = 'RESPUESTA_ARIA' then 'BOT_ARIA'
      when p_fase = 'EVENTO_ORDEN' then 'SISTEMA'
      else 'CLIENTE'
    end,
    now(),
    now() + interval '24 hours',
    jsonb_build_object(
      'origen_utm', coalesce(p_metadatos->>'origen_utm', 'web_directo'),
      'pagina_origen', coalesce(p_metadatos->>'pagina_origen', '/')
    )
  )
  on conflict (cnv_negocio, cnv_canal, cnv_clave_hilo) where cnv_eliminado_en is null
  do update set
    cnv_usuario_id = coalesce(comun_agentes.agc_conversacion.cnv_usuario_id, excluded.cnv_usuario_id),
    cnv_cliente_id = coalesce(comun_agentes.agc_conversacion.cnv_cliente_id, excluded.cnv_cliente_id),
    cnv_remitente_nombre = case
      when comun_agentes.agc_conversacion.cnv_remitente_nombre like 'Visitante Web%'
           and excluded.cnv_remitente_nombre not like 'Visitante Web%'
      then excluded.cnv_remitente_nombre
      else comun_agentes.agc_conversacion.cnv_remitente_nombre
    end,
    cnv_remitente_correo = coalesce(excluded.cnv_remitente_correo, comun_agentes.agc_conversacion.cnv_remitente_correo),
    cnv_remitente_telefono = coalesce(excluded.cnv_remitente_telefono, comun_agentes.agc_conversacion.cnv_remitente_telefono),
    cnv_actualizado_en = now()
  returning * into v_cnv;

  if p_fase = 'ENTRADA_CLIENTE' then
    -- Detectar solicitud explícita de asesor humano
    v_escalar := (
      lower(p_contenido) ~ '(hablar con (un |una )?(asesor|humano|persona|vendedor|alguien)|pasame con|atencion humana|reclamo|queja)'
    );

    v_nuevo_estado := case
      when v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA' then 'EN_ATENCION_ASESORA'
      when v_escalar then 'ESCALADO_HUMANO'
      when v_cnv.cnv_estado_atencion = 'CERRADO' then 'BOT_ACTIVO'
      else v_cnv.cnv_estado_atencion
    end;

    insert into comun_agentes.agc_mensaje (
      msg_negocio,
      msg_conversacion_id,
      msg_origen,
      msg_autor_usuario_id,
      msg_autor_nombre,
      msg_contenido,
      msg_tipo_contenido,
      msg_detalle_mensaje
    )
    values (
      v_negocio,
      v_cnv.cnv_id,
      'CLIENTE',
      v_uid,
      v_cnv.cnv_remitente_nombre,
      p_contenido,
      coalesce(nullif(p_metadatos->>'tipo_contenido', ''), 'TEXTO'),
      coalesce(p_metadatos, '{}'::jsonb)
    )
    returning msg_id into v_msg_id;

    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = v_nuevo_estado,
           cnv_motivo_escalamiento = case
             when v_escalar then 'Solicitud directa de atención humana en el chat'
             else cnv_motivo_escalamiento
           end,
           cnv_ultimo_mensaje_texto = left(p_contenido, 280),
           cnv_ultimo_mensaje_origen = 'CLIENTE',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = cnv_no_leidos_asesora + 1,
           cnv_mensajes_cliente_conteo = cnv_mensajes_cliente_conteo + 1,
           cnv_ventana_24h_expira_en = now() + interval '24 hours',
           cnv_actualizado_en = now()
     where cnv_id = v_cnv.cnv_id
     returning * into v_cnv;

  elsif p_fase = 'RESPUESTA_ARIA' then
    insert into comun_agentes.agc_mensaje (
      msg_negocio,
      msg_conversacion_id,
      msg_origen,
      msg_autor_nombre,
      msg_contenido,
      msg_tipo_contenido,
      msg_detalle_mensaje
    )
    values (
      v_negocio,
      v_cnv.cnv_id,
      'BOT_ARIA',
      coalesce(nullif(p_metadatos->>'nombre_agente', ''), 'ARIA IA'),
      p_contenido,
      'TEXTO',
      coalesce(p_metadatos, '{}'::jsonb)
    )
    returning msg_id into v_msg_id;

    update comun_agentes.agc_conversacion
       set cnv_ultimo_mensaje_texto = left(p_contenido, 280),
           cnv_ultimo_mensaje_origen = 'BOT_ARIA',
           cnv_ultimo_mensaje_en = now(),
           cnv_mensajes_ia_conteo = cnv_mensajes_ia_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = v_cnv.cnv_id
     returning * into v_cnv;

  elsif p_fase = 'EVENTO_ORDEN' then
    insert into comun_agentes.agc_mensaje (
      msg_negocio,
      msg_conversacion_id,
      msg_origen,
      msg_autor_nombre,
      msg_contenido,
      msg_tipo_contenido,
      msg_detalle_mensaje
    )
    values (
      v_negocio,
      v_cnv.cnv_id,
      'SISTEMA',
      'E-Commerce Web',
      p_contenido,
      'ORDEN_WEB',
      coalesce(p_metadatos, '{}'::jsonb)
    )
    returning msg_id into v_msg_id;

    update comun_agentes.agc_conversacion
       set cnv_ultimo_mensaje_texto = left(p_contenido, 280),
           cnv_ultimo_mensaje_origen = 'SISTEMA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = cnv_no_leidos_asesora + 1,
           cnv_actualizado_en = now()
     where cnv_id = v_cnv.cnv_id
     returning * into v_cnv;
  end if;

  if v_cnv.cnv_asesora_asignada_id is not null then
    select btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, ''))
      into v_asesora_nombre
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_cnv.cnv_asesora_asignada_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'conversacion_id', v_cnv.cnv_id,
    'mensaje_id', v_msg_id,
    'estado_atencion', v_cnv.cnv_estado_atencion,
    'asesora_nombre', nullif(v_asesora_nombre, ''),
    'silenciar_aria', (v_cnv.cnv_estado_atencion = 'EN_ATENCION_ASESORA')
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_registrar_interaccion_web(text, text, text, text, jsonb) from public;
grant execute on function comun_comercio.com_fn_omnicanal_registrar_interaccion_web(text, text, text, text, jsonb) to anon, authenticated, service_role;

-- 9.B Sincronizar mensajes públicos del hilo Web para que el visitante reciba en vivo las respuestas del Vendedor Humano
create or replace function comun_comercio.com_fn_omnicanal_sincronizar_hilo_publico(
  p_negocio text,
  p_clave_hilo text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_cnv record;
  v_asesora_nombre text;
  v_mensajes jsonb;
begin
  select * into v_cnv
  from comun_agentes.agc_conversacion c
  where c.cnv_negocio = v_negocio
    and c.cnv_canal = 'web'
    and c.cnv_clave_hilo = btrim(coalesce(p_clave_hilo, ''))
    and c.cnv_eliminado_en is null
  limit 1;

  if v_cnv is null then
    return jsonb_build_object(
      'ok', true,
      'existe', false,
      'estado_atencion', 'BOT_ACTIVO',
      'mensajes_humanos', '[]'::jsonb
    );
  end if;

  if v_cnv.cnv_asesora_asignada_id is not null then
    select btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, ''))
      into v_asesora_nombre
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_cnv.cnv_asesora_asignada_id;
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.msg_id,
      'origen', m.msg_origen,
      'autorNombre', coalesce(m.msg_autor_nombre, nullif(v_asesora_nombre, ''), 'Asesor Comercial'),
      'contenido', m.msg_contenido,
      'creadoEn', m.msg_creado_en
    ) order by m.msg_creado_en asc
  ), '[]'::jsonb)
  into v_mensajes
  from comun_agentes.agc_mensaje m
  where m.msg_conversacion_id = v_cnv.cnv_id
    and m.msg_eliminado_en is null
    and m.msg_origen = 'ASESORA_HUMANA';

  if v_cnv.cnv_no_leidos_cliente > 0 then
    update comun_agentes.agc_conversacion
       set cnv_no_leidos_cliente = 0
     where cnv_id = v_cnv.cnv_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'existe', true,
    'conversacion_id', v_cnv.cnv_id,
    'estado_atencion', v_cnv.cnv_estado_atencion,
    'asesora_nombre', nullif(v_asesora_nombre, ''),
    'mensajes_humanos', v_mensajes
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_sincronizar_hilo_publico(text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_sincronizar_hilo_publico(text, text) to anon, authenticated, service_role;

-- 9.C Obtener Tablero Unificado Omnicanal (Conversaciones, Equipo, Etiquetas, Respuestas Rápidas, Usuarios Web y Compras)
create or replace function comun_comercio.com_fn_omnicanal_obtener_tablero(
  p_negocio text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_conversaciones jsonb;
  v_etiquetas jsonb;
  v_respuestas jsonb;
  v_equipo jsonb;
  v_usuarios_web jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos de ventas u operación en este negocio.');
  end if;

  -- 1. Catálogo de etiquetas activas del negocio
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.etq_id,
      'slug', e.etq_slug,
      'nombre', e.etq_nombre,
      'color', e.etq_color,
      'icono', e.etq_icono,
      'orden', e.etq_orden
    ) order by e.etq_orden asc, e.etq_nombre asc
  ), '[]'::jsonb)
  into v_etiquetas
  from comun_agentes.agc_etiqueta e
  where e.etq_negocio = v_negocio
    and e.etq_activo = true
    and e.etq_eliminado_en is null;

  -- 2. Mensajes predeterminados del negocio
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', r.rrp_id,
      'atajo', r.rrp_atajo,
      'titulo', r.rrp_titulo,
      'categoria', r.rrp_categoria,
      'contenido', r.rrp_contenido,
      'usoConteo', r.rrp_uso_conteo
    ) order by r.rrp_categoria asc, r.rrp_atajo asc
  ), '[]'::jsonb)
  into v_respuestas
  from comun_agentes.agc_respuesta_rapida r
  where r.rrp_negocio = v_negocio
    and r.rrp_activo = true
    and r.rrp_eliminado_en is null;

  -- 3. Equipo comercial y administrativo del negocio
  select coalesce(jsonb_agg(sub.miembro order by sub.nombre asc), '[]'::jsonb)
  into v_equipo
  from (
    select distinct on (u.usu_id)
      u.usu_id,
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo) as nombre,
      jsonb_build_object(
        'usuarioId', u.usu_id,
        'nombre', coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo),
        'correo', u.usu_correo,
        'avatarUrl', u.usu_detalle_usuario->>'foto',
        'rol', case
          when u.usu_superadmin_plataforma or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com') then 'SUPERADMIN'
          else coalesce(p.per_clave, m.mem_rol, 'VENTAS')
        end,
        'chatsActivos', (
          select count(*)
          from comun_agentes.agc_conversacion ca
          where ca.cnv_negocio = v_negocio
            and ca.cnv_asesora_asignada_id = u.usu_id
            and ca.cnv_estado_atencion <> 'CERRADO'
            and ca.cnv_eliminado_en is null
        )
      ) as miembro
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )
      and (
        u.usu_superadmin_plataforma
        or (v_negocio = 'tinkay' and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com')
        or upper(coalesce(p.per_clave, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN')
      )
  ) sub;

  -- 4. Conversaciones con sus etiquetas y datos de asesora
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cnv_id,
      'secuencial', c.cnv_secuencial,
      'negocio', c.cnv_negocio,
      'canal', c.cnv_canal,
      'claveHilo', c.cnv_clave_hilo,
      'remitenteId', c.cnv_remitente_id,
      'remitenteNombre', c.cnv_remitente_nombre,
      'remitenteCorreo', c.cnv_remitente_correo,
      'remitenteTelefono', c.cnv_remitente_telefono,
      'usuarioId', c.cnv_usuario_id,
      'clienteId', c.cnv_cliente_id,
      'estadoAtencion', c.cnv_estado_atencion,
      'asesoraAsignadaId', c.cnv_asesora_asignada_id,
      'asesoraNombre', (
        select btrim(coalesce(ua.usu_nombres, '') || ' ' || coalesce(ua.usu_apellidos, ''))
        from comun_seguridad.seg_usuario ua
        where ua.usu_id = c.cnv_asesora_asignada_id
      ),
      'ultimoMensajeTexto', c.cnv_ultimo_mensaje_texto,
      'ultimoMensajeOrigen', c.cnv_ultimo_mensaje_origen,
      'ultimoMensajeEn', c.cnv_ultimo_mensaje_en,
      'noLeidosAsesora', c.cnv_no_leidos_asesora,
      'mensajesClienteConteo', c.cnv_mensajes_cliente_conteo,
      'mensajesIaConteo', c.cnv_mensajes_ia_conteo,
      'mensajesHumanoConteo', c.cnv_mensajes_humano_conteo,
      'motivoEscalamiento', c.cnv_motivo_escalamiento,
      'recordatorioEn', c.cnv_recordatorio_en,
      'recordatorioNota', c.cnv_recordatorio_nota,
      'ventana24hExpiraEn', c.cnv_ventana_24h_expira_en,
      'creadoEn', c.cnv_creado_en,
      'etiquetasIds', coalesce((
        select jsonb_agg(ce.cet_etiqueta_id)
        from comun_agentes.agc_conversacion_etiqueta ce
        where ce.cet_conversacion_id = c.cnv_id and ce.cet_eliminado_en is null
      ), '[]'::jsonb)
    ) order by
      case when c.cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      c.cnv_ultimo_mensaje_en desc
  ), '[]'::jsonb)
  into v_conversaciones
  from (
    select *
    from comun_agentes.agc_conversacion
    where cnv_negocio = v_negocio
      and cnv_eliminado_en is null
    order by
      case when cnv_estado_atencion = 'ESCALADO_HUMANO' then 0 else 1 end asc,
      cnv_ultimo_mensaje_en desc
    limit 250
  ) c;

  -- 5. Directorio unificado de Usuarios Registrados en Web + Clientes Compradores (Registrados y No Registrados)
  select coalesce(jsonb_agg(item order by creado_en desc), '[]'::jsonb)
  into v_usuarios_web
  from (
    -- A) Usuarios registrados en la web con membresía en el negocio
    select
      u.usu_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'usu:' || u.usu_id::text,
        'usuarioId', u.usu_id,
        'clienteId', cl.cli_id,
        'tipoCuenta', 'USUARIO_REGISTRADO',
        'nombre', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'nombres', u.usu_nombres, '') || ' ' || coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'apellidos', u.usu_apellidos, '')), ''),
          u.usu_correo
        ),
        'correo', u.usu_correo,
        'telefono', coalesce(
          nullif(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'whatsapp', '')), ''),
          nullif(btrim(coalesce(u.usu_whatsapp, '')), '')
        ),
        'identificacion', coalesce(cl.cli_identificacion, u.usu_cedula),
        'autorizaWhatsapp', coalesce(
          case
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('true', 't', '1', 'si', 'yes') then true
            when lower(btrim(coalesce(u.usu_detalle_usuario->'registros_negocio'->v_negocio->>'autorizacion_whatsapp', ''))) in ('false', 'f', '0', 'no') then false
            else null
          end,
          u.usu_autorizacion_whatsapp,
          false
        ),
        'rolNegocio', coalesce(m.mem_rol, 'CLIENTE'),
        'totalCompras', coalesce(cl.cli_total_compras, 0),
        'montoAcumulado', coalesce(cl.cli_monto_acumulado, 0),
        'ultimaCompraEn', cl.cli_ultima_compra_en,
        'creadoEn', coalesce(m.mem_creado_en, u.usu_creado_en),
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cl.cli_id is not null and cle.cle_cliente_id = cl.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join lateral (
      select c.*
      from comun_comercio.com_cliente c
      where c.cli_negocio = v_negocio
        and c.cli_eliminado_en is null
        and (c.cli_usuario_id = u.usu_id or (u.usu_correo is not null and lower(c.cli_correo) = lower(u.usu_correo)))
      order by c.cli_actualizado_en desc
      limit 1
    ) cl on true
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and lower(m.mem_negocio) in ('tinkay', 'tnk'))
        or (v_negocio = 'tranqi' and lower(m.mem_negocio) in ('tranqi', 'tranq', 'legal'))
        or (v_negocio = 'fastfix' and lower(m.mem_negocio) in ('fastfix', 'ffh'))
        or (v_negocio = 'margaritas' and lower(m.mem_negocio) in ('margaritas', 'mrg'))
      )

    union all

    -- B) Compradores invitados (No Registrados en la web) capturados en com_cliente
    select
      c.cli_creado_en as creado_en,
      jsonb_build_object(
        'claveUnica', 'cli:' || c.cli_id::text,
        'usuarioId', null,
        'clienteId', c.cli_id,
        'tipoCuenta', 'INVITADO_NO_REGISTRADO',
        'nombre', c.cli_nombre,
        'correo', c.cli_correo,
        'telefono', c.cli_telefono,
        'identificacion', c.cli_identificacion,
        'autorizaWhatsapp', (
          lower(btrim(coalesce(c.cli_detalle_cliente->'datos_capturados'->>'autorizaWhatsapp', ''))) in ('true', 't', '1', 'si', 'yes')
        ),
        'rolNegocio', 'INVITADO',
        'totalCompras', c.cli_total_compras,
        'montoAcumulado', c.cli_monto_acumulado,
        'ultimaCompraEn', c.cli_ultima_compra_en,
        'creadoEn', c.cli_creado_en,
        'etiquetasIds', coalesce((
          select jsonb_agg(cle.cle_etiqueta_id)
          from comun_comercio.com_cliente_etiqueta cle
          where cle.cle_cliente_id = c.cli_id and cle.cle_eliminado_en is null
        ), '[]'::jsonb)
      ) as item
    from comun_comercio.com_cliente c
    where c.cli_negocio = v_negocio
      and c.cli_eliminado_en is null
      and c.cli_usuario_id is null
      and not exists (
        select 1
        from comun_seguridad.seg_usuario u2
        join comun_seguridad.seg_membresia m2 on m2.mem_usuario_id = u2.usu_id
        where c.cli_correo is not null
          and lower(u2.usu_correo) = lower(c.cli_correo)
          and lower(m2.mem_negocio) = v_negocio
          and m2.mem_estado = 'ACTIVO'
      )
  ) directorio;

  return jsonb_build_object(
    'ok', true,
    'conversaciones', v_conversaciones,
    'etiquetas', v_etiquetas,
    'respuestasRapidas', v_respuestas,
    'equipo', v_equipo,
    'usuariosYClientes', v_usuarios_web
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_tablero(text) to authenticated, service_role;

-- 9.D Obtener historial completo de mensajes de una conversación y marcar como leída por el asesor
create or replace function comun_comercio.com_fn_omnicanal_obtener_mensajes(
  p_negocio text,
  p_conversacion_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_mensajes jsonb;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin autorización para leer esta conversación.');
  end if;

  update comun_agentes.agc_conversacion
     set cnv_no_leidos_asesora = 0
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', m.msg_id,
      'origen', m.msg_origen,
      'autorUsuarioId', m.msg_autor_usuario_id,
      'autorNombre', m.msg_autor_nombre,
      'contenido', m.msg_contenido,
      'tipoContenido', m.msg_tipo_contenido,
      'estadoEntrega', m.msg_estado_entrega,
      'detalle', m.msg_detalle_mensaje,
      'creadoEn', m.msg_creado_en
    ) order by m.msg_creado_en asc
  ), '[]'::jsonb)
  into v_mensajes
  from comun_agentes.agc_mensaje m
  where m.msg_conversacion_id = p_conversacion_id
    and m.msg_negocio = v_negocio
    and m.msg_eliminado_en is null;

  return jsonb_build_object('ok', true, 'mensajes', v_mensajes);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_obtener_mensajes(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_obtener_mensajes(text, uuid) to authenticated, service_role;

-- 9.E Enviar Respuesta de Vendedor Humano o Nota Interna de Equipo (registra intervención humana y silencia IA)
create or replace function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(
  p_negocio text,
  p_conversacion_id uuid,
  p_contenido text,
  p_es_nota_interna boolean default false,
  p_respuesta_rapida_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_autor_nombre text;
  v_texto text := btrim(coalesce(p_contenido, ''));
  v_origen text := case when coalesce(p_es_nota_interna, false) then 'NOTA_INTERNA' else 'ASESORA_HUMANA' end;
  v_msg record;
  v_cnv record;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para responder en este negocio.');
  end if;

  if v_texto = '' then
    return jsonb_build_object('ok', false, 'error', 'Escribe un mensaje antes de enviar.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Asesor')
    into v_autor_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  insert into comun_agentes.agc_mensaje (
    msg_negocio,
    msg_conversacion_id,
    msg_origen,
    msg_autor_usuario_id,
    msg_autor_nombre,
    msg_contenido,
    msg_tipo_contenido,
    msg_detalle_mensaje
  )
  values (
    v_negocio,
    p_conversacion_id,
    v_origen,
    v_uid,
    v_autor_nombre,
    v_texto,
    'TEXTO',
    jsonb_build_object(
      'intervencion_humana', (not coalesce(p_es_nota_interna, false)),
      'respuesta_rapida_id', p_respuesta_rapida_id
    )
  )
  returning * into v_msg;

  if p_respuesta_rapida_id is not null then
    update comun_agentes.agc_respuesta_rapida
       set rrp_uso_conteo = rrp_uso_conteo + 1,
           rrp_actualizado_en = now()
     where rrp_id = p_respuesta_rapida_id
       and rrp_negocio = v_negocio;
  end if;

  if coalesce(p_es_nota_interna, false) then
    update comun_agentes.agc_conversacion
       set cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  else
    update comun_agentes.agc_conversacion
       set cnv_estado_atencion = 'EN_ATENCION_ASESORA',
           cnv_asesora_asignada_id = coalesce(cnv_asesora_asignada_id, v_uid),
           cnv_atribuido_por = case when cnv_asesora_asignada_id is null then 'MANUAL' else cnv_atribuido_por end,
           cnv_ultimo_mensaje_texto = left(v_texto, 280),
           cnv_ultimo_mensaje_origen = 'ASESORA_HUMANA',
           cnv_ultimo_mensaje_en = now(),
           cnv_no_leidos_asesora = 0,
           cnv_no_leidos_cliente = cnv_no_leidos_cliente + 1,
           cnv_mensajes_humano_conteo = cnv_mensajes_humano_conteo + 1,
           cnv_actualizado_en = now()
     where cnv_id = p_conversacion_id
       and cnv_negocio = v_negocio
     returning * into v_cnv;
  end if;

  return jsonb_build_object(
    'ok', true,
    'mensaje', jsonb_build_object(
      'id', v_msg.msg_id,
      'origen', v_msg.msg_origen,
      'autorUsuarioId', v_msg.msg_autor_usuario_id,
      'autorNombre', v_msg.msg_autor_nombre,
      'contenido', v_msg.msg_contenido,
      'tipoContenido', v_msg.msg_tipo_contenido,
      'estadoEntrega', v_msg.msg_estado_entrega,
      'detalle', v_msg.msg_detalle_mensaje,
      'creadoEn', v_msg.msg_creado_en
    ),
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'mensajesHumanoConteo', v_cnv.cnv_mensajes_humano_conteo
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_enviar_mensaje_asesor(text, uuid, text, boolean, uuid) to authenticated, service_role;

-- 9.F Actualizar Estado HITL, Asignación de Vendedor y Recordatorio con bitácora auditable
create or replace function comun_comercio.com_fn_omnicanal_actualizar_conversacion(
  p_negocio text,
  p_conversacion_id uuid,
  p_nuevo_estado text default null,
  p_asesora_id uuid default null,
  p_desasignar boolean default false,
  p_recordatorio_en timestamptz default null,
  p_recordatorio_nota text default null,
  p_limpiar_recordatorio boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_actor text;
  v_prev record;
  v_cnv record;
  v_evento_texto text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para gestionar esta conversación.');
  end if;

  select * into v_prev
  from comun_agentes.agc_conversacion
  where cnv_id = p_conversacion_id and cnv_negocio = v_negocio;

  if v_prev is null then
    return jsonb_build_object('ok', false, 'error', 'Conversación no encontrada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  update comun_agentes.agc_conversacion
     set cnv_estado_atencion = coalesce(p_nuevo_estado, cnv_estado_atencion),
         cnv_asesora_asignada_id = case
           when p_desasignar then null
           when p_asesora_id is not null then p_asesora_id
           when p_nuevo_estado = 'EN_ATENCION_ASESORA' and cnv_asesora_asignada_id is null then v_uid
           else cnv_asesora_asignada_id
         end,
         cnv_atribuido_por = case
           when p_asesora_id is not null or p_nuevo_estado = 'EN_ATENCION_ASESORA' then 'MANUAL'
           else cnv_atribuido_por
         end,
         cnv_recordatorio_en = case
           when p_limpiar_recordatorio then null
           when p_recordatorio_en is not null then p_recordatorio_en
           else cnv_recordatorio_en
         end,
         cnv_recordatorio_nota = case
           when p_limpiar_recordatorio then null
           when p_recordatorio_nota is not null then btrim(p_recordatorio_nota)
           else cnv_recordatorio_nota
         end,
         cnv_actualizado_en = now()
   where cnv_id = p_conversacion_id
     and cnv_negocio = v_negocio
   returning * into v_cnv;

  if p_nuevo_estado is not null and p_nuevo_estado <> v_prev.cnv_estado_atencion then
    v_evento_texto := case p_nuevo_estado
      when 'EN_ATENCION_ASESORA' then v_actor || ' tomó el control humano (ARIA en pausa).'
      when 'BOT_ACTIVO' then v_actor || ' reactivó la atención automática con IA ARIA.'
      when 'ESCALADO_HUMANO' then v_actor || ' marcó el chat como Escalado a Humano.'
      when 'EN_ESPERA_CLIENTE' then v_actor || ' puso la conversación en espera del cliente.'
      when 'CERRADO' then v_actor || ' cerró la conversación.'
      else v_actor || ' cambió el estado a ' || p_nuevo_estado
    end;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    ) values (
      v_negocio, p_conversacion_id, 'SISTEMA', v_uid, v_actor, v_evento_texto, 'TEXTO'
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'estadoAtencion', v_cnv.cnv_estado_atencion,
    'asesoraAsignadaId', v_cnv.cnv_asesora_asignada_id,
    'recordatorioEn', v_cnv.cnv_recordatorio_en,
    'recordatorioNota', v_cnv.cnv_recordatorio_nota
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean) from public;
grant execute on function comun_comercio.com_fn_omnicanal_actualizar_conversacion(text, uuid, text, uuid, boolean, timestamptz, text, boolean) to authenticated, service_role;

-- 9.G Crear/Editar Etiqueta, Alternar Etiqueta en Conversación/Cliente y Administrar Respuestas Rápidas
create or replace function comun_comercio.com_fn_omnicanal_guardar_etiqueta(
  p_negocio text,
  p_nombre text,
  p_color text default '#2563EB',
  p_icono text default '🏷️'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_nombre text := btrim(coalesce(p_nombre, ''));
  v_slug text := lower(regexp_replace(v_nombre, '[^a-zA-Z0-9]+', '-', 'g'));
  v_etq record;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para crear etiquetas.');
  end if;

  if length(v_nombre) < 2 then
    return jsonb_build_object('ok', false, 'error', 'El nombre de la etiqueta debe tener al menos 2 caracteres.');
  end if;

  insert into comun_agentes.agc_etiqueta (etq_negocio, etq_slug, etq_nombre, etq_color, etq_icono, etq_orden)
  values (v_negocio, v_slug, v_nombre, coalesce(nullif(btrim(p_color), ''), '#2563EB'), coalesce(nullif(btrim(p_icono), ''), '🏷️'), 50)
  on conflict (etq_negocio, etq_slug) where etq_eliminado_en is null
  do update set
    etq_nombre = excluded.etq_nombre,
    etq_color = excluded.etq_color,
    etq_icono = excluded.etq_icono,
    etq_activo = true,
    etq_actualizado_en = now()
  returning * into v_etq;

  return jsonb_build_object(
    'ok', true,
    'etiqueta', jsonb_build_object(
      'id', v_etq.etq_id,
      'slug', v_etq.etq_slug,
      'nombre', v_etq.etq_nombre,
      'color', v_etq.etq_color,
      'icono', v_etq.etq_icono,
      'orden', v_etq.etq_orden
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_etiqueta(text, text, text, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_etiqueta(text, text, text, text) to authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_alternar_etiqueta(
  p_negocio text,
  p_etiqueta_id uuid,
  p_conversacion_id uuid default null,
  p_cliente_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_existe uuid;
  v_asignada boolean := false;
  v_cli_vinculado uuid := p_cliente_id;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para etiquetar.');
  end if;

  if p_conversacion_id is not null then
    select cet_id into v_existe
    from comun_agentes.agc_conversacion_etiqueta
    where cet_conversacion_id = p_conversacion_id
      and cet_etiqueta_id = p_etiqueta_id;

    if v_existe is not null then
      delete from comun_agentes.agc_conversacion_etiqueta where cet_id = v_existe;
      v_asignada := false;
    else
      insert into comun_agentes.agc_conversacion_etiqueta (
        cet_negocio, cet_conversacion_id, cet_etiqueta_id, cet_asignado_por
      ) values (v_negocio, p_conversacion_id, p_etiqueta_id, v_uid);
      v_asignada := true;
    end if;

    if v_cli_vinculado is null then
      select cnv_cliente_id into v_cli_vinculado
      from comun_agentes.agc_conversacion
      where cnv_id = p_conversacion_id;
    end if;
  end if;

  if v_cli_vinculado is not null then
    if p_conversacion_id is null then
      select cle_id into v_existe
      from comun_comercio.com_cliente_etiqueta
      where cle_cliente_id = v_cli_vinculado and cle_etiqueta_id = p_etiqueta_id;

      if v_existe is not null then
        delete from comun_comercio.com_cliente_etiqueta where cle_id = v_existe;
        v_asignada := false;
      else
        insert into comun_comercio.com_cliente_etiqueta (
          cle_negocio, cle_cliente_id, cle_etiqueta_id, cle_asignado_por
        ) values (v_negocio, v_cli_vinculado, p_etiqueta_id, v_uid);
        v_asignada := true;
      end if;
    elsif v_asignada then
      insert into comun_comercio.com_cliente_etiqueta (
        cle_negocio, cle_cliente_id, cle_etiqueta_id, cle_asignado_por
      ) values (v_negocio, v_cli_vinculado, p_etiqueta_id, v_uid)
      on conflict (cle_cliente_id, cle_etiqueta_id) do nothing;
    else
      delete from comun_comercio.com_cliente_etiqueta
      where cle_cliente_id = v_cli_vinculado and cle_etiqueta_id = p_etiqueta_id;
    end if;
  end if;

  return jsonb_build_object('ok', true, 'asignada', v_asignada);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_alternar_etiqueta(text, uuid, uuid, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_alternar_etiqueta(text, uuid, uuid, uuid) to authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_guardar_respuesta_rapida(
  p_negocio text,
  p_atajo text,
  p_titulo text,
  p_categoria text,
  p_contenido text,
  p_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_atajo text := case
    when left(btrim(coalesce(p_atajo, '')), 1) = '/' then lower(btrim(p_atajo))
    else '/' || lower(btrim(coalesce(p_atajo, '')))
  end;
  v_rrp record;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para guardar respuestas rápidas.');
  end if;

  if length(v_atajo) < 2 or length(btrim(coalesce(p_contenido, ''))) < 3 then
    return jsonb_build_object('ok', false, 'error', 'Completa el atajo (ej. /saludo) y el texto del mensaje.');
  end if;

  if p_id is not null then
    update comun_agentes.agc_respuesta_rapida
       set rrp_atajo = v_atajo,
           rrp_titulo = btrim(coalesce(p_titulo, v_atajo)),
           rrp_categoria = coalesce(nullif(btrim(p_categoria), ''), 'Ventas'),
           rrp_contenido = btrim(p_contenido),
           rrp_actualizado_en = now()
     where rrp_id = p_id and rrp_negocio = v_negocio
     returning * into v_rrp;
  else
    insert into comun_agentes.agc_respuesta_rapida (
      rrp_negocio, rrp_atajo, rrp_titulo, rrp_categoria, rrp_contenido
    )
    values (
      v_negocio, v_atajo, btrim(coalesce(p_titulo, v_atajo)), coalesce(nullif(btrim(p_categoria), ''), 'Ventas'), btrim(p_contenido)
    )
    on conflict (rrp_negocio, rrp_atajo) where rrp_eliminado_en is null
    do update set
      rrp_titulo = excluded.rrp_titulo,
      rrp_categoria = excluded.rrp_categoria,
      rrp_contenido = excluded.rrp_contenido,
      rrp_activo = true,
      rrp_actualizado_en = now()
    returning * into v_rrp;
  end if;

  return jsonb_build_object(
    'ok', true,
    'respuesta', jsonb_build_object(
      'id', v_rrp.rrp_id,
      'atajo', v_rrp.rrp_atajo,
      'titulo', v_rrp.rrp_titulo,
      'categoria', v_rrp.rrp_categoria,
      'contenido', v_rrp.rrp_contenido,
      'usoConteo', v_rrp.rrp_uso_conteo
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_guardar_respuesta_rapida(text, text, text, text, text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_guardar_respuesta_rapida(text, text, text, text, text, uuid) to authenticated, service_role;

create or replace function comun_comercio.com_fn_omnicanal_eliminar_respuesta_rapida(
  p_negocio text,
  p_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para eliminar respuestas rápidas.');
  end if;

  update comun_agentes.agc_respuesta_rapida
     set rrp_activo = false,
         rrp_eliminado_en = now(),
         rrp_actualizado_en = now()
   where rrp_id = p_id
     and rrp_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_eliminar_respuesta_rapida(text, uuid) from public;
grant execute on function comun_comercio.com_fn_omnicanal_eliminar_respuesta_rapida(text, uuid) to authenticated, service_role;

-- 9.H Abrir o crear hilo de seguimiento para un Comprador o Usuario Registrado desde el Panel
create or replace function comun_comercio.com_fn_omnicanal_abrir_seguimiento_contacto(
  p_negocio text,
  p_nombre text,
  p_correo text default null,
  p_telefono text default null,
  p_usuario_id uuid default null,
  p_cliente_id uuid default null,
  p_contexto_orden text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_facturacion.fac_fn_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_cnv record;
  v_clave text;
  v_actor text;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin autorización.');
  end if;

  select * into v_cnv
  from comun_agentes.agc_conversacion c
  where c.cnv_negocio = v_negocio
    and c.cnv_eliminado_en is null
    and (
      (p_usuario_id is not null and c.cnv_usuario_id = p_usuario_id)
      or (p_cliente_id is not null and c.cnv_cliente_id = p_cliente_id)
      or (coalesce(btrim(p_correo), '') <> '' and lower(c.cnv_remitente_correo) = lower(btrim(p_correo)))
      or (coalesce(btrim(p_telefono), '') <> '' and regexp_replace(coalesce(c.cnv_remitente_telefono, ''), '\D', '', 'g') = regexp_replace(p_telefono, '\D', '', 'g') and length(regexp_replace(p_telefono, '\D', '', 'g')) >= 8)
    )
  order by c.cnv_ultimo_mensaje_en desc
  limit 1;

  if v_cnv is null then
    v_clave := 'crm-' || coalesce(
      p_usuario_id::text,
      p_cliente_id::text,
      md5(lower(coalesce(p_correo, p_telefono, p_nombre, gen_random_uuid()::text)))
    );

    select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Ventas')
      into v_actor
      from comun_seguridad.seg_usuario u
     where u.usu_id = v_uid;

    insert into comun_agentes.agc_conversacion (
      cnv_negocio, cnv_canal, cnv_clave_hilo, cnv_remitente_id, cnv_remitente_nombre,
      cnv_remitente_correo, cnv_remitente_telefono, cnv_usuario_id, cnv_cliente_id,
      cnv_estado_atencion, cnv_asesora_asignada_id, cnv_atribuido_por,
      cnv_ultimo_mensaje_texto, cnv_ultimo_mensaje_origen
    )
    values (
      v_negocio, 'web', v_clave, coalesce(p_telefono, p_correo, v_clave),
      coalesce(nullif(btrim(p_nombre), ''), 'Cliente Web'),
      nullif(lower(btrim(coalesce(p_correo, ''))), ''),
      nullif(btrim(coalesce(p_telefono, '')), ''),
      p_usuario_id, p_cliente_id,
      'EN_ATENCION_ASESORA', v_uid, 'MANUAL',
      coalesce(p_contexto_orden, 'Ficha de seguimiento comercial abierta por ' || v_actor),
      'SISTEMA'
    )
    returning * into v_cnv;

    insert into comun_agentes.agc_mensaje (
      msg_negocio, msg_conversacion_id, msg_origen, msg_autor_usuario_id, msg_autor_nombre, msg_contenido, msg_tipo_contenido
    )
    values (
      v_negocio, v_cnv.cnv_id, 'SISTEMA', v_uid, v_actor,
      coalesce(p_contexto_orden, 'Hilo de seguimiento comercial creado desde el directorio de ventas por ' || v_actor || '.'),
      case when p_contexto_orden is not null then 'ORDEN_WEB' else 'TEXTO' end
    );
  end if;

  return jsonb_build_object('ok', true, 'conversacionId', v_cnv.cnv_id);
end;
$$;

revoke execute on function comun_comercio.com_fn_omnicanal_abrir_seguimiento_contacto(text, text, text, text, uuid, uuid, text) from public;
grant execute on function comun_comercio.com_fn_omnicanal_abrir_seguimiento_contacto(text, text, text, text, uuid, uuid, text) to authenticated, service_role;

-- =============================================================================
-- 10. REGISTRO Y PRE-CONFIGURACIÓN DEL WIDGET `consola_chat` (Regla 15, Point 1)
-- =============================================================================

do $$
declare
  v_negocio text;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'tranqi', 'fastfix', 'margaritas']) loop
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget
    ) values (
      v_negocio,
      'consola_chat',
      'Ventas & Bandeja Omnicanal',
      true,
      jsonb_build_object(
        'descripcion', 'Centro unificado estilo ManyChat: monitoreo de chats en vivo, intervenciones humanas vs IA ARIA, etiquetas, respuestas rápidas, usuarios registrados y compras web.',
        'categoria', 'Comercio y Atención Omnicanal',
        'ruta', '/panel/conversaciones',
        'panel_defecto', 'panel_administrar',
        'icono', 'MessageSquare'
      )
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now()
    returning wdg_id into v_widget_id;

    if v_widget_id is null then
      select wdg_id into v_widget_id
      from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio and wdg_clave = 'consola_chat';
    end if;

    if v_widget_id is not null then
      insert into comun_seguridad.seg_rol_widget (
        rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible
      ) values
        (v_negocio, 'VENTAS', v_widget_id, true),
        (v_negocio, 'VENDEDOR', v_widget_id, true),
        (v_negocio, 'OPERADOR', v_widget_id, true),
        (v_negocio, 'ADMINISTRADOR', v_widget_id, true),
        (v_negocio, 'SUPERADMIN', v_widget_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end if;
  end loop;
end $$;

notify pgrst, 'reload schema';
