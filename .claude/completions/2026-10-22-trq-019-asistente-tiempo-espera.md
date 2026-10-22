# TRQ-019 — El asistente del panel ya no se corta a los 60 s

**Síntoma (22-oct-2026):** en `tranqi24.com/panel`, el asistente del cliente respondía
"Se me cruzaron los cables un momento" con el código `http_504`.

**Causa:** `/api/asistente` tenía `maxDuration = 60`. Ese día el asistente-cliente tardó
110 s en ARIA con una pregunta de divorcio (34k tokens de entrada: varias rondas de
herramientas). Vercel mató la función: el navegador recibió un 504 sin cuerpo y la
respuesta, que ARIA sí llegó a generar, no se guardó en `trq_mensaje`. Los otros dos
turnos de esa conversación tardaron 42 s y 52 s, muy cerca del límite. El MCP del
catálogo responde en 0,5 s, así que el tiempo se va en el modelo y en el número de rondas.

**Cambio:**
- `maxDuration` de `/api/asistente` sube a 300 s. A ARIA se le esperan 270 s, mediante el
  nuevo parámetro `tiempoMaximoMs` de `invocarAgente` (120 s por defecto, sin cambios
  para el resto de llamadas).
- Si ARIA no responde a tiempo, la ruta devuelve `codigo: "aria_tiempo"` (504) en vez de
  dejar que Vercel corte.
- La barra avisa "Sigo en ello…" a los 20 s, tiene un mensaje propio para `aria_tiempo` y
  `http_504`, y conserva el `conversacion_id` también cuando el turno falla.

**Pendiente:** averiguar por qué el asistente-cliente da tantas rondas (de 8–19 s a
principios de octubre a 40–110 s hoy). ARIA no expone los pasos de cada ejecución.
