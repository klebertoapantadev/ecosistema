---
tipo: esp_funcional
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tranqi — Especificación Funcional

**Prefijo de tabla:** `trq_` · **Esquema:** `tranqui_legal`

**Sistema visual:** [`sistema-visual.md`](sistema-visual.md) — paleta, uso del color por perfil (cliente, abogado, administración) y maquetas de referencia. Aplica a `tranqi-web` y a las apps nativas.

## Identidad y autenticación

Ver especificación de [Plataforma](../plataforma/especificacion-funcional.md) — PLT-001 (identidad única + bienvenida), PLT-002 (MFA), PLT-003 (membresías), PLT-011 (configuración + widgets), PLT-012 (baja de cuenta). Sin adiciones de Tranqi al mecanismo en sí.

**✅ Implementado y verificado (2026-07-27):** registro (Google OAuth + correo/contraseña) con consentimiento de términos (PLT-001 regla 6), pantalla de bienvenida, configuración del negocio, gestión de usuarios/roles (el widget), baja de cuenta desde el panel (PLT-012). Ver [`especificacion-tecnica.md`](especificacion-tecnica.md) y el README de cada módulo en `apps/tranqi-web/modulos/`.

**Lo que Tranqi agrega:** rol `ABOGADO` (PLT-003) se asigna automáticamente al aceptar una solicitud de socio (TRQ-001) — no otorga capacidades reales de agenda/casos hasta que `trq_abogado.abg_mfa_verificado` sea `true` (MFA, PLT-002 — ver corrección de alcance en TRQ-001 más abajo).

## Chat conversacional

Ver PLT-004. Agente asignado hoy: variables de entorno `ARIA_*` de `apps/tranqi-web` (buddie de la landing). Pendiente de migrar a `comun_agentes` cuando exista (ver especificacion-tecnica.md de Plataforma).

## TRQ-001 — Solicitud de registro de socio abogado

**✅ Implementado (2026-07-28).** El documento de trabajo `Plan_Entregable_1_Tranqi_Identidad_Socios.md`
referenciado aquí antes **nunca se creó** (no existe en el repo ni en su historial de git) — solo existían
los 8 nombres de tabla ya fijados en `especificacion-tecnica.md`. Los campos, la máquina de estados y las
decisiones de alcance se definieron directamente en la implementación — ver el detalle completo en
[`apps/tranqi-web/modulos/socios/README.md`](../../../apps/tranqi-web/modulos/socios/README.md).

- **Flujo:** landing (botón "Quiero ser parte de la red") → `/panel/solicitud-socio` (exige sesión, un
  visitante nuevo pasa primero por `/registro`) → formulario (datos profesionales, especialidades,
  cobertura por provincia, experiencia laboral, verificación asistida, documentos) → panel admin
  (`/panel/socios`, un socio existe desde que envía la solicitud, con estado `Pendiente aprobación` visible
  — no una pestaña separada) → revisión, documentos de respaldo del admin, comentarios → aceptar/rechazar
  → si se acepta, rol `ABOGADO` asignado automáticamente y se encola notificación al solicitante.
- **MFA obligatorio para administradores (actualizado 2026-07-28).** Enviar la solicitud **no** requiere
  MFA. Pero un `ADMINISTRADOR`/`SUPERADMIN` de Tranqi sí necesita `aal2` (TOTP) para acceder a
  `/panel/socios` y para que se acepte su decisión — exigido en app, RLS y RPC. Alcance explícito: **solo
  Tranqi**, decisión de negocio, los otros 3 no lo requieren. Distinto de
  `trq_abogado.abg_mfa_verificado` (activación de capacidades del socio ya aceptado — agenda, casos,
  todavía no construidas — sigue pendiente, PLT-002).
- **Verificación asistida de matrícula profesional (Foro de Abogados) y título (SENESCYT)** — autodeclarada
  por el solicitante (checkbox + enlace a cada portal + documento adjunto) y confirmada por el
  administrador al revisar (puede adjuntar su propio respaldo con comentario), no automatizada.
- **Documentos de respaldo con carga real** — bucket privado en Supabase Storage, tanto del solicitante
  (título, matrícula, certificados) como del administrador que revisa.
- **Notificación por correo al decidir — solo modelada, envío real pendiente.** Se encola una fila en
  `comun_notificaciones.not_cola_correo` al aceptar/rechazar; no hay proveedor de correo transaccional
  configurado en el proyecto todavía.
- **Auditoría** — `/panel/auditoria` (sección propia del rail, no sub-pestaña de Socios), visible para
  `ADMINISTRADOR` y `SUPERADMIN` de tranqi. Implementa el DataGrid transversal de PLT-011 regla 2 (filtro
  server-side por fecha/tabla/operación/correo, búsqueda global instantánea, orden y reordenamiento de
  columnas por drag, agrupamiento por drag, export a Excel/CSV, detalle expandible por fila) — ver
  [ADR-0004](../../arquitectura/adr/0004-datagrid-transversal.md). Unifica cambios en tablas de
  `tranqui_legal` con eventos de identidad de `comun_seguridad` (alta de cuenta, membresía, verificación de
  correo, recuperación de contraseña) acotados a usuarios con membresía activa en tranqi, vía
  `comun_auditoria.aud_fn_listar_auditoria_negocio()`. Quién decidió cada solicitud ya queda en
  `trq_revision_solicitud.rev_admin_id`.
