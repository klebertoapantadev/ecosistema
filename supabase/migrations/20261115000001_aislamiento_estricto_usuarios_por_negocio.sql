-- ==============================================================================
-- Migración: 20261115000001_aislamiento_estricto_usuarios_por_negocio.sql
-- Módulo: Identidad y Seguridad Multi-Negocio (PLT-001 / PLT-003 / PLT-012)
-- Descripción:
--   Aislamiento 100% estricto por negocio para registros de usuarios, staff,
--   membresías, SMTP de negocio y baja de cuenta sin afectar otros negocios.
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. Función canónica de normalización de slug de negocio
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_normalizar_negocio(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case lower(trim(coalesce(p_negocio, '')))
    when 'tranqi' then 'tranqi'
    when 'tranq' then 'tranqi'
    when 'legal' then 'tranqi'
    when 'tinkay' then 'tinkay'
    when 'tnk' then 'tinkay'
    when 'fastfix' then 'fastfix'
    when 'ffh' then 'fastfix'
    when 'margaritas' then 'margaritas'
    when 'mrg' then 'margaritas'
    when '' then 'tranqi'
    else lower(trim(p_negocio))
  end;
$$;

grant execute on function comun_seguridad.seg_fn_normalizar_negocio(text) to anon, authenticated, service_role;

-- ------------------------------------------------------------------------------
-- 2. Aislar cuentas administrativas propias de Tinkay (tinkay.uio@gmail.com)
--    para que sean SUPERADMIN únicamente de Tinkay y NUNCA de Tranqi/FastFix/Margaritas
-- ------------------------------------------------------------------------------
do $$
declare
  v_usu_id uuid;
begin
  select usu_id into v_usu_id
  from comun_seguridad.seg_usuario
  where lower(usu_correo) = 'tinkay.uio@gmail.com';

  if v_usu_id is not null then
    update comun_seguridad.seg_usuario
       set usu_superadmin_plataforma = false,
           usu_actualizado_en = now()
     where usu_id = v_usu_id;

    delete from comun_seguridad.seg_membresia
     where mem_usuario_id = v_usu_id
       and comun_seguridad.seg_fn_normalizar_negocio(mem_negocio) <> 'tinkay';
  end if;
end $$;

-- ------------------------------------------------------------------------------
-- 3. SuperAdmin de Plataforma vs SuperAdmin de Negocio (PLT-003 / PLT-008)
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid()
      and (
        u.usu_superadmin_plataforma = true
        or lower(u.usu_correo) in (
          'kleber.toapanta.ch@gmail.com',
          'familiammtg@gmail.com',
          'jesus251296@gmail.com'
        )
      )
  );
$$;

revoke execute on function comun_seguridad.seg_fn_es_superadmin() from public;
grant execute on function comun_seguridad.seg_fn_es_superadmin() to authenticated, anon, service_role;

create or replace function comun_seguridad.seg_fn_es_superadmin_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_superadmin()
  or exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = auth.uid()
      and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = comun_seguridad.seg_fn_normalizar_negocio(p_negocio)
      and m.mem_estado = 'ACTIVO'
      and (
        upper(coalesce(m.mem_rol, '')) = 'SUPERADMIN'
        or upper(coalesce(p.per_clave, '')) = 'SUPERADMIN'
      )
  );
$$;

revoke execute on function comun_seguridad.seg_fn_es_superadmin_negocio(text) from public;
grant execute on function comun_seguridad.seg_fn_es_superadmin_negocio(text) to authenticated, service_role;

-- Actualizar RLS y RPCs de SMTP para que un SuperAdmin de negocio solo vea/edite su propio SMTP
drop policy if exists cfg_smtp_superadmin_lectura on comun_configuracion.cfg_smtp;
create policy cfg_smtp_superadmin_lectura on comun_configuracion.cfg_smtp
  for select using (comun_seguridad.seg_fn_es_superadmin_negocio(smt_negocio));

