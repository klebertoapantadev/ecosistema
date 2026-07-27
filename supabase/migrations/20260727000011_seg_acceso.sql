-- Historial de accesos por usuario/dispositivo, comun a los 4 negocios (vive
-- en comun_seguridad porque la identidad tambien lo es). Alimenta dos cosas:
-- 1) la lista de "dispositivos recientes" en Mi cuenta.
-- 2) el saludo personalizado ("hola de nuevo" / "cuanto tiempo"), calculado
--    a partir de la fila anterior a la mas reciente -- no depende de
--    auth.users.last_sign_in_at (no expuesto via PostgREST al propio
--    usuario sin logica adicional).
create table comun_seguridad.seg_acceso (
  acc_id uuid primary key default gen_random_uuid(),
  acc_secuencial bigint generated always as identity,
  acc_usuario_id uuid not null references comun_seguridad.seg_usuario(usu_id) on delete cascade,
  acc_ip text,
  acc_user_agent text,
  acc_creado_en timestamptz not null default now()
);

create index seg_acceso_usuario_fecha_idx on comun_seguridad.seg_acceso (acc_usuario_id, acc_creado_en desc);

alter table comun_seguridad.seg_acceso enable row level security;

create policy seg_acceso_propio_select on comun_seguridad.seg_acceso
  for select using (acc_usuario_id = auth.uid());

create policy seg_acceso_propio_insert on comun_seguridad.seg_acceso
  for insert with check (acc_usuario_id = auth.uid());

create trigger trg_auditoria_seg_acceso after insert or update or delete on comun_seguridad.seg_acceso for each row execute function comun_auditoria.aud_fn_auditar_tabla();

grant select, insert on comun_seguridad.seg_acceso to authenticated;
