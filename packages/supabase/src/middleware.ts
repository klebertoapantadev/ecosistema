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
  let response = NextResponse.next({ request });

  const corte = new AbortController();
  let temporizador: ReturnType<typeof setTimeout> | undefined;

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
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
