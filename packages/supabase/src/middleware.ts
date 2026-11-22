import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@eco/db";

// Cuanto esperamos a Supabase antes de seguir sin refrescar la sesion.
//
// No es un numero arbitrario. Si Supabase no contesta, @supabase/auth-js trata el
// fallo como reintentable y repite el refresh con backoff exponencial mientras no
// llegue a AUTO_REFRESH_TICK_DURATION_MS (30 s). El middleware de Vercel se corta a
// los 25 s: la libreria agota el presupuesto de Vercel antes de rendirse sola, y el
// visitante recibe un 504 MIDDLEWARE_INVOCATION_TIMEOUT. Como el matcher cubria todo
// el sitio, un Supabase caido tumbaba hasta la portada. Paramos mucho antes.
const LIMITE_SESION_MS = 3000;

// Refresca la sesion en cada request. Sin esto, el token expira en el
// navegador y las Server Actions empiezan a fallar con sesion invalida
// aunque el usuario siga "logueado" en la UI.
export async function actualizarSesion(request: NextRequest) {
  // Si Supabase Auth redirige a la raíz (/?code=...) por fallback de Redirect URLs tras confirmar Google OAuth,
  // reenviar de inmediato el código PKCE a /auth/callback para intercambiar la sesión y activar el rol invitado.
  const codeOAuth = request.nextUrl.searchParams.get("code");
  if (
    codeOAuth &&
    request.nextUrl.pathname !== "/auth/callback" &&
    !request.nextUrl.pathname.startsWith("/api/")
  ) {
    const urlCallback = request.nextUrl.clone();
    const nextPrevio = request.nextUrl.searchParams.get("next") || "/panel";
    urlCallback.pathname = "/auth/callback";
    urlCallback.search = "";
    urlCallback.searchParams.set("code", codeOAuth);
    urlCallback.searchParams.set("next", nextPrevio);
    return NextResponse.redirect(urlCallback);
  }

  let response = NextResponse.next({ request });

  // Si el navegador no envía ninguna cookie de sesión de Supabase (`sb-*`),
  // no existe sesión que refrescar: evitamos crear el cliente y consumir CPU/red
  // en webhooks, feeds públicos, bots y visitantes anónimos.
  const tieneCookieSupabase = request.cookies
    .getAll()
    .some((cookie) => cookie.name.startsWith("sb-"));
  if (!tieneCookieSupabase) {
    return response;
  }

  const corte = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";

  const supabase = createServerClient<Database>(
    url,
    key,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
        },
      },
      global: {
        fetch: (input, init) => fetch(input, { ...init, signal: corte.signal }),
      },
    },
  );

  try {
    // Promise.race ademas del abort: abortar corta la conexion en curso, pero no
    // saca a auth-js de su bucle de reintentos. La carrera garantiza que la
    // respuesta salga a tiempo aunque la libreria siga insistiendo por detras.
    const agotado = new Promise<never>((_, rechazar) => {
      temporizador = setTimeout(() => {
        corte.abort();
        rechazar(new Error(`Supabase no respondio en ${LIMITE_SESION_MS} ms`));
      }, LIMITE_SESION_MS);
    });

    await Promise.race([supabase.auth.getUser(), agotado]);
  } catch (error) {
    // Seguimos sin sesion refrescada: el visitante vera la parte publica, y las
    // rutas protegidas lo mandaran a /ingresar. Preferible a un sitio caido.
    console.error(
      "[middleware] no se pudo refrescar la sesion:",
      error instanceof Error ? error.message : error,
    );
  } finally {
    clearTimeout(temporizador);
  }

  return response;
}
