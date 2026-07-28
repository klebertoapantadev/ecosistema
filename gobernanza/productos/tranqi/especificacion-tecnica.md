---
tipo: esp_tecnica
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tranqi — Especificación Técnica

**Prefijo de tabla:** `trq_` · **Esquema:** `tranqui_legal` · **Modelo de entrega:** escrow documental (ver [ADR-0001](../../arquitectura/adr/0001-monorepo-y-modelo-de-entrega.md))

## Tablas (TRQ-001, socios)

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `trq_solicitud_socio` | `ssc_` | ✅ Migrada (`20260728000002`) |
| `trq_experiencia_laboral` | `exp_` | ✅ Migrada |
| `trq_documento_socio` | `dcs_` | ✅ Migrada — modelada, sin UI de carga (sin bucket de Storage todavía) |
| `trq_materia` | `mat_` | ✅ Migrada, con seed (12 especialidades) |
| `trq_solicitud_materia` | `sma_` | ✅ Migrada |
| `trq_solicitud_provincia` | `spr_` | ✅ Migrada |
| `trq_revision_solicitud` | `rev_` | ✅ Migrada |
| `trq_abogado` | `abg_` | ✅ Migrada — incluye `abg_mfa_verificado` (hook para PLT-002, ver especificacion-funcional.md) |

`comun_catalogo.cat_provincia` (`cat_`) — ✅ Migrada (`20260728000001`), esquema y tabla nuevos,
compartidos con cualquier negocio que necesite ubicación. Seed: 24 provincias de Ecuador.

**RPC:** `tranqui_legal.trq_fn_decidir_solicitud(p_solicitud_id, p_decision, p_comentario)` —
transaccional, `SECURITY DEFINER`, valida admin de `tranqi` internamente. Al aceptar: crea `trq_abogado`
+ llama a `comun_seguridad.seg_fn_asignar_rol` (rol `ABOGADO`). Ningún cliente puede hacer `UPDATE`
directo sobre `ssc_estado` — solo este RPC.

**Widget de panel:** `socios` (negocio `tranqi`, visible para `ADMINISTRADOR`) — sembrado en la misma
migración, sigue el patrón de `gestion_usuarios`/`configuracion_negocio`.

El documento `Plan_Entregable_1_Tranqi_Identidad_Socios.md` referenciado aquí antes nunca se creó (no
existe en el repo ni en su historial de git). Diseño completo, decisiones de alcance (MFA, cifrado,
documentos) y máquina de estados: ver
[`apps/tranqi-web/modulos/socios/README.md`](../../../apps/tranqi-web/modulos/socios/README.md).

## Dependencias de esquemas comunes

- `comun_seguridad.seg_usuario` / `seg_membresia` — identidad y rol. ✅ Migrado y en uso (registro, bienvenida, gestión de usuarios, consentimiento de términos, baja de cuenta) — ver [`especificacion-tecnica.md` de Plataforma](../plataforma/especificacion-tecnica.md) §1 y §1.3.
- `comun_configuracion.cfg_negocio` — ✅ Migrado y en uso (pantalla de configuración del negocio).
- `comun_catalogo.cat_provincia` / `cat_ciudad` — residencia y cobertura. ❌ Pendiente.
- `comun_auditoria` — vía `aud_fn_auditar_tabla()`. ✅ Migrado, aplicado a las tablas de `comun_seguridad`/`comun_configuracion`; pendiente en las 8 tablas propias de Tranqi (`trq_*`) cuando se migren.

## Notas de seguridad específicas de Tranqi

- **Cédula y matrícula profesional: texto plano protegido solo por RLS** (dueño de la solicitud +
  administradores de `tranqi`), no `pgp_sym_encrypt` — cifrar de verdad requiere gestión de claves
  (Supabase Vault) que el proyecto no tiene todavía. Decisión explícita, no un olvido — ver
  `apps/tranqi-web/modulos/socios/README.md`. Enmascarado en listados del admin, texto completo solo en
  la vista de detalle (donde sí se necesita para verificar contra SENESCYT/Foro de Abogados).
- **Envío de solicitud NO requiere `aal2`/MFA.** Corrección sobre el diseño original: MFA se exige para
  activar capacidades reales de un socio ya aceptado (`trq_abogado.abg_mfa_verificado`), no para postular
  — MFA en sí no está implementado en el código todavía (PLT-002 sigue pendiente).
- Rol `ABOGADO` no otorga capacidades sin `trq_abogado` en estado verificado — ver [`gobernanza/politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §4.
