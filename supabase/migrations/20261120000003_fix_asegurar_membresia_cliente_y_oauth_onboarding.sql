-- ==============================================================================
-- Migración: 20261120000003_fix_asegurar_membresia_cliente_y_oauth_onboarding.sql
-- Módulo: Identidad y Membresía Multi-Negocio (PLT-001 / PLT-003 / TNK-005)
-- Descripción:
--   1. Corrige `comun_seguridad.seg_fn_asegurar_membresia_cliente(p_negocio)`:
--      - Si ya existía una membresía del negocio en estado no activo (`INACTIVO`,
--        `PENDIENTE`, `SUSPENDIDO`) o con alias de casing distinto (`Tinkay`),
--        la reactiva a `ACTIVO` y normaliza su `mem_negocio` al slug canónico.
--      - Garantiza que exista la fila en `seg_usuario` y marca
--        `usu_correo_verificado_en` para cuentas Google OAuth / confirmadas.
--      - Aísla la llamada secundaria a `comun_comercio.com_fn_asegurar_suscripcion_gratuita`
--        en un bloque `BEGIN ... EXCEPTION WHEN OTHERS` para que ningún fallo
--        del catálogo/suscripciones pueda hacer ROLLBACK del alta de membresía.
--   2. Backfill idempotente: activa la membresía `CLIENTE` para cualquier cuenta
--      que ya completó `/bienvenida` (`usu_detalle_usuario.registros_negocio[neg].onboarding_completo = true`)
--      pero quedó sin fila `ACTIVO` en `seg_membresia` por el fallo anterior.
-- ==============================================================================

create or replace function comun_seguridad.seg_fn_asegurar_membresia_cliente(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_membresia_id uuid;
  v_mem_negocio_actual text;
  v_perfil_id uuid;
  v_ahora timestamptz := now();
  v_email text;
  v_email_conf timestamptz;
  v_proveedor text;
  v_nombres text;
  v_apellidos text;
  v_existe_canon boolean := false;
begin
  if v_uid is null then
    raise exception 'Sin sesion';
  end if;

  -- 1. Garantizar fila base en seg_usuario y correo verificado para OAuth / confirmados
  select
    au.email,
    au.email_confirmed_at,
    lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')),
    coalesce(au.raw_user_meta_data ->> 'given_name', au.raw_user_meta_data ->> 'nombres'),
    coalesce(au.raw_user_meta_data ->> 'family_name', au.raw_user_meta_data ->> 'apellidos')
  into v_email, v_email_conf, v_proveedor, v_nombres, v_apellidos
  from auth.users au
  where au.id = v_uid;

  if v_email is not null then
    insert into comun_seguridad.seg_usuario (
      usu_id,
      usu_correo,
      usu_nombres,
      usu_apellidos,
      usu_correo_verificado_en,
      usu_detalle_usuario
    )
    values (
      v_uid,
      v_email,
      v_nombres,
      v_apellidos,
      case when v_email_conf is not null or v_proveedor <> 'email' then coalesce(v_email_conf, v_ahora) else null end,
      jsonb_build_object(
        'proveedor_auth', v_proveedor,
        'creado_via', 'seg_fn_asegurar_membresia_cliente'
      )
    )
    on conflict (usu_id) do update
      set usu_correo_verificado_en = coalesce(
            comun_seguridad.seg_usuario.usu_correo_verificado_en,
            case when v_email_conf is not null or v_proveedor <> 'email' then coalesce(v_email_conf, v_ahora) else null end
          ),
          usu_actualizado_en = v_ahora;
  end if;

  -- 2. Buscar cualquier membresía previa en el negocio (activa o inactiva, cualquier alias)
  select m.mem_id, m.mem_negocio
    into v_membresia_id, v_mem_negocio_actual
    from comun_seguridad.seg_membresia m
   where m.mem_usuario_id = v_uid
     and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio_canon
   order by (m.mem_negocio = v_negocio_canon) desc,
            (m.mem_estado = 'ACTIVO') desc,
            m.mem_creado_en asc
   limit 1;

  if v_membresia_id is null then
    insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    values (v_uid, v_negocio_canon, 'CLIENTE', 'ACTIVO')
    on conflict (mem_usuario_id, mem_negocio) do update
      set mem_estado = 'ACTIVO',
          mem_actualizado_en = v_ahora
    returning mem_id into v_membresia_id;
  else
    -- Verificar si ya existe otra fila con el slug canónico exacto antes de renombrar
    if v_mem_negocio_actual <> v_negocio_canon then
      select exists (
        select 1
          from comun_seguridad.seg_membresia m2
         where m2.mem_usuario_id = v_uid
           and m2.mem_negocio = v_negocio_canon
           and m2.mem_id <> v_membresia_id
      ) into v_existe_canon;
    end if;

    update comun_seguridad.seg_membresia
       set mem_estado = 'ACTIVO',
           mem_negocio = case
             when v_mem_negocio_actual <> v_negocio_canon and not v_existe_canon then v_negocio_canon
             else mem_negocio
           end,
           mem_actualizado_en = v_ahora
     where mem_id = v_membresia_id;
  end if;

  -- 3. Garantizar perfil CLIENTE en seg_membresia_perfil
  select per_id into v_perfil_id
    from comun_seguridad.seg_perfil
   where per_clave = 'CLIENTE';

  if v_perfil_id is not null and v_membresia_id is not null then
    insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
    values (v_membresia_id, v_perfil_id)
    on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
  end if;

  -- 4. Aprovisionamiento secundario de suscripción gratuita: jamás debe abortar el alta de membresía
  begin
    perform comun_comercio.com_fn_asegurar_suscripcion_gratuita(v_uid, v_negocio_canon);
  exception when others then
    raise notice 'Aviso secundario en com_fn_asegurar_suscripcion_gratuita para usuario % negocio %: %',
      v_uid, v_negocio_canon, sqlerrm;
  end;
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) from public;
grant execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- Backfill idempotente: reparar usuarios que ya completaron bienvenida en un
-- negocio (`registros_negocio[neg].onboarding_completo = true`) pero quedaron sin
-- membresía ACTIVA en `seg_membresia` (causa del rebote /bienvenida -> /panel -> /ingresar).
-- ------------------------------------------------------------------------------
do $$
declare
  v_rec record;
  v_mem_id uuid;
  v_per_cliente_id uuid;
  v_ahora timestamptz := now();
