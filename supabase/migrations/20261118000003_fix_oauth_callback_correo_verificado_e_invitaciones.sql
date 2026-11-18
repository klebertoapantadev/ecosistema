-- ==============================================================================
-- Migración: 20261118000003_fix_oauth_callback_correo_verificado_e_invitaciones.sql
-- Módulo: Identidad Google OAuth + Activación Automática de Invitaciones (PLT-001 / PLT-003 / TNK-005)
-- Descripción:
--   1. Restaura `usu_correo_verificado_en` en `seg_fn_provisionar_usuario()` para cuentas
--      autenticadas con Google OAuth (`provider <> 'email'` o `email_confirmed_at is not null`),
--      corrigiendo la regresión introducida en `20261115000001` y evitando errores `42501`
--      por `GRANT UPDATE` de columna restringida en `seg_usuario` (Regla 13 de AGENTS.md).
--   2. Reclama automáticamente invitaciones `PENDIENTE` en `cfg_negocio` desde el mismo
--      trigger `seg_fn_provisionar_usuario()` y desde `seg_fn_sincronizar_acceso_rol_tinkay()`.
--   3. Ejecuta backfill sobre usuarios existentes de Google OAuth (incluyendo cuentas que ya
--      confirmaron acceso en Google pero quedaron con `usu_correo_verificado_en IS NULL` o
--      invitación `PENDIENTE` en `tinkay`).
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Actualizar trigger seg_fn_provisionar_usuario con usu_correo_verificado_en
--    y reclamación inmediata de invitaciones de equipo pendientes
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_provisionar_usuario()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_nombres text;
  v_apellidos text;
  v_avatar text;
  v_es_superadmin boolean;
  v_email_clean text;
  v_nombre_completo text;
  v_terminos_version text;
  v_proveedor text;
  v_correo_verificado_en timestamptz;
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_per_cliente_id uuid;
  v_per_rol_id uuid;
  v_negocio text;
  v_negocios_objetivo text[];
  v_cfg record;
  v_inv_arr jsonb;
  v_inv_match jsonb;
  v_rol_inv text;
  v_nombre_inv text;
  v_nuevas_inv jsonb;
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
begin
  v_email_clean := lower(btrim(coalesce(new.email, '')));
  v_proveedor := lower(coalesce(new.raw_app_meta_data ->> 'provider', 'email'));

  -- Google OAuth (o cualquier proveedor externo / email ya confirmado) nace con correo verificado
  if new.email_confirmed_at is not null or v_proveedor <> 'email' then
    v_correo_verificado_en := coalesce(new.email_confirmed_at, v_ahora);
  else
    v_correo_verificado_en := null;
  end if;

  v_es_superadmin := (v_email_clean in (
    'familiammtg@gmail.com',
    'jesus251296@gmail.com',
    'kleber.toapanta.ch@gmail.com'
  ));

  v_nombres := coalesce(
    new.raw_user_meta_data ->> 'given_name',
    new.raw_user_meta_data ->> 'nombres'
  );

  v_apellidos := coalesce(
    new.raw_user_meta_data ->> 'family_name',
    new.raw_user_meta_data ->> 'apellidos'
  );

  v_terminos_version := new.raw_user_meta_data ->> 'terminos_version';

  if v_nombres is null and v_apellidos is null then
    v_nombre_completo := trim(coalesce(new.raw_user_meta_data ->> 'name', new.raw_user_meta_data ->> 'full_name', v_email_clean));
    if v_nombre_completo is not null and v_nombre_completo <> '' then
      v_nombres := split_part(v_nombre_completo, ' ', 1);
      v_apellidos := nullif(trim(substring(v_nombre_completo from length(v_nombres) + 1)), '');
    end if;
  end if;

  v_avatar := coalesce(
    new.raw_user_meta_data ->> 'avatar_url',
    new.raw_user_meta_data ->> 'picture',
    null
  );

  insert into comun_seguridad.seg_usuario (
    usu_id,
    usu_correo,
    usu_nombres,
    usu_apellidos,
    usu_correo_verificado_en,
    usu_superadmin_plataforma,
    usu_terminos_aceptados_en,
    usu_terminos_version,
    usu_detalle_usuario
  )
  values (
    new.id,
    new.email,
    v_nombres,
    v_apellidos,
    v_correo_verificado_en,
    v_es_superadmin,
    case when v_terminos_version is not null or v_proveedor <> 'email' then v_ahora else null end,
    coalesce(v_terminos_version, case when v_proveedor <> 'email' then '1.0' else null end),
    jsonb_build_object(
      'nombres', v_nombres,
      'apellidos', v_apellidos,
      'foto', v_avatar,
      'avatar_url', v_avatar,
      'proveedor_auth', v_proveedor,
      'creado_via', 'auth_trigger_provisionamiento',
      'email_confirmado_en', coalesce(new.email_confirmed_at, v_correo_verificado_en)
    )
  )
  on conflict (usu_id) do update set
    usu_correo = excluded.usu_correo,
    usu_nombres = coalesce(comun_seguridad.seg_usuario.usu_nombres, excluded.usu_nombres),
    usu_apellidos = coalesce(comun_seguridad.seg_usuario.usu_apellidos, excluded.usu_apellidos),
    usu_correo_verificado_en = coalesce(
      comun_seguridad.seg_usuario.usu_correo_verificado_en,
      excluded.usu_correo_verificado_en
    ),
    usu_superadmin_plataforma = case
      when lower(excluded.usu_correo) in ('satcomla.ti@gmail.com', 'tinkay.uio@gmail.com') then false
      when v_es_superadmin then true
      else comun_seguridad.seg_usuario.usu_superadmin_plataforma
    end,
    usu_detalle_usuario = coalesce(comun_seguridad.seg_usuario.usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object(
      'foto', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'foto'),
      'avatar_url', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'avatar_url')
    ),
    usu_actualizado_en = v_ahora;

  -- Bootstrap de cuentas propietarias
  if v_email_clean in ('kleber.toapanta.ch@gmail.com', 'jesus251296@gmail.com', 'tinkay.uio@gmail.com') then
    select per_id into v_per_superadmin_id from comun_seguridad.seg_perfil where upper(per_clave) = 'SUPERADMIN';
    select per_id into v_per_admin_id from comun_seguridad.seg_perfil where upper(per_clave) = 'ADMINISTRADOR';

    if v_email_clean = 'tinkay.uio@gmail.com' then
      v_negocios_objetivo := array['tinkay'];
    else
      v_negocios_objetivo := array['tinkay', 'tranqi', 'fastfix', 'margaritas'];
    end if;

    foreach v_negocio in array v_negocios_objetivo loop
      insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      values (new.id, v_negocio, 'SUPERADMIN', 'ACTIVO')
      on conflict (mem_usuario_id, mem_negocio) do update set
        mem_rol = 'SUPERADMIN',
        mem_estado = 'ACTIVO',
        mem_actualizado_en = v_ahora
      returning mem_id into v_mem_id;

      if v_per_superadmin_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        values (v_mem_id, v_per_superadmin_id, new.id)
        on conflict do nothing;
      end if;

      if v_per_admin_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id, mpe_asignado_por)
        values (v_mem_id, v_per_admin_id, new.id)
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Reclamar invitaciones pendientes por correo en cualquier negocio apenas nace en auth.users
  begin
    select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

    for v_cfg in
      select cfg_id,
             comun_seguridad.seg_fn_normalizar_negocio(cfg_negocio) as neg_canon,
             coalesce(cfg_detalle_configuracion, '{}'::jsonb) as det_cfg
      from comun_configuracion.cfg_negocio
      where jsonb_typeof(coalesce(cfg_detalle_configuracion, '{}'::jsonb)->'invitaciones_equipo') = 'array'
    loop
      v_inv_arr := v_cfg.det_cfg->'invitaciones_equipo';
      v_inv_match := null;

      select elem
        into v_inv_match
        from jsonb_array_elements(v_inv_arr) as elem
       where lower(btrim(coalesce(elem->>'correo', ''))) = v_email_clean
       limit 1;

      if v_inv_match is not null then
        v_rol_inv := upper(btrim(coalesce(v_inv_match->>'rol', 'VENTAS')));
        v_nombre_inv := nullif(btrim(coalesce(v_inv_match->>'nombre', '')), '');
        select per_id into v_per_rol_id from comun_seguridad.seg_perfil where per_clave = v_rol_inv;

        insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
        values (new.id, v_cfg.neg_canon, v_rol_inv, 'ACTIVO')
        on conflict (mem_usuario_id, mem_negocio) do update set
          mem_rol = v_rol_inv,
          mem_estado = 'ACTIVO',
          mem_actualizado_en = v_ahora
        returning mem_id into v_mem_id;

        if v_per_cliente_id is not null and v_mem_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_cliente_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        if v_per_rol_id is not null and v_mem_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_rol_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        update comun_seguridad.seg_usuario
           set usu_nombres = coalesce(nullif(btrim(usu_nombres), ''), v_nombre_inv),
               usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) ||
                 case when v_cfg.neg_canon = 'tinkay' then jsonb_build_object('roles_explicitos_tinkay', true) else '{}'::jsonb end,
               usu_actualizado_en = v_ahora
         where usu_id = new.id;

        select coalesce(
          jsonb_agg(
            case
              when lower(btrim(coalesce(elem->>'correo', ''))) = v_email_clean
                then elem || jsonb_build_object('estado', 'ACEPTADA', 'aceptadoEn', v_ahora_iso)
              else elem
            end
          ),
          '[]'::jsonb
        )
        into v_nuevas_inv
        from jsonb_array_elements(v_inv_arr) as elem;

        update comun_configuracion.cfg_negocio
           set cfg_detalle_configuracion = jsonb_set(v_cfg.det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
               cfg_actualizado_en = v_ahora
         where cfg_id = v_cfg.cfg_id;
      end if;
    end loop;
  exception when others then
    -- Nunca bloquear el alta de auth.users por un fallo secundario de JSON de invitaciones
    null;
  end;

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 2. Actualizar seg_fn_sincronizar_acceso_rol_tinkay para auto-confirmar
--    usu_correo_verificado_en en cuentas OAuth vía SECURITY DEFINER (Regla 13)
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(
  p_negocio text default 'tinkay',
  p_crear_cliente_si_no_existe boolean default true
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_neg text := comun_seguridad.seg_fn_normalizar_negocio(coalesce(p_negocio, 'tinkay'));
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
  v_correo text;
  v_nombres text;
  v_detalle jsonb;
  v_email_conf timestamptz;
  v_proveedor text;
  v_usu_verificado timestamptz;
  v_explicito boolean := false;
  v_cfg_id uuid;
  v_det_cfg jsonb;
  v_inv_arr jsonb;
  v_inv_match jsonb;
  v_rol_inv text;
  v_estado_inv text;
  v_nombre_inv text;
  v_mem_id uuid;
  v_mem_rol text;
  v_per_rol_id uuid;
  v_per_cliente_id uuid;
  v_nuevas_inv jsonb;
  v_rol_efectivo text;
begin
  if v_uid is null then
    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'CLIENTE',
      'invitacionAplicada', false,
      'tieneMembresia', false
    );
  end if;

  select lower(btrim(coalesce(u.usu_correo, au.email, ''))),
         u.usu_nombres,
         coalesce(u.usu_detalle_usuario, '{}'::jsonb),
         au.email_confirmed_at,
         lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')),
         u.usu_correo_verificado_en
    into v_correo, v_nombres, v_detalle, v_email_conf, v_proveedor, v_usu_verificado
    from auth.users au
    left join comun_seguridad.seg_usuario u on u.usu_id = au.id
   where au.id = v_uid;

  -- Si el proveedor ya confirmó el correo (Google OAuth / email_confirmed_at) y seg_usuario sigue en NULL, actualizar
  if v_usu_verificado is null and (v_email_conf is not null or v_proveedor <> 'email') then
    update comun_seguridad.seg_usuario
       set usu_correo_verificado_en = coalesce(v_email_conf, v_ahora),
           usu_actualizado_en = v_ahora
     where usu_id = v_uid;
  end if;

  -- Propietarios de Tinkay: garantizar SUPERADMIN + ADMINISTRADOR
  if v_neg = 'tinkay' and v_correo in ('tinkay.uio@gmail.com', 'kleber.toapanta.ch@gmail.com') then
    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'SUPERADMIN',
      'invitacionAplicada', false,
      'tieneMembresia', true
    );
  end if;

  v_explicito := coalesce((v_detalle->>'roles_explicitos_tinkay')::boolean, false);
  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  -- 1. Revisar si existe invitación para su correo en cfg_negocio
  select cfg_id, coalesce(cfg_detalle_configuracion, '{}'::jsonb)
    into v_cfg_id, v_det_cfg
    from comun_configuracion.cfg_negocio
   where cfg_negocio = v_neg;

  if v_cfg_id is not null and jsonb_typeof(v_det_cfg->'invitaciones_equipo') = 'array' then
    v_inv_arr := v_det_cfg->'invitaciones_equipo';

    select elem
      into v_inv_match
      from jsonb_array_elements(v_inv_arr) as elem
     where lower(btrim(coalesce(elem->>'correo', ''))) = v_correo
     limit 1;

    if v_inv_match is not null then
      v_rol_inv := upper(btrim(coalesce(v_inv_match->>'rol', 'VENTAS')));
      v_estado_inv := upper(btrim(coalesce(v_inv_match->>'estado', 'PENDIENTE')));
      v_nombre_inv := nullif(btrim(coalesce(v_inv_match->>'nombre', '')), '');

      select m.mem_id, upper(coalesce(m.mem_rol, 'CLIENTE'))
        into v_mem_id, v_mem_rol
        from comun_seguridad.seg_membresia m
       where m.mem_usuario_id = v_uid
         and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
       order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
       limit 1;

      if v_estado_inv = 'PENDIENTE' or not v_explicito or v_mem_id is null then
        select per_id into v_per_rol_id from comun_seguridad.seg_perfil where per_clave = v_rol_inv;

        if v_mem_id is null then
          insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
          values (v_uid, v_neg, v_rol_inv, 'ACTIVO')
          on conflict (mem_usuario_id, mem_negocio) do update
            set mem_rol = v_rol_inv,
                mem_estado = 'ACTIVO',
                mem_actualizado_en = v_ahora
          returning mem_id into v_mem_id;
        else
          update comun_seguridad.seg_membresia
             set mem_negocio = v_neg,
                 mem_rol = v_rol_inv,
                 mem_estado = 'ACTIVO',
                 mem_actualizado_en = v_ahora
           where mem_id = v_mem_id;
        end if;

        if v_estado_inv = 'PENDIENTE' then
          delete from comun_seguridad.seg_membresia_perfil mp
          using comun_seguridad.seg_perfil p
          where mp.mpe_membresia_id = v_mem_id
            and mp.mpe_perfil_id = p.per_id
            and p.per_clave <> 'CLIENTE';
        end if;

        if v_per_cliente_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_cliente_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        if v_per_rol_id is not null then
          insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
          values (v_mem_id, v_per_rol_id)
          on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
        end if;

        update comun_seguridad.seg_usuario
           set usu_nombres = coalesce(nullif(btrim(usu_nombres), ''), v_nombre_inv),
               usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) ||
                 case when v_neg = 'tinkay' then jsonb_build_object('roles_explicitos_tinkay', true) else '{}'::jsonb end,
               usu_actualizado_en = v_ahora
         where usu_id = v_uid;

        if v_estado_inv = 'PENDIENTE' then
          select coalesce(
            jsonb_agg(
              case
                when lower(btrim(coalesce(elem->>'correo', ''))) = v_correo
                  then elem || jsonb_build_object('estado', 'ACEPTADA', 'aceptadoEn', v_ahora_iso)
                else elem
              end
            ),
            '[]'::jsonb
          )
          into v_nuevas_inv
          from jsonb_array_elements(v_inv_arr) as elem;

          update comun_configuracion.cfg_negocio
             set cfg_detalle_configuracion = jsonb_set(v_det_cfg, '{invitaciones_equipo}', v_nuevas_inv, true),
                 cfg_actualizado_en = v_ahora
           where cfg_id = v_cfg_id;
        end if;

        return jsonb_build_object(
          'ok', true,
          'rolEfectivo', v_rol_inv,
          'invitacionAplicada', true,
          'tieneMembresia', true
        );
      end if;
    end if;
  end if;

  -- 2. Evaluar membresía actual en el negocio
  select m.mem_id, upper(coalesce(m.mem_rol, 'CLIENTE'))
    into v_mem_id, v_mem_rol
    from comun_seguridad.seg_membresia m
   where m.mem_usuario_id = v_uid
     and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_neg
     and m.mem_estado = 'ACTIVO'
   order by (m.mem_negocio = v_neg) desc, m.mem_creado_en asc
   limit 1;

  if v_mem_id is null then
    if p_crear_cliente_si_no_existe then
      insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
      values (v_uid, v_neg, 'CLIENTE', 'ACTIVO')
      on conflict (mem_usuario_id, mem_negocio) do update
        set mem_estado = 'ACTIVO',
            mem_actualizado_en = v_ahora
      returning mem_id into v_mem_id;

      if v_per_cliente_id is not null and v_mem_id is not null then
        insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
        values (v_mem_id, v_per_cliente_id)
        on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
      end if;

      return jsonb_build_object(
        'ok', true,
        'rolEfectivo', 'CLIENTE',
        'invitacionAplicada', false,
        'tieneMembresia', true
      );
    end if;

    return jsonb_build_object(
      'ok', true,
      'rolEfectivo', 'CLIENTE',
      'invitacionAplicada', false,
      'tieneMembresia', false
    );
  end if;

  if v_neg = 'tinkay' and not v_explicito and v_mem_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN') then
    update comun_seguridad.seg_membresia
       set mem_rol = 'CLIENTE',
           mem_actualizado_en = v_ahora
     where mem_id = v_mem_id;

    delete from comun_seguridad.seg_membresia_perfil mp
    using comun_seguridad.seg_perfil p
    where mp.mpe_membresia_id = v_mem_id
      and mp.mpe_perfil_id = p.per_id
      and p.per_clave in ('SUPERADMIN', 'ADMINISTRADOR', 'ADMIN');

    if v_per_cliente_id is not null then
      insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
      values (v_mem_id, v_per_cliente_id)
      on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
    end if;
  end if;

  v_rol_efectivo := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_neg);
  if v_rol_efectivo = 'ANONIMO' then
    v_rol_efectivo := 'CLIENTE';
  end if;

  return jsonb_build_object(
    'ok', true,
    'rolEfectivo', v_rol_efectivo,
    'invitacionAplicada', false,
    'tieneMembresia', true
  );
