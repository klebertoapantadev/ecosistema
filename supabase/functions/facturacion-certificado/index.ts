// Sube el certificado de firma (.p12) de un negocio para la facturación
// electrónica SRI (PLT-006).
//
// Por qué una Edge Function y no un RPC: hay que abrir el .p12 con su
// contraseña para comprobar que es válido, que sirve para firmar, que no está
// caducado y que pertenece al RUC del emisor, antes de guardarlo. Eso necesita
// node-forge y no se puede hacer en Postgres. El .p12 y la contraseña acaban en
// Vault (fac_fn_registrar_certificado, solo service_role); nunca se escriben en
// logs ni vuelven al navegador.
//
// verify_jwt=true: la llamada lleva el JWT del usuario. Además se exige perfil
// ADMINISTRADOR del negocio (no OPERADOR) y MFA verificado (aal2): quien tiene
// el certificado puede emitir comprobantes tributarios en nombre del negocio.
//
// POST { negocio, p12_base64, clave } → { ok, certificado: {titular, identificacion, emisor, valido_hasta, …} }
import { createClient } from "jsr:@supabase/supabase-js@2";
import { decodeBase64 } from "jsr:@std/encoding@1.0.10/base64";
import { cargarCertificado, CertificadoInvalido } from "../_compartido/sri/certificado.ts";

// Un .p12 con su cadena pesa unos pocos KB; más de esto no es un certificado.
const TAMANO_MAXIMO = 64 * 1024;

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function respuesta(cuerpo: Record<string, unknown>, status: number) {
  return new Response(JSON.stringify(cuerpo), { status, headers: { ...CORS, "Content-Type": "application/json" } });
}

// La pasarela de Supabase ya validó la firma del JWT (verify_jwt=true); aquí
// solo se lee el claim aal.
function claims(token: string): Record<string, unknown> {
  try {
    const carga = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(new TextDecoder().decode(decodeBase64(carga + "=".repeat((4 - carga.length % 4) % 4))));
  } catch {
    return {};
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: CORS });
  if (req.method !== "POST") return respuesta({ error: "Metodo no permitido" }, 405);

  const autorizacion = req.headers.get("Authorization") ?? "";
  const token = autorizacion.replace(/^Bearer\s+/i, "");
  if (!token) return respuesta({ error: "No autorizado" }, 401);

  let cuerpo: { negocio?: unknown; p12_base64?: unknown; clave?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return respuesta({ error: "Cuerpo invalido" }, 400);
  }
  const { negocio, p12_base64, clave } = cuerpo;
  if (typeof negocio !== "string" || typeof p12_base64 !== "string" || typeof clave !== "string" || !clave) {
    return respuesta({ error: "Datos invalidos" }, 400);
  }

  const url = Deno.env.get("SUPABASE_URL")!;
  const usuario = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
    auth: { persistSession: false },
    global: { headers: { Authorization: `Bearer ${token}` } },
  });
  const { data: sesion, error: errorSesion } = await usuario.auth.getUser(token);
  if (errorSesion || !sesion.user) return respuesta({ error: "No autorizado" }, 401);

  if (claims(token).aal !== "aal2") {
    return respuesta({ error: "Subir el certificado de firma exige verificacion MFA" }, 403);
  }
  const { data: esAdmin, error: errorAdmin } = await usuario.schema("comun_facturacion").rpc("fac_fn_es_admin", {
    p_negocio: negocio,
  });
  if (errorAdmin || esAdmin !== true) return respuesta({ error: "No autorizado" }, 403);

  const servicio = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, { auth: { persistSession: false } });
  const { data: emisor } = await servicio
    .schema("comun_facturacion")
    .from("fac_emisor")
    .select("emi_ruc")
    .eq("emi_negocio", negocio)
    .maybeSingle();
  if (!emisor) return respuesta({ error: "Configura primero los datos del emisor" }, 409);

  let bytes: Uint8Array;
  try {
    bytes = decodeBase64(p12_base64);
  } catch {
    return respuesta({ error: "El archivo no esta en base64" }, 400);
  }
  if (bytes.length === 0 || bytes.length > TAMANO_MAXIMO) return respuesta({ error: "Archivo de certificado invalido" }, 400);

  let metadatos;
  try {
    ({ metadatos } = await cargarCertificado(bytes, clave));
  } catch (e) {
    if (e instanceof CertificadoInvalido) return respuesta({ error: e.message }, 422);
    console.error("facturacion-certificado: fallo inesperado al abrir el .p12", e);
    return respuesta({ error: "No se pudo leer el certificado" }, 422);
  }

  if (metadatos.validoHasta.getTime() <= Date.now()) {
    return respuesta({ error: "El certificado esta caducado" }, 422);
  }
  if (metadatos.validoDesde.getTime() > Date.now()) {
    return respuesta({ error: "El certificado todavia no esta vigente" }, 422);
  }
  // Con la CA dentro del .p12, su firma sobre el certificado tiene que validar.
  if (metadatos.cadenaVerificada === false) {
    return respuesta({ error: "La CA incluida en el archivo no valida el certificado" }, 422);
  }
  // La firma debe ser del emisor: su RUC, o la cédula de la persona natural
  // titular de ese RUC (normativa SRI). El certificado de un representante
  // legal de una sociedad trae el RUC de la sociedad en la extensión de la CA.
  const ruc = emisor.emi_ruc as string;
  const coincide = metadatos.identificacionesCandidatas.some((id) => id === ruc || id === ruc.slice(0, 10));
  if (!coincide) {
    return respuesta({
      error: `El certificado no pertenece al RUC ${ruc} (identificaciones encontradas: ${
        metadatos.identificacionesCandidatas.join(", ") || "ninguna"
      })`,
    }, 422);
  }

  const { data: id, error } = await servicio.schema("comun_facturacion").rpc("fac_fn_registrar_certificado", {
    p_negocio: negocio,
    p_usuario: sesion.user.id,
    p_metadatos: {
      titular: metadatos.titular,
      identificacion: metadatos.identificacion,
      identificaciones_candidatas: metadatos.identificacionesCandidatas,
      emisor: metadatos.emisor,
      serial: metadatos.serial,
      huella_sha1: metadatos.huellaSha1,
      valido_desde: metadatos.validoDesde.toISOString(),
      valido_hasta: metadatos.validoHasta.toISOString(),
      cadena_verificada: metadatos.cadenaVerificada,
    },
    p_p12_base64: p12_base64,
    p_clave: clave,
    p_asignar: true,
  });
  if (error) {
    console.error("facturacion-certificado: fallo al registrar", error.message);
    return respuesta({ error: "No se pudo guardar el certificado" }, 500);
  }

  return respuesta({
    ok: true,
    certificado: {
      id,
      titular: metadatos.titular,
      identificacion: metadatos.identificacion,
      emisor: metadatos.emisor,
      valido_desde: metadatos.validoDesde.toISOString(),
      valido_hasta: metadatos.validoHasta.toISOString(),
      cadena_verificada: metadatos.cadenaVerificada,
    },
  }, 200);
});
