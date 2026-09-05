---
tipo: esp_funcional
estado: vigente
version: 1.8
fecha: 2026-07-31
responsables: Kleber Toapanta / Jesus Navarrete
---

# Plataforma — Especificación Funcional Común

**Prefijo de código de requerimiento:** `PLT-xxx`  
**Propietarios:** Plataforma (transversal a todos los negocios del ecosistema)

Este documento describe el **comportamiento compartido por los 4 productos** (Tranqi, FastFix Home, Tinkay, Margaritas Floristería) y por cualquier nuevo negocio que se incorpore. Ningún producto redefine estos requerimientos en su propia especificación; únicamente los referencia por su código `PLT-xxx` y documenta lo específico de su dominio.

**Regla de precedencia:** Esta especificación establece los criterios de aceptación y reglas de negocio no negociables. Los agentes de codificación (Claude Code, Antigravity, Copilot, Cursor) e ingenieros deben implementar la lógica ajustándose strictly a este documento.

### Matriz de Responsables de Revisión, Implementación y Avance (%)

| Código | Funcionalidad / Requerimiento | Estado | Avance (%) | Responsable Asignado |
| :--- | :--- | :---: | :---: | :--- |
| **`PLT-001`** | Identidad Única, Registro Cero Fricción y Auth | ✅ Implementado | **85%** | Kleber Toapanta |
| **`PLT-002`** | Autenticación Multifactor (MFA TOTP) & Expiración por Inactividad | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-003`** | Membresías, Jerarquía & Active Role Switcher | ✅ Implementado | **100%** | Kleber Toapanta / Jesus Navarrete |
| **`PLT-004`** | **Buddie Conversacional (Chat IA ARIA & OCR Multimodal)** | 🟡 En Desarrollo | **60%** | **Jesus Navarrete** |
| **`PLT-005`** | Auditoría por Triggers y Widget Común | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-006`** | Datos de Facturación SRI y Comprobantes | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-007`** | Catálogo Geográfico (Ecuador 24 Provincias) | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-008`** | Configuración de Negocio & SMTP en Vault | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-009`** | Catálogo Comercial Unificado (Productos/Planes/Despachos) | 🟡 En Desarrollo | **85%** | Kleber Toapanta |
| **`PLT-010`** | **Integración Omnicanal (WhatsApp YCloud, ARIA y Supervisión Humana HITL)** | 🟡 En Desarrollo | **45%** | Kleber Toapanta / Jesus Navarrete |
| **`PLT-011`** | Sistema de Widgets por Rol & DataGrids 2 Capas | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-012`** | **Baja de Cuenta y Derecho al Olvido** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-013`** | Notificaciones Multicanal (Push/Email/In-App) | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-014`** | Motor de Cupones y Promociones | 🟡 En Desarrollo | **60%** | **Jesus Navarrete** |
| **`PLT-015`** | Calificaciones, Reseñas y Reputación | ⏳ Pendiente | **0%** | **Jesus Navarrete** |
| **`PLT-016`** | Storage Standard (Buckets Privado/Público) | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-017`** | Gestión de Sesiones y Revocación Remota | 🟡 Parcial | **40%** | Kleber Toapanta |
| **`PLT-018`** | Historial de Accesos y Saludo Personalizado | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-019`** | **Reclutamiento, Bolsa de Empleo y "Únete al Equipo"** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`PLT-020`** | **Agenda, Disponibilidad, Citas y Consulta Telemática** | 🟡 En Desarrollo | **30%** | Kleber Toapanta |

---

## PLT-001 — Identidad Única y Registro de Usuario Sin Fricción

**Responsable:** Kleber Toapanta  

### Descripción
Un usuario posee una **única identidad base** en todo el ecosistema (`comun_seguridad.seg_usuario`), pero ejecuta un **flujo de registro independiente por cada negocio** al que desea ingresar. El registro inicial prioriza la fluidez y conversión cero fricción.

### Reglas de Negocio
1. **Registro Inicial Ultra-Fluido (Cero Frenos):**
   - **Vía Google OAuth 2.0:** Se completa en 1 solo clic. Se extraen automáticamente el nombre, apellido, correo electrónico y la foto/logo del registro de Gmail. No se solicita ningún dato obligatorio adicional en este paso.
   - **Vía Correo Directo (Registro Simple):** Formulario mínimo con únicamente 4 campos: Nombres, Apellidos, Correo Electrónico y Contraseña.
2. **Carga de Foto de Perfil & Sincronización de Avatar de Gmail en Mi Cuenta (`mi_cuenta`):**
   - En la configuración del perfil (`/panel/cuenta`), se habilita la opción de **carga y actualización de Foto de Perfil personalizada** (almacenada y optimizada en WebP en `comun-publico/[NEGOCIO]/avatares-perfil/...`).
   - Cuando el usuario se registró mediante **Google OAuth / Gmail**, la interfaz ofrece explícitamente la opción de sincronizar/utilizar la **foto/logo oficial de su cuenta de Gmail** o cargar un avatar personalizado propio.
3. **Opción "Contáctame vía WhatsApp" (Exclusivamente Post-Registro):**
   - La opción de ingresar el número de WhatsApp y autorizar contacto **NUNCA debe ser un freno en el formulario de registro inicial**.
   - Se presenta únicamente **DESPUÉS** de que el usuario ha completado el registro (en la pantalla de bienvenida/onboarding posterior o dentro de la edición de su perfil), mediante un campo opcional con casilla de verificación (*checkbox*) desmarcada por defecto para autorización explícita (`autorizacion_contacto_whatsapp`).
4. **Información Transparente de Ubicación y Alcance Local:** En la pantalla de registro u onboarding de cada producto se expone de forma clara la información de presencia local en Ecuador y el alcance de atención (gestionados a través de `PLT-008`).
5. **Registro e Identidad Independiente por Negocio (`comun_seguridad.seg_membresia`):**
   - Aunque la cuenta base exista en el ecosistema, la suscripción a cada negocio crea un registro de membresía **100% independiente** que contiene:
     - `mem_fecha_registro`: Fecha y hora exacta de incorporación a dicho negocio.
     - `mem_estado`: Estado operativo de la membresía en ese producto (`ACTIVO`, `PENDIENTE`, `SUSPENDIDO`, `INACTIVO`).
     - Credencial / PIN específico si la aplicación lo requiere.
6. **Autenticación Biométrica y PIN Móvil (Apps Nativas Capacitor):**
   - En las aplicaciones nativas para smartphones (iOS/Android), se habilita el acceso rápido mediante **Biometría (Face ID / Touch ID / Huella Dactilar)** o mediante la **Clave / Patrón de desbloqueo del dispositivo móvil**, permitiendo re-ingresar al negocio sin solicitar la contraseña de Supabase en cada apertura.
7. **Aceptación de Términos y Widget de Gestión de Consentimientos (`gestion_terminos_consentimientos`):**
   - **Términos Globales:** Se aceptan en el registro inicial del ecosistema. Checkbox obligatorio en registro por correo, disclaimer + registro automático de aceptación en el callback para Google OAuth. Queda versionado por usuario (`usu_terminos_version`).
   - **Widget Administrativo de Términos, Consentimientos y Cláusulas Legales (`gestion_terminos_consentimientos`):** Módulo común configurable por negocio (`PLT-008`) que estructura y gestiona 4 categorías de consentimientos expresos:
     1. **Cliente General / Notificaciones:** Aceptación de recibir notificaciones del sistema y selección flexible por tipo de notificación (`PLT-013`).
     2. **Contacto por WhatsApp:** Autorización explícita desmarcada por defecto (`autorizacion_contacto_whatsapp`) para contacto directo por mensajes del sistema.
     3. **Bolsa de Empleo / Postulantes:** Cláusula de consentimiento LOPDP para autorizar la revisión, investigación de antecedentes y verificación de documentos/Hoja de Vida (`PLT-019`).
     4. **Tranqi (Servicios Legales Confidenciales):** Consentimiento para el almacenamiento, cifrado (`pgcrypto`) y tratamiento seguro de documentos personales y expedientes.

### Estado de implementación

Actualizado en cada PR que toque este requerimiento. `Parcial` significa que existe algo funcionando pero no cubre la regla entera.

| Regla / Ítem | Estado | Dónde vive / Detalle de lo que falta |
| :--- | :---: | :--- |
| 1 · Registro Ultra-Fluido (Google OAuth + Correo) | ✅ Implementado | `packages/identidad` (`FormularioRegistro.tsx`, `auth.tranqi24.com`) |
| 2 · WhatsApp Opcional Post-Registro | ✅ Implementado | `autorizacion_contacto_whatsapp` en `seg_usuario`, no frena el registro |
| 3 · Ubicación y Alcance Local | ✅ Implementado | Expuesto en onboarding y footer según catálogo `PLT-008` |
| 4 · Identidad Base y Membresías Independientes | ✅ Implementado | `comun_seguridad.seg_usuario` y `comun_seguridad.seg_membresia` |
| 5 · Biometría (Face ID / Touch ID) y PIN Móvil | ⏳ Pendiente | Plugin `@capacitor-community/biometrics` en apps nativas Capacitor |
| 6.a · Términos Globales del Ecosistema | ✅ Implementado | Checkbox obligatorio en correo, auto-registro en Google OAuth (`usu_terminos_version`) |
| 6.b · Términos Específicos del Negocio en Markdown | 🟡 Parcial | El texto en `/terminos` es estático; falta renderizarlo dinámicamente desde Markdown (`PLT-008`) |
| *Configuración OAuth en Supabase (Redirect URLs)* | 🟡 Parcial | Funciona 100% en `tranqi-web`; pendiente agregar Redirect URLs en Supabase para FastFix, Tinkay y Margaritas |

**Resumen de Deuda / Pendientes para 100%:**
1. Integrar biometría Capacitor en las Apps Móviles (Regla 5).
2. Conectar la página `/terminos` al Markdown configurable por negocio de `PLT-008` (Regla 6.b).
3. Registrar los Redirect URLs de las 3 apps restantes en Supabase Dashboard.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Registro ultra-rápido con Google OAuth sin fricción
  * **Dado que** un cliente no registrado hace clic en "Registrarse con Google" en el portal de Tinkay.
  * **Cuando** concede permisos en Google.
  * **Entonces** se crea de inmediato su registro en `comun_seguridad.seg_usuario` y accede al sistema sin que se le interrumpa exigiendo campos adicionales obligatorios.
* **Escenario:** Re-ingreso con biometría en App Móvil
  * **Dado que** un usuario registrado abre la app nativa de FastFix en su smartphone.
  * **Cuando** activa el sensor de huella dactilar / Face ID.
  * **Entonces** el sistema valida la credencial biométrica local y le otorga acceso inmediato a su sesión en FastFix.

**Implementación técnica:** Ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1 (`comun_seguridad.seg_usuario`).

---

## PLT-002 — Autenticación Multifactor (MFA) para Procesos Críticos y Reseteo de Credenciales

**Responsable:** Kleber Toapanta  

### Descripción
Implementa la autenticación multifactor basada en TOTP (compatible con Google Authenticator / Authy) mediante Supabase Auth para proteger transacciones irreversibles o envíos de datos sensibles, permitiendo la gestión autónoma del usuario en su panel y garantizando flujos de enrolamiento y recuperación accesibles.

### Reglas de Negocio
1. **MFA No Bloqueante en Navegación Ordinaria ni Registro:** El MFA no es obligatorio para registrarse, iniciar sesión (en su modalidad por defecto), navegar o consultar datos.
2. **Configuración y Gestión Autónoma en Panel de Usuario (Auto-Servicio MFA):**
   - Desde la sección de seguridad de su panel (`/panel/seguridad`), el usuario puede enrolar, re-vincular o reiniciar (reseteo autogestionado) su autenticador TOTP en cualquier momento sin esperar a ejecutar un proceso crítico.
3. **Modalidades de Exigencia Elegibles por el Usuario (Únicamente 2 Opciones):**
   El usuario puede seleccionar la modalidad de exigencia de MFA según su preferencia de seguridad desde su panel:
   - **Opción A: Solo Procesos Críticos (`SOLO_PROCESOS_CRITICOS` - Modalidad por Defecto / Estándar):** El MFA TOTP se solicita únicamente al ejecutar transacciones irreversibles o envíos de datos sensibles (ej. pasarela de pagos `PLT-006` o solicitudes críticas del negocio).
   - **Opción B: Solicitar Siempre (`SOLICITAR_SIEMPRE` - MFA en cada Inicio de Sesión):** El MFA TOTP se solicita obligatoriamente en cada inicio de sesión (segundo factor completo / 2FA al autenticarse) **además** de la confirmación en procesos críticos.
   - **Regla Estricta:** El sistema permite **exclusivamente** seleccionar entre estas 2 opciones (`SOLO_PROCESOS_CRITICOS` | `SOLICITAR_SIEMPRE`). No existen modalidades intermedias ni la opción de desactivar MFA en procesos críticos si el enrolamiento TOTP está activo.
4. **Enrolamiento Automático Ante la Primera Invocación Crítica:**
   - Si el usuario mantiene la modalidad *"Solo Procesos Críticos"* y aún no ha enrolado TOTP voluntariamente en su panel, el sistema lo interrumpe y exige el enrolamiento TOTP **exclusivamente ante la primera invocación a un proceso crítico**.
   - Si el usuario nunca ejecuta una acción crítica y no enrola MFA voluntariamente desde su panel, el sistema **nunca lo interrumpe** para solicitar MFA.
5. **Procesos Críticos Comunes y Específicos:**
   - **Proceso Crítico Común:** El uso de la **pasarela de pagos (`PLT-006`)** es el proceso crítico común a todas las aplicaciones del ecosistema que exige MFA o confirmación de seguridad.
   - **Procesos Críticos Específicos:** Cualquier otro flujo o acción que requiera MFA (ej. enviar solicitud de abogado socio en Tranqi) se especificará individualmente en la especificación del producto correspondiente (`gobernanza/productos/{producto}/especificacion-funcional.md`).
6. **Mecanismo de Recuperación Estándar de MFA (Auto-Servicio vía Correo OTP & Asistencia):**
   - **Proceso Estándar de Reseteo por Pérdida de App (OTP de Rescate vía Correo):**
     Si el usuario cambió de dispositivo o perdió el acceso a su app autenticadora, selecciona *"¿Perdiste tu app? Resetear vía correo"*. El sistema genera y envía automáticamente un **Código OTP de Rescate de 6 dígitos** (válido por 10 minutos) a su dirección de correo electrónico principal de registro. Al validar este código en el sistema, el MFA anterior queda desvinculado/desactivado de inmediato y el asistente le genera una **nueva Clave Secreta y Código QR** para enrolar su nueva aplicación autenticadora en el acto.
   - **Auto-servicio de Contraseña:** En caso de olvido de contraseña, el usuario puede solicitar el reseteo desde la pantalla de ingreso. El sistema envía automáticamente un enlace seguro de reseteo al correo de registro.
   - **Reseteo Asistido por Administrador:** El Administrador del negocio (o el SuperAdmin de Plataforma) tiene la facultad desde la consola de administración de desvincular el MFA del usuario o enviar un reseteo manual en caso de pérdida total de correo y dispositivo.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Enrolamiento voluntario y cambio de modalidad en panel
  * **Dado que** un usuario autenticado accede a su panel en `/panel/seguridad`.
  * **Cuando** enrola su app de autenticación TOTP y selecciona la opción "Solicitar Siempre".
  * **Entonces** en su próximo inicio de sesión el sistema le exigirá obligatoriamente el código TOTP tras ingresar su contraseña.
* **Escenario:** Enrolamiento automático en primer proceso crítico
  * **Dado que** un usuario en modalidad por defecto ("Solo Procesos Críticos") no ha enrolado MFA TOTP.
  * **Cuando** intenta realizar un pago por primera vez en la pasarela (`PLT-006`).
  * **Entonces** el sistema interrumpe el flujo y le solicita enrolar TOTP antes de procesar el pago.
* **Escenario:** Usuario sin acciones críticas no es interrumpido
  * **Dado que** un usuario registrado solo navega, busca servicios o consulta información.
  * **Cuando** no ejecuta ninguna acción crítica ni ingresa a su panel a enrolar MFA.
  * **Entonces** el sistema nunca le solicita configurar ni ingresar códigos MFA.

---

## PLT-003 — Membresías, Múltiples Perfiles y Jerarquía de Roles por Producto

**Responsables:** Kleber Toapanta / Jesus Navarrete  

### Descripción
Gestiona el control de acceso basado en roles y perfiles (RBAC/ABAC) aislado por negocio a través de `comun_seguridad.seg_membresia` y su jerarquía de perfiles. Implementa el principio de **Gobernanza Exclusiva de Plataforma por SuperAdmin** (para la matriz Perfil-Widget) y la **Operación de Usuarios por Administradores de Negocio** (para la asignación de perfiles a usuarios basada en niveles jerárquicos).

