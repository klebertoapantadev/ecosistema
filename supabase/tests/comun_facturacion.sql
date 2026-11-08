-- Pruebas de la facturación electrónica SRI (20261108000001_comun_facturacion.sql).
-- Se ejecuta con `supabase test db` (pgTAP, gobernanza/estandares/04-pruebas.md §4).
-- Todo dentro de una transacción que se deshace al final.
begin;
select plan(59);

-- ── Usuarios de prueba ───────────────────────────────────────────────────────
-- admin y operador de tranqi, operador de fastfix, superadmin y un cliente.
insert into auth.users (id, email) values
  ('f0000000-0000-4000-8000-000000000001', 'admin.fac@prueba.ec'),
  ('f0000000-0000-4000-8000-000000000002', 'oper.fac@prueba.ec'),
  ('f0000000-0000-4000-8000-000000000003', 'otro.fac@prueba.ec'),
  ('f0000000-0000-4000-8000-000000000004', 'super.fac@prueba.ec'),
  ('f0000000-0000-4000-8000-000000000005', 'cliente.fac@prueba.ec')
on conflict do nothing;
insert into comun_seguridad.seg_usuario (usu_id, usu_correo, usu_superadmin_plataforma) values
  ('f0000000-0000-4000-8000-000000000001', 'admin.fac@prueba.ec', false),
  ('f0000000-0000-4000-8000-000000000002', 'oper.fac@prueba.ec', false),
  ('f0000000-0000-4000-8000-000000000003', 'otro.fac@prueba.ec', false),
  ('f0000000-0000-4000-8000-000000000004', 'super.fac@prueba.ec', true),
  ('f0000000-0000-4000-8000-000000000005', 'cliente.fac@prueba.ec', false)
on conflict (usu_id) do update set usu_superadmin_plataforma = excluded.usu_superadmin_plataforma;
delete from comun_seguridad.seg_membresia where mem_usuario_id::text like 'f0000000-0000-4000-8000-00000000000%';
insert into comun_seguridad.seg_membresia (mem_id, mem_usuario_id, mem_negocio, mem_rol, mem_estado) values
  ('f1000000-0000-4000-8000-000000000001', 'f0000000-0000-4000-8000-000000000001', 'tranqi', 'CLIENTE', 'ACTIVO'),
  ('f1000000-0000-4000-8000-000000000002', 'f0000000-0000-4000-8000-000000000002', 'tranqi', 'CLIENTE', 'ACTIVO'),
  ('f1000000-0000-4000-8000-000000000003', 'f0000000-0000-4000-8000-000000000003', 'fastfix', 'CLIENTE', 'ACTIVO'),
  ('f1000000-0000-4000-8000-000000000005', 'f0000000-0000-4000-8000-000000000005', 'tranqi', 'CLIENTE', 'ACTIVO');
insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
select m, (select per_id from comun_seguridad.seg_perfil where per_clave = p)
  from (values ('f1000000-0000-4000-8000-000000000001'::uuid, 'ADMINISTRADOR'),
               ('f1000000-0000-4000-8000-000000000002'::uuid, 'OPERADOR'),
               ('f1000000-0000-4000-8000-000000000003'::uuid, 'OPERADOR')) as v(m, p);

-- Sesión simulada: usuario y nivel de MFA en el JWT.
create function pg_temp.como(p_usuario uuid, p_aal text default 'aal1') returns void language sql as $$
  select set_config('request.jwt.claims',
    json_build_object('sub', p_usuario, 'role', 'authenticated', 'aal', p_aal)::text, true);
$$;

-- ── Permisos: nadie fuera de la Edge Function toca la cola ni los secretos ──
select ok(not has_function_privilege('authenticated', 'comun_facturacion.fac_fn_tomar_lote(int)', 'execute'),
  'authenticated no reclama comprobantes de la cola');
select ok(not has_function_privilege('authenticated', 'comun_facturacion.fac_fn_obtener_certificado(uuid)', 'execute'),
  'authenticated no lee el .p12 ni su contraseña');
