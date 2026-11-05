-- Pruebas de la pasarela PLUX (20261104000001_comun_comercio_pasarela_plux.sql).
-- Se ejecuta con `supabase test db` (pgTAP, gobernanza/estandares/04-pruebas.md §4).
-- Todo dentro de una transacción que se deshace al final.
begin;
select plan(16);

-- ── Permisos: nadie fuera del webhook confirma pagos ni lee credenciales ─────
select ok(not has_function_privilege('authenticated', 'comun_comercio.com_fn_confirmar_pago_plux(text, jsonb)', 'execute'),
  'authenticated no puede confirmar pagos PLUX');
select ok(not has_function_privilege('anon', 'comun_comercio.com_fn_confirmar_pago_plux(text, jsonb)', 'execute'),
  'anon no puede confirmar pagos PLUX');
select ok(not has_function_privilege('authenticated', 'comun_comercio.com_fn_credenciales_webhook_plux(text)', 'execute'),
  'authenticated no puede leer las credenciales del webhook');
select ok(has_function_privilege('authenticated', 'comun_comercio.com_fn_preparar_pago_plux(text, uuid, jsonb)', 'execute'),
  'authenticated puede preparar un pago');
select ok(not has_column_privilege('authenticated', 'comun_comercio.com_pasarela_configuracion', 'psc_credenciales_privadas', 'select'),
  'authenticated no puede leer las credenciales privadas de una pasarela');

-- ── Visibilidad: una pasarela solo para probadores se oculta al resto ────────
-- Un usuario cualquiera (sin fila de superadmin ni correo en la lista).
select set_config('request.jwt.claims', json_build_object('sub', gen_random_uuid(), 'role', 'authenticated')::text, true);
set local role authenticated;

select ok(comun_comercio.com_fn_pasarela_visible('PRODUCCION', '{}'::jsonb),
  'en producción y sin restricción, la pasarela es para todos');
select ok(not comun_comercio.com_fn_pasarela_visible('PRUEBAS', '{}'::jsonb),
  'en pruebas la pasarela nunca es para todos');
select ok(not comun_comercio.com_fn_pasarela_visible('PRODUCCION', '{"visibilidad":"PROBADORES","probadores":"no-es-lista"}'::jsonb),
  'una lista de probadores mal formada no rompe ni abre la pasarela');
select ok(comun_comercio.com_fn_pasarela_visible('PRUEBAS', '{"visibilidad":"TODOS"}'::jsonb),
  'visibilidad TODOS explícita abre también un sandbox');

reset role;

-- Sin sesión no se prepara nada.
select set_config('request.jwt.claims', '{}', true);
select is(comun_comercio.com_fn_preparar_pago_plux('tranqi', gen_random_uuid(), '{}'::jsonb)->>'ok', 'false',
  'preparar un pago exige sesión');

-- ── Confirmación: idempotente y con cotejo de monto ──────────────────────────
insert into comun_comercio.com_producto (pro_id, pro_negocio, pro_nombre, pro_slug, pro_tipo)
values ('00000000-0000-4000-8000-000000000001', 'tranqi', 'Plan de prueba PLUX', 'plan-prueba-plux', 'SUSCRIPCION');
insert into comun_comercio.com_variante (var_id, var_negocio, var_producto_id, var_sku, var_nombre, var_precio,
  var_tipo_oferta, var_frecuencia_recurrencia)
values ('00000000-0000-4000-8000-000000000002', 'tranqi', '00000000-0000-4000-8000-000000000001',
  'PLUX-PRUEBA', 'Mensual', 20.00, 'RECURRENTE_MENSUAL', 'MENSUAL');

-- Dos pagos pendientes de $23 (20 + 15 % IVA), sin cliente: no crean suscripción.
insert into comun_comercio.com_transaccion_pago (pag_negocio, pag_pasarela, pag_identificador_cliente, pag_estado,
  pag_monto_total, pag_detalle_transaccion)
values
  ('tranqi', 'PLUX', 'TRQ-PLX-000000000001', 'PENDIENTE', 23.00, '{"variante_id":"00000000-0000-4000-8000-000000000002"}'),
  ('tranqi', 'PLUX', 'TRQ-PLX-000000000002', 'PENDIENTE', 23.00, '{"variante_id":"00000000-0000-4000-8000-000000000002"}');

select is(comun_comercio.com_fn_confirmar_pago_plux('tranqi',
    '{"extras":"TRQ-PLX-000000000001","state":"PAGADO","amount":23,"id_transaccion":"t-1","token":"960744","cardIssuer":"visa","cardType":"credit","cardInfo":"4540 63XX XXXX 8783"}')->>'estado',
  'APROBADO', 'un webhook PAGADO con el monto correcto aprueba');

select is((select pag_tarjeta_ultimos_digitos || '/' || pag_tarjeta_tipo from comun_comercio.com_transaccion_pago
           where pag_identificador_cliente = 'TRQ-PLX-000000000001'),
  '8783/CREDITO', 'guarda los datos de la tarjeta del webhook');

select is(comun_comercio.com_fn_confirmar_pago_plux('tranqi',
    '{"extras":"TRQ-PLX-000000000001","state":"RECHAZADO","amount":23,"id_transaccion":"t-1"}')->>'repetido',
  'true', 'un reintento sobre un pago resuelto no lo cambia');

select is((select pag_estado from comun_comercio.com_transaccion_pago where pag_identificador_cliente = 'TRQ-PLX-000000000001'),
  'APROBADO', 'el pago sigue aprobado tras el reintento');

select is(comun_comercio.com_fn_confirmar_pago_plux('tranqi',
    '{"extras":"TRQ-PLX-000000000002","state":"PAGADO","amount":2.30,"id_transaccion":"t-2"}')->>'motivo',
  'MONTO_DISTINTO', 'un monto distinto al fijado no aprueba');

select is(comun_comercio.com_fn_confirmar_pago_plux('tranqi', '{"extras":"TRQ-PLX-FFFFFFFFFFFF","state":"PAGADO","amount":23}')->>'motivo',
  'PAGO_DESCONOCIDO', 'un pago que no es nuestro no toca nada');

select * from finish();
rollback;
