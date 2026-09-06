-- ==============================================================================
-- Limpieza de los datos de prueba del 2026-09-06
-- ==============================================================================
--
-- Creados para validar el flujo de agenda de punta a punta (PLT-020) contra la
-- base real. Están en el proyecto `oaybbpdxhlxjbpwnoymy`, que es de desarrollo,
-- pero conviene retirarlos cuando dejen de hacer falta: un abogado verificado
-- de mentira aparece en el reparto por turno como cualquier otro.
--
-- Qué se creó:
--   · Solicitud de socio ACEPTADA para abogado@tranqi.ec (matrícula MAT-PRUEBA-001)
--   · trq_abogado verificado a partir de ella
--   · Perfil ABOGADO sobre su membresía de tranqi
--   · 3 materias (Familia y Niñez, Civil, Tránsito)
--   · Agenda: lunes a viernes 09:00–13:00 y 15:00–18:00, citas de 45 min
--   · Una cita confirmada del lunes 7/09 a las 10:00 con satcomla.ti@gmail.com
--
-- El usuario `abogado@tranqi.ec` NO se borra: ya existía antes.

begin;

-- La cita y su reserva. Se borran de verdad porque son basura de prueba, no
-- historial de negocio; para todo lo demás el sistema usa borrado lógico.
delete from comun_agenda.age_reserva
 where res_referencia_id in (
   select cit_id from tranqui_legal.trq_cita
    where cit_cliente_id = 'eed8ec7e-81e5-44f3-9e8c-666dc089509b'
      and cit_inicio_en >= '2026-09-07'::date);

delete from tranqui_legal.trq_cita
 where cit_cliente_id = 'eed8ec7e-81e5-44f3-9e8c-666dc089509b'
   and cit_inicio_en >= '2026-09-07'::date;

-- La agenda del abogado de prueba (age_franja cae por CASCADE).
delete from comun_agenda.age_profesional
 where agp_usuario_id = '52bf4b76-23cb-4361-b450-64e5e7180844'
   and agp_detalle_profesional->>'datos_de_prueba' = 'true';

-- Sus materias y su ficha de abogado.
delete from tranqui_legal.trq_abogado_materia
 where amt_abogado_id in (
   select abg_id from tranqui_legal.trq_abogado
    where abg_usuario_id = '52bf4b76-23cb-4361-b450-64e5e7180844');

delete from tranqui_legal.trq_abogado
 where abg_usuario_id = '52bf4b76-23cb-4361-b450-64e5e7180844';

-- El perfil ABOGADO que se le añadió.
delete from comun_seguridad.seg_membresia_perfil
 where mpe_perfil_id = '63eef240-1311-4272-8a38-ef8b6a3de008'
   and mpe_membresia_id in (
     select mem_id from comun_seguridad.seg_membresia
      where mem_usuario_id = '52bf4b76-23cb-4361-b450-64e5e7180844');

-- La solicitud inventada. Se reconoce por la matrícula.
delete from tranqui_legal.trq_solicitud_socio
 where ssc_matricula_profesional = 'MAT-PRUEBA-001';

commit;

-- Comprobación: todo a cero.
select
  (select count(*) from tranqui_legal.trq_abogado) as abogados,
  (select count(*) from comun_agenda.age_profesional) as agendas,
  (select count(*) from comun_agenda.age_reserva) as reservas,
  (select count(*) from tranqui_legal.trq_solicitud_socio
    where ssc_matricula_profesional = 'MAT-PRUEBA-001') as solicitudes_prueba;
