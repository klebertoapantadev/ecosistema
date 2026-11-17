# Cierre de Tarea — Wizard de Creación / Edición de Productos y Configuración Limpia de Descripción y Beneficios

**Fecha:** 2026-11-17  
**Requerimientos:** `TNK-001` / `PLT-009`

## Resumen de Cambios
1. **Eliminación de valores por defecto forzados al crear un producto (`ModalCrearProducto.tsx` y `acciones.ts`):**
   - `descripcion`, `beneficiosTexto` y `requisitosTexto` ahora se inicializan vacíos (`""`) y se reinician al abrir el modal, evitando que productos de renta o eventos se creen con viñetas de rosas por defecto.
   - `crearProductoAction` soporta `fotoPosicion`, `fotoAjuste`, `fotoZoom`, `tarifa_iva_predeterminada` y `logistica` desde la creación inicial sin inyectar beneficios predeterminados.
2. **Asistente (Wizard) de 5 Pasos Relacionados (`BarraPasosWizardProducto.tsx`, `ModalCrearProducto.tsx`, `ModalEditarProducto.tsx`):**
   - **Paso 1 (`Nombre y Precio`):** Nombre, Categoría (`+ Nueva` / `Gestionar`), Tipo de Oferta Comercial (`+ Nueva` / `Gestionar` + condiciones de Renta), Precio Base, Oferta/Comparación, SKU, Stock, Tarifa IVA SRI (`0%` / `15%`), Escalas por volumen y Constructor de Set/Combo.
   - **Paso 2 (`Características`):** Descripción Detallada, Beneficios / ¿Qué incluye? (una viñeta por línea, vista previa en vivo, sugerencias opcionales en 1 clic `+ Sugerir Flores` / `+ Sugerir Renta / Evento` y botón `Limpiar`), Promesa de Entrega y Requisitos del Cliente.
   - **Paso 3 (`Imágenes y Galería`):** Subida desde PC, selección de Galería del negocio, Portada `★`, Encuadre Cuadrado `1:1` (`SelectorEncuadreFoto`), Álbum Google Photos y Video/GIF.
   - **Paso 4 (`Logística y Vigencia`):** Estado Activo/Destacado, Vigencia estacional y Modalidad de Entrega/Transporte.
   - **Paso 5 (`Canales y Búsqueda`):** Canales de visibilidad, Usos/Ocasiones recomendadas y Etiquetas `#tags`.
   - Navegación `Anterior` / `Siguiente` en el pie del modal y conmutador opcional `Ver Todo` / `Modo Pasos` en edición.
