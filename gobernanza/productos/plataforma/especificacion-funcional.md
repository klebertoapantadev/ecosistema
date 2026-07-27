---
tipo: esp_funcional
estado: vigente
version: 1.7
fecha: 2026-07-27
responsable: Kleber Toapanta
---

# Plataforma — Especificación Funcional Común

**Prefijo de código de requerimiento:** `PLT-xxx`  
**Propietario:** Plataforma (transversal a todos los negocios del ecosistema)

Este documento describe el **comportamiento compartido por los 4 productos** (Tranqi, FastFix Home, Tinkay, Margaritas Floristería) y por cualquier nuevo negocio que se incorpore. Ningún producto redefine estos requerimientos en su propia especificación; únicamente los referencia por su código `PLT-xxx` y documenta lo específico de su dominio.

**Regla de precedencia:** Esta especificación establece los criterios de aceptación y reglas de negocio no negociables. Los agentes de codificación (Claude Code, Antigravity, Copilot, Cursor) e ingenieros deben implementar la lógica ajustándose estrictamente a este documento.

---

## PLT-001 — Identidad Única y Registro de Usuario Sin Fricción

### Descripción
Un usuario posee una **única identidad base** en todo el ecosistema (`comun_seguridad.seg_usuario`), pero ejecuta un **flujo de registro independiente por cada negocio** al que desea ingresar. El registro inicial prioriza la fluidez y conversión cero fricción.

### Reglas de Negocio
1. **Registro Inicial Ultra-Fluido (Cero Frenos):**
   - **Vía Google OAuth 2.0:** Se completa en 1 solo clic. Se extraen automáticamente el nombre, apellido, correo electrónico y foto de perfil. No se solicita ningún dato obligatorio adicional en este paso.
   - **Vía Correo Directo (Registro Simple):** Formulario mínimo con únicamente 4 campos: Nombres, Apellidos, Correo Electrónico y Contraseña.
2. **Opción "Contáctame vía WhatsApp" (Exclusivamente Post-Registro):**
   - La opción de ingresar el número de WhatsApp y autorizar contacto **NUNCA debe ser un freno en el formulario de registro inicial**.
   - Se presenta únicamente **DESPUÉS** de que el usuario ha completado el registro (en la pantalla de bienvenida/onboarding posterior o dentro de la edición de su perfil), mediante un campo opcional con casilla de verificación (*checkbox*) desmarcada por defecto para autorización explícita (`autorizacion_contacto_whatsapp`).
3. **Información Transparente de Ubicación y Alcance Local:** En la pantalla de registro u onboarding de cada producto se expone de forma clara la información de presencia local en Ecuador y el alcance de atención (gestionados a través de `PLT-008`).
4. **Registro e Identidad Independiente por Negocio (`comun_seguridad.seg_membresia`):**
   - Aunque la cuenta base exista en el ecosistema, la suscripción a cada negocio crea un registro de membresía **100% independiente** que contiene:
     - `mem_fecha_registro`: Fecha y hora exacta de incorporación a dicho negocio.
     - `mem_estado`: Estado operativo de la membresía en ese producto (`ACTIVO`, `PENDIENTE`, `SUSPENDIDO`, `INACTIVO`).
     - Credencial / PIN específico si la aplicación lo requiere.
5. **Autenticación Biométrica y PIN Móvil (Apps Nativas Capacitor):**
   - En las aplicaciones nativas para smartphones (iOS/Android), se habilita el acceso rápido mediante **Biometría (Face ID / Touch ID / Huella Dactilar)** o mediante la **Clave / Patrón de desbloqueo del dispositivo móvil**, permitiendo re-ingresar al negocio sin solicitar la contraseña de Supabase en cada apertura.
