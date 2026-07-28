-- Fix: comun_auditoria nunca tuvo GRANT USAGE ON SCHEMA para authenticated
-- -- pasaba desapercibido porque hasta ahora solo aud_fn_auditar_tabla()
-- (SECURITY DEFINER) escribia ahi, nunca un cliente autenticado leia
-- directo. La vista de auditoria de socios (TRQ-001) es el primer lector
-- real via PostgREST, y goteo "permission denied for schema comun_auditoria".
-- Mismo patron de bug que 20260728000003 (tranqui_legal).
grant usage on schema comun_auditoria to authenticated;
