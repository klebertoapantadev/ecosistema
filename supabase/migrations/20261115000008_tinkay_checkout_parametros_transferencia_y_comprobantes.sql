-- =============================================================================
-- Migración: Parámetros de Checkout Rápido (< $50), WhatsApp Oficial,
--            Transferencia Bancaria + Código QR DeUna y Comprobantes (PLT-008 / PLT-009)
-- Fecha: 2026-11-15
-- =============================================================================

-- 1. Pre-configurar parámetros de tienda de Tinkay en comun_configuracion.cfg_negocio
--    sin sobrescribir configuraciones previas (merge JSONB idempotente).
do $$
declare
  v_default jsonb := jsonb_build_object(
    'whatsappTienda', '+593 99 292 2343',
    'montoMaximoPagoSinDatosUsd', 50,
    'transferencia', jsonb_build_object(
      'habilitada', true,
      'nombreTitular', 'Kleber Toapanta',
      'identificacionTitular', '1714898226',
      'correoTitular', 'tinkay.uio@gmail.com',
      'cuentas', jsonb_build_array(
        jsonb_build_object(
          'banco', 'Banco Pichincha',
          'tipoCuenta', 'Ahorros',
          'numeroCuenta', '2211739080'
        ),
        jsonb_build_object(
          'banco', 'Produbanco',
          'tipoCuenta', 'Ahorros',
          'numeroCuenta', '12054049119'
        )
      ),
      'qrDeunaUrl', '/img/qr-deuna-tinkay.png',
      'advertenciaAcreditacion', 'El envío se procesará luego de verificar la acreditación del pago.'
    )
  );
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'comun_configuracion'
      and table_name = 'cfg_negocio'
  ) then
    update comun_configuracion.cfg_negocio
    set cfg_detalle_configuracion = coalesce(cfg_detalle_configuracion, '{}'::jsonb)
      || jsonb_build_object(
        'whatsappTienda',
        coalesce(nullif(cfg_detalle_configuracion->>'whatsappTienda', ''), '+593 99 292 2343'),
        'tienda_checkout',
        v_default || coalesce(cfg_detalle_configuracion->'tienda_checkout', '{}'::jsonb)
      )
    where cfg_negocio in ('tinkay', 'tinkay_floristeria');
  end if;
end $$;

-- 2. Habilitar carga acotada de comprobantes (imagen o PDF) en bucket comun-publico
--    estrictamente bajo la ruta {negocio}/comprobantes-transferencia/*
do $$
begin
  if exists (
    select 1
    from information_schema.tables
    where table_schema = 'storage'
      and table_name = 'buckets'
  ) then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values (
      'comun-publico',
      'comun-publico',
      true,
      6291456,
      array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
    )
    on conflict (id) do update
      set allowed_mime_types = (
        select array_agg(distinct m)
        from unnest(
          coalesce(storage.buckets.allowed_mime_types, array[]::text[]) ||
          array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'application/pdf']
        ) as m
      ),
      file_size_limit = greatest(coalesce(storage.buckets.file_size_limit, 0), 6291456);

    drop policy if exists "comprobantes_transferencia_insert_acotado" on storage.objects;
    create policy "comprobantes_transferencia_insert_acotado"
      on storage.objects
      for insert
      to anon, authenticated
      with check (
        bucket_id = 'comun-publico'
        and name ~ '^[a-z0-9_-]+/comprobantes-transferencia/[0-9]{4}-[0-9]{2}/[a-zA-Z0-9._-]+$'
      );
  end if;
end $$;
