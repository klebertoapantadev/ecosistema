# Cierre de Tarea — Módulo de Tarjetas Dedicatoria Híbridas (Física en Canon G3110 + Digital con QR, Música de YouTube y Lyrics)

**Fecha:** 2026-11-18  
**Requerimientos:** `PLT-009` / `TNK-005`  

## Resumen de la Solución
Se eliminó la dependencia manual de Google Slides y se modernizó el flujo de tarjetas de dedicatoria transformándolas en un producto híbrido físico-digital con trazabilidad completa.

1. **Migración SQL Transaccional (`20261118000004_tarjetas_dedicatoria_hibridas_qr_musica_y_taller.sql`):**
   - Columnas agregadas a `comun_comercio.com_orden_taller`:
     - `ota_tarjeta_token`: token seguro de 18 caracteres para acceso público a la experiencia digital y QR.
     - `ota_tarjeta_tipo`: `DIPTICO` (plegable normal) | `CONDOLENCIAS_PLANA` (esquina floral) | `SOLO_DIGITAL`.
     - `ota_tarjeta_musica_url`: URL de YouTube o audio MP3.
     - `ota_tarjeta_musica_titulo`: título de la canción.
     - `ota_tarjeta_lyrics`: array de líneas sincronizadas con timestamp o texto.
     - `ota_tarjeta_metadata`: JSONB de auditoría (`origen`, `historial_cambios`, `vistas_cliente`, `impresiones`, `ultimo_impreso_por`, `editado_por_cliente`).
   - Funciones RPC:
     - `com_fn_obtener_tarjeta_publica(token)`: acceso público para destinatarios sin sesión; incrementa discretamente contador de vistas.
     - `com_fn_editar_tarjeta_cliente(token, ...)`: autoservicio para el comprador; se bloquea si el taller ya inició preparación.
     - `com_fn_registrar_impresion_tarjeta(orden_id, tipo)`: auditoría de impresiones en taller.

2. **Componente de Impresión para Taller (`ModalImprimirTarjetaTaller.tsx`):**
   - Botón directo `[ 🖨️ Tarjeta ]` en `ConsolaTallerFloral` (`/panel/taller`) y `ConsolaEnvioPedidosTaller` (`/panel/envio-pedidos`).
   - Soporte para **Díptico Tinkay** (imprime en la mitad interna para no tocar la portada exterior preimpresa) y **Condolencias Plana** (respeta el margen superior derecho preimpreso).
   - Generación instantánea de **Código QR** embebido hacia la tarjeta digital con melodía.
   - Calibración milimétrica para la bandeja trasera de la **Canon PIXMA G3110** (CSS `@page { size: 148mm 105mm; margin: 0; }` y offsets X/Y).
   - Auto-escalado de fuente tipográfica (Cursiva fina, Serif o Formal).
   - Badges de trazabilidad (editada por cliente, generada automática, contador de impresiones).

3. **Experiencia Digital Multimedia (`TarjetaDedicatoriaDigitalInteractiva.tsx` y `/dedicatoria/[token]`):**
   - Despliegue en `tinkay-web` y `margaritas-web`.
   - Portada exterior interactiva con botón `[ 💌 Abrir Dedicatoria ]`.
   - Al abrir, reproduce automáticamente la música de YouTube de fondo en **volumen sutil (25%)**.
   - **Visor de Letras (Lyrics) sincronizado**: resalta frase a frase y realiza scroll suave vertical automático.
   - Botón social directo: **`Dar las gracias por WhatsApp`** en 1 toque.
   - Autoservicio de edición para el cliente comprador mientras el pedido no esté en preparación en taller.
