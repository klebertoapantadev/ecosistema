---
tipo: manual
negocio: fastfix
modulo: catalogo_productos
codigo_req: PLT-009
version: 1.0
fecha: 2026-09-13
responsable: Director de Operaciones Técnicas & Mantenimiento
---

# Manual de Configuración de Catálogo Comercial · FastFix Home

## 1. Visión General y Propósito

En FastFix Home el catálogo administra **visitas técnicas de diagnóstico, reparaciones por especialidad (plomería, electricidad, cerrajería, pintura) y contratos de mantenimiento preventivo**.

---

## 2. Configuración de Servicios Técnicos y Visitas

### Ejemplo Real: *Visita Técnica de Diagnóstico e Inspección Eléctrica*
* **Nombre:** `Inspección y Diagnóstico Eléctrico Domiciliario`
* **Categoría:** `Electricidad Residencial`
* **Tipo de Oferta:** `Servicio Técnico / Reparación` (`SERVICIO`)
* **Tiempo de Atención:** `⚡ Emergencia Técnica (45 - 60 min)`
* **Modalidades:**
  * **Visita Básica de Inspección:** Base $21.7391 + IVA 15% ($3.26) = **$25.00** (Deducible si se contrata la reparación).
  * **Emergencia Nocturna / Fin de Semana:** Base $34.7826 + IVA 15% ($5.22) = **$40.00**.

### Ejemplo Real: *Mantenimiento Preventivo de Calefones y Cisternas (Suscripción)*
* **Nombre:** `Plan Hogar Seguro - Mantenimiento Semestral`
* **Categoría:** `Planes Preventivos`
* **Tipo de Oferta:** `Suscripción / Plan Periódico` (`SUSCRIPCION`)
* **Tarifa Semestral:** Base $52.1739 + IVA 15% ($7.83) = **$60.00 / semestre**.

---

## 3. Cuadrillas Técnicas y Cobertura Territorial por Zonas

Para asegurar los tiempos de respuesta de emergencia (45 a 60 min), los servicios se distribuyen por cuadrillas asignadas a zonas estratégicas:
* **Quito Norte:** Cumbayá, Tumbaco, Monteserrín, Ponceano, El Condado.
* **Quito Centro / Sur:** La Floresta, González Suárez, Villaflora, Chimbacalle, Quitumbe.
* **Valles de Los Chillos & Tumbaco:** San Rafael, Conocoto, Sangolquí, Puembo.

---

## 4. Tablero de Disponibilidad de Cuadrillas en Vivo (ARIA MCP)

Los despachadores de FastFix controlan en tiempo real:
* **Cuadrillas Activas y Libres:** Ajuste ágil con `[ - ] / [ + ]` de técnicos disponibles en calle.
* **Bot ARIA / WhatsApp de Emergencias:** Consulta el tablero de cuadrillas antes de comprometer una visita de emergencia inmediata de gasfitería, cerrajería o electricidad.
