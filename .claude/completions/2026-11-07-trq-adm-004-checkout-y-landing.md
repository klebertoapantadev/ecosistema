# TRQ-ADM-004 — Checkout rediseñado, avisos de pago y landing sin B2B

**Contexto (7-nov-2026):** el usuario compró una constitución de 322 $ en tranqi24.com y no
recibió ningún aviso ni vio el trámite. Además pidió quitar de la landing el plan corporativo
y la sección «Nuestro equipo», y rediseñar la pasarela de pagos con animaciones y un recibo.

**Cambios:**
- **Avisos de pago:** `acciones-plux.ts` y `acciones.ts` insertaban en
  `comun_notificaciones.not_registro`, pero la tabla vive en `comun_notificacion`. El insert
  fallaba en silencio y el cliente no recibía el aviso «¡Pago Confirmado!».
- **Checkout (`ModalCheckoutPayphone`):** reescrito con la maqueta aprobada en el taller
  (`TRANQUI/demo/checkout.html`):
  - Tres pasos: Facturación → Pago → Recibo.
  - Validación de cédula con dígito verificador (`checkout/validacion.ts`, con pruebas).
  - Estado «procesando» con un mínimo de 2,2 s.
  - Recibo que se «imprime», con sello PAGADO, confeti y «¿Qué sigue?».
  - Rechazo en naranja que deja claro que no hubo cobro.
  - Versión móvil a pantalla completa.
  - La lógica de PLUX y Payphone es la misma de antes. `BotonPagoPlux` solo avisa de su fase
    con `alCambiarFase` y sigue montado, oculto, mientras se procesa, porque ahí espera el
    webhook.
- **Estilo por app:** las clases van con el prefijo `ckt-` y los colores salen de variables
  `--ckt-*`. tranqi-web las define en `globals.css` (violeta, menta y naranja solo para lo
  urgente). Las otras apps ven valores neutros hasta que definan los suyos.
- **PLUX guarda el perfil de facturación:** antes el interruptor «Guardar» no tenía efecto con
  PLUX. Nueva `guardarDatosFacturacionAction`, que comparte código con Payphone.
- `SeccionCoberturaCliente` ya no cierra el modal al aprobarse el pago, para que se vea el
  recibo.
- **Correcciones tras la revisión de Gemini**, todas confirmadas en el código:
  - `alPagoExitoso` se llama al cerrar el checkout y no en el instante del pago, porque el
  `router.refresh()` de `RejillaPlanes` desmontaba el modal antes de mostrar el recibo.
  - La X no cierra durante «procesando», para no cortar la espera del webhook.
  - Un `MONTO_DISTINTO` de PLUX lleva a «Pago en revisión», sin «No se hizo ningún cobro» y
  sin opción de reintentar.
  - Los rechazos de Payphone (`ok:false` con `estado`) muestran el panel de rechazo.
  - El recibo lee `codigoAutorizacion` y `tarjeta` de Payphone.
  - No se sobrescribe el perfil si falla la lectura de `seg_usuario`.
  - Límites de longitud iguales a los de `esquemaPagador`.
  - Foco atrapado dentro del modal.
  - El total impreso ya no sale a medio contar.
- **Landing:** sin la tarjeta «Cobertura Legal Corporativa (B2B)» ni la sección «Nuestro
  equipo».

**Pendiente:**
- Un producto de pago único (trámite) solo deja la transacción APROBADA. No crea caso,
  trámite ni derecho de consumo, así que el cliente no ve «un trámite en marcha». El recibo
  promete «Te contactamos», que por ahora es manual.
- Diagnosticar en la BD por qué la vitrina del panel no muestra el plan familiar (producto
  `834128ef-…`).
- Sigue sin configurarse la URL del webhook en el dashboard de PLUX.
