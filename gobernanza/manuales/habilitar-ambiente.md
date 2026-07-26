---
tipo: manual_tecnico
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Habilitar Ambiente de Desarrollo

> Estado: borrador. Se completa y valida durante el Sprint 0 del Entregable 1, a medida que el scaffolding real del monorepo se construye. Este documento se actualiza en el mismo PR que introduce cada pieza.

## 1. Prerrequisitos

| Herramienta | Versión mínima | Notas |
| :--- | :--- | :--- |
| Node.js | LTS vigente | Usar `nvm`/`fnm` para fijar versión por proyecto |
| pnpm | 9.x | `corepack enable` lo resuelve desde el `package.json` |
| Supabase CLI | última estable | `npm install -g supabase` |
| Git | — | — |
| Cuenta de Supabase | — | Acceso al proyecto del ecosistema |
| Cuenta de Vercel | — | Acceso a los 3 proyectos web |
| Gestor de secretos (Doppler/Infisical) | — | Ver [`politicas/gestion-credenciales.md`](../politicas/gestion-credenciales.md) |

## 2. Clonar y preparar el monorepo

```bash
git clone <url-del-repo> ecosistema
cd ecosistema
pnpm install
```

## 3. Supabase local

```bash
supabase start
supabase db reset          # aplica todas las migraciones de supabase/migrations/ desde cero
supabase gen types typescript --local > packages/db/src/tipos-generados.ts
```

`supabase start` levanta Postgres, PostgREST, GoTrue y Storage local. Las URLs y llaves locales las imprime el propio comando — no son secretas, son fijas en desarrollo local.

## 4. Variables de entorno

Cada app en `apps/{producto}` tiene su propio `.env.local` (no versionado). Se obtienen del gestor de secretos, perfil "desarrollo":

```bash
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=       # solo en contexto de Edge Function / servidor, nunca NEXT_PUBLIC_*
```

## 5. Arrancar una aplicación

```bash
pnpm --filter tranqi-web dev
```

Turborepo construye primero los `packages/` de los que depende antes de levantar el servidor de desarrollo.

## 6. Arrancar todo el ecosistema en paralelo

```bash
pnpm dev
```

Ejecuta el script `dev` de cada app vía Turborepo, respetando el grafo de dependencias entre `packages/` y `apps/`.

## 7. Verificaciones antes de abrir un PR

```bash
pnpm lint
pnpm typecheck
pnpm build          # Turborepo construye solo lo afectado por el cambio
```

## 8. Problemas comunes

| Síntoma | Causa probable |
| :--- | :--- |
| `next/*` importado en un paquete compartido rompe el build de una app nativa | Violación de la regla de aislamiento de UI — ver [`estandares/01-convenciones-codificacion.md`](../estandares/01-convenciones-codificacion.md) §8 |
| Tipos desactualizados tras una migración nueva | Falta correr `supabase gen types` y commitear el resultado |
| RLS bloquea una consulta esperada en desarrollo | Revisar el rol activo en `seg_membresia` del usuario de prueba, no desactivar RLS para depurar |

## 9. Pendiente de completar en Sprint 0

- [ ] Estructura real de `turbo.json` y scripts raíz.
- [ ] Seed de datos de desarrollo (`supabase/seed/`).
- [ ] Instrucciones específicas para levantar cada app nativa en emulador/dispositivo.
