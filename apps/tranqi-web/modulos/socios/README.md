# Módulo: socios

Implementa **TRQ-001** (solicitud de registro de socio abogado) — ver
[`gobernanza/productos/tranqi/especificacion-funcional.md`](../../../../gobernanza/productos/tranqi/especificacion-funcional.md)
y [`especificacion-tecnica.md`](../../../../gobernanza/productos/tranqi/especificacion-tecnica.md).

**Propio de Tranqi, no compartido.** A diferencia de identidad/configuración-negocio/gestión-usuarios
(PLT-xxx, en `packages/*`), la red de abogados es un concepto exclusivo de este negocio — vive en
`apps/tranqi-web/modulos/`, no en un paquete del ecosistema.

## Flujo

1. Landing (`/`, sección "red") → botón "Quiero ser parte de la red" → `/panel/solicitud-socio`.
2. `/panel/solicitud-socio` vive dentro del layout de `/panel`, que ya exige sesión — un visitante sin
   cuenta llega primero a `/ingresar` (con enlace a `/registro`). Así se cumple "pasa por el registro
   general antes de llegar al formulario" sin duplicar lógica de redirect-after-auth en `@eco/identidad`.
3. El formulario (`FormularioSolicitudSocio`) inserta `trq_solicitud_socio` + hijos
   (`trq_experiencia_laboral`, `trq_solicitud_materia`, `trq_solicitud_provincia`) en una sola acción
   (`enviarSolicitudSocio`) — no hay estado "borrador" persistido, se llena y envía de una vez.
4. Panel admin → widget "Socios" (visible solo para `ADMINISTRADOR`/`SUPERADMIN`, vía
   `seg_widget`/`seg_rol_widget`) → `/panel/socios` — **una sola lista unificada**, cualquier `trq_solicitud_socio`
   con su estado visible (`Pendiente aprobación` / `En revisión` / `Aprobado` / `Rechazado`). No hay una
   pestaña separada de "solicitudes": un socio existe desde que envía la solicitud, no solo desde que se
   acepta (corrección 2026-07-28 — antes "Socios" solo mostraba `trq_abogado`, es decir aceptados, y una
   solicitud recién enviada no aparecía en ningún lado obvio para el admin).
5. Aceptar/rechazar es el RPC `tranqui_legal.trq_fn_decidir_solicitud` (transaccional, `SECURITY
   DEFINER`) — al aceptar, crea `trq_abogado` y asigna el rol `ABOGADO` vía
   `comun_seguridad.seg_fn_asignar_rol`, el mismo RPC de plataforma que usa gestión de usuarios.
6. **MFA obligatorio para administradores** (2026-07-28, decisión de negocio — solo Tranqi, los otros 3
   negocios no lo requieren). `apps/tranqi-web/app/panel/socios/layout.tsx` gatea toda la sección
   (lista, detalle, solicitudes, aceptar/rechazar) exigiendo `aal2` — si el admin no tiene un factor TOTP
   configurado, se le pide inscribirlo ahí mismo (`modulos/mfa/componentes/VerificacionMFA.tsx`, sobre la
   API nativa `auth.mfa.*` de Supabase, sin criptografía propia). Defensa en profundidad: el mismo
   requisito está en RLS (`trq_fn_es_admin_mfa_verificado()`) y dentro del RPC de aceptar/rechazar — el
   layout evita una pantalla vacía sin explicación, pero no es el único lugar que lo exige.
7. **Documentos de respaldo con carga real** (2026-07-28) — bucket privado `socios-documentos` en
   Supabase Storage (PDF/imagen/Word, 15MB máx). El solicitante adjunta título y matrícula en
   "Verificación asistida" y certificados opcionales en "Experiencia laboral"; se suben directo desde el
   navegador (`crearClienteNavegador().storage`) después de que la solicitud ya existe (necesita el
   `ssc_id` como prefijo de ruta) y quedan registrados en `trq_documento_socio`. El admin los ve con URLs
   firmadas de 10 minutos, nunca públicas.
8. **El admin también puede adjuntar su propio respaldo de revisión** (2026-07-28,
   `SubirDocumentoRevision.tsx`) — ej. una captura de la verificación manual en SENESCYT — siempre con un
   comentario obligatorio explicando qué es (`dcs_tipo = 'respaldo_revision'`, `dcs_comentario`,
   `dcs_subido_por`). Documentos del solicitante y del admin conviven en la misma lista del detalle.
9. **Notificación por correo al decidir** (2026-07-28) — `trq_fn_decidir_solicitud()` encola una fila en
   `comun_notificaciones.not_cola_correo` (plantilla `socio_aceptado`/`socio_rechazado`) al aceptar o
   rechazar. **Solo encola — no envía.** No hay proveedor de correo transaccional configurado en el
   proyecto todavía (ni Resend, ni SendGrid, ni ningún otro) — el envío real es trabajo pendiente una vez
   se decida el proveedor. Mismo patrón de "modelar ahora, conectar después" que ya se usó con
   `abg_mfa_verificado` y con los documentos antes de tener Storage.
