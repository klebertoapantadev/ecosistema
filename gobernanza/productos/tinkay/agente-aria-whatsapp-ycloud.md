# Especificación Técnica y Funcional: Agente ARIA WhatsApp (YCloud) y Consola de Supervisión Humana — Tinkay Floristería

**Negocio:** `tinkay` (`tinkay_floristeria`)  
**Código de Requerimiento:** `TNK-004` (Específico Tinkay) / `PLT-010` (Plataforma Omnicanal)  
**Estado:** Especificación Aprobada para Implementación  
**Tecnología Base:** WhatsApp Business API (vía YCloud) + Motor Agéntico ARIA (`packages/agentes-ia`) + Supabase Realtime + Catálogo `comun_comercio`  

---

## 1. Contexto y Objetivos del Reemplazo de ManyChat

Tinkay operaba históricamente su canal de ventas principal en WhatsApp a través de **ManyChat**. Dicho esquema presentaba fricciones críticas para el escalamiento del negocio:
1. **Flujos Rígidos por Árbol de Decisión:** ManyChat no comprende lenguaje natural fluido, preguntas cruzadas, ni la sensibilidad emocional requerida al vender flores para ocasiones de condolencias o aniversarios.
2. **Desconexión del Catálogo Comercial:** Los productos, variantes y precios debían duplicarse manualmente en ManyChat, desincronizándose con los precios reales y el inventario del taller.
3. **Imposibilidad de Liquidar Comisiones de Vendedoras:** ManyChat no se integra nativamente con la base de datos de usuarios (`seg_membresia`) ni con la fórmula de comisiones netas sobre utilidad operativa.
4. **Costo Recurrente por Suscriptor:** El modelo de cobro de ManyChat escala por contactos almacenados, penalizando la retención de clientes antiguos.

### Objetivo
Sustituir ManyChat por una solución integral basada en:
* **YCloud (WhatsApp Cloud API):** Proveedor oficial de WhatsApp Business API, con tarifas por conversación de Meta transparentes y entrega de webhooks de alta confiabilidad.
* **ARIA (`packages/agentes-ia`):** Agente de inteligencia artificial con personalidad botánica ("Mía"), capaz de consultar el catálogo comercial multidimensional en tiempo real, sugerir álbumes de fotos de Google Photos, redactar dedicatorias y cerrar ventas.
* **Consola de Supervisión Humana (*Human-in-the-Loop* - HITL):** Widget administrativo donde una o varias asesoras y la coordinadora del taller monitorean los chats en tiempo real, toman el control con un clic para asistir casos complejos, y reanudan la IA cuando el cliente está listo.

---

## 2. Almacenamiento y Ciclo de Vida de los Chats

### A. Cómo almacena los chats ARIA vs. el Ecosistema
Existe una distinción fundamental entre el backend de ARIA y la base de datos operativa de la plataforma:

1. **Backend de ARIA (`129.153.84.58/agentes`):**
   * ARIA es un motor de ejecución agéntica basado en LLM (LangGraph).
   * Al recibir `POST /v1/agents/{agent_id}/invoke`, utiliza `conversation_id` como clave para mantener su memoria conversacional interna (checkpoints de grafo e historial para contexto del prompt).
   * Registra cada ejecución en su tabla técnica de *runs* (`GET /v1/runs`), registrando latencia, tokens y llamadas a herramientas (MCP).
   * **Limitación:** ARIA no es un CRM de mensajería; no almacena estados de lectura de WhatsApp, no soporta la asignación a vendedoras humanas, ni emite eventos WebSockets para interfaces de usuario en tiempo real.

2. **Base de Datos Operativa del Ecosistema (`comun_agentes` / Supabase):**
   * Supabase es la **fuente única de verdad** para la consola humana, la atribución de comisiones, el historial de clientes y la auditoría.
   * La conversación se almacena en `comun_agentes.agc_conversacion` y cada interacción en `comun_agentes.agc_mensaje`.
   * El `cnv_id` (UUID) de Supabase se envía a ARIA como su `conversation_id`, garantizando paridad exacta 1:1 entre el historial de la interfaz y la memoria del modelo.
   * Con **Supabase Realtime** (`supabase.channel`), la consola de supervisión humana escucha cambios en estas tablas para actualizar la bandeja de chats en vivo sin recargar la pantalla.

### B. Modelo de Datos para Chats Omnicanal (`comun_agentes`)

