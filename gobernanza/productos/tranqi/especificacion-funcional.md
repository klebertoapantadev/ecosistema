---
tipo: esp_funcional
estado: vigente
version: 1.1
fecha: 2026-08-17
responsables: Kleber Toapanta / Jesus Navarrete
---

# Tranqi — Especificación Funcional (Red Legal & Legaltech)

**Prefijo de código de requerimiento:** `TRQ-xxx`  
**Esquema de Base de Datos:** `tranqui_legal` · **Prefijo de tablas:** `trq_`  
**Propietarios:** Tranqi Legal Network (Ecosistema Legaltech)

**Sistema visual:** [`sistema-visual.md`](sistema-visual.md) — paleta, uso del color por perfil (Cliente, Abogado, Operador/Administrador) y maquetas de referencia. Aplica a `tranqi-web` y aplicaciones móviles.

---

### Estándar de Referencia: Modelo Law Practice Management (LPMS) & Legal Marketplace

Tranqi adopta las mejores prácticas y estándares internacionales de **Law Practice Management Software (LPMS)** (referencias líderes de la industria como *Clio*, *MyCase*, *Smokeball* y *Lawmatics*), combinadas con un modelo marketplace digital (estilo *Uber para servicios legales* y *LegalZoom*), tropicalizadas al marco jurídico de la República del Ecuador (Código Orgánico de la Función Judicial, COGEP, SATJE, Ley de Comercio Electrónico y LOPDP).

#### Pilares de la Arquitectura Funcional:
1. **Billetera de Documentos Unificada (Universal Wallet):** Todo usuario (cliente, abogado, operador) dispone de una bóveda digital segura para gestionar documentos recurrentes, con capacidad de compartirlos a Tranqi para revisión puntual o vincularlos a expedientes de casos específicos.
2. **Expediente Digital Unificado (Matters & Cases):** Contenedor central que agrupa cliente, abogados asignados, escritos, documentos probatorios, etapas procesales y pagos.
3. **Despacho Jurídico Telemático para el Abogado:** Panel profesional con gestión de agenda, revisión de documentos compartidos por clientes, emisión de dictámenes y firma electrónica PAdES.
4. **Mesa de Control y Operaciones:** Supervisión de acreditaciones, asignación inteligente de causas y control de comisiones.

---

### Matriz de Responsables de Revisión, Implementación y Avance (%)

| Código | Rol / Ámbito | Funcionalidad / Requerimiento | Estado | Avance (%) | Responsable Asignado |
| :--- | :---: | :--- | :---: | :---: | :--- |
| **`TRQ-COM-001`** | **Común (Todos)** | **Billetera Digital de Documentos Seguros, Extracción OCR y Enlaces TTL** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-COM-002`** | **Común (Todos)** | **Compartición de Documentos a Tranqi (Revisión de Contratos & Vinculación a Casos)** | 🟡 Especificado | **25%** | Kleber Toapanta |
| **`TRQ-COM-003`** | **Común (Todos)** | **Herramienta Universal de Firma Digital de Documentos PDF (.p12 / QR / PAdES)** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-CLI-001`** | **Cliente** | **Portal de Casos, Solicitud de Patrocinio y Consultas Telemáticas** | ⏳ Pendiente | **0%** | Jesus Navarrete |
| **`TRQ-CLI-002`** | **Cliente** | **Módulo Express de Revisión y Dictamen Legal de Contratos/Minutas (IA)** | ⏳ Pendiente | **0%** | **Jesus Navarrete (IA)** |
| **`TRQ-CLI-003`** | **Cliente** | **Directorio Público y Selección Geolocalizada de Abogados** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-CLI-004`** | **Cliente** | **Calculadora de Honorarios, Pensiones (MIES) e Indemnizaciones Laborales** | ⏳ Pendiente | **0%** | Jesus Navarrete |
| **`TRQ-ABG-001`** | **Abogado** | **Acreditación, Contratación Dual (Firma Digital .p12 / Manual) y Onboarding** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-ABG-002`** | **Abogado** | **Despacho Virtual: Bandeja de Casos, Expediente Digital y Actuaciones SATJE** | ⏳ Pendiente | **0%** | Kleber Toapanta / Jesus Navarrete |
| **`TRQ-ABG-003`** | **Abogado** | **Firma Electrónica Avanzada PAdES en Navegador (Zero-Custody `.p12`/`.pfx`)** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-ABG-004`** | **Abogado** | **Agenda Profesional, Citas Presenciales y Sala de Videoconsulta Segura** | ⏳ Pendiente | **0%** | Jesus Navarrete |
| **`TRQ-ABG-005`** | **Abogado** | **Verificación Inteligente de Identidad y Documentos con Aria (IA) en Registro de Abogados** | 🟡 Especificado | **25%** | **Jesus Navarrete (IA)** |
| **`TRQ-ADM-001`** | **Operador/Admin** | **Mesa de Control de Acreditación, Contra-Firma Tranqi y Activación de Socios** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-ADM-002`** | **Operador/Admin** | **Asignación Inteligente de Casos (IA), Liquidación de Honorarios y Comisiones** | ⏳ Pendiente | **0%** | **Jesus Navarrete (IA)** / Kleber Toapanta |
| **`TRQ-ADM-003`** | **Operador/Admin** | **Auditoría Transversal BDD, Telemetría API y Bitácora de Campañas** | ✅ Implementado | **100%** | Kleber Toapanta |

