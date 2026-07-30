---
tipo: informe_tecnico
estado: vigente
version: 1.0
fecha: 2026-07-30
responsable: Arquitecto de Software Cloud & AI Agents
---

# Informe Técnico 01 — Diagnóstico de Arquitectura, Evaluación y Hoja de Ruta de Mejoras

## 1. Resumen Ejecutivo y Veredicto Técnico

**Veredicto:** **El proyecto se encuentra BIEN ejecutado y estructurado bajo estándares de ingeniería Enterprise Grade.**

El ecosistema de aplicaciones (**Tranqi**, **FastFix Home**, **Tinkay** y **Margaritas Floristería**) cuenta con una arquitectura de desacoplamiento limpia, patrones defensivos bien aplicados a nivel de base de datos (PostgreSQL/Supabase) y una modularidad sostenible mediante monorepo. No presenta problemas de diseño estructural ni "código espagueti". 

Este informe documenta la arquitectura actual, los aciertos de ingeniería y la **hoja de ruta priorizada** para que cualquier desarrollador o agente de IA pueda ejecutar las mejoras técnicas identificadas sin romper la continuidad del sistema.

---

## 2. Descripción de la Arquitectura Actual

```
                      ┌─────────────────────────────────────────────────────────┐
                      │              MONOREPO MODULAR (pnpm + Turbo)            │
                      └─────────────────────────────────────────────────────────┘
                                                   │
         ┌──────────────────┬──────────────────────┼──────────────────────┐
         ▼                  ▼                      ▼                      ▼
  [ tranqi-web ]     [ fastfix-web ]        [ tinkay-web ]       [ margaritas-web ]
  (Next.js 15 App)   (Next.js 15 App)      (Next.js 15 App)     (Next.js 15 App)
         │                  │                      │                      │
         └──────────────────┴──────────┬───────────┴──────────────────────┘
                                       │
                                       ▼
                       ┌──────────────────────────────┐
                       │     PACKAGES COMPARTIDOS     │
                       │ @eco/supabase, @eco/identidad│
                       │ @eco/agentes-ia, etc.        │
                       └──────────────┬───────────────┘
                                      │
                                      ▼
             ┌──────────────────────────────────────────────────┐
             │       SUPABASE POSTGRESQL (INSTANCIA ÚNICA)      │
             │        Aislamiento por Esquemas de BDD           │
             ├──────────────────────────────────────────────────┤
             │ comun_seguridad     │ comun_auditoria            │
             │ comun_configuracion │ comun_facturacion          │
             │ tranqui_legal       │ fastfix_mantenimiento      │
             │ tinkay_floristeria  │ margaritas_floristeria     │
             └──────────────────────────────────────────────────┘
```

1. **Monorepo Modular (Turborepo + pnpm workspaces):**
   - Aplicaciones alojadas en `apps/*` (`tranqi-web`, `fastfix-web`, `tinkay-web`, `margaritas-web`).
   - Librerías y utilidades compartidas en `packages/*` (`@eco/supabase`, `@eco/identidad`, `@eco/agentes-ia`, `@eco/configuracion-negocio`, `@eco/gestion-usuarios`, etc.).
2. **Patrón Database-per-Domain / Database-per-Business (Nivel Esquema BDD):**
   - Operación inicial sobre una sola instancia de Supabase PostgreSQL aislada por esquemas de base de datos.
   - **Desacoplamiento sin FKs físicas cruzadas:** Los esquemas de negocio (`tranqui_legal`, `fastfix_mantenimiento`, `tinkay_floristeria`, `margaritas_floristeria`) referencian el identificador del usuario (`usu_id` UUID) de forma lógica, sin `FOREIGN KEY` duras hacia `comun_seguridad.seg_usuario`. Esto garantiza la posibilidad de extraer cualquier negocio hacia una base de datos independiente en el futuro.
3. **BaaS + Jamstack Serverless (Next.js 15 App Router + Supabase):**
   - Server Components, Server Actions (`"use server"`) e integración directa con funciones RPC `SECURITY DEFINER` en PostgreSQL.
4. **RBAC Jerárquico + Sistema Dinámico de Widgets:**
   - Control de acceso basado en membresías de negocio (`seg_membresia`), escala jerárquica de perfiles ($1$ a $100$) y matriz de permisos Perfil-Widget (`seg_widget` / `seg_rol_widget`) bajo gobernanza exclusiva del `SUPERADMIN`.
5. **Auditoría Inmutable por Triggers BDD:**
   - Auditoría automática mediante triggers PostgreSQL (`aud_fn_auditar_tabla()`) en operaciones `INSERT`, `UPDATE` y `DELETE` guardando deltas `JSONB`.

---

## 3. Matriz de Evaluación Técnica: Aciertos vs. Deuda Técnica

