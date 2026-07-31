// Envia un correo con el servidor SMTP que el ADMINISTRADOR configuro para su
// negocio (PLT-008). Segunda Edge Function del ecosistema y segundo lugar con
// service_role, por el mismo motivo que restablecer-contrasena: la credencial
// no puede estar al alcance de una sesion de navegador.
//
// Por que no lo hace Next.js directamente, como antes: la contrasena SMTP vive
// en Supabase Vault y solo service_role la descifra
// (cfg_fn_obtener_smtp_credenciales). Si expusieramos esa lectura a
// `authenticated` la veria cualquier usuario logueado, y si la expusieramos a
// `anon` -- necesario, porque el OTP de registro se manda cuando todavia no
// hay sesion -- la veria internet entera.
//
// verify_jwt=false al desplegar: el flujo de registro no tiene JWT. Lo que
// autentica la llamada es la cabecera x-correo-clave, un secreto compartido
// solo entre esta funcion y nuestros Server Actions. Sin el, esta funcion
// seria un relay de spam abierto contra el SMTP del negocio.
import { createClient } from "jsr:@supabase/supabase-js@2";
// denomailer y no nodemailer: esto es Deno, no Node. Version fijada, igual
// que el resto de dependencias del ecosistema.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";

const CLAVE = Deno.env.get("CORREO_FUNCION_CLAVE");

// Comparacion en tiempo constante: un `===` sobre un secreto filtra su
// prefijo por el tiempo que tarda en fallar.
function claveValida(recibida: string | null): boolean {
  if (!CLAVE || !recibida || recibida.length !== CLAVE.length) return false;
  let diferencia = 0;
  for (let i = 0; i < CLAVE.length; i++) {
    diferencia |= CLAVE.charCodeAt(i) ^ recibida.charCodeAt(i);
  }
  return diferencia === 0;
}

function respuesta(cuerpo: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(cuerpo), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return respuesta({ error: "Metodo no permitido" }, 405);
  }

  if (!CLAVE) {
    console.error("enviar-correo: falta el secreto CORREO_FUNCION_CLAVE en la funcion");
    return respuesta({ error: "Funcion mal configurada" }, 500);
  }

  if (!claveValida(req.headers.get("x-correo-clave"))) {
    return respuesta({ error: "No autorizado" }, 401);
  }

  let cuerpo: { negocio?: unknown; para?: unknown; asunto?: unknown; html?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta({ error: "Cuerpo invalido" }, 400);
  }

  const { negocio, para, asunto, html } = cuerpo;
  if (
    typeof negocio !== "string" ||
    typeof para !== "string" ||
    typeof asunto !== "string" ||
    typeof html !== "string" ||
    !para.includes("@")
  ) {
    return respuesta({ error: "Datos invalidos" }, 400);
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const { data, error } = await supabase
    .schema("comun_configuracion")
    .rpc("cfg_fn_obtener_smtp_credenciales", { p_negocio: negocio });

  if (error) {
    console.error("enviar-correo: fallo al leer credenciales", error);
    return respuesta({ error: "No se pudo leer la configuracion de correo" }, 500);
  }

  const configuracion = Array.isArray(data) ? data[0] : null;
  if (!configuracion) {
    // La funcion SQL solo devuelve fila si el negocio esta activo y completo.
    // 409 y no 500: no es una falla del sistema, es que falta configurarlo.
    return respuesta({ error: "El negocio no tiene un servidor SMTP activo" }, 409);
  }

  const cliente = new SMTPClient({
    connection: {
      hostname: configuracion.host,
      port: configuracion.puerto,
      tls: configuracion.seguro,
      auth: { username: configuracion.usuario, password: configuracion.contrasena },
    },
  });

  try {
    await cliente.send({
      from: configuracion.remitente_nombre
        ? `${configuracion.remitente_nombre} <${configuracion.usuario}>`
        : configuracion.usuario,
      to: para,
      subject: asunto,
      html,
    });
  } catch (e) {
    // El mensaje del proveedor SMTP puede traer el usuario, nunca la
    // contrasena, pero igual se queda en el log y no viaja al cliente.
    console.error("enviar-correo: fallo el envio", e);
    return respuesta({ error: "No se pudo enviar el correo" }, 502);
  } finally {
    // Cerrar puede fallar si la conexion nunca llego a abrirse; ese error no
    // debe tapar el del envio, que es el que importa.
    await cliente.close().catch(() => {});
  }

  return respuesta({ ok: true }, 200);
});
