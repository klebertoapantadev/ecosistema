---
tipo: manual
negocio: tranqi
modulo: catalogo_productos
codigo_req: PLT-009
version: 1.0
fecha: 2026-09-13
responsable: Director de Operaciones Jurídicas & E-commerce
---

# Manual de Configuración de Catálogo Comercial · Tranqi Legal

## 1. Visión General y Propósito

En Tranqi el catálogo comercial administra la **oferta de servicios jurídicos, liquidación de honorarios profesionales, trámites notariales y planes de blindaje legal mensual**.

---

## 2. Arquitectura de 3 Capas y Configuración de Honorarios

```
[ CAPA 1: CATEGORÍA / RAMA LEGAL ] ➔  "Familia & Civil", "Laboral", "Corporativo"
                                        (Agrupa los distintos campos del derecho)
              │
[ CAPA 2: PRODUCTO / SERVICIO MASTER] ➔ "Divorcio por Mutuo Consentimiento"
                                        (El trámite con alcance y requisitos comunes)
              │
[ CAPA 3: VARIANTES / TARIFAS ]    ➔  "Tarifa Notarial $150", "Con Sociedad $300"
                                        (Opciones por complejidad o seniority)
```

### Ejemplo Real: *Divorcio por Mutuo Consentimiento*
* **Nombre:** `Trámite de Divorcio por Mutuo Consentimiento`
* **Categoría:** `Derecho de Familia & Civil` (`cat-trq-familia`)
* **Tipo de Oferta:** `Servicio / Trámite Puntual` (`SERVICIO`)
* **Tiempo Estimado:** `3 a 5 días hábiles`
* **Modalidades:**
  * **Tarifa Notarial Estándar:** Base $130.4348 + IVA 15% ($19.57) = **$150.00 PVP** | SKU: `TRQ-DIV-NOT`
  * **Con Liquidación de Sociedad Conyugal:** Base $260.8696 + IVA 15% ($39.13) = **$300.00 PVP** | SKU: `TRQ-DIV-CONY`

### Ejemplo Real: *Blindaje Legal Empresarial (Suscripción)*
* **Nombre:** `Plan de Asesoría Legal Continua para PYMEs`
* **Categoría:** `Corporativo & Startups` (`cat-trq-empresas`)
* **Tipo de Oferta:** `Suscripción / Plan Periódico` (`SUSCRIPCION`)
* **Tarifa Mensual:** Base $173.9130 + IVA 15% ($26.09) = **$200.00 / mes** | SKU: `TRQ-SUS-CORP`

---

## 3. Requisitos y Constancia Digital

En Tranqi es mandatorio registrar:
* **Requisitos del Cliente:** Documentación habilitante obligatoria (cédulas, poderes, minutas previas).
* **Beneficios / Alcance:** Asignación de abogado especialista acreditado, revisión preliminar y constancia con firma electrónica.

---

## 4. Estructura de Tarifas por Seniority Profesional y Segmentación de Clientes

En servicios de consultoría y patrocinio judicial, las variantes se configuran por el **Nivel de Seniority del Abogado** o por el **Segmento de Cliente**:

| Nivel de Abogado / Tarifa | Base Imponible ($) | IVA 15% ($) | PVP Total ($) | Alcance del Servicio |
| :--- | :--- | :--- | :--- | :--- |
| **Abogado Junior / Asociado** | $39.1304 | $5.87 | **$45.00 / hora** | Revisión documental, minutas simples y consultas generales. |
| **Abogado Senior Especialista** | $65.2174 | $9.78 | **$75.00 / hora** | Audiencias, dictámenes periciales y contratos complejos. |
| **Socio Líder / Director de Firma** | $104.3478 | $15.65 | **$120.00 / hora** | Estrategia de litigio de alto impacto y arbitraje corporativo. |

---

## 5. Tablero de Disponibilidad de Horas de Consulta (ARIA MCP)

Los abogados y coordinadores jurídicos gestionan la disponibilidad diaria de slots de consulta en `/panel/comercio`:
* Conteo de **Horas Libres Disponibles Hoy** por especialidad (Civil, Laboral, Corporativo, Penal).
* El bot **ARIA Legal** consulta estos cupos en vivo para agendar citas telemáticas o presenciales sin traslapes.

---

## 6. Planes Legales Familiares y Corporativos (Bundles de Derechos)

Los planes de suscripción en Tranqi acreditan una **bolsa mensual de derechos de consumo** que se descuentan automáticamente a **$0.00** al ser utilizados por el cliente:

1. **Plan Cobertura SOS Individual ($19.00 / mes):**
   * 1 Cita telemática mensual con abogado.
   * 1 Revisión de contrato semestral con semáforo de riesgos.
   * Consultas ilimitadas con ARIA IA Legal 24/7.
   * Botón SOS 24/7 en flagrancia y accidentes de tránsito.
2. **Plan Amparo Familiar ($34.50 / mes):**
   * 4 Citas telemáticas especializadas al mes (Familia, Civil, Inquilinato, Tránsito).
   * 2 Revisiones y dictámenes express de contratos.
   * Consultas ilimitadas con ARIA IA Legal 24/7.
   * 35% de descuento en trámites notariales y litigios judiciales.
   * Cobertura para hasta 4 miembros del núcleo familiar.
3. **Plan Blindaje PYME ($89.00 / mes):**
   * 6 Citas corporativas y laborales al mes.
   * 4 Revisiones/redacciones de contratos comerciales.
   * 1 Diagnóstico preventivo trimestral SRI/Laboral.
   * Consultas ilimitadas ARIA IA 24/7.

---

## 7. Trazabilidad de Cobertura y Evidencias para el Cliente

El cliente no administra el catálogo comercial, pero tiene acceso pleno a su **Consola de Auditoría y Trazabilidad (`ModalHistorialUsoPlan.tsx`)**:
* **Estado del Contrato:** Próxima fecha de facturación, tarjeta emisora asociada y beneficiarios registrados.
* **Línea de Tiempo de Consumos:** Registro de cada cita o revisión ejecutada con fecha, abogado responsable y enlace directo al **Acta de Consulta o Dictamen Legal en PDF**.