---

## 1. Módulos Comunes (Transversales a Todos los Roles)

### TRQ-COM-001 — Billetera Digital de Documentos Seguros, OCR y Enlaces Efímeros (TTL)
**Responsable:** Kleber Toapanta | **Estado:** 🟡 Especificado (30%)

#### Descripción
Bóveda digital de documentos personales, familiares y profesionales donde cada usuario (cliente, socio abogado u operador) custodia archivos digitales de uso cotidiano con reconocimiento OCR de parámetros clave y generación de enlaces temporales protegidos.

#### Reglas de Negocio
1. **Tipología de Documentos:**
   - *Personales / Familiares:* Cédulas de identidad (titular, cónyuge, cargas familiares/hijos), Licencia de Conducir, Pasaporte, Certificado de Votación.
   - *Vehiculares:* Matrícula vehicular, SOAT, Póliza de Seguro.
   - *Contratos y Servicios:* Contratos de arrendamiento, contratos de servicios residenciales (Internet, luz, agua), pólizas médicas.
   - *Profesionales / Corporativos:* Títulos universitarios, certificados de matrícula, nombramientos, RUC/RIMPE.
2. **Almacenamiento Estructurado y Cifrado:**
   - Ubicación: `comun-privado/TRANQ/{usuario_id}/billetera-documentos/{categoria}/{doc_id}-{nombre_sanitizado}`.
   - Acceso restringido por RLS y cifrado de metadatos sensibles.
3. **Extracción Inteligente de Parámetros (OCR):**
   - Lectura automática de: Nombres completos, Cédula/RUC, Fecha de Emisión, Fecha de Caducidad/Expiración y Entidad Emisora.
4. **Motor de Alertas Proactivas de Caducidad:**
   - Notificaciones automáticas multicanal (**In-App**, **Push** y **Email**) a los **30 días, 15 días y 7 días previos** al vencimiento de licencias, pólizas, matrículas o contratos.
5. **Compartición Externa mediante Enlaces Efímeros (TTL - Time-To-Live):**
   - El usuario puede compartir cualquier documento con terceros mediante URL temporal protegida por token criptográfico.
   - *Opciones de Expiración:* 1h, 3h, 6h, 12h, 24h, 3 días, 7 días, 30 días, *Una Sola Vista ("Burn on Read")* o fecha personalizada con clave PIN opcional.

---

### TRQ-COM-003 — Herramienta Universal de Firma Digital de Documentos PDF (.p12 / QR / PAdES)
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado (100%)

#### Descripción
Widget modular universal (`firma_documentos_pdf`) y ruta directa (`/panel/firma-documentos`) que permite a cualquier usuario o rol del ecosistema firmar electrónicamente cualquier documento PDF local mediante su certificado digital (`.p12` o `.pfx`), estampando una firma visual oficial con código QR y metadatos PAdES conformes a la Ley de Comercio Electrónico del Ecuador.

#### Diagrama de Flujo Criptográfico y Experiencia de Usuario:

