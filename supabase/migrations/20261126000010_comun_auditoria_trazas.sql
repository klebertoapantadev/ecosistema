-- comun_auditoria.aud_traza: trazas de ejecución de flujos (TRQ-039).
--
-- aud_registro guarda cambios de datos y aud_log_api llamadas a APIs externas;
-- ninguna explica por qué un flujo se quedó a medias. Ejemplo que lo motivó:
-- 33 pagos PLUX en PENDIENTE sin rastro de si falló el paybox, la acción de
-- confirmación o el webhook. Cada paso de un flujo deja aquí una fila con el
-- mismo tra_correlacion (en pagos, el identificador PLUX), venga del
-- navegador, del servidor o de una Edge Function.
--
-- Solo se escribe con service_role (registrarTraza en @eco/auditoria y las
-- Edge Functions); el navegador pasa por una server action que valida y
-- recorta. Lectura: superadmin de plataforma. Retención: 90 días (pg_cron).

create table if not exists comun_auditoria.aud_traza (
  tra_id uuid primary key default gen_random_uuid(),
  tra_secuencial bigint generated always as identity,
  tra_negocio text,
  tra_flujo text not null,
  tra_paso text not null,
  tra_nivel text not null default 'INFO' check (tra_nivel in ('INFO', 'AVISO', 'ERROR')),
  tra_origen text not null check (tra_origen in ('CLIENTE', 'SERVIDOR', 'WEBHOOK')),
  tra_correlacion text,
  tra_duracion_ms integer,
  tra_mensaje text,
  tra_usuario_id uuid,
  tra_detalle_traza jsonb not null default '{}'::jsonb,
  tra_creado_en timestamptz not null default now()
);

create index if not exists idx_aud_traza_correlacion on comun_auditoria.aud_traza (tra_correlacion, tra_creado_en);
create index if not exists idx_aud_traza_flujo on comun_auditoria.aud_traza (tra_flujo, tra_creado_en desc);
create index if not exists idx_aud_traza_errores on comun_auditoria.aud_traza (tra_creado_en desc) where tra_nivel <> 'INFO';

alter table comun_auditoria.aud_traza enable row level security;

revoke all on comun_auditoria.aud_traza from anon, authenticated;
grant select on comun_auditoria.aud_traza to authenticated;
grant usage on schema comun_auditoria to service_role;
grant select, insert, delete on comun_auditoria.aud_traza to service_role;

drop policy if exists aud_traza_superadmin_select on comun_auditoria.aud_traza;
create policy aud_traza_superadmin_select on comun_auditoria.aud_traza
  for select using (
    exists (select 1 from comun_seguridad.seg_usuario u where u.usu_id = auth.uid() and u.usu_superadmin_plataforma)
  );

-- Vista por flujo: un renglón por correlación con su último paso, para ver de
-- un vistazo qué pagos se quedaron sin terminar y dónde.
create or replace view comun_auditoria.aud_v_traza_resumen
with (security_invoker = true) as
select
  t.tra_flujo,
  t.tra_negocio,
  t.tra_correlacion,
  min(t.tra_creado_en) as inicio,
  max(t.tra_creado_en) as fin,
  count(*) as pasos,
  count(*) filter (where t.tra_nivel = 'ERROR') as errores,
  (array_agg(t.tra_paso order by t.tra_creado_en desc, t.tra_secuencial desc))[1] as ultimo_paso,
  (array_agg(t.tra_nivel order by t.tra_creado_en desc, t.tra_secuencial desc))[1] as ultimo_nivel,
  (array_agg(t.tra_mensaje order by t.tra_creado_en desc, t.tra_secuencial desc) filter (where t.tra_nivel <> 'INFO'))[1] as ultimo_problema
from comun_auditoria.aud_traza t
where t.tra_correlacion is not null
group by t.tra_flujo, t.tra_negocio, t.tra_correlacion;

grant select on comun_auditoria.aud_v_traza_resumen to authenticated;

-- Retención: las trazas son diagnóstico, no registro contable.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'aud_traza_retencion';
    perform cron.schedule(
      'aud_traza_retencion',
      '17 4 * * *',
      $cron$delete from comun_auditoria.aud_traza where tra_creado_en < now() - interval '90 days'$cron$
    );
  end if;
end;
$$;
