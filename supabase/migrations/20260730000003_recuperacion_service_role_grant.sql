-- Fix: mismo patron de bug ya visto dos veces en el proyecto (tranqui_legal,
-- comun_auditoria) -- service_role bypassea RLS pero NO los grants de
-- esquema/tabla, esos son independientes. La Edge Function
-- restablecer-contrasena usaba service_role y fallaba con "permission
-- denied for schema comun_seguridad" (42501) al leer seg_recuperacion_correo.
grant usage on schema comun_seguridad to service_role;
grant select, update on comun_seguridad.seg_recuperacion_correo to service_role;