```mermaid
graph TD
    A["1. Carga de Documento PDF Local<br/>(Hasta 25MB, cálculo de páginas vía pdf-lib)"] --> B["2. Carga de Certificado .p12 / .pfx<br/>y Contraseña"]
    B --> C["3. Descifrado Zero-Custody en Memoria (node-forge)<br/>Extracción de Titular, Emisor, Vigencia, Serial y Hash SHA-256"]
    C --> D["4. Visor Interactivo 1:1 y Posicionamiento de Firma<br/>Arrastre táctil/mouse con accesos rápidos y micro-ajustes"]
    D --> E["5. Estampado PAdES y Generación Criptográfica (pdf-lib)<br/>Incrustación de marco, QR oficial, tipografía y metadatos"]
    E --> F["6. Previsualización Inmediata y Descarga Directa<br/>(Botón 'Descargar PDF' o 'Firmar Otro')"]

    style A fill:#F5F3FF,stroke:#5000BA,stroke-width:2px;
    style C fill:#F0FDF4,stroke:#16A34A,stroke-width:2px;
    style D fill:#FFFBEB,stroke:#F59E0B,stroke-width:2px;
    style E fill:#EFF6FF,stroke:#2563EB,stroke-width:2px;
    style F fill:#F0FDF4,stroke:#05876E,stroke-width:2px;
```

#### Reglas de Negocio y Estándares Técnicos:
1. **Privacidad Zero-Custody Absoluta:**
   - Ni el archivo `.p12`, ni la contraseña, ni el documento PDF son transmitidos a ningún servidor externo.
   - El descifrado ASN.1/PKCS#12 y la composición gráfica ocurren al 100% en la memoria RAM del navegador.
2. **Proyección Matemática de Coordenadas 1:1:**
   - La estampa visual mantiene una relación de aspecto fija (`230pt x 72pt`) proyectada matemáticamente desde el DOM porcentual hacia el sistema de coordenadas PDF de origen inferior-izquierdo:
     $$\text{xPdf} = \left(\frac{\text{posicionX}}{100}\right) \times \text{widthPage}$$
     $$\text{yPdf} = \text{heightPage} - \left(\frac{\text{posicionY}}{100}\right) \times \text{heightPage} - \text{boxHeight}$$
3. **Soporte Táctil Móvil Fluido:**
   - Eventos táctiles nativos (`touchmove`, `touchend`, `touchcancel`) con `touch-action: none` para prevenir colisiones con el scroll de la página.
4. **Disponibilidad Universal en Base de Datos:**
   - Registrado en `comun_seguridad.seg_widget` (`firma_documentos_pdf`) y asignado a todos los roles (`CLIENTE`, `ABOGADO`, `OPERADOR`, `ADMINISTRADOR`, `SUPERADMIN`) en `seg_rol_widget`.
   - Indexado en el buscador global (`BuscadorModulosGlobal`), catálogo superadmin (`ConsolaSuperAdminModular`) y matriz de perfiles (`AdministracionPerfilesWidget`).

---

## 2. Módulos para el Rol Cliente

### TRQ-CLI-001 — Portal de Casos y Patrocinio Judicial
**Responsable:** Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Solicitud de patrocinio legal por materias (Civil, Penal, Laboral, Familia, Tránsito, Societario).
- Visualización de la línea de tiempo procesal del caso, abogados asignados, próximas audiencias y actuaciones procesales del SATJE.

### TRQ-CLI-002 — Módulo Express de Revisión de Contratos y Minutas
**Responsable:** Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Carga de contratos en Word/PDF desde la Billetera para revisión preventiva antes de la firma.
- Devolución del dictamen legal con semáforo de riesgo (cláusulas abusivas, penalidades, contingencias tributarias).

### TRQ-CLI-003 — Directorio Público de Abogados Verificados
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado (100%)
- Carrusel público en la landing page (`/api/abogados-publicos`) y búsqueda por especialidad y provincia.

### TRQ-CLI-004 — Calculadora de Honorarios y Pensiones
**Responsable:** Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Simulador de pensiones alimenticias conforme a la tabla oficial del MIES / Consejo de la Judicatura y cálculo de liquidaciones laborales por despido intempestivo / desahucio.

---

## 3. Módulos para el Rol Abogado (Socio Profesional)

### TRQ-ABG-001 — Acreditación, Negociación de Contratos en Markdown (.MD) y Contratación Dual
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado y Verificado (100%)

#### Ciclo de Vida de Acreditación, Negociación y Versionamiento de Contratos:

