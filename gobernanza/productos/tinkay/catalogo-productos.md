# Catálogo y Portafolio de Productos — Tinkay Floristería

**Negocio:** `tinkay`  
**Estado:** Propuesta Preliminar (Precios y variantes son supuestos para revisión y calibración de negocio)  
**Esquema de Base de Datos:** `comun_comercio` (Filtrado por `*_negocio = 'tinkay'`)  
**Política Fiscal:** B2C — En vitrina se muestra el PVP (IVA incluido). En base de datos `var_precio` almacena la base imponible (`PVP / 1.15`).  

---

## 1. Categorías de Navegación Multidimensional (`com_categoria` y `com_producto_categoria`)

En Tinkay, los clientes buscan por **intención u ocasión** tanto como por **formato físico**. Por ello, el catálogo no es un árbol estático 1:N, sino una **taxonomía multidimensional (N:M)** donde un mismo arreglo pertenece a múltiples facetas simultáneamente a través de `com_producto_categoria`.

### A. Taxonomía por Tipo de Faceta (`ctg_tipo`)

| Código Categ. | Tipo (`ctg_tipo`) | Nombre Visible | Descripción | Orden |
| :--- | :--- | :--- | :--- | :--- |
| `CAT_FLOREROS`   | `FORMATO`   | **Para Florero** | Ramos de tallos largos diseñados para colocar en agua directamente. | 1 |
| `CAT_COREANOS`   | `COLECCION` | **Estilo Coreano** | Arreglos modernos envueltos en papeles traslúcidos, plisados y satinados. | 2 |
| `CAT_ESPECIALES` | `FORMATO`   | **Especiales y Mix** | Combinaciones exóticas de flores de temporada y follaje especial. | 3 |
| `CAT_ABANICOS`   | `FORMATO`   | **Abanicos & Pedestales** | Diseños monumentales en abanico sobre base o atril para espacios solemnes. | 4 |
| `CAT_DETALLES`   | `COMPLEMENTO` | **Detalles y Regalos** | Adicionales para enriquecer el arreglo (chocolates, globos, mariposas). | 5 |
| `CAT_EVENTOS`    | `EVENTO`    | **Decoración & Altares** | Diseños integrales para iglesias, bodas, aniversarios y eventos sociales. | 6 |
| `CAT_OCAS_AMOR`  | `OCASION`   | **Amor & Pedida de Mano** | Diseños exuberantes y románticos para parejas y compromisos. | 7 |
| `CAT_OCAS_ANIV`  | `OCASION`   | **Aniversario** | Bouquets sofisticados para celebraciones de fechas clave. | 8 |
| `CAT_OCAS_CUMPLE`| `OCASION`   | **Cumpleaños** | Ramos alegres y festivos con empaques vibrantes. | 9 |
| `CAT_OCAS_CONDOL`| `OCASION`   | **Condolencias & Funerarios** | Arreglos solemnes y respetuosos (activa el modo visual sobrio sin rosa/dorado). | 10 |

---

### B. Mapeo Muchos a Muchos (`com_producto_categoria`)

Cada producto se asocia a una o más categorías mediante `com_producto_categoria`, definiendo `pct_es_principal = true` para la categoría canónica (utilizada para SEO y breadcrumbs principales):

* **Bouquet Clásico de 100 Rosas (`tinkay-bouq-florero`):**
  * `CAT_FLOREROS` (`pct_es_principal = true`)
  * `CAT_OCAS_AMOR` (Aparece en filtro *"Pedida de Mano / Enamorados"*)
  * `CAT_OCAS_ANIV` (Aparece en filtro *"Aniversarios"*)
* **Arreglo Abanico Grande (`tinkay-abanico-monumental`):**
  * `CAT_ABANICOS` (`pct_es_principal = true`)
  * `CAT_OCAS_CONDOL` (Aparece en catálogo de *"Condolencias / Velaciones"*)
  * `CAT_EVENTOS` (Aparece en catálogo de *"Decoración de Iglesia / Altares"*)
