# Cierre de Tarea — Simulador de Chat ARIA con Reinicio + Auto-respuesta Corta a Comentarios Meta (`PLT-010` Fase 3B)

**Fecha:** 2026-11-26  
**Alcance:** `packages/comercio`, `packages/configuracion-negocio`, `supabase/migrations`, `gobernanza/productos/plataforma`

## 1. Qué se implementó

1. **Base de datos (`supabase/migrations/20261126000008_omnicanal_simulador_aria_y_comentarios_meta.sql`) — aplicada en `ecosistema` (`oaybbpdxhlxjbpwnoymy`):**
   - Tabla `comun_agentes.agc_comentario_meta` (`cmm_`, RLS habilitado, índice único idempotente por `(cmm_negocio, cmm_comentario_externo_id)`, trigger `aud_fn_auditar_tabla()`).
   - RPC `comun_comercio.com_fn_omnicanal_simular_chat_aria`: sandbox aislado por `p_sesion_id` que invoca ARIA con Vault sin escribir chats reales ni enviar mensajes externos.
   - RPCs `comun_configuracion.cfg_fn_guardar_meta_comentarios`, `comun_comercio.com_fn_interno_despachar_respuesta_comentario_meta`, `comun_comercio.com_fn_interno_procesar_comentarios_meta` y `comun_comercio.com_fn_omnicanal_listar_comentarios_meta`.
   - `com_fn_omnicanal_procesar_webhook_meta` ahora procesa simultáneamente mensajes directos (`entry[].messaging[]`) y comentarios en Posts/Reels (`entry[].changes[]` → `feed` en Facebook y `comments` en Instagram), con protección anti-bucle (ignora comentarios propios de la página/IG), filtro de subcomentarios, palabras clave, tono sobrio en Condolencias y DM privado opcional.
2. **Simulador de Chat ARIA Multi-Turno (`@eco/comercio` + `@eco/configuracion-negocio`):**
   - Nuevo componente `SimuladorChatAriaPanel.tsx` (100% estilos inline React, cero Tailwind) integrado en:
     - `/panel/conversaciones` (nueva pestaña **`Simulador IA`** en `ConsolaVentasOmnicanal.tsx`).
     - `/panel/aria` (embebido directamente debajo de la configuración de ARIA en `FormularioAria.tsx`).
   - Soporta selección de canal (`WhatsApp`, `Facebook`, `Instagram`, `Chat Web`), origen de anuncio (`Orgánico`, `Entrega Inmediata`, `Condolencias`, `Eventos`), inyección real de Entrega Inmediata y cotización GPS, pruebas rápidas en 1 clic y botón **`Reiniciar Chat`** que genera nueva sesión de memoria al instante.
3. **Auto-respuesta Corta a Comentarios en Posts/Reels (`FormularioAria.tsx` + `omnicanal.ts`):**
   - Nueva tarjeta **`Comentarios en Posts y Reels (Auto-respuesta Corta + Redirección Web)`** en `/panel/aria#meta-comentarios` con reglas editables, respuestas temáticas (Condolencias/Eventos), DM privado opcional, simulador instantáneo sin publicar y visor de bitácora reciente.
4. **Gobernanza y Documentación Visual:**
   - Nuevo documento maestro con 4 diagramas Mermaid en `gobernanza/productos/plataforma/mapa-omnicanal-meta-y-hoja-de-ruta.md` y avance de `PLT-010` actualizado a **95%** en `gobernanza/productos/plataforma/especificacion-funcional.md`.
