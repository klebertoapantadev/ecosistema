-- ==============================================================================
-- Migración: 20260905000001_comun_comercio.sql
-- Módulo: Catálogo Comercial Unificado, Inventario, BOM, Proformas CPQ,
--         Suscripciones, Billetera Digital, Cupones y Logística de Despacho.
-- Cumple: ADR-0003, PLT-009, PLT-014 y estándares de gobernanza del ecosistema.
-- ==============================================================================

create schema if not exists comun_comercio;

-- ------------------------------------------------------------------------------
-- 1. CAPA DE CATÁLOGO Y VARIANTES
-- ------------------------------------------------------------------------------

-- Categorías comerciales
create table comun_comercio.com_categoria (
  ctg_id uuid primary key default gen_random_uuid(),
  ctg_secuencial bigint generated always as identity,
  ctg_negocio text not null,              -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas'
  ctg_nombre text not null,
  ctg_slug text not null,
  ctg_descripcion text,
  ctg_padre_id uuid references comun_comercio.com_categoria(ctg_id) on delete cascade,
  ctg_orden int not null default 0,
  ctg_activo boolean not null default true,
  ctg_detalle_categoria jsonb not null default '{}'::jsonb,
  ctg_creado_en timestamptz not null default now(),
  ctg_actualizado_en timestamptz not null default now(),
  unique(ctg_negocio, ctg_slug)
);

create index idx_com_categoria_negocio on comun_comercio.com_categoria(ctg_negocio, ctg_activo);

-- Productos o Servicios Maestros
create table comun_comercio.com_producto (
  pro_id uuid primary key default gen_random_uuid(),
  pro_secuencial bigint generated always as identity,
  pro_negocio text not null,
  pro_categoria_id uuid references comun_comercio.com_categoria(ctg_id) on delete set null,
  pro_nombre text not null,
  pro_slug text not null,
  pro_descripcion text,
  pro_tipo text not null default 'FISICO', -- 'FISICO' | 'SERVICIO' | 'SUSCRIPCION' | 'DIGITAL'
  pro_activo boolean not null default true,
  pro_destacado boolean not null default false,
  pro_detalle_producto jsonb not null default '{}'::jsonb,
  pro_creado_en timestamptz not null default now(),
  pro_actualizado_en timestamptz not null default now(),
  unique(pro_negocio, pro_slug)
);

create index idx_com_producto_negocio on comun_comercio.com_producto(pro_negocio, pro_activo);

-- Variantes Comerciales / SKUs
create table comun_comercio.com_variante (
  var_id uuid primary key default gen_random_uuid(),
  var_secuencial bigint generated always as identity,
  var_negocio text not null,
  var_producto_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  var_sku text not null,
  var_nombre text not null,                -- ej. "25 Tallos", "Plan Anual", "Revisión Calefón"
  var_precio numeric(12,4) not null,       -- Base Imponible (Sin IVA)
  var_precio_comparacion numeric(12,4),    -- Precio tachado de referencia
  var_codigo_impuesto_sri text not null default 'IVA_15', -- 'IVA_15' | 'IVA_0' | 'NO_OBJETO'
  var_tarifa_iva_porcentaje numeric(5,2) not null default 15.00,
  var_tipo_oferta text not null default 'UNICO', -- 'UNICO' | 'RECURRENTE_MENSUAL' | 'RECURRENTE_ANUAL' | 'TIEMPO_MANO_OBRA'
  var_frecuencia_recurrencia text,         -- 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'ANUAL'
  var_activo boolean not null default true,
  var_detalle_variante jsonb not null default '{}'::jsonb,
  var_creado_en timestamptz not null default now(),
  var_actualizado_en timestamptz not null default now(),
  unique(var_negocio, var_sku)
);

create index idx_com_variante_producto on comun_comercio.com_variante(var_producto_id, var_activo);

-- Medios y Galerías Fotográficas
create table comun_comercio.com_media (
  med_id uuid primary key default gen_random_uuid(),
  med_secuencial bigint generated always as identity,
  med_negocio text not null,
  med_producto_id uuid references comun_comercio.com_producto(pro_id) on delete cascade,
  med_variante_id uuid references comun_comercio.com_variante(var_id) on delete cascade,
  med_origen text not null default 'local', -- 'local' | 'url_externa'
  med_url text not null,
  med_es_portada boolean not null default false,
  med_orden int not null default 0,
  med_detalle_media jsonb not null default '{}'::jsonb,
  med_creado_en timestamptz not null default now(),
  check (med_producto_id is not null or med_variante_id is not null)
);

