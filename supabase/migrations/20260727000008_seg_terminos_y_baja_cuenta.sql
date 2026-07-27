-- PLT-001 regla 6: consentimiento de terminos globales, con version para
-- poder demostrar que se acepto una version concreta si el texto cambia.
alter table comun_seguridad.seg_usuario
  add column usu_terminos_aceptados_en timestamptz,
  add column usu_terminos_version text,
  add column usu_eliminado_en timestamptz;

-- El usuario puede registrar su propia aceptacion de terminos (columnas ya
-- cubiertas por el grant existente de perfil), pero usu_eliminado_en NUNCA
-- se otorga a authenticated -- solo lo escribe seg_fn_eliminar_cuenta()
-- (SECURITY DEFINER), para que nadie pueda auto-marcarse/desmarcarse la baja
-- por fuera del flujo real.
grant update (usu_terminos_aceptados_en, usu_terminos_version) on comun_seguridad.seg_usuario to authenticated;

-- El trigger de aprovisionamiento tambien registra la aceptacion de terminos
-- cuando el registro por correo la envia en raw_user_meta_data (Google OAuth
-- no permite inyectar metadata propia -- para ese camino la aceptacion se
-- registra en el callback de OAuth, donde ya hay sesion real).
create or replace function comun_seguridad.seg_fn_provisionar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_es_superadmin boolean;
  v_nombres text;
  v_apellidos text;
  v_terminos_version text;
begin
  v_es_superadmin := (new.email = 'kleber.toapanta.ch@gmail.com');
  v_nombres := new.raw_user_meta_data ->> 'given_name';
  v_apellidos := new.raw_user_meta_data ->> 'family_name';
  v_terminos_version := new.raw_user_meta_data ->> 'terminos_version';

  insert into comun_seguridad.seg_usuario (
    usu_id, usu_correo, usu_nombres, usu_apellidos, usu_superadmin_plataforma,
    usu_terminos_aceptados_en, usu_terminos_version, usu_detalle_usuario
  )
  values (
    new.id,
    new.email,
    v_nombres,
    v_apellidos,
    v_es_superadmin,
    case when v_terminos_version is not null then now() else null end,
    v_terminos_version,
    jsonb_build_object(
      'nombres', v_nombres,
      'apellidos', v_apellidos,
      'foto', new.raw_user_meta_data ->> 'avatar_url'
    )
  )
  on conflict (usu_id) do nothing;

  return new;
end;
$$;

-- PLT-012: baja de cuenta / derecho al olvido.
-- Regla: si el usuario tiene historial transaccional (pagos), NO se puede
-- eliminar -- se anonimiza y se conserva el vinculo con las transacciones
-- (obligacion legal de conservar registros contables/tributarios). Si no
-- tiene ninguno, se elimina por completo.
--
-- Estado real hoy: NINGUN esquema transaccional existe todavia
-- (comun_facturacion, comun_comercio, ni tablas de pedido por negocio), asi
-- que toda baja hoy es hard-delete -- es seguro porque no puede existir
-- historial que preservar. to_regclass() detecta si fac_transaccion_pago ya
-- existe; en cuanto lo cree una migracion futura, esta funcion DEBE
-- actualizarse para consultarla de verdad antes de permitir el hard-delete
-- -- mientras tanto falla explicitamente (no procesa la baja) en vez de
-- arriesgar borrar historial real por un chequeo desactualizado.
create or replace function comun_seguridad.seg_fn_eliminar_cuenta()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
begin
  if v_usuario_id is null then
    raise exception 'Sesion no encontrada';
  end if;

  if to_regclass('comun_facturacion.fac_transaccion_pago') is not null then
    raise exception 'Verificacion de historial transaccional pendiente de actualizar en seg_fn_eliminar_cuenta() -- contactar a soporte para procesar la baja manualmente.';
  end if;

  delete from auth.users where id = v_usuario_id;
  -- cascada: seg_usuario y seg_membresia se eliminan automaticamente
  -- (ON DELETE CASCADE, ver 20260727000002).

  return 'eliminada';
end;
$$;

grant execute on function comun_seguridad.seg_fn_eliminar_cuenta() to authenticated;
