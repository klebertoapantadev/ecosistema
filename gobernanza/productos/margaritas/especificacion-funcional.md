---
tipo: esp_funcional
estado: borrador
version: 1.0
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Margaritas Floristería — Especificación Funcional

**Prefijo de tabla:** `mrg_` · **Esquema:** `margaritas_floristeria` · **Identificador de negocio:** `MRG`

---

## 1. Identidad, Registro y Autenticación

Ver especificación de [Plataforma](../plataforma/especificacion-funcional.md) — PLT-001, PLT-002, PLT-003.

- **Flujo de Registro Independiente (Cero Fricción):** El registro en Margaritas Floristería es 100% independiente del resto de aplicaciones. El registro inicial prioriza la fluidez inmediata (OAuth Google 1-clic o Correo/Nombre/Password).
- **Contacto WhatsApp Opcional:** No bloquea el registro inicial. Se ofrece de forma opcional post-registro.

---

## 2. Asistente Conversacional (ARIA)

Ver PLT-004. Agente de ARIA especializado para Margaritas Floristería (`margaritas`).

---

## 3. Módulos y Funcionalidades del Negocio

1. **Landing Page y E-commerce:**
   - Exposición dinámica de catálogos florales, arreglos por ocasión y ofertas especiales.
   - Portal Web PWA responsive (`apps/margaritas-web`) + App Nativa Clientes.
2. **Catálogo de Productos (`mrg_producto_flor`):**
   - Entidad con prefijo `pro_` (`pro_id`, `pro_nombre`, `pro_precio`, `pro_detalle_producto`).
3. **Pedidos y Compras (`mrg_pedido_flor`):**
   - Entidad con prefijo `ped_` (`ped_id`, `ped_monto_total`, `ped_estado`, `ped_detalle_pedido`).
4. **Suscripciones Florales (`mrg_suscripcion_flor`):**
   - Entidad con prefijo `sub_` (`sub_id`, `sub_frecuencia`, `sub_detalle_suscripcion`).
