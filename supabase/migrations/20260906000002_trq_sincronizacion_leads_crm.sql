-- ==============================================================================
-- Migración: 20260906000002_trq_sincronizacion_leads_crm.sql
-- Módulo: Sincronización Automática de Usuarios Web a Prospectos en el CRM Legal
-- Cumple: TRQ-CRM-001, PLT-001, PLT-003 y estándares de gobernanza del ecosistema.
-- ==============================================================================

-- 1. Función para crear ficha de prospecto en el CRM dado un nuevo usuario
create or replace function tranqui_legal.trq_fn_crear_prospecto_de_usuario()
returns trigger
language plpgsql
security definer
set search_path = tranqui_legal, comun_seguridad, public
as $$
declare
  v_identificacion text;
begin
  -- Si el usuario ya existe en trq_cliente_perfil, no hacer nada
  if exists (select 1 from tranqui_legal.trq_cliente_perfil where clp_usuario_id = new.usu_id) then
    return new;
  end if;

  -- Calcular identificación única provisional si no tiene cédula aún
  if new.usu_cedula is not null and trim(new.usu_cedula) <> '' then
    v_identificacion := trim(new.usu_cedula);
  else
    v_identificacion := 'WEB-' || upper(substr(new.usu_id::text, 1, 8));
  end if;

  -- Evitar colisión de identificación si la cédula ya estuviese registrada
  if exists (select 1 from tranqui_legal.trq_cliente_perfil where clp_identificacion = v_identificacion) then
    v_identificacion := 'WEB-' || upper(substr(new.usu_id::text, 1, 8));
  end if;

  insert into tranqui_legal.trq_cliente_perfil (
    clp_usuario_id,
    clp_tipo_personeria,
    clp_tipo_identificacion,
    clp_identificacion,
    clp_nombres,
    clp_apellidos,
    clp_correo,
    clp_celular,
    clp_origen_registro,
    clp_activo,
    clp_detalle_cliente
  ) values (
    new.usu_id,
    'natural',
    'cedula',
    v_identificacion,
    coalesce(nullif(trim(new.usu_nombres), ''), split_part(new.usu_correo, '@', 1)),
    coalesce(new.usu_apellidos, ''),
    new.usu_correo,
    new.usu_whatsapp,
    'web',
    true,
    jsonb_build_object(
      'estado_crm', 'PROSPECTO',
      'auto_lead_web', true,
      'fecha_prospecto', now()
    )
  )
  on conflict (clp_usuario_id) do nothing;

  return new;
exception
  when others then
    -- Nunca bloquear la creación de usuarios de auth/seguridad por fallos del CRM
    raise notice 'Aviso al auto-sincronizar prospecto CRM para %: %', new.usu_id, sqlerrm;
    return new;
end;
$$;

-- 2. Trigger en seg_usuario para capturar altas web automáticamente
drop trigger if exists trq_trg_seg_usuario_nuevo_prospecto on comun_seguridad.seg_usuario;

create trigger trq_trg_seg_usuario_nuevo_prospecto
after insert on comun_seguridad.seg_usuario
for each row
execute function tranqui_legal.trq_fn_crear_prospecto_de_usuario();

-- 3. Función RPC de sincronización masiva para backfill de usuarios existentes
create or replace function tranqui_legal.trq_fn_sincronizar_leads_crm()
returns table (
  total_sincronizados int,
  total_existentes int
)
language plpgsql
security definer
set search_path = tranqui_legal, comun_seguridad, public
as $$
declare
  r record;
  v_count int := 0;
  v_exist int := 0;
  v_ident text;
begin
  for r in
    select
      u.usu_id,
      u.usu_nombres,
      u.usu_apellidos,
      u.usu_correo,
      u.usu_whatsapp,
      u.usu_cedula
    from comun_seguridad.seg_usuario u
  loop
    if exists (select 1 from tranqui_legal.trq_cliente_perfil where clp_usuario_id = r.usu_id) then
      v_exist := v_exist + 1;
    else
      if r.usu_cedula is not null and trim(r.usu_cedula) <> '' then
        v_ident := trim(r.usu_cedula);
      else
        v_ident := 'WEB-' || upper(substr(r.usu_id::text, 1, 8));
      end if;

      if exists (select 1 from tranqui_legal.trq_cliente_perfil where clp_identificacion = v_ident) then
        v_ident := 'WEB-' || upper(substr(r.usu_id::text, 1, 8));
      end if;

      insert into tranqui_legal.trq_cliente_perfil (
        clp_usuario_id,
        clp_tipo_personeria,
        clp_tipo_identificacion,
        clp_identificacion,
        clp_nombres,
        clp_apellidos,
        clp_correo,
        clp_celular,
        clp_origen_registro,
        clp_activo,
        clp_detalle_cliente
      ) values (
        r.usu_id,
        'natural',
        'cedula',
        v_ident,
        coalesce(nullif(trim(r.usu_nombres), ''), split_part(r.usu_correo, '@', 1)),
        coalesce(r.usu_apellidos, ''),
        r.usu_correo,
        r.usu_whatsapp,
        'web',
        true,
        jsonb_build_object(
          'estado_crm', 'PROSPECTO',
          'auto_lead_web', true,
          'fecha_prospecto', now()
        )
      )
      on conflict (clp_usuario_id) do nothing;

      v_count := v_count + 1;
    end if;
  end loop;

  return query select v_count, v_exist;
end;
$$;

-- Otorgar permisos de ejecución para staff y service_role
grant execute on function tranqui_legal.trq_fn_sincronizar_leads_crm() to authenticated, service_role;

-- 4. Ejecutar la sincronización inmediata del estado actual
select tranqui_legal.trq_fn_sincronizar_leads_crm();
