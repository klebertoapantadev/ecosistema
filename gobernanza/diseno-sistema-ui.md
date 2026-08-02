# Guía de Estilos UI, Componentes y Coexistencia Visual (Ecosistema Web Apps 2026)

## 1. Principios de Diseño Visual & Estética Integrada

Para mantener una experiencia visual cohesionada, estéticamente impactante y profesional a través de las 4 aplicaciones del ecosistema (**Tranqi**, **FastFix Home**, **Tinkay Floristería**, **Margaritas Floristería**), todo nuevo widget, vista o componente debe respetar estrictamente los siguientes patrones de UI/UX:

### 🎨 Paleta de Colores y Tokens Temáticos
* **Fondo Base del Panel:** `#0d1117` (Oscuro profundo) o `#0b0f19` seguidos de contenedores `#161b22`.
* **Bordes & Separadores:** `#30363d` (Borde sutil neutro de baja opacidad).
* **Texto Principal:** `#c9d1d9` (Blanco suave para alto contraste legible).
* **Texto Secundario / Meta:** `#8b949e` (Gris medio para etiquetas, fechas y subtítulos).
* **Acentos de Negocio:**
  * **Tranqi (Legal):** `#1f6feb` (Azul primario), `#388bfd` (Azul interactivo), `#05594a` (Verde esmeralda de marca).
  * **FastFix Home:** `#d97706` (Naranja industrial / ámbar), `#f59e0b`.
  * **Tinkay Floristería:** `#059669` (Verde botánico), `#10b981`.
  * **Margaritas Floristería:** `#db2777` (Rosa magenta / floral), `#ec4899`.

---

## 2. Convenciones de Clases CSS y Estructura de Contenedores

Todo widget o página debe montarse utilizando la jerarquía estándar de layout:

### Layout Contenedor
```tsx
<div className="contenedor-panel">
  {/* Header de la página / Barra Superior */}
  <div className="barra-superior-panel">...</div>
  
  {/* Rejilla Principal */}
  <div className="rejilla-cliente">
    <div className="columna-cliente">...</div>
    <aside className="columna-cliente">...</aside>
  </div>
</div>
```

### Tarjetas y Secciones (`.tarjeta-seccion`)
Las seccionadoras o widgets dentro de los paneles deben emplear la clase `.tarjeta-seccion` con bordes redondeados (`border-radius: 12px`), cabecera estructurada y estado vacío (`.vacio-seccion`):

```tsx
<section className="tarjeta-seccion" aria-labelledby="titulo-id">
  <header>
    <h2 id="titulo-id">Título del Módulo</h2>
  </header>
  <div className="contenido-seccion">
    {/* Contenido del widget */}
  </div>
</section>
```

---

## 3. Botones y Elementos Interactivos

* **Botones Primarios:**
  * Usar la clase `btn-primario` o estilar con `background: #1f6feb`, `color: #ffffff`, `border-radius: 6px`, `padding: 6px 14px`, `font-weight: 600`.
* **Botones Secundarios:**
  * Usar `background: #21262d`, `border: 1px solid #30363d`, `color: #c9d1d9`.
* **Badges y Chips de Estado:**
  * `.chip-registrado` / `.badge-rol`: Etiquetas redondeadas de estado activo.
  * `.chip-proximamente` / `.pildora-estado.pendiente`: Tonalidades ámbar o neutras.

---

## 4. Control de Acceso y Vistas Restringidas (RBAC UI)

Cuando un perfil carece de privilegios para una acción o consola (ej. usuario con rol exclusivo de `CLIENTE` intentando acceder a la Consola de Emisión de Notificaciones):

1. **Ocultamiento Proactivo de Controles:** En la UI compartida, los botones o accesos administrativos (como la Consola de Emisión) **no se renderizan** para usuarios sin el rol de `ADMINISTRADOR` o `SUPERADMIN`.
2. **Pantalla de Acceso Restringido en Servidor:** Si el usuario navega a la URL directa de la consola protegida, el servidor debe interceptar y presentar una tarjeta limpia `.tarjeta-seccion` con borde rojo de advertencia (`border-left: 4px solid #ef4444`), mensaje claro sobre su rol actual (`CLIENTE`), y botones para retornar a su panel o notificaciones recibidas.

---

## 5. Regla de Coexistencia para Nuevos Componentes (Widgets)

* **No usar colores planos estridentes ni tipografías fuera de la jerarquía.**
* **Utilizar Lucide React (`lucide-react`) con grosor uniforme (`strokeWidth={1.6}` a `2`).**
* **Asegurar responsividad total:** Los widgets deben colapsar limpiamente en dispositivos móviles utilizando `flex-wrap: wrap` o rejillas de 1 sola columna.
