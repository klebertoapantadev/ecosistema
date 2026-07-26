---
tipo: esp_tecnica
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Plataforma — Especificación Técnica Común

Contraparte técnica de [`especificacion-funcional.md`](especificacion-funcional.md). Este documento es un **índice con estado**, no redefine lo que ya vive en ADRs y políticas — apunta a la fuente y dice qué está construido y qué falta.

## 1. `comun_seguridad` — implementa PLT-001, PLT-002, PLT-003

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `seg_usuario` | `usu_` | Definida en el TRD original. Migración pendiente (Sprint 0). |
| `seg_membresia` | `mem_` | Definida en el TRD original. Migración pendiente (Sprint 0). |

MFA (PLT-002): Supabase Auth TOTP, exigido vía claim `aal` en políticas RLS — ver [`politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §3.
Rol en JWT: *Custom Access Token Hook* — pendiente de implementar (Sprint 0/1).

## 2. `comun_agentes` — implementa PLT-004

Ver [ADR-0002](../../arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md) para el esquema completo (`age_agente_conversacional`) y `packages/agentes-ia` para el cliente compartido.

**Estado actual:** `packages/agentes-ia` construido y en uso por `tranqi-web`, resolviendo el agente vía variables de entorno (`ARIA_BASE`/`ARIA_AGENT_ID`/`ARIA_AGENT_KEY`). La tabla `comun_agentes.age_agente_conversacional` (que permitiría un agente distinto por producto+rol sin hardcodear env vars) **todavía no existe** — es la siguiente pieza a migrar cuando un segundo producto necesite un agente propio.

## 3. `comun_auditoria` — implementa PLT-005

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `aud_registro` | `reg_` | Definida en el TRD original. Migración pendiente. |
| `aud_log_api` | `log_` | Definida en el TRD original. Migración pendiente. |

Función `aud_fn_auditar_tabla()`: pendiente de implementar. Obligatoria en toda tabla de negocio nueva desde el momento en que exista (ver [`estandares/00-nomenclatura-base-datos.md`](../../estandares/00-nomenclatura-base-datos.md)).

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

## 6. Tabla resumen de estado (para no perder el hilo)

| Esquema común | Migración SQL | Función/lógica asociada | Consumido hoy por |
| :--- | :--- | :--- | :--- |
| `comun_seguridad` | ❌ Pendiente | ❌ Custom Access Token Hook pendiente | Ninguno todavía (bloqueante para Sprint 1 de Tranqi) |
| `comun_agentes` | ❌ Pendiente (tabla) | ✅ `packages/agentes-ia` (vía env vars) | `tranqi-web` |
| `comun_auditoria` | ❌ Pendiente | ❌ `aud_fn_auditar_tabla()` pendiente | Ninguno todavía |
| `comun_facturacion` | ❌ Pendiente | — | Ninguno todavía |
| `comun_catalogo` | ❌ Pendiente | — | Ninguno todavía |

**Ninguna migración de base de datos existe aún en `supabase/migrations/`.** Este documento se actualiza en el mismo PR que aplique cada migración — no antes, no después.
