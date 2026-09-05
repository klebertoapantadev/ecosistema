# Catálogo y Portafolio de Productos — Tranqi Legaltech

**Negocio:** `tranqi`  
**Estado:** Propuesta Preliminar (Precios supuestos para calibración legal y comercial)  
**Esquema de Base de Datos:** `comun_comercio` (Filtrado por `*_negocio = 'tranqi'`)  
**Política Fiscal:** B2C / B2B — Precios cotizados como Subtotal (más IVA 15%), o desglosados en honorarios exentos/tasas notariales según corresponda.  

---

## 1. Categorías de Navegación (`com_categoria`)

| Código Categ. | Nombre Visible | Descripción | Orden |
| :--- | :--- | :--- | :--- |
| `TRQ_TRAMITES`   | **Trámites Puntuales** | Trámites con honorarios fijos y alcance estandarizado. | 1 |
| `TRQ_PLANES_B2C` | **Planes Familiares** | Suscripción de protección y asesoría jurídica continua. | 2 |
| `TRQ_CORP_B2B`   | **Planes Corporativos** | Cobertura legal para empresas y colaboradores por tramos. | 3 |
| `TRQ_PROCESOS`   | **Procesos Judiciales** | Litigios, divorcios y trámites complejos bajo demanda. | 4 |

---

## 2. Productos Maestros y Variantes (`com_producto` y `com_variante`)

### A. Categoría: Trámites Puntuales (`TRQ_TRAMITES`)
1. **Notarización de Documentos:**
   * `TRQ-NOT-DOC`: Notarización y Gestión en Notaría — Subtotal: **$200.00** + IVA.
     * Tipo: `SERVICIO_PUNTUAL`.
2. **Permiso de Salida del País (Menores):**
   * `TRQ-SAL-PAI`: Trámite Integral de Salida de Menores — Subtotal: **$150.00** + IVA.
3. **Revisión Express de Contratos:**
   * `TRQ-REV-CON`: Análisis de Contrato de Arriendo/Servicios (hasta 10 págs.) — Subtotal: **$80.00** + IVA.

---

### B. Categoría: Planes de Protección Jurídica B2C (`TRQ_PLANES_B2C`)
*Suscripciones recurrentes mensualizadas o anuales (`com_suscripcion`):*
1. `TRQ-PLAN-BAS`: **Plan Básico Individual** — **$20.00 / mes**
   * Cobertura: 1 consulta legal telemática mensual + revisión de 1 contrato al año.
2. `TRQ-PLAN-MED`: **Plan Medio / Profesionales** — **$30.00 / mes**
   * Cobertura: 3 consultas mensuales + 2 revisiones de contratos + 1 poder notarial al año.
3. `TRQ-PLAN-PLUS`: **Plan Plus Familiar** — **$50.00 / mes**
   * Cobertura: Consultas ilimitadas para el núcleo familiar + 50% descuento en honorarios litigiosos.

---

### C. Categoría: Planes Corporativos B2B (`TRQ_CORP_B2B`)
*Modelo de licenciamiento por tramos de empleados (Seat-Based Pricing):*
* **Tramo 1 (1 a 10 colaboradores):** **15% Descuento** sobre precio lista por colaborador.
* **Tramo 2 (11 a 50 colaboradores):** **20% Descuento** sobre precio lista por colaborador.
* **Tramo 3 (> 50 colaboradores):** **25% Descuento** + Abogado empresarial asignado.

---

### D. Categoría: Procesos Complejos Bajo Demanda (`TRQ_PROCESOS`)
* Flujo mediante **Proforma / Cotización (`com_proforma`)**:
  * Definición de honorarios fijos o por etapas (Hito de inicio, audiencia preliminar, sentencia).
  * Admite ítems libres ad-hoc (tasas judiciales, peritajes, publicaciones en prensa).

---

## 3. Mecanismo B2B2C: Activación y Descubrimiento de Beneficios Corporativos

