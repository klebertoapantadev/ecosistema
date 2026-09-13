import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@eco/db";

// Cliente para Client Components. La URL y la publishable key son publicas
// por diseno -- la seguridad real vive en RLS, no en el secreto de esta clave.
export function crearClienteNavegador() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const key =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.SUPABASE_ANON_KEY ||
    "";
  return createBrowserClient<Database>(url, key);
}
