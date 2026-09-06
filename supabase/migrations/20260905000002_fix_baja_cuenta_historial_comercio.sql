-- ==============================================================================
-- Migración: 20260905000002_fix_baja_cuenta_historial_comercio.sql
-- Corrige: PLT-012 (baja de cuenta) frente a la llegada de comun_comercio.
-- ==============================================================================
--
-- seg_fn_eliminar_cuenta() vigilaba `comun_facturacion.fac_transaccion_pago`
-- como valvula para detectar historial transaccional. Esa tabla sigue sin
-- existir, pero desde 20260905000001 SI hay historial real, en otro sitio:
-- comun_comercio.com_transaccion_pago. La valvula miraba al esquema
-- equivocado, asi que la funcion no lo veia y seguia intentando el hard delete.
--
-- Que pasaba en la practica, y son dos casos distintos:
--
--   A. Usuario CON pagos, suscripcion o proforma. `delete from auth.users`
--      cascadea a seg_usuario y choca contra las FK de comun_comercio que
--      apuntan a el sin ON DELETE (NO ACTION por defecto). PostgreSQL aborta
--      la transaccion entera: no se borra nada, pero el usuario recibe un
--      error de clave foranea ininteligible en vez del mensaje que PLT-012
--      promete. La baja queda rota, no silenciosamente mal.
--
--   B. Usuario SIN nada de eso pero CON billetera. Aqui no hay ninguna FK que
--      choque, asi que el delete si prospera -- y com_billetera.wlt_usuario_id
--      era `on delete cascade`, de modo que la billetera y su saldo de bono de
--      convenio desaparecian en silencio. Este es el caso que de verdad
--      perdia datos.
--
-- Esta migracion hace tres cosas:
--   A. Alinea las FK de comun_comercio hacia seg_usuario con la regla que ya
--      fijo 20260728000004: toda FK de bitacora hacia seg_usuario va con
--      ON DELETE SET NULL, para no bloquear la baja de quien participo en el
--      flujo sin ser el dueño del registro.
--   B. Pasa la billetera a ON DELETE RESTRICT: una billetera nunca desaparece
--      en silencio; si estorba a una baja, es porque hay algo que decidir.
--   C. Reescribe seg_fn_eliminar_cuenta() para consultar el historial de
--      verdad y anonimizar en vez de borrar cuando existe (PLT-012 regla 2).

-- ============ A. FK de bitacora hacia seg_usuario ============
-- Quien registro un movimiento de kardex, reporto una merma o uso un cupon no
-- es el dueño de esa fila: es un participante. Su baja no puede quedar
-- bloqueada, y la fila se conserva sin el nombre.

alter table comun_comercio.com_kardex
  drop constraint if exists com_kardex_kar_registrado_por_fkey;
alter table comun_comercio.com_kardex
  add constraint com_kardex_kar_registrado_por_fkey
  foreign key (kar_registrado_por) references comun_seguridad.seg_usuario(usu_id) on delete set null;

alter table comun_comercio.com_merma alter column mrm_reportado_por drop not null;
alter table comun_comercio.com_merma
  drop constraint if exists com_merma_mrm_reportado_por_fkey;
alter table comun_comercio.com_merma
  add constraint com_merma_mrm_reportado_por_fkey
  foreign key (mrm_reportado_por) references comun_seguridad.seg_usuario(usu_id) on delete set null;

alter table comun_comercio.com_beneficiario_empresa
  drop constraint if exists com_beneficiario_empresa_bnf_usuario_vinculado_id_fkey;
