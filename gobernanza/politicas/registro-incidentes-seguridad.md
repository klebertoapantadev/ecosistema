---
tipo: politica
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Registro de Incidentes de Seguridad

Bitácora de vulnerabilidades críticas/altas detectadas en producción, según exige [`seguridad-dependencias.md`](seguridad-dependencias.md) §6. Un incidente nuevo se agrega arriba, sin borrar el historial.

## 2026-07-26 — Next.js 15.1.6 con vulnerabilidad conocida, bloqueado en deploy

- **Qué pasó:** al desplegar `tranqi-web` por primera vez, Vercel rechazó el build con `"Vulnerable version of Next.js detected"` sobre la versión fijada (15.1.6).
- **Cómo se detectó:** por el propio gate de Vercel en el momento del deploy — no había ningún mecanismo previo (CI, Dependabot) que lo hubiera detectado antes.
- **Remediación:** actualización a Next.js 15.5.22, dentro del mismo rango mayor, sin cambios de API. Build y deploy verificados tras el cambio.
- **Tiempo de remediación:** minutos (mismo turno de trabajo) — dentro de cualquier SLA de la tabla de severidad, pero por casualidad de timing, no por proceso.
- **Causa raíz:** ausencia total de escaneo de dependencias antes de este incidente. Es la motivación directa de la política `seguridad-dependencias.md` y de los mecanismos que introduce (Dependabot, `pnpm audit` en CI y programado).
- **Acción de seguimiento:** ✅ Dependabot + workflow de auditoría agregados el mismo día. Pendiente: verificar en la primera ejecución programada del workflow que efectivamente corre y que el issue automático se genera si detecta algo.

**Adenda — mismo día:** al fijar Next.js a 15.5.22, `pnpm audit` reveló 4 vulnerabilidades adicionales *transitivas* (no del propio Next.js, sino de `sharp` y `postcss` que Next.js empaqueta): 3 altas, 1 media. Se corrigieron con `pnpm.overrides` en el `package.json` raíz forzando `sharp >= 0.35.0` y `postcss >= 8.5.18`. Verificado: `pnpm audit` local limpio tras el fix, y las 4 alertas correspondientes en GitHub Dependabot pasaron a estado `fixed` ~2 minutos después del push — primera confirmación de que el mecanismo funciona de punta a punta, no solo sobre el papel.