create or replace function comun_configuracion.cfg_fn_guardar_smtp(
  p_negocio text,
  p_host text,
  p_puerto integer,
  p_seguro boolean,
  p_usuario text,
  p_remitente_nombre text,
  p_activo boolean,
  p_contrasena text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto_id uuid;
begin
  if not comun_seguridad.seg_fn_es_superadmin_negocio(p_negocio) then
    raise exception 'No autorizado';
  end if;

  if p_puerto is null or p_puerto < 1 or p_puerto > 65535 then
    raise exception 'Puerto invalido';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if p_contrasena is not null and p_contrasena <> '' then
    if v_secreto_id is null then
      v_secreto_id := vault.create_secret(
        p_contrasena,
        'smtp_' || p_negocio,
        'Contrasena SMTP del negocio ' || p_negocio
      );
    else
      perform vault.update_secret(v_secreto_id, p_contrasena);
    end if;
  end if;

  insert into comun_configuracion.cfg_smtp as s (
    smt_negocio, smt_host, smt_puerto, smt_seguro, smt_usuario,
    smt_remitente_nombre, smt_activo, smt_secreto_id
  )
  values (
    p_negocio, nullif(p_host, ''), p_puerto, p_seguro, nullif(p_usuario, ''),
    nullif(p_remitente_nombre, ''), p_activo, v_secreto_id
  )
  on conflict (smt_negocio) do update set
    smt_host = excluded.smt_host,
    smt_puerto = excluded.smt_puerto,
    smt_seguro = excluded.smt_seguro,
    smt_usuario = excluded.smt_usuario,
    smt_remitente_nombre = excluded.smt_remitente_nombre,
    smt_activo = excluded.smt_activo,
    smt_secreto_id = coalesce(v_secreto_id, s.smt_secreto_id),
    smt_actualizado_en = now();
end;
$$;

create or replace function comun_configuracion.cfg_fn_borrar_smtp_contrasena(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_secreto_id uuid;
begin
  if not comun_seguridad.seg_fn_es_superadmin_negocio(p_negocio) then
    raise exception 'No autorizado';
  end if;

  select smt_secreto_id into v_secreto_id
  from comun_configuracion.cfg_smtp
  where smt_negocio = p_negocio;

  if v_secreto_id is null then
    return;
  end if;

  update comun_configuracion.cfg_smtp
     set smt_secreto_id = null, smt_activo = false, smt_actualizado_en = now()
   where smt_negocio = p_negocio;

  delete from vault.secrets where id = v_secreto_id;
end;
$$;

-- ------------------------------------------------------------------------------
-- 4. Actualizar trigger seg_fn_provisionar_usuario sin contaminar otros negocios
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
  v_mem_id uuid;
  v_per_superadmin_id uuid;
  v_per_admin_id uuid;
  v_negocio text;
  v_negocios_objetivo text[];
begin
  v_email_clean := lower(coalesce(new.email, ''));

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
    v_es_superadmin,
    case when v_terminos_version is not null then now() else null end,
    v_terminos_version,
    jsonb_build_object(
      'nombres', v_nombres,
      'apellidos', v_apellidos,
      'foto', v_avatar,
      'avatar_url', v_avatar,
      'proveedor_auth', coalesce(new.raw_app_meta_data ->> 'provider', 'email'),
      'creado_via', 'auth_trigger_provisionamiento',
      'email_confirmado_en', new.email_confirmed_at
    )
  )
  on conflict (usu_id) do update set
    usu_correo = excluded.usu_correo,
    usu_nombres = coalesce(comun_seguridad.seg_usuario.usu_nombres, excluded.usu_nombres),
    usu_apellidos = coalesce(comun_seguridad.seg_usuario.usu_apellidos, excluded.usu_apellidos),
    usu_superadmin_plataforma = case
      when lower(excluded.usu_correo) in ('satcomla.ti@gmail.com', 'tinkay.uio@gmail.com') then false
      when v_es_superadmin then true
      else comun_seguridad.seg_usuario.usu_superadmin_plataforma
    end,
    usu_detalle_usuario = coalesce(comun_seguridad.seg_usuario.usu_detalle_usuario, '{}'::jsonb) || jsonb_build_object(
      'foto', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'foto'),
      'avatar_url', coalesce(v_avatar, comun_seguridad.seg_usuario.usu_detalle_usuario ->> 'avatar_url')
    ),
    usu_actualizado_en = now();

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
        mem_actualizado_en = now()
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

  return new;
end;
$$;

