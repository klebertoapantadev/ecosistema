import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/server";
import { asegurarMembresiaCliente } from "@/modulos/identidad/acciones";

// Destino del redirectTo de signInWithOAuth (Google). Intercambia el codigo
// por sesion y asegura el rol CLIENTE en Tranqi (PLT-003 regla 1), igual que
// el registro por correo.
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const siguiente = searchParams.get("next") ?? "/panel";

  if (code) {
    const supabase = await crearClienteServidor();
    const { error, data } = await supabase.auth.exchangeCodeForSession(code);

    if (!error && data.user) {
      await asegurarMembresiaCliente(supabase, data.user.id);
      return NextResponse.redirect(`${origin}${siguiente}`);
    }
  }

  return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
}
