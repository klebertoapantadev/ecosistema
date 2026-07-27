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

**✅ Implementado (2026-07-27):** registro (Google OAuth + correo/contraseña) con consentimiento de términos, bienvenida, historial de accesos y baja de cuenta (PLT-012) — vía el paquete compartido `@eco/identidad` (ver [`especificacion-tecnica.md` de Plataforma](../plataforma/especificacion-tecnica.md) §1). Configuración del negocio y gestión de usuarios todavía no — solo existen en `tranqi-web` por ahora.

---

## 2. Asistente Conversacional (ARIA)

Ver PLT-004. Agente de ARIA especializado para Margaritas Floristería (`margaritas`).

---

## 3. Módulos y Funcionalidades del Negocio

1. **Landing Page y E-commerce:**
   - Exposición dinámica de catálogos florales, arreglos por ocasión y ofertas especiales.
   - Portal Web PWA responsive (`apps/margaritas-web`) + App Nativa Clientes.
2. **Catálogo de Productos — Ver PLT-009 y PLT-010 (Plataforma).**
   - **Corrección 2026-07-26:** Margaritas **no tiene tabla propia de producto.** El catálogo (categoría → producto → variante) es un módulo de plataforma (`comun_comercio`), compartido con Tinkay y cualquier negocio que venda algo — ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md). Lo que aquí era `mrg_producto_flor` se resuelve consultando `comun_comercio.com_producto`/`com_variante` filtrado por `pro_negocio = 'margaritas'`.
3. **Pedidos (`mrg_pedido_flor`):**
   - Entidad propia de Margaritas — el **pedido/entrega** sí es específico del negocio (dirección de entrega, fecha/hora, dedicatoria), a diferencia del catálogo. Prefijo `ped_` (`ped_id`, `ped_variante_id` → FK a `comun_comercio.com_variante`, `ped_monto_total`, `ped_estado`, `ped_detalle_pedido` — este último guarda dedicatoria, fecha/hora de entrega y adicionales elegidos).
4. **Suscripciones Florales (`mrg_suscripcion_flor`):**
   - Instancia de suscripción del cliente (no la oferta — la oferta y su configuración de frecuencia viven en `com_variante.var_detalle_suscripcion`). Prefijo `sub_` (`sub_id`, `sub_variante_id` → FK a `comun_comercio.com_variante`, `sub_cliente_id`, `sub_proxima_fecha_cobro`, `sub_detalle_suscripcion`).
