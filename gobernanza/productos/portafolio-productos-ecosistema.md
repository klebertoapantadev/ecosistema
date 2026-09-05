# Índice Maestro de Portafolios Comerciales del Ecosistema

**Fecha:** 2026-09-05  
**Estado:** Activo  
**Propósito:** Punto de entrada consolidado que conecta y referencia los portafolios comerciales independientes de cada unidad de negocio del ecosistema.

---

## 1. Principio de Independencia de Negocio

El ecosistema opera bajo una arquitectura de **Composable Commerce Multi-Tenant**:
* **Técnicamente Coexistentes:** Todos los negocios comparten el esquema transversal `comun_comercio` en una única base de datos Supabase, reutilizando el motor de recetas (BOM), el generador de proformas (CPQ), el inventario/kardex y la facturación del SRI.
* **Operacionalmente Independientes:** Cada negocio tiene su propio catálogo, sus propias categorías, sus propias variantes, sus propios precios y márgenes, administrados de forma totalmente aislada mediante la columna `*_negocio` y políticas de seguridad RLS.

---

## 2. Portafolios Independientes por Unidad de Negocio

Para revisar, ajustar y definir los productos, recetas, supuestos de precios y reglas comerciales específicas de cada negocio, consulta su documento dedicado:

| Negocio | Modelo Comercial | Enlace al Catálogo Detallado |
| :--- | :--- | :--- |
| **Tinkay Floristería** | E-Commerce floral, bouquets coreanos, detalles cross-sell y suscripciones B2C. | 📄 [catalogo-productos.md (Tinkay)](file:///c:/@Antigravity/ecosistema/gobernanza/productos/tinkay/catalogo-productos.md) |
| **Margaritas Floristería** | Arreglos fúnebres solemnes, condolencias, coronas y suscripciones corporativas. | 📄 [catalogo-productos.md (Margaritas)](file:///c:/@Antigravity/ecosistema/gobernanza/productos/margaritas/catalogo-productos.md) |
| **Tranqi Legaltech** | Trámites jurídicos a precio fijo, planes de protección B2C, corporativos B2B y litigios. | 📄 [catalogo-productos.md (Tranqi)](file:///c:/@Antigravity/ecosistema/gobernanza/productos/tranqi/catalogo-productos.md) |
| **FastFix Home** | Mantenimientos tarifa plana, jornadas de limpieza por día/hora y proformas CPQ compuestas. | 📄 [catalogo-productos.md (FastFix)](file:///c:/@Antigravity/ecosistema/gobernanza/productos/fastfix/catalogo-productos.md) |

---

## 3. Matriz de Arquitectura Común

Para comprender la estructura de tablas (`com_producto`, `com_variante`, `com_receta`, `com_inventario`, `com_proforma`, `com_suscripcion`), consulta:
* 🏛️ **[ADR-0003: Catálogo Comercial Unificado, Recetas (BOM), Proformas (CPQ), Inventarios y Suscripciones](file:///c:/@Antigravity/ecosistema/gobernanza/arquitectura/adr/0003-catalogo-comercial-unificado.md)**
* 📖 **[Glosario Maestro de Términos y Siglas Técnicas](file:///c:/@Antigravity/ecosistema/gobernanza/manuales/glosario-de-terminos.md)**