-- ------------------------------------------------------------------------------
-- 5. Corregir seg_fn_obtener_staff_negocio para filtrar estrictamente por negocio
-- ------------------------------------------------------------------------------
drop function if exists comun_seguridad.seg_fn_obtener_staff_negocio(text);
create or replace function comun_seguridad.seg_fn_obtener_staff_negocio(p_negocio text default 'tranqi')
returns table (
  usu_id uuid,
  usu_correo text,
  perfiles text[]
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
begin
  return query
  select
    u.usu_id,
    u.usu_correo,
    array_agg(distinct coalesce(p.per_clave, m.mem_rol, 'OPERADOR')) as perfiles
  from comun_seguridad.seg_usuario u
  join comun_seguridad.seg_membresia m
    on m.mem_usuario_id = u.usu_id
   and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio_canon
   and m.mem_estado = 'ACTIVO'
  left join comun_seguridad.seg_membresia_perfil mp
    on mp.mpe_membresia_id = m.mem_id
  left join comun_seguridad.seg_perfil p
    on p.per_id = mp.mpe_perfil_id
  where
    upper(coalesce(m.mem_rol, '')) in ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
    or upper(coalesce(p.per_clave, '')) in ('OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN', 'AUXILIAR')
  group by u.usu_id, u.usu_correo;
end;
$$;

grant execute on function comun_seguridad.seg_fn_obtener_staff_negocio(text) to authenticated, service_role, anon;

-- ------------------------------------------------------------------------------
-- 6. Normalizar seg_fn_asegurar_membresia_cliente para evitar duplicados upper/lower
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_asegurar_membresia_cliente(p_negocio text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_membresia_id uuid;
  v_perfil_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Sin sesion';
  end if;

  -- Reutilizar si ya existe membresía activa en cualquier alias de este mismo negocio
  select m.mem_id into v_membresia_id
  from comun_seguridad.seg_membresia m
  where m.mem_usuario_id = auth.uid()
    and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) = v_negocio_canon
  order by (m.mem_negocio = v_negocio_canon) desc, m.mem_creado_en asc
  limit 1;

  if v_membresia_id is null then
    insert into comun_seguridad.seg_membresia (mem_usuario_id, mem_negocio, mem_rol, mem_estado)
    values (auth.uid(), v_negocio_canon, 'CLIENTE', 'ACTIVO')
    on conflict (mem_usuario_id, mem_negocio) do update
      set mem_estado = 'ACTIVO',
          mem_actualizado_en = now()
    returning mem_id into v_membresia_id;
  else
    update comun_seguridad.seg_membresia
       set mem_actualizado_en = now()
     where mem_id = v_membresia_id;
  end if;

  select per_id into v_perfil_id
  from comun_seguridad.seg_perfil
  where per_clave = 'CLIENTE';

  if v_perfil_id is not null and v_membresia_id is not null then
    insert into comun_seguridad.seg_membresia_perfil (mpe_membresia_id, mpe_perfil_id)
    values (v_membresia_id, v_perfil_id)
    on conflict (mpe_membresia_id, mpe_perfil_id) do nothing;
  end if;

  perform comun_comercio.com_fn_asegurar_suscripcion_gratuita(auth.uid(), v_negocio_canon);
end;
$$;

revoke execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) from public;
grant execute on function comun_seguridad.seg_fn_asegurar_membresia_cliente(text) to authenticated;

-- ------------------------------------------------------------------------------
-- 7. Baja de cuenta aislada por negocio (PLT-012):
--    Elimina/anonimiza únicamente la relación del usuario con `p_negocio`.
--    Si no posee membresías en ningún otro negocio ni pagos fiscales que retener,
--    elimina también la credencial base de auth.users.
-- ------------------------------------------------------------------------------
create or replace function comun_seguridad.seg_fn_eliminar_cuenta_negocio(p_negocio text)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario_id uuid := auth.uid();
  v_negocio_canon text := comun_seguridad.seg_fn_normalizar_negocio(p_negocio);
  v_tiene_pagos_negocio boolean := false;
  v_tiene_pagos_globales boolean := false;
  v_membresias_otros_negocios integer := 0;
