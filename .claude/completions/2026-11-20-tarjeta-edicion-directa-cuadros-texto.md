# Cierre: Edición directa de cuadros de texto en el diseñador de tarjetas (móvil y web)

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Edición directa en el gráfico y en control contextual (`LienzoDisenadorTarjeta.tsx`):**
   - Añadidas props opcionales `onCambiarMensaje` y `onCambiarFirma` (conectadas desde `ModalImprimirTarjetaTaller.tsx` y `EditorTarjetaPublicoCliente.tsx`).
   - Al seleccionar **cualquier** cuadro de texto (`Mensaje`, `Firma` o `Texto extra`), aparece de inmediato un control de edición directa (`16px` para móvil sin zoom) en la barra contextual del diseñador.
   - Además, se habilitó **edición inline directamente sobre el gráfico** al hacer doble clic (web) o pulsar la píldora **`Editar`** sobre el cuadro seleccionado (móvil y web), usando un `<textarea>` transparente con exactamente la misma tipografía, tamaño, alineación y color del cuadro.
   - Preservado `modoImpresion` dentro de `emitirCambio` para que editar o arrastrar bloques nunca pierda la modalidad `MENSAJE_Y_QR`.
