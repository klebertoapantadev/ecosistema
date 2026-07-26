# aria-mcp

Servidor MCP (stdio, sin dependencias) para administrar tenants, agentes y keys de ARIA desde Claude Code — migrado de `klebertoapantadev/tranqi`. Ver [ADR-0002](../../gobernanza/arquitectura/adr/0002-aria-como-estandar-de-agentes-conversacionales.md): ARIA es el estándar de agentes conversacionales de todo el ecosistema, no solo de Tranqi.

## Uso

```bash
claude mcp add --scope user aria -- node tools/aria-mcp/server.js
```

Requiere `ARIA_API_URL` y `ARIA_API_TOKEN` en el entorno.

## Pendiente de limpiar

El archivo trae un *fallback* que lee `C:\Users\jesus\ARIA\interfaz\.env` si las variables de entorno no están presentes — una ruta de una máquina específica, no portable. Funciona igual con las variables de entorno seteadas (que es el camino recomendado), pero conviene eliminar ese fallback en un PR aparte para no depender de una ruta local ajena.
