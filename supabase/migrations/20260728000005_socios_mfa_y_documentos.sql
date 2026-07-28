-- TRQ-001 ampliacion: MFA obligatorio para administradores que acceden a
-- socios/solicitudes (alcance Tranqi unicamente -- decision del negocio,
-- los otros 3 no lo requieren todavia) + almacenamiento seguro de
-- documentos de respaldo (titulo, matricula, certificados de experiencia).

-- ═══════════ Helper: admin de tranqi CON aal2 verificado ═══════════
-- request.jwt.claims es el GUC que PostgREST setea en cada request con el
-- JWT completo -- incluye "aal" cuando Supabase Auth MFA esta en uso.
-- Se usa la forma cruda (no auth.jwt()) por portabilidad.
create or replace function tranqui_legal.trq_fn_es_admin_mfa_verificado()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select comun_seguridad.seg_fn_es_admin_negocio('tranqi')
    and coalesce(current_setting('request.jwt.claims', true)::jsonb ->> 'aal', '') = 'aal2';
$$;

grant execute on function tranqui_legal.trq_fn_es_admin_mfa_verificado() to authenticated;

-- ═══════════ RLS: acceso admin a solicitudes/socios exige aal2 ═══════════
-- El acceso propio (dueno de la fila) no cambia -- solo la rama "admin".
drop policy trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio;
create policy trq_solicitud_socio_admin_select on tranqui_legal.trq_solicitud_socio
  for select using (tranqui_legal.trq_fn_es_admin_mfa_verificado());

drop policy trq_experiencia_laboral_select on tranqui_legal.trq_experiencia_laboral;
create policy trq_experiencia_laboral_select on tranqui_legal.trq_experiencia_laboral
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = exp_solicitud_id and (s.ssc_usuario_id = auth.uid() or tranqui_legal.trq_fn_es_admin_mfa_verificado()))
  );

drop policy trq_documento_socio_select on tranqui_legal.trq_documento_socio;
create policy trq_documento_socio_select on tranqui_legal.trq_documento_socio
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = dcs_solicitud_id and (s.ssc_usuario_id = auth.uid() or tranqui_legal.trq_fn_es_admin_mfa_verificado()))
  );

drop policy trq_solicitud_materia_select on tranqui_legal.trq_solicitud_materia;
create policy trq_solicitud_materia_select on tranqui_legal.trq_solicitud_materia
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = sma_solicitud_id and (s.ssc_usuario_id = auth.uid() or tranqui_legal.trq_fn_es_admin_mfa_verificado()))
  );

drop policy trq_solicitud_provincia_select on tranqui_legal.trq_solicitud_provincia;
create policy trq_solicitud_provincia_select on tranqui_legal.trq_solicitud_provincia
  for select using (
    exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = spr_solicitud_id and (s.ssc_usuario_id = auth.uid() or tranqui_legal.trq_fn_es_admin_mfa_verificado()))
  );

drop policy trq_revision_solicitud_select on tranqui_legal.trq_revision_solicitud;
create policy trq_revision_solicitud_select on tranqui_legal.trq_revision_solicitud
  for select using (
    tranqui_legal.trq_fn_es_admin_mfa_verificado()
    or exists (select 1 from tranqui_legal.trq_solicitud_socio s where s.ssc_id = rev_solicitud_id and s.ssc_usuario_id = auth.uid())
  );

drop policy trq_abogado_select on tranqui_legal.trq_abogado;
create policy trq_abogado_select on tranqui_legal.trq_abogado
  for select using (abg_usuario_id = auth.uid() or tranqui_legal.trq_fn_es_admin_mfa_verificado());

-- ═══════════ RPC decidir_solicitud: exige aal2, no solo ser admin ═══════════
create or replace function tranqui_legal.trq_fn_decidir_solicitud(
  p_solicitud_id uuid,
  p_decision text,
  p_comentario text default null
)
returns tranqui_legal.trq_solicitud_socio
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_solicitud tranqui_legal.trq_solicitud_socio;
begin
  if not tranqui_legal.trq_fn_es_admin_mfa_verificado() then
    raise exception 'No autorizado: se requiere ser administrador de tranqi con verificacion MFA (aal2) activa';
  end if;

  if p_decision not in ('aceptada', 'rechazada') then
    raise exception 'Decision invalida: %', p_decision;
  end if;

  select * into v_solicitud from tranqui_legal.trq_solicitud_socio where ssc_id = p_solicitud_id for update;
  if not found then
    raise exception 'Solicitud no encontrada';
  end if;
  if v_solicitud.ssc_estado not in ('enviada', 'en_revision') then
    raise exception 'La solicitud ya fue decidida (estado actual: %)', v_solicitud.ssc_estado;
  end if;

  insert into tranqui_legal.trq_revision_solicitud (rev_solicitud_id, rev_admin_id, rev_decision, rev_comentario)
  values (p_solicitud_id, auth.uid(), p_decision, p_comentario);

  update tranqui_legal.trq_solicitud_socio
  set ssc_estado = p_decision, ssc_actualizado_en = now()
  where ssc_id = p_solicitud_id
  returning * into v_solicitud;

  if p_decision = 'aceptada' then
    insert into tranqui_legal.trq_abogado (abg_usuario_id, abg_solicitud_id)
    values (v_solicitud.ssc_usuario_id, p_solicitud_id)
    on conflict (abg_usuario_id) do update
      set abg_solicitud_id = excluded.abg_solicitud_id, abg_estado = 'verificado', abg_actualizado_en = now();

    perform comun_seguridad.seg_fn_asignar_rol(v_solicitud.ssc_usuario_id, 'tranqi', 'ABOGADO');
  end if;

  return v_solicitud;
end;
$$;

-- ═══════════ Storage: documentos de respaldo (privado) ═══════════
-- Titulo, matricula, certificados de experiencia. Path: {ssc_id}/{archivo}.
-- Bucket privado -- nunca URL publica, solo signed URLs generadas server-side
-- para quien tiene permiso real (dueno o admin-mfa).
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'socios-documentos', 'socios-documentos', false, 15728640,
  array[
    'application/pdf', 'image/jpeg', 'image/png', 'image/webp',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text'
  ]
)
on conflict (id) do nothing;

create policy socios_documentos_propio_insert on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'socios-documentos'
    and exists (
      select 1 from tranqui_legal.trq_solicitud_socio s
      where s.ssc_id::text = (storage.foldername(name))[1]
        and s.ssc_usuario_id = auth.uid()
    )
  );

create policy socios_documentos_select on storage.objects
  for select to authenticated
  using (
    bucket_id = 'socios-documentos'
    and (
      exists (
        select 1 from tranqui_legal.trq_solicitud_socio s
        where s.ssc_id::text = (storage.foldername(name))[1]
          and s.ssc_usuario_id = auth.uid()
      )
      or tranqui_legal.trq_fn_es_admin_mfa_verificado()
    )
  );