* **Bouquet Diseño Coreano VIP (`tinkay-bouq-coreano`):**
  * `CAT_COREANOS` (`pct_es_principal = true`)
  * `CAT_OCAS_CUMPLE` (Aparece en catálogo de *"Cumpleaños"*)
  * `CAT_OCAS_AMOR` (Aparece en catálogo de *"Romance"*)

---

### C. Contexto Dinámico en UI según Categoría de Entrada

La interfaz de usuario (`tinkay-web`) adopta el contexto de la categoría desde la cual navegó el cliente:
1. **Modo Condolencias (`CAT_OCAS_CONDOL`):**
   * Aplica la regla del [Sistema Visual](sistema-visual.md) §4: paleta sobria (`--verde`, `--crema`, `--tinta`), sin rosa festivo ni dorado expansivo.
   * Cross-selling sugerido: *Cinta luctuosa membretada*, *Atril de soporte*, *Tarjeta solemne de pésame*.
2. **Modo Eventos / Iglesia (`CAT_EVENTOS`):**
   * Muestra opciones de servicio logístico: *Instalación en sitio*, *Desmontaje*, *Cotización de proforma*.
3. **Modo Amor / Aniversario (`CAT_OCAS_AMOR` / `CAT_OCAS_ANIV`):**
   * Cross-selling sugerido: *Caja Ferrero Rocher*, *Globo burbuja helio personalizado*, *Set mariposas 3D*.

---

## 2. Productos Maestros y Variantes (`com_producto` y `com_variante`)

### A. Categoría: Para Florero (`CAT_FLOREROS`)
* **Producto Maestro:** *Bouquet Clásico para Florero* (`pro_id: 'tinkay-bouq-florero'`)
* **Variantes / SKUs:**
  * `TNK-FLOR-25`: **25 Tallos** — PVP: **$20.00** *(Base Imponible: $17.39 | IVA 15%: $2.61)*
    * **Receta (BOM):** 25 Rosas Exportación + 1 Sobre Alimento Floral + 1 Cinta de Amarre.
  * `TNK-FLOR-50`: **50 Tallos** — PVP: **$25.00** *(Base Imponible: $21.74 | IVA 15%: $3.26)*
    * **Receta (BOM):** 50 Rosas Exportación + 2 Sobres Alimento Floral + 1 Cinta de Amarre.
  * `TNK-FLOR-100`: **100 Tallos** — PVP: **$45.00** *(Base Imponible: $39.13 | IVA 15%: $5.87)*
    * **Receta (BOM):** 100 Rosas Exportación + 4 Sobres Alimento Floral + 2 Cintas de Amarre.

---

### B. Categoría: Estilo Coreano (`CAT_COREANOS`)
* **Producto Maestro:** *Bouquet Diseño Coreano* (`pro_id: 'tinkay-bouq-coreano'`)
* **Variantes / SKUs:**
  * `TNK-COR-PEQ`: **Pequeño** — PVP: **$25.00** *(Base: $21.74)*
    * **Receta (BOM):** 12 Rosas + 2 Pliegos Papel Coreano + Follaje Básico + Cinta + Tarjeta.
  * `TNK-COR-MED`: **Mediano** — PVP: **$35.00** *(Base: $30.43)*
    * **Receta (BOM):** 24 Rosas + 3 Pliegos Papel Coreano + Follaje Eucalipto + Cinta Satinada + Tarjeta.
  * `TNK-COR-GRA`: **Grande** — PVP: **$45.00** *(Base: $39.13)*
    * **Receta (BOM):** 36 Rosas + 4 Pliegos Papel Coreano + Follaje Especial + Cinta + Tarjeta.
  * `TNK-COR-GIG`: **Gigante / VIP** — PVP: **$60.00** *(Base: $52.17)*
    * **Receta (BOM):** 50 Rosas + 6 Pliegos Papel Coreano + Follaje Premium + Mariposas 3D + Corona + Tarjeta.

---

