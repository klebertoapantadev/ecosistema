---
tipo: politica
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Gestión de Credenciales y Secretos

## 1. Decisión de plataforma

El ecosistema **no almacena valores de secretos** en una base de datos propia ni en un repositorio construido a medida. Se delega a un gestor de secretos externo (Doppler o Infisical), que inyecta variables en Vercel, GitHub Actions y los builds de apps nativas sin que el valor pase por manos del equipo directamente en texto plano.

Razón: concentrar los secretos de tres productos en producción —con facturación SRI y datos personales cifrados— detrás de una aplicación propia y sin auditoría externa es un riesgo desproporcionado frente al beneficio de construirlo internamente.

## 2. Qué gobierna el ecosistema (metadatos, no valores)

Si más adelante se requiere un inventario propio, se limita estrictamente a:

| Se administra | No se almacena |
| :--- | :--- |
| Qué credenciales existen, para qué proyecto y ambiente | El valor del secreto |
| Responsable (owner) de cada credencial | Claves privadas, `.p12`, `service_role` keys |
| Fecha de última rotación y alerta de vencimiento | Tokens de pasarelas de pago |
| Quién debe tener acceso, por rol de `seg_membresia` | — |
| Enlace al gestor externo donde se obtiene el valor | — |
| Bitácora de accesos y rotaciones | — |

## 3. Reglas de manejo

- Ninguna credencial de producción se comparte por chat, correo o documento plano.
- `service_role` de Supabase: solo en variables de entorno de Edge Functions y de GitHub Actions con scope restringido. Nunca en `NEXT_PUBLIC_*`, nunca en el bundle de una app nativa.
- Rotación obligatoria ante salida de cualquier persona con acceso, y calendarizada al menos cada 6 meses para credenciales de pasarela de pago y SRI.
- Credenciales de ambiente de desarrollo y de producción son distintas siempre; nunca se reutiliza una clave de producción en local.

## 4. Si en el futuro se decide construir un repositorio propio

Condiciones mínimas no negociables, sin excepción:

- Cifrado con Supabase Vault / `pgsodium` — no `pgp_sym_encrypt` con clave en variable de entorno.
- Clave maestra fuera de la base de datos.
- Descifrado únicamente en Edge Function, con verificación de rol previa.
- Sin endpoint que liste valores en claro.
- Revelado individual con expiración corta, registrado en la bitácora de accesos.
- Rotación forzada calendarizada.
- Exclusión explícita: credenciales de producción de pagos y del SRI no entran en este repositorio bajo ninguna circunstancia.

Este escenario requiere un ADR explícito antes de implementarse.
