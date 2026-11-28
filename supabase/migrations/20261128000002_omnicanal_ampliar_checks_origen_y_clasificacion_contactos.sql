-- Alinear check constraints de agc_contacto_fuente y agc_contacto_directorio
-- con todos los valores emitidos por las RPCs omnicanal (MANUAL_CHAT, CRM, LISTA_IGNORAR, BLOQUEADO_SPAM).

alter table comun_agentes.agc_contacto_fuente
  drop constraint if exists agc_contacto_fuente_cfu_origen_check;

alter table comun_agentes.agc_contacto_fuente
  add constraint agc_contacto_fuente_cfu_origen_check
  check (cfu_origen in (
    'VCF', 'CSV', 'XLSX', 'CONTACT_PICKER', 'GOOGLE_CONTACTS',
    'CRM', 'CRM_WEB', 'MANUAL', 'MANUAL_CHAT', 'LISTA_IGNORAR'
  ));

alter table comun_agentes.agc_contacto_directorio
  drop constraint if exists agc_contacto_directorio_cdo_clasificacion_check;

alter table comun_agentes.agc_contacto_directorio
  add constraint agc_contacto_directorio_cdo_clasificacion_check
  check (cdo_clasificacion in (
    'PERSONAL', 'CLIENTE', 'PROVEEDOR', 'EQUIPO_INTERNO', 'BLOQUEADO_SPAM'
  ));
