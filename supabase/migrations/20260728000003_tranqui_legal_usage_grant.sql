-- Fix: la migracion 20260728000002 otorgo SELECT/INSERT por tabla en
-- tranqui_legal pero olvido el GRANT USAGE ON SCHEMA -- sin el, esos grants
-- por tabla no sirven de nada (Postgres exige USAGE en el esquema para
-- siquiera resolver los objetos dentro de el). Sintoma: has_table_privilege
-- devolvia true pero has_schema_privilege false, y PostgREST fallaba con
-- 42501 "permission denied for schema tranqui_legal" para el rol
-- authenticated real (no solo anon, que nunca debe tener acceso).
grant usage on schema tranqui_legal to authenticated;
