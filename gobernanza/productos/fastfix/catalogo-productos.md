# Catálogo y Portafolio de Servicios — FastFix Home

**Negocio:** `fastfix`  
**Estado:** Propuesta Preliminar (Tarifas supuestas para calibración operativa y de costos)  
**Esquema de Base de Datos:** `comun_comercio` (Filtrado por `*_negocio = 'fastfix'`)  
**Política Fiscal:** B2C / B2B — Precios cotizados como Subtotal (más IVA 15%), desglosando Mano de Obra y Repuestos.  

---

## 1. Categorías de Navegación (`com_categoria`)

| Código Categ. | Nombre Visible | Descripción | Orden |
| :--- | :--- | :--- | :--- |
| `FFH_MANTENIMIENTO`| **Mantenimientos Fijos** | Visitas técnicas con tarifa plana y alcance preventivo cerrado. | 1 |
| `FFH_LIMPIEZA`     | **Jornadas de Limpieza** | Personal especializado por día-hombre o por hora. | 2 |
| `FFH_PLANES`       | **Planes de Asistencia** | Suscripción anual de mantenimiento y emergencias del hogar. | 3 |
| `FFH_COTIZACIONES` | **Proformas Compuestas** | Reparaciones mayores (Mano de obra + Repuestos/Materiales). | 4 |

---

## 2. Servicios Maestros y Variantes (`com_producto` y `com_variante`)

### A. Categoría: Mantenimientos Tarifa Plana (`FFH_MANTENIMIENTO`)
1. **Mantenimiento Preventivo de Calefón (Gas/Eléctrico):**
   * `FFH-CAL-30`: Tarifa estándar — Subtotal: **$30.00** + IVA.
     * Incluye: Limpieza de inyectores, chequeo de termostato, calibración de presostato y prueba de fugas.
2. **Mantenimiento de Puerta de Garaje Automática:**
   * `FFH-GAR-50`: Tarifa estándar — Subtotal: **$50.00** + IVA.
     * Incluye: Ajuste y engrase de rieles/cadenas, calibración de final de carrera y chequeo de sensores.
3. **Mantenimiento y Certificación de Cerca Eléctrica:**
   * `FFH-CER-50`: Tarifa estándar (hasta 50 metros lineales) — Subtotal: **$50.00** + IVA.
     * Incluye: Medición de alto voltaje, cambio de hasta 5 aisladores dañados y calibración de sirena.

---

### B. Categoría: Jornadas de Limpieza (`FFH_LIMPIEZA`)
*Servicios tarificados por tiempo y mano de obra (`TIEMPO_MANO_OBRA`):*
1. **Limpieza Básica del Hogar:**
   * `FFH-LIM-BAS`: **Jornada Día-Hombre (8 horas / 1 Técnico)** — Subtotal: **$20.00** + IVA.
     * **Alcance:** Hasta 90m² / 2 habitaciones / 1 baño. Barrido, trapeado, aspirado y desempolvado general.
2. **Limpieza Profunda / Desinfección:**
   * `FFH-LIM-PRO`: **Jornada Día-Hombre (8 horas / 1 Técnico)** — Subtotal: **$50.00** + IVA.
     * **Alcance:** Desmanchado de vidrios, remoción de grasa en cocina, desinfección profunda de azulejos.
3. **Limpieza Corporativa / Oficinas:**
   * `FFH-LIM-CORP`: **Tarifa por Hora-Hombre** — Subtotal: **$6.00 / hora** + IVA (Mínimo 4 horas).

---

### C. Categoría: Planes de Asistencia Hogar (`FFH_PLANES`)
*Suscripción recurrente mensual/anual (`com_suscripcion`) diseñada bajo la regla de Asimetría de Valor (Give-Get Asymmetric):*
1. `FFH-PLAN-BAS`: **Plan Asistencia Básica** — **$20.00 / mes**
   * **Billetera Digital:** **$50.00 de Saldo Inmediato** en mano de obra en su cuenta al contratar el año.
   * **Cobertura:** 2 asistencias de emergencias (plomería/electricidad) sin costo de mano de obra.
   * **Descuento Miembro:** 10% de descuento permanente en mano de obra para otros arreglos.
2. `FFH-PLAN-MED`: **Plan Hogar Protegido** — **$30.00 / mes**
   * **Billetera Digital:** **$100.00 de Saldo Inmediato** en mano de obra en su cuenta.
   * **Mantenimiento Preventivo Gratis:** 1 revisión completa de calefón o puerta de garaje al año (valorada en hasta $50).
   * **Cobertura:** 4 asistencias de emergencia al año + 15% de descuento permanente en mano de obra.
   * **SLA de Emergencia VIP:** Atención garantizada en menos de 2 horas.
