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
  cobertura por provincia, experiencia laboral, verificación asistida) → panel admin (widget "Socios") →
  revisión y aceptar/rechazar → si se acepta, rol `ABOGADO` asignado automáticamente.
- **Corrección de alcance sobre MFA (PLT-002):** enviar la solicitud **no** requiere MFA. MFA se exige
  para activar las capacidades reales de un socio ya aceptado (agenda, casos — todavía no construidas),
  no para postular. Un cliente que ya configuró MFA en un flujo de pago previo (proceso crítico) ya lo
  cumpliría sin repetir el paso. MFA en sí no está implementado en el código todavía — la columna
  `trq_abogado.abg_mfa_verificado` deja el esquema listo para cuando exista.
- **Verificación asistida de matrícula profesional (Foro de Abogados) y título (SENESCYT)** — manual,
  autodeclarada por el solicitante (checkbox + enlace a cada portal) y confirmada por el administrador al
  revisar, no automatizada.
- **Pendiente:** carga de documentos de respaldo (`trq_documento_socio` modelada, sin UI — no existe
  ningún bucket de Supabase Storage en el proyecto todavía) y cifrado real de cédula/matrícula
  (`pgp_sym_encrypt` con Supabase Vault — hoy protegidas solo por RLS, decisión de gestión de claves
  pendiente de análisis propio).

## Pendiente

- Gestión de casos judiciales (`trq_caso_judicial`).
- Firma electrónica de escritos (PAdES local, sin custodia de `.p12`).
- Apps nativas Cliente y Abogado.
