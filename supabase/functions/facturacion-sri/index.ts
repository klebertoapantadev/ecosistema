// Worker de facturación electrónica SRI (PLT-006). Vacía la cola de
// comun_facturacion.fac_comprobante: genera el XML, lo firma (XAdES-BES), lo
// envía al SRI, consulta la autorización, guarda XML autorizado y RIDE en
// Storage y los envía por correo. La lógica está en procesador.ts.
//
// Quién la llama: pg_cron cada minuto y fac_fn_emitir_interno al emitir, con
// pg_net (comun_facturacion.fac_fn_despertar_worker). verify_jwt=false: lo que
// autentica la llamada es la cabecera x-facturacion-clave, comparada en tiempo
// constante con el secreto FACTURACION_FUNCION_CLAVE (el mismo valor que el
// secreto 'facturacion_funcion_clave' de Vault). Sin él cualquiera podría
// forzar envíos al SRI.
//
// Variables: SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY (las pone Supabase),
// FACTURACION_FUNCION_CLAVE y FACTURACION_PERMITIR_PRODUCCION ("true" para
// dejar salir comprobantes de ambiente 2; por defecto, no).
import { createClient } from "jsr:@supabase/supabase-js@2";
// denomailer, como enviar-correo: versión fijada.
import { SMTPClient } from "https://deno.land/x/denomailer@1.6.0/mod.ts";
import { consultarAutorizacion, enviarRecepcion } from "../_compartido/sri/soap.ts";
import { type Dependencias, type ItemCola, Procesador } from "./procesador.ts";

const CLAVE = Deno.env.get("FACTURACION_FUNCION_CLAVE");
// Cada comprobante puede tardar ~65 s si el SRI va lento; con 60 s de margen
// para empezar el último, la vuelta cabe en el límite de 150 s de la función.
const TIEMPO_VUELTA_MS = 60_000;

function claveValida(recibida: string | null): boolean {
  if (!CLAVE || !recibida || recibida.length !== CLAVE.length) return false;
  let diferencia = 0;
  for (let i = 0; i < CLAVE.length; i++) diferencia |= CLAVE.charCodeAt(i) ^ recibida.charCodeAt(i);
  return diferencia === 0;
}

function respuesta(cuerpo: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { "Content-Type": "application/json" } });
}

function dependencias(): Dependencias {
  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const fac = () => supabase.schema("comun_facturacion");
  const comprobar = (error: { message: string } | null, que: string) => {
    if (error) throw new Error(`${que}: ${error.message}`);
  };

  return {
    async tomarLote(limite) {
      const { data, error } = await fac().rpc("fac_fn_tomar_lote", { p_limite: limite });
      comprobar(error, "fac_fn_tomar_lote");
      return (data ?? []) as ItemCola[];
    },
    async registrarResultado(id, cambios, evento, detalle) {
      const { error } = await fac().rpc("fac_fn_registrar_resultado", {
        p_id: id,
        p_cambios: cambios,
        p_evento: evento ?? null,
        p_detalle: detalle ?? {},
      });
      comprobar(error, "fac_fn_registrar_resultado");
    },
    async registrarCorreo(id, enviado, detalle) {
      const { error } = await fac().rpc("fac_fn_registrar_correo", { p_id: id, p_enviado: enviado, p_detalle: detalle });
      comprobar(error, "fac_fn_registrar_correo");
    },
    async obtenerCertificado(certificadoId) {
      const { data, error } = await fac().rpc("fac_fn_obtener_certificado", { p_certificado: certificadoId });
      comprobar(error, "fac_fn_obtener_certificado");
      const fila = Array.isArray(data) ? data[0] : null;
      return fila ? { p12Base64: fila.p12_base64, clave: fila.clave } : null;
    },
    async subir(ruta, contenido, tipo) {
      const { error } = await supabase.storage.from("facturacion").upload(ruta, contenido, {
        contentType: tipo,
        upsert: true,
      });
      comprobar(error, `Storage ${ruta}`);
    },
    async enviarCorreo(negocio, correo) {
      const { data, error } = await supabase
        .schema("comun_configuracion")
        .rpc("cfg_fn_obtener_smtp_credenciales", { p_negocio: negocio });
      comprobar(error, "cfg_fn_obtener_smtp_credenciales");
      const smtp = Array.isArray(data) ? data[0] : null;
      if (!smtp) return "sin_smtp";
      const cliente = new SMTPClient({
        connection: {
          hostname: smtp.host,
          port: smtp.puerto,
          tls: smtp.seguro,
          auth: { username: smtp.usuario, password: smtp.contrasena },
        },
      });
      try {
        await cliente.send({
          from: smtp.remitente_nombre ? `${smtp.remitente_nombre} <${smtp.usuario}>` : smtp.usuario,
          to: correo.para,
          ...(correo.copia ? { bcc: correo.copia } : {}),
          subject: correo.asunto,
          html: correo.html,
          attachments: correo.adjuntos.map((a) => ({
            filename: a.nombre,
            content: a.contenido,
            contentType: a.tipo,
            encoding: "binary" as const,
          })),
        });
      } finally {
        // Cerrar puede fallar si la conexión no llegó a abrirse; no debe tapar el error del envío.
        try {
          await cliente.close();
        } catch { /* ya cerrada */ }
      }
      return "enviado";
    },
    recepcion: (ambiente, xml) => enviarRecepcion(ambiente, xml),
    autorizacion: (ambiente, clave) => consultarAutorizacion(ambiente, clave),
    ahora: () => new Date(),
    esperar: (ms) => new Promise((r) => setTimeout(r, ms)),
    permitirProduccion: Deno.env.get("FACTURACION_PERMITIR_PRODUCCION") === "true",
  };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") return respuesta({ error: "Metodo no permitido" }, 405);
  if (!CLAVE) {
    console.error("facturacion-sri: falta el secreto FACTURACION_FUNCION_CLAVE");
    return respuesta({ error: "Funcion mal configurada" }, 500);
  }
  if (!claveValida(req.headers.get("x-facturacion-clave"))) return respuesta({ error: "No autorizado" }, 401);

  try {
    const resultado = await new Procesador(dependencias()).procesarCola(TIEMPO_VUELTA_MS);
    return respuesta({ ok: true, ...resultado }, 200);
  } catch (e) {
    // Un fallo de la base a mitad de vuelta: el bloqueo del comprobante caduca
    // en 5 minutos y otra vuelta lo retoma.
    console.error("facturacion-sri: vuelta interrumpida", e);
    return respuesta({ error: "Vuelta interrumpida" }, 500);
  }
});