```mermaid
graph TD
    A["1. Solicitud de Postulación"] -->|Revisión SENESCYT y Foro de Abogados| B["2. Validación por Operador / Admin"]
    B --> C["3. Operador Edita Contrato en Markdown (.MD)"]
    C --> D["4. Previsualización y Descarga de Borrador PDF"]
    D -->|Notif 1: Contrato vN Emitido / Ajustado| E{"5. Opciones del Solicitante (vN)"}
    E -->|"Opción 1: Aceptar y Firmar"| F["Firma Digital .p12 con QR Oficial / Manual PDF"]
    E -->|"Opción 2: Enviar Comentarios"| G["Observaciones sobre Cláusulas (Sin Aceptar)"]
    G -->|Notif 2: Observaciones vN al Operador| C
    F -->|Notif 3: Contrato vN Firmado por Abogado| H["6. Operador Contra-Firma Digitalmente vN"]
    H -->|Firma Digital .p12 de Tranqi| I["7. Contrato Bi-firmado y Activación de Rol ABOGADO"]
    I -->|Notif 4: Bienvenido a Tranqi| J["8. Socio Abogado 100% ACTIVO"]
```

#### Reglas de Negociación, Edición y Versionamiento Inmutable:
1. **Edición Dinámica en Markdown (.MD) por Operador/Admin:**
   - El operador o administrador puede editar directamente las cláusulas del contrato en un editor Markdown (.MD) antes de emitir la versión `vN` al solicitante.
   - Cuenta con soporte de variables dinámicas interpoladas (`{{nombre_completo}}`, `{{cedula}}`).
   - Dispone de **Previsualización en tiempo real en PDF** y **Descarga del borrador vectorial en PDF** antes de aprobar y emitir la versión.
2. **Opciones Exclusivas del Postulante:**
   - **Opción 1 (Aceptar y Firmar Contrato vN):**
     - *Firma Electrónica en Línea (.p12 / .pfx):* Asistente interactivo en navegador (Zero-Custody) con posicionamiento visual libre, estampa de QR oficial ecuatoriano y descarga de copia firmada.
     - *Firma Manual / Escaneada (PDF):* Descarga del PDF oficial, firma física, escaneo y subida en PDF.
   - **Opción 2 (Enviar Comentarios / Observaciones sin Aceptar):**
     - El postulante formula observaciones específicas sobre cláusulas, guardadas inmutablemente y notificadas de inmediato al staff.
3. **Firma y Contra-Firma sobre la Última Versión Activa:**
   - Ambas partes firman y contra-firman siempre sobre la versión más reciente emitida (`v1`, `v2`, `v3`...).
4. **Trazabilidad Inmutable en Base de Datos (`trq_version_contrato_socio`):**
   - Registro inmutable de cada versión, autor, rol (`ADMINISTRADOR`, `OPERADOR`, `SOLICITANTE`), timestamp, motivo y archivo PDF bi-firmado.
5. **Notificaciones Bidireccionales Clarificadas por Fase:**
   - *Fase 1 (Emisión/Ajuste):* `📋 Contrato de Sociedad (Versión N) Emitido — Revisa y Firma` (Operador ➔ Solicitante).
   - *Fase 2A (Observaciones):* `💬 Observaciones al Contrato (Versión N) de {nombre}` (Solicitante ➔ Staff).
   - *Fase 2B (Firma del Abogado):* `📄 Contrato (Versión N) Firmado por el Abogado — Listo para Contra-Firma` (Solicitante ➔ Staff).
   - *Fase 3 (Contra-Firma y Activación):* `🎉 ¡Bienvenido a tranqi! Contrato Bi-firmado y Activación Exitosa` (Staff ➔ Solicitante).

---

### TRQ-ABG-002 — Despacho Virtual y Expediente Digital
**Responsable:** Kleber Toapanta / Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Bandeja de causas asignadas, acceso a los documentos compartidos por los clientes, gestor de escritos judiciales y bitácora de actuaciones.

---

### TRQ-ABG-003 — Firma Electrónica Avanzada PAdES en Navegador (Zero-Custody)
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado y Verificado (100%)