create index idx_com_media_producto on comun_comercio.com_media(med_producto_id);

-- Campos dinámicos de personalización
create table comun_comercio.com_personalizacion_campo (
  pzc_id uuid primary key default gen_random_uuid(),
  pzc_secuencial bigint generated always as identity,
  pzc_negocio text not null,
  pzc_producto_id uuid references comun_comercio.com_producto(pro_id) on delete cascade,
  pzc_variante_id uuid references comun_comercio.com_variante(var_id) on delete cascade,
  pzc_etiqueta text not null,
  pzc_tipo_campo text not null default 'TEXTO', -- 'TEXTO' | 'FECHA' | 'HORA' | 'TEXTAREA' | 'SELECT'
  pzc_es_obligatorio boolean not null default false,
  pzc_opciones jsonb not null default '[]'::jsonb,
  pzc_orden int not null default 0,
  pzc_detalle_campo jsonb not null default '{}'::jsonb,
  pzc_creado_en timestamptz not null default now()
);

-- Productos Relacionados (Cross-Sell / Up-Sell unificado)
create table comun_comercio.com_producto_relacionado (
  prl_id uuid primary key default gen_random_uuid(),
  prl_secuencial bigint generated always as identity,
  prl_negocio text not null,
  prl_producto_origen_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  prl_producto_destino_id uuid not null references comun_comercio.com_producto(pro_id) on delete cascade,
  prl_tipo_relacion text not null default 'CROSS_SELL', -- 'CROSS_SELL' | 'UP_SELL' | 'COMPLEMENTO'
  prl_orden int not null default 0,
  prl_creado_en timestamptz not null default now(),
  unique(prl_producto_origen_id, prl_producto_destino_id)
);

-- ------------------------------------------------------------------------------
-- 2. CAPA DE INSUMOS, RECETAS (BOM) E INVENTARIOS
-- ------------------------------------------------------------------------------

-- Insumos y materias primas
create table comun_comercio.com_insumo (
  ins_id uuid primary key default gen_random_uuid(),
  ins_secuencial bigint generated always as identity,
  ins_negocio text not null,
  ins_codigo text not null,
  ins_nombre text not null,
  ins_unidad_medida text not null,          -- 'UNIDAD' | 'TALLO' | 'PLIEGO' | 'METRO' | 'GRAMO' | 'HORA'
  ins_costo_unitario numeric(12,4) not null default 0.0000,
  ins_activo boolean not null default true,
  ins_detalle_insumo jsonb not null default '{}'::jsonb,
  ins_creado_en timestamptz not null default now(),
  ins_actualizado_en timestamptz not null default now(),
  unique(ins_negocio, ins_codigo)
);

create index idx_com_insumo_negocio on comun_comercio.com_insumo(ins_negocio, ins_activo);

-- Receta / Composición de una variante (BOM)
create table comun_comercio.com_receta (
  rec_id uuid primary key default gen_random_uuid(),
  rec_secuencial bigint generated always as identity,
  rec_negocio text not null,
  rec_variante_id uuid not null references comun_comercio.com_variante(var_id) on delete cascade,
  rec_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  rec_cantidad numeric(12,4) not null,
  rec_es_opcional boolean not null default false,
  rec_detalle_receta jsonb not null default '{}'::jsonb,
  rec_creado_en timestamptz not null default now(),
  unique(rec_variante_id, rec_insumo_id)
);

-- Stock actual por local/almacén
create table comun_comercio.com_inventario (
  inv_id uuid primary key default gen_random_uuid(),
  inv_secuencial bigint generated always as identity,
  inv_negocio text not null,
  inv_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  inv_local_codigo text not null default 'MATRIZ',
  inv_stock_actual numeric(12,4) not null default 0.0000,
  inv_stock_minimo numeric(12,4) not null default 0.0000,
  inv_stock_reservado numeric(12,4) not null default 0.0000,
  inv_actualizado_en timestamptz not null default now(),
  unique(inv_negocio, inv_insumo_id, inv_local_codigo)
);

