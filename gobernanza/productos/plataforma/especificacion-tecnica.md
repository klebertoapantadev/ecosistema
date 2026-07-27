---
tipo: esp_tecnica
estado: vigente
version: 1.3
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Plataforma — Especificación Técnica Común

Contraparte técnica de [`especificacion-funcional.md`](especificacion-funcional.md). Este documento es un **índice con estado**, no redefine lo que ya vive en ADRs y políticas — apunta a la fuente y dice qué está construido y qué falta.

## 1. `comun_seguridad` — implementa PLT-001, PLT-002, PLT-003, PLT-011

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `seg_usuario` | `usu_` | ✅ Migrada (`20260727000002`). Incluye `usu_superadmin_plataforma`, `usu_autorizacion_whatsapp` y `usu_onboarding_completo` (`20260727000005`). |
| `seg_membresia` | `mem_` | ✅ Migrada. `unique (mem_usuario_id, mem_negocio)` — una membresía por usuario y negocio. Auto-alta como `CLIENTE` habilitada por política (`20260727000004`). |

Aprovisionamiento: trigger `comun_seguridad.seg_fn_provisionar_usuario()` sobre `auth.users` — toda alta crea automáticamente su fila en `seg_usuario`, incluyendo `usu_nombres`/`usu_apellidos` desde los metadatos del proveedor (`20260727000007` — antes solo quedaban en el JSONB de detalle, no en columna). El correo `kleber.toapanta.ch@gmail.com` queda marcado `usu_superadmin_plataforma = true` desde su primer login real (bootstrap, sin asignación manual).

Asignación de rol: RPC transaccional `seg_fn_asignar_rol(usuario, negocio, rol)` (`20260727000004`) — nunca `UPDATE` directo, ver regla 5 de `AGENTS.md`.

