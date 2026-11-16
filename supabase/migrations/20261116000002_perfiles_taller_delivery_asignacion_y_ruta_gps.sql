-- ==============================================================================
-- Migración: 20261116000002_perfiles_taller_delivery_asignacion_y_ruta_gps.sql
-- Requerimientos: PLT-011 / PLT-009 / TNK-005 (Aislamiento por Rol Taller, Delivery Interno/Subcontratado, PWA Única y GPS en Ruta)
-- Descripción:
--   1. Perfiles dedicados `TALLER`, `DELIVERY` (Interno), `DELIVERY_EXTERNO` (Subcontratado) y `VENTAS` en comun_seguridad.seg_perfil.
--   2. Función canónica `comun_seguridad.seg_fn_obtener_rol_operativo_negocio` y refuerzo de `seg_fn_es_delivery_o_staff_negocio` (Regla 6: Rol != capacidad).
--   3. Columnas de asignación de repartidor y rastreo GPS en vivo en ruta (`ota_repartidor_*`, `ota_en_ruta`, `ota_ruta_*`, `ent_repartidor_*`, `ent_en_ruta`).
--   4. RPCs transaccionales `com_fn_asignar_repartidor_entrega` y `com_fn_actualizar_ubicacion_ruta_delivery` + cierre automático de ruta al confirmar entrega.
--   5. Aislamiento SQL en `com_fn_obtener_consola_taller_y_despacho` (oculta montos a TALLER y bloquea DELIVERY) y `com_fn_obtener_tablero_entregas` (DELIVERY_EXTERNO solo ve asignados).
--   6. Pre-configuración de `seg_rol_widget` por mínimo privilegio (Regla 15).
-- ==============================================================================

-- 1. Semilla idempotente de perfiles operativos en comun_seguridad.seg_perfil
insert into comun_seguridad.seg_perfil (per_clave, per_nombre, per_nivel, per_activo, per_asignable)
values
  ('DELIVERY_EXTERNO', 'Delivery Subcontratado', 12, true, true),
  ('DELIVERY', 'Delivery Interno', 15, true, true),
  ('TALLER', 'Taller Floral', 18, true, true),
  ('VENTAS', 'Ventas / Asesor Comercial', 20, true, true)
on conflict (per_clave) do update set
  per_nombre = excluded.per_nombre,
  per_nivel = excluded.per_nivel,
  per_activo = true,
  per_asignable = true;

-- 2. Función canónica para resolver el rol operativo efectivo del usuario autenticado en un negocio
create or replace function comun_seguridad.seg_fn_obtener_rol_operativo_negocio(p_negocio text)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_es_super boolean := false;
  v_correo text := '';
  v_roles text[];
begin
  if v_uid is null then
    return 'ANONIMO';
  end if;

  select coalesce(u.usu_superadmin_plataforma, false), lower(btrim(coalesce(u.usu_correo, '')))
    into v_es_super, v_correo
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  if v_es_super then
    return 'SUPERADMIN';
  end if;

  if lower(btrim(coalesce(p_negocio, ''))) in ('tinkay', 'tnk')
     and v_correo = 'tinkay.uio@gmail.com' then
    return 'ADMINISTRADOR';
  end if;

  select coalesce(
    array_agg(distinct upper(r.clave)) filter (where r.clave is not null and btrim(r.clave) <> ''),
    array[]::text[]
  )
  into v_roles
  from (
    select m.mem_rol as clave
      from comun_seguridad.seg_membresia m
     where m.mem_usuario_id = v_uid
       and m.mem_estado = 'ACTIVO'
       and (
         upper(m.mem_negocio) = upper(p_negocio)
         or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
         or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
         or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
         or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
       )
    union all
    select p.per_clave as clave
      from comun_seguridad.seg_membresia m
      join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
      join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
     where m.mem_usuario_id = v_uid
       and m.mem_estado = 'ACTIVO'
       and p.per_activo = true
       and (
         upper(m.mem_negocio) = upper(p_negocio)
         or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
         or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
         or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
         or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
       )
  ) r;

  if v_roles && array['SUPERADMIN'] then
    return 'SUPERADMIN';
  elsif v_roles && array['ADMINISTRADOR', 'ADMIN'] then
    return 'ADMINISTRADOR';
  elsif v_roles && array['OPERADOR', 'AUXILIAR', 'TECNICO'] then
    return 'OPERADOR';
  elsif v_roles && array['VENTAS', 'VENDEDOR', 'ASESOR'] then
    return 'VENTAS';
  elsif v_roles && array['TALLER', 'FLORISTA'] then
    return 'TALLER';
  elsif v_roles && array['DELIVERY', 'REPARTIDOR'] then
    return 'DELIVERY';
  elsif v_roles && array['DELIVERY_EXTERNO', 'SUBCONTRATADO'] then
    return 'DELIVERY_EXTERNO';
  end if;

  return 'CLIENTE';