alter table comun_comercio.com_beneficiario_empresa
  add constraint com_beneficiario_empresa_bnf_usuario_vinculado_id_fkey
  foreign key (bnf_usuario_vinculado_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;

-- Las siguientes SI son del dueño (proforma, pago, suscripcion, uso de cupon).
-- No se ponen en cascade -- eso destruiria el respaldo contable -- ni se dejan
-- en NO ACTION, que es lo que rompia la baja: se desvinculan, y la fila
-- sobrevive anonima para el SRI.
alter table comun_comercio.com_proforma
  drop constraint if exists com_proforma_prf_cliente_id_fkey;
alter table comun_comercio.com_proforma
  add constraint com_proforma_prf_cliente_id_fkey
  foreign key (prf_cliente_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;

alter table comun_comercio.com_transaccion_pago
  drop constraint if exists com_transaccion_pago_pag_cliente_id_fkey;
alter table comun_comercio.com_transaccion_pago
  add constraint com_transaccion_pago_pag_cliente_id_fkey
  foreign key (pag_cliente_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;

alter table comun_comercio.com_suscripcion alter column sub_cliente_id drop not null;
alter table comun_comercio.com_suscripcion
  drop constraint if exists com_suscripcion_sub_cliente_id_fkey;
alter table comun_comercio.com_suscripcion
  add constraint com_suscripcion_sub_cliente_id_fkey
  foreign key (sub_cliente_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;

alter table comun_comercio.com_cupon_uso alter column cpu_usuario_id drop not null;
alter table comun_comercio.com_cupon_uso
  drop constraint if exists com_cupon_uso_cpu_usuario_id_fkey;
alter table comun_comercio.com_cupon_uso
  add constraint com_cupon_uso_cpu_usuario_id_fkey
  foreign key (cpu_usuario_id) references comun_seguridad.seg_usuario(usu_id) on delete set null;

-- ============ B. La billetera no se borra en silencio ============
-- Caso B de arriba: era el unico camino por el que se perdian datos de verdad.
alter table comun_comercio.com_billetera
  drop constraint if exists com_billetera_wlt_usuario_id_fkey;
alter table comun_comercio.com_billetera
  add constraint com_billetera_wlt_usuario_id_fkey
  foreign key (wlt_usuario_id) references comun_seguridad.seg_usuario(usu_id) on delete restrict;

-- ============ C. La baja de cuenta mira donde hay que mirar ============
create or replace function comun_seguridad.seg_fn_eliminar_cuenta()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_historial boolean;
  v_saldo_real numeric(12,4);
begin
  if v_usuario_id is null then
    raise exception 'Sesion no encontrada';
  end if;

  -- La valvula original se conserva, pero explicita: si algun dia se crea
  -- comun_facturacion, esta funcion tiene que revisarse antes de seguir dando
  -- bajas. Es exactamente el fallo que corrige esta migracion -- que la
  -- comprobacion se quedara mirando un sitio obsoleto.
  if to_regclass('comun_facturacion.fac_transaccion_pago') is not null then
    raise exception 'Existe comun_facturacion y seg_fn_eliminar_cuenta() todavia no la consulta -- contactar a soporte para procesar la baja manualmente.';
  end if;

  -- Historial transaccional real. Un pago aprobado o reversado, una
  -- suscripcion viva, una proforma emitida o cualquier movimiento de billetera
  -- son respaldo contable: no se borran, se desvinculan.
  select
       exists (select 1 from comun_comercio.com_transaccion_pago
               where pag_cliente_id = v_usuario_id
                 and pag_estado in ('APROBADO','REVERSADO'))
    or exists (select 1 from comun_comercio.com_suscripcion
               where sub_cliente_id = v_usuario_id
                 and sub_estado in ('ACTIVA','PAUSADA','EN_MORA'))
    or exists (select 1 from comun_comercio.com_proforma
               where prf_cliente_id = v_usuario_id)
    or exists (select 1 from comun_comercio.com_billetera b
               join comun_comercio.com_billetera_movimiento m on m.wlm_billetera_id = b.wlt_id
               where b.wlt_usuario_id = v_usuario_id)
  into v_historial;

  -- Dinero real del usuario. El bono de convenio no es suyo y se extingue con
  -- la baja; el saldo que recargo con su tarjeta hay que devolverselo antes, y
  -- eso no lo puede resolver un boton de autoservicio.
  select coalesce(sum(wlt_saldo_recarga), 0) into v_saldo_real
  from comun_comercio.com_billetera
  where wlt_usuario_id = v_usuario_id and wlt_activo;

  if v_saldo_real > 0 then
    raise exception 'Tu billetera conserva saldo recargado. Solicita su devolucion a soporte antes de dar de baja la cuenta.';
  end if;

  if v_historial then
    -- Anonimizacion (PLT-012 regla 2). No se toca ninguna fila de
    -- comun_comercio: las FK ya quedaron en SET NULL y el rastro contable se
    -- conserva sin identidad detras.
    update comun_seguridad.seg_usuario set
      usu_nombres    = 'Cuenta',
      usu_apellidos  = 'dada de baja',
      usu_correo     = 'anonimo+' || v_usuario_id::text || '@invalido.local',
      usu_whatsapp   = null,
      usu_cedula     = null,
      usu_detalle_usuario = jsonb_build_object('anonimizada_en', now())
    where usu_id = v_usuario_id;

    update comun_seguridad.seg_membresia
      set mem_estado = 'INACTIVO'
    where mem_usuario_id = v_usuario_id;

    -- Cerrar el acceso sin destruir la fila de auth: el vinculo con el
    -- historial cuelga de este uuid.
    update auth.users set
      email              = 'anonimo+' || v_usuario_id::text || '@invalido.local',
      phone              = null,
      encrypted_password = null,
      raw_user_meta_data = '{}'::jsonb,
      banned_until       = 'infinity'::timestamptz
    where id = v_usuario_id;

    delete from auth.identities where user_id = v_usuario_id;
    delete from auth.sessions   where user_id = v_usuario_id;

    return 'anonimizada';
  end if;

  -- Sin historial: la billetera vacia y sin movimientos se retira a mano,
  -- porque la FK ya no cascadea.
  delete from comun_comercio.com_billetera where wlt_usuario_id = v_usuario_id;

  delete from auth.users where id = v_usuario_id;
  -- cascada: seg_usuario y seg_membresia se eliminan automaticamente
  -- (ON DELETE CASCADE, ver 20260727000002).

  return 'eliminada';
end;
$$;

grant execute on function comun_seguridad.seg_fn_eliminar_cuenta() to authenticated;
