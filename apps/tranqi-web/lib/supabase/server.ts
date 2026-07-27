import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@eco/db";

// Cliente para Server Components / Server Actions / Route Handlers.
// Propaga la sesion del usuario via cookies -- las politicas RLS ven al
// usuario real, no un rol generico.
export async function crearClienteServidor() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
          } catch {
            // Se llama desde un Server Component sin permiso de escritura de
            // cookies -- el middleware ya se encarga de refrescar la sesion.
          }
        },
      },
    },
  );
}
