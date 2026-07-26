# Ecosistema

Monorepo para las 6 aplicaciones de Tranqi, FastFix Home y Tinkay, sobre un stack común (Next.js + Capacitor + Supabase multi-esquema).

## Empezar aquí

1. [`gobernanza/manuales/habilitar-ambiente.md`](gobernanza/manuales/habilitar-ambiente.md) — cómo levantar el entorno de desarrollo.
2. [`CLAUDE.md`](CLAUDE.md) — reglas obligatorias para cualquier cambio, humano o agente.
3. [`gobernanza/arquitectura/marco-de-trabajo.md`](gobernanza/arquitectura/marco-de-trabajo.md) — cómo se construye cada producto.

## Estructura

| Carpeta | Contenido |
| :--- | :--- |
| `apps/` | Una carpeta por aplicación web o nativa |
| `packages/` | Código compartido entre aplicaciones |
| `supabase/` | Migraciones únicas, Edge Functions, seed |
| `gobernanza/` | Estándares, políticas, arquitectura, especificaciones por producto |

## Estado

Sprint 0 del Entregable 1 (Tranqi — identidad y registro de socios abogados). Ver [`gobernanza/productos/tranqi/`](gobernanza/productos/tranqi/).
