# Módulo `tramites` (tranqi-web)

Trámites que tranqi hace por el cliente: notarizaciones, poderes, declaraciones juramentadas,
salida de menores… Requerimiento `TRQ-043` (28-nov-2026).

## Qué cubre

- **Detectar** si lo que el cliente contó en «¿Qué necesitas resolver hoy?» es un trámite del
  catálogo (`deteccion.ts`, puro y con tests).
- **Pedirlo** desde el recorrido del inicio y del widget `agendar_cita` (`componentes/PedirTramite.tsx`):
  lo que entendimos, lo que hacemos, plazo, opciones con precio, requisitos y pago.
- **Listarlo** en «Mis necesidades» (`componentes/ListaTramitesPedidos.tsx`, widget `mis_citas`).

## Decisiones locales

**El trámite es un producto del catálogo, no una tabla.** Precio, requisitos (`requisitos`),
plazo (`tiempo_entrega`) y palabras clave (`etiquetas`) salen de `com_producto` /
`com_variante` de la categoría `tramites`. Así negocio da de alta o cambia trámites desde la
consola del catálogo sin tocar código. Cada variante es una opción («Poder especial», «Declaración
juramentada»…) y se identifica por su `concepto_derecho`, no por el nombre.

**El pedido es el pago.** Un trámite pedido es un `com_transaccion_pago` `APROBADO` cuyo
`pag_detalle_transaccion.variante_id` es una opción de trámite. No hay estados intermedios
(«en la notaría», «listo»): el seguimiento por pasos necesita al gestor que lo hace
(`gobernanza/productos/tranqi/especificacion-rol-gestor.md`, `TRQ-GES-001`, sin implementar).

**Ante la duda, cita.** Si el cliente pide un abogado o describe un conflicto (despido, herencia,
divorcio, demanda…), no se ofrece trámite aunque mencione una notaría o una escritura. Desde el
trámite siempre se puede pasar a la cita («Prefiero hablarlo antes con un abogado»).

**Sin descuento de plan todavía.** Los planes incluyen «10 % de descuento en gestores y trámites»
(`DESCUENTO_GESTORES`), pero el checkout no lo aplica en ningún producto. No se anuncia hasta que
se cobre.