end;
$$;

grant execute on function comun_seguridad.seg_fn_obtener_rol_operativo_negocio(text) to authenticated, service_role;

-- Actualizar seg_fn_es_delivery_o_staff_negocio para incluir TALLER y DELIVERY_EXTERNO
create or replace function comun_seguridad.seg_fn_es_delivery_o_staff_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_obtener_rol_operativo_negocio(p_negocio) in (
    'SUPERADMIN',
    'ADMINISTRADOR',
    'OPERADOR',
    'VENTAS',
    'TALLER',
    'DELIVERY',
    'DELIVERY_EXTERNO'
  );
$$;

grant execute on function comun_seguridad.seg_fn_es_delivery_o_staff_negocio(text) to authenticated, service_role;

-- 3. Columnas de asignación de repartidor y GPS en vivo en ruta (idempotente)
do $$
begin
  if to_regclass('comun_comercio.com_orden_taller') is not null then
    alter table comun_comercio.com_orden_taller
      add column if not exists ota_repartidor_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
      add column if not exists ota_repartidor_nombre text,
      add column if not exists ota_repartidor_tipo text,
      add column if not exists ota_en_ruta boolean not null default false,
      add column if not exists ota_en_ruta_desde timestamptz,
      add column if not exists ota_ruta_latitud numeric(10,7),
      add column if not exists ota_ruta_longitud numeric(10,7),
      add column if not exists ota_ruta_precision numeric(8,2),
      add column if not exists ota_ruta_actualizada_en timestamptz;
  end if;

  if to_regclass('comun_comercio.com_entrega_evidencia') is not null then
    alter table comun_comercio.com_entrega_evidencia
      add column if not exists ent_repartidor_asignado_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
      add column if not exists ent_repartidor_asignado_nombre text,
      add column if not exists ent_repartidor_tipo text,
      add column if not exists ent_en_ruta boolean not null default false,
      add column if not exists ent_ruta_latitud numeric(10,7),
      add column if not exists ent_ruta_longitud numeric(10,7),
      add column if not exists ent_ruta_actualizada_en timestamptz;
  end if;
end $$;

create index if not exists idx_com_orden_taller_repartidor
  on comun_comercio.com_orden_taller (ota_negocio, ota_repartidor_id, ota_estado_taller)
  where ota_eliminado_en is null;

create index if not exists idx_com_entrega_evidencia_repartidor
  on comun_comercio.com_entrega_evidencia (ent_negocio, ent_repartidor_asignado_id, ent_estado)
  where ent_eliminado_en is null;

