-- =============================================================================
-- Migración: 20261128000003_comisiones_ventas_colaborativas_y_tasas_asesor.sql
-- Requerimiento: TNK-003 (Ventas Cerradas, Participación Colaborativa IA/Equipo
--                y Liquidación de Comisiones Variables por Asesor)
-- Descripción:
--   1. Tablas con RLS y auditoría obligatoria (`aud_fn_auditar_tabla()`):
--      - `comun_comercio.com_comision_asesor_tasa` (`cat_`): tasa % variable por asesor.
--      - `comun_comercio.com_venta_comision` (`vco_`): desglose financiero de cada
--        venta cerrada (total, arreglo, extras, delivery fijo, delivery extra,
--        deducciones, base comisionable, % IA, regla de reparto y estado).
--      - `comun_comercio.com_venta_comision_participacion` (`vcp_`): detalle por asesor
--        (% chat, % asignado por admin, tasa aplicada y monto USD).
--   2. RPCs transaccionales `SECURITY DEFINER` con control estricto de visibilidad:
--      - Asesores (`VENTAS`/`OPERADOR`) SOLO pueden leer ventas del día actual (`HOY` Ecuador).
--      - Administradores (`ADMINISTRADOR`/`SUPERADMIN`) tienen acceso completo a
--        tasas, reparto manual, semana/quincena/mes y liquidación.
-- =============================================================================

