# Optimización Móvil Integral y Eliminación de Conversaciones (Solo Administrador)

**Fecha:** 2026-11-17
**Módulo:** `@eco/comercio` (`ConsolaVentasOmnicanal`, `ChatEquipoInterno`, `PanelCamposVentaChat`, `omnicanal.ts`) + `tinkay-web` (`globals.css`) + Migración `20261117000004`

## Cambios Implementados

1. **Optimización Móvil de la Bandeja Omnicanal (`ConsolaVentasOmnicanal.tsx` & `globals.css`)**:
   - **Bottom Sheet fijo en móvil (`zIndex: 9975`)** para `Gestionar etiquetas`, `Recuérdamelo en…` y `Cerrar chat · Selecciona el motivo`, eliminando el recorte lateral que ocurría en pantallas angostas (`360px–412px`) y añadiendo cierre al tocar fuera tanto en móvil como en escritorio.
   - **Rejilla táctil ergonómica en cabecera móvil** (`height: 38px` por botón, `touch-action: manipulation`, cero desborde horizontal) + actualizaciones optimistas instantáneas (`<16ms`) en `Pausar/Activar IA`, `No leído`, `Etiquetas` y asignación de asesor.
   - **Barra superior de módulos deslizable en 1 sola fila** en móvil (`Chats`, `Equipo`, `Compras`, `Clientes`, `IA & Atajos`) y compositor con `font-size: 16px` (sin auto-zoom en iOS/Android), `env(safe-area-inset-bottom)` y opción móvil `Enviar y cerrar`.
2. **Eliminación de Fugas de URLs Firmadas JWT en Burbujas (`omnicanal.ts`)**:
   - Detección determinista de URLs multimedia firmadas (`?token=eyJ...`, YCloud, Supabase Sign, WhatsApp Business) y corchetes anidados/saltos cortos en `alt`, evitando que se imprima el token JWT crudo sobre la imagen, más etiquetas compactas (`🔗 dominio/…`) en enlaces largos.
3. **Eliminación Completa de Conversaciones Exclusiva para Administrador (`20261117000004_omnicanal_eliminar_conversacion_admin.sql` + `eliminarConversacionOmnicanalAction`)**:
   - Restringido estrictamente a `SUPERADMIN` y `ADMINISTRADOR` (`seg_fn_es_admin_negocio_omnicanal`).
   - Botón `🗑️` con modal de confirmación tanto en la cabecera del chat (escritorio y móvil) como en la fila activa de la lista de conversaciones, con sincronización Realtime instantánea entre pestañas/dispositivos.