#### Arquitectura de Criptografía sin Custodia en Servidor:
1. **Descifrado Local:** El navegador procesa el archivo `.p12`/`.pfx` mediante `node-forge` en memoria volátil (`ArrayBuffer`).
2. **Validación X.509:** Extracción en tiempo real del nombre del titular, cédula/RUC, entidad certificadora (Security Data, BCE, CJ, ANFAC, etc.), número de serie y período de validez.
3. **Estampa Visual PAdES:** Utilizando `pdf-lib`, se dibuja el recuadro oficial de firma con sello institucional, timestamp oficial de Ecuador (ECT), razón jurídica, número de serie y hash criptográfico SHA-256.
4. **Purga Inmediata de Memoria:** Las claves privadas y contraseñas se eliminan de la memoria inmediatamente tras generar el PDF firmado. **Nunca se transmiten por red ni se almacenan en servidores backend**.

---

### TRQ-ABG-004 — Agenda Profesional y Videoconsultas
**Responsable:** Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Calendario sincronizado de citas presenciales en despacho y salas de consulta telemática segura.

---

### TRQ-ABG-005 — Verificación Inteligente de Identidad y Documentos con Aria (IA) en Registro de Abogados
**Responsable:** **Jesus Navarrete (IA)** | **Estado:** 🟡 Especificado (25%)

#### 1. Descripción & Objetivos de Negocio
Integración del agente de IA multimodal **Aria** (`packages/agentes-ia`) en el flujo de postulación y registro de socios abogados (`/panel/solicitud-socio`). Aria valida en tiempo real la legibilidad y coherencia de la Cédula de Identidad/Pasaporte y ejecuta un **cotejo cruzado inmutable (Cross-Document Verification)** para certificar que el 100% de los documentos adjuntos (Título Universitario SENESCYT, Carnet del Foro de Abogados, RUC, Certificados) pertenezcan legítimamente a la misma persona registrada, previniendo suplantaciones y reduciendo la carga de auditoría humana en la Mesa de Control.

#### 2. Diagrama de Flujo de Inspección Inteligente de Identidad:

```mermaid
graph TD
    A["1. Postulante ingresa Nombres, Cédula y sube Identificación"] --> B["2. Aria analiza Documento de Identidad (OCR Multimodal)"]
    B --> C{"¿Coincide Cédula y Nombres del Formulario?"}
    C -->|No / Ilegible| D["❌ Alerta Inmediata: Documento ilegible o datos discordantes"]
    C -->|Sí| E["🟢 Identidad Base Certificada por Aria"]
    E --> F["3. Postulante carga Título SENESCYT, Matrícula del Foro y RUC"]
    F --> G["4. Aria ejecuta Cotejo Cruzado (Cross-Document Matching)"]
    G --> H{"¿Todos los documentos pertenecen al titular?"}
    H -->|Discordancia de Titular| I["🔴 Alerta Crítica: Documento pertenece a otra persona"]
    H -->|Coincidencia Plena| J["✅ Expediente 100% Validado por Aria listo para envío"]
    J --> K["5. Operador evalúa Dictamen con Score de Confianza en Mesa de Control"]
```

#### 3. Reglas de Negocio Estrictas:
1. **Extracción y Validación de Identidad Base:**
   - Aria extrae nombres, apellidos, número de identificación y fecha de caducidad de la cédula o pasaporte.
   - Si la similitud con los datos del formulario es `< 90%` o el Módulo 10 es inconsistente, se bloquea el avance con alerta explicativa.
2. **Cotejo Cruzado de Titularidad Única (Cross-Document Matching):**
   - Aria compara el titular extraído del Título SENESCYT, Matrícula del Foro de Abogados y RUC contra la Identidad Base validada.
   - Si se detecta un titular ajeno, se emite una alerta roja inmediata impidiendo el envío fraudulento.
3. **Semáforo de Confianza de Aria:**
   - 🟢 **90% - 100% (Aprobado):** Coincidencia plena.
   - 🟡 **70% - 89% (Observación):** Variación leve en nombres para revisión del operador.
   - 🔴 **< 70% (Rechazado):** Discrepancia crítica o documento ilegible.
4. **Persistencia e Inmutabilidad en Base de Datos:**
   - El dictamen de Aria se almacena en `tranqui_legal.trq_solicitud_socio.ssc_detalles` (`aria_validacion: { estado, score, documentos_auditados }`) y en `comun_auditoria.aud_registro`.

#### 4. Criterios de Aceptación (Gherkin):