```sql
-- Esquema transversal de agentes y mensajería multicanal
create table comun_agentes.agc_conversacion (
  cnv_id uuid primary key default gen_random_uuid(),
  cnv_secuencial bigint generated always as identity,
  cnv_negocio text not null check (cnv_negocio in ('tinkay', 'fastfix', 'tranqi', 'margaritas', 'plataforma')),
  cnv_canal text not null default 'whatsapp' check (cnv_canal in ('whatsapp', 'instagram', 'web', 'telegram')),
  
  -- Identificador del contacto en el canal externo
  cnv_remitente_id text not null,               -- Número de WhatsApp en formato internacional: '593991234567'
  cnv_remitente_nombre text,                    -- Nombre del perfil de WhatsApp obtenido del webhook
  
  -- Estado del flujo conversacional
  cnv_estado_atencion text not null default 'BOT_ACTIVO' 
    check (cnv_estado_atencion in ('BOT_ACTIVO', 'ESCALADO_HUMANO', 'EN_ATENCION_ASESORA', 'CERRADO')),
  
  -- Atribución a la asesora de ventas
  cnv_asesora_asignada_id uuid references comun_seguridad.seg_usuario(usu_id),
  cnv_atribuido_por text default 'ROTATIVO' check (cnv_atribuido_por in ('ENLACE_REF', 'ROTATIVO', 'MANUAL')),
  
  -- Contexto y trazabilidad
  cnv_ultimo_mensaje_texto text,
  cnv_ultimo_mensaje_en timestamptz not null default now(),
  cnv_no_leidos_asesora integer not null default 0,
  cnv_motivo_escalamiento text,
  cnv_detalle_pedido jsonb not null default '{}'::jsonb, -- Almacena producto seleccionado, dedicatoria, dirección temporal
  
  cnv_creado_en timestamptz not null default now(),
  cnv_actualizado_en timestamptz not null default now(),
  
  unique (cnv_negocio, cnv_canal, cnv_remitente_id)
);

create table comun_agentes.agc_mensaje (
  msg_id uuid primary key default gen_random_uuid(),
  msg_conversacion_id uuid not null references comun_agentes.agc_conversacion(cnv_id) on delete cascade,
  
  msg_origen text not null check (msg_origen in ('CLIENTE', 'BOT_ARIA', 'ASESORA_HUMANA', 'SISTEMA')),
  msg_autor_usuario_id uuid references comun_seguridad.seg_usuario(usu_id), -- null si fue el cliente o el bot
  
  msg_contenido text not null,
  msg_tipo_contenido text not null default 'TEXTO' check (msg_tipo_contenido in ('TEXTO', 'IMAGEN', 'UBICACION', 'AUDIO', 'PLANTILLA', 'DOCUMENTO')),
  
  msg_id_externo text,                          -- Message ID de WhatsApp/YCloud (wamid)
  msg_estado_entrega text not null default 'ENVIADO' check (msg_estado_entrega in ('ENVIADO', 'ENTREGADO', 'LEIDO', 'FALLIDO')),
  
  msg_metadatos jsonb not null default '{}'::jsonb, -- run_id de ARIA, URLs multimedia, payload original
  msg_creado_en timestamptz not null default now()
);

-- Índices de alta concurrencia para la consola
create index agc_conversacion_bandeja_idx on comun_agentes.agc_conversacion (cnv_negocio, cnv_estado_atencion, cnv_ultimo_mensaje_en desc);
create index agc_mensaje_hilo_idx on comun_agentes.agc_mensaje (msg_conversacion_id, msg_creado_en asc);
```

---

## 3. Arquitectura del Flujo YCloud $\leftrightarrow$ ARIA $\leftrightarrow$ Supabase

