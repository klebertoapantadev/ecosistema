# ADR-0003: Catálogo comercial y facturación como módulo unificado de plataforma

**Fecha:** 2026-07-26
**Estado:** aceptada

## Contexto

Todos los negocios del ecosistema venden algo: Tinkay y Margaritas Floristería son e-commerce de producto físico, Tranqi vende un plan de protección jurídica (suscripción), FastFix vende servicios puntuales. Sin un módulo común, cada producto reimplementaría su propio catálogo — de hecho, minutos antes de este ADR ya había ocurrido: `margaritas/especificacion-tecnica.md` definía `mrg_producto_flor`, `mrg_pedido_flor` y `mrg_suscripcion_flor` como tablas propias de ese negocio, sin que existiera todavía ningún requerimiento común de catálogo. Ese diseño queda obsoleto por este ADR, antes de haberse migrado — el costo de corregirlo ahora es cero.

Requerimiento de origen: especificación funcional de catálogo redactada por el usuario (con apoyo de Gemini), que además exige distribución omnicanal (Meta Commerce Manager, catálogo de WhatsApp Business) y gestión de medios multiorigen.

## Decisión

1. **El catálogo de productos/servicios y su facturación son un módulo de plataforma**, no de cada negocio — esquema nuevo `comun_comercio`, prefijo de tabla `com_`. Documentado como `PLT-009` (catálogo) y `PLT-010` (integración omnicanal) en [`plataforma/especificacion-funcional.md`](../../productos/plataforma/especificacion-funcional.md).
2. **Ningún producto tiene su propia tabla de productos.** `margaritas_floristeria`, `tinkay_floristeria`, etc. no definen `producto_flor` ni equivalentes — consumen `comun_comercio.com_producto` / `com_variante`, filtrado por el negocio dueño.
3. **Se descarta la sincronización pasiva de álbumes de Google Photos con filtro por favorito ("estrella").** No es viable: desde el 31 de marzo de 2025, la Google Photos Library API removió los scopes `photoslibrary.readonly`/`sharing` — una app solo puede leer contenido que ella misma creó, no álbumes existentes del usuario ([anuncio oficial de Google](https://developers.googleblog.com/en/google-photos-picker-api-launch-and-library-api-updates/)). La gestión de medios queda en dos vías viables: carga de archivo local (Supabase Storage) y URL externa — ambas ya estaban en la especificación original y cubren el caso de uso sin depender de una API restringida.
4. **RLS con postura dual, explícita por tabla:** lectura pública para catálogo publicado (`com_producto`/`com_variante` con `activo = true`) porque es contenido de vitrina, pero escritura restringida al `ADMINISTRADOR`/`OPERADOR` del negocio dueño. Es una excepción deliberada a la postura "privado por defecto" del resto del ecosistema — se documenta aquí para que no se lea como una omisión de seguridad.

## Esquema de base de datos: `comun_comercio`

Esquema transversal. Sigue la fórmula de [`estandares/00-nomenclatura-base-datos.md`](../../estandares/00-nomenclatura-base-datos.md).

| Tabla | Prefijo col. | Propósito |
| :--- | :--- | :--- |
| `com_categoria` | `ctg_` | Grupo/categoría de navegación (ej. *Condolencias*, *Planes Anuales*). |
| `com_producto` | `pro_` | Producto/servicio master: concepto abstracto (descripción, categoría, negocio dueño). |
| `com_variante` | `var_` | SKU facturable: precio, impuestos, códigos SRI, tipo de oferta. Es lo que se factura y se vende. |
| `com_media` | `med_` | Imagen asociada a producto o variante (origen: `local` \| `url_externa`), con bandera de portada. |
| `com_personalizacion_campo` | `pzc_` | Definición de campos de captura por producto/variante (mensaje de dedicatoria, fecha de entrega, etc.). |
| `com_adicional` | `adc_` | Catálogo de adicionales/cross-sell (ej. chocolates, globos). |
| `com_variante_adicional` | `van_` | Unión variante ↔ adicionales sugeridos. |

```sql
create table comun_comercio.com_categoria (
  ctg_id uuid primary key default gen_random_uuid(),
  ctg_secuencial bigint generated always as identity,
  ctg_negocio text not null,              -- 'tinkay' | 'margaritas' | 'tranqi' | 'fastfix' -- mismo patron que comun_agentes.agc_producto (ADR-0002)
  ctg_nombre text not null,
  ctg_detalle_categoria jsonb not null default '{}'::jsonb,
  ctg_creado_en timestamptz not null default now(),
  ctg_actualizado_en timestamptz not null default now()
);

create table comun_comercio.com_producto (
  pro_id uuid primary key default gen_random_uuid(),
  pro_secuencial bigint generated always as identity,
  pro_negocio text not null,
  pro_categoria_id uuid references comun_comercio.com_categoria(ctg_id),
  pro_nombre text not null,
  pro_descripcion text,
  pro_activo boolean not null default true,
  pro_detalle_producto jsonb not null default '{}'::jsonb,
  pro_creado_en timestamptz not null default now(),
  pro_actualizado_en timestamptz not null default now()
);

create table comun_comercio.com_variante (
  var_id uuid primary key default gen_random_uuid(),
  var_secuencial bigint generated always as identity,
  var_producto_id uuid not null references comun_comercio.com_producto(pro_id),
  var_nombre text not null,                        -- ej. "Ramo grande / 24 tallos"
  var_tipo_oferta text not null,                    -- 'FISICO' | 'SERVICIO_PUNTUAL' | 'SUSCRIPCION' | 'DIGITAL'
  var_precio numeric(12,2) not null,
  var_precio_oferta numeric(12,2),
  var_codigo_principal text,                        -- codigo SRI principal
  var_codigo_auxiliar text,
  var_impuesto text not null default 'IVA_15',       -- 'IVA_15' | 'IVA_0'
  var_detalle_suscripcion jsonb,                     -- frecuencia, dias de prueba, reintentos -- solo si var_tipo_oferta = 'SUSCRIPCION'
  var_activo boolean not null default true,
  var_detalle_variante jsonb not null default '{}'::jsonb,
  var_creado_en timestamptz not null default now(),
  var_actualizado_en timestamptz not null default now()
);

create table comun_comercio.com_media (
  med_id uuid primary key default gen_random_uuid(),
  med_producto_id uuid references comun_comercio.com_producto(pro_id),
  med_variante_id uuid references comun_comercio.com_variante(var_id),
  med_origen text not null,                         -- 'local' | 'url_externa'  (Google Photos descartado, ver Decision #3)
  med_url text not null,
  med_es_portada boolean not null default false,
  med_creado_en timestamptz not null default now(),
  check (med_producto_id is not null or med_variante_id is not null)
);

alter table comun_comercio.com_categoria enable row level security;
alter table comun_comercio.com_producto enable row level security;
alter table comun_comercio.com_variante enable row level security;
alter table comun_comercio.com_media enable row level security;

-- Lectura publica de catalogo activo (vitrina) -- excepcion deliberada, ver Decision #4
create policy com_producto_lectura_publica on comun_comercio.com_producto
  for select using (pro_activo = true);

-- Escritura solo para ADMINISTRADOR/OPERADOR del negocio dueno (via seg_membresia)
-- Politica completa se escribe junto con la migracion real -- este es el esqueleto.
```

`com_personalizacion_campo`, `com_adicional` y `com_variante_adicional` se diseñan en detalle cuando se implemente PLT-009 — el esqueleto de arriba cubre lo que ya bloquea a Margaritas y Tinkay.

## Integración omnicanal (PLT-010) — resumen técnico

- **Feed para Meta Commerce Manager:** Route Handler (`GET /api/comercio/feed/{negocio}`) que genera el feed en el formato de [Meta Catalog Feed](https://developers.facebook.com/docs/commerce-platform/catalog) a partir de `com_producto`/`com_variante` activos de ese negocio. Meta lo consulta periódicamente — no requiere push.
- **Botón "Comprar por WhatsApp":** función pura en `packages/comercio` (nuevo paquete, mismo patrón que `packages/agentes-ia`) que arma la URL `wa.me` con los datos procesados de la variante + personalización elegida.
- **Endpoints para chatbot/ARIA:** consulta de solo lectura sobre catálogo activo, consumida por el buddie (PLT-004) para responder con tarjetas de producto — reutiliza `packages/agentes-ia`, no lo reemplaza.

## Alternativas evaluadas

| Alternativa | Por qué no se eligió |
| :--- | :--- |
| Cada negocio mantiene su propio catálogo (`mrg_producto_flor`, `tnk_producto`, etc.) | Duplica lógica de precios/impuestos/variantes en cada esquema; un fix o una integración con Meta tendría que reimplementarse N veces. Ya había empezado a pasar con Margaritas. |
| Plataforma de e-commerce de terceros (Shopify, WooCommerce) por negocio | No integra con `comun_facturacion` (SRI Ecuador) ni con el modelo multi-tenant/multi-rol ya construido; añade un sistema de identidad y pagos paralelo. |
| Sincronizar imágenes desde álbumes de Google Photos vía Library API | Técnicamente inviable desde marzo 2025 (ver Decisión #3) — se hubiera descubierto recién al implementar, no al especificar. |

## Consecuencias

- `margaritas/especificacion-tecnica.md` y `especificacion-funcional.md` se actualizan para referenciar `PLT-009`/`PLT-010` y `comun_comercio` en vez de tablas propias — ver commit de este mismo cambio.
- Cuando Tinkay defina sus requerimientos de negocio, consume el mismo esquema — no vuelve a diseñarse.
- La política de RLS "privado por defecto" del ecosistema tiene ahora una excepción documentada y acotada (lectura pública de catálogo activo), no una brecha silenciosa.
