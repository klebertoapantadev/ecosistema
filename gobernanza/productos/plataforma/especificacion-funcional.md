---
tipo: esp_funcional
estado: vigente
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Plataforma — Especificación Funcional Común

**Prefijo de código de requerimiento:** `PLT-xxx`
**Propietario:** Plataforma (no un producto individual)

Este documento describe **comportamiento compartido por los 3 productos** (y por cualquier producto nuevo que se incorpore). Ningún producto redefine estos requerimientos en su propia especificación — los referencia por código y documenta solo lo adicional o distinto.

**Regla de precedencia:** esta especificación se escribe y aprueba **antes** de que un producto nuevo construya su propio login, su propio chat o su propia facturación. Si dos productos necesitan comportamientos de auth genuinamente distintos, es señal de que este documento está incompleto — se corrige aquí, no duplicando en cada producto.

---

## PLT-001 — Identidad única de usuario

Un usuario tiene **un solo perfil** en todo el ecosistema, sin importar en cuántos productos participa.

- Registro con Google OAuth 2.0 o correo + contraseña.
- Al registrarse, se solicitan datos básicos: nombres, apellidos, cédula, teléfono/WhatsApp, provincia y ciudad de residencia.
- Un mismo correo/cuenta de Google identifica al mismo usuario en Tranqi, FastFix y Tinkay — no hay registro duplicado por producto.
- El usuario puede tener **roles distintos en productos distintos** (ej. cliente en Tinkay, abogado verificado en Tranqi).

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1 (`comun_seguridad`).

## PLT-002 — Autenticación multifactor (MFA) para procesos críticos

- MFA por TOTP (compatible con Google Authenticator), vía Supabase Auth.
- **No es obligatorio para navegar o consultar** — es obligatorio para ejecutar una acción crítica: enviar una solicitud con datos sensibles, aprobar/rechazar algo, procesar un pago, o cualquier transición de estado irreversible.
- Cada producto define en su propia especificación **cuáles** de sus flujos son "críticos" a este efecto (ej. Tranqi: enviar solicitud de socio abogado). La *mecánica* de exigir MFA es común; la *lista de qué la dispara* es de cada producto.

## PLT-003 — Membresías y roles por producto

- Un usuario puede solicitar o recibir un rol distinto en cada producto (`CLIENTE`, `ADMIN`, y roles específicos de cada negocio como `ABOGADO` en Tranqi).
- **Tener un rol no equivale a tener capacidades.** Algunos roles requieren un proceso de verificación adicional antes de habilitar acceso real (ver la especificación del producto correspondiente — ej. Tranqi PLT-relacionado TRQ-xxx de solicitud de socio).
- Un usuario administrador de un producto no tiene automáticamente acceso a los otros — el rol es por producto.

## PLT-004 — Buddie conversacional (chat con agente de IA)

- Todo producto puede ofrecer un asistente conversacional en su interfaz ("buddie"), respaldado por un agente de ARIA.
- El agente puede ser **distinto por producto y por rol** dentro de un mismo producto (ej. un agente para clientes de Tranqi y otro para sus abogados).
- Si el agente no está disponible o no hay credenciales configuradas, el chat responde con texto de respaldo predefinido — la interfaz nunca se cae por esto.
- Las conversaciones no requieren que el usuario esté autenticado para la interacción básica de bienvenida (ej. landing pública), pero sí para funciones que toquen datos del usuario.

**Implementación técnica:** ver [ADR-0002](../../arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).

## PLT-005 — Auditoría de cambios visible para administradores

- Todo cambio de datos relevante queda registrado automáticamente (quién, cuándo, qué cambió), sin que el usuario final lo note.
- Los roles `SUPERADMIN` y `ADMINISTRADOR` de cualquier producto pueden consultar el historial de cambios de su propio dominio de datos en `/admin/auditoria`, con vista de diff (antes/después).

## PLT-006 — Facturación y pagos

- Todo cobro del ecosistema (cualquier producto) se factura contra el SRI de Ecuador de forma centralizada.
- El pago se procesa a través de una pasarela abstraída — el usuario no percibe diferencia según qué proveedor de pago esté activo detrás.

## PLT-007 — Catálogo geográfico

- Provincias y ciudades de Ecuador son un catálogo único, consultado por cualquier producto que necesite dirección, cobertura o zona de servicio (Tranqi: residencia/cobertura de abogados; FastFix: zona de técnicos; Tinkay: dirección de entrega).

---

## Cómo referenciar esto desde la especificación de un producto

En `gobernanza/productos/{producto}/especificacion-funcional.md`, en vez de describir el login o el chat desde cero:

```markdown
## Identidad y autenticación

Ver especificación de Plataforma (PLT-001, PLT-002, PLT-003). Sin adiciones específicas de este producto.

## Chat conversacional

Ver PLT-004. Agente asignado: "{nombre del agente}" — ver especificacion-tecnica.md de este producto para el ID de agente en ARIA.
```

Solo se documenta en el producto lo que **cambia o se agrega** respecto a esta especificación.