```
[ Cliente en WhatsApp ]
       │
       ▼ (Mensaje entrante)
  [ YCloud API ]
       │
       ▼ (Webhook POST /api/webhooks/ycloud)
  [ Route Handler / Edge Function ]
       │
       ├─► 1. Verifica firma del webhook (X-YCloud-Signature)
       ├─► 2. Registra o actualiza conversación en `agc_conversacion`
       ├─► 3. Registra mensaje en `agc_mensaje` (`msg_origen = 'CLIENTE'`)
       │
       ├─► ¿Estado de la conversación?
       │     │
       │     ├─► 'EN_ATENCION_ASESORA':
       │     │     └─► [NO llama a ARIA]. Notifica a la asesora vía Realtime.
       │     │
       │     └─► 'BOT_ACTIVO':
       │           ├─► Invoca ARIA (`packages/agentes-ia` -> `invocarAgente`)
       │           │     │
       │           │     ├─► Si ARIA llama a `consultar_catalogo_tinkay`
       │           │     │     └─► Ejecuta RPC sobre `comun_comercio` y devuelve datos
       │           │     │
       │           │     └─► Si ARIA llama a `escalar_a_humano`
       │           │           ├─► Actualiza estado a 'ESCALADO_HUMANO'
       │           │           └─► Emite alerta prioritaria a la consola humana
       │           │
       │           ├─► Inserta respuesta de ARIA en `agc_mensaje`
       │           └─► Despacha mensaje a WhatsApp vía YCloud API (POST /v2/whatsapp/messages/send)
       │
[ Consola Humana (Next.js Dashboard) ] ◄── Escucha eventos Supabase Realtime
       │
       ├─► Asesora lee el chat en vivo
       ├─► Clic en "Tomar Control" ──► Cambia estado a 'EN_ATENCION_ASESORA'
       ├─► Asesora responde desde la consola ──► Envía a WhatsApp vía YCloud
       └─► Clic en "Reactivar Bot" ──► Vuelve a estado 'BOT_ACTIVO'
```

---

## 4. Herramienta de Consulta de Catálogo para ARIA (`consultar_catalogo_tinkay`)

Para que ARIA recomiende productos, precios exactos, opciones de ramos y álbumes de Google Photos, se expone como herramienta MCP en el servidor de agentes.

### A. Definición de la Herramienta MCP

* **Nombre:** `consultar_catalogo_tinkay`
* **Descripción:** "Consulta el catálogo oficial de Tinkay Floristería para recomendar arreglos según la ocasión, estilo, formato o presupuesto del cliente. Devuelve nombres de productos, precios en dólares (PVP), variantes disponibles y enlaces a los álbumes de Google Photos con fotografías reales del taller."
* **Esquema de Entrada (JSON Schema):**
```json
{
  "type": "object",
  "properties": {
    "ocasion": {
      "type": "string",
      "enum": ["AMOR", "ANIVERSARIO", "CUMPLEANOS", "CONDOLENCIAS", "EVENTO", "AGRADECIMIENTO", "CUALQUIERA"],
      "description": "Ocasión o motivo del regalo."
    },
    "formato": {
      "type": "string",
      "enum": ["FLORERO", "COREANO", "ABANICO", "DETALLE", "CUALQUIERA"],
      "description": "Formato físico del arreglo (florero alto, bouquet coreano en papel, abanico/pedestal, etc.)."
    },
    "presupuesto_max_usd": {
      "type": "number",
      "description": "Presupuesto máximo aproximado del cliente en dólares americanos (ej. 25, 45, 100)."
    },
    "termino_busqueda": {
      "type": "string",
      "description": "Palabras clave adicionales indicadas por el cliente (ej. 'rosas rojas', 'girasoles', 'fúnebre', 'chocolates')."
    }
  }
}
```

### B. Función de Búsqueda en Base de Datos (RPC PostgreSQL)
La herramienta ejecuta una consulta en `comun_comercio` sobre las tablas `com_producto`, `com_variante`, `com_producto_categoria`, `com_categoria` y `com_media`, formateando los valores monetarios con base en centavos enteros:

