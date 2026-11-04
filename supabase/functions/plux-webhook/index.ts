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

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return respuesta({ error: "Metodo no permitido" }, 405);
  }

  const negocio = new URL(req.url).searchParams.get("negocio");
  if (!negocio) {
    return respuesta({ error: "Falta el negocio" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data: credenciales, error: errorCredenciales } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_credenciales_webhook_plux", { p_negocio: negocio });

  const cred = Array.isArray(credenciales) ? credenciales[0] : null;
  if (errorCredenciales || !cred?.cliente_id || !cred?.clave_secreta) {
    console.error("plux-webhook: PLUX no esta activo o le faltan credenciales", negocio, errorCredenciales);
    return respuesta({ error: "Pasarela no configurada" }, 503);
  }

  // La documentacion de PLUX nombra la cabecera "Authorization" en el texto y
  // "Authentication" en su ejemplo curl: se aceptan las dos.
  const recibida = (req.headers.get("authorization") ?? req.headers.get("authentication") ?? "").trim();
  const esperada = "Basic " + btoa(`${cred.cliente_id}:${cred.clave_secreta}`);
  if (!igualSeguro(recibida, esperada)) {
    // Solo los nombres de cabecera: los valores podrían traer credenciales.
    console.warn("plux-webhook: autenticacion invalida; cabeceras:", [...req.headers.keys()].join(","));
    return respuesta({ error: "No autorizado" }, 401);
  }

  let notificacion: Record<string, unknown>;
  try {
    notificacion = await req.json();
  } catch {
    return respuesta({ error: "Cuerpo invalido" }, 400);
  }
  if (typeof notificacion?.extras !== "string") {
    return respuesta({ error: "Falta extras" }, 400);
  }

  const { data, error } = await supabase
    .schema("comun_comercio")
    .rpc("com_fn_confirmar_pago_plux", { p_negocio: negocio, p_notificacion: notificacion });

  if (error) {
    // 500: PLUX reintenta, y la RPC es idempotente.
    console.error("plux-webhook: fallo al confirmar", notificacion.extras, error);
    return respuesta({ error: "No se pudo registrar el pago" }, 500);
  }

  console.log("plux-webhook:", notificacion.extras, JSON.stringify(data));
  // Un pago que no es nuestro responde 200 igual: si no, PLUX insiste sin fin.
  return respuesta({ ok: true }, 200);
});
