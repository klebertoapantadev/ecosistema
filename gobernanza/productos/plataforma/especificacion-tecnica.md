---
tipo: esp_tecnica
estado: vigente
version: 1.6
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Plataforma — Especificación Técnica Común

Contraparte técnica de [`especificacion-funcional.md`](especificacion-funcional.md). Este documento es un **índice con estado**, no redefine lo que ya vive en ADRs y políticas — apunta a la fuente y dice qué está construido y qué falta.

**Regla de arquitectura (2026-07-27):** todo lo que implementa un requerimiento `PLT-xxx` (transversal a los 4 negocios) vive en un paquete compartido (`packages/*`), no dentro de `apps/{app}/modulos/`, aunque hoy solo un negocio lo use. `packages/supabase` (`@eco/supabase`) y `packages/identidad` (`@eco/identidad`) son los primeros en seguir este patrón — nacieron dentro de `tranqi-web` y se extrajeron cuando quedó claro que los otros 3 negocios necesitaban exactamente lo mismo. `configuracion-negocio` y `gestion-usuarios` todavía no se extrajeron (pendiente, ver §1.1 y §9) — es deuda de secuencia, no una decisión de diseño distinta.

## 1. `comun_seguridad` — implementa PLT-001, PLT-002, PLT-003, PLT-011, PLT-012, PLT-018

| Tabla | Prefijo | Estado |
| :--- | :--- | :--- |
| `seg_usuario` | `usu_` | ✅ Migrada (`20260727000002`). Incluye `usu_superadmin_plataforma`, `usu_autorizacion_whatsapp` y `usu_onboarding_completo` (`20260727000005`); `usu_terminos_aceptados_en`, `usu_terminos_version` y `usu_eliminado_en` (`20260727000008`). |
| `seg_membresia` | `mem_` | ✅ Migrada. `unique (mem_usuario_id, mem_negocio)` — una membresía por usuario y negocio. Auto-alta como `CLIENTE` (jerarquía base Nivel 1) habilitada por política (`20260727000004`). Soporta múltiples perfiles activos por membresía (`PLT-003`). |

Aprovisionamiento: trigger `comun_seguridad.seg_fn_provisionar_usuario()` sobre `auth.users` — toda alta crea automáticamente su fila en `seg_usuario`, incluyendo `usu_nombres`/`usu_apellidos` desde los metadatos del proveedor (`20260727000007` — antes solo quedaban en el JSONB de detalle, no en columna). El correo `kleber.toapanta.ch@gmail.com` queda marcado `usu_superadmin_plataforma = true` desde su primer login real (bootstrap, sin asignación manual).

**Fix (`20260727000009`):** el trigger leía exclusivamente `given_name`/`family_name` de `raw_user_meta_data`, pero el proveedor Google de este proyecto no siempre los envía (confirmado con datos reales — solo trae `name`/`full_name`, ej. `"Kleber Toapanta"`). Sin fallback, `usu_nombres`/`usu_apellidos` quedaban `NULL` y la bienvenida no prellenaba nada. Ahora, si no hay `given_name`/`family_name`, se parte `name`/`full_name` por el primer espacio — heurística imperfecta para nombres compuestos, cubierta por el paso de confirmación de la bienvenida (`PLT-001` regla 2).

Asignación de rol: RPC transaccional `seg_fn_asignar_rol(usuario, negocio, rol)` (`20260727000004`) — asigna y administra múltiples perfiles validando que la jerarquía del perfil asignado sea de igual o menor nivel a la del asignador (`PLT-003`). Nunca `UPDATE` directo, ver regla 5 de `AGENTS.md`.