### Reglas de Negocio
1. **Separación de Responsabilidades (Gobernanza vs. Operación):**
   - **Gobernanza de Permisos (`SUPERADMIN` Exclusivo):** **Únicamente el `SUPERADMIN` de plataforma posee la facultad de configurar y modificar la matriz de widgets por perfil (`seg_rol_widget`)** y definir qué capacidades otorga cada perfil. Los Administradores locales de negocio no pueden crear perfiles no autorizados ni reconfigurar los widgets o permisos de un perfil.
   - **Operación de Usuarios (`ADMINISTRADOR` de Negocio):** El Administrador de una empresa asigna y desasigna perfiles pre-aprobados por la plataforma a los usuarios de su negocio, respetando la regla del techo jerárquico ($\le$ a su propia jerarquía).
2. **Registro Inicial Obligatorio como 'CLIENTE' (Jerarquía Base):**
   - Al completar el registro u onboarding por primera vez en cualquier empresa/producto del ecosistema, el sistema asigna **obligatoriamente y por defecto** el perfil `CLIENTE`.
   - `CLIENTE` representa indefectiblemente el nivel jerárquico más bajo (Nivel 1 / Base) en todas las aplicaciones del ecosistema.
3. **Configuración de Múltiples Perfiles por Usuario por Empresa:**
   - En cada empresa o negocio, un mismo usuario puede tener configurados **múltiples perfiles activos simultáneamente** dentro de su membresía (`comun_seguridad.seg_membresia`).
   - *Ejemplos:* Un usuario en Tranqi puede ostentar simultáneamente los perfiles `CLIENTE` y `ABOGADO`; un usuario en FastFix puede poseer los perfiles `CLIENTE` y `TECNICO`.
4. **Escala y Matriz Estándar de Niveles Jerárquicos:**
   - Cada perfil posee un nivel jerárquico numérico ascendente ($1$ a $100$) estandarizado por la plataforma:

   | Nivel Jerárquico | Perfil Estándar | Ámbito de Permisos | Quién lo Asigna a Usuarios | Gobernanza de Permisos/Widgets |
   | :---: | :--- | :--- | :--- | :--- |
   | **1 (Base)** | `CLIENTE` | Empresa | Asignación automática por sistema | Exclusivo `SUPERADMIN` |
   | **30** | `OPERADOR` / `AUXILIAR` | Empresa | Administrador o SuperAdmin | Exclusivo `SUPERADMIN` |
   | **50** | `TECNICO` / `ABOGADO` | Empresa | Administrador o SuperAdmin | Exclusivo `SUPERADMIN` |
   | **80** | `ADMINISTRADOR` | Empresa | SuperAdmin (o Admin existente) | Exclusivo `SUPERADMIN` |
   | **100 (Techo)** | `SUPERADMIN` | Plataforma | Bootstrap / Solo SuperAdmin | Exclusivo `SUPERADMIN` |

5. **Control de Asignación y Delegación por Jerarquía (Techo Jerárquico):**
   - Un usuario gestor únicamente puede **asignar, modificar o remover perfiles** a otros usuarios si la jerarquía del perfil a asignar es **igual o menor ($\le$)** a la jerarquía máxima que ostenta el gestor en esa empresa.
   - Ningún gestor puede asignar perfiles de jerarquía superior a la suya propia ni auto-elevar sus privilegios.
6. **Aislamiento de Perfiles por Negocio:**
   - Los perfiles y membresías están aislados por producto. Tener el perfil `ADMINISTRADOR` en Tranqi no otorga privilegios ni perfiles en Tinkay, FastFix o Margaritas.
7. **Verificación de Estado Adicional para Capacidades Operativas:**
   - Ostentar un perfil en la membresía es condición necesaria pero no suficiente: si el negocio exige una aprobación explícita en sus tablas operativas (ej. registro en `trq_abogado` en estado `APROBADO` o `ffh_tecnico` habilitado), las capacidades operativas avanzadas se activan únicamente al verificar dicho estado.
8. **Notificación Automática Multicanal por Cambio de Perfil:**
   - Cada vez que a un usuario se le asigna o revoca un perfil dentro de un negocio (vía `seg_fn_asignar_rol`), el sistema dispara **automáticamente e de forma inmediata** una notificación multicanal (`PLT-013`):
     - **Correo Electrónico (Email):** Notificación formal detallando el cambio de perfil y las nuevas capacidades otorgadas en la empresa.
     - **Notificación Push (Web / Mobile Push):** Alerta instantánea al dispositivo móvil / navegador registrado del usuario.
     - **In-App:** Registro persistente en la bandeja/campana de notificaciones de la aplicación.
9. **Experiencia de Usuario Multi-Rol y Selector de Rol Activo (Active Role Switcher UI):**
   - **Independencia Operativa por Aplicación:** Cada negocio (Tranqi, FastFix, Tinkay, Margaritas) opera como una aplicación independiente con su propio dominio/despliegue. La experiencia multi-rol actúa dentro de la propia app del negocio.
   - **Conmutador de Rol Activo (*Active Role Switcher*):**
     - Si un usuario ostenta múltiples perfiles activos en una misma empresa (ej. `CLIENTE` + `ABOGADO` + `ADMINISTRADOR` en Tranqi), la interfaz del panel despliega un **Selector de Rol Activo** en la barra superior/perfil (*"Modo Cliente"* | *"Modo Abogado / Socio"* | *"Modo Administrador"*).
     - Al alternar el rol activo, el panel reestructura instantáneamente su menú de navegación y renderiza únicamente las secciones y widgets asignados a dicho rol (`PLT-011`).
10. **Persistencia de Rol Favorito y Visibilidad Móvil (PLT-003.10):**
    - **Persistencia de Rol Favorito por Defecto:** Cada opción en el Selector de Rol Activo ("Ver Cómo") incluye un botón de estrella (⭐) que permite al usuario fijar su rol preferido. Dicha elección se persiste en la cookie `tranqi_rol_favorito` y `localStorage`. Al iniciar sesión o ingresar a la plataforma, si no existe una sesión activa de modo temporal, el sistema se tematiza y estructura automáticamente en el rol favorito del usuario.
    - **Garantía de Visibilidad en Dispositivos Móviles:** En pantallas móviles (<640px), las opciones del selector exhiben de forma obligatoria tanto el icono representativo como el **nombre completo del perfil** (`Cliente`, `Operador / Auxiliar`, `Socio Abogado`, `Administrador del Negocio`, `SuperAdmin de Plataforma`), garantizando una navegación legible y operable.

### Estado de implementación

Actualizado en cada PR que toque este requerimiento. `Parcial` significa que existe algo funcionando pero no cubre la regla entera.

| Regla | Estado | Dónde vive |
| :--- | :--- | :--- |
| 1 · Gobernanza vs. operación | ✅ Implementado | `seg_rol_widget` existe; pantalla de gobernanza e inspección de matriz 2 niveles (`AdministracionPerfilesWidget` en `/panel/configuracion`) |
| 2 · `CLIENTE` obligatorio al registrarse | ✅ Implementado | `seg_fn_asegurar_membresia_cliente()`; crea membresía **y** fila de perfil |
| 3 · Perfiles múltiples simultáneos | ✅ Implementado | `seg_membresia_perfil` (tabla de unión). `mem_rol` queda deprecada |
| 4 · Escala jerárquica 1–100 | ✅ Implementado | `seg_perfil` con `per_nivel`; `SUPERADMIN` figura como techo pero `per_asignable = false` |
| 5 · Techo jerárquico | ✅ Implementado | `seg_fn_asignar_perfil()` / `seg_fn_quitar_perfil()`; la tabla de unión no tiene política de escritura, así que no hay vía que lo evite |
| 6 · Aislamiento por negocio | ✅ Implementado | `mem_negocio`; el nivel del gestor se calcula **por negocio**, no global |
| 7 · Verificación de estado adicional | ✅ Implementado | `trq_abogado` y validación de perfiles por negocio |
| 8 · Notificación multicanal por cambio de perfil | ✅ Implementado | `emision_notificaciones` (`PLT-013`) |
| 9 · Conmutador de rol activo & Tematización por Perfil | ✅ Implementado | Conmutador `ver_como` y paleta de colores dinámica por perfil en `AdministracionPerfilesWidget.tsx` |
| 10 · Persistencia de rol favorito y visibilidad móvil | ✅ Implementado | Cookie `tranqi_rol_favorito` y maquetación responsive en `SelectorRolActivo.tsx` y `globals.css` |

**Deuda declarada:** `seg_membresia.mem_rol` sigue existiendo, marcada como deprecada en el comentario de la columna. Es una transición expand/contract deliberada — se retira en una migración posterior, cuando producción lleve tiempo leyendo del modelo nuevo. Ningún código la lee ya.
### Criterios de Aceptación (Gherkin)
* **Escenario:** Asignación automática inicial de perfil CLIENTE
  * **Dado que** un usuario no registrado ingresa por primera vez a FastFix.
  * **Cuando** completa el flujo de registro u onboarding.
  * **Entonces** el sistema le crea su membresía en FastFix asignándole automáticamente el perfil `CLIENTE` como nivel jerárquico base.
* **Escenario:** Asignación de múltiples perfiles en una misma empresa y notificación automática
  * **Dado que** un usuario registrado en Tranqi posee el perfil `CLIENTE`.
  * **Cuando** el Administrador de Tranqi aprueba su solicitud profesional y le asigna el perfil `ABOGADO`.
  * **Entonces** el sistema le agrega el perfil `ABOGADO` manteniendo activo `CLIENTE`, y dispara automáticamente una notificación por Email y Push al usuario informando el cambio de perfil.
* **Escenario:** Conmutación de rol activo en usuario multi-perfil (Active Role Switcher)
  * **Dado que** un usuario registrado en Tranqi posee los perfiles `CLIENTE` y `ABOGADO`.
  * **Cuando** abre el selector de rol activo en el panel y conmuta de "Modo Cliente" a "Modo Abogado".
  * **Entonces** el sistema actualiza la navegación cliente por el panel profesional de abogado, mostrando los widgets de causas asignadas, citas y expedientes.
* **Escenario:** Asignación permitida de perfil de igual o menor jerarquía
  * **Dado que** un usuario gestor posee el perfil `ADMINISTRADOR` (Jerarquía Nivel 80) en Tinkay.
  * **Cuando** asigna a un usuario los perfiles `OPERADOR` (Jerarquía Nivel 30) o `ADMINISTRADOR` (Jerarquía Nivel 80).
  * **Entonces** el sistema valida que la jerarquía es igual o menor a la del gestor y procesa exitosamente la asignación.
* **Escenario:** Intento bloqueado de asignar perfil de jerarquía superior
  * **Dado que** un gestor posee el perfil `ADMINISTRADOR` (Jerarquía Nivel 80) en FastFix.
  * **Cuando** intenta asignar a otro usuario el perfil `SUPERADMIN` (Jerarquía Nivel 100).
  * **Entonces** el sistema bloquea la transacción con una excepción de seguridad indicando "No posee jerarquía suficiente para asignar este perfil".
* **Escenario:** Intento de modificación no autorizada de la matriz de widgets por un Administrador
  * **Dado que** un usuario con perfil `ADMINISTRADOR` de negocio intenta modificar las asignaciones en `seg_rol_widget`.
  * **Cuando** ejecuta la solicitud de actualización de widgets por perfil.
  * **Entonces** la política de seguridad RLS bloquea la operación indicando "La gobernanza de perfiles y widgets es exclusiva del SuperAdmin de plataforma".

---

## PLT-004 — Buddie Conversacional (Chat Asistido por IA)

**Responsable:** **Jesus Navarrete**  

### Descripción
Proporciona una interfaz conversacional inteligente ("buddie") integrada en las aplicaciones del ecosistema, respaldada por agentes especializados en el motor ARIA.

### Reglas de Negocio
1. **Estándar de Diseño Responsive (Mobile-First):**
   - **En pantallas de escritorio (MD/LG):** Widget flotante compacto en la esquina inferior derecha (minimizable).
   - **En pantallas móviles/celulares (SM):** Botón flotante táctil que despliega una interfaz **Drawer Full-Screen / Modal Táctil adaptativo**, diseñado para no superponerse a los elementos principales de la app y compatible con el teclado virtual del teléfono.
2. **Acceso Anónimo vs. Autenticado:**
   - Se permite la interacción anónima para consultas públicas e informativas en las landings del producto.
   - Si la consulta del usuario requiere acceder o modificar información personal, citas o pedidos, el Buddie solicita explícitamente el inicio de sesión.
3. **Persistencia del Historial:** Las conversaciones se persisten en PostgreSQL asociadas al usuario/sesión para permitir reanudar el contexto de la charla en futuras visitas.
4. **Resistencia a Fallos (Fallback):** Si el servidor de ARIA no responde o no hay credenciales, el componente muestra respuestas de contingencia predefinidas sin degradar la aplicación web.

---

## PLT-005 — Auditoría de Cambios y Telemetría

**Responsable:** Kleber Toapanta  

### Descripción
Registra automáticamente todas las modificaciones de datos en las tablas de negocio mediante el trigger PostgreSQL `aud_fn_auditar_tabla()` y despliega el historial a través de un **Widget Único y Común de Auditoría** integrado en las consolas de administración.

### Reglas de Negocio
1. **Auditoría Transparente por DB Trigger:** Todas las operaciones `INSERT`, `UPDATE` y `DELETE` guardan el estado anterior y nuevo (`JSONB`) en `comun_auditoria.aud_registro`.
2. **Widget Único y Común de Auditoría (`auditoria`):**
   - La funcionalidad de visualización de auditoría es un componente de software **único, transversal y reutilizable** para todas las aplicaciones del ecosistema.
   - **Adaptabilidad Visual:** El widget mantiene exactamente la misma lógica operativa en todas las apps, adaptando únicamente su paleta de colores, tokens CSS y tema gráfico al branding del producto que lo hospeda.
3. **Aislamiento y Visibilidad por Rol:**
   - **Rol `ADMINISTRADOR`:** Visualiza únicamente los registros de auditoría pertenecientes al negocio donde ejerce dicho rol (`/admin/auditoria`).
   - **Rol `SUPERADMIN` de Plataforma:** Desde **cualquier aplicación** del ecosistema, al abrir el widget de auditoría posee la facultad de visualizar la auditoría de **todas las aplicaciones** (con selector/filtro global por negocio o vista consolidada).

### Criterios de Aceptación (Gherkin)
* **Escenario:** Administrador visualiza auditoría de su negocio
  * **Dado que** un `ADMINISTRADOR` de FastFix accede al widget de auditoría en FastFix.
  * **Cuando** consulta el historial de registros.
  * **Entonces** solo visualiza las operaciones realizadas dentro del negocio y esquemas de FastFix (`FFH`).
* **Escenario:** SuperAdmin visualiza auditoría global desde cualquier app
  * **Dado que** el `SUPERADMIN` abre el widget de auditoría desde la consola de Tinkay.
  * **Cuando** activa el filtro multitenant o consulta la lista global.
  * **Entonces** puede inspeccionar la auditoría de Tranqi, FastFix, Tinkay y Margaritas sin cambiar de aplicación.

---

## PLT-006 — Facturación Electrónica SRI y Pasarela de Pagos

**Responsable:** Kleber Toapanta  

### Descripción
Unifica el procesamiento de pagos y la emisión de comprobantes electrónicos autorizados por el Servicio de Rentas Internas (SRI) de Ecuador.

### Reglas de Negocio
1. **Pasarela de Pagos como Proceso Crítico Común:** El flujo de cobro es la acción crítica común transversal a todas las aplicaciones que activa las garantías de seguridad y MFA TOTP de `PLT-002`.
2. **Emisión de Facturas Electrónicas:** Todo pago completado exitosamente genera la factura electrónica SRI.
3. **Confirmación de Datos de Facturación y Widget Autocontenido (`FormularioDatosFacturacion.tsx`):**
   - Antes de procesar el cobro, el sistema solicita al cliente confirmar si requiere la factura a nombre de **Consumidor Final** o con **Datos Personalizados (RUC/Cédula, Razón Social, Dirección, Correo)**.
   - Si el cliente elige emitir con datos y no los ha registrado previamente en su perfil, el sistema exige su ingreso antes de habilitar la pasarela de pago.
   - **Widget Autocontenido de Datos de Facturación en Mi Cuenta:** Accesible desde `/panel/cuenta`, permite configurar y respaldar de forma permanente: *Nombre Completo / Razón Social*, *Tipo de Documento (Cédula, RUC, Pasaporte)*, *Número de Identificación*, *Teléfono de Contacto*, *Dirección Fiscal* y *Correo Electrónico de Facturación* (diferenciado de los correos de notificación). Incluye la opción de autocompletar *"Usar Nombres del Registro"*.
