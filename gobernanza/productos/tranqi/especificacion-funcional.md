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
- **Pendiente:** cifrado real de cédula/matrícula (`pgp_sym_encrypt` con Supabase Vault — hoy protegidas
  solo por RLS, decisión de gestión de claves pendiente de análisis propio) y envío real de las
  notificaciones encoladas.

## Pendiente

- Gestión de casos judiciales (`trq_caso_judicial`).
- Firma electrónica de escritos (PAdES local, sin custodia de `.p12`).
- Apps nativas Cliente y Abogado.
