# Common Mistakes

**⚠️ CRITICAL - Read at session start**

---

## Top 5 Critical Mistakes

### 1. Usar clases de Tailwind CSS (`rounded-*`, `bg-slate-*`, `flex`, `p-*`) en `apps/*` o `packages/*`

**Symptom**: El componente o widget se renderiza como HTML crudo sin estilos (texto pegado, bordes nativos del navegador, botones grises o sin espaciado).
**Check**: `git grep -n "rounded-2xl\|border-slate\|bg-violet\|bg-slate"` en `apps/` o `packages/`. Las aplicaciones del ecosistema (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`) **NO tienen Tailwind CSS instalado ni configurado**.
**Fix**: Usar **siempre** estilos explícitos en línea de React (`style={{ ... }}`) combinados únicamente con las clases CSS globales nativas definidas en `app/globals.css` (como `.btn-responsive-accion` y `.btn-texto-responsive`). Queda estrictamente prohibido escribir utilidades de Tailwind CSS en cualquier componente de `apps/*` o `packages/*`.

### 2. [Add Second Mistake]

### 3. [Add Third Mistake]

### 4. [Add Fourth Mistake]

### 5. [Add Fifth Mistake]

---

**Last Updated**: 2026-07-28
