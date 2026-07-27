import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { asegurarMembresiaCliente, asegurarTerminosAceptados } from "@/modulos/identidad/acciones";

// Destino del redirectTo de signInWithOAuth (Google). Intercambia el codigo
// por sesion, asegura el rol CLIENTE en Tranqi (PLT-003 regla 1) y registra
// la aceptacion de terminos (PLT-001 regla 6) -- Google no permite inyectar
// metadata propia como el registro por correo, asi que se registra aqui,
// donde ya hay sesion real. Es idempotente: en un login de un usuario que
// ya habia aceptado, no hace nada (ver asegurarTerminosAceptados).
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const siguiente = searchParams.get("next") ?? "/panel";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await asegurarMembresiaCliente(supabase, data.user.id);
      await asegurarTerminosAceptados(supabase, data.user.id);
      return NextResponse.redirect(`${origin}${siguiente}`);
    }
  }

  return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
}
