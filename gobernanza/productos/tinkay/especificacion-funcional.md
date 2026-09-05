---
tipo: esp_funcional
estado: vigente
version: 1.0
fecha: 2026-09-05
responsable: Kleber Toapanta
---

# Tinkay — Especificación Funcional

**Prefijo de tabla:** `tnk_` · **Esquema:** `tinkay_floristeria`  
**Consumo transversal:** `comun_comercio`, `comun_agentes`, `comun_seguridad`, `comun_auditoria`  

**Sistema visual:** [`sistema-visual.md`](sistema-visual.md) — paleta consolidada desde materiales de marca reales (rosa `#EC7FA7` + verde botánico `#3D5A45` + dorado acento `#B8923F`), reglas de color y caso especial de condolencias. Aplica a `apps/tinkay-web`.

---

## Matriz de Responsables, Estado y Avance (%) de Tinkay

| Código | Funcionalidad / Requerimiento | Estado | Avance (%) | Responsable Asignado |
| :--- | :--- | :---: | :---: | :--- |
| **`TNK-001`** | **Catálogo y Portafolio Multidimensional de Arreglos** | 🟡 En Desarrollo | **80%** | Kleber Toapanta |
| **`TNK-002`** | **E-Commerce Web, Carrito y Pasarela Payphone** | 🟡 En Desarrollo | **50%** | Kleber Toapanta |
| **`TNK-003`** | **Vendedoras, Enlaces Ref y Comisiones Netas** | 🟡 En Desarrollo | **60%** | Kleber Toapanta |
| **`TNK-004`** | **Agente ARIA WhatsApp (YCloud) y Consola Humana (HITL)** | 🟡 En Desarrollo | **45%** | Kleber Toapanta |
| **`TNK-005`** | **Taller de Armado Floral, Hoja de Ruta y Despacho Delivery** | ⏳ Pendiente | **0%** | Kleber Toapanta |

---

## Identidad y Plataforma Común

Tinkay se apoya plenamente en la arquitectura de Plataforma común:
- **`PLT-001` / `PLT-002` / `PLT-003` (Identidad y Sesiones):** Registro con Google OAuth / correo, historial de accesos, baja de cuenta (`@eco/identidad`).
- **`PLT-008` (Configuración de Negocio):** Redes sociales de Tinkay, teléfonos, políticas de entrega y credenciales SMTP.
- **`PLT-009` (Catálogo Unificado):** Tinkay consume `comun_comercio`. No posee tabla de producto aislada; sus productos se identifican con `pro_negocio = 'tinkay'`.
- **`PLT-010` (Integración Omnicanal):** Conexión con WhatsApp Business (YCloud), feeds de catálogo y consola de supervisión humana.
- **`PLT-011` (Widgets Administrativos):** Todas las consolas de vendedoras, taller y administración se construyen como widgets autocontenidos.

---

## Requerimientos Específicos de Negocio

### TNK-001 — Catálogo y Portafolio Multidimensional de Arreglos Florales
- **Definición completa:** [`catalogo-productos.md`](catalogo-productos.md).
- **Taxonomía N:M:** Un mismo arreglo pertenece simultáneamente a múltiples categorías (`com_producto_categoria`) según Formato (`CAT_FLOREROS`, `CAT_COREANOS`, `CAT_ABANICOS`) y Ocasión (`CAT_OCAS_AMOR`, `CAT_OCAS_ANIV`, `CAT_OCAS_CUMPLE`, `CAT_OCAS_CONDOL`, `CAT_EVENTOS`).
- **Álbumes Públicos de Google Photos:** Cada producto y categoría enlaza a su álbum de fotos reales del taller en alta resolución para inspección inmediata del cliente.
- **Manejo Monetario:** Precios almacenados en centavos enteros (`05-manejo-monetario-y-valores.md`) y convertidos mediante `@eco/primitivas`.

### TNK-002 — E-Commerce Web, Carrito y Pasarela Payphone
- **Vitrina Web:** `apps/tinkay-web` con diseño editorial botánico según [`sistema-visual.md`](sistema-visual.md).
- **Cajita de Pagos Payphone:** Integración cliente-servidor para cobro en línea con tarjeta de crédito/débito nacional e internacional (comisión 6% calculada según [`catalogo-productos.md`](catalogo-productos.md) §6.A).
- **Parámetros de Entrega:** Selección de dedicatoria impresa, fecha y franja horaria (Mañana / Tarde / Horario Exacto +$10.00).

### TNK-003 — Gestión de Vendedoras y Liquidación Automatizada de Comisiones
- **Enlaces con Atribución:** Cada asesora cuenta con enlaces y QR únicos (`tinkay.com/chat?asesora=paola`) para atribución de la conversación y venta.
- **Fórmula de Base Comisionable Neta:** La comisión se calcula sobre la utilidad bruta operativa deduciendo descuentos, delivery real, montajes, fees de plataforma y la comisión de pasarela (Payphone).
- **Widget de Liquidación:** Reporte quincenal en el panel administrativo para pago ágil a las vendedoras sin hojas de cálculo manuales.

### TNK-004 — Agente ARIA WhatsApp (YCloud) y Consola de Supervisión Humana (*Human-in-the-Loop*)
- **Definición completa:** [`agente-aria-whatsapp-ycloud.md`](agente-aria-whatsapp-ycloud.md).
- **Sustitución de ManyChat:** Transición integral hacia **YCloud** (WhatsApp Cloud API) orquestado por el agente conversacional **ARIA** (`packages/agentes-ia`).
- **Agente "Mía":** Asesora floral botánica con prompt especializado, tono refinado, manejo solemne de condolencias y búsqueda de catálogo vía MCP tool `consultar_catalogo_tinkay`.
- **Almacenamiento de Chats:** Persistencia en `comun_agentes.agc_conversacion` y `comun_agentes.agc_mensaje` con Supabase Realtime para la consola de monitoreo.
- **Consola de Supervisión Humana (HITL):** Widget donde las vendedoras monitorean los chats en vivo, conmutan a modo manual con el botón **[ Tomar Control ]** (silenciando a ARIA) y pueden **[ Reactivar Bot ]** tras resolver la consulta puntual.

### TNK-005 — Taller de Armado Floral, Hoja de Ruta y Despacho Delivery
- **Pantalla de Taller:** Al confirmarse el pago (vía Payphone o transferencia validada), el pedido ingresa a la cola de armado del taller floral con su receta botánica (BOM) y dedicatoria.
- **Directorio de Delivery:** Asignación de repartidor según zona de Quito / Valles.
- **Proof of Delivery (POD):** Registro obligatorio de fotografía de entrega al destinatario para cierre de orden y notificación al comprador.
