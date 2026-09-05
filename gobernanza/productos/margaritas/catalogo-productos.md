# Catálogo y Portafolio de Productos — Margaritas Floristería

**Negocio:** `margaritas`  
**Estado:** Propuesta Preliminar (Precios y variantes supuestos para calibración)  
**Esquema de Base de Datos:** `comun_comercio` (Filtrado por `*_negocio = 'margaritas'`)  
**Política Fiscal:** B2C / Institucional — PVP con IVA incluido en vitrina.  

---

## 1. Categorías de Navegación (`com_categoria`)

| Código Categ. | Nombre Visible | Descripción | Orden |
| :--- | :--- | :--- | :--- |
| `MRG_CONDOLENCIAS`| **Condolencias y Funeral** | Coronas, lágrimas y cruces para honrar la memoria. | 1 |
| `MRG_BOUQUETS`    | **Bouquets Clásicos** | Diseños elegantes para ocasiones de afecto y respeto. | 2 |
| `MRG_CORPORATIVO` | **Arreglos Corporativos** | Centros de mesa, podios y decoración para oficinas y eventos. | 3 |
| `MRG_ADICIONALES` | **Tarjetas y Cintas** | Cintas fúnebres personalizadas, tarjetas caligrafiadas y bases. | 4 |

---

## 2. Productos Maestros y Variantes (`com_producto` y `com_variante`)

### A. Categoría: Condolencias y Funeral (`MRG_CONDOLENCIAS`)
1. **Corona Fúnebre Solemne:**
   * `MRG-COR-MED`: **Mediana (70 cm diámetro)** — PVP: **$60.00**
     * **BOM:** 40 Flores blancas/lilas + Follaje pino/helecho + Base tripie de madera + Cinta impresa.
   * `MRG-COR-GRA`: **Grande (1 metro diámetro)** — PVP: **$90.00**
     * **BOM:** 70 Flores selectas + Follaje premium + Base tripie + Cinta de lujo.
2. **Lágrima / Pedestal Condolencia:**
   * `MRG-LAG-EST`: **Estándar** — PVP: **$45.00**
   * `MRG-LAG-PRE`: **Premium** — PVP: **$75.00**

---

### B. Categoría: Bouquets Clásicos (`MRG_BOUQUETS`)
1. **Bouquet Clásico Margaritas:**
   * `MRG-BOU-25`: **25 Tallos** — PVP: **$20.00**
   * `MRG-BOU-50`: **50 Tallos** — PVP: **$25.00**
   * `MRG-BOU-100`: **100 Tallos** — PVP: **$45.00**

---

### C. Servicios y Adicionales
* `MRG-CIN-IMP`: **Cinta Fúnebre con Letras Doradas Impresas** — PVP: **$5.00**
* `MRG-SRV-URG`: **Entrega Urgente en Salas de Velación (Menos de 2h)** — PVP: **$15.00**

---

## 3. Modelo de Suscripciones Corporativas (`com_suscripcion`)
* **Arreglo Semanal para Recepción/Hall:** Descuento recurrente del **15%** mensualizado con cambio semanal de flores frescas en empresas e instituciones.
