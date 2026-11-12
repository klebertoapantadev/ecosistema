-- ==============================================================================
-- Migración: 20261112000002_ampliar_timeout_postgrest_aria.sql
-- Propósito:
--   Evitar que PostgREST cancele prematuramente a los 3 segundos (`anon`) u
--   8 segundos (`authenticated` / `authenticator`) las invocaciones a ARIA a
--   través de `comun_configuracion.cfg_fn_invocar_aria`, dado que en PostgreSQL
--   `set_config('statement_timeout', ...)` dentro del cuerpo PL/pgSQL no extiende
--   el temporizador ya iniciado por la sentencia externa cuando Mía ejecuta
--   herramientas MCP de catálogo (4s a 28s).
-- ==============================================================================

alter role anon set statement_timeout = '45s';
alter role authenticated set statement_timeout = '45s';
alter role authenticator set statement_timeout = '45s';

alter function comun_configuracion.cfg_fn_invocar_aria(text, text, text)
  set statement_timeout = '45s';

notify pgrst, 'reload config';

