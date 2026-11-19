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
4. **Diseñador Gráfico WYSIWYG + Imagen Opcional (`LienzoDisenadorTarjeta.tsx`):**
   - Arrastrar y posicionar bloque de texto e imagen/logo directamente sobre la cartulina.
   - Herramientas de alineación (`left`, `center`, `right`, `justify`), fuente (`Cursiva`, `Serif`, `Formal`), tamaño (`10–34pt`), negrita/itálica, ancho de caja, subida de imagen/logo (`subirImagenTarjetaAction`), tamaño en `mm` y filtro blanco/negro (`B/N`).
   - Replicado fielmente en vista previa, `@media print` (Canon PIXMA G3110), `Descargar PDF` (`pdf-lib`, incluyendo texto justificado e imagen PNG/JPG incrustada), `/tarjeta-editar/[tokenEdicion]` y `/dedicatoria/[tokenVista]`.

## Verificación
- `pnpm --filter @eco/comercio --filter tinkay-web --filter margaritas-web typecheck`: Exit code `0`.
- Verificación de cero clases utilitarias de Tailwind CSS en los componentes modificados.
