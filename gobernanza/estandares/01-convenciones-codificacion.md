---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Convenciones de Codificación

Aplica a las 8 aplicaciones del ecosistema y a los paquetes compartidos. El objetivo es que un desarrollador (o un agente de IA) se mueva entre `tranqi-web`, `tinkay-web`, `fastfix-web` y `margaritas-web` sin reaprender la estructura.

## 1. Qué se comparte y qué no

Ver el detalle completo en [`arquitectura/marco-de-trabajo.md`](../arquitectura/marco-de-trabajo.md). Regla resumida:

- **Se comparte:** lógica de dominio, validaciones Zod, acceso a datos, hooks de estado, primitivas de UI *sin estilo* (comportamiento, no apariencia).
- **No se comparte:** componentes visuales terminados, layout, tipografía, color, identidad de marca. Cada producto tiene estilo propio.

## 1.1. Precedencia: lo común se especifica antes que lo particular

Antes de escribir la especificación funcional o técnica de un producto, revisar [`gobernanza/productos/plataforma/`](../productos/plataforma/especificacion-funcional.md). Identidad, MFA, roles, chat con agentes de IA (ARIA), auditoría y facturación son comportamiento **de plataforma**, no de un producto — se documentan una sola vez ahí, con código `PLT-xxx`.

La especificación de un producto **nunca redefine** estos comportamientos: los referencia por código y documenta solo lo que agrega o lo que es distinto (ej. "qué flujo de Tranqi exige MFA" es específico de Tranqi; "cómo funciona MFA" es de plataforma). Si dos productos necesitan una variante genuinamente distinta de algo común, se corrige la especificación de plataforma — no se bifurca en cada producto.

## 2. Estructura de un módulo de negocio (obligatoria)

Toda entidad de dominio —un caso judicial, una solicitud de servicio, un pedido— sigue exactamente esta forma dentro de `apps/{producto}/modulos/{entidad}/`:

```
modulos/{entidad}/
├─ esquema.ts        Validación Zod + tipos derivados (fuente de verdad de forma de datos)
├─ consultas.ts       Lecturas — server-only, nunca importado en un client component
├─ acciones.ts        Mutaciones (Server Actions en web / servicios en apps nativas)
├─ componentes/        UI específica de la entidad, con estilo propio del producto
├─ paginas/            Rutas del módulo
└─ README.md           Requerimientos que cubre (códigos, ej. TRQ-014) + decisiones locales
```

## 3. Contrato de capas

| Capa | Responsabilidad | Prohibido |
| :--- | :--- | :--- |
| Ruta / Página | Composición y layout | Lógica de negocio, consultas directas a Supabase |
| Server Component (web) / Pantalla (app nativa) | Lectura de datos vía `consultas.ts` | Instanciar su propio cliente Supabase |
| Server Action (web) / Servicio (app nativa) | Mutaciones vía `acciones.ts` | Escribir sin validar con el esquema Zod primero |
| `packages/db` | Única puerta de acceso a Supabase | — |
| PostgreSQL + RLS | Autorización real | Confiar la autorización solo al frontend |

**Regla absoluta:** la `service_role` key de Supabase nunca sale de una Edge Function. No en Next.js, no en variables de entorno de cliente, no en apps nativas.

## 4. Nomenclatura de código

| Elemento | Convención | Ejemplo |
| :--- | :--- | :--- |
| Componentes React | PascalCase | `FormularioSolicitudSocio.tsx` |
| Hooks | camelCase con prefijo `use` | `useSolicitudSocio.ts` |
| Server Actions | verbo + entidad, camelCase | `enviarSolicitudSocio` |
| Funciones RPC en Postgres | `{prefijo_tabla}fn_{accion}` | `ssc_fn_enviar_solicitud` |
| Edge Functions | kebab-case, verbo-entidad | `webhook-pago-payphone` |
| Ramas de Git | `{CODIGO-ISSUE}-{descripcion-corta}` | `TRQ-014-firma-electronica` |
| Variables de entorno | `MAYUSCULAS_CON_GUION_BAJO`, prefijadas por ámbito | `SUPABASE_SERVICE_ROLE_KEY` (server-only), `NEXT_PUBLIC_SUPABASE_URL` (cliente) |

## 5. TypeScript

- `strict: true` en todos los `tsconfig.json`, heredado de `packages/config/tsconfig.base.json`.
- Prohibido `any` sin comentario justificando por qué (revisor puede rechazar el PR).
- Los tipos de fila de base de datos se generan con `supabase gen types typescript`, nunca se escriben a mano. Consumir desde `packages/db`.
- Validación de entrada externa (formularios, params de URL, payloads de webhook) siempre con Zod antes de tocar cualquier acción o consulta.

## 6. Manejo de errores

- Server Actions devuelven un resultado tipado `{ ok: true, data } | { ok: false, error }`, nunca lanzan excepciones hacia el componente.
- Errores de Supabase/PostgREST se traducen a mensajes de dominio en `acciones.ts` — el componente no interpreta códigos de Postgres.
- Toda Edge Function registra el error en `comun_auditoria.aud_log_api` antes de responder.

## 7. Pruebas

Ver [`04-pruebas.md`](04-pruebas.md) para la herramienta (Vitest), qué se prueba en qué orden de prioridad, y por qué no perseguimos cobertura como meta. Resumen: RLS y RPC transaccionales son obligatorios; lógica pura de `packages/*` se prueba con Vitest; CRUD trivial que delega en RLS no necesita test propio.

## 8. Aislamiento de UI (regla de CI)

`packages/primitivas` y `packages/core` no pueden importar nada de `next/*`. Se valida con una regla de ESLint (`no-restricted-imports`) en [`packages/config/eslint.base.mjs`](../../packages/config/eslint.base.mjs), la configuración plana (ESLint 9) que comparten las 4 apps vía `eslint.config.mjs`. Si un paquete compartido depende de Next.js, deja de ser usable en las apps nativas Capacitor.

Hoy ambos paquetes son placeholders sin `src/` ni script `lint`, así que la regla existe pero todavía no se ejecuta sobre ningún archivo: al darles código hay que añadirles `"lint": "eslint ."` y su propio `eslint.config.mjs` para que CI la haga cumplir.
