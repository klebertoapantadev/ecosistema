# ADR-0002: ARIA como estándar de agentes conversacionales del ecosistema

**Fecha:** 2026-07-26
**Estado:** aceptada

## Contexto

Tranqi trae una landing de demostración con un "buddie" conversacional respaldado por un agente de ARIA (`aria-mcp/server.js` administra esos agentes; el proxy de chat vive server-side para no exponer credenciales al navegador). Al incorporar Tranqi al monorepo, hace falta decidir si esta integración es exclusiva de Tranqi o un estándar de plataforma — porque los otros productos (FastFix, Tinkay) también van a necesitar chat conversacional, y potencialmente **agentes distintos por rol dentro de un mismo producto** (ej. un agente para clientes de Tranqi y otro distinto para abogados).

## Decisión

1. **ARIA es el motor estándar de agentes conversacionales para todo el ecosistema**, no una integración puntual de Tranqi.
2. **`aria-mcp`** (herramienta de administración de agentes de ARIA — crear/editar agentes, tenants, keys, runs) se incorpora al monorepo en `tools/aria-mcp/`, versionado junto al resto pero sin desplegarse como app de producto.
3. **La lógica de proxy hacia ARIA se centraliza en `packages/agentes-ia`**, consumida por el Route Handler `/api/chat` de cada app. Ningún producto reimplementa el proxy — todos llaman a la misma función server-only.
4. **Un producto puede tener un agente distinto por rol.** La resolución de "qué agente usar" no se hardcodea en el frontend: se resuelve server-side a partir de `producto + rol` contra un catálogo en base de datos (`comun_agentes`, ver más abajo), no desde variables de entorno dispersas por app.
5. **Las credenciales de cada agente (API key) nunca viven en la base de datos ni en el catálogo.** El catálogo guarda el *nombre* de la variable de entorno donde vive la credencial (ej. `ARIA_KEY_TRANQI_CLIENTE`), no el valor — coherente con [`politicas/gestion-credenciales.md`](../../politicas/gestion-credenciales.md).

## Esquema de base de datos: `comun_agentes`

Esquema transversal — todo producto lo consulta, ninguno lo duplica. Sigue la fórmula de [`estandares/00-nomenclatura-base-datos.md`](../../estandares/00-nomenclatura-base-datos.md).

| Tabla | Prefijo col. | Propósito |
| :--- | :--- | :--- |
| `comun_agentes.age_agente_conversacional` | `agc_` | Catálogo de agentes ARIA disponibles, mapeados a producto y (opcionalmente) rol. |

```sql
create table comun_agentes.age_agente_conversacional (
  agc_id uuid primary key default gen_random_uuid(),
  agc_secuencial bigint generated always as identity,
  agc_producto text not null,                    -- 'tranqi' | 'fastfix' | 'tinkay' | 'margaritas' | 'plataforma'
  agc_rol text,                                   -- null = agente por defecto del producto; o 'CLIENTE' | 'ABOGADO' | 'ADMIN' | ...
  agc_nombre text not null,                       -- descriptivo, ej. "Tranqi Buddy — Cliente"
  agc_agente_externo_id text not null,            -- ID del agente en ARIA
  agc_base_url text not null default 'https://logs-testing.mysatcomla.com/agentes',
  agc_variable_entorno_credencial text not null,  -- nombre de la env var con la API key — NUNCA el valor
  agc_activo boolean not null default true,
  agc_detalle_agente jsonb not null default '{}'::jsonb,
  agc_creado_en timestamptz not null default now(),
  agc_actualizado_en timestamptz not null default now(),
  unique (agc_producto, agc_rol)
);

alter table comun_agentes.age_agente_conversacional enable row level security;
-- Lectura solo desde contexto de servidor (Edge Function / Route Handler con service_role).
-- Nunca expuesto a un cliente vía supabase-js con anon key.
```

Esta tabla se crea junto con el resto de esquemas comunes en las migraciones de Sprint 0 (pendiente — ver `gobernanza/manuales/habilitar-ambiente.md` §9). Mientras no exista, `packages/agentes-ia` resuelve el agente de cada app leyendo variables de entorno directamente (comportamiento actual de la demo de Tranqi), pero la función de resolución queda aislada en un solo punto para no reescribir cada app cuando la tabla exista.

## Alternativas evaluadas

| Alternativa | Por qué no se eligió |
| :--- | :--- |
| Cada app reimplementa su propio proxy de chat (como hacía `demo/server.js`) | Duplica la lógica de manejo de credenciales y de timeout/errores en cada producto; un fix de seguridad tendría que aplicarse N veces |
| Hardcodear el agente por producto en variables de entorno únicamente, sin catálogo en BD | No soporta "un agente distinto por rol" sin agregar variables ad-hoc por cada combinación producto×rol, y no queda auditable ni administrable desde un back-office |

## Consecuencias

- Todo Route Handler `/api/chat` de cualquier app importa `packages/agentes-ia`, no reimplementa el proxy.
- Cuando se cree el catálogo `comun_agentes`, la función de resolución de agente en `packages/agentes-ia` cambia de "leer env var fija" a "consultar producto+rol en la tabla, luego leer la env var que la tabla indica" — un solo punto de cambio, no N apps.
- `aria-mcp` queda versionado en `tools/aria-mcp/`, disponible para el equipo, pero no es una app desplegable de Vercel.
