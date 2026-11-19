# Cierre de tarea: Pantalla Smart TV Taller & Showroom de Eventos (Tinkay y Margaritas)

**Fecha:** 2026-11-19  
**Negocios beneficiados:** Tinkay Floristería (`tinkay-web`), Margaritas Floristería (`margaritas-web`)  
**Paquete compartido:** `packages/comercio` (`@eco/comercio`)

## Resumen de cambios implementados

1. **Migración SQL (`supabase/migrations/20261119000001_pantalla_tv_taller_prioridad_colores_y_eventos.sql`):**
   - Columnas nuevas en `comun_comercio.com_orden_taller`: `ota_prioridad_orden`, `ota_colores`, `ota_extras`.
   - Realtime habilitado en `comun_configuracion.cfg_negocio` para control remoto en vivo de la Smart TV.
   - RPCs `SECURITY DEFINER`: `com_fn_reordenar_prioridad_taller`, `com_fn_obtener_config_tv_taller`, `com_fn_guardar_config_tv_taller`, `com_fn_obtener_tablero_tv_taller`, `com_fn_actualizar_estado_tv_kiosco`.
   - Actualización de `com_fn_sincronizar_ventas_a_ordenes_taller`, `com_fn_obtener_consola_taller_y_despacho` (`to_jsonb(sub)`) y `com_fn_crear_o_actualizar_pedido_operador`.

2. **Núcleo compartido (`packages/comercio`):**
   - `operaciones-taller.ts`: modelos y helpers puros (`ConfiguracionTvTaller`, `parsearColoresPedido`, `extraerYoutubeVideoOPlaylist`, `ordenarPedidosPorPrioridadTaller`, `PALETA_COLORES_PEDIDO_TALLER`).
   - `acciones-operaciones-taller.ts`: Server Actions de priorización, configuración remota TV, tablero TV (sesión o kiosco), avance de estado TV y extractor HD con caché de álbumes públicos de Google Fotos (`extraerImagenesAlbumGoogleFotosAction`).
   - `ControlRemotoTvTaller.tsx`: modal de priorización `#1, #2, #3...` (`⚡ #1`, `▲`, `▼`), control remoto de YouTube/Layout/Kiosco y gestor de álbumes de Google Fotos con prueba en vivo y compartir por WhatsApp.
   - `PantallaTvTaller.tsx`: pantalla completa Smart TV (0% Tailwind, 100% estilos en línea) con YouTube IFrame API + auto-salto + audio ducking, layout elástico (Normal / Pico / Fecha Especial Solo Audio), navegación con control remoto TV (D-Pad + OK), franja inferior de listos/entregados auto-ocultable, y Modo Showroom Eventos (catálogo de eventos + álbumes de Google Fotos + QR dinámico).
   - Integración en `ConsolaTallerFloral.tsx`, `ConsolaEnvioPedidosTaller.tsx` y captura de `colores` en checkout web (`DrawerCarritoFloristeria.tsx`, `ModalCheckoutTinkay.tsx`, `acciones-logistica.ts`).

3. **Rutas en ambas apps:**
   - `apps/tinkay-web/app/panel/taller/tv/page.tsx` y `apps/tinkay-web/app/tv-taller/page.tsx`
   - `apps/margaritas-web/app/panel/taller/tv/page.tsx` y `apps/margaritas-web/app/tv-taller/page.tsx`

4. **Gobernanza actualizada:**
   - `gobernanza/productos/tinkay/especificacion-funcional.md` (`TNK-005`)
   - `gobernanza/productos/margaritas/especificacion-funcional.md` (`MRG-003`)
