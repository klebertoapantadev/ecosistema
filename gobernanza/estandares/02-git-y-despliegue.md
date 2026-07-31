---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Git, Ramas, PRs y Despliegue

## 1. Repositorio único

Monorepo `ecosistema` (Turborepo + pnpm workspaces). Ver [`arquitectura/marco-de-trabajo.md`](../arquitectura/marco-de-trabajo.md) §1 para el argumento de por qué no hay repos independientes por producto — en resumen: la base de datos es una sola, por lo tanto el historial de migraciones debe ser uno solo.

## 2. Ramas

| Rama | Propósito |
| :--- | :--- |
| `master` | Siempre desplegable. Protegida: requiere PR + CI verde. Es la rama de producción en Vercel. |
| `{CODIGO}-{descripcion}` | Una rama por issue. Ejemplo: `TRQ-014-firma-electronica`. El código es el mismo que aparece en el issue de GitHub y en la especificación funcional. |

No hay rama `develop`. Cada PR a `master` debe ser desplegable por sí solo (feature flags si algo no está listo para visibilidad total, no ramas de integración de larga vida).

## 3. Pull Requests

- Título: `[CODIGO] Descripción breve` — ej. `[TRQ-014] Firma electrónica de escritos`.
- El repositorio trae `.github/pull_request_template.md`: todo PR nace con el checklist de [Definition of Done](03-definition-of-done.md). No se vacía la plantilla, se marca lo que aplica.
- Descripción incluye `Closes #123` para que el issue se cierre automáticamente al hacer merge.
- CI debe pasar: build de Turborepo (solo apps afectadas), lint, tipos, las 6 verificaciones de conformidad del [estándar de nomenclatura](00-nomenclatura-base-datos.md).
- Si el PR cambia un esquema `comun_*`, requiere aprobación de CODEOWNERS (afecta a los 4 productos).
- Si el PR cambia el comportamiento descrito en un artefacto de `gobernanza/`, el PR actualiza ese artefacto en el mismo commit. No se aprueba el PR si el artefacto queda desactualizado.

## 3.1. Por qué esto no depende de que el desarrollador use un agente de IA en particular

`AGENTS.md` en la raíz del repo es leído nativamente por Claude Code, GitHub Copilot, Antigravity, Cursor y Windsurf — es la vía por la que el agente conoce las reglas sin que nadie las copie a mano. Pero un archivo leído es una intención, no una garantía: el checklist del PR y las verificaciones de CI son lo que efectivamente bloquea un merge que las viole, sin importar qué herramienta escribió el código o si se escribió a mano.

## 4. CODEOWNERS

```
/supabase/migrations/**            @kleber
/gobernanza/estandares/**          @kleber
/gobernanza/politicas/**           @kleber
/packages/auth/**                  @kleber
```

Los esquemas comunes y las políticas de seguridad no cambian sin revisión del responsable de plataforma.

## 5. Despliegue: builds selectivos por aplicación

Cada aplicación web es **un proyecto de Vercel independiente**, con:

- **Root Directory** apuntando a su carpeta: `apps/tranqi-web`, `apps/tinkay-web`, `apps/fastfix-web`, `apps/margaritas-web`.
- **Dominio propio** asignado a cada proyecto.
- **Ignored Build Step** configurado como:

```bash
npx turbo-ignore --fallback=master
```

`turbo-ignore` compara el commit actual contra el último deploy exitoso de ese proyecto y determina si la app o alguna de sus dependencias en `packages/` cambió. Si no cambió nada relevante, Vercel marca el build como `Skipped` y el dominio de esa app no se toca.

El `--fallback` es obligatorio aquí: sin él, `turbo-ignore` asume `main` cuando no encuentra un deploy previo con el que comparar, y en un repo cuya rama de producción es `master` eso hace que el primer build de cada proyecto —y cualquiera tras un despliegue fallido— se salte por error.

**Efecto práctico:** un push que solo modifica `apps/tinkay-web` dispara los 4 proyectos de Vercel, pero solo Tinkay construye y publica; las demás quedan en `Skipped`. Un push que modifica `packages/ui` reconstruye correctamente todas las apps que lo consumen.

### 5.0. Configuración exacta de cada proyecto de Vercel

