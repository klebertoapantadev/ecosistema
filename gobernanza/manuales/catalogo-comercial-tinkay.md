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

## 2. Arquitectura de 3 Capas y Configuración de Productos

```
[ CAPA 1: CATEGORÍA / COLECCIÓN ]  ➔  "Estilo Coreano", "Floreros", "Condolencias"
                                        (Agrupa decenas de productos distintos)
              │
[ CAPA 2: PRODUCTO MASTER ]        ➔  "Bouquet Diseño Estilo Coreano"
                                        (El arreglo específico con recursos comunes)
              │
[ CAPA 3: VARIANTES / SKUs ]       ➔  "Pequeño 12 rosas ($25)", "Gigante VIP ($60)"
                                        (Opciones de compra con precio, foto o extras)
```

### Regla de Oro
**No crear productos duplicados para cada tamaño.** Se crea un solo producto maestro y dentro de él se administran sus variantes.

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

---

## 6. Catálogo de Variedades de Rosas de Exportación (Floraroma SA)

Para mantener una comunicación profesional con fincas y clientes, se utiliza la correspondencia entre **Nombre Formal de Variedad** y **Color Comercial Simple**:

| Variedad Formal (Finca / Floraroma) | Color Comercial Simple | Características Visuales & Ocasión |
| :--- | :--- | :--- |
| **Explorer** | 🔴 Rojo Clásico Pasión | Botón grande, pétalos aterciopelados, sin espinas duras. Amor y aniversarios. |
| **Mondial / Playa Blanca** | ⚪ Blanco Puro / Crema | Apertura simétrica y elegante. Bodas, aniversarios y condolencias solemnes. |
| **Kahala** | 🍑 Durazno / Salmón Champagne | Tono pastel degradado vintage muy cotizado para ramos coreanos modernos. |
| **Pink Floyd** | 🌸 Fucsia Neón Intenso | Botón extragrande y color muy vibrante. Cumpleaños y felicitaciones. |
| **Cherry O** | 🌺 Fucsia Cereza Profundo | Tono cálido juvenil de larga duración en florero. |
| **Movie Star** | 🌷 Rosado Suave Bicolor | Degradado blanco con bordes rosáceos delicados. |
| **Hermosa / Sweet Unique** | 💗 Rosa Pastel Suave | Tono romántico delicado de alta demanda para quinceañeras y novias. |
| **High & Magic** | 🟡🔴 Bicolor Amarillo con Borde Rojo | Enérgico, alegre y de gran contraste para agradecimientos. |

---

## 7. Diferencia entre Variantes de Producto vs. Opciones de Personalización

1. **Variantes (SKU con Precio Diferente):**
   - Corresponden estrictamente al **Tamaño / Cantidad de Tallos** (*Pequeño 12 rosas $25*, *Mediano 24 rosas $35*, *Grande 36 rosas $45*, *Gigante VIP 50 rosas $60*).
2. **Opciones de Personalización (Sin costo adicional o con extras fijos):**
   - **Colores de Rosas:** Selección de hasta 2 variedades de rosas según la **Disponibilidad en Vivo del Taller** (ej. *12 Explorer Rojo + 12 Mondial Blanco*).
   - **Papel Decorativo Coreano Impermeable:** Selección del color de envoltura (*Blanco Nieve, Negro Elegance, Rosado Pastel, Azul Celeste, Verde Olivo*).

---

## 8. Tablero de Disponibilidad Diaria y Conteo en Taller (Rutina de 30 Segundos)

Cada mañana o al recibir el flete de la finca en paquetes de **25 tallos (1 bonche)**:

1. El florista abre el **Tablero de Disponibilidad en Vivo** en `/panel/comercio` (o catálogo).
2. Mira los baldes de agua en taller y cuenta los paquetes:
   - Con los botones `[ - ]` y `[ + ]`, sube o baja los bonches disponibles (ej. `Explorer: 10 bonches`, `Kahala: 3 bonches`, `Mondial: 5 bonches`).
3. Si un color de papel o rosa se termina, presiona el botón rojo `🔴 Agotado`.
4. Al instante, **ARIA en WhatsApp** y la **tienda web** actualizan su inventario para no ofrecer rosas agotadas.

---

## 9. Herencia de Atributos y Sobrescritura por Variante (Ejemplo Real)

Para evitar duplicar textos y fotos innecesariamente:

1. **Nivel Producto Master (Común / Global):**
   - **Foto de Portada:** Fotografía principal del ramo coreano.
   - **Álbum Google Photos:** `https://photos.app.goo.gl/...` con fotos generales de entregas reales.
   - **Promesa de Entrega:** `🌸 Pide hoy, recibe hoy (Mismo Día)`.
   - **Beneficios Base:** *Rosas de exportación seleccionadas*, *Papel coreano impermeable plisado*, *Tarjeta dedicatoria gratis*.

2. **Nivel Variante Individual (Sobrescrituras):**
   - **Pequeño ($25) & Mediano ($35):** Heredan el 100% de los atributos globales sin cambios.
   - **Gigante VIP ($60):**
     - *Foto de Portada propia:* Se sube la foto específica donde el arreglo lleva la corona y mariposas.
     - *Tiempo de entrega:* Se cambia a `✨ Elaboración Especial en Taller (24 horas)` debido al tiempo de confección de la estructura.
     - *Modo de Beneficios (Anexar):* Mantiene los beneficios base y agrega:
       - `+ Corona dorada de reina metálica`
       - `+ Set de mariposas 3D translúcidas con glitter`
       - `+ Cinta de seda satinada de 5 cm de ancho con texto personalizado`
