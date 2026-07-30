-- Fix: tercera vez que aparece este patron (tranqui_legal, comun_auditoria,
-- ahora comun_seguridad). seg_fn_solicitar_recuperacion es la PRIMERA
-- funcion de este esquema que necesita ser invocable por un usuario sin
-- sesion (rol anon) -- hasta ahora todo en comun_seguridad requeria login
-- (rol authenticated, que ya tenia USAGE). El GRANT EXECUTE sobre la
-- funcion no alcanza: PostgREST necesita ademas USAGE sobre el esquema
-- para poder resolver/enrutar la funcion, independiente de que el cuerpo
-- sea security definer.
grant usage on schema comun_seguridad to anon;
