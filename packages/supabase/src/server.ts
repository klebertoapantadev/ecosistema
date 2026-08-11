import { createServerClient } from "@supabase/ssr";
import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import type { Database } from "@eco/db";

// Cliente para Server Components / Server Actions / Route Handlers.
// Propaga la sesion del usuario via cookies -- las politicas RLS ven al
// usuario real, no un rol generico. Comun a los 4 negocios: un solo
// proyecto Supabase (NEXT_PUBLIC_SUPABASE_URL/PUBLISHABLE_KEY) sirve a
// tranqi-web, fastfix-web, tinkay-web y margaritas-web por igual.
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

export function crearClienteAdmin() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceKey) return null;
  return createClient<Database>(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceKey);
}