-- 4. RPC para listar repartidores disponibles del negocio (Internos y Subcontratados)
create or replace function comun_comercio.com_fn_listar_repartidores_negocio(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_lista jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'DELIVERY', 'DELIVERY_EXTERNO') then
    return '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(sub.item order by sub.modalidad asc, sub.nombre asc), '[]'::jsonb)
  into v_lista
  from (
    select distinct on (u.usu_id)
      u.usu_id,
      coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Repartidor') as nombre,
      case
        when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY_EXTERNO', 'SUBCONTRATADO') then 'EXTERNO'
        else 'INTERNO'
      end as modalidad,
      jsonb_build_object(
        'usuarioId', u.usu_id,
        'nombre', coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Repartidor'),
        'correo', u.usu_correo,
        'modalidad', case
          when upper(coalesce(p.per_clave, m.mem_rol, '')) in ('DELIVERY_EXTERNO', 'SUBCONTRATADO') then 'EXTERNO'
          else 'INTERNO'
        end
      ) as item
    from comun_seguridad.seg_membresia m
    join comun_seguridad.seg_usuario u on u.usu_id = m.mem_usuario_id
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_estado = 'ACTIVO'
      and (
        lower(m.mem_negocio) = v_negocio
        or (v_negocio = 'tinkay' and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (v_negocio = 'margaritas' and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and (
        upper(coalesce(m.mem_rol, '')) in ('DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO', 'SUBCONTRATADO')
        or upper(coalesce(p.per_clave, '')) in ('DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO', 'SUBCONTRATADO')
      )
  ) sub;

  return v_lista;
end;
$$;

grant execute on function comun_comercio.com_fn_listar_repartidores_negocio(text) to authenticated, service_role;

-- 5. RPC para asignar repartidor (o auto-asignarse como Delivery Interno)
create or replace function comun_comercio.com_fn_asignar_repartidor_entrega(
  p_negocio text,
  p_orden_taller_id uuid default null,
  p_entrega_id uuid default null,
  p_repartidor_id uuid default null,
  p_repartidor_nombre text default null,
  p_repartidor_tipo text default 'INTERNO'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_rep_nombre text := nullif(btrim(coalesce(p_repartidor_nombre, '')), '');
  v_rep_tipo text := case when upper(coalesce(p_repartidor_tipo, '')) in ('EXTERNO', 'SUBCONTRATADO', 'DELIVERY_EXTERNO') then 'EXTERNO' else 'INTERNO' end;
  v_ent_link uuid := p_entrega_id;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'DELIVERY') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para asignar repartidor.');
  end if;

  -- Si es DELIVERY interno solo puede auto-asignarse a sí mismo un pedido sin repartidor previo
  if v_rol = 'DELIVERY' and p_repartidor_id is distinct from v_uid then
    return jsonb_build_object('ok', false, 'error', 'El repartidor interno solo puede tomar pedidos para sí mismo.');
  end if;

  if p_repartidor_id is not null and v_rep_nombre is null then
    select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Delivery')
      into v_rep_nombre
      from comun_seguridad.seg_usuario u
     where u.usu_id = p_repartidor_id;
  end if;

  if p_repartidor_id is null then
    v_rep_nombre := null;
    v_rep_tipo := null;
  end if;

  if p_orden_taller_id is not null then
    update comun_comercio.com_orden_taller
       set ota_repartidor_id = p_repartidor_id,
           ota_repartidor_nombre = v_rep_nombre,
           ota_repartidor_tipo = v_rep_tipo,
           ota_actualizado_en = now()
     where ota_id = p_orden_taller_id
       and ota_negocio = v_negocio
       and (v_rol <> 'DELIVERY' or ota_repartidor_id is null or ota_repartidor_id = v_uid)
     returning coalesce(ota_entrega_id, v_ent_link) into v_ent_link;
  end if;

  if v_ent_link is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_repartidor_asignado_id = p_repartidor_id,
           ent_repartidor_asignado_nombre = v_rep_nombre,
           ent_repartidor_tipo = v_rep_tipo,
           ent_entregador_nombre = coalesce(v_rep_nombre, 'Por asignar'),
           ent_actualizado_en = now()
     where ent_id = v_ent_link
       and ent_negocio = v_negocio
       and (v_rol <> 'DELIVERY' or ent_repartidor_asignado_id is null or ent_repartidor_asignado_id = v_uid);

    if p_orden_taller_id is null then
      update comun_comercio.com_orden_taller
         set ota_repartidor_id = p_repartidor_id,
             ota_repartidor_nombre = v_rep_nombre,
             ota_repartidor_tipo = v_rep_tipo,
             ota_actualizado_en = now()
       where ota_entrega_id = v_ent_link
         and ota_negocio = v_negocio;
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'repartidorId', p_repartidor_id,
    'repartidorNombre', v_rep_nombre,
    'repartidorTipo', v_rep_tipo
  );
end;
$$;

grant execute on function comun_comercio.com_fn_asignar_repartidor_entrega(text, uuid, uuid, uuid, text, text) to authenticated, service_role;

-- 6. RPC para iniciar/detener ruta y actualizar coordenadas GPS en vivo del repartidor
create or replace function comun_comercio.com_fn_actualizar_ubicacion_ruta_delivery(
  p_negocio text,
  p_orden_taller_id uuid default null,
  p_entrega_id uuid default null,
  p_proforma_id uuid default null,
  p_en_ruta boolean default true,
  p_latitud numeric default null,
  p_longitud numeric default null,
  p_precision numeric default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_usu_nombre text;
  v_ota_id uuid := p_orden_taller_id;
  v_ent_id uuid := p_entrega_id;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'DELIVERY', 'DELIVERY_EXTERNO') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para reportar ruta GPS.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), split_part(u.usu_correo, '@', 1), 'Delivery')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  if v_ota_id is null and p_proforma_id is not null then
    select o.ota_id, coalesce(v_ent_id, o.ota_entrega_id)
      into v_ota_id, v_ent_id
      from comun_comercio.com_orden_taller o
     where o.ota_negocio = v_negocio
       and (o.ota_proforma_id = p_proforma_id or o.ota_id = p_proforma_id)
       and o.ota_eliminado_en is null
     limit 1;
  end if;

  if v_ota_id is null and v_ent_id is not null then
    select o.ota_id
      into v_ota_id
      from comun_comercio.com_orden_taller o
     where o.ota_negocio = v_negocio
       and o.ota_entrega_id = v_ent_id
       and o.ota_eliminado_en is null
     limit 1;
  end if;

  if v_ota_id is not null then
    update comun_comercio.com_orden_taller
       set ota_en_ruta = coalesce(p_en_ruta, true),
           ota_en_ruta_desde = case
             when coalesce(p_en_ruta, true) then coalesce(ota_en_ruta_desde, now())
             else ota_en_ruta_desde
           end,
           ota_repartidor_id = coalesce(ota_repartidor_id, v_uid),
           ota_repartidor_nombre = coalesce(ota_repartidor_nombre, v_usu_nombre),
           ota_repartidor_tipo = coalesce(ota_repartidor_tipo, case when v_rol = 'DELIVERY_EXTERNO' then 'EXTERNO' else 'INTERNO' end),
           ota_ruta_latitud = coalesce(p_latitud, ota_ruta_latitud),
           ota_ruta_longitud = coalesce(p_longitud, ota_ruta_longitud),
           ota_ruta_precision = coalesce(p_precision, ota_ruta_precision),
           ota_ruta_actualizada_en = case when p_latitud is not null and p_longitud is not null then now() else ota_ruta_actualizada_en end,
           ota_actualizado_en = now()
     where ota_id = v_ota_id
       and ota_negocio = v_negocio
       and (v_rol <> 'DELIVERY_EXTERNO' or ota_repartidor_id = v_uid)
     returning coalesce(v_ent_id, ota_entrega_id) into v_ent_id;
  end if;

  if v_ent_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_en_ruta = coalesce(p_en_ruta, true),
           ent_repartidor_asignado_id = coalesce(ent_repartidor_asignado_id, v_uid),
           ent_repartidor_asignado_nombre = coalesce(ent_repartidor_asignado_nombre, v_usu_nombre),
           ent_repartidor_tipo = coalesce(ent_repartidor_tipo, case when v_rol = 'DELIVERY_EXTERNO' then 'EXTERNO' else 'INTERNO' end),
           ent_ruta_latitud = coalesce(p_latitud, ent_ruta_latitud),
           ent_ruta_longitud = coalesce(p_longitud, ent_ruta_longitud),
           ent_ruta_actualizada_en = case when p_latitud is not null and p_longitud is not null then now() else ent_ruta_actualizada_en end,
           ent_actualizado_en = now()
     where ent_id = v_ent_id
       and ent_negocio = v_negocio
       and (v_rol <> 'DELIVERY_EXTERNO' or ent_repartidor_asignado_id = v_uid);
  end if;

  return jsonb_build_object(
    'ok', true,
    'enRuta', coalesce(p_en_ruta, true),
    'repartidorNombre', v_usu_nombre,
    'actualizadoEn', now()
  );