10. **Vista de auditoría** (`/panel/auditoria`, 2026-07-28; movida fuera de `/panel/socios/auditoria`
    el mismo día — corrección de UX, ya no es una sub-pestaña de Socios sino su propia sección del rail) —
    lee `comun_auditoria.aud_registro` filtrado a `reg_esquema = 'tranqui_legal'`. Visible para
    `SUPERADMIN` de plataforma (política RLS original `aud_registro_superadmin_select`) y para
    `ADMINISTRADOR` de tranqi (política nueva `aud_registro_administrador_tranqi_select`, acotada a
    `reg_esquema = 'tranqui_legal'` — un administrador de tranqi no ve auditoría de otros negocios ni de
    esquemas `comun_*`, eso sigue siendo solo-SuperAdmin). Mantiene el mismo gate `aal2` que Socios
    (`app/panel/auditoria/layout.tsx`, replicado explícitamente al mover la ruta fuera del árbol que lo
    heredaba). Quién decidió una solicitud ya quedaba registrado en `trq_revision_solicitud.rev_admin_id`;
    esta vista es la bitácora completa de cambios (INSERT/UPDATE/DELETE) sobre las 8 tablas de socios.

## Decisiones de alcance tomadas en esta implementación

El documento `Plan_Entregable_1_Tranqi_Identidad_Socios.md` referenciado en `especificacion-tecnica.md`
**no existe en el repo ni en su historial de git** — nunca se llegó a crear. Solo existían los 8 nombres
de tabla y prefijos, ya fijados. Los campos del formulario, la máquina de estados y las siguientes
decisiones se definieron en esta implementación:

- **MFA no bloquea el envío de la solicitud, sí el acceso admin (actualizado 2026-07-28).** Postular
  sigue sin requerir MFA. Pero revisar/aceptar/rechazar solicitudes SÍ lo exige desde esta actualización
  — ver punto 6 del flujo arriba. `abg_mfa_verificado` en `trq_abogado` sigue como columna sin uso real
  todavía (activación de capacidades del socio ya aceptado, no de quien lo revisa) — son dos MFA
  distintos: el del admin que revisa (implementado) y el del abogado ya activo (pendiente, PLT-002).
- **Cédula/matrícula en texto plano, no `pgp_sym_encrypt`.** Cifrar de verdad requiere gestión de claves
  (Supabase Vault) que el proyecto no tiene todavía — es una decisión aparte, no algo para improvisar en
  esta migración. Protegidas por RLS (solo el dueño de la solicitud y administradores de `tranqi` pueden
  leerlas); la vista de detalle del admin las muestra completas (las necesita para verificar), la vista
  de lista no las expone.
- **`trq_documento_socio` ya tiene UI de carga (actualización 2026-07-28)** — ver punto 7 del flujo
  arriba. Es el primer uso de Supabase Storage en el proyecto; el patrón (bucket privado + RLS por
  carpeta + URLs firmadas) queda como referencia para el resto del ecosistema.
- **Estados `borrador`/`en_revision` existen en el `check` de `ssc_estado` pero no se usan todavía** — el
  formulario es de un solo envío (sin guardado parcial), y la revisión pasa directo de `enviada` a
  `aceptada`/`rechazada`. Se dejan en el esquema para no tener que migrar de nuevo si se necesitan.
- **Una sola solicitud activa por usuario** (índice único parcial) — permite volver a postular después de
  un rechazo, bloquea duplicados mientras una sigue en curso.

## Bugs encontrados y corregidos, verificados de punta a punta contra el proyecto real (2026-07-28)

1. **"Socios" solo mostraba aceptados.** Reportado por el usuario probando el flujo real: envió una
   solicitud, entró como admin, y "Socios" decía que no había ninguno — la solicitud pendiente vivía en
   una pestaña separada sin ningún indicio de que estuviera ahí. Corregido unificando en una sola lista
   con estado visible (ver punto 4 del flujo).
2. **`GRANT USAGE ON SCHEMA` faltante, dos veces.** `tranqui_legal` (ya corregido en la ronda anterior) y
   ahora `comun_auditoria` — el patrón se repitió porque hasta esta actualización nadie leía
   `aud_registro` vía PostgREST, solo el trigger `aud_fn_auditar_tabla()` escribía ahí como
   `SECURITY DEFINER` (bypassa RLS y grants). La vista de auditoría fue la primera lectora real y expuso
   el permiso faltante (`permission denied for schema comun_auditoria`).
3. **Dos FK sin `ON DELETE`, bloqueando baja de cuenta (PLT-012).** `trq_revision_solicitud.rev_admin_id`
   (corregido en la ronda anterior) y ahora `trq_documento_socio.dcs_subido_por` — cualquiera que hubiera
   subido un documento (solicitante o admin) no podía dar de baja su cuenta sin violar la FK. Ambas
   cambiadas a `ON DELETE SET NULL` — se preserva el registro, no a quién bloquea.

## Catálogos

`trq_materia` (especialidades legales) y `comun_catalogo.cat_provincia` (provincias de Ecuador, tabla
nueva y reutilizable por cualquier negocio con necesidad de ubicación) se poblaron con datos semilla en
la misma migración — ver `supabase/migrations/20260728000001_comun_catalogo_provincia.sql` y
`20260728000002_tranqui_legal_socios.sql`.
