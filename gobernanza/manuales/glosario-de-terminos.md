# Glosario Maestro de Términos y Siglas Técnicas del Ecosistema

**Fecha:** 2026-09-05  
**Estado:** Documento Vivo (se actualiza continuamente cada vez que se introduce un nuevo término técnico o sigla)  
**Ubicación:** `gobernanza/manuales/glosario-de-terminos.md`  

Este glosario explica de forma sencilla, directa y con ejemplos reales del ecosistema todas las siglas y términos técnicos utilizados en la arquitectura, base de datos, comercio y operaciones.

---

## 1. Siglas de Arquitectura y Desarrollo de Software

| Sigla / Término | Significado en Inglés | Significado en Español | Explicación Sencilla y Ejemplo en el Proyecto |
| :--- | :--- | :--- | :--- |
| **ADR** | *Architectural Decision Record* | **Registro de Decisión de Arquitectura** | Documento breve que registra una decisión técnica importante tomada por el equipo, el motivo por el cual se eligió y sus alternativas descartadas. <br>*Ejemplo: [ADR-0003](file:///c:/@Antigravity/ecosistema/gobernanza/arquitectura/adr/0003-catalogo-comercial-unificado.md) decidió que el catálogo de productos es unificado y no uno separado por cada negocio.* |
| **DDL** | *Data Definition Language* | **Lenguaje de Definición de Datos** | Conjunto de comandos SQL que crean, modifican o borran la **estructura** de la base de datos (tablas, columnas, restricciones), no los datos en sí. <br>*Ejemplo: Las instrucciones `CREATE TABLE comun_comercio.com_producto (...)` o `ALTER TABLE`.* |
| **DML** | *Data Manipulation Language* | **Lenguaje de Manipulación de Datos** | Comandos SQL que gestionan los **datos** reales dentro de las tablas ya creadas. <br>*Ejemplo: `INSERT` (crear un nuevo ramo), `UPDATE` (cambiar precio), `DELETE` (borrar), `SELECT` (consultar).* |
| **RLS** | *Row Level Security* | **Seguridad a Nivel de Filas** | Mecanismo de seguridad de Postgres/Supabase donde la base de datos filtra automáticamente qué registros puede ver o editar cada usuario según su rol o negocio, impidiendo fugas de información. <br>*Ejemplo: Un administrador de FastFix no puede ver las órdenes de Tranqi.* |
| **RPC** | *Remote Procedure Call* | **Llamada a Procedimiento Remoto** | Función programada directamente dentro de la base de datos que ejecuta múltiples acciones complejas en un solo paso seguro y cerrado. <br>*Ejemplo: La función `trq_fn_decidir_solicitud()` que en un solo segundo aprueba al abogado, cambia su rol y genera la auditoría.* |
| **RBAC** | *Role-Based Access Control* | **Control de Acceso Basado en Roles** | Modelo de seguridad donde los permisos se asignan a roles (`ADMINISTRADOR`, `OPERADOR`, `CLIENTE`) y no a personas individuales. |
| **API** | *Application Programming Interface* | **Interfaz de Programación de Aplicaciones** | El "puente" o menú de comandos que permite que dos sistemas hablen entre sí (ej. que la tienda web le pida el catálogo a Supabase o que el bot de WhatsApp consulte precios). |
| **SDK** | *Software Development Kit* | **Kit de Desarrollo de Software** | Conjunto de herramientas y librerías prefabricadas para interactuar con un servicio sin escribir código desde cero (ej. `@supabase/supabase-js`). |
| **CLI** | *Command Line Interface* | **Interfaz de Línea de Comandos** | Herramienta que se ejecuta escribiendo instrucciones en la terminal o consola de comandos (ej. `pnpm`, `git`, `supabase`). |
| **Idempotencia** | *Idempotence* | **Idempotencia** | Propiedad de una acción que, sin importar cuántas veces se ejecute repetidamente con los mismos datos, produce exactamente el mismo resultado sin duplicar nada. <br>*Ejemplo: Si la pasarela de pagos reintenta cobrar 3 veces por un error de red, solo se cobra una vez.* |
| **Tenant** | *Tenant* | **Inquilino / Unidad de Negocio** | Cada uno de los negocios o empresas que operan dentro de una plataforma compartida (Multi-tenant) de forma aislada. <br>*Ejemplo: Tinkay, Margaritas, Tranqi y FastFix son 4 tenants sobre una sola base de datos.* |
| **Retrocompatibilidad** | *Backward Compatibility* | **Compatibilidad hacia atrás** | Regla de diseño donde actualizar o agregar una función nueva nunca rompe el funcionamiento de lo que ya estaba funcionando antes en otros negocios. |
| **Feature Flag** | *Feature Flag / Toggle* | **Bandera de Funcionalidad** | Un interruptor de configuración que activa o desactiva una capacidad para un negocio puntual sin tener que cambiar el código de los demás. <br>*Ejemplo: `precios_incluyen_iva: true` activo para Tinkay y desactivado para Tranqi.* |
| **Strategy Pattern** | *Strategy Pattern* | **Patrón Estrategia** | Patrón de arquitectura donde un sistema común tiene varias formas de resolver algo (ej. cómo calcular el precio o el despacho) y cada negocio elige su estrategia mediante configuración, sin meter condicionales `if/else` por nombre de empresa. |

---

## 2. Siglas de Base de Datos y Modelado

| Sigla / Término | Significado | Explicación Sencilla y Ejemplo en el Proyecto |
| :--- | :--- | :--- |
| **PK** | *Primary Key* (**Clave Primaria**) | El identificador único e irrepetible de una fila en una tabla (en nuestro ecosistema siempre usamos identificadores universales tipo `uuid`). <br>*Ejemplo: `pro_id` en la tabla de productos.* |
| **FK** | *Foreign Key* (**Clave Foránea**) | Columna que vincula una fila con otra tabla para asegurar que los datos estén conectados correctamente. <br>*Ejemplo: `var_producto_id` en `com_variante` apunta al `pro_id` de `com_producto`.* |
| **UUID** | *Universally Unique Identifier* | Identificador alfanumérico globalmente único de 36 caracteres (ej. `123e4567-e89b-12d3-a456-426614174000`) que evita colisiones entre registros. |
| **JSONB** | *Binary JavaScript Object Notation* | Formato de base de datos que permite guardar estructuras flexibles (como configuraciones, redes sociales o campos dinámicos) dentro de una sola columna sin crear 20 columnas fijas. <br>*Ejemplo: `cfg_detalle_configuracion`.* |
| **CRUD** | *Create, Read, Update, Delete* | Las cuatro operaciones básicas sobre cualquier información: Crear, Leer, Actualizar y Eliminar. |

---

## 3. Siglas de Negocio, Comercio y Finanzas (E-Commerce, CPQ & RevOps)

| Sigla / Término | Significado | Explicación Sencilla y Ejemplo en el Proyecto |
| :--- | :--- | :--- |
| **CPQ** | *Configure, Price, Quote* (**Configurar, Fijar Precio, Cotizar**) | Sistema que permite cotizar trabajos bajo demanda con opciones personalizadas, aplicar descuentos por volumen y emitir una proforma interactiva para que el cliente la apruebe. <br>*Ejemplo: Cotizaciones de FastFix (repuesto calefón + mano de obra).* |
| **BOM** | *Bill of Materials* (**Lista de Materiales o Receta**) | La lista detallada de insumos que componen un producto terminado. <br>*Ejemplo: Un bouquet coreano = 24 rosas + 3 pliegos de papel coreano + cinta.* |
| **SKU** | *Stock Keeping Unit* (**Unidad de Mantenimiento de Stock**) | Código único que identifica a una variante específica vendible e inventariable. <br>*Ejemplo: `SKU-COR-MED` (Bouquet Coreano Mediano).* |
| **COGS** | *Cost of Goods Sold* (**Costo de Mercancía Vendida**) | Lo que le cuesta realmente al negocio fabricar o entregar un producto (solo materias primas y mano de obra directa). Permite saber el margen de ganancia real. |
| **Kardex** | **Kardex de Inventario** | Registro contable de cada movimiento de bodega: cuántas unidades entraron, cuántas salieron por venta y cuántas se perdieron por merma. |
| **Merma** | *Waste / Shrinkage* (**Desperdicio / Merma**) | Productos o insumos que se dañan, caducan o rompen y no se pudieron vender (ej. flores marchitas, café vencido, tubos rotos). |
| **RevOps** | *Revenue Operations* (**Operaciones de Ingresos**) | Disciplina que alinea ventas, precios, marketing y tecnología para optimizar la rentabilidad y evitar pérdidas de dinero en el ciclo comercial. |
| **MRR** | *Monthly Recurring Revenue* (**Ingreso Recurrente Mensual**) | El dinero fijo que ingresa cada mes por clientes suscritos a planes activos (ej. planes de Tranqi o suscripciones de flores). |
| **ARR** | *Annual Recurring Revenue* (**Ingreso Recurrente Anual**) | El valor anualizado de las suscripciones fijas (`MRR * 12`). |
| **Churn** | *Customer Churn* (**Tasa de Cancelación**) | El porcentaje de suscriptores o clientes que cancelan su servicio cada mes. |
| **LTV** | *Lifetime Value* (**Valor de Vida del Cliente**) | La estimación de cuánto dinero neto dejará un cliente a lo largo de todos los meses o años que compre en la empresa. |
| **Seat-Based Pricing** | **Precio por Asiento / Usuario** | Modelo de cobro B2B donde el costo depende del número de colaboradores que usarán el servicio (ej. planes corporativos de Tranqi para empresas). |
| **B2B2C** | *Business-to-Business-to-Consumer* | **Modelo Empresa a Empresa para el Consumidor Final** | Modelo comercial donde una empresa cliente (ej. Banco Pichincha) contrata y paga el servicio para que sus empleados o usuarios finales (consumidores) lo usen gratuitamente como beneficio. |
| **Claiming** | *Benefit Claiming* (**Reclamo o Vinculación de Beneficio**) | Proceso por el cual un usuario final vincula su cuenta personal a un convenio corporativo pagado por su empleador mediante validación de cédula o código OTP a su correo de trabajo. |
| **Member Pricing** | *Membership-Tier Pricing* (**Precios por Nivel de Membresía**) | Estrategia de ingresos donde el precio final de un trámite, producto o servicio se descuenta automáticamente si el cliente tiene una suscripción o membresía activa. <br>*Ejemplo: Notarización baja de $150 a $127.50 (-15%) para miembros del Plan Básico en Tranqi.* |
| **Billetera Digital** | *Store Credit / Customer Wallet* (**Saldo de Cliente**) | Módulo que almacena fondos prepagados por el usuario (recargas con tarjeta de crédito) o bonos otorgados por convenios y programas sociales (ej. Bono Municipio de Quito de $100) para pagar consumos dentro de la plataforma. |
| **Split Payment** | *Split Payment* (**Pago Mixto o Dividido**) | Capacidad del checkout de liquidar una misma compra usando dos o más métodos de pago simultáneos. <br>*Ejemplo: Pagar $100 con el bono de la billetera digital y los $27.50 restantes con tarjeta de crédito.* |
| **CAC** | *Customer Acquisition Cost* (**Costo de Adquisición de Clientes**) | La inversión total en marketing y ventas necesaria para conseguir un cliente nuevo. El modelo B2B2C de condominios y empresas busca reducir el CAC a casi cero. |
| **Give-Get Asymmetric** | *Asymmetric Value Proposition* (**Asimetría de Valor**) | Principio de monetización donde los beneficios tangibles e inmediatos que recibe el cliente al suscribirse (ej. $100 en billetera + revisión de calefón gratis de $30) superan visiblemente el costo de la cuota mensual. |
| **Best Deal Rule** | *Best Deal Rule* (**Regla del Mejor Beneficio**) | Política de RevOps que previene la acumulación destructiva de promociones: si un cliente tiene descuento de membresía (15%) y usa un cupón de influencer (20%), el sistema aplica únicamente el mayor (20%), protegiendo el margen del negocio. |

---

## 4. Siglas Tributarias y Facturación (Ecuador - SRI)

| Sigla / Término | Significado | Explicación Sencilla y Ejemplo en el Proyecto |
| :--- | :--- | :--- |
| **SRI** | **Servicio de Rentas Internas** | La entidad pública de administración tributaria de Ecuador. |
| **RIDE** | *Representación Impresa de Documento Electrónico* | El archivo visual en formato PDF de una factura electrónica autorizada por el SRI. |
| **Clave de Acceso** | **Clave de Acceso SRI (49 dígitos)** | Código numérico único de 49 dígitos generado para cada comprobante electrónico (factura, nota de crédito, retención) que permite validarlo en la web del SRI. |
| **IVA** | **Impuesto al Valor Agregado** | Impuesto que grava el valor de las transferencias locales de bienes y servicios (en Ecuador: `IVA_15` tarifa general 15%, `IVA_0` tarifa 0% para productos básicos o exentos). |
| **Proforma** | **Proforma / Presupuesto Comercial** | Cotización informativa sin validez tributaria. Si el cliente la aprueba y paga, se transforma en una Factura con autorización del SRI. |

---

## 5. Siglas Operativas por Negocio

| Sigla / Término | Negocio de Aplicación | Explicación Sencilla |
| :--- | :--- | :--- |
| **LPMS** | Tranqi (Legal) | *Law Practice Management Software*: Sistema estándar para administrar casos, audiencias, clientes y tiempos en un estudio jurídico. |
| **Retainer** | Tranqi (Legal) | Anticipo o bolsa de horas mensual pagada por un cliente corporativo para tener asesoría jurídica disponible. |
| **FSM** | FastFix (Hogar) | *Field Service Management*: Gestión de técnicos en campo, agendas de visitas, reparaciones en sitio y repuestos utilizados. |
| **SLA** | FastFix / Tranqi | *Service Level Agreement* (Acuerdo de Nivel de Servicio): Tiempo máximo comprometido para atender una solicitud o emergencia (ej. técnico en casa en menos de 2 horas). |
| **POS** | Cafetería / Retail | *Point of Sale* (Punto de Venta): Pantalla táctil o caja registradora rápida donde se toman pedidos directos y se imprime la comanda/factura al instante. |
| **Delivery Window** | Tinkay / Margaritas | *Franja de Entrega Logística*: Ventana horaria amplia (ej. 09:00 - 13:00) donde la furgoneta o repartidor optimiza la ruta de despacho sin recargo adicional. |
| **Exact Time Surcharge** | Tinkay (E-Commerce) | *Recargo por Horario Puntual o Madrugador*: Tarifa adicional (ej. +$10.00) cobrada automáticamente cuando el cliente exige una entrega en un minuto exacto (ej. 07:00 AM) fuera de la ruta estándar. |
| **Two-Way Sync** | Tranqi / Plataforma | *Sincronización Bidireccional de Calendarios*: Integración mediante Google Calendar API (FreeBusy y Webhooks) donde los eventos bloqueados en el calendario personal/corporativo del abogado bloquean citas en Tranqi, y las citas tomadas en Tranqi se escriben automáticamente en su Google Calendar. |
| **Managed Marketplace** | FastFix Home | *Mercado Gestionado con Respaldo de Marca*: Modelo donde FastFix opera con cuadrilla propia y expande su capacidad subcontratando técnicos externos homologados (plomeros, electricistas), manteniendo la cara visible, facturación y garantía ante el cliente final. |
| **POD** | Tinkay / FastFix / Tranqi | *Proof of Delivery / Recepción Conforme*: Evidencia digital obligatoria al finalizar una entrega o servicio (fotografía geolocalizada de las flores entregadas, firma del cliente en pantalla o acuse de recibo de documentos notariales). |
| **Courier de Documentos** | Tranqi (Legal) | Servicio de mensajería motorizada para retiro, diligencias notariales, recolección de firmas físicas y entrega de expedientes o escrituras certificadas a domicilio. |
| **Directorio de Delivery** | Tinkay / Margaritas | Registro centralizado de transportistas de confianza (Uber, Cabify, taxis convencionales, repartidores independientes) que la coordinadora de taller asigna a cada orden, registrando contacto, placa y link de rastreo. |
| **Base Comisionable Neta** | Tinkay / Plataforma | *Net Commissionable Base*: Valor residual de la venta sobre el cual se calcula la comisión del vendedor, tras descontar cupones, flete real, costos de instalación, comisión de plataforma y recargos de pasarela de pago (TC 6%). |
| **Gastos Deducibles de Venta** | Ecosistema | Costos operativos directos que se restan del valor de la venta antes de liquidar honorarios o comisiones a asesores y socios (evitando pagar comisiones sobre fletes o tarifas bancarias). |
| **Atribución ARIA** | Plataforma (IA) | *Conversational Lead Attribution*: Mecanismo por el cual el agente conversacional ARIA vincula una conversación y orden a un vendedor específico mediante links de referidos (`?asesora=paola`) o turnos rotativos. |
| **Deuna** | Plataforma / SRI | Billetera digital y pasarela de cobro inmediato del Banco Pichincha en Ecuador que opera mediante códigos QR o número de celular sin comisión bancaria para pagos directos. |
| **Payphone** | Tinkay / Margaritas | Pasarela de pagos ecuatoriana que permite cobros con tarjeta de crédito/débito nacional e internacional, links de pago y transferencias app-to-app. |
| **Paymentez / Nuvei** | Tranqi | Pasarela de procesamiento de pagos con soporte de tokenización de tarjetas, suscripciones recurrentes y protocolo de seguridad 3D Secure en Ecuador. |
| **OCR Multimodal ARIA** | Plataforma (IA) | Capacidad de visión artificial y extracción documental de ARIA para leer capturas de transferencias, comprobantes de pago, cédulas y expedientes en PDF. |
| **Anti-Duplicación de Comprobantes** | Ecosistema | Control automático que audita la referencia bancaria de transferencias y pagos Deuna para evitar fraudes por reutilización de un mismo comprobante en múltiples órdenes. |
| **Human-in-the-Loop (HITL)** | Plataforma (IA) | Modelo de supervisión activa donde el agente conversacional ARIA atiende de forma autónoma pero permite a la asesora o coordinadora humana intervenir, editar datos o tomar el control manual del chat en cualquier momento. |
| **Conversational Intake** | Tinkay / Plataforma | *Toma de Pedido Conversacional*: Flujo en el que ARIA recopila todos los datos de la reserva (producto, dedicatoria, fecha, franja, dirección y comprobante) directamente dentro del chat de WhatsApp sin forzar al cliente a salir a una web. |
| **Álbumes Google Photos en Catálogo** | Tinkay / Margaritas | Enlaces a álbumes seleccionados de Google Photos (`photos.app.goo.gl/...`) asociados a categorías de producto, permitiendo compartir fotos reales de taller de alta resolución en WhatsApp sin consumir almacenamiento local. |

---

> 📌 **Regla de Actualización Obligatoria:**  
> Cada vez que en una conversación, especificación o decisión técnica se utilice una sigla o concepto nuevo (ej. `Webhook`, `JWT`, `OTP`, `OAuth`, `MFA`, `TTL`), el agente actualizará este archivo de inmediato para mantener la enciclopedia completa del ecosistema.


