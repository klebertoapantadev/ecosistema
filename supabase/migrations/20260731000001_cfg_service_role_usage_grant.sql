-- La Edge Function enviar-correo devolvia 500 al leer las credenciales SMTP:
-- tenia EXECUTE sobre cfg_fn_obtener_smtp_credenciales() pero no USAGE sobre
-- el esquema donde vive la funcion, asi que ni siquiera llegaba a llamarla.
--
-- El grant original de 20260727000003_comun_configuracion.sql solo incluia
-- anon y authenticated, porque entonces ninguna Edge Function tocaba este
-- esquema. Mismo caso -- y misma correccion -- que
-- 20260730000003_recuperacion_service_role_grant.sql hizo para comun_seguridad.
--
-- Regla que se deduce de haberlo repetido dos veces: conceder EXECUTE sobre una
-- funcion a service_role no sirve de nada si el esquema no le da USAGE. Van
-- juntos, siempre.

grant usage on schema comun_configuracion to service_role;
