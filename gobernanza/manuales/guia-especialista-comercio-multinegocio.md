# Guía del Especialista en Comercio Multinegocio, Arquitectura y Revenue Operations (RevOps)

**Fecha:** 2026-09-05  
**Audiencia:** Fundadores, Product Owners, Líderes Técnicos y Administradores del Ecosistema  
**Objetivo:** Proporcionar la base conceptual, patrones de diseño, glosario técnico y ruta de aprendizaje para dominar la arquitectura comercial, operativa y financiera de plataformas multinegocio.

---

## 1. Mapa de Conocimiento y Ruta de Aprendizaje

Para liderar este ecosistema con autoridad técnica y de negocio, la formación se estructura en **4 niveles progresivos**:

```text
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│ NIVEL 4: Revenue Operations (RevOps) & Finanzas Digitales (Pricing Tiers, SRI, Churn, LTV)       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL 3: Operaciones & Supply Chain (BOM / Recetas, Kardex, Mermas, Field Service Management)     │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL 2: Patrones Comerciales Avanzados (CPQ, Composable Commerce, Modelos de Suscripción)       │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│ NIVEL 1: Fundamentos de Catálogo (SKU, Producto Maestro, Variantes, Desacoplamiento Fiscal)      │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 2. Glosario Maestro de Términos (Comercio, Operaciones y Plataforma)

### A. Términos de Catálogo y Comercio (E-Commerce & CPQ)

* **Producto Maestro (Master Product):** El concepto abstracto y de marketing de un bien o servicio (ej. *"Bouquet Estilo Coreano"*, *"Plan Jurídico Tranqi"*, *"Mantenimiento Preventivo"*). No tiene precio directo ni stock físico; agrupa a sus variantes.
* **Variante / SKU (Stock Keeping Unit):** La unidad mínima vendible, almacenable y facturable (ej. *"Bouquet Coreano Mediano"*, *"Plan Tranqi Anual Plus"*, *"Capuchino 8oz Leche Entera"*). Posee precio, código de barras/SRI, impuestos y reglas de inventario.
* **CPQ (Configure, Price, Quote):** Software o patrón de diseño que permite a los equipos comerciales *configurar* productos complejos (con opciones o repuestos), aplicar reglas automáticas de *precio* y emitir *cotizaciones/proformas* interactivas para aprobación del cliente.
* **Cross-Selling (Venta Cruzada):** Oferta de productos complementarios sugeridos al momento de la compra (ej. agregar chocolates y globos al comprar un bouquet, o añadir transporte al contratar la decoración de un altar).
* **Up-Selling (Venta Superior):** Incentivar la compra de una variante de mayor valor o prestaciones (ej. pasar de un bouquet pequeño de $25 a uno mediano de $35).
* **Headless Commerce / Composable Commerce:** Arquitectura donde la base de datos y la lógica de negocio (catálogo, precios, checkout) están totalmente separadas de la interfaz visual (Web, App Móvil, Bot de WhatsApp, Feed de Meta).

### B. Términos Operativos, de Manufactura y Stock (BOM & ERP)

* **BOM (Bill of Materials / Lista de Materiales o Receta):** Estructura formal que detalla las cantidades exactas de insumos o materias primas necesarias para fabricar o preparar un producto final (ej. 1 Bouquet Mediano = 24 rosas + 3 pliegos de papel coreano + 1 metro de cinta).
* **COGS (Cost of Goods Sold / Costo de Ventas):** La suma total de los costos directos de los insumos y la mano de obra invertidos para producir un bien o prestar un servicio. Determina el margen bruto real (`Margen = Precio de Venta - COGS`).
* **Kardex:** Registro cronológico y valorado de todas las entradas, salidas y existencias de un insumo o producto en cada bodega o local.
* **Merma (Shrinkage / Waste):** Pérdida de inventario no imputable a ventas directas (flores marchitas, comida caducada, materiales rotos o defectuosos). Debe auditarse obligatoriamente para evitar fugas invisibles de dinero.
* **Lead Time (Tiempo de Entrega / Preparación):** Tiempo transcurrido desde que se confirma un pedido hasta que el producto está listo para despacho.

### C. Términos de Suscripciones y Métricas Financieras (RevOps)

* **MRR (Monthly Recurring Revenue / Ingreso Recurrente Mensual):** Ingreso predecible que el negocio recibe cada mes por concepto de suscripciones activas.
* **ARR (Annual Recurring Revenue):** Ingreso recurrente anualizado (`MRR * 12`).
* **Churn Rate (Tasa de Cancelación):** Porcentaje de clientes o suscriptores que dan de baja su plan en un período determinado.
* **LTV (Customer Lifetime Value / Valor de Vida del Cliente):** El ingreso neto total estimado que un cliente aportará a la empresa durante toda su relación comercial.
* **Seat-Based Pricing (Precio por Asiento / Usuario):** Modelo B2B donde el precio se calcula multiplicando una tarifa fija por el número de empleados o usuarios con acceso (ej. Planes corporativos de Tranqi).

### D. Términos Tributarios y Facturación (Ecuador - SRI)

* **RIDE:** Representación Impresa del Documento Electrónico (el PDF visual de la factura autorizada por el SRI).
* **Clave de Acceso:** Código numérico único de 49 dígitos que identifica y autentica cada comprobante electrónico ante el SRI.
* **Proforma / Cotización:** Documento comercial informativo previo a la venta; **no tiene validez tributaria** hasta que se convierte formalmente en Factura Electrónica.
* **Tarifas de IVA:** Gravámenes aplicables en Ecuador (`IVA_15` tarifa general, `IVA_0` tarifa cero para insumos agrícolas/básicos, o `NO_OBJETO` para tasas judiciales).

---

## 3. Patrones de Diseño por Unidad de Negocio

---

### A. Patrones Comunes (Transversales a todo el Ecosistema)

1. **Patrón de Desacoplamiento Fiscal (Vitrina vs. SRI):**
   * El cliente final solo ve precios claros e intuitivos (con o sin IVA según el modelo de negocio).
   * La base de datos almacena la tarifa fiscal (`IVA_15`, `IVA_0`), subtotal y desglose para garantizar que la emisión del XML hacia el SRI sea 100% automática.
2. **Patrón de Transaccionalidad Atómica (RPC en Postgres):**
   * Ninguna transición sensible (cobrar, descontar stock de receta, aprobar presupuesto) se hace mediante llamadas sueltas desde el frontend. Se ejecutan en una función segura en base de datos (`SECURITY DEFINER`) para evitar inconsistencias.
3. **Patrón de Catálogo Multitenant Aislado:**
   * Todas las empresas conviven en `comun_comercio`, pero cada fila tiene su `*_negocio`. El RLS impide que un negocio lea o altere los datos de otro.

---

### B. Patrones Específicos por Industria

#### 1. Floristería (Tinkay & Margaritas) — *Comercio de Perecederos y Logística de Eventos*
* **Patrón de Receta Dinámica con Sustitución:**
  * Las flores tienen estacionalidad y fragilidad. Si se agotan las rosas rojas, el florista debe poder activar una "regla de sustitución" por rosas fucsias o flores de valor equivalente sin rehacer el producto en la web.
* **Patrón de Ventanas de Entrega (Delivery Slots):**
  * La floristería no vende por "fecha", sino por franjas horarias (*"Mañana: 09:00 - 13:00"* o *"Tarde: 14:00 - 18:00"*).
* **Patrón de Personalización Obligatoria:**
  * Captura obligatoria de dedicatoria, destinatario y confirmación de si la entrega es anónima o con remitente visible.

#### 2. Legaltech (Tranqi) — *Law Practice Management (LPMS) & Suscripciones*
* **Patrón de Bolsa de Horas / Consultas (Retainer):**
  * Los planes mensuales otorgan un saldo de créditos/consultas que expira al final del mes (no acumulable), incentivando la retención.
* **Patrón de Flujo de Trabajo Escalonado (Milestone Billing):**
  * En trámites complejos, la facturación se divide por hitos (ej. 30% al iniciar expediente, 40% al ingresar a notaría, 30% a la entrega de escrituras).

#### 3. Servicios para el Hogar (FastFix Home) — *Field Service Management (FSM) & CPQ*
* **Patrón de Proforma Compuesta con Anticipo:**
  * Separación estricta entre Mano de Obra y Repuestos. Los repuestos físicos exigen pago anticipado antes de despachar al técnico.
* **Patrón de Tarifa Plana con Alcance Acotado:**
  * Servicios de precio fijo (calefón, puertas) con un checklist cerrado de lo que incluye. Cualquier trabajo extra descubierto en el sitio genera una orden adicional (Add-On).

#### 4. Cafetería / Tienda (Futuros Negocios) — *Punto de Venta (POS) & Quick Service*
* **Patrón de Modificadores en Cascada:**
  * Tamaño $\rightarrow$ Tipo de Leche $\rightarrow$ Nivel de Azúcar $\rightarrow$ Extras. Cada modificador ajusta el precio y descuenta insumos específicos del inventario.

---

## 4. Recursos y Lecturas Recomendadas

### 📖 Libros Fundamentales
1. **"Monetizing Innovation: How Smart Companies Design the Product Around the Price"** — *Madhavan Ramanujam & Georg Tacke*.  
   *(La biblia de RevOps: enseña cómo diseñar productos a partir de lo que el cliente está dispuesto a pagar).*
2. **"Subscribed: Why the Subscription Model Will Be Your Company's Future"** — *Tien Tzuo (CEO de Zuora)*.  
   *(El estándar global para entender la economía de suscripciones, retención y métricas MRR/LTV).*
3. **"Designing Data-Intensive Applications"** — *Martin Kleppmann*.  
   *(Capítulos sobre transacciones, consistencia e idempotencia en sistemas distribuidos).*
4. **"Production and Inventory Management" (APICS / ASCM Handbook)**.  
   *(Referencia de la industria para listas de materiales BOM, Kardex y control de mermas).*

### 🌐 Arquitecturas y Estándares Abiertos
* **[MACH Alliance](https://machalliance.org/):** Microservices, API-first, Cloud-native, Headless (el estándar de arquitectura que usamos).
* **[commercetools Composable Commerce Documentation](https://docs.commercetools.com/):** El mejor modelo conceptual de APIs de catálogo, variantes y canales de distribución.
* **[Salesforce CPQ Architecture Guide](https://developer.salesforce.com/docs/atlas.en-us.cpq_dev_spec.meta/cpq_dev_spec/):** Guía de referencia de cómo modelar proformas, reglas de precios y cotizaciones.
* **[Documentación Técnica de Comprobantes Electrónicos SRI Ecuador](https://www.sri.gob.ec):** Fichas técnicas de XMLs de Facturas, Notas de Crédito y Liquidaciones.