### A. Aciertos de Ingeniería (Puntos Fuertes)
- **Seguridad Defensiva en BDD:** Revocación de `UPDATE` a nivel de tabla completa y uso de `GRANT UPDATE` explícito por columna (`20260727000006_*.sql`).
- **Registro Ultra-Fluido:** Autenticación OAuth Google 1-clic y formulario por correo de 4 campos sin frenos de WhatsApp en el primer paso.
- **Auditoría Transparente:** Instrumentación automática en base de datos sin depender del código frontend/backend.
- **Aislamiento Multitenant:** Membresías e identificador de negocio (`com_negocio`: `TRANQ`, `FFH`, `TNK`, `MRG`) aislados por producto.

### B. Deuda Técnica y Riesgos Identificados

| # | Componente | Riesgo / Deuda Técnica | Impacto |
| :-: | :--- | :--- | :--- |
| **1** | **Componente DataGrid UI** | No existe un paquete UI compartido (`packages/ui`) para DataGrids. `gestion_usuarios` usa una tabla HTML simple. | Alto — Impide cumplir `PLT-011` (búsqueda en 2 capas, agrupamiento, exportación Excel). |
| **2** | **Rendimiento RLS** | Las políticas RLS ejecutan subconsultas a `seg_membresia` mediante `seg_fn_es_admin_negocio()`. | Medio — Puede degradar latencia en lecturas masivas. |
| **3** | **Esquema `comun_comercio`** | El esquema de catálogo comercial (`PLT-009`) sigue en estado "pendiente de migración". | Bloqueante — Impide avanzar el checkout de Tinkay y Margaritas. |
| **4** | **Exposed Schemas en Supabase** | Los esquemas `comun_seguridad`, `comun_auditoria`, `comun_configuracion` requieren habilitación manual en API Settings de Supabase. | Bajo/Configurativo — Provoca errores de PostgREST si no está expuesto. |

---

## 4. Hoja de Ruta de Implementación de Mejoras (Guía para Agentes AI e Ingenieros)

Cualquier agente de IA o ingeniero que asuma tareas de desarrollo en el repositorio debe seguir la siguiente secuencia priorizada:

### Tarea 1: Creación del Paquete Compartido `@eco/ui` con DataGrid Interactivo
- **Ubicación:** `packages/ui` (o integrar en `@eco/primitivas`).
- **Objetivo:** Construir el componente `DataGrid` reutilizable basado en TanStack Table (React Table v8).
- **Requerimiento (`PLT-011`):**
  - **Capa 1 (Server-Side BDD):** Filtros primarios (Rango de fechas, correo, nombres, rol, estado, técnico/abogado) pasados como query params a Supabase Client.
  - **Capa 2 (Client-Side Search):** Caja de búsqueda in-memory sobre el dataset devuelto en todas las columnas.
  - Ordenamiento, drag-and-drop de columnas, agrupamiento dinámico y exportación a `.xlsx` (`xlsx` / `exceljs`).

### Tarea 2: Optimización de RLS con Custom Access Token Hook
- **Ubicación:** Supabase Auth Hooks.
- **Objetivo:** Inyectar las membresías y roles del usuario directamente en las claims del JWT de sesión.
- **Efecto:** Sustituir la subconsulta a `seg_membresia` por `(auth.jwt() -> 'user_metadata' ->> 'roles')` en las políticas RLS, reduciendo drásticamente las lecturas en PostgreSQL.

### Tarea 3: Migración e Implementación del Esquema `comun_comercio` (`PLT-009`)
- **Ubicación:** `supabase/migrations/`
- **Objetivo:** Crear las tablas `com_categoria`, `com_producto`, `com_variante`, `com_media`, `com_cupon` e implementar el motor centralizado de comercio para Tinkay y Margaritas.

### Tarea 4: Implementación del Widget `emision_notificaciones` (`PLT-013`)
- **Ubicación:** `packages/notificaciones` / `apps/*/modulos/notificaciones`
- **Objetivo:** UI de emisión segmentada (`TODOS`, `POR_ROL`, `POR_USUARIOS`), selección multicanal (`IN_APP`, `EMAIL`, `PUSH`) y Editor WYSIWYG Rich Text HTML + Markdown con Live Preview.

---

## 5. Instrucciones de Contexto para Agentes de IA Futuros

1. **Nomenclatura Estricta:** Todo identificador técnico de base de datos (esquemas, tablas, columnas, funciones, triggers, indices) DEBE redactarse en **Español sin caracteres especiales, acentos ni la letra `ñ`**.
2. **Modificación de Filas de Usuario:** Toda tabla auto-editable por el propio usuario debe revocar `UPDATE` global y aplicar `GRANT UPDATE (columna_a, columna_b)` explícito.
3. **RPC Transaccionales:** No ejecutar `UPDATE` directo sobre columnas de rol o estado sensible; encapsular siempre en procedimientos RPC con `SECURITY DEFINER`.
4. **Verificación Empírica:** Antes de declarar una tarea completada, ejecutar `npm run typecheck`, `npm run lint` y verificar que las migraciones SQL compilen limpiamente.
