# Cierre: Modalidad Básica (Impresa interior) por defecto y Avanzada (Digital + Audio) en Taller y Link del Cliente

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Taller / Staff (`ModalImprimirTarjetaTaller.tsx`):**
   - Por defecto toda tarjeta de Dedicatoria sin audio/QR abre en **`Básica (Impresa)`** directo al diseñador del interior del díptico (solo `De parte de / Firma interior`, `Mensaje` y lienzo interior WYSIWYG), ocultando portada exterior (`Para` / `Remitente portada`), audio/MP3/letra, selector de QR y link QR.
   - Conmutador **`Básica (Impresa)`** vs **`Avanzada (Digital)`** en 1 clic: al activar **`Avanzada (Digital)`** se despliega todo el flujo digital existente (portada exterior, audio YouTube/MP3, letra, modos `Solo Mensaje / Solo QR / Mensaje + QR` y enlace QR). Si un pedido ya trae audio/QR/portada, abre automáticamente en `Avanzada`.

2. **Link del Cliente (`/tarjeta-editar/[token]` — `EditorTarjetaPublicoCliente.tsx`):**
   - Por defecto abre en **`Impresa básica`**: muestra directamente el **interior de la tarjeta impresa** con accesos **`Editar tarjeta`** (3 pasos rápidos: `1. Mensaje` con IA/emojis → `2. Firma` interior → `3. Diseño` y guardar), **`Ir al diseñador`** (salto directo al lienzo) y la tarjeta **`Incluir tarjeta digital con audio`**.
   - Conmutador superior **`Impresa básica`** | **`Digital + Audio`** dentro del editor para alternar sin perder cambios. Al activar **`Digital + Audio`**, habilita el díptico 3D con giro de entrada y el wizard completo de 8 pasos (portada exterior, mensaje IA, firma y portada, diseño, audio, letra, vista 3D e impresión con 3 opciones y visualizador).
   - Condolencias conserva su experiencia sobria exclusiva de solo mensaje.
