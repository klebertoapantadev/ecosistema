---
tipo: guia_operativa
estado: pendiente_ejecucion
fecha: 2026-11-19
responsable: Kleber Toapanta
requerimientos: PLT-025, TNK-007
---

# Guía y Checklist Pendiente — Conexión Directa con Meta Business Suite (Tinkay y Ecosistema)

> **Estado actual:** La arquitectura de software (`PLT-025`) está **100% programada en el monorepo**. Queda **pendiente** la sesión práctica interna (Kleber + Antigravity) para conectar las cuentas de Meta Business Suite, activar la migración en Supabase y dejar corriendo el Pixel, CAPI y Catálogo de Facebook / Instagram / WhatsApp Business.

---

## Checklist Paso a Paso para Cuando Retomemos

### Paso 1 — Base de Datos Supabase (`ecosistema`)
- [ ] Abrir el SQL Editor de Supabase y ejecutar completa la migración:
  `supabase/migrations/20261119000008_cfg_marketing_meta_capi_catalogo_y_widget.sql`
- [ ] Confirmar que en `/panel/marketing-meta` (o `/panel/configuracion` → pestaña **Marketing & Meta**) aparece el formulario activo.

### Paso 2 — Verificación de Dominio en Meta Business Suite
- [ ] Ir a **Meta Business Suite → Configuración del negocio → Seguridad de la marca → Dominios**.
- [ ] Agregar el dominio definitivo de Tinkay (cuando quede listo el dominio propio o sobre el actual).
- [ ] Elegir el método **"Agregar una metaetiqueta a tu código fuente HTML"**, copiar solo el código `content="..."` y pegarlo en el campo **Verificación de Dominio Meta** en `/panel/marketing-meta`.
- [ ] Guardar y pulsar **Verificar dominio** en Meta.

### Paso 3 — Pixel ID + API de Conversiones (CAPI en Vault)
- [ ] Ir a **Administrador de Eventos de Meta → Orígenes de datos → Conectar orígenes de datos → Web**.
- [ ] Copiar el **Identificador del conjunto de datos (`Pixel ID`)** (solo números) y pegarlo en `/panel/marketing-meta`.
- [ ] En la pestaña **Configuración** del Pixel en Meta, bajar a **API de conversiones → Configurar manualmente → Generar token de acceso** (`EAA...`) y pegarlo en **Token de Acceso de API de Conversiones** en `/panel/marketing-meta` (queda cifrado en Supabase Vault).
- [ ] En la pestaña **Probar eventos** de Meta, copiar temporalmente el código `TEST...`, pegarlo en `TEST_EVENT_CODE`, guardar con el check **Activar Meta Pixel y API de Conversiones** marcado y hacer clic en **`Probar CAPI`**.
- [ ] Una vez confirmado que el evento aparece en Meta Events Manager, **borrar el `TEST_EVENT_CODE`** y volver a guardar para dejarlo limpio en modo producción.

### Paso 4 — Catálogo Automático para Facebook, Instagram y WhatsApp Business
- [ ] En `/panel/marketing-meta`, pulsar **`Copiar Feed`** (`https://<dominio-tinkay>/api/catalogo/meta-feed.xml`).
- [ ] Ir a **Meta Commerce Manager → Crear catálogo → Comercio electrónico → Subir información de productos → Usar una lista de datos (Data Feed) → Lista programada**.
- [ ] Pegar la URL `/api/catalogo/meta-feed.xml` y programar frecuencia **Cada hora**.
- [ ] En **Configuración del catálogo → Orígenes de datos de eventos**, vincular el Pixel de Tinkay al catálogo (esto habilita el retargeting dinámico exacto por SKU como `TIN-VAR-7`).
- [ ] Para **WhatsApp Business**: en **Meta Business Suite → Cuentas de WhatsApp → Administrador de WhatsApp → Catálogo**, seleccionar ese mismo catálogo recién creado para que los productos activos de la web aparezcan automáticamente en WhatsApp Business.

### Paso 5 — Parámetros UTM en Anuncios para la Inteligencia de ARIA (Mía)
- [ ] En `/panel/marketing-meta`, pulsar **`Copiar UTM`**:
  `utm_source={{site_source_name}}&utm_medium=paid_social&utm_campaign={{campaign.name}}&utm_content={{ad.name}}`
- [ ] En **Meta Ads Manager**, al crear cualquier anuncio hacia la web (Eventos, Condolencias, Entrega Inmediata o arreglo específico), pegar esa cadena en la casilla **Seguimiento → Parámetros de URL**.
- [ ] *(Automático para anuncios Clic a WhatsApp)*: No requiere configuración adicional; el webhook de YCloud ya lee automáticamente `inboundWa.referral` (`headline`, `body`, `ctwa_clid`) y se lo entrega a Mía desde el primer mensaje.
