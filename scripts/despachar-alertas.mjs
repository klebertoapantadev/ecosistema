#!/usr/bin/env node
/**
 * Disparo del despachador desde la línea de órdenes (PLT-020 regla 8).
 *
 * Existe para que un servidor Linux propio no necesite nada de Vercel: basta una
 * línea en `/etc/cron.d/` invocando este script, o el `curl` equivalente.
 *
 *   CRON_SECRET=... URL_BASE=https://app.tranqi24.com node scripts/despachar-alertas.mjs
 */

const secreto = process.env.CRON_SECRET;
const base = process.env.URL_BASE || process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";

if (!secreto) {
  console.error("Falta CRON_SECRET. El despachador no acepta peticiones sin autenticar.");
  process.exit(2);
}

const destino = new URL("/api/cron/despachador-alertas", base);

try {
  const respuesta = await fetch(destino, {
    method: "POST",
    headers: { authorization: `Bearer ${secreto}` }
  });
  const cuerpo = await respuesta.json().catch(() => null);
  console.log(JSON.stringify({ estado: respuesta.status, ...cuerpo }, null, 2));
  // 207 significa que hubo fallos parciales, y un cron que los ignora los
  // convierte en silencio: se sale con error para que el supervisor lo vea.
  process.exit(respuesta.status === 200 ? 0 : 1);
} catch (error) {
  console.error(`No se pudo contactar con ${destino}: ${error.message}`);
  process.exit(1);
}
