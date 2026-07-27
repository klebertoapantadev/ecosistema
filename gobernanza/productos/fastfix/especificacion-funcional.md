---
tipo: esp_funcional
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# FastFix Home — Especificación Funcional

**Prefijo de tabla:** `ffh_` · **Esquema:** `fastfix_mantenimiento`

## Identidad y autenticación

Ver especificación de [Plataforma](../plataforma/especificacion-funcional.md) — PLT-001, PLT-002, PLT-003. Sin adiciones específicas de FastFix todavía.

**✅ Implementado (2026-07-27):** registro (Google OAuth + correo/contraseña) con consentimiento de términos, bienvenida, historial de accesos y baja de cuenta (PLT-012) — vía el paquete compartido `@eco/identidad` (ver [`especificacion-tecnica.md` de Plataforma](../plataforma/especificacion-tecnica.md) §1). Configuración del negocio y gestión de usuarios todavía no — solo existen en `tranqi-web` por ahora.

## Chat conversacional

Ver PLT-004. Agente de ARIA para FastFix: pendiente de asignar.

## Requerimientos de negocio

Sin requerimientos formalizados aún. Tercer producto en el orden recomendado, después de Tinkay.

Por ahora existe únicamente una página de validación (`apps/fastfix-web`) para probar que el monorepo despliega múltiples apps de forma independiente — no representa funcionalidad de negocio real todavía.