Para casos donde una empresa (ej. *Banco del Pichincha*) contrata el plan corporativo (ej. **Tramo 3**) como beneficio para sus colaboradores:

### Flujo de Nómina y Descubrimiento del Beneficio:
1. **Carga de Nómina por la Empresa:** La empresa cliente carga un archivo o nómina con: `Cédula de Identidad`, `Correo Corporativo` (`@pichincha.com`) y `Nombres` del personal activo.
2. **Detección Automática por Cédula (Onboarding Tranqi):**
   * Aunque el colaborador se registre con su **correo personal** (ej. `kleber.toapanta@gmail.com` o Google OAuth), al ingresar su cédula en el onboarding obligatorio de Tranqi (`PLT-001`), el sistema hace match con la nómina de Banco Pichincha.
   * La interfaz notifica: *"¡Hola! Identificamos que perteneces a Banco del Pichincha. Tienes activado el Plan Corporativo Tramo 3 con 100% de subsidio por tu empresa."*
3. **Autoservicio vía OTP Corporativo (Reclamo de Beneficio):**
   * Si el usuario no ingresó cédula o ya tiene cuenta personal creada, en su perfil puede presionar: `[ ¿Tu empresa tiene convenio con Tranqi? Reclamar beneficio ]`.
   * Ingresa su correo de trabajo (`ktoapanta@pichincha.com`). El sistema despacha un OTP de 6 dígitos a su bandeja corporativa.
   * Al validar el código, su cuenta personal queda enlazada al convenio corporativo de forma segura y verificada.
4. **Modelo de Datos Común:** Se implementa mediante las tablas transversales `com_convenio_empresa` y `com_beneficiario_empresa` en `comun_comercio`, reutilizables para convenios corporativos en cualquiera de los negocios del ecosistema.

---

## 4. Precios Dinámicos por Membresía y Billetera Digital (`com_billetera`)

### A. Precios con Descuento por Suscripción Activa (*Member-Tier Pricing*)
* **Escenario:** Un trámite como **Notarización de Documentos** tiene un precio de lista de **$150.00**.
* **Regla de Negocio:** Si el cliente tiene una suscripción activa a un plan (ej. *Plan Básico Individual*), el motor de checkout `@eco/comercio` detecta su membresía en `com_suscripcion` y aplica automáticamente el **15% de descuento**.
  * **Cálculo:** Precio Base: `$150.00` | Descuento Miembro (-15%): `-$22.50` | **Subtotal a Pagar: $127.50** + IVA.

### B. Convenio Institucional Municipio de Quito (Bono de $100 y Billetera Digital)
* **Escenario:** El Municipio de Quito firma un convenio social e institucional con Tranqi para entregar un **Bono de $100.00** a colaboradores o participantes de un programa social.
* **Acreditación en Billetera:**
  * Al activarse el beneficio (por Cédula o nómina), se crea o actualiza la billetera del usuario en `com_billetera` con `wlt_saldo_bono = $100.00`.
  * Se registra el movimiento auditable en `com_billetera_movimiento` (`tipo: 'BONO_CONVENIO'`, monto: `+$100.00`, referencia al convenio del Municipio).
* **Recargas con Tarjeta de Crédito:**
  * El usuario puede recargar saldo prepagado en cualquier momento desde la app o web (`wlt_saldo_recarga`), pagando con TC/TD.
* **Pago Mixto (*Split Payment*) y Selección Activa de Saldo:**
  * En el checkout, el cliente **elige activamente qué saldo desea utilizar** (saldo de recarga en dinero real vs. saldo de bono promocional).
  * Si utiliza el bono de $100.00:
    1. El sistema descuenta los **$100.00 del bono** seleccionado.
    2. El saldo restante (**$27.50**) lo paga con su saldo de recarga o directamente con tarjeta en el checkout.
  * La factura electrónica del SRI se emite por el valor total legal con las formas de pago debidamente desglosadas.
