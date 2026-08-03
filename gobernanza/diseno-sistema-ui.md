# Directivas de Sistema Visual UI & Adaptación de Colores por Rol (Ecosistema 2026)

Este documento establece las reglas obligatorias de diseño visual, paletas de color por rol y componentes contenedores para **todas las pantallas y widgets del panel** en los 4 negocios del ecosistema (**Tranqi**, **FastFix Home**, **Tinkay**, **Margaritas**).

---

## 1. Reglas Generales de Estilo Visual (Clean Light Dashboard)

Todas las pantallas internas del panel (Inicio, Mi Cuenta, Auditoría, Servidor de Correo, Configuración del Negocio, Gestión de Usuarios, Socios, Preferencias) DEBEN obedecer el mismo sistema visual sobrio y profesional:

1. **Fondo de Pantalla (`var(--panel-papel)`):**
   - Papel neutro súper claro (`#F7F6FA` en Cliente, `#F6F6F5` en Administración/Abogado).
   - Queda estrictamente PROHIBIDO usar contenedores oscuros tipo `#0d1117` o `#161b22` dentro de los paneles.

2. **Tarjetas & Contenedores (`.tarjeta-seccion`, `.tarjeta-acceso`, `.tarjeta-panel`):**
   - Fondo: Blanco puro (`var(--blanco, #FFFFFF)`).
   - Borde: 1px sólido gris neutro (`var(--panel-linea, #E4E4E4)`).
   - Bordes redondeados: `16px` (`border-radius: 16px`).
   - Sombra suave: Elevation minima `0 1px 3px rgba(0,0,0,0.04)`.

3. **Tipografía & Contraste:**
   - Títulos y textos principales: Negro neutro alto (`var(--negro, #111111)` / `font-weight: 700` a `800`).
   - Descripciones y etiquetas secundarias: Gris neutro (`var(--panel-gris, #737373)`).
   - Botones primarios: `.btn-mini` o `.btn-primario` (rectangulares redondeados `8px`, no píldoras de landing).

---

## 2. Matriz de Adaptación Dinámica de Colores por Rol (`clasePerfil Visual`)

El contenedor principal `.panel-layout` inyecta dinámicamente la clase correspondiente según el rol del usuario autenticado o la vista seleccionada en el selector de roles ("Ver como"):

| Rol / Perfil | Clase CSS | Superficie Sidebar | Color de Acento Principal | Cinta / Ribbon Textura |
| :--- | :--- | :--- | :--- | :--- |
| **`Cliente`** | `.perfil-cliente` | Violeta Oscuro (`#33007A`) | **Violeta Marca (`#5000BA`)** | Menta (`#B1FBE3`) |
| **`Socio Abogado`** | `.perfil-abogado` | Esmeralda Tinta (`#052A23`) | **Esmeralda (`#05876E`)** | Lima (`#D8FFB3`) |
| **`Administrador`** | `.perfil-admin` | Negro (`#111111`) | **Lavanda (`#7866FF`)** | Lavanda (`#7866FF`) |

---

## 3. Guía de Implementación para Nuevas Vistas y Widgets

Cualquier nuevo widget o panel que se desarrolle en el ecosistema debe seguir este estándar:

```tsx
// Estructura Estándar de Sección / Widget
<section className="tarjeta-seccion">
  <header>
    <h2>Título del Widget</h2>
    <span className="pildora-estado">Estado</span>
  </header>
  <div style={{ padding: "20px" }}>
    {/* Contenido con .form-panel, .tabla-panel o rejillas .accesos-cliente */}
  </div>
</section>
```

---

## 4. Verificación de Cumplimiento

* ✅ **Mi Cuenta (`/panel/cuenta`):** Adaptado al 100% con tarjetas blancas, bordes neutros y colores adaptativos por rol.
* ✅ **Inicio (`/panel`):** Pantalla base del sistema visual.
* ✅ **Gobernanza:** Integrado a las directivas de linter y convenciones visuales del proyecto.