4. **Arquitectura Multi-Pasarela y Métodos de Pago Directos:**
   - **Adaptador de Pasarelas por Tenant (*Strategy Pattern*):**
     - **Tranqi:** Paymentez / Nuvei (tokenización de tarjetas, suscripciones y 3DSecure).
     - **Tinkay & Margaritas:** Payphone API (enlaces de cobro, app-to-app y botón Payphone).
     - **FastFix:** Payphone o Paymentez.
   - **Métodos Directos Sin Pasarela (0% Recargo Bancario):**
     - **Deuna (Banco Pichincha):** Código QR o número de celular oficial para transferencias instantáneas.
     - **Transferencia Bancaria Directa:** Presentación de cuentas bancarias oficiales del negocio con carga de foto de comprobante.
   - **Auditoría y Conciliación con ARIA Multimodal:**
     - Las capturas de transferencias y pagos Deuna son procesadas por el OCR multimodal de ARIA (`PLT-004`) extrayendo monto, referencia y fecha, detectando comprobantes duplicados y pre-validando la transacción para aprobación en 1 clic en el widget `conciliacion_pagos`.

---

## PLT-007 — Catálogo Geográfico Unificado (Ecuador)

**Responsable:** Kleber Toapanta  

### Descripción
Proporciona el catálogo maestro de las 24 Provincias y sus respectivos Cantones/Ciudades de la República del Ecuador en `comun_catalogo`.

### Reglas de Negocio
1. **Carga Inicial Completa:** La base de datos se inicializa con la totalidad de las 24 provincias y cantones oficializados por el INEC.
2. **Activación Zonal por Negocio:** Cada producto activa las provincias/ciudades en las que opera comercialmente (ej. Tinkay y FastFix operan inicialmente en *Pichincha / Quito*, mientras que Tranqi habilita *Cobertura Nacional*).
3. **Estandarización de Direcciones:** Cualquier entidad que requiera provincia o ciudad (residencia de cliente, cobertura de abogado, zona de técnico o dirección de entrega) consulta obligatoriamente este catálogo.

---

## PLT-008 — Configuración de Datos Generales del Negocio, Términos y Redes Sociales

**Responsable:** Kleber Toapanta  

### Descripción
Proporciona una consola de configuración para que el Administrador de cada negocio defina la información corporativa, canales de atención, términos legales y locales físicos de su producto.

### Reglas de Negocio
1. **Provincias y Ciudades de Operación:** Selección de 1 o más provincias/ciudades activas del catálogo de `PLT-007` que delimitan la zona de cobertura comercial del negocio.
2. **Canales de Contacto (1 o más):**
   - Tipo de canal: Teléfono de Atención, WhatsApp Oficial, Correo Electrónico de Soporte, Horario de Atención.
   - Estado activo/inactivo por canal.
3. **Redes Sociales Oficiales del Negocio (Top 3 Ecuador):**
   - Configuración de enlaces oficiales para el **Top 3 de Redes Sociales más usadas en Ecuador**:
     - **Facebook** (Página Oficial / Fanpage)
     - **Instagram** (Perfil Oficial)
     - **TikTok** (Cuenta Oficial de Contenido)
     - *(Opcional: WhatsApp Business / X)*
4. **Editor de Términos de Servicio en Markdown (`.md`):**
   - Módulo en la consola administrativa para redactar y editar en formato **Markdown (`.md`)** los Términos de Servicio y Políticas de Privacidad específicos del negocio.
   - Vista previa en tiempo real y versionado de cambios legales.
5. **Locales / Puntos de Atención Física (1 o más):**
   - **Nombre del Local / Sucursal:** Identificador descriptivo (ej. *Matriz Quito Norte*, *Sucursal Cumbayá*).
   - **Dirección Física:** Calle principal, secundaria, número y referencia.
   - **Ubicación en Google Maps:** Coordenadas GPS (latitud, longitud) y/o URL embebida de Google Maps para navegación.
   - **Fotografía del Local (Opcional):** Imagen representativa de la fachada u oficina para brindar confianza visual al cliente.
   - **Indicador de Sede Principal:** Un local debe marcarse como Matriz/Sede Principal.
6. **Servidor de Correo Saliente (SMTP) propio del negocio** — widget `configuracion_correo`, **exclusivo del `SUPERADMIN` de plataforma**:
   - **Por qué no lo gestiona el `ADMINISTRADOR` del negocio:** quien controla el SMTP puede enviar correo *en nombre* del negocio —códigos de verificación, enlaces de restablecimiento— a cualquier dirección. Es una capacidad de suplantación, no un ajuste de ficha, y por eso no se equipara al resto de `PLT-008`. El widget se registra sin asignaciones en `seg_rol_widget`, lo que por construcción lo reserva a superadmin, y el estrechamiento se aplica además en la política RLS y en los RPC — ocultar el widget por sí solo no cerraría la puerta.
   - Se configura desde la consola el servidor por el que sale el correo transaccional del negocio: **servidor (host), puerto, tipo de cifrado (TLS implícito o STARTTLS), usuario, contraseña y nombre del remitente**. No son variables de despliegue: cambiar de buzón no debe requerir intervención técnica ni un nuevo despliegue.
   - **La contraseña se guarda cifrada en Supabase Vault y no vuelve a mostrarse a nadie**, ni siquiera al Administrador que la escribió. La pantalla solo indica si existe; dejar el campo vacío conserva la guardada, y hay una acción explícita y separada para eliminarla. Ver [`ADR-0005`](../../arquitectura/adr/0005-smtp-por-negocio.md).
   - **Interruptor de activación independiente de la configuración:** los datos pueden quedar cargados sin que el negocio empiece a enviar. Solo se puede activar si host, usuario y contraseña están completos.
   - Mientras un negocio no tenga SMTP activo **no envía correo**: no existe un remitente compartido por defecto que enmascare una configuración faltante. Afecta al código de verificación de registro (`PLT-001`) y al enlace de recuperación de contraseña.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Configuración del servidor SMTP del negocio
  * **Dado que** el SuperAdmin de plataforma abre el widget "Servidor de correo" de un negocio.
  * **Cuando** completa servidor, puerto, usuario y contraseña, marca "Enviar los correos de este negocio por este servidor" y guarda.
  * **Entonces** el sistema almacena la contraseña cifrada, deja de mostrarla, y los siguientes códigos de verificación y enlaces de recuperación salen desde ese remitente.
* **Escenario:** Intento de activar el envío sin credenciales completas
  * **Dado que** el SuperAdmin marca la casilla de activación sin haber indicado el servidor.
  * **Entonces** el sistema rechaza el guardado indicando qué dato falta, en vez de activar una configuración que fallaría en cada envío.
* **Escenario:** Un Administrador de negocio intenta llegar al servidor de correo
  * **Dado que** un `ADMINISTRADOR` no ve el widget en su rail y navega directamente a la URL.
  * **Entonces** no obtiene la configuración —la política `cfg_smtp_superadmin_lectura` no le devuelve fila— y cualquier intento de guardado es rechazado por el RPC con "No autorizado".
* **Escenario:** Edición de Términos de Servicio en Markdown
  * **Dado que** el Administrador de FastFix accede al panel `/admin/configuracion-negocio/terminos`.
  * **Cuando** edita el contenido legal en formato Markdown y hace clic en "Guardar y Publicar".
  * **Entonces** el sistema actualiza el texto y lo despliega instantáneamente en el modal de Términos de la app de FastFix.

---

## PLT-009 — Catálogo Comercial Unificado (Productos, Servicios, Suscripciones y Logística)

**Responsable:** Kleber Toapanta  

### Descripción
Motor centralizado de gestión de bienes, servicios, recetas (BOM), inventarios, suscripciones, proformas CPQ, billeteras digitales y logística de despachos para todo negocio del ecosistema (Tinkay, Margaritas Floristería, planes/trámites de Tranqi, servicios técnicos de FastFix). Un solo modelo de datos (`comun_comercio`), aislado por tenant/negocio. Ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md) para la arquitectura de 8 capas completa.

### Reglas de Negocio
1. **Jerarquía de tres niveles:** Categoría (navegación) → Producto/Servicio Master (concepto abstracto) → Variante/SKU (unidad facturable concreta, con precio base imponible, impuestos y códigos SRI propios).
2. **Cuatro tipos de oferta por variante:** Producto Físico, Servicio Puntual, Suscripción/Plan Recurrente (con frecuencia, días de prueba y reglas de reintento de cobro) y Producto Digital.
3. **Matriz de variantes:** un producto master puede tener N variantes con atributos propios (tamaño, cantidad, color, accesorios) y precio/impuesto independiente por variante.
4. **Formularios de personalización por producto/variante:** campos de captura configurables (mensaje de dedicatoria, fecha/rango de entrega, remitente/destinatario) y adicionales de cross-sell sugeridos que incrementan el valor final.
5. **Lista de Materiales y Recetas (BOM):** Deducción automática de insumos (rosas, papel, cinta, repuestos de gasfitería, café en grano) al pasar la orden al estado operativo de elaboración o despacho.
6. **Inventario, Kardex y Mermas:** Registro auditado de entradas, consumos por órdenes, mermas por caducidad/marchitamiento y ajustes de almacén.
7. **Proformas y Cotizaciones (CPQ):** Generación de cotizaciones para servicios complejos (FastFix, eventos Tinkay, causas judiciales Tranqi) con vigencia, desglose de ítems libres y token de aprobación en línea.
8. **Billetera Digital y Convenios Corporativos B2B2C:**
   - Cada usuario posee una billetera virtual por negocio (`wlt_saldo_total = wlt_saldo_recarga + wlt_saldo_bono`).
   - Empresas e instituciones patrocinan convenios (ej. Banco Pichincha, Municipio de Quito, Condominios en FastFix) otorgando bonos con caducidad para redención en trámites y mano de obra.
   - Soporte de pagos divididos (*Split Payment*): liquidación combinando saldo de billetera con pasarela de tarjeta de crédito.
9. **Directorio de Proveedores, Couriers y Despachos Híbridos:**
   - Directorio unificado de transportistas y contratistas: vehículos propios de taller, mensajería de documentos físicos (Tranqi), aplicaciones de movilidad (Uber / Cabify / taxis convencionales para Tinkay) y técnicos subcontratados con respaldo de marca (FastFix Managed Marketplace).
   - Asignación por orden con registro de conductor, teléfono, enlace de seguimiento en vivo (*tracking URL*), costo real incurrido y evidencia fotográfica o firma digital (*Proof of Delivery / POD*).
10. **Aislamiento multitenant:** cada negocio opera sobre su propio subconjunto de `comun_comercio`, identificado por negocio dueño — el catálogo de un negocio nunca es visible como editable para otro.
11. **Desacoplamiento fiscal:** la variante almacena la **Base Imponible** para comprobantes del SRI (`PLT-006`), mientras la tienda web y WhatsApp calculan y muestran precios finales claros al consumidor.
12. **Catálogo publicado es de lectura pública:** un producto/variante activo se puede consultar sin autenticación — la edición queda restringida al `ADMINISTRADOR` u `OPERADOR` del negocio dueño.
13. **Pasarelas de Pago en Línea Multitenant y Autónomas por Negocio (`com_pasarela_configuracion` y `com_transaccion_pago`):**
    - **Configuración Autónoma por Negocio:** La infraestructura de pagos es transversal a los 4 negocios (Tranqi, FastFix, Tinkay, Margaritas), pero cada negocio configura sus parámetros de manera 100% independiente como cliente autónomo ante las entidades procesadoras.
    - **Pasarelas Soportadas:** Integración inicial con **Payphone (Cajita de Pagos v2.0)** para cobros con tarjetas de crédito/débito nacionales e internacionales y saldo Payphone; arquitectura desacoplada mediante interfaz de adaptador para incorporar subsecuentemente **Paymentez (Nuvei)**, Transferencia Bancaria Directa y Deuna.
    - **Condición de Disponibilidad en Checkout:** Una pasarela solo se habilita y despliega ante los compradores en la tienda web de un negocio si:
      1. Cuenta con sus parámetros y credenciales obligatorias configurados (ej. `storeId`, modo de entorno).
      2. Su interruptor de estado se encuentra explícitamente activo (`psc_activo = true`).
      Si una pasarela no está configurada o se encuentra inactiva, el checkout no la expone como método de pago.
    - **Seguridad Criptográfica y Aislamiento de Credenciales:** Las credenciales privadas (`token` Bearer para confirmar pagos) se almacenan en servidor y nunca se transmiten al navegador web (`psc_credenciales_privadas`). La consulta pública para renderizar el checkout se efectúa mediante la función RPC `com_fn_obtener_pasarelas_activas(negocio)` que retorna exclusivamente datos públicos y metadatos visuales.
    - **Confirmación Obligatoria Server-to-Server:** En Payphone, el servidor ejecuta una solicitud `POST /api/confirm` dentro de los primeros 5 minutos tras el retorno del usuario para verificar la autenticidad y prevenir el reverso automático del dinero.
    - **Trazabilidad Transaccional:** Cada intento o confirmación de pago se registra en `com_transaccion_pago` vinculando cliente, referencia de pedido, montos, desglose impositivo (IVA 15%), código de autorización bancario, marca y últimos dígitos de tarjeta, y payload técnico raw para auditoría financiera.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §7 (`comun_comercio`).

---

## PLT-010 — Integración Omnicanal (WhatsApp Business YCloud, ARIA y Consola Humana HITL)

**Responsables:** Kleber Toapanta / Jesus Navarrete  

### Descripción
Ecosistema integral de atención conversacional y distribución comercial omnicanal. Conecta el catálogo unificado (`PLT-009`) y los agentes conversacionales de ARIA (`PLT-004`) con **WhatsApp Business Cloud API** (mediante el proveedor oficial **YCloud**), integrando una **Consola de Supervisión Humana (*Human-in-the-Loop* - HITL)** para asistencia en vivo, toma de control por operadores humanos y atribución de comisiones de venta.

### Reglas de Negocio
1. **Conector Oficial WhatsApp Cloud API vía YCloud:**
   - Cada negocio del ecosistema puede asociar su línea oficial de WhatsApp Business configurando sus credenciales de YCloud (`YCLOUD_API_KEY`, webhook URL) en `comun_seguridad.cfg_negocio`.
   - El webhook entrante `/api/webhooks/ycloud` valida obligatoriamente la firma de seguridad `X-YCloud-Signature` antes de procesar cualquier evento.
2. **Persistencia Unificada y Modelo de Chats (`comun_agentes`):**
   - Toda conversación multicanal se persiste en `comun_agentes.agc_conversacion` y `comun_agentes.agc_mensaje`.
   - El identificador `cnv_id` (UUID) se comparte con ARIA como `conversation_id`, asegurando trazabilidad exacta entre la memoria del modelo y la vista del operador.
   - Las tablas implementan **Supabase Realtime** para actualización instantánea en la consola de operadores sin recargas ni polling.
3. **Máquina de Estados de Atención y Despacho:**
   - **`BOT_ACTIVO`:** ARIA atiende de forma autónoma. Razona con sus prompts de negocio y herramientas MCP (ej. consulta de catálogo, generación de cotizaciones, enlaces a fotos).
   - **`ESCALADO_HUMANO`:** Se activa si ARIA detecta que no puede resolver la duda, el cliente solicita un asesor humano, o hay un reclamo/pedido especial. Se emite notificación prioritaria sonora y visual a la consola de operadores.
   - **`EN_ATENCION_ASESORA`:** Un operador humano tomó el control. El bot ARIA se silencia inmediatamente para ese hilo. El operador responde directamente a WhatsApp desde la consola web mediante YCloud API.
   - **`CERRADO`:** Conversación finalizada o venta concretada.
4. **Consola de Supervisión Humana (*Human-in-the-Loop* - HITL) en Widgets (`PLT-011`):**
   - Construida bajo el patrón unificado de widgets (`consola_chat` / `atencion_whatsapp`).
   - Dispone de 3 paneles:
     - **Bandeja de Entrada:** Filtros rápidos (*Requiere Atención / Escalados*, *Mis Chats*, *Bot Activo*, *Cerrados*), badges de no leídos y tiempo de espera.
     - **Visor de Conversación en Vivo:** Historial cronológico diferenciando burbujas del cliente, del bot ARIA y del operador humano; botones de acción rápida **[ Tomar Control ]** y **[ Reactivar Bot ]**; input para despacho de mensajes a WhatsApp; selector de respuestas rápidas (plantillas).
     - **Ficha de Pedido y Operador:** Panel lateral con datos del contacto, asignación de asesora para comisiones netas, generación directa de link de pago (Payphone/Paymentez) y pase a operaciones/taller.
5. **Feed Automatizado para Meta Commerce Manager:**
   - Cada negocio expone un feed estructurado (XML/JSON) que Meta consulta periódicamente para sincronizar el catálogo de productos con WhatsApp Business, Facebook e Instagram.
6. **Botón "Comprar por WhatsApp":**
   - En las tiendas web del ecosistema, el botón genera un enlace profundo con texto estructurado (producto, SKU, PVP en dólares, extras y dirección), enrutándolo al agente ARIA o a la asesora con el tag correspondiente.

**Especificación específica de producto:** Ver [`agente-aria-whatsapp-ycloud.md`](../tinkay/agente-aria-whatsapp-ycloud.md) para el caso de Tinkay Floristería ("Mía").

---

## PLT-011 — Configuración de Empresa y Sistema de Widgets por Rol

