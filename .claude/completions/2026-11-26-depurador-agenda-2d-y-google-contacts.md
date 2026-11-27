# Cierre de Tarea — Depurador 2D de Agenda & Sincronización Google Contacts (`PLT-010` Fase 3)

**Fecha:** 2026-11-26  
**Requerimiento:** `PLT-010` Regla 10 (100%)  
**Rama:** `master` (Trunk-Based Development)

---

## Implementación Realizada

- **Gobernanza:** `gobernanza/productos/plataforma/especificacion-funcional.md` (`PLT-010` → `✅ Implementado 100%` + Regla 10).
- **Base de Datos (`oaybbpdxhlxjbpwnoymy`):**
  - `supabase/migrations/20261126000010_omnicanal_google_contacts_oauth_y_depurador.sql` (aplicada en vivo).
  - Tabla `comun_agentes.agc_google_contacts_conexion` (`gcn_`) con RLS estricto y `aud_fn_auditar_tabla()`.
  - 7 RPCs en `comun_comercio` con almacenamiento cifrado de `client_secret` y `refresh_token` en Supabase Vault (`cfg_fn_upsert_vault_secreto`).
- **Motor Puro 2D & Exportadores (`@eco/comercio`):**
  - `packages/comercio/src/depurador-agenda.ts` + `packages/comercio/src/depurador-agenda.test.ts` (fusión Union-Find por teléfono + persona, estandarización E.164 legible/compacta + EC pre-2012, limpieza de caracteres invisibles preservando emojis ZWJ, separar fusiones, exportadores CSV Google Contacts, vCard 3.0 UTF-8 y Excel de auditoría 2 hojas).
- **Google People API OAuth 2.0 + Server Actions + Rutas en las 4 apps:**
  - `packages/comercio/src/google-contacts-servidor.ts` y `packages/comercio/src/acciones-google-contacts.ts`.
  - Rutas `/api/omnicanal/google-contacts/conectar` y `/callback` en `tinkay-web`, `margaritas-web`, `fastfix-web` y `tranqi-web`.
- **UI Compartida:**
  - `packages/comercio/src/componentes/DepuradorAgendaGooglePanel.tsx` montado en la pestaña **`Depurador & Google`** de `ConsolaDirectorioContactos.tsx` (sin Tailwind, responsive móvil, modo claro/oscuro, backup `.vcf` automático obligatorio antes de escribir en Google).

## Verificación
- **Prueba sobre `contacts_kleber_todos.vcf` real:** `2,510 → 2,252` fichas (`148` duplicados unidos: `108` por teléfono + `30` por persona, `1,527` teléfonos estandarizados, `13` EC pre-2012 corregidos, `11` `CS` excluidos, `.vcf` 331 KB + CSV Google 254 KB).
- **Pruebas unitarias:** `22/22` archivos, `139/139` pruebas aprobadas.
- **Typecheck global:** `15/15` paquetes y las 4 apps sin errores.
- **Build de producción (`tinkay-web`):** exitoso con rutas OAuth y `/panel/contactos`.
