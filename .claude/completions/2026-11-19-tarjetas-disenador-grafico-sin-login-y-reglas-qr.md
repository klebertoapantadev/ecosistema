# Cierre: Diseñador Gráfico de Tarjetas, Acceso Público sin Login y Reglas QR/Condolencias

**Fecha:** 2026-11-19  
**Requerimientos:** `TNK-005` / `PLT-009`

## Resumen de Cambios
1. **Acceso Público sin Login (`anon`):**
   - Migración [`20261118000009_tarjetas_disenador_grafico_sin_login_publico.sql`](../../supabase/migrations/20261118000009_tarjetas_disenador_grafico_sin_login_publico.sql) con RPCs `SECURITY DEFINER` (`com_fn_obtener_tarjeta_publica`, `com_fn_editar_tarjeta_publica`) y política acotada de subida de imágenes/audios en `comun-publico`.
   - Respaldo inmediato en Server Actions (`acciones-operaciones-taller.ts`) mediante `com_fn_obtener_proforma_por_token` (ya desplegada en producción con permiso `anon`) para que `/dedicatoria/[token]` y `/tarjeta-editar/[token]` funcionen en incógnito sin iniciar sesión.
2. **Modo de Impresión Mutuamente Excluyente (Mensaje O Solo QR, nunca ambos):**
   - En **Dedicatoria** (`11,3 × 16,8 cm` vertical), selector exclusivo entre `Imprimir Mensaje` (sin QR) e `Imprimir Solo QR` (confidencial, abre vista digital con canción y lyric).
   - Eliminada la opción de incluir QR junto al mensaje impreso.
3. **Condolencias sin QR, sin Música y sin Lyric:**
   - En **Condolencias** (`16,8 × 11,3 cm` horizontal) se ocultan y deshabilitan el modo QR, música, lyrics y enlace de vista digital; conserva el diseñador visual con imagen/logo opcional y el enlace de edición sin login.
4. **Diseñador Gráfico WYSIWYG Multi-Elemento (`LienzoDisenadorTarjeta.tsx`):**
   - Hasta **3 imágenes independientes** por tarjeta, arrastrables y ampliables hasta el **100% del espacio de la tarjeta** (`Fondo 100%` + control de opacidad + filtro `B/N`).
   - **Múltiples cuadros de texto**: mensaje principal + **cuadro de firma (`De parte de`)** + hasta 2 cuadros de texto adicionales (`+ Texto`), todos arrastrables e independientes.
   - **6 tipografías curadas** (`Cursiva`, `Caligrafía`, `Manuscrita`, `Editorial`, `Clásica`, `Moderna`), alineación (`left`, `center`, `right`, `justify`), tamaño (`9–38pt`), negrita/itálica y ancho de caja.
   - Botón **`Compartir`** que exporta el diseño final en PNG de alta resolución (`10 px/mm`) listo para WhatsApp / Web Share API.
   - **Alerta de edición del cliente:** Notificación In-App + Push a todo el equipo al guardar cambios desde `/tarjeta-editar/[token]`, banner de alerta destacado en `ModalImprimirTarjetaTaller` e insignia `Tarjeta · Cliente` en `/panel/pedidos`.

## Verificación
- `pnpm --filter @eco/comercio --filter tinkay-web --filter margaritas-web typecheck`: Exit code `0`.
- Verificación de cero clases utilitarias de Tailwind CSS en los componentes modificados.
