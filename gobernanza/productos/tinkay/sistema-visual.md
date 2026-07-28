---
tipo: sistema_visual
estado: borrador
version: 0.1
fecha: 2026-07-28
responsable: Kleber Toapanta
---

# Tinkay — Sistema Visual

Aplica a `apps/tinkay-web`. **No es compartible con otros productos**: color, tipografía,
layout e identidad son propios de cada negocio — ver
[`estandares/01-convenciones-codificacion.md`](../../estandares/01-convenciones-codificacion.md)
§1. Lo que sí se comparte es comportamiento sin apariencia (`packages/primitivas`) y,
donde aplique, el mismo principio de disciplina de color que ya usa
[Tranqi](../tranqi/sistema-visual.md): una identidad no se diluye poniendo todos los
colores en todas partes.

El código vivirá en `apps/tinkay-web/app/globals.css`, reemplazando el CSS neutro de
fallback (`@eco/identidad/estilos-base.css`) que usa hoy. Mismo patrón que Tranqi: CSS
plano, variables CSS, clases en español, sin Tailwind.

## 1. Origen

A diferencia de Tranqi (que partió de un brochure ya unificado), Tinkay llega con **tres
colorways reales en uso simultáneo** en sus propios materiales: rosa (Instagram, uniforme
del equipo — su cara más pública, ~3 100 seguidores la reconocen así), violeta (rotulación
de la van) y negro+dorado (packaging físico, caja de regalo y tarjetas). Este documento no
inventa una marca nueva — **consolida la que ya existe** en un solo sistema, resolviendo
la inconsistencia entre colorways en favor de la versión más pública y reconocida (rosa),
incorporando el instinto premium que ya tenían en su packaging (dorado + verde botánico)
en vez de descartarlo.

**Decisión explícita de consolidación:** se descarta el violeta de la van como identidad
digital — coincide con el `--violeta` de Tranqi (`#5000BA`) y generaría colisión de marca
dentro del mismo ecosistema. El negro se mantiene fuera del lienzo principal (ver §3,
regla 3) — funciona en una etiqueta física pequeña, no como fondo de una pantalla completa.

**Objetivo de negocio declarado por el cliente: "escalar el target de la marca".** Esto no
es solo paleta — son decisiones de layout: fotografía grande y curada, tipografía serif
fina, dorado usado con escasez (nunca como superficie), mucho aire alrededor del producto.
Un sistema visual "premium" que grita colores pierde el argumento.

## 2. Paleta

| Token | Valor | Uso |
| :--- | :--- | :--- |
| `--rosa` | `#EC7FA7` | Identidad primaria — logo, CTA principal, acento de marca |
| `--rosa-oscuro` | `#D45E89` | Hover/estado activo de `--rosa` |
| `--verde` | `#3D5A45` | Secundario botánico — ancla "esto es una floristería real"; texto sobre `--crema`, iconografía de hoja/tallo |
| `--dorado` | `#B8923F` | Acento premium — **solo** líneas finas, bordes, tipografía de detalle, badges. Nunca superficie grande (regla 2) |
| `--crema` | `#F7F1E6` | Fondo de página — el kraft de su tarjeta real, no blanco clínico |
| `--blanco` | `#FFFFFF` | Superficie de tarjetas de producto y fotografía |
| `--tinta` | `#221D1A` | Texto — negro cálido, no `#000000` puro (coherente con el negro de su packaging) |
| `--coral-urgente` | `#D9524B` | Estados de tiempo — "Entrega hoy", pedidos de último minuto. Ver regla 4 |

⚠️ `--rosa`, `--verde` y `--dorado` están estimados a ojo desde fotos de producto real, no
desde un archivo de marca. Antes de implementar, validar contra el HEX exacto si existe un
archivo vectorial original del logo (Illustrator/Canva) — un ajuste de 3-4% de saturación
no cambia este documento, pero sí vale la pena confirmarlo una vez antes de fijarlo en CSS.

Tipografía: **Fraunces** (serif editorial, calidez con carácter) en títulos y nombres de
producto — dialoga con el logo sin copiarlo. **Inter** en UI, precios, checkout — donde
la legibilidad manda sobre la personalidad.

