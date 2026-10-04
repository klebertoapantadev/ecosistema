# Regla Obligatoria: Persistencia BDD, Resiliencia Híbrida y Cero Pérdida de Datos

Esta regla es de estricto cumplimiento para todo agente de IA y desarrollador en el monorepo del Ecosistema.

---

## 1. Prohibido Retornar Éxito Ficticio (`ok: true`) ante Fallos de BDD
* **Nunca suprimir errores silenciosamente**: Queda estrictamente prohibido capturar excepciones de base de datos (`try { ... } catch {}`) y retornar `{ ok: true }` basándose únicamente en mutaciones en memoria RAM efímera del servidor (`storeMemoria`).
* Si una operación de guardado o actualización falla en PostgreSQL/Supabase (por RLS, falta de RPC, tipos de columna o conexión), la Server Action **DEBE reportar el error real** (`{ ok: false, error: err.message }`) para que la interfaz alerte al usuario y no genere la falsa ilusión de persistencia.

---

## 2. Patrón de Resiliencia Híbrida (LocalStorage + PostgreSQL)
Para componentes operativos y widgets del panel donde el usuario edita parámetros de negocio, convenios, perfiles o tarifas:
1. **Lectura Instantánea y Resiliente (`cargarDatos`)**:
   * Cargar inmediatamente el caché de `localStorage.getItem(...)` si existe para visualización instantánea (0ms).
   * Consultar en paralelo la base de datos vía Server Action (`obtener...Action`).
   * Si la base de datos retorna datos válidos, refrescar el estado y actualizar el `localStorage`.
2. **Escritura Transaccional Inmediata (`handleGuardar`)**:
   * Al recibir la confirmación de guardado, persistir de inmediato la lista actualizada tanto en el estado de React como en `localStorage.setItem(...)`.
   * Esto garantiza que aunque el servidor se reinicie, ocurra una recarga forzada (`F5`) o la migración esté pendiente en la instancia remota de Supabase, **los cambios jamás se perderán ni revertirán**.

---

## 3. Entrega Mandatoria de Script SQL Idempotente
* Cuando una funcionalidad requiera nuevas tablas, funciones RPC o columnas en Supabase, el agente DEBE:
  1. Crear la migración formal en `supabase/migrations/`.
  2. **Proporcionar al usuario el bloque SQL consolidado, idempotente y listo para copiar/pegar en el SQL Editor de Supabase**, explicando claramente qué hace y otorgando permisos de ejecución a `anon, authenticated, service_role`.

---

## 4. Búsqueda y Actualización In Situ (Evitar Duplicados)
* Toda función de actualización en SQL o TypeScript debe resolver registros existentes no solo por UUID exacto, sino también por claves de negocio alternativas (ej. `lower(empresa_nombre)`, `ruc`, `slug`), ejecutando siempre un `UPDATE` en lugar de un `INSERT` huérfano.

---

## 5. Ciclo de Vida de Eliminación y Prevención de Resurrección de Semillas
* **Triple Identificador**: Todo borrado (`DELETE` o `eliminar...Action`) debe buscar y eliminar por `UUID`, por `slug` y por `título/código único`.
* **Registro de Exclusión (`DELETED_KEY` & `eliminadosMemoria`)**: Tanto en cliente (`localStorage`) como en memoria de la Server Action se debe mantener un conjunto de exclusión de elementos borrados para que datos semilla nunca resuciten tras un reinicio de servidor o recarga de página.
* Ver guía completa en [`gobernanza/estandares/06-guia-implementacion-funcionalidades-persistencia-rpc.md`](../../gobernanza/estandares/06-guia-implementacion-funcionalidades-persistencia-rpc.md).