**Fix de seguridad (`20260727000006`):** la política de `UPDATE` de `seg_usuario` permitía escribir cualquier columna de la propia fila, incluida `usu_superadmin_plataforma` — un usuario podía auto-otorgarse SuperAdmin. Cerrado con `GRANT UPDATE` por columna (ver [`politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §9). Verificado con `information_schema.column_privileges` tras aplicar.

MFA (PLT-002): Supabase Auth TOTP con auto-servicio en `/panel/seguridad` y 2 modalidades elegibles guardadas en `seg_usuario.usu_mfa_modalidad` (`SOLO_PROCESOS_CRITICOS` por defecto | `SOLICITAR_SIEMPRE`). Exigido vía claim `aal` (`aal2`) en políticas RLS — ver [`politicas/seguridad-y-datos.md`](../../politicas/seguridad-y-datos.md) §3. **Pendiente todavía** — las políticas actuales no exigen `aal2` porque ningún flujo crítico se ha implementado aún.
Rol en JWT: *Custom Access Token Hook* — pendiente de implementar. Mientras no exista, las políticas RLS resuelven el rol consultando `seg_membresia` directamente (vía `comun_seguridad.seg_fn_es_admin_negocio()`), no desde un claim del token.

### 1.1. Sistema de widgets (PLT-011)

| Tabla | Prefijo col. | Estado |
| :--- | :--- | :--- |
| `seg_widget` | `wdg_` | ✅ Migrada. Catálogo de funcionalidades por negocio (`unique (wdg_negocio, wdg_clave)`). |
| `seg_rol_widget` | `rlw_` | ✅ Migrada. Asignación dinámica widget↔rol (`unique (rlw_negocio, rlw_rol, rlw_widget_id)`). |

Seed aplicado: widgets `gestion_usuarios` (`20260727000002`) y `configuracion_negocio` (`20260727000010`) en los 4 negocios, asignados por defecto al rol `ADMINISTRADOR`. Todos los widgets de consola administrativa deben ser componentes **únicos y comunes** que comparten código lógico y adaptan su tema/colores según la app hospedante (regla de arquitectura, ver inicio de este documento). `SUPERADMIN` (vía `usu_superadmin_plataforma`) no necesita fila en `seg_rol_widget` y obtiene visibilidad global multitenant en cualquier widget común desde cualquier app.

**❌ Pendiente — widget `auditoria`:** planeado (ver PLT-005), sin seed en `seg_widget` todavía — verificado contra el proyecto real (2026-07-27), no confundir con "ya construido".

**❌ Pendiente — Estándar de DataGrid UI:** El plan es que todo widget con listas tabuladas use un componente común `DataGrid` (`@ecosistema/ui` o similar), estructurado bajo una **Estrategia de Doble Criterio de Búsqueda y Filtrado (2 Capas)**:
- **Capa 1 (Server-Side BDD):** Filtros primarios traducidos a PostgREST/Supabase API (`.gte()`, `.lte()`, `.ilike()`, `.eq()`, `.or()`) para consultar por fechas, correo, nombres, abogado/técnico, cédula/RUC o estados directamente en la base de datos.
- **Capa 2 (Client-Side In-Memory Search):** Búsqueda global multi-columna en tiempo real sobre el dataset retornado en memoria cliente, ordenamiento por encabezados, drag-and-drop de columnas, agrupamiento dinámico por arrastre y exportación nativa a Excel/CSV. Ese paquete de UI **no existe todavía** — `packages/` hoy no tiene ningún componente de tabla compartido; `gestion_usuarios` en `tranqi-web` usa una tabla HTML simple (`tabla-panel`), no un DataGrid.

**Fix (`20260727000010`):** "Configuración del negocio" vivía como link fijo en `app/panel/layout.tsx`, visible a cualquier usuario autenticado incluido un `CLIENTE` (rol por defecto de todo registro, `PLT-003` regla 1) — que nunca debería verlo, aunque RLS ya bloqueaba la escritura. Se registró como widget normal para que el sistema de permisos de `PLT-011` sea la única fuente de verdad de qué ve cada rol. Verificado: un `CLIENTE` de prueba solo ve "Mi cuenta"; un `ADMINISTRADOR` de prueba ve ambos.

✅ Consumido en `tranqi-web`: el panel arma su navegación dinámicamente a partir de `seg_rol_widget` (vía `obtenerWidgetsVisibles()` de `@eco/identidad`) — ver `app/panel/layout.tsx`. Los otros 3 negocios ya llaman la misma función, pero solo tienen seed para `gestion_usuarios`/`configuracion_negocio`, y esas dos pantallas todavía no existen fuera de `tranqi-web` (§9), así que hoy siempre ven 0 widgets. **Gobernanza de permisos (`PLT-003` regla 1, `PLT-011` regla 6):** Las operaciones de escritura (`INSERT`, `UPDATE`, `DELETE`) en `seg_rol_widget` están restringidas por RLS exclusivamente a `usu_superadmin_plataforma = true`. El widget UI `configuracion_permisos` sólo estará disponible para el `SUPERADMIN` de plataforma.

### 1.2. Bienvenida post-registro (PLT-001 regla 2)

Confirmación de nombre/apellido (Google no siempre los da claros — ej. cuentas de correo comerciales) + autorización opt-in de contacto por WhatsApp. `usu_onboarding_completo` evita repetir la pantalla. ✅ Implementado y verificado de punta a punta contra el proyecto real: login → bienvenida → guarda `usu_nombres`/`usu_apellidos`/`usu_whatsapp`/`usu_autorizacion_whatsapp` → panel muestra el nombre confirmado, no el correo.

**Validación de WhatsApp (`libphonenumber-js`, exacto `1.13.9`):** el campo de número es un `<select>` de país (`packages/identidad/src/paises.ts`, lista curada — Ecuador por defecto, ver `PLT-007`) + un input que se formatea a medida que se escribe (`AsYouType`). Al enviar, `isValidPhoneNumber(numero, pais)` valida la cantidad de dígitos real de ese país antes de componer el E.164 (`+593991234567`) que se guarda en `usu_whatsapp` — la validación de longitud ya no es un `length >= 7` genérico. `esquemaBienvenida` (Zod) repite la validación en el servidor sobre el E.164 ya compuesto, como respaldo si alguien evita el cliente.

### 1.3. Consentimiento de términos y baja de cuenta (PLT-001 regla 6, PLT-012)

Migración `20260727000008_seg_terminos_y_baja_cuenta.sql`.

**Consentimiento de términos:**
- `usu_terminos_aceptados_en` (timestamptz) y `usu_terminos_version` (text) registran cuándo y qué versión de `/terminos` aceptó el usuario. `TERMINOS_VERSION` vive en `packages/identidad/src/esquema.ts` — subirla ante un cambio sustantivo del texto permite identificar y renotificar a quien aceptó una versión vieja.
- **Registro por correo:** el checkbox es obligatorio en el formulario (`FormularioRegistro`); `registrarUsuario()` envía `terminos_version` en `raw_user_meta_data`, y `seg_fn_provisionar_usuario()` (trigger sobre `auth.users`) lo lee y escribe la aceptación en el mismo `INSERT`.
- **Google OAuth:** `signInWithOAuth()` no permite inyectar `raw_user_meta_data` propia, así que no hay forma de mandar `terminos_version` antes de que exista sesión. En su lugar, el botón de Google muestra un disclaimer visible ("Al continuar, aceptas los Términos de Servicio") y `asegurarTerminosAceptados()` registra la aceptación en el `app/auth/callback/route.ts` de cada app, donde ya hay sesión real tras `exchangeCodeForSession`. Es idempotente (`.is("usu_terminos_aceptados_en", null)`): un login posterior no pisa la fecha de una aceptación previa.
- Grant de columna: `usu_terminos_aceptados_en`/`usu_terminos_version` se agregan al `GRANT UPDATE` por columna existente (ver §"Fix de seguridad" arriba) — el usuario puede escribir su propia aceptación, nada más.
- `/terminos` (`app/terminos/page.tsx` de cada app) es texto **borrador**, marcado explícitamente como pendiente de revisión legal — no es el editor Markdown por negocio de `PLT-008` (ese sigue pendiente).

**Baja de cuenta (PLT-012):**
- `usu_eliminado_en` (timestamptz) existe en el esquema para un futuro modelo de anonimización, pero **deliberadamente no tiene GRANT a `authenticated`** — solo la función `SECURITY DEFINER` de abajo podría escribirla, y hoy ni siquiera lo hace (ver limitación).
- RPC `comun_seguridad.seg_fn_eliminar_cuenta()` (`SECURITY DEFINER`, sin argumentos, opera sobre `auth.uid()`): borra `auth.users`, lo que en cascada elimina `seg_usuario` y `seg_membresia` (`ON DELETE CASCADE`, `20260727000002`).
- **Limitación de diseño conocida, deliberada:** la regla de negocio real (PLT-012 regla 2) exige anonimizar en vez de borrar si el usuario tiene historial transaccional. Ese esquema (`comun_facturacion.fac_transaccion_pago`) todavía no existe en ningún negocio del ecosistema, así que hoy **no hay historial que pueda existir** y el hard delete es siempre seguro. La función usa `to_regclass('comun_facturacion.fac_transaccion_pago')` como válvula de seguridad: en cuanto una migración futura cree esa tabla, `seg_fn_eliminar_cuenta()` empieza a **rechazar explícitamente** toda baja (falla cerrado, con un mensaje pidiendo contactar soporte) hasta que se reescriba para consultar el historial real y decidir entre hard delete y anonimización. Nunca debe quedar en un estado donde borre datos "por accidente" solo porque la tabla ya existe.
- `eliminarCuenta()` (`packages/identidad/src/acciones.ts`) llama al RPC y cierra sesión. UI (`<EliminarCuenta />`) exige escribir la palabra "ELIMINAR" antes de habilitar el botón — no es una acción de un solo clic.
- `grant execute on function seg_fn_eliminar_cuenta() to authenticated` — cualquier usuario autenticado puede llamarlo, pero solo actúa sobre su propia sesión (`auth.uid()`), nunca recibe un ID como parámetro.

### 1.4. Historial de accesos y saludo personalizado (PLT-018)

`comun_seguridad.seg_acceso` (`acc_id`, `acc_usuario_id`, `acc_ip`, `acc_user_agent`, `acc_creado_en`, `acc_negocio`; `20260727000011`, `acc_negocio` agregada en `20260727000012`) — una fila por login, RLS `select`/`insert` solo sobre las filas propias (`acc_usuario_id = auth.uid()`). Escrita desde `iniciarSesion()`, `registrarUsuario()` (si deja sesión activa) y `crearManejadorCallbackOAuth()` — los tres puntos de entrada de sesión, en `packages/identidad/src/acceso.ts`.

**Fix (`20260727000012`):** PLT-018 regla 4 dice que el historial es único por usuario en todo el ecosistema, no uno por negocio — correcto por diseño, pero al probarlo en producción con una cuenta real que ya tenía accesos en Tranqi, entrar por primera vez a Margaritas mostraba 3 accesos sin explicación (parecía un bug de duplicación). `acc_negocio` etiqueta cada fila con la app de origen (`etiquetaNegocio()`) para que `<HistorialAccesos />` muestre "Chrome en Windows · Tranqi" en vez de una lista ambigua — no cambia el alcance (sigue siendo un solo historial compartido), solo lo hace legible. Columna nullable: las filas previas a la migración no tienen negocio y simplemente no muestran la etiqueta.

**No confundir con `seg_sesion` (PLT-017, §8.2, todavía no migrada):** `seg_acceso` es un log histórico de solo inserción — no sabe cuáles de esas sesiones siguen activas ni puede revocar tokens. `PLT-017` (gestión de sesiones activas + revocación remota) es un requerimiento más grande, pendiente, que puede apoyarse en este log pero necesita además integrar la Admin API de Supabase Auth para invalidar refresh tokens.

- `<HistorialAccesos />` — lista de "dispositivos recientes" en `/panel/cuenta`, con etiqueta legible del User-Agent (`etiquetaDispositivo()`, heurística simple, sin librería de parseo).
- `obtenerSaludo(usuarioId, nombre)` — compara la fila más reciente (login que acaba de ocurrir) contra la anterior para elegir el tono del saludo en `/panel` ("Hola de nuevo" / "Cuánto tiempo sin verte" / etc.). Deliberadamente no usa `auth.users.last_sign_in_at` (no expuesto al propio usuario vía PostgREST sin lógica adicional) — se apoya solo en `seg_acceso`, ya bajo RLS propio.
- ✅ Verificado de punta a punta: login → panel muestra saludo por defecto (primer acceso) → logout → login de nuevo → panel muestra "Hola de nuevo, {nombre}" → `/panel/cuenta` lista ambos accesos con dispositivo y fecha.

### 1.5. Arquitectura de paquetes compartidos

`packages/supabase` (`@eco/supabase`) y `packages/identidad` (`@eco/identidad`) — ver regla de arquitectura al inicio de este documento y el [README de `@eco/identidad`](../../../packages/identidad/README.md) para el detalle de qué expone cada uno y cómo lo consume una app nueva.

- `@eco/supabase` expone 3 subpaths (`package.json` → `exports`): `.` (cliente de navegador, safe para "use client"), `./servidor` (cliente de servidor, usa `next/headers` — **nunca** importar desde un componente cliente) y `./middleware`. Separar esto en subpaths en vez de un solo barril fue necesario: un barril único que reexporta ambos hace que Next intente empaquetar `next/headers` para el navegador y el build falla (`You're importing a component that needs "next/headers"`).
- `@eco/identidad` sí es un barril único (`.`) — expone acciones (`"use server"`), consultas server-only, y componentes cliente (`"use client"`) desde el mismo `index.ts`. Esto es seguro porque ningún componente cliente del paquete importa el barril completo (importan `crearClienteNavegador` directo de `@eco/supabase`) — la regla no es "nunca mezclar", es "nunca dejar que un archivo `"use client"` importe, directa o transitivamente, algo que use `next/headers`.
- Cada app añade `@eco/supabase` y `@eco/identidad` a `transpilePackages` en su `next.config.mjs` (mismo patrón que `@eco/agentes-ia`) y las mismas dos variables de entorno (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` — un solo proyecto Supabase sirve a los 4 negocios).
- `fastfix-web`, `tinkay-web` y `margaritas-web` no tienen marca/diseño propio todavía — importan `@eco/identidad/estilos-base.css` (estilo neutral de referencia) en su `layout.tsx`, con `--eco-acento` sobrescrito por app. `tranqi-web` no lo importa — tiene su propio diseño completo en `app/globals.css`. Cuando un negocio defina su marca real, reemplaza el import del estilo base por su propio CSS.
- Google OAuth (Google Cloud Console) es **un solo cliente OAuth**, compartido por los 4 negocios — el callback siempre pasa por el dominio del proyecto Supabase (`{ref}.supabase.co/auth/v1/callback`), nunca por el dominio de cada app, así que no hace falta reconfigurar nada por negocio ahí. Lo único que varía por app es el `redirectTo` (su propio `/auth/callback`), que debe estar en la lista de Redirect URLs de Supabase (Authentication → URL Configuration, un solo listado compartido) — paso manual, sin herramienta MCP para Auth Provider config.

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

Seed aplicado: una fila por negocio (`tranqi`, `fastfix`, `tinkay`, `margaritas`) con nombre comercial, el resto vacío. Lectura pública (es información de vitrina), escritura restringida a `ADMINISTRADOR`/`SUPERADMIN` del negocio. ✅ Consumido: `app/panel/configuracion/` en `tranqi-web` (solo visible para `ADMINISTRADOR`/`SUPERADMIN` vía el widget `configuracion_negocio`, ver §1.1).

`cfg_detalle_configuracion` incluye ahora `correoNotificaciones` (`PLT-008` regla 2, canal de correo) — **solo captura el dato**, no está conectado a envío real; ver [`modulos/configuracion-negocio/README.md`](../../../apps/tranqi-web/modulos/configuracion-negocio/README.md) de `tranqi-web` para el detalle de la limitación (Supabase Auth solo permite un remitente por proyecto, compartido por los 4 negocios).

## 8. Supabase Storage y Módulos Transversales (PLT-013 a PLT-017)

### 8.1. Estructura y Seguridad de Storage (PLT-016)
- **Buckets Nativos:** `comun-publico` (lectura anónima, escritura RLS admin) y `comun-privado` (lectura/escritura RLS estricta + URLs firmadas expirables a 15 min).
- **Patrón Jerárquico de Rutas Obligatorio:**
  `[bucket]/[codigo_negocio]/[categoria_uso]/[yyyy-mm]/[uuid_archivo].[ext]`
- **Seguridad RLS en `storage.objects`:**
  ```sql
  create policy "Acceso privado por membresia de negocio"
    on storage.objects for select using (
      bucket_id = 'comun-privado'
      and comun_seguridad.seg_fn_es_miembro_negocio(auth.uid(), (string_to_array(name, '/'))[2])
    );
  ```

### 8.2. Esquemas Comunes Adicionales
- **`comun_notificacion` (PLT-013 - Emisión Multicanal y Notificaciones Push):**
  - **`not_campana` (`cmp_`):** Registro auditado de campañas emitidas desde el widget `emision_notificaciones` (`cmp_id`, `cmp_negocio`, `cmp_emisor_id`, `cmp_tipo_audiencia` (`TODOS` | `POR_ROL` | `POR_USUARIOS`), `cmp_roles_jsonb`, `cmp_canales_jsonb` (`IN_APP`, `PUSH`, `EMAIL`), `cmp_asunto`, `cmp_cuerpo_html`, `cmp_cuerpo_markdown`, `cmp_estado`, `cmp_creado_en`).
  - **`not_registro` (`not_`):** Log individual de despachos in-app/push/email por usuario (`not_id`, `not_campana_id`, `not_usuario_id`, `not_negocio`, `not_canal`, `not_titulo`, `not_contenido_html`, `not_leido_en`, `not_creado_en`).
  - **`comun_seguridad.seg_dispositivo_push` (`dsp_`):** Tokens de suscripción Push por dispositivo (`dsp_id`, `dsp_usuario_id`, `dsp_token_push`, `dsp_plataforma` (`WEB`, `ANDROID`, `IOS`), `dsp_activo`).
  - **Componente Rich Text Editor (WYSIWYG & Markdown):** Integración UI mediante `@tiptap/react` / Quill con barra de herramientas completa (estilos, colores, alineación, tablas, imágenes, variables), sanitización contra XSS (`isomorphic-dompurify`) y conversión transparente bidireccional HTML $\leftrightarrow$ Markdown (`turndown` + `marked`).
  - **Disparo Automático en RPC `seg_fn_asignar_rol()`:** Invoca el servicio de notificación transaccional al cambiar los perfiles de un usuario (`PLT-003` regla 8).
- **`comun_comercio.com_cupon` (PLT-014):** Cupones multitenant con restricción de monto mínimo, usos globales y por usuario.
- **`comun_evaluacion` (PLT-015):** Reseñas de comprador/cliente verificado (`eva_usuario_id`, `eva_negocio`, `eva_calificacion`, `eva_comentario`, `eva_respuesta_oficial`).
- **`comun_seguridad.seg_sesion` (PLT-017):** Auditoría de dispositivos y revocación remota de refresh tokens en Supabase Auth.

## 10. Tabla resumen de estado (para no perder el hilo)

| Esquema común | Migración SQL | Función/lógica asociada | Consumido hoy por |
| :--- | :--- | :--- | :--- |
| `comun_seguridad` | ✅ Aplicada (11 migraciones) | ⚠️ Custom Access Token Hook pendiente (RLS resuelve rol vía subconsulta por ahora) | Los 4 negocios (`@eco/identidad`) — registro, bienvenida, consentimiento de términos, baja de cuenta, historial de accesos. `tranqi-web` además: gestión de usuarios |
| `comun_agentes` | ❌ Pendiente (tabla) | ✅ `packages/agentes-ia` (vía env vars) | `tranqi-web` |
| `comun_auditoria` | ✅ Aplicada | ✅ `aud_fn_auditar_tabla()` en las 10 tablas nuevas | `comun_seguridad`, `comun_configuracion` |
| `comun_configuracion` | ✅ Aplicada | — | `tranqi-web` — configuración del negocio |
| `comun_facturacion` | ❌ Pendiente | — | Ninguno todavía |
| `comun_catalogo` | ❌ Pendiente | — | Ninguno todavía |
| `comun_comercio` | ❌ Pendiente | ❌ `packages/comercio` pendiente | Ninguno todavía (bloqueante para Tinkay/Margaritas) |

**Proyecto Supabase:** `ecosistema` (`oaybbpdxhlxjbpwnoymy`) — ver [`arquitectura/inventario-supabase.md`](../../arquitectura/inventario-supabase.md). Migraciones `20260727000001` a `20260727000011` en `supabase/migrations/`.

**Paso manual pendiente, fuera de SQL:** en el dashboard de Supabase → Settings → API → *Exposed schemas*, agregar `comun_seguridad`, `comun_auditoria`, `comun_configuracion` — sin esto, PostgREST no expone estos esquemas y `supabase-js` no puede consultarlos aunque las migraciones ya estén aplicadas.
