---
tipo: arquitectura
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Marco de Trabajo del Ecosistema

Define cómo se construye cada producto sobre el stack común, para que agregar un producto nuevo (el 4.º negocio) no requiera redecidir arquitectura.

## 1. Por qué monorepo

La base de datos es una sola instancia Supabase compartida entre todos los productos. Por lo tanto **el historial de migraciones debe ser uno solo**. Con repos independientes contra la misma instancia:

- No existe una fuente de verdad del esquema; migraciones divergentes producen deriva silenciosa.
- El orden de aplicación queda determinado por quién despliega primero, no por dependencias reales.
- Un cambio a un esquema común (`comun_seguridad`) rompe otros productos sin aviso.

Esto no se resuelve con disciplina. Se resuelve con un único repositorio y un único directorio `supabase/migrations/`.

## 2. Qué se comparte y qué no

| Se comparte (`packages/`) | No se comparte (por app) |
| :--- | :--- |
| Lógica de dominio, validaciones Zod, acceso a datos (`packages/core`) | Componentes visuales terminados |
| Sesión, MFA, resolución de rol (`packages/auth`) | Layout, tipografía, espaciado, color |
| Tipos generados desde el esquema (`packages/db`) | Composición de pantallas |
| Primitivas de UI *sin estilo* — comportamiento accesible, base Radix (`packages/primitivas`) | Identidad de marca |
| Config de lint/tipos/formato (`packages/config`) | — |

Los tres productos discrepan deliberadamente en apariencia y en funcionalidad de negocio. Un design system visual compartido entre productos con identidades distintas es más caro de mantener que tres implementaciones independientes — termina siendo un componente con props condicionales por marca. Se comparte cómo funcionan las cosas, no cómo se ven.

**Regla de extracción:** nada se mueve a `packages/` hasta que exista un segundo consumidor real. La excepción son `auth`, `db` y `config`, que se sabe de antemano que sirven a las 6 apps.

## 3. Contrato de capas

Ver el detalle operativo en [`estandares/01-convenciones-codificacion.md`](../estandares/01-convenciones-codificacion.md) §3. Resumen:

```
Ruta/Página → Server Component/Action → packages/db → PostgreSQL + RLS
```

La autorización real vive en RLS. El frontend nunca es la única barrera.

## 4. Conexión a datos: tres niveles

| Nivel | Cuándo | Ejemplo |
| :--- | :--- | :--- |
| `supabase-js` sobre tablas | CRUD simple bajo RLS | Listar casos del cliente autenticado |
| RPC (`.rpc()`, función plpgsql) | Operación transaccional multi-tabla o lógica de negocio | Aprobar solicitud → crea perfil + asigna rol, atómico |
| Edge Function | Cualquier operación que requiera `service_role` o secretos | Webhook de pago, facturación SRI, envío de WhatsApp |

`supabase-js` **es** el cliente de PostgREST — no existe una disyuntiva entre "usar PostgREST" o "usar la API de Supabase". Llamar PostgREST a mano por HTTP pierde refresh de token, propagación de sesión para RLS y tipos generados, sin ganar nada.

## 5. Apps nativas: conexión directa a Supabase

Las apps Capacitor se conectan **directo a Supabase**, sin proxy en Vercel. Un intermediario no agregaría seguridad (tendría que reenviar el mismo JWT del usuario para preservar RLS), solo latencia y una superficie de deploy adicional. Storage y Realtime requieren conexión directa de todos modos.

**Consecuencia de diseño:** las apps nativas no se redespliegan al instante (revisión de tienda, usuarios que no actualizan). Todo cambio de esquema o de función RPC consumida por una app nativa debe ser retrocompatible.

## 6. Anatomía de un módulo de negocio

Ver [`estandares/01-convenciones-codificacion.md`](../estandares/01-convenciones-codificacion.md) §2 para la estructura exacta de carpetas.

## 7. Régimen de propiedad de esquemas

| Esquema | Propietario | Regla de cambio |
| :--- | :--- | :--- |
| `comun_*` | Plataforma | Cambio de plataforma — requiere CODEOWNERS, afecta a todos los productos |
| Esquema de cada negocio | Equipo del producto | Libre dentro del esquema, respetando la nomenclatura |

## 8. Plantilla y generador de producto nuevo

`apps/_plantilla-web` (a crear en Sprint 0 del segundo producto) trae autenticación con MFA, layout admin mínimo, consola de auditoría montada y CI configurado. Un producto nuevo nace de copiarla vía `pnpm crear-producto`, que solicita identificador de marca, esquema y prefijos, y genera la app, la migración inicial y el registro en `gobernanza/productos/`.

Objetivo: un producto nuevo desplegado y autenticando en menos de un día, sin decisiones de arquitectura pendientes.

## 9. Conformidad verificada en CI

| Verificación | Qué bloquea |
| :--- | :--- |
| Nomenclatura de base de datos | Tablas/columnas fuera de la fórmula del estándar |
| RLS obligatorio | Tabla nueva sin RLS habilitado |
| Trigger de auditoría | Tabla de negocio sin `aud_fn_auditar_tabla()` |
| Aislamiento de UI | `next/*` importado dentro de `packages/primitivas` o `packages/core` |
| Fuga de secretos | `service_role` fuera de `supabase/functions/` |
| Deriva de tipos | `packages/db` desactualizado respecto a las migraciones |

## 10. Orden recomendado al construir un producto nuevo

1. Identidad y auth del producto (reutiliza `packages/auth` casi sin cambios).
2. El flujo de negocio de mayor complejidad primero, no el más simple — expone temprano si el marco necesita ajustes.
3. Back-office de administración/revisión.
4. Endurecimiento de RLS con pruebas negativas por rol.
5. Apps nativas, si aplica, sobre el modelo ya validado en web.
