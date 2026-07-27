-- PLT-001 regla 2: autorizacion de contacto por WhatsApp, opt-in, desmarcada
-- por defecto. usu_onboarding_completo evita repetir la pantalla de
-- bienvenida en cada login.
alter table comun_seguridad.seg_usuario
  add column usu_autorizacion_whatsapp boolean not null default false;

alter table comun_seguridad.seg_usuario
  add column usu_onboarding_completo boolean not null default false;
