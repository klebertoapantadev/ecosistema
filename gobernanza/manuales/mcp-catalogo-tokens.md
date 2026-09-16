# Manual de Integración: Tokens de Acceso y Servidor MCP del Catálogo Comercial

Este manual describe el funcionamiento, generación y consumo de las herramientas **Model Context Protocol (MCP)** sobre HTTP para los 4 negocios del ecosistema (`tinkay`, `fastfix`, `tranqi`, `margaritas`).

---

## 1. ¿Qué es el Servidor MCP de Catálogo?

El **Servidor MCP de Catálogo** expone las herramientas comerciales del ecosistema (`comun_comercio`) bajo el estándar abierto **Model Context Protocol (JSON-RPC 2.0 / `streamable_http`)**.

Permite que asistentes de inteligencia artificial externos (como bots de WhatsApp sobre **YCloud**, flujos en **n8n**, **Claude Desktop**, **Cursor** o agentes personalizados) consulten de forma autónoma y en tiempo real:
- Catálogo de productos, servicios, ramos y honorarios.
- Precios y variantes oficiales con cálculo de **IVA 15% SRI**.
- Enlaces a álbumes de fotos oficiales (Google Photos / CDN).
- Disponibilidad operativa y existencias.

---

## 2. Generación y Gestión de Tokens MCP

Cada negocio gestiona sus propias credenciales desde la consola web:

1. Ingresa al panel del negocio (ej. `https://tinkay-web.vercel.app/panel/configuracion`).
2. Selecciona el widget **"Tokens & APIs MCP"**.
3. Haz clic en el botón **"Crear Token"**.
4. Define:
   - **Nombre:** Identificador descriptivo (ej. `Agente WhatsApp YCloud`).
   - **Alcances (Scopes):** `catalogo:leer` (consulta de catálogo y precios) y/o `pedidos:crear`.
   - **Vigencia:** Permanente o caducidad a 30, 90 o 365 días.
5. **Copia la clave generada:** El token (ej. `eco_live_8f3a9e42...`) se muestra **una única vez**. Guarda este valor en tus variables de entorno o gestor de secretos.

---

## 3. Especificación Técnica de los Endpoints

### Endpoint por Negocio:
| Negocio | URL Base del Servidor MCP |
| :--- | :--- |
| **Tinkay Floristería** | `POST https://tinkay-web.vercel.app/api/mcp/catalogo` |
| **Tranqi Legal** | `POST https://tranqi-web.vercel.app/api/mcp/catalogo` |
| **FastFix Home** | `POST https://fastfix-web.vercel.app/api/mcp/catalogo` |
| **Margaritas Floristería** | `POST https://margaritas-web.vercel.app/api/mcp/catalogo` |

### Encabezados Requeridos:
```http
Authorization: Bearer eco_live_TU_TOKEN_AQUI
Content-Type: application/json
```

---

## 4. Herramientas Disponibles (Tools)

### 1. `consultar_catalogo`
Busca productos, ramos o servicios filtrados por término, categoría o presupuesto.

**Argumentos:**
```json
{
  "termino": "rosas rojas",
  "categoria": "condolencias",
  "presupuesto_max_usd": 45.00,
  "ocasion": "aniversario"
}
```

### 2. `detalle_producto`
Obtiene la ficha técnica, variantes de precio y fotos de un producto específico.

**Argumentos:**
```json
{
  "slug_o_id": "ramo-rosas-pasion"
}
```

---

## 5. Ejemplos Prácticos de Integración

### A. Consulta con `cURL` (Protocolo MCP / JSON-RPC 2.0)

```bash
curl -X POST https://tinkay-web.vercel.app/api/mcp/catalogo \
  -H "Authorization: Bearer eco_live_8f3a9e42..." \
  -H "Content-Type: application/json" \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "tools/call",
    "params": {
      "name": "consultar_catalogo",
      "arguments": {
        "termino": "rosas"
      }
    }
  }'
```

### B. Configuración en `claude_desktop_config.json` o `Cursor MCP`

```json
{
  "mcpServers": {
    "tinkay-catalogo": {
      "url": "https://tinkay-web.vercel.app/api/mcp/catalogo",
      "headers": {
        "Authorization": "Bearer eco_live_8f3a9e42..."
      }
    }
  }
}
```

### C. Integración en Flujo n8n / Webhook WhatsApp YCloud

1. En el nodo **HTTP Request** de n8n:
   - **Method:** `POST`
   - **URL:** `https://tinkay-web.vercel.app/api/mcp/catalogo`
   - **Authentication:** Header Auth $\rightarrow$ `Authorization: Bearer eco_live_...`
   - **Body Parameters:** Enviar el JSON-RPC correspondiente al mensaje del cliente de WhatsApp.
2. El agente de IA responderá con los álbumes de fotos y precios para enviar directamente al chat.

---

## 6. Seguridad y Revocación

- Si sospechas que un token ha sido comprometido, entra al panel de administración y haz clic en **"Revocar"**.
- El token quedará invalidado de inmediato en la base de datos PostgreSQL y responderá HTTP `401 Unauthorized` ante cualquier intento posterior.