6. **Aceptación de Términos Específicos por Negocio:**
   - **Términos Globales:** Se aceptan en el registro inicial del ecosistema. ✅ Implementado — checkbox obligatorio en registro por correo, disclaimer + registro automático de aceptación en el callback para Google OAuth (ver `especificacion-tecnica.md` §1). Queda versionado por usuario (`usu_terminos_version`) para poder renotificar ante un cambio sustantivo del texto.
   - **Términos Específicos del Negocio:** Casilla obligatoria al ingresar por primera vez a un producto individual. Los textos legales de cada negocio son totalmente configurables en formato Markdown (`.md`) desde la consola de administración (`PLT-008`). **Pendiente** — hoy el texto de `/terminos` es un borrador estático, no editable desde la consola.

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
6. **Mecanismo de Recuperación (Contraseña y MFA):**
   - **Auto-servicio vía Correo:** En caso de olvido de contraseña o pérdida del dispositivo TOTP, el usuario puede solicitar el reseteo desde la pantalla de ingreso. El sistema envía automáticamente un enlace seguro de reseteo al correo de registro.
   - **Reseteo Asistido por Administrador:** El Administrador de cada aplicación (o el SuperAdmin) tiene la capacidad desde la consola de gestión de **forzar o enviar manualmente el enlace de reseteo** o desvincular el MFA del usuario para restaurar su acceso en caso de pérdida total de credenciales.

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

## PLT-003 — Membresías y Roles por Producto

### Descripción
Gestiona el control de acceso basado en roles (RBAC) aislado por negocio a través de `comun_seguridad.seg_membresia`.

### Reglas de Negocio
1. **Asignación Automática de Rol 'CLIENTE':** Al completar el registro u onboarding por primera vez en cualquier producto, el sistema asigna automáticamente el rol `CLIENTE` para ese negocio específico.
2. **Aislamiento de Roles por Negocio:** Un usuario puede ser `CLIENTE` en Tinkay y tener el rol `ABOGADO` en Tranqi. Ser administrador de un producto no otorga permisos en los demás.
3. **Asignación de Roles Privilegiados:** El Administrador de cada negocio (o el SuperAdmin) es el único facultado para asignar roles distintos (`ADMINISTRADOR`, `TECNICO`, `ABOGADO`, `OPERADOR`) desde la consola de gestión.
4. **Verificación de Estado para Capacidades:** Tener un rol asignado en `seg_membresia` no habilita capacidades si el proceso exige un estado verificado en las tablas del producto (ej. `trq_abogado` en estado `APROBADO`).

---

## PLT-004 — Buddie Conversacional (Chat Asistido por IA)

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

### Descripción
Unifica el procesamiento de pagos y la emisión de comprobantes electrónicos autorizados por el Servicio de Rentas Internas (SRI) de Ecuador.

### Reglas de Negocio
1. **Pasarela de Pagos como Proceso Crítico Común:** El flujo de cobro es la acción crítica común transversal a todas las aplicaciones que activa las garantías de seguridad y MFA TOTP de `PLT-002`.
2. **Emisión de Facturas Electrónicas:** Todo pago completado exitosamente genera la factura electrónica SRI.
3. **Confirmación de Datos de Facturación:**
   - Antes de procesar el cobro, el sistema solicita al cliente confirmar si requiere la factura a nombre de **Consumidor Final** o con **Datos Personalizados (RUC/Cédula, Razón Social, Dirección, Correo)**.
   - Si el cliente elige emitir con datos y no los ha registrado previamente en su perfil, el sistema exige su ingreso antes de habilitar la pasarela de pago.
4. **Abstracción de Pasarela:** El flujo de cobro utiliza una interfaz unificada que soporta pasarelas locales (Payphone, Kushki, Placetopay) de forma transparente para el cliente.

---

## PLT-007 — Catálogo Geográfico Unificado (Ecuador)

### Descripción
Proporciona el catálogo maestro de las 24 Provincias y sus respectivos Cantones/Ciudades de la República del Ecuador en `comun_catalogo`.

