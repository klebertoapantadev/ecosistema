---
tipo: esp_tecnica
estado: borrador
version: 0.2
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Margaritas Floristería — Especificación Técnica

**Prefijo de tabla:** `mrg_` · **Esquema:** `margaritas_floristeria` · **Modelo de entrega:** proyecto propio (sin escrow — ver [`estandares/02-git-y-despliegue.md`](../../estandares/02-git-y-despliegue.md) §8)

> Asunción a confirmar: se asume "proyecto propio" por default, igual que Tinkay y FastFix Home, ya que no se indicó lo contrario. Avisar si Margaritas requiere el workflow de escrow.

## Catálogo — sin tabla propia

**Corrección 2026-07-26 (ADR-0003):** `mrg_producto_flor` queda descartada. El catálogo (categoría/producto/variante/media/precio/impuesto) es un módulo de plataforma — `comun_comercio`, ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md). Margaritas consulta `comun_comercio.com_producto`/`com_variante` filtrado por `pro_negocio = 'margaritas'`. Ningún dato de producto se duplica en el esquema de este negocio.

## Tablas propias (fulfillment — sí es específico del negocio)

| Tabla | Prefijo col. | Implementa | Estado |
| :--- | :--- | :--- | :--- |
| `mrg_pedido_flor` | `ped_` | Pedido/entrega (dirección, fecha/hora, dedicatoria). `ped_variante_id` referencia `comun_comercio.com_variante`. | Diseñada en la especificación funcional, pendiente de migración |
| `mrg_suscripcion_flor` | `sub_` | Instancia de suscripción del cliente. `sub_variante_id` referencia `comun_comercio.com_variante` (la oferta/frecuencia vive en `var_detalle_suscripcion`, no aquí). | Diseñada en la especificación funcional, pendiente de migración |

## Dependencias de esquemas comunes

- `comun_seguridad.seg_usuario` / `seg_membresia` — identidad y rol (PLT-001/PLT-003).
- `comun_agentes` — agente ARIA propio de Margaritas (PLT-004), ver [ADR-0002](../../arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).
- `comun_comercio` — catálogo de productos y variantes (PLT-009/PLT-010), ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md).
- `comun_catalogo` — provincias/ciudades para direcciones de entrega (PLT-007 en la especificación de plataforma).
- `comun_facturacion` — pago de pedidos y suscripciones (PLT-006).

## Estado actual

Sin migraciones. Sin `apps/margaritas-web` de negocio todavía — existe únicamente una página de validación para probar el despliegue independiente en Vercel, sin funcionalidad real.