Los cuatro proyectos se configuran igual salvo el Root Directory y el dominio. Todo esto vive en el panel de Vercel, no en el repo: no hay `vercel.json` y no debe haberlo, porque la configuración del monorepo (Root Directory) es por proyecto y `vercel.json` es por carpeta.

| Ajuste | Valor | Por qué |
| :--- | :--- | :--- |
| Framework Preset | Next.js | Detección automática, se confirma |
| Root Directory | `apps/{producto}-web` | Cada proyecto construye una sola app |
| Include source files outside of the Root Directory | **Activado** | Sin esto el build no ve `packages/*` ni el `pnpm-lock.yaml` de la raíz, y la instalación falla |
| Install Command | (por defecto) | Vercel respeta el campo `packageManager` de la raíz: `pnpm@9.15.0` |
| Node.js Version | 22.x | El `engines` del repo pide `>=20`; CI usa 20. Fijar 22 evita que Vercel salte de versión por su cuenta |
| Production Branch | `master` | Ver §2 |
| Ignored Build Step | `npx turbo-ignore --fallback=master` | Builds selectivos |
| Automatic deployments from Git | Activado para todas las ramas | Un push a `master` publica producción; un push a cualquier otra rama con PR abierto genera un Preview |

**Variables de entorno.** Se cargan por proyecto y por ambiente (Production / Preview / Development), nunca compartidas entre ambientes — ver [`politicas/gestion-credenciales.md`](../politicas/gestion-credenciales.md). Las que hoy consume el código:

| Variable | Ámbito | Notas |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Cliente | El prefijo `NEXT_PUBLIC_` la expone al navegador: solo valores públicos |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Cliente | Clave publicable, protegida por RLS |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM_NOMBRE` | Servidor | Sin prefijo `NEXT_PUBLIC_`: nunca llegan al bundle del navegador |
| `ARIA_BASE`, `ARIA_AGENT_ID`, `ARIA_AGENT_KEY` | Servidor | Agente conversacional, ver `ADR-0002` |
| `TRQ_ABOGADO_BASE`, `TRQ_ABOGADO_AGENT_ID`, `TRQ_ABOGADO_AGENT_KEY` | Servidor | Solo Tranqi |

La `service_role` de Supabase **no** aparece en esta tabla y no debe cargarse en Vercel: vive solo en Edge Functions, según §3 de las convenciones de codificación.

### 5.1. Apps nativas

Las apps Capacitor (Tranqi Cliente, Tranqi Abogado, FastFix Cliente) **no pasan por Vercel**. Se compilan vía GitHub Actions (`.github/workflows/build-{app}.yml`), activado solo cuando cambia `apps/{app}/**` o un paquete del que dependen, y se publican a las tiendas como release build independiente. Cada app tiene su propio pipeline; no hay build conjunto de las tres.

## 6. Ambientes y Supabase Branching

- **Producción:** rama `master`, proyecto Supabase principal.
- **Preview por PR:** Supabase Branching crea una base de datos efímera por PR, contra la cual corren las migraciones antes de tocar producción. Vercel Preview Deployments apuntan a esa rama de Supabase.
- Ninguna migración se prueba primero contra producción.

## 7. Versionado y releases

- Las apps web no se versionan explícitamente (deploy continuo a `master`).
- Las apps nativas se versionan con SemVer (`MAJOR.MINOR.PATCH`) en el manifiesto de cada app; un tag de Git `{app}-v{version}` dispara el build de release.

## 8. Entrega documental / escrow (aplica solo a Tranqi)

Cuando se requiera generar la entrega para el cliente de Tranqi, el workflow `.github/workflows/exportar-escrow.yml`:

1. Extrae `apps/tranqi-*` del monorepo.
2. Vendoriza los `packages/*` que esas apps declaran como dependencia.
3. Incluye únicamente las migraciones de `comun_*` y `tranqui_legal`.
4. Reescribe las dependencias de workspace a rutas locales.
5. Publica en un repositorio de entrega etiquetado: `entrega-tranqi-v{fecha}`.

Este workflow se construye antes del primer hito de entrega contractual, no en el Sprint 0. Tinkay, FastFix Home y Margaritas Floristería no lo necesitan — son proyectos propios.