### Reglas de Negocio
1. **Carga Inicial Completa:** La base de datos se inicializa con la totalidad de las 24 provincias y cantones oficializados por el INEC.
2. **Activación Zonal por Negocio:** Cada producto activa las provincias/ciudades en las que opera comercialmente (ej. Tinkay y FastFix operan inicialmente en *Pichincha / Quito*, mientras que Tranqi habilita *Cobertura Nacional*).
3. **Estandarización de Direcciones:** Cualquier entidad que requiera provincia o ciudad (residencia de cliente, cobertura de abogado, zona de técnico o dirección de entrega) consulta obligatoriamente este catálogo.

---

## PLT-008 — Configuración de Datos Generales del Negocio, Términos y Redes Sociales

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

### Criterios de Aceptación (Gherkin)
* **Escenario:** Edición de Términos de Servicio en Markdown
  * **Dado que** el Administrador de FastFix accede al panel `/admin/configuracion-negocio/terminos`.
  * **Cuando** edita el contenido legal en formato Markdown y hace clic en "Guardar y Publicar".
  * **Entonces** el sistema actualiza el texto y lo despliega instantáneamente en el modal de Términos de la app de FastFix.

---

## PLT-009 — Catálogo Comercial Unificado (Productos, Servicios y Suscripciones)

### Descripción
Motor centralizado de gestión de bienes, servicios y suscripciones para todo negocio que venda algo (Tinkay, Margaritas Floristería, planes de Tranqi, servicios de FastFix). Un solo modelo de datos (`comun_comercio`), aislado por negocio, en vez de que cada producto reimplemente su propio catálogo. Ver [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md) para la decisión completa y el esquema.

### Reglas de Negocio
1. **Jerarquía de tres niveles:** Categoría (navegación) → Producto/Servicio Master (concepto abstracto) → Variante/SKU (unidad facturable concreta, con precio, impuestos y códigos SRI propios).
2. **Cuatro tipos de oferta por variante:** Producto Físico, Servicio Puntual, Suscripción/Plan Recurrente (con frecuencia, días de prueba y reglas de reintento de cobro) y Producto Digital.
3. **Matriz de variantes:** un producto master puede tener N variantes con atributos propios (tamaño, cantidad, color, accesorios) y precio/impuesto independiente por variante.
4. **Formularios de personalización por producto/variante:** campos de captura configurables (mensaje de dedicatoria, fecha/rango de entrega, remitente/destinatario) y adicionales de cross-sell sugeridos que incrementan el valor final.
5. **Gestión de medios — dos orígenes, no tres:**
   - **Carga de archivo local:** subida directa a Supabase Storage (bucket público de catálogo — a diferencia del resto del ecosistema, este contenido es de vitrina, no privado).
   - **URL externa:** enlace público directo.
   - **Prioridad de portada:** una imagen puede marcarse manualmente como portada global sin importar su origen.
   - **Descartado:** sincronización de álbum de Google Photos filtrando por "favorito/estrella". No es viable desde marzo de 2025 — la Google Photos Library API ya no permite leer álbumes existentes del usuario, solo contenido creado por la propia app. Carga local + URL cubren el caso de uso.
   - **Resiliencia:** si una URL externa deja de responder, se mantiene en caché la última versión válida o se muestra la imagen de respaldo por defecto del negocio.
6. **Aislamiento multitenant:** cada negocio opera sobre su propio subconjunto de `comun_comercio`, identificado por negocio dueño — el catálogo de un negocio nunca es visible como editable para otro.
7. **Desacoplamiento fiscal:** la variante contiene los códigos e impuestos SRI necesarios para facturación (`PLT-006`), pero la tienda web y WhatsApp solo muestran precios finales al cliente.
8. **Catálogo publicado es de lectura pública:** a diferencia de la postura "privado por defecto" del resto del ecosistema, un producto/variante activo se puede leer sin autenticación (es contenido de vitrina) — la escritura sigue restringida al `ADMINISTRADOR`/`OPERADOR` del negocio dueño.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §7 (`comun_comercio`).

---

## PLT-010 — Integración Omnicanal (WhatsApp Business y Meta Commerce Manager)