select ok(not has_function_privilege('authenticated', 'comun_facturacion.fac_fn_registrar_certificado(text, uuid, jsonb, text, text, boolean)', 'execute'),
  'authenticated no registra certificados sin pasar por la Edge Function');
select ok(not has_function_privilege('authenticated', 'comun_facturacion.fac_fn_registrar_resultado(uuid, jsonb, text, jsonb)', 'execute'),
  'authenticated no escribe resultados del SRI');
select ok(not has_function_privilege('authenticated', 'comun_facturacion.fac_fn_emitir_interno(uuid)', 'execute'),
  'authenticated no emite saltándose la comprobación de rol');
select ok(not has_function_privilege('anon', 'comun_facturacion.fac_fn_crear_comprobante(text, text, jsonb, jsonb, jsonb, jsonb, uuid, text, uuid, boolean)', 'execute'),
  'anon no crea comprobantes');
select ok(not has_table_privilege('authenticated', 'comun_facturacion.fac_comprobante', 'insert')
          and not has_table_privilege('authenticated', 'comun_facturacion.fac_comprobante', 'update'),
  'authenticated no escribe directamente en fac_comprobante');

-- ── Utilidades: clave de acceso (vectores reales de la ficha) y cédula ───────
select is(comun_facturacion.fac_fn_clave_acceso('2024-11-11', '01', '0993381762001', 1::smallint, '002', '001', 396, '12345678'),
  '1111202401099338176200110020010000003961234567815', 'clave de acceso: vector 1 de la ficha');
select is(comun_facturacion.fac_fn_clave_acceso('2024-11-02', '01', '0503061798001', 2::smallint, '001', '002', 67, '73009952'),
  '0211202401050306179800120010020000000677300995216', 'clave de acceso: vector 4 de la ficha');
select ok(comun_facturacion.fac_fn_cedula_valida('1710034065') and not comun_facturacion.fac_fn_cedula_valida('1710034066'),
  'cédula: dígito verificador');

-- ── Emisor: solo un ADMINISTRADOR real lo configura ──────────────────────────
select pg_temp.como('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select throws_like($$select comun_facturacion.fac_fn_guardar_emisor('tranqi', '{"ruc":"0993381762001"}')$$,
  'No autorizado%', 'un OPERADOR no configura el emisor (aunque seg_fn_es_admin_negocio lo dejaría)');
reset role;

