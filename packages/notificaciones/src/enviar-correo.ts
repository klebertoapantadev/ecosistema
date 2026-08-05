// Server-only (dinamico). Delega el envio en la Edge Function `enviar-correo`, que es
// quien tiene service_role y por tanto quien puede descifrar la contrasena
// SMTP del negocio desde Supabase Vault (PLT-008, ver ADR-0005).

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

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("enviar-correo", {
    body: { negocio, para, asunto, html },
    headers: { "x-correo-clave": clave },
  });

  if (error || !data?.ok) {
    console.error("enviarCorreo: falló el envío", { negocio, error, respuesta: data });
    return { ok: false, error: data?.error ?? "No se pudo enviar el correo" };
  }

  return { ok: true };
}
