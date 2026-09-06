# Glosario Técnico y de Términos — Plataforma Transversal

**Ámbito:** Plataforma Ecosistema (Común a todas las aplicaciones)  
**Esquemas:** `comun_seguridad`, `comun_auditoria`, `comun_facturacion`, `comun_catalogo`, `comun_agentes`, `comun_comercio`, `comun_agenda`  
**Ubicación:** `gobernanza/productos/plataforma/glosario-plataforma.md`  

---

## 1. Arquitectura de Software y Base de Datos

| Sigla / Término | Significado | Explicación Sencilla y Aplicación en Plataforma |
| :--- | :--- | :--- |
| **ADR** | *Architectural Decision Record* (**Registro de Decisión de Arquitectura**) | Documento breve que registra una decisión técnica clave, el motivo de su adopción y las alternativas descartadas. <br>*Ejemplo: [ADR-0003](../../arquitectura/adr/0003-catalogo-comercial-unificado.md) fijó que el catálogo comercial es unificado en `comun_comercio`.* |
| **DDL** | *Data Definition Language* (**Lenguaje de Definición de Datos**) | Sentencias SQL que definen o alteran la estructura de tablas, esquemas, índices y restricciones (`CREATE`, `ALTER`, `DROP`). |
| **DML** | *Data Manipulation Language* (**Lenguaje de Manipulación de Datos**) | Sentencias SQL que operan sobre los datos reales almacenados (`INSERT`, `UPDATE`, `DELETE`, `SELECT`). |
| **RLS** | *Row Level Security* (**Seguridad a Nivel de Filas**) | Mecanismo del motor PostgreSQL donde las políticas de base de datos filtran automáticamente qué filas puede ver o modificar un usuario según su JWT y rol. **Obligatorio al 100% de las tablas**. |
| **RPC** | *Remote Procedure Call* (**Llamada a Procedimiento Remoto**) | Función programada en la base de datos (`SECURITY DEFINER`) que ejecuta transacciones seguras y complejas en una sola llamada atómica. |
| **RBAC** | *Role-Based Access Control* (**Control de Acceso Basado en Roles**) | Modelo de seguridad donde los privilegios se asignan a roles definidos (`SUPERADMIN`, `ADMINISTRADOR`, `OPERADOR`, `CLIENTE`, etc.) en `comun_seguridad.seg_rol`. |
| **Multi-Tenancy** | **Multi-Inquilino** | Arquitectura donde 4 negocios (Tranqi, FastFix, Tinkay, Margaritas) comparten una única base de datos Supabase mediante esquemas dedicados y paquetes compartidos. |
| **Idempotencia** | *Idempotence* | Propiedad por la cual una operación repetida con los mismos parámetros produce el mismo resultado sin duplicar registros ni transacciones. |
| **Strategy Pattern** | **Patrón Estrategia** | Patrón donde la lógica común se parametriza mediante configuración por negocio, evitando condicionales `if/else` por nombre de empresa. |
| **Pista de Auditoría** | *Audit Trail* | Registro histórico inmutable Antes/Después en `comun_auditoria.aud_registro` accionado por el trigger universal `aud_fn_auditar_tabla()`. |

---

## 2. Identidad, Seguridad y Criptografía

| Sigla / Término | Significado | Explicación Sencilla y Aplicación en Plataforma |
| :--- | :--- | :--- |
| **MFA / 2FA** | *Multi-Factor Authentication* | Autenticación de doble factor mediante TOTP (Google Authenticator) con nivel estricto `aal2` requerido para operadores y administradores. |
| **JWT** | *JSON Web Token* | Token criptográfico firmado por Supabase Auth que autentica la identidad y membresías del usuario en cada petición HTTP. |
| **Zero-Custody** | **Cero Custodia de Claves** | Principio de arquitectura donde claves privadas, certificados `.p12` y contraseñas se procesan en la memoria RAM del navegador y **nunca se envían al servidor**. |
| **TTL** | *Time-To-Live* (**Tiempo de Vida**) | Token con caducidad temporal configurada para compartir documentos o accesos efímeros protegidos. |
| **Column-Level Grant** | **Permisos por Columna** | Regla de seguridad donde se revoca el `UPDATE` total de una tabla y solo se otorga `GRANT UPDATE` a columnas específicas no privilegiadas para evitar escalación de privilegios. |

---

## 3. Inteligencia Artificial ARIA y Protocolos

| Sigla / Término | Significado | Explicación Sencilla y Aplicación en Plataforma |
| :--- | :--- | :--- |
| **ARIA** | **Agente Conversacional del Ecosistema** | Capa unificada de agentes inteligentes basados en `packages/agentes-ia` para atención al cliente, soporte, OCR y co-piloto operativo. |
| **HITL** | *Human-in-the-Loop* (**Supervisión Humana en Vivo**) | Consola dual donde ARIA atiende de forma autónoma pero permite al operador humano intervenir, corregir o asumir el control del chat en vivo. |
| **OCR Multimodal** | *Optical Character Recognition* | Visión artificial de ARIA para extraer datos de comprobantes bancarios, cédulas de identidad, títulos y expedientes escaneados. |
| **MCP** | *Model Context Protocol* | Protocolo que permite a los modelos de lenguaje invocar herramientas backend de forma segura bajo el contexto RLS del usuario en sesión. |
| **Conversational Intake** | **Toma de Pedido Conversacional** | Flujo donde ARIA recopila todos los datos de un pedido o consulta directamente dentro del chat (Web/WhatsApp) sin redirecciones externas. |

---

## 4. Finanzas, Comercio y Facturación (SRI)

| Sigla / Término | Significado | Explicación Sencilla y Aplicación en Plataforma |
| :--- | :--- | :--- |
| **Centavos Enteros** | **Estándar Monetario `INTEGER`** | Norma de almacenar todo valor monetario en centavos enteros (`INTEGER`) en la base de datos para evitar errores de coma flotante (ej. $25.00 = `2500`). |
| **SRI** | **Servicio de Rentas Internas** | Autoridad tributaria oficial de la República del Ecuador. |
| **RIDE** | *Representación Impresa de Documento Electrónico* | Formato PDF visual oficial de una factura electrónica autorizada por el SRI. |
| **Clave de Acceso** | **Código de 49 Dígitos del SRI** | Identificador numérico único generado para cada comprobante electrónico emitido. |
| **CPQ** | *Configure, Price, Quote* | Motor para configurar variantes, aplicar recargos o descuentos y emitir proformas interactivas. |
| **Split Payment** | **Pago Mixto o Dividido** | Liquidación de una misma compra combinando saldo de billetera digital con tarjeta de crédito o transferencia. |
| **Base Comisionable Neta** | *Net Commissionable Base* | Valor residual de la venta sobre el cual se calcula la comisión de asesores o socios tras descontar fletes reales, impuestos y pasarelas. |
| **Deuna / Payphone / Nuvei** | **Pasarelas de Pago** | Canales integrados: cobro instantáneo QR Deuna (Banco Pichincha), links Payphone y procesamiento de tarjetas con 3D Secure. |