```sql
create or replace function tinkay_floristeria.tnk_fn_buscar_catalogo_conversacional(
  p_ocasion text default null,
  p_formato text default null,
  p_presupuesto_max_usd numeric default null,
  p_termino text default null
)
returns jsonb
language plpgsql
security definer
set search_path = comun_comercio, public
as $$
declare
  v_resultado jsonb;
  v_presupuesto_centavos integer;
begin
  if p_presupuesto_max_usd is not null then
    v_presupuesto_centavos := round(p_presupuesto_max_usd * 100);
  end if;

  select coalesce(jsonb_agg(sub.item), '[]'::jsonb)
  into v_resultado
  from (
    select jsonb_build_object(
      'producto_id', p.pro_id,
      'nombre', p.pro_nombre,
      'slug', p.pro_slug,
      'descripcion', p.pro_descripcion_corta,
      'categoria_principal', cp.ctg_nombre,
      'album_fotos_url', p.pro_metadatos->>'album_fotos_url',
      'variantes', (
        select jsonb_agg(
          jsonb_build_object(
            'sku', v.var_sku,
            'nombre', v.var_nombre,
            'pvp_formateado', concat('$', to_char(round(v.var_precio * (1 + v.var_porcentaje_iva / 100.0) / 100.0, 2), 'FM999,990.00')),
            'pvp_centavos', round(v.var_precio * (1 + v.var_porcentaje_iva / 100.0)),
            'stock_disponible', v.var_stock_disponible
          )
        )
        from comun_comercio.com_variante v
        where v.var_producto_id = p.pro_id
          and v.var_activo = true
          and (v_presupuesto_centavos is null or round(v.var_precio * (1 + v.var_porcentaje_iva / 100.0)) <= v_presupuesto_centavos)
      )
    ) as item
    from comun_comercio.com_producto p
    left join comun_comercio.com_categoria cp on cp.ctg_id = p.pro_categoria_principal_id
    where p.pro_negocio = 'tinkay'
      and p.pro_activo = true
      and (
        p_termino is null 
        or p.pro_nombre ilike concat('%', p_termino, '%')
        or p.pro_descripcion ilike concat('%', p_termino, '%')
      )
      and (
        p_ocasion is null or p_ocasion = 'CUALQUIERA' or exists (
          select 1 from comun_comercio.com_producto_categoria pc
          join comun_comercio.com_categoria c on c.ctg_id = pc.pct_categoria_id
          where pc.pct_producto_id = p.pro_id and c.ctg_codigo ilike concat('%', p_ocasion, '%')
        )
      )
      and (
        p_formato is null or p_formato = 'CUALQUIERA' or exists (
          select 1 from comun_comercio.com_producto_categoria pc
          join comun_comercio.com_categoria c on c.ctg_id = pc.pct_categoria_id
          where pc.pct_producto_id = p.pro_id and c.ctg_codigo ilike concat('%', p_formato, '%')
        )
      )
    limit 4
  ) sub;

  return v_resultado;
end;
$$;
```

---

## 5. System Prompt del Agente ARIA para Tinkay ("Mía")

El siguiente prompt se configura en el agente de ARIA para Tinkay (`tinkay-vendedora-whatsapp`):

```markdown
# IDENTIDAD Y ROL
Eres Mía, sommelier floral y asesora de diseño de Tinkay Floristería en Quito y Cumbayá.
Tu misión es brindar una experiencia cálida, refinada y eficiente a los clientes que te escriben por WhatsApp, ayudándoles a seleccionar el arreglo floral ideal, redactar su tarjeta de dedicatoria, recolectar los datos de envío y facilitar su pago.

# TONO Y PERSONALIDAD
- Calidez botánica y empatía natural. Eres una experta en flores de alta gama (rosas ecuatorianas de exportación, follaje exótico, bouquets estilo coreano).
- Comunicación concisa estilo WhatsApp: escribe respuestas directas de 1 a 3 párrafos cortos (máximo 2 a 3 líneas por párrafo). Evita párrafos largos o abrumar al cliente.
- Uso sutil y elegante de emojis florales (🌿, 🌹, 💐, ✨). No uses más de 2 emojis por mensaje.

# REGLA CRÍTICA: MANEJO DE CONDOLENCIAS Y FUNERARIOS
- Si el cliente menciona condolencias, funeral, pésame, velación o fallecimiento:
  * Cambia inmediatamente a un tono solemne, empático y respetuoso.
  * Suprime cualquier emoji alegre o festivo (solo se permite 🕊️ o ninguno).
  * No digas "¡Qué emoción!" ni uses signos de exclamación.
  * Recomienda arreglos en tonos blancos/sobrios y la inclusión de cinta membretada solemne.

# PASO A PASO DE LA ATENCIÓN (EMBUDO DE CONVERSIÓN)
1. Saludo y Detección de Intención:
   - Saluda cordialmente y averigua: ¿Para quién es el detalle y qué motivo especial celebramos (amor, cumpleaños, aniversario, agradecimiento o condolencias)?
2. Asesoría y Recomendación con Catálogo:
   - Invoca la herramienta `consultar_catalogo_tinkay` con los criterios mencionados.
   - Presenta máximo 2 o 3 opciones ideales con su nombre, número de flores y precio exacto (PVP en dólares).
   - Siempre incluye el enlace al Álbum de Google Photos (`album_fotos_url`) para que el cliente aprecie las fotografías reales en alta resolución.
3. Mensaje para la Tarjeta Impresa:
   - Pregunta el mensaje personalizado que irá en la tarjeta de cortesía. Si el cliente no sabe qué escribir, propónle con amabilidad 2 frases emotivas acordes al motivo.
4. Información de Entrega:
   - Fecha de entrega deseada.
   - Franja horaria: Mañana (09:00 a 13:00) o Tarde (14:00 a 18:00) sin costo adicional; o indicar que si requiere entrega en Horario Exacto tiene un valor adicional de $10.00.
   - Nombre de quien recibe, teléfono de contacto y dirección detallada con referencia (o pin de ubicación de WhatsApp).
5. Cierre y Modalidad de Pago:
   - Presenta el desglose final claro (Arreglo + Delivery base o recargos).
   - Ofrece las dos opciones de pago autorizadas:
     * Link de pago en línea Payphone (tarjetas de crédito/débito nacionales e internacionales).
     * Transferencia bancaria directa (Banco Pichincha / Produbanco).

# POLÍTICA DE DELIVERY EN QUITO Y VALLES
- Quito Urbano y Cumbayá: Tarifa base $3.00 (o incluida en promociones vigentes).
- Valles lejanos (Tumbaco, San Rafael, Conocoto): $5.00 a $7.00 según sector.

# HERRAMIENTAS DISPONIBLES
- `consultar_catalogo_tinkay`: Consulta productos, precios, fotos y existencias en tiempo real.
- `escalar_a_humano`: Transfiere la conversación a una asesora humana en taller.

# CUÁNDO USAR `escalar_a_humano` (OBLIGATORIO)
Debes invocar la herramienta `escalar_a_humano` de inmediato en cualquiera de los siguientes casos:
1. Diseños a medida complejos o pedidos de flores que no existen en el catálogo.
2. Decoraciones integrales para bodas o iglesias que requieran cotización y montaje en sitio.
3. Clientes insatisfechos, quejas sobre pedidos pasados o demoras en la entrega.
4. Si el cliente solicita explícitamente hablar con una persona ("pásame un asesor", "quiero hablar con alguien").
5. Si no comprendes lo que el cliente solicita tras dos intentos consecutivos.
Al escalar, avisa amablemente al cliente: "Con mucho gusto, te comunico ahora mismo con una de nuestras asesoras florales en el taller para coordinar personalmente tu requerimiento especial 🌿".
```

