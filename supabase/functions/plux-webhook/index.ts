// Webhook de PLUX (PagoPlux): confirma los pagos del checkout (TRQ-ADM-004).
//
// Es la única vía por la que un pago con PLUX pasa a APROBADO y activa un
// plan. El navegador también recibe un "succeeded" del paybox, pero eso lo
// puede fingir cualquiera; esta llamada viene de PLUX.
//
// Autenticación: PLUX no firma el webhook. Envía Basic con las credenciales
// de API elegidas en su dashboard (Developers → Web hook → Credencial), y esas
// mismas están en com_pasarela_configuracion.psc_credenciales_privadas. Es una
// excepción a la regla de firma de gobernanza/politicas/seguridad-y-datos.md
// §7, documentada allí; la mitigan el cotejo del monto contra lo que fijó el
// servidor y la idempotencia de com_fn_confirmar_pago_plux.
//
// verify_jwt=false al desplegar: PLUX no tiene JWT de Supabase.
// URL a configurar en PLUX: .../functions/v1/plux-webhook?negocio=tranqi
import { createClient } from "jsr:@supabase/supabase-js@2";

function respuesta(cuerpo: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

// Comparacion en tiempo constante: un `===` sobre un secreto filtra su
// prefijo por el tiempo que tarda en fallar.
function igualSeguro(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferencia = 0;
  for (let i = 0; i < a.length; i++) {
    diferencia |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diferencia === 0;
}

type Supa = ReturnType<typeof createClient>;

// Traza en comun_auditoria.aud_traza (TRQ-039): misma correlación que el
// checkout (el identificador PLUX que llega en "extras"), así se ve si el
// webhook llegó y qué contestó. Nunca lanza.
async function traza(
  supabase: Supa,
  t: { negocio: string | null; paso: string; nivel?: "INFO" | "AVISO" | "ERROR"; correlacion?: string | null; mensaje?: string; detalle?: Record<string, unknown>; inicio: number },
) {
  try {
    const { error } = await supabase.schema("comun_auditoria").from("aud_traza").insert({
      tra_negocio: t.negocio?.slice(0, 30) ?? null,
      tra_flujo: "PAGO_PLUX",
      tra_paso: t.paso,
      tra_nivel: t.nivel ?? "INFO",
      tra_origen: "WEBHOOK",
      tra_correlacion: t.correlacion?.slice(0, 80) ?? null,
      tra_duracion_ms: Date.now() - t.inicio,
      tra_mensaje: t.mensaje?.slice(0, 1000) ?? null,
      tra_detalle_traza: t.detalle ?? {},
    });
    if (error) console.error("plux-webhook: no se pudo guardar la traza", error.message);
  } catch (e) {
    console.error("plux-webhook: no se pudo guardar la traza", e);
  }
}

Deno.serve(async (req: Request) => {
  const inicio = Date.now();
  if (req.method !== "POST") {
    return respuesta({ error: "Metodo no permitido" }, 405);
  }

  const negocio = new URL(req.url).searchParams.get("negocio");
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  if (!negocio) {
    await traza(supabase, { negocio: null, paso: "webhook.sin_negocio", nivel: "ERROR", mensaje: "Llamada sin ?negocio=", inicio });
    return respuesta({ error: "Falta el negocio" }, 400);
  }

  const { data: credenciales, error: errorCredenciales } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_credenciales_webhook_plux", { p_negocio: negocio });

  const cred = Array.isArray(credenciales) ? credenciales[0] : null;
  if (errorCredenciales || !cred?.cliente_id || !cred?.clave_secreta) {
    console.error("plux-webhook: PLUX no esta activo o le faltan credenciales", negocio, errorCredenciales);
    await traza(supabase, { negocio, paso: "webhook.sin_credenciales", nivel: "ERROR", mensaje: errorCredenciales?.message ?? "PLUX inactivo o sin credenciales", inicio });
    return respuesta({ error: "Pasarela no configurada" }, 503);
  }

  // La documentacion de PLUX nombra la cabecera "Authorization" en el texto y
  // "Authentication" en su ejemplo curl: se aceptan las dos.
  const recibida = (req.headers.get("authorization") ?? req.headers.get("authentication") ?? "").trim();
  const esperada = "Basic " + btoa(`${cred.cliente_id}:${cred.clave_secreta}`);
  if (!igualSeguro(recibida, esperada)) {
    // Solo los nombres de cabecera: los valores podrían traer credenciales.
    console.warn("plux-webhook: autenticacion invalida; cabeceras:", [...req.headers.keys()].join(","));
    await traza(supabase, {
      negocio,
      paso: "webhook.no_autorizado",
      nivel: "ERROR",
      mensaje: recibida ? "Credencial Basic distinta a la configurada" : "Sin cabecera de autenticación",
      detalle: { cabeceras: [...req.headers.keys()].slice(0, 30).map((h) => h.slice(0, 60)) },
      inicio,
    });
    return respuesta({ error: "No autorizado" }, 401);
  }

  let cuerpoRecibido: Record<string, unknown>;
  try {
    cuerpoRecibido = await req.json();
  } catch {
    await traza(supabase, { negocio, paso: "webhook.cuerpo_invalido", nivel: "ERROR", mensaje: "El cuerpo no es JSON", inicio });
    return respuesta({ error: "Cuerpo invalido" }, 400);
  }
  const notificacion =
    cuerpoRecibido?.detail && typeof cuerpoRecibido.detail === "object"
      ? { ...cuerpoRecibido, ...(cuerpoRecibido.detail as Record<string, unknown>) }
      : cuerpoRecibido;

  if (typeof notificacion?.extras !== "string") {
    await traza(supabase, { negocio, paso: "webhook.sin_extras", nivel: "ERROR", mensaje: "La notificación no trae extras", detalle: { claves: Object.keys(notificacion ?? {}) }, inicio });
    return respuesta({ error: "Falta extras" }, 400);
  }

  const { data, error } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_confirmar_pago_plux", { p_negocio: negocio, p_notificacion: notificacion });

  if (error) {
    // 500: PLUX reintenta, y la RPC es idempotente.
    console.error("plux-webhook: fallo al confirmar", notificacion.extras, error);
    await traza(supabase, { negocio, paso: "webhook.error_confirmar", nivel: "ERROR", correlacion: notificacion.extras, mensaje: error.message, detalle: { codigo: error.code, estado_plux: notificacion.state, monto: notificacion.amount }, inicio });
    return respuesta({ error: "No se pudo registrar el pago" }, 500);
  }

  console.log("plux-webhook:", notificacion.extras, JSON.stringify(data));
  const resultado = (data ?? {}) as Record<string, unknown>;
  await traza(supabase, {
    negocio,
    paso: "webhook.procesado",
    nivel: resultado.estado === "APROBADO" ? "INFO" : "AVISO",
    correlacion: notificacion.extras,
    mensaje: `PLUX: ${notificacion.state ?? "?"} → ${resultado.estado ?? "?"}${resultado.motivo ? ` (${resultado.motivo})` : ""}`,
    detalle: { estado_plux: notificacion.state, monto: notificacion.amount, fecha_plux: notificacion.fecha, resultado },
    inicio,
  });
  // Un pago que no es nuestro responde 200 igual: si no, PLUX insiste sin fin.
  return respuesta({ ok: true }, 200);
});