**Responsable:** Kleber Toapanta  

### Descripción
Pantalla de configuración del negocio (identidad legal + datos de `PLT-008`) y un sistema de permisos basado en **widgets**: **todas las vistas de las consolas administrativas de todas las aplicaciones deben construirse bajo este único patrón estándar de Widgets** (componentes autocontenidos y reutilizables), donde cada funcionalidad se asigna dinámicamente a roles sin duplicar código entre aplicaciones.

### Reglas de Negocio
1. **Estándar Unificado de Vistas Basado en Widgets ("Un Solo Patrón"):**
   - Todas las consolas de administración de las aplicaciones del ecosistema se rigen obligatoriamente por el **patrón estándar de arquitectura de Widgets**.
   - Cada capacidad administrativa se concibe como un Widget único y autocontenido registrado con clave descriptiva en `seg_widget`.
   - Ninguna aplicación implementa pantallas administrativas ad-hoc fuera de este estándar; la funcionalidad es única y común, adaptando únicamente los estilos visuales (paleta de colores/tema) de cada marca.
2. **Estándar Interactivo de DataGrids y Tablas de Datos en Widgets:**
   - Todo widget que despliegue tablas o listas de datos (ej. `auditoria`, `gestion_usuarios`, catálogos, pedidos, transacciones o cualquier listado tabulado) debe incorporar obligatoriamente un **DataGrid enriquecido** que implementa la **Estrategia de Doble Criterio de Búsqueda y Filtrado (2 Capas)**:
     - **Criterio 1 — Búsqueda y Filtrado Server-Side en Base de Datos (BDD Query Filters):**
       - Formulario / barra de filtros primarios para consultar directamente en la base de datos (PostgreSQL/Supabase) antes de renderizar la tabla.
       - Incluye campos de filtrado específicos según el contexto de la consulta: *Rango de Fechas (Desde / Hasta)*, *Correo Electrónico*, *Nombres y Apellidos*, *Cédula / RUC / Identificación*, *Estado*, *Rol / Perfil*, *Técnico / Abogado Asignado*, *Sucursal / Negocio*, etc.
       - Garantiza paginación eficiente, alto rendimiento y control de volumen de datos traídos desde el servidor.
     - **Criterio 2 — Búsqueda Global Client-Side sobre el Dataset Consultado (In-Memory Grid Search):**
       - Caja de búsqueda en tiempo real habilitada permanentemente en la barra de herramientas del DataGrid.
       - Una vez obtenidos los registros resultantes de la consulta BDD en la vista, evalúa coincidencias instantáneas sobre **la totalidad de las columnas y campos** de los datos retornados en memoria cliente a medida que se tipea, sin realizar llamadas adicionales a la base de datos.
     - **Columnas Ordenables (Sorting):** Ordenamiento ascendente y descendente al hacer clic en los encabezados.
     - **Reordenamiento de Columnas (Drag & Drop):** Permite cambiar el orden visual de las columnas arrastrando los encabezados a la posición deseada.
     - **Agrupamiento Dinámico por Columnas (Drag-to-Group):** Permite arrastrar uno o más encabezados de columna hacia una zona superior de agrupamiento para clasificar y colapsar/expandir filas dinámicamente. Cada encabezado ofrece además un botón `+`/`−` que agrega o quita esa columna del agrupamiento sin arrastrar: el arrastre no es alcanzable con teclado ni cómodo en táctil, así que la misma acción siempre tiene una vía accionable con un clic (ver `ADR-0004`, Decisión 8).
     - **Exportación Nativa a Excel (`.xlsx`) y CSV (`.csv`):** Botones en la barra de herramientas del Grid para exportar el conjunto de datos filtrado o visible directamente a hojas de cálculo.
3. **Identificación legal del negocio:** cada negocio configura su Identificación/NIT, Nombre Comercial y Razón Social, además de los datos de `PLT-008` (redes sociales, canales, términos, locales).
4. **Roles por defecto:** todo negocio tiene como mínimo `SUPERADMIN` (rol de plataforma, no de negocio — ver `PLT-003`), `ADMINISTRADOR`, `CLIENTE`, y puede definir roles adicionales (`OPERADOR`, `TECNICO`, `ABOGADO`, etc.).
5. **Widget Único y Común de Gestión de Usuarios Registrados (`gestion_usuarios`):**
   - Es un componente de software **único y transversal** para todas las aplicaciones. Su diseño y lógica funcional son 100% idénticos en todo el ecosistema, adaptando únicamente la paleta de colores y tema de la app correspondiente.
   - **Comportamiento por Rol:**
     - **Rol `ADMINISTRADOR`:** Ve y gestiona únicamente los usuarios registrados en su propia aplicación (miembros de `seg_membresia` de su negocio).
     - **Rol `SUPERADMIN` de Plataforma:** Desde **cualquier aplicación**, al abrir el widget de gestión de usuarios, posee la facultad de visualizar y administrar a **todos los usuarios registrados de todo el ecosistema** (con selector por negocio o vista consolidada de plataforma).
   - **Gestión Multi-Perfil y Selector por Jerarquía:**
     - Permite asignar o desasignar múltiples perfiles a un usuario en una misma empresa.
     - El selector interactivo de perfiles filtra dinámicamente el catálogo de perfiles, mostrando **exclusivamente los perfiles con jerarquía igual o menor** a la jerarquía máxima que ostenta el usuario gestor autenticado (`PLT-003` regla 4).
6. **Widget de Gobernanza de Permisos (`configuracion_permisos` - Exclusivo `SUPERADMIN`):**
   - La asignación dinámica de widgets por perfil en `seg_rol_widget` se realiza mediante el widget especializado `configuracion_permisos`.
   - **Facultad Exclusiva:** **Únicamente el `SUPERADMIN`** puede acceder a este widget para marcar/desmarcar qué widgets están autorizados para cada perfil (`PLT-003` regla 1). Los Administradores locales no ven ni pueden acceder a este widget de gobernanza.
7. **Widget Único y Común de Emisión de Notificaciones (`emision_notificaciones`):**
   - Componente administrativo transversal registrado en `seg_widget` que permite a los Administradores de negocio y SuperAdmins redactar y despachar comunicaciones masivas o dirigidas (`PLT-013`).
   - Incorpora la matriz de segmentación de audiencia (`TODOS`, `POR_ROL`, `POR_USUARIOS`), selección multicanal (`IN_APP`, `EMAIL`, `PUSH`) y el **Editor WYSIWYG de Texto Enriquecido (HTML)** con barra de herramientas completa (estilos de texto, listas, colores, tablas, hipervínculos, imágenes, variables dinámicas) y conmutación transparente a modo de edición/visualización **Markdown (`.md`)** y **Live Preview**.
8. **Agrupamiento Estructurado de Widgets por Sección/Navegación según Rol:**
   - Cada widget registrado en `seg_widget` posee una categoría de sección (`wdg_categoria`): `INICIO`, `MI_CUENTA`, `PANEL_PROFESIONAL`, `CONSOLA_ADMINISTRATIVA`.
   - **Distribución Estándar de Widgets por Rol Activo:**
     - **Rol `CLIENTE`:**
       - *Sección "Inicio" (Dashboard Principal):* Mis Trámites / Servicios | Chat Buddie (`PLT-004`) | Documentos | Productos/Planes (`PLT-009`).
       - *Sección "Mi Cuenta":* Mi Perfil | Historial de Accesos (`PLT-018`) | Datos de Facturación (`PLT-006`) | Preferencias de Notificaciones (`PLT-013`) | Baja de Cuenta (`PLT-012`).
     - **Rol `SOCIO` / `PROFESIONAL` (`ABOGADO` / `TECNICO`):**
       - *Sección "Panel Profesional":* Causas / Servicios Asignados | Expedientes & Evidencias (`PLT-016`) | Citas Programadas | Calificaciones & Reputación (`PLT-015`) | Mis Honorarios / Cobros.
     - **Rol `ADMINISTRADOR` / `SUPERADMIN`:**
       - *Sección "Consola Administrativa":* Gestión de Usuarios (`gestion_usuarios`), Configuración del Negocio (`configuracion_negocio`), Auditoría (`auditoria`), Emisión de Notificaciones (`emision_notificaciones`), Gobernanza de Permisos (`configuracion_permisos`), Aprobación de Socios.
9. **SuperAdmin de plataforma:** `kleber.toapanta.ch@gmail.com` y `jesus251296@gmail.com` son `SUPERADMIN` en los 4 negocios desde su primer inicio de sesión — no requiere asignación manual y posee acceso universal a todos los widgets en todas las apps.
10. **Edición de Título y Descripción de Widget por Administradores y Limpieza Visual:**
    - Los usuarios con rol `ADMINISTRADOR` o `SUPERADMIN` disponen de una opción de edición interactiva (botón de lápiz `Pencil`) en las tarjetas de accesos de los paneles (`Administrar`, `Mi Cuenta`, `Configuración`).
    - Al activar la edición, pueden definir un **Título** y **Descripción (subtítulo)** personalizados para cada widget individual.
    - Dicha modificación se guarda por widget y se aplica de forma **global e inmediata a todos los perfiles** de usuario que visualicen dicho widget.
    - Se elimina permanentemente el texto repetitivo `"Abrir Módulo"`, `"Abrir widget"` o `"Abrir"` del pie de las tarjetas, sustituyéndolo por una maquetación limpia con indicador sutil de dirección (`ChevronRight`).
11. **Personalización Administrativa de Ícono de Aplicación y Exigencia de MFA por Inactividad (`ModalEditarWidget.tsx`):**
    - **Edición de Ícono de Aplicación:** El modal de edición de widget permite seleccionar un ícono de la librería oficial (`lucide-react`) para personalizar la apariencia visual de la tarjeta.
    - **Requerimiento de MFA por Inactividad:** Permite configurar si la apertura del widget exige verificación MFA TOTP y definir su periodo de validez por inactividad (ej. 5 min, 15 min, 30 min, 1 hora o Exigir Siempre 0 min). Tras este tiempo de inactividad, se vuelve a solicitar la confirmación de 6 dígitos.
12. **Patrón Responsive Mobile-First para Botones de Acción e Inputs (`.btn-responsive-accion` & `.btn-texto-responsive`):**
    - **Botones de Acción en Móviles:** En pantallas `<640px`, los botones de acción en formularios compactos (subir foto, eliminar ítem, agregar correos) conmutan a **Solo Ícono** (con `<span className="btn-texto-responsive">` oculto), optimizando el ancho utilizable.
    - **Protección contra Traslape en Inputs:** Inputs con badges flotantes (ej. `[🛡️ Verificado]`) llevan `paddingRight: 110px+` y `text-overflow: ellipsis` para prevenir superposición de texto en móviles.
    - **Selectores de Código de País en 1 Sola Fila:** Los selectores de código telefónico (ej. `+593` Ecuador) y el campo numérico se maquetan dentro de un contenedor flex al 100% con ancho compacto (`width: 125px`), impidiendo saltos de línea a 2 filas en móviles.
13. **Deduplicación por Clave de Widget e Identificación Físico-Técnica (`rutaFisica`):**
    - **Deduplicación Estricta:** Se eliminan duplicados tanto a nivel de inicialización en inventario (`WIDGETS_INVENTARIO_INICIALES`) como en lectura de BDD (`Set` / `Map` por `clave`), asegurando que ningún widget se renderice dos veces dentro del mismo panel o perfil.
    - **Ruta Físico-Técnica:** Cada tarjeta de widget en la matriz de configuración expone un badge legible (`<code>`) con la ubicación del archivo del componente (ej. `/notificaciones/EmisionNotificacionesWidget.tsx`, `/identidad/FormularioPerfil.tsx`), facilitando la depuración e inspección a administradores y desarrolladores.
14. **Reorganización Gráfica Inter-Panel (Mover vs. Duplicar), Reordenamiento Posicional Interno y Bloque de Disponibles Sin Asignar:**
    - **Reorganización Inter-Panel (Modal `[⇄ Transferir]`):** Permite transferir gráficamente un widget de un panel a otro mediante un modal interactivo que consulta:
      - *Acción:* `⇄ Mover (Quitar de Origen)` (opción **por defecto**) vs `📋 Duplicar (Mantener en Origen)`.
      - *Panel Destino:* Selector desplegable de paneles receptores autorizados.
    - **Reordenamiento Posicional Interno (`Posición #1, #2...`):** Cada tarjeta dispone de controles direccionales rápidos (`[←]` / `[→]`) para desplazar la posición ordinal del widget dentro del mismo panel.
    - **Bloque Destacado "📦 Widgets Disponibles Sin Asignar":** Sección dinámica situada al final de la matriz que agrupa todos los widgets del inventario maestro que **no están asignados a ningún panel** para el perfil activo, incluyendo un selector rápido `[+ Asignar a Panel...]` para su vinculación directa con un solo clic.
15. **Persistencia Dinámica en `localStorage` & Supabase por Negocio (`tranqi_paneles_sidebar_${negocio}`):**
    - **Guardado Inmediato de Estado:** Toda creación de nuevos paneles (ej. *"Herramientas"*), reordenamiento o transferencia de widgets se guarda de forma persistente en `localStorage` y en la base de datos Supabase por negocio.
    - **Restauración al Refrescar (F5):** Garantiza que al recargar la ventana del navegador (`F5`), los paneles personalizados creados por administradores y la distribución de widgets permanezcan intactos.
16. **Arrastre Gráfico HTML5 Drag & Drop (Web Desktop) y Configuración de Íconos de Sidebar:**
    - **Arrastre Gráfico HTML5:** Permite arrastrar libremente tarjetas de widgets (`draggable={true}`) entre paneles o desde la sección *"Widgets Disponibles"* hacia cualquier panel objetivo, destacando visualmente la zona contenedora (`Drop Zone`) con indicador violeta y etiqueta flotante `[📥 Soltar aquí para transferir a {Panel}]`.
    - **Selector de Ícono para el Sidebar:** El modal de creación y edición de paneles incluye un catálogo gráfico de íconos de la librería `lucide-react` (`Home`, `User`, `Settings`, `Shield`, `Sliders`, `Wrench`, `Folder`, `Building`, `Briefcase`, `Bell`, `Database`, `Activity`, `Globe`, `Sparkles`, `Lock`, `KeyRound`, `CheckSquare`, `Terminal`, `Zap`, `Eye`, `Search`, `Pencil`, `LogOut`, `LogIn`, `Forward`, `Inbox`, `Layers`, `LayoutGrid`, `PanelLeft`).
    - **Edición Rápida en Encabezado de Panel (`[⚙️ Configurar Ícono]`):** Cada panel en la matriz de administración expone un botón dedicado para actualizar su nombre, ruta, descripción, requerimiento de MFA TOTP e ícono representativo de la barra de navegación lateral.
17. **Construcción Dinámica de Menú Sidebar por Perfil, Visibilidad de Paneles Vacíos, Vista Combinada SuperAdmin y Modal de Confirmación de Salida (`NavegacionSidebar.tsx` & `BotonCerrarSesion.tsx`):**
    - **Botón Directo `[⚙️ Ícono & Visibilidad]` en Encabezado de Panel:** Cada tarjeta de panel en la consola de administración expone el ícono dinámico representativo y un botón dedicado en su encabezado para abrir el selector gráfico de íconos del sidebar y configurar su visibilidad.
    - **Vista Combinada Total para SuperAdmin:** El rol `SUPERADMIN` visualiza la **unión completa de todos los paneles y widgets asignados a través de todos los perfiles**, permitiendo una supervisión global sin restricciones de perfil individual.
    - **Distintivo Permanente de Rol Activo:** El distintivo de visualización activa (ej. `Rol Activo (cliente)`, `SuperAdmin (administrador)`) se muestra **de forma permanente en la tarjeta inferior de todos los usuarios** en la barra lateral.
    - **Control Configurable de Visibilidad (`mostrarSinWidgets`):** Los administradores pueden activar o desactivar desde la consola de perfiles si un panel sin módulos asignados debe mostrarse en el sidebar (`👁️ Mostrar este panel en el sidebar aunque no tenga widgets asignados`). Si se desactiva (`false`), el panel se oculta 100% para ese perfil.
    - **Agrupamiento 'Próximamente' y Posición del Cierre de Sesión:** Los paneles sin widgets habilitados se agrupan ordenadamente en una sección separada `"Próximamente"`. **El botón 'Cerrar sesión' se garantiza de forma estricta al final absoluto de la barra lateral**, después de todos los paneles activos y de la sección 'Próximamente'.
    - **Modal Interactivo de Confirmación:** Al hacer clic en 'Cerrar sesión', se despliega un diálogo emergente de confirmación `[🚪 Confirmar Cierre de Sesión]` antes de destruir la sesión con Supabase Auth y redirigir al login.
