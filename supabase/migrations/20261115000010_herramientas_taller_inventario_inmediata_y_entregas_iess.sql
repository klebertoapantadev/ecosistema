-- =============================================================================
-- Migración: 20261115000010_herramientas_taller_inventario_inmediata_y_entregas_iess.sql
-- Requerimientos: PLT-009 / TNK-002 / TNK-005 (Operaciones de Tienda y Campo)
-- Descripción:
--   1. Inventario Fotográfico de Rosas con IA ARIA (comun_comercio.com_inventario_corte + sincronización com_inventario/com_kardex).
--   2. Galería de Disponibles para Entrega Inmediata 1-2h sobre comun_comercio (ADR-0003) con baja automática al venderse en web.
--   3. Órdenes de Trabajo Directas (Exequiales del IESS) + Confirmación Universal de Entregas Georreferenciadas (Offline-First)
--      + Informes Quincenales Numerados (com_convenio_entrega, com_entrega_evidencia, com_informe_entregas).
--   4. Pre-configuración por defecto de los 3 widgets (`inventario_rosas`, `galeria_inmediata`, `confirmacion_entregas`) en seg_widget y seg_rol_widget.
-- =============================================================================

-- 0. Función canónica de negocio autónoma en comun_comercio (sin depender de otros esquemas)
create or replace function comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio text)
returns text
language sql
immutable
set search_path = ''
as $$
  select case
    when upper(btrim(coalesce(p_negocio, ''))) in ('TRANQ', 'TRANQI', 'LEGAL') then 'tranqi'
    when upper(btrim(coalesce(p_negocio, ''))) in ('FFH', 'FASTFIX') then 'fastfix'
    when upper(btrim(coalesce(p_negocio, ''))) in ('TNK', 'TINKAY') then 'tinkay'
    when upper(btrim(coalesce(p_negocio, ''))) in ('MRG', 'MARGARITAS') then 'margaritas'
    else lower(btrim(coalesce(nullif(p_negocio, ''), 'tinkay')))
  end;
$$;

grant execute on function comun_comercio.com_fn_omnicanal_negocio_canonico(text) to anon, authenticated, service_role;

-- 0.1 Función de autorización para personal operativo y repartidores (DELIVERY, OPERADOR, VENTAS, ADMIN, SUPERADMIN)
create or replace function comun_seguridad.seg_fn_es_delivery_o_staff_negocio(p_negocio text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from comun_seguridad.seg_usuario u
    where u.usu_id = auth.uid()
      and (
        u.usu_superadmin_plataforma
        or (
          lower(btrim(coalesce(p_negocio, ''))) in ('tinkay', 'tnk')
          and lower(btrim(coalesce(u.usu_correo, ''))) = 'tinkay.uio@gmail.com'
        )
      )
  )
  or exists (
    select 1
    from comun_seguridad.seg_membresia m
    left join comun_seguridad.seg_membresia_perfil mp on mp.mpe_membresia_id = m.mem_id
    left join comun_seguridad.seg_perfil p on p.per_id = mp.mpe_perfil_id
    where m.mem_usuario_id = auth.uid()
      and m.mem_estado = 'ACTIVO'
      and (
        upper(m.mem_negocio) = upper(p_negocio)
        or (upper(p_negocio) in ('TRANQ', 'TRANQI', 'LEGAL') and upper(m.mem_negocio) in ('TRANQ', 'TRANQI', 'LEGAL'))
        or (upper(p_negocio) in ('FFH', 'FASTFIX') and upper(m.mem_negocio) in ('FFH', 'FASTFIX'))
        or (upper(p_negocio) in ('TNK', 'TINKAY') and upper(m.mem_negocio) in ('TNK', 'TINKAY'))
        or (upper(p_negocio) in ('MRG', 'MARGARITAS') and upper(m.mem_negocio) in ('MRG', 'MARGARITAS'))
      )
      and (
        upper(coalesce(p.per_clave, '')) in ('DELIVERY', 'REPARTIDOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'AUXILIAR', 'TECNICO', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
        or upper(coalesce(m.mem_rol, '')) in ('DELIVERY', 'REPARTIDOR', 'VENTAS', 'VENDEDOR', 'ASESOR', 'OPERADOR', 'AUXILIAR', 'TECNICO', 'ADMINISTRADOR', 'ADMIN', 'SUPERADMIN')
      )
  );
$$;

grant execute on function comun_seguridad.seg_fn_es_delivery_o_staff_negocio(text) to authenticated, service_role;

-- 0.2 Bucket y políticas de Storage para fotos de inventario, entrega inmediata y evidencias de entregas
do $$
begin
  insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
  values (
    'comun-publico',
    'comun-publico',
    true,
    10485760,
    array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
  )
  on conflict (id) do update set
    file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 10485760),
    allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf'];

  drop policy if exists "operaciones_taller_y_entregas_insert_autenticado" on storage.objects;
  create policy "operaciones_taller_y_entregas_insert_autenticado"
    on storage.objects
    for insert
    to authenticated
    with check (
      bucket_id = 'comun-publico'
      and (
        name like 'inventario-rosas/%'
        or name like 'entrega-inmediata/%'
        or name like 'evidencias-entregas/%'
        or name like 'informes-entregas/%'
      )
    );

  drop policy if exists "operaciones_taller_y_entregas_select_publico" on storage.objects;
  create policy "operaciones_taller_y_entregas_select_publico"
    on storage.objects
    for select
    to anon, authenticated
    using (bucket_id = 'comun-publico');
exception when others then
  null;
end $$;

-- =============================================================================
-- 1. MÓDULO 1: INVENTARIO FOTOGRÁFICO DE ROSAS CON IA ARIA
-- =============================================================================

create table if not exists comun_comercio.com_inventario_corte (
  icr_id uuid primary key default gen_random_uuid(),
  icr_secuencial bigint generated always as identity,
  icr_negocio text not null,
  icr_local_codigo text not null default 'MATRIZ',
  icr_fecha_corte timestamptz not null default now(),
  icr_registrado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  icr_registrado_nombre text not null default 'Operador Taller',
  icr_total_paquetes integer not null default 0,
  icr_resumen_colores jsonb not null default '{}'::jsonb,
  icr_observaciones text,
  icr_detalle_corte jsonb not null default '{}'::jsonb,
  icr_creado_en timestamptz not null default now(),
  icr_actualizado_en timestamptz not null default now(),
  icr_eliminado_en timestamptz
);

create index if not exists idx_com_inventario_corte_negocio_fecha
  on comun_comercio.com_inventario_corte (icr_negocio, icr_fecha_corte desc)
  where icr_eliminado_en is null;

alter table comun_comercio.com_inventario_corte enable row level security;

drop policy if exists com_inventario_corte_lectura on comun_comercio.com_inventario_corte;
create policy com_inventario_corte_lectura on comun_comercio.com_inventario_corte
  for select using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(icr_negocio));

drop policy if exists com_inventario_corte_escritura on comun_comercio.com_inventario_corte;
create policy com_inventario_corte_escritura on comun_comercio.com_inventario_corte
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(icr_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(icr_negocio));

drop trigger if exists trg_auditoria_com_inventario_corte on comun_comercio.com_inventario_corte;
create trigger trg_auditoria_com_inventario_corte
  after insert or update or delete on comun_comercio.com_inventario_corte
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_inventario_corte to authenticated;
grant all on comun_comercio.com_inventario_corte to service_role;

