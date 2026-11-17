# Cierre de Tarea — Consola Omnicanal: Etiquetas, Barra Multi-Canal, Responsive y Campos de Venta

**Fecha:** 2026-11-17
**Requerimiento:** `TNK-004` / `PLT-010`

## Resumen de Cambios

1. **Administración de Etiquetas (`ModalAdministrarEtiquetas.tsx` + SQL `20261117000001`):**
   - Creación, edición (nombre, ícono/emoji, color) y eliminación de etiquetas maestras restringida a `SUPERADMIN`, `ADMINISTRADOR` y `OPERADOR` (`seg_fn_es_admin_u_operador_etiquetas`).
   - Desactivación de etiquetas redundantes de canal (`origen-whatsapp`, `origen-web`).
2. **Barra Superior Multi-Canal y Filtros + Ícono de Canal por Conversación (`IconoCanalOmnicanal.tsx`, `ConsolaVentasOmnicanal.tsx`):**
   - Eliminada la columna izquierda fija de 200px; filtros y selector de canales (`WhatsApp`, `Web`, `Facebook`, `Instagram`, `Telegram`, `TikTok`) reubicados en la barra superior.
   - Cada fila de chat muestra el avatar con insignia vectorial del canal (`AvatarConCanalOmnicanal`) sin texto redundante de canal.
3. **Acciones Rescatadas de ManyChat en Cabecera:**
   - `Pausar IA` / `Activar IA`, asignación directa de asesor en cabecera, `Compartir` hacia el Chat Grupal del Equipo (`@menciones`), `No leído` (`p_marcar_no_leido`) y `+ Etiqueta`.
4. **Corrección Responsive Móvil (`375px`):**
   - Eliminado el solapamiento en `.panel-barra-movil` (`MarcoPanelLateral.tsx` + `apps/tinkay-web/app/globals.css`).
   - Compositor móvil compacto con modo solo ícono en botones de acción.
5. **Depuración e Implementación de Campos de Venta (`PanelCamposVentaChat.tsx`):**
   - De 36 campos de ManyChat se descartaron 19 variables auxiliares de flujo y se estructuraron 15 campos de negocio en `🛒 Pedido`, `📍 Entrega` y `✍🏼 Tarjeta` (`cnv_detalle_conversacion.datos_venta`), con autocompletado GPS desde el webhook y despacho en 1 clic **`A Taller`**.
6. **Barra de Íconos Flotantes Estilo ManyChat + Motivos de Cierre + Retorno desde Chat Grupal (`20261117000002`):**
   - Popover **`Gestionar etiquetas`** con casillas de verificación instantánea.
   - Popover **`Recuérdamelo en`** (`20 minutos`, `1 hora`, `3 horas`, `6 horas`, `12 horas`, `Mañana 09:00` o fecha/hora exacta, con resaltado en vivo `🔔 Seguimiento pendiente`).
   - Popover **`Marcar como Cerrado`** con selección obligatoria de motivo (`Venta completada`, `Cotización / Proforma enviada`, `Consulta informativa resuelta`, `No responde`, `No desea continuar`, `Sin stock o fuera de cobertura`, `Spam / Número equivocado`), botón **`Enviar y cerrar`** y reapertura en 1 clic a **`Conversación Abierta`**.
   - Botón y enlace directo **`↗ Ir al chat`** en cada burbuja reenviada dentro del **Chat Grupal del Equipo**, que retorna directamente a la conversación del cliente y resalta el mensaje compartido (`📌 Mensaje compartido`).
