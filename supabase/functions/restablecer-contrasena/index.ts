// Unico lugar del ecosistema donde se usa la service_role key (ver
// supabase/functions/README.md y gobernanza/politicas/gestion-credenciales.md
// §3). Recibe un token de recuperacion (comun_seguridad.seg_recuperacion_correo,
// generado por seg_fn_solicitar_recuperacion) y, si es valido, cambia la
// contrasena via el Admin API -- el usuario no tiene sesion en este flujo
// (llego por un link de correo), por eso no alcanza con
// supabase.auth.updateUser() del lado del cliente.
//
// verify_jwt=false al desplegar: no hay usuario logueado que autentique la
// llamada. El token de recuperacion ES la autenticacion -- 256 bits de
// entropia, hasheado con SHA-256 en la tabla, de un solo uso y expira en 30
// minutos (ver la migracion). Solo se llama server-side desde nuestros
// propios Server Actions (@eco/identidad), nunca desde el navegador.
import { createClient } from "jsr:@supabase/supabase-js@2";

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Metodo no permitido" }), { status: 405 });
  }

  let cuerpo: { token?: unknown; nuevaContrasena?: unknown };
  try {
    cuerpo = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Cuerpo invalido" }), { status: 400 });
  }

  const { token, nuevaContrasena } = cuerpo;
  if (typeof token !== "string" || typeof nuevaContrasena !== "string" || nuevaContrasena.length < 8) {
    return new Response(JSON.stringify({ error: "Datos invalidos" }), { status: 400 });
  }

  const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(token));
  const tokenHash = Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  const { data: fila, error: errorSelect } = await supabase
    .schema("comun_seguridad")
    .from("seg_recuperacion_correo")
    .select("rec_id, rec_usuario_id, rec_expira_en, rec_usado_en")
    .eq("rec_token_hash", tokenHash)
    .maybeSingle();

  if (errorSelect || !fila || fila.rec_usado_en || new Date(fila.rec_expira_en) < new Date()) {
    return new Response(JSON.stringify({ error: "Enlace invalido o vencido" }), { status: 400 });
  }

  const { error: errorUpdate } = await supabase.auth.admin.updateUserById(fila.rec_usuario_id, {
    password: nuevaContrasena,
  });
  if (errorUpdate) {
    return new Response(JSON.stringify({ error: errorUpdate.message }), { status: 500 });
  }

  await supabase
    .schema("comun_seguridad")
    .from("seg_recuperacion_correo")
    .update({ rec_usado_en: new Date().toISOString() })
    .eq("rec_id", fila.rec_id);

  return new Response(JSON.stringify({ ok: true }), { headers: { "Content-Type": "application/json" } });
});
