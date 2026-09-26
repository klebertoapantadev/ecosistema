# Guía Operativa: CRM Jurídico y Gestión 360° de Clientes (Tranqi)

**Ubicación:** `gobernanza/manuales/guia-operativa-crm-clientes-tranqi.md`  
**Módulo:** CRM Jurídico y Recepción de Clientes (`TRQ-CRM-001`)  
**Aplicación:** Tranqi Web (`apps/tranqi-web`) — `/panel/usuarios?widget=crm_clientes`  
**Última actualización:** 2026-09-26  

---

## 1. Visión General del Módulo

El **CRM Jurídico y Recepción de Clientes** centraliza la captación, custodia documental, ciclo de vida y trazabilidad de los clientes (Personas Naturales y Jurídicas) del estudio legal Tranqi. 

Permite:
- **Alta manual asistida** con extracción inteligente de documentos por **ARIA IA OCR**.
- **Auto-sincronización de leads web** como prospectos.
- **Verificación en tiempo real de conflicto de intereses (*Conflict Check*)**.
- **Custodia automática en la Billetera Digital Universal** de documentos de identidad y nombramientos.
- **Envío automático de invitaciones por correo electrónico** para acceso al portal web.

---

## 2. Flujo de Alta Asistida de Cliente

1. **Ingreso al Módulo:**
   - En el menú lateral de navegación, acceder a **Usuarios ➔ CRM Jurídico & Clientes** o pulsar `[+ Registrar Cliente]`.
2. **Selección de Personería:**
   - **Persona Natural:** Se ingresa Cédula (con validación de algoritmo Módulo 10) o Pasaporte. Es mandatorio adjuntar el documento de identidad; ARIA extraerá automáticamente nombres, apellidos, nacionalidad, fecha/lugar de nacimiento, estado civil, cónyuge y caducidad.
   - **Persona Jurídica (Empresa / S.A.S.):** Se ingresa RUC de 13 dígitos y se adjuntan la Cédula del Representante Legal y el Nombramiento inscrito en el Registro Mercantil. ARIA validará la vigencia y facultades del nombramiento.
3. **Manejo de Apoderados / Representación Legal Opcional:**
   - Para personas naturales que actúan mediante apoderado general o especial, albacea o tutor, se activa la casilla correspondiente para registrar la calidad de la representación y notaría de protocolización.
4. **Envío Automático de Correo de Invitación:**
   - Si se ingresa un correo electrónico para el cliente, el sistema despacha automáticamente una invitación oficial (`🏛️ Bienvenido a Tranqi: Activa tu Portal Jurídico Digital`) con enlace de acceso seguro a la plataforma.
5. **Acciones de Continuidad:**
   - `[Solo Guardar]`: Guarda el perfil en el CRM.
   - `[Guardar y Radicar Expediente]`: Registra al cliente y abre el formulario para crear un expediente o causa judicial.
   - `[Guardar y Agendar Cita]`: Registra al cliente y abre el agendador de turnos y videoconsultas.

---

## 3. Estados del Cliente y Ciclo de Vida Comercial

| Estado | Badge Visual | Descripción y Criterio de Activación |
| :--- | :---: | :--- |
| **Inactivo (Pendiente de Pago)** | 🟡 Ámbar | **Estado inicial por defecto.** El cliente fue registrado manualmente o captado en el mostrador pero aún no ha realizado un pago de suscripción o abono de honorarios. |
| **Activo** | 🟢 Verde | **Cliente confirmado y habilitado.** Se activa automáticamente tras confirmarse un pago (vía pasarela Payphone, abono bancario o suscripción) o cuando un operador autorizado pulsa `[Activar]`. |
| **Prospecto** | 🔵 Azul | Usuario auto-registrado en la web pendiente de formalización de datos o consulta de primera cita. |
| **Inactivo** | ⚪ Gris | Cliente que ha sido pausado temporalmente o dado de baja sin borrar su historial legal. |

---

## 4. Edición de Datos del Cliente

Para modificar datos personales, de contacto o corporativos de un cliente:
1. Desde la **Bandeja de Clientes**, pulsar el botón `[Editar]` con el ícono del lápiz en la fila del cliente (o ingresar a su **Ficha 360°** y pulsar `[Editar Datos]`).
2. El formulario precargará la totalidad de los datos registrados (filiación, cónyuge, domicilio, casilleros judiciales, representante legal).
3. Modificar los campos necesarios y pulsar `[Guardar Cambios]`.
4. La actualización sincroniza automáticamente la identidad y registra un evento inmutable en la bitácora de auditoría (`comun_auditoria.aud_registro`) indicando qué operador ejecutó el cambio.

---

## 5. Reglas de Integridad: Prohibición de Eliminación de Clientes

Por normativa procesal, custodia de evidencias y principios de auditoría legal:
- **Ningún cliente que posea expedientes judiciales o causas creadas (`trq_caso_judicial`) puede ser eliminado.**
- **Ningún cliente con citas agendadas (`trq_cita`) o con pagos/honorarios facturados (`trq_honorario`) puede ser eliminado.**
- **Ningún cliente activo puede ser eliminado directamente.**

### Procedimiento de Inactivación Lógica:
En lugar de eliminar, los operadores deben pulsar el botón `[Inactivar]`. Esto inhabilita el acceso del cliente y lo oculta de las operaciones cotidianas, pero preserva íntegramente su historial procesal, expedientes y documentos para fines judiciales y regulatorios.

---

## 6. Ficha 360° y Auditoría de Responsables

Al pulsar `[Ficha 360°]`, se accede a la consola unificada del cliente:
- **📋 Datos Generales:** Contacto, casillero físico y electrónico, cónyuge y datos del Representante Legal.
- **📁 Expedientes:** Listado de causas judiciales con su código procesal (`TRQ-MAT-...`) y etapa actual.
- **📅 Citas & Agenda:** Historial de turnos y videoconsultas de asesoría jurídica.
- **📂 Billetera Documental:** Acceso directo a los documentos de identidad, poderes y nombramientos custodiados.
- **🕒 Tracking & Auditoría:** Línea de tiempo cronológica inmutable que registra quién dio de alta al cliente, quién visualizó su ficha, quién modificó sus datos y quién cambió su estado.
