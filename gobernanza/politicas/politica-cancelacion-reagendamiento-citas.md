---
tipo: politica
estado: vigente
version: 1.0
fecha: 2026-09-05
responsables: Kleber Toapanta / Jesus Navarrete
---

# Política de Cancelación, Reagendamiento y Reembolsos de Citas (`PLT-020`)

**Alcance:** Aplica a todos los servicios de agendamiento, disponibilidad, citas presenciales y videoconsultas telemáticas en las plataformas del ecosistema (Tranqi Legal, FastFix Home y nuevos productos con servicios agendables).

---

## 1. Propósito y Principios Generales

El agendamiento de una cita con un socio profesional (abogado o técnico especialista) representa un **bloqueo exclusivo de tiempo y honorarios** en el calendario del profesional mediante la reserva física garantizada por base de datos (`comun_agenda.age_reserva`).

Esta política establece un marco transparente y equitativo que:
1. Protege el tiempo productivo y la dedicación del socio profesional frente a inasistencias imprevistas.
2. Otorga al cliente flexibilidad razonable para reprogramar o cancelar encuentros con la debida antelación.
3. Permite la asistencia y gestión manual asistida por parte de los operadores del ecosistema cuando se requiera.

---

## 2. Parámetros de Configuración por Negocio

Cada negocio del ecosistema parametriza sus reglas operativas en `comun_seguridad.cfg_negocio` (o configuración del motor de agenda). Los valores por defecto de la plataforma son:

| Parámetro | Clave de Configuración | Valor por Defecto | Descripción |
| :--- | :--- | :---: | :--- |
| **Límite de Reagendamientos** | `age_max_reagendamientos_cliente` | **1** | Número máximo de reprogramaciones permitidas por cita a solicitud del cliente. |
| **Antelación Mínima para Cancelar / Reagendar** | `age_horas_antelacion_cancelacion` | **12 horas** (configurable a 24h) | Ventana límite previa a la hora de inicio de la cita para ejercer cambios con derecho a reembolso. |
| **Porcentaje de Reembolso Oportuno** | `age_porcentaje_reembolso_cancelacion` | **80%** (o 100% neto) | Porcentaje a reintegrar al cliente si cancela con antelación $\ge$ horas mínimas. El saldo restante (ej. 20%) cubre costos administrativos y comisión de pasarela. |
| **Tolerancia de Espera (No-Show)** | `age_minutos_tolerancia_espera` | **15 minutos** | Tiempo máximo de espera en la sala virtual o despacho antes de declarar inasistencia. |

---

## 3. Reglas de Reagendamiento (Reprogramación de Citas)

1. **Límite Estricto de Reprogramaciones ($N$):**
   - El cliente dispone de un máximo de **$N$ reagendamientos permitidos** por cita (por defecto 1).
   - Cada reagendamiento exitoso decrementa el contador `cit_reagendamientos_restantes`. Una vez agotados, la opción de reagendar queda bloqueada en el portal del cliente.
2. **Ventana Temporal Válida:**
   - La solicitud de reagendamiento debe efectuarse con un mínimo de **$X$ horas de antelación** (ej. 12h o 24h antes del horario pactado).
   - No es posible reagendar dentro de las horas previas inmediatas a la cita.
3. **REGLA NO NEGOCIABLE: Exclusión de Citas Gratuitas o por Cupones:**
   - **Toda consulta gratuita, bonificada, cubierta al 100% por cupón promocional (`CUPON_GRATIS`, `PRIMERA_CITA`) o de cortesía institucional NO TIENE DERECHO A REAGENDAMIENTO.**
   - Si el cliente no puede asistir o cancela una cita gratuita, el beneficio se considera consumido y el cupón queda inhabilitado. El cliente deberá agendar una nueva cita bajo las tarifas vigentes.

---

## 4. Reglas de Cancelación y Política de Reembolsos

### A. Cancelación Oportuna (Con Antelación $\ge X$ Horas)
Si el cliente cancela su cita antes del plazo límite configurado:
- **Citas Pagadas (Vía Pasarela Payphone / Paymentez):**
  * El cliente tiene derecho al reembolso del **$X\%$ del valor efectivamente cancelado** (por defecto 80%, o el porcentaje configurado por la administración).
  * **Modalidades de Acreditación:**
    1. *Saldo Inmediato en Billetera Virtual:* Acreditación instantánea del valor liquidado para uso futuro en cualquier servicio de la plataforma.
    2. *Reversión a Tarjeta / Cuenta Bancaria:* Gestión de anulación a través de la pasarela de pagos en los tiempos bancarios habituales (3 a 10 días laborables).
