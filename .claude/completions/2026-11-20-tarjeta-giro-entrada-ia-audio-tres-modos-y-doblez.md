# Cierre: Giro 360° de entrada, Asistente IA en Paso 2, pregunta previa de Audio, 3 modos de impresión y ajuste inteligente del doblez

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Giro automático de entrada (sin botones 360°/voltear) (`TarjetaDedicatoriaDigitalInteractiva.tsx`):**
   - Eliminados los botones `Vista 360°`, `Ver reverso` y `Abrir tarjeta` de la barra pre-apertura.
   - Al abrir el enlace, la tarjeta ejecuta automáticamente un giro ceremonial de entrada (`-360° → 0°`, `3,1 s`), mostrando brevemente el reverso kraft antes de aterrizar en la portada y revelar la invitación `Toca para abrir tu tarjeta`.

2. **Asistente IA, corrección de ortografía y emojis contextuales en Paso 2 (`acciones-operaciones-taller.ts`, `EditorTarjetaPublicoCliente.tsx`):**
   - Eliminadas las frases fijas de sugerencia.
   - Nueva Server Action `asistirMensajeTarjetaIaAction` (Gemini → OpenAI → respaldo local determinístico) con:
     - **`Ayuda con IA`**: usa el mensaje base o consulta la ocasión para crear **2 opciones seleccionables** ya estructuradas con saltos de línea.
     - **`Corregir texto`**: corrige ortografía/tildes/puntuación y estructura el mensaje digitado en frases equilibradas con saltos de línea.
     - **Emojis sugeridos** según el contenido/ocasión del mensaje, insertables con 1 toque.

3. **Pregunta previa de Audio en Paso 5 (`EditorTarjetaPublicoCliente.tsx`):**
   - Pregunta primero **`Sí, incluir audio`** vs **`Sin audio`**; solo despliega los controles de YouTube/MP3 si el cliente elige sí (y omite automáticamente el paso de Letra si elige Sin audio).

4. **Tres modalidades de impresión en Paso 8 y Taller (`operaciones-taller.ts`, `EditorTarjetaPublicoCliente.tsx`, `LienzoDisenadorTarjeta.tsx`, `ModalImprimirTarjetaTaller.tsx`):**
   - **`Solo mensaje impreso`** (`SOLO_MENSAJE`), **`Solo QR (Digital)`** (`SOLO_QR`) y **`Mensaje impreso + QR digital`** (`MENSAJE_Y_QR`, con QR compacto `16×16 mm` en la esquina inferior derecha en lienzo, impresión `@media print`, PDF `pdf-lib` y PNG `Compartir`).

5. **Posicionamiento inferior para mensajes cortos y protección automática contra el doblez `8,4 cm` (`LienzoDisenadorTarjeta.tsx`, `TarjetaDedicatoriaDigitalInteractiva.tsx`, `ModalImprimirTarjetaTaller.tsx`, `EditorTarjetaPublicoCliente.tsx`):**
   - `esMensajeCortoParaMitadInferior`: mensajes cortos (`<= 200` caracteres y `<= 6` líneas) se ubican por defecto en la **mitad inferior** (`yPct = 68%`) y la firma en `yPct = 85%` (con aire sobre el sello sutil de Tinkay en `bottom: 1.4%–1.6%`), usando la mitad superior solo cuando es necesario.
   - `ajustarTextoParaDoblezDiptico`: cuando un texto largo cruza la franja del doblez central (`8,4 cm` / `50%`), inserta automáticamente saltos de línea de respiro justo en el pliegue para evitar distorsión al imprimir o doblar.