### C. Categoría: Especiales y Mix (`CAT_ESPECIALES`)
* **Producto Maestro:** *Bouquet Mix Exótico de Temporada* (`pro_id: 'tinkay-bouq-mix'`)
* **Variantes / SKUs:**
  * `TNK-MIX-PEQ`: **Mix Pequeño** — PVP: **$35.00** *(Base: $30.43)*
  * `TNK-MIX-GRA`: **Mix Grande** — PVP: **$45.00** *(Base: $39.13)*

---

### D. Categoría: Detalles y Regalos (Cross-Sell / `com_producto_relacionado`)
*Son productos estándar del catálogo con fotos, stock y variantes, asociados como adicionales sugeridos:*
1. **Chocolates Artesanales / Ferrero:**
   * `TNK-CHOC-4`: Caja x4 unidades — PVP: **$5.00** *(Stock directo)*
   * `TNK-CHOC-8`: Caja x8 unidades — PVP: **$9.00** *(Stock directo)*
2. **Globos:**
   * `TNK-GLO-BUR`: Globo Burbuja con Helio y Frase Personalizada — PVP: **$5.00**
3. **Complementos:**
   * `TNK-MAR-SET`: Set 3 Mariposas Decorativas 3D — PVP: **$2.00**

---

### E. Categoría: Decoración de Eventos y Altares (`CAT_EVENTOS`)
* **Producto Maestro:** *Arco Floral / Decoración de Altar*
* **Variantes de Diseño:**
  * `TNK-ALT-BAS`: Opción 1 (Básico) — PVP: **$100.00**
  * `TNK-ALT-MED`: Opción 2 (Medio) — PVP: **$150.00**
  * `TNK-ALT-PRO`: Opción 3 (Full Floral / Pro) — PVP: **$200.00**
  * `TNK-ALT-CUS`: Opción Personalizada — Deriva a Proforma (`com_proforma`).
* **Servicios Logísticos (Líneas de Mano de Obra):**
  * `TNK-SRV-INST`: Montaje e Instalación en Sitio — PVP: **$30.00**
  * `TNK-SRV-DESM`: Desmontaje en Horario Especial (Madrugada) — PVP: **$20.00**
  * `TNK-SRV-TRAN`: Transporte Logístico — PVP: **$30.00**

---

## 3. Modelo de Suscripciones Florales Recurrentes (`com_suscripcion`)

Cualquier variante de bouquet puede ser adquirida bajo modalidad recurrente con ciclo de entrega periódico:
* **Semanal (4 entregas al mes):** Descuento del **20%** sobre el precio base.
* **Quincenal (2 entregas al mes):** Descuento del **15%** sobre el precio base.
* **Mensual (1 entrega al mes):** Descuento del **10%** sobre el precio base.
* **Regla de Operación:** La receta (BOM) se descuenta del inventario cuando el florista pasa la orden a estado **"En Preparación"** el día programado de la entrega.

---

## 4. Agendamiento Logístico: Franjas Gratuitas vs. Horario Exacto con Recargo

El agendamiento en Tinkay no bloquea a una persona en Google Calendar, sino que reserva un cupo en la ruta de despacho de la furgoneta / mensajero:

### A. Modalidad Estándar: Franjas Horarias (Entrega Gratuita)
* **Franja Mañana (09:00 a 13:00):** Entrega programada estándar sin costo adicional (**$0.00**).
* **Franja Tarde (14:00 a 18:00):** Entrega programada estándar sin costo adicional (**$0.00**).
* El repartidor optimiza la ruta según las direcciones del día.

### B. Modalidad Especial: Entrega en Horario Exacto / Madrugador (Con Recargo)
* **Casos de Uso:** Sorpresas de cumpleaños al despertar antes de ir a trabajar (ej. **07:00 AM en punto**), aniversarios en restaurantes o entregas en ceremonias con horario estricto.
* **Mecanismo Comercial:**
  * En el selector de entrega del checkout, el cliente puede conmutar de *"Franja Regular"* a *"Hora Exacta (+/- 15 min)"*.
  * Al seleccionar una hora específica fuera de franja (ej. **07:00 AM**), el motor `@eco/comercio` añade automáticamente la línea de servicio logístico especial:
    * `TNK-LOG-HORA-EXACTA`: **Recargo por Entrega en Horario Exacto / Madrugador** — PVP: **$10.00**.