```gherkin
Escenario: Validación exitosa de cédula concordante con el formulario
  Dado que el postulante ingresó "1719103986" y "Carlos Alberto Pérez Mena"
  Cuando sube la fotografía de su Cédula de Identidad en formato JPG
  Entonces Aria analiza la imagen en menos de 3 segundos
  Y muestra un distintivo verde: "✨ Identidad Validada por Aria: Carlos Alberto Pérez Mena (1719103986)"
  Y habilita la carga de los siguientes documentos probatorios.

Escenario: Detección de documento de título perteneciente a otra persona
  Dado que la Identidad Base validada pertenece a "Carlos Alberto Pérez Mena (1719103986)"
  Cuando el postulante sube un Título Universitario perteneciente a "María Fernanda López (1712345678)"
  Entonces Aria detecta la discrepancia de titular
  Y despliega una alerta: "⚠️ El documento cargado pertenece a María Fernanda López y no coincide con tu identidad"
  Y solicita volver a subir el documento correcto antes de permitir el envío.

Escenario: Mesa de Control con Dictamen de Aria para el Operador
  Dado que un operador ingresa a "/panel/socios" para evaluar una postulación
  Cuando abre el expediente del postulante
  Entonces visualiza la tarjeta "Inspección de Identidad Aria" con el desglose de similitud (100%), datos extraídos de cada documento y recomendación de aprobación directa.
```

#### 5. Contrato de API & Integración Técnica:
- **Endpoint:** `POST /api/agentes/aria-verificacion-identidad`
- **Request:** `{ usuarioId, tipoDocumento, archivoBase64, archivoNombre, datosReferencia: { nombres, apellidos, cedula } }`
- **Response:** `{ ok: true, data: { resultado: "APROBADO" | "OBSERVACION" | "RECHAZADO", scoreConfianza: number, datosExtraidos, concordancia, observaciones } }`

---

## 4. Módulos para el Rol Operador y Administrador

### TRQ-ADM-001 — Mesa de Control de Acreditación, Contra-Firma Tranqi y Activación
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado y Verificado (100%)

- Panel de evaluación de solicitudes (`/panel/socios` y `/panel/administrar`), validación de títulos SENESCYT y matrículas del Foro de Abogados, con exigencia estricta de MFA TOTP (`aal2`).
- **Módulo de Contra-Firma Digital Institucional:** El operador/administrador visualiza el contrato firmado por el abogado y ejecuta la contra-firma digital de Tranqi con certificado `.p12` institucional, generando el **Contrato Bi-firmado oficial**.
- **Activación Inmediata de Credenciales:** Al completar la contra-firma, se actualiza el registro en `trq_abogado`, se asigna el perfil `ABOGADO` en `seg_membresia_perfil` y se despacha la notificación formal de bienvenida.
- **Indicadores Contextuales de la Tabla de Socios:**
  - `🎉 Contrato Bi-firmado` ➔ Botón `Ver Expediente`.
  - `📄 Contrato Listo para Contra-firma` ➔ Botón `Contra-firmar y Activar`.
  - `📝 Propuesta Word (N)` ➔ Botón `Revisar Propuesta`.
  - `✍️ Esperando Firma del Abogado` ➔ Estado en espera.
  - `⏳ Postulación Inicial` ➔ Botón `Evaluar`.
- **Notificaciones Automáticas Multicanal (In-App, Push y Email):**
  - *Fase 1:* `📋 ¡Credenciales Validadas! — Descarga y Firma tu Contrato de Sociedad`.
  - *Fase 2:* `📄 Contrato Firmado Recibido — Listo para Verificación y Contra-Firma`.
  - *Fase 3:* `🎉 ¡Bienvenido a tranqi! Contrato Bi-firmado y Cuenta de Socio Abogado Activada`.

### TRQ-ADM-002 — Asignación de Casos y Liquidación de Honorarios
**Responsable:** Kleber Toapanta / Jesus Navarrete | **Estado:** ⏳ Pendiente (0%)
- Ruteo inteligente de causas a abogados según especialidad, carga procesal y provincia.
- Liquidación periódica de honorarios deduciendo la comisión de intermediación de la plataforma.

### TRQ-ADM-003 — Auditoría Transversal BDD y Telemetría
**Responsable:** Kleber Toapanta | **Estado:** ✅ Implementado (100%)
- Tablero DataGrid de auditoría en `/panel/auditoria` con trazabilidad Antes/Después por triggers en `comun_auditoria.aud_registro`.
