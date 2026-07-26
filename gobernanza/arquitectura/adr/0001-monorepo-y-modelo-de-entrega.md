# ADR-0001: Monorepo único y modelo de entrega por producto

**Fecha:** 2026-07-25
**Estado:** aceptada

## Contexto

El ecosistema son 6 aplicaciones (3 portales web + 3 apps nativas) sobre 3 negocios que comparten una única instancia Supabase multi-esquema. Había que decidir si cada producto vive en un repositorio independiente (como sugería el TRD original) o en un monorepo, y qué implica cada modelo para la entrega de código a un cliente.

## Decisión

1. **Monorepo único** (`ecosistema`, Turborepo + pnpm) para las 6 aplicaciones y los paquetes compartidos, con un único historial de migraciones en `supabase/migrations/`.
2. **Modelo de entrega por producto:**
   - **Tranqi:** entrega documental / escrow. El código se entrega en custodia contractual, sin expectativa de que el cliente lo opere de forma independiente (no sería posible sin la instancia Supabase compartida).
   - **Tinkay y FastFix Home:** proyectos propios, gestionados y administrados directamente. Sin restricción de escrow.

## Alternativas evaluadas

| Alternativa | Por qué no se eligió |
| :--- | :--- |
| Repos independientes por producto (`tranqi-web`, `fastfix-web`, `tinkay-web`) | Con una base de datos compartida, produce migraciones divergentes y deriva silenciosa del esquema. Ningún repo es dueño real del estado de la base. |
| Instancia Supabase independiente por producto | Elimina el problema de migraciones compartidas, pero rompe la premisa de `comun_seguridad`/`comun_facturacion`/`comun_auditoria` como esquemas transversales, y multiplica costo operativo por 3 (o N). |

## Consecuencias

- Todo cambio a un esquema `comun_*` requiere revisión de CODEOWNERS por su impacto en los 3 productos.
- La entrega de Tranqi requiere un workflow de exportación (`exportar-escrow.yml`) que extrae la app y vendoriza sus dependencias — se construye antes del primer hito contractual de entrega, no en el Sprint 0.
- Si en el futuro un cliente exige poder operar el producto de forma completamente independiente (escenario "entrega operativa"), este ADR queda obsoleto para ese producto y debe reemplazarse: la arquitectura multi-esquema no es compatible con ese modelo comercial.