-- 1. Tasa variable de comisión por asesor
create table if not exists comun_comercio.com_comision_asesor_tasa (
  cat_id uuid primary key default gen_random_uuid(),
  cat_secuencial bigint generated always as identity,
  cat_negocio text not null check (cat_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cat_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  cat_tasa_porcentaje numeric(5, 2) not null default 5.00 check (cat_tasa_porcentaje >= 0 and cat_tasa_porcentaje <= 100),
  cat_activo boolean not null default true,
  cat_detalle_tasa jsonb not null default '{}'::jsonb,
  cat_creado_en timestamptz not null default now(),
  cat_actualizado_en timestamptz not null default now(),
  cat_eliminado_en timestamptz
);

create unique index if not exists idx_com_comision_asesor_tasa_neg_usu
  on comun_comercio.com_comision_asesor_tasa (cat_negocio, cat_usuario_id)
  where cat_eliminado_en is null;

alter table comun_comercio.com_comision_asesor_tasa enable row level security;

drop policy if exists "equipo_lee_tasas_comision" on comun_comercio.com_comision_asesor_tasa;
create policy "equipo_lee_tasas_comision"
  on comun_comercio.com_comision_asesor_tasa
  for select
  to authenticated
  using (
    cat_eliminado_en is null
    and comun_seguridad.seg_fn_es_equipo_ventas_negocio(cat_negocio)
  );

drop trigger if exists trg_aud_com_comision_asesor_tasa on comun_comercio.com_comision_asesor_tasa;
create trigger trg_aud_com_comision_asesor_tasa
  after insert or update or delete on comun_comercio.com_comision_asesor_tasa
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 2. Registro financiero de venta cerrada y base comisionable
create table if not exists comun_comercio.com_venta_comision (
  vco_id uuid primary key default gen_random_uuid(),
  vco_secuencial bigint generated always as identity,
  vco_negocio text not null check (vco_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  vco_conversacion_id uuid references comun_agentes.agc_conversacion(cnv_id) on delete set null,
  vco_proforma_id uuid references comun_comercio.com_proforma(prf_id) on delete set null,
  vco_codigo_pedido text,
  vco_cliente_nombre text not null,
  vco_cliente_telefono text,
  vco_canal text not null default 'whatsapp',
  vco_producto_resumen text,
  vco_venta_total numeric(12, 2) not null default 0 check (vco_venta_total >= 0),
  vco_valor_producto numeric(12, 2) not null default 0 check (vco_valor_producto >= 0),
  vco_valor_extras numeric(12, 2) not null default 0 check (vco_valor_extras >= 0),
  vco_extras_comisionan boolean not null default true,
  vco_delivery_fijo numeric(12, 2) not null default 0 check (vco_delivery_fijo >= 0),
  vco_delivery_extra numeric(12, 2) not null default 0 check (vco_delivery_extra >= 0),
  vco_descuentos numeric(12, 2) not null default 0 check (vco_descuentos >= 0),
  vco_comision_pasarela numeric(12, 2) not null default 0 check (vco_comision_pasarela >= 0),
  vco_base_comisionable numeric(12, 2) not null default 0 check (vco_base_comisionable >= 0),
  vco_porcentaje_ia numeric(5, 2) not null default 0 check (vco_porcentaje_ia >= 0 and vco_porcentaje_ia <= 100),
  vco_regla_reparto text not null default 'GANADOR_UNICO'
    check (vco_regla_reparto in ('GANADOR_UNICO', 'PROPORCIONAL_REAL', 'PROPORCIONAL_HUMANOS', 'MANUAL')),
  vco_lider_humano_nombre text,
  vco_total_comision numeric(12, 2) not null default 0 check (vco_total_comision >= 0),
  vco_estado_liquidacion text not null default 'PENDIENTE'
    check (vco_estado_liquidacion in ('PENDIENTE', 'APROBADA', 'PAGADA', 'ANULADA')),
  vco_nota_admin text,
  vco_cerrado_por_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  vco_cerrado_por_nombre text,
  vco_fecha_dia_ec date not null default ((now() at time zone 'America/Guayaquil')::date),
  vco_cerrado_en timestamptz not null default now(),
  vco_detalle_venta jsonb not null default '{}'::jsonb,
  vco_creado_en timestamptz not null default now(),
  vco_actualizado_en timestamptz not null default now(),
  vco_eliminado_en timestamptz
);

create index if not exists idx_com_venta_comision_neg_fecha
  on comun_comercio.com_venta_comision (vco_negocio, vco_fecha_dia_ec desc)
  where vco_eliminado_en is null;

alter table comun_comercio.com_venta_comision enable row level security;

drop policy if exists "equipo_lee_ventas_comision_segun_rol" on comun_comercio.com_venta_comision;
create policy "equipo_lee_ventas_comision_segun_rol"
  on comun_comercio.com_venta_comision
  for select
  to authenticated
  using (
    vco_eliminado_en is null
    and (
      comun_seguridad.seg_fn_es_admin_negocio_omnicanal(vco_negocio)
      or (
        comun_seguridad.seg_fn_es_equipo_ventas_negocio(vco_negocio)
        and vco_fecha_dia_ec = (now() at time zone 'America/Guayaquil')::date
      )
    )
  );

drop trigger if exists trg_aud_com_venta_comision on comun_comercio.com_venta_comision;
create trigger trg_aud_com_venta_comision
  after insert or update or delete on comun_comercio.com_venta_comision
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 3. Participación y comisión individual por asesor en cada venta
create table if not exists comun_comercio.com_venta_comision_participacion (
  vcp_id uuid primary key default gen_random_uuid(),
  vcp_secuencial bigint generated always as identity,
  vcp_negocio text not null check (vcp_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  vcp_venta_id uuid not null references comun_comercio.com_venta_comision(vco_id) on delete cascade,
  vcp_usuario_id uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  vcp_asesor_nombre text not null,
  vcp_porcentaje_chat numeric(5, 2) not null default 0,
  vcp_porcentaje_asignado numeric(5, 2) not null default 0 check (vcp_porcentaje_asignado >= 0 and vcp_porcentaje_asignado <= 100),
  vcp_tasa_asesor numeric(5, 2) not null default 5.00 check (vcp_tasa_asesor >= 0 and vcp_tasa_asesor <= 100),
  vcp_monto_comision numeric(12, 2) not null default 0 check (vcp_monto_comision >= 0),
  vcp_detalle_participacion jsonb not null default '{}'::jsonb,
  vcp_creado_en timestamptz not null default now(),
  vcp_actualizado_en timestamptz not null default now(),
  vcp_eliminado_en timestamptz
);

create index if not exists idx_com_venta_comision_part_venta
  on comun_comercio.com_venta_comision_participacion (vcp_venta_id)
  where vcp_eliminado_en is null;

alter table comun_comercio.com_venta_comision_participacion enable row level security;

drop policy if exists "equipo_lee_participacion_comision" on comun_comercio.com_venta_comision_participacion;
create policy "equipo_lee_participacion_comision"
  on comun_comercio.com_venta_comision_participacion
  for select
  to authenticated
  using (
    vcp_eliminado_en is null
    and exists (
      select 1
      from comun_comercio.com_venta_comision v
      where v.vco_id = vcp_venta_id
        and v.vco_eliminado_en is null
        and (
          comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v.vco_negocio)
          or (
            comun_seguridad.seg_fn_es_equipo_ventas_negocio(v.vco_negocio)
            and v.vco_fecha_dia_ec = (now() at time zone 'America/Guayaquil')::date
          )
        )
    )
  );

drop trigger if exists trg_aud_com_venta_comision_participacion on comun_comercio.com_venta_comision_participacion;
create trigger trg_aud_com_venta_comision_participacion
  after insert or update or delete on comun_comercio.com_venta_comision_participacion
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

-- 4. RPC: Guardar tasa de comisión individual por asesor (solo Admin)
create or replace function comun_comercio.com_fn_comisiones_guardar_tasa_asesor(
  p_negocio text,
  p_usuario_id uuid,
  p_tasa_porcentaje numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_tasa numeric(5, 2) := greatest(0, least(100, round(coalesce(p_tasa_porcentaje, 0)::numeric, 2)));
begin
  if not comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador puede definir tasas de comisión por asesor.');
  end if;

  insert into comun_comercio.com_comision_asesor_tasa (
    cat_negocio, cat_usuario_id, cat_tasa_porcentaje, cat_activo, cat_actualizado_en
  ) values (
    v_negocio, p_usuario_id, v_tasa, true, now()
  )
  on conflict (cat_negocio, cat_usuario_id) where cat_eliminado_en is null
  do update set
    cat_tasa_porcentaje = excluded.cat_tasa_porcentaje,
    cat_activo = true,
    cat_actualizado_en = now();

  return jsonb_build_object('ok', true, 'usuarioId', p_usuario_id, 'tasaPorcentaje', v_tasa);
end;
$$;

revoke execute on function comun_comercio.com_fn_comisiones_guardar_tasa_asesor(text, uuid, numeric) from public;
grant execute on function comun_comercio.com_fn_comisiones_guardar_tasa_asesor(text, uuid, numeric) to authenticated, service_role;

-- 5. RPC: Registrar o actualizar venta cerrada con desglose financiero y reparto
create or replace function comun_comercio.com_fn_comisiones_registrar_venta(
  p_negocio text,
  p_venta jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
  v_uid uuid := auth.uid();
  v_es_admin boolean := comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio);
  v_actor text;
  v_venta_id uuid;
  v_item jsonb;
  v_fecha_dia date;
begin
  if not comun_seguridad.seg_fn_es_equipo_ventas_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Acceso restringido al equipo comercial.');
  end if;

  if (p_venta->>'id') is not null and (p_venta->>'id') ~ '^[0-9a-f-]{36}$' and not v_es_admin then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador puede recalcular o editar una venta ya registrada.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Equipo')
    into v_actor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  v_fecha_dia := coalesce(
    nullif(p_venta->>'fechaDiaEc', '')::date,
    (now() at time zone 'America/Guayaquil')::date
  );

  if (p_venta->>'id') is not null and (p_venta->>'id') ~ '^[0-9a-f-]{36}$' then
    v_venta_id := (p_venta->>'id')::uuid;
    update comun_comercio.com_venta_comision
       set vco_codigo_pedido = nullif(p_venta->>'codigoPedido', ''),
           vco_cliente_nombre = coalesce(nullif(p_venta->>'clienteNombre', ''), 'Cliente'),
           vco_cliente_telefono = nullif(p_venta->>'clienteTelefono', ''),
           vco_producto_resumen = nullif(p_venta->>'productoResumen', ''),
           vco_venta_total = coalesce((p_venta->'desglose'->>'ventaTotalUsd')::numeric, 0),
           vco_valor_producto = coalesce((p_venta->'desglose'->>'valorProductoUsd')::numeric, 0),
           vco_valor_extras = coalesce((p_venta->'desglose'->>'valorExtrasUsd')::numeric, 0),
           vco_extras_comisionan = coalesce((p_venta->'desglose'->>'extrasComisionan')::boolean, true),
           vco_delivery_fijo = coalesce((p_venta->'desglose'->>'deliveryFijoUsd')::numeric, 0),
           vco_delivery_extra = coalesce((p_venta->'desglose'->>'deliveryExtraUsd')::numeric, 0),
           vco_descuentos = coalesce((p_venta->'desglose'->>'descuentosUsd')::numeric, 0),
           vco_comision_pasarela = coalesce((p_venta->'desglose'->>'comisionPasarelaUsd')::numeric, 0),
           vco_base_comisionable = coalesce((p_venta->'desglose'->>'baseComisionableUsd')::numeric, 0),
           vco_porcentaje_ia = coalesce((p_venta->>'porcentajeIaChat')::numeric, 0),
           vco_regla_reparto = coalesce(nullif(p_venta->>'reglaReparto', ''), 'GANADOR_UNICO'),
           vco_lider_humano_nombre = nullif(p_venta->>'liderHumanoNombre', ''),
           vco_total_comision = coalesce((p_venta->>'totalComisionUsd')::numeric, 0),
           vco_nota_admin = nullif(p_venta->>'notaAdmin', ''),
           vco_actualizado_en = now()
     where vco_id = v_venta_id
       and vco_negocio = v_negocio;

    update comun_comercio.com_venta_comision_participacion
       set vcp_eliminado_en = now()
     where vcp_venta_id = v_venta_id
       and vcp_eliminado_en is null;
  else
    insert into comun_comercio.com_venta_comision (
      vco_negocio, vco_conversacion_id, vco_proforma_id, vco_codigo_pedido,
      vco_cliente_nombre, vco_cliente_telefono, vco_canal, vco_producto_resumen,
      vco_venta_total, vco_valor_producto, vco_valor_extras, vco_extras_comisionan,
      vco_delivery_fijo, vco_delivery_extra, vco_descuentos, vco_comision_pasarela,
      vco_base_comisionable, vco_porcentaje_ia, vco_regla_reparto, vco_lider_humano_nombre,
      vco_total_comision, vco_estado_liquidacion, vco_nota_admin,
      vco_cerrado_por_id, vco_cerrado_por_nombre, vco_fecha_dia_ec
    ) values (
      v_negocio,
      case when (p_venta->>'conversacionId') ~ '^[0-9a-f-]{36}$' then (p_venta->>'conversacionId')::uuid else null end,
      case when (p_venta->>'proformaId') ~ '^[0-9a-f-]{36}$' then (p_venta->>'proformaId')::uuid else null end,
      nullif(p_venta->>'codigoPedido', ''),
      coalesce(nullif(p_venta->>'clienteNombre', ''), 'Cliente'),
      nullif(p_venta->>'clienteTelefono', ''),
      coalesce(nullif(p_venta->>'canal', ''), 'whatsapp'),
      nullif(p_venta->>'productoResumen', ''),
      coalesce((p_venta->'desglose'->>'ventaTotalUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'valorProductoUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'valorExtrasUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'extrasComisionan')::boolean, true),
      coalesce((p_venta->'desglose'->>'deliveryFijoUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'deliveryExtraUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'descuentosUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'comisionPasarelaUsd')::numeric, 0),
      coalesce((p_venta->'desglose'->>'baseComisionableUsd')::numeric, 0),
      coalesce((p_venta->>'porcentajeIaChat')::numeric, 0),
      coalesce(nullif(p_venta->>'reglaReparto', ''), 'GANADOR_UNICO'),
      nullif(p_venta->>'liderHumanoNombre', ''),
      coalesce((p_venta->>'totalComisionUsd')::numeric, 0),
      case when v_es_admin then 'APROBADA' else 'PENDIENTE' end,
      nullif(p_venta->>'notaAdmin', ''),
      v_uid,
      v_actor,
      v_fecha_dia
    )
    returning vco_id into v_venta_id;
  end if;

  for v_item in select * from jsonb_array_elements(coalesce(p_venta->'asignaciones', '[]'::jsonb))
  loop
    insert into comun_comercio.com_venta_comision_participacion (
      vcp_negocio, vcp_venta_id, vcp_usuario_id, vcp_asesor_nombre,
      vcp_porcentaje_chat, vcp_porcentaje_asignado, vcp_tasa_asesor, vcp_monto_comision
    ) values (
      v_negocio,
      v_venta_id,
      case when (v_item->>'usuarioId') ~ '^[0-9a-f-]{36}$' then (v_item->>'usuarioId')::uuid else null end,
      coalesce(nullif(v_item->>'asesorNombre', ''), 'Equipo'),
      coalesce((v_item->>'porcentajeParticipacionChat')::numeric, 0),
      coalesce((v_item->>'porcentajeComisionAsignado')::numeric, 0),
      coalesce((v_item->>'tasaComisionAsesorPct')::numeric, 5),
      coalesce((v_item->>'montoComisionUsd')::numeric, 0)
    );
  end loop;

  return jsonb_build_object('ok', true, 'ventaId', v_venta_id);
end;
$$;

revoke execute on function comun_comercio.com_fn_comisiones_registrar_venta(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_comisiones_registrar_venta(text, jsonb) to authenticated, service_role;

-- 6. RPC: Cambiar estado de liquidación (solo Admin)
create or replace function comun_comercio.com_fn_comisiones_actualizar_estado(
  p_negocio text,
  p_venta_id uuid,
  p_estado text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(coalesce(p_negocio, 'tinkay'));
begin
  if not comun_seguridad.seg_fn_es_admin_negocio_omnicanal(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo el Administrador puede aprobar, pagar o anular comisiones.');
  end if;

  update comun_comercio.com_venta_comision
     set vco_estado_liquidacion = upper(btrim(p_estado)),
         vco_actualizado_en = now()
   where vco_id = p_venta_id
     and vco_negocio = v_negocio
     and vco_eliminado_en is null;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_comisiones_actualizar_estado(text, uuid, text) from public;
grant execute on function comun_comercio.com_fn_comisiones_actualizar_estado(text, uuid, text) to authenticated, service_role;

notify pgrst, 'reload schema';
