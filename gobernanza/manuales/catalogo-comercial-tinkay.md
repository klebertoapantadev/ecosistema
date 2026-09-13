---
tipo: manual
negocio: tinkay
modulo: catalogo_productos
codigo_req: PLT-009
version: 1.0
fecha: 2026-09-13
responsable: Lead E-commerce Product Manager & Floral Commerce Strategist
---

# Manual de Configuración de Catálogo Comercial · Tinkay Floristería

## 1. Visión General y Propósito Comercial

Tinkay es una floristería digital de alta gama con modelo de entrega **On-Demand / Quick-Commerce** en el Distrito Metropolitano de Quito y Valles. A diferencia de un catálogo tradicional de servicios, el catálogo floral de Tinkay se fundamenta en:

1. **Inmediatez y Emoción de Compra:** El 80% de los clientes compran por urgencia o impulso (cumpleaños de hoy, aniversarios olvidados, agradecimientos, condolencias).
2. **Impacto Visual Real:** Las imágenes reales, videos en movimiento (textura de papel coreano, brillo de cintas satinadas) y enlaces a álbumes de entregas son el principal factor de conversión.
3. **Estructura Multivariante (Tamaños):** Un único producto maestro contiene múltiples opciones de tamaño/tallos de rosas con cálculo de base imponible e IVA 15% SRI.

---

## 2. Configuración de Productos Maestros y Variantes

### Regla de Oro
**No crear productos duplicados para cada tamaño.** Se crea un solo producto maestro y dentro de él se administran sus modalidades de tarifa.

### Ejemplo Real de Configuración: *Bouquet Diseño Estilo Coreano*

* **Nombre:** `Bouquet Diseño Estilo Coreano`
* **Categoría:** `Estilo Coreano` (`cat-coreanos`)
* **Tipo de Oferta:** `Producto Físico / Entrega Floral a Domicilio` (`FISICO`)
* **Promesa de Entrega:** `🌸 Pide hoy, recibe hoy (Mismo Día)`
* **Modalidades / Variantes:**

| Modalidad / Tamaño | SKU | Receta / Composición (BOM) | Base Imponible ($) | IVA 15% ($) | PVP Total SRI ($) |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Pequeño (12 Rosas)** | `TNK-COR-PEQ` | 12 Rosas Exportación + 2 Pliegos Coreanos + Cinta Satinada | $21.7391 | $3.26 | **$25.00** |
| **Mediano (24 Rosas)** | `TNK-COR-MED` | 24 Rosas Exportación + 3 Pliegos Coreanos + Eucalipto | $30.4348 | $4.57 | **$35.00** |
| **Grande (36 Rosas)** | `TNK-COR-GRA` | 36 Rosas Exportación + 4 Pliegos Coreanos + Follaje Especial | $39.1304 | $5.87 | **$45.00** |
| **Gigante VIP (50 Rosas + Corona + Mariposas)** | `TNK-COR-GIG` | 50 Rosas + 6 Pliegos + Mariposas 3D + Corona Dorada | $52.1739 | $7.83 | **$60.00** |

---

## 3. Recursos Digitales y Multimedia (Vitrina & ARIA)

Cada producto y categoría debe contar con enlaces multimedia accesibles para la vitrina web y para que el agente de IA (ARIA) los comparta a clientes por chat:

1. **URL Imagen / Portada:** Fotografía vertical en alta resolución (aspect ratio 4:5 o 1:1) alojada en CDN o Unsplash.
2. **URL Álbum de Ejemplos / Muestras:** Enlace a Google Photos (ej. `https://photos.app.goo.gl/...`), Instagram o Dropbox con fotos reales de arreglos entregados por los floristas.
3. **URL Video / GIF Demostrativo:** Enlace a YouTube, MP4 o GIF que muestre el empaque, el desempaque o los detalles 3D.
4. **Galería Adicional:** URLs separadas por línea para carrusel de fotos secundarias.

---

## 4. Tiempos y Promesas de Entrega (SLAs)

Seleccionar siempre el preset comercial que mejor represente el tiempo de atención:

* **`⚡ Entrega Inmediata Express (45 - 90 min)`**: Para stock disponible en taller (ej. *25 Tallos de Rosas para Florero*, *Chocolates Ferrero*, *Globos Burbuja*).
* **`🌸 Pide hoy, recibe hoy (Mismo Día)`**: Para bouquets personalizados y diseños coreanos ordenados antes de las 17:00.
* **`✨ Elaboración Especial en Taller (24 horas)`**: Para arcos florales, pedestales monumentales o tributos de condolencias.
* **`📅 Entrega Programada / Fecha Especial`**: Para pedidos anticipados (San Valentín, Día de la Madre).

---

## 5. Integración con Pasarela Payphone y Facturación SRI

* El botón *"Contratar y Pagar con Payphone"* calcula automáticamente el desglose tributario ecuatoriano.
* En el checkout se registra el pago con estado `APROBADO` o `PENDIENTE` en `comun_comercio.com_pago` y se genera el recibo con desglose de Base Imponible + IVA 15%.
