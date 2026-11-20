# Cierre: Apertura 3D pausada del díptico y Wizard guiado en `/tarjeta-editar/[token]`

**Fecha:** 2026-11-20  
**Módulo:** `TNK-005` — Tarjetas Dedicatoria Híbridas (`@eco/comercio`, `tinkay-web`, `margaritas-web`)

## Cambios realizados

1. **Transición 3D más pausada y ceremonial (`packages/comercio/src/componentes/TarjetaDedicatoriaDigitalInteractiva.tsx`):**
   - Apertura/cierre de la solapa y desplazamiento vertical suavizados a `1.8s` / `1.75s cubic-bezier(0.25, 0.9, 0.3, 1)` con sombra de pliegue de `1.45s` y aparición de controles post-apertura en `0.9s ease 0.65s`.
   - Soporte de `modoEmbebido` y `accionesInferiores` con colapso suave de controles cuando la tarjeta está doblada y `useId()` único para el reproductor de YouTube.

2. **Enlace de edición del cliente con la misma vista 3D + Wizard UX de 8 pasos (`packages/comercio/src/componentes/EditorTarjetaPublicoCliente.tsx`):**
   - **Vista inicial (`modo === "vista"`):** Presenta el mismo díptico 3D interactivo real (`/dedicatoria/[token]`) mostrando cómo luce la tarjeta en ese momento, con botón **`Editar tarjeta`** (o aviso de bloqueo si ya ingresó a impresión en taller).
   - **Asistente guiado (8 pasos en Dedicatoria / 5 pasos en Condolencias):**
     1. **Para quién** (con mini portada kraft en vivo)
     2. **Mensaje** (con contador de caracteres y frases rápidas de inspiración)
     3. **Firma** (pregunta explícita Sí / Sin firma + campo opcional *Remitente en portada digital*)
     4. **Diseñador gráfico** (`LienzoDisenadorTarjeta`: hasta 3 imágenes, 100% fondo, rotación, transparencia, 6 tipografías y textos extra)
     5. **Audio** (opcional, YouTube o MP3 hasta 15 MB)
     6. **Letra** (opcional, búsqueda automática + edición manual sincronizada)
     7. **Visualizar** (díptico 3D interactivo en vivo con reproducción al 15% y lyric sobrio)
     8. **Impresión** (elección visual mutuamente excluyente **Mensaje completo** vs **Solo QR Digital** + resumen y **Guardar tarjeta**)
   - Cero clases utilitarias de Tailwind CSS (`AGENTS.md` regla 17), microcopia concisa de 2–3 palabras y tipografía móvil `16px`.

3. **Metadatos y disparo de deploy en Vercel:**
   - Actualizados `apps/tinkay-web/app/tarjeta-editar/[token]/page.tsx` y `apps/margaritas-web/app/tarjeta-editar/[token]/page.tsx`.
   - Actualizado `gobernanza/productos/tinkay/especificacion-funcional.md` (`TNK-005`).