-- RPC: Obtener último inventario y el historial reciente de cortes
create or replace function comun_comercio.com_fn_obtener_inventario_rosas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_ultimo jsonb;
  v_historial jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para consultar el inventario de rosas.');
  end if;

  select jsonb_build_object(
    'id', c.icr_id,
    'secuencial', c.icr_secuencial,
    'negocio', c.icr_negocio,
    'localCodigo', c.icr_local_codigo,
    'fechaCorte', c.icr_fecha_corte,
    'registradoPor', c.icr_registrado_por,
    'registradoNombre', c.icr_registrado_nombre,
    'totalPaquetes', c.icr_total_paquetes,
    'resumenColores', c.icr_resumen_colores,
    'observaciones', c.icr_observaciones,
    'fotos', coalesce(c.icr_detalle_corte->'fotos', '[]'::jsonb)
  )
  into v_ultimo
  from comun_comercio.com_inventario_corte c
  where c.icr_negocio = v_negocio
    and c.icr_eliminado_en is null
  order by c.icr_fecha_corte desc
  limit 1;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_historial
  from (
    select jsonb_build_object(
      'id', c.icr_id,
      'secuencial', c.icr_secuencial,
      'fechaCorte', c.icr_fecha_corte,
      'registradoNombre', c.icr_registrado_nombre,
      'totalPaquetes', c.icr_total_paquetes,
      'resumenColores', c.icr_resumen_colores,
      'observaciones', c.icr_observaciones,
      'fotos', coalesce(c.icr_detalle_corte->'fotos', '[]'::jsonb)
    ) as item
    from comun_comercio.com_inventario_corte c
    where c.icr_negocio = v_negocio
      and c.icr_eliminado_en is null
    order by c.icr_fecha_corte desc
    limit 40
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'ultimoCorte', v_ultimo,
    'historial', v_historial
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_inventario_rosas(text) from public;
grant execute on function comun_comercio.com_fn_obtener_inventario_rosas(text) to authenticated, service_role;

-- RPC: Guardar corte consolidado de inventario de rosas y sincronizar com_insumo / com_inventario / com_kardex
create or replace function comun_comercio.com_fn_guardar_corte_inventario_rosas(
  p_negocio text,
  p_resumen_colores jsonb,
  p_fotos jsonb default '[]'::jsonb,
  p_observaciones text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_autor text;
  v_total integer := 0;
  v_par record;
  v_cant integer;
  v_codigo_insumo text;
  v_insumo_id uuid;
  v_corte comun_comercio.com_inventario_corte;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio)
     and not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar cortes de inventario.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Taller')
    into v_autor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  for v_par in select key, value from jsonb_each_text(coalesce(p_resumen_colores, '{}'::jsonb)) loop
    begin
      v_cant := greatest(0, coalesce(v_par.value::integer, 0));
    exception when others then
      v_cant := 0;
    end;
    v_total := v_total + v_cant;

    v_codigo_insumo := 'BONCHE_ROSA_' || upper(regexp_replace(v_par.key, '[^a-zA-Z0-9]+', '_', 'g'));

    insert into comun_comercio.com_insumo (
      ins_negocio, ins_codigo, ins_nombre, ins_unidad_medida, ins_activo, ins_detalle_insumo
    ) values (
      v_negocio,
      v_codigo_insumo,
      'Bonche de Rosas (' || initcap(replace(v_par.key, '_', ' ')) || ')',
      'UNIDAD',
      true,
      jsonb_build_object('categoria_operativa', 'BONCHE_ROSAS', 'color_clave', lower(v_par.key), 'tallos_referencia', 25)
    )
    on conflict (ins_negocio, ins_codigo) do update set
      ins_activo = true,
      ins_actualizado_en = now()
    returning ins_id into v_insumo_id;

    insert into comun_comercio.com_inventario (
      inv_negocio, inv_insumo_id, inv_local_codigo, inv_stock_actual, inv_actualizado_en
    ) values (
      v_negocio, v_insumo_id, 'MATRIZ', v_cant, now()
    )
    on conflict (inv_negocio, inv_insumo_id, inv_local_codigo) do update set
      inv_stock_actual = excluded.inv_stock_actual,
      inv_actualizado_en = now();

    insert into comun_comercio.com_kardex (
      kar_negocio, kar_insumo_id, kar_local_codigo, kar_tipo_movimiento, kar_cantidad, kar_costo_unitario, kar_observacion, kar_registrado_por
    ) values (
      v_negocio, v_insumo_id, 'MATRIZ', 'AJUSTE_INVENTARIO', v_cant, 0, 'Corte fotográfico IA ARIA', v_uid
    );
  end loop;

  insert into comun_comercio.com_inventario_corte (
    icr_negocio,
    icr_local_codigo,
    icr_fecha_corte,
    icr_registrado_por,
    icr_registrado_nombre,
    icr_total_paquetes,
    icr_resumen_colores,
    icr_observaciones,
    icr_detalle_corte
  ) values (
    v_negocio,
    'MATRIZ',
    now(),
    v_uid,
    coalesce(v_autor, 'Taller'),
    v_total,
    coalesce(p_resumen_colores, '{}'::jsonb),
    nullif(btrim(coalesce(p_observaciones, '')), ''),
    jsonb_build_object(
      'fotos', coalesce(p_fotos, '[]'::jsonb),
      'origen', 'CONTEO_IA_ARIA_CONSOLIDADO'
    )
  )
  returning * into v_corte;

  return jsonb_build_object(
    'ok', true,
    'corte', jsonb_build_object(
      'id', v_corte.icr_id,
      'secuencial', v_corte.icr_secuencial,
      'negocio', v_corte.icr_negocio,
      'localCodigo', v_corte.icr_local_codigo,
      'fechaCorte', v_corte.icr_fecha_corte,
      'registradoPor', v_corte.icr_registrado_por,
      'registradoNombre', v_corte.icr_registrado_nombre,
      'totalPaquetes', v_corte.icr_total_paquetes,
      'resumenColores', v_corte.icr_resumen_colores,
      'observaciones', v_corte.icr_observaciones,
      'fotos', coalesce(v_corte.icr_detalle_corte->'fotos', '[]'::jsonb)
    )
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_guardar_corte_inventario_rosas(text, jsonb, jsonb, text) from public;
grant execute on function comun_comercio.com_fn_guardar_corte_inventario_rosas(text, jsonb, jsonb, text) to authenticated, service_role;

-- =============================================================================
-- 2. MÓDULO 2: GALERÍA DE DISPONIBLES PARA ENTREGA INMEDIATA (1 A 2 HORAS)
-- =============================================================================

-- Semilla idempotente de categoría "⚡ Entrega Inmediata" para floristerías
do $$
declare
  v_neg text;
begin
  for v_neg in select unnest(array['tinkay', 'margaritas']) loop
    insert into comun_comercio.com_categoria (
      ctg_negocio, ctg_slug, ctg_nombre, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo, ctg_detalle_categoria
    ) values (
      v_neg,
      'entrega-inmediata',
      '⚡ Entrega Inmediata',
      'Arreglos recién elaborados en tienda disponibles para despacho inmediato en 1 a 2 horas a precio especial.',
      'COLECCION',
      0,
      true,
      jsonb_build_object(
        'icono', '⚡',
        'es_entrega_inmediata', true,
        'palabras_clave', jsonb_build_array('inmediata', 'urgente', 'hoy', 'listo', 'express', '1 hora', '2 horas')
      )
    )
    on conflict do nothing;
  end loop;
exception when others then
  null;
end $$;

-- RPC Público + Staff: Listar arreglos de entrega inmediata
create or replace function comun_comercio.com_fn_listar_entrega_inmediata(
  p_negocio text default 'tinkay',
  p_incluir_inactivos boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_es_staff boolean := false;
  v_items jsonb;
begin
  if auth.uid() is not null then
    v_es_staff := comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio);
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_items
  from (
    select jsonb_build_object(
      'productoId', p.pro_id,
      'varianteId', v.var_id,
      'slug', p.pro_slug,
      'sku', v.var_sku,
      'nombre', p.pro_nombre,
      'descripcion', coalesce(p.pro_descripcion, p.pro_detalle_producto->>'descripcion_corta', ''),
      'precio', coalesce(v.var_precio, 0),
      'precioComparacion', v.var_precio_comparacion,
      'imagenUrl', coalesce(p.pro_detalle_producto->>'imagen_url', v.var_detalle_variante->>'portada_url', ''),
      'galeriaUrls', coalesce(p.pro_detalle_producto->'galeria_urls', '[]'::jsonb),
      'stockDisponible', greatest(0, coalesce((v.var_detalle_variante->>'stock_inmediato')::integer, 1)),
      'tiempoEntregaTexto', coalesce(p.pro_detalle_producto->>'tiempo_entrega_inmediata', '1 a 2 horas'),
      'activo', (coalesce(p.pro_activo, false) and coalesce(v.var_activo, false)),
      'motivoBaja', p.pro_detalle_producto->>'motivo_baja_inmediata',
      'ordenVentaCodigo', p.pro_detalle_producto->>'orden_venta_codigo',
      'creadoEn', p.pro_creado_en,
      'actualizadoEn', p.pro_actualizado_en
    ) as item
    from comun_comercio.com_producto p
    join lateral (
      select cv.*
      from comun_comercio.com_variante cv
      where cv.var_producto_id = p.pro_id
        and cv.var_eliminado_en is null
      order by cv.var_creado_en asc
      limit 1
    ) v on true
    where p.pro_negocio = v_negocio
      and p.pro_eliminado_en is null
      and coalesce((p.pro_detalle_producto->>'es_entrega_inmediata')::boolean, false) = true
      and (
        (coalesce(p.pro_activo, false) = true and coalesce(v.var_activo, false) = true and coalesce((v.var_detalle_variante->>'stock_inmediato')::integer, 1) > 0)
        or (p_incluir_inactivos and v_es_staff)
      )
    order by
      (case when coalesce(p.pro_activo, false) and coalesce(v.var_activo, false) then 0 else 1 end) asc,
      p.pro_creado_en desc
    limit 100
  ) sub;

  return jsonb_build_object('ok', true, 'items', v_items);
end;
$$;

revoke execute on function comun_comercio.com_fn_listar_entrega_inmediata(text, boolean) from public;
grant execute on function comun_comercio.com_fn_listar_entrega_inmediata(text, boolean) to anon, authenticated, service_role;

-- RPC Staff: Publicar o editar arreglo de entrega inmediata en comun_comercio (ADR-0003)
create or replace function comun_comercio.com_fn_publicar_entrega_inmediata(
  p_negocio text,
  p_nombre text,
  p_precio numeric,
  p_imagen_url text,
  p_stock integer default 1,
  p_precio_comparacion numeric default null,
  p_descripcion text default null,
  p_galeria jsonb default '[]'::jsonb,
  p_producto_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_cat_id uuid;
  v_pro_id uuid;
  v_var_id uuid;
  v_slug text;
  v_sku text;
  v_nombre text := coalesce(nullif(btrim(coalesce(p_nombre, '')), ''), 'Arreglo Listo Entrega Inmediata');
  v_desc text := coalesce(nullif(btrim(coalesce(p_descripcion, '')), ''), 'Arreglo floral fresco recién elaborado en taller, disponible para entrega inmediata de 1 a 2 horas.');
  v_stock integer := greatest(1, coalesce(p_stock, 1));
  v_precio numeric(12,2) := round(greatest(1, coalesce(p_precio, 15))::numeric, 2);
  v_galeria jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para publicar arreglos de entrega inmediata.');
  end if;

  if coalesce(btrim(p_imagen_url), '') = '' then
    return jsonb_build_object('ok', false, 'error', 'Debes adjuntar o tomar al menos una fotografía del arreglo.');
  end if;

  select ctg_id into v_cat_id
  from comun_comercio.com_categoria
  where ctg_negocio = v_negocio
    and ctg_slug = 'entrega-inmediata'
    and ctg_eliminado_en is null
  limit 1;

  if v_cat_id is null then
    insert into comun_comercio.com_categoria (
      ctg_negocio, ctg_slug, ctg_nombre, ctg_descripcion, ctg_tipo, ctg_orden, ctg_activo, ctg_detalle_categoria
    ) values (
      v_negocio, 'entrega-inmediata', '⚡ Entrega Inmediata',
      'Arreglos recién elaborados disponibles para envío en 1 a 2 horas.', 'COLECCION', 0, true,
      jsonb_build_object('icono', '⚡', 'es_entrega_inmediata', true)
    )
    returning ctg_id into v_cat_id;
  end if;

  if jsonb_typeof(p_galeria) = 'array' and jsonb_array_length(p_galeria) > 0 then
    v_galeria := p_galeria;
  else
    v_galeria := jsonb_build_array(btrim(p_imagen_url));
  end if;

  if p_producto_id is not null then
    update comun_comercio.com_producto
       set pro_nombre = v_nombre,
           pro_descripcion = v_desc,
           pro_activo = true,
           pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb) || jsonb_build_object(
             'es_entrega_inmediata', true,
             'tiempo_entrega_inmediata', '1 a 2 horas',
             'imagen_url', btrim(p_imagen_url),
             'galeria_urls', v_galeria,
             'descripcion_corta', v_desc,
             'etiqueta_temporada', '⚡ ENTREGA 1–2H',
             'motivo_baja_inmediata', null
           ),
           pro_actualizado_en = now()
     where pro_id = p_producto_id
       and pro_negocio = v_negocio
     returning pro_id, pro_slug into v_pro_id, v_slug;

    update comun_comercio.com_variante
       set var_precio = v_precio,
           var_precio_comparacion = p_precio_comparacion,
           var_activo = true,
           var_detalle_variante = coalesce(var_detalle_variante, '{}'::jsonb) || jsonb_build_object(
             'stock_inmediato', v_stock,
             'portada_url', btrim(p_imagen_url),
             'galeria_urls', v_galeria,
             'detalle', v_desc
           ),
           var_actualizado_en = now()
     where var_producto_id = v_pro_id
     returning var_id, var_sku into v_var_id, v_sku;
  else
    v_slug := 'inmediato-' || regexp_replace(lower(v_nombre), '[^a-z0-9]+', '-', 'g') || '-' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 6);
    v_slug := regexp_replace(v_slug, '(^-+|-+$)', '', 'g');
    v_sku := upper(left(v_negocio, 3)) || '-EXP-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 6));

    insert into comun_comercio.com_producto (
      pro_negocio,
      pro_categoria_principal_id,
      pro_slug,
      pro_nombre,
      pro_descripcion,
      pro_tipo,
      pro_destacado,
      pro_activo,
      pro_detalle_producto
    ) values (
      v_negocio,
      v_cat_id,
      v_slug,
      v_nombre,
      v_desc,
      'FISICO',
      true,
      true,
      jsonb_build_object(
        'es_entrega_inmediata', true,
        'tiempo_entrega_inmediata', '1 a 2 horas',
        'imagen_url', btrim(p_imagen_url),
        'galeria_urls', v_galeria,
        'descripcion_corta', v_desc,
        'etiqueta_temporada', '⚡ ENTREGA 1–2H',
        'canales_visibilidad', jsonb_build_array('ECOMMERCE_WEB', 'WHATSAPP_ARIA', 'MOSTRADOR'),
        'beneficios', jsonb_build_array(
          'Arreglo físico recién elaborado en taller — recibes exactamente el diseño de la fotografía.',
          'Despacho prioritario inmediato en 1 a 2 horas tras coordinar ubicación.',
          'Tarifa especial de vitrina disponible únicamente hasta agotar existencia.'
        )
      )
    )
    returning pro_id into v_pro_id;

    insert into comun_comercio.com_producto_categoria (pct_negocio, pct_producto_id, pct_categoria_id)
    values (v_negocio, v_pro_id, v_cat_id)
    on conflict do nothing;

    insert into comun_comercio.com_variante (
      var_negocio,
      var_producto_id,
      var_sku,
      var_nombre,
      var_precio,
      var_precio_comparacion,
      var_tarifa_iva_porcentaje,
      var_activo,
      var_detalle_variante
    ) values (
      v_negocio,
      v_pro_id,
      v_sku,
      'Disponible Hoy (1–2h)',
      v_precio,
      p_precio_comparacion,
      0,
      true,
      jsonb_build_object(
        'orden', 1,
        'stock_inmediato', v_stock,
        'portada_url', btrim(p_imagen_url),
        'galeria_urls', v_galeria,
        'detalle', v_desc
      )
    )
    returning var_id into v_var_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'productoId', v_pro_id,
    'varianteId', v_var_id,
    'slug', v_slug,
    'sku', v_sku
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_publicar_entrega_inmediata(text, text, numeric, text, integer, numeric, text, jsonb, uuid) from public;
grant execute on function comun_comercio.com_fn_publicar_entrega_inmediata(text, text, numeric, text, integer, numeric, text, jsonb, uuid) to authenticated, service_role;

-- RPC Staff: Marcar vendido en tienda o descartar de disponibles
create or replace function comun_comercio.com_fn_descartar_entrega_inmediata(
  p_negocio text,
  p_producto_id uuid,
  p_motivo text default 'VENDIDO_TIENDA'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Sin permisos para retirar arreglos de entrega inmediata.');
  end if;

  update comun_comercio.com_producto
     set pro_activo = false,
         pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb) || jsonb_build_object(
           'motivo_baja_inmediata', coalesce(nullif(btrim(p_motivo), ''), 'RETIRADO_MANUAL'),
           'baja_inmediata_en', now()
         ),
         pro_actualizado_en = now()
   where pro_id = p_producto_id
     and pro_negocio = v_negocio;

  update comun_comercio.com_variante
     set var_activo = false,
         var_detalle_variante = coalesce(var_detalle_variante, '{}'::jsonb) || jsonb_build_object(
           'stock_inmediato', 0
         ),
         var_actualizado_en = now()
   where var_producto_id = p_producto_id
     and var_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_descartar_entrega_inmediata(text, uuid, text) from public;
grant execute on function comun_comercio.com_fn_descartar_entrega_inmediata(text, uuid, text) to authenticated, service_role;

-- Trigger automático: cuando se registra/paga una compra web en com_proforma, descontar stock_inmediato y retirar si llega a 0
create or replace function comun_comercio.com_fn_trg_descontar_entrega_inmediata_en_orden()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_item jsonb;
  v_sku text;
  v_cant integer;
  v_var record;
  v_nuevo_stock integer;
begin
  -- Evitar descontar en meras proformas de eventos no confirmadas o ya procesadas
  if coalesce(new.prf_detalle_proforma->>'tipo_origen', '') = 'PROFORMA_EVENTO' then
    return new;
  end if;

  if coalesce((new.prf_detalle_proforma->>'stock_inmediato_descontado')::boolean, false) = true then
    return new;
  end if;

  if upper(coalesce(new.prf_estado, '')) in ('CANCELADO', 'ANULADO', 'NO_ACEPTADA') then
    return new;
  end if;

  if jsonb_typeof(new.prf_detalle_proforma->'items') <> 'array' then
    return new;
  end if;

  for v_item in select * from jsonb_array_elements(new.prf_detalle_proforma->'items') loop
    v_sku := btrim(coalesce(v_item->>'varianteSku', v_item->>'sku', ''));
    begin
      v_cant := greatest(1, coalesce((v_item->>'cantidad')::integer, 1));
    exception when others then
      v_cant := 1;
    end;

    if v_sku <> '' then
      select v.var_id, v.var_producto_id, v.var_detalle_variante, p.pro_detalle_producto
        into v_var
        from comun_comercio.com_variante v
        join comun_comercio.com_producto p on p.pro_id = v.var_producto_id
       where v.var_negocio = lower(new.prf_negocio)
         and v.var_sku = v_sku
         and coalesce((p.pro_detalle_producto->>'es_entrega_inmediata')::boolean, false) = true
       for update of v;

      if v_var.var_id is not null then
        v_nuevo_stock := greatest(0, coalesce((v_var.var_detalle_variante->>'stock_inmediato')::integer, 1) - v_cant);

        update comun_comercio.com_variante
           set var_activo = (v_nuevo_stock > 0),
               var_detalle_variante = coalesce(var_detalle_variante, '{}'::jsonb) || jsonb_build_object(
                 'stock_inmediato', v_nuevo_stock
               ),
               var_actualizado_en = now()
         where var_id = v_var.var_id;

        if v_nuevo_stock <= 0 then
          update comun_comercio.com_producto
             set pro_activo = false,
                 pro_detalle_producto = coalesce(pro_detalle_producto, '{}'::jsonb) || jsonb_build_object(
                   'motivo_baja_inmediata', 'VENDIDO_WEB',
                   'orden_venta_codigo', new.prf_codigo,
                   'baja_inmediata_en', now()
                 ),
                 pro_actualizado_en = now()
           where pro_id = v_var.var_producto_id;
        end if;
      end if;
    end if;
  end loop;

  new.prf_detalle_proforma := coalesce(new.prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object('stock_inmediato_descontado', true);
  return new;
end;
$$;

drop trigger if exists trg_com_proforma_descontar_inmediata on comun_comercio.com_proforma;
create trigger trg_com_proforma_descontar_inmediata
  before insert on comun_comercio.com_proforma
  for each row execute function comun_comercio.com_fn_trg_descontar_entrega_inmediata_en_orden();

-- =============================================================================
-- 3. MÓDULO 3: ÓRDENES DE TRABAJO (EXEQUIALES IESS), CONFIRMACIÓN DE ENTREGAS E INFORMES QUINCENALES
-- =============================================================================

create table if not exists comun_comercio.com_convenio_entrega (
  cve_id uuid primary key default gen_random_uuid(),
  cve_secuencial bigint generated always as identity,
  cve_negocio text not null,
  cve_codigo text not null,
  cve_nombre text not null,
  cve_prefijo_informe text not null default 'INF',
  cve_siguiente_numero integer not null default 1,
  cve_activo boolean not null default true,
  cve_datos_proveedor jsonb not null default '{}'::jsonb,
  cve_detalle_convenio jsonb not null default '{}'::jsonb,
  cve_creado_en timestamptz not null default now(),
  cve_actualizado_en timestamptz not null default now(),
  cve_eliminado_en timestamptz,
  unique (cve_negocio, cve_codigo)
);

alter table comun_comercio.com_convenio_entrega enable row level security;

drop policy if exists com_convenio_entrega_lectura on comun_comercio.com_convenio_entrega;
create policy com_convenio_entrega_lectura on comun_comercio.com_convenio_entrega
  for select using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(cve_negocio));

drop policy if exists com_convenio_entrega_escritura on comun_comercio.com_convenio_entrega;
create policy com_convenio_entrega_escritura on comun_comercio.com_convenio_entrega
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cve_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(cve_negocio));

