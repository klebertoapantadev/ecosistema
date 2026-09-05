# Catálogo y Portafolio de Productos — Tinkay Floristería

**Negocio:** `tinkay`  
**Estado:** Propuesta Preliminar (Precios y variantes son supuestos para revisión y calibración de negocio)  
**Esquema de Base de Datos:** `comun_comercio` (Filtrado por `*_negocio = 'tinkay'`)  
**Política Fiscal:** B2C — En vitrina se muestra el PVP (IVA incluido). En base de datos `var_precio` almacena la base imponible (`PVP / 1.15`).  

---

## 1. Categorías de Navegación (`com_categoria`)

| Código Categ. | Nombre Visible | Descripción | Orden |
| :--- | :--- | :--- | :--- |
| `CAT_FLOREROS` | **Para Florero** | Ramos de tallos largos diseñados para colocar en agua directamente. | 1 |
| `CAT_COREANOS` | **Estilo Coreano** | Arreglos modernos envueltos en papeles traslúcidos y satinados. | 2 |
| `CAT_ESPECIALES`| **Especiales y Mix** | Combinaciones exóticas de flores de temporada y follaje especial. | 3 |
| `CAT_DETALLES`  | **Detalles y Regalos** | Adicionales para enriquecer el arreglo (chocolates, globos, mariposas). | 4 |
| `CAT_EVENTOS`   | **Decoración & Altares** | Diseños integrales para bodas, aniversarios y eventos sociales. | 5 |

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