---

## 6. Consola de Supervisión Humana (*Human-in-the-Loop Inbox*)

### A. Ubicación y Estándar de Widget
La consola se implementa como el widget `consola_chat` bajo el estándar de `PLT-011`, accesible desde el panel administrativo de Tinkay (`/panel/chat` o `/panel/mensajeria`).

* **Roles autorizados:** `ADMINISTRADOR`, `VENDEDORA`, `COORDINADORA_TALLER`.
* **Conexión en Tiempo Real:** Utiliza el canal Supabase Realtime suscrito a `comun_agentes.agc_conversacion` y `comun_agentes.agc_mensaje` filtrado por `cnv_negocio = 'tinkay'`.

### B. Arquitectura de la Pantalla (3 Paneles)

```
┌─────────────────────────┬───────────────────────────────────────────┬───────────────────────────┐
│ BANDEJA DE CONVERSACIONES│ VISOR Y CONTROL DEL CHAT EN VIVO          │ FICHA DE PEDIDO Y ASESORA │
├─────────────────────────┼───────────────────────────────────────────┼───────────────────────────┤
│ [ Buscar chat / cel... ] │ 👤 Juan Pérez (+593 99 123 4567)          │ Vendedora: [ Paola M. ▼ ] │
│ ─────────────────────── │ Estado: [ 🚨 ESCALADO A HUMANO ]          │ Comisión: 10%             │
│ Filtros:                │                                           │ ───────────────────────── │
│ [Todos] [🚨Requiere Hum]│ [ Botón: TOMAR CONTROL ] [ Reactivar Bot ]│ Detalle del Pedido:       │
│ [Mis Chats] [🟢Bot Act] │ ───────────────────────────────────────── │ • 1x Bouquet Coreano VIP  │
│                         │ [10:30] 👤 Cliente:                        │   PVP: $45.00             │
│ 🚨 Juan Pérez (+593...) │    Hola, quiero 100 rosas rojas para hoy  │ • Horario Exacto: $10.00  │
│    "puedo cambiar de... │ [10:30] 🤖 ARIA (Mía):                     │ • Delivery Cumbayá: $3.00 │
│    Hace 2 min · [Paola] │    ¡Hola Juan! 🌿 Con gusto te ayudo...   │ ───────────────────────── │
│                         │ [10:31] 👤 Cliente:                        │ TOTAL: $58.00             │
│ 🟢 María Sol (+593...)  │    ¿Tienen papel de seda negro y dorado?  │                           │
│    "gracias ya pagué"   │ [10:31] ⚙️ SISTEMA:                       │ [ Generar Link Payphone ] │
│    Hace 8 min · [Bot]   │    Transferido a humano: Consulta especial │                           │
│                         │ ───────────────────────────────────────── │ [ Confirmar y Enviar      │
│ 👤 Carlos V. (+593...)  │ Escribe un mensaje directo a WhatsApp...   │   al Taller de Armado ]   │
│    "listo a qué hora?"  │ [ Enviar ] [ ⚡ Respuestas Rápidas ]       │                           │
└─────────────────────────┴───────────────────────────────────────────┴───────────────────────────┘
```