drop trigger if exists trg_auditoria_com_convenio_entrega on comun_comercio.com_convenio_entrega;
create trigger trg_auditoria_com_convenio_entrega
  after insert or update or delete on comun_comercio.com_convenio_entrega
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_convenio_entrega to authenticated;
grant all on comun_comercio.com_convenio_entrega to service_role;

-- Semilla oficial del Convenio Exequiales del IESS para Tinkay (con los datos exactos del modelo de informe)
insert into comun_comercio.com_convenio_entrega (
  cve_negocio,
  cve_codigo,
  cve_nombre,
  cve_prefijo_informe,
  cve_siguiente_numero,
  cve_datos_proveedor,
  cve_detalle_convenio
) values (
  'tinkay',
  'EXEQUIALES_IESS',
  'Exequiales del IESS',
  'INF-IESS',
  1,
  jsonb_build_object(
    'tituloInforme', 'INFORME DE SERVICIO PROVEEDORES',
    'nombreProveedor', 'Matías Gabriel Toapanta Guerrero',
    'razonSocial', 'Floristería Tinkay',
    'ruc', '1760247047001 RIMPE NEGOCIO POPULAR',
    'direccion', 'Av. De Los Granados E14-619 y Eloy Alfaro',
    'telefono', '0991444515',
    'correoElectronico', 'tinkay.uio@gmail.com',
    'personaContacto', 'Carolina Colcha',
    'descripcionServicioDefecto', 'Set de condolencias (3 arreglos florales)',
    'recursosDefecto', 'Flores, follaje, bases y oasis'
  ),
  jsonb_build_object(
    'frecuencia_corte', 'QUINCENAL',
    'requiere_foto_gps', true
  )
)
on conflict (cve_negocio, cve_codigo) do nothing;

