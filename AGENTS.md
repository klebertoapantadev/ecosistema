# Ecosistema — Instrucciones para agentes de IA

Este archivo es la fuente de contexto para **cualquier agente de codificación** que trabaje en este repositorio — Claude Code, GitHub Copilot, Antigravity, Cursor, Windsurf u otro. Sigue el estándar abierto [AGENTS.md](https://agents.md).

Monorepo (Turborepo + pnpm) para 8 aplicaciones sobre 4 negocios (Tranqi, FastFix Home, Tinkay, Margaritas Floristería) que comparten una única instancia Supabase multi-esquema.

## Antes de escribir código, lee

- [`gobernanza/arquitectura/marco-de-trabajo.md`](gobernanza/arquitectura/marco-de-trabajo.md) — contrato de capas, qué se comparte y qué no.
- [`gobernanza/estandares/00-nomenclatura-base-datos.md`](gobernanza/estandares/00-nomenclatura-base-datos.md) — obligatorio para cualquier tabla o columna nueva.
- [`gobernanza/estandares/01-convenciones-codificacion.md`](gobernanza/estandares/01-convenciones-codificacion.md) — estructura de módulo, capas, manejo de errores.
- [`gobernanza/politicas/seguridad-y-datos.md`](gobernanza/politicas/seguridad-y-datos.md) — RLS, MFA, cifrado. No opcional.
- [`gobernanza/productos/plataforma/especificacion-funcional.md`](gobernanza/productos/plataforma/especificacion-funcional.md) — identidad, MFA, roles, chat ARIA, auditoría, facturación. Antes de tocar cualquiera de estos temas en un producto, verificar si ya está resuelto aquí (código `PLT-xxx`).

## Reglas que no se negocian

1. **RLS habilitado en el 100% de las tablas nuevas.** Sin excepción temporal.
2. **`aud_fn_auditar_tabla()` en toda tabla de negocio nueva.**
3. **`service_role` nunca sale de `supabase/functions/`.** Nunca en `NEXT_PUBLIC_*`, nunca en una app nativa.
4. **`packages/primitivas` y `packages/core` no importan nada de `next/*`.** Se usan en apps nativas Capacitor.
5. **Transiciones de estado sensibles (aprobar, rechazar, pagar) son RPC transaccional, no `UPDATE` directo desde el cliente.**
6. **Rol ≠ capacidad.** Un rol en `seg_membresia` no habilita acceso si el proceso de negocio exige un estado adicional (ej. verificación aprobada). Verificar el estado real en la política RLS.
7. **Nomenclatura de base de datos**: prefijo de tabla de 3 letras, prefijo de columna por entidad, PK `uuid`, secuencial legible, columna JSONB `_detalle_*`. Ver el estándar antes de crear cualquier tabla.
8. **Si un PR cambia el comportamiento descrito en un artefacto de `gobernanza/`, el PR actualiza ese artefacto.**
9. **Todo chat o agente conversacional de producto usa `packages/agentes-ia`.** Ninguna app reimplementa su propio proxy hacia ARIA. Ver [ADR-0002](gobernanza/arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).
10. **Ninguna dependencia de producción usa rangos flotantes (`^`, `~`).** Versión exacta fijada; las actualizaciones llegan vía Dependabot. Ver [`politicas/seguridad-dependencias.md`](gobernanza/politicas/seguridad-dependencias.md).
11. **Ningún producto tiene su propia tabla de catálogo de productos.** Todo lo que se vende (físico, servicio, suscripción, digital) vive en `comun_comercio`. Ver [ADR-0003](gobernanza/arquitectura/adr/0003-catalogo-comercial-unificado.md).
12. **El ecosistema vive en su propio proyecto Supabase dedicado (`ecosistema`, ver [`inventario-supabase.md`](gobernanza/arquitectura/inventario-supabase.md)).** Nunca se reutiliza o comparte instancia con una base de datos operativa ajena a este monorepo — si alguna vez se conecta un proyecto Supabase distinto al listado en ese inventario, confirmar con el usuario antes de crear o modificar cualquier esquema.
13. **Toda tabla donde el usuario edita su propia fila revoca `UPDATE` de tabla completa y otorga `GRANT UPDATE` solo por columna.** RLS filtra filas, no columnas — sin esto, un `PATCH` directo puede escribir campos privilegiados (`*_superadmin_*`, `*_rol`) aunque la UI nunca lo permita. Ver [`politicas/seguridad-y-datos.md`](gobernanza/politicas/seguridad-y-datos.md) §9 (encontrado y corregido en `seg_usuario`, 2026-07-27).
14. **Todo lo que implementa un requerimiento `PLT-xxx` va en `packages/*`, no en `apps/{app}/modulos/`** — aunque hoy solo un negocio lo use. `packages/identidad` y `packages/supabase` son el patrón a seguir: nacieron dentro de `tranqi-web`, se extrajeron cuando los otros 3 negocios necesitaron lo mismo. Un paquete que mezcla código de servidor (`next/headers`) y componentes cliente en un solo barril rompe el build del navegador — separar en subpaths (`package.json` → `exports`) cuando haga falta, ver `packages/supabase/package.json`.

## Protocolo de inicio de sesión (Claude Token Optimizer)

Instalado el 2026-07-27 ([nadimtuhin/claude-token-optimizer](https://github.com/nadimtuhin/claude-token-optimizer)) para mantener el contexto de arranque liviano. **Al inicio de cada sesión, leer:**

```bash
✓ .claude/COMMON_MISTAKES.md      # ⚠️ Errores conocidos — leer primero
✓ .claude/QUICK_START.md          # Comandos esenciales
✓ .claude/ARCHITECTURE_MAP.md     # Ubicación de archivos
```

**Al terminar una tarea:** crear un doc de cierre en `.claude/completions/YYYY-MM-DD-nombre-tarea.md` y mover cualquier archivo de sesión a `.claude/sessions/archive/`.

**Nunca cargar automáticamente** (costo cero de tokens, son archivo histórico): `.claude/completions/`, `.claude/sessions/`, `docs/archive/`.

## Comandos del proyecto

```bash
pnpm install        # instalar dependencias del monorepo
pnpm dev             # levantar todas las apps en paralelo
pnpm --filter {app} dev   # levantar una app específica
pnpm lint
pnpm typecheck
pnpm build           # Turborepo construye solo lo afectado por el cambio
supabase start       # Supabase local (requiere Supabase CLI)
supabase db reset    # aplica todas las migraciones desde cero
```

## Estructura

```
apps/           Una carpeta por aplicación (web y nativa)
packages/       Código compartido — ver regla de qué se comparte en marco-de-trabajo.md
supabase/       Migraciones únicas, Edge Functions, seed
gobernanza/     Estándares, arquitectura, políticas, manuales, especificaciones por producto
```

## Esquemas de base de datos vigentes

| Esquema | Propietario | Prefijo de tabla |
| :--- | :--- | :--- |
| `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo`, `comun_agentes`, `comun_comercio` | Plataforma | `seg_`, `aud_`, `fac_`, `cat_`, `agc_`, `com_` |
| `tranqui_legal` | Tranqi | `trq_` |
| `fastfix_mantenimiento` | FastFix Home | `ffh_` |
| `tinkay_floristeria` | Tinkay | `tnk_` |
| `margaritas_floristeria` | Margaritas Floristería | `mrg_` |

## Qué hacer si una instrucción del usuario contradice este archivo

Señalarlo explícitamente antes de proceder, citando la regla de `gobernanza/` en conflicto. No asumir que la instrucción puntual deroga el estándar — el estándar cambia por PR a `gobernanza/`, no por una instrucción de chat.

## 6. Estándar de Microcopia (Copywriting) Concisa en Botones y Modo "Solo Ícono" en Móviles

- **Textos Precisos y Simplificados**:
  - Todo botón de acción en las aplicaciones web del ecosistema DEBE utilizar textos directos, concisos y breves (máximo 2 a 3 palabras).
  - Quedan prohibidos textos extensos o redundantes (ej. usar `Contrafirmar Contrato` en vez de `Contra-Firmar Digitalmente (.p12) y Activar Socio`; usar `Firma Online` en vez de `Abrir Asistente de Firma Electrónica (.p12)`).
- **Modo Solo Ícono en Responsive Móvil (`<640px`)**:
  - En pantallas móviles, los botones de acción deben conmutar preferiblemente a **Solo Ícono** (`.btn-responsive-accion`), ocultando la etiqueta de texto (`.btn-texto-responsive`) para evitar desbordes horizontales o botones excesivamente altos.
  - Es mandatorio incluir siempre los atributos accesibles `title` y `aria-label` descriptivos de la acción.

## Actualización Obligatoria de Gobernanza y Matriz de Requerimientos (`especificacion-funcional.md`)

- **Control de Estado y Porcentaje de Avance (%)**:
  - Tras implementar, modificar o verificar cualquier requerimiento o funcionalidad (`PLT-xxx`, `TRQ-xxx`, `FFH-xxx`, `TNK-xxx`, `MRG-xxx`), el agente DEBE actualizar de inmediato la **Matriz de Responsables, Estado y Avance (%)** en [especificacion-funcional.md](file:///c:/Users/Kleber%20Toapanta/Documents/BK2026/Antigravity2026/Ley/ecosistema/gobernanza/productos/plataforma/especificacion-funcional.md) (o en la especificación del producto correspondiente).
  - **Criterios de Actualización**:
    - **`Estado`**: Actualizar a `✅ Implementado`, `🟡 Parcial / En Desarrollo` o `⏳ Pendiente`.
    - **`Avance (%)`**: Recalcular y actualizar el porcentaje real de avance (0% a 100%) según las reglas de negocio verificadas.
    - **`Responsable`**: Asignar y mantener el responsable de revisión e implementación.
  - **Criterio de Cierre de Tarea**: Ninguna funcionalidad se dará por finalizada ni entregada sin haber actualizado previamente su fila en la matriz de la especificación funcional.

## Estado actual

Sprint 0 en curso. Identidad (registro Google OAuth + correo/contraseña, bienvenida, consentimiento de términos, historial de accesos, baja de cuenta — `PLT-001`/`012`/`018`), configuración del negocio (`PLT-008`) y gestión de usuarios/roles (el widget, `PLT-011`) viven en paquetes compartidos (`packages/identidad`, `packages/configuracion-negocio`, `packages/gestion-usuarios`) y funcionan de punta a punta en las **4 apps** (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`), todas desplegadas en Vercel. **Pendiente manual:** agregar el `/auth/callback` de `fastfix-web`/`tinkay-web`/`margaritas-web` a los Redirect URLs de Supabase para que Google OAuth funcione en esas 3 (dashboard, sin herramienta MCP). Pendiente del Entregable 1 de Tranqi: solicitud de socios abogados. Ver [`gobernanza/productos/tranqi/`](gobernanza/productos/tranqi/) y el [README de `packages/identidad`](packages/identidad/README.md).
