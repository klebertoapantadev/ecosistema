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

## Matriz de Responsables, Estado y Avance (%) de Margaritas Floristería

| Código | Funcionalidad / Requerimiento | Estado | Avance (%) | Responsable Asignado |
| :--- | :--- | :---: | :---: | :--- |
| **`MRG-001`** | **Identidad, Registro sin Fricción y Mi Cuenta (`@eco/identidad`)** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`MRG-002`** | **Catálogo Comercial Unificado y Vitrina E-Commerce (`comun_comercio`)** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`MRG-003`** | **Gestión de Pedidos, Clasificación en 4 Tipos (`Floristería / Ocasiones`, `Condolencias`, `Eventos`, `Exequiales`), Hora de Entrega (Rango u Hora Exacta) y Taller (`@eco/comercio`)** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`MRG-004`** | **Suscripciones Florales Recurrentes (`mrg_suscripcion_flor`)** | ⏳ Pendiente | **0%** | Kleber Toapanta |

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
3. **Pedidos, Despacho a Taller y Reglas por Tipo de Pedido (`comun_comercio.com_proforma` + `com_orden_taller` + `@eco/comercio`):**
   - Comparte con Tinkay las consolas operativas `/panel/pedidos` (`BandejaPedidosTienda`), `/panel/envio-pedidos` (`ConsolaEnvioPedidosTaller`), `/panel/taller` (`ConsolaTallerFloral`) y `/panel/entregas` (`ConsolaConfirmacionEntregas`) aisladas por `negocio = 'margaritas'`.
   - **Distinción en 4 Tipos de Pedido (`20261118000009`):**
     1. **`Floristería / Ocasiones` (`FLORISTERIA_OCASIONES`):** Arreglos para regalo y ocasiones especiales (entrega a domicilio o retiro en tienda), con comprador, teléfono/WhatsApp, destinatario, dirección/mapa y tarjeta dedicatoria.
     2. **`Condolencias` (`CONDOLENCIAS`):** Coronas, pedestales y arreglos fúnebres particulares que incluyen comprador, teléfono/WhatsApp, destinatario/difunto, dirección de entrega (funeraria/capilla) y tarjeta de condolencias.
     3. **`Eventos` (`EVENTOS`):** Ceremonias, decoración floral, proformas de eventos y renta de mobiliario.
     4. **`Exequiales` (`EXEQUIALES`):** Órdenes de convenio Exequiales coordinadas por Sala (`Sala 1`..`4` / `Capilla / Oficina`), donde **el destinatario es la Persona Fallecida y es obligatorio**, y **no se requiere Teléfono/WhatsApp, ni Tarjeta de Condolencias, ni Dirección callejera / Retiro en Tienda / Mapa**.
   - **Hora de Entrega en todos los casos:** Todo pedido permite seleccionar un **Rango Horario** (`A) 09:00 - 13:00`, `B) 13:00 - 17:00`, `C) 17:00 - 20:00`) o especificar la **Hora Exacta (`HH:MM`)** cuando aplique.
4. **Suscripciones Florales (`mrg_suscripcion_flor`):**
   - Instancia de suscripción del cliente (no la oferta — la oferta y su configuración de frecuencia viven en `com_variante.var_detalle_suscripcion`). Prefijo `sub_` (`sub_id`, `sub_variante_id` → FK a `comun_comercio.com_variante`, `sub_cliente_id`, `sub_proxima_fecha_cobro`, `sub_detalle_suscripcion`).