end;
$$;

revoke execute on function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(text, boolean) from public;
grant execute on function comun_seguridad.seg_fn_sincronizar_acceso_rol_tinkay(text, boolean) to authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 3. Backfill de cuentas existentes en auth.users / seg_usuario:
--    a) Garantizar fila en seg_usuario para todo auth.users existente.
--    b) Marcar usu_correo_verificado_en en cuentas Google OAuth / confirmadas.
--    c) Activar membresía + rol para invitaciones PENDIENTE cuyos correos ya
--       iniciaron sesión en Google (ej. rosamariatorrescampos1@gmail.com y
--       nancyguerrerotorres1584@gmail.com).
-- ------------------------------------------------------------------------------
do $$
declare
  v_cfg record;
  v_inv record;
  v_usr record;
  v_mem_id uuid;
  v_per_cliente_id uuid;
  v_per_rol_id uuid;
  v_rol_inv text;
  v_nombre_inv text;
  v_nuevas_inv jsonb;
  v_ahora timestamptz := now();
  v_ahora_iso text := to_jsonb(now())#>>'{}';
begin
  -- 3a. Garantizar que cualquier usuario en auth.users tenga fila en seg_usuario
  insert into comun_seguridad.seg_usuario (
    usu_id,
    usu_correo,
    usu_nombres,
    usu_apellidos,
    usu_correo_verificado_en,
    usu_terminos_aceptados_en,
    usu_terminos_version,
    usu_detalle_usuario
  )
  select
    au.id,
    au.email,
    coalesce(au.raw_user_meta_data ->> 'given_name', split_part(coalesce(au.raw_user_meta_data ->> 'full_name', au.email), ' ', 1)),
    au.raw_user_meta_data ->> 'family_name',
    case
      when au.email_confirmed_at is not null or lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')) <> 'email'
        then coalesce(au.email_confirmed_at, v_ahora)
      else null
    end,
    case when lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')) <> 'email' then v_ahora else null end,
    case when lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')) <> 'email' then '1.0' else null end,
    jsonb_build_object(
      'proveedor_auth', lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')),
      'creado_via', 'backfill_oauth'
    )
  from auth.users au
  where au.email is not null
    and not exists (
      select 1 from comun_seguridad.seg_usuario u where u.usu_id = au.id
    );

  -- 3b. Poblar usu_correo_verificado_en en todas las cuentas OAuth o con email_confirmed_at
  update comun_seguridad.seg_usuario u
     set usu_correo_verificado_en = coalesce(au.email_confirmed_at, u.usu_creado_en, v_ahora),
         usu_terminos_aceptados_en = coalesce(u.usu_terminos_aceptados_en, v_ahora),
         usu_terminos_version = coalesce(u.usu_terminos_version, '1.0'),
         usu_actualizado_en = v_ahora
    from auth.users au
   where u.usu_id = au.id
     and u.usu_correo_verificado_en is null
     and (
       au.email_confirmed_at is not null
       or lower(coalesce(au.raw_app_meta_data ->> 'provider', 'email')) <> 'email'
     );

  -- 3c. Reconciliar invitaciones PENDIENTE cuyos correos ya existen en seg_usuario
  select per_id into v_per_cliente_id from comun_seguridad.seg_perfil where per_clave = 'CLIENTE';

  for v_cfg in
    select cfg_id,
           comun_seguridad.seg_fn_normalizar_negocio(cfg_negocio) as neg_canon,
           coalesce(cfg_detalle_configuracion, '{}'::jsonb) as det_cfg
    from comun_configuracion.cfg_negocio
    where jsonb_typeof(coalesce(cfg_detalle_configuracion, '{}'::jsonb)->'invitaciones_equipo') = 'array'
  loop
    for v_inv in
      select elem,
             lower(btrim(coalesce(elem->>'correo', ''))) as correo_inv,
             upper(btrim(coalesce(elem->>'rol', 'VENTAS'))) as rol_inv,
             nullif(btrim(coalesce(elem->>'nombre', '')), '') as nombre_inv,
             upper(btrim(coalesce(elem->>'estado', 'PENDIENTE'))) as estado_inv
      from jsonb_array_elements(v_cfg.det_cfg->'invitaciones_equipo') as elem
    loop
      if v_inv.correo_inv <> '' then
        select u.usu_id, u.usu_nombres
          into v_usr
          from comun_seguridad.seg_usuario u
         where lower(btrim(u.usu_correo)) = v_inv.correo_inv
         limit 1;

        if v_usr.usu_id is not null then
          v_rol_inv := v_inv.rol_inv;
          v_nombre_inv := v_inv.nombre_inv;
          select per_id into v_per_rol_id from comun_seguridad.seg_perfil where per_clave = v_rol_inv;

          select m.mem_id into v_mem_id
          from comun_seguridad.seg_membresia m
          where m.mem_usuario_id = v_usr.usu_id
            and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_cfg.neg_canon
          order by (m.mem_negocio = v_cfg.neg_canon) desc, m.mem_creado_en asc
          limit 1;

          if v_mem_id is null then
            insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
            values (v_usr.usu_id, v_cfg.neg_canon, v_rol_inv, 'ACTIVO')
            on conflict (mem_usuario_id, mem_negocio) do update set
              mem_rol = v_rol_inv,
              mem_estado = 'ACTIVO',
              mem_actualizado_en = v_ahora
            returning mem_id into v_mem_id;
          elsif v_inv.estado_inv = 'PENDIENTE' then
            update comun_seguridad.seg_membresia
               set mem_negocio = v_cfg.neg_canon,
                   mem_rol = v_rol_inv,
                   mem_estado = 'ACTIVO',
                   mem_actualizado_en = v_ahora
             where mem_id = v_mem_id;
          end if;

          if v_per_cliente_id is not null and v_mem_id is not null then
            insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
            values (v_mem_id, v_per_cliente_id)
            on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
          end if;

          if v_per_rol_id is not null and v_mem_id is not null then
            insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
            values (v_mem_id, v_per_rol_id)
            on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
          end if;

          update comun_seguridad.seg_usuario
             set usu_nombres = coalesce(nullif(btrim(usu_nombres), ''), v_nombre_inv),
                 usu_detalle_usuario = coalesce(usu_detalle_usuario, '{}'::jsonb) ||
                   case when v_cfg.neg_canon = 'tinkay' then jsonb_build_object('roles_explicitos_tinkay', true) else '{}'::jsonb end,
                 usu_actualizado_en = v_ahora
           where usu_id = v_usr.usu_id;

          if v_inv.estado_inv = 'PENDIENTE' then
            select coalesce(
              jsonb_agg(
                case
                  when lower(btrim(coalesce(e->>'correo', ''))) = v_inv.correo_inv
                    then e || jsonb_build_object('estado', 'ACEPTADA', 'aceptadoEn', v_ahora_iso)
                  else e
                end
              ),
              '[]'::jsonb
            )
            into v_nuevas_inv
            from comun_configuracion.cfg_negocio c,
                 jsonb_array_elements(coalesce(c.cfg_detalle_configuracion, '{}'::jsonb)->'invitaciones_equipo') as e
            where c.cfg_id = v_cfg.cfg_id;

            update comun_configuracion.cfg_negocio c
               set cfg_detalle_configuracion = jsonb_set(coalesce(c.cfg_detalle_configuracion, '{}'::jsonb), '{invitaciones_equipo}', v_nuevas_inv, true),
                   cfg_actualizado_en = v_ahora
             where c.cfg_id = v_cfg.cfg_id;
          end if;
        end if;
      end if;
    end loop;
  end loop;
end $$;