18. **Flujo Directo de Incorporación para Equipo Jurídico / Registro de Abogados (`intencion=abogado` & `destino=/panel/solicitud-socio`):**
    - **Preservación de Intención en Google OAuth & Formularios:** Cuando un profesional inicia su registro o inicio de sesión desde el enlace *"Únete al equipo Jurídico"*, la intención `intencion=abogado` y el destino `/panel/solicitud-socio` se preservan intactos a través de las cookies de sesión y los parámetros de callback de OAuth.
    - **Pantalla de Bienvenida Adaptada:** La pantalla de onboarding `/bienvenida` reconoce automáticamente la intención del abogado desplegando un saludo personalizado (`¡Bienvenido(a), Doctor(a)!`).
    - **Redirección Directa al Formulario de Socio:** Tras confirmar los nombres y apellidos, la plataforma redirige directamente al formulario de registro profesional (`/panel/solicitud-socio`), activando automáticamente el modo de rol Abogado sin desviarlo al tablero genérico de cliente.
19. **Formulario de Registro de Socio Abogado Mejorado (`FormularioSolicitudSocio.tsx`):**
    - **Placeholder de Teléfono Corregido:** Corregido el placeholder de teléfono a un formato válido móvil (`ej. 099 123 4567 o +593 99 123 4567`) evitando mostrar la dirección de correo del usuario.
    - **Editor HTML Enriquecido:** Se incluyó un editor Rich Text en formato HTML con barra de herramientas (`Negrita`, `Cursiva`, `Subrayado`, `Viñetas`, `Encabezado h3`, `Enlace` y conmutación a `Código HTML`) para la reseña profesional.
    - **Controles Multiselección con Opción 'Otros' (Editable):** Selectores desplegables adaptables a Web y Móvil con filtro de búsqueda en vivo y opción `✨ Añadir otra especialidad / ubicación...` para agregar entradas personalizadas.
    - **Enlace Oficial de SENESCYT:** Actualizado el enlace oficial de verificación de títulos a `https://cdn.ecuadorlegalonline.com/modulo/senescyt/consulta-de-titulos.htm`.
    - **Términos de Servicio & Autorización de Verificación LOPDP:** Reemplazada la casilla manual por un bloque formal de aceptación de Términos de Servicio y Autorización expresa para consultar registros en SENESCYT y Foro de Abogados conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP).
20. **Ciclo de Vida Dinámico de la Solicitud de Socio Abogado (`/panel/solicitud-socio`):**
    - **Acceso Continuo a Solicitudes Incompletas:** Si un usuario registrado tiene una solicitud en curso (o sin enviar), el widget de solicitud permanece activo en su panel y menú lateral para retomar y completar el proceso en cualquier momento.
    - **Edición y Envío de Actualizaciones:** Si la solicitud ya fue enviada (estado `enviada` o `en_revision`), el formulario prellena automáticamente toda la información (cédula, universidad, teléfono, especialidades, provincias y experiencia) permitiendo al usuario realizar modificaciones o adjuntar nuevos archivos/fotos y enviar la actualización (`Guardar Cambios y Enviar Actualización`).
    - **Ocultamiento Automático tras Aprobación:** Cuando la solicitud es APROBADA (`aceptada`), la plataforma desactiva/oculta automáticamente el widget de postulación del panel y sidebar, y despliega una tarjeta de confirmación de acreditación exitosa como Socio Abogado.
21. **Diseño Visual Premium del Botón de Registro de Abogados (`FormularioRegistro.tsx`):**
    - **Estilo de Botón Primario Unificado:** Se actualizó el botón de envío del formulario de registro reemplazando el estilo gris básico del navegador por un botón primario con degradado morado de marca (`linear-gradient(135deg, #5000BA 0%, #3B0088 100%)`), esquinas redondeadas (`10px`), elevación con sombra difusa (`box-shadow`), tipografía en negrita (`700`), respuesta táctil y texto destacado con ícono legal (`⚖️ Registrarme como Abogado`).
22. **Ajuste Interactivo de Foto de Perfil & Cobertura Geográfica Nacional (`FormularioSolicitudSocio.tsx`):**
    - **Restricción Estricta de Formatos de Imagen:** El campo de foto de perfil valida y admite exclusivamente formatos de imagen (`JPG`, `PNG`, `WEBP`) rechazando PDFs u otros documentos.
    - **Recortador & Posicionador de Foto en Tiempo Real con Soporte Táctil/Mouse:** Se incorporó un widget interactivo de recorte que despliega una tarjeta de perfil profesional en verde esmeralda idéntica a la vista pública de la red. Soporta arrastre directo con el mouse/dedo (`cursor: grab/grabbing`), controles deslizantes de Zoom (`0.5x` a `3.0x`), movimiento X/Y, botón de reset y procesador canvas `[✂️ Aplicar Recorte]`.
    - **Explicación & Opción 'Todo el Ecuador' en Cobertura Geográfica:** La sección incluye una aclaración guiada sobre la selección de ubicaciones y la opción destacada `🇪🇨 Todo el Ecuador (Cobertura Nacional)` que activa automáticamente la representación territorial nacional.
23. **Corrección de Restricción BDD, Bloqueo de Envío, Edición de Imágenes & Textos Dropzone (`acciones.ts`, `FormularioSolicitudSocio.tsx`, `GestionTerminosConsentimientosWidget.tsx`):**
    - **Resolución de Restricción CHECK BDD (`trq_documento_socio_dcs_tipo_check`):** Se mapean de forma segura los tipos de archivos personalizados a los valores admitidos por PostgreSQL (`'titulo'`, `'matricula'`, `'cedula'`, `'otro'`), eliminando el fallo de restricción en la base de datos.
    - **Habilitación Estricta del Botón de Envío:** El botón de envío de la solicitud se mantiene deshabilitado (`disabled={!declaracion}`) con atenuación visual (`opacity: 0.55`) y mensaje explicativo `🔒 Acepta los Términos LOPDP para Enviar Solicitud` hasta que el usuario marque activamente la casilla de aceptación.
    - **Controles de Tamaño de Imagen en Editor HTML:** Se agregaron botones de dimensionamiento rápido (`25%`, `50%`, `75%`, `100%`) en la barra de herramientas del editor rich text para ajustar el ancho de imágenes pegadas o insertadas.
    - **Corrección de Leyendas en Cajas Dropzone:** Se corrigieron los mensajes de carga para mostrar `Seleccionar o arrastrar archivos` en los campos de Título Universitario y Hojas de Vida (CV), reservando la mención de `fotografía de perfil` exclusivamente para la foto del abogado.
24. **Sanetización de Nombres de Archivos para Supabase Storage / S3 Key Constraints (`esquema.ts`, `FormularioSolicitudSocio.tsx`, `SubirDocumentoRevision.tsx`):**
    - **Normalización y Limpieza Automática de Nombres (`sanearNombreArchivo`):** Se resuelve la falla HTTP 400 Bad Request (`Invalid key`) al subir documentos o imágenes que contienen caracteres especiales (como virgulillas `~`, espacios, acentos, diacríticos y símbolos especiales). La función normaliza acentos NFD (ej. `á` -> `a`, `ñ` -> `n`) y reemplaza caracteres no alfanuméricos por guiones bajos `_`, garantizando claves de almacenamiento 100% compatibles con Supabase Storage keys (S3).
25. **Verificación Criptográfica de MFA TOTP en Servidor / Prevención de Códigos Cruzados (`acciones.ts`, `FormularioPerfilAbogado.tsx`):**
    - **Validación Criptográfica RFC 6238 HMAC-SHA1 (`verificarCodigoTotpUsuario`):** Se eliminó la validación sintáctica cliente basada en longitud (`length >= 6`). La plataforma valida el token de 6 dígitos en el servidor contra la clave secreta Base32 asignada exclusivamente a la cuenta en sesión actual.
26. **Edición Completa del Perfil Profesional de Abogado en Todas sus Instancias (`FormularioPerfilAbogado.tsx`, `FormularioSolicitudSocio.tsx`, `acciones.ts`):**
    - **Habilitación de Edición de Todos los Parámetros:** Al autenticar el acceso con MFA en `/panel/cuenta` (widget `perfil_abogado`) o en `/panel/perfil-abogado`, la plataforma despliega el formulario completo de edición profesional (`FormularioSolicitudSocio`) precargado con todos los datos registrados del socio (foto con recortador zoom, cédula, universidad, año de graduación, años de experiencia, resumen en editor Rich Text HTML, especialidades, provincias de cobertura y experiencia laboral).
    - **Actualización de Solicitudes y Perfiles Aprobados:** Se modificó la Server Action `enviarSolicitudSocio` para permitir que un socio cuya solicitud se encuentre en estado `aceptada` pueda actualizar continuamente su perfil profesional preservando su estado de aprobación y sincronizando sus datos con la tabla `trq_abogado` y `seg_usuario`.
28. **Carga Autenticada de Solicitudes de Socios en Consola Administrativa (`obtenerListaSolicitudesSociosAction`, `PanelAdministrarModular.tsx`):**
    - **Resolución de Bloqueo RLS en Cliente (`AprobacionSociosWidget`):** Se reemplazó la consulta cliente directa a Supabase por la Server Action `obtenerListaSolicitudesSociosAction()`, ejecutada en el contexto del servidor. Esto resuelve el vaciado de lista provocado por RLS cuando el token JWT del navegador está en nivel AAL1, mostrando correctamente todas las solicitudes de socios postulantes (ej. la solicitud de Carolina Colcha).
34. **Gobernanza Estricta de Paneles por Mínimo 1 Widget & Consola Unificada de SuperAdmin (`NavegacionSidebar.tsx`, `app/panel/page.tsx`):**
    - **Visibilidad Estricta de Paneles (Sidebar):** `NavegacionSidebar.tsx` condiciona la visibilidad de cualquier panel (excepto los núcleos `Inicio` y `Mi cuenta`) a la existencia de **al menos 1 widget asignado** (`(widgetsPorPanel[panelId] || []).length > 0`) para el perfil activo. Si un panel carece de widgets asignados en la matriz BDD/local, se oculta automáticamente del menú lateral.
    - **Consola Master Unificada SuperAdmin:** Para el perfil `SUPERADMIN`, el menú sidebar se restringe a `Inicio` y `Mi cuenta`, desplegando en la pantalla principal de Inicio (`/panel`) los 16 módulos operativos del ecosistema organizados en categorías (`PanelSuperAdmin`), garantizando acceso directo sin navegación redundante por subpaneles.
35. **Resolución de Bloqueo RLS de Solicitudes de Socios para SuperAdmin (`trq_fn_listar_solicitudes_admin`, `acciones.ts`, `20260811000001_fix_superadmin_mfa_bypass_rls.sql`):**
    - **RPC Security Definer & Bypass MFA RLS:** Se creó la función PostgreSQL `trq_fn_listar_solicitudes_admin()` con `SECURITY DEFINER` y se actualizó `trq_fn_es_admin_mfa_verificado()` para otorgar acceso inmediato al perfil `SUPERADMIN` sin requerir claim JWT `aal2`. La Server Action `obtenerListaSolicitudesSociosAction()` ejecuta la función RPC con fallback administrativo, garantizando que la consola de SuperAdmin cargue y despliegue el 100% de las solicitudes de socios postulantes en el ecosistema.
36. **Funcionalidades de Eliminación Total & Reset del Sistema para Pruebas desde Cero (`seg_fn_superadmin_eliminar_usuario`, `seg_fn_superadmin_resetear_sistema`, `20260811000003_superadmin_eliminar_y_resetear.sql`, `20260814000001_fix_reset_and_delete_fk_constraints.sql`):**
    - **Purga Individual en Cascada (`eliminarUsuarioSuperAdminAction`):** Habilita al SuperAdmin la eliminación permanente de cualquier cuenta de usuario objetivo (borrando sus registros en `trq_abogado`, `trq_solicitud_socio`, `seg_membresia`, `seg_usuario` y `auth.users`), liberando la cuenta para pruebas limpias con clave foránea `ON DELETE CASCADE`.
    - **Reset Master del Sistema (`resetearSistemaSuperAdminAction`):** Implementa el botón *"🔴 Resetear Sistema (Prueba desde Cero)"* en el encabezado del directorio para purgar masivamente todos los usuarios de prueba, perfiles asignados, registros operacionales de abogados y solicitudes postulantes, preservando únicamente la identidad maestra del SuperAdmin (`kleber.toapanta.ch@gmail.com`).
37. **Widget Universal de Autogestión "Baja de Cuenta / Eliminar mi Cuenta" (`PanelCuentaModular.tsx`, `EliminarCuenta.tsx`):**
    - **Disponibilidad LOPDP por Defecto para Todos los Roles:** Se integró el identificador de widget `baja_cuenta` (`peligro`) en los presets por defecto de `/panel/cuenta` para **todos los perfiles** (`CLIENTE`, `OPERADOR`, `ABOGADO`, `ADMINISTRADOR`, `SUPERADMIN`), permitiendo la autogestión directa de cualquier usuario mediante la confirmación tipeada `"ELIMINAR"`.
    - **Soporte Deep-Linking:** Habilitado el acceso directo por URL mediante los parámetros `?widget=peligro`, `?widget=baja_cuenta` o `?widget=eliminar_cuenta`.
38. **Resolución de Conflicto de Solicitud de Socio & Despacho Automático Multicanal (`FormularioSolicitudSocio.tsx`, `acciones.ts`, `almacen.ts`):**
    - **Resolución de Error Duplicate Key (`trq_solicitud_materia_sma_solicitud_id_sma_materia_id_key`):** Se aseguró la deduplicación de arrays (`Set`) para materias y provincias y el uso de `crearClienteAdmin()` para la limpieza de relaciones relacionales, garantizando escrituras de solicitudes libres de bloqueos RLS.
    - **Redirección Clara a Inicio:** Al enviar exitosamente la solicitud, el formulario alerta la confirmación y redirige automáticamente al usuario al menú principal (`/panel`).
39. **Conmutador "Ver Como" Restringido a Perfiles Asignados (`apps/tranqi-web/app/panel/cuenta/page.tsx`, `SelectorRolActivo.tsx`):**
    - **Aislamiento Estricto de Roles:** El widget *"Ver Como"* en `/panel/cuenta` presenta de manera exclusiva los perfiles que el usuario autenticado tiene asignados activamente en su membresía (`CLIENTE`, `OPERADOR`, etc.), previniendo que usuarios con roles específicos vean conmutadores hacia perfiles no autorizados.
    - **Bypass de SuperAdmin:** La cuenta maestra `SUPERADMIN` mantiene la visualización de todos los perfiles de la plataforma para fines de auditoría y pruebas.
40. **Notificaciones Multicanal Automáticas a Staff en Registro y Solicitudes (`notificar-usuario.ts`, `socios/acciones.ts`):**
    - **Notificación por Nuevo Usuario Registrado:** Al registrarse un usuario (vía correo o Google OAuth), se despachan automáticamente notificaciones multicanal (`IN_APP`, `PUSH` y `EMAIL`) a todos los `OPERADOR`, `ADMINISTRADOR` y `SUPERADMIN` con enlace directo `/panel/usuarios?buscar=...` a los datos del nuevo miembro.
    - **Notificación por Solicitud de Socio Abogado:** Al postularse o actualizar una solicitud de socio, se despachan notificaciones multicanal con enlace directo de revisión a `/panel/socios` para que el equipo administrativo audite y decida la solicitud.
41. **Alineación de Permisos por Widget Asignado & Reporte Integral de Gobernanza (`AdministracionPerfilesWidget.tsx`, `api/notificaciones/route.ts`):**
    - **Acceso Autorizado por Widget Asignado:** Todo usuario con rol `OPERADOR`, `ADMINISTRADOR` o `SUPERADMIN` que tenga un widget en su panel (ej. *Emisión de Notificaciones Multicanal* en `/panel/herramientas`) tiene plenos derechos para emitir y utilizar las acciones del módulo sin bloqueos innecesarios de API.
    - **Pestaña de Reporte Integral de Gobernanza:** Se implementó en `AdministracionPerfilesWidget` una vista consolidada que relaciona cada **Perfil** (jerarquía 1-100), sus **Paneles de Navegación**, los **Widgets Asignados** y los **Usuarios Reales Vinculados** desde la base de datos.
    - **Herramientas de Exportación y Compartición:** Botones integrados para:
      - 📋 **Copiar Reporte:** Genera y copia un informe estructurado en formato Markdown.
      - 📥 **Exportar CSV:** Descarga la matriz completa en hoja de cálculo CSV / Excel.
      - 🖨️ **Imprimir / Guardar PDF:** Vista lista para imprimir directamente desde el navegador.
