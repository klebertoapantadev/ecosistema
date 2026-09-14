-- ==============================================================================
-- Migración: 20260914000001_comun_comercio_trazabilidad_y_evidencias_consumo.sql
-- Módulo: Trazabilidad de Consumos de Planes, Cupones y Evidencias POD (PLT-009 / TNK-005)
-- ==============================================================================

create table if not exists comun_comercio.com_derecho_consumo_historial (
  dch_id uuid primary key default gen_random_uuid(),
  dch_secuencial bigint generated always as identity,
  dch_negocio text not null,                           -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'
  dch_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  dch_suscripcion_id uuid references comun_comercio.com_suscripcion(sub_id) on delete set null,
  dch_cupon_id uuid references comun_comercio.com_cupon(cup_id) on delete set null,
  
  -- Origen del derecho
  dch_origen text not null,                            -- 'PLAN_SUSCRIPCION' | 'CUPON_BIENVENIDA' | 'CONVENIO_B2B' | 'PREPAGO'
  dch_concepto text not null,                          -- 'CONSULTA_TELEMATICA' | 'REVISION_CONTRATO' | 'VISITA_TECNICA' | 'ENTREGA_FLORAL'
  
  -- Entidad operativa asociada
  dch_referencia_tipo text not null,                   -- 'CITA' | 'CASO' | 'ORDEN_DESPACHO' | 'ORDEN_TRABAJO'
  dch_referencia_id uuid,                              -- ID en trq_cita, ffh_visita, o com_orden
  dch_responsable_id uuid references comun_seguridad.seg_usuario(usu_id), -- Abogado, Técnico o Repartidor
  dch_responsable_nombre text,                         -- "Abg. Diego Benítez", "Motorizado Repartidor #4", etc.
  
  -- Detalle y Evidencia
  dch_titulo text not null,                            -- "Cita Telemática de Familia" o "Entrega Floral Semanal #2"
  dch_descripcion text,
  dch_evidencia_url text,                              -- URL Foto POD, PDF Dictamen o Acta
  dch_evidencia_detalle jsonb not null default '{}'::jsonb, -- { "recibido_por": "Andrea M.", "lat": -0.18, "lng": -78.46, "hora": "..." }
  
  dch_creado_en timestamptz not null default now()
);

create index if not exists idx_dch_cliente_negocio on comun_comercio.com_derecho_consumo_historial(dch_cliente_id, dch_negocio);
create index if not exists idx_dch_suscripcion on comun_comercio.com_derecho_consumo_historial(dch_suscripcion_id);
create index if not exists idx_dch_fecha on comun_comercio.com_derecho_consumo_historial(dch_creado_en desc);

-- RLS
alter table comun_comercio.com_derecho_consumo_historial enable row level security;

create policy com_dch_propio on comun_comercio.com_derecho_consumo_historial
  for select using (auth.uid() = dch_cliente_id);

create policy com_dch_staff on comun_comercio.com_derecho_consumo_historial
  for select using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(dch_negocio));

-- Trigger de Auditoría
drop trigger if exists trg_auditoria_com_derecho_consumo_historial on comun_comercio.com_derecho_consumo_historial;
create trigger trg_auditoria_com_derecho_consumo_historial 
  after insert or update or delete on comun_comercio.com_derecho_consumo_historial 
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_derecho_consumo_historial to authenticated;
grant usage, select on all sequences in schema comun_comercio to authenticated;

-- Función RPC para consultar historial del cliente
create or replace function comun_comercio.com_fn_historial_consumos_cliente(p_negocio text)
returns table (
  id uuid,
  secuencial bigint,
  origen text,
  concepto text,
  titulo text,
  descripcion text,
  referencia_tipo text,
  referencia_id uuid,
  responsable_nombre text,
  evidencia_url text,
  evidencia_detalle jsonb,
  creado_en timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    dch_id,
    dch_secuencial,
    dch_origen,
    dch_concepto,
    dch_titulo,
    dch_descripcion,
    dch_referencia_tipo,
    dch_referencia_id,
    dch_responsable_nombre,
    dch_evidencia_url,
    dch_evidencia_detalle,
    dch_creado_en
  from comun_comercio.com_derecho_consumo_historial
  where dch_cliente_id = auth.uid()
    and dch_negocio = p_negocio
  order by dch_creado_en desc;
$$;

grant execute on function comun_comercio.com_fn_historial_consumos_cliente(text) to authenticated;