- **Correcciones y Mejoras de Carga y Visualización (2026-08-12):**
  - Corregido error RLS que impedía eliminar experiencias anteriores en actualizaciones, eliminando la duplicación en base de datos.
  - Habilitada visualización segura de archivos previamente cargados por el postulante en el formulario de edición.
  - Soportada categorización correcta de archivos en carga (`foto_perfil`, `cv`) y visualización de la fotografía del postulante en la página de revisión del operador.
  - Agregado input para que el usuario ingrese comentarios / nombres personalizados para cada certificado.
- **Pendiente:** cifrado real de cédula/matrícula (`pgp_sym_encrypt` con Supabase Vault — hoy protegidas
  solo por RLS, decisión de gestión de claves pendiente de análisis propio) y envío real de las
  notificaciones encoladas.

- **Firma de Contrato de Sociedad (2026-08-12):**
  - **Plantilla de Contrato Configurable:** Se introdujo la tabla `trq_plantilla_contrato` y un widget de administración en la Consola Modular de Tranqi (`configuracion_contrato_abogado`) para que administradores y operadores definan la plantilla del contrato en formato Markdown con variables dinámicas (`{{nombre_completo}}` y `{{cedula}}`).
  - **Generación Dinámica e Impresión:** Al aprobar la solicitud, tanto el postulante como el operador pueden generar una vista de impresión limpia del contrato con sus datos reales auto-completados. La ruta `/panel/solicitud-socio/contrato/imprimir` invoca el diálogo de impresión nativo del navegador para descargar o guardar como PDF.
  - **Carga de Contrato Firmado:** El socio debe firmar de forma manuscrita o digital este contrato y subirlo de vuelta obligatoriamente en formato PDF. El archivo se almacena en el bucket privado `socios-documentos` con el tipo `"contrato_socio"`.
- **Notificación Dual (Email y Push):** La aprobación o rechazo de la solicitud genera ahora un registro de notificación dual (`IN_APP` y `PUSH`) persistido en `comun_notificacion.not_registro` además de la cola de correo.
- **Flujo de Incorporación, Repositorio Estructurado y Bienvenida Post-Registro (2026-08-16 / 2026-08-17):**
  - **Pantalla Informativa Previa de Beneficios con Texto Editable:** Antes de iniciar el registro, el postulante visualiza una vista informativa con los beneficios clave de pertenecer a la red jurídica y un texto preliminar editable respaldado en la configuración común de términos (`incorporacion_red`).
  - **Opción "No tengo experiencia laboral" (Primera Oportunidad):** Se incorpora la casilla para postulantes recién graduados o noveles, liberando la obligatoriedad de registrar cargos previos y catalogando el perfil adecuadamente.
  - **Repositorio Común de Archivos y Conceptos:** Convención estructurada de almacenamiento en Supabase Storage (`{negocio}/{usuario_id}/{concepto}/{referencia_id}/{tipo}-{uuid}-{nombre}`) permitiendo categorizar archivos de registro, drive personal, trámites, análisis, expedientes y contratos.
  - **Pantalla de Bienvenida Post-Registro (Estado en Revisión):** Al enviar la solicitud, el postulante recibe una pantalla de bienvenida con el rastreador de fases de acreditación (SENESCYT, Foro de Abogados, Aprobación) y acceso directo a su menú de cliente mientras se aprueba su postulación.
  - **Ciclo de Vida de Solicitud Activa, Reinicio y Eliminación:** Si el usuario inicia el registro como abogado y no lo termina o se encuentra en estado no aprobado (`incompleta`, `borrador`, `enviada`, `en_revision`, `rechazada`), visualiza en el menú de inicio (`/panel`) la tarjeta interactiva de postulación activa con las opciones de:
    1. *✏️ Continuar / Editar Solicitud:* Navegación directa al formulario para completar o ajustar sus datos.
    2. *🔄 Reiniciar Solicitud:* Limpieza de datos y archivos previos para comenzar un nuevo proceso limpio desde el Paso 0.
    3. *🗑️ Eliminar Solicitud:* Cancelación y supresión definitiva de la solicitud activa no aprobada mediante el Stored Procedure `tranqui_legal.trq_fn_eliminar_solicitud_propia()`, liberando su perfil para postularse en el futuro.
    4. *Inactivación Automática:* La solicitud deja de mostrarse como postulación activa cuando el usuario la elimina o cuando se culmina el ciclo de firma y aprobación final.
  - **Aprobación, Descarga Word (.docx) y Firma de Contrato:**
    1. Al ser aprobada la postulación, el postulante visualiza el banner esmeralda de aprobación con botón directo para descargar su plantilla pre-llenada en formato Word (`.docx`) o imprimir en PDF.
    2. El postulante carga el contrato firmado (manuscrito o electrónico) y lo envía a revisión final.
    3. El operador confirma el contrato, asigna el rol definitivo `ABOGADO` y el perfil se publica en el carrusel de abogados verificados de la landing page (`/api/abogados-publicos`).
  - **Reenvío Multicanal de Notificación de Aceptación:** El operador dispone de un botón directo para reenviar las alertas y enlaces de descarga/firma al correo del postulante vía SMTP, In-App y Push.
  - **Centro de Notificaciones Interactivo con 3 Acciones:**
    1. *✅ Aceptar (Confirmar Lectura):* Marca como leída y traslada la notificación a la pestaña permanente de *Historial*.
    2. *⏰ Posponer (Snooze):* Pausa la notificación por 3h, 6h, 12h, 24h o tiempo personalizado antes de volver a alertar.
    3. *🗑️ Eliminar (Descartar):* Oculta la notificación para el usuario manteniendo el registro inmutable en base de datos para auditoría.

## Pendiente

- Gestión de casos judiciales (`trq_caso_judicial`).
- Firma electrónica de escritos (PAdES local, sin custodia de `.p12`).
- Apps nativas Cliente y Abogado.