begin
  select per_id into v_per_cliente_id
    from comun_seguridad.seg_perfil
   where per_clave = 'CLIENTE';

  for v_rec in
    select
      u.usu_id,
      comun_seguridad.seg_fn_normalizar_negocio(kv.key) as neg_canon
    from comun_seguridad.seg_usuario u,
         lateral jsonb_each(coalesce(u.usu_detalle_usuario -> 'registros_negocio', '{}'::jsonb)) as kv(key, val)
    where jsonb_typeof(kv.val) = 'object'
      and coalesce((kv.val ->> 'onboarding_completo')::boolean, false) = true
      and comun_seguridad.seg_fn_normalizar_negocio(kv.key) in ('tinkay', 'tranqi', 'fastfix', 'margaritas')
      and not exists (
        select 1
          from comun_seguridad.seg_membresia m
         where m.mem_usuario_id = u.usu_id
           and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = comun_seguridad.seg_fn_normalizar_negocio(kv.key)
           and m.mem_estado = 'ACTIVO'
      )
  loop
    select m.mem_id into v_mem_id
      from comun_seguridad.seg_membresia m
     where m.mem_usuario_id = v_rec.usu_id
       and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_rec.neg_canon
     order by (m.mem_negocio = v_rec.neg_canon) desc, m.mem_creado_en asc
     limit 1;

    if v_mem_id is null then
      insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      values (v_rec.usu_id, v_rec.neg_canon, 'CLIENTE', 'ACTIVO')
      on conflict (mem_usuario_id, mem_negocio) do update
        set mem_estado = 'ACTIVO',
            mem_actualizado_en = v_ahora
      returning mem_id into v_mem_id;
    else
      update comun_seguridad.seg_membresia
         set mem_estado = 'ACTIVO',
             mem_actualizado_en = v_ahora
       where mem_id = v_mem_id;
    end if;

    if v_per_cliente_id is not null and v_mem_id is not null then
      insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
      values (v_mem_id, v_per_cliente_id)
      on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
    end if;
  end loop;
end $$;