* **Impacto Operativo:**
  * La orden se etiqueta en el panel del florista y del despachador como: `🚨 PRIORIDAD RUTA EXCLUSIVA - 07:00 AM`.

---

## 5. Directorio de Delivery y Coordinación Logística (`com_proveedor_servicio` y `com_despacho_asignacion`)

Tinkay opera bajo un modelo de despacho híbrido gestionado activamente por la **Coordinadora de Taller**:

1. **Recursos Propios:**
   - Auto/furgoneta propio de Tinkay para rutas masivas, pedidos de gran volumen o montajes de eventos.
2. **Directorio de Reparto Externo:**
   - Registro permanente de transportistas de confianza (taxistas convencionales de la zona, conductores frecuentes de Uber/Cabify y mensajeros motorizados).
3. **Flujo de Asignación en Panel de Coordinación:**
   - Al estar listo el ramo, la coordinadora selecciona un proveedor del directorio o solicita una carrera en Uber/Cabify.
   - En la orden (`com_despacho_asignacion`), se registran:
     - **Proveedor / Conductor asignado:** Nombre comercial y teléfono de contacto.
     - **Vehículo / Placa:** Para control y entrega en garitas de urbanizaciones.
     - **Enlace de Seguimiento en Vivo (*Tracking URL*):** Link compartido de Uber/Cabify para monitorear el recorrido en tiempo real.
     - **Costo Real de Flete:** Valor pagado al transportista para auditar márgenes reales de entrega.
     - **POD (*Proof of Delivery*):** Fotografía obligatoria del destinatario o conserjería recibiendo el arreglo.

---

## 6. Modelo de Comisiones de Vendedoras y Automatización con ARIA

Tinkay sustituye el proceso manual de cuadre de comisiones y la gestión de chats en ManyChat mediante la integración nativa del agente conversacional **ARIA (`packages/agentes-ia`)**:

### A. Fórmula Universal de Base Comisionable Neta
La comisión de la vendedora se calcula sobre la **utilidad bruta operativa real** de cada pedido, deduciendo todos los gastos directos del producto/servicio:

$$\text{Base Comisionable Neta} = \text{Venta Total} - \text{Descuento Cupones} - \text{Gasto Delivery} - \text{Gasto Instalación} - \text{Fee Plataforma} - \text{Comisión TC}$$

* **Descuento por Cupones:** Si el cliente aplicó un cupón promocional (ej. -$5.00), el descuento reduce la base de venta.
* **Gasto de Delivery:** Se deduce $\max(\text{Delivery Base Incluido (\$3.00)}, \text{Delivery Real Pagado})$.
* **Gasto de Instalación / Montaje:** Deducible en decoraciones de eventos, altares o montajes florales en sitio.
* **Fee de Plataforma:** Tarifa o porcentaje de infraestructura operativa de la plataforma.
* **Comisión de Tarjeta de Crédito (TC) / Pasarela en Línea:**
  * **6.00%** (o valor configurado en `com_pasarela_configuracion.psc_comision_porcentaje`) sobre el total de la orden si el cliente pagó mediante pasarela en línea (**Payphone** con Cajita de Pagos, o subsecuentemente **Paymentez**).
  * **$0.00** si el cliente pagó en Efectivo o Transferencia bancaria directa.
* **Integración y Activación de Pasarelas en Tinkay (`com_pasarela_configuracion`):**
  * Tinkay dispone de su propio registro independiente en `com_pasarela_configuracion`, donde la administración parametriza su `storeId` y credenciales de Payphone Business.
  * La Cajita de Pagos de Payphone se activa y despliega en `tinkay-web` únicamente si los parámetros están completos y `psc_activo = true`.
  * La confirmación server-to-server se ejecuta en < 5 minutos vía Server Action contra `/api/confirm` de Payphone, registrando la transacción en `com_transaccion_pago` y pasando la orden a preparación en el taller.
