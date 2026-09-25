-- Migración: 20260925000002_fix_disparar_notificacion_cambio_rol.sql
-- Descripción: Corrige el trigger trg_not_cambio_rol y la función not_fn_disparar_notificacion_cambio_rol()
-- que fallaba con el error 'record "new" has no field "mem_perfil"' al asignar perfiles a usuarios.

CREATE OR REPLACE FUNCTION comun_notificacion.not_fn_disparar_notificacion_cambio_rol()
RETURNS TRIGGER AS $$
DECLARE
  v_titulo TEXT;
  v_cuerpo TEXT;
  v_rol TEXT;
  v_negocio TEXT;
BEGIN
  IF TG_OP = 'INSERT' THEN
    v_rol := coalesce(NEW.mem_rol, 'Miembro');
    v_negocio := coalesce(NEW.mem_negocio, 'la plataforma');
    v_titulo := 'Nuevo perfil asignado en ' || v_negocio;
    v_cuerpo := '<p>Hola. Se te ha asignado el perfil <strong>' || v_rol || '</strong> en el negocio <strong>' || v_negocio || '</strong>.</p>';
    
    BEGIN
      INSERT INTO comun_notificacion.not_registro (
        not_usuario_id, not_negocio, not_canal, not_titulo, not_contenido_html
      ) VALUES (
        NEW.mem_usuario_id, coalesce(NEW.mem_negocio, 'TRANQ'), 'IN_APP', v_titulo, v_cuerpo
      );
    EXCEPTION WHEN OTHERS THEN
      -- No bloquear la asignación de roles si la tabla de notificaciones no está accesible
      NULL;
    END;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recrear el trigger asegurando la firma correcta
DROP TRIGGER IF EXISTS trg_not_cambio_rol ON comun_seguridad.seg_membresia;

CREATE TRIGGER trg_not_cambio_rol
  AFTER INSERT ON comun_seguridad.seg_membresia
  FOR EACH ROW
  EXECUTE FUNCTION comun_notificacion.not_fn_disparar_notificacion_cambio_rol();