### Descripción
Distribución del catálogo (`PLT-009`) hacia canales sociales sin carga manual duplicada.

### Reglas de Negocio
1. **Feed automatizado para Meta Commerce Manager:** cada negocio expone un feed de catálogo que Meta consulta periódicamente para sincronizar el Catálogo de WhatsApp Business, Facebook e Instagram — títulos, precios, variantes y portada se actualizan solos, sin carga manual en la app de Meta.
2. **Botón "Comprar por WhatsApp":** en la tienda web, genera un enlace estructurado con producto, variante (SKU), precio final calculado (incluida personalización/adicionales), imagen de referencia y datos de entrega ingresados por el cliente.
3. **Endpoints de consulta para el Buddie (`PLT-004`):** el asistente conversacional puede responder en chat con tarjetas de producto, foto de portada y precio actualizado, reutilizando el mismo catálogo — no un feed aparte.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §7.1.

---

## PLT-011 — Configuración de Empresa y Sistema de Widgets por Rol

### Descripción
Pantalla de configuración del negocio (identidad legal + datos de `PLT-008`) y un sistema de permisos basado en **widgets**: **todas las vistas de las consolas administrativas de todas las aplicaciones deben construirse bajo este único patrón estándar de Widgets** (componentes autocontenidos y reutilizables), donde cada funcionalidad se asigna dinámicamente a roles sin duplicar código entre aplicaciones.

### Reglas de Negocio
1. **Estándar Unificado de Vistas Basado en Widgets ("Un Solo Patrón"):**
   - Todas las consolas de administración de las aplicaciones del ecosistema se rigen obligatoriamente por el **patrón estándar de arquitectura de Widgets**.
   - Cada capacidad administrativa se concibe como un Widget único y autocontenido registrado con clave descriptiva en `seg_widget`.
   - Ninguna aplicación implementa pantallas administrativas ad-hoc fuera de este estándar; la funcionalidad es única y común, adaptando únicamente los estilos visuales (paleta de colores/tema) de cada marca.
2. **Estándar Interactivo de DataGrids y Tablas de Datos en Widgets:**
   - Todo widget que despliegue tablas o listas de datos (ej. `auditoria`, `gestion_usuarios`, catálogos, pedidos, transacciones o cualquier listado tabulado) debe incorporar obligatoriamente un **DataGrid enriquecido** con las siguientes capacidades estándar:
     - **Búsqueda Global Multi-campo (Global Search):** Caja de búsqueda en tiempo real habilitada permanentemente en la barra superior del Grid, que evalúa coincidencias de texto sobre la totalidad de los campos y columnas de los registros.
     - **Columnas Ordenables (Sorting):** Ordenamiento ascendente y descendente al hacer clic en los encabezados.
     - **Reordenamiento de Columnas (Drag & Drop):** Permite cambiar el orden visual de las columnas arrastrando los encabezados a la posición deseada.
     - **Agrupamiento Dinámico por Columnas (Drag-to-Group):** Permite arrastrar uno o más encabezados de columna hacia una zona superior de agrupamiento para clasificar y colapsar/expandir filas dinámicamente.
     - **Exportación Nativa a Excel (`.xlsx`) y CSV (`.csv`):** Botones en la barra de herramientas del Grid para exportar el conjunto de datos filtrado o visible directamente a hojas de cálculo.
