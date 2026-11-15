// Server-only (dinamico). Delega el envio en la Edge Function `enviar-correo`, que es
// quien tiene service_role y por tanto quien puede descifrar la contrasena
// SMTP del negocio desde Supabase Vault (PLT-008, ver ADR-0005).

export interface AdjuntoCorreo {
  filename: string;
  content: string;
  contentType?: string;
  encoding?: "base64" | "text";
}

export async function enviarCorreo({
  negocio,
  para,
  asunto,
  html,
  adjuntos,
}: {
  negocio: string;
  para: string;
  asunto: string;
  html: string;
  adjuntos?: AdjuntoCorreo[];
}): Promise<{ ok: true } | { ok: false; error: string }> {
  const clave = process.env.CORREO_FUNCION_CLAVE;
  if (!clave) {
    console.error("enviarCorreo: falta CORREO_FUNCION_CLAVE");
    return { ok: false, error: "El envío de correo no está configurado" };
  }

  const { crearClienteServidor } = await import("@eco/supabase/servidor");
  const supabase = await crearClienteServidor();
  const negNorm = (negocio || "tranqi").trim().toLowerCase();

  let { data, error } = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("enviar-correo", {
    body: { negocio: negNorm, para, asunto, html, adjuntos },
    headers: { "x-correo-clave": clave },
  });

  // Si el negocio actual aún no tiene su servidor SMTP propio activo en Vault (409),
  // utilizar temporalmente el transporte SMTP verificado de plataforma ("tranqi")
  // conservando intactos el asunto, contenido y marca del negocio emisor.
  const mensajeFallo = String(data?.error ?? error?.message ?? "");
  if (
    (error || !data?.ok) &&
    negNorm !== "tranqi" &&
    (mensajeFallo.toLowerCase().includes("smtp") ||
      mensajeFallo.toLowerCase().includes("configuracion") ||
      (error as { context?: { status?: number } } | null)?.context?.status === 409)
  ) {
    const reintento = await supabase.functions.invoke<{ ok?: boolean; error?: string }>("enviar-correo", {
      body: { negocio: "tranqi", para, asunto, html, adjuntos },
      headers: { "x-correo-clave": clave },
    });
    if (!reintento.error && reintento.data?.ok) {
      return { ok: true };
    }
    data = reintento.data ?? data;
    error = reintento.error ?? error;
  }

  if (error || !data?.ok) {
    console.error("enviarCorreo: falló el envío", { negocio: negNorm, error, respuesta: data });
    return { ok: false, error: data?.error ?? "No se pudo enviar el correo" };
  }

  return { ok: true };
}