end;
$$;

grant execute on function comun_comercio.com_fn_actualizar_ubicacion_ruta_delivery(text, uuid, uuid, uuid, boolean, numeric, numeric, numeric) to authenticated, service_role;

-- 7. Reforzar com_fn_obtener_consola_taller_y_despacho (oculta precios a TALLER y bloquea DELIVERY)
create or replace function comun_comercio.com_fn_obtener_consola_taller_y_despacho(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_solo_taller boolean := (v_rol = 'TALLER');
  v_usu_nombre text;
  v_ordenes jsonb;
  v_productos jsonb;
  v_repartidores jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'TALLER') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder a Pedidos y Taller.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_ordenes
  from (
    select jsonb_build_object(
      'id', o.ota_id,
      'codigo', o.ota_codigo,
      'origenTipo', o.ota_origen_tipo,
      'proformaId', o.ota_proforma_id,
      'entregaId', o.ota_entrega_id,
      'estadoTaller', o.ota_estado_taller,
      'estadoPago', case when v_es_solo_taller then 'VALIDADO' else coalesce(p.prf_estado, o.ota_estado_pago) end,
      'metodoPago', case when v_es_solo_taller then null else o.ota_metodo_pago end,
      'fechaPedido', o.ota_fecha_pedido,
      'fechaEntrega', to_char(o.ota_fecha_entrega, 'YYYY-MM-DD'),
      'fechaElaboracion', case when o.ota_fecha_elaboracion is not null then to_char(o.ota_fecha_elaboracion, 'YYYY-MM-DD') else null end,
      'franjaHoraria', o.ota_franja_horaria,
      'horaEspecifica', o.ota_hora_especifica,
      'productoResumen', o.ota_producto_resumen,
      'items', coalesce(o.ota_items, '[]'::jsonb),
      'clienteSolicita', o.ota_cliente_solicita,
      'clienteTelefono', case when v_es_solo_taller then null else o.ota_cliente_telefono end,
      'destinatarioFallecido', o.ota_destinatario_fallecido,
      'salaServicio', o.ota_sala_servicio,
      'ubicacionEntrega', o.ota_ubicacion_entrega,
      'enlaceMapa', o.ota_enlace_mapa,
      'retiroEnLocal', o.ota_retiro_en_local,
      'dedicatoria', o.ota_dedicatoria,
      'observaciones', o.ota_observaciones,
      'totalUsd', case when v_es_solo_taller then 0 else o.ota_total_usd end,
      'enviadoTallerEn', o.ota_enviado_taller_en,
      'enviadoNombre', o.ota_enviado_nombre,
      'preparacionEn', o.ota_preparacion_en,
      'listoEn', o.ota_listo_en,
      'entregadoEn', o.ota_entregado_en,
      'actualizadoTallerNombre', o.ota_actualizado_taller_nombre,
      'repartidorId', o.ota_repartidor_id,
      'repartidorNombre', o.ota_repartidor_nombre,
      'repartidorTipo', o.ota_repartidor_tipo,
      'enRuta', coalesce(o.ota_en_ruta, false),
      'enRutaDesde', o.ota_en_ruta_desde,
      'rutaLatitud', o.ota_ruta_latitud,
      'rutaLongitud', o.ota_ruta_longitud,
      'rutaActualizadaEn', o.ota_ruta_actualizada_en
    ) as item
    from comun_comercio.com_orden_taller o
    left join comun_comercio.com_proforma p on p.prf_id = o.ota_proforma_id
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and (not v_es_solo_taller or o.ota_estado_taller <> 'PENDIENTE_ENVIO')
    order by
      o.ota_fecha_entrega asc,
      (case when o.ota_origen_tipo = 'EXEQUIALES_LLAMADA' then 0 else 1 end) asc,
      o.ota_creado_en desc
    limit 500
  ) sub;

  if v_es_solo_taller then
    v_productos := '[]'::jsonb;
    v_repartidores := '[]'::jsonb;
  else
    select coalesce(jsonb_agg(sub.prod), '[]'::jsonb)
    into v_productos
    from (
      select jsonb_build_object(
        'productoId', pr.pro_id,
        'productoNombre', pr.pro_nombre,
        'varianteId', v.var_id,
        'sku', coalesce(v.var_sku, pr.pro_slug),
        'varianteNombre', coalesce(v.var_nombre, 'Estándar'),
        'pvp', coalesce(v.var_precio, 0),
        'portadaUrl', coalesce(v.var_detalle_variante->>'portada_url', pr.pro_detalle_producto->>'portada_url')
      ) as prod
      from comun_comercio.com_producto pr
      join comun_comercio.com_variante v
        on v.var_producto_id = pr.pro_id
       and v.var_activo = true
       and v.var_eliminado_en is null
      where lower(pr.pro_negocio) = v_negocio
        and pr.pro_activo = true
        and pr.pro_eliminado_en is null
      order by pr.pro_nombre asc, v.var_orden asc
      limit 250
    ) sub;

    v_repartidores := comun_comercio.com_fn_listar_repartidores_negocio(v_negocio);
  end if;

  return jsonb_build_object(
    'ok', true,
    'rolOperativo', v_rol,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Operador'),
    'ordenes', v_ordenes,
    'productosCatalogo', v_productos,
    'repartidoresNegocio', v_repartidores
  );