3. **Identificación legal del negocio:** cada negocio configura su Identificación/NIT, Nombre Comercial y Razón Social, además de los datos de `PLT-008` (redes sociales, canales, términos, locales).
4. **Roles por defecto:** todo negocio tiene como mínimo `SUPERADMIN` (rol de plataforma, no de negocio — ver `PLT-003`), `ADMINISTRADOR`, `CLIENTE`, y puede definir roles adicionales (`OPERADOR`, `TECNICO`, `ABOGADO`, etc.).
5. **Widget Único y Común de Gestión de Usuarios Registrados (`gestion_usuarios`):**
   - Es un componente de software **único y transversal** para todas las aplicaciones. Su diseño y lógica funcional son 100% idénticos en todo el ecosistema, adaptando únicamente la paleta de colores y tema de la app correspondiente.
   - **Comportamiento por Rol:**
     - **Rol `ADMINISTRADOR`:** Ve y gestiona únicamente los usuarios registrados en su propia aplicación (miembros de `seg_membresia` de su negocio).
     - **Rol `SUPERADMIN` de Plataforma:** Desde **cualquier aplicación**, al abrir el widget de gestión de usuarios, posee la facultad de visualizar y administrar a **todos los usuarios registrados de todo el ecosistema** (con selector por negocio o vista consolidada de plataforma).
6. **Asignación dinámica de widgets por rol:** un `ADMINISTRADOR` (o `SUPERADMIN`) decide qué widgets ve cada rol desde la consola de configuración de permisos — sin requerir cambios en código para ajustar visibilidades.
7. **SuperAdmin de plataforma:** `kleber.toapanta.ch@gmail.com` es `SUPERADMIN` en los 4 negocios desde su primer inicio de sesión — no requiere asignación manual y posee acceso universal a todos los widgets en todas las apps.

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

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1.1 y §9.

---

## PLT-012 — Baja de Cuenta y Derecho al Olvido

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

### Descripción
Motor unificado de eventos de comunicación y alertas en tiempo real para todos los productos del ecosistema, gestionado de forma centralizada sin que cada negocio reimplemente su propia infraestructura de mensajes.

### Reglas de Negocio
1. **Componente / Widget In-App de Notificaciones:**
   - Barra superior de todas las aplicaciones con icono de campana e indicador numérico de notificaciones no leídas.
   - Drawer táctil / modal interactivo que despliega el historial de alertas, ordenadas cronológicamente, con opción de marcar como leídas o ir al detalle del evento (ej. pedido, cita o causa).
2. **Multicanalidad de Envío:**
   - **In-App:** Notificación nativa persistida en base de datos.
   - **Web / Mobile Push:** Notificaciones push para navegadores web y apps nativas Capacitor.
   - **Correo Transaccional (Email):** Envío automático de notificaciones formales (confirmación de compra, factura SRI, reseteo de clave).
   - **WhatsApp Business API:** Notificaciones operativas de alto valor (estado de entrega de pedido, confirmación de técnico en camino, alerta de cita urgente), exclusivamente si el usuario lo autorizó (`autorizacion_contacto_whatsapp` en `PLT-001`).
3. **Aislamiento y Preferencias por Usuario:**
   - El usuario puede gestionar desde `/panel/notificaciones` qué tipos de alertas desea recibir y por qué canales.

### Criterios de Aceptación (Gherkin)
* **Escenario:** Recepción de notificación in-app y push de pedido
  * **Dado que** un cliente realizó un pedido en Tinkay.
  * **Cuando** el estado cambia a "En Ruta de Entrega".
  * **Entonces** el sistema genera la notificación in-app, incrementa el contador de la campana y dispara la alerta push a su dispositivo.

---

## PLT-014 — Motor de Cupones, Descuentos y Promociones

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

### Descripción
Todo usuario registrado puede ver sus últimos accesos (dispositivo/navegador aproximado y fecha) desde su panel, y el sistema lo saluda de forma distinta según cuánto tiempo pasó desde su visita anterior. Es el primer building block de `PLT-017` — un registro histórico simple, no un listado de sesiones activas ni revocación de tokens (eso sigue pendiente en `PLT-017`).

### Reglas de Negocio
1. **Registro automático en cada inicio de sesión:** cualquier login exitoso (correo/contraseña, confirmación de registro con sesión inmediata, o Google OAuth) registra una fila con IP y User-Agent, sin intervención del usuario.
2. **Visibilidad estrictamente propia:** un usuario únicamente puede ver su propio historial — nunca el de otro usuario, ni siquiera un `ADMINISTRADOR` del negocio.
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

