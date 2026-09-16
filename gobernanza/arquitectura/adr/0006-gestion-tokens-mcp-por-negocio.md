# ADR-0006: Tokens de Acceso MCP e Integraciones Agénticas por Negocio

**Fecha:** 2026-09-16  
**Estado:** aceptada  

## Contexto

[ADR-0002](0002-aria-como-estandar-de-agentes-conversacionales.md) y [ADR-0005](0005-frontera-de-identidad-en-herramientas-de-ia.md) fijaron el uso de ARIA como motor de agentes y establecieron el mecanismo de autenticación para usuarios web mediante **Cápsulas de Identidad JWT** de corta vida (5 min).

Sin embargo, a medida que los negocios (`tinkay`, `fastfix`, `tranqi`, `margaritas`) requieren conectar herramientas MCP del ecosistema (como el **Catálogo Comercial unificado** de `comun_comercio` o la consulta de existencias) con **clientes y agentes externos** (ej. agentes autónomos de WhatsApp en YCloud, flujos de n8n, bots externos, Claude Desktop, Cursor, etc.), se hizo necesario un mecanismo de autenticación de servidor a servidor donde:
1. Cada negocio pueda generar de forma autónoma sus propios **Tokens de Acceso MCP (API Keys)**.
2. Las claves nunca se almacenen en texto plano en la base de datos.
3. Se garantice el aislamiento estricto de datos por `negocio_id` en las llamadas MCP.
4. Los tokens puedan expirar o revocarse inmediatamente sin reiniciar servicios ni afectar a otros negocios.

## Decisión

1. **Esquema de Almacenamiento Criptográfico (`comun_seguridad.seg_token_mcp`):**
   - El token se genera con **256 bits de entropía** (`eco_live_<64_hex_chars>`).
   - La base de datos almacena exclusivamente el **hash SHA-256** (`tkn_hash_secreto`), calculado con `extensions.digest()`.
   - Se almacena un prefijo público legible (ej. `eco_live_8f3a9e...`) para visualización y auditoría en la consola.
   - El secreto en texto plano se retorna y muestra **una sola vez** al administrador al momento de su creación.

2. **Aislamiento y RLS:**
   - La tabla `seg_token_mcp` tiene RLS habilitado: solo los administradores del respectivo negocio (`seg_fn_es_admin_negocio(tkn_negocio_id)`) y superadministradores pueden listar y revocar credenciales.
   - Toda creación, revocación o uso queda auditado mediante `aud_fn_auditar_tabla()`.

3. **Validación en Tiempo de Ejecución (`seg_fn_validar_token_mcp`):**
   - El middleware / servidor MCP valida el token extrayendo el Bearer token del header `Authorization`.
   - La función verifica que el hash coincida, que no esté revocado (`tkn_revocado_en is null`), que no haya expirado (`tkn_expira_en > now()`) y que cuente con el scope requerido (`catalogo:leer`, `pedidos:crear`, o `*`).
   - Actualiza de forma asíncrona la marca de tiempo `tkn_ultimo_uso_en`.

4. **Autenticación Dual en `@eco/agentes-ia`:**
   - El protocolo MCP sobre HTTP (`packages/agentes-ia/src/mcp-servidor.ts` y `packages/agentes-ia/src/mcp-catalogo.ts`) soporta indistintamente:
     - **Cápsula JWT de usuario** (para asistentes interactivos en navegador web).
     - **Bearer Token de Negocio** (para integraciones de servidor a servidor y agentes externos).

5. **Exposición de Endpoints MCP:**
   - Cada app web (`tinkay-web`, `fastfix-web`, `tranqi-web`, `margaritas-web`) expone la ruta `POST /api/mcp/catalogo`.
   - El endpoint es 100% agnóstico de la plataforma de hosting (utiliza Web APIs estándar `Request`/`Response` y JSON-RPC 2.0), permitiendo operar tanto en Vercel como en contenedores Docker en VPC privadas sin cambios de código.

## Consecuencias

- Los negocios tienen autonomía para emitir y rotar sus propias credenciales de integración.
- Los clientes externos como WhatsApp bots y automatizaciones n8n consultan el catálogo en tiempo real con datos de variantes, precios e IVA 15% SRI.
- Los tokens revocados dejan de funcionar en milisegundos sin latencia ni reinicio de servidores.
