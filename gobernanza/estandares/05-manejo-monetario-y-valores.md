---
tipo: estandar
estado: vigente
version: 1.0
fecha: 2026-09-05
responsable: Kleber Toapanta
---

# Estándar de Manejo Monetario, Precios y Valores Financieros

Este estándar establece el tratamiento obligatorio de moneda, precios, cálculos de impuestos y transacciones financieras en las **8 aplicaciones y paquetes del ecosistema** (Tranqi, FastFix Home, Tinkay, Margaritas Floristería).

---

## 1. Principio Rector: Enteros en Centavos (Patrón Money)

En JavaScript, TypeScript y JSON, el tipo `number` se implementa como un número de punto flotante de doble precisión (IEEE 754 de 64 bits). Operaciones aritméticas simples con decimales producen errores de imprecisión inherentes (ej. `0.1 + 0.2 = 0.30000000000000004`), generando descuadres de `$0.01` en carritos, problemas de redondeo fiscal y ambigüedad con separadores regionales (coma `,` vs. punto `.`).

### Regla Universal del Ecosistema:
> **Todo valor monetario en la lógica de negocio, carritos, checkouts, APIs y pasarelas de pago se representa, calcula y transmite como un número ENTERO expresado en CENTAVOS de dólar (USD).**

* **$ 1.00** se procesa como `100` centavos.
* **$ 35.00** se procesa como `3500` centavos.
* **$ 1.15** se procesa como `115` centavos.
* **$ 12.68** se procesa como `1268` centavos.

---

## 2. Las Tres Capas de Representación

| Capa | Formato | Propósito y Reglas |
| :--- | :--- | :--- |
| **1. UI / Presentación** | `$ 35.00` o `$ 35,00` | Exclusivo para la visualización del usuario final. Se genera mediante `formatearUSD(centavos)`. En inputs de texto, se permite al usuario ingresar coma o punto indistintamente, pero se normaliza de inmediato con `parsearInputMoneda()`. |
| **2. TypeScript / APIs / Pasarelas** | `3500` (`number` entero) | **Toda la lógica de cálculo**: subtotales, cupones, recargos de envío, comisiones y payloads hacia pasarelas (Payphone exige centavos enteros). Las variables llevan el sufijo explicativo `_centavos` o `enCentavos`. |
| **3. Base de Datos (PostgreSQL)** | `numeric(12,2)` o `numeric(12,4)` | Precios finales, totales y pagos se almacenan en `numeric(12,2)` o enteros. Los **costos unitarios de insumos/recetas (BOM)** se almacenan en `numeric(12,4)` para permitir costeo exacto exigido por el SRI (ej. `$0.1739` por tallo de flor). |

---

## 3. Desglose de Impuestos y Redondeo (SRI Ecuador — IVA 15%)

En el comercio B2C del ecosistema, los precios exhibidos al público incluyen IVA (PVP). El desglose tributario para facturación electrónica del SRI y cobro en pasarelas se calcula mediante la fórmula oficial con redondeo simétrico:

$$\text{Base Imponible (centavos)} = \text{round}\left(\frac{\text{PVP (centavos)}}{1.15}\right)$$

$$\text{IVA 15\% (centavos)} = \text{PVP (centavos)} - \text{Base Imponible (centavos)}$$

### Garantía de Integridad:
$$\text{Base Imponible (centavos)} + \text{IVA (centavos)} \equiv \text{PVP Total (centavos)}$$
*Nunca habrá descuadre de 1 centavo ante el SRI ni ante la pasarela de pagos.*

---

## 4. Nomenclatura Obligatoria de Código

1. **Sufijo explicativo en variables:**
   * ✅ `precioTotalCentavos`, `subtotalCentavos`, `ivaCentavos`, `montoEnvioCentavos`.
   * ❌ `precioTotal`, `total`, `precioFinal` (ambiguos: no indican si son dólares flotantes o centavos enteros).
2. **Prohibido el uso de flotantes sueltos:**
   * Queda estrictamente prohibido realizar operaciones como `precio * 0.15` o `precio / 1.15` directamente en componentes de React o Server Actions sin la envoltura de las utilidades canónicas.

---

## 5. Biblioteca Canónica (`@eco/primitivas/moneda`)

Todo cálculo o conversión en el frontend o backend debe importar las funciones universales de `@eco/primitivas`:

```typescript
import { 
  aCentavos, 
  aDolares, 
  formatearUSD, 
  desglosarIvaDesdePvp, 
  parsearInputMoneda 
} from "@eco/primitivas";
```

### Funciones Principales:

* `aCentavos(dolares: number | string): number`  
  Convierte dólares decimales o texto a centavos enteros: `aCentavos(35.50) -> 3550`, `aCentavos("35,50") -> 3550`.
* `aDolares(centavos: number): number`  
  Convierte centavos a formato decimal para APIs externas que exijan float: `aDolares(3550) -> 35.50`.
* `formatearUSD(centavos: number): string`  
  Genera la cadena formateada con símbolo de dólar y 2 decimales para la UI: `formatearUSD(3550) -> "$35.00"`.
* `desglosarIvaDesdePvp(pvpCentavos: number): { baseImponibleCentavos, ivaCentavos, totalCentavos }`  
  Desglosa el PVP con tarifa vigente SRI (15%) sin pérdida de precisión.
* `parsearInputMoneda(input: string): number`  
  Tolerante a errores de tipeo del usuario (admite coma `,`, punto `.`, espacios y símbolo `$`), retornando siempre centavos enteros.

---

## 6. Verificación en Pruebas y CI

Las pruebas unitarias (`packages/primitivas`) validan que:
1. No existan desviaciones de precisión en sumas acumulativas de carritos con descuentos porcentuales.
2. Los valores enviados a Payphone u otras pasarelas coincidan bit a bit con `amount = amountWithTax + amountWithoutTax + tax`.
