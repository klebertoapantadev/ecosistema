---
tipo: manual
negocio: margaritas
modulo: catalogo_productos
codigo_req: PLT-009
version: 1.0
fecha: 2026-09-13
responsable: Coordinador de Diseño Floral & Eventos
---

# Manual de Configuración de Catálogo Comercial · Margaritas Floristería

## 1. Visión General y Propósito

En Margaritas Floristería el catálogo administra **diseños florales boutique, ramos para ocasiones sociales, centros de mesa y planes de suscripción semanal para residencias y oficinas corporativas**.

## 2. Arquitectura de 3 Capas del Catálogo

```text
[ CAPA 1: CATEGORÍA / COLECCIÓN ]  ➔  "Suscripciones Corporativas", "Eventos Sociales", "Diseños Boutique"
                                        (Agrupa decenas de productos o paquetes distintos)
              │
[ CAPA 2: PRODUCTO MASTER ]        ➔  "Suscripción Floral Semanal Corporativa"
                                        (El producto base con textos, recursos y configuración general)
              │
[ CAPA 3: VARIANTES / SKUs ]       ➔  "Plan Standard (2 Arreglos) ($80/mes)", "Plan Premium (4 Arreglos) ($150/mes)"
                                        (Las modalidades y opciones de compra de ESE producto específico)
```

## 3. Configuración de Diseños Florales y Suscripciones

### Ejemplo Real: *Suscripción Floral Semanal para Oficina*
* **Nombre:** `Suscripción Floral Semanal Corporativa`
* **Categoría:** `Suscripciones Florales`
* **Tipo de Oferta:** `Suscripción Floral (Semanal / Mensual)` (`SUSCRIPCION`)
* **Tiempo de Entrega:** `📅 Entrega Programada los Lunes (08:00 AM)`
* **Modalidades:**
  * **Plan Standard (2 Arreglos / Semana):** Base $69.5652 + IVA 15% ($10.43) = **$80.00 / mes**.
  * **Plan Premium (4 Arreglos / Semana con Florero de Cristal):** Base $130.4348 + IVA 15% ($19.57) = **$150.00 / mes**.
