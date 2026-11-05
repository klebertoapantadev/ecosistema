# supabase/functions

Edge Functions. Única ubicación permitida para usar la `service_role` key. Ver [`gobernanza/politicas/seguridad-y-datos.md`](../../gobernanza/politicas/seguridad-y-datos.md).

| Función | Qué hace | `verify_jwt` | Qué autentica la llamada |
| :--- | :--- | :--- | :--- |
| `restablecer-contrasena` | Cambia la contraseña vía Admin API a partir de un token de recuperación | `false` | El propio token: 256 bits de entropía, hasheado en la tabla, de un solo uso, expira en 30 min |
| `enviar-correo` | Envía un correo con el SMTP que el negocio configuró (`PLT-008`) | `false` | La cabecera `x-correo-clave`, comparada en tiempo constante contra el secreto `CORREO_FUNCION_CLAVE` |
| `plux-webhook` | Confirma los pagos con PLUX y activa la suscripción (`TRQ-ADM-004`) | `false` | Basic con las credenciales de API de PLUX guardadas en `psc_credenciales_privadas`, comparado en tiempo constante |

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

## plux-webhook (PLUX / PagoPlux)

Desplegar:

```bash
npx supabase functions deploy plux-webhook --no-verify-jwt --project-ref oaybbpdxhlxjbpwnoymy
```

Activar PLUX para un negocio (la fila la crea la migración `20261104000001`, inactiva y sin credenciales). Las credenciales son las de *Developers → Clave de API's* del dashboard de PLUX: `cliente_id` es el *Id Cliente* y `clave_secreta` la *Clave Secreta*. Se cargan a mano, nunca en una migración:

```sql
update comun_comercio.com_pasarela_configuracion
   set psc_credenciales_privadas = jsonb_build_object('cliente_id', '<id>', 'clave_secreta', '<clave>'),
       psc_detalle_pasarela = jsonb_build_object('visibilidad', 'PROBADORES', 'probadores', jsonb_build_array('probador@ejemplo.com')),
       psc_activo = true
 where psc_negocio = 'tranqi' and psc_pasarela = 'PLUX';
```

En el dashboard de PLUX, *Developers → Web hook*: URL `https://oaybbpdxhlxjbpwnoymy.supabase.co/functions/v1/plux-webhook?negocio=tranqi`, la misma credencial de API, tipo *Pago Tarjeta* y estado activo. PLUX admite una sola URL de webhook por comercio.

Visibilidad (`com_fn_pasarela_visible`): en `PRUEBAS` la pasarela solo la ven los superadmins y los correos de `probadores`, salvo que `visibilidad = 'TODOS'` la abra a todos de forma explícita. **Estado desde el 5-nov-2026:** PLUX de tranqi en sandbox con `visibilidad = 'TODOS'`, por decisión de producto: cualquiera que pague con una tarjeta de prueba de PLUX activa un plan sin cobro real. Para volver a cerrarlo, `visibilidad = 'PROBADORES'`. Pasar a cobro real = credenciales de producción de PLUX (tras su certificación) y `psc_ambiente = 'PRODUCCION'`.

**Requisito de API:** `comun_comercio` tiene que estar en los esquemas expuestos de PostgREST (*Settings → API → Exposed schemas*, o `PATCH /v1/projects/{ref}/postgrest` con `db_schema`). Sin él fallan el webhook y las acciones del checkout (`PGRST106 Invalid schema`). Se añadió en producción el 5-nov-2026. Al exponerlo, `authenticated` no puede leer `psc_credenciales_privadas` (migración `20261105000001`).

Sin credenciales o con la fila inactiva la función responde `503` y no confirma nada.
