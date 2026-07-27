---
tipo: esp_funcional
estado: vigente
version: 1.4
fecha: 2026-07-26
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
   - **Términos Globales:** Se aceptan en el registro inicial del ecosistema.
   - **Términos Específicos del Negocio:** Casilla obligatoria al ingresar por primera vez a un producto individual. Los textos legales de cada negocio son totalmente configurables en formato Markdown (`.md`) desde la consola de administración (`PLT-008`).

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
Implementa la autenticación multifactor basada en TOTP (compatible con Google Authenticator / Authy) mediante Supabase Auth para proteger transacciones irreversibles o envíos de datos sensibles, garantizando enrolamiento oportuno y flujos de recuperación accesibles.

### Reglas de Negocio
1. **MFA No Bloqueante en Navegación ni Registro:** El MFA no es obligatorio para registrarse, iniciar sesión, navegar o consultar datos.
2. **Enrolamiento y Disparo de MFA Ante la Primera Invocación Crítica:**
   - El autenticador TOTP se debe configurar/enrolar **exclusivamente ante la primera invocación a un proceso crítico**.
   - Si el usuario nunca ejecuta una acción crítica, nunca se le interrumpe para enrolar MFA.
3. **Procesos Críticos Comunes y Específicos:**
   - **Proceso Crítico Común:** El uso de la **pasarela de pagos (`PLT-006`)** es el proceso crítico común a todas las aplicaciones del ecosistema que exige MFA o confirmación de seguridad.
   - **Procesos Críticos Específicos:** Cualquier otro flujo o acción que requiera MFA (ej. enviar solicitud de abogado socio en Tranqi) se especificará individualmente en la especificación del producto correspondiente (`gobernanza/productos/{producto}/especificacion-funcional.md`).
4. **Mecanismo de Recuperación (Contraseña y MFA):**
   - **Auto-servicio vía Correo:** En caso de olvido de contraseña o pérdida del dispositivo TOTP, el usuario puede solicitar el reseteo desde la pantalla de ingreso. El sistema envía automáticamente un enlace seguro de reseteo al correo de registro.
   - **Reseteo Asistido por Administrador:** El Administrador de cada aplicación (o el SuperAdmin) tiene la capacidad desde la consola de gestión de **forzar o enviar manualmente el enlace de reseteo** al correo del usuario para restaurar su acceso o desvincular su MFA.

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
Registra automáticamente todas las modificaciones de datos en las tablas de negocio mediante el trigger PostgreSQL `aud_fn_auditar_tabla()`.

### Reglas de Negocio
1. **Auditoría Transparente:** Todas las operaciones `INSERT`, `UPDATE` y `DELETE` guardan el estado anterior y nuevo (`JSONB`) en `comun_auditoria.aud_registro`.
2. **Aislamiento de Visibilidad:**
   - Los roles `ADMINISTRADOR` de un negocio solo pueden visualizar el historial de auditoría correspondiente a su dominio de datos (`/admin/auditoria`).
   - El rol `SUPERADMIN` de Plataforma posee visibilidad global de la auditoría de todos los negocios.

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
Pantalla de configuración del negocio (identidad legal + datos de `PLT-008`) y un sistema de permisos basado en **widgets**: cada funcionalidad implementada se registra como un widget asignable dinámicamente a un rol, en vez de codificar permisos fijos por aplicación.

### Reglas de Negocio
1. **Identificación legal del negocio:** cada negocio configura su Identificación/NIT, Nombre Comercial y Razón Social, además de los datos de `PLT-008` (redes sociales, canales, términos, locales).
2. **Roles por defecto:** todo negocio tiene como mínimo `SUPERADMIN` (rol de plataforma, no de negocio — ver `PLT-003`), `ADMINISTRADOR`, `CLIENTE`, y puede definir roles adicionales (`OPERADOR`, `TECNICO`, `ABOGADO`, etc.).
3. **Funcionalidad como widget:** cada capacidad de la consola de administración (gestión de usuarios, catálogo, pedidos, configuración) se registra como un widget con clave única por negocio.
4. **Asignación dinámica, no fija en código:** un `ADMINISTRADOR` (o `SUPERADMIN`) decide qué widgets ve cada rol desde una pantalla de configuración — no requiere despliegue de código para cambiar quién ve qué.
5. **Widget obligatorio de gestión de usuarios:** todo negocio trae, por defecto, un widget de "Gestión de usuarios" visible para `ADMINISTRADOR`, que permite buscar entre los usuarios registrados y asignarles rol dentro de ese negocio.
6. **SuperAdmin de plataforma:** `kleber.toapanta.ch@gmail.com` es `SUPERADMIN` en los 4 negocios desde su primer inicio de sesión — no requiere asignación manual por negocio.

**Implementación técnica:** ver [`especificacion-tecnica.md`](especificacion-tecnica.md) §1.1 y §9.

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

