# Disparadores del despachador de tareas (PLT-021)

El despachador se invoca por HTTP en `/api/cron/despachador-alertas` con
`Authorization: Bearer CRON_SECRET`. Quién lo invoca es intercambiable, y hoy
conviven dos disparadores porque **ninguno de los dos basta solo**.

## Por qué el cron de Vercel no es el principal

La cuenta despliega en **plan Hobby**, y ahí Vercel solo ejecuta tareas
programadas **una vez al día**: un `*/15 * * * *` no se limita, hace fallar el
despliegue entero. Un recordatorio de «una hora antes» que se evalúa una vez al
día no sirve para nada.

Así que el reparto real es:

| Disparador | Cadencia | Papel |
| :--- | :--- | :--- |
| `pg_cron` (`despachador-tareas`) | cada 15 min | **El que sostiene el servicio.** Los recordatorios de 1 h dependen de él |
| Vercel Cron (`vercel.json`) | 09:20 UTC diario | Red diaria: recoge lo que se hubiera quedado atrás y, sobre todo, **ejercita el camino portable** para que no se pudra sin que nadie lo note |

## Al pasar a plan Pro

Cambiar `schedule` a `*/15 * * * *` en `apps/tranqi-web/vercel.json`. En ese
momento los dos disparadores hacen lo mismo con la misma cadencia, lo cual es
inofensivo —las tareas son idempotentes y las notificaciones llevan clave
única— y se puede retirar el trabajo de `pg_cron` cuando se quiera.

## Al migrar a un servidor Linux propio

No hay que tocar código. Una línea en `/etc/cron.d/despachador-alertas`:

```
*/15 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://tranqi24.com/api/cron/despachador-alertas
```

O bien `node scripts/despachar-alertas.mjs` con `CRON_SECRET` y `URL_BASE` en el
entorno.

## Cómo saber cuál disparó qué

`comun_tareas.tar_ejecucion.tar_detalle->>'origen'` distingue `pg_cron`,
`vercel_cron`, `linux_cron` y `manual`. Si la columna dice `pg_cron` durante
días seguidos y nunca `vercel_cron`, el camino portable está roto aunque el
servicio funcione.