3. `FFH-PLAN-PLUS`: **Plan Total Confort Familiar** — **$50.00 / mes**
   * **Billetera Digital:** **$150.00 de Saldo Inmediato** en mano de obra.
   * **Preventivos Incluidos:** 2 mantenimientos preventivos anuales (calefón + puerta/cerca).
   * **Cobertura Ilimitada:** Mano de obra 100% cubierta en emergencias del hogar + 20% descuento en cualquier remodelación.

* **Soporte de Cupones (`com_cupon`):**
  * Campañas de *influencers* (ej. `CARLOS50`): 50% de descuento en el primer mes del plan (`cup_regla_suscripcion = 'SOLO_PRIMER_CICLO'`).
  * Regla del Mejor Beneficio: Los cupones de influencers no se suman al descuento de membresía activa (aplica el mayor de los dos).

---

### D. Trabajos Cotizados y Proformas CPQ (`com_proforma`)
* **Flujo Operativo:**
  * Diagnóstico en sitio $\rightarrow$ Emisión de Proforma digital con token único.
  * **Líneas Compuestas:** Mano de obra técnica + Repuestos/Materiales con inventario descontable o ítem manual libre.
  * **Regla de Anticipo:** Las proformas que contienen repuestos físicos exigen el **50% de anticipo** para despachar la orden de trabajo.

---

## 3. Banco de Ideas Estratégicas y Expansión Comercial

### A. Estrategia "Condominio Protegido" (Alianza con Administradores de Edificios)
* **Punto de Dolor:** Los administradores de propiedad horizontal lidian a diario con emergencias comunales (bombas quemadas, puertas de garaje trabadas, cercas eléctricas sin sirena, goteras) atendidas por técnicos informales sin respaldo ni facturas electrónicas.
* **Propuesta Comercial FastFix:**
  1. **Contrato de Mantenimiento Preventivo Comunal:** Revisión trimestral o semestral integral de las instalaciones del edificio.
  2. **Incentivo de Saldo en Mano de Obra (Billetera Digital `com_billetera`):**
     * Al firmar el contrato de mantenimiento comunal o limpieza con el edificio, FastFix acredita un **Saldo a Favor** (ej. **$100.00** o el 10% del contrato) en la billetera de la Administración del Condominio.
     * **Regla de Uso:** Este saldo es redimible exclusivamente para **Mano de Obra** en cualquier reparación imprevista que surja en el año. El condominio solo paga los repuestos/materiales si son necesarios, reduciendo su gasto de caja chica.
  3. **Efecto Red para Copropietarios (Adquisición Masiva B2C):**
     * Cada propietario o inquilino del conjunto recibe un **Bono de Bienvenida Vecinal de $20.00** en mano de obra en su cuenta personal de FastFix para arreglos dentro de su departamento (calefón, grifería, cerraduras).
     * Esto convierte a todo el edificio en clientes cautivos de FastFix con costo de adquisición prácticamente nulo.

### B. Empresa Integral de Limpieza Profesional
* **Jornadas Estandarizadas:** Paquetes para mudanzas, remodelaciones, locales comerciales y oficinas con cuadrillas uniformadas y supervisión digital.
* **Kits con Recetas BOM:** Insumos y químicos dosificados por jornada, controlando el inventario y evitando fugas de materiales.

### C. Club de Mantenimiento Preventivo (Suscripción B2C)
* Micro-planes para casas y departamentos: recordatorios automáticos y 2 visitas preventivas al año para evitar daños mayores en calefones, gasfitería y sistemas eléctricos.

### D. Expansión mediante Subcontratación Homologada (*Managed Marketplace* con Respaldo FastFix)
* **Cuadrilla Interna + Red de Proveedores Subcontratados:** FastFix mantiene su cuadrilla propia para servicios esenciales y soporte prioritario, pero escala su cobertura subcontratando técnicos especializados y cuadrillas externas homologadas (`com_proveedor_servicio`).
* **Respaldo y Garantía de Marca:** El cliente final siempre interactúa con FastFix (facturación electrónica centralizada, pasarela de pagos, atención al cliente y póliza de garantía). El técnico viste uniforme homologado o se identifica como "Técnico Certificado por la Red FastFix".
* **Control Operativo y Liquidación (`com_despacho_asignacion`):** El sistema asigna el servicio al contratista externo con datos de contacto, hoja de ruta, check-list de calidad, fotos de evidencia antes/después y registro del costo liquidado al proveedor para control de margen bruto.


