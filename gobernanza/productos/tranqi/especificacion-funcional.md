---
tipo: esp_funcional
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tranqi — Especificación Funcional

**Prefijo de tabla:** `trq_` · **Esquema:** `tranqui_legal`

## Entregable 1 — en curso

Identidad de usuario (registro, MFA) y solicitud de registro de socios abogados. Detalle completo del modelo de datos, máquina de estados y plan de sprints en el documento de trabajo `Plan_Entregable_1_Tranqi_Identidad_Socios.md` (raíz del proyecto, pendiente de trasladar a este archivo por requerimiento a medida que se implementa cada sprint).

### Requerimientos identificados (a formalizar con código TRQ-xxx en GitHub Issues)

- Registro de usuario final (Google OAuth / correo+contraseña) — ecosistema, no exclusivo de Tranqi.
- Completar datos básicos de identidad.
- Enrolamiento MFA TOTP.
- Solicitud de registro como socio abogado (20 campos, ver plan de trabajo).
- Revisión y aprobación/rechazo de solicitud por administrador.
- Verificación asistida de matrícula profesional (Foro de Abogados) y título (SENESCYT) — manual, con enlace pre-rellenado a los portales oficiales.

## Pendiente

- Gestión de casos judiciales (`trq_caso_judicial`).
- Firma electrónica de escritos (PAdES local, sin custodia de `.p12`).
- Apps nativas Cliente y Abogado.
