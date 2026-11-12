# supabase/functions

Edge Functions. Única ubicación permitida para usar la `service_role` key. Ver [`gobernanza/politicas/seguridad-y-datos.md`](../../gobernanza/politicas/seguridad-y-datos.md).

| Función | Qué hace | `verify_jwt` | Qué autentica la llamada |
| :--- | :--- | :--- | :--- |
| `restablecer-contrasena` | Cambia la contraseña vía Admin API a partir de un token de recuperación | `false` | El propio token: 256 bits de entropía, hasheado en la tabla, de un solo uso, expira en 30 min |
| `enviar-correo` | Envía un correo con el SMTP que el negocio configuró (`PLT-008`) | `false` | La cabecera `x-correo-clave`, comparada en tiempo constante contra el secreto `CORREO_FUNCION_CLAVE` |
| `plux-webhook` | Confirma los pagos con PLUX y activa la suscripción (`TRQ-ADM-004`) | `false` | Basic con las credenciales de API de PLUX guardadas en `psc_credenciales_privadas`, comparado en tiempo constante |
| `facturacion-sri` | Worker de facturación electrónica (`PLT-006`): firma XAdES-BES, envío al SRI, autorización, XML y RIDE a Storage, correo | `false` | La cabecera `x-facturacion-clave`, comparada en tiempo constante contra el secreto `FACTURACION_FUNCION_CLAVE` |
| `facturacion-certificado` | Valida y guarda en Vault el `.p12` de firma de un negocio (`PLT-006`) | `true` | El JWT del usuario: perfil ADMINISTRADOR del negocio y MFA (`aal2`) |
| `invocar-aria` | Invoca el agente ARIA activo del negocio descifrando `ARIA_AGENT_KEY` desde Vault (`PLT-008` / `ADR-0002`) | `false` | Cabecera `x-aria-clave` en tiempo constante para llamadas privilegiadas o cuando `ARIA_FUNCION_CLAVE` está definida; acotación estricta (`prompt <= 1000` sin herramientas privadas) para el chat público de vitrina |

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

## Facturación electrónica SRI (`facturacion-sri`, `facturacion-certificado`)

Diseño en [ADR-0007](../../gobernanza/arquitectura/adr/0007-facturacion-electronica-sri.md). El código compartido está en `_compartido/sri/` (Supabase no despliega las carpetas que empiezan por `_`).

Desplegar:

```bash
npx supabase functions deploy facturacion-sri --no-verify-jwt --project-ref oaybbpdxhlxjbpwnoymy
npx supabase functions deploy facturacion-certificado --project-ref oaybbpdxhlxjbpwnoymy
npx supabase secrets set FACTURACION_FUNCION_CLAVE=<valor largo aleatorio> --project-ref oaybbpdxhlxjbpwnoymy
```

Con quién se conecta el worker (una vez, en el SQL Editor; mismo valor de clave que el secreto):

```sql
select vault.create_secret('https://oaybbpdxhlxjbpwnoymy.supabase.co/functions/v1/facturacion-sri', 'facturacion_funcion_url');
select vault.create_secret('<el mismo valor de FACTURACION_FUNCION_CLAVE>', 'facturacion_funcion_clave');
```

Sin esos dos secretos `fac_fn_despertar_worker()` no hace nada (los comprobantes se quedan en `PENDIENTE`). `comun_facturacion` tiene que estar en los esquemas expuestos de PostgREST, igual que `comun_comercio`.

**Producción, cerrada por defecto:** la función solo envía comprobantes de ambiente 2 si además existe el secreto `FACTURACION_PERMITIR_PRODUCCION=true`. Antes de eso, un superadmin habilita el negocio (`fac_fn_habilitar_produccion`) y su administrador, con MFA, cambia el ambiente (`fac_fn_cambiar_ambiente`), que exige una factura ya autorizada en pruebas.

Puesta en marcha de un negocio (en pruebas): datos del emisor (`fac_fn_guardar_emisor`), `.p12` por `facturacion-certificado`, SMTP del negocio activo (`PLT-008`, para enviar XML y RIDE al comprador) y una factura de prueba hasta ver `AUTORIZADO`.

Pruebas (desde `supabase/functions`, con Deno 2):

```bash
deno test --allow-read --allow-run=python _compartido/sri/pruebas/ facturacion-sri/
# Verificación independiente de la firma XAdES con signxml (python con signxml==4.0.3 y cryptography<45):
XADES_PYTHON=/ruta/a/python deno test --allow-read --allow-write --allow-env --allow-run _compartido/sri/pruebas/firma_test.ts
# Contra el SRI de pruebas (celcer), 1 petición, se espera un DEVUELTA por RUC ficticio:
SRI_PRUEBAS=1 deno test --allow-read --allow-env --allow-net=celcer.sri.gob.ec facturacion-sri/sri-celcer_test.ts
```

La validación contra los XSD oficiales usa `python` con `lxml` (`_compartido/sri/pruebas/validar_xsd.py`). Las políticas RLS y las RPC se prueban con `supabase test db` (`supabase/tests/comun_facturacion.sql`).

## Agente conversacional ARIA por negocio (`invocar-aria`)

Desplegar tras aplicar la migración `20261111000002_cfg_aria_por_negocio_y_widget.sql`:

```bash
npx supabase functions deploy invocar-aria --no-verify-jwt --project-ref oaybbpdxhlxjbpwnoymy
```

`comun_configuracion` debe estar expuesto en PostgREST (ya lo está para `enviar-correo`). Opcionalmente, para exigir secreto compartido en todas las llamadas desde Route Handlers de Next.js:

```bash
npx supabase secrets set ARIA_FUNCION_CLAVE=<valor> --project-ref oaybbpdxhlxjbpwnoymy
```