- **Citas Cubiertas por Plan de Suscripción (`CUBIERTO_POR_PLAN`):**
  * Se restablece el cupo de consultas mensuales incluido en el plan del cliente sin penalidad alguna.
- **Citas Gratuitas / Cupones Promocionales:**
  * Se cancela el encuentro y se libera el horario del profesional. El cupón o gratuidad no se reembolsa ni reactiva.

### B. Cancelación Tardía (Menor a $X$ Horas de Antelación)
- Si el cliente cancela fuera de la ventana de antelación permitida, **no aplica reembolso monetario alguno (0%)**.
- El valor abonado se destina a compensar el tiempo reservado por el socio profesional y los costos operativos de plataforma.

### C. Inasistencia del Cliente (*No-Show*)
- Si transcurren los **15 minutos de tolerancia** desde la hora pactada sin que el cliente ingrese a la sala telemática (o se presente en el despacho):
  * El profesional marca la cita como `no_asistio` mediante el botón correspondiente en su panel.
  * El cliente pierde la totalidad del valor abonado o el cupo de su plan. No procede reagendamiento ni reembolso.

### D. Inasistencia o Cancelación Imprevista por Parte del Profesional
- Si por motivos de fuerza mayor justificada, calamidad doméstica o audiencia judicial sobrevenida el socio profesional no puede asistir a la cita:
  * El sistema notifica inmediatamente al cliente.
  * El cliente tiene derecho a elegir libremente entre:
    1. **Reembolso del 100% íntegro de su dinero** (sin deducción alguna), gestionado con máxima prioridad.
    2. **Reagendamiento prioritario inmediato** con el mismo profesional o con otro especialista de la misma materia sin costo adicional, más un bono de cortesía institucional.

---

## 5. Agendamiento y Modificaciones Manuales por Operadores de Tranqi

Aunque el ecosistema prioriza la autogestión y la asistencia conversacional con IA (ARIA), se garantiza la facultad de intervención y soporte humano directo:

1. **Agendamiento Manual Asistido:**
   - Un usuario con rol `OPERADOR`, `ADMINISTRADOR` o `SUPERADMIN` puede ingresar al widget administrativo de Citas y registrar una cita manual.
   - Dispone de selectores rápidos:
     * **Buscador de Cliente / Usuario:** Localiza cualquier cuenta en `seg_usuario` por nombres, correo o identificación.
     * **Selector de Socio Profesional:** Filtra abogados habilitados (`trq_abogado`) por materia y provincia.
     * **Selector de Franja y Modalidad:** Asigna fecha, hora, duración y modalidad (presencial / virtual).
     * **Modalidad de Cobro:** Permite registrar cobro regular, vincular a orden de pago, o aplicar exoneración autorizada por el staff (`cit_origen = 'operador'`).
2. **Modificación Manual de Citas Existentes:**
   - Los operadores pueden editar parámetros de una cita ya agendada (cambio de fecha/hora, modificación de sala virtual o reasignación a otro socio abogado ante impedimento del titular original).
   - Esta facultad opera de forma independiente al límite $N$ del cliente, requiriendo justificación en el registro de auditoría (`aud_registro`) y disparando notificación de actualización automática a ambas partes.

---

## 6. Mecanismo de Consentimiento y Aceptación Obligatoria del Cliente

Para garantizar validez contractual y protección jurídica frente a controversias bancarias o contracargos:

1. **Aceptación Previa al Checkout / Confirmación:**
   - Tanto en el flujo web (`/panel/agendar`) como en el checkout de la Cajita de Pagos y en el diálogo interactivo de ARIA, el cliente debe visualizar el resumen contractual:
     > *"Entiendo y acepto la [Política de Cancelación y Reagendamiento](file:///...) (Máx. 1 reagendamiento con 12h de antelación; citas gratuitas no admiten reagendamiento; cancelaciones tardías no reembolsables)."*
   - La acción de confirmación requiere una casilla de verificación (*checkbox*) explícita o confirmación interactiva en el chat ("Acepto las condiciones y agendar").
2. **Registro Inmutable de Consentimiento:**
   - Al invocar la función transaccional `trq_fn_reservar_cita()`, se registran obligatoriamente:
     * `cit_politica_version`: Versión vigente del documento (ej. `'v1.0-2026-09'`).
     * `cit_politica_aceptada_en`: Timestamp exacto de la aceptación (`now()`).
     * Dirección IP y User-Agent en la bitácora de auditoría (`aud_registro`).
