---
tipo: esp_funcional
estado: vigente
version: 1.0
fecha: 2026-08-17
responsables: Kleber Toapanta / Jesus Navarrete
---

# Tranqi — Especificación Funcional

**Prefijo de código de requerimiento:** `TRQ-xxx`  
**Esquema de Base de Datos:** `tranqui_legal` · **Prefijo de tablas:** `trq_`  
**Propietarios:** Tranqi Red Legal (Negocio Legaltech del Ecosistema)

**Sistema visual:** [`sistema-visual.md`](sistema-visual.md) — paleta, uso del color por perfil (cliente, abogado, administración) y maquetas de referencia. Aplica a `tranqi-web` y a las apps móviles.

**Regla de precedencia:** Esta especificación establece los criterios de aceptación y reglas de negocio no negociables para el producto Tranqi. Los agentes de codificación (Claude Code, Antigravity, Copilot, Cursor) e ingenieros deben implementar la lógica ajustándose estrictamente a este documento.

---

### Matriz de Responsables de Revisión, Implementación y Avance (%)

| Código | Funcionalidad / Requerimiento | Estado | Avance (%) | Responsable Asignado |
| :--- | :--- | :---: | :---: | :--- |
| **`TRQ-001`** | **Acreditación, Contratación y Onboarding de Socios Abogados** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-002`** | **Billetera Digital de Documentos Seguros & Enlaces Efímeros (TTL)** | 🟡 Especificado | **25%** | Kleber Toapanta |
| **`TRQ-003`** | **Gestión de Casos Judiciales y Patrocinio (`trq_caso_judicial`)** | ⏳ Pendiente | **0%** | Kleber Toapanta / Jesus Navarrete |
| **`TRQ-004`** | **Firma Electrónica Avanzada PAdES (Sin custodia de `.p12`)** | ⏳ Pendiente | **0%** | Jesus Navarrete |
| **`TRQ-005`** | **Directorio Público y Geolocalizado de Abogados Verificados** | ✅ Implementado | **100%** | Kleber Toapanta |
| **`TRQ-006`** | **Agendamiento de Citas Presenciales y Consultas Telemáticas** | ⏳ Pendiente | **0%** | Jesus Navarrete |
| **`TRQ-007`** | **Calculadora de Honorarios y Tarifas Legales Orientativas** | ⏳ Pendiente | **0%** | Jesus Navarrete |

---

## TRQ-001 — Acreditación, Contratación y Onboarding de Socios Abogados

**Responsable:** Kleber Toapanta  
**Estado:** ✅ Implementado y Verificado (100%)  

### Descripción
Flujo integral de postulación, acreditación profesional, verificación ante SENESCYT y Foro de Abogados, firma de contrato marco de prestación de servicios por intermediación tecnológica e incorporación oficial de socios al directorio jurídico de Tranqi.

### Reglas de Negocio Implementadas y Verificadas
1. **Pantalla Informativa Previa de Beneficios con Texto Editable:**
   - Antes de iniciar la postulación, el postulante visualiza una vista informativa con los beneficios clave de pertenecer a la red jurídica y un texto preliminar editable respaldado en la configuración común de términos (`incorporacion_red`).
2. **Formulario Modular de Postulación (5 Pasos):**
   - *Paso 1: Identificación y Acreditación:* Cédula, Matrícula del Foro de Abogados (Consejo de la Judicatura) y Universidad de egreso.
   - *Paso 2: Especialidades y Cobertura:* Materias de especialidad (`trq_materia`) y provincias de cobertura en Ecuador (`cat_provincia`).
   - *Paso 3: Trayectoria Laboral:* Experiencia previa con soporte para la opción *"No tengo experiencia previa (Primera Oportunidad)"* para noveles abogados.
   - *Paso 4: Verificación Asistida:* Declaración juramentada y enlaces de validación en SENESCYT y Foro de Abogados.
   - *Paso 5: Carga de Documentos:* Fotografía de perfil, copia de cédula, título universitario, matrícula y hoja de vida (CV), almacenados bajo la convención de repositorio estructurado en Supabase Storage (`TRANQ/{usuario_id}/registro-socio/{solicitud_id}/...`).
3. **MFA Obligatorio para Administradores y Operadores (`aal2` TOTP):**
   - La evaluación y resolución de postulaciones en `/panel/socios` exige sesión con autenticación de dos factores (`MFA TOTP`) verificada en interfaz, RLS y RPC.
4. **Ciclo de Vida de Solicitud Activa en Home (`/panel`):**
   - El postulante con solicitud en curso o no finalizada dispone de una tarjeta de gestión activa con opciones de:
     - *✏️ Continuar / Editar:* Para completar campos o actualizar observaciones.
     - *🔄 Reiniciar:* Limpieza integral de datos para comenzar desde cero.
     - *🗑️ Eliminar:* Supresión total y cancelación mediante Stored Procedure `trq_fn_eliminar_solicitud_propia()`.
5. **Generación Nativa de Contrato en Word (.docx OpenXML) y Vista de Impresión:**
   - Plantilla configurable en base de datos (`trq_plantilla_contrato`) con soporte para variables dinámicas `{{nombre_completo}}` y `{{cedula}}`.
   - Generación de binarios `.docx` OpenXML válidos mediante la biblioteca `docx` para compatibilidad absoluta con Microsoft Word 365 / 2021 sin alertas de formato.
   - Vista web de impresión limpia (`/panel/solicitud-socio/contrato/imprimir`) adaptada para guardado directo en PDF (Ctrl+P).
6. **Carga y Validación del Contrato Firmado:**
   - Soporte para subida de contratos en formato PDF o Word (`.docx`), catalogados bajo `dcs_tipo = 'contrato_socio'` con fallback automático y constraint ampliado en PostgreSQL.
7. **Notificación Multicanal Instantánea a Staff y Solicitante:**
   - Despacho simultáneo a través de 3 canales: **In-App**, **Push** y **Email (SMTP)** tanto para el postulante como para todos los administradores, superadministradores y operadores asignados a la membresía `TRANQ`.
   - Reenvío interactivo de alertas de aprobación con 1 clic por parte del operador.
8. **Centro de Notificaciones Interactivo con 3 Acciones:**
   - *✅ Aceptar:* Marca como leída y archiva en la pestaña *Historial*.
   - *⏰ Posponer:* Pausa temporal de la alerta por 3h, 6h, 12h, 24h o rango personalizado.
   - *🗑️ Eliminar:* Descarte para el usuario manteniendo el registro inmutable para auditoría BDD.
9. **Publicación en Directorio y Asignación de Rol `ABOGADO`:**
   - La confirmación definitiva activa la membresía profesional y expone la tarjeta del abogado en el carrusel público de la landing page (`/api/abogados-publicos`).

---

## TRQ-002 — Billetera Digital de Documentos Seguros y Enlaces Efímeros (TTL)

**Responsable:** Kleber Toapanta  
**Estado:** 🟡 Especificado / En Diseño (25%)  

### Descripción
Módulo de almacenamiento, custodia y gestión inteligente de documentos de identidad, legales y comerciales de uso frecuente para clientes y abogados, permitiendo compartición segura mediante enlaces efímeros con tiempo de vida limitado (*Time-To-Live - TTL*) y alertas automáticas de caducidad.

### Reglas de Negocio
1. **Tipología de Documentos Soportados:**
   - *Identificación Personal y Familiar:* Cédulas del titular, cónyuge e hijos, Licencia de Conducir, Pasaporte.
   - *Documentos Vehiculares:* Matrícula vehicular, SOAT/Pólizas de seguro automotriz.
   - *Contratos y Servicios:* Contratos de arrendamiento, pólizas médicas, servicios residenciales (Internet, luz, agua).
   - *Títulos y Certificados Profesionales:* Títulos académicos, certificados de votación, nombramientos.
2. **Custodia y Cifrado en Repositorio Estructurado:**
   - Los archivos se almacenan en el bucket privado de Supabase bajo la ruta:
     `TRANQ/{usuario_id}/billetera-documentos/{categoria}/{doc_id}-{nombre_sanitizado}`.
   - Cifrado de metadatos sensibles y protección mediante Row Level Security (RLS) restringida al propietario y roles autorizados.
3. **Extracción de Metadatos y Reconocimiento Inteligente (OCR):**
   - Procesamiento del documento para extracción automática de:
     - Número de documento / identificación.
     - Nombres del titular.
     - Fecha de emisión.
     - Fecha de vencimiento / caducidad.
     - Entidad emisora.
4. **Sistema Proactivo de Alertas de Vencimiento:**
   - Motor de alertas automáticas multicanal (In-App, Push y Email) programadas a los **30 días, 15 días y 7 días previos** a la caducidad de licencias de conducir, pólizas de seguros, contratos y cédulas.
5. **Compartición Segura con Enlace Efímero y Destrucción Automática (TTL):**
   - El usuario puede generar un enlace público temporal protegido por token criptográfico único para compartir un documento con terceros (ej. trámites bancarios, notarías, juzgados).
   - **Modos de Expiración (TTL):**
     - *Por Horas:* 1 hora, 3 horas, 6 horas, 12 horas, 24 horas.
     - *Por Días:* 3 días, 7 días, 15 días, 30 días.
     - *Una Sola Vista ("Burn on Read"):* El enlace expira y se destruye inmediatamente tras la primera descarga o visualización exitosa.
     - *Personalizado con PIN opcional:* Fecha/hora específica de expiración con clave numérica de 4 dígitos.
6. **Trazabilidad y Bitácora de Accesos:**
   - Registro de auditoría por cada visualización externa (fecha, hora, dirección IP y estado del enlace). Posibilidad de revocar el enlace en cualquier momento antes de su expiración.

---

## TRQ-003 — Gestión de Casos Judiciales y Patrocinio (`trq_caso_judicial`)

**Responsables:** Kleber Toapanta / Jesus Navarrete  
**Estado:** ⏳ Pendiente (0%)  

### Descripción
Expediente digital integral para el registro, seguimiento procesal, asignación de abogados patrocinadores, cálculo de etapas y bitácora de actuaciones judiciales en juzgados y tribunales del Ecuador.

---

## TRQ-004 — Firma Electrónica Avanzada PAdES

**Responsable:** Jesus Navarrete  
**Estado:** ⏳ Pendiente (0%)  

### Descripción
Firma electrónica de escritos jurídicos, peticiones y contratos en formato PDF (estándar PAdES) mediante certificado de firma digital ecuatoriana (`.p12` / BCE, Security Data, ANF, UANATACA), ejecutada de forma local en el navegador del cliente/abogado **sin custodia del archivo `.p12` ni de la contraseña en los servidores**.

---

## TRQ-005 — Directorio Público de Abogados Verificados

**Responsable:** Kleber Toapanta  
**Estado:** ✅ Implementado y Verificado (100%)  

### Descripción
Directorio público y carrusel de abogados activos en la landing page de Tranqi (`/api/abogados-publicos`), con filtro por materias de práctica jurídica y provincias de atención.

---

## TRQ-006 — Agendamiento de Citas Presenciales y Telemáticas

**Responsable:** Jesus Navarrete  
**Estado:** ⏳ Pendiente (0%)  

### Descripción
Sistema de calendario y agenda en tiempo real que permite al cliente reservar asesorías presenciales en oficina o consultas jurídicas por videollamada segura con un socio abogado calificado.

---

## TRQ-007 — Calculadora de Honorarios y Tarifas Orientativas

**Responsable:** Jesus Navarrete  
**Estado:** ⏳ Pendiente (0%)  

### Descripción
Herramienta pública y para suscriptores que estima costos judiciales, pensiones alimenticias (según la tabla del MIES/Consejo de la Judicatura) e indemnizaciones laborales conforme al Código del Trabajo del Ecuador.
