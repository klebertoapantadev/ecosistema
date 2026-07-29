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

## Dominio propio de Auth (2026-07-29)

`NEXT_PUBLIC_SUPABASE_URL` en las 4 apps (tranqi-web, fastfix-web, tinkay-web, margaritas-web) apunta a
`https://auth.tranqi24.com`, no al dominio crudo `oaybbpdxhlxjbpwnoymy.supabase.co`. Motivo: con el login
de Google, la pantalla nativa de Google ("Selecciona una cuenta") mostraba "Ir a
oaybbpdxhlxjbpwnoymy.supabase.co" — confuso y con pinta de phishing para el usuario final. Como las 4
apps comparten un único proyecto/autenticación, se usó un nombre neutro (`auth.tranqi24.com`, no
`auth.<negocio>.com` de ninguna app en particular) y "Acceso Ecosistema" como nombre de marca en el
consentimiento de Google (Google Cloud Console → Auth Platform → Información de la marca).

- **Add-on pagado**: Custom Domain de Supabase, facturado por hora activa, **no** cubierto por el spend
  cap (confirmado ~$10/mes al momento de activarlo). Se activa en
  `Dashboard del proyecto → Settings → Add-ons → Custom domain`.
- El add-on sirve **todo el proyecto** (REST/Storage/Realtime/Auth), no solo Auth — por eso cambiar
  `NEXT_PUBLIC_SUPABASE_URL` a `auth.tranqi24.com` no rompe nada más, es un alias del mismo backend.
- DNS en Vercel (`tranqi24.com` usa nameservers de Vercel): `CNAME auth → oaybbpdxhlxjbpwnoymy.supabase.co.`
  más el `TXT _acme-challenge.auth` que pide Supabase para emitir el certificado — ambos agregados vía
  `vercel dns add`, no a mano en un panel de DNS externo.
