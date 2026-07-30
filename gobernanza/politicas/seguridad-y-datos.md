---
tipo: politica
estado: vigente
version: 1.1
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Política de Seguridad y Datos

Para vulnerabilidades de dependencias, SLA de parcheo y el nivel de referencia OWASP ASVS por producto, ver [`seguridad-dependencias.md`](seguridad-dependencias.md).

## 1. Row Level Security

RLS habilitado en el 100% de las tablas, sin excepciones temporales. Ninguna tabla llega a `master` sin política definida — ver [Definition of Done](../estandares/03-definition-of-done.md).

## 2. Autenticación

Supabase Auth es la única fuente de identidad del ecosistema, compartida por las 6 aplicaciones vía `comun_seguridad.seg_usuario` / `seg_membresia`.

### 2.1. Métodos habilitados

- Google OAuth 2.0.
- Correo electrónico + contraseña.
- Biometría nativa (delegada al SO, no reemplaza la sesión de Supabase).

### 2.2. Google OAuth en apps nativas — advertencia obligatoria

Google **bloquea** el flujo OAuth por redirección dentro de un WebView (`disallowed_useragent`), y Capacitor corre en WebView. Las apps nativas deben usar el **SDK nativo de Google Sign-In**, obtener el ID token, y autenticar con:

```ts
supabase.auth.signInWithIdToken({ provider: 'google', token })
```

Los portales web usan el flujo de redirección estándar. No intercambiar estos dos mecanismos entre tipos de app.

### 2.3. Creación de perfil

Trigger sobre `auth.users` inserta la fila correspondiente en `comun_seguridad.seg_usuario` al primer registro. El paso de completar datos básicos ocurre después, en la aplicación.

## 3. MFA (TOTP)

- Compatible con Google Authenticator vía el TOTP nativo de Supabase Auth (`mfa.enroll` / `challenge` / `verify`).
- **Obligatorio** para: roles administrativos, procesos que exponen datos sensibles (cédula, expedientes, documentos profesionales) y cualquier transición de estado irreversible (aprobar una solicitud, procesar un pago).
- **Se exige en RLS, no solo en la interfaz.** El JWT incluye el claim `aal` (`aal1` = solo contraseña, `aal2` = MFA verificado). Las políticas de escritura sobre tablas sensibles requieren:

```sql
using (auth.jwt() ->> 'aal' = 'aal2')
```

Si la exigencia de MFA vive únicamente en el frontend, no está exigida — cualquier llamada directa a la API la evade.

## 4. Rol en el token

Un *Custom Access Token Hook* inyecta el rol de `seg_membresia` como claim del JWT, evitando una subconsulta a `seg_membresia` en cada política RLS.

**Rol no es lo mismo que capacidad.** Un rol otorgado (ej. `ABOGADO`) no habilita acceso por sí solo si el proceso de negocio requiere un estado adicional (ej. verificación aprobada en `trq_abogado`). Las políticas RLS deben verificar el estado real, no solo el rol. Ver `Plan_Entregable_1_Tranqi_Identidad_Socios.md` §5 para el caso concreto de Tranqi.

## 5. Datos sensibles

| Control | Aplicación |
| :--- | :--- |
| Cifrado en columna | `pgp_sym_encrypt` para cédula, matrícula profesional, notas de expediente, y cualquier campo equivalente por producto |
| Enmascaramiento en lectura | `seg_enmascarar_texto()` por defecto (ej. `1715***890`); el valor en claro solo para el propio titular y roles explícitamente autorizados |
| Documentos | Supabase Storage en bucket **privado**. Acceso solo por URL firmada de vida corta emitida tras verificar rol. Nunca bucket público para documentos con datos personales |
| Auditoría | El trigger de auditoría no debe registrar en claro el contenido de columnas cifradas — verificar explícitamente en cada tabla nueva con datos sensibles |

## 6. Auditoría

`aud_fn_auditar_tabla()` en el 100% de las tablas de negocio. Captura `INSERT` (estado nuevo), `DELETE` (estado anterior), `UPDATE` (ambos), con autoría resuelta vía `auth.uid()`. Sin instrumentación manual en frontend o backend. Ver el TRD original §3 para el detalle del mecanismo.

## 7. Pasarela de pagos

Integración vía API abstraída, agnóstica de proveedor. Toda operación con credenciales de la pasarela vive en Edge Function. Todo webhook entrante valida su firma antes de procesar.

## 8. Transiciones de estado críticas

Ninguna transición de estado irreversible o sensible (aprobar, rechazar, procesar pago, activar cuenta) se ejecuta con un `UPDATE` directo desde el cliente. Se ejecuta vía RPC transaccional que valida precondiciones y aplica todos los efectos relacionados de forma atómica.

## 9. Restricción de columnas en filas auto-editables (obligatorio)

**RLS filtra filas, no columnas.** Una política `for update using (usu_id = auth.uid())` permite al usuario modificar *cualquier* columna de su propia fila — incluidos campos privilegiados como `usu_superadmin_plataforma` — si no se restringe aparte. Esto pasó en producción: la política de `seg_usuario` permitía auto-escalar a SuperAdmin con un `PATCH` directo a la API, sin pasar por la UI (corregido 2026-07-27, ver `supabase/migrations/20260727000006_*.sql`).

**Regla:** toda tabla donde el propio usuario edita su fila (perfil, configuración) debe **revocar `UPDATE` de tabla completa** y otorgar `GRANT UPDATE` solo sobre las columnas editables por el usuario:

```sql
revoke update on {esquema}.{tabla} from authenticated;
grant update (columna_a, columna_b, ...) on {esquema}.{tabla} to authenticated;
```

Columnas de identidad (`*_id`), de auditoría (`*_creado_en`) y cualquier flag de privilegio (`*_superadmin_*`, `*_rol`, `*_estado` cuando representa una transición crítica) quedan fuera del `GRANT` — se escriben solo vía función `SECURITY DEFINER` (ver §8) o por un admin.