select pg_temp.como('f0000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select comun_facturacion.fac_fn_guardar_emisor('tranqi', '{
  "ruc":"0993381762001","razon_social":"TRANQI S.A.S.","direccion_matriz":"Quito","activo":true,
  "obligado_contabilidad":true}')$$, 'el ADMINISTRADOR configura el emisor');
select throws_like($$select comun_facturacion.fac_fn_guardar_emisor('tranqi', '{"ruc":"099338176200","razon_social":"X","direccion_matriz":"Q"}')$$,
  '%fac_emisor_emi_ruc_check%', 'un RUC con formato inválido se rechaza');
reset role;

-- ── Certificado: lo registra la Edge Function en nombre de un admin ──────────
select set_config('request.jwt.claims', '{}', true);
select throws_like($$select comun_facturacion.fac_fn_registrar_certificado('tranqi', 'f0000000-0000-4000-8000-000000000002',
  '{"huella_sha1":"AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA","valido_hasta":"2099-01-01"}', 'cDEy', 'clave')$$,
  'No autorizado%', 'no se registra un certificado en nombre de un operador');
select ok(comun_facturacion.fac_fn_registrar_certificado('tranqi', 'f0000000-0000-4000-8000-000000000001',
  '{"titular":"TRANQI","identificacion":"0993381762001","emisor":"CA PRUEBAS","serial":"8F3A21",
    "huella_sha1":"0123456789ABCDEF0123456789ABCDEF01234567","valido_desde":"2026-01-01",
    "valido_hasta":"2099-01-01","cadena_verificada":true}', 'cDEyLWJhc2U2NA==', 'clave secreta') is not null,
  'el certificado de un admin se registra');
select ok((select emi_certificado_id is not null from comun_facturacion.fac_emisor where emi_negocio = 'tranqi'),
  'el certificado queda asignado al emisor');
select is((select clave from comun_facturacion.fac_fn_obtener_certificado(
    (select emi_certificado_id from comun_facturacion.fac_emisor where emi_negocio = 'tranqi'))),
  'clave secreta', 'service_role descifra la contraseña desde Vault');
select ok((select cer_p12_secreto_id is not null and cer_clave_secreto_id is not null
             from comun_facturacion.fac_certificado where cer_negocio = 'tranqi'),
  'la tabla solo guarda los uuid de los secretos');

-- ── RLS: otro negocio no ve nada; un operador no ve certificados ─────────────
select pg_temp.como('f0000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*) from comun_facturacion.fac_emisor)::int, 0, 'un operador de fastfix no ve el emisor de tranqi');
select is((select count(*) from comun_facturacion.fac_certificado)::int, 0, 'un operador de fastfix no ve certificados de tranqi');
reset role;
select pg_temp.como('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*) from comun_facturacion.fac_emisor)::int, 1, 'el operador de tranqi ve su emisor');
select is((select count(*) from comun_facturacion.fac_certificado)::int, 0, 'el operador de tranqi no ve los certificados');

-- ── Emisión: numeración atómica y clave de acceso ────────────────────────────
create temp table ids (nombre text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'f1', comun_facturacion.fac_fn_crear_comprobante('tranqi', '01',
  '{"tipo_identificacion":"05","identificacion":"1710034065","razon_social":"Maria Perez","correo":"maria@ejemplo.com"}',
  '[{"codigo":"PLAN-1","descripcion":"Plan mensual","cantidad":1,"precio_unitario":10,"codigo_iva":"4"}]',
  '[{"forma_pago":"19","total":null}]', '[]', null, null, 'f0000000-0000-4000-8000-000000000005', true);
insert into ids select 'f2', comun_facturacion.fac_fn_crear_comprobante('tranqi', '01',
  '{"tipo_identificacion":"07"}',
  '[{"codigo":"C-1","descripcion":"Consulta","cantidad":1,"precio_unitario":20,"codigo_iva":"4"}]', '[]', '[]', null, null, null, true);
select is((select cmp_estado || '/' || cmp_numero || '/' || cmp_ambiente from comun_facturacion.fac_comprobante
            where cmp_id = (select id from ids where nombre = 'f1')), 'PENDIENTE/1/1', 'la primera factura sale con el número 1 en pruebas');
select is((select cmp_numero from comun_facturacion.fac_comprobante where cmp_id = (select id from ids where nombre = 'f2')),
  2::bigint, 'la segunda, con el 2');
select ok((select comun_facturacion.fac_fn_digito_verificador(left(cmp_clave_acceso, 48))::text = right(cmp_clave_acceso, 1)
             from comun_facturacion.fac_comprobante where cmp_id = (select id from ids where nombre = 'f1')),
  'la clave de acceso lleva su dígito verificador');
select is((select cmp_comprador ->> 'razon_social' from comun_facturacion.fac_comprobante where cmp_id = (select id from ids where nombre = 'f2')),
  'CONSUMIDOR FINAL', 'consumidor final se normaliza');
select throws_like($$select comun_facturacion.fac_fn_crear_comprobante('tranqi', '01',
  '{"tipo_identificacion":"05","identificacion":"1710034066","razon_social":"X"}',
  '[{"codigo":"A","descripcion":"A","cantidad":1,"precio_unitario":1,"codigo_iva":"4"}]')$$,
  'Cedula invalida%', 'una cédula inválida no llega al SRI');
select throws_like(format('select comun_facturacion.fac_fn_reintentar(%L)', (select id from ids where nombre = 'f1')),
  'Solo se reintenta%', 'no se reintenta un comprobante que ya está en la cola');
reset role;

select pg_temp.como('f0000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*) from comun_facturacion.fac_comprobante)::int, 0, 'fastfix no ve las facturas de tranqi');
select throws_like(format('select comun_facturacion.fac_fn_emitir(%L)', (select id from ids where nombre = 'f1')),
  'No autorizado%', 'fastfix no emite comprobantes de tranqi');
reset role;

select pg_temp.como('f0000000-0000-4000-8000-000000000005');
set local role authenticated;
select is((select count(*) from comun_facturacion.fac_comprobante)::int, 0, 'el cliente no ve su factura mientras no esté autorizada');
reset role;

-- ── Worker: cola con SKIP LOCKED y registro de resultados ────────────────────
select set_config('request.jwt.claims', '{}', true);
select is((select count(*) from comun_facturacion.fac_fn_tomar_lote(10))::int, 2, 'el worker reclama las dos facturas pendientes');
select is((select count(*) from comun_facturacion.fac_fn_tomar_lote(10))::int, 0, 'y no las vuelve a entregar mientras están bloqueadas');
select lives_ok(format($$select comun_facturacion.fac_fn_registrar_resultado(%L, '{"estado":"AUTORIZADO",
  "numero_autorizacion":"1111","fecha_autorizacion":"2026-11-08T10:00:00-05:00","importe_total":"11.50",
  "lineas":[{"orden":1,"base":"10.00","valor_iva":"1.50"}]}', 'autorizado')$$, (select id from ids where nombre = 'f1')),
  'el worker registra la autorización');
select is((select lin_valor_iva from comun_facturacion.fac_comprobante_linea
            where lin_comprobante_id = (select id from ids where nombre = 'f1')), 1.50::numeric(12,2),
  'y los importes calculados de cada línea');
select throws_like(format($$select comun_facturacion.fac_fn_registrar_resultado(%L, '{"estado":"ERROR"}')$$, (select id from ids where nombre = 'f1')),
  '%ya no esta en la cola%', 'un comprobante autorizado ya no cambia de estado desde el worker');

select pg_temp.como('f0000000-0000-4000-8000-000000000005');
set local role authenticated;
select is((select count(*) from comun_facturacion.fac_comprobante)::int, 1, 'el cliente ve su factura autorizada');
reset role;

-- Con la URL y la clave en Vault, hay trabajo pendiente (f2) y el despertador llama a la Edge Function.
select vault.create_secret('https://ejemplo.supabase.co/functions/v1/facturacion-sri', 'facturacion_funcion_url');
select vault.create_secret('clave-compartida', 'facturacion_funcion_clave');
create temp table cola_antes as select count(*) as n from net.http_request_queue;
select comun_facturacion.fac_fn_despertar_worker();
select is((select count(*) from net.http_request_queue) - (select n from cola_antes), 1::bigint,
  'el despertador encola una llamada a la Edge Function si hay comprobantes vencidos');

-- ── Nota de crédito ─────────────────────────────────────────────────────────
select pg_temp.como('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select lives_ok(format($$select comun_facturacion.fac_fn_crear_comprobante('tranqi', '04', null,
  '[{"codigo":"PLAN-1","descripcion":"Devolucion","cantidad":1,"precio_unitario":10,"codigo_iva":"4"}]',
  '[]', '[]', %L, 'Servicio no prestado')$$, (select id from ids where nombre = 'f1')),
  'nota de crédito sobre una factura autorizada');
select throws_like(format($$select comun_facturacion.fac_fn_crear_comprobante('tranqi', '04', null,
  '[{"codigo":"A","descripcion":"A","cantidad":1,"precio_unitario":1,"codigo_iva":"4"}]', '[]', '[]', %L, 'x')$$,
  (select id from ids where nombre = 'f2')),
  'La nota de credito debe modificar una factura autorizada%', 'no sobre una factura sin autorizar');
reset role;

-- ── Factura automática al aprobarse un pago ─────────────────────────────────
select pg_temp.como('f0000000-0000-4000-8000-000000000001');
set local role authenticated;
select lives_ok($$select comun_facturacion.fac_fn_guardar_emisor('tranqi', '{
  "ruc":"0993381762001","razon_social":"TRANQI S.A.S.","direccion_matriz":"Quito","activo":true,
  "emision_automatica":true}')$$, 'el admin activa la emisión automática');
reset role;
select set_config('request.jwt.claims', '{}', true);

insert into comun_comercio.com_transaccion_pago (pag_id, pag_negocio, pag_pasarela, pag_identificador_cliente, pag_estado,
  pag_monto_total, pag_monto_con_iva, pag_monto_iva, pag_cliente_id, pag_titular_email, pag_detalle_transaccion)
values
  ('f2000000-0000-4000-8000-000000000001', 'tranqi', 'PAYPHONE', 'FAC-PRUEBA-1', 'PENDIENTE', 23.00, 20.00, 3.00,
   'f0000000-0000-4000-8000-000000000005', 'cliente.fac@prueba.ec',
   '{"nombre_servicio":"Plan Amparo Familiar","datos_facturacion":{"tipo_identificacion":"cedula",
     "identificacion":"1710034065","razon_social":"Cliente Fac","correo_facturacion":"fac@ejemplo.com"}}'),
  ('f2000000-0000-4000-8000-000000000002', 'tranqi', 'PAYPHONE', 'FAC-PRUEBA-2', 'PENDIENTE', 23.00, 20.00, 3.00,
   null, null, '{"datos_facturacion":{"tipo_identificacion":"cedula","identificacion":"1710034066","razon_social":"X"}}'),
  ('f2000000-0000-4000-8000-000000000003', 'tranqi', 'PAYPHONE', 'FAC-PRUEBA-3', 'PENDIENTE', 80.00, 69.57, 10.43,
   null, null, '{}');
update comun_comercio.com_transaccion_pago set pag_estado = 'APROBADO'
 where pag_id in ('f2000000-0000-4000-8000-000000000001', 'f2000000-0000-4000-8000-000000000002',
                  'f2000000-0000-4000-8000-000000000003');

select is((select cmp_estado || '/' || (cmp_comprador ->> 'tipo_identificacion') from comun_facturacion.fac_comprobante
            where cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000001'),
  'PENDIENTE/05', 'un pago aprobado genera y emite su factura con los datos de facturación del checkout');
select is((select lin_precio_unitario || '/' || lin_codigo_iva || '/' || lin_descripcion from comun_facturacion.fac_comprobante_linea l
             join comun_facturacion.fac_comprobante c on c.cmp_id = l.lin_comprobante_id
            where c.cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000001'),
  '20.000000/4/Plan Amparo Familiar', 'con la base gravada tal como se cobró');
select ok(not exists (select 1 from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000002')
          and exists (select 1 from comun_facturacion.fac_evento where evt_tipo = 'facturacion_pago_fallida'
                       and evt_detalle_evento ->> 'pago' = 'f2000000-0000-4000-8000-000000000002')
          and (select pag_estado from comun_comercio.com_transaccion_pago where pag_id = 'f2000000-0000-4000-8000-000000000002') = 'APROBADO',
  'datos de facturación inválidos: sin factura, con evento y el pago sigue aprobado');
select is((select cmp_estado from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000003'),
  'BORRADOR', 'consumidor final por encima de 50 USD queda en borrador');
update comun_comercio.com_transaccion_pago set pag_estado = 'REVERSADO' where pag_id = 'f2000000-0000-4000-8000-000000000001';
update comun_comercio.com_transaccion_pago set pag_estado = 'APROBADO' where pag_id = 'f2000000-0000-4000-8000-000000000001';
select is((select count(*) from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000001')::int,
  1, 'un pago no se factura dos veces');

-- ── Paso a producción: superadmin + admin con MFA + factura autorizada en pruebas ──
select pg_temp.como('f0000000-0000-4000-8000-000000000001', 'aal1');
set local role authenticated;
select throws_like($$select comun_facturacion.fac_fn_cambiar_ambiente('tranqi', 2::smallint)$$, '%MFA%',
  'sin MFA no se pasa a producción');
reset role;
select pg_temp.como('f0000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select throws_like($$select comun_facturacion.fac_fn_cambiar_ambiente('tranqi', 2::smallint)$$, 'Produccion no habilitada%',
  'sin la habilitación del superadmin tampoco');
select throws_like($$select comun_facturacion.fac_fn_habilitar_produccion('tranqi', true)$$, 'No autorizado%',
  'el admin del negocio no se habilita producción a sí mismo');
reset role;
select pg_temp.como('f0000000-0000-4000-8000-000000000004');
set local role authenticated;
select lives_ok($$select comun_facturacion.fac_fn_habilitar_produccion('tranqi', true)$$, 'el superadmin habilita producción');
reset role;
select pg_temp.como('f0000000-0000-4000-8000-000000000001', 'aal2');
set local role authenticated;
select lives_ok($$select comun_facturacion.fac_fn_cambiar_ambiente('tranqi', 2::smallint)$$,
  'con MFA, habilitación, certificado vigente y una factura autorizada en pruebas, pasa a producción');
reset role;
select set_config('request.jwt.claims', '{}', true);

-- Con el emisor en producción, un pago de la pasarela PLUX en sandbox no se factura.
insert into comun_comercio.com_transaccion_pago (pag_id, pag_negocio, pag_pasarela, pag_identificador_cliente, pag_estado,
  pag_monto_total, pag_monto_con_iva, pag_monto_iva, pag_detalle_transaccion)
values ('f2000000-0000-4000-8000-000000000004', 'tranqi', 'PLUX', 'FAC-PRUEBA-4', 'PENDIENTE', 23.00, 20.00, 3.00, '{}');
update comun_comercio.com_transaccion_pago set pag_estado = 'APROBADO' where pag_id = 'f2000000-0000-4000-8000-000000000004';
select ok(not exists (select 1 from comun_facturacion.fac_comprobante where cmp_transaccion_pago_id = 'f2000000-0000-4000-8000-000000000004')
          and exists (select 1 from comun_facturacion.fac_evento where evt_tipo = 'pago_de_prueba_no_facturado'),
  'un pago de sandbox no genera una factura real');

select pg_temp.como('f0000000-0000-4000-8000-000000000004');
set local role authenticated;
select lives_ok($$select comun_facturacion.fac_fn_habilitar_produccion('tranqi', false)$$, 'retirar la habilitación…');
reset role;
select is((select emi_ambiente from comun_facturacion.fac_emisor where emi_negocio = 'tranqi'), 1::smallint,
  '…devuelve el emisor a pruebas');

-- ── Numeración previa, anulación y Storage ──────────────────────────────────
select pg_temp.como('f0000000-0000-4000-8000-000000000001');
set local role authenticated;
select throws_like($$select comun_facturacion.fac_fn_fijar_secuencial('tranqi', 1::smallint, '01', 1)$$,
  'La numeracion solo puede avanzar%', 'la numeración no retrocede');
select throws_like(format('select comun_facturacion.fac_fn_registrar_anulacion(%L, %L)', (select id from ids where nombre = 'f1'), ''),
  'Falta el numero de solicitud%', 'anular exige el número de solicitud del SRI');
select lives_ok(format('select comun_facturacion.fac_fn_registrar_anulacion(%L, %L)', (select id from ids where nombre = 'f1'), 'SRI-123'),
  'el admin registra la anulación hecha en SRI en Línea');
reset role;

insert into storage.objects (bucket_id, name) values ('facturacion', 'tranqi/1/2026/prueba.xml');
select pg_temp.como('f0000000-0000-4000-8000-000000000002');
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'facturacion')::int, 1,
  'el operador de tranqi lee los XML de su negocio');
reset role;
select pg_temp.como('f0000000-0000-4000-8000-000000000003');
set local role authenticated;
select is((select count(*) from storage.objects where bucket_id = 'facturacion')::int, 0,
  'fastfix no lee los XML de tranqi');
reset role;

select * from finish();
rollback;