### C. Comportamiento y Reglas de la Consola

1. **Indicadores de Estado Visuales:**
   * `🟢 BOT ACTIVO`: ARIA responde automáticamente al cliente. La asesora puede leer los mensajes en tiempo real como espectadora.
   * `🚨 ESCALADO A HUMANO`: ARIA detectó un caso especial o el cliente pidió un asesor. El chat emite una alerta sonora sutil y se posiciona al tope de la bandeja con badge rojo pulsante.
   * `🟡 EN ATENCIÓN HUMANA`: Una asesora pulsó el botón **"Tomar Control"** o envió un mensaje manual. ARIA se silencia por completo para este chat; el cliente habla exclusivamente con la persona.
   * `✅ CERRADO / RESUELTO`: El pedido fue cerrado o la consulta atendida.

2. **Acción "Tomar Control" (Pausar Bot):**
   * Al hacer clic en **"Tomar Control"** (o en el primer mensaje que la asesora escribe en el input), se ejecuta el RPC `agc_fn_cambiar_estado_conversacion(cnv_id, 'EN_ATENCION_ASESORA')`.
   * El webhook entrante de YCloud verifica este estado: cualquier mensaje posterior del cliente NO se envía a ARIA, manteniéndose en la cola de la asesora.

3. **Acción "Reactivar Bot":**
   * Si la asesora despejó la duda puntual y desea que ARIA continúe guiando al cliente (por ejemplo, para recolectar la dedicatoria o generar el pago), presiona **"Reactivar Bot"**.
   * El estado conmuta a `BOT_ACTIVO`. El próximo mensaje del cliente volverá a activar el razonamiento de ARIA.

4. **Atribución y Comisiones de Vendedoras:**
   * La asesora puede autoasignarse la conversación o reasignarla a una compañera.
   * Al generarse la venta, el `cnv_id` y el pedido quedan amarrados al `usu_id` de la vendedora para el cálculo automático de la **Base Comisionable Neta** establecido en [`catalogo-productos.md`](catalogo-productos.md) §6.A.

5. **Pase Directo a Taller:**
   * Una vez verificado el pago (mediante confirmación de Payphone o comprobante bancario validado), la asesora o coordinadora presiona **"Confirmar y Enviar al Taller"**.
   * Esto genera la orden formal en `comun_comercio.com_orden` y notifica a la pantalla del taller con la receta floral, fecha de despacho y dirección para el repartidor.

---

## 7. Plan de Despliegue y Migración desde ManyChat

| Fase | Tarea | Entregable |
| :--- | :--- | :--- |
| **Fase 1: Conectividad YCloud** | Configurar cuenta YCloud con el número oficial de Tinkay, registrar webhook seguro y variables de entorno (`YCLOUD_API_KEY`, `YCLOUD_WEBHOOK_SECRET`). | Webhook respondiendo `200 OK` a Meta. |
| **Fase 2: Persistencia y Realtime** | Migración de tablas `comun_agentes.agc_conversacion` y `comun_agentes.agc_mensaje` con triggers de auditoría y RLS. | Mensajes de WhatsApp guardándose en Supabase en tiempo real. |
| **Fase 3: Agente Mía & Catálogo MCP** | Registrar el agente `tinkay-vendedora-whatsapp` en ARIA con el prompt calibrado y la herramienta MCP `consultar_catalogo_tinkay`. | ARIA respondiendo en WhatsApp con álbumes de fotos y precios. |
| **Fase 4: Consola de Supervisión** | Desplegar el widget de consola de chat en `apps/tinkay-web` para las vendedoras y el taller floral con conmutador de "Tomar Control". | Asesoras interviniendo en chats en vivo. |
| **Fase 5: Desconexión ManyChat** | Cortar la automatización en ManyChat y transferir el tráfico al nuevo webhook de YCloud. | 100% de chats atendidos por ARIA + Equipo Humano. |
