---
tipo: arquitectura
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Stack Tecnológico del Ecosistema

## 1. Tabla de stack

| Capa | Tecnología | Justificación |
| :--- | :--- | :--- |
| Repositorio fuente | GitHub — monorepo `ecosistema` (Turborepo + pnpm) | Historial único de migraciones de base de datos compartida. Ver [`marco-de-trabajo.md`](marco-de-trabajo.md) §1. |
| Frontend web / PWA | Next.js (React) + Vanilla CSS | Portales (landing + admin) en Vercel Edge Runtime. |
| Apps móviles nativas | Capacitor (Android / iOS) sobre Vite + React | Tranqi Cliente, Tranqi Abogado, FastFix Cliente. |
| Base de datos y BaaS | Supabase (PostgreSQL multi-esquema) | Instancia única. Esquemas `comun_*` + un esquema por negocio. |
| Auditoría | `aud_fn_auditar_tabla()` en el 100% de las tablas de negocio | Trigger homogéneo, sin instrumentación manual en frontend/backend. |
| Pasarela de pagos | API abstraída + verificación de firma de webhook | Agnóstico a proveedor (Payphone, Datafast, Kushki, PlacetoPay). |
| Automatización | Supabase Triggers + Edge Functions | Sin orquestador externo (no n8n) salvo excepción documentada como ADR. |
| Seguridad | Supabase RLS al 100% + `pgcrypto` (`pgp_sym_encrypt`) | Ver [`politicas/seguridad-y-datos.md`](../politicas/seguridad-y-datos.md). |
| Data masking | `seg_enmascarar_texto()` en PL/pgSQL | Ofuscamiento dinámico de datos sensibles en lectura. |
| Autenticación y MFA | Supabase Auth: Google OAuth 2.0 + correo/contraseña + biometría nativa. TOTP obligatorio para procesos críticos. | Ver detalle de flujo por tipo de app en `politicas/seguridad-y-datos.md` §3. |
| IA para análisis documental | API de Claude (`claude-opus-5` síntesis, `claude-sonnet-5` extracción rutinaria) | Gemini permanece disponible para casos de uso de producto; la elección de motor por flujo se documenta como ADR. |
| Gestión de secretos | Gestor externo (Doppler / Infisical) | El ecosistema no almacena valores de credenciales en base de datos propia. Ver `politicas/gestion-credenciales.md`. |
| Gestión de trabajo | GitHub Issues + GitHub Projects (v2) | Un solo Project, campos personalizados por producto/tipo/estado. |

## 2. Dos runtimes, una restricción

Los portales web usan Next.js con Server Components y Server Actions. Las apps nativas usan Vite + React + Capacitor — una SPA que habla directo con Supabase bajo RLS, sin servidor intermedio.

**Restricción de CI:** ningún paquete en `packages/primitivas` ni `packages/core` puede importar `next/*`. Se pierde la posibilidad de reutilizarlo en las apps nativas en el momento en que lo hace.

## 3. Qué se decidió no construir

| No se construye | Se usa en su lugar |
| :--- | :--- |
| Gestor de tareas propio | GitHub Issues + Projects |
| Wiki / editor de documentos propio | Markdown en `gobernanza/` + flujo normal de PR |
| Bóveda de secretos propia | Gestor externo |
| CI/CD propio | GitHub Actions + Vercel |
| Portal separado que duplique los artefactos de Git | Los artefactos viven en el repo; una capa de consulta se evalúa solo si el volumen lo justifica más adelante |

Cada fila de esta tabla es una decisión activa, no una omisión. Cambiarla requiere un ADR en [`arquitectura/adr/`](adr/).
