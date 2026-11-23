# Cierre de tarea — Pilares Hero actualizados y Personalización Floral completa (Admin + Compra + Pedidos/Taller)

**Fecha:** 2026-11-23  
**Alcance:** `packages/comercio`, `apps/tinkay-web`, `gobernanza/productos/tinkay`

## Cambios realizados

1. **Pilares de valor en Hero (`CarruselHeroDestacados.tsx`, `estilos-ecommerce.css`)**
   - Conservado: `Entrega puntual en Quito & Valles`.
   - Reemplazado: `Rosas de exportación garantizadas` → **`Rosas Ecuatorianas recién cosechadas`**.
   - Reemplazado: `Tarjeta caligráfica personalizada` → **`Tarjeta dedicatoria Impresa y/o Digital`**.
   - Agregado 4.º pilar: **`Decoración floral de eventos`**.
   - Ajuste de espaciado inferior móvil (`.hero-contenido-editorial`) para evitar solapamiento con las flechas del carrusel.

2. **Modelo de Personalización Floral y Configuración en Catálogo (`@eco/comercio`)**
   - `packages/comercio/src/utils/personalizacionFloral.ts` + pruebas unitarias `personalizacionFloral.test.ts`:
     - Configuración por producto: `1 Color` (defecto), `2 Colores` o `N Colores` de rosas (con restricción opcional de paleta); combinaciones habilitables `Solo Rosas`, `Solo Girasoles`, `Girasoles y Rosas`; **Orquídeas desde `0` hasta `N`**; **Color Base / Papel Decorativo** estrictamente con las 3 opciones exclusivas (`Colores Claros (Blanco / Beige)`, `Colores Oscuros (Negro / Gris)` y `Rosa (Rosado / Lila)`); opción rápida **`Mismos colores de la foto`** y campo libre de **Indicaciones adicionales**.
   - `packages/comercio/src/componentes/EditorPersonalizacionFloralProducto.tsx` integrado en Paso 2 (`Características`) de `ModalCrearProducto.tsx` y `ModalEditarProducto.tsx`, persistiendo `pro_detalle_producto.personalizacion_floral` en `crearProductoAction` y `editarProductoAction`.

3. **Experiencia de Compra en Tienda y Persistencia en Pedidos / Taller**
   - `TarjetaProductoConCarrusel.tsx`: indica que el arreglo se elabora en los colores de preferencia del cliente y, al pulsar **`Comprar`**, abre y enfoca directamente la sección de personalización floral.
   - `ModalDetalleProducto.tsx`: sección **`1. Personaliza tu Arreglo`** con selector rápido **`Mismos colores de la foto`** vs **`Elegir mis colores`**, combinación de flores, colores de rosas (`1..N`), stepper de orquídeas (`0..N`), **Color Base / Papel Decorativo** (`Claros`, `Oscuros`, `Rosa`) e **Indicaciones adicionales**, con validación clara antes de comprar o agregar al carrito.
   - Propagado de punta a punta en `contexto-carrito.tsx`, `DrawerCarritoFloristeria.tsx`, `ModalCheckoutTinkay.tsx`, `EspacioClienteEcommerceTinkay.tsx`, `acciones-logistica.ts`, `BandejaPedidosTienda.tsx` (`/panel/pedidos`) y `acciones-operaciones-taller.ts` (`/panel/taller`).

## Verificación
- `pnpm --filter @eco/comercio test`
- `pnpm typecheck`
- `pnpm --filter tinkay-web build`
- Comprobación de cero clases Tailwind en el diff.
