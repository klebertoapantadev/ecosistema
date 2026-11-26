---
tipo: guia_operativa
estado: completado
fecha: 2026-11-26
responsable: Kleber Toapanta
requerimientos: PLT-025, TNK-007
---

# Conexión en Vivo — Tinkay (`www.tinkay.net`) ↔ Meta Business Suite

> **Estado actual:** **✅ Completado y verificado en producción (2026-11-26).** Pixel de navegador, Conversions API (CAPI) en Supabase Vault, Catálogo XML horario y enlace con WhatsApp Business activos y recibiendo eventos procesados en Meta Events Manager.

---

## Inventario Oficial de Activos Conectados (Sin Secretos)

| Activo | Nombre | ID Oficial | Notas |
| :--- | :--- | :--- | :--- |
| **Portafolio Comercial** | `Tinkay Quito` | `530109755033626` | Dueño de página `Tinkay` (`109525757999859`) e IG `@tinkayuio` |
| **Dominio Verificado** | `tinkay.net` (`https://www.tinkay.net`) | `1277475416063981` | DNS en GoDaddy → Vercel (`216.150.1.1` y `3829e0261edfd491.vercel-dns-017.com.`) |
| **Cuenta Publicitaria Empresarial** | `Tinkay G&F` | `977233563050885` | Recomendada para lanzar las nuevas campañas web (cuenta personal `319169109695988` quedó intacta) |
| **Conjunto de Datos / Pixel Web** | `Tinkay Web (tinkay.net)` | `4679318432213846` | Pixel activo en `www.tinkay.net` + Token CAPI cifrado en Supabase Vault (`meta_capi_token_tinkay`) |
| **Catálogo de Comercio Electrónico** | `Catálogo Oficial Tinkay (tinkay.net)` | `1506168184709464` | 41 productos importados sin errores, enlazado al Pixel `4679318432213846` |
| **Lista de Datos Programada (Feed XML)** | `https://www.tinkay.net/api/catalogo/meta-feed.xml` | `2839753709751902` | Sincronización automática cada hora (`USD`, `GMT-05:00`) |
| **WhatsApp Business Conectado** | `Toapanta Kleber` (`+593 99 643 8873`) | `3151843331674615` | Cuenta YCloud/ARIA conectada al catálogo (migrable en 2 clics a `+593 99 292 2343` al salir de ManyChat) |

---

## Checklist Ejecutado y Verificado

- [x] **Dominio oficial `www.tinkay.net` en Vercel + GoDaddy:** Desvinculado de Google Sites, registros `A` y `CNAME` apuntando a Vercel con SSL activo, `NEXT_PUBLIC_SITE_URL`/`NEXT_PUBLIC_APP_URL` en Production y Redirect URLs (`https://www.tinkay.net/**`, `https://tinkay.net/**`) en Supabase Auth.
- [x] **Migración SQL `20261119000008` en Supabase `ecosistema`:** `cfg_marketing_meta` y `cfg_fn_enviar_evento_meta_capi` verificados en producción.
- [x] **Pixel + Token CAPI en Vault:** Guardado cifrado en `vault.secrets`, validado en vivo contra Meta Graph API v21.0 (`HTTP 200 · events_received: 1`) y confirmado en **Meta Events Manager → Probar eventos** tanto para `Servidor` (`ViewContent` / `TIN-VAR-7`) como para `Navegador` (`PageView` y `ViewContent` desde `https://www.tinkay.net/producto/box-florales?variante=TIN-VAR-7`). Código `mkm_test_event_code` limpiado para producción.
- [x] **Catálogo XML + Pixel + WhatsApp Business:** 41 variantes importadas sin errores desde `https://www.tinkay.net/api/catalogo/meta-feed.xml`, vinculadas al Pixel `4679318432213846` y conectadas a WhatsApp Business `+593 99 643 8873`.
- [x] **Depuración de Conjuntos de Datos sin uso:** 6 conjuntos de datos vacíos (0 eventos) desconectados de activos y renombrados con prefijo `[NO USAR]`, manteniendo intactos `Tinkay Web (tinkay.net)`, `Ventas Redes Event Data` (`2034974980316095`) y `Tinkay Event Data` (`600267549675217`).

---

## Fórmula UTM para Usar al Crear Nuevos Anuncios en Meta Ads Manager

En cualquier campaña nueva que apunte a `https://www.tinkay.net` (en la cuenta **`Tinkay G&F` · `977233563050885`**), pegar en **Seguimiento → Parámetros de URL**:

```text
utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}
```

Con esto, **Mía (ARIA)** detecta automáticamente si el cliente viene de **Eventos**, **Condolencias**, **Entrega Inmediata** o de un arreglo puntual (ej. `TIN-VAR-7`) y adapta su saludo y recomendaciones al instante.

---

## Recordatorio Pendiente — Al Migrar al Número Oficial `+593 99 292 2343`

Cuando pasemos del número temporal `+593 99 643 8873` (`Toapanta Kleber`) al número oficial **`+593 99 292 2343`** (`Ventas Redes`, actualmente en ManyChat):

- [ ] Conectar el **`Catálogo Oficial Tinkay (1506168184709464)`** a **`+593 99 292 2343`** en WhatsApp Manager → Catálogo (y desconectarlo de `+593 99 643 8873` si ya no se usará para pruebas).
- [ ] **Activar el interruptor `"Mostrar ícono del catálogo en el encabezado del chat"`** (y mantener activado `"Mostrar el botón Agregar al carrito"`) para que los clientes vean la vitrina 🏪 arriba en el chat de WhatsApp oficial.
- [ ] Solicitar corrección del nombre visible rechazado en `+593 99 292 2343` (`"Tinkay - Flores a Domicilio"` → `"Tinkay Flores y Eventos"`).
