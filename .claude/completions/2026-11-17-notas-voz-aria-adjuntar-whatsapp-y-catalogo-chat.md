# Cierre de Tarea — Notas de Voz con ARIA (Nota Interna) + Menú Adjuntar Estilo WhatsApp + Catálogo en Chat

**Fecha:** 2026-11-17  
**Responsable:** Kleber Toapanta  
**Requerimientos:** `TNK-004`, `TNK-006`, `PLT-010`

## Resumen de lo implementado

1. **Escucha, Reproducción, Transcripción en `Nota Interna` y Respuesta Automática con ARIA (`Mía`):**
   - Migración [`supabase/migrations/20261117000005_omnicanal_audio_transcripcion_adjuntos_y_catalogo.sql`](../../supabase/migrations/20261117000005_omnicanal_audio_transcripcion_adjuntos_y_catalogo.sql):
     - Columna `ari_stt_secreto_id uuid` en `comun_configuracion.cfg_aria` y actualización de `cfg_fn_guardar_whatsapp_ycloud` para almacenar cifrada en Supabase Vault la clave IA de transcripción de voz (`Gemini` `AIza...` u `OpenRouter` `sk-or-...`), además de soporte en servidor para `GEMINI_API_KEY` / `GROQ_API_KEY` / `OPENAI_API_KEY`.
     - Captura de `audio.link`, `voice.link`, `mime_type`, `document.link` y `document.filename` en `com_fn_omnicanal_procesar_webhook_ycloud` y espejado permanente en `comun-publico/omnicanal-media/`.
     - RPC `com_fn_omnicanal_transcribir_y_guardar_nota_voz` que transcribe la nota de voz sin exponer secretos fuera de Vault, inserta un mensaje `NOTA_INTERNA` (`🎙️ Transcripción de nota de voz: «…»`) y alimenta el prompt de ARIA para responder directamente al cliente.
     - RPC `com_fn_omnicanal_responder_con_aria_panel` + acción `transcribirYResponderNotaVozOmnicanalAction` + reproductor `<audio controls>` (`1x`/`1.5x`/`2x`) con botones `Transcribir` y `Responder IA` en cada burbuja de audio.
   - Proxy [`apps/tinkay-web/app/api/omnicanal/media/route.ts`](../../apps/tinkay-web/app/api/omnicanal/media/route.ts) ampliado con soporte `Range` / `206 Partial Content` para streaming HTML5 de audio y descarga de documentos PDF/Office.
   - Campo en `/panel/aria` (`FormularioAria.tsx`) para configurar en Vault la clave IA de transcripción de notas de voz.

2. **Menú Unificado `Opciones` (`＋`) + Envío de Producto del Catálogo + Pull-to-Refresh Móvil:**
   - Eliminados de la barra superior los botones `En vivo` e `Importar ARIA`, dejando `Actualizar` únicamente en vista Web y habilitando actualización deslizando hacia abajo (*Pull-to-Refresh*) en móvil tanto en la lista de conversaciones como en el hilo de mensajes.
   - Eliminada la subbarra redundante `Cliente / Nota / /Atajos` sobre la caja de texto.
   - Botón unificado **`＋ Opciones`** (Bottom Sheet en móvil, popover flotante en escritorio) con:
     1. **`Nota`** (alterna Modo Nota Interna)
     2. **`Documento`** (sube PDF/Word/Excel/CSV/TXT y despacha `type: "document"` nativo en YCloud WhatsApp)
     3. **`Imagen`** (selector de galería, despacha `type: "image"` nativo en YCloud WhatsApp)
     4. **`Foto`** (captura directa de cámara `capture="environment"`)
     5. **`Respuesta '/'`** (abre menú de respuestas rápidas `/atajos`)
     6. **`Catálogo`** (abre `ModalSelectorCatalogoChat.tsx` para enviar **foto principal del producto**, **link para revisar en la web** `/producto/{slug}` y **link del álbum del producto**)
     7. **`Asignar`** (selector directo de responsable del equipo integrado dentro del menú)
     8. **`Compartir`** (reenvío directo de la conversación al Chat Grupal del Equipo)
     9. **`Eliminar`** (eliminación completa de la conversación exclusiva para Administrador).

## Verificación
- `pnpm --filter @eco/comercio test`: 85/85 tests en verde.
- `tsc --noEmit` en `@eco/comercio` y `@eco/configuracion-negocio`: 0 errores.
- `pnpm --filter tinkay-web build`: compilación de producción verificada.
