---
tipo: esp_tecnica
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tranqi — Especificación Técnica

**Prefijo de tabla:** `trq_` · **Esquema:** `tranqui_legal` · **Modelo de entrega:** escrow documental (ver [ADR-0001](../../arquitectura/adr/0001-monorepo-y-modelo-de-entrega.md))

## Tablas (Entregable 1)

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `trq_solicitud_socio` | `ssc_` | Diseñada, pendiente de migración |
| `trq_experiencia_laboral` | `exp_` | Diseñada, pendiente de migración |
| `trq_documento_socio` | `dcs_` | Diseñada, pendiente de migración |
| `trq_materia` | `mat_` | Diseñada, pendiente de migración |
| `trq_solicitud_materia` | `sma_` | Diseñada, pendiente de migración |
| `trq_solicitud_provincia` | `spr_` | Diseñada, pendiente de migración |
| `trq_revision_solicitud` | `rev_` | Diseñada, pendiente de migración |
| `trq_abogado` | `abg_` | Definida en el TRD original, pendiente de migración |

Diseño completo, máquina de estados y decisiones de modelado: ver `Plan_Entregable_1_Tranqi_Identidad_Socios.md` en la raíz del proyecto — se traslada aquí a medida que cada tabla se migra.

## Dependencias de esquemas comunes

- `comun_seguridad.seg_usuario` / `seg_membresia` — identidad y rol. ✅ Migrado y en uso (registro, bienvenida, gestión de usuarios, consentimiento de términos, baja de cuenta) — ver [`especificacion-tecnica.md` de Plataforma](../plataforma/especificacion-tecnica.md) §1 y §1.3.
- `comun_configuracion.cfg_negocio` — ✅ Migrado y en uso (pantalla de configuración del negocio).
- `comun_catalogo.cat_provincia` / `cat_ciudad` — residencia y cobertura. ❌ Pendiente.
- `comun_auditoria` — vía `aud_fn_auditar_tabla()`. ✅ Migrado, aplicado a las tablas de `comun_seguridad`/`comun_configuracion`; pendiente en las 8 tablas propias de Tranqi (`trq_*`) cuando se migren.

## Notas de seguridad específicas de Tranqi

- Cédula y matrícula profesional: `pgp_sym_encrypt`, enmascaradas por defecto.
- Envío de solicitud requiere `aal2` (MFA verificado) en política RLS.
- Rol `ABOGADO` no otorga capacidades sin `trq_abogado` en estado verificado — ver [`gobernanza/politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §4.
