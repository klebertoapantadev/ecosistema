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
| `trq_documento_socio` | `dcs_` | ✅ Migrada, con UI de carga (`titulo`/`matricula`/`otro`/`respaldo_revision`, `dcs_subido_por`, `dcs_comentario`) |
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

**`comun_notificaciones.not_cola_correo`** (`not_`) — ✅ Migrada (`20260728000006`), esquema nuevo y
compartido. Cola de correo, no envío — ver notas de seguridad. `trq_fn_decidir_solicitud()` encola una
fila al aceptar/rechazar (`not_plantilla`: `socio_aceptado` | `socio_rechazado`).

**Vista de auditoría** (`/panel/socios/auditoria`) lee `comun_auditoria.aud_registro` filtrado a
`reg_esquema = 'tranqui_legal'` — sin tabla nueva, reutiliza la infraestructura de auditoría ya existente
(`aud_fn_auditar_tabla()`, aplicado a las 8 tablas de socios desde su creación). RLS de `aud_registro` ya
restringía a `SUPERADMIN` de plataforma (política preexistente, no nueva).

El documento `Plan_Entregable_1_Tranqi_Identidad_Socios.md` referenciado aquí antes nunca se creó (no
existe en el repo ni en su historial de git). Diseño completo, decisiones de alcance (MFA, cifrado,
documentos) y máquina de estados: ver
[`apps/tranqi-web/modulos/socios/README.md`](../../../apps/tranqi-web/modulos/socios/README.md).

## Dependencias de esquemas comunes

- `comun_seguridad.seg_usuario` / `seg_membresia` — identidad y rol. ✅ Migrado y en uso (registro, bienvenida, gestión de usuarios, consentimiento de términos, baja de cuenta) — ver [`especificacion-tecnica.md` de Plataforma](../plataforma/especificacion-tecnica.md) §1 y §1.3.
- `comun_configuracion.cfg_negocio` — ✅ Migrado y en uso (pantalla de configuración del negocio).
- `comun_catalogo.cat_provincia` — ✅ Migrado (`20260728000001`), en uso (cobertura de socios). `cat_ciudad` sigue ❌ Pendiente.
- `comun_auditoria` — vía `aud_fn_auditar_tabla()`. ✅ Migrado y aplicado también a las 8 tablas de `tranqui_legal` (`trq_*`) desde su creación — visible en `/panel/socios/auditoria`.

## Notas de seguridad específicas de Tranqi

- **Cédula y matrícula profesional: texto plano protegido solo por RLS** (dueño de la solicitud +
  administradores de `tranqi`), no `pgp_sym_encrypt` — cifrar de verdad requiere gestión de claves
  (Supabase Vault) que el proyecto no tiene todavía. Decisión explícita, no un olvido — ver
  `apps/tranqi-web/modulos/socios/README.md`. Enmascarado en listados del admin, texto completo solo en
  la vista de detalle (donde sí se necesita para verificar contra SENESCYT/Foro de Abogados).
- **Envío de solicitud NO requiere `aal2`/MFA. Revisarla/aceptarla SÍ (actualizado 2026-07-28).**
  Postular no pide MFA. Pero un `ADMINISTRADOR`/`SUPERADMIN` de Tranqi necesita `aal2` (TOTP, API nativa
  `auth.mfa.*` de Supabase) para acceder a `/panel/socios` y para que
  `trq_fn_decidir_solicitud()` acepte su llamada — exigido en tres capas: layout de la app, políticas RLS
  (`trq_fn_es_admin_mfa_verificado()`) y dentro del propio RPC. Decisión de negocio explícita: **solo
  Tranqi** — los otros 3 negocios no lo requieren todavía, no está en `@eco/identidad`. Distinto del MFA
  de `trq_abogado.abg_mfa_verificado` (activación de capacidades del socio ya aceptado, todavía pendiente).
- **Documentos de respaldo: bucket privado, nunca URL pública (2026-07-28).** `socios-documentos` en
  Supabase Storage — primer uso de Storage en el proyecto. RLS por carpeta (`{ssc_id}/archivo`, el dueño
  de esa solicitud o un admin-MFA-verificado), tipos MIME restringidos (PDF/imagen/Word), 15MB máx, URLs
  de acceso siempre firmadas (10 min) generadas server-side. Patrón de referencia para el resto del
  ecosistema cuando necesite almacenar archivos sensibles — **no aplica** a galerías de producto de
  Tinkay/Margaritas, que necesitan un bucket público más liviano y todavía no existe (esperando el
  catálogo, PLT-009/010).
- Rol `ABOGADO` no otorga capacidades sin `trq_abogado` en estado verificado — ver [`gobernanza/politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §4.

### Bugs de permisos encontrados y corregidos (2026-07-28)

- **`GRANT USAGE ON SCHEMA` faltante, dos veces** (`tranqui_legal`, luego `comun_auditoria`) — mismo patrón
  en ambos casos: el esquema tenía tablas con `GRANT SELECT`/`INSERT` correctos, pero sin `USAGE` en el
  esquema esos grants no sirven de nada. Pasó desapercibido porque hasta ahora nada leía esas tablas vía
  PostgREST directamente (solo funciones `SECURITY DEFINER`, que no necesitan grants). Ver
  `20260728000003` y `20260728000007`.
- **Dos FK sin `ON DELETE` bloqueando la baja de cuenta (PLT-012)** — `trq_revision_solicitud.rev_admin_id`
  y `trq_documento_socio.dcs_subido_por`, ambas cambiadas a `ON DELETE SET NULL`. Ver `20260728000004` y
  `20260728000008`. Regla a futuro: toda FK hacia `seg_usuario` desde una tabla de bitácora/auditoría
  necesita `ON DELETE SET NULL`, no el `RESTRICT` por defecto — de lo contrario cualquiera que participe
  en el flujo (no solo el dueño del registro principal) queda bloqueado para eliminar su cuenta.
