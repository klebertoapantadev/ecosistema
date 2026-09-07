-- ==============================================================================
-- Migración: 20260906000004_comun_comercio_public_views.sql
-- Módulo: Vistas en esquema public para acceso PostgREST transparente
-- Cumple: ADR-0003, estándar multi-esquema y compatibilidad con PostgREST
-- ==============================================================================

-- 1. Exponer vistas en public hacia comun_comercio para compatibilidad PostgREST inmediata
create or replace view public.com_categoria as
  select * from comun_comercio.com_categoria;

create or replace view public.com_producto as
  select * from comun_comercio.com_producto;

create or replace view public.com_variante as
  select * from comun_comercio.com_variante;

create or replace view public.com_pasarela_configuracion as
  select * from comun_comercio.com_pasarela_configuracion;

create or replace view public.com_transaccion_pago as
  select * from comun_comercio.com_transaccion_pago;

-- 2. Concesión de permisos en las vistas públicas
grant select, insert, update, delete on public.com_categoria to anon, authenticated, service_role;
grant select, insert, update, delete on public.com_producto to anon, authenticated, service_role;
grant select, insert, update, delete on public.com_variante to anon, authenticated, service_role;
grant select, insert, update, delete on public.com_pasarela_configuracion to anon, authenticated, service_role;
grant select, insert, update, delete on public.com_transaccion_pago to anon, authenticated, service_role;
