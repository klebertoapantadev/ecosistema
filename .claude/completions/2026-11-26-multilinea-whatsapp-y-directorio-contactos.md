# Cierre de Tarea — Multi-Línea WhatsApp Coexistencia & Directorio Consolidado de Contactos (`PLT-010`)

**Fecha:** 2026-11-26  
**Requerimiento:** `PLT-010` (Plataforma Omnicanal — transversal a los 4 negocios: Tinkay, Margaritas, FastFix, Tranqi)  
**Rama:** `master` (Trunk-Based Development)

---

## Decisiones Funcionales Aplicadas

1. **Contactos Personales (`PERSONAL`):** Por defecto operan bajo **`IGNORAR_TOTAL`** (ni mensajes entrantes ni ecos móviles `whatsapp.smb.message.echoes` se guardan en la app; permanecen 100% privados en el celular). También quedan disponibles `OCULTO_ADMIN` y `SOLO_TITULAR` por línea o por contacto.
2. **Política Auto/Manual por Teléfono:** Cada línea WhatsApp (`agc_linea_whatsapp`) configura independientemente `lwa_ia_desconocidos_activa` (desconocidos) y `lwa_ia_clientes_activa` (clientes), con override individual por contacto (`SEGUN_LINEA` | `AUTO_IA` | `SIEMPRE_MANUAL`) y control bajo demanda en cada chat (`Pausar IA` / `Activar IA`).
3. **Alcance Fase 1 + Fase 2:** Multi-línea WhatsApp + blindaje de privacidad en 4 capas (RLS, RPCs, Realtime separado, Push/Campana) + herramienta de extracción multi-fuente (`.vcf`, `.csv`, `.xlsx`, Android Contact Picker API, pegado rápido y cruce CRM) con motor Join/Merge y widget `directorio_contactos` registrado en las 4 apps.

---

## Artefactos Creados y Modificados

- **Gobernanza:**
  - `gobernanza/productos/plataforma/especificacion-funcional.md` (`PLT-010` actualizado al 98% + Regla 9)
  - `gobernanza/productos/plataforma/arquitectura-omnicanal-reemplazo-manychat.md`
- **Base de Datos (Supabase):**
  - `supabase/migrations/20261126000009_omnicanal_multilinea_whatsapp_y_directorio_contactos.sql`
    - Tablas nuevas con RLS + `aud_fn_auditar_tabla()`: `comun_agentes.agc_linea_whatsapp` (`lwa_`), `comun_agentes.agc_contacto_directorio` (`cdo_`), `comun_agentes.agc_contacto_fuente` (`cfu_`).
    - Extensión aditiva de `comun_agentes.agc_conversacion` + blindaje RLS con `comun_agentes.agc_fn_puede_ver_conversacion`.
    - RPCs en `comun_comercio`: gestión multi-línea, directorio/importación por lotes, acción rápida `marcar_chat_privacidad`, webhook YCloud multi-línea con `IGNORAR_TOTAL` y anti-bucle interno, despachador YCloud multi-línea, tablero con `to_jsonb(sub)` y Web Push segmentado.
    - Registro y pre-configuración del widget `directorio_contactos` en `seg_widget` y `seg_rol_widget` para los 4 negocios.
- **Lógica Pura, Pruebas y Server Actions (`@eco/comercio`):**
  - `packages/comercio/src/contactos-omnicanal.ts` (normalización E.164, parsers `.vcf` QUOTED-PRINTABLE/multi-TEL, `.csv`/`.xlsx` Google Contacts `:::`, lista rápida, Contact Picker API, motor Join/Merge y clasificación fail-safe).
  - `packages/comercio/src/contactos-omnicanal.test.ts` (pruebas unitarias).
  - `packages/comercio/src/omnicanal.ts` y `packages/comercio/src/acciones-omnicanal.ts`.
- **UI Compartida y Registro en las 4 Apps:**
  - `packages/comercio/src/componentes/GestorLineasWhatsappPanel.tsx` (montado en `FormularioAria.tsx` y en `ConsolaDirectorioContactos.tsx`).
  - `packages/comercio/src/componentes/ConsolaDirectorioContactos.tsx` (asistente Join/Merge + `@eco/datagrid` + pestaña de teléfonos).
  - `packages/comercio/src/componentes/ConsolaVentasOmnicanal.tsx` (canal Realtime privado, filtro por teléfono y `🔒 Privados`, badges de línea y botones `Marcar Personal` / `Pasar a Ventas`).
  - Páginas `/panel/contactos/page.tsx` y registro completo de 10 puntos en `tinkay-web`, `margaritas-web`, `fastfix-web`, `tranqi-web`, `packages/configuracion-negocio` y `packages/gestion-usuarios`.

---

## Verificación Ejecutada

- **Supabase en vivo (`ecosistema` / `oaybbpdxhlxjbpwnoymy`):**
  - Migraciones aplicadas y verificadas (`rpcs_nuevos = 9`, `widgets_directorio = 4`, `rol_widgets_directorio = 20`, `lineas_whatsapp_seed = 1`).
  - `get_advisors (security)`: 0 alertas de RLS faltante, 0 `function_search_path_mutable` y 0 `security_definer_view` en las tablas y funciones nuevas.
- **Pruebas unitarias (`pnpm --filter @eco/comercio test`):** 20 archivos de prueba / 130 pruebas aprobadas (incluyendo `contactos-omnicanal.test.ts`).
- **Typecheck del monorepo (`pnpm typecheck`):** 15/15 paquetes y apps sin errores (`@eco/comercio`, `@eco/configuracion-negocio`, `tinkay-web`, `margaritas-web`, `fastfix-web`, `tranqi-web`, etc.).
- **Build de producción (`pnpm --filter tinkay-web build`):** Compilado exitosamente con ruta dinámica `/panel/contactos` y cero clases utilitarias de Tailwind.