* **Porcentaje Individual por Vendedora:**
  * Cada vendedora posee su propio porcentaje de comisión configurado en su perfil de membresía (`seg_membresia.mem_detalle_membresia->>'porcentaje_comision'`, ej. 8%, 10%, 12%).
  * $$\text{Comisión Neta a Pagar} = \max(0, \text{Base Comisionable Neta}) \times \%\,\text{Comisión Asignada}$$

---

### B. Transición de ManyChat hacia ARIA (`packages/agentes-ia`)
1. **Reemplazo Integral de ManyChat:**
   * ARIA atiende las conversaciones en WhatsApp e Instagram Direct, guiando al cliente en la selección del arreglo, recolección de dedicatoria, fecha, franja y dirección exacta.
2. **Atribución de Ventas a la Asesora:**
   * **Enlace de Contacto con Ref:** Cada asesora cuenta con enlaces y códigos QR propios para campañas y estados (ej. `tinkay.com/chat?asesora=paola` o WhatsApp con texto predefinido). ARIA asocia la conversación a esa vendedora.
   * **Asignación Equitativa en Turnos:** Conversaciones orgánicas que ingresan a la línea general se distribuyen por turno rotativo entre las vendedoras activas.
   * **Reasignación Manual:** La coordinadora puede modificar o reasignar la vendedora en el panel de control antes de cerrar la liquidación.
3. **Liquidación Automatizada Quincenal:**
   * La administración accede al widget de comisiones en el panel administrativo de Tinkay, filtra por fecha y obtiene la liquidación consolidada lista para pago bancario, eliminando errores de cálculo manual.

---

### C. Flujo Conversacional Primario en WhatsApp, Álbumes Google Photos y Supervisión Humana Dual (*Human-in-the-Loop*)

1. **Canal Primario de Venta por WhatsApp:**
   * La mayoría de las ventas de Tinkay se originan y cierran directamente por WhatsApp. El cliente busca cercanía, calidez y agilidad sin pasar por carritos web tradicionales.
2. **Catálogos Visuales en Álbumes Compartidos de Google Photos:**
   * Cada categoría y producto maestro en el catálogo (`com_categoria` / `com_producto`) enlaza a un **Álbum Público de Google Photos** con fotografías reales de arreglos armados en el taller (`photos.app.goo.gl/...`).
   * ARIA comparte en el chat los enlaces a los álbumes según el estilo o presupuesto solicitado por el cliente (ej. *Álbum Coreano*, *Álbum Ramos de Florero*, *Álbum Eventos*), permitiendo una inspección visual de alta resolución inmediata.
3. **Toma de Pedido Conversacional (*Conversational Intake*):**
   * ARIA recopila en el chat todos los parámetros de la reserva:
     - Arreglo elegido y dedicatoria para la tarjeta impresa.
     - Fecha de entrega y franja horaria (o solicitud de Horario Exacto con recargo de $10.00).
     - Datos del destinatario y dirección (incluyendo ubicación compartida o pin de WhatsApp).
     - Método de cobro (Link Payphone, QR Deuna o datos bancarios).
4. **Supervisión Humana Dual (Copiloto Activo):**
   * **La Asesora que Comisiona:** Supervisa el chat en tiempo real en su panel; puede conmutar a modo manual para asesorar pedidos especiales y personalizar el trato. La venta y la comisión neta quedan amarradas a su usuario.
   * **La Coordinadora de Taller (Responsable de Entrega):** En cuanto el pago es validado (por OCR de ARIA o pasarela), la orden ingresa al panel del taller para corte de tallos, armado floral y asignación del repartidor en el Directorio de Delivery.

> [!IMPORTANT]
> **Especificación Completa de ARIA, Prompts, YCloud y Consola de Supervisión:**  
> Ver el documento canónico de arquitectura e implementación: [`agente-aria-whatsapp-ycloud.md`](agente-aria-whatsapp-ycloud.md) (`TNK-004`).

