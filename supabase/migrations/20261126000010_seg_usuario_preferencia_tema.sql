-- TRQ-040: tema del panel (claro | oscuro | sistema) guardado en el perfil,
-- para que la elección siga al usuario en cualquier dispositivo. Es de
-- usuario, no de negocio: quien elige oscuro lo quiere en todos los paneles.
-- 'sistema' (seguir al sistema operativo) es el valor de todos hoy.
alter table comun_seguridad.seg_usuario
  add column if not exists usu_preferencia_tema text not null default 'sistema'
    constraint seg_usuario_preferencia_tema_ck check (usu_preferencia_tema in ('claro', 'oscuro', 'sistema'));

comment on column comun_seguridad.seg_usuario.usu_preferencia_tema is
  'Tema del panel elegido por el usuario: claro, oscuro o sistema (sigue al SO).';

-- 20260727000006 limita el UPDATE de authenticated a columnas concretas; el
-- usuario cambia su propio tema desde el panel (la RLS ya acota a su fila).
grant update (usu_preferencia_tema) on comun_seguridad.seg_usuario to authenticated;
