# Common Mistakes

**⚠️ CRITICAL - Read at session start**

---

## Top 5 Critical Mistakes

### 1. Usar clases de Tailwind CSS (`rounded-*`, `bg-slate-*`, `flex`, `p-*`) en `apps/*` o `packages/*`

**Symptom**: El componente o widget se renderiza como HTML crudo sin estilos (texto pegado, bordes nativos del navegador, botones grises o sin espaciado).
**Check**: `git grep -n "rounded-2xl\|border-slate\|bg-violet\|bg-slate"` en `apps/` o `packages/`. Las aplicaciones del ecosistema (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`) **NO tienen Tailwind CSS instalado ni configurado**.
**Fix**: Usar **siempre** estilos explícitos en línea de React (`style={{ ... }}`) combinados únicamente con las clases CSS globales nativas definidas en `app/globals.css` (como `.btn-responsive-accion` y `.btn-texto-responsive`). Queda estrictamente prohibido escribir utilidades de Tailwind CSS en cualquier componente de `apps/*` o `packages/*`.

### 2. Llamar a `.schema("comun_agenda")` directamente desde PostgREST sin respaldo en un esquema expuesto (`comun_configuracion` / `comun_seguridad`)

**Symptom**: Al guardar horarios o disponibilidad en producción, aparece el error `Invalid schema: comun_agenda` (o `comun_agenda` si una expresión regular recorta el texto antes de `:`).
**Check**: Verificar en `acciones.ts` y `consultas.ts` si se llama a `supabase.schema("comun_agenda")` directamente sin persistir en `comun_configuracion.cfg_negocio` (`cfg_detalle_configuracion.agenda_horarios`) o `comun_seguridad.seg_usuario` (`usu_detalle_usuario.ficha_abogado`).
**Fix**: En el proyecto Supabase remoto (`ecosistema`), `comun_agenda` es un esquema interno de motor SQL y no está en la lista `db_schemas` expuesta por PostgREST. Toda lectura/escritura desde Server Actions debe usar `comun_configuracion.cfg_negocio` (`cfg_detalle_configuracion.agenda_horarios`) para horarios del negocio y `comun_seguridad.seg_usuario` (`usu_detalle_usuario.ficha_abogado`) para horarios individuales del abogado, dejando `comun_agenda` como sincronización secundaria dentro de un `try/catch`.

### 3. [Add Third Mistake]

### 4. [Add Fourth Mistake]

### 5. [Add Fifth Mistake]

---

**Last Updated**: 2026-07-28
