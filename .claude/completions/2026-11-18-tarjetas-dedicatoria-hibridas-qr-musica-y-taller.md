# Cierre de Tarea — Calibración Física 16,8×11,3 cm (Vertical vs Horizontal), Modo Confidencial Solo QR y Enlaces Separados de Edición vs Visualización

**Fecha:** 2026-11-18  
**Requerimientos:** `PLT-009` / `TNK-005`  

## Resumen de Cambios
1. **Medidas Físicas Reales (`16,8 × 11,3 cm`) y Orientación Diferenciada (`ModalImprimirTarjetaTaller.tsx`):**
   - **Dedicatoria (`DIPTICO`)**: Orientación **Vertical `113 × 168 mm` (`11,3 × 16,8 cm`)**, cara interior completa con pliegue horizontal central a `8,4 cm` (`84 mm`).
   - **Condolencias (`CONDOLENCIAS_PLANA`)**: Orientación **Horizontal `168 × 113 mm` (`16,8 × 11,3 cm`)**, respetando las esquinas diagonales preimpresas (superior-izquierda e inferior-derecha) y ubicando el QR opcional abajo a la izquierda.
   - Tanto el `@page` CSS para la **Canon PIXMA G3110** como el archivo generado por **`Descargar PDF` (`pdf-lib`)** adoptan automáticamente la orientación y dimensiones reales.
2. **Música Exclusiva para Dedicatoria:**
   - Los campos y la reproducción de canción (YouTube / MP3) y *lyric* inferior solo se muestran y ejecutan en pedidos de **Dedicatoria**, deshabilitándose en **Condolencias**.
3. **Modo Confidencialidad / Discreción (`confidencial_solo_qr`):**
   - Opción **`Confidencialidad / Discreción (imprimir solo el QR)`**: oculta el texto escrito en la cartulina física (impresión y PDF) e imprime únicamente el código QR hacia la vista digital.
4. **Dos Enlaces Independientes (Solo Lectura en QR vs Edición Firmada):**
   - **QR Impreso y Vista Pública (`/dedicatoria/[tokenVista]` — `TarjetaDedicatoriaDigitalInteractiva.tsx`)**: Contiene únicamente la URL de visualización digital limpia (muestra la tarjeta con el mensaje, reproduce la canción suave al 25% si aplica y desliza el *lyric* en la parte inferior, sin controles de edición).
   - **Enlace Exclusivo de Edición (`/tarjeta-editar/[tokenEdicion]` — `EditorTarjetaPublicoCliente.tsx`)**: Protegido con firma HMAC-SHA256 de servidor (`token-orden-firmada.ts`) para que Operador, Ventas, Taller o el Cliente editen el mensaje creado automáticamente, el modo confidencial y la canción.
