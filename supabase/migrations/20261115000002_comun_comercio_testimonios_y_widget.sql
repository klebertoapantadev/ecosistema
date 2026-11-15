-- Migración: Tabla comun_comercio.com_testimonio y Pre-configuración de Widget (PLT-009, PLT-015, TNK-002)

create table if not exists comun_comercio.com_testimonio (
  tes_id uuid primary key default gen_random_uuid(),
  tes_secuencial bigint generated always as identity,
  tes_negocio text not null, -- 'tinkay' | 'tranqi' | 'fastfix' | 'margaritas'
  tes_nombre_cliente text not null,
  tes_ciudad text not null default 'Quito',
  tes_ocasion text not null default '💐 Entrega Floral',
  tes_comentario text not null,
  tes_imagen_url text not null,
  tes_calificacion int not null default 5 check (tes_calificacion between 1 and 5),
  tes_orden int not null default 0,
  tes_activo boolean not null default true,
  tes_destacado boolean not null default true,
  tes_detalle_testimonio jsonb not null default '{}'::jsonb,
  tes_creado_en timestamptz not null default now(),
  tes_actualizado_en timestamptz not null default now()
);

alter table comun_comercio.com_testimonio enable row level security;

-- Política de lectura: los testimonios activos son públicos para el ecommerce.
-- Los administradores del negocio pueden ver todos (activos e inactivos).
drop policy if exists com_testimonio_lectura on comun_comercio.com_testimonio;
create policy com_testimonio_lectura on comun_comercio.com_testimonio
  for select using (
    tes_activo = true or
    comun_seguridad.seg_fn_es_admin_negocio(tes_negocio)
  );

-- Política de gestión: administradores de negocio pueden insertar, actualizar y eliminar.
drop policy if exists com_testimonio_gestion on comun_comercio.com_testimonio;
create policy com_testimonio_gestion on comun_comercio.com_testimonio
  for all using (
    comun_seguridad.seg_fn_es_admin_negocio(tes_negocio)
  ) with check (
    comun_seguridad.seg_fn_es_admin_negocio(tes_negocio)
  );

-- Auditoría obligatoria
drop trigger if exists trg_auditoria_com_testimonio on comun_comercio.com_testimonio;
create trigger trg_auditoria_com_testimonio
  after insert or update or delete on comun_comercio.com_testimonio
  for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant usage on schema comun_comercio to anon, authenticated;
grant select on comun_comercio.com_testimonio to anon, authenticated;
grant all on comun_comercio.com_testimonio to authenticated;

-- Sembrar testimonios iniciales reales para Tinkay Floristería
insert into comun_comercio.com_testimonio (
  tes_negocio, tes_nombre_cliente, tes_ciudad, tes_ocasion, tes_comentario, tes_imagen_url, tes_calificacion, tes_orden, tes_activo, tes_destacado
) values
  ('tinkay', 'Angelo Carvajal', 'Quito', '🌻 Arreglo Especial de Girasoles', '«El arreglo está muy lindo, le gustó mucho a mi esposa. Muchas gracias por la confirmación y la entrega puntual.»', '/img/testimonios/testimonio-whatsapp-girasoles.jpg', 5, 1, true, true),
  ('tinkay', 'José González', 'Quito y Valles', '🎪 Montaje y Decoración de Evento', '«Quedó muy bien, muy recomendados. Agradecemos su gentileza y puntualidad con el equipo de instalación.»', '/img/testimonios/testimonio-whatsapp-evento-mesas.jpg', 5, 2, true, true),
  ('tinkay', 'Camila R.', 'Quito Norte (La Carolina)', '💐 Cumpleaños Sorpresa', '«¡Llegó puntualísimo a las 9 am a la oficina de mi hermana! Las rosas olían increíble y la dedicatoria en papel verjurado quedó perfecta. 100% recomendados.»', '/img/extras/bouquet_rojo_recostado_tinkay.jpg', 5, 3, true, true),
  ('tinkay', 'David S.', 'Cumbayá', '🌹 Aniversario de Bodas', '«Compré el Abanico Floral con los chocolates Ferrero. La presentación superó las fotos de la página web. Mi esposa quedó fascinada con la frescura de los botones.»', '/img/extras/bouquet_rojo_caja_ferrero_corazon.jpg', 5, 4, true, true),
  ('tinkay', 'Valeria M.', 'Quito Centro', '🎁 Detalle de Agradecimiento', '«Excelente atención por WhatsApp y pago súper rápido con Payphone. Me enviaron foto del arreglo terminado antes de sacarlo a ruta. Gran servicio al cliente.»', '/img/extras/bouquet_rojo_ferrero_taller.jpg', 5, 5, true, true),
  ('tinkay', 'Juan Carlos P.', 'Tumbaco', '🕊️ Arreglo de Condolencias', '«En momentos difíciles la puntualidad y el respeto lo son todo. La cinta personalizada lila quedó con caligrafía impecable y el arreglo monumental llegó a la sala con mucha solemnidad.»', '/img/slide2_cementerio_flores.jpg', 5, 6, true, true)
on conflict do nothing;

-- ══════════════════════════════════════════════════════════════════════════════
-- Registro y Pre-configuración de Widget en comun_seguridad (Regla 15, Point 1)
-- ══════════════════════════════════════════════════════════════════════════════

do $$
declare
  v_negocio text;
  v_widget_id uuid;
begin
  for v_negocio in select unnest(array['tinkay', 'tranqi', 'fastfix', 'margaritas']) loop
    -- Insertar o actualizar seg_widget
    insert into comun_seguridad.seg_widget (
      wdg_negocio,
      wdg_clave,
      wdg_nombre,
      wdg_activo,
      wdg_detalle_widget
    ) values (
      v_negocio,
      'testimonios_clientes',
      'Testimonios y Reseñas de Clientes',
      true,
      jsonb_build_object(
        'descripcion', 'Gestión de capturas de WhatsApp, fotos de entregas y reseñas reales con sincronización al carrusel público y álbum de Google Photos.',
        'categoria', 'Comercio y Marketing',
        'ruta', '/panel/testimonios',
        'panel_defecto', 'panel_administrar',
        'icono', 'MessageSquareHeart'
      )
    )
    on conflict (wdg_negocio, wdg_clave) do update set
      wdg_nombre = excluded.wdg_nombre,
      wdg_activo = true,
      wdg_detalle_widget = excluded.wdg_detalle_widget,
      wdg_actualizado_en = now()
    returning wdg_id into v_widget_id;

    if v_widget_id is null then
      select wdg_id into v_widget_id from comun_seguridad.seg_widget
      where wdg_negocio = v_negocio and wdg_clave = 'testimonios_clientes';
    end if;

    -- Pre-configurar en seg_rol_widget para ADMINISTRADOR y SUPERADMIN
    if v_widget_id is not null then
      insert into comun_seguridad.seg_rol_widget (
        rlw_negocio, rlw_rol, rlw_widget_id, rlw_visible, rlw_orden
      ) values
        (v_negocio, 'ADMINISTRADOR', v_widget_id, true, 8),
        (v_negocio, 'SUPERADMIN', v_widget_id, true, 8)
      on conflict (rlw_negocio, rlw_rol, rlw_widget_id) do update set
        rlw_visible = true,
        rlw_actualizado_en = now();
    end if;
  end loop;
end $$;
