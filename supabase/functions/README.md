# supabase/functions

Edge Functions. Única ubicación permitida para usar la `service_role` key. Ver [`gobernanza/politicas/seguridad-y-datos.md`](../../gobernanza/politicas/seguridad-y-datos.md).

| Función | Qué hace | `verify_jwt` | Qué autentica la llamada |
| :--- | :--- | :--- | :--- |
| `restablecer-contrasena` | Cambia la contraseña vía Admin API a partir de un token de recuperación | `false` | El propio token: 256 bits de entropía, hasheado en la tabla, de un solo uso, expira en 30 min |
| `enviar-correo` | Envía un correo con el SMTP que el negocio configuró (`PLT-008`) | `false` | La cabecera `x-correo-clave`, comparada en tiempo constante contra el secreto `CORREO_FUNCION_CLAVE` |

Ambas llevan `verify_jwt=false` por el mismo motivo: sirven flujos donde el usuario **no tiene sesión** (llegó por un enlace de correo, o todavía se está registrando). Que no haya JWT no significa que no haya autenticación — la columna de la derecha es lo que la sustituye en cada caso.

## Desplegar

```bash
npx supabase functions deploy enviar-correo --no-verify-jwt --project-ref oaybbpdxhlxjbpwnoymy
```

`enviar-correo` necesita además el secreto compartido, que debe ser **el mismo valor** que la variable `CORREO_FUNCION_CLAVE` de los proyectos de Vercel:

```bash
npx supabase secrets set CORREO_FUNCION_CLAVE=<valor> --project-ref oaybbpdxhlxjbpwnoymy
```

Sin ese secreto la función responde `500` y no envía nada — es deliberado: sin él sería un relay de correo abierto contra el buzón del negocio. Ver [`ADR-0005`](../../gobernanza/arquitectura/adr/0005-smtp-por-negocio.md), decisión 5.
