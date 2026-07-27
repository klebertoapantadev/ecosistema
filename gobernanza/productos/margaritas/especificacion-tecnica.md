---
tipo: esp_tecnica
estado: borrador
version: 0.1
fecha: 2026-07-26
responsable: Kleber Toapanta
---

# Margaritas Floristería — Especificación Técnica

**Prefijo de tabla:** `mrg_` · **Esquema:** `margaritas_floristeria` · **Modelo de entrega:** proyecto propio (sin escrow — ver [`estandares/02-git-y-despliegue.md`](../../estandares/02-git-y-despliegue.md) §8)

> Asunción a confirmar: se asume "proyecto propio" por default, igual que Tinkay y FastFix Home, ya que no se indicó lo contrario. Avisar si Margaritas requiere el workflow de escrow.

## Tablas (según [`especificacion-funcional.md`](especificacion-funcional.md) §3)

| Tabla | Prefijo col. | Implementa | Estado |
| :--- | :--- | :--- | :--- |
| `mrg_producto_flor` | `pro_` | Catálogo de productos | Diseñada en la especificación funcional, pendiente de migración |
| `mrg_pedido_flor` | `ped_` | Pedidos y compras | Diseñada en la especificación funcional, pendiente de migración |
| `mrg_suscripcion_flor` | `sub_` | Suscripciones florales | Diseñada en la especificación funcional, pendiente de migración |

## Dependencias de esquemas comunes

- `comun_seguridad.seg_usuario` / `seg_membresia` — identidad y rol (PLT-001/PLT-003).
- `comun_agentes` — agente ARIA propio de Margaritas (PLT-004), ver [ADR-0002](../../arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md).
- `comun_catalogo` — provincias/ciudades para direcciones de entrega (PLT-008 en la especificación de plataforma).
- `comun_facturacion` — pago de pedidos y suscripciones (PLT-006).

## Estado actual

Sin migraciones. Sin `apps/margaritas-web` de negocio todavía — existe únicamente una página de validación para probar el despliegue independiente en Vercel, sin funcionalidad real.