end;
$$;

-- 8. Restringir despacho de pedidos solo a VENTAS / OPERADOR / ADMINISTRADOR / SUPERADMIN
create or replace function comun_comercio.com_fn_enviar_pedidos_a_taller(
  p_negocio text,
  p_ids uuid[]
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_usu_nombre text;
  v_total int := 0;
  v_codigos text[];
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para enviar pedidos a Taller.');
  end if;

  if p_ids is null or array_length(p_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Selecciona al menos un pedido para enviar a Taller.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Operador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  with actualizadas as (
    update comun_comercio.com_orden_taller
       set ota_estado_taller = case
             when ota_estado_taller = 'PENDIENTE_ENVIO' then 'ENVIADO_TALLER'
             else ota_estado_taller
           end,
           ota_fecha_elaboracion = coalesce(ota_fecha_elaboracion, (now() at time zone 'America/Guayaquil')::date),
           ota_enviado_taller_en = coalesce(ota_enviado_taller_en, now()),
           ota_enviado_por = coalesce(ota_enviado_por, v_uid),
           ota_enviado_nombre = coalesce(ota_enviado_nombre, v_usu_nombre),
           ota_actualizado_en = now()
     where ota_negocio = v_negocio
       and ota_id = any(p_ids)
       and ota_eliminado_en is null
     returning ota_id, ota_codigo, ota_proforma_id
  )
  select count(*), coalesce(array_agg(ota_codigo), array[]::text[])
    into v_total, v_codigos
    from actualizadas;

  update comun_comercio.com_proforma p
     set prf_detalle_proforma = coalesce(p.prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
           'estado_taller', 'ENVIADO_TALLER',
           'enviado_taller_en', now()
         ),
         prf_actualizado_en = now()
    from comun_comercio.com_orden_taller o
   where o.ota_proforma_id = p.prf_id
     and o.ota_id = any(p_ids)
     and o.ota_negocio = v_negocio;

  return jsonb_build_object(
    'ok', true,
    'enviados', v_total,
    'codigos', to_jsonb(v_codigos)
  );
end;
$$;

-- 9. Reforzar com_fn_obtener_tablero_entregas:
--    * DELIVERY_EXTERNO (Subcontratado): SOLO ve entregas/pedidos asignados explícitamente a su usuario o entregados por él.
--    * DELIVERY (Interno): ve pedidos pendientes/listos sin repartidor + los asignados a él (sin informes quincenales ni precios).
--    * TALLER: bloqueado en esta pantalla.
create or replace function comun_comercio.com_fn_obtener_tablero_entregas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_rol text := comun_seguridad.seg_fn_obtener_rol_operativo_negocio(v_negocio);
  v_es_admin boolean := (v_rol in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR'));
  v_es_subcontratado boolean := (v_rol = 'DELIVERY_EXTERNO');
  v_es_delivery_interno boolean := (v_rol = 'DELIVERY');
  v_usu_nombre text;
  v_convenios jsonb;
  v_entregas jsonb;
  v_informes jsonb;
  v_pedidos_pendientes jsonb;
begin
  if v_rol not in ('SUPERADMIN', 'ADMINISTRADOR', 'OPERADOR', 'VENTAS', 'DELIVERY', 'DELIVERY_EXTERNO') then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder al módulo de entregas.');
  end if;

  perform comun_comercio.com_fn_sincronizar_ventas_a_ordenes_taller(v_negocio);

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Colaborador')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', c.cve_id,
      'codigo', c.cve_codigo,
      'nombre', c.cve_nombre,
      'prefijoInforme', c.cve_prefijo_informe,
      'siguienteNumero', c.cve_siguiente_numero,
      'datosProveedor', case when v_es_admin then c.cve_datos_proveedor else '{}'::jsonb end
    ) order by c.cve_secuencial asc
  ), '[]'::jsonb)
  into v_convenios
  from comun_comercio.com_convenio_entrega c
  where c.cve_negocio = v_negocio
    and c.cve_activo = true
    and c.cve_eliminado_en is null;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_entregas
  from (
    select jsonb_build_object(
      'id', e.ent_id,
      'secuencial', e.ent_secuencial,
      'uuidCliente', e.ent_uuid_cliente,
      'codigoOt', coalesce(e.ent_codigo_ot, 'OT-' || lpad(e.ent_secuencial::text, 4, '0')),
      'tipoOrigen', e.ent_tipo_origen,
      'convenioId', e.ent_convenio_id,
      'proformaId', e.ent_proforma_id,
      'ordenTallerId', coalesce(e.ent_orden_taller_id, ot.ota_id),
      'estadoTaller', coalesce(ot.ota_estado_taller, e.ent_detalle_entrega->>'estado_taller'),
      'horaSolicitada', coalesce(e.ent_hora_solicitada, ot.ota_hora_especifica, e.ent_detalle_entrega->>'hora_solicitada'),
      'entregadoPor', e.ent_entregado_por,
      'entregadorNombre', e.ent_entregador_nombre,
      'repartidorAsignadoId', coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id),
      'repartidorAsignadoNombre', coalesce(e.ent_repartidor_asignado_nombre, ot.ota_repartidor_nombre),
      'repartidorTipo', coalesce(e.ent_repartidor_tipo, ot.ota_repartidor_tipo),
      'enRuta', (coalesce(e.ent_en_ruta, false) or coalesce(ot.ota_en_ruta, false)),
      'rutaLatitud', coalesce(e.ent_ruta_latitud, ot.ota_ruta_latitud),
      'rutaLongitud', coalesce(e.ent_ruta_longitud, ot.ota_ruta_longitud),
      'rutaActualizadaEn', coalesce(e.ent_ruta_actualizada_en, ot.ota_ruta_actualizada_en),
      'fallecidoDestinatario', e.ent_fallecido_destinatario,
      'fechaServicio', e.ent_fecha_servicio,
      'capturadoEn', e.ent_capturado_en,
      'sincronizadoEn', e.ent_sincronizado_en,
      'descripcionServicio', e.ent_descripcion_servicio,
      'salaServicio', coalesce(e.ent_sala_servicio, ot.ota_sala_servicio, e.ent_detalle_entrega->>'sala_servicio'),
      'ubicacionNombre', e.ent_ubicacion_nombre,
      'coordinadorNombre', coalesce(e.ent_coordinador_nombre, ot.ota_cliente_solicita),
      'recursosUtilizados', e.ent_recursos_utilizados,
      'latitud', e.ent_latitud,
      'longitud', e.ent_longitud,
      'precisionMetros', e.ent_precision_metros,
      'direccionGps', e.ent_direccion_gps,
      'fotoUrl', e.ent_foto_url,
      'mapaUrl', e.ent_mapa_url,
      'facturaReferencia', case when v_es_admin then e.ent_factura_referencia else null end,
      'documentosAdjuntos', case when v_es_admin then e.ent_documentos_adjuntos else null end,
      'observaciones', e.ent_observaciones,
      'informeId', e.ent_informe_id,
      'numeroInforme', case when v_es_admin then i.ife_numero_informe else null end,
      'estado', e.ent_estado
    ) as item
    from comun_comercio.com_entrega_evidencia e
    left join comun_comercio.com_informe_entregas i on i.ife_id = e.ent_informe_id
    left join comun_comercio.com_orden_taller ot
      on ot.ota_entrega_id = e.ent_id
     and ot.ota_eliminado_en is null
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
      and (
        (not v_es_subcontratado and not v_es_delivery_interno)
        or (
          v_es_subcontratado
          and (
            coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid
            or e.ent_entregado_por = v_uid
          )
        )
        or (
          v_es_delivery_interno
          and (
            (e.ent_estado = 'PROGRAMADA' and (coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) is null or coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid))
            or e.ent_entregado_por = v_uid
            or coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid
          )
        )
      )
    order by
      (case when coalesce(e.ent_repartidor_asignado_id, ot.ota_repartidor_id) = v_uid and e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      (case when e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
      (case when coalesce(ot.ota_estado_taller, '') = 'LISTO_ENTREGA' then 0 else 1 end) asc,
      e.ent_fecha_servicio desc,
      e.ent_creado_en desc
    limit 400
  ) sub;

  if v_es_admin then
    select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
    into v_informes
    from (
      select jsonb_build_object(
        'id', i.ife_id,
        'secuencial', i.ife_secuencial,
        'convenioId', i.ife_convenio_id,
        'numeroInforme', i.ife_numero_informe,
        'fechaInforme', i.ife_fecha_informe,
        'fechaInicio', i.ife_fecha_inicio,
        'fechaFin', i.ife_fecha_fin,
        'totalEntregas', i.ife_total_entregas,
        'facturaReferencia', i.ife_factura_referencia,
        'documentosAdjuntos', i.ife_documentos_adjuntos,
        'estado', i.ife_estado,
        'pdfUrl', i.ife_pdf_url,
        'generadoNombre', i.ife_generado_nombre,
        'detalleInforme', i.ife_detalle_informe,
        'creadoEn', i.ife_creado_en
      ) as item
      from comun_comercio.com_informe_entregas i
      where i.ife_negocio = v_negocio
        and i.ife_eliminado_en is null
      order by i.ife_creado_en desc
      limit 120
    ) sub;
  else
    v_informes := '[]'::jsonb;
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_pedidos_pendientes
  from (
    select jsonb_build_object(
      'proformaId', coalesce(o.ota_proforma_id, o.ota_id),
      'ordenTallerId', o.ota_id,
      'codigoOrden', o.ota_codigo,
      'estadoPago', case when v_es_subcontratado or v_es_delivery_interno then 'VALIDADO' else o.ota_estado_pago end,
      'estadoTaller', o.ota_estado_taller,
      'fechaEntrega', to_char(o.ota_fecha_entrega, 'YYYY-MM-DD'),
      'franjaHoraria', o.ota_franja_horaria,
      'compradorNombre', o.ota_cliente_solicita,
      'destinatarioNombre', coalesce(nullif(o.ota_destinatario_fallecido, ''), o.ota_cliente_solicita),
      'destinatarioTelefono', coalesce(o.ota_cliente_telefono, ''),
      'direccionEntrega', coalesce(nullif(o.ota_ubicacion_entrega, ''), 'Retiro / Coordinar dirección'),
      'enlaceMapa', o.ota_enlace_mapa,
      'resumenItems', o.ota_producto_resumen,
      'repartidorAsignadoId', o.ota_repartidor_id,
      'repartidorAsignadoNombre', o.ota_repartidor_nombre,
      'repartidorTipo', o.ota_repartidor_tipo,
      'enRuta', coalesce(o.ota_en_ruta, false),
      'rutaLatitud', o.ota_ruta_latitud,
      'rutaLongitud', o.ota_ruta_longitud,
      'rutaActualizadaEn', o.ota_ruta_actualizada_en,
      'creadoEn', o.ota_creado_en
    ) as item
    from comun_comercio.com_orden_taller o
    where o.ota_negocio = v_negocio
      and o.ota_eliminado_en is null
      and o.ota_origen_tipo <> 'EXEQUIALES_LLAMADA'
      and o.ota_estado_taller not in ('ENTREGADO', 'ANULADO')
      and (
        (not v_es_subcontratado and not v_es_delivery_interno)
        or (v_es_subcontratado and o.ota_repartidor_id = v_uid)
        or (
          v_es_delivery_interno
          and o.ota_estado_taller <> 'PENDIENTE_ENVIO'
          and (o.ota_repartidor_id is null or o.ota_repartidor_id = v_uid)
        )
      )
    order by
      (case when o.ota_repartidor_id = v_uid then 0 else 1 end) asc,
      (case when o.ota_estado_taller = 'LISTO_ENTREGA' then 0 when o.ota_estado_taller = 'EN_PREPARACION' then 1 else 2 end) asc,
      o.ota_fecha_entrega asc,
      o.ota_creado_en desc
    limit 120
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualId', v_uid,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Colaborador'),
    'rolOperativo', v_rol,
    'esAdminOperador', v_es_admin,
    'esSubcontratado', v_es_subcontratado,
    'convenios', v_convenios,
    'entregas', v_entregas,
    'informes', v_informes,
    'pedidosPendientesTienda', v_pedidos_pendientes
  );
