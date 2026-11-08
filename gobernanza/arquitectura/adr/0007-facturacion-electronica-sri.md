---
tipo: adr
estado: propuesto
fecha: 2026-11-08
responsable: Kleber Toapanta
requerimiento: PLT-006
---

# ADR-0007 — Facturación electrónica SRI: cola en Postgres y firma en Edge Function

## Contexto

`PLT-006` exige que todo pago aprobado genere su factura electrónica autorizada por el SRI, y
`decisiones-validadas-negocio.md` §B fija un emisor por negocio (RUC, certificado `.p12` y secuenciales
propios). Hasta este ADR el ecosistema cobraba (`comun_comercio.com_transaccion_pago`) pero no emitía
nada: `comun_facturacion` estaba pendiente.

El SRI (esquema *offline*, ficha técnica v2.34) pide XML 1.1.0 firmado en XAdES-BES con RSA-SHA1, dos
web services SOAP (recepción y autorización), autorización diferida, conservación 7 años y entrega al
comprador del XML **y** del RIDE.

La lógica se toma de DOMO (`admintidomo-spec/domo` y `domo-backend`, Domo.Firma, sep-oct 2026), que la
resolvió en .NET con un worker propio.

## Decisión

1. **Esquema `comun_facturacion`** (`20261108000001_comun_facturacion.sql`): `fac_emisor`,
   `fac_certificado`, `fac_secuencial`, `fac_comprobante`, `fac_comprobante_linea` y `fac_evento`.
   Las tablas son de solo lectura para las sesiones (RLS) y toda escritura pasa por RPC (regla 5 de
   `AGENTS.md`).
2. **Emisión atómica en SQL** (`fac_fn_emitir_interno`). Asigna el secuencial y la clave de acceso una
   sola vez, antes de enviar nada al SRI, y nunca se renumera. Si el SRI contesta 43 (clave ya
   registrada), el worker pasa directamente a consultar la autorización.
3. **Cola en Postgres y firma en Edge Function** (`supabase/functions/facturacion-sri`), como indica el
   marco de trabajo. No se usa un servicio aparte como el de DOMO.
   - La función reclama los comprobantes con `FOR UPDATE SKIP LOCKED` (`fac_fn_tomar_lote`).
   - La despierta pg_cron cada minuto y, además, cada emisión, ambas vía pg_net.
   - La firma XAdES-BES se escribe sobre un serializador XML canónico propio (`xml.ts`), porque en Deno
     no hay C14N fiable. Se verifica con signxml como implementación independiente.
   - Para abrir el `.p12` se usa node-forge; la firma RSA la hace WebCrypto.
4. **Certificado en Vault**. Lo valida y lo guarda la Edge Function `facturacion-certificado`, que exige
   perfil ADMINISTRADOR y `aal2`. En la tabla solo quedan los uuid de los secretos, y el `.p12` solo lo
   descifra `service_role`.
5. **Tres cerrojos para no emitir en producción por accidente**:
   - El ambiente es 1 (pruebas) por defecto.
   - `emi_produccion_habilitada` solo la activa un superadmin, y el paso a ambiente 2 exige `aal2`,
     certificado vigente y una factura ya autorizada en pruebas.
   - La función no envía nada de ambiente 2 sin `FACTURACION_PERMITIR_PRODUCCION=true`.

   Con el emisor en producción, un pago simulado o de una pasarela en sandbox no se factura.
6. **Factura automática por disparador** sobre `com_transaccion_pago` (`APROBADO`):
   - Usa el snapshot `datos_facturacion` del checkout.
   - Si falla, queda un evento y el pago sigue aprobado: la facturación nunca rompe un cobro.
   - Una factura a consumidor final de más de 50 USD queda en borrador para que un operador complete
     los datos del comprador.
7. **Los totales los calcula la función** (algoritmo y oráculo de DOMO, reparto de centavos por resto
   mayor). Nunca se firman importes que vengan del navegador.

## Alternativas descartadas

- **Reutilizar Domo.Firma (.NET) como servicio aparte**: ya está escrito y probado, pero añade un
  servicio que desplegar y vigilar fuera de Supabase, y contradice `marco-de-trabajo.md`. Se portaron
  su lógica y sus oráculos.
- **Proveedor externo de facturación**: coste por comprobante y datos tributarios fuera de la
  plataforma.
- **Firmar en el navegador**, como la firma PAdES *zero-custody* de TRQ-ABG-003: la emisión es
  desatendida (la dispara un webhook de pago), así que la clave tiene que estar en el servidor.

## Consecuencias

- `comun_facturacion` debe estar en los esquemas expuestos de PostgREST.
- En Vault van `facturacion_funcion_url` y `facturacion_funcion_clave`, y el mismo valor de la clave
  como secreto `FACTURACION_FUNCION_CLAVE` de la función (ver `supabase/functions/README.md`).
- Límite de la Edge Function: 2 s de CPU por invocación. Firmar con WebCrypto y abrir el `.p12` una
  vez por vuelta cabe con holgura; la función procesa un comprobante por vuelta durante 60 s como
  máximo.
- **Pendiente de verificar con el SRI real**: el criterio de aceptación es un `AUTORIZADO` en celcer con
  el RUC y el `.p12` del emisor. La tubería está probada contra celcer con RUC ficticio (error 35
  esperado).
- **Riesgo de 1 centavo con precios con IVA incluido**: el SRI comprueba que el IVA del grupo sea
  `round2(base × tarifa)`, y algunos PVP no admiten ninguna base que cuadre. Por ejemplo, $35.00 al
  15 % da 30.43 + 4.56 = 34.99 o 30.44 + 4.57 = 35.01. Ver `05-manejo-monetario-y-valores.md` §3.