begin
  if v_usuario_id is null then
    raise exception 'Sesion no encontrada';
  end if;

  -- 1. Verificar si tiene órdenes/proformas con pago en este negocio
  if to_regclass('comun_comercio.com_proforma') is not null then
    select exists (
      select 1
      from comun_comercio.com_proforma prf
      where prf.prf_cliente_id = v_usuario_id
        and comun_seguridad.seg_fn_normalizar_negocio(prf.prf_negocio) = v_negocio_canon
        and prf.prf_eliminado_en is null
        and (
          upper(coalesce(prf.prf_estado, '')) in ('PAGADA', 'PAGADO', 'RESERVADA_70', 'APROBADA', 'FACTURADA', 'ORDEN_CONFIRMADA', 'DESPACHADO', 'ENTREGADO')
          or coalesce((prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
        )
    ) into v_tiene_pagos_negocio;

    -- Borrar lógicamente proformas en borrador/enviadas sin pago de este negocio
    update comun_comercio.com_proforma
       set prf_eliminado_en = now(),
           prf_estado = 'CANCELADA'
     where prf_cliente_id = v_usuario_id
       and comun_seguridad.seg_fn_normalizar_negocio(prf.prf_negocio) = v_negocio_canon
       and prf.prf_eliminado_en is null
       and not (
         upper(coalesce(prf.prf_estado, '')) in ('PAGADA', 'PAGADO', 'RESERVADA_70', 'APROBADA', 'FACTURADA', 'ORDEN_CONFIRMADA', 'DESPACHADO', 'ENTREGADO')
         or coalesce((prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
       );
  end if;

  -- 2. Eliminar membresía e historial de accesos de ESTE negocio únicamente
  delete from comun_seguridad.seg_membresia
   where mem_usuario_id = v_usuario_id
     and comun_seguridad.seg_fn_normalizar_negocio(mem_negocio) = v_negocio_canon;

  delete from comun_seguridad.seg_acceso
   where acc_usuario_id = v_usuario_id
     and comun_seguridad.seg_fn_normalizar_negocio(acc_negocio) = v_negocio_canon;

  -- Limpiar sub-perfil del negocio en usu_detalle_usuario.registros_negocio
  update comun_seguridad.seg_usuario
     set usu_detalle_usuario = jsonb_set(
           coalesce(usu_detalle_usuario, '{}'::jsonb),
           '{registros_negocio}',
           coalesce(usu_detalle_usuario->'registros_negocio', '{}'::jsonb) - v_negocio_canon,
           true
         ),
         usu_actualizado_en = now()
   where usu_id = v_usuario_id;

  -- 3. Revisar si mantiene cuentas activas en OTROS negocios independientes
  select count(*) into v_membresias_otros_negocios
  from comun_seguridad.seg_membresia m
  where m.mem_usuario_id = v_usuario_id
    and comun_seguridad.seg_fn_normalizar_negocio(m.mem_negocio) <> v_negocio_canon;

  if v_membresias_otros_negocios > 0 then
    return 'eliminada_en_negocio';
  end if;

  -- 4. Si ya no pertenece a ningún otro negocio, verificar retención contable/tributaria antes de hard-delete
  if to_regclass('comun_comercio.com_proforma') is not null then
    select exists (
      select 1
      from comun_comercio.com_proforma prf
      where prf.prf_cliente_id = v_usuario_id
        and prf.prf_eliminado_en is null
        and (
          upper(coalesce(prf.prf_estado, '')) in ('PAGADA', 'PAGADO', 'RESERVADA_70', 'APROBADA', 'FACTURADA', 'ORDEN_CONFIRMADA', 'DESPACHADO', 'ENTREGADO')
          or coalesce((prf.prf_detalle_proforma->>'monto_abonado_usd')::numeric, 0) > 0
        )
    ) into v_tiene_pagos_globales;
  end if;

  if v_tiene_pagos_negocio or v_tiene_pagos_globales then
    update comun_seguridad.seg_usuario
       set usu_nombres = 'Usuario',
           usu_apellidos = 'Anonimizado',
           usu_whatsapp = null,
           usu_autorizacion_whatsapp = false,
           usu_eliminado_en = now(),
           usu_detalle_usuario = jsonb_build_object('anonimizado_lopdp_en', now()),
           usu_actualizado_en = now()
     where usu_id = v_usuario_id;
    return 'anonimizada';
  end if;

  delete from auth.users where id = v_usuario_id;
  return 'eliminada';
end;
$$;

revoke execute on function comun_seguridad.seg_fn_eliminar_cuenta_negocio(text) from public;
grant execute on function comun_seguridad.seg_fn_eliminar_cuenta_negocio(text) to authenticated;
