---
tipo: esp_funcional
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Tinkay — Especificación Funcional

**Prefijo de tabla:** `tnk_` · **Esquema:** `tinkay_floristeria`

## Identidad y autenticación

Ver especificación de [Plataforma](../plataforma/especificacion-funcional.md) — PLT-001, PLT-002, PLT-003. Sin adiciones específicas de Tinkay todavía.

## Chat conversacional

Ver PLT-004. Agente de ARIA para Tinkay: pendiente de asignar.

## Catálogo de productos

Ver PLT-009 y PLT-010 (Plataforma) — [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md). Tinkay consume `comun_comercio`, igual que Margaritas Floristería. **No crear una tabla de producto propia** cuando se definan los requerimientos de negocio.

## Requerimientos de negocio

Sin requerimientos formalizados aún. Siguiente producto después del Entregable 1 de Tranqi — valida la arquitectura completa de punta a punta (catálogo, carrito, pagos, SRI, CMS) con el menor riesgo relativo, según [`Marco_Trabajo_Multi_Producto.md`](../../../../Marco_Trabajo_Multi_Producto.md) §9.

Por ahora existe únicamente una página de validación (`apps/tinkay-web`) para probar que el monorepo despliega múltiples apps de forma independiente — no representa funcionalidad de negocio real todavía.