-- Movimientos de Kardex
create table comun_comercio.com_kardex (
  kar_id uuid primary key default gen_random_uuid(),
  kar_secuencial bigint generated always as identity,
  kar_negocio text not null,
  kar_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  kar_local_codigo text not null default 'MATRIZ',
  kar_tipo_movimiento text not null,        -- 'COMPRA' | 'CONSUMO_PRODUCCION' | 'MERMA' | 'AJUSTE_INVENTARIO'
  kar_cantidad numeric(12,4) not null,
  kar_costo_unitario numeric(12,4) not null,
  kar_referencia_id uuid,
  kar_observacion text,
  kar_registrado_por uuid references comun_seguridad.seg_usuario(usu_id),
  kar_creado_en timestamptz not null default now()
);

-- Mermas / Desperdicios
create table comun_comercio.com_merma (
  mrm_id uuid primary key default gen_random_uuid(),
  mrm_secuencial bigint generated always as identity,
  mrm_negocio text not null,
  mrm_insumo_id uuid not null references comun_comercio.com_insumo(ins_id) on delete cascade,
  mrm_cantidad numeric(12,4) not null,
  mrm_motivo text not null,                 -- 'MARCHITAMIENTO' | 'ROTURA' | 'CADUCIDAD' | 'DEFECTO_FABRICA'
  mrm_observacion text,
  mrm_reportado_por uuid not null references comun_seguridad.seg_usuario(usu_id),
  mrm_creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 3. CAPA DE PROFORMAS Y COTIZACIONES (CPQ)
-- ------------------------------------------------------------------------------

create table comun_comercio.com_proforma (
  prf_id uuid primary key default gen_random_uuid(),
  prf_secuencial bigint generated always as identity,
  prf_negocio text not null,
  prf_cliente_id uuid references comun_seguridad.seg_usuario(usu_id),
  prf_cliente_nombre text not null,
  prf_cliente_contacto jsonb not null default '{}'::jsonb,
  prf_estado text not null default 'BORRADOR', -- 'BORRADOR' | 'ENVIADA' | 'APROBADA' | 'RECHAZADA' | 'FACTURADA'
  prf_subtotal numeric(12,4) not null default 0.0000,
  prf_descuento numeric(12,4) not null default 0.0000,
  prf_iva numeric(12,4) not null default 0.0000,
  prf_total numeric(12,4) not null default 0.0000,
  prf_token_aprobacion text unique default gen_random_uuid()::text,
  prf_vigencia_dias int not null default 15,
  prf_observaciones text,
  prf_detalle_proforma jsonb not null default '{}'::jsonb,
  prf_creado_en timestamptz not null default now(),
  prf_actualizado_en timestamptz not null default now()
);

create table comun_comercio.com_proforma_item (
  pfi_id uuid primary key default gen_random_uuid(),
  pfi_secuencial bigint generated always as identity,
  pfi_negocio text not null,
  pfi_proforma_id uuid not null references comun_comercio.com_proforma(prf_id) on delete cascade,
  pfi_variante_id uuid references comun_comercio.com_variante(var_id),
  pfi_es_item_libre boolean not null default false,
  pfi_descripcion text not null,
  pfi_cantidad numeric(12,2) not null default 1.00,
  pfi_precio_unitario numeric(12,4) not null,
  pfi_descuento numeric(12,4) not null default 0.0000,
  pfi_impuesto text not null default 'IVA_15',
  pfi_total_linea numeric(12,4) not null,
  pfi_detalle_item jsonb not null default '{}'::jsonb
);

-- ------------------------------------------------------------------------------
-- 4. CAPA DE SUSCRIPCIONES ACTIVAS
-- ------------------------------------------------------------------------------

create table comun_comercio.com_suscripcion (
  sub_id uuid primary key default gen_random_uuid(),
  sub_secuencial bigint generated always as identity,
  sub_negocio text not null,
  sub_cliente_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  sub_variante_id uuid not null references comun_comercio.com_variante(var_id),
  sub_estado text not null default 'ACTIVA', -- 'ACTIVA' | 'PAUSADA' | 'CANCELADA' | 'EN_MORA'
  sub_frecuencia text not null,             -- 'SEMANAL' | 'QUINCENAL' | 'MENSUAL' | 'ANUAL'
  sub_monto_periodo numeric(12,4) not null,
  sub_proximo_cobro_en timestamptz not null,
  sub_ultimo_cobro_en timestamptz,
  sub_metodo_pago_token text,
  sub_detalle_suscripcion jsonb not null default '{}'::jsonb,
  sub_creado_en timestamptz not null default now(),
  sub_actualizado_en timestamptz not null default now()
);

create index idx_com_suscripcion_cliente on comun_comercio.com_suscripcion(sub_cliente_id, sub_negocio);

-- ------------------------------------------------------------------------------
-- 5. CAPA DE BILLETERA DIGITAL, CONVENIOS B2B2C Y BONOS
-- ------------------------------------------------------------------------------

create table comun_comercio.com_convenio_empresa (
  cve_id uuid primary key default gen_random_uuid(),
  cve_secuencial bigint generated always as identity,
  cve_negocio text not null,
  cve_empresa_nombre text not null,
  cve_empresa_ruc text,
  cve_dominio_correo text,
  cve_variante_id uuid references comun_comercio.com_variante(var_id),
  cve_monto_bono_inicial numeric(12,4) not null default 0.0000,
  cve_porcentaje_subsidio numeric(5,2) not null default 100.00,
  cve_activo boolean not null default true,
  cve_valido_hasta timestamptz,
  cve_detalle_convenio jsonb not null default '{}'::jsonb,
  cve_creado_en timestamptz not null default now()
);

create table comun_comercio.com_beneficiario_empresa (
  bnf_id uuid primary key default gen_random_uuid(),
  bnf_secuencial bigint generated always as identity,
  bnf_negocio text not null,
  bnf_convenio_id uuid not null references comun_comercio.com_convenio_empresa(cve_id) on delete cascade,
  bnf_identificacion text not null,        -- Cédula de identidad ecuatoriana
  bnf_correo_corporativo text,
  bnf_nombres text,
  bnf_usuario_vinculado_id uuid references comun_seguridad.seg_usuario(usu_id),
  bnf_estado text not null default 'PENDIENTE', -- 'PENDIENTE' | 'VINCULADO' | 'INACTIVO'
  bnf_vinculado_en timestamptz,
  bnf_detalle_beneficiario jsonb not null default '{}'::jsonb,
  bnf_creado_en timestamptz not null default now(),
  unique(bnf_convenio_id, bnf_identificacion)
);

create table comun_comercio.com_billetera (
  wlt_id uuid primary key default gen_random_uuid(),
  wlt_secuencial bigint generated always as identity,
  wlt_negocio text not null,
  wlt_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  wlt_saldo_total numeric(12,4) not null default 0.0000,
  wlt_saldo_recarga numeric(12,4) not null default 0.0000,
  wlt_saldo_bono numeric(12,4) not null default 0.0000,
  wlt_activo boolean not null default true,
  wlt_actualizado_en timestamptz not null default now(),
  unique(wlt_negocio, wlt_usuario_id)
);

create table comun_comercio.com_billetera_movimiento (
  wlm_id uuid primary key default gen_random_uuid(),
  wlm_secuencial bigint generated always as identity,
  wlm_negocio text not null,
  wlm_billetera_id uuid not null references comun_comercio.com_billetera(wlt_id) on delete cascade,
  wlm_tipo text not null,                  -- 'RECARGA_TC' | 'BONO_CONVENIO' | 'PAGO_SERVICIO' | 'REVERSION'
  wlm_tipo_saldo text not null,            -- 'RECARGA' | 'BONO'
  wlm_monto numeric(12,4) not null,
  wlm_saldo_anterior numeric(12,4) not null,
  wlm_saldo_posterior numeric(12,4) not null,
  wlm_referencia_id uuid,
  wlm_convenio_id uuid references comun_comercio.com_convenio_empresa(cve_id),
  wlm_expira_en timestamptz,
  wlm_descripcion text not null,
  wlm_detalle_movimiento jsonb not null default '{}'::jsonb,
  wlm_creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 6. CAPA DE CUPONES, PROMOCIONES E INFLUENCERS (PLT-014)
-- ------------------------------------------------------------------------------

create table comun_comercio.com_cupon (
  cup_id uuid primary key default gen_random_uuid(),
  cup_secuencial bigint generated always as identity,
  cup_negocio text not null,
  cup_codigo text not null,
  cup_descripcion text,
  cup_tipo text not null default 'PORCENTAJE', -- 'PORCENTAJE' | 'MONTO_FIJO' | 'BONO_BILLETERA' | 'ENVIO_GRATIS'
  cup_valor numeric(12,4) not null,
  cup_monto_minimo_compra numeric(12,4) not null default 0.0000,
  cup_limite_usos_global int,
  cup_usos_actuales int not null default 0,
  cup_limite_usos_por_usuario int not null default 1,
  cup_valido_desde timestamptz not null default now(),
  cup_valido_hasta timestamptz,
  cup_influencer_nombre text,
  cup_aplica_a text not null default 'TODOS', -- 'TODOS' | 'SOLO_PLANES' | 'SOLO_PRODUCTOS'
  cup_regla_suscripcion text not null default 'SOLO_PRIMER_CICLO', -- 'SOLO_PRIMER_CICLO' | 'RECURRENTE_PERMANENTE'
  cup_activo boolean not null default true,
  cup_detalle_cupon jsonb not null default '{}'::jsonb,
  cup_creado_en timestamptz not null default now(),
  unique(cup_negocio, cup_codigo)
);

create table comun_comercio.com_cupon_uso (
  cpu_id uuid primary key default gen_random_uuid(),
  cpu_secuencial bigint generated always as identity,
  cpu_negocio text not null,
  cpu_cupon_id uuid not null references comun_comercio.com_cupon(cup_id) on delete cascade,
  cpu_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id),
  cpu_orden_referencia_id uuid,
  cpu_monto_descontado numeric(12,4) not null,
  cpu_detalle_uso jsonb not null default '{}'::jsonb,
  cpu_creado_en timestamptz not null default now()
);

-- ------------------------------------------------------------------------------
-- 7. CAPA DE PROVEEDORES, COURIERS Y LOGÍSTICA DE DESPACHO
-- ------------------------------------------------------------------------------

create table comun_comercio.com_proveedor_servicio (
  prv_id uuid primary key default gen_random_uuid(),
  prv_secuencial bigint generated always as identity,
  prv_negocio text not null,
  prv_tipo text not null,                  -- 'DELIVERY_PROPIO' | 'COURIER_EXTERNO' | 'APP_MOVILIDAD' | 'TECNICO_SUBCONTRATADO'
  prv_nombre_comercial text not null,
  prv_contacto_nombre text,
  prv_telefono text,
  prv_email text,
  prv_vehiculo_tipo text default 'NINGUNO',-- 'MOTO' | 'AUTO' | 'FURGONETA' | 'CAMIONETA' | 'NINGUNO'
  prv_placa text,
  prv_tarifario_referencial jsonb not null default '{}'::jsonb,
  prv_activo boolean not null default true,
  prv_detalle_proveedor jsonb not null default '{}'::jsonb,
  prv_creado_en timestamptz not null default now(),
  prv_actualizado_en timestamptz not null default now()
);

create index idx_com_proveedor_negocio on comun_comercio.com_proveedor_servicio(prv_negocio, prv_activo);

create table comun_comercio.com_despacho_asignacion (
  dsp_id uuid primary key default gen_random_uuid(),
  dsp_secuencial bigint generated always as identity,
  dsp_negocio text not null,
  dsp_orden_id uuid not null,
  dsp_proveedor_id uuid references comun_comercio.com_proveedor_servicio(prv_id),
  dsp_modalidad text not null default 'DIRECTORIO', -- 'PROPIO' | 'DIRECTORIO' | 'UBER_CABIFY' | 'COURIER_DOCUMENTOS'
  dsp_conductor_nombre text,
  dsp_conductor_telefono text,
  dsp_tracking_url text,
  dsp_costo_envio numeric(12,4) not null default 0.0000,
  dsp_estado text not null default 'ASIGNADO', -- 'ASIGNADO' | 'EN_CAMINO' | 'ENTREGADO' | 'FALLIDO'
  dsp_observaciones_coordinacion text,
  dsp_comprobante_entrega jsonb not null default '{}'::jsonb,
  dsp_detalle_despacho jsonb not null default '{}'::jsonb,
  dsp_creado_en timestamptz not null default now(),
  dsp_actualizado_en timestamptz not null default now()
);

create index idx_com_despacho_orden on comun_comercio.com_despacho_asignacion(dsp_orden_id, dsp_negocio);

-- ------------------------------------------------------------------------------
-- 8. HABILITACIÓN DE RLS EN EL 100% DE LAS TABLAS
-- ------------------------------------------------------------------------------

alter table comun_comercio.com_categoria enable row level security;
alter table comun_comercio.com_producto enable row level security;
alter table comun_comercio.com_variante enable row level security;
alter table comun_comercio.com_media enable row level security;
alter table comun_comercio.com_personalizacion_campo enable row level security;
alter table comun_comercio.com_producto_relacionado enable row level security;
alter table comun_comercio.com_insumo enable row level security;
alter table comun_comercio.com_receta enable row level security;
alter table comun_comercio.com_inventario enable row level security;
alter table comun_comercio.com_kardex enable row level security;
alter table comun_comercio.com_merma enable row level security;
alter table comun_comercio.com_proforma enable row level security;
alter table comun_comercio.com_proforma_item enable row level security;
alter table comun_comercio.com_suscripcion enable row level security;
alter table comun_comercio.com_convenio_empresa enable row level security;
alter table comun_comercio.com_beneficiario_empresa enable row level security;
alter table comun_comercio.com_billetera enable row level security;
alter table comun_comercio.com_billetera_movimiento enable row level security;
alter table comun_comercio.com_cupon enable row level security;
alter table comun_comercio.com_cupon_uso enable row level security;
alter table comun_comercio.com_proveedor_servicio enable row level security;
alter table comun_comercio.com_despacho_asignacion enable row level security;

-- ------------------------------------------------------------------------------
-- 9. POLÍTICAS DE RLS
-- ------------------------------------------------------------------------------

-- Vitrina Pública (Lectura anónima de catálogo activo)
create policy com_categoria_lectura_publica on comun_comercio.com_categoria
  for select using (ctg_activo = true);

create policy com_producto_lectura_publica on comun_comercio.com_producto
  for select using (pro_activo = true);

create policy com_variante_lectura_publica on comun_comercio.com_variante
  for select using (var_activo = true);

create policy com_media_lectura_publica on comun_comercio.com_media
  for select using (true);

create policy com_personalizacion_lectura_publica on comun_comercio.com_personalizacion_campo
  for select using (true);

create policy com_producto_relacionado_lectura_publica on comun_comercio.com_producto_relacionado
  for select using (true);

create policy com_cupon_lectura_publica on comun_comercio.com_cupon
  for select using (cup_activo = true);

-- Clientes: Consulta de sus datos propios
create policy com_billetera_cliente_select on comun_comercio.com_billetera
  for select using (wlt_usuario_id = auth.uid());

create policy com_billetera_movimiento_cliente_select on comun_comercio.com_billetera_movimiento
  for select using (
    exists (
      select 1 from comun_comercio.com_billetera
      where wlt_id = wlm_billetera_id and wlt_usuario_id = auth.uid()
    )
  );

create policy com_suscripcion_cliente_select on comun_comercio.com_suscripcion
  for select using (sub_cliente_id = auth.uid());

create policy com_cupon_uso_cliente_select on comun_comercio.com_cupon_uso
  for select using (cpu_usuario_id = auth.uid());

create policy com_proforma_cliente_select on comun_comercio.com_proforma
  for select using (prf_cliente_id = auth.uid());

create policy com_proforma_item_cliente_select on comun_comercio.com_proforma_item
  for select using (
    exists (
      select 1 from comun_comercio.com_proforma
      where prf_id = pfi_proforma_id and prf_cliente_id = auth.uid()
    )
  );

-- Personal Administrativo y Operativo (seg_fn_es_operador_o_admin_negocio)
create policy com_categoria_staff on comun_comercio.com_categoria
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ctg_negocio));

