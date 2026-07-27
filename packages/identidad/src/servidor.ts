import { NextRequest, NextResponse } from "next/server";
import { crearClienteServidor } from "@eco/supabase/servidor";
import { asegurarMembresiaCliente, asegurarTerminosAceptados } from "./acciones";
import { registrarAcceso } from "./acceso";

// Fabrica del Route Handler de callback de OAuth (Google). Cada app expone
// su propio app/auth/callback/route.ts con:
//
//   export const GET = crearManejadorCallbackOAuth("tranqi");
//
// Intercambia el codigo por sesion, asegura el rol CLIENTE en el negocio
// que llama (PLT-003 regla 1), registra la aceptacion de terminos globales
// (PLT-001 regla 6) y el acceso (historial). Google no permite inyectar
// metadata propia como el registro por correo, asi que la aceptacion de
// terminos se registra aqui, donde ya hay sesion real. Es idempotente: en
// un login de un usuario que ya habia aceptado, no hace nada.
export function crearManejadorCallbackOAuth(negocio: string) {
  return async function GET(request: NextRequest) {
    const { searchParams, origin } = new URL(request.url);
    const code = searchParams.get("code");
    const siguiente = searchParams.get("next") ?? "/panel";

    if (code) {
      const supabase = await crearClienteServidor();
      const { error, data } = await supabase.auth.exchangeCodeForSession(code);

      if (!error && data.user) {
        await asegurarMembresiaCliente(supabase, data.user.id, negocio);
        await asegurarTerminosAceptados(supabase, data.user.id);
        const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
        await registrarAcceso(supabase, data.user.id, ip, request.headers.get("user-agent"));
        return NextResponse.redirect(`${origin}${siguiente}`);
      }
    }

    return NextResponse.redirect(`${origin}/ingresar?error=No se pudo iniciar sesión con Google`);
  };
}