**Fix de seguridad (`20260727000006`):** la política de `UPDATE` de `seg_usuario` permitía escribir cualquier columna de la propia fila, incluida `usu_superadmin_plataforma` — un usuario podía auto-otorgarse SuperAdmin. Cerrado con `GRANT UPDATE` por columna (ver [`politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §9). Verificado con `information_schema.column_privileges` tras aplicar.

MFA (PLT-002): Supabase Auth TOTP, exigido vía claim `aal` en políticas RLS — ver [`politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §3. **Pendiente todavía** — las políticas actuales no exigen `aal2` porque ningún flujo crítico se ha implementado aún.
Rol en JWT: *Custom Access Token Hook* — pendiente de implementar. Mientras no exista, las políticas RLS resuelven el rol consultando `seg_membresia` directamente (vía `comun_seguridad.seg_fn_es_admin_negocio()`), no desde un claim del token.

### 1.1. Sistema de widgets (PLT-011)

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `seg_widget` | `wdg_` | ✅ Migrada. Catálogo de funcionalidades por negocio (`unique (wdg_negocio, wdg_clave)`). |
| `seg_rol_widget` | `rlw_` | ✅ Migrada. Asignación dinámica widget↔rol (`unique (rlw_negocio, rlw_rol, rlw_widget_id)`). |

Seed aplicado: widget `gestion_usuarios` en los 4 negocios, asignado por defecto al rol `ADMINISTRADOR`. `SUPERADMIN` (vía `usu_superadmin_plataforma`) no necesita fila en `seg_rol_widget` — `seg_fn_es_admin_negocio()` lo autoriza siempre.

✅ Consumido en `tranqi-web`: el panel arma su navegación dinámicamente a partir de `seg_rol_widget` — ver `app/panel/layout.tsx`. **Pendiente:** UI para que un admin marque/desmarque widgets por rol desde la consola (hoy solo se edita por SQL/seed).

### 1.2. Bienvenida post-registro (PLT-001 regla 2)

Confirmación de nombre/apellido (Google no siempre los da claros — ej. cuentas de correo comerciales) + autorización opt-in de contacto por WhatsApp. `usu_onboarding_completo` evita repetir la pantalla. ✅ Implementado en `tranqi-web` (`app/bienvenida/`), verificado de punta a punta contra el proyecto real: login → bienvenida → guarda `usu_nombres`/`usu_apellidos`/`usu_whatsapp`/`usu_autorizacion_whatsapp` → panel muestra el nombre confirmado, no el correo.

## 2. `comun_agentes` — implementa PLT-004

Ver [ADR-0002](../../arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md) para el esquema completo (`age_agente_conversacional`) y `packages/agentes-ia` para el cliente compartido.

**Estado actual:** `packages/agentes-ia` construido y en uso por `tranqi-web`, resolviendo el agente vía variables de entorno (`ARIA_BASE`/`ARIA_AGENT_ID`/`ARIA_AGENT_KEY`). La tabla `comun_agentes.age_agente_conversacional` (que permitiría un agente distinto por producto+rol sin hardcodear env vars) **todavía no existe** — es la siguiente pieza a migrar cuando un segundo producto necesite un agente propio.

## 3. `comun_auditoria` — implementa PLT-005

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `aud_registro` | `reg_` | ✅ Migrada (`20260727000001_comun_auditoria.sql`). |
| `aud_log_api` | `log_` | ✅ Migrada. Sin escritores todavía (ninguna Edge Function la usa aún). |

Función `aud_fn_auditar_tabla()`: ✅ implementada y aplicada como trigger en las 8 tablas de `comun_seguridad`/`comun_configuracion` creadas hasta ahora. Obligatoria en toda tabla de negocio nueva desde el momento en que exista (ver [`estandares/00-nomenclatura-base-datos.md`](../../estandares/00-nomenclatura-base-datos.md)). Lectura de `aud_registro`/`aud_log_api` restringida a `usu_superadmin_plataforma` — visibilidad acotada por negocio para `ADMINISTRADOR` queda pendiente de diseñar (requiere mapear esquema→negocio).

## 4. `comun_facturacion` — implementa PLT-006

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `fac_factura_sri` | `fac_` | Definida en el TRD original. Migración pendiente. |
| `fac_transaccion_pago` | `pag_` | Definida en el TRD original. Migración pendiente. |

## 5. `comun_catalogo` — implementa PLT-007

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `cat_provincia` | `pvc_` | Diseñada en el plan de Tranqi Entregable 1. Migración pendiente. |
| `cat_ciudad` | `ciu_` | Diseñada en el plan de Tranqi Entregable 1. Migración pendiente. |

## 7. `comun_comercio` — implementa PLT-009, PLT-010

Ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md) para el esquema completo (`com_categoria`, `com_producto`, `com_variante`, `com_media`, y las tablas de personalización/adicionales) y las políticas de RLS con lectura pública de catálogo activo.

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `com_categoria` | `ctg_` | Diseñada en ADR-0003. Migración pendiente. |
| `com_producto` | `pro_` | Diseñada en ADR-0003. Migración pendiente. |
| `com_variante` | `var_` | Diseñada en ADR-0003. Migración pendiente. |
| `com_media` | `med_` | Diseñada en ADR-0003. Migración pendiente. |
| `com_personalizacion_campo` | `pzc_` | Pendiente de diseño detallado (se hace junto con la implementación). |
| `com_adicional` | `adc_` | Pendiente de diseño detallado. |
| `com_variante_adicional` | `van_` | Pendiente de diseño detallado. |

**Ningún negocio tiene tabla de producto propia.** `margaritas_floristeria` y `tinkay_floristeria` consumen este esquema — ver corrección aplicada el mismo día en `margaritas/especificacion-tecnica.md`.

### 7.1. Integración omnicanal (PLT-010)

| Pieza | Estado |
| :--- | :--- |
| `GET /api/comercio/feed/{negocio}` (feed Meta Commerce Manager) | Pendiente — se construye junto con `comun_comercio` |
| `packages/comercio` (armado de link de WhatsApp, resolución de precio final) | Pendiente — mismo patrón que `packages/agentes-ia` |
| Endpoints de consulta para el Buddie | Pendiente — reutiliza `packages/agentes-ia`, agrega función de lectura de catálogo |

## 9. `comun_configuracion` — implementa PLT-008, PLT-011

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `cfg_negocio` | `cfg_` | ✅ Migrada (`20260727000003_comun_configuracion.sql`). Identificación/NIT, nombre comercial, razón social en columnas propias; redes sociales, canales, términos y locales en `cfg_detalle_configuracion` (JSONB) hasta que su volumen justifique tablas propias. |

Seed aplicado: una fila por negocio (`tranqi`, `fastfix`, `tinkay`, `margaritas`) con nombre comercial, el resto vacío. Lectura pública (es información de vitrina), escritura restringida a `ADMINISTRADOR`/`SUPERADMIN` del negocio. ✅ Consumido: `app/panel/configuracion/` en `tranqi-web`.

## 10. Tabla resumen de estado (para no perder el hilo)

| Esquema común | Migración SQL | Función/lógica asociada | Consumido hoy por |
| :--- | :--- | :--- | :--- |
| `comun_seguridad` | ✅ Aplicada (7 migraciones) | ⚠️ Custom Access Token Hook pendiente (RLS resuelve rol vía subconsulta por ahora) | `tranqi-web` — registro, bienvenida, gestión de usuarios |
| `comun_agentes` | ❌ Pendiente (tabla) | ✅ `packages/agentes-ia` (vía env vars) | `tranqi-web` |
| `comun_auditoria` | ✅ Aplicada | ✅ `aud_fn_auditar_tabla()` en las 9 tablas nuevas | `comun_seguridad`, `comun_configuracion` |
| `comun_configuracion` | ✅ Aplicada | — | `tranqi-web` — configuración del negocio |
| `comun_facturacion` | ❌ Pendiente | — | Ninguno todavía |
| `comun_catalogo` | ❌ Pendiente | — | Ninguno todavía |
| `comun_comercio` | ❌ Pendiente | ❌ `packages/comercio` pendiente | Ninguno todavía (bloqueante para Tinkay/Margaritas) |

**Proyecto Supabase de origen de todo lo `✅ Aplicada`:** `ecosistema` (`oaybbpdxhlxjbpwnoymy`). Migraciones `20260727000001` a `20260727000007` en `supabase/migrations/`.

**Proyecto Supabase:** `ecosistema` (`oaybbpdxhlxjbpwnoymy`) — ver [`arquitectura/inventario-supabase.md`](../../arquitectura/inventario-supabase.md). Las 3 migraciones aplicadas viven en `supabase/migrations/` con timestamp `20260727000001`–`20260727000003`.

**Paso manual pendiente, fuera de SQL:** en el dashboard de Supabase → Settings → API → *Exposed schemas*, agregar `comun_seguridad`, `comun_auditoria`, `comun_configuracion` — sin esto, PostgREST no expone estos esquemas y `supabase-js` no puede consultarlos aunque las migraciones ya estén aplicadas.
