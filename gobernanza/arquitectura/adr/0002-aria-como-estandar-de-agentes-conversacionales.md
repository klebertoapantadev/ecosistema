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


## Nota de seguimiento (2026-08-23, TRQ-009)

La decisión 3 se cumple y se amplía: `packages/agentes-ia` ya no solo hace de proxy hacia ARIA,
también contiene el servidor MCP con el que las apps le dan herramientas a sus agentes
(`mcp-servidor.ts`), la cápsula de identidad (`capsula.ts`) y el cliente de administración por
tenant (`consola.ts`).

La decisión 4 sigue pendiente en su forma final: Tranqi resuelve hoy "qué agente usar" por
`producto + rol` server-side, pero contra variables de entorno (`TRQ_CLIENTE_*`, `TRQ_ABOGADO_*`) y
no contra `comun_agentes`, que sigue sin migrarse. `resolverAgenteDesdeEntorno` está escrita para
que ese cambio no toque ningún Route Handler.

**ARIA fue modificada** para que la identidad del usuario final pueda llegar a las herramientas sin
pasar por el prompt (`tool_context` en `InvokeRequest`, plantillas `{{clave}}` en los headers de
http-tools y MCP). El cambio es retrocompatible. El razonamiento completo, y por qué la alternativa
de pasar el identificador como argumento de herramienta se descartó, están en
[ADR-0005](0005-frontera-de-identidad-en-herramientas-de-ia.md).

## Nota de seguimiento (2026-11-11, PLT-008 / PLT-004 / TNK-004)

Para que el `ADMINISTRADOR` de cada negocio (`tinkay`, `tranqi`, `fastfix`, `margaritas`) o el
`SUPERADMIN` pueda configurar y rotar las credenciales de su propio agente conversacional desde el
panel administrativo (`/panel/aria`, widget común `configuracion_aria` en `@eco/configuracion-negocio`)
sin depender de variables de despliegue manuales en Vercel ni romper la política de secretos:

1. **Metadatos no sensibles en `comun_configuracion.cfg_aria`** (prefijo `ari_`, RLS + auditoría):
   almacena por negocio `ari_base_url` (`ARIA_BASE`), `ari_agente_id` (`ARIA_AGENT_ID`),
   `ari_nombre_agente` y `ari_activo`, más las referencias UUID a Vault (`ari_secreto_id`,
   `ari_tenant_secreto_id`, `ari_gate_secreto_id`).
2. **Secretos exclusivamente en Supabase Vault (`vault.secrets`)**: `ARIA_AGENT_KEY` (y opcionalmente
   `ARIA_TENANT_KEY` / `ARIA_GATE_KEY`) se guardan mediante el RPC `cfg_fn_guardar_aria` siguiendo el
   mismo modelo que SMTP en [ADR-0005](0005-smtp-por-negocio.md). Ninguna columna guarda la clave en
   texto plano y la pantalla jamás puede leerla de vuelta.
3. **Descifrado aislado en servidor (`supabase/functions/invocar-aria` + RPC `comun_configuracion.cfg_fn_invocar_aria`)**:
   - `cfg_fn_obtener_aria_credenciales` otorga `EXECUTE` únicamente a `service_role` para uso de la Edge Function `invocar-aria`.
   - Adicionalmente, la migración `20261112000001_cfg_fn_invocar_aria_rpc.sql` habilita `cfg_fn_invocar_aria` (`SECURITY DEFINER` sobre `extensions.http` y `vault.decrypted_secrets`, con `CURLOPT_TIMEOUT = 45s`), permitiendo invocar `${base_url}/v1/agents/${agente_id}/invoke` directamente desde PostgreSQL sin exponer jamás `api_key` fuera del motor cuando la Edge Function aún no ha sido desplegada por CLI.
   - `invocarAgentePorNegocio()` en `packages/agentes-ia` intenta primero `invocar-aria`, cae automáticamente en el RPC `cfg_fn_invocar_aria` si la Edge Function devuelve `404`, y conserva como tercer respaldo `resolverAgenteDesdeEntorno("ARIA")` (`ARIA_BASE`, `ARIA_AGENT_ID`, `ARIA_AGENT_KEY`).
