# Cierre de Tarea — Carrusel Cíclico y Jerarquía Estructural del Catálogo Tinkay

- **Fecha:** 2026-11-18
- **Rama:** `master`
- **Producto:** `tinkay-web`

## 1. Carrusel Continuo e Infinito (`CarruselProductosDestacados.tsx`, `CarruselTestimoniosClientes.tsx`)
- Se reemplazó el `scrollBy` rígido por una navegación cíclica inteligente:
  - Al pulsar hacia la derecha (`>`) y alcanzar el final del riel horizontal (`scrollLeft >= maxScroll - 25`), vuelve suavemente al inicio (`scrollTo({ left: 0, behavior: 'smooth' })`).
  - Al pulsar hacia la izquierda (`<`) estando al inicio (`scrollLeft <= 25`), se desplaza suavemente hasta el final (`scrollTo({ left: maxScroll, behavior: 'smooth' })`).
  - Evita que los botones queden bloqueados o deshabilitados unilateralmente.

## 2. Jerarquía Estructural en "Flores con Historia, Para Cada Momento" (`VitrinaCatalogoTinkay.tsx`, `filtrado-catalogo.ts`)
- Se implementó la jerarquía de 5 niveles solicitada por el usuario en `obtenerJerarquiaCatalogoTinkay`:
  1. **Nivel 1 (Primero):** Todos los demás — Primero los destacados (Bouquets coreanos, Box florales, Ramos clásicos con `destacado = true`).
  2. **Nivel 2 (Luego el resto):** Todos los demás — Resto de arreglos florales y bouquets para regalo.
  3. **Nivel 3 (Trasantepenúltimo):** Condolencias y Funerarios (coronas, pedestales, abanicos, cruces).
  4. **Nivel 4 (Penúltimo):** Eventos y Ceremonias (arcos florales, bienvenida de gala, montajes de ceremonias).
  5. **Nivel 5 (Último):** Mobiliario (mobiliario en renta, atriles, mamparas, backings, estructuras).
- Se configuró por defecto `criterioOrden = 'recomendados'` ("Recomendados Tinkay") en el selector de ordenamiento.
- En la vista general ("Todo el Catálogo"), esta jerarquía se preserva como criterio primario de visualización, ordenando por precio o nombre dentro de cada bloque, asegurando que el cliente siempre vea las flores frescas icónicas de regalo al inicio y nunca mobiliario o coronas fúnebres en la cabecera.