-- Tabla de Informes Quincenales Emitidos
create table if not exists comun_comercio.com_informe_entregas (
  ife_id uuid primary key default gen_random_uuid(),
  ife_secuencial bigint generated always as identity,
  ife_negocio text not null,
  ife_convenio_id uuid references comun_comercio.com_convenio_entrega(cve_id) on delete set null,
  ife_numero_informe text not null,
  ife_fecha_informe date not null default current_date,
  ife_fecha_inicio date not null,
  ife_fecha_fin date not null,
  ife_total_entregas integer not null default 0,
  ife_factura_referencia text,
  ife_documentos_adjuntos text,
  ife_estado text not null default 'EMITIDO' check (ife_estado in ('BORRADOR', 'EMITIDO', 'ANULADO')),
  ife_pdf_url text,
  ife_generado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  ife_generado_nombre text,
  ife_detalle_informe jsonb not null default '{}'::jsonb,
  ife_creado_en timestamptz not null default now(),
  ife_actualizado_en timestamptz not null default now(),
  ife_eliminado_en timestamptz
);

create unique index if not exists idx_com_informe_entregas_numero_unico
  on comun_comercio.com_informe_entregas (ife_negocio, ife_numero_informe)
  where ife_eliminado_en is null;

alter table comun_comercio.com_informe_entregas enable row level security;