42. **Flujo de Incorporación Profesional, Repositorio Común de Archivos & Bienvenida Post-Registro (`FormularioSolicitudSocio.tsx`, `esquema.ts`, `GestionTerminosConsentimientosWidget.tsx`):**
    - **Pantalla Informativa de Beneficios & Términos Preliminares Editables:** Previo a la captura de datos, el postulante visualiza las ventajas competitivas de unirse al equipo jurídico (red nacional, expedientes cifrados pgcrypto, liquidación de honorarios) con un texto introductorio editable respaldado en la configuración centralizada de consentimientos (`incorporacion_red`).
    - **Opción 'No tengo experiencia laboral' (Primera Oportunidad):** Se integró una casilla dedicada para graduados noveles o profesionales sin trayectoria previa, eximiendo la obligatoriedad de registrar empleos anteriores y etiquetando su perfil de manera transparente.
    - **Repositorio Común y Organización de Documentos por Concepto:** Convención jerárquica en Supabase Storage (`{negocio}/{usuario_id}/{concepto}/{referencia_id}/{tipo}-{uuid}-{nombre}`) que categoriza y ordena los archivos de registro, drive personal, trámites, análisis y contratos.
    - **Pantalla de Bienvenida Post-Registro y Seguimiento:** Al completar el formulario, el usuario es guiado a una pantalla de bienvenida que desglosa las etapas de evaluación (recepción, verificación SENESCYT/Foro, activación) y ofrece navegación fluida al menú de cliente mientras se audita su solicitud.
43. **Consola Unificada de Configuración de Términos, Contratos & Beneficios (`GestionTerminosConsentimientosWidget.tsx`, `PanelAdministrarModular.tsx`, `AdministracionPerfilesWidget.tsx`):**
    - **Pilar Tripartito de Gestión Legal:** Integración en un solo widget interactivo de las tres áreas clave de gobernanza textual y legal:
      1. *📜 Términos y Condiciones / LOPDP:* Notificaciones, WhatsApp opt-in, empleo/reclutamiento, contratación de servicios legales y solicitud de socio.
      2. *🤝 Beneficios de Red:* Textos preliminares e incentivos formativos para postulantes.
      3. *⚖️ Contratos de Sociedad & Prestación de Servicios:* Plantilla oficial con variables dinámicas (`{{nombre_completo}}`, `{{cedula}}`, `{{negocio}}`).
    - **Asignación Universal a Operadores y Administradores:** Módulo registrado y habilitado en los presets de navegación tanto para perfiles `OPERADOR` como para `ADMINISTRADOR` y `SUPERADMIN` en todas las apps del ecosistema.
    - **Editor Visual & Live Preview:** Modos de conmutación ágiles entre Editor Markdown con inserción asistida de variables dinámicas e interpolación en tiempo real para previsualización idéntica al documento final.

















### Criterios de Aceptación (Gherkin)
* **Escenario:** Gestión de usuarios por Administrador de Negocio
  * **Dado que** el `ADMINISTRADOR` de Tinkay abre el widget de Gestión de Usuarios en Tinkay.
  * **Cuando** busca en la lista de usuarios.
  * **Entonces** solo obtiene los usuarios con membresía registrada en Tinkay.
* **Escenario:** Vista global de usuarios por SuperAdmin
  * **Dado que** el `SUPERADMIN` accede al widget de Gestión de Usuarios desde la app de Tranqi.
  * **Cuando** selecciona la opción de filtro "Todos los Negocios".
  * **Entonces** puede visualizar y gestionar los usuarios de Tranqi, FastFix, Tinkay y Margaritas.
* **Escenario:** Interacción avanzada y exportación en DataGrid de Widget
  * **Dado que** un usuario administrativo abre cualquier widget con listados de datos (ej. auditoría o usuarios).
  * **Cuando** arrastra una columna a la zona de agrupamiento y presiona el botón "Exportar a Excel".
  * **Entonces** la tabla agrupa dinámicamente los registros por dicha columna y genera la descarga inmediata del archivo `.xlsx` estructurado.
* **Escenario:** Filtrado en dos capas (Server-Side BDD + Client-Side Multi-columna) en DataGrid
  * **Dado que** un usuario administrativo aplica un filtro por rango de fechas y correo en el formulario de BDD (Criterio 1).
  * **Cuando** el servidor retorna el conjunto de registros filtrados y el usuario escribe un término en la caja de búsqueda global del DataGrid (Criterio 2).
  * **Entonces** la tabla filtra instantáneamente en memoria cliente sobre todas las columnas del dataset consultado sin re-consultar a la base de datos.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1.1 y §9.

---

## PLT-012 — Baja de Cuenta y Derecho al Olvido

**Responsable:** Kleber Toapanta  

### Descripción
Todo usuario registrado puede solicitar, por auto-servicio y sin intervención de soporte, la eliminación de su cuenta e información personal desde su panel. La ejecución real respeta las obligaciones legales de conservación de registros contables/tributarios cuando el usuario ya tiene historial transaccional.

### Reglas de Negocio
1. **Auto-servicio, sin ticket de soporte:** la opción "Eliminar mi cuenta" vive en el panel del usuario (`/panel/cuenta`), accesible en cualquier momento, con un paso de confirmación explícito (no un solo clic) por ser una acción irreversible.
2. **Decisión según historial transaccional (regla central):**
   - **Sin compras ni transacciones registradas:** la cuenta y todos sus datos personales se eliminan de forma **permanente e inmediata** (hard delete) — incluye `auth.users`, `seg_usuario` y `seg_membresia` en cascada.
   - **Con compras o transacciones registradas:** el hard delete **no procede**. El sistema debe **anonimizar** los datos personales identificables (nombre, correo, WhatsApp) y conservar únicamente lo exigido por la normativa contable/tributaria del SRI, desvinculado de la identidad real del usuario.
3. **Fallar cerrado, no silenciosamente mal:** mientras la verificación real de historial transaccional no esté implementada (porque el esquema `comun_facturacion` todavía no existe — ver `PLT-006`), el sistema debe **rechazar explícitamente** la baja con un mensaje claro, nunca ejecutar un hard delete "optimista" que asuma que no hay historial. Ver nota de diseño en la implementación técnica.
4. **Sin retención oculta más allá de lo legal:** ninguna otra tabla o proceso puede quedarse con datos personales identificables de un usuario dado de baja fuera de lo que esta regla permite conservar.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Baja de cuenta sin historial de compras
  * **Dado que** un usuario registrado en Tranqi nunca ha realizado un pago.
  * **Cuando** confirma "Eliminar mi cuenta" desde su panel.
  * **Entonces** su cuenta y todos sus datos personales se eliminan de forma permanente y pierde el acceso de inmediato.
* **Escenario:** Baja de cuenta con historial de compras (una vez exista `comun_facturacion`)
  * **Dado que** un usuario ya realizó al menos un pago registrado.
  * **Cuando** solicita eliminar su cuenta.
  * **Entonces** el sistema anonimiza sus datos personales y conserva el registro transaccional exigido por el SRI, sin vincularlo a su identidad real.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1.3.

---

## PLT-013 — Centro Transversal de Notificaciones y Alertas (In-App, Push, Email y WhatsApp)

**Responsable:** Kleber Toapanta  

### Descripción
Motor unificado de comunicación multicanal y alertas en tiempo real para todos los productos del ecosistema. Proporciona infraestructura automatizada para eventos del sistema y una consola administrativa de emisión masiva y dirigida de notificaciones por empresa.

### Reglas de Negocio
1. **Componente In-App de Notificaciones (Receptor):**
   - Barra superior de todas las aplicaciones con icono de campana e indicador numérico interactivo de notificaciones no leídas.
   - Drawer táctil / modal adaptativo con historial cronológico, filtro por leídas/no leídas y enlaces de acción directa (*deep linking*) hacia la sección del evento.
2. **Infraestructura Multicanal Integrada:**
   - **In-App:** Notificación persistida en base de datos (`comun_notificacion.not_registro`).
   - **Web & Mobile Push:** Alertas push inmediatas enviadas a navegadores (Web Push API - VAPID) y aplicaciones nativas móviles (Capacitor / FCM).
   - **Correo Transaccional (Email):** Envíos por correo electrónico estructurado (HTML responsive / Markdown) para notificaciones formales y comunicados corporativos.
   - **Propuesta / Idea Futura (WhatsApp Business API):** Mensajes operativos de alto valor (estado de entregas, asignación de técnicos/abogados). Se mantiene documentado exclusivamente como propuesta/idea futura; de momento no se realizará ninguna integración operativa con WhatsApp API.
3. **Widget Administrativo de Emisión de Notificaciones (`emision_notificaciones`):**
   - Módulo común registrado en la consola de administración (`PLT-011`) que permite a los Administradores y SuperAdmins redactar y enviar comunicaciones masivas o segmentadas dentro de su negocio activo.
   - **Segmentación Dinámica de Audiencia (Dentro del Negocio):**
     - `TODOS`: Envío a la totalidad de miembros registrados con membresía activa en la empresa.
     - `POR_ROL`: Selección de 1 o más perfiles/roles específicos del negocio (ej. enviar únicamente a usuarios con perfil `TECNICO`, `ABOGADO` o `CLIENTE`).
     - `POR_USUARIOS`: Buscador multi-selección de usuarios específicos pertenecientes al negocio.
   - **Selección Flexible de Canales de Envío:**
     - Selección de 1 o múltiples canales simultáneos: `IN_APP`, `EMAIL`, `PUSH`.
   - **Editor WYSIWYG de Texto Enriquecido (HTML) y Conmutador Markdown (`.md`):**
     - **Modo Editor Visual (WYSIWYG Rich Text Editor):** Incorpora una barra de herramientas completa con controles interactivos para redacción visual enriquecida:
       - *Formato de texto:* Negrita (**B**), Cursiva (*I*), Subrayado (_U_), Tachado (~S~), Familia tipográfica, Tamaño de fuente, Color de fuente y Resaltador de texto.
       - *Párrafo y estructura:* Alineación (Izquierda, Centro, Derecha, Justificado), Encabezados H1-H6, Listas con viñetas y numeradas, Sangría (Aumentar/Disminuir) e Interlineado.
       - *Elementos enriquecidos:* Inserción de tablas con control de filas/columnas, Hipervínculos, Imágenes (carga local/URL), Citas en bloque, Código formateado y Limpiador de formato (*Clear Formatting*).
       - *Asistente y Variables Dinámicas:* Botón selector de variables dinámicas interpolables (`{{nombre_usuario}}`, `{{negocio}}`, `{{perfil}}`, `{{fecha}}`).
     - **Modo Código / Markdown (`.md`):** Pestaña de visualización y edición directa en código **Markdown (`.md`)** o código HTML estructurado, permitiendo insumo o exportación transparente entre ambos formatos.
     - **Modo Vista Previa Live (*Live Preview*):** Renderizado simulado en tiempo real que refleja exactamente cómo visualizará el usuario el contenido en la campana In-App, en pantalla de dispositivo móvil (Push) y en cliente de correo electrónico (Email responsive).
   - **Historial y Métricas de Despacho (Con Medición de Leídas / Ignoradas):**
     - Registro auditado de cada campaña emitida (`not_campana`) almacenando fecha, emisor, audiencia seleccionada, canales activados, total de envíos exitosos y fallidos.
     - **Validación y Métricas de Tasa de Apertura:** El sistema ejecuta el rastreo de notificaciones leídas vs. ignoradas/sin abrir, calculando y actualizando dinámicamente las métricas de porcentaje de apertura (`% leídas`, `% ignoradas`, `% entregadas exitosas` y `% fallidas`).
4. **Despacho Automático de Notificaciones del Sistema:**
   - Además de la emisión manual desde la consola, el motor ejecuta envíos automáticos ante eventos clave:
     - **Notificaciones de Seguridad por Inicio de Sesión (`PLT-018`):** Envío automático por Correo Electrónico (Email) ante cualquier inicio de sesión exitoso o intento fallido de autenticación para todos los usuarios con roles/perfiles distintos a `CLIENTE` (ej. `ABOGADO`, `ADMINISTRADOR`, `TECNICO`). Si el usuario únicamente posee el perfil `CLIENTE`, no recibe correo por logins rutinarios. Adicionalmente, si cualquier usuario posee una sesión activa en algún dispositivo y se registra un inicio de sesión exitoso o intento fallido desde otro dispositivo/IP, el sistema despacha inmediatamente una **alerta de seguridad multicanal (Email + Push / In-App)** advirtiendo del acceso.
     - **Asignación / Revocación de Perfiles (`PLT-003`):** Envío automático por Email y Push al modificar la jerarquía o roles de un usuario.
     - **Lanzamiento de Funcionalidades:** Comunicados masivos de nuevas herramientas en la app.
     - **Alertas Operativas:** Cambios de estado en pedidos (`PLT-009`), citas, facturación (`PLT-006`) o expedientes.
     - **Promociones y Noticias:** Difusión de cupones y boletines informativos del negocio.
5. **Acciones Interactivas en Notificaciones y Gestión de Ciclo de Vida:**
   - **Aceptar (Confirmar Lectura):** Marca la notificación como leída con marca de tiempo precisa (`not_leido_en`), trasladándola inmediatamente a la pestaña de *Historial*.
   - **Posponer Alerta:** Permite al usuario posponer una notificación por lapsos predefinidos (3h, 6h, 12h, 24h) o personalizado en horas. La alerta permanece oculta y se reactiva automáticamente al vencer el tiempo límite (`not_pospuesta_hasta`).
   - **Eliminación Lógica y Pestaña de Eliminadas:** La eliminación de notificaciones es **estrictamente lógica** (`not_detalles->eliminada: true, eliminada_en: ...`). La sección de notificaciones y la campana disponen de una pestaña/filtro dedicado **"🗑️ Eliminadas"** donde el usuario puede consultar sus notificaciones descartadas y **Restaurarlas** cuando lo requiera.
6. **Widget de Monitoreo de Notificaciones por Usuario para Operadores y Administradores (`monitoreo_notificaciones_usuarios`):**
   - Módulo común y protegido en la consola de administración (`/panel/administrar?widget=monitoreo_notificaciones_usuarios` y en la Consola SuperAdmin) que permite a los Operadores y Administradores auditar las notificaciones recibidas por cualquier usuario del negocio.
   - **Métricas y DataGrid Auditado:**
     - KPIs en tiempo real: Total, Pendientes, Confirmadas (Leídas), Pospuestas activas y Eliminadas lógicas.
     - Detalle exhaustivo por notificación: Destinatario (Nombre, Correo, ID), Asunto, Canal, **Fecha exacta de confirmación/lectura**, **Tiempo y fecha límite de pospuesto**, **Estado de eliminación lógica con fecha** y botón de **Restaurar para el Usuario**.
     - Filtros multicriterio por usuario específico, estado, canal y búsqueda libre en tiempo real.
7. **Preferencias del Usuario y Silenciado Temporal:**
   - El usuario puede ajustar en su panel (`/panel/notificaciones`) sus preferencias de recepción por canal (excepto para notificaciones críticas de seguridad o reseteo de clave).
   - **Silenciado por Tiempo (Mute Temporal):** El sistema permite al usuario silenciar las notificaciones por periodos configurables: *Hoy*, *Esta Semana*, *Este Mes* o *Rango Personalizado de Fechas*, reactivando los despachos automáticamente al vencer la vigencia.
8. **Matriz Estricta de Control de Acceso por Perfil:**
   - **SuperAdmin y Administrador de Negocio (`SUPERADMIN`, `ADMINISTRADOR`):** Tienen acceso total a la Consola Transversal de Emisión de Notificaciones (`/panel/emision-notificaciones`), al Widget de Monitoreo de Notificaciones por Usuario (`monitoreo_notificaciones_usuarios`) y a la Bitácora de Despacho.
   - **Operadores (`OPERADOR`, `AUXILIAR`):** Poseen acceso al Monitoreo de Notificaciones por Usuario para brindar soporte y verificar confirmaciones/pospuestos.
   - **Clientes y Roles Operativos (`CLIENTE`, `ABOGADO`, `TECNICO`, etc.):** **No poseen acceso a la consola de emisión ni a herramientas de auditoría global**. Únicamente tienen acceso a su vista propia de notificaciones recibidas, historial, eliminadas y configuración de preferencias (`/panel/notificaciones`).

### Criterios de Aceptación (Gherkin)
* **Escenario:** Usuario pospone una notificación y luego consulta eliminadas
  * **Dado que** un usuario recibe una notificación en su panel o toast en vivo.
  * **Cuando** presiona "Posponer 3h".
  * **Entonces** la notificación se oculta inmediatamente de los pendientes y se programa para volver a mostrarse trascurrido el tiempo.
  * **Y cuando** elimina lógicamente una notificación leída, esta se traslada a la pestaña "Eliminadas", permitiéndole restaurarla en cualquier momento.
* **Escenario:** Operador audita notificaciones de un usuario específico
  * **Dado que** un operador o administrador ingresa a `/panel/administrar?widget=monitoreo_notificaciones_usuarios`.
  * **Cuando** selecciona a un usuario en el filtro desplegable.
  * **Entonces** el sistema lista todas las notificaciones recibidas por dicho usuario con la fecha exacta de confirmación, tiempo de pospuesto y estado de eliminación lógica, permitiendo restaurarla si fue borrada por error.
* **Escenario:** Usuario con rol únicamente de Cliente intenta acceder a la consola de emisión
  * **Dado que** el usuario `kleber.toapanta@satcomla.com` está autenticado únicamente con el perfil `CLIENTE`.
  * **Cuando** ingresa a `/panel` o intenta navegar directamente a `/panel/emision-notificaciones`.
  * **Entonces** el sistema no muestra ningún botón de emisión en su panel y al ingresar a la URL despliega una pantalla de "Acceso Restringido", ofreciéndole un botón directo para consultar sus notificaciones recibidas (`/panel/notificaciones`).
