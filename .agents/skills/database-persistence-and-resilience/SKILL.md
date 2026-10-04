---
name: database-persistence-and-resilience
description: Use when implementing, modifying, or debugging data persistence, Server Actions, forms, and client components to ensure zero data loss, hybrid client-server caching (LocalStorage + PostgreSQL), and strict error propagation without silent suppression.
---

# Skill: Database Persistence, Hybrid Resilience & Zero Data Loss Enforcer
<!-- Skill: Ejecutor de Persistencia BDD, Resiliencia Híbrida y Cero Pérdida de Datos -->

This skill ensures that all form edits, configurations, business rules, and transactions in the ecosystem are reliably persisted to PostgreSQL/Supabase and survive browser reloads, server cold-starts, and pending migrations through resilient hybrid storage patterns.
<!-- Esta skill garantiza que todas las ediciones de formularios, configuraciones, reglas de negocio y transacciones en el ecosistema se persistan de manera confiable en PostgreSQL/Supabase y sobrevivan a recargas de navegador, arranques en frío del servidor y migraciones pendientes mediante patrones de almacenamiento híbrido resiliente. -->

---

## 1. Core Principles
<!-- 1. Principios Fundamentales -->

1. **Zero Silent Error Suppression**:
   <!-- Cero Supresión Silenciosa de Errores -->
   - Never catch a database exception and return `{ ok: true }` based only on in-memory RAM mutation.
   <!-- Nunca captures una excepción de base de datos y retornes `{ ok: true }` basado únicamente en mutaciones en memoria RAM. -->
   - If PostgreSQL rejects the write (RLS denial, missing RPC, constraint failure), the Server Action MUST return `{ ok: false, error: err.message }`.
   <!-- Si PostgreSQL rechaza la escritura (denegación de RLS, RPC faltante, fallo de constraint), la Server Action DEBE retornar `{ ok: false, error: err.message }`. -->

2. **Hybrid Client-Server Resilience Pattern**:
   <!-- Patrón de Resiliencia Híbrida Cliente-Servidor -->
   - **Immediate Local Cache Load (`cargarDatos`)**:
     <!-- Carga Inmediata de Caché Local (`cargarDatos`) -->
     Read `localStorage.getItem("key")` synchronously on mount so the user never sees an empty screen or reverted state while fetching.
     <!-- Lee `localStorage.getItem("key")` sincrónicamente al montar para que el usuario nunca vea una pantalla vacía o estado revertido mientras consulta. -->
   - **Parallel Database Query & Sync**:
     <!-- Consulta y Sincronización Paralela en Base de Datos -->
     Query Supabase via Server Action. When fresh data arrives, update the UI and refresh the local storage cache.
     <!-- Consulta Supabase mediante Server Action. Cuando lleguen datos actualizados, refresca la UI y actualiza el caché de local storage. -->
   - **Instant Save & Cache Write (`handleGuardar`)**:
     <!-- Guardado Instantáneo y Escritura en Caché (`handleGuardar`) -->
     On successful mutation, update React state AND save the complete array/object to `localStorage.setItem("key", JSON.stringify(updatedList))` immediately.
     <!-- Al confirmar la mutación, actualiza el estado de React Y guarda la lista/objeto completo en `localStorage.setItem("key", JSON.stringify(updatedList))` de inmediato. -->

3. **In-Situ Search & Update (Prevent Duplicates)**:
   <!-- Búsqueda y Actualización In Situ (Evitar Duplicados) -->
   - Both in SQL RPCs and Server Actions, look up existing rows by UUID, business name (case-insensitive `ilike`), or unique code before performing an `INSERT`.
   <!-- Tanto en RPCs de SQL como en Server Actions, busca filas existentes por UUID, nombre de negocio (insensible a mayúsculas `ilike`) o código único antes de realizar un `INSERT`. -->
   - Perform an `UPDATE` in-place when a matching record exists to prevent orphaned duplicate records.
   <!-- Ejecuta un `UPDATE` en sitio cuando exista un registro coincidente para evitar registros duplicados huérfanos. -->

4. **Triple-Identifier Deletion & Exclusion Sets**:
   <!-- Borrado por Triple Identificador y Conjuntos de Exclusión -->
   - When deleting entities that originate from mock/seed arrays, delete in PostgreSQL by UUID, by slug, and by business title/code.
   <!-- Al eliminar entidades que provienen de arrays semilla/mock, elimina en PostgreSQL por UUID, por slug y por título/código de negocio. -->
   - Maintain a `DELETED_KEY` in `localStorage` and `eliminadosMemoria` in Server Actions so deleted items NEVER resurrect upon server cold starts or page refreshes.
   <!-- Mantén un `DELETED_KEY` en `localStorage` y `eliminadosMemoria` en Server Actions para que los elementos eliminados NUNCA resuciten tras reinicios de servidor o recargas de página. -->

5. **Mandatory Idempotent SQL Delivery**:
   <!-- Entrega Obligatoria de SQL Idempotente -->
   - Always provide the user with the exact, copy-pasteable SQL snippet with `CREATE OR REPLACE FUNCTION` using `SECURITY DEFINER` and `SET search_path`, table DDLs, and `GRANT EXECUTE` permissions to `anon, authenticated, service_role` so remote databases can be updated in 1 click.
   <!-- Proporciona siempre al usuario el script SQL exacto y listo para copiar/pegar con `CREATE OR REPLACE FUNCTION` usando `SECURITY DEFINER` y `SET search_path`, DDLs de tablas y permisos `GRANT EXECUTE` a `anon, authenticated, service_role` para actualizar bases de datos remotas en 1 clic. -->

---

## 2. Implementation Checklist
<!-- 2. Lista de Chequeo de Implementación -->

* [ ] Server Action exports `async` functions with proper typing and multi-identifier mapping (`MAPA_ID_A_SLUG`).
* [ ] Database write operations verify both `schema("<name>").rpc(...)` and fallback table mutations.
* [ ] SQL functions are declared with `SECURITY DEFINER` and have `GRANT EXECUTE` to `anon, authenticated, service_role`.
* [ ] Errors from Supabase are caught and propagated in `{ ok: false, error: ... }`.
* [ ] React component utilizes `localStorage` cache (`CACHE_KEY`) on load and on save, and filters by `DELETED_KEY`.
* [ ] Migration file created in `supabase/migrations/YYYYMMDD_*.sql`.
* [ ] Reference standard [`gobernanza/estandares/06-guia-implementacion-funcionalidades-persistencia-rpc.md`](../../gobernanza/estandares/06-guia-implementacion-funcionalidades-persistencia-rpc.md).
