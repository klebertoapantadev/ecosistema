---
tipo: esp_funcional
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tranqi — Especificación Funcional

**Prefijo de tabla:** `trq_` · **Esquema:** `tranqui_legal`

## Identidad y autenticación

Ver especificación de [Plataforma](../plataforma/especificacion-funcional.md) — PLT-001 (identidad única + bienvenida), PLT-002 (MFA), PLT-003 (membresías), PLT-011 (configuración + widgets). Sin adiciones de Tranqi al mecanismo en sí.

**✅ Implementado y verificado (2026-07-27):** registro (Google OAuth + correo/contraseña), pantalla de bienvenida, configuración del negocio, gestión de usuarios/roles (el widget). Ver [`especificacion-tecnica.md`](especificacion-tecnica.md) y el README de cada módulo en `apps/tranqi-web/modulos/`.

**Lo que Tranqi agrega:** enviar la solicitud de socio abogado es uno de los flujos "críticos" que exige MFA (PLT-002) — ver TRQ-xxx más abajo. Rol `ABOGADO` (PLT-003) no otorga capacidades hasta que `trq_abogado` esté verificado.

## Chat conversacional

Ver PLT-004. Agente asignado hoy: variables de entorno `ARIA_*` de `apps/tranqi-web` (buddie de la landing). Pendiente de migrar a `comun_agentes` cuando exista (ver especificacion-tecnica.md de Plataforma).

## Entregable 1 — en curso

Identidad de usuario (registro, MFA) y solicitud de registro de socios abogados. Detalle completo del modelo de datos, máquina de estados y plan de sprints en el documento de trabajo `Plan_Entregable_1_Tranqi_Identidad_Socios.md` (raíz del proyecto, pendiente de trasladar a este archivo por requerimiento a medida que se implementa cada sprint).

### Requerimientos identificados (a formalizar con código TRQ-xxx en GitHub Issues)

- Solicitud de registro como socio abogado (20 campos, ver plan de trabajo).
- Revisión y aprobación/rechazo de solicitud por administrador.
- Verificación asistida de matrícula profesional (Foro de Abogados) y título (SENESCYT) — manual, con enlace pre-rellenado a los portales oficiales.

## Pendiente

- Gestión de casos judiciales (`trq_caso_judicial`).
- Firma electrónica de escritos (PAdES local, sin custodia de `.p12`).
- Apps nativas Cliente y Abogado.
