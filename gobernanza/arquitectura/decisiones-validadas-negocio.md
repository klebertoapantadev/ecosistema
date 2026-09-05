# Decisiones Validadas de Arquitectura, Modelos de Datos y Operación

**Fecha:** 2026-09-05  
**Participantes:** Kleber Toapanta (Líder de Negocio y Producto) / Antigravity (Arquitecto y Product Owner)  
**Alcance:** Consolidación de reglas de negocio para el Núcleo Común de Plataforma y los 4 negocios del ecosistema (*Tranqi*, *FastFix Home*, *Tinkay*, *Margaritas Floristería*), con foco prioritario en el lanzamiento de Tranqi.

---

## 1. Núcleo Global de Plataforma

### A. Billetera Digital y Pagos Divididos (*Split Payment*)
1. **Control de Débito Transparente en el Checkout:**
   * El sistema **NO** fuerza un débito ciego; la interfaz del checkout le permite al usuario **elegir activamente qué saldo desea utilizar** (saldo de dinero real recargado vs. saldo de bonos/subsidios con vencimiento).
2. **Política de Reembolso Asimétrico:**
   * Si una orden pagada de forma mixta (Bono + Tarjeta) es cancelada dentro del tiempo reglamentario:
     * El saldo cubierto con **Bono** se reintegra a la billetera como saldo de bono, **preservando su fecha de caducidad original**.
     * El monto pagado en **Dinero Real / Tarjeta** se reembolsa a la tarjeta o al saldo de recarga propio del cliente (sin caducidad).
3. **Vigencia Configurable por Promoción / Cupón:**
   * La caducidad de los bonos promocionales no es rígida ni fija: cada cupón o convenio define individualmente sus fechas de inicio y caducidad (`cup_valido_hasta`, `wlm_expira_en`), otorgando máxima flexibilidad comercial a cada campaña.

### B. Emisión Tributaria SRI y Multi-Tenant Legal (`comun_facturacion`)
4. **Independencia de RUC por Negocio:**
   * Cada negocio del ecosistema posee su propia **Razón Social, RUC, Certificado de Firma Electrónica (.p12) y Secuenciales de Emisión propios** ante el SRI.
   * La plataforma gestiona las credenciales de forma aislada y segura en el Vault de configuración por tenant (`PLT-008`).

### C. Logística Híbrida y Gestión de Proveedores (`com_proveedor_servicio` / `com_despacho_asignacion`)
5. **Privacidad del Enlace de Rastreo en Vivo:**
   * El enlace de seguimiento en tiempo real (Uber / Cabify / GPS del taxista) y el contacto del chofer son de **uso estrictamente interno para la coordinadora del taller u operador**.
   * El cliente final recibe actualizaciones de estado oficiales de la marca (ej. *"Tu pedido va en camino"*), protegiendo la relación con el cliente ante eventuales cancelaciones o cambios de vehículo por parte de las aplicaciones de terceros.
6. **Reporte de Cuentas por Pagar y Liquidación Periódica:**
   * La plataforma acumula los costos reales de despacho y servicios tercerizados asignados (`dsp_costo_envio`).
   * Genera automáticamente un reporte de **Cuentas por Pagar a Proveedores / Transportistas** con cortes semanales o quincenales para facilitar la conciliación y pago administrativo.

### D. Inventario JIT y Ventas Anticipadas sin Stock Físico Inmediato
7. **Modo 'Bajo Demanda' (Just-in-Time - JIT):**
   * El catálogo permite la venta anticipada de productos sin requerir stock físico en almacén al momento de la compra (esencial para flores frescas del 14 de febrero en Tinkay o repuestos bajo proforma en FastFix).
   * **Planificador de Compras (Explosión de Insumos BOM):** El sistema calcula automáticamente la consolidación de materias primas necesarias por fecha de despacho (ej. *"Para el 13 de febrero se requieren 500 rosas rojas y 120 papeles coreanos"*).
   * Al pasar la orden a estado *"En Elaboración"* o *"Despacho"*, el sistema regulariza el consumo en el Kardex automáticamente sin trabar el flujo operativo.

### E. Motor Universal de Liquidación de Comisiones y Gastos Operativos Deducibles
8. **Fórmula de Base Comisionable Neta:**
   * La comisión de los asesores/vendedores se calcula sobre la utilidad operativa real del pedido, deduciendo los gastos específicos de cada producto/servicio antes de aplicar el porcentaje:
     $$\text{Base Comisionable Neta} = \text{Venta Bruta} - \text{Descuento Cupones} - \text{Delivery} - \text{Instalación/Montaje} - \text{Fee Plataforma} - \text{Comisión TC (6\%)}$$
9. **Porcentajes Individuales por Asesor (`seg_membresia`):**
   * El porcentaje de comisión no es uniforme; cada vendedora o asesor cuenta con su tasa configurada individualmente en su perfil de membresía (ej. 8%, 10%, 12%).
10. **Atribución Omnicanal ARIA (`packages/agentes-ia`):**
    * ARIA reemplaza herramientas externas (como ManyChat) gestionando conversaciones en WhatsApp/Instagram, atribuyendo la venta al asesor mediante links con identificador (`?asesora=paola`) o turnos rotativos, y calculando automáticamente la liquidación en tiempo real.

---

## 2. Foco Crítico: Tranqi (LegalTech)

### A. Agendamiento de Consultas Jurídicas y Citas Virtuales
8. **Asignación de Abogado Híbrida (Algorítmica + Manual + Contingencia):**
   * **Asignación Automática Inicial:** El sistema asigna al abogado disponible por turno rotativo (*Round-Robin*) según la materia legal.
   * **Facultad de Reasignación del Operador:** El operador o administrador del despacho puede cambiar manualmente la asignación del Abogado 1 al Abogado 2 desde su consola operativa si así lo requiere la complejidad del caso.
   * **Contingencia por Cancelación del Abogado:** Si el profesional asignado cancela o no puede atender la cita, el sistema dispara una alerta inmediata al operador para que reasigne a otro abogado disponible sin cancelar la cita del cliente.
9. **Integración Nativa de Videollamada (Google Meet):**
   * Al confirmarse una consulta virtual, la plataforma genera automáticamente el enlace de **Google Meet** a través de la API de Google Calendar y lo inserta en el evento del abogado y en la tarjeta de la cita en el portal web del cliente.

### B. Esquema Flexible de Liquidación de Honorarios a Socios Abogados
10. **Motor de Remuneración Multi-Esquema:**
    La plataforma soporta 4 modalidades de liquidación para los socios abogados según su contrato:
    * **Modalidad 1 — Tarifa Plana Estándar:** Valor fijo por servicio general.
    * **Modalidad 2 — Tarifa por Hora:** Tarificación según horas efectivas de asesoría o litigio registradas.
    * **Modalidad 3 — Tarifa Fija por Trámite Específico:** Acuerdo cerrado por tipo de trámite (ej. Notarización $60, Divorcio $200).
    * **Modalidad 4 — Comisión Porcentual por Caso:** Reparto porcentual del valor facturado (ej. 75% abogado / 25% Tranqi).

### C. Logística de Mensajería para Documentos Físicos
11. **Cobertura Urbana Base + Recargo Geográfico:**
    * El retiro y entrega de documentos físicos (firmas notariales, escrituras) está **incluido en el precio del trámite dentro del perímetro urbano base** (Quito Urbano).
    * En zonas periféricas o valles (Cumbayá, Tumbaco, Los Chillos), el sistema cotiza y añade automáticamente un **adicional logístico** de mensajería.
