import { crearClienteServidor } from "@eco/supabase/servidor";

// Server-only. Delega el envio en la Edge Function `enviar-correo`, que es
// quien tiene service_role y por tanto quien puede descifrar la contrasena
// SMTP del negocio desde Supabase Vault (PLT-008, ver ADR-0005).
//
// Antes esta funcion hablaba SMTP directo con nodemailer leyendo variables
// SMTP_* de Vercel. Eso ataba el remitente al despliegue: cambiar de buzon
// exigia un redeploy, y el ADMINISTRADOR del negocio -- que es quien conoce
// su propio correo -- no podia tocarlo. Ahora la configuracion vive en
// comun_configuracion.cfg_smtp y se edita desde la pantalla de Configuracion
// del Negocio.
//
// `negocio` es obligatorio: ya no se asume "el SMTP de la app que llama",
// porque la app dejo de ser la que guarda la credencial.
export async function enviarCorreo({
  negocio,
  para,
  asunto,
  html,
}: {
  negocio: string;
  para: string;
  asunto: string;
  html: string;
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const clave = process.env.CORREO_FUNCION_CLAVE;
  if (!clave) {
    console.error("enviarCorreo: falta CORREO_FUNCION_CLAVE");
    return { ok: false, error: "El envío de correo no está configurado" };
  }

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("enviar-correo", {
    body: { negocio, para, asunto, html },
    headers: { "x-correo-clave": clave },
  });

  if (error || !data?.ok) {
    // Se registra pero no se propaga el detalle al usuario final: un mensaje
    // del proveedor SMTP puede revelar el buzon o la topologia del negocio.
    console.error("enviarCorreo: falló el envío", { negocio, error, respuesta: data });
    return { ok: false, error: data?.error ?? "No se pudo enviar el correo" };
  }

  return { ok: true };
}
