-- ==============================================================================
-- Migración: 20260905000003_comun_comercio_soft_delete.sql
-- Corrige: incumplimiento del estándar de nomenclatura en comun_comercio.
-- ==============================================================================
--
-- 20260905000001 creo 25 tablas con RLS y trigger de auditoria correctos, pero
-- sin una sola columna de borrado logico. El estandar
-- (gobernanza/estandares/00-nomenclatura-base-datos.md §1) exige
-- `{prefijo}eliminado_en timestamptz` en toda tabla de negocio y dice, literal:
-- "No hay borrado fisico de filas de negocio". Tambien exige los dos
-- timestamps, y varias tablas se quedaron sin `actualizado_en` o sin
-- `creado_en`.
--
-- Paso desapercibido porque .github/workflows/validar-convenciones.yml es
-- todavia un placeholder que solo ejecuta un echo: hoy nada valida esto en CI.
--
-- Añadir la columna sin quitar el permiso de DELETE dejaria un soft delete
-- decorativo -- el grant de 20260905000001 da `delete` sobre todas las tablas
-- del esquema a `authenticated`. Se revoca. Ninguna app consume todavia
-- comun_comercio, asi que no rompe nada, y a partir de aqui dar de baja una
-- fila es marcar `eliminado_en`, no borrarla.

-- ============ 1. Columnas de tiempo que faltaban ============

alter table comun_comercio.com_categoria
  add column if not exists ctg_eliminado_en timestamptz;
alter table comun_comercio.com_producto
  add column if not exists pro_eliminado_en timestamptz;
alter table comun_comercio.com_producto_categoria
  add column if not exists pct_actualizado_en timestamptz not null default now(),
  add column if not exists pct_eliminado_en timestamptz;
alter table comun_comercio.com_variante
  add column if not exists var_eliminado_en timestamptz;
alter table comun_comercio.com_media
  add column if not exists med_actualizado_en timestamptz not null default now(),
  add column if not exists med_eliminado_en timestamptz;
alter table comun_comercio.com_personalizacion_campo
  add column if not exists pzc_actualizado_en timestamptz not null default now(),
  add column if not exists pzc_eliminado_en timestamptz;
alter table comun_comercio.com_producto_relacionado
  add column if not exists prl_actualizado_en timestamptz not null default now(),
  add column if not exists prl_eliminado_en timestamptz;
alter table comun_comercio.com_insumo
  add column if not exists ins_eliminado_en timestamptz;
alter table comun_comercio.com_receta
  add column if not exists rec_actualizado_en timestamptz not null default now(),
  add column if not exists rec_eliminado_en timestamptz;
alter table comun_comercio.com_inventario
  add column if not exists inv_creado_en timestamptz not null default now(),
  add column if not exists inv_eliminado_en timestamptz;
alter table comun_comercio.com_kardex
  add column if not exists kar_actualizado_en timestamptz not null default now(),
  add column if not exists kar_eliminado_en timestamptz;
alter table comun_comercio.com_merma
  add column if not exists mrm_actualizado_en timestamptz not null default now(),
  add column if not exists mrm_eliminado_en timestamptz;
alter table comun_comercio.com_proforma
  add column if not exists prf_eliminado_en timestamptz;
alter table comun_comercio.com_proforma_item
  add column if not exists pfi_creado_en timestamptz not null default now(),
  add column if not exists pfi_actualizado_en timestamptz not null default now(),
  add column if not exists pfi_eliminado_en timestamptz;
alter table comun_comercio.com_pasarela_configuracion
  add column if not exists psc_eliminado_en timestamptz;
alter table comun_comercio.com_transaccion_pago
  add column if not exists pag_eliminado_en timestamptz;
alter table comun_comercio.com_suscripcion
  add column if not exists sub_eliminado_en timestamptz;
alter table comun_comercio.com_convenio_empresa
  add column if not exists cve_actualizado_en timestamptz not null default now(),
  add column if not exists cve_eliminado_en timestamptz;
alter table comun_comercio.com_beneficiario_empresa
  add column if not exists bnf_actualizado_en timestamptz not null default now(),
  add column if not exists bnf_eliminado_en timestamptz;
alter table comun_comercio.com_billetera
  add column if not exists wlt_creado_en timestamptz not null default now(),
  add column if not exists wlt_eliminado_en timestamptz;
alter table comun_comercio.com_billetera_movimiento
  add column if not exists wlm_actualizado_en timestamptz not null default now(),
  add column if not exists wlm_eliminado_en timestamptz;
alter table comun_comercio.com_cupon
  add column if not exists cup_actualizado_en timestamptz not null default now(),
  add column if not exists cup_eliminado_en timestamptz;
alter table comun_comercio.com_cupon_uso
  add column if not exists cpu_actualizado_en timestamptz not null default now(),
  add column if not exists cpu_eliminado_en timestamptz;
alter table comun_comercio.com_proveedor_servicio
  add column if not exists prv_eliminado_en timestamptz;
alter table comun_comercio.com_despacho_asignacion
  add column if not exists dsp_eliminado_en timestamptz;

-- ============ 2. El borrado fisico deja de estar disponible ============
-- El grant original era `grant select, insert, update, delete on all tables`.
-- Se conserva todo menos el delete.
revoke delete on all tables in schema comun_comercio from authenticated;

-- ============ 3. Indices parciales donde el filtro va a doler ============
-- Los indices de 20260905000001 no excluyen filas dadas de baja. Se añaden
-- parciales en los caminos calientes: vitrina publica y consulta de pagos.
create index if not exists idx_com_producto_vivo on comun_comercio.com_producto (pro_negocio, pro_activo) where pro_eliminado_en is null;
create index if not exists idx_com_variante_viva on comun_comercio.com_variante (var_producto_id, var_activo) where var_eliminado_en is null;
create index if not exists idx_com_categoria_viva on comun_comercio.com_categoria (ctg_negocio, ctg_activo) where ctg_eliminado_en is null;
create index if not exists idx_com_pago_vivo on comun_comercio.com_transaccion_pago (pag_negocio, pag_estado) where pag_eliminado_en is null;
create index if not exists idx_com_suscripcion_viva on comun_comercio.com_suscripcion (sub_cliente_id, sub_negocio) where sub_eliminado_en is null;