## 3. Las reglas del color

1. **El rosa es identidad, no papel tapiz.** Aparece en el logo, el CTA principal y
   acentos puntuales — no en fondos grandes. Un ecommerce que baña cada sección de rosa
   cansa a la vista antes del checkout y contradice el objetivo de "escalar el target".
2. **El dorado se gana su lugar por escasez.** Líneas de 1-2px, bordes de badge, una
   palabra en mayúscula espaciada — nunca relleno. El dorado vende calidad cuando aparece
   poco; empapelar la pantalla con él la abarata, no la eleva.
3. **El negro es tinta, no superficie.** Vive en `--tinta` (texto) y en piezas físicas de
   packaging — no como fondo de pantalla. Un ecommerce floral con fondo negro se lee "lujo
   frío genérico", no "floristería premium".
4. **Lo urgente se comunica con calidez saturada, nunca con rosa.** "Entrega hoy" o pedidos
   de último minuto (San Valentín, Día de la Madre) usan `--coral-urgente` — si el mismo
   rosa de marca también significa "urgente", deja de significar nada con precisión. Mismo
   principio semáforo que ya aplica Tranqi con su naranja.

## 4. Caso especial: Condolencias

Una porción real del negocio (confirmado por sus propias historias destacadas de
Instagram) es arreglos de condolencia. Esa categoría **no se viste igual que el resto del
catálogo**:

- Sin `--rosa`, sin `--dorado` decorativo, sin badges de "Nuevo"/"Oferta".
- Paleta reducida a `--verde`, `--crema`, `--blanco`, `--tinta`.
- CTA de compra en `--verde` en vez de `--rosa` — funcional, pero sobrio.
- Más aire, tipografía más pequeña y contenida — el usuario no está en modo regalo festivo.

Tratar esta categoría con la misma exuberancia que un bouquet de cumpleaños sería un error
de lectura del propio negocio, no solo estético.

## 5. Escala y forma

- Radios: 10 px (controles: botones, inputs), 16 px (bloques: secciones, tarjetas de
  contenido), 20 px (tarjetas de producto — la fotografía grande respira mejor con un radio
  algo mayor que el de un control). Píldora (999 px) solo en badges de estado ("Entrega
  hoy", "Nuevo") y en el CTA principal del hero de landing.
- Fotografía: **un producto protagonista por sección**, no grillas apretadas — coherente
  con el tratamiento ya visto en su caja negro+dorado. Fondo blanco o crema, sombra suave,
  nunca fondo de color pleno detrás del producto (el color lo aporta la flor misma).
- Densidad: la tienda respira — más espacio en blanco que Tranqi-cliente, que ya era el
  perfil menos denso del ecosistema.

## 6. Estados

Chips en versalita, 11 px, peso 800, fondo diluido del color — nunca el color pleno:

| Estado | Tratamiento |
| :--- | :--- |
| Disponible | Verde diluido |
| Agotado | Gris neutro sobre `--crema` |
| Entrega hoy / urgente | `--coral-urgente` diluido, texto en `--coral-urgente` |
| Nuevo | Dorado diluido — única excepción de uso "expansivo" del dorado, y aun así diluido, no pleno |

## 7. Accesibilidad

- Contraste mínimo AA (4.5:1) en texto sobre color. `--rosa` y `--dorado` **no son fondos
  de texto pequeño** — se usan como acento o con `--tinta`/`--blanco` encima según
  corresponda, nunca texto de color similar sobre sí mismos.
- El estado nunca se comunica solo por color — "Entrega hoy" lleva texto, no solo un punto
  de color.
- Todo bloque animado (carrusel de producto, transiciones de categoría) respeta
  `prefers-reduced-motion: reduce`.

## 8. Pendiente

- Confirmar HEX exacto de marca si existe archivo original (ver nota en §2).
- Definir con el negocio si el violeta de la van se retira también de materiales físicos
  futuros, o si queda como uso exclusivo offline sin pretensión de ser "el color de Tinkay".
- Maquetas de referencia navegables (`maquetas/`, mismo patrón que Tranqi) — pendientes,
  se crean al empezar la implementación en `apps/tinkay-web`.
