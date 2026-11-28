# Cierre de Tarea — «Mis necesidades»: trámite o cita (`TRQ-043`)

**Fecha:** 2026-11-28
**Alcance:** `apps/tranqi-web` (módulos `tramites` —nuevo— y `agenda`, panel del cliente), `gobernanza/productos/tranqi`

## 1. Por qué

Comentario de negocio (Galo, 28-nov-2026), sobre la pantalla «Agendar Consulta o Trámite»:
«Agendamiento debe ser más citas o necesidades, ejemplo quiero sacar la escritura de la notaría, o
quiero una cita con abogado». La pantalla prometía trámites pero solo agendaba citas. Maqueta
`TRANQUI/demo/cliente-necesidades.html`, aprobada por el usuario.

## 2. Qué se implementó

1. **Módulo `tramites`**: detección del trámite en lo contado (`deteccion.ts` + 6 tests), lectura
   de los trámites del catálogo (categoría `tramites`) y de los trámites pagados por el cliente.
2. **Recorrido** (`FormularioAgendar` variante `recorrido`, inicio y widget `agendar_cita`): si es
   un trámite, `PedirTramite` muestra lo entendido, lo que hacemos, plazo, opciones con precio,
   requisitos y pago con el checkout de siempre; si no, sigue la cita con ARIA. Hitos según camino.
   Ideas rápidas con trámites. El camino de hitos sale a `CaminoRecorrido.tsx`.
3. **Mis necesidades**: el cliente ve `Agendamiento` como «Mis necesidades» (menú y cabecera) y el
   widget `mis_citas` lista trámites pagados y citas, con filtro Todas/Trámites/Citas.
4. **Gobernanza**: especificación funcional de tranqi, README de `agenda` y README nuevo de `tramites`.

## 3. Verificación

- `tsc --noEmit`, `eslint` de los ficheros tocados y `vitest` (35/35): OK.
- `next build` local imposible el 28-nov (equipo sin memoria: segfault y «Array buffer allocation
  failed»); el build de referencia es el de Vercel del PR.
- **No verificado en navegador:** ni el camino del trámite ni «Mis necesidades» con sesión real.

## 4. Pendiente

- Seguimiento por pasos del trámite (pedido → notaría → entregado): requiere el rol Gestor (`TRQ-GES-001`).
- Aplicar en el checkout el descuento de plan en trámites (`DESCUENTO_GESTORES`).
- No hay opción «copia certificada de escritura» en el catálogo: «sacar la escritura» cae en la
  opción genérica «Notarización y Gestión en Notaría» ($230 con IVA). Que negocio decida si la crea.