create policy com_producto_staff on comun_comercio.com_producto
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(pro_negocio));

create policy com_variante_staff on comun_comercio.com_variante
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(var_negocio));

create policy com_media_staff on comun_comercio.com_media
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(med_negocio));

create policy com_personalizacion_staff on comun_comercio.com_personalizacion_campo
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(pzc_negocio));

create policy com_producto_relacionado_staff on comun_comercio.com_producto_relacionado
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(prl_negocio));

create policy com_insumo_staff on comun_comercio.com_insumo
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ins_negocio));

create policy com_receta_staff on comun_comercio.com_receta
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(rec_negocio));

create policy com_inventario_staff on comun_comercio.com_inventario
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(inv_negocio));

create policy com_kardex_staff on comun_comercio.com_kardex
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(kar_negocio));

create policy com_merma_staff on comun_comercio.com_merma
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(mrm_negocio));

create policy com_proforma_staff on comun_comercio.com_proforma
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(prf_negocio));

create policy com_proforma_item_staff on comun_comercio.com_proforma_item
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(pfi_negocio));

create policy com_suscripcion_staff on comun_comercio.com_suscripcion
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(sub_negocio));

create policy com_convenio_staff on comun_comercio.com_convenio_empresa
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cve_negocio));

create policy com_beneficiario_staff on comun_comercio.com_beneficiario_empresa
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(bnf_negocio));