drop policy if exists com_informe_entregas_staff on comun_comercio.com_informe_entregas;
create policy com_informe_entregas_staff on comun_comercio.com_informe_entregas
  for all using (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ife_negocio))
  with check (comun_seguridad.seg_fn_es_operador_o_admin_negocio(ife_negocio));

drop trigger if exists trg_auditoria_com_informe_entregas on comun_comercio.com_informe_entregas;
create trigger trg_auditoria_com_informe_entregas
  after insert or update or delete on comun_comercio.com_informe_entregas
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select on comun_comercio.com_informe_entregas to authenticated;
grant all on comun_comercio.com_informe_entregas to service_role;

-- Tabla Unificada de Órdenes de Trabajo (Exequiales) y Evidencias de Entrega (Pedidos Regulares)
create table if not exists comun_comercio.com_entrega_evidencia (
  ent_id uuid primary key default gen_random_uuid(),
  ent_secuencial bigint generated always as identity,
  ent_uuid_cliente uuid not null default gen_random_uuid(),
  ent_codigo_ot text,
  ent_negocio text not null,
  ent_tipo_origen text not null default 'ORDEN_TRABAJO_CONVENIO'
    check (ent_tipo_origen in ('ORDEN_TRABAJO_CONVENIO', 'PEDIDO_TIENDA')),
  ent_convenio_id uuid references comun_comercio.com_convenio_entrega(cve_id) on delete set null,
  ent_proforma_id uuid references comun_comercio.com_proforma(prf_id) on delete set null,
  ent_entregado_por uuid references comun_seguridad.seg_usuario(usu_id) on delete set null,
  ent_entregador_nombre text not null default 'Delivery',
  ent_fallecido_destinatario text not null,
  ent_fecha_servicio timestamptz not null default now(),
  ent_capturado_en timestamptz not null default now(),
  ent_sincronizado_en timestamptz not null default now(),
  ent_descripcion_servicio text not null default 'Set de condolencias (3 arreglos florales)',
  ent_ubicacion_nombre text not null default '',
  ent_coordinador_nombre text,
  ent_recursos_utilizados text default 'Flores, follaje, bases y oasis',
  ent_latitud numeric(10,7),
  ent_longitud numeric(10,7),
  ent_precision_metros numeric(8,2),
  ent_direccion_gps text,
  ent_foto_url text,
  ent_mapa_url text,
  ent_factura_referencia text,
  ent_documentos_adjuntos text,
  ent_observaciones text,
  ent_informe_id uuid references comun_comercio.com_informe_entregas(ife_id) on delete set null,
  ent_estado text not null default 'ENTREGADA_PENDIENTE_INFORME'
    check (ent_estado in ('PROGRAMADA', 'ENTREGADA_PENDIENTE_INFORME', 'INCLUIDA_EN_INFORME', 'ENTREGADO_PEDIDO_REGULAR', 'ANULADA')),
  ent_detalle_entrega jsonb not null default '{}'::jsonb,
  ent_creado_en timestamptz not null default now(),
  ent_actualizado_en timestamptz not null default now(),
  ent_eliminado_en timestamptz,
  unique (ent_uuid_cliente)
);

create index if not exists idx_com_entrega_evidencia_negocio_fecha
  on comun_comercio.com_entrega_evidencia (ent_negocio, ent_tipo_origen, ent_fecha_servicio desc)
  where ent_eliminado_en is null;

alter table comun_comercio.com_entrega_evidencia enable row level security;

drop policy if exists com_entrega_evidencia_lectura on comun_comercio.com_entrega_evidencia;
create policy com_entrega_evidencia_lectura on comun_comercio.com_entrega_evidencia
  for select using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(ent_negocio));

drop policy if exists com_entrega_evidencia_escritura on comun_comercio.com_entrega_evidencia;
create policy com_entrega_evidencia_escritura on comun_comercio.com_entrega_evidencia
  for all using (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(ent_negocio))
  with check (comun_seguridad.seg_fn_es_delivery_o_staff_negocio(ent_negocio));

drop trigger if exists trg_auditoria_com_entrega_evidencia on comun_comercio.com_entrega_evidencia;
create trigger trg_auditoria_com_entrega_evidencia
  after insert or update or delete on comun_comercio.com_entrega_evidencia
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert, update on comun_comercio.com_entrega_evidencia to authenticated;
grant all on comun_comercio.com_entrega_evidencia to service_role;