* **Escenario:** Emisión de notificación segmentada por rol usando Editor WYSIWYG HTML
  * **Dado que** el `ADMINISTRADOR` de Tranqi accede al widget `emision_notificaciones`.
  * **Cuando** selecciona la audiencia `POR_ROL` (Perfil `ABOGADO`), redacta el mensaje utilizando la barra de herramientas del Editor WYSIWYG (aplicando negritas, listas e imágenes) y presiona "Enviar Notificación".
  * **Entonces** el sistema convierte y sanitiza el contenido, procesa el envío masivo únicamente a los usuarios con membresía `ABOGADO` en Tranqi y registra la campaña en la bitácora de despacho.
* **Escenario:** Conmutación entre Editor WYSIWYG HTML y Formato Markdown
  * **Dado que** un administrador redacta una notificación en el modo WYSIWYG visual.
  * **Cuando** hace clic en la pestaña "Formato Markdown (.md)".
  * **Entonces** el sistema convierte instantáneamente el contenido HTML formateado a su equivalente exacto en sintaxis Markdown (`.md`) para inspección o edición directa.
* **Escenario:** Vista previa interactiva de notificación Markdown/HTML
  * **Dado que** un administrador redacta una nueva notificación con el editor e inyecta la variable `{{nombre_usuario}}`.
  * **Cuando** conmuta a la pestaña "Vista Previa Live".
  * **Entonces** el sistema renderiza en tiempo real el diseño HTML simétrico al formato que recibirá el usuario en su correo y pantalla.
* **Escenario:** Despacho automático de notificación push y email al modificar perfil
  * **Dado que** un gestor asigna el perfil `TECNICO` a un usuario en FastFix.
  * **Cuando** se completa la transacción en `seg_fn_asignar_rol`.
  * **Entonces** el sistema envía automáticamente una notificación Push al dispositivo del usuario y un Correo informando de su nuevo perfil.

---

## PLT-014 — Motor de Cupones, Descuentos y Promociones

**Responsable:** **Jesus Navarrete**  

### Descripción
Motor centralizado de incentivos comerciales y códigos promocionales para todos los productos del ecosistema que comercialicen bienes o servicios (`PLT-009`).

### Reglas de Negocio
1. **Modalidades de Descuento:**
   - **Monto Fijo ($):** Descuento directo en la moneda local sobre el total.
   - **Porcentaje (%):** Descuento porcentual aplicable al total del carrito o a ítems específicos.
2. **Reglas de Aplicación y Restricciones:**
   - **Vigencia:** Fecha y hora exacta de inicio y fin.
   - **Monto Mínimo:** Restricción opcional de valor mínimo de compra para activar el cupón.
   - **Límites de Uso:** Límite máximo de canjes globales y límite máximo de canjes por usuario (`seg_usuario`).
3. **Aislamiento Multitenant:**
   - Cada cupón pertenece a un negocio específico (`com_negocio`); un código de Tinkay es inválido en FastFix o Tranqi.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Canje exitoso de cupón de descuento por monto mínimo
  * **Dado que** un cliente ingresa un cupón de 10% de descuento en el checkout de Tinkay.
  * **Cuando** el total de su carrito supera el monto mínimo configurado.
  * **Entonces** el sistema aplica el descuento, recalcula el total y registra el uso del cupón.

---

## PLT-015 — Sistema Transversal de Calificaciones, Reseñas y Reputación

**Responsable:** **Jesus Navarrete**  

### Descripción
Módulo unificado para capturar valoraciones (1 a 5 estrellas) y comentarios sobre servicios prestados (FastFix, Tranqi) o productos entregados (Tinkay, Margaritas).

### Reglas de Negocio
1. **Garantía de Cliente / Comprador Verificado (*Verified Purchase*):**
   - Únicamente los usuarios que hayan completado una transacción o servicio real verificado en el sistema pueden emitir una valoración y reseña.
2. **Estructura de la Reseña:**
   - Calificación cuantitativa (1 a 5 estrellas), comentario de texto libre y etiquetas rápidas de calidad (ej. *Puntualidad*, *Excelente acabado*, *Atención amable*).
3. **Moderación y Respuesta Oficial:**
   - Publicación transparente. El Administrador del negocio posee la facultad de emitir una respuesta oficial pública visible debajo de la reseña y reportar contenido ofensivo.
4. **Cálculo de Reputación:**
   - El sistema calcula y actualiza automáticamente el promedio ponderado de calificación y total de reseñas para mostrarlos en las vitrinas públicas del negocio.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Emisión de reseña por comprador verificado
  * **Dado que** un usuario completó un servicio de reparación en FastFix.
  * **Cuando** accede al detalle de su servicio finalizado y envía una calificación de 5 estrellas con comentario.
  * **Entonces** el sistema valida la transacción real, publica la reseña y recalcula la calificación promedio del técnico.

---

## PLT-016 — Gestión de Archivos, Evidencias y Supabase Storage Standard

**Responsable:** Kleber Toapanta  

### Descripción
Estándar centralizado de almacenamiento de objetos, documentos, evidencias y medios digitales en Supabase Storage, estructurado para garantizar organización multitenant, seguridad RLS y persistencia de larga duración.

### Reglas de Negocio
1. **Estructura Jerárquica Obligatoria de Directorios (Storage Hierarchy):**
   Todo archivo u objeto almacenado en Supabase Storage debe estructurarse estrictamente bajo el siguiente patrón de rutas:
   `[bucket]/[codigo_negocio]/[categoria_uso]/[yyyy-mm]/[uuid_archivo].[ext]`
   - `bucket`: Bucket de almacenamiento (`comun-publico` o `comun-privado`).
   - `codigo_negocio`: Identificador del negocio (`TRANQ`, `FFH`, `TNK`, `MRG`, `PLT`).
   - `categoria_uso`: Subcarpeta por propósito (`documentos-legales`, `evidencias-tecnicas`, `catalogo-productos`, `fotos-entrega`, `avatares-perfil`).
   - `yyyy-mm`: Año y mes de carga para optimización de particionamiento y navegación de larga duración.
   - `uuid_archivo`: Nombre único e inmutable (UUID v4) para evitar colisiones y sobrescrituras accidentales.

   *Ejemplo Privado:* `comun-privado/TRANQ/documentos-legales/2026-07/9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d.pdf`  
   *Ejemplo Público:* `comun-publico/TNK/catalogo-productos/2026-07/a1b2c3d4-e5f6-7890-abcd-ef1234567890.jpg`

2. **Tipos de Buckets y Políticas de Seguridad RLS:**
   - **Bucket Público (`comun-publico`):** Diseñado para contenido de vitrina (catálogo `PLT-009`, imágenes de locales `PLT-008`, avatares públicos). Lectura anónima global; escritura restringida a roles autorizados (`ADMINISTRADOR`, `OPERADOR`).
   - **Bucket Privado Cifrado (`comun-privado`):** Diseñado para información sensible o privada (documentos legales de Tranqi, fotografías de inspección técnica de FastFix, comprobantes SRI de `PLT-006`). Lectura y escritura estrictamente protegidas por políticas RLS sobre `storage.objects`. Acceso exclusivo mediante **URLs firmadas de vida corta (máximo 15 minutos)** emitidas tras verificar la propiedad o rol del usuario.
3. **Persistencia de Larga Duración y Ciclo de Vida (Retention & Lifecycle):**
   - **Retención Inalterable:** Archivos con valor legal o tributario (comprobantes SRI, evidencias de causas legales, contratos) se marcan con bandera de retención inalterable para garantizar su disponibilidad por el tiempo exigido por la ley.
   - **Optimización Previa a la Subida:** Toda imagen subida se procesa en cliente/servidor para conversión automática a formato **WebP** y compresión optimizada, reduciendo el consumo de ancho de banda y almacenamiento sin degradar la calidad visual.
   - **Validación Estricta de Formatos y Pesos:** Validación en servidor del tipo MIME y límite de tamaño máximo según la categoría de uso (ej. máx. 5MB para imágenes, 20MB para documentos PDF).

### Criterios de Aceptación (Gherkin)
* **Escenario:** Carga de documento privado en estructura jerárquica
  * **Dado que** un usuario adjunta un PDF de identidad en el portal de Tranqi.
  * **Cuando** se completa la subida a Storage.
  * **Entonces** el archivo se guarda en el bucket `comun-privado/TRANQ/documentos-legales/2026-07/{uuid}.pdf` y solo es accesible mediante URL firmada de vida corta.

---

## PLT-017 — Gestión de Sesiones Activas y Revocación Remota de Dispositivos

**Responsable:** Kleber Toapanta  

### Descripción
Módulo de auditoría de seguridad y control de accesos en el panel del usuario (`/panel/seguridad`) para gestionar dispositivos conectados a su cuenta única (`PLT-001`).

### Reglas de Negocio
1. **Listado de Sesiones Activas:**
   - Visualización clara de todos los dispositivos y navegadores con sesión activa en el ecosistema, incluyendo: navegador, sistema operativo, tipo de dispositivo (móvil / escritorio), dirección IP aproximada y fecha/hora de última actividad.
   - Indicador explícito de "Sesión Actual".
2. **Cierre de Sesión Remoto (Revocación de Tokens):**
   - Opción "Cerrar sesión en otros dispositivos" que revoca de inmediato los refresh tokens en Supabase Auth de las demás sesiones activas, forzando la reautenticación remota sin cerrar la sesión en el dispositivo actual.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Revocación remota de sesiones
  * **Dado que** un usuario nota una sesión activa en un navegador desconocido desde su panel de seguridad.
  * **Cuando** hace clic en "Cerrar sesión en otros dispositivos".
  * **Entonces** el sistema invalida los tokens de los demás dispositivos y solo mantiene activa su sesión actual.

**Estado:** regla 2 (revocación remota de refresh tokens) pendiente. Regla 1 (listado de accesos) tiene un primer building block ya implementado y verificado — ver `PLT-018`, que registra IP/User-Agent en cada login pero todavía no distingue "sesión activa" de "acceso histórico" ni puede revocar tokens.

---

## PLT-018 — Historial de Accesos y Saludo Personalizado

**Responsable:** Kleber Toapanta  

### Descripción
Todo usuario registrado puede ver sus últimos accesos (dispositivo/navegador aproximado y fecha) desde su panel, y el sistema lo saluda de forma distinta según cuánto tiempo pasó desde su visita anterior. Es el primer building block de `PLT-017` — un registro histórico simple, no un listado de sesiones activas ni revocación de tokens (eso sigue pendiente en `PLT-017`).

### Reglas de Negocio
1. **Registro automático en cada inicio de sesión:** cualquier login exitoso (correo/contraseña, confirmación de registro con sesión inmediata, o Google OAuth) e **intentos fallidos de autenticación** (contraseña errónea, OTP vencido o cuenta bloqueada) registran automáticamente una fila con fecha/hora, IP, User-Agent, dispositivo y el estado/motivo del intento.
2. **Visibilidad y Controles del Administrador:** un usuario regular (`CLIENTE`) únicamente puede ver su propio historial de accesos. El `ADMINISTRADOR` de negocio posee una vista consolidada en la consola administrativa para supervisar el historial de **intentos fallidos, logins exitosos, sesiones activas y dispositivos vinculados** de los miembros del negocio para auditoría de seguridad.
3. **Saludo por antigüedad del acceso anterior:** el panel saluda distinto según el tiempo transcurrido desde el penúltimo acceso (mismo día, última semana, último mes, más de un mes) — el primer acceso de una cuenta nueva no dispara un saludo especial (lo cubre la pantalla de bienvenida, `PLT-001` regla 2).
4. **Común a los 4 negocios:** al ser parte de la identidad única del ecosistema, el historial es uno solo por usuario, no uno por negocio en el que tenga membresía.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Saludo distinto en un reingreso el mismo día
  * **Dado que** un usuario inició sesión hace 2 horas y vuelve a entrar ahora.
  * **Cuando** llega a su panel.
  * **Entonces** ve un saludo tipo "Hola de nuevo, {nombre}", no el saludo genérico de primera vez.
* **Escenario:** Historial visible en Mi cuenta
  * **Dado que** un usuario ha iniciado sesión 3 veces desde 2 dispositivos distintos.
  * **Cuando** entra a "Mi cuenta".
  * **Entonces** ve una lista con los 3 accesos, cada uno con una etiqueta de dispositivo legible y su fecha/hora.

**✅ Implementado (2026-07-27)** y verificado de punta a punta contra el proyecto real, en las 4 apps. **Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1.4.

---

## PLT-019 — Reclutamiento, Bolsa de Empleo y Presentación de Equipo ("Nuestro Equipo & Únete al Equipo")

**Responsable:** Kleber Toapanta  

**✅ Implementado (2026-08-05)** y verificado de punta a punta en el ecosistema (esquema `comun_reclutamiento`, migraciones, RLS, notificaciones multicanal y widgets administrativos).

### Descripción
Proporciona la infraestructura unificada para exhibir al equipo de trabajo verificado en la portada de cada negocio y capturar postulaciones continuas de talento (socios profesionales, contratistas, técnicos independientes, repartidores y personal operativo). Integra un motor dinámico de ofertas de empleo en formato Markdown/HTML y un flujo de postulación seguro protegido por autenticación obligatoria y consentimiento de protección de datos.

### Reglas de Negocio
1. **Widget Público "Nuestro Equipo":**
   - Presente en las landings/index de cada aplicación (`TRQ-002`, `FFH-002`, `TNK-002`, `MRG-002`), estilizado según `maqueta-equipo.html`.
   - Se alimenta únicamente de miembros aprobados y verificados (`VISIBLE_PUBLICO = true`) de las tablas del negocio (`trq_abogado`, `ffh_tecnico`, `tnk_personal`, `mrg_personal`).
   - Expone la foto o silueta/iniciales, cargo, provincia/zona de atención, años de experiencia e insignia de título o credencial verificada.
2. **Requisito Obligatorio de Autenticación (`PLT-001`):**
   - Para postular a cualquier vacante o enviar una solicitud de socio/técnico, el usuario **debe estar autenticado obligatoriamente como cliente/usuario base** (`comun_seguridad.seg_usuario`).
   - Si un visitante no autenticado hace clic en "Postular" o "Enviar Solicitud", el sistema despliega el modal de inicio de sesión / registro ultra-fluido (`PLT-001`) y retoma el flujo automáticamente tras autenticarse.
3. **Modalidad Dual de Postulación ("Súmate al Equipo"):**
   - **Ruta A — Solicitud de Socio / Profesional / Contratista:** Formulario estructurado para registro especializado (Abogados en Tranqi, Contratistas y Técnicos en FastFix).
   - **Ruta B — Bolsa de Empleo / Vacantes Dinámicas:** Convocatorias internas administrables (Secretarias, Asistentes Jurídicos, Mensajeros, Repartidores, Floristas, Soporte Operativo).
4. **Administración Dinámica de Vacantes (`gestion_vacantes`):**
   - El Administrador/SuperAdmin gestiona la oferta de empleo desde la consola administrativa.
   - **Campos de Vacante:** Título del cargo, tipo de contrato, estado (`PUBLICADA`, `PAUSADA`, `CERRADA`), fecha de expiración y descripción detallada en formato **Markdown (`.md`) o HTML** mediante editor WYSIWYG.
   - **Switches de Notificación por Vacante:** Cada vacante cuenta con opciones independientes de alerta:
     - `[x] Notificar por Correo Electrónico (Email)` al Administrador ante cada nueva postulación.
     - `[x] Notificar por Alerta Push (Web / Mobile)` al Administrador ante cada nueva postulación.
5. **Términos y Condiciones Legales de Talentos en Markdown (`.md`):**
   - La plataforma incluye un módulo de **Términos y Condiciones de Reclutamiento y Privacidad de Talentos (en Markdown `.md`)**, editable desde la consola (`PLT-008`).
   - El formulario de postulación despliega obligatoriamente la casilla de consentimiento conforme a la Ley Orgánica de Protección de Datos Personales (LOPDP Ecuador):
     - `[x] Autorizo el tratamiento de mis datos personales y almacenamiento de mi Hoja de Vida según los Términos de Talentos.`
6. **Formulario Ágil de Postulación y Subida de Archivos (`PLT-016`):**
   - Datos autocompletados desde el perfil del usuario (`PLT-001`): Nombres, Apellidos, Correo y WhatsApp.
   - **Carga Obligatoria de CV / Hoja de Vida:** Archivo en formato PDF o Word (máx. 10 MB).
   - **Carga Múltiple de Documentos Adjuntos (Límite Estricto):** Subida de certificados, títulos, licencias o fotos (PDF, PNG, JPG, DOCX). Se establece un **límite estricto de máximo 3 documentos adjuntos** por solicitud y un **tamaño máximo acumulado de 10 MB** por archivo.
   - Almacenamiento seguro en Supabase Storage Privado (`comun-privado/[NEGOCIO]/postulaciones/[YYYY-MM]/...`).
