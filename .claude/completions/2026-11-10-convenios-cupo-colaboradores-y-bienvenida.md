# Cierre de Tarea: Cupo de Colaboradores Habilitados por Convenio, Control de Personas Registradas y Correo de Bienvenida con Beneficios

**Fecha:** 2026-11-10  
**Requerimientos:** `TRQ-B2B-001` / `TRQ-B2B-002` / `PLT-013`  
**Estado:** ✅ Implementado (100%)

## Resumen de Cambios

1. **Base de Datos y RPCs (`supabase/migrations/20261110000001_convenios_cupo_colaboradores_control_y_bienvenida.sql`)**:
   - Se agregó la columna `cve_cupo_colaboradores integer not null default 50` en `comun_comercio.com_convenio_empresa` (sincronizada también en `cve_detalle_convenio.cupo_colaboradores_habilitados`).
   - Se actualizó `com_fn_guardar_convenio_empresa` para persistir el número de colaboradores habilitado para cada convenio.
   - Se actualizó `com_fn_verificar_y_autoafiliar_usuario_convenio` para validar estrictamente que las personas registradas (`bnf_estado IN ('VINCULADO', 'PENDIENTE')`) no excedan `cve_cupo_colaboradores`, bloquear nuevas afiliaciones si el cupo está lleno (`cupo_agotado: true`) y detectar si requiere despacho de correo de bienvenida.
   - Se creó `com_fn_marcar_bienvenida_convenio_enviada` para registrar trazabilidad del envío del correo de bienvenida en `com_beneficiario_empresa.bnf_detalle_beneficiario`.

2. **Envío Automático del Correo de Bienvenida con Beneficios al Registrarse (`packages/notificaciones/src/notificar-usuario.ts` & `packages/identidad/src/acciones.ts`)**:
   - Se implementó `procesarAutoafiliacionYBienvenidaConvenio` y `construirHtmlBienvenidaConvenio`.
   - Cuando un usuario se registra (por correo/contraseña o Google OAuth) o completa su bienvenida bajo el dominio de un convenio activo con cupo disponible:
     - Queda registrado y controlado en `com_beneficiario_empresa`.
     - Recibe automáticamente un **Correo de Bienvenida al Convenio Corporativo** indicando todos los beneficios que tiene con el convenio (consultas telemáticas $0.00 y frecuencia, porcentaje de descuento general, descuentos específicos por producto/trámite, bono de billetera y vigencia) junto con una notificación In-App.

3. **Acciones y Widget de Gestión de Convenios Corporativos (`packages/comercio/src/acciones-convenios.ts` & `packages/comercio/src/componentes/GestionConveniosCorporativos.tsx`)**:
   - En el modal **Crear / Editar Convenio**, se incorporó el campo **N° de Colaboradores Habilitados** con indicador en vivo de registrados vs. disponibles y correo de contacto RRHH.
   - En cada tarjeta de convenio, se muestra la barra de progreso de **Colaboradores: X / Y habilitados** y el botón **Colaboradores (X/Y)**.
   - Se implementó el modal **Control de Colaboradores del Convenio**, que permite visualizar las personas registradas bajo ese convenio, agregar/habilitar colaboradores manualmente validando el cupo, pausar/activar o retirar colaboradores (liberando cupo) y enviar/reenviar el correo de bienvenida con los beneficios del convenio.