create policy com_billetera_staff on comun_comercio.com_billetera
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(wlt_negocio));

create policy com_billetera_movimiento_staff on comun_comercio.com_billetera_movimiento
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(wlm_negocio));

create policy com_cupon_staff on comun_comercio.com_cupon
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cup_negocio));

create policy com_cupon_uso_staff on comun_comercio.com_cupon_uso
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cpu_negocio));

create policy com_proveedor_staff on comun_comercio.com_proveedor_servicio
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(prv_negocio));

create policy com_despacho_staff on comun_comercio.com_despacho_asignacion
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(dsp_negocio));

-- ------------------------------------------------------------------------------
-- 10. TRIGGERS DE AUDITORÍA (aud_fn_auditar_tabla)
-- ------------------------------------------------------------------------------

create trigger trg_auditoria_com_categoria after insert or update or delete on comun_comercio.com_categoria for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_producto after insert or update or delete on comun_comercio.com_producto for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_variante after insert or update or delete on comun_comercio.com_variante for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_media after insert or update or delete on comun_comercio.com_media for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_personalizacion_campo after insert or update or delete on comun_comercio.com_personalizacion_campo for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_producto_relacionado after insert or update or delete on comun_comercio.com_producto_relacionado for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_insumo after insert or update or delete on comun_comercio.com_insumo for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_receta after insert or update or delete on comun_comercio.com_receta for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_inventario after insert or update or delete on comun_comercio.com_inventario for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_kardex after insert or update or delete on comun_comercio.com_kardex for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_merma after insert or update or delete on comun_comercio.com_merma for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_proforma after insert or update or delete on comun_comercio.com_proforma for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_proforma_item after insert or update or delete on comun_comercio.com_proforma_item for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_suscripcion after insert or update or delete on comun_comercio.com_suscripcion for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_convenio_empresa after insert or update or delete on comun_comercio.com_convenio_empresa for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_beneficiario_empresa after insert or update or delete on comun_comercio.com_beneficiario_empresa for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_billetera after insert or update or delete on comun_comercio.com_billetera for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_billetera_movimiento after insert or update or delete on comun_comercio.com_billetera_movimiento for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_cupon after insert or update or delete on comun_comercio.com_cupon for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_cupon_uso after insert or update or delete on comun_comercio.com_cupon_uso for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_proveedor_servicio after insert or update or delete on comun_comercio.com_proveedor_servicio for each row execute function comun_auditoria.aud_fn_auditar_tabla();
create trigger trg_auditoria_com_despacho_asignacion after insert or update or delete on comun_comercio.com_despacho_asignacion for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- ------------------------------------------------------------------------------
-- 11. PERMISOS Y CONCESIONES DE ESQUEMA (GRANTS)
-- ------------------------------------------------------------------------------

grant usage on schema comun_comercio to anon, authenticated, service_role;

-- Lectura para anon y authenticated en entidades públicas
grant select on comun_comercio.com_categoria, comun_comercio.com_producto,
                comun_comercio.com_variante, comun_comercio.com_media,
                comun_comercio.com_personalizacion_campo, comun_comercio.com_producto_relacionado,
                comun_comercio.com_cupon to anon, authenticated;

-- Permisos completos para authenticated (filtrado y protegido por RLS)
grant select, insert, update, delete on all tables in schema comun_comercio to authenticated;

-- Permisos de secuencias
grant usage, select on all sequences in schema comun_comercio to authenticated;