7. **Notificación de Confirmación Automática al Postulante y Alerta a Administradores (`PLT-013`):**
   - **Al Postulante:** Tras enviar la postulación, el sistema despacha inmediatamente un correo transaccional de confirmación al candidato vía SMTP propio del negocio (`PLT-008`), indicando que sus documentos fueron recibidos exitosamente.
   - **A los Administradores:** De forma automática e inmediata, el sistema genera y despacha una **notificación Push y un Correo Electrónico (Email)** a todos los usuarios administradores (`ADMINISTRADOR` / `SUPERADMIN`) del negocio notificando la llegada del nuevo postulante con enlace directo a su expediente.
8. **Protección Anti-Spam y Rate Limiting:**
   - Trampa silenciosa **Honeypot** + límite de seguridad de máximo 3 postulaciones por usuario/IP por hora.
9. **Consola Administrativa de Postulaciones (`gestion_postulaciones`):**
   - DataGrid interactivo de 2 capas (`PLT-011`) que lista todas las solicitudes recibidas.
   - Estados de postulación: `NUEVO` (badge destacado), `EN_REVISION`, `ENTREVISTADO`, `APROBADO`, `RECHAZADO`.
   - Visor de candidatos con previsualización/descarga de CV y documentos adjuntos mediante URLs firmadas de vida corta (`PLT-016`).
   - **Aprobación Directa:** Botón para otorgar el perfil o membresía correspondiente al candidato aceptado.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Postulante no autenticado intenta aplicar a una vacante
  * **Dado que** un visitante no registrado examina la bolsa de empleo en la landing de Tranqi y hace clic en "Postular" para Asistente Jurídico.
  * **Cuando** intenta enviar el formulario.
  * **Entonces** el sistema interrumpe la acción solicitando inicio de sesión o registro rápido (`PLT-001`), y una vez autenticado le permite adjuntar su Hoja de Vida y enviar la solicitud.
* **Escenario:** Notificación al Administrador y al Postulante tras recibir una postulación
  * **Dado que** una vacante tiene activado el interruptor de notificación por Email.
  * **Cuando** un usuario autenticado completa su postulación aceptando los Términos en Markdown.
  * **Entonces** el sistema guarda los adjuntos en Supabase Storage, genera la notificación Push e Email al Administrador y despacha un correo de confirmación automática al postulante.
* **Escenario:** Gestión y aprobación de postulante desde la consola administrativa
  * **Dado que** el Administrador accede al widget `gestion_postulaciones` en FastFix.
  * **Cuando** revisa el expediente de un postulante a Técnico, descarga su CV y presiona "Aprobar Postulante".
  * **Entonces** el sistema actualiza el estado a `APROBADO`, habilita su perfil en la empresa (`PLT-003`) y notifica al usuario del resultado favorable.

---

## PLT-020 — Agenda, Disponibilidad, Citas y Consulta Telemática

**Responsable:** Kleber Toapanta  

### Descripción
Motor centralizado y transversal de disponibilidad horaria, franjas recurrentes, excepciones/bloqueos, anti-solape criptográfico/relacional (`btree_gist`), reserva de encuentros y videoconsultas seguras. Aplica a profesionales y técnicos de todos los negocios del ecosistema: Abogados en Tranqi (`TRQ-ABG-004`, `TRQ-CLI-001`), Técnicos e inspectores en FastFix Home (`FFH-TEC-004`) y consultores especializados.

### Reglas de Negocio

1. **Separación Arquitectónica de 2 Capas (Plataforma vs. Negocio):**
   - **Capa Transversal de Plataforma (`comun_agenda`):** Aloja la disponibilidad abstracta y el motor de huecos compartible entre abogados (`tranqi`), técnicos (`fastfix`) o consultores.
     - `age_profesional`: 1 fila por `(agp_usuario_id, agp_negocio)`. Almacena parámetros operativos: `agp_zona_horaria` (IANA string, default `'America/Guayaquil'`, previniendo descalces con Galápagos UTC-6), `agp_duracion_min` (15..240), `agp_holgura_min`, `agp_antelacion_minima_horas`, `agp_horizonte_dias`, `agp_modalidades` (`text[]`), `agp_acepta_derivacion` (boolean para pool de escalado), `agp_configurada_en` (timestamp de onboarding, si es null el profesional no figura disponible: falla cerrado).
     - `age_franja`: Horas operativas recurrentes por día de la semana (`fra_dia_semana` 0..6 donde 0 es Domingo). `fra_hora_inicio` y `fra_hora_fin` se almacenan en `time` local a propósito: "martes de 09:00 a 13:00" es una regla del despacho que sobrevive a husos horarios; la conversión a instantes `timestamptz` se realiza al proyectar los huecos.
     - `age_bloqueo`: Excepciones puntuales (`blq_inicio_en`, `blq_fin_en` en timestamptz, motivo, origen `'manual' | 'audiencia' | 'sincronizado'`).
     - `age_tipo_cita`: Catálogo de tipos de encuentro por negocio (`tci_codigo`, `tci_nombre`, `tci_duracion_min`, `tci_modalidad_permitida`, `tci_producto_id` vinculado a `comun_comercio`, `tci_activo`).
     - `age_reserva`: Ocupación abstracta de un profesional en un rango (`res_inicio_en`, `res_fin_en` NOT NULL, `res_estado` in `'propuesta', 'confirmada', 'cancelada', 'realizada', 'no_asistio'`).
   - **Aislamiento y Privacidad en RLS:** Ningún usuario `authenticated` puede hacer `SELECT` sobre `age_reserva` o `age_bloqueo` ajenos. La disponibilidad de un profesional solo se expone a través de la función RPC `age_fn_huecos_disponibles()`, la cual retorna únicamente franjas libres desprovistas de motivos, nombres de clientes o identificadores de casos.
   - **Capa Especializada de Negocio (`tranqui_legal.trq_cita`, `fastfix_mantenimiento.ffh_visita_tecnica`):** Aloja los datos de dominio específicos: motivo legal, materia, expediente/caso judicial, dictamen, informe de reparación y enlace a la sala de videoconsulta. El vínculo se realiza mediante clave foránea `cit_reserva_id -> age_reserva(res_id)`.

2. **Garantía Estricta de Anti-Solape en Base de Datos (`btree_gist`):**
   - Para prevenir colisiones por concurrencia y citas duplicadas, la tabla `comun_agenda.age_reserva` implementa una restricción de exclusión física inalterable:
     ```sql
     create extension if not exists btree_gist;
     alter table comun_agenda.age_reserva add constraint age_reserva_sin_solape
       exclude using gist (
         res_profesional_id with =,
         tstzrange(res_inicio_en, res_fin_en) with &&
       ) where (res_eliminado_en is null and res_estado in ('propuesta', 'confirmada'));
     ```
   - La base de datos es la única fuente de verdad; ninguna condición de carrera en el frontend o asistente puede provocar solapamiento de horarios. `res_fin_en` es `NOT NULL` obligatorio desde su origen.

3. **Funciones RPC Transaccionales del Motor de Agenda (`comun_agenda`):**
   - `age_fn_huecos_disponibles(profesional_id, desde, hasta, tipo_cita_id)`: Genera los slots disponibles proyectando franjas según `agp_zona_horaria`, restando reservas activas (`propuesta`/`confirmada`), bloqueos y holguras; descartando huecos fuera de la antelación mínima u horizonte máximo. Falla cerrado si `agp_configurada_en` es nulo.
   - `age_fn_configurar_agenda(config jsonb, franjas jsonb)`: Reemplaza atómicamente la configuración del profesional en sesión y sus franjas horarias.
   - `age_fn_bloquear(inicio, fin, motivo)`: Registra bloqueos puntuales en el calendario.

4. **Paquete Compartido de Dominio (`packages/agenda` — `@eco/agenda`):**
   - Concentra el motor de cálculo de huecos, esquemas Zod y validaciones de dominio.
   - Libre de dependencias de `next/*` y de estilos visuales específicos, garantizando portabilidad hacia web, backend y apps nativas Capacitor.

5. **Articulación Comercial Obligatoria con `comun_comercio` (PLT-009 / PLT-014):**
   - **Cita como Producto Facturable:** Toda cita formal es un producto de tipo `SERVICIO` en el catálogo unificado (`com_producto` / `com_variante`), con Base Imponible, tarifa de IVA (15%) y PVP expresado en **centavos enteros de USD** (`05-manejo-monetario-y-valores.md`).
   - **Exoneración por Plan Activo (Suscripción):** Si el cliente posee una suscripción activa (`com_suscripcion.sub_estado = 'ACTIVA'`) en el negocio que incluya consultas (ej. *Plan Jurídico Mensual Tranqi*), el costo es **$0.00** (`cit_modalidad_cobro = 'CUBIERTO_POR_PLAN'`) y la cita se confirma de forma inmediata sin solicitar tarjeta de crédito ni pasar por pasarela.
   - **Cupones de Descuento o Consulta Gratuita (`com_cupon` / `com_cupon_uso`):**
     * Si el usuario aplica un cupón del 100% de descuento (ej. `CONSULTA_GRATIS`, `PRIMERA_CITA`), el saldo es **$0.00** (`cit_modalidad_cobro = 'CUPON_GRATIS'`), consumiendo el cupón y confirmando la reserva.
     * Si el cupón es de descuento parcial (porcentual o monto fijo), se deduce en centavos de la Base Imponible y se cobra únicamente el saldo restante.
   - **Convenios y Billetera B2B2C (`com_convenio_empresa` / `com_billetera`):** Permite subsidios corporativos o copago mediante saldo de billetera virtual.
   - **Pasarela en Línea (Payphone / Paymentez):** Si el monto final liquidado es superior a $0.00, se abre la Cajita de Pagos de Payphone (`com_pasarela_configuracion`). La reserva se mantiene temporalmente como `'propuesta'` por 15 minutos; al validarse la confirmación server-to-server (`/api/confirm`), la Server Action registra el pago en `com_transaccion_pago` y conmuta la cita a `'confirmada'`.

6. **Consulta Rápida con ARIA y Escalado Asistido:**
   - ARIA atiende consultas preliminares y orientación general sin costo (`trq_consulta_rapida`).
   - **Límite Ético y Legal:** El prompt del agente estipula que ARIA orienta pero **no patrocina ni emite dictámenes vinculantes**.
   - **Escalado Asistido:** Cuando la consulta requiere análisis documental, plazos o patrocinio judicial, ARIA clasifica la materia, identifica profesionales habilitados y emite un bloque estructurado de opciones en el chat (`tranqi:opciones`) con tarjetas interactivas de horarios disponibles para agendamiento directo.

7. **Videoconsulta Telemática Segura (Jitsi Meet):**
   - Para citas virtuales, el sistema genera automáticamente un identificador de sala criptográficamente impredecible (`gen_random_uuid()`).
   - No se almacenan URLs públicas en base de datos. El enlace dinámico se compone y entrega exclusivamente a los usuarios autorizados (cliente y profesional asignado) dentro de la ventana de acceso: desde **10 minutos antes** de la hora de inicio hasta **30 minutos después** de la hora de fin.

8. **Despachador Universal de Alertas e Independencia de Infraestructura (Portabilidad Linux / Vercel):**
   - Los recordatorios automáticos de cita (notificaciones a **24 horas** y a **1 hora** previas al encuentro) se diseñan para operar de forma idéntica en cualquier entorno de despliegue, **garantizando portabilidad total si el ecosistema migra de Vercel a servidores Linux propios**:
     - **Idempotencia Transaccional en Base de Datos:** Cada cita posee los campos de control `cit_recordatorio_24h_enviado` y `cit_recordatorio_1h_enviado` (timestamptz). El despachador solo procesa citas con flag nulo en su respectiva ventana temporal y marca el timestamp en la misma transacción. Si el proceso se invoca varias veces seguidas, jamás duplica una alerta.
     - **Lógica de Despacho Desacoplada:** El núcleo del despachador reside en una función de servicio en `packages/notificaciones` y se expone a través de un endpoint HTTP seguro `POST /api/cron/despachador-alertas` protegido con cabecera `Authorization: Bearer CRON_SECRET` (o como script CLI `node scripts/despachar-alertas.mjs`).
     - **Mecanismos de Ejecución Soportados sin Modificar Código:**
       1. *En Vercel (PaaS actual):* Tarea programada en `vercel.json` que dispara una petición HTTP periódica (cada 15 minutos) hacia `/api/cron/despachador-alertas`.
       2. *En Servidor Linux Propio (VPS, Ubuntu/Debian, Docker, Kubernetes):* 
          - Tarea programada en `cron` de Linux (`/etc/cron.d/despachador-alertas`):
            `*/15 * * * * curl -s -X POST -H "Authorization: Bearer $CRON_SECRET" https://app.dominio.com/api/cron/despachador-alertas`
          - Proceso en segundo plano gestionado con `PM2` o contenedor Docker con temporizador interno (`node-cron`).
          - O temporizador nativo `systemd` (`despachador-alertas.timer`).
       3. *En Supabase Nativo:* Tarea periódica con extensión `pg_cron` invocando Edge Function o webhook HTTP vía `pg_net`.
     - **Cero Dependencia de Vendor:** Abandonar Vercel y desplegar en Linux propio requiere únicamente activar la línea de `curl` en el crontab del servidor Linux, sin alterar una sola línea de código fuente del ecosistema.

9. **Widget Universal en Panel Profesional (`citas_programadas`):**
   - Registrado en `seg_widget` bajo la categoría `PANEL_PROFESIONAL` (`PLT-011` regla 8) y sembrado para los roles profesionales de todos los negocios (`ABOGADO` en Tranqi, `TECNICO` en FastFix).

### Criterios de Aceptación (Gherkin)

* **Escenario:** Cliente con Plan Activo agenda cita gratuita
  * **Dado que** un cliente autenticado posee una suscripción activa a un Plan en Tranqi.
  * **Cuando** selecciona un horario disponible con un abogado especialista.
  * **Entonces** el sistema liquida el valor en $0.00 (`CUBIERTO_POR_PLAN`), confirma la reserva inmediatamente en `comun_agenda`, crea la sala de videoconsulta y notifica al abogado sin solicitar pago con tarjeta.

* **Escenario:** Cliente sin plan aplica cupón del 100% de descuento
  * **Dado que** un cliente sin suscripción activa selecciona una consulta de $35.00 e ingresa el cupón `PRIMERA_CONSULTA`.
  * **Cuando** valida el cupón en el checkout.
  * **Entonces** el sistema descuenta los 3500 centavos, registra el uso del cupón en `com_cupon_uso`, aprueba la cita sin pasarela y genera la cita confirmada.

* **Escenario:** Cobro de cita mediante pasarela Payphone
  * **Dado que** un cliente sin plan ni cupón agenda una cita de $35.00 (3500 centavos).
  * **Cuando** se despliega la Cajita de Pagos de Payphone y completa la transacción.
  * **Entonces** el servidor ejecuta la confirmación `/api/confirm` en < 5 minutos, guarda el pago en `com_transaccion_pago`, conmuta la cita a `confirmada` y bloquea definitivamente la franja en `age_reserva`.

* **Escenario:** Prevención de colisión horaria por concurrencia
  * **Dado que** dos clientes intentan reservar exactamente la misma franja de un abogado simultáneamente.
  * **Cuando** ambas peticiones llegan a la base de datos.
  * **Entonces** la primera reserva es aceptada y la segunda es rechazada inmediatamente por la restricción física `age_reserva_sin_solape` (`btree_gist`), impidiendo solapamientos.

* **Escenario:** Ejecución del despachador de alertas en infraestructura Linux propia
  * **Dado que** el ecosistema está desplegado en un servidor Linux independiente sin servicios de Vercel.
  * **Cuando** el `cron` del sistema operativo Linux ejecuta `curl` contra el endpoint `/api/cron/despachador-alertas` con el `CRON_SECRET`.
  * **Entonces** el sistema procesa todas las citas entre 23h y 24h, despacha notificaciones Push/Email a ambas partes, actualiza `cit_recordatorio_24h_enviado = now()` y garantiza que una segunda ejecución no reenvíe las alertas.

---

## Cómo Referenciar desde la Especificación de un Producto

En la especificación funcional de cualquier producto (`gobernanza/productos/{producto}/especificacion-funcional.md`), se referencian estos requerimientos por su código:

```markdown
## Identidad y Autenticación
Ver PLT-001, PLT-002 y PLT-003 en la Especificación de Plataforma. Registro sin fricción y acceso biométrico en app móvil.

## Configuración y Ubicación del Negocio
Ver PLT-008. Sucursal matriz en Quito, Redes Sociales (FB, IG, TikTok) y Términos en Markdown.

## Chat Conversacional
Ver PLT-004. Agente asignado en ARIA: "Asistente Legal Tranqi".

## Facturación y Pagos
Ver PLT-006. Emisión de factura SRI automática al aprobar la solicitud.
```

