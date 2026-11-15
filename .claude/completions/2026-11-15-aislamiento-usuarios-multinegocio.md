# 2026-11-15 — Aislamiento Estricto de Usuarios, Login, Consentimientos y Notificaciones por Negocio (Opción A)

## Objetivo
Garantizar que cada negocio del monorepo (`tinkay`, `tranqi`, `fastfix`, `margaritas`) opere de forma **100% independiente** para clientes finales y administradores locales dentro del proyecto único Supabase `ecosistema` (`AGENTS.md` Regla 12, `PLT-001`, `PLT-003`, `PLT-008`, `PLT-012`, `PLT-018`).

## Hallazgos Corregidos
1. **Gating de Login y Panel (`/ingresar` y `/panel`):**
   - `iniciarSesion` ahora verifica membresía activa (`seg_membresia`) en el negocio destino antes de admitir la sesión (única excepción: fundadores globales con `usu_superadmin_plataforma = true`).
   - Se eliminó el auto-enrolamiento silencioso (`asegurarMembresiaCliente`) en `LayoutPanel` de las 4 apps web (`tinkay-web`, `tranqi-web`, `fastfix-web`, `margaritas-web`).
2. **Re-registro Independiente y Onboarding por Negocio (`/registro`, OAuth Callback y `/bienvenida`):**
   - Si un correo ya existía en `auth.users` por otro negocio, `registrarUsuario` valida su contraseña o envía enlace de acceso sin fallar con *"User already registered"* ni sobrescribir datos de otros negocios, registrando `seg_membresia` + `usu_detalle_usuario.registros_negocio[negocio]` + `seg_usuario_consentimiento`.
   - `crearManejadorCallbackOAuth` y `completarBienvenida` evalúan `onboarding_completo`, nombres, WhatsApp y consentimiento LOPDP por negocio (`resolverOnboardingNegocio` y `proyectarPerfilPorNegocio`).
3. **Cero Fugas Cruzadas en Notificaciones, Convenios y Gestión de Usuarios:**
   - `notificarNuevoUsuarioRegistrado` y `procesarAutoafiliacionYBienvenidaConvenio` en `@eco/notificaciones` filtran estrictamente por el negocio del evento (eliminando referencias fijas a `tranqi` / `TRANQ`).
   - `buscarUsuarios` en `@eco/gestion-usuarios` lista exclusivamente usuarios con membresía en el negocio consultado.
   - `tinkay.uio@gmail.com` queda acotado exclusivamente a `tinkay` (`usu_superadmin_plataforma = false`, `SUPERADMIN` + `ADMINISTRADOR` en `tinkay`), habilitando `seg_fn_es_superadmin_negocio(text)` para administrar `cfg_smtp` de su propio negocio.
4. **Historial de Accesos (`PLT-018`) y Baja de Cuenta (`PLT-012`) Aislados por Negocio:**
   - `registrarAcceso`, `obtenerHistorialAccesos` y `obtenerSaludo` registran y filtran `acc_detalle_acceso.negocio`.
   - Nuevo RPC transaccional `comun_seguridad.seg_fn_eliminar_cuenta_negocio(p_negocio)` que elimina solo la membresía y datos del negocio actual cuando el usuario mantiene cuentas independientes en otros negocios.

## Archivos Principales
- `supabase/migrations/20261115000001_aislamiento_estricto_usuarios_por_negocio.sql`
- `packages/identidad/src/negocio.ts` y `packages/identidad/src/negocio.test.ts`
- `packages/identidad/src/acciones.ts`, `servidor.ts`, `consultas.ts`, `acceso.ts` y formularios UI
- `packages/notificaciones/src/notificar-usuario.ts`
- `packages/gestion-usuarios/src/consultas.ts`
- `packages/comercio/src/acciones-logistica.ts`
- `apps/{tinkay-web,tranqi-web,fastfix-web,margaritas-web}/app/{bienvenida,panel}/**`
- `gobernanza/productos/plataforma/especificacion-funcional.md`