- Cliente OAuth de Google (`Clientes → Tranqi-WEB` en Google Auth Platform) necesita
  `https://auth.tranqi24.com/auth/v1/callback` agregado a "URIs de redireccionamiento autorizados" — se
  dejó también la URI vieja (`oaybbpdxhlxjbpwnoymy.supabase.co/.../callback`) como respaldo, no se borró.

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
| `20260727000008_seg_terminos_y_baja_cuenta` | Consentimiento de términos (`usu_terminos_aceptados_en`, `usu_terminos_version`, PLT-001 regla 6) y baja de cuenta (`usu_eliminado_en`, RPC `seg_fn_eliminar_cuenta()`, PLT-012) |
| `20260727000009_seg_provisionar_usuario_fallback_nombre` | **Fix**: el trigger solo leía `given_name`/`family_name` de Google, que este proveedor no siempre envía (solo `name`/`full_name`) — deja `usu_nombres`/`usu_apellidos` sin prellenar en la bienvenida. Agrega fallback partiendo `name`/`full_name` por el primer espacio. |
| `20260727000010_seg_widget_configuracion_negocio` | **Fix**: "Configuración del negocio" era un link fijo visible a cualquier usuario autenticado (incluido `CLIENTE`). Se registra como widget `configuracion_negocio` asignado a `ADMINISTRADOR`, igual que `gestion_usuarios`. |
| `20260727000011_seg_acceso` | Historial de accesos por usuario/dispositivo (PLT-018), común a los 4 negocios — alimenta el saludo personalizado y la lista de "dispositivos recientes" en Mi cuenta. |
| `20260727000012_seg_acceso_negocio` | **Fix**: agrega `acc_negocio` — el historial es único por usuario (correcto por diseño), pero sin etiqueta de app cada fila parecía una duplicación confusa al entrar por primera vez a un segundo negocio. |
| `20260728000001_comun_catalogo_provincia` | Esquema `comun_catalogo` nuevo. Tabla `cat_provincia`, seed de las 24 provincias de Ecuador — la necesita TRQ-001 (cobertura geográfica de socios), reutilizable por cualquier negocio. |
| `20260728000002_tranqui_legal_socios` | TRQ-001: esquema `tranqui_legal` nuevo (primera tabla propia de Tranqi). 8 tablas (`trq_solicitud_socio`, `trq_experiencia_laboral`, `trq_documento_socio`, `trq_materia` con seed, `trq_solicitud_materia`, `trq_solicitud_provincia`, `trq_revision_solicitud`, `trq_abogado`), RPC `trq_fn_decidir_solicitud()` (aceptar/rechazar, asigna rol `ABOGADO` al aceptar), widget de panel `socios`. |
| `20260728000003_tranqui_legal_usage_grant` | **Fix**: faltaba `grant usage on schema tranqui_legal to authenticated` — los `grant select`/`insert` por tabla de la migración anterior no servían sin él (PostgREST devolvía `permission denied for schema`). |
| `20260728000004_trq_revision_admin_set_null` | **Fix**: `trq_revision_solicitud.rev_admin_id` no tenía `ON DELETE` (RESTRICT por defecto) — cualquier admin que hubiera revisado una solicitud no podía dar de baja su cuenta (PLT-012). Cambiado a `ON DELETE SET NULL`. |
| `20260728000005_socios_mfa_y_documentos` | MFA obligatorio (`aal2`) para admins que acceden a socios/solicitudes de Tranqi — helper `trq_fn_es_admin_mfa_verificado()`, aplicado en las políticas de `SELECT` admin y dentro de `trq_fn_decidir_solicitud()`. Bucket privado `socios-documentos` (primer uso de Supabase Storage en el proyecto) con RLS por carpeta (`{ssc_id}/...`). |
| `20260728000006_socios_auditoria_notificaciones` | `trq_documento_socio` agrega `dcs_subido_por`/`dcs_comentario` (el admin también puede adjuntar respaldo, no solo el solicitante) y el tipo `respaldo_revision`. Esquema `comun_notificaciones` nuevo y compartido — tabla `not_cola_correo` (cola de correo, solo modelada, sin envío real todavía). `trq_fn_decidir_solicitud()` encola una notificación al aceptar/rechazar. |
| `20260728000007_comun_auditoria_usage_grant` | **Fix**: faltaba `grant usage on schema comun_auditoria to authenticated` — pasó desapercibido porque hasta la vista de auditoría de socios nadie leía `aud_registro` vía PostgREST (solo el trigger, que corre `SECURITY DEFINER`). Mismo patrón que `20260728000003`. |
| `20260728000008_trq_documento_subido_por_set_null` | **Fix**: `trq_documento_socio.dcs_subido_por` sin `ON DELETE` bloqueaba la baja de cuenta (PLT-012) de cualquiera que hubiera subido un documento. Cambiado a `ON DELETE SET NULL`, mismo patrón que `20260728000004`. |
| `20260728000009_auditoria_widget_top_level_y_acceso_administrador` | Auditoría pasa de sub-pestaña de Socios a sección propia del rail (`/panel/auditoria`). Nuevo widget `auditoria` + asignación a rol `ADMINISTRADOR`; nueva política RLS `aud_registro_administrador_tranqi_select` (acotada a `reg_esquema = 'tranqui_legal'`, no abre `comun_*` ni otros negocios). Política preexistente `aud_registro_superadmin_select` no se toca. |

Tipos TypeScript regenerados en cada migración que cambia columnas — ver `packages/db/src/tipos-generados.ts` (`20260727000009` solo reescribe el cuerpo de una función, no requiere regeneración; lo mismo aplica a `20260728000003/4/5/7`, que solo tocan funciones/políticas/storage/grants).

Verificado de punta a punta contra el proyecto real (no simulado): registro por correo, confirmación de correo, login, bienvenida, panel, gestión de usuarios. Cuentas de prueba (`prueba.sprint0*.ecosistema@gmail.com`) eliminadas tras la verificación.