-- RPC: Obtener tablero completo de entregas (convenios, OTs Exequiales, pedidos regulares pendientes e informes emitidos)
create or replace function comun_comercio.com_fn_obtener_tablero_entregas(p_negocio text default 'tinkay')
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_es_admin boolean;
  v_convenios jsonb;
  v_entregas jsonb;
  v_informes jsonb;
  v_pedidos_pendientes jsonb;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para acceder al módulo de entregas.');
  end if;

  v_es_admin := comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio);

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
      'datosProveedor', c.cve_datos_proveedor
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
      'entregadoPor', e.ent_entregado_por,
      'entregadorNombre', e.ent_entregador_nombre,
      'fallecidoDestinatario', e.ent_fallecido_destinatario,
      'fechaServicio', e.ent_fecha_servicio,
      'capturadoEn', e.ent_capturado_en,
      'sincronizadoEn', e.ent_sincronizado_en,
      'descripcionServicio', e.ent_descripcion_servicio,
      'ubicacionNombre', e.ent_ubicacion_nombre,
      'coordinadorNombre', e.ent_coordinador_nombre,
      'recursosUtilizados', e.ent_recursos_utilizados,
      'latitud', e.ent_latitud,
      'longitud', e.ent_longitud,
      'precisionMetros', e.ent_precision_metros,
      'direccionGps', e.ent_direccion_gps,
      'fotoUrl', e.ent_foto_url,
      'mapaUrl', e.ent_mapa_url,
      'facturaReferencia', e.ent_factura_referencia,
      'documentosAdjuntos', e.ent_documentos_adjuntos,
      'observaciones', e.ent_observaciones,
      'informeId', e.ent_informe_id,
      'numeroInforme', i.ife_numero_informe,
      'estado', e.ent_estado
    ) as item
    from comun_comercio.com_entrega_evidencia e
    left join comun_comercio.com_informe_entregas i on i.ife_id = e.ent_informe_id
    where e.ent_negocio = v_negocio
      and e.ent_eliminado_en is null
    order by
      (case when e.ent_estado = 'PROGRAMADA' then 0 else 1 end) asc,
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

  -- Pedidos regulares de la tienda pendientes de confirmar entrega fotográfica
  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_pedidos_pendientes
  from (
    select jsonb_build_object(
      'proformaId', p.prf_id,
      'codigoOrden', p.prf_codigo,
      'estadoPago', p.prf_estado,
      'compradorNombre', coalesce(p.prf_detalle_proforma->'comprador'->>'nombreCompleto', p.prf_detalle_proforma->'comprador'->>'nombre', 'Cliente Web'),
      'destinatarioNombre', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'destinatarioNombre',
        p.prf_detalle_proforma->'comprador'->>'nombreCompleto',
        'Destinatario'
      ),
      'destinatarioTelefono', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'destinatarioTelefono',
        p.prf_detalle_proforma->'comprador'->>'whatsapp',
        ''
      ),
      'direccionEntrega', coalesce(
        p.prf_detalle_proforma->'logistica_entrega'->>'direccion',
        p.prf_detalle_proforma->'logistica_entrega'->>'sectorReferencia',
        'Retiro / Coordinar dirección'
      ),
      'enlaceMapa', p.prf_detalle_proforma->'logistica_entrega'->>'enlaceMapa',
      'resumenItems', coalesce((
        select string_agg(coalesce(it->>'cantidad', '1') || 'x ' || coalesce(it->>'nombre', 'Arreglo'), ', ')
        from jsonb_array_elements(
          case when jsonb_typeof(p.prf_detalle_proforma->'items') = 'array' then p.prf_detalle_proforma->'items' else '[]'::jsonb end
        ) it
      ), 'Pedido Floral'),
      'creadoEn', p.prf_creado_en
    ) as item
    from comun_comercio.com_proforma p
    where lower(p.prf_negocio) = v_negocio
      and p.prf_eliminado_en is null
      and coalesce(p.prf_detalle_proforma->>'tipo_origen', '') <> 'PROFORMA_EVENTO'
      and upper(coalesce(p.prf_estado, '')) not in ('CANCELADO', 'ANULADO', 'NO_ACEPTADA')
      and coalesce((p.prf_detalle_proforma->>'entrega_confirmada')::boolean, false) = false
      and not exists (
        select 1
        from comun_comercio.com_entrega_evidencia ev
        where ev.ent_proforma_id = p.prf_id
          and ev.ent_eliminado_en is null
          and ev.ent_estado <> 'ANULADA'
      )
    order by p.prf_creado_en desc
    limit 100
  ) sub;

  return jsonb_build_object(
    'ok', true,
    'usuarioActualId', v_uid,
    'usuarioActualNombre', coalesce(v_usu_nombre, 'Colaborador'),
    'esAdminOperador', v_es_admin,
    'convenios', v_convenios,
    'entregas', v_entregas,
    'informes', v_informes,
    'pedidosPendientesTienda', v_pedidos_pendientes
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_obtener_tablero_entregas(text) from public;
grant execute on function comun_comercio.com_fn_obtener_tablero_entregas(text) to authenticated, service_role;

-- RPC Idempotente (Online + Sincronización Offline desde IndexedDB):
-- Permite:
--   a) Crear Orden de Trabajo programada (estado = 'PROGRAMADA', sin foto aún)
--   b) Ejecutar/confirmar una OT existente o nueva con foto + GPS
--   c) Confirmar entrega fotográfica de cualquier pedido regular de la tienda (tipoOrigen = 'PEDIDO_TIENDA')
create or replace function comun_comercio.com_fn_registrar_o_sincronizar_entrega(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_usu_nombre text;
  v_uuid_cli uuid;
  v_entrega_id uuid;
  v_tipo_origen text;
  v_convenio_id uuid;
  v_proforma_id uuid;
  v_estado text;
  v_fecha_serv timestamptz;
  v_capturado timestamptz;
  v_lat numeric(10,7);
  v_lng numeric(10,7);
  v_prec numeric(8,2);
  v_reg comun_comercio.com_entrega_evidencia;
begin
  if not comun_seguridad.seg_fn_es_delivery_o_staff_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'No tienes permisos para registrar entregas.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Delivery')
    into v_usu_nombre
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  begin
    v_uuid_cli := coalesce(nullif(btrim(p_payload->>'uuidCliente'), '')::uuid, gen_random_uuid());
  exception when others then
    v_uuid_cli := gen_random_uuid();
  end;

  begin
    v_entrega_id := nullif(btrim(coalesce(p_payload->>'entregaId', '')), '')::uuid;
  exception when others then
    v_entrega_id := null;
  end;

  v_tipo_origen := case
    when upper(coalesce(p_payload->>'tipoOrigen', '')) = 'PEDIDO_TIENDA' then 'PEDIDO_TIENDA'
    else 'ORDEN_TRABAJO_CONVENIO'
  end;

  begin
    v_convenio_id := nullif(btrim(coalesce(p_payload->>'convenioId', '')), '')::uuid;
  exception when others then
    v_convenio_id := null;
  end;

  if v_tipo_origen = 'ORDEN_TRABAJO_CONVENIO' and v_convenio_id is null then
    select cve_id into v_convenio_id
    from comun_comercio.com_convenio_entrega
    where cve_negocio = v_negocio and cve_eliminado_en is null
    order by cve_secuencial asc
    limit 1;
  end if;

  begin
    v_proforma_id := nullif(btrim(coalesce(p_payload->>'proformaId', '')), '')::uuid;
  exception when others then
    v_proforma_id := null;
  end;

  v_estado := coalesce(
    nullif(btrim(coalesce(p_payload->>'estado', '')), ''),
    case
      when v_tipo_origen = 'PEDIDO_TIENDA' then 'ENTREGADO_PEDIDO_REGULAR'
      when coalesce(btrim(p_payload->>'fotoUrl'), '') = '' and coalesce((p_payload->>'soloProgramarOt')::boolean, false) then 'PROGRAMADA'
      else 'ENTREGADA_PENDIENTE_INFORME'
    end
  );

  begin
    v_fecha_serv := coalesce(nullif(btrim(p_payload->>'fechaServicio'), '')::timestamptz, now());
  exception when others then
    v_fecha_serv := now();
  end;

  begin
    v_capturado := coalesce(nullif(btrim(p_payload->>'capturadoEn'), '')::timestamptz, now());
  exception when others then
    v_capturado := now();
  end;

  begin
    v_lat := nullif(btrim(coalesce(p_payload->>'latitud', '')), '')::numeric(10,7);
    v_lng := nullif(btrim(coalesce(p_payload->>'longitud', '')), '')::numeric(10,7);
    v_prec := nullif(btrim(coalesce(p_payload->>'precisionMetros', '')), '')::numeric(8,2);
  exception when others then
    v_lat := null;
    v_lng := null;
    v_prec := null;
  end;

  -- Si estamos completando una Orden de Trabajo previamente programada
  if v_entrega_id is not null then
    update comun_comercio.com_entrega_evidencia
       set ent_entregado_por = coalesce(v_uid, ent_entregado_por),
           ent_entregador_nombre = coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, ent_entregador_nombre),
           ent_fallecido_destinatario = coalesce(nullif(btrim(p_payload->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
           ent_fecha_servicio = coalesce(v_fecha_serv, ent_fecha_servicio),
           ent_capturado_en = v_capturado,
           ent_sincronizado_en = now(),
           ent_descripcion_servicio = coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), ent_descripcion_servicio),
           ent_ubicacion_nombre = coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), ent_ubicacion_nombre),
           ent_coordinador_nombre = coalesce(nullif(btrim(p_payload->>'coordinadorNombre'), ''), ent_coordinador_nombre),
           ent_recursos_utilizados = coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), ent_recursos_utilizados),
           ent_latitud = coalesce(v_lat, ent_latitud),
           ent_longitud = coalesce(v_lng, ent_longitud),
           ent_precision_metros = coalesce(v_prec, ent_precision_metros),
           ent_direccion_gps = coalesce(nullif(btrim(p_payload->>'direccionGps'), ''), ent_direccion_gps),
           ent_foto_url = coalesce(nullif(btrim(p_payload->>'fotoUrl'), ''), ent_foto_url),
           ent_mapa_url = coalesce(nullif(btrim(p_payload->>'mapaUrl'), ''), ent_mapa_url),
           ent_observaciones = coalesce(nullif(btrim(p_payload->>'observaciones'), ''), ent_observaciones),
           ent_estado = case when ent_estado = 'INCLUIDA_EN_INFORME' then 'INCLUIDA_EN_INFORME' else 'ENTREGADA_PENDIENTE_INFORME' end,
           ent_actualizado_en = now()
     where ent_id = v_entrega_id
       and ent_negocio = v_negocio
     returning * into v_reg;
  else
    insert into comun_comercio.com_entrega_evidencia (
      ent_uuid_cliente,
      ent_negocio,
      ent_tipo_origen,
      ent_convenio_id,
      ent_proforma_id,
      ent_entregado_por,
      ent_entregador_nombre,
      ent_fallecido_destinatario,
      ent_fecha_servicio,
      ent_capturado_en,
      ent_sincronizado_en,
      ent_descripcion_servicio,
      ent_ubicacion_nombre,
      ent_coordinador_nombre,
      ent_recursos_utilizados,
      ent_latitud,
      ent_longitud,
      ent_precision_metros,
      ent_direccion_gps,
      ent_foto_url,
      ent_mapa_url,
      ent_factura_referencia,
      ent_documentos_adjuntos,
      ent_observaciones,
      ent_estado,
      ent_detalle_entrega
    ) values (
      v_uuid_cli,
      v_negocio,
      v_tipo_origen,
      v_convenio_id,
      v_proforma_id,
      v_uid,
      coalesce(nullif(btrim(p_payload->>'entregadorNombre'), ''), v_usu_nombre, 'Delivery'),
      coalesce(nullif(btrim(p_payload->>'fallecidoDestinatario'), ''), 'Destinatario'),
      v_fecha_serv,
      v_capturado,
      now(),
      coalesce(nullif(btrim(p_payload->>'descripcionServicio'), ''), 'Set de condolencias (3 arreglos florales)'),
      coalesce(nullif(btrim(p_payload->>'ubicacionNombre'), ''), ''),
      nullif(btrim(coalesce(p_payload->>'coordinadorNombre', '')), ''),
      coalesce(nullif(btrim(p_payload->>'recursosUtilizados'), ''), 'Flores, follaje, bases y oasis'),
      v_lat,
      v_lng,
      v_prec,
      nullif(btrim(coalesce(p_payload->>'direccionGps', '')), ''),
      nullif(btrim(coalesce(p_payload->>'fotoUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'mapaUrl', '')), ''),
      nullif(btrim(coalesce(p_payload->>'facturaReferencia', '')), ''),
      nullif(btrim(coalesce(p_payload->>'documentosAdjuntos', '')), ''),
      nullif(btrim(coalesce(p_payload->>'observaciones', '')), ''),
      v_estado,
      coalesce(p_payload->'detalleExtra', '{}'::jsonb)
    )
    on conflict (ent_uuid_cliente) do update set
      ent_foto_url = coalesce(excluded.ent_foto_url, comun_comercio.com_entrega_evidencia.ent_foto_url),
      ent_mapa_url = coalesce(excluded.ent_mapa_url, comun_comercio.com_entrega_evidencia.ent_mapa_url),
      ent_latitud = coalesce(excluded.ent_latitud, comun_comercio.com_entrega_evidencia.ent_latitud),
      ent_longitud = coalesce(excluded.ent_longitud, comun_comercio.com_entrega_evidencia.ent_longitud),
      ent_sincronizado_en = now(),
      ent_actualizado_en = now()
    returning * into v_reg;

    if v_reg.ent_codigo_ot is null then
      update comun_comercio.com_entrega_evidencia
         set ent_codigo_ot = (case when v_tipo_origen = 'PEDIDO_TIENDA' then 'POD-' else 'OT-' end) || lpad(v_reg.ent_secuencial::text, 4, '0')
       where ent_id = v_reg.ent_id
       returning * into v_reg;
    end if;
  end if;

  -- Si corresponde a un pedido regular de la tienda, marcar el pedido como ENTREGADO con su comprobante
  if v_tipo_origen = 'PEDIDO_TIENDA' and v_proforma_id is not null then
    update comun_comercio.com_proforma
       set prf_detalle_proforma = coalesce(prf_detalle_proforma, '{}'::jsonb) || jsonb_build_object(
             'entrega_confirmada', true,
             'entrega_confirmada_en', v_capturado,
             'entrega_entregador_nombre', v_reg.ent_entregador_nombre,
             'entrega_foto_url', v_reg.ent_foto_url,
             'entrega_latitud', v_reg.ent_latitud,
             'entrega_longitud', v_reg.ent_longitud
           ),
           prf_actualizado_en = now()
     where prf_id = v_proforma_id;

    insert into comun_comercio.com_despacho_asignacion (
      dsp_negocio, dsp_orden_id, dsp_modalidad, dsp_conductor_nombre, dsp_estado, dsp_comprobante_entrega
    ) values (
      v_negocio,
      v_proforma_id,
      'PROPIO',
      v_reg.ent_entregador_nombre,
      'ENTREGADO',
      jsonb_build_object(
        'evidencia_id', v_reg.ent_id,
        'foto_url', v_reg.ent_foto_url,
        'latitud', v_reg.ent_latitud,
        'longitud', v_reg.ent_longitud,
        'entregado_en', v_capturado
      )
    );
  end if;

  return jsonb_build_object(
    'ok', true,
    'entregaId', v_reg.ent_id,
    'codigoOt', v_reg.ent_codigo_ot,
    'estado', v_reg.ent_estado
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_registrar_o_sincronizar_entrega(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_registrar_o_sincronizar_entrega(text, jsonb) to authenticated, service_role;

-- RPC Admin/Operador: Editar cualquier campo de una entrega en pantalla antes de generar el informe quincenal
create or replace function comun_comercio.com_fn_actualizar_entrega_evidencia(
  p_negocio text,
  p_entrega_id uuid,
  p_cambios jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo administración u operaciones pueden editar registros antes del informe.');
  end if;

  update comun_comercio.com_entrega_evidencia
     set ent_fallecido_destinatario = coalesce(nullif(btrim(p_cambios->>'fallecidoDestinatario'), ''), ent_fallecido_destinatario),
         ent_fecha_servicio = coalesce(nullif(btrim(p_cambios->>'fechaServicio'), '')::timestamptz, ent_fecha_servicio),
         ent_descripcion_servicio = coalesce(nullif(btrim(p_cambios->>'descripcionServicio'), ''), ent_descripcion_servicio),
         ent_ubicacion_nombre = coalesce(p_cambios->>'ubicacionNombre', ent_ubicacion_nombre),
         ent_coordinador_nombre = coalesce(p_cambios->>'coordinadorNombre', ent_coordinador_nombre),
         ent_recursos_utilizados = coalesce(nullif(btrim(p_cambios->>'recursosUtilizados'), ''), ent_recursos_utilizados),
         ent_entregador_nombre = coalesce(nullif(btrim(p_cambios->>'entregadorNombre'), ''), ent_entregador_nombre),
         ent_factura_referencia = coalesce(p_cambios->>'facturaReferencia', ent_factura_referencia),
         ent_documentos_adjuntos = coalesce(p_cambios->>'documentosAdjuntos', ent_documentos_adjuntos),
         ent_foto_url = coalesce(nullif(btrim(p_cambios->>'fotoUrl'), ''), ent_foto_url),
         ent_mapa_url = coalesce(nullif(btrim(p_cambios->>'mapaUrl'), ''), ent_mapa_url),
         ent_estado = case
           when coalesce((p_cambios->>'anular')::boolean, false) then 'ANULADA'
           else ent_estado
         end,
         ent_actualizado_en = now()
   where ent_id = p_entrega_id
     and ent_negocio = v_negocio;

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function comun_comercio.com_fn_actualizar_entrega_evidencia(text, uuid, jsonb) from public;
grant execute on function comun_comercio.com_fn_actualizar_entrega_evidencia(text, uuid, jsonb) to authenticated, service_role;

-- RPC Admin/Operador: Actualizar datos fijos del proveedor en el convenio y emitir/guardar Informe Quincenal numerado
create or replace function comun_comercio.com_fn_emitir_informe_quincenal(
  p_negocio text,
  p_payload jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_negocio text := comun_comercio.com_fn_omnicanal_negocio_canonico(p_negocio);
  v_uid uuid := auth.uid();
  v_autor text;
  v_convenio comun_comercio.com_convenio_entrega;
  v_numero text;
  v_fecha_inf date;
  v_fecha_ini date;
  v_fecha_fin date;
  v_ids uuid[];
  v_snapshot jsonb;
  v_informe comun_comercio.com_informe_entregas;
begin
  if not comun_seguridad.seg_fn_es_operador_o_admin_negocio(v_negocio) then
    return jsonb_build_object('ok', false, 'error', 'Solo administración puede emitir informes quincenales.');
  end if;

  select coalesce(nullif(btrim(coalesce(u.usu_nombres, '') || ' ' || coalesce(u.usu_apellidos, '')), ''), u.usu_correo, 'Administración')
    into v_autor
    from comun_seguridad.seg_usuario u
   where u.usu_id = v_uid;

  select * into v_convenio
  from comun_comercio.com_convenio_entrega
  where cve_negocio = v_negocio
    and (
      (coalesce(p_payload->>'convenioId', '') <> '' and cve_id = (p_payload->>'convenioId')::uuid)
      or coalesce(p_payload->>'convenioId', '') = ''
    )
    and cve_eliminado_en is null
  order by cve_secuencial asc
  limit 1
  for update;

  if v_convenio.cve_id is not null and jsonb_typeof(p_payload->'datosProveedor') = 'object' then
    update comun_comercio.com_convenio_entrega
       set cve_datos_proveedor = coalesce(cve_datos_proveedor, '{}'::jsonb) || (p_payload->'datosProveedor'),
           cve_actualizado_en = now()
     where cve_id = v_convenio.cve_id
     returning * into v_convenio;
  end if;

  v_fecha_inf := coalesce(nullif(btrim(p_payload->>'fechaInforme'), '')::date, current_date);
  v_fecha_ini := coalesce(nullif(btrim(p_payload->>'fechaInicio'), '')::date, current_date - 15);
  v_fecha_fin := coalesce(nullif(btrim(p_payload->>'fechaFin'), '')::date, current_date);

  v_numero := nullif(btrim(coalesce(p_payload->>'numeroInforme', '')), '');
  if v_numero is null then
    v_numero := coalesce(v_convenio.cve_prefijo_informe, 'INF-IESS') || '-' || to_char(v_fecha_inf, 'YYYY') || '-' || lpad(coalesce(v_convenio.cve_siguiente_numero, 1)::text, 3, '0');
  end if;

  select array_agg((x)::uuid)
    into v_ids
    from jsonb_array_elements_text(
      case when jsonb_typeof(p_payload->'entregasIds') = 'array' then p_payload->'entregasIds' else '[]'::jsonb end
    ) x;

  if v_ids is null or array_length(v_ids, 1) is null then
    return jsonb_build_object('ok', false, 'error', 'Selecciona al menos una entrega para incluir en el informe.');
  end if;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', e.ent_id,
      'codigoOt', e.ent_codigo_ot,
      'fallecidoDestinatario', e.ent_fallecido_destinatario,
      'fechaServicio', e.ent_fecha_servicio,
      'descripcionServicio', e.ent_descripcion_servicio,
      'ubicacionNombre', e.ent_ubicacion_nombre,
      'coordinadorNombre', e.ent_coordinador_nombre,
      'recursosUtilizados', e.ent_recursos_utilizados,
      'entregadorNombre', e.ent_entregador_nombre,
      'latitud', e.ent_latitud,
      'longitud', e.ent_longitud,
      'direccionGps', e.ent_direccion_gps,
      'fotoUrl', e.ent_foto_url,
      'mapaUrl', e.ent_mapa_url,
      'facturaReferencia', coalesce(nullif(e.ent_factura_referencia, ''), p_payload->>'facturaReferencia'),
      'documentosAdjuntos', coalesce(nullif(e.ent_documentos_adjuntos, ''), p_payload->>'documentosAdjuntos')
    ) order by e.ent_fecha_servicio asc
  ), '[]'::jsonb)
  into v_snapshot
  from comun_comercio.com_entrega_evidencia e
  where e.ent_negocio = v_negocio
    and e.ent_id = any(v_ids);

  insert into comun_comercio.com_informe_entregas (
    ife_negocio,
    ife_convenio_id,
    ife_numero_informe,
    ife_fecha_informe,
    ife_fecha_inicio,
    ife_fecha_fin,
    ife_total_entregas,
    ife_factura_referencia,
    ife_documentos_adjuntos,
    ife_estado,
    ife_pdf_url,
    ife_generado_por,
    ife_generado_nombre,
    ife_detalle_informe
  ) values (
    v_negocio,
    v_convenio.cve_id,
    v_numero,
    v_fecha_inf,
    v_fecha_ini,
    v_fecha_fin,
    coalesce(array_length(v_ids, 1), 0),
    nullif(btrim(coalesce(p_payload->>'facturaReferencia', '')), ''),
    nullif(btrim(coalesce(p_payload->>'documentosAdjuntos', '')), ''),
    'EMITIDO',
    nullif(btrim(coalesce(p_payload->>'pdfUrl', '')), ''),
    v_uid,
    v_autor,
    jsonb_build_object(
      'datosProveedor', coalesce(p_payload->'datosProveedor', v_convenio.cve_datos_proveedor, '{}'::jsonb),
      'entregas', v_snapshot
    )
  )
  on conflict (ife_negocio, ife_numero_informe) where ife_eliminado_en is null
  do update set
    ife_fecha_informe = excluded.ife_fecha_informe,
    ife_fecha_inicio = excluded.ife_fecha_inicio,
    ife_fecha_fin = excluded.ife_fecha_fin,
    ife_total_entregas = excluded.ife_total_entregas,
    ife_factura_referencia = excluded.ife_factura_referencia,
    ife_documentos_adjuntos = excluded.ife_documentos_adjuntos,
    ife_pdf_url = coalesce(excluded.ife_pdf_url, comun_comercio.com_informe_entregas.ife_pdf_url),
    ife_detalle_informe = excluded.ife_detalle_informe,
    ife_actualizado_en = now()
  returning * into v_informe;

  update comun_comercio.com_entrega_evidencia
     set ent_informe_id = v_informe.ife_id,
         ent_estado = 'INCLUIDA_EN_INFORME',
         ent_factura_referencia = coalesce(nullif(ent_factura_referencia, ''), nullif(btrim(coalesce(p_payload->>'facturaReferencia', '')), '')),
         ent_documentos_adjuntos = coalesce(nullif(ent_documentos_adjuntos, ''), nullif(btrim(coalesce(p_payload->>'documentosAdjuntos', '')), '')),
         ent_actualizado_en = now()
   where ent_negocio = v_negocio
     and ent_id = any(v_ids);

  if v_convenio.cve_id is not null then
    update comun_comercio.com_convenio_entrega
       set cve_siguiente_numero = cve_siguiente_numero + 1,
           cve_actualizado_en = now()
     where cve_id = v_convenio.cve_id;
  end if;

  return jsonb_build_object(
    'ok', true,
    'informeId', v_informe.ife_id,
    'numeroInforme', v_informe.ife_numero_informe
  );
end;
$$;

revoke execute on function comun_comercio.com_fn_emitir_informe_quincenal(text, jsonb) from public;
grant execute on function comun_comercio.com_fn_emitir_informe_quincenal(text, jsonb) to authenticated, service_role;

-- =============================================================================
-- 4. PRE-CONFIGURACIÓN POR DEFECTO DE LOS 3 WIDGETS (Regla 15 / Point 1)
-- =============================================================================

do $$
declare
  v_negocio text;
  v_w record;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'margaritas', 'fastfix', 'tranqi']) loop
    for v_w in
      select * from (values
        ('inventario_rosas', 'Inventario de Rosas (IA)', 'Conteo fotográfico de bonches de rosas por colores asistido por ARIA y consolidado del último corte.', '/panel/inventario-rosas', 'Flower2', array['VENTAS', 'VENDEDOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN']),
        ('galeria_inmediata', 'Entrega Inmediata (1–2h)', 'Galería de arreglos listos en tienda con precio especial y baja automática al venderse en web.', '/panel/entrega-inmediata', 'Zap', array['VENTAS', 'VENDEDOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN']),
        ('confirmacion_entregas', 'Entregas e Informes GPS', 'Órdenes de trabajo Exequiales IESS, confirmación fotográfica georreferenciada offline e informes quincenales.', '/panel/entregas', 'MapPin', array['DELIVERY', 'REPARTIDOR', 'OPERADOR', 'ADMINISTRADOR', 'SUPERADMIN'])
      ) as t(clave, nombre, descripcion, ruta, icono, roles)
    loop
      insert into comun_seguridad.seg_widget (
        wdg_negocio, wdg_clave, wdg_nombre, wdg_activo, wdg_detalle_widget
      ) values (
        v_negocio,
        v_w.clave,
        v_w.nombre,
        true,
        jsonb_build_object(
          'descripcion', v_w.descripcion,
          'categoria', 'Operación y Logística Floral',
          'ruta', v_w.ruta,
          'panel_defecto', 'panel_administrar',
          'icono', v_w.icono
        )
      )
      on conflict (wdg_negocio, wdg_clave) do update set
        wdg_nombre = excluded.wdg_nombre,
        wdg_activo = true,
        wdg_detalle_widget = excluded.wdg_detalle_widget,
        wdg_actualizado_en = now()
      returning wdg_id into v_widget_id;

      if v_widget_id is not null then
        insert into comun_seguridad.seg_rol_widget (rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible)
        select v_negocio, r, v_widget_id, true
        from unnest(v_w.roles) as r
        on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
          rlw_visible = true,
          rlw_actualizado_en = now();
      end if;
    end loop;
  end loop;
end $$;

notify pgrst, 'reload schema';
