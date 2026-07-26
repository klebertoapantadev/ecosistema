---
tipo: politica
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Política de Salud de Seguridad y Dependencias

**Origen:** el primer despliegue de `tranqi-web` quedó bloqueado por Vercel al detectar una vulnerabilidad conocida en la versión de Next.js fijada (15.1.6). El problema no era la vulnerabilidad en sí — es normal que aparezcan — sino que no existía ningún mecanismo que la detectara **antes** del deploy. Esta política existe para que la próxima vez se detecte en un PR, no en producción.

## 1. Principio rector: fijar versión exacta, actualizar por PR revisado

Ningún `package.json` de este ecosistema usa rangos flotantes (`^`, `~`) en dependencias de producción. Se fija la versión exacta que se probó, y las actualizaciones — incluidas las de seguridad — llegan como **Pull Requests automáticos de Dependabot**, revisados como cualquier otro PR.

**Por qué:** un rango flotante (`^15.1.6`) hace que dos instalaciones del mismo commit puedan traer versiones distintas según el momento — imposible de auditar y de reproducir un incidente. Fijar la versión y dejar que un bot proponga el salto en un PR explícito da control sin perder velocidad de parcheo.

## 2. Referencia de estándar: OWASP ASVS

El ecosistema usa [OWASP ASVS](https://owasp.org/www-project-application-security-verification-standard/) (Application Security Verification Standard) como referencia de qué controles de seguridad de aplicación deben existir, no solo de dependencias.

| Producto | Nivel ASVS objetivo | Por qué |
| :--- | :--- | :--- |
| **Tranqi** | **L2** (aplicaciones con datos sensibles) | Cédulas, expedientes legales, firma electrónica. El nivel más alto del ecosistema. |
| FastFix, Tinkay | L1 (higiene básica), L2 en flujos de pago | L1 aplica siempre; los flujos que tocan pagos o PII suben a L2. |

Los controles ya definidos en [`seguridad-y-datos.md`](seguridad-y-datos.md) cubren buena parte de ASVS L2 sin necesidad de reinventar nada — se listan aquí el mapeo explícito para que quede trazable:

| Categoría ASVS | Control ya exigido en este ecosistema |
| :--- | :--- |
| V2 — Autenticación | Supabase Auth + MFA TOTP obligatorio en procesos críticos, exigido en RLS vía claim `aal` |
| V3 — Gestión de sesión | Sesión de Supabase Auth (`@supabase/ssr`), sin tokens propios |
| V4 — Control de acceso | RLS al 100% de las tablas; rol ≠ capacidad (verificación de estado real, no solo rol) |
| V8 — Protección de datos | `pgp_sym_encrypt` en columnas sensibles + `seg_enmascarar_texto()` por defecto |
| V9 — Comunicaciones | `service_role` nunca fuera de Edge Functions; HTTPS end-to-end vía Vercel/Supabase |
| V10 — Configuración maliciosa/manejo de código | Esta política (escaneo de dependencias, SBOM diferido, CI de auditoría) |
| V14 — Configuración | Variables de entorno por ambiente, nunca compartidas entre dev/prod |

Lo que **no** está cubierto todavía y queda pendiente para cuando el equipo crezca: pruebas de penetración formales (ASVS V1 de gestión de riesgo a ese nivel) y un programa de bug bounty. Se documenta como omisión consciente, no como olvido.

## 3. Escaneo automático (mecanismo, no promesa)

| Mecanismo | Qué hace | Dónde |
| :--- | :--- | :--- |
| **Dependabot version updates** | Abre PR cuando hay una versión nueva de cualquier dependencia, semanalmente | `.github/dependabot.yml` |
| **Dependabot security updates** | Abre PR **inmediatamente** al publicarse un CVE en una dependencia usada, sin esperar al ciclo semanal | Habilitado a nivel de repositorio (GitHub Advisory Database) |
| **`pnpm audit` en CI** | Bloquea cualquier PR que introduzca una dependencia con vulnerabilidad `high` o superior | `.github/workflows/auditoria-dependencias.yml`, en cada PR |
| **`pnpm audit` programado** | Corre semanalmente aunque no haya PRs — captura CVEs publicados *después* de que el código ya se mergeó (exactamente lo que pasó con Next.js) | Mismo workflow, cron semanal, abre un issue si encuentra algo |
| **Dependabot para GitHub Actions** | Los workflows de CI también son superficie de ataque (supply chain) | `.github/dependabot.yml` |

## 4. SLA de parcheo por severidad

Basado en CVSS del aviso (GitHub Advisory / NVD). Tranqi tiene el SLA más estricto por manejar datos sensibles.

| Severidad (CVSS) | Tranqi | Resto del ecosistema |
| :--- | :--- | :--- |
| Crítica (9.0–10.0) | 24 horas | 48 horas |
| Alta (7.0–8.9) | 3 días | 7 días |
| Media (4.0–6.9) | 14 días | 30 días |
| Baja (0.1–3.9) | Próximo ciclo regular | Próximo ciclo regular |

**Regla de bloqueo:** una vulnerabilidad crítica o alta detectada en producción se trata como incidente — no espera al siguiente sprint planificado. Ver §6.

## 5. Escaneo de secretos

GitHub Secret Scanning + Push Protection habilitados a nivel de repositorio (bloquea un `git push` que contenga un patrón reconocible de credencial antes de que llegue al historial). Coherente con [`gestion-credenciales.md`](gestion-credenciales.md) — ninguna credencial real debería llegar a un commit, pero esta es la red de contención si pasa.

## 6. Registro de incidentes de seguridad

Toda vulnerabilidad crítica/alta detectada en producción (no en un PR) se registra en [`registro-incidentes-seguridad.md`](registro-incidentes-seguridad.md): qué se encontró, cómo, tiempo de remediación real vs. SLA, y causa raíz. El objetivo no es burocracia — es que el SLA de la tabla anterior sea verificable, no aspiracional.

## 7. SBOM (Software Bill of Materials) — diferido, no omitido

Generar un SBOM (formato CycloneDX o SPDX) por release es la práctica recomendada por NIST SSDF y la Executive Order 14028 de EE.UU. para trazabilidad de cadena de suministro. **Se difiere deliberadamente** mientras el equipo es de una persona — el costo de mantenerlo actualizado no se justifica todavía frente al beneficio. Se revisa esta decisión cuando el equipo crezca o un cliente/regulador lo exija contractualmente.

## 8. Aplicación de esta política

- Todo PR que actualice una dependencia de producción documenta en la descripción si el cambio es de seguridad (referenciando el CVE/advisory) o rutinario.
- El [Definition of Done](03-definition-of-done.md) incluye la verificación de esta política.
- Ningún `package.json` nuevo se aprueba con rangos `^`/`~` en `dependencies` (sí se permite en `devDependencies` de bajo riesgo, a discreción del revisor).
