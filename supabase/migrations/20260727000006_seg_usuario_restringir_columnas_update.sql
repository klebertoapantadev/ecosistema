-- Fix de seguridad: RLS por si sola no restringe columnas, solo filas. La
-- politica seg_usuario_propio_update permitia actualizar CUALQUIER columna
-- de la propia fila, incluyendo usu_superadmin_plataforma -- un usuario
-- podia auto-otorgarse SuperAdmin de plataforma con un PATCH directo a la
-- API, sin pasar por la UI. Se cierra con privilegios a nivel de columna:
-- el rol authenticated solo puede escribir las columnas de perfil, nunca
-- usu_id, usu_correo ni usu_superadmin_plataforma.
revoke update on comun_seguridad.seg_usuario from authenticated;

grant update (
  usu_nombres,
  usu_apellidos,
  usu_whatsapp,
  usu_cedula,
  usu_provincia_id,
  usu_ciudad_id,
  usu_autorizacion_whatsapp,
  usu_onboarding_completo,
  usu_detalle_usuario,
  usu_actualizado_en
) on comun_seguridad.seg_usuario to authenticated;
