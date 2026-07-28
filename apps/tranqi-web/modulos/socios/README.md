# Módulo: socios

Implementa **TRQ-001** (solicitud de registro de socio abogado) — ver
[`gobernanza/productos/tranqi/especificacion-funcional.md`](../../../../gobernanza/productos/tranqi/especificacion-funcional.md)
y [`especificacion-tecnica.md`](../../../../gobernanza/productos/tranqi/especificacion-tecnica.md).

**Propio de Tranqi, no compartido.** A diferencia de identidad/configuración-negocio/gestión-usuarios
(PLT-xxx, en `packages/*`), la red de abogados es un concepto exclusivo de este negocio — vive en
`apps/tranqi-web/modulos/`, no en un paquete del ecosistema.

## Flujo

1. Landing (`/`, sección "red") → botón "Quiero ser parte de la red" → `/panel/solicitud-socio`.
2. `/panel/solicitud-socio` vive dentro del layout de `/panel`, que ya exige sesión — un visitante sin
   cuenta llega primero a `/ingresar` (con enlace a `/registro`). Así se cumple "pasa por el registro
   general antes de llegar al formulario" sin duplicar lógica de redirect-after-auth en `@eco/identidad`.
3. El formulario (`FormularioSolicitudSocio`) inserta `trq_solicitud_socio` + hijos
   (`trq_experiencia_laboral`, `trq_solicitud_materia`, `trq_solicitud_provincia`) en una sola acción
   (`enviarSolicitudSocio`) — no hay estado "borrador" persistido, se llena y envía de una vez.
4. Panel admin → widget "Socios" (visible solo para `ADMINISTRADOR`/`SUPERADMIN`, vía
   `seg_widget`/`seg_rol_widget`) → `/panel/socios` (lista de socios verificados) y
   `/panel/socios/solicitudes` (lista de solicitudes, con detalle y acciones aceptar/rechazar).
5. Aceptar/rechazar es el RPC `tranqui_legal.trq_fn_decidir_solicitud` (transaccional, `SECURITY
   DEFINER`) — al aceptar, crea `trq_abogado` y asigna el rol `ABOGADO` vía
   `comun_seguridad.seg_fn_asignar_rol`, el mismo RPC de plataforma que usa gestión de usuarios.

## Decisiones de alcance tomadas en esta implementación

El documento `Plan_Entregable_1_Tranqi_Identidad_Socios.md` referenciado en `especificacion-tecnica.md`
**no existe en el repo ni en su historial de git** — nunca se llegó a crear. Solo existían los 8 nombres
de tabla y prefijos, ya fijados. Los campos del formulario, la máquina de estados y las siguientes
decisiones se definieron en esta implementación:

- **MFA no bloquea el envío de la solicitud.** MFA (PLT-002) todavía no existe en el código
  (`packages/auth` está explícitamente marcado como "solo para futuro trabajo de MFA"). Se exige más
  adelante, para activar capacidades reales del socio, no para postular — ver `abg_mfa_verificado` en
  `trq_abogado`, columna lista pero sin verificación real implementada todavía. Un cliente que ya
  configuró MFA en un flujo de pago (proceso crítico, PLT-002) ya lo cumpliría sin repetir el paso.
- **Cédula/matrícula en texto plano, no `pgp_sym_encrypt`.** Cifrar de verdad requiere gestión de claves
  (Supabase Vault) que el proyecto no tiene todavía — es una decisión aparte, no algo para improvisar en
  esta migración. Protegidas por RLS (solo el dueño de la solicitud y administradores de `tranqi` pueden
  leerlas); la vista de detalle del admin las muestra completas (las necesita para verificar), la vista
  de lista no las expone.
- **`trq_documento_socio` está modelada pero sin UI de carga.** No existe ningún bucket de Supabase
  Storage en el proyecto todavía — es la primera vez que se necesitaría. Por ahora la verificación
  depende de los enlaces asistidos a SENESCYT/Foro de Abogados (autodeclarados por el solicitante) más
  la revisión manual del administrador.
- **Estados `borrador`/`en_revision` existen en el `check` de `ssc_estado` pero no se usan todavía** — el
  formulario es de un solo envío (sin guardado parcial), y la revisión pasa directo de `enviada` a
  `aceptada`/`rechazada`. Se dejan en el esquema para no tener que migrar de nuevo si se necesitan.
- **Una sola solicitud activa por usuario** (índice único parcial) — permite volver a postular después de
  un rechazo, bloquea duplicados mientras una sigue en curso.

## Catálogos

`trq_materia` (especialidades legales) y `comun_catalogo.cat_provincia` (provincias de Ecuador, tabla
nueva y reutilizable por cualquier negocio con necesidad de ubicación) se poblaron con datos semilla en
la misma migración — ver `supabase/migrations/20260728000001_comun_catalogo_provincia.sql` y
`20260728000002_tranqui_legal_socios.sql`.
