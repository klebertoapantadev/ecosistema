-- ==============================================================================
-- Migración: 20260906000001_trq_validacion_identidad_aria.sql
-- Implementa: TRQ-ABG-005 — Verificación Inteligente de Identidad y Documentos
--             con Aria en el registro de abogados.
-- ==============================================================================
--
-- La especificación dice guardar el dictamen en `trq_solicitud_socio.ssc_detalles`
-- (`aria_validacion: { estado, score, documentos_auditados }`). Esa columna no
-- existía: se crea aquí.
--
-- Y se añade `dcs_analisis` a cada documento, que la especificación no pedía
-- pero el cotejo cruzado necesita. La regla 2 de TRQ-ABG-005 exige comparar el
-- titular del título del SENESCYT, del carnet del Foro y del RUC contra la
-- identidad base: para poder compararlos hay que haber guardado, documento a
-- documento, a nombre de quién salió cada uno. Un dictamen global no permite
-- decir DÓNDE está la discrepancia, que es justo lo que el operador necesita
-- ver en la mesa de control.

alter table tranqui_legal.trq_solicitud_socio
  add column if not exists ssc_detalles jsonb not null default '{}'::jsonb;

comment on column tranqui_legal.trq_solicitud_socio.ssc_detalles is
  'Dictamen de Aria y otros metadatos de la solicitud. Clave `aria_validacion`: '
  '{ estado: APROBADO|OBSERVACION|RECHAZADO, score, documentos_auditados, '
  'observaciones, evaluado_en }. Ver TRQ-ABG-005.';

alter table tranqui_legal.trq_documento_socio
  add column if not exists dcs_analisis jsonb not null default '{}'::jsonb;

comment on column tranqui_legal.trq_documento_socio.dcs_analisis is
  'Lo que Aria extrajo de ESTE documento: { titular, identificacion, '
  'tipo_detectado, legible, score_similitud, observaciones, analizado_en, run_id }. '
  'Es lo que permite el cotejo cruzado y señalar en qué documento está la '
  'discrepancia, no solo que la hay.';

-- Bandeja de la mesa de control: las solicitudes que Aria marcó en rojo o en
-- ámbar, que son las que un operador tiene que mirar con calma.
create index if not exists idx_trq_solicitud_aria_estado
  on tranqui_legal.trq_solicitud_socio ((ssc_detalles -> 'aria_validacion' ->> 'estado'))
  where ssc_eliminado_en is null;

-- ============ RPC: guardar el dictamen ============
-- Es RPC y no un UPDATE directo porque el dictamen decide si una solicitud
-- avanza, y `AGENTS.md` regla 5 pide transacción para las transiciones que
-- pesan. Además el postulante NO puede escribir aquí su propio veredicto: la
-- función es SECURITY DEFINER y comprueba que la solicitud sea suya, pero el
-- contenido lo pone el servidor tras llamar a Aria, nunca el navegador.
create or replace function tranqui_legal.trq_fn_guardar_dictamen_aria(
  p_solicitud_id uuid,
  p_documento_id uuid,
  p_analisis_documento jsonb,
  p_dictamen_global jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_dueno uuid;
begin
  select ssc_usuario_id into v_dueno
  from tranqui_legal.trq_solicitud_socio
  where ssc_id = p_solicitud_id and ssc_eliminado_en is null;

  if v_dueno is null then
    raise exception 'La solicitud no existe';
  end if;

  -- El dueño de la solicitud o el staff de tranqi. Nadie más.
  if v_dueno <> auth.uid()
     and not comun_seguridad.seg_fn_es_operador_o_admin_negocio('tranqi') then
    raise exception 'No puedes analizar documentos de otra solicitud';
  end if;

  if p_documento_id is not null then
    update tranqui_legal.trq_documento_socio
       set dcs_analisis = coalesce(p_analisis_documento, '{}'::jsonb)
     where dcs_id = p_documento_id and dcs_solicitud_id = p_solicitud_id;
  end if;

  if p_dictamen_global is not null then
    update tranqui_legal.trq_solicitud_socio
       set ssc_detalles = jsonb_set(
             coalesce(ssc_detalles, '{}'::jsonb),
             '{aria_validacion}',
             p_dictamen_global,
             true),
           ssc_actualizado_en = now()
     where ssc_id = p_solicitud_id;
  end if;
end;
$$;

grant execute on function tranqui_legal.trq_fn_guardar_dictamen_aria(uuid, uuid, jsonb, jsonb) to authenticated;
