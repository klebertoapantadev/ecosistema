---
tipo: esp_funcional
estado: borrador_avanzado
version: 0.2
fecha: 2026-09-05
responsable: Kleber Toapanta
---

# FastFix Home — Especificación Funcional

**Prefijo de tabla:** `ffh_` · **Esquema:** `fastfix_mantenimiento`  
**Consumo de Catálogo:** `comun_comercio` (filtrado por `*_negocio = 'fastfix'`)  
**Documento de Catálogo:** 📄 [catalogo-productos.md](catalogo-productos.md)  

---

## 1. Visión y Modelo de Expansión Digital

FastFix Home nace de una operación existente de servicios técnicos y de mantenimiento del hogar. El objetivo estratégico de la plataforma es **digitalizar, estandarizar y escalar la operación**, transformándola en una empresa integral de mantenimiento preventivo, reparaciones técnicas y servicios de limpieza profesional (B2C y B2B).

### Pilares de la Expansión Digital:
1. **Atención Inmediata y Transparente:** Sustituir la cotización informal por proformas digitales interactivas con fotos, desglose de repuestos/mano de obra y token de aprobación en línea.
2. **Servicios Recurrentes y Tarifa Plana:** Paquetes preventivos cerrados (calefones, puertas de garaje, cercas eléctricas) y jornadas de limpieza estandarizadas.
3. **Canal B2B para Administradores de Condominios y Edificios:** Venta corporativa con incentivo de saldo a favor en mano de obra.
4. **Billetera Digital y Fidelización:** Saldos prepagados y bonos promocionales para clientes frecuentes y administraciones.

---

## 2. Banco de Ideas Estratégicas y Nuevas Líneas de Negocio

### A. Estrategia B2B2C: "Condominio Seguro y Protegido"
* **Problema del Cliente:** Los administradores de condominios y edificios sufren constantemente por proveedores informales, falta de facturación electrónica formal, retrasos, ausencia de garantías y precios arbitrarios.
* **Propuesta de FastFix:**
  * **Contrato Integral de Mantenimiento Comunal:** Visitas periódicas programadas para revisar bombas de agua, iluminación comunal, puertas de garaje automáticas, cercas eléctricas y limpieza de áreas comunes.
* **El Incentivo / Beneficio Clave (Billetera Digital en Mano de Obra):**
  * Al firmar un convenio de mantenimiento o limpieza con el condominio, FastFix acredita un **Bono / Saldo a Favor** en la Billetera Digital del Condominio (`com_billetera`) exclusivo para **Mano de Obra en Reparaciones Futuras** (ej. $100.00 iniciales o un 10% del valor del contrato anual).
  * **Efecto Red para Copropietarios (B2B2C):** Cada residente del edificio recibe un bono vecinal de bienvenida (ej. $20.00 en mano de obra) en su cuenta personal de FastFix para contratar arreglos en su departamento (plomería, electricidad, calefón), logrando adquisición masiva de clientes B2C con costo de adquisición (CAC) casi nulo.

### B. Empresa Digital de Limpieza Profesional
* **Jornadas Estandarizadas por Día-Hombre / Cuadrilla:**
  * Limpieza Básica (hasta 90m²).
  * Limpieza Profunda / Post-Construcción o Entrega de Inmuebles.
  * Limpieza de Oficinas y Locales Comerciales por horas con agenda recurrente.
* **Control de Insumos y Recetas (BOM):**
  * Cada cuadrilla retira de bodega un kit estandarizado de limpieza (químicos, desinfectantes, microfibras, bolsas), el cual se descuenta del inventario central (`com_inventario` / `com_receta`).

### C. Calendario Preventivo Automatizado
* Notificaciones automáticas por WhatsApp para recordar mantenimientos esenciales antes de que los equipos fallen:
  * *"Hola [Cliente], hace 6 meses realizamos el mantenimiento de tu calefón. Agenda tu revisión preventiva hoy y evita cortes de agua caliente."*

---

## 3. Identidad, Autenticación y Consola

* **Autenticación:** Vía `@eco/identidad` (Google OAuth + correo/contraseña) con consentimiento de términos y perfil de usuario.
* **Consola Administrativa:** Sistema modular de widgets (`PLT-011`) para coordinar técnicos en campo, gestionar proformas, administrar stock de repuestos y monitorear cuadrillas de limpieza.
