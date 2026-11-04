# @eco/comercio

Catálogo comercial unificado y checkout (`PLT-009`). Ver [`gobernanza/productos/plataforma/especificacion-funcional.md`](../../gobernanza/productos/plataforma/especificacion-funcional.md).

## Pasarela PLUX (`TRQ-ADM-004`)

| Pieza | Dónde |
| :--- | :--- |
| Montos y datos del paybox (lógica pura, con pruebas) | `src/plux.ts` |
| Acciones del checkout: pasarelas visibles, preparar pago, consultar estado | `src/acciones-plux.ts` |
| Botón dentro del checkout | `src/componentes/BotonPagoPlux.tsx`, usado por `ModalCheckoutPayphone` |
| Precio, registro del pago y confirmación | `supabase/migrations/20261104000001_comun_comercio_pasarela_plux.sql` |
| Webhook que aprueba el pago y activa la suscripción | `supabase/functions/plux-webhook` |

El navegador nunca decide el monto ni marca un pago como aprobado: el monto sale de `com_variante` y la aprobación llega solo por el webhook. Activación y despliegue: [`supabase/functions/README.md`](../../supabase/functions/README.md#plux-webhook-plux--pagoplux).