end;
$$;

-- 10. Trigger para apagar automáticamente `en_ruta = false` al marcar ENTREGADO
create or replace function comun_comercio.com_fn_trg_cerrar_ruta_al_entregar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ota_estado_taller in ('ENTREGADO', 'ANULADO') then
    new.ota_en_ruta := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cerrar_ruta_orden_taller on comun_comercio.com_orden_taller;
create trigger trg_cerrar_ruta_orden_taller
  before update on comun_comercio.com_orden_taller
  for each row execute function comun_comercio.com_fn_trg_cerrar_ruta_al_entregar();

create or replace function comun_comercio.com_fn_trg_cerrar_ruta_evidencia()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ent_estado <> 'PROGRAMADA' then
    new.ent_en_ruta := false;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_cerrar_ruta_evidencia on comun_comercio.com_entrega_evidencia;
create trigger trg_cerrar_ruta_evidencia
  before update on comun_comercio.com_entrega_evidencia
  for each row execute function comun_comercio.com_fn_trg_cerrar_ruta_evidencia();

-- 11. Pre-configuración estricta de seg_rol_widget por rol operativo (Regla 15)
do $$
declare
  v_negocio text;
  v_w record;
begin
  for v_negocio in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
    -- 11.1 TALLER: Taller Floral + Inventario de Rosas + Entrega Inmediata
    for v_w in
      select wdg_id, wdg_clave
      from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio
        and wdg_clave in ('taller_floral', 'inventario_rosas', 'galeria_inmediata')
    loop
      insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      values (v_negocio, 'TALLER', v_w.wdg_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end loop;

    -- 11.2 DELIVERY y DELIVERY_EXTERNO: únicamente Confirmación de Entregas
    update comun_seguridad.seg_rol_widget rw
       set rlw_visible = false,
           rlw_actualizado_en = now()
      from comun_seguridad.seg_widget w
     where rw.rlw_widget_id = w.wdg_id
       and rw.rlw_negocio = v_negocio
       and rw.rlw_rol in ('DELIVERY', 'REPARTIDOR', 'DELIVERY_EXTERNO', 'SUBCONTRATADO')
       and w.wdg_clave <> 'confirmacion_entregas';

    for v_w in
      select wdg_id
      from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio
        and wdg_clave = 'confirmacion_entregas'
    loop
      insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      values
        (v_negocio, 'DELIVERY', v_w.wdg_id, true),
        (v_negocio, 'DELIVERY_EXTERNO', v_w.wdg_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end loop;

    -- 11.3 VENTAS: Chats, Enviar Pedidos, Pedidos/Proformas, Entrega Inmediata e Inventario de Rosas
    for v_w in
      select wdg_id
      from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio
        and wdg_clave in ('consola_chat', 'envio_pedidos_taller', 'pedidos_tienda', 'galeria_inmediata', 'inventario_rosas')
    loop
      insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
      values
        (v_negocio, 'VENTAS', v_w.wdg_id, true),
        (v_negocio, 'VENDEDOR', v_w.wdg_id, true)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
