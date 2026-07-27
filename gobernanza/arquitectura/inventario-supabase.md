---
tipo: arquitectura
estado: vigente
version: 1.1
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Inventario del Proyecto Supabase Compartido

## Regla que no se negocia

El ecosistema usa un **proyecto Supabase dedicado**, separado de cualquier otro sistema. Nunca se comparte instancia con una base de datos operativa ajena a este monorepo.

## Proyecto activo del ecosistema

| Campo | Valor |
| :--- | :--- |
| Nombre | `ecosistema` |
| Project ref | `oaybbpdxhlxjbpwnoymy` |
| Organización | `kt-services` (`kkldgqzmawzeagpymple`) |
| Región | `ca-central-1` |
| Postgres | 17.6.1 |
| Creado | 2026-07-27 |

## Proyecto descartado — NO usar, NO tocar

Al arrancar Sprint 0 se encontró primero `kleber.toapanta.ch@gmail.com's Project` (`ufnpzxlvpwagavoytwco`, creado 2025-08-03, región `us-east-2`) ya conectado vía MCP. **Decisión del usuario: no usarlo.** Es la base de datos real y operativa de Tinkay (fuera de este monorepo, sin relación con esta gobernanza) — ver hallazgo íntegro más abajo, conservado como referencia histórica. El ecosistema completo vive exclusivamente en el proyecto `oaybbpdxhlxjbpwnoymy` de la tabla de arriba.

### Hallazgo en el proyecto descartado (2026-07-26, no se tocó nada)

| Tabla | Filas | RLS | Nota |
| :--- | :--- | :--- | :--- |
| `tinkay_clientes` | 125,107 | ✅ habilitado | Volumen real — probable operación viva |
| `tinkay_ventas` | 1,761 | ✅ habilitado | |
| `tinkay_chats` | 35,055 | ✅ habilitado | |
| `tinkay_campos_chats` | 29,562 | ✅ habilitado | "detalles del proceso de ventas con el cliente" |
| `productos` | 1 | ✅ habilitado | |
| `tinkay_ventas_old` | 1,044 | ❌ **deshabilitado** | Expuesta a `anon key` sin restricción |
| `tinkay_ventas_duplicados` | 215 | ❌ **deshabilitado** | Expuesta a `anon key` sin restricción |
| `documents` | 7 | ❌ **deshabilitado** | Contenido sin identificar |
| `documents_old` | 7 | ❌ **deshabilitado** | Contenido sin identificar |
| `n8n_chat_histories` | 1,555 | ❌ **deshabilitado** | Historial de chats — probable integración n8n |
| `n8n_campos_chat` | 1 | ❌ **deshabilitado** | |
| `vectors` | 0 | ❌ **deshabilitado** | `pgvector` instalado — probable pipeline RAG |

**Hallazgo de seguridad sin remediar (decisión explícita del usuario, 2026-07-26):** 7 tablas con RLS deshabilitado, expuestas a la `anon key`, dos de ellas con datos de ventas/chat. **No se investiga ni se toca** — fuera de alcance de este ecosistema por instrucción directa. Si en el futuro se decide abordarlo, es una tarea separada y explícita, no un efecto colateral de trabajar en `comun_*`.

Extensiones relevantes ya instaladas en el proyecto (heredadas, no instaladas por este ecosistema): `vector` (pgvector), `pgcrypto`, `uuid-ossp`, `unaccent`, `pg_stat_statements`, `hypopg`, `index_advisor`, `supabase_vault`.

## Esquemas del ecosistema (este documento se actualiza en el mismo PR que aplica cada migración)

| Esquema | Estado |
| :--- | :--- |
| `comun_auditoria` | ✅ Creado 2026-07-27 (`20260727000001`) |
| `comun_seguridad` | ✅ Creado 2026-07-27 (`20260727000002`) |
| `comun_configuracion` | ✅ Creado 2026-07-27 (`20260727000003`) |
| `comun_facturacion` | Pendiente de crear |
| `comun_catalogo` | Pendiente de crear |
| `comun_agentes` | Pendiente de crear |
| `comun_comercio` | Pendiente de crear |
| `tranqui_legal` | Pendiente de crear |
| `fastfix_mantenimiento` | Pendiente de crear |
| `tinkay_floristeria` | Pendiente de crear — **nombre nuevo, no reutiliza ninguna tabla `tinkay_*` de `public`** |
| `margaritas_floristeria` | Pendiente de crear |

**Exposed schemas: ✅ hecho** (2026-07-27) — `comun_seguridad`, `comun_auditoria`, `comun_configuracion` accesibles vía PostgREST/`supabase-js`.

## Migraciones aplicadas

| Migración | Contenido |
| :--- | :--- |
| `20260727000001_comun_auditoria` | `aud_registro`, `aud_log_api`, `aud_fn_auditar_tabla()` |
| `20260727000002_comun_seguridad` | `seg_usuario`, `seg_membresia`, `seg_widget`, `seg_rol_widget`, trigger de aprovisionamiento, `seg_fn_es_admin_negocio()` |
| `20260727000003_comun_configuracion` | `cfg_negocio` (PLT-008) |
| `20260727000004_seg_registro_y_asignacion_rol` | Política de auto-alta como `CLIENTE`, RPC `seg_fn_asignar_rol()` |
| `20260727000005_seg_bienvenida` | `usu_autorizacion_whatsapp`, `usu_onboarding_completo` (PLT-001 regla 2) |
| `20260727000006_seg_usuario_restringir_columnas_update` | **Fix de seguridad**: cierra escalación de privilegios vía `PATCH` directo — ver [`politicas/seguridad-y-datos.md`](../politicas/seguridad-y-datos.md) §9 |
| `20260727000007_seg_provisionar_usuario_nombres_columna` | El trigger ahora puebla `usu_nombres`/`usu_apellidos` en columna, no solo en JSONB |

Tipos TypeScript regenerados en cada una — ver `packages/db/src/tipos-generados.ts`.

Verificado de punta a punta contra el proyecto real (no simulado): registro por correo, confirmación de correo, login, bienvenida, panel, gestión de usuarios. Cuentas de prueba (`prueba.sprint0*.ecosistema@gmail.com`) eliminadas tras la verificación.