* **Política de Reembolso Asimétrico:**
  * Si la orden o cita es cancelada dentro del tiempo permitido, el valor cubierto por el bono regresa a la billetera como saldo de bono (manteniendo su vencimiento original), y el dinero real regresa a la tarjeta o saldo de recarga.
* **Vigencia Configurable:**
  * La vigencia de cupones (ej. cupón de lanzamiento 'Primera Consulta Gratis') y bonos de billetera se define de forma personalizada por campaña (`cup_valido_hasta` / `wlm_expira_en`).

---

## 5. Logística Legal: Couriers Motorizados y Traslado de Documentos Físicos (`com_proveedor_servicio` y `com_despacho_asignacion`)

Aunque Tranqi es una plataforma LegalTech digital, trámites sensibles exigen movilización de documentos físicos (escrituras originales, poderes especiales en papel sellado notarial, copias certificadas del Registro de la Propiedad, contratos con firmas manuscritas):

1. **Directorio de Couriers y Mensajería Legal:**
   - Registro en `com_proveedor_servicio` de motorizados de confianza, mensajerías judiciales y empresas de encomienda autorizadas.
2. **Cobertura Urbana Base + Recargo Geográfico:**
   - El servicio de mensajería motorizada para retiro y entrega está **incluido en el precio del trámite dentro del perímetro urbano base** (ej. Quito Urbano).
   - Para zonas periféricas o valles (Cumbayá, Tumbaco, Los Chillos), el sistema calcula y añade un **adicional logístico** según tarifario.
3. **Asignación Vinculada al Trámite (`com_despacho_asignacion`):**
   - El abogado u operador despacha un retiro/entrega indicando origen, destino (ej. *Notaría 16 de Quito* / *Domicilio del Cliente*) e instrucciones especiales de confidencialidad.
4. **Control y Evidencia de Recepción (POD):**
   - Registro de número de guía, teléfono del motorizado y carga obligatoria del **Acuse de Recibo Firmado** o acta notarial digitalizada.

---

## 6. Agendamiento de Consultas Jurídicas y Citas Virtuales

1. **Asignación Híbrida de Abogados (Algorítmica + Manual + Contingencia):**
   - **Asignación Inicial:** El sistema asigna automáticamente al abogado disponible por turno rotativo (*Round-Robin*) según la materia jurídica solicitada.
   - **Reasignación Manual por Operador:** El administrador u operador de Tranqi puede reasignar el caso del Abogado 1 al Abogado 2 en cualquier momento desde su panel de control si la complejidad del trámite lo amerita.
   - **Contingencia por Cancelación:** Si el abogado asignado cancela la cita, el sistema genera una alerta prioritaria en la consola del operador para que reasigne a otro abogado disponible de inmediato, evitando cancelar la cita del cliente.
2. **Generación Automática de Google Meet:**
   - Para citas virtuales, la plataforma invoca la Google Calendar API generando automáticamente la sala de **Google Meet**.
   - El enlace queda sincronizado en el calendario corporativo/personal del abogado y disponible en la tarjeta de la cita del portal web del cliente.

---

## 7. Esquema Flexible de Liquidación a Socios Abogados

Tranqi implementa un **Motor de Liquidación Multi-Esquema** según el perfil o contrato del socio:
* **Modalidad A — Tarifa Plana Estándar:** Valor fijo general por servicio o consulta.
* **Modalidad B — Tarifa por Hora de Asesoría:** Para casos complejos o litigios prolongados según bitácora de tiempo.
* **Modalidad C — Tarifa Fija por Tipo de Trámite:** Acuerdos específicos por trámite (ej. Notarización $60, Divorcio por mutuo acuerdo $200).
* **Modalidad D — Comisión Porcentual por Caso:** Porcentaje pactado sobre el cobro facturado (ej. 75% abogado / 25% plataforma Tranqi).




